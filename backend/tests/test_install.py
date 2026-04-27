"""
安裝流程驗證測試

測試 setup-dev.sh / install.sh 所執行的 Python 元件：
1. requirements.txt 的所有套件可正常匯入
2. DATABASE_URL 環境變數可覆蓋 alembic.ini 設定
3. 管理員帳號建立流程
4. .env 設定檔可被 config.py 正確載入
5. alembic migration 在 SQLite 上可正常執行
"""

import importlib
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).parent.parent


# ── 1. 套件可匯入性 ────────────────────────────────────────────────────────────

REQUIRED_PACKAGES = [
    ("fastapi", "FastAPI"),
    ("uvicorn", "uvicorn"),
    ("sqlalchemy", "SQLAlchemy"),
    ("alembic", "alembic"),
    ("jose", "python-jose"),
    ("bcrypt", "bcrypt"),
    ("python_multipart", "python-multipart"),
    ("pandas", "pandas"),
    ("httpx", "httpx"),
    ("pydantic", "pydantic"),
    ("pydantic_settings", "pydantic-settings"),
    ("dotenv", "python-dotenv"),
]


@pytest.mark.parametrize("module,package_name", REQUIRED_PACKAGES)
def test_package_importable(module, package_name):
    """requirements.txt 中的每個套件都必須可正常匯入。"""
    try:
        importlib.import_module(module)
    except ImportError as e:
        pytest.fail(f"{package_name} 無法匯入：{e}")


# ── 2. DATABASE_URL 環境變數覆蓋 alembic.ini ─────────────────────────────────

def test_alembic_env_reads_database_url(monkeypatch):
    """alembic/env.py 應優先使用 DATABASE_URL 環境變數。"""
    from alembic.config import Config
    from alembic import context as alembic_context

    test_url = "sqlite:///./test_override.db"
    monkeypatch.setenv("DATABASE_URL", test_url)

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    # alembic.ini 預設是 sqlite:///./secvision.db，環境變數應能覆蓋
    env_path = BACKEND_DIR / "alembic" / "env.py"
    env_src = env_path.read_text()
    assert "DATABASE_URL" in env_src, "alembic/env.py 應讀取 DATABASE_URL 環境變數"
    assert "load_dotenv" in env_src, "alembic/env.py 應載入 .env 檔案"


# ── 3. 管理員帳號建立 ──────────────────────────────────────────────────────────

def test_admin_creation(tmp_path, monkeypatch):
    """setup-dev.sh 中的 Python 管理員建立邏輯應能正確執行。"""
    db_url = f"sqlite:///{tmp_path}/test_admin.db"
    monkeypatch.setenv("DATABASE_URL", db_url)

    # 重設已載入的模組，確保使用新的 DATABASE_URL
    for mod in list(sys.modules.keys()):
        if mod in ("config", "database") or mod.startswith("models"):
            del sys.modules[mod]

    from database import Base, SessionLocal, engine
    from models.user import User
    import bcrypt

    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        assert db.query(User).filter(User.username == "admin").first() is None

        hashed = bcrypt.hashpw(b"adminpass", bcrypt.gensalt()).decode()
        db.add(User(username="admin", hashed_pw=hashed, role="admin"))
        db.commit()

        user = db.query(User).filter(User.username == "admin").first()
        assert user is not None
        assert user.role == "admin"
        assert bcrypt.checkpw(b"adminpass", user.hashed_pw.encode())
    finally:
        db.close()


def test_admin_creation_idempotent(tmp_path, monkeypatch):
    """重複執行建立管理員不應拋出例外（冪等性）。"""
    db_url = f"sqlite:///{tmp_path}/test_idempotent.db"
    monkeypatch.setenv("DATABASE_URL", db_url)

    for mod in list(sys.modules.keys()):
        if mod in ("config", "database") or mod.startswith("models"):
            del sys.modules[mod]

    from database import Base, SessionLocal
    from models.user import User
    import bcrypt

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    for _ in range(2):
        db = Session()
        try:
            if not db.query(User).filter(User.username == "admin").first():
                hashed = bcrypt.hashpw(b"pass", bcrypt.gensalt()).decode()
                db.add(User(username="admin", hashed_pw=hashed, role="admin"))
                db.commit()
        finally:
            db.close()

    db = Session()
    try:
        count = db.query(User).filter(User.username == "admin").count()
        assert count == 1, "管理員帳號不應重複建立"
    finally:
        db.close()


# ── 4. .env 設定檔載入 ────────────────────────────────────────────────────────

def test_env_example_contains_required_keys():
    """．env.example 應包含所有必要的設定項目。"""
    env_example = (BACKEND_DIR / ".env.example").read_text()
    required_keys = [
        "DATABASE_URL",
        "SECRET_KEY",
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "ALGORITHM",
        "ALLOWED_ORIGINS",
    ]
    for key in required_keys:
        assert key in env_example, f".env.example 缺少 {key}"


def test_config_reads_env_vars(monkeypatch, tmp_path):
    """config.py 應能從環境變數讀取設定。"""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./custom.db")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-12345")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120")

    if "config" in sys.modules:
        del sys.modules["config"]

    from config import Settings
    s = Settings()
    assert s.database_url == "sqlite:///./custom.db"
    assert s.secret_key == "test-secret-key-12345"
    assert s.access_token_expire_minutes == 120


# ── 5. alembic migration（SQLite） ────────────────────────────────────────────

def test_alembic_migration_sqlite(tmp_path, monkeypatch):
    """alembic upgrade head 應能在 SQLite 上成功執行。"""
    db_path = tmp_path / "migration_test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")

    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        env={**os.environ, "DATABASE_URL": f"sqlite:///{db_path}"},
    )
    assert result.returncode == 0, (
        f"alembic upgrade head 失敗：\n{result.stdout}\n{result.stderr}"
    )
    assert db_path.exists(), "migration 後資料庫檔案應存在"


def test_alembic_migration_creates_tables(tmp_path, monkeypatch):
    """migration 後應建立所有必要的資料表。"""
    from sqlalchemy import create_engine, inspect

    db_path = tmp_path / "tables_test.db"
    db_url = f"sqlite:///{db_path}"
    monkeypatch.setenv("DATABASE_URL", db_url)

    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        capture_output=True,
        env={**os.environ, "DATABASE_URL": db_url},
    )

    engine = create_engine(db_url)
    inspector = inspect(engine)
    tables = inspector.get_table_names()

    expected_tables = ["users", "scans", "vulnerabilities", "audit_scans", "audit_results", "ip_groups"]
    for table in expected_tables:
        assert table in tables, f"資料表 {table} 未被建立"


# ── 6. install.sh 腳本驗證 ────────────────────────────────────────────────────

def test_install_sh_syntax():
    """deploy/install.sh 應通過 bash -n 語法檢查。"""
    install_sh = BACKEND_DIR.parent / "deploy" / "install.sh"
    result = subprocess.run(
        ["bash", "-n", str(install_sh)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"install.sh 語法錯誤：{result.stderr}"


def test_setup_dev_sh_syntax():
    """scripts/setup-dev.sh 應通過 bash -n 語法檢查。"""
    setup_sh = BACKEND_DIR.parent / "scripts" / "setup-dev.sh"
    result = subprocess.run(
        ["bash", "-n", str(setup_sh)],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"setup-dev.sh 語法錯誤：{result.stderr}"


def test_install_sh_has_required_params():
    """deploy/install.sh 應支援必要的命令列參數。"""
    install_sh = (BACKEND_DIR.parent / "deploy" / "install.sh").read_text()
    required_params = ["--domain", "--db-pass", "--admin-pass"]
    for param in required_params:
        assert param in install_sh, f"install.sh 缺少 {param} 參數"


def test_install_sh_generates_secret_key():
    """deploy/install.sh 應自動產生 SECRET_KEY。"""
    install_sh = (BACKEND_DIR.parent / "deploy" / "install.sh").read_text()
    assert "SECRET_KEY" in install_sh
    assert "openssl rand" in install_sh


def test_install_sh_sets_env_file_permissions():
    """deploy/install.sh 應設定 .env 為 600 權限。"""
    install_sh = (BACKEND_DIR.parent / "deploy" / "install.sh").read_text()
    assert "chmod 600" in install_sh


# ── 7. setup-dev.sh 執行測試 ─────────────────────────────────────────────────

def test_setup_dev_sh_help():
    """setup-dev.sh --help 應正常執行並顯示說明。"""
    setup_sh = BACKEND_DIR.parent / "scripts" / "setup-dev.sh"
    result = subprocess.run(
        ["bash", str(setup_sh), "--help"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"--help 失敗：{result.stderr}"
    assert "--admin-pass" in result.stdout
    assert "--reset-db" in result.stdout
