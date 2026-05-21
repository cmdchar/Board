const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function createEmbeddingsDb({ dataDir, logger = console }) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'embeddings.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS note_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      board_id TEXT NOT NULL,
      node_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(board_id, node_id)
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_board ON note_embeddings(board_id);
  `);

  logger.log(`[EmbeddingsDB] Initialized at ${dbPath}`);
  return db;
}

module.exports = { createEmbeddingsDb };
