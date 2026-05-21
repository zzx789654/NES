#!/bin/bash
# SecVision 快速部署腳本 — Ubuntu 24.04 / 22.04
# 用法：bash deploy/install.sh [--preflight-only] [--skip-git-update] [--db-pass <密碼>] [--admin-pass <密碼>] [--branch <分支>]
set -euo pipefail

APP_DIR=/opt/secvision
WEB_DIR=/var/www/secvision
REPO_DIR=$(cd "$(dirname "$0")/.." && pwd)
SERVER_IP=$(hostname -I | awk '{print $1}')
ADMIN_USER=${ADMIN_USER:-admin}
# ADMIN_PASS 預設在參數解析後決定（若未指定則自動產生隨機強密碼）

# ── 預設值（可透過參數覆蓋）────────────────────────────────────────────────────
DB_PASS="changeme_$(openssl rand -hex 6)"
BRANCH=""
PREFLIGHT_ONLY=false
SKIP_GIT_UPDATE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-pass)    DB_PASS="$2";    shift 2 ;;
    --admin-pass) ADMIN_PASS="$2"; shift 2 ;;
    --branch)     BRANCH="$2";     shift 2 ;;
    --preflight-only) PREFLIGHT_ONLY=true; shift ;;
    --skip-git-update) SKIP_GIT_UPDATE=true; shift ;;
    *) echo "未知參數: $1"; exit 1 ;;
  esac
done

# 若未透過 --admin-pass 或環境變數 ADMIN_PASS 指定，自動產生隨機密碼
# 格式 Admin@<hex8> 符合密碼強度政策（大寫+數字+特殊字元+長度≥8）
if [[ -z "${ADMIN_PASS:-}" ]]; then
  ADMIN_PASS="Admin@$(openssl rand -hex 4)"
fi

echo "======================================================"
echo "  SecVision ISMS Portal 部署腳本"
echo "======================================================"

preflight_check() {
  local failed=0

  echo ""
  echo "=== Preflight: 部署前環境確認 ==="

  if [[ -r /etc/os-release ]]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    echo "  OS: ${PRETTY_NAME:-unknown}"
    if [[ "${ID:-}" != "ubuntu" || ! " ${VERSION_ID:-} " =~ ^\ (22\.04|24\.04)\  ]]; then
      echo "  ⚠️  建議部署環境為 Ubuntu 22.04 或 24.04；目前為 ${PRETTY_NAME:-unknown}"
    fi
  else
    echo "  ⚠️  無法讀取 /etc/os-release，略過 OS 版本確認"
  fi

  for cmd in bash awk sed grep openssl git curl; do
    if command -v "$cmd" >/dev/null 2>&1; then
      echo "  ✅ command: $cmd"
    else
      echo "  ❌ 缺少必要指令: $cmd"
      failed=1
    fi
  done

  if command -v sudo >/dev/null 2>&1; then
    echo "  ✅ command: sudo"
  else
    echo "  ❌ 缺少 sudo；部署腳本需要 sudo 安裝套件、建立使用者與管理 systemd/nginx"
    failed=1
  fi

  if command -v apt >/dev/null 2>&1; then
    echo "  ✅ command: apt"
  else
    echo "  ❌ 缺少 apt；此腳本僅支援 Debian/Ubuntu apt 套件管理"
    failed=1
  fi

  if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
    echo "  ✅ systemd: available"
  else
    echo "  ❌ systemd 不可用；無法啟用 secvision.service 或 reload nginx（容器環境常見）"
    failed=1
  fi

  if [[ -d "$REPO_DIR/backend" && -f "$REPO_DIR/backend/requirements.txt" && -f "$REPO_DIR/index.html" ]]; then
    echo "  ✅ repo: $REPO_DIR"
  else
    echo "  ❌ repo 結構不完整：需包含 backend/requirements.txt 與 index.html"
    failed=1
  fi

  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq ':(80|8000)$'; then
    echo "  ⚠️  偵測到 80 或 8000 port 已被占用；部署時可能需要先釋放連線"
  else
    echo "  ✅ ports: 80/8000 未偵測到 LISTEN"
  fi

  if [[ $failed -ne 0 ]]; then
    echo "  ❌ Preflight 失敗；請先修正上述環境問題後再執行部署"
    return 1
  fi

  echo "  ✅ Preflight 通過，可以開始自動安裝與服務啟用"
}

preflight_check
if [[ "$PREFLIGHT_ONLY" == "true" ]]; then
  echo "=== Preflight-only 模式結束，未修改系統 ==="
  exit 0
fi

echo ""
echo "=== 0. 更新程式碼至最新版 ==="
if [[ "$SKIP_GIT_UPDATE" == "true" ]]; then
  echo "  已指定 --skip-git-update，跳過 git fetch/checkout/pull"
elif git -C "$REPO_DIR" rev-parse --git-dir > /dev/null 2>&1; then
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
# 若資料表已存在但無 alembic_version（覆蓋安裝或先前由 create_all() 建立），
# 先 stamp 至 head 以避免重建已存在的資料表。
_UNVERSIONED=$(sudo -u secvision $APP_DIR/venv/bin/python3 - <<'PY' 2>/dev/null
try:
    from sqlalchemy import inspect
    from database import engine
    t = inspect(engine).get_table_names()
    print("yes" if "scans" in t and "alembic_version" not in t else "no")
except Exception:
    print("no")
PY
)
if [[ "${_UNVERSIONED:-no}" == "yes" ]]; then
  echo "  ⚠️  偵測到未版本化資料庫，先 stamp 至 head（保留既有資料，跳過建表）"
  sudo -u secvision $APP_DIR/venv/bin/alembic stamp head
fi
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
sudo systemctl reset-failed secvision >/dev/null 2>&1 || true
sudo systemctl enable secvision
sudo systemctl restart secvision

print_backend_diagnostics() {
  echo "--- secvision.service status ---"
  sudo systemctl status secvision --no-pager -l || true
  echo "--- secvision.service journal ---"
  sudo journalctl -u secvision -n 160 --no-pager || true
  echo "--- listening ports ---"
  sudo ss -ltnp 2>/dev/null | grep -E ':(80|8000)\b' || true
}

wait_for_backend() {
  local ok=0
  for _ in $(seq 1 60); do
    if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
      ok=1
      break
    fi
    sleep 1
  done
  if [[ "$ok" != "1" ]]; then
    echo "❌ secvision backend 未正常啟動，停止後續驗證。"
    print_backend_diagnostics
    exit 1
  fi
}
wait_for_backend

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
wait_for_backend

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
  echo "   回應內容：$(cat /tmp/secvision_admin_token.json 2>/dev/null || true)"
  print_backend_diagnostics
  exit 1
fi

echo "=== 11. 核心 API Smoke Test ==="
if sudo bash "$REPO_DIR/deploy/smoke-test.sh" "http://127.0.0.1:8000" "$ADMIN_USER" "$ADMIN_PASS"; then
  echo "✅ 核心功能 Smoke Test 成功"
else
  echo "❌ Smoke Test 失敗，停止部署並輸出診斷"
  print_backend_diagnostics
  exit 1
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
