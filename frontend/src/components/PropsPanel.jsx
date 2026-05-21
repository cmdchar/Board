const PBG = ["#fef9c3", "#dcfce7", "#dbeafe", "#fce7f3", "#ede9fe", "#ccfbf1", "#ffedd5", "#fef2f2", "#1c2a3e", "#0c1829", "#162032", "#ffffff"];
const PTXT = ["#1e293b", "#0c1829", "#ffffff", "#facc15", "#3b82f6", "#22c55e", "#ef4444", "#a78bfa", "#94a3b8"];
const PBRD = ["rgba(255,255,255,.08)", "#facc15", "#3b82f6", "#22c55e", "#ef4444", "#a78bfa", "rgba(0,0,0,.15)", "#fff", "#f97316"];
const PSZ = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48];

export default function PropsPanel({
  s,
  d,
  T,
  getTableInfo,
  TABLE_DEFAULT_COL_WIDTH,
  TABLE_MIN_COLS,
  TABLE_MIN_ROWS,
  TABLE_MIN_COL_WIDTH,
  TABLE_MAX_COL_WIDTH,
}) {
  const { sel, nodes } = s;
  if (!sel.length) return null;

  const f = nodes.find(n => n.id === sel[0]);
  if (!f) return null;

  const tInfo = f.tableId ? getTableInfo(nodes, f.tableId) : null;
  const tCols = tInfo?.cols?.length || 0;
  const tRows = tInfo?.rows?.length || 0;
  const activeCol = Number.isInteger(f.tableCol) ? f.tableCol : (tInfo?.cols?.[0] ?? 0);
  const activeRow = Number.isInteger(f.tableRow) ? f.tableRow : Math.max(0, tRows - 1);
  const activeColWidth = tInfo?.colWidths?.[activeCol] || TABLE_DEFAULT_COL_WIDTH;
  const tableCellSel = sel.map(id => nodes.find(n => n.id === id)).filter(n => n && n.tableRole === "cell" && !n.hidden);
  const sameTableCells = tableCellSel.length > 1 && tableCellSel.every(n => n.tableId === tableCellSel[0].tableId);
  const canMerge = sameTableCells;
  const mergeRoot = sel.length === 1 ? nodes.find(n => n.id === sel[0] && n.tableRole === "cell" && ((Number(n.mergeSpanCols) || 1) > 1 || (Number(n.mergeSpanRows) || 1) > 1)) : null;
  const canUnmerge = Boolean(mergeRoot);
  const u = p => d({ type: "UPD_SEL", p });

  function Sec({ label, children }) {
    return <div style={{ marginBottom: 11 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: T.t2, textTransform: "uppercase", letterSpacing: ".1em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 7 }}>{label}</div>
      {children}
    </div>;
  }

  function CGrid({ colors, cur, onChange }) {
    return <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {colors.map(c => <button key={c} onClick={() => onChange(c)} style={{ width: 19, height: 19, borderRadius: "50%", background: c, border: `2px solid ${cur === c ? T.y : "rgba(255,255,255,.08)"}`, cursor: "pointer", flexShrink: 0, transition: "transform .1s", boxShadow: cur === c ? `0 0 8px ${T.y}50` : "none" }} onMouseEnter={e => e.target.style.transform = "scale(1.3)"} onMouseLeave={e => e.target.style.transform = "scale(1)"} />)}
    </div>;
  }

  return <div className="pop" style={{ borderBottom: `1px solid ${T.b0}`, padding: "16px 18px 8px", background: `${T.bg1}55`, flexShrink: 0 }}>
    <div style={{ fontSize: 9, fontWeight: 800, color: T.y, marginBottom: 16, fontFamily: "'JetBrains Mono',monospace", display: "flex", alignItems: "center", gap: 6, letterSpacing: ".1em" }}>
      <span>◈</span> PROPERTIES {sel.length > 1 ? `(${sel.length} SELECTED)` : ""}
    </div>
    <Sec label="Background"><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><CGrid colors={PBG} cur={f.color} onChange={c => u({ color: c })} /><input type="color" value={f.color || "#000000"} onChange={e => u({ color: e.target.value })} title="Custom color" /></div></Sec>
    <Sec label="Text"><div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}><CGrid colors={PTXT} cur={f.textColor} onChange={c => u({ textColor: c })} /><input type="color" value={f.textColor || "#ffffff"} onChange={e => u({ textColor: e.target.value })} title="Custom color" /></div></Sec>
    {f.type === "shape" && <Sec label="Border"><CGrid colors={PBRD} cur={f.borderColor} onChange={c => u({ borderColor: c })} /></Sec>}
    <Sec label="Font"><div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{PSZ.map(sz => <button key={sz} onClick={() => u({ fontSize: sz })} style={{ background: f.fontSize === sz ? T.yBg : T.bg3, border: `1px solid ${f.fontSize === sz ? T.yDim : T.b0}`, color: f.fontSize === sz ? T.y : T.t1, borderRadius: 4, padding: "2px 6px", fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>{sz}</button>)}</div></Sec>
    <Sec label="Style"><div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
      <button onClick={() => u({ fontWeight: f.fontWeight === "bold" ? "normal" : "bold" })} style={{ width: 28, height: 24, border: `1px solid ${f.fontWeight === "bold" ? T.yDim : T.b0}`, background: f.fontWeight === "bold" ? T.yBg : T.bg3, color: f.fontWeight === "bold" ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>B</button>
      <button onClick={() => u({ fontStyle: f.fontStyle === "italic" ? "normal" : "italic" })} style={{ width: 28, height: 24, border: `1px solid ${f.fontStyle === "italic" ? T.yDim : T.b0}`, background: f.fontStyle === "italic" ? T.yBg : T.bg3, color: f.fontStyle === "italic" ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 12, fontStyle: "italic" }}>I</button>
    </div></Sec>
    {tInfo && <Sec label={`Table ${tRows}x${tCols}`}><div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 6 }}>
      <button onClick={() => d({ type: "TABLE_ADD_ROW", tableId: f.tableId, row: Number.isInteger(f.tableRow) ? f.tableRow + 1 : tRows })} title="Add row" style={{ height: 24, padding: "0 7px", border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>+ row</button>
      <button onClick={() => d({ type: "TABLE_DEL_ROW", tableId: f.tableId, row: activeRow })} disabled={tRows <= TABLE_MIN_ROWS} title="Delete row" style={{ height: 24, padding: "0 7px", border: `1px solid ${tRows <= TABLE_MIN_ROWS ? T.b0 : "rgba(239,68,68,.35)"}`, background: T.bg3, color: tRows <= TABLE_MIN_ROWS ? T.t3 : "#fca5a5", borderRadius: 4, cursor: tRows <= TABLE_MIN_ROWS ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>- row</button>
      <button onClick={() => d({ type: "TABLE_ADD_COL", tableId: f.tableId, col: Number.isInteger(f.tableCol) ? f.tableCol + 1 : tCols })} title="Add column" style={{ height: 24, padding: "0 7px", border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>+ col</button>
      <button onClick={() => d({ type: "TABLE_DEL_COL", tableId: f.tableId, col: activeCol })} disabled={tCols <= TABLE_MIN_COLS} title="Delete column" style={{ height: 24, padding: "0 7px", border: `1px solid ${tCols <= TABLE_MIN_COLS ? T.b0 : "rgba(239,68,68,.35)"}`, background: T.bg3, color: tCols <= TABLE_MIN_COLS ? T.t3 : "#fca5a5", borderRadius: 4, cursor: tCols <= TABLE_MIN_COLS ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>- col</button>
      <button onClick={() => d({ type: "TABLE_MERGE_SEL" })} disabled={!canMerge} title="Merge cells" style={{ height: 24, padding: "0 7px", border: `1px solid ${canMerge ? T.yDim : T.b0}`, background: canMerge ? T.yBg : T.bg3, color: canMerge ? T.y : T.t3, borderRadius: 4, cursor: canMerge ? "pointer" : "not-allowed", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>merge</button>
      <button onClick={() => d({ type: "TABLE_UNMERGE_SEL" })} disabled={!canUnmerge} title="Unmerge cells" style={{ height: 24, padding: "0 7px", border: `1px solid ${canUnmerge ? T.yDim : T.b0}`, background: canUnmerge ? T.yBg : T.bg3, color: canUnmerge ? T.y : T.t3, borderRadius: 4, cursor: canUnmerge ? "pointer" : "not-allowed", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>unmerge</button>
    </div>
    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
      <span style={{ fontSize: 9.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", minWidth: 42 }}>col {activeCol + 1}</span>
      <input type="range" min={TABLE_MIN_COL_WIDTH} max={TABLE_MAX_COL_WIDTH} step={2} value={activeColWidth} onChange={e => d({ type: "TABLE_SET_COL_WIDTH", tableId: f.tableId, col: activeCol, width: parseInt(e.target.value) || activeColWidth })} style={{ flex: 1 }} />
      <input type="number" min={TABLE_MIN_COL_WIDTH} max={TABLE_MAX_COL_WIDTH} value={Math.round(activeColWidth)} onChange={e => d({ type: "TABLE_SET_COL_WIDTH", tableId: f.tableId, col: activeCol, width: parseInt(e.target.value) || activeColWidth })} style={{ width: 58, background: T.bg3, border: `1px solid ${T.b0}`, borderRadius: 4, color: T.t0, fontSize: 10, padding: "2px 5px", fontFamily: "'JetBrains Mono',monospace" }} />
    </div></Sec>}
    {f.type === "lane" && <Sec label="Lane"><div style={{ display: "flex", gap: 4 }}>
      <button onClick={() => u({ orientation: "h" })} style={{ flex: 1, height: 24, border: `1px solid ${f.orientation !== "v" ? T.yDim : T.b0}`, background: f.orientation !== "v" ? T.yBg : T.bg3, color: f.orientation !== "v" ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>horizontal</button>
      <button onClick={() => u({ orientation: "v" })} style={{ flex: 1, height: 24, border: `1px solid ${f.orientation === "v" ? T.yDim : T.b0}`, background: f.orientation === "v" ? T.yBg : T.bg3, color: f.orientation === "v" ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>vertical</button>
    </div></Sec>}
    <Sec label="Text align"><div style={{ display: "flex", gap: 3 }}>
      {[["≡L", "left"], ["≡C", "center"], ["≡R", "right"]].map(([lbl, v]) => {
        const act = f.textAlign === v || (v === "left" && !f.textAlign);
        return <button key={v} onClick={() => d({ type: "SET_TEXT_ALIGN", v })} style={{ flex: 1, height: 24, border: `1px solid ${act ? T.yDim : T.b0}`, background: act ? T.yBg : T.bg3, color: act ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>{lbl}</button>;
      })}
    </div></Sec>
    <Sec label="Order & lock"><div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      <button onClick={() => d({ type: "LOCK_SEL" })} title="Lock/Unlock" style={{ height: 24, padding: "0 6px", border: `1px solid ${f.locked ? T.yDim : T.b0}`, background: f.locked ? T.yBg : T.bg3, color: f.locked ? T.y : T.t1, borderRadius: 4, cursor: "pointer", fontSize: 11 }}>🔒</button>
      <button onClick={() => d({ type: "Z_FRONT" })} title="Bring to Front" style={{ height: 24, padding: "0 6px", border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>↑↑</button>
      <button onClick={() => d({ type: "Z_FWD" })} title="Forward" style={{ height: 24, padding: "0 6px", border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>↑</button>
      <button onClick={() => d({ type: "Z_BWD" })} title="Backward" style={{ height: 24, padding: "0 6px", border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>↓</button>
      <button onClick={() => d({ type: "Z_BACK" })} title="Send to Back" style={{ height: 24, padding: "0 6px", border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>↓↓</button>
    </div></Sec>
    {f.type === "shape" && <Sec label={`Border ${(f.borderWidth || 1.5).toFixed(1)}px`}><input type="range" min={0} max={8} step={0.5} value={f.borderWidth || 1.5} onChange={e => u({ borderWidth: parseFloat(e.target.value) })} style={{ width: "100%", marginBottom: 4 }} /></Sec>}
    <Sec label={`Opacity ${Math.round((f.opacity ?? 1) * 100)}%`}><input type="range" min={0.1} max={1} step={0.05} value={f.opacity ?? 1} onChange={e => u({ opacity: parseFloat(e.target.value) })} style={{ width: "100%", marginBottom: 6 }} /></Sec>
    <Sec label={`Rotation ${Math.round(f.rotation || 0)}deg`}><div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}><input type="range" min={-180} max={180} step={1} value={f.rotation || 0} onChange={e => u({ rotation: parseFloat(e.target.value) })} style={{ flex: 1 }} /><button onClick={() => u({ rotation: 0 })} title="Reset" style={{ width: 24, height: 22, border: `1px solid ${T.b0}`, background: T.bg3, color: T.t1, borderRadius: 4, cursor: "pointer", fontSize: 11 }}>↺</button></div></Sec>
    {!tInfo && <Sec label="W x H"><div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
      {[["W", "w"], ["H", "h"]].map(([l, k]) => <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, background: T.bg3, border: `1px solid ${T.b0}`, borderRadius: 5, padding: "3px 7px", flex: 1 }}>
        <span style={{ fontSize: 9.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{l}</span>
        <input type="number" value={Math.round(f[k] || 0)} min={40} onChange={e => u({ [k]: parseInt(e.target.value) || 40 })} style={{ background: "transparent", border: "none", outline: "none", color: T.t0, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", width: "100%", textAlign: "right" }} />
      </div>)}
    </div></Sec>}
    <Sec label="Hyperlink (Ctrl+click)"><div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input value={f.url || ""} onChange={e => u({ url: e.target.value || null })} placeholder="https://..." style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b0}`, borderRadius: 5, padding: "4px 7px", color: T.t0, fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} onFocus={e => e.target.style.borderColor = T.yDim} onBlur={e => e.target.style.borderColor = T.b0} />
      {f.url && <button onClick={() => window.open(f.url, "_blank", "noopener")} style={{ background: T.bg3, border: `1px solid ${T.b0}`, color: T.blue, padding: "3px 7px", borderRadius: 5, fontSize: 10, cursor: "pointer" }}>↗</button>}
    </div></Sec>
  </div>;
}

