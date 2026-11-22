/* =====================================================================
   api.js — everything that talks to the API (and so to SQL Server)
   The website never touches the database directly. It sends HTTP
   requests to the API, and the API runs the SQL.

     GET    /api/games          -> list all games      (anyone)
     POST   /api/games          -> add a game          (admin only)
     PUT    /api/games/:id      -> edit a game         (admin only)
     DELETE /api/games/:id      -> delete a game       (admin only)
     GET    /api/admin/check    -> is my admin key right?
   ===================================================================== */

/* ---------- Admin key storage ----------
   After you log in, the key is kept in sessionStorage. It stays while
   the tab is open and is forgotten when you close the tab. */
const KEY_NAME = 'proxyz-admin-key';

/** Returns the saved admin key, or '' if not logged in. */
function getAdminKey() {
  try { return sessionStorage.getItem(KEY_NAME) || ''; }
  catch (e) { return ''; } // some browsers block storage; then we just act logged out
}

/** Saves the admin key (or removes it when key is empty). */
function setAdminKey(key) {
  try {
    if (key) sessionStorage.setItem(KEY_NAME, key);
    else sessionStorage.removeItem(KEY_NAME);
  } catch (e) { /* storage blocked: ignore */ }
}

/**
 * apiRequest(method, path, body)
 * One helper for every API call.
 *  - adds the admin key header (x-admin-key) when logged in
 *  - sends body as JSON
 *  - returns the JSON reply, or throws an Error with .status on failure
 * Example: apiRequest('GET', '/api/games').then(list => ...)
 */
async function apiRequest(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const key = getAdminKey();
  if (key) headers['x-admin-key'] = key;

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 204) return null;            // "No Content" (after DELETE)
  const data = await res.json().catch(() => ({})); // some errors have no JSON body

  if (!res.ok) {
    const err = new Error(data.error || ('HTTP ' + res.status));
    err.status = res.status;                       // e.g. 401 = wrong admin key, 400 = bad input
    throw err;
  }
  return data;
}

/* ---------- Small named helpers (easier to read in app.js) ---------- */

/** Get all games from the database. */
function fetchGames() { return apiRequest('GET', '/api/games'); }

/** Add a new game. `game` = { name, genre, dev, year, desc, color, shape } */
function createGame(game) { return apiRequest('POST', '/api/games', game); }

/** Save changes to an existing game by its Id. */
function updateGame(id, game) { return apiRequest('PUT', '/api/games/' + encodeURIComponent(id), game); }

/** Delete a game by its Id. */
function deleteGame(id) { return apiRequest('DELETE', '/api/games/' + encodeURIComponent(id)); }

/** Ask the API whether the saved admin key is correct. Resolves if yes, throws 401 if not. */
function checkAdminKey() { return apiRequest('GET', '/api/admin/check'); }
