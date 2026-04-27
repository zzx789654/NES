#!/bin/bash
# 建立或重設 SecVision 後端使用者（預設 admin）
set -euo pipefail

USERNAME=${1:-admin}
PASSWORD=${2:-Admin@123456}
ROLE=${3:-admin}

APP_DIR=/opt/secvision
BACKEND_DIR="$APP_DIR/backend"
VENV_PY="$APP_DIR/venv/bin/python"

if [[ ! -d "$BACKEND_DIR" ]]; then
  echo "❌ 找不到後端目錄: $BACKEND_DIR"
  exit 1
fi

if [[ ! -x "$VENV_PY" ]]; then
  echo "⚠️  找不到虛擬環境 Python，改用系統 python3"
  VENV_PY="python3"
fi

if [[ ! "$ROLE" =~ ^(admin|analyst|viewer)$ ]]; then
  echo "❌ ROLE 必須是 admin / analyst / viewer"
  exit 1
fi

cd "$BACKEND_DIR"
"$VENV_PY" - "$USERNAME" "$PASSWORD" "$ROLE" <<'PY'
import sys
from database import Base, SessionLocal, engine
from models.user import User
from routers.auth import hash_password

username, password, role = sys.argv[1], sys.argv[2], sys.argv[3]

Base.metadata.create_all(bind=engine)

db = SessionLocal()
try:
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.hashed_pw = hash_password(password)
        user.role = role
        action = "updated"
    else:
        user = User(username=username, hashed_pw=hash_password(password), role=role)
        db.add(user)
        action = "created"
    db.commit()
    db.refresh(user)
    print(f"✅ User {action}: username={user.username}, role={user.role}, id={user.id}")
finally:
    db.close()
PY

echo "✅ 完成：可使用 ${USERNAME} 登入 /api/auth/token"
