import { useMemo, useState } from "react";

function formatWhen(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return "now";
  const d = new Date(n);
  if (!Number.isFinite(d.getTime())) return "now";
  return d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" });
}

export default function CollaborationPanel({
  T,
  users = [],
  myPresence = "active",
  onPresenceChange,
  activity = [],
  comments = [],
  onFocusComment,
  onDeleteComment,
  onReplyComment,
  meetingNotes,
  setMeetingNotes,
  runMeetingAssistant,
  meetingBusy = false,
  meetingSuggestions = null,
  applyMeetingSuggestions,
}) {
  const [replyDraftById, setReplyDraftById] = useState({});

  const sortedUsers = useMemo(() => {
    return [...(Array.isArray(users) ? users : [])].sort((a, b) => {
      const aw = a?.state === "presenting" ? 0 : a?.state === "active" ? 1 : 2;
      const bw = b?.state === "presenting" ? 0 : b?.state === "active" ? 1 : 2;
      if (aw !== bw) return aw - bw;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });
  }, [users]);

  return (
    <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "10px 12px", background: T.bg1, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10, color: T.y, letterSpacing: ".06em", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>COLLABORATION</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {["active", "idle", "presenting"].map(state => (
            <button
              key={state}
              onClick={() => onPresenceChange?.(state)}
              style={{
                height: 24,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${myPresence === state ? T.yDim : T.b1}`,
                background: myPresence === state ? T.yBg : T.bg2,
                color: myPresence === state ? T.y : T.t1,
                fontSize: 10,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
              }}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Presence ({sortedUsers.length})</div>
        {sortedUsers.length === 0 && <div style={{ fontSize: 11, color: T.t2 }}>No other users on board.</div>}
        {sortedUsers.map(u => (
          <div key={u.socketId} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${T.b0}`, borderRadius: 8, background: T.bg1, padding: "6px 8px" }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: u.color || T.blue, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{String(u.name || "U").slice(0, 1).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: T.t0, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name || "User"}</div>
              <div style={{ fontSize: 10, color: T.t2 }}>{u.state || "active"} • {formatWhen(u.lastActiveAt)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Comments ({comments.length})</div>
        {comments.length === 0 && <div style={{ fontSize: 11, color: T.t2 }}>No comments yet.</div>}
        <div style={{ display: "grid", gap: 6, maxHeight: 200, overflowY: "auto" }}>
          {(comments || []).slice(0, 20).map(comment => (
            <div key={comment.id} style={{ border: `1px solid ${T.b0}`, borderRadius: 8, background: T.bg1, padding: "6px 8px", display: "grid", gap: 5 }}>
              <button onClick={() => onFocusComment?.(comment)} style={{ textAlign: "left", border: "none", background: "transparent", color: T.t0, fontSize: 11.5, cursor: "pointer", padding: 0 }}>{comment.text || "(empty comment)"}</button>
              <div style={{ fontSize: 10, color: T.t2 }}>{comment.author || "User"} • {formatWhen(comment.ts)}</div>
              {Array.isArray(comment.replies) && comment.replies.length > 0 && (
                <div style={{ display: "grid", gap: 4 }}>
                  {comment.replies.slice(-3).map(reply => (
                    <div key={reply.id} style={{ border: `1px solid ${T.b0}`, borderRadius: 6, padding: "4px 6px", background: T.bg2, fontSize: 10.5, color: T.t1 }}>
                      {reply.text}
                      <div style={{ fontSize: 9.5, color: T.t3 }}>{reply.author || "User"} • {formatWhen(reply.ts)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={replyDraftById[comment.id] || ""}
                  onChange={e => setReplyDraftById(prev => ({ ...prev, [comment.id]: e.target.value }))}
                  placeholder="Reply..."
                  style={{ flex: 1, minHeight: 30, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, padding: "0 8px", fontSize: 11 }}
                />
                <button
                  onClick={() => {
                    const text = String(replyDraftById[comment.id] || "").trim();
                    if (!text) return;
                    onReplyComment?.(comment.id, text);
                    setReplyDraftById(prev => ({ ...prev, [comment.id]: "" }));
                  }}
                  style={{ minWidth: 58, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, cursor: "pointer", fontSize: 11 }}
                >
                  Reply
                </button>
                <button onClick={() => onDeleteComment?.(comment.id)} style={{ minWidth: 48, borderRadius: 7, border: `1px solid ${T.red}`, background: "transparent", color: T.red, cursor: "pointer", fontSize: 11 }}>Del</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>AI Meeting Assistant</div>
        <textarea
          rows={3}
          value={meetingNotes}
          onChange={e => setMeetingNotes?.(e.target.value)}
          placeholder="Paste meeting notes..."
          style={{ width: "100%", resize: "vertical", minHeight: 74, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "7px 8px", fontSize: 11.5 }}
        />
        <button
          onClick={runMeetingAssistant}
          disabled={meetingBusy || !String(meetingNotes || "").trim()}
          style={{ minHeight: 34, borderRadius: 8, border: `1px solid ${meetingBusy || !String(meetingNotes || "").trim() ? T.b1 : T.yDim}`, background: meetingBusy || !String(meetingNotes || "").trim() ? T.bg3 : T.yBg, color: meetingBusy || !String(meetingNotes || "").trim() ? T.t2 : T.y, cursor: meetingBusy || !String(meetingNotes || "").trim() ? "not-allowed" : "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}
        >
          {meetingBusy ? "Thinking..." : "Suggest tasks/decisions"}
        </button>
        {meetingSuggestions && (
          <div style={{ border: `1px solid ${T.b0}`, borderRadius: 8, background: T.bg1, padding: "7px 8px", display: "grid", gap: 6 }}>
            <div style={{ fontSize: 11, color: T.t0 }}>{meetingSuggestions.summary || "Meeting suggestions ready."}</div>
            <div style={{ fontSize: 10, color: T.t2 }}>Tasks: {meetingSuggestions.tasks?.length || 0} • Milestones: {meetingSuggestions.milestones?.length || 0} • Decisions: {meetingSuggestions.decisions?.length || 0}</div>
            <button onClick={applyMeetingSuggestions} style={{ minHeight: 30, borderRadius: 7, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
              Apply suggestions on board
            </button>
          </div>
        )}
      </div>

      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 10, background: T.bg2, padding: 8, display: "grid", gap: 6 }}>
        <div style={{ fontSize: 10.5, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>Board Activity Timeline</div>
        <div style={{ display: "grid", gap: 5, maxHeight: 180, overflowY: "auto" }}>
          {(activity || []).slice(0, 40).map(ev => (
            <div key={ev.id} style={{ border: `1px solid ${T.b0}`, borderRadius: 7, background: T.bg1, padding: "5px 7px" }}>
              <div style={{ fontSize: 11, color: T.t0 }}>{ev.message || ev.type}</div>
              <div style={{ fontSize: 9.5, color: T.t3 }}>{ev.actor?.name || "system"} • {formatWhen(ev.ts)}</div>
            </div>
          ))}
          {(!activity || activity.length === 0) && <div style={{ fontSize: 11, color: T.t2 }}>No activity yet.</div>}
        </div>
      </div>
    </div>
  );
}