import { useCallback, useEffect, useMemo, useState } from "react";

const ACTION_FILTERS = [
  { value: "all", label: "all" },
  { value: "board.save", label: "save" },
  { value: "board.restore", label: "restore" },
  { value: "board.rename", label: "rename" },
  { value: "board.create", label: "create" },
  { value: "board.delete", label: "delete" },
  { value: "board.member.add", label: "member add" },
  { value: "board.member.role", label: "member role" },
  { value: "board.member.remove", label: "member remove" },
];

function fmtDate(ts) {
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts * 1000).toLocaleString();
}

function fmtAgo(ts) {
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function actionColor(action, T) {
  if (action === "board.delete") return "#fca5a5";
  if (action === "board.restore") return T.blue;
  if (action.startsWith("board.member")) return T.purple;
  if (action === "board.save") return T.green;
  return T.t1;
}

function actorLabel(event) {
  if (event?.actor?.name) return event.actor.name;
  if (event?.actor?.email) return event.actor.email;
  if (event?.actorId) return event.actorId;
  return "system";
}

function detailsSummary(event) {
  const d = event?.details || {};
  if (event.action === "board.rename") {
    return `${d.from || "-"} -> ${d.to || "-"}`;
  }
  if (event.action === "board.restore") {
    return `version ${String(d.restoredVersionId || "").slice(0, 8) || "-"}`;
  }
  if (event.action === "board.member.add" || event.action === "board.member.role") {
    return `${d.email || d.targetUserId || "-"} (${d.fromRole || "-"} -> ${d.toRole || "-"})`;
  }
  if (event.action === "board.member.remove") {
    return `${d.targetUserId || "-"} (${d.fromRole || "-"})`;
  }
  if (event.action === "board.create" || event.action === "board.delete") {
    return d.name || "";
  }
  return "";
}

export default function AuditTimelinePanel({ boardId, T, auditApi }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("all");
  const [limit, setLimit] = useState(80);

  const actionOptions = useMemo(() => ACTION_FILTERS, []);

  const load = useCallback(async () => {
    if (!boardId || !auditApi?.list) return;
    setLoading(true);
    setError("");
    try {
      const payload = await auditApi.list({
        action: action === "all" ? "" : action,
        limit,
      });
      setEvents(Array.isArray(payload?.events) ? payload.events : []);
    } catch (err) {
      setError(err?.message || "Failed to load audit events.");
    } finally {
      setLoading(false);
    }
  }, [boardId, auditApi, action, limit]);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  return <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
    <div onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>AUDIT TIMELINE</span>
      <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2 }}>{events.length || 0}</span>
      <span style={{ fontSize: 9, color: T.t2 }}>{open ? "▲" : "▼"}</span>
    </div>

    {open && <div style={{ padding: "0 10px 10px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <select value={action} onChange={e => setAction(e.target.value)} style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 5, color: T.t1, fontSize: 10.5, padding: "4px 6px", outline: "none" }}>
          {actionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <select value={String(limit)} onChange={e => setLimit(Number(e.target.value) || 80)} style={{ width: 64, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 5, color: T.t1, fontSize: 10.5, padding: "4px 6px", outline: "none" }}>
          {[30, 50, 80, 120].map(v => <option key={v} value={String(v)}>{v}</option>)}
        </select>
        <button onClick={load} disabled={loading} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: loading ? T.t2 : T.t1, borderRadius: 5, padding: "4px 7px", fontSize: 10, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
          refresh
        </button>
      </div>

      {loading && <div style={{ fontSize: 10.5, color: T.t2, marginBottom: 6 }}>Loading...</div>}
      {error && <div style={{ fontSize: 10.5, color: "#fca5a5", marginBottom: 6 }}>{error}</div>}

      {!loading && !error && events.length === 0 && <div style={{ fontSize: 10.5, color: T.t2 }}>No events for current filter.</div>}

      {!error && events.length > 0 && <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, paddingRight: 2 }}>
        {events.map(ev => <div key={ev.id} style={{ border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 7px", background: T.bg3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 9.5, color: actionColor(ev.action || "", T), fontFamily: "'JetBrains Mono',monospace", textTransform: "lowercase" }}>{ev.action || "-"}</span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: T.t2 }}>{fmtAgo(ev.ts)} ago</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: T.t2, marginBottom: 2 }}>
            <span style={{ color: T.t1 }}>{actorLabel(ev)}</span>
            <span>·</span>
            <span>{fmtDate(ev.ts)}</span>
          </div>
          {detailsSummary(ev) && <div style={{ fontSize: 10, color: T.t2, lineHeight: 1.35 }}>{detailsSummary(ev)}</div>}
        </div>)}
      </div>}
    </div>}
  </div>;
}

