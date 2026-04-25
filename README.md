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

### 目標架構（後端資料庫版）

```
┌─────────────────────────────────────────────────────────────────┐
│                         使用者瀏覽器                              │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              前端（Static HTML / React）                  │   │
│   │   index.html · components.jsx · pages/*.jsx              │   │
│   └──────────────────────┬──────────────────────────────────┘   │
└──────────────────────────│──────────────────────────────────────┘
                           │ HTTPS / REST API
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ubuntu 24.04 / 22.04 Server                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Nginx（反向代理）                        │   │
│  │   / → 靜態前端   /api/* → FastAPI backend                 │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │                                       │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │                 FastAPI (Python)                           │   │
│  │                                                           │   │
│  │  /api/scans      — 掃描記錄 CRUD                          │   │
│  │  /api/scans/upload — CSV/JSON 上傳解析                    │   │
│  │  /api/scans/diff   — 版本 Diff 計算                       │   │
│  │  /api/nist         — Audit 記錄 CRUD                      │   │
│  │  /api/dashboard    — 統計摘要                             │   │
│  │  /api/ipgroups     — IP 群組 CRUD                         │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │ SQLAlchemy ORM                        │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │              PostgreSQL / SQLite                          │   │
│  │                                                           │   │
│  │  scans · vulnerabilities · audit_results                 │   │
│  │  ip_groups · users · activity_log                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 檔案結構

```
NES/
├── index.html          # 入口：全域樣式、CDN 載入
├── mock-api.js         # 模擬 REST API（含 EPSS/VPR 富化）
├── components.jsx      # 共用 UI 元件庫
├── app.jsx             # App shell：Sidebar + 路由
├── pages/
│   ├── Dashboard.jsx   # Dashboard 頁
│   ├── VulnScan.jsx    # 弱點掃描頁
│   └── NIST.jsx        # NIST Audit 頁
├── README.md           # 本文件
└── 待修改.md           # 待辦改善項目
```

---

## 本地執行

不需要 build 工具，直接以任意 HTTP 伺服器提供靜態檔案即可：

```bash
# Python 3
python3 -m http.server 8080

# Node.js（npx）
npx serve .
```

開啟瀏覽器至 `http://localhost:8080`

---

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | React 18（CDN UMD） |
| JSX 編譯 | Babel Standalone |
| 圖表 | Chart.js 4.4.0 |
| 字體 | IBM Plex Sans / Mono |
| 持久化（現行） | localStorage |
| 持久化（目標） | FastAPI + PostgreSQL |

---

## 授權

Internal use only.
