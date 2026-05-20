const fs = require('fs');
const path = require('path');
const BetterSqlite3 = require('better-sqlite3');

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function ensureMigrations(db, migrationsDir, logger) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS semantic_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare('SELECT id FROM semantic_migrations').all().map(r => String(r.id))
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter(name => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO semantic_migrations (id, applied_at) VALUES (?, ?)').run(file, nowSec());
      db.exec('COMMIT');
      logger?.info?.(`[semantic] migration applied: ${file}`);
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

function createSemanticDb({ dataDir, logger = console }) {
  const dbPath = path.join(dataDir, 'semantic.sqlite');
  const db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('temp_store = MEMORY');
  ensureMigrations(db, path.join(__dirname, 'migrations'), logger);
  return db;
}

module.exports = {
  createSemanticDb,
  nowSec,
};
