// Dashboard Page

const { useState, useEffect } = React;

function DashboardPage({ onNavigate }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    setStats(MockAPI.getDashboardStats());
  }, []);

  if (!stats) return <div style={{padding:40,color:'var(--text2)'}}>載入中…</div>;

  const { totalVulns, prevVulns, severityCounts, prevSeverityCounts, nistCompliance, recentActivity, trendData } = stats;
  const vulnDelta = totalVulns - prevVulns;

  // Donut chart data
  const donutData = {
    labels: ['Critical','High','Medium','Low','Info'],
    datasets: [{
      data: [severityCounts.Critical, severityCounts.High, severityCounts.Medium, severityCounts.Low, severityCounts.Info||0],
      backgroundColor: ['oklch(0.60 0.22 25)','oklch(0.68 0.20 45)','oklch(0.76 0.17 72)','oklch(0.70 0.14 195)','oklch(0.62 0.06 240)'],
      borderWidth: 0, hoverOffset: 6,
    }]
  };

  // Trend line chart
  const trendChartData = {
    labels: trendData.labels,
    datasets: [
      { label:'Critical', data:trendData.critical, borderColor:'oklch(0.60 0.22 25)', backgroundColor:'oklch(0.60 0.22 25 / 0.08)', tension:0.4, fill:false, pointRadius:4 },
      { label:'High',     data:trendData.high,     borderColor:'oklch(0.68 0.20 45)', backgroundColor:'oklch(0.68 0.20 45 / 0.08)', tension:0.4, fill:false, pointRadius:4 },
      { label:'Medium',   data:trendData.medium,   borderColor:'oklch(0.76 0.17 72)', backgroundColor:'oklch(0.76 0.17 72 / 0.08)', tension:0.4, fill:false, pointRadius:4 },
    ]
  };

  // NIST bar chart
  const nistData = MockAPI.getNISTCSF();
  const nistBarData = {
    labels: nistData.functions.map(f => f.id),
    datasets: [{
      label: '合規率 %',
      data: nistData.functions.map(f => f.score),
      backgroundColor: nistData.functions.map(f => f.color + 'bb'),
      borderColor: nistData.functions.map(f => f.color),
      borderWidth: 1,
      borderRadius: 4,
    }]
  };


  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`資訊安全管理系統概覽 · 最後更新：${new Date().toLocaleDateString('zh-TW')}`}
        actions={
          <Btn variant="secondary" size="sm" onClick={() => setStats(MockAPI.getDashboardStats())}>↺ 重新整理</Btn>
        }
      />

      {/* Stat Cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14,marginBottom:24}}>
        <StatCard label="總弱點數" value={totalVulns} sub={`前次: ${prevVulns}`} trend={vulnDelta} color="var(--critical)" onClick={() => onNavigate('vulnscan')} />
        <StatCard label="Critical 弱點" value={severityCounts.Critical} sub={`前次: ${prevSeverityCounts.Critical}`} trend={severityCounts.Critical - prevSeverityCounts.Critical} color="var(--critical)" onClick={() => onNavigate('vulnscan')} />
        <StatCard label="NIST CSF 合規率" value={nistCompliance+'%'} sub="六大功能平均" color="var(--accent)" onClick={() => onNavigate('nist')} />
        <StatCard label="High 弱點" value={severityCounts.High} sub={`前次: ${prevSeverityCounts.High}`} trend={severityCounts.High - prevSeverityCounts.High} color="var(--high)" onClick={() => onNavigate('vulnscan')} />
      </div>

      {/* Row 2: Donut + Trend */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16,marginBottom:16}}>
        <Card title="弱點嚴重等級分佈" action={<Btn size="sm" variant="ghost" onClick={() => onNavigate('vulnscan')}>查看全部 →</Btn>}>
          <ChartCanvas type="doughnut" data={donutData} height={200} options={{ plugins:{ legend:{ position:'bottom', labels:{ padding:10, boxWidth:12 } } }, cutout:'65%' }} />
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:14}}>
            {[['Critical',severityCounts.Critical,'var(--critical)'],['High',severityCounts.High,'var(--high)'],['Medium',severityCounts.Medium,'var(--medium)'],['Low',severityCounts.Low,'var(--low)']].map(([k,v,c])=>(
              <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'var(--surface2)',borderRadius:'var(--rsm)',padding:'6px 10px'}}>
                <span style={{fontSize:12,color:'var(--text2)'}}>{k}</span>
                <span style={{fontWeight:700,color:c,fontFamily:'var(--font-mono)',fontSize:14}}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="弱點風險趨勢" action={<span style={{fontSize:11,color:'var(--text3)'}}>近 5 季</span>}>
          <ChartCanvas type="line" data={trendChartData} height={240}
            options={{ plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true, max:12 } } }} />
        </Card>
      </div>

      {/* Row 3: NIST + OWASP + Activity */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        {/* NIST */}
        <Card title="NIST CSF 2.0 合規率" action={<Btn size="sm" variant="ghost" onClick={() => onNavigate('nist')}>查看 →</Btn>}>
          <ChartCanvas type="bar" data={nistBarData} height={160}
            options={{ plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, max:100, ticks:{ callback:v=>v+'%' } } }, indexAxis:'x' }} />
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:6}}>
            {nistData.functions.slice(0,3).map(f => (
              <div key={f.id}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                  <span style={{color:'var(--text2)'}}>{f.id} {f.label}</span>
                  <span style={{fontWeight:600,fontFamily:'var(--font-mono)',color:f.color}}>{f.score}%</span>
                </div>
                <ProgressBar value={f.score} color={f.color} height={5} showLabel={false} />
              </div>
            ))}
          </div>
        </Card>

        {/* NIST SP800 */}
        <Card title="SP 800-53 控制家族" action={<Btn size="sm" variant="ghost" onClick={() => onNavigate('nist')}>查看 →</Btn>}>
          {(() => {
            const sp = MockAPI.getNIST80053();
            const low = sp.families.filter(f=>f.score<50);
            const mid = sp.families.filter(f=>f.score>=50&&f.score<75);
            const ok  = sp.families.filter(f=>f.score>=75);
            const avg = Math.round(sp.families.reduce((s,f)=>s+f.score,0)/sp.families.length);
            return <>
              <div style={{textAlign:'center',marginBottom:12}}>
                <div style={{fontSize:28,fontWeight:700,fontFamily:'var(--font-mono)',color:'var(--accent)'}}>{avg}%</div>
                <div style={{fontSize:11,color:'var(--text2)'}}>17 控制家族平均</div>
              </div>
              <ProgressBar value={avg} height={7} />
              <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:5}}>
                {[['合格 ≥75%',ok.length,'var(--success)'],['待改善 50-75%',mid.length,'var(--accent)'],['需關注 <50%',low.length,'var(--warning)']].map(([k,v,c])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 8px',background:'var(--surface2)',borderRadius:'var(--rsm)'}}>
                    <span style={{fontSize:12,color:'var(--text2)'}}>{k}</span>
                    <span style={{fontWeight:700,color:c,fontFamily:'var(--font-mono)'}}>{v}</span>
                  </div>
                ))}
              </div>
            </>;
          })()}
        </Card>

        {/* Activity Timeline */}
        <Card title="最近活動" action={<span style={{fontSize:11,color:'var(--text3)'}}>近 7 筆</span>}>
          <Timeline items={recentActivity} />
        </Card>
      </div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
