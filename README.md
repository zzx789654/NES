# SecVision — ISMS Security Portal

資訊安全管理系統（ISMS）整合平台，提供弱點掃描分析、NIST 合規稽核與安全儀表板。

支援**雙模式運作**：無需後端的 Demo 模式，以及搭配 FastAPI + PostgreSQL 的完整生產模式。

---

## 功能總覽

| 頁面 | 功能 |
|------|------|
| **Login** | JWT 登入驗證 / Demo 模式（無需後端） |
| **Dashboard** | 弱點嚴重等級圓餅圖、風險趨勢折線圖、NIST CSF 合規率、活動時間線 |
| **Vulnerability Scan** | Nessus CSV / NVD JSON 上傳、EPSS/VPR 四象限風險矩陣、Diff 差異比對、IP 群組篩選、弱點清單與 Diff 結果 CSV 匯出 |
| **NIST Audit** | Nessus Audit CSV 上傳、PASSED/FAILED 結果檢視、版本 Diff 比對、通過率趨勢圖 |

---

## 系統架構

### Demo 模式（純前端）

```
瀏覽器
└── index.html（CDN 載入 React 18、Babel、Chart.js）
    ├── mock-api.js      ← MockAPI：內建示範資料，完整模擬所有 API
    ├── api-client.js    ← APIClient：JWT fetch wrapper（Demo 時路由至 MockAPI）
    ├── components.jsx   ← 共用 UI 元件庫（StatCard、DataTable、FileUpload…）
    ├── app.jsx          ← App shell：Auth 狀態、Sidebar、路由
    └── pages/
        ├── Login.jsx    ← JWT 登入 / Demo 模式切換
        ├── Dashboard.jsx
        ├── VulnScan.jsx ← EPSS/VPR 四象限圖、CSV 上傳與匯出
        └── NIST.jsx     ← Audit CSV 上傳、版本比對、趨勢圖
```

### 生產模式（後端資料庫版）

```
使用者瀏覽器（HTTPS）
        │
        ▼
┌──────────────────────────────┐
│   Nginx（反向代理）           │
│   /         → 靜態前端        │
│   /api/*    → FastAPI         │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│   FastAPI（Python 3.11+）    │
│   Uvicorn · 2 workers        │
│                              │
│   /api/auth/token  JWT 登入  │
│   /api/scans       弱點掃描  │
│   /api/nist        Audit     │
│   /api/ipgroups    IP 群組   │
│   /api/dashboard   統計摘要  │
│   /api/docs        Swagger   │
└──────┬───────────────────────┘
       │ SQLAlchemy 2.0 ORM
       ▼
┌──────────────────────────────┐
│   PostgreSQL 16              │
│   scans · vulnerabilities    │
│   audit_scans · audit_results│
│   ip_groups · users          │
└──────────────────────────────┘
```

---

## 檔案結構

```
NES/
├── index.html              # 入口：全域樣式（OKLch 色彩系統）、CDN 載入
├── api-client.js           # JWT Bearer fetch wrapper（單例）
├── mock-api.js             # Demo 模式：完整模擬 API + 豐富示範資料
├── components.jsx          # 共用 UI 元件庫
├── app.jsx                 # App shell：Auth、Sidebar、路由
├── pages/
│   ├── Login.jsx           # JWT 登入頁 + Demo 模式
│   ├── Dashboard.jsx       # KPI 儀表板
│   ├── VulnScan.jsx        # 弱點掃描（含 CSV 匯出）
│   └── NIST.jsx            # NIST Audit 稽核
├── backend/
│   ├── main.py             # FastAPI 應用程式入口
│   ├── config.py           # Pydantic Settings（讀取 .env）
│   ├── database.py         # SQLAlchemy 引擎 + Session
│   ├── requirements.txt    # Python 依賴
│   ├── .env.example        # 環境變數範本
│   ├── alembic.ini         # 資料庫 Migration 設定
│   ├── alembic/versions/   # Migration 版本
│   ├── models/             # SQLAlchemy ORM 模型
│   │   ├── scan.py         # Scan + Vulnerability
│   │   ├── audit.py        # AuditScan + AuditResult
│   │   ├── ipgroup.py      # IPGroup
│   │   └── user.py         # User（admin/analyst/viewer）
│   ├── routers/            # FastAPI 路由
│   │   ├── auth.py         # JWT 登入、註冊、/me
│   │   ├── scans.py        # 掃描 CRUD + 上傳 + Diff
│   │   ├── nist.py         # Audit CRUD + 上傳 + Diff + Trend
│   │   ├── ipgroups.py     # IP 群組 CRUD
│   │   └── dashboard.py    # 統計摘要
│   ├── schemas/            # Pydantic v2 輸入/輸出模型
│   └── services/
│       ├── nessus_parser.py # 解析 Nessus CSV（欄位別名、風險正規化）
│       ├── cve_parser.py    # 解析 NVD JSON CVE 資料
│       ├── audit_parser.py  # 解析 Nessus Audit CSV
│       ├── epss_service.py  # 非同步取得 EPSS 分數（FIRST.org）
│       └── diff_service.py  # 計算 Scan / Audit Diff
└── deploy/
    ├── install.sh          # Ubuntu 自動部署腳本（一鍵安裝）
    ├── nginx.conf          # Nginx 反向代理設定
    └── secvision.service   # systemd 服務設定
```

---

## 認證機制

應用程式啟動時檢查 `sessionStorage` 中的 JWT token：

| 狀態 | 行為 |
|------|------|
| 有 token | 直接進入主畫面 |
| 無 token | 顯示登入頁 |

登入頁支援兩種模式：

| 模式 | 說明 |
|------|------|
| 帳號密碼登入 | `POST /api/auth/token` → JWT 存入 `sessionStorage` |
| Demo 模式 | 設定 `__demo__` 旗標，所有資料由 MockAPI 本地提供 |

### 使用者角色

| 角色 | 權限 |
|------|------|
| `admin` | 完整存取，可新增使用者 |
| `analyst` | 可上傳掃描、刪除記錄 |
| `viewer` | 唯讀，無法上傳或刪除 |

---

## 資料庫 Schema

| 資料表 | 說明 |
|--------|------|
| `scans` | 掃描記錄（名稱、來源、日期、主機數、弱點數） |
| `vulnerabilities` | 弱點明細（CVE、風險、EPSS、CVSS、主機、描述） |
| `audit_scans` | Audit 掃描記錄（名稱、日期、通過/失敗統計） |
| `audit_results` | Audit 逐項結果（名稱、狀態、政策值、實際值） |
| `ip_groups` | IP 群組（名稱、IP 清單 JSON） |
| `users` | 使用者（帳號、雜湊密碼、角色） |

---

## 快速啟動

### Demo 模式（無需任何安裝）

```bash
# 以任意 HTTP 伺服器提供靜態檔案
python3 -m http.server 8080
# 或
npx serve .
```

開啟 `http://localhost:8080`，點選「Demo 模式」即可體驗完整功能。

### 本地開發（搭配後端）

```bash
# 1. 進入後端目錄
cd backend/

# 2. 建立虛擬環境並安裝依賴
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. 複製環境變數設定
cp .env.example .env
# 編輯 .env 填入正確的資料庫連線字串與 SECRET_KEY

# 4. 執行資料庫 Migration
alembic upgrade head

# 5. 啟動後端（開發模式，SQLite 預設）
uvicorn main:app --reload --port 8000

# 6. 開另一個終端，啟動前端
cd ..
python3 -m http.server 3000

# 開啟 http://localhost:3000
# 後端 API 文件：http://localhost:8000/api/docs
```

> **開發模式預設使用 SQLite**（無需安裝 PostgreSQL），資料庫檔案儲存於 `backend/secvision.db`。

---

## 生產環境部署

### 方法一：自動化腳本（推薦）

適用於 **Ubuntu 22.04 / 24.04** 全新伺服器。

```bash
# 從專案根目錄執行
sudo bash deploy/install.sh
```

腳本執行步驟：
1. 安裝系統套件（Python 3.11、PostgreSQL、Nginx）
2. 建立 PostgreSQL 使用者與資料庫
3. 建立系統使用者 `secvision`
4. 部署後端至 `/opt/secvision/`
5. **自動產生隨機 SECRET_KEY 並建立 `.env`**
6. 執行 Alembic Migration
7. **建立初始管理員帳號**（`admin / admin`）
8. 部署前端至 `/var/www/secvision/`
9. 安裝 systemd 服務（自動重啟）
10. 設定 Nginx 反向代理（移除預設站台）

```
完成後：
  前端：    http://<server-ip>
  API 文件：http://<server-ip>/api/docs
  預設帳號：admin / admin（請立即修改）
```

**自訂資料庫密碼：**
```bash
sudo DB_PASS=your_strong_password bash deploy/install.sh
```

---

### 方法二：手動安裝

#### 前置需求

- Ubuntu 22.04 / 24.04（或相容 Linux 發行版）
- Python 3.11+
- PostgreSQL 14+（或使用 SQLite 進行開發）
- Nginx

#### 步驟 1 — 安裝系統套件

```bash
sudo apt-get update
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev \
    postgresql nginx
```

#### 步驟 2 — 設定 PostgreSQL

```bash
# 切換至 postgres 使用者
sudo -u postgres psql

-- 在 psql 中執行：
CREATE USER secvision WITH PASSWORD 'your_password';
CREATE DATABASE secvision OWNER secvision;
\q
```

#### 步驟 3 — 建立系統使用者

```bash
sudo useradd -r -s /bin/false -d /opt/secvision secvision
```

#### 步驟 4 — 部署後端

```bash
# 複製後端檔案
sudo mkdir -p /opt/secvision
sudo cp -r backend/ /opt/secvision/

# 建立 Python 虛擬環境
sudo python3.11 -m venv /opt/secvision/venv

# 安裝依賴
sudo /opt/secvision/venv/bin/pip install -r /opt/secvision/backend/requirements.txt
```

#### 步驟 5 — 設定環境變數

```bash
sudo nano /opt/secvision/backend/.env
```

填入以下內容（替換實際值）：

```dotenv
DATABASE_URL=postgresql://secvision:your_password@localhost:5432/secvision
SECRET_KEY=your-random-secret-key-at-least-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

產生隨機 SECRET_KEY：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

設定檔案權限：

```bash
sudo chmod 600 /opt/secvision/backend/.env
sudo chown -R secvision:secvision /opt/secvision
```

#### 步驟 6 — 初始化資料庫

```bash
cd /opt/secvision/backend
sudo -u secvision /opt/secvision/venv/bin/alembic upgrade head
```

#### 步驟 7 — 建立管理員帳號

```bash
sudo -u secvision /opt/secvision/venv/bin/python3 - << 'EOF'
import sys; sys.path.insert(0, '/opt/secvision/backend')
from database import SessionLocal
from models.user import User
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=['bcrypt'], deprecated='auto')
db = SessionLocal()
db.add(User(username='admin', hashed_pw=pwd_ctx.hash('your_password'), role='admin'))
db.commit()
db.close()
print('管理員帳號已建立')
EOF
```

#### 步驟 8 — 設定 systemd 服務

```bash
sudo cp deploy/secvision.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now secvision

# 確認服務狀態
sudo systemctl status secvision
sudo journalctl -u secvision -f
```

#### 步驟 9 — 部署前端

```bash
sudo mkdir -p /var/www/secvision
sudo cp index.html app.jsx components.jsx mock-api.js api-client.js \
    /var/www/secvision/
sudo cp -r pages/ /var/www/secvision/
sudo chown -R www-data:www-data /var/www/secvision
```

#### 步驟 10 — 設定 Nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/secvision
sudo ln -sf /etc/nginx/sites-available/secvision \
    /etc/nginx/sites-enabled/secvision
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

#### （選用）啟用 HTTPS — Let's Encrypt

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Certbot 會自動修改 nginx.conf 加入 SSL 設定
sudo systemctl reload nginx
```

---

## 維運指令

```bash
# 查看後端服務狀態
sudo systemctl status secvision

# 查看即時日誌
sudo journalctl -u secvision -f

# 重啟後端
sudo systemctl restart secvision

# 更新部署（前端）
sudo cp index.html app.jsx components.jsx mock-api.js api-client.js /var/www/secvision/
sudo cp -r pages/ /var/www/secvision/

# 更新部署（後端）
sudo cp -r backend/ /opt/secvision/
cd /opt/secvision/backend && sudo -u secvision /opt/secvision/venv/bin/alembic upgrade head
sudo systemctl restart secvision

# 備份資料庫
sudo -u postgres pg_dump secvision > secvision_$(date +%Y%m%d).sql
```

---

## 技術棧

| 類別 | 技術 | 版本 |
|------|------|------|
| 前端框架 | React（CDN UMD） | 18 |
| JSX 編譯 | Babel Standalone | 7 |
| 圖表 | Chart.js | 4.4.0 |
| 字體 | IBM Plex Sans / Mono | Google Fonts |
| 後端框架 | FastAPI | 0.115.0 |
| ASGI 伺服器 | Uvicorn | 0.30.6 |
| ORM | SQLAlchemy | 2.0.35 |
| Migration | Alembic | 1.13.3 |
| 資料庫（生產） | PostgreSQL | 16 |
| 資料庫（開發） | SQLite | — |
| 認證 | JWT（python-jose，HS256） | 3.3.0 |
| 密碼雜湊 | passlib（bcrypt） | 1.7.4 |
| CSV 解析 | pandas | 2.2.3 |
| HTTP 客戶端 | httpx（非同步） | 0.27.2 |
| 資料驗證 | Pydantic v2 | 2.9.2 |
| 反向代理 | Nginx | — |
| 服務管理 | systemd | — |

---

## API 端點總覽

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| POST | `/api/auth/token` | JWT 登入 | 公開 |
| POST | `/api/auth/register` | 新增使用者 | admin |
| GET | `/api/auth/me` | 目前使用者資訊 | 任何 |
| GET | `/api/scans` | 列出所有掃描 | 任何 |
| GET | `/api/scans/{id}` | 掃描詳情（含弱點清單） | 任何 |
| POST | `/api/scans/upload` | 上傳 Nessus CSV / NVD JSON | admin/analyst |
| GET | `/api/scans/diff` | 兩版本 Diff | 任何 |
| DELETE | `/api/scans/{id}` | 刪除掃描 | admin/analyst |
| GET | `/api/nist/scans` | 列出 Audit 掃描 | 任何 |
| POST | `/api/nist/upload` | 上傳 Audit CSV | admin/analyst |
| GET | `/api/nist/diff` | Audit Diff | 任何 |
| GET | `/api/nist/trend` | 通過率趨勢 | 任何 |
| GET | `/api/dashboard` | 統計摘要 | 任何 |
| GET | `/api/ipgroups` | 列出 IP 群組 | 任何 |
| POST | `/api/ipgroups` | 新增 IP 群組 | 任何 |
| DELETE | `/api/ipgroups/{id}` | 刪除 IP 群組 | 任何 |

互動式 API 文件：`http://<server>/api/docs`

---

## 安全注意事項

- **部署後請立即修改**預設管理員密碼（`admin / admin`）
- **SECRET_KEY**：自動部署腳本已自動產生隨機金鑰；手動安裝請確保使用強度足夠的隨機字串
- **CORS**：目前設定為 `allow_origins=["*"]`，生產環境建議修改 `backend/main.py` 限縮至特定網域
- **HTTPS**：建議透過 Let's Encrypt 啟用 HTTPS（nginx.conf 已備有設定範本）
- **防火牆**：確保伺服器僅開放 80/443 埠，後端 8000 埠僅限本機存取

---

## 授權

Internal use only.
