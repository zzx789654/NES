// Login page — JWT auth via /api/auth/token

function LoginPage({ onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading]   = React.useState(false);
  const [error, setError]       = React.useState('');

  // Expired password flow
  const [expired, setExpired]     = React.useState(false);
  const [expUser, setExpUser]     = React.useState('');
  const [expOld, setExpOld]       = React.useState('');
  const [expNew, setExpNew]       = React.useState('');
  const [expConfirm, setExpConfirm] = React.useState('');
  const [expErr, setExpErr]       = React.useState('');
  const [expLoading, setExpLoading] = React.useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await APIClient.login(username, password);
      onLogin();
    } catch (err) {
      if (err.passwordExpired) {
        setExpired(true);
        setExpUser(err.username || username);
        setExpOld(password);
      } else {
        setError(err.message || '登入失敗');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExpiredChange(e) {
    e.preventDefault();
    setExpErr('');
    if (expNew !== expConfirm) { setExpErr('兩次輸入的新密碼不一致'); return; }
    setExpLoading(true);
    try {
      await APIClient.changeExpiredPassword(expUser, expOld, expNew);
      onLogin();
    } catch (err) {
      setExpErr(err.message || '密碼更改失敗');
    } finally {
      setExpLoading(false);
    }
  }

  const inputStyle = {
    width:'100%', padding:'9px 12px', fontSize:13,
    background:'var(--surface2)', border:'1px solid var(--border)',
    borderRadius:'var(--r)', color:'var(--text)', outline:'none',
    transition:'border-color 0.15s',
  };

  // ── Expired password form ──
  if (expired) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}>
        <div style={{width:400,padding:'36px 40px',background:'var(--surface)',borderRadius:16,border:'1px solid var(--critical)',boxShadow:'var(--shadow-lg)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:24}}>
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

          <div style={{marginBottom:20,padding:'12px 14px',background:'var(--critical-bg)',border:'1px solid var(--critical)',borderRadius:'var(--r)',color:'var(--critical)',fontSize:13}}>
            🔒 帳號「{expUser}」的密碼已到期，請立即設定新密碼。
          </div>

          <form onSubmit={handleExpiredChange}>
            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>新密碼</label>
              <input type="password" value={expNew} onChange={e=>setExpNew(e.target.value)}
                placeholder="至少 8 碼，含大寫/數字/特殊字元" required style={inputStyle}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'} />
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>確認新密碼</label>
              <input type="password" value={expConfirm} onChange={e=>setExpConfirm(e.target.value)}
                placeholder="再輸入一次新密碼" required style={inputStyle}
                onFocus={e=>e.target.style.borderColor='var(--accent)'}
                onBlur={e=>e.target.style.borderColor='var(--border)'} />
            </div>

            {expErr && (
              <div style={{marginBottom:14,padding:'9px 13px',background:'var(--critical-bg)',border:'1px solid var(--critical)',borderRadius:'var(--rsm)',color:'var(--critical)',fontSize:12}}>
                {expErr}
              </div>
            )}

            <button type="submit" disabled={expLoading}
              style={{width:'100%',padding:'10px',background:'var(--accent)',color:'oklch(0.1 0 0)',fontWeight:600,fontSize:13,borderRadius:'var(--r)',border:'none',cursor:expLoading?'not-allowed':'pointer',opacity:expLoading?0.7:1,transition:'opacity 0.15s'}}>
              {expLoading ? '更新中…' : '設定新密碼並登入'}
            </button>
          </form>

          <button onClick={()=>setExpired(false)} style={{marginTop:12,fontSize:12,color:'var(--text3)',background:'none',border:'none',cursor:'pointer',width:'100%',textAlign:'center',padding:'4px'}}>
            ← 返回登入
          </button>
        </div>
      </div>
    );
  }

  // ── Normal login form ──
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

        <div style={{marginTop:16,padding:'10px 12px',background:'var(--surface2)',borderRadius:'var(--rsm)',fontSize:11,color:'var(--text3)'}}>
          預設帳號：<span style={{fontFamily:'var(--font-mono)',color:'var(--text2)'}}>admin / Admin@123456</span>
        </div>
      </div>
    </div>
  );
}

window.LoginPage = LoginPage;
