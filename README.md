# SecVision — ISMS Security Portal

輕量化資訊安全管理平台，整合弱點掃描管理、NIST 稽核追蹤、風險矩陣分析與合規儀表板。
React 前端搭配 FastAPI 後端，支援 PostgreSQL（正式）與 SQLite（開發），部署於 Ubuntu + Nginx + systemd。

---

## 目錄

- [專案架構](#專案架構)
- [目錄結構](#目錄結構)
- [核心功能](#核心功能)
- [技術棧](#技術棧)
- [API 路由總覽](#api-路由總覽)
- [開發環境安裝](#開發環境安裝)
- [正式環境部署](#正式環境部署)
- [資料格式說明](#資料格式說明)
- [角色權限](#角色權限)
- [測試](#測試)
- [常見問題](#常見問題)

---

## 專案架構

```
瀏覽器 (React SPA)
  │  JWT Bearer Token
  ▼
Nginx :80
  ├── /         → 靜態前端 (/var/www/secvision)
  └── /api/     → FastAPI :8000 (反向代理)
                    │
                    ├── routers/auth.py       JWT 登入 / 使用者管理
                    ├── routers/dashboard.py  儀表板統計
                    ├── routers/scans.py      弱點掃描 CRUD + Diff
                    ├── routers/nist.py       NIST 稽核 CRUD + Diff + 趨勢
                    └── routers/ipgroups.py   IP 群組管理
                              │
                    SQLAlchemy 2.0 ORM
                              │
                    PostgreSQL (正式) / SQLite (開發)
```

### 前端頁面流程

```
index.html  (載入 React / Chart.js / Babel CDN)
  │
  ├── api-client.js     統一 API 封裝，JWT 自動附加
  ├── components.jsx    19 個共用 UI 元件
  │
  └── app.jsx           App Shell + Sidebar + 路由
        ├── pages/Login.jsx      JWT 登入
        ├── pages/Dashboard.jsx  儀表板
        ├── pages/VulnScan.jsx   弱點掃描管理（4 分頁）
        └── pages/NIST.jsx       NIST 稽核管理（2 分頁）
```

---

## 目錄結構

```
NES/
├── index.html                  前端入口，CDN 依賴與 CSS 變數
├── app.jsx                     App Shell、Sidebar、路由
├── api-client.js               JWT fetch 封裝，全端點對應
├── components.jsx              共用 UI 元件庫（19 個元件）
│
├── pages/
│   ├── Login.jsx               登入表單
│   ├── Dashboard.jsx           儀表板：KPI 卡片 + 分佈圓餅圖
│   ├── VulnScan.jsx            弱點掃描：清單 / 矩陣 / Diff / 上傳
│   └── NIST.jsx                NIST 稽核：清單 / Diff
│
├── backend/
│   ├── main.py                 FastAPI 入口，CORS，掛載 Router
│   ├── config.py               環境設定（DATABASE_URL, SECRET_KEY）
│   ├── database.py             SQLAlchemy Engine + Session + Base
│   ├── requirements.txt        Python 套件清單
│   ├── alembic.ini             Alembic 設定
│   ├── .env.example            環境變數範本
│   │
│   ├── models/
│   │   ├── user.py             User（id, username, hashed_pw, role）
│   │   ├── scan.py             Scan + Vulnerability（50+ 欄位）
│   │   ├── audit.py            AuditScan + AuditResult
│   │   └── ipgroup.py          IPGroup（name, ips JSON）
│   │
│   ├── routers/
│   │   ├── auth.py             /api/auth/*
│   │   ├── dashboard.py        /api/dashboard
│   │   ├── scans.py            /api/scans/*
│   │   ├── nist.py             /api/nist/*
│   │   └── ipgroups.py         /api/ipgroups/*
│   │
│   ├── schemas/
│   │   ├── auth.py             Token, UserCreate, UserOut
│   │   ├── scan.py             VulnerabilityOut, ScanOut, ScanDetail, ScanDiff, HostHistory
│   │   ├── audit.py            AuditScanOut, AuditScanDetail, AuditDiff, AuditTrendPoint
│   │   ├── dashboard.py        RiskSummary, NistSummary, DashboardSummary
│   │   └── ipgroup.py          IPGroupCreate, IPGroupOut
│   │
│   ├── services/
│   │   ├── nessus_parser.py    Nessus CSV 解析（50+ 欄位 alias 對應）
│   │   ├── cve_parser.py       NVD JSON 解析（CVE API 2.0）
│   │   ├── audit_parser.py     Audit CSV 解析
│   │   ├── diff_service.py     掃描 / 稽核 Diff 計算
│   │   └── epss_service.py     非同步 EPSS 查詢（FIRST.org API）
│   │
│   ├── alembic/
│   │   ├── env.py              支援 DATABASE_URL 環境變數覆蓋
│   │   └── versions/
│   │       ├── 0001_initial_schema.py      建立 6 張資料表
│   │       └── 0002_extend_vulnerabilities.py  補齊 CVSS v2/v3/v4 + 新欄位
│   │
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_dashboard.py
│       ├── test_ipgroups.py
│       ├── test_nist.py
│       ├── test_services.py
│       └── test_nessus_fields.py
│
└── deploy/
    ├── install.sh              一鍵部署腳本（Ubuntu 22.04 / 24.04）
    ├── redeploy-backend.sh     更新程式碼 + 執行 Migration + 重啟服務
    ├── create-admin.sh         建立 / 重置管理員帳號
    ├── nginx.conf              Nginx 反向代理設定
    └── secvision.service       systemd 服務單元
```

---

## 核心功能

### 儀表板（Dashboard）

| 功能 | 說明 |
|------|------|
| KPI 卡片 | 弱點總數、Critical 數量、NIST 合規率、最近掃描日期 |
| 風險分佈圓餅圖 | Critical / High / Medium / Low / Info 比例 |
| 快速導覽 | 跳至弱點掃描或 NIST 稽核頁面 |

### 弱點掃描（VulnScan）

| 分頁 | 功能 |
|------|------|
| 掃描結果 | 選擇掃描批次、嚴重度篩選、全文搜尋（IP / 名稱 / CVE）、欄位顯示切換 |
| 掃描結果 | IP 群組管理（建立、儲存、快速篩選）、主機歷程時間軸 |
| 掃描結果 | 弱點詳情 Modal（名稱、CVE、CVSS/EPSS/VPR、描述、解決方案、Plugin Output）|
| 風險矩陣 | EPSS vs CVSS 四象限圖、VPR vs CVSS 四象限圖、優先修補清單 |
| Diff 比較 | 選擇基準與比較批次，顯示新增 / 持續 / 已解決弱點，顏色區分 |
| 上傳管理 | 拖放或點擊上傳 Nessus CSV / NVD JSON，自動查詢 EPSS 分數 |

**弱點資料欄位（共 50+ 欄）**

```
識別：Plugin ID, CVE, Risk, Risk Factor, STIG Severity
位置：Host, Port, Protocol
評分：CVSS v2/v3/v4 Base, Temporal, Threat Score; EPSS; VPR
描述：Name, Synopsis, Description, Solution, Plugin Output, See Also
參考：BID, XREF, MSKB
日期：Plugin Publication Date, Plugin Modification Date
利用：Metasploit, Core Impact, Canvas（布林值）
```

### NIST 稽核（NIST）

| 分頁 | 功能 |
|------|------|
| 稽核清單 | 稽核批次列表（名稱、上傳日期、通過率）+ 詳細結果表格 |
| Diff 比較 | 新增失敗項目 / 已解決 / 持續失敗，逐項比對 |
| 趨勢 | 合規率隨時間變化折線圖（`/api/nist/trend`）|

### IP 群組管理

- 從弱點列表勾選多個 IP，一鍵儲存為命名群組
- 下次可直接套用群組快速篩選
- 支援新增、查詢、更新、刪除

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端框架 | React 18.3.1（UMD CDN，無需 Node.js build）|
| JSX 編譯 | Babel Standalone 7.29.0（瀏覽器即時編譯）|
| 圖表 | Chart.js 4.4.0 |
| 字型 | IBM Plex Sans + IBM Plex Mono（Google Fonts）|
| 後端框架 | FastAPI 0.115 + Uvicorn 0.30 |
| ORM | SQLAlchemy 2.0（Typed Mapped Columns）|
| 資料庫 | PostgreSQL 14+（正式）/ SQLite（開發）|
| Migration | Alembic 1.13 |
| 認證 | JWT（python-jose）+ pbkdf2_sha256（passlib）|
| CSV 解析 | pandas 2.2 |
| HTTP 用戶端 | httpx 0.27（非同步 EPSS 查詢）|
| 資料驗證 | Pydantic 2.9 + pydantic-settings |
| 反向代理 | Nginx |
| 程序管理 | systemd |
| 測試 | pytest |

---

## API 路由總覽

### 認證

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| POST | `/api/auth/token` | JWT 登入（OAuth2 form）| 所有人 |
| POST | `/api/auth/register` | 建立使用者 | admin |
| GET  | `/api/auth/me` | 查詢目前使用者 | 所有已登入 |

### 儀表板

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| GET | `/api/dashboard` | 最新掃描風險統計 + NIST 合規率 | 所有已登入 |

### 弱點掃描

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| GET    | `/api/scans` | 掃描清單（依日期排序）| 所有已登入 |
| GET    | `/api/scans/{id}` | 掃描詳情 + 弱點列表 | 所有已登入 |
| POST   | `/api/scans/upload` | 上傳 CSV / JSON（自動 EPSS 查詢）| admin, analyst |
| DELETE | `/api/scans/{id}` | 刪除掃描批次 | admin, analyst |
| GET    | `/api/scans/diff?base={id}&comp={id}` | 兩批次差異（new / resolved / persistent）| 所有已登入 |
| GET    | `/api/scans/hosts/{host}/history` | 指定主機的歷次掃描時間軸 | 所有已登入 |

### NIST 稽核

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| GET    | `/api/nist/scans` | 稽核批次清單 | 所有已登入 |
| GET    | `/api/nist/scans/{id}` | 稽核詳情 + 結果列表 | 所有已登入 |
| POST   | `/api/nist/upload` | 上傳 Audit CSV | admin, analyst |
| DELETE | `/api/nist/scans/{id}` | 刪除稽核批次 | admin, analyst |
| GET    | `/api/nist/diff?base={id}&comp={id}` | 兩批次差異 | 所有已登入 |
| GET    | `/api/nist/trend` | 合規率趨勢（依日期排序）| 所有已登入 |

### IP 群組

| 方法 | 路徑 | 說明 | 角色 |
|------|------|------|------|
| GET    | `/api/ipgroups` | IP 群組清單 | 所有已登入 |
| POST   | `/api/ipgroups` | 建立 IP 群組 | admin, analyst |
| PUT    | `/api/ipgroups/{id}` | 更新 IP 群組 | admin, analyst |
| DELETE | `/api/ipgroups/{id}` | 刪除 IP 群組 | admin, analyst |

### 系統

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/` | 服務資訊（名稱、版本、文件連結）|
| GET | `/health` | 健康檢查 |
| GET | `/docs` | FastAPI Swagger UI |

---

## 開發環境安裝

### 前置需求

- Python 3.12+
- （可選）PostgreSQL 14+，或直接使用 SQLite

### 步驟 1：建立虛擬環境並安裝套件

```powershell
# 在專案根目錄建立 venv
cd c:\GIT\NES\NES
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 安裝後端套件
pip install -r backend\requirements.txt
```

### 步驟 2：設定環境變數

```powershell
# 複製範本
copy backend\.env.example backend\.env
```

編輯 `backend\.env`：

```env
# 開發使用 SQLite（無需安裝 PostgreSQL）
DATABASE_URL=sqlite:///./secvision.db

# 正式環境改為 PostgreSQL
# DATABASE_URL=postgresql://secvision:yourpassword@localhost:5432/secvision

# 務必更改為隨機字串
SECRET_KEY=change-this-to-a-random-secret-key-in-production

# Token 有效期（分鐘）
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

### 步驟 3：執行資料庫 Migration

```powershell
cd backend
..\..\.venv\Scripts\python.exe -m alembic upgrade head
# 或在 Windows PowerShell 中
cd c:\GIT\NES\NES\backend
alembic upgrade head
```

### 步驟 4：建立管理員帳號

```powershell
# Windows（直接用 Python）
cd c:\GIT\NES\NES\backend
..\..\.venv\Scripts\python.exe -c "
from database import engine, Base
from models.user import User
from routers.auth import hash_password
from sqlalchemy.orm import Session
Base.metadata.create_all(bind=engine)
with Session(engine) as db:
    if not db.query(User).filter_by(username='admin').first():
        db.add(User(username='admin', hashed_pw=hash_password('Admin@123456'), role='admin'))
        db.commit()
        print('Admin user created')
    else:
        print('Admin user already exists')
"
```

### 步驟 5：啟動後端

```powershell
cd c:\GIT\NES\NES\backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 步驟 6：啟動前端（開發用靜態伺服器）

```powershell
cd c:\GIT\NES\NES
python -m http.server 5500
```

### 步驟 7：開啟瀏覽器

| 服務 | URL |
|------|-----|
| 前端 SPA | `http://localhost:5500` |
| API 文件（Swagger）| `http://localhost:8000/docs` |
| 健康檢查 | `http://localhost:8000/health` |

> **注意**：前端靜態伺服器（5500）發出的 `/api/*` 請求會遇到 CORS 問題。
> 開發時建議修改 `ALLOWED_ORIGINS=http://localhost:5500` 或用 Nginx 代理統一 port。

---

## 正式環境部署

適用 **Ubuntu 22.04 / 24.04**。

### 一鍵安裝

```bash
git clone <repo-url> /opt/secvision-src
cd /opt/secvision-src
bash deploy/install.sh --admin-pass "YourStrongPassword"
```

安裝腳本自動完成：

1. 安裝系統套件（Python 3.12、PostgreSQL、Nginx）
2. 建立 PostgreSQL 資料庫與使用者
3. 建立系統使用者 `secvision`
4. 安裝 Python venv 與 pip 套件
5. 執行 `alembic upgrade head`（建立所有資料表）
6. 建立預設管理員帳號
7. 部署前端靜態檔至 `/var/www/secvision`
8. 安裝並啟動 systemd 服務（`secvision.service`）
9. 設定 Nginx 站台並 reload
10. 驗證管理員登入是否成功

### 手動安裝步驟

```bash
# 1. 複製檔案
sudo mkdir -p /opt/secvision
sudo cp -r backend /opt/secvision/
sudo python3.12 -m venv /opt/secvision/venv
sudo /opt/secvision/venv/bin/pip install -r /opt/secvision/backend/requirements.txt

# 2. 設定環境變數
sudo nano /opt/secvision/backend/.env
# DATABASE_URL=postgresql://secvision:yourpass@localhost:5432/secvision
# SECRET_KEY=<random 64-char string>

# 3. 資料庫 Migration
cd /opt/secvision/backend
sudo -u secvision /opt/secvision/venv/bin/alembic upgrade head

# 4. 建立管理員
sudo bash deploy/create-admin.sh admin YourPassword admin

# 5. 安裝 systemd 服務
sudo cp deploy/secvision.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now secvision

# 6. 部署前端
sudo mkdir -p /var/www/secvision
sudo cp index.html app.jsx components.jsx api-client.js /var/www/secvision/
sudo cp -r pages /var/www/secvision/
sudo chown -R www-data:www-data /var/www/secvision

# 7. 設定 Nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/secvision
sudo ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### 更新部署（程式碼更新後）

```bash
cd /opt/secvision-src
git pull
sudo bash deploy/redeploy-backend.sh
```

`redeploy-backend.sh` 執行：

1. 同步最新後端程式碼至 `/opt/secvision/backend`
2. 同步最新前端檔至 `/var/www/secvision`
3. 更新 Nginx 設定
4. **執行 `alembic upgrade head`（自動套用新 migration）**
5. 重啟 `secvision` 服務與 Nginx
6. 驗證 `/health` 端點

### 查看後端 Log

```bash
sudo journalctl -u secvision -f
sudo journalctl -u secvision -n 100 --no-pager
```

### 服務管理

```bash
sudo systemctl status secvision
sudo systemctl restart secvision
sudo systemctl stop secvision
```

---

## 資料格式說明

### Nessus CSV 格式

上傳的 CSV 必須包含標題列，欄位名稱支援以下 alias（大小寫不敏感）：

| 欄位 | 接受的標題名稱 |
|------|--------------|
| plugin_id | Plugin ID, PluginID, plugin_id |
| cve | CVE, cve |
| risk | Risk, Severity, severity |
| host | Host, IP Address, ip, host |
| port | Port, port |
| protocol | Protocol, protocol |
| name | Name, Plugin Name, plugin_name |
| cvss_v3_base | CVSS v3.0 Base Score, CVSSv3, CVSS, cvss_v3_base |
| cvss_v2_base | CVSS v2.0 Base Score, CVSSv2 |
| cvss_v4_base | CVSS v4.0 Base Score, CVSSv4 |
| epss | EPSS Score, epss |
| vpr | VPR Score, vpr |
| synopsis | Synopsis, synopsis |
| description | Description, description |
| solution | Solution, solution |
| metasploit | Metasploit, metasploit（True/Yes/1/Enabled）|

### NVD JSON 格式

標準 NVD CVE API 2.0 格式（`https://services.nvd.nist.gov/rest/json/cves/2.0`）。

### Audit CSV 格式

| 欄位 | 說明 |
|------|------|
| check_name | 稽核檢查項目名稱 |
| status | PASSED / FAILED / WARNING |
| policy_val | 政策要求值 |
| actual_val | 實際系統值 |
| description | 說明（選填）|

---

## 角色權限

| 操作 | admin | analyst | viewer |
|------|:-----:|:-------:|:------:|
| 登入 / 查看所有資料 | ✅ | ✅ | ✅ |
| 上傳掃描 / 稽核 | ✅ | ✅ | ❌ |
| 刪除掃描 / 稽核 | ✅ | ✅ | ❌ |
| 建立 / 修改 IP 群組 | ✅ | ✅ | ❌ |
| 刪除 IP 群組 | ✅ | ✅ | ❌ |
| 建立使用者 | ✅ | ❌ | ❌ |

---

## 測試

```bash
# 進入後端目錄並啟動 venv
cd c:\GIT\NES\NES\backend    # Windows
cd /opt/secvision/backend    # Linux

# 執行全部測試
pytest tests/ -v

# 只執行特定模組
pytest tests/test_auth.py -v
pytest tests/test_scans.py -v
pytest tests/test_dashboard.py -v
pytest tests/test_nist.py -v
pytest tests/test_ipgroups.py -v
pytest tests/test_services.py -v
pytest tests/test_nessus_fields.py -v
```

測試使用 SQLite in-memory 資料庫，不需要 PostgreSQL。

---

## 常見問題

### HTTP 500 — `/api/dashboard` 或 `/api/scans/{id}`

**原因**：PostgreSQL 資料表 schema 落後，缺少 `vulnerabilities` 的新欄位（CVSS v2/v4、risk_factor 等）。

**解決**：在伺服器上執行：

```bash
cd /opt/secvision/backend
sudo -u secvision /opt/secvision/venv/bin/alembic upgrade head
sudo systemctl restart secvision
```

---

### HTTP 401 — 頁面初始化時出現

**原因**：前端在未登入狀態下呼叫需認證的 API。通常是 Token 過期或 sessionStorage 被清除。

**解決**：重新登入即可。若 Token 有效期太短，修改 `.env` 的 `ACCESS_TOKEN_EXPIRE_MINUTES`。

---

### 前端載入後畫面空白

**原因**：JSX 語法錯誤（Babel 編譯失敗）或 API 路徑錯誤。

**解決**：
1. 開啟瀏覽器 DevTools → Console，確認是否有 `SyntaxError`
2. 確認 Nginx 的 `/api/` 代理指向正確的 `http://127.0.0.1:8000`
3. 確認前端 `api-client.js` 使用相對路徑（`/api/...`）

---

### EPSS 分數顯示為空

**原因**：上傳時 FIRST.org EPSS API 無法連線（離線環境或防火牆）。

**行為**：EPSS 查詢為非同步 best-effort，失敗時靜默略過，其他欄位正常儲存。

---

### 前端顯示 「此掃描批次無主機資料」

**原因**：上傳的 CSV 中 Host 欄位為空，或欄位名稱與 alias 對應表不符。

**解決**：確認 CSV 標題列包含 `Host`、`IP Address` 或 `ip` 其中之一。

---

## 安全建議

- 部署後立即修改預設密碼（`Admin@123456`）
- 將 `.env` 中的 `SECRET_KEY` 換成長度 ≥ 64 字元的隨機字串
- 設定 `ALLOWED_ORIGINS` 為實際部署的 domain，避免使用 `*`
- 正式環境啟用 HTTPS（`nginx.conf` 內有 Let's Encrypt 設定範本）
- 定期備份 PostgreSQL 資料庫

---

## 授權

Internal use only.
