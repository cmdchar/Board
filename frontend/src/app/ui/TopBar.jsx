import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
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
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, overflow: "hidden" }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBoards}
          title="All boards"
          style={{
            background: T.bg2,
            border: `1px solid ${T.b1}`,
            color: T.t1,
            minHeight: 36,
            padding: "0 14px",
            borderRadius: 10,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
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
          <span style={{ fontSize: 14 }}>←</span> Boards
        </motion.button>
        <motion.span
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: 24, color: T.y, display: "inline-block", fontWeight: 900, textShadow: "0 0 10px rgba(250,204,21,0.3)" }}
        >
          B
        </motion.span>
        {editName ? (
          <motion.input
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
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
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 15,
              fontFamily: "'DM Sans',sans-serif",
              outline: "none",
              width: isMobile ? 156 : 240,
              boxShadow: `0 0 0 2px ${T.y}22`,
            }}
          />
        ) : (
          <motion.span
            whileHover={{ backgroundColor: T.bg3 }}
            onDoubleClick={() => setEditName(true)}
            title="Double-click to rename"
            style={{
              fontWeight: 700,
              fontSize: 18,
              color: T.t0,
              letterSpacing: "-.02em",
              fontFamily: "'Instrument Serif',serif",
              cursor: "text",
              userSelect: "none",
              padding: "4px 8px",
              borderRadius: 6,
              maxWidth: isMobile ? 140 : 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              transition: "background-color 0.2s",
            }}
          >
            {nameVal}
          </motion.span>
        )}
        <span style={{ width: 1, height: 20, background: T.b0, margin: "0 4px" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <motion.div
            animate={{ scale: isSaved ? 1 : [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: isSaved ? 0 : Infinity }}
            style={{ width: 6, height: 6, borderRadius: "50%", background: isSaved ? T.green : T.y }}
          />
          <span style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.05em" }}>
            {isSaved ? "SAVED" : "SAVING…"}
          </span>
        </div>
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 8 }}>
            <span style={{ fontSize: 10, color: T.t3, fontFamily: "'JetBrains Mono',monospace", opacity: 0.7 }}>
              {visibleNodes.length} nodes · {arrows.length} connections
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 20, padding: "3px 12px", boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: ME.color, flexShrink: 0, boxShadow: `0 0 8px ${ME.color}66` }} />
              <span style={{ fontSize: 11, color: T.t1, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{ME.name}</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {isMobile ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => d({ type: "UNDO" })} disabled={!hist.length} style={{ ...btnShell, minHeight: 34, padding: "0 12px" }}>
              Undo
            </button>
            <button onClick={onToggleTools} style={{ ...btnShell, minHeight: 34, background: toolsOpen ? T.yBg : T.bg3, border: `1px solid ${toolsOpen ? T.yDim : T.b1}`, color: toolsOpen ? T.y : T.t1 }}>
              Insert
            </button>
            <button onClick={onToggleRight} style={{ ...btnShell, minHeight: 34, background: rightOpen ? T.yBg : T.bg3, border: `1px solid ${rightOpen ? T.yDim : T.b1}`, color: rightOpen ? T.y : T.t1 }}>
              Panel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={clusterShell}>
              <motion.button whileHover={{ y: -1 }} whileTap={{ y: 0 }} onClick={() => d({ type: "UNDO" })} disabled={!hist.length} title="Undo (Ctrl+Z)" style={{ ...btnShell, color: hist.length ? T.t1 : T.t3 }}>
                Undo
              </motion.button>
              <motion.button whileHover={{ y: -1 }} whileTap={{ y: 0 }} onClick={() => d({ type: "REDO" })} disabled={!fut.length} title="Redo (Ctrl+Y)" style={{ ...btnShell, color: fut.length ? T.t1 : T.t3 }}>
                Redo
              </motion.button>
            </div>

            <div style={clusterShell}>
              <div style={{ display: "flex", alignItems: "center", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 9, overflow: "hidden" }}>
                <button onClick={() => d({ type: "ZOOM", v: (zoom || 1) * 0.9 })} style={{ background: "transparent", border: "none", color: T.t1, minHeight: 36, padding: "0 10px", cursor: "pointer" }}>-</button>
                <span style={{ minWidth: 50, textAlign: "center", fontSize: 11, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{zoomPct}%</span>
                <button onClick={() => d({ type: "ZOOM", v: (zoom || 1) * 1.1 })} style={{ background: "transparent", border: "none", color: T.t1, minHeight: 36, padding: "0 10px", cursor: "pointer" }}>+</button>
              </div>
              <motion.button whileHover={{ y: -1 }} onClick={onSearch} title="Ctrl+K" style={{ ...btnShell, padding: "0 14px", background: T.bg3 }}>
                Search <span style={{ opacity: 0.5, fontSize: 10, marginLeft: 6 }}>⌘K</span>
              </motion.button>
              <button onClick={onTpl} style={btnShell}>Templates</button>
              <button onClick={onToggleTheme} style={btnShell}>
                {themeMode === "dark" ? "Light" : "Dark"}
              </button>
              {frames.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  onClick={onPresent}
                  style={{ ...btnShell, background: T.yBg, borderColor: T.yDim, color: T.y, fontWeight: 700, padding: "0 16px" }}
                >
                  Present
                </motion.button>
              )}
            </div>

            <div style={clusterShell}>
              <button onClick={copyShareLink} style={btnShell}>Share</button>
              <button
                onClick={onToggleRight}
                style={{ ...btnShell, background: rightOpen ? T.yBg : T.bg3, borderColor: rightOpen ? T.yDim : T.b1, color: rightOpen ? T.y : T.t1 }}
              >
                Inspector
              </button>
              <div ref={menuRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  style={{ ...btnShell, background: menuOpen ? T.yBg : T.bg3, borderColor: menuOpen ? T.yDim : T.b1, color: menuOpen ? T.y : T.t1 }}
                >
                  Export
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      style={{
                        position: "absolute", right: 0, top: 44,
                        background: T.bg2, border: `1px solid ${T.b2}`,
                        borderRadius: 12, padding: 6, minWidth: 200,
                        boxShadow: "0 10px 40px rgba(0,0,0,0.4)", zIndex: 450
                      }}
                    >
                      {[
                        ["Import JSON", () => impRef.current?.click()],
                        ["Share link", copyShareLink],
                        ["divider"],
                        ["Export SVG", exportSVG],
                        ["Export PNG", exportPNG],
                        ["Export JSON", exportJSON]
                      ].map((entry, idx) =>
                        entry[0] === "divider" ? (
                          <div key={`mdiv-${idx}`} style={{ height: 1, background: T.b0, margin: "6px 4px" }} />
                        ) : (
                          <button
                            key={entry[0]}
                            onClick={() => runMenuAction(entry[1])}
                            style={{
                              width: "100%", textAlign: "left", background: "transparent",
                              border: "none", color: T.t0, padding: "10px 12px",
                              borderRadius: 8, fontSize: 13, cursor: "pointer",
                              fontFamily: "'DM Sans',sans-serif"
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = T.bg3)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {entry[0]}
                          </button>
                        )
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}
        <input ref={impRef} type="file" accept=".json" onChange={importJSON} style={{ display: "none" }} />
      </div>
    </motion.header>
  );
}
