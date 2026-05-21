export default function MinimapView({ s, d, onClose, rightInset = 300, T }) {
  const { nodes, zoom, px, py } = s;
  const vis = nodes.filter((n) => !n.hidden);
  if (vis.length === 0) return null;
  const W = 160,
    H = 96;
  const xs = vis.map((n) => n.x),
    ys = vis.map((n) => n.y),
    x2s = vis.map((n) => n.x + (n.w || 100)),
    y2s = vis.map((n) => n.y + (n.h || 60));
  const bx = Math.min(...xs) - 30,
    by = Math.min(...ys) - 30,
    bw = Math.max(...x2s) - bx + 30,
    bh = Math.max(...y2s) - by + 30;
  const sc = Math.min(W / bw, H / bh, 0.8);
  const vpW = window.innerWidth / zoom,
    vpH = window.innerHeight / zoom,
    vpX = -px / zoom,
    vpY = -py / zoom;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 74,
        right: rightInset,
        width: W,
        height: H,
        background: `${T.bg2}dd`,
        border: `1px solid ${T.b2}`,
        borderRadius: 14,
        overflow: "hidden",
        zIndex: 60,
        boxShadow: "0 12px 32px rgba(0,0,0,.4)",
        cursor: "crosshair",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const mx = (e.clientX - r.left) / sc + bx,
          my = (e.clientY - r.top) / sc + by;
        d({ type: "PAN", x: -mx * zoom + window.innerWidth / 2, y: -my * zoom + window.innerHeight / 2 });
      }}
    >
      <svg width={W} height={H}>
        {vis.map((n) => (
          <rect key={n.id} x={(n.x - bx) * sc} y={(n.y - by) * sc} width={Math.max(2, (n.w || 100) * sc)} height={Math.max(2, (n.h || 60) * sc)} fill={n.type === "sticky" ? n.color : n.color || T.bg3} opacity={0.8} rx={1} />
        ))}
        <rect x={Math.max(0, (vpX - bx) * sc)} y={Math.max(0, (vpY - by) * sc)} width={Math.min(W, vpW * sc)} height={Math.min(H, vpH * sc)} fill="none" stroke={T.y} strokeWidth={1} opacity={0.6} />
      </svg>
      <div style={{ position: "absolute", top: 3, left: 5, fontSize: 9, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>minimap</div>
      {onClose && (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close minimap" style={{ position: "absolute", top: 3, right: 4, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, borderRadius: 6, fontSize: 11, cursor: "pointer", lineHeight: 1, padding: 0 }}>
          x
        </button>
      )}
    </div>
  );
}
