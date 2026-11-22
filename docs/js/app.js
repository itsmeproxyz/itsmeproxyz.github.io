/* =====================================================================
   app.js — the main logic of the website
   Sections:
     1. Page switching (router)       -> showView()
     2. Status messages               -> setNote()
     3. Building the game cards       -> renderGames(), buildCard()
     4. Loading games from the API    -> loadGames()
     5. Add / Edit form (modal)       -> openGameForm(), onSaveGame()
     6. Delete                        -> onDeleteClick()
     7. Admin login / logout          -> onLogin(), setAdmin(), logout()
     8. Start-up                      -> runs when the page loads
   Uses functions from api.js (fetchGames, createGame...) and
   art.js (drawCardArt, drawHero, PATTERNS).
   ===================================================================== */

/* ---------- Shared state ----------
   Plain variables the whole file reads and changes. */
const state = {
  games: [],        // the list currently shown on the page
  isAdmin: false,   // true after a correct admin login
  editingId: null   // Id of the game being edited (null = adding a new one)
};

/* Shown only if the API can't be reached, so the page is never empty. */
const FALLBACK_GAMES = [
  { name: 'Warframe', genre: 'Co-op action shooter', dev: 'Digital Extremes', year: '2013', color: '#2f6f8f', shape: 'rings',
    desc: 'Space ninjas, wild movement and an endless pile of gear to farm. A looter shooter you can sink hundreds of hours into.' },
  { name: 'Black Desert Online', genre: 'MMORPG', dev: 'Pearl Abyss', year: '2015', color: '#8a5a2b', shape: 'mountains',
    desc: 'A huge open world with fast action combat, deep lifeskills and gear enhancing that tests every ounce of patience.' },
  { name: 'Valorant', genre: 'Tactical shooter', dev: 'Riot Games', year: '2020', color: '#b8384a', shape: 'shards',
    desc: '5v5 rounds where agent abilities meet precise gunplay. Every round is a new plan, every clutch a story.' },
  { name: 'Counter-Strike 2', genre: 'Tactical FPS', dev: 'Valve', year: '2023', color: '#c98a1c', shape: 'grid',
    desc: 'The classic bomb-defuse formula. Crosshair placement, utility and teamwork decide everything.' }
];

/* ---------- Shortcuts to page elements ---------- */
const grid = document.getElementById('grid');
const note = document.getElementById('lib-note');
const btnAdd = document.getElementById('btn-add');
const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const gameForm = document.getElementById('game-form');
const loginForm = document.getElementById('login-form');
const formError = document.getElementById('form-error');
const loginError = document.getElementById('login-error');

// Bootstrap modal objects: .show() opens, .hide() closes
const gameModal = new bootstrap.Modal(document.getElementById('gameModal'));
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));


/* =====================================================================
   1. PAGE SWITCHING
   The URL hash decides the page: index.html#games shows My Games.
   ===================================================================== */
const VIEWS = ['home', 'profile', 'games'];

/** Shows the page named in the URL hash and hides the others. */
function showView() {
  let name = (location.hash || '#home').slice(1); // "#games" -> "games"
  if (!VIEWS.includes(name)) name = 'home';       // unknown hash -> Home

  VIEWS.forEach(v => {
    document.getElementById('view-' + v).classList.toggle('active', v === name);
  });
  // Highlight the matching navbar link
  document.querySelectorAll('.site-nav .nav-link').forEach(a => {
    const on = a.dataset.view === name;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  // Close the mobile menu after picking a page
  const menu = document.getElementById('mainNav');
  if (menu.classList.contains('show')) bootstrap.Collapse.getOrCreateInstance(menu).hide();

  if (name === 'home') drawHero();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', showView);


/* =====================================================================
   2. STATUS MESSAGES
   ===================================================================== */
/** Writes a short message under the "My Games" title. isError = orange-red text. */
function setNote(text, isError) {
  note.textContent = text || '';
  note.classList.toggle('text-warning', !!isError);
  note.classList.toggle('text-secondary', !isError);
}

/** Updates the game count on Home and the "Library · N games" tag. */
function updateCounts(n) {
  document.getElementById('game-count').textContent = n;
  document.getElementById('library-tag').textContent = 'Library · ' + n + (n === 1 ? ' game' : ' games');
}


/* =====================================================================
   3. BUILDING THE GAME CARDS
   Data from the database is treated as untrusted: we only put it on
   the page with textContent (never innerHTML), so nobody can inject code.
   ===================================================================== */

/** Small helper: create an element with a class and text. */
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

/** Returns the color if it's a valid #RRGGBB, otherwise a default purple. */
function safeColor(c) {
  return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#5a4fcf';
}

/**
 * buildCard(game, index)
 * Builds ONE Bootstrap card for a game and returns its column element.
 * Card parts: art (canvas + number + genre), title, description,
 * developer/year line, and Edit/Delete buttons when logged in as admin.
 */
function buildCard(game, index) {
  const color = safeColor(game.color);
  const col = el('div', 'col');                 // grid column (see row-cols-* in index.html)
  const card = el('article', 'card game-card');
  card.style.setProperty('--c', color);         // used by CSS for the art + hover border

  // -- Art --
  const art = el('div', 'game-art');
  const canvas = document.createElement('canvas');
  art.append(canvas, el('span', 'num', '#' + String(index + 1).padStart(2, '0')));
  if (game.genre) art.append(el('span', 'genre', game.genre));

  // -- Body --
  const body = el('div', 'card-body d-flex flex-column gap-2');
  body.append(el('h3', 'card-title mb-0', game.name || 'Untitled'));
  if (game.desc) body.append(el('p', 'card-text mb-0', game.desc));

  const meta = el('div', 'game-meta d-flex justify-content-between mt-auto');
  const dev = el('span', null, 'Dev '); dev.append(el('b', null, game.dev || '–'));
  const year = el('span', null, 'Since '); year.append(el('b', null, game.year || '–'));
  meta.append(dev, year);
  body.append(meta);

  // -- Admin buttons (only for real database rows, which have an id) --
  if (state.isAdmin && game.id != null) {
    const actions = el('div', 'd-flex gap-2');
    const editBtn = el('button', 'btn btn-sm btn-outline-secondary', 'Edit');
    editBtn.type = 'button';
    editBtn.addEventListener('click', () => openGameForm(game));
    const delBtn = el('button', 'btn btn-sm btn-outline-danger', 'Delete');
    delBtn.type = 'button';
    delBtn.addEventListener('click', () => onDeleteClick(delBtn, game));
    actions.append(editBtn, delBtn);
    body.append(actions);
  }

  card.append(art, body);
  col.append(card);

  // Draw after the canvas exists
  drawCardArt(canvas, color, PATTERNS.includes(game.shape) ? game.shape : 'rings');
  return col;
}

/** Clears the grid and draws a card for every game in `list`. */
function renderGames(list) {
  state.games = list;
  grid.replaceChildren();          // remove old cards
  updateCounts(list.length);

  if (!list.length) {
    const box = el('div', 'col-12');
    box.append(el('div', 'empty-box',
      state.isAdmin ? 'Your library is empty. Click "+ Add game" to add your first one.' : 'No games here yet.'));
    grid.append(box);
    return;
  }
  list.forEach((game, i) => grid.append(buildCard(game, i)));
}


/* =====================================================================
   4. LOADING GAMES FROM THE API
   ===================================================================== */
/**
 * loadGames()
 * Asks the API for the game list and shows it.
 * - Slow (database waking up)? shows a waiting note after 8 seconds.
 * - API down? shows the built-in FALLBACK_GAMES with a warning.
 */
async function loadGames() {
  const slowTimer = setTimeout(() => setNote('Still loading… the database may be waking up.', true), 8000);
  try {
    const list = await fetchGames();
    renderGames(list);
    setNote(state.isAdmin ? 'Logged in as admin. You can add, edit and delete games.' : '');
  } catch (err) {
    if (!state.games.length) renderGames(FALLBACK_GAMES);
    setNote('The live library is unavailable right now. Showing the saved list.', true);
  } finally {
    clearTimeout(slowTimer);
  }
}


/* =====================================================================
   5. ADD / EDIT FORM
   ===================================================================== */
/** Short way to get a form input by id. */
const field = id => document.getElementById(id);

/**
 * openGameForm(game)
 * Opens the pop-up form. With a game -> Edit mode (inputs pre-filled).
 * Without -> Add mode (empty inputs).
 */
function openGameForm(game) {
  state.editingId = game ? game.id : null;
  field('gameModalTitle').textContent = game ? 'Edit ' + game.name : 'Add a game';
  field('f-name').value = game ? game.name || '' : '';
  field('f-genre').value = game ? game.genre || '' : '';
  field('f-dev').value = game ? game.dev || '' : '';
  field('f-year').value = game ? game.year || '' : '';
  field('f-color').value = game ? safeColor(game.color) : '#5a4fcf';
  field('f-shape').value = game && PATTERNS.includes(game.shape) ? game.shape : 'rings';
  field('f-desc').value = game ? game.desc || '' : '';
  gameForm.classList.remove('was-validated'); // hide old red error borders
  formError.classList.add('d-none');
  gameModal.show();
}

/** Reads the form inputs into a game object for the API. */
function readGameForm() {
  return {
    name: field('f-name').value.trim(),
    genre: field('f-genre').value.trim(),
    dev: field('f-dev').value.trim(),
    year: field('f-year').value.trim(),
    color: safeColor(field('f-color').value),
    shape: field('f-shape').value,
    desc: field('f-desc').value.trim()
  };
}

/**
 * onSaveGame(event)
 * Runs when you click "Save game".
 * 1. Checks the inputs (Bootstrap shows red borders for errors)
 * 2. Sends POST (add) or PUT (edit) to the API
 * 3. Closes the form and reloads the list
 */
async function onSaveGame(event) {
  event.preventDefault();                     // stop the browser's own form submit
  gameForm.classList.add('was-validated');    // turn on Bootstrap validation styles
  if (!gameForm.checkValidity()) return;      // a required/pattern rule failed

  const game = readGameForm();
  const saveBtn = field('btn-save');
  saveBtn.disabled = true;
  formError.classList.add('d-none');

  try {
    if (state.editingId != null) await updateGame(state.editingId, game);
    else await createGame(game);
    gameModal.hide();
    setNote(game.name + ' saved.');
    await loadGames();
  } catch (err) {
    if (err.status === 401) {                 // admin key no longer valid
      gameModal.hide();
      logout();
      setNote('Your admin key was rejected. Log in again.', true);
    } else {
      formError.textContent = err.status === 400 ? err.message : 'Could not save. Is the API running?';
      formError.classList.remove('d-none');
    }
  } finally {
    saveBtn.disabled = false;
  }
}


/* =====================================================================
   6. DELETE
   ===================================================================== */
/**
 * onDeleteClick(button, game)
 * First click turns the button into "Sure? Click again" for 3.5 seconds.
 * Second click inside that time really deletes. Prevents accidents.
 */
async function onDeleteClick(button, game) {
  if (!button.dataset.armed) {
    button.dataset.armed = '1';
    button.textContent = 'Sure? Click again';
    button.classList.replace('btn-outline-danger', 'btn-danger');
    setTimeout(() => {
      delete button.dataset.armed;
      button.textContent = 'Delete';
      button.classList.replace('btn-danger', 'btn-outline-danger');
    }, 3500);
    return;
  }
  button.disabled = true;
  try {
    await deleteGame(game.id);
    setNote(game.name + ' removed.');
    await loadGames();
  } catch (err) {
    button.disabled = false;
    if (err.status === 401) { logout(); setNote('Your admin key was rejected. Log in again.', true); }
    else setNote('Could not delete that game. Try again in a moment.', true);
  }
}


/* =====================================================================
   7. ADMIN LOGIN / LOGOUT
   ===================================================================== */
/** Turns admin mode on/off: swaps the buttons and redraws the cards. */
function setAdmin(on) {
  state.isAdmin = on;
  btnAdd.classList.toggle('d-none', !on);
  btnLogout.classList.toggle('d-none', !on);
  btnLogin.classList.toggle('d-none', on);
  renderGames(state.games);   // add or remove Edit/Delete buttons
}

/** Forgets the admin key and leaves admin mode. */
function logout() {
  setAdminKey('');
  setAdmin(false);
}

/**
 * onLogin(event)
 * Saves the typed key, asks the API if it's right (checkAdminKey),
 * and turns on admin mode if yes.
 */
async function onLogin(event) {
  event.preventDefault();
  const key = field('f-key').value.trim();
  if (!key) return;
  setAdminKey(key);
  loginError.classList.add('d-none');
  try {
    await checkAdminKey();
    field('f-key').value = '';
    loginModal.hide();
    setAdmin(true);
    setNote('Logged in as admin. You can add, edit and delete games.');
  } catch (err) {
    setAdminKey('');
    loginError.textContent = err.status === 401 ? 'That admin key is wrong.' : 'Could not reach the API to check your key.';
    loginError.classList.remove('d-none');
  }
}


/* =====================================================================
   8. START-UP — wire the buttons, show the right page, load games
   ===================================================================== */
btnAdd.addEventListener('click', () => openGameForm(null));
btnLogout.addEventListener('click', () => { logout(); setNote('Logged out.'); });
gameForm.addEventListener('submit', onSaveGame);
loginForm.addEventListener('submit', onLogin);
// Put the cursor in the key box when the login pop-up opens
document.getElementById('loginModal').addEventListener('shown.bs.modal', () => field('f-key').focus());

showView();

// Still logged in from earlier in this tab? Check the saved key first.
(async function start() {
  if (getAdminKey()) {
    try { await checkAdminKey(); state.isAdmin = true; setAdmin(true); }
    catch (e) { setAdminKey(''); }
  }
  await loadGames();
})();
