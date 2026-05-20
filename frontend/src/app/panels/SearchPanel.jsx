import { useEffect, useRef, useState } from "react";

export default function SearchPanelView({ onClose, s, d, isMobile = false, T }) {
  const [q, setQ] = useState("");
  const r = useRef(null);
  useEffect(() => r.current?.focus(), []);
  const results =
    q.trim().length > 1 ? s.nodes.filter((n) => !n.hidden && n.text?.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  function goTo(node) {
    d({ type: "SEL", v: [node.id] });
    d({ type: "PAN", x: -node.x * s.zoom + window.innerWidth / 2 - (node.w / 2) * s.zoom, y: -node.y * s.zoom + window.innerHeight / 2 - (node.h / 2) * s.zoom });
    onClose();
  }
  return (
    <div
      className="pop"
      style={{
        position: "absolute",
        top: 64,
        left: "50%",
        transform: "translateX(-50%)",
        background: T.bg2,
        border: `1px solid ${T.b2}`,
        borderRadius: 14,
        padding: 14,
        zIndex: 600,
        width: isMobile ? "min(92vw,400px)" : 400,
        boxShadow: "0 16px 48px rgba(0,0,0,.7)",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
        <span style={{ fontSize: 14, color: T.t2 }}>S</span>
        <input ref={r} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cauta în noduri…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.t0, fontSize: 14, fontFamily: "'DM Sans',sans-serif" }} />
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.t2, fontSize: 16, cursor: "pointer" }}>
          x
        </button>
      </div>
      {results.length > 0 && (
        <div style={{ borderTop: `1px solid ${T.b0}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          {results.map((n) => (
            <button
              key={n.id}
              onClick={() => goTo(n)}
              style={{
                background: T.bg3,
                border: `1px solid ${T.b1}`,
                borderRadius: 8,
                padding: "8px 12px",
                cursor: "pointer",
                textAlign: "left",
                color: T.t0,
                fontSize: 12,
                fontFamily: "'DM Sans',sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "all .1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.yDim;
                e.currentTarget.style.color = T.y;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.b1;
                e.currentTarget.style.color = T.t0;
              }}
            >
              <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>{n.type === "sticky" ? "STK" : n.type === "text" ? "TXT" : n.type === "lane" ? "LNE" : "NOD"}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text?.slice(0, 60) || "(gol)"}</span>
              <span style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{n.type}</span>
            </button>
          ))}
        </div>
      )}
      {q.length > 1 && results.length === 0 && <p style={{ color: T.t2, fontSize: 12, textAlign: "center", padding: "8px 0" }}>Nimic gasit pentru "{q}"</p>}
      <div style={{ marginTop: 10, fontSize: 10, color: T.t2, textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>Ctrl+K pentru a deschide · Esc pentru a închide</div>
    </div>
  );
}
