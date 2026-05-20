function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function parseDueTs(raw) {
  if (!raw) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 10_000_000_000) return Math.floor(raw / 1000);
    return Math.floor(raw);
  }
  const ts = Date.parse(String(raw));
  if (!Number.isFinite(ts)) return null;
  return Math.floor(ts / 1000);
}

function normalizeStatus(raw) {
  return String(raw || '').trim().toLowerCase();
}

function isDoneStatus(status) {
  const s = normalizeStatus(status);
  return s === 'done' || s === 'closed' || s === 'completed' || s === 'resolved';
}

function detectTaskDependencyCycle(tasks, relations) {
  const taskKeys = new Set(tasks.map(t => t.key));
  const adj = new Map();
  for (const task of tasks) adj.set(task.key, []);
  for (const rel of relations) {
    if (rel.type !== 'depends_on') continue;
    if (!taskKeys.has(rel.fromEntityKey) || !taskKeys.has(rel.toEntityKey)) continue;
    adj.get(rel.fromEntityKey).push(rel.toEntityKey);
  }

  const color = new Map(); // 0 unvisited, 1 visiting, 2 done
  const parent = new Map();
  for (const task of tasks) color.set(task.key, 0);

  for (const task of tasks) {
    if (color.get(task.key) !== 0) continue;
    const stack = [{ key: task.key, idx: 0 }];
    color.set(task.key, 1);

    while (stack.length) {
      const top = stack[stack.length - 1];
      const list = adj.get(top.key) || [];
      if (top.idx >= list.length) {
        color.set(top.key, 2);
        stack.pop();
        continue;
      }
      const next = list[top.idx++];
      const nextColor = color.get(next) || 0;
      if (nextColor === 0) {
        color.set(next, 1);
        parent.set(next, top.key);
        stack.push({ key: next, idx: 0 });
        continue;
      }
      if (nextColor === 1) {
        // back edge
        const cycle = [next];
        let cur = top.key;
        while (cur && cur !== next) {
          cycle.push(cur);
          cur = parent.get(cur);
        }
        cycle.push(next);
        cycle.reverse();
        return { hasCycle: true, cycle };
      }
    }
  }
  return { hasCycle: false, cycle: [] };
}

function computeHealth(entities = [], relations = [], opts = {}) {
  const currentTs = Number(opts.nowSec) || nowSec();
  const byKey = new Map();
  for (const entity of entities) {
    if (!entity || !entity.key) continue;
    byKey.set(entity.key, entity);
  }

  const tasks = entities.filter(e => e.type === 'task');
  const milestones = entities.filter(e => e.type === 'milestone');

  const incoming = new Map();
  const outgoing = new Map();
  for (const rel of relations) {
    if (!rel || !rel.fromEntityKey || !rel.toEntityKey) continue;
    if (!outgoing.has(rel.fromEntityKey)) outgoing.set(rel.fromEntityKey, []);
    if (!incoming.has(rel.toEntityKey)) incoming.set(rel.toEntityKey, []);
    outgoing.get(rel.fromEntityKey).push(rel);
    incoming.get(rel.toEntityKey).push(rel);
  }

  const issues = [];
  const pushIssue = issue => {
    issues.push({
      id: `${issue.type}:${issue.entityKey || issue.sourceNodeId || issues.length}`,
      severity: issue.severity || 'medium',
      ...issue,
    });
  };

  for (const task of tasks) {
    const inRels = incoming.get(task.key) || [];
    const hasMilestoneParent = inRels.some(rel => {
      const parent = byKey.get(rel.fromEntityKey);
      return parent && parent.type === 'milestone';
    });
    const hasParentField = Boolean(task.metadata && task.metadata.parentId);
    if (!hasMilestoneParent && !hasParentField) {
      pushIssue({
        type: 'orphan_task',
        severity: 'high',
        message: `Task "${task.title}" has no milestone/parent`,
        entityType: 'task',
        entityKey: task.key,
        sourceNodeId: task.sourceNodeId || null,
      });
    }
    if (!String(task.owner || '').trim()) {
      pushIssue({
        type: 'missing_owner',
        severity: 'high',
        message: `Task "${task.title}" has no owner`,
        entityType: 'task',
        entityKey: task.key,
        sourceNodeId: task.sourceNodeId || null,
      });
    }
    if (!String(task.dueDate || '').trim()) {
      pushIssue({
        type: 'missing_due_date',
        severity: 'medium',
        message: `Task "${task.title}" has no due date`,
        entityType: 'task',
        entityKey: task.key,
        sourceNodeId: task.sourceNodeId || null,
      });
    } else {
      const dueTs = parseDueTs(task.dueDate);
      if (dueTs && dueTs < currentTs && !isDoneStatus(task.status)) {
        pushIssue({
          type: 'overdue',
          severity: 'critical',
          message: `Task "${task.title}" is overdue`,
          entityType: 'task',
          entityKey: task.key,
          sourceNodeId: task.sourceNodeId || null,
        });
      }
    }
  }

  for (const milestone of milestones) {
    const outRels = outgoing.get(milestone.key) || [];
    const hasTasks = outRels.some(rel => {
      const child = byKey.get(rel.toEntityKey);
      return child && child.type === 'task';
    }) || Number(milestone.metadata?.childrenTaskCount || 0) > 0;
    if (!hasTasks) {
      pushIssue({
        type: 'empty_milestone',
        severity: 'high',
        message: `Milestone "${milestone.title}" has no tasks`,
        entityType: 'milestone',
        entityKey: milestone.key,
        sourceNodeId: milestone.sourceNodeId || null,
      });
    }
  }

  const cycleInfo = detectTaskDependencyCycle(tasks, relations);
  if (cycleInfo.hasCycle) {
    const cycleEntities = cycleInfo.cycle.map(k => byKey.get(k)).filter(Boolean);
    pushIssue({
      type: 'circular_dependency',
      severity: 'critical',
      message: 'Circular dependency detected on depends_on graph',
      entityType: 'task',
      entityKey: cycleInfo.cycle[0] || null,
      sourceNodeId: cycleEntities[0]?.sourceNodeId || null,
      details: { cycle: cycleInfo.cycle },
    });
  }

  const counts = issues.reduce((acc, issue) => {
    acc[issue.type] = (acc[issue.type] || 0) + 1;
    return acc;
  }, {});

  const cappedPenalty = (issueType, perIssue, maxPenalty) => {
    const c = Number(counts[issueType] || 0);
    return Math.min(c * perIssue, maxPenalty);
  };

  let score = 100;
  score -= cappedPenalty('orphan_task', 10, 30);
  score -= cappedPenalty('missing_owner', 10, 30);
  score -= cappedPenalty('missing_due_date', 5, 20);
  score -= cappedPenalty('overdue', 15, 45);
  score -= cappedPenalty('empty_milestone', 15, 30);
  if (counts.circular_dependency > 0) score -= 25;
  score = Math.max(0, Math.min(100, score));

  return {
    healthScore: score,
    issues,
    stats: {
      counts,
      entityCount: entities.length,
      relationCount: relations.length,
      taskCount: tasks.length,
      milestoneCount: milestones.length,
      computedAt: currentTs,
    },
  };
}

module.exports = {
  computeHealth,
};
