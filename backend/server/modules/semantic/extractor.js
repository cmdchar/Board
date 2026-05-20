function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function firstText(...values) {
  for (const raw of values) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (v) return v;
  }
  return '';
}

function firstObject(...values) {
  for (const raw of values) {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  }
  return null;
}

function textBlob(node) {
  return [
    node.text,
    node.title,
    node.label,
    node.name,
    node.description,
    node.executionTitle,
    node.executionDescription,
  ]
    .filter(v => typeof v === 'string' && v.trim())
    .join(' ')
    .toLowerCase();
}

function getTags(node) {
  const fromTags = toArray(node.tags).map(v => String(v || '').toLowerCase().trim()).filter(Boolean);
  const fromTag = String(node.tag || '').toLowerCase().trim();
  return fromTag ? [...fromTags, fromTag] : fromTags;
}

function parseDependsOn(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(v => {
        if (typeof v === 'string') return v.trim();
        if (v && typeof v === 'object') {
          return String(v.nodeId || v.id || v.key || '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,\s;]+/)
      .map(v => v.trim())
      .filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw).map(v => String(v || '').trim()).filter(Boolean);
  }
  return [];
}

function entityKey(type, sourceNodeId) {
  return `${type}:${sourceNodeId}`;
}

function classifyNode(node, ctx) {
  const label = textBlob(node);
  const tags = getTags(node);
  const rawType = String(node.type || '').toLowerCase();
  const owner = firstText(node.owner, node.assignee, node.executionOwner, node.executionAssignee);
  const dueDate = firstText(node.dueDate, node.executionDueDate, node.due, node.deadline);
  const status = firstText(node.status, node.executionStatus, node.state);
  const sourceLink = firstText(node.sourceLink, node.executionIssueUrl, node.issueUrl, node.prUrl, node.url);
  const dependsOn = parseDependsOn(node.dependsOn || node.dependencies || node.executionDependsOn);
  const icon = firstText(node.icon, node.emoji, node.symbol).toLowerCase();
  const childrenIds = ctx.outgoing.get(node.id) || [];
  const childrenCount = childrenIds.length;
  const childrenTaskCount = childrenIds.reduce((acc, childId) => acc + (ctx.taskCandidates.has(childId) ? 1 : 0), 0);
  const hasTaskFields = Boolean(owner || dueDate || status);
  const taskCandidate =
    rawType === 'task' ||
    label.includes('task') ||
    hasTaskFields;
  const isDecision =
    label.startsWith('dec:') ||
    label.includes('decision');
  const isRisk =
    label.includes('risk') ||
    tags.includes('risk') ||
    icon.includes('risk');
  const isMilestone =
    (childrenCount >= 1 && label.includes('milestone')) ||
    (Boolean(dueDate) && childrenTaskCount >= 1);
  const isGoal =
    label.includes('goal') ||
    label.includes('objective') ||
    label.includes('okr') ||
    label.includes('kpi');

  let type = 'note';
  if (isDecision) type = 'decision';
  else if (isRisk) type = 'risk';
  else if (isMilestone) type = 'milestone';
  else if (taskCandidate) type = 'task';
  else if (isGoal) type = 'goal';

  return {
    type,
    owner,
    dueDate,
    status,
    sourceLink,
    dependsOn,
    taskCandidate,
    metadata: {
      rawType,
      tags,
      icon,
      childrenCount,
      childrenTaskCount,
      parentId: firstText(node.parentId, node.parent_id),
    },
  };
}

function extractSemantic(boardJson = {}) {
  const nodes = Array.isArray(boardJson?.nodes) ? boardJson.nodes : [];
  const arrows = Array.isArray(boardJson?.arrows) ? boardJson.arrows : [];
  const nodeMap = new Map();
  const outgoing = new Map();
  const incoming = new Map();
  const taskCandidates = new Set();

  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const id = String(node.id || '').trim();
    if (!id) continue;
    nodeMap.set(id, node);
    const label = textBlob(node);
    const rawType = String(node.type || '').toLowerCase();
    const hasTaskFields = Boolean(firstText(node.owner, node.assignee, node.executionOwner, node.executionAssignee, node.dueDate, node.executionDueDate, node.status, node.executionStatus));
    if (rawType === 'task' || label.includes('task') || hasTaskFields) {
      taskCandidates.add(id);
    }
  }

  for (const edge of arrows) {
    if (!edge || typeof edge !== 'object') continue;
    const fromId = String(edge.fromId || '').trim();
    const toId = String(edge.toId || '').trim();
    if (!fromId || !toId) continue;
    if (!outgoing.has(fromId)) outgoing.set(fromId, []);
    if (!incoming.has(toId)) incoming.set(toId, []);
    outgoing.get(fromId).push(toId);
    incoming.get(toId).push(fromId);
  }

  const ctx = { outgoing, incoming, taskCandidates };
  const entities = [];
  const entityBySource = new Map();
  for (const [nodeId, node] of nodeMap) {
    const cls = classifyNode(node, ctx);
    const title = firstText(node.text, node.title, node.label, node.name) || `${cls.type}:${nodeId}`;
    const entry = {
      key: entityKey(cls.type, nodeId),
      type: cls.type,
      sourceNodeId: nodeId,
      title,
      status: cls.status || null,
      owner: cls.owner || null,
      dueDate: cls.dueDate || null,
      metadata: {
        ...cls.metadata,
        sourceLink: cls.sourceLink || null,
        dependsOn: cls.dependsOn,
      },
    };
    entities.push(entry);
    entityBySource.set(nodeId, entry);
  }

  const relationSeen = new Set();
  const relations = [];
  const addRelation = relation => {
    const sourceEdgeId = String(relation.sourceEdgeId || '').trim();
    const key = [
      relation.type,
      relation.fromEntityKey,
      relation.toEntityKey,
      sourceEdgeId,
    ].join('|');
    if (relationSeen.has(key)) return;
    relationSeen.add(key);
    relations.push({
      type: relation.type,
      fromEntityKey: relation.fromEntityKey,
      toEntityKey: relation.toEntityKey,
      sourceEdgeId,
      metadata: relation.metadata || {},
    });
  };

  for (const edge of arrows) {
    if (!edge || typeof edge !== 'object') continue;
    const fromId = String(edge.fromId || '').trim();
    const toId = String(edge.toId || '').trim();
    if (!fromId || !toId) continue;
    const fromEntity = entityBySource.get(fromId);
    const toEntity = entityBySource.get(toId);
    if (!fromEntity || !toEntity) continue;
    const label = firstText(edge.label, edge.text).toLowerCase();
    addRelation({
      type: label.includes('blocks') ? 'blocks' : 'depends_on',
      fromEntityKey: fromEntity.key,
      toEntityKey: toEntity.key,
      sourceEdgeId: firstText(edge.id),
      metadata: { label: firstText(edge.label, edge.text) || null },
    });
  }

  for (const entity of entities) {
    if (entity.type !== 'task') continue;
    const deps = parseDependsOn(entity.metadata?.dependsOn);
    for (const dep of deps) {
      const depEntity = entityBySource.get(dep);
      if (!depEntity) continue;
      addRelation({
        type: 'depends_on',
        fromEntityKey: entity.key,
        toEntityKey: depEntity.key,
        sourceEdgeId: `field:dependsOn:${dep}`,
      });
    }
    const sourceLink = firstText(entity.metadata?.sourceLink);
    if (sourceLink) {
      addRelation({
        type: 'derived_from',
        fromEntityKey: entity.key,
        toEntityKey: `external:${sourceLink}`,
        sourceEdgeId: 'field:sourceLink',
        metadata: { sourceLink },
      });
    }
  }

  entities.sort((a, b) => a.key.localeCompare(b.key));
  relations.sort((a, b) => {
    const ka = `${a.type}|${a.fromEntityKey}|${a.toEntityKey}|${a.sourceEdgeId}`;
    const kb = `${b.type}|${b.fromEntityKey}|${b.toEntityKey}|${b.sourceEdgeId}`;
    return ka.localeCompare(kb);
  });

  return {
    entities,
    relations,
  };
}

module.exports = {
  extractSemantic,
  entityKey,
};
