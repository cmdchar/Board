export default function ShortcutsPanelView({ onClose, isMobile = false, T }) {
  const groups = [
    ["Tools", "V Select · H Pan · S Sticky · T Text · A Arrow · P Draw · M Comment · F Frame · G Vote · L Laser · E Eraser"],
    ["Shapes", "R Rect · C Circle · D Diamond · Y Triangle · X Hexagon · Q Parallelogram · U Cloud · I Cylinder · B Table · J Lane H · K Lane V"],
    ["Editing", "N New node · T Text · C Connector tool · Ctrl+Z Undo · Ctrl+D Duplicate · Ctrl+C Copy · Ctrl+V Paste · Del/? Delete"],
    ["Organization", "Ctrl+G Group · Ctrl+Shift+G Ungroup · Ctrl+Shift+L Auto-layout · Tab Add child · Enter Add sibling"],
    ["Canvas", "Ctrl+K Search · ? Shortcuts · = Zoom in · - Zoom out · Ctrl+Shift+H Fit all · Ctrl+Shift+D Dep mode"],
    ["Navigation", "Arrow keys Nudge 8px · Shift+Arrow Nudge 1px · Scroll Wheel Pan · Ctrl+Wheel Zoom · Middle-click Pan"],
    ["Advanced", "Alt+Drag Duplicate · Shift+Resize Proportional · Ctrl+Click Open link · Double-click New sticky · Right-click Context menu"],
  ];
  return (
    <div className="pop" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(6px)", animation: "shineIn .2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.bg1, border: `1px solid ${T.b2}`, borderRadius: 20, padding: isMobile ? "18px 14px" : "28px 32px", width: "100%", maxWidth: isMobile ? "96vw" : 680, maxHeight: "80vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18, color: T.y }}>KEY</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.t0, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".04em" }}>KEYBOARD SHORTCUTS</span>
          </div>
          <button onClick={onClose} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t2, width: 28, height: 28, borderRadius: 7, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
            x
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(2,1fr)", gap: 16 }}>
          {groups.map(([title, shortcuts]) => (
            <div key={title} style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace", marginBottom: 10, letterSpacing: ".06em" }}>{title}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {shortcuts.split(" · ").map((s, i) => {
                  const parts = s.split(" ");
                  const key = parts[0];
                  const desc = parts.slice(1).join(" ");
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: T.t1, marginBottom: 2, width: "100%" }}>
                      <span style={{ background: T.bg3, border: `1px solid ${T.b0}`, padding: "1px 5px", borderRadius: 4, fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: T.t0, fontWeight: 600, minWidth: 24, textAlign: "center", flexShrink: 0 }}>{key}</span>
                      <span style={{ color: T.t2, fontSize: 10 }}>{desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, fontSize: 10, color: T.t2, textAlign: "center", fontFamily: "'JetBrains Mono',monospace" }}>Press ? or Esc to close</div>
      </div>
    </div>
  );
}
