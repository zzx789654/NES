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


### 初始化第一個管理者帳號（首次部署）

若資料庫還沒有 `users` table 或沒有任何帳號，可在伺服器執行：

```bash
cd ~/NES/deploy
sudo bash create-admin.sh admin 'Admin@123456' admin
```

> 腳本會自動建立資料表（若不存在），並建立或更新該帳號密碼。

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
# 快速部署（自動安裝依賴、建立資料庫、建立預設管理者、設定 Nginx + systemd）
cd deploy/
sudo bash install.sh

# 可選：覆寫預設管理者帳密
# sudo ADMIN_USER=secadmin ADMIN_PASS='StrongPass!234' bash install.sh
```

`install.sh` 完成後會自動顯示伺服器 IP、API 入口與預設管理者帳密。

詳細設定請參考 `deploy/nginx.conf` 與 `deploy/secvision.service`（`nginx.conf` 預設 `server_name _;`，可直接用 IP 測試）。

---


## 常見連線問題（Connection Refused on :8000）

若你安裝完成後以 `http://YOUR_SERVER_IP:8000` 測試，出現「被拒絕連線」，常見原因有：

1. `secvision.service` 只綁定 `127.0.0.1`（僅本機可連）
2. 雲端 Security Group / 防火牆未開放 8000
3. 服務未啟動成功（`systemctl status secvision`）

本專案預設建議的對外入口其實是 Nginx `:80`：

- 前端：`http://YOUR_SERVER_IP/`
- API：`http://YOUR_SERVER_IP/api/docs`

若你真的需要直接對外開放 8000，可編輯 `/etc/systemd/system/secvision.service` 讓 Uvicorn 綁定 `0.0.0.0`，然後：

```bash
sudo systemctl daemon-reload
sudo systemctl restart secvision
sudo ss -lntp | grep 8000
```


### `/docs` 可開但 `/` 還是 404 的原因

這通常代表你已經重啟了服務，但正在跑的仍是舊版程式碼（`/opt/secvision/backend` 尚未同步最新 repo）。

請在伺服器上執行（建議用專用腳本，會同步 backend + frontend）：

```bash
cd ~/NES/deploy
sudo bash redeploy-backend.sh YOUR_SERVER_IP
```

> 腳本會先等待 `127.0.0.1:8000/health` 就緒（最多 30 秒），避免剛重啟瞬間檢查造成誤判 `connection refused`。
> 若腳本提示 `/` 回傳 404，表示目前執行中的後端版本尚未包含 root 路由；但只要 `/health` 與 `/docs` 正常，API 服務仍可使用。
> 若 `http://YOUR_SERVER_IP/index.html` 回傳 404，通常是 `/var/www/secvision` 尚未同步前端檔案；此腳本會一併修正。

若不使用腳本，也可手動執行：

```bash
cd ~/NES
sudo cp -a backend/. /opt/secvision/backend/
sudo chown -R secvision:secvision /opt/secvision/backend
sudo cp index.html app.jsx components.jsx mock-api.js api-client.js /var/www/secvision/
sudo cp -r pages /var/www/secvision/
sudo chown -R www-data:www-data /var/www/secvision
sudo cp deploy/nginx.conf /etc/nginx/sites-available/secvision
sudo ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl restart secvision
sudo systemctl reload nginx
```

然後再驗證：

```bash
curl http://YOUR_SERVER_IP:8000/health
curl -I http://YOUR_SERVER_IP:8000/docs
curl -I http://YOUR_SERVER_IP/index.html
```

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

## 授權

Internal use only.
