#!/bin/bash
# SecVision 快速部署腳本 — Ubuntu 24.04 / 22.04
# 用法：bash deploy/install.sh [--db-pass <密碼>] [--admin-pass <密碼>]
set -euo pipefail

APP_DIR=/opt/secvision
WEB_DIR=/var/www/secvision
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)

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
sudo apt-get update -q
sudo apt-get install -y -q \
    python3.11 python3.11-venv python3-pip \
    postgresql nginx openssl

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
sudo mkdir -p "${APP_DIR}"
sudo cp -r "${REPO_DIR}/backend" "${APP_DIR}/"
sudo python3.11 -m venv "${APP_DIR}/venv"
sudo "${APP_DIR}/venv/bin/pip" install -q -r "${APP_DIR}/backend/requirements.txt"

echo ""
echo "=== 4.5. 建立後端環境設定檔 ==="
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
sudo tee "${APP_DIR}/backend/.env" > /dev/null <<EOF
DATABASE_URL=postgresql://secvision:${DB_PASS}@localhost:5432/secvision
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=480
EOF
sudo chown -R secvision:secvision "${APP_DIR}"
sudo chmod 600 "${APP_DIR}/backend/.env"

echo ""
echo "=== 5. 初始化資料庫 Schema ==="
cd "${APP_DIR}/backend"
sudo -u secvision DATABASE_URL="postgresql://secvision:${DB_PASS}@localhost:5432/secvision" \
    "${APP_DIR}/venv/bin/alembic" upgrade head

echo ""
echo "=== 5.5. 建立初始管理員帳號 ==="
sudo -u secvision \
    DATABASE_URL="postgresql://secvision:${DB_PASS}@localhost:5432/secvision" \
    "${APP_DIR}/venv/bin/python3" - <<PYEOF
import sys, os
sys.path.insert(0, '${APP_DIR}/backend')
os.environ.setdefault('DATABASE_URL', 'postgresql://secvision:${DB_PASS}@localhost:5432/secvision')
from database import SessionLocal, Base, engine
from models.user import User
from passlib.context import CryptContext
Base.metadata.create_all(bind=engine)
db = SessionLocal()
if not db.query(User).filter(User.username == 'admin').first():
    hashed = CryptContext(schemes=['bcrypt'], deprecated='auto').hash('${ADMIN_PASS}')
    db.add(User(username='admin', hashed_pw=hashed, role='admin'))
    db.commit()
    print('  [OK] 管理員帳號已建立')
else:
    print('  [SKIP] admin 帳號已存在，略過')
db.close()
PYEOF

echo ""
echo "=== 6. 部署前端靜態檔案 ==="
sudo mkdir -p "${WEB_DIR}"
sudo cp "${REPO_DIR}/index.html" \
        "${REPO_DIR}/app.jsx" \
        "${REPO_DIR}/components.jsx" \
        "${REPO_DIR}/mock-api.js" \
        "${REPO_DIR}/api-client.js" \
        "${WEB_DIR}/"
sudo cp -r "${REPO_DIR}/pages" "${WEB_DIR}/"
sudo chown -R www-data:www-data "${WEB_DIR}"

echo ""
echo "=== 7. 安裝 systemd 服務 ==="
sudo cp "${REPO_DIR}/deploy/secvision.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now secvision

echo ""
echo "=== 8. 設定 Nginx ==="
sudo cp "${REPO_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/secvision
sudo ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
# 停用預設站台（避免衝突）
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "======================================================"
echo "✅ 部署完成！"
echo ""
echo "  前端 URL：http://your-server-ip/"
echo "  API 文件：http://your-server-ip/api/docs"
echo ""
echo "  管理員帳號：admin"
echo "  管理員密碼：${ADMIN_PASS}"
echo "  資料庫密碼：${DB_PASS}"
echo ""
echo "⚠  請立即記錄以上密碼，並在登入後修改預設密碼！"
echo "   設定檔位置：${APP_DIR}/backend/.env"
echo "======================================================"
