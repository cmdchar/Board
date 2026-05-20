import { useCallback, useMemo, useState } from "react";
import { aiCall, parseAiJson } from "../ai/helpers";
import { EXEC_MEETING_SYS } from "../ai/prompts";

const TASK_STATUS = ["Todo", "In Progress", "Blocked", "Done"];
const TASK_PRIORITY = ["P0", "P1", "P2", "P3"];
const DEP_TYPES = ["depends_on", "blocks", "related"];

function asText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normDate(value) {
  const txt = asText(value);
  if (!txt) return "TBD";
  const iso = txt.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  if (/^(tbd|none|unknown|later|n\/a)$/i.test(txt)) return "TBD";
  return txt;
}

function dateToTs(value) {
  const d = normDate(value);
  if (d === "TBD") return Number.NaN;
  const ts = Date.parse(`${d}T00:00:00`);
  return Number.isFinite(ts) ? ts : Number.NaN;
}

function normalizeStatus(value) {
  const txt = asText(value).toLowerCase();
  if (txt.includes("progress") || txt === "doing" || txt === "in_progress") return "In Progress";
  if (txt.includes("block")) return "Blocked";
  if (txt === "done" || txt === "completed" || txt === "closed") return "Done";
  return "Todo";
}

function normalizePriority(value) {
  const txt = asText(value).toUpperCase();
  if (TASK_PRIORITY.includes(txt)) return txt;
  if (/critical|urgent/.test(txt)) return "P0";
  if (/high/.test(txt)) return "P1";
  if (/low/.test(txt)) return "P3";
  return "P2";
}

function parseTags(value) {
  if (Array.isArray(value)) return value.map(v => asText(v)).filter(Boolean).slice(0, 8);
  const txt = asText(value);
  if (!txt) return [];
  return txt.split(/[;,|]/).map(v => asText(v)).filter(Boolean).slice(0, 8);
}

function normalizeDependencyType(value) {
  const txt = asText(value).toLowerCase();
  if (txt === "blocks" || txt.includes("block")) return "blocks";
  if (txt === "related" || txt.includes("related")) return "related";
  if (txt === "depends_on" || txt.includes("depend")) return "depends_on";
  return "depends_on";
}

function dependencyLabel(type) {
  if (type === "blocks") return "blocks";
  if (type === "related") return "related";
  return "depends on";
}

function computeCircularDependencies(taskIds, deps) {
  const adj = {};
  taskIds.forEach(id => {
    adj[id] = [];
  });
  deps.forEach(dep => {
    if (!adj[dep.fromTaskId] || !adj[dep.toTaskId]) return;
    if (dep.type !== "depends_on") return;
    adj[dep.fromTaskId].push(dep.toTaskId);
  });

  const visiting = new Set();
  const visited = new Set();
  const inCycle = new Set();

  function dfs(node) {
    if (visiting.has(node)) {
      inCycle.add(node);
      return true;
    }
    if (visited.has(node)) return false;
    visiting.add(node);
    let hasCycle = false;
    for (const next of adj[node] || []) {
      if (dfs(next)) {
        hasCycle = true;
        inCycle.add(node);
      }
    }
    visiting.delete(node);
    visited.add(node);
    return hasCycle;
  }

  taskIds.forEach(id => {
    if (!visited.has(id)) dfs(id);
  });

  return [...inCycle];
}

function buildTaskText(task) {
  const tags = task.tags?.length ? task.tags.join(", ") : "none";
  const linkLine = [task.githubUrl ? `GH:${task.githubUrl}` : "", task.jiraUrl ? `JIRA:${task.jiraUrl}` : ""].filter(Boolean).join(" | ");
  return [
    task.title || "Untitled task",
    task.description || "",
    `Status: ${task.status} | Priority: ${task.priority}`,
    `Owner: ${task.owner || "TBD"}`,
    `Due: ${task.dueDate || "TBD"}`,
    `Tags: ${tags}`,
    linkLine,
  ].filter(Boolean).join("\n");
}

function buildMilestoneText(milestone) {
  return [
    milestone.title || "Milestone",
    `Deadline: ${milestone.dueDate || "TBD"}`,
    `Progress: ${milestone.progressDone}/${milestone.progressTotal}`,
  ].join("\n");
}

function buildDecisionText(decision) {
  return [
    decision.decision || "Decision",
    `Date: ${decision.date || "TBD"}`,
    `Owner: ${decision.owner || "TBD"}`,
    decision.context ? `Context: ${decision.context}` : "",
    decision.outcome ? `Outcome: ${decision.outcome}` : "",
  ].filter(Boolean).join("\n");
}

function isTaskNode(node) {
  return node?.type === "task" || Boolean(asText(node?.executionTaskId));
}

function isMilestoneNode(node) {
  return node?.type === "milestone" || (Boolean(asText(node?.executionMilestoneId)) && !isTaskNode(node));
}

function isDecisionNode(node) {
  return node?.type === "decision" || Boolean(asText(node?.executionDecisionId));
}

export function deriveExecutionSnapshot(state) {
  const nodes = toArray(state?.nodes).filter(node => !node.hidden);
  const arrows = toArray(state?.arrows);
  const tasks = [];
  const taskByNode = {};

  nodes.forEach(node => {
    if (!isTaskNode(node)) return;
    const task = {
      nodeId: node.id,
      id: asText(node.executionTaskId) || node.id,
      title: asText(node.executionTitle) || asText(node.text).split("\n")[0] || "Task",
      description: asText(node.executionDescription),
      status: normalizeStatus(node.executionStatus || node.status),
      owner: asText(node.executionOwner) || "TBD",
      priority: normalizePriority(node.executionPriority || node.priority),
      dueDate: normDate(node.executionDueDate || node.dueDate),
      tags: parseTags(node.executionTags || node.tags),
      milestoneId: asText(node.executionMilestoneId),
      milestoneTitle: asText(node.executionMilestone),
      githubUrl: asText(node.executionGithubUrl || node.executionIssueUrl || node.githubUrl),
      jiraUrl: asText(node.executionJiraUrl || node.jiraUrl),
      issueState: asText(node.executionIssueState),
    };
    tasks.push(task);
    taskByNode[node.id] = task;
  });

  const deps = [];
  arrows.forEach(arrow => {
    const fromId = arrow?.from?.entityId || arrow.fromId;
    const toId = arrow?.to?.entityId || arrow.toId;
    if (!fromId || !toId) return;
    const fromTask = taskByNode[fromId];
    const toTask = taskByNode[toId];
    if (!fromTask || !toTask || fromTask.id === toTask.id) return;
    const type = normalizeDependencyType(arrow.depType || arrow.label);
    deps.push({
      arrowId: arrow.id,
      fromNodeId: fromId,
      toNodeId: toId,
      fromTaskId: fromTask.id,
      toTaskId: toTask.id,
      type,
    });
  });

  const blockedByDepTaskIds = new Set(deps.filter(dep => dep.type === "blocks").map(dep => dep.toTaskId));
  const nowTs = Date.parse(new Date().toISOString().slice(0, 10));

  tasks.forEach(task => {
    task.blockedByDeps = blockedByDepTaskIds.has(task.id);
    task.isBlocked = task.status === "Blocked" || task.blockedByDeps;
    const dueTs = dateToTs(task.dueDate);
    task.isOverdue = Number.isFinite(dueTs) && dueTs < nowTs && task.status !== "Done";
  });

  const milestoneNodes = nodes.filter(isMilestoneNode);
  const milestoneMap = {};

  milestoneNodes.forEach(node => {
    const mId = asText(node.executionMilestoneId) || node.id;
    milestoneMap[mId] = {
      nodeId: node.id,
      id: mId,
      title: asText(node.executionMilestone) || asText(node.text).split("\n")[0] || "Milestone",
      dueDate: normDate(node.executionDueDate || node.executionMilestoneDate),
      progressDone: 0,
      progressTotal: 0,
      taskCount: 0,
      tasks: [],
    };
  });

  tasks.forEach(task => {
    const key = task.milestoneId || task.milestoneTitle;
    if (!key) return;
    if (!milestoneMap[key]) {
      milestoneMap[key] = {
        nodeId: "",
        id: key,
        title: task.milestoneTitle || key,
        dueDate: "TBD",
        progressDone: 0,
        progressTotal: 0,
        taskCount: 0,
        tasks: [],
      };
    }
    milestoneMap[key].tasks.push(task.nodeId);
    milestoneMap[key].taskCount += 1;
    milestoneMap[key].progressTotal += 1;
    if (task.status === "Done") milestoneMap[key].progressDone += 1;
  });

  const milestones = Object.values(milestoneMap);

  const decisions = nodes
    .filter(isDecisionNode)
    .map(node => ({
      nodeId: node.id,
      id: asText(node.executionDecisionId) || node.id,
      decision: asText(node.executionDecision) || asText(node.text).split("\n")[0] || "Decision",
      date: normDate(node.executionDecisionDate || node.executionDate),
      owner: asText(node.executionOwner) || "TBD",
      context: asText(node.executionContext),
      outcome: asText(node.executionOutcome),
    }));

  const risks = nodes
    .filter(node => Boolean(asText(node.executionRiskId)))
    .map(node => ({
      nodeId: node.id,
      id: asText(node.executionRiskId) || node.id,
      title: asText(node.text).split("\n")[0] || "Risk",
      status: asText(node.executionRiskStatus) || "open",
      impact: asText(node.executionRiskImpact) || "medium",
    }));

  const circularTaskIds = computeCircularDependencies(tasks.map(task => task.id), deps);

  const blockedTasks = tasks.filter(task => task.isBlocked);
  const overdueTasks = tasks.filter(task => task.isOverdue);
  const noOwnerTasks = tasks.filter(task => !asText(task.owner) || task.owner === "TBD");
  const noDueDateTasks = tasks.filter(task => task.dueDate === "TBD");
  const doneCount = tasks.filter(task => task.status === "Done").length;

  let healthScore = 100;
  healthScore -= Math.min(blockedTasks.length * 12, 36);
  healthScore -= Math.min(overdueTasks.length * 10, 30);
  healthScore -= Math.min(noOwnerTasks.length * 6, 18);
  healthScore -= Math.min(noDueDateTasks.length * 5, 15);
  if (circularTaskIds.length) healthScore -= 20;
  if (tasks.length) {
    const completionBonus = Math.min(10, Math.round((doneCount / tasks.length) * 12));
    healthScore += completionBonus;
  }
  healthScore = clamp(Math.round(healthScore), 0, 100);

  const warnings = [];
  blockedTasks.slice(0, 40).forEach(task => warnings.push({ type: "blocked_task", nodeId: task.nodeId, message: `${task.title} is blocked` }));
  overdueTasks.slice(0, 40).forEach(task => warnings.push({ type: "overdue_task", nodeId: task.nodeId, message: `${task.title} is overdue` }));
  if (circularTaskIds.length) {
    circularTaskIds.slice(0, 12).forEach(taskId => {
      const task = tasks.find(entry => entry.id === taskId);
      warnings.push({ type: "circular_dependency", nodeId: task?.nodeId || "", message: `Circular dependency around ${task?.title || taskId}` });
    });
  }

  return {
    tasks,
    milestones,
    decisions,
    risks,
    dependencies: deps,
    blockedTasks,
    overdueTasks,
    circularTaskIds,
    warnings,
    healthScore,
    stats: {
      totalTasks: tasks.length,
      doneTasks: doneCount,
      blockedTasks: blockedTasks.length,
      overdueTasks: overdueTasks.length,
      milestones: milestones.length,
      decisions: decisions.length,
      risks: risks.length,
    },
  };
}

function nextSlot(nodes, { startX = 120, startY = 120, stepX = 30, stepY = 24 } = {}) {
  if (!nodes.length) return { x: startX, y: startY };
  const maxX = Math.max(...nodes.map(node => Number(node.x) || 0));
  const maxY = Math.max(...nodes.map(node => Number(node.y) || 0));
  return {
    x: maxX + stepX,
    y: maxY + stepY,
  };
}

function createTaskNode(uid, x, y, payload = {}) {
  const task = {
    id: asText(payload.id) || uid(),
    title: asText(payload.title) || "New Task",
    description: asText(payload.description),
    status: normalizeStatus(payload.status),
    owner: asText(payload.owner) || "TBD",
    priority: normalizePriority(payload.priority),
    dueDate: normDate(payload.dueDate),
    tags: parseTags(payload.tags),
    milestoneId: asText(payload.milestoneId),
    milestoneTitle: asText(payload.milestoneTitle),
    githubUrl: asText(payload.githubUrl),
    jiraUrl: asText(payload.jiraUrl),
  };
  return {
    id: uid(),
    type: "task",
    x,
    y,
    w: 250,
    h: 150,
    text: buildTaskText(task),
    color: "#0f172a",
    textColor: "#e2e8f0",
    borderColor: task.status === "Blocked" ? "#f97316" : "#334155",
    fontSize: 11,
    fontWeight: "500",
    executionTaskId: task.id,
    executionTitle: task.title,
    executionDescription: task.description,
    executionStatus: task.status,
    executionOwner: task.owner,
    executionPriority: task.priority,
    executionDueDate: task.dueDate,
    executionTags: task.tags,
    executionMilestoneId: task.milestoneId || null,
    executionMilestone: task.milestoneTitle || "",
    executionGithubUrl: task.githubUrl || null,
    executionJiraUrl: task.jiraUrl || null,
  };
}

function createMilestoneNode(uid, x, y, payload = {}) {
  const milestone = {
    id: asText(payload.id) || uid(),
    title: asText(payload.title) || "Milestone",
    dueDate: normDate(payload.dueDate),
    progressDone: Number(payload.progressDone) || 0,
    progressTotal: Number(payload.progressTotal) || 0,
  };
  return {
    id: uid(),
    type: "milestone",
    x,
    y,
    w: 320,
    h: 164,
    text: buildMilestoneText(milestone),
    color: "#111827",
    textColor: "#e5e7eb",
    borderColor: "#6366f1",
    fontSize: 12,
    fontWeight: "700",
    executionMilestoneId: milestone.id,
    executionMilestone: milestone.title,
    executionDueDate: milestone.dueDate,
  };
}

function createDecisionNode(uid, x, y, payload = {}) {
  const decision = {
    id: asText(payload.id) || uid(),
    decision: asText(payload.decision) || "Decision",
    date: normDate(payload.date),
    owner: asText(payload.owner) || "TBD",
    context: asText(payload.context),
    outcome: asText(payload.outcome),
  };
  return {
    id: uid(),
    type: "decision",
    x,
    y,
    w: 270,
    h: 170,
    text: buildDecisionText(decision),
    color: "#1f2937",
    textColor: "#f3f4f6",
    borderColor: "#f59e0b",
    fontSize: 11,
    fontWeight: "600",
    executionDecisionId: decision.id,
    executionDecision: decision.decision,
    executionDecisionDate: decision.date,
    executionOwner: decision.owner,
    executionContext: decision.context,
    executionOutcome: decision.outcome,
  };
}

function patchTaskNode(node, patch) {
  const nextTask = {
    id: asText(node.executionTaskId) || node.id,
    title: asText(patch.executionTitle ?? patch.title ?? node.executionTitle ?? node.text),
    description: asText(patch.executionDescription ?? node.executionDescription),
    status: normalizeStatus(patch.executionStatus ?? patch.status ?? node.executionStatus),
    owner: asText(patch.executionOwner ?? patch.owner ?? node.executionOwner) || "TBD",
    priority: normalizePriority(patch.executionPriority ?? patch.priority ?? node.executionPriority),
    dueDate: normDate(patch.executionDueDate ?? patch.dueDate ?? node.executionDueDate),
    tags: parseTags(patch.executionTags ?? patch.tags ?? node.executionTags),
    milestoneId: asText(patch.executionMilestoneId ?? node.executionMilestoneId),
    milestoneTitle: asText(patch.executionMilestone ?? node.executionMilestone),
    githubUrl: asText(patch.executionGithubUrl ?? patch.githubUrl ?? node.executionGithubUrl ?? node.executionIssueUrl),
    jiraUrl: asText(patch.executionJiraUrl ?? patch.jiraUrl ?? node.executionJiraUrl),
  };

  return {
    ...patch,
    executionTaskId: nextTask.id,
    executionTitle: nextTask.title,
    executionDescription: nextTask.description,
    executionStatus: nextTask.status,
    executionOwner: nextTask.owner,
    executionPriority: nextTask.priority,
    executionDueDate: nextTask.dueDate,
    executionTags: nextTask.tags,
    executionMilestoneId: nextTask.milestoneId || null,
    executionMilestone: nextTask.milestoneTitle || "",
    executionGithubUrl: nextTask.githubUrl || null,
    executionJiraUrl: nextTask.jiraUrl || null,
    text: buildTaskText(nextTask),
    borderColor: nextTask.status === "Blocked" ? "#f97316" : "#334155",
  };
}

function patchMilestoneNode(node, patch) {
  const milestone = {
    id: asText(patch.executionMilestoneId ?? node.executionMilestoneId) || node.id,
    title: asText(patch.executionMilestone ?? patch.title ?? node.executionMilestone ?? node.text),
    dueDate: normDate(patch.executionDueDate ?? patch.executionMilestoneDate ?? node.executionDueDate),
    progressDone: Number(patch.executionProgressDone ?? patch.progressDone ?? 0),
    progressTotal: Number(patch.executionProgressTotal ?? patch.progressTotal ?? 0),
  };
  return {
    ...patch,
    executionMilestoneId: milestone.id,
    executionMilestone: milestone.title,
    executionDueDate: milestone.dueDate,
    text: buildMilestoneText(milestone),
  };
}

function patchDecisionNode(node, patch) {
  const decision = {
    id: asText(patch.executionDecisionId ?? node.executionDecisionId) || node.id,
    decision: asText(patch.executionDecision ?? patch.decision ?? node.executionDecision ?? node.text),
    date: normDate(patch.executionDecisionDate ?? patch.date ?? node.executionDecisionDate),
    owner: asText(patch.executionOwner ?? patch.owner ?? node.executionOwner) || "TBD",
    context: asText(patch.executionContext ?? patch.context ?? node.executionContext),
    outcome: asText(patch.executionOutcome ?? patch.outcome ?? node.executionOutcome),
  };
  return {
    ...patch,
    executionDecisionId: decision.id,
    executionDecision: decision.decision,
    executionDecisionDate: decision.date,
    executionOwner: decision.owner,
    executionContext: decision.context,
    executionOutcome: decision.outcome,
    text: buildDecisionText(decision),
  };
}

export function useExecutionIntelligence({ s, d, uid, notify }) {
  const [meetingNotes, setMeetingNotes] = useState("");
  const [autopilotLoading, setAutopilotLoading] = useState(false);
  const [autopilotError, setAutopilotError] = useState("");
  const [autopilotSummary, setAutopilotSummary] = useState("");

  const snapshot = useMemo(() => deriveExecutionSnapshot(s), [s]);

  const addTask = useCallback((payload = {}) => {
    const pos = nextSlot(toArray(s.nodes));
    const node = createTaskNode(uid, pos.x, pos.y, payload);
    d({ type: "ADD", node });
    d({ type: "SEL", v: [node.id] });
    return node;
  }, [d, s.nodes, uid]);

  const addMilestone = useCallback((payload = {}) => {
    const pos = nextSlot(toArray(s.nodes), { stepX: 20, stepY: 18 });
    const node = createMilestoneNode(uid, pos.x, pos.y, payload);
    d({ type: "ADD", node });
    d({ type: "SEL", v: [node.id] });
    return node;
  }, [d, s.nodes, uid]);

  const addDecision = useCallback((payload = {}) => {
    const pos = nextSlot(toArray(s.nodes), { stepX: 16, stepY: 14 });
    const node = createDecisionNode(uid, pos.x, pos.y, payload);
    d({ type: "ADD", node });
    d({ type: "SEL", v: [node.id] });
    return node;
  }, [d, s.nodes, uid]);

  const focusNode = useCallback(nodeId => {
    if (!nodeId) return;
    d({ type: "SEL", v: [nodeId] });
  }, [d]);

  const updateNode = useCallback((nodeId, patch) => {
    const node = toArray(s.nodes).find(item => item.id === nodeId);
    if (!node) return;
    if (isTaskNode(node)) {
      d({ type: "UPD", id: nodeId, p: patchTaskNode(node, patch) });
      return;
    }
    if (isMilestoneNode(node)) {
      d({ type: "UPD", id: nodeId, p: patchMilestoneNode(node, patch) });
      return;
    }
    if (isDecisionNode(node)) {
      d({ type: "UPD", id: nodeId, p: patchDecisionNode(node, patch) });
      return;
    }
    d({ type: "UPD", id: nodeId, p: patch });
  }, [d, s.nodes]);

  const updateDependencyType = useCallback((arrowId, depType) => {
    const type = normalizeDependencyType(depType);
    d({ type: "UPD_ARR", id: arrowId, p: { depType: type, label: dependencyLabel(type) } });
  }, [d]);

  const updateTaskDueDate = useCallback((nodeId, dueDate) => {
    updateNode(nodeId, { executionDueDate: normDate(dueDate) });
  }, [updateNode]);

  const runMeetingAutopilot = useCallback(async ({ replace = false } = {}) => {
    const notes = asText(meetingNotes);
    if (!notes || autopilotLoading) return;

    setAutopilotLoading(true);
    setAutopilotError("");
    setAutopilotSummary("");

    try {
      const prompt = [
        "Convert these meeting notes into execution board JSON.",
        "Extract tasks, milestones, decisions, dependencies.",
        "",
        "MEETING NOTES:",
        notes,
      ].join("\n");

      const raw = await aiCall(prompt, EXEC_MEETING_SYS);
      const parsed = parseAiJson(raw);

      const rawMilestones = toArray(parsed.milestones);
      const rawTasks = toArray(parsed.tasks);
      const rawDecisions = toArray(parsed.decisions);
      const rawDeps = toArray(parsed.dependencies);

      const nodes = [];
      const arrows = [];
      const milestoneNodeById = {};
      const taskNodeByTaskId = {};

      const startX = 80;
      const startY = 80;
      const milestoneGapX = 360;

      rawMilestones.forEach((entry, idx) => {
        const milestone = {
          id: asText(entry?.id) || `m${idx + 1}`,
          title: asText(entry?.title) || `Milestone ${idx + 1}`,
          dueDate: normDate(entry?.dueDate),
          progressDone: 0,
          progressTotal: 0,
        };
        const node = createMilestoneNode(uid, startX + idx * milestoneGapX, startY, milestone);
        nodes.push(node);
        milestoneNodeById[milestone.id] = node;
      });

      const laneMap = {};
      rawTasks.forEach((entry, idx) => {
        const task = {
          id: asText(entry?.id) || `t${idx + 1}`,
          title: asText(entry?.title) || `Task ${idx + 1}`,
          description: asText(entry?.description),
          status: normalizeStatus(entry?.status),
          owner: asText(entry?.owner) || "TBD",
          priority: normalizePriority(entry?.priority),
          dueDate: normDate(entry?.dueDate),
          tags: parseTags(entry?.tags),
          milestoneId: asText(entry?.milestoneId),
          milestoneTitle: "",
          githubUrl: asText(entry?.githubUrl),
          jiraUrl: asText(entry?.jiraUrl),
        };

        const milestoneNode = task.milestoneId ? milestoneNodeById[task.milestoneId] : null;
        const laneKey = milestoneNode?.id || "__unassigned__";
        laneMap[laneKey] = (laneMap[laneKey] || 0) + 1;

        const colIdx = milestoneNode
          ? Math.max(0, rawMilestones.findIndex(ms => (asText(ms?.id) || "") === task.milestoneId))
          : rawMilestones.length;
        const rowIdx = laneMap[laneKey] - 1;

        const x = startX + colIdx * milestoneGapX;
        const y = milestoneNode ? (startY + 210 + rowIdx * 180) : (startY + rowIdx * 180);

        if (milestoneNode) {
          task.milestoneTitle = asText(milestoneNode.executionMilestone) || asText(milestoneNode.text);
        }

        const node = createTaskNode(uid, x, y, task);
        nodes.push(node);
        taskNodeByTaskId[task.id] = node;

        if (milestoneNode) {
          arrows.push({
            id: uid(),
            fromId: milestoneNode.id,
            toId: node.id,
            label: "milestone",
            depType: "related",
          });
        }
      });

      rawDecisions.forEach((entry, idx) => {
        const decision = {
          id: asText(entry?.id) || `d${idx + 1}`,
          decision: asText(entry?.decision) || `Decision ${idx + 1}`,
          date: normDate(entry?.date),
          owner: asText(entry?.owner) || "TBD",
          context: asText(entry?.context),
          outcome: asText(entry?.outcome),
        };
        const x = startX + (rawMilestones.length + 1) * milestoneGapX;
        const y = startY + idx * 190;
        nodes.push(createDecisionNode(uid, x, y, decision));
      });

      rawDeps.forEach(dep => {
        const fromId = asText(dep?.fromTaskId);
        const toId = asText(dep?.toTaskId);
        if (!fromId || !toId || fromId === toId) return;
        const fromNode = taskNodeByTaskId[fromId];
        const toNode = taskNodeByTaskId[toId];
        if (!fromNode || !toNode) return;
        const type = normalizeDependencyType(dep?.type);
        arrows.push({
          id: uid(),
          fromId: fromNode.id,
          toId: toNode.id,
          label: dependencyLabel(type),
          depType: type,
        });
      });

      if (!nodes.length) throw new Error("Autopilot returned no nodes.");

      d({ type: "APPLY", nodes, arrows, replace });
      d({ type: "SEL", v: nodes.slice(0, 10).map(node => node.id) });
      if (nodes.length > 2) d({ type: "TIDY", ids: nodes.map(node => node.id) });

      const summary = asText(parsed.summary) || `Generated ${rawTasks.length} tasks, ${rawMilestones.length} milestones.`;
      setAutopilotSummary(summary);
      notify?.(summary, "success");
    } catch (err) {
      const msg = err?.message || "Meeting autopilot failed.";
      setAutopilotError(msg);
      notify?.(msg, "error");
    }

    setAutopilotLoading(false);
  }, [autopilotLoading, d, meetingNotes, notify, uid]);

  return {
    ...snapshot,
    meetingNotes,
    setMeetingNotes,
    autopilotLoading,
    autopilotError,
    autopilotSummary,
    addTask,
    addMilestone,
    addDecision,
    updateNode,
    updateTaskDueDate,
    updateDependencyType,
    focusNode,
    runMeetingAutopilot,
  };
}
