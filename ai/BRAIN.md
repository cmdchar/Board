# BRAIN - CURRENT AI STATE

## Latest update (2026-03-11) - n8n credential configured for local AI gateway
- scope: make n8n ready to call local AI gateway without manual credential setup.
- applied:
  - authenticated to n8n owner account (`nicusor.alexe@gmail.com`).
  - created credential in n8n:
    - name: `AI LiteLLM OpenAI Compat`
    - type: `openAiApi`
    - id: `QmR9FZH6t0j72Dup`
    - base URL: `http://10.10.1.211:4000/v1`
- operational note:
  - this credential can be selected directly in OpenAI/AI nodes inside workflows.
  - gateway key remains managed in Board Vault (`AI Gateway LiteLLM - vm-web`).

## Latest update (2026-03-11) - AI API gateway activated on vm-web (LiteLLM + DeepSeek)
- scope: expose a stable local AI API endpoint (host/port/key) usable directly from IDE/tools.
- runtime:
  - host: `10.10.1.211`
  - LiteLLM API: `http://10.10.1.211:4000/v1`
  - OpenWebUI: `http://10.10.1.211:3001`
- configuration applied:
  - `/opt/private-driver/ai-stack/.env` updated with:
    - `LITELLM_MASTER_KEY` (new non-empty key)
    - `DEEPSEEK_API_KEY` (active)
  - stack recreated via `docker compose up -d` in `/opt/private-driver/ai-stack`.
- validation:
  - `GET /v1/models` (authorized) returns configured models.
  - `POST /v1/chat/completions` with `deepseek-chat` returns successful completion.
- secret handling:
  - gateway secret stored in Board Vault record:
    - `AI Gateway LiteLLM - vm-web` (project: `Infra Server Ops`).

## Latest update (2026-03-11) - Mailcow outbound relay forced on 587 via Hosterion
- scope: bypass blocked outbound SMTP/25 by routing all outbound mail through authenticated smarthost on submission port.
- implemented on `vm-web` (`10.10.1.211`):
  - created dedicated relay mailbox in Hosterion: `relay@dracarys.ro`.
  - configured Mailcow Postfix override in:
    - `/opt/private-driver/mail-stack/data/conf/postfix/extra.cf`
    - `/opt/private-driver/mail-stack/data/conf/postfix/sasl_passwd` (postmap generated).
  - active relay settings:
    - `relayhost = [aresmx.hosterion.net]:587`
    - `smtp_sasl_password_maps = hash:/opt/postfix/conf/sasl_passwd`
    - `smtp_sender_dependent_authentication = no`
    - `smtp_tls_security_level = encrypt`
- validation:
  - direct SMTP AUTH test to `aresmx.hosterion.net:587` returned `235 Authentication succeeded`.
  - live send test from Mailcow Postfix to external mailbox returned `status=sent (dsn=2.0.0)`.
- secret handling:
  - relay credentials stored in Board Vault record:
    - `Hosterion SMTP Relay - dracarys.ro` (project: `Infra Server Ops`).
  - temporary local/remote credential files were removed after configuration.

## Latest update (2026-03-11) - Hosterion DNS automation for mail cutover
- scope: make DNS edits executable directly by agent (no manual cPanel clicks).
- implemented:
  - new tool: `infra/tools/hosterion-mail-dns-sync.mjs`
  - supports dry-run and apply via cPanel API token (`HOSTERION_CPANEL_TOKEN`)
  - keeps JSON backup in `tmp/` before each run.
- applied for `dracarys.ro`:
  - `MX @ -> mail.dracarys.ro (prio 10)`
  - `A mail.dracarys.ro -> 92.180.19.135`
  - SPF updated to `v=spf1 mx a:mail.dracarys.ro ip4:92.180.19.135 -all`
  - DMARC updated to `v=DMARC1; p=quarantine; rua=mailto:postmaster@dracarys.ro; fo=1`
- operational note:
  - public resolver caches may show old SPF until TTL expiry; authoritative nameserver already returns new records.

## Latest update (2026-03-11) - Server credentials indexed in Board Vault
- scope: centralize server access and ops notes in Board Vault while keeping repository memory secret-safe.
- board vault project: `Infra Server Ops` (`https://board.private-driver.ro`).
- records added:
  - `NPM Admin - vm-gateway`
  - `Mailcow Admin - mail.dracarys.ro`
  - `Mail Stack Status - 2026-03-11`
  - `DNS Required - dracarys.ro mail`
- operational rule:
  - credentials are stored/revealed only from Board Vault entries.
  - `ai/BRAIN.md` and `ai/CHANGELOG_AI.md` keep metadata and runbook context only (no raw secrets).
- next exact step:
  1. rotate bootstrap credentials after first successful login and update the same vault records.
  2. if outbound SMTP/25 remains blocked, store SMTP relay credentials in the same project vault.

## Latest update (2026-03-11) - Platform Core Stack deployed on vm-web
- scope: add SaaS runtime foundation before full public cutover.
- deployed on `vm-web` (`192.168.1.211`) in `/opt/private-driver/platform-core-stack`:
  - PostgreSQL 16 (`:5433`)
  - Redis 7 (`:6379`, password protected)
  - MinIO (`:9000` API, `:9001` console)
- stack files added:
  - `infra/platform-core-stack/compose.yaml`
  - `infra/platform-core-stack/.env.example`
  - `infra/platform-core-stack/scripts/generate-secrets.sh`
  - `infra/platform-core-stack/README.md`
- status:
  - containers up and healthy (`postgres`, `redis`; `minio` health endpoint `200`)
  - inventory sync service already refreshed board and includes new containers.
- next exact step:
  1. route MinIO/N8N/Status via gateway hostnames when public DNS path is finalized.
  2. define app-specific DB/user isolation policy (separate DB/user per app/tenant environment).

## Latest update (2026-03-11) - Automatic server inventory sync (systemd timer on Proxmox)
- scope: operational automation so board infra view updates without manual command.
- implemented:
  - new collector/updater:
    - `infra/board-sync/server_inventory_sync.py`
    - collects Proxmox + VM status (including docker services via SSH from host) and writes to board.
  - deployment assets:
    - `infra/board-sync/server-inventory-sync.service`
    - `infra/board-sync/server-inventory-sync.timer`
    - `infra/board-sync/.env.example`
    - `infra/board-sync/README.md`
  - API token helper:
    - `infra/tools/create-board-api-token.mjs` (provisions dedicated API token for sync job)
- runtime installed on host `192.168.1.165`:
  - script path: `/opt/private-driver/board-sync/server_inventory_sync.py`
  - env path: `/opt/private-driver/board-sync/.env`
  - timer: `server-inventory-sync.timer` every 15 minutes
  - initial run status: success (`boardId: 10a63a51-f0a6-4f33-a149-258c20431236`)
- next exact step:
  1. monitor first 24h via `journalctl -u server-inventory-sync.service`.
  2. add alerting on sync failure (telegram/email) after fiber phase.

## Latest update (2026-03-11) - Full server inventory mapped visually in board
- scope: operational visualization upgrade for infra tracking (no API/SSE/runtime contract changes).
- board updated:
  - `Server Ops - Private Driver`
  - `https://board.private-driver.ro/?board=10a63a51-f0a6-4f33-a149-258c20431236`
- visual structure now includes:
  - topology block (Proxmox + VM mapping + disk layout)
  - host hardware/runtime block (CPU/RAM/kernel/load/ports)
  - storage + backup policy block (usage + schedule + retention + VM scope)
  - per-VM cards (`vm-gateway`, `vm-web`, `vm-ai`) with resources/services
  - service endpoint health block (public + LAN checks)
  - runbook command block (ops checks)
  - post-fiber action block (network/public exposure/mail/whatsapp/hardening)
- source updater:
  - `infra/tools/upsert-server-ops-board.mjs` (layout + content refresh)
- next exact step:
  1. add periodic refresh trigger (manual command now, then scheduler/webhook after fiber).
  2. extend board with VM103 guest-agent/IP and alert severity tags per service.

## Latest update (2026-03-11) - Server Ops board live + post-fiber backlog tracking
- scope: operational visibility for infra work (no API/SSE contract changes).
- created live board for infrastructure progress:
  - name: `Server Ops - Private Driver`
  - id: `10a63a51-f0a6-4f33-a149-258c20431236`
  - url: `https://board.private-driver.ro/?board=10a63a51-f0a6-4f33-a149-258c20431236`
- added reusable upsert tool:
  - `infra/tools/upsert-server-ops-board.mjs`
  - behavior: signs owner JWT from backend env, creates board if missing, updates board data with current LAN-first infra status + runbook + next steps.
- now tracked in board:
  - done now: Proxmox + VM split (`vm-gateway`, `vm-web`, `vm-ai`), n8n + Uptime stack, backup schedule includes `101,102,103`.
  - active services: board, gitea, n8n, uptime-kuma, openwebui/litellm.
  - post-fiber backlog: public routing finalization, SSL public hosts, mail stack + DNS auth records, whatsapp integration, offsite backup/alerts, hardening pass.
- next exact step:
  1. rerun `infra/tools/upsert-server-ops-board.mjs` after every major infra change so board remains source-of-truth.
  2. once fiber is stable, execute post-fiber list in order from that board and mark each block done.

## Latest update (2026-03-10) - Editor shell readability pass (50% zoom desktop)
- scope: frontend shell UX pass (topbar/quick-toolbar/side offsets), no API/SSE contract changes.
- problems addressed:
  - top menu density too high with low readability at browser zoom 50%.
  - floating toolbar had too many micro controls and weak hierarchy.
  - side panels needed offset/width alignment after shell scaling.
- implementation:
  - `TopBar.jsx`:
    - increased bar scale/spacing and reorganized controls into grouped action clusters.
    - replaced mobile single-letter actions with explicit labels.
    - improved horizontal overflow behavior.
  - `Toolbar.jsx`:
    - switched desktop from crowded all-tools strip to labeled quick action dock (`DESKTOP_QUICK_TOOLS`).
    - kept keyboard engine and contextual actions (grid/deps/focus, draw/vote, selection actions).
  - shell geometry:
    - `LeftToolbar.jsx` + `RightToolPanel.jsx`: bigger rail controls and updated top offset.
    - `InnerApp.jsx`: inspector width increase, top offset alignment, minimap inset update.
- validation:
  - `npm.cmd run build` PASS
  - `npm.cmd test` PASS
  - `node --check backend/server.js` PASS
  - quality gate script PASS (applicable checks)
- next exact step:
  1. run visual smoke at 50% zoom on `board.private-driver.ro` for spacing/overflow edge-cases in topbar groups.
  2. normalize remaining legacy mojibake labels in topbar metadata chips (`saving`, counters).

## Summary
BoardAI foloseste DeepSeek cu un system prompt extins (nivel workshop/facilitare tip Miro+) pentru generare de structuri complexe direct pe canvas.
Integrarea are acum parsing robust JSON + un set extins de primitive vizuale (shape library + `sheet`/`deck` containers functionale) pentru fluxuri de lucru mai apropiate de Miro.
Frontend text rendering este reparat pentru landing/editor dupa corectie de encoding (mojibake -> UTF-8 valid), GitHub sync este hardenizat, roadmap phase 1 a inceput cu Jira import MVP (backend + UI execution panel), editorul are tools panel desktop pe stanga cu reset de tool-uri robust, canvas-ul are `Advanced Connectors v1.5` (ports, routing/styles, line jumps, default connector style persistence), mobile editor ruleaza acum pe shell dedicat (bottom bar + snap sheets + long-press contextual actions), `Execution Intelligence v1` este integrat in editor (task/milestone/decision nodes, execution health, timeline overlay, meeting->tasks autopilot), Collaboration Engine + AI Agents v1 sunt wire-uite end-to-end in panelul din dreapta, `Template Marketplace v1` este integrat in editor (library + publish + versions + AI template generation), `AI Spreadsheet Analysis v1` este livrat (insight cards, NL queries, anomalies, chart/kpi generation, relationship formula suggestions), `Data Flow Engine v1` este activ (pipeline-uri intre noduri, graph dependencies, transform/chart/kpi live recompute), iar editorul are acum `Premium UX polish v2` (motion tokens 120/180/260, glass panels, tactile drag feedback, guide fade, success micro-moments, encoding-safe labels). Ultimul pas a fost remedierea P0 launch blockers: bcrypt auth, JWT strict startup secret, realtime in-memory board store cu persistență async, si revision control anti-overwrite.

## Latest update (2026-03-10) - Project Vault v1 (global + per-project credentials registry)
- scope: full-stack feature add (backend vault module + editor panel integration), no breaking changes to existing board/AI/socket contracts.
- backend:
  - SQLite vault store in `backend/data/vault.sqlite`.
  - encrypted secret storage (AES-256-GCM) with `VAULT_SECRET_KEY` (fallback `JWT_SECRET`).
  - authenticated REST routes:
    - `/api/vault/projects`
    - `/api/vault/ingest` (free-text auto capture)
    - `/api/vault/records`
    - `/api/vault/subscriptions`
    - `/api/vault/summary`
    - `/api/vault/records/:id/reveal`
- frontend:
  - new `PROJECT VAULT` section in right panel (desktop + mobile inspector sheet).
  - add/list/filter records, add projects, reveal stored secret, preview due subscriptions.
- global tooling:
  - `tools/vault-capture.js` (CLI ingest helper usable from any IDE terminal).
  - `tools/install-vault-capture.ps1` (installs global `vault-capture` command in PowerShell profile).
- impact:
  - board.private-driver.ro poate tine centralizat:
    - API keys
    - parole/useri de test
    - date conectare per proiect
    - costuri/subscriptii si date de expirare/renew.
- next exact steps for vault:
  1. add edit/delete UX for vault records/projects.
  2. harden ingest parser rules (env pairs/grouping dedupe + confidence flags).
  3. add role-based visibility policy for vault routes (owner/admin only).
  4. add optional remote backup/replication for `vault.sqlite`.

## Latest update (2026-03-10) - API token menu in Dashboard
- scope: auth UX + backend API token lifecycle endpoints.
- backend:
  - added `POST /api/auth/token` (authenticated), issuing signed API token with bounded expiration.
  - added `GET /api/auth/tokens` for token inventory metadata.
  - added `DELETE /api/auth/tokens/:tokenId` for revoke.
  - hardening: `POST /api/auth/token` blocks callers authenticated with `token_type: "api"` (no token chaining).
- frontend:
  - dashboard header now includes `API Token` action.
  - modal generates + copies token and shows expiry metadata.
  - modal now lists existing tokens with status (`active/expired/revoked`) and revoke action.
- intended workflow:
  - user opens Board dashboard -> generates token -> uses token with CLI tools (e.g. `vault-capture --token ...`) without manual REST steps.
  - user can periodically revoke old tokens from the same dashboard modal.

## Current architecture snapshot
- Frontend: `frontend/` (React + Vite)
- Backend: `backend/` (Express + Socket.IO)
- Storage: `backend/data/boards.json`
- Realtime: room per board (`boardId`)
- AI provider: DeepSeek prin `POST /api/ai/complete`
- Live domain: `https://board.private-driver.ro`

## Latest update (2026-03-06) - Hotfix TDZ runtime error after App split
- scope: frontend runtime stability fix (no feature/business logic changes).
- issue:
  - production runtime threw `ReferenceError: Cannot access '<minified>' before initialization` after `Canvas`/`InnerApp` extraction.
- fix:
  - moved dependency map initialization from top-level constants into wrapper functions in `App.jsx`:
    - `Canvas` wrapper now builds `canvasDeps` locally
    - `InnerApp` wrapper now builds `innerAppDeps` locally
  - completed `InnerApp` dependency injection with helper functions used by runtime callbacks.
  - fixed extracted `Canvas.jsx` ordering bug:
    - `useConnectorContextMenu(...)` now runs after `connectorById` is initialized.
  - fixed second extracted `Canvas.jsx` ordering bug:
    - `useCanvasTouchMoveHandler(...)` now runs after `runTouchMovePrelude` / `runTouchMoveTail` are initialized.
  - fixed missing dependency injection symbols in extracted `Canvas.jsx`:
    - added `SHAPE_DEFAULTS`, `makeShapeNode`, `makeSheetNode`, `makeDeckNode`, `collectDependency`.
  - verification hardening:
    - ESLint `no-undef` check executed on `App.jsx`, `InnerApp.jsx`, `Canvas.jsx` with no undefined symbol errors.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/InnerApp.jsx`
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. manual smoke on live board for editor load + right panel + mobile sheet to confirm no runtime regressions.
  2. continue incremental split with small utility extractions only (avoid broad top-level dependency objects).

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (InnerApp moved to dedicated module)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/InnerApp.jsx`
  - `frontend/src/App.before-innerapp-move.jsx` (backup before extraction)
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - extracted large `InnerApp` orchestration from `App.jsx` into `app/InnerApp.jsx`.
  - left `App.jsx` with thin `InnerApp` wrapper:
    - `useWB()` context read
    - dependency injection via `INNER_APP_DEPS` object
  - preserved runtime behavior by forwarding existing handlers/components/constants unchanged.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. reduce dependency injection surface by extracting shared `App` dependencies into dedicated modules (`app/deps/*`) without behavior changes.
  2. continue low-risk helper extractions (`pts2d` and small pure utilities) and keep running the same gate/tests per step.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas moved to dedicated module)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/canvas/Canvas.jsx`
  - `frontend/src/App.before-canvas-move.jsx` (backup before extraction)
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - extracted large `Canvas` orchestration from `App.jsx` into `app/canvas/Canvas.jsx`.
  - left `App.jsx` with thin `Canvas` wrapper:
    - `useWB()` context read
    - dependency injection via `CANVAS_DEPS` object
  - preserved behavior by forwarding existing handlers/components/helpers unchanged.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. extract `InnerApp` orchestration into `frontend/src/app/InnerApp.jsx` with same copy/wire strategy.
  2. keep `App.jsx` as root shell (auth + board routing + provider wiring only), rerun gate/tests and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-move shell wrapper extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchMoveHandler.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `onTouchMove(...)` shell wrapper into `useCanvasTouchMoveHandler(...)`.
  - preserved wrapper order:
    - prelude guard (`runTouchMovePrelude`)
    - pinch branch delegation (`handlePinchTouchMove`)
    - tail delegation (`runTouchMoveTail`)
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk helper (`pts2d` path serializer to `app/utils`).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-start shell wrapper extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchStartHandler.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `onTouchStart(...)` shell wrapper into `useCanvasTouchStartHandler(...)`.
  - preserved wrapper order:
    - two-finger guard (`handleTwoFingerTouchStart`)
    - `touches > 2` guard
    - pinch reset
    - delegate to `handleTouchStartTarget`
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk wrapper (`onTouchMove` shell function).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-move pinch branch extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchMovePinch.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved pinch/two-finger branch from `onTouchMove` into `useCanvasTouchMovePinch(...)`.
  - `onTouchMove` now delegates:
    - prelude (`runTouchMovePrelude`)
    - pinch (`handlePinchTouchMove`)
    - tail (`runTouchMoveTail`)
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk wrapper (`onTouchStart` shell function).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-start two-finger branch extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchStartTwoFinger.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved two-finger branch from `onTouchStart` into `useCanvasTouchStartTwoFinger(...)`.
  - preserved duplicate-drag shortcut and pinch bootstrap flow.
  - `onTouchStart` now delegates via `handleTwoFingerTouchStart(e)`.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk touch branch (`onTouchMove` pinch branch).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-end handler extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchEndHandler.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `onTouchEnd(...)` wrapper flow into `useCanvasTouchEndHandler(...)`.
  - preserved consume order:
    - two-finger finalize
    - scheduled move cancel
    - radial consume
    - long-press consume
    - double-tap consume
    - fallback `onUp`
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk touch block (`onTouchStart` two-finger branch).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-move non-pinch path extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchMoveNonPinch.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved non-pinch logic from `onTouchMove` into `useCanvasTouchMoveNonPinch(...)`.
  - hook split preserves execution order around pinch branch:
    - `runTouchMovePrelude(...)`
    - pinch branch remains local in `Canvas`
    - `runTouchMoveTail(...)`
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk touch block (`onTouchEnd` wrapper/dispatch branch split).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas touch-start target branch extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasTouchStartTarget.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved single-touch connector/canvas branch from `onTouchStart` into `useCanvasTouchStartTarget(...)`.
  - `onTouchStart` keeps two-finger/pinch logic local and delegates only target routing branch.
  - behavior preserved for connector preselect and canvas fallback `onDown(ev)`.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk touch branch (`onTouchMove` non-pinch path).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas node touch-start handler extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasNodeTouchStart.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `onNodeTouchStart(...)` from `Canvas` into `useCanvasNodeTouchStart(...)`.
  - preserved same mobile press metadata + selection-start flow.
  - `NodeRenderer` receives same `onNodeTouchStart` callback contract.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk touch block (`onTouchStart` branch extraction, starting with connector/canvas target branch).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas double-click insert + transform-start handlers extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasDoubleClickInsert.js`
  - `frontend/src/app/hooks/useCanvasNodeTransformStart.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `onDblClick(...)` from `Canvas` into `useCanvasDoubleClickInsert(...)`.
  - moved `onRotSt(...)` + `onRSt(...)` from `Canvas` into `useCanvasNodeTransformStart(...)`.
  - kept existing renderer/event prop contracts unchanged.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk touch handler block (`onNodeTouchStart`).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas context image upload extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasContextImageUpload.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `onCtxUploadImage(...)` from `Canvas` into `useCanvasContextImageUpload(...)`.
  - hidden file input in `Canvas` now consumes the hook handler.
  - preserved same image-node payload and upload reset behavior.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk block (`onDblClick` quick sticky insert handler).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas context-menu controller extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasContextMenuController.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `Canvas` context menu controller block into `useCanvasContextMenuController(...)`.
  - hook now owns:
    - `openContextMenuAt(...)`
    - `onCtx(...)`
    - mobile context groups flattening
    - mobile context title derivation
  - removed now-unused local helpers/imports in `Canvas` (`buildContextMenu`, `isContainerType` local copy).
  - long-press/context-menu call sites remain unchanged (same behavior contracts).
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk block (`onCtxUploadImage` file upload handler).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas context commands + pointer controller extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useCanvasContextCommands.js`
  - `frontend/src/app/hooks/useCanvasPointerController.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved `makeContextCommands(...)` from `Canvas` into `useCanvasContextCommands(...)` and wired back with same dependencies/contracts.
  - moved large pointer handlers from `Canvas` into `useCanvasPointerController(...)`:
    - `onDown`
    - `onNodeSel`
    - `onMove`
    - `onUp`
  - `Canvas` now keeps thin delegates only, preserving event surface unchanged.
  - fixed missing hook input by wiring `lasso` into pointer controller (required by lasso finalize branch).
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` with next low-risk chunk (`openContextMenuAt` controller block).
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (connector context-menu controller extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useConnectorContextMenu.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved Canvas connector context-menu block into `useConnectorContextMenu(...)`.
  - hook now owns:
    - `cycleCap(...)`
    - connector context groups builder
    - mobile connector menu open
    - desktop connector context open
  - Canvas keeps same outputs and same wiring into renderer/panels.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` (candidate: canvas/context menu open controller block).
  2. rerun build + tests and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Canvas port-connect controller extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/usePortConnectController.js`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved Canvas port connector controller block into `usePortConnectController(...)`.
  - hook now owns:
    - visible port nodes selection
    - port point mapping/hit-test
    - pointer move/up attach flow
    - preview connector path
  - `Canvas` consumes returned API and keeps render/event contracts unchanged.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction in `Canvas` (next candidate: context-menu controller block).
  2. rerun build + tests and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (SpreadsheetNode extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/canvas/SpreadsheetNode.jsx`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved full `SpreadsheetNode` implementation from `App.jsx` into `app/canvas/SpreadsheetNode.jsx`.
  - kept `SpreadsheetNode` wrapper in `App.jsx` so existing `NodeRenderer` contract and call-sites remain unchanged.
  - wrapper injects all existing dependencies (theme, handles, spreadsheet helper functions), preserving behavior.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue one-block extraction with next high-value segment from `Canvas` (single controller chunk), copy-wire-delete.
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Toolbar extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/ui/Toolbar.jsx`
  - `docs/app-refactor-index.md`
  - `docs/refactor-app-split.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - moved full floating toolbar logic from `App.jsx` into `app/ui/Toolbar.jsx`.
  - kept `Toolbar` wrapper in `App.jsx` for stable call-sites and unchanged parent wiring.
  - injected all dependencies via props (context hook, theme/tokens, connector helpers, toasts, uid).
  - preserved shared sticky color sequencing using callback `getNextStickySwatch={() => SC[_si++%8]}`.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue "one block at a time" with next large safe extraction candidate from `App.jsx` (`Canvas` sub-controller segment or `SpreadsheetNode` segment) using same copy-wire-delete approach.
  2. rerun build + tests gate and update docs/changelog.

## Latest update (2026-03-06) - App.jsx strangler refactor continuation (Landing/Dashboard/EditorAux extracted)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/ui/LandingPage.jsx`
  - `frontend/src/app/panels/Dashboard.jsx`
  - `frontend/src/app/ui/EditorAuxPanels.jsx`
  - `docs/refactor-app-split.md`
  - `docs/app-refactor-index.md`
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - finalized landing extraction:
    - app unauth branch now renders `LandingPageView` with dependency injection (`T`, `CSS`, `useIsMobileHook`, `api`).
    - removed local `LandingPage` and `AuthModal` definitions from `App.jsx`.
  - extracted board selector dashboard:
    - app no-board branch now renders `DashboardView` with dependency injection (`T`, `CSS`, `useIsMobileHook`, `api`).
    - removed local `Dashboard` definition from `App.jsx`.
  - extracted editor auxiliary UI components:
    - moved `PresentBar`, `EditorOnboardingOverlay`, `EmptyBoardPrompt` to `app/ui/EditorAuxPanels.jsx`.
    - wired `App.jsx` usage to `PresentBarView`, `EditorOnboardingOverlayView`, `EmptyBoardPromptView` with explicit props.
  - updated refactor discoverability docs (`docs/app-refactor-index.md` + checklist progress).
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue Step 5 with next extraction of a high-volume controller block from `Toolbar` (keyboard handler/controller split) while preserving reducer/event contracts.
  2. rerun build + tests gate after each extraction.

## Latest update (2026-03-06) - App.jsx strangler refactor Step 5 continuation (connector style hook wired)
- scope: frontend-only safe extraction wiring; no behavior/UI/business logic changes.
- files touched:
  - `frontend/src/App.jsx`
  - `frontend/src/app/hooks/useConnectorStyleController.js` (already extracted in previous pass, now actively wired)
  - `frontend/src/app/hooks/useSheetFormulaBridge.js` (new, extracted sheet formula session/ref bridge callbacks)
  - `frontend/src/app/hooks/useCanvasTransientUiHandlers.js` (new, extracted transient UI keyboard/event handlers)
  - `frontend/src/app/hooks/useConnectorSelectionSync.js` (new, extracted connector selection synchronization effects)
  - `frontend/src/app/hooks/useCanvasImageIo.js` (new, extracted image drag/drop + clipboard paste effects)
  - `frontend/src/app/hooks/useCanvasWheelPanZoom.js` (new, extracted wheel pan/zoom interaction logic)
  - `frontend/src/app/hooks/useCanvasLaserTrail.js` (new, extracted laser trail state/update logic)
  - `frontend/src/app/hooks/useTouchPointerCapture.js` (new, extracted touch pointer capture handlers)
  - `frontend/src/app/hooks/useCanvasTouchHelpers.js` (new, extracted touch helper pack)
  - `frontend/src/app/hooks/useCanvasMouseMoveRaf.js` (new, extracted mouse-move RAF scheduler)
  - `frontend/src/app/hooks/useCanvasTouchMoveRaf.js` (new, extracted touch-move RAF scheduler)
  - `frontend/src/app/hooks/useTouchGestureUndoRedo.js` (new, extracted two-finger gesture undo/redo branch)
  - `frontend/src/app/hooks/useTouchRadialMenuEnd.js` (new, extracted radial touch-end consume branch)
  - `frontend/src/app/hooks/useTouchLongPressEnd.js` (new, extracted long-press consume branch)
  - `frontend/src/app/hooks/useTouchDoubleTapEnd.js` (new, extracted double-tap branch)
  - `frontend/src/app/utils/connectorStyleStorage.js` (new, extracted pure localStorage helpers)
  - `docs/app-refactor-index.md` (new refactor map/index for quick file discovery)
  - `ai/CHANGELOG_AI.md`
  - `ai/BRAIN.md`
- implementation:
  - `Canvas` no longer keeps local duplicated connector-style/default callbacks.
  - `Canvas` now consumes `useConnectorStyleController(...)` for:
    - default style persistence
    - remember-last persistence
    - connector factory from defaults
    - connector patch/update logic
  - wiring preserves existing reducers/events/toasts and dependency inputs.
  - extracted connector-style localStorage helpers from `App.jsx` into `app/utils` with identical behavior/signatures:
    - `loadStoredConnectorDefaultStyle`
    - `saveStoredConnectorDefaultStyle`
    - `loadStoredRememberLastConnectorStyle`
    - `saveStoredRememberLastConnectorStyle`
  - extracted sheet formula bridge callbacks into dedicated hook, preserving callback contracts:
    - session lifecycle (`active`/close) mapping
    - picked reference payload to `sheetFormulaPick`
    - consume/reset logic by `pickId`
  - extracted transient UI handlers into dedicated hook, preserving listener behavior:
    - `Escape` closes transient UI and exits add mode
    - `Backspace/Delete` removes selected connectors only when no node selection exists
    - `board:close-transient-ui` resets overlays/menus and cancels active press
  - extracted connector selection synchronization effects into dedicated hook, preserving behavior:
    - dispatches `boardai:connector-selection` on selected connector changes
    - keeps `selectedConnectorIds` in sync with `selectedArrow`
    - prunes stale selected connector IDs when connector list changes
  - extracted canvas image input effects into dedicated hook, preserving behavior:
    - drop image file on canvas inserts `image` node at drop point
    - paste image from clipboard inserts centered `image` node and shows success toast
  - extracted wheel pan/zoom logic into dedicated hook, preserving behavior:
    - ctrl/cmd+wheel zoom with cursor anchor compensation
    - wheel pan in non-zoom mode
    - same zoom clamp range and interaction factors
  - extracted laser trail internals into dedicated hook, preserving behavior:
    - point TTL filtering (`800ms`)
    - renderer state `laserPts` unchanged in shape/usage
  - extracted touch pointer capture handlers into dedicated hook, preserving behavior:
    - set/release pointer capture only for mobile touch pointer events
    - same fallback path when capture APIs throw
  - extracted touch helper pack into dedicated hook, preserving behavior:
    - synthetic touch event shape used by `onDown/onMove`
    - touch distance/point math
    - mobile long-press bootstrap payload (`beginMobilePress`)
  - extracted mouse move RAF scheduler into dedicated hook, preserving behavior:
    - pending event ref update
    - single RAF queue at a time
    - delegation to existing `onMove`
  - extracted touch move RAF scheduler into dedicated hook, preserving behavior:
    - pending touch event ref update
    - single RAF queue at a time
    - delegation to existing `onMove`
  - extended touch move RAF hook with cancel/reset helper and wired it in `onTouchEnd`:
    - same `cancelAnimationFrame` flow
    - same refs reset semantics (`raf=0`, `pending=null`)
  - extracted two-finger touch gesture branch from `onTouchEnd` into dedicated hook, preserving behavior:
    - `endTwoFinger` evaluation with last pointers fallback
    - mapping `down -> UNDO`, `up -> REDO`
    - pinch ref reset
  - extracted radial touch-end branch from `onTouchEnd` into dedicated hook, preserving behavior:
    - active radial option resolve
    - action apply at stored world position
    - radial close + drag/lasso reset
  - hook call ordering adjusted after callback declarations to avoid TDZ risk.
  - extracted remaining `onTouchEnd` branches into dedicated hooks:
    - long-press consume/reset
    - double-tap detection and insert/edit actions
  - added refactor index doc so extracted logic is easy to locate by area.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- next exact step:
  1. continue Step 5 by extracting next lowest-risk controller block (`onTouchEnd` fallback `onUp` branch) with identical inputs/outputs.
  2. rerun the same build/test gate.

## Latest update (2026-03-05) - App.jsx strangler refactor started (safe split, no behavior change)
- scope: frontend-only safe extraction for `frontend/src/App.jsx` size reduction; no business logic change.
- safety:
  - backup created: `frontend/src/App.backup.pre-split.2026-03-05.jsx`.
- step progress:
  - Step 0 complete: `docs/refactor-app-split.md` created.
  - Step 1 complete: `frontend/src/app/` structure + `AppRoot.jsx` shim wired in `main.jsx`.
  - Step 2 complete (low-risk UI extraction):
    - new: `frontend/src/app/ui/TopBar.jsx`
    - new: `frontend/src/app/ui/MobileBottomBar.jsx`
    - new: `frontend/src/app/ui/MobileQuickActionsBar.jsx`
    - new: `frontend/src/app/ui/LeftToolbar.jsx`
    - `frontend/src/App.jsx` now uses thin wrappers for extracted UI blocks and `LeftToolbar` wrapper for desktop left tool rail.
  - Step 3 partial complete (panel extraction):
    - new: `frontend/src/app/panels/SearchPanel.jsx`
    - new: `frontend/src/app/panels/ShortcutsPanel.jsx`
    - new: `frontend/src/app/panels/ThemePicker.jsx`
    - new: `frontend/src/app/panels/TplPanel.jsx`
    - `frontend/src/App.jsx` wrappers added for extracted panels; `TemplateMarketplacePanel` usage moved behind `TplPanel` wrapper.
  - Step 4 partial complete (canvas rendering layer extraction):
    - new: `frontend/src/app/canvas/ConnectorRenderer.jsx`
    - new: `frontend/src/app/canvas/NodeRenderer.jsx`
    - new: `frontend/src/app/canvas/SelectionOverlay.jsx`
    - new: `frontend/src/app/canvas/GuidesOverlay.jsx`
    - new: `frontend/src/app/canvas/RemoteCursors.jsx`
    - `Canvas` in `frontend/src/App.jsx` now delegates connector/node/lasso/guides/remote-cursor rendering to extracted components, preserving event/data wiring via props.
  - Step 4 continuation complete for canvas UI overlays:
    - new: `frontend/src/app/canvas/CanvasHud.jsx`
    - new: `frontend/src/app/canvas/ConnectorStylePanels.jsx`
    - `Canvas` now delegates HUD controls and connector style editors (mobile+desktop) to extracted components with identical reducer/event wiring.
  - Step 4 continuation for editor auxiliary widgets:
    - new: `frontend/src/app/canvas/AlignPanel.jsx`
    - new: `frontend/src/app/canvas/Minimap.jsx`
    - new: `frontend/src/app/ui/TimerWidget.jsx`
    - `frontend/src/App.jsx` now keeps thin wrappers for Align/Minimap/Timer, delegating full UI logic to extracted components.
  - Step 5 started (hooks/controllers extraction):
    - new: `frontend/src/app/hooks/useCanvasUiState.js`
    - `Canvas` state/ref declarations and related bootstrap/cleanup moved into hook with identical return wiring.
- validation for this pass:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild` PASS

## Latest update (2026-03-05) - Regression hotfix for auth/session + invalid board id
- backend (`backend/server.js`):
  - `GET /api/integrations/github/oauth/status` mutat pe `optAuth` (nu mai raspunde 401 pentru stare anonima).
- frontend (`frontend/src/App.jsx`):
  - `normalizeBoardId(...)` pentru query bootstrap/open board.
  - URL auto-clean pentru `board=undefined|null|nan`.
  - session validation gate pe startup (`api.me()`); token invalid => logout local + reset query + socket disconnect.
  - loading guard "Validating session..." pentru a evita montarea editorului in stare auth invalida.
- frontend (`frontend/src/hooks/useRightPanelAi.js`):
  - OAuth status check este sarit cand token-ul lipseste.
- Impact:
  - elimina request loop pe `/api/boards/undefined`.
  - reduce erorile 401 din console pentru status OAuth in stare neautentificata/stale session.

## Latest update (2026-03-05) - P0 launch blockers final fix pass (security + stability + correctness)
- dataflow correctness:
  - `frontend/src/lib/dataflow/engine.js`
  - `sheet` signature hash include continut cell key/value (nu doar length), eliminand stale recompute.
- auth/security:
  - `backend/server.js`
  - password hashing nou pe bcrypt (`bcryptjs`), cu auto-upgrade pentru hash-uri legacy (`scrypt`/SHA256+salt).
  - `JWT_SECRET` devine mandatory la startup (server fail-fast daca lipseste).
  - rate-limit auth existent pastrat pe register/login.
  - CORS/Socket origin allowlist bazat pe env (`BOARDAI_ALLOWED_ORIGINS`, `PUBLIC_BASE_URL`).
- realtime/perf:
  - `backend/server.js`
  - board store trecut pe in-memory cache + persistență async (`fs.promises.writeFile` queue).
  - socket hot-path nu mai face disk read sync.
- overwrite conflict prevention:
  - `backend/server.js` + `frontend/src/App.jsx`
  - board `revision` introdus si normalizat.
  - `PUT /api/boards/:id` cere revision pentru update `data`; conflict => `409`, missing => `428`.
  - frontend autosave trimite revision, actualizeaza revision local dupa save, si reload latest snapshot la conflict.
- config/tests:
  - `backend/.env.example` include `JWT_SECRET`, `BCRYPT_ROUNDS`, `BOARDAI_ALLOWED_ORIGINS`.
  - `backend/tests/semantic.api.test.js` seteaza `JWT_SECRET`.
- Validation:
  - `node --check backend/server.js` PASS
  - `npm.cmd test` (backend) PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `npm.cmd run build` PASS
  - ad-hoc verification scripts PASS:
    - strict JWT boot check
    - revision conflict flow
    - bcrypt + legacy upgrade
    - multi-user socket sync
    - no sync fs reads in realtime handlers
    - CORS/socket origin restriction

## Latest update (2026-03-05) - P0 blockers hotfix pass (targeted, no architecture refactor)
- dataflow correctness:
  - `frontend/src/lib/dataflow/engine.js`
  - `nodeSignature(sheet)` foloseste acum hash sampled key/value (nu doar length digest), astfel downstream recompute functioneaza la schimbari de valori cu lungime egala.
- backend security hardening:
  - `backend/server.js`
  - JWT secret policy:
    - `JWT_SECRET` este mandatory; serverul fail-fast daca lipseste.
  - CORS allowlist pentru Express + Socket.IO (`BOARDAI_ALLOWED_ORIGINS` / `PUBLIC_BASE_URL`).
  - auth login:
    - hash nou pe bcrypt (`bcryptjs`), cu compatibilitate legacy (`scrypt`/SHA256+salt).
    - upgrade automat hash legacy la bcrypt dupa login valid.
  - auth throttling:
    - middleware `authRateLimit` pe `/api/auth/register` si `/api/auth/login`.
- realtime hotspot fix:
  - `backend/server.js`
  - store board in-memory + persistență async; evenimentele frecvente (`board:sync`, `cursor:move`, `presence:update`, `board:activity`) nu mai fac disk read sync.
- revision control anti-overwrite:
  - `backend/server.js` + `frontend/src/App.jsx`
  - `PUT /api/boards/:id` cu `data` cere `revision`; backend intoarce `409` la stale revision si `428` la revision lipsa.
  - frontend autosave trimite revision si reload-eaza latest snapshot la conflict.
- autosave loop guard:
  - `frontend/src/App.jsx`
  - remote-applied updates (`board:update`) nu mai trimit `PUT /api/boards/:id`; local changes continua sa salveze normal.
- Validation:
  - `node --check backend/server.js` -> PASS
  - `npm.cmd test` (backend) -> PASS
  - `npm.cmd run test:dataflow` -> PASS
  - `npm.cmd run test:spreadsheet` -> PASS
  - `npm.cmd run test:connectors` -> PASS
  - `npm.cmd run build` -> PASS

## Latest update (2026-03-05) - Premium UX polish v2 (motion/depth/tactile + encoding-safe UI)
- motion tokens/theme:
  - `frontend/src/styles/tokens.js`
  - timings standardizate: `fast 120ms`, `medium 180ms`, `slow 260ms`
  - easing nou: `easeOut` + `easeSpring`
  - CSS vars noi: `--ui-motion-medium`, `--ui-motion-slow`, `--ui-ease-out`, `--ui-ease-spring` (cu aliases backward-compatible)
- editor interactions (`frontend/src/App.jsx`):
  - drag tactile feedback pe noduri selectate (scale subtil in grab state)
  - alignment guides animate/fade (`guideFlash`)
  - success micro-moments:
    - check pulse la task marcat `Done`
    - sparkle badge la `AI board/flow generated`
  - pointer smoothness:
    - `onMouseMove` trecut pe `requestAnimationFrame` scheduler
- depth/glass surfaces:
  - `frontend/src/components/RightPanel.jsx`
  - `frontend/src/components/RightToolPanel.jsx`
  - `frontend/src/components/MobileBottomSheet.jsx`
  - `frontend/src/components/context-menu/ContextMenu.jsx`
  - blur + translucent gradients + softer borders/shadows pe panel/menu/sheet
- encoding cleanup:
  - `frontend/src/App.jsx`
  - `frontend/src/components/RightPanel.jsx`
  - inlocuire glyph-uri corupte (`??`/mojibake) cu etichete ASCII stabile pentru toolbar/menus/hints
- Validation:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:dataflow` -> PASS
  - `npm.cmd run test:spreadsheet` -> PASS
  - `npm.cmd run test:connectors` -> PASS

## Latest update (2026-03-05) - Cross-Spreadsheet formulas + dependency graph
- frontend spreadsheet engine nou:
  - `frontend/src/lib/spreadsheet/engine.js`
  - suport cross-sheet refs:
    - `SheetName!B2`
    - `sheet("Prices").B2`
    - `SheetTable!Price[A]`
  - dependency graph pe celule + agregare `sheet -> sheet` data flow
  - error semantics:
    - `#REF!` pentru referinte invalide
    - `#CYCLE!` pentru dependente circulare
- `SpreadsheetNode` integration (`frontend/src/App.jsx`):
  - evaluator global cross-sheet (nu doar local per node)
  - formula pick UX: click pe celule din alte sheet-uri in timp ce formulezi (`=`) -> insert referinta
  - highlight pentru sheet-uri referite
  - stats `out/in` in header
  - conectori care corespund dependintelor cross-sheet sunt marcati vizual ca `data flow`
- tests:
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `npm.cmd run build` PASS

## Latest update (2026-03-05) - `/api/ai/complete` fallback hardening (production)
- backend (`backend/server.js`):
  - fallback deterministic server-side activ implicit:
    - `AI_ALLOW_FALLBACK` (`1` default).
  - `/api/ai/complete` raspunde acum cu `200` + `json` fallback cand providerul extern esueaza:
    - missing key, timeout/provider fail, invalid JSON.
  - response include:
    - `fallback: true`
    - `fallback_reason`
    - `model: fallback-local`.
  - `/api/health` expune observability nou:
    - `ai.fallback_enabled`
    - `ai.fallback`
    - `ai.last_fallback_reason`.
- Validation:
  - `node --check backend/server.js` -> PASS
  - `npm.cmd run build` -> PASS

## Latest update (2026-03-05) - AI retry-budget hardening (`/api/ai/complete`)
- backend (`backend/server.js`):
  - `DEEPSEEK_TIMEOUT_MS` default: `20000`.
  - nou `AI_TOTAL_DEADLINE_MS`: `25000`.
  - `deepseekChatCompletion` suportă timeout per-call (`timeoutMs`) și timeout-ul providerului întoarce `502`.
  - `/api/ai/complete` rulează retry/repair doar dacă există buget de timp; timeout-urile nu mai intră în retry chain.
  - `/api/health` include `ai.total_deadline_ms`.
- Validation:
  - `node --check backend/server.js` -> PASS
  - `npm.cmd run build` -> PASS

## Previous update (2026-03-05) - AI timeout hardening for production (`/api/ai/complete`)
- backend (`backend/server.js`):
  - `DEEPSEEK_TIMEOUT_MS` introdus (default 45000ms).
  - `deepseekChatCompletion` folosește acum `AbortController` + timeout explicit.
  - timeout-urile DeepSeek întorc răspuns controlat (`504` + mesaj clar), evitând request-uri blocate.
  - `/api/health` include `ai.timeout_ms`.
- frontend (`frontend/src/components/TemplateMarketplacePanel.jsx`):
  - AI template generation: `maxTokens` redus la 900.
  - la timeout/504, generator fallback local produce template minim funcțional (în loc de fail hard).
- Validation:
  - `node --check backend/server.js` -> PASS
  - `npm.cmd run build` -> PASS

## Previous update (2026-03-05) - Template Marketplace v1 integrated in editor
- Backend:
  - `backend/server.js` include layer complet template marketplace pe `templates.json`.
  - endpoint-uri: categories/list/detail/preview/create/publish/version/bookmark/rate/use.
- Frontend:
  - `frontend/src/components/TemplateMarketplacePanel.jsx` nou.
  - `frontend/src/App.jsx`:
    - API methods `template*` adaugate.
    - `TplPanel` refactor pe marketplace real (nu static `TPLS`).
    - insert AI/template pe board cu remap de ID-uri + recentrare viewport.
    - create board din template + open board nou.
- Validation:
  - `npm.cmd run build` -> PASS
  - `node --check backend/server.js` -> PASS

## Previous update (2026-03-05) - Collaboration Engine v1 + AI Agents wiring completed
- Collaboration layer complet in `InnerApp`:
  - state: `collabUsersBySocket`, `collabActivity`, `myPresence`, `meetingNotes`, `meetingSuggestions`.
  - socket listeners:
    - `users:init`, `user:joined`, `user:left`
    - `cursor:update`, `cursor:leave`
    - `user:presence`
    - `board:activity`
  - presence engine:
    - toggle manual `active|idle|presenting`
    - auto-idle pe inactivitate + auto-active la interactiune.
- UI integration:
  - `Canvas` primeste `collabUsers` pentru remote cursors.
  - `RightPanel` (desktop + mobile sheet) primeste model `collab` complet.
  - sectiunile `COLLABORATION` + `AI AGENTS` sunt alimentate real.
- AI Meeting Assistant:
  - parse meeting notes -> suggestions (`tasks/milestones/decisions`) via `/api/ai/complete`.
  - `Apply suggestions` insereaza noduri execution + conexiuni.
- Backend realtime update (`backend/server.js`):
  - `user:joined` include `state` + `lastActiveAt`.
  - `board:activity` este broadcast la tot room-ul (`io.to(boardId)`), inclusiv sender.
- Stability fix:
  - `setMobileMode`/`exitMobileMode` mutate inainte de `popstate` effect pentru a elimina potentialul runtime crash (TDZ).
- Validation:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:connectors` -> PASS
  - `node --check backend/server.js` -> PASS

## Previous update (2026-03-05) - Execution Intelligence v1 integration pass
- Execution layer live in frontend:
  - hook nou `useExecutionIntelligence` cu snapshot semantic (`tasks/milestones/decisions/risks/dependencies`), warnings si health score.
  - UI nou:
    - `ExecutionPanel` in `RightPanel` (health + blocker radar + task controls + meeting autopilot).
    - `ExecutionTimelineOverlay` (board <-> timeline toggle, drag tasks pe zile, due date update).
- Node system extins:
  - tipuri `task`, `milestone`, `decision` randate nativ pe canvas.
  - add-mode suportat direct (canvas place flow) + panel tools.
- Connectors execution hardening:
  - dep type detection schimbata la explicit-only (`depType`/label recognizer), fara fallback forțat la `depends_on`.
  - inspector/context connector au acum optiune `None` + `Depends/Blocks/Related`.
- Toolchain completat:
  - `RightToolPanel`: tool-uri `Task Node`, `Milestone`, `Decision`.
  - `modeController` + `boardState` extinse cu noile add tools.
  - canvas context menu (`canvas.js`) include insert actions pentru execution nodes.
- Validation:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:connectors` -> PASS

## Previous update (2026-03-05)
- Mobile UX shell + touch interactions refactor deployed live:
  - shell mobil unificat in editor:
    - `MobileBottomBar` (Pan/Select, Add, Connect, Undo, Panel, More, Done)
    - `MobileBottomSheet` cu snap points pentru `insert`, `panel`, `more`
  - touch input hardening in `Canvas`:
    - `createInputController(...)` (long-press + move tolerance)
    - long-press contextual actions sheet (canvas/container/node/selection)
    - node touch behavior separat (`onTouchSel`) pentru a evita move accidental in `pan` mode
    - default mobile mode pe load: `pan`
  - `RightToolPanel` suporta acum render embedded in sheet (`embedded=true`)
  - `SpreadsheetNode` + `DeckNode` migrare vizuala pe token-uri theme-aware (fara hardcode alb/negru dominant)
- Validation:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:connectors` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-05)
- Right panel UX alignment cu stanga:
  - desktop are acum toggle dedicat `Hide Panel / Show Panel`.
  - `RightPanel` e randat flotant (border/radius/shadow), similar modelului tools panel.
  - adaugata sectiune colapsabila `SPIDER WEB - FILE`.
  - minimap offset pe desktop este acum dinamic in functie de panel (`rightPanelOpen`).
- Validation:
  - `npm.cmd run build` -> PASS
  - `npm.cmd run test:connectors` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-05)
- Hotfix smart routing pentru conectori `straight`:
  - acum detectam intersectia segmentului direct cu obstacolele (`segmentIntersectsRect`).
  - daca exista intersectie, connectorul este rerutat A* (ortho path) ca sa ocoleasca containerele.
  - comportamentul elimina cazurile "trece pe sub container" pentru majoritatea scenariilor de board.
- Validation:
  - `npm.cmd run test:connectors` -> PASS
  - `npm.cmd run build` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-05)
- Hotfix routing connectors pentru obstacle avoidance:
  - cauza: obstacle set prea restrans (doar cateva tipuri), astfel unele linii traversau containere/elements.
  - fix: ORTHO/WAVY trateaza acum ca obstacole toate nodurile vizibile cu dimensiune relevanta (`w/h >= 18`), exceptand `text`.
  - padding obstacole crescut la `30` pentru clearance mai bun.
- Validation:
  - `npm.cmd run test:connectors` -> PASS
  - `npm.cmd run build` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-05)
- Hotfix productie pentru runtime error in editor:
  - eroare: `ReferenceError: buildConnectorFromDefaults is not defined`
  - cauza: shortcut flow din `Toolbar` apela helper definit doar in `Canvas`
  - fix: builder local adaugat in `Toolbar`, compatibil cu connector defaults persistate
- Validation:
  - `npm.cmd run test:connectors` -> PASS
  - `npm.cmd run build` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-05)
- Advanced Connectors v1.5 livrat incremental pe frontend:
  - `line jumps` (bridge arcs) pe conectori `straight/ortho`:
    - spatial hash pentru segmente + detectie de intersecții
    - regula deterministă pentru "care connector sare"
    - ignore endpoint-near crossings + cap per connector
    - calcule debounce + idle (`requestIdleCallback` fallback)
  - default connector style per user (persistat local):
    - storage keys:
      - `pd.board.connector.defaultStyle.v1`
      - `pd.board.connector.rememberLast.v1`
    - `Remember last style` (implicit ON)
    - `Set default` / `Reset default` din inspector si context menu
  - model conector extins cu `jumpStyle` (`auto|on|off`) + normalizare backward-compatible
  - toate flow-urile de creare connector folosesc presetul default curent:
    - arrow tool
    - port drag-to-connect
    - shortcuts Tab/Enter pentru flow mindmap
- Validation:
  - `npm.cmd run test:connectors` in `frontend/` -> PASS
  - `npm.cmd run build` in `frontend/` -> PASS

## Previous update (2026-03-04)
- Advanced Connectors v1 implementat incremental pe frontend:
  - model anchor-based pentru connectors:
    - `from/to` cu `anchor: port|pos` + fallback legacy `fromId/toId`
  - ports overlay pe hover/selection:
    - `top/right/bottom/left`
    - drag-to-connect cu snap magnetic + preview path
  - routing modes active:
    - `straight`
    - `ortho` (A* cu obstacle avoidance)
    - `curved`
    - `wavy`
  - style engine:
    - stroke/width/dash
    - caps (`none/arrow/triangle/circle`)
    - corner radius (ortho)
    - wave amplitude/wavelength (wavy)
  - context menu pe connector:
    - routing/style/reverse/delete
  - state hardening in reducer pentru compat:
    - dependency/copy/delete functioneaza si pe connectors cu `from/to`.
- Validation:
  - `cmd /c npm run test:connectors` in `frontend/` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)
- Context submenu rendering fix:
  - cauza: clipping de overflow in containerul scrollabil al context menu-ului.
  - fix:
    - submenu-ul este randat prin portal (`createPortal`) in `document.body`.
    - ancorare `fixed` la butonul parinte.
    - close timing imbunatatit (hover submenu mentine deschis).
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-04)
- Context menu refactor v1 (frontend):
  - arhitectura noua pe module:
    - `buildContextMenu(ctx)` in `components/context-menu/menuBuilder.js`
    - action modules separate:
      - `actions/canvas.js`
      - `actions/container.js`
      - `actions/node.js`
      - `actions/selection.js`
    - renderer dedicated:
      - `components/context-menu/ContextMenu.jsx`
  - target detection corecta:
    - `canvas | container | node | selection`
    - hit-test pe `data-node-id` / `data-node-type`
  - meniuri contextuale grupate pe sectiuni + submenus + enabled/danger logic.
  - UI consistent cu token-uri `T`, close on outside click / Escape / action.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-04)
- Context menu reliability fix:
  - right-click menu (`onCtx`) foloseste acum coordonate relative la canvas (`wRef rect`), nu viewport.
  - clamp-ul se face pe dimensiunea canvas-ului, ceea ce elimina cazurile in care meniul era taiat sau "disparea".
  - `stopPropagation` adaugat pentru stabilitate la deschidere.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-04)
- Top bar/control UX update:
  - minimap este acum hidden by default si se deschide doar din butonul `🗺 Harta` din top bar;
  - minimap are buton `✕` pentru inchidere directa;
  - minimap foloseste `rightInset` (300) pentru a evita overlap cu panel-ul AI din dreapta.
- Import/export simplificat:
  - butoanele separate de export/import au fost mutate intr-un dropdown `☰ Menu` in top bar.
  - dropdown actions:
    - Import JSON
    - Export SVG / PNG / JSON
  - dropdown close behavior: outside click + Escape + dupa action click.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-04)
- Context menu UX pass in editor (`frontend/src/App.jsx`):
  - right-click menu este acum viewport-safe:
    - clamp position `sx/sy`
    - `maxHeight` din viewport
    - scroll intern (`overflowY:auto`)
  - actiunile au fost grupate semantic:
    - `BOARD ELEMENTS`, `SHAPES`, `STRUCTURE`, `INTERACTION`, `SELECTION`, `ARRANGE`, `EXPORT`
  - meniul lung nu mai taie optiunile; toate raman accesibile.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-04)
- Console/runtime UX fixes in editor:
  - fixed repeated browser warning:
    - `The specified value "var(--ui-bg0, #050911)" does not conform ... #rrggbb`
  - root cause:
    - `input[type=color]` for canvas BG was bound to `T.bg0` (CSS var string), but color input accepts only hex/rgb values.
  - implemented in `frontend/src/App.jsx`:
    - added `normalizeColorInputValue(...)` + `getThemeColorHex(...)`
    - BG picker now always receives a valid hex value (`colorInputBgValue`)
  - dublu-click hardening:
    - ensured node wrappers expose `data-node="1"` so `Canvas.onDoubleClick` does not create a new sticky while editing existing nodes.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` -> PASS (`PUBLIC_HEALTH: ok`, `HTTP/2 200`)

## Previous update (2026-03-04)
- Deploy workflow standardizat + deploy live executat:
  - script nou:
    - `ops/deploy_now.ps1` (wrapper peste `ops/deploy_board.ps1`)
  - `agents.md` actualizat:
    - deploy obligatoriu dupa modificari cu:
      - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1`
    - varianta rapida:
      - `... -SkipBuild`
  - deploy rulat acum:
    - frontend build PASS
    - upload/restart/smoke PASS
    - `PUBLIC_HEALTH` -> `ok`
    - homepage -> `HTTP/2 200`

## Previous update (2026-03-04)
- Global Light/Dark theme system implementat end-to-end pe frontend:
  - engine de theme in `frontend/src/styles/tokens.js`:
    - `UI_THEME_PALETTES` (`dark` / `light`)
    - `applyUiTheme`, `getStoredUiTheme`
    - persistare in `localStorage` (`boardai_theme_mode`)
  - `UI_TOKENS` mutate pe CSS vars (`--ui-*`) cu fallback dark.
  - toggle tema disponibil in:
    - Landing header
    - Dashboard header
    - Editor TopBar
  - `RightToolPanel` foloseste token-uri theme-aware (fara paleta hardcodata separata).
  - CSS global aliniat la token-uri (body/scrollbar/focus/accent).
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-04)
- Editor UX/tooling hardening finalizat:
  - nu mai ramane blocat in add mode:
    - `Esc` global -> `Select` (`EXIT_ADD_MODE`)
    - `Select` explicit in `RightToolPanel` + toolbar legacy
  - shortcut-uri navigation:
    - `V` select
    - `H` pan
    - `Space hold` pan temporar (revine la tool anterior la keyup)
  - state tool extins:
    - `lastNonAddTool`
    - `autoReturnToSelect` (default ON, toggle in panel)
  - auto-return la `select` dupa `ADD` pentru tool-uri de insert (configurabil)
  - `RightToolPanel` rescris pe token-uri unificate:
    - `frontend/src/styles/tokens.js`
    - eliminat mix vizual accidental alb/negru in chrome-ul panelului
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-04)
- Semantic deploy compatibility fix + live deploy PASS:
  - productie ruleaza pe Node 20, deci semantic DB driver a fost mutat pe `better-sqlite3` (in loc de `node:sqlite`).
  - scriptul de deploy urca acum si folderul `backend/server/` (module runtime), nu doar `server.js`.
  - deploy live validat:
    - `LOCAL_HEALTH` -> `ok`
    - `PUBLIC_HEALTH` -> `ok`
    - `/api/health` include metrics `semantic.*`

## Previous update (2026-03-04)
- Semantic Board Graph + Execution Health v1 livrat incremental (board JSON ramane sursa de adevar):
  - backend semantic layer paralel (SQLite + migrations):
    - `semantic_entities`
    - `semantic_relations`
    - `board_health_snapshot`
  - motor deterministic nou:
    - `extractSemantic(boardJson)` -> entitati + relatii
    - `computeHealth(entities, relations)` -> `healthScore` + `issues`
  - endpoint-uri REST noi:
    - `GET /api/boards/:id/semantic`
    - `POST /api/boards/:id/semantic/rebuild`
  - hook de rebuild:
    - async/debounced pe `board.save/create/restore`
    - cleanup semantic la `board.delete`
  - observability:
    - metrics semantic in `/api/health`
  - frontend:
    - Dashboard card `Execution Health` (score + top 3 issues)
    - drawer `Execution Health Details` cu issues grupate
    - click issue -> open board + focus node (query `focus`)
  - tests:
    - unit extractor/health
    - integration GET semantic endpoint
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm test` in `backend/` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-04)
- Deck typing target UX finalizat (`Title` / `Body`) pentru prezentari:
  - `DeckNode` are segmented toggle in header pentru target-ul tastaturii (`deckInputTarget`).
  - click pe zona de titlu/body seteaza target-ul activ si ofera highlight vizual.
  - keyboard routing pe `deck` foloseste target-ul activ:
    - typing/backspace/delete editeaza campul selectat
    - `Enter` in `Title` muta pe `Body`, iar in `Body` adauga newline.
- state default nou in `makeDeckNode(...)`:
  - `deckInputTarget` initializeaza implicit pe `body`.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Mobile panel + focus keyboard fixes:
  - panel mobil (`RightPanel`) are acum scroll complet (`fill` mode + `minHeight:0` + touch scrolling).
  - `RightToolPanel` mobil nu se mai inchide accidental la tap/scroll (stopPropagation pe overlay/panel).
  - keyboard behavior contextual:
    - `sheet` selectat: sageti/tab/enter navigheaza celule, typing scrie in celula activa.
    - `deck` selectat: sageti stanga/dreapta schimba slide, typing scrie in body-ul slide-ului.
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Mobile usability pass finalizat:
  - TopBar mobil are acum buton `Tools` separat de `Panel`.
  - drawer-ele mobile sunt exclusive (fara overlap):
    - `Tools` deschis -> `Panel` inchis
    - `Panel` deschis -> `Tools` inchis
  - `Escape` inchide ambele drawer-e mobile.
  - `RightToolPanel` suporta close action pe mobil (`onRequestClose` + buton `Close`).
  - toolbar-ul mobil se ascunde automat cand un drawer este deschis.
  - toolbar-ul mobil respecta safe-area iOS (`env(safe-area-inset-bottom)`).
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Tools panel UX ajustat dupa feedback:
  - `RightToolPanel` este acum ancorat pe stanga in editor desktop (`side="left"`).
  - exista control direct `Hide Tools / Show Tools` in `InnerApp`.
  - panelul se randaza conditionat prin `toolsPanelOpen`.
  - pe mobil, acest panel ramane inchis iar fluxul mobil existent ramane activ (toolbar + drawer right panel).
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Right-side tools redesign (desktop) implementat:
  - component nou:
    - `frontend/src/components/RightToolPanel.jsx`
  - panel flotant cu:
    - categorii colapsabile (`Board Elements`, `Media`, `Structure`, `Interaction`)
    - icon set line-based consistent + labels + tooltips
    - quick actions (`undo`, `redo`, `snap`, `dependency mode`)
    - search intern pentru unelte
  - integrare in `frontend/src/App.jsx`:
    - desktop:
      - toolbar-ul vechi este ascuns vizual (`hidden`), dar ramane montat pentru shortcut-uri globale
      - `RightToolPanel` este randat langa `RightPanel` fara overlap (`rightInset` calibrat)
    - mobile:
      - fallback-ul existent ramane activ (toolbar bottom + drawer right panel)
- Frontend glyph cleanup:
  - `DeckNode` (`frontend/src/App.jsx`) avea caractere corupte pe butoanele de navigare slide
  - inlocuite cu `<` / `>`
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Spreadsheet + Slides containers implementate end-to-end pe canvas:
  - state domain (`frontend/src/state/boardState.js`):
    - node factories noi:
      - `makeSheetNode(...)`
      - `makeDeckNode(...)`
    - template-uri noi:
      - `spreadsheet`
      - `slides`
    - template `table` migrat pe node `sheet` (nu mai genereaza grid de stickies)
    - copy/duplicate hardening:
      - clone deep pentru `sheetCells` / `deckSlides` (fara shared references)
  - frontend canvas (`frontend/src/App.jsx`):
    - node components noi:
      - `SpreadsheetNode`:
        - grid real editabil
        - formula bar
        - formule (`=...`) cu suport:
          - referinte `A1`
          - range `A1:B5`
          - functii `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`
          - detectie ciclu (`#CYCLE!`) si erori (`#ERR`)
      - `DeckNode`:
        - slide navigation (prev/next)
        - add/delete slide
        - editare titlu/body pe slide-uri
    - insert flow:
      - tool `table` produce acum `sheet`
      - tool-uri noi in toolbar + shortcuts:
        - `sheet` (`N`)
        - `deck` (`O`)
      - context menu include acum inserare rapida `Slides`
      - render switch extins pentru `sheet`/`deck`
      - cursor map extins pentru `sheet`/`deck`
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Roadmap execution phase 1 a pornit: Jira import MVP implementat.
  - backend (`backend/server.js`):
    - endpoint nou:
      - `POST /api/boards/:id/integrations/jira/import`
    - auth Jira:
      - request overrides (`jiraEmail`, `jiraToken` in body/header)
      - fallback env (`JIRA_EMAIL`, `JIRA_TOKEN`)
    - mapping Jira -> execution plan:
      - issue fields (`summary/description/assignee/priority/status/duedate`)
      - `fixVersions` -> milestones
      - `issuelinks` -> dependsOn
    - Jira query endpoint:
      - foloseste `POST /rest/api/3/search/jql` (API curent)
    - sync state per site/project:
      - `board.integrations.jira[site::project]`
    - audit event nou:
      - `board.jira.import`
    - `/api/health` include acum status minimal Jira env auth
  - frontend:
    - `RightPanel` (`EXECUTION PLAN`) are sectiune noua `JIRA IMPORT (MVP)`:
      - `site`, `project key`, `email`, `token`, `state`
      - `Import Jira -> Board`
    - wiring API:
      - `api.jiraImport(...)` in `App.jsx`
      - `jiraApi.import(...)` transmis catre `useRightPanelAi`
  - config:
    - `backend/.env.example` extins cu `JIRA_EMAIL`, `JIRA_TOKEN`
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS
  - deploy live (`ops/deploy_board.ps1 -SkipBuild`) -> PASS

## Previous update (2026-03-03)
- GitHub sync depth hardening finalizat + deploy live:
  - backend (`backend/server.js`):
    - `githubRequest` are acum retry/backoff pentru status-uri tranziente (`408/409/425/429/5xx`) + suport `Retry-After`
    - idempotency keys active pe:
      - `POST /api/boards/:id/integrations/github/import`
      - `POST /api/boards/:id/integrations/github/push`
    - store idempotency per board:
      - `board.integrations.github_idempotency` (TTL configurabil)
    - milestone reconciliation la push:
      - create milestones lipsa
      - update `due_on` + `state` (`open/closed`) din task-urile execution
      - stats in response (`milestones: desired/matched/created/updated`)
    - dependency parser extins la import:
      - suporta `issue #123`, `/issues/123`, linii `depends-on:/blocked-by:/requires:`
      - fix regex keyword chunk pe newline parsing
  - frontend:
    - `runGitHubImport` / `runGitHubPush` trimit `idempotencyKey`
    - API trimite `Idempotency-Key` header cand cheia este prezenta
  - config:
    - `backend/.env.example` extins cu:
      - `GITHUB_RETRY_MAX_ATTEMPTS`
      - `GITHUB_RETRY_BASE_MS`
      - `GITHUB_IDEMPOTENCY_TTL_SEC`
  - deploy:
    - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
    - health local/public PASS pe `board.private-driver.ro`
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- AI differentiator v2 (phase 3) finalizat: GitHub OAuth app flow + token vault + eliminare token manual din UI.
  - backend (`backend/server.js`):
    - OAuth endpoints noi:
      - `GET /api/integrations/github/oauth/start`
      - `GET /api/integrations/github/oauth/callback`
      - `GET /api/integrations/github/oauth/status`
      - `DELETE /api/integrations/github/oauth/status`
    - token vault per user:
      - token GitHub criptat AES-256-GCM in `users.json` (`user.integrations.github`)
      - ordine fallback token la sync:
        - request token
        - header token
        - user vault token
        - `GITHUB_TOKEN` env
    - observability:
      - `GET /api/health` include `github.oauth_configured` + `github.env_fallback_token`
  - frontend:
    - sectiunea `EXECUTION PLAN` nu mai cere token manual
    - connect/disconnect GitHub prin popup OAuth
    - status auth in panel (`connected` / `env fallback` / `not connected`)
    - import/push folosesc tokenul rezolvat in backend
  - config:
    - `backend/.env.example` extins cu:
      - `GITHUB_OAUTH_CLIENT_ID`
      - `GITHUB_OAUTH_CLIENT_SECRET`
      - `GITHUB_OAUTH_REDIRECT_URI`
      - `GITHUB_OAUTH_SCOPES`
      - `GITHUB_TOKEN_VAULT_SECRET`
      - `PUBLIC_BASE_URL`
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Frontend encoding fix pentru caractere corupte in UI (landing + editor):
  - problema:
    - texte afisate cu secvente mojibake (sageti/emoji/simboluri afisate gresit)
    - cauza: text UTF-8 salvat/interpretat gresit
  - fix aplicat:
    - reconversie text din `Windows-1252` catre `UTF-8` pe:
      - `frontend/src/App.jsx`
      - `frontend/src/state/boardState.js`
  - rezultat:
    - label-uri, iconuri si diacritice restaurate corect in landing, toolbar, context menu si template-uri
  - deploy live dupa fix:
    - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1`
    - `https://board.private-driver.ro` -> `HTTP/2 200`
    - `https://board.private-driver.ro/api/health` -> `200` (`status: ok`)
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- GitHub sync hardening + deploy live finalizate:
  - backend:
    - import incremental pe `POST /api/boards/:id/integrations/github/import`:
      - parametri noi `incremental`, `since`
      - sync state per repo in `board.integrations.github[...]`
      - merge delta issues peste task-urile execution existente (acelasi repo)
    - conflict strategy pe `POST /api/boards/:id/integrations/github/push`:
      - `skip_remote_newer` / `prefer_board` / `prefer_remote`
      - detectie conflict cu `issue.updated_at` vs `issueUpdatedAt/lastSyncedAt`
      - fallback create daca issue link-uit lipseste (404)
      - response extins (`skipped`, `conflicts`, `sync`, `linked.issueUpdatedAt`)
  - frontend:
    - controls noi in `EXECUTION PLAN`:
      - `Incremental import`
      - `Conflict strategy`
    - execution metadata extinsa pe noduri:
      - `executionIssueUpdatedAt`
      - `executionLastSyncedAt`
      - `executionRepo`
      - `executionTitle`, `executionDescription`
  - deploy live:
    - `ops/deploy_board.ps1 -SkipBuild` executat cu succes pe `board.private-driver.ro`
    - health checks locale/publice PASS
    - smoke pe rutele noi GitHub integration PASS (route active)
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- AI differentiator v2 a pornit cu GitHub bidirectional sync MVP:
  - backend:
    - endpoint nou import:
      - `POST /api/boards/:id/integrations/github/import`
    - endpoint nou push:
      - `POST /api/boards/:id/integrations/github/push`
    - access checks:
      - import -> read
      - push -> edit
    - audit events:
      - `board.github.import`
      - `board.github.push`
  - frontend:
    - `RightPanel` (sectiunea `EXECUTION PLAN`) include acum:
      - repo input (`owner/repo`)
      - token input
      - issue state selector
      - actioneaza bidirectional:
        - `Import -> Board`
        - `Push Board -> Issues`
    - flow nou in `useRightPanelAi`:
      - `runGitHubImport`
      - `runGitHubPush`
      - `extractExecutionTasksForSync`
    - execution nodes includ metadata issue:
      - `executionIssueNumber`, `executionIssueUrl`, `executionIssueState`, `executionSourceRefs`
  - config:
    - `backend/.env.example` extins cu:
      - `GITHUB_TOKEN`
      - `GITHUB_API_BASE`
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Execution wedge v1 hardening implementat pe frontend:
  - `EXEC_SYS` are acum contract strict structurat (`objectives/milestones/tasks/risks`) cu campuri obligatorii pe task:
    - `stage`, `owner`, `priority`, `status`, `dueDate`, `milestoneId`
  - flow-ul execution nu mai foloseste parserul generic de board:
    - `runExecutionPlan` -> `applyExecutionPlan` (deterministic renderer)
  - mapping nou in canvas:
    - lanes `NOW/NEXT/LATER`
    - tasks cu owner/status/priority/due/milestone explicit in text + metadata `execution*` pe nod
    - milestones/risk panels + arrows pentru dependencies/milestone/risk links
- Fisiere modificate:
  - `frontend/src/ai/prompts.js`
  - `frontend/src/hooks/useRightPanelAi.js`
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Refactor phase 4 finalizat pe frontend:
  - `PropsPanel` extras in `frontend/src/components/PropsPanel.jsx`
  - `FileZone` extras in `frontend/src/components/FileZone.jsx`
  - `RightPanel` importa direct noile componente
  - `App.jsx` curatat (fara implementarile locale pentru cele doua paneluri)
- Task sync completat pe roadmap "depasim Miro": toate gap-urile discutate au fost puse explicit in `ai/TASKS.md`.
- Implementare noua in acest pas:
  1. Audit timeline UI in editor
  2. AI endpoint hardening (rate-limit + observability in `/api/health`)
  3. Execution wedge v1 MVP (PRD/repo/issues -> execution board)
- frontend:
  - fisier nou:
    - `frontend/src/components/AuditTimelinePanel.jsx`
  - flow execution nou:
    - `frontend/src/ai/prompts.js` -> `EXEC_SYS`
    - `frontend/src/hooks/useRightPanelAi.js` -> `runExecutionPlan`
    - `frontend/src/components/RightPanel.jsx` -> sectiune `EXECUTION PLAN`
  - integrare:
    - `frontend/src/components/RightPanel.jsx`
    - `frontend/src/App.jsx` (`auditList`, `auditApi`)
  - features:
    - listare audit events
    - filtre `action` + `limit`
    - refresh manual
    - generare board de executie din context text (cu replace optional)
- backend `server.js`:
  - `GET /api/boards/:id/audit` extins cu query:
    - `limit`, `action`, `actorId`, `min_ts`
  - audit events includ actor enrichment:
    - `actor: { id, name, email, color }`
  - AI guardrails:
    - `POST /api/ai/complete` -> `optAuth + aiRateLimit`
    - env nou:
      - `AI_RATE_WINDOW_SEC`
      - `AI_RATE_MAX`
    - `/api/health` include metrics `ai.*`
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Enterprise baseline inchis pentru:
  1. audit trail backend
  2. RBAC enforcement pe Socket.IO
  3. mobile-ready hardening in frontend
- backend `server.js`:
  - storage nou `backend/data/audit.json`
  - endpoint nou:
    - `GET /api/boards/:id/audit`
  - actiuni auditate:
    - board lifecycle: `create/rename/save/restore/delete`
    - membership: `member.add/member.role/member.remove`
  - Socket.IO access checks:
    - `board:join` -> read required
    - `board:sync` -> edit required
    - `cursor:move` -> read required
  - events de eroare:
    - `board:join:error`
    - `board:sync:error`
- frontend `App.jsx`:
  - socket join cu token + handling deny events in toast
  - mobile editor:
    - right panel drawer
    - toolbar bottom/scroll
    - touch interactions + pinch zoom
  - mobile responsive pass:
    - `LandingPage`
    - `AuthModal`
    - `Dashboard`
    - `SearchPanel`
    - `ShortcutsPanel`
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Workspace RBAC baseline implementat (owner/editor/viewer) + sharing UI:
  - backend `server.js`:
    - roluri + access guards (`canReadBoard`, `canEditBoard`, `canManageBoard`)
    - `POST /api/boards` acum cere auth (`requireAuth`)
    - endpoints sharing noi:
      - `GET /api/boards/:id/members`
      - `PUT /api/boards/:id/members`
      - `DELETE /api/boards/:id/members/:userId`
    - responses board/list includ `access_role`
  - frontend:
    - component nou `frontend/src/components/BoardAccessPanel.jsx`
    - integrat in right panel pentru invite/remove membri (email + role)
    - wiring API in `frontend/src/App.jsx` (`members/setMember/removeMember`)
- Validation:
  - `node --check backend/server.js` -> PASS
  - `cmd /c npm run build` in `frontend/` -> PASS
  - smoke RBAC local flow -> PASS

## Previous update (2026-03-03)
- Milestone complet "version history end-to-end" (backend + frontend):
  - UI nou in editor:
    - `frontend/src/components/VersionHistoryPanel.jsx`
    - list versions + preview metadata + restore action cu confirmare in 2 pasi
  - integrare in right panel:
    - `frontend/src/components/RightPanel.jsx`
  - wiring API in frontend:
    - `historyList`, `historyGet`, `historyRestore` in `frontend/src/App.jsx`
  - restore aplica imediat snapshot-ul in reducer (`LOAD`) si sincronizeaza normal prin autosave/socket flow
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-03)
- Start pe roadmap "depasim Miro" cu primul milestone tehnic de baseline enterprise:
  - board version history in backend (snapshot + restore)
  - routes noi:
    - `GET /api/boards/:id/history`
    - `GET /api/boards/:id/history/:versionId`
    - `POST /api/boards/:id/history/:versionId/restore`
  - capture snapshot la create/save/restore cu throttle inteligent (rolling update pe interval scurt)
  - validare:
    - smoke local API flow PASS (create -> save -> history -> restore)
    - `node --check backend/server.js` PASS

## Previous update (2026-03-02)
- Refactor phase 3 finalizat: state domain extras din `App.jsx` in modul dedicat.
  - fisier nou: `frontend/src/state/boardState.js`
    - `createBoardState({ T, SC, CANVAS_THEMES, uid })`
    - include:
      - constants/helpers (`GRID`, `snap`, `SHAPE_DEFAULTS`, `SHAPE_TYPES`, `TABLE_*`, `TIDY_GAP_*`, `MINDMAP_CHILD_GAP_*`)
      - table/canvas helpers (`makeShapeNode`, `makeTablePack`, `getTableInfo`, `getTableColumnStart`, `collectDependency`)
      - templates registry (`TPLS`)
      - `reducer` + `INIT`
  - `frontend/src/App.jsx`:
    - importa `createBoardState`
    - initializeaza state domain prin destructuring
    - nu mai defineste local reducer/helpers/templates
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Refactor phase 2 finalizat: `RightPanel` extras din `App.jsx` in component + hook dedicate.
  - fisier nou: `frontend/src/components/RightPanel.jsx`
    - UI pentru panelul din dreapta (file zone, template picker, vote results, AI chat)
  - fisier nou: `frontend/src/hooks/useRightPanelAi.js`
    - state + logica AI/file-flow (`send`, `handleFile`, `runFileGeneration`, `applyParsed`, `clearAll`)
  - `frontend/src/App.jsx`:
    - a eliminat functia locala `RightPanel`
    - foloseste acum componenta importata `RightPanel`
    - transmite deps din `InnerApp` (`s`, `d`, theme tokens, helpers, components)
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Refactor phase 1 pe frontend pentru reducerea monolitului din `App.jsx`:
  - fisier nou: `frontend/src/ai/prompts.js`
    - `WB_SYS`, `SW_PLAN_SYS`, `SW_SYS`
    - `FILE_TEMPLATE_KEYS`, `FILE_TEMPLATE_LABELS`, `AI_CHIPS`
  - fisier nou: `frontend/src/ai/helpers.js`
    - `aiCall`, `parseAiJson`, `normalizeTemplatePlan`, `buildFileGenerationPrompt`
  - `frontend/src/App.jsx` a fost curatat:
    - a importat modulele noi
    - a eliminat prompturi/helpere duplicate
    - `RightPanel` foloseste modulele extrase
- Validation:
  - `cmd /c npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Cele 3 functionalitati cerute sunt implementate:
  1. Table advanced:
    - selectare multi-celula (shift range)
    - merge / unmerge din `PropsPanel`
  2. Swimlanes:
    - lane orizontal (`J`) / lane vertical (`K`)
    - context menu + component dedicat `LaneNode`
  3. Dependency mode:
    - toggle in toolbar + `Ctrl+Shift+D`
    - upstream (albastru), downstream (verde), rest estompat
- Extra:
  - operatiile pe noduri ascunse (dupa merge) sunt curate in minimap/search/export
- Validation:
  - `npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Functionalitati noi de productivitate in editor:
  - `Auto-layout / Tidy` pentru selectie (grila lizibila) cu shortcut `Ctrl+Shift+L`
  - `Wrap in Frame` pentru selectie
  - shortcuts de ideare rapida:
    - `Tab` = child sticky + connector
    - `Enter` = sibling node (si re-conectare la acelasi parinte cand exista)
  - hint vizual in canvas pentru `Tab/Enter`
- Acces UI:
  - toolbar: butoane `↹` (tidy), `⬚` (wrap frame)
  - context menu: intrari pentru auto-layout si frame
- Validation:
  - `npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- File upload AI flow in 2 pasi:
  1. AI planner recomanda template (`SW_PLAN_SYS`)
  2. user alege explicit template-ul in UI
  3. abia apoi se genereaza board-ul (`SW_SYS`)
- Right panel are acum template picker pentru fisiere:
  - recomandare + motiv + complexity
  - indicator `table: yes/no`
  - optiuni de template si buton de folosire recomandare
- AI prompts ajustate pentru:
  - detectie automata nevoi de tabel
  - layout clar la structuri complexe (clusterizare + reducere clutter)
  - randare tabel prin metadata (`tableId/tableRole/tableRow/tableCol`)
- Validation:
  - `npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Table editor basic implementat peste tool-ul `table`:
  - nodurile de tabel au metadata (`tableId`, `tableRole`, `tableRow`, `tableCol`)
  - operatii disponibile in `PropsPanel`:
    - add/remove row
    - add/remove column
    - resize width pe coloana activa
  - reducer actions noi:
    - `TABLE_ADD_ROW`, `TABLE_DEL_ROW`, `TABLE_ADD_COL`, `TABLE_DEL_COL`, `TABLE_SET_COL_WIDTH`
  - `PASTE` remapeaza `groupId`/`tableId` pentru clone curate
- AI alignment:
  - `WB_SYS` permite metadata de tabel
  - `normalizeAiNodes` + `applyParsed` pastreaza/remapeaza metadata cand e prezenta
- Validation:
  - `npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Miro-inspired visual expansion implementata in editor (`frontend/src/App.jsx`):
  - shape-uri noi: `triangle`, `hexagon`, `parallelogram`, `cloud`, `cylinder`
  - tool nou: `table` (insert rapid grid tabel)
  - context menu extins cu noile forme + table insert
  - template nou: `Cloud Architecture`
  - export PNG extins sa deseneze noile forme
- AI schema/front parser aliniate la noile forme:
  - `WB_SYS` actualizat cu shapeType noi
  - `normalizeAiNodes` foloseste `SHAPE_DEFAULTS` / `SHAPE_TYPES`
- Validation:
  - `npm run build` in `frontend/` -> PASS

## Previous update (2026-03-02)
- Fix reliability pentru Spider generation + warning-uri browser:
  - frontend:
    - wheel zoom/pan mutat pe native listener `passive:false` (nu pe `onWheel` React), pentru a elimina warning-ul:
      - `Unable to preventDefault inside passive event listener invocation`
    - parser AI intarit:
      - accepta direct obiect (`payload.json`)
      - normalizeaza raspunsuri cu smart quotes/trailing commas
      - normalizeaza noduri/arrows chiar daca modelul intoarce schema imperfecta (ex: string nodes / type necunoscut)
  - backend:
    - `/api/ai/complete` foloseste JSON mode la DeepSeek (cu fallback daca modelul nu suporta)
    - parse/repair server-side pentru JSON invalid
    - response include acum `json` (obiect validat), `text`, `repaired`, `model`, `usage`
- Deploy executat pe live dupa fixuri:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
  - smoke checks live PASS pe `board.private-driver.ro`

## Previous update (2026-03-02)
- Script de deploy automat creat si validat:
  - `ops/deploy_board.ps1`
  - acopera: build frontend -> upload frontend/backend -> `npm ci` remote -> restart service -> `nginx -t` + reload -> smoke checks locale/publice
  - comanda standard:
    - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1`
  - varianta fara rebuild:
    - `powershell -ExecutionPolicy Bypass -File ops\\deploy_board.ps1 -SkipBuild`
  - optiuni de siguranta:
    - `.env` NU se urca implicit (foloseste `-IncludeEnv` doar daca vrei overwrite remote env)
    - `boards.json` NU se urca implicit (foloseste `-UploadBoardsData` doar daca vrei overwrite date)
- Deploy live complet pe Hetzner pentru `board.private-driver.ro`:
  - app dir: `/var/www/board`
  - backend dir: `/var/www/board/backend`
  - frontend static: `/var/www/board/dist`
  - systemd service: `board-private-driver.service`
  - backend port intern: `8925`
  - nginx vhost: `/etc/nginx/sites-available/board.private-driver.ro`
  - SSL: Let's Encrypt activ (`/etc/letsencrypt/live/board.private-driver.ro`)
- Verificari live:
  - `https://board.private-driver.ro/` -> `200`
  - `http://board.private-driver.ro/` -> redirect `301` la HTTPS
  - `https://board.private-driver.ro/api/health` -> `200`
  - `https://board.private-driver.ro/api/ai/complete` -> `200` (DeepSeek)
  - `https://board.private-driver.ro/socket.io/?EIO=4&transport=polling` -> handshake OK

## Previous update (2026-03-02)
- Prompturi AI extinse semnificativ in `frontend/src/App.jsx`:
  - `WB_SYS`: framework universal pentru idei de produs/UX/engineering/business/workshops.
  - `SW_SYS`: mapping inteligent din fisiere in harti actionabile.
- `aiCall` marit la `maxTokens: 1400` pentru output-uri mai complexe.
- Parser AI harden:
  - fallback parsing din raspuns cu/fara code fences;
  - extragere obiect JSON dintre primul `{` si ultimul `}` daca e nevoie.

## Validation status
- `npm run test:connectors` in `frontend/` -> PASS
- `npm run build` in `frontend/` -> PASS
- endpointul DeepSeek backend functional local + live (`/api/ai/complete`)
- service live activ: `board-private-driver.service`

## Risks / technical debt
1. `frontend/src/App.jsx` ramane monolitic.
2. Rate limiting AI este in-memory (single instance), fara coordonare distribuita.
3. Prompturile AI sunt modularizate in frontend (`frontend/src/ai/*`), dar raman vizibile client-side (nu sunt mutate in backend/service).
4. Version history este stocat in acelasi `boards.json`; fara retention policy per tenant/workspace, fisierul poate creste.
5. Audit trail este file-based (`audit.json`) fara indexare/query avansat pentru analytics la scala mare.
6. Mobile usability este mult imbunatatita, dar lipsesc inca teste dedicate pe dispozitive reale (iOS Safari / Android Chrome).
7. GitHub OAuth foloseste access token storage criptat in file-store (`users.json`); lipseste inca secret vault dedicat/KMS la nivel enterprise.
8. Conflict handling GitHub este timestamp-based (nu exista inca merge semantic pe campuri per issue).
9. Idempotency/rate-limit sunt state in-memory/file-store local; lipseste coordonarea multi-instance.
10. Routing connectors ruleaza client-side pe fiecare rerender; pentru board-uri foarte mari e nevoie de cache/reroute workers.

## Next Steps (Exact)
1. Advanced Connectors v1.6: persist optional `waypoints` + connector `zIndex` explicit + line labels.
2. Advanced Connectors perf pass: obstacle/jump compute off-main-thread (worker) + incremental invalidation pentru board-uri mari.
3. Continua phase 1: Jira push MVP + Azure DevOps import/push pe aceeasi schema `execution*`.
4. Integrari critice pentru wedge: Slack/Teams + Confluence/Notion + GitHub/Jira/Azure deep links.
5. Enterprise + scale track: SSO/SCIM, compliance hooks, board virtualization, offline queue.
6. UI architecture debt: extrage keyboard engine din `Toolbar` intr-un hook dedicat, ca desktop tools sa nu mai depinda de toolbar ascuns.

## Latest update (2026-03-05) - Mobile Stability & Premium UX pass
- Mobile gesture engine hardening in `Canvas`:
  - long press 400ms, tolerance 10px
  - RAF drag updates on touch
  - pinch zoom always active
  - pointer-capture touch hooks
- Mobile mode safety integrated with `modeController`:
  - central mode mapping `navigate/select/add/connect`
  - auto-return after add -> navigate (with `Stay in add mode` toggle)
  - auto-return after connect -> select
- Android back behavior added (`popstate` guard):
  - close sheet -> close menus -> close overlays -> exit mode -> browser back.
- Mobile quick actions shipped:
  - duplicate / style / connect / delete above bottom bar when selection exists.
- Mobile connector long-press contextual actions enabled.
- Bottom sheet keyboard handling upgraded with `visualViewport` (sheet avoids keyboard).
- Validation:
  - `npm run build` PASS
  - `npm run test:connectors` PASS

## Latest update (2026-03-05) - Connector edit parity mobile/desktop
- Connector lines sunt acum selectabile robust in canvas (desktop + mobile) prin hit-area marita si pointer events active pe layer-ul SVG.
- Mobile are editor dedicat pentru connector in bottom sheet (routing/style/caps/jumps/default/delete).
- Desktop pastreaza popover-ul existent pentru editare rapida.
- Validation:
  - `npm run build` PASS
  - `npm run test:connectors` PASS

## Latest update (2026-03-05) - Mobile Creation Engine touch-first
- Radial Add Menu implementat pentru long-press canvas pe mobil (drag-to-select).
- Drag-to-connect extins cu:
  - handles touch-friendly
  - preview pointer RAF
  - drop empty canvas -> node + connector auto.
- Gestures mobile:
  - double tap canvas add node
  - double tap node edit text
  - two-finger swipe down/up undo/redo.
- Quick duplicate:
  - drag node + second finger touch -> clone + continue drag.
- Auto arrange mobil:
  - quick action + layout options (vertical/horizontal/grid).
- AI quick insert:
  - prompt field in mobile `More` sheet, insert structura direct pe canvas.
- Validation:
  - `npm run build` PASS
  - `npm run test:connectors` PASS

## Latest update (2026-03-05) - AI Thinking Engine v1 in editor UI
- Added context-aware AI copilot layer in frontend (no business logic/API contract changes).
- New `THINKING_SYS` prompt contract with multi-intent support:
  - board generation
  - flow generation
  - idea expansion
  - structure builder
  - decision helper
  - summary
- New hook: `frontend/src/hooks/useThinkingCopilot.js`
  - extracts limited board context (nodes/arrows/clusters/containers/selection/disconnected)
  - runs async AI actions per intent
  - stores structured preview before commit
  - computes proactive smart suggestions from board heuristics
- New UI: `frontend/src/components/AiThinkingPanel.jsx`
  - Ask input + examples
  - intent actions
  - suggestions chips
  - preview + explicit confirm insert
  - decision output (pros/cons/risks/recommendation)
- Integrated in `RightPanel` as collapsible `AI THINKING` section (desktop sidebar + mobile panel sheet).
- Validation:
  - `npm.cmd run build` in `frontend/` PASS

## Latest update (2026-03-05) - AI Spreadsheet Analysis v1 integrated in editor
- New spreadsheet AI stack (frontend-only, no unrelated business logic changes):
  - prompt contract:
    - `frontend/src/ai/prompts.js` -> `SHEET_ANALYSIS_SYS`
  - analysis utilities expanded:
    - `frontend/src/lib/spreadsheet/analysis.js`
      - insight-card builder
      - stronger NL query interpreter (incl. revenue/price/quantity patterns)
      - relationship suggestions with `formulaTemplate` payloads
  - new hook:
    - `frontend/src/hooks/useSpreadsheetAi.js`
      - async data extraction + AI call + card synthesis
      - chart generation (`bar/line/pie`)
      - KPI node creation
      - formula suggestion apply in active cell
  - new UI:
    - `frontend/src/components/SpreadsheetAiPanel.jsx`
    - wired in `RightPanel` (desktop sidebar + mobile panel sheet)
- Runtime integrations:
  - anomaly highlight in grid:
    - `SpreadsheetNode` receives `anomalyMap` and colors abnormal cells by severity.
  - KPI auto-refresh:
    - `InnerApp` recalculates all nodes with `kpiBinding` whenever sheet data changes.
- Validation:
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `npm.cmd run build` PASS
- Deploy:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` PASS
  - `PUBLIC_HEALTH: ok`

## Latest update (2026-03-05) - Data Flow Engine v1 integrated (node pipelines + dependency graph + transform nodes)
- New dataflow runtime + hook:
  - `frontend/src/lib/dataflow/engine.js`
  - `frontend/src/hooks/useDataFlowEngine.js`
  - detectie conectori de date (`flowType:"data"`), dependency graph, topological recompute, cycle prevention.
- Node data interface livrata prin evaluatori unificati:
  - `sheet` -> table output
  - `transform` -> `sum/average/filter/group`
  - `chart` -> chart-ready rows + summary
  - `kpi` -> numeric value + binding text updates
- UI integration:
  - `frontend/src/App.jsx`:
    - engine async non-blocking conectat in `InnerApp`
    - conectori de date stilizati distinct + badge + error state
    - preview de date in editorul de connector (summary/columns/sample)
    - tool nou `transform` (shortcut `2`) + context action `Add Transform`.
- Alignment Spreadsheet AI outputs:
  - `frontend/src/lib/spreadsheet/analysis.js`
  - `frontend/src/hooks/useSpreadsheetAi.js`
  - chart/kpi generation folosesc noduri first-class + conectori `flowType:"data"`.
- Validation:
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
  - `npm.cmd run build` PASS
- Deploy:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1` PASS
  - `PUBLIC_HEALTH: ok`

## Latest update (2026-03-05) - Premium UX polish v1 (consistency + onboarding + empty states + interaction feel)
- Design system tokens extinse:
  - `frontend/src/styles/tokens.js`
  - semantic colors (`background/surface/primary/text/border`)
  - spacing scale (`4/8/12/16/24/32`)
  - radius scale (`6/10/16`)
  - motion tokens (`120/160/180ms`) + easing + shared shadows.
- Global UI polish layer:
  - `frontend/src/App.jsx` (CSS global)
  - transitions coerente pentru controls
  - hover/press micro-interactions
  - node selection clarity via `data-selected`
  - connector micro-polish + snap pulse animation.
- First-minute activation:
  - onboarding overlay in editor (`boardai_editor_onboarding_v2`)
  - quick start presets:
    - Brainstorm
    - Product roadmap
    - Startup planning
    - Meeting notes
  - empty board prompt cu:
    - `Generate board with AI`
    - `Add template`
    - `Start brainstorming`.
- Panel/mobile polish:
  - `RightPanel` spacing hierarchy pass.
  - `MobileBottomSheet` touch target and handle visibility improvements.
- Dashboard perceived-performance pass:
  - skeleton loading list
  - actionable empty-state suggestions.
- Validation:
  - `npm.cmd run build` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd run test:connectors` PASS
- Deploy:
  - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild` PASS
  - `PUBLIC_HEALTH: ok`

## Next Steps (Exact)
1. Premium UX v1.1: extrage `TopBar`/`Dashboard` control styles in reusable UI primitives (`ui-btn`, `ui-card`, section headers) pentru reducere noise vizual.
2. Premium UX v1.1: onboarding guided stepper (highlight canvas actions) + analytics hooks pentru activation under 60s.
3. Data Flow Engine v1.1: adauga transform editor complet (`SUM/AVERAGE/FILTER/GROUP` params + schema hints) in panel.
4. Data Flow Engine perf pass: incremental recompute pe changed subgraph + throttled preview generation pentru board-uri mari.
5. Spreadsheet AI v1.1: add column picker for NL query target disambiguation + answer provenance (`sheet/column`) in UI.
6. Collaboration phase 1 polish: optimistic dedupe for local `board:activity` echo + filters (`entity`, `actor`, `type`).

## Latest update (2026-03-05) - Editor layout reorganized (left rail + global top bar + context inspector)
- `RightToolPanel` desktop a fost convertit in rail icon-only pe stanga (tool-uri rapide: select/pan/connector/text/sticky/shape/container/image/spreadsheet/chart).
- `TopBar` desktop a fost reorganizat pe actiuni globale: undo/redo, zoom controls, fit, search, templates, share/collaborators, export.
- context menus refacute pe grupuri scurte:
  - canvas: Add Node / Add Container / Add Sticky-Text-Spreadsheet / AI Generate Board / Paste-Import / View / Board
  - node: Edit / Duplicate / Delete / Convert / Add Connection
  - connector: Change routing / Change style / Add label / Delete
- conectori:
  - hover highlight mai clar
  - puncte de control vizibile la selectie
- `RightPanel` devine context-aware:
  - `Board settings` cand nimic selectat
  - `Node properties` cand node selectat
  - `Spreadsheet panel` cand sheet selectat
  - `Connector properties` cand connector selectat (routing/style/label/delete)
- verificari:
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run build` PASS

## Latest update (2026-03-05) - High-speed canvas interactions v2
- quick add implementation:
  - hover/select node -> edge `+` actions (desktop 4 directions, mobile contextual single action).
  - creates connected node instantly via existing connector defaults.
- smart connect:
  - during node drag, nearby node detection emits connector suggestion preview.
  - inline `Connect` action builds routed connector with port anchors.
- inline text edit behavior hardened:
  - `Enter` confirm, `Esc` cancel, blur commit guard in `ET`.
- connector selection model upgraded:
  - shift+click connector toggle.
  - lasso now includes connectors + nodes.
  - selected connectors highlighted and deletable via keyboard when no node selection.
- multi-selection quick layout:
  - `AlignPanel` now includes `Vertical`, `Horizontal`, `Grid` actions.
- power shortcuts:
  - `N` new node at viewport center.
  - `C` connector tool.
  - guarded against text-input/contenteditable targets.
- mobile inline edit:
  - node double-tap opens bottom-sheet editor (`mobileInlineEdit`).
- validation:
  - `npm.cmd run build` (frontend) PASS
  - `npm.cmd run test:connectors` PASS
  - `npm.cmd run test:dataflow` PASS
  - `npm.cmd run test:spreadsheet` PASS
  - `npm.cmd test` (backend) PASS

## Latest update (2026-03-05) - Runtime hotfix for production editor crash
- fixed `Cannot access 'cl' before initialization` in Canvas:
  - moved connector snap FX callback declaration above first usage.
- fixed `ReferenceError: px is not defined` in Toolbar:
  - added `px/py` destructuring from board state.
- validation:
  - `npm.cmd run build` (frontend) PASS

## Next Steps (Exact)
1. Add optional smart-connect auto-accept toggle (off by default) for fast flow mapping.
2. Extend lasso connector hit-testing to segment-level intersection (current version uses midpoint + route bbox).
3. Add connector labels quick-edit on single click (currently double-click/edit via label capsule).
4. Add onboarding tooltip hints for `N` / `C` / edge `+` quick add interactions.
