const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { createVaultDb, nowSec } = require('./db');

const ALLOWED_PROJECT_STATUS = new Set(['active', 'paused', 'archived']);
const ALLOWED_SCOPES = new Set(['global', 'project', 'site', 'subscription', 'other']);
const ALLOWED_CATEGORIES = new Set(['api', 'password', 'env', 'database', 'user', 'script', 'subscription', 'token', 'note', 'other']);

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function clipText(value, max = 5000) {
  return String(value || '').trim().slice(0, max);
}

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(v => clipText(v, 80)).filter(Boolean))].slice(0, 30);
  }
  const raw = clipText(value, 1200);
  if (!raw) return [];
  return [...new Set(raw.split(',').map(v => clipText(v, 80)).filter(Boolean))].slice(0, 30);
}

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const asNum = Number(value);
  if (Number.isFinite(asNum)) {
    const sec = asNum > 2_000_000_000 ? Math.floor(asNum / 1000) : Math.floor(asNum);
    return sec > 0 ? sec : null;
  }
  const ms = Date.parse(String(value));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function normalizeMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function maskSecret(secret) {
  const text = String(secret || '');
  if (!text) return '';
  if (text.length <= 4) return '*'.repeat(text.length);
  return `${'*'.repeat(Math.min(8, text.length - 2))}${text.slice(-2)}`;
}

function normalizeProjectStatus(status) {
  const next = clipText(status, 32).toLowerCase();
  return ALLOWED_PROJECT_STATUS.has(next) ? next : 'active';
}

function normalizeScope(scope) {
  const next = clipText(scope, 32).toLowerCase();
  return ALLOWED_SCOPES.has(next) ? next : 'other';
}

function normalizeCategory(category) {
  const next = clipText(category, 40).toLowerCase();
  return ALLOWED_CATEGORIES.has(next) ? next : 'other';
}

function toTitleFromLabel(label) {
  const raw = clipText(label, 200);
  if (!raw) return 'Captured credential';
  const normalized = raw
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return 'Captured credential';
  return normalized;
}

function normalizeLineValue(value) {
  let out = String(value || '').trim();
  if (!out) return '';
  const hashIdx = out.indexOf(' #');
  if (hashIdx >= 0) out = out.slice(0, hashIdx).trim();
  if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
    out = out.slice(1, -1);
  }
  return out.trim();
}

function looksLikelyUrl(value) {
  const v = clipText(value, 2000);
  if (!v) return false;
  return /^(https?:\/\/|ssh:\/\/|postgres:\/\/|mysql:\/\/|redis:\/\/|mongodb(?:\+srv)?:\/\/)/i.test(v)
    || /^[a-z0-9.-]+\.[a-z]{2,}([/:].*)?$/i.test(v);
}

function looksSensitiveValue(value) {
  const v = clipText(value, 4000);
  if (!v) return false;
  if (/\s/.test(v)) return false;
  if (/^(sk-|ghp_|gho_|xox[baprs]-|AIza|eyJ[A-Za-z0-9_-]+\.)/.test(v)) return true;
  if (v.length >= 24 && /[A-Za-z]/.test(v) && /[0-9]/.test(v)) return true;
  return false;
}

function isSecretLabel(label) {
  return /(?:api[_\s-]?key|token|secret|password|pass|pwd|private[_\s-]?key|client[_\s-]?secret|auth[_\s-]?token|bearer)/i
    .test(String(label || ''));
}

function isUsernameLabel(label) {
  return /(?:user(?:name)?|email|login|account)/i.test(String(label || ''));
}

function isUrlLabel(label) {
  return /(?:url|host|domain|endpoint|server|base[_\s-]?url)/i.test(String(label || ''));
}

function inferCategoryFromLabel(label) {
  const text = String(label || '').toLowerCase();
  if (/(password|pass|pwd)/.test(text)) return 'password';
  if (/(token|secret|private[_\s-]?key|client[_\s-]?secret|auth)/.test(text)) return 'token';
  if (/(api[_\s-]?key|openai|deepseek|github|jira|supabase)/.test(text)) return 'api';
  if (/(database|db|postgres|mysql|redis|mongo)/.test(text)) return 'database';
  if (/(user|email|login|account)/.test(text)) return 'user';
  if (/(subscription|billing|plan|renew|invoice)/.test(text)) return 'subscription';
  if (/(env|dotenv)/.test(text)) return 'env';
  return 'other';
}

function extractWorkspaceSlug(rawPath) {
  const v = clipText(rawPath, 1000);
  if (!v) return '';
  const parts = v.replace(/\\/g, '/').split('/').filter(Boolean);
  if (!parts.length) return '';
  return slugify(parts[parts.length - 1]);
}

function slugToName(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const item of (Array.isArray(candidates) ? candidates : [])) {
    if (!item || typeof item !== 'object') continue;
    const key = [
      clipText(item.scope, 40).toLowerCase(),
      clipText(item.category, 40).toLowerCase(),
      clipText(item.title, 220).toLowerCase(),
      clipText(item.username, 220).toLowerCase(),
      clipText(item.secret, 500).toLowerCase(),
      clipText(item.url, 500).toLowerCase(),
    ].join('::');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function splitLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function extractEnvCandidates(text) {
  const lines = splitLines(text);
  const envRe = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]{1,120})\s*=\s*(.+)$/;
  const groups = new Map();
  const singles = [];

  const ensureGroup = (name, fallbackTitle) => {
    if (!groups.has(name)) {
      groups.set(name, {
        key: name,
        title: toTitleFromLabel(fallbackTitle || name),
        category: 'env',
        username: '',
        secret: '',
        url: '',
        notesKeys: [],
        tags: ['env'],
      });
    }
    return groups.get(name);
  };

  const prefixFromKey = (key) => {
    const stripped = String(key || '')
      .replace(/_(API_?KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|USER(?:NAME)?|EMAIL|URL|HOST|DOMAIN|ENDPOINT)$/i, '');
    return stripped || key;
  };

  for (const line of lines) {
    const match = line.match(envRe);
    if (!match) continue;
    const key = String(match[1] || '').trim();
    const value = normalizeLineValue(match[2]);
    if (!key || !value) continue;

    const kindSecret = isSecretLabel(key);
    const kindUser = isUsernameLabel(key);
    const kindUrl = isUrlLabel(key);
    const prefix = prefixFromKey(key);
    const group = ensureGroup(prefix, prefix);
    group.notesKeys.push(key);
    if (!group.category || group.category === 'env' || group.category === 'other') {
      group.category = inferCategoryFromLabel(key);
    }

    if (kindSecret) {
      group.secret = value;
      if (inferCategoryFromLabel(key) !== 'other') group.category = inferCategoryFromLabel(key);
      continue;
    }
    if (kindUser) {
      group.username = value;
      if (group.category === 'other') group.category = 'user';
      continue;
    }
    if (kindUrl || looksLikelyUrl(value)) {
      group.url = value;
      if (group.category === 'other') group.category = 'note';
      continue;
    }

    if (looksSensitiveValue(value)) {
      singles.push({
        scope: 'other',
        category: inferCategoryFromLabel(key),
        title: toTitleFromLabel(key),
        secret: value,
        username: '',
        url: '',
        notes: `Captured from ${key}`,
        tags: ['env'],
      });
    }
  }

  const grouped = [];
  for (const group of groups.values()) {
    if (!group.secret && !group.username && !group.url) continue;
    const keyName = group.key || group.title;
    grouped.push({
      scope: 'other',
      category: group.category || inferCategoryFromLabel(keyName),
      title: toTitleFromLabel(keyName),
      username: group.username || '',
      secret: group.secret || '',
      url: group.url || '',
      notes: group.notesKeys.length ? `ENV keys: ${group.notesKeys.join(', ')}` : '',
      tags: group.tags,
    });
  }

  return [...grouped, ...singles];
}

function extractLooseCandidates(text) {
  const input = String(text || '');
  if (!input.trim()) return [];
  const out = [];

  const userPassRe = /(?:user(?:name)?|email)\s*[:=]\s*([^\s,;]+)[\s\S]{0,120}?(?:pass(?:word)?|parola|pwd)\s*[:=]\s*([^\s,;]+)/ig;
  for (const match of input.matchAll(userPassRe)) {
    out.push({
      scope: 'other',
      category: 'password',
      title: 'Login credentials',
      username: normalizeLineValue(match[1]),
      secret: normalizeLineValue(match[2]),
      url: '',
      notes: 'Captured from free text',
      tags: ['loose'],
    });
  }

  const kvRe = /([A-Za-z0-9_.\- ]{2,80})\s*[:=]\s*([^\n\r]+)/g;
  for (const match of input.matchAll(kvRe)) {
    const label = clipText(match[1], 120);
    const value = normalizeLineValue(match[2]);
    if (!label || !value) continue;

    if (isSecretLabel(label)) {
      out.push({
        scope: 'other',
        category: inferCategoryFromLabel(label),
        title: toTitleFromLabel(label),
        username: '',
        secret: value,
        url: '',
        notes: 'Captured from free text',
        tags: ['loose'],
      });
      continue;
    }
    if (isUsernameLabel(label)) {
      out.push({
        scope: 'other',
        category: 'user',
        title: toTitleFromLabel(label),
        username: value,
        secret: '',
        url: '',
        notes: 'Captured from free text',
        tags: ['loose'],
      });
      continue;
    }
    if (isUrlLabel(label) || looksLikelyUrl(value)) {
      out.push({
        scope: 'other',
        category: 'note',
        title: toTitleFromLabel(label),
        username: '',
        secret: '',
        url: value,
        notes: 'Captured from free text',
        tags: ['loose'],
      });
      continue;
    }
    if (looksSensitiveValue(value)) {
      out.push({
        scope: 'other',
        category: inferCategoryFromLabel(label),
        title: toTitleFromLabel(label),
        username: '',
        secret: value,
        url: '',
        notes: 'Captured from free text',
        tags: ['loose'],
      });
    }
  }

  return out;
}

function extractCandidatesFromText(text) {
  const env = extractEnvCandidates(text);
  const loose = extractLooseCandidates(text);
  return dedupeCandidates([...env, ...loose]);
}

function encodeSecret(plainText, secretKeyBuffer) {
  const text = String(plainText || '');
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKeyBuffer, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decodeSecret(blob, secretKeyBuffer) {
  const raw = clipText(blob, 20_000);
  if (!raw) return '';
  const parts = raw.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return '';
  const [, ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKeyBuffer, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function toProjectDto(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    stack: row.stack || '',
    repoUrl: row.repo_url || '',
    status: row.status || 'active',
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
  };
}

function toRecordDto(row) {
  return {
    id: row.id,
    scope: row.scope,
    projectId: row.project_id || null,
    projectName: row.project_name || null,
    projectSlug: row.project_slug || null,
    category: row.category,
    title: row.title,
    username: row.username || '',
    secretHint: row.secret_hint || '',
    hasSecret: Boolean(row.secret_cipher),
    url: row.url || '',
    notes: row.notes || '',
    tags: parseJson(row.tags_json, []),
    metadata: parseJson(row.metadata_json, {}),
    costAmount: row.cost_amount === null || row.cost_amount === undefined ? null : Number(row.cost_amount),
    costCurrency: row.cost_currency || '',
    renewsAt: row.renews_at ? Number(row.renews_at) : null,
    expiresAt: row.expires_at ? Number(row.expires_at) : null,
    createdBy: row.created_by || null,
    updatedBy: row.updated_by || null,
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
    lastRevealedAt: row.last_revealed_at ? Number(row.last_revealed_at) : null,
  };
}

function createVaultService({ dataDir, logger = console, secretKey }) {
  const keySource = clipText(secretKey, 2048);
  if (!keySource) {
    throw new Error('Vault secret key is required');
  }
  const secretKeyBuffer = crypto.createHash('sha256').update(keySource).digest();
  const db = createVaultDb({ dataDir, logger });

  const stmt = {
    projectById: db.prepare('SELECT * FROM vault_projects WHERE id = ?'),
    projectBySlug: db.prepare('SELECT * FROM vault_projects WHERE slug = ?'),
    projectByNameExact: db.prepare('SELECT * FROM vault_projects WHERE lower(name) = lower(?) LIMIT 1'),
    projectSearchOne: db.prepare(`
      SELECT *
      FROM vault_projects
      WHERE slug LIKE ? OR lower(name) LIKE lower(?)
      ORDER BY updated_at DESC
      LIMIT 1
    `),
    insertProject: db.prepare(`
      INSERT INTO vault_projects (id, slug, name, description, stack, repo_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateProject: db.prepare(`
      UPDATE vault_projects
      SET slug = ?, name = ?, description = ?, stack = ?, repo_url = ?, status = ?, updated_at = ?
      WHERE id = ?
    `),
    countProjects: db.prepare('SELECT COUNT(*) AS c FROM vault_projects'),
    insertRecord: db.prepare(`
      INSERT INTO vault_records (
        id, scope, project_id, category, title, username, secret_cipher, secret_hint, url, notes,
        tags_json, metadata_json, cost_amount, cost_currency, renews_at, expires_at,
        created_by, updated_by, created_at, updated_at, last_revealed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    recordById: db.prepare(`
      SELECT r.*, p.name AS project_name, p.slug AS project_slug
      FROM vault_records r
      LEFT JOIN vault_projects p ON p.id = r.project_id
      WHERE r.id = ?
    `),
    recordByNaturalKey: db.prepare(`
      SELECT r.*, p.name AS project_name, p.slug AS project_slug
      FROM vault_records r
      LEFT JOIN vault_projects p ON p.id = r.project_id
      WHERE ((r.project_id IS NULL AND ? IS NULL) OR r.project_id = ?)
        AND r.scope = ?
        AND r.category = ?
        AND r.title = ?
      LIMIT 1
    `),
    updateRecord: db.prepare(`
      UPDATE vault_records
      SET scope = ?, project_id = ?, category = ?, title = ?, username = ?, secret_cipher = ?, secret_hint = ?,
          url = ?, notes = ?, tags_json = ?, metadata_json = ?, cost_amount = ?, cost_currency = ?,
          renews_at = ?, expires_at = ?, updated_by = ?, updated_at = ?, last_revealed_at = ?
      WHERE id = ?
    `),
    touchReveal: db.prepare('UPDATE vault_records SET last_revealed_at = ? WHERE id = ?'),
    listVersions: db.prepare(`
      SELECT version_no, action, snapshot_json, created_by, created_at
      FROM vault_record_versions
      WHERE record_id = ?
      ORDER BY version_no DESC
      LIMIT ?
    `),
    maxVersion: db.prepare('SELECT MAX(version_no) AS v FROM vault_record_versions WHERE record_id = ?'),
    insertVersion: db.prepare(`
      INSERT INTO vault_record_versions (record_id, version_no, action, snapshot_json, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    insertActivity: db.prepare(`
      INSERT INTO vault_activity (actor_id, action, project_id, record_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    countRecords: db.prepare('SELECT COUNT(*) AS c FROM vault_records'),
    countRecordsByScope: db.prepare('SELECT scope, COUNT(*) AS c FROM vault_records GROUP BY scope'),
    countRecordsByCategory: db.prepare('SELECT category, COUNT(*) AS c FROM vault_records GROUP BY category'),
    countSubscriptionsDueSoon: db.prepare(`
      SELECT COUNT(*) AS c
      FROM vault_records
      WHERE (
        category = 'subscription'
        OR cost_amount IS NOT NULL
        OR renews_at IS NOT NULL
        OR expires_at IS NOT NULL
      ) AND COALESCE(renews_at, expires_at) IS NOT NULL
      AND COALESCE(renews_at, expires_at) <= ?
    `),
  };

  function ensureProjectExists(projectId) {
    if (!projectId) return null;
    const project = stmt.projectById.get(projectId);
    if (!project) {
      const err = new Error('Project not found');
      err.status = 404;
      throw err;
    }
    return project;
  }

  function appendVersionFromRow(row, action, actorId = null) {
    if (!row?.id) return;
    const nextVersion = Number(stmt.maxVersion.get(row.id)?.v || 0) + 1;
    const snapshot = {
      scope: row.scope,
      project_id: row.project_id || null,
      category: row.category,
      title: row.title,
      username: row.username || '',
      has_secret: Boolean(row.secret_cipher),
      secret_hint: row.secret_hint || '',
      url: row.url || '',
      notes: row.notes || '',
      tags: parseJson(row.tags_json, []),
      metadata: parseJson(row.metadata_json, {}),
      cost_amount: row.cost_amount === null || row.cost_amount === undefined ? null : Number(row.cost_amount),
      cost_currency: row.cost_currency || '',
      renews_at: row.renews_at ? Number(row.renews_at) : null,
      expires_at: row.expires_at ? Number(row.expires_at) : null,
      updated_at: Number(row.updated_at) || 0,
    };
    stmt.insertVersion.run(
      row.id,
      nextVersion,
      clipText(action, 64) || 'update',
      JSON.stringify(snapshot),
      actorId || null,
      nowSec(),
    );
  }

  function appendActivity({ actorId = null, action, projectId = null, recordId = null, details = {} }) {
    stmt.insertActivity.run(
      actorId || null,
      clipText(action, 80),
      projectId || null,
      recordId || null,
      JSON.stringify(details && typeof details === 'object' ? details : {}),
      nowSec(),
    );
  }

  function listProjects(options = {}) {
    const q = clipText(options.q, 120);
    const status = clipText(options.status, 32).toLowerCase();
    const limitNum = Number(options.limit);
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(500, Math.floor(limitNum))) : 200;

    const where = [];
    const params = [];
    if (q) {
      const like = `%${q}%`;
      where.push('(name LIKE ? OR slug LIKE ? OR description LIKE ? OR stack LIKE ? OR repo_url LIKE ?)');
      params.push(like, like, like, like, like);
    }
    if (status && status !== 'all' && ALLOWED_PROJECT_STATUS.has(status)) {
      where.push('status = ?');
      params.push(status);
    }
    params.push(limit);
    const sql = `
      SELECT *
      FROM vault_projects
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY updated_at DESC, name ASC
      LIMIT ?
    `;
    return db.prepare(sql).all(...params).map(toProjectDto);
  }

  function resolveProjectForIngest(payload = {}, actorId = null) {
    const autoCreate = payload.autoCreateProject !== false;
    const projectId = clipText(payload.projectId || payload.project_id, 120);
    if (projectId) return ensureProjectExists(projectId);

    let slugHint = clipText(payload.projectSlug || payload.project_slug, 120);
    const projectNameHint = clipText(payload.projectName || payload.project_name, 220);
    const workspaceSlug = extractWorkspaceSlug(payload.workspacePath || payload.workspace_path || payload.cwd);
    if (!slugHint && projectNameHint) slugHint = slugify(projectNameHint);
    if (!slugHint && workspaceSlug) slugHint = workspaceSlug;
    slugHint = slugify(slugHint);

    if (slugHint) {
      const bySlug = stmt.projectBySlug.get(slugHint);
      if (bySlug) return bySlug;
      const fuzzy = stmt.projectSearchOne.get(`%${slugHint}%`, `%${slugHint}%`);
      if (fuzzy) return fuzzy;
    }
    if (projectNameHint) {
      const byName = stmt.projectByNameExact.get(projectNameHint);
      if (byName) return byName;
      const fuzzyByName = stmt.projectSearchOne.get(`%${slugify(projectNameHint)}%`, `%${projectNameHint}%`);
      if (fuzzyByName) return fuzzyByName;
    }

    if (!autoCreate) return null;

    if (projectNameHint || slugHint) {
      const createPayload = {
        name: projectNameHint || slugToName(slugHint),
        slug: slugHint || slugify(projectNameHint),
      };
      const created = createProject(createPayload, actorId);
      return stmt.projectById.get(created.id);
    }

    return null;
  }

  function createProject(payload = {}, actorId = null) {
    const name = clipText(payload.name, 200);
    if (!name) {
      const err = new Error('Project name is required');
      err.status = 400;
      throw err;
    }
    const slugInput = clipText(payload.slug, 120);
    const slug = slugify(slugInput || name);
    if (!slug) {
      const err = new Error('Project slug is invalid');
      err.status = 400;
      throw err;
    }
    if (stmt.projectBySlug.get(slug)) {
      const err = new Error('Project slug already exists');
      err.status = 409;
      throw err;
    }
    const projectId = uuidv4();
    const t = nowSec();
    stmt.insertProject.run(
      projectId,
      slug,
      name,
      clipText(payload.description, 3000),
      clipText(payload.stack, 1000),
      clipText(payload.repoUrl || payload.repo_url, 1000),
      normalizeProjectStatus(payload.status),
      t,
      t,
    );
    appendActivity({
      actorId,
      action: 'project.create',
      projectId,
      details: { slug, name },
    });
    return toProjectDto(stmt.projectById.get(projectId));
  }

  function updateProject(projectId, payload = {}, actorId = null) {
    const current = ensureProjectExists(projectId);
    const nextName = hasOwn(payload, 'name') ? clipText(payload.name, 200) : current.name;
    if (!nextName) {
      const err = new Error('Project name is required');
      err.status = 400;
      throw err;
    }
    const requestedSlug = hasOwn(payload, 'slug') ? clipText(payload.slug, 120) : current.slug;
    const nextSlug = slugify(requestedSlug || nextName);
    if (!nextSlug) {
      const err = new Error('Project slug is invalid');
      err.status = 400;
      throw err;
    }
    const sameSlugConflict = stmt.projectBySlug.get(nextSlug);
    if (sameSlugConflict && sameSlugConflict.id !== projectId) {
      const err = new Error('Project slug already exists');
      err.status = 409;
      throw err;
    }
    const t = nowSec();
    stmt.updateProject.run(
      nextSlug,
      nextName,
      hasOwn(payload, 'description') ? clipText(payload.description, 3000) : current.description,
      hasOwn(payload, 'stack') ? clipText(payload.stack, 1000) : current.stack,
      hasOwn(payload, 'repoUrl') || hasOwn(payload, 'repo_url')
        ? clipText(payload.repoUrl || payload.repo_url, 1000)
        : current.repo_url,
      hasOwn(payload, 'status') ? normalizeProjectStatus(payload.status) : current.status,
      t,
      projectId,
    );
    appendActivity({
      actorId,
      action: 'project.update',
      projectId,
      details: { before: { slug: current.slug, name: current.name }, after: { slug: nextSlug, name: nextName } },
    });
    return toProjectDto(stmt.projectById.get(projectId));
  }

  function createRecord(payload = {}, actorId = null) {
    const scope = normalizeScope(payload.scope);
    const category = normalizeCategory(payload.category);
    const title = clipText(payload.title, 220);
    if (!title) {
      const err = new Error('Record title is required');
      err.status = 400;
      throw err;
    }
    const projectId = clipText(payload.projectId || payload.project_id, 120) || null;
    if (projectId) ensureProjectExists(projectId);
    if (scope === 'project' && !projectId) {
      const err = new Error('projectId is required for project scope');
      err.status = 400;
      throw err;
    }
    const secretRaw = hasOwn(payload, 'secret') ? String(payload.secret || '') : '';
    const secretCipher = secretRaw ? encodeSecret(secretRaw, secretKeyBuffer) : '';
    const secretHint = hasOwn(payload, 'secretHint')
      ? clipText(payload.secretHint, 120)
      : (secretRaw ? maskSecret(secretRaw) : '');

    const recordId = uuidv4();
    const t = nowSec();
    stmt.insertRecord.run(
      recordId,
      scope,
      projectId,
      category,
      title,
      clipText(payload.username, 200),
      secretCipher,
      secretHint,
      clipText(payload.url, 1000),
      clipText(payload.notes, 30_000),
      JSON.stringify(normalizeTags(payload.tags)),
      JSON.stringify(normalizeMetadata(payload.metadata)),
      normalizeMoney(payload.costAmount),
      clipText(payload.costCurrency, 12).toUpperCase(),
      parseTimestamp(payload.renewsAt),
      parseTimestamp(payload.expiresAt),
      actorId || null,
      actorId || null,
      t,
      t,
      null,
    );
    const row = stmt.recordById.get(recordId);
    appendVersionFromRow(row, 'create', actorId);
    appendActivity({
      actorId,
      action: 'record.create',
      projectId: row.project_id || null,
      recordId: row.id,
      details: { scope, category, title },
    });
    return toRecordDto(row);
  }

  function upsertRecordByNaturalKey(payload = {}, actorId = null) {
    const scope = normalizeScope(payload.scope);
    const category = normalizeCategory(payload.category);
    const title = clipText(payload.title, 220);
    const projectId = clipText(payload.projectId || payload.project_id, 120) || null;
    const existing = stmt.recordByNaturalKey.get(projectId, projectId, scope, category, title);
    if (existing?.id) {
      const record = updateRecord(existing.id, {
        ...payload,
        scope,
        category,
        title,
        projectId,
      }, actorId);
      return { action: 'updated', record };
    }
    const record = createRecord({
      ...payload,
      scope,
      category,
      title,
      projectId,
    }, actorId);
    return { action: 'created', record };
  }

  function updateRecord(recordId, payload = {}, actorId = null) {
    const current = stmt.recordById.get(recordId);
    if (!current) {
      const err = new Error('Record not found');
      err.status = 404;
      throw err;
    }

    const nextScope = hasOwn(payload, 'scope') ? normalizeScope(payload.scope) : current.scope;
    let nextProjectId = hasOwn(payload, 'projectId') || hasOwn(payload, 'project_id')
      ? clipText(payload.projectId || payload.project_id, 120) || null
      : current.project_id;
    if (nextProjectId) ensureProjectExists(nextProjectId);
    if (nextScope === 'project' && !nextProjectId) {
      const err = new Error('projectId is required for project scope');
      err.status = 400;
      throw err;
    }
    if (nextScope !== 'project' && hasOwn(payload, 'projectId') && !clipText(payload.projectId, 120)) {
      nextProjectId = null;
    }

    const nextTitle = hasOwn(payload, 'title') ? clipText(payload.title, 220) : current.title;
    if (!nextTitle) {
      const err = new Error('Record title is required');
      err.status = 400;
      throw err;
    }

    let nextSecretCipher = current.secret_cipher || '';
    let nextSecretHint = hasOwn(payload, 'secretHint')
      ? clipText(payload.secretHint, 120)
      : (current.secret_hint || '');

    if (hasOwn(payload, 'secret')) {
      const raw = String(payload.secret || '');
      if (raw) {
        nextSecretCipher = encodeSecret(raw, secretKeyBuffer);
        if (!hasOwn(payload, 'secretHint')) nextSecretHint = maskSecret(raw);
      } else {
        nextSecretCipher = '';
        if (!hasOwn(payload, 'secretHint')) nextSecretHint = '';
      }
    }

    const t = nowSec();
    stmt.updateRecord.run(
      nextScope,
      nextProjectId,
      hasOwn(payload, 'category') ? normalizeCategory(payload.category) : current.category,
      nextTitle,
      hasOwn(payload, 'username') ? clipText(payload.username, 200) : (current.username || ''),
      nextSecretCipher,
      nextSecretHint,
      hasOwn(payload, 'url') ? clipText(payload.url, 1000) : (current.url || ''),
      hasOwn(payload, 'notes') ? clipText(payload.notes, 30_000) : (current.notes || ''),
      hasOwn(payload, 'tags') ? JSON.stringify(normalizeTags(payload.tags)) : (current.tags_json || '[]'),
      hasOwn(payload, 'metadata') ? JSON.stringify(normalizeMetadata(payload.metadata)) : (current.metadata_json || '{}'),
      hasOwn(payload, 'costAmount') ? normalizeMoney(payload.costAmount) : current.cost_amount,
      hasOwn(payload, 'costCurrency') ? clipText(payload.costCurrency, 12).toUpperCase() : (current.cost_currency || ''),
      hasOwn(payload, 'renewsAt') ? parseTimestamp(payload.renewsAt) : current.renews_at,
      hasOwn(payload, 'expiresAt') ? parseTimestamp(payload.expiresAt) : current.expires_at,
      actorId || null,
      t,
      current.last_revealed_at || null,
      recordId,
    );

    const row = stmt.recordById.get(recordId);
    appendVersionFromRow(row, 'update', actorId);
    appendActivity({
      actorId,
      action: 'record.update',
      projectId: row.project_id || null,
      recordId: row.id,
      details: { scope: row.scope, category: row.category, title: row.title },
    });
    return toRecordDto(row);
  }

  function listRecords(options = {}) {
    const q = clipText(options.q, 140);
    const scope = clipText(options.scope, 40).toLowerCase();
    const category = clipText(options.category, 40).toLowerCase();
    const projectId = clipText(options.projectId, 120);
    const limitNum = Number(options.limit);
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(500, Math.floor(limitNum))) : 200;

    const where = [];
    const params = [];
    if (q) {
      const like = `%${q}%`;
      where.push('(r.title LIKE ? OR r.username LIKE ? OR r.url LIKE ? OR r.notes LIKE ?)');
      params.push(like, like, like, like);
    }
    if (scope && scope !== 'all') {
      where.push('r.scope = ?');
      params.push(scope);
    }
    if (category && category !== 'all') {
      where.push('r.category = ?');
      params.push(category);
    }
    if (projectId && projectId !== 'all') {
      where.push('r.project_id = ?');
      params.push(projectId);
    }
    params.push(limit);
    const sql = `
      SELECT r.*, p.name AS project_name, p.slug AS project_slug
      FROM vault_records r
      LEFT JOIN vault_projects p ON p.id = r.project_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY r.updated_at DESC, r.created_at DESC
      LIMIT ?
    `;
    return db.prepare(sql).all(...params).map(toRecordDto);
  }

  function getRecord(recordId, options = {}) {
    const row = stmt.recordById.get(recordId);
    if (!row) {
      const err = new Error('Record not found');
      err.status = 404;
      throw err;
    }
    const result = {
      record: toRecordDto(row),
    };
    if (options.includeVersions) {
      const limitNum = Number(options.versionsLimit);
      const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(100, Math.floor(limitNum))) : 20;
      const versions = stmt.listVersions.all(recordId, limit).map(v => ({
        version: Number(v.version_no) || 0,
        action: v.action || 'update',
        createdBy: v.created_by || null,
        createdAt: Number(v.created_at) || 0,
        snapshot: parseJson(v.snapshot_json, {}),
      }));
      result.versions = versions;
    }
    return result;
  }

  function revealRecordSecret(recordId, actorId = null) {
    const row = stmt.recordById.get(recordId);
    if (!row) {
      const err = new Error('Record not found');
      err.status = 404;
      throw err;
    }
    if (!row.secret_cipher) {
      const err = new Error('No secret saved for this record');
      err.status = 400;
      throw err;
    }
    const secret = decodeSecret(row.secret_cipher, secretKeyBuffer);
    const ts = nowSec();
    stmt.touchReveal.run(ts, recordId);
    appendActivity({
      actorId,
      action: 'record.reveal',
      projectId: row.project_id || null,
      recordId,
      details: {},
    });
    return {
      id: recordId,
      secret,
      revealedAt: ts,
    };
  }

  function listSubscriptions(options = {}) {
    const daysNum = Number(options.days);
    const limitNum = Number(options.limit);
    const days = Number.isFinite(daysNum) ? Math.max(1, Math.min(365, Math.floor(daysNum))) : 60;
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(500, Math.floor(limitNum))) : 200;
    const until = nowSec() + (days * 86400);
    const rows = db.prepare(`
      SELECT r.*, p.name AS project_name, p.slug AS project_slug,
             COALESCE(r.renews_at, r.expires_at) AS next_due_at
      FROM vault_records r
      LEFT JOIN vault_projects p ON p.id = r.project_id
      WHERE (
        r.category = 'subscription'
        OR r.cost_amount IS NOT NULL
        OR r.renews_at IS NOT NULL
        OR r.expires_at IS NOT NULL
      )
      AND COALESCE(r.renews_at, r.expires_at) IS NOT NULL
      AND COALESCE(r.renews_at, r.expires_at) <= ?
      ORDER BY next_due_at ASC
      LIMIT ?
    `).all(until, limit);

    return rows.map((row) => ({
      ...toRecordDto(row),
      nextDueAt: row.next_due_at ? Number(row.next_due_at) : null,
      isExpired: row.next_due_at ? Number(row.next_due_at) < nowSec() : false,
    }));
  }

  function getSummary() {
    const totals = {
      projects: Number(stmt.countProjects.get()?.c || 0),
      records: Number(stmt.countRecords.get()?.c || 0),
    };
    const byScope = {};
    for (const row of stmt.countRecordsByScope.all()) {
      byScope[String(row.scope || 'other')] = Number(row.c) || 0;
    }
    const byCategory = {};
    for (const row of stmt.countRecordsByCategory.all()) {
      byCategory[String(row.category || 'other')] = Number(row.c) || 0;
    }
    const dueSoon = Number(stmt.countSubscriptionsDueSoon.get(nowSec() + 30 * 86400)?.c || 0);
    return {
      totals,
      byScope,
      byCategory,
      dueSoon30d: dueSoon,
    };
  }

  function ingestFromText(payload = {}, actorId = null) {
    const text = String(payload.text || '').trim();
    const manualCandidate = {
      title: clipText(payload.title, 220),
      category: clipText(payload.category, 40),
      scope: clipText(payload.scope, 40),
      username: clipText(payload.username, 220),
      secret: String(payload.secret || ''),
      url: clipText(payload.url, 1000),
      notes: clipText(payload.notes, 3000),
      tags: normalizeTags(payload.tags),
    };

    if (!text && !manualCandidate.title && !manualCandidate.secret && !manualCandidate.username) {
      const err = new Error('text or explicit record fields are required');
      err.status = 400;
      throw err;
    }

    const projectRow = resolveProjectForIngest(payload, actorId);
    const sourceTag = clipText(payload.source, 80) || 'assistant';
    const candidates = extractCandidatesFromText(text);
    if (manualCandidate.title || manualCandidate.secret || manualCandidate.username || manualCandidate.url) {
      candidates.push({
        scope: manualCandidate.scope || 'other',
        category: manualCandidate.category || inferCategoryFromLabel(manualCandidate.title || 'other'),
        title: manualCandidate.title || 'Manual capture',
        username: manualCandidate.username || '',
        secret: manualCandidate.secret || '',
        url: manualCandidate.url || '',
        notes: manualCandidate.notes || '',
        tags: manualCandidate.tags,
      });
    }
    const merged = dedupeCandidates(candidates);

    const created = [];
    const updated = [];
    const skipped = [];

    for (const candidate of merged) {
      const nextScope = normalizeScope(
        candidate.scope && candidate.scope !== 'other'
          ? candidate.scope
          : (projectRow ? 'project' : 'global')
      );
      const nextProjectId = nextScope === 'project' ? projectRow?.id || null : null;
      if (nextScope === 'project' && !nextProjectId) {
        skipped.push({ reason: 'missing_project', title: candidate.title || 'Untitled' });
        continue;
      }
      const nextCategory = normalizeCategory(candidate.category || inferCategoryFromLabel(candidate.title || ''));
      const nextTitle = clipText(candidate.title, 220) || 'Captured credential';
      const nextSecret = String(candidate.secret || '').trim();
      const nextUsername = clipText(candidate.username, 220);
      const nextUrl = clipText(candidate.url, 1000);
      const nextNotes = clipText(candidate.notes, 30_000);

      if (!nextSecret && !nextUsername && !nextUrl && !nextNotes) {
        skipped.push({ reason: 'empty_candidate', title: nextTitle });
        continue;
      }

      const tags = normalizeTags([...(Array.isArray(candidate.tags) ? candidate.tags : []), 'auto', `source:${sourceTag}`]);

      const upsert = upsertRecordByNaturalKey({
        scope: nextScope,
        projectId: nextProjectId,
        category: nextCategory,
        title: nextTitle,
        username: nextUsername,
        secret: nextSecret,
        url: nextUrl,
        notes: nextNotes,
        tags,
      }, actorId);

      if (upsert.action === 'created') created.push(upsert.record);
      else updated.push(upsert.record);
    }

    appendActivity({
      actorId,
      action: 'record.ingest',
      projectId: projectRow?.id || null,
      details: {
        source: sourceTag,
        total: merged.length,
        created: created.length,
        updated: updated.length,
        skipped: skipped.length,
      },
    });

    return {
      project: projectRow ? toProjectDto(projectRow) : null,
      created,
      updated,
      skipped,
      total: merged.length,
    };
  }

  function close() {
    db.close();
  }

  return {
    listProjects,
    createProject,
    updateProject,
    listRecords,
    getRecord,
    createRecord,
    updateRecord,
    upsertRecordByNaturalKey,
    ingestFromText,
    revealRecordSecret,
    listSubscriptions,
    getSummary,
    close,
  };
}

module.exports = {
  createVaultService,
  ALLOWED_SCOPES,
  ALLOWED_CATEGORIES,
};
