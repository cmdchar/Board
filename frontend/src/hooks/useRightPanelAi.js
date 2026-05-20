import { useEffect, useRef, useState } from "react";
import { EXEC_SYS, FILE_TEMPLATE_KEYS, SW_PLAN_SYS, SW_SYS, WB_SYS } from "../ai/prompts";
import { aiCall, buildFileGenerationPrompt, normalizeTemplatePlan, parseAiJson } from "../ai/helpers";

export function useRightPanelAi({ s, d, uid, palette, theme, shapeTypes, shapeDefaults, githubApi, jiraApi, notify }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [fl, setFl] = useState(false);
  const [fn, setFn] = useState(null);
  const [fs, setFs] = useState(null);
  const [fe, setFe] = useState(null);
  const [fileDraft, setFileDraft] = useState(null);
  const [filePlan, setFilePlan] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [open, setOpen] = useState(true);
  const [execInput, setExecInput] = useState("");
  const [execLoading, setExecLoading] = useState(false);
  const [execError, setExecError] = useState(null);
  const [execSummary, setExecSummary] = useState(null);
  const [execReplace, setExecReplace] = useState(false);
  const [ghRepo, setGhRepo] = useState(() => {
    try { return localStorage.getItem("boardai_exec_github_repo") || ""; } catch { return ""; }
  });
  const [ghState, setGhState] = useState("open");
  const [ghIncremental, setGhIncremental] = useState(true);
  const [ghConflictStrategy, setGhConflictStrategy] = useState("skip_remote_newer");
  const [ghAuthLoading, setGhAuthLoading] = useState(false);
  const [ghConnected, setGhConnected] = useState(false);
  const [ghAvailable, setGhAvailable] = useState(false);
  const [ghSource, setGhSource] = useState(null);
  const [ghAccount, setGhAccount] = useState(null);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState(null);
  const [ghSummary, setGhSummary] = useState(null);
  const [jiraSite, setJiraSite] = useState(() => {
    try { return localStorage.getItem("boardai_exec_jira_site") || ""; } catch { return ""; }
  });
  const [jiraProject, setJiraProject] = useState(() => {
    try { return localStorage.getItem("boardai_exec_jira_project") || ""; } catch { return ""; }
  });
  const [jiraEmail, setJiraEmail] = useState(() => {
    try { return localStorage.getItem("boardai_exec_jira_email") || ""; } catch { return ""; }
  });
  const [jiraToken, setJiraToken] = useState("");
  const [jiraState, setJiraState] = useState("open");
  const [jiraLoading, setJiraLoading] = useState(false);
  const [jiraError, setJiraError] = useState(null);
  const [jiraSummary, setJiraSummary] = useState(null);
  const endRef = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);
  useEffect(() => {
    try { localStorage.setItem("boardai_exec_github_repo", String(ghRepo || "").trim()); } catch {}
  }, [ghRepo]);
  useEffect(() => {
    try { localStorage.setItem("boardai_exec_jira_site", String(jiraSite || "").trim()); } catch {}
  }, [jiraSite]);
  useEffect(() => {
    try { localStorage.setItem("boardai_exec_jira_project", String(jiraProject || "").trim()); } catch {}
  }, [jiraProject]);
  useEffect(() => {
    try { localStorage.setItem("boardai_exec_jira_email", String(jiraEmail || "").trim()); } catch {}
  }, [jiraEmail]);
  useEffect(() => {
    if (!githubApi?.oauthStatus) return undefined;
    const token = (() => {
      try { return localStorage.getItem("boardai_token") || ""; } catch { return ""; }
    })();
    if (!token) {
      setGhConnected(false);
      setGhAvailable(false);
      setGhSource(null);
      setGhAccount(null);
      return undefined;
    }
    refreshGitHubAuthStatus({ quiet: true });
    return undefined;
  }, [githubApi]);

  const EXEC_STAGE_ORDER = ["now", "next", "later"];
  const EXEC_STAGE_LABELS = { now: "NOW", next: "NEXT", later: "LATER" };
  const EXEC_PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const EXEC_STATUS_ORDER = { blocked: 0, todo: 1, in_progress: 2, done: 3 };
  const EXEC_STATUS_LABELS = { todo: "TODO", in_progress: "IN PROGRESS", blocked: "BLOCKED", done: "DONE" };

  const asText = value => (typeof value === "string" ? value.trim() : "");
  const toList = value => (Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value]));
  const cut = (value, max = 140) => {
    const txt = asText(value);
    if (!txt) return "";
    return txt.length > max ? `${txt.slice(0, max - 3)}...` : txt;
  };
  const uniq = arr => arr.filter((v, i) => arr.indexOf(v) === i);
  const makeIdempotencyKey = prefix => {
    const p = String(prefix || "gh").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 18) || "gh";
    const ts = Date.now().toString(36);
    const rand = (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    return `${p}:${ts}:${rand.slice(0, 24)}`;
  };

  const normalizeStage = value => {
    const txt = asText(value).toLowerCase();
    if (!txt) return "next";
    if (/(later|future|backlog|parking)/.test(txt)) return "later";
    if (/(now|current|this sprint|urgent|immediate|today|asap)/.test(txt)) return "now";
    if (/(next|upcoming|soon)/.test(txt)) return "next";
    return "next";
  };

  const normalizePriority = value => {
    const txt = asText(value).toLowerCase();
    if (!txt) return "P2";
    if (/(p0|critical|blocker|urgent)/.test(txt)) return "P0";
    if (/(p1|high)/.test(txt)) return "P1";
    if (/(p3|low)/.test(txt)) return "P3";
    return "P2";
  };

  const normalizeStatus = value => {
    const txt = asText(value).toLowerCase();
    if (!txt) return "todo";
    if (/(done|complete|completed|closed)/.test(txt)) return "done";
    if (/(blocked|blocker|stuck)/.test(txt)) return "blocked";
    if (/(progress|doing|active|started|wip)/.test(txt)) return "in_progress";
    return "todo";
  };

  const normalizeMilestoneStatus = value => {
    const txt = asText(value).toLowerCase();
    if (!txt) return "planned";
    if (/(done|complete|completed)/.test(txt)) return "done";
    if (/(risk|at_risk|at-risk)/.test(txt)) return "at_risk";
    if (/(progress|active|running|ongoing)/.test(txt)) return "in_progress";
    return "planned";
  };

  const normalizeRiskStatus = value => {
    const txt = asText(value).toLowerCase();
    if (!txt) return "open";
    if (/(mitigated|closed|resolved)/.test(txt)) return "mitigated";
    if (/(watch|monitor)/.test(txt)) return "watch";
    return "open";
  };

  const normalizeRiskImpact = value => {
    const txt = asText(value).toLowerCase();
    if (txt === "high" || txt === "medium" || txt === "low") return txt;
    if (/(critical|severe|high)/.test(txt)) return "high";
    if (/(low|minor)/.test(txt)) return "low";
    return "medium";
  };

  const normalizeDueDate = value => {
    const txt = String(value ?? "").trim();
    if (!txt) return "TBD";
    const iso = txt.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    if (/(tbd|unknown|none|n\/a|later)/i.test(txt)) return "TBD";
    return cut(txt, 24) || "TBD";
  };

  const splitRefs = value => {
    if (Array.isArray(value)) return value.flatMap(splitRefs);
    if (value === undefined || value === null) return [];
    const txt = String(value).trim();
    if (!txt) return [];
    if (/[,\n;|]/.test(txt)) return txt.split(/[,\n;|]/).map(v => v.trim()).filter(Boolean);
    return [txt];
  };

  const execTaskTone = status => {
    if (status === "done") return { bg: "#dcfce7", text: "#14532d" };
    if (status === "blocked") return { bg: "#fee2e2", text: "#7f1d1d" };
    if (status === "in_progress") return { bg: "#dbeafe", text: "#1e3a8a" };
    return { bg: "#fef9c3", text: "#713f12" };
  };

  const milestoneTone = status => {
    if (status === "done") return { bg: "#dcfce7", text: "#14532d", border: "#86efac" };
    if (status === "at_risk") return { bg: "#fee2e2", text: "#7f1d1d", border: "#fca5a5" };
    if (status === "in_progress") return { bg: "#dbeafe", text: "#1e3a8a", border: "#93c5fd" };
    return { bg: "#ede9fe", text: "#4c1d95", border: "#c4b5fd" };
  };

  const riskTone = impact => {
    if (impact === "high") return { bg: "#fee2e2", text: "#7f1d1d", border: "#fca5a5" };
    if (impact === "low") return { bg: "#dcfce7", text: "#14532d", border: "#86efac" };
    return { bg: "#fef9c3", text: "#713f12", border: "#fde047" };
  };

  function normalizeAiNodes(rawNodes) {
    const num = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };
    const normType = t => (["sticky", "shape", "text", "lane"].includes(t) ? t : "sticky");
    const normShape = s => {
      const value = String(s || "").toLowerCase();
      return shapeTypes.includes(value) ? value : "rect";
    };
    const gridX = 80;
    const gridY = 80;
    const colW = 230;
    const rowH = 170;

    return (Array.isArray(rawNodes) ? rawNodes : [])
      .map((node, i) => {
        const gx = gridX + (i % 4) * colW;
        const gy = gridY + Math.floor(i / 4) * rowH;
        if (typeof node === "string") {
          const colorSet = palette[i % palette.length];
          return {
            id: `n${i + 1}`,
            type: "sticky",
            x: gx,
            y: gy,
            w: 170,
            h: 130,
            text: node,
            color: colorSet.bg,
            textColor: colorSet.t,
            fontSize: 12,
            fontWeight: "normal",
          };
        }
        if (!node || typeof node !== "object") return null;

        const type = normType(node.type);
        const shapeType = type === "shape" ? normShape(node.shapeType) : undefined;
        let w = num(node.w, type === "sticky" ? 170 : type === "text" ? 220 : type === "lane" ? 820 : 150);
        let h = num(node.h, type === "sticky" ? 130 : type === "text" ? 52 : type === "lane" ? 180 : 76);
        if (type === "shape") {
          const def = shapeDefaults[shapeType] || shapeDefaults.rect;
          w = num(node.w, def.w);
          h = num(node.h, def.h);
        }

        const tableId = typeof node.tableId === "string" && node.tableId.trim() ? node.tableId.trim() : undefined;
        const tableRole = ["title", "header", "cell"].includes(node.tableRole) ? node.tableRole : undefined;
        const tRow = Number.isInteger(Number(node.tableRow)) ? Number(node.tableRow) : undefined;
        const tCol = Number.isInteger(Number(node.tableCol)) ? Number(node.tableCol) : undefined;

        return {
          id: String(node.id || `n${i + 1}`),
          type,
          ...(shapeType ? { shapeType } : {}),
          ...(type === "lane" ? { orientation: node.orientation === "v" ? "v" : "h" } : {}),
          ...(tableId ? { tableId } : {}),
          ...(tableRole ? { tableRole } : {}),
          ...(tRow !== undefined ? { tableRow: tRow } : {}),
          ...(tCol !== undefined ? { tableCol: tCol } : {}),
          ...(typeof node.groupId === "string" && node.groupId ? { groupId: node.groupId } : {}),
          x: num(node.x, gx),
          y: num(node.y, gy),
          w,
          h,
          text: typeof node.text === "string" ? node.text : "",
          color: typeof node.color === "string" ? node.color : (type === "sticky" ? palette[i % palette.length].bg : theme.bg3),
          textColor: typeof node.textColor === "string" ? node.textColor : (type === "sticky" ? palette[i % palette.length].t : theme.t0),
          borderColor: typeof node.borderColor === "string" ? node.borderColor : theme.b1,
          fontSize: num(node.fontSize, type === "text" ? 22 : 12),
          fontWeight: node.fontWeight === "bold" ? "bold" : "normal",
        };
      })
      .filter(Boolean);
  }

  function normalizeAiArrows(rawArrows, idMap, textMap) {
    const out = [];
    const pickNodeId = value => {
      if (!value && value !== 0) return null;
      const key = String(value);
      if (idMap[key]) return idMap[key];
      const textKey = key.trim().toLowerCase();
      return textMap[textKey] || null;
    };

    for (let i = 0; i < (Array.isArray(rawArrows) ? rawArrows : []).length; i++) {
      const arrow = rawArrows[i];
      if (typeof arrow === "string") {
        const parts = arrow.split("->");
        if (parts.length === 2) {
          const fromId = pickNodeId(parts[0]);
          const toId = pickNodeId(parts[1]);
          if (fromId && toId && fromId !== toId) out.push({ id: uid(), fromId, toId, label: "" });
        }
        continue;
      }
      if (!arrow || typeof arrow !== "object") continue;
      const fromId = pickNodeId(arrow.fromId ?? arrow.from ?? arrow.source);
      const toId = pickNodeId(arrow.toId ?? arrow.to ?? arrow.target);
      if (!fromId || !toId || fromId === toId) continue;
      out.push({ id: uid(), fromId, toId, label: typeof arrow.label === "string" ? arrow.label : "" });
    }

    return out;
  }

  function normalizeExecutionPlan(raw) {
    const parsed = parseAiJson(raw);
    const title = cut(parsed.title || parsed.name || "Execution Plan", 92) || "Execution Plan";
    const objectives = toList(parsed.objectives || parsed.outcomes || parsed.goals)
      .map(item => cut(typeof item === "string" ? item : (item?.title || item?.text || ""), 140))
      .filter(Boolean)
      .slice(0, 6);

    const milestones = [];
    const milestoneLookup = {};
    const milestoneIdSet = new Set();
    const nextMilestoneId = () => `m${milestones.length + 1}`;

    const registerMilestone = payload => {
      const titleText = cut(payload?.title || payload?.name || payload?.label || nextMilestoneId(), 88) || nextMilestoneId();
      let idBase = cut(payload?.id || payload?.key || nextMilestoneId(), 36) || nextMilestoneId();
      idBase = idBase.replace(/\s+/g, "_");
      let id = idBase;
      let i = 2;
      while (milestoneIdSet.has(id.toLowerCase())) {
        id = `${idBase}_${i++}`;
      }
      milestoneIdSet.add(id.toLowerCase());
      const entry = {
        id,
        title: titleText,
        targetDate: normalizeDueDate(payload?.targetDate || payload?.target_date || payload?.dueDate || payload?.due || payload?.date),
        status: normalizeMilestoneStatus(payload?.status),
      };
      milestones.push(entry);
      milestoneLookup[id.toLowerCase()] = entry.id;
      milestoneLookup[entry.title.toLowerCase()] = entry.id;
      return entry.id;
    };

    const rawMilestones = Array.isArray(parsed.milestones) ? parsed.milestones : [];
    rawMilestones.forEach((item, i) => {
      if (typeof item === "string") {
        registerMilestone({ id: `m${i + 1}`, title: item, status: "planned", targetDate: "TBD" });
        return;
      }
      if (!item || typeof item !== "object") return;
      registerMilestone(item);
    });

    const taskSource = Array.isArray(parsed.tasks)
      ? parsed.tasks
      : (Array.isArray(parsed.workPackages)
        ? parsed.workPackages
        : (Array.isArray(parsed.work_packages)
          ? parsed.work_packages
          : (Array.isArray(parsed.workItems) ? parsed.workItems : [])));

    const tasks = [];
    const taskLookup = {};
    const taskIdSet = new Set();
    taskSource.forEach((item, i) => {
      const obj = typeof item === "string" ? { title: item } : item;
      if (!obj || typeof obj !== "object") return;
      const titleText = cut(obj.title || obj.name || obj.text || obj.summary || `Task ${i + 1}`, 120) || `Task ${i + 1}`;
      let idBase = cut(obj.id || obj.key || obj.ticket || obj.ref || `t${i + 1}`, 40) || `t${i + 1}`;
      idBase = idBase.replace(/\s+/g, "_");
      let id = idBase;
      let k = 2;
      while (taskIdSet.has(id.toLowerCase())) {
        id = `${idBase}_${k++}`;
      }
      taskIdSet.add(id.toLowerCase());
      const riskRaw = Array.isArray(obj.risks) ? obj.risks[0] : obj.risk;
      const sourceRefs = splitRefs(obj.sourceRefs ?? obj.source_refs ?? obj.sourceRef ?? obj.ticket ?? obj.issue)
        .map(ref => cut(ref, 50))
        .filter(Boolean)
        .slice(0, 5);
      const issueNumberRaw = Number(
        obj.issueNumber
        ?? obj.issue_number
        ?? (sourceRefs.join(" ").match(/#(\d+)/)?.[1] || NaN),
      );
      const task = {
        id,
        title: titleText,
        description: cut(obj.description || obj.details || obj.note || "", 200),
        stage: normalizeStage(obj.stage || obj.timeline || obj.bucket || obj.when),
        owner: cut(obj.owner || obj.assignee || obj.responsible || "TBD", 44) || "TBD",
        priority: normalizePriority(obj.priority || obj.severity),
        status: normalizeStatus(obj.status || obj.state),
        dueDate: normalizeDueDate(obj.dueDate || obj.due || obj.deadline || obj.targetDate),
        milestoneRef: cut(obj.milestoneId ?? obj.milestone ?? obj.phase ?? "", 88),
        dependsOnRefs: splitRefs(obj.dependsOn ?? obj.dependencies ?? obj.depends_on ?? obj.blockedBy ?? obj.blocked_by),
        risk: cut(riskRaw || "", 100),
        sourceRefs,
        issueNumber: Number.isInteger(issueNumberRaw) && issueNumberRaw > 0 ? issueNumberRaw : null,
        issueUrl: cut(obj.issueUrl || obj.issue_url || obj.url || "", 200),
        issueState: cut(obj.issueState || obj.issue_state || "", 20),
        issueUpdatedAt: cut(obj.issueUpdatedAt || obj.issue_updated_at || "", 48),
        repo: cut(obj.repo || obj.executionRepo || "", 120),
        milestoneId: null,
        milestoneTitle: "TBD",
        dependsOn: [],
      };
      tasks.push(task);
      taskLookup[task.id.toLowerCase()] = task.id;
      taskLookup[task.title.toLowerCase()] = task.id;
      sourceRefs.forEach(ref => {
        taskLookup[ref.toLowerCase()] = task.id;
      });
    });

    if (!tasks.length) throw new Error("Execution JSON missing tasks");

    const findMilestoneId = ref => {
      const key = asText(ref).toLowerCase();
      if (!key) return null;
      if (milestoneLookup[key]) return milestoneLookup[key];
      const fuzzy = milestones.find(m => m.title.toLowerCase().includes(key) || key.includes(m.title.toLowerCase()));
      return fuzzy?.id || null;
    };

    tasks.forEach(task => {
      if (!task.milestoneRef) return;
      let milestoneId = findMilestoneId(task.milestoneRef);
      if (!milestoneId) {
        milestoneId = registerMilestone({
          id: nextMilestoneId(),
          title: task.milestoneRef,
          status: "planned",
          targetDate: "TBD",
        });
      }
      const milestone = milestones.find(m => m.id === milestoneId);
      task.milestoneId = milestoneId;
      task.milestoneTitle = milestone?.title || task.milestoneRef;
    });

    const resolveTaskRef = ref => {
      const key = asText(ref).toLowerCase();
      if (!key) return null;
      if (taskLookup[key]) return taskLookup[key];
      const fuzzy = tasks.find(task => task.title.toLowerCase().includes(key) || key.includes(task.title.toLowerCase()));
      return fuzzy?.id || null;
    };

    tasks.forEach(task => {
      task.dependsOn = uniq(task.dependsOnRefs.map(resolveTaskRef).filter(Boolean)).filter(dep => dep !== task.id);
    });

    const risks = [];
    const rawRisks = Array.isArray(parsed.risks) ? parsed.risks : [];
    const riskIdSet = new Set();
    rawRisks.forEach((item, i) => {
      const obj = typeof item === "string" ? { title: item } : item;
      if (!obj || typeof obj !== "object") return;
      let idBase = cut(obj.id || obj.key || `r${i + 1}`, 36) || `r${i + 1}`;
      idBase = idBase.replace(/\s+/g, "_");
      let id = idBase;
      let z = 2;
      while (riskIdSet.has(id.toLowerCase())) {
        id = `${idBase}_${z++}`;
      }
      riskIdSet.add(id.toLowerCase());
      const taskIds = uniq(splitRefs(obj.taskIds ?? obj.tasks ?? obj.relatedTasks).map(resolveTaskRef).filter(Boolean));
      risks.push({
        id,
        title: cut(obj.title || obj.name || obj.text || `Risk ${i + 1}`, 100) || `Risk ${i + 1}`,
        impact: normalizeRiskImpact(obj.impact),
        mitigation: cut(obj.mitigation || obj.plan || obj.response || "", 120),
        owner: cut(obj.owner || obj.assignee || "TBD", 44) || "TBD",
        status: normalizeRiskStatus(obj.status),
        taskIds,
      });
    });

    return {
      title,
      objectives,
      milestones,
      tasks,
      risks,
      message: cut(parsed.message || "", 220),
      summary: cut(parsed.summary || "", 260),
    };
  }

  function formatExecutionTaskText(task) {
    const lines = [
      task.title,
      `Issue: ${task.issueNumber ? `#${task.issueNumber}` : "NEW"}`,
      `Owner: ${task.owner}`,
      `Status: ${EXEC_STATUS_LABELS[task.status] || task.status}`,
      `Priority: ${task.priority}`,
      `Due: ${task.dueDate}`,
      `Milestone: ${task.milestoneTitle || "TBD"}`,
    ];
    if (task.risk) lines.push(`Risk: ${task.risk}`);
    if (task.description) lines.push("", task.description);
    return lines.join("\n");
  }

  function repoFromIssueUrl(url) {
    const txt = String(url || "").trim();
    const m = txt.match(/github\.com\/([^/]+)\/([^/]+)\//i);
    if (!m) return "";
    return `${m[1]}/${m[2]}`.toLowerCase();
  }

  function applyExecutionPlan(raw, replace = false) {
    const plan = normalizeExecutionPlan(raw);
    const stages = { now: [], next: [], later: [] };
    plan.tasks.forEach(task => {
      stages[EXEC_STAGE_ORDER.includes(task.stage) ? task.stage : "next"].push(task);
    });
    EXEC_STAGE_ORDER.forEach(stage => {
      stages[stage].sort((a, b) => {
        const byPriority = (EXEC_PRIORITY_ORDER[a.priority] ?? 9) - (EXEC_PRIORITY_ORDER[b.priority] ?? 9);
        if (byPriority !== 0) return byPriority;
        const byStatus = (EXEC_STATUS_ORDER[a.status] ?? 9) - (EXEC_STATUS_ORDER[b.status] ?? 9);
        if (byStatus !== 0) return byStatus;
        return a.title.localeCompare(b.title);
      });
    });

    const laneWidth = 352;
    const laneGap = 34;
    const laneStartX = 72;
    const titleY = 24;
    const objectiveY = 72;
    const objectiveText = plan.objectives.length
      ? plan.objectives.map((line, i) => `${i + 1}. ${line}`).join("\n")
      : "1. Scope and prioritize delivery\n2. Execute predictable milestones\n3. Track risks and ownership";
    const objectiveH = Math.min(150, Math.max(76, 46 + objectiveText.split("\n").length * 18));
    const laneY = objectiveY + objectiveH + 24;
    const taskHeight = 124;
    const taskGap = 12;
    const maxTasks = Math.max(1, ...EXEC_STAGE_ORDER.map(stage => stages[stage].length));
    const laneHeight = Math.max(470, 78 + maxTasks * (taskHeight + taskGap));
    const lanesTotalWidth = EXEC_STAGE_ORDER.length * laneWidth + (EXEC_STAGE_ORDER.length - 1) * laneGap;
    const sideX = laneStartX + lanesTotalWidth + 56;

    const nodes = [];
    const arrows = [];
    const taskNodeIds = {};
    const milestoneNodeIds = {};
    const riskNodeIds = {};

    nodes.push({
      id: uid(),
      type: "text",
      x: laneStartX,
      y: titleY,
      w: lanesTotalWidth + 360,
      h: 40,
      text: plan.title,
      color: theme.t0,
      textColor: theme.t0,
      fontSize: 30,
      fontWeight: "700",
    });

    nodes.push({
      id: uid(),
      type: "shape",
      shapeType: "rect",
      x: laneStartX,
      y: objectiveY,
      w: lanesTotalWidth,
      h: objectiveH,
      text: `Objectives\n${objectiveText}`,
      color: theme.bg3,
      textColor: theme.t0,
      borderColor: theme.b1,
      fontSize: 12,
      fontWeight: "600",
    });

    EXEC_STAGE_ORDER.forEach((stage, laneIndex) => {
      const laneTasks = stages[stage];
      const laneX = laneStartX + laneIndex * (laneWidth + laneGap);
      nodes.push({
        id: uid(),
        type: "lane",
        orientation: "v",
        x: laneX,
        y: laneY,
        w: laneWidth,
        h: laneHeight,
        text: `${EXEC_STAGE_LABELS[stage]} (${laneTasks.length})`,
        color: theme.bg3,
        textColor: theme.t0,
        borderColor: theme.b1,
        fontSize: 12,
        fontWeight: "700",
      });

      laneTasks.forEach((task, i) => {
        const tone = execTaskTone(task.status);
        const taskNodeId = uid();
        taskNodeIds[task.id] = taskNodeId;
        nodes.push({
          id: taskNodeId,
          type: "sticky",
          x: laneX + 12,
          y: laneY + 64 + i * (taskHeight + taskGap),
          w: laneWidth - 24,
          h: taskHeight,
          text: formatExecutionTaskText(task),
          color: tone.bg,
          textColor: tone.text,
          borderColor: theme.b1,
          fontSize: 11,
          fontWeight: "normal",
          executionTaskId: task.id,
          executionTitle: task.title,
          executionDescription: task.description || "",
          executionStage: task.stage,
          executionOwner: task.owner,
          executionPriority: task.priority,
          executionStatus: task.status,
          executionDueDate: task.dueDate,
          executionMilestoneId: task.milestoneId || null,
          executionMilestone: task.milestoneTitle || "TBD",
          executionIssueNumber: task.issueNumber || null,
          executionIssueUrl: task.issueUrl || null,
          executionIssueState: task.issueState || null,
          executionIssueUpdatedAt: task.issueUpdatedAt || "",
          executionLastSyncedAt: task.issueUpdatedAt || "",
          executionRepo: task.repo || repoFromIssueUrl(task.issueUrl),
          executionSourceRefs: task.sourceRefs || [],
        });
      });
    });

    if (plan.milestones.length) {
      nodes.push({
        id: uid(),
        type: "text",
        x: sideX,
        y: objectiveY,
        w: 320,
        h: 24,
        text: "Milestones",
        color: theme.t0,
        textColor: theme.t0,
        fontSize: 18,
        fontWeight: "700",
      });

      let y = objectiveY + 30;
      plan.milestones.forEach(milestone => {
        const tone = milestoneTone(milestone.status);
        const nodeId = uid();
        milestoneNodeIds[milestone.id] = nodeId;
        nodes.push({
          id: nodeId,
          type: "shape",
          shapeType: "rect",
          x: sideX,
          y,
          w: 320,
          h: 76,
          text: `${milestone.title}\nDate: ${milestone.targetDate}\nStatus: ${milestone.status.toUpperCase()}`,
          color: tone.bg,
          textColor: tone.text,
          borderColor: tone.border,
          fontSize: 11,
          fontWeight: "600",
          executionMilestoneId: milestone.id,
          executionMilestoneStatus: milestone.status,
          executionMilestoneDate: milestone.targetDate,
        });
        y += 86;
      });
    }

    const riskStartY = Math.max(laneY + 12, objectiveY + 30 + plan.milestones.length * 86 + (plan.milestones.length ? 18 : 0));
    if (plan.risks.length) {
      nodes.push({
        id: uid(),
        type: "text",
        x: sideX,
        y: riskStartY,
        w: 320,
        h: 24,
        text: "Risks",
        color: theme.t0,
        textColor: theme.t0,
        fontSize: 18,
        fontWeight: "700",
      });

      let y = riskStartY + 28;
      plan.risks.forEach(risk => {
        const tone = riskTone(risk.impact);
        const nodeId = uid();
        riskNodeIds[risk.id] = nodeId;
        nodes.push({
          id: nodeId,
          type: "sticky",
          x: sideX,
          y,
          w: 320,
          h: 102,
          text: `${risk.title}\nImpact: ${risk.impact.toUpperCase()} | Status: ${risk.status.toUpperCase()}\nOwner: ${risk.owner}\nMitigation: ${risk.mitigation || "TBD"}`,
          color: tone.bg,
          textColor: tone.text,
          borderColor: tone.border,
          fontSize: 11,
          fontWeight: "normal",
          executionRiskId: risk.id,
          executionRiskStatus: risk.status,
          executionRiskImpact: risk.impact,
        });
        y += 112;
      });
    }

    plan.tasks.forEach(task => {
      const toTaskNode = taskNodeIds[task.id];
      if (!toTaskNode) return;
      task.dependsOn.forEach(depId => {
        const fromTaskNode = taskNodeIds[depId];
        if (!fromTaskNode || fromTaskNode === toTaskNode) return;
        arrows.push({ id: uid(), fromId: fromTaskNode, toId: toTaskNode, label: "depends on" });
      });
      if (task.milestoneId && milestoneNodeIds[task.milestoneId]) {
        arrows.push({ id: uid(), fromId: milestoneNodeIds[task.milestoneId], toId: toTaskNode, label: "milestone" });
      }
    });

    plan.risks.forEach(risk => {
      const fromRiskNode = riskNodeIds[risk.id];
      if (!fromRiskNode) return;
      risk.taskIds.forEach(taskId => {
        const toTaskNode = taskNodeIds[taskId];
        if (!toTaskNode) return;
        arrows.push({ id: uid(), fromId: fromRiskNode, toId: toTaskNode, label: "risk" });
      });
    });

    d({ type: "APPLY", nodes, arrows, replace });
    return {
      nodes,
      arrows,
      message: plan.message || `Execution board ready: ${plan.tasks.length} tasks mapped.`,
      summary: plan.summary || `${plan.tasks.length} tasks, ${plan.milestones.length} milestones, ${arrows.length} links`,
    };
  }

  function extractExecutionTasksForSync() {
    const execNodes = s.nodes.filter(node => String(node.executionTaskId || "").trim());
    if (!execNodes.length) return [];

    const nodeToTask = Object.fromEntries(execNodes.map(node => [node.id, String(node.executionTaskId)]));
    const depsByTask = {};
    for (const arrow of s.arrows || []) {
      const fromTask = nodeToTask[arrow.fromId];
      const toTask = nodeToTask[arrow.toId];
      if (!fromTask || !toTask || fromTask === toTask) continue;
      const label = String(arrow.label || "").toLowerCase();
      if (label && !/depend|block/.test(label)) continue;
      if (!depsByTask[toTask]) depsByTask[toTask] = [];
      depsByTask[toTask].push(fromTask);
    }

    const uniqList = arr => arr.filter((v, i) => arr.indexOf(v) === i);
    const pickFromText = (text, prefix) => {
      const rows = String(text || "").split(/\r?\n/);
      const p = `${prefix.toLowerCase()}:`;
      const line = rows.find(row => row.trim().toLowerCase().startsWith(p));
      return line ? line.trim().slice(p.length).trim() : "";
    };

    return execNodes.map(node => {
      const text = String(node.text || "");
      const lines = text.split(/\r?\n/).map(v => v.trim()).filter(Boolean);
      const title = (node.executionTitle || lines[0] || "Untitled Task").trim();
      const issueMatch = String(node.executionIssueNumber || pickFromText(text, "Issue") || "").match(/#?(\d+)/);
      const issueNumber = issueMatch ? Number(issueMatch[1]) : null;
      const metaPrefixes = ["issue:", "owner:", "status:", "priority:", "due:", "milestone:", "risk:"];
      const description = String(node.executionDescription || (
        lines
          .slice(1)
          .filter(line => !metaPrefixes.some(p => line.toLowerCase().startsWith(p)))
          .join("\n")
      ) || "").trim();
      return {
        nodeId: node.id,
        taskId: String(node.executionTaskId || node.id),
        title,
        description,
        stage: String(node.executionStage || "next"),
        owner: String(node.executionOwner || pickFromText(text, "Owner") || "TBD"),
        priority: normalizePriority(String(node.executionPriority || pickFromText(text, "Priority") || "P2")),
        status: normalizeStatus(String(node.executionStatus || pickFromText(text, "Status") || "todo")),
        dueDate: normalizeDueDate(String(node.executionDueDate || pickFromText(text, "Due") || "TBD")),
        milestoneTitle: String(node.executionMilestone || pickFromText(text, "Milestone") || ""),
        issueNumber: Number.isInteger(issueNumber) ? issueNumber : null,
        issueUpdatedAt: String(node.executionIssueUpdatedAt || ""),
        lastSyncedAt: String(node.executionLastSyncedAt || ""),
        repo: String(node.executionRepo || ""),
        sourceRefs: [
          node.executionIssueUrl ? String(node.executionIssueUrl) : "",
          ...toList(node.executionSourceRefs).map(v => String(v || "")),
        ].filter(Boolean),
        dependsOn: uniqList((depsByTask[String(node.executionTaskId)] || []).map(String)),
      };
    });
  }

  function applyParsed(raw, replace = false) {
    const parsed = parseAiJson(raw);
    const baseNodes = normalizeAiNodes(parsed.nodes);
    if (!baseNodes.length) throw new Error("AI nu a returnat noduri valide");

    const idMap = {};
    const groupMap = {};
    const tableMap = {};
    const normalizedNodes = baseNodes.map(node => {
      const id = uid();
      idMap[String(node.id)] = id;
      const groupId = node.groupId ? (groupMap[node.groupId] || (groupMap[node.groupId] = uid())) : node.groupId;
      const tableId = node.tableId ? (tableMap[node.tableId] || (tableMap[node.tableId] = uid())) : node.tableId;
      return { ...node, id, groupId, tableId };
    });

    const textMap = Object.fromEntries(
      normalizedNodes
        .filter(node => node.text?.trim())
        .map(node => [node.text.trim().toLowerCase(), node.id]),
    );
    const normalizedArrows = normalizeAiArrows(parsed.arrows || [], idMap, textMap);
    d({ type: "APPLY", nodes: normalizedNodes, arrows: normalizedArrows, replace });
    return { nodes: normalizedNodes, message: parsed.message, summary: parsed.summary };
  }

  async function send(text = prompt) {
    if (!text.trim() || loading) return;
    setLoading(true);
    setMsgs(prev => [...prev, { role: "user", text }]);
    setPrompt("");
    try {
      const raw = await aiCall(text, WB_SYS);
      const result = applyParsed(raw);
      setMsgs(prev => [...prev, { role: "ai", text: result.message || `${result.nodes.length} elemente ✓` }]);
    } catch (error) {
      setMsgs(prev => [...prev, { role: "ai", text: `⚠ ${error.message}` }]);
    }
    setLoading(false);
  }

  async function runFileGeneration(templateId) {
    if (!fileDraft || fl) return;
    setFl(true);
    setFe(null);
    setFs(null);
    const chosen = FILE_TEMPLATE_KEYS.includes(templateId) ? templateId : (filePlan?.recommended || "custom");
    try {
      const raw = await aiCall(buildFileGenerationPrompt(fileDraft, filePlan, chosen), SW_SYS);
      const result = applyParsed(raw, fileDraft.replace);
      setFs(result.summary || `${result.nodes.length} noduri`);
      setFilePlan(prev => (prev ? { ...prev, selected: chosen } : prev));
    } catch (error) {
      setFe(error.message);
    }
    setFl(false);
  }

  async function handleFile(content, name, replace) {
    if (!content) {
      setFe("Nu s-a putut citi.");
      return;
    }
    setFn(name);
    setFl(true);
    setFe(null);
    setFs(null);
    setFilePlan(null);
    const truncated = content.length > 6000 ? `${content.slice(0, 6000)}\n[trunchiat]` : content;
    setFileDraft({ content: truncated, name, replace });
    const plannerPrompt = [`Fisier: "${name}"`, "", truncated].join("\n");
    try {
      const planRaw = await aiCall(plannerPrompt, SW_PLAN_SYS);
      const plan = normalizeTemplatePlan(planRaw);
      setFilePlan(plan);
    } catch (error) {
      setFe(error.message);
    }
    setFl(false);
  }

  async function runExecutionPlan() {
    const rawInput = String(execInput || "").trim();
    if (!rawInput || execLoading) return;

    setExecLoading(true);
    setExecError(null);
    setExecSummary(null);
    try {
      const prompt = [
        "Context source (PRD/repo/issues):",
        rawInput,
        "",
        "Generate an execution board with milestones, dependencies, owners (or TBD), risks, and clear next actions.",
      ].join("\n");
      const raw = await aiCall(prompt, EXEC_SYS);
      const result = applyExecutionPlan(raw, execReplace);
      setExecSummary(result.summary || result.message || `${result.nodes.length} execution nodes`);
      setMsgs(prev => [...prev, { role: "ai", text: result.message || "Execution plan generated." }]);
    } catch (error) {
      setExecError(error.message || "Execution plan generation failed.");
    }
    setExecLoading(false);
  }

  async function refreshGitHubAuthStatus({ quiet = false } = {}) {
    if (!githubApi?.oauthStatus) return null;
    setGhAuthLoading(true);
    try {
      const data = await githubApi.oauthStatus();
      const connected = Boolean(data?.connected);
      const available = Boolean(data?.available);
      setGhConnected(connected);
      setGhAvailable(available);
      setGhSource(data?.source || null);
      setGhAccount(data?.account || null);
      return data;
    } catch (error) {
      setGhConnected(false);
      setGhAvailable(false);
      setGhSource(null);
      setGhAccount(null);
      if (!quiet) {
        const msg = error?.message || "Unable to load GitHub OAuth status.";
        setGhError(msg);
      }
      return null;
    } finally {
      setGhAuthLoading(false);
    }
  }

  async function runGitHubConnect() {
    if (ghAuthLoading || !githubApi?.oauthStart) return;
    setGhAuthLoading(true);
    setGhError(null);
    setGhSummary(null);
    try {
      const returnTo = `${window.location.pathname}${window.location.search || ""}`;
      const start = await githubApi.oauthStart({ returnTo });
      const url = String(start?.url || "").trim();
      if (!url) throw new Error("GitHub OAuth start failed (missing authorize URL).");
      const allowedOrigins = new Set(
        [window.location.origin, String(start?.callback_origin || "").trim()]
          .filter(Boolean),
      );

      const popup = window.open(url, "boardai_github_oauth", "width=640,height=780,menubar=no,toolbar=no,status=no");
      if (!popup) throw new Error("OAuth popup blocked by browser. Allow popups and retry.");

      await new Promise((resolve, reject) => {
        let done = false;
        const timeoutId = setTimeout(() => {
          if (done) return;
          done = true;
          cleanup();
          reject(new Error("GitHub OAuth timed out."));
        }, 120000);
        const closeWatch = setInterval(() => {
          if (done) return;
          if (!popup || popup.closed) {
            done = true;
            cleanup();
            reject(new Error("OAuth popup was closed before completion."));
          }
        }, 300);
        const cleanup = () => {
          window.removeEventListener("message", onMessage);
          clearTimeout(timeoutId);
          clearInterval(closeWatch);
          try { popup.close(); } catch {}
        };
        const onMessage = evt => {
          const data = evt?.data;
          if (!data || data.type !== "boardai:github-oauth") return;
          if (allowedOrigins.size && !allowedOrigins.has(evt.origin)) return;
          if (done) return;
          done = true;
          cleanup();
          if (data.ok) resolve(data);
          else reject(new Error(data.error || "GitHub OAuth failed."));
        };
        window.addEventListener("message", onMessage);
      });

      const status = await refreshGitHubAuthStatus({ quiet: true });
      const login = status?.account?.login ? `@${status.account.login}` : "GitHub";
      const msg = `GitHub connected (${login}).`;
      setGhSummary(msg);
      if (typeof notify === "function") notify(msg, "success");
    } catch (error) {
      const msg = error.message || "GitHub OAuth connect failed.";
      setGhError(msg);
      if (typeof notify === "function") notify(msg, "error");
    }
    setGhAuthLoading(false);
  }

  async function runGitHubDisconnect() {
    if (ghAuthLoading || !githubApi?.oauthDisconnect) return;
    setGhAuthLoading(true);
    setGhError(null);
    setGhSummary(null);
    try {
      await githubApi.oauthDisconnect();
      await refreshGitHubAuthStatus({ quiet: true });
      const msg = "GitHub disconnected for this account.";
      setGhSummary(msg);
      if (typeof notify === "function") notify(msg, "info");
    } catch (error) {
      const msg = error.message || "GitHub disconnect failed.";
      setGhError(msg);
      if (typeof notify === "function") notify(msg, "error");
    }
    setGhAuthLoading(false);
  }

  async function runGitHubImport() {
    const repo = String(ghRepo || "").trim();
    if (!repo || ghLoading || !githubApi?.import) return;

    setGhLoading(true);
    setGhError(null);
    setGhSummary(null);
    try {
      const payload = {
        repo,
        state: ["open", "closed", "all"].includes(String(ghState || "").toLowerCase()) ? String(ghState).toLowerCase() : "open",
        incremental: Boolean(ghIncremental),
        perPage: 80,
        idempotencyKey: makeIdempotencyKey("gh-import"),
      };
      const data = await githubApi.import(payload);
      if (!data?.plan) throw new Error("GitHub import returned empty plan");
      const result = applyExecutionPlan(data.plan, execReplace);
      const msg = data?.count
        ? `Imported ${data.fetched_count ?? data.count} issue updates (${data.count} mapped) from ${data.repo}${data.incremental ? " [incremental]" : ""}.`
        : (result.summary || "GitHub import completed.");
      setGhSummary(msg);
      setExecSummary(result.summary || msg);
      if (typeof notify === "function") notify(msg, "success");
    } catch (error) {
      const msg = error.message || "GitHub import failed";
      setGhError(msg);
      if (typeof notify === "function") notify(msg, "error");
    }
    setGhLoading(false);
  }

  async function runGitHubPush() {
    const repo = String(ghRepo || "").trim();
    if (!repo || ghLoading || !githubApi?.push) return;

    setGhLoading(true);
    setGhError(null);
    setGhSummary(null);
    try {
      const tasks = extractExecutionTasksForSync();
      if (!tasks.length) throw new Error("No execution tasks found on board (generate/import first).");

      const payload = {
        repo,
        conflictStrategy: String(ghConflictStrategy || "skip_remote_newer"),
        tasks,
        idempotencyKey: makeIdempotencyKey("gh-push"),
      };
      const data = await githubApi.push(payload);
      const linked = Array.isArray(data?.linked) ? data.linked : [];
      if (linked.length) {
        const syncedAt = new Date().toISOString();
        const deltas = {};
        linked.forEach(row => {
          if (!row?.nodeId) return;
          deltas[row.nodeId] = {
            executionIssueNumber: row.issueNumber || null,
            executionIssueUrl: row.issueUrl || null,
            executionIssueState: row.issueState || null,
            executionIssueUpdatedAt: row.issueUpdatedAt || "",
            executionLastSyncedAt: syncedAt,
            executionRepo: repo.toLowerCase(),
          };
        });
        if (Object.keys(deltas).length) d({ type: "UPD_MULTI", deltas });
      }

      const warningCount = Array.isArray(data?.warnings) ? data.warnings.length : 0;
      const msg = `GitHub push done: created ${data?.created || 0}, updated ${data?.updated || 0}, skipped ${data?.skipped || 0}, conflicts ${data?.conflicts || 0}${warningCount ? `, warnings ${warningCount}` : ""}.`;
      setGhSummary(msg);
      if (typeof notify === "function") notify(msg, warningCount ? "info" : "success");
      if (warningCount) setGhError(String(data.warnings[0] || ""));
    } catch (error) {
      const msg = error.message || "GitHub push failed";
      setGhError(msg);
      if (typeof notify === "function") notify(msg, "error");
    }
    setGhLoading(false);
  }

  async function runJiraImport() {
    const site = String(jiraSite || "").trim();
    if (!site || jiraLoading || !jiraApi?.import) return;

    setJiraLoading(true);
    setJiraError(null);
    setJiraSummary(null);
    try {
      const payload = {
        site,
        projectKey: String(jiraProject || "").trim() || undefined,
        jiraEmail: String(jiraEmail || "").trim() || undefined,
        jiraToken: String(jiraToken || "").trim() || undefined,
        state: ["open", "closed", "all"].includes(String(jiraState || "").toLowerCase()) ? String(jiraState).toLowerCase() : "open",
        maxResults: 80,
      };
      const data = await jiraApi.import(payload);
      if (!data?.plan) throw new Error("Jira import returned empty plan");
      const result = applyExecutionPlan(data.plan, execReplace);
      const source = data?.projectKey || data?.site || site;
      const msg = data?.count
        ? `Imported ${data.fetched_count ?? data.count} Jira issues (${data.count} mapped) from ${source}.`
        : (result.summary || "Jira import completed.");
      setJiraSummary(msg);
      setExecSummary(result.summary || msg);
      if (typeof notify === "function") notify(msg, "success");
    } catch (error) {
      const msg = error.message || "Jira import failed";
      setJiraError(msg);
      if (typeof notify === "function") notify(msg, "error");
    }
    setJiraLoading(false);
  }

  function clearAll() {
    d({ type: "CLEAR" });
    setMsgs([]);
    setFs(null);
    setFn(null);
    setFe(null);
    setFileDraft(null);
    setFilePlan(null);
    setExecInput("");
    setExecError(null);
    setExecSummary(null);
    setGhError(null);
    setGhSummary(null);
    setJiraError(null);
    setJiraSummary(null);
  }

  const voteResults = Object.entries(s.votes)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, v]) => ({ node: s.nodes.find(n => n.id === id), v }))
    .filter(entry => entry.node);

  return {
    prompt,
    setPrompt,
    loading,
    fl,
    fn,
    fs,
    fe,
    fileDraft,
    filePlan,
    msgs,
    open,
    setOpen,
    execInput,
    setExecInput,
    execLoading,
    execError,
    execSummary,
    execReplace,
    setExecReplace,
    ghRepo,
    setGhRepo,
    ghState,
    setGhState,
    ghIncremental,
    setGhIncremental,
    ghConflictStrategy,
    setGhConflictStrategy,
    ghAuthLoading,
    ghConnected,
    ghAvailable,
    ghSource,
    ghAccount,
    ghLoading,
    ghError,
    ghSummary,
    jiraSite,
    setJiraSite,
    jiraProject,
    setJiraProject,
    jiraEmail,
    setJiraEmail,
    jiraToken,
    setJiraToken,
    jiraState,
    setJiraState,
    jiraLoading,
    jiraError,
    jiraSummary,
    endRef,
    voteResults,
    send,
    runFileGeneration,
    runExecutionPlan,
    runGitHubConnect,
    runGitHubDisconnect,
    runGitHubImport,
    runGitHubPush,
    runJiraImport,
    handleFile,
    clearAll,
  };
}
