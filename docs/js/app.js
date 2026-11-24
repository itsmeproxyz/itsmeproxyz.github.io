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
     8. Card picture upload           -> onPickImage(), resizeImage()
     9. Animations                    -> reveal on scroll, card tilt, count-up
    10. Start-up                      -> runs when the page loads
   Uses functions from api.js (fetchGames, createGame, gameImageUrl...) and
   art.js (drawCardArt, startHero, PATTERNS, REDUCED_MOTION).
   ===================================================================== */

// Tells style.css that JavaScript is running, so it can hide things that
// JS will animate in (without JS, everything simply stays visible).
document.documentElement.classList.add('js');

/* ---------- Shared state ----------
   Plain variables the whole file reads and changes. */
const state = {
  games: [],          // the list currently shown on the page
  isAdmin: false,     // true after a correct admin login
  editingId: null,    // Id of the game being edited (null = adding a new one)
  pendingImage: null, // new picture picked in the form (data URL), not saved yet
  removeImage: false  // true when "Remove picture" was clicked in the form
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
const picInput = document.getElementById('f-image');
const picPreview = document.getElementById('pic-preview');
const btnRemovePic = document.getElementById('btn-remove-pic');

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

  if (name === 'home') startHero();   // animated background (art.js)
  window.scrollTo(0, 0);
  watchReveals();                      // animate the new page's boxes in (section 9)
}
window.addEventListener('hashchange', showView);


/* =====================================================================
   2. STATUS MESSAGES
   ===================================================================== */
/** Writes a short message under the "My Games" title. isError = red text. */
function setNote(text, isError) {
  note.textContent = text || '';
  note.classList.toggle('text-danger', !!isError);
  note.classList.toggle('text-secondary', !isError);
}

/** Updates the game count on Home and the "Library · N games" tag. */
function updateCounts(n) {
  countUp(document.getElementById('game-count'), n);
  document.getElementById('library-tag').textContent = 'Library · ' + n + (n === 1 ? ' game' : ' games');
}

/**
 * countUp(element, target)
 * Rolls a number up from its current value to `target` in ~0.8 s,
 * like a score counter. Shows the final number right away if motion is reduced.
 */
function countUp(element, target) {
  const from = parseInt(element.textContent, 10) || 0;
  if (REDUCED_MOTION || from === target) { element.textContent = target; return; }
  const start = performance.now();
  const step = now => {
    const p = Math.min(1, (now - start) / 800);          // progress 0..1
    const eased = 1 - Math.pow(1 - p, 3);                 // fast start, soft landing
    element.textContent = Math.round(from + (target - from) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
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
 * safeLink(text)
 * Returns a full web address ("warframe.com" -> "https://warframe.com/"),
 * or '' if it isn't one. Only http/https is allowed, so a "javascript:..."
 * link can never end up on a card.
 */
function safeLink(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : 'https://' + t);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
    if (u.username || u.password || !u.hostname.includes('.')) return '';
    return u.href;
  } catch (e) { return ''; }
}

/**
 * buildCard(game, index)
 * Builds ONE Bootstrap card for a game and returns its column element.
 * Card parts: art (uploaded picture, or canvas pattern + number + genre),
 * title, description, developer/year line, and Edit/Delete buttons
 * when logged in as admin. If the game has an official website, the
 * whole card is a link to it (opens in a new tab).
 */
function buildCard(game, index) {
  const color = safeColor(game.color);
  const col = el('div', 'col');                 // grid column (see row-cols-* in index.html)
  col.style.setProperty('--i', index);          // CSS uses it to delay each card's entrance a bit more
  const card = el('article', 'card game-card');
  card.style.setProperty('--c', color);         // used by CSS for the art + hover glow

  // -- Art --
  const art = el('div', 'game-art');
  const canvas = document.createElement('canvas');
  art.append(canvas);

  // Uploaded picture goes on top of the pattern. If it fails to load
  // (deleted, offline...), we remove it and the pattern shows instead.
  const imgUrl = gameImageUrl(game);
  if (imgUrl) {
    const img = document.createElement('img');
    img.className = 'game-img';
    img.alt = '';                 // decorative: the game name is right below
    img.loading = 'lazy';         // only download when the card is near the screen
    img.decoding = 'async';
    img.addEventListener('load', () => img.classList.add('loaded'));  // fade in (CSS)
    img.addEventListener('error', () => img.remove());
    img.src = imgUrl;
    art.append(img);
  }

  art.append(el('span', 'num', '#' + String(index + 1).padStart(2, '0')));
  if (game.genre) art.append(el('span', 'genre', game.genre));

  // -- Body --
  const body = el('div', 'card-body d-flex flex-column gap-2');
  const title = el('h3', 'card-title mb-0');
  const link = safeLink(game.link);
  if (link) {
    // Bootstrap's "stretched-link" makes the whole card clickable
    const a = el('a', 'card-link-full stretched-link', game.name || 'Untitled');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';   // the other site can't control or track this tab
    a.append(el('span', 'visually-hidden', ' – official website, opens in a new tab'));
    title.append(a);
    card.classList.add('has-link');
  } else {
    title.textContent = game.name || 'Untitled';
  }
  body.append(title);
  if (game.desc) body.append(el('p', 'card-text mb-0', game.desc));

  const meta = el('div', 'game-meta d-flex justify-content-between mt-auto');
  const dev = el('span', null, 'Dev '); dev.append(el('b', null, game.dev || '–'));
  const year = el('span', null, 'Released '); year.append(el('b', null, game.year || '–'));
  meta.append(dev, year);
  body.append(meta);

  // -- Admin buttons (only for real database rows, which have an id) --
  if (state.isAdmin && game.id != null) {
    const actions = el('div', 'card-actions d-flex gap-2');   // sits above the card link (CSS)
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
  addTilt(card);                                // 3D tilt that follows the mouse (section 9)

  // Draw after the canvas exists
  drawCardArt(canvas, color, PATTERNS.includes(game.shape) ? game.shape : 'rings');
  return col;
}

/**
 * renderSkeletons(count)
 * Shows grey placeholder cards with a moving shine while the list loads,
 * so the page doesn't look empty or jump around.
 */
function renderSkeletons(count) {
  grid.replaceChildren();
  for (let i = 0; i < count; i++) {
    const col = el('div', 'col');
    col.style.setProperty('--i', i);
    const card = el('div', 'card game-card skeleton');
    card.setAttribute('aria-hidden', 'true');
    card.append(el('div', 'sk-art'), el('div', 'sk-line'), el('div', 'sk-line short'));
    col.append(card);
    grid.append(col);
  }
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
  if (!state.games.length) renderSkeletons(4);   // first load: placeholder cards
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
  field('f-link').value = game ? game.link || '' : '';
  field('f-link').setCustomValidity('');
  field('f-desc').value = game ? game.desc || '' : '';

  // Picture: start clean, then show the game's current picture (if any)
  state.pendingImage = null;
  state.removeImage = false;
  picInput.value = '';
  showPicPreview(gameImageUrl(game));

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
    link: field('f-link').value.trim(),       // '' = no link
    desc: field('f-desc').value.trim(),
    image: state.pendingImage || undefined,   // only sent when a new picture was picked
    removeImage: state.removeImage            // true = delete the saved picture
  };
}

/** Completes the typed website address ("warframe.com" -> "https://...") or marks it as wrong. */
function checkLinkField() {
  const input = field('f-link');
  const typed = input.value.trim();
  const link = safeLink(typed);
  if (link) input.value = link;
  input.setCustomValidity(typed && (!link || link.length > 300) ? 'Not a web address' : '');
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
  checkLinkField();
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
      // 413 = the API said "too big" (a picture over its 1 MB limit)
      formError.textContent = err.status === 400 ? err.message
        : err.status === 413 ? 'That picture is too big. Try a smaller one.'
        : 'Could not save. Is the API running?';
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
   8. CARD PICTURE UPLOAD
   The picture is shrunk IN THE BROWSER before it's sent, so a 5 MB phone
   photo becomes a ~30-150 KB WebP. That keeps the database small and
   the site fast. The API double-checks type and size anyway.
   ===================================================================== */
const PIC_MAX_W = 960;          // card art is never wider than this on screen
const PIC_MAX_H = 600;
const PIC_MAX_CHARS = 650000;   // stay under the API's limit (~500 KB picture)

/** Shows a picture (URL or data URL) in the form's preview box, or the "No picture" text. */
function showPicPreview(src) {
  picPreview.replaceChildren();
  if (src) {
    const img = document.createElement('img');
    img.alt = 'Card picture preview';
    img.src = src;
    picPreview.append(img);
  } else {
    picPreview.append(el('span', null, 'No picture yet – the pattern is used'));
  }
  btnRemovePic.classList.toggle('d-none', !src);
}

/**
 * resizeImage(file)
 * Loads the chosen file, scales it down to fit PIC_MAX_W x PIC_MAX_H
 * (never up), and returns it as a WebP data URL (JPEG if the browser
 * can't make WebP). Lowers the quality step by step if it's still too big.
 */
async function resizeImage(file) {
  const bitmap = await createImageBitmap(file);   // decodes JPG/PNG/WebP
  const scale = Math.min(1, PIC_MAX_W / bitmap.width, PIC_MAX_H / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    let url = canvas.toDataURL('image/webp', quality);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality); // old Safari
    if (url.length <= PIC_MAX_CHARS) return url;
  }
  throw new Error('Picture is still too big after shrinking');
}

/** Runs when a file is chosen in the form. */
async function onPickImage() {
  const file = picInput.files[0];
  formError.classList.add('d-none');
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    picInput.value = '';
    formError.textContent = 'Please choose a JPG, PNG or WebP picture.';
    formError.classList.remove('d-none');
    return;
  }

  const saveBtn = field('btn-save');
  saveBtn.disabled = true;                       // wait until the picture is ready
  picPreview.classList.add('busy');
  try {
    state.pendingImage = await resizeImage(file);
    state.removeImage = false;
    showPicPreview(state.pendingImage);
  } catch (err) {
    picInput.value = '';
    formError.textContent = 'Could not read that picture. Try another one.';
    formError.classList.remove('d-none');
  } finally {
    picPreview.classList.remove('busy');
    saveBtn.disabled = false;
  }
}

/** "Remove picture": forget a new pick and mark the saved one for deletion. */
function onRemovePic() {
  state.pendingImage = null;
  state.removeImage = state.editingId != null;   // only matters when editing a saved game
  picInput.value = '';
  showPicPreview('');
}


/* =====================================================================
   9. ANIMATIONS
   Everything here is skipped when the visitor's system asks for
   reduced motion (REDUCED_MOTION from art.js). CSS does the rest.
   ===================================================================== */

/* Reveal on scroll: elements with class "reveal" get "in" the first time
   they appear on screen, and CSS slides/fades them in. */
const revealObserver = ('IntersectionObserver' in window && !REDUCED_MOTION)
  ? new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);   // animate only once
      });
    }, { threshold: 0.15 })
  : null;

/** Starts watching every .reveal element that hasn't animated in yet. */
function watchReveals() {
  document.querySelectorAll('.reveal:not(.in)').forEach((elem, i) => {
    elem.style.setProperty('--i', i % 3);         // small stagger inside each row
    if (revealObserver) revealObserver.observe(elem);
    else elem.classList.add('in');                // no observer / reduced motion: just show
  });
}

/**
 * addTilt(card)
 * Tilts the card in 3D toward the mouse and moves a light spot under
 * the cursor. Only on devices with a real mouse (not touch screens).
 */
const CAN_HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function addTilt(card) {
  if (REDUCED_MOTION || !CAN_HOVER) return;
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;     // 0 = left edge, 1 = right edge
    const y = (e.clientY - r.top) / r.height;     // 0 = top, 1 = bottom
    card.style.setProperty('--ry', ((x - 0.5) * 10).toFixed(2) + 'deg');   // max ±5°
    card.style.setProperty('--rx', ((0.5 - y) * 10).toFixed(2) + 'deg');
    card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');           // light spot position
    card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}


/* =====================================================================
   10. START-UP — wire the buttons, show the right page, load games
   ===================================================================== */
picInput.addEventListener('change', onPickImage);
btnRemovePic.addEventListener('click', onRemovePic);
btnAdd.addEventListener('click', () => openGameForm(null));
btnLogout.addEventListener('click', () => { logout(); setNote('Logged out.'); });
gameForm.addEventListener('submit', onSaveGame);
field('f-link')?.addEventListener('input', e => e.target.setCustomValidity('')); // clear the error while typing
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
