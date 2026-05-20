const path = require('path');
const Database = require('better-sqlite3');

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function applySchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_projects (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      stack TEXT NOT NULL DEFAULT '',
      repo_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vault_records (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      project_id TEXT REFERENCES vault_projects(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      secret_cipher TEXT NOT NULL DEFAULT '',
      secret_hint TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      cost_amount REAL,
      cost_currency TEXT NOT NULL DEFAULT '',
      renews_at INTEGER,
      expires_at INTEGER,
      created_by TEXT,
      updated_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_revealed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS vault_record_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id TEXT NOT NULL REFERENCES vault_records(id) ON DELETE CASCADE,
      version_no INTEGER NOT NULL,
      action TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      UNIQUE(record_id, version_no)
    );

    CREATE TABLE IF NOT EXISTS vault_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_id TEXT,
      action TEXT NOT NULL,
      project_id TEXT,
      record_id TEXT,
      details_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_vault_projects_status ON vault_projects(status);
    CREATE INDEX IF NOT EXISTS idx_vault_projects_updated_at ON vault_projects(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vault_records_scope ON vault_records(scope);
    CREATE INDEX IF NOT EXISTS idx_vault_records_project_id ON vault_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_vault_records_category ON vault_records(category);
    CREATE INDEX IF NOT EXISTS idx_vault_records_updated_at ON vault_records(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_vault_records_renews_at ON vault_records(renews_at);
    CREATE INDEX IF NOT EXISTS idx_vault_records_expires_at ON vault_records(expires_at);
    CREATE INDEX IF NOT EXISTS idx_vault_record_versions_record ON vault_record_versions(record_id, version_no DESC);
    CREATE INDEX IF NOT EXISTS idx_vault_activity_created_at ON vault_activity(created_at DESC);
  `);
}

function createVaultDb({ dataDir }) {
  const dbPath = path.join(dataDir, 'vault.sqlite');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  applySchema(db);
  return db;
}

module.exports = {
  createVaultDb,
  nowSec,
};
