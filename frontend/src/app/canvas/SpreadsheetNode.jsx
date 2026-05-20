import { useEffect, useMemo, useRef, useState } from "react";

export default function SpreadsheetNodeView({
  node,
  sel,
  onSel,
  onTouchSel,
  onUpd,
  onRSt,
  onRotSt,
  depFade = 1,
  spreadsheetEngine = null,
  formulaSession = null,
  formulaPick = null,
  onFormulaSessionChange = null,
  onFormulaReferencePick = null,
  onConsumeFormulaPick = null,
  formulaHighlight = false,
  formulaSource = false,
  anomalyMap = null,
  T,
  RH,
  RotH,
  sheetCellKey,
  createSpreadsheetEngine,
  appendFormulaReference,
  sheetColLabel,
  buildSheetReferenceToken,
}) {
  const rows = Math.max(1, Math.min(300, Number(node.sheetRows) || 12));
  const cols = Math.max(1, Math.min(52, Number(node.sheetCols) || 6));
  const cellW = Math.max(68, Math.min(300, Number(node.sheetCellW) || 118));
  const rowH = Math.max(24, Math.min(80, Number(node.sheetRowH) || 32));
  const activeKey = String(node.sheetActive || "1,0");
  const ar = Math.max(0, Math.min(rows - 1, parseInt(activeKey.split(",")[0], 10) || 0));
  const ac = Math.max(0, Math.min(cols - 1, parseInt(activeKey.split(",")[1], 10) || 0));
  const selectedKey = sheetCellKey(ar, ac);
  const rawActive = String(node.sheetCells?.[selectedKey] ?? "");
  const localEngine = useMemo(() => createSpreadsheetEngine({ nodes: [node], arrows: [] }), [node, createSpreadsheetEngine]);
  const engine = spreadsheetEngine || localEngine;
  const flow = useMemo(() => {
    if (engine && typeof engine.getSheetFlow === "function") return engine.getSheetFlow(node.id);
    return { incoming: 0, outgoing: 0, incomingEdges: [], outgoingEdges: [] };
  }, [engine, node.id]);
  const [editingKey, setEditingKey] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [barValue, setBarValue] = useState(rawActive);
  const [barFocused, setBarFocused] = useState(false);
  const sessionIdRef = useRef("");

  useEffect(() => { if (!editingKey) setBarValue(rawActive); }, [rawActive, editingKey, node.id]);

  const withSelection = (patch) => onUpd(node.id, patch);
  const setActive = (r, c) => withSelection({ sheetActive: sheetCellKey(r, c) });
  const writeCell = (r, c, val) => {
    if (node.locked) return;
    const key = sheetCellKey(r, c);
    const next = { ...(node.sheetCells || {}) };
    const v = String(val ?? "");
    if (v.length) next[key] = v;
    else delete next[key];
    withSelection({ sheetCells: next, sheetActive: key });
  };
  const commitEditing = () => {
    if (!editingKey) return;
    const bits = editingKey.split(",");
    writeCell(parseInt(bits[0], 10) || 0, parseInt(bits[1], 10) || 0, editingValue);
    setEditingKey(null);
  };
  const resizeSheet = (nextRows, nextCols) => {
    if (node.locked) return;
    const nr = Math.max(1, Math.min(400, nextRows));
    const nc = Math.max(1, Math.min(52, nextCols));
    const nextCells = {};
    Object.entries(node.sheetCells || {}).forEach(([key, val]) => {
      const bits = key.split(",");
      const r = parseInt(bits[0], 10);
      const c = parseInt(bits[1], 10);
      if (Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < nr && c < nc) nextCells[key] = val;
    });
    const nAr = Math.min(nr - 1, ar);
    const nAc = Math.min(nc - 1, ac);
    withSelection({ sheetRows: nr, sheetCols: nc, sheetCells: nextCells, sheetActive: sheetCellKey(nAr, nAc) });
  };

  const isFormulaEditing = Boolean((editingKey && String(editingValue || "").trim().startsWith("=")) || (barFocused && String(barValue || "").trim().startsWith("=")));
  const activeFormulaInput = editingKey ? editingValue : barValue;
  const referencedSheetIds = useMemo(() => {
    if (!isFormulaEditing || !engine || typeof engine.getReferencedSheetIds !== "function") return [];
    return engine.getReferencedSheetIds(activeFormulaInput, node.id);
  }, [activeFormulaInput, engine, isFormulaEditing, node.id]);
  const referencedSheetKey = referencedSheetIds.join("|");

  useEffect(() => {
    if (typeof onFormulaSessionChange !== "function") return;
    if (isFormulaEditing) {
      if (!sessionIdRef.current) sessionIdRef.current = `sheet_formula_${node.id}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      onFormulaSessionChange({
        active: true,
        sessionId: sessionIdRef.current,
        sourceSheetId: node.id,
        referencedSheetIds,
      });
      return;
    }
    if (sessionIdRef.current) {
      onFormulaSessionChange({
        active: false,
        sessionId: sessionIdRef.current,
        sourceSheetId: node.id,
        referencedSheetIds: [],
      });
      sessionIdRef.current = "";
    }
  }, [isFormulaEditing, node.id, onFormulaSessionChange, referencedSheetKey, referencedSheetIds]);

  useEffect(() => () => {
    if (typeof onFormulaSessionChange !== "function") return;
    if (!sessionIdRef.current) return;
    onFormulaSessionChange({
      active: false,
      sessionId: sessionIdRef.current,
      sourceSheetId: node.id,
      referencedSheetIds: [],
    });
    sessionIdRef.current = "";
  }, [node.id, onFormulaSessionChange]);

  useEffect(() => {
    const pick = formulaPick;
    if (!pick || !pick.sessionId || !sessionIdRef.current) return;
    if (pick.sessionId !== sessionIdRef.current) return;
    const token = String(pick.token || "").trim();
    if (!token) return;
    if (editingKey) {
      setEditingValue((prev) => appendFormulaReference(prev, token));
    } else {
      setBarValue((prev) => appendFormulaReference(prev, token));
      setBarFocused(true);
    }
    if (typeof onConsumeFormulaPick === "function" && pick.id) {
      onConsumeFormulaPick(pick.id);
    }
  }, [editingKey, formulaPick, onConsumeFormulaPick, appendFormulaReference]);

  const formulaSessionActive = Boolean(formulaSession?.active && formulaSession?.sessionId && typeof onFormulaReferencePick === "function");
  const requestReferencePick = (r, c) => {
    if (!formulaSessionActive) return false;
    const localRef = `${sheetColLabel(c)}${r + 1}`;
    const token = formulaSession?.sourceSheetId === node.id
      ? localRef
      : buildSheetReferenceToken(node, r, c);
    onFormulaReferencePick({
      id: `sheet_ref_pick_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      sessionId: formulaSession.sessionId,
      token,
      targetSheetId: node.id,
      targetCell: sheetCellKey(r, c),
    });
    return true;
  };

  const borderColor = sel
    ? T.y
    : (formulaSource ? "#22d3ee" : (formulaHighlight ? "#38bdf8" : (node.borderColor || T.b1)));
  const boxShadow = sel
    ? `0 0 0 2px ${T.y},0 10px 26px rgba(0,0,0,.28)`
    : (formulaSource
      ? "0 0 0 2px rgba(34,211,238,.35),0 10px 26px rgba(0,0,0,.28)"
      : (formulaHighlight
        ? "0 0 0 2px rgba(56,189,248,.26),0 8px 24px rgba(0,0,0,.22)"
        : "0 8px 24px rgba(0,0,0,.22)"));

  return <div data-node="1" data-node-id={node.id} data-node-type={node.type} data-selected={sel ? "1" : "0"} className="na" onMouseDown={(e) => { e.stopPropagation(); onSel(node.id, e.shiftKey, e.altKey); }}
    onTouchStart={(e) => { if (onTouchSel) { onTouchSel(e, node.id); return; } e.stopPropagation(); onSel(node.id, false, false); }}
    style={{ position: "absolute", left: node.x, top: node.y, width: node.w, height: node.h, zIndex: node.zIndex || 0, opacity: (node.opacity ?? 1) * depFade, background: T.bg1, border: `2px solid ${borderColor}`, borderRadius: 10, boxShadow, cursor: node.locked ? "default" : "move", display: "flex", flexDirection: "column", overflow: "hidden", transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined }}>
    <div data-sheet-ui="1" onMouseDown={(e) => e.stopPropagation()} style={{ height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", background: T.bg3, borderBottom: `1px solid ${T.b1}`, gap: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.t0, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{node.text || "Spreadsheet"}</div>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", marginLeft: "auto" }}>
        {`out:${flow.outgoing || 0} in:${flow.incoming || 0}`}
      </div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
        <button onClick={(e) => { e.stopPropagation(); resizeSheet(rows + 1, cols); }} style={{ height: 22, padding: "0 6px", border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, borderRadius: 4, fontSize: 10, cursor: node.locked ? "not-allowed" : "pointer" }} disabled={node.locked}>+R</button>
        <button onClick={(e) => { e.stopPropagation(); resizeSheet(rows - 1, cols); }} style={{ height: 22, padding: "0 6px", border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, borderRadius: 4, fontSize: 10, cursor: node.locked ? "not-allowed" : "pointer" }} disabled={node.locked || rows <= 1}>-R</button>
        <button onClick={(e) => { e.stopPropagation(); resizeSheet(rows, cols + 1); }} style={{ height: 22, padding: "0 6px", border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, borderRadius: 4, fontSize: 10, cursor: node.locked ? "not-allowed" : "pointer" }} disabled={node.locked}>+C</button>
        <button onClick={(e) => { e.stopPropagation(); resizeSheet(rows, cols - 1); }} style={{ height: 22, padding: "0 6px", border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, borderRadius: 4, fontSize: 10, cursor: node.locked ? "not-allowed" : "pointer" }} disabled={node.locked || cols <= 1}>-C</button>
      </div>
    </div>
    <div data-sheet-ui="1" onMouseDown={(e) => e.stopPropagation()} style={{ height: 30, display: "flex", alignItems: "center", gap: 8, padding: "0 8px", borderBottom: `1px solid ${T.b1}`, background: T.bg2 }}>
      <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono',monospace", color: T.t1, minWidth: 56 }}>{`${sheetColLabel(ac)}${ar + 1}`}</span>
      <input value={barValue} onFocus={() => setBarFocused(true)} onChange={(e) => setBarValue(e.target.value)} onBlur={() => { setBarFocused(false); writeCell(ar, ac, barValue); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); writeCell(ar, ac, barValue); } if (e.key === "Escape") { e.preventDefault(); setBarValue(rawActive); } }}
        disabled={node.locked}
        style={{ flex: 1, height: 22, background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 4, padding: "0 7px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.t0, outline: "none" }} />
      {isFormulaEditing && <span style={{ fontSize: 10, color: "#22d3ee", fontFamily: "'JetBrains Mono',monospace" }}>pick refs</span>}
    </div>
    <div data-sheet-ui="1" onMouseDown={(e) => e.stopPropagation()} style={{ flex: 1, overflow: "auto", background: T.bg1 }}>
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%" }}>
        <thead>
          <tr>
            <th style={{ position: "sticky", left: 0, top: 0, zIndex: 4, width: 42, minWidth: 42, maxWidth: 42, background: T.bg3, border: `1px solid ${T.b1}`, fontSize: 10, color: T.t1, fontFamily: "'JetBrains Mono',monospace" }}>#</th>
            {Array.from({ length: cols }, (_, c) => <th key={`h-${c}`} style={{ position: "sticky", top: 0, zIndex: 3, minWidth: cellW, maxWidth: cellW, width: cellW, background: T.bg3, border: `1px solid ${T.b1}`, fontSize: 10, color: T.t1, fontFamily: "'JetBrains Mono',monospace" }}>{sheetColLabel(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => <tr key={`r-${r}`}>
            <td style={{ position: "sticky", left: 0, zIndex: 2, width: 42, minWidth: 42, maxWidth: 42, background: T.bg2, border: `1px solid ${T.b0}`, textAlign: "center", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{r + 1}</td>
            {Array.from({ length: cols }, (_, c) => {
              const key = sheetCellKey(r, c);
              let info = { raw: "", display: "", num: 0, error: false, errorCode: "" };
              try {
                info = engine.evaluateCell(node.id, r, c);
              } catch {
                info = { raw: "", display: "#REF!", num: 0, error: true, errorCode: "REF" };
              }
              const isActive = key === selectedKey;
              const isEditing = editingKey === key;
              const anomalySeverity = String(anomalyMap?.[key] || "").toLowerCase();
              const anomalyBg = anomalySeverity === "high"
                ? "rgba(239,68,68,.18)"
                : anomalySeverity === "medium"
                  ? "rgba(250,204,21,.16)"
                  : anomalySeverity === "low"
                    ? "rgba(148,163,184,.14)"
                    : "";
              const anomalyOutline = anomalySeverity === "high"
                ? "rgba(239,68,68,.7)"
                : anomalySeverity === "medium"
                  ? "rgba(250,204,21,.65)"
                  : anomalySeverity === "low"
                    ? "rgba(148,163,184,.5)"
                    : "";
              return <td key={key} onMouseDown={(e) => { e.stopPropagation(); if (formulaSessionActive) return; onSel(node.id, false, false); }} onClick={(e) => { e.stopPropagation(); if (requestReferencePick(r, c)) return; setActive(r, c); }} onDoubleClick={(e) => { e.stopPropagation(); if (node.locked) return; if (requestReferencePick(r, c)) return; setActive(r, c); setEditingKey(key); setEditingValue(String(node.sheetCells?.[key] ?? "")); }}
                style={{ minWidth: cellW, maxWidth: cellW, width: cellW, height: rowH, border: `1px solid ${T.b0}`, padding: "0 6px", background: isActive ? T.yBg : (anomalyBg || T.bg1), boxShadow: isActive ? `inset 0 0 0 1px ${T.yDim}` : (anomalyOutline ? `inset 0 0 0 1px ${anomalyOutline}` : "none"), color: info.error ? T.red : T.t0, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: "cell" }}>
                {isEditing
                  ? <input autoFocus value={editingValue} onChange={(e) => setEditingValue(e.target.value)} onBlur={commitEditing} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitEditing(); } if (e.key === "Escape") { e.preventDefault(); setEditingKey(null); setEditingValue(String(node.sheetCells?.[key] ?? "")); } }}
                    style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: T.t0 }} />
                  : <span>{info.display}</span>}
              </td>;
            })}
          </tr>)}
        </tbody>
      </table>
    </div>
    {sel && !node.locked && <><RH nodeId={node.id} onStart={onRSt} /><RotH nodeId={node.id} onStart={onRotSt} /></>}
  </div>;
}
