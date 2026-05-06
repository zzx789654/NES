# NES 系統架構

## 一、專案概覽

SecVision NES 是一套資安弱點管理與稽核分析平台，採用前後端分離架構：

- 前端：靜態 React UMD 單頁應用（SPA），以 `index.html` + `app.jsx` 為入口
- 後端：Python FastAPI 提供 REST API
- 資料庫：SQLAlchemy ORM，開發/測試使用 SQLite，正式環境建議 PostgreSQL
- 部署：Ubuntu + Nginx，提供前端靜態頁面與後端反向代理
- 外部服務：EPSS API（FIRST.org）補齊 CVE 風險指標

## 二、前端架構

### 入口與路由

- `index.html`：靜態入口頁，載入 React UMD、`app.jsx`、`api-client.js`、共用元件
- `app.jsx`：主應用殼層，處理 JWT 登入狀態、頁面導航與全域統計刷新
- `pages/`：各頁面組件
  - `Login.jsx`：登入頁
  - `Dashboard.jsx`：儀表板
  - `VulnScan.jsx`：弱點掃描與上傳管理
  - `NIST.jsx`：NIST 稽核列表與趨勢
  - `Report.jsx`：報表生成器
  - `UserManagement.jsx`：帳號管理

### API 客戶端

- `api-client.js`：統一 HTTP wrapper
  - JWT 驗證：`Authorization: Bearer <token>`
  - `Content-Type` 自動設定
  - 401 自動登出處理
  - 上傳使用 `FormData`

### 報表設計

- `pages/Report.jsx`：前端模組化報表生成器
- 支援報表模組選擇、時間範圍、圖表/指標/詳細數據項目
- 目前採用前端匯出（HTML/CSV）與 PDF 列印模擬

## 三、後端架構

### 應用框架

- `backend/main.py`：FastAPI 應用程式入口
- 中介軟體
  - `SecurityHeadersMiddleware`：安全標頭
  - `AuditLogMiddleware`：JSON 形式稽核日誌
  - `SlowAPIMiddleware`：Rate Limiting
  - `CORSMiddleware`：動態允許來源
- 資料初始化
  - `TESTING=true`：使用 SQLAlchemy `Base.metadata.create_all()`
  - 正常模式：透過 Alembic `upgrade head`

### 模組與路由

- `backend/routers/auth.py`：JWT 登入、使用者、密碼變更、RBAC
- `backend/routers/scans.py`：弱點掃描上傳、查詢、Diff、主機歷程、刪除
- `backend/routers/nist.py`：NIST Audit 上傳、查詢、Diff、趨勢
- `backend/routers/ipgroups.py`：IP 群組 CRUD
- `backend/routers/dashboard.py`：儀表板統計摘要

## 四、資料庫與資料流

### ORM 與模型

- `backend/database.py`：SQLAlchemy engine、Session 生成
- `backend/models/scan.py`：Scan、Vulnerability 模型，對應 Nessus 31 欄位
- `backend/models/audit.py`：AuditScan、AuditResult
- `backend/models/ipgroup.py`：IP 群組模型
- `backend/models/user.py`：使用者與角色模型

### 主要資料流

1. 使用者登入 → `POST /api/auth/token`
2. API 請求帶 JWT → `Authorization` header
3. 掃描上傳 → `POST /api/scans/upload` 或 `POST /api/nist/upload`
4. 解析資料並存入資料庫
5. 前端透過 `/api/dashboard`、`/api/scans`、`/api/nist/scans` 取資料
6. 報表頁面使用前端統計數據生成匯出格式

## 五、部署與運行

### 本地開發

- 前端靜態頁面：`python3 -m http.server 8080` 或 `npx serve .`
- 後端服務：
  ```bash
  cd backend
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  uvicorn main:app --reload --host 127.0.0.1 --port 8000
  ```

### 生產部署

- 使用 `deploy/install.sh` 安裝後端服務與 Nginx
- Nginx 反向代理前端與 `http://127.0.0.1:8000`
- 必須設定環境變數
  - `SECRET_KEY`
  - `DATABASE_URL`
  - `ALLOWED_ORIGINS`

### 外部服務

- EPSS API：`backend/services/epss_service.py`
- 目前僅在上傳掃描時批次查詢 CVE 風險指標

## 六、已知限制

- 報表功能目前為前端匯出方案，尚未整合後端報表生成服務
- 部署需使用 PostgreSQL 以避免 SQLite 在多使用者環境下鎖定問題
- 目前 CORS 開發模式允許所有來源，生產應明確設定 `ALLOWED_ORIGINS`
