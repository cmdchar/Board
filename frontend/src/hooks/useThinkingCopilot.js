import { useCallback, useMemo, useState } from "react";
import { aiCall, parseAiJson } from "../ai/helpers";
import { THINKING_EXAMPLE_PROMPTS, THINKING_SYS } from "../ai/prompts";

const CONTEXT_NODE_LIMIT = 90;
const CONTEXT_ARROW_LIMIT = 140;
const CONTEXT_TEXT_LIMIT = 180;
const PREVIEW_NODE_LIMIT = 60;

const INTENTS = {
  board_generation: "board_generation",
  flow_generation: "flow_generation",
  idea_expansion: "idea_expansion",
  structure_builder: "structure_builder",
  decision_helper: "decision_helper",
  summary: "summary",
};

const INTENT_LABELS = {
  board_generation: "Board Generation",
  flow_generation: "Flow Generator",
  idea_expansion: "Idea Expansion",
  structure_builder: "Structure Builder",
  decision_helper: "Decision Helper",
  summary: "Board Summary",
};

const NODE_TYPES = new Set(["sticky", "shape", "text", "lane"]);

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cut(value, max = 120) {
  const txt = asText(value);
  if (!txt) return "";
  return txt.length > max ? `${txt.slice(0, max - 3)}...` : txt;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeIntent(value, fallback = INTENTS.board_generation) {
  const txt = asText(value);
  if (txt && INTENT_LABELS[txt]) return txt;
  return fallback;
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeDecision(rawDecision) {
  const d = rawDecision && typeof rawDecision === "object" ? rawDecision : {};
  return {
    pros: toArray(d.pros).map(v => cut(v, 140)).filter(Boolean).slice(0, 8),
    cons: toArray(d.cons).map(v => cut(v, 140)).filter(Boolean).slice(0, 8),
    risks: toArray(d.risks).map(v => cut(v, 140)).filter(Boolean).slice(0, 8),
    recommendation: cut(d.recommendation, 300),
  };
}

function normalizeSuggestions(rawSuggestions, fallbackIntent) {
  return toArray(rawSuggestions)
    .map((entry, idx) => {
      if (typeof entry === "string") {
        const label = cut(entry, 72);
        return label ? { id: `s${idx + 1}`, label, reason: "", prompt: label, intent: fallbackIntent } : null;
      }
      if (!entry || typeof entry !== "object") return null;
      const label = cut(entry.label || entry.title, 72);
      if (!label) return null;
      return {
        id: cut(entry.id || `s${idx + 1}`, 24) || `s${idx + 1}`,
        label,
        reason: cut(entry.reason, 140),
        prompt: cut(entry.prompt || entry.userPrompt || label, 240) || label,
        intent: normalizeIntent(entry.intent, fallbackIntent),
      };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeAiNodes(rawNodes, { palette, theme, shapeTypes, shapeDefaults }) {
  const normType = type => (NODE_TYPES.has(type) ? type : "sticky");
  const normShape = shape => {
    const value = asText(shape).toLowerCase();
    return shapeTypes.includes(value) ? value : "rect";
  };

  return toArray(rawNodes)
    .slice(0, PREVIEW_NODE_LIMIT)
    .map((node, idx) => {
      const gx = 80 + (idx % 4) * 240;
      const gy = 80 + Math.floor(idx / 4) * 174;

      if (typeof node === "string") {
        const colorSet = palette[idx % palette.length];
        return {
          id: `n${idx + 1}`,
          type: "sticky",
          x: gx,
          y: gy,
          w: 170,
          h: 130,
          text: cut(node, 220),
          color: colorSet.bg,
          textColor: colorSet.t,
          borderColor: theme.b1,
          fontSize: 12,
          fontWeight: "normal",
        };
      }

      if (!node || typeof node !== "object") return null;

      const type = normType(asText(node.type));
      const shapeType = type === "shape" ? normShape(node.shapeType) : undefined;

      let w = safeNumber(node.w, type === "text" ? 240 : type === "lane" ? 820 : 170);
      let h = safeNumber(node.h, type === "text" ? 54 : type === "lane" ? 180 : 130);
      if (shapeType) {
        const def = shapeDefaults[shapeType] || shapeDefaults.rect;
        w = safeNumber(node.w, def.w);
        h = safeNumber(node.h, def.h);
      }

      const colorSet = palette[idx % palette.length];

      return {
        id: asText(node.id) || `n${idx + 1}`,
        type,
        ...(shapeType ? { shapeType } : {}),
        ...(type === "lane" ? { orientation: node.orientation === "v" ? "v" : "h" } : {}),
        x: safeNumber(node.x, gx),
        y: safeNumber(node.y, gy),
        w: Math.max(56, Math.min(2400, w)),
        h: Math.max(32, Math.min(1600, h)),
        text: cut(node.text, 480),
        color: asText(node.color) || (type === "sticky" ? colorSet.bg : theme.bg3),
        textColor: asText(node.textColor) || (type === "sticky" ? colorSet.t : theme.t0),
        borderColor: asText(node.borderColor) || theme.b1,
        fontSize: safeNumber(node.fontSize, type === "text" ? 20 : 12),
        fontWeight: node.fontWeight === "bold" ? "bold" : "normal",
        ...(asText(node.groupId) ? { groupId: asText(node.groupId) } : {}),
      };
    })
    .filter(Boolean);
}

function normalizeAiArrows(rawArrows, nodes, uid) {
  const idMap = Object.fromEntries(nodes.map(node => [asText(node.id), node.id]));
  const textMap = Object.fromEntries(
    nodes
      .map(node => [asText(node.text).toLowerCase(), node.id])
      .filter(([txt]) => Boolean(txt)),
  );

  const pickId = value => {
    const key = asText(value);
    if (!key) return null;
    if (idMap[key]) return idMap[key];
    const byText = textMap[key.toLowerCase()];
    return byText || null;
  };

  return toArray(rawArrows)
    .slice(0, 140)
    .map((arrow, idx) => {
      if (typeof arrow === "string") {
        const parts = arrow.split("->");
        if (parts.length !== 2) return null;
        const fromId = pickId(parts[0]);
        const toId = pickId(parts[1]);
        if (!fromId || !toId || fromId === toId) return null;
        return { id: uid(), fromId, toId, label: "" };
      }
      if (!arrow || typeof arrow !== "object") return null;
      const fromId = pickId(arrow.fromId ?? arrow.from ?? arrow.source);
      const toId = pickId(arrow.toId ?? arrow.to ?? arrow.target);
      if (!fromId || !toId || fromId === toId) return null;
      return {
        id: asText(arrow.id) || `${uid()}_${idx + 1}`,
        fromId,
        toId,
        label: cut(arrow.label, 72),
      };
    })
    .filter(Boolean);
}

function buildBoardContext(state) {
  const nodes = toArray(state.nodes)
    .filter(node => !node.hidden)
    .slice(0, CONTEXT_NODE_LIMIT)
    .map(node => ({
      id: node.id,
      type: node.type,
      text: cut(node.text, CONTEXT_TEXT_LIMIT),
      x: Math.round(Number(node.x) || 0),
      y: Math.round(Number(node.y) || 0),
      w: Math.round(Number(node.w) || 0),
      h: Math.round(Number(node.h) || 0),
      groupId: node.groupId || null,
      tableId: node.tableId || null,
      shapeType: node.shapeType || null,
    }));

  const nodeSet = new Set(nodes.map(node => node.id));
  const arrows = toArray(state.arrows)
    .slice(0, CONTEXT_ARROW_LIMIT)
    .map(arrow => ({
      id: arrow.id,
      fromId: arrow?.from?.entityId || arrow.fromId || "",
      toId: arrow?.to?.entityId || arrow.toId || "",
      label: cut(arrow.label, 90),
    }))
    .filter(arrow => arrow.fromId && arrow.toId && nodeSet.has(arrow.fromId) && nodeSet.has(arrow.toId));

  const outDegree = {};
  const inDegree = {};
  arrows.forEach(arrow => {
    outDegree[arrow.fromId] = (outDegree[arrow.fromId] || 0) + 1;
    inDegree[arrow.toId] = (inDegree[arrow.toId] || 0) + 1;
  });

  const disconnectedNodeIds = nodes
    .filter(node => !outDegree[node.id] && !inDegree[node.id])
    .map(node => node.id)
    .slice(0, 60);

  const containers = nodes
    .filter(node => node.type === "lane" || node.type === "frame" || ((node.w || 0) >= 320 && (node.h || 0) >= 180))
    .slice(0, 30)
    .map(node => ({ id: node.id, type: node.type, text: node.text, x: node.x, y: node.y, w: node.w, h: node.h }));

  const clustersByGroup = {};
  nodes.forEach(node => {
    if (!node.groupId) return;
    if (!clustersByGroup[node.groupId]) clustersByGroup[node.groupId] = [];
    clustersByGroup[node.groupId].push(node.id);
  });

  const clusters = Object.entries(clustersByGroup)
    .map(([groupId, members]) => ({ groupId, size: members.length, members: members.slice(0, 20) }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 20);

  const selectedNodeIds = toArray(state.sel).slice(0, 40);
  const selectedNodes = selectedNodeIds
    .map(id => nodes.find(node => node.id === id))
    .filter(Boolean)
    .map(node => ({
      id: node.id,
      type: node.type,
      text: node.text,
      groupId: node.groupId,
      tableId: node.tableId,
    }));

  return {
    boardStats: {
      nodeCount: toArray(state.nodes).length,
      arrowCount: toArray(state.arrows).length,
      selectedCount: selectedNodeIds.length,
      disconnectedCount: disconnectedNodeIds.length,
      clusterCount: clusters.length,
      containerCount: containers.length,
    },
    selectedNodeIds,
    selectedNodes,
    nodes,
    arrows,
    clusters,
    containers,
    disconnectedNodeIds,
  };
}

function buildIntentPrompt(intent, userPrompt, context) {
  return [
    `INTENT: ${intent}`,
    `USER_PROMPT: ${String(userPrompt || "").trim()}`,
    "",
    "BOARD_CONTEXT_JSON:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

function buildDefaultPrompt(intent, selectedTexts = []) {
  if (intent === INTENTS.flow_generation) return "Generate a clear end-to-end flow based on this board context.";
  if (intent === INTENTS.idea_expansion) {
    if (selectedTexts.length) return `Expand these ideas into actionable branches: ${selectedTexts.join(", ")}`;
    return "Expand the current idea into actionable branches.";
  }
  if (intent === INTENTS.structure_builder) return "Organize the selected ideas into a clear hierarchy with meaningful connections.";
  if (intent === INTENTS.decision_helper) return "Analyze selected options and return pros, cons, risks, and recommendation.";
  if (intent === INTENTS.summary) return "Summarize this board and propose the next best actions.";
  return "Generate a clear board structure from this context.";
}

export function useThinkingCopilot({ s, d, uid, theme, palette, shapeTypes, shapeDefaults, notify }) {
  const [prompt, setPrompt] = useState(THINKING_EXAMPLE_PROMPTS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [lastRun, setLastRun] = useState(null);
  const [replaceOnInsert, setReplaceOnInsert] = useState(false);
  const [semanticClusters, setSemanticClusters] = useState([]);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [pinnedClusters, setPinnedClusters] = useState(new Set());
  const [rejectedClusters, setRejectedClusters] = useState(new Set());

  const selectedNodes = useMemo(() => {
    const selected = new Set(toArray(s.sel));
    return toArray(s.nodes).filter(node => selected.has(node.id));
  }, [s.nodes, s.sel]);

  const smartSuggestions = useMemo(() => {
    const nodes = toArray(s.nodes).filter(node => !node.hidden);
    const arrows = toArray(s.arrows);
    const selectedCount = toArray(s.sel).length;
    const stickyCount = nodes.filter(node => node.type === "sticky").length;
    const taskLikeCount = nodes.filter(node => /\b(task|todo|owner|due|milestone|risk)\b/i.test(asText(node.text))).length;

    const degree = {};
    arrows.forEach(arrow => {
      const fromId = arrow?.from?.entityId || arrow.fromId;
      const toId = arrow?.to?.entityId || arrow.toId;
      if (!fromId || !toId) return;
      degree[fromId] = (degree[fromId] || 0) + 1;
      degree[toId] = (degree[toId] || 0) + 1;
    });
    const disconnected = nodes.filter(node => !degree[node.id]).length;

    const suggestions = [];

    if (nodes.length >= 6 && arrows.length <= 2) {
      suggestions.push({
        id: "flow_from_ideas",
        label: "Generate flow from ideas",
        reason: "Most ideas are not connected yet.",
        prompt: "Transform current ideas into a customer or execution flow.",
        intent: INTENTS.flow_generation,
      });
    }

    if (stickyCount >= 8) {
      suggestions.push({
        id: "organize_brainstorm",
        label: "Group brainstorm",
        reason: "Large brainstorm detected.",
        prompt: "Group related ideas and create hierarchy with connectors.",
        intent: INTENTS.structure_builder,
      });
    }

    if (taskLikeCount >= 4) {
      suggestions.push({
        id: "task_to_plan",
        label: "Create execution plan",
        reason: "Task-like notes are present.",
        prompt: "Turn these tasks into a roadmap with milestones and dependencies.",
        intent: INTENTS.board_generation,
      });
    }

    if (disconnected >= 4) {
      suggestions.push({
        id: "connect_disconnected",
        label: "Connect disconnected nodes",
        reason: `${disconnected} nodes are isolated.`,
        prompt: "Propose and generate logical connections for disconnected nodes.",
        intent: INTENTS.structure_builder,
      });
    }

    if (selectedCount === 1) {
      suggestions.push({
        id: "expand_selected",
        label: "Expand selected idea",
        reason: "One node selected.",
        prompt: "Expand the selected idea into next-level branches.",
        intent: INTENTS.idea_expansion,
      });
    }

    if (selectedCount >= 2) {
      suggestions.push({
        id: "decision_selected",
        label: "Analyze selected options",
        reason: "Multiple options selected.",
        prompt: "Compare selected options and recommend one with justification.",
        intent: INTENTS.decision_helper,
      });
    }

    if (!suggestions.length) {
      suggestions.push({
        id: "board_summary",
        label: "Summarize board",
        reason: "Get clarity on current board state.",
        prompt: "Summarize this board and list best next actions.",
        intent: INTENTS.summary,
      });
    }

    return suggestions.slice(0, 6);
  }, [s.nodes, s.arrows, s.sel]);

  const runIntent = useCallback(async (intent, userPrompt = "") => {
    if (loading) return;

    const normalizedIntent = normalizeIntent(intent);
    const selectedTexts = selectedNodes.map(node => cut(node.text || node.type, 90)).filter(Boolean).slice(0, 8);
    const effectivePrompt = asText(userPrompt) || buildDefaultPrompt(normalizedIntent, selectedTexts);

    if (!effectivePrompt) {
      setError("Prompt is empty.");
      return;
    }

    if (normalizedIntent === INTENTS.idea_expansion && !selectedNodes.length) {
      setError("Select at least one node for idea expansion.");
      return;
    }
    if (normalizedIntent === INTENTS.structure_builder && selectedNodes.length < 2) {
      setError("Select at least two nodes for structure builder.");
      return;
    }
    if (normalizedIntent === INTENTS.decision_helper && selectedNodes.length < 2) {
      setError("Select at least two option nodes for decision helper.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const context = buildBoardContext(s);
      const requestPrompt = buildIntentPrompt(normalizedIntent, effectivePrompt, context);
      const raw = await aiCall(requestPrompt, THINKING_SYS);
      const parsed = parseAiJson(raw);

      const responseIntent = normalizeIntent(parsed.intent, normalizedIntent);
      const nodes = normalizeAiNodes(parsed.nodes, {
        palette,
        theme,
        shapeTypes,
        shapeDefaults,
      });
      const arrows = normalizeAiArrows(parsed.arrows, nodes, uid);
      const decision = normalizeDecision(parsed.decision);
      const suggestions = normalizeSuggestions(parsed.suggestions, responseIntent);

      const nextPreview = {
        intent: responseIntent,
        title: cut(parsed.title || INTENT_LABELS[responseIntent], 120) || INTENT_LABELS[responseIntent],
        summary: cut(parsed.summary || "", 700),
        nodes,
        arrows,
        decision,
        suggestions,
        prompt: effectivePrompt,
      };

      setPreview(nextPreview);
      setLastRun({
        intent: responseIntent,
        title: nextPreview.title,
        summary: nextPreview.summary,
        createdAt: Date.now(),
      });
    } catch (err) {
      const msg = err?.message || "AI thinking request failed.";
      setError(msg);
      if (typeof notify === "function") notify(msg, "error");
    }
    setLoading(false);
  }, [loading, notify, palette, s, selectedNodes, shapeDefaults, shapeTypes, theme, uid]);

  const commitPreview = useCallback(({ tidy = true } = {}) => {
    if (!preview || !preview.nodes.length) return;

    const idMap = {};
    const groupMap = {};

    const nextNodes = preview.nodes.map(node => {
      const nextId = uid();
      idMap[node.id] = nextId;
      const groupId = node.groupId
        ? (groupMap[node.groupId] || (groupMap[node.groupId] = uid()))
        : node.groupId;
      return {
        ...node,
        id: nextId,
        ...(groupId ? { groupId } : {}),
      };
    });

    const nextArrows = preview.arrows
      .map(arrow => {
        const fromId = idMap[arrow.fromId] || null;
        const toId = idMap[arrow.toId] || null;
        if (!fromId || !toId || fromId === toId) return null;
        return {
          id: uid(),
          fromId,
          toId,
          label: asText(arrow.label),
        };
      })
      .filter(Boolean);

    d({ type: "APPLY", nodes: nextNodes, arrows: nextArrows, replace: replaceOnInsert });
    d({ type: "SEL", v: nextNodes.map(node => node.id) });
    if (tidy && nextNodes.length > 2) {
      d({ type: "TIDY", ids: nextNodes.map(node => node.id) });
    }

    const msg = `Inserted ${nextNodes.length} node${nextNodes.length === 1 ? "" : "s"}${nextArrows.length ? ` and ${nextArrows.length} connector${nextArrows.length === 1 ? "" : "s"}` : ""}.`;
    if (typeof notify === "function") notify(msg, "success");

    setPreview(null);
  }, [d, notify, preview, replaceOnInsert, uid]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError("");
  }, []);

  const runSuggestion = useCallback(suggestion => {
    if (!suggestion) return;
    runIntent(suggestion.intent || INTENTS.board_generation, suggestion.prompt || suggestion.label || "");
  }, [runIntent]);

  const runBoardGeneration = useCallback(() => runIntent(INTENTS.board_generation, prompt), [prompt, runIntent]);
  const runFlowGeneration = useCallback(() => runIntent(INTENTS.flow_generation, prompt), [prompt, runIntent]);
  const runIdeaExpansion = useCallback(() => runIntent(INTENTS.idea_expansion, prompt), [prompt, runIntent]);
  const runStructureBuilder = useCallback(() => runIntent(INTENTS.structure_builder, prompt), [prompt, runIntent]);
  const runDecisionHelper = useCallback(() => runIntent(INTENTS.decision_helper, prompt), [prompt, runIntent]);
  const runSummary = useCallback(() => runIntent(INTENTS.summary, prompt), [prompt, runIntent]);

  const findSemanticClusters = useCallback(async () => {
    if (semanticLoading) return;
    setSemanticLoading(true);
    try {
      const notes = s.nodes.filter(n => n.type === 'note' && n.text.length > 20);
      if (notes.length < 2) {
        setSemanticClusters([]);
        return;
      }

      const clusters = [];
      const seenIds = new Set();

      for (const note of notes.slice(0, 8)) {
        if (seenIds.has(note.id)) continue;

        const clusterId = `cluster-${note.id}`;
        if (rejectedClusters.has(clusterId)) continue;

        const title = note.text.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Note';
        const res = await fetch(`/api/boards/${s.boardId}/embeddings/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("boardai_token")}`
          },
          body: JSON.stringify({ q: note.text.slice(0, 500), limit: 5 }),
        }).then(r => r.json());

        if (res.results && res.results.length > 1) {
          // Dynamic Ranking: Use mean of scores as threshold if above 0.75
          const scores = res.results.map(r => r.score);
          const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
          const threshold = Math.max(0.78, mean * 0.98);

          const matches = res.results.filter(m => m.id !== note.id && m.score >= threshold);
          if (matches.length > 0) {
            clusters.push({
              id: clusterId,
              label: `Related to "${cut(title, 20)}"`,
              members: [note.id, ...matches.map(m => m.id)],
              score: matches[0].score,
              pinned: pinnedClusters.has(clusterId)
            });
            seenIds.add(note.id);
            matches.forEach(m => seenIds.add(m.id));
          }
        }
      }
      setSemanticClusters(clusters.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.score - a.score));
    } catch (err) {
      console.error("Semantic clustering failed", err);
    } finally {
      setSemanticLoading(false);
    }
  }, [s.boardId, s.nodes, semanticLoading, pinnedClusters, rejectedClusters]);

  const pinCluster = useCallback((id) => {
    setPinnedClusters(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const rejectCluster = useCallback((id) => {
    setRejectedClusters(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSemanticClusters(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    prompt,
    setPrompt,
    loading,
    error,
    preview,
    lastRun,
    replaceOnInsert,
    setReplaceOnInsert,
    selectedCount: selectedNodes.length,
    smartSuggestions,
    semanticClusters,
    semanticLoading,
    findSemanticClusters,
    pinCluster,
    rejectCluster,
    examplePrompts: THINKING_EXAMPLE_PROMPTS,
    runBoardGeneration,
    runFlowGeneration,
    runIdeaExpansion,
    runStructureBuilder,
    runDecisionHelper,
    runSummary,
    runSuggestion,
    commitPreview,
    clearPreview,
  };
}
