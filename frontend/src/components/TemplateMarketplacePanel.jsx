
import { useEffect, useMemo, useState } from "react";

const DEFAULT_CATEGORIES = [
  "Product Management",
  "Startup Planning",
  "Marketing",
  "Engineering",
  "Brainstorming",
  "Meetings",
];

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function tagsFromInput(raw) {
  return String(raw || "")
    .split(/[;,|]/)
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function parseAiPayload(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  const txt = String(raw).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(txt);
  } catch {
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i !== -1 && j > i) {
      try {
        return JSON.parse(txt.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeAiGraph(payload, uid, T) {
  const inNodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
  const inArrows = Array.isArray(payload?.arrows) ? payload.arrows : [];
  const idMap = new Map();
  const nodes = [];
  inNodes.slice(0, 56).forEach((node, idx) => {
    const rawId = String(node?.id || `n${idx + 1}`);
    const id = uid();
    idMap.set(rawId, id);
    const typeRaw = String(node?.type || "shape").toLowerCase();
    const type = ["shape", "sticky", "text", "frame", "task", "milestone", "decision"].includes(typeRaw) ? typeRaw : "shape";
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const baseX = Math.round(-360 + col * 220);
    const baseY = Math.round(-220 + row * 150);
    const x = Math.round(Number.isFinite(Number(node?.x)) ? Number(node.x) : baseX);
    const y = Math.round(Number.isFinite(Number(node?.y)) ? Number(node.y) : baseY);
    const next = {
      id,
      type,
      x,
      y,
      w: Math.round(Number.isFinite(Number(node?.w)) ? Number(node.w) : 190),
      h: Math.round(Number.isFinite(Number(node?.h)) ? Number(node.h) : 96),
      text: String(node?.text || node?.title || "Node"),
    };
    if (type === "shape") {
      next.shapeType = String(node?.shapeType || "rect");
      next.color = String(node?.color || T.bg3);
      next.textColor = String(node?.textColor || T.t0);
      next.borderColor = String(node?.borderColor || T.b1);
      next.fontSize = Math.round(Number.isFinite(Number(node?.fontSize)) ? Number(node.fontSize) : 13);
      next.fontWeight = String(node?.fontWeight || "600");
    } else if (type === "sticky") {
      next.w = Math.round(Number.isFinite(Number(node?.w)) ? Number(node.w) : 176);
      next.h = Math.round(Number.isFinite(Number(node?.h)) ? Number(node.h) : 124);
      next.color = String(node?.color || "#fef9c3");
      next.textColor = String(node?.textColor || "#713f12");
      next.borderColor = String(node?.borderColor || "rgba(245,158,11,.55)");
    } else if (type === "text") {
      next.w = Math.round(Number.isFinite(Number(node?.w)) ? Number(node.w) : 260);
      next.h = Math.round(Number.isFinite(Number(node?.h)) ? Number(node.h) : 56);
      next.color = "transparent";
      next.textColor = String(node?.textColor || T.t0);
      next.fontSize = Math.round(Number.isFinite(Number(node?.fontSize)) ? Number(node.fontSize) : 24);
      next.fontWeight = String(node?.fontWeight || "700");
      next.textAlign = "left";
    } else if (type === "frame") {
      next.w = Math.round(Number.isFinite(Number(node?.w)) ? Number(node.w) : 540);
      next.h = Math.round(Number.isFinite(Number(node?.h)) ? Number(node.h) : 340);
      next.color = "transparent";
      next.borderColor = String(node?.borderColor || T.b1);
    }
    nodes.push(next);
  });
  const nodeSet = new Set(nodes.map(n => n.id));
  const arrows = [];
  inArrows.slice(0, 120).forEach(arrow => {
    const fromRaw = String(arrow?.fromId || arrow?.from || arrow?.source || "").trim();
    const toRaw = String(arrow?.toId || arrow?.to || arrow?.target || "").trim();
    if (!fromRaw || !toRaw) return;
    const fromId = idMap.get(fromRaw) || fromRaw;
    const toId = idMap.get(toRaw) || toRaw;
    if (!nodeSet.has(fromId) || !nodeSet.has(toId) || fromId === toId) return;
    arrows.push({ id: uid(), fromId, toId, label: String(arrow?.label || "").slice(0, 120) });
  });
  return { nodes, arrows, comments: [], votes: {} };
}

function buildFallbackGraph(prompt, uid, T) {
  const words = String(prompt || "")
    .split(/[\s,.;:!?]+/)
    .map(v => v.trim())
    .filter(Boolean)
    .slice(0, 5);
  const labels = words.length ? words : ["Discovery", "Build", "Validate", "Launch", "Iterate"];
  const rootId = uid();
  const root = {
    id: rootId,
    type: "shape",
    shapeType: "rect",
    x: -80,
    y: -220,
    w: 220,
    h: 88,
    text: String(prompt || "Execution Template").slice(0, 80),
    color: T.bg3,
    textColor: T.t0,
    borderColor: T.yDim,
    fontSize: 13,
    fontWeight: "700",
  };
  const nodes = [root];
  const arrows = [];
  labels.forEach((label, idx) => {
    const id = uid();
    nodes.push({
      id,
      type: "sticky",
      x: -280 + idx * 150,
      y: -40 + (idx % 2) * 140,
      w: 132,
      h: 108,
      text: label,
      color: "#fef9c3",
      textColor: "#713f12",
      borderColor: "rgba(245,158,11,.55)",
    });
    arrows.push({
      id: uid(),
      fromId: rootId,
      toId: id,
      label: "step",
    });
  });
  return { nodes, arrows, comments: [], votes: {} };
}

function previewBounds(nodes) {
  if (!nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
  const minX = Math.min(...nodes.map(n => num(n?.x, 0)));
  const minY = Math.min(...nodes.map(n => num(n?.y, 0)));
  const maxX = Math.max(...nodes.map(n => num(n?.x, 0) + Math.max(40, num(n?.w, 120))));
  const maxY = Math.max(...nodes.map(n => num(n?.y, 0) + Math.max(30, num(n?.h, 80))));
  return { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
}

function MiniPreview({ preview, T, height = 170 }) {
  const nodes = Array.isArray(preview?.nodes) ? preview.nodes : [];
  const arrows = Array.isArray(preview?.arrows) ? preview.arrows : [];
  const b = previewBounds(nodes);
  const pad = 10;
  const width = 320;
  const scale = Math.max(0.08, Math.min((width - pad * 2) / b.w, (height - pad * 2) / b.h));
  const pos = new Map();
  nodes.forEach(n => {
    const x = pad + (num(n?.x, 0) - b.x) * scale;
    const y = pad + (num(n?.y, 0) - b.y) * scale;
    const w = Math.max(7, Math.min(90, num(n?.w, 120) * scale));
    const h = Math.max(7, Math.min(64, num(n?.h, 80) * scale));
    pos.set(String(n?.id || ""), { x, y, w, h });
  });
  return <div style={{ height, borderRadius: 10, border: `1px solid ${T.b1}`, background: T.bg1, position: "relative", overflow: "hidden" }}>
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute", inset: 0 }}>
      {arrows.slice(0, 140).map(a => {
        const from = pos.get(String(a?.fromId || ""));
        const to = pos.get(String(a?.toId || ""));
        if (!from || !to) return null;
        return <line key={String(a?.id || `${from.x}_${to.x}`)} x1={from.x + from.w * .5} y1={from.y + from.h * .5} x2={to.x + to.w * .5} y2={to.y + to.h * .5} stroke={T.b2} strokeWidth={1.2} />;
      })}
    </svg>
    {nodes.slice(0, 90).map(n => {
      const p = pos.get(String(n?.id || ""));
      if (!p) return null;
      const fill = String(n?.color || T.bg3);
      return <div key={String(n?.id || Math.random())} style={{ position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h, borderRadius: Math.max(4, Math.min(12, p.h * .16)), border: `1px solid ${String(n?.borderColor || T.b1)}`, background: fill === "transparent" ? "rgba(148,163,184,.08)" : fill }} />;
    })}
  </div>;
}

export default function TemplateMarketplacePanel({
  open,
  onClose,
  isMobile = false,
  api,
  T,
  uid,
  boardId,
  boardData,
  currentUser,
  onInsertData,
  onOpenBoard,
  notify,
}) {
  const pageSize = isMobile ? 8 : 12;
  const [scope, setScope] = useState("marketplace");
  const [sort, setSort] = useState("featured");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState(["all", ...DEFAULT_CATEGORIES]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [refreshSeq, setRefreshSeq] = useState(0);

  const [saveName, setSaveName] = useState("Board Template");
  const [saveDesc, setSaveDesc] = useState("");
  const [saveTags, setSaveTags] = useState("");
  const [saveCategory, setSaveCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [saveVisibility, setSaveVisibility] = useState("private");
  const [versionNote, setVersionNote] = useState("");

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiGraph, setAiGraph] = useState(null);
  const [aiName, setAiName] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [aiTags, setAiTags] = useState("");
  const [aiCategory, setAiCategory] = useState(DEFAULT_CATEGORIES[0]);
  const [aiVisibility, setAiVisibility] = useState("private");

  const selectedSummary = useMemo(() => items.find(it => it.id === selectedId) || null, [items, selectedId]);
  const canEditSelected = Boolean(detail?.creator?.userId && currentUser?.id && String(detail.creator.userId) === String(currentUser.id));

  useEffect(() => {
    if (!open) return;
    let done = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await api.templatesList({ scope, sort, q: q.trim(), category, page, pageSize });
        if (done) return;
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        setItems(rows);
        setTotal(Math.max(0, num(payload?.total, rows.length)));
        setTotalPages(Math.max(1, num(payload?.totalPages, 1)));
        const cats = ["all", ...(Array.isArray(payload?.categories) ? payload.categories : DEFAULT_CATEGORIES)]
          .map(v => String(v || "").trim())
          .filter(Boolean);
        setCategories([...new Set(cats)]);
        if (!rows.length) {
          setSelectedId("");
          setDetail(null);
          setPreview(null);
          setVersions([]);
          setSelectedVersion("");
        } else if (!rows.some(r => r.id === selectedId)) {
          setSelectedId(rows[0].id);
        }
      } catch (err) {
        if (done) return;
        setItems([]);
        setError(err?.message || "Failed to load templates");
      } finally {
        if (!done) setLoading(false);
      }
    }, q ? 180 : 0);
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [api, category, open, page, pageSize, q, refreshSeq, scope, selectedId, sort]);

  useEffect(() => {
    if (!open || !selectedId) return;
    let done = false;
    setDetail(null);
    setVersions([]);
    api.templateDetail(selectedId).then(payload => {
      if (done) return;
      const tpl = payload?.template || null;
      const list = Array.isArray(payload?.versions) ? payload.versions : [];
      setDetail(tpl);
      setVersions(list);
      const latest = num(tpl?.latest_version, num(list[0]?.version, 1));
      setSelectedVersion(prev => {
        if (prev && list.some(v => String(v?.version) === String(prev))) return prev;
        return String(latest || 1);
      });
    }).catch(err => {
      if (done) return;
      notify?.(`Template details failed: ${err?.message || "unknown error"}`, "error");
      setDetail(null);
      setVersions([]);
    });
    return () => {
      done = true;
    };
  }, [api, notify, open, refreshSeq, selectedId]);

  useEffect(() => {
    if (!open || !selectedId) return;
    let done = false;
    setPreviewBusy(true);
    api.templatePreview(selectedId, { version: selectedVersion || undefined }).then(payload => {
      if (done) return;
      setPreview(payload || null);
    }).catch(err => {
      if (done) return;
      setPreview(null);
      notify?.(`Preview failed: ${err?.message || "unknown error"}`, "error");
    }).finally(() => {
      if (!done) setPreviewBusy(false);
    });
    return () => {
      done = true;
    };
  }, [api, notify, open, selectedId, selectedVersion]);

  function refresh() {
    setRefreshSeq(v => v + 1);
  }

  async function withBusy(label, fn) {
    if (busyAction) return;
    setBusyAction(label);
    try {
      await fn();
    } finally {
      setBusyAction("");
    }
  }

  async function saveBoardAsTemplate() {
    const name = String(saveName || "").trim();
    if (!name) {
      notify?.("Template name is required", "warn");
      return;
    }
    await withBusy("save-template", async () => {
      const payload = {
        name,
        description: String(saveDesc || "").trim(),
        category: saveCategory,
        tags: tagsFromInput(saveTags),
        visibility: saveVisibility,
      };
      if (boardId) payload.boardId = boardId;
      else payload.data = boardData;
      const response = await api.templateCreate(payload);
      notify?.("Template saved", "success");
      if (response?.template?.id) {
        setScope("mine");
        setPage(1);
        setSelectedId(response.template.id);
      }
      refresh();
    });
  }

  async function createBoardFromTemplate() {
    if (!selectedId) return;
    await withBusy("use-template", async () => {
      const response = await api.templateUse(selectedId, { version: selectedVersion || undefined, boardName: `${String(detail?.name || "Template").slice(0, 100)} Board` });
      notify?.("Board created from template", "success");
      onClose?.();
      refresh();
      if (response?.board?.id && typeof onOpenBoard === "function") onOpenBoard(response.board);
    });
  }

  async function togglePublish() {
    if (!selectedId || !detail) return;
    const next = detail.visibility === "public" ? "private" : "public";
    await withBusy("publish", async () => {
      await api.templatePublish(selectedId, next);
      notify?.(`Template set to ${next}`, "success");
      refresh();
    });
  }

  async function addVersion() {
    if (!selectedId) return;
    await withBusy("version", async () => {
      const payload = { note: String(versionNote || "").trim() };
      if (boardId) payload.boardId = boardId;
      else payload.data = boardData;
      await api.templateAddVersion(selectedId, payload);
      setVersionNote("");
      notify?.("Template version created", "success");
      refresh();
    });
  }

  async function toggleBookmark() {
    if (!selectedId || !detail) return;
    await withBusy("bookmark", async () => {
      const response = await api.templateBookmark(selectedId, !detail.bookmarked);
      setDetail(prev => prev ? { ...prev, bookmarked: Boolean(response?.bookmarked), bookmark_count: num(response?.bookmark_count, prev.bookmark_count) } : prev);
      setItems(prev => prev.map(it => it.id === selectedId ? { ...it, bookmarked: Boolean(response?.bookmarked), bookmark_count: num(response?.bookmark_count, it.bookmark_count) } : it));
    });
  }

  async function rateTemplate(value) {
    if (!selectedId || !detail) return;
    await withBusy("rate", async () => {
      const response = await api.templateRate(selectedId, value);
      setDetail(prev => prev ? {
        ...prev,
        my_rating: num(response?.my_rating, value),
        rating_avg: num(response?.avg, prev.rating_avg),
        rating_count: num(response?.count, prev.rating_count),
      } : prev);
      setItems(prev => prev.map(it => it.id === selectedId ? {
        ...it,
        my_rating: num(response?.my_rating, value),
        rating_avg: num(response?.avg, it.rating_avg),
        rating_count: num(response?.count, it.rating_count),
      } : it));
    });
  }

  async function runAiTemplate() {
    const prompt = String(aiPrompt || "").trim();
    if (!prompt || aiBusy) return;
    setAiBusy(true);
    try {
      const systemPrompt = [
        "You generate whiteboard templates.",
        "Return one JSON object only. No markdown.",
        "Schema: { template:{name,description,category,tags[]}, nodes:[{id,type,text,x,y,w,h,shapeType}], arrows:[{from,to,label}] }",
        "Node types: shape|sticky|text|frame|task|milestone|decision.",
        "Max 32 nodes and 64 arrows.",
      ].join(" ");
      const response = await fetch("/api/ai/complete", {
        method: "POST",
        headers: { ...api._ah(), "Content-Type": "application/json" },
        body: JSON.stringify({ systemPrompt, userPrompt: prompt, maxTokens: 900 }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `AI request failed (${response.status})`);
      const parsed = parseAiPayload(payload?.json || payload?.text);
      if (!parsed || typeof parsed !== "object") throw new Error("AI returned invalid JSON");
      const graph = normalizeAiGraph(parsed, uid, T);
      if (!graph.nodes.length) throw new Error("AI returned no nodes");
      setAiGraph(graph);
      const meta = parsed?.template && typeof parsed.template === "object" ? parsed.template : {};
      setAiName(String(meta?.name || `${prompt.slice(0, 42)} Template`).trim() || "AI Template");
      setAiDesc(String(meta?.description || `AI generated template for \"${prompt}\"`).trim());
      setAiCategory(String(meta?.category || DEFAULT_CATEGORIES[0]).trim() || DEFAULT_CATEGORIES[0]);
      setAiTags(Array.isArray(meta?.tags) ? meta.tags.join(", ") : "");
      notify?.("AI template generated", "success");
    } catch (err) {
      const msg = String(err?.message || "unknown error");
      if (/504|timed out|timeout|gateway/i.test(msg)) {
        const fallback = buildFallbackGraph(prompt, uid, T);
        setAiGraph(fallback);
        setAiName(`${prompt.slice(0, 42) || "AI"} Template`);
        setAiDesc("Fallback template generated locally (AI provider timeout).");
        setAiCategory(DEFAULT_CATEGORIES[0]);
        setAiTags("");
        notify?.("AI timeout. Generated a local fallback template.", "warn");
      } else {
        notify?.(`AI generation failed: ${msg}`, "error");
        setAiGraph(null);
      }
    } finally {
      setAiBusy(false);
    }
  }

  function insertAiGraph() {
    if (!aiGraph?.nodes?.length) return;
    onInsertData?.(aiGraph);
    notify?.("AI template inserted on board", "success");
  }

  async function saveAiTemplate() {
    if (!aiGraph?.nodes?.length) return;
    const name = String(aiName || "").trim();
    if (!name) {
      notify?.("AI template name is required", "warn");
      return;
    }
    await withBusy("save-ai-template", async () => {
      const response = await api.templateCreate({
        name,
        description: String(aiDesc || "").trim(),
        category: aiCategory,
        tags: tagsFromInput(aiTags),
        visibility: aiVisibility,
        data: aiGraph,
        note: "AI generated template",
      });
      notify?.("AI template saved", "success");
      if (response?.template?.id) {
        setScope("mine");
        setPage(1);
        setSelectedId(response.template.id);
      }
      refresh();
    });
  }

  if (!open) return null;

  return <div style={{ position: "fixed", inset: 0, zIndex: 650, background: "rgba(2,6,23,.55)", display: "flex", alignItems: isMobile ? "flex-end" : "stretch", justifyContent: isMobile ? "stretch" : "flex-end" }} onClick={onClose}>
    <div className="pop" onClick={e => e.stopPropagation()} style={{ width: isMobile ? "100%" : "min(1040px,calc(100vw - 24px))", height: isMobile ? "min(86vh,920px)" : "calc(100vh - 66px)", margin: isMobile ? 0 : "56px 12px 10px", borderRadius: isMobile ? "16px 16px 0 0" : 14, border: `1px solid ${T.b2}`, background: T.bg2, boxShadow: "0 18px 48px rgba(0,0,0,.45)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.b1}`, background: T.bg1 }}>
        <div>
          <div style={{ color: T.t0, fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".06em" }}>TEMPLATE MARKETPLACE</div>
          <div style={{ color: T.t2, fontSize: 11 }}>Library, publishing, versioning, AI generation</div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: 12, borderBottom: `1px solid ${T.b1}`, display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto auto", gap: 8 }}>
          <input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search templates..." style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
          <select value={scope} onChange={e => { setScope(e.target.value); setPage(1); }} style={{ minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 10px", fontSize: 12 }}><option value="marketplace">Marketplace</option><option value="mine">My Templates</option><option value="bookmarked">Bookmarked</option></select>
          <select value={sort} onChange={e => { setSort(e.target.value); setPage(1); }} style={{ minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, padding: "0 10px", fontSize: 12 }}><option value="featured">Featured</option><option value="trending">Trending</option><option value="new">New</option><option value="popular">Popular</option><option value="rating">Rating</option></select>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>{categories.map(cat => { const active = String(cat).toLowerCase() === String(category).toLowerCase(); return <button key={cat} onClick={() => { setCategory(cat); setPage(1); }} style={{ minHeight: 34, padding: "0 10px", borderRadius: 8, border: `1px solid ${active ? T.yDim : T.b1}`, background: active ? T.yBg : T.bg2, color: active ? T.y : T.t1, fontSize: 11, cursor: "pointer" }}>{cat === "all" ? "All" : cat}</button>; })}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.1fr) minmax(0,.9fr)", gap: 12, padding: 12 }}>
        <div style={{ border: `1px solid ${T.b1}`, borderRadius: 12, background: T.bg1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.b1}`, fontSize: 11, color: T.t2 }}>{loading ? "Loading templates..." : `${total} templates`}</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 10, display: "grid", gap: 8 }}>
            {!loading && !items.length && <div style={{ border: `1px dashed ${T.b1}`, borderRadius: 10, padding: 14, color: T.t2, fontSize: 12 }}>{error || "No templates found for current filters."}</div>}
            {items.map(item => { const active = item.id === selectedId; return <button key={item.id} onClick={() => setSelectedId(item.id)} style={{ textAlign: "left", borderRadius: 10, border: `1px solid ${active ? T.yDim : T.b1}`, background: active ? T.yBg : T.bg2, color: T.t0, padding: 10, cursor: "pointer", display: "grid", gap: 6 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>{item.featured && <span style={{ color: T.y, fontSize: 10 }}>FEATURED</span>}</div><div style={{ color: T.t2, fontSize: 11 }}>{String(item.description || "No description").slice(0, 120)}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 10, color: T.t2 }}><span>{item.category || "General"}</span><span>•</span><span>{num(item.usage_count, 0)} uses</span><span>•</span><span>{num(item.rating_avg, 0).toFixed(1)}★ ({num(item.rating_count, 0)})</span></div></button>; })}
          </div>
          <div style={{ borderTop: `1px solid ${T.b1}`, padding: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ minHeight: 32, padding: "0 10px", borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: page <= 1 ? T.t3 : T.t1, cursor: page <= 1 ? "not-allowed" : "pointer", fontSize: 11 }}>Prev</button><span style={{ color: T.t2, fontSize: 11 }}>{page} / {Math.max(1, totalPages)}</span><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ minHeight: 32, padding: "0 10px", borderRadius: 8, border: `1px solid ${T.b1}`, background: T.bg2, color: page >= totalPages ? T.t3 : T.t1, cursor: page >= totalPages ? "not-allowed" : "pointer", fontSize: 11 }}>Next</button></div>
        </div>
        <div style={{ minHeight: 0, overflowY: "auto", display: "grid", gap: 12, paddingRight: 2 }}>
          <div style={{ border: `1px solid ${T.b1}`, borderRadius: 12, background: T.bg1, padding: 10, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 10, color: T.t2, letterSpacing: ".06em" }}>Template Preview</div>
            {previewBusy ? <div style={{ borderRadius: 10, border: `1px solid ${T.b1}`, minHeight: 182, display: "grid", placeItems: "center", color: T.t2, fontSize: 12 }}>Loading preview...</div> : preview?.preview ? <MiniPreview preview={preview.preview} T={T} /> : <div style={{ borderRadius: 10, border: `1px dashed ${T.b1}`, minHeight: 182, display: "grid", placeItems: "center", color: T.t2, fontSize: 12 }}>Select a template</div>}
            <div style={{ fontSize: 12, fontWeight: 700 }}>{detail?.name || selectedSummary?.name || "Template"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}><select value={selectedVersion || ""} onChange={e => setSelectedVersion(e.target.value)} style={{ minHeight: 36, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, padding: "0 10px", fontSize: 12 }}>{(versions.length ? versions : [{ version: detail?.latest_version || 1 }]).map(v => <option key={String(v.version)} value={String(v.version)}>{`v${v.version}`}</option>)}</select><button onClick={createBoardFromTemplate} disabled={!selectedId || Boolean(busyAction)} style={{ minHeight: 36, borderRadius: 9, border: `1px solid ${!selectedId || busyAction ? T.b1 : T.yDim}`, background: !selectedId || busyAction ? T.bg3 : T.yBg, color: !selectedId || busyAction ? T.t2 : T.y, padding: "0 12px", cursor: !selectedId || busyAction ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}>{busyAction === "use-template" ? "Creating..." : "Create Board"}</button></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button onClick={toggleBookmark} disabled={!selectedId || Boolean(busyAction)} style={{ minHeight: 34, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: !selectedId || busyAction ? "not-allowed" : "pointer", fontSize: 11 }}>{detail?.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}</button><div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "space-between", border: `1px solid ${T.b1}`, borderRadius: 9, padding: "0 8px", background: T.bg2 }}>{[1, 2, 3, 4, 5].map(v => <button key={v} onClick={() => rateTemplate(v)} disabled={!selectedId || Boolean(busyAction)} style={{ border: "none", background: "transparent", color: num(detail?.my_rating, 0) >= v ? T.y : T.t3, cursor: !selectedId || busyAction ? "not-allowed" : "pointer", fontSize: 14 }}>★</button>)}</div></div>
            {canEditSelected && <div style={{ borderTop: `1px solid ${T.b1}`, paddingTop: 8, display: "grid", gap: 6 }}><button onClick={togglePublish} disabled={Boolean(busyAction)} style={{ minHeight: 34, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: busyAction ? "not-allowed" : "pointer", fontSize: 11 }}>{detail?.visibility === "public" ? "Public (switch to private)" : "Private (publish)"}</button><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}><input value={versionNote} onChange={e => setVersionNote(e.target.value)} placeholder="Version note" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><button onClick={addVersion} disabled={Boolean(busyAction)} style={{ minHeight: 38, padding: "0 11px", borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: busyAction ? "not-allowed" : "pointer", fontSize: 11 }}>Add Version</button></div></div>}
          </div>
          <div style={{ border: `1px solid ${T.b1}`, borderRadius: 12, background: T.bg1, padding: 10, display: "grid", gap: 8 }}><div style={{ fontSize: 10, color: T.t2, letterSpacing: ".06em" }}>Save Current Board As Template</div><input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Template name" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><input value={saveDesc} onChange={e => setSaveDesc(e.target.value)} placeholder="Description" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><select value={saveCategory} onChange={e => setSaveCategory(e.target.value)} style={{ minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, padding: "0 10px", fontSize: 12 }}>{DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><select value={saveVisibility} onChange={e => setSaveVisibility(e.target.value)} style={{ minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, padding: "0 10px", fontSize: 12 }}><option value="private">Private</option><option value="public">Public</option></select></div><input value={saveTags} onChange={e => setSaveTags(e.target.value)} placeholder="tags: roadmap, sprint" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><button onClick={saveBoardAsTemplate} disabled={Boolean(busyAction)} style={{ minHeight: 36, borderRadius: 9, border: `1px solid ${busyAction ? T.b1 : T.yDim}`, background: busyAction ? T.bg3 : T.yBg, color: busyAction ? T.t2 : T.y, fontSize: 11, fontWeight: 700, cursor: busyAction ? "not-allowed" : "pointer" }}>{busyAction === "save-template" ? "Saving..." : "Save as Template"}</button></div>
          <div style={{ border: `1px solid ${T.b1}`, borderRadius: 12, background: T.bg1, padding: 10, display: "grid", gap: 8 }}><div style={{ fontSize: 10, color: T.t2, letterSpacing: ".06em" }}>AI Template Generation</div><input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder='Example: "Startup roadmap template"' style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><button onClick={runAiTemplate} disabled={aiBusy || !String(aiPrompt || "").trim()} style={{ minHeight: 36, borderRadius: 9, border: `1px solid ${aiBusy || !String(aiPrompt || "").trim() ? T.b1 : T.yDim}`, background: aiBusy || !String(aiPrompt || "").trim() ? T.bg3 : T.yBg, color: aiBusy || !String(aiPrompt || "").trim() ? T.t2 : T.y, cursor: aiBusy || !String(aiPrompt || "").trim() ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700 }}>{aiBusy ? "Generating..." : "Generate Template"}</button>{aiGraph?.nodes?.length > 0 && <div style={{ display: "grid", gap: 8, borderTop: `1px solid ${T.b1}`, paddingTop: 8 }}><MiniPreview preview={aiGraph} T={T} height={154} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><button onClick={insertAiGraph} style={{ minHeight: 34, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: "pointer", fontSize: 11 }}>Insert on Board</button><button onClick={saveAiTemplate} disabled={Boolean(busyAction)} style={{ minHeight: 34, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t1, cursor: busyAction ? "not-allowed" : "pointer", fontSize: 11 }}>Save AI Template</button></div><input value={aiName} onChange={e => setAiName(e.target.value)} placeholder="AI template name" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><input value={aiDesc} onChange={e => setAiDesc(e.target.value)} placeholder="AI template description" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><select value={aiCategory} onChange={e => setAiCategory(e.target.value)} style={{ minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, padding: "0 10px", fontSize: 12 }}>{DEFAULT_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select><select value={aiVisibility} onChange={e => setAiVisibility(e.target.value)} style={{ minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg2, color: T.t0, padding: "0 10px", fontSize: 12 }}><option value="private">Private</option><option value="public">Public</option></select></div><input value={aiTags} onChange={e => setAiTags(e.target.value)} placeholder="AI tags" style={{ width: "100%", minHeight: 38, borderRadius: 9, border: `1px solid ${T.b1}`, background: T.bg1, color: T.t0, fontSize: 12, padding: "0 10px", outline: "none" }} /></div>}</div>
        </div>
      </div>
    </div>
  </div>;
}

