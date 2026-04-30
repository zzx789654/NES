// App shell — sidebar navigation + routing

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 195,
  "compactMode": false,
  "defaultPage": "dashboard",
  "showBadgeCounts": true
}/*EDITMODE-END*/;

const NAV = [
  { id:'dashboard', label:'Dashboard', icon:'⬡', sub:'概覽' },
  { id:'vulnscan',  label:'Vulnerability Scan', icon:'⬡', sub:'弱點掃描' },
  { id:'nist',      label:'NIST', icon:'⬡', sub:'安全框架' },
];

function Sidebar({ page, setPage, stats, onLogout }) {
  const counts = {
    dashboard: null,
    vulnscan:  stats && stats.risk ? stats.risk.critical + stats.risk.high : null,
    nist:      null,
  };

  return (
    <aside style={{width:'var(--sidebar-w)',flexShrink:0,background:'var(--surface)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',height:'100vh',position:'sticky',top:0,overflowY:'auto'}}>
      {/* Logo */}
      <div style={{padding:'20px 18px 16px',borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L3 5V9C3 12.3 5.6 15.4 9 16C12.4 15.4 15 12.3 15 9V5L9 2Z" fill="oklch(0.1 0 0)" fillOpacity="0.9"/>
              <path d="M7 9L8.5 10.5L11 7.5" stroke="oklch(0.1 0 0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:14,letterSpacing:'-0.01em',lineHeight:1.2}}>SecVision</div>
            <div style={{fontSize:10,color:'var(--text3)',letterSpacing:'0.06em',textTransform:'uppercase'}}>ISMS Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{flex:1,padding:'10px 10px'}}>
        <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--text3)',padding:'6px 8px',marginBottom:2}}>主選單</div>
        {NAV.map(item => {
          const active = page === item.id;
          const cnt = counts[item.id];
          return (
            <button key={item.id} onClick={() => setPage(item.id)}
              style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px',borderRadius:'var(--r)',marginBottom:2,background:active?'var(--accent-bg)':'transparent',color:active?'var(--accent)':'var(--text2)',border:`1px solid ${active?'var(--accent-bg)':'transparent'}`,transition:'all 0.15s',textAlign:'left',cursor:'pointer'}}
              onMouseEnter={e=>{ if(!active){ e.currentTarget.style.background='var(--surface2)'; e.currentTarget.style.color='var(--text)'; }}}
              onMouseLeave={e=>{ if(!active){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text2)'; }}}>
              <div>
                <div style={{fontWeight:active?600:500,fontSize:13,lineHeight:1.2}}>{item.label}</div>
                <div style={{fontSize:10,opacity:0.7,letterSpacing:'0.03em'}}>{item.sub}</div>
              </div>
              {cnt !== null && cnt > 0 && (
                <span style={{background:item.id==='vulnscan'?'var(--critical-bg)':'var(--warning-bg)',color:item.id==='vulnscan'?'var(--critical)':'var(--warning)',borderRadius:99,padding:'1px 7px',fontSize:11,fontWeight:700,minWidth:22,textAlign:'center'}}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:'var(--accent-bg)',border:'1px solid var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'var(--accent)'}}>A</div>
          <div>
            <div style={{fontSize:12,fontWeight:500}}>Admin</div>
            <div style={{fontSize:10,color:'var(--text3)'}}>資安管理員</div>
          </div>
        </div>
        <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{fontSize:11,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>v2.1.0 · {new Date().toLocaleDateString('zh-TW')}</div>
          {onLogout && (
            <button onClick={onLogout}
              style={{fontSize:11,color:'var(--text3)',padding:'3px 8px',borderRadius:'var(--rsm)',border:'1px solid var(--border)',background:'transparent',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e => { e.currentTarget.style.color='var(--critical)'; e.currentTarget.style.borderColor='var(--critical)'; }}
              onMouseLeave={e => { e.currentTarget.style.color='var(--text3)'; e.currentTarget.style.borderColor='var(--border)'; }}>
              登出
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function applyTweaks(tweaks) {
  const root = document.documentElement;
  const h = tweaks.accentHue;
  root.style.setProperty('--accent',      `oklch(0.65 0.155 ${h})`);
  root.style.setProperty('--accent-bg',   `oklch(0.65 0.155 ${h} / 0.12)`);
  root.style.setProperty('--accent-h',    `oklch(0.72 0.155 ${h})`);
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => typeof APIClient !== 'undefined' && APIClient.isLoggedIn());
  const [page, setPage] = useState(() => localStorage.getItem('secvision_page') || TWEAK_DEFAULTS.defaultPage);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    function handleUnauth() { setIsLoggedIn(false); }
    window.addEventListener('secvision:unauthorized', handleUnauth);
    return () => window.removeEventListener('secvision:unauthorized', handleUnauth);
  }, []);

  const refreshStats = () => {
    APIClient.getDashboardStats()
      .then(data => setStats(data))
      .catch(() => setStats(null));
  };

  useEffect(() => {
    refreshStats();
    applyTweaks(TWEAK_DEFAULTS);
  }, []);

  useEffect(() => {
    localStorage.setItem('secvision_page', page);
  }, [page]);

  if (!isLoggedIn) {
    return <window.LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  const PAGE_MAP = {
    dashboard: window.DashboardPage,
    vulnscan:  window.VulnScanPage,
    nist:      window.NISTPage,
  };

  const PageComponent = PAGE_MAP[page] || (() => <div style={{padding:40,color:'var(--text2)'}}>頁面載入中…</div>);

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
      <Sidebar page={page} setPage={setPage} stats={stats} onLogout={() => { APIClient.logout(); setIsLoggedIn(false); }} />
      <main style={{flex:1,overflow:'auto',background:'var(--bg)',padding:'24px 32px'}}>
        <PageComponent onNavigate={setPage} onStatsChange={refreshStats} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
