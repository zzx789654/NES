#!/bin/bash
# SecVision 自動部署腳本 — Ubuntu 24.04 / 22.04
# 用法：sudo bash deploy/install.sh
set -euo pipefail

APP_DIR=/opt/secvision
WEB_DIR=/var/www/secvision
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)

# 允許從環境變數覆寫資料庫密碼
DB_PASS="${DB_PASS:-changeme}"

echo "=== 1. 安裝系統套件 ==="
apt-get update -q
apt-get install -y -q \
    python3.11 python3.11-venv python3.11-dev python3-pip \
    postgresql nginx curl

echo "=== 2. 建立資料庫 ==="
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='secvision'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER secvision WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='secvision'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE secvision OWNER secvision;"

echo "=== 3. 建立系統使用者 ==="
id -u secvision &>/dev/null || useradd -r -s /bin/false -d "${APP_DIR}" secvision

echo "=== 4. 部署後端 ==="
mkdir -p "${APP_DIR}"
cp -r "${REPO_DIR}/backend" "${APP_DIR}/"
python3.11 -m venv "${APP_DIR}/venv"
"${APP_DIR}/venv/bin/pip" install -q --upgrade pip
"${APP_DIR}/venv/bin/pip" install -q -r "${APP_DIR}/backend/requirements.txt"

echo "=== 5. 建立環境設定檔 (.env) ==="
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))")
cat > "${APP_DIR}/backend/.env" << EOF
DATABASE_URL=postgresql://secvision:${DB_PASS}@localhost:5432/secvision
SECRET_KEY=${SECRET_KEY}
ACCESS_TOKEN_EXPIRE_MINUTES=480
EOF
chmod 600 "${APP_DIR}/backend/.env"
chown -R secvision:secvision "${APP_DIR}"

echo "=== 6. 初始化資料庫 Schema ==="
cd "${APP_DIR}/backend"
sudo -u secvision "${APP_DIR}/venv/bin/alembic" upgrade head

echo "=== 7. 建立初始管理員帳號 ==="
sudo -u secvision "${APP_DIR}/venv/bin/python3" - << 'PYEOF'
import sys
sys.path.insert(0, '/opt/secvision/backend')
from database import SessionLocal
from models.user import User
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
db = SessionLocal()
try:
    if not db.query(User).filter(User.username == 'admin').first():
        db.add(User(username='admin', hashed_pw=pwd_ctx.hash('admin'), role='admin'))
        db.commit()
        print('  [OK] 管理員帳號已建立：admin / admin')
    else:
        print('  [SKIP] 管理員帳號已存在')
finally:
    db.close()
PYEOF

echo "=== 8. 部署前端 ==="
mkdir -p "${WEB_DIR}"
cp "${REPO_DIR}/index.html" \
   "${REPO_DIR}/app.jsx" \
   "${REPO_DIR}/components.jsx" \
   "${REPO_DIR}/mock-api.js" \
   "${REPO_DIR}/api-client.js" \
   "${WEB_DIR}/"
cp -r "${REPO_DIR}/pages" "${WEB_DIR}/"
chown -R www-data:www-data "${WEB_DIR}"

echo "=== 9. 安裝 systemd 服務 ==="
cp "${REPO_DIR}/deploy/secvision.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now secvision

echo "=== 10. 設定 Nginx ==="
cp "${REPO_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/secvision
ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
# 移除預設站台以避免衝突
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "========================================="
echo "  SecVision 部署完成！"
echo "========================================="
echo "  前端：    http://${SERVER_IP}"
echo "  API 文件：http://${SERVER_IP}/api/docs"
echo ""
echo "  預設管理員帳號：admin / admin"
echo "  請登入後立即至「帳號設定」修改密碼！"
echo ""
echo "  設定檔位置：${APP_DIR}/backend/.env"
echo "  已自動產生隨機 SECRET_KEY。"
echo "  如需修改資料庫密碼，請同步更新 .env"
echo "  並執行：sudo systemctl restart secvision"
echo "========================================="
