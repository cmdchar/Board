const { extractSemantic } = require('./extractor');
const { computeHealth } = require('./health');
const { createSemanticDb, nowSec } = require('./db');

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function createSemanticService({ dataDir, logger = console }) {
  const db = createSemanticDb({ dataDir, logger });

  const stmt = {
    upsertEntity: db.prepare(`
      INSERT INTO semantic_entities (
        board_id, type, source_node_id, title, status, owner, due_date, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(board_id, source_node_id, type) DO UPDATE SET
        title = excluded.title,
        status = excluded.status,
        owner = excluded.owner,
        due_date = excluded.due_date,
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `),
    upsertRelation: db.prepare(`
      INSERT INTO semantic_relations (
        board_id, type, from_entity_key, to_entity_key, source_edge_id, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(board_id, type, from_entity_key, to_entity_key, source_edge_id) DO UPDATE SET
        metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at
    `),
    upsertSnapshot: db.prepare(`
      INSERT INTO board_health_snapshot (
        board_id, health_score, issues_json, stats_json, entities_count, relations_count, computed_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(board_id) DO UPDATE SET
        health_score = excluded.health_score,
        issues_json = excluded.issues_json,
        stats_json = excluded.stats_json,
        entities_count = excluded.entities_count,
        relations_count = excluded.relations_count,
        computed_at = excluded.computed_at,
        updated_at = excluded.updated_at
    `),
    listEntityKeys: db.prepare(`
      SELECT source_node_id, type
      FROM semantic_entities
      WHERE board_id = ?
    `),
    listRelationKeys: db.prepare(`
      SELECT type, from_entity_key, to_entity_key, source_edge_id
      FROM semantic_relations
      WHERE board_id = ?
    `),
    delEntity: db.prepare(`
      DELETE FROM semantic_entities
      WHERE board_id = ? AND source_node_id = ? AND type = ?
    `),
    delRelation: db.prepare(`
      DELETE FROM semantic_relations
      WHERE board_id = ? AND type = ? AND from_entity_key = ? AND to_entity_key = ? AND source_edge_id = ?
    `),
    countEntities: db.prepare(`
      SELECT COUNT(*) AS c FROM semantic_entities WHERE board_id = ?
    `),
    countRelations: db.prepare(`
      SELECT COUNT(*) AS c FROM semantic_relations WHERE board_id = ?
    `),
    listEntitiesPage: db.prepare(`
      SELECT board_id, type, source_node_id, title, status, owner, due_date, metadata_json, created_at, updated_at
      FROM semantic_entities
      WHERE board_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `),
    listRelationsPage: db.prepare(`
      SELECT board_id, type, from_entity_key, to_entity_key, source_edge_id, metadata_json, created_at, updated_at
      FROM semantic_relations
      WHERE board_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT ? OFFSET ?
    `),
    getSnapshot: db.prepare(`
      SELECT board_id, health_score, issues_json, stats_json, entities_count, relations_count, computed_at, updated_at
      FROM board_health_snapshot
      WHERE board_id = ?
    `),
    delEntitiesByBoard: db.prepare(`DELETE FROM semantic_entities WHERE board_id = ?`),
    delRelationsByBoard: db.prepare(`DELETE FROM semantic_relations WHERE board_id = ?`),
    delSnapshotByBoard: db.prepare(`DELETE FROM board_health_snapshot WHERE board_id = ?`),
  };

  function persistBoard(boardId, entities, relations, health) {
    const ts = nowSec();
    const entityKeySet = new Set(entities.map(e => `${e.sourceNodeId}::${e.type}`));
    const relationKeySet = new Set(
      relations.map(r => `${r.type}::${r.fromEntityKey}::${r.toEntityKey}::${String(r.sourceEdgeId || '')}`)
    );

    db.exec('BEGIN');
    try {
      for (const entity of entities) {
        stmt.upsertEntity.run(
          boardId,
          entity.type,
          entity.sourceNodeId,
          entity.title || null,
          entity.status || null,
          entity.owner || null,
          entity.dueDate || null,
          JSON.stringify(entity.metadata || {}),
          ts,
          ts
        );
      }
      const existingEntityKeys = stmt.listEntityKeys.all(boardId);
      for (const row of existingEntityKeys) {
        const key = `${row.source_node_id}::${row.type}`;
        if (entityKeySet.has(key)) continue;
        stmt.delEntity.run(boardId, row.source_node_id, row.type);
      }

      for (const relation of relations) {
        stmt.upsertRelation.run(
          boardId,
          relation.type,
          relation.fromEntityKey,
          relation.toEntityKey,
          String(relation.sourceEdgeId || ''),
          JSON.stringify(relation.metadata || {}),
          ts,
          ts
        );
      }
      const existingRelationKeys = stmt.listRelationKeys.all(boardId);
      for (const row of existingRelationKeys) {
        const key = `${row.type}::${row.from_entity_key}::${row.to_entity_key}::${String(row.source_edge_id || '')}`;
        if (relationKeySet.has(key)) continue;
        stmt.delRelation.run(boardId, row.type, row.from_entity_key, row.to_entity_key, String(row.source_edge_id || ''));
      }

      stmt.upsertSnapshot.run(
        boardId,
        health.healthScore,
        JSON.stringify(health.issues || []),
        JSON.stringify(health.stats || {}),
        entities.length,
        relations.length,
        Number(health.stats?.computedAt) || ts,
        ts
      );
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  function rebuildBoardSemantic(boardId, boardJson, options = {}) {
    const startedAt = Date.now();
    const extracted = extractSemantic(boardJson || {});
    const health = computeHealth(extracted.entities, extracted.relations, {
      nowSec: options.nowSec,
    });
    persistBoard(boardId, extracted.entities, extracted.relations, health);
    const tookMs = Date.now() - startedAt;
    return {
      boardId,
      entitiesCount: extracted.entities.length,
      relationsCount: extracted.relations.length,
      health,
      tookMs,
      trigger: options.trigger || 'manual',
    };
  }

  function getBoardSemantic(boardId, options = {}) {
    const entityLimit = clampInt(options.entityLimit, 500, 1, 5000);
    const relationLimit = clampInt(options.relationLimit, 500, 1, 5000);
    const entityOffset = clampInt(options.entityOffset, 0, 0, 1_000_000);
    const relationOffset = clampInt(options.relationOffset, 0, 0, 1_000_000);
    const issueLimit = clampInt(options.issueLimit, 500, 1, 5000);

    const entitiesRows = stmt.listEntitiesPage.all(boardId, entityLimit, entityOffset);
    const relationsRows = stmt.listRelationsPage.all(boardId, relationLimit, relationOffset);
    const snapshot = stmt.getSnapshot.get(boardId);

    const entities = entitiesRows.map(r => ({
      key: `${r.type}:${r.source_node_id}`,
      type: r.type,
      sourceNodeId: r.source_node_id,
      title: r.title || '',
      status: r.status || null,
      owner: r.owner || null,
      dueDate: r.due_date || null,
      metadata: safeJsonParse(r.metadata_json, {}),
      updatedAt: Number(r.updated_at) || 0,
    }));
    const relations = relationsRows.map(r => ({
      type: r.type,
      fromEntityKey: r.from_entity_key,
      toEntityKey: r.to_entity_key,
      sourceEdgeId: r.source_edge_id || '',
      metadata: safeJsonParse(r.metadata_json, {}),
      updatedAt: Number(r.updated_at) || 0,
    }));

    const totalEntities = Number(stmt.countEntities.get(boardId)?.c || 0);
    const totalRelations = Number(stmt.countRelations.get(boardId)?.c || 0);
    const fullIssues = safeJsonParse(snapshot?.issues_json, []);
    const health = snapshot
      ? {
          healthScore: Number(snapshot.health_score) || 0,
          issues: fullIssues.slice(0, issueLimit),
          totalIssues: fullIssues.length,
          stats: safeJsonParse(snapshot.stats_json, {}),
          entitiesCount: Number(snapshot.entities_count) || totalEntities,
          relationsCount: Number(snapshot.relations_count) || totalRelations,
          computedAt: Number(snapshot.computed_at) || null,
          updatedAt: Number(snapshot.updated_at) || null,
        }
      : null;

    return {
      boardId,
      entities,
      relations,
      health,
      pagination: {
        entities: { limit: entityLimit, offset: entityOffset, total: totalEntities },
        relations: { limit: relationLimit, offset: relationOffset, total: totalRelations },
      },
    };
  }

  function hasSnapshot(boardId) {
    return Boolean(stmt.getSnapshot.get(boardId));
  }

  function clearBoardSemantic(boardId) {
    db.exec('BEGIN');
    try {
      stmt.delRelationsByBoard.run(boardId);
      stmt.delEntitiesByBoard.run(boardId);
      stmt.delSnapshotByBoard.run(boardId);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }

  function close() {
    db.close();
  }

  return {
    rebuildBoardSemantic,
    getBoardSemantic,
    hasSnapshot,
    clearBoardSemantic,
    close,
  };
}

module.exports = {
  createSemanticService,
};
