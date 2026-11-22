/* =====================================================================
   profile.js — the "My Profile" data (tagline, location, genres, bio)
   Loads it from the API and lets the admin edit it in #profileModal.

   GET /api/profile -> anyone
   PUT /api/profile -> admin only (uses the same admin key as the games)

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

// The last profile we got from the API (null = not loaded / API down)
let currentProfile = null;

/* ---------- Show the profile on the page ----------
   textContent only (never innerHTML), same rule as the game cards. */
function renderProfile(p) {
  currentProfile = p;

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
profileForm.addEventListener('submit', onSaveProfile);
document.getElementById('profileModal').addEventListener('shown.bs.modal', () =>
  document.getElementById('pf-tagline').focus());
loadProfile();
