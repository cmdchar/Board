import { useMemo, useState } from "react";

function scoreTone(score, T) {
  if (score >= 85) return { color: "#86efac", bg: "rgba(34,197,94,.15)", border: "rgba(34,197,94,.35)" };
  if (score >= 65) return { color: T.y, bg: T.yBg, border: T.yDim };
  return { color: "#fca5a5", bg: "rgba(239,68,68,.14)", border: "rgba(239,68,68,.4)" };
}

function StatusBadge({ status }) {
  const map = {
    "Todo": { bg: "#fef3c7", fg: "#92400e" },
    "In Progress": { bg: "#dbeafe", fg: "#1e3a8a" },
    "Blocked": { bg: "#fee2e2", fg: "#991b1b" },
    "Done": { bg: "#dcfce7", fg: "#166534" },
  };
  const tone = map[status] || map.Todo;
  return <span style={{ background: tone.bg, color: tone.fg, borderRadius: 999, padding: "2px 8px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{status}</span>;
}

function HeaderRow({ title, right, T }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ fontSize: 10, color: T.y, letterSpacing: ".07em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{title}</div>
    <div style={{ flex: 1, height: 1, background: T.b0 }} />
    {right}
  </div>;
}

export default function ExecutionPanel({ T, execution, onToggleTimeline, timelineOpen = false }) {
  const [selectedTaskNodeId, setSelectedTaskNodeId] = useState("");
  const [ghLink, setGhLink] = useState("");
  const [jiraLink, setJiraLink] = useState("");

  const tone = scoreTone(execution.healthScore || 0, T);
  const selectedTask = useMemo(
    () => execution.tasks.find(task => task.nodeId === selectedTaskNodeId) || null,
    [execution.tasks, selectedTaskNodeId],
  );

  return <div style={{ borderBottom: `1px solid ${T.b0}`, background: T.bg1, padding: "10px 12px", display: "grid", gap: 10 }}>
    <HeaderRow title="EXECUTION INTELLIGENCE" T={T} right={<button onClick={onToggleTimeline} style={{ height: 28, padding: "0 10px", borderRadius: 8, border: `1px solid ${timelineOpen ? T.yDim : T.b1}`, background: timelineOpen ? T.yBg : T.bg2, color: timelineOpen ? T.y : T.t1, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{timelineOpen ? "Timeline ON" : "Timeline"}</button>} />

    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", padding: "8px 9px", borderRadius: 10, background: T.bg2, border: `1px solid ${T.b1}` }}>
      <div style={{ minWidth: 62, textAlign: "center", borderRadius: 8, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, fontSize: 18, fontFamily: "'JetBrains Mono',monospace", fontWeight: 800, padding: "5px 8px" }}>
        {execution.healthScore}
      </div>
      <div style={{ fontSize: 11.5, color: T.t1, lineHeight: 1.45 }}>
        <div style={{ fontSize: 12.5, color: T.t0, fontWeight: 700 }}>Execution Health Score</div>
        <div>{execution.stats.doneTasks}/{execution.stats.totalTasks} done � {execution.stats.blockedTasks} blocked � {execution.stats.overdueTasks} overdue</div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <button onClick={() => execution.addTask()} style={{ minHeight: 32, borderRadius: 8, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>+ Task</button>
        <button onClick={() => execution.addMilestone()} style={{ minHeight: 32, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace" }}>+ Milestone</button>
        <button onClick={() => execution.addDecision()} style={{ minHeight: 32, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace" }}>+ Decision</button>
      </div>
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <HeaderRow title={`BLOCKER RADAR (${execution.warnings.length})`} T={T} />
      {execution.warnings.length === 0 && <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: "#86efac", background: T.bg2 }}>No active blockers detected.</div>}
      {execution.warnings.slice(0, 6).map((warning, idx) => (
        <button key={`${warning.type}-${idx}`} onClick={() => warning.nodeId && execution.focusNode(warning.nodeId)} style={{ textAlign: "left", minHeight: 36, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: warning.nodeId ? "pointer" : "default", fontSize: 11, padding: "6px 8px" }}>
          {warning.message}
        </button>
      ))}
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <HeaderRow title={`TASKS (${execution.tasks.length})`} T={T} />
      <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
        {execution.tasks.length === 0 && <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: T.t2, background: T.bg2 }}>No tasks yet. Use + Task or Meeting Autopilot.</div>}
        {execution.tasks.map(task => (
          <div key={task.nodeId} style={{ border: `1px solid ${selectedTaskNodeId === task.nodeId ? T.yDim : T.b1}`, borderRadius: 8, background: T.bg2, padding: "7px 8px", display: "grid", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setSelectedTaskNodeId(task.nodeId); execution.focusNode(task.nodeId); setGhLink(task.githubUrl || ""); setJiraLink(task.jiraUrl || ""); }} style={{ flex: 1, textAlign: "left", background: "transparent", border: "none", color: T.t0, cursor: "pointer", padding: 0, fontSize: 12, fontWeight: 600 }}>{task.title}</button>
              <StatusBadge status={task.status} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <select value={task.status} onChange={e => execution.updateNode(task.nodeId, { executionStatus: e.target.value })} style={{ minHeight: 30, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 8px", fontSize: 11 }}>
                {["Todo", "In Progress", "Blocked", "Done"].map(st => <option key={st} value={st}>{st}</option>)}
              </select>
              <input type="date" value={task.dueDate === "TBD" ? "" : task.dueDate} onChange={e => execution.updateTaskDueDate(task.nodeId, e.target.value || "TBD")} style={{ minHeight: 30, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 8px", fontSize: 11 }} />
            </div>
          </div>
        ))}
      </div>
    </div>

    {selectedTask && <div style={{ display: "grid", gap: 6, border: `1px solid ${T.b1}`, borderRadius: 9, background: T.bg2, padding: "8px 9px" }}>
      <HeaderRow title="GITHUB / JIRA SYNC LINKS" T={T} />
      <input value={ghLink} onChange={e => setGhLink(e.target.value)} placeholder="GitHub issue URL" style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 9px", fontSize: 11.5 }} />
      <input value={jiraLink} onChange={e => setJiraLink(e.target.value)} placeholder="Jira ticket URL" style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 9px", fontSize: 11.5 }} />
      <button onClick={() => execution.updateNode(selectedTask.nodeId, { executionGithubUrl: ghLink || null, executionJiraUrl: jiraLink || null })} style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700 }}>Save links</button>
    </div>}

    <div style={{ display: "grid", gap: 6 }}>
      <HeaderRow title={`MILESTONES (${execution.milestones.length})`} T={T} />
      <div style={{ display: "grid", gap: 6 }}>
        {execution.milestones.length === 0 && <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: T.t2, background: T.bg2 }}>No milestones defined.</div>}
        {execution.milestones.map(ms => {
          const pct = ms.progressTotal ? Math.round((ms.progressDone / ms.progressTotal) * 100) : 0;
          return <button key={ms.id} onClick={() => ms.nodeId && execution.focusNode(ms.nodeId)} style={{ textAlign: "left", border: `1px solid ${T.b1}`, borderRadius: 8, background: T.bg2, color: T.t0, padding: "7px 8px", cursor: ms.nodeId ? "pointer" : "default" }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{ms.title}</div>
            <div style={{ fontSize: 10.5, color: T.t2, marginBottom: 5 }}>Due: {ms.dueDate} � Tasks: {ms.taskCount}</div>
            <div style={{ height: 6, background: T.bg1, borderRadius: 999, overflow: "hidden", border: `1px solid ${T.b0}` }}>
              <div style={{ width: `${pct}%`, height: "100%", background: pct >= 70 ? "#22c55e" : pct >= 40 ? T.y : "#f97316" }} />
            </div>
          </button>;
        })}
      </div>
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <HeaderRow title={`DECISIONS (${execution.decisions.length})`} T={T} />
      <div style={{ display: "grid", gap: 6, maxHeight: 160, overflowY: "auto" }}>
        {execution.decisions.length === 0 && <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: T.t2, background: T.bg2 }}>No decision memory yet.</div>}
        {execution.decisions.map(decision => <button key={decision.nodeId} onClick={() => execution.focusNode(decision.nodeId)} style={{ textAlign: "left", border: `1px solid ${T.b1}`, borderRadius: 8, background: T.bg2, color: T.t0, padding: "7px 8px", cursor: "pointer" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{decision.decision}</div>
          <div style={{ fontSize: 10.5, color: T.t2 }}>Owner: {decision.owner} � Date: {decision.date}</div>
        </button>)}
      </div>
    </div>

    <div style={{ display: "grid", gap: 6 }}>
      <HeaderRow title={`RISKS (${execution.risks.length})`} T={T} />
      <div style={{ display: "grid", gap: 6 }}>
        {execution.risks.length === 0 && <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "7px 9px", fontSize: 11, color: T.t2, background: T.bg2 }}>No risks captured on board.</div>}
        {execution.risks.slice(0, 6).map(risk => <button key={risk.nodeId} onClick={() => execution.focusNode(risk.nodeId)} style={{ textAlign: "left", border: `1px solid ${T.b1}`, borderRadius: 8, background: T.bg2, color: T.t0, padding: "7px 8px", cursor: "pointer" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{risk.title}</div>
          <div style={{ fontSize: 10.5, color: T.t2 }}>Status: {risk.status} � Impact: {risk.impact}</div>
        </button>)}
      </div>
    </div>

    <div style={{ display: "grid", gap: 6, border: `1px solid ${T.b1}`, borderRadius: 10, padding: "8px 9px", background: T.bg2 }}>
      <HeaderRow title="MEETING -> TASKS AUTOPILOT" T={T} />
      <textarea value={execution.meetingNotes} onChange={e => execution.setMeetingNotes(e.target.value)} rows={4} placeholder="Paste meeting notes here..." style={{ width: "100%", resize: "vertical", minHeight: 92, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "8px 9px", fontSize: 11.5, lineHeight: 1.45 }} />
      {execution.autopilotError && <div style={{ fontSize: 11, color: "#fca5a5" }}>{execution.autopilotError}</div>}
      {execution.autopilotSummary && <div style={{ fontSize: 11, color: "#86efac" }}>{execution.autopilotSummary}</div>}
      <button onClick={() => execution.runMeetingAutopilot({ replace: false })} disabled={execution.autopilotLoading || !String(execution.meetingNotes || "").trim()} style={{ minHeight: 36, borderRadius: 8, border: `1px solid ${execution.autopilotLoading || !String(execution.meetingNotes || "").trim() ? T.b1 : T.yDim}`, background: execution.autopilotLoading || !String(execution.meetingNotes || "").trim() ? T.bg3 : T.yBg, color: execution.autopilotLoading || !String(execution.meetingNotes || "").trim() ? T.t2 : T.y, cursor: execution.autopilotLoading || !String(execution.meetingNotes || "").trim() ? "not-allowed" : "pointer", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
        {execution.autopilotLoading ? "Generating..." : "Generate execution tasks"}
      </button>
    </div>
  </div>;
}
