#!/bin/bash
# SecVision 本地開發環境快速設定腳本
# 支援：macOS / Ubuntu / Debian
# 用法：bash scripts/setup-dev.sh [--with-postgres]
set -euo pipefail

REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
BACKEND_DIR="${REPO_DIR}/backend"
USE_POSTGRES=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-postgres) USE_POSTGRES=true; shift ;;
    *) echo "未知參數: $1"; exit 1 ;;
  esac
done

echo "======================================================"
echo "  SecVision 本地開發環境設定"
echo "======================================================"

# ── 1. 偵測 Python 版本 ────────────────────────────────────────────────────────
PYTHON=""
for cmd in python3.11 python3.12 python3; do
  if command -v "$cmd" &>/dev/null; then
    VER=$("$cmd" -c "import sys; print(sys.version_info >= (3, 11))")
    if [ "$VER" = "True" ]; then
      PYTHON="$cmd"
      break
    fi
  fi
done

if [ -z "$PYTHON" ]; then
  echo "❌ 需要 Python 3.11 或以上版本"
  echo "   macOS:  brew install python@3.11"
  echo "   Ubuntu: sudo apt install python3.11 python3.11-venv"
  exit 1
fi
echo "[OK] Python: $($PYTHON --version)"

# ── 2. 建立虛擬環境 ────────────────────────────────────────────────────────────
echo ""
echo "=== 建立 Python 虛擬環境 ==="
if [ ! -d "${BACKEND_DIR}/venv" ]; then
  "$PYTHON" -m venv "${BACKEND_DIR}/venv"
  echo "[OK] 虛擬環境已建立於 backend/venv/"
else
  echo "[SKIP] 虛擬環境已存在"
fi

# ── 3. 安裝 Python 套件 ────────────────────────────────────────────────────────
echo ""
echo "=== 安裝 Python 相依套件 ==="
"${BACKEND_DIR}/venv/bin/pip" install -q --upgrade pip
"${BACKEND_DIR}/venv/bin/pip" install -q -r "${BACKEND_DIR}/requirements.txt"
echo "[OK] 套件安裝完成"

# ── 4. 建立 .env 設定檔 ────────────────────────────────────────────────────────
echo ""
echo "=== 設定環境變數 ==="
if [ ! -f "${BACKEND_DIR}/.env" ]; then
  if $USE_POSTGRES; then
    cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
    echo "[OK] .env 已從 .env.example 建立（PostgreSQL 模式）"
    echo "     請編輯 backend/.env 設定資料庫連線資訊"
  else
    cat > "${BACKEND_DIR}/.env" <<EOF
# 開發模式使用 SQLite（無需安裝 PostgreSQL）
DATABASE_URL=sqlite:///./secvision.db
SECRET_KEY=dev-secret-key-do-not-use-in-production
ACCESS_TOKEN_EXPIRE_MINUTES=480
EOF
    echo "[OK] .env 已建立（SQLite 模式）"
  fi
else
  echo "[SKIP] .env 已存在，略過"
fi

# ── 5. 執行資料庫遷移 ──────────────────────────────────────────────────────────
echo ""
echo "=== 初始化資料庫 ==="
cd "${BACKEND_DIR}"
"${BACKEND_DIR}/venv/bin/alembic" upgrade head
echo "[OK] 資料庫 Schema 已建立"

# ── 6. 建立初始管理員帳號 ──────────────────────────────────────────────────────
echo ""
echo "=== 建立開發用管理員帳號 ==="
"${BACKEND_DIR}/venv/bin/python3" - <<'PYEOF'
import sys
sys.path.insert(0, '.')
from database import SessionLocal, Base, engine
from models.user import User
from passlib.context import CryptContext
Base.metadata.create_all(bind=engine)
db = SessionLocal()
if not db.query(User).filter(User.username == 'admin').first():
    hashed = CryptContext(schemes=['bcrypt'], deprecated='auto').hash('admin')
    db.add(User(username='admin', hashed_pw=hashed, role='admin'))
    db.commit()
    print('[OK] 管理員帳號已建立：admin / admin')
else:
    print('[SKIP] admin 帳號已存在')
db.close()
PYEOF

echo ""
echo "======================================================"
echo "✅ 開發環境設定完成！"
echo ""
echo "  啟動後端："
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    uvicorn main:app --reload --port 8000"
echo ""
echo "  啟動前端（另開終端機）："
echo "    python3 -m http.server 8080"
echo "    # 或 npx serve ."
echo ""
echo "  開啟瀏覽器："
echo "    前端：http://localhost:8080"
echo "    API 文件：http://localhost:8000/api/docs"
echo ""
echo "  測試帳號：admin / admin"
echo "  （請勿在正式環境使用此密碼）"
echo "======================================================"
