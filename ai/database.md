# Data Model - BoardAI

## Overview
Proiectul nu foloseste o baza de date clasica pentru board-uri.
Persistenta principala ramane JSON file store:

- `backend/data/boards.json`
- `backend/data/users.json`
- `backend/data/audit.json`
- `backend/data/templates.json`

Layer semantic v1 (paralel, incremental) foloseste SQLite:

- `backend/data/semantic.sqlite`

Vault registry v1 (project credentials/subscriptions) foloseste SQLite:

- `backend/data/vault.sqlite`

In plus, backendul foloseste config de mediu pentru integrarea AI (DeepSeek):
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`
- `DEEPSEEK_BASE_URL`
- `DEEPSEEK_TIMEOUT_MS` (timeout upstream AI request, default 20000ms)
- `AI_TOTAL_DEADLINE_MS` (deadline total pentru request-ul `/api/ai/complete`, default 25000ms)
- `GITHUB_TOKEN` (optional fallback pentru sync GitHub daca tokenul nu e trimis din UI)
- `GITHUB_API_BASE` (default `https://api.github.com`)
- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`
- `GITHUB_OAUTH_REDIRECT_URI` (optional; daca lipseste se construieste din host request/public base)
- `GITHUB_OAUTH_SCOPES` (default `repo read:user`)
- `GITHUB_TOKEN_VAULT_SECRET` (secret pentru criptarea tokenului in vault)
- `PUBLIC_BASE_URL` (optional; util pentru redirect URI/callback in spatele proxy-urilor)
- `BOARDAI_ALLOWED_ORIGINS` (lista origini permise CORS/socket, separate prin `,`)
- `JWT_SECRET` (obligatoriu la startup backend)
- `BCRYPT_ROUNDS` (cost factor bcrypt, default 12)
- `AUDIT_MAX_EVENTS` (limit global evenimente audit, default 20000)
- `AI_RATE_WINDOW_SEC` (fereastra rate-limit AI, default 60s)
- `AI_RATE_MAX` (max request-uri AI/fereastra/client, default 25)
- `GITHUB_RETRY_MAX_ATTEMPTS` (retry count pentru request-uri GitHub, default 4)
- `GITHUB_RETRY_BASE_MS` (base delay ms pentru backoff GitHub, default 350)
- `GITHUB_IDEMPOTENCY_TTL_SEC` (TTL pentru idempotency cache GitHub, default 3600)
- `JIRA_EMAIL` (optional env fallback pentru Jira basic auth user)
- `JIRA_TOKEN` (optional env fallback pentru Jira auth token)
- `SEMANTIC_REBUILD_DEBOUNCE_MS` (delay async rebuild semantic dupa save, default 1200ms)
- `BOARDAI_DATA_DIR` (override optional pentru data dir; util in tests)
- `VAULT_SECRET_KEY` (optional recomandat; daca lipseste se foloseste `JWT_SECRET` pentru criptare vault)

## Templates schema (`templates.json`)
Template marketplace v1 folosește store JSON separat:

```json
{
  "templates": {
    "template-id": {
      "id": "template-id",
      "name": "Template Name",
      "description": "Template description",
      "category": "Product Management",
      "tags": ["roadmap", "execution"],
      "visibility": "private|public",
      "creator": {
        "userId": "user-id",
        "name": "User Name",
        "color": "#3b82f6"
      },
      "featured": false,
      "usage_count": 0,
      "created_at": 1700000000,
      "updated_at": 1700000000,
      "published_at": 0,
      "latest_version": 1,
      "bookmarks": ["user-id"],
      "ratings": {
        "user-id": 5
      },
      "versions": [
        {
          "id": "template-id_v1",
          "version": 1,
          "created_at": 1700000000,
          "note": "Initial version",
          "data": {
            "nodes": [],
            "arrows": [],
            "comments": [],
            "votes": {}
          }
        }
      ]
    }
  }
}
```

Observații:
- template versions stochează snapshot board (`nodes/arrows/comments/votes`) compatibil cu editorul.
- `POST /api/templates/:id/use` creează board nou din versiunea selectată.
- preview endpoint (`GET /api/templates/:id/preview`) returnează variantă lightweight (sample nodes/arrows + stats).

## Board schema
Fiecare board are structura:

```json
{
  "id": "uuid",
  "name": "Untitled Board",
  "data": {
    "nodes": [],
    "arrows": [],
    "comments": [],
    "votes": {}
  },
  "versions": [
    {
      "id": "uuid",
      "created_at": 1700000000,
      "actorId": "optional-user-id-or-null",
      "reason": "create | save | restore:*",
      "hash": "sha256",
      "size": 1234,
      "data": {
        "nodes": [],
        "arrows": [],
        "comments": [],
        "votes": {}
      }
    }
  ],
  "latest_version_hash": "sha256",
  "last_version_at": 1700000000,
  "revision": 1,
  "userId": "owner-user-id",
  "members": [
    {
      "userId": "collaborator-user-id",
      "role": "editor|viewer",
      "added_at": 1700000000,
      "added_by": "owner-user-id"
    }
  ],
  "created_at": 1700000000,
  "updated_at": 1700000000
}
```

### Notes
- `created_at` si `updated_at` sunt Unix timestamps (secunde).
- runtime backend foloseste cache in-memory pentru `boards.json`; persistenta pe disk ruleaza async (queued writes).
- `revision` este incrementat la update-uri board (save/rename/restore) si este folosit pentru conflict detection (`PUT /api/boards/:id` cu `data`).
- backend returneaza `404` la board inexistent (`/api/boards/:id`).
- la create, `data` porneste implicit cu structura standard (`nodes/arrows/comments/votes`) si se captureaza prima versiune.
- `data` poate include si stare UI/tool persistata din editor:
  - `tool` (default `select`)
  - `lastNonAddTool` (default `select`)
  - `autoReturnToSelect` (default `true`)
- `data.arrows[]` (connectori) suportă acum dual schema:
  - legacy:
    - `fromId`, `toId`, `label`, `color`, `width`
  - extins (backward-compatible):
    - `from: { entityId, anchor }`
    - `to: { entityId, anchor }`
    - `flowType` (`data|relation`, optional)
    - `routing` (`straight|ortho|curved|wavy`)
    - `jumpStyle` (`auto|on|off`, optional; default `auto`)
    - `style`:
      - `stroke`
      - `width`
      - `dash` (`solid|dashed|dotted`)
      - `startCap`, `endCap` (`none|arrow|triangle|circle`)
      - `cornerRadius`
      - `waveAmplitude`
      - `waveLength`
    - `waypoints` (optional, pentru iteratii viitoare)
- connector defaults per user (frontend local persistence):
  - `localStorage["pd.board.connector.defaultStyle.v1"]`:
    - `{ routing, style, jumpStyle }`
  - `localStorage["pd.board.connector.rememberLast.v1"]`:
    - `"1"` / `"0"`
- board-urile noi sunt create doar autentificat (`POST /api/boards`), cu owner in `userId`.
- response-urile board/list includ `access_role` (`owner|editor|viewer|null`) calculat per user curent.
- In `data.nodes`, pentru `type: "shape"`, `shapeType` poate fi:
  - `rect`, `circle`, `diamond`, `triangle`, `hexagon`, `parallelogram`, `cloud`, `cylinder`.
- Tool-ul `table` insereaza acum by default `type: "sheet"` (spreadsheet container).
- Pentru `type: "sheet"` pot exista campuri suplimentare:
  - `sheetRows`
  - `sheetCols`
  - `sheetCellW`
  - `sheetRowH`
  - `sheetCells` (map `"row,col"` -> string brut; formulele incep cu `=`)
  - `sheetActive` (ex: `"1,0"`)
- Pentru `type: "transform"` pot exista campuri suplimentare:
  - `transformOp` (`sum|average|filter|group`)
  - `transformConfig`:
    - `columnIndex` (optional)
    - `query` (optional; pentru `filter`)
    - `groupByIndex` / `metricIndex` (optional; pentru `group`)
  - `transformResultType` (`number|table|grouped`, optional runtime cache)
- Pentru `type: "chart"` pot exista campuri suplimentare:
  - `chartKind` (`bar|line|pie`)
  - `chartSource`:
    - `sourceNodeId`
    - `xKey`
    - `yKey`
  - `chartRows` (optional; sample/runtime cache pentru preview)
- Pentru KPI widgets generate din `Spreadsheet AI` pot exista campuri suplimentare:
  - `kpiBinding`:
    - `sheetId`
    - `metric` (`sum|avg|min|max|count`)
    - `columnIndex` (optional)
    - `columnHeader`
    - `title`
  - `kpiValue` (number | null)
- Pentru `type: "deck"` pot exista campuri suplimentare:
  - `deckIndex`
  - `deckAccent`
  - `deckInputTarget` (`title` | `body`, implicit `body`)
  - `deckSlides[]`:
    - `id`
    - `title`
    - `body`
    - `notes`
- Pentru nodurile de tabel legacy (`table pack`) pot exista campuri suplimentare:
  - `tableId` (string)
  - `tableRole` (`title` | `header` | `cell`)
  - `tableRow` (number, doar pe cell)
  - `tableCol` (number, pe header/cell)
- Pentru nodurile generate in flow-ul `EXECUTION PLAN` pot exista campuri suplimentare:
  - task cards:
    - `type: "task"` (nou in editor execution)
    - `executionTaskId`
    - `executionTitle`
    - `executionDescription`
    - `executionStage` (`now|next|later`)
    - `executionOwner`
    - `executionPriority` (`P0|P1|P2|P3`)
    - `executionStatus` (`Todo|In Progress|Blocked|Done`)
    - `executionDueDate`
    - `executionTags` (array/string)
    - `executionMilestoneId`
    - `executionMilestone`
    - `executionGithubUrl`
    - `executionJiraUrl`
  - milestone cards:
    - `type: "milestone"` (nou in editor execution)
    - `executionMilestoneId`
    - `executionMilestone`
    - `executionMilestoneStatus`
    - `executionDueDate`
    - `executionMilestoneDate`
  - decision cards:
    - `type: "decision"` (nou in editor execution)
    - `executionDecisionId`
    - `executionDecision`
    - `executionDecisionDate`
    - `executionOwner`
    - `executionContext`
    - `executionOutcome`
  - risk cards:
    - `executionRiskId`
    - `executionRiskStatus`
    - `executionRiskImpact`
  - issue linkage pe task cards:
    - `executionIssueNumber`
    - `executionIssueUrl`
    - `executionIssueState`
    - `executionIssueUpdatedAt`
    - `executionLastSyncedAt`
    - `executionRepo`
    - `executionSourceRefs`

- Pentru `data.arrows[]` (connectors) in execution/advanced mode:
  - `flowType` (`data|relation`, optional)
  - `depType` (`depends_on|blocks|related|null`)
  - `routing` (`straight|ortho|curved|wavy`)
  - `jumpStyle` (`auto|on|off`)
  - `style` (`stroke|width|dash|startCap|endCap|cornerRadius|waveAmplitude|waveLength`)

- Pentru board pot exista campuri suplimentare de integrare:
  - `integrations.github` (map per `repoKey`):
    - `last_import_at`, `last_import_iso`
    - `last_issue_updated_at`
    - `last_push_at`, `last_push_iso`
    - `last_pull_count`, `last_push_count`
    - `last_conflicts`, `last_conflict_strategy`
  - `integrations.github_idempotency` (map per idempotency key):
    - `key`
    - `operation` (`github_import|github_push`)
    - `repo`
    - `actorId`
    - `status` (`pending|done`)
    - `response` (doar cand `status=done`)
    - `created_at`, `updated_at`
  - `integrations.jira` (map per `site::project`):
    - `last_import_at`, `last_import_iso`
    - `last_issue_updated_at`
    - `last_pull_count`
    - `site`, `projectKey`, `jql`, `state`

## Semantic layer schema (SQLite)
DB file:
- `backend/data/semantic.sqlite`

Tables:

1. `semantic_entities`
- `id` (PK)
- `board_id` (TEXT)
- `type` (`task|milestone|risk|decision|goal|note`)
- `source_node_id` (node id din board)
- `title`, `status`, `owner`, `due_date`
- `metadata_json`
- `created_at`, `updated_at`
- unique key:
  - `(board_id, source_node_id, type)`
- index-uri:
  - `(board_id, type)`
  - `(board_id, source_node_id)`
  - `(board_id, updated_at)`

2. `semantic_relations`
- `id` (PK)
- `board_id`
- `type` (`depends_on|blocks|derived_from`)
- `from_entity_key`, `to_entity_key`
- `source_edge_id` (edge id sau field marker)
- `metadata_json`
- `created_at`, `updated_at`
- unique key:
  - `(board_id, type, from_entity_key, to_entity_key, source_edge_id)`
- index-uri:
  - `(board_id, type)`
  - `(board_id, from_entity_key)`
  - `(board_id, to_entity_key)`
  - `(board_id, updated_at)`

3. `board_health_snapshot`
- `board_id` (PK)
- `health_score`
- `issues_json`
- `stats_json`
- `entities_count`, `relations_count`
- `computed_at`, `updated_at`

4. `semantic_migrations`
- `id` (filename migration)
- `applied_at`

## User schema (auth + integrations)
`backend/data/users.json` include userii de auth si, optional, integrarea GitHub OAuth:

```json
{
  "user-id": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name",
    "passHash": "$2b$12$...",
    "salt": "...",
    "color": "#3b82f6",
    "created_at": 1700000000,
    "integrations": {
      "github": {
        "token_cipher": "base64",
        "token_iv": "base64",
        "token_tag": "base64",
        "scope": "repo read:user",
        "token_type": "bearer",
        "account": {
          "login": "octocat",
          "id": 1,
          "name": "The Octocat",
          "avatar_url": "https://...",
          "html_url": "https://github.com/octocat"
        },
        "created_at": 1700000000,
        "updated_at": 1700000000
      }
    }
  }
}
```

Notes auth hash:
- hash nou: bcrypt (`$2...`).
- hash-uri legacy (`scrypt$...` si SHA256+salt) sunt acceptate la login si migrate automat la bcrypt dupa autentificare reusita.

## Vault schema (project registry + secrets + subscriptions)
DB file:
- `backend/data/vault.sqlite`

Tables:

1. `vault_projects`
- `id` (TEXT PK)
- `slug` (TEXT UNIQUE)
- `name`
- `description`
- `stack`
- `repo_url`
- `status` (`active|paused|archived`)
- `created_at`, `updated_at`

2. `vault_records`
- `id` (TEXT PK)
- `scope` (`global|project|site|subscription|other`)
- `project_id` (nullable FK `vault_projects.id`)
- `category` (`api|password|env|database|user|script|subscription|token|note|other`)
- `title`
- `username`
- `secret_cipher` (AES-256-GCM blob)
- `secret_hint` (masked)
- `url`
- `notes`
- `tags_json`
- `metadata_json`
- `cost_amount`
- `cost_currency`
- `renews_at`, `expires_at`
- `created_by`, `updated_by`
- `created_at`, `updated_at`
- `last_revealed_at`

3. `vault_record_versions`
- `id` (INTEGER PK)
- `record_id` (FK `vault_records.id`)
- `version_no`
- `action` (`create|update`)
- `snapshot_json` (metadata snapshot, fara secret plaintext)
- `created_by`
- `created_at`

4. `vault_activity`
- `id` (INTEGER PK)
- `actor_id`
- `action`
- `project_id`
- `record_id`
- `details_json`
- `created_at`

Vault API:
- `GET /api/vault/projects`
- `POST /api/vault/projects`
- `PUT /api/vault/projects/:id`
- `POST /api/vault/ingest` (free-text ingest + auto project resolve/create)
- `GET /api/vault/records`
- `GET /api/vault/records/:id`
- `POST /api/vault/records`
- `PUT /api/vault/records/:id`
- `POST /api/vault/records/:id/reveal`
- `GET /api/vault/subscriptions`
- `GET /api/vault/summary`

## Board history API
Endpointuri noi:

- `GET /api/boards/:id/history`
  - returneaza metadata versiunilor (fara snapshot complet).
- `GET /api/boards/:id/history/:versionId`
  - returneaza metadata + snapshot-ul complet pentru versiunea ceruta.
- `POST /api/boards/:id/history/:versionId/restore`
  - restaureaza snapshot-ul ca `board.data`, actualizeaza `updated_at` si adauga o versiune noua de tip restore.

## Semantic API (Execution Health v1)
Endpointuri:

- `GET /api/boards/:id/semantic`
  - access: read (`owner|editor|viewer`)
  - query optional:
    - `entityLimit` (1..5000)
    - `relationLimit` (1..5000)
    - `issueLimit` (1..5000)
    - `entityOffset` (>=0)
    - `relationOffset` (>=0)
  - behavior:
    - daca lipseste snapshot semantic, backend ruleaza lazy rebuild sync
  - response:
    - `entities[]`
    - `relations[]`
    - `health` (`healthScore`, `issues`, `stats`)
    - `pagination` (entities/relations totals)

- `POST /api/boards/:id/semantic/rebuild`
  - access: edit (`owner|editor`)
  - behavior:
    - ruleaza rebuild sync on-demand din `board.data`
    - persista entities/relations/snapshot
  - response:
    - `counts: { entities, relations }`
    - `health`
    - `took_ms`

## Board members / RBAC API
Endpointuri:

- `GET /api/boards/:id/members`
  - owner-only
  - returneaza lista de membri + owner (cu `email/name/color` cand exista user in `users.json`)
- `PUT /api/boards/:id/members`
  - owner-only
  - body: `{ email, role }`, unde `role` este `editor` sau `viewer`
  - adauga sau actualizeaza membrul dupa email
- `DELETE /api/boards/:id/members/:userId`
  - owner-only
  - elimina membrul din board (owner-ul nu poate fi eliminat prin acest endpoint)

## GitHub integration API (execution sync MVP)
Endpointuri:

- `POST /api/boards/:id/integrations/github/import`
  - access: read (`owner|editor|viewer`)
  - body:
    - `repo` (`owner/repo`, required)
    - `token` (optional override; normal flow foloseste OAuth token din vault sau `GITHUB_TOKEN` fallback)
    - `state` (`open|closed|all`)
    - `incremental` (optional, default `true`)
    - `since` (optional, unix sec/ms sau ISO datetime)
    - `perPage` (1..100)
    - `idempotencyKey` (optional; poate fi trimis si prin header `Idempotency-Key`)
  - response:
    - `plan` compatibil execution renderer (`milestones/tasks/risks`)
    - task-urile includ metadata issue (`issueNumber`, `issueUrl`, `issueState`)
    - metadata sync:
      - `incremental`, `since`
      - `fetched_count`, `count`
      - `sync` (state actualizat pentru repo)
    - `idempotency` (`{ key, replayed }` sau `null`)

## Jira integration API (phase 1 start)
Endpoint:

- `POST /api/boards/:id/integrations/jira/import`
  - access: read (`owner|editor|viewer`)
  - body:
    - `site` (required, ex: `https://company.atlassian.net`)
    - `projectKey` (required daca `jql` lipseste)
    - `jql` (optional custom query)
    - `jiraEmail` / `jiraToken` (optional request override; fallback la env `JIRA_EMAIL`/`JIRA_TOKEN`)
    - `state` (`open|closed|all`, folosit cand query-ul e generat din project key)
    - `maxResults` (1..100)
  - behavior:
    - cauta issue-uri in Jira (`/rest/api/3/search/jql`)
    - mapeaza in plan execution:
      - fields -> tasks (`summary/description/assignee/priority/status/duedate`)
      - `fixVersions` -> milestones
      - `issuelinks` -> `dependsOn`
    - persista sync state in `board.integrations.jira[site::project]`
  - response:
    - `plan` compatibil execution renderer
    - `fetched_count`, `count`, `jql`
    - `sync` state obiect

- `POST /api/boards/:id/integrations/github/push`
  - access: edit (`owner|editor`)
  - body:
    - `repo` (`owner/repo`, required)
    - `token` (optional override; normal flow foloseste OAuth token din vault sau `GITHUB_TOKEN` fallback)
    - `conflictStrategy`:
      - `skip_remote_newer` (default)
      - `prefer_board`
      - `prefer_remote`
    - `idempotencyKey` (optional; poate fi trimis si prin header `Idempotency-Key`)
    - `tasks[]` (optional; daca lipseste, backend incearca extract din `board.data.nodes`)
  - behavior:
    - upsert issue:
      - update cand exista `issueNumber`
      - create cand lipseste `issueNumber`
    - labels standard:
      - `boardai:execution`
      - `priority:*`
      - `status:*`
  - response:
    - `created`, `updated`, `skipped`, `conflicts`, `conflictStrategy`
    - `warnings[]`
    - `linked[]` (`nodeId` -> `issueNumber/url/state/updatedAt`)
    - `milestones` (`{ desired, matched, created, updated }`)
    - `sync` (state actualizat pentru repo)
    - `idempotency` (`{ key, replayed }` sau `null`)

## GitHub OAuth API (phase 3)
Endpointuri:

- `GET /api/integrations/github/oauth/status`
  - auth required
  - response:
    - `oauth_configured`
    - `connected`
    - `available`
    - `source` (`oauth` | `env` | `null`)
    - `has_env_fallback`
    - `account`
    - `scope`
    - `updated_at`

- `GET /api/integrations/github/oauth/start`
  - auth required
  - query optional:
    - `returnTo` (path frontend)
    - `boardId` (pentru audit contextual)
  - response:
    - `url` (GitHub authorize URL)
    - `scope`
    - `callback_origin`
    - `redirect_uri`
    - `oauth_configured`

- `GET /api/integrations/github/oauth/callback`
  - redirect/callback endpoint GitHub
  - proceseaza `code/state` si salveaza tokenul in vault
  - returneaza HTML pentru popup flow (`postMessage` catre opener)

- `DELETE /api/integrations/github/oauth/status`
  - auth required
  - sterge integrarea GitHub din vault pentru userul curent

## Audit API + schema
Endpoint:

- `GET /api/boards/:id/audit`
  - read access required (`owner|editor|viewer`)
  - optional query:
    - `limit` (max 500)
    - `action` (`board.save` sau CSV: `board.save,board.restore`)
    - `actorId`
    - `min_ts` (unix sec)

`backend/data/audit.json`:

```json
{
  "events": [
    {
      "id": "uuid",
      "ts": 1700000000,
      "boardId": "uuid",
      "actorId": "optional-user-id-or-null",
      "action": "board.save",
      "details": {}
    }
  ]
}
```

Evenimente curente:
- board lifecycle:
  - `board.create`
  - `board.rename`
  - `board.save`
  - `board.restore`
  - `board.delete`
- membership:
  - `board.member.add`
  - `board.member.role`
  - `board.member.remove`
- integrations:
  - `board.github.import`
  - `board.github.push`
  - `board.jira.import`

Raspunsul audit include actor enrichment cand user exista:

```json
{
  "actor": {
    "id": "user-id",
    "name": "User Name",
    "email": "user@example.com",
    "color": "#3b82f6"
  }
}
```

## AI endpoint contract
Endpoint nou: `POST /api/ai/complete`

### Request body
```json
{
  "systemPrompt": "...",
  "userPrompt": "...",
  "maxTokens": 1400
}
```

### Response body
```json
{
  "text": "...",
  "json": {},
  "repaired": false,
  "model": "deepseek-chat",
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  }
}
```

## Risks
1. JSON store nu are locking robust la scrieri concurente.
2. Daca `.env` e expus, cheia API este compromisa.
3. Rate limiting AI este in-memory; nu este distribuit pe mai multe instante.
4. `versions[]` poate creste fisierul `boards.json` daca retention-ul nu este calibrat.
5. Vault-ul GitHub este file-based (`users.json` + AES-GCM local); lipseste inca secret manager/KMS + refresh token rotation.
6. Conflict strategy este la nivel task simplificat (timestamp-based), fara merge semantic pe campuri individuale.
7. Semantic layer foloseste `better-sqlite3` (native addon); necesita validare ABI pe versiunea Node din productie la upgrade-uri.

## Recommended hardening (next)
1. Exclude `backend/.env` din versionare (`.gitignore`).
2. Muta rate limiting AI din in-memory in storage distribuit (Redis) pentru multi-instance.
3. Adauga backup `.bak` inainte de write pe `boards.json`.
4. Muta token vault in secret manager (Vault/KMS) + adauga rotate/revoke flow.
5. Pentru semantic layer, adauga backup/rotate pentru `semantic.sqlite` + health rebuild job periodic.
