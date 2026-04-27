#!/bin/bash
# SecVision 本機開發環境設定腳本（SQLite，無需 PostgreSQL）
set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR="$REPO_DIR/backend"
VENV_DIR="$BACKEND_DIR/venv"

# ── 預設參數 ──────────────────────────────────────────────────────────────────
ADMIN_USER="admin"
ADMIN_PASS="admin"
RESET_DB=false

usage() {
    echo "用法：$0 [選項]"
    echo ""
    echo "選項："
    echo "  --admin-user <name>    管理員帳號（預設：admin）"
    echo "  --admin-pass <pass>    管理員密碼（預設：admin）"
    echo "  --reset-db             刪除現有資料庫並重新初始化"
    echo "  -h, --help             顯示此說明"
    echo ""
    echo "範例："
    echo "  $0"
    echo "  $0 --admin-pass mysecret"
    echo "  $0 --reset-db"
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --admin-user) ADMIN_USER="$2"; shift 2 ;;
        --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
        --reset-db)   RESET_DB=true;   shift ;;
        -h|--help)    usage; exit 0 ;;
        *) echo "未知選項：$1"; usage; exit 1 ;;
    esac
done

echo "================================================================"
echo " SecVision 本機開發環境設定"
echo "================================================================"

# ── 1. 確認 Python 版本 ────────────────────────────────────────────────────────
echo ""
echo "=== 1. 確認 Python 版本 ==="
PYTHON=""
for cmd in python3.11 python3.12 python3.13 python3; do
    if command -v "$cmd" &>/dev/null; then
        if "$cmd" -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" 2>/dev/null; then
            PYTHON="$cmd"
            break
        fi
    fi
done

if [[ -z "$PYTHON" ]]; then
    echo "❌ 需要 Python 3.11 以上版本"
    exit 1
fi
echo "✓ $($PYTHON --version)"

# ── 2. 建立虛擬環境 ────────────────────────────────────────────────────────────
echo ""
echo "=== 2. 建立虛擬環境 ==="
if [[ ! -d "$VENV_DIR" ]]; then
    "$PYTHON" -m venv "$VENV_DIR"
    echo "✓ 虛擬環境建立於 $VENV_DIR"
else
    echo "✓ 虛擬環境已存在，跳過建立"
fi

PIP="$VENV_DIR/bin/pip"
PYTHON_VENV="$VENV_DIR/bin/python"

# ── 3. 安裝 Python 套件 ────────────────────────────────────────────────────────
echo ""
echo "=== 3. 安裝 Python 套件 ==="
"$PIP" install --upgrade pip setuptools wheel -q
"$PIP" install -r "$BACKEND_DIR/requirements.txt" -q
# 測試額外依賴
"$PIP" install pytest pytest-asyncio httpx -q
echo "✓ 所有套件安裝完成"

# ── 4. 建立 .env（SQLite 開發模式） ───────────────────────────────────────────
echo ""
echo "=== 4. 建立開發環境設定檔 ==="
ENV_FILE="$BACKEND_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    cat > "$ENV_FILE" <<EOF
DATABASE_URL=sqlite:///./secvision.db
SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
ACCESS_TOKEN_EXPIRE_MINUTES=480
ALGORITHM=HS256
ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
EOF
    echo "✓ .env 已建立（SQLite 模式）"
else
    echo "✓ .env 已存在，跳過建立"
fi

# ── 5. 初始化資料庫 ────────────────────────────────────────────────────────────
echo ""
echo "=== 5. 初始化資料庫 ==="

if [[ "$RESET_DB" == true ]]; then
    rm -f "$BACKEND_DIR/secvision.db"
    echo "✓ 舊資料庫已刪除"
fi

cd "$BACKEND_DIR"
"$VENV_DIR/bin/alembic" upgrade head
echo "✓ 資料庫 Schema 初始化完成"

# ── 6. 建立管理員帳號 ──────────────────────────────────────────────────────────
echo ""
echo "=== 6. 建立管理員帳號 ==="
"$PYTHON_VENV" - <<PYEOF
import sys, os
sys.path.insert(0, "$BACKEND_DIR")
os.chdir("$BACKEND_DIR")

from database import SessionLocal
from models.user import User
import bcrypt

db = SessionLocal()
try:
    existing = db.query(User).filter(User.username == "$ADMIN_USER").first()
    if not existing:
        hashed = bcrypt.hashpw("$ADMIN_PASS".encode(), bcrypt.gensalt()).decode()
        db.add(User(username="$ADMIN_USER", hashed_pw=hashed, role="admin"))
        db.commit()
        print("✓ 管理員帳號已建立：$ADMIN_USER")
    else:
        print("✓ 管理員帳號已存在，跳過建立")
finally:
    db.close()
PYEOF

# ── 完成 ───────────────────────────────────────────────────────────────────────
echo ""
echo "================================================================"
echo " ✅ 開發環境設定完成！"
echo "================================================================"
echo ""
echo " 啟動後端（需開新終端機）："
echo "   cd $BACKEND_DIR"
echo "   source venv/bin/activate"
echo "   uvicorn main:app --reload"
echo ""
echo " 啟動前端（需再開一個終端機）："
echo "   cd $REPO_DIR"
echo "   python3 -m http.server 3000"
echo ""
echo " 管理員帳號：$ADMIN_USER"
echo " 管理員密碼：$ADMIN_PASS"
echo " API Docs  ：http://127.0.0.1:8000/api/docs"
echo "================================================================"
