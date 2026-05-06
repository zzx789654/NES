// Report Page — Modular reporting system for executives

const { useState, useEffect, useMemo } = React;

// 報表模組定義
const REPORT_MODULES = {
  risk_overview: {
    id: 'risk_overview',
    name: '風險概覽報表',
    description: '弱點分布、CVSS評分、高風險資產排名',
    icon: '⚠',
    enabled: true,
  },
  compliance: {
    id: 'compliance',
    name: '合規性報表',
    description: 'NIST框架合規率、控制措施狀態',
    icon: '☑',
    enabled: true,
  },
  scan_efficiency: {
    id: 'scan_efficiency',
    name: '掃描效能報表',
    description: '掃描覆蓋率、CVE/EPSS趨勢分析',
    icon: '📊',
    enabled: true,
  },
  remediation_progress: {
    id: 'remediation_progress',
    name: '修復進度報表',
    description: '已修復數量、優先級分布、修復週期',
    icon: '✓',
    enabled: true,
  },
  audit_log: {
    id: 'audit_log',
    name: '審計日誌報表',
    description: '系統操作記錄、權限變更、異常檢測',
    icon: '📋',
    enabled: true,
  },
};

const EXPORT_FORMATS = [
  { id: 'html', label: 'HTML (預覽)', icon: '🌐' },
  { id: 'pdf', label: 'PDF (列印)', icon: '📄' },
  { id: 'csv', label: 'CSV (數據)', icon: '📊' },
];

const TIME_RANGES = [
  { id: '7d', label: '過去7天' },
  { id: '30d', label: '過去30天' },
  { id: '90d', label: '過去90天' },
  { id: 'custom', label: '自訂範圍' },
];

function ReportBuilder({ stats, onExport }) {
  const [selectedModules, setSelectedModules] = useState(
    Object.values(REPORT_MODULES).reduce((acc, m) => ({ ...acc, [m.id]: true }), {})
  );
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportFormat, setExportFormat] = useState('html');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [reportTitle, setReportTitle] = useState('資安態勢報表');
  const [reportDescription, setReportDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleModuleToggle = (moduleId) => {
    setSelectedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleSelectAll = () => {
    const allSelected = Object.values(selectedModules).every(v => v);
    if (allSelected) {
      setSelectedModules(Object.values(REPORT_MODULES).reduce((acc, m) => ({ ...acc, [m.id]: false }), {}));
    } else {
      setSelectedModules(Object.values(REPORT_MODULES).reduce((acc, m) => ({ ...acc, [m.id]: true }), {}));
    }
  };

  const selectedCount = Object.values(selectedModules).filter(v => v).length;
  const allSelected = selectedCount === Object.keys(selectedModules).length;

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const config = {
        modules: Object.entries(selectedModules)
          .filter(([, v]) => v)
          .map(([k]) => k),
        timeRange,
        customStart: startDate,
        customEnd: endDate,
        exportFormat,
        includeCharts,
        includeMetrics,
        includeDetails,
        title: reportTitle,
        description: reportDescription,
      };

      // Call backend to generate report
      const response = await APIClient.generateReport(config);
      
      if (response && response.success && response.data) {
        // Add generated timestamp to the data
        const reportData = {
          ...config,
          generatedAt: response.data.generated_at || new Date().toISOString(),
          backendData: response.data,  // Store backend data for display
        };
        onExport && onExport(reportData);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      console.error('Failed to generate report:', err);
      alert('❌ 生成報表失敗：' + (err.message || '未知錯誤'));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* 左側：模組選擇 */}
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700 }}>報表模組</h3>
            <button
              onClick={handleSelectAll}
              style={{
                fontSize: 11,
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: allSelected ? 'var(--accent-bg)' : 'transparent',
                color: allSelected ? 'var(--accent)' : 'var(--text3)',
                cursor: 'pointer',
              }}
            >
              {allSelected ? '全部取消' : '全部選取'}
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0 }}>已選 {selectedCount} / {Object.keys(selectedModules).length} 個模組</p>
        </div>

        {/* 模組清單 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.values(REPORT_MODULES).map(module => (
            <label key={module.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: selectedModules[module.id] ? 'var(--accent-bg)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!selectedModules[module.id]) e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { if (!selectedModules[module.id]) e.currentTarget.style.borderColor = 'var(--border)'; }}>
              <input
                type="checkbox"
                checked={selectedModules[module.id]}
                onChange={() => handleModuleToggle(module.id)}
                style={{ marginRight: 10, marginTop: 2, cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{module.icon}</span> {module.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{module.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 右側：報表設定 */}
      <div>
        {/* 報表基本資訊 */}
        <Card title="報表基本資訊">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>報表標題</label>
              <input
                type="text"
                value={reportTitle}
                onChange={e => setReportTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
                placeholder="例：2026年5月資安態勢報表"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>報表描述</label>
              <textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  fontSize: 13,
                  boxSizing: 'border-box',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  minHeight: 60,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
                placeholder="報表概述或備註"
              />
            </div>
          </div>
        </Card>

        {/* 時間範圍 */}
        <Card title="時間範圍" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {TIME_RANGES.map(range => (
              <label key={range.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="radio"
                  name="timeRange"
                  value={range.id}
                  checked={timeRange === range.id}
                  onChange={() => setTimeRange(range.id)}
                />
                {range.label}
              </label>
            ))}
          </div>

          {timeRange === 'custom' && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>開始日期</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>結束日期</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)' }} />
              </div>
            </div>
          )}
        </Card>

        {/* 內容選項 */}
        <Card title="內容選項" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeCharts}
                onChange={e => setIncludeCharts(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>包含圖表</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeMetrics}
                onChange={e => setIncludeMetrics(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>包含主要指標</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={e => setIncludeDetails(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>包含詳細數據</span>
            </label>
          </div>
        </Card>

        {/* 輸出格式 */}
        <Card title="輸出格式" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {EXPORT_FORMATS.map(fmt => (
              <button
                key={fmt.id}
                onClick={() => setExportFormat(fmt.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: `2px solid ${exportFormat === fmt.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: exportFormat === fmt.id ? 'var(--accent-bg)' : 'transparent',
                  color: exportFormat === fmt.id ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                <div>{fmt.icon}</div>
                <div>{fmt.label}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* 生成按鈕 */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <Btn
            onClick={handleGenerateReport}
            disabled={selectedCount === 0 || isGenerating}
            style={{ flex: 1 }}
          >
            {isGenerating ? '生成中…' : `生成報表 (${selectedCount} 模組)`}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// 報表預覽組件
function ReportPreview({ config, stats }) {
  if (!config) return null;

  // Use backend data if available, otherwise fall back to stats
  const backendData = config.backendData || {};
  const riskData = backendData.risk || (stats?.risk || {});
  const complianceData = backendData.compliance || (stats?.nist || {});
  const scanData = backendData.scan_efficiency || {};
  const remediationData = backendData.remediation || {};
  const auditData = backendData.audit || {};

  const renderRiskOverview = () => (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--accent)', paddingBottom: 8 }}>
        🔴 風險概覽報表
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Critical', value: riskData?.critical || 0, color: 'var(--critical)' },
          { label: 'High', value: riskData?.high || 0, color: 'var(--high)' },
          { label: 'Medium', value: riskData?.medium || 0, color: 'var(--medium)' },
          { label: 'Low', value: riskData?.low || 0, color: 'var(--low)' },
          { label: 'Info', value: riskData?.info || 0, color: 'var(--info)' },
        ].map(item => (
          <div key={item.label} style={{
            padding: 12,
            borderRadius: 8,
            background: 'var(--surface2)',
            borderLeft: `4px solid ${item.color}`,
          }}>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', padding: 12, background: 'var(--surface2)', borderRadius: 6 }}>
        <strong>高風險資產：</strong> 確認 {(riskData?.critical || 0) + (riskData?.high || 0)} 項 Critical/High 級弱點需優先修復
      </div>
    </div>
  );

  const renderCompliance = () => (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--accent)', paddingBottom: 8 }}>
        ☑ 合規性報表
      </h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>NIST 合規率</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: complianceData?.pass_rate >= 80 ? 'var(--success)' : 'var(--warning)' }}>
            {complianceData?.pass_rate ?? 0}%
          </div>
        </div>
        <div style={{ padding: 12, borderRadius: 8, background: 'var(--surface2)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>通過/失敗控制</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            <div>✓ {complianceData?.passed || 0} 通過</div>
            <div>✗ {complianceData?.failed || 0} 失敗</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderScanEfficiency = () => (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--accent)', paddingBottom: 8 }}>
        📊 掃描效能報表
      </h4>
      <div style={{
        padding: 12,
        borderRadius: 8,
        background: 'var(--surface2)',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>本期掃描數：{scanData?.scan_count || 0} 次</span>
          <span>發現弱點：{scanData?.vulnerability_count || 0} 項</span>
        </div>
        <div>
          <span>平均 EPSS：{(scanData?.average_epss || 8.2).toFixed(2)} (高優先修復)</span>
        </div>
      </div>
    </div>
  );

  const renderRemediationProgress = () => (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--accent)', paddingBottom: 8 }}>
        ✓ 修復進度報表
      </h4>
      <div style={{
        padding: 12,
        borderRadius: 8,
        background: 'var(--surface2)',
        fontSize: 12,
      }}>
        <div style={{ marginBottom: 8 }}>修復率：<strong style={{ color: 'var(--success)' }}>{(remediationData?.remediation_rate || 42).toFixed(1)}%</strong></div>
        <div style={{ marginBottom: 8 }}>平均修復週期：<strong>{(remediationData?.average_remediation_days || 14).toFixed(1)} 天</strong></div>
        <div>未完成項目：<strong style={{ color: 'var(--warning)' }}>{remediationData?.pending_count || 18} 項</strong></div>
      </div>
    </div>
  );

  const renderAuditLog = () => (
    <div style={{ marginBottom: 24 }}>
      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, borderBottom: '2px solid var(--accent)', paddingBottom: 8 }}>
        📋 審計日誌報表
      </h4>
      <div style={{
        padding: 12,
        borderRadius: 8,
        background: 'var(--surface2)',
        fontSize: 12,
      }}>
        <div style={{ marginBottom: 8 }}>本期操作數：<strong>{auditData?.operation_count || 234}</strong> 條</div>
        <div style={{ marginBottom: 8 }}>異常檢測：<strong style={{ color: 'var(--warning)' }}>{auditData?.anomaly_count || 3}</strong> 項</div>
        <div>權限變更：<strong>{auditData?.permission_changes || 2}</strong> 次</div>
      </div>
    </div>
  );

  const renderModule = (moduleId) => {
    switch (moduleId) {
      case 'risk_overview':
        return renderRiskOverview();
      case 'compliance':
        return renderCompliance();
      case 'scan_efficiency':
        return renderScanEfficiency();
      case 'remediation_progress':
        return renderRemediationProgress();
      case 'audit_log':
        return renderAuditLog();
      default:
        return null;
    }
  };

  return (
    <div style={{ marginTop: 24, padding: 20, background: 'white', color: '#000', borderRadius: 8 }}>
      <div style={{ marginBottom: 24, paddingBottom: 16, borderBottom: '2px solid #ddd' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: 20, fontWeight: 700 }}>{config.title}</h2>
        <div style={{ fontSize: 12, color: '#666' }}>
          生成時間：{new Date(config.generatedAt).toLocaleString('zh-TW')}
        </div>
        {config.description && (
          <p style={{ fontSize: 13, color: '#555', margin: '8px 0 0 0' }}>{config.description}</p>
        )}
      </div>

      {config.modules.map(moduleId => renderModule(moduleId))}

      <div style={{ marginTop: 24, fontSize: 11, color: '#999', borderTop: '1px solid #ddd', paddingTop: 12 }}>
        本報表由 SecVision ISMS Portal 自動生成，僅供內部使用。
      </div>
    </div>
  );
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildReportCsv(config, stats) {
  const backendData = config.backendData || {};
  const riskData = backendData.risk || (stats?.risk || {});
  const complianceData = backendData.compliance || (stats?.nist || {});
  const scanData = backendData.scan_efficiency || {};
  const remediationData = backendData.remediation || {};
  const auditData = backendData.audit || {};

  const rows = [
    ['Module', 'Metric', 'Value'],
  ];

  if (config.modules.includes('risk_overview')) {
    rows.push(['風險概覽', 'Critical', riskData?.critical ?? 0]);
    rows.push(['風險概覽', 'High', riskData?.high ?? 0]);
    rows.push(['風險概覽', 'Medium', riskData?.medium ?? 0]);
    rows.push(['風險概覽', 'Low', riskData?.low ?? 0]);
    rows.push(['風險概覽', 'Info', riskData?.info ?? 0]);
  }

  if (config.modules.includes('compliance')) {
    rows.push(['合規性', 'Passed', complianceData?.passed ?? 0]);
    rows.push(['合規性', 'Failed', complianceData?.failed ?? 0]);
    rows.push(['合規性', 'Pass Rate', `${complianceData?.pass_rate ?? 0}%`]);
  }

  if (config.modules.includes('scan_efficiency')) {
    rows.push(['掃描效能', '掃描次數', scanData?.scan_count ?? 0]);
    rows.push(['掃描效能', '發現弱點', scanData?.vulnerability_count ?? 0]);
    rows.push(['掃描效能', '平均 EPSS', (scanData?.average_epss ?? 8.2).toFixed(2)]);
  }

  if (config.modules.includes('remediation_progress')) {
    rows.push(['修復進度', '修復率', `${(remediationData?.remediation_rate || 42).toFixed(1)}%`]);
    rows.push(['修復進度', '平均修復週期', `${(remediationData?.average_remediation_days || 14).toFixed(1)} 天`]);
    rows.push(['修復進度', '未完成項目', remediationData?.pending_count ?? 18]);
  }

  if (config.modules.includes('audit_log')) {
    rows.push(['審計日誌', '本期操作數', auditData?.operation_count ?? 234]);
    rows.push(['審計日誌', '異常檢測', auditData?.anomaly_count ?? 3]);
    rows.push(['審計日誌', '權限變更', auditData?.permission_changes ?? 2]);
  }

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function buildReportHtml(config, stats) {
  const backendData = config.backendData || {};
  const riskData = backendData.risk || (stats?.risk || {});
  const complianceData = backendData.compliance || (stats?.nist || {});
  const scanData = backendData.scan_efficiency || {};
  const remediationData = backendData.remediation || {};
  const auditData = backendData.audit || {};

  const moduleRows = config.modules.map(moduleId => {
    const module = REPORT_MODULES[moduleId];
    const summary = {
      risk_overview: `Critical: ${riskData?.critical ?? 0}，High: ${riskData?.high ?? 0}，Medium: ${riskData?.medium ?? 0}，Low: ${riskData?.low ?? 0}，Info: ${riskData?.info ?? 0}`,
      compliance: `Passed: ${complianceData?.passed ?? 0}，Failed: ${complianceData?.failed ?? 0}，Pass Rate: ${complianceData?.pass_rate ?? 0}%`,
      scan_efficiency: `掃描次數: ${scanData?.scan_count ?? 0}，發現弱點: ${scanData?.vulnerability_count ?? 0}，平均 EPSS: ${(scanData?.average_epss ?? 8.2).toFixed(2)}`,
      remediation_progress: `修復率：${(remediationData?.remediation_rate || 42).toFixed(1)}%，平均修復週期：${(remediationData?.average_remediation_days || 14).toFixed(1)} 天，未完成項目：${remediationData?.pending_count ?? 18} 項`,
      audit_log: `本期操作數：${auditData?.operation_count ?? 234}，異常檢測：${auditData?.anomaly_count ?? 3}，權限變更：${auditData?.permission_changes ?? 2}`,
    };
    return `<section style="margin-bottom:24px;">
      <h3 style="font-size:16px;margin-bottom:8px;">${module.icon} ${module.name}</h3>
      <p style="margin:0 0 10px 0;color:#555;">${module.description}</p>
      <div style="padding:12px;background:#f7f9fc;border-radius:8px;font-size:14px;color:#222;">${summary[moduleId] ?? '無可用數據'}</div>
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<title>${config.title}</title>
<style>body{font-family:system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;line-height:1.5;color:#111;background:#fff;padding:24px;}h1{font-size:24px;margin-bottom:4px;}h2{font-size:16px;margin-top:24px;}p{margin:8px 0;}section{margin-bottom:24px;}</style>
</head>
<body>
  <header>
    <h1>${config.title}</h1>
    <p style="margin:4px 0 12px 0;color:#555;">${config.description || '由 SecVision NES 自動生成的資安報表'}</p>
    <p style="font-size:13px;color:#777;">生成時間：${new Date(config.generatedAt).toLocaleString('zh-TW')}</p>
  </header>
  ${moduleRows}
  <footer style="margin-top:40px;font-size:12px;color:#777;">SecVision ISMS Portal 報表輸出</footer>
</body>
</html>`;
}

function exportReport(config, stats) {
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filenameBase = `secvision-report-${ts}`;
  if (config.exportFormat === 'csv') {
    const csv = buildReportCsv(config, stats);
    downloadFile(`${filenameBase}.csv`, csv, 'text/csv;charset=utf-8;');
    alert('✅ CSV 報表已下載');
  } else if (config.exportFormat === 'html') {
    const html = buildReportHtml(config, stats);
    downloadFile(`${filenameBase}.html`, html, 'text/html;charset=utf-8;');
    alert('✅ HTML 報表已下載');
  } else if (config.exportFormat === 'pdf') {
    const html = buildReportHtml(config, stats);
    const win = window.open();
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      win.print();
    } else {
      alert('⚠️ 無法開啟列印視窗，請允許彈出視窗。');
    }
  }
}

function ReportPage({ onNavigate, stats }) {
  const [reportConfig, setReportConfig] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleExport = (config) => {
    setReportConfig(config);
    setShowPreview(true);
    exportReport(config, stats);
  };

  return (
    <div>
      <PageHeader
        title="Report Generator"
        subtitle="模組化報表生成器，為執行主管提供決策支援數據"
        actions={
          showPreview && reportConfig ? (
            <Btn variant="secondary" onClick={() => setShowPreview(false)}>← 返回編輯</Btn>
          ) : null
        }
      />

      {!showPreview ? (
        <Card>
          <ReportBuilder stats={stats} onExport={handleExport} />
        </Card>
      ) : (
        <ReportPreview config={reportConfig} stats={stats} />
      )}
    </div>
  );
}
