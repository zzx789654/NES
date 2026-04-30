// Vulnerability Scan Page — API-driven scan list and diff

const { useState, useEffect, useMemo } = React;

function VulnScanPage({ onStatsChange }) {
  const [scans, setScans] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [diffBase, setDiffBase] = useState(null);
  const [diffComp, setDiffComp] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [tab, setTab] = useState('list');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadScans = () => {
    setLoading(true);
    return APIClient.getAllScans()
      .then(list => {
        setScans(list);
        setError('');
        setLoading(false);
        if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      })
      .catch(err => {
        setError(err.message || '無法載入掃描清單');
        setScans([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadScans();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    APIClient.getScanDetail(selectedId)
      .then(data => setDetail(data))
      .catch(err => setError(err.message || '無法載入掃描明細'));
  }, [selectedId]);

  useEffect(() => {
    if (!diffBase || !diffComp || diffBase === diffComp) {
      setDiffData(null);
      return;
    }
    APIClient.getScanDiff(diffBase, diffComp)
      .then(setDiffData)
      .catch(err => setError(err.message || '無法載入掃描差異'));
  }, [diffBase, diffComp]);

  const handleUpload = (fileName, content) => {
    const blob = new Blob([content]);
    const file = new File([blob], fileName, { type: 'application/octet-stream' });
    APIClient.uploadScan(file, fileName)
      .then(scan => {
        loadScans();
        setSelectedId(scan.id);
        if (onStatsChange) onStatsChange();
        alert('✅ 掃描上傳完成');
      })
      .catch(err => alert(err.message || '上傳失敗'));
  };

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--text2)' }}>載入中…</div>;
  }

  const selectedScan = scans?.find(s => s.id === selectedId);
  const vulnRows = detail?.vulnerabilities || [];

  return (
    <div>
      <PageHeader
        title="Vulnerability Scan"
        subtitle="使用真實 API 檢視掃描紀錄、弱點明細與差異比較"
        actions={<FileUpload onFile={handleUpload} label="上傳掃描結果" hint="支援 Nessus .csv 或 .json" />}
      />

      {error && <div style={{ marginBottom: 18, color: 'var(--critical)' }}>{error}</div>}

      <Tabs
        active={tab}
        onChange={t => { setTab(t); setError(''); }}
        tabs={[
          { id: 'list', label: '掃描清單', icon: '📋', count: scans?.length ?? 0 },
          { id: 'diff', label: 'Diff 比較', icon: '⇄', count: diffData ? (diffData.new.length + diffData.resolved.length + diffData.persistent.length) : 0 },
        ]}
      />

      {tab === 'list' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: 16, marginTop: 16 }}>
          <Card title="掃描列表">
            {scans.length === 0 ? (
              <div style={{ color: 'var(--text3)' }}>尚無掃描資料</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {scans.map(scan => (
                  <button key={scan.id} onClick={() => setSelectedId(scan.id)}
                    style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--rsm)', background: selectedId === scan.id ? 'var(--accent-bg)' : 'var(--surface2)', color: selectedId === scan.id ? 'var(--accent)' : 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    <div style={{ fontWeight: 600 }}>{scan.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{scan.uploaded_at.slice(0, 10)} · {scan.vuln_count} 筆弱點</div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="掃描明細">
            {!detail ? (
              <div style={{ color: 'var(--text3)' }}>請選擇一筆掃描以檢視弱點明細</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rsm)', padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>掃描名稱</div>
                    <div style={{ marginTop: 6, fontWeight: 600 }}>{detail.name}</div>
                  </div>
                  <div style={{ background: 'var(--surface2)', borderRadius: 'var(--rsm)', padding: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>弱點數</div>
                    <div style={{ marginTop: 6, fontWeight: 600 }}>{detail.vuln_count}</div>
                  </div>
                </div>
                <DataTable
                  columns={[
                    { key: 'risk', label: '嚴重等級', render: v => <SeverityBadge level={v || 'Info'} /> },
                    { key: 'host', label: '主機' },
                    { key: 'plugin_id', label: 'Plugin ID', mono: true },
                    { key: 'cve', label: 'CVE', mono: true },
                    { key: 'cvss_v3_base', label: 'CVSS' },
                    { key: 'epss', label: 'EPSS' },
                    { key: 'vpr', label: 'VPR' },
                    { key: 'name', label: '弱點名稱' },
                  ]}
                  rows={vulnRows}
                  emptyText="無弱點資料"
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
              <FormField label="基準掃描">
                <FormSelect value={diffBase || ''} onChange={e => setDiffBase(Number(e.target.value) || null)}>
                  <option value="">選擇基準掃描</option>
                  {scans.map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}
                </FormSelect>
              </FormField>
              <FormField label="比較掃描">
                <FormSelect value={diffComp || ''} onChange={e => setDiffComp(Number(e.target.value) || null)}>
                  <option value="">選擇比較掃描</option>
                  {scans.map(scan => <option key={scan.id} value={scan.id}>{scan.name}</option>)}
                </FormSelect>
              </FormField>
            </div>
          </Card>

          <Card title="Diff 結果">
            {!diffData ? (
              <div style={{ color: 'var(--text3)' }}>請選擇兩筆不同掃描進行比較</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <StatCard label="新增弱點" value={diffData.new.length} color="var(--critical)" />
                  <StatCard label="已解決" value={diffData.resolved.length} color="var(--success)" />
                  <StatCard label="持續弱點" value={diffData.persistent.length} color="var(--warning)" />
                </div>
                <DataTable
                  columns={[
                    { key: 'risk', label: '等級', render: v => <SeverityBadge level={v || 'Info'} /> },
                    { key: 'host', label: '主機' },
                    { key: 'cve', label: 'CVE', mono: true },
                    { key: 'name', label: '弱點名稱' },
                    { key: 'status', label: '狀態' },
                  ]}
                  rows={[...diffData.new, ...diffData.resolved, ...diffData.persistent].map(item => ({ ...item, status: item.status }))}
                  emptyText="無差異資料"
                />
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

window.VulnScanPage = VulnScanPage;
