const { createSemanticService } = require('./service');
const { createSemanticQueue } = require('./queue');
const { extractSemantic } = require('./extractor');
const { computeHealth } = require('./health');

function createSemanticModule({ dataDir, logger = console, debounceMs = 1200 }) {
  const service = createSemanticService({ dataDir, logger });
  const queue = createSemanticQueue({ service, logger, debounceMs });

  return {
    extractSemantic,
    computeHealth,
    rebuildNow: (boardId, boardData, opts = {}) => queue.rebuildNow(boardId, boardData, opts),
    scheduleRebuild: (boardId, boardData, opts = {}) => queue.queueBoard(boardId, boardData, opts),
    getBoardSemantic: (boardId, opts = {}) => service.getBoardSemantic(boardId, opts),
    hasSnapshot: boardId => service.hasSnapshot(boardId),
    clearBoardSemantic: boardId => service.clearBoardSemantic(boardId),
    getMetrics: () => queue.getMetrics(),
    shutdown: () => {
      queue.shutdown();
      service.close();
    },
  };
}

module.exports = {
  createSemanticModule,
  extractSemantic,
  computeHealth,
};
