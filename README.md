# proxyz – Game Profile (full stack)

```
Browser ──> docs/ (GitHub Pages, public) ──fetch──> api/ (Node.js on a host) ──> SQL Server / Azure SQL
```

GitHub Pages only serves static files, so it can't connect to SQL Server by itself.
The `api/` folder is a small Express server that sits in between and keeps your DB password secret.

## Folders

| Folder | What it is | Where it runs |
|---|---|---|
| `database/create-login.sql` | Creates the `proxyz` database + `proxyz_app` login | SSMS (run first) |
| `database/schema.sql` | Creates the `dbo.Games` table + your 4 games | SSMS (run second) |
| `database/manage-games.sql` | Ready-made queries to view/add/edit/delete games | SSMS |
| `database/azure-create-user.sql` | Creates the `proxyz_app` user on Azure SQL (use instead of create-login.sql) | SSMS, on Azure |
| `api/` | REST API (`GET/POST/PUT/DELETE /api/games`) | Render, Railway, Azure App Service… (or your PC for testing) |
| `docs/` | The website (Bootstrap 5): `index.html`, `css/style.css`, `js/config.js`, `js/api.js`, `js/art.js`, `js/app.js` | GitHub Pages |

## 1. Database
Full local walkthrough (SQL Server Express + SSMS): see the "proxyz Local Setup Guide" doc.
1. In SSMS run `database/create-login.sql` (change the password first), then `database/schema.sql`.
2. Azure SQL only: in the server's **Networking** settings, allow your PC's IP and your API host.

## 2. Run the API locally
```bash
cd api
npm install
cp .env.example .env      # then fill in your values
npm start                 # http://localhost:3000/api/games
```
`.env.example` is already set for a local SQL Server Express on port 1433.

## 3. Run the frontend locally
Open `docs/index.html` with VS Code **Live Server** (port 5500). The API address lives in `docs/js/config.js` (`http://localhost:3000` by default).

## 4. Go public
Step-by-step Azure version (Azure SQL free + App Service F1): see section 6 of the "proxyz Local Setup Guide" doc.

1. Push this repo to GitHub (`.env` is ignored, never commit it).
2. Deploy `api/` to a Node host. Root directory `api`, build `npm install`, start `npm start`, and add the same variables from `.env` in the host's **Environment** settings.
3. In `docs/js/config.js`, set `API_BASE` to your API URL (e.g. `https://proxyz-api.onrender.com`) and push.
4. GitHub → repo **Settings → Pages** → Source: *Deploy from a branch* → branch `main`, folder `/docs`.
5. Make sure `FRONTEND_ORIGIN` in the API includes your Pages URL, e.g. `https://itsmeproxyz.github.io`.

## Admin
On **My Games**, click **Admin login** and enter your `ADMIN_KEY`. Visitors can only read.
