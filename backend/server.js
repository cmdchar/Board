const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { createSemanticModule } = require('./server/modules/semantic');
const { createVaultService, createVaultRouter } = require('./server/modules/vault');
const { createEmbeddingsService } = require('./server/modules/embeddings/service');

dotenv.config({ path: path.join(__dirname, '.env') });

function splitAllowedOrigins(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

const app = express();
const server = http.createServer(app);

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
const GITHUB_API_BASE = (process.env.GITHUB_API_BASE || 'https://api.github.com').replace(/\/$/, '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const JIRA_TOKEN = process.env.JIRA_TOKEN || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
const RUNTIME_ENV = String(process.env.NODE_ENV || 'development').toLowerCase();
const JWT_SECRET = String(process.env.JWT_SECRET || '').trim();
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
const JWT_RUNTIME_SECRET = JWT_SECRET;
const BOARDAI_ALLOWED_ORIGINS = splitAllowedOrigins(process.env.BOARDAI_ALLOWED_ORIGINS || '');
const DEFAULT_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const ALLOWED_ORIGINS = [
  ...new Set([
    ...BOARDAI_ALLOWED_ORIGINS,
    ...splitAllowedOrigins(PUBLIC_BASE_URL),
    ...(RUNTIME_ENV === 'production' ? [] : DEFAULT_DEV_ORIGINS),
  ]),
];
if (RUNTIME_ENV === 'production' && !ALLOWED_ORIGINS.length) {
  throw new Error('Missing BOARDAI_ALLOWED_ORIGINS or PUBLIC_BASE_URL in production');
}
function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(String(origin).trim());
}
function corsOriginDelegate(origin, callback) {
  if (isAllowedCorsOrigin(origin)) return callback(null, true);
  return callback(new Error(`CORS origin blocked: ${origin}`));
}
const GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || '';
const GITHUB_OAUTH_CLIENT_SECRET = process.env.GITHUB_OAUTH_CLIENT_SECRET || '';
const GITHUB_OAUTH_REDIRECT_URI = process.env.GITHUB_OAUTH_REDIRECT_URI || '';
const GITHUB_OAUTH_SCOPES = process.env.GITHUB_OAUTH_SCOPES || 'repo read:user';
const GITHUB_TOKEN_VAULT_SECRET = process.env.GITHUB_TOKEN_VAULT_SECRET || JWT_RUNTIME_SECRET;
const io = new Server(server, {
  cors: { origin: corsOriginDelegate, methods: ['GET', 'POST', 'PUT', 'DELETE'] },
});
const UCOLS = ['#ef4444','#3b82f6','#22c55e','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899','#a78bfa','#2dd4bf'];
const BOARD_HISTORY_LIMIT = Math.max(10, Math.min(300, Number(process.env.BOARD_HISTORY_LIMIT) || 80));
const BOARD_HISTORY_MIN_INTERVAL_SEC = Math.max(5, Math.min(3600, Number(process.env.BOARD_HISTORY_MIN_INTERVAL_SEC) || 45));
const AI_RATE_WINDOW_SEC = Math.max(10, Math.min(3600, Number(process.env.AI_RATE_WINDOW_SEC) || 60));
const AI_RATE_MAX = Math.max(1, Math.min(500, Number(process.env.AI_RATE_MAX) || 25));
const AUTH_RATE_WINDOW_SEC = Math.max(10, Math.min(3600, Number(process.env.AUTH_RATE_WINDOW_SEC) || 60));
const AUTH_RATE_MAX = Math.max(1, Math.min(100, Number(process.env.AUTH_RATE_MAX) || 25));
const DEEPSEEK_TIMEOUT_MS = Math.max(5000, Math.min(120000, Number(process.env.DEEPSEEK_TIMEOUT_MS) || 20000));
const AI_TOTAL_DEADLINE_MS = Math.max(5000, Math.min(180000, Number(process.env.AI_TOTAL_DEADLINE_MS) || 25000));
const AI_ALLOW_FALLBACK = String(process.env.AI_ALLOW_FALLBACK || '1') !== '0';
const GITHUB_RETRY_MAX_ATTEMPTS = Math.max(1, Math.min(6, Number(process.env.GITHUB_RETRY_MAX_ATTEMPTS) || 4));
const GITHUB_RETRY_BASE_MS = Math.max(100, Math.min(5000, Number(process.env.GITHUB_RETRY_BASE_MS) || 350));
const GITHUB_IDEMPOTENCY_TTL_SEC = Math.max(60, Math.min(86400, Number(process.env.GITHUB_IDEMPOTENCY_TTL_SEC) || 3600));
const API_TOKEN_DEFAULT_DAYS = Math.max(1, Math.min(365, Number(process.env.API_TOKEN_DEFAULT_DAYS) || 30));
const API_TOKEN_MAX_DAYS = Math.max(API_TOKEN_DEFAULT_DAYS, Math.min(3650, Number(process.env.API_TOKEN_MAX_DAYS) || 365));
const API_TOKEN_MAX_PER_USER = Math.max(1, Math.min(200, Number(process.env.API_TOKEN_MAX_PER_USER) || 25));

// ── JSON File Store (no native deps) ─────────────────────
const dataDir = process.env.BOARDAI_DATA_DIR
  ? path.resolve(process.env.BOARDAI_DATA_DIR)
  : path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbFile = path.join(dataDir, 'boards.json');
const usersFile = path.join(dataDir, 'users.json');
const auditFile = path.join(dataDir, 'audit.json');
const templatesFile = path.join(dataDir, 'templates.json');
const semantic = createSemanticModule({
  dataDir,
  logger: console,
  debounceMs: Math.max(300, Math.min(5000, Number(process.env.SEMANTIC_REBUILD_DEBOUNCE_MS) || 1200)),
});
const vault = createVaultService({
  dataDir,
  logger: console,
  secretKey: process.env.VAULT_SECRET_KEY || JWT_RUNTIME_SECRET,
});
const embeddings = createEmbeddingsService({
  dataDir,
  logger: console,
});
const AUDIT_MAX_EVENTS = Math.max(1000, Math.min(200000, Number(process.env.AUDIT_MAX_EVENTS) || 20000));
const authRateBuckets = new Map();
const aiRateBuckets = new Map();
const aiMetrics = {
  requests: 0,
  success: 0,
  errors: 0,
  fallback: 0,
  repaired: 0,
  rate_limited: 0,
  last_error: '',
  last_error_at: 0,
  last_fallback_reason: '',
  last_model: '',
  last_usage: null,
  last_latency_ms: 0,
};
const TEMPLATE_CATEGORIES = [
  'Product Management',
  'Startup Planning',
  'Marketing',
  'Engineering',
  'Brainstorming',
  'Meetings',
];
let dbCache = {};
let dbPersistChain = Promise.resolve();

function loadBoardsFromDisk() {
  try {
    const raw = fs.readFileSync(dbFile, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch {
    return {};
  }
}

function scheduleDBPersist() {
  const snapshot = JSON.stringify(dbCache, null, 2);
  dbPersistChain = dbPersistChain
    .catch(() => {})
    .then(() => fs.promises.writeFile(dbFile, snapshot, 'utf8'))
    .catch((err) => {
      console.error('[db] async persist failed', err?.message || err);
    });
}

dbCache = loadBoardsFromDisk();

function readDB() {
  return dbCache;
}

function writeDB(data) {
  dbCache = (data && typeof data === 'object') ? data : {};
  scheduleDBPersist();
}

function readUsers() {
  try { return JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch { return {}; }
}

function writeUsers(data) {
  fs.writeFileSync(usersFile, JSON.stringify(data, null, 2));
}

function readAudit() {
  try {
    const parsed = JSON.parse(fs.readFileSync(auditFile, 'utf8'));
    if (Array.isArray(parsed?.events)) return parsed;
    return { events: [] };
  } catch {
    return { events: [] };
  }
}

function writeAudit(data) {
  fs.writeFileSync(auditFile, JSON.stringify(data, null, 2));
}

function now() { return Math.floor(Date.now() / 1000); }

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTemplateData(data) {
  const boardData = normalizeBoardData(data);
  return {
    nodes: Array.isArray(boardData.nodes) ? deepClone(boardData.nodes) : [],
    arrows: Array.isArray(boardData.arrows) ? deepClone(boardData.arrows) : [],
    comments: [],
    votes: {},
  };
}

function defaultTemplateStore() {
  const t = now();
  const makeSeed = ({ id, name, description, category, tags, data, featured = false, usage = 0 }) => ({
    id,
    name,
    description,
    category,
    tags,
    visibility: 'public',
    creator: { userId: 'system', name: 'BoardAI Team', color: '#f59e0b' },
    featured,
    usage_count: usage,
    created_at: t,
    updated_at: t,
    published_at: t,
    latest_version: 1,
    versions: [{
      id: `${id}_v1`,
      version: 1,
      created_at: t,
      note: 'Initial template',
      data: normalizeTemplateData(data),
    }],
    bookmarks: [],
    ratings: {},
  });
  const seedTemplates = {};
  const marketingData = {
    nodes: [
      { id: 'm1', type: 'frame', x: 80, y: 80, w: 880, h: 560, text: 'Marketing Sprint', color: 'transparent', borderColor: '#334155' },
      { id: 'm2', type: 'shape', shapeType: 'rect', x: 150, y: 180, w: 180, h: 84, text: 'Audience', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'm3', type: 'shape', shapeType: 'rect', x: 400, y: 180, w: 180, h: 84, text: 'Channels', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'm4', type: 'shape', shapeType: 'rect', x: 650, y: 180, w: 180, h: 84, text: 'Experiments', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'm5', type: 'sticky', x: 210, y: 330, w: 160, h: 120, text: 'ICP notes', color: '#fef9c3', textColor: '#713f12' },
      { id: 'm6', type: 'sticky', x: 470, y: 330, w: 160, h: 120, text: 'Content + paid', color: '#dbeafe', textColor: '#1e3a8a' },
      { id: 'm7', type: 'sticky', x: 720, y: 330, w: 160, h: 120, text: 'A/B ideas', color: '#dcfce7', textColor: '#14532d' },
    ],
    arrows: [
      { id: 'ma1', fromId: 'm2', toId: 'm3', label: 'feeds' },
      { id: 'ma2', fromId: 'm3', toId: 'm4', label: 'drives' },
    ],
  };
  const productData = {
    nodes: [
      { id: 'p1', type: 'milestone', x: 140, y: 120, w: 300, h: 156, text: 'Discovery', executionMilestone: 'Discovery', executionMilestoneId: 'ms1', executionDueDate: 'TBD', color: '#111827', textColor: '#e5e7eb', borderColor: '#6366f1' },
      { id: 'p2', type: 'milestone', x: 520, y: 120, w: 300, h: 156, text: 'Build', executionMilestone: 'Build', executionMilestoneId: 'ms2', executionDueDate: 'TBD', color: '#111827', textColor: '#e5e7eb', borderColor: '#6366f1' },
      { id: 'p3', type: 'task', x: 160, y: 320, w: 240, h: 140, text: 'Task\nOwner: PM', executionTitle: 'Task', executionOwner: 'PM', executionStatus: 'Todo', executionPriority: 'P2', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'p4', type: 'task', x: 540, y: 320, w: 240, h: 140, text: 'Task\nOwner: Eng', executionTitle: 'Task', executionOwner: 'Eng', executionStatus: 'Todo', executionPriority: 'P1', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'p5', type: 'decision', x: 890, y: 240, w: 260, h: 150, text: 'Decision\nContext...', executionDecision: 'Decision', executionOwner: 'Lead', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#38bdf8' },
    ],
    arrows: [
      { id: 'pa1', fromId: 'p1', toId: 'p3', label: 'related', depType: 'related' },
      { id: 'pa2', fromId: 'p2', toId: 'p4', label: 'related', depType: 'related' },
      { id: 'pa3', fromId: 'p3', toId: 'p4', label: 'depends on', depType: 'depends_on' },
    ],
  };
  const engineeringData = {
    nodes: [
      { id: 'e1', type: 'shape', shapeType: 'cylinder', x: 160, y: 160, w: 170, h: 110, text: 'DB', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'e2', type: 'shape', shapeType: 'rect', x: 430, y: 160, w: 190, h: 100, text: 'API Service', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'e3', type: 'shape', shapeType: 'cloud', x: 740, y: 150, w: 200, h: 120, text: 'Web App', color: '#0f172a', textColor: '#e2e8f0', borderColor: '#334155' },
      { id: 'e4', type: 'sticky', x: 430, y: 320, w: 180, h: 120, text: 'Observability', color: '#fef9c3', textColor: '#713f12' },
    ],
    arrows: [
      { id: 'ea1', fromId: 'e1', toId: 'e2', label: 'read/write' },
      { id: 'ea2', fromId: 'e2', toId: 'e3', label: 'serves' },
      { id: 'ea3', fromId: 'e3', toId: 'e4', label: 'alerts' },
    ],
  };
  const seeds = [
    makeSeed({
      id: 'seed_product_execution',
      name: 'Product Execution Plan',
      description: 'Milestones + tasks + decisions ready for execution.',
      category: 'Product Management',
      tags: ['execution', 'roadmap', 'delivery'],
      data: productData,
      featured: true,
      usage: 124,
    }),
    makeSeed({
      id: 'seed_marketing_sprint',
      name: 'Marketing Sprint Board',
      description: 'Audience, channels and experiments in one board.',
      category: 'Marketing',
      tags: ['growth', 'campaign', 'sprint'],
      data: marketingData,
      featured: true,
      usage: 91,
    }),
    makeSeed({
      id: 'seed_engineering_architecture',
      name: 'Engineering Architecture Map',
      description: 'Quick architecture canvas for engineering teams.',
      category: 'Engineering',
      tags: ['architecture', 'infra', 'engineering'],
      data: engineeringData,
      featured: false,
      usage: 68,
    }),
  ];
  for (const tpl of seeds) seedTemplates[tpl.id] = tpl;
  return { templates: seedTemplates };
}

function readTemplatesStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(templatesFile, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (!parsed.templates || typeof parsed.templates !== 'object') parsed.templates = {};
      return parsed;
    }
  } catch {}
  return defaultTemplateStore();
}

function writeTemplatesStore(data) {
  fs.writeFileSync(templatesFile, JSON.stringify(data, null, 2));
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function defaultBoardData() {
  return { nodes: [], arrows: [], comments: [], votes: {} };
}

function normalizeBoardData(data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  return defaultBoardData();
}

function hashBoardData(data) {
  const payload = JSON.stringify(normalizeBoardData(data));
  return crypto.createHash('sha256').update(payload).digest('hex');
}

const BOARD_ROLES = ['owner', 'editor', 'viewer'];

function normalizeBoardRole(role) {
  const v = String(role || '').toLowerCase().trim();
  return BOARD_ROLES.includes(v) ? v : null;
}

function sanitizeBoardMember(raw, ownerId) {
  if (!raw || typeof raw !== 'object') return null;
  const userId = typeof raw.userId === 'string' ? raw.userId : '';
  if (!userId || userId === ownerId) return null;

  const role = normalizeBoardRole(raw.role);
  if (!role || role === 'owner') return null;

  return {
    userId,
    role,
    added_at: Number.isFinite(raw.added_at) ? raw.added_at : 0,
    added_by: typeof raw.added_by === 'string' ? raw.added_by : null,
  };
}

function ensureBoardMembersShape(board) {
  if (!Array.isArray(board.members)) board.members = [];

  const seen = new Set();
  const next = [];
  for (const raw of board.members) {
    const member = sanitizeBoardMember(raw, board.userId);
    if (!member) continue;
    if (seen.has(member.userId)) continue;
    seen.add(member.userId);
    next.push(member);
  }
  board.members = next;
  return board;
}

function boardRoleForUser(board, user) {
  if (!board?.userId) return user?.id ? 'editor' : 'viewer'; // legacy public boards
  if (!user?.id) return null;
  if (board.userId === user.id) return 'owner';

  ensureBoardMembersShape(board);
  const member = board.members.find(m => m.userId === user.id);
  return member ? member.role : null;
}

function canReadBoard(board, user) {
  return Boolean(boardRoleForUser(board, user));
}

function canEditBoard(board, user) {
  const role = boardRoleForUser(board, user);
  return role === 'owner' || role === 'editor';
}

function canManageBoard(board, user) {
  return boardRoleForUser(board, user) === 'owner';
}

function boardMembersForClient(board) {
  ensureBoardMembersShape(board);
  const users = readUsers();
  const out = [];

  if (board.userId) {
    const owner = users[board.userId];
    out.push({
      userId: board.userId,
      role: 'owner',
      email: owner?.email || null,
      name: owner?.name || null,
      color: owner?.color || null,
      added_at: Number(board.created_at) || 0,
      added_by: board.userId,
    });
  }

  for (const member of board.members) {
    const u = users[member.userId];
    out.push({
      userId: member.userId,
      role: member.role,
      email: u?.email || null,
      name: u?.name || null,
      color: u?.color || null,
      added_at: Number(member.added_at) || 0,
      added_by: member.added_by || null,
    });
  }
  return out;
}

function appendAuditEvent({ boardId, actorId = null, action, details = {} }) {
  if (!boardId || !action) return null;
  const store = readAudit();
  const event = {
    id: uuidv4(),
    ts: now(),
    boardId,
    actorId,
    action,
    details: details && typeof details === 'object' ? details : {},
  };
  store.events.push(event);
  if (store.events.length > AUDIT_MAX_EVENTS) {
    store.events = store.events.slice(-AUDIT_MAX_EVENTS);
  }
  writeAudit(store);
  return event;
}

function listBoardAuditEvents(boardId, options = {}) {
  const n = Math.max(1, Math.min(500, Number(options.limit) || 100));
  const actionFilter = Array.isArray(options.actions) ? options.actions.filter(Boolean) : [];
  const actorFilter = String(options.actorId || '').trim();
  const minTs = Number(options.minTs) || 0;
  const store = readAudit();
  const rows = store.events
    .filter(e => {
      if (e.boardId !== boardId) return false;
      if (actionFilter.length && !actionFilter.includes(String(e.action || ''))) return false;
      if (actorFilter && String(e.actorId || '') !== actorFilter) return false;
      if (minTs && Number(e.ts || 0) < minTs) return false;
      return true;
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, n);
  return rows;
}

function publicActor(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    id: user.id || null,
    name: user.name || null,
    email: user.email || null,
    color: user.color || null,
  };
}

function enrichAuditEvents(events) {
  const users = readUsers();
  return events.map(e => ({
    ...e,
    actor: e.actorId && users[e.actorId] ? publicActor(users[e.actorId]) : null,
  }));
}

function ensureBoardHistoryShape(board) {
  if (!Array.isArray(board.versions)) board.versions = [];
  if (typeof board.latest_version_hash !== 'string') board.latest_version_hash = '';
  if (!Number.isFinite(board.last_version_at)) board.last_version_at = 0;
  return board;
}

function ensureBoardRevisionShape(board) {
  if (!board || typeof board !== 'object') return board;
  const current = Number(board.revision);
  board.revision = Number.isFinite(current) && current >= 1 ? Math.floor(current) : 1;
  return board;
}

function parseExpectedRevision(req) {
  const fromBody = Number(req.body?.revision);
  if (Number.isFinite(fromBody)) return Math.floor(fromBody);
  const headerRaw = req.headers['x-board-revision'] ?? req.headers['if-match-revision'] ?? '';
  const fromHeader = Number(headerRaw);
  if (Number.isFinite(fromHeader)) return Math.floor(fromHeader);
  return null;
}

function summarizeVersion(version) {
  return {
    id: version.id,
    created_at: version.created_at,
    actorId: version.actorId || null,
    reason: version.reason || 'save',
    hash: version.hash || '',
    size: Number(version.size) || 0,
  };
}

function toBoardClient(board, user = null) {
  ensureBoardRevisionShape(board);
  const out = { ...board };
  delete out.versions;
  delete out.latest_version_hash;
  delete out.last_version_at;
  delete out.members;
  out.access_role = boardRoleForUser(board, user);
  return out;
}

function captureBoardVersion(board, { actorId = null, reason = 'save', force = false } = {}) {
  ensureBoardHistoryShape(board);
  const t = now();
  const data = normalizeBoardData(board.data);
  const hash = hashBoardData(data);
  const last = board.versions[board.versions.length - 1] || null;

  if (!force) {
    if (hash === board.latest_version_hash) return false;
    const isFreshCreateSnapshot = last && last.reason === 'create' && reason === 'save';
    if (last && !isFreshCreateSnapshot && (t - (last.created_at || 0)) < BOARD_HISTORY_MIN_INTERVAL_SEC) {
      const snapshot = JSON.stringify(data);
      last.created_at = t;
      last.actorId = actorId;
      last.reason = reason;
      last.hash = hash;
      last.size = Buffer.byteLength(snapshot, 'utf8');
      last.data = data;
      board.latest_version_hash = hash;
      board.last_version_at = t;
      return true;
    }
  }

  const snapshot = JSON.stringify(data);
  const version = {
    id: uuidv4(),
    created_at: t,
    actorId,
    reason,
    hash,
    size: Buffer.byteLength(snapshot, 'utf8'),
    data,
  };

  board.versions.push(version);
  if (board.versions.length > BOARD_HISTORY_LIMIT) {
    board.versions = board.versions.slice(-BOARD_HISTORY_LIMIT);
  }
  board.latest_version_hash = hash;
  board.last_version_at = t;
  return true;
}

function sanitizeTemplateCategory(value) {
  const txt = String(value || '').trim();
  if (!txt) return TEMPLATE_CATEGORIES[0];
  const exact = TEMPLATE_CATEGORIES.find(c => c.toLowerCase() === txt.toLowerCase());
  return exact || txt.slice(0, 64);
}

function sanitizeTemplateTags(value) {
  if (Array.isArray(value)) {
    return value.map(v => String(v || '').trim()).filter(Boolean).slice(0, 16);
  }
  const txt = String(value || '').trim();
  if (!txt) return [];
  return txt.split(/[;,|]/).map(v => v.trim()).filter(Boolean).slice(0, 16);
}

function sanitizeTemplateVisibility(value) {
  return String(value || '').toLowerCase() === 'public' ? 'public' : 'private';
}

function ensureTemplateShape(template) {
  if (!template || typeof template !== 'object') return null;
  if (!template.id) template.id = uuidv4();
  template.name = String(template.name || 'Untitled Template').trim().slice(0, 120) || 'Untitled Template';
  template.description = String(template.description || '').trim().slice(0, 600);
  template.category = sanitizeTemplateCategory(template.category);
  template.tags = sanitizeTemplateTags(template.tags);
  template.visibility = sanitizeTemplateVisibility(template.visibility);
  template.creator = template.creator && typeof template.creator === 'object' ? template.creator : {};
  template.creator.userId = String(template.creator.userId || '').trim() || null;
  template.creator.name = String(template.creator.name || 'Unknown').trim().slice(0, 80) || 'Unknown';
  template.creator.color = String(template.creator.color || '#94a3b8').trim() || '#94a3b8';
  template.usage_count = Math.max(0, Number(template.usage_count) || 0);
  template.created_at = Number(template.created_at) || now();
  template.updated_at = Number(template.updated_at) || template.created_at;
  template.published_at = Number(template.published_at) || 0;
  template.featured = Boolean(template.featured);
  template.latest_version = Math.max(1, Number(template.latest_version) || 1);
  template.bookmarks = Array.isArray(template.bookmarks) ? template.bookmarks.filter(Boolean).map(v => String(v)) : [];
  template.ratings = template.ratings && typeof template.ratings === 'object' ? template.ratings : {};
  template.versions = Array.isArray(template.versions) ? template.versions : [];
  template.versions = template.versions
    .map(v => ({
      id: String(v?.id || uuidv4()),
      version: Math.max(1, Number(v?.version) || 1),
      created_at: Number(v?.created_at) || now(),
      note: String(v?.note || '').slice(0, 240),
      data: normalizeTemplateData(v?.data || {}),
    }))
    .sort((a, b) => a.version - b.version);
  if (!template.versions.length) {
    template.versions.push({
      id: `${template.id}_v1`,
      version: 1,
      created_at: template.created_at,
      note: 'Initial version',
      data: normalizeTemplateData({}),
    });
  }
  template.latest_version = template.versions[template.versions.length - 1].version;
  return template;
}

function ensureTemplateStoreShape(store) {
  const next = store && typeof store === 'object' && !Array.isArray(store) ? store : defaultTemplateStore();
  if (!next.templates || typeof next.templates !== 'object' || Array.isArray(next.templates)) {
    next.templates = {};
  }
  const normalized = {};
  for (const [id, raw] of Object.entries(next.templates)) {
    const tpl = ensureTemplateShape({ ...(raw || {}), id: raw?.id || id });
    if (!tpl) continue;
    normalized[tpl.id] = tpl;
  }
  next.templates = normalized;
  return next;
}

function templateRatingStats(template) {
  const ratings = template?.ratings && typeof template.ratings === 'object' ? Object.values(template.ratings) : [];
  const clean = ratings
    .map(v => Number(v))
    .filter(v => Number.isFinite(v) && v >= 1 && v <= 5);
  const count = clean.length;
  const avg = count ? clean.reduce((sum, cur) => sum + cur, 0) / count : 0;
  return {
    rating_avg: Number(avg.toFixed(2)),
    rating_count: count,
  };
}

function canReadTemplate(template, user) {
  if (!template) return false;
  if (template.visibility === 'public') return true;
  return Boolean(user?.id && template.creator?.userId && template.creator.userId === user.id);
}

function canEditTemplate(template, user) {
  if (!template || !user?.id) return false;
  return template.creator?.userId === user.id;
}

function templateSummaryForClient(template, user = null) {
  const stats = templateRatingStats(template);
  const bookmarks = Array.isArray(template.bookmarks) ? template.bookmarks : [];
  const userId = user?.id ? String(user.id) : '';
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    tags: template.tags || [],
    visibility: template.visibility,
    featured: Boolean(template.featured),
    usage_count: Math.max(0, Number(template.usage_count) || 0),
    creator: template.creator || { userId: null, name: 'Unknown', color: '#94a3b8' },
    latest_version: template.latest_version || 1,
    versions_count: Array.isArray(template.versions) ? template.versions.length : 0,
    created_at: template.created_at || 0,
    updated_at: template.updated_at || 0,
    published_at: template.published_at || 0,
    bookmark_count: bookmarks.length,
    bookmarked: Boolean(userId && bookmarks.includes(userId)),
    my_rating: userId ? Number(template?.ratings?.[userId] || 0) || 0 : 0,
    ...stats,
  };
}

function resolveTemplateVersion(template, requestedVersion = null) {
  const versions = Array.isArray(template?.versions) ? template.versions : [];
  if (!versions.length) return null;
  if (requestedVersion === null || requestedVersion === undefined || requestedVersion === '') {
    return versions[versions.length - 1];
  }
  const want = Number(requestedVersion);
  if (!Number.isFinite(want)) return versions[versions.length - 1];
  const exact = versions.find(v => Number(v.version) === want);
  return exact || versions[versions.length - 1];
}

function buildTemplatePreviewPayload(data) {
  const source = normalizeTemplateData(data);
  const nodes = Array.isArray(source.nodes) ? source.nodes : [];
  const arrows = Array.isArray(source.arrows) ? source.arrows : [];
  const sampleNodes = nodes.slice(0, 80).map(n => ({
    id: String(n.id || ''),
    type: String(n.type || 'shape'),
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    w: Number(n.w) || 120,
    h: Number(n.h) || 80,
    text: String(n.text || '').slice(0, 80),
    color: String(n.color || '#1f2937'),
    borderColor: String(n.borderColor || '#334155'),
  }));
  const sampleArrows = arrows.slice(0, 120).map(a => ({
    id: String(a.id || ''),
    fromId: String(a.fromId || a?.from?.entityId || ''),
    toId: String(a.toId || a?.to?.entityId || ''),
    label: String(a.label || '').slice(0, 80),
  }));
  const typeCounts = {};
  for (const node of nodes) {
    const key = String(node?.type || 'unknown');
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  }
  return {
    nodes: sampleNodes,
    arrows: sampleArrows,
    stats: {
      node_count: nodes.length,
      arrow_count: arrows.length,
      type_counts: typeCounts,
    },
  };
}

// ── Auth Helpers ─────────────────────────────────────────
const PASSWORD_SCRYPT_KEYLEN = 64;
const PASSWORD_BCRYPT_ROUNDS = Math.max(10, Math.min(14, Number(process.env.BCRYPT_ROUNDS) || 12));

function hashPasswordLegacy(password, salt) {
  return crypto.createHash('sha256').update(String(password) + String(salt)).digest('hex');
}

function hashPassword(password) {
  return bcrypt.hashSync(String(password), PASSWORD_BCRYPT_ROUNDS);
}

function verifyPassword(password, salt, storedHash) {
  const raw = String(storedHash || '');
  if (/^\$2[aby]\$/.test(raw)) {
    return bcrypt.compareSync(String(password), raw);
  }
  if (raw.startsWith('scrypt$')) {
    const expectedHex = raw.slice(7);
    if (!/^[0-9a-f]+$/i.test(expectedHex) || (expectedHex.length % 2) !== 0) return false;
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(
      crypto.scryptSync(String(password), String(salt), PASSWORD_SCRYPT_KEYLEN).toString('hex'),
      'hex',
    );
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  }

  const expectedLegacy = Buffer.from(hashPasswordLegacy(password, salt), 'hex');
  const actualLegacy = Buffer.from(raw, 'hex');
  if (!expectedLegacy.length || expectedLegacy.length !== actualLegacy.length) return false;
  return crypto.timingSafeEqual(expectedLegacy, actualLegacy);
}

function passwordNeedsUpgrade(storedHash) {
  return !/^\$2[aby]\$/.test(String(storedHash || ''));
}

function randomSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_RUNTIME_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto.createHmac('sha256', JWT_RUNTIME_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch { return null; }
}

function normalizeApiTokenEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = clipText(raw.id, 80);
  const jti = clipText(raw.jti, 120);
  if (!id || !jti) return null;
  const name = clipText(raw.name, 80) || 'api-token';
  const createdAt = Number(raw.created_at) || 0;
  const expiresAt = Number(raw.expires_at) || 0;
  const lastUsedAt = Number(raw.last_used_at) || 0;
  const revokedAt = Number(raw.revoked_at) || 0;
  return {
    id,
    jti,
    name,
    created_at: createdAt,
    expires_at: expiresAt,
    last_used_at: lastUsedAt || null,
    revoked_at: revokedAt || null,
  };
}

function normalizeUserApiTokens(user) {
  if (!user || typeof user !== 'object') return [];
  const source = Array.isArray(user.api_tokens) ? user.api_tokens : [];
  return source
    .map(normalizeApiTokenEntry)
    .filter(Boolean);
}

function sanitizeApiTokensForClient(user) {
  const t = now();
  return normalizeUserApiTokens(user)
    .sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      createdAt: entry.created_at || null,
      expiresAt: entry.expires_at || null,
      lastUsedAt: entry.last_used_at || null,
      revokedAt: entry.revoked_at || null,
      status: entry.revoked_at ? 'revoked' : ((entry.expires_at && entry.expires_at < t) ? 'expired' : 'active'),
    }));
}

function persistUserApiTokens(userId, tokens) {
  const users = readUsers();
  const user = users[userId];
  if (!user) return null;
  users[userId] = {
    ...user,
    api_tokens: tokens,
  };
  writeUsers(users);
  return users[userId];
}

function findActiveApiToken(user, jti) {
  const t = now();
  return normalizeUserApiTokens(user).find((entry) => (
    entry.jti === jti
    && !entry.revoked_at
    && (!entry.expires_at || entry.expires_at >= t)
  )) || null;
}

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const tokenRaw = auth.slice(7);
  const payload = verifyToken(tokenRaw);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  if (payload.token_type === 'api') {
    const users = readUsers();
    const user = users[payload.id];
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    const activeToken = findActiveApiToken(user, payload.jti);
    if (!activeToken) {
      return res.status(401).json({ error: 'Invalid or revoked API token' });
    }

    const shouldTouchLastUsed = !activeToken.last_used_at || (now() - Number(activeToken.last_used_at) >= 300);
    if (shouldTouchLastUsed) {
      const updated = normalizeUserApiTokens(user).map((entry) => (
        entry.id === activeToken.id
          ? { ...entry, last_used_at: now() }
          : entry
      ));
      persistUserApiTokens(user.id, updated);
    }
  }

  req.user = payload;
  next();
}

function optAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload) req.user = payload;
  }
  next();
}

// ── JSON helpers ──────────────────────────────────────────
function clampMaxTokens(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1000;
  return Math.max(64, Math.min(4000, Math.floor(n)));
}

function stripCodeFences(text) {
  return String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractFirstBalancedObject(text) {
  const src = String(text || '');
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === '}') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) return src.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonFromModelText(text) {
  const clean = stripCodeFences(text);
  const candidates = [clean];
  const balanced = extractFirstBalancedObject(clean);
  if (balanced && balanced !== clean) candidates.push(balanced);

  for (const candidate of candidates) {
    const normalized = String(candidate || '')
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      .replace(/,\s*([}\]])/g, '$1')
      .trim();

    for (const attempt of [candidate, normalized]) {
      try {
        const parsed = JSON.parse(attempt);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // try next candidate
      }
    }
  }
  return null;
}

async function deepseekChatCompletion(messages, maxTokens, options = {}) {
  const jsonMode = options.jsonMode !== false;
  const temperature = options.temperature ?? 0;
  const timeoutMs = Math.max(3000, Math.min(DEEPSEEK_TIMEOUT_MS, Number(options.timeoutMs) || DEEPSEEK_TIMEOUT_MS));
  const body = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature,
    max_tokens: clampMaxTokens(maxTokens),
    stream: false,
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    const raw = await response.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = {};
    }

    if (!response.ok) {
      const detail = data?.error?.message || data?.message || raw || `DeepSeek API error (${response.status})`;
      return { ok: false, status: response.status, detail, data, raw };
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
      return { ok: false, status: 502, detail: 'DeepSeek returned an empty response', data, raw };
    }

    return { ok: true, text, data, status: response.status };
  } catch (error) {
    if (String(error?.name || '').toLowerCase() === 'aborterror') {
      return {
        ok: false,
        status: 502,
        detail: `DeepSeek request timed out after ${timeoutMs}ms`,
        data: null,
        raw: '',
      };
    }
    return { ok: false, status: 502, detail: error.message || 'DeepSeek request failed', data: null, raw: '' };
  } finally {
    clearTimeout(timeout);
  }
}

function supportsJsonModeError(detail) {
  return /response_format|json_object|unsupported|not support|invalid.*response_format/i.test(String(detail || ''));
}

function isAiTimeoutResult(result) {
  if (!result || typeof result !== 'object') return false;
  if (Number(result.status) === 504) return true;
  return /timed out|timeout/i.test(String(result.detail || ''));
}

function aiDeadlineRemaining(startedAtMs) {
  return AI_TOTAL_DEADLINE_MS - (Date.now() - Number(startedAtMs || Date.now()));
}

function isoDateFromNow(days) {
  const day = Number.isFinite(Number(days)) ? Number(days) : 0;
  return new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function normalizeAiFallbackTopic(userPrompt) {
  const compact = String(userPrompt || '')
    .replace(/\s+/g, ' ')
    .replace(/[{}[\]<>]/g, ' ')
    .trim();
  if (!compact) return 'Execution Plan';
  const cleaned = compact
    .replace(/^context source \(prd\/repo\/issues\)\s*:/i, '')
    .replace(/^request\s*:/i, '')
    .replace(/^prompt\s*:/i, '')
    .trim();
  const candidate = (cleaned || compact).replace(/["'`]/g, '').trim();
  return candidate.slice(0, 72) || 'Execution Plan';
}

function inferAiFallbackTemplateId(input) {
  const text = String(input || '').toLowerCase();
  if (!text) return 'custom';
  if (/cloud|infra|architecture|kubernetes|devops|microservice|api/.test(text)) return 'cloudInfra';
  if (/roadmap|milestone|release|launch|quarter|q[1-4]/.test(text)) return 'roadmap';
  if (/journey|onboarding|customer|funnel/.test(text)) return 'journey';
  if (/swot|strength|weakness|opportunit|threat/.test(text)) return 'swot';
  if (/kanban|sprint|backlog|task|todo/.test(text)) return 'kanban';
  if (/okr|objective|key result|kpi/.test(text)) return 'okr';
  if (/table|spreadsheet|csv|dataset|sheet/.test(text)) return 'table';
  if (/flow|process|workflow|decision tree/.test(text)) return 'flowchart';
  if (/mind map|brainstorm|concept map/.test(text)) return 'mindmap';
  if (/retro|retrospective|postmortem/.test(text)) return 'retro';
  return 'custom';
}

function inferAiFallbackCategory(input) {
  const text = String(input || '').toLowerCase();
  if (/marketing|campaign|growth|ads|seo|social/.test(text)) return 'Marketing';
  if (/engineering|infra|architecture|backend|frontend|api|platform|devops/.test(text)) return 'Engineering';
  if (/meeting|agenda|retrospective|standup|workshop/.test(text)) return 'Meetings';
  if (/startup|business model|go to market|go-to-market|fundraising/.test(text)) return 'Startup Planning';
  if (/brainstorm|ideas|creative/.test(text)) return 'Brainstorming';
  return 'Product Management';
}

function buildAiFallbackPayload(systemPrompt, userPrompt, reason) {
  const topic = normalizeAiFallbackTopic(userPrompt);
  const textHint = `${systemPrompt || ''}\n${userPrompt || ''}`;
  const templateId = inferAiFallbackTemplateId(textHint);
  const category = inferAiFallbackCategory(textHint);
  const nowIso = new Date().toISOString();
  const summary = `Fallback generated for "${topic}" while AI provider was unavailable.`;
  const message = `Provider unavailable. A deterministic starter structure was generated.`;

  const nodes = [
    {
      id: 'n1',
      type: 'shape',
      shapeType: 'rect',
      x: -380,
      y: -120,
      w: 220,
      h: 96,
      text: topic,
      color: '#0f172a',
      textColor: '#e2e8f0',
      borderColor: '#334155',
      fontSize: 14,
      fontWeight: '700',
    },
    {
      id: 'n2',
      type: 'sticky',
      x: -100,
      y: -170,
      w: 176,
      h: 126,
      text: 'Goals\nDefine outcomes and constraints',
      color: '#fef9c3',
      textColor: '#713f12',
      borderColor: '#f59e0b',
    },
    {
      id: 'n3',
      type: 'sticky',
      x: 130,
      y: -170,
      w: 176,
      h: 126,
      text: 'Execution\nBreak into tasks and owners',
      color: '#dbeafe',
      textColor: '#1e3a8a',
      borderColor: '#60a5fa',
    },
    {
      id: 'n4',
      type: 'sticky',
      x: -100,
      y: 10,
      w: 176,
      h: 126,
      text: 'Risks\nList blockers and mitigations',
      color: '#fee2e2',
      textColor: '#7f1d1d',
      borderColor: '#f87171',
    },
    {
      id: 'n5',
      type: 'shape',
      shapeType: 'rect',
      x: 130,
      y: 10,
      w: 196,
      h: 96,
      text: 'Next checkpoint',
      color: '#111827',
      textColor: '#e5e7eb',
      borderColor: '#6366f1',
      fontSize: 12,
      fontWeight: '600',
    },
  ];

  const arrows = [
    { id: 'a1', fromId: 'n1', toId: 'n2', from: 'n1', to: 'n2', label: 'scope' },
    { id: 'a2', fromId: 'n2', toId: 'n3', from: 'n2', to: 'n3', label: 'plan' },
    { id: 'a3', fromId: 'n3', toId: 'n5', from: 'n3', to: 'n5', label: 'execute' },
    { id: 'a4', fromId: 'n4', toId: 'n5', from: 'n4', to: 'n5', label: 'de-risk' },
  ];

  const milestones = [
    { id: 'm1', title: 'Discovery', targetDate: isoDateFromNow(7), dueDate: isoDateFromNow(7), status: 'planned' },
    { id: 'm2', title: 'Delivery', targetDate: isoDateFromNow(21), dueDate: isoDateFromNow(21), status: 'planned' },
  ];

  const tasks = [
    {
      id: 't1',
      title: 'Define scope',
      description: `Clarify scope for: ${topic}`,
      stage: 'now',
      owner: 'TBD',
      priority: 'P1',
      status: 'todo',
      dueDate: isoDateFromNow(3),
      milestoneId: 'm1',
      milestone: 'Discovery',
      dependsOn: [],
    },
    {
      id: 't2',
      title: 'Create execution breakdown',
      description: 'Split work into trackable tasks',
      stage: 'next',
      owner: 'TBD',
      priority: 'P2',
      status: 'todo',
      dueDate: isoDateFromNow(6),
      milestoneId: 'm1',
      milestone: 'Discovery',
      dependsOn: ['t1'],
    },
    {
      id: 't3',
      title: 'Assign owners and deadlines',
      description: 'Set ownership and timing',
      stage: 'next',
      owner: 'TBD',
      priority: 'P2',
      status: 'todo',
      dueDate: isoDateFromNow(10),
      milestoneId: 'm2',
      milestone: 'Delivery',
      dependsOn: ['t2'],
    },
    {
      id: 't4',
      title: 'Run review checkpoint',
      description: 'Validate progress and unblock risks',
      stage: 'later',
      owner: 'TBD',
      priority: 'P2',
      status: 'todo',
      dueDate: isoDateFromNow(14),
      milestoneId: 'm2',
      milestone: 'Delivery',
      dependsOn: ['t3'],
    },
  ];

  const dependencies = [
    { fromTaskId: 't1', toTaskId: 't2', type: 'depends_on' },
    { fromTaskId: 't2', toTaskId: 't3', type: 'depends_on' },
    { fromTaskId: 't3', toTaskId: 't4', type: 'depends_on' },
  ];

  const decisions = [
    {
      id: 'd1',
      decision: 'Use fallback starter plan',
      date: isoDateFromNow(0),
      owner: 'TBD',
      context: topic,
      outcome: 'Continue work while external AI recovers',
    },
  ];

  const risks = [
    {
      id: 'r1',
      title: 'External AI provider instability',
      impact: 'high',
      mitigation: 'Use fallback plan and retry provider later',
      owner: 'TBD',
      status: 'open',
      taskIds: ['t1', 't2'],
    },
  ];

  const ideas = [
    `Clarify success metrics for ${topic}`,
    'Map dependencies across teams',
    'Define review cadence and owners',
    'List top 3 blockers and mitigations',
  ];

  const suggestionList = [
    {
      id: 's1',
      label: 'Generate flow',
      reason: 'Convert fallback structure into flow',
      prompt: `Create a flow for ${topic}`,
      intent: 'flow_generation',
    },
    {
      id: 's2',
      label: 'Expand ideas',
      reason: 'Add more actionable branches',
      prompt: `Expand ideas for ${topic}`,
      intent: 'idea_expansion',
    },
    {
      id: 's3',
      label: 'Create execution plan',
      reason: 'Turn this into milestones and tasks',
      prompt: `Create execution plan for ${topic}`,
      intent: 'board_generation',
    },
  ];

  return {
    fallback: true,
    fallbackReason: String(reason || 'provider_unavailable').slice(0, 240),
    generatedAt: nowIso,
    title: `${topic} - Fallback`,
    message,
    summary,
    nodes,
    arrows,
    template: {
      name: `${topic} Template`,
      description: summary,
      category,
      tags: ['fallback', 'starter', 'ai'],
    },
    recommendedTemplate: templateId,
    alternatives: ['mindmap', 'flowchart', 'kanban'].filter(v => v !== templateId),
    reason: summary,
    complexity: 'medium',
    needsTable: false,
    tableReason: '',
    objectives: [`Deliver "${topic}" with clear ownership`, 'Reduce blockers with explicit dependencies'],
    milestones,
    tasks,
    dependencies,
    risks,
    decisions,
    ideas,
    suggestions: suggestionList,
    intent: 'board_generation',
    decision: {
      recommendation: 'Proceed with fallback structure and refine iteratively.',
      pros: ['No blocking on provider availability', 'Immediate actionable structure'],
      cons: ['Less customized than live AI output'],
      risks: ['Requires manual refinement for domain-specific details'],
    },
  };
}

function parseRepoFullName(value) {
  const txt = String(value || '').trim();
  const m = txt.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], full: `${m[1]}/${m[2]}` };
}

function normalizeJiraSite(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  let urlText = raw;
  if (!/^https?:\/\//i.test(urlText)) {
    urlText = `https://${urlText}`;
  }
  let parsed = null;
  try {
    parsed = new URL(urlText);
  } catch {
    return null;
  }
  const host = String(parsed.hostname || '').toLowerCase().trim();
  if (!host || !/[.]/.test(host)) return null;
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return {
    base: `${parsed.protocol}//${host}`,
    host,
  };
}

function normalizeJiraProjectKey(value) {
  const txt = String(value || '').trim().toUpperCase();
  if (!txt) return '';
  if (!/^[A-Z][A-Z0-9_]+$/.test(txt)) return '';
  return txt;
}

function jiraSyncKey(siteInfo, projectKey) {
  const host = String(siteInfo?.host || '').toLowerCase();
  const project = normalizeJiraProjectKey(projectKey) || '__custom__';
  if (!host) return '';
  return `${host}::${project}`;
}

let githubVaultKeyCache = null;

function githubVaultKey() {
  if (githubVaultKeyCache) return githubVaultKeyCache;
  githubVaultKeyCache = crypto
    .createHash('sha256')
    .update(String(GITHUB_TOKEN_VAULT_SECRET || ''), 'utf8')
    .digest();
  return githubVaultKeyCache;
}

function encryptVaultSecret(secret) {
  const txt = String(secret || '');
  if (!txt) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', githubVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(txt, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    token_cipher: encrypted.toString('base64'),
    token_iv: iv.toString('base64'),
    token_tag: tag.toString('base64'),
  };
}

function decryptVaultSecret(blob) {
  try {
    const cipherText = Buffer.from(String(blob?.token_cipher || ''), 'base64');
    const iv = Buffer.from(String(blob?.token_iv || ''), 'base64');
    const tag = Buffer.from(String(blob?.token_tag || ''), 'base64');
    if (!cipherText.length || iv.length !== 12 || tag.length !== 16) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', githubVaultKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(cipherText), decipher.final()]).toString('utf8').trim();
    return plain;
  } catch {
    return '';
  }
}

function clipText(value, max = 120) {
  const txt = String(value || '').trim();
  if (!txt) return '';
  return txt.length > max ? txt.slice(0, max) : txt;
}

function sanitizeGitHubAccount(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const login = clipText(raw.login, 80);
  if (!login) return null;
  const idNum = Number(raw.id);
  return {
    login,
    id: Number.isFinite(idNum) ? idNum : 0,
    name: clipText(raw.name, 120),
    avatar_url: clipText(raw.avatar_url, 400),
    html_url: clipText(raw.html_url, 400),
  };
}

function ensureUserIntegrationsShape(user) {
  if (!user || typeof user !== 'object') return user;
  if (!user.integrations || typeof user.integrations !== 'object' || Array.isArray(user.integrations)) {
    user.integrations = {};
  }
  if (!user.integrations.github || typeof user.integrations.github !== 'object' || Array.isArray(user.integrations.github)) {
    user.integrations.github = {};
  }
  return user;
}

function setUserGitHubIntegration(userId, { token, scope = '', tokenType = 'bearer', account = null } = {}) {
  if (!userId || !token) return null;
  const users = readUsers();
  const user = users[userId];
  if (!user) return null;
  ensureUserIntegrationsShape(user);
  const encrypted = encryptVaultSecret(token);
  if (!encrypted) return null;
  const t = now();
  const prev = user.integrations.github || {};
  const next = {
    ...prev,
    ...encrypted,
    scope: clipText(scope, 250),
    token_type: clipText(tokenType, 40) || 'bearer',
    account: sanitizeGitHubAccount(account) || prev.account || null,
    created_at: Number(prev.created_at) || t,
    updated_at: t,
  };
  user.integrations.github = next;
  users[userId] = user;
  writeUsers(users);
  return next;
}

function getUserGitHubIntegration(userId) {
  if (!userId) return null;
  const users = readUsers();
  const user = users[userId];
  if (!user) return null;
  ensureUserIntegrationsShape(user);
  return user.integrations.github || null;
}

function clearUserGitHubIntegration(userId) {
  if (!userId) return false;
  const users = readUsers();
  const user = users[userId];
  if (!user) return false;
  ensureUserIntegrationsShape(user);
  user.integrations.github = {};
  users[userId] = user;
  writeUsers(users);
  return true;
}

function getGitHubVaultTokenForUser(userId) {
  const integration = getUserGitHubIntegration(userId);
  if (!integration) return '';
  return decryptVaultSecret(integration);
}

function hasGitHubOauthConfig() {
  return Boolean(GITHUB_OAUTH_CLIENT_ID && GITHUB_OAUTH_CLIENT_SECRET);
}

function requestPublicBaseUrl(req) {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
  const xfProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = xfProto || req.protocol || 'http';
  const xfHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const host = xfHost || String(req.headers?.host || '').trim();
  return host ? `${proto}://${host}` : 'http://localhost:3001';
}

function githubOAuthRedirectUri(req) {
  if (GITHUB_OAUTH_REDIRECT_URI) return GITHUB_OAUTH_REDIRECT_URI;
  return `${requestPublicBaseUrl(req)}/api/integrations/github/oauth/callback`;
}

function sanitizeReturnPath(value) {
  const txt = String(value || '').trim();
  if (!txt) return '/';
  if (!txt.startsWith('/')) return '/';
  if (txt.startsWith('//')) return '/';
  return txt;
}

function signGitHubOauthState(payload = {}) {
  return signToken({
    type: 'github_oauth',
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 10,
  });
}

function readGitHubOauthState(raw) {
  const payload = verifyToken(raw);
  if (!payload || payload.type !== 'github_oauth') return null;
  return payload;
}

function githubTokenFromReq(req) {
  const fromBody = String(req.body?.token || '').trim();
  const fromHeader = String(req.headers?.['x-github-token'] || '').trim();
  const fromVault = req.user?.id ? getGitHubVaultTokenForUser(req.user.id) : '';
  return fromBody || fromHeader || fromVault || GITHUB_TOKEN;
}

function isoNow() {
  return new Date().toISOString();
}

function parseIsoMs(value) {
  const t = Date.parse(String(value || '').trim());
  return Number.isFinite(t) ? t : NaN;
}

function maxIso(a, b) {
  const ta = parseIsoMs(a);
  const tb = parseIsoMs(b);
  if (!Number.isFinite(ta) && !Number.isFinite(tb)) return '';
  if (!Number.isFinite(ta)) return String(b || '');
  if (!Number.isFinite(tb)) return String(a || '');
  return ta >= tb ? String(a || '') : String(b || '');
}

function isRemoteNewer(remoteIso, localIso) {
  const tr = parseIsoMs(remoteIso);
  const tl = parseIsoMs(localIso);
  if (!Number.isFinite(tr) || !Number.isFinite(tl)) return false;
  return tr > tl + 1000;
}

function parseSinceInput(value) {
  if (value === undefined || value === null || value === '') return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return '';
    const ms = n > 1000000000000 ? n : n * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d.toISOString() : '';
  }
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}

function repoKey(repoInfo) {
  return `${repoInfo.owner}/${repoInfo.repo}`.toLowerCase();
}

function ensureBoardIntegrationsShape(board) {
  if (!board || typeof board !== 'object') return board;
  if (!board.integrations || typeof board.integrations !== 'object' || Array.isArray(board.integrations)) {
    board.integrations = {};
  }
  if (!board.integrations.github || typeof board.integrations.github !== 'object' || Array.isArray(board.integrations.github)) {
    board.integrations.github = {};
  }
  if (!board.integrations.jira || typeof board.integrations.jira !== 'object' || Array.isArray(board.integrations.jira)) {
    board.integrations.jira = {};
  }
  return board;
}

function getGitHubRepoSyncState(board, key) {
  ensureBoardIntegrationsShape(board);
  const cur = board.integrations.github[key];
  if (!cur || typeof cur !== 'object') {
    return {
      repo: key,
      last_import_at: 0,
      last_import_iso: '',
      last_issue_updated_at: '',
      last_push_at: 0,
      last_push_iso: '',
      last_pull_count: 0,
      last_push_count: 0,
      last_conflicts: 0,
      last_conflict_strategy: '',
    };
  }
  return {
    repo: key,
    last_import_at: Number(cur.last_import_at) || 0,
    last_import_iso: String(cur.last_import_iso || ''),
    last_issue_updated_at: String(cur.last_issue_updated_at || ''),
    last_push_at: Number(cur.last_push_at) || 0,
    last_push_iso: String(cur.last_push_iso || ''),
    last_pull_count: Number(cur.last_pull_count) || 0,
    last_push_count: Number(cur.last_push_count) || 0,
    last_conflicts: Number(cur.last_conflicts) || 0,
    last_conflict_strategy: String(cur.last_conflict_strategy || ''),
  };
}

function setGitHubRepoSyncState(board, key, patch = {}) {
  ensureBoardIntegrationsShape(board);
  const prev = getGitHubRepoSyncState(board, key);
  const next = {
    ...prev,
    ...patch,
    repo: key,
  };
  board.integrations.github[key] = next;
  return next;
}

function getJiraProjectSyncState(board, key) {
  ensureBoardIntegrationsShape(board);
  const cur = board.integrations.jira[key];
  if (!cur || typeof cur !== 'object') {
    return {
      key,
      last_import_at: 0,
      last_import_iso: '',
      last_issue_updated_at: '',
      last_pull_count: 0,
    };
  }
  return {
    key,
    last_import_at: Number(cur.last_import_at) || 0,
    last_import_iso: String(cur.last_import_iso || ''),
    last_issue_updated_at: String(cur.last_issue_updated_at || ''),
    last_pull_count: Number(cur.last_pull_count) || 0,
  };
}

function setJiraProjectSyncState(board, key, patch = {}) {
  ensureBoardIntegrationsShape(board);
  const prev = getJiraProjectSyncState(board, key);
  const next = {
    ...prev,
    ...patch,
    key,
  };
  board.integrations.jira[key] = next;
  return next;
}

function ensureGitHubIdempotencyStore(board) {
  ensureBoardIntegrationsShape(board);
  if (!board.integrations.github_idempotency || typeof board.integrations.github_idempotency !== 'object' || Array.isArray(board.integrations.github_idempotency)) {
    board.integrations.github_idempotency = {};
  }
  return board.integrations.github_idempotency;
}

function normalizeIdempotencyKey(value) {
  const txt = String(value || '').trim();
  if (!txt) return '';
  if (txt.length > 120) return '';
  if (!/^[A-Za-z0-9._:-]+$/.test(txt)) return '';
  return txt;
}

function idempotencyKeyFromReq(req) {
  const fromBody = normalizeIdempotencyKey(req.body?.idempotencyKey);
  const fromHeader = normalizeIdempotencyKey(req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key']);
  return fromBody || fromHeader || '';
}

function cleanupGitHubIdempotencyStore(board) {
  const store = ensureGitHubIdempotencyStore(board);
  const t = now();
  for (const [k, row] of Object.entries(store)) {
    const ts = Number(row?.updated_at || row?.created_at || 0);
    if (!ts || (t - ts) > GITHUB_IDEMPOTENCY_TTL_SEC) {
      delete store[k];
    }
  }
  return store;
}

function readGitHubIdempotencyResult(board, idempotencyKey, operation, repo, actorId) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return null;
  const store = cleanupGitHubIdempotencyStore(board);
  const row = store[key];
  if (!row || typeof row !== 'object') return null;
  if (String(row.operation || '') !== String(operation || '')) return null;
  if (String(row.repo || '') !== String(repo || '')) return null;
  if (String(row.actorId || '') !== String(actorId || '')) return null;
  if (String(row.status || '') !== 'done') return null;
  if (!row.response || typeof row.response !== 'object') return null;
  return row.response;
}

function readGitHubIdempotencyEntry(board, idempotencyKey, operation, repo, actorId) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return null;
  const store = cleanupGitHubIdempotencyStore(board);
  const row = store[key];
  if (!row || typeof row !== 'object') return null;
  if (String(row.operation || '') !== String(operation || '')) return null;
  if (String(row.repo || '') !== String(repo || '')) return null;
  if (String(row.actorId || '') !== String(actorId || '')) return null;
  return row;
}

function markGitHubIdempotencyPending(board, idempotencyKey, operation, repo, actorId) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return null;
  const store = cleanupGitHubIdempotencyStore(board);
  const prev = store[key] || {};
  const t = now();
  store[key] = {
    ...prev,
    key,
    operation: String(operation || ''),
    repo: String(repo || ''),
    actorId: String(actorId || ''),
    status: 'pending',
    created_at: Number(prev.created_at) || t,
    updated_at: t,
  };
  return store[key];
}

function markGitHubIdempotencyDone(board, idempotencyKey, operation, repo, actorId, response) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return null;
  const store = cleanupGitHubIdempotencyStore(board);
  const prev = store[key] || {};
  const t = now();
  store[key] = {
    ...prev,
    key,
    operation: String(operation || ''),
    repo: String(repo || ''),
    actorId: String(actorId || ''),
    status: 'done',
    response: response && typeof response === 'object' ? response : {},
    updated_at: t,
    created_at: Number(prev.created_at) || t,
  };
  return store[key];
}

function clearGitHubIdempotencyKey(board, idempotencyKey) {
  const key = normalizeIdempotencyKey(idempotencyKey);
  if (!key) return false;
  const store = cleanupGitHubIdempotencyStore(board);
  if (!Object.prototype.hasOwnProperty.call(store, key)) return false;
  delete store[key];
  return true;
}

function safeIssueText(value, maxLen = 65535) {
  const txt = String(value || '').replace(/\r/g, '').trim();
  if (!txt) return '';
  return txt.length > maxLen ? `${txt.slice(0, maxLen - 3)}...` : txt;
}

function dueDateToIsoEndOfDay(value) {
  const txt = String(value || '').trim();
  const m = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const iso = `${m[1]}-${m[2]}-${m[3]}T23:59:59Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? iso : '';
}

function normalizeExecStatus(v) {
  const txt = String(v || '').toLowerCase().trim();
  if (!txt) return 'todo';
  if (/(done|closed|complete|completed)/.test(txt)) return 'done';
  if (/(blocked|blocker|stuck)/.test(txt)) return 'blocked';
  if (/(progress|doing|active|wip|started)/.test(txt)) return 'in_progress';
  return 'todo';
}

function normalizeExecPriority(v) {
  const txt = String(v || '').toLowerCase().trim();
  if (!txt) return 'P2';
  if (/(p0|critical|urgent|blocker)/.test(txt)) return 'P0';
  if (/(p1|high)/.test(txt)) return 'P1';
  if (/(p3|low)/.test(txt)) return 'P3';
  return 'P2';
}

function normalizeGithubStage(v, issue) {
  const txt = String(v || '').toLowerCase().trim();
  if (/(later|future|backlog|parking)/.test(txt)) return 'later';
  if (/(now|current|this sprint|urgent|asap)/.test(txt)) return 'now';
  if (/(next|upcoming|soon)/.test(txt)) return 'next';
  if (issue?.state === 'closed') return 'later';
  return 'next';
}

function extractDependenciesFromIssueBody(bodyText, repoInfo = null) {
  const txt = String(bodyText || '');
  if (!txt.trim()) return [];

  const sameOwner = String(repoInfo?.owner || '').toLowerCase();
  const sameRepo = String(repoInfo?.repo || '').toLowerCase();
  const out = [];

  const pushDep = (issueNumRaw, owner = sameOwner, repo = sameRepo) => {
    const issueNum = Number(issueNumRaw);
    if (!Number.isInteger(issueNum) || issueNum <= 0) return;
    const depOwner = String(owner || '').toLowerCase();
    const depRepo = String(repo || '').toLowerCase();
    if (!depOwner || !depRepo || (depOwner === sameOwner && depRepo === sameRepo)) {
      out.push(`gh-${issueNum}`);
      return;
    }
    out.push(`gh-${depOwner}_${depRepo}-${issueNum}`);
  };

  const pushLocalRefs = chunk => {
    const localRefRe = /#(\d+)/g;
    let lm = localRefRe.exec(chunk);
    while (lm) {
      pushDep(lm[1]);
      lm = localRefRe.exec(chunk);
    }

    const issueTokenRe = /\bissue\s*#?\s*(\d+)\b/gi;
    lm = issueTokenRe.exec(chunk);
    while (lm) {
      pushDep(lm[1]);
      lm = issueTokenRe.exec(chunk);
    }

    const pathRefRe = /\/issues\/(\d+)\b/g;
    lm = pathRefRe.exec(chunk);
    while (lm) {
      pushDep(lm[1]);
      lm = pathRefRe.exec(chunk);
    }
  };

  const urlRe = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/issues\/(\d+)/gi;
  let m = urlRe.exec(txt);
  while (m) {
    pushDep(m[3], m[1], m[2]);
    m = urlRe.exec(txt);
  }

  const crossRepoRe = /([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)#(\d+)/g;
  m = crossRepoRe.exec(txt);
  while (m) {
    pushDep(m[3], m[1], m[2]);
    m = crossRepoRe.exec(txt);
  }

  const keywordChunkRe = /(?:depends[\s-]*on|blocked[\s-]*by|requires?|prereq(?:uisite)?s?|dependenc(?:y|ies))[^\n]*/gi;
  m = keywordChunkRe.exec(txt);
  while (m) {
    const chunk = m[0];
    pushLocalRefs(chunk);
    m = keywordChunkRe.exec(txt);
  }

  const checklistLines = txt.split('\n').filter(line => /-\s*\[[ xX]\]/.test(line));
  for (const line of checklistLines) {
    if (!/(depends|blocked|requires|prereq|dependenc|issue)/i.test(line)) continue;
    pushLocalRefs(line);
  }

  const explicitLines = txt.split(/\r?\n/).filter(line => /^\s*(depends-on|blocked-by|requires)\s*:/i.test(line));
  for (const line of explicitLines) {
    const chunk = line.split(':').slice(1).join(':');
    pushLocalRefs(chunk);
  }

  return [...new Set(out)];
}

function githubLabelsToNames(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map(l => (typeof l === 'string' ? l : l?.name))
    .map(x => String(x || '').trim())
    .filter(Boolean);
}

function issuePriorityFromLabels(labels) {
  const lower = labels.map(x => x.toLowerCase());
  if (lower.some(l => /(p0|critical|urgent|priority[:\s-]*0)/.test(l))) return 'P0';
  if (lower.some(l => /(p1|high|priority[:\s-]*1)/.test(l))) return 'P1';
  if (lower.some(l => /(p3|low|priority[:\s-]*3)/.test(l))) return 'P3';
  return 'P2';
}

function issueStatusFrom(labels, state) {
  if (String(state || '').toLowerCase() === 'closed') return 'done';
  const lower = labels.map(x => x.toLowerCase());
  if (lower.some(l => /(blocked|blocker|stuck)/.test(l))) return 'blocked';
  if (lower.some(l => /(in[\s_-]*progress|wip|doing|active)/.test(l))) return 'in_progress';
  return 'todo';
}

function issueStageFromLabels(labels, issue) {
  const lower = labels.map(x => x.toLowerCase());
  if (lower.some(l => /(later|future|backlog|parking)/.test(l))) return 'later';
  if (lower.some(l => /(now|current|this sprint|urgent|asap)/.test(l))) return 'now';
  if (lower.some(l => /(next|upcoming|soon)/.test(l))) return 'next';
  if (issue?.state === 'closed') return 'later';
  return 'next';
}

function shortIssueBody(body, max = 220) {
  const txt = safeIssueText(body, max + 8);
  if (!txt) return '';
  if (txt.length <= max) return txt;
  return `${txt.slice(0, max - 3)}...`;
}

function taskBelongsToRepo(task, info) {
  if (!task || !info) return false;
  const expected = `${info.owner}/${info.repo}`.toLowerCase();
  if (String(task.repo || '').toLowerCase() === expected) return true;
  const refs = Array.isArray(task.sourceRefs) ? task.sourceRefs : [];
  return refs.some(ref => {
    const txt = String(ref || '').toLowerCase();
    return txt.includes(`github.com/${expected}/`) || txt.includes(`/repos/${expected}/`);
  });
}

function parseExecutionNodeTask(node) {
  if (!node || typeof node !== 'object') return null;
  const taskId = String(node.executionTaskId || '').trim();
  if (!taskId) return null;

  const text = String(node.text || '').replace(/\r/g, '');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const title = String(lines[0] || '').trim() || `Task ${taskId}`;

  const pick = prefix => {
    const p = `${prefix.toLowerCase()}:`;
    const line = lines.find(l => l.toLowerCase().startsWith(p));
    return line ? line.slice(p.length).trim() : '';
  };

  const issueFromText = (() => {
    const v = pick('Issue');
    const m = v.match(/#(\d+)/);
    return m ? Number(m[1]) : null;
  })();

  return {
    nodeId: String(node.id || ''),
    taskId,
    title: safeIssueText(node.executionTitle || title, 240),
    description: safeIssueText(node.executionDescription || '', 4000),
    stage: normalizeGithubStage(node.executionStage, null),
    owner: safeIssueText(node.executionOwner || pick('Owner') || 'TBD', 80) || 'TBD',
    priority: normalizeExecPriority(node.executionPriority || pick('Priority')),
    status: normalizeExecStatus(node.executionStatus || pick('Status')),
    dueDate: safeIssueText(node.executionDueDate || pick('Due') || 'TBD', 40) || 'TBD',
    milestoneTitle: safeIssueText(node.executionMilestone || pick('Milestone') || '', 120),
    issueNumber: Number.isInteger(Number(node.executionIssueNumber)) ? Number(node.executionIssueNumber) : issueFromText,
    issueUpdatedAt: safeIssueText(node.executionIssueUpdatedAt || '', 48),
    lastSyncedAt: safeIssueText(node.executionLastSyncedAt || '', 48),
    repo: safeIssueText(node.executionRepo || '', 120),
    sourceRefs: Array.isArray(node.executionSourceRefs) ? node.executionSourceRefs.map(x => String(x || '')).filter(Boolean) : [],
  };
}

function sanitizeSyncTask(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const taskId = String(raw.taskId || raw.id || raw.executionTaskId || `task-${idx + 1}`).trim() || `task-${idx + 1}`;
  const nodeId = String(raw.nodeId || raw.id || '').trim();
  const title = safeIssueText(raw.title || raw.name || raw.text || '', 240) || `Task ${idx + 1}`;
  const issueNumberRaw = Number(raw.issueNumber ?? raw.executionIssueNumber ?? null);
  const issueNumber = Number.isInteger(issueNumberRaw) && issueNumberRaw > 0 ? issueNumberRaw : null;
  const sourceRefs = Array.isArray(raw.sourceRefs)
    ? raw.sourceRefs.map(x => String(x || '').trim()).filter(Boolean).slice(0, 8)
    : [];
  return {
    nodeId,
    taskId,
    title,
    description: safeIssueText(raw.description || raw.details || '', 4000),
    stage: normalizeGithubStage(raw.stage, null),
    owner: safeIssueText(raw.owner || 'TBD', 80) || 'TBD',
    priority: normalizeExecPriority(raw.priority),
    status: normalizeExecStatus(raw.status),
    dueDate: safeIssueText(raw.dueDate || raw.due || 'TBD', 40) || 'TBD',
    milestoneTitle: safeIssueText(raw.milestoneTitle || raw.milestone || '', 120),
    issueNumber,
    issueUpdatedAt: safeIssueText(raw.issueUpdatedAt || raw.executionIssueUpdatedAt || '', 48),
    lastSyncedAt: safeIssueText(raw.lastSyncedAt || raw.executionLastSyncedAt || '', 48),
    repo: safeIssueText(raw.repo || raw.executionRepo || '', 120),
    sourceRefs,
    dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(x => String(x || '').trim()).filter(Boolean).slice(0, 16) : [],
  };
}

function buildIssueBodyFromTask(task) {
  const lines = [];
  if (task.description) {
    lines.push(task.description);
    lines.push('');
  }
  lines.push('---');
  lines.push('Synced from BoardAI execution board.');
  lines.push(`Task ID: ${task.taskId || 'n/a'}`);
  lines.push(`Owner: ${task.owner || 'TBD'}`);
  lines.push(`Priority: ${task.priority || 'P2'}`);
  lines.push(`Status: ${task.status || 'todo'}`);
  lines.push(`Due: ${task.dueDate || 'TBD'}`);
  if (task.milestoneTitle) lines.push(`Milestone: ${task.milestoneTitle}`);
  if (task.dependsOn?.length) lines.push(`Depends on: ${task.dependsOn.join(', ')}`);
  if (task.sourceRefs?.length) lines.push(`Source refs: ${task.sourceRefs.join(', ')}`);
  return safeIssueText(lines.join('\n'), 65535);
}

function buildIssueLabelsFromTask(task) {
  const labels = ['boardai:execution', `priority:${normalizeExecPriority(task.priority)}`];
  const s = normalizeExecStatus(task.status);
  labels.push(`status:${s}`);
  return [...new Set(labels)];
}

function jiraTokenFromReq(req) {
  const fromBody = String(req.body?.jiraToken || req.body?.token || '').trim();
  const fromHeader = String(req.headers?.['x-jira-token'] || '').trim();
  return fromBody || fromHeader || JIRA_TOKEN;
}

function jiraEmailFromReq(req) {
  const fromBody = String(req.body?.jiraEmail || req.body?.email || '').trim();
  const fromHeader = String(req.headers?.['x-jira-email'] || '').trim();
  return fromBody || fromHeader || JIRA_EMAIL;
}

function jiraAuthFromReq(req) {
  const token = jiraTokenFromReq(req);
  if (!token) return null;
  const email = jiraEmailFromReq(req);
  if (email) {
    return {
      mode: 'basic',
      value: Buffer.from(`${email}:${token}`, 'utf8').toString('base64'),
      email,
    };
  }
  return {
    mode: 'bearer',
    value: token,
    email: '',
  };
}

function jiraAuthHeader(auth) {
  if (!auth || typeof auth !== 'object') return '';
  if (auth.mode === 'basic') return `Basic ${auth.value || ''}`;
  return `Bearer ${auth.value || ''}`;
}

function jiraStatusToExec(fields) {
  const cat = String(fields?.status?.statusCategory?.key || '').toLowerCase();
  if (cat === 'done') return 'done';
  const name = String(fields?.status?.name || '').toLowerCase();
  if (/(blocked|blocker|impediment|stuck)/.test(name)) return 'blocked';
  if (/(progress|doing|active|review|develop|in qa|wip|selected for development)/.test(name)) return 'in_progress';
  return 'todo';
}

function jiraStageToExec(fields, status) {
  if (status === 'done') return 'later';
  const name = String(fields?.status?.name || '').toLowerCase();
  if (/(progress|doing|active|review|wip|in qa|develop)/.test(name)) return 'now';
  if (/(backlog|todo|to do|selected)/.test(name)) return 'next';
  return 'next';
}

function jiraPriorityToExec(fields) {
  const name = String(fields?.priority?.name || '').toLowerCase();
  if (/(highest|critical|blocker|urgent|p0)/.test(name)) return 'P0';
  if (/(high|major|p1)/.test(name)) return 'P1';
  if (/(lowest|low|minor|trivial|p3)/.test(name)) return 'P3';
  return 'P2';
}

function jiraDescriptionNodeText(node, out = []) {
  if (!node) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) jiraDescriptionNodeText(item, out);
    return out;
  }
  if (typeof node === 'object') {
    if (typeof node.text === 'string' && node.text.trim()) out.push(node.text);
    if (Array.isArray(node.content)) jiraDescriptionNodeText(node.content, out);
  }
  return out;
}

function jiraDescriptionToText(value, max = 220) {
  if (typeof value === 'string') return shortIssueBody(value, max);
  const chunks = jiraDescriptionNodeText(value, []);
  return shortIssueBody(chunks.join(' ').replace(/\s+/g, ' ').trim(), max);
}

function extractJiraDependenciesFromIssue(issue) {
  const links = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
  const out = [];
  const add = key => {
    const k = String(key || '').trim().toUpperCase();
    if (!k) return;
    out.push(`jira-${k}`);
  };
  for (const link of links) {
    const inward = link?.inwardIssue?.key;
    const outward = link?.outwardIssue?.key;
    const inwardName = String(link?.type?.inward || '').toLowerCase();
    const outwardName = String(link?.type?.outward || '').toLowerCase();
    if (/(block|depend|required|relate)/.test(inwardName) && inward) add(inward);
    if (/(block|depend|required|relate)/.test(outwardName) && outward) add(outward);
  }
  return [...new Set(out)];
}

async function jiraRequest(siteBase, apiPath, { method = 'GET', auth = null, body = null } = {}) {
  const headers = {
    Accept: 'application/json',
  };
  const authHeader = jiraAuthHeader(auth);
  if (authHeader) headers.Authorization = authHeader;
  if (body !== null) headers['Content-Type'] = 'application/json';

  let lastError = null;
  for (let attempt = 1; attempt <= GITHUB_RETRY_MAX_ATTEMPTS; attempt += 1) {
    let response = null;
    try {
      response = await fetch(`${siteBase}${apiPath}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      lastError = error;
      if (attempt < GITHUB_RETRY_MAX_ATTEMPTS) {
        await waitMs(githubRetryDelayMs(attempt));
        continue;
      }
      throw error;
    }

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (response.ok) return data;

    const detail = data?.errorMessages?.[0] || data?.message || data?.error || raw || `Jira API error (${response.status})`;
    const err = new Error(detail);
    err.status = response.status;
    err.data = data;
    err.retryAfterMs = parseRetryAfterMs(response.headers?.get('retry-after'));
    lastError = err;
    if (attempt < GITHUB_RETRY_MAX_ATTEMPTS && isRetryableGitHubStatus(response.status)) {
      await waitMs(githubRetryDelayMs(attempt, err.retryAfterMs));
      continue;
    }
    throw err;
  }
  throw lastError || new Error('Jira API request failed');
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function parseRetryAfterMs(rawValue) {
  const txt = String(rawValue || '').trim();
  if (!txt) return 0;
  if (/^\d+$/.test(txt)) {
    return Math.max(0, Math.min(120000, Number(txt) * 1000));
  }
  const at = Date.parse(txt);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.min(120000, at - Date.now()));
}

function isRetryableGitHubStatus(status) {
  const code = Number(status) || 0;
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(code);
}

function githubRetryDelayMs(attempt, retryAfterMs = 0) {
  const exp = GITHUB_RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * Math.max(80, Math.floor(GITHUB_RETRY_BASE_MS * 0.6)));
  const base = Math.min(30000, exp + jitter);
  return Math.max(base, Math.max(0, Math.min(120000, Number(retryAfterMs) || 0)));
}

function isMilestoneTitleForSync(value) {
  const title = safeIssueText(value || '', 120);
  if (!title) return false;
  return !/^(tbd|none|n\/a)$/i.test(title);
}

function milestoneStateFromTasks(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return 'open';
  const allDone = tasks.every(task => normalizeExecStatus(task?.status) === 'done');
  return allDone ? 'closed' : 'open';
}

function buildDesiredMilestoneSet(tasks) {
  const out = new Map();
  for (const task of (Array.isArray(tasks) ? tasks : [])) {
    const title = safeIssueText(task?.milestoneTitle || '', 120);
    if (!isMilestoneTitleForSync(title)) continue;
    const key = title.toLowerCase();
    const row = out.get(key) || { key, title, tasks: [], dueIso: '' };
    row.tasks.push(task);
    row.dueIso = maxIso(row.dueIso, dueDateToIsoEndOfDay(task?.dueDate));
    out.set(key, row);
  }

  return [...out.values()].map(row => ({
    key: row.key,
    title: row.title,
    dueIso: row.dueIso || '',
    desiredState: milestoneStateFromTasks(row.tasks),
    taskCount: row.tasks.length,
  }));
}

async function reconcileGitHubMilestones(repoInfo, token, tasks) {
  const milestoneTitleToNumber = new Map();
  const warnings = [];
  const desired = buildDesiredMilestoneSet(tasks);
  const stats = {
    desired: desired.length,
    matched: 0,
    created: 0,
    updated: 0,
  };
  if (!desired.length) return { milestoneTitleToNumber, warnings, stats };

  const repoBase = `/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}`;
  let existingRows = [];
  try {
    const rows = await githubRequest(`${repoBase}/milestones?state=all&per_page=100`, { method: 'GET', token });
    existingRows = Array.isArray(rows) ? rows : [];
  } catch (error) {
    warnings.push(`Milestone listing unavailable: ${error.message || 'unknown error'}`);
    return { milestoneTitleToNumber, warnings, stats };
  }

  const existingByTitle = new Map();
  for (const row of existingRows) {
    const key = String(row?.title || '').trim().toLowerCase();
    const number = Number(row?.number);
    if (!key || !Number.isInteger(number) || number <= 0) continue;
    existingByTitle.set(key, row);
    milestoneTitleToNumber.set(key, number);
  }

  for (const m of desired) {
    const existing = existingByTitle.get(m.key);
    if (existing) {
      stats.matched += 1;
      const patch = {};
      const existingState = String(existing?.state || '').toLowerCase();
      if (existingState && existingState !== m.desiredState) {
        patch.state = m.desiredState;
      }
      const existingDueMs = parseIsoMs(existing?.due_on || '');
      const desiredDueMs = parseIsoMs(m.dueIso || '');
      if (Number.isFinite(desiredDueMs) && (!Number.isFinite(existingDueMs) || Math.abs(existingDueMs - desiredDueMs) > 1000)) {
        patch.due_on = m.dueIso;
      }

      if (Object.keys(patch).length) {
        try {
          const updatedRow = await githubRequest(
            `${repoBase}/milestones/${encodeURIComponent(String(existing.number))}`,
            { method: 'PATCH', token, body: patch },
          );
          const updatedNumber = Number(updatedRow?.number);
          if (Number.isInteger(updatedNumber) && updatedNumber > 0) {
            milestoneTitleToNumber.set(m.key, updatedNumber);
          }
          stats.updated += 1;
        } catch (error) {
          warnings.push(`Milestone "${m.title}" update failed: ${error.message || 'unknown error'}`);
        }
      }
      continue;
    }

    const createPayload = {
      title: m.title,
      state: m.desiredState,
    };
    if (m.dueIso) createPayload.due_on = m.dueIso;
    try {
      const createdRow = await githubRequest(
        `${repoBase}/milestones`,
        { method: 'POST', token, body: createPayload },
      );
      const createdNumber = Number(createdRow?.number);
      if (Number.isInteger(createdNumber) && createdNumber > 0) {
        milestoneTitleToNumber.set(m.key, createdNumber);
      }
      stats.created += 1;
    } catch (error) {
      warnings.push(`Milestone "${m.title}" create failed: ${error.message || 'unknown error'}`);
    }
  }

  return { milestoneTitleToNumber, warnings, stats };
}

async function githubRequest(apiPath, { method = 'GET', token, body = null } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'BoardAI/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== null) headers['Content-Type'] = 'application/json';

  let lastError = null;
  for (let attempt = 1; attempt <= GITHUB_RETRY_MAX_ATTEMPTS; attempt += 1) {
    let response = null;
    try {
      response = await fetch(`${GITHUB_API_BASE}${apiPath}`, {
        method,
        headers,
        body: body !== null ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      lastError = error;
      if (attempt < GITHUB_RETRY_MAX_ATTEMPTS) {
        await waitMs(githubRetryDelayMs(attempt));
        continue;
      }
      throw error;
    }

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
    if (response.ok) {
      return data;
    }

    const detail = data?.message || data?.error || raw || `GitHub API error (${response.status})`;
    const err = new Error(detail);
    err.status = response.status;
    err.data = data;
    err.retryAfterMs = parseRetryAfterMs(response.headers?.get('retry-after'));
    lastError = err;
    if (attempt < GITHUB_RETRY_MAX_ATTEMPTS && isRetryableGitHubStatus(response.status)) {
      await waitMs(githubRetryDelayMs(attempt, err.retryAfterMs));
      continue;
    }
    throw err;
  }
  throw lastError || new Error('GitHub API request failed');
}

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: corsOriginDelegate,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '20mb' }));
app.use('/api/vault', createVaultRouter({ requireAuth, vault }));

app.post('/api/boards/:id/embeddings/search', requireAuth, async (req, res) => {
  const { q, limit } = req.body;
  if (!q) return res.status(400).json({ error: 'Query is required' });
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  try {
    const results = await embeddings.searchSimilarNotes(req.params.id, q, limit);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function aiRateLimit(req, res, next) {
  const key = `${clientIp(req)}::${req.user?.id || 'anon'}`;
  const t = now();
  let bucket = aiRateBuckets.get(key);

  if (!bucket || (t - bucket.startedAt) >= AI_RATE_WINDOW_SEC) {
    bucket = { startedAt: t, count: 0 };
  }

  if (bucket.count >= AI_RATE_MAX) {
    aiMetrics.rate_limited += 1;
    const retryAfterSec = Math.max(1, AI_RATE_WINDOW_SEC - (t - bucket.startedAt));
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'Rate limit exceeded for AI endpoint',
      retry_after_sec: retryAfterSec,
    });
  }

  bucket.count += 1;
  aiRateBuckets.set(key, bucket);

  if (aiRateBuckets.size > 5000) {
    for (const [k, b] of aiRateBuckets) {
      if ((t - b.startedAt) >= AI_RATE_WINDOW_SEC) aiRateBuckets.delete(k);
    }
  }
  return next();
}

function authRateLimit(req, res, next) {
  const emailKey = String(req.body?.email || '').toLowerCase().trim();
  const key = `${clientIp(req)}::${emailKey || 'anon'}`;
  const t = now();
  let bucket = authRateBuckets.get(key);

  if (!bucket || (t - bucket.startedAt) >= AUTH_RATE_WINDOW_SEC) {
    bucket = { startedAt: t, count: 0 };
  }

  if (bucket.count >= AUTH_RATE_MAX) {
    const retryAfterSec = Math.max(1, AUTH_RATE_WINDOW_SEC - (t - bucket.startedAt));
    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      error: 'Rate limit exceeded for auth endpoint',
      retry_after_sec: retryAfterSec,
    });
  }

  bucket.count += 1;
  authRateBuckets.set(key, bucket);

  if (authRateBuckets.size > 5000) {
    for (const [k, b] of authRateBuckets) {
      if ((t - b.startedAt) >= AUTH_RATE_WINDOW_SEC) authRateBuckets.delete(k);
    }
  }
  return next();
}

// ── REST: Auth ────────────────────────────────────────────
app.post('/api/auth/register', authRateLimit, (req, res) => {
  const { email, name, password } = req.body || {};
  if (!email || !name || !password) {
    return res.status(400).json({ error: 'email, name and password are required' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const emailLower = String(email).toLowerCase().trim();
  const users = readUsers();
  const existing = Object.values(users).find(u => u.email === emailLower);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const id = uuidv4();
  const salt = randomSalt();
  const passHash = hashPassword(password, salt);
  const color = UCOLS[Math.floor(Math.random() * UCOLS.length)];
  const t = now();
  users[id] = { id, email: emailLower, name: String(name).trim(), passHash, salt, color, created_at: t };
  writeUsers(users);

  const token = signToken({ id, email: emailLower, name: users[id].name, color, exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
  res.status(201).json({ token, user: { id, email: emailLower, name: users[id].name, color } });
});

app.post('/api/auth/login', authRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const emailLower = String(email).toLowerCase().trim();
  const users = readUsers();
  const user = Object.values(users).find(u => u.email === emailLower);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  if (!verifyPassword(password, user.salt, user.passHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (passwordNeedsUpgrade(user.passHash)) {
    users[user.id] = {
      ...user,
      passHash: hashPassword(password, user.salt),
    };
    writeUsers(users);
  }

  const token = signToken({ id: user.id, email: user.email, name: user.name, color: user.color, exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, color: user.color } });
});

app.post('/api/auth/token', requireAuth, (req, res) => {
  if (req.user?.token_type === 'api') {
    return res.status(403).json({ error: 'API tokens cannot create new tokens' });
  }

  const users = readUsers();
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestedDays = Number(body.expiresInDays);
  const expiresInDays = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(API_TOKEN_MAX_DAYS, Math.floor(requestedDays)))
    : API_TOKEN_DEFAULT_DAYS;
  const tokenName = clipText(body.name, 80) || 'api-token';
  const expiresAt = Math.floor(Date.now() / 1000) + (expiresInDays * 86400);
  const tokenId = uuidv4();
  const tokenJti = uuidv4();

  const token = signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    color: user.color,
    token_type: 'api',
    token_name: tokenName,
    jti: tokenJti,
    exp: expiresAt,
  });

  const nextTokens = normalizeUserApiTokens(user)
    .filter((entry) => !entry.revoked_at || (entry.expires_at && entry.expires_at >= now() - 86400))
    .sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0))
    .slice(0, API_TOKEN_MAX_PER_USER - 1);
  nextTokens.push({
    id: tokenId,
    jti: tokenJti,
    name: tokenName,
    created_at: now(),
    expires_at: expiresAt,
    last_used_at: null,
    revoked_at: null,
  });
  persistUserApiTokens(user.id, nextTokens);

  return res.json({
    token,
    tokenType: 'Bearer',
    id: tokenId,
    name: tokenName,
    expiresInDays,
    expiresAt,
  });
});

app.get('/api/auth/tokens', requireAuth, (req, res) => {
  const users = readUsers();
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({
    items: sanitizeApiTokensForClient(user),
  });
});

app.delete('/api/auth/tokens/:tokenId', requireAuth, (req, res) => {
  const tokenId = clipText(req.params.tokenId, 120);
  if (!tokenId) return res.status(400).json({ error: 'tokenId is required' });

  const users = readUsers();
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });

  let found = false;
  const updated = normalizeUserApiTokens(user).map((entry) => {
    if (entry.id !== tokenId) return entry;
    found = true;
    return {
      ...entry,
      revoked_at: entry.revoked_at || now(),
    };
  });

  if (!found) return res.status(404).json({ error: 'Token not found' });
  persistUserApiTokens(user.id, updated);
  return res.json({
    ok: true,
    tokenId,
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = readUsers();
  const user = users[req.user.id];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, email: user.email, name: user.name, color: user.color });
});

function renderGitHubOauthPopup(payload = {}) {
  const msg = {
    type: 'boardai:github-oauth',
    ok: Boolean(payload.ok),
    error: payload.error ? String(payload.error) : '',
    account: payload.account || null,
    source: payload.source || null,
    returnTo: sanitizeReturnPath(payload.returnTo),
  };
  const serialized = JSON.stringify(msg).replace(/</g, '\\u003c');
  const fallbackPath = JSON.stringify(msg.returnTo || '/');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BoardAI GitHub OAuth</title>
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
      .card { max-width: 560px; margin: 0 auto; background: #111827; border: 1px solid #334155; border-radius: 10px; padding: 18px; }
      .ok { color: #86efac; }
      .err { color: #fca5a5; }
      .hint { color: #94a3b8; font-size: 13px; margin-top: 10px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h3 style="margin-top:0">BoardAI GitHub Sync</h3>
      <div id="status"></div>
      <div class="hint">Daca fereastra nu se inchide automat, o poti inchide manual.</div>
    </div>
    <script>
      const msg = ${serialized};
      const status = document.getElementById('status');
      const txt = msg.ok
        ? ('Conectat ca @' + (msg.account?.login || 'unknown') + '.')
        : ('Conectare esuata: ' + (msg.error || 'Unknown error'));
      status.className = msg.ok ? 'ok' : 'err';
      status.textContent = txt;

      let posted = false;
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(msg, window.location.origin);
          posted = true;
          window.close();
        }
      } catch (_) {}

      if (!posted) {
        setTimeout(() => {
          window.location.href = ${fallbackPath};
        }, 1400);
      }
    </script>
  </body>
</html>`;
}

app.get('/api/integrations/github/oauth/status', optAuth, (req, res) => {
  const integration = req.user?.id ? (getUserGitHubIntegration(req.user.id) || {}) : {};
  const token = req.user?.id ? decryptVaultSecret(integration) : null;
  const connected = Boolean(token);
  const account = sanitizeGitHubAccount(integration.account);
  const hasEnvFallback = Boolean(GITHUB_TOKEN);

  res.json({
    oauth_configured: hasGitHubOauthConfig(),
    connected,
    available: connected || hasEnvFallback,
    source: connected ? 'oauth' : (hasEnvFallback ? 'env' : null),
    has_env_fallback: hasEnvFallback,
    account: account || null,
    scope: clipText(integration.scope, 250),
    updated_at: Number(integration.updated_at) || 0,
  });
});

app.delete('/api/integrations/github/oauth/status', requireAuth, (req, res) => {
  const removed = clearUserGitHubIntegration(req.user.id);
  res.json({
    success: removed,
    connected: false,
    source: GITHUB_TOKEN ? 'env' : null,
  });
});

app.get('/api/integrations/github/oauth/start', requireAuth, (req, res) => {
  if (!hasGitHubOauthConfig()) {
    return res.status(400).json({ error: 'GitHub OAuth is not configured on server' });
  }

  const boardId = clipText(req.query.boardId, 80);
  const returnTo = sanitizeReturnPath(req.query.returnTo);
  const scope = String(GITHUB_OAUTH_SCOPES || 'repo read:user')
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .join(' ');

  const state = signGitHubOauthState({
    userId: req.user.id,
    boardId,
    returnTo,
    nonce: uuidv4(),
  });

  const params = new URLSearchParams();
  params.set('client_id', GITHUB_OAUTH_CLIENT_ID);
  params.set('redirect_uri', githubOAuthRedirectUri(req));
  params.set('scope', scope || 'repo read:user');
  params.set('state', state);
  params.set('allow_signup', 'false');

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const callbackOrigin = requestPublicBaseUrl(req);
  return res.json({
    url,
    scope: scope || 'repo read:user',
    callback_origin: callbackOrigin,
    redirect_uri: githubOAuthRedirectUri(req),
    oauth_configured: true,
  });
});

app.get('/api/integrations/github/oauth/callback', async (req, res) => {
  const reply = (payload, status = 200) => {
    res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(renderGitHubOauthPopup(payload));
  };

  const statePayload = readGitHubOauthState(String(req.query.state || ''));
  if (!statePayload?.userId) {
    return reply({ ok: false, error: 'Invalid or expired OAuth state', returnTo: '/' }, 400);
  }

  if (req.query.error) {
    return reply({
      ok: false,
      error: String(req.query.error_description || req.query.error || 'GitHub authorization denied'),
      returnTo: statePayload.returnTo,
    }, 400);
  }

  if (!hasGitHubOauthConfig()) {
    return reply({ ok: false, error: 'GitHub OAuth is not configured on server', returnTo: statePayload.returnTo }, 500);
  }

  const code = String(req.query.code || '').trim();
  if (!code) {
    return reply({ ok: false, error: 'Missing OAuth code from GitHub', returnTo: statePayload.returnTo }, 400);
  }

  try {
    const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'BoardAI/1.0',
      },
      body: JSON.stringify({
        client_id: GITHUB_OAUTH_CLIENT_ID,
        client_secret: GITHUB_OAUTH_CLIENT_SECRET,
        code,
        redirect_uri: githubOAuthRedirectUri(req),
        state: String(req.query.state || ''),
      }),
    });
    const tokenRaw = await tokenResp.text();
    let tokenData = {};
    try { tokenData = tokenRaw ? JSON.parse(tokenRaw) : {}; } catch { tokenData = {}; }

    if (!tokenResp.ok || tokenData?.error) {
      const detail = tokenData?.error_description || tokenData?.error || tokenRaw || `GitHub OAuth failed (${tokenResp.status})`;
      throw new Error(detail);
    }

    const accessToken = String(tokenData?.access_token || '').trim();
    if (!accessToken) throw new Error('GitHub OAuth returned empty access token');

    const ghUser = await githubRequest('/user', { method: 'GET', token: accessToken });
    const account = sanitizeGitHubAccount(ghUser);
    if (!account) throw new Error('GitHub account info missing in OAuth response');

    const saved = setUserGitHubIntegration(statePayload.userId, {
      token: accessToken,
      scope: tokenData?.scope || '',
      tokenType: tokenData?.token_type || 'bearer',
      account,
    });
    if (!saved) throw new Error('Unable to persist GitHub OAuth token');

    const boardId = clipText(statePayload.boardId, 80);
    if (boardId) {
      const db = readDB();
      const board = db[boardId];
      if (board && canReadBoard(board, { id: statePayload.userId })) {
        appendAuditEvent({
          boardId,
          actorId: statePayload.userId,
          action: 'board.github.oauth.connect',
          details: {
            login: account.login,
            source: 'oauth',
          },
        });
      }
    }

    return reply({
      ok: true,
      account,
      source: 'oauth',
      returnTo: statePayload.returnTo,
    }, 200);
  } catch (error) {
    return reply({
      ok: false,
      error: error.message || 'GitHub OAuth callback failed',
      returnTo: statePayload.returnTo,
    }, 500);
  }
});

// ── REST: Boards ──────────────────────────────────────────
// Template Marketplace
app.get('/api/templates/categories', optAuth, (req, res) => {
  res.json({ categories: TEMPLATE_CATEGORIES });
});

app.get('/api/templates', optAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const userId = req.user?.id ? String(req.user.id) : '';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.max(1, Math.min(60, Number(req.query.pageSize) || 18));
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const scope = String(req.query.scope || 'marketplace').toLowerCase();
  const sort = String(req.query.sort || 'featured').toLowerCase();

  let rows = Object.values(store.templates || {});
  rows = rows.filter(tpl => {
    if (scope === 'mine') return Boolean(userId && tpl.creator?.userId === userId);
    if (scope === 'bookmarked') return Boolean(userId && Array.isArray(tpl.bookmarks) && tpl.bookmarks.includes(userId) && canReadTemplate(tpl, req.user));
    if (tpl.visibility === 'public') return true;
    return Boolean(userId && tpl.creator?.userId === userId);
  });
  if (category && category.toLowerCase() !== 'all') {
    rows = rows.filter(tpl => String(tpl.category || '').toLowerCase() === category.toLowerCase());
  }
  if (q) {
    rows = rows.filter(tpl => {
      const hay = [
        tpl.name,
        tpl.description,
        tpl.category,
        ...(Array.isArray(tpl.tags) ? tpl.tags : []),
        tpl.creator?.name,
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  const mapped = rows.map(tpl => {
    const summary = templateSummaryForClient(tpl, req.user);
    const ageSec = Math.max(1, now() - Number(summary.updated_at || summary.created_at || now()));
    const recentBoost = Math.max(0, 1 - ageSec / (3600 * 24 * 14));
    const trendingScore = summary.usage_count + summary.bookmark_count * 2 + summary.rating_avg * 6 + recentBoost * 12 + (summary.featured ? 8 : 0);
    return { summary, trendingScore };
  });
  mapped.sort((a, b) => {
    if (sort === 'new') return Number(b.summary.created_at || 0) - Number(a.summary.created_at || 0);
    if (sort === 'trending') return b.trendingScore - a.trendingScore;
    if (sort === 'popular') return Number(b.summary.usage_count || 0) - Number(a.summary.usage_count || 0);
    if (sort === 'rating') return Number(b.summary.rating_avg || 0) - Number(a.summary.rating_avg || 0);
    const fa = a.summary.featured ? 1 : 0;
    const fb = b.summary.featured ? 1 : 0;
    if (fb !== fa) return fb - fa;
    return Number(b.summary.usage_count || 0) - Number(a.summary.usage_count || 0);
  });

  const total = mapped.length;
  const start = (page - 1) * pageSize;
  const items = mapped.slice(start, start + pageSize).map(entry => entry.summary);
  res.json({
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    categories: TEMPLATE_CATEGORIES,
  });
});

app.get('/api/templates/:id', optAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canReadTemplate(template, req.user)) return res.status(403).json({ error: 'Access denied' });
  const details = templateSummaryForClient(template, req.user);
  const versions = (template.versions || [])
    .slice()
    .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))
    .map(v => ({
      id: v.id,
      version: v.version,
      created_at: v.created_at,
      note: v.note || '',
      node_count: Array.isArray(v?.data?.nodes) ? v.data.nodes.length : 0,
      arrow_count: Array.isArray(v?.data?.arrows) ? v.data.arrows.length : 0,
    }));
  res.json({ template: details, versions });
});

app.get('/api/templates/:id/preview', optAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canReadTemplate(template, req.user)) return res.status(403).json({ error: 'Access denied' });
  const version = resolveTemplateVersion(template, req.query.version);
  if (!version) return res.status(404).json({ error: 'Template version not found' });
  res.json({
    template: templateSummaryForClient(template, req.user),
    version: {
      id: version.id,
      version: version.version,
      created_at: version.created_at,
      note: version.note || '',
    },
    preview: buildTemplatePreviewPayload(version.data),
  });
});

app.post('/api/templates', requireAuth, (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'name is required' });
  const description = String(req.body?.description || '').trim().slice(0, 600);
  const category = sanitizeTemplateCategory(req.body?.category);
  const tags = sanitizeTemplateTags(req.body?.tags);
  const visibility = sanitizeTemplateVisibility(req.body?.visibility || 'private');
  const boardId = String(req.body?.boardId || '').trim();

  let sourceData = null;
  if (boardId) {
    const db = readDB();
    const board = db[boardId];
    if (!board) return res.status(404).json({ error: 'Source board not found' });
    if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied to source board' });
    sourceData = normalizeTemplateData(board.data);
  } else if (req.body?.data && typeof req.body.data === 'object') {
    sourceData = normalizeTemplateData(req.body.data);
  }
  if (!sourceData) return res.status(400).json({ error: 'boardId or data is required' });

  const store = ensureTemplateStoreShape(readTemplatesStore());
  const t = now();
  const id = uuidv4();
  store.templates[id] = ensureTemplateShape({
    id,
    name,
    description,
    category,
    tags,
    visibility,
    creator: {
      userId: req.user.id,
      name: req.user.name || 'User',
      color: req.user.color || '#3b82f6',
    },
    featured: false,
    usage_count: 0,
    created_at: t,
    updated_at: t,
    published_at: visibility === 'public' ? t : 0,
    latest_version: 1,
    versions: [{
      id: `${id}_v1`,
      version: 1,
      created_at: t,
      note: String(req.body?.note || 'Initial version').slice(0, 240),
      data: sourceData,
    }],
    bookmarks: [],
    ratings: {},
  });
  writeTemplatesStore(store);
  if (boardId) {
    appendAuditEvent({
      boardId,
      actorId: req.user?.id || null,
      action: 'board.template.create',
      details: { templateId: id, visibility },
    });
  }
  res.status(201).json({ template: templateSummaryForClient(store.templates[id], req.user) });
});

app.put('/api/templates/:id/publish', requireAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canEditTemplate(template, req.user)) return res.status(403).json({ error: 'Only creator can update template visibility' });
  const visibility = sanitizeTemplateVisibility(req.body?.visibility || 'public');
  template.visibility = visibility;
  template.updated_at = now();
  template.published_at = visibility === 'public' ? (template.published_at || now()) : 0;
  writeTemplatesStore(store);
  res.json({ template: templateSummaryForClient(template, req.user) });
});

app.post('/api/templates/:id/version', requireAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canEditTemplate(template, req.user)) return res.status(403).json({ error: 'Only creator can add versions' });

  const boardId = String(req.body?.boardId || '').trim();
  let sourceData = null;
  if (boardId) {
    const db = readDB();
    const board = db[boardId];
    if (!board) return res.status(404).json({ error: 'Source board not found' });
    if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied to source board' });
    sourceData = normalizeTemplateData(board.data);
  } else if (req.body?.data && typeof req.body.data === 'object') {
    sourceData = normalizeTemplateData(req.body.data);
  }
  if (!sourceData) return res.status(400).json({ error: 'boardId or data is required' });

  const nextVersion = Math.max(1, Number(template.latest_version) || 1) + 1;
  template.versions.push({
    id: `${template.id}_v${nextVersion}`,
    version: nextVersion,
    created_at: now(),
    note: String(req.body?.note || '').slice(0, 240),
    data: sourceData,
  });
  template.latest_version = nextVersion;
  if (req.body?.name !== undefined) template.name = String(req.body.name || template.name).trim().slice(0, 120) || template.name;
  if (req.body?.description !== undefined) template.description = String(req.body.description || '').trim().slice(0, 600);
  if (req.body?.category !== undefined) template.category = sanitizeTemplateCategory(req.body.category);
  if (req.body?.tags !== undefined) template.tags = sanitizeTemplateTags(req.body.tags);
  template.updated_at = now();
  ensureTemplateShape(template);
  writeTemplatesStore(store);
  res.json({ template: templateSummaryForClient(template, req.user), version: nextVersion });
});

app.post('/api/templates/:id/bookmark', requireAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canReadTemplate(template, req.user)) return res.status(403).json({ error: 'Access denied' });

  const userId = String(req.user.id);
  const wants = typeof req.body?.bookmarked === 'boolean'
    ? req.body.bookmarked
    : !(Array.isArray(template.bookmarks) && template.bookmarks.includes(userId));
  const set = new Set(Array.isArray(template.bookmarks) ? template.bookmarks.map(v => String(v)) : []);
  if (wants) set.add(userId);
  else set.delete(userId);
  template.bookmarks = [...set];
  template.updated_at = now();
  writeTemplatesStore(store);
  res.json({ bookmarked: template.bookmarks.includes(userId), bookmark_count: template.bookmarks.length });
});

app.post('/api/templates/:id/rate', requireAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canReadTemplate(template, req.user)) return res.status(403).json({ error: 'Access denied' });
  const value = Number(req.body?.value);
  if (!Number.isFinite(value) || value < 1 || value > 5) return res.status(400).json({ error: 'value must be between 1 and 5' });
  if (!template.ratings || typeof template.ratings !== 'object') template.ratings = {};
  template.ratings[String(req.user.id)] = value;
  template.updated_at = now();
  writeTemplatesStore(store);
  const stats = templateRatingStats(template);
  res.json({ ...stats, my_rating: value });
});

app.post('/api/templates/:id/use', requireAuth, (req, res) => {
  const store = ensureTemplateStoreShape(readTemplatesStore());
  const template = store.templates?.[req.params.id];
  if (!template) return res.status(404).json({ error: 'Template not found' });
  if (!canReadTemplate(template, req.user)) return res.status(403).json({ error: 'Access denied' });
  const version = resolveTemplateVersion(template, req.body?.version);
  if (!version) return res.status(404).json({ error: 'Template version not found' });

  const db = readDB();
  const id = uuidv4();
  const t = now();
  const boardName = String(req.body?.boardName || `${template.name} Board`).trim().slice(0, 120) || `${template.name} Board`;
  db[id] = {
    id,
    name: boardName,
    data: normalizeBoardData(deepClone(version.data)),
    created_at: t,
    updated_at: t,
    revision: 1,
    members: [],
    userId: req.user.id,
  };
  captureBoardVersion(db[id], { actorId: req.user?.id || null, reason: 'create', force: true });
  writeDB(db);
  semantic.scheduleRebuild(id, db[id].data, { trigger: 'board.create.from_template', nowSec: t });
  appendAuditEvent({
    boardId: id,
    actorId: req.user?.id || null,
    action: 'board.create.from_template',
    details: { templateId: template.id, templateVersion: version.version },
  });
  template.usage_count = Math.max(0, Number(template.usage_count) || 0) + 1;
  template.updated_at = now();
  writeTemplatesStore(store);
  res.status(201).json({
    board: {
      id,
      name: boardName,
      created_at: t,
      updated_at: t,
      revision: 1,
      access_role: 'owner',
    },
    template: templateSummaryForClient(template, req.user),
    version: version.version,
  });
});

app.get('/api/boards', optAuth, (req, res) => {
  const db = readDB();
  let list = Object.values(db);
  list.forEach(ensureBoardRevisionShape);
  list = list.filter(b => canReadBoard(b, req.user));
  list = list
    .sort((a, b) => b.updated_at - a.updated_at)
    .map(b => ({
      id: b.id,
      name: b.name,
      created_at: b.created_at,
      updated_at: b.updated_at,
      revision: Number(b.revision) || 1,
      owner_id: b.userId || null,
      access_role: boardRoleForUser(b, req.user),
    }));
  res.json(list);
});

app.get('/api/boards/:id', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  ensureBoardRevisionShape(board);
  if (!canReadBoard(board, req.user)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(toBoardClient(board, req.user));
});

app.get('/api/boards/:id/history', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  ensureBoardHistoryShape(board);
  const versions = board.versions
    .slice()
    .sort((a, b) => b.created_at - a.created_at)
    .map(summarizeVersion);
  res.json({ boardId: board.id, count: versions.length, versions });
});

app.get('/api/boards/:id/history/:versionId', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  ensureBoardHistoryShape(board);
  const version = board.versions.find(v => v.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });
  res.json({
    boardId: board.id,
    version: summarizeVersion(version),
    data: normalizeBoardData(version.data),
  });
});

app.post('/api/boards/:id/history/:versionId/restore', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  ensureBoardRevisionShape(board);
  if (!canEditBoard(board, req.user)) return res.status(403).json({ error: 'Edit access required' });

  ensureBoardHistoryShape(board);
  const version = board.versions.find(v => v.id === req.params.versionId);
  if (!version) return res.status(404).json({ error: 'Version not found' });

  board.data = normalizeBoardData(version.data);
  board.updated_at = now();
  board.revision += 1;
  captureBoardVersion(board, {
    actorId: req.user?.id || null,
    reason: `restore:${version.id}`,
    force: true,
  });
  writeDB(db);
  semantic.scheduleRebuild(board.id, board.data, {
    trigger: 'board.restore',
    nowSec: board.updated_at,
  });
  appendAuditEvent({
    boardId: board.id,
    actorId: req.user?.id || null,
    action: 'board.restore',
    details: { restoredVersionId: version.id },
  });

  res.json({
    success: true,
    restoredVersionId: version.id,
    board: toBoardClient(board, req.user),
  });
});

app.post('/api/boards', requireAuth, (req, res) => {
  const db = readDB();
  const id = uuidv4();
  const name = (req.body.name || 'Untitled Board').trim() || 'Untitled Board';
  const t = now();
  db[id] = { id, name, data: defaultBoardData(), created_at: t, updated_at: t, revision: 1, members: [], userId: req.user.id };
  captureBoardVersion(db[id], { actorId: req.user?.id || null, reason: 'create', force: true });
  writeDB(db);
  semantic.scheduleRebuild(id, db[id].data, { trigger: 'board.create', nowSec: t });
  appendAuditEvent({
    boardId: id,
    actorId: req.user?.id || null,
    action: 'board.create',
    details: { name },
  });
  res.status(201).json({ id, name, created_at: t, updated_at: t, revision: 1, access_role: boardRoleForUser(db[id], req.user) });
});

app.put('/api/boards/:id', optAuth, (req, res) => {
  const db = readDB();
  if (!db[req.params.id]) return res.status(404).json({ error: 'Board not found' });
  const board = db[req.params.id];
  ensureBoardRevisionShape(board);
  if (!canEditBoard(board, req.user)) {
    return res.status(403).json({ error: 'Edit access required' });
  }

  if (req.body.data !== undefined && (!req.body.data || typeof req.body.data !== 'object' || Array.isArray(req.body.data))) {
    return res.status(400).json({ error: 'data must be an object' });
  }
  const prevName = board.name;
  const expectedRevision = parseExpectedRevision(req);
  if (req.body.data !== undefined && expectedRevision === null) {
    return res.status(428).json({
      error: 'Board revision required',
      current_revision: board.revision,
    });
  }
  if (req.body.data !== undefined && expectedRevision !== board.revision) {
    return res.status(409).json({
      error: 'Board revision conflict',
      current_revision: board.revision,
    });
  }
  let nameChanged = false;
  let dataChanged = false;
  if (req.body.name !== undefined && req.body.name !== board.name) {
    db[req.params.id].name = req.body.name;
    nameChanged = true;
  }
  if (req.body.data !== undefined) {
    db[req.params.id].data = normalizeBoardData(req.body.data);
    captureBoardVersion(db[req.params.id], { actorId: req.user?.id || null, reason: 'save' });
    dataChanged = true;
  }
  if (nameChanged || dataChanged) {
    db[req.params.id].revision = (Number(db[req.params.id].revision) || 1) + 1;
  }
  db[req.params.id].updated_at = now();
  writeDB(db);
  if (dataChanged) {
    semantic.scheduleRebuild(board.id, db[req.params.id].data, {
      trigger: 'board.save',
      nowSec: db[req.params.id].updated_at,
    });
    // Update note embeddings
    const boardData = db[req.params.id].data;
    if (boardData && Array.isArray(boardData.nodes)) {
      boardData.nodes.filter(n => n.type === 'note' && n.text).forEach(note => {
        embeddings.updateNoteEmbedding(board.id, note.id, note.text).catch(e => console.error('[embeddings] push failed', e.message));
      });
    }
  }
  if (nameChanged) {
    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.rename',
      details: { from: prevName, to: db[req.params.id].name },
    });
  }
  if (dataChanged) {
    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.save',
      details: {},
    });
  }
  res.json({
    success: true,
    revision: db[req.params.id].revision,
    updated_at: db[req.params.id].updated_at,
  });
});

app.delete('/api/boards/:id', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (board && !canManageBoard(board, req.user)) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  if (board) {
    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.delete',
      details: { name: board.name || null },
    });
  }
  delete db[req.params.id];
  writeDB(db);
  if (board) {
    try {
      semantic.clearBoardSemantic(board.id);
    } catch (err) {
      console.error(`[semantic] cleanup failed board=${board.id}`, err?.message || err);
    }
  }
  res.json({ success: true });
});

app.get('/api/boards/:id/members', requireAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canManageBoard(board, req.user)) return res.status(403).json({ error: 'Owner access required' });
  if (!board.userId) return res.status(400).json({ error: 'Legacy public board cannot use RBAC members' });

  res.json({
    boardId: board.id,
    members: boardMembersForClient(board),
  });
});

app.put('/api/boards/:id/members', requireAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canManageBoard(board, req.user)) return res.status(403).json({ error: 'Owner access required' });
  if (!board.userId) return res.status(400).json({ error: 'Legacy public board cannot use RBAC members' });

  const email = String(req.body?.email || '').toLowerCase().trim();
  const role = normalizeBoardRole(req.body?.role);
  if (!email) return res.status(400).json({ error: 'email is required' });
  if (!role || role === 'owner') return res.status(400).json({ error: 'role must be editor or viewer' });

  const users = readUsers();
  const target = Object.values(users).find(u => u.email === email);
  if (!target) return res.status(404).json({ error: 'User not found for this email' });
  if (target.id === board.userId) return res.status(400).json({ error: 'Owner role is managed separately' });

  ensureBoardMembersShape(board);
  const idx = board.members.findIndex(m => m.userId === target.id);
  let auditAction = 'board.member.add';
  let prevRole = null;
  if (idx >= 0) {
    prevRole = board.members[idx].role;
    board.members[idx] = {
      ...board.members[idx],
      role,
      added_by: req.user.id,
      added_at: now(),
    };
    auditAction = prevRole === role ? 'board.member.add' : 'board.member.role';
  } else {
    board.members.push({
      userId: target.id,
      role,
      added_by: req.user.id,
      added_at: now(),
    });
  }
  board.updated_at = now();
  writeDB(db);
  appendAuditEvent({
    boardId: board.id,
    actorId: req.user?.id || null,
    action: auditAction,
    details: {
      targetUserId: target.id,
      email: target.email,
      fromRole: prevRole,
      toRole: role,
    },
  });

  res.json({
    success: true,
    boardId: board.id,
    members: boardMembersForClient(board),
  });
});

app.delete('/api/boards/:id/members/:userId', requireAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canManageBoard(board, req.user)) return res.status(403).json({ error: 'Owner access required' });
  if (!board.userId) return res.status(400).json({ error: 'Legacy public board cannot use RBAC members' });
  if (req.params.userId === board.userId) return res.status(400).json({ error: 'Cannot remove owner from board' });

  ensureBoardMembersShape(board);
  const prevLen = board.members.length;
  const removed = board.members.find(m => m.userId === req.params.userId) || null;
  board.members = board.members.filter(m => m.userId !== req.params.userId);
  if (board.members.length !== prevLen) {
    board.updated_at = now();
    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.member.remove',
      details: {
        targetUserId: req.params.userId,
        fromRole: removed?.role || null,
      },
    });
  }
  writeDB(db);

  res.json({
    success: true,
    boardId: board.id,
    members: boardMembersForClient(board),
  });
});

app.get('/api/boards/:id/audit', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  const actions = String(req.query.action || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const minTs = Number(req.query.min_ts) || 0;
  const actorId = String(req.query.actorId || '').trim();

  const events = enrichAuditEvents(listBoardAuditEvents(board.id, {
    limit: req.query.limit,
    actions,
    actorId,
    minTs,
  }));
  res.json({
    boardId: board.id,
    count: events.length,
    events,
  });
});

app.get('/api/boards/:id/semantic', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  const entityLimit = clampInt(req.query.entityLimit, 500, 1, 5000);
  const relationLimit = clampInt(req.query.relationLimit, 500, 1, 5000);
  const issueLimit = clampInt(req.query.issueLimit, 500, 1, 5000);
  const entityOffset = clampInt(req.query.entityOffset, 0, 0, 1_000_000);
  const relationOffset = clampInt(req.query.relationOffset, 0, 0, 1_000_000);

  if (!semantic.hasSnapshot(board.id)) {
    try {
      semantic.rebuildNow(board.id, normalizeBoardData(board.data), {
        trigger: 'semantic.lazy_get',
      });
    } catch (err) {
      return res.status(500).json({ error: err?.message || 'Semantic rebuild failed' });
    }
  }

  try {
    const payload = semantic.getBoardSemantic(board.id, {
      entityLimit,
      relationLimit,
      issueLimit,
      entityOffset,
      relationOffset,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Failed to fetch semantic board' });
  }
});

app.post('/api/boards/:id/semantic/rebuild', optAuth, (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canEditBoard(board, req.user)) return res.status(403).json({ error: 'Edit access required' });

  try {
    const rebuilt = semantic.rebuildNow(board.id, normalizeBoardData(board.data), {
      trigger: 'semantic.api_rebuild',
      actorId: req.user?.id || null,
    });
    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.semantic.rebuild',
      details: {
        entities: rebuilt.entitiesCount,
        relations: rebuilt.relationsCount,
        healthScore: rebuilt.health.healthScore,
        trigger: 'api',
      },
    });
    res.json({
      boardId: board.id,
      counts: {
        entities: rebuilt.entitiesCount,
        relations: rebuilt.relationsCount,
      },
      health: rebuilt.health,
      took_ms: rebuilt.tookMs,
    });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Semantic rebuild failed' });
  }
});

app.post('/api/boards/:id/integrations/jira/import', optAuth, async (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  const siteInfo = normalizeJiraSite(req.body?.site);
  if (!siteInfo) return res.status(400).json({ error: 'site must be a valid Jira base URL (ex: https://company.atlassian.net)' });

  const auth = jiraAuthFromReq(req);
  if (!auth) {
    return res.status(400).json({ error: 'Jira auth is required (jiraEmail + jiraToken, request override or JIRA_* env)' });
  }

  const state = ['open', 'closed', 'all'].includes(String(req.body?.state || '').toLowerCase())
    ? String(req.body.state).toLowerCase()
    : 'open';
  const projectKey = normalizeJiraProjectKey(req.body?.projectKey || req.body?.project);
  const customJql = safeIssueText(req.body?.jql || '', 600);
  if (!projectKey && !customJql) {
    return res.status(400).json({ error: 'projectKey or jql is required for Jira import' });
  }

  const maxResults = Math.max(1, Math.min(100, Number(req.body?.maxResults) || 80));
  const syncKey = jiraSyncKey(siteInfo, projectKey || '__custom__');
  const syncState = getJiraProjectSyncState(board, syncKey);

  try {
    const jqlParts = [];
    if (customJql) {
      jqlParts.push(customJql);
    } else {
      jqlParts.push(`project = "${projectKey}"`);
      if (state === 'open') jqlParts.push('statusCategory != Done');
      if (state === 'closed') jqlParts.push('statusCategory = Done');
    }
    const jql = `${jqlParts.join(' AND ')} ORDER BY updated DESC`;

    const searchPayload = {
      jql,
      maxResults,
      fields: [
        'summary',
        'description',
        'assignee',
        'priority',
        'status',
        'duedate',
        'fixVersions',
        'issuelinks',
        'updated',
      ],
    };

    const result = await jiraRequest(siteInfo.base, '/rest/api/3/search/jql', {
      method: 'POST',
      auth,
      body: searchPayload,
    });
    const issues = Array.isArray(result?.issues) ? result.issues : [];

    const milestoneMap = new Map();
    const milestones = [];
    const registerMilestone = fixVersion => {
      const title = safeIssueText(fixVersion?.name || '', 120);
      if (!title) return null;
      const key = title.toLowerCase();
      if (milestoneMap.has(key)) return milestoneMap.get(key);
      const id = `m${milestones.length + 1}`;
      milestoneMap.set(key, id);
      milestones.push({
        id,
        title,
        targetDate: safeIssueText(fixVersion?.releaseDate || '', 24) || 'TBD',
        status: fixVersion?.released ? 'done' : 'planned',
      });
      return id;
    };

    let latestIssueUpdatedAt = syncState.last_issue_updated_at || '';
    const tasks = issues.map(issue => {
      const fields = issue?.fields || {};
      const issueKey = safeIssueText(issue?.key || '', 40);
      const statusValue = jiraStatusToExec(fields);
      const stageValue = jiraStageToExec(fields, statusValue);
      const primaryFix = Array.isArray(fields.fixVersions) ? (fields.fixVersions[0] || null) : null;
      const milestoneId = registerMilestone(primaryFix);
      const issueUpdatedAt = safeIssueText(fields?.updated || '', 48);
      latestIssueUpdatedAt = maxIso(latestIssueUpdatedAt, issueUpdatedAt);
      const dueDate = safeIssueText(fields?.duedate || primaryFix?.releaseDate || '', 24) || 'TBD';

      return {
        id: `jira-${issueKey || `tmp-${uuidv4().slice(0, 8)}`}`,
        title: safeIssueText(fields?.summary || issueKey || 'Jira issue', 240),
        description: jiraDescriptionToText(fields?.description, 220),
        stage: stageValue,
        owner: safeIssueText(fields?.assignee?.displayName || fields?.assignee?.emailAddress || 'TBD', 80) || 'TBD',
        priority: jiraPriorityToExec(fields),
        status: statusValue,
        dueDate,
        milestoneId: milestoneId || null,
        milestoneTitle: safeIssueText(primaryFix?.name || '', 120),
        dependsOn: extractJiraDependenciesFromIssue(issue),
        risk: statusValue === 'blocked' ? 'Blocked Jira issue requires unblock action' : '',
        sourceRefs: [
          issueKey,
          `${siteInfo.base}/browse/${encodeURIComponent(issueKey)}`,
        ].filter(Boolean),
        issueNumber: null,
        issueUrl: `${siteInfo.base}/browse/${encodeURIComponent(issueKey)}`,
        issueState: statusValue,
        issueUpdatedAt,
        repo: `jira:${siteInfo.host}/${projectKey || 'custom'}`.toLowerCase(),
      };
    });

    const risks = tasks
      .filter(t => t.risk || t.status === 'blocked' || t.priority === 'P0')
      .slice(0, 12)
      .map((task, i) => ({
        id: `r${i + 1}`,
        title: `Issue ${task.sourceRefs?.[0] || task.id}: ${task.title}`,
        impact: task.priority === 'P0' ? 'high' : (task.priority === 'P1' ? 'medium' : 'low'),
        mitigation: task.status === 'blocked' ? 'Clarify dependency and assign unblock owner' : 'Review priority and mitigation plan',
        owner: task.owner || 'TBD',
        status: 'open',
        taskIds: [task.id],
      }));

    const plan = {
      title: `Jira Execution Sync: ${projectKey || siteInfo.host}`,
      objectives: [
        `Sync active work from Jira ${projectKey || siteInfo.host}`,
        'Create a shared execution board for product + engineering',
      ],
      milestones,
      tasks,
      risks,
      message: `Imported ${issues.length} Jira issues from ${projectKey || siteInfo.host}.`,
      summary: `${tasks.length} issues mapped (${state})`,
    };

    const syncNow = now();
    const syncIso = isoNow();
    const nextSyncState = setJiraProjectSyncState(board, syncKey, {
      last_import_at: syncNow,
      last_import_iso: syncIso,
      last_issue_updated_at: latestIssueUpdatedAt || syncState.last_issue_updated_at || '',
      last_pull_count: tasks.length,
      site: siteInfo.base,
      projectKey: projectKey || '',
      jql: customJql || '',
      state,
    });
    board.updated_at = syncNow;
    writeDB(db);

    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.jira.import',
      details: {
        site: siteInfo.base,
        host: siteInfo.host,
        projectKey: projectKey || null,
        state,
        imported: issues.length,
        totalMapped: tasks.length,
      },
    });

    return res.json({
      boardId: board.id,
      site: siteInfo.base,
      projectKey: projectKey || null,
      state,
      fetched_count: issues.length,
      count: tasks.length,
      jql,
      sync: nextSyncState,
      plan,
    });
  } catch (error) {
    return res.status(error.status || 502).json({
      error: error.message || 'Jira import failed',
    });
  }
});

app.post('/api/boards/:id/integrations/github/import', optAuth, async (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canReadBoard(board, req.user)) return res.status(403).json({ error: 'Access denied' });

  const repoInfo = parseRepoFullName(req.body?.repo);
  if (!repoInfo) return res.status(400).json({ error: 'repo must be in format "owner/repo"' });

  const token = githubTokenFromReq(req);
  if (!token) {
    return res.status(400).json({ error: 'GitHub token is required (request token or GITHUB_TOKEN env)' });
  }

  const key = repoKey(repoInfo);
  const actorId = String(req.user?.id || 'anon');
  const idempotencyKey = idempotencyKeyFromReq(req);
  const syncState = getGitHubRepoSyncState(board, key);
  const state = ['open', 'closed', 'all'].includes(String(req.body?.state || '').toLowerCase())
    ? String(req.body.state).toLowerCase()
    : 'open';
  const incremental = req.body?.incremental !== false;
  const sinceFromReq = parseSinceInput(req.body?.since);
  const sinceIso = sinceFromReq || (incremental ? syncState.last_issue_updated_at : '');
  const perPage = Math.max(1, Math.min(100, Number(req.body?.perPage) || 80));

  if (idempotencyKey) {
    const replay = readGitHubIdempotencyResult(board, idempotencyKey, 'github_import', key, actorId);
    if (replay) {
      return res.json({
        ...replay,
        idempotency: {
          key: idempotencyKey,
          replayed: true,
        },
      });
    }
    const pending = readGitHubIdempotencyEntry(board, idempotencyKey, 'github_import', key, actorId);
    if (pending?.status === 'pending') {
      return res.status(409).json({
        error: 'A request with this idempotency key is already in progress',
        idempotency: {
          key: idempotencyKey,
          status: 'pending',
        },
      });
    }
    markGitHubIdempotencyPending(board, idempotencyKey, 'github_import', key, actorId);
    writeDB(db);
  }

  try {
    const q = new URLSearchParams();
    q.set('state', state);
    q.set('per_page', String(perPage));
    q.set('sort', 'updated');
    q.set('direction', 'desc');
    if (sinceIso) q.set('since', sinceIso);

    const rows = await githubRequest(
      `/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/issues?${q.toString()}`,
      { method: 'GET', token },
    );
    const issues = (Array.isArray(rows) ? rows : []).filter(x => !x?.pull_request);

    const milestoneMap = new Map();
    const milestones = [];
    const registerMilestoneByTitle = (title, details = {}) => {
      const t = safeIssueText(title || '', 120);
      if (!t) return null;
      const keyTitle = t.toLowerCase();
      if (milestoneMap.has(keyTitle)) return milestoneMap.get(keyTitle);
      const id = `m${milestones.length + 1}`;
      milestoneMap.set(keyTitle, id);
      milestones.push({
        id,
        title: t,
        targetDate: details.targetDate || 'TBD',
        status: details.status || 'planned',
      });
      return id;
    };
    const registerMilestone = m => registerMilestoneByTitle(m?.title, {
      targetDate: m?.due_on ? String(m.due_on).slice(0, 10) : 'TBD',
      status: m?.state === 'closed' ? 'done' : 'planned',
    });

    let latestIssueUpdatedAt = syncState.last_issue_updated_at || '';
    const incomingTasks = issues.map(issue => {
      latestIssueUpdatedAt = maxIso(latestIssueUpdatedAt, issue.updated_at || '');
      const labels = githubLabelsToNames(issue.labels);
      const lowerLabels = labels.map(x => x.toLowerCase());
      const milestoneId = registerMilestone(issue.milestone);
      const owner = issue.assignees?.[0]?.login || issue.assignee?.login || 'TBD';
      const statusValue = issueStatusFrom(labels, issue.state);
      const riskText = lowerLabels.some(l => /(risk|security|incident)/.test(l))
        ? 'Risk label present on issue'
        : (statusValue === 'blocked' ? 'Blocked issue requires unblock action' : '');
      return {
        id: `gh-${issue.number}`,
        title: safeIssueText(issue.title, 240),
        description: shortIssueBody(issue.body || ''),
        stage: issueStageFromLabels(labels, issue),
        owner,
        priority: issuePriorityFromLabels(labels),
        status: statusValue,
        dueDate: issue.milestone?.due_on ? String(issue.milestone.due_on).slice(0, 10) : 'TBD',
        milestoneId: milestoneId || null,
        milestoneTitle: safeIssueText(issue.milestone?.title || '', 120),
        dependsOn: extractDependenciesFromIssueBody(issue.body || '', repoInfo),
        risk: riskText,
        sourceRefs: [`#${issue.number}`, issue.html_url].filter(Boolean),
        issueNumber: issue.number,
        issueUrl: issue.html_url,
        issueState: issue.state,
        issueUpdatedAt: issue.updated_at || '',
        repo: repoInfo.full.toLowerCase(),
      };
    });

    let tasks = incomingTasks;
    if (incremental) {
      const existingTasks = (Array.isArray(board?.data?.nodes) ? board.data.nodes : [])
        .map(parseExecutionNodeTask)
        .filter(Boolean)
        .filter(task => Number.isInteger(Number(task.issueNumber)) && taskBelongsToRepo(task, repoInfo))
        .map(task => ({
          id: String(task.taskId || `gh-${task.issueNumber}`),
          title: safeIssueText(task.title || `Issue #${task.issueNumber}`, 240),
          description: safeIssueText(task.description || '', 220),
          stage: normalizeGithubStage(task.stage, null),
          owner: safeIssueText(task.owner || 'TBD', 80) || 'TBD',
          priority: normalizeExecPriority(task.priority),
          status: normalizeExecStatus(task.status),
          dueDate: safeIssueText(task.dueDate || 'TBD', 40) || 'TBD',
          milestoneId: null,
          milestoneTitle: safeIssueText(task.milestoneTitle || '', 120),
          dependsOn: [],
          risk: '',
          sourceRefs: Array.isArray(task.sourceRefs) ? task.sourceRefs : [],
          issueNumber: Number(task.issueNumber),
          issueUrl: (Array.isArray(task.sourceRefs) ? task.sourceRefs.find(x => /https?:\/\//i.test(String(x || ''))) : '') || '',
          issueState: task.status === 'done' ? 'closed' : 'open',
          issueUpdatedAt: task.issueUpdatedAt || '',
          repo: task.repo || repoInfo.full.toLowerCase(),
        }));

      const byIssue = new Map(existingTasks.map(t => [Number(t.issueNumber), t]));
      for (const task of incomingTasks) {
        const cur = byIssue.get(Number(task.issueNumber));
        byIssue.set(Number(task.issueNumber), {
          ...(cur || {}),
          ...task,
          id: cur?.id || task.id,
        });
      }
      tasks = [...byIssue.values()].sort((a, b) => Number(b.issueNumber || 0) - Number(a.issueNumber || 0));
    }

    for (const task of tasks) {
      if (task.milestoneId) continue;
      if (task.milestoneTitle) {
        task.milestoneId = registerMilestoneByTitle(task.milestoneTitle, { targetDate: 'TBD', status: 'planned' });
      }
    }

    const risks = tasks
      .filter(t => t.risk || t.status === 'blocked')
      .slice(0, 12)
      .map((task, i) => ({
        id: `r${i + 1}`,
        title: `Issue ${task.sourceRefs?.[0] || task.id}: ${task.title}`,
        impact: task.priority === 'P0' ? 'high' : (task.priority === 'P1' ? 'medium' : 'low'),
        mitigation: task.status === 'blocked' ? 'Clarify dependency and assign unblock owner' : 'Review risk label and mitigation plan',
        owner: task.owner || 'TBD',
        status: 'open',
        taskIds: [task.id],
      }));

    const plan = {
      title: `GitHub Execution Sync: ${repoInfo.full}`,
      objectives: [
        `Sync active work from ${repoInfo.full}`,
        'Create a shared execution board for product + engineering',
      ],
      milestones,
      tasks,
      risks,
      message: `Imported ${issues.length} GitHub issues from ${repoInfo.full}${sinceIso ? ' (incremental)' : ''}.`,
      summary: `${tasks.length} issues mapped (${state})`,
    };

    const syncNow = now();
    const syncIso = isoNow();
    const nextSyncState = setGitHubRepoSyncState(board, key, {
      last_import_at: syncNow,
      last_import_iso: syncIso,
      last_issue_updated_at: latestIssueUpdatedAt || syncState.last_issue_updated_at || '',
      last_pull_count: tasks.length,
    });
    const responsePayload = {
      boardId: board.id,
      repo: repoInfo.full,
      state,
      incremental,
      since: sinceIso || null,
      fetched_count: issues.length,
      count: tasks.length,
      sync: nextSyncState,
      plan,
      idempotency: idempotencyKey ? { key: idempotencyKey, replayed: false } : null,
    };

    if (idempotencyKey) {
      markGitHubIdempotencyDone(board, idempotencyKey, 'github_import', key, actorId, responsePayload);
    }
    board.updated_at = syncNow;
    writeDB(db);

    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.github.import',
      details: {
        repo: repoInfo.full,
        state,
        imported: issues.length,
        totalMapped: tasks.length,
        incremental,
        since: sinceIso || null,
      },
    });

    return res.json(responsePayload);
  } catch (error) {
    if (idempotencyKey) {
      clearGitHubIdempotencyKey(board, idempotencyKey);
      writeDB(db);
    }
    return res.status(error.status || 502).json({
      error: error.message || 'GitHub import failed',
    });
  }
});

app.post('/api/boards/:id/integrations/github/push', optAuth, async (req, res) => {
  const db = readDB();
  const board = db[req.params.id];
  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (!canEditBoard(board, req.user)) return res.status(403).json({ error: 'Edit access required' });

  const repoInfo = parseRepoFullName(req.body?.repo);
  if (!repoInfo) return res.status(400).json({ error: 'repo must be in format "owner/repo"' });

  const token = githubTokenFromReq(req);
  if (!token) {
    return res.status(400).json({ error: 'GitHub token is required (request token or GITHUB_TOKEN env)' });
  }

  const key = repoKey(repoInfo);
  const actorId = String(req.user?.id || 'anon');
  const idempotencyKey = idempotencyKeyFromReq(req);
  const syncState = getGitHubRepoSyncState(board, key);
  const conflictStrategyRaw = String(req.body?.conflictStrategy || 'skip_remote_newer').toLowerCase();
  const conflictStrategy = ['skip_remote_newer', 'prefer_board', 'prefer_remote'].includes(conflictStrategyRaw)
    ? conflictStrategyRaw
    : 'skip_remote_newer';

  const sourceTasks = Array.isArray(req.body?.tasks) && req.body.tasks.length
    ? req.body.tasks
    : (Array.isArray(board?.data?.nodes) ? board.data.nodes.map(parseExecutionNodeTask).filter(Boolean) : []);
  const tasks = sourceTasks
    .map((raw, i) => sanitizeSyncTask(raw, i))
    .filter(Boolean)
    .filter(task => !task.repo || String(task.repo).toLowerCase() === key || taskBelongsToRepo(task, repoInfo))
    .filter(t => t.title);
  if (!tasks.length) return res.status(400).json({ error: 'No execution tasks provided for sync' });

  if (idempotencyKey) {
    const replay = readGitHubIdempotencyResult(board, idempotencyKey, 'github_push', key, actorId);
    if (replay) {
      return res.json({
        ...replay,
        idempotency: {
          key: idempotencyKey,
          replayed: true,
        },
      });
    }
    const pending = readGitHubIdempotencyEntry(board, idempotencyKey, 'github_push', key, actorId);
    if (pending?.status === 'pending') {
      return res.status(409).json({
        error: 'A request with this idempotency key is already in progress',
        idempotency: {
          key: idempotencyKey,
          status: 'pending',
        },
      });
    }
    markGitHubIdempotencyPending(board, idempotencyKey, 'github_push', key, actorId);
    writeDB(db);
  }

  try {
    const milestoneSync = await reconcileGitHubMilestones(repoInfo, token, tasks);
    const milestoneTitleToNumber = milestoneSync.milestoneTitleToNumber;

    const linked = [];
    const warnings = [...(milestoneSync.warnings || [])];
    let created = 0;
    let updated = 0;
    let conflicts = 0;
    let skipped = 0;
    let latestIssueUpdatedAt = syncState.last_issue_updated_at || '';

    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      const stateValue = task.status === 'done' ? 'closed' : 'open';
      const payloadBase = {
        title: safeIssueText(task.title, 240),
        body: buildIssueBodyFromTask(task),
        state: stateValue,
        labels: buildIssueLabelsFromTask(task),
      };

      const owner = String(task.owner || '').trim();
      const assignees = /^@[A-Za-z0-9-]+$/.test(owner) ? [owner.slice(1)] : [];
      if (assignees.length) payloadBase.assignees = assignees;

      const msKey = String(task.milestoneTitle || '').trim().toLowerCase();
      if (msKey && milestoneTitleToNumber.has(msKey)) {
        payloadBase.milestone = milestoneTitleToNumber.get(msKey);
      }

      const upsert = async (apiPath, method, payload) => {
        try {
          return await githubRequest(apiPath, { method, token, body: payload });
        } catch (err) {
          if (payload.assignees && Array.isArray(payload.assignees) && payload.assignees.length) {
            const retryPayload = { ...payload };
            delete retryPayload.assignees;
            return githubRequest(apiPath, { method, token, body: retryPayload });
          }
          throw err;
        }
      };

      try {
        let issue = null;
        if (task.issueNumber) {
          let remoteIssue = null;
          try {
            remoteIssue = await githubRequest(
              `/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/issues/${task.issueNumber}`,
              { method: 'GET', token },
            );
          } catch (err) {
            if (Number(err?.status) === 404) {
              warnings.push(`Task "${task.title}" linked issue #${task.issueNumber} not found; creating a new issue.`);
            } else {
              throw err;
            }
          }

          if (remoteIssue) {
            const localAnchor = task.issueUpdatedAt || task.lastSyncedAt || '';
            const remoteNewer = isRemoteNewer(remoteIssue?.updated_at || '', localAnchor);
            if (remoteNewer && conflictStrategy !== 'prefer_board') {
              conflicts += 1;
              skipped += 1;
              latestIssueUpdatedAt = maxIso(latestIssueUpdatedAt, remoteIssue?.updated_at || '');
              warnings.push(
                conflictStrategy === 'prefer_remote'
                  ? `Task "${task.title}" kept remote state (GitHub newer than board).`
                  : `Task "${task.title}" skipped due to conflict (GitHub newer than board).`,
              );
              linked.push({
                nodeId: task.nodeId || null,
                taskId: task.taskId,
                issueNumber: remoteIssue?.number || task.issueNumber || null,
                issueUrl: remoteIssue?.html_url || null,
                issueState: remoteIssue?.state || null,
                issueTitle: remoteIssue?.title || task.title,
                issueUpdatedAt: remoteIssue?.updated_at || '',
                skipped: true,
                reason: 'remote_newer',
              });
              continue;
            }

            issue = await upsert(
              `/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/issues/${task.issueNumber}`,
              'PATCH',
              payloadBase,
            );
            updated += 1;
          }
        }

        if (!issue) {
          const createPayload = { ...payloadBase };
          delete createPayload.state;
          issue = await upsert(
            `/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/issues`,
            'POST',
            createPayload,
          );
          if (stateValue === 'closed' && issue?.number) {
            issue = await upsert(
              `/repos/${encodeURIComponent(repoInfo.owner)}/${encodeURIComponent(repoInfo.repo)}/issues/${issue.number}`,
              'PATCH',
              { state: 'closed' },
            );
          }
          created += 1;
        }

        latestIssueUpdatedAt = maxIso(latestIssueUpdatedAt, issue?.updated_at || '');

        linked.push({
          nodeId: task.nodeId || null,
          taskId: task.taskId,
          issueNumber: issue?.number || task.issueNumber || null,
          issueUrl: issue?.html_url || null,
          issueState: issue?.state || stateValue,
          issueTitle: issue?.title || payloadBase.title,
          issueUpdatedAt: issue?.updated_at || '',
        });
      } catch (error) {
        warnings.push(`Task "${task.title}" failed: ${error.message || 'unknown error'}`);
      }
    }

    const syncNow = now();
    const syncIso = isoNow();
    const nextSyncState = setGitHubRepoSyncState(board, key, {
      last_push_at: syncNow,
      last_push_iso: syncIso,
      last_issue_updated_at: latestIssueUpdatedAt || syncState.last_issue_updated_at || '',
      last_push_count: created + updated,
      last_conflicts: conflicts,
      last_conflict_strategy: conflictStrategy,
    });
    const responsePayload = {
      boardId: board.id,
      repo: repoInfo.full,
      pushed: tasks.length,
      created,
      updated,
      skipped,
      conflicts,
      conflictStrategy,
      warnings,
      linked,
      milestones: milestoneSync.stats,
      sync: nextSyncState,
      idempotency: idempotencyKey ? { key: idempotencyKey, replayed: false } : null,
    };

    if (idempotencyKey) {
      markGitHubIdempotencyDone(board, idempotencyKey, 'github_push', key, actorId, responsePayload);
    }
    board.updated_at = syncNow;
    writeDB(db);

    appendAuditEvent({
      boardId: board.id,
      actorId: req.user?.id || null,
      action: 'board.github.push',
      details: {
        repo: repoInfo.full,
        created,
        updated,
        skipped,
        conflicts,
        conflictStrategy,
        warnings: warnings.length,
        milestones: milestoneSync.stats,
      },
    });

    return res.json(responsePayload);
  } catch (error) {
    if (idempotencyKey) {
      clearGitHubIdempotencyKey(board, idempotencyKey);
      writeDB(db);
    }
    return res.status(error.status || 502).json({
      error: error.message || 'GitHub push failed',
    });
  }
});

app.post('/api/ai/complete', optAuth, aiRateLimit, async (req, res) => {
  const startedAt = Date.now();
  aiMetrics.requests += 1;
  const { systemPrompt, userPrompt, maxTokens } = req.body || {};

  const respondWithFallback = (reason, statusCode = 200) => {
    const safeReason = String(reason || 'provider_unavailable');
    const fallbackPayload = buildAiFallbackPayload(systemPrompt, userPrompt, safeReason);
    aiMetrics.errors += 1;
    aiMetrics.fallback += 1;
    aiMetrics.last_error = safeReason;
    aiMetrics.last_error_at = now();
    aiMetrics.last_fallback_reason = safeReason;
    aiMetrics.last_model = 'fallback-local';
    aiMetrics.last_usage = null;
    aiMetrics.last_latency_ms = Date.now() - startedAt;
    if (safeReason) {
      console.warn(`[ai] fallback response used: ${safeReason}`);
    }
    return res.status(statusCode).json({
      text: JSON.stringify(fallbackPayload),
      json: fallbackPayload,
      repaired: false,
      model: 'fallback-local',
      usage: null,
      fallback: true,
      fallback_reason: safeReason,
    });
  };

  if (!DEEPSEEK_API_KEY) {
    if (AI_ALLOW_FALLBACK) {
      return respondWithFallback('Missing DEEPSEEK_API_KEY in backend environment');
    }
    aiMetrics.errors += 1;
    aiMetrics.last_error = 'Missing DEEPSEEK_API_KEY in backend environment';
    aiMetrics.last_error_at = now();
    aiMetrics.last_latency_ms = Date.now() - startedAt;
    return res.status(500).json({ error: 'Missing DEEPSEEK_API_KEY in backend environment' });
  }

  if (!userPrompt || typeof userPrompt !== 'string') {
    aiMetrics.errors += 1;
    aiMetrics.last_error = 'userPrompt is required';
    aiMetrics.last_error_at = now();
    aiMetrics.last_latency_ms = Date.now() - startedAt;
    return res.status(400).json({ error: 'userPrompt is required' });
  }

  const messages = [];
  if (typeof systemPrompt === 'string' && systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }
  messages.push({ role: 'user', content: userPrompt });

  const firstBudget = Math.max(3000, Math.min(DEEPSEEK_TIMEOUT_MS, aiDeadlineRemaining(startedAt) - 1000));
  let result = await deepseekChatCompletion(messages, maxTokens, { jsonMode: true, temperature: 0, timeoutMs: firstBudget });
  if (!result.ok && supportsJsonModeError(result.detail) && !isAiTimeoutResult(result) && aiDeadlineRemaining(startedAt) > 3500) {
    const secondBudget = Math.max(3000, Math.min(DEEPSEEK_TIMEOUT_MS, aiDeadlineRemaining(startedAt) - 1000));
    result = await deepseekChatCompletion(messages, maxTokens, { jsonMode: false, temperature: 0, timeoutMs: secondBudget });
  }
  if (!result.ok) {
    if (AI_ALLOW_FALLBACK) {
      return respondWithFallback(result.detail || 'DeepSeek request failed');
    }
    aiMetrics.errors += 1;
    aiMetrics.last_error = result.detail || 'DeepSeek request failed';
    aiMetrics.last_error_at = now();
    aiMetrics.last_latency_ms = Date.now() - startedAt;
    return res.status(result.status || 502).json({ error: result.detail || 'DeepSeek request failed' });
  }

  let parsed = parseJsonFromModelText(result.text);
  let repaired = false;

  if (!parsed && !isAiTimeoutResult(result) && aiDeadlineRemaining(startedAt) > 3500) {
    const repairMessages = [
      {
        role: 'system',
        content: 'Convert the input into one valid JSON object only. No markdown. No explanation. Keep semantics.',
      },
      { role: 'user', content: result.text },
    ];

    const repairBudget = Math.max(3000, Math.min(DEEPSEEK_TIMEOUT_MS, aiDeadlineRemaining(startedAt) - 1000));
    let repair = await deepseekChatCompletion(repairMessages, 1200, { jsonMode: true, temperature: 0, timeoutMs: repairBudget });
    if (!repair.ok && supportsJsonModeError(repair.detail) && !isAiTimeoutResult(repair) && aiDeadlineRemaining(startedAt) > 3500) {
      const repairRetryBudget = Math.max(3000, Math.min(DEEPSEEK_TIMEOUT_MS, aiDeadlineRemaining(startedAt) - 1000));
      repair = await deepseekChatCompletion(repairMessages, 1200, { jsonMode: false, temperature: 0, timeoutMs: repairRetryBudget });
    }
    if (repair.ok) {
      parsed = parseJsonFromModelText(repair.text);
      if (parsed) {
        repaired = true;
        result = repair;
      }
    }
  }

  if (!parsed) {
    if (AI_ALLOW_FALLBACK) {
      return respondWithFallback('DeepSeek returned invalid JSON');
    }
    aiMetrics.errors += 1;
    aiMetrics.last_error = 'DeepSeek returned invalid JSON';
    aiMetrics.last_error_at = now();
    aiMetrics.last_latency_ms = Date.now() - startedAt;
    return res.status(502).json({
      error: 'DeepSeek returned invalid JSON',
      textPreview: String(result.text || '').slice(0, 320),
    });
  }

  aiMetrics.success += 1;
  aiMetrics.last_fallback_reason = '';
  if (repaired) aiMetrics.repaired += 1;
  aiMetrics.last_model = result.data?.model || DEEPSEEK_MODEL;
  aiMetrics.last_usage = result.data?.usage || null;
  aiMetrics.last_latency_ms = Date.now() - startedAt;

  return res.json({
    text: JSON.stringify(parsed),
    json: parsed,
    repaired,
    model: result.data?.model || DEEPSEEK_MODEL,
    usage: result.data?.usage || null,
  });
});

app.get('/api/health', (_, res) => {
  const db = readDB();
  const users = readUsers();
  const vaultSummary = vault.getSummary();
  res.json({
    status: 'ok',
    boards: Object.keys(db).length,
    users: Object.keys(users).length,
    uptime: Math.floor(process.uptime()),
    github: {
      oauth_configured: hasGitHubOauthConfig(),
      env_fallback_token: Boolean(GITHUB_TOKEN),
      api_base: GITHUB_API_BASE,
    },
    jira: {
      env_auth_configured: Boolean(JIRA_TOKEN),
      env_email_configured: Boolean(JIRA_EMAIL),
    },
    ai: {
      rate_window_sec: AI_RATE_WINDOW_SEC,
      rate_max: AI_RATE_MAX,
      timeout_ms: DEEPSEEK_TIMEOUT_MS,
      total_deadline_ms: AI_TOTAL_DEADLINE_MS,
      fallback_enabled: AI_ALLOW_FALLBACK,
      requests: aiMetrics.requests,
      success: aiMetrics.success,
      errors: aiMetrics.errors,
      fallback: aiMetrics.fallback,
      repaired: aiMetrics.repaired,
      rate_limited: aiMetrics.rate_limited,
      last_error: aiMetrics.last_error,
      last_error_at: aiMetrics.last_error_at || null,
      last_fallback_reason: aiMetrics.last_fallback_reason || null,
      last_model: aiMetrics.last_model || null,
      last_usage: aiMetrics.last_usage,
      last_latency_ms: aiMetrics.last_latency_ms || 0,
    },
    semantic: semantic.getMetrics(),
    vault: vaultSummary,
  });
});

// ── Socket.IO ─────────────────────────────────────────────
const socketBoard = new Map(); // socketId → boardId
const boardUsers = new Map();  // boardId → Map<socketId, {name,color,userId,role}>
const socketUsers = new Map(); // socketId → auth payload
const socketBoardAccess = new Map(); // socketId → { boardId, canRead, canEdit }
const PRESENCE_STATES = new Set(['active', 'idle', 'presenting']);

function normalizePresenceState(value) {
  const raw = String(value || '').trim().toLowerCase();
  return PRESENCE_STATES.has(raw) ? raw : 'active';
}

function sanitizeActivityEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = String(raw.type || '').trim().slice(0, 64);
  if (!type) return null;
  const entity = String(raw.entity || '').trim().slice(0, 64);
  const message = String(raw.message || '').trim().slice(0, 220);
  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : {};
  return {
    type,
    entity,
    message,
    payload,
    ts: Number.isFinite(raw.ts) ? raw.ts : Date.now(),
  };
}

function resolveSocketUser(socket, tokenFromEvent) {
  const fromAuth = socket.handshake?.auth?.token;
  const fromHeader = socket.handshake?.headers?.authorization;
  const raw = tokenFromEvent || fromAuth || fromHeader || '';
  if (!raw) return null;

  const token = String(raw).startsWith('Bearer ') ? String(raw).slice(7) : String(raw);
  return verifyToken(token);
}

function leaveSocketBoard(socket, expectedBoardId = null) {
  const prev = socketBoard.get(socket.id);
  if (!prev) return;
  if (expectedBoardId && expectedBoardId !== prev) return;

  const users = boardUsers.get(prev);
  const prevUser = users ? users.get(socket.id) : null;
  socket.leave(prev);
  if (users) {
    users.delete(socket.id);
    if (!users.size) boardUsers.delete(prev);
  }
  socket.to(prev).emit('cursor:leave', { socketId: socket.id });
  socket.to(prev).emit('user:left', {
    socketId: socket.id,
    userId: prevUser?.userId || null,
  });
  socketBoard.delete(socket.id);
  socketBoardAccess.delete(socket.id);
}

io.on('connection', socket => {
  console.log(`[WS +] ${socket.id}`);

  socket.on('board:join', ({ boardId, name, color, token }) => {
    const user = resolveSocketUser(socket, token);
    if (user) socketUsers.set(socket.id, user);
    else socketUsers.delete(socket.id);

    const db = readDB();
    const board = db[boardId];
    if (!board) {
      socket.emit('board:join:error', { error: 'Board not found', boardId });
      return;
    }
    if (!canReadBoard(board, user)) {
      socket.emit('board:join:error', { error: 'Access denied', boardId });
      return;
    }

    leaveSocketBoard(socket);

    const role = boardRoleForUser(board, user);
    const displayName = user?.name || name || 'User';
    const displayColor = user?.color || color || '#94a3b8';

    socket.join(boardId);
    socketBoard.set(socket.id, boardId);
    socketBoardAccess.set(socket.id, {
      boardId,
      canRead: true,
      canEdit: role === 'owner' || role === 'editor',
    });
    if (!boardUsers.has(boardId)) boardUsers.set(boardId, new Map());
    const now = Date.now();
    const userEntry = {
      name: displayName,
      color: displayColor,
      userId: user?.id || null,
      role,
      state: 'active',
      lastActiveAt: now,
    };
    boardUsers.get(boardId).set(socket.id, userEntry);

    const others = [...boardUsers.get(boardId)]
      .filter(([id]) => id !== socket.id)
      .map(([id, u]) => ({ socketId: id, ...u }));
    socket.emit('users:init', others);
    socket.to(boardId).emit('user:joined', {
      socketId: socket.id,
      name: displayName,
      color: displayColor,
      userId: user?.id || null,
      role,
      state: userEntry.state,
      lastActiveAt: userEntry.lastActiveAt,
    });
    socket.emit('board:joined', { boardId, role });
    console.log(`[WS] ${socket.id} (${displayName}, ${role}) → ${boardId}`);
  });

  socket.on('board:leave', boardId => {
    leaveSocketBoard(socket, boardId);
  });

  socket.on('board:sync', ({ boardId, state }) => {
    const access = socketBoardAccess.get(socket.id);
    if (!access || access.boardId !== boardId) return;
    if (!access.canEdit) {
      socket.emit('board:sync:error', { error: 'Edit access required', boardId });
      return;
    }
    const roomUsers = boardUsers.get(boardId);
    const me = roomUsers?.get(socket.id);
    if (me) {
      me.state = 'active';
      me.lastActiveAt = Date.now();
      roomUsers.set(socket.id, me);
    }
    socket.to(boardId).emit('board:update', state);
  });

  socket.on('cursor:move', ({ boardId, x, y }) => {
    const access = socketBoardAccess.get(socket.id);
    if (!access || access.boardId !== boardId || !access.canRead) return;
    const roomUsers = boardUsers.get(boardId);
    const me = roomUsers?.get(socket.id);
    if (me) {
      const wasIdle = me.state === 'idle';
      me.state = 'active';
      me.lastActiveAt = Date.now();
      roomUsers.set(socket.id, me);
      if (wasIdle) {
        socket.to(boardId).emit('user:presence', {
          socketId: socket.id,
          state: me.state,
          lastActiveAt: me.lastActiveAt,
        });
      }
    }
    socket.volatile.to(boardId).emit('cursor:update', { socketId: socket.id, x, y });
  });

  socket.on('presence:update', ({ boardId, state }) => {
    const access = socketBoardAccess.get(socket.id);
    if (!access || access.boardId !== boardId || !access.canRead) return;
    const roomUsers = boardUsers.get(boardId);
    const me = roomUsers?.get(socket.id);
    if (!me) return;
    me.state = normalizePresenceState(state);
    me.lastActiveAt = Date.now();
    roomUsers.set(socket.id, me);
    socket.to(boardId).emit('user:presence', {
      socketId: socket.id,
      state: me.state,
      lastActiveAt: me.lastActiveAt,
    });
  });

  socket.on('board:activity', ({ boardId, event }) => {
    const access = socketBoardAccess.get(socket.id);
    if (!access || access.boardId !== boardId || !access.canRead) return;
    const cleanEvent = sanitizeActivityEvent(event);
    if (!cleanEvent) return;
    const actor = boardUsers.get(boardId)?.get(socket.id) || {};
    io.to(boardId).emit('board:activity', {
      id: uuidv4(),
      socketId: socket.id,
      actor: {
        userId: actor.userId || null,
        name: actor.name || 'User',
        color: actor.color || '#94a3b8',
      },
      ...cleanEvent,
    });
  });

  socket.on('disconnect', () => {
    leaveSocketBoard(socket);
    socketUsers.delete(socket.id);
    console.log(`[WS -] ${socket.id}`);
  });
});

// ── Start ─────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\n  BoardAI Backend  ->  http://localhost:${PORT}`);
    console.log(`  Health check     ->  http://localhost:${PORT}/api/health\n`);
  });
}

module.exports = {
  app,
  server,
  semantic,
  readDB,
  writeDB,
};
