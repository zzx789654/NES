// Admin Page — User Management

const { useState, useEffect, useCallback } = React;

const ROLE_META = {
  admin:   { label: '管理員', bg: 'var(--critical-bg)',  color: 'var(--critical)' },
  analyst: { label: '分析師', bg: 'var(--accent-bg)',    color: 'var(--accent)' },
  viewer:  { label: '檢視者', bg: 'var(--info-bg)',      color: 'var(--info)' },
};

function RoleBadge({ role }) {
  const m = ROLE_META[role] || { label: role, bg: 'var(--surface2)', color: 'var(--text2)' };
  return (
    <span style={{ display:'inline-block', padding:'2px 9px', borderRadius:99,
      background:m.bg, color:m.color, fontSize:11, fontWeight:700 }}>
      {m.label}
    </span>
  );
}

function daysUntilExpiry(user) {
  if (user.password_expires_days === 0) return null;
  const changed = new Date(user.password_changed_at);
  const expiry = new Date(changed.getTime() + user.password_expires_days * 86400000);
  return Math.ceil((expiry - Date.now()) / 86400000);
}

function ExpiryCell({ user }) {
  if (user.password_expires_days === 0)
    return <span style={{ color:'var(--text3)', fontSize:12 }}>永不到期</span>;
  const days = daysUntilExpiry(user);
  const color = days <= 0 ? 'var(--critical)' : days <= 7 ? 'var(--high)' : days <= 30 ? 'var(--warning)' : 'var(--success)';
  const label = days <= 0 ? `已到期 ${Math.abs(days)} 天` : `${days} 天後`;
  return <span style={{ color, fontWeight:600, fontSize:12 }}>{label}</span>;
}

function PasswordStrengthBar({ password }) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[@$!%*?&_\-#^]/.test(password)) score++;
  const colors = ['var(--critical)', 'var(--high)', 'var(--warning)', 'var(--success)'];
  const labels = ['弱', '一般', '良好', '強'];
  if (!password) return null;
  return (
    <div style={{ marginTop:6 }}>
      <div style={{ display:'flex', gap:3, marginBottom:3 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2,
            background: i < score ? colors[score-1] : 'var(--border)' }} />
        ))}
      </div>
      <div style={{ fontSize:11, color: score > 0 ? colors[score-1] : 'var(--text3)' }}>
        密碼強度：{score > 0 ? labels[score-1] : '—'}
      </div>
    </div>
  );
}

function AdminPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ username:'', password:'', role:'viewer', password_expires_days:90 });
  const [createErr, setCreateErr] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit user modal
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ role:'viewer', password_expires_days:90 });
  const [editErr, setEditErr] = useState('');

  // Reset password modal
  const [resetUser, setResetUser] = useState(null);
  const [resetPw, setResetPw] = useState('');
  const [resetErr, setResetErr] = useState('');

  const loadUsers = useCallback(() => {
    setLoading(true);
    APIClient.getUsers()
      .then(data => { setUsers(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { loadUsers(); }, []);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 3000); };

  const handleToggleActive = (u) => {
    const action = u.is_active ? '停用' : '啟用';
    if (!window.confirm(`確定要${action}帳號「${u.username}」嗎？`)) return;
    APIClient.toggleUserActive(u.id)
      .then(() => { flash(`帳號「${u.username}」已${action}`); loadUsers(); })
      .catch(e => alert(e.message));
  };

  const handleDelete = (u) => {
    if (!window.confirm(`確定要刪除帳號「${u.username}」嗎？此操作無法復原。`)) return;
    APIClient.deleteUser(u.id)
      .then(() => { flash(`帳號「${u.username}」已刪除`); loadUsers(); })
      .catch(e => alert(e.message));
  };

  const handleCreate = () => {
    setCreateErr('');
    setCreateLoading(true);
    APIClient.getUsers()  // just to verify admin still valid
      .then(() => fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Authorization':'Bearer '+sessionStorage.getItem('secvision_token') },
        body: JSON.stringify(createForm),
      }))
      .then(async res => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(
            Array.isArray(e.detail)
              ? e.detail.map(d => d.msg).join('; ')
              : (e.detail || 'HTTP '+res.status)
          );
        }
        return res.json();
      })
      .then(() => {
        setShowCreate(false);
        setCreateForm({ username:'', password:'', role:'viewer', password_expires_days:90 });
        flash('帳號建立成功');
        loadUsers();
      })
      .catch(e => setCreateErr(e.message))
      .finally(() => setCreateLoading(false));
  };

  const handleEdit = () => {
    APIClient.updateUser(editUser.id, editForm)
      .then(() => { setEditUser(null); flash('帳號更新成功'); loadUsers(); })
      .catch(e => setEditErr(e.message));
  };

  const handleReset = () => {
    setResetErr('');
    APIClient.adminResetPassword(resetUser.id, resetPw)
      .then(() => { setResetUser(null); setResetPw(''); flash('密碼已重設'); })
      .catch(e => setResetErr(e.message));
  };

  const now = Date.now();
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    expired: users.filter(u => {
      if (u.password_expires_days === 0) return false;
      const changed = new Date(u.password_changed_at);
      return Date.now() > changed.getTime() + u.password_expires_days * 86400000;
    }).length,
  };

  return (
    <div>
      <PageHeader
        title="帳號管理"
        subtitle="管理系統使用者帳號、角色與密碼到期政策"
        actions={<Btn onClick={() => { setShowCreate(true); setCreateErr(''); }}>＋ 建立帳號</Btn>}
      />

      {/* Flash message */}
      {msg && (
        <div style={{ marginBottom:16, padding:'10px 14px', borderRadius:'var(--r)',
          background:'var(--success-bg)', color:'var(--success)', border:'1px solid var(--success)',
          fontSize:13, fontWeight:500 }}>
          ✓ {msg}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text2)', marginBottom:6 }}>總帳號數</div>
          <div style={{ fontSize:28, fontWeight:700 }}>{stats.total}</div>
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text2)', marginBottom:6 }}>啟用中</div>
          <div style={{ fontSize:28, fontWeight:700, color:'var(--success)' }}>{stats.active}</div>
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderLeft:`3px solid ${stats.expired>0?'var(--critical)':'var(--border)'}`, borderRadius:'var(--r)', padding:'14px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text2)', marginBottom:6 }}>密碼已到期</div>
          <div style={{ fontSize:28, fontWeight:700, color:stats.expired>0?'var(--critical)':'var(--text3)' }}>{stats.expired}</div>
        </div>
      </div>

      {/* User table */}
      <Card noPad>
        {loading ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--text3)' }}>載入中…</div>
        ) : error ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--critical)' }}>{error}</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'var(--surface2)' }}>
                  {['ID','使用者名稱','角色','狀態','密碼到期','最後登入','建立時間','操作'].map(h => (
                    <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                      letterSpacing:'0.07em', textTransform:'uppercase', color:'var(--text2)',
                      borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}
                    style={{ borderBottom:'1px solid var(--border)', opacity: u.is_active ? 1 : 0.5 }}
                    onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                    onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{ padding:'10px 14px', color:'var(--text3)', fontFamily:'var(--font-mono)', fontSize:12 }}>{u.id}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>
                      {u.username}
                      {u.id === currentUser?.id && (
                        <span style={{ marginLeft:6, fontSize:10, color:'var(--accent)', border:'1px solid var(--accent)',
                          borderRadius:99, padding:'1px 5px' }}>我</span>
                      )}
                    </td>
                    <td style={{ padding:'10px 14px' }}><RoleBadge role={u.role} /></td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ color: u.is_active ? 'var(--success)' : 'var(--critical)', fontWeight:600, fontSize:12 }}>
                        {u.is_active ? '● 啟用' : '○ 停用'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px' }}><ExpiryCell user={u} /></td>
                    <td style={{ padding:'10px 14px', color:'var(--text2)', fontSize:12 }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('zh-TW') : '—'}
                    </td>
                    <td style={{ padding:'10px 14px', color:'var(--text2)', fontSize:12 }}>
                      {new Date(u.created_at).toLocaleDateString('zh-TW')}
                    </td>
                    <td style={{ padding:'8px 14px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <Btn size="sm" variant="secondary" onClick={() => { setEditUser(u); setEditForm({ role:u.role, password_expires_days:u.password_expires_days }); setEditErr(''); }}>編輯</Btn>
                        <Btn size="sm" variant="secondary" onClick={() => { setResetUser(u); setResetPw(''); setResetErr(''); }}>重設密碼</Btn>
                        {u.id !== currentUser?.id && (
                          <>
                            <Btn size="sm" variant={u.is_active ? 'danger' : 'secondary'} onClick={() => handleToggleActive(u)}>
                              {u.is_active ? '停用' : '啟用'}
                            </Btn>
                            <Btn size="sm" variant="danger" onClick={() => handleDelete(u)}>刪除</Btn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'var(--text3)', fontStyle:'italic' }}>目前無帳號</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Create User Modal ── */}
      <Modal open={showCreate} title="建立新帳號" onClose={() => setShowCreate(false)} width={460}>
        <FormField label="使用者名稱" required hint="3–50 字元，僅限英文字母/數字/底線">
          <FormInput value={createForm.username} onChange={e => setCreateForm(f=>({...f,username:e.target.value}))} placeholder="e.g. john_doe" />
        </FormField>
        <FormField label="密碼" required hint="至少 8 碼，含大寫、數字、特殊字元">
          <FormInput type="password" value={createForm.password} onChange={e => setCreateForm(f=>({...f,password:e.target.value}))} placeholder="••••••••" />
          <PasswordStrengthBar password={createForm.password} />
        </FormField>
        <FormField label="角色">
          <FormSelect value={createForm.role} onChange={e => setCreateForm(f=>({...f,role:e.target.value}))}>
            <option value="viewer">檢視者 (Viewer)</option>
            <option value="analyst">分析師 (Analyst)</option>
            <option value="admin">管理員 (Admin)</option>
          </FormSelect>
        </FormField>
        <FormField label="密碼到期天數" hint="0 = 永不到期">
          <FormInput type="number" min="0" max="365" value={createForm.password_expires_days}
            onChange={e => setCreateForm(f=>({...f,password_expires_days:parseInt(e.target.value)||0}))} />
        </FormField>
        {createErr && <div style={{ color:'var(--critical)', fontSize:12, marginBottom:12, padding:'8px 10px', background:'var(--critical-bg)', borderRadius:'var(--rsm)' }}>{createErr}</div>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={() => setShowCreate(false)}>取消</Btn>
          <Btn disabled={createLoading} onClick={handleCreate}>{createLoading ? '建立中…' : '建立帳號'}</Btn>
        </div>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal open={!!editUser} title={`編輯帳號：${editUser?.username}`} onClose={() => setEditUser(null)} width={400}>
        <FormField label="角色">
          <FormSelect value={editForm.role} onChange={e => setEditForm(f=>({...f,role:e.target.value}))}>
            <option value="viewer">檢視者 (Viewer)</option>
            <option value="analyst">分析師 (Analyst)</option>
            <option value="admin">管理員 (Admin)</option>
          </FormSelect>
        </FormField>
        <FormField label="密碼到期天數" hint="0 = 永不到期">
          <FormInput type="number" min="0" max="365" value={editForm.password_expires_days}
            onChange={e => setEditForm(f=>({...f,password_expires_days:parseInt(e.target.value)||0}))} />
        </FormField>
        {editErr && <div style={{ color:'var(--critical)', fontSize:12, marginBottom:12 }}>{editErr}</div>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={() => setEditUser(null)}>取消</Btn>
          <Btn onClick={handleEdit}>儲存變更</Btn>
        </div>
      </Modal>

      {/* ── Reset Password Modal ── */}
      <Modal open={!!resetUser} title={`重設密碼：${resetUser?.username}`} onClose={() => setResetUser(null)} width={400}>
        <FormField label="新密碼" required hint="至少 8 碼，含大寫、數字、特殊字元">
          <FormInput type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="••••••••" />
          <PasswordStrengthBar password={resetPw} />
        </FormField>
        {resetErr && <div style={{ color:'var(--critical)', fontSize:12, marginBottom:12 }}>{resetErr}</div>}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <Btn variant="secondary" onClick={() => setResetUser(null)}>取消</Btn>
          <Btn variant="danger" onClick={handleReset}>確認重設</Btn>
        </div>
      </Modal>
    </div>
  );
}

window.AdminPage = AdminPage;
