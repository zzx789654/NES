#!/bin/bash
# SecVision 部署後快速驗證：健康檢查、登入、核心 API
set -euo pipefail

BASE_URL=${1:-http://127.0.0.1:8000}
ADMIN_USER=${2:-admin}
ADMIN_PASS=${3:-}

if [[ -z "$ADMIN_PASS" ]]; then
  echo "用法: bash deploy/smoke-test.sh [BASE_URL] [ADMIN_USER] [ADMIN_PASS]"
  echo "範例: bash deploy/smoke-test.sh http://127.0.0.1:8000 admin 'Admin@123456'"
  exit 1
fi

echo "==> Health check"
curl -fsS "$BASE_URL/health" >/dev/null

echo "==> Login"
TOKEN=$(curl -fsS -X POST "$BASE_URL/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "username=${ADMIN_USER}" \
  --data-urlencode "password=${ADMIN_PASS}" | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

AUTH_HEADER="Authorization: Bearer ${TOKEN}"

echo "==> Dashboard"
curl -fsS "$BASE_URL/api/dashboard" -H "$AUTH_HEADER" >/dev/null

echo "==> Scans list"
curl -fsS "$BASE_URL/api/scans" -H "$AUTH_HEADER" >/dev/null

echo "==> NIST scans list"
curl -fsS "$BASE_URL/api/nist/scans" -H "$AUTH_HEADER" >/dev/null

echo "==> IP groups list"
curl -fsS "$BASE_URL/api/ipgroups" -H "$AUTH_HEADER" >/dev/null

echo "✅ Smoke test passed"
