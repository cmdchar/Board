#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const os = require('os');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve('');
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(String(data || '').trim()));
  });
}

function configPath() {
  return path.join(os.homedir(), '.boardai-vault', 'config.json');
}

function loadConfig() {
  const p = configPath();
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(nextConfig) {
  const p = configPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(nextConfig, null, 2), 'utf8');
}

function mergeConfigAndArgs(config, args) {
  const tagsRaw = String(args.tags || '').trim();
  const tags = tagsRaw
    ? tagsRaw.split(',').map(item => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    server: String(args.server || process.env.BOARDAI_SERVER || config.server || '').trim(),
    token: String(args.token || process.env.BOARDAI_TOKEN || config.token || '').trim(),
    email: String(args.email || process.env.BOARDAI_EMAIL || config.email || '').trim(),
    password: String(args.password || process.env.BOARDAI_PASSWORD || config.password || '').trim(),
    source: String(args.source || process.env.BOARDAI_SOURCE || config.source || 'codex-cli').trim(),
    workspace: String(args.workspace || process.cwd()).trim(),
    project: String(args.project || '').trim(),
    projectSlug: String(args['project-slug'] || '').trim(),
    projectName: String(args['project-name'] || '').trim(),
    autoCreateProject: args['auto-create-project'] === undefined ? true : String(args['auto-create-project']).toLowerCase() !== 'false',
    scope: String(args.scope || '').trim(),
    category: String(args.category || '').trim(),
    title: String(args.title || '').trim(),
    username: String(args.username || '').trim(),
    secret: String(args.secret || '').trim(),
    url: String(args.url || '').trim(),
    notes: String(args.notes || '').trim(),
    notesFile: String(args['notes-file'] || '').trim(),
    tags,
  };
}

async function loginAndGetToken(server, email, password) {
  const resp = await fetch(`${server}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await resp.json().catch(() => ({}));
  if (!resp.ok || !payload?.token) {
    throw new Error(payload?.error || `Login failed (${resp.status})`);
  }
  return payload.token;
}

async function checkVaultAuth(server, token) {
  const response = await fetch(`${server}/api/vault/summary`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Auth check failed (${response.status})`);
  }

  return payload;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = loadConfig();
  const options = mergeConfigAndArgs(cfg, args);

  if (args['show-config']) {
    console.log(JSON.stringify({
      ...cfg,
      password: cfg.password ? '***' : '',
      token: cfg.token ? '***' : '',
    }, null, 2));
    return;
  }

  if (args['save-config']) {
    const next = {
      server: options.server || cfg.server || '',
      token: options.token || cfg.token || '',
      email: options.email || cfg.email || '',
      password: options.password || cfg.password || '',
      source: options.source || cfg.source || 'codex-cli',
    };
    saveConfig(next);
    console.log(`Saved config: ${configPath()}`);
    return;
  }

  if (!options.server) {
    throw new Error('Missing server. Use --server https://board.private-driver.ro or save config.');
  }

  if (args['check-auth']) {
    let token = options.token;
    if (!token) {
      if (!options.email || !options.password) {
        throw new Error('Missing auth. Provide --token OR --email + --password (or save config).');
      }
      token = await loginAndGetToken(options.server, options.email, options.password);
    }

    await checkVaultAuth(options.server, token);
    console.log(`Vault auth OK: ${options.server}`);
    return;
  }

  let text = String(args.text || '').trim();
  const file = String(args.file || '').trim();
  if (!text && file) {
    text = fs.readFileSync(path.resolve(file), 'utf8').trim();
  }
  if (!text) {
    text = await readStdin();
  }

  let notes = String(options.notes || '').trim();
  if (!notes && options.notesFile) {
    notes = fs.readFileSync(path.resolve(options.notesFile), 'utf8').trim();
  }

  const hasManualRecord = Boolean(
    options.title
    || options.secret
    || options.username
    || options.url
    || notes
  );

  if (!text && !hasManualRecord) {
    throw new Error('No input provided. Use --text/--file/stdin or explicit fields (--title/--notes/--secret/--username/--url).');
  }

  let token = options.token;
  if (!token) {
    if (!options.email || !options.password) {
      throw new Error('Missing auth. Provide --token OR --email + --password (or save config).');
    }
    token = await loginAndGetToken(options.server, options.email, options.password);
  }

  const projectName = options.projectName || options.project || '';
  const projectSlug = options.projectSlug || (!options.projectName && options.project && !options.project.includes(' ') ? options.project : '');

  const payload = {
    text,
    projectName: projectName || undefined,
    projectSlug: projectSlug || undefined,
    workspacePath: options.workspace || process.cwd(),
    source: options.source || 'codex-cli',
    autoCreateProject: options.autoCreateProject,
    scope: options.scope || undefined,
    category: options.category || undefined,
    title: options.title || undefined,
    username: options.username || undefined,
    secret: options.secret || undefined,
    url: options.url || undefined,
    notes: notes || undefined,
    tags: options.tags.length ? options.tags : undefined,
  };

  const response = await fetch(`${options.server}/api/vault/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Ingest failed (${response.status})`);
  }

  const created = Array.isArray(data?.created) ? data.created : [];
  const updated = Array.isArray(data?.updated) ? data.updated : [];
  const skipped = Array.isArray(data?.skipped) ? data.skipped : [];

  console.log(`Vault ingest OK`);
  console.log(`Project: ${data?.project?.name || 'GLOBAL'}`);
  console.log(`Created: ${created.length} | Updated: ${updated.length} | Skipped: ${skipped.length}`);
  if (created.length) {
    console.log('Created titles:');
    for (const item of created.slice(0, 20)) console.log(`- ${item.title}`);
  }
  if (updated.length) {
    console.log('Updated titles:');
    for (const item of updated.slice(0, 20)) console.log(`- ${item.title}`);
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.message || error}`);
  process.exitCode = 1;
});
