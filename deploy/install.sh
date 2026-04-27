#!/bin/bash
# SecVision 快速部署腳本 — Ubuntu 24.04 / 22.04
# 用法：bash deploy/install.sh [--db-pass <密碼>] [--admin-pass <密碼>]
set -euo pipefail

APP_DIR=/opt/secvision
WEB_DIR=/var/www/secvision
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
SERVER_IP=$(hostname -I | awk '{print $1}')
ADMIN_USER=${ADMIN_USER:-admin}
ADMIN_PASS=${ADMIN_PASS:-Admin@123456}


# ── 預設值（可透過參數覆蓋）────────────────────────────────────────────────────
DB_PASS="changeme_$(openssl rand -hex 6)"
ADMIN_PASS="Admin$(openssl rand -hex 4)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-pass)    DB_PASS="$2";    shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    *) echo "未知參數: $1"; exit 1 ;;
  esac
done

echo "======================================================"
echo "  SecVision ISMS Portal 部署腳本"
echo "======================================================"

echo ""
echo "=== 1. 安裝系統套件 ==="


echo ""
echo "=== 2. 建立 PostgreSQL 資料庫 ==="
sudo systemctl start postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='secvision'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER secvision WITH PASSWORD '${DB_PASS}';"
# 若使用者已存在則更新密碼
sudo -u postgres psql -c "ALTER USER secvision WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='secvision'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE secvision OWNER secvision;"

echo ""
echo "=== 3. 建立系統使用者 ==="
id -u secvision &>/dev/null || sudo useradd -r -s /bin/false -d "${APP_DIR}" secvision

echo ""
echo "=== 4. 部署後端 ==="


echo ""
echo "=== 5. 初始化資料庫 Schema ==="
n
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 方便後續維運：複製部署輔助腳本
sudo mkdir -p $APP_DIR/deploy
sudo cp "$REPO_DIR/deploy/redeploy-backend.sh" "$REPO_DIR/deploy/create-admin.sh" $APP_DIR/deploy/
sudo chown -R secvision:secvision $APP_DIR/deploy

echo ""
echo "======================================================"
echo "✅ 部署完成！"

