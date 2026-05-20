# AI CHANGELOG - BoardAI

## 2026-03-11 - n8n credential auto-provisioned for LiteLLM gateway

### Scope
Eliminate manual n8n AI credential setup by provisioning a ready-to-use `openAiApi` credential in the owner account.

### Changes made
1. Authenticated to n8n REST API using owner account.
2. Created n8n credential via API:
- name: `AI LiteLLM OpenAI Compat`
- type: `openAiApi`
- id: `QmR9FZH6t0j72Dup`
- base URL: `http://10.10.1.211:4000/v1`
- API key source: existing LiteLLM master key.

3. Validation
- creation response returned success with credential id and scopes.
- credential is available for workflow nodes that use `openAiApi`.

4. Operational notes
- a secondary `httpHeaderAuth` credential exists (`AI LiteLLM Header Auth`) for HTTP Request node patterns.
- temporary local/remote JSON helper files were removed after provisioning.

## 2026-03-11 - Local AI API endpoint finalized on vm-web (LiteLLM)

### Scope
Provide a production-usable AI endpoint (`host + port + API key`) from local server infrastructure for direct integration from IDE/scripts.

### Changes made
1. AI stack credentials and routing:
- updated `/opt/private-driver/ai-stack/.env` with non-empty:
  - `LITELLM_MASTER_KEY`
  - `DEEPSEEK_API_KEY`
- kept `compose.yaml` routing:
  - LiteLLM: `:4000`
  - OpenWebUI: `:3001`

2. Runtime rollout:
- executed `docker compose up -d` in `/opt/private-driver/ai-stack`.
- containers restarted cleanly:
  - `ai-stack-litellm-1`
  - `ai-stack-openwebui-1`

3. Validation
- `GET http://127.0.0.1:4000/v1/models` with Bearer key -> model list returned.
- `POST /v1/chat/completions` with model `deepseek-chat` -> completion returned successfully.

4. Secret handling
- LiteLLM master key saved in Board Vault:
  - project: `Infra Server Ops`
  - title: `AI Gateway LiteLLM - vm-web`
- temporary env/test files removed after rollout.

## 2026-03-11 - Mailcow outbound SMTP relay switched to authenticated 587 (Hosterion)

### Scope
Enable outbound mail delivery without ISP SMTP/25 dependency by forcing Mailcow Postfix through authenticated relay on submission port `587`.

### Changes made
1. Hosterion relay credential bootstrap:
- validated cPanel API token access on `ares.hosterion.net`.
- created dedicated mailbox `relay@dracarys.ro` for SMTP relay authentication.

2. Mailcow Postfix relay configuration on `vm-web`:
- updated `/opt/private-driver/mail-stack/data/conf/postfix/extra.cf` with:
  - `relayhost = [aresmx.hosterion.net]:587`
  - `smtp_sasl_password_maps = hash:/opt/postfix/conf/sasl_passwd`
  - `smtp_sender_dependent_authentication = no`
  - `smtp_tls_security_level = encrypt`
  - `smtp_sasl_security_options = noanonymous`
- generated credentials map:
  - `/opt/private-driver/mail-stack/data/conf/postfix/sasl_passwd`
  - postmap created inside Postfix container.
- restarted `mailcowdockerized-postfix-mailcow-1`.

3. Validation
- SMTP AUTH probe to `aresmx.hosterion.net:587` returned:
  - `235 Authentication succeeded`
  - `250 Accepted` for external recipient test.
- end-to-end send from Mailcow Postfix:
  - `to=<postmaster@gmail.com> ... relay=aresmx.hosterion.net:587 ... status=sent (dsn=2.0.0)`.
- queue check:
  - `mailq` empty after delivery.

4. Secret handling
- relay credentials ingested to Board Vault:
  - project: `Infra Server Ops`
  - title: `Hosterion SMTP Relay - dracarys.ro`
- temporary credential helper files removed after rollout.

## 2026-03-11 - Hosterion DNS changes automated + applied for dracarys.ro mail

### Scope
Eliminate manual DNS edits in Hosterion cPanel and run mail-cutover DNS updates directly via script.

### Changes made
1. Added automation tool:
- `infra/tools/hosterion-mail-dns-sync.mjs`
- supports:
  - dry-run (default)
  - apply mode (`--apply`)
  - token from `HOSTERION_CPANEL_TOKEN`
  - backup export in `tmp/hosterion-zone-<domain>-before-<stamp>.json`

2. Applied DNS target state for `dracarys.ro`:
- MX: `@ -> mail.dracarys.ro` priority `10`
- A: `mail.dracarys.ro -> 92.180.19.135`
- SPF: `v=spf1 mx a:mail.dracarys.ro ip4:92.180.19.135 -all`
- DMARC: `v=DMARC1; p=quarantine; rua=mailto:postmaster@dracarys.ro; fo=1`

3. Validation
- authoritative checks on `ns1.hosterion.net` confirm target state.
- note: recursive resolver cache (e.g. `1.1.1.1`) may keep old SPF until previous TTL expires.

## 2026-03-11 - Server credentials + mail rollout notes synced to Board Vault

### Scope
Store critical server access and mail operation notes in Board Vault for quick retrieval, without exposing raw secrets in repository files.

### Changes made
1. Board Vault ingest completed under project:
- `Infra Server Ops`

2. Records created in vault:
- `NPM Admin - vm-gateway`
- `Mailcow Admin - mail.dracarys.ro`
- `Mail Stack Status - 2026-03-11`
- `DNS Required - dracarys.ro mail`

3. Security posture
- raw credentials are kept only in Board Vault records.
- repository memory files (`ai/*`) track only metadata + operational context.

## 2026-03-11 - Platform core stack added on vm-web (PostgreSQL + Redis + MinIO)

### Scope
Provision core runtime services for upcoming SaaS/app hosting workloads.

### Changes made
1. Added new infra package:
- `infra/platform-core-stack/compose.yaml`
- `infra/platform-core-stack/.env.example`
- `infra/platform-core-stack/scripts/generate-secrets.sh`
- `infra/platform-core-stack/README.md`

2. Deployed on `vm-web` (`/opt/private-driver/platform-core-stack`):
- `platform-postgres` (`0.0.0.0:5433->5432`)
- `platform-redis` (`0.0.0.0:6379->6379`)
- `platform-minio` (`0.0.0.0:9000-9001->9000-9001`)

3. Validation
- `docker compose ps` on stack -> containers running
- MinIO health endpoint `http://127.0.0.1:9000/minio/health/live` -> `200`
- board sync service rerun successful; board inventory refreshed.

## 2026-03-11 - Automatic inventory sync timer (Proxmox -> BoardAI)

### Scope
Move server status update from manual push to periodic automated sync.

### Changes made
1. Added sync runtime package:
- `infra/board-sync/server_inventory_sync.py`
- `infra/board-sync/server-inventory-sync.service`
- `infra/board-sync/server-inventory-sync.timer`
- `infra/board-sync/.env.example`
- `infra/board-sync/README.md`

2. Added token helper for automation:
- `infra/tools/create-board-api-token.mjs`
- generates dedicated API token (`proxmox-board-sync`) for board updater job.

3. Proxmox runtime configured:
- install path: `/opt/private-driver/board-sync`
- timer enabled: `server-inventory-sync.timer` (`OnUnitActiveSec=15min`)
- first execution successful:
  - board id `10a63a51-f0a6-4f33-a149-258c20431236`
  - updated timestamp written to board.

## 2026-03-11 - Server inventory board expanded (full visual infra map)

### Scope
Expand the previously created `Server Ops` board to include full infrastructure snapshot in a readable visual layout.

### Changes made
1. Updater script enhanced:
- updated `infra/tools/upsert-server-ops-board.mjs`
- board payload now includes detailed sections:
  - topology
  - host specs/runtime
  - storage/backup
  - VM cards
  - service endpoints/health
  - ops runbook
  - post-fiber roadmap

2. Live board refreshed:
- board id: `10a63a51-f0a6-4f33-a149-258c20431236`
- url: `https://board.private-driver.ro/?board=10a63a51-f0a6-4f33-a149-258c20431236`

3. Data reflected in board content:
- Proxmox host hardware/runtime (`32 vCPU`, `251Gi RAM`, kernel `6.17.13-1-pve`)
- VM resources and stack status (`vm-gateway`, `vm-web`, `vm-ai`)
- active container services + LAN endpoints
- backup job policy (`03:30`, `vmid 101,102,103`, retention rules)
- explicit post-fiber execution list

## 2026-03-11 - Server Ops board sync tool + live infrastructure board

### Scope
Operational tracking layer for server rollout progress in `board.private-driver.ro` (no app runtime/API contract changes).

### Changes made
1. Added infra upsert utility:
- new file: `infra/tools/upsert-server-ops-board.mjs`
- runs against Board backend API and:
  - signs owner token from backend `.env` (`JWT_SECRET`)
  - creates board if missing
  - updates board with structured infra status (`nodes/arrows/comments/votes`)

2. Created and populated live board:
- name: `Server Ops - Private Driver`
- id: `10a63a51-f0a6-4f33-a149-258c20431236`
- url: `https://board.private-driver.ro/?board=10a63a51-f0a6-4f33-a149-258c20431236`

3. Included post-fiber backlog in board content:
- public routing + DNS + SSL finalization
- mail stack + SPF/DKIM/DMARC/PTR
- WhatsApp integration path
- offsite backup and external alerting
- security hardening pass

## 2026-03-10 - Editor shell UI/UX pass (desktop readability at 50% zoom)

### Scope
Improve editor shell readability and information hierarchy (topbar + quick toolbar + side panels offsets) without changing API/SSE/runtime contracts.

### Changes made
1. Top navigation shell (`frontend/src/app/ui/TopBar.jsx`)
- increased topbar visual height and spacing.
- converted dense action row into grouped controls:
  - edit group (undo/redo),
  - view/work group (zoom, fit, search, templates, theme, present),
  - collaboration/output group (share, inspector, minimap, timeline, export menu).
- mobile actions switched from single-letter controls to explicit labels (`Undo`, `Redo`, `Insert`, `Panel`, `More`).
- improved horizontal overflow behavior for narrower desktop widths.

2. Quick action dock (`frontend/src/app/ui/Toolbar.jsx`)
- replaced crowded all-tools strip with a desktop quick dock (`DESKTOP_QUICK_TOOLS`) using larger labeled pills.
- kept keyboard shortcut engine intact.
- preserved contextual actions (grid/deps/focus, selection actions, draw palette, vote reset).

3. Side shell geometry (`frontend/src/app/ui/LeftToolbar.jsx`, `frontend/src/components/RightToolPanel.jsx`, `frontend/src/app/InnerApp.jsx`)
- increased left rail density/readability:
  - larger rail buttons/icons in `RightToolPanel`.
  - adjusted desktop rail width and top offset.
- increased desktop inspector footprint:
  - `RightPanel` width from usage side: `324 -> 360`.
  - top offset aligned with taller topbar.
  - minimap right inset updated to avoid overlap.
- updated mobile fit action viewport compensation to match new topbar height.

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd test` (backend) -> PASS
- `node --check backend/server.js` -> PASS
- `.claude/hooks/quality-gate.sh` -> PASS (non-applicable checks skipped in current env)

## 2026-03-10 - API Token self-service menu (Dashboard)

### Scope
Enable authenticated users to generate API tokens directly from Board UI for CLI/integration workflows (`vault-capture`, automation tools).

### Changes made
1. Backend auth API (`backend/server.js`)
- new endpoint: `POST /api/auth/token` (requires existing Bearer auth).
- accepts optional:
  - `name`
  - `expiresInDays`
- returns:
  - `token`
  - `tokenType`
  - `id`
  - `name`
  - `expiresInDays`
  - `expiresAt` (unix seconds)
- token payload includes `token_type: "api"` and bounded expiration.
- hardening:
  - `POST /api/auth/token` returns `403` if caller already uses `token_type: "api"` (prevents token chaining).
- new endpoints:
  - `GET /api/auth/tokens` -> list current user tokens (metadata only, no token value).
  - `DELETE /api/auth/tokens/:tokenId` -> revoke token by id.

2. Frontend API client (`frontend/src/App.jsx`)
- added `api.createApiToken(payload)` helper.
- added `api.listApiTokens()` helper.
- added `api.revokeApiToken(tokenId)` helper.

3. Dashboard UI (`frontend/src/app/panels/Dashboard.jsx`)
- added new `API Token` button in header.
- added modal flow:
  - token name + expiration inputs
  - generate action
  - one-click copy
  - expiry display
  - token inventory list (`active` / `expired` / `revoked`)
  - revoke action for active tokens
  - refresh action for token list

## 2026-03-10 - Project Vault v1 (central registry for projects, secrets, subscriptions)

### Scope
Backend + frontend feature delivery for centralized project credential management, without changing existing board contracts.

### Changes made
1. Backend vault module (SQLite + encrypted secrets)
- new files:
  - `backend/server/modules/vault/db.js`
  - `backend/server/modules/vault/service.js`
  - `backend/server/modules/vault/routes.js`
  - `backend/server/modules/vault/index.js`
- `backend/server.js`:
  - mounted new authenticated routes under `/api/vault/*`
  - initialized vault service using `VAULT_SECRET_KEY` fallback to `JWT_SECRET`
  - exposed vault summary in `/api/health`

2. API client + panel integration in editor
- `frontend/src/App.jsx`:
  - added vault API client methods (`vaultProjects`, `vaultRecords`, `vaultCreateRecord`, `vaultRevealRecord`, etc.)
- `frontend/src/app/InnerApp.jsx`:
  - added `vaultApi` wrapper and passed it to `RightPanel` (desktop + mobile)
- `frontend/src/components/RightPanel.jsx`:
  - new collapsible section `PROJECT VAULT`
- new component:
  - `frontend/src/components/VaultPanel.jsx`
  - supports:
    - project add
    - record add (global/project/site/subscription)
    - search/filter
    - secret reveal action
    - subscription due preview

3. Docs updated
- `ai/database.md` updated with vault schema + API + env config.

4. Automation ingest path (global workflow)
- backend:
  - new endpoint `POST /api/vault/ingest` for free-text parsing + auto project resolve/create + upsert by natural key.
- tooling:
  - new CLI `tools/vault-capture.js`:
    - sends captured text directly to vault ingest
    - supports config at `%USERPROFILE%/.boardai-vault/config.json`
    - supports `--project` + `--workspace` hints for project auto-routing
  - installer script `tools/install-vault-capture.ps1`:
    - adds global PowerShell command `vault-capture` / alias `vault-add`
    - makes workflow usable from any IDE terminal.

## 2026-03-06 - Hotfix (production runtime TDZ after App split)

### Issue
- Browser runtime error in production bundle:
  - `ReferenceError: Cannot access '<minified>' before initialization`
- Triggered after extracting `Canvas`/`InnerApp`, due to top-level dependency map initialization order.

### Fix
- `frontend/src/App.jsx`
  - moved dependency map creation from top-level constants into wrapper scope:
    - `canvasDeps` now built inside `function Canvas(props)`
    - `innerAppDeps` now built inside `function InnerApp(props)`
  - this avoids top-level TDZ/module-init ordering issues in minified build.
- `frontend/src/app/InnerApp.jsx`
  - completed dependency injection list for helper functions used in runtime callbacks (`parseJsonObjectLoose`, execution formatters/composers, quick-start builder, etc.) to prevent latent `ReferenceError`s.

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

### Follow-up fix (same incident window)
- root cause found in extracted `Canvas.jsx`:
  - `useConnectorContextMenu(...)` was called before `connectorById` initialization.
- fix:
  - moved `useConnectorContextMenu(...)` invocation below `connectorById` computation.
- validation rerun:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:dataflow` -> PASS
  - `npm.cmd run test:spreadsheet` -> PASS
  - `npm.cmd run test:connectors` -> PASS

### Follow-up fix 2 (same incident window)
- root cause found in extracted `Canvas.jsx`:
  - `useCanvasTouchMoveHandler(...)` was called before `runTouchMovePrelude`/`runTouchMoveTail` initialization.
- fix:
  - moved `useCanvasTouchMoveHandler(...)` invocation below touch-prelude/pinch/tail hook initializations.
- validation rerun:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:dataflow` -> PASS
  - `npm.cmd run test:spreadsheet` -> PASS
  - `npm.cmd run test:connectors` -> PASS

### Follow-up fix 3 (same incident window)
- root cause found in extracted `Canvas.jsx` dependency injection:
  - missing symbols after split (`SHAPE_DEFAULTS`, `makeShapeNode`, `makeSheetNode`, `makeDeckNode`, `collectDependency`), causing `ReferenceError` at runtime.
- fix:
  - added missing symbols to `canvasDeps` in `App.jsx`.
  - added missing symbols to `Canvas.jsx` deps destructuring.
- verification hardening:
  - ran ESLint `no-undef` check on:
    - `src/App.jsx`
    - `src/app/InnerApp.jsx`
    - `src/app/canvas/Canvas.jsx`
  - result: no undefined symbol errors.
- validation rerun:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:dataflow` -> PASS
  - `npm.cmd run test:spreadsheet` -> PASS
  - `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (InnerApp main orchestration moved to dedicated file)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. InnerApp moved out of `App.jsx`
- new file:
  - `frontend/src/app/InnerApp.jsx`
    - contains extracted `InnerApp` orchestration (mobile/desktop shell state, panel routing, collaboration wiring, AI quick flows, timeline/presence controls).
- `frontend/src/App.jsx`
  - replaced large `InnerApp` body with thin wrapper:
    - resolves `wb` via `useWB()`
    - passes stable dependency map (`INNER_APP_DEPS`) into `InnerAppView`
  - added import:
    - `import InnerAppView from "./app/InnerApp";`
- backup created before extraction:
  - `frontend/src/App.before-innerapp-move.jsx`

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas main orchestration moved to dedicated file)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Canvas moved out of `App.jsx`
- new file:
  - `frontend/src/app/canvas/Canvas.jsx`
    - contains extracted `Canvas` orchestration (touch/pointer/controller wiring, node/connector rendering, overlays, context menus, HUD panels).
- `frontend/src/App.jsx`
  - replaced large `Canvas` body with thin wrapper:
    - resolves `wb` via `useWB()`
    - passes stable dependency map (`CANVAS_DEPS`) into `CanvasView`
  - added import:
    - `import CanvasView from "./app/canvas/Canvas";`
- backup created before extraction:
  - `frontend/src/App.before-canvas-move.jsx`

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-move shell wrapper extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. `onTouchMove` shell wrapper extracted
- new file:
  - `frontend/src/app/hooks/useCanvasTouchMoveHandler.js`
    - moved wrapper flow:
      - prelude guard (`runTouchMovePrelude`)
      - pinch branch delegation (`handlePinchTouchMove`)
      - tail delegation (`runTouchMoveTail`)
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchMoveHandler(...)`.
  - removed local `onTouchMove` function body.
  - JSX touch wiring unchanged (`onTouchMove={onTouchMove}`).

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-start shell wrapper extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. `onTouchStart` shell wrapper extracted
- new file:
  - `frontend/src/app/hooks/useCanvasTouchStartHandler.js`
    - moved wrapper flow:
      - two-finger handler guard (`handleTwoFingerTouchStart`)
      - ignore `touches > 2`
      - pinch reset
      - delegate to single-touch target handler (`handleTouchStartTarget`)
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchStartHandler(...)`.
  - removed local `onTouchStart` function body.
  - JSX touch wiring unchanged (`onTouchStart={onTouchStart}`).

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-move pinch branch extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Pinch branch extracted from `onTouchMove`
- new file:
  - `frontend/src/app/hooks/useCanvasTouchMovePinch.js`
    - moved two-finger pinch flow:
      - gesture point updates
      - zoom/pan computation
      - preventDefault and consume flag
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchMovePinch(...)`.
  - pinch branch in `onTouchMove` replaced with `handlePinchTouchMove(e)` delegation.

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-start two-finger branch extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Two-finger branch extracted from `onTouchStart`
- new file:
  - `frontend/src/app/hooks/useCanvasTouchStartTwoFinger.js`
    - handles:
      - two-finger duplicate-drag shortcut
      - two-finger/pinch bootstrap (`beginTwoFinger` + `pinch` seed)
      - associated drag/lasso/radial resets
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchStartTwoFinger(...)`.
  - local two-finger branch replaced with `handleTwoFingerTouchStart(e)` delegation.

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-end handler extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. `onTouchEnd` extracted into dedicated hook
- new file:
  - `frontend/src/app/hooks/useCanvasTouchEndHandler.js`
    - moved touch-end wrapper flow:
      - two-finger gesture finalize
      - scheduled touch-move cancel
      - radial/long-press/double-tap consume chain
      - fallback `onUp()`
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchEndHandler(...)`.
  - removed local `onTouchEnd` block.
  - JSX touch wiring unchanged (`onTouchEnd` + `onTouchCancel`).

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-move non-pinch path extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Non-pinch flow extracted from `onTouchMove`
- new file:
  - `frontend/src/app/hooks/useCanvasTouchMoveNonPinch.js`
    - extracted logic into two stable steps:
      - `runTouchMovePrelude(...)` (press move, radial selection, long-press consume)
      - `runTouchMoveTail(...)` (single-touch schedule path)
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchMoveNonPinch(...)`.
  - `onTouchMove` now:
    - delegates prelude
    - keeps pinch branch local (unchanged behavior)
    - delegates tail

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas touch-start target branch extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Single-touch target branch extracted from `onTouchStart`
- new file:
  - `frontend/src/app/hooks/useCanvasTouchStartTarget.js`
    - moved connector/canvas targeting branch:
      - connector hit detection on touch start
      - press metadata assignment (`touchMetaRef`)
      - connector preselect behavior
      - canvas fallback + delegated `onDown(ev)`
- `frontend/src/App.jsx`
  - imported and wired `useCanvasTouchStartTarget(...)`.
  - `onTouchStart` keeps two-finger/pinch branch in place and now delegates single-touch target branch to hook.

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas node touch-start handler extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Node touch-start handler extracted
- new file:
  - `frontend/src/app/hooks/useCanvasNodeTouchStart.js`
    - moved `onNodeTouchStart(...)` logic from `Canvas`:
      - touch start guard
      - press metadata setup
      - mobile press bootstrap
      - selection start on touched node
- `frontend/src/App.jsx`
  - imported and wired `useCanvasNodeTouchStart(...)`.
  - removed local `onNodeTouchStart` block.
  - `NodeRenderer` wiring unchanged (`onNodeTouchStart` prop still provided).

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas double-click insert + transform-start handlers extracted)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Double-click quick insert extracted
- new file:
  - `frontend/src/app/hooks/useCanvasDoubleClickInsert.js`
    - moved `onDblClick(...)` logic from `Canvas` (select-mode empty-canvas sticky insert).
- `frontend/src/App.jsx`
  - imported and wired `useCanvasDoubleClickInsert(...)`.
  - removed local `onDblClick` block.

2. Node transform start handlers extracted
- new file:
  - `frontend/src/app/hooks/useCanvasNodeTransformStart.js`
    - moved handlers:
      - `onRotSt(...)`
      - `onRSt(...)`
- `frontend/src/App.jsx`
  - imported and wired `useCanvasNodeTransformStart(...)`.
  - removed local `onRotSt` / `onRSt` blocks.
  - `NodeRenderer` prop wiring remains unchanged.

3. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas context image upload extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Context image upload handler extracted to dedicated hook
- new file:
  - `frontend/src/app/hooks/useCanvasContextImageUpload.js`
    - moved `onCtxUploadImage(...)` logic from `Canvas`:
      - file read (`FileReader`)
      - image node creation payload
      - toast notification
      - file input reset + upload position reset
- `frontend/src/App.jsx`
  - imported and wired `useCanvasContextImageUpload(...)`.
  - removed local `onCtxUploadImage` block.
  - hidden upload input now uses hook-provided handler.

2. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas context-menu controller extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Context-menu controller extracted to dedicated hook
- new file:
  - `frontend/src/app/hooks/useCanvasContextMenuController.js`
    - moved Canvas context-menu controller logic:
      - `openContextMenuAt(...)`
      - `onCtx(...)`
      - mobile groups flattening
      - mobile title derivation
- `frontend/src/App.jsx`
  - imported and wired `useCanvasContextMenuController(...)`.
  - removed in-Canvas local blocks:
    - `openContextMenuAt`
    - `onCtx`
    - `flattenMobileContextGroups`
    - `mobileCtxGroups` / `mobileCtxTitle` `useMemo` blocks
  - kept long-press and right-click wiring unchanged at call sites.

2. Minor cleanup
- `frontend/src/App.jsx`
  - removed now-unused `buildContextMenu` import.
  - removed now-unused local `isContainerType` helper from `Canvas`.

3. Refactor docs updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas context commands + pointer controller extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Context command factory extracted and wired
- new file:
  - `frontend/src/app/hooks/useCanvasContextCommands.js`
    - owns `makeContextCommands(...)` previously in `Canvas`.
- `frontend/src/App.jsx`
  - imported and wired `useCanvasContextCommands(...)`.
  - removed in-file `makeContextCommands` block.
  - preserved sticky swatch sequencing via injected callback `getNextStickySwatch: () => SC[_si++%8]`.

2. Pointer interaction controller extracted and wired
- `frontend/src/App.jsx`
  - imported and wired `useCanvasPointerController(...)`.
  - replaced in-file large handlers with thin delegates:
    - `onDown -> handlePointerDown`
    - `onNodeSel -> handlePointerNodeSel`
    - `onMove -> handlePointerMove`
    - `onUp -> handlePointerUp`
  - kept existing event wiring and hook contracts unchanged.
- updated:
  - `frontend/src/app/hooks/useCanvasPointerController.js`
    - added missing `lasso` dependency input (used by lasso finalize branch in `onUp`).

3. Refactor documentation updated
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas connector context-menu controller extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Connector context-menu controller extracted to dedicated hook
- new file:
  - `frontend/src/app/hooks/useConnectorContextMenu.js`
    - moved connector context-menu logic:
      - `cycleCap(...)`
      - connector context groups builder (routing/style/label/delete actions)
      - mobile open (`openConnectorMobileMenu`)
      - desktop open (`onConnectorCtx`)
- `frontend/src/App.jsx`
  - imported `useConnectorContextMenu`.
  - replaced in-Canvas connector context-menu block with hook call:
    - `{ cycleCap, openConnectorMobileMenu, onConnectorCtx }`.
  - `ConnectorRenderer` and `ConnectorStylePanels` wiring unchanged.

2. Refactor docs updated for discoverability
- updated:
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Canvas port-connect controller extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Canvas port-connect block extracted to dedicated hook
- new file:
  - `frontend/src/app/hooks/usePortConnectController.js`
    - moved port connector controller logic:
      - visible port node filtering
      - port world-point mapping
      - closest-port hit detection
      - pointer attach flow (`pointermove/pointerup`) with snap/connect/fallback node create
      - preview connector path computation
- `frontend/src/App.jsx`
  - imported `usePortConnectController`.
  - replaced in-Canvas inlined port-connect block with hook call:
    - returns `visiblePortNodes`, `getPortPointsForNode`, `startPortConnect`, `previewConnectorPath`.
  - render wiring for connector port buttons and preview path unchanged.

2. Refactor docs updated for discoverability
- updated:
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (SpreadsheetNode block extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Spreadsheet node extraction to dedicated canvas module
- new file:
  - `frontend/src/app/canvas/SpreadsheetNode.jsx`
    - moved full spreadsheet node component logic (grid render, formula session bridge, reference picking, anomaly cell highlighting, edit/resize behavior).
- `frontend/src/App.jsx`
  - imported `SpreadsheetNodeView`.
  - replaced in-file large `SpreadsheetNode` implementation with thin wrapper that injects existing dependencies:
    - theme + resize handles (`T`, `RH`, `RotH`)
    - spreadsheet helpers (`sheetCellKey`, `createSpreadsheetEngine`, `appendFormulaReference`, `sheetColLabel`, `buildSheetReferenceToken`)
  - `NodeRenderer` wiring remains unchanged via same `SpreadsheetNode` symbol.

2. Refactor docs updated for discoverability
- updated:
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Toolbar block extraction)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Toolbar extraction to dedicated UI module
- new file:
  - `frontend/src/app/ui/Toolbar.jsx`
    - moved full floating toolbar implementation (keyboard controller + quick actions + draw/vote controls).
- `frontend/src/App.jsx`
  - imported `ToolbarView` and replaced in-file large toolbar block with thin wrapper `Toolbar(...)`.
  - wrapper keeps existing call-sites untouched and injects dependencies explicitly:
    - store/context access (`useWB`)
    - style/theme (`T`)
    - id + toasts (`uid`, `toasts`)
    - connector helpers (`normalizeConnector*`, dataflow cycle check)
    - sticky color sequencing via `getNextStickySwatch={() => SC[_si++%8]}` to preserve global behavior.

2. Refactor docs updated for discoverability
- updated:
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Landing/Dashboard/EditorAux extraction + wiring)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Landing/Auth extraction finished
- new file:
  - `frontend/src/app/ui/LandingPage.jsx`
    - contains moved `LandingPage` + internal `AuthModal`
    - dependency-injected props: `T`, `CSS`, `useIsMobileHook`, `api`
- `frontend/src/App.jsx`
  - imported `LandingPageView`
  - replaced app root unauth branch:
    - from local `<LandingPage .../>`
    - to `<LandingPageView ... T={T} CSS={CSS} useIsMobileHook={useIsMobile} api={api} />`
  - removed local `AuthModal` + `LandingPage` definitions

2. Dashboard extraction
- new file:
  - `frontend/src/app/panels/Dashboard.jsx`
    - moved board selector dashboard logic/UI
    - dependency-injected props: `T`, `CSS`, `useIsMobileHook`, `api`
- `frontend/src/App.jsx`
  - imported `DashboardView`
  - replaced app root no-board branch:
    - from local `<Dashboard .../>`
    - to `<DashboardView ... T={T} CSS={CSS} useIsMobileHook={useIsMobile} api={api} />`
  - removed local `Dashboard` definition

3. Editor auxiliary UI extraction
- new file:
  - `frontend/src/app/ui/EditorAuxPanels.jsx`
    - `PresentBarView`
    - `EditorOnboardingOverlayView`
    - `EmptyBoardPromptView`
- `frontend/src/App.jsx`
  - imported the 3 extracted views
  - replaced local component usage with extracted view usage
  - passed explicit props (`T`, `quickStartPresets`) to preserve behavior
  - removed local `PresentBar`, `EditorOnboardingOverlay`, `EmptyBoardPrompt` definitions

4. Refactor documentation updates (discoverability)
- updated:
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`
- added moved files and updated remaining-block list in `App.jsx`.

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-06 - App.jsx strangler refactor (Step 5 continuation: connector style controller hook)

### Scope
Safe extraction/wiring only. No business logic change, no feature change, no UI change.

### Changes made
1. Hook integration in `Canvas`
- `frontend/src/App.jsx`
  - imported `useConnectorStyleController` from `frontend/src/app/hooks/useConnectorStyleController.js`.
  - replaced in-component connector style/default logic with hook wiring:
    - `connectorPresetFromConnector`
    - `setConnectorStyleAsDefault`
    - `resetConnectorStyleDefault`
    - `buildConnectorFromDefaults`
    - `updateConnector`
  - preserved same dependencies and runtime contracts by passing:
    - `arrows`, `nodes`, `dispatch`, `connectorDefaults`, `setConnectorDefaults`, `connectorDefaultsRef`
    - `rememberLastConnectorStyle`, `uid`
    - `saveStoredConnectorDefaultStyle`, `saveStoredRememberLastConnectorStyle`
    - toast bridge via `notify`.

2. Existing extracted hook reused (no behavior edits)
- `frontend/src/app/hooks/useConnectorStyleController.js`
  - continued use as extracted controller for connector defaults/style persistence and connector update helpers.

3. Utility extraction (Step 6 low-risk, pure helpers)
- new file:
  - `frontend/src/app/utils/connectorStyleStorage.js`
    - moved connector default storage helpers:
      - `loadStoredConnectorDefaultStyle`
      - `saveStoredConnectorDefaultStyle`
      - `loadStoredRememberLastConnectorStyle`
      - `saveStoredRememberLastConnectorStyle`
- `frontend/src/App.jsx`
  - replaced in-file connector storage constants/functions with imports from `app/utils/connectorStyleStorage`.
  - `parseJsonObjectLoose` intentionally kept in place for now (still used by local AI flow in same module).

4. Hook extraction (Step 5 continuation, sheet formula bridge)
- new file:
  - `frontend/src/app/hooks/useSheetFormulaBridge.js`
    - extracted callbacks:
      - `onSheetFormulaSessionChange`
      - `onSheetFormulaReferencePick`
      - `onConsumeSheetFormulaPick`
- `frontend/src/App.jsx`
  - replaced local callback declarations with `useSheetFormulaBridge(...)` wiring.
  - kept exact payload/shape semantics for formula-session and formula-reference events.

5. Hook extraction (Step 5 continuation, transient UI handlers)
- new file:
  - `frontend/src/app/hooks/useCanvasTransientUiHandlers.js`
    - extracted listener effects:
      - `Escape` transient-close + `EXIT_ADD_MODE`
      - `Backspace/Delete` selected connectors delete (when no node selected)
      - global `board:close-transient-ui` event close/reset
- `frontend/src/App.jsx`
  - replaced local transient `useEffect` blocks with `useCanvasTransientUiHandlers(...)` wiring.
  - preserved same cleanup/reset fields and same toast message contract for connector deletion.

6. Hook extraction (Step 5 continuation, connector selection sync)
- new file:
  - `frontend/src/app/hooks/useConnectorSelectionSync.js`
    - extracted connector selection synchronization effects:
      - emits `boardai:connector-selection` custom event
      - keeps `selectedConnectorIds` aligned with `selectedArrow`
      - prunes selected connector IDs when connectors are removed
- `frontend/src/App.jsx`
  - replaced 3 local selection-sync `useEffect` blocks with `useConnectorSelectionSync(...)`.
  - behavior kept identical (no additional selection side effects).

7. Hook extraction (Step 5 continuation, image input IO)
- new file:
  - `frontend/src/app/hooks/useCanvasImageIo.js`
    - extracted `Canvas` image input effects:
      - drag-and-drop image files onto canvas
      - clipboard image paste (`Ctrl/Cmd+V`)
- `frontend/src/App.jsx`
  - replaced local `IMAGE DROP` and `CLIPBOARD IMAGE PASTE` effects with `useCanvasImageIo(...)`.
  - kept same payload shape for inserted image nodes and same success toast for clipboard paste.

8. Hook extraction (Step 5 continuation, wheel pan/zoom)
- new file:
  - `frontend/src/app/hooks/useCanvasWheelPanZoom.js`
    - extracted wheel interaction logic:
      - trackpad/mouse wheel pan
      - ctrl/cmd wheel zoom with cursor-relative pan compensation
- `frontend/src/App.jsx`
  - replaced local `onWheel + wheel listener effect` block with `useCanvasWheelPanZoom(...)`.
  - kept same zoom bounds (`0.08..6`), zoom factor (`0.9/1.11`), and dispatch payloads.

9. Hook extraction (Step 5 continuation, laser trail state/update)
- new file:
  - `frontend/src/app/hooks/useCanvasLaserTrail.js`
    - extracted laser pointer trail internals:
      - trail point buffer with age filtering (`<800ms`)
      - laser points state update used by renderer
- `frontend/src/App.jsx`
  - replaced local `laserTrail` ref + `laserPts` state + update block in `onMove` with `useCanvasLaserTrail(...)`.
  - rendering contract (`laserPts`) kept identical.

10. Hook extraction (Step 5 continuation, touch pointer capture)
- new file:
  - `frontend/src/app/hooks/useTouchPointerCapture.js`
    - extracted touch pointer capture handlers:
      - `onPointerDown`
      - `onPointerUp`
- `frontend/src/App.jsx`
  - replaced local pointer capture functions with `useTouchPointerCapture(...)` wiring.
  - kept same mobile/touch guards and pointer capture release behavior.

11. Hook extraction (Step 5 continuation, touch helpers pack)
- new file:
  - `frontend/src/app/hooks/useCanvasTouchHelpers.js`
    - extracted touch helper functions:
      - `touchEvt`
      - `touchDistance`
      - `touchPoint`
      - `beginMobilePress`
- `frontend/src/App.jsx`
  - replaced local helper implementations with `useCanvasTouchHelpers(...)`.
  - preserved touch-event object shape and mobile press payload contract.

12. Hook extraction (Step 5 continuation, mouse-move RAF scheduler)
- new file:
  - `frontend/src/app/hooks/useCanvasMouseMoveRaf.js`
    - extracted `onMouseMove` RAF scheduling logic for delegating into `onMove`.
- `frontend/src/App.jsx`
  - replaced local `onMouseMove` implementation with `useCanvasMouseMoveRaf(...)`.
  - preserved pending-event ref flow and RAF batching behavior.

13. Hook extraction (Step 5 continuation, touch-move RAF scheduler)
- new file:
  - `frontend/src/app/hooks/useCanvasTouchMoveRaf.js`
    - extracted touch RAF scheduling block used in `onTouchMove`.
- `frontend/src/App.jsx`
  - replaced local `touchMovePendingRef + touchMoveRafRef` scheduling block with `useCanvasTouchMoveRaf(...)`.
  - preserved same pending ref flush behavior and call into `onMove`.

14. Hook continuation (touch-move RAF cancel path)
- `frontend/src/app/hooks/useCanvasTouchMoveRaf.js`
  - added `cancelScheduledTouchMove()` helper:
    - `cancelAnimationFrame(...)`
    - reset `touchMoveRafRef.current`
    - reset `touchMovePendingRef.current`
- `frontend/src/App.jsx`
  - replaced local `onTouchEnd` cancel/reset block with hook call `cancelScheduledTouchMove()`.
  - behavior preserved 1:1.

15. Hook extraction (Step 5 continuation, two-finger touch gesture undo/redo)
- new file:
  - `frontend/src/app/hooks/useTouchGestureUndoRedo.js`
    - extracted `onTouchEnd` two-finger gesture branch:
      - `endTwoFinger(...)`
      - `UNDO`/`REDO` dispatch mapping
      - pinch state reset
- `frontend/src/App.jsx`
  - replaced local two-finger sub-block in `onTouchEnd` with `handleTwoFingerGestureEnd()` from hook.
  - behavior preserved 1:1.

16. Hook extraction (Step 5 continuation, radial-menu touch-end branch)
- new file:
  - `frontend/src/app/hooks/useTouchRadialMenuEnd.js`
    - extracted `onTouchEnd` radial-menu consume branch:
      - resolve active radial action
      - apply action on canvas/world point
      - end press + close radial + drag/lasso reset
- `frontend/src/App.jsx`
  - replaced local radial branch in `onTouchEnd` with `consumeRadialTouchEnd(e)`.
  - hook wiring order adjusted to run after `applyRadialAction` / `resolveRadialActiveId` declarations (avoids TDZ runtime risk).

17. Hook extraction (Step 5 continuation, touch-end long-press + double-tap branches)
- new files:
  - `frontend/src/app/hooks/useTouchLongPressEnd.js`
  - `frontend/src/app/hooks/useTouchDoubleTapEnd.js`
- `frontend/src/App.jsx`
  - replaced long-press consume branch in `onTouchEnd` with `consumeLongPressEnd()`.
  - replaced `drag.type==="none"` double-tap branch in `onTouchEnd` with `consumeDoubleTapEnd(e)`.
  - behavior preserved 1:1.

18. Refactor documentation index added
- new file:
  - `docs/app-refactor-index.md`
  - includes searchable map of extracted modules, grouped by area (`hooks/ui/canvas/panels/utils`), so new work can start faster.

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-05 - App.jsx strangler refactor (Step 2 low-risk UI extraction)

### Scope
Safe refactor only. No business logic, feature, or UI behavior changes.

### Changes made
1. Safety backup before extraction
- `frontend/src/App.backup.pre-split.2026-03-05.jsx`
  - snapshot copy of `App.jsx` created before further component extraction.

2. UI component extraction to `frontend/src/app/ui/`
- new files:
  - `frontend/src/app/ui/TopBar.jsx`
  - `frontend/src/app/ui/MobileBottomBar.jsx`
  - `frontend/src/app/ui/MobileQuickActionsBar.jsx`
  - `frontend/src/app/ui/LeftToolbar.jsx`
- `frontend/src/App.jsx`:
  - imports wired to new UI components.
  - `TopBar`, `MobileBottomBar`, `MobileQuickActionsBar` kept as thin wrappers to preserve existing call-sites/props.
  - desktop left tools render now uses `LeftToolbar` wrapper (internally still `RightToolPanel` with identical props/topOffset/side).

3. Panel extraction to `frontend/src/app/panels/`
- new files:
  - `frontend/src/app/panels/SearchPanel.jsx`
  - `frontend/src/app/panels/ShortcutsPanel.jsx`
  - `frontend/src/app/panels/ThemePicker.jsx`
  - `frontend/src/app/panels/TplPanel.jsx`
- `frontend/src/App.jsx`:
  - `SearchPanel`, `ShortcutsPanel`, `ThemePicker`, `TplPanel` converted to thin wrappers over extracted panel components.
  - removed direct `TemplateMarketplacePanel` usage from `App.jsx` (now encapsulated in `app/panels/TplPanel.jsx`).

4. Canvas rendering extraction (Step 4 partial, safe)
- new files:
  - `frontend/src/app/canvas/ConnectorRenderer.jsx`
  - `frontend/src/app/canvas/NodeRenderer.jsx`
  - `frontend/src/app/canvas/SelectionOverlay.jsx`
  - `frontend/src/app/canvas/GuidesOverlay.jsx`
  - `frontend/src/app/canvas/RemoteCursors.jsx`
- `frontend/src/App.jsx`:
  - `Canvas` now delegates:
    - connector SVG rendering to `ConnectorRenderer`
    - node map rendering to `NodeRenderer`
    - lasso rectangle to `SelectionOverlay`
    - alignment lines to `GuidesOverlay`
    - remote cursors to `RemoteCursorsView`
  - removed in-file `Lasso` and `RemoteCursors` implementations.
  - cleaned unused connector marker/dash imports after extraction.

5. Canvas interaction panels extraction (Step 4 continuation)
- new files:
  - `frontend/src/app/canvas/CanvasHud.jsx`
  - `frontend/src/app/canvas/ConnectorStylePanels.jsx`
- `frontend/src/App.jsx`:
  - `Canvas` delegates comment/zoom/bg/snap/stats/mode-hints overlay UI to `CanvasHud`.
  - `Canvas` delegates mobile+desktop connector style editors to `ConnectorStylePanels`.
  - kept same callbacks and reducer dispatch contracts via explicit props.

6. Auxiliary editor widgets extraction
- new files:
  - `frontend/src/app/canvas/AlignPanel.jsx`
  - `frontend/src/app/canvas/Minimap.jsx`
  - `frontend/src/app/ui/TimerWidget.jsx`
- `frontend/src/App.jsx`:
  - `AlignPanel`, `Minimap`, `Timer` replaced with thin wrappers delegating to extracted files.
  - behavior kept identical through existing state/dispatch wiring.

7. Hook extraction (Step 5 started)
- new file:
  - `frontend/src/app/hooks/useCanvasUiState.js`
- `frontend/src/App.jsx`:
  - `Canvas` local UI state/refs + input controller bootstrap + cleanup effect moved into `useCanvasUiState`.
  - `Canvas` now consumes returned state/refs via destructuring, without changing reducer/event behavior.

8. No-op confirmations (already extracted before this pass)
- `ContextMenu` already external (`frontend/src/components/context-menu/ContextMenu`).
- `MobileBottomSheet` already external (`frontend/src/components/MobileBottomSheet`).

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild` -> PASS

## 2026-03-05 - Hotfix: auth/session regression + invalid board id guard (post P0 deploy)

### Problem
- frontend generated noisy failures:
  - `GET /api/integrations/github/oauth/status -> 401`
  - `GET/PUT /api/boards/undefined -> 404`
- editor could enter inconsistent state when stale session/local URL had invalid board id token (`?board=undefined`).

### Fixes
1. GitHub OAuth status no longer hard-fails for unauthenticated state
- `backend/server.js`
  - changed `GET /api/integrations/github/oauth/status` from `requireAuth` to `optAuth`.
  - for anonymous state returns disconnected/availability payload instead of 401.

2. Session validation guard on app boot
- `frontend/src/App.jsx`
  - added startup session validation (`api.me()`):
    - if token missing/invalid: clears local auth, disconnects socket, resets board query.
  - added transient "Validating session..." gate to avoid mounting editor with stale auth.

3. Invalid `boardId` normalization
- `frontend/src/App.jsx`
  - added `normalizeBoardId(...)` and applied it to URL bootstrap + `openBoard(...)`.
  - auto-cleans invalid URL params (`board=undefined|null|nan`) via `history.replaceState`.
  - prevents editor API calls on `/api/boards/undefined`.

4. OAuth status frontend guard
- `frontend/src/hooks/useRightPanelAi.js`
  - skips OAuth status fetch when auth token is absent and resets GitHub auth UI state.

### Validation
- `node --check backend/server.js` -> PASS
- `npm.cmd test` (backend) -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run build` (frontend) -> PASS

## 2026-03-05 - P0 launch blockers fixed (security/correctness/stability only)

### Scope
Strict P0 remediation only. No architecture-wide refactor and no feature expansion.

### Changes made
1. Dataflow correctness
- `frontend/src/lib/dataflow/engine.js`
  - `sheet` signature hashing includes sampled key/value cell content (FNV-like rolling hash), not just value length.
  - fixes stale downstream recompute on same-length value edits.

2. Password hashing migration to bcrypt
- `backend/server.js`
  - replaced new password generation with bcrypt (`bcryptjs`, configurable rounds via `BCRYPT_ROUNDS`).
  - login verification now supports:
    - bcrypt (current)
    - legacy `scrypt$...`
    - legacy SHA256+salt
  - successful legacy login auto-upgrades stored hash to bcrypt.
- `backend/package.json` / `backend/package-lock.json`
  - added `bcryptjs`.

3. JWT hard fail policy
- `backend/server.js`
  - removed runtime fallback secret behavior.
  - server now fails to boot if `JWT_SECRET` is missing (`throw` at startup).
- `backend/tests/semantic.api.test.js`
  - test now sets `JWT_SECRET` before requiring backend module.
- `backend/.env.example`
  - added `JWT_SECRET` and `BCRYPT_ROUNDS`.

4. CORS / Socket origin restrictions
- `backend/server.js`
  - keep allowlist delegate for Express and Socket.IO (`BOARDAI_ALLOWED_ORIGINS`, `PUBLIC_BASE_URL`).
  - no wildcard origin policy in production flow.
- `backend/.env.example`
  - added explicit `BOARDAI_ALLOWED_ORIGINS` key.

5. Realtime FS hotspot removal + async board persistence
- `backend/server.js`
  - `boards.json` loaded into in-memory cache at startup.
  - `readDB()` now returns in-memory cache (no sync disk reads during socket events).
  - `writeDB()` now updates memory and persists asynchronously via queued `fs.promises.writeFile`.
  - socket realtime paths (`board:join/sync/cursor/presence/activity`) use in-memory board state and access cache.

6. Revision control to prevent overwrite conflicts
- `backend/server.js`
  - added board `revision` field (normalized for legacy boards).
  - `PUT /api/boards/:id` with `data` now requires expected revision (`body.revision` or revision header).
  - returns:
    - `428` when revision missing
    - `409` on stale revision conflict
  - increments revision on successful board mutations.
  - `GET /api/boards` and `GET /api/boards/:id` include revision.
- `frontend/src/App.jsx`
  - autosave now sends current revision.
  - on conflict (`409`), client reloads latest board snapshot + revision and warns user.
  - save API now parses backend JSON response and updates local revision ref.

### Validation
- Backend:
  - `node --check backend/server.js` PASS
  - `npm.cmd test` PASS
  - strict boot check without `JWT_SECRET` PASS (`throws as expected`)
- Frontend:
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `npm.cmd run build` PASS
- Focused runtime verifications (ad-hoc scripts):
  - sheet signature changes on same-length value edits PASS
  - auth bcrypt register + legacy hash auto-upgrade PASS
  - revision conflict detection PASS
  - two-client socket sync propagation PASS
  - realtime socket hot-path does not trigger `fs.readFileSync` PASS
  - CORS and Socket origin restriction checks PASS

## 2026-03-05 - P0 blockers hotfix pass (dataflow correctness + auth hardening + realtime/write-loop guards)

### Scope
Targeted P0-only changes. No broad refactor and no unrelated business-logic changes.

### Changes made
1. Dataflow signature correctness fix
- `frontend/src/lib/dataflow/engine.js`
  - `sheet` node signature switched from weak length-based digest to a sampled FNV-like rolling hash over key/value cell content.
  - downstream recompute now triggers when values change but string lengths stay equal (ex: `10 -> 30`).

2. Auth security hardening
- `backend/server.js`
  - JWT secret handling:
    - removed static fallback secret.
    - when `JWT_SECRET` is missing, server uses per-process ephemeral runtime secret and logs explicit warning (including production).
  - CORS hardening:
    - allowlist-based origin delegate (`BOARDAI_ALLOWED_ORIGINS` / `PUBLIC_BASE_URL`).
    - Express + Socket.IO no longer run with open wildcard policy.
  - password verification:
    - login now uses timing-safe `verifyPassword(...)`.
    - supports legacy hash verification + automatic upgrade to `scrypt$...` on successful login.
  - auth endpoint throttling:
    - added `authRateLimit` middleware to `/api/auth/register` and `/api/auth/login`.
    - config via `AUTH_RATE_WINDOW_SEC` and `AUTH_RATE_MAX`.

3. Realtime disk-read hotspot reduction
- `backend/server.js`
  - added `socketBoardAccess` cache set on `board:join` (per-socket board + read/edit permissions).
  - high-frequency events now validate against join-time access cache instead of `readDB()` on every event:
    - `board:sync`
    - `cursor:move`
    - `presence:update`
    - `board:activity`
  - `leaveSocketBoard` clears cached access.

4. Remote resave loop guard
- `frontend/src/App.jsx`
  - autosave effect now skips backend `PUT /api/boards/:id` for remote-applied states (`board:update` loads).
  - remote updates still keep local backup (`localStorage`), but no longer trigger API echo-resave.

### Validation
- `node --check backend/server.js` -> PASS
- `npm.cmd test` in `backend/` -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS

## 2026-03-05 - Premium UX polish v2 (motion system + glass depth + tactile interactions + encoding cleanup)

### Scope
Frontend-only UX polish pass across editor surfaces (no backend/business logic change), focused on Apple-like interaction feel, depth hierarchy, and text/icon rendering stability.

### Changes made
1. Motion system tokens standardized
- `frontend/src/styles/tokens.js`
  - motion tokens aligned to sprint target:
    - `fast: 120ms`
    - `medium: 180ms`
    - `slow: 260ms`
  - easing tokens added:
    - `easeOut`
    - `easeSpring`
  - CSS vars exposed:
    - `--ui-motion-fast`, `--ui-motion-medium`, `--ui-motion-slow`
    - `--ui-ease-out`, `--ui-ease-spring`
  - backward compatibility kept for legacy vars (`--ui-motion-normal`, `--ui-motion-panel`, `--ui-ease-standard`).

2. Editor motion + tactile behavior
- `frontend/src/App.jsx`
  - global CSS motion updated to use new medium/slow durations and easing curves.
  - node drag tactile feedback:
    - selected nodes now scale subtly while dragging (`1 -> 1.03`).
  - mouse move processing now scheduled via `requestAnimationFrame` wrapper for smoother pointer updates.
  - alignment guides now animate/fade (`align-guide` + `guideFlash` keyframe).
  - success moments:
    - task completion check pulse (`success-badge`).
    - AI generation sparkle banner (`sparkle-fx`) for quick AI board/flow insert.

3. Glass depth layers
- `frontend/src/components/RightPanel.jsx`
- `frontend/src/components/RightToolPanel.jsx`
- `frontend/src/components/MobileBottomSheet.jsx`
- `frontend/src/components/context-menu/ContextMenu.jsx`
  - floating surfaces upgraded with:
    - translucent gradient surfaces
    - backdrop blur
    - softer borders
    - elevated layered shadows
  - transition timing moved to motion token vars where applicable.

4. UI text/icon corruption cleanup (mojibake fix)
- `frontend/src/App.jsx`
- `frontend/src/components/RightPanel.jsx`
  - replaced corrupted symbol glyphs (`??`, broken UTF fragments) with stable ASCII labels/icons.
  - cleaned action hints, toolbar labels, menu labels, and panel header symbols to avoid rendering artifacts.

### Validation
- `npm.cmd run build` -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

## 2026-03-05 - Premium UX polish v1 (design tokens + onboarding + empty-state + micro-interactions)

### Scope
UI/UX upgrade in frontend-only layer (no backend business logic changes), focused on consistency, hierarchy, interaction feel and first-minute activation.

### Changes made
1. Design token system expanded
- `frontend/src/styles/tokens.js`
  - semantic color tokens:
    - `color.background`
    - `color.surface`
    - `color.primary`
    - `color.text`
    - `color.border`
  - spacing scale:
    - `4, 8, 12, 16, 24, 32`
  - radius scale:
    - `6, 10, 16`
  - motion/shadow tokens:
    - `120ms/160ms/180ms` + standard easing
    - shared shadow vars
  - exported `DESIGN_TOKENS`.

2. Global UI consistency + micro interactions
- `frontend/src/App.jsx`
  - CSS system upgraded:
    - normalized motion timing/easing
    - global control transitions
    - button hover/press feedback
    - node hover/selection polish (`data-selected`)
    - connector line polish classes
  - new delight animations:
    - node creation pop
    - connector snap pulse.

3. Onboarding + empty board experience
- `frontend/src/App.jsx`
  - onboarding overlay for first editor session (`localStorage` key `boardai_editor_onboarding_v2`)
  - quick start presets:
    - Brainstorm
    - Product roadmap
    - Startup planning
    - Meeting notes
  - empty board prompt:
    - AI generation input
    - Add template
    - Start brainstorming CTA.

4. Editor interaction polish
- `frontend/src/App.jsx`
  - connector snap animation on successful port-to-port connect
  - data-selected attribute added to node roots for consistent selected visual state.

5. Panel + mobile polish
- `frontend/src/components/RightPanel.jsx`
  - denser section hierarchy spacing pass (more readable grouping)
  - panel animation class alignment.
- `frontend/src/components/MobileBottomSheet.jsx`
  - improved handle visibility and larger close touch target.

6. Dashboard loading/empty state polish
- `frontend/src/App.jsx` (`Dashboard`)
  - skeleton loading cards for board list
  - actionable empty state suggestions.

### Validation
- `npm.cmd run build` -> PASS
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS

### Deploy
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - homepage -> `HTTP/2 200`

## 2026-03-05 - Data Flow Engine v1 (node pipelines + dependency graph + live recompute + transform nodes)

### Scope
Implementare Data Flow Engine pe editorul existent, fara modificari pe business logic backend nelegate:
- pipeline-uri de date intre noduri,
- recompute incremental asincron,
- prevenire cicluri,
- transform nodes (`SUM/AVERAGE/FILTER/GROUP`),
- data connector UX (vizual + preview + erori),
- chart/kpi first-class nodes alimentate din pipeline.

### Changes made
1. Dataflow runtime nou
- fisier nou:
  - `frontend/src/lib/dataflow/engine.js`
- capabilitati:
  - interface unificata de output pentru noduri de date (`sheet|transform|chart|kpi`)
  - detectie conectori de date (`flowType:"data"` + inferenta)
  - dependency graph (`incoming/outgoing`) + topological recompute
  - cycle detection + blocking
  - output evaluare per node:
    - `sheet` -> table dataset
    - `transform` -> number/table/grouped
    - `chart` -> chart rows + summary
    - `kpi` -> numeric KPI state + binding
  - runtime metadata:
    - `connectorPreviewById`
    - `connectorErrorsById`
    - `nodeErrorsById`
    - `upstreamByNode/downstreamByNode`
  - patch generation (`UPD_MULTI`) doar pe deltas reale.

2. Async engine hook
- fisier nou:
  - `frontend/src/hooks/useDataFlowEngine.js`
- comportament:
  - ruleaza non-blocking (`setTimeout` + `requestIdleCallback` fallback)
  - mentine state incremental anterior pentru eficienta
  - aplica `UPD_MULTI` doar cand exista patch-uri.

3. App/Canvas integration
- `frontend/src/App.jsx`
  - `InnerApp` foloseste `useDataFlowEngine({ nodes, arrows, dispatch })`
  - `Canvas` primeste `dataFlowRuntime`
  - noduri noi randate nativ:
    - `TransformNode`
    - `ChartNode`
    - `KpiNode`
  - selectie connector:
    - preview de date (summary/columns/sample rows/value)
    - warning vizibil la incompatibilitati/no output
  - conectori de date:
    - culoare/stil distinct
    - icon marker pe linie
    - culoare de eroare pe edge invalid
  - create connector:
    - infera `flowType:"data"` pentru noduri de date
    - blocheaza ciclurile (`wouldCreateDataFlowCycle`).

4. Transform tool wiring
- `frontend/src/App.jsx`:
  - tool nou `transform` in toolbar + shortcut `2`
  - placement flow:
    - creeaza transform node
    - auto-connect de la nodul selectat (cand sursa e data-node)
- `frontend/src/state/boardState.js`:
  - `transform` inclus in add-tools pentru auto-return logic
- `frontend/src/lib/input/modeController.js`:
  - `transform` inclus in mapare mode/tool
- `frontend/src/components/RightToolPanel.jsx`:
  - tool nou `Transform Node`
- `frontend/src/components/context-menu/actions/canvas.js`:
  - `Add Transform` in insert menu.

5. Spreadsheet AI node generation alignment
- `frontend/src/lib/spreadsheet/analysis.js`
  - `buildChartGraph(...)` produce first-class `type:"chart"` + connector `flowType:"data"`
  - `buildKpiNode(...)` produce first-class `type:"kpi"`
  - import path ESM hardening (`./engine.js`)
- `frontend/src/hooks/useSpreadsheetAi.js`
  - conectorii KPI creation setati `flowType:"data"`.

6. Tests
- fisier nou:
  - `frontend/scripts/test-dataflow-engine.mjs`
- `frontend/package.json`:
  - script nou `test:dataflow`
- acopera:
  - pipeline sheet -> transform -> kpi/chart
  - connector previews
  - cycle prevention helper
  - runtime cycle/error propagation.

### Validation
- `npm.cmd run test:dataflow` -> PASS
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS
- `npm.cmd run build` -> PASS

### Deploy
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - homepage -> `HTTP/2 200`

## 2026-03-05 - AI Spreadsheet Analysis v1 (insights + NL query + anomalies + charts + KPI + relationship formulas)

### Scope
Implementare end-to-end pentru analiza AI pe `SpreadsheetNode` direct in editor (desktop sidebar + mobile bottom sheet), fara modificari de business logic backend nelegate.

### Changes made
1. Spreadsheet AI prompt + analysis capabilities
- `frontend/src/ai/prompts.js`
  - nou `SHEET_ANALYSIS_SYS` cu schema JSON stricta pentru:
    - summary
    - insight cards
    - anomalies
    - query answer
    - chart/kpi/relationship suggestions
- `frontend/src/lib/spreadsheet/analysis.js`
  - extins cu:
    - helperi semantici pe coloane (`price/quantity/revenue`)
    - `buildSpreadsheetInsightCards(...)`
    - `answerSpreadsheetQuery(..., { relatedDatasets })` (interpretare mai robusta, inclusiv revenue/item max)
    - `buildSpreadsheetRelationshipSuggestions(...)` extins cu `formulaTemplate` pentru creare formula (same-sheet + cross-sheet).

2. New spreadsheet AI runtime hook
- fisier nou:
  - `frontend/src/hooks/useSpreadsheetAi.js`
- responsabilitati:
  - extract dataset pentru sheet selectat + sheet-uri relationate
  - actiuni async:
    - `Analyze data`
    - `Summarize trends`
    - `Detect anomalies`
    - `Generate insights`
  - query natural language + fallback AI
  - chart generation (`bar/line/pie`) prin `buildChartGraph(...)`
  - KPI node creation (`sum/avg/count`) prin `buildKpiNode(...)`
  - relationship suggestions cu `Create formula` (injectie formula in celula activa)
  - context payload limitat (`JSON.slice(0,12000)`) pentru request AI.

3. New Spreadsheet AI UI panel
- fisier nou:
  - `frontend/src/components/SpreadsheetAiPanel.jsx`
- integrat in `RightPanel` ca sectiune colapsabila `SPREADSHEET AI`:
  - actiuni AI cerute
  - query box + answer
  - insight cards
  - anomaly list
  - chart buttons
  - KPI buttons
  - relationship suggestions + formula creation button.

4. Right panel integration
- `frontend/src/components/RightPanel.jsx`
  - import + folosire `useSpreadsheetAi`
  - render `SpreadsheetAiPanel`
  - prop nou:
    - `onSpreadsheetAnomalyMapChange`.

5. App/Canvas integration (highlight anomalies + KPI auto-refresh)
- `frontend/src/App.jsx`
  - `Canvas` primeste acum `sheetAiAnomalyMapBySheet`.
  - `SpreadsheetNode` primeste `anomalyMap` si face highlight vizual celule anormale (low/medium/high).
  - `InnerApp`:
    - state nou `sheetAiAnomalyMapBySheet`
    - callback `updateSheetAiAnomalyMap(...)` pentru sincronizare din panel
    - effect nou KPI auto-refresh:
      - recalc pentru noduri cu `kpiBinding` cand datele sheet se schimba
      - update `text` + `kpiValue` prin `UPD_MULTI`.

### Validation
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS
- `npm.cmd run build` -> PASS

### Deploy
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - homepage -> `HTTP/2 200`

## 2026-03-05 - Cross-Spreadsheet Formulas + Data Flow (frontend spreadsheet engine)

### Scope
Extindere pentru `SpreadsheetNode` cu referinte cross-sheet, graful de dependente, recalc live si semnalizare data flow intre spreadsheet-uri.

### Changes made
1. Spreadsheet engine nou (`frontend/src/lib/spreadsheet/engine.js`)
- parser/formula engine extins:
  - referinte locale + range-uri
  - cross-sheet:
    - `SheetName!B2`
    - `sheet("Prices").B2`
    - `SheetTable!Price[A]`
  - functii: `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`
- dependency graph:
  - dependente la nivel de celula (inclusiv cross-sheet)
  - reverse dependents
  - detectie cicluri (`#CYCLE!`)
  - referinte invalide (`#REF!`)
- data flow:
  - agregare dependente la nivel de sheet (`fromSheetId -> toSheetId`)
  - helper pentru validare edge-uri de data flow.

2. UI integration in editor (`frontend/src/App.jsx`)
- `SpreadsheetNode` folosește engine global (nu doar evaluare locală pe sheet curent).
- adăugat formula-pick cross-sheet:
  - când editezi formulă (`=`), click pe celulă din alt sheet inserează automat referința.
- highlight contextual:
  - sheet sursă formulă + sheet-uri referite.
- header sheet afișează flow stats (`out` / `in`).
- conectori între sheet-uri care corespund dependențelor sunt marcați vizual ca `data flow`.

3. Tests
- fișier nou:
  - `frontend/scripts/test-spreadsheet-engine.mjs`
- cazuri acoperite:
  - cross-sheet multiply
  - `sheet("...").B2`
  - `Sheet!Price[A]`
  - missing ref -> `#REF!`
  - cycle -> `#CYCLE!`
  - recalc după update sursă
- `frontend/package.json`:
  - script nou `test:spreadsheet`

### Validation
- `npm.cmd run test:spreadsheet` -> PASS
- `npm.cmd run test:connectors` -> PASS
- `npm.cmd run build` -> PASS

## 2026-03-05 - `/api/ai/complete` fallback hardening (eliminate user-facing 502)

### Scope
Fix pentru `502 Bad Gateway` intermitent pe AI requests cand providerul extern raspunde cu timeout/invalid JSON sau cand cheia lipseste.

### Changes made
1. Backend resilient fallback (`backend/server.js`)
- adaugat fallback deterministic server-side, activ implicit:
  - `AI_ALLOW_FALLBACK` (`1` by default, disable with `0`).
- endpoint-ul `/api/ai/complete` intoarce acum `200` + payload valid cand upstream AI esueaza:
  - cheie lipsa (`DEEPSEEK_API_KEY`)
  - request timeout/provider fail
  - raspuns non-JSON valid
- fallback payload este un superset compatibil cu flow-urile existente:
  - `nodes/arrows`, `template`, `recommendedTemplate`,
  - `objectives/milestones/tasks/dependencies/risks/decisions`,
  - `ideas/suggestions/intent/decision`.
- response flags:
  - `fallback: true`
  - `fallback_reason`
  - `model: "fallback-local"`

2. Observability (`/api/health`)
- metrics noi AI:
  - `ai.fallback_enabled`
  - `ai.fallback`
  - `ai.last_fallback_reason`

### Validation
- `node --check backend/server.js` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS

## 2026-03-05 - AI timeout retry-budget fix (stop cascading retries > proxy timeout)

### Scope
Fix suplimentar pentru 504 persistent pe `/api/ai/complete` când chain-ul de retry depășea timeout-ul de reverse proxy.

### Changes made
1. Backend (`backend/server.js`)
- timeout tuning:
  - `DEEPSEEK_TIMEOUT_MS` default redus la `20000`
  - nou `AI_TOTAL_DEADLINE_MS` default `25000`
- `deepseekChatCompletion(...)`:
  - suport `timeoutMs` per-call
  - timeout returnează `502` (provider timeout), nu `504`
- `/api/ai/complete`:
  - retry-uri (`jsonMode fallback` + `repair`) rulează doar dacă există buget de timp rămas
  - nu mai face retry când eroarea este timeout
  - evită lanțuri de request-uri care depășesc timeout-ul nginx
- `/api/health`:
  - include `ai.total_deadline_ms`

### Validation
- `node --check backend/server.js` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS

## 2026-03-05 - AI timeout hardening (`/api/ai/complete`) + template fallback

### Scope
Fix pentru erori `504 Gateway Timeout` pe AI calls din producție.

### Changes made
1. Backend timeout control (`backend/server.js`)
- nou env/config:
  - `DEEPSEEK_TIMEOUT_MS` (default 45000, clamp 5s..120s)
- `deepseekChatCompletion(...)`:
  - `AbortController` + timeout explicit pe fetch către DeepSeek
  - return status controlat `504` cu mesaj clar la timeout
- `/api/health`:
  - expune `ai.timeout_ms`

2. Frontend fallback pentru template AI (`frontend/src/components/TemplateMarketplacePanel.jsx`)
- AI template generation:
  - `maxTokens` redus la `900` (latency mai mic)
  - la timeout/504, se generează fallback local (graph deterministic) în loc de fail hard
  - user primește notificare `warn` și poate continua flow-ul (`insert/save template`)

### Validation
- `node --check backend/server.js` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS

## 2026-03-05 - Template Marketplace System v1 (library + publish + versions + AI generation)

### Scope
Implementare incrementală pentru template infrastructure + marketplace UI, fără schimbări pe board core persistence.

### Changes made
1. Backend Template Marketplace APIs (`backend/server.js`)
- store nou pe file JSON:
  - `backend/data/templates.json`
- helper layer:
  - seed templates + normalizare shape + ratings/bookmarks stats + preview builder.
- endpoint-uri noi:
  - `GET /api/templates/categories`
  - `GET /api/templates`
  - `GET /api/templates/:id`
  - `GET /api/templates/:id/preview`
  - `POST /api/templates`
  - `PUT /api/templates/:id/publish`
  - `POST /api/templates/:id/version`
  - `POST /api/templates/:id/bookmark`
  - `POST /api/templates/:id/rate`
  - `POST /api/templates/:id/use`

2. Frontend API wiring (`frontend/src/App.jsx`)
- adăugate metode în client:
  - `templateCategories`
  - `templatesList`
  - `templateDetail`
  - `templatePreview`
  - `templateCreate`
  - `templatePublish`
  - `templateAddVersion`
  - `templateBookmark`
  - `templateRate`
  - `templateUse`

3. Marketplace UI nou
- fișier nou:
  - `frontend/src/components/TemplateMarketplacePanel.jsx`
- funcționalități:
  - browse/search/filter/sort/pagination
  - featured/trending/new/popular/rating sort
  - template preview lightweight
  - create board from template
  - save current board as template
  - publish/private toggle
  - template versioning (add version from board)
  - bookmark + rating
  - AI template generation (`/api/ai/complete`) + save/insert flows

4. Editor integration (`frontend/src/App.jsx`)
- `TplPanel` refactor:
  - folosește `TemplateMarketplacePanel` în locul panoului static TPLS.
  - insert flow remapează IDs și recentrează conținutul în viewport.
  - create-board flow din template deschide board-ul nou creat.

### Validation
- `npm.cmd run build` în `frontend/` -> PASS
- `node --check backend/server.js` -> PASS

## 2026-03-05 - Collaboration Engine v1 + AI Agents wiring completion

### Scope
Finalizeaza sprintul "Realtime Collaboration Engine + AI Agents" incremental peste editorul existent, fara schimbari pe persistence core.

### Changes made
1. Collaboration wiring complet in frontend (`frontend/src/App.jsx`)
- `InnerApp` are acum state dedicat pentru:
  - `collabUsersBySocket`
  - `collabActivity`
  - `myPresence`
  - `meetingNotes` + `meetingSuggestions`
- socket listeners adaugate pentru:
  - `users:init`, `user:joined`, `user:left`
  - `cursor:update`, `cursor:leave`
  - `user:presence`
  - `board:activity`
- presence engine:
  - toggle manual `active|idle|presenting`
  - auto-idle pe inactivitate
  - auto-return la active pe interactiune
- meeting assistant:
  - prompt AI pentru extragere `tasks/milestones/decisions` din meeting notes
  - apply suggestions -> insert noduri execution + conexiuni pe board
- comments collaboration actions:
  - focus comment on node
  - reply thread
  - delete comment

2. Right panel integration (`frontend/src/App.jsx` + `frontend/src/components/RightPanel.jsx`)
- `Canvas` primeste `collabUsers` pentru render de live cursors.
- `RightPanel` (desktop+mobile sheet) primeste:
  - `collab={...}`
  - `onEmitActivity={...}`
- sectiunile `COLLABORATION` si `AI AGENTS` sunt alimentate real din `InnerApp`.

3. Realtime backend updates (`backend/server.js`)
- `user:joined` include acum `state` + `lastActiveAt`.
- `board:activity` este broadcast la tot room-ul (`io.to(boardId)`), nu doar la ceilalti, pentru timeline local complet.

4. Runtime safety fix in mobile shell
- `setMobileMode` / `exitMobileMode` mutate inainte de `popstate` effect in `InnerApp`, eliminand riscul de runtime crash (TDZ access).

### Validation
- `npm.cmd run build` in `frontend/` -> PASS
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- `node --check backend/server.js` -> PASS

## 2026-03-05 - Execution Intelligence sprint pass (Task/Milestone/Decision + timeline + blocker radar)

### Scope
Livrare incrementală în editor pentru transformarea board-ului în execution workspace, fără rescriere de backend/core persistence.

### Changes made
1. Execution intelligence layer in frontend
- fișier nou:
  - `frontend/src/hooks/useExecutionIntelligence.js`
    - `deriveExecutionSnapshot(state)` pentru task/milestone/decision/risk/dependencies.
    - detectii: blocked, overdue, circular deps, warnings, health score.
    - acțiuni: `addTask`, `addMilestone`, `addDecision`, `updateNode`, `updateTaskDueDate`, `updateDependencyType`, `runMeetingAutopilot`.

2. Execution UI
- fișiere noi:
  - `frontend/src/components/ExecutionPanel.jsx`
  - `frontend/src/components/ExecutionTimelineOverlay.jsx`
- `frontend/src/components/RightPanel.jsx`:
  - secțiune nouă `EXECUTION` cu card health + warnings + task controls + meeting autopilot.

3. App integration
- `frontend/src/App.jsx`:
  - noduri noi: `task`, `milestone`, `decision`.
  - timeline overlay toggle/render + focus/update due date din timeline.
  - wiring context-aware pentru execution snapshot.
  - toolchain completat pentru execution nodes (add flow în canvas).
  - dependency connector logic fix: conectorii fără `depType` explicit nu mai sunt forțați în `depends_on`.
  - editor connector (desktop/mobile/context) include acum `None/Depends/Blocks/Related`.
  - helper nou: `getConnectorDependencyType(...)`.

4. Tooling + menu updates
- `frontend/src/components/RightToolPanel.jsx`:
  - tool-uri noi expuse: `Task Node`, `Milestone`, `Decision`.
- `frontend/src/state/boardState.js`:
  - add tools extins (`task`, `milestone`, `decision`) pentru auto-return.
- `frontend/src/lib/input/modeController.js`:
  - mode mapping extins pentru noile tools.
- `frontend/src/components/context-menu/actions/canvas.js`:
  - insert actions noi pentru Task/Milestone/Decision.
- `frontend/src/components/context-menu/ContextMenu.jsx`:
  - cleanup glyph fallback/submenu indicator (fără mojibake).

### Validation
- `npm.cmd run build` in `frontend/` -> PASS
- `npm.cmd run test:connectors` in `frontend/` -> PASS

## 2026-03-05 - Mobile UX refactor: unified mobile shell + touch input controller + long-press contextual actions

### Scope
Refacere mobila pentru editorul whiteboard ca flux principal:
- shell mobil unificat (bottom bar + bottom sheets),
- gesturi touch consistente (pan/select/move/pinch/long-press),
- context menu mobil prin long-press (canvas/container/node/selection),
- consistenta vizuala token-based in sheet/deck UI.

### Changes made
1. New mobile primitives
- fisier nou:
  - `frontend/src/components/MobileBottomSheet.jsx`
    - bottom sheet cu snap points (drag handle), scroll intern, safe-area support.
- fisier nou:
  - `frontend/src/lib/input/inputController.js`
    - `createInputController(...)` pentru long-press detection + move tolerance control.

2. Mobile shell in editor (`frontend/src/App.jsx`)
- `InnerApp`:
  - inlocuit drawer-ele mobile vechi (`mobileToolsOpen/mobileRightOpen`) cu `mobileSheet` unificat:
    - `insert`
    - `panel`
    - `more`
  - adaugat `MobileBottomBar` cu actiuni principale:
    - mode toggle (Pan/Select)
    - Add
    - Connect
    - Undo
    - Panel
    - More
    - Done (vizibil in add/connect)
  - `Toolbar` legacy nu mai este afisat pe mobil (ramane desktop-only).
  - default mobil la intrare: `pan` (navigate-first).

3. Touch model hardening in `Canvas` (`frontend/src/App.jsx`)
- `Canvas` primeste `isMobile`.
- added `onTouchSel` flow pentru node wrappers (`sticky/shape/text/frame/image/lane/sheet/deck`):
  - in `pan` mode: drag pe node => pan canvas (nu muta accidental node-ul),
  - in `select` mode: tap/select + press-drag move element.
- pinch zoom pastrat + integrat cu noul controller.
- long-press pe mobil:
  - pe canvas/node deschide actions sheet contextual (in loc de right-click menu).

4. Mobile context actions sheet
- in `Canvas`:
  - `openContextMenuAt(...)` unificat pentru desktop context menu + mobile action sheet.
  - meniurile sunt generate tot prin `buildContextMenu(ctx)` (aceeasi logica contextuala).
  - pe mobil, submeniurile sunt flatten pentru acces rapid intr-o lista scrollabila pe grupe.

5. RightToolPanel embedding support
- `frontend/src/components/RightToolPanel.jsx`:
  - prop nou `embedded` pentru randare in interior de bottom sheet (fara pozitionare absoluta).

6. Theme consistency fixes (mobile-visible)
- `SpreadsheetNode` si `DeckNode` in `frontend/src/App.jsx`:
  - inlocuite hardcode-uri alb/negru cu token-uri `T` (`bg*`, `b*`, `t*`, `y*`) pentru consistenta light/dark.

### Validation
- `npm.cmd run build` in `frontend/` -> PASS
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- deploy live:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-05 - UX update: right panel aligned with left-panel model + desktop hide/unhide

### Scope
Aliniere UI pentru panoul din dreapta la modelul panoului de unelte din stanga:
- look & feel flotant similar,
- buton desktop `Hide/Show Panel`,
- sectiune colapsabila pentru `SPIDER WEB - FILE`.

### Changes made
1. Desktop panel toggle
- `frontend/src/App.jsx`:
  - state nou: `rightPanelOpen`
  - buton nou in canvas chrome:
    - `Hide Panel` / `Show Panel`
  - render conditionat pentru `RightPanel` pe desktop
  - minimap `rightInset` devine dinamic in functie de starea panelului.

2. Right panel visual model updated
- `frontend/src/components/RightPanel.jsx`:
  - pentru desktop (`fill=false`) panelul e acum flotant:
    - border + radius + soft shadow
    - pozitionare absoluta (`topOffset`, `rightInset`)
  - header nou de panel + buton `Hide` (prin `onRequestClose`)
  - sectiune noua colapsabila:
    - `SPIDER WEB - FILE`.

### Validation
- `npm.cmd run build` in `frontend/` -> PASS
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- deploy live:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-05 - Hotfix: smart obstacle avoidance for `straight` connectors

### Scope
Fix pentru cazurile in care conectorii `straight` traversau containere/elements in loc sa le ocoleasca.

### Changes made
1. Geometry helper nou
- `frontend/src/lib/geometry/connectors/routing.js`:
  - `segmentIntersectsRect(...)` (Liang-Barsky) exportat pentru detectie robusta segment-vs-rect.

2. Smart reroute pentru straight connectors
- `frontend/src/App.jsx`:
  - pentru conectori `straight`:
    - daca segmentul direct intersecteaza obstacolele (excluzand sursa/destinatia), se aplica reroute A* ortho.
  - rezultatul este un traseu care ocoleste containerele chiar daca routing-ul sursa este `straight`.

3. Tests
- `frontend/scripts/test-connectors.mjs`:
  - test nou pentru `segmentIntersectsRect(...)`.

### Validation
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS
- deploy live:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-05 - Hotfix: ortho/wavy obstacle avoidance around containers/elements

### Scope
Fix pentru routing-ul conectorilor care traversau vizual containerele ("pe sub ele") in loc sa le ocoleasca.

### Changes made
- `frontend/src/App.jsx`:
  - obstacolele de routing nu mai includ doar `frame/lane/sheet/deck`.
  - ORTHO/WAVY folosesc acum un set extins de obstacle nodes:
    - toate nodurile vizibile cu dimensiune relevanta (`w/h >= 18`), exceptand `text`.
  - padding obstacle ajustat la `30` pentru clearance mai bun.

### Validation
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS
- deploy live:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-05 - Hotfix: `buildConnectorFromDefaults` runtime error in Toolbar

### Scope
Fix pentru eroarea runtime din productie:
- `ReferenceError: buildConnectorFromDefaults is not defined`

### Root cause
- `buildConnectorFromDefaults` era definit doar in `Canvas`, dar folosit si in `Toolbar` (shortcut flow `Tab`/`Enter` pentru connectors).

### Changes made
- `frontend/src/App.jsx`:
  - adaugat builder local in `Toolbar`:
    - citeste presetul default din `localStorage`
    - construieste conector nou cu `routing/style/jumpStyle` normalizate

### Validation
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS
- deploy live:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-05 - Advanced Connectors v1.5 (line jumps + default connector style persistence)

### Scope
Extensie incrementală peste Advanced Connectors v1:
- line jumps (bridge arcs) la intersecții de conectori,
- default connector style per user (local persistence),
- remember last style + set/reset default,
- fără rescriere board core.

### Changes made
1. Connector model extensions
- `frontend/src/lib/geometry/connectors/model.js`:
  - `normalizeConnectorJumpStyle(...)`
  - `normalizeConnectorDefaultStyle(...)`
  - default preset constants pentru routing/style/jumpStyle
  - backward compatibility păstrată pentru conectorii legacy.

2. Line jumps geometry engine
- `frontend/src/lib/geometry/connectors/routing.js`:
  - spatial index pentru segmente:
    - `buildSegmentSpatialIndex(...)`
    - `querySegmentSpatialIndex(...)`
  - intersection engine:
    - `segmentsToIntersections(...)`
    - broadphase (grid bucket) + narrowphase (segment intersection)
    - reguli deterministe pentru "cine sare" + max jumps per connector
    - ignore near-endpoint intersections
  - jump path builder:
    - `applyJumpsToPath(...)` (bridge curves pe segmente ortho/straight).

3. App wiring: defaults + remember last + jump rendering
- `frontend/src/App.jsx`:
  - storage keys:
    - `pd.board.connector.defaultStyle.v1`
    - `pd.board.connector.rememberLast.v1`
  - flow nou pentru conectori creați:
    - toate create paths (`arrow tool`, `port drag`, `Tab/Enter mindmap`) folosesc presetul default curent.
  - remember last style:
    - editările de routing/style/jumpStyle actualizează default-ul când toggle-ul este ON.
  - inspector/context menu:
    - jump style `Auto/On/Off`
    - `Set default`, `Reset default`
    - toggle `Remember last style`
  - rendering jumps:
    - calcule debounce + idle (`requestIdleCallback` fallback)
    - aplicare jump path pe conectorii `straight/ortho` cu `jumpStyle != off`.

4. Tests extinse
- `frontend/scripts/test-connectors.mjs`:
  - default style normalization
  - segment spatial index query
  - jump intersection detection + jump path generation
  - testele existente (ports/routing/backward-compat) păstrate.

### Validation
- `npm.cmd run test:connectors` in `frontend/` -> PASS
- `npm.cmd run build` in `frontend/` -> PASS

## 2026-03-04 - Advanced Connectors v1 (ports + anchor model + routing/styles + connector UX)

### Scope
Implementare incrementală a sistemului de conectori Miro-like peste modelul existent (`arrows`), fără rescrierea core-ului de board.

### Changes made
1. Geometry modules noi pentru conectori
- fisiere noi:
  - `frontend/src/lib/geometry/connectors/routing.js`
  - `frontend/src/lib/geometry/connectors/model.js`
- capabilitati:
  - ports normalized (4 ports)
  - obstacle rects + spatial index simplu (grid buckets)
  - ortho routing cu A* (`routeOrthoAStar`)
  - curved/wavy path builders
  - rounded corners pentru ortho
  - style normalization (dash, caps, width, wave params)

2. Anchor model wiring in editor
- `frontend/src/App.jsx`:
  - conectorii sunt randati anchor-based (`from/to` cu `port` sau `pos`) prin:
    - `normalizeConnectorEndpoints(...)`
    - `getAnchorWorldPosition(...)`
  - backward compatibility mentinuta pentru arrows legacy (`fromId/toId`).
  - add mode pe arrow click creeaza acum conectori cu `from/to` + `routing` + `style`.

3. Ports overlay + drag-to-connect
- `frontend/src/App.jsx`:
  - ports vizibile pe hover/selection (`top/right/bottom/left`)
  - drag din port -> preview connector
  - snap magnetic pe porturile target
  - create connector cu ancore de tip `port`
  - `Esc` anuleaza connect mode (prin reset global existent).

4. Routing + render styles
- `frontend/src/App.jsx`:
  - routing suportat:
    - `straight`
    - `ortho` (cu obstacle avoidance)
    - `curved`
    - `wavy`
  - markers noi pentru caps:
    - `none`
    - `arrow`
    - `triangle`
    - `circle`
  - dash styles:
    - `solid`
    - `dashed`
    - `dotted`
  - inspector extins:
    - routing select
    - color/width/dash
    - start/end cap
    - reverse direction
    - corner radius slider (ortho)
    - wave amplitude + wave length sliders (wavy)

5. Context menu pe connector
- `frontend/src/App.jsx`:
  - right-click pe connector deschide meniu grupat:
    - routing
    - style
    - reverse/delete/manage
  - integrare cu `ContextMenu` existent (fara nou renderer separat).

6. State/backward compatibility hardening
- `frontend/src/state/boardState.js`:
  - helpers noi pentru endpoint IDs:
    - `getConnectorFromId(...)`
    - `getConnectorToId(...)`
    - `remapConnectorEntities(...)`
  - `collectDependency`, `DEL`, `PASTE` compatibile cu connectori noi (`from/to`) + legacy.

7. Tests minime pentru geometry/compat
- fisier nou:
  - `frontend/scripts/test-connectors.mjs`
- script nou:
  - `frontend/package.json` -> `test:connectors`
- acopera:
  - port positions
  - ortho A* detour pe obstacle
  - backward compatibility normalization/style.

### Validation
- `cmd /c npm run test:connectors` in `frontend/` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Context submenu visibility fix (portal layer)

### Scope
Fix pentru cazurile in care submeniul din context menu afisa doar umbrea (submenu era clipping-uit de containerul scrollabil).

### Changes made
1. `ContextMenu` submenu rendering fix
- fisier:
  - `frontend/src/components/context-menu/ContextMenu.jsx`
- schimbare:
  - submenu-ul este randat acum via `createPortal(..., document.body)` in layer separat.
  - pozitionare `fixed` pe baza ancorei butonului.
  - close behavior robust:
    - close delayed on leave
    - cancel close cand cursorul intra pe submenu
- rezultat:
  - submenu vizibil complet, fara clipping.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Context menu refactor v1 (grouped + contextual + extensible)

### Scope
Refacere structurala a meniului de click-dreapta:
- grupare pe sectiuni;
- context-aware (`canvas` / `container` / `node` / `selection`);
- renderer unificat, theme-consistent;
- arhitectura extensibila cu `buildContextMenu(ctx)` + action modules.

### Changes made
1. New context menu architecture (frontend)
- fisiere noi:
  - `frontend/src/components/context-menu/menuBuilder.js`
  - `frontend/src/components/context-menu/ContextMenu.jsx`
  - `frontend/src/components/context-menu/actions/canvas.js`
  - `frontend/src/components/context-menu/actions/container.js`
  - `frontend/src/components/context-menu/actions/node.js`
  - `frontend/src/components/context-menu/actions/selection.js`
- API:
  - `buildContextMenu(ctx) -> MenuGroup[]`
  - groups/items normalize + enabled/danger/subMenu support.

2. Context detection in canvas
- `frontend/src/App.jsx`:
  - right-click hit test pe `data-node-id` + `data-node-type`.
  - target derivat:
    - `canvas`
    - `container`
    - `node`
    - `selection` (multi-select)
  - right-click pe node neselctat face select implicit pe node pentru actiuni coerente.

3. Node wrappers metadata
- `frontend/src/App.jsx`:
  - wrappers principale au acum:
    - `data-node-id={node.id}`
    - `data-node-type={node.type}`
  - permite detectie robusta a contextului la click dreapta.

4. New contextual content (V1)
- Canvas:
  - Insert / Paste+Import / View / Board
- Container:
  - Container / Layout / Style / Links & Connections / Grouping
- Node:
  - Edit / Arrange / Links & Connections / Style / Convert
- Selection (multi):
  - Selection / Arrange / Grouping / Links
- submenus implementate pentru shape/container/align/distribute/style palettes.

5. Visual consistency
- renderer nou foloseste token-uri `T`:
  - surface/border/hover/disabled states consistente cu UI global.
- meniul are close on:
  - click outside
  - `Escape`
  - dupa action select.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Right-click menu reliability fix (canvas-relative positioning)

### Scope
Corectie pentru cazuri in care meniul de click dreapta nu aparea corect (sau era taiat), din cauza calculului in coordonate de viewport.

### Changes made
1. Context menu coordinates in canvas space (`frontend/src/App.jsx`)
- `onCtx(...)` foloseste acum `wRef.current.getBoundingClientRect()`:
  - `localX = clientX - rect.left`
  - `localY = clientY - rect.top`
- clamp-ul pentru `sx/sy` si `maxH` se face pe dimensiunea canvas-ului (`rect.width/rect.height`), nu pe `window`.
- adaugat `e.stopPropagation()` in `onCtx(...)` pentru consistenta.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Top bar UX: minimap toggle + hamburger import/export menu

### Scope
UX update pentru editor:
- minimap sa nu mai fie mereu vizibila peste zona AI/panel;
- import/export mutate intr-un meniu unic tip hamburger in top bar.

### Changes made
1. Minimap controlat explicit (`frontend/src/App.jsx`)
- minimap este ascunsa implicit in `InnerApp` (`showMinimap=false`).
- afisare doar la click pe butonul `🗺 Harta` din top bar.
- minimap include acum buton `✕` intern pentru inchidere rapida.
- minimap este pozitionata cu `rightInset` (300) ca sa nu se suprapuna pe panoul din dreapta.

2. Meniu hamburger pentru Import/Export (`frontend/src/App.jsx`)
- butoanele separate (`Import`, `SVG`, `PNG`, `JSON`) au fost inlocuite cu:
  - buton `☰ Menu` in top bar
  - dropdown cu actiuni:
    - `Import JSON`
    - `Export SVG`
    - `Export PNG`
    - `Export JSON`
- dropdown-ul se inchide:
  - la click in afara;
  - la `Escape`;
  - dupa executarea unei actiuni.

3. Wiring TopBar/InnerApp (`frontend/src/App.jsx`)
- `TopBar` primeste noile props:
  - `showMinimap`
  - `onToggleMinimap`
- `InnerApp` controleaza starea minimap si o inchide automat pe mobile.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Context menu UX fix: full visibility + grouped actions

### Scope
Meniul de click dreapta din canvas nu era vizibil complet pe ecrane mici/pozitii joase si avea lista lunga negrupata.

### Changes made
1. Context menu positioning hardening (`frontend/src/App.jsx`)
- `onCtx(...)` calculeaza acum:
  - `menuW` fix (286)
  - `menuMaxH` din viewport (`min(520px, 76vh)`)
  - clamp pe `sx/sy` cu margine de siguranta
- datele salvate in `ctxMenu` includ acum `maxH`.

2. Scroll + viewport-safe menu container (`frontend/src/App.jsx`)
- context menu are acum:
  - `width: 286`
  - `maxHeight: ctxMenu.maxH || 520`
  - `overflowY: auto`
- astfel meniul ramane integral accesibil (cu scroll intern) si nu mai iese din ecran.

3. Grouping pe tipuri de actiuni (`frontend/src/App.jsx`)
- lista flat a fost refactorizata in sectiuni:
  - `BOARD ELEMENTS`
  - `SHAPES`
  - `STRUCTURE`
  - `INTERACTION`
  - `SELECTION` (doar cand exista selectie)
  - `ARRANGE` (doar cand exista selectie)
  - `EXPORT`
- item-urile sunt randate pe grupe cu headers si separatori.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Fix console spam (`input[type=color]`) + hardening dublu-click edit

### Scope
Eliminare erori repetitive in consola dupa introducerea token-urilor CSS pe tema si prevenire adaugare accidentala de container la dublu-click in editor.

### Changes made
1. Color picker background fix (`frontend/src/App.jsx`)
- problema:
  - `input[type=color]` primea `value={bgColor||T.bg0}`, iar `T.bg0` este acum `var(--ui-bg0, ...)`.
  - browserul accepta doar `#rrggbb` pentru `value` pe color input, generand warning repetitiv.
- implementare:
  - helpere noi:
    - `normalizeColorInputValue(...)`
    - `getThemeColorHex(...)`
  - conversie robusta la hex pentru:
    - `#rgb`
    - `#rrggbb`
    - `rgb(...)`
  - fallback explicit:
    - `DEFAULT_CANVAS_BG = "#050911"`
  - `input[type=color]` foloseste acum:
    - `value={colorInputBgValue}` (mereu hex valid).

2. Dublu-click edit hardening (`frontend/src/App.jsx`)
- wrappers de node au atribut `data-node="1"` pe tipurile principale (sticky/shape/text/image/lane/sheet/deck/frame),
  astfel `Canvas.onDoubleClick` nu mai trateaza editarea in node ca dublu-click pe canvas.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS
  - `PUBLIC_HEALTH` -> `ok`
  - `PUBLIC_HEAD` -> `HTTP/2 200`

## 2026-03-04 - Standard deploy wrapper + workflow enforcement in `agents.md` + live deploy

### Scope
Operationalizare deploy ca pas standard dupa schimbari, cu un singur script usor de rulat si regula explicita in `agents.md`.

### Changes made
1. New deploy wrapper script
- fisier nou:
  - `ops/deploy_now.ps1`
- rol:
  - wrapper peste `ops/deploy_board.ps1`
  - comanda unica pentru deploy standard
  - suporta aceleasi switch-uri utile:
    - `-SkipBuild`
    - `-IncludeEnv`
    - `-UploadBoardsData`

2. Workflow update in `agents.md`
- `La FINAL dupa orice modificare` include acum explicit:
  - rulare deploy standard:
    - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1`
  - varianta rapida:
    - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild`
- sectiunea `Comenzi utile` include comanda de deploy.

3. Live deploy executed
- comanda rulata:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1`
- rezultat:
  - build frontend PASS
  - upload frontend/backend PASS
  - restart service PASS
  - `LOCAL_HEALTH` PASS
  - `PUBLIC_HEALTH` PASS
  - `PUBLIC_HEAD` -> `HTTP/2 200`

### Validation
- deploy complet finalizat cu succes pe:
  - `https://board.private-driver.ro`

## 2026-03-04 - Global Light/Dark theme system (UI tokens + persistent toggle)

### Scope
Implementare completa de theme switch global (light/dark) pentru interfata BoardAI:
- toggle disponibil in Landing, Dashboard si Editor TopBar,
- persistare in `localStorage`,
- aplicare pe token-uri shared (fara refactor major de componente).

### Changes made
1. Theme engine (`frontend/src/styles/tokens.js`)
- adaugat palete:
  - `UI_THEME_PALETTES.dark`
  - `UI_THEME_PALETTES.light`
- helpers noi:
  - `normalizeUiTheme(mode)`
  - `getStoredUiTheme()`
  - `applyUiTheme(mode)`
- storage key:
  - `UI_THEME_STORAGE_KEY = "boardai_theme_mode"`
- `UI_TOKENS` mutate pe CSS vars (`var(--ui-*)`) cu fallback dark.
- `TOOL_PANEL_TOKENS` legat la `UI_TOKENS` (theme-aware automat).

2. App wiring (`frontend/src/App.jsx`)
- `App` gestioneaza `themeMode` state global.
- init:
  - citeste tema stocata
  - aplica tema la boot (`applyUiTheme`).
- toggle:
  - `toggleTheme()` comuta `dark <-> light` si persista.
- propagate props:
  - `LandingPage`, `Dashboard`, `InnerApp`, `TopBar`.

3. UI controls
- `TopBar` (editor):
  - buton tema (`☀ Light` / `☾ Dark`).
- `Dashboard`:
  - buton tema in header.
- `LandingPage`:
  - buton tema in header.

4. CSS alignment
- global CSS foloseste acum variabile tema:
  - `body` background/text
  - scrollbar thumb
  - focus outline / input accents

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-04 - UX fix: impossible to stay stuck in add mode + unified tool panel theme

### Scope
Fix direct pe editor UX/tooling:
- reintroducere `Select` + `Pan` in panelul principal,
- `Esc` reset global la select,
- `Space hold` pentru pan temporar,
- auto-return la select dupa plasare (default ON, configurabil),
- unificare vizuala panel unelte cu token-uri comune (fara mix accidental alb/negru).

### Changes made
1. Tool state and reducer hardening
- `frontend/src/state/boardState.js`:
  - campuri noi in state:
    - `lastNonAddTool`
    - `autoReturnToSelect` (default `true`)
  - actiuni noi:
    - `EXIT_ADD_MODE`
    - `TOGGLE_AUTO_RETURN_TO_SELECT`
  - `TOOL` actualizeaza `lastNonAddTool` determinist.
  - `ADD` aplica auto-return la `select` pentru unelte de add.
  - `LOAD` aplica fallback-uri pentru noile campuri (compatibil board-uri vechi).

2. Keyboard + global reset UX
- `frontend/src/App.jsx`:
  - `Esc` in editor:
    - inchide overlays mobile/search/templates
    - ruleaza global `EXIT_ADD_MODE`
  - in `Canvas`:
    - `Esc` inchide comment popover/context/lasso si revine la select
  - in keyboard engine (`Toolbar`):
    - `V` -> select (via `EXIT_ADD_MODE`)
    - `H` -> pan
    - `Space` hold -> pan temporar, la keyup revine la tool anterior
    - click pe `select` in toolbar -> `EXIT_ADD_MODE`
  - comment add finalizeaza cu revenire la select daca `autoReturnToSelect=true`.

3. Tool panel UX + theme consistency
- fisier nou:
  - `frontend/src/styles/tokens.js`
    - `UI_TOKENS`
    - `TOOL_PANEL_TOKENS`
- `frontend/src/App.jsx`:
  - `T` vine acum din `UI_TOKENS` (single source pentru token-uri editor).
- `frontend/src/components/RightToolPanel.jsx`:
  - rescris pe token-uri comune (`TOOL_PANEL_TOKENS`) in loc de paleta alba hardcodata.
  - sectiune noua `Navigation`:
    - `Select` (`V / Esc`)
    - `Pan / Move Canvas` (`H / Space`)
  - buton vizibil `Done` cand tool activ este add-mode.
  - toggle UI pentru `Auto Return To Select` (ON/OFF).
  - active state + tooltip shortcuts coerente.
  - scroll intern pastrat (`overflowY:auto`, `minHeight:0`).

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-04 - Deploy compatibility fix for semantic layer (Node 20 production)

### Scope
Fix de runtime compatibilitate pe serverul de productie (Node 20.20.0), unde `node:sqlite` nu este disponibil.

### Changes made
1. Semantic DB driver switch
- `backend/server/modules/semantic/db.js`:
  - inlocuit `node:sqlite` cu `better-sqlite3`
  - pragmas pastrate (`journal_mode=WAL`, `synchronous=NORMAL`, `temp_store=MEMORY`)

2. Backend dependencies
- `backend/package.json` + `backend/package-lock.json`:
  - adaugat `better-sqlite3`

3. Deploy script hardening
- `ops/deploy_board.ps1`:
  - urca acum si folderul `backend/server/` (module runtime), nu doar `server.js` + package files.

### Validation
- backend tests PASS
- frontend build PASS
- deploy live PASS:
  - `LOCAL_HEALTH` -> ok
  - `PUBLIC_HEALTH` -> ok
  - semantic metrics disponibile in `/api/health`

## 2026-03-04 - Semantic Board Graph + Execution Health v1 (incremental, board store unchanged)

### Scope
Livrare V1 productie pentru semantic layer paralel peste board JSON existent:
- extractie entitati/relatii,
- health score + issues,
- endpoint-uri REST,
- hook pe save,
- dashboard card + details drawer,
- teste minime (unit + integration).

### Changes made
1. Semantic storage + migrations (SQLite, parallel layer)
- fisiere noi:
  - `backend/server/modules/semantic/migrations/001_semantic_layer.sql`
  - `backend/server/modules/semantic/db.js`
  - `backend/server/modules/semantic/service.js`
  - `backend/server/modules/semantic/queue.js`
  - `backend/server/modules/semantic/index.js`
- tabele noi:
  - `semantic_entities`
  - `semantic_relations`
  - `board_health_snapshot`
  - `semantic_migrations`
- index-uri:
  - pe `board_id`, `type`, `source_node_id`, `updated_at` (+ from/to relation keys)

2. Deterministic semantic engine
- fisier nou:
  - `backend/server/modules/semantic/extractor.js`
- contract:
  - `extractSemantic(boardJson) -> { entities, relations }`
- entitati V1:
  - `task`, `milestone`, `risk`, `decision`, `goal`, `note`
- relatii V1:
  - `depends_on`, `blocks`, `derived_from`

3. Execution health engine
- fisier nou:
  - `backend/server/modules/semantic/health.js`
- contract:
  - `computeHealth(entities, relations) -> { healthScore, issues, stats }`
- issues V1:
  - `orphan_task`
  - `missing_owner`
  - `missing_due_date`
  - `overdue`
  - `empty_milestone`
  - `circular_dependency`
- scoring:
  - caps + penalty rules conform cerintei (clamp 0..100)

4. Backend wiring + APIs
- `backend/server.js`:
  - semantic module init in monolith (`createSemanticModule(...)`)
  - data dir override pentru testability:
    - `BOARDAI_DATA_DIR`
  - hook async/debounced pe board save/create/restore:
    - `semantic.scheduleRebuild(...)`
  - cleanup semantic on board delete:
    - `semantic.clearBoardSemantic(...)`
  - endpoint nou:
    - `GET /api/boards/:id/semantic`
  - endpoint nou:
    - `POST /api/boards/:id/semantic/rebuild`
  - health endpoint include acum metrics semantic:
    - `semantic.*`
  - server export pentru integration tests:
    - `module.exports = { app, server, semantic, readDB, writeDB }`
  - start guard:
    - `if (require.main === module) { ...listen... }`

5. Frontend dashboard UX
- `frontend/src/App.jsx`:
  - API client nou:
    - `api.semantic(...)`
    - `api.semanticRebuild(...)`
  - `Dashboard`:
    - card nou `Execution Health` (score + top 3 issues)
    - drawer nou `Execution Health Details` (issues grouped)
    - click issue -> open board + focus node (cand `sourceNodeId` exista)
  - focus flow nou in `InnerApp`:
    - query param `focus=<nodeId>`
    - select + pan pe node la intrarea in board

6. Tests
- fisiere noi:
  - `backend/tests/semantic.extractor.test.js` (unit: extractor + health)
  - `backend/tests/semantic.api.test.js` (integration: GET semantic)
- script backend:
  - `npm test` -> `node --test \"tests/**/*.test.js\"`

7. Config
- `backend/.env.example`:
  - `SEMANTIC_REBUILD_DEBOUNCE_MS`
  - `BOARDAI_DATA_DIR`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm test` in `backend/` -> PASS (3 tests)
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-04 - Deck input target toggle (`Title` / `Body`) + keyboard alignment

### Scope
Polish UX pentru containerul de prezentare (`deck`) dupa fixurile de focus keyboard:
- userul poate controla explicit unde scrie tastatura (titlu vs body) cand deck-ul este selectat.

### Changes made
1. Deck UI target switch (`frontend/src/App.jsx`)
- `DeckNode` are acum control vizual in header:
  - `Title`
  - `Body`
- controlul este highlight-uit pe target-ul activ (`deckInputTarget`).
- click pe zona de titlu/body seteaza automat target-ul activ.

2. Keyboard routing alignment (`frontend/src/App.jsx`)
- engine-ul de keyboard pentru `deck` foloseste acum target-ul selectat:
  - typing/backspace/delete editeaza `slide.title` sau `slide.body` in functie de `deckInputTarget`
  - `Enter`:
    - in `Title` muta focusul logic pe `Body`
    - in `Body` insereaza newline

3. State defaults (`frontend/src/state/boardState.js`)
- `makeDeckNode(...)` initializeaza explicit:
  - `deckInputTarget: "body"` (sau `title` daca este trecut prin opts)

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Mobile panel scroll + keyboard focus behavior for `sheet` / `deck`

### Scope
Corectii UX cerute:
1. panel mobil fara scroll complet,
2. tastatura in focus pe `sheet`/`deck` trebuia sa opereze in interior (nu sa miste nodul/schimbe tool).

### Changes made
1. Mobile panel scroll reliability
- `frontend/src/components/RightPanel.jsx`:
  - prop nou `fill`
  - pe `fill=true`: `flex:1`, `minHeight:0`, `overflowY:auto`, `WebkitOverflowScrolling:touch`
- `frontend/src/App.jsx`:
  - in drawer-ul mobil:
    - container cu `minHeight:0` + `overflow:hidden`
    - `RightPanel` este randat cu `fill`
  - overlay `Tools`:
    - wrapper cu `stopPropagation` (nu se inchide accidental la interactiuni/scroll)

2. `RightToolPanel` touch scroll hardening
- `frontend/src/components/RightToolPanel.jsx`:
  - `onClick` stop propagation pe `aside`
  - lista de tool-uri are `minHeight:0` + `WebkitOverflowScrolling:touch`

3. Keyboard focus behavior (`Toolbar` engine in `frontend/src/App.jsx`)
- `sheet` focus (cand e selectat un singur node `sheet`):
  - `Arrow`/`Tab`/`Enter` muta celula activa in grid
  - typing (`key.length===1`) scrie direct in celula activa
  - `Backspace/Delete` editeaza/sterge continutul celulei active
- `deck` focus (cand e selectat un singur node `deck`):
  - `ArrowLeft/ArrowRight` navigheaza slide-urile
  - typing scrie direct in `slide.body`
  - `Enter` adauga newline in body
  - `Backspace/Delete` editeaza/sterge din body
- fallback:
  - shortcut-urile globale raman active doar cand nu e focus contextual in `sheet`/`deck`

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Mobile complete pass: dedicated Tools drawer + exclusive panel toggles

### Scope
Finalizare usability mobil pentru editor dupa redesign-ul tools panel: acces complet la unelte pe mobil, fara overlap/conflict intre panouri.

### Changes made
1. Mobile tools drawer flow (`frontend/src/App.jsx`)
- state nou:
  - `mobileToolsOpen`
- TopBar mobil are acum doua toggles separate:
  - `Tools`
  - `Panel`
- toggles sunt exclusive:
  - deschiderea `Tools` inchide `Panel`
  - deschiderea `Panel` inchide `Tools`
- `Escape` inchide ambele drawer-e mobile.

2. RightToolPanel mobile support (`frontend/src/components/RightToolPanel.jsx`)
- prop nou:
  - `onRequestClose`
- pe `isMobile`, panelul afiseaza buton `Close` in header.
- drawer mobil este randat ca overlay cu `RightToolPanel` pe stanga (`side="left"`).

3. Mobile canvas chrome polish
- `Toolbar`:
  - respecta safe-area iOS la bottom:
    - `bottom: max(12px, env(safe-area-inset-bottom))`
  - se ascunde cand e deschis un drawer mobil (`Tools` sau `Panel`) ca sa nu blocheze UI.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - UX update: tools panel moved to left + hide/unhide toggle

### Scope
Ajustare directa dupa feedback: meniul principal de unelte trebuie pe stanga si controlabil rapid prin hide/unhide.

### Changes made
1. Panel position update
- `frontend/src/components/RightToolPanel.jsx`:
  - prop nou `side` (`left`/`right`)
  - prop nou `leftInset`
  - pozitionare conditionala:
    - `side="left"` -> panel ancorat pe stanga
    - `side="right"` -> comportament vechi

2. Desktop toggle UX
- `frontend/src/App.jsx` (`InnerApp`):
  - state nou `toolsPanelOpen`
  - buton flotant:
    - `Hide Tools` / `Show Tools`
  - panelul este randat conditionat:
    - desktop + `toolsPanelOpen=true`
  - pe mobil:
    - panelul nou ramane inchis (`toolsPanelOpen=false`) si se pastreaza fluxul mobil existent

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Hotfix: Spreadsheet/Slides tools restored in right panel + redeploy

### Scope
Fix de regresie UX dupa mutarea toolbar-ului pe dreapta: optiunile vizibile pentru Excel/PowerPoint au disparut din panelul desktop.

### Changes made
1. Right tools panel (`frontend/src/components/RightToolPanel.jsx`)
- adaugate tool-uri explicite in categoria `Board Elements`:
  - `Spreadsheet (Excel)` -> selecteaza tool `sheet` (shortcut `N/B`)
  - `Slides (PowerPoint)` -> selecteaza tool `deck` (shortcut `O`)
- iconografie noua line-based pentru:
  - `sheet`
  - `deck`

2. Validation + deploy
- `cmd /c npm run build` in `frontend/` -> PASS
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1` -> PASS
- health live:
  - `https://board.private-driver.ro/api/health` -> `status: ok`

## 2026-03-03 - Right-side tools redesign (desktop) + glyph cleanup

### Scope
Implementare redesign UI cerut pentru meniu unelte pe partea dreapta, cu categorii clare si UX mai aproape de Miro-like tool recognition.

### Changes made
1. New desktop tools panel component
- fisier nou/actualizat:
  - `frontend/src/components/RightToolPanel.jsx`
- features:
  - panel flotant pe dreapta (light neutral surface)
  - categorii colapsabile:
    - Board Elements
    - Media
    - Structure
    - Interaction
  - iconografie line-based consistenta, icon size marit, labels + tooltips
  - search intern pentru filtrare unelte
  - quick actions dedicate jos:
    - undo, redo, snap, dependency mode
  - upload flows rapide:
    - image upload
    - file card
    - video link card
  - actions interaction:
    - share (copy URL)
    - export JSON

2. App wiring (desktop vs mobile)
- `frontend/src/App.jsx`:
  - import nou:
    - `RightToolPanel`
  - desktop:
    - toolbar-ul vechi este ascuns vizual, dar ramane montat pentru keyboard engine (shortcut-uri existente)
    - `RightToolPanel` este randat pe desktop, pozitionat langa `RightPanel` pentru a evita overlap
  - mobile:
    - toolbar-ul vechi ramane activ vizual (fallback mobil intact)

3. Glyph cleanup (frontend)
- `frontend/src/App.jsx`:
  - in `DeckNode`, butoanele prev/next aveau glyph corupt (`�`)
  - inlocuit cu ASCII clar:
    - `<`
    - `>`

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Spreadsheet (`sheet`) + Slides (`deck`) containers (functional)

### Scope
Implementare cerinta de product: tabel Excel real (cu formule) + container PowerPoint functional direct pe canvas.

### Changes made
1. State domain (`frontend/src/state/boardState.js`)
- factories noi:
  - `makeSheetNode(...)`
  - `makeDeckNode(...)`
- template-uri noi:
  - `spreadsheet`
  - `slides`
- template `table` migrat pe `sheet` (nu mai genereaza grid de stickies)
- clone safety:
  - `DUP` + `PASTE` fac deep-clone pentru:
    - `sheetCells`
    - `deckSlides`
    - metadata asociata

2. Canvas nodes + UX (`frontend/src/App.jsx`)
- component nou `SpreadsheetNode`:
  - grid editabil real (row/col headers)
  - formula bar
  - resize rows/cols (`+/- R`, `+/- C`)
  - evaluator formule:
    - referinte (`A1`)
    - range (`A1:B5`)
    - functii (`SUM`, `AVG`, `MIN`, `MAX`, `COUNT`)
    - cycle detection (`#CYCLE!`)
    - error fallback (`#ERR`)
- component nou `DeckNode`:
  - prev/next slide
  - add/delete slide
  - editare titlu/body per slide
  - thumbnails/selectie slide
- render switch extins:
  - `type: "sheet"`
  - `type: "deck"`
- tooling:
  - `table` insereaza acum `sheet`
  - tool nou `sheet` (`N`)
  - tool nou `deck` (`O`)
  - cursor map extins pentru noile tool-uri
  - context menu include acum `Slides` (insert rapid `deck`)
  - `App.jsx` re-normalizat UTF-8 (fara mojibake pe iconuri/labels)

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Roadmap kickoff: Jira import MVP (phase 1 multi-tracker)

### Scope
Pornire implementare concreta din roadmap-ul "depasim Miro pe execution wedge": al doilea tracker major (Jira) adus in execution panel.

### Changes made
1. Backend Jira import (`backend/server.js`)
- endpoint nou:
  - `POST /api/boards/:id/integrations/jira/import`
- auth suport:
  - request overrides:
    - `jiraEmail`, `jiraToken` (body/header)
  - env fallback:
    - `JIRA_EMAIL`
    - `JIRA_TOKEN`
- mapping Jira -> execution plan:
  - fields issue:
    - `summary`, `description`, `assignee`, `priority`, `status`, `duedate`
  - dependencies:
    - `issuelinks` -> `dependsOn` (`jira-KEY`)
  - milestones:
    - `fixVersions` -> `milestones[]`
- endpoint Jira search actualizat la API curent:
  - `POST /rest/api/3/search/jql` (in loc de endpoint-ul legacy retras)
- sync metadata:
  - `board.integrations.jira[site::project]`
- audit:
  - event nou `board.jira.import`
- observability:
  - `/api/health` include status minimal Jira env auth.

2. Frontend execution panel (`frontend/src/App.jsx`, `frontend/src/hooks/useRightPanelAi.js`, `frontend/src/components/RightPanel.jsx`)
- API nou:
  - `api.jiraImport(boardId, payload)`
  - `jiraApi.import(...)` transmis catre `RightPanel`
- UI nou in `EXECUTION PLAN`:
  - bloc `JIRA IMPORT (MVP)`
  - inputs:
    - site
    - project key
    - email
    - token
    - state filter (`open/all/closed`)
  - action:
    - `Import Jira -> Board`
- flow:
  - raspunsul Jira este aplicat in canvas prin pipeline-ul existing `applyExecutionPlan(...)`.

3. Config
- `backend/.env.example` extins cu:
  - `JIRA_EMAIL`
  - `JIRA_TOKEN`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS

### Deploy
- `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild` -> PASS
- health local/public -> PASS

## 2026-03-03 - GitHub sync depth hardening (milestones + dependencies + retry/idempotency) + deploy live

### Scope
Finalizare pasul "sync depth" din roadmap execution: reconciliere milestone la push, parsing dependinte mai robust la import, protectie retry/backoff si idempotency keys end-to-end.

### Changes made
1. Backend sync hardening (`backend/server.js`)
- retry/backoff pe toate call-urile GitHub (`githubRequest`):
  - status-uri retryable: `408/409/425/429/5xx`
  - suport `Retry-After`
  - exponential backoff + jitter
  - config env:
    - `GITHUB_RETRY_MAX_ATTEMPTS`
    - `GITHUB_RETRY_BASE_MS`
- idempotency keys active pe import/push:
  - input:
    - body `idempotencyKey`
    - headers `Idempotency-Key` / `X-Idempotency-Key`
  - store per board:
    - `board.integrations.github_idempotency`
    - TTL configurabil: `GITHUB_IDEMPOTENCY_TTL_SEC`
  - comportament:
    - replay response cached (`status=done`)
    - reject concurrent duplicate (`409` cand acelasi key e `pending`)
    - clear key la eroare, persist response la succes
- milestone reconciliation la `POST /api/boards/:id/integrations/github/push`:
  - construieste setul dorit de milestone din task-uri (`milestoneTitle`, `dueDate`, `status`)
  - fetch existing milestones si:
    - creeaza milestone lipsa
    - update pentru `state` (`open/closed`) si `due_on` cand diferite
  - response/audit include stats:
    - `milestones: { desired, matched, created, updated }`
- dependency parser avansat la import (`extractDependenciesFromIssueBody`):
  - fix regex keyword chunk (`[^\n]*`, nu varianta corupta)
  - parse suplimentar:
    - `issue 123` / `issue #123`
    - `/issues/123` (path references)
    - linii explicite `depends-on:` / `blocked-by:` / `requires:`
  - continua suport pentru URL-uri GitHub si cross-repo refs (`owner/repo#123`)

2. Frontend idempotency wiring
- `frontend/src/hooks/useRightPanelAi.js`:
  - genereaza chei idempotency pentru:
    - `runGitHubImport` (`gh-import:*`)
    - `runGitHubPush` (`gh-push:*`)
- `frontend/src/App.jsx`:
  - API methods `githubImport/githubPush` trimit `Idempotency-Key` header cand payload-ul include cheia.

3. Config
- `backend/.env.example` extins cu:
  - `GITHUB_RETRY_MAX_ATTEMPTS=4`
  - `GITHUB_RETRY_BASE_MS=350`
  - `GITHUB_IDEMPOTENCY_TTL_SEC=3600`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS

### Deploy
- comanda:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
- rezultat:
  - deploy live complet pe `https://board.private-driver.ro`
  - health checks local/public -> PASS
  - homepage publica -> `HTTP/2 200`

## 2026-03-03 - GitHub OAuth + token vault + execution panel auth UX

### Scope
Finalizare phase 3 pentru AI differentiator v2: eliminare token manual din UI si mutare pe OAuth + vault per user.

### Changes made
1. Backend OAuth + vault (`backend/server.js`)
- endpoint-uri noi:
  - `GET /api/integrations/github/oauth/start`
  - `GET /api/integrations/github/oauth/callback`
  - `GET /api/integrations/github/oauth/status`
  - `DELETE /api/integrations/github/oauth/status`
- token vault:
  - stocare per user in `users.json` la `user.integrations.github`
  - token criptat AES-256-GCM (`token_cipher/token_iv/token_tag`)
- token resolution pentru sync:
  - request token -> header token -> user vault token -> `GITHUB_TOKEN` env fallback
- `/api/health` extins cu info GitHub:
  - `oauth_configured`
  - `env_fallback_token`
  - `api_base`

2. Frontend execution panel (`frontend/src/hooks/useRightPanelAi.js`, `frontend/src/components/RightPanel.jsx`, `frontend/src/App.jsx`)
- API frontend nou:
  - `githubOAuthStatus`
  - `githubOAuthStart`
  - `githubOAuthDisconnect`
- UI:
  - eliminat input-ul de token din `EXECUTION PLAN`
  - adaugat `Connect GitHub` / `Disconnect` + status (`connected/env fallback/not connected`)
  - import/push raman in acelasi panel, dar folosesc tokenul rezolvat in backend
- OAuth popup flow:
  - `window.open(...)` + `postMessage` callback pentru confirmare conectare
  - refresh automat status dupa connect/disconnect

3. Config
- `backend/.env.example` extins cu:
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`
  - `GITHUB_OAUTH_REDIRECT_URI`
  - `GITHUB_OAUTH_SCOPES`
  - `GITHUB_TOKEN_VAULT_SECRET`
  - `PUBLIC_BASE_URL`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Frontend text encoding fix (landing/editor mojibake)

### Scope
Fix pentru caractere afisate gresit pe frontend (`â†’`, `ðŸ...`, simboluri aparent chirilice) cauzate de text mojibake in fisierele React.

### Changes made
1. Re-encoding frontend source
- fisiere corectate:
  - `frontend/src/App.jsx`
  - `frontend/src/state/boardState.js`
- continutul textual a fost reconvertit din interpretare `Windows-1252` catre `UTF-8`.
- rezultat:
  - texte landing corecte (`→`, `—`, `◈`, diacritice),
  - emoji/icon labels restaurate in toolbar/context menu/template-uri,
  - eliminare secvente corupte care aratau ca "semne chirilice".

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

### Deploy
- comanda:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1`
- rezultat:
  - deploy complet pe `https://board.private-driver.ro`
  - health checks local/public -> PASS
  - `HTTP/2 200` pe pagina publica

## 2026-03-03 - GitHub sync hardening (incremental pull + conflict strategy) + deploy live

### Scope
Extindere peste MVP-ul GitHub sync cu capabilitati de productie:
- pull incremental bazat pe ultima sincronizare,
- conflict handling la push (ca sa evitam overwrite accidental pe issue-uri modificate remote),
- deploy live + smoke checks.

### Changes made
1. Backend hardening (`backend/server.js`)
- state de sync per board/repo in `board.integrations.github[repoKey]`:
  - `last_import_at`, `last_import_iso`, `last_issue_updated_at`
  - `last_push_at`, `last_push_iso`
  - `last_pull_count`, `last_push_count`
  - `last_conflicts`, `last_conflict_strategy`
- import endpoint (`POST /api/boards/:id/integrations/github/import`):
  - parametri noi:
    - `incremental` (default `true`)
    - `since` (optional, unix/ISO)
  - foloseste `since` automat din sync state cand import incremental
  - merge incremental:
    - update issues venite din GitHub peste task-urile execution existente de acelasi repo
    - pastreaza task-urile existente care nu au aparut in delta
  - persista sync state + audit details extinse
- push endpoint (`POST /api/boards/:id/integrations/github/push`):
  - parametru nou:
    - `conflictStrategy`: `skip_remote_newer` | `prefer_board` | `prefer_remote`
  - detectie conflict:
    - compara `issue.updated_at` remote cu `issueUpdatedAt/lastSyncedAt` din task
  - comportament:
    - `skip_remote_newer` / `prefer_remote`: skip update daca remote e mai nou
    - `prefer_board`: aplica update chiar daca remote e mai nou
  - fallback robust:
    - daca `issueNumber` indicat nu mai exista (404), creeaza issue nou
  - response extins:
    - `skipped`, `conflicts`, `conflictStrategy`, `sync`
    - `linked[].issueUpdatedAt`
  - persista sync state + audit details extinse

2. Frontend hardening (`frontend/src/hooks/useRightPanelAi.js`, `RightPanel.jsx`)
- controale noi in UI:
  - `Incremental import (from last sync)` checkbox
  - `Conflict` selector (`skip if remote newer` / `prefer board` / `prefer remote`)
- payload extins:
  - import trimite `incremental`
  - push trimite `conflictStrategy`
- metadata execution extinsa pe noduri:
  - `executionIssueUpdatedAt`
  - `executionLastSyncedAt`
  - `executionRepo`
  - plus `executionTitle`, `executionDescription` pentru sync stabil
- task extraction pentru push include acum campuri de conflict anchor (`issueUpdatedAt`, `lastSyncedAt`, `repo`).
- dupa push, nodurile se actualizeaza local cu:
  - `executionIssueUpdatedAt`
  - `executionLastSyncedAt`
  - `executionRepo`

3. Deploy live
- comanda:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
- rezultat:
  - deploy complet cu restart service + nginx reload + health checks PASS
  - domain activ:
    - `https://board.private-driver.ro`

4. Live smoke for new routes
- verificare endpointuri noi:
  - `POST /api/boards/does-not-exist/integrations/github/import` -> `404 {"error":"Board not found"}`
  - `POST /api/boards/does-not-exist/integrations/github/push` -> `404 {"error":"Board not found"}`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS
- deploy script + local/public health -> PASS

## 2026-03-03 - GitHub bidirectional sync MVP (execution board <-> issues)

### Scope
Livrare prim pas pentru `AI differentiator v2`: sync bidirectional intre execution board si GitHub issues, direct din panelul `EXECUTION PLAN`.

### Changes made
1. Backend GitHub integration endpoints
- `backend/server.js`:
  - endpoint nou import:
    - `POST /api/boards/:id/integrations/github/import`
  - endpoint nou push:
    - `POST /api/boards/:id/integrations/github/push`
  - access control:
    - import -> `canReadBoard`
    - push -> `canEditBoard`
  - features import:
    - fetch issues din `owner/repo` (state open/closed/all)
    - mapare in plan structurat (`milestones/tasks/risks`) compatibil execution renderer
    - include metadata issue (`issueNumber`, `issueUrl`, `issueState`)
  - features push:
    - upsert issues din task-urile execution (`create`/`update` dupa `issueNumber`)
    - body + labels standardizate (`boardai:execution`, `priority:*`, `status:*`)
    - linkage returnata catre frontend (`nodeId` -> `issueNumber/url/state`)
  - env support:
    - `GITHUB_TOKEN` (fallback daca tokenul nu e trimis din UI)
    - `GITHUB_API_BASE`
  - audit events noi:
    - `board.github.import`
    - `board.github.push`

2. Frontend API wiring
- `frontend/src/App.jsx`:
  - API methods noi:
    - `githubImport(...)`
    - `githubPush(...)`
  - `InnerApp` transmite `githubApi` catre `RightPanel`.

3. Execution panel UI + hook logic
- `frontend/src/components/RightPanel.jsx`:
  - sectiune noua in `EXECUTION PLAN`:
    - `repo` input (`owner/repo`)
    - token input (optional cand backend are `GITHUB_TOKEN`)
    - state selector (`open/all/closed`)
    - CTA:
      - `Import -> Board`
      - `Push Board -> Issues`
- `frontend/src/hooks/useRightPanelAi.js`:
  - state/actions noi GitHub:
    - `ghRepo`, `ghToken`, `ghState`, `ghLoading`, `ghError`, `ghSummary`
    - `runGitHubImport()`
    - `runGitHubPush()`
  - `extractExecutionTasksForSync()` pentru payload push din nodurile execution
  - execution nodes extinse cu metadata issue:
    - `executionIssueNumber`
    - `executionIssueUrl`
    - `executionIssueState`
    - `executionSourceRefs`
  - card text include acum linia `Issue: #...` / `Issue: NEW`

4. Env example
- `backend/.env.example`:
  - adaugat `GITHUB_TOKEN`
  - adaugat `GITHUB_API_BASE`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Execution wedge v1 hardening: strict execution contract + deterministic board mapping

### Scope
Intarire a flow-ului `EXECUTION PLAN` pentru output robust si actionabil, cu campuri explicite per task (owner/priority/status/due/milestone) si randare determinista in canvas.

### Changes made
1. Strict execution contract in AI prompt
- `frontend/src/ai/prompts.js` (`EXEC_SYS`):
  - schema trecuta de la output generic `nodes/arrows` la output de tip plan:
    - `objectives[]`
    - `milestones[]`
    - `tasks[]`
    - `risks[]`
  - campuri task obligatorii:
    - `stage`, `owner`, `priority`, `status`, `dueDate`, `milestoneId`
  - reguli explicite pentru IDs consistente (`m*`, `t*`, `r*`) si dependinte valide.

2. Deterministic execution renderer in frontend
- `frontend/src/hooks/useRightPanelAi.js`:
  - flow nou:
    - `normalizeExecutionPlan(raw)`
    - `applyExecutionPlan(raw, replace)`
  - normalizare robusta:
    - stage/priority/status/date mapping
    - milestone/risk normalization
    - dependency resolution by task id/title refs
  - randare board:
    - lanes `NOW / NEXT / LATER`
    - task sticky-uri cu metadata execution:
      - `executionTaskId`, `executionOwner`, `executionPriority`, `executionStatus`, `executionDueDate`, `executionMilestone*`
    - milestones/risk panels dedicate + arrows pentru milestone/dependency/risk links
  - `runExecutionPlan()` foloseste acum `applyExecutionPlan(...)` in loc de pipeline generic `applyParsed(...)`.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Refactor phase 4: extract PropsPanel + FileZone from App.jsx

### Scope
Reducerea monolitului `frontend/src/App.jsx` prin mutarea panelurilor cu cea mai mare densitate UI/logic in componente dedicate.

### Changes made
1. New components
- `frontend/src/components/PropsPanel.jsx`
- `frontend/src/components/FileZone.jsx`

2. RightPanel integration
- `frontend/src/components/RightPanel.jsx`:
  - importa direct noile componente
  - transmite catre `PropsPanel` dependintele pentru table flow:
    - `getTableInfo`
    - `TABLE_DEFAULT_COL_WIDTH`
    - `TABLE_MIN_COLS`
    - `TABLE_MIN_ROWS`
    - `TABLE_MIN_COL_WIDTH`
    - `TABLE_MAX_COL_WIDTH`

3. App cleanup
- `frontend/src/App.jsx`:
  - eliminate implementarile locale `PropsPanel` si `FileZone`
  - `RightPanel` primeste acum doar dep-urile necesare pentru noile componente.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Execution wedge v1 MVP (PRD/repo/issues -> execution board)

### Scope
Start implementare efectiva pentru wedge-ul de diferentiere: execution workspace pentru product + engineering.

### Changes made
1. Prompt dedicated pentru execution planning
- `frontend/src/ai/prompts.js`:
  - constant nou `EXEC_SYS`
  - focus: milestones, dependencies, owners (TBD), risks, timeline lanes

2. Hook AI extins
- `frontend/src/hooks/useRightPanelAi.js`:
  - state nou execution flow:
    - `execInput`, `execLoading`, `execError`, `execSummary`, `execReplace`
  - action nou:
    - `runExecutionPlan()`
  - output-ul este aplicat pe canvas prin acelasi pipeline robust (`applyParsed`)

3. UI in RightPanel
- `frontend/src/components/RightPanel.jsx`:
  - sectiune noua `EXECUTION PLAN`:
    - textarea pentru context PRD/repo/issues
    - checkbox replace canvas
    - CTA `Generate execution board`
  - feedback de eroare/sumar generatie

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Audit timeline UI + AI endpoint rate-limit/observability

### Scope
Pornire implementare pe taskurile nou introduse: vizibilitate audit direct in editor si hardening operational pentru endpointul AI.

### Changes made
1. Audit timeline UI (frontend)
- fisier nou:
  - `frontend/src/components/AuditTimelinePanel.jsx`
- integrare:
  - `frontend/src/components/RightPanel.jsx`
  - `frontend/src/App.jsx` (API wiring `auditList` + `auditApi`)
- capabilitati UI:
  - listare evenimente audit in panel colapsabil
  - filtre rapide:
    - `action`
    - `limit`
  - refresh manual
  - afisare actor/time/details summary pe eveniment

2. Audit API filtering/enrichment (backend)
- `GET /api/boards/:id/audit` extins cu query params:
  - `limit`
  - `action` (single/csv)
  - `actorId`
  - `min_ts`
- response events includ acum actor enrichment:
  - `actor: { id, name, email, color }` cand exista user.

3. AI rate-limit + observability (backend)
- config env nou:
  - `AI_RATE_WINDOW_SEC`
  - `AI_RATE_MAX`
- middleware nou:
  - `aiRateLimit`
- endpoint:
  - `POST /api/ai/complete` -> `optAuth + aiRateLimit`
- health telemetry extins:
  - `GET /api/health` include `ai` metrics
    - `requests/success/errors/repaired/rate_limited`
    - `last_error/last_model/last_usage/last_latency_ms`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Enterprise baseline closed: audit trail + realtime RBAC enforcement + mobile-ready hardening

### Scope
Finalizare celor 2 pasi enterprise ceruti (audit + Socket.IO RBAC), plus hardening mobil pentru utilizare reala pe ecrane mici.

### Changes made
1. Backend audit log (`backend/server.js`)
- storage nou:
  - `backend/data/audit.json`
- helpers noi:
  - `readAudit`, `writeAudit`, `appendAuditEvent`, `listBoardAuditEvents`
- endpoint nou:
  - `GET /api/boards/:id/audit` (read access required)
- audit events introduse pentru:
  - `board.create`, `board.rename`, `board.save`, `board.restore`, `board.delete`
  - `board.member.add`, `board.member.role`, `board.member.remove`

2. Realtime RBAC enforcement (Socket.IO)
- `board:join` verifica board existence + `canReadBoard`, altfel emite `board:join:error`.
- `board:sync` verifica membership room + `canEditBoard`, altfel emite `board:sync:error`.
- `cursor:move` verifica membership room + `canReadBoard`.
- metadata colaboratori in room include acum si `userId` + `role`.

3. Frontend realtime auth/error wiring
- `frontend/src/App.jsx`:
  - socket trimite token auth la `board:join`
  - listeners pentru:
    - `board:join:error`
    - `board:sync:error`
  - feedback prin toast pe deny.

4. Mobile readiness hardening (`frontend/src/App.jsx`)
- editor:
  - right panel mobil in drawer overlay (deschidere din top bar)
  - toolbar mutat jos pe mobil + scroll orizontal
  - touch support extins pe canvas + handles + noduri
  - pinch-to-zoom cu 2 degete
- shell pages:
  - `LandingPage`, `AuthModal`, `Dashboard`, `SearchPanel`, `ShortcutsPanel` responsive tuning
  - densitate/padding/coloane adaptate pentru viewport mic

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS
- smoke audit flow local -> PASS (create/save/restore/member actions + query audit)

## 2026-03-03 - Workspace RBAC baseline (owner/editor/viewer) + sharing UI

### Scope
Implementare primul strat RBAC real pentru board-uri, cu membership management (by email) si autorizare pe read/edit/manage.

### Changes made
1. Backend RBAC core (`backend/server.js`)
- roluri introduse:
  - `owner` (manage + edit + read)
  - `editor` (edit + read)
  - `viewer` (read)
- helpers noi:
  - `boardRoleForUser`
  - `canReadBoard`
  - `canEditBoard`
  - `canManageBoard`
  - `ensureBoardMembersShape`
- schimbari de acces:
  - `GET /api/boards` filtreaza dupa `canReadBoard` si returneaza `access_role`
  - `GET /api/boards/:id` returneaza board + `access_role`
  - history list/detail folosesc `canReadBoard`
  - save/rename/restore folosesc `canEditBoard`
  - delete foloseste `canManageBoard` (owner only)
- create board:
  - `POST /api/boards` este acum `requireAuth` (board nou are owner explicit + `members: []`)

2. Backend sharing endpoints
- endpointuri noi:
  - `GET /api/boards/:id/members` (owner only)
  - `PUT /api/boards/:id/members` (owner only, body: `{ email, role }`, role `editor|viewer`)
  - `DELETE /api/boards/:id/members/:userId` (owner only)
- response membership include metadata utila (`email`, `name`, `color`, `role`).

3. Frontend sharing panel
- fisier nou: `frontend/src/components/BoardAccessPanel.jsx`
  - list members
  - grant access by email (`viewer/editor`)
  - remove member
  - feedback pentru non-owner
- integrare in `RightPanel`:
  - `frontend/src/components/RightPanel.jsx`
- wiring API in `frontend/src/App.jsx`:
  - `members`, `setMember`, `removeMember`
  - pass `currentUser` + `accessApi` catre `RightPanel`

### Validation
- `node --check backend/server.js` -> PASS
- `cmd /c npm run build` in `frontend/` -> PASS
- smoke RBAC flow local -> PASS:
  - owner create
  - non-member denied
  - add viewer -> read ok/edit denied
  - promote editor -> edit ok
  - editor delete denied, owner delete ok

## 2026-03-03 - Frontend version history panel (list + preview + restore with confirmation)

### Scope
Implementare UI pentru istoricul de versiuni direct in editor, conectat la endpoint-urile backend deja existente.

### Changes made
1. Frontend UI component nou
- fisier nou: `frontend/src/components/VersionHistoryPanel.jsx`
- functionalitati:
  - listare versiuni (`GET /api/boards/:id/history`)
  - preview snapshot selectat (`GET /api/boards/:id/history/:versionId`)
  - restore cu confirmare in 2 pasi (`POST /api/boards/:id/history/:versionId/restore`)
  - metadata utile in UI (reason, timestamp, size, counts nodes/arrows/comments)

2. Right panel integration
- `frontend/src/components/RightPanel.jsx`
  - integrare `VersionHistoryPanel` sub `PropsPanel`
  - wiring pentru `boardId`, API calls si callback restore.

3. App integration
- `frontend/src/App.jsx`
  - API helpers noi:
    - `historyList`
    - `historyGet`
    - `historyRestore`
    - `_json` pentru error handling consistent la endpoint-urile de history
  - in `InnerApp`:
    - `historyApi` memoized
    - `applyRestoredState` aplica snapshot-ul restaurat in reducer (`LOAD`) pentru update imediat in canvas
    - notificari prin toast la restore success/error

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-03 - Miro++ kickoff: board version history API (snapshot + restore)

### Scope
Pornire roadmap "depasim Miro" cu un milestone de baseline enterprise: version history backend.

### Changes made
1. Backend history model (`backend/server.js`)
- board schema extins cu:
  - `versions[]`
  - `latest_version_hash`
  - `last_version_at`
- snapshot capture:
  - la create (`reason: create`)
  - la save (`reason: save`)
  - la restore (`reason: restore:*`)
- throttling inteligent:
  - dedupe pe hash
  - rolling update in fereastra scurta pentru a evita versiuni excesive la autosave

2. API endpoints noi
- `GET /api/boards/:id/history`
- `GET /api/boards/:id/history/:versionId`
- `POST /api/boards/:id/history/:versionId/restore`

3. Minor hardening
- validare input `data` pe `PUT /api/boards/:id` (trebuie object)
- response `GET /api/boards/:id` nu expune snapshots complete din history

### Validation
- `node --check backend/server.js` -> PASS
- smoke test local endpoint flow -> PASS:
  - create board
  - save data
  - list history
  - fetch version snapshot
  - restore snapshot

## 2026-03-02 - Refactor phase 3: extracted board state domain (helpers + reducer) from App.jsx

### Scope
Continuarea modularizarii `App.jsx`: mutare a logicii de state/domain (reducer + helpere canvas/table/templates) intr-un modul dedicat.

### Changes made
1. New module `frontend/src/state/boardState.js`
- adaugata fabrica:
  - `createBoardState({ T, SC, CANVAS_THEMES, uid })`
- mutat din `App.jsx`:
  - helpere core:
    - `GRID`, `snap`
    - `SHAPE_DEFAULTS`, `SHAPE_TYPES`
    - constante tabel (`TABLE_*`)
    - `TIDY_GAP_*`, `MINDMAP_CHILD_GAP_*`
    - `makeShapeNode`, `makeTablePack`
    - `getTableInfo`, `getTableColumnStart`, `collectDependency`
  - template registry:
    - `TPLS`
  - state logic:
    - `reducer`
    - `INIT`

2. `frontend/src/App.jsx` cleanup
- import nou:
  - `createBoardState` din `./state/boardState`
- state domain este acum injectat si consumat prin:
  - `const { ... } = createBoardState({ T, SC, CANVAS_THEMES, uid })`
- eliminate definitiile locale duplicate pentru helpere/reducer/templates.

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-02 - Refactor phase 2: extracted RightPanel into component + hook

### Scope
Continuarea modularizarii `App.jsx`: separare completa a `RightPanel` (UI + AI/file-flow state/actions).

### Changes made
1. New hook `frontend/src/hooks/useRightPanelAi.js`
- mutat state + flow pentru:
  - AI chat send/apply (`send`, `applyParsed`)
  - file planner/generator (`handleFile`, `runFileGeneration`)
  - normalize node/arrow pentru output AI
  - state reset (`clearAll`) si `voteResults`

2. New component `frontend/src/components/RightPanel.jsx`
- mutata UI pentru panelul din dreapta:
  - file zone section
  - template picker section
  - vote results
  - AI chat area
- componenta consuma hook-ul nou `useRightPanelAi`.

3. `frontend/src/App.jsx` cleanup
- eliminata implementarea locala `RightPanel`
- adaugat import nou:
  - `import RightPanel from "./components/RightPanel";`
- `InnerApp` transmite dependintele necesare (`s`, `d`, `T`, `SC`, `uid`, shape defaults/types, `PropsPanel`, `FileZone`).

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-02 - Refactor phase 1: extracted AI modules from App.jsx

### Scope
Primul pas din modularizarea `frontend/src/App.jsx`: separare a prompturilor si helperelor AI in fisiere dedicate.

### Changes made
1. New module `frontend/src/ai/prompts.js`
- mutat prompturile:
  - `WB_SYS`
  - `SW_PLAN_SYS`
  - `SW_SYS`
- mutat constantele UI/flow AI:
  - `FILE_TEMPLATE_KEYS`
  - `FILE_TEMPLATE_LABELS`
  - `AI_CHIPS`

2. New module `frontend/src/ai/helpers.js`
- mutat helperele:
  - `aiCall()`
  - `parseAiJson()`
  - `normalizeTemplatePlan()`
  - `buildFileGenerationPrompt()`

3. `frontend/src/App.jsx` cleanup
- importuri noi din `./ai/prompts` si `./ai/helpers`
- eliminat duplicatele locale pentru prompturi/helpere AI
- `RightPanel` foloseste acum:
  - `AI_CHIPS` in loc de constanta locala
  - `buildFileGenerationPrompt()` in loc de `fileGenPrompt()`

### Validation
- `cmd /c npm run build` in `frontend/` -> PASS

## 2026-03-02 - Implemented all 3 requested features (tables + swimlanes + dependency mode)

### Scope
Implementare simultana pentru:
1. selectare multi-celula + merge/unmerge in tabel,
2. swimlanes orizontale/verticale,
3. dependency mode pentru upstream/downstream.

### Changes made
1. Table advanced editing
- selectare range de celule cu `Shift+Click` pe celule din acelasi tabel
- reducer actions noi:
  - `TABLE_MERGE_SEL`
  - `TABLE_UNMERGE_SEL`
- merge:
  - celulele din dreptunghiul selectat sunt unite intr-o celula root
  - celulele secundare devin `hidden` si referenceaza `mergeParentId`
- unmerge:
  - restaureaza celulele ascunse si geometria grid-ului
- controale noi in `PropsPanel`:
  - butoane `merge` / `unmerge`

2. Swimlanes
- tool-uri noi:
  - `laneH` (horizontal) shortcut `J`
  - `laneV` (vertical) shortcut `K`
- context menu extins:
  - `Swimlane H`, `Swimlane V`
- component nou de randare: `LaneNode`
- orientare lane editabila in `PropsPanel` (horizontal/vertical)

3. Dependency mode
- stare noua in reducer: `depMode` + action `DEP_MODE`
- activare:
  - toolbar button `⇄`
  - shortcut `Ctrl+Shift+D`
- efect:
  - nodurile/legaturile nerelevante sunt estompate
  - upstream highlight albastru
  - downstream highlight verde
- overlay informativ in canvas cand modul e activ

4. Quality improvements around hidden/merged nodes
- lasso/selection/all/minimap/search/stats folosesc noduri vizibile (`!hidden`)
- export SVG/PNG ignora nodurile ascunse (rezultate curate dupa merge)

### Validation
- `npm run build` in `frontend/` -> PASS

## 2026-03-02 - New productivity features: auto-layout, wrap frame, mind-map shortcuts

### Scope
Adaugare de functionalitati practice care ajuta utilizatorul sa organizeze rapid board-uri mari/complexe si sa captureze idei mai fluent.

### Changes made
1. Auto-layout (Tidy)
- reducer action nou: `TIDY`
- aranjeaza elementele selectate (sau all cand e folosit global) intr-o grila lizibila
- preserveaza undo/redo history
- shortcut: `Ctrl+Shift+L`
- buton in toolbar (`↹`) + context menu entry

2. Wrap in Frame
- reducer action nou: `WRAP_FRAME`
- creeaza un frame in jurul selectiei curente, cu margini utile pentru prezentare
- buton in toolbar (`⬚`) + context menu entry

3. Mind-map keyboard flow (single selection)
- `Tab` -> creeaza child sticky + arrow din nodul curent
- `Enter` -> creeaza sibling (copie structurala) si il leaga la acelasi parinte cand exista
- hint UI in canvas: `Tab child · Enter sibling`

### Validation
- `npm run build` in `frontend/` -> PASS

## 2026-03-02 - File upload AI: template recommendation + explicit user choice

### Scope
Pentru fisierele incarcate in Spider/File zone, AI nu mai genereaza direct board-ul. Mai intai propune template, recomanda varianta optima vizual, apoi userul alege explicit template-ul de aplicat.

### Changes made
1. Two-step AI flow in `RightPanel` (`frontend/src/App.jsx`)
- pas 1 (planner): `SW_PLAN_SYS`
  - intoarce JSON cu:
    - `recommendedTemplate`
    - `alternatives`
    - `reason`
    - `complexity`
    - `needsTable`
    - `tableReason`
- pas 2 (generation): `SW_SYS`
  - ruleaza doar dupa alegerea template-ului de catre user.

2. UI template picker
- card nou in panel-ul din dreapta:
  - afiseaza template recomandat
  - afiseaza motivul + complexitate + indicator `table: yes/no`
  - permite alegere dintre optiuni + buton "Genereaza cu recomandarea AI"

3. Prompt hardening for clarity/table detection
- `SW_SYS` actualizat:
  - respecta `Template ales: <id>`
  - forteaza claritate vizuala la structuri complexe (clustering + reducere clutter)
  - contine reguli explicite de tabel (`tableId/tableRole/tableRow/tableCol`)
- `normalizeTemplatePlan()` garanteaza optiuni valide si include `table` in optiuni cand `needsTable=true`.

4. State cleanup
- `CLEAR ALL` reseteaza acum si starea de file planning (`fileDraft`, `filePlan`, erori).

### Validation
- `npm run build` in `frontend/` -> PASS

## 2026-03-02 - Table editor controls (rows/cols + column resize)

### Scope
Upgrade pe tool-ul `table` ca sa nu fie doar insert static: management de randuri/coloane si resize pe coloana din panoul de proprietati.

### Changes made
1. Frontend table data model (`frontend/src/App.jsx`)
- `makeTablePack()` adauga metadata pe noduri:
  - `tableId`, `tableRole`, `tableRow`, `tableCol`
- helperi noi:
  - `getTableInfo()`
  - `getTableColumnStart()`

2. Reducer actions noi
- `TABLE_ADD_ROW`
- `TABLE_DEL_ROW`
- `TABLE_ADD_COL`
- `TABLE_DEL_COL`
- `TABLE_SET_COL_WIDTH`
- `PASTE` imbunatatit:
  - remap pentru `groupId` si `tableId` la paste ca sa nu se lege clonele de tabelul original.

3. Props panel table section
- daca nodul selectat apartine unui tabel:
  - butoane `+ row`, `- row`, `+ col`, `- col`
  - slider + input numeric pentru latimea coloanei curente
- pentru noduri din tabel, editarea `W × H` generica este ascunsa, ca sa se mentina consistenta grid-ului.

4. AI alignment
- `WB_SYS` accepta optional metadata de tabel (`tableId/tableRole/tableRow/tableCol`).
- `normalizeAiNodes()` pastreaza metadata de tabel cand exista.
- `applyParsed()` remapeaza `tableId`/`groupId` la valori unice pe insert.

### Validation
- `npm run build` in `frontend/` -> PASS

## 2026-03-02 - Miro-inspired shape expansion + table tool

### Scope
Extindere editor pentru functionalitati vizuale inspirate din Miro, peste setul minim (rect/circle/diamond), cu focus pe cloud-diagrams si tabele tip spreadsheet.

### Changes made
1. Frontend canvas/tools (`frontend/src/App.jsx`)
- shape system extins:
  - tipuri noi: `triangle`, `hexagon`, `parallelogram`, `cloud`, `cylinder`
  - tool-uri noi in toolbar + shortcut-uri:
    - `Y` triangle
    - `X` hexagon
    - `Q` parallelogram
    - `U` cloud
    - `I` cylinder
    - `B` table insert
- context menu extins cu toate formele noi + `Tabel`.
- randare shape upgradata:
  - polygon clipping pentru forme geometrice
  - SVG custom pentru `cloud` si `cylinder`
- export PNG extins pentru noile forme (path-uri dedicate).

2. Table functionality
- adaugat helper `makeTablePack()` pentru inserare rapida tabel (header + grid editabil) direct pe canvas.
- nou tool `table` care insereaza tabele fara a deschide template panel.

3. Templates
- template nou `Cloud Architecture` (forme cloud/cylinder/hexagon/parallelogram + legaturi), orientat pe diagramming tehnic.

4. AI generation alignment
- `WB_SYS` extins cu noile `shapeType` acceptate.
- `normalizeAiNodes()` actualizat:
  - valideaza shape-uri folosind `SHAPE_TYPES`
  - aplica dimensiuni default pe baza `SHAPE_DEFAULTS`
- rezultate AI pot genera direct noile tipuri fara fallback agresiv la `rect`.

### Validation
- `npm run build` in `frontend/` -> PASS

## 2026-03-02 - Fix: Spider generation JSON invalid + passive listener warnings

### Scope
Rezolvare issue raportat in browser:
- `Unable to preventDefault inside passive event listener invocation`
- `⚠ AI a returnat JSON invalid` la generarea Spider din fisier.

### Changes made
1. Frontend (`frontend/src/App.jsx`)
- Canvas wheel handling:
  - eliminat `onWheel` React pentru zoom/pan
  - adaugat listener nativ pe element cu `{ passive: false }`
  - `preventDefault()` apelat doar cand event-ul e cancelable
- parser AI hardening:
  - `aiCall()` accepta direct `payload.json` din backend
  - `parseAiJson()` accepta obiect direct + fallback parse (smart quotes/trailing commas)
- normalizare schema AI:
  - `normalizeAiNodes()` transforma output imperfect in noduri valide (inclusiv string nodes)
  - `normalizeAiArrows()` accepta arrow object/string si rezolva ID/text mapping
  - `applyParsed()` foloseste normalizarea inainte de aplicare pe canvas

2. Backend (`backend/server.js`)
- adaugate utilitare de validare/parse:
  - `stripCodeFences`, `extractFirstBalancedObject`, `parseJsonFromModelText`
- request DeepSeek imbunatatit:
  - JSON mode (`response_format: { type: 'json_object' }`) cu fallback daca nu e suportat
  - retry de repair prompt daca raspunsul initial nu e JSON valid
- response endpoint `/api/ai/complete` extins:
  - include `json` (obiect validat) + `repaired` flag

3. Deploy
- fixurile au fost publicate live:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
- smoke checks live PASS:
  - `/` -> 200
  - `/api/health` -> 200

## 2026-03-02 - Script automat deploy board.private-driver.ro

### Scope
Eliminare deploy manual repetitiv printr-un script local standardizat pentru publicarea BoardAI pe serverul Hetzner.

### Changes made
1. Script nou
- adaugat `ops/deploy_board.ps1`
- parametri principali:
  - `Server` (default `root@private-driver.ro`)
  - `Domain` (default `board.private-driver.ro`)
  - `RemoteAppDir` (default `/var/www/board`)
  - `BackendPort` (default `8925`)
  - `ServiceName` (default `board-private-driver.service`)

2. Flux automatizat in script
- build frontend (`npm run build`) optional (`-SkipBuild`)
- upload frontend dist
- upload backend runtime files (`server.js`, `package.json`, `package-lock.json`, `.env.example`)
- optional upload `.env` (`-IncludeEnv`)
- optional upload `boards.json` (`-UploadBoardsData`)
- remote `npm ci --omit=dev`
- normalize permisiuni pentru fisiere servite de nginx
- restart service + validare `systemctl is-active`
- `nginx -t` + reload
- smoke checks:
  - local health (`127.0.0.1:<port>/api/health`)
  - public health (`https://<domain>/api/health`)
  - public homepage headers (`https://<domain>/`)

3. Hardening implementat
- validare explicita a codurilor de iesire (`Assert-LastExitCode`)
- retry loops pentru health checks dupa restart
- parse/quoting sigur pentru scriptul remote (base64 payload)

### Validation
- rulare reala:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
- rezultat:
  - deploy complet cu `LOCAL_HEALTH` + `PUBLIC_HEALTH` + `PUBLIC_HEAD` OK (`HTTP/2 200`)
  - script finalizat fara erori.

## 2026-03-02 - Deploy live pe Hetzner: board.private-driver.ro

### Scope
Publicare aplicatie BoardAI live pe subdomeniul `board.private-driver.ro` (frontend + backend + SSL).

### Changes made
1. Build + upload
- frontend build publicat in `/var/www/board/dist`
- backend publicat in `/var/www/board/backend`
- dependinte backend instalate cu `npm ci --omit=dev`

2. Runtime service
- creat service systemd:
  - `/etc/systemd/system/board-private-driver.service`
  - ruleaza `node /var/www/board/backend/server.js`
  - `PORT=8925`
- service enabled + started

3. Nginx
- creat vhost:
  - `/etc/nginx/sites-available/board.private-driver.ro`
- reverse proxy configurat:
  - `/api/*` -> `127.0.0.1:8925`
  - `/socket.io/*` -> `127.0.0.1:8925`
- SPA fallback pe `/index.html`
- activat site-ul in `sites-enabled`

4. SSL
- certificat emis si instalat cu certbot pentru `board.private-driver.ro`
- redirect HTTP -> HTTPS activ

### Validation
- `https://board.private-driver.ro/` -> `200`
- `http://board.private-driver.ro/` -> `301` catre HTTPS
- `https://board.private-driver.ro/api/health` -> `200`
- `https://board.private-driver.ro/api/ai/complete` -> `200` (DeepSeek response valid)
- `https://board.private-driver.ro/socket.io/?EIO=4&transport=polling` -> handshake valid
- `systemctl is-active board-private-driver.service` -> `active`

## 2026-03-02 - Super prompt DeepSeek (Miro-grade) + parser hardening

### Scope
Upgrade prompt engineering pentru a sustine idei complexe si diverse in proiect, cu output actionabil tip workshop/strategy/architecture, inspirat de experienta Miro.

### Changes made
1. Frontend prompt system (`frontend/src/App.jsx`)
- `WB_SYS` rescris complet:
  - rol: BoardAI Studio Architect
  - obiectiv: transformare idei in structuri executabile
  - acopera product, UX, engineering, business, workshops
  - impune schema JSON stricta + reguli de layout + quality bar
- `SW_SYS` rescris complet:
  - mapping inteligent din fisiere in structuri vizuale
  - include domenii: architecture, flows, risks, TODO, dependencies
  - summary orientat pe decizie/executie

2. Token budget
- `aiCall()` -> `maxTokens` crescut de la `1000` la `1400` pentru output mai bogat.

3. Parsing reliability
- adaugat `parseAiJson(raw)` cu fallback:
  - parse direct (cu/fara fences)
  - daca esueaza, extrage JSON dintre primul `{` si ultimul `}`
- `applyParsed()` foloseste parserul nou si valideaza explicit array-ul `nodes`.

### Validation
- `npm run build` in `frontend/` -> PASS
- flow-ul AI ramane compatibil cu endpointul backend DeepSeek.

## 2026-03-02 - Integrat DeepSeek in proiect

### Scope
Inlocuire completa a mecanismului AI existent (bazat pe `window.claude`) cu DeepSeek API prin backend.

### Changes made
1. Backend endpoint nou `POST /api/ai/complete`.
2. Frontend `aiCall()` mutat pe `fetch('/api/ai/complete')`.
3. Config local: `backend/.env` + `backend/.env.example`.
4. Dependency backend: `dotenv`.

### Validation
- `node --check backend/server.js` -> PASS
- `npm run build` in `frontend/` -> PASS
- test endpoint local DeepSeek -> PASS
## 2026-03-05 - Mobile Stability & Premium UX sprint (stability pass)

### Scope
Hardening pentru editorul mobil: gesture stability, mode safety, Android back handling, quick actions, keyboard-safe bottom sheets, connector context pe long-press.

### Changes made
1. Mobile gesture/input stability (`frontend/src/App.jsx`, `frontend/src/lib/input/inputController.js`)
- `createInputController` folosit cu config explicit pentru mobil:
  - `longPressMs: 400`
  - `moveTolerance: 10`
- `onTouchMove` ruleaza update-urile de drag prin `requestAnimationFrame` (throttle frame-based) pentru reducere jank.
- Pinch zoom ramas mereu activ indiferent de tool.
- long-press nu mai declanseaza meniu dupa ce drag-ul depaseste toleranta.
- adaugat pointer-capture hooks pentru pointer touch (`onPointerDown`/`onPointerUp`) + `overscrollBehavior: none` pe canvas.

2. Mode safety system (`frontend/src/App.jsx`, `frontend/src/lib/input/modeController.js`)
- integrat mode mapping centralizat:
  - `toolToMode`, `modeToTool`, `isAddMode`, `isConnectMode`,
  - `nextModeAfterAdd`, `nextModeAfterConnect`.
- mobile default mode ramane `navigate` (`pan`).
- dupa add pe mobil:
  - default revine la `navigate` (configurabil prin `Stay in add mode`).
- dupa connect:
  - revine la `select`.
- `Done/Cancel` vizibil in mobile flow prin bottom bar + `Cancel Current Mode` in sheet `More`.

3. Android back behavior (`frontend/src/App.jsx`)
- adaugat guard pentru `popstate` cu ordinea:
  1. inchide `mobileSheet`
  2. inchide search/templates
  3. inchide overlays canvas/context (`board:close-transient-ui`)
  4. iese din add/connect/select catre navigate
  5. abia apoi lasa browser back normal.

4. Mobile quick actions (`frontend/src/App.jsx`)
- componenta noua `MobileQuickActionsBar` (4 actiuni):
  - `Duplicate`
  - `Style` (deschide panel sheet)
  - `Connect`
  - `Delete`
- afisata contextual cand exista selectie pe mobil.

5. Connector mobile contextual improvements (`frontend/src/App.jsx`)
- conectoarele au acum `data-connector-id` in render pentru hit-target touch.
- long-press pe connector deschide meniu contextual mobil (Routing/Style/Jumps/Actions), nu doar selectie.

6. Keyboard-safe bottom sheet (`frontend/src/components/MobileBottomSheet.jsx`)
- suport `visualViewport`:
  - detectie keyboard inset
  - repoziționare dinamica sheet peste tastatura
  - snap heights calculate dupa viewport-ul real.

### Validation
- `npm run build` in `frontend/` -> PASS
- `npm run test:connectors` in `frontend/` -> PASS

## 2026-03-05 - Connector selection/editing parity (desktop + mobile)

### Scope
Selectable connector lines intre containere pe ambele platforme, plus editor mobil dedicat pentru stil/routing.

### Changes made
1. Connector hit/selection reliability (`frontend/src/App.jsx`)
- SVG layer pentru connectors are acum `pointerEvents: auto`.
- hit target marit pe path-ul invizibil (`strokeWidth: 22`) pentru touch.
- `data-connector-id` + `onPointerDown` touch pe connector group pentru selectie consistenta.

2. Mobile connector editor (`frontend/src/App.jsx`)
- cand un connector este selectat pe mobil, se deschide un `MobileBottomSheet` de editare:
  - routing (`straight/ortho/curved/wavy`)
  - color, dash, width
  - start/end caps
  - jump style (`auto/on/off`)
  - reverse, set/reset default, remember last toggle, delete
- popover-ul desktop a ramas activ doar pe non-mobile.

### Validation
- `npm run build` in `frontend/` -> PASS
- `npm run test:connectors` in `frontend/` -> PASS

## 2026-03-05 - Mobile Creation Engine (touch-first speed pass)

### Scope
Implementare UI/interactions pentru creare rapida pe mobil: radial add, gesture shortcuts, drag-to-connect cu auto-node, auto-arrange mobil, AI quick insert.

### Changes made
1. Backup safety
- backup proiect in `C:\backup\board\2026-03-05` (fallback local, `H:` indisponibil in sesiunea curenta).

2. Input controller gestures (`frontend/src/lib/input/inputController.js`)
- adaugat:
  - double-tap detector (`registerTap`)
  - two-finger swipe detector (`beginTwoFinger` / `updateTwoFinger` / `endTwoFinger`)
- arbitraj gesture:
  - swipe valid doar cand pinch delta este mic.

3. Radial Add Menu (`frontend/src/components/MobileRadialMenu.jsx`, `frontend/src/App.jsx`)
- long press pe canvas gol deschide radial add menu:
  - Text / Node / Container / Connector / Image / Sticky
  - Cancel in centru
- drag direction + release confirma optiunea.

4. Drag-to-connect fast flow (`frontend/src/App.jsx`)
- handles de conectare mari pentru touch.
- pointer move/up cu RAF pentru preview fluid.
- drop pe empty canvas -> auto-create node + connector.

5. Gesture shortcuts + quick duplicate (`frontend/src/App.jsx`)
- double tap canvas -> add node.
- double tap element -> edit text.
- two-finger swipe down -> undo.
- two-finger swipe up -> redo.
- drag node + second finger touch -> duplicate drag mode.

6. Smart placement + context-aware insert (`frontend/src/App.jsx`)
- inserare inteligenta la dreapta elementului selectat (spacing constant).
- inserare in container daca frame/lane este selectat.
- connector tool din radial porneste direct cu `ARR_FROM` cand exista selectie.

7. Auto layout mobile selection (`frontend/src/App.jsx`)
- quick action `Arrange` pentru selectie multipla.
- optiuni: Vertical / Horizontal / Grid in sheet dedicat.

8. AI quick insert (`frontend/src/App.jsx`)
- input mobil `AI Quick Insert` in `More` sheet.
- prompt -> `/api/ai/complete` -> genereaza noduri + conectori + tidy layout.

### Validation
- `npm run build` in `frontend/` -> PASS
- `npm run test:connectors` in `frontend/` -> PASS

## 2026-03-05 - AI Thinking Engine v1 (context-aware copilot + preview commit)

### Scope
Upgrade AI interaction layer from generic chat to context-aware thinking engine without backend/API business-logic changes.

### Changes made
1. New AI system prompt + examples (`frontend/src/ai/prompts.js`)
- Added `THINKING_SYS` with strict JSON contract for intents:
  - `board_generation`
  - `flow_generation`
  - `idea_expansion`
  - `structure_builder`
  - `decision_helper`
  - `summary`
- Added `THINKING_EXAMPLE_PROMPTS` for copilot UX.

2. New copilot hook (`frontend/src/hooks/useThinkingCopilot.js`)
- Added board context extraction (nodes/arrows/clusters/containers/selection/disconnected), with payload limits.
- Added async AI intent runners:
  - Generate board
  - Generate flow
  - Expand ideas (selection-aware)
  - Organize structure (multi-selection-aware)
  - Decision helper (pros/cons/risks/recommendation)
  - Summarize
- Added smart suggestions engine (heuristics from live board state).
- Added structured preview state and explicit confirm step before insert.
- Added insert actions:
  - `Confirm + Insert` (with `TIDY`)
  - `Insert Raw`
  - optional `Replace canvas` toggle.

3. New panel UI component (`frontend/src/components/AiThinkingPanel.jsx`)
- Copilot input (`Ask the board...`), example prompts, action buttons, smart suggestion chips.
- Structured preview surface (node/connector counts + sample nodes + decision block).
- Confirm/dismiss controls and loading/error states.

4. Right panel integration (`frontend/src/components/RightPanel.jsx`)
- Added collapsible `AI THINKING` section.
- Wired `useThinkingCopilot` into existing desktop sidebar + mobile panel sheet flow.

### Validation
- `npm.cmd run build` in `frontend/` -> PASS

## 2026-03-05 - Canvas editor IA/UX restructuring (Miro/FigJam interaction model)

### Scope
Frontend-only editor UX restructuring. No backend/business logic changes.

### Changes made
1. Left toolbar converted to icon-first vertical rail (desktop)
- `frontend/src/components/RightToolPanel.jsx`
  - desktop now renders compact left rail (icons only): Select, Pan, Connector, Text, Sticky, Shape, Container, Image, Spreadsheet, Chart.
  - active tool highlighting preserved.
  - quick chart insertion action added.
  - mobile/embedded full tool panel behavior preserved.

2. Top bar reorganized around global board actions
- `frontend/src/App.jsx` (`TopBar`)
  - added desktop actions: Undo, Redo, Zoom controls (+/-/%), Fit, Search, Templates, Share, Collaborators toggle, Export menu.
  - export menu includes share link shortcut.
  - desktop right panel toggle now wired from top bar (not mobile-only handler).

3. Context menus regrouped for faster discovery
- `frontend/src/components/context-menu/actions/canvas.js`
  - grouped as: Add Node, Add Container, Add Sticky/Text/Spreadsheet, AI (Generate board), Paste/Import, View, Board.
- `frontend/src/components/context-menu/actions/node.js`
  - grouped as: Edit, Duplicate, Delete, Convert, Add Connection.
- `frontend/src/App.jsx`
  - context command set extended with `addChart` and `generateBoardAi`.
  - AI menu action dispatches prompt event consumed by `runQuickAiBoard`.

4. Connector usability polish
- `frontend/src/App.jsx`
  - connector hover highlight state added.
  - selected connector now shows control points along route.
  - connector context menu regrouped to: Change routing, Change style, Add label, Delete.

5. Right panel made context-aware
- `frontend/src/components/RightPanel.jsx`
  - context inspector header added (`Board settings`, `Node properties`, `Spreadsheet panel`, `Connector properties`).
  - connector inspector controls added in-panel (routing, dash, width, label, delete).
  - `PropsPanel` shown only for node/spreadsheet contexts.
  - board admin/history/audit sections shown in board context.
  - spreadsheet AI section shown in spreadsheet context.
- `frontend/src/App.jsx`
  - connector selection bridged from canvas to shell via custom event and passed into `RightPanel`.

### Validation
- `npm.cmd run test:dataflow` (frontend) -> PASS
- `npm.cmd run build` (frontend) -> PASS

## 2026-03-05 - High-speed canvas interaction upgrade (quick add, smart connect, multi-select connectors)

### Scope
Frontend canvas interaction polish only (`frontend/src/App.jsx`). No backend/business logic changes.

### Changes made
1. Quick Add Node
- edge `+` quick-add buttons added for hovered/selected node.
- click creates connected node in edge direction.
- mobile adapts to one contextual quick-add button.

2. Drag interaction + Smart Connect suggestion
- node drag now computes lightweight smart-connect suggestion to nearby nodes.
- suggestion renders as dashed preview edge with `Connect` action.
- keeps drag loop smooth via existing pointer RAF path.

3. Inline text edit behavior
- `ET` inline editor now supports:
  - `Enter` confirm
  - `Esc` cancel
  - blur commit only when not cancelled.

4. Connector multi-selection and lasso inclusion
- shift+click toggles connector in selection set.
- lasso now selects both nodes and connectors (midpoint/route bbox checks).
- selected connectors are visually highlighted and can be deleted with keyboard when only connector selection exists.

5. Auto-layout quick actions in selection panel
- `AlignPanel` extended with quick layout actions:
  - Vertical flow
  - Horizontal flow
  - Grid
- uses `UPD_MULTI` / existing `TIDY` (no reducer refactor).

6. Power shortcuts update
- `N` inserts a new node at viewport center.
- `C` switches to connector tool.
- shortcut handling remains blocked during text/input/contenteditable editing.

7. Mobile inline text editing
- node double-tap on mobile opens bottom-sheet text editor.
- save writes directly to node text.

### Validation
- `npm.cmd run build` (frontend) -> PASS
- `npm.cmd run test:connectors` (frontend) -> PASS
- `npm.cmd run test:dataflow` (frontend) -> PASS
- `npm.cmd run test:spreadsheet` (frontend) -> PASS
- `npm.cmd test` (backend) -> PASS

## 2026-03-05 - Runtime hotfix (production crash after interaction upgrade)

### Scope
Frontend runtime fixes only in `frontend/src/App.jsx`.

### Fixes
1. Fixed TDZ crash (`Cannot access 'cl' before initialization`)
- root cause: snap FX callback was referenced by smart-connect accept handler before callback declaration.
- fix: moved `triggerConnectorSnapFx` declaration above `acceptSmartConnectSuggestion`.

2. Fixed `ReferenceError: px is not defined`
- root cause: toolbar `N` shortcut used `px/py` without destructuring from board state.
- fix: destructured `px` and `py` in `Toolbar`.

### Validation
- `npm.cmd run build` (frontend) -> PASS
