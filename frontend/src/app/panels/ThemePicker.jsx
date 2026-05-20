export default function ThemePickerView({ onClose, s, d, T, themes = [], notify }) {
  return (
    <div className="pop" style={{ position: "absolute", top: 50, right: 20, background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 14, padding: 14, zIndex: 600, width: 280, boxShadow: "0 16px 48px rgba(0,0,0,.7)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>* CANVAS THEME</span>
        <button onClick={onClose} style={{ background: "none", border: "none", color: T.t2, fontSize: 14, cursor: "pointer" }}>
          x
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>
        {themes.map((th) => (
          <button
            key={th.id}
            onClick={() => {
              d({ type: "SET_THEME", v: th.id });
              notify?.(`Theme: ${th.name}`);
              onClose();
            }}
            style={{ background: th.bg, border: `2px solid ${s.canvasTheme === th.id ? T.y : th.grid}`, borderRadius: 8, padding: "10px 8px", cursor: "pointer", textAlign: "left", transition: "all .15s" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.y)}
            onMouseLeave={(e) => {
              if (s.canvasTheme !== th.id) e.currentTarget.style.borderColor = th.grid;
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: th.id.startsWith("light") || th.id === "paper" ? "#333" : T.t0, marginBottom: 2 }}>{th.name}</div>
            <div style={{ fontSize: 8, color: th.id.startsWith("light") || th.id === "paper" ? "#888" : T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{th.label}</div>
            <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
              {[th.bg, th.grid, th.gridSnap].map((c, i) => (
                <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c, border: "1px solid rgba(255,255,255,.1)" }} />
              ))}
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          d({ type: "SET_BG", v: null });
          d({ type: "SET_THEME", v: null });
          notify?.("Theme reset");
          onClose();
        }}
        style={{ width: "100%", marginTop: 8, background: T.bg3, border: `1px solid ${T.b1}`, color: T.t2, padding: "6px", borderRadius: 6, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}
      >
        Reset to default
      </button>
    </div>
  );
}
