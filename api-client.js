// SecVision API Client — unified fetch wrapper with JWT Bearer auth

const APIClient = (() => {
  const TOKEN_KEY = 'secvision_token';

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function authHeaders() {
    const token = getToken();
    if (token && token !== '__demo__') {
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

  async function reqForm(path, formData) {
    const res = await fetch(path, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
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
  }

  return {
    // ─── Auth ────────────────────────────────────────────────────────────────

    isLoggedIn() {
      return !!getToken();
    },

    isDemoMode() {
      return getToken() === '__demo__';
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
        throw new Error(err.detail || '帳號或密碼錯誤');
      }
      const data = await res.json();
      sessionStorage.setItem(TOKEN_KEY, data.access_token);
      return data;
    },

    loginDemo() {
      sessionStorage.setItem(TOKEN_KEY, '__demo__');
    },

    logout() {
      sessionStorage.removeItem(TOKEN_KEY);
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

    uploadScan(file, name) {
      const form = new FormData();
      form.append('file', file);
      if (name) form.append('name', name);
      return reqForm('/api/scans/upload', form);
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
      return reqForm('/api/nist/upload', form);
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
  };
})();
