# RRU Academic & Administrative Audit (AAA) Portal — Prototype

A self-hosted web portal for running the RRU IQAC Academic & Administrative
Audit, modelled directly on the uploaded University Manual (Criteria → Key
Indicators → Metrics), the Benchmarks scoring bands, and the SOP documentation
requirements.

The whole stack runs on **your own server** via Docker — no external hosting
platform, no third-party cloud storage.

---

## 1. What's inside

```
rru-aaa-portal/
├── docker-compose.yml      # One command brings up the whole stack
├── db/
│   ├── 01_schema.sql       # Tables (auto-loaded on first DB boot)
│   └── 02_seed.sql         # 7 Criteria, 34 KIs, sample metrics, demo users
├── backend/                # Node/Express REST API
│   ├── Dockerfile
│   └── src/…
└── frontend/               # React (Vite) single-page app, served by nginx
    ├── Dockerfile
    ├── nginx.conf          # Serves the app + proxies /api to the backend
    └── src/…
```

### The four services

| Service    | Image                | Purpose                                    | Port (host) |
|------------|----------------------|--------------------------------------------|-------------|
| `postgres` | postgres:16-alpine   | Relational data                            | 5432        |
| `minio`    | minio/minio          | Self-hosted S3-compatible evidence storage | 9000 / 9001 |
| `backend`  | (built from source)  | REST API + auth + RBAC                      | 4000        |
| `frontend` | (built from source)  | Web UI (nginx)                             | 8080        |

---

## 2. Running it (self-hosted)

**Prerequisite:** Docker + Docker Compose on your server. Nothing else.

```bash
cd rru-aaa-portal
docker compose up --build
```

On first boot Postgres automatically runs everything in `db/` (`01_schema.sql`
then `02_seed.sql`), and the backend auto-creates the MinIO evidence bucket.

Then open:

- **Portal:**        http://YOUR_SERVER:8080
- **API health:**    http://YOUR_SERVER:4000/api/health
- **MinIO console:** http://YOUR_SERVER:9001  (login `aaa_minio_admin` / `aaa_minio_password`)

To stop: `docker compose down`. To wipe all data and start fresh:
`docker compose down -v` (the `-v` removes the Postgres and MinIO volumes).

---

## 3. Demo accounts

All passwords are `Passw0rd!`.

| Email                     | Role                | Scope                         |
|---------------------------|---------------------|-------------------------------|
| admin@rru.ac.in           | Super Admin         | Everything                    |
| iqac@rru.ac.in            | RRU IQAC            | All schools; runs DVV         |
| saset.coord@rru.ac.in     | School Coordinator  | SASET only; submits data      |
| saset.faculty@rru.ac.in   | Faculty / Data Entry| SASET only; enters data       |
| peer@rru.ac.in            | Peer Team           | Reviews & finalizes           |
| registrar@rru.ac.in       | Leadership / Viewer | Read-only dashboards          |

> **The role set is a placeholder.** Your message mentioned sharing a specific
> list of roles, but it didn't come through. These six were inferred from the
> documents. To change them, edit the `roles` table seed in `db/02_seed.sql`
> (and the label maps in `frontend/src/components/Shell.jsx` /
> `StatusStamp.jsx`). Roles are a lookup table, not a hard-coded enum, so adding
> or renaming one needs no schema migration.

---

## 4. The audit workflow

Each **submission** (one School's response to one Metric in one Audit Cycle)
moves through a status pipeline. Who can trigger each step is enforced on the
server (`backend/src/routes/submissions.js`) and mirrored in the UI:

```
 draft ──submit──▶ submitted ──▶ dvv_review ──▶ dvv_verified ──▶ peer_review ──▶ finalized
   ▲                   │              │
   │                   ▼              ▼
   └──clarification_requested◀────────┘   (IQAC can bounce back for clarification)
```

- **School Coordinator / Faculty** — create drafts, attach evidence, submit,
  and resubmit after clarification. Locked to their own school.
- **RRU IQAC** — run DVV: review, request clarifications, verify a score, and
  advance to peer review. Cross-school.
- **Peer Team** — assign the final score at the peer-review stage.
- **Viewer** — read-only dashboards.

Every transition is written to an append-only `audit_log` table.

---

## 5. How the documents map to the schema

| Document                    | Where it lives                                              |
|-----------------------------|------------------------------------------------------------|
| University Manual (Table 2) | `criteria` + `key_indicators` (codes, titles, weightages)  |
| Benchmarks (0–4 bands)      | `metric_benchmarks` (band + description per metric)         |
| SOP (docs / instructions)   | `metrics.documents_required`, `.instructions`, `.not_to_be_included` |

The seed includes **all 7 Criteria and all 34 Key Indicators** with their exact
weightages (verified to sum to the criterion maxima: 150/200/250/100/100/100/100
= 1000). Metrics are seeded as **representative samples** (a few per KI) to prove
the model end-to-end.

### Loading the full metric set

The full NAAC/RRU metric list is large. Two ways to extend beyond the samples:

1. **Via the API / Admin UI** — `POST /api/criteria/metrics` (Super Admin/IQAC)
   creates a metric under a Key Indicator.
2. **Bulk** — add more `INSERT` rows to `db/02_seed.sql` following the existing
   pattern (each metric references its KI by `code`, e.g. `'2.4'`), or write a
   small CSV importer. Benchmark bands go into `metric_benchmarks`.

---

## 6. Security notes before going live

This is a **prototype**. Before any real deployment:

- Change every default credential in `docker-compose.yml`: the Postgres password,
  the `JWT_SECRET` (use a long random string), and the MinIO keys.
- Put the frontend behind HTTPS (e.g. a reverse proxy such as Caddy or nginx with
  Let's Encrypt on your server).
- Don't expose Postgres (5432) or MinIO (9000/9001) to the public internet —
  only the frontend (8080, or 443 behind TLS) needs to be reachable.
- Review evidence file-size limits (`backend/src/routes/evidence.js`, currently
  25 MB/file) and the nginx `client_max_body_size` (currently 30 MB).

---

## 7. Scalability

- **Database** — the backend uses a Postgres connection pool (`DB_POOL_MAX`,
  default 20). Indexes are defined on the hot query paths (submissions by
  school+cycle and by status, evidence by submission, audit log by entity).
- **Storage** — evidence is object storage (MinIO), so files never bloat the
  database and downloads use time-limited pre-signed URLs served straight from
  MinIO, not proxied through the API. Point the same client at a MinIO cluster
  (or real S3) by changing env vars only — no code change.
- **Stateless API** — the backend holds no session state (JWT-based), so you can
  run multiple `backend` replicas behind a load balancer.
- **Frontend** — static assets served by nginx; trivially cacheable/CDN-able if
  ever needed.

---

## 8. Running the pieces individually (for development)

```bash
# Backend (needs a reachable Postgres + MinIO; set env vars accordingly)
cd backend && npm install && npm run dev

# Frontend (proxies /api to http://localhost:4000 by default)
cd frontend && npm install && npm run dev
```
