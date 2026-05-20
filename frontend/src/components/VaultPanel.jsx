import { useCallback, useEffect, useMemo, useState } from "react";

const SCOPE_OPTIONS = [
  { value: "global", label: "global" },
  { value: "project", label: "project" },
  { value: "site", label: "site" },
  { value: "subscription", label: "subscription" },
  { value: "other", label: "other" },
];

const CATEGORY_OPTIONS = [
  { value: "api", label: "api" },
  { value: "password", label: "password" },
  { value: "env", label: "env" },
  { value: "database", label: "database" },
  { value: "user", label: "user" },
  { value: "script", label: "script" },
  { value: "subscription", label: "subscription" },
  { value: "token", label: "token" },
  { value: "note", label: "note" },
  { value: "other", label: "other" },
];

function tsToDateInput(sec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n * 1000);
  return d.toISOString().slice(0, 10);
}

export default function VaultPanel({ T, vaultApi, notify }) {
  const [loading, setLoading] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [revealingId, setRevealingId] = useState("");
  const [projects, setProjects] = useState([]);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ totals: { projects: 0, records: 0 }, dueSoon30d: 0 });
  const [subscriptions, setSubscriptions] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [category, setCategory] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [projectForm, setProjectForm] = useState({
    name: "",
    slug: "",
    stack: "",
    repoUrl: "",
  });
  const [recordForm, setRecordForm] = useState({
    scope: "global",
    projectId: "",
    category: "api",
    title: "",
    username: "",
    secret: "",
    url: "",
    tags: "",
    notes: "",
    costAmount: "",
    costCurrency: "EUR",
    renewsAt: "",
    expiresAt: "",
  });

  const canUseVault = Boolean(vaultApi?.records && vaultApi?.projects);

  const loadData = useCallback(async () => {
    if (!canUseVault) return;
    setLoading(true);
    try {
      const [projectsPayload, recordsPayload, summaryPayload, subsPayload] = await Promise.all([
        vaultApi.projects({ limit: 300 }),
        vaultApi.records({
          q: q || undefined,
          scope: scope !== "all" ? scope : undefined,
          category: category !== "all" ? category : undefined,
          projectId: projectFilter !== "all" ? projectFilter : undefined,
          limit: 200,
        }),
        vaultApi.summary(),
        vaultApi.subscriptions({ days: 45, limit: 30 }),
      ]);
      setProjects(Array.isArray(projectsPayload?.items) ? projectsPayload.items : []);
      setRecords(Array.isArray(recordsPayload?.items) ? recordsPayload.items : []);
      setSummary(summaryPayload || { totals: { projects: 0, records: 0 }, dueSoon30d: 0 });
      setSubscriptions(Array.isArray(subsPayload?.items) ? subsPayload.items : []);
    } catch (error) {
      notify?.(error?.message || "Vault load failed", "error");
    } finally {
      setLoading(false);
    }
  }, [canUseVault, vaultApi, q, scope, category, projectFilter, notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const projectMap = useMemo(() => {
    const out = {};
    for (const project of projects) out[project.id] = project;
    return out;
  }, [projects]);

  const onCreateProject = async (e) => {
    e.preventDefault();
    if (!projectForm.name.trim()) {
      notify?.("Project name is required", "warn");
      return;
    }
    setSavingProject(true);
    try {
      await vaultApi.createProject({
        name: projectForm.name,
        slug: projectForm.slug,
        stack: projectForm.stack,
        repoUrl: projectForm.repoUrl,
      });
      setProjectForm({ name: "", slug: "", stack: "", repoUrl: "" });
      notify?.("Project saved", "ok");
      await loadData();
    } catch (error) {
      notify?.(error?.message || "Project save failed", "error");
    } finally {
      setSavingProject(false);
    }
  };

  const onCreateRecord = async (e) => {
    e.preventDefault();
    if (!recordForm.title.trim()) {
      notify?.("Record title is required", "warn");
      return;
    }
    if (recordForm.scope === "project" && !recordForm.projectId) {
      notify?.("Pick a project for project scope", "warn");
      return;
    }
    setSavingRecord(true);
    try {
      await vaultApi.createRecord({
        scope: recordForm.scope,
        projectId: recordForm.projectId || null,
        category: recordForm.category,
        title: recordForm.title,
        username: recordForm.username,
        secret: recordForm.secret,
        url: recordForm.url,
        tags: recordForm.tags,
        notes: recordForm.notes,
        costAmount: recordForm.costAmount,
        costCurrency: recordForm.costCurrency,
        renewsAt: recordForm.renewsAt || null,
        expiresAt: recordForm.expiresAt || null,
      });
      setRecordForm((prev) => ({
        ...prev,
        title: "",
        username: "",
        secret: "",
        url: "",
        tags: "",
        notes: "",
        costAmount: "",
        renewsAt: "",
        expiresAt: "",
      }));
      notify?.("Record saved", "ok");
      await loadData();
    } catch (error) {
      notify?.(error?.message || "Record save failed", "error");
    } finally {
      setSavingRecord(false);
    }
  };

  const onReveal = async (recordId) => {
    if (!recordId || revealingId) return;
    setRevealingId(recordId);
    try {
      const payload = await vaultApi.reveal(recordId);
      setRevealed((prev) => ({ ...prev, [recordId]: payload?.secret || "" }));
    } catch (error) {
      notify?.(error?.message || "Reveal failed", "error");
    } finally {
      setRevealingId("");
    }
  };

  if (!canUseVault) {
    return <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "10px 12px", color: T.t2, fontSize: 11 }}>
      Vault API unavailable.
    </div>;
  }

  return <div style={{ borderBottom: `1px solid ${T.b0}`, padding: "10px 12px", background: T.bg1 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: T.y, fontFamily: "'JetBrains Mono',monospace" }}>PROJECT VAULT</span>
      <span style={{ marginLeft: "auto", fontSize: 10, color: T.t2 }}>
        {loading ? "loading..." : `${records.length} records`}
      </span>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6, marginBottom: 8 }}>
      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "6px 7px", background: T.bg2 }}>
        <div style={{ fontSize: 9, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>projects</div>
        <div style={{ fontSize: 12, color: T.t0, fontWeight: 700 }}>{summary?.totals?.projects || 0}</div>
      </div>
      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "6px 7px", background: T.bg2 }}>
        <div style={{ fontSize: 9, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>records</div>
        <div style={{ fontSize: 12, color: T.t0, fontWeight: 700 }}>{summary?.totals?.records || 0}</div>
      </div>
      <div style={{ border: `1px solid ${T.b1}`, borderRadius: 8, padding: "6px 7px", background: T.bg2 }}>
        <div style={{ fontSize: 9, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>due 30d</div>
        <div style={{ fontSize: 12, color: (summary?.dueSoon30d || 0) > 0 ? T.y : T.t0, fontWeight: 700 }}>{summary?.dueSoon30d || 0}</div>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr .9fr", gap: 6, marginBottom: 8 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search title/user/url..."
        style={{ minHeight: 32, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }}
      />
      <select value={scope} onChange={(e) => setScope(e.target.value)} style={{ minHeight: 32, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, fontSize: 11, padding: "0 6px", outline: "none" }}>
        <option value="all">scope: all</option>
        {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ minHeight: 32, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, fontSize: 11, padding: "0 6px", outline: "none" }}>
        <option value="all">category: all</option>
        {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    <div style={{ marginBottom: 10 }}>
      <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} style={{ width: "100%", minHeight: 32, borderRadius: 7, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, fontSize: 11, padding: "0 6px", outline: "none" }}>
        <option value="all">project: all</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
    </div>

    <form onSubmit={onCreateProject} style={{ border: `1px solid ${T.b1}`, borderRadius: 9, background: T.bg2, padding: "8px", marginBottom: 8, display: "grid", gap: 6 }}>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>ADD PROJECT</div>
      <input value={projectForm.name} onChange={(e) => setProjectForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Project name" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={projectForm.slug} onChange={(e) => setProjectForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="slug (optional)" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
        <input value={projectForm.stack} onChange={(e) => setProjectForm((prev) => ({ ...prev, stack: e.target.value }))} placeholder="stack" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      </div>
      <input value={projectForm.repoUrl} onChange={(e) => setProjectForm((prev) => ({ ...prev, repoUrl: e.target.value }))} placeholder="repo URL" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      <button type="submit" disabled={savingProject} style={{ minHeight: 32, borderRadius: 7, border: `1px solid ${savingProject ? T.b1 : T.yDim}`, background: savingProject ? T.bg3 : T.yBg, color: savingProject ? T.t2 : T.y, cursor: savingProject ? "not-allowed" : "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
        {savingProject ? "Saving..." : "Save project"}
      </button>
    </form>

    <form onSubmit={onCreateRecord} style={{ border: `1px solid ${T.b1}`, borderRadius: 9, background: T.bg2, padding: "8px", marginBottom: 8, display: "grid", gap: 6 }}>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".05em" }}>ADD RECORD</div>
      <input value={recordForm.title} onChange={(e) => setRecordForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Title (ex: OpenAI API prod)" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <select value={recordForm.scope} onChange={(e) => setRecordForm((prev) => ({ ...prev, scope: e.target.value }))} style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, fontSize: 11, padding: "0 6px", outline: "none" }}>
          {SCOPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={recordForm.category} onChange={(e) => setRecordForm((prev) => ({ ...prev, category: e.target.value }))} style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, fontSize: 11, padding: "0 6px", outline: "none" }}>
          {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <select value={recordForm.projectId} onChange={(e) => setRecordForm((prev) => ({ ...prev, projectId: e.target.value }))} style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, fontSize: 11, padding: "0 6px", outline: "none" }}>
        <option value="">project (optional)</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <input value={recordForm.username} onChange={(e) => setRecordForm((prev) => ({ ...prev, username: e.target.value }))} placeholder="username/email" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
        <input value={recordForm.secret} onChange={(e) => setRecordForm((prev) => ({ ...prev, secret: e.target.value }))} placeholder="secret/password/token" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      </div>
      <input value={recordForm.url} onChange={(e) => setRecordForm((prev) => ({ ...prev, url: e.target.value }))} placeholder="URL / endpoint / host" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      <input value={recordForm.tags} onChange={(e) => setRecordForm((prev) => ({ ...prev, tags: e.target.value }))} placeholder="tags (comma separated)" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        <input value={recordForm.costAmount} onChange={(e) => setRecordForm((prev) => ({ ...prev, costAmount: e.target.value }))} placeholder="cost" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
        <input value={recordForm.costCurrency} onChange={(e) => setRecordForm((prev) => ({ ...prev, costCurrency: e.target.value.toUpperCase() }))} placeholder="currency" style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
        <input type="date" value={recordForm.renewsAt} onChange={(e) => setRecordForm((prev) => ({ ...prev, renewsAt: e.target.value }))} style={{ minHeight: 30, borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "0 8px", fontSize: 11, outline: "none" }} />
      </div>
      <textarea value={recordForm.notes} onChange={(e) => setRecordForm((prev) => ({ ...prev, notes: e.target.value }))} placeholder="notes / connection script / test users..." rows={2} style={{ borderRadius: 6, border: `1px solid ${T.b1}`, background: T.bg3, color: T.t0, padding: "6px 8px", fontSize: 11, outline: "none", resize: "vertical" }} />
      <button type="submit" disabled={savingRecord} style={{ minHeight: 32, borderRadius: 7, border: `1px solid ${savingRecord ? T.b1 : T.yDim}`, background: savingRecord ? T.bg3 : T.yBg, color: savingRecord ? T.t2 : T.y, cursor: savingRecord ? "not-allowed" : "pointer", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
        {savingRecord ? "Saving..." : "Save record"}
      </button>
    </form>

    <div style={{ border: `1px solid ${T.b1}`, borderRadius: 9, background: T.bg2, maxHeight: 260, overflow: "auto", padding: "6px" }}>
      {records.length === 0 && <div style={{ fontSize: 10.5, color: T.t2, padding: "4px 6px" }}>No records found.</div>}
      {records.map((record) => <div key={record.id} style={{ border: `1px solid ${T.b1}`, borderRadius: 7, background: T.bg3, padding: "7px 8px", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 11.5, color: T.t0, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.title}</div>
          <span style={{ marginLeft: "auto", fontSize: 9.5, color: T.t2 }}>{record.scope}</span>
        </div>
        <div style={{ fontSize: 10, color: T.t2, marginTop: 2 }}>
          {record.category}{record.projectId ? ` | ${projectMap[record.projectId]?.name || record.projectName || "project"}` : ""}
          {record.username ? ` | ${record.username}` : ""}
        </div>
        {record.url && <div style={{ fontSize: 10, color: T.t2, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{record.url}</div>}
        {record.hasSecret && <div style={{ marginTop: 5, display: "grid", gap: 5 }}>
          <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace" }}>secret: {record.secretHint || "saved"}</div>
          {revealed[record.id] && <input readOnly value={revealed[record.id]} style={{ minHeight: 28, borderRadius: 6, border: `1px solid ${T.yDim}`, background: T.yBg, color: T.y, padding: "0 8px", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace" }} />}
          <button onClick={() => onReveal(record.id)} disabled={revealingId === record.id} style={{ minHeight: 28, borderRadius: 6, border: `1px solid ${revealingId === record.id ? T.b1 : T.yDim}`, background: revealingId === record.id ? T.bg2 : T.yBg, color: revealingId === record.id ? T.t2 : T.y, cursor: revealingId === record.id ? "not-allowed" : "pointer", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
            {revealingId === record.id ? "Revealing..." : "Reveal"}
          </button>
        </div>}
        {record.notes && <div style={{ fontSize: 10, color: T.t1, marginTop: 5, whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{record.notes}</div>}
      </div>)}
    </div>

    {subscriptions.length > 0 && <div style={{ marginTop: 8, border: `1px solid ${T.b1}`, borderRadius: 9, background: T.bg2, padding: "7px 8px" }}>
      <div style={{ fontSize: 10, color: T.t2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 6, letterSpacing: ".05em" }}>SUBSCRIPTIONS (45d)</div>
      {subscriptions.slice(0, 5).map((item) => <div key={item.id} style={{ fontSize: 10.5, color: item.isExpired ? "#fca5a5" : T.t1, marginBottom: 4 }}>
        {item.title} - {item.nextDueAt ? tsToDateInput(item.nextDueAt) : "no date"}
      </div>)}
    </div>}
  </div>;
}
