# SecVision — ISMS Security Portal

資訊安全管理系統（ISMS）整合平台，提供弱點掃描分析、NIST 合規稽核與儀表板概覽。支援無後端 Demo 模式與完整 FastAPI + PostgreSQL 生產模式雙執行環境。

---

## 功能總覽

| 頁面 | 功能 |
|------|------|
| **Login** | JWT 帳密登入 / Demo 模式（無需後端） |
| **Dashboard** | 弱點嚴重等級圓餅圖、風險趨勢折線圖、NIST CSF 合規率、SP 800-53 摘要、活動時間線 |
| **Vulnerability Scan** | Nessus CSV 上傳、NVD CVE JSON 上傳、EPSS/VPR 四象限風險矩陣、Diff 差異比對、IP 群組篩選、IP 歷程追蹤、弱點清單 CSV 匯出、Diff 結果 CSV 匯出 |
| **NIST** | Nessus Audit CSV 上傳、PASSED/FAILED 結果檢視、版本 Diff 比對、通過率趨勢圖 |

---

## 系統架構

### 前端靜態模式（Demo / 無後端）

```
┌──────────────────────────────────────────────────────────┐
│                        瀏覽器                             │
│                                                           │
│  index.html  ←  全域 CSS 變數 / Dark-Light 主題           │
│      │                                                    │
│      ├── mock-api.js     MockAPI (Demo 資料 + EPSS/VPR)   │
│      ├── api-client.js   JWT Bearer fetch wrapper         │
│      ├── components.jsx  共用 UI 元件（DataTable 等）      │
│      └── app.jsx         Auth 狀態 / Sidebar / 路由        │
│              ├── pages/Login.jsx                          │
│              ├── pages/Dashboard.jsx                      │
│              ├── pages/VulnScan.jsx                       │
│              └── pages/NIST.jsx                           │
│                                                           │
│  持久化：localStorage（IP Groups）                        │
└──────────────────────────────────────────────────────────┘
         ▲  CDN
┌────────┴──────────────────────────────────────────────┐
│  React 18.3.1 · Babel Standalone 7.29.0               │
│  Chart.js 4.4.0 · IBM Plex Sans/Mono (Google Fonts)   │
└───────────────────────────────────────────────────────┘
```

### 生產模式（FastAPI + PostgreSQL）

```
瀏覽器
  │  HTTPS / REST（Bearer JWT）
  ▼
Nginx（反向代理）
  ├── /          →  靜態前端 /var/www/secvision
  └── /api/*     →  FastAPI :8000
                       │
                       ├── /api/auth/*      JWT 登入 / 使用者管理
                       ├── /api/scans/*     掃描 CRUD + 上傳 + Diff
                       ├── /api/nist/*      Audit CRUD + 上傳 + Diff
                       ├── /api/ipgroups/*  IP 群組 CRUD
                       └── /api/dashboard   統計摘要
                             │
                       SQLAlchemy 2.0 ORM
                             │
                       PostgreSQL 16（生產）/ SQLite（開發）
                         scans · vulnerabilities
                         audit_scans · audit_results
                         ip_groups · users
```

---

## 檔案結構

```
NES/
├── .gitignore
├── index.html                        # 入口：全域樣式、CDN 載入、script 順序
├── mock-api.js                       # Demo 用 MockAPI（含 EPSS/VPR 資料）
├── api-client.js                     # 真實 API 客戶端（JWT Bearer fetch wrapper）
├── components.jsx                    # 共用 UI 元件庫
├── app.jsx                           # App shell：Auth 狀態、Sidebar、路由
├── pages/
│   ├── Login.jsx                     # 登入頁（JWT / Demo 模式）
│   ├── Dashboard.jsx                 # Dashboard 頁
│   ├── VulnScan.jsx                  # 弱點掃描頁（含 CSV 匯出）
│   └── NIST.jsx                      # NIST Audit 頁
├── backend/
│   ├── main.py                       # FastAPI app + CORS middleware
│   ├── config.py                     # pydantic-settings（DATABASE_URL, SECRET_KEY）
│   ├── database.py                   # SQLAlchemy engine / SessionLocal
│   ├── requirements.txt              # Python 依賴（版本釘選）
│   ├── alembic.ini                   # Alembic 設定
│   ├── alembic/versions/
│   │   └── 0001_initial_schema.py    # 初始資料庫 Schema
│   ├── models/
│   │   ├── scan.py                   # Scan / Vulnerability ORM
│   │   ├── audit.py                  # AuditScan / AuditResult ORM
│   │   ├── ipgroup.py                # IPGroup ORM
│   │   └── user.py                   # User ORM
│   ├── routers/
│   │   ├── auth.py                   # /api/auth（login / register / me）
│   │   ├── scans.py                  # /api/scans
│   │   ├── nist.py                   # /api/nist
│   │   ├── ipgroups.py               # /api/ipgroups
│   │   └── dashboard.py              # /api/dashboard
│   ├── schemas/                      # Pydantic 請求 / 回應 schema
│   └── services/
│       ├── nessus_parser.py          # Nessus CSV 解析
│       ├── audit_parser.py           # Audit CSV 解析
│       ├── cve_parser.py             # NVD JSON 2.0 / 1.1 解析
│       ├── diff_service.py           # 弱點 / Audit diff 計算
│       └── epss_service.py           # FIRST.org EPSS API 富化
├── deploy/
│   ├── nginx.conf                    # Nginx 反向代理 + HTTPS + 安全標頭
│   ├── secvision.service             # systemd 服務定義
│   └── install.sh                    # Ubuntu 快速部署腳本
└── README.md
```

---

## 認證說明

應用程式啟動時檢查 `sessionStorage` 中是否存有 JWT token：

| 狀態 | 行為 |
|------|------|
| 有效 token | 直接進入主畫面 |
| 無 token | 跳轉至登入頁 |
| token 為 `__demo__` | Demo 模式，所有 API 呼叫由 MockAPI 攔截 |

登入頁提供兩種模式：

| 模式 | 流程 |
|------|------|
| 帳號密碼登入 | `POST /api/auth/token` → 取得 JWT → 存入 `sessionStorage` |
| Demo 模式 | 設定 `__demo__` 旗標，跳過後端，使用本地 MockAPI 資料 |

Token 過期（HTTP 401）時，前端自動清除 token 並派發 `secvision:unauthorized` 事件，觸發跳回登入頁。

### 使用者角色

| 角色 | 權限 |
|------|------|
| `admin` | 全部操作，含使用者管理 |
| `analyst` | 上傳掃描、讀取、刪除資料 |
| `viewer` | 唯讀 |

---

## 本地開發（無後端 / Demo 模式）

不需要任何 build 工具，直接以 HTTP 伺服器提供靜態檔案：

```bash
# Python 3
python3 -m http.server 8080

# Node.js
npx serve .
```

開啟瀏覽器至 `http://localhost:8080`，點選「Demo 模式」即可體驗完整功能。

---

## 後端開發（SQLite 本地執行）

```bash
cd backend

# 建立虛擬環境
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 初始化資料庫
alembic upgrade head

# 建立第一個管理員帳號
python3 - <<'EOF'
from database import SessionLocal
from models.user import User
from passlib.context import CryptContext
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
db = SessionLocal()
db.add(User(username="admin", hashed_pw=pwd.hash("your-password"), role="admin"))
db.commit(); db.close()
print("Admin user created.")
EOF

# 啟動後端（預設使用 SQLite ./secvision.db）
uvicorn main:app --reload --port 8000
```

API 文件可至 `http://localhost:8000/docs` 查閱（Swagger UI）。

---

## 生產環境部署（Ubuntu 24.04 / 22.04）

```bash
# 一鍵安裝（需 sudo；自動安裝依賴、建立 PostgreSQL 資料庫、設定 Nginx + systemd）
cd deploy/
sudo bash install.sh
```

部署完成後：

1. 編輯 `/opt/secvision/backend/.env`，設定正式的 `DATABASE_URL` 與 `SECRET_KEY`
2. 編輯 `deploy/nginx.conf`，將 `your-domain.com` 替換為實際網域
3. 申請 Let's Encrypt 憑證後，確認 `ssl_certificate` / `ssl_certificate_key` 路徑正確
4. 建立第一個管理員帳號（參考上方後端開發步驟）

### 環境變數（`.env`）

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `DATABASE_URL` | `sqlite:///./secvision.db` | 資料庫連線字串 |
| `SECRET_KEY` | `dev-secret-key-change-in-production` | JWT 簽名金鑰，**生產環境必須更換** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | Token 有效期（分鐘） |

---

## API 端點速覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| `POST` | `/api/auth/token` | 登入，取得 JWT |
| `GET` | `/api/auth/me` | 取得目前使用者資訊 |
| `POST` | `/api/auth/register` | 新增使用者（admin only） |
| `GET` | `/api/scans` | 掃描清單 |
| `POST` | `/api/scans/upload` | 上傳 Nessus CSV / NVD JSON |
| `GET` | `/api/scans/{id}` | 掃描詳情（含弱點列表） |
| `DELETE` | `/api/scans/{id}` | 刪除掃描 |
| `GET` | `/api/scans/diff?base=&comp=` | 兩次掃描 Diff |
| `GET` | `/api/nist/scans` | Audit 掃描清單 |
| `POST` | `/api/nist/upload` | 上傳 Audit CSV |
| `GET` | `/api/nist/diff?base=&comp=` | Audit Diff |
| `GET` | `/api/nist/trend` | 通過率趨勢 |
| `GET` | `/api/ipgroups` | IP 群組清單 |
| `POST` | `/api/ipgroups` | 新增 IP 群組 |
| `PUT` | `/api/ipgroups/{id}` | 更新 IP 群組 |
| `DELETE` | `/api/ipgroups/{id}` | 刪除 IP 群組 |
| `GET` | `/api/dashboard` | 統計摘要 |
| `GET` | `/health` | 健康檢查 |

---

## 技術棧

| 類別 | 技術 / 版本 |
|------|------------|
| 前端框架 | React 18.3.1（CDN UMD） |
| JSX 編譯 | Babel Standalone 7.29.0 |
| 圖表 | Chart.js 4.4.0 |
| 字體 | IBM Plex Sans / Mono（Google Fonts） |
| 後端框架 | FastAPI 0.115.0 |
| ASGI 伺服器 | Uvicorn 0.30.6 |
| ORM | SQLAlchemy 2.0.35 |
| 資料庫遷移 | Alembic 1.13.3 |
| 資料庫（生產） | PostgreSQL 16 |
| 資料庫（開發） | SQLite（無需額外安裝） |
| 認證 | JWT via python-jose 3.3.0 |
| 密碼雜湊 | passlib 1.7.4 + bcrypt 4.0.1 |
| 資料驗證 | Pydantic 2.9.2 + pydantic-settings 2.5.2 |
| CSV 解析 | pandas 2.2.3 |
| HTTP 客戶端（EPSS） | httpx 0.27.2 |
| 反向代理 | Nginx |
| 服務管理 | systemd |

---

## QA 修復記錄

### 第一輪（2026-04-27）

| # | 嚴重度 | 檔案 | 問題 | 修復 |
|---|--------|------|------|------|
| 1 | 🔴 高 | `backend/main.py` | `allow_credentials=True` + `allow_origins=["*"]` 同時使用違反 CORS 規範，新版 Starlette 啟動時直接拋出 `ValueError` | 改為 `allow_credentials=False`；Bearer Token 以 `Authorization` header 傳送無需 credential 模式 |
| 2 | 🟡 中 | `api-client.js` | `uploadScan()` / `uploadAudit()` 收到 HTTP 401 時未清除 Token、未派發 `secvision:unauthorized` 事件，JWT 過期後上傳失敗頁面不自動跳回登入頁 | 補充 401 分支：清除 `sessionStorage` token 並派發未授權事件 |
| 3 | 🟡 中 | `mock-api.js` | CVE-2022-42889（CVSS 9.8）標記為 `Medium`；CVE-2017-7494（CVSS 9.8）標記為 `High`。CVSS ≥ 9.0 應為 Critical，共 4 筆錯誤，導致風險矩陣與優先修補清單失準 | 將 4 筆資料的 `risk` 更正為 `'Critical'` |
| 4 | 🟡 中 | `pages/VulnScan.jsx` | 優先修補清單 VPR 欄位未防護 `null`，`parseFloat(null).toFixed(1)` 輸出 `"NaN"` 顯示於畫面 | 加入 `v != null` 判斷，`null` 時顯示 `—` |
| 5 | 🟢 低 | `backend/services/nessus_parser.py` | `g()` 每次疊代重新定義並透過閉包隱含捕獲 `row`；`_find_col()` 每次欄位存取都重新查找 | 迴圈前預建 `col_map`；`g()` 改用預設引數 `_row=row` 消除閉包隱患 |
| 5b | 🟢 低 | `backend/services/audit_parser.py` | 同上，`g()` 閉包捕獲 `row` | 同樣改為 `_row=row` 預設引數 |

### 第二輪（2026-04-28）

| # | 嚴重度 | 檔案 | 問題 | 修復 |
|---|--------|------|------|------|
| 1 | 🔴 高 | `deploy/nginx.conf` | 缺少 HTTP→HTTPS 強制跳轉；HTTPS block 完全被註解；無任何安全標頭（X-Frame-Options 等），ISMS 系統裸 HTTP 運行 | 新增 80 埠 301 重導向；啟用 HTTPS block；加入 `X-Frame-Options`、`X-Content-Type-Options`、`X-XSS-Protection`、`Referrer-Policy`、`HSTS` |
| 2 | 🔴 高 | `pages/Login.jsx` | 登入頁明文顯示預設憑證 `admin / admin`，攻擊者一眼可見初始帳密 | 改為「請聯繫系統管理員取得帳號資訊」，不在前端暴露任何憑證 |
| 3 | 🟡 中 | `backend/services/diff_service.py` | `_audit_key()` 以 `str(r.id)` 為回退；DB 自增 ID 跨掃描不同，匿名檢查項目永遠被誤判為「新增失敗」而非「持續失敗」 | 回退改為 `""`，使匿名項目能跨掃描正確比對 |
| 4 | 🟡 中 | `pages/VulnScan.jsx` | CVSS 欄位用 `\|\|` 回退，合法值 `0` 被視為 falsy 而顯示 `—` | 改用 `??`（nullish coalescing），僅 `null`/`undefined` 時顯示 `—` |
| 5 | 🟡 中 | `backend/services/cve_parser.py` | NVD synopsis 截斷至 300 字元未加 `…`，使用者無從得知內容被截斷 | 截斷後補上 `…` 省略號 |
| 6 | 🟢 低 | `backend/services/epss_service.py` | `except Exception: pass` 靜默吞掉所有 EPSS 錯誤，管理員無法診斷網路或限速問題 | 改為 `logger.warning(...)` 輸出 chunk index 與例外訊息 |
| 7 | 🟢 低 | `deploy/secvision.service` | `Restart=always` 無重啟次數上限，資料庫離線時觸發無限重啟風暴 | 改為 `Restart=on-failure`；加入 `StartLimitBurst=5` / `StartLimitIntervalSec=60` |

### 安裝測試（2026-04-28）

| # | 嚴重度 | 檔案 | 問題 | 修復 |
|---|--------|------|------|------|
| 8 | 🔴 高 | `backend/requirements.txt` | 未釘選 bcrypt 版本，pip 解析至 bcrypt 5.x；passlib 1.7.4 依賴 `bcrypt.__about__.__version__`（4.1.0 起移除），導致所有密碼雜湊在執行期拋出 `AttributeError`，認證系統完全失效 | 加入 `bcrypt==4.0.1` 釘選相容版本 |

---

## 授權

Internal use only.
