const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createVaultService } = require('../server/modules/vault');

test('vault ingest parses free text and auto-creates project', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardai-vault-ingest-'));
  const service = createVaultService({
    dataDir: tempDir,
    secretKey: 'vault-ingest-secret-key',
  });

  try {
    const text = `
OPENAI_API_KEY=sk-test-1234567890abcdef
DB_USER=admin_user
DB_PASSWORD=SuperPass_12345
BASE_URL=https://api.private-driver.ro
`;
    const result = service.ingestFromText({
      text,
      projectName: 'private-driver',
      autoCreateProject: true,
      source: 'test-suite',
      workspacePath: 'C:\\Server\\Private-Driver.ro',
    }, 'u_test');

    assert.ok(result.project);
    assert.equal(result.project.slug, 'private-driver');
    assert.ok(Array.isArray(result.created));
    assert.ok(result.created.length >= 1);

    const records = service.listRecords({ projectId: result.project.id });
    assert.ok(records.length >= 1);
    assert.ok(records.some(item => String(item.title || '').toLowerCase().includes('openai')));
  } finally {
    service.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
