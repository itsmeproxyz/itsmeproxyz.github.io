# Profile picture upload – what's in this zip

Copy these into your repo (same paths), replacing the old ones:

| File | What changed |
|---|---|
| `database/profile-avatar.sql` | **New.** Adds `Avatar` + `AvatarUpdatedAt` columns to `dbo.Profile` |
| `api/server.js` | Your current file + avatar support: `GET /api/profile/avatar`, `hasAvatar`/`avatarAt` in `GET /api/profile`, `avatar` / `removeAvatar` in `PUT /api/profile` |
| `docs/index.html` | "Profile picture" picker at the top of the Edit profile modal |
| `docs/js/profile.js` | Crops to a square, shrinks to 256×256 (WebP), uploads, shows it on the player card |

No changes needed in `api.js`, `app.js` or `style.css`.

## Order
1. SSMS → run `database/profile-avatar.sql` on the Azure SQL database.
2. Commit `api/server.js` → wait until the API deploy in the Actions tab is green.
   Test: `<your API>/api/profile` should now show `"hasAvatar": false`.
3. Commit `docs/index.html` + `docs/js/profile.js`.
4. Admin login → My Profile → Edit profile → pick a picture → Save.

## Notes
- No picture = the orange "P" badge, same as before.
- "Remove picture" in the modal deletes it on Save.
- The browser caches the picture for a long time, but a new upload changes `?v=` so it updates right away.
