# Deploying the AAA Portal to Vercel (auto-deploy on every push)

The repo runs in **two modes from the same code**:

- **Docker / self-hosted** (unchanged) — `docker compose up --build`, uses the
  bundled Postgres + MinIO. This is what runs on the VM today.
- **Vercel** — the React frontend is served as a static site, the Express API
  runs as a serverless function (`api/index.js`), and it talks to a **managed
  Postgres** + **Vercel Blob** for storage.

Once the GitHub repo is imported into Vercel, **every `git push` to `main`
auto-deploys** — that's Vercel's Git integration, nothing extra to run.

---

## What only you can do (needs your Vercel account)

I can't log into Vercel or provision cloud resources for you. These are the
one-time dashboard steps:

### 1. Import the repo
1. Go to https://vercel.com/new
2. Import **`aegryd-spec/AAA-Portal`** (connect GitHub if prompted).
3. Framework preset: **Other** (the included `vercel.json` already sets the
   build command `cd frontend && npm install && npm run build`, output
   `frontend/dist`, and the `/api/*` routing). Click **Deploy** — the first
   deploy will succeed for the UI even before the DB/storage exist.

### 2. Add a managed Postgres
In the project → **Storage** → create a **Postgres** store (Vercel's Neon
integration; free tier is fine). Vercel injects `DATABASE_URL` (and related
vars) into the project automatically. `backend/src/config/db.js` picks up
`DATABASE_URL` and connects over SSL.

### 3. Add Blob storage (for evidence uploads)
In **Storage** → create a **Blob** store. Vercel injects
`BLOB_READ_WRITE_TOKEN`. `backend/src/config/storage.js` switches to Blob
automatically when that token is present.
> Note: on Vercel, evidence files are capped at **4 MB** (serverless request-body
> limit). Larger files require the Docker/self-hosted deployment.

### 4. Set the JWT secret
Project → **Settings → Environment Variables** → add:
```
JWT_SECRET = <a long random string>
```
(Generate one, e.g. `openssl rand -hex 32`.)

### 5. Initialise the database (one time)
The managed Postgres starts empty. From your machine, with the connection
string Vercel gave you:
```bash
git clone https://github.com/aegryd-spec/AAA-Portal.git
cd AAA-Portal
npm install
DATABASE_URL="postgres://...sslmode=require" npm run db:init
```
This loads the schema, seed data (demo users, criteria), and both migrations.
Demo login after that: `admin@rru.ac.in` / `Passw0rd!`.

### 6. Redeploy
Trigger a redeploy (Vercel → Deployments → ⋯ → Redeploy, or just push a commit)
so the API picks up the new env vars. Done — the site is live and every future
push auto-deploys.

---

## Environment variables summary

| Variable | Source | Used for |
|---|---|---|
| `DATABASE_URL` | Vercel Postgres/Neon (auto) | DB connection (SSL) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob (auto) | Evidence storage |
| `JWT_SECRET` | you set it | Auth token signing |

If neither `BLOB_READ_WRITE_TOKEN` nor MinIO vars are present, the whole portal
still works except evidence upload/download.

---

## Security reminder

The repo's `docker-compose.yml` contains **prototype default credentials**
(Postgres password, MinIO keys, and a placeholder `JWT_SECRET`). Those defaults
are only for the local Docker stack. **Do not reuse them in any hosted
deployment** — set a real `JWT_SECRET` on Vercel (step 4) and rotate the Docker
defaults before exposing that stack publicly.
