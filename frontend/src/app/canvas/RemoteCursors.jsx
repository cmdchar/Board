export default function RemoteCursorsView({ users = [], T }) {
  const now = Date.now();
  const list = (Array.isArray(users) ? users : []).filter((c) => Number.isFinite(Number(c?.x)) && Number.isFinite(Number(c?.y)) && now - Number(c?.ts || 0) < 9000);
  return (
    <>
      {list.map((c) => {
        const age = Math.max(0, now - Number(c.ts || now));
        const labelVisible = age < 2600;
        const opacity = Math.max(0.2, 1 - age / 9000);
        return (
          <div key={c.socketId} style={{ position: "absolute", left: c.x, top: c.y, pointerEvents: "none", zIndex: 999, transform: "translate(-2px,-2px)", opacity }}>
            <svg width="14" height="18" viewBox="0 0 14 18">
              <path d="M0 0 L14 9 L8 11 L5.5 18 L0 0Z" fill={c.color || T.y} stroke="rgba(255,255,255,.7)" strokeWidth="1" />
            </svg>
            {labelVisible && (
              <div style={{ position: "absolute", top: 16, left: 8, background: c.color || T.y, color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(0,0,0,.4)", fontWeight: 600 }}>
                {c.name || "User"}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
