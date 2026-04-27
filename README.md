# SecVision — ISMS Security Portal

資訊安全管理系統（ISMS）整合平台，提供弱點掃描分析、NIST 合規稽核與 Dashboard 概覽。

## 功能總覽

| 頁面 | 功能 |
|------|------|
| **Login** | JWT 登入驗證 / Demo 模式（無需後端） |
| **Dashboard** | 弱點嚴重等級圓餅圖、風險趨勢折線圖、NIST CSF 合規率、SP 800-53 摘要、活動時間線 |
| **Vulnerability Scan** | Nessus CSV 上傳、EPSS/VPR 四象限風險矩陣、Diff 差異比對、IP 群組多選篩選、IP 歷程追蹤、NVD CVE JSON 上傳、**弱點清單 CSV 匯出**、**Diff 結果 CSV 匯出** |
| **NIST** | Nessus Audit CSV 上傳、PASSED/FAILED 結果檢視、版本 Diff 比對、通過率趨勢圖 |

---

## 系統架構圖

### 現行架構（前端靜態版 + API Client 就緒）

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
│  ┌─────────────┐  ┌──────────────┐                       │
│  │ mock-api.js │  │api-client.js │  ← JWT fetch wrapper  │
│  │ MockAPI     │  │ APIClient    │    /api/* 真實呼叫     │
│  │ (Demo 資料)  │  │ singleton   │                       │
│  └─────────────┘  └──────────────┘                       │
│         │                                                │
│         ▼                                                │
│  ┌──────────────┐  ┌───────────────────────────────┐    │
│  │components.jsx│  │         app.jsx                │    │
│  │ 共用 UI 元件  │  │ Auth 狀態 / Sidebar / 路由     │    │
│  │ DataTable    │  └───────────────┬───────────────┘    │
│  │ FileUpload…  │         路由      │                    │
│  └──────────────┘   ┌─────────────┼──────────┐          │
│                     ▼             ▼          ▼           │
│              ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│              │Login.jsx │ │Dashboard │ │VulnScan  │ …   │
│              │(JWT 登入) │ │  .jsx    │ │  .jsx    │     │
│              └──────────┘ └──────────┘ └──────────┘     │
│                                                          │
│  ┌──────────────────┐                                   │
│  │   localStorage   │                                   │
│  │ IP Groups / ISO  │                                   │
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
│   │   index.html · api-client.js · components.jsx           │   │
│   │   pages/Login.jsx · pages/Dashboard.jsx · …             │   │
│   └──────────────────────┬──────────────────────────────────┘   │
└──────────────────────────│──────────────────────────────────────┘
                           │ HTTPS / REST API（Bearer JWT）
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
│  │                 FastAPI (Python 3.11+)                     │   │
│  │                                                           │   │
│  │  /api/auth/token   — JWT 登入                             │   │
│  │  /api/scans        — 掃描記錄 CRUD + 上傳 + Diff          │   │
│  │  /api/nist         — Audit 記錄 CRUD + 上傳 + Diff        │   │
│  │  /api/dashboard    — 統計摘要                             │   │
│  │  /api/ipgroups     — IP 群組 CRUD                         │   │
│  └───────────────────────┬──────────────────────────────────┘   │
│                          │ SQLAlchemy 2.0 ORM                    │
│  ┌───────────────────────▼──────────────────────────────────┐   │
│  │              PostgreSQL 16 / SQLite（開發）               │   │
│  │                                                           │   │
│  │  scans · vulnerabilities · audit_scans · audit_results   │   │
│  │  ip_groups · users                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 檔案結構

```
NES/
├── index.html              # 入口：全域樣式、CDN 載入、script 順序
├── mock-api.js             # 模擬 REST API（含 EPSS/VPR 富化）
├── api-client.js           # ★ 真實 API 客戶端（JWT Bearer fetch wrapper）
├── components.jsx          # 共用 UI 元件庫
├── app.jsx                 # App shell：Auth 狀態、Sidebar（含登出）、路由
├── pages/
│   ├── Login.jsx           # ★ 登入頁（JWT / Demo 模式）
│   ├── Dashboard.jsx       # Dashboard 頁
│   ├── VulnScan.jsx        # 弱點掃描頁（含 CSV 匯出）
│   └── NIST.jsx            # NIST Audit 頁
├── backend/                # FastAPI 後端（見 backend/README 或 待修改.md）
├── deploy/
│   ├── nginx.conf          # ★ Nginx 反向代理設定
│   ├── secvision.service   # ★ systemd 服務設定
│   └── install.sh          # ★ Ubuntu 快速部署腳本
├── README.md               # 本文件
└── 待修改.md               # 待辦改善項目（進度追蹤）
```

> ★ 為本次新增檔案

---

## 認證說明

應用程式啟動時會檢查 `sessionStorage` 中的 JWT token：

- **有 token** → 直接進入主畫面
- **無 token** → 顯示登入頁

登入頁提供兩種模式：
| 模式 | 說明 |
|------|------|
| 帳號密碼登入 | POST `/api/auth/token`，取得 JWT 存入 `sessionStorage` |
| Demo 模式 | 設定 `__demo__` 旗標，跳過後端，使用 MockAPI 本地資料 |

---

## 本地執行

不需要 build 工具，直接以任意 HTTP 伺服器提供靜態檔案即可：

```bash
# Python 3
python3 -m http.server 8080

# Node.js（npx）
npx serve .
```

開啟瀏覽器至 `http://localhost:8080`，點選「Demo 模式」即可無需後端體驗完整功能。

---

## 生產環境部署（Ubuntu）

```bash
# 快速部署（自動安裝依賴、建立資料庫、設定 Nginx + systemd）
cd deploy/
sudo bash install.sh
```

詳細設定請參考 `deploy/nginx.conf` 與 `deploy/secvision.service`。

---

## 技術棧

| 類別 | 技術 |
|------|------|
| 框架 | React 18（CDN UMD） |
| JSX 編譯 | Babel Standalone |
| 圖表 | Chart.js 4.4.0 |
| 字體 | IBM Plex Sans / Mono |
| 認證 | JWT（python-jose）via `/api/auth/token` |
| API 客戶端 | `api-client.js`（原生 fetch + Bearer token） |
| 持久化（Demo） | localStorage / MockAPI |
| 持久化（生產） | FastAPI + PostgreSQL 16 |
| 部署 | Nginx + systemd on Ubuntu 24.04 / 22.04 |

---

---

## QA 測試報告（2026-04-27）

以下為本次 QA 審查發現並已修復的問題：

| # | 嚴重度 | 檔案 | 問題描述 | 修復方式 |
|---|--------|------|----------|----------|
| 1 | 🔴 高 | `backend/main.py` | CORS 設定 `allow_credentials=True` 與 `allow_origins=["*"]` 同時使用，違反 CORS 規範，導致瀏覽器拒絕帶憑證的跨域請求（新版 Starlette 會直接拋出 `ValueError` 使服務無法啟動） | 改為 `allow_credentials=False`；Bearer Token 透過 `Authorization` header 傳送，不需要 credential 模式 |
| 2 | 🟡 中 | `api-client.js` | `uploadScan()` 與 `uploadAudit()` 收到 HTTP 401 時未清除 Token 也未派發 `secvision:unauthorized` 事件，導致 JWT 過期時上傳失敗但頁面不會自動跳回登入頁 | 補充 401 判斷，清除 `sessionStorage` Token 並派發未授權事件 |
| 3 | 🟡 中 | `mock-api.js` | CVE-2022-42889（Text4Shell，CVSS 9.8）在三份掃描快照中均被標記為 `risk:'Medium'`；CVE-2017-7494（SambaCry，CVSS 9.8）在 Q3 掃描中標記為 `risk:'High'`。依 CVSS v3 標準，CVSS ≥ 9.0 應為 Critical，導致風險矩陣與優先修補清單顯示錯誤 | 將上述 4 筆弱點資料的 risk 更正為 `'Critical'` |
| 4 | 🟡 中 | `pages/VulnScan.jsx` | 「優先修補清單」VPR 欄位的 render 函式未對 `null` 值做保護，當 `vpr` 為 `null` 時 `parseFloat(null).toFixed(1)` 回傳 `"NaN"` 並顯示在畫面上 | 加入 `v != null` 判斷，`null` 時顯示 `—` |
| 5 | 🟢 低 | `backend/services/nessus_parser.py` | 內部函式 `g()` 在每次迴圈疊代中重新定義，且透過閉包隱含捕獲外部 `row` 變數；`_find_col()` 在每次欄位存取時都重新查找，但欄位映射在整個解析過程中不會改變 | 在迴圈前預先建立 `col_map` 字典；以預設引數 `_row=row` 明確綁定當次的 `row`，消除閉包隱患 |
| 5b | 🟢 低 | `backend/services/audit_parser.py` | 同上，`g()` 函式在疊代中透過閉包捕獲 `row` | 同樣改為預設引數 `_row=row` |

### 修復前後對照

**Bug 3（風險矩陣資料錯誤）影響範圍：**
- Dashboard 首頁 Critical 計數：Q3 掃描少計 2 筆（Text4Shell + SambaCry），後兩期少計 1 筆（Text4Shell）
- VulnScan 風險矩陣圓餅圖：Medium 過多、Critical 不足
- 優先修補清單：Text4Shell（EPSS 0.290, CVSS 9.8）本應進入「🔴 優先修補」象限但因標記為 Medium 而遺漏

---

## QA 測試報告（第二輪，2026-04-27）

以下為第二輪 QA 審查發現並已修復的問題：

| # | 嚴重度 | 檔案 | 問題描述 | 修復方式 |
|---|--------|------|----------|----------|
| 1 | 🔴 高 | `deploy/nginx.conf` | 未設定 HTTP→HTTPS 強制跳轉；缺少 `X-Frame-Options`、`X-Content-Type-Options`、`X-XSS-Protection`、`Referrer-Policy`、`Strict-Transport-Security` 等安全標頭；HTTPS server block 完全被註解，等同裸 HTTP 提供 ISMS 服務 | 新增 80 埠 301 重導向 block；啟用 HTTPS server block 並加入五個安全標頭 |
| 2 | 🔴 高 | `pages/Login.jsx` | 登入頁明文顯示預設憑證 `admin / admin`，對資安管理系統（ISMS）是嚴重的安全反模式，攻擊者一眼即知初始帳密 | 改為「請聯繫系統管理員取得帳號資訊」提示文字，不在前端暴露任何憑證 |
| 3 | 🟡 中 | `backend/services/diff_service.py` | `_audit_key()` 在 `check_name` 為 `None` 時回退至 `str(r.id)`；由於 DB 自動遞增 ID 在不同掃描中各自獨立，同一筆匿名檢查項目的 base 與 compare ID 絕不相同，造成 diff 將其誤判為「新增失敗」而非「持續失敗」 | 回退改為空字串 `""`，使匿名項目能在跨掃描比對時正確合併 |
| 4 | 🟡 中 | `pages/VulnScan.jsx` | 弱點詳情展開列與優先修補清單 CVSS 欄位使用 `\|\|` 做顯示回退，當 CVSS 合法值為 `0` 時被視為 falsy 而錯誤顯示 `—` | 改用 `??`（nullish coalescing），只有 `null`/`undefined` 才顯示 `—` |
| 5 | 🟡 中 | `backend/services/cve_parser.py` | NVD JSON 解析時 synopsis 截斷至 300 字元但未加 `…`，使用者無從得知內容被截斷 | 截斷後補上 `…` 省略號 |
| 6 | 🟢 低 | `backend/services/epss_service.py` | `except Exception: pass` 靜默吞掉所有 EPSS API 錯誤，管理員無法得知 EPSS 富化失敗的原因（網路、限速等） | 改為 `logger.warning(...)` 輸出帶有 chunk index 與例外訊息的警告，便於排查 |
| 7 | 🟢 低 | `deploy/secvision.service` | `Restart=always` 搭配固定 `RestartSec=5` 且無重啟次數上限，若資料庫長時間離線會觸發無限重啟風暴，耗盡系統資源 | 改為 `Restart=on-failure`，並加入 `StartLimitBurst=5` / `StartLimitIntervalSec=60`，60 秒內重啟超過 5 次則停止服務 |

### 修復前後對照

**Bug 3（audit diff ID 碰撞）影響範圍：**
- NIST 頁面版本 Diff 比對：`check_name` 為空的項目永遠出現在「新增失敗」清單而非「持續失敗」
- 可能誇大 `new_failures` 計數，使趨勢圖失真

**Bug 4（CVSS falsy-0）影響範圍：**
- CVSS = 0.0 的弱點（部分資訊類外掛）在展開詳情與優先修補清單中顯示 `—` 而非 `0`
- 不影響邏輯計算，但視覺呈現錯誤

---

## 授權

Internal use only.
