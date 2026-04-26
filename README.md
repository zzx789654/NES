# SecVision — ISMS Security Portal

資訊安全管理系統（ISMS）整合平台，提供弱點掃描分析、NIST 合規稽核與 Dashboard 概覽。

## 功能總覽

| 頁面 | 功能 |
|------|------|
| **Dashboard** | 弱點嚴重等級圓餅圖、風險趨勢折線圖、NIST CSF 合規率、SP 800-53 摘要、活動時間線 |
| **Vulnerability Scan** | Nessus CSV 上傳、EPSS/VPR 四象限風險矩陣、Diff 差異比對、IP 群組多選篩選、IP 歷程追蹤、NVD CVE JSON 上傳 |
| **NIST** | Nessus Audit CSV 上傳、PASSED/FAILED 結果檢視、版本 Diff 比對、通過率趨勢圖 |

---

## 系統架構圖

### 現行架構（前端靜態版）

```
┌─────────────────────────────────────────────────────────┐
│                      瀏覽器                              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                  index.html                       │   │
│  │  全域 CSS 變數 / Dark-Light 主題 / CDN 載入        │   │
│  └──────┬───────────────────────────────────────────┘   │
│         │ 載入順序                                        │
│         ▼                                                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ mock-api.js │  │components.jsx│  │   app.jsx      │   │
│  │ MockAPI     │  │ 共用 UI 元件  │  │ Sidebar + 路由 │   │
│  │ singleton   │  │ ChartCanvas  │  │               │   │
│  │             │  │ DataTable    │  └──────┬────────┘   │
│  └──────┬──────┘  │ FileUpload…  │         │            │
│         │         └──────────────┘         │ 路由        │
│         │                          ┌───────┼───────┐    │
│         │                          ▼       ▼       ▼    │
│         │                    ┌─────────┐ ┌──────┐ ┌───┐ │
│         │◄───── MockAPI ────►│Dashboard│ │Vuln  │ │NIS│ │
│         │                    │  .jsx   │ │Scan  │ │T  │ │
│         │                    └─────────┘ │.jsx  │ │.jx│ │
│         │                               └──────┘ └───┘ │
│         ▼                                               │
│  ┌──────────────────┐                                   │
│  │   localStorage   │                                   │
│  │ IP Groups        │                                   │
│  │ ISO Records      │                                   │
│  │ OWASP Status     │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
         ▲
         │ CDN
┌────────┴─────────────────────────────────────────┐
│  React 18 · Babel Standalone · Chart.js 4.4.0    │
│  IBM Plex Sans/Mono (Google Fonts)                │
└──────────────────────────────────────────────────┘
```

### 目標架構（後端資料庫版）✅ 已實作

```
┌──────────────────────────────────────────────────────────────────┐
│                          使用者瀏覽器                              │
│                                                                   │
│   ┌──────────────────────────────────────────────────────────┐   │
│   │               前端（Static HTML / React）                  │   │
│   │   index.html · components.jsx · app.jsx                   │   │
│   │   pages/Dashboard.jsx · VulnScan.jsx · NIST.jsx           │   │
│   └─────────────────────────┬────────────────────────────────┘   │
└─────────────────────────────│────────────────────────────────────┘
                              │ HTTPS / REST API  +  JWT Bearer Token
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                   Ubuntu 24.04 / 22.04 Server                     │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                    Nginx（反向代理）                        │   │
│  │    /          → 靜態前端 (/var/www/secvision)               │   │
│  │    /api/*     → FastAPI backend (127.0.0.1:8000)           │   │
│  └──────────────────────────┬────────────────────────────────┘   │
│                             │                                     │
│  ┌──────────────────────────▼────────────────────────────────┐   │
│  │               FastAPI (Python 3.11+)  ·  Uvicorn           │   │
│  │                                                            │   │
│  │  POST /api/auth/token         — JWT 登入                   │   │
│  │  POST /api/auth/register      — 建立帳號                   │   │
│  │  GET  /api/auth/me            — 目前使用者資訊              │   │
│  │                                                            │   │
│  │  POST /api/scans/upload       — 上傳 Nessus CSV / NVD JSON │   │
│  │  GET  /api/scans              — 掃描清單                   │   │
│  │  GET  /api/scans/{id}         — 掃描詳情（含弱點列表）      │   │
│  │  DELETE /api/scans/{id}       — 刪除掃描                   │   │
│  │  GET  /api/scans/diff         — 版本 Diff 比對             │   │
│  │                                                            │   │
│  │  POST /api/nist/upload        — 上傳 Audit CSV             │   │
│  │  GET  /api/nist/scans         — Audit 掃描清單             │   │
│  │  GET  /api/nist/scans/{id}    — Audit 詳情                 │   │
│  │  DELETE /api/nist/scans/{id}  — 刪除 Audit 掃描            │   │
│  │  GET  /api/nist/diff          — Audit Diff 比對            │   │
│  │  GET  /api/nist/trend         — 通過率趨勢                  │   │
│  │                                                            │   │
│  │  GET  /api/dashboard          — 統計摘要                   │   │
│  │  GET  /api/ipgroups           — IP 群組 CRUD               │   │
│  │                                                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │   │
│  │  │  services/   │  │   models/    │  │    schemas/     │  │   │
│  │  │ nessus_parser│  │ Scan         │  │ Pydantic v2     │  │   │
│  │  │ cve_parser   │  │ Vulnerability│  │ request/resp    │  │   │
│  │  │ audit_parser │  │ AuditScan    │  │ models          │  │   │
│  │  │ epss_service │  │ AuditResult  │  └─────────────────┘  │   │
│  │  │ diff_service │  │ IPGroup      │                        │   │
│  │  └──────────────┘  │ User         │                        │   │
│  │                    └──────────────┘                        │   │
│  └──────────────────────────┬────────────────────────────────┘   │
│                             │ SQLAlchemy 2.0 ORM                  │
│  ┌──────────────────────────▼────────────────────────────────┐   │
│  │           PostgreSQL 16（生產） / SQLite（開發）             │   │
│  │                                                            │   │
│  │  scans · vulnerabilities · audit_scans · audit_results    │   │
│  │  ip_groups · users                                         │   │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│                             ▲ EPSS 查詢（上傳時自動呼叫）           │
│  ┌──────────────────────────┴────────────────────────────────┐   │
│  │           FIRST.org EPSS API (api.first.org)               │   │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 檔案結構

```
NES/
├── index.html              # 入口：全域樣式、CDN 載入
├── mock-api.js             # 模擬 REST API（含 EPSS/VPR 富化）
├── components.jsx          # 共用 UI 元件庫
├── app.jsx                 # App shell：Sidebar + 路由
├── pages/
│   ├── Dashboard.jsx       # Dashboard 頁
│   ├── VulnScan.jsx        # 弱點掃描頁
│   └── NIST.jsx            # NIST Audit 頁
├── backend/                # ✅ FastAPI 後端
│   ├── main.py             # FastAPI app 入口 + CORS
│   ├── config.py           # pydantic-settings（DATABASE_URL、SECRET_KEY）
│   ├── database.py         # SQLAlchemy engine + session
│   ├── requirements.txt    # Python 套件清單
│   ├── .env.example        # 環境變數範本
│   ├── alembic.ini         # Alembic 設定
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 0001_initial_schema.py
│   ├── models/
│   │   ├── scan.py         # Scan, Vulnerability
│   │   ├── audit.py        # AuditScan, AuditResult
│   │   ├── ipgroup.py      # IPGroup
│   │   └── user.py         # User
│   ├── schemas/
│   │   ├── scan.py         # ScanOut, ScanDetail, ScanDiff
│   │   ├── audit.py        # AuditScanOut, AuditDiff, AuditTrendPoint
│   │   ├── ipgroup.py      # IPGroupCreate/Update/Out
│   │   ├── auth.py         # Token, UserCreate, UserOut
│   │   └── dashboard.py    # DashboardSummary
│   ├── routers/
│   │   ├── auth.py         # /api/auth — JWT 登入、帳號管理
│   │   ├── scans.py        # /api/scans — 弱點掃描 CRUD + Diff
│   │   ├── nist.py         # /api/nist — Audit CRUD + Diff + Trend
│   │   ├── ipgroups.py     # /api/ipgroups — IP 群組 CRUD
│   │   └── dashboard.py    # /api/dashboard — 統計摘要
│   └── services/
│       ├── nessus_parser.py # Nessus CSV 解析
│       ├── cve_parser.py    # NVD JSON 解析（1.1 / 2.0 格式）
│       ├── audit_parser.py  # Audit CSV 解析
│       ├── epss_service.py  # FIRST.org EPSS 批次查詢
│       └── diff_service.py  # Scan / Audit Diff 計算
├── README.md
└── 待修改.md               # 待辦改善項目
```

---

## 本地執行

### 前端（靜態版，無須後端）

```bash
# Python 3
python3 -m http.server 8080

# Node.js（npx）
npx serve .
```

開啟瀏覽器至 `http://localhost:8080`

### 後端（FastAPI）

```bash
cd backend

# 1. 建立虛擬環境並安裝套件
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. 設定環境變數（開發用 SQLite 預設即可，無需修改）
cp .env.example .env

# 3. 啟動（開發模式，SQLite 自動建表）
uvicorn main:app --reload --port 8000
```

開啟瀏覽器至 `http://localhost:8000/docs` 可查看自動產生的 OpenAPI 互動文件。

#### 使用 PostgreSQL（生產）

```bash
# 修改 .env
DATABASE_URL=postgresql://secvision:changeme@localhost:5432/secvision

# 執行資料庫遷移
alembic upgrade head
```

---

## 部署（Ubuntu 24.04 / 22.04）

### Nginx 設定

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/secvision;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### systemd 服務

```ini
[Unit]
Description=SecVision FastAPI Backend
After=network.target postgresql.service

[Service]
User=secvision
WorkingDirectory=/opt/secvision/backend
ExecStart=/opt/secvision/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 技術棧

### 前端

| 類別 | 技術 |
|------|------|
| 框架 | React 18（CDN UMD） |
| JSX 編譯 | Babel Standalone |
| 圖表 | Chart.js 4.4.0 |
| 字體 | IBM Plex Sans / Mono |

### 後端

| 類別 | 技術 |
|------|------|
| API 框架 | FastAPI 0.115 + Uvicorn |
| ORM | SQLAlchemy 2.0 |
| 資料庫 | PostgreSQL 16（生產）/ SQLite（開發） |
| 認證 | JWT（python-jose + passlib bcrypt） |
| 資料驗證 | Pydantic v2 |
| 遷移 | Alembic |
| CSV 解析 | pandas |
| EPSS 查詢 | httpx（async，FIRST.org API） |

---

## 授權

Internal use only.
