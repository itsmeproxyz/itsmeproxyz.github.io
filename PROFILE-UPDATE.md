# Editable profile – what's in this zip

Copy these into your repo (same paths), replacing the old ones:

| File | What changed |
|---|---|
| `database/profile.sql` | **New.** Creates `dbo.Profile` (1 row) with your current text |
| `docs/index.html` | `data-profile` tags on tagline / location / genres, bio wrapped in `#p-bio`, "Edit profile" button, `#profileModal`, loads `js/profile.js` |
| `docs/js/profile.js` | **New.** Loads the profile, fills the page, handles the edit modal |

Already done in your repo (not included): `api/server.js` (GET/PUT `/api/profile`) and `docs/js/api.js` (`fetchProfile`, `updateProfile`).
`app.js` does **not** need changes – profile.js copies the admin state from the "+ Add game" button.

## Order
1. SSMS → run `database/profile.sql` on the Azure SQL database.
2. Make sure the API deploy with the new `server.js` finished (Actions tab is green).
   Test: open `<your API>/api/profile` – you should see JSON.
3. Commit `docs/index.html` + `docs/js/profile.js`.
4. My Games → Admin login → My Profile → **Edit profile** → Save → refresh to confirm it stuck.

## Notes
- Bio: leave an empty line between paragraphs. Text is plain (no bold).
- If the API is down, the page shows the text written in index.html.
