#!/bin/bash
# 同步最新 backend + frontend 程式碼並重啟服務
# 用法：bash redeploy-backend.sh [SERVER_IP] [--branch <分支>]
set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR=/opt/secvision/backend
WEB_DIR=/var/www/secvision
SERVICE_NAME=secvision
LOCAL_API_URL=http://127.0.0.1:8000
SERVER_IP=""
BRANCH=""

# 解析參數
while [[ $# -gt 0 ]]; do
  case "$1" in
    --branch) BRANCH="$2"; shift 2 ;;
    *)        SERVER_IP="$1"; shift ;;
  esac
done

# ── 拉取最新程式碼 ──────────────────────────────────────────────────────────
echo "==> Pull latest code from git"
if git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
  if [[ -z "$BRANCH" ]]; then
    BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  fi
  echo "  分支：$BRANCH"
  git -C "$REPO_DIR" fetch origin "$BRANCH" 2>&1 | sed 's/^/  /'
  git -C "$REPO_DIR" checkout "$BRANCH"
  git -C "$REPO_DIR" pull origin "$BRANCH" 2>&1 | sed 's/^/  /'
  echo "  已更新至 commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
else
  echo "  ⚠️  非 git 目錄，跳過更新步驟"
fi

if [[ ! -d "$REPO_DIR/backend" ]]; then
  echo "❌ 找不到來源目錄: $REPO_DIR/backend"
  exit 1
fi
if [[ ! -f "$REPO_DIR/index.html" ]]; then
  echo "❌ 找不到前端檔案: $REPO_DIR/index.html"
  exit 1
fi

echo "==> Sync backend code"
sudo mkdir -p "$BACKEND_DIR"
sudo cp -a "$REPO_DIR/backend/." "$BACKEND_DIR/"
sudo chown -R secvision:secvision "$BACKEND_DIR"

echo "==> Sync frontend files"
DEPLOY_VERSION=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
sudo mkdir -p "$WEB_DIR"
sudo cp "$REPO_DIR/index.html" \
        "$REPO_DIR/app.jsx" \
        "$REPO_DIR/components.jsx" \
        "$REPO_DIR/api-client.js" \
        "$WEB_DIR/"
sudo cp -r "$REPO_DIR/pages" "$WEB_DIR/"
# 注入 git hash 作為 cache-busting 版本號，強制瀏覽器重新下載更新的 JSX/JS 檔
sudo sed -i "s/__DEPLOY_VERSION__/${DEPLOY_VERSION}/g" "$WEB_DIR/index.html"
sudo chown -R www-data:www-data "$WEB_DIR"

echo "==> Deploy nginx site config"
sudo cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/secvision
sudo ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

echo "==> Run database migrations"
cd "$BACKEND_DIR" && sudo -u secvision /opt/secvision/venv/bin/alembic upgrade head

echo "==> Restart services"
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl reload nginx

echo "==> Service status"
sudo systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,20p'

echo "==> Wait until local API is ready"
READY=0
for i in $(seq 1 30); do
  if curl -fsS "$LOCAL_API_URL/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [[ "$READY" -ne 1 ]]; then
  echo "❌ API 在 30 秒內未就緒: $LOCAL_API_URL/health"
  sudo journalctl -u "$SERVICE_NAME" -n 80 --no-pager || true
  exit 1
fi

echo "✅ Local API health check passed: $LOCAL_API_URL/health"
LOCAL_ROOT_CODE=$(curl -sS -o /tmp/secvision_root_local.out -w "%{http_code}" "$LOCAL_API_URL/" || true)
if [[ "$LOCAL_ROOT_CODE" == "200" ]]; then
  echo "✅ Local API root endpoint is available (200)"
else
  echo "⚠️  Local API root endpoint returned HTTP $LOCAL_ROOT_CODE"
fi
curl -sS -I "$LOCAL_API_URL/docs" | head -n 1 || true

LOCAL_WEB_CODE=$(curl -sS -o /tmp/secvision_web_local.out -w "%{http_code}" "http://127.0.0.1/index.html" || true)
if [[ "$LOCAL_WEB_CODE" == "200" ]]; then
  echo "✅ Local frontend index.html is available via Nginx (200)"
else
  echo "⚠️  Local frontend index.html returned HTTP $LOCAL_WEB_CODE (check Nginx site/root)"
fi

if [[ -n "$SERVER_IP" ]]; then
  REMOTE_API_URL="http://${SERVER_IP}:8000"
  REMOTE_WEB_URL="http://${SERVER_IP}"
  echo "==> Check remote API: $REMOTE_API_URL"
  curl -sS "$REMOTE_API_URL/health" || true
  echo
  curl -sS -I "$REMOTE_API_URL/docs" | head -n 1 || true

  echo "==> Check remote frontend: $REMOTE_WEB_URL/index.html"
  curl -sS -I "$REMOTE_WEB_URL/index.html" | head -n 1 || true
fi
