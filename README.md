# SecVision ISMS Portal

資訊安全管理系統（ISMS）入口網站，提供弱點掃描分析、NIST 合規稽核與安全儀表板。

---

## 目錄

- [功能概覽](#功能概覽)
- [系統架構](#系統架構)
- [技術棧](#技術棧)
- [專案結構](#專案結構)
- [快速開始（本地開發）](#快速開始本地開發)
- [手動安裝流程](#手動安裝流程)
- [生產環境部署](#生產環境部署)
- [API 文件](#api-文件)
- [使用者角色與權限](#使用者角色與權限)
- [資料庫 Schema](#資料庫-schema)
- [設定說明](#設定說明)
- [已知限制](#已知限制)

---

## 功能概覽

| 功能 | 說明 |
|------|------|
| **JWT 登入** | 帳號密碼驗證、三種角色（admin / analyst / viewer） |
| **Demo 模式** | 無需後端，使用 MockAPI 展示所有功能 |
| **Dashboard** | 弱點嚴重等級分佈、風險趨勢、NIST 合規率 |
| **Vulnerability Scan** | 上傳 Nessus CSV / NVD JSON、EPSS/VPR 風險矩陣、差異比對、IP 群組篩選 |
| **NIST Audit** | 上傳 Nessus Audit CSV、合規結果檢視、版本 Diff、趨勢圖表 |
| **IP 群組管理** | 建立 IP 篩選群組，快速過濾特定主機的弱點 |
| **CSV 匯出** | 弱點清單與 Diff 結果均可匯出 |

---

## 系統架構

### 生產環境架構

```
瀏覽器（HTTPS）
       │
       ▼
   Nginx（port 80/443）
   ├─ /          → 靜態前端（/var/www/secvision）
   └─ /api/*     → 反向代理至 FastAPI
       │
       ▼
  FastAPI + Uvicorn（127.0.0.1:8000，2 workers）
  systemd 管理，以 secvision 系統帳號執行
       │
       ▼
  PostgreSQL 16
  資料庫：secvision
```

### 本地開發架構

```
瀏覽器（http://localhost:8080）
       │
       ▼
靜態 HTTP Server（Python / Node）
前端 React 18（CDN，免 build）
       │
       ├─ Demo 模式：MockAPI + localStorage（不需後端）
       │
       └─ 正式模式：/api/* → http://localhost:8000
                             │
                             ▼
                    FastAPI（uvicorn --reload）
                             │
                             ▼
                    SQLite（開發）/ PostgreSQL（測試）
```

### 認證流程

```
1. 瀏覽器 POST /api/auth/token（username + password）
2. 後端驗證密碼（bcrypt）→ 回傳 JWT（HS256，8 小時）
3. 前端存入 sessionStorage，後續請求帶 Authorization: Bearer <token>
4. Token 過期或無效 → 觸發 secvision:unauthorized 事件 → 自動跳回登入頁
```

---

## 技術棧

### 前端

| 項目 | 版本 / 說明 |
|------|-------------|
| React | 18.3.1（UMD CDN，免 build） |
| Babel Standalone | 7.29.0（瀏覽器端 JSX 編譯） |
| Chart.js | 4.4.0（圖表） |
| IBM Plex Sans/Mono | Google Fonts |
| 狀態管理 | React Hooks（useState, useEffect, useMemo） |
| 樣式 | 內聯樣式 + CSS 變數（OKLch 色彩空間） |

### 後端

| 項目 | 版本 |
|------|------|
| Python | 3.11+ |
| FastAPI | 0.115.0 |
| Uvicorn | 0.30.6 |
| SQLAlchemy | 2.0.35 |
| Alembic | 1.13.3 |
| PostgreSQL driver | psycopg2-binary 2.9.9 |
| JWT | python-jose 3.3.0 |
| 密碼雜湊 | passlib[bcrypt] 1.7.4 |
| 資料處理 | pandas 2.2.3 |
| EPSS API | httpx 0.27.2 |
| 設定管理 | pydantic-settings 2.5.2 |

### 部署

| 項目 | 說明 |
|------|------|
| OS | Ubuntu 24.04 / 22.04 LTS |
| 反向代理 | Nginx |
| 程序管理 | systemd |
| 資料庫 | PostgreSQL 16 |

---

## 專案結構

```
NES/
├── index.html              # 前端主頁（CDN 載入 React、Chart.js）
├── app.jsx                 # App Shell：Sidebar、路由、認證狀態
├── components.jsx          # 共用 UI 元件（Card、DataTable、Btn 等）
├── api-client.js           # JWT 感知的 API 封裝層
├── mock-api.js             # Demo 模式用假資料（MockAPI）
│
├── pages/
│   ├── Login.jsx           # JWT 登入頁 + Demo 模式切換
│   ├── Dashboard.jsx       # 概覽：弱點分佈、趨勢、NIST 合規率
│   ├── VulnScan.jsx        # 弱點掃描：上傳、風險矩陣、Diff、IP 群組
│   └── NIST.jsx            # NIST 稽核：上傳、結果檢視、Diff、趨勢
│
├── backend/
│   ├── main.py             # FastAPI 應用程式進入點
│   ├── config.py           # 環境設定（pydantic-settings）
│   ├── database.py         # SQLAlchemy engine + session
│   ├── requirements.txt    # Python 相依套件
│   ├── .env.example        # 環境變數範本
│   ├── alembic.ini         # Alembic 設定
│   ├── alembic/
│   │   ├── env.py          # Alembic 遷移環境（自動讀取 DATABASE_URL）
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── models/             # SQLAlchemy ORM 模型
│   │   ├── user.py
│   │   ├── scan.py
│   │   ├── audit.py
│   │   └── ipgroup.py
│   ├── routers/            # FastAPI 路由
│   │   ├── auth.py         # /api/auth/*
│   │   ├── scans.py        # /api/scans/*
│   │   ├── nist.py         # /api/nist/*
│   │   ├── ipgroups.py     # /api/ipgroups/*
│   │   └── dashboard.py    # /api/dashboard
│   ├── schemas/            # Pydantic 請求/回應模型
│   │   ├── auth.py
│   │   ├── scan.py
│   │   ├── audit.py
│   │   ├── ipgroup.py
│   │   └── dashboard.py
│   └── services/           # 業務邏輯
│       ├── nessus_parser.py  # 解析 Nessus CSV（含 VPR Score）
│       ├── cve_parser.py     # 解析 NVD JSON
│       ├── audit_parser.py   # 解析 Nessus Audit CSV
│       ├── epss_service.py   # EPSS 評分查詢（FIRST.org API）
│       └── diff_service.py   # 掃描版本差異計算
│
├── deploy/
│   ├── install.sh          # Ubuntu 自動化部署腳本
│   ├── nginx.conf          # Nginx 反向代理設定
│   └── secvision.service   # systemd 服務設定
│
└── scripts/
    └── setup-dev.sh        # 本地開發環境快速設定
```

---

## 快速開始（本地開發）

### 方法一：自動化腳本（推薦）

```bash
git clone <repo-url>
cd NES

# 使用 SQLite（最快，無需安裝 PostgreSQL）
bash scripts/setup-dev.sh

# 使用 PostgreSQL（需先自行建立資料庫）
bash scripts/setup-dev.sh --with-postgres
```

腳本完成後依照畫面提示啟動前後端服務。

### 方法二：Demo 模式（完全不需後端）

```bash
# 任一 HTTP Server 皆可
python3 -m http.server 8080
# 或
npx serve .
```

開啟瀏覽器 `http://localhost:8080`，點擊「**Demo 模式（無需後端）**」按鈕即可體驗所有功能。

---

## 手動安裝流程

### 前置需求

- Python 3.11+
- （選用）PostgreSQL 16（使用 SQLite 則不需要）

### 步驟一：複製專案

```bash
git clone <repo-url>
cd NES
```

### 步驟二：建立 Python 虛擬環境

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 步驟三：設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`：

```dotenv
# SQLite（開發用，無需安裝 PostgreSQL）
DATABASE_URL=sqlite:///./secvision.db

# PostgreSQL（正式或測試環境）
# DATABASE_URL=postgresql://secvision:yourpassword@localhost:5432/secvision

SECRET_KEY=請替換為隨機字串（至少 32 字元）
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

產生隨機 SECRET_KEY：

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 步驟四：初始化資料庫

```bash
# 確保在 backend/ 目錄下，且虛擬環境已啟動
alembic upgrade head
```

### 步驟五：建立初始管理員帳號

```bash
python3 - <<'EOF'
from database import SessionLocal, Base, engine
from models.user import User
from passlib.context import CryptContext
Base.metadata.create_all(bind=engine)
db = SessionLocal()
if not db.query(User).filter(User.username == 'admin').first():
    hashed = CryptContext(schemes=['bcrypt'], deprecated='auto').hash('admin')
    db.add(User(username='admin', hashed_pw=hashed, role='admin'))
    db.commit()
    print('管理員帳號已建立：admin / admin')
db.close()
EOF
```

### 步驟六：啟動後端

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 步驟七：啟動前端

另開終端機，回到專案根目錄：

```bash
cd ..   # 回到 NES/
python3 -m http.server 8080
```

### 步驟八：確認服務

| 服務 | URL |
|------|-----|
| 前端 | http://localhost:8080 |
| API 文件（Swagger） | http://localhost:8000/api/docs |
| API 文件（ReDoc） | http://localhost:8000/api/redoc |
| 健康檢查 | http://localhost:8000/health |

登入帳號：`admin` / `admin`（開發用，請立即修改）

---

## 生產環境部署

### 自動化部署（Ubuntu 24.04 / 22.04）

```bash
git clone <repo-url>
cd NES

# 使用自動產生的隨機密碼
sudo bash deploy/install.sh

# 或自訂密碼
sudo bash deploy/install.sh --db-pass "強密碼" --admin-pass "管理員密碼"
```

腳本自動完成：

1. 安裝系統套件（Python 3.11、PostgreSQL、Nginx）
2. 建立 PostgreSQL 資料庫與使用者
3. 建立 `secvision` 系統帳號（無登入 Shell）
4. 部署後端至 `/opt/secvision/`
5. 自動產生隨機 `SECRET_KEY` 並寫入 `.env`（權限 600）
6. 執行 Alembic 資料庫遷移
7. 建立初始管理員帳號
8. 部署前端靜態檔案至 `/var/www/secvision/`
9. 安裝並啟動 systemd 服務
10. 設定 Nginx 反向代理

執行完成後螢幕會顯示管理員帳號與密碼，**請立即記錄並登入後修改**。

### 啟用 HTTPS（Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

取得憑證後，編輯 `/etc/nginx/sites-available/secvision`，取消 HTTPS 設定區塊的註解。

### 常用維運指令

```bash
# 查看服務狀態
sudo systemctl status secvision

# 查看即時日誌
sudo journalctl -u secvision -f

# 重啟後端
sudo systemctl restart secvision

# 更新部署（拉取新版本後）
sudo cp -r backend/* /opt/secvision/backend/
sudo /opt/secvision/venv/bin/pip install -q -r /opt/secvision/backend/requirements.txt
cd /opt/secvision/backend
sudo -u secvision /opt/secvision/venv/bin/alembic upgrade head
sudo systemctl restart secvision
```

### 備份資料庫

```bash
# 備份
sudo -u postgres pg_dump secvision > secvision_$(date +%Y%m%d).sql

# 還原
sudo -u postgres psql secvision < secvision_YYYYMMDD.sql
```

---

## API 文件

後端啟動後可透過以下 URL 查看互動式 API 文件：

- **Swagger UI**：`http://your-server/api/docs`
- **ReDoc**：`http://your-server/api/redoc`

### 端點一覽

#### 認證

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| POST | `/api/auth/token` | 登入取得 JWT | 公開 |
| GET | `/api/auth/me` | 取得目前使用者資訊 | 已登入 |
| POST | `/api/auth/register` | 新增使用者 | admin |

#### 弱點掃描

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/scans` | 列出所有掃描 | 已登入 |
| POST | `/api/scans/upload` | 上傳 Nessus CSV / NVD JSON | analyst+ |
| GET | `/api/scans/{id}` | 取得掃描詳情（含弱點清單） | 已登入 |
| DELETE | `/api/scans/{id}` | 刪除掃描 | analyst+ |
| GET | `/api/scans/diff?base=<id>&comp=<id>` | 比對兩次掃描 | 已登入 |

#### NIST 稽核

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/nist/scans` | 列出所有稽核 | 已登入 |
| POST | `/api/nist/upload` | 上傳 Nessus Audit CSV | analyst+ |
| GET | `/api/nist/scans/{id}` | 取得稽核詳情 | 已登入 |
| DELETE | `/api/nist/scans/{id}` | 刪除稽核 | analyst+ |
| GET | `/api/nist/diff?base=<id>&comp=<id>` | 比對兩次稽核 | 已登入 |
| GET | `/api/nist/trend` | 合規率趨勢 | 已登入 |

#### IP 群組

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/ipgroups` | 列出所有群組 | 已登入 |
| POST | `/api/ipgroups` | 新增群組 | analyst+ |
| PUT | `/api/ipgroups/{id}` | 更新群組 | analyst+ |
| DELETE | `/api/ipgroups/{id}` | 刪除群組 | analyst+ |

#### 儀表板

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/dashboard` | 彙整統計數據 | 已登入 |

---

## 使用者角色與權限

| 操作 | viewer | analyst | admin |
|------|--------|---------|-------|
| 查看儀表板 / 掃描 / 稽核 | ✅ | ✅ | ✅ |
| 上傳 / 刪除掃描與稽核 | ❌ | ✅ | ✅ |
| 管理 IP 群組 | ❌ | ✅ | ✅ |
| 新增使用者 | ❌ | ❌ | ✅ |

新增使用者範例（需 admin JWT）：

```bash
# 先取得 token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/token \
  -d "username=admin&password=admin" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 新增 analyst 帳號
curl -X POST http://localhost:8000/api/auth/register \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"StrongPass1!","role":"analyst"}'
```

---

## 資料庫 Schema

```
users
  id · username(UNIQUE) · hashed_pw · role · created_at

scans ──────────────────────────── 1:N ──► vulnerabilities
  id · name · source              id · scan_id(FK) · plugin_id
  scan_date · uploaded_at         cve · risk · host · port
  host_count · vuln_count         protocol · name · cvss
                                  epss · vpr · synopsis
                                  description · solution
                                  plugin_output

audit_scans ───────────────────── 1:N ──► audit_results
  id · name · scan_date           id · scan_id(FK) · check_name
  uploaded_at · total             status · description
  passed · failed · warning       policy_val · actual_val

ip_groups
  id · name(UNIQUE) · ips(JSON) · created_at
```

---

## 設定說明

### 環境變數（`backend/.env`）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./secvision.db` | 資料庫連線字串 |
| `SECRET_KEY` | `dev-secret-key-...` | JWT 簽名金鑰（**生產環境必須修改**） |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Token 有效時間（分鐘） |
| `ALLOWED_ORIGINS` | `*` | CORS 允許來源，逗號分隔；設定具體 origin 時自動啟用 Credentials |

### Nessus CSV 支援欄位

| Nessus 欄位名稱 | 存入欄位 |
|-----------------|---------|
| Plugin ID | plugin_id |
| CVE | cve |
| Risk / Severity | risk |
| Host / IP Address | host |
| Port | port |
| Protocol | protocol |
| Name / Plugin Name | name |
| CVSS v3.0 Base Score | cvss |
| VPR Score | vpr |
| Synopsis | synopsis |
| Description | description |
| Solution | solution |
| Plugin Output | plugin_output |

### Nessus Audit CSV 支援欄位

| Nessus 欄位名稱 | 存入欄位 |
|-----------------|---------|
| Check Name / Plugin Name | check_name |
| Status / Result | status（PASSED / FAILED / WARNING） |
| Description | description |
| Policy Value / Expected Value | policy_val |
| Actual Value | actual_val |

---

## 已知限制

| 項目 | 說明 |
|------|------|
| **前端頁面使用 MockAPI** | Dashboard、VulnScan、NIST 頁面目前以 MockAPI 渲染示範資料；Login 已接通真實後端 API。待後續版本將頁面切換至 `APIClient.*` 方法。 |
| **無 Docker 支援** | 尚未提供 Docker Compose 設定，計畫於後續版本新增。 |
| **無電子郵件通知** | 嚴重弱點告警尚未實作郵件發送功能。 |
| **無 PDF 匯出** | 報告 PDF 匯出功能尚未實作。 |
| **無自動化測試** | 目前未設置 pytest / Jest 測試套件。 |
| **EPSS 需要網路** | EPSS 分數需連線至 `api.first.org`；離線環境上傳後 EPSS 欄位將為空。 |
