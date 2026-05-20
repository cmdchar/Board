import { useEffect, useState } from "react";

export default function Dashboard({
  user,
  onSelect,
  onLogout,
  themeMode = "dark",
  onToggleTheme,
  T,
  CSS,
  useIsMobileHook,
  api,
}) {
  const isMobile = useIsMobileHook(860);
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [delId, setDelId] = useState(null);
  const [healthBoardId, setHealthBoardId] = useState("");
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthErr, setHealthErr] = useState("");
  const [healthData, setHealthData] = useState(null);
  const [healthDrawerOpen, setHealthDrawerOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [tokenName, setTokenName] = useState("codex-cli");
  const [tokenDays, setTokenDays] = useState(30);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState("");
  const [issuedToken, setIssuedToken] = useState("");
  const [issuedMeta, setIssuedMeta] = useState(null);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenItems, setTokenItems] = useState([]);
  const [tokenListLoading, setTokenListLoading] = useState(false);
  const [tokenListErr, setTokenListErr] = useState("");
  const [tokenRevokeId, setTokenRevokeId] = useState("");

  function refresh() {
    api.boards().then((b) => {
      setBoards(b);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => refresh(), []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    const b = await api.create(name.trim());
    setBusy(false);
    onSelect(b.id, b.name);
  }
  async function deleteBoard(id) {
    await api.del(id);
    setDelId(null);
    refresh();
  }

  async function loadApiTokens({ silent = false } = {}) {
    if (!silent) setTokenListLoading(true);
    setTokenListErr("");
    try {
      const payload = await api.listApiTokens();
      setTokenItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (ex) {
      setTokenItems([]);
      setTokenListErr(ex.message || "Could not load API tokens");
    } finally {
      if (!silent) setTokenListLoading(false);
    }
  }

  function openTokenModal() {
    setTokenOpen(true);
    setTokenError("");
    setTokenCopied(false);
    setIssuedToken("");
    setIssuedMeta(null);
    setTokenItems([]);
    setTokenListErr("");
    setTokenListLoading(false);
    setTokenRevokeId("");
    loadApiTokens();
  }

  function closeTokenModal() {
    setTokenOpen(false);
    setTokenBusy(false);
    setTokenError("");
    setTokenCopied(false);
    setIssuedToken("");
    setIssuedMeta(null);
    setTokenItems([]);
    setTokenListLoading(false);
    setTokenListErr("");
    setTokenRevokeId("");
  }

  async function generateApiToken(e) {
    e.preventDefault();
    if (tokenBusy) return;
    setTokenBusy(true);
    setTokenError("");
    setTokenCopied(false);
    try {
      const expiresInDays = Math.max(1, Math.min(3650, Number(tokenDays) || 30));
      const payload = await api.createApiToken({
        name: tokenName.trim() || "api-token",
        expiresInDays,
      });
      setIssuedToken(String(payload?.token || ""));
      setIssuedMeta(payload || null);
      if (payload?.name) setTokenName(String(payload.name));
      if (payload?.expiresInDays) setTokenDays(Number(payload.expiresInDays));
      await loadApiTokens({ silent: true });
    } catch (ex) {
      setIssuedToken("");
      setIssuedMeta(null);
      setTokenError(ex.message || "Could not create API token");
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeApiToken(tokenId) {
    const safeId = String(tokenId || "");
    if (!safeId || tokenRevokeId) return;
    setTokenRevokeId(safeId);
    setTokenError("");
    try {
      await api.revokeApiToken(safeId);
      setTokenItems((prev) => prev.map((item) => (
        item?.id === safeId
          ? { ...item, status: "revoked", revokedAt: Number(item?.revokedAt) || Math.floor(Date.now() / 1000) }
          : item
      )));
      if (issuedMeta?.id === safeId) {
        setIssuedToken("");
        setIssuedMeta(null);
        setTokenCopied(false);
      }
    } catch (ex) {
      setTokenError(ex.message || "Could not revoke token");
    } finally {
      setTokenRevokeId("");
    }
  }

  async function copyIssuedToken() {
    if (!issuedToken) return;
    const text = String(issuedToken);
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch {}

    if (!copied) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "readonly");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {}
    }

    if (copied) {
      setTokenCopied(true);
      setTimeout(() => setTokenCopied(false), 1800);
    } else {
      setTokenError("Copy failed. Select token manually.");
    }
  }

  async function loadHealth(boardId, { issueLimit = 3 } = {}) {
    if (!boardId) return;
    setHealthLoading(true);
    setHealthErr("");
    try {
      const payload = await api.semantic(boardId, { entityLimit: 20, relationLimit: 20, issueLimit });
      setHealthData(payload);
    } catch (ex) {
      setHealthErr(ex.message || "Could not load execution health");
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  }

  useEffect(() => {
    if (loading || !boards.length) {
      setHealthBoardId("");
      setHealthData(null);
      setHealthErr("");
      return;
    }
    const targetId = healthBoardId && boards.some((b) => b.id === healthBoardId) ? healthBoardId : boards[0].id;
    if (targetId !== healthBoardId) setHealthBoardId(targetId);
    loadHealth(targetId, { issueLimit: 3 });
  }, [loading, boards]);

  const healthBoard = boards.find((b) => b.id === healthBoardId) || null;
  const healthScore = healthData?.health?.healthScore;
  const topIssues = Array.isArray(healthData?.health?.issues) ? healthData.health.issues.slice(0, 3) : [];
  const groupedIssues = Array.isArray(healthData?.health?.issues)
    ? healthData.health.issues.reduce((acc, it) => {
      const key = String(it.type || "other");
      if (!acc[key]) acc[key] = [];
      acc[key].push(it);
      return acc;
    }, {})
    : {};
  const issueTypeLabel = {
    orphan_task: "Orphan tasks",
    missing_owner: "Missing owner",
    missing_due_date: "Missing due date",
    overdue: "Overdue",
    empty_milestone: "Empty milestones",
    circular_dependency: "Circular dependencies",
  };
  const scoreCol = healthScore >= 85 ? "#86efac" : healthScore >= 65 ? "#facc15" : "#fca5a5";
  const scoreBg = healthScore >= 85 ? "rgba(34,197,94,.15)" : healthScore >= 65 ? "rgba(250,204,21,.15)" : "rgba(239,68,68,.14)";

  const fmt = (ts) => {
    if (!ts) return "";
    const dt = new Date(ts * 1000);
    return dt.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };
  const fmtTokenTs = (ts) => {
    if (!ts) return "-";
    try {
      return new Date(Number(ts) * 1000).toLocaleString("ro-RO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "-";
    }
  };
  const tokenStatusMeta = (statusRaw) => {
    const status = String(statusRaw || "active");
    if (status === "revoked") return { label: "REVOKED", color: "#fca5a5", bg: "rgba(239,68,68,.14)", border: "rgba(239,68,68,.35)" };
    if (status === "expired") return { label: "EXPIRED", color: "#facc15", bg: "rgba(250,204,21,.12)", border: "rgba(250,204,21,.3)" };
    return { label: "ACTIVE", color: "#86efac", bg: "rgba(34,197,94,.14)", border: "rgba(34,197,94,.35)" };
  };

  return <div style={{ height: "100vh", background: T.bg0, display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif", overflow: "hidden" }}>
    <style>{CSS}</style>
    {/* Header */}
    <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "16px 32px", borderBottom: `1px solid ${T.b0}`, flexShrink: 0, flexDirection: isMobile ? "column" : "row", gap: isMobile ? 10 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22, color: T.y, animation: "float 3s ease-in-out infinite", display: "inline-block" }}>B</span>
        <span style={{ fontFamily: "'Instrument Serif',serif", fontSize: 20, color: T.t0, fontWeight: 800, letterSpacing: "-.03em" }}>Board<span style={{ color: T.y }}>AI</span></span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 99, padding: "5px 12px" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: user?.color || T.y }} />
          <span style={{ fontSize: 12, color: T.t0, fontWeight: 500 }}>{user?.name || "Guest"}</span>
          {!isMobile && <span style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{user?.email}</span>}
        </div>
        <button onClick={onToggleTheme} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: "6px 10px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          {themeMode === "dark" ? "Light" : "Dark"}
        </button>
        <button onClick={openTokenModal} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t0, padding: "6px 10px", borderRadius: 7, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
          API Token
        </button>
        <button onClick={onLogout} style={{ background: "transparent", border: `1px solid ${T.b1}`, color: T.t2, padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Sign out</button>
      </div>
    </div>

    {/* Main content */}
    <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "20px 12px" : "40px 32px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Welcome */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontFamily: "'Instrument Serif',serif", fontSize: isMobile ? 28 : 34, color: T.t0, fontWeight: 800, letterSpacing: "-.03em", margin: "0 0 6px" }}>
            Welcome back, <span style={{ color: T.y }}>{user?.name?.split(" ")[0] || "there"}</span> ?
          </h1>
          <p style={{ color: T.t1, fontSize: 13, margin: 0 }}>Your collaborative whiteboards - pick one or create a new one.</p>
        </div>

        {/* Execution Health */}
        {!!healthBoard && <div style={{ background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 16, padding: isMobile ? "14px 12px" : "18px 20px", marginBottom: 24, boxShadow: "0 4px 20px rgba(0,0,0,.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: ".07em" }}>EXECUTION HEALTH</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{healthBoard.name}</span>
          </div>
          {healthLoading && <div style={{ fontSize: 11, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>Loading health...</div>}
          {!healthLoading && healthErr && <div style={{ fontSize: 11, color: "#fca5a5" }}>{healthErr}</div>}
          {!healthLoading && !healthErr && typeof healthScore === "number" && <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ background: scoreBg, border: `1px solid ${scoreCol}66`, color: scoreCol, padding: "6px 10px", borderRadius: 10, fontSize: 18, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", minWidth: 64, textAlign: "center" }}>
                {healthScore}
              </div>
              <div style={{ fontSize: 11, color: T.t1, lineHeight: 1.5 }}>
                <div style={{ fontSize: 12, color: T.t0, fontWeight: 600 }}>Execution score</div>
                <div>{healthData?.health?.totalIssues || 0} issues detected</div>
              </div>
              <button onClick={async () => { setHealthDrawerOpen(true); await loadHealth(healthBoard.id, { issueLimit: 500 }); }} style={{ marginLeft: "auto", background: T.bg3, border: `1px solid ${T.b1}`, color: T.t0, padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                Details
              </button>
            </div>
            {topIssues.length > 0 && <div style={{ display: "grid", gap: 6 }}>
              {topIssues.map((it, idx) => <div key={`${it.id || it.type}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 7 }}>
                <span style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace", minWidth: 18 }}>{idx + 1}.</span>
                <span style={{ fontSize: 11, color: T.t0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.message || issueTypeLabel[it.type] || it.type}</span>
              </div>)}
            </div>}
          </>}
        </div>}

        {/* Create board */}
        <div style={{ background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 16, padding: isMobile ? "14px 12px" : "20px 24px", marginBottom: 28, boxShadow: "0 4px 20px rgba(0,0,0,.4)" }}>
          <div style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, marginBottom: 12, letterSpacing: ".06em" }}>NEW BOARD</div>
          <form onSubmit={create} style={{ display: "flex", gap: 8, flexDirection: isMobile ? "column" : "row" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Board name..." autoFocus style={{ flex: 1, background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "9px 12px", color: T.t0, fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none" }} onFocus={(e) => e.target.style.borderColor = T.yDim} onBlur={(e) => e.target.style.borderColor = T.b1} />
            <button type="submit" disabled={!name.trim() || busy} style={{ background: name.trim() && !busy ? T.yBg : "transparent", border: `1px solid ${name.trim() && !busy ? T.yDim : T.b1}`, color: name.trim() && !busy ? T.y : T.t3, padding: "9px 18px", borderRadius: 8, cursor: name.trim() && !busy ? "pointer" : "not-allowed", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", whiteSpace: "nowrap", transition: "all .15s", width: isMobile ? "100%" : "auto" }}>Create {"->"}</button>
          </form>
        </div>

        {/* Existing boards */}
        {loading && <div style={{ display: "grid", gap: 10, padding: "10px 0" }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ height: 62, borderRadius: 12, border: `1px solid ${T.b1}`, background: `linear-gradient(90deg,${T.bg2},${T.bg3},${T.bg2})`, backgroundSize: "200% 100%", animation: "pulse 1.2s ease-in-out infinite" }} />)}
        </div>}
        {!loading && boards.length === 0 && <div style={{ textAlign: "center", padding: "30px 0 24px", color: T.t2, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", display: "grid", gap: 10 }}>
          <div>No boards yet - create your first in seconds.</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {["Brainstorm board", "Product roadmap", "Meeting notes"].map((label) => <button key={label} onClick={() => setName(label)} className="ui-btn" style={{ minHeight: 34, padding: "0 10px" }}>{label}</button>)}
          </div>
        </div>}
        {!loading && boards.length > 0 && <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.4)" }}>
          <div style={{ padding: isMobile ? "12px" : "12px 20px", borderBottom: `1px solid ${T.b0}`, fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>My Boards ({boards.length})</div>
          {boards.map((b, i) => <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "11px 12px" : "13px 20px", borderBottom: i < boards.length - 1 ? `1px solid ${T.b0}` : "none", cursor: "pointer", transition: "background .1s" }} onClick={() => onSelect(b.id, b.name)} onMouseEnter={(e) => e.currentTarget.style.background = T.bg3} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: T.bg3, border: `1px solid ${T.b1}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, flexShrink: 0 }}>BRD</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: T.t0, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
              <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>Updated {fmt(b.updated_at)}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); setDelId(b.id); }} title="Delete" style={{ background: "transparent", border: "none", color: T.t3, fontSize: 13, cursor: "pointer", padding: "5px 7px", borderRadius: 5, flexShrink: 0, opacity: .6 }} onMouseEnter={(e) => { e.currentTarget.style.color = T.red; e.currentTarget.style.opacity = "1"; }} onMouseLeave={(e) => { e.currentTarget.style.color = T.t3; e.currentTarget.style.opacity = ".6"; }}>DEL</button>
            {!isMobile && <span style={{ fontSize: 14, color: T.t2, flexShrink: 0 }}>{">"}</span>}
          </div>)}
        </div>}
      </div>
    </div>

    {/* API token modal */}
    {tokenOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1002, backdropFilter: "blur(4px)", padding: 12 }} onClick={closeTokenModal}>
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ width: "min(96vw,560px)", maxHeight: "92vh", overflowY: "auto", background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,.7)", padding: isMobile ? 14 : 18, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: ".08em" }}>API TOKEN</div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{user?.email || ""}</div>
          <button onClick={closeTokenModal} style={{ background: "transparent", border: `1px solid ${T.b1}`, color: T.t1, padding: "4px 8px", borderRadius: 7, cursor: "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>Close</button>
        </div>
        <form onSubmit={generateApiToken} style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, color: T.t1, fontWeight: 600 }}>Token name</span>
            <input value={tokenName} onChange={(e) => setTokenName(e.target.value)} placeholder="codex-cli" style={{ background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "9px 10px", color: T.t0, fontSize: 12, fontFamily: "'DM Sans',sans-serif", outline: "none" }} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <span style={{ fontSize: 11, color: T.t1, fontWeight: 600 }}>Expires in days</span>
            <input type="number" min={1} max={3650} value={tokenDays} onChange={(e) => setTokenDays(Number(e.target.value) || 0)} style={{ background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "9px 10px", color: T.t0, fontSize: 12, fontFamily: "'JetBrains Mono',monospace", outline: "none", width: 140 }} />
          </label>
          {tokenError && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 8, color: "#fca5a5", fontSize: 11, padding: "8px 10px" }}>{tokenError}</div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" onClick={closeTokenModal} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 11 }}>Cancel</button>
            <button type="submit" disabled={tokenBusy} style={{ background: tokenBusy ? T.bg3 : T.yBg, border: `1px solid ${tokenBusy ? T.b1 : T.yDim}`, color: tokenBusy ? T.t2 : T.y, padding: "7px 12px", borderRadius: 8, cursor: tokenBusy ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
              {tokenBusy ? "Generating..." : "Generate Token"}
            </button>
          </div>
        </form>
        {!!issuedToken && <div style={{ background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 11, color: T.t1 }}>
            Token generated. Copy now and save it in a secure place.
          </div>
          <textarea readOnly value={issuedToken} rows={isMobile ? 6 : 4} style={{ width: "100%", background: T.bg0, border: `1px solid ${T.b1}`, borderRadius: 8, color: T.t0, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", padding: "8px 9px", resize: "vertical" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={copyIssuedToken} style={{ background: T.yBg, border: `1px solid ${T.yDim}`, color: T.y, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
              {tokenCopied ? "Copied" : "Copy Token"}
            </button>
            <span style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>
              Expires: {fmtTokenTs(issuedMeta?.expiresAt)}
            </span>
          </div>
        </div>}
        <div style={{ background: T.bg3, border: `1px solid ${T.b1}`, borderRadius: 10, padding: 10, display: "grid", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 11, color: T.t1, fontWeight: 600 }}>Your API tokens</div>
            <button type="button" onClick={() => loadApiTokens()} disabled={tokenListLoading || tokenBusy || Boolean(tokenRevokeId)} style={{ marginLeft: "auto", background: T.bg2, border: `1px solid ${T.b1}`, color: T.t1, padding: "4px 8px", borderRadius: 7, cursor: tokenListLoading ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace" }}>
              {tokenListLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {tokenListErr && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 8, color: "#fca5a5", fontSize: 11, padding: "8px 10px" }}>{tokenListErr}</div>}
          {!tokenListErr && tokenListLoading && <div style={{ fontSize: 11, color: T.t2 }}>Loading tokens...</div>}
          {!tokenListErr && !tokenListLoading && tokenItems.length === 0 && <div style={{ fontSize: 11, color: T.t2 }}>No tokens yet.</div>}
          {!tokenListErr && !tokenListLoading && tokenItems.length > 0 && <div style={{ display: "grid", gap: 8 }}>
            {tokenItems.map((item, idx) => {
              const st = tokenStatusMeta(item?.status);
              const canRevoke = String(item?.status || "active") === "active";
              const isRevoking = tokenRevokeId === item?.id;
              return <div key={`${item?.id || "token"}-${idx}`} style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "8px 9px", display: "grid", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: T.t0, fontWeight: 600, maxWidth: "60%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item?.name || "api-token"}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", padding: "2px 7px", borderRadius: 99, color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                    {st.label}
                  </span>
                </div>
                <div style={{ display: "grid", gap: 2, fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>
                  <div>Created: {fmtTokenTs(item?.createdAt)}</div>
                  <div>Expires: {fmtTokenTs(item?.expiresAt)}</div>
                  <div>Last used: {fmtTokenTs(item?.lastUsedAt)}</div>
                  {item?.revokedAt ? <div>Revoked: {fmtTokenTs(item?.revokedAt)}</div> : null}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {canRevoke
                    ? <button type="button" onClick={() => revokeApiToken(item?.id)} disabled={isRevoking || tokenBusy || tokenListLoading} style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.35)", color: "#fca5a5", padding: "5px 9px", borderRadius: 7, cursor: isRevoking ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                      {isRevoking ? "Revoking..." : "Revoke"}
                    </button>
                    : <span style={{ fontSize: 10, color: T.t3, fontFamily: "'JetBrains Mono',monospace" }}>Read-only</span>}
                </div>
              </div>;
            })}
          </div>}
        </div>
      </div>
    </div>}

    {/* Delete confirm modal */}
    {delId && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" }} onClick={() => setDelId(null)}>
      <div className="pop" onClick={(e) => e.stopPropagation()} style={{ background: T.bg2, border: `1px solid ${T.b2}`, borderRadius: 14, padding: isMobile ? 18 : 24, width: "min(92vw,320px)", boxShadow: "0 16px 48px rgba(0,0,0,.7)" }}>
        <p style={{ color: T.t0, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>Delete board <strong>"{boards.find((b) => b.id === delId)?.name}"</strong>? This is irreversible.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={() => setDelId(null)} style={{ background: T.bg3, border: `1px solid ${T.b1}`, color: T.t1, padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => deleteBoard(delId)} style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.4)", color: "#fca5a5", padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>}
    {healthDrawerOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 1001, backdropFilter: "blur(4px)" }} onClick={() => setHealthDrawerOpen(false)}>
      <div className="slide" onClick={(e) => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(94vw,460px)", background: T.bg1, borderLeft: `1px solid ${T.b1}`, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.b0}`, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, letterSpacing: ".07em" }}>EXECUTION HEALTH DETAILS</span>
          <span style={{ marginLeft: "auto", fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>{healthBoard?.name || "-"}</span>
          <button onClick={() => setHealthDrawerOpen(false)} style={{ background: "transparent", border: `1px solid ${T.b1}`, color: T.t1, padding: "4px 8px", borderRadius: 7, fontSize: 10, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace" }}>Close</button>
        </div>
        <div style={{ padding: "12px 12px 16px", overflowY: "auto", display: "grid", gap: 10 }}>
          {healthLoading && <div style={{ fontSize: 11, color: T.t2 }}>Loading...</div>}
          {!healthLoading && healthErr && <div style={{ fontSize: 11, color: "#fca5a5" }}>{healthErr}</div>}
          {!healthLoading && !healthErr && Object.keys(groupedIssues).length === 0 && <div style={{ fontSize: 11, color: "#86efac" }}>No issues detected.</div>}
          {!healthLoading && !healthErr && Object.entries(groupedIssues).map(([type, list]) => <div key={type} style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 10, padding: "8px 8px 6px" }}>
            <div style={{ fontSize: 10, color: T.y, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, marginBottom: 6, letterSpacing: ".04em" }}>{issueTypeLabel[type] || type} ({list.length})</div>
            <div style={{ display: "grid", gap: 6 }}>
              {list.map((issue, idx) => {
                const canFocus = Boolean(issue?.sourceNodeId);
                return <button key={`${issue.id || type}-${idx}`} onClick={() => {
                  if (!healthBoard) return;
                  setHealthDrawerOpen(false);
                  onSelect(healthBoard.id, healthBoard.name, { focusNodeId: issue?.sourceNodeId || null });
                }} disabled={!canFocus}
                  title={canFocus ? "Open board and focus node" : "TODO: issue has no source node id"}
                  style={{ textAlign: "left", background: T.bg3, border: `1px solid ${canFocus ? T.b1 : T.b0}`, borderRadius: 8, padding: "7px 8px", color: canFocus ? T.t0 : T.t2, cursor: canFocus ? "pointer" : "not-allowed", fontSize: 11, lineHeight: 1.35 }}>
                  {issue.message || `${type} issue`}
                </button>;
              })}
            </div>
          </div>)}
        </div>
      </div>
    </div>}
  </div>;
}
