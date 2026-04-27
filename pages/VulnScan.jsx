// Vulnerability Scan Page — EPSS/VPR quadrants, CVE upload, IP groups

const { useState, useEffect, useMemo, useRef, useCallback } = React;

const SEV_ORDER = { Critical:0, High:1, Medium:2, Low:3, Info:4 };
const SEV_COLOR = { Critical:'oklch(0.60 0.22 25)', High:'oklch(0.68 0.20 45)', Medium:'oklch(0.76 0.17 72)', Low:'oklch(0.70 0.14 195)', Info:'oklch(0.62 0.06 240)' };

// ─── Quadrant Scatter Chart ───────────────────────────────────────────────────
function QuadrantChart({ vulns, xKey, yKey, xLabel, yLabel, xMid, yMid, xMax, yMax, title, quadrantLabels }) {
  const ref = useRef(null);
  const inst = useRef(null);

  const datasets = useMemo(() => {
    const groups = { Critical:[], High:[], Medium:[], Low:[], Info:[] };
    vulns.forEach(v => {
      const x = parseFloat(v[xKey]);
      const y = parseFloat(v[yKey]);
      if (isNaN(x) || isNaN(y)) return;
      (groups[v.risk] || groups.Info).push({ x, y, name: v.name, host: v.host, cve: v.cve, id: v.id });
    });
    return Object.entries(groups).filter(([,pts])=>pts.length>0).map(([risk, data]) => ({
      label: risk, data,
      backgroundColor: SEV_COLOR[risk] + 'cc',
      borderColor: SEV_COLOR[risk],
      pointRadius: 6, pointHoverRadius: 9,
      borderWidth: 1,
    }));
  }, [vulns, xKey, yKey]);

  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) inst.current.destroy();
    inst.current = new Chart(ref.current, {
      type: 'scatter',
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position:'top', labels:{ color:'var(--text2)', font:{size:11}, boxWidth:10, padding:12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pt = ctx.raw;
                return [`${pt.name?.slice(0,50)||'—'}`, `Host: ${pt.host||'—'}  CVE: ${pt.cve||'—'}`, `${xLabel}: ${pt.x}  ${yLabel}: ${pt.y}`];
              }
            },
            backgroundColor:'var(--surface)', titleColor:'var(--text)', bodyColor:'var(--text2)',
            borderColor:'var(--border)', borderWidth:1, padding:10,
          },
          // Quadrant background via annotation plugin — fallback: drawn on canvas
        },
        scales: {
          x: { min:0, max:xMax, title:{ display:true, text:xLabel, color:'var(--text2)', font:{size:11} }, ticks:{ color:'var(--text3)', font:{size:10} }, grid:{ color:'oklch(0.3 0 0 / 0.2)' } },
          y: { min:0, max:yMax, title:{ display:true, text:yLabel, color:'var(--text2)', font:{size:11} }, ticks:{ color:'var(--text3)', font:{size:10} }, grid:{ color:'oklch(0.3 0 0 / 0.2)' } },
        },
      },
      plugins: [{
        id: 'quadrantBg',
        beforeDraw(chart) {
          const { ctx, chartArea: ca, scales: { x, y } } = chart;
          if (!ca) return;
          const mx = x.getPixelForValue(xMid), my = y.getPixelForValue(yMid);
          const quads = [
            { x:ca.left,  y:ca.top,   w:mx-ca.left,   h:my-ca.top,    fill:'oklch(0.76 0.17 72 / 0.07)',  label:quadrantLabels[2] },
            { x:mx,       y:ca.top,   w:ca.right-mx,  h:my-ca.top,    fill:'oklch(0.60 0.22 25 / 0.10)', label:quadrantLabels[0] },
            { x:ca.left,  y:my,       w:mx-ca.left,   h:ca.bottom-my, fill:'oklch(0.66 0.15 145 / 0.07)', label:quadrantLabels[3] },
            { x:mx,       y:my,       w:ca.right-mx,  h:ca.bottom-my, fill:'oklch(0.68 0.20 45 / 0.08)',  label:quadrantLabels[1] },
          ];
          quads.forEach(q => {
            ctx.fillStyle = q.fill;
            ctx.fillRect(q.x, q.y, q.w, q.h);
            ctx.fillStyle = 'oklch(0.5 0 0 / 0.5)';
            ctx.font = 'bold 11px IBM Plex Sans, sans-serif';
            ctx.textAlign = q.x === ca.left ? 'left' : 'right';
            ctx.textBaseline = q.y === ca.top ? 'top' : 'bottom';
            const tx = q.x === ca.left ? q.x+8 : q.x+q.w-8;
            const ty = q.y === ca.top  ? q.y+6  : q.y+q.h-6;
            ctx.fillText(q.label, tx, ty);
          });
          // midlines
          ctx.save();
          ctx.strokeStyle = 'oklch(0.5 0 0 / 0.3)';
          ctx.setLineDash([4,4]);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(mx, ca.top); ctx.lineTo(mx, ca.bottom); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ca.left, my); ctx.lineTo(ca.right, my); ctx.stroke();
          ctx.restore();
        }
      }]
    });
    return () => { if (inst.current) inst.current.destroy(); };
  }, [datasets, xMid, yMid]);

  // Count per quadrant
  const qCounts = useMemo(() => {
    const c = [0,0,0,0];
    vulns.forEach(v => {
      const x = parseFloat(v[xKey]), y = parseFloat(v[yKey]);
      if (isNaN(x)||isNaN(y)) return;
      if (x>=xMid && y>=yMid) c[0]++;
      else if (x>=xMid && y<yMid) c[1]++;
      else if (x<xMid && y>=yMid) c[2]++;
      else c[3]++;
    });
    return c;
  }, [vulns, xKey, yKey, xMid, yMid]);

  const qColors = ['var(--critical)','var(--high)','var(--warning)','var(--success)'];

  return (
    <Card title={title}>
      <div style={{position:'relative',height:320}}>
        <canvas ref={ref}></canvas>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginTop:12}}>
        {quadrantLabels.map((lbl,i) => (
          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',background:'var(--surface2)',borderRadius:'var(--rsm)'}}>
            <span style={{fontSize:11,color:'var(--text2)'}}>{lbl}</span>
            <span style={{fontWeight:700,fontFamily:'var(--font-mono)',color:qColors[i],fontSize:14}}>{qCounts[i]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── IP Group Manager ─────────────────────────────────────────────────────────
function IPGroupManager({ allHosts, selectedIPs, onSelectIPs }) {
  const [groups, setGroups] = useState({});
  const [newGroupName, setNewGroupName] = useState('');
  const [showManager, setShowManager] = useState(false);

  const loadGroups = () => setGroups(MockAPI.getIPGroups());
  useEffect(() => { loadGroups(); }, []);

  const saveGroup = () => {
    if (!newGroupName.trim() || selectedIPs.length === 0) return;
    MockAPI.saveIPGroup(newGroupName.trim(), selectedIPs);
    setNewGroupName('');
    loadGroups();
  };
  const deleteGroup = name => { MockAPI.deleteIPGroup(name); loadGroups(); };
  const applyGroup  = name => onSelectIPs(groups[name] || []);

  const toggleIP = ip => onSelectIPs(prev =>
    prev.includes(ip) ? prev.filter(x=>x!==ip) : [...prev, ip]
  );

  return (
    <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {/* Host multi-select */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'10px 12px'}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text3)',marginBottom:8}}>
          搜尋群組 — 選擇 IP（{selectedIPs.length} 已選）
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5,maxHeight:120,overflow:'auto'}}>
          {allHosts.map(h => {
            const sel = selectedIPs.includes(h);
            return (
              <button key={h} onClick={() => toggleIP(h)}
                style={{padding:'3px 10px',borderRadius:99,fontSize:12,fontFamily:'var(--font-mono)',cursor:'pointer',border:`1px solid ${sel?'var(--accent)':'var(--border)'}`,background:sel?'var(--accent-bg)':'var(--surface2)',color:sel?'var(--accent)':'var(--text2)',transition:'all 0.12s',fontWeight:sel?700:400}}>
                {h}
              </button>
            );
          })}
        </div>
        {selectedIPs.length > 0 && (
          <div style={{marginTop:8,display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={() => onSelectIPs([])} style={{fontSize:11,color:'var(--text3)',cursor:'pointer',background:'none',border:'none',textDecoration:'underline'}}>清除全部</button>
            <button onClick={() => onSelectIPs(allHosts)} style={{fontSize:11,color:'var(--text3)',cursor:'pointer',background:'none',border:'none',textDecoration:'underline'}}>全選</button>
          </div>
        )}
      </div>

      {/* Group pills + save */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.05em',flexShrink:0}}>已儲存群組：</span>
        {Object.keys(groups).length === 0 && <span style={{fontSize:12,color:'var(--text3)',fontStyle:'italic'}}>（尚無）</span>}
        {Object.entries(groups).map(([name, ips]) => (
          <div key={name} style={{display:'inline-flex',alignItems:'center',gap:0,borderRadius:99,border:'1px solid var(--border)',overflow:'hidden',background:'var(--surface2)'}}>
            <button onClick={() => applyGroup(name)}
              style={{padding:'4px 10px',fontSize:12,fontWeight:500,cursor:'pointer',background:'none',border:'none',color:'var(--text)',transition:'background 0.1s'}}
              title={ips.join(', ')}>
              {name} <span style={{color:'var(--text3)',fontFamily:'var(--font-mono)',fontSize:10}}>({ips.length})</span>
            </button>
            <button onClick={() => deleteGroup(name)}
              style={{padding:'4px 8px',fontSize:13,cursor:'pointer',background:'none',border:'none',color:'var(--text3)',borderLeft:'1px solid var(--border)'}}
              title="刪除群組">×</button>
          </div>
        ))}
        {/* Save current selection */}
        <div style={{display:'inline-flex',alignItems:'center',gap:4,marginLeft:'auto'}}>
          <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="群組名稱…"
            style={{width:110,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--rsm)',padding:'4px 8px',fontSize:12,color:'var(--text)'}}
            onKeyDown={e=>e.key==='Enter'&&saveGroup()} />
          <Btn size="sm" variant="secondary" onClick={saveGroup} disabled={!newGroupName.trim()||selectedIPs.length===0}>💾 儲存群組</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function VulnScanPage() {
  const [tab, setTab] = useState('history');
  const [diffBase, setDiffBase] = useState('scan-2024q4');
  const [diffComp, setDiffComp] = useState('scan-2025q1');
  const [diffData, setDiffData] = useState(null);
  const [diffFilter, setDiffFilter] = useState('all');
  const [selectedScan, setSelectedScan] = useState('scan-2025q1');
  const [scanDetail, setScanDetail] = useState(null);
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [selectedIP, setSelectedIP] = useState('');
  const [ipHistory, setIPHistory] = useState([]);
  const [allHosts, setAllHosts] = useState([]);
  const [uploadedScans, setUploadedScans] = useState({});
  const [visibleCols, setVisibleCols] = useState(['risk','host','port','plugin_id','name','cve','cvss','epss','vpr']);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedIPs, setSelectedIPs] = useState([]);  // multi-IP filter

  useEffect(() => {
    setAllHosts(MockAPI.getAllHosts());
    const detail = MockAPI.getScanDetail('scan-2025q1');
    setScanDetail(detail);
    setDiffData(MockAPI.getDiff('scan-2024q4','scan-2025q1'));
    const hosts = MockAPI.getAllHosts();
    setSelectedIP(hosts[0] || '');
  }, []);

  useEffect(() => {
    if (selectedIP) setIPHistory(MockAPI.getIPHistory(selectedIP));
  }, [selectedIP]);

  useEffect(() => {
    if (selectedScan) setScanDetail(MockAPI.getScanDetail(selectedScan));
  }, [selectedScan]);

  useEffect(() => {
    if (diffBase && diffComp && diffBase !== diffComp)
      setDiffData(MockAPI.getDiff(diffBase, diffComp));
  }, [diffBase, diffComp]);

  const allScans = useMemo(() => {
    const base = MockAPI.getScans();
    return [...base, ...Object.values(uploadedScans).map((u,i) => ({
      id: u.id, name:u.name, date:u.date||'—',
      hostCount: new Set(u.vulns.map(v=>v.host)).size,
      vulnCount: u.vulns.length,
      critical: u.vulns.filter(v=>v.risk==='Critical').length,
      high:     u.vulns.filter(v=>v.risk==='High').length,
    }))];
  }, [uploadedScans]);

  const handleNessusUpload = (name, text) => {
    const vulns = MockAPI.parseNessusCSV(text);
    const id = 'upload-' + Date.now();
    const scanObj = { id, name: name.replace('.csv',''), date: new Date().toISOString().slice(0,10), vulns };
    setUploadedScans(prev => ({ ...prev, [id]: scanObj }));
    alert(`✅ 已載入 ${vulns.length} 筆弱點資料（${name}）`);
  };

  const handleCVEUpload = (name, text) => {
    const vulns = MockAPI.parseCVEJson(text);
    if (!vulns) { alert('❌ 無法解析 CVE JSON，請確認為 NVD CVE API 2.0 格式'); return; }
    const id = 'cve-' + Date.now();
    const enriched = MockAPI.enrichVulns(vulns);
    const scanObj = { id, name: name.replace('.json','') + ' (CVE)', date: new Date().toISOString().slice(0,10), vulns: enriched };
    setUploadedScans(prev => ({ ...prev, [id]: scanObj }));
    alert(`✅ 已載入 ${enriched.length} 筆 CVE 資料（${name}）`);
  };

  // Apply IP group filter
  const activeVulns = useMemo(() => {
    if (!scanDetail) return [];
    const base = scanDetail.vulns;
    return selectedIPs.length > 0 ? base.filter(v => selectedIPs.includes(v.host)) : base;
  }, [scanDetail, selectedIPs]);

  const filteredVulns = useMemo(() => {
    return activeVulns
      .filter(v => sevFilter === 'all' || v.risk === sevFilter)
      .filter(v => !search || (v.host||'').includes(search) || (v.name||'').toLowerCase().includes(search.toLowerCase()) || (v.plugin_id||'').includes(search) || (v.cve||'').includes(search))
      .sort((a,b) => (SEV_ORDER[a.risk]??99)-(SEV_ORDER[b.risk]??99));
  }, [activeVulns, sevFilter, search]);

  const filteredDiff = useMemo(() => {
    if (!diffData) return [];
    return diffData
      .filter(d => diffFilter === 'all' || d.status === diffFilter)
      .filter(d => !search || d.host?.includes(search) || d.name?.toLowerCase().includes(search.toLowerCase()))
      .filter(d => selectedIPs.length === 0 || selectedIPs.includes(d.host));
  }, [diffData, diffFilter, search, selectedIPs]);

  const diffCounts = useMemo(() => {
    if (!diffData) return {};
    return { all:diffData.length, new:diffData.filter(d=>d.status==='new').length, resolved:diffData.filter(d=>d.status==='resolved').length, unchanged:diffData.filter(d=>d.status==='unchanged').length };
  }, [diffData]);

  function exportCSV(rows, filename, extraCols) {
    const VULN_COLS = [
      { key:'risk', label:'Risk' }, { key:'host', label:'Host' }, { key:'port', label:'Port' },
      { key:'protocol', label:'Protocol' }, { key:'plugin_id', label:'Plugin ID' },
      { key:'cve', label:'CVE' }, { key:'cvss', label:'CVSS' }, { key:'epss', label:'EPSS' },
      { key:'vpr', label:'VPR' }, { key:'name', label:'Name' },
      { key:'synopsis', label:'Synopsis' }, { key:'solution', label:'Solution' },
    ];
    const cols = extraCols ? [...extraCols, ...VULN_COLS] : VULN_COLS;
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [
      cols.map(c => c.label).join(','),
      ...rows.map(r => cols.map(c => esc(r[c.key])).join(',')),
    ];
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  const ALL_COLS = [
    { key:'risk',      label:'嚴重等級' },
    { key:'host',      label:'主機 IP' },
    { key:'port',      label:'Port' },
    { key:'plugin_id', label:'Plugin ID' },
    { key:'name',      label:'弱點名稱' },
    { key:'cve',       label:'CVE' },
    { key:'cvss',      label:'CVSS' },
    { key:'epss',      label:'EPSS' },
    { key:'vpr',       label:'VPR' },
    { key:'synopsis',  label:'摘要' },
    { key:'solution',  label:'修補建議' },
  ];

  const columns = ALL_COLS.filter(c => visibleCols.includes(c.key)).map(c => ({
    ...c, sortable: true,
    mono: ['host','port','plugin_id','cve','cvss','epss','vpr'].includes(c.key),
    render: c.key==='risk'  ? v => <SeverityBadge level={v} />
          : c.key==='epss'  ? v => v!=null ? <span style={{color:parseFloat(v)>=0.1?'var(--critical)':parseFloat(v)>=0.01?'var(--warning)':'var(--text2)',fontWeight:parseFloat(v)>=0.1?700:400}}>{parseFloat(v).toFixed(3)}</span> : <span style={{color:'var(--text3)'}}>—</span>
          : c.key==='vpr'   ? v => v!=null ? <span style={{color:parseFloat(v)>=7?'var(--critical)':parseFloat(v)>=4?'var(--warning)':'var(--text2)',fontWeight:parseFloat(v)>=7?700:400}}>{parseFloat(v).toFixed(1)}</span> : <span style={{color:'var(--text3)'}}>—</span>
          : c.key==='name'  ? (v) => <span title={v} style={{fontWeight:500}}>{v?.length>60?v.slice(0,58)+'…':v}</span>
          : undefined
  }));

  // Vulns with valid EPSS/VPR for quadrant charts
  const epssVulns = useMemo(() => activeVulns.filter(v => v.epss!=null && v.cvss!=null && parseFloat(v.cvss)>0), [activeVulns]);
  const vprVulns  = useMemo(() => activeVulns.filter(v => v.vpr!=null  && v.cvss!=null && parseFloat(v.cvss)>0), [activeVulns]);

  return (
    <div>
      <PageHeader title="Vulnerability Scan" subtitle="Nessus 弱點掃描 · EPSS/VPR 風險矩陣 · 差異比對 · IP 群組篩選"
        actions={
          <div style={{display:'flex',gap:6}}>
            <FileUpload onFile={handleNessusUpload} label="Nessus CSV" hint="拖曳上傳" />
          </div>
        }
      />

      <Tabs active={tab} onChange={t => { setTab(t); setSearch(''); setSevFilter('all'); }} tabs={[
        { id:'history',  label:'掃描結果',    icon:'📋', count: scanDetail?.vulns?.length },
        { id:'matrix',   label:'風險矩陣',    icon:'⊞', count: undefined },
        { id:'diff',     label:'Diff 比較',   icon:'⇄', count: diffCounts.new||0 },
        { id:'ip',       label:'IP 歷程',     icon:'🖥' },
        { id:'upload',   label:'上傳管理',    icon:'📂' },
      ]} />

      <div style={{paddingTop:16}}>

        {/* IP Group filter — shown on history, matrix, diff tabs */}
        {['history','matrix','diff'].includes(tab) && (
          <div style={{marginBottom:16}}>
            <IPGroupManager allHosts={allHosts} selectedIPs={selectedIPs} onSelectIPs={setSelectedIPs} />
          </div>
        )}

        {/* ── 掃描結果 ── */}
        {tab === 'history' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <select value={selectedScan} onChange={e => setSelectedScan(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13}}>
                {allScans.map(s => <option key={s.id} value={s.id}>{s.name} ({s.date}) — {s.vulnCount} 筆</option>)}
              </select>
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13}}>
                <option value="all">全部等級</option>
                {['Critical','High','Medium','Low','Info'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <SearchBar value={search} onChange={setSearch} placeholder="搜尋 IP / 弱點名稱 / CVE…" />
              <span style={{marginLeft:'auto',fontSize:12,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>
                {filteredVulns.length} 筆{selectedIPs.length>0?` (${selectedIPs.length} IP 篩選中)`:''}
              </span>
              <Btn size="sm" variant="ghost" onClick={() => exportCSV(filteredVulns, `vulns-${selectedScan}-${new Date().toISOString().slice(0,10)}.csv`)}>↓ CSV</Btn>
            </div>

            {/* Column picker */}
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'9px 14px'}}>
              <div style={{fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text3)',marginBottom:7}}>顯示欄位</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                {ALL_COLS.map(c => (
                  <label key={c.key} style={{display:'flex',alignItems:'center',gap:5,fontSize:12,cursor:'pointer',padding:'3px 8px',borderRadius:99,background:visibleCols.includes(c.key)?'var(--accent-bg)':'var(--surface2)',color:visibleCols.includes(c.key)?'var(--accent)':'var(--text2)'}}>
                    <input type="checkbox" checked={visibleCols.includes(c.key)} onChange={e => setVisibleCols(prev => e.target.checked ? [...prev,c.key] : prev.filter(k=>k!==c.key))} style={{accentColor:'var(--accent)',width:12,height:12}} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Severity summary */}
            <div style={{display:'flex',gap:8}}>
              {['Critical','High','Medium','Low','Info'].map(sev => {
                const cnt = activeVulns.filter(v=>v.risk===sev).length;
                const colors = {Critical:'var(--critical)',High:'var(--high)',Medium:'var(--medium)',Low:'var(--low)',Info:'var(--info)'};
                const bgs    = {Critical:'var(--critical-bg)',High:'var(--high-bg)',Medium:'var(--medium-bg)',Low:'var(--low-bg)',Info:'var(--info-bg)'};
                return (
                  <div key={sev} onClick={() => setSevFilter(sevFilter===sev?'all':sev)}
                    style={{flex:1,background:sevFilter===sev?bgs[sev]:'var(--surface)',border:`1px solid ${sevFilter===sev?colors[sev]:'var(--border)'}`,borderRadius:'var(--r)',padding:'10px 14px',textAlign:'center',cursor:'pointer',transition:'all 0.15s'}}>
                    <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-mono)',color:colors[sev]}}>{cnt}</div>
                    <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{sev}</div>
                  </div>
                );
              })}
            </div>

            <Card noPad>
              <DataTable columns={columns} rows={filteredVulns} maxHeight={460}
                onRowClick={row => setExpandedRow(expandedRow?.id===row.id ? null : row)} />
            </Card>

            {expandedRow && (
              <Card title={`弱點詳情 — ${expandedRow.name}`} action={<Btn size="sm" variant="ghost" onClick={() => setExpandedRow(null)}>關閉 ×</Btn>}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div>
                    <SectionDivider label="基本資訊" />
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[['主機 IP',expandedRow.host],['連接埠',expandedRow.port+'/'+expandedRow.protocol],['Plugin ID',expandedRow.plugin_id],['CVE',expandedRow.cve||'—'],['CVSS',expandedRow.cvss||'—'],['EPSS',expandedRow.epss!=null?expandedRow.epss.toFixed(4):'—'],['VPR',expandedRow.vpr!=null?expandedRow.vpr.toFixed(1):'—']].map(([k,v])=>(
                        <div key={k} style={{display:'flex',gap:8}}>
                          <span style={{width:90,fontSize:11,fontWeight:600,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.04em',flexShrink:0}}>{k}</span>
                          <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--text)'}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <SectionDivider label="摘要" />
                    <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{expandedRow.synopsis}</p>
                    <SectionDivider label="修補建議" />
                    <p style={{fontSize:13,lineHeight:1.6}}>{expandedRow.solution}</p>
                  </div>
                  <div>
                    <SectionDivider label="說明" />
                    <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.6}}>{expandedRow.description}</p>
                    <SectionDivider label="Plugin Output" />
                    <pre style={{fontSize:11,fontFamily:'var(--font-mono)',background:'var(--surface2)',padding:'10px 12px',borderRadius:'var(--rsm)',overflow:'auto',maxHeight:150,color:'var(--accent)',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{expandedRow.plugin_output}</pre>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── 風險矩陣 ── */}
        {tab === 'matrix' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{padding:'10px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--r)',fontSize:12,color:'var(--text2)',display:'flex',gap:20,flexWrap:'wrap'}}>
              <span>📊 <strong style={{color:'var(--text)'}}>EPSS</strong>（Exploit Prediction Scoring System）— 漏洞在 30 天內被實際利用的機率（0-1）</span>
              <span>📊 <strong style={{color:'var(--text)'}}>VPR</strong>（Vulnerability Priority Rating）— Tenable 綜合威脅情報評分（0-10）</span>
              {selectedIPs.length > 0 && <span style={{color:'var(--accent)',fontWeight:600}}>🔍 篩選中：{selectedIPs.join(', ')}</span>}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              {/* EPSS Quadrant: X=CVSS, Y=EPSS */}
              <QuadrantChart
                vulns={epssVulns}
                xKey="cvss" yKey="epss"
                xLabel="CVSS Score" yLabel="EPSS Score"
                xMid={7} yMid={0.1}
                xMax={10} yMax={1}
                title={`EPSS vs CVSS 風險矩陣 (${epssVulns.length} 筆)`}
                quadrantLabels={['🔴 優先修補（高CVSS+高EPSS）','🟠 計劃修補（高CVSS+低EPSS）','🟡 監控利用（低CVSS+高EPSS）','🟢 低優先（低CVSS+低EPSS）']}
              />

              {/* VPR Quadrant: X=CVSS, Y=VPR */}
              <QuadrantChart
                vulns={vprVulns}
                xKey="cvss" yKey="vpr"
                xLabel="CVSS Score" yLabel="VPR Score"
                xMid={7} yMid={7}
                xMax={10} yMax={10}
                title={`VPR vs CVSS 風險矩陣 (${vprVulns.length} 筆)`}
                quadrantLabels={['🔴 優先修補（高CVSS+高VPR）','🟠 計劃修補（高CVSS+低VPR）','🟡 監控利用（低CVSS+高VPR）','🟢 低優先（低CVSS+低VPR）']}
              />
            </div>

            {/* Top priority table: High EPSS + High CVSS */}
            <Card title="🔴 優先修補清單 — CVSS ≥ 7 且 EPSS ≥ 0.1">
              <DataTable compact maxHeight={280}
                rows={activeVulns.filter(v=>parseFloat(v.cvss)>=7 && parseFloat(v.epss)>=0.1).sort((a,b)=>parseFloat(b.epss)-parseFloat(a.epss))}
                columns={[
                  { key:'risk',      label:'等級', sortable:true, render:v=><SeverityBadge level={v} /> },
                  { key:'epss',      label:'EPSS',  sortable:true, mono:true, render:v=><span style={{color:'var(--critical)',fontWeight:700}}>{parseFloat(v).toFixed(3)}</span> },
                  { key:'vpr',       label:'VPR',   sortable:true, mono:true, render:v=>v!=null?<span style={{color:parseFloat(v)>=7?'var(--critical)':'var(--warning)',fontWeight:700}}>{parseFloat(v).toFixed(1)}</span>:<span style={{color:'var(--text3)'}}>—</span> },
                  { key:'cvss',      label:'CVSS',  sortable:true, mono:true },
                  { key:'host',      label:'主機',  sortable:true, mono:true },
                  { key:'name',      label:'弱點名稱', render:v=><span title={v}>{v?.length>55?v.slice(0,53)+'…':v}</span> },
                  { key:'cve',       label:'CVE',   mono:true },
                ]} />
            </Card>
          </div>
        )}

        {/* ── Diff ── */}
        {tab === 'diff' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12,color:'var(--text2)',fontWeight:600}}>基準</span>
                <select value={diffBase} onChange={e=>setDiffBase(e.target.value)}
                  style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13}}>
                  {allScans.map(s=><option key={s.id} value={s.id}>{s.name} ({s.date})</option>)}
                </select>
              </div>
              <span style={{fontSize:18,color:'var(--text3)'}}>→</span>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:12,color:'var(--text2)',fontWeight:600}}>比對</span>
                <select value={diffComp} onChange={e=>setDiffComp(e.target.value)}
                  style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13}}>
                  {allScans.map(s=><option key={s.id} value={s.id}>{s.name} ({s.date})</option>)}
                </select>
              </div>
              <SearchBar value={search} onChange={setSearch} placeholder="搜尋…" />
              <Btn size="sm" variant="ghost" onClick={() => exportCSV(filteredDiff, `diff-${diffBase}-vs-${diffComp}-${new Date().toISOString().slice(0,10)}.csv`, [{key:'status',label:'Status'}])}>↓ CSV</Btn>
            </div>
            <div style={{display:'flex',gap:10}}>
              {[['all','全部',diffCounts.all,'var(--text)'],['new','新增',diffCounts.new,'var(--critical)'],['resolved','已修復',diffCounts.resolved,'var(--success)'],['unchanged','持續',diffCounts.unchanged,'var(--text2)']].map(([f,label,cnt,color])=>(
                <div key={f} onClick={()=>setDiffFilter(f)}
                  style={{flex:1,background:'var(--surface)',border:`1px solid ${diffFilter===f?'var(--accent)':'var(--border)'}`,borderRadius:'var(--r)',padding:'10px',textAlign:'center',cursor:'pointer',transition:'all 0.15s'}}>
                  <div style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-mono)',color}}>{cnt||0}</div>
                  <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{label}</div>
                </div>
              ))}
            </div>
            <Card noPad>
              <div style={{overflow:'auto',maxHeight:500}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'var(--surface2)'}}>
                      {['狀態','等級','IP','Port','Plugin ID','弱點名稱','CVSS','EPSS','VPR','CVE'].map(h=>(
                        <th key={h} style={{padding:'8px 12px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text2)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap',position:'sticky',top:0,background:'var(--surface2)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiff.map((row,i)=>{
                      const bg = row.status==='new'?'var(--diff-new)':row.status==='resolved'?'var(--diff-resolved)':'transparent';
                      const lbl = row.status==='new'?'🔴 新增':row.status==='resolved'?'🟢 修復':'🔵 存在';
                      return (
                        <tr key={i} style={{borderBottom:'1px solid var(--border)',background:bg}}>
                          <td style={{padding:'8px 12px',fontWeight:600,fontSize:12,whiteSpace:'nowrap'}}>{lbl}</td>
                          <td style={{padding:'8px 12px'}}><SeverityBadge level={row.risk} /></td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:12}}>{row.host}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:12}}>{row.port}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:12}}>{row.plugin_id}</td>
                          <td style={{padding:'8px 12px',maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.name}>{row.name}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:12}}>{row.cvss||'—'}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:parseFloat(row.epss)>=0.1?'var(--critical)':'var(--text2)',fontWeight:parseFloat(row.epss)>=0.1?700:400}}>{row.epss!=null?row.epss.toFixed(3):'—'}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:12,color:parseFloat(row.vpr)>=7?'var(--critical)':'var(--text2)',fontWeight:parseFloat(row.vpr)>=7?700:400}}>{row.vpr!=null?row.vpr.toFixed(1):'—'}</td>
                          <td style={{padding:'8px 12px',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text2)'}}>{row.cve||'—'}</td>
                        </tr>
                      );
                    })}
                    {filteredDiff.length===0 && <tr><td colSpan={10} style={{padding:32,textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>無符合條件的記錄</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── IP History ── */}
        {tab === 'ip' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:'var(--text2)',fontWeight:600}}>選擇 IP</span>
              <select value={selectedIP} onChange={e=>setSelectedIP(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 12px',fontSize:13,fontFamily:'var(--font-mono)'}}>
                {allHosts.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            {ipHistory.map(session => (
              <Card key={session.scanId} title={`${session.scanName} — ${session.date}`}
                action={<span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text3)'}}>{session.vulns.length} 筆</span>}>
                {session.vulns.length === 0
                  ? <div style={{color:'var(--text3)',fontStyle:'italic',fontSize:13}}>此掃描中 {selectedIP} 無弱點</div>
                  : <div style={{display:'flex',flexDirection:'column',gap:5}}>
                      {session.vulns.sort((a,b)=>(SEV_ORDER[a.risk]??99)-(SEV_ORDER[b.risk]??99)).map((v,i)=>(
                        <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'7px 10px',background:'var(--surface2)',borderRadius:'var(--rsm)',fontSize:13}}>
                          <SeverityBadge level={v.risk} />
                          <span style={{fontFamily:'var(--font-mono)',color:'var(--text2)',fontSize:11,width:60,flexShrink:0}}>{v.port}/tcp</span>
                          <span style={{flex:1,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={v.name}>{v.name}</span>
                          {v.epss!=null && <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:v.epss>=0.1?'var(--critical)':'var(--text3)',fontWeight:v.epss>=0.1?700:400,flexShrink:0}}>EPSS {v.epss.toFixed(3)}</span>}
                          {v.vpr!=null  && <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:v.vpr>=7?'var(--critical)':'var(--text3)',fontWeight:v.vpr>=7?700:400,flexShrink:0}}>VPR {v.vpr.toFixed(1)}</span>}
                          <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text3)',flexShrink:0}}>{v.cve||'—'}</span>
                        </div>
                      ))}
                    </div>
                }
              </Card>
            ))}
          </div>
        )}

        {/* ── Upload ── */}
        {tab === 'upload' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              {/* Nessus CSV */}
              <Card title="📥 Nessus 弱點掃描 CSV">
                <FileUpload onFile={handleNessusUpload} label="Nessus CSV (.csv)" hint="支援 EPSS Score、VPR Score 欄位自動對應" />
                <div style={{marginTop:12,background:'var(--surface2)',borderRadius:'var(--r)',padding:'10px 12px',fontSize:11,color:'var(--text2)'}}>
                  <div style={{fontWeight:600,marginBottom:5}}>支援欄位：</div>
                  <div style={{fontFamily:'var(--font-mono)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:3}}>
                    {[['Plugin ID','plugin_id'],['Risk','risk'],['Host','host'],['CVE','cve'],['CVSS v2.0 Base Score','cvss'],['EPSS Score','epss'],['VPR Score','vpr'],['Name','name']].map(([k,v])=>(
                      <div key={k}><span style={{color:'var(--accent)'}}>{k}</span><span style={{color:'var(--text3)'}}> → {v}</span></div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* CVE JSON */}
              <Card title="📥 NVD CVE JSON">
                <FileUpload onFile={handleCVEUpload} label="CVE JSON (.json)" hint="支援 NVD CVE API 2.0 格式（vulnerabilities 陣列）" />
                <div style={{marginTop:12,background:'var(--surface2)',borderRadius:'var(--r)',padding:'10px 12px',fontSize:11,color:'var(--text2)'}}>
                  <div style={{fontWeight:600,marginBottom:5}}>NVD CVE API 2.0 格式：</div>
                  <pre style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--accent)',lineHeight:1.5,whiteSpace:'pre-wrap'}}>{`{
  "vulnerabilities": [{
    "cve": {
      "id": "CVE-2024-XXXX",
      "descriptions": [{"lang":"en","value":"..."}],
      "metrics": {
        "cvssMetricV31": [{
          "cvssData": {
            "baseScore": 9.8,
            "baseSeverity": "CRITICAL"
          }
        }]
      }
    }
  }]
}`}</pre>
                </div>
              </Card>
            </div>

            {/* Uploaded scans list */}
            {Object.keys(uploadedScans).length > 0 && (
              <Card title="已上傳資料">
                {Object.values(uploadedScans).map(s=>{
                  const hasEPSS = s.vulns.some(v=>v.epss!=null);
                  const hasVPR  = s.vulns.some(v=>v.vpr!=null);
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'var(--surface2)',borderRadius:'var(--r)',marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:500}}>{s.name}</div>
                        <div style={{fontSize:11,color:'var(--text2)',marginTop:2,fontFamily:'var(--font-mono)',display:'flex',gap:8}}>
                          <span>{s.vulns.length} 筆 · {s.date}</span>
                          {hasEPSS && <span style={{color:'var(--accent)'}}>✓ EPSS</span>}
                          {hasVPR  && <span style={{color:'var(--accent)'}}>✓ VPR</span>}
                        </div>
                      </div>
                      <div style={{display:'flex',gap:6}}>
                        {['Critical','High','Medium'].map(sev=>{
                          const cnt = s.vulns.filter(v=>v.risk===sev).length;
                          return cnt>0 ? <span key={sev} style={{fontFamily:'var(--font-mono)',fontSize:11,padding:'2px 7px',borderRadius:99,background:'var(--surface)',border:'1px solid var(--border)'}}><span style={{color:sev==='Critical'?'var(--critical)':sev==='High'?'var(--high)':'var(--medium)',fontWeight:700}}>{cnt}</span> {sev}</span> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Built-in scans */}
            <Card title="內建掃描清單">
              {MockAPI.getScans().map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',background:'var(--surface2)',borderRadius:'var(--r)',marginBottom:6}}>
                  <div>
                    <div style={{fontWeight:500}}>{s.name}</div>
                    <div style={{fontSize:11,color:'var(--text2)',marginTop:2,fontFamily:'var(--font-mono)'}}>{s.date} · {s.hostCount} hosts · {s.vulnCount} 筆 · ✓ EPSS · ✓ VPR</div>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    {s.critical>0 && <span style={{color:'var(--critical)',fontWeight:700,fontFamily:'var(--font-mono)',fontSize:12}}>{s.critical} C</span>}
                    {s.high>0    && <span style={{color:'var(--high)',fontWeight:700,fontFamily:'var(--font-mono)',fontSize:12}}>{s.high} H</span>}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

window.VulnScanPage = VulnScanPage;
