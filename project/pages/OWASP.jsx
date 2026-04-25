// OWASP Page — with scan analysis + fixed ASVS

const { useState, useEffect, useMemo } = React;

const STATUS_OPTIONS = ['待處理','處理中','已緩解','風險接受'];
const SEV_COLOR = { Critical:'var(--critical)', High:'var(--high)', Medium:'var(--medium)', Low:'var(--low)' };
const SEV_BG    = { Critical:'var(--critical-bg)', High:'var(--high-bg)', Medium:'var(--medium-bg)', Low:'var(--low-bg)' };

// ─── OWASP category keyword mapping ──────────────────────────────────────────
const OWASP_KEYWORDS = {
  'web-2021': {
    A01: ['access control','authorization','privilege','directory traversal','path traversal','idor','broken access'],
    A02: ['ssl','tls','crypto','encryption','certificate','heartbleed','cipher','weak hash','drown','openssl','sha1','md5'],
    A03: ['injection','sql','command injection','xss','cross-site scripting','ldap','xpath','log4','log4shell','text4shell','commons text'],
    A04: ['insecure design','business logic','rate limit'],
    A05: ['misconfiguration','hsts','header','default credential','x-frame','csp','cors','clickjack','directory listing'],
    A06: ['outdated','version','apache','nginx','wordpress','jquery','struts','spring','smb','samba','eternal','wannacry','log4j'],
    A07: ['authentication','password','brute force','credential','session','jwt','token','mfa','2fa'],
    A08: ['integrity','deserialization','supply chain','ci/cd','pipeline'],
    A09: ['logging','monitoring','audit log','syslog'],
    A10: ['ssrf','server-side request','internal network','metadata'],
  },
  'api-2023': {
    API1: ['object level','idor','bola','unauthorized access','order','resource id'],
    API2: ['api authentication','api token','jwt','oauth','broken authentication'],
    API3: ['mass assignment','property level','excessive data','over-posting'],
    API4: ['rate limit','resource consumption','dos','denial of service','rapid reset'],
    API5: ['function level','admin endpoint','privilege','unauthorized function'],
    API6: ['business flow','abuse','bot','automation'],
    API7: ['ssrf','request forgery','internal request'],
    API8: ['api misconfiguration','cors','http method','swagger','openapi'],
    API9: ['api inventory','undocumented','deprecated api','shadow api'],
    API10: ['third party','upstream','api consumption'],
  }
};

function mapVulnsToOWASP(vulns, version) {
  const kwMap = OWASP_KEYWORDS[version] || OWASP_KEYWORDS['web-2021'];
  const results = {};
  Object.keys(kwMap).forEach(id => { results[id] = []; });

  vulns.forEach(v => {
    const haystack = [v.name||'', v.description||'', v.synopsis||'', v.cve||'', v.plugin_output||''].join(' ').toLowerCase();
    Object.entries(kwMap).forEach(([id, keywords]) => {
      if (keywords.some(kw => haystack.includes(kw))) {
        results[id].push(v);
      }
    });
  });
  return results;
}

function OWASPPage() {
  const [version, setVersion]         = useState('web-2021');
  const [outerTab, setOuterTab]       = useState('risks');
  const [data, setData]               = useState(null);
  const [expanded, setExpanded]       = useState(null);
  const [search, setSearch]           = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [scanResults, setScanResults]       = useState({}); // version -> { filename, vulns, mapping }
  const [asvsData, setAsvsData]             = useState(null);
  const [asvsExpandedCh, setAsvsExpandedCh] = useState(null);

  useEffect(() => {
    const d = MockAPI.getOWASPData(version);
    setData(d && d.risks ? d : null);
    setExpanded(null);
    setSearch('');
    setSeverityFilter('all');
    setStatusFilter('all');
  }, [version]);

  useEffect(() => {
    setAsvsData(MockAPI.getOWASPData('asvs'));
  }, []);

  const handleScanUpload = (name, text) => {
    const vulns = MockAPI.parseNessusCSV(text);
    if (vulns.length === 0) { alert('❌ 無法解析 CSV，請確認為 Nessus 弱點掃描格式'); return; }
    const mapping = mapVulnsToOWASP(vulns, version);
    setScanResults(prev => ({ ...prev, [version]: { filename: name, vulns, mapping } }));
    alert(`✅ 已載入 ${vulns.length} 筆弱點，正在對應 OWASP 分類…`);
    setOuterTab('scan');
  };

  const handleStatusChange = (riskId, newStatus) => {
    MockAPI.updateOWASPStatus(version, riskId, newStatus);
    setData(prev => prev ? {
      ...prev, risks: prev.risks.map(r => r.id === riskId ? { ...r, status: newStatus } : r)
    } : prev);
  };

  const currentScan = scanResults[version];

  const filtered = useMemo(() => {
    if (!data?.risks) return [];
    return data.risks
      .filter(r => severityFilter === 'all' || r.severity === severityFilter)
      .filter(r => statusFilter  === 'all' || r.status   === statusFilter)
      .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.rank.toLowerCase().includes(search.toLowerCase()));
  }, [data, severityFilter, statusFilter, search]);

  const statusCounts = useMemo(() => {
    if (!data?.risks) return {};
    const c = {};
    data.risks.forEach(r => { c[r.status] = (c[r.status]||0)+1; });
    return c;
  }, [data]);

  const isASVS = version === 'asvs';

  // ─── ASVS view ─────────────────────────────────────────────────────────────
  if (isASVS) {
    if (!asvsData) return <div style={{padding:40,color:'var(--text2)'}}>載入中…</div>;
    const avgL1 = Math.round(asvsData.chapters.reduce((s,c)=>s+c.l1,0)/asvsData.chapters.length);
    const avgL2 = Math.round(asvsData.chapters.reduce((s,c)=>s+c.l2,0)/asvsData.chapters.length);
    const avgL3 = Math.round(asvsData.chapters.reduce((s,c)=>s+c.l3,0)/asvsData.chapters.length);
    const asvsChartData = {
      labels: asvsData.chapters.map(c => c.id),
      datasets: [
        { label:'L1', data:asvsData.chapters.map(c=>c.l1), backgroundColor:'oklch(0.66 0.15 145 / 0.6)', borderColor:'oklch(0.66 0.15 145)', borderWidth:1, borderRadius:3 },
        { label:'L2', data:asvsData.chapters.map(c=>c.l2), backgroundColor:'oklch(0.65 0.155 195 / 0.6)', borderColor:'oklch(0.65 0.155 195)', borderWidth:1, borderRadius:3 },
        { label:'L3', data:asvsData.chapters.map(c=>c.l3), backgroundColor:'oklch(0.68 0.20 45 / 0.6)',   borderColor:'oklch(0.68 0.20 45)',  borderWidth:1, borderRadius:3 },
      ]
    };
    return (
      <div>
        <PageHeader title="OWASP" subtitle="OWASP 安全框架檢視 — Web / API / ASVS 風險追蹤" />
        <VersionSelector version={version} setVersion={setVersion} />
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* Level summary */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
            {[['L1 基本安全',avgL1,'所有 Web 應用程式','var(--success)'],['L2 標準安全',avgL2,'處理敏感資料的應用','var(--accent)'],['L3 進階安全',avgL3,'高安全需求 / 關鍵系統','var(--high)']].map(([k,v,sub,c])=>(
              <div key={k} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--rlg)',padding:'20px',textAlign:'center',borderTop:`3px solid ${c}`}}>
                <div style={{fontSize:32,fontWeight:700,fontFamily:'var(--font-mono)',color:c,lineHeight:1}}>{v}%</div>
                <div style={{fontWeight:600,fontSize:14,marginTop:6}}>{k}</div>
                <div style={{fontSize:11,color:'var(--text2)',marginTop:3}}>{sub}</div>
                <div style={{marginTop:12}}><ProgressBar value={v} color={c} height={7} showLabel={false} /></div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <Card title="ASVS 各章節合規率 — L1 / L2 / L3">
            <ChartCanvas type="bar" data={asvsChartData} height={260}
              options={{ plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true, max:100, ticks:{ callback:v=>v+'%' } } } }} />
          </Card>

          {/* Chapters */}
          {asvsData.chapters.map(ch => (
            <div key={ch.id} style={{background:'var(--surface)',border:`1px solid ${asvsExpandedCh===ch.id?'var(--accent)':'var(--border)'}`,borderRadius:'var(--rlg)',overflow:'hidden',transition:'border-color 0.2s'}}>
              <div onClick={() => setAsvsExpandedCh(asvsExpandedCh===ch.id?null:ch.id)}
                style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',cursor:'pointer',userSelect:'none'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                <div style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:14,color:'var(--accent)',flexShrink:0,width:36}}>{ch.id}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13}}>{ch.name}</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:8,maxWidth:500}}>
                    {[['L1',ch.l1,'var(--success)'],['L2',ch.l2,'var(--accent)'],['L3',ch.l3,'var(--high)']].map(([l,v,c])=>(
                      <div key={l}>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:3}}>
                          <span style={{color:'var(--text3)'}}>{l}</span>
                          <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:c}}>{v}%</span>
                        </div>
                        <ProgressBar value={v} color={c} height={4} showLabel={false} />
                      </div>
                    ))}
                  </div>
                </div>
                <span style={{color:'var(--text3)',fontSize:16,transform:asvsExpandedCh===ch.id?'rotate(90deg)':'none',transition:'transform 0.2s',flexShrink:0}}>›</span>
              </div>
              {asvsExpandedCh === ch.id && (
                <div style={{padding:'0 18px 16px',borderTop:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text3)',marginBottom:8,marginTop:12}}>需求清單</div>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {ch.requirements.map((r,i) => (
                      <div key={i} style={{display:'flex',gap:8,padding:'7px 10px',background:'var(--surface2)',borderRadius:'var(--rsm)',fontSize:13}}>
                        <span style={{color:'var(--accent)',flexShrink:0,fontWeight:700}}>◦</span>
                        <span style={{color:'var(--text2)'}}>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Web / API Top 10 view ──────────────────────────────────────────────────
  return (
    <div>
      <PageHeader title="OWASP" subtitle="OWASP 安全框架檢視 — Web / API / ASVS 風險追蹤"
        actions={outerTab==='scan' ? null : <FileUpload onFile={handleScanUpload} label="弱點掃描 CSV" hint="上傳 Nessus CSV 進行 OWASP 分類分析" />} />

      <VersionSelector version={version} setVersion={setVersion} />

      <Tabs active={outerTab} onChange={t=>{setOuterTab(t);setSearch('');}} tabs={[
        { id:'risks', label:'風險清單', icon:'📋', count: data?.risks?.length },
        { id:'scan',  label:'掃描分析', icon:'🔍', count: currentScan ? currentScan.vulns.length : undefined },
      ]} />

      <div style={{paddingTop:16}}>
        {/* ── 風險清單 ── */}
        {outerTab === 'risks' && (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Controls */}
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <SearchBar value={search} onChange={setSearch} placeholder="搜尋風險名稱…" />
              <select value={severityFilter} onChange={e=>setSeverityFilter(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'6px 10px',fontSize:13}}>
                <option value="all">全部嚴重等級</option>
                {['Critical','High','Medium','Low'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'6px 10px',fontSize:13}}>
                <option value="all">全部狀態</option>
                {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <span style={{marginLeft:'auto',fontSize:12,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>{filtered.length} / {data?.risks?.length||0} 項</span>
            </div>

            {/* Status pills */}
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {STATUS_OPTIONS.map(s=>(
                <div key={s} onClick={()=>setStatusFilter(statusFilter===s?'all':s)}
                  style={{padding:'4px 12px',borderRadius:99,border:`1px solid ${statusFilter===s?'var(--accent)':'var(--border)'}`,background:statusFilter===s?'var(--accent-bg)':'var(--surface)',cursor:'pointer',fontSize:12,display:'flex',gap:6,alignItems:'center',transition:'all 0.15s'}}>
                  <StatusBadge status={s} />
                  <span style={{fontWeight:700,fontFamily:'var(--font-mono)'}}>{statusCounts[s]||0}</span>
                </div>
              ))}
            </div>

            {/* Risk cards */}
            {filtered.map(risk => {
              const isExpanded = expanded === risk.id;
              const sevC = SEV_COLOR[risk.severity]||'var(--text2)';
              const sevBg = SEV_BG[risk.severity]||'var(--surface2)';
              const scanHits = currentScan?.mapping?.[risk.id] || [];
              return (
                <div key={risk.id} style={{background:'var(--surface)',border:`1px solid ${isExpanded?'var(--accent)':'var(--border)'}`,borderRadius:'var(--rlg)',overflow:'hidden',transition:'border-color 0.2s'}}>
                  <div onClick={() => setExpanded(isExpanded?null:risk.id)}
                    style={{display:'flex',alignItems:'center',gap:14,padding:'14px 18px',cursor:'pointer',userSelect:'none'}}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <div style={{width:54,height:54,borderRadius:'var(--rsm)',background:sevBg,border:`1px solid ${sevC}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:risk.rank.includes(':')?10:12,color:sevC,lineHeight:1.2,textAlign:'center'}}>{risk.rank.replace(':','\n')}</span>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontWeight:600,fontSize:14,lineHeight:1.3}}>{risk.name}</div>
                      <div style={{display:'flex',gap:8,marginTop:5,flexWrap:'wrap',alignItems:'center'}}>
                        <SeverityBadge level={risk.severity} />
                        <span style={{fontSize:11,color:'var(--text3)'}}>普及率: {risk.prevalence}</span>
                        {risk.cwe?.slice(0,2).map(c=><span key={c} style={{fontFamily:'var(--font-mono)',fontSize:10,padding:'1px 6px',borderRadius:99,background:'var(--surface2)',color:'var(--text3)'}}>{c}</span>)}
                        {scanHits.length > 0 && <span style={{fontSize:11,padding:'2px 8px',borderRadius:99,background:'var(--critical-bg)',color:'var(--critical)',fontWeight:700}}>🔍 {scanHits.length} 筆掃描命中</span>}
                      </div>
                    </div>
                    <div onClick={e=>e.stopPropagation()} style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6,flexShrink:0}}>
                      <StatusBadge status={risk.status} />
                      <select value={risk.status} onChange={e=>handleStatusChange(risk.id,e.target.value)}
                        style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'4px 8px',fontSize:11,cursor:'pointer'}}>
                        {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <span style={{color:'var(--text3)',fontSize:16,transform:isExpanded?'rotate(90deg)':'none',transition:'transform 0.2s',flexShrink:0}}>›</span>
                  </div>

                  {isExpanded && (
                    <div style={{padding:'0 18px 18px',borderTop:'1px solid var(--border)'}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,paddingTop:16}}>
                        <div>
                          <SectionDivider label="說明" />
                          <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.7}}>{risk.description}</p>
                        </div>
                        <div>
                          <SectionDivider label="攻擊情境範例" />
                          {risk.examples.map((ex,i)=>(
                            <div key={i} style={{display:'flex',gap:8,padding:'6px 10px',background:'var(--surface2)',borderRadius:'var(--rsm)',marginBottom:5}}>
                              <span style={{color:'var(--warning)',flexShrink:0,fontWeight:700}}>!</span>
                              <span style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>{ex}</span>
                            </div>
                          ))}
                          {risk.cwe && <div style={{marginTop:10}}>
                            <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text3)',marginBottom:5}}>CWE 參考</div>
                            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                              {risk.cwe.map(c=><a key={c} href={`https://cwe.mitre.org/data/definitions/${c.replace('CWE-','')}.html`} target="_blank" rel="noopener" style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 8px',borderRadius:99,background:'var(--accent-bg)',color:'var(--accent)'}}>{c}</a>)}
                            </div>
                          </div>}
                        </div>
                        <div>
                          <SectionDivider label="防護措施" />
                          {risk.mitigations.map((m,i)=>(
                            <div key={i} style={{display:'flex',gap:8,padding:'6px 10px',background:'var(--success-bg)',borderRadius:'var(--rsm)',marginBottom:5}}>
                              <span style={{color:'var(--success)',flexShrink:0,fontWeight:700}}>✓</span>
                              <span style={{fontSize:12,color:'var(--text2)',lineHeight:1.5}}>{m}</span>
                            </div>
                          ))}
                          {scanHits.length > 0 && <>
                            <SectionDivider label={`掃描命中 (${scanHits.length})`} />
                            {scanHits.slice(0,3).map((v,i)=>(
                              <div key={i} style={{padding:'5px 8px',background:'var(--critical-bg)',borderRadius:'var(--rsm)',marginBottom:4,fontSize:11}}>
                                <span style={{color:'var(--critical)',fontFamily:'var(--font-mono)',fontWeight:700}}>{v.risk}</span>
                                <span style={{color:'var(--text2)',marginLeft:6}}>{v.name?.length>50?v.name.slice(0,48)+'…':v.name}</span>
                              </div>
                            ))}
                            {scanHits.length > 3 && <div style={{fontSize:11,color:'var(--text3)',textAlign:'center',marginTop:4}}>還有 {scanHits.length-3} 筆…</div>}
                          </>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && <div style={{padding:'40px',textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>無符合條件的風險項目</div>}
          </div>
        )}

        {/* ── 掃描分析 ── */}
        {outerTab === 'scan' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {!currentScan ? (
              <Card title={`上傳弱點掃描 — 自動對應 ${version==='web-2021'?'OWASP Web Top 10 (2021)':'OWASP API Security (2023)'}`}>
                <FileUpload onFile={handleScanUpload} label="Nessus 弱點掃描 CSV" hint="系統將自動分析弱點名稱、CVE、描述，對應至各 OWASP 風險類別" />
                <div style={{marginTop:14,padding:12,background:'var(--surface2)',borderRadius:'var(--r)',fontSize:12,color:'var(--text2)'}}>
                  <div style={{fontWeight:600,marginBottom:6}}>對應邏輯說明：</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}}>
                    {Object.entries(OWASP_KEYWORDS[version]||{}).slice(0,6).map(([id,kws])=>(
                      <div key={id} style={{fontSize:11}}><span style={{fontFamily:'var(--font-mono)',color:'var(--accent)',fontWeight:700}}>{id}</span> — 關鍵字：{kws.slice(0,3).join(', ')}{kws.length>3?'…':''}</div>
                    ))}
                  </div>
                </div>
              </Card>
            ) : (
              <>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:14}}>📂 {currentScan.filename}</div>
                    <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>共 {currentScan.vulns.length} 筆弱點 · 對應至 {Object.values(currentScan.mapping).filter(v=>v.length>0).length} 個 OWASP 類別</div>
                  </div>
                  <Btn variant="secondary" size="sm" onClick={() => setScanResults(prev => { const n={...prev}; delete n[version]; return n; })}>✕ 清除掃描</Btn>
                </div>

                {/* Summary donut */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:16}}>
                  <Card title="類別命中統計">
                    <ChartCanvas type="doughnut" height={200} data={{
                      labels: Object.keys(currentScan.mapping).filter(k=>currentScan.mapping[k].length>0),
                      datasets: [{
                        data: Object.values(currentScan.mapping).filter(v=>v.length>0).map(v=>v.length),
                        backgroundColor:['oklch(0.60 0.22 25)','oklch(0.68 0.20 45)','oklch(0.76 0.17 72)','oklch(0.70 0.14 195)','oklch(0.66 0.15 145)','oklch(0.65 0.155 195)','oklch(0.78 0.17 72)','oklch(0.62 0.06 240)','oklch(0.72 0.12 300)','oklch(0.68 0.15 160)'],
                        borderWidth:0, hoverOffset:5,
                      }]
                    }} options={{ plugins:{ legend:{ position:'bottom', labels:{ boxWidth:10, padding:8, font:{size:11} } } }, cutout:'60%' }} />
                  </Card>
                  <Card title="各類別弱點對應">
                    <div style={{display:'flex',flexDirection:'column',gap:6,maxHeight:240,overflow:'auto'}}>
                      {(data?.risks||[]).map(risk => {
                        const hits = currentScan.mapping[risk.id] || [];
                        return (
                          <div key={risk.id} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:hits.length>0?'var(--critical-bg)':'var(--surface2)',borderRadius:'var(--rsm)',opacity:hits.length===0?0.5:1}}>
                            <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:11,color:hits.length>0?'var(--critical)':'var(--text3)',width:46,flexShrink:0}}>{risk.id}</span>
                            <span style={{flex:1,fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={risk.name}>{risk.name.split(' ')[0]} {risk.name.split(' ').slice(1,4).join(' ')}</span>
                            <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:hits.length>0?'var(--critical)':'var(--text3)',fontSize:13,flexShrink:0}}>{hits.length}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                {/* Detailed hits per category */}
                {(data?.risks||[]).filter(r=>(currentScan.mapping[r.id]||[]).length>0).map(risk => {
                  const hits = currentScan.mapping[risk.id];
                  return (
                    <Card key={risk.id} title={<span><span style={{fontFamily:'var(--font-mono)',color:'var(--critical)',fontWeight:700}}>{risk.id}</span> — {risk.name}</span>}
                      action={<span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--critical)',fontSize:13}}>{hits.length} 筆命中</span>}>
                      <DataTable compact maxHeight={240} rows={hits}
                        columns={[
                          { key:'risk', label:'等級', sortable:true, render:v=><SeverityBadge level={v} /> },
                          { key:'host', label:'主機', mono:true, sortable:true },
                          { key:'port', label:'Port', mono:true },
                          { key:'plugin_id', label:'Plugin ID', mono:true },
                          { key:'name', label:'弱點名稱', wrap:true },
                          { key:'cve', label:'CVE', mono:true },
                        ]} />
                    </Card>
                  );
                })}

                {Object.values(currentScan.mapping).every(v=>v.length===0) && (
                  <div style={{padding:'40px',textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>掃描結果中未找到符合 OWASP 類別的弱點</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Version selector ─────────────────────────────────────────────────────────
function VersionSelector({ version, setVersion }) {
  return (
    <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
      {[
        { id:'web-2021', label:'Web Top 10', sub:'2021', icon:'🌐' },
        { id:'api-2023', label:'API Security', sub:'2023', icon:'⚡' },
        { id:'asvs',     label:'ASVS 4.0',    sub:'驗證標準', icon:'📐' },
      ].map(v => (
        <button key={v.id} onClick={() => setVersion(v.id)}
          style={{display:'flex',alignItems:'center',gap:10,padding:'10px 16px',borderRadius:'var(--r)',border:`1px solid ${version===v.id?'var(--accent)':'var(--border)'}`,background:version===v.id?'var(--accent-bg)':'var(--surface)',color:version===v.id?'var(--accent)':'var(--text)',cursor:'pointer',transition:'all 0.15s',fontFamily:'var(--font-sans)'}}
          onMouseEnter={e=>{ if(version!==v.id) e.currentTarget.style.borderColor='var(--accent)'; }}
          onMouseLeave={e=>{ if(version!==v.id) e.currentTarget.style.borderColor='var(--border)'; }}>
          <span style={{fontSize:18}}>{v.icon}</span>
          <div>
            <div style={{fontWeight:600,fontSize:13}}>{v.label}</div>
            <div style={{fontSize:10,opacity:0.7}}>{v.sub}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

window.OWASPPage = OWASPPage;
