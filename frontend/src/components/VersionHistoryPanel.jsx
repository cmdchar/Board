import { useCallback, useEffect, useMemo, useState } from "react";

function formatDate(ts) {
  if (!Number.isFinite(ts)) return "-";
  return new Date(ts * 1000).toLocaleString();
}

function formatAge(ts) {
  if (!Number.isFinite(ts)) return "";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatReason(reason) {
  const raw = String(reason || "save");
  if (raw.startsWith("restore:")) return "restore";
  return raw;
}

function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function count(value) {
  return Array.isArray(value) ? value.length : 0;
}

export default function VersionHistoryPanel({ boardId, T, historyApi, onRestoreVersion, notify }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [confirmingId, setConfirmingId] = useState("");
  const [restoringId, setRestoringId] = useState("");

  const selected = useMemo(() => versions.find(v => v.id === selectedId) || null, [versions, selectedId]);
  const snapshot = detail?.data && typeof detail.data === "object" ? detail.data : null;

  const loadVersions = useCallback(async () => {
    if (!boardId || !historyApi?.list) return;
    setListLoading(true);
    setListError("");
    try {
      const payload = await historyApi.list();
      const next = Array.isArray(payload?.versions) ? payload.versions : [];
      setVersions(next);
      setSelectedId(cur => (next.some(v => v.id === cur) ? cur : (next[0]?.id || "")));
    } catch (err) {
      setListError(err?.message || "Nu am putut incarca istoricul.");
    } finally {
      setListLoading(false);
    }
  }, [boardId, historyApi]);

  useEffect(() => {
    if (!open) return;
    loadVersions();
  }, [open, loadVersions]);

  useEffect(() => {
    if (!open || !boardId || !selectedId || !historyApi?.detail) {
      setDetail(null);
      setDetailError("");
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    historyApi.detail(selectedId)
      .then(payload => {
        if (!cancelled) setDetail(payload);
      })
      .catch(err => {
        if (!cancelled) setDetailError(err?.message || "Nu am putut incarca versiunea.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, boardId, selectedId, historyApi]);

  useEffect(() => {
    setConfirmingId("");
  }, [selectedId, open]);

  async function restoreSelected() {
    if (!selected || !historyApi?.restore || restoringId) return;
    if (confirmingId !== selected.id) {
      setConfirmingId(selected.id);
      return;
    }

    setRestoringId(selected.id);
    try {
      const payload = await historyApi.restore(selected.id);
      const restoredData = payload?.board?.data || detail?.data;
      if (!restoredData || typeof restoredData !== "object") {
        throw new Error("Restore failed: missing board snapshot.");
      }
      onRestoreVersion?.(restoredData, selected, payload?.board || null);
      notify?.(`Version restored: ${formatDate(selected.created_at)}`, "info");
      setConfirmingId("");
      await loadVersions();
    } catch (err) {
      notify?.(err?.message || "Restore failed.", "error");
    } finally {
      setRestoringId("");
    }
  }

  return <div style={{ borderBottom: `1px solid ${T.b0}`, flexShrink: 0 }}>
    <div onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: T.y, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>VERSION HISTORY</span>
      <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.t2 }}>
        {versions.length || 0}
      </span>
      <span style={{ fontSize: 9, color: T.t2 }}>{open ? "▲" : "▼"}</span>
    </div>

    {open && <div style={{ padding: "0 10px 10px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
        <button onClick={loadVersions} disabled={listLoading} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: listLoading ? T.t2 : T.t1, borderRadius: 5, padding: "3px 7px", fontSize: 10, cursor: listLoading ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace" }}>
          refresh
        </button>
      </div>

      {listError && <div style={{ fontSize: 10.5, color: "#fca5a5", marginBottom: 6 }}>{listError}</div>}
      {listLoading && <div style={{ fontSize: 10.5, color: T.t2, marginBottom: 6 }}>Loading versions...</div>}

      {!listLoading && versions.length === 0 && <div style={{ fontSize: 10.5, color: T.t2, marginBottom: 6 }}>No saved versions yet.</div>}

      {versions.length > 0 && <div style={{ maxHeight: 170, overflowY: "auto", paddingRight: 2, display: "flex", flexDirection: "column", gap: 5, marginBottom: 8 }}>
        {versions.map(v => {
          const active = v.id === selectedId;
          return <button key={v.id} onClick={() => setSelectedId(v.id)} style={{ textAlign: "left", background: active ? T.yBg : T.bg3, border: `1px solid ${active ? T.yDim : T.b1}`, borderRadius: 7, padding: "6px 8px", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: active ? T.y : T.t1, fontFamily: "'JetBrains Mono',monospace", textTransform: "uppercase" }}>{formatReason(v.reason)}</span>
              <span style={{ marginLeft: "auto", fontSize: 9.5, color: T.t2 }}>{formatAge(v.created_at)}</span>
            </div>
            <div style={{ fontSize: 10.5, color: T.t2 }}>{formatDate(v.created_at)}</div>
          </button>;
        })}
      </div>}

      {selected && <div style={{ border: `1px solid ${T.b1}`, background: T.bg3, borderRadius: 8, padding: "8px 9px" }}>
        <div style={{ fontSize: 10, color: T.t1, fontFamily: "'JetBrains Mono',monospace", marginBottom: 5 }}>
          {formatReason(selected.reason)} · {formatSize(selected.size)}
        </div>
        {detailError && <div style={{ fontSize: 10.5, color: "#fca5a5", marginBottom: 6 }}>{detailError}</div>}
        {detailLoading && <div style={{ fontSize: 10.5, color: T.t2, marginBottom: 6 }}>Loading preview...</div>}
        {snapshot && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
          <span style={{ fontSize: 9.5, color: T.t2, border: `1px solid ${T.b0}`, borderRadius: 999, padding: "2px 6px" }}>nodes: {count(snapshot.nodes)}</span>
          <span style={{ fontSize: 9.5, color: T.t2, border: `1px solid ${T.b0}`, borderRadius: 999, padding: "2px 6px" }}>arrows: {count(snapshot.arrows)}</span>
          <span style={{ fontSize: 9.5, color: T.t2, border: `1px solid ${T.b0}`, borderRadius: 999, padding: "2px 6px" }}>comments: {count(snapshot.comments)}</span>
        </div>}

        {confirmingId === selected.id ? <div style={{ border: `1px solid rgba(239,68,68,.35)`, background: "rgba(239,68,68,.08)", borderRadius: 7, padding: "7px 8px" }}>
          <div style={{ fontSize: 10.5, color: "#fecaca", marginBottom: 6, lineHeight: 1.4 }}>
            Confirm restore? Current canvas state will be replaced.
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={restoreSelected} disabled={!!restoringId} style={{ flex: 1, background: "rgba(239,68,68,.14)", border: "1px solid rgba(239,68,68,.45)", color: "#fecaca", borderRadius: 6, padding: "5px 6px", fontSize: 10.5, cursor: restoringId ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              {restoringId ? "Restoring..." : "Confirm restore"}
            </button>
            <button onClick={() => setConfirmingId("")} disabled={!!restoringId} style={{ flex: 1, background: T.bg2, border: `1px solid ${T.b1}`, color: T.t1, borderRadius: 6, padding: "5px 6px", fontSize: 10.5, cursor: restoringId ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
          </div>
        </div> : <button onClick={restoreSelected} disabled={detailLoading || !!restoringId} style={{ width: "100%", background: T.bg2, border: `1px solid ${T.yDim}`, color: T.y, borderRadius: 6, padding: "6px 8px", fontSize: 10.5, cursor: detailLoading || restoringId ? "not-allowed" : "pointer", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
          Restore snapshot
        </button>}
      </div>}
    </div>}
  </div>;
}

