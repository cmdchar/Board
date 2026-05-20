function createSemanticQueue({ service, logger = console, debounceMs = 1200 }) {
  const timers = new Map();
  const latestPayload = new Map();
  const running = new Set();

  const metrics = {
    queued: 0,
    started: 0,
    completed: 0,
    failed: 0,
    avg_ms: 0,
    last_ms: 0,
    last_error: '',
    last_error_at: 0,
    in_flight: 0,
  };

  function updateDuration(ms) {
    metrics.last_ms = ms;
    if (metrics.completed <= 1) {
      metrics.avg_ms = ms;
      return;
    }
    metrics.avg_ms = Math.round((metrics.avg_ms * (metrics.completed - 1) + ms) / metrics.completed);
  }

  async function runBoard(boardId) {
    if (running.has(boardId)) return;
    const payload = latestPayload.get(boardId);
    if (!payload) return;
    latestPayload.delete(boardId);
    running.add(boardId);
    metrics.started += 1;
    metrics.in_flight = running.size;
    const startedAt = Date.now();
    try {
      const result = service.rebuildBoardSemantic(boardId, payload.boardData, {
        trigger: payload.trigger || 'queue',
        nowSec: payload.nowSec,
      });
      metrics.completed += 1;
      updateDuration(Date.now() - startedAt);
      logger?.info?.(`[semantic] rebuild board=${boardId} trigger=${payload.trigger || 'queue'} entities=${result.entitiesCount} relations=${result.relationsCount} score=${result.health.healthScore} took=${result.tookMs}ms`);
    } catch (err) {
      metrics.failed += 1;
      metrics.last_error = err?.message || String(err);
      metrics.last_error_at = Math.floor(Date.now() / 1000);
      logger?.error?.(`[semantic] rebuild failed board=${boardId} ${metrics.last_error}`);
    } finally {
      running.delete(boardId);
      metrics.in_flight = running.size;
      if (latestPayload.has(boardId)) {
        queueBoard(boardId, latestPayload.get(boardId).boardData, latestPayload.get(boardId));
      }
    }
  }

  function queueBoard(boardId, boardData, opts = {}) {
    if (!boardId) return;
    metrics.queued += 1;
    latestPayload.set(boardId, {
      boardData: boardData || {},
      trigger: opts.trigger || 'queue',
      nowSec: opts.nowSec,
    });
    const prevTimer = timers.get(boardId);
    if (prevTimer) clearTimeout(prevTimer);
    timers.set(
      boardId,
      setTimeout(() => {
        timers.delete(boardId);
        runBoard(boardId);
      }, debounceMs)
    );
  }

  function rebuildNow(boardId, boardData, opts = {}) {
    const result = service.rebuildBoardSemantic(boardId, boardData || {}, {
      trigger: opts.trigger || 'manual',
      nowSec: opts.nowSec,
    });
    return result;
  }

  function getMetrics() {
    return {
      ...metrics,
      pending_boards: latestPayload.size,
      queued_boards: timers.size,
    };
  }

  function shutdown() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    latestPayload.clear();
  }

  return {
    queueBoard,
    rebuildNow,
    getMetrics,
    shutdown,
  };
}

module.exports = {
  createSemanticQueue,
};
