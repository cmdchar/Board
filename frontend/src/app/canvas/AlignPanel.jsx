export default function AlignPanelView({ s, d, T }) {
  const { sel, nodes, zoom, px, py } = s;
  if (sel.length < 2) return null;
  const sn = nodes.filter((n) => sel.includes(n.id));
  if (sn.length < 2) return null;
  const minX = Math.min(...sn.map((n) => n.x));
  const minY = Math.min(...sn.map((n) => n.y));
  const maxX = Math.max(...sn.map((n) => n.x + (n.w || 0)));
  const scrLeft = minX * zoom + px;
  const scrTop = minY * zoom + py;
  const scrW = (maxX - minX) * zoom;
  const panelLeft = scrLeft + scrW / 2;
  const panelTop = Math.max(56, scrTop - 50);
  const bs = { width: 28, height: 28, background: "transparent", border: "none", color: T.t1, fontSize: 13, cursor: "pointer", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" };
  const hover = (e) => {
    e.currentTarget.style.background = T.bg3;
    e.currentTarget.style.color = T.y;
  };
  const leave = (e) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.color = T.t1;
  };
  const applyLayout = (layout) => {
    const ids = (Array.isArray(sel) ? sel : []).filter(Boolean);
    const movable = nodes.filter((n) => ids.includes(n.id) && !n.locked);
    if (movable.length < 2) return;
    if (layout === "grid") {
      d({ type: "TIDY", ids });
      return;
    }
    const gap = 56;
    const deltas = {};
    if (layout === "horizontal") {
      const sorted = [...movable].sort((a, b) => a.x - b.x);
      const baseX = Math.min(...sorted.map((n) => n.x));
      const midY = sorted.reduce((sum, n) => sum + n.y + (Number(n.h) || 80) * 0.5, 0) / sorted.length;
      let cursor = baseX;
      for (const n of sorted) {
        const w = Number(n.w) || 120;
        const h = Number(n.h) || 80;
        deltas[n.id] = { x: cursor, y: Math.round(midY - h * 0.5) };
        cursor += w + gap;
      }
    } else {
      const sorted = [...movable].sort((a, b) => a.y - b.y);
      const baseY = Math.min(...sorted.map((n) => n.y));
      const midX = sorted.reduce((sum, n) => sum + n.x + (Number(n.w) || 120) * 0.5, 0) / sorted.length;
      let cursor = baseY;
      for (const n of sorted) {
        const w = Number(n.w) || 120;
        const h = Number(n.h) || 80;
        deltas[n.id] = { x: Math.round(midX - w * 0.5), y: cursor };
        cursor += h + gap;
      }
    }
    d({ type: "UPD_MULTI", deltas });
  };
  const btns = [["L", "left", "Align Left"], ["T", "top", "Align Top"], ["R", "right", "Align Right"], ["B", "bottom", "Align Bottom"], ["CX", "cx", "Center Horizontal"], ["CY", "cy", "Center Vertical"], null, ["DH", "dh", "Distribute Horizontal"], ["DV", "dv", "Distribute Vertical"]];
  return (
    <div className="pop" style={{ position: "absolute", left: panelLeft, top: panelTop, transform: "translateX(-50%)", zIndex: 300, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 10, padding: "4px 6px", display: "flex", gap: 1, boxShadow: "0 4px 20px rgba(0,0,0,.6)", pointerEvents: "auto", alignItems: "center" }}>
      {btns.map((b, i) =>
        b === null ? (
          <div key={i} style={{ width: 1, height: 22, background: T.b0, margin: "0 2px" }} />
        ) : (
          <button key={b[1]} onClick={() => d({ type: "ALIGN", d: b[1] })} title={b[2]} style={bs} onMouseEnter={hover} onMouseLeave={leave}>
            {b[0]}
          </button>
        ),
      )}
      <div style={{ width: 1, height: 22, background: T.b0, margin: "0 2px" }} />
      <button onClick={() => d({ type: "GROUP" })} title="Group (Ctrl+G)" style={{ ...bs, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", width: 32 }} onMouseEnter={hover} onMouseLeave={leave}>
        GRP
      </button>
      <button onClick={() => d({ type: "UNGROUP" })} title="Ungroup (Ctrl+Shift+G)" style={{ ...bs, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", width: 36 }} onMouseEnter={hover} onMouseLeave={leave}>
        UGRP
      </button>
      <div style={{ width: 1, height: 22, background: T.b0, margin: "0 2px" }} />
      <button onClick={() => applyLayout("vertical")} title="Vertical flow" style={{ ...bs, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", width: 24 }} onMouseEnter={hover} onMouseLeave={leave}>
        V
      </button>
      <button onClick={() => applyLayout("horizontal")} title="Horizontal flow" style={{ ...bs, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", width: 24 }} onMouseEnter={hover} onMouseLeave={leave}>
        H
      </button>
      <button onClick={() => applyLayout("grid")} title="Grid layout" style={{ ...bs, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", width: 24 }} onMouseEnter={hover} onMouseLeave={leave}>
        G
      </button>
    </div>
  );
}
