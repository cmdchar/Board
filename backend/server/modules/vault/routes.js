const express = require('express');

function toBool(value) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function sendError(res, error) {
  const status = Number(error?.status) || 500;
  const message = status >= 500 ? 'Vault request failed' : (error?.message || 'Request failed');
  return res.status(status).json({ error: message });
}

function createVaultRouter({ requireAuth, vault }) {
  const router = express.Router();
  router.use(requireAuth);

  router.get('/projects', (req, res) => {
    try {
      const items = vault.listProjects({
        q: req.query.q,
        status: req.query.status,
        limit: req.query.limit,
      });
      return res.json({ items });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/projects', (req, res) => {
    try {
      const project = vault.createProject(req.body || {}, req.user?.id || null);
      return res.status(201).json({ project });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.put('/projects/:id', (req, res) => {
    try {
      const project = vault.updateProject(String(req.params.id || ''), req.body || {}, req.user?.id || null);
      return res.json({ project });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/ingest', (req, res) => {
    try {
      const payload = vault.ingestFromText(req.body || {}, req.user?.id || null);
      return res.json(payload);
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/records', (req, res) => {
    try {
      const items = vault.listRecords({
        q: req.query.q,
        scope: req.query.scope,
        category: req.query.category,
        projectId: req.query.projectId,
        limit: req.query.limit,
      });
      return res.json({ items });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/records/:id', (req, res) => {
    try {
      const payload = vault.getRecord(String(req.params.id || ''), {
        includeVersions: toBool(req.query.includeVersions),
        versionsLimit: req.query.versionsLimit,
      });
      return res.json(payload);
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/records', (req, res) => {
    try {
      const record = vault.createRecord(req.body || {}, req.user?.id || null);
      return res.status(201).json({ record });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.put('/records/:id', (req, res) => {
    try {
      const record = vault.updateRecord(String(req.params.id || ''), req.body || {}, req.user?.id || null);
      return res.json({ record });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.post('/records/:id/reveal', (req, res) => {
    try {
      const payload = vault.revealRecordSecret(String(req.params.id || ''), req.user?.id || null);
      return res.json(payload);
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/subscriptions', (req, res) => {
    try {
      const items = vault.listSubscriptions({
        days: req.query.days,
        limit: req.query.limit,
      });
      return res.json({ items });
    } catch (error) {
      return sendError(res, error);
    }
  });

  router.get('/summary', (_req, res) => {
    try {
      return res.json(vault.getSummary());
    } catch (error) {
      return sendError(res, error);
    }
  });

  return router;
}

module.exports = {
  createVaultRouter,
};
