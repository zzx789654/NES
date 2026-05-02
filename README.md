# SecVision ISMS Portal (NES)

SecVision 是一套以 **前端儀表板 + FastAPI 後端 API** 組成的資安管理入口，涵蓋：

- 弱點掃描（Nessus CSV / NVD JSON）
- NIST 稽核掃描（Audit CSV）
- 掃描差異比較（Diff）
- Dashboard 匯總統計
- JWT 驗證與角色權限（admin / analyst / viewer）
- IP 群組管理

---

## 專案結構

```text
NES/
├── index.html
├── app.jsx
├── api-client.js
├── mock-api.js
├── components.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── VulnScan.jsx
│   └── NIST.jsx
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   ├── routers/
│   ├── schemas/
│   ├── services/
│   └── tests/
├── deploy/
└── 待修改.md
```

---

## 執行模式

### 1) Demo 模式

- 前端以 `mock-api.js` 提供資料
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

開啟：`http://localhost:8080`

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

- `POST /api/auth/token`：登入取得 JWT
- `GET /api/auth/me`：取得目前使用者
- `POST /api/auth/register`：管理員建立帳號
- `POST /api/auth/change-password`：登入後變更自己的密碼

### Scans

- `GET /api/scans`
- `GET /api/scans/{id}`
- `POST /api/scans/upload`
- `DELETE /api/scans/{id}`
- `GET /api/scans/diff?base=&comp=`

> CVE JSON 上傳範例：`samples/cve-upload-sample.json`

### NIST

- `GET /api/nist/scans`
- `GET /api/nist/scans/{id}`
- `POST /api/nist/upload`
- `DELETE /api/nist/scans/{id}`
- `GET /api/nist/diff?base=&comp=`
- `GET /api/nist/trend`

### Dashboard

- `GET /api/dashboard`

### IP Groups

- `GET /api/ipgroups`
- `POST /api/ipgroups`
- `PUT /api/ipgroups/{id}`
- `DELETE /api/ipgroups/{id}`

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

## 測試

```bash
cd backend
pytest -q
```

本次新增測試覆蓋：

- CORS header 回應
- IP 群組 rename 重名衝突
- Nessus 缺必要欄位
- Audit 缺必要欄位

---

## 部署（Ubuntu）

建議使用 `deploy/` 內腳本進行安裝、重部署與管理者初始化：

- `deploy/install.sh`
- `deploy/redeploy-backend.sh`
- `deploy/create-admin.sh`
- `deploy/smoke-test.sh`

### 自動安裝流程重點（2026-04 修正）

- 安裝腳本會建立 `/opt/secvision/backend/.env`，寫入 `DATABASE_URL`、`SECRET_KEY` 與 `ALLOWED_ORIGINS`。
- PostgreSQL 使用者 `secvision` 會在部署時同步更新密碼，避免帳密不一致導致無法登入。
- 安裝結束會自動驗證管理者登入，並執行核心 API smoke test。

### 手動驗證可登入與功能可用

```bash
# 以安裝時輸出的帳號密碼驗證
bash deploy/smoke-test.sh http://127.0.0.1:8000 admin '你的管理者密碼'
```

若回傳 `✅ Smoke test passed`，代表登入與核心 API（dashboard / scans / nist / ipgroups）可正常呼叫。

---

## 授權

Internal use only.

---

## UI 可視性優化建議（前端）

- 提高深色主題下邊框對比（已調整 `--border` / `--border-strong`）。
- 強化輸入欄位 hover/focus 狀態（focus ring + 背景變化）。
- Secondary / Ghost 按鈕加入明確邊框與 hover 狀態，減少「看不出可點擊」問題。
- Card 與 Tab active 狀態增加可視層次（邊框、背景、陰影）以強化資訊分群。
