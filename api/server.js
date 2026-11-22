// proxyz games API
// Website (GitHub Pages)  ->  this API  ->  SQL Server
// The browser never talks to SQL Server directly, so your DB password stays secret.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '20kb' }));

// --- CORS: only your website may call this API from a browser ---
const allowed = (process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => (!origin || allowed.includes(origin)) ? cb(null, true) : cb(new Error('Origin not allowed')),
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
function requireAdmin(req, res, next) {
  const given = Buffer.from(String(req.get('x-admin-key') || ''));
  const real = Buffer.from(String(process.env.ADMIN_KEY || ''));
  if (real.length === 0 || given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
    return res.status(401).json({ error: 'Wrong admin key' });
  }
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
  return { game: g };
}

// Map DB columns -> the field names the website already uses
const SELECT_COLS = `Id AS id, Name AS name, Genre AS genre, Developer AS dev,
  ReleaseYear AS year, Description AS [desc], Color AS color, Pattern AS shape`;

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

// Admin: check the key (used by the website's login box)
app.get('/api/admin/check', requireAdmin, (req, res) => res.json({ ok: true }));

// Admin: add game
app.post('/api/games', requireAdmin, async (req, res) => {
  const { game, error } = clean(req.body || {});
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
      .query(`INSERT INTO dbo.Games (Name, Genre, Developer, ReleaseYear, Description, Color, Pattern, SortOrder)
              OUTPUT INSERTED.Id AS id
              VALUES (@name, @genre, @dev, @year, @desc, @color, @shape,
                      (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.Games))`);
    res.status(201).json({ id: r.recordset[0].id, ...game });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save game' });
  }
});

// Admin: edit game
app.put('/api/games/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad id' });
  const { game, error } = clean(req.body || {});
  if (error) return res.status(400).json({ error });
  try {
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.Int, id)
      .input('name', sql.NVarChar(60), game.name)
      .input('genre', sql.NVarChar(40), game.genre || null)
      .input('dev', sql.NVarChar(40), game.dev || null)
      .input('year', sql.NVarChar(4), game.year || null)
      .input('desc', sql.NVarChar(240), game.desc || null)
      .input('color', sql.Char(7), game.color)
      .input('shape', sql.VarChar(12), game.shape)
      .query(`UPDATE dbo.Games SET Name=@name, Genre=@genre, Developer=@dev, ReleaseYear=@year,
              Description=@desc, Color=@color, Pattern=@shape WHERE Id=@id`);
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

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`proxyz API running on http://localhost:${port}`));
