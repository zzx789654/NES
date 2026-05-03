// Dashboard Page

const { useState, useEffect } = React;

const RISK_COLORS = [
  'oklch(0.60 0.22 25)',
  'oklch(0.68 0.20 45)',
  'oklch(0.76 0.17 72)',
  'oklch(0.70 0.14 195)',
  'oklch(0.62 0.06 240)',
];

function DashboardPage({ onNavigate, onStatsChange }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-TW');
  };

  const loadStats = () => {
    setLoading(true);
    return APIClient.getDashboardStats()
      .then(data => {
        setStats(data);
        setError('');
        setLoading(false);
        setLastRefresh(new Date());
        if (onStatsChange) onStatsChange();
      })
      .catch(err => {
        setError(err.message || '無法載入儀表板資料');
        setStats(null);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)' }}>載入中…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: 'var(--text2)' }}>
        <p>{error}</p>
        <Btn variant="secondary" onClick={loadStats}>重新整理</Btn>
      </div>
    );
  }

  const risk = stats.risk || {};
  const nist = stats.nist || {};
  const criticalHigh = (risk.critical || 0) + (risk.high || 0);
  const warningMessage = risk.critical > 0
    ? '系統偵測到 Critical 弱點，建議優先處理高風險項目。'
    : (nist.pass_rate ?? 0) < 70
      ? 'NIST 合規率低於 70%，請檢視稽核細節並補強控制措施。'
      : '';

  const chartData = {
    labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
    datasets: [{
      data: [risk.critical || 0, risk.high || 0, risk.medium || 0, risk.low || 0, risk.info || 0],
      backgroundColor: RISK_COLORS,
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  const detailMetrics = [
    { label: 'Critical', value: risk.critical ?? 0, color: 'var(--critical)' },
    { label: 'High',     value: risk.high ?? 0,     color: 'var(--high)' },
    { label: 'Medium',   value: risk.medium ?? 0,   color: 'var(--medium)' },
    { label: 'Low',      value: risk.low ?? 0,      color: 'var(--low)' },
    { label: 'Info',     value: risk.info ?? 0,     color: 'var(--info)' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`資安概覽 · 最後更新：${lastRefresh ? lastRefresh.toLocaleString('zh-TW', { hour12: false }) : '—'}`}
        actions={<Btn variant="secondary" onClick={loadStats}>↺ 重新整理</Btn>}
      />

      {warningMessage ? (
        <div style={{marginBottom:20,padding:'14px 18px',borderRadius:'var(--r)',background:'oklch(0.08 0.20 25 / 0.12)',border:'1px solid var(--critical)',color:'var(--text)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <span style={{fontWeight:600}}>{warningMessage}</span>
          <Btn variant="ghost" size="sm" onClick={() => onNavigate('vulnscan')}>查看弱點</Btn>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard
          label="總弱點數"
          value={risk.total ?? 0}
          sub={`掃描數: ${stats.scan_count ?? 0}`}
          color="var(--critical)"
          onClick={() => onNavigate('vulnscan')}
        />
        <StatCard
          label="高風險弱點"
          value={criticalHigh}
          sub={`Critical + High`}
          color="var(--high)"
          onClick={() => onNavigate('vulnscan')}
        />
        <StatCard
          label="NIST 合規率"
          value={`${nist.pass_rate?.toFixed(1) ?? 0}%`}
          sub={`稽核數: ${stats.audit_scan_count ?? 0}`}
          color="var(--accent)"
          onClick={() => onNavigate('nist')}
        />
        <StatCard
          label="最新資料"
          value={stats.latest_scan_date ? formatDate(stats.latest_scan_date) : formatDate(stats.latest_audit_date)}
          sub={`資料來源：API`}
          color="var(--info)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card title="快速操作">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
            <Btn variant="primary" size="sm" onClick={() => onNavigate('vulnscan')}>查看弱點清單</Btn>
            <Btn variant="secondary" size="sm" onClick={() => onNavigate('nist')}>檢視 NIST 報表</Btn>
            <Btn variant="ghost" size="sm" onClick={loadStats}>手動重新整理</Btn>
          </div>
          <div style={{ marginTop: 14, color: 'var(--text2)', fontSize: 12, lineHeight: 1.6 }}>
            本儀表板呈現最近一次掃描與稽核概況，並提供高風險弱點與 NIST 合規率的快速導引。
          </div>
        </Card>

        <Card title="弱點風險分布" action={<Btn variant="ghost" size="sm" onClick={() => onNavigate('vulnscan')}>查看詳情</Btn>}>
          <ChartCanvas type="doughnut" data={chartData} height={230} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '62%' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 14 }}>
            {detailMetrics.map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 'var(--rsm)' }}>
                <span style={{ color: 'var(--text2)', fontSize: 12 }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="系統概覽" action={<span style={{ fontSize: 11, color: 'var(--text3)' }}>API 資料來源</span>}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>掃描數</span>
              <strong>{stats.scan_count ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>稽核數</span>
              <strong>{stats.audit_scan_count ?? 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>最新掃描日期</span>
              <strong>{formatDate(stats.latest_scan_date)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>最新稽核日期</span>
              <strong>{formatDate(stats.latest_audit_date)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>資料更新時間</span>
              <strong>{lastRefresh ? lastRefresh.toLocaleString('zh-TW', { hour12: false }) : '—'}</strong>
            </div>
          </div>
        </Card>

        <Card title="NIST 合規摘要" action={<Btn variant="ghost" size="sm" onClick={() => onNavigate('nist')}>檢視稽核</Btn>}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{nist.pass_rate?.toFixed(1) ?? 0}%</div>
            <div style={{ color: 'var(--text2)', fontSize: 12 }}>最近一次稽核通過率 / 失敗比率</div>
            <ProgressBar value={nist.pass_rate ?? 0} color={nist.pass_rate >= 75 ? 'var(--success)' : nist.pass_rate >= 50 ? 'var(--accent)' : 'var(--warning)'} />
            <div style={{ display: 'grid', gap: 8, color: 'var(--text2)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>通過</span><strong>{nist.passed ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>失敗</span><strong>{nist.failed ?? 0}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>警示</span><strong>{nist.warning ?? 0}</strong></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
