import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { aiCall, parseAiJson } from "../ai/helpers";
import { deriveExecutionSnapshot } from "./useExecutionIntelligence";

const PLANNER_SYS = `You are a Planner Agent for an execution whiteboard.
Return STRICT JSON:
{
  "summary": "short summary",
  "milestones": [{"id":"m1","title":"Milestone","dueDate":"YYYY-MM-DD | TBD"}],
  "tasks": [{"id":"t1","title":"Task","description":"","status":"Todo|In Progress|Blocked|Done","owner":"TBD","priority":"P0|P1|P2|P3","dueDate":"YYYY-MM-DD | TBD","milestoneId":"m1"}],
  "dependencies": [{"fromTaskId":"t1","toTaskId":"t2","type":"depends_on|blocks|related"}]
}`;

const RESEARCH_SYS = `You are a Research Agent.
Return STRICT JSON:
{
  "summary":"short summary",
  "ideas":["idea 1","idea 2","idea 3"]
}`;

const normStatus = value => {
  const txt = String(value || "").toLowerCase();
  if (txt.includes("progress")) return "In Progress";
  if (txt.includes("block")) return "Blocked";
  if (txt.includes("done") || txt.includes("complete")) return "Done";
  return "Todo";
};

const normPriority = value => {
  const txt = String(value || "").toUpperCase();
  if (["P0", "P1", "P2", "P3"].includes(txt)) return txt;
  return "P2";
};

const normDate = value => {
  const txt = String(value || "").trim();
  if (!txt) return "TBD";
  const m = txt.match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : "TBD";
};

function taskText(task) {
  return [
    task.title,
    task.description || "",
    `Status: ${task.status} | Priority: ${task.priority}`,
    `Owner: ${task.owner || "TBD"}`,
    `Due: ${task.dueDate || "TBD"}`,
  ].filter(Boolean).join("\n");
}

function milestoneText(entry) {
  return [entry.title, `Deadline: ${entry.dueDate || "TBD"}`, "Progress: 0/0"].join("\n");
}

function createTaskNode(uid, x, y, task) {
  const normalized = {
    id: String(task.id || uid()),
    title: String(task.title || "Task"),
    description: String(task.description || ""),
    status: normStatus(task.status),
    owner: String(task.owner || "TBD"),
    priority: normPriority(task.priority),
    dueDate: normDate(task.dueDate),
    milestoneId: String(task.milestoneId || ""),
  };
  return {
    id: uid(),
    type: "task",
    x,
    y,
    w: 250,
    h: 150,
    color: "#0f172a",
    textColor: "#e2e8f0",
    borderColor: normalized.status === "Blocked" ? "#f97316" : "#334155",
    fontSize: 11,
    fontWeight: "500",
    executionTaskId: normalized.id,
    executionTitle: normalized.title,
    executionDescription: normalized.description,
    executionStatus: normalized.status,
    executionOwner: normalized.owner,
    executionPriority: normalized.priority,
    executionDueDate: normalized.dueDate,
    executionMilestoneId: normalized.milestoneId || null,
    executionMilestone: "",
    text: taskText(normalized),
  };
}

function createMilestoneNode(uid, x, y, mile) {
  const normalized = {
    id: String(mile.id || uid()),
    title: String(mile.title || "Milestone"),
    dueDate: normDate(mile.dueDate),
  };
  return {
    id: uid(),
    type: "milestone",
    x,
    y,
    w: 320,
    h: 164,
    color: "#111827",
    textColor: "#e5e7eb",
    borderColor: "#6366f1",
    fontSize: 12,
    fontWeight: "700",
    executionMilestoneId: normalized.id,
    executionMilestone: normalized.title,
    executionDueDate: normalized.dueDate,
    text: milestoneText(normalized),
  };
}

function inferDependencyType(value) {
  const txt = String(value || "").trim().toLowerCase();
  if (txt.includes("block")) return "blocks";
  if (txt.includes("related")) return "related";
  if (txt.includes("depend")) return "depends_on";
  return "depends_on";
}

function dependencyLabel(type) {
  if (type === "blocks") return "blocks";
  if (type === "related") return "related";
  return "depends on";
}

function summarizeNodes(nodes, limit = 28) {
  return (Array.isArray(nodes) ? nodes : [])
    .slice(0, limit)
    .map(n => ({ id: n.id, type: n.type, text: String(n.text || "").slice(0, 120), x: n.x, y: n.y }))
    .filter(entry => entry.id);
}

function localConnectorSuggestions(nodes, existingArrows, max = 8) {
  const out = [];
  const idSet = new Set((existingArrows || []).map(a => `${a.fromId || a?.from?.entityId}->${a.toId || a?.to?.entityId}`));
  const source = (nodes || []).filter(n => !n.hidden && n.type !== "frame" && n.type !== "lane").slice(0, 80);
  for (let i = 0; i < source.length; i += 1) {
    const a = source[i];
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let j = 0; j < source.length; j += 1) {
      if (i === j) continue;
      const b = source[j];
      const key = `${a.id}->${b.id}`;
      if (idSet.has(key)) continue;
      const dx = (Number(b.x) || 0) - (Number(a.x) || 0);
      const dy = (Number(b.y) || 0) - (Number(a.y) || 0);
      const dist = Math.hypot(dx, dy);
      if (dist < 140 || dist > 420) continue;
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    if (best) {
      const key = `${a.id}->${best.id}`;
      if (idSet.has(key)) continue;
      idSet.add(key);
      out.push({ fromId: a.id, toId: best.id, depType: "related", label: "related" });
      if (out.length >= max) break;
    }
  }
  return out;
}

export function useBoardAgents({ s, d, uid, notify, emitActivity }) {
  const stateRef = useRef(s);
  const [history, setHistory] = useState([]);
  const [busyAgent, setBusyAgent] = useState("");
  const [plannerPrompt, setPlannerPrompt] = useState("");
  const [researchPrompt, setResearchPrompt] = useState("");
  const [lastError, setLastError] = useState("");

  useEffect(() => {
    stateRef.current = s;
  }, [s]);

  const selectedNodes = useMemo(() => {
    const ids = new Set(Array.isArray(s.sel) ? s.sel : []);
    return (Array.isArray(s.nodes) ? s.nodes : []).filter(n => ids.has(n.id));
  }, [s.nodes, s.sel]);

  const enqueueProposal = useCallback((payload) => {
    const action = {
      id: `agent_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      agent: payload.agent,
      title: payload.title,
      summary: payload.summary || "",
      proposal: payload.proposal || { nodes: [], arrows: [], updates: [] },
      status: "pending",
      createdAt: Date.now(),
      appliedAt: null,
      revertedAt: null,
      appliedData: null,
    };
    setHistory(prev => [action, ...prev].slice(0, 120));
    return action;
  }, []);

  const runPlanner = useCallback(async () => {
    const prompt = String(plannerPrompt || "").trim();
    if (!prompt || busyAgent) return;
    setBusyAgent("planner");
    setLastError("");
    try {
      const context = summarizeNodes(stateRef.current.nodes, 40);
      const response = await aiCall([
        "Build execution plan from this request and board context.",
        `REQUEST: ${prompt}`,
        "BOARD_CONTEXT_JSON:",
        JSON.stringify(context),
      ].join("\n"), PLANNER_SYS);
      const parsed = parseAiJson(response);
      const milestones = Array.isArray(parsed?.milestones) ? parsed.milestones.slice(0, 8) : [];
      const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks.slice(0, 40) : [];
      const deps = Array.isArray(parsed?.dependencies) ? parsed.dependencies.slice(0, 60) : [];
      const nodes = [];
      const arrows = [];
      const milestoneNodeById = {};
      const taskNodeByTaskId = {};

      const startX = 120;
      const startY = 120;
      const colGap = 360;

      milestones.forEach((m, idx) => {
        const node = createMilestoneNode(uid, startX + idx * colGap, startY, m || {});
        nodes.push(node);
        milestoneNodeById[String(m?.id || node.executionMilestoneId)] = node;
      });

      const laneCount = {};
      tasks.forEach((task, idx) => {
        const milestoneId = String(task?.milestoneId || "");
        const mileNode = milestoneId ? milestoneNodeById[milestoneId] : null;
        const laneKey = mileNode?.id || "_none";
        laneCount[laneKey] = (laneCount[laneKey] || 0) + 1;
        const row = laneCount[laneKey] - 1;
        const col = mileNode ? Math.max(0, milestones.findIndex(m => String(m?.id || "") === milestoneId)) : milestones.length;
        const node = createTaskNode(uid, startX + col * colGap, startY + 220 + row * 180, task || {});
        if (mileNode) {
          node.executionMilestoneId = mileNode.executionMilestoneId;
          node.executionMilestone = mileNode.executionMilestone;
          node.text = taskText({
            title: node.executionTitle,
            description: node.executionDescription,
            status: node.executionStatus,
            owner: node.executionOwner,
            priority: node.executionPriority,
            dueDate: node.executionDueDate,
          });
        }
        nodes.push(node);
        taskNodeByTaskId[String(task?.id || node.executionTaskId)] = node;
        if (mileNode) {
          arrows.push({ id: uid(), fromId: mileNode.id, toId: node.id, depType: "related", label: "related" });
        }
      });

      deps.forEach(dep => {
        const from = taskNodeByTaskId[String(dep?.fromTaskId || "")];
        const to = taskNodeByTaskId[String(dep?.toTaskId || "")];
        if (!from || !to || from.id === to.id) return;
        const type = inferDependencyType(dep?.type);
        arrows.push({ id: uid(), fromId: from.id, toId: to.id, depType: type, label: dependencyLabel(type) });
      });

      if (!nodes.length) throw new Error("Planner returned no nodes");
      enqueueProposal({
        agent: "planner",
        title: "Planner proposal",
        summary: String(parsed?.summary || `Generated ${tasks.length} tasks and ${milestones.length} milestones.`),
        proposal: { nodes, arrows, updates: [] },
      });
      emitActivity?.({ type: "agent.proposal", entity: "planner", message: "Planner generated proposal" });
    } catch (err) {
      const msg = err?.message || "Planner failed";
      setLastError(msg);
      notify?.(msg, "error");
    }
    setBusyAgent("");
  }, [busyAgent, enqueueProposal, emitActivity, notify, plannerPrompt, uid]);

  const runResearch = useCallback(async () => {
    const target = selectedNodes[0];
    const prompt = String(researchPrompt || target?.text || "").trim();
    if (!prompt || busyAgent) return;
    setBusyAgent("research");
    setLastError("");
    try {
      const response = await aiCall(`Expand this topic with practical research ideas:\n${prompt}`, RESEARCH_SYS);
      const parsed = parseAiJson(response);
      const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas.slice(0, 10) : [];
      if (!ideas.length) throw new Error("Research returned no ideas");
      const anchorX = Number(target?.x || 160);
      const anchorY = Number(target?.y || 160);
      const nodes = ideas.map((idea, idx) => ({
        id: uid(),
        type: "sticky",
        x: anchorX + 230 + (idx % 2) * 190,
        y: anchorY + Math.floor(idx / 2) * 150,
        w: 170,
        h: 130,
        text: String(idea || "Idea"),
        color: idx % 2 ? "#dcfce7" : "#dbeafe",
        textColor: idx % 2 ? "#14532d" : "#1e3a8a",
      }));
      const arrows = target
        ? nodes.map(node => ({ id: uid(), fromId: target.id, toId: node.id, depType: "related", label: "related" }))
        : [];
      enqueueProposal({
        agent: "research",
        title: "Research expansion",
        summary: String(parsed?.summary || `Generated ${nodes.length} research ideas.`),
        proposal: { nodes, arrows, updates: [] },
      });
      emitActivity?.({ type: "agent.proposal", entity: "research", message: "Research ideas proposed" });
    } catch (err) {
      const msg = err?.message || "Research failed";
      setLastError(msg);
      notify?.(msg, "error");
    }
    setBusyAgent("");
  }, [busyAgent, emitActivity, enqueueProposal, notify, researchPrompt, selectedNodes, uid]);

  const runConnectorAgent = useCallback(async () => {
    if (busyAgent) return;
    setBusyAgent("connector");
    setLastError("");
    try {
      const nodes = stateRef.current.nodes || [];
      const arrows = stateRef.current.arrows || [];
      const suggestions = localConnectorSuggestions(nodes, arrows, 12);
      if (!suggestions.length) throw new Error("No connector suggestions available");
      const proposalArrows = suggestions.map(s => ({ id: uid(), ...s }));
      enqueueProposal({
        agent: "connector",
        title: "Connector suggestions",
        summary: `Suggested ${proposalArrows.length} new relationships.`,
        proposal: { nodes: [], arrows: proposalArrows, updates: [] },
      });
      emitActivity?.({ type: "agent.proposal", entity: "connector", message: "Connector suggestions generated" });
    } catch (err) {
      const msg = err?.message || "Connector agent failed";
      setLastError(msg);
      notify?.(msg, "error");
    }
    setBusyAgent("");
  }, [busyAgent, emitActivity, enqueueProposal, notify, uid]);

  const runRiskAgent = useCallback(async () => {
    if (busyAgent) return;
    setBusyAgent("risk");
    setLastError("");
    try {
      const snapshot = deriveExecutionSnapshot(stateRef.current);
      const warnings = Array.isArray(snapshot?.warnings) ? snapshot.warnings.slice(0, 10) : [];
      if (!warnings.length) throw new Error("No execution risks found");
      const baseX = 120;
      const baseY = 520;
      const nodes = warnings.map((warn, idx) => ({
        id: uid(),
        type: "shape",
        shapeType: "rect",
        x: baseX + (idx % 2) * 260,
        y: baseY + Math.floor(idx / 2) * 120,
        w: 230,
        h: 92,
        text: `Risk\n${warn.message}`,
        color: "#7f1d1d",
        textColor: "#fee2e2",
        borderColor: "#f87171",
        executionRiskId: uid(),
        executionRiskStatus: "open",
        executionRiskImpact: warn.type === "overdue_task" ? "high" : "medium",
      }));
      enqueueProposal({
        agent: "risk",
        title: "Risk analysis",
        summary: `Detected ${warnings.length} risks/blockers from execution graph.`,
        proposal: { nodes, arrows: [], updates: [] },
      });
      emitActivity?.({ type: "agent.proposal", entity: "risk", message: "Risk warnings proposed" });
    } catch (err) {
      const msg = err?.message || "Risk analysis failed";
      setLastError(msg);
      notify?.(msg, "error");
    }
    setBusyAgent("");
  }, [busyAgent, emitActivity, enqueueProposal, notify, uid]);

  const approveAction = useCallback((actionId) => {
    const action = history.find(entry => entry.id === actionId);
    if (!action || action.status !== "pending") return;
    const cur = stateRef.current;
    const updates = Array.isArray(action.proposal?.updates) ? action.proposal.updates : [];
    const prevUpdates = updates
      .map(update => {
        const node = (cur.nodes || []).find(n => n.id === update.id);
        if (!node) return null;
        const prevPatch = {};
        Object.keys(update.patch || {}).forEach(key => {
          prevPatch[key] = node[key];
        });
        return { id: update.id, prev: prevPatch };
      })
      .filter(Boolean);

    const addedNodeIds = [];
    const addedArrowIds = [];

    (action.proposal?.nodes || []).forEach(node => {
      if (!node?.id) return;
      d({ type: "ADD", node });
      addedNodeIds.push(node.id);
    });

    (action.proposal?.arrows || []).forEach(arr => {
      if (!arr?.id) return;
      d({ type: "ADD_ARR", arr });
      addedArrowIds.push(arr.id);
    });

    updates.forEach(update => {
      d({ type: "UPD", id: update.id, p: update.patch || {} });
    });

    setHistory(prev => prev.map(entry => entry.id === actionId ? {
      ...entry,
      status: "approved",
      appliedAt: Date.now(),
      appliedData: { addedNodeIds, addedArrowIds, prevUpdates },
    } : entry));

    emitActivity?.({ type: "agent.approved", entity: action.agent, message: `${action.agent} proposal approved` });
    notify?.(`${action.agent} action approved`, "success");
  }, [d, emitActivity, history, notify]);

  const rejectAction = useCallback((actionId) => {
    const action = history.find(entry => entry.id === actionId);
    if (!action || action.status !== "pending") return;
    setHistory(prev => prev.map(entry => entry.id === actionId ? { ...entry, status: "rejected", revertedAt: Date.now() } : entry));
    emitActivity?.({ type: "agent.rejected", entity: action.agent, message: `${action.agent} proposal rejected` });
  }, [emitActivity, history]);

  const undoAction = useCallback((actionId) => {
    const action = history.find(entry => entry.id === actionId);
    if (!action || action.status !== "approved" || !action.appliedData) return;

    const ids = Array.isArray(action.appliedData.addedNodeIds) ? action.appliedData.addedNodeIds.filter(Boolean) : [];
    if (ids.length) d({ type: "DEL", ids });

    (action.appliedData.addedArrowIds || []).forEach(id => d({ type: "DEL_ARR", id }));
    (action.appliedData.prevUpdates || []).forEach(item => d({ type: "UPD", id: item.id, p: item.prev || {} }));

    setHistory(prev => prev.map(entry => entry.id === actionId ? { ...entry, status: "reverted", revertedAt: Date.now() } : entry));
    emitActivity?.({ type: "agent.undo", entity: action.agent, message: `${action.agent} action reverted` });
    notify?.(`${action.agent} action reverted`, "info");
  }, [d, emitActivity, history, notify]);

  return {
    history,
    busyAgent,
    plannerPrompt,
    setPlannerPrompt,
    researchPrompt,
    setResearchPrompt,
    lastError,
    canResearch: Boolean(selectedNodes.length),
    runPlanner,
    runResearch,
    runConnectorAgent,
    runRiskAgent,
    approveAction,
    rejectAction,
    undoAction,
  };
}