"""
Report Feature Integration Test - Manual Verification Guide
前後端 Report 功能集成驗證指南
"""

# ============================================================================
# 集成測試流程文檔
# ============================================================================

"""
本文件提供手動驗證 Report 功能的詳細步驟。

## 環境準備

1. 啟動後端服務
   cd backend
   python -m pytest tests/test_reports.py -v

2. 啟動前端 (靜態文件)
   cd frontend
   # 或使用 simple HTTP server
   python -m http.server 8080

## 完整集成流程驗證

### 階段 1: API 端點驗證

#### 1.1 驗證模組端點
```bash
curl -X GET "http://localhost:8000/api/reports/modules" \
  -H "Authorization: Bearer <TOKEN>"
```
預期響應: 包含 5 個報表模組 (risk_overview, compliance, scan_efficiency, remediation_progress, audit_log)

#### 1.2 生成基本報表 (無資料)
```bash
curl -X POST "http://localhost:8000/api/reports/generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "modules": ["risk_overview"],
    "timeRange": "30d",
    "exportFormat": "html",
    "title": "Test Report",
    "description": "Integration test"
  }'
```
預期響應: success=true，risk 字段為 null (無掃描資料)

#### 1.3 生成完整報表 (包含資料)
前置條件: 上傳掃描資料
```bash
# 先上傳掃描資料
curl -X POST "http://localhost:8000/api/scans/upload" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@nessus_export.csv" \
  -F "name=Feb2024Scan"

# 然後生成報表
curl -X POST "http://localhost:8000/api/reports/generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "modules": ["risk_overview", "scan_efficiency"],
    "timeRange": "30d",
    "exportFormat": "html",
    "title": "February Security Report",
    "includeCharts": true,
    "includeMetrics": true
  }'
```
預期響應: 
- success=true
- risk 字段包含掃描統計
- scan_efficiency 字段包含掃描計數

#### 1.4 驗證認證檢查
```bash
curl -X POST "http://localhost:8000/api/reports/generate" \
  -H "Content-Type: application/json" \
  -d '{"modules": ["risk_overview"], "timeRange": "30d", "exportFormat": "html"}'
```
預期響應: HTTP 401 Unauthorized

### 階段 2: 前端-後端集成驗證

#### 2.1 在瀏覽器中測試報表生成
1. 登入應用 (http://localhost:3000)
2. 導航到 Report Generator 頁面
3. 選擇報表模組 (例如: 風險概覽 + 掃描效能)
4. 設定時間範圍 (30 天)
5. 輸入報表標題和描述
6. 點擊「生成報表」按鈕
7. 驗證預覽中顯示的數據是否來自後端

預期行為:
- 點擊後顯示「生成中…」
- 約 1-2 秒後顯示報表預覽
- 預覽中的數據應來自 APIClient.generateReport() 的響應

#### 2.2 驗證報表導出
1. 報表生成後，選擇導出格式 (HTML / CSV)
2. 點擊相應的導出按鈕
3. 驗證下載的文件內容包含後端數據

預期結果:
- HTML: 包含完整的 HTML 文檔，其中包含報表數據
- CSV: 包含表格形式的數據，每行為一個指標

### 階段 3: 資料流驗證

#### 數據流序列
```
前端 Report.jsx
  ↓ handleGenerateReport() - 收集用戶選擇 & 配置
  ↓ APIClient.generateReport(config) - 構造 HTTP 請求
  ↓ POST /api/reports/generate
  ↓ backend/routers/report.py:generate_report()
  ↓ ReportService.generate_report()
  ↓ 根據 module ID 調用各個 get_*_stats() 方法
  ↓ 從資料庫查詢數據
  ↓ 聚合為 ReportData 對象
  ↓ 返回 ReportResponse { success: true, data: {...} }
  ↓ 前端接收響應，存儲於 config.backendData
  ↓ ReportPreview 組件使用 backendData 渲染報表
  ↓ 用戶看到包含實時數據的報表預覽
```

### 階段 4: 錯誤處理驗證

#### 4.1 無模組選擇
```bash
curl -X POST "http://localhost:8000/api/reports/generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"modules": [], "timeRange": "30d", "exportFormat": "html"}'
```
預期響應: HTTP 400，detail: "At least one module must be selected"

#### 4.2 無效的時間範圍
```bash
curl -X POST "http://localhost:8000/api/reports/generate" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"modules": ["risk_overview"], "timeRange": "invalid", "exportFormat": "html"}'
```
預期響應: 仍成功，但使用默認 30 天範圍

### 階段 5: 效能驗證

- **報表生成時間**: < 2 秒 (小資料集)
- **API 響應時間**: < 1 秒 (數據查詢 + 聚合)
- **前端渲染時間**: < 500ms (ReportPreview 組件)

## 測試驗收標準 ✅

### 功能完整性
- [x] Report API 端點已實現並可訪問
- [x] 前端能調用後端 API
- [x] 後端返回正確的資料結構
- [x] 前端能正確渲染報表數據

### 資料正確性
- [x] Risk 統計准確反映掃描結果
- [x] Compliance 統計准確反映審計結果
- [x] Scan Efficiency 統計正確計算
- [x] 時間範圍篩選正常工作

### 安全性
- [x] API 要求認證 (401 Unauthorized)
- [x] 無效請求返回 400 Bad Request
- [x] 參數驗證正確

### 集成性
- [x] 前後端通訊無中斷
- [x] 錯誤處理適當
- [x] 用戶體驗流暢

## 已知限制

1. **修復進度數據**: 目前使用模擬值，實際需要資料庫支援修復狀態追蹤
2. **審計日誌數據**: 目前使用模擬值，實際需要審計事件表
3. **PDF 導出**: 目前使用瀏覽器打印，不支援伺服器端 PDF 生成
4. **圖表渲染**: 目前不包含互動式圖表，僅顯示統計數字

## 調試技巧

### 後端調試
```python
# 在 report_service.py 中添加日誌
import logging
logger = logging.getLogger(__name__)

def generate_report(...):
    logger.debug(f"Generating report with modules: {modules}")
    # ...
    logger.debug(f"Report data: {report_data}")
```

### 前端調試
在 Report.jsx 中檢查：
```javascript
const response = await APIClient.generateReport(config);
console.log('Report response:', response);
console.log('Risk data:', response.data.risk);
```

## 維護檢查清單

每次更新前請驗證:
- [ ] 後端測試通過: `pytest tests/test_reports.py -v`
- [ ] 前端無 JavaScript 錯誤 (查看控制台)
- [ ] API 響應時間 < 2 秒
- [ ] 報表導出文件格式正確
- [ ] 認證檢查有效
"""
