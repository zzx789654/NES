// Shared UI components — exported to window

const { useState, useEffect, useRef, useCallback } = React;

// ─── ChartCanvas ──────────────────────────────────────────────────────────────
function ChartCanvas({ type, data, options = {}, height = 220 }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) inst.current.destroy();
    const defaults = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text2').trim(), font: { family: 'IBM Plex Sans', size: 12 } } } },
      scales: type !== 'doughnut' && type !== 'pie' ? {
        x: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text3').trim(), font:{size:11} }, grid: { color: 'oklch(0.3 0 0 / 0.2)' } },
        y: { ticks: { color: getComputedStyle(document.documentElement).getPropertyValue('--text3').trim(), font:{size:11} }, grid: { color: 'oklch(0.3 0 0 / 0.2)' } },
      } : undefined,
    };
    inst.current = new Chart(ref.current, { type, data, options: deepMerge(defaults, options) });
    return () => { if (inst.current) inst.current.destroy(); };
  }, [type, JSON.stringify(data)]);
  return <div style={{position:'relative',height}}><canvas ref={ref}></canvas></div>;
}

function deepMerge(a, b) {
  if (!b) return a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object')
      out[k] = deepMerge(a[k], b[k]);
    else out[k] = b[k];
  }
  return out;
}

// ─── SeverityBadge ────────────────────────────────────────────────────────────
function SeverityBadge({ level }) {
  const map = {
    Critical: { bg:'var(--critical-bg)', color:'var(--critical)', label:'Critical 嚴重' },
    High:     { bg:'var(--high-bg)',     color:'var(--high)',     label:'High 高' },
    Medium:   { bg:'var(--medium-bg)',   color:'var(--medium)',   label:'Medium 中' },
    Low:      { bg:'var(--low-bg)',      color:'var(--low)',      label:'Low 低' },
    Info:     { bg:'var(--info-bg)',     color:'var(--info)',     label:'Info 資訊' },
  };
  const s = map[level] || map.Info;
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:99,background:s.bg,color:s.color,fontSize:11,fontWeight:600,fontFamily:'var(--font-mono)',whiteSpace:'nowrap'}}>
      {s.label}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    '已關閉':{ bg:'var(--success-bg)', color:'var(--success)' },
    '已完成':{ bg:'var(--success-bg)', color:'var(--success)' },
    '已核准':{ bg:'var(--success-bg)', color:'var(--success)' },
    '已緩解':{ bg:'var(--success-bg)', color:'var(--success)' },
    '處理中':{ bg:'var(--accent-bg)',  color:'var(--accent)' },
    '進行中':{ bg:'var(--accent-bg)',  color:'var(--accent)' },
    '監控中':{ bg:'var(--accent-bg)',  color:'var(--accent)' },
    '待處理':{ bg:'var(--warning-bg)', color:'var(--warning)' },
    '待審核':{ bg:'var(--warning-bg)', color:'var(--warning)' },
    '風險接受':{ bg:'var(--info-bg)',  color:'var(--info)' },
    '新增':  { bg:'var(--critical-bg)',color:'var(--critical)' },
  };
  const s = map[status] || { bg:'var(--surface2)', color:'var(--text2)' };
  return <span style={{display:'inline-block',padding:'2px 8px',borderRadius:99,background:s.bg,color:s.color,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{status}</span>;
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max = 100, color, height = 8, showLabel = true }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const c = color || (pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--accent)' : pct >= 30 ? 'var(--warning)' : 'var(--critical)');
  return (
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{flex:1,height,background:'var(--surface2)',borderRadius:height,overflow:'hidden'}}>
        <div style={{width:pct+'%',height:'100%',background:c,borderRadius:height,transition:'width 0.4s ease'}}></div>
      </div>
      {showLabel && <span style={{fontSize:12,fontFamily:'var(--font-mono)',color:'var(--text2)',minWidth:32,textAlign:'right'}}>{pct}%</span>}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, trend, color, icon, onClick }) {
  const trendColor = trend > 0 ? 'var(--critical)' : trend < 0 ? 'var(--success)' : 'var(--text2)';
  const trendIcon  = trend > 0 ? '↑' : trend < 0 ? '↓' : '—';
  return (
    <div onClick={onClick} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--rlg)',padding:'18px 20px',cursor:onClick?'pointer':'default',transition:'border-color 0.2s',position:'relative',overflow:'hidden'}}
      onMouseEnter={e=>onClick&&(e.currentTarget.style.borderColor='var(--accent)')}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
      {color && <div style={{position:'absolute',top:0,left:0,width:3,height:'100%',background:color,borderRadius:'4px 0 0 4px'}}></div>}
      <div style={{marginLeft:color?4:0}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text2)',marginBottom:8}}>{label}</div>
        <div style={{fontSize:28,fontWeight:600,lineHeight:1,color:color||'var(--text)'}}>{value}</div>
        {(sub || trend !== undefined) && (
          <div style={{marginTop:6,display:'flex',gap:8,alignItems:'center',fontSize:12,color:'var(--text2)'}}>
            {sub && <span>{sub}</span>}
            {trend !== undefined && <span style={{color:trendColor,fontWeight:600}}>{trendIcon} {Math.abs(trend)}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ open, title, onClose, children, width = 560 }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);
  if (!open) return null;
  return (
    <div style={{position:'fixed',inset:0,zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div onClick={onClose} style={{position:'absolute',inset:0,background:'oklch(0 0 0 / 0.6)'}}></div>
      <div style={{position:'relative',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--rlg)',width:'100%',maxWidth:width,maxHeight:'90vh',overflow:'auto',boxShadow:'var(--shadow-lg)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px',borderBottom:'1px solid var(--border)',position:'sticky',top:0,background:'var(--surface)',zIndex:1}}>
          <div style={{fontWeight:600,fontSize:15}}>{title}</div>
          <button onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:4,color:'var(--text2)',fontSize:18,background:'var(--surface2)'}} onMouseEnter={e=>e.currentTarget.style.color='var(--text)'} onMouseLeave={e=>e.currentTarget.style.color='var(--text2)'}>×</button>
        </div>
        <div style={{padding:20}}>{children}</div>
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{display:'flex',borderBottom:'1px solid var(--border)',gap:0}}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          style={{padding:'10px 18px',fontSize:13,fontWeight:500,color:active===t.id?'var(--accent)':'var(--text2)',borderBottom:`2px solid ${active===t.id?'var(--accent)':'transparent'}`,transition:'all 0.15s',background:active===t.id?'var(--accent-bg)':'none',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}
          onMouseEnter={e=>{ if(active!==t.id) e.currentTarget.style.color='var(--text)'; }}
          onMouseLeave={e=>{ if(active!==t.id) e.currentTarget.style.color='var(--text2)'; }}>
          {t.icon && <span style={{fontSize:15}}>{t.icon}</span>}
          {t.label}
          {t.count !== undefined && <span style={{background:active===t.id?'var(--accent-bg)':'var(--surface2)',color:active===t.id?'var(--accent)':'var(--text3)',borderRadius:99,padding:'1px 6px',fontSize:11,fontWeight:600}}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
      <div>
        <h1 style={{fontSize:20,fontWeight:600,letterSpacing:'-0.02em'}}>{title}</h1>
        {subtitle && <p style={{fontSize:13,color:'var(--text2)',marginTop:4}}>{subtitle}</p>}
      </div>
      {actions && <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{actions}</div>}
    </div>
  );
}

// ─── Btn ──────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, variant='primary', size='md', disabled, type='button', style: extraStyle }) {
  const base = {display:'inline-flex',alignItems:'center',gap:6,borderRadius:'var(--rsm)',fontWeight:500,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,transition:'all 0.15s',border:'1px solid transparent',whiteSpace:'nowrap',boxShadow:'0 1px 2px oklch(0 0 0 / 0.12)'};
  const sizes = { sm:{padding:'4px 10px',fontSize:12}, md:{padding:'7px 14px',fontSize:13}, lg:{padding:'9px 18px',fontSize:14} };
  const variants = {
    primary:  { background:'var(--accent)',color:'oklch(0.1 0 0)',border:'1px solid var(--accent)' },
    secondary:{ background:'var(--surface2)',color:'var(--text)',border:'1px solid var(--border-strong)' },
    danger:   { background:'var(--critical-bg)',color:'var(--critical)',border:'1px solid var(--critical)' },
    ghost:    { background:'transparent',color:'var(--text2)',border:'1px solid var(--border)' },
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      style={{...base,...sizes[size],...variants[variant],...extraStyle}}
      onMouseEnter={e=>{ if(!disabled){ if(variant==='primary') e.currentTarget.style.background='var(--accent-h)'; else if(variant==='secondary' || variant==='ghost') { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-bg)'; e.currentTarget.style.color='var(--accent)'; } }}}
      onMouseLeave={e=>{ if(variant==='primary') e.currentTarget.style.background='var(--accent)'; else if(variant==='secondary'){ e.currentTarget.style.borderColor='var(--border-strong)'; e.currentTarget.style.background='var(--surface2)'; e.currentTarget.style.color='var(--text)'; } else if(variant==='ghost'){ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text2)'; } }}>
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style: extra, title, action, noPad }) {
  return (
    <div style={{background:'var(--surface)',border:'1px solid var(--border-strong)',borderRadius:'var(--rlg)',overflow:'hidden',boxShadow:'var(--shadow)',...extra}}>
      {title && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,letterSpacing:'0.01em'}}>{title}</div>
          {action}
        </div>
      )}
      <div style={noPad ? {} : {padding:'16px 18px'}}>{children}</div>
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────────────────────────────
function DataTable({ columns, rows, onRowClick, emptyText = '無資料', maxHeight, compact }) {
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sorted = React.useMemo(() => {
    if (!sortCol) return rows;
    return [...rows].sort((a, b) => {
      const va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
      const cmp = String(va).localeCompare(String(vb), 'zh-TW', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const handleSort = col => {
    if (!col.sortable) return;
    if (sortCol === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col.key); setSortDir('asc'); }
  };

  const cellPad = compact ? '6px 12px' : '10px 14px';

  return (
    <div style={{overflow:'auto',maxHeight}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col)}
                style={{padding:cellPad,textAlign:'left',fontWeight:600,fontSize:11,letterSpacing:'0.06em',textTransform:'uppercase',color:'var(--text2)',background:'var(--surface2)',borderBottom:'1px solid var(--border)',cursor:col.sortable?'pointer':'default',whiteSpace:'nowrap',position:'sticky',top:0}}>
                {col.label}{col.sortable && (sortCol===col.key ? (sortDir==='asc'?' ↑':' ↓') : ' ↕')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0
            ? <tr><td colSpan={columns.length} style={{padding:'32px',textAlign:'center',color:'var(--text3)',fontStyle:'italic'}}>{emptyText}</td></tr>
            : sorted.map((row, i) => (
              <tr key={row.id || i} onClick={() => onRowClick && onRowClick(row)}
                style={{borderBottom:'1px solid var(--border)',cursor:onRowClick?'pointer':'default',transition:'background 0.1s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--surface2)'}
                onMouseLeave={e=>e.currentTarget.style.background=''}>
                {columns.map(col => (
                  <td key={col.key} style={{padding:cellPad,verticalAlign:'middle',color:'var(--text)',fontFamily:col.mono?'var(--font-mono)':'var(--font-sans)',fontSize:col.mono?12:13,maxWidth:col.maxWidth||'none',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:col.wrap?'normal':'nowrap'}}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
}

// ─── FileUpload ───────────────────────────────────────────────────────────────
function FileUpload({ onFile, accept = '.csv', label = 'CSV 檔案', hint }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const handle = file => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => onFile(file.name, e.target.result);
    reader.readAsText(file, 'UTF-8');
  };
  return (
    <div onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{border:`2px dashed ${drag?'var(--accent)':'var(--border)'}`,borderRadius:'var(--r)',padding:'28px 20px',textAlign:'center',cursor:'pointer',transition:'all 0.2s',background:drag?'var(--accent-bg)':'transparent'}}>
      <input ref={inputRef} type="file" accept={accept} style={{display:'none'}} onChange={e => handle(e.target.files[0])} />
      <div style={{fontSize:28,marginBottom:8}}>📂</div>
      <div style={{fontWeight:500,marginBottom:4}}>拖曳或點擊上傳 {label}</div>
      {hint && <div style={{fontSize:12,color:'var(--text2)',marginTop:4}}>{hint}</div>}
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────
function Timeline({ items }) {
  const iconMap = { scan:'🔍', iso:'📋', nist:'🛡️', owasp:'🌐', default:'•' };
  return (
    <div style={{display:'flex',flexDirection:'column',gap:0}}>
      {items.map((item, i) => (
        <div key={i} style={{display:'flex',gap:12,position:'relative',paddingBottom:i<items.length-1?14:0}}>
          {i < items.length - 1 && <div style={{position:'absolute',left:17,top:28,width:2,bottom:0,background:'var(--border)'}}></div>}
          <div style={{width:34,height:34,borderRadius:'50%',background:'var(--surface2)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>{iconMap[item.type]||iconMap.default}</div>
          <div style={{paddingTop:6}}>
            <div style={{fontSize:13}}>{item.text}</div>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:2,fontFamily:'var(--font-mono)'}}>{item.date}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SearchBar ────────────────────────────────────────────────────────────────
function SearchBar({ value, onChange, placeholder = '搜尋…' }) {
  return (
    <div style={{position:'relative',display:'inline-flex',alignItems:'center'}}>
      <span style={{position:'absolute',left:9,color:'var(--text3)',pointerEvents:'none',fontSize:14}}>🔍</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{paddingLeft:30,width:220,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--rsm)',color:'var(--text)',fontSize:13,padding:'6px 10px 6px 30px'}} />
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────
function FormField({ label, required, children, hint }) {
  return (
    <div style={{marginBottom:14}}>
      <label style={{display:'block',fontSize:12,fontWeight:600,color:'var(--text2)',marginBottom:5,letterSpacing:'0.04em'}}>
        {label}{required && <span style={{color:'var(--critical)',marginLeft:2}}>*</span>}
      </label>
      {children}
      {hint && <div style={{fontSize:11,color:'var(--text3)',marginTop:3}}>{hint}</div>}
    </div>
  );
}

function FormInput({ ...props }) {
  return <input {...props} style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--rsm)',color:'var(--text)',fontSize:13,...props.style}} />;
}
function FormSelect({ children, ...props }) {
  return <select {...props} style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--rsm)',color:'var(--text)',fontSize:13,...props.style}}>{children}</select>;
}
function FormTextarea({ ...props }) {
  return <textarea {...props} rows={props.rows||3} style={{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:'var(--rsm)',color:'var(--text)',fontSize:13,resize:'vertical',...props.style}} />;
}

// ─── SectionDivider ───────────────────────────────────────────────────────────
function SectionDivider({ label }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:10,margin:'20px 0 14px'}}>
      <div style={{flex:1,height:1,background:'var(--border)'}}></div>
      <span style={{fontSize:11,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',color:'var(--text3)'}}>{label}</span>
      <div style={{flex:1,height:1,background:'var(--border)'}}></div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────
Object.assign(window, {
  ChartCanvas, SeverityBadge, StatusBadge, ProgressBar,
  StatCard, Modal, Tabs, PageHeader, Btn, Card,
  DataTable, FileUpload, Timeline, SearchBar,
  FormField, FormInput, FormSelect, FormTextarea, SectionDivider,
});
