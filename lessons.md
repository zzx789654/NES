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
