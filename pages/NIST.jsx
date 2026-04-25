// NIST Page — Focused on Nessus Audit scan upload & comparison

const { useState, useEffect, useMemo } = React;

// ─── Nessus audit CSV parser ──────────────────────────────────────────────────
function parseAuditCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // Support multiple Nessus audit export formats
  const header = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim().toLowerCase());
  const checkIdx    = header.findIndex(h => h.includes('check') || h.includes('name') || h.includes('plugin'));
  const statusIdx   = header.findIndex(h => h.includes('result') || h.includes('status'));
  const descIdx     = header.findIndex(h => h.includes('description') || h.includes('output') || h.includes('info'));
  const policyIdx   = header.findIndex(h => h.includes('policy') || h.includes('expected'));
  const actualIdx   = header.findIndex(h => h.includes('actual') || h.includes('value'));

  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const vals = [];
    let cur = '', inQ = false;
    for (let c of line) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    vals.push(cur.trim());
    const rawStatus = (vals[statusIdx] || 'UNKNOWN').toUpperCase();
    const status = rawStatus.includes('PASS') ? 'PASSED'
                 : rawStatus.includes('FAIL') ? 'FAILED'
                 : rawStatus.includes('WARN') ? 'WARNING' : 'UNKNOWN';
    return {
      id: 'ctl-' + (i+1),
      check:  vals[checkIdx]  || '(未知控制項)',
      status,
      description: vals[descIdx]  || '',
      policy:      vals[policyIdx] || '',
      actual:      vals[actualIdx] || '',
    };
  }).filter(r => r.check && r.status !== 'UNKNOWN');
}

// ─── Built-in demo audit data ─────────────────────────────────────────────────
const DEMO_AUDIT_V1 = {
  id: 'demo-v1', name: 'Audit Scan — 2024-Q3 (示範)', date: '2024-09-20',
  results: [
    { id:'c01', check:'1.1.1 確保審計日誌已啟用', status:'PASSED', description:'auditd 服務已啟動並設定保留 90 天' },
    { id:'c02', check:'1.1.2 確保 SSH 根帳號登入已停用', status:'FAILED', description:'PermitRootLogin 設定為 yes，應設為 no' },
    { id:'c03', check:'1.1.3 確保密碼複雜度政策已設定', status:'PASSED', description:'pam_pwquality 已設定，最小長度 12' },
    { id:'c04', check:'1.2.1 確保套件更新來源已設定', status:'PASSED', description:'yum/apt 來源設定正確' },
    { id:'c05', check:'1.2.2 確保 GPG 金鑰驗證已啟用', status:'WARNING', description:'部分套件倉庫未啟用 GPG 驗證' },
    { id:'c06', check:'2.1.1 確保 IPv6 已停用（如不需要）', status:'FAILED', description:'IPv6 仍在所有介面上啟用' },
    { id:'c07', check:'2.2.1 確保時間同步已設定', status:'PASSED', description:'NTP 伺服器已設定' },
    { id:'c08', check:'2.2.2 確保 X Window System 未安裝', status:'PASSED', description:'X Window 套件未安裝' },
    { id:'c09', check:'3.1.1 確保不必要的服務已停用', status:'FAILED', description:'telnet, rsh 服務仍在執行' },
    { id:'c10', check:'3.1.2 確保防火牆已啟用', status:'PASSED', description:'iptables/firewalld 已啟動' },
    { id:'c11', check:'3.2.1 確保 TCP SYN Cookies 已啟用', status:'FAILED', description:'net.ipv4.tcp_syncookies = 0' },
    { id:'c12', check:'3.3.1 確保 ICMP 重定向未接受', status:'PASSED', description:'net.ipv4.conf.all.accept_redirects = 0' },
    { id:'c13', check:'4.1.1 確保 cron 服務已啟用', status:'PASSED', description:'crond 服務正常執行' },
    { id:'c14', check:'4.2.1 確保 rsyslog 已安裝並啟用', status:'FAILED', description:'rsyslog 未安裝，使用 journald 但未設定遠端傳送' },
    { id:'c15', check:'5.1.1 確保 sudo 已安裝', status:'PASSED', description:'sudo 1.9.5 已安裝' },
    { id:'c16', check:'5.2.1 確保 SSH 通訊協定版本 2 已使用', status:'PASSED', description:'Protocol 2 設定正確' },
    { id:'c17', check:'5.3.1 確保密碼到期天數已設定', status:'FAILED', description:'PASS_MAX_DAYS 設為 99999，應設為 90 天' },
    { id:'c18', check:'5.4.1 確保預設 umask 已設定', status:'PASSED', description:'umask 027 已設定' },
    { id:'c19', check:'6.1.1 確保 /etc/passwd 權限正確', status:'PASSED', description:'644 權限設定正確' },
    { id:'c20', check:'6.2.1 確保所有使用者帳號密碼已雜湊', status:'WARNING', description:'2 個帳號密碼欄位異常' },
  ]
};

const DEMO_AUDIT_V2 = {
  id: 'demo-v2', name: 'Audit Scan — 2025-Q1 (示範)', date: '2025-03-15',
  results: [
    { id:'c01', check:'1.1.1 確保審計日誌已啟用', status:'PASSED', description:'auditd 服務已啟動並設定保留 90 天' },
    { id:'c02', check:'1.1.2 確保 SSH 根帳號登入已停用', status:'PASSED', description:'PermitRootLogin 已修改為 no ✔' },
    { id:'c03', check:'1.1.3 確保密碼複雜度政策已設定', status:'PASSED', description:'pam_pwquality 已設定，最小長度 14' },
    { id:'c04', check:'1.2.1 確保套件更新來源已設定', status:'PASSED', description:'yum/apt 來源設定正確' },
    { id:'c05', check:'1.2.2 確保 GPG 金鑰驗證已啟用', status:'PASSED', description:'所有倉庫 GPG 驗證已啟用 ✔' },
    { id:'c06', check:'2.1.1 確保 IPv6 已停用（如不需要）', status:'FAILED', description:'IPv6 仍在所有介面上啟用' },
    { id:'c07', check:'2.2.1 確保時間同步已設定', status:'PASSED', description:'NTP 伺服器已設定' },
    { id:'c08', check:'2.2.2 確保 X Window System 未安裝', status:'PASSED', description:'X Window 套件未安裝' },
    { id:'c09', check:'3.1.1 確保不必要的服務已停用', status:'PASSED', description:'telnet, rsh 服務已停用 ✔' },
    { id:'c10', check:'3.1.2 確保防火牆已啟用', status:'PASSED', description:'iptables/firewalld 已啟動' },
    { id:'c11', check:'3.2.1 確保 TCP SYN Cookies 已啟用', status:'PASSED', description:'net.ipv4.tcp_syncookies = 1 ✔' },
    { id:'c12', check:'3.3.1 確保 ICMP 重定向未接受', status:'PASSED', description:'net.ipv4.conf.all.accept_redirects = 0' },
    { id:'c13', check:'4.1.1 確保 cron 服務已啟用', status:'PASSED', description:'crond 服務正常執行' },
    { id:'c14', check:'4.2.1 確保 rsyslog 已安裝並啟用', status:'PASSED', description:'rsyslog 已安裝並設定遠端傳送 ✔' },
    { id:'c15', check:'5.1.1 確保 sudo 已安裝', status:'PASSED', description:'sudo 1.9.13 已安裝' },
    { id:'c16', check:'5.2.1 確保 SSH 通訊協定版本 2 已使用', status:'PASSED', description:'Protocol 2 設定正確' },
    { id:'c17', check:'5.3.1 確保密碼到期天數已設定', status:'PASSED', description:'PASS_MAX_DAYS 已修改為 90 天 ✔' },
    { id:'c18', check:'5.4.1 確保預設 umask 已設定', status:'PASSED', description:'umask 027 已設定' },
    { id:'c19', check:'6.1.1 確保 /etc/passwd 權限正確', status:'PASSED', description:'644 權限設定正確' },
    { id:'c20', check:'6.2.1 確保所有使用者帳號密碼已雜湊', status:'FAILED', description:'發現 1 個帳號密碼欄位異常' },
  ]
};

function calcStats(results) {
  const passed  = results.filter(r => r.status === 'PASSED').length;
  const failed  = results.filter(r => r.status === 'FAILED').length;
  const warning = results.filter(r => r.status === 'WARNING').length;
  const total   = results.length;
  return { passed, failed, warning, total, pct: total ? Math.round(passed / total * 100) : 0 };
}

function diffAudits(base, comp) {
  const bMap = {}, cMap = {};
  base.results.forEach(r => bMap[r.check] = r);
  comp.results.forEach(r => cMap[r.check] = r);
  const allKeys = new Set([...Object.keys(bMap), ...Object.keys(cMap)]);
  const rows = [];
  allKeys.forEach(k => {
    const b = bMap[k], c = cMap[k];
    let diffStatus;
    if (!b) diffStatus = 'new-check';
    else if (!c) diffStatus = 'removed';
    else if (b.status !== c.status) diffStatus = c.status === 'PASSED' ? 'fixed' : 'regressed';
    else diffStatus = 'unchanged';
    rows.push({ check: k, baseStatus: b?.status, compStatus: c?.status, diffStatus, description: c?.description || b?.description || '' });
  });
  return rows.sort((a, b) => {
    const o = { regressed:0, 'new-check':1, fixed:2, unchanged:3, removed:4 };
    return (o[a.diffStatus]??99) - (o[b.diffStatus]??99);
  });
}

function AuditSummaryBar({ stats, label, date }) {
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--rlg)',padding:'16px 20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{label}</div>
          {date && <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',marginTop:2}}>{date}</div>}
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:28,fontWeight:700,fontFamily:'var(--font-mono)',color:stats.pct>=80?'var(--success)':stats.pct>=60?'var(--accent)':'var(--warning)',lineHeight:1}}>{stats.pct}%</div>
          <div style={{fontSize:10,color:'var(--text3)'}}>通過率</div>
        </div>
      </div>
      <ProgressBar value={stats.pct} color={stats.pct>=80?'var(--success)':stats.pct>=60?'var(--accent)':'var(--warning)'} height={8} showLabel={false} />
      <div style={{display:'flex',gap:12,marginTop:10}}>
        {[['PASSED',stats.passed,'var(--success)'],['FAILED',stats.failed,'var(--critical)'],['WARNING',stats.warning,'var(--warning)']].map(([k,v,c])=>(
          <div key={k} style={{display:'flex',alignItems:'center',gap:5,fontSize:12}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:c,display:'inline-block',flexShrink:0}}></span>
            <span style={{color:'var(--text2)'}}>{k}</span>
            <span style={{fontWeight:700,color:c,fontFamily:'var(--font-mono)'}}>{v}</span>
          </div>
        ))}
        <span style={{fontSize:12,color:'var(--text3)',marginLeft:'auto'}}>共 {stats.total} 項</span>
      </div>
    </div>
  );
}

function NISTPage() {
  const [tab, setTab] = useState('upload');
  const [audits, setAudits] = useState([DEMO_AUDIT_V1, DEMO_AUDIT_V2]);
  const [selectedAudit, setSelectedAudit] = useState('demo-v2');
  const [diffBase, setDiffBase]   = useState('demo-v1');
  const [diffComp, setDiffComp]   = useState('demo-v2');
  const [diffFilter, setDiffFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState(null);

  const currentAudit = audits.find(a => a.id === selectedAudit);
  const currentStats = currentAudit ? calcStats(currentAudit.results) : null;

  const filteredResults = useMemo(() => {
    if (!currentAudit) return [];
    return currentAudit.results
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => !search || r.check.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()));
  }, [currentAudit, statusFilter, search]);

  const handleUpload = (name, text) => {
    const results = parseAuditCSV(text);
    if (results.length === 0) { alert('❌ 無法解析 CSV 檔案，請確認格式正確'); return; }
    const audit = { id: 'upload-' + Date.now(), name: name.replace('.csv',''), date: new Date().toISOString().slice(0,10), results };
    setAudits(prev => [...prev, audit]);
    setSelectedAudit(audit.id);
    alert(`✅ 已載入 ${results.length} 筆稽核結果`);
  };

  const diffRows = useMemo(() => {
    const b = audits.find(a => a.id === diffBase);
    const c = audits.find(a => a.id === diffComp);
    if (!b || !c || b.id === c.id) return [];
    return diffAudits(b, c);
  }, [audits, diffBase, diffComp]);

  const filteredDiff = useMemo(() => {
    return diffRows
      .filter(r => diffFilter === 'all' || r.diffStatus === diffFilter)
      .filter(r => !search || r.check.toLowerCase().includes(search.toLowerCase()));
  }, [diffRows, diffFilter, search]);

  const diffCounts = useMemo(() => ({
    all:       diffRows.length,
    fixed:     diffRows.filter(r => r.diffStatus === 'fixed').length,
    regressed: diffRows.filter(r => r.diffStatus === 'regressed').length,
    unchanged: diffRows.filter(r => r.diffStatus === 'unchanged' && r.baseStatus === 'FAILED').length,
    'new-check': diffRows.filter(r => r.diffStatus === 'new-check').length,
  }), [diffRows]);

  const diffStatusColor = { fixed:'var(--success)', regressed:'var(--critical)', unchanged:'var(--warning)', 'new-check':'var(--accent)', removed:'var(--text3)' };
  const diffStatusLabel = { fixed:'✅ 已修復', regressed:'🔴 新增失敗', unchanged:'🟡 持續失敗', 'new-check':'🔵 新增控制', removed:'—— 已移除' };

  const trendChartData = useMemo(() => {
    const sorted = [...audits].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    return {
      labels: sorted.map(a => a.name.length > 20 ? a.name.slice(0,18)+'…' : a.name),
      datasets: [
        { label:'通過率 %', data: sorted.map(a => calcStats(a.results).pct), borderColor:'var(--accent)', backgroundColor:'oklch(0.65 0.155 195 / 0.15)', tension:0.4, fill:true, pointRadius:5, pointBackgroundColor:'var(--accent)' },
        { label:'失敗項目', data: sorted.map(a => calcStats(a.results).failed), borderColor:'var(--critical)', backgroundColor:'transparent', tension:0.4, fill:false, pointRadius:5, yAxisID:'y2' },
      ]
    };
  }, [audits]);

  return (
    <div>
      <PageHeader title="NIST" subtitle="Nessus Audit 合規掃描上傳、結果檢視與版本 Diff 比較"
        actions={<FileUpload onFile={handleUpload} label="Nessus Audit CSV" hint="支援 Nessus .audit 匯出格式" />} />

      <Tabs active={tab} onChange={t => { setTab(t); setSearch(''); setStatusFilter('all'); }} tabs={[
        { id:'upload',  label:'掃描管理', icon:'📂', count: audits.length },
        { id:'results', label:'結果檢視', icon:'📋', count: currentStats?.failed },
        { id:'diff',    label:'Diff 比較', icon:'⇄', count: diffCounts.regressed||undefined },
        { id:'trend',   label:'趨勢圖表', icon:'📈' },
      ]} />

      <div style={{paddingTop:20}}>

        {/* ── 掃描管理 ── */}
        {tab === 'upload' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <Card title="上傳 Nessus Audit 掃描結果">
              <FileUpload onFile={handleUpload} label="Nessus Audit CSV (.csv)" hint="Nessus 合規稽核匯出格式：Check Name, Result (PASSED/FAILED/WARNING), Description, Policy Value, Actual Value" />
              <div style={{marginTop:14,background:'var(--surface2)',borderRadius:'var(--r)',padding:'12px 14px',fontSize:12,color:'var(--text2)'}}>
                <div style={{fontWeight:600,marginBottom:6}}>支援的 Nessus Audit CSV 欄位：</div>
                <div style={{fontFamily:'var(--font-mono)',display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,fontSize:11}}>
                  {[['Check Name / Plugin ID','控制項名稱'],['Result / Status','PASSED / FAILED / WARNING'],['Description / Output','說明'],['Policy Value','政策預期值'],['Actual Value','實際值']].map(([k,v])=>(
                    <div key={k} style={{display:'flex',gap:6}}><span style={{color:'var(--accent)'}}>{k}</span><span style={{color:'var(--text3)'}}>— {v}</span></div>
                  ))}
                </div>
              </div>
            </Card>

            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text3)'}}>已載入掃描（{audits.length} 筆）</div>
              {audits.map(audit => {
                const s = calcStats(audit.results);
                return (
                  <div key={audit.id} onClick={() => { setSelectedAudit(audit.id); setTab('results'); }}
                    style={{background:'var(--surface)',border:`1px solid ${selectedAudit===audit.id?'var(--accent)':'var(--border)'}`,borderRadius:'var(--rlg)',padding:'14px 18px',cursor:'pointer',transition:'border-color 0.2s',display:'flex',alignItems:'center',gap:16}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=selectedAudit===audit.id?'var(--accent)':'var(--border)'}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14}}>{audit.name}</div>
                      <div style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--text3)',marginTop:2}}>{audit.date} · {s.total} 項控制</div>
                    </div>
                    <div style={{display:'flex',gap:10,alignItems:'center'}}>
                      <div style={{textAlign:'center'}}>
                        <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-mono)',color:s.pct>=80?'var(--success)':s.pct>=60?'var(--accent)':'var(--warning)'}}>{s.pct}%</div>
                        <div style={{fontSize:10,color:'var(--text3)'}}>通過率</div>
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        {s.failed>0 && <span style={{color:'var(--critical)',fontWeight:700,fontFamily:'var(--font-mono)',fontSize:13}}>{s.failed} FAILED</span>}
                        {s.warning>0 && <span style={{color:'var(--warning)',fontWeight:700,fontFamily:'var(--font-mono)',fontSize:13}}>{s.warning} WARN</span>}
                      </div>
                    </div>
                    <span style={{color:'var(--text3)'}}>›</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 結果檢視 ── */}
        {tab === 'results' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <select value={selectedAudit} onChange={e => setSelectedAudit(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13}}>
                {audits.map(a => <option key={a.id} value={a.id}>{a.name} ({a.date})</option>)}
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13}}>
                <option value="all">全部狀態</option>
                {['PASSED','FAILED','WARNING'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <SearchBar value={search} onChange={setSearch} placeholder="搜尋控制項名稱…" />
              <span style={{marginLeft:'auto',fontSize:12,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>{filteredResults.length} / {currentAudit?.results.length} 項</span>
            </div>

            {currentStats && <AuditSummaryBar stats={currentStats} label={currentAudit.name} date={currentAudit.date} />}

            {/* Status summary pills */}
            {currentAudit && (
              <div style={{display:'flex',gap:8}}>
                {[['PASSED','var(--success)','var(--success-bg)'],['FAILED','var(--critical)','var(--critical-bg)'],['WARNING','var(--warning)','var(--warning-bg)']].map(([s,c,bg])=>{
                  const cnt = currentAudit.results.filter(r=>r.status===s).length;
                  return (
                    <div key={s} onClick={() => setStatusFilter(statusFilter===s?'all':s)}
                      style={{flex:1,padding:'10px',borderRadius:'var(--r)',background:statusFilter===s?bg:'var(--surface)',border:`1px solid ${statusFilter===s?c:'var(--border)'}`,textAlign:'center',cursor:'pointer',transition:'all 0.15s'}}>
                      <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-mono)',color:c}}>{cnt}</div>
                      <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{s}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <Card noPad>
              <div style={{overflow:'auto',maxHeight:480}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                  <thead>
                    <tr style={{background:'var(--surface2)'}}>
                      {['狀態','控制項名稱','說明'].map(h=>(
                        <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text2)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap',position:'sticky',top:0,background:'var(--surface2)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map(r => (
                      <React.Fragment key={r.id}>
                        <tr onClick={() => setExpandedRow(expandedRow===r.id?null:r.id)}
                          style={{borderBottom:'1px solid var(--border)',cursor:'pointer',background:expandedRow===r.id?'var(--surface2)':''}}
                          onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                          onMouseLeave={e=>e.currentTarget.style.background=expandedRow===r.id?'var(--surface2)':''}>
                          <td style={{padding:'9px 14px',whiteSpace:'nowrap'}}>
                            <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:12,color:r.status==='PASSED'?'var(--success)':r.status==='FAILED'?'var(--critical)':'var(--warning)'}}>
                              {r.status==='PASSED'?'✅':r.status==='FAILED'?'❌':'⚠'} {r.status}
                            </span>
                          </td>
                          <td style={{padding:'9px 14px',fontWeight:500,maxWidth:400,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.check}>{r.check}</td>
                          <td style={{padding:'9px 14px',color:'var(--text2)',fontSize:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.description}>{r.description}</td>
                        </tr>
                        {expandedRow === r.id && (
                          <tr style={{background:'var(--accent-bg)'}}>
                            <td colSpan={3} style={{padding:'12px 18px'}}>
                              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,fontSize:13}}>
                                <div><span style={{fontWeight:700,color:'var(--text3)',fontSize:11}}>控制項：</span><div style={{marginTop:3}}>{r.check}</div></div>
                                <div><span style={{fontWeight:700,color:'var(--text3)',fontSize:11}}>說明：</span><div style={{marginTop:3,color:'var(--text2)'}}>{r.description||'—'}</div></div>
                                {r.policy && <div><span style={{fontWeight:700,color:'var(--text3)',fontSize:11}}>政策預期值：</span><div style={{fontFamily:'var(--font-mono)',fontSize:12,marginTop:3,color:'var(--success)'}}>{r.policy}</div></div>}
                                {r.actual  && <div><span style={{fontWeight:700,color:'var(--text3)',fontSize:11}}>實際值：</span><div style={{fontFamily:'var(--font-mono)',fontSize:12,marginTop:3,color:r.status==='FAILED'?'var(--critical)':'var(--text)'}}>{r.actual}</div></div>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    {filteredResults.length === 0 && <tr><td colSpan={3} style={{padding:32,textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>無符合條件的控制項</td></tr>}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── Diff ── */}
        {tab === 'diff' && (
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <Card title="選擇比較的掃描版本">
              <div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>基準版本</span>
                  <select value={diffBase} onChange={e => setDiffBase(e.target.value)}
                    style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13,minWidth:220}}>
                    {audits.map(a=><option key={a.id} value={a.id}>{a.name} ({a.date})</option>)}
                  </select>
                </div>
                <div style={{fontSize:24,color:'var(--text3)',marginTop:16}}>→</div>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  <span style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>比對版本</span>
                  <select value={diffComp} onChange={e => setDiffComp(e.target.value)}
                    style={{background:'var(--surface2)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'7px 10px',fontSize:13,minWidth:220}}>
                    {audits.map(a=><option key={a.id} value={a.id}>{a.name} ({a.date})</option>)}
                  </select>
                </div>
                <SearchBar value={search} onChange={setSearch} placeholder="搜尋控制項…" />
              </div>
            </Card>

            {diffBase && diffComp && diffBase !== diffComp ? (
              <>
                {/* Summary cards */}
                <div style={{display:'flex',gap:10}}>
                  {[
                    ['all','全部',diffCounts.all,'var(--text)'],
                    ['regressed','新增失敗',diffCounts.regressed,'var(--critical)'],
                    ['fixed','已修復',diffCounts.fixed,'var(--success)'],
                    ['unchanged','持續失敗',diffCounts.unchanged,'var(--warning)'],
                    ['new-check','新增項目',diffCounts['new-check'],'var(--accent)'],
                  ].map(([f,label,cnt,color])=>(
                    <div key={f} onClick={() => setDiffFilter(f)}
                      style={{flex:1,background:'var(--surface)',border:`1px solid ${diffFilter===f?'var(--accent)':'var(--border)'}`,borderRadius:'var(--r)',padding:'10px 12px',textAlign:'center',cursor:'pointer',transition:'all 0.15s'}}>
                      <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-mono)',color}}>{cnt}</div>
                      <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Compare summary bars */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[diffBase,diffComp].map(id=>{
                    const a = audits.find(x=>x.id===id);
                    if (!a) return null;
                    return <AuditSummaryBar key={id} stats={calcStats(a.results)} label={a.name} date={a.date} />;
                  })}
                </div>

                {/* Diff table */}
                <Card noPad>
                  <div style={{overflow:'auto',maxHeight:480}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead>
                        <tr style={{background:'var(--surface2)'}}>
                          {['變更狀態','控制項名稱','基準版本','比對版本','說明'].map(h=>(
                            <th key={h} style={{padding:'9px 14px',textAlign:'left',fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text2)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap',position:'sticky',top:0,background:'var(--surface2)'}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDiff.map((r,i) => {
                          const rowBg = r.diffStatus==='fixed'?'var(--diff-resolved)':r.diffStatus==='regressed'?'var(--diff-new)':r.diffStatus==='unchanged'&&r.baseStatus==='FAILED'?'oklch(0.76 0.17 72 / 0.1)':'transparent';
                          const bColor = r.baseStatus==='PASSED'?'var(--success)':r.baseStatus==='FAILED'?'var(--critical)':'var(--warning)';
                          const cColor = r.compStatus==='PASSED'?'var(--success)':r.compStatus==='FAILED'?'var(--critical)':'var(--warning)';
                          return (
                            <tr key={i} style={{borderBottom:'1px solid var(--border)',background:rowBg}}>
                              <td style={{padding:'9px 14px',whiteSpace:'nowrap',fontWeight:700,fontSize:12,color:diffStatusColor[r.diffStatus]}}>{diffStatusLabel[r.diffStatus]}</td>
                              <td style={{padding:'9px 14px',maxWidth:320,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}} title={r.check}>{r.check}</td>
                              <td style={{padding:'9px 14px',fontFamily:'var(--font-mono)',fontSize:12,color:bColor,fontWeight:700}}>{r.baseStatus||'—'}</td>
                              <td style={{padding:'9px 14px',fontFamily:'var(--font-mono)',fontSize:12,color:cColor,fontWeight:700}}>{r.compStatus||'—'}</td>
                              <td style={{padding:'9px 14px',color:'var(--text2)',fontSize:12,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.description}>{r.description}</td>
                            </tr>
                          );
                        })}
                        {filteredDiff.length===0 && <tr><td colSpan={5} style={{padding:32,textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>無符合條件的記錄</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            ) : (
              <div style={{padding:'40px',textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>請選擇兩個不同的掃描版本進行比較</div>
            )}
          </div>
        )}

        {/* ── 趨勢 ── */}
        {tab === 'trend' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            {audits.length < 2
              ? <div style={{padding:'40px',textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>需要至少 2 筆掃描才能顯示趨勢</div>
              : <>
                  <Card title="合規通過率趨勢">
                    <ChartCanvas type="line" data={trendChartData} height={280}
                      options={{ plugins:{ legend:{ position:'top' } }, scales:{ y:{ beginAtZero:true,max:100,ticks:{callback:v=>v+'%'} }, y2:{ position:'right',beginAtZero:true,grid:{drawOnChartArea:false},ticks:{color:'var(--critical)'} } } }} />
                  </Card>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12}}>
                    {[...audits].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(audit => {
                      const s = calcStats(audit.results);
                      return (
                        <div key={audit.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--rlg)',padding:'14px 16px',cursor:'pointer'}} onClick={()=>{ setSelectedAudit(audit.id); setTab('results'); }}>
                          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)',marginBottom:4}}>{audit.date}</div>
                          <div style={{fontWeight:600,fontSize:13,marginBottom:8}}>{audit.name.length>24?audit.name.slice(0,22)+'…':audit.name}</div>
                          <div style={{fontSize:26,fontWeight:700,fontFamily:'var(--font-mono)',color:s.pct>=80?'var(--success)':s.pct>=60?'var(--accent)':'var(--warning)'}}>{s.pct}%</div>
                          <div style={{marginTop:6}}><ProgressBar value={s.pct} color={s.pct>=80?'var(--success)':s.pct>=60?'var(--accent)':'var(--warning)'} height={5} showLabel={false} /></div>
                        </div>
                      );
                    })}
                  </div>
                </>
            }
          </div>
        )}
      </div>
    </div>
  );
}

window.NISTPage = NISTPage;
