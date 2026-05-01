// SecVision API Client — unified fetch wrapper with JWT Bearer auth

const APIClient = (() => {
  const TOKEN_KEY = 'secvision_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function authHeaders() {
    const token = getToken();
    if (token) {
      return { 'Authorization': 'Bearer ' + token };
    }
    return {};
  }

  async function req(path, opts) {
    const options = Object.assign({ headers: {} }, opts);
    options.headers = Object.assign(
      { 'Content-Type': 'application/json' },
      authHeaders(),
      options.headers
    );
    const res = await fetch(path, options);
    if (res.status === 401) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('secvision:unauthorized'));
      throw new Error('未授權，請重新登入');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'HTTP ' + res.status);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    // ─── Auth ────────────────────────────────────────────────────────────────

    isLoggedIn() {
      return !!getToken();
    },

    async login(username, password) {
      const body = new URLSearchParams({ username, password });
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // Relay password_expired flag for frontend handling
        if (res.status === 403 && err.detail && err.detail.password_expired) {
          const e = new Error('password_expired');
          e.passwordExpired = true;
          e.username = err.detail.username;
          throw e;
        }
        throw new Error(err.detail || '帳號或密碼錯誤');
      }
      const data = await res.json();
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      return data;
    },

    logout() {
      sessionStorage.removeItem(TOKEN_KEY);
    },

    getMe() {
      return req('/api/auth/me');
    },

    changePassword(oldPassword, newPassword) {
      return req('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
    },

    async changeExpiredPassword(username, oldPassword, newPassword) {
      const res = await fetch('/api/auth/change-expired-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, old_password: oldPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Array.isArray(err.detail)
            ? err.detail.map(d => d.msg).join('; ')
            : (err.detail || 'HTTP ' + res.status)
        );
      }
      const data = await res.json();
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      return data;
    },

    // ─── Dashboard ───────────────────────────────────────────────────────────

    getDashboardStats() {
      return req('/api/dashboard');
    },

    // ─── Vulnerability Scans ─────────────────────────────────────────────────

    getAllScans() {
      return req('/api/scans');
    },

    getScanDetail(id) {
      return req('/api/scans/' + id);
    },

    deleteScan(id) {
      return req('/api/scans/' + id, { method: 'DELETE' });
    },

    getScanDiff(baseId, compId) {
      return req('/api/scans/diff?base=' + baseId + '&comp=' + compId);
    },

    getHostHistory(host) {
      return req('/api/scans/hosts/' + encodeURIComponent(host) + '/history');
    },

    uploadScan(file, name) {
      const form = new FormData();
      form.append('file', file);
      if (name) form.append('name', name);
      return fetch('/api/scans/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      }).then(async res => {
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          window.dispatchEvent(new CustomEvent('secvision:unauthorized'));
          throw new Error('未授權，請重新登入');
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'HTTP ' + res.status);
        }
        return res.json();
      });
    },

    // ─── NIST Audit ──────────────────────────────────────────────────────────

    getNISTScans() {
      return req('/api/nist/scans');
    },

    getNISTScanDetail(id) {
      return req('/api/nist/scans/' + id);
    },

    getNISTDiff(baseId, compId) {
      return req('/api/nist/diff?base=' + baseId + '&comp=' + compId);
    },

    getNISTTrend() {
      return req('/api/nist/trend');
    },

    uploadAudit(file, name) {
      const form = new FormData();
      form.append('file', file);
      if (name) form.append('name', name);
      return fetch('/api/nist/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      }).then(async res => {
        if (res.status === 401) {
          sessionStorage.removeItem(TOKEN_KEY);
          window.dispatchEvent(new CustomEvent('secvision:unauthorized'));
          throw new Error('未授權，請重新登入');
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'HTTP ' + res.status);
        }
        return res.json();
      });
    },

    // ─── IP Groups ───────────────────────────────────────────────────────────

    getIPGroups() {
      return req('/api/ipgroups');
    },

    createIPGroup(name, ips) {
      return req('/api/ipgroups', {
        method: 'POST',
        body: JSON.stringify({ name, ips }),
      });
    },

    deleteIPGroup(id) {
      return req('/api/ipgroups/' + id, { method: 'DELETE' });
    },

    // ─── User Management (admin only) ────────────────────────────────────────

    getUsers() {
      return req('/api/users');
    },

    updateUser(id, data) {
      return req('/api/users/' + id, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },

    toggleUserActive(id) {
      return req('/api/users/' + id + '/activate', { method: 'PATCH' });
    },

    adminResetPassword(id, newPassword) {
      return req('/api/users/' + id + '/reset-password', {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
    },

    deleteUser(id) {
      return req('/api/users/' + id, { method: 'DELETE' });
    },
  };
})();
