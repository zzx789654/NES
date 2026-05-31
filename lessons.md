# Lessons


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
