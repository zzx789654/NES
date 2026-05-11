# SecVision ISMS Portal (NES)

SecVision 是一套以 **前端儀表板 + FastAPI 後端 API** 組成的資安管理入口，涵蓋：

- 弱點掃描（Nessus CSV / NVD JSON，全量 31 欄位）
- NIST 稽核掃描（Audit CSV）
- 掃描差異比較（Diff）
- 報表生成與匯出（HTML/CSV / PDF 列印）
- Dashboard 匯總統計
- JWT 驗證與角色權限（admin / analyst / viewer）
- IP 群組管理
- 資安加固（Rate Limiting、Security Headers、Audit Logging）

---

## 專案結構

```text
NES/
├── index.html
├── app.jsx
├── api-client.js
├── components.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── VulnScan.jsx
│   ├── NIST.jsx
│   ├── Report.jsx
│   └── UserManagement.jsx
├── backend/
│   ├── main.py           # FastAPI + 安全中介軟體
│   ├── config.py         # pydantic-settings 設定
│   ├── database.py
│   ├── limiter.py        # slowapi Rate Limiter
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   ├── services/
│   ├── tests/            # 104 測試，100% 通過率
│   └── alembic/          # 5 個 migrations（0001–0005）
├── deploy/
│   ├── install.sh
│   ├── nginx.conf
│   ├── secvision.service
│   ├── redeploy-backend.sh
│   ├── create-admin.sh
│   └── smoke-test.sh
├── samples/
│   └── cve-upload-sample.json
├── Architecture.md
├── 待修改.md
└── 測試.md
```

---

## 系統線性架構

SecVision NES 採用線性資料流設計，前端、後端、資料庫與匯出功能依序串接：

1. 使用者在前端 UI (React UMD) 發起操作，例如登入、掃描上傳、查詢報表。
2. `api-client.js` 將請求轉換成 REST API 呼叫，並附帶 JWT Bearer Token。 
3. FastAPI 後端接收請求，透過 `routers/` 進行路由分發，並執行 RBAC、參數驗證。
4. 上傳請求會進入 `services/` 解析資料（Nessus CSV / NVD JSON / Audit CSV），並補齊 EPSS 等額外風險指標。
5. 透過 SQLAlchemy 模型將資料寫入資料庫；同時可由 `backend/routers/dashboard.py` 聚合統計。
6. API 以 JSON 回應前端，前端再將資料呈現於頁面或生成 HTML/CSV 報表。
7. 部署時，Nginx 反向代理前端靜態頁面與後端 `/api/`，並加強 CORS、Rate Limiting、Security Headers。

---

## 執行模式

### 1) Demo 模式

- 前端以內建 mock 資料提供展示
- 不依賴後端
- 適合 UI 展示與快速體驗

### 2) 後端模式

- 登入後使用 JWT 呼叫 `/api/*`
- 使用 FastAPI + PostgreSQL（測試環境可用 SQLite）

---

## 本地開發

### 前端（靜態）

```bash
python3 -m http.server 8080
# 或
npx serve .
```

開啟：`http://localhost:8080`（開發模式）

> 提示：部署至 Nginx 時使用 Port 80；本地開發使用 Port 8080。

### 後端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API 文件：`http://127.0.0.1:8000/docs`

---

## API 摘要

### Auth

- `POST /api/auth/token`：登入取得 JWT（速率限制 10次/分/IP）
- `GET /api/auth/me`：取得目前使用者
- `POST /api/auth/register`：管理員建立帳號（密碼強度政策強制）
- `POST /api/auth/change-password`：登入後變更**自己**的密碼（需提供目前密碼）
- `GET /api/auth/users`：列出所有使用者（admin only）
- `PUT /api/auth/users/{id}/password`：管理員重設他人密碼（免驗舊密碼）
- `DELETE /api/auth/users/{id}`：刪除使用者（admin only）

### Scans

- `GET /api/scans?page=1&page_size=50`：掃描清單（支援分頁）
- `GET /api/scans/{id}`：掃描詳情
- `POST /api/scans/upload`：上傳 Nessus CSV / NVD JSON（速率限制 5次/分/IP，最大 50MB）
- `DELETE /api/scans/{id}`：刪除掃描（admin / analyst）
- `GET /api/scans/diff?base=&comp=`：版本差異
- `GET /api/scans/hosts/{host}/history`：主機弱點歷程

> CVE JSON 上傳範例：`samples/cve-upload-sample.json`

### NIST

- `GET /api/nist/scans`：稽核清單
- `GET /api/nist/scans/{id}`：稽核詳情
- `POST /api/nist/upload`：上傳 Audit CSV（速率限制 5次/分/IP，最大 50MB）
- `DELETE /api/nist/scans/{id}`：刪除稽核
- `GET /api/nist/diff?base=&comp=`：稽核差異
- `GET /api/nist/trend`：通過率趨勢

### Dashboard

- `GET /api/dashboard`：高風險 KPI 卡片、快速操作按鈕、NIST 合規摘要

### IP Groups

- `GET /api/ipgroups`
- `POST /api/ipgroups`
- `PUT /api/ipgroups/{id}`（重名防護，回傳 409）
- `DELETE /api/ipgroups/{id}`

### Reports

- `POST /api/reports/generate`：生成報表（支援 5 模組：risk_overview / compliance / scan_efficiency / remediation_progress / audit_log）
- `GET /api/reports/modules`：列出可用報表模組

支援時間範圍：`7d` / `30d` / `90d` / `custom`（自訂起訖日）  
輸出格式：`html` / `csv` / `pdf`

---

## 資安功能

| 功能 | 實作位置 | 說明 |
|------|---------|------|
| Rate Limiting | `main.py` + slowapi | 登入 10次/分；上傳 5次/分 |
| Security Headers | `main.py SecurityHeadersMiddleware` | X-Frame-Options, CSP 等 6 項 |
| Audit Logging | `main.py AuditLogMiddleware` | JSON 結構化請求稽核日誌 |
| Password Policy | `schemas/auth.py` | 8字元+大寫+數字+特殊字元（建立與修改密碼均強制） |
| Self-PW Change | `POST /api/auth/change-password` | 需驗證目前密碼；前端 UI 設有「目前密碼」欄位 |
| File Upload Guard | `routers/scans.py` | 50MB 上限 + Magic Bytes 驗證 |
| JWT RBAC | `routers/auth.py` | admin / analyst / viewer 三級 |

---

## Nessus CSV 欄位支援（全量 31 欄位）

| 分類 | 欄位 |
|------|------|
| 基本識別 | Plugin ID, CVE, Risk |
| 位置 | Host, Protocol, Port |
| 外掛資訊 | Name, Synopsis, Description, Solution, Plugin Output, See Also |
| CVSS 評分 | v2.0 Base, v2.0 Temporal, v3.0 Base, v3.0 Temporal, v4.0 Base, v4.0+Threat |
| 風險指標 | VPR Score, EPSS Score（上傳時自動查詢 FIRST.org） |
| 合規 | Risk Factor, STIG Severity |
| 參考 | BID, XREF, MSKB |
| 元數據 | Plugin Publication Date, Plugin Modification Date |
| 利用方式 | Metasploit, Core Impact, CANVAS |

---

## 測試

```bash
cd backend
pip install pytest
TESTING=1 pytest -q
```

測試套件：

| 套件 | 測試數 | 說明 |
|------|--------|------|
| test_auth.py | 14 | JWT、RBAC、密碼政策、使用者管理 |
| test_scans.py | 19 | 上傳、Diff、權限、分頁 |
| test_nist.py | 14 | Audit 上傳、趨勢、Diff |
| test_dashboard.py | 4 | 聚合統計 |
| test_ipgroups.py | 10 | CRUD、重名防護 |
| test_nessus_fields.py | 15 | 31 欄位解析 |
| test_services.py | 18 | Parser、Diff 邏輯 |
| test_reports.py | 7 | 報表生成、模組選擇、時間範圍 |
| test_scan_schemas.py | 1 | 非有限數值序列化 |
| **合計** | **104** | **100% 通過率** |

---

## 部署（Ubuntu）

建議使用 `deploy/` 內腳本進行安裝、重部署與管理者初始化：

- `deploy/install.sh`
- `deploy/redeploy-backend.sh`
- `deploy/create-admin.sh`
- `deploy/smoke-test.sh`

### 自動安裝流程

安裝腳本 (`deploy/install.sh`) 執行以下 11 個步驟：

| 步驟 | 說明 |
|------|------|
| 0 | 從 git 拉取最新程式碼 |
| 1 | 安裝系統套件（python3.12、postgresql、nginx） |
| 2 | 建立 PostgreSQL 使用者與資料庫 |
| 3 | 建立系統使用者 `secvision` |
| 4 | 部署後端、建立 venv、產生 `.env`（含隨機 SECRET_KEY） |
| 5 | 執行 `alembic upgrade head`（自動套用所有 migrations） |
| 6 | 建立預設管理者帳號 |
| 7 | 複製前端靜態檔案至 `/var/www/secvision` |
| 8 | 安裝並啟動 systemd 服務 |
| 9 | 部署 Nginx 反向代理設定 |
| 10 | 驗證管理者登入 |
| 11 | 執行核心 API Smoke Test |

**管理者密碼**：若未透過 `--admin-pass` 或 `ADMIN_PASS` 環境變數指定，安裝腳本會自動產生符合密碼強度規範的隨機密碼（格式：`Admin@<hex8>`），並於安裝結束時顯示。

```bash
# 自訂密碼安裝
bash deploy/install.sh --admin-pass 'MySecret@2024' --db-pass 'DbPass@2024'

# 全自動安裝（admin 密碼自動產生）
bash deploy/install.sh
```

- 安裝腳本會建立 `/opt/secvision/backend/.env`，寫入 `DATABASE_URL`、`SECRET_KEY` 與 `ALLOWED_ORIGINS`。
- PostgreSQL 使用者 `secvision` 會在部署時同步更新密碼，避免帳密不一致。
- 安裝結束會自動驗證管理者登入，並執行核心 API smoke test。

### 手動驗證

```bash
bash deploy/smoke-test.sh http://127.0.0.1:8000 admin '你的管理者密碼'
```

若回傳 `✅ Smoke test passed`，代表登入與核心 API 正常。

### 生產環境必要設定

```bash
# /opt/secvision/backend/.env
SECRET_KEY=<強隨機字串，至少 32 字元>
DATABASE_URL=postgresql://secvision:<password>@localhost/secvision
ALLOWED_ORIGINS=https://yourdomain.com
```

> ⚠️ 請勿在生產環境使用預設的 `dev-secret-key-change-in-production`。

---

## 系統審查紀錄（2026-05-08 安裝流程與前後端連接全面審查）

### 本次審查範圍
- 前端所有頁面（Login / Dashboard / VulnScan / NIST / Report / UserManagement）與後端 API 連接完整性
- 自動安裝流程（install.sh、create-admin.sh、smoke-test.sh、redeploy-backend.sh）
- Alembic migration 完整性

### 發現並修復的問題

| 嚴重度 | 問題 | 修復 |
|--------|------|------|
| 🔴 嚴重 | `system_audit_logs` 表未在任何 migration 建立，生產環境報表 audit_log 模組會崩潰 | 新增 `alembic/versions/0004_add_system_audit_logs.py` |
| 🔴 嚴重 | `Vulnerability` 模型的 `status`、`remediation_date` 欄位未在任何 migration 中，導致 `/api/dashboard`、`/api/scans/{id}/vulns`、`/api/scans/diff` 全部 HTTP 500 | 新增 `alembic/versions/0005_add_vuln_status_remediation.py` |
| 🔴 安全 | 自我密碼變更端點使用 `PUT /users/{id}/password`（不驗舊密碼），應使用 `POST /change-password` | `app.jsx`、`UserManagement.jsx` 改呼叫 `changeOwnPassword()`，UI 加入「目前密碼」欄位 |
| 🟡 邏輯 | `install.sh` 隨機密碼生成是 dead code（因 ADMIN_PASS 提前賦值導致條件永不成立） | 移至參數解析之後判斷，預設自動生成 `Admin@<hex8>` |
| 🟡 一致性 | `PasswordChange.new_password` 強度規則（僅長度+數字）弱於 `UserCreate.password`（4 項要求） | 補齊大寫字母與特殊字元驗證 |
| 🟢 遺漏 | `smoke-test.sh` 未測試 `/api/reports/modules`（新報表路由） | 加入 Reports 模組列表端點測試 |
| 🟢 遺漏 | `create-admin.sh` 無密碼強度警告，弱密碼可靜默通過 | 加入最低強度檢查並輸出警告訊息 |

### 前後端 API 連接驗證結果

全部 API 端點對應正確，無缺少或路徑不符：

| 頁面 | 使用端點 | 狀態 |
|------|---------|------|
| Login | `POST /api/auth/token` | ✅ |
| Dashboard | `GET /api/dashboard` | ✅ |
| VulnScan | `GET/POST/DELETE /api/scans/*` + `/api/ipgroups` | ✅ |
| NIST | `GET/POST/DELETE /api/nist/*` | ✅ |
| Report | `POST /api/reports/generate` + `GET /api/reports/modules` | ✅ |
| UserManagement | `GET/PUT/DELETE /api/auth/users/*` + `POST /api/auth/change-password` | ✅ |

### 測試結果

| 測試套件 | 結果 |
|---------|------|
| test_auth.py | ✅ 14/14 |
| test_dashboard.py | ✅ 4/4 |
| test_ipgroups.py | ✅ 10/10 |
| test_nessus_fields.py | ✅ 15/15 |
| test_nist.py | ✅ 14/14 |
| test_reports.py | ✅ 7/7 |
| test_scan_schemas.py | ✅ 1/1 |
| test_scans.py | ✅ 19/19 |
| test_services.py | ✅ 18/18 |
| **合計** | **✅ 104/104 (100%)** |

---

## 系統審查紀錄（2026-05-05 Bug Fix & Verification）

### 關鍵修復：HTTP 500 弱點掃描上傳問題

#### 根本原因
| 問題 | 影響 |
|------|------|
| Alembic migration schema 不完整（16 欄位 vs 31 欄位） | 上傳時 SQL OperationalError |
| 測試環境無法隔離 Alembic 執行 | 重複執行 migration → 表已存在 |
| Parser 精度和格式不匹配 | EPSS 四捨五入、日期格式、NaN 轉換錯誤 |

#### 修復清單
- ✅ 更新 `alembic/versions/0001_initial_schema.py` - 完整 31 欄位（CVSS v2/v3/v4、EPSS、VPR、Risk Factor 等）
- ✅ 修改 `main.py` - 新增 `TESTING` 環境變數檢查，測試模式使用 `Base.metadata.create_all()`
- ✅ 改進 `services/nessus_parser.py` - EPSS 精度 4 位、日期多格式支援、NaN 轉換
- ✅ 所有測試通過：**91/91 (100%)**

#### 測試結果
| 測試套件 | 結果 |
|---------|------|
| test_auth.py | ✅ 14/14 |
| test_dashboard.py | ✅ 4/4 |
| test_ipgroups.py | ✅ 10/10 |
| test_nessus_fields.py | ✅ 15/15 (修復前 4 失敗) |
| test_nist.py | ✅ 14/14 |
| test_scans.py | ✅ 16/16 |
| test_services.py | ✅ 18/18 |
| **合計** | **✅ 91/91 (100%)** |

### 本次審查結論

| 項目 | 結果 |
|------|------|
| 前後端架構 | ✅ 完整、所有模組齊全 |
| 自動化測試 | ✅ 91 個測試，100% 通過率 |
| Nessus 31 欄位 | ✅ 完整實作（model + migration + parser + schema） |
| 資安加固 | ✅ Rate Limit、Security Headers、Audit Log、JWT RBAC |
| 上傳功能 | ✅ HTTP 500 問題已修復，CSV/JSON 上傳正常 |
| 資料庫連接 | ✅ SQLite/PostgreSQL 支援，migration 無誤 |

---

## 系統審查紀錄（2026-05-03）

### 本次審查結論

| 項目 | 結果 |
|------|------|
| 架構完整性 | ✅ 前後端所有模組齊全 |
| 自動化測試 | ✅ 91 測試，100% 通過率 |
| Nessus 31 欄位 | ✅ 完整實作（model + parser + schema + tests） |
| 資安加固 | ✅ Rate Limit、Security Headers、Audit Log 均已實作 |
| 臨時檔案清理 | ✅ tmp_db_check.py、tmp_sa_check.py 已刪除 |
| 文件同步 | ✅ 待修改.md 第六節更新為已完成 |

### 修正項目

- 刪除 `backend/tmp_db_check.py`、`backend/tmp_sa_check.py` 臨時除錯腳本
- `待修改.md` 第六節 Nessus CSV 欄位擴充更新為 ✅ 已完成
- `測試.md` 補充 2026-05-03 系統全面審查紀錄

---

## 2026-04-28 修正重點

### ✅ CORS 設定修正

`backend/main.py` 的 CORS 已正確套用：

- `allow_origins`（由 `ALLOWED_ORIGINS` 控制）
- `allow_credentials`
- `allow_methods`
- `allow_headers`

### ✅ API Client 重複邏輯精簡

`api-client.js` 抽出 `reqForm()`：

- `uploadScan()` / `uploadAudit()` 共用 FormData 請求流程
- 401 未授權處理與錯誤訊息解析一致化

### ✅ IP 群組更新重名防護

`PUT /api/ipgroups/{id}` 現在會檢查是否重名，若衝突回傳 `409`。

### ✅ 上傳資料必要欄位驗證

- Nessus CSV：缺 `risk / host / name` 時回傳 `400`
- Audit CSV：缺 `check_name / status` 時回傳 `400`

---

## UI 可視性優化

- 提高深色主題下邊框對比（已調整 `--border` / `--border-strong`）。
- 強化輸入欄位 hover/focus 狀態（focus ring + 背景變化）。
- Secondary / Ghost 按鈕加入明確邊框與 hover 狀態。
- Card 與 Tab active 狀態增加可視層次（邊框、背景、陰影）。

---

## 授權

Internal use only.

---

## 2026-05-11 驗證更新：自動安裝、矩陣讀取與風險排序

### 架構與功能確認

- **前端**：`index.html` 以靜態方式載入 `api-client.js`、`components.jsx`、`pages/*.jsx` 與 `app.jsx`；弱點掃描主流程位於 `pages/VulnScan.jsx`。
- **API Client**：`api-client.js` 封裝 JWT Bearer Token、弱點掃描清單、弱點分頁、矩陣資料、差異比較與上傳 API。
- **後端**：`backend/main.py` 啟動 FastAPI，並註冊 `auth`、`scans`、`nist`、`dashboard`、`ipgroups`、`report` routers。
- **弱點掃描資料流**：Nessus CSV / NVD JSON → `backend/routers/scans.py` 上傳端點 → `backend/services/nessus_parser.py` / `cve_parser.py` 解析 → SQLAlchemy `Scan` / `Vulnerability` → `/api/scans/{id}/vulns` 與 `/api/scans/{id}/vuln-matrix` 提供前端表格與矩陣。
- **部署資料流**：`deploy/install.sh` 進行環境確認、系統套件安裝、PostgreSQL 初始化、後端 venv 建置、Alembic migration、管理者建立、前端靜態檔部署、systemd / Nginx 啟用與 smoke test。

### 自動安裝與部署流程

部署前請先執行 preflight，只檢查環境、不修改系統：

```bash
bash deploy/install.sh --preflight-only --skip-git-update
```

正式部署範例：

```bash
bash deploy/install.sh \
  --db-pass '<strong-db-password>' \
  --admin-pass '<Admin@ChangeMe123>' \
  --branch main
```

可用參數：

| 參數 | 說明 |
|------|------|
| `--preflight-only` | 只執行部署前環境確認，不安裝套件、不建立服務、不修改系統。 |
| `--skip-git-update` | 跳過 `git fetch/checkout/pull`，適合驗證本機工作樹或離線部署包。 |
| `--db-pass <密碼>` | 指定 PostgreSQL `secvision` 使用者密碼；未指定時自動產生。 |
| `--admin-pass <密碼>` | 指定預設管理者密碼；未指定時自動產生符合密碼政策的強密碼。 |
| `--branch <分支>` | 指定部署前更新的 Git 分支；未指定時使用目前分支。 |

Preflight 會確認 OS、必要指令、`sudo`、`apt`、systemd、repo 結構與 80/8000 port 狀態。容器環境若沒有 systemd，preflight 會明確失敗，避免進入半部署狀態；正式啟用服務請在 Ubuntu 22.04 / 24.04 主機執行。

### 矩陣資料讀取驗證

矩陣資料由 `/api/scans/{scan_id}/vuln-matrix` 提供，回傳前端 EPSS vs CVSS 與 VPR vs CVSS 圖表需要的 `risk`、`host`、`name`、`cve`、`cvss_v3_base`、`epss`、`vpr` 等欄位。後端測試 `backend/tests/test_vuln_ordering.py` 會驗證矩陣端點可讀取分數欄位，且排序維持 Critical → High → Medium → Low → Info。

### 弱點掃描風險排序

弱點掃描資料表預設依風險等級由危險到資訊排序：

```text
Critical → High → Medium → Low → Info
```

後端 `/api/scans/{scan_id}/vulns` 的預設 `sort_by` 已改為 `risk`，並使用固定風險權重排序，避免字母排序造成 `Info`、`Low`、`Medium` 順序錯誤。前端資料表預設排序欄位同步改為風險等級；本地 DataTable 排序也使用相同權重，讓矩陣優先修補清單等非 server-side 表格行為一致。
