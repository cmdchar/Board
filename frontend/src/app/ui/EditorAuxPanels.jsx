export function PresentBarView({ onExit, frames, curIdx, setCurIdx, T }) {
  return <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(5,9,17,.9)", border: `1px solid ${T.b2}`, borderRadius: 99, padding: "8px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 900, backdropFilter: "blur(12px)" }}>
    <button onClick={() => setCurIdx((i) => Math.max(0, i - 1))} disabled={curIdx === 0} style={{ background: "transparent", border: "none", color: curIdx === 0 ? T.t3 : T.t0, fontSize: 18, cursor: curIdx === 0 ? "not-allowed" : "pointer", lineHeight: 1 }}>{"<"}</button>
    <span style={{ fontSize: 12, color: T.t1, fontFamily: "'JetBrains Mono',monospace" }}>{curIdx + 1} / {frames.length}</span>
    <span style={{ fontSize: 12, color: T.y, fontWeight: 600 }}>{frames[curIdx]?.text || "Frame"}</span>
    <button onClick={() => setCurIdx((i) => Math.min(frames.length - 1, i + 1))} disabled={curIdx === frames.length - 1} style={{ background: "transparent", border: "none", color: curIdx === frames.length - 1 ? T.t3 : T.t0, fontSize: 18, cursor: curIdx === frames.length - 1 ? "not-allowed" : "pointer", lineHeight: 1 }}>{">"}</button>
    <div style={{ width: 1, height: 20, background: T.b1 }} />
    <button onClick={onExit} style={{ background: "transparent", border: "none", color: T.red, fontSize: 13, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>EXIT</button>
  </div>;
}

export function EditorOnboardingOverlayView({
  isMobile = false,
  onClose,
  onUsePreset,
  onOpenTemplates,
  onGenerateAi,
  aiPrompt,
  setAiPrompt,
  aiBusy = false,
  quickStartPresets,
  T,
}) {
  return <div className="onboarding-overlay">
    <div className="onboarding-card pop">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 20, color: T.y }}>AI</span>
        <div>
          <div className="ui-title" style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, lineHeight: 1.05 }}>Welcome to your board</div>
          <div className="ui-muted">Get value in under a minute with AI or a quick-start preset.</div>
        </div>
      </div>
      <div className="onboarding-grid" style={{ marginTop: 12 }}>
        {quickStartPresets.map((preset) => <button key={preset.id} className="ui-btn" onClick={() => onUsePreset?.(preset.id)}>{preset.label}</button>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 8, marginTop: 12 }}>
        <input
          value={aiPrompt}
          onChange={(e) => setAiPrompt?.(e.target.value)}
          placeholder="Describe what you want to plan..."
          style={{ minHeight: 40, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none" }}
        />
        <button className="ui-btn ui-btn-primary" disabled={aiBusy || !String(aiPrompt || "").trim()} onClick={() => onGenerateAi?.(aiPrompt)}>
          {aiBusy ? "Generating..." : "Generate board with AI"}
        </button>
        <button className="ui-btn" onClick={onOpenTemplates}>Add template</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 10 }}>
        <div className="ui-muted">Tip: Double-click the canvas to drop a sticky note instantly.</div>
        <button className="ui-btn" style={{ minHeight: 34, padding: "0 10px" }} onClick={onClose}>Skip</button>
      </div>
    </div>
  </div>;
}

export function EmptyBoardPromptView({ onGenerateAi, onOpenTemplates, onBrainstorm, aiPrompt, setAiPrompt, aiBusy = false, T }) {
  return <div className="canvas-empty pop">
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 18, color: T.y }}>AI</span>
      <div className="ui-title" style={{ fontSize: 30, fontWeight: 800 }}>Start creating</div>
    </div>
    <div style={{ marginTop: 4, color: T.t1, fontSize: 13, lineHeight: 1.6 }}>
      Empty boards should never feel empty. Start by describing what you want to plan.
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 12 }}>
      <input
        value={aiPrompt}
        onChange={(e) => setAiPrompt?.(e.target.value)}
        placeholder="Example: Q2 product launch strategy"
        style={{ minHeight: 40, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 13, outline: "none" }}
      />
      <button className="ui-btn ui-btn-primary" disabled={aiBusy || !String(aiPrompt || "").trim()} onClick={() => onGenerateAi?.(aiPrompt)}>
        {aiBusy ? "Generating..." : "Generate board with AI"}
      </button>
    </div>
    <div className="canvas-empty-actions">
      <button className="ui-btn" onClick={onOpenTemplates}>Add template</button>
      <button className="ui-btn ui-btn-accent" onClick={onBrainstorm}>Start brainstorming</button>
    </div>
  </div>;
}
