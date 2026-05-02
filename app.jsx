// App shell — sidebar navigation + routing

const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 195,
  "compactMode": false,
  "defaultPage": "dashboard",
  "showBadgeCounts": true
}/*EDITMODE-END*/;

const NAV_BASE = [
  { id:'dashboard', label:'Dashboard',          icon:'⬡', sub:'概覽' },
  { id:'vulnscan',  label:'Vulnerability Scan',  icon:'⬡', sub:'弱點掃描' },
  { id:'nist',      label:'NIST',                icon:'⬡', sub:'安全框架' },
];
const NAV_ADMIN = { id:'admin', label:'帳號管理', icon:'⬡', sub:'User Management' };

const ROLE_LABEL = { admin:'資安管理員', analyst:'安全分析師', viewer:'檢視者' };

// ─── ChangePasswordModal ──────────────────────────────────────────────────────
function ChangePasswordModal({ open, onClose, onSuccess, forced }) {
  const [form, setForm] = useState({ old:'', pw:'', confirm:'' });
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    setErr('');
    if (form.pw !== form.confirm) { setErr('兩次輸入的新密碼不一致'); return; }
    setLoading(true);
    APIClient.changePassword(form.old, form.pw)
      .then(() => { onSuccess(); setForm({ old:'', pw:'', confirm:'' }); })
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  return (
    <Modal open={open} title={forced ? '🔒 密碼已到期，請立即更改' : '修改密碼'} onClose={forced ? null : onClose} width={420}>
      {forced && (
        <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:'var(--r)',
          background:'var(--critical-bg)', color:'var(--critical)', border:'1px solid var(--critical)', fontSize:13 }}>
          您的密碼已到期，必須更改密碼後才能繼續使用系統。
        </div>
      )}
      <FormField label="目前密碼" required>
        <FormInput type="password" value={form.old} onChange={e => setForm(f=>({...f,old:e.target.value}))} placeholder="••••••••" />
      </FormField>
      <FormField label="新密碼" required hint="至少 8 碼，含大寫、數字、特殊字元">
        <FormInput type="password" value={form.pw} onChange={e => setForm(f=>({...f,pw:e.target.value}))} placeholder="••••••••" />
      </FormField>
      <FormField label="確認新密碼" required>
        <FormInput type="password" value={form.confirm} onChange={e => setForm(f=>({...f,confirm:e.target.value}))} placeholder="••••••••" />
      </FormField>
      {err && <div style={{ color:'var(--critical)', fontSize:12, marginBottom:12, padding:'8px 10px', background:'var(--critical-bg)', borderRadius:'var(--rsm)' }}>{err}</div>}
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        {!forced && <Btn variant="secondary" onClick={onClose}>取消</Btn>}
        <Btn disabled={loading} onClick={handleSubmit}>{loading ? '更新中…' : '確認更改'}</Btn>
      </div>
    </Modal>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, stats, onLogout, currentUser, onChangePw }) {
  const nav = currentUser?.role === 'admin' ? [...NAV_BASE, NAV_ADMIN] : NAV_BASE;

  const counts = {
    dashboard: null,
    vulnscan:  stats && stats.risk ? stats.risk.critical + stats.risk.high : null,
    nist:      null,
    admin:     null,
  };

  const uname = currentUser?.username || 'User';
  const initial = uname.charAt(0).toUpperCase();
  const roleLabel = ROLE_LABEL[currentUser?.role] || currentUser?.role || '';

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
        {nav.map(item => {
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

      {/* Footer — user info */}
      <div style={{padding:'12px 14px',borderTop:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:'var(--accent-bg)',border:'1px solid var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'var(--accent)',flexShrink:0}}>{initial}</div>
          <div style={{overflow:'hidden'}}>
            <div style={{fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{uname}</div>
            <div style={{fontSize:10,color:'var(--text3)'}}>{roleLabel}</div>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:6}}>
          <button onClick={onChangePw}
            style={{fontSize:11,color:'var(--text2)',padding:'4px 8px',borderRadius:'var(--rsm)',border:'1px solid var(--border)',background:'transparent',cursor:'pointer',transition:'all 0.15s',textAlign:'left'}}
            onMouseEnter={e=>{ e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.borderColor='var(--accent)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.color='var(--text2)'; e.currentTarget.style.borderColor='var(--border)'; }}>
            🔑 修改密碼
          </button>
          {onLogout && (
            <button onClick={onLogout}
              style={{fontSize:11,color:'var(--text3)',padding:'4px 8px',borderRadius:'var(--rsm)',border:'1px solid var(--border)',background:'transparent',cursor:'pointer',transition:'all 0.15s'}}
              onMouseEnter={e=>{ e.currentTarget.style.color='var(--critical)'; e.currentTarget.style.borderColor='var(--critical)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.color='var(--text3)'; e.currentTarget.style.borderColor='var(--border)'; }}>
              登出
            </button>
          )}
        </div>
        <div style={{marginTop:8,fontSize:10,color:'var(--text3)',fontFamily:'var(--font-mono)'}}>v2.3.0 · {new Date().toLocaleDateString('zh-TW')}</div>
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
  const [currentUser, setCurrentUser] = useState(null);
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwForced, setPwForced] = useState(false);

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

  const loadCurrentUser = () => {
    APIClient.getMe()
      .then(u => setCurrentUser(u))
      .catch(() => setCurrentUser(null));
  };

  useEffect(() => {
    if (isLoggedIn) {
      refreshStats();
      loadCurrentUser();
      applyTweaks(TWEAK_DEFAULTS);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('secvision_page', page);
  }, [page]);

  const handleLogin = () => {
    setIsLoggedIn(true);
  };

  const handlePasswordExpired = (username) => {
    // Store token temporarily so change-password API can authenticate
    setPwForced(true);
    setShowChangePw(true);
    setIsLoggedIn(true);
  };

  const handleChangePwSuccess = () => {
    setShowChangePw(false);
    if (pwForced) {
      setPwForced(false);
      // Re-fetch user info after password change
      loadCurrentUser();
    }
  };

  if (!isLoggedIn) {
    return <window.LoginPage
      onLogin={handleLogin}
      onPasswordExpired={handlePasswordExpired}
    />;
  }

  const PAGE_MAP = {
    dashboard: window.DashboardPage,
    vulnscan:  window.VulnScanPage,
    nist:      window.NISTPage,
    admin:     window.AdminPage,
  };

  const PageComponent = PAGE_MAP[page] || (() => <div style={{padding:40,color:'var(--text2)'}}>頁面載入中…</div>);

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
      <Sidebar
        page={page}
        setPage={setPage}
        stats={stats}
        currentUser={currentUser}
        onLogout={() => { APIClient.logout(); setIsLoggedIn(false); setCurrentUser(null); }}
        onChangePw={() => { setPwForced(false); setShowChangePw(true); }}
      />
      <main style={{flex:1,overflow:'auto',background:'var(--bg)',padding:'24px 32px'}}>
        <PageComponent
          onNavigate={setPage}
          onStatsChange={refreshStats}
          currentUser={currentUser}
        />
      </main>

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={showChangePw}
        forced={pwForced}
        onClose={() => setShowChangePw(false)}
        onSuccess={handleChangePwSuccess}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
