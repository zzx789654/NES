#!/bin/bash
# SecVision deployment flow static validator.
# This script does not modify the host. It checks project structure, shell syntax,
# critical deployment wiring, and Python syntax for backend entry points.
set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO_DIR"

fail() { echo "❌ $*"; exit 1; }
pass() { echo "✅ $*"; }

[[ -f deploy/install.sh ]] || fail "missing deploy/install.sh"
[[ -f deploy/secvision.service ]] || fail "missing deploy/secvision.service"
[[ -f deploy/smoke-test.sh ]] || fail "missing deploy/smoke-test.sh"
[[ -f deploy/create-admin.sh ]] || fail "missing deploy/create-admin.sh"
[[ -f backend/main.py ]] || fail "missing backend/main.py"
[[ -f backend/requirements.txt ]] || fail "missing backend/requirements.txt"
[[ -f index.html && -f app.jsx && -f api-client.js ]] || fail "missing frontend entry files"
pass "project structure"

bash -n deploy/install.sh
bash -n deploy/smoke-test.sh
bash -n deploy/create-admin.sh
if [[ -f deploy/redeploy-backend.sh ]]; then bash -n deploy/redeploy-backend.sh; fi
pass "shell syntax"

grep -q "wait_for_backend" deploy/install.sh || fail "install.sh must wait for backend health"
grep -q "print_backend_diagnostics" deploy/install.sh || fail "install.sh must print diagnostics on backend failure"
grep -q "smoke-test.sh" deploy/install.sh || fail "install.sh must call smoke-test.sh"
grep -q "alembic upgrade head" deploy/install.sh || fail "install.sh must run alembic upgrade head"
grep -q "EnvironmentFile=-/opt/secvision/backend/.env" deploy/secvision.service || fail "service must load backend .env"
grep -q "/opt/secvision/venv/bin/python -m uvicorn" deploy/secvision.service || fail "service must start uvicorn through venv python"
grep -q -- "--host 127.0.0.1 --port 8000" deploy/secvision.service || fail "service must bind local backend port"
grep -q "proxy_pass http://127.0.0.1:8000;" deploy/nginx.conf || fail "nginx must proxy API to local backend"
grep -q "wait_for_health" deploy/smoke-test.sh || fail "smoke-test must wait for health"
pass "deployment wiring"

python3 -m py_compile   backend/main.py   backend/database.py   backend/routers/auth.py   backend/routers/scans.py   backend/routers/nist.py   backend/routers/ipgroups.py   backend/routers/dashboard.py   backend/routers/report.py   backend/schemas/auth.py   backend/schemas/scan.py   backend/services/nessus_parser.py
pass "python syntax"

echo "✅ Deployment flow static validation passed"
