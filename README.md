# NES SecVision

## 專案簡介

NES SecVision 是一套針對 ISMS 稽核與漏洞管理設計的輕量化安全平台。專案結合 React 前端與 FastAPI 後端，採用 PostgreSQL 做為資料庫，提供漏洞掃描上傳、差異比對、主機歷程、NIST 稽核、IP 群組管理與儀表板監控。

本專案適合部署於 Ubuntu 22.04 / 24.04，透過 Nginx 反向代理與 systemd 管理後端服務。

## 專案架構

- `backend/`
  - `main.py`：FastAPI 應用入口
  - `config.py`：環境設定與連線配置
  - `database.py`：SQLAlchemy 引擎與 session 管理
  - `models/`：ORM 模型（Scan、Vulnerability、AuditScan、IPGroup、User）
  - `routers/`：API 路由（auth、scans、nist、ipgroups、dashboard）
  - `schemas/`：Pydantic 請求與回應模型
  - `services/`：解析、差異計算、EPSS 查詢等業務邏輯
  - `tests/`：後端單元測試
- `pages/`：前端頁面（Dashboard、VulnScan、NIST、Login）
- `components.jsx`：共用 UI 元件與視覺組件
- `api-client.js`：前端與後端 API 封裝
- `index.html`：前端入口與載入順序
- `deploy/`：部署腳本與 Nginx / systemd 範本

## 核心功能

- JWT 認證與角色權限管理
- 漏洞掃描管理：
  - 上傳 Nessus CSV / NVD JSON
  - 取得掃描清單與單一掃描明細
  - 掃描差異比較（新增 / 持續 / 已解決）
  - 主機歷程追蹤與時間軸展示
- 風險分析：
  - EPSS / VPR / CVSS 風險矩陣
  - 優先修補清單
- IP 群組管理：建立、查詢、刪除
- NIST 稽核管理：上傳、瀏覽、Diff 比較、趨勢分析
- 儀表板：弱點總數、風險分佈與合規率指標
- API 文件：`/docs`

## 技術棧

- 後端：FastAPI、Uvicorn
- ORM：SQLAlchemy 2.0
- 資料庫：PostgreSQL
- 資料庫遷移：Alembic
- 認證：JWT（python-jose）
- 前端：React 18 UMD + Babel Standalone
- 部署：Nginx、systemd
- 測試：pytest

## 開發環境安裝

### 1. 建立 Python 虛擬環境

```powershell
cd c:\GIT\NES\NES\backend
..\..\.venv\Scripts\python.exe -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2. 啟動後端

```powershell
cd c:\GIT\NES\NES\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 啟動前端

開發模式下，可使用簡單 HTTP 伺服器提供靜態前端：

```powershell
cd c:\GIT\NES\NES
python -m http.server 8080
```

### 4. 瀏覽器訪問

- 開發模式前端：`http://localhost:8080`
- 後端 API：`http://127.0.0.1:8000`
- API 文件：`http://127.0.0.1:8000/docs`

> 注意：若項目部署到 Ubuntu + Nginx 生產環境，前端對外可見端口通常為 `80`。
> README 中 8080 只適用於本地開發靜態頁面測試，並非 production 端口。

## 主要 API 路由

- `GET /`：服務資訊
- `GET /health`：健康檢查
- `POST /api/auth/token`：JWT 登入
- `GET /api/dashboard`：儀表板統計
- `GET /api/scans`：掃描清單
- `GET /api/scans/{id}`：掃描詳情
- `GET /api/scans/diff?base={baseId}&comp={compId}`：掃描差異
- `GET /api/scans/hosts/{host}/history`：主機漏洞歷程
- `POST /api/scans/upload`：上傳漏洞掃描檔案
- `GET /api/nist/scans`：NIST 稽核清單
- `GET /api/nist/scans/{id}`：NIST 稽核詳情
- `GET /api/nist/diff?base={baseId}&comp={compId}`：NIST 差異比較
- `GET /api/nist/trend`：NIST 趨勢分析
- `GET /api/ipgroups`：IP 群組清單
- `POST /api/ipgroups`：建立 IP 群組
- `DELETE /api/ipgroups/{id}`：刪除 IP 群組

## 功能說明

### Vulnerability Scan

- 支援 Nessus CSV 與 NVD JSON 上傳
- 透過正式後端 API 儲存掃描結果至資料庫
- 顯示弱點列表、篩選條件、欄位選擇與詳細說明
- 提供 EPSS / VPR / CVSS 風險矩陣圖表
- 顯示單一主機漏洞歷程與時間軸
- Diff 比較支援新增、持續、已解決弱點類別

### NIST Audit

- 支援 Audit CSV 上傳
- 取得稽核清單與詳細結果
- 比較版本差異
- 呈現合規率與趨勢

### Dashboard

- 弱點總數與風險分佈
- NIST 合規率展示
- 最近掃描與稽核摘要
- 快速導覽至 Vulnerability Scan 或 NIST 頁面

## 測試

```powershell
cd c:\GIT\NES\NES\backend
.\.venv\Scripts\python.exe -m pytest tests -q
```

## 部署提示

- Production 建議使用 PostgreSQL 16
- `deploy/` 內含 Nginx 與 systemd 範本
- 先完成 `alembic upgrade head`，再啟動 Uvicorn 服務
- Nginx 將 `/api/` 代理至 `http://127.0.0.1:8000`

## 注意事項

- 請務必更新管理員密碼與 `SECRET_KEY`
- 若 API 運作正常但前端無法載入，請檢查 `index.html` 與 `api-client.js` 中的 base path
- 若要切換到正式後端，請確保前端網址與 `ALLOWED_ORIGINS` 相符

## 授權

Internal use only.
