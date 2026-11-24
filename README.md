# proxyz – Game Profile (full stack)

My personal gaming website: **https://itsmeproxyz.com**

```
Browser ──> docs/ (GitHub Pages) ──fetch──> api/ (Node.js on Azure App Service) ──> Azure SQL (itsmeproxyzDB)
```

GitHub Pages only serves static files, so it can't talk to SQL Server by itself.
The `api/` folder is a small Express server that sits in between and keeps the database password secret.

**Contents**
- [What's in this repo](#whats-in-this-repo)
- [Features](#features)
- [Guidance](#guidance)
  - [1. Build the database from scratch](#1-build-the-database-from-scratch)
  - [2. Run it on your PC (optional)](#2-run-it-on-your-pc-optional)
  - [3. Go public (Azure + GitHub Pages)](#3-go-public-azure--github-pages)
  - [4. Ship an update](#4-ship-an-update)
  - [5. Using the site as admin](#5-using-the-site-as-admin)
  - [6. Troubleshooting](#6-troubleshooting)
- [Update history](#update-history)

---

## What's in this repo

| Path | What it is | Where it runs |
|---|---|---|
| `docs/index.html` | The website: Home, My Profile, My Games + the pop-up forms | GitHub Pages |
| `docs/css/style.css` | The look (black & red theme, animations) on top of Bootstrap 5.3 | GitHub Pages |
| `docs/js/config.js` | `API_BASE` = the API address (the only file to change when the API moves) | GitHub Pages |
| `docs/js/api.js` | Every call to the API (`fetchGames`, `createGame`, `fetchProfile`…) | GitHub Pages |
| `docs/js/art.js` | Canvas drawings: card patterns + the animated Home background | GitHub Pages |
| `docs/js/app.js` | Pages, game cards, admin login, card picture upload, animations | GitHub Pages |
| `docs/js/profile.js` | My Profile: loads/edits the profile text + profile picture | GitHub Pages |
| `docs/CNAME` | Custom domain `itsmeproxyz.com` | GitHub Pages |
| `api/server.js` | REST API (games, pictures, profile, admin check) | Azure App Service |
| `api/package.json` | API dependencies (express, mssql, cors, dotenv) | Azure App Service |
| `api/.env.example` | Template for `api/.env` (local testing only, never commit `.env`) | Your PC |
| `database/schema.sql` | Creates `dbo.Games` + the first 4 games | SSMS |
| `database/azure-create-user.sql` | Creates the limited `proxyz_app` user on Azure SQL | SSMS |
| `database/create-login.sql` | Same idea for a **local** SQL Server Express (not used on Azure) | SSMS, local |
| `database/add-images.sql` | Adds the game picture columns to `dbo.Games` | SSMS |
| `database/add-link.sql` | Adds the official website column to `dbo.Games` | SSMS |
| `database/profile.sql` | Creates `dbo.Profile` (1 row) with the profile text | SSMS |
| `database/profile-avatar.sql` | Adds the profile picture columns to `dbo.Profile` | SSMS |
| `database/manage-games.sql` | Handy queries to view/add/edit/delete games by hand | SSMS |
| `.github/workflows/main_proxyz-api.yml` | Auto-deploys `api/` to Azure when `api/**` changes | GitHub Actions |

## Features

- **Three pages in one file** (Home, My Profile, My Games), switched by the URL hash (`#home`, `#profile`, `#games`).
- **Game library from the database** – cards with genre, developer, year, description, a color and a pattern.
- **Card pictures** – upload a JPG/PNG/WebP; the browser shrinks it (max 960×600, WebP) before saving. No picture = the pattern art.
- **Official website links** – give a game a link and its whole card opens that site in a new tab. Only `http`/`https` addresses are accepted.
- **Editable profile** – tagline, location, main genre, side quest and biography, saved in `dbo.Profile`.
- **Profile picture** – cropped to a square and shrunk to 256×256 in the browser. No picture = the red "P" badge.
- **Admin mode** – one secret key (`ADMIN_KEY`), no visitor accounts. Visitors can only read.
- **Black & red theme with animations** – animated Home background (moving stripes, glow, embers), glitch title, "LIVE" dot, page transitions, reveal on scroll, 3D card tilt, loading skeletons. Everything turns off for visitors whose system asks for reduced motion.
- **Fallbacks** – if the API is down, My Games shows a saved list and My Profile shows the text written in `index.html`.

### API routes

| Method | Route | Who |
|---|---|---|
| GET | `/api/health` | anyone – `{"ok":true}` if the API runs |
| GET | `/api/games` | anyone – list (with `hasImage` / `imageAt`, not the picture itself) |
| GET | `/api/games/:id/image?v=…` | anyone – the game picture as an image file |
| POST | `/api/games` | admin – add (optional `image`) |
| PUT | `/api/games/:id` | admin – edit (`image` = new picture, `removeImage: true` = delete it) |
| DELETE | `/api/games/:id` | admin – delete |
| GET | `/api/profile` | anyone – profile text (+ `hasAvatar` / `avatarAt`) |
| GET | `/api/profile/avatar?v=…` | anyone – the profile picture as an image file |
| PUT | `/api/profile` | admin – edit (`avatar` = new picture, `removeAvatar: true` = delete it) |
| GET | `/api/admin/check` | admin – is my key right? |

Admin routes need the header `x-admin-key: <ADMIN_KEY>`.

---

## Guidance

### The live setup (for reference)

| Piece | Value |
|---|---|
| Website | `https://itsmeproxyz.com` (GitHub Pages, branch `main`, folder `/docs`) |
| API | `https://proxyz-api-gjdhb7chdzcza0ft.eastasia-01.azurewebsites.net` (App Service `proxyz-api`, Free F1, Linux, Node 24, East Asia) |
| Database | Azure SQL server `proxyz.database.windows.net`, database `itsmeproxyzDB` |
| DB users | `proxyzdb` = admin (SSMS only) · `proxyz_app` = limited user for the API (read/write data, can't change tables) |
| Resource group | `proxyz-rg` |

> **Never** put real passwords or the `ADMIN_KEY` in this repo, in chats or in screenshots.

### 1. Build the database from scratch

Connect SSMS to `proxyz.database.windows.net` as **`proxyzdb`**. For every script:
right-click **itsmeproxyzDB → New Query** (the toolbar dropdown must **not** say `master`).
Azure SQL doesn't allow `USE`, so delete any `USE proxyz;` + `GO` lines at the top of a script first.

Run in this order:

1. `database/schema.sql` – creates `dbo.Games` + the first 4 games
2. `database/azure-create-user.sql` – creates `proxyz_app` (**change the password on line 19 first**)
3. `database/add-images.sql` – game picture columns
4. `database/add-link.sql` – official website column (skipped automatically if `schema.sql` already made it)
5. `database/profile.sql` – creates `dbo.Profile` with the profile text
6. `database/profile-avatar.sql` – profile picture columns

Then in the Azure portal → SQL server **proxyz → Security → Networking**:
- tick **Allow Azure services and resources to access this server** (so the API can connect)
- add your PC's IP with **+ Add your client IPv4 address** (so SSMS can connect)

### 2. Run it on your PC (optional)

```bash
cd api
npm install
cp .env.example .env      # then fill in your values (use the Azure block for Azure SQL)
npm start                 # http://localhost:3000/api/health
```

Then open `docs/index.html` with VS Code **Live Server** (port 5500) and, while testing,
switch the two lines in `docs/js/config.js` so `API_BASE` is `http://localhost:3000`.
Switch it back before you push.

### 3. Go public (Azure + GitHub Pages)

**API on Azure App Service**
1. Create a **Web App**: Publish *Code*, Runtime *Node LTS*, OS *Linux*, pricing **Free F1**. If a region says "quota 0", pick another region.
2. **Settings → Environment variables → App settings**, add:

   | Name | Value |
   |---|---|
   | `DB_SERVER` | `proxyz.database.windows.net` |
   | `DB_PORT` | `1433` |
   | `DB_NAME` | `itsmeproxyzDB` |
   | `DB_USER` | `proxyz_app` |
   | `DB_PASSWORD` | the `proxyz_app` password |
   | `DB_ENCRYPT` | `true` |
   | `DB_TRUST_CERT` | `false` |
   | `ADMIN_KEY` | your admin key (long and random) |
   | `FRONTEND_ORIGIN` | `https://itsmeproxyz.github.io,https://itsmeproxyz.com` (no slash at the end) |

   Don't add `PORT` (Azure sets it). Leave "deployment slot setting" unchecked. **Click Apply → Confirm.**
3. **Deployment → Deployment Center**: Source GitHub → this repo, branch `main` → *User-assigned identity* → Save.
   This creates `.github/workflows/main_proxyz-api.yml`. It must contain:
   - `paths: ['api/**', '.github/workflows/main_proxyz-api.yml']` under `on.push`
   - `defaults.run.working-directory: api` in the build job
   - `path: api` in the "Upload artifact" step
4. Test `<API>/api/health` → `{"ok":true}` and `<API>/api/games` → the list.

**Website on GitHub Pages**
1. `docs/js/config.js` → `API_BASE` = the API URL (no slash at the end).
2. Repo **Settings → Pages** → *Deploy from a branch* → `main` + `/docs` → Save.
3. Custom domain `itsmeproxyz.com` → Save → keep **Enforce HTTPS** on (this writes `docs/CNAME`).

### 4. Ship an update

The golden rule: **database first, then API, then website.**

1. **SQL changes** (new columns/tables): run the new script in SSMS as `proxyzdb` on itsmeproxyzDB.
   The new API code expects those columns – pushing the API first breaks `/api/games`.
2. **API changes** (`api/**`): commit → **Actions** tab → wait for a green ✅ on *build* and *deploy* (2–3 min).
3. **Website changes** (`docs/**`): commit → GitHub Pages rebuilds by itself (~1 min).
4. Open the site and press **Ctrl + F5** (hard refresh).

Uploading through the GitHub website: repo main page → **Add file → Upload files** → drag the **folders**
(`api`, `docs`, `database`), not single files, so every file lands on the right path and replaces the old one.

### 5. Using the site as admin

- **My Games → Admin login** → type your `ADMIN_KEY`. The key is kept only while the tab is open.
- **+ Add game / Edit / Delete** appear. Delete asks "Sure?" – click again to confirm.
- **Card picture**: in the Add/Edit form choose a JPG/PNG/WebP. **Remove picture** goes back to the pattern.
- **Official website**: in the Add/Edit form type the game's address. Visitors open it by clicking the card; empty = not clickable.
- **My Profile → Edit profile** (only while logged in): text, biography (empty line = new paragraph) and profile picture.
- Forgot the key? App Service → Environment variables → change `ADMIN_KEY` → **Apply**. Nothing in the database is lost.

### 6. Troubleshooting

| Problem | Fix |
|---|---|
| `/api/games` → `{"error":"Could not load games"}` | `DB_PASSWORD` in App Service doesn't match the `proxyz_app` password, or you forgot **Apply**. Test the login in SSMS (below). |
| Can't log in to SSMS as `proxyz_app` | Options → Connection Properties → **Connect to database: `itsmeproxyzDB`** (it's a contained user, it doesn't exist in `master`). |
| SSMS can't connect at all | Your home IP changed → SQL server Networking → **+ Add your client IPv4 address** → Save. Use the public IP Azure shows, not `192.168.x.x` from `ipconfig`. |
| Site shows "The live library is unavailable" | API asleep (Free F1 + auto-paused DB can take up to ~60 s on first load), API down, or the domain is missing from `FRONTEND_ORIGIN` (CORS). |
| `Cannot GET /api/...` | The API code isn't deployed yet – check the **Actions** tab. |
| Avast says "Threat secured … URL:Blacklist" for `*.azurewebsites.net` | False positive on new Azure URLs. Add an exception in the Avast app (also for the `…scm…` address if you need Log stream); the Avast browser extension can block it too. |
| Deployment Center: "role assignment already exists" | Pick the **existing** identity in the Identity dropdown instead of "(New)". |
| Create Web App: "quota … F1 … 0" | That region has no free quota for you – choose another region. |
| "Password validation failed" in SSMS | Azure needs 8+ characters from 3 of: upper, lower, digits, symbols, and not containing the user name. Avoid `'` in passwords. |

---

## Update history

| Update | What changed | SQL to run first |
|---|---|---|
| **v1 – Full stack** | Website talks to the API, games stored in Azure SQL, admin login | `schema.sql`, `azure-create-user.sql` |
| **v2 – Card pictures + animations** | Picture upload for game cards, animated hero, glitch title, card tilt, skeletons, reveal on scroll | `add-images.sql` |
| **v3 – Editable profile** | `dbo.Profile`, `GET/PUT /api/profile`, `profile.js`, Edit profile pop-up, `data-profile` tags in `index.html` | `profile.sql` |
| **v4 – Profile picture** | `GET /api/profile/avatar`, avatar upload (square 256×256) in Edit profile | `profile-avatar.sql` |
| **v5 – Black & red theme + docs** | Orange/teal theme replaced by black & red (CSS variables, canvas art, glitch, LIVE dot); all docs merged into this README | none |
| **v6 – Official website links** | `Link` column, Official website field in the Add/Edit form, clickable game cards | `add-link.sql` |
