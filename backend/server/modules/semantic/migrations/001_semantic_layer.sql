CREATE TABLE IF NOT EXISTS semantic_entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  title TEXT,
  status TEXT,
  owner TEXT,
  due_date TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(board_id, source_node_id, type)
);

CREATE INDEX IF NOT EXISTS idx_semantic_entities_board_type
  ON semantic_entities(board_id, type);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_board_source
  ON semantic_entities(board_id, source_node_id);
CREATE INDEX IF NOT EXISTS idx_semantic_entities_board_updated
  ON semantic_entities(board_id, updated_at);

CREATE TABLE IF NOT EXISTS semantic_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id TEXT NOT NULL,
  type TEXT NOT NULL,
  from_entity_key TEXT NOT NULL,
  to_entity_key TEXT NOT NULL,
  source_edge_id TEXT NOT NULL DEFAULT '',
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(board_id, type, from_entity_key, to_entity_key, source_edge_id)
);

CREATE INDEX IF NOT EXISTS idx_semantic_relations_board_type
  ON semantic_relations(board_id, type);
CREATE INDEX IF NOT EXISTS idx_semantic_relations_board_from
  ON semantic_relations(board_id, from_entity_key);
CREATE INDEX IF NOT EXISTS idx_semantic_relations_board_to
  ON semantic_relations(board_id, to_entity_key);
CREATE INDEX IF NOT EXISTS idx_semantic_relations_board_updated
  ON semantic_relations(board_id, updated_at);

CREATE TABLE IF NOT EXISTS board_health_snapshot (
  board_id TEXT PRIMARY KEY,
  health_score INTEGER NOT NULL,
  issues_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  entities_count INTEGER NOT NULL,
  relations_count INTEGER NOT NULL,
  computed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_board_health_snapshot_updated
  ON board_health_snapshot(updated_at);
