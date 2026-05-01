// Dashboard Page — redesigned UI

const { useState, useEffect } = React;

function RiskBar({ label, value, total, color, colorBg }) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <span style={{ fontSize:12, color:'var(--text2)', fontWeight:500 }}>{label}</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color }}>{value.toLocaleString()}</span>
          <span style={{ fontSize:11, color:'var(--text3)', minWidth:32, textAlign:'right' }}>{pct}%</span>
        </div>
      </div>
      <div style={{ height:6, background:'var(--surface2)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:pct+'%', height:'100%', background:color, borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function BigKPI({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick}
      style={{ background:'var(--surface)', border:'1px solid var(--border)', borderTop:`3px solid ${color}`,
        borderRadius:'var(--rlg)', padding:'16px 18px', cursor:onClick?'pointer':'default', transition:'all 0.2s' }}
      onMouseEnter={e=>{ if(onClick){ e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-1px)'; }}}
      onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform=''; }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:'var(--text2)', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:32, fontWeight:700, lineHeight:1, color }}>{value}</div>
      {sub && <div style={{ marginTop:6, fontSize:12, color:'var(--text2)' }}>{sub}</div>}
    </div>
  );
}

function PasswordExpiryAlert({ user }) {
  if (!user || user.password_expires_days === 0) return null;
  const changed = new Date(user.password_changed_at);
  const expiry = new Date(changed.getTime() + user.password_expires_days * 86400000);
  const daysLeft = Math.ceil((expiry - Date.now()) / 86400000);
  if (daysLeft > 14) return null;

  const isExpired = daysLeft <= 0;
  const color = isExpired ? 'var(--critical)' : 'var(--warning)';
  const bg = isExpired ? 'var(--critical-bg)' : 'var(--warning-bg)';
  const msg = isExpired
    ? `您的密碼已到期 ${Math.abs(daysLeft)} 天，請立即更改密碼。`
    : `您的密碼將在 ${daysLeft} 天後到期，請及早更改。`;

  return (
    <div style={{ marginBottom:20, padding:'12px 16px', borderRadius:'var(--r)',
      background:bg, border:`1px solid ${color}`, display:'flex', alignItems:'center', gap:10 }}>
      <span style={{ fontSize:18 }}>{isExpired ? '🔒' : '⚠️'}</span>
      <span style={{ fontSize:13, color, fontWeight:500 }}>{msg}</span>
    </div>
  );
}

function DashboardPage({ onNavigate, onStatsChange, currentUser }) {
  const [stats, setStats] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    setLoading(true);
    return Promise.all([
      APIClient.getDashboardStats(),
      APIClient.getAllScans().catch(() => []),
    ]).then(([data, scans]) => {
      setStats(data);
      setRecentScans((scans || []).slice(0, 5));
      setError('');
      setLoading(false);
      if (onStatsChange) onStatsChange();
    }).catch(err => {
      setError(err.message || '無法載入儀表板資料');
      setStats(null);
      setLoading(false);
    });
  };

  useEffect(() => { loadStats(); }, []);

  if (loading) {
    return <div style={{ padding:40, color:'var(--text2)', textAlign:'center' }}>載入中…</div>;
  }

  if (error) {
    return (
      <div style={{ padding:40, color:'var(--text2)' }}>
        <p style={{ marginBottom:12 }}>{error}</p>
        <Btn variant="secondary" onClick={loadStats}>重新整理</Btn>
      </div>
    );
  }

  const risk = stats.risk || {};
  const nist = stats.nist || {};
  const total = risk.total || 0;

  const riskItems = [
    { label:'Critical', value:risk.critical||0, color:'var(--critical)' },
    { label:'High',     value:risk.high||0,     color:'var(--high)' },
    { label:'Medium',   value:risk.medium||0,   color:'var(--medium)' },
    { label:'Low',      value:risk.low||0,      color:'var(--low)' },
    { label:'Info',     value:risk.info||0,     color:'var(--info)' },
  ];

  const chartData = {
    labels: riskItems.map(r => r.label),
    datasets: [{
      data: riskItems.map(r => r.value),
      backgroundColor: riskItems.map(r => r.color),
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const nistColor = nist.pass_rate >= 80 ? 'var(--success)' : nist.pass_rate >= 50 ? 'var(--warning)' : 'var(--critical)';

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`概覽 — 最新掃描日期：${stats.latest_scan_date ?? '尚無掃描'}`}
        actions={<Btn variant="secondary" onClick={loadStats}>↺ 重新整理</Btn>}
      />

      {/* Password expiry warning */}
      <PasswordExpiryAlert user={currentUser} />

      {/* Top KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        <BigKPI label="總弱點數" value={(total).toLocaleString()}
          sub={`共 ${stats.scan_count ?? 0} 次掃描`} color="var(--text)"
          onClick={() => onNavigate('vulnscan')} />
        <BigKPI label="Critical" value={(risk.critical??0).toLocaleString()}
          sub={`High: ${risk.high??0}`} color="var(--critical)"
          onClick={() => onNavigate('vulnscan')} />
        <BigKPI label="Medium" value={(risk.medium??0).toLocaleString()}
          sub={`Low: ${risk.low??0}`} color="var(--medium)"
          onClick={() => onNavigate('vulnscan')} />
        <BigKPI label="NIST 合規率" value={`${nist.pass_rate?.toFixed(1)??0}%`}
          sub={`${nist.passed??0} / ${nist.total??0} 項通過`} color={nistColor}
          onClick={() => onNavigate('nist')} />
      </div>

      {/* Main content grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Risk distribution chart */}
        <Card title="弱點風險分布">
          {total > 0 ? (
            <ChartCanvas type="doughnut" data={chartData} height={240}
              options={{ plugins:{ legend:{ position:'bottom', labels:{ padding:12 } } }, cutout:'60%' }} />
          ) : (
            <div style={{ height:240, display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', gap:10, color:'var(--text3)' }}>
              <span style={{ fontSize:36 }}>📭</span>
              <span style={{ fontSize:13 }}>尚無掃描資料</span>
              <Btn size="sm" onClick={() => onNavigate('vulnscan')}>前往上傳掃描</Btn>
            </div>
          )}
        </Card>

        {/* Risk breakdown bars */}
        <Card title="嚴重度明細">
          <div style={{ marginBottom:16 }}>
            {riskItems.map(r => (
              <RiskBar key={r.label} label={r.label} value={r.value} total={total} color={r.color} />
            ))}
          </div>
          <SectionDivider label="NIST 合規" />
          <div style={{ marginBottom:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:12, color:'var(--text2)' }}>整體合規率</span>
              <span style={{ fontSize:14, fontWeight:700, color:nistColor }}>{nist.pass_rate?.toFixed(1)??0}%</span>
            </div>
            <ProgressBar value={nist.pass_rate??0} max={100} color={nistColor} height={8} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:12 }}>
            {[
              { label:'通過', value:nist.passed??0, color:'var(--success)' },
              { label:'失敗', value:nist.failed??0, color:'var(--critical)' },
              { label:'警告', value:nist.warning??0, color:'var(--warning)' },
            ].map(n => (
              <div key={n.label} style={{ textAlign:'center', padding:'8px', background:'var(--surface2)', borderRadius:'var(--rsm)' }}>
                <div style={{ fontSize:18, fontWeight:700, color:n.color }}>{n.value}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{n.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Recent scans */}
        <Card title="最近掃描記錄"
          action={<Btn size="sm" variant="ghost" onClick={() => onNavigate('vulnscan')}>查看全部 →</Btn>}>
          {recentScans.length === 0 ? (
            <div style={{ padding:'20px 0', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
              尚無掃描記錄
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {recentScans.map((s, i) => (
                <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 0', borderBottom: i < recentScans.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                      {s.scan_date ?? '—'} · {s.source === 'nessus_csv' ? 'Nessus CSV' : 'NVD JSON'}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--critical)' }}>{s.vuln_count}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>弱點</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* System overview */}
        <Card title="系統概覽">
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'弱點掃描批次', value:stats.scan_count ?? 0 },
              { label:'合規稽核批次', value:stats.audit_scan_count ?? 0 },
              { label:'最新掃描日期', value:stats.latest_scan_date ?? '—' },
              { label:'最新稽核日期', value:stats.latest_audit_date ?? '—' },
            ].map(item => (
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between',
                alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:13, color:'var(--text2)' }}>{item.label}</span>
                <strong style={{ fontSize:13 }}>{item.value}</strong>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ marginTop:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <Btn variant="secondary" size="sm" onClick={() => onNavigate('vulnscan')}>
              🔍 上傳掃描
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => onNavigate('nist')}>
              🛡️ 上傳稽核
            </Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
