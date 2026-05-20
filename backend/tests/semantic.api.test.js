const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

test('GET /api/boards/:id/semantic returns entities, relations and health snapshot', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardai-semantic-'));
  writeJson(path.join(tmpDir, 'boards.json'), {
    b1: {
      id: 'b1',
      name: 'Semantic Test Board',
      data: {
        nodes: [
          { id: 'm1', text: 'Milestone 1', dueDate: '2026-04-01' },
          { id: 't1', type: 'task', text: 'Task API', status: 'todo' },
        ],
        arrows: [{ id: 'a1', fromId: 'm1', toId: 't1', label: '' }],
        comments: [],
        votes: {},
      },
      created_at: 1700000000,
      updated_at: 1700000000,
    },
  });
  writeJson(path.join(tmpDir, 'users.json'), {});
  writeJson(path.join(tmpDir, 'audit.json'), { events: [] });

  process.env.BOARDAI_DATA_DIR = tmpDir;
  process.env.PORT = '0';
  process.env.JWT_SECRET = 'test-jwt-secret-semantic-api';
  const modPath = path.join(__dirname, '..', 'server.js');
  delete require.cache[require.resolve(modPath)];
  const backend = require(modPath);

  await new Promise(resolve => backend.server.listen(0, '127.0.0.1', resolve));
  const { port } = backend.server.address();

  try {
    const rsp = await fetch(`http://127.0.0.1:${port}/api/boards/b1/semantic?entityLimit=50&relationLimit=50&issueLimit=10`);
    assert.equal(rsp.status, 200);
    const body = await rsp.json();
    assert.equal(body.boardId, 'b1');
    assert.ok(Array.isArray(body.entities));
    assert.ok(Array.isArray(body.relations));
    assert.ok(body.health && typeof body.health.healthScore === 'number');
    assert.ok(body.pagination && body.pagination.entities && body.pagination.relations);
  } finally {
    await new Promise(resolve => backend.server.close(resolve));
    backend.semantic.shutdown();
  }
});
