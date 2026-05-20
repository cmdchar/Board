const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createVaultService } = require('../server/modules/vault');

test('vault service stores encrypted records and reveals secret on demand', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardai-vault-test-'));
  const service = createVaultService({
    dataDir: tempDir,
    secretKey: 'vault-test-secret-key',
  });

  try {
    const project = service.createProject({
      name: 'Private Driver',
      stack: 'Node + Postgres',
      repoUrl: 'https://example.com/private-driver.git',
    }, 'u_test');

    assert.ok(project.id);
    assert.equal(project.name, 'Private Driver');

    const record = service.createRecord({
      scope: 'project',
      projectId: project.id,
      category: 'api',
      title: 'OpenAI API',
      username: 'service-account',
      secret: 'super-secret-token',
      tags: 'prod,ai',
      notes: 'Used by board automations',
    }, 'u_test');

    assert.ok(record.id);
    assert.equal(record.hasSecret, true);
    assert.equal(record.projectId, project.id);
    assert.equal(record.category, 'api');

    const listed = service.listRecords({ projectId: project.id });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].title, 'OpenAI API');
    assert.equal(listed[0].hasSecret, true);

    const revealed = service.revealRecordSecret(record.id, 'u_test');
    assert.equal(revealed.secret, 'super-secret-token');

    const detail = service.getRecord(record.id, { includeVersions: true });
    assert.equal(detail.record.id, record.id);
    assert.ok(Array.isArray(detail.versions));
    assert.ok(detail.versions.length >= 1);

    service.updateRecord(record.id, {
      title: 'OpenAI API v2',
      notes: 'Rotated token',
      secret: 'rotated-token',
    }, 'u_test');

    const refreshed = service.getRecord(record.id, { includeVersions: true });
    assert.equal(refreshed.record.title, 'OpenAI API v2');
    assert.ok(refreshed.versions.length >= 2);

    const summary = service.getSummary();
    assert.equal(summary.totals.projects, 1);
    assert.equal(summary.totals.records, 1);
    assert.equal(summary.byCategory.api, 1);
  } finally {
    service.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
