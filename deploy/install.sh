#!/bin/bash
# SecVision 快速部署腳本 — Ubuntu 24.04 / 22.04
# 用法：bash deploy/install.sh [--db-pass <密碼>] [--admin-pass <密碼>] [--branch <分支>]
set -euo pipefail

APP_DIR=/opt/secvision
WEB_DIR=/var/www/secvision
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
SERVER_IP=$(hostname -I | awk '{print $1}')
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-Admin@123456}

# ── 預設值（可透過參數覆蓋）────────────────────────────────────────────────────
DB_PASS="changeme_$(openssl rand -hex 6)"
if [[ -z "${ADMIN_PASS:-}" ]]; then
  ADMIN_PASS="Admin$(openssl rand -hex 4)"
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-pass)    DB_PASS="$2";    shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --branch)     BRANCH="$2";     shift 2 ;;
    *) echo "未知參數: $1"; exit 1 ;;
  esac
done

echo "======================================================"
echo "  SecVision ISMS Portal 部署腳本"
echo "======================================================"

echo ""
echo "=== 0. 更新程式碼至最新版 ==="
if git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
  # 若未指定分支，使用目前所在分支
  if [[ -z "$BRANCH" ]]; then
    BRANCH=$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
  fi
  echo "  分支：$BRANCH"
  git -C "$REPO_DIR" fetch origin "$BRANCH" 2>&1 | sed 's/^/  /'
  git -C "$REPO_DIR" checkout "$BRANCH"
  git -C "$REPO_DIR" pull origin "$BRANCH" 2>&1 | sed 's/^/  /'
  echo "  已更新至 commit: $(git -C "$REPO_DIR" rev-parse --short HEAD)"
else
  echo "  ⚠️  非 git 目錄，跳過更新步驟（請確認程式碼為最新版）"
fi

echo ""
echo "=== 1. 安裝系統套件 ==="
sudo apt update && sudo apt install -y \
    python3.12 python3.12-venv python3-pip \
    postgresql nginx

echo ""
echo "=== 2. 建立 PostgreSQL 資料庫 ==="
SECVISION_DB_URL="postgresql+psycopg2://secvision:${DB_PASS}@127.0.0.1:5432/secvision"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='secvision'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER secvision WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "ALTER USER secvision WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='secvision'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE secvision OWNER secvision;"

echo ""
echo "=== 3. 建立系統使用者 ==="
id -u secvision &>/dev/null || sudo useradd -r -s /bin/false -d "${APP_DIR}" secvision

echo ""
echo "=== 4. 部署後端 ==="
sudo mkdir -p "$APP_DIR/backend"
sudo cp -a "$REPO_DIR/backend/." "$APP_DIR/backend/"
sudo python3.12 -m venv $APP_DIR/venv
sudo "$APP_DIR/venv/bin/python" -m pip install --upgrade pip
sudo "$APP_DIR/venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.txt"

echo "=== 4-1. 產生後端 .env ==="
sudo tee "$APP_DIR/backend/.env" >/dev/null <<ENVEOF
DATABASE_URL=${SECVISION_DB_URL}
SECRET_KEY=$(openssl rand -hex 32)
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALGORITHM=HS256
ALLOWED_ORIGINS=http://${SERVER_IP},http://localhost,http://127.0.0.1
ENVEOF
sudo chown -R secvision:secvision $APP_DIR

echo "=== 5. 初始化資料庫 Schema ==="
cd $APP_DIR/backend
sudo -u secvision $APP_DIR/venv/bin/alembic upgrade head

echo "=== 6. 建立預設管理者 ==="
sudo bash "$REPO_DIR/deploy/create-admin.sh" "$ADMIN_USER" "$ADMIN_PASS" admin

echo "=== 7. 部署前端 ==="
DEPLOY_VERSION=$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)
sudo mkdir -p $WEB_DIR
sudo cp "$REPO_DIR/index.html" \
        "$REPO_DIR/app.jsx" \
        "$REPO_DIR/components.jsx" \
        "$REPO_DIR/api-client.js" \
        $WEB_DIR/
sudo cp -r "$REPO_DIR/pages" $WEB_DIR/
sudo sed -i "s/__DEPLOY_VERSION__/${DEPLOY_VERSION}/g" "$WEB_DIR/index.html"
sudo chown -R www-data:www-data $WEB_DIR

echo "=== 8. 安裝 systemd 服務 ==="
sudo cp "$REPO_DIR/deploy/secvision.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now secvision

echo "=== 9. 設定 Nginx ==="
sudo cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/secvision
sudo ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 方便後續維運：複製部署輔助腳本
sudo mkdir -p $APP_DIR/deploy
sudo cp "$REPO_DIR/deploy/redeploy-backend.sh" "$REPO_DIR/deploy/create-admin.sh" $APP_DIR/deploy/
sudo chown -R secvision:secvision $APP_DIR/deploy

echo "=== 10. 驗證預設管理者登入 ==="
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

verify_login() {
  curl -sS -o /tmp/secvision_admin_token.json -w "%{http_code}" \
    -X POST "http://127.0.0.1:8000/api/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "username=${ADMIN_USER}" \
    --data-urlencode "password=${ADMIN_PASS}"
}

HTTP_CODE=$(verify_login)
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "⚠️  預設管理者驗證失敗（HTTP ${HTTP_CODE}），重新建立一次後重試..."
  sudo bash "$REPO_DIR/deploy/create-admin.sh" "$ADMIN_USER" "$ADMIN_PASS" admin
  sudo systemctl restart secvision
  sleep 2
  HTTP_CODE=$(verify_login)
fi

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "✅ 預設管理者登入驗證成功"
else
  echo "❌ 預設管理者仍無法登入（HTTP ${HTTP_CODE}）"
  echo "   回應內容：$(cat /tmp/secvision_admin_token.json)"
  echo "   請檢查：sudo journalctl -u secvision -n 120 --no-pager"
fi

echo "=== 11. 核心 API Smoke Test ==="
if sudo bash "$REPO_DIR/deploy/smoke-test.sh" "http://127.0.0.1:8000" "$ADMIN_USER" "$ADMIN_PASS"; then
  echo "✅ 核心功能 Smoke Test 成功"
else
  echo "⚠️  Smoke Test 失敗，請檢查服務與日誌"
fi

echo ""
echo "✅ 部署完成！"
echo "   前端：http://${SERVER_IP}"
echo "   API：  http://${SERVER_IP}/api/docs"
echo ""
echo "🔐 預設管理者帳號已建立"
echo "   username: ${ADMIN_USER}"
echo "   password: ${ADMIN_PASS}"
echo "⚠️  安裝完成後請立即變更預設密碼"
echo "⚠️  請記得檢查 /opt/secvision/backend/.env 的資料庫密碼、SECRET_KEY 與 ALLOWED_ORIGINS"
