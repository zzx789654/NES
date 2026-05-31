# Lessons

---

## 2026-05-31 QA 回歸測試（PDCA）— SAST 修補項目驗證

### 本輪測試紀錄
- 範圍：7 個 SAST 弱點修補點的回歸測試 + 全套既有測試
- 執行統計：新增 18 條 SAST 回歸測試，Pass 18 / Fail 0；全套 169/169 Pass
- 關鍵指標：通過率 100%；Critical/Major 缺陷 = 0；SAST 修補覆蓋率 100%
- 測試期間發現 3 個**測試撰寫本身的問題**（非 production bug），已於 QA Do 階段修正
- Exit Criteria：**達標**（全部 Pass，Critical/Major = 0）

### 教訓 / 準則

1. **POST body 有 required 欄位時，測試一定要帶完整 body**
   - 情境：`ReportRequest.exportFormat` 為必填，測試只送 `modules` + `timeRange`，收到 422 而非預期的 200/400/500。
   - 準則：寫 API test 前先讀一次 Pydantic schema，把所有無預設值的欄位都加進 `_VALID_BODY` helper，邊界測試再從 helper 逐字段移除。

2. **空 list 不一定觸發自定 400，Pydantic 可能先放行**
   - 情境：`modules: list[str]` 接受空 list（Pydantic 不報錯），自定義 `if not body.modules` 才回 400；但測試假設一定是 400，沒考慮 422 也是合法拒絕。
   - 準則：驗證「拒絕行為」時，斷言寫成 `assert status in (400, 422)`，除非需求明定要哪個碼。

3. **slowapi 需要 `request: Request` 為第一參數（不可改名）**
   - 情境：SAST 修補時把 Pydantic body 改為 `body: ReportRequest`，同時把 `Request` 改名為 `http_request`，導致 slowapi 找不到 IP。雖然測試環境 TESTING=true 跳過限速，但正式環境會無法解析客戶端 IP。
   - 準則：slowapi `@limiter.limit()` 的函式第一參數必須命名為 `request`；若 Pydantic body 也叫 `request` 則改名為 `body`，不是改 `Request` 的名字。

4. **SQLAlchemy column default lambda 接受一個 ctx 參數，不可直接 `default_fn()` 呼叫**
   - 情境：測試試圖直接呼叫 `col.default.arg()` 驗證 datetime naive 性質，但 SQLAlchemy 的 callable default 會被傳入 `ExecutionContext`，直接呼叫缺少必要參數導致 TypeError。
   - 準則：驗證 column default 的邏輯時，用 `inspect.getsource()` 確認程式碼內容，或直接執行同等運算式（如 `datetime.now(timezone.utc).replace(tzinfo=None)`），不要透過 SQLAlchemy Column default 物件呼叫。

---

## 2026-05-31 第一輪靜態安全檢查（SAST × PDCA）— NES SecVision ISMS Portal

### 本輪檢測紀錄
- 範圍與工具：後端 `backend/`（Python/FastAPI）+ 前端 `pages/`（JSX）+ `deploy/nginx.conf`；人工靜態審查，對照 OWASP Top 10:2025 / CWE / ASVS L2
- 弱點統計：High×2 / Medium×2 / Low×3（共 7 項，全部修補）
- 關鍵指標：漏洞密度 ≈ 0.4 項/千行；誤報率 0%；相依套件 Critical CVE 0 個（python-jose Medium CVE 以 algorithms 白名單緩解）
- OWASP Top 10:2025 覆蓋：10/10 類全覆蓋
- 未解決弱點：0
- Exit Criteria：**達標**（Critical/High = 0，修補後通過；151/151 測試通過）

### 教訓 / 準則

1. **廢棄的安全標頭要保持全棧一致**
   - 情境：`X-XSS-Protection: 1; mode=block` 已廢棄，Nginx 設為 `0` 但後端 middleware 仍設為舊值，兩處不一致。
   - 準則：所有安全標頭（X-XSS-Protection、HSTS 等）在 Nginx 設定與後端 middleware 兩處必須一致更新。Nginx 設 `0`，後端也要設 `0`。

2. **SECRET_KEY 不能有預設值，缺少即停止啟動**
   - 情境：`config.py` 有 `"dev-secret-key-change-in-production"` 預設值，`.env` 未設時沉默使用弱密鑰。
   - 準則：JWT/加密用的 secret 必須在 Pydantic Settings 中無預設（`secret_key: str`），讓 pydantic-settings 在缺少時直接 ValidationError 終止啟動，而非繼續跑。

3. **例外訊息不能洩漏給 HTTP 客戶端**
   - 情境：`report.py` 的 `except Exception as e` 把 `str(e)` 放進 HTTP 500 detail，可能洩漏 DB schema 名稱、SQL 錯誤等。
   - 準則：所有 except-all 區塊應 `logger.exception(e)`（後端 log）+ 對外回傳通用訊息如 `"Internal error"`。

4. **前端 HTML 模板必須 HTML-escape 所有動態值**
   - 情境：`buildReportHtml()` 用 template literal 插入 `config.title`、`module.name` 等來自使用者/DB 的字串，未跳脫時可觸發 XSS。
   - 準則：凡是把變數插入 HTML 字串（非 React JSX），一律通過 `escHtml()` 跳脫。React JSX 的 `{}` 語法自動跳脫，但 template literal 不會。

5. **PDF 列印用 Blob URL + iframe，不用 document.write()**
   - 情境：`window.open()` + `document.write(html)` 把整份 HTML 寫入新視窗，觸發 CSP 限制且有 XSS 風險。
   - 準則：PDF/列印應建立 `Blob → URL.createObjectURL → <iframe hidden>` 載入後呼叫 `iframe.contentWindow.print()`，完成後 `removeChild + revokeObjectURL`。

6. **所有有計算成本的 API 端點都要加速率限制**
   - 情境：`POST /api/reports/generate` 對資料庫做多次 JOIN 查詢，未加 `@limiter.limit()`，可被高頻呼叫。
   - 準則：任何觸發 DB 聚合、檔案解析或外部 API 呼叫的端點都要加 `@limiter.limit("N/minute")`。

7. **datetime.utcnow() 已廢棄，統一用 timezone.utc**
   - 情境：`SystemAuditLog.timestamp` 用 `default=datetime.utcnow`（Python 3.12 deprecated）。
   - 準則：全專案一律 `datetime.now(timezone.utc).replace(tzinfo=None)` 以 naive UTC 存 DB，或保留 `tzinfo` 存 timezone-aware column。

---


- 矩陣與優先清單不可只依賴 CVSS v3：需對 CVSS v3 缺失提供 CVSS v2 fallback。
- UI 欄位選擇需與 API schema 一致：若 UI 要顯示摘要/修補，list API 必須輸出 synopsis/solution。
- 服務層計算需統一數值型別：SQLAlchemy Numeric 常為 Decimal，聚合前應轉 float/Decimal。


## 2026-05-13 部署腳本健康檢查
- systemd 服務啟動後不可直接執行登入或 smoke test；必須先輪詢 `/health`，失敗時立即輸出 `systemctl status`、`journalctl -u secvision` 與 listening ports。
- 安裝腳本不可在核心 smoke test 失敗後仍宣告部署完成；核心 API 驗證失敗應以非 0 狀態停止。
- systemd unit 應明確載入 `/opt/secvision/backend/.env`，並以 `/opt/secvision/venv/bin/python -m uvicorn` 啟動，避免 PATH 或 entrypoint 差異。


### 2026-05-13 部署流程驗證
- 每次交付自動安裝腳本前，至少要跑 `bash -n`、主要後端 `py_compile`，並檢查 install.sh 是否有 health wait、smoke test 與 failure diagnostics。
- 若執行環境不是 systemd 主機，不可宣稱已完成真實端對端部署；應明確標記為靜態驗證通過，並提供正式主機的 preflight / smoke test 指令。
- 部署包應包含不修改主機的驗證腳本，讓正式部署前可以快速檢查專案結構與關鍵 wiring。

## 2026-05-31 第一輪測試 — SecVision NES Backend 覆蓋率補強

### 本輪測試紀錄
- 執行統計：Pass 151 / Fail 0 / Blocked 0（共 151 條；補強新增 42 條）
- 關鍵指標：通過率 100%、整體覆蓋率 96%（前：90%）
- 缺陷：1 個 Minor Bug（verify_matrix_flow.py 斷言值錯誤，已修正）
- Exit Criteria：達標（覆蓋率 96% ≥ 95%、Critical/Major = 0、通過率 100%）

### 已修正 Bug
- **verify_matrix_flow.py:27**：斷言 `epss == 0.9877` 應為 `0.9876`。  
  根因：pandas `round(4)` 對 `0.98765` 採 round-half-to-even（banker's rounding），結果為 `0.9876`，而非常規四捨五入的 `0.9877`。

### 教訓 / 準則
- **asyncio 測試**：Python 3.10+ 同步測試中不可用 `get_event_loop().run_until_complete()`，改用 `asyncio.run()`。
- **Model 欄位確認**：測試 seed 前先 `[c.name for c in Model.__table__.columns]` 確認欄位清單，避免 `TypeError: 'X' is an invalid keyword argument`。
- **分頁 API 斷言**：回傳有 `{"items": [...], "total": N}` 結構的端點，取第一筆要用 `resp.json()["items"][0]`，不可直接 `resp.json()[0]`。
- **pandas rounding**：EPSS/浮點數欄位斷言要用 `pytest.approx` 或先驗證 parser 的實際輸出，避免因 banker's rounding 造成 flaky test。
- **env 依賴安裝**：在新環境跑 conftest 前確認 slowapi、jose、pandas 等都已裝好，否則 ImportError 會遮蔽真正的測試錯誤。

## 2026-05-31 專案完整性檢查

### 教訓 / 準則
- **datetime.utcnow() 已廢棄**：Python 3.12+ 中 `datetime.utcnow()` 會產生 DeprecationWarning。需改用 `datetime.now(timezone.utc).replace(tzinfo=None)` 保持 naive datetime 行為，或直接使用 timezone-aware datetime。每次新增時間戳欄位時立即使用新寫法。
- **Nginx CSP 要與前端 CDN 同步**：前端若從 unpkg/jsdelivr 載入 React、Babel、Chart.js，nginx.conf 的 CSP 必須明確放行這些 CDN，否則瀏覽器會阻擋資源載入。每次新增外部 CDN 資源時，同步更新 CSP。
- **開發腳本密碼強度**：setup-dev.sh 的開發用密碼若不符合應用程式自身的密碼驗證規則，會誤導開發者（他們會認為 `admin/admin` 是有效格式）。開發腳本使用的密碼應與正式密碼強度規則一致。
- **passlib scheme 一致性**：app 使用 pbkdf2_sha256（主）+ bcrypt（deprecated），setup 腳本應使用同一主 scheme，避免無謂的 scheme migration 開銷。

---

## 2026-05-31 輪結 — 上線完成收尾（NES SecVision ISMS Portal）

### 現況
- **全部關卡通過（G1 G2 G3 G4）→ 結案**
- 下一步：正式主機執行 `bash deploy/install.sh --preflight-only` 確認環境，再跑完整安裝

### PM 摘要
- 功能 Exit Criteria：所有 Router 功能已實作並通過測試，覆蓋率 97%
- 安全 Exit Criteria：SAST 7 項弱點全修補（High×2、Medium×2、Low×3）；Critical CVE = 0
- 品質 Exit Criteria：169/169 Pass（100%）；Critical/Major 缺陷 = 0

### DevSecOps
- 弱點統計：High 2 / Medium 2 / Low 3 → **全部修補**
- 最終新增：nginx.conf HTTPS block 內 X-XSS-Protection 修正為 `"0"`（與 HTTP block 一致）
- 新增 `.env.example`：補齊 SECRET_KEY、DATABASE_URL、ALLOWED_ORIGINS 必填欄位說明

### QA
- Pass 169 / Fail 0 / Blocked 0；通過率 100%；覆蓋率 97%

### 教訓 / 準則
1. **注解掉的 config block 也要維護**：nginx.conf 的 HTTPS block 雖被注解，如果包含舊的安全標頭值（如 `X-XSS-Protection: 1; mode=block`），啟用時會引入已知弱點。注解 block 也要與主 block 同步維護。
2. **`.env.example` 要在專案初期就建立**：讓新進部署者清楚哪些是必填環境變數，避免用預設值啟動。

### 過程原始輸出位置
- 測試結果：`cd backend && python -m pytest -q` 即可重現
- SAST 檢查：`待修改.md` 十一節
- 部署腳本驗證：`bash deploy/validate-deploy-flow.sh`
