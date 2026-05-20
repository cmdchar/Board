import { useCallback, useEffect, useMemo, useState } from "react";

const ROLE_ORDER = { owner: 0, editor: 1, viewer: 2 };

function roleColor(role, T) {
  if (role === "owner") return T.y;
  if (role === "editor") return T.blue;
  return T.t1;
}

export default function BoardAccessPanel({ boardId, currentUser, T, accessApi, notify }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [saving, setSaving] = useState(false);

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return String(a.email || "").localeCompare(String(b.email || ""));
    });
  }, [members]);

  const currentRole = useMemo(() => {
    const me = members.find(m => m.userId === currentUser?.id);
    return me?.role || null;
  }, [members, currentUser]);

  const isOwner = currentRole === "owner";

  const loadMembers = useCallback(async () => {
    if (!boardId || !accessApi?.list) return;
    setLoading(true);
    setError("");
    try {
      const payload = await accessApi.list();
      setMembers(Array.isArray(payload?.members) ? payload.members : []);
    } catch (err) {
      setError(err?.message || "Nu am putut incarca membrii board-ului.");
    } finally {
      setLoading(false);
    }
  }, [boardId, accessApi]);

  useEffect(() => {
    if (!open) return;
    loadMembers();
  }, [open, loadMembers]);

  async function addMember(e) {
    e.preventDefault();
    const trimmed = String(email || "").trim();
    if (!trimmed) return;
    setSaving(true);
    setError("");
    try {
      const payload = await accessApi.add(trimmed, role);
      setMembers(Array.isArray(payload?.members) ? payload.members : []);
      setEmail("");
      notify?.(`Access updated for ${trimmed}`, "info");
    } catch (err) {
      setError(err?.message || "Nu am putut salva membrul.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId) {
    if (!userId) return;
    setSaving(true);
    setError("");
    try {
      const payload = await accessApi.remove(userId);
      setMembers(Array.isArray(payload?.members) ? payload.members : []);
      notify?.("Member removed from board", "info");
    } catch (err) {
      setError(err?.message || "Nu am putut elimina membrul.");
    } finally {
      setSaving(false);
    }
  }

  return <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
    <div onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>BOARD ACCESS</span>
      <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2 }}>{members.length || 0}</span>
      <span style={{ fontSize: 9, color: T.t2 }}>{open ? "▲" : "▼"}</span>
    </div>

    {open && <div style={{ padding: "0 10px 10px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button onClick={loadMembers} disabled={loading || saving} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
          refresh
        </button>
      </div>
      {loading && <div style={{ fontSize: 10.5, color: T.t2, marginBottom: 7 }}>Loading members...</div>}
      {error && <div style={{ fontSize: 10.5, color: "#fca5a5", marginBottom: 7 }}>{error}</div>}

      {!loading && !error && sortedMembers.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {sortedMembers.map(m => <div key={m.userId} style={{ border: `1px solid ${T.b1}`, borderRadius: 7, padding: "6px 7px", background: T.bg3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 10.5, color: T.t0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name || m.email || m.userId}</span>
            <span style={{ fontSize: 9, color: roleColor(m.role, T), border: `1px solid ${T.b0}`, borderRadius: 999, padding: "1px 6px", textTransform: "uppercase", fontFamily: "'JetBrains Mono',monospace" }}>{m.role}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9.5, color: T.t2, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email || m.userId}</span>
            {isOwner && m.role !== "owner" && <button onClick={() => removeMember(m.userId)} disabled={saving} style={{ background: "transparent", border: `1px solid ${T.b0}`, color: "#fca5a5", borderRadius: 5, padding: "2px 6px", fontSize: 9.5, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
              remove
            </button>}
          </div>
        </div>)}
      </div>}

      {isOwner && <form onSubmit={addMember} style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "8px 8px 7px", background: T.bg3 }}>
        <div style={{ fontSize: 10, color: T.y, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>INVITE MEMBER</div>
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="user email"
          disabled={saving}
          style={{ width: "100%", marginBottom: 6, background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 6, padding: "6px 7px", fontSize: 11, color: T.t0, outline: "none", fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <select value={role} onChange={e => setRole(e.target.value)} disabled={saving} style={{ flex: 1, background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 6, padding: "6px 7px", fontSize: 11, color: T.t0, outline: "none", fontFamily: "inherit" }}>
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
          </select>
          <button type="submit" disabled={saving || !email.trim()} style={{ flex: 1, background: T.bg2, border: `1px solid ${T.yDim}`, color: T.y, borderRadius: 6, padding: "6px 7px", fontSize: 10.5, cursor: saving ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
            {saving ? "saving..." : "grant access"}
          </button>
        </div>
      </form>}

      {!loading && !error && !isOwner && currentRole && <div style={{ fontSize: 10.5, color: T.t2 }}>
        Rolul tau pe board: <span style={{ color: roleColor(currentRole, T) }}>{currentRole}</span>. Doar owner-ul poate modifica membrii.
      </div>}
    </div>}
  </div>;
}

