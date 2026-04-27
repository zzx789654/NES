 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/README.md b/README.md
index 2960b1e8cbb5bb5efa8b8e7dd2a1e4ef131eb058..a16d28040be527f71fa375aa9642678fb0adf5ac 100644
--- a/README.md
+++ b/README.md
@@ -122,72 +122,153 @@ NES/
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
 
+
+### 初始化第一個管理者帳號（首次部署）
+
+若資料庫還沒有 `users` table 或沒有任何帳號，可在伺服器執行：
+
+```bash
+cd ~/NES/deploy
+sudo bash create-admin.sh admin 'Admin@123456' admin
+```
+
+> 腳本會自動建立資料表（若不存在），並建立或更新該帳號密碼。
+
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
-# 快速部署（自動安裝依賴、建立資料庫、設定 Nginx + systemd）
+# 快速部署（自動安裝依賴、建立資料庫、建立預設管理者、設定 Nginx + systemd）
 cd deploy/
 sudo bash install.sh
+
+# 可選：覆寫預設管理者帳密
+# sudo ADMIN_USER=secadmin ADMIN_PASS='StrongPass!234' bash install.sh
 ```
 
-詳細設定請參考 `deploy/nginx.conf` 與 `deploy/secvision.service`。
+`install.sh` 完成後會自動顯示伺服器 IP、API 入口與預設管理者帳密。
+
+詳細設定請參考 `deploy/nginx.conf` 與 `deploy/secvision.service`（`nginx.conf` 預設 `server_name _;`，可直接用 IP 測試）。
 
 ---
 
+
+## 常見連線問題（Connection Refused on :8000）
+
+若你安裝完成後以 `http://YOUR_SERVER_IP:8000` 測試，出現「被拒絕連線」，常見原因有：
+
+1. `secvision.service` 只綁定 `127.0.0.1`（僅本機可連）
+2. 雲端 Security Group / 防火牆未開放 8000
+3. 服務未啟動成功（`systemctl status secvision`）
+
+本專案預設建議的對外入口其實是 Nginx `:80`：
+
+- 前端：`http://YOUR_SERVER_IP/`
+- API：`http://YOUR_SERVER_IP/api/docs`
+
+若你真的需要直接對外開放 8000，可編輯 `/etc/systemd/system/secvision.service` 讓 Uvicorn 綁定 `0.0.0.0`，然後：
+
+```bash
+sudo systemctl daemon-reload
+sudo systemctl restart secvision
+sudo ss -lntp | grep 8000
+```
+
+
+### `/docs` 可開但 `/` 還是 404 的原因
+
+這通常代表你已經重啟了服務，但正在跑的仍是舊版程式碼（`/opt/secvision/backend` 尚未同步最新 repo）。
+
+請在伺服器上執行（建議用專用腳本，會同步 backend + frontend）：
+
+```bash
+cd ~/NES/deploy
+sudo bash redeploy-backend.sh YOUR_SERVER_IP
+```
+
+> 腳本會先等待 `127.0.0.1:8000/health` 就緒（最多 30 秒），避免剛重啟瞬間檢查造成誤判 `connection refused`。
+> 若腳本提示 `/` 回傳 404，表示目前執行中的後端版本尚未包含 root 路由；但只要 `/health` 與 `/docs` 正常，API 服務仍可使用。
+> 若 `http://YOUR_SERVER_IP/index.html` 回傳 404，通常是 `/var/www/secvision` 尚未同步前端檔案；此腳本會一併修正。
+
+若不使用腳本，也可手動執行：
+
+```bash
+cd ~/NES
+sudo cp -a backend/. /opt/secvision/backend/
+sudo chown -R secvision:secvision /opt/secvision/backend
+sudo cp index.html app.jsx components.jsx mock-api.js api-client.js /var/www/secvision/
+sudo cp -r pages /var/www/secvision/
+sudo chown -R www-data:www-data /var/www/secvision
+sudo cp deploy/nginx.conf /etc/nginx/sites-available/secvision
+sudo ln -sf /etc/nginx/sites-available/secvision /etc/nginx/sites-enabled/secvision
+sudo rm -f /etc/nginx/sites-enabled/default
+sudo nginx -t
+sudo systemctl daemon-reload
+sudo systemctl restart secvision
+sudo systemctl reload nginx
+```
+
+然後再驗證：
+
+```bash
+curl http://YOUR_SERVER_IP:8000/health
+curl -I http://YOUR_SERVER_IP:8000/docs
+curl -I http://YOUR_SERVER_IP/index.html
+```
+
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
 
 ## 授權
 
 Internal use only.
 
EOF
)
