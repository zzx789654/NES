// NIST Page — actual API-based audit management

const { useState, useEffect } = React;

function NISTPage({ onStatsChange }) {
  const [audits, setAudits] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [tab, setTab] = useState('scans');
  const [baseId, setBaseId] = useState(null);
  const [compId, setCompId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadAudits();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    APIClient.getNISTScanDetail(selectedId)
      .then(data => setDetail(data))
      .catch(err => setError(err.message || '無法載入稽核明細'));
  }, [selectedId]);

  useEffect(() => {
    if (!baseId || !compId || baseId === compId) {
      setDiffData(null);
      return;
    }
    APIClient.getNISTDiff(baseId, compId)
      .then(setDiffData)
      .catch(err => setError(err.message || '無法載入 Diff 比較'));
  }, [baseId, compId]);

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

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)' }}>載入中…</div>;
  }

  return (
    <div>
      <PageHeader
        title="NIST"
        subtitle="使用真實後端 API 上傳與檢視 NIST 稽核結果"
        actions={<FileUpload onFile={handleUpload} label="NIST Audit CSV" hint="上傳後端解析並儲存" />}
      />

      {error && <div style={{ marginBottom: 18, color: 'var(--critical)' }}>{error}</div>}

      <Tabs
        active={tab}
        onChange={t => { setTab(t); setError(''); }}
        tabs={[
          { id: 'scans', label: '稽核清單', icon: '📋', count: audits?.length ?? 0 },
          { id: 'diff', label: 'Diff 比較', icon: '⇄', count: diffData ? (diffData.new_failures.length + diffData.resolved_failures.length + diffData.persistent_failures.length) : 0 },
        ]}
      />

      {tab === 'scans' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16, marginTop: 16 }}>
          <Card title="稽核列表">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {audits.length === 0 ? (
                <div style={{ color: 'var(--text3)' }}>尚無稽核掃描資料</div>
              ) : audits.map(a => (
                <button key={a.id} onClick={() => setSelectedId(a.id)}
                  style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--rsm)', background: selectedId === a.id ? 'var(--accent-bg)' : 'var(--surface2)', color: selectedId === a.id ? 'var(--accent)' : 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{a.uploaded_at.slice(0, 10)} · Passed {a.passed} / {a.total}</div>
                </button>
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
                    <div style={{ marginTop: 6, fontWeight: 600 }}>{detail.passed}/{detail.total}</div>
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
    </div>
  );
}

window.NISTPage = NISTPage;
