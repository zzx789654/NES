// NIST Page — audit management with trend chart and delete

const { useState, useEffect, useRef } = React;

function NISTPage({ onStatsChange }) {
  const [audits, setAudits] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [trendData, setTrendData] = useState(null);
  const [tab, setTab] = useState('scans');
  const [baseId, setBaseId] = useState(null);
  const [compId, setCompId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const loadAudits = () => {
    setLoading(true);
    return APIClient.getNISTScans()
      .then(list => {
        setAudits(list);
        setError('');
        setLoading(false);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      })
      .catch(err => {
        setError(err.message || '無法載入 NIST 稽核清單');
        setAudits([]);
        setLoading(false);
      });
  };

  useEffect(() => { loadAudits(); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    APIClient.getNISTScanDetail(selectedId)
      .then(data => setDetail(data))
      .catch(err => setError(err.message || '無法載入稽核明細'));
  }, [selectedId]);

  useEffect(() => {
    if (!baseId || !compId || baseId === compId) { setDiffData(null); return; }
    APIClient.getNISTDiff(baseId, compId)
      .then(setDiffData)
      .catch(err => setError(err.message || '無法載入 Diff 比較'));
  }, [baseId, compId]);

  useEffect(() => {
    if (tab !== 'trend') return;
    APIClient.getNISTTrend()
      .then(setTrendData)
      .catch(err => setError(err.message || '無法載入趨勢資料'));
  }, [tab]);

  const handleUpload = (fileName, content) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const file = new File([blob], fileName, { type: 'text/csv' });
    APIClient.uploadAudit(file, fileName)
      .then(() => {
        loadAudits();
        if (onStatsChange) onStatsChange();
        alert('✅ 稽核上傳完成');
      })
      .catch(err => alert(err.message || '上傳失敗'));
  };

  const handleDelete = (audit) => {
    if (!window.confirm(`確定要刪除稽核「${audit.name}」？此操作無法復原。`)) return;
    setDeleting(audit.id);
    APIClient.deleteNISTScan(audit.id)
      .then(() => {
        if (selectedId === audit.id) setSelectedId(null);
        if (baseId === audit.id) setBaseId(null);
        if (compId === audit.id) setCompId(null);
        loadAudits();
        if (onStatsChange) onStatsChange();
      })
      .catch(err => alert('刪除失敗：' + err.message))
      .finally(() => setDeleting(null));
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--text2)' }}>載入中…</div>;

  return (
    <div>
      <PageHeader
        title="NIST"
        subtitle="上傳與檢視 NIST 稽核結果"
        actions={<FileUpload onFile={handleUpload} label="NIST Audit CSV" hint="上傳後端解析並儲存" />}
      />

      {error && <div style={{ marginBottom: 18, color: 'var(--critical)' }}>{error}</div>}

      <Tabs
        active={tab}
        onChange={t => { setTab(t); setError(''); }}
        tabs={[
          { id: 'scans', label: '稽核清單', icon: '📋', count: audits?.length ?? 0 },
          { id: 'diff',  label: 'Diff 比較', icon: '⇄',  count: diffData ? (diffData.new_failures.length + diffData.resolved_failures.length + diffData.persistent_failures.length) : 0 },
          { id: 'trend', label: '通過率趨勢', icon: '📈', count: null },
        ]}
      />

      {/* ── 稽核清單 Tab ── */}
      {tab === 'scans' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16, marginTop: 16 }}>
          <Card title="稽核列表">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {audits.length === 0 ? (
                <div style={{ color: 'var(--text3)' }}>尚無稽核掃描資料</div>
              ) : audits.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setSelectedId(a.id)}
                    style={{ flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--rsm)', background: selectedId === a.id ? 'var(--accent-bg)' : 'var(--surface2)', color: selectedId === a.id ? 'var(--accent)' : 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      {a.uploaded_at.slice(0, 10)} · 通過 {a.passed}/{a.total}
                      {a.total > 0 && (
                        <span style={{ marginLeft: 8, color: a.passed / a.total >= 0.8 ? 'var(--success)' : 'var(--warning)' }}>
                          {Math.round(a.passed / a.total * 100)}%
                        </span>
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    disabled={deleting === a.id}
                    title="刪除此稽核"
                    style={{ padding: '8px 10px', borderRadius: 'var(--rsm)', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', cursor: deleting === a.id ? 'not-allowed' : 'pointer', fontSize: 14, lineHeight: 1, flexShrink: 0, transition: 'color 0.15s, border-color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--critical)'; e.currentTarget.style.borderColor = 'var(--critical)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text3)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                    {deleting === a.id ? '…' : '✕'}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card title="稽核明細">
            {!detail ? (
              <div style={{ color: 'var(--text3)' }}>請選擇一筆稽核結果以檢視明細</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rsm)', padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>名稱</div>
                    <div style={{ marginTop: 6, fontWeight: 600 }}>{detail.name}</div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rsm)', padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>通過率</div>
                    <div style={{ marginTop: 6, fontWeight: 600 }}>
                      {detail.passed}/{detail.total}
                      {detail.total > 0 && <span style={{ marginLeft: 8, color: 'var(--text3)', fontSize: 12 }}>({Math.round(detail.passed / detail.total * 100)}%)</span>}
                    </div>
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: 'check_name', label: '檢核項目', sortable: true },
                    { key: 'status', label: '狀態', render: v => <StatusBadge status={v || '—'} /> },
                    { key: 'policy_val', label: '預期值' },
                    { key: 'actual_val', label: '實際值' },
                  ]}
                  rows={detail.results}
                  emptyText="無檢核結果"
                />
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Diff Tab ── */}
      {tab === 'diff' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <Card title="Diff 設定">
            <div style={{ display: 'grid', gap: 12 }}>
              <FormField label="基準稽核">
                <FormSelect value={baseId || ''} onChange={e => setBaseId(Number(e.target.value) || null)}>
                  <option value="">選擇基準稽核</option>
                  {audits.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="比較稽核">
                <FormSelect value={compId || ''} onChange={e => setCompId(Number(e.target.value) || null)}>
                  <option value="">選擇比較稽核</option>
                  {audits.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </FormSelect>
              </FormField>
            </div>
          </Card>

          <Card title="Diff 結果">
            {!diffData ? (
              <div style={{ color: 'var(--text3)' }}>請選擇兩筆不同的稽核進行比較</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <StatCard label="新增失敗" value={diffData.new_failures.length} color="var(--critical)" />
                  <StatCard label="解決失敗" value={diffData.resolved_failures.length} color="var(--success)" />
                  <StatCard label="持續失敗" value={diffData.persistent_failures.length} color="var(--warning)" />
                </div>
                <DataTable
                  columns={[
                    { key: 'check_name', label: '檢核項目', sortable: true },
                    { key: 'status', label: '狀態', render: v => <StatusBadge status={v || '—'} /> },
                    { key: 'description', label: '描述' },
                  ]}
                  rows={[...diffData.new_failures, ...diffData.resolved_failures, ...diffData.persistent_failures]}
                  emptyText="無比較結果"
                />
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Trend Tab ── */}
      {tab === 'trend' && (
        <div style={{ marginTop: 16 }}>
          {!trendData ? (
            <div style={{ padding: 40, color: 'var(--text2)', textAlign: 'center' }}>載入趨勢資料中…</div>
          ) : trendData.length === 0 ? (
            <Card>
              <div style={{ color: 'var(--text3)', padding: 20, textAlign: 'center' }}>尚無稽核資料可產生趨勢圖</div>
            </Card>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                {(() => {
                  const latest = trendData[trendData.length - 1];
                  const prev = trendData.length > 1 ? trendData[trendData.length - 2] : null;
                  const diff = prev ? (latest.pass_rate - prev.pass_rate).toFixed(1) : null;
                  return (
                    <>
                      <StatCard label="最新通過率" value={latest.pass_rate.toFixed(1) + '%'} color="var(--success)" />
                      <StatCard label="最新通過/總計" value={`${latest.passed} / ${latest.total}`} color="var(--accent)" />
                      <StatCard label="較上次變化" value={diff !== null ? (diff >= 0 ? '+' : '') + diff + '%' : '—'} color={diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--critical)' : 'var(--text2)'} />
                    </>
                  );
                })()}
              </div>

              <Card title="通過率趨勢">
                <NistTrendChart data={trendData} />
              </Card>

              <Card title="各次稽核明細" style={{ marginTop: 16 }}>
                <DataTable
                  columns={[
                    { key: 'name', label: '稽核名稱', sortable: true },
                    { key: 'scan_date', label: '稽核日期', render: v => v || '—' },
                    { key: 'passed', label: '通過', sortable: true },
                    { key: 'failed', label: '失敗', sortable: true },
                    { key: 'total', label: '總計', sortable: true },
                    { key: 'pass_rate', label: '通過率', sortable: true, render: v => (
                      <span style={{ color: v >= 80 ? 'var(--success)' : v >= 60 ? 'var(--warning)' : 'var(--critical)', fontWeight: 700 }}>
                        {v.toFixed(1)}%
                      </span>
                    )},
                  ]}
                  rows={trendData}
                  emptyText="無資料"
                />
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── 趨勢折線圖 ────────────────────────────────────────────────────────────────

function NistTrendChart({ data }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const labels = data.map((d, i) => d.name || d.scan_date || `稽核 ${i + 1}`);
    const passRates = data.map(d => parseFloat(d.pass_rate.toFixed(1)));

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: '通過率 (%)',
            data: passRates,
            borderColor: 'oklch(0.65 0.155 195)',
            backgroundColor: 'oklch(0.65 0.155 195 / 0.12)',
            borderWidth: 2,
            pointBackgroundColor: 'oklch(0.65 0.155 195)',
            pointRadius: 5,
            tension: 0.3,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: 'oklch(0.93 0.005 240)', font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: ctx => `通過率: ${ctx.raw}%`,
              afterLabel: (ctx) => {
                const d = data[ctx.dataIndex];
                return `通過: ${d.passed} / ${d.total}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: 'oklch(0.62 0.012 240)', maxRotation: 30 },
            grid: { color: 'oklch(0.27 0.012 240)' },
          },
          y: {
            min: 0, max: 100,
            ticks: { color: 'oklch(0.62 0.012 240)', callback: v => v + '%' },
            grid: { color: 'oklch(0.27 0.012 240)' },
          },
        },
      },
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data]);

  return <div style={{ height: 280 }}><canvas ref={canvasRef} /></div>;
}

window.NISTPage = NISTPage;
