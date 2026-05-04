# SecVision — ISMS Security Portal

A full-stack vulnerability management platform for enterprise security teams. Upload Nessus CSV scans and NVD CVE JSON, track vulnerability trends over time, compare scan diffs, and monitor NIST audit compliance — all in one dark-themed web UI backed by a FastAPI/SQLAlchemy REST API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser (React 18 UMD + Babel standalone)              │
│  index.html → api-client.js → pages/  → components.jsx  │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTPS / JWT Bearer
┌───────────────────▼─────────────────────────────────────┐
│  Nginx  (port 80/443)                                    │
│  · Serves static frontend files                         │
│  · Reverse-proxies /api/ → 127.0.0.1:8000               │
│  · /api/scans/upload: 300 s timeout, 50 MB body         │
└───────────────────┬─────────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────────┐
│  FastAPI  (uvicorn, port 8000)                           │
│  · SecurityHeadersMiddleware (CSP, X-Frame, …)          │
│  · AuditLogMiddleware (JSON structured logs)            │
│  · SlowAPI rate limiting (login 10/min, upload 5/min)   │
│  · JWT RBAC: admin / analyst / viewer                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Routers                                         │   │
│  │  /api/auth      — login, register, change-pw     │   │
│  │  /api/scans     — upload, list, detail, diff,    │   │
│  │                   host history, delete           │   │
│  │  /api/nist      — audit upload, diff, trend      │   │
│  │  /api/ipgroups  — IP group CRUD                  │   │
│  │  /api/dashboard — aggregated KPI stats           │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services                                        │   │
│  │  nessus_parser  — vectorised pandas CSV parse    │   │
│  │  cve_parser     — NVD JSON parse                 │   │
│  │  audit_parser   — NIST audit CSV parse           │   │
│  │  epss_service   — async batch FIRST.org queries  │   │
│  │  diff_service   — O(n) scan comparison           │   │
│  └──────────────────────────────────────────────────┘   │
└───────────────────┬─────────────────────────────────────┘
                    │ SQLAlchemy 2.0 ORM
┌───────────────────▼─────────────────────────────────────┐
│  Database: SQLite (dev) / PostgreSQL 16 (production)    │
│  Tables: scans, vulnerabilities, audit_scans,           │
│          audit_results, ip_groups, users                │
│  Migrations: Alembic (auto-applied on startup)          │
└─────────────────────────────────────────────────────────┘
```

### Frontend pages

| Page | File | Description |
|------|------|-------------|
| Login | `pages/Login.jsx` | JWT auth, session storage |
| Dashboard | `pages/Dashboard.jsx` | KPI cards, risk summary, quick actions |
| Vulnerability Scan | `pages/VulnScan.jsx` | Upload, filter, diff, EPSS/VPR matrix, host history |
| NIST Audit | `pages/NIST.jsx` | Audit results, compliance trend |
| User Management | `pages/UserManagement.jsx` | Admin: create/delete users, assign roles |

---

## Quick Start (Development)

### Prerequisites

- Python 3.11+
- Node.js not required (React loaded from CDN)

### 1 — Clone and set up backend

```bash
git clone <repo-url>
cd NES/backend

python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2 — Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set SECRET_KEY to a random string
```

`.env` variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///./secvision.db` | SQLite (dev) or `postgresql://user:pass@host/db` |
| `SECRET_KEY` | *(insecure default)* | JWT signing key — **must change in production** |
| `ALLOWED_ORIGINS` | `*` | CORS origins, e.g. `https://yourdomain.com` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | JWT lifetime (8 hours) |

### 3 — Start backend

```bash
cd backend
uvicorn main:app --reload --port 8000
# Alembic migrations run automatically on first start
```

### 4 — Create first admin account

```bash
bash deploy/create-admin.sh
# or manually:
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@1234","role":"admin"}'
```

### 5 — Serve the frontend

```bash
cd NES
python3 -m http.server 8080
# Open http://localhost:8080
```

---

## Production Deployment (Ubuntu 22.04 / 24.04)

```bash
sudo bash deploy/install.sh
```

The script:
1. Installs Python 3.11, Nginx, (optionally PostgreSQL)
2. Creates a `secvision` system user
3. Installs Python dependencies into `/opt/secvision/venv`
4. Generates a random `SECRET_KEY` in `/opt/secvision/.env`
5. Copies `deploy/nginx.conf` to `/etc/nginx/sites-enabled/`
6. Enables and starts the `secvision.service` systemd unit
7. Runs `deploy/smoke-test.sh` to verify the API is up

After install, set your domain in `/etc/nginx/sites-enabled/secvision.conf` and reload Nginx.

---

## API Reference

Interactive docs: `http://localhost:8000/docs` (Swagger UI)

### Authentication

```
POST /api/auth/token           # Login → JWT
POST /api/auth/register        # Create user (admin only)
GET  /api/auth/me              # Current user info
POST /api/auth/change-password
```

### Vulnerability Scans

```
GET    /api/scans                           # List all scans (paginated)
POST   /api/scans/upload                    # Upload Nessus CSV or NVD JSON
GET    /api/scans/{id}                      # Scan summary + slim vuln list
GET    /api/scans/{id}/vulns/{vuln_id}      # Full vulnerability detail
GET    /api/scans/diff?base={id}&comp={id}  # Compare two scans
GET    /api/scans/hosts/{ip}/history        # Per-host vulnerability history
DELETE /api/scans/{id}                      # Delete scan (admin/analyst)
```

### NIST Audit

```
GET    /api/nist/scans              # List audit scans
POST   /api/nist/upload             # Upload audit CSV
GET    /api/nist/scans/{id}         # Audit detail
GET    /api/nist/diff?base=&comp=   # Compare two audits
GET    /api/nist/trend              # Pass-rate trend over time
DELETE /api/nist/scans/{id}
```

### Other

```
GET    /api/dashboard        # Aggregated KPIs
GET    /api/ipgroups         # List IP groups
POST   /api/ipgroups         # Create IP group
PUT    /api/ipgroups/{id}
DELETE /api/ipgroups/{id}
```

---

## File Upload Formats

### Nessus CSV

Standard Nessus export. Supports all 31 columns including CVSS v2/v3/v4, EPSS, VPR, exploit flags (Metasploit, Core Impact, CANVAS), and plugin metadata. Column name aliases are resolved automatically.

### NVD CVE JSON (NVD API 2.0)

```json
{
  "vulnerabilities": [
    {
      "cve": {
        "id": "CVE-2024-XXXX",
        "descriptions": [{"lang": "en", "value": "..."}],
        "metrics": {
          "cvssMetricV31": [{"cvssData": {"baseScore": 9.8}}]
        }
      }
    }
  ]
}
```

Sample file: `samples/cve-upload-sample.json`

---

## Security Controls

| Control | Implementation |
|---------|----------------|
| Authentication | JWT HS256, 8-hour expiry, Bearer token |
| Authorization | RBAC: `admin` / `analyst` / `viewer` |
| Password policy | Min 8 chars, uppercase + digit + special char |
| Rate limiting | Login: 10 req/min/IP · Upload: 5 req/min/IP |
| Security headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Audit log | JSON-structured request log (method, path, IP, status, duration) |
| Upload safety | 50 MB max, magic-byte content validation |
| CORS | Configurable via `ALLOWED_ORIGINS`; `*` by default for dev |

**Production checklist:**
- Set `SECRET_KEY` to a cryptographically random value
- Set `DATABASE_URL` to a PostgreSQL connection string
- Set `ALLOWED_ORIGINS` to your domain(s)
- Enable HTTPS in Nginx (certbot / Let's Encrypt)

---

## Running Tests

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

**91 tests, 100% pass rate.**

| Suite | Tests | Coverage area |
|-------|-------|---------------|
| `test_auth.py` | 14 | JWT login, registration, password change, RBAC |
| `test_dashboard.py` | 4 | KPI aggregation |
| `test_ipgroups.py` | 11 | IP group CRUD, rename conflict detection |
| `test_nessus_fields.py` | 15 | All 31 Nessus fields, type coercion, edge cases |
| `test_nist.py` | 14 | Audit upload, diff, trend |
| `test_scans.py` | 16 | Scan upload, detail, diff, host history |
| `test_services.py` | 17 | Parser logic, diff algorithm |

---

## Project Structure

```
NES/
├── index.html                  # App entry point (React CDN, CSS variables, dark theme)
├── api-client.js               # Unified fetch wrapper with JWT Bearer auth
├── app.jsx                     # Shell: routing, auth state, sidebar navigation
├── components.jsx              # Shared UI: Card, DataTable (virtual scroll), Btn, …
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── VulnScan.jsx            # Scan list, filters, diff, EPSS/VPR matrix, host history
│   ├── NIST.jsx
│   └── UserManagement.jsx
├── samples/
│   └── cve-upload-sample.json
├── backend/
│   ├── main.py                 # FastAPI app, middleware, lifespan (auto-migrations)
│   ├── config.py               # pydantic-settings (.env support)
│   ├── database.py             # SQLAlchemy engine (SQLite WAL tuning / PG pool)
│   ├── limiter.py              # slowapi Limiter singleton
│   ├── models/                 # ORM: Scan, Vulnerability, AuditScan, IPGroup, User
│   ├── routers/                # auth, scans, nist, ipgroups, dashboard
│   ├── schemas/                # Pydantic v2 request/response models
│   ├── services/               # nessus_parser, cve_parser, audit_parser, epss_service, diff_service
│   ├── alembic/                # DB migrations 0001–0003
│   ├── tests/                  # pytest suite (91 tests)
│   └── requirements.txt
└── deploy/
    ├── install.sh              # Ubuntu one-click install
    ├── nginx.conf              # Reverse-proxy, security headers, rate limiting
    ├── secvision.service       # systemd unit
    ├── create-admin.sh         # First admin account helper
    ├── redeploy-backend.sh     # Zero-downtime backend redeploy
    └── smoke-test.sh           # Post-deploy API health check
```

---

## User Roles

| Role | Upload | Delete scans | Manage users | View |
|------|:------:|:------------:|:------------:|:----:|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `analyst` | ✅ | ✅ | ❌ | ✅ |
| `viewer` | ❌ | ❌ | ❌ | ✅ |

---

## Version

**v2.1.0** — 2026-05-04
