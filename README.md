# NES SecVision

## 專案簡介

NES SecVision 是一套針對 ISMS 稽核與漏洞管理設計的輕量化管理平台，整合前端儀表板與 FastAPI 後端服務，支援漏洞掃描、NIST 稽核、IP 群組管理與系統監控。

本專案重點在於快速部署與可維運性，適用於 Ubuntu 22.04 / 24.04，採用 PostgreSQL 做為資料庫，並透過 Nginx 與 systemd 進行生產環境佈署。

## 專案架構

- `backend/`：FastAPI API 服務，包含驗證、漏洞掃描、NIST 稽核、IP 群組與儀表板路由。
- `deploy/`：Ubuntu 部署腳本、systemd 服務檔與 Nginx 設定檔。
- `pages/`：前端頁面資源與 UI 元件。
- `index.html`、`app.jsx`、`components.jsx`：前端入口頁面與 React 資源。
- `api-client.js`：前端與後端通訊封裝。
- `README.md`：專案說明文件。

## 核心功能

- JWT 驗證與會話管理。
- 漏洞掃描管理：檢視掃描清單、上傳掃描結果、刪除掃描、掃描差異比較。
- NIST 稽核管理：上傳稽核檔、稽核結果瀏覽、比較與趨勢分析。
- IP 群組管理：建立、查詢與刪除 IP 群組。
- API 健康檢查與自動文件：`/health`、`/docs`。

## 技術棧

- 後端：FastAPI、Uvicorn
- ORM：SQLAlchemy
- 資料庫遷移：Alembic
- 資料庫：PostgreSQL
- 認證：JWT（python-jose）
- 前端：React 18 UMD、Babel Standalone
- 部署：Nginx、systemd
- 語言：Python 3.12、JavaScript

## 本地開發

### 前端

1. 將專案根目錄作為靜態站點根目錄。
2. 啟動簡單 HTTP 伺服器：

```bash
python3 -m http.server 8080
```

或：

```bash
npx serve .
```

3. 開啟瀏覽器並訪問 `http://localhost:8080`。
4. 若要使用後端功能，請先啟動後端服務。

### 後端

1. 進入後端目錄：

```bash
cd backend
```

2. 建立虛擬環境並安裝相依套件：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. 啟動開發伺服器：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

4. 測試後端服務：

- `http://127.0.0.1:8000/`
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

## 生產環境部署（Ubuntu）

專案提供 `deploy/install.sh` 作為一鍵部署腳本，包含：

- 安裝系統套件與 Python 環境
- 建立 PostgreSQL 使用者與資料庫
- 部署後端與安裝 Python 相依套件
- 執行 Alembic migration
- 建立預設管理員帳號
- 部署前端靜態檔案
- 設定 systemd 與 Nginx

### 部署流程

```bash
cd deploy
sudo bash install.sh
```

若要覆寫預設管理員帳號名稱與密碼：

```bash
sudo ADMIN_USER=secadmin ADMIN_PASS='StrongPass!234' bash install.sh
```

部署完成後，系統會輸出：

- 前端入口：`http://<SERVER_IP>/`
- API 文件：`http://<SERVER_IP>/api/docs`

> 生產環境對外入口為 `80` port，Nginx 會將前端靜態資源交付給瀏覽器，並將 `/api/` 反向代理到內部 Uvicorn 後端服務的 `127.0.0.1:8000`。

請務必完成部署後立即更新管理員密碼，並檢查 `/opt/secvision/backend/.env` 中的資料庫密碼與 `SECRET_KEY` 配置。

## 管理員帳號建立與重設

若僅需建立或重設管理員帳號，可使用 `deploy/create-admin.sh`：

```bash
cd deploy
sudo bash create-admin.sh admin 'Admin@123456' admin
```

該腳本會建立 `users` 表及對應帳號，若帳號已存在則會更新密碼與角色。

## 重要 API 路由

- `GET /`：服務資訊
- `GET /health`：健康檢查
- `GET /docs`：FastAPI 自動文件
- `POST /api/auth/token`：JWT 登入
- `GET /api/dashboard`：儀表板資料
- `GET /api/scans`：掃描清單
- `POST /api/scans/upload`：上傳掃描結果
- `GET /api/nist/scans`：NIST 稽核清單
- `POST /api/nist/upload`：上傳 NIST 稽核資料
- `GET /api/ipgroups`：IP 群組清單

## 常見問題

- 若 `http://<SERVER_IP>:8000` 無法連線，請檢查 `secvision` systemd 服務是否已啟動，並確認防火牆與 Nginx 設定。
- 若 `/docs` 正常但 `/` 回傳 404，通常表示部署中的後端版本與目前檔案不同步，請重新同步 `backend` 內容並重新啟動服務。

## 授權

Internal use only.
