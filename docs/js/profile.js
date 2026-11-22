/* =====================================================================
   profile.js — the "My Profile" data (tagline, location, genres, bio)
   Loads it from the API and lets the admin edit it in #profileModal.

   GET /api/profile        -> anyone
   GET /api/profile/avatar -> the profile picture (anyone, used in <img>)
   PUT /api/profile        -> admin only (uses the same admin key as the games)

   Every element with data-profile="<field>" gets that field's value, so
   the location on Home, the player card and the footer all update together.
   The text already in index.html stays as the fallback if the API is down.

   Load order: after app.js (uses bootstrap, fetchProfile/updateProfile
   from api.js, and logout() from app.js).
   ===================================================================== */

const PROFILE_FIELDS = ['tagline', 'location', 'mainGenre', 'sideQuest', 'bio'];

const profileModal  = new bootstrap.Modal(document.getElementById('profileModal'));
const profileForm   = document.getElementById('profile-form');
const profileError  = document.getElementById('profile-error');
const btnEditProfile = document.getElementById('btn-edit-profile');
const btnSaveProfile = document.getElementById('btn-save-profile');

const avatarInput     = document.getElementById('pf-avatar');
const avatarPreview   = document.getElementById('pf-avatar-preview');
const btnRemoveAvatar = document.getElementById('btn-remove-avatar');

// The last profile we got from the API (null = not loaded / API down)
let currentProfile = null;

// Picture changes in the open form, not saved yet
const avatarEdit = {
  pending: null,   // new picture (data URL) picked in the form
  remove: false    // true when "Remove picture" was clicked
};

/* ---------- Profile picture helpers ---------- */

/** Address of the uploaded picture, or '' if there is none.
    ?v=<last change> makes the browser fetch a fresh copy after a new upload. */
function avatarUrl(p) {
  if (!p || !p.hasAvatar) return '';
  return API_BASE + '/api/profile/avatar?v=' + encodeURIComponent(p.avatarAt || 0);
}

/** Shows a picture inside a .badge-avatar box, or the "P" letter when src is ''. */
function setAvatarBox(box, src) {
  if (!src) { box.replaceChildren(document.createTextNode('P')); return; }
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;';
  img.onerror = () => box.replaceChildren(document.createTextNode('P'));  // broken -> letter
  box.replaceChildren(img);
}

/**
 * squareAvatar(file) -> Promise<data URL>
 * Crops the middle square of the picture and shrinks it to 256x256,
 * as WebP (or JPEG if the browser can't make WebP), so uploads stay small.
 */
function squareAvatar(file) {
  const SIZE = 256;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(url);
      let data = canvas.toDataURL('image/webp', 0.85);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.85);
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that picture')); };
    img.src = url;
  });
}

async function onPickAvatar() {
  const file = avatarInput.files && avatarInput.files[0];
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    showProfileError('Picture must be a JPG, PNG or WebP image.');
    avatarInput.value = '';
    return;
  }
  if (file.size > 15 * 1024 * 1024) {
    showProfileError('That picture is huge (over 15 MB). Try a smaller one.');
    avatarInput.value = '';
    return;
  }
  try {
    avatarEdit.pending = await squareAvatar(file);
    avatarEdit.remove = false;
    setAvatarBox(avatarPreview, avatarEdit.pending);
    btnRemoveAvatar.classList.remove('d-none');
    showProfileError('');
  } catch (err) {
    showProfileError(err.message);
  }
}

function onRemoveAvatar() {
  avatarEdit.pending = null;
  avatarEdit.remove = true;
  avatarInput.value = '';
  setAvatarBox(avatarPreview, '');
  btnRemoveAvatar.classList.add('d-none');
}

/* ---------- Show the profile on the page ----------
   textContent only (never innerHTML), same rule as the game cards. */
function renderProfile(p) {
  currentProfile = p;

  // Profile picture on the player card (and any other .badge-avatar outside the form)
  document.querySelectorAll('.badge-avatar:not(#pf-avatar-preview)').forEach(box =>
    setAvatarBox(box, avatarUrl(p)));

  document.querySelectorAll('[data-profile]').forEach(node => {
    const value = p[node.dataset.profile];
    if (value) node.textContent = value;   // empty in DB -> keep the HTML text
  });

  // Bio: an empty line in the text = a new paragraph
  if (p.bio) {
    const paragraphs = p.bio.split(/\n\s*\n/).filter(t => t.trim()).map(text => {
      const para = document.createElement('p');
      para.textContent = text.trim();
      return para;
    });
    document.getElementById('p-bio').replaceChildren(...paragraphs);
  }
}

/** Reads what's on the page now, used to pre-fill the form if the API was down. */
function profileFromPage() {
  const p = {};
  PROFILE_FIELDS.forEach(f => {
    const node = document.querySelector('[data-profile="' + f + '"]');
    if (node) p[f] = node.textContent.trim();
  });
  p.bio = [...document.querySelectorAll('#p-bio p')].map(para => para.textContent.trim()).join('\n\n');
  return p;
}

async function loadProfile() {
  try { renderProfile(await fetchProfile()); }
  catch (e) { /* API unreachable: the text in index.html stays */ }
}

/* ---------- Edit form (modal) ---------- */
function showProfileError(msg) {
  profileError.textContent = msg || '';
  profileError.classList.toggle('d-none', !msg);
}

function openProfileForm() {
  const p = currentProfile || profileFromPage();
  document.getElementById('pf-tagline').value  = p.tagline   || '';
  document.getElementById('pf-location').value = p.location  || '';
  document.getElementById('pf-main').value     = p.mainGenre || '';
  document.getElementById('pf-side').value     = p.sideQuest || '';
  document.getElementById('pf-bio').value      = p.bio       || '';

  // Picture: start from what's saved
  avatarEdit.pending = null;
  avatarEdit.remove = false;
  avatarInput.value = '';
  setAvatarBox(avatarPreview, avatarUrl(currentProfile));
  btnRemoveAvatar.classList.toggle('d-none', !(currentProfile && currentProfile.hasAvatar));

  showProfileError('');
  profileModal.show();
}

async function onSaveProfile(e) {
  e.preventDefault();
  const data = {
    tagline:   document.getElementById('pf-tagline').value.trim(),
    location:  document.getElementById('pf-location').value.trim(),
    mainGenre: document.getElementById('pf-main').value.trim(),
    sideQuest: document.getElementById('pf-side').value.trim(),
    bio:       document.getElementById('pf-bio').value.trim()
  };
  if (avatarEdit.pending) data.avatar = avatarEdit.pending;   // new picture
  else if (avatarEdit.remove) data.removeAvatar = true;      // delete picture
  // neither -> the API keeps the current picture

  btnSaveProfile.disabled = true;
  try {
    renderProfile(await updateProfile(data));
    profileModal.hide();
  } catch (err) {
    if (err.status === 401) {               // admin key wrong or expired
      profileModal.hide();
      if (typeof logout === 'function') logout();
      return;
    }
    showProfileError(err.message || 'Could not save the profile.');
  } finally {
    btnSaveProfile.disabled = false;
  }
}

/* ---------- Admin-only button ----------
   app.js shows/hides #btn-add with "d-none" when you log in/out.
   We copy that state to "Edit profile", so app.js doesn't need changing. */
const btnAddGame = document.getElementById('btn-add');
function syncEditButton() {
  btnEditProfile.classList.toggle('d-none', btnAddGame.classList.contains('d-none'));
}
new MutationObserver(syncEditButton).observe(btnAddGame, { attributes: true, attributeFilter: ['class'] });
syncEditButton();

/* ---------- Start-up ---------- */
btnEditProfile.addEventListener('click', openProfileForm);
avatarInput.addEventListener('change', onPickAvatar);
btnRemoveAvatar.addEventListener('click', onRemoveAvatar);
profileForm.addEventListener('submit', onSaveProfile);
document.getElementById('profileModal').addEventListener('shown.bs.modal', () =>
  document.getElementById('pf-tagline').focus());
loadProfile();
