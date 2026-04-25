// ISO 27001 Page

const { useState, useEffect, useMemo } = React;

const FORM_TYPES = [
  { id:'ncr',      label:'NCR',      sub:'不符合事項處理單', icon:'⚠' },
  { id:'capa',     label:'CAPA',     sub:'矯正預防措施單',   icon:'🔧' },
  { id:'assets',   label:'資產清單', sub:'Asset Inventory',  icon:'📦' },
  { id:'risk',     label:'風險評估', sub:'Risk Assessment',   icon:'⚖' },
  { id:'audit',    label:'稽核紀錄', sub:'Audit Record',      icon:'📝' },
  { id:'supplier', label:'供應商',   sub:'Supplier Evaluation',icon:'🤝' },
];

// ─── Column / field definitions per type ─────────────────────────────────────
const TYPE_CONFIG = {
  ncr: {
    columns: [
      { key:'no', label:'單號', mono:true, sortable:true },
      { key:'title', label:'不符合事項', sortable:true, wrap:true },
      { key:'clause', label:'條文', mono:true, sortable:true },
      { key:'severity', label:'嚴重性', sortable:true, render:(v)=><StatusBadge status={v==='Major'?'Critical':v==='Minor'?'Medium':'Info'} /> },
      { key:'status', label:'狀態', sortable:true, render:(v)=><StatusBadge status={v} /> },
      { key:'owner', label:'負責單位', sortable:true },
      { key:'updated', label:'更新日期', mono:true, sortable:true },
    ],
    fields: [
      { key:'no', label:'NCR 單號', required:true },
      { key:'title', label:'不符合事項標題', required:true },
      { key:'clause', label:'ISO 條文', required:true, hint:'例：A.8.7, A.5.16' },
      { key:'severity', label:'嚴重性', type:'select', options:['Major','Minor','觀察事項'], required:true },
      { key:'status', label:'狀態', type:'select', options:['待處理','處理中','待審核','已關閉'], required:true },
      { key:'owner', label:'負責單位', required:true },
      { key:'description', label:'不符合事項說明', type:'textarea', required:true },
      { key:'rootCause', label:'根本原因', type:'textarea' },
    ]
  },
  capa: {
    columns: [
      { key:'no', label:'單號', mono:true, sortable:true },
      { key:'title', label:'措施名稱', sortable:true, wrap:true },
      { key:'type', label:'類型', sortable:true, render:(v)=><StatusBadge status={v==='矯正'?'處理中':'風險接受'} /> },
      { key:'relatedNCR', label:'相關 NCR', mono:true, sortable:true },
      { key:'status', label:'狀態', sortable:true, render:(v)=><StatusBadge status={v} /> },
      { key:'owner', label:'負責單位', sortable:true },
      { key:'dueDate', label:'截止日期', mono:true, sortable:true },
    ],
    fields: [
      { key:'no', label:'CAPA 單號', required:true },
      { key:'title', label:'措施名稱', required:true },
      { key:'type', label:'類型', type:'select', options:['矯正','預防'], required:true },
      { key:'relatedNCR', label:'相關 NCR 單號', hint:'如 NCR-2024-001，無則填 -' },
      { key:'status', label:'狀態', type:'select', options:['進行中','待處理','已完成'], required:true },
      { key:'owner', label:'負責單位', required:true },
      { key:'dueDate', label:'截止日期', type:'date', required:true },
      { key:'description', label:'措施說明', type:'textarea', required:true },
      { key:'effectiveness', label:'有效性驗證結果', type:'textarea' },
    ]
  },
  assets: {
    columns: [
      { key:'assetId', label:'資產編號', mono:true, sortable:true },
      { key:'name', label:'資產名稱', sortable:true, wrap:true },
      { key:'type', label:'類型', sortable:true },
      { key:'classification', label:'機密等級', sortable:true, render:(v)=><StatusBadge status={v==='極機密'?'新增':v==='機密'?'處理中':v==='內部使用'?'風險接受':'已完成'} /> },
      { key:'owner', label:'資產擁有者', sortable:true },
      { key:'status', label:'狀態', sortable:true, render:(v)=><StatusBadge status={v} /> },
      { key:'value', label:'資產價值', sortable:true },
    ],
    fields: [
      { key:'assetId', label:'資產編號', required:true },
      { key:'name', label:'資產名稱', required:true },
      { key:'type', label:'資產類型', type:'select', options:['硬體','軟體','資訊','網路設備','服務','人員','實體'], required:true },
      { key:'owner', label:'資產擁有者（部門）', required:true },
      { key:'location', label:'存放位置', required:true },
      { key:'classification', label:'機密等級', type:'select', options:['公開','內部使用','機密','極機密'], required:true },
      { key:'status', label:'狀態', type:'select', options:['使用中','停用','廢棄'], required:true },
      { key:'value', label:'資產價值', type:'select', options:['極高','高','中','低'] },
    ]
  },
  risk: {
    columns: [
      { key:'riskId', label:'風險編號', mono:true, sortable:true },
      { key:'title', label:'風險名稱', sortable:true, wrap:true },
      { key:'category', label:'類別', sortable:true },
      { key:'riskLevel', label:'風險等級', sortable:true, render:(v)=><StatusBadge status={v==='極高'?'新增':v==='高'?'處理中':v==='中'?'風險接受':'已完成'} /> },
      { key:'treatment', label:'處理方式', sortable:true },
      { key:'owner', label:'風險擁有者', sortable:true },
      { key:'status', label:'狀態', sortable:true, render:(v)=><StatusBadge status={v} /> },
    ],
    fields: [
      { key:'riskId', label:'風險編號', required:true },
      { key:'title', label:'風險名稱', required:true },
      { key:'category', label:'風險類別', type:'select', options:['技術','人員','第三方','法規','實體','其他'], required:true },
      { key:'likelihood', label:'發生可能性', type:'select', options:['極高','高','中','低','極低'], required:true },
      { key:'impact', label:'影響程度', type:'select', options:['極高','高','中','低','極低'], required:true },
      { key:'riskLevel', label:'風險等級', type:'select', options:['極高','高','中','低'], required:true },
      { key:'controls', label:'現有控制措施', type:'textarea' },
      { key:'treatment', label:'風險處理方式', type:'select', options:['降低','接受','轉移','避免'] },
      { key:'residualRisk', label:'殘餘風險', type:'select', options:['極高','高','中','低'] },
      { key:'owner', label:'風險擁有者', required:true },
      { key:'status', label:'狀態', type:'select', options:['待評估','監控中','已處理'] },
    ]
  },
  audit: {
    columns: [
      { key:'auditId', label:'稽核編號', mono:true, sortable:true },
      { key:'title', label:'稽核名稱', sortable:true, wrap:true },
      { key:'type', label:'類型', sortable:true },
      { key:'auditor', label:'稽核員', sortable:true },
      { key:'auditDate', label:'稽核日期', mono:true, sortable:true },
      { key:'status', label:'狀態', sortable:true, render:(v)=><StatusBadge status={v} /> },
      { key:'findings', label:'發現事項', wrap:true },
    ],
    fields: [
      { key:'auditId', label:'稽核編號', required:true },
      { key:'title', label:'稽核名稱', required:true },
      { key:'type', label:'稽核類型', type:'select', options:['內部稽核','外部稽核','供應商稽核'], required:true },
      { key:'scope', label:'稽核範圍', type:'textarea', required:true },
      { key:'auditor', label:'稽核員', required:true },
      { key:'auditDate', label:'稽核日期', type:'date', required:true },
      { key:'status', label:'狀態', type:'select', options:['規劃中','進行中','已完成','已關閉'] },
      { key:'findings', label:'發現事項摘要', type:'textarea' },
      { key:'ncrs', label:'相關 NCR 單號', hint:'多筆以逗號分隔' },
      { key:'summary', label:'稽核摘要', type:'textarea' },
    ]
  },
  supplier: {
    columns: [
      { key:'supplierId', label:'供應商編號', mono:true, sortable:true },
      { key:'name', label:'供應商名稱', sortable:true },
      { key:'service', label:'服務項目', sortable:true, wrap:true },
      { key:'riskLevel', label:'風險等級', sortable:true, render:(v)=><StatusBadge status={v==='高'?'處理中':v==='中'?'風險接受':'已完成'} /> },
      { key:'status', label:'狀態', sortable:true, render:(v)=><StatusBadge status={v} /> },
      { key:'certifications', label:'認證', sortable:true },
      { key:'nextAudit', label:'下次稽核', mono:true, sortable:true },
    ],
    fields: [
      { key:'supplierId', label:'供應商編號', required:true },
      { key:'name', label:'供應商名稱', required:true },
      { key:'service', label:'提供服務', required:true },
      { key:'riskLevel', label:'風險等級', type:'select', options:['高','中','低'], required:true },
      { key:'status', label:'狀態', type:'select', options:['評估中','已核准','暫停','終止'] },
      { key:'certifications', label:'持有認證', hint:'如 ISO 27001, SOC2 Type II' },
      { key:'contact', label:'聯絡人' },
      { key:'lastAudit', label:'最近稽核日期', type:'date' },
      { key:'nextAudit', label:'下次稽核日期', type:'date' },
      { key:'notes', label:'備註', type:'textarea' },
    ]
  }
};

function ISO27001Page() {
  const [activeType, setActiveType] = useState('ncr');
  const [records, setRecords] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailRecord, setDetailRecord] = useState(null);

  const loadRecords = () => setRecords(MockAPI.getISORecords(activeType));
  useEffect(() => { loadRecords(); setSearch(''); setStatusFilter('all'); setDetailRecord(null); }, [activeType]);

  const cfg = TYPE_CONFIG[activeType];

  const filtered = useMemo(() => {
    return records
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  }, [records, statusFilter, search]);

  const statuses = useMemo(() => {
    const s = new Set(records.map(r=>r.status).filter(Boolean));
    return ['all', ...s];
  }, [records]);

  const openAdd = () => {
    setEditRecord(null);
    setForm({});
    setModalOpen(true);
  };
  const openEdit = r => {
    setEditRecord(r);
    setForm({ ...r });
    setModalOpen(true);
    setDetailRecord(null);
  };
  const handleSave = () => {
    if (editRecord) MockAPI.updateISORecord(activeType, editRecord.id, form);
    else MockAPI.addISORecord(activeType, form);
    loadRecords();
    setModalOpen(false);
  };
  const handleDelete = id => {
    if (confirm('確定要刪除此記錄嗎？')) {
      MockAPI.deleteISORecord(activeType, id);
      loadRecords();
      setDetailRecord(null);
    }
  };

  const cols = cfg.columns.map(c => ({
    ...c,
    render: c.render || undefined,
  }));

  return (
    <div>
      <PageHeader title="ISO 27001" subtitle="ISO 27001:2022 合規管理 — 表單管理、處理歷程追蹤"
        actions={<Btn onClick={openAdd}>＋ 新增記錄</Btn>} />

      {/* Type tabs */}
      <div style={{display:'flex',gap:8,marginBottom:20,flexWrap:'wrap'}}>
        {FORM_TYPES.map(t => {
          const recs = MockAPI.getISORecords(t.id);
          const pending = recs.filter(r => r.status && !['已關閉','已完成','已核准'].includes(r.status)).length;
          return (
            <button key={t.id} onClick={() => setActiveType(t.id)}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',borderRadius:'var(--r)',border:`1px solid ${activeType===t.id?'var(--accent)':'var(--border)'}`,background:activeType===t.id?'var(--accent-bg)':'var(--surface)',color:activeType===t.id?'var(--accent)':'var(--text)',cursor:'pointer',transition:'all 0.15s',position:'relative'}}
              onMouseEnter={e=>{ if(activeType!==t.id) e.currentTarget.style.borderColor='var(--accent)'; }}
              onMouseLeave={e=>{ if(activeType!==t.id) e.currentTarget.style.borderColor='var(--border)'; }}>
              <span style={{fontSize:16}}>{t.icon}</span>
              <div style={{textAlign:'left'}}>
                <div style={{fontWeight:600,fontSize:13}}>{t.label}</div>
                <div style={{fontSize:10,opacity:0.7}}>{t.sub}</div>
              </div>
              {pending > 0 && <span style={{position:'absolute',top:-6,right:-6,background:'var(--warning)',color:'oklch(0.1 0 0)',borderRadius:99,width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700}}>{pending}</span>}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{display:'flex',gap:10,marginBottom:14,alignItems:'center',flexWrap:'wrap'}}>
        <SearchBar value={search} onChange={setSearch} placeholder={`搜尋 ${FORM_TYPES.find(t=>t.id===activeType)?.label}…`} />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--text)',borderRadius:'var(--rsm)',padding:'6px 10px',fontSize:13}}>
          {statuses.map(s=><option key={s} value={s}>{s==='all'?'全部狀態':s}</option>)}
        </select>
        <span style={{marginLeft:'auto',fontSize:12,color:'var(--text2)',fontFamily:'var(--font-mono)'}}>{filtered.length} / {records.length} 筆</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:detailRecord?'1fr 340px':'1fr',gap:16,alignItems:'start'}}>
        {/* Table */}
        <Card noPad>
          <DataTable columns={cols} rows={filtered} maxHeight={520}
            onRowClick={r => setDetailRecord(detailRecord?.id===r.id ? null : r)} />
        </Card>

        {/* Detail Panel */}
        {detailRecord && (
          <Card title="詳細資料"
            action={<div style={{display:'flex',gap:6}}>
              <Btn size="sm" variant="secondary" onClick={() => openEdit(detailRecord)}>✎ 編輯</Btn>
              <Btn size="sm" variant="danger" onClick={() => handleDelete(detailRecord.id)}>刪除</Btn>
            </div>}>
            <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
              {cfg.fields.slice(0,8).map(f => {
                const val = detailRecord[f.key];
                if (!val) return null;
                return (
                  <div key={f.key}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text3)',marginBottom:2}}>{f.label}</div>
                    <div style={{fontSize:13,color:'var(--text)',fontFamily:['no','auditId','assetId','riskId','supplierId','clause'].includes(f.key)?'var(--font-mono)':'inherit',lineHeight:1.5}}>{val}</div>
                  </div>
                );
              })}
            </div>
            {detailRecord.history && detailRecord.history.length > 0 && (
              <>
                <SectionDivider label="處理歷程" />
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {detailRecord.history.map((h,i)=>(
                    <div key={i} style={{display:'flex',gap:8,padding:'6px 8px',background:'var(--surface2)',borderRadius:'var(--rsm)',fontSize:12}}>
                      <span style={{fontFamily:'var(--font-mono)',color:'var(--text3)',flexShrink:0}}>{h.date}</span>
                      <span style={{flex:1,color:'var(--text)'}}>{h.action}</span>
                      {h.by && <span style={{color:'var(--text3)',flexShrink:0}}>{h.by}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} title={editRecord ? `編輯 — ${editRecord[cfg.fields[0].key]||'記錄'}` : `新增 ${FORM_TYPES.find(t=>t.id===activeType)?.label}`}
        onClose={() => setModalOpen(false)} width={640}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 16px'}}>
          {cfg.fields.map(f => (
            <div key={f.key} style={{gridColumn: f.type==='textarea' ? '1 / -1' : 'auto'}}>
              <FormField label={f.label} required={f.required} hint={f.hint}>
                {f.type === 'select' ? (
                  <FormSelect value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}>
                    <option value="">— 請選擇 —</option>
                    {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                  </FormSelect>
                ) : f.type === 'textarea' ? (
                  <FormTextarea value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} rows={3} />
                ) : (
                  <FormInput type={f.type||'text'} value={form[f.key]||''} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} />
                )}
              </FormField>
            </div>
          ))}
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:8,paddingTop:14,borderTop:'1px solid var(--border)'}}>
          <Btn variant="secondary" onClick={() => setModalOpen(false)}>取消</Btn>
          <Btn onClick={handleSave}>💾 儲存</Btn>
        </div>
      </Modal>
    </div>
  );
}

window.ISO27001Page = ISO27001Page;
