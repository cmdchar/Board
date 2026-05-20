import { useEffect, useRef, useState } from "react";

export default function TopBarView({
  onTpl,
  onSearch,
  onPresent,
  isSaved,
  boardName,
  onRename,
  onBoards,
  isMobile = false,
  onToggleRight,
  rightOpen = false,
  onToggleTools,
  toolsOpen = false,
  onToggleMore,
  moreOpen = false,
  themeMode = "dark",
  onToggleTheme,
  showMinimap = false,
  onToggleMinimap,
  showTimeline = false,
  onToggleTimeline,
  s,
  d,
  T,
  ME,
  notify,
}) {
  const { nodes, arrows, sel, hist, fut, zoom } = s;
  const visibleNodes = nodes.filter((n) => !n.hidden);
  const impRef = useRef(null);
  const menuRef = useRef(null);
  const [editName, setEditName] = useState(false);
  const [nameVal, setNameVal] = useState(boardName || "Untitled Board");
  const [menuOpen, setMenuOpen] = useState(false);
  const nameRef = useRef(null);
  useEffect(() => setNameVal(boardName || "Untitled Board"), [boardName]);
  useEffect(() => {
    if (editName) nameRef.current?.select();
  }, [editName]);
  useEffect(() => {
    if (isMobile) setMenuOpen(false);
  }, [isMobile]);
  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  function saveName() {
    const v = nameVal.trim() || "Untitled Board";
    if (v !== boardName) onRename?.(v);
    setEditName(false);
  }

  function exportSVG() {
    const vis = nodes.filter((n) => !n.hidden);
    if (!vis.length) return;
    const xs = vis.map((n) => n.x),
      ys = vis.map((n) => n.y),
      x2 = vis.map((n) => n.x + (n.w || 100)),
      y2 = vis.map((n) => n.y + (n.h || 60));
    const bx = Math.min(...xs) - 40,
      by = Math.min(...ys) - 40,
      W = Math.max(...x2) - bx + 40,
      H = Math.max(...y2) - by + 40;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#050911"/>${vis.map((n) => `<rect x="${n.x - bx}" y="${n.y - by}" width="${n.w}" height="${n.h}" rx="6" fill="${n.color || "#1c2a3e"}" stroke="${n.borderColor || "rgba(255,255,255,.08)"}" stroke-width="1.5"/><foreignObject x="${n.x - bx + 8}" y="${n.y - by + 8}" width="${n.w - 16}" height="${n.h - 16}"><div xmlns="http://www.w3.org/1999/xhtml" style="font-size:${n.fontSize || 13}px;color:${n.textColor || "#fff"};font-family:sans-serif;word-break:break-word;font-weight:${n.fontWeight || "normal"}">${n.text || ""}</div></foreignObject>`).join("")}</svg>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.download = "boardai.svg";
    a.click();
  }

  function exportJSON() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify({ nodes: s.nodes, arrows: s.arrows, comments: s.comments }, null, 2)], { type: "application/json" }),
    );
    a.download = "boardai.json";
    a.click();
  }

  function exportPNG() {
    const vis = nodes.filter((n) => !n.hidden);
    if (!vis.length) return;
    const xs = vis.map((n) => n.x),
      ys = vis.map((n) => n.y),
      x2s = vis.map((n) => n.x + (n.w || 100)),
      y2s = vis.map((n) => n.y + (n.h || 60));
    const bx = Math.min(...xs) - 40,
      by = Math.min(...ys) - 40,
      W = Math.max(...x2s) - bx + 40,
      H = Math.max(...y2s) - by + 40;
    const sc = 2;
    const cv = document.createElement("canvas");
    cv.width = W * sc;
    cv.height = H * sc;
    const ctx = cv.getContext("2d");
    ctx.scale(sc, sc);
    ctx.fillStyle = "#050911";
    ctx.fillRect(0, 0, W, H);
    [...vis]
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
      .forEach((n) => {
        const x = n.x - bx,
          y = n.y - by,
          w = n.w || 100,
          h = n.h || 60;
        ctx.save();
        ctx.globalAlpha = n.opacity ?? 1;
        ctx.fillStyle = n.color || "#1c2a3e";
        ctx.strokeStyle = n.borderColor || "rgba(255,255,255,.1)";
        ctx.lineWidth = n.borderWidth || 1.5;
        const roundRect = () => {
          const r2 = 6;
          ctx.beginPath();
          ctx.moveTo(x + r2, y);
          ctx.lineTo(x + w - r2, y);
          ctx.arcTo(x + w, y, x + w, y + r2, r2);
          ctx.lineTo(x + w, y + h - r2);
          ctx.arcTo(x + w, y + h, x + w - r2, y + h, r2);
          ctx.lineTo(x + r2, y + h);
          ctx.arcTo(x, y + h, x, y + h - r2, r2);
          ctx.lineTo(x, y + r2);
          ctx.arcTo(x, y, x + r2, y, r2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };
        if (n.type === "shape") {
          const st = n.shapeType || "rect";
          if (st === "circle") {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else if (st === "diamond") {
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h / 2);
            ctx.lineTo(x + w / 2, y + h);
            ctx.lineTo(x, y + h / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (st === "triangle") {
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (st === "hexagon") {
            ctx.beginPath();
            ctx.moveTo(x + w * 0.25, y);
            ctx.lineTo(x + w * 0.75, y);
            ctx.lineTo(x + w, y + h * 0.5);
            ctx.lineTo(x + w * 0.75, y + h);
            ctx.lineTo(x + w * 0.25, y + h);
            ctx.lineTo(x, y + h * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (st === "parallelogram") {
            ctx.beginPath();
            ctx.moveTo(x + w * 0.16, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w * 0.84, y + h);
            ctx.lineTo(x, y + h);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (st === "cloud") {
            ctx.beginPath();
            ctx.moveTo(x + w * 0.18, y + h * 0.84);
            ctx.bezierCurveTo(x + w * 0.08, y + h * 0.84, x + w * 0.04, y + h * 0.66, x + w * 0.1, y + h * 0.56);
            ctx.bezierCurveTo(x + w * 0.05, y + h * 0.4, x + w * 0.12, y + h * 0.24, x + w * 0.24, y + h * 0.26);
            ctx.bezierCurveTo(x + w * 0.28, y + h * 0.12, x + w * 0.38, y + h * 0.07, x + w * 0.48, y + h * 0.16);
            ctx.bezierCurveTo(x + w * 0.56, y + h * 0.08, x + w * 0.68, y + h * 0.1, x + w * 0.73, y + h * 0.26);
            ctx.bezierCurveTo(x + w * 0.84, y + h * 0.24, x + w * 0.94, y + h * 0.36, x + w * 0.91, y + h * 0.54);
            ctx.bezierCurveTo(x + w * 0.97, y + h * 0.66, x + w * 0.91, y + h * 0.84, x + w * 0.8, y + h * 0.84);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (st === "cylinder") {
            const ry = Math.max(8, h * 0.1);
            ctx.beginPath();
            ctx.moveTo(x, y + ry);
            ctx.lineTo(x, y + h - ry);
            ctx.bezierCurveTo(x, y + h, x + w, y + h, x + w, y + h - ry);
            ctx.lineTo(x + w, y + ry);
            ctx.bezierCurveTo(x + w, y, x, y, x, y + ry);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + ry, w / 2, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h - ry, w / 2, ry, 0, 0, Math.PI);
            ctx.stroke();
          } else roundRect();
        } else if (n.type !== "image") roundRect();
        if (n.text) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = n.textColor || "#fff";
          const fw = n.fontWeight === "bold" || n.fontWeight === "700" ? "bold" : "normal";
          ctx.font = `${fw} ${n.fontSize || 13}px DM Sans,sans-serif`;
          ctx.textAlign = n.textAlign || "left";
          ctx.textBaseline = "top";
          const tx = n.textAlign === "center" ? x + w / 2 : x + 10;
          (n.text || "")
            .split("\n")
            .slice(0, 6)
            .forEach((line, li) => ctx.fillText(line.slice(0, 80), tx, y + 10 + li * (n.fontSize || 13) * 1.4, w - 16));
        }
        ctx.restore();
      });
    const a = document.createElement("a");
    a.href = cv.toDataURL("image/png");
    a.download = "boardai.png";
    a.click();
  }

  function importJSON(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => {
      try {
        const p = JSON.parse(ev.target.result);
        if (p.nodes) d({ type: "APPLY", nodes: p.nodes, arrows: p.arrows || [], replace: true });
      } catch {
        alert("Fi?ier invalid");
      }
    };
    r.readAsText(f);
    e.target.value = "";
  }
  const runMenuAction = (fn) => {
    setMenuOpen(false);
    if (typeof fn === "function") fn();
  };
  const zoomPct = Math.max(10, Math.round((zoom || 1) * 100));
  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify?.("Board link copied", "success");
    } catch {
      notify?.("Could not copy board link", "error");
    }
  }

  const frames = nodes.filter((n) => n.type === "frame");
  const barHeight = isMobile ? 56 : 62;
  const btnShell = {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 9,
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "'JetBrains Mono',monospace",
    border: `1px solid ${T.b1}`,
    background: T.bg3,
    color: T.t1,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  };
  const clusterShell = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: T.bg2,
    border: `1px solid ${T.b1}`,
    borderRadius: 11,
    padding: "4px",
    flexShrink: 0,
  };

  return (
    <header
      style={{
        height: barHeight,
        background: T.bg1,
        borderBottom: `1px solid ${T.b0}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 10px" : "0 18px",
        flexShrink: 0,
        zIndex: 100,
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
        <button
          onClick={onBoards}
          title="All boards"
          style={{
            background: T.bg2,
            border: `1px solid ${T.b1}`,
            color: T.t1,
            minHeight: 36,
            padding: "0 12px",
            borderRadius: 9,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = T.yDim;
            e.currentTarget.style.color = T.y;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = T.b1;
            e.currentTarget.style.color = T.t1;
          }}
        >
          {"<"} Boards
        </button>
        <span style={{ fontSize: 20, color: T.y, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>B</span>
        {editName ? (
          <input
            ref={nameRef}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveName();
              if (e.key === "Escape") {
                setNameVal(boardName || "Untitled Board");
                setEditName(false);
              }
            }}
            style={{
              background: T.bg3,
              border: `1px solid ${T.yDim}`,
              color: T.t0,
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: 15,
              fontFamily: "'DM Sans',sans-serif",
              outline: "none",
              width: isMobile ? 156 : 230,
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditName(true)}
            title="Double-click to rename"
            style={{
              fontWeight: 700,
              fontSize: 16,
              color: T.t0,
              letterSpacing: "-.02em",
              fontFamily: "'Instrument Serif',serif",
              cursor: "text",
              userSelect: "none",
              padding: "2px 4px",
              borderRadius: 4,
              maxWidth: isMobile ? 140 : 280,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = T.bg3)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {nameVal}
          </span>
        )}
        <span style={{ width: 1, height: 16, background: T.b0, margin: "0 2px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: isSaved ? T.green : T.y, animation: isSaved ? "none" : "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 9.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{isSaved ? "saved" : "saving…"}</span>
        </div>
        {!isMobile && <span style={{ fontSize: 9.5, color: T.t3, fontFamily: "'JetBrains Mono',monospace" }}>{visibleNodes.length}n·{arrows.length}c{sel.length ? `·${sel.length}sel` : ""}</span>}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 99, padding: "4px 10px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: ME.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: T.t1, fontFamily: "'JetBrains Mono',monospace" }}>{ME.name}</span>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {isMobile ? (
          <>
            <button onClick={() => d({ type: "UNDO" })} disabled={!hist.length} title="Undo" style={{ ...btnShell, minHeight: 34, padding: "0 10px", fontSize: 11, color: hist.length ? T.t1 : T.t3, cursor: hist.length ? "pointer" : "not-allowed", flexShrink: 0 }}>
              Undo
            </button>
            <button onClick={() => d({ type: "REDO" })} disabled={!fut.length} title="Redo" style={{ ...btnShell, minHeight: 34, padding: "0 10px", fontSize: 11, color: fut.length ? T.t1 : T.t3, cursor: fut.length ? "pointer" : "not-allowed", flexShrink: 0 }}>
              Redo
            </button>
            <button onClick={onToggleTools} style={{ ...btnShell, minHeight: 34, padding: "0 10px", fontSize: 11, background: toolsOpen ? T.yBg : T.bg3, border: `1px solid ${toolsOpen ? T.yDim : T.b1}`, color: toolsOpen ? T.y : T.t1, flexShrink: 0 }}>
              Insert
            </button>
            <button onClick={onToggleRight} style={{ ...btnShell, minHeight: 34, padding: "0 10px", fontSize: 11, background: rightOpen ? T.yBg : T.bg3, border: `1px solid ${rightOpen ? T.yDim : T.b1}`, color: rightOpen ? T.y : T.t1, flexShrink: 0 }}>
              Panel
            </button>
            <button onClick={onToggleMore} style={{ ...btnShell, minHeight: 34, padding: "0 10px", fontSize: 11, background: moreOpen ? T.yBg : T.bg3, border: `1px solid ${moreOpen ? T.yDim : T.b1}`, color: moreOpen ? T.y : T.t1, flexShrink: 0 }}>
              More
            </button>
          </>
        ) : (
          <>
            <div style={clusterShell}>
              <button onClick={() => d({ type: "UNDO" })} disabled={!hist.length} title="Undo (Ctrl+Z)" style={{ ...btnShell, color: hist.length ? T.t1 : T.t3, cursor: hist.length ? "pointer" : "not-allowed" }}>
                Undo
              </button>
              <button onClick={() => d({ type: "REDO" })} disabled={!fut.length} title="Redo (Ctrl+Y)" style={{ ...btnShell, color: fut.length ? T.t1 : T.t3, cursor: fut.length ? "pointer" : "not-allowed" }}>
                Redo
              </button>
            </div>
            <div style={clusterShell}>
              <div style={{ display: "flex", alignItems: "center", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 9, overflow: "hidden", flexShrink: 0 }}>
                <button onClick={() => d({ type: "ZOOM", v: (zoom || 1) * 0.9 })} title="Zoom out" style={{ background: "transparent", border: "none", color: T.t1, minHeight: 36, padding: "0 9px", fontSize: 13, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
                  -
                </button>
                <span style={{ minWidth: 54, textAlign: "center", fontSize: 12, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{zoomPct}%</span>
                <button onClick={() => d({ type: "ZOOM", v: (zoom || 1) * 1.1 })} title="Zoom in" style={{ background: "transparent", border: "none", color: T.t1, minHeight: 36, padding: "0 9px", fontSize: 13, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
                  +
                </button>
              </div>
              <button onClick={() => d({ type: "ZOOM_FIT", vw: window.innerWidth, vh: window.innerHeight - barHeight })} title="Fit to screen" style={btnShell}>
                Fit
              </button>
              <button onClick={onSearch} title="Ctrl+K" style={{ ...btnShell, display: "flex", alignItems: "center", gap: 6 }}>
                Search <span style={{ fontSize: 10, color: T.t2 }}>Ctrl+K</span>
              </button>
              <button onClick={onTpl} style={btnShell}>
                Templates
              </button>
              <button onClick={onToggleTheme} title="Toggle Light/Dark" style={btnShell}>
                {themeMode === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              {frames.length > 0 && (
                <button onClick={onPresent} style={{ ...btnShell, background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, fontWeight: 700 }}>
                  Present
                </button>
              )}
            </div>
            <div style={clusterShell}>
              <button onClick={copyShareLink} title="Copy board link" style={btnShell}>
                Share
              </button>
              <button onClick={onToggleRight} title="Open inspector and collaborators" style={{ ...btnShell, background: rightOpen ? T.yBg : T.bg3, border: `1px solid ${rightOpen ? T.yDim : T.b1}`, color: rightOpen ? T.y : T.t1 }}>
                Inspector
              </button>
              <button onClick={onToggleMinimap} title="Toggle minimap" style={{ ...btnShell, background: showMinimap ? T.yBg : T.bg3, border: `1px solid ${showMinimap ? T.yDim : T.b1}`, color: showMinimap ? T.y : T.t1 }}>
                Minimap
              </button>
              <button onClick={onToggleTimeline} title="Toggle execution timeline" style={{ ...btnShell, background: showTimeline ? T.yBg : T.bg3, border: `1px solid ${showTimeline ? T.yDim : T.b1}`, color: showTimeline ? T.y : T.t1 }}>
                Timeline
              </button>
              <div ref={menuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  title="Import/Export menu"
                  style={{ ...btnShell, background: menuOpen ? T.yBg : T.bg3, border: `1px solid ${menuOpen ? T.yDim : T.b1}`, color: menuOpen ? T.y : T.t1 }}
                >
                  Export
                </button>
                {menuOpen && (
                  <div className="pop" style={{ position: "absolute", right: 0, top: 42, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 10, padding: 6, minWidth: 196, boxShadow: "0 10px 30px rgba(0,0,0,.55)", zIndex: 450 }}>
                    {[["Import JSON", () => impRef.current?.click()], ["Share link", copyShareLink], ["Toggle Timeline", onToggleTimeline], ["divider"], ["Export SVG", exportSVG], ["Export PNG", exportPNG], ["Export JSON", exportJSON]].map((entry, idx) =>
                      entry[0] === "divider" ? (
                        <div key={`mdiv-${idx}`} style={{ height: 1, background: T.b0, margin: "5px 2px" }} />
                      ) : (
                        <button key={entry[0]} onClick={() => runMenuAction(entry[1])} style={{ width: "100%", display: "block", textAlign: "left", background: "transparent", border: "none", color: T.t0, padding: "8px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }} onMouseEnter={(e) => (e.currentTarget.style.background = T.bg3)} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                          {entry[0]}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        <input ref={impRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
      </div>
    </header>
  );
}
