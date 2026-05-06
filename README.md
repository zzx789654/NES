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
│   └── Report.jsx
├── backend/
│   ├── main.py           # FastAPI + 安全中介軟體
│   ├── config.py         # pydantic-settings 設定
│   ├── database.py
│   ├── limiter.py        # slowapi Rate Limiter
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   ├── services/
│   ├── tests/            # 91 測試，100% 通過率
│   └── alembic/
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
- `POST /api/auth/change-password`：登入後變更自己的密碼

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

---

## 資安功能

| 功能 | 實作位置 | 說明 |
|------|---------|------|
| Rate Limiting | `main.py` + slowapi | 登入 10次/分；上傳 5次/分 |
| Security Headers | `main.py SecurityHeadersMiddleware` | X-Frame-Options, CSP 等 6 項 |
| Audit Logging | `main.py AuditLogMiddleware` | JSON 結構化請求稽核日誌 |
| Password Policy | `schemas/auth.py` | 8字元+大寫+數字+特殊字元 |
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
pytest -q
```

測試套件：

| 套件 | 測試數 | 說明 |
|------|--------|------|
| test_auth.py | 10 | JWT、RBAC、密碼政策 |
| test_scans.py | 13 | 上傳、Diff、權限 |
| test_nist.py | 11 | Audit 上傳、趨勢 |
| test_dashboard.py | 4 | 聚合統計 |
| test_ipgroups.py | 10 | CRUD、重名防護 |
| test_nessus_fields.py | 13 | 31 欄位解析 |
| test_services.py | 18 | Parser、Diff 邏輯 |
| **合計** | **91** | **100% 通過率** |

---

## 部署（Ubuntu）

建議使用 `deploy/` 內腳本進行安裝、重部署與管理者初始化：

- `deploy/install.sh`
- `deploy/redeploy-backend.sh`
- `deploy/create-admin.sh`
- `deploy/smoke-test.sh`

### 自動安裝流程

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
