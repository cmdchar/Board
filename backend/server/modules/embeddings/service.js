const { createEmbeddingsDb } = require('./db');
const { OpenAI } = require('openai');

function createEmbeddingsService({ dataDir, logger = console }) {
  const db = createEmbeddingsDb({ dataDir, logger });

  // Use DEEPSEEK_API_KEY if available, fallback to OPENAI_API_KEY
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.DEEPSEEK_API_KEY ? "https://api.deepseek.com" : undefined;

  const openai = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

  const stmt = {
    upsert: db.prepare(`
      INSERT INTO note_embeddings (board_id, node_id, content, embedding, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(board_id, node_id) DO UPDATE SET
        content = excluded.content,
        embedding = excluded.embedding,
        updated_at = excluded.updated_at
    `),
    listByBoard: db.prepare(`SELECT node_id, content, embedding FROM note_embeddings WHERE board_id = ?`),
    deleteByNode: db.prepare(`DELETE FROM note_embeddings WHERE board_id = ? AND node_id = ?`),
    deleteByBoard: db.prepare(`DELETE FROM note_embeddings WHERE board_id = ?`),
  };

  async function generateEmbedding(text) {
    if (!openai) throw new Error("AI API Key not configured for embeddings");
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    return response.data[0].embedding;
  }

  function cosineSimilarity(v1, v2) {
    let dot = 0, m1 = 0, m2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      m1 += v1[i] * v1[i];
      m2 += v2[i] * v2[i];
    }
    return dot / (Math.sqrt(m1) * Math.sqrt(m2));
  }

  async function updateNoteEmbedding(boardId, nodeId, content) {
    try {
      const vector = await generateEmbedding(content);
      const buffer = Buffer.from(new Float32Array(vector).buffer);
      stmt.upsert.run(boardId, nodeId, content, buffer, Math.floor(Date.now() / 1000));
      return true;
    } catch (err) {
      logger.error(`[Embeddings] Failed for ${nodeId}:`, err.message);
      return false;
    }
  }

  async function searchSimilarNotes(boardId, query, limit = 5) {
    try {
      const queryVector = await generateEmbedding(query);
      const rows = stmt.listByBoard.all(boardId);

      const results = rows.map(row => {
        const vector = new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4);
        return {
          nodeId: row.node_id,
          content: row.content,
          similarity: cosineSimilarity(queryVector, Array.from(vector))
        };
      });

      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (err) {
      logger.error(`[Embeddings] Search failed:`, err.message);
      return [];
    }
  }

  return {
    updateNoteEmbedding,
    searchSimilarNotes,
    deleteByNode: (bid, nid) => stmt.deleteByNode.run(bid, nid),
    deleteByBoard: (bid) => stmt.deleteByBoard.run(bid),
  };
}

module.exports = { createEmbeddingsService };
