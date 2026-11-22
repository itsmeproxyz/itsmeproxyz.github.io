// proxyz games API
// Website (GitHub Pages)  ->  this API  ->  SQL Server
// The browser never talks to SQL Server directly, so your DB password stays secret.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const crypto = require('crypto');

const app = express();

// --- Basic hardening ---
app.set('trust proxy', 1);          // Azure sits in front -> req.ip is the real visitor IP
app.disable('x-powered-by');        // don't advertise "Express"
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',     // browsers must trust our Content-Type (no guessing)
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });
  next();
});

// 1 MB is enough for one resized card picture (the website shrinks it first)
app.use(express.json({ limit: '1mb' }));

// --- CORS: only your website may call this API from a browser ---
const allowed = (process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  // Unknown sites just get no CORS headers (the browser blocks them) instead of a 500 error page
  origin: (origin, cb) => cb(null, !origin || allowed.includes(origin)),
  allowedHeaders: ['Content-Type', 'x-admin-key'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));

// --- SQL Server connection pool ---
const dbConfig = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),   // fixed TCP port set in SQL Server Configuration Manager
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  },
  // Azure SQL free tier can auto-pause; waking up takes a while, so wait up to 60 s
  connectionTimeout: 60000,
  requestTimeout: 30000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 }
};
let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig).connect().catch(err => {
      poolPromise = null; // allow retry next request (e.g. Azure SQL waking from auto-pause)
      throw err;
    });
  }
  return poolPromise;
}

// --- Admin check for write routes ---
if ((process.env.ADMIN_KEY || '').length < 32) {
  console.warn('WARNING: ADMIN_KEY is shorter than 32 characters. Use a long random key.');
}

// Brute-force guard: after 10 wrong keys from one IP, that IP is blocked for 15 minutes.
const MAX_FAILS = 3;
const BLOCK_MS = 15 * 60 * 1000;
const failedLogins = new Map(); // ip -> { count, until }

function clientIp(req) {
  // Azure may send "1.2.3.4:5678" - drop the port so every request from one IP counts together
  return String(req.ip || '').replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, '$1');
}

function requireAdmin(req, res, next) {
  const ip = clientIp(req);
  const now = Date.now();
  const rec = failedLogins.get(ip);
  if (rec && rec.until > now && rec.count >= MAX_FAILS) {
    return res.status(429).json({ error: 'Too many wrong keys. Try again in 15 minutes.' });
  }

  // Hash both sides so they are always the same length, then compare in constant time
  const given = crypto.createHash('sha256').update(String(req.get('x-admin-key') || '')).digest();
  const real = crypto.createHash('sha256').update(String(process.env.ADMIN_KEY || '')).digest();
  if (!process.env.ADMIN_KEY || !crypto.timingSafeEqual(given, real)) {
    const r = (rec && rec.until > now) ? rec : { count: 0, until: now + BLOCK_MS };
    r.count++;
    failedLogins.set(ip, r);
    if (failedLogins.size > 5000) {                 // tidy up old entries so memory can't grow forever
      for (const [k, v] of failedLogins) if (v.until <= now) failedLogins.delete(k);
    }
    return res.status(401).json({ error: 'Wrong admin key' });
  }

  failedLogins.delete(ip);
  next();
}

// --- Validation (never trust the browser) ---
const PATTERNS = ['rings', 'mountains', 'shards', 'grid'];
function clean(body) {
  const s = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
  const g = {
    name: s(body.name, 60),
    genre: s(body.genre, 40),
    dev: s(body.dev, 40),
    year: s(body.year, 4),
    desc: s(body.desc, 240),
    color: /^#[0-9a-fA-F]{6}$/.test(body.color || '') ? body.color : '#5a4fcf',
    shape: PATTERNS.includes(body.shape) ? body.shape : 'rings'
  };
  if (!g.name) return { error: 'Game name is required' };
  if (g.year && !/^\d{4}$/.test(g.year)) return { error: 'Release year must be 4 digits' };

  // Picture (optional):
  //   body.image = 'data:image/webp;base64,...' -> save this new picture
  //   body.removeImage = true                   -> delete the current picture
  //   neither                                    -> keep whatever is there
  const img = cleanImage(body.image);
  if (img.error) return { error: img.error };
  return { game: g, image: img.value, removeImage: body.removeImage === true };
}

/* ---------- Pictures ----------
   We only accept small JPEG/PNG/WebP pictures sent as a data URL.
   Anything else (wrong type, too big, broken text) is rejected. */
const MAX_IMAGE_CHARS = 700000; // ~500 KB picture. The website sends ~30-150 KB.
const IMAGE_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function cleanImage(v) {
  if (v == null || v === '') return { value: null };            // no new picture
  if (typeof v !== 'string' || !IMAGE_RE.test(v)) return { error: 'Picture must be a JPG, PNG or WebP image' };
  if (v.length > MAX_IMAGE_CHARS) return { error: 'Picture is too big (max ~500 KB)' };
  return { value: v };
}

// Map DB columns -> the field names the website already uses.
// The picture itself is NOT sent in the list (it would make the list huge);
// the website asks for it separately at /api/games/:id/image.
const SELECT_COLS = `Id AS id, Name AS name, Genre AS genre, Developer AS dev,
  ReleaseYear AS year, Description AS [desc], Color AS color, Pattern AS shape,
  CAST(CASE WHEN Image IS NULL THEN 0 ELSE 1 END AS BIT) AS hasImage,
  DATEDIFF_BIG(SECOND, '2000-01-01', ImageUpdatedAt) AS imageAt`;

// --- Routes ---
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Public: list games
app.get('/api/games', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`SELECT ${SELECT_COLS} FROM dbo.Games ORDER BY SortOrder, Id`);
    res.json(r.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load games' });
  }
});

// Public: one game's picture as a real image file (used by <img src="...">)
app.get('/api/games/:id/image', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.Int, id)
      .query('SELECT Image FROM dbo.Games WHERE Id=@id');
    const dataUrl = r.recordset[0] && r.recordset[0].Image;
    const m = dataUrl && IMAGE_RE.exec(dataUrl);
    if (!m) return res.status(404).json({ error: 'No picture' });

    // "data:image/webp;base64,AAAA" -> real bytes + the right Content-Type
    res.set('Content-Type', 'image/' + m[1]);
    // The website adds ?v=<last change> to the address, so the browser can
    // safely keep this file for a long time and still see new uploads.
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load picture' });
  }
});

// Admin: check the key (used by the website's login box)
app.get('/api/admin/check', requireAdmin, (req, res) => res.json({ ok: true }));

// Admin: add game
app.post('/api/games', requireAdmin, async (req, res) => {
  const { game, image, error } = clean(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('name', sql.NVarChar(60), game.name)
      .input('genre', sql.NVarChar(40), game.genre || null)
      .input('dev', sql.NVarChar(40), game.dev || null)
      .input('year', sql.NVarChar(4), game.year || null)
      .input('desc', sql.NVarChar(240), game.desc || null)
      .input('color', sql.Char(7), game.color)
      .input('shape', sql.VarChar(12), game.shape)
      .input('image', sql.VarChar(sql.MAX), image)   // null = no picture
      .query(`INSERT INTO dbo.Games (Name, Genre, Developer, ReleaseYear, Description, Color, Pattern, SortOrder,
                                     Image, ImageUpdatedAt)
              OUTPUT INSERTED.Id AS id
              VALUES (@name, @genre, @dev, @year, @desc, @color, @shape,
                      (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.Games),
                      @image, CASE WHEN @image IS NULL THEN NULL ELSE SYSUTCDATETIME() END)`);
    // Don't echo the picture back - the website reloads the list anyway
    res.status(201).json({ id: r.recordset[0].id, ...game, hasImage: !!image });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save game' });
  }
});

// Admin: edit game
app.put('/api/games/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  const { game, image, removeImage, error } = clean(req.body || {});
  if (error) return res.status(400).json({ error });

  // Picture part of the UPDATE: new picture, remove it, or leave it alone.
  // (Fixed SQL pieces only - the picture itself always goes in as a parameter.)
  let imageSql = '';
  if (image) imageSql = ', Image=@image, ImageUpdatedAt=SYSUTCDATETIME()';
  else if (removeImage) imageSql = ', Image=NULL, ImageUpdatedAt=NULL';

  try {
    const pool = await getPool();
    const request = pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(60), game.name)
      .input('genre', sql.NVarChar(40), game.genre || null)
      .input('dev', sql.NVarChar(40), game.dev || null)
      .input('year', sql.NVarChar(4), game.year || null)
      .input('desc', sql.NVarChar(240), game.desc || null)
      .input('color', sql.Char(7), game.color)
      .input('shape', sql.VarChar(12), game.shape);
    if (image) request.input('image', sql.VarChar(sql.MAX), image);

    const r = await request.query(`UPDATE dbo.Games SET Name=@name, Genre=@genre, Developer=@dev, ReleaseYear=@year,
              Description=@desc, Color=@color, Pattern=@shape${imageSql} WHERE Id=@id`);
    if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Game not found' });
    res.json({ id, ...game });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update game' });
  }
});

// Admin: delete game
app.delete('/api/games/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  try {
    const pool = await getPool();
    await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Games WHERE Id=@id');
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete game' });
  }
});

// --- Profile (a single row, Id = 1) ---
// The avatar (profile picture) is stored like the game pictures: a small
// data URL in the database, served as a real image at /api/profile/avatar.
function cleanProfile(body) {
  const s = (v, max) => (v == null ? '' : String(v).trim().slice(0, max));
  const profile = {
    tagline:   s(body.tagline, 60),
    location:  s(body.location, 60),
    mainGenre: s(body.mainGenre, 40),
    sideQuest: s(body.sideQuest, 40),
    bio:       s(body.bio, 1000)
  };

  // Avatar (optional):
  //   body.avatar       = 'data:image/webp;base64,...' -> save this new picture
  //   body.removeAvatar = true                         -> delete the current picture
  //   neither                                          -> keep whatever is there
  const img = cleanImage(body.avatar);
  if (img.error) return { error: img.error };
  return { profile, avatar: img.value, removeAvatar: body.removeAvatar === true };
}

// The picture itself is NOT in this list; the website loads it from /api/profile/avatar.
const PROFILE_COLS = `Tagline AS tagline, Location AS location, MainGenre AS mainGenre,
  SideQuest AS sideQuest, Bio AS bio,
  CAST(CASE WHEN Avatar IS NULL THEN 0 ELSE 1 END AS BIT) AS hasAvatar,
  DATEDIFF_BIG(SECOND, '2000-01-01', AvatarUpdatedAt) AS avatarAt`;

// Public: read profile
app.get('/api/profile', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`SELECT ${PROFILE_COLS} FROM dbo.Profile WHERE Id = 1`);
    res.json(r.recordset[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load profile' });
  }
});

// Public: the profile picture as a real image file (used by <img src="...">)
app.get('/api/profile/avatar', async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().query('SELECT Avatar FROM dbo.Profile WHERE Id = 1');
    const dataUrl = r.recordset[0] && r.recordset[0].Avatar;
    const m = dataUrl && IMAGE_RE.exec(dataUrl);
    if (!m) return res.status(404).json({ error: 'No picture' });

    res.set('Content-Type', 'image/' + m[1]);
    // Same trick as the game pictures: the website adds ?v=<last change>.
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(m[2], 'base64'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load picture' });
  }
});

// Admin: edit profile
app.put('/api/profile', requireAdmin, async (req, res) => {
  const { profile: p, avatar, removeAvatar, error } = cleanProfile(req.body || {});
  if (error) return res.status(400).json({ error });

  // Avatar part of the UPDATE: new picture, remove it, or leave it alone.
  // (Fixed SQL pieces only - the picture itself always goes in as a parameter.)
  let avatarSql = '';
  if (avatar) avatarSql = ', Avatar=@avatar, AvatarUpdatedAt=SYSUTCDATETIME()';
  else if (removeAvatar) avatarSql = ', Avatar=NULL, AvatarUpdatedAt=NULL';

  try {
    const pool = await getPool();
    const request = pool.request()
      .input('tagline',   sql.NVarChar(60),   p.tagline   || null)
      .input('location',  sql.NVarChar(60),   p.location  || null)
      .input('mainGenre', sql.NVarChar(40),   p.mainGenre || null)
      .input('sideQuest', sql.NVarChar(40),   p.sideQuest || null)
      .input('bio',       sql.NVarChar(1000), p.bio       || null);
    if (avatar) request.input('avatar', sql.VarChar(sql.MAX), avatar);

    // Update, then send back the saved profile (incl. hasAvatar / avatarAt)
    const r = await request.query(`UPDATE dbo.Profile SET Tagline=@tagline, Location=@location, MainGenre=@mainGenre,
              SideQuest=@sideQuest, Bio=@bio, UpdatedAt=SYSUTCDATETIME()${avatarSql} WHERE Id = 1;
      SELECT ${PROFILE_COLS} FROM dbo.Profile WHERE Id = 1;`);
    if (r.rowsAffected[0] === 0) return res.status(404).json({ error: 'Profile row missing - run profile.sql' });
    const saved = r.recordsets[r.recordsets.length - 1] || [];
    res.json(saved[0] || p);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile' });
  }
});

// --- Last stop for errors (broken JSON, body too big, ...) ---
// Sends a short JSON message instead of Express's default page with file paths in it.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status === 413 ? 'Request too big' : status < 500 ? 'Bad request' : 'Server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`proxyz API running on http://localhost:${port}`));
