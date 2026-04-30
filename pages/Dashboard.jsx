// Dashboard Page

const { useState, useEffect } = React;

function DashboardPage({ onNavigate, onStatsChange }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    setLoading(true);
    return APIClient.getDashboardStats()
      .then(data => {
        setStats(data);
        setError('');
        setLoading(false);
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
  const chartData = {
    labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
    datasets: [{
      data: [risk.critical, risk.high, risk.medium, risk.low, risk.info],
      backgroundColor: ['oklch(0.60 0.22 25)', 'oklch(0.68 0.20 45)', 'oklch(0.76 0.17 72)', 'oklch(0.70 0.14 195)', 'oklch(0.62 0.06 240)'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="實際 API 資料顯示，已移除本地 Demo 模式"
        actions={<Btn variant="secondary" onClick={loadStats}>↺ 重新整理</Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="總弱點數" value={risk.total ?? 0} sub={`掃描數: ${stats.scan_count ?? 0}`} color="var(--critical)" onClick={() => onNavigate('vulnscan')} />
        <StatCard label="Critical" value={risk.critical ?? 0} sub={`High: ${risk.high ?? 0}`} color="var(--critical)" onClick={() => onNavigate('vulnscan')} />
        <StatCard label="NIST 合規率" value={`${nist.pass_rate?.toFixed(1) ?? 0}%`} sub={`稽核數: ${stats.audit_scan_count ?? 0}`} color="var(--accent)" onClick={() => onNavigate('nist')} />
        <StatCard label="High" value={risk.high ?? 0} sub={`Medium: ${risk.medium ?? 0}`} color="var(--high)" onClick={() => onNavigate('vulnscan')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="弱點風險分布">
          <ChartCanvas type="doughnut" data={chartData} height={260} options={{ plugins: { legend: { position: 'bottom' } }, cutout: '62%' }} />
        </Card>

        <Card title="系統概覽">
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
              <strong>{stats.latest_scan_date ?? '—'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text2)' }}>
              <span>最新稽核日期</span>
              <strong>{stats.latest_audit_date ?? '—'}</strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
