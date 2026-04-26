// Login page — JWT auth via /api/auth/token

function LoginPage({ onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await APIClient.login(username, password);
      onLogin();
    } catch (err) {
      setError(err.message || '登入失敗');
    } finally {
      setLoading(false);
    }
  }

  function handleDemo() {
    APIClient.loginDemo();
    onLogin();
  }

  const inputStyle = {
    width:'100%', padding:'9px 12px', fontSize:13,
    background:'var(--surface2)', border:'1px solid var(--border)',
    borderRadius:'var(--r)', color:'var(--text)', outline:'none',
    transition:'border-color 0.15s',
  };

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}>
      <div style={{width:380,padding:'36px 40px',background:'var(--surface)',borderRadius:16,border:'1px solid var(--border)',boxShadow:'var(--shadow-lg)'}}>

        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:32}}>
          <div style={{width:40,height:40,borderRadius:10,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <svg width="22" height="22" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L3 5V9C3 12.3 5.6 15.4 9 16C12.4 15.4 15 12.3 15 9V5L9 2Z" fill="oklch(0.1 0 0)" fillOpacity="0.9"/>
              <path d="M7 9L8.5 10.5L11 7.5" stroke="oklch(0.1 0 0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{fontWeight:700,fontSize:18,letterSpacing:'-0.01em'}}>SecVision</div>
            <div style={{fontSize:11,color:'var(--text3)',letterSpacing:'0.06em',textTransform:'uppercase'}}>ISMS Portal</div>
          </div>
        </div>

        <div style={{fontSize:20,fontWeight:600,marginBottom:4}}>登入</div>
        <div style={{fontSize:13,color:'var(--text2)',marginBottom:24}}>請輸入帳號密碼以存取系統</div>

        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>帳號</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="username" required autoComplete="username"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor='var(--accent)'}
              onBlur={e  => e.target.style.borderColor='var(--border)'}
            />
          </div>
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>密碼</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="password" required autoComplete="current-password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor='var(--accent)'}
              onBlur={e  => e.target.style.borderColor='var(--border)'}
            />
          </div>

          {error && (
            <div style={{marginBottom:14,padding:'9px 13px',background:'var(--critical-bg)',border:'1px solid var(--critical)',borderRadius:'var(--rsm)',color:'var(--critical)',fontSize:12}}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'10px',background:'var(--accent)',color:'oklch(0.1 0 0)',fontWeight:600,fontSize:13,borderRadius:'var(--r)',border:'none',cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,transition:'opacity 0.15s',marginBottom:10}}>
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        <button onClick={handleDemo}
          style={{width:'100%',padding:'9px',background:'transparent',color:'var(--text2)',fontSize:12,borderRadius:'var(--r)',border:'1px solid var(--border)',cursor:'pointer',transition:'all 0.15s'}}
          onMouseEnter={e => { e.currentTarget.style.background='var(--surface2)'; e.currentTarget.style.color='var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text2)'; }}>
          Demo 模式（無需後端）
        </button>

        <div style={{marginTop:16,padding:'10px 12px',background:'var(--surface2)',borderRadius:'var(--rsm)',fontSize:11,color:'var(--text3)'}}>
          後端帳號：<span style={{fontFamily:'var(--font-mono)',color:'var(--text2)'}}>admin / admin</span>
        </div>
      </div>
    </div>
  );
}

window.LoginPage = LoginPage;
