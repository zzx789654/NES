#!/bin/bash
# SecVision ISMS Portal — Ubuntu 24.04 / 22.04 自動部署腳本
set -euo pipefail

# ── 預設參數 ──────────────────────────────────────────────────────────────────
APP_DIR=/opt/secvision
WEB_DIR=/var/www/secvision
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)

DOMAIN="localhost"
DB_PASS="${DB_PASS:-$(openssl rand -hex 16)}"
ADMIN_PASS="${ADMIN_PASS:-$(openssl rand -hex 8)}"
SECRET_KEY="$(openssl rand -hex 32)"

# ── 使用說明 ──────────────────────────────────────────────────────────────────
usage() {
    echo "用法：$0 [選項]"
    echo ""
    echo "選項："
    echo "  --domain <domain>        網站網域，用於 Nginx 設定（預設：localhost）"
    echo "  --db-pass <password>     PostgreSQL 資料庫密碼（預設：隨機產生）"
    echo "  --admin-pass <password>  管理員初始密碼（預設：隨機產生）"
    echo "  --app-dir <path>         後端應用安裝目錄（預設：/opt/secvision）"
    echo "  --web-dir <path>         前端靜態檔案目錄（預設：/var/www/secvision）"
    echo "  -h, --help               顯示此說明"
    echo ""
    echo "環境變數（優先於命令列參數）："
    echo "  DB_PASS      資料庫密碼"
    echo "  ADMIN_PASS   管理員密碼"
    echo ""
    echo "範例："
    echo "  $0 --domain example.com --db-pass MySecurePass"
    echo "  DB_PASS=secret $0 --domain example.com"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --domain)     DOMAIN="$2";     shift 2 ;;
        --db-pass)    DB_PASS="$2";    shift 2 ;;
        --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
        --app-dir)    APP_DIR="$2";    shift 2 ;;
        --web-dir)    WEB_DIR="$2";    shift 2 ;;
        -h|--help)    usage; exit 0 ;;
        *) echo "未知選項：$1"; usage; exit 1 ;;
    esac
done

echo "================================================================"
echo " SecVision ISMS Portal 部署腳本"
echo "================================================================"
echo " 網域：      $DOMAIN"
echo " 應用目錄：  $APP_DIR"
echo " 前端目錄：  $WEB_DIR"
echo "================================================================"
echo ""

# ── 1. 確認系統需求 ────────────────────────────────────────────────────────────
echo "=== 1. 確認系統需求 ==="

# 選取可用的 Python 3.11+
PYTHON=""
for cmd in python3.11 python3.12 python3.13 python3; do
    if command -v "$cmd" &>/dev/null; then
        ver=$("$cmd" -c "import sys; print(sys.version_info[:2])" 2>/dev/null)
        if "$cmd" -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [[ -z "$PYTHON" ]]; then
    echo "❌ 需要 Python 3.11 以上版本，請先安裝"
    exit 1
fi
echo "✓ Python：$($PYTHON --version)"

# 確認以 root / sudo 執行
if [[ $EUID -ne 0 ]]; then
    SUDO=sudo
    echo "✓ 使用 sudo 提權"
else
    SUDO=""
    echo "✓ 以 root 執行"
fi

# ── 2. 安裝系統套件 ────────────────────────────────────────────────────────────
echo ""
echo "=== 2. 安裝系統套件 ==="
$SUDO apt-get update -q
$SUDO apt-get install -y -q \
    python3.11 python3.11-venv python3.11-dev \
    python3-pip \
    libpq-dev libffi-dev libssl-dev \
    postgresql \
    nginx \
    openssl \
    curl
echo "✓ 系統套件安裝完成"

# ── 3. 建立 PostgreSQL 資料庫 ─────────────────────────────────────────────────
echo ""
echo "=== 3. 建立 PostgreSQL 資料庫 ==="
$SUDO systemctl start postgresql

# 建立使用者（已存在則更新密碼）
$SUDO -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='secvision'" | grep -q 1 \
    || $SUDO -u postgres psql -c "CREATE USER secvision WITH PASSWORD '${DB_PASS}';"
$SUDO -u postgres psql -c "ALTER USER secvision WITH PASSWORD '${DB_PASS}';"

# 建立資料庫（已存在則跳過）
$SUDO -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='secvision'" | grep -q 1 \
    || $SUDO -u postgres psql -c "CREATE DATABASE secvision OWNER secvision;"
echo "✓ 資料庫設定完成"

# ── 4. 建立系統使用者 ──────────────────────────────────────────────────────────
echo ""
echo "=== 4. 建立系統使用者 ==="
id -u secvision &>/dev/null \
    || $SUDO useradd -r -s /bin/false -d "$APP_DIR" secvision
echo "✓ 系統使用者 secvision 就緒"

# ── 5. 部署後端 ────────────────────────────────────────────────────────────────
echo ""
echo "=== 5. 部署後端 ==="
$SUDO mkdir -p "$APP_DIR"
$SUDO cp -r "$REPO_DIR/backend" "$APP_DIR/"

# 建立 .env（含所有必要參數）
$SUDO tee "$APP_DIR/backend/.env" > /dev/null <<EOF
# 資料庫
DATABASE_URL=postgresql://secvision:${DB_PASS}@localhost:5432/secvision

# JWT 安全金鑰（請勿對外洩漏）
SECRET_KEY=${SECRET_KEY}

# Token 有效期限（分鐘）
ACCESS_TOKEN_EXPIRE_MINUTES=480

# JWT 演算法
ALGORITHM=HS256

# CORS 允許來源（逗號分隔，生產環境請指定實際網域）
ALLOWED_ORIGINS=http://${DOMAIN}
EOF
$SUDO chmod 600 "$APP_DIR/backend/.env"
$SUDO chown secvision:secvision "$APP_DIR/backend/.env"
echo "✓ .env 已建立（$APP_DIR/backend/.env）"

# 建立 Python 虛擬環境
$SUDO "$PYTHON" -m venv "$APP_DIR/venv"

# 升級 pip，再安裝所有套件
$SUDO "$APP_DIR/venv/bin/pip" install --upgrade pip setuptools wheel -q
$SUDO "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt" -q
$SUDO chown -R secvision:secvision "$APP_DIR"
echo "✓ Python 套件安裝完成"

# ── 6. 初始化資料庫 Schema ─────────────────────────────────────────────────────
echo ""
echo "=== 6. 初始化資料庫 Schema ==="
cd "$APP_DIR/backend"
$SUDO -u secvision "$APP_DIR/venv/bin/alembic" upgrade head
echo "✓ 資料庫 Schema 初始化完成"

# ── 7. 建立管理員帳號 ──────────────────────────────────────────────────────────
echo ""
echo "=== 7. 建立管理員帳號 ==="
$SUDO -u secvision "$APP_DIR/venv/bin/python" - <<PYEOF
import sys, os
sys.path.insert(0, "$APP_DIR/backend")
os.chdir("$APP_DIR/backend")

from database import SessionLocal
from models.user import User
import bcrypt

db = SessionLocal()
try:
    if not db.query(User).filter(User.username == "admin").first():
        hashed = bcrypt.hashpw("${ADMIN_PASS}".encode(), bcrypt.gensalt()).decode()
        db.add(User(username="admin", hashed_pw=hashed, role="admin"))
        db.commit()
        print("✓ 管理員帳號已建立")
    else:
        print("✓ 管理員帳號已存在，跳過建立")
finally:
    db.close()
PYEOF

# ── 8. 部署前端 ────────────────────────────────────────────────────────────────
echo ""
echo "=== 8. 部署前端 ==="
$SUDO mkdir -p "$WEB_DIR"
$SUDO cp \
    "$REPO_DIR/index.html" \
    "$REPO_DIR/app.jsx" \
    "$REPO_DIR/components.jsx" \
    "$REPO_DIR/mock-api.js" \
    "$REPO_DIR/api-client.js" \
    "$WEB_DIR/"
$SUDO cp -r "$REPO_DIR/pages" "$WEB_DIR/"
$SUDO chown -R www-data:www-data "$WEB_DIR"
echo "✓ 前端檔案已部署至 $WEB_DIR"

# ── 9. 安裝 systemd 服務 ───────────────────────────────────────────────────────
echo ""
echo "=== 9. 安裝 systemd 服務 ==="
$SUDO cp "$REPO_DIR/deploy/secvision.service" /etc/systemd/system/
$SUDO systemctl daemon-reload
$SUDO systemctl enable secvision
$SUDO systemctl restart secvision
echo "✓ secvision 服務已啟動"

# ── 10. 設定 Nginx ─────────────────────────────────────────────────────────────
echo ""
echo "=== 10. 設定 Nginx ==="
# 移除預設站台，避免衝突
$SUDO rm -f /etc/nginx/sites-enabled/default

# 套用網域設定
sed "s/your-domain.com/${DOMAIN}/g" "$REPO_DIR/deploy/nginx.conf" \
    | $SUDO tee /etc/nginx/sites-available/secvision > /dev/null
$SUDO ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
$SUDO nginx -t
$SUDO systemctl reload nginx
echo "✓ Nginx 設定完成"

# ── 完成摘要 ───────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " ✅ 部署完成！"
echo "================================================================"
echo " 前端 URL ：http://${DOMAIN}"
echo " API Docs  ：http://${DOMAIN}/api/docs"
echo ""
echo " 管理員帳號：admin"
echo " 管理員密碼：${ADMIN_PASS}"
echo ""
echo " 重要提醒："
echo "  ⚠️  請在首次登入後立即修改管理員密碼"
echo "  ⚠️  .env 位於 $APP_DIR/backend/.env（權限 600）"
echo "  ⚠️  如需啟用 HTTPS，請申請 Let's Encrypt 憑證後"
echo "      取消 nginx.conf 中 HTTPS 區塊的註解"
echo "================================================================"
