// Vulnerability Scan Page — API-driven scan list, filters, charts, IP groups, diff, upload

const { useState, useEffect, useMemo, useRef } = React;

const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };

// Compare IP addresses numerically (handles IPv4; falls back to string compare)
function compareIP(a, b) {
  const toNum = ip => {
    if (!ip) return -1;
    const parts = String(ip).split('.');
    if (parts.length !== 4) return -1;
    return parts.reduce((acc, p) => acc * 256 + (parseInt(p, 10) || 0), 0);
  };
  const na = toNum(a), nb = toNum(b);
  if (na !== -1 && nb !== -1) return na - nb;
  return String(a || '').localeCompare(String(b || ''));
}
const SEV_COLOR = {
  Critical: 'oklch(0.60 0.22 25)',
  High: 'oklch(0.68 0.20 45)',
  Medium: 'oklch(0.76 0.17 72)',
  Low: 'oklch(0.70 0.14 195)',
  Info: 'oklch(0.62 0.06 240)',
};

function QuadrantChart({ vulns, xKey, yKey, xLabel, yLabel, xMid, yMid, xMax, yMax, title, quadrantLabels }) {
  const ref = useRef(null);
  const inst = useRef(null);

  const datasets = useMemo(() => {
    const groups = { Critical: [], High: [], Medium: [], Low: [], Info: [] };
    vulns.forEach(v => {
      const x = parseFloat(v[xKey]);
      const y = parseFloat(v[yKey]);
      if (isNaN(x) || isNaN(y)) return;
      const risk = v.risk || 'Info';
      groups[risk in groups ? risk : 'Info'].push({ x, y, name: v.name, host: v.host, cve: v.cve, id: v.id });
    });
    return Object.entries(groups)
      .filter(([, pts]) => pts.length > 0)
      .map(([risk, data]) => ({
        label: risk,
        data,
        backgroundColor: SEV_COLOR[risk] + 'cc',
        borderColor: SEV_COLOR[risk],
        pointRadius: 6,
        pointHoverRadius: 9,
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
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: 'var(--text2)', font: { size: 11 }, boxWidth: 10, padding: 12 } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pt = ctx.raw;
                return [
                  `${pt.name?.slice(0, 50) || '—'}`,
                  `Host: ${pt.host || '—'}  CVE: ${pt.cve || '—'}`,
                  `${xLabel}: ${pt.x}  ${yLabel}: ${pt.y}`,
                ];
              },
            },
            backgroundColor: 'var(--surface)',
            titleColor: 'var(--text)',
            bodyColor: 'var(--text2)',
            borderColor: 'var(--border)',
            borderWidth: 1,
            padding: 10,
          },
        },
        scales: {
          x: { min: 0, max: xMax, title: { display: true, text: xLabel, color: 'var(--text2)', font: { size: 11 } }, ticks: { color: 'var(--text3)', font: { size: 10 } }, grid: { color: 'oklch(0.3 0 0 / 0.2)' } },
          y: { min: 0, max: yMax, title: { display: true, text: yLabel, color: 'var(--text2)', font: { size: 11 } }, ticks: { color: 'var(--text3)', font: { size: 10 } }, grid: { color: 'oklch(0.3 0 0 / 0.2)' } },
        },
      },
      plugins: [
        {
          id: 'quadrantBg',
          beforeDraw(chart) {
            const { ctx, chartArea: ca, scales: { x, y } } = chart;
            if (!ca) return;
            const mx = x.getPixelForValue(xMid);
            const my = y.getPixelForValue(yMid);
            const quads = [
              { x: ca.left, y: ca.top, w: mx - ca.left, h: my - ca.top, fill: 'oklch(0.76 0.17 72 / 0.07)', label: quadrantLabels[2] },
              { x: mx, y: ca.top, w: ca.right - mx, h: my - ca.top, fill: 'oklch(0.60 0.22 25 / 0.10)', label: quadrantLabels[0] },
              { x: ca.left, y: my, w: mx - ca.left, h: ca.bottom - my, fill: 'oklch(0.66 0.15 145 / 0.07)', label: quadrantLabels[3] },
              { x: mx, y: my, w: ca.right - mx, h: ca.bottom - my, fill: 'oklch(0.68 0.20 45 / 0.08)', label: quadrantLabels[1] },
            ];
            quads.forEach(q => {
              ctx.fillStyle = q.fill;
              ctx.fillRect(q.x, q.y, q.w, q.h);
              ctx.fillStyle = 'oklch(0.5 0 0 / 0.5)';
              ctx.font = 'bold 11px IBM Plex Sans, sans-serif';
              ctx.textAlign = q.x === ca.left ? 'left' : 'right';
              ctx.textBaseline = q.y === ca.top ? 'top' : 'bottom';
              const tx = q.x === ca.left ? q.x + 8 : q.x + q.w - 8;
              const ty = q.y === ca.top ? q.y + 6 : q.y + q.h - 6;
              ctx.fillText(q.label, tx, ty);
            });
            ctx.save();
            ctx.strokeStyle = 'oklch(0.5 0 0 / 0.3)';
            ctx.setLineDash([4, 4]);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mx, ca.top);
            ctx.lineTo(mx, ca.bottom);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ca.left, my);
            ctx.lineTo(ca.right, my);
            ctx.stroke();
            ctx.restore();
          },
        },
      ],
    });
    return () => { if (inst.current) inst.current.destroy(); };
  }, [datasets, xMid, yMid]);

  const qCounts = useMemo(() => {
    const c = [0, 0, 0, 0];
    vulns.forEach(v => {
      const x = parseFloat(v[xKey]);
      const y = parseFloat(v[yKey]);
      if (isNaN(x) || isNaN(y)) return;
      if (x >= xMid && y >= yMid) c[0]++;
      else if (x >= xMid && y < yMid) c[1]++;
      else if (x < xMid && y >= yMid) c[2]++;
      else c[3]++;
    });
    return c;
  }, [vulns, xKey, yKey, xMid, yMid]);

  const qColors = ['var(--critical)', 'var(--high)', 'var(--warning)', 'var(--success)'];

  return (
    <Card title={title}>
      <div style={{ position: 'relative', height: 320 }}>
        <canvas ref={ref}></canvas>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
        {quadrantLabels.map((lbl, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--surface2)', borderRadius: 'var(--rsm)' }}>
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{lbl}</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: qColors[i], fontSize: 14 }}>{qCounts[i]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function IPGroupManager({ allHosts, selectedIPs, onSelectIPs }) {
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null); // {id, name, ips}
  const [editName, setEditName] = useState('');
  const [editIPs, setEditIPs] = useState([]);

  const loadGroups = () => {
    setLoading(true);
    return APIClient.getIPGroups()
      .then(data => { setGroups(data); setError(''); setLoading(false); })
      .catch(err => { setError(err.message || '無法載入 IP 群組'); setGroups([]); setLoading(false); });
  };

  useEffect(() => { loadGroups(); }, []);

  const saveGroup = () => {
    const name = newGroupName.trim();
    if (!name || selectedIPs.length === 0) return;
    APIClient.createIPGroup(name, selectedIPs)
      .then(() => { setNewGroupName(''); loadGroups(); })
      .catch(err => alert(err.message || '無法儲存 IP 群組'));
  };

  const startEdit = (group) => {
    setEditTarget(group);
    setEditName(group.name);
    setEditIPs([...group.ips]);
  };

  const saveEdit = () => {
    const name = editName.trim();
    if (!name || editIPs.length === 0) return;
    APIClient.updateIPGroup(editTarget.id, name, editIPs)
      .then(() => { setEditTarget(null); loadGroups(); })
      .catch(err => alert(err.message || '無法更新 IP 群組'));
  };

  const toggleEditIP = ip => setEditIPs(prev =>
    prev.includes(ip) ? prev.filter(x => x !== ip) : [...prev, ip]
  );

  const deleteGroup = id => {
    APIClient.deleteIPGroup(id)
      .then(() => loadGroups())
      .catch(err => alert(err.message || '無法刪除 IP 群組'));
  };

  const toggleIP = ip => onSelectIPs(prev =>
    prev.includes(ip) ? prev.filter(x => x !== ip) : [...prev, ip]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* 編輯群組 Modal */}
      {editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0 0 0 / 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rlg)', padding: '24px 28px', width: 420, maxWidth: '90vw' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>編輯群組 — {editTarget.name}</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>群組名稱</div>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>
                選擇 IP（{editIPs.length} 已選）—— 點擊切換
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 140, overflowY: 'auto', padding: '6px', background: 'var(--surface2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                {allHosts.length === 0
                  ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>無可選主機（請先載入掃描）</span>
                  : allHosts.map(ip => {
                    const sel = editIPs.includes(ip);
                    return (
                      <button key={ip} onClick={() => toggleEditIP(ip)}
                        style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent-bg)' : 'transparent', color: sel ? 'var(--accent)' : 'var(--text2)', fontWeight: sel ? 700 : 400, transition: 'all 0.12s' }}>
                        {ip}
                      </button>
                    );
                  })
                }
              </div>
              {/* 也可手動輸入 IP */}
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
                目前已選：{editIPs.length === 0 ? '—' : editIPs.join('、')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveEdit} disabled={!editName.trim() || editIPs.length === 0}
                style={{ padding: '7px 18px', borderRadius: 'var(--r)', background: 'var(--accent)', color: '#000', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                儲存變更
              </button>
              <button onClick={() => setEditTarget(null)}
                style={{ padding: '7px 18px', borderRadius: 'var(--r)', background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>
            IP 篩選 / 選擇主機（{selectedIPs.length} 已選）
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 120, overflow: 'auto' }}>
            {allHosts.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>此掃描尚無主機資料</div>
            ) : allHosts.map(host => {
              const sel = selectedIPs.includes(host);
              return (
                <button key={host} onClick={() => toggleIP(host)}
                  style={{ padding: '5px 10px', borderRadius: 999, fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`, background: sel ? 'var(--accent-bg)' : 'var(--surface2)', color: sel ? 'var(--accent)' : 'var(--text2)', transition: 'all 0.12s', fontWeight: sel ? 700 : 400 }}>
                  {host}
                </button>
              );
            })}
          </div>
          {selectedIPs.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => onSelectIPs([])} style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>清除全部</button>
              <button onClick={() => onSelectIPs(allHosts)} style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}>全選</button>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px', minWidth: 260 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>儲存 IP 群組</div>
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="群組名稱…"
              style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--rsm)', padding: '8px 10px', fontSize: 13, color: 'var(--text)' }}
              onKeyDown={e => e.key === 'Enter' && saveGroup()} />
            <Btn size="sm" variant="secondary" onClick={saveGroup} disabled={!newGroupName.trim() || selectedIPs.length === 0}>💾 儲存群組</Btn>
          </div>
          {error && <div style={{ marginTop: 10, color: 'var(--critical)', fontSize: 12 }}>{error}</div>}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>已儲存群組：</span>
        {loading ? (
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>載入中…</span>
        ) : groups.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>尚無群組</span>
        ) : groups.map(group => (
          <div key={group.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 0, borderRadius: 999, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface2)' }}>
            <button onClick={() => onSelectIPs(group.ips)}
              style={{ padding: '4px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text)' }}
              title={group.ips.join(', ')}>
              {group.name} <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>({group.ips.length})</span>
            </button>
            <button onClick={() => startEdit(group)}
              style={{ padding: '4px 7px', fontSize: 12, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text3)', borderLeft: '1px solid var(--border)' }}
              title="編輯群組">✎</button>
            <button onClick={() => deleteGroup(group.id)}
              style={{ padding: '4px 8px', fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text3)', borderLeft: '1px solid var(--border)' }}
              title="刪除群組">×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VulnScanPage({ onStatsChange, currentUser }) {
  const [tab, setTab] = useState('history');
  const [scans, setScans] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [diffBase, setDiffBase] = useState(null);
  const [diffComp, setDiffComp] = useState(null);
  const [selectedIPs, setSelectedIPs] = useState([]);
  const [historyHost, setHistoryHost] = useState('');
  const [hostHistory, setHostHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState('all');
  const [visibleCols, setVisibleCols] = useState(['risk', 'host', 'port', 'plugin_id', 'name', 'cve', 'cvss_v2_base', 'cvss_v3_base', 'epss', 'vpr']);
  const [expandedRow, setExpandedRow] = useState(null);
  const [expandedVulnDetail, setExpandedVulnDetail] = useState(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Debounce search input — avoid re-filtering on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 220);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadScans = () => {
    setLoading(true);
    return APIClient.getAllScans()
      .then(list => {
        const sorted = [...list].sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        setScans(sorted);
        setError('');
        setLoading(false);
        if (sorted.length > 0) {
          const latestId = sorted[0].id;
          if (!selectedId) {
            setSelectedId(latestId);
          }
          if (!detail || detail.id !== latestId) {
            loadScanDetail(latestId);
          }
        } else {
          setSelectedId(null);
          setDetail(null);
        }
        if (sorted.length > 1 && diffBase === null && diffComp === null) {
          setDiffBase(sorted[0].id);
          setDiffComp(sorted[1].id);
        }
      })
      .catch(err => {
        setError(err.message || '無法載入掃描清單');
        setScans([]);
        setLoading(false);
      });
  };

  const loadScanDetail = id => {
    if (!id) return;
    APIClient.getScanDetail(id)
      .then(data => {
        setDetail(data);
        setError('');
      })
      .catch(err => setError(err.message || '無法載入掃描明細'));
  };

  const loadDiff = (baseId, compId) => {
    if (!baseId || !compId || baseId === compId) {
      setDiffData(null);
      return;
    }
    APIClient.getScanDiff(baseId, compId)
      .then(data => {
        setDiffData(data);
        setError('');
      })
      .catch(err => setError(err.message || '無法載入掃描差異'));
  };

  const loadHostHistory = host => {
    if (!host) {
      setHostHistory(null);
      return;
    }
    setHistoryLoading(true);
    setHistoryError('');
    APIClient.getHostHistory(host)
      .then(data => {
        setHostHistory(data);
      })
      .catch(err => {
        setHostHistory(null);
        setHistoryError(err.message || '無法載入主機歷程');
      })
      .finally(() => setHistoryLoading(false));
  };

  useEffect(() => {
    loadScans();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadScanDetail(selectedId);
      setExpandedRow(null);
      setExpandedVulnDetail(null);
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (allHosts.length > 0 && !historyHost) {
      setHistoryHost(allHosts[0]);
    }
    if (historyHost && allHosts.length > 0 && !allHosts.includes(historyHost)) {
      setHistoryHost(allHosts[0]);
    }
  }, [allHosts, historyHost]);

  useEffect(() => {
    loadHostHistory(historyHost);
  }, [historyHost]);

  useEffect(() => {
    loadDiff(diffBase, diffComp);
  }, [diffBase, diffComp]);

  const handleUpload = (fileName, content) => {
    setUploading(true);
    const blob = new Blob([content]);
    const file = new File([blob], fileName, { type: 'application/octet-stream' });
    APIClient.uploadScan(file, fileName)
      .then(scan => {
        loadScans();
        setSelectedId(scan.id);
        if (onStatsChange) onStatsChange();
        alert('✅ 掃描上傳完成');
      })
      .catch(err => alert(err.message || '上傳失敗'))
      .finally(() => setUploading(false));
  };

  const handleDeleteScan = (id, name) => {
    if (!window.confirm(`確定要刪除掃描批次「${name}」？\n此操作將一併刪除所有相關弱點資料，且無法復原。`)) return;
    setDeleting(id);
    APIClient.deleteScan(id)
      .then(() => {
        if (selectedId === id) setSelectedId(null);
        if (diffBase === id) setDiffBase(null);
        if (diffComp === id) setDiffComp(null);
        loadScans();
        if (onStatsChange) onStatsChange();
      })
      .catch(err => alert(err.message || '刪除失敗'))
      .finally(() => setDeleting(null));
  };

  const selectedScan = scans.find(scan => scan.id === selectedId);
  const vulnRows = detail?.vulnerabilities || [];
  const allHosts = useMemo(() => [...new Set(vulnRows.map(v => v.host).filter(Boolean))].sort(compareIP), [vulnRows]);

  const activeVulns = useMemo(() => {
    if (selectedIPs.length === 0) return vulnRows;
    return vulnRows.filter(v => selectedIPs.includes(v.host));
  }, [vulnRows, selectedIPs]);

  const filteredVulns = useMemo(() => {
    return activeVulns
      .filter(v => sevFilter === 'all' || v.risk === sevFilter)
      .filter(v => {
        if (!search) return true;
        const term = search.toLowerCase();
        return [v.host, v.name, v.plugin_id, v.cve]
          .filter(Boolean)
          .some(field => String(field).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const ipCmp = compareIP(a.host, b.host);
        if (ipCmp !== 0) return ipCmp;
        return (SEV_ORDER[a.risk] ?? 99) - (SEV_ORDER[b.risk] ?? 99);
      });
  }, [activeVulns, search, sevFilter]);

  const diffRows = useMemo(() => {
    if (!diffData) return [];
    return [
      ...diffData.new.map(item => ({ ...item, status: 'new' })),
      ...diffData.resolved.map(item => ({ ...item, status: 'resolved' })),
      ...diffData.persistent.map(item => ({ ...item, status: 'persistent' })),
    ];
  }, [diffData]);

  const [diffFilter, setDiffFilter] = useState('all');
  const filteredDiff = useMemo(() => {
    return diffRows
      .filter(row => diffFilter === 'all' || row.status === diffFilter)
      .filter(row => {
        if (!search) return true;
        const term = search.toLowerCase();
        return [row.host, row.name, row.plugin_id, row.cve]
          .filter(Boolean)
          .some(field => String(field).toLowerCase().includes(term));
      })
      .filter(row => selectedIPs.length === 0 || selectedIPs.includes(row.host))
      .sort((a, b) => {
        const ipCmp = compareIP(a.host, b.host);
        if (ipCmp !== 0) return ipCmp;
        return (SEV_ORDER[a.risk] ?? 99) - (SEV_ORDER[b.risk] ?? 99);
      });
  }, [diffRows, diffFilter, search, selectedIPs]);

  const diffCounts = useMemo(() => ({
    all: diffRows.length,
    new: diffRows.filter(d => d.status === 'new').length,
    resolved: diffRows.filter(d => d.status === 'resolved').length,
    persistent: diffRows.filter(d => d.status === 'persistent').length,
  }), [diffRows]);

  const ALL_COLS = [
    { key: 'risk', label: '嚴重等級' },
    { key: 'host', label: '主機' },
    { key: 'port', label: 'Port' },
    { key: 'plugin_id', label: 'Plugin ID' },
    { key: 'name', label: '弱點名稱' },
    { key: 'cve', label: 'CVE' },
    { key: 'cvss_v2_base', label: 'CVSS v2' },
    { key: 'cvss_v3_base', label: 'CVSS v3' },
    { key: 'epss', label: 'EPSS' },
    { key: 'vpr', label: 'VPR' },
    { key: 'synopsis', label: '摘要' },
    { key: 'solution', label: '修補建議' },
  ];

  const columns = ALL_COLS.filter(c => visibleCols.includes(c.key)).map(c => ({
    ...c,
    sortable: true,
    mono: ['host', 'port', 'plugin_id', 'cve', 'cvss_v2_base', 'cvss_v3_base', 'epss', 'vpr'].includes(c.key),
    render: c.key === 'risk' ? v => <SeverityBadge level={v || 'Info'} />
      : c.key === 'epss' ? v => v != null ? <span style={{ color: parseFloat(v) >= 0.1 ? 'var(--critical)' : parseFloat(v) >= 0.01 ? 'var(--warning)' : 'var(--text2)', fontWeight: parseFloat(v) >= 0.1 ? 700 : 400 }}>{parseFloat(v).toFixed(3)}</span> : <span style={{ color: 'var(--text3)' }}>—</span>
      : c.key === 'vpr' ? v => v != null ? <span style={{ color: parseFloat(v) >= 7 ? 'var(--critical)' : parseFloat(v) >= 4 ? 'var(--warning)' : 'var(--text2)', fontWeight: parseFloat(v) >= 7 ? 700 : 400 }}>{parseFloat(v).toFixed(1)}</span> : <span style={{ color: 'var(--text3)' }}>—</span>
      : (c.key === 'cvss_v2_base' || c.key === 'cvss_v3_base') ? v => v != null ? <span style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>{parseFloat(v).toFixed(1)}</span> : <span style={{ color: 'var(--text3)' }}>—</span>
      : c.key === 'name' ? v => <span title={v} style={{ fontWeight: 500 }}>{v?.length > 60 ? v.slice(0, 58) + '…' : v}</span>
      : undefined,
  }));

  const epssVulns = useMemo(() => activeVulns.filter(v => v.epss != null && v.cvss_v3_base != null && parseFloat(v.cvss_v3_base) > 0), [activeVulns]);
  const vprVulns = useMemo(() => activeVulns.filter(v => v.vpr != null && v.cvss_v3_base != null && parseFloat(v.cvss_v3_base) > 0), [activeVulns]);

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)' }}>載入中…</div>;
  }

  return (
    <div>
      <PageHeader
        title="Vulnerability Scan"
        subtitle="使用真實 API 操作掃描清單、弱點明細、差異比對、EPSS/VPR 風險矩陣與 IP 群組"
        actions={
          <FileUpload
            accept=".csv,.json"
            onFile={handleUpload}
            label={uploading ? '上傳中…' : '上傳弱點掃描'}
            hint="支援 Nessus CSV 或 NVD CVE JSON"
          />
        }
      />

      {error && <div style={{ marginBottom: 18, color: 'var(--critical)' }}>{error}</div>}

      <Tabs
        active={tab}
        onChange={t => { setTab(t); setError(''); setSearchInput(''); setSearch(''); setSevFilter('all'); }}
        tabs={[
          { id: 'history', label: '掃描結果', icon: '📋', count: selectedScan?.vuln_count ?? 0 },
          { id: 'hosthistory', label: '主機歷程', icon: '🖥️', count: hostHistory?.total_scans ?? undefined },
          { id: 'matrix', label: '風險矩陣', icon: '⊞' },
          { id: 'diff', label: 'Diff 比較', icon: '⇄', count: diffCounts.new || 0 },
          { id: 'upload', label: '上傳管理', icon: '📂' },
        ]}
      />

      <div style={{ paddingTop: 16 }}>
        {['history', 'matrix', 'diff'].includes(tab) && (
          <div style={{ marginBottom: 16 }}>
            <IPGroupManager allHosts={allHosts} selectedIPs={selectedIPs} onSelectIPs={setSelectedIPs} />
          </div>
        )}

        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={selectedId || ''} onChange={e => setSelectedId(Number(e.target.value) || null)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--rsm)', padding: '7px 10px', fontSize: 13 }}>
                {scans.map(scan => <option key={scan.id} value={scan.id}>{scan.name} · {scan.uploaded_at.slice(0, 10)} · {scan.vuln_count} 筆</option>)}
              </select>
              <select value={sevFilter} onChange={e => setSevFilter(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--rsm)', padding: '7px 10px', fontSize: 13 }}>
                <option value="all">全部等級</option>
                {['Critical', 'High', 'Medium', 'Low', 'Info'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <SearchBar value={searchInput} onChange={setSearchInput} placeholder="搜尋 IP / 弱點名稱 / CVE…" />
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)', fontFamily: 'var(--font-mono)' }}>
                {filteredVulns.length} 筆{selectedIPs.length > 0 ? ` · ${selectedIPs.length} IP 篩選中` : ''}
              </span>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>顯示欄位</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {ALL_COLS.map(col => (
                  <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', padding: '4px 10px', borderRadius: 99, background: visibleCols.includes(col.key) ? 'var(--accent-bg)' : 'var(--surface2)', color: visibleCols.includes(col.key) ? 'var(--accent)' : 'var(--text3)' }}>
                    <input type="checkbox" checked={visibleCols.includes(col.key)} onChange={e => setVisibleCols(prev => e.target.checked ? [...prev, col.key] : prev.filter(k => k !== col.key))} style={{ accentColor: 'var(--accent)', width: 12, height: 12 }} />
                    {col.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Critical', 'High', 'Medium', 'Low', 'Info'].map(sev => {
                const cnt = activeVulns.filter(v => v.risk === sev).length;
                const colors = { Critical: 'var(--critical)', High: 'var(--high)', Medium: 'var(--medium)', Low: 'var(--low)', Info: 'var(--info)' };
                const bgs = { Critical: 'var(--critical-bg)', High: 'var(--high-bg)', Medium: 'var(--medium-bg)', Low: 'var(--low-bg)', Info: 'var(--info-bg)' };
                return (
                  <div key={sev} onClick={() => setSevFilter(sevFilter === sev ? 'all' : sev)}
                    style={{ flex: 1, minWidth: 120, background: sevFilter === sev ? bgs[sev] : 'var(--surface)', border: `1px solid ${sevFilter === sev ? colors[sev] : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '12px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: colors[sev] }}>{cnt}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sev}</div>
                  </div>
                );
              })}
            </div>

            <Card noPad>
              <DataTable columns={columns} rows={filteredVulns} maxHeight={520} onRowClick={row => {
                if (expandedRow?.id === row.id) {
                  setExpandedRow(null);
                  setExpandedVulnDetail(null);
                  return;
                }
                setExpandedRow(row);
                setExpandedVulnDetail(null);
                setExpandedLoading(true);
                APIClient.getVulnDetail(selectedId, row.id)
                  .then(d => setExpandedVulnDetail(d))
                  .catch(() => {})
                  .finally(() => setExpandedLoading(false));
              }} />
            </Card>

            {expandedRow && (
              <Card title={`弱點詳情 — ${expandedRow.name}`} action={<Btn size="sm" variant="ghost" onClick={() => { setExpandedRow(null); setExpandedVulnDetail(null); }}>關閉 ×</Btn>}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <SectionDivider label="基本資訊" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        ['主機 IP', expandedRow.host],
                        ['連接埠', `${expandedRow.port || '-'} / ${expandedRow.protocol || '-'}`],
                        ['Plugin ID', expandedRow.plugin_id],
                        ['CVE', expandedRow.cve || '—'],
                        ['CVSS v2', expandedRow.cvss_v2_base != null ? parseFloat(expandedRow.cvss_v2_base).toFixed(1) : '—'],
                        ['CVSS v3', expandedRow.cvss_v3_base != null ? parseFloat(expandedRow.cvss_v3_base).toFixed(1) : '—'],
                        ['EPSS', expandedRow.epss != null ? parseFloat(expandedRow.epss).toFixed(3) : '—'],
                        ['VPR', expandedRow.vpr != null ? parseFloat(expandedRow.vpr).toFixed(1) : '—'],
                      ].map(([key, value]) => (
                        <div key={key} style={{ display: 'flex', gap: 8 }}>
                          <span style={{ width: 90, fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{key}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    <SectionDivider label="摘要" />
                    {expandedLoading
                      ? <p style={{ fontSize: 12, color: 'var(--text3)' }}>載入中…</p>
                      : <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{expandedVulnDetail?.synopsis || '—'}</p>}
                    <SectionDivider label="修補建議" />
                    <p style={{ fontSize: 13, lineHeight: 1.6 }}>{expandedVulnDetail?.solution || '—'}</p>
                  </div>
                  <div>
                    <SectionDivider label="說明" />
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{expandedVulnDetail?.description || '—'}</p>
                    <SectionDivider label="Plugin Output" />
                    <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'var(--surface2)', padding: '10px 12px', borderRadius: 'var(--rsm)', overflow: 'auto', maxHeight: 150, color: 'var(--accent)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{expandedVulnDetail?.plugin_output || '—'}</pre>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === 'hosthistory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Host selector */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={historyHost} onChange={e => setHistoryHost(e.target.value)}
                style={{ minWidth: 240, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--rsm)', padding: '8px 12px', fontSize: 13 }}>
                <option value="">選擇主機以查看歷程</option>
                {allHosts.map(host => <option key={host} value={host}>{host}</option>)}
              </select>
              {historyHost && !historyLoading && hostHistory && (
                <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  {hostHistory.total_scans} 次掃描紀錄
                </span>
              )}
            </div>

            {historyLoading ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text2)' }}>載入主機歷程…</div>
            ) : historyError ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--critical)' }}>{historyError}</div>
            ) : !historyHost ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>請選擇主機以查看歷程</div>
            ) : !hostHistory ? null : (
              <>
                {/* Summary stat cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: '掃描次數', value: hostHistory.total_scans, color: 'var(--accent)' },
                    { label: '總弱點數', value: hostHistory.history.reduce((s, i) => s + i.vuln_count, 0), color: 'var(--critical)' },
                    { label: '首次出現', value: hostHistory.first_seen ? hostHistory.first_seen.slice(0, 10) : '—', color: 'var(--text2)' },
                    { label: '最近出現', value: hostHistory.last_seen ? hostHistory.last_seen.slice(0, 10) : '—', color: 'var(--text2)' },
                  ].map(item => (
                    <div key={item.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                {/* Risk trend chart */}
                {hostHistory.history.length > 0 && (() => {
                  const reversed = [...hostHistory.history].reverse();
                  const chartData = {
                    labels: reversed.map(item => item.scan_date ? String(item.scan_date).slice(0, 10) : item.uploaded_at.slice(0, 10)),
                    datasets: [
                      { label: 'Critical', data: reversed.map(i => i.critical), backgroundColor: 'oklch(0.60 0.22 25)' },
                      { label: 'High',     data: reversed.map(i => i.high),     backgroundColor: 'oklch(0.68 0.20 45)' },
                      { label: 'Medium',   data: reversed.map(i => i.medium),   backgroundColor: 'oklch(0.76 0.17 72)' },
                      { label: 'Low',      data: reversed.map(i => i.low),      backgroundColor: 'oklch(0.70 0.14 195)' },
                      { label: 'Info',     data: reversed.map(i => i.info),     backgroundColor: 'oklch(0.62 0.06 240)' },
                    ],
                  };
                  const chartOptions = {
                    plugins: { legend: { position: 'top' } },
                    scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
                  };
                  return (
                    <Card title={`風險趨勢 — ${historyHost}`}>
                      <ChartCanvas type="bar" data={chartData} options={chartOptions} height={240} />
                    </Card>
                  );
                })()}

                {/* Detail table */}
                <Card title="掃描明細" noPad>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--surface2)' }}>
                          {['掃描批次', '掃描日期', '總計', 'Critical', 'High', 'Medium', 'Low', 'Info'].map(h => (
                            <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface2)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hostHistory.history.map((item, i) => (
                          <tr key={item.scan_id} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface2)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                            onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'var(--surface2)'}>
                            <td style={{ padding: '10px 14px', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.scan_name}>{item.scan_name}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{item.scan_date ? String(item.scan_date).slice(0, 10) : item.uploaded_at.slice(0, 10)}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{item.vuln_count}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: item.critical > 0 ? 'oklch(0.60 0.22 25)' : 'var(--text3)', fontWeight: item.critical > 0 ? 700 : 400 }}>{item.critical}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: item.high > 0 ? 'oklch(0.68 0.20 45)' : 'var(--text3)', fontWeight: item.high > 0 ? 700 : 400 }}>{item.high}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: item.medium > 0 ? 'oklch(0.76 0.17 72)' : 'var(--text3)', fontWeight: item.medium > 0 ? 700 : 400 }}>{item.medium}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: item.low > 0 ? 'oklch(0.70 0.14 195)' : 'var(--text3)', fontWeight: item.low > 0 ? 700 : 400 }}>{item.low}</td>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: item.info > 0 ? 'oklch(0.62 0.06 240)' : 'var(--text3)', fontWeight: item.info > 0 ? 700 : 400 }}>{item.info}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Timeline */}
                <Card title="掃描時間軸">
                  <Timeline items={hostHistory.history.map(item => ({
                    type: 'scan',
                    text: `${item.scan_name} · ${item.vuln_count} 筆弱點（Critical ${item.critical} / High ${item.high} / Medium ${item.medium}）`,
                    date: item.scan_date ? String(item.scan_date).slice(0, 10) : item.uploaded_at.slice(0, 10),
                  }))} />
                </Card>
              </>
            )}
          </div>
        )}

        {tab === 'matrix' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span>📊 <strong style={{ color: 'var(--text)' }}>EPSS</strong> — 漏洞在 30 天內被利用的機率</span>
              <span>📊 <strong style={{ color: 'var(--text)' }}>VPR</strong> — Tenable 的漏洞優先度評分</span>
              {selectedIPs.length > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>已篩選 IP：{selectedIPs.join(', ')}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <QuadrantChart
                vulns={epssVulns}
                xKey="cvss_v3_base"
                yKey="epss"
                xLabel="CVSS"
                yLabel="EPSS"
                xMid={7}
                yMid={0.1}
                xMax={10}
                yMax={1}
                title={`EPSS vs CVSS 風險矩陣 (${epssVulns.length} 筆)`}
                quadrantLabels={['🔴 優先修補', '🟠 計劃修補', '🟡 監控利用', '🟢 低優先']}
              />
              <QuadrantChart
                vulns={vprVulns}
                xKey="cvss_v3_base"
                yKey="vpr"
                xLabel="CVSS"
                yLabel="VPR"
                xMid={7}
                yMid={7}
                xMax={10}
                yMax={10}
                title={`VPR vs CVSS 風險矩陣 (${vprVulns.length} 筆)`}
                quadrantLabels={['🔴 優先修補', '🟠 計劃修補', '🟡 監控利用', '🟢 低優先']}
              />
            </div>

            <Card title="優先修補清單 — CVSS ≥ 7 且 EPSS ≥ 0.1">
              <DataTable compact maxHeight={280}
                rows={activeVulns.filter(v => parseFloat(v.cvss_v3_base || 0) >= 7 && parseFloat(v.epss || 0) >= 0.1).sort((a, b) => parseFloat(b.epss || 0) - parseFloat(a.epss || 0))}
                columns={[
                  { key: 'risk', label: '等級', sortable: true, render: v => <SeverityBadge level={v || 'Info'} /> },
                  { key: 'epss', label: 'EPSS', sortable: true, mono: true, render: v => <span style={{ color: 'var(--critical)', fontWeight: 700 }}>{parseFloat(v).toFixed(3)}</span> },
                  { key: 'vpr', label: 'VPR', sortable: true, mono: true, render: v => <span style={{ color: parseFloat(v) >= 7 ? 'var(--critical)' : 'var(--warning)', fontWeight: 700 }}>{parseFloat(v).toFixed(1)}</span> },
                  { key: 'cvss_v3_base', label: 'CVSS', sortable: true, mono: true },
                  { key: 'host', label: '主機', sortable: true, mono: true },
                  { key: 'name', label: '弱點名稱', render: v => <span title={v}>{v?.length > 55 ? v.slice(0, 53) + '…' : v}</span> },
                  { key: 'cve', label: 'CVE', mono: true },
                ]} />
            </Card>
          </div>
        )}

        {tab === 'diff' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>基準</span>
                <select value={diffBase || ''} onChange={e => setDiffBase(Number(e.target.value) || null)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--rsm)', padding: '7px 10px', fontSize: 13 }}>
                  <option value="">選擇基準掃描</option>
                  {scans.map(scan => <option key={scan.id} value={scan.id}>{scan.name}{scan.uploaded_at ? ' · ' + scan.uploaded_at.slice(0, 10) : ''}</option>)}
                </select>
              </div>
              <span style={{ fontSize: 18, color: 'var(--text3)' }}>→</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>比對</span>
                <select value={diffComp || ''} onChange={e => setDiffComp(Number(e.target.value) || null)}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 'var(--rsm)', padding: '7px 10px', fontSize: 13 }}>
                  <option value="">選擇比較掃描</option>
                  {scans.map(scan => <option key={scan.id} value={scan.id}>{scan.name}{scan.uploaded_at ? ' · ' + scan.uploaded_at.slice(0, 10) : ''}</option>)}
                </select>
              </div>
              <SearchBar value={searchInput} onChange={setSearchInput} placeholder="搜尋 IP / 弱點名稱 / CVE…" />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                ['all', '全部', diffCounts.all, 'var(--text)'],
                ['new', '新增', diffCounts.new, 'var(--critical)'],
                ['resolved', '已解決', diffCounts.resolved, 'var(--success)'],
                ['persistent', '持續', diffCounts.persistent, 'var(--text2)'],
              ].map(([value, label, cnt, color]) => (
                <div key={value} onClick={() => setDiffFilter(value)}
                  style={{ flex: 1, minWidth: 120, background: 'var(--surface)', border: `1px solid ${diffFilter === value ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r)', padding: '12px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color }}>{cnt || 0}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
            <Card noPad>
              <div style={{ overflow: 'auto', maxHeight: 520 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['狀態', '等級', 'IP', 'Port', 'Plugin ID', '弱點名稱', 'CVSS', 'EPSS', 'VPR', 'CVE'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDiff.length === 0 ? (
                      <tr><td colSpan={10} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', fontStyle: 'italic' }}>無符合條件的記錄</td></tr>
                    ) : filteredDiff.map((row, index) => {
                      const bg = row.status === 'new' ? 'var(--diff-new)' : row.status === 'resolved' ? 'var(--diff-resolved)' : 'transparent';
                      const label = row.status === 'new' ? '🔴 新增' : row.status === 'resolved' ? '🟢 已解決' : '🔵 持續';
                      const epssVal = row.epss != null ? parseFloat(row.epss) : null;
                      const vprVal = row.vpr != null ? parseFloat(row.vpr) : null;
                      const epssHighlight = epssVal != null && epssVal >= 0.1;
                      const vprHighlight = vprVal != null && vprVal >= 7;
                      return (
                        <tr key={`${row.id}-${index}`} style={{ borderBottom: '1px solid var(--border)', background: bg }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{label}</td>
                          <td style={{ padding: '10px 12px' }}><SeverityBadge level={row.risk || 'Info'} /></td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.host || '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.port || '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.plugin_id || '—'}</td>
                          <td style={{ padding: '10px 12px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.name}>{row.name || '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{row.cvss_v3_base != null ? parseFloat(row.cvss_v3_base).toFixed(1) : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: epssHighlight ? 'var(--critical)' : 'var(--text2)', fontWeight: epssHighlight ? 700 : 400 }}>{epssVal != null ? epssVal.toFixed(3) : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: vprHighlight ? 'var(--critical)' : 'var(--text2)', fontWeight: vprHighlight ? 700 : 400 }}>{vprVal != null ? vprVal.toFixed(1) : '—'}</td>
                          <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)' }}>{row.cve || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {tab === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card title="Nessus CSV 上傳">
                <FileUpload accept=".csv" onFile={handleUpload} label={uploading ? '上傳中…' : 'Nessus CSV (.csv)'} hint="支援 CVSS / EPSS / VPR 欄位" />
                <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '12px', fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>支援欄位：</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {['Plugin ID', 'CVE', 'Risk', 'Host', 'Port', 'Protocol', 'Name', 'CVSS v3.0 Base Score', 'EPSS Score', 'VPR Score'].map(col => (
                      <div key={col}><span style={{ color: 'var(--accent)' }}>{col}</span></div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card title="NVD CVE JSON 上傳">
                <FileUpload accept=".json" onFile={handleUpload} label={uploading ? '上傳中…' : 'CVE JSON (.json)'} hint="NVD CVE API 2.0 格式" />
                <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '12px', fontSize: 11, color: 'var(--text3)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>支援 NVD JSON 結構：</div>
                  <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{`{
  "vulnerabilities": [
    {
      "cve": {
        "id": "CVE-2024-XXXX",
        "descriptions": [{"lang":"en","value":"..."}],
        "metrics": {"cvssMetricV31": [{"cvssData": {"baseScore": 9.8}}]}
      }
    }
  ]
}`}</pre>
                </div>
              </Card>
            </div>

            <Card title={`已上傳掃描批次（共 ${scans.length} 筆）`}>
              {scans.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
                  尚未上傳任何掃描批次
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface2)' }}>
                        {['#', '批次名稱', '來源類型', '掃描日期', '上傳時間', '弱點數量', '操作'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text2)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map((scan, idx) => (
                        <tr key={scan.id} style={{ borderBottom: '1px solid var(--border)', background: selectedId === scan.id ? 'oklch(0.3 0.05 195 / 0.15)' : 'transparent' }}>
                          <td style={{ padding: '9px 12px', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{idx + 1}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={scan.name}>
                            <button
                              onClick={() => { setSelectedId(scan.id); setTab('history'); }}
                              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 600, padding: 0, textAlign: 'left' }}
                              title="切換至此批次">
                              {scan.name}
                            </button>
                          </td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: scan.source === 'nessus_csv' ? 'oklch(0.35 0.08 195 / 0.4)' : 'oklch(0.35 0.08 270 / 0.4)', color: scan.source === 'nessus_csv' ? 'var(--accent)' : 'oklch(0.75 0.12 270)', border: `1px solid ${scan.source === 'nessus_csv' ? 'var(--accent)' : 'oklch(0.55 0.12 270)'}` }}>
                              {scan.source === 'nessus_csv' ? 'Nessus CSV' : 'NVD JSON'}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: scan.scan_date ? 'var(--text)' : 'var(--text3)' }}>
                            {scan.scan_date || '—'}
                          </td>
                          <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                            {scan.uploaded_at ? scan.uploaded_at.slice(0, 16).replace('T', ' ') : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', paddingRight: 20 }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: scan.vuln_count > 0 ? 'var(--text)' : 'var(--text3)' }}>
                              {scan.vuln_count.toLocaleString()}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            {currentUser?.role === 'admin' && (
                              <Btn
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeleteScan(scan.id, scan.name)}
                                disabled={deleting === scan.id}>
                                {deleting === scan.id ? '刪除中…' : '刪除'}
                              </Btn>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

window.VulnScanPage = VulnScanPage;
