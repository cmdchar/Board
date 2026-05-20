import { useCallback, useEffect, useRef, useState } from "react";

const TOOLS = [
  { id: "select", icon: "SEL", k: "V" }, { id: "pan", icon: "PAN", k: "H" }, null,
  { id: "sticky", icon: "STK", k: "S" }, { id: "text", icon: "TXT", k: "T" }, { id: "task", icon: "TSK", k: "Z" }, { id: "milestone", icon: "MLS", k: "W" }, { id: "decision", icon: "DEC", k: "1" }, { id: "transform", icon: "SUM", k: "2" }, null,
  { id: "rect", icon: "R", k: "R" }, { id: "circle", icon: "O", k: "" }, { id: "diamond", icon: "D", k: "D" },
  { id: "triangle", icon: "T", k: "Y" }, { id: "hexagon", icon: "H", k: "X" }, { id: "parallelogram", icon: "P", k: "Q" },
  { id: "cloud", icon: "C", k: "U" }, { id: "cylinder", icon: "CY", k: "I" }, { id: "table", icon: "TB", k: "B" }, { id: "sheet", icon: "SH", k: "" }, { id: "deck", icon: "DK", k: "O" },
  { id: "laneH", icon: "LH", k: "J" }, { id: "laneV", icon: "LV", k: "K" }, null,
  { id: "arrow", icon: "->", k: "C" }, { id: "draw", icon: "P", k: "P" }, { id: "comment", icon: "C", k: "M" }, { id: "frame", icon: "F", k: "F" }, { id: "vote", icon: "V", k: "G" }, null,
  { id: "laser", icon: "L", k: "L" }, { id: "eraser", icon: "E", k: "E" },
];

const DESKTOP_QUICK_TOOLS = [
  { id: "select", label: "Select", k: "V" },
  { id: "pan", label: "Pan", k: "H" },
  { id: "arrow", label: "Connect", k: "C" },
  { id: "sticky", label: "Sticky", k: "S" },
  { id: "text", label: "Text", k: "T" },
  { id: "frame", label: "Frame", k: "F" },
  { id: "comment", label: "Comment", k: "M" },
  { id: "draw", label: "Draw", k: "P" },
];

export default function ToolbarView({
  isMobile = false,
  hidden = false,
  useWBHook,
  T,
  uid,
  toasts,
  normalizeConnectorDefaultStyle,
  loadStoredConnectorDefaultStyle,
  normalizeConnectorStyle,
  isDataNodeType,
  wouldCreateDataFlowCycle,
  normalizeConnectorRouting,
  normalizeConnectorJumpStyle,
  normalizeConnectorEndpoints,
  getNextStickySwatch,
  MINDMAP_CHILD_GAP_X,
  MINDMAP_CHILD_GAP_Y,
}) {
  const { s, d } = useWBHook();
  const { tool, sel, hist, fut, snapGrid, nodes, arrows, depMode, zoom, px, py } = s;
  const [drawCol, setDrawCol] = useState(T.y);
  const spacePanRef = useRef({ active: false, prevTool: "select" });

  const buildConnectorFromDefaults = useCallback((spec, overrides = {}) => {
    if (!spec?.fromEntityId || !spec?.toEntityId) return null;
    const fromNode = nodes.find((n) => n.id === spec.fromEntityId) || null;
    const toNode = nodes.find((n) => n.id === spec.toEntityId) || null;
    const base = normalizeConnectorDefaultStyle(loadStoredConnectorDefaultStyle());
    const stylePatch = (overrides && typeof overrides.style === "object" && overrides.style) ? overrides.style : {};
    const style = normalizeConnectorStyle({ style: { ...base.style, ...stylePatch } });
    const explicitFlowType = String(overrides?.flowType || "").trim().toLowerCase();
    const inferredData = explicitFlowType === "data" || (isDataNodeType(fromNode?.type) && isDataNodeType(toNode?.type));
    if (inferredData && wouldCreateDataFlowCycle({ nodes, arrows, fromId: spec.fromEntityId, toId: spec.toEntityId })) {
      toasts.push("Data flow cycle prevented", "error");
      return null;
    }
    const connector = {
      id: uid(),
      fromId: spec.fromEntityId,
      toId: spec.toEntityId,
      from: { entityId: spec.fromEntityId, anchor: spec.fromAnchor || { type: "pos", xNorm: 0.5, yNorm: 0.5 } },
      to: { entityId: spec.toEntityId, anchor: spec.toAnchor || { type: "pos", xNorm: 0.5, yNorm: 0.5 } },
      routing: normalizeConnectorRouting(overrides?.routing ?? base.routing),
      style,
      jumpStyle: normalizeConnectorJumpStyle(overrides?.jumpStyle ?? base.jumpStyle, base.jumpStyle),
      label: String(overrides?.label ?? ""),
    };
    if (inferredData) {
      connector.flowType = "data";
      if (!String(connector.label || "").trim()) connector.label = "data";
      if (!overrides?.depType) connector.depType = "related";
    }
    return connector;
  }, [
    arrows,
    nodes,
    uid,
    normalizeConnectorDefaultStyle,
    loadStoredConnectorDefaultStyle,
    normalizeConnectorStyle,
    isDataNodeType,
    wouldCreateDataFlowCycle,
    toasts,
    normalizeConnectorRouting,
    normalizeConnectorJumpStyle,
  ]);

  useEffect(() => {
    const h = (e) => {
      const target = e.target;
      const tag = String(target?.tagName || "").toUpperCase();
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || target?.isContentEditable) return;
      const oneSel = sel.length === 1 ? nodes.find((n) => n.id === sel[0]) : null;
      const hasMods = e.ctrlKey || e.metaKey || e.altKey;

      if (!hasMods && e.code === "Space") {
        e.preventDefault();
        if (!spacePanRef.current.active && tool !== "pan") {
          spacePanRef.current = { active: true, prevTool: tool || "select" };
          d({ type: "TOOL", v: "pan" });
        }
        return;
      }

      if (oneSel?.type === "sheet") {
        const rows = Math.max(1, Math.min(300, Number(oneSel.sheetRows) || 12));
        const cols = Math.max(1, Math.min(52, Number(oneSel.sheetCols) || 6));
        const bits = String(oneSel.sheetActive || "1,0").split(",");
        const ar = Math.max(0, Math.min(rows - 1, parseInt(bits[0], 10) || 0));
        const ac = Math.max(0, Math.min(cols - 1, parseInt(bits[1], 10) || 0));
        const key = `${ar},${ac}`;
        const cells = oneSel.sheetCells && typeof oneSel.sheetCells === "object" ? oneSel.sheetCells : {};
        const cur = String(cells[key] ?? "");
        const setActive = (r, c) => d({ type: "UPD", id: oneSel.id, p: { sheetActive: `${Math.max(0, Math.min(rows - 1, r))},${Math.max(0, Math.min(cols - 1, c))}` } });
        const writeCurrent = (nextVal) => {
          if (oneSel.locked) return;
          const next = { ...cells };
          const v = String(nextVal ?? "");
          if (v.length) next[key] = v;
          else delete next[key];
          d({ type: "UPD", id: oneSel.id, p: { sheetCells: next, sheetActive: key } });
        };
        if (!hasMods && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter" || e.key === "Tab")) {
          e.preventDefault();
          if (e.key === "ArrowLeft") setActive(ar, ac - 1);
          if (e.key === "ArrowRight") setActive(ar, ac + 1);
          if (e.key === "ArrowUp") setActive(ar - 1, ac);
          if (e.key === "ArrowDown") setActive(ar + 1, ac);
          if (e.key === "Enter") setActive(ar + 1, ac);
          if (e.key === "Tab") setActive(ar, ac + 1);
          return;
        }
        if (!hasMods && (e.key === "Backspace" || e.key === "Delete")) {
          e.preventDefault();
          writeCurrent(e.key === "Delete" ? "" : cur.slice(0, -1));
          return;
        }
        if (!hasMods && e.key.length === 1) {
          e.preventDefault();
          writeCurrent(cur + e.key);
          return;
        }
      }

      if (oneSel?.type === "deck") {
        const slides = Array.isArray(oneSel.deckSlides) && oneSel.deckSlides.length ? oneSel.deckSlides : [{ id: "fallback", title: "Slide 1", body: "" }];
        const idx = Math.max(0, Math.min(slides.length - 1, Number(oneSel.deckIndex) || 0));
        const targetField = oneSel.deckInputTarget === "title" ? "title" : "body";
        const patchSlideText = (text) => {
          if (oneSel.locked) return;
          const next = slides.map((sli, i) => i === idx ? { ...sli, [targetField]: text } : sli);
          d({ type: "UPD", id: oneSel.id, p: { deckSlides: next, deckIndex: idx } });
        };
        if (!hasMods && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
          e.preventDefault();
          if (oneSel.locked) return;
          d({ type: "UPD", id: oneSel.id, p: { deckIndex: e.key === "ArrowLeft" ? Math.max(0, idx - 1) : Math.min(slides.length - 1, idx + 1) } });
          return;
        }
        if (!hasMods && e.key === "Enter") {
          e.preventDefault();
          if (targetField === "title") {
            if (oneSel.locked) return;
            d({ type: "UPD", id: oneSel.id, p: { deckInputTarget: "body" } });
          } else {
            patchSlideText(String(slides[idx]?.body || "") + "\n");
          }
          return;
        }
        if (!hasMods && (e.key === "Backspace" || e.key === "Delete")) {
          e.preventDefault();
          const curText = String(slides[idx]?.[targetField] || "");
          patchSlideText(e.key === "Delete" ? "" : curText.slice(0, -1));
          return;
        }
        if (!hasMods && e.key.length === 1) {
          e.preventDefault();
          patchSlideText(String(slides[idx]?.[targetField] || "") + e.key);
          return;
        }
      }

      const km = { v: "select", h: "pan", s: "sticky", t: "text", z: "task", w: "milestone", "1": "decision", "2": "transform", r: "rect", d: "diamond", y: "triangle", x: "hexagon", q: "parallelogram", u: "cloud", i: "cylinder", b: "table", o: "deck", j: "laneH", k: "laneV", a: "arrow", p: "draw", m: "comment", f: "frame", g: "vote", l: "laser", e: "eraser" };
      if (e.key === "Escape") {
        e.preventDefault();
        d({ type: "EXIT_ADD_MODE" });
        return;
      }
      if (!hasMods && e.key?.toLowerCase() === "c") {
        e.preventDefault();
        d({ type: "TOOL", v: "arrow" });
        return;
      }
      if (!hasMods && e.key?.toLowerCase() === "n") {
        e.preventDefault();
        const cx = (window.innerWidth * 0.5 - px) / zoom;
        const cy = (window.innerHeight * 0.42 - py) / zoom;
        const node = { id: uid(), type: "shape", shapeType: "rect", x: Math.round(cx - 85), y: Math.round(cy - 44), w: 170, h: 88, text: "Node", color: T.bg3, textColor: T.t0, borderColor: T.b1, fontSize: 13, fontWeight: "600" };
        d({ type: "ADD", node });
        d({ type: "SEL", v: [node.id] });
        d({ type: "EXIT_ADD_MODE" });
        return;
      }
      if (!e.ctrlKey && !e.metaKey && km[e.key?.toLowerCase()]) {
        if (km[e.key.toLowerCase()] === "select") d({ type: "EXIT_ADD_MODE" });
        else d({ type: "TOOL", v: km[e.key.toLowerCase()] });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); d({ type: "UNDO" }); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); d({ type: "REDO" }); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "d") { e.preventDefault(); d({ type: "DUP" }); }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && sel.length) { e.preventDefault(); d({ type: "COPY" }); toasts.push(`Copied ${sel.length} element${sel.length > 1 ? "s" : ""}`, "success"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") { e.preventDefault(); d({ type: "PASTE" }); toasts.push("Pasted", "success"); }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "g" && sel.length) { e.preventDefault(); d({ type: "GROUP" }); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "G") { e.preventDefault(); d({ type: "UNGROUP" }); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") { e.preventDefault(); d({ type: "TIDY", ids: sel.length ? sel : undefined }); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "d") { e.preventDefault(); d({ type: "DEP_MODE" }); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); const vw = window.innerWidth - 268; const vh = window.innerHeight - 62; d({ type: "ZOOM_FIT", vw, vh }); }
      if ((e.key === "Delete" || e.key === "Backspace") && sel.length && e.target === document.body) d({ type: "DEL", ids: sel });
      if ((e.ctrlKey || e.metaKey) && e.key === "a") { e.preventDefault(); d({ type: "SEL_ALL" }); }
      if (e.key === "Tab" && sel.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const p = nodes.find((n) => n.id === sel[0]);
        if (p && !p.locked && p.type !== "frame") {
          const sc = getNextStickySwatch();
          const nx = (p.x || 0) + (p.w || 120) + MINDMAP_CHILD_GAP_X;
          const ny = (p.y || 0) + ((p.h || 70) - 130) / 2;
          const child = { id: uid(), type: "sticky", x: nx, y: ny, w: 170, h: 130, text: "", color: sc.bg, textColor: sc.t };
          d({ type: "ADD", node: child });
          const connector = buildConnectorFromDefaults({
            fromEntityId: p.id,
            toEntityId: child.id,
            fromAnchor: { type: "port", portId: "right" },
            toAnchor: { type: "port", portId: "left" },
          });
          if (connector) d({ type: "ADD_ARR", arr: connector });
          d({ type: "SEL", v: [child.id] });
          d({ type: "TOOL", v: "select" });
        }
      }
      if (e.key === "Enter" && sel.length === 1 && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const cur = nodes.find((n) => n.id === sel[0]);
        if (cur && !cur.locked && cur.type !== "frame") {
          const sib = { ...cur, id: uid(), x: cur.x, y: (cur.y || 0) + (cur.h || 70) + MINDMAP_CHILD_GAP_Y, text: "" };
          d({ type: "ADD", node: sib });
          const parentEdge = arrows.find((a) => normalizeConnectorEndpoints(a).toEntityId === cur.id);
          const parentId = parentEdge ? normalizeConnectorEndpoints(parentEdge).fromEntityId : "";
          if (parentId) {
            const connector = buildConnectorFromDefaults({
              fromEntityId: parentId,
              toEntityId: sib.id,
              fromAnchor: { type: "port", portId: "bottom" },
              toAnchor: { type: "port", portId: "top" },
            });
            if (connector) d({ type: "ADD_ARR", arr: connector });
          }
          d({ type: "SEL", v: [sib.id] });
          d({ type: "TOOL", v: "select" });
        }
      }
      const nudge = e.shiftKey ? 1 : 8;
      if (e.key === "ArrowLeft" && sel.length && !e.ctrlKey && !e.metaKey) { e.preventDefault(); d({ type: "MOVE_SEL", dx: -nudge, dy: 0 }); }
      if (e.key === "ArrowRight" && sel.length && !e.ctrlKey && !e.metaKey) { e.preventDefault(); d({ type: "MOVE_SEL", dx: nudge, dy: 0 }); }
      if (e.key === "ArrowUp" && sel.length && !e.ctrlKey && !e.metaKey) { e.preventDefault(); d({ type: "MOVE_SEL", dx: 0, dy: -nudge }); }
      if (e.key === "ArrowDown" && sel.length && !e.ctrlKey && !e.metaKey) { e.preventDefault(); d({ type: "MOVE_SEL", dx: 0, dy: nudge }); }
      if ((e.key === "=" || e.key === "+") && !e.ctrlKey && !e.metaKey) { e.preventDefault(); d({ type: "ZOOM", v: zoom * 1.25 }); }
      if (e.key === "-" && !e.ctrlKey && !e.metaKey && !sel.length) { e.preventDefault(); d({ type: "ZOOM", v: zoom * .8 }); }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); d({ type: "FOCUS_MODE" }); toasts.push(s.focusMode ? "Focus mode off" : "Focus mode on"); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [sel, d, nodes, arrows, zoom, px, py, s.focusMode, tool, buildConnectorFromDefaults, uid, T, toasts, getNextStickySwatch, MINDMAP_CHILD_GAP_X, MINDMAP_CHILD_GAP_Y, normalizeConnectorEndpoints]);

  useEffect(() => {
    const onKeyUp = (e) => {
      if (e.code !== "Space") return;
      if (!spacePanRef.current.active) return;
      e.preventDefault();
      const prev = spacePanRef.current.prevTool || "select";
      spacePanRef.current.active = false;
      if (prev === "select") d({ type: "EXIT_ADD_MODE" });
      else d({ type: "TOOL", v: prev });
    };
    window.addEventListener("keyup", onKeyUp);
    return () => window.removeEventListener("keyup", onKeyUp);
  }, [d]);

  if (hidden) return null;

  const basePill = {
    minHeight: 36,
    borderRadius: 9,
    border: `1px solid ${T.b1}`,
    background: T.bg3,
    color: T.t1,
    padding: "0 12px",
    fontSize: 12,
    fontFamily: "'JetBrains Mono',monospace",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };
  const toolbarTools = isMobile ? TOOLS : DESKTOP_QUICK_TOOLS;

  return <div style={{ position: "absolute", left: "50%", top: isMobile ? "auto" : 18, bottom: isMobile ? "max(12px, env(safe-area-inset-bottom))" : "auto", transform: "translateX(-50%)", zIndex: 200, display: "flex", alignItems: "center", gap: 6, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 14, padding: "6px", boxShadow: "0 8px 32px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.03)", maxWidth: "calc(100vw - 20px)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
    {toolbarTools.map((t2, i) => {
      if (t2 === null) return <div key={`d${i}`} style={{ width: 1, height: 26, background: T.b0, margin: "0 2px" }} />;
      const isActive = tool === t2.id;
      const label = isMobile ? t2.icon : t2.label;
      return <button key={t2.id} onClick={() => { if (t2.id === "select") d({ type: "EXIT_ADD_MODE" }); else d({ type: "TOOL", v: t2.id }); }} title={t2.k ? `${t2.id} (${t2.k})` : t2.id}
        style={{ ...basePill, border: `1px solid ${isActive ? T.yDim : T.b1}`, background: isActive ? T.yBg : T.bg3, color: isActive ? T.y : T.t1, padding: isMobile ? "0 10px" : "0 12px", fontSize: isMobile ? 11 : 12, minHeight: isMobile ? 34 : 36, flexShrink: 0 }}
        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = T.bg4; e.currentTarget.style.color = T.t0; } }}
        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = T.bg3; e.currentTarget.style.color = T.t1; } }}>
        <span>{label}</span>
        {!isMobile && t2.k ? <span style={{ fontSize: 10, color: T.t2 }}>{t2.k}</span> : null}
      </button>;
    })}
    <div style={{ width: 1, height: 26, background: T.b0, margin: "0 2px" }} />
    <button onClick={() => d({ type: "UNDO" })} disabled={!hist.length} title="Ctrl+Z" style={{ ...basePill, color: hist.length ? T.t1 : T.t3, cursor: hist.length ? "pointer" : "not-allowed", minHeight: 36 }}>Undo</button>
    <button onClick={() => d({ type: "REDO" })} disabled={!fut.length} title="Ctrl+Y" style={{ ...basePill, color: fut.length ? T.t1 : T.t3, cursor: fut.length ? "pointer" : "not-allowed", minHeight: 36 }}>Redo</button>
    <button onClick={() => d({ type: "SNAP_TOGGLE" })} title="Snap to grid" style={{ ...basePill, border: `1px solid ${snapGrid ? T.yDim : T.b1}`, background: snapGrid ? T.yBg : T.bg3, color: snapGrid ? T.y : T.t1 }}>Grid</button>
    <button onClick={() => d({ type: "DEP_MODE" })} title="Dependency mode (Ctrl+Shift+D)" style={{ ...basePill, border: `1px solid ${depMode ? T.yDim : T.b1}`, background: depMode ? T.yBg : T.bg3, color: depMode ? T.y : T.t1 }}>Deps</button>
    <button onClick={() => { d({ type: "FOCUS_MODE" }); toasts.push(s.focusMode ? "Focus off" : "Focus on"); }} title="Focus mode (Ctrl+Shift+F)" style={{ ...basePill, border: s.focusMode ? "1px solid rgba(139,92,246,.5)" : `1px solid ${T.b1}`, background: s.focusMode ? "rgba(139,92,246,.1)" : T.bg3, color: s.focusMode ? T.purple : T.t1 }}>Focus</button>
    {sel.length > 0 && <>
      <button onClick={() => d({ type: "WRAP_FRAME", ids: sel, title: "Frame" })} title="Wrap in Frame" style={basePill}>Wrap</button>
      <button onClick={() => d({ type: "TIDY", ids: sel })} title="Auto-layout (Ctrl+Shift+L)" style={basePill}>Auto-layout</button>
      <button onClick={() => d({ type: "DUP" })} title="Ctrl+D" style={basePill}>Duplicate</button>
      <button onClick={() => d({ type: "DEL", ids: sel })} title="Delete" style={{ ...basePill, border: `1px solid ${T.red}`, color: T.red }}>Delete</button>
    </>}
    {tool === "draw" && <>
      <div style={{ width: 1, height: 26, background: T.b0, margin: "0 2px" }} />
      {[T.y, T.red, T.blue, T.green, "#ffffff", T.purple, T.teal].map((c) => <div key={c} onClick={() => setDrawCol(c)} style={{ width: 18, height: 18, borderRadius: "50%", background: c, border: `2px solid ${drawCol === c ? "#fff" : "transparent"}`, cursor: "pointer", flexShrink: 0, transition: "border .1s" }} />)}
      <input type="color" value={drawCol} onChange={(e) => setDrawCol(e.target.value)} title="Custom color" style={{ width: 22, height: 22, borderRadius: "50%", cursor: "pointer", border: "none", background: "none" }} />
      <button onClick={() => d({ type: "CLEAR_DRAWS" })} style={{ ...basePill, minHeight: 32, fontSize: 11 }}>Clear Draw</button>
    </>}
    {tool === "vote" && <>
      <div style={{ width: 1, height: 26, background: T.b0, margin: "0 2px" }} />
      <button onClick={() => d({ type: "CLEAR_VOTES" })} style={{ ...basePill, border: `1px solid ${T.yDim}`, color: T.y }}>Reset Votes</button>
    </>}
  </div>;
}
