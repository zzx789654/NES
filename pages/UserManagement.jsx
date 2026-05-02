// 帳號管理頁面 — 查看/新增/刪除使用者、變更密碼

(function () {
  const { useState, useEffect } = React;

  const ROLE_LABEL = { admin: '管理員', analyst: '分析師', viewer: '檢視者' };
  const ROLE_COLOR = {
    admin:   { bg: 'var(--critical-bg)',  color: 'var(--critical)' },
    analyst: { bg: 'var(--warning-bg)',   color: 'var(--warning)' },
    viewer:  { bg: 'var(--info-bg)',      color: 'var(--info)' },
  };

  function Badge({ role }) {
    const s = ROLE_COLOR[role] || ROLE_COLOR.viewer;
    return (
      <span style={{
        background: s.bg, color: s.color,
        borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700,
      }}>
        {ROLE_LABEL[role] || role}
      </span>
    );
  }

  function Card({ title, children, style }) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--rlg)', padding: '20px 24px', marginBottom: 24,
        ...style,
      }}>
        {title && (
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 16, letterSpacing: '-0.01em' }}>
            {title}
          </div>
        )}
        {children}
      </div>
    );
  }

  function Field({ label, children }) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        {children}
      </div>
    );
  }

  function Input({ value, onChange, type = 'text', placeholder, disabled }) {
    return (
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        style={{
          width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)',
          fontSize: 13, outline: 'none', boxSizing: 'border-box',
        }}
      />
    );
  }

  function Select({ value, onChange, options }) {
    return (
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)',
          fontSize: 13, outline: 'none',
        }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  function Btn({ onClick, children, variant = 'default', disabled, style }) {
    const styles = {
      default: { background: 'var(--accent)', color: '#000', border: 'none' },
      danger:  { background: 'transparent', color: 'var(--critical)', border: '1px solid var(--critical)' },
      ghost:   { background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' },
    };
    return (
      <button onClick={onClick} disabled={disabled}
        style={{
          padding: '7px 16px', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
          transition: 'opacity 0.15s', ...styles[variant], ...style,
        }}>
        {children}
      </button>
    );
  }

  function Alert({ msg, type = 'error' }) {
    if (!msg) return null;
    const c = type === 'error' ? 'var(--critical)' : 'var(--success)';
    const bg = type === 'error' ? 'var(--critical-bg)' : 'var(--success-bg)';
    return (
      <div style={{ background: bg, color: c, border: `1px solid ${c}`, borderRadius: 'var(--r)', padding: '8px 14px', fontSize: 12, marginBottom: 12 }}>
        {msg}
      </div>
    );
  }

  // ── 我的帳號 ──────────────────────────────────────────────────────────────

  function MyAccountCard({ me, onPasswordChanged }) {
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState('');

    async function handleChangePassword(e) {
      e.preventDefault();
      setErr(''); setOk('');
      if (pw !== pw2) { setErr('兩次輸入的密碼不一致'); return; }
      setSaving(true);
      try {
        await APIClient.changePassword(me.id, pw);
        setOk('密碼已成功變更');
        setPw(''); setPw2('');
        if (onPasswordChanged) onPasswordChanged();
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setSaving(false);
      }
    }

    return (
      <Card title="我的帳號">
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>使用者名稱</div>
            <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{me.username}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>角色</div>
            <Badge role={me.role} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>帳號 ID</div>
            <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', color: 'var(--text2)' }}>#{me.id}</div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>變更密碼</div>
          <form onSubmit={handleChangePassword}>
            <Alert msg={err} type="error" />
            <Alert msg={ok} type="success" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <Field label="新密碼">
                <Input type="password" value={pw} onChange={setPw} placeholder="至少 8 字元，含大寫、數字、符號" />
              </Field>
              <Field label="確認新密碼">
                <Input type="password" value={pw2} onChange={setPw2} placeholder="再輸入一次" />
              </Field>
            </div>
            <Btn disabled={saving || !pw || !pw2}>
              {saving ? '儲存中…' : '變更密碼'}
            </Btn>
          </form>
        </div>
      </Card>
    );
  }

  // ── 使用者清單（admin） ───────────────────────────────────────────────────

  function UserListCard({ me, users, onRefresh }) {
    const [delId, setDelId] = useState(null);
    const [pwTarget, setPwTarget] = useState(null);
    const [pw, setPw] = useState('');
    const [pw2, setPw2] = useState('');
    const [pwErr, setPwErr] = useState('');
    const [pwOk, setPwOk] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleDelete(u) {
      if (!window.confirm(`確定要刪除使用者「${u.username}」？此操作無法復原。`)) return;
      try {
        await APIClient.deleteUser(u.id);
        onRefresh();
      } catch (ex) {
        alert('刪除失敗：' + ex.message);
      }
    }

    async function handleAdminPw(e) {
      e.preventDefault();
      setPwErr(''); setPwOk('');
      if (pw !== pw2) { setPwErr('兩次密碼不一致'); return; }
      setSaving(true);
      try {
        await APIClient.changePassword(pwTarget.id, pw);
        setPwOk(`已成功重設 ${pwTarget.username} 的密碼`);
        setPw(''); setPw2('');
        setTimeout(() => { setPwTarget(null); setPwOk(''); }, 1500);
      } catch (ex) {
        setPwErr(ex.message);
      } finally {
        setSaving(false);
      }
    }

    return (
      <Card title={`使用者清單（共 ${users.length} 人）`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['ID', '使用者名稱', '角色', '操作'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>#{u.id}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    {u.username}
                    {u.id === me.id && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', background: 'var(--accent-bg)', borderRadius: 99, padding: '1px 6px' }}>你</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}><Badge role={u.role} /></td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Btn variant="ghost" style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={() => { setPwTarget(u); setPw(''); setPw2(''); setPwErr(''); setPwOk(''); }}>
                        重設密碼
                      </Btn>
                      {u.id !== me.id && (
                        <Btn variant="danger" style={{ padding: '4px 12px', fontSize: 12 }}
                          onClick={() => handleDelete(u)}>
                          刪除
                        </Btn>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pwTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rlg)', padding: '28px 32px', width: 420, maxWidth: '90vw' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>重設密碼 — {pwTarget.username}</div>
              <form onSubmit={handleAdminPw}>
                <Alert msg={pwErr} type="error" />
                <Alert msg={pwOk} type="success" />
                <Field label="新密碼">
                  <Input type="password" value={pw} onChange={setPw} placeholder="至少 8 字元，含大寫、數字、符號" />
                </Field>
                <Field label="確認新密碼">
                  <Input type="password" value={pw2} onChange={setPw2} placeholder="再輸入一次" />
                </Field>
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <Btn disabled={saving || !pw || !pw2}>{saving ? '儲存中…' : '確認變更'}</Btn>
                  <Btn variant="ghost" onClick={() => setPwTarget(null)}>取消</Btn>
                </div>
              </form>
            </div>
          </div>
        )}
      </Card>
    );
  }

  // ── 新增使用者（admin） ───────────────────────────────────────────────────

  function CreateUserCard({ onCreated }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('viewer');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState('');

    async function handleSubmit(e) {
      e.preventDefault();
      setErr(''); setOk('');
      setSaving(true);
      try {
        const u = await APIClient.createUser(username, password, role);
        setOk(`使用者「${u.username}」建立成功`);
        setUsername(''); setPassword(''); setRole('viewer');
        onCreated();
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setSaving(false);
      }
    }

    return (
      <Card title="新增使用者">
        <form onSubmit={handleSubmit}>
          <Alert msg={err} type="error" />
          <Alert msg={ok} type="success" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 180px', gap: 12, marginBottom: 12 }}>
            <Field label="使用者名稱">
              <Input value={username} onChange={setUsername} placeholder="3–50 字元，英數字及底線" />
            </Field>
            <Field label="密碼">
              <Input type="password" value={password} onChange={setPassword} placeholder="至少 8 字元，含大寫、數字、符號" />
            </Field>
            <Field label="角色">
              <Select value={role} onChange={setRole} options={[
                { value: 'admin',   label: '管理員 (admin)' },
                { value: 'analyst', label: '分析師 (analyst)' },
                { value: 'viewer',  label: '檢視者 (viewer)' },
              ]} />
            </Field>
          </div>
          <Btn disabled={saving || !username || !password}>
            {saving ? '建立中…' : '建立使用者'}
          </Btn>
        </form>
      </Card>
    );
  }

  // ── 主頁面 ────────────────────────────────────────────────────────────────

  function UserManagementPage() {
    const [me, setMe] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    async function loadData() {
      setErr('');
      try {
        const meData = await APIClient.getMe();
        setMe(meData);
        if (meData.role === 'admin') {
          const list = await APIClient.getUsers();
          setUsers(list);
        }
      } catch (ex) {
        setErr(ex.message);
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { loadData(); }, []);

    if (loading) return (
      <div style={{ padding: 40, color: 'var(--text2)', textAlign: 'center' }}>載入中…</div>
    );

    if (err) return (
      <div style={{ padding: 40 }}>
        <Alert msg={err} type="error" />
      </div>
    );

    return (
      <div style={{ maxWidth: 900 }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>帳號管理</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>管理系統使用者帳號與權限</div>
        </div>

        {me && <MyAccountCard me={me} onPasswordChanged={loadData} />}

        {me && me.role === 'admin' && (
          <>
            <CreateUserCard onCreated={loadData} />
            <UserListCard me={me} users={users} onRefresh={loadData} />
          </>
        )}

        {me && me.role !== 'admin' && (
          <Card>
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>
              你的角色為 <Badge role={me.role} />，僅可管理自己的密碼。如需新增或管理其他使用者，請聯絡管理員。
            </div>
          </Card>
        )}
      </div>
    );
  }

  window.UserManagementPage = UserManagementPage;
})();
