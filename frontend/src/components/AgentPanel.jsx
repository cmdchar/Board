export default function AgentPanel({ T, agents }) {
  return (
    <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "10px 12px", background: T.bg1, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: T.y, letterSpacing: ".06em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>AI AGENTS</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.t2 }}>{agents.busyAgent ? `${agents.busyAgent} running...` : "idle"}</span>
      </div>

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Planner Agent</div>
        <input
          value={agents.plannerPrompt}
          onChange={e => agents.setPlannerPrompt(e.target.value)}
          placeholder="ex: plan launch MVP in 3 milestones"
          style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 9px", fontSize: 11.5 }}
        />
        <button
          onClick={agents.runPlanner}
          disabled={Boolean(agents.busyAgent) || !String(agents.plannerPrompt || "").trim()}
          style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${Boolean(agents.busyAgent) || !String(agents.plannerPrompt || "").trim() ? T.b1 : T.yDim}`, background: Boolean(agents.busyAgent) || !String(agents.plannerPrompt || "").trim() ? T.bg3 : T.yBg, color: Boolean(agents.busyAgent) || !String(agents.plannerPrompt || "").trim() ? T.t2 : T.y, cursor: Boolean(agents.busyAgent) || !String(agents.plannerPrompt || "").trim() ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}
        >
          Run Planner Agent
        </button>
      </div>

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Research Agent</div>
        <input
          value={agents.researchPrompt}
          onChange={e => agents.setResearchPrompt(e.target.value)}
          placeholder="optional topic override"
          style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 9px", fontSize: 11.5 }}
        />
        <button
          onClick={agents.runResearch}
          disabled={Boolean(agents.busyAgent) || !agents.canResearch}
          style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${Boolean(agents.busyAgent) || !agents.canResearch ? T.b1 : T.yDim}`, background: Boolean(agents.busyAgent) || !agents.canResearch ? T.bg3 : T.yBg, color: Boolean(agents.busyAgent) || !agents.canResearch ? T.t2 : T.y, cursor: Boolean(agents.busyAgent) || !agents.canResearch ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}
        >
          Run Research Agent
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 6 }}>
        <button onClick={agents.runConnectorAgent} disabled={Boolean(agents.busyAgent)} style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${Boolean(agents.busyAgent) ? T.b1 : T.yDim}`, background: Boolean(agents.busyAgent) ? T.bg3 : T.yBg, color: Boolean(agents.busyAgent) ? T.t2 : T.y, cursor: Boolean(agents.busyAgent) ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>Connector Agent</button>
        <button onClick={agents.runRiskAgent} disabled={Boolean(agents.busyAgent)} style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${Boolean(agents.busyAgent) ? T.b1 : T.yDim}`, background: Boolean(agents.busyAgent) ? T.bg3 : T.yBg, color: Boolean(agents.busyAgent) ? T.t2 : T.y, cursor: Boolean(agents.busyAgent) ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>Risk Agent</button>
      </div>

      {agents.lastError && <div style={{ fontSize: 11, color: T.red }}>{agents.lastError}</div>}

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Agent Action History</div>
        <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
          {(agents.history || []).slice(0, 80).map(item => (
            <div key={item.id} style={{ border: `1px solid ${T.b0}`, borderRadius: 8, background: T.bg1, padding: "6px 8px", display: "grid", gap: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace" }}>{item.agent}</span>
                <span style={{ marginLeft: "auto", fontSize: 9.5, color: item.status === "approved" ? "#86efac" : item.status === "pending" ? T.y : T.t3 }}>{item.status}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.t0, fontWeight: 600 }}>{item.title}</div>
              {item.summary && <div style={{ fontSize: 10.5, color: T.t1 }}>{item.summary}</div>}
              <div style={{ display: "flex", gap: 6 }}>
                {item.status === "pending" && <>
                  <button onClick={() => agents.approveAction(item.id)} style={{ minHeight: 28, borderRadius: 7, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, padding: "0 8px" }}>Approve</button>
                  <button onClick={() => agents.rejectAction(item.id)} style={{ minHeight: 28, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", padding: "0 8px" }}>Reject</button>
                </>}
                {item.status === "approved" && <button onClick={() => agents.undoAction(item.id)} style={{ minHeight: 28, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", padding: "0 8px" }}>Undo</button>}
              </div>
            </div>
          ))}
          {(!agents.history || agents.history.length === 0) && <div style={{ fontSize: 11, color: T.t2 }}>No agent actions yet.</div>}
        </div>
      </div>
    </div>
  );
}