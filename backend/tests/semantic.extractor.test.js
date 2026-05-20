const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSemantic } = require('../server/modules/semantic/extractor');
const { computeHealth } = require('../server/modules/semantic/health');

test('extractSemantic classifies entities and relations deterministically', () => {
  const board = {
    nodes: [
      { id: 'm1', type: 'shape', text: 'Milestone Alpha', dueDate: '2026-03-20' },
      { id: 't1', type: 'task', text: 'Task Build API', owner: 'Ana', dueDate: '2026-03-01', status: 'in_progress', sourceLink: 'https://github.com/org/repo/issues/1' },
      { id: 't2', type: 'sticky', text: 'Task QA pass' },
      { id: 'r1', type: 'sticky', text: 'Risk: release delay' },
      { id: 'd1', type: 'text', text: 'DEC: keep board as source of truth' },
      { id: 'g1', type: 'text', text: 'Goal: increase activation by 20%' },
    ],
    arrows: [
      { id: 'a1', fromId: 'm1', toId: 't1', label: '' },
      { id: 'a2', fromId: 't2', toId: 't1', label: 'blocks' },
    ],
  };

  const out = extractSemantic(board);
  const byNode = new Map(out.entities.map(e => [e.sourceNodeId, e]));

  assert.equal(byNode.get('m1')?.type, 'milestone');
  assert.equal(byNode.get('t1')?.type, 'task');
  assert.equal(byNode.get('t2')?.type, 'task');
  assert.equal(byNode.get('r1')?.type, 'risk');
  assert.equal(byNode.get('d1')?.type, 'decision');
  assert.equal(byNode.get('g1')?.type, 'goal');

  const hasBlocks = out.relations.some(r => r.type === 'blocks' && r.fromEntityKey === 'task:t2' && r.toEntityKey === 'task:t1');
  const hasDepends = out.relations.some(r => r.type === 'depends_on' && r.fromEntityKey === 'milestone:m1' && r.toEntityKey === 'task:t1');
  const hasDerived = out.relations.some(r => r.type === 'derived_from' && r.fromEntityKey === 'task:t1');
  assert.equal(hasBlocks, true);
  assert.equal(hasDepends, true);
  assert.equal(hasDerived, true);
});

test('computeHealth applies score penalties and detects dependency cycles', () => {
  const entities = [
    { key: 'milestone:m1', type: 'milestone', sourceNodeId: 'm1', title: 'Milestone Alpha', metadata: {} },
    { key: 'task:t1', type: 'task', sourceNodeId: 't1', title: 'Build API', owner: 'Ana', dueDate: '2020-01-01', status: 'todo', metadata: {} },
    { key: 'task:t2', type: 'task', sourceNodeId: 't2', title: 'QA pass', owner: '', dueDate: '', status: 'todo', metadata: {} },
  ];
  const relations = [
    { type: 'depends_on', fromEntityKey: 'milestone:m1', toEntityKey: 'task:t1', sourceEdgeId: 'a1' },
    { type: 'depends_on', fromEntityKey: 'task:t1', toEntityKey: 'task:t2', sourceEdgeId: 'a2' },
    { type: 'depends_on', fromEntityKey: 'task:t2', toEntityKey: 'task:t1', sourceEdgeId: 'a3' },
  ];

  const health = computeHealth(entities, relations, { nowSec: 1_700_000_000 });
  const counts = health.stats.counts;

  assert.equal(counts.orphan_task, 1);
  assert.equal(counts.missing_owner, 1);
  assert.equal(counts.missing_due_date, 1);
  assert.equal(counts.overdue, 1);
  assert.equal(counts.circular_dependency, 1);
  assert.equal(health.healthScore, 35);
});
