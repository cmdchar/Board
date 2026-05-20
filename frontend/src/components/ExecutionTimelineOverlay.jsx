import { useMemo } from "react";

function toIsoDay(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function parseIsoDay(value) {
  const txt = String(value || "").trim();
  const m = txt.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "";
}

function buildDays(span = 14) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = 0; i < span; i++) {
    const next = new Date(start);
    next.setDate(start.getDate() + i);
    out.push(next);
  }
  return out;
}

function dayLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short" });
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("done")) return { bg: "#dcfce7", fg: "#14532d" };
  if (s.includes("block")) return { bg: "#fee2e2", fg: "#7f1d1d" };
  if (s.includes("progress")) return { bg: "#dbeafe", fg: "#1e3a8a" };
  return { bg: "#fef3c7", fg: "#92400e" };
}

export default function ExecutionTimelineOverlay({
  open,
  onClose,
  T,
  tasks = [],
  milestones = [],
  onUpdateDueDate,
  onFocusTask,
}) {
  const days = useMemo(() => buildDays(14).map(toIsoDay), []);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(days.map(day => [day, []]));
    const unscheduled = [];
    tasks.forEach(task => {
      const iso = parseIsoDay(task.dueDate);
      if (iso && map[iso]) map[iso].push(task);
      else unscheduled.push(task);
    });
    return { map, unscheduled };
  }, [days, tasks]);

  if (!open) return null;

  return <div style={{ position: "fixed", inset: 0, zIndex: 520, background: "rgba(3,8,16,.72)", backdropFilter: "blur(4px)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", left: 10, right: 10, top: 56, bottom: 10, borderRadius: 14, border: `1px solid ${T.b1}`, background: T.bg1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ minHeight: 46, borderBottom: `1px solid ${T.b0}`, display: "flex", alignItems: "center", gap: 10, padding: "0 12px" }}>
        <span style={{ fontSize: 10.5, color: T.y, letterSpacing: ".07em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>EXECUTION TIMELINE</span>
        <span style={{ fontSize: 11, color: T.t2 }}>{tasks.length} tasks · {milestones.length} milestones</span>
        <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>Drag tasks between dates to change deadline</span>
        <button onClick={onClose} style={{ height: 30, padding: "0 10px", borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>Close</button>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ width: 250, minWidth: 250, borderRight: `1px solid ${T.b0}`, overflowY: "auto", padding: "10px 8px", display: "grid", gap: 8 }}>
          <div style={{ fontSize: 10, color: T.t2, letterSpacing: ".06em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>UNSCHEDULED</div>
          {grouped.unscheduled.length === 0 && <div style={{ border: `1px dashed ${T.b1}`, borderRadius: 8, padding: "7px 8px", fontSize: 11, color: T.t2 }}>No unscheduled tasks.</div>}
          {grouped.unscheduled.map(task => {
            const tone = statusTone(task.status);
            return <div key={task.nodeId} draggable onDragStart={e => e.dataTransfer.setData("text/task-node-id", task.nodeId)} style={{ border: `1px solid ${T.b1}`, borderRadius: 8, background: T.bg2, padding: "7px 8px", display: "grid", gap: 5, cursor: "grab" }}>
              <button onClick={() => onFocusTask?.(task.nodeId)} style={{ textAlign: "left", background: "transparent", border: "none", padding: 0, color: T.t0, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>{task.title}</button>
              <span style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, background: tone.bg, color: tone.fg, padding: "2px 7px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{task.status}</span>
              <input type="date" value="" onChange={e => onUpdateDueDate?.(task.nodeId, e.target.value || "TBD")} style={{ minHeight: 28, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 11, padding: "0 7px" }} />
            </div>;
          })}
        </div>

        <div style={{ flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ minWidth: days.length * 180, height: "100%", display: "grid", gridTemplateColumns: `repeat(${days.length}, 180px)` }}>
            {days.map(day => {
              const list = grouped.map[day] || [];
              return <div key={day} onDragOver={e => e.preventDefault()} onDrop={e => {
                const taskNodeId = e.dataTransfer.getData("text/task-node-id");
                if (!taskNodeId) return;
                onUpdateDueDate?.(taskNodeId, day);
              }} style={{ borderRight: `1px solid ${T.b0}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ height: 42, borderBottom: `1px solid ${T.b0}`, display: "grid", placeItems: "center", fontSize: 11, color: T.t1, fontFamily: "'JetBrains Mono',monospace", background: T.bg2 }}>
                  {dayLabel(day)}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px", display: "grid", gap: 7 }}>
                  {list.length === 0 && <div style={{ border: `1px dashed ${T.b1}`, borderRadius: 8, padding: "8px 7px", color: T.t3, fontSize: 10.5, textAlign: "center" }}>Drop task</div>}
                  {list.map(task => {
                    const tone = statusTone(task.status);
                    return <div key={task.nodeId} draggable onDragStart={e => e.dataTransfer.setData("text/task-node-id", task.nodeId)} style={{ border: `1px solid ${T.b1}`, borderRadius: 8, background: T.bg2, padding: "7px 7px", display: "grid", gap: 5, cursor: "grab" }}>
                      <button onClick={() => onFocusTask?.(task.nodeId)} style={{ textAlign: "left", background: "transparent", border: "none", padding: 0, color: T.t0, cursor: "pointer", fontSize: 11.5, fontWeight: 700 }}>{task.title}</button>
                      <span style={{ display: "inline-flex", width: "fit-content", borderRadius: 999, background: tone.bg, color: tone.fg, padding: "2px 7px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{task.status}</span>
                    </div>;
                  })}
                </div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  </div>;
}
