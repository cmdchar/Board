# BRAINMAP - BoardAI

## 1) Frontend routes
- `/?board=<id>` -> editor whiteboard
- `/?board=<id>&focus=<nodeId>` -> editor + auto focus/pan pe node
- fara query `board` -> board selector

## 1.1) Execution Intelligence UI flow (frontend-only)
1. `RightPanel` include sectiune `EXECUTION` care foloseste `useExecutionIntelligence`.
2. Hook-ul derivă snapshot din `s.nodes/s.arrows`:
   - `tasks`, `milestones`, `decisions`, `risks`, `dependencies`
   - `warnings` + `healthScore`.
3. `ExecutionPanel` expune actiuni:
   - add: `Task`, `Milestone`, `Decision`
   - update task status/due + attach GitHub/Jira links
   - meeting notes -> AI autopilot -> `APPLY` nodes/arrows.
4. Timeline:
   - `ExecutionTimelineOverlay` (toggle din TopBar/RightPanel/More mobile)
   - drag task intre zile -> `updateTaskDueDate`.
5. Focus:
   - warnings/task clicks selecteaza node-ul pe canvas (`SEL`) si pot centra viewport prin query `focus`.

## 1.2) Project Vault UI flow
1. `RightPanel` include sectiune `PROJECT VAULT` (desktop + mobile panel sheet).
2. `VaultPanel` foloseste API-uri `vaultApi` pentru:
   - listare proiecte
   - listare/filter records
   - creare proiect
   - creare record
   - reveal secret
   - preview subscriptions due.
3. Datele vault sunt separate de board data (`vault.sqlite`), fara impact pe schema `board.data`.

## 2) Backend REST map
- `GET /api/boards`
- `GET /api/boards/:id`
- `GET /api/boards/:id/history`
- `GET /api/boards/:id/history/:versionId`
- `POST /api/boards/:id/history/:versionId/restore`
- `GET /api/boards/:id/members`
- `PUT /api/boards/:id/members`
- `DELETE /api/boards/:id/members/:userId`
- `GET /api/boards/:id/audit`
- `GET /api/boards/:id/semantic`
- `POST /api/boards/:id/semantic/rebuild`
- `POST /api/boards/:id/integrations/jira/import`
- `POST /api/boards/:id/integrations/github/import`
- `POST /api/boards/:id/integrations/github/push`
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
- `GET /api/integrations/github/oauth/start`
- `GET /api/integrations/github/oauth/callback`
- `GET /api/integrations/github/oauth/status`
- `DELETE /api/integrations/github/oauth/status`
- `POST /api/boards`
- `PUT /api/boards/:id`
- `DELETE /api/boards/:id`
- `POST /api/ai/complete`
  - DeepSeek proxy endpoint
  - request: `{ systemPrompt, userPrompt, maxTokens }`
  - response:
    - normal: `{ text, json, repaired, model, usage }`
    - fallback mode (provider fail/timeout/invalid JSON): `{ text, json, repaired:false, model:"fallback-local", usage:null, fallback:true, fallback_reason }`
- `GET /api/vault/projects`
- `POST /api/vault/projects`
- `PUT /api/vault/projects/:id`
- `POST /api/vault/ingest`
- `GET /api/vault/records`
- `GET /api/vault/records/:id`
- `POST /api/vault/records`
- `PUT /api/vault/records/:id`
- `POST /api/vault/records/:id/reveal`
- `GET /api/vault/subscriptions`
- `GET /api/vault/summary`
- `GET /api/health`

## 2.9) Board revision control (P0)
1. Board-urile au camp `revision` (numeric, >=1).
2. `GET /api/boards` si `GET /api/boards/:id` expun `revision`.
3. `PUT /api/boards/:id` cu `data` cere expected revision:
   - body: `revision` (preferat)
   - fallback: `x-board-revision` / `if-match-revision`.
4. Raspunsuri conflict:
   - `428` daca revision lipseste pentru update `data`
   - `409` daca revision este stale (`current_revision` returnat)
5. La update valid, backend incrementeaza `revision` si intoarce noua valoare.

## 2.1) Version history flow
1. La create board se salveaza snapshot initial (`reason: "create"`).
2. La `PUT /api/boards/:id` cu `data`, backend captureaza snapshot (`reason: "save"`):
   - dedupe pe hash
   - rolling update in interval scurt (nu explodeaza numarul de versiuni)
3. `GET /api/boards/:id/history` returneaza metadata versiunilor.
4. `GET /api/boards/:id/history/:versionId` returneaza snapshot-ul complet.
5. `POST /api/boards/:id/history/:versionId/restore` restaureaza snapshot si captureaza o noua versiune (`reason: restore:*`).

## 2.2) Frontend history UX flow
1. `RightPanel` include `VersionHistoryPanel` (colapsabil).
2. On open / refresh:
   - frontend cere `GET /api/boards/:id/history`.
3. On select version:
   - frontend cere `GET /api/boards/:id/history/:versionId` pentru preview counts.
4. On restore:
   - UX cu confirmare in 2 pasi in panel.
   - frontend cere `POST /api/boards/:id/history/:versionId/restore`.
   - snapshot-ul restaurat este aplicat in reducer (`LOAD`), apoi intra in fluxul normal de sync/autosave.

## 2.3) RBAC & sharing flow
1. `POST /api/boards` cere auth si seteaza owner (`userId`) + `members[]`.
2. Roluri suportate:
   - `owner`: manage/edit/read
   - `editor`: edit/read
   - `viewer`: read
3. Access checks:
   - list/get/history -> read
   - save/restore -> edit
   - delete + members management -> owner
4. Sharing endpoints:
   - `PUT /api/boards/:id/members` (owner adauga/actualizeaza membru by email)
   - `DELETE /api/boards/:id/members/:userId` (owner elimina membru)
   - `GET /api/boards/:id/members` (owner vede member list)
5. Frontend:
   - `BoardAccessPanel` in `RightPanel` pentru grant/revoke acces.

## 2.4) Audit trail flow
1. Backend scrie evenimente in `backend/data/audit.json` prin `appendAuditEvent(...)`.
2. Evenimente capturate:
   - lifecycle board: create/rename/save/restore/delete
   - membership: add/role-change/remove
3. UI/API consumers citesc:
   - `GET /api/boards/:id/audit?limit=<n>&action=<event>&actorId=<id>&min_ts=<unix>` (read access required).
4. Response audit include actor enrichment:
   - `actor: { id, name, email, color }` cand `actorId` exista in `users.json`.

## 2.5) Semantic layer flow (v1)
1. Board JSON ramane sursa de adevar (`boards.json`).
2. Layer paralel (SQLite `semantic.sqlite`) persista:
   - `semantic_entities`
   - `semantic_relations`
   - `board_health_snapshot`
3. Rebuild semantic:
   - async/debounced la `board.save/create/restore`
   - sync on-demand la `POST /api/boards/:id/semantic/rebuild`
4. Extractor deterministic:
   - `extractSemantic(boardJson)` -> `entities[]`, `relations[]`
5. Health engine deterministic:
   - `computeHealth(entities, relations)` -> `healthScore`, `issues[]`
6. API read:
   - `GET /api/boards/:id/semantic`
   - returneaza `entities`, `relations`, `health` + pagination
7. Observability:
   - `/api/health` include metrics `semantic.*` (queued/started/completed/failed/latency)

## 2.6) Template marketplace flow (v1)
1. Template store:
   - `backend/data/templates.json`
   - normalize + defaults + seed templates.
2. Listing:
   - `GET /api/templates` suportă:
     - `scope` (`marketplace|mine|bookmarked`)
     - `q`, `category`, `sort`, `page`, `pageSize`.
3. Details/preview:
   - `GET /api/templates/:id` -> metadata + versions list.
   - `GET /api/templates/:id/preview?version=...` -> lightweight board snapshot.
4. Authoring:
   - `POST /api/templates` (din board curent sau payload `data`).
   - `PUT /api/templates/:id/publish` (private/public).
   - `POST /api/templates/:id/version` (new version din board/data).
5. Engagement:
   - `POST /api/templates/:id/bookmark`
   - `POST /api/templates/:id/rate`
6. Consumption:
   - `POST /api/templates/:id/use` -> creează board nou din template version.
7. Frontend:
   - `TemplateMarketplacePanel` în editor (desktop overlay + mobile sheet-style panel):
     - browse/search/filter/sort/pagination
     - create board from template
     - save current board as template
     - publish/version actions pentru autor
     - bookmark/rate
     - AI template generation (`/api/ai/complete`) + save/insert.

## 3) Canvas primitives & tools
- State domain este centralizat in:
  - `frontend/src/state/boardState.js` prin `createBoardState(...)`
  - include reducer + constants + template registry (`TPLS`)
- Node types suportate:
  - `sticky`, `shape`, `text`, `image`, `frame`, `lane`, `sheet`, `deck`, `transform`, `chart`, `kpi`
- Shape library (`shapeType`):
  - `rect`, `circle`, `diamond`, `triangle`, `hexagon`, `parallelogram`, `cloud`, `cylinder`
- Table insert:
  - tool `table` (shortcut `B`) -> insereaza node `sheet` (spreadsheet real)
  - tool `sheet` (shortcut `N`) -> insereaza explicit node `sheet`
  - tool `deck` (shortcut `O`) -> insereaza node `deck` (slides container)
  - legacy:
    - `makeTablePack(...)` exista pentru board-uri vechi (`tableId/tableRole`)
    - `PropsPanel` pastreaza controalele legacy pentru aceste noduri
- Spreadsheet (`sheet`) flow:
  - editor grid + formula bar direct in `SpreadsheetNode`
  - engine centralizat:
    - `frontend/src/lib/spreadsheet/engine.js`
    - evaluare cross-sheet pe tot board-ul (nu doar local pe node)
  - formule suportate:
    - referinte `A1`
    - range `A1:B5`
    - cross-sheet:
      - `SheetName!B2`
      - `sheet("Prices").B2`
      - `SheetTable!Price[A]`
    - functii `SUM/AVG/MIN/MAX/COUNT`
  - dependency graph:
    - dependencies + dependents la nivel de celula
    - agregare data-flow la nivel de spreadsheet (`fromSheet -> toSheet`)
  - UI flow:
    - cand formula este activa (`=`), click pe celule din alte spreadsheet-uri insereaza automat referinta
    - sheet-urile referite sunt highlight-uite vizual
    - header sheet afiseaza statistici `out/in` pentru data flow
    - conectorii intre sheet-uri compatibili cu dependentele sunt marcati `data flow`
  - runtime checks:
    - detectie ciclu (`#CYCLE!`)
    - referinta invalida (`#REF!`)
    - formula error fallback (`#ERR`)
- Data Flow Engine (`data connectors`) flow:
  - runtime central:
    - `frontend/src/lib/dataflow/engine.js`
    - `frontend/src/hooks/useDataFlowEngine.js`
  - node interface standardizat:
    - `sheet` output: tabel (columns/rows/sample)
    - `transform` output: number/table/grouped (`sum|average|filter|group`)
    - `chart` consume table si expune rows+summary
    - `kpi` consuma table/number si expune valoare numerica
  - graful de dependente:
    - build `incoming/outgoing` pe conectori `flowType:"data"`
    - cycle detection + blocare update pentru subgraf ciclic
    - recompute topologic incremental doar pe nodurile afectate
  - live updates:
    - la schimbare sheet, se recalculeaza doar downstream (`transform/chart/kpi`)
    - update patch-uit prin `UPD_MULTI` doar pe deltas (fara full board recompute)
  - data preview:
    - selectie connector afiseaza summary + columns + sample rows/value
    - incompatibilitatile de tip apar in `connectorErrorsById` si sunt randate vizual.
- Slides (`deck`) flow:
  - editor slide-by-slide in `DeckNode`
  - operatii:
    - prev/next
    - add/delete slide
    - editare titlu/body per slide
  - target tastatura configurabil:
    - `deckInputTarget` (`title` | `body`)
  - keyboard context (cand node-ul `deck` este selectat):
    - `ArrowLeft/ArrowRight` = navigare slide
    - typing/backspace/delete = editare camp activ (`title` sau `body`)
    - `Enter`:
      - in `title` muta target-ul pe `body`
      - in `body` insereaza newline
- Prompt AI (`WB_SYS`) este aliniat la noile shape types.
- Productivity controls:
  - `TIDY` (auto-layout) pentru selectie
  - `WRAP_FRAME` (incadrare selectie)
  - mind-map shortcuts:
    - `Tab` -> child sticky + connector
    - `Enter` -> sibling

## 3.1) Connector flow (Advanced Connectors v1)
1. Connector data model (backward-compatible in `data.arrows[]`):
   - legacy:
     - `fromId`, `toId`
   - nou:
     - `from: { entityId, anchor }`
     - `to: { entityId, anchor }`
     - `routing: straight|ortho|curved|wavy`
     - `flowType: data|relation` (optional; inferat cand lipseste)
     - `style: { stroke, width, dash, startCap, endCap, cornerRadius, waveAmplitude, waveLength }`
2. Ports:
   - 4 ports derivate per node (`top/right/bottom/left`, normalized 0..1).
   - vizibile pe hover/selection.
3. Connect interaction:
   - mousedown pe port -> `portConnect` state
   - mousemove -> nearest target port highlight (magnetism)
   - mouseup -> `ADD_ARR` cu ancore `type:"port"` + style/routing defaults
   - `Esc` -> cancel connect flow.
4. Rendering pipeline:
   - normalize endpoints (`from/to` fallback la `fromId/toId`)
   - world anchor resolve (`port`/`pos`)
   - routing:
     - `straight` direct
     - `ortho` via A* + obstacles (container rects inflated)
     - `curved` bezier
     - `wavy` sinus peste polyline ortho
   - hit area transparent path + visible path cu markers/caps.
5. Connector UX:
   - click connector -> inspector style/routing.
   - right-click connector -> context menu cu routing/style/reverse/delete.

## 3.2) Editor layout flow (desktop/mobile)
1. Desktop editor (`InnerApp`):
   - `Canvas` ramane layer principal.
   - `RightPanel` ramane docked in dreapta (properties/AI/access/history/audit/execution sync).
   - `RightToolPanel` este panel flotant pentru unelte de creatie, ancorat pe stanga (`side="left"`).
   - panelul include acum sectiune `Navigation` cu:
     - `Select` (`V / Esc`)
     - `Pan` (`H / Space`)
   - `TopBar` include toggle global de tema (`dark/light`).
   - panelul are toggle `Hide Tools / Show Tools` prin state-ul `toolsPanelOpen`.
   - `Toolbar` legacy este montat cu `hidden=true` pentru a pastra shortcut engine-ul global.
2. Mobile editor:
   - `Toolbar` legacy este desktop-only (mobilul nu il mai afiseaza).
   - shell mobil unificat:
     - `MobileBottomBar` cu actiuni primare:
       - mode (`Pan/Select`)
       - `Add`
       - `Connect`
       - `Undo`
       - `Panel`
       - `More`
       - `Done` (cand e add/connect mode)
     - `MobileBottomSheet` cu snap points:
       - `insert` -> `RightToolPanel` embedded
       - `panel` -> `RightPanel` in `fill` mode
       - `more` -> actiuni secundare (search/templates/theme/grid/fit)
   - state UI unificat:
     - `mobileSheet = "" | "insert" | "panel" | "more"`
  - default mode pe mobil la intrare in editor:
    - `tool = "pan"` (navigate-first).

## 3.2.1) First-minute UX flow (onboarding + empty-state)
1. Editor onboarding overlay:
   - trigger:
     - board gol (`nodes.length === 0`)
     - first-run key `localStorage["boardai_editor_onboarding_v2"] !== "done"`.
   - UI:
     - quick presets (`Brainstorm`, `Product roadmap`, `Startup planning`, `Meeting notes`)
     - AI prompt + `Generate board with AI`
     - `Add template` shortcut.
2. Empty board state (desktop):
   - cand onboarding e inchis, boardul gol afiseaza card central cu:
     - sugestie AI
     - CTA-uri: `Generate board with AI`, `Add template`, `Start brainstorming`.
3. Quick insert flow:
   - preset/AI -> graph temporar -> remap ID-uri -> inserare centrata in world coords -> optional `TIDY`.
   - dupa prima insertie se marcheaza onboarding ca `done`.
4. Delight interaction:
   - port-to-port connector create declanseaza snap pulse animation in canvas.

## 3.3) Theme flow (global)
1. Theme mode global este gestionat in `App`:
   - state: `themeMode` (`dark` | `light`)
2. Persistare:
   - `localStorage["boardai_theme_mode"]`
3. Aplicare:
   - `applyUiTheme(themeMode)` scrie CSS vars `--ui-*` pe `document.documentElement`.
4. Token-uri:
   - toate componentele bazate pe `T` (`UI_TOKENS`) citesc `var(--ui-...)`.
   - `RightToolPanel` foloseste `TOOL_PANEL_TOKENS` legat la aceleasi variabile.
5. Puncte de control UI:
   - Landing header
   - Dashboard header
   - Editor TopBar

## 3.4) Tool mode state flow
1. State extins in reducer:
   - `tool`
   - `lastNonAddTool`
   - `autoReturnToSelect` (default `true`)
2. Actione principale:
   - `TOOL` (seteaza tool activ)
   - `EXIT_ADD_MODE` (forteaza `select`)
   - `TOGGLE_AUTO_RETURN_TO_SELECT`
3. Escape/reset:
   - `Esc` in editor ruleaza `EXIT_ADD_MODE`
   - click pe `Select` in toolbar/panel ruleaza `EXIT_ADD_MODE`
4. Auto return:
   - dupa `ADD`, daca `autoReturnToSelect=true` si tool-ul este de insert, reducerul revine la `select`.
5. Pan temporar:
   - `Space` keydown comuta temporar pe `pan`
   - `Space` keyup revine la tool-ul anterior.

## 3.5) Dashboard execution health flow
1. Dashboard cere semantic summary pentru board-ul recent:
   - `GET /api/boards/:id/semantic?issueLimit=3`
2. Cardul `Execution Health` afiseaza:
   - `healthScore`
   - top 3 issues
3. `Details` deschide drawer cu issue list grupata.
4. Click pe issue:
   - deschide board-ul cu query `focus=<sourceNodeId>`
5. In `InnerApp`, la load:
   - focus query -> `SEL` + `PAN` pe node
   - query `focus` este consumat si eliminat din URL.

## 3.6) Mobile touch input flow
1. `Canvas` foloseste controller dedicat:
   - `createInputController(...)` (`frontend/src/lib/input/inputController.js`)
   - responsabil de:
     - long-press timer
     - move tolerance (cancel long-press la drag)
2. Touch gestures:
   - 1 finger:
     - in `pan` mode -> pan canvas (inclusiv cand gesture incepe pe node)
     - in `select` mode -> select + press-drag move element
   - 2 fingers:
     - pinch zoom + pan pivot
3. Long-press contextual:
   - pe canvas/node -> `openContextMenuAt(..., mobile=true)`
   - render in `MobileBottomSheet` (grupat pe sectiuni din `buildContextMenu(ctx)`).
4. Exit safety:
   - `Esc` (desktop keyboard) si buton `Done` pe mobil inchid add/connect mode prin `EXIT_ADD_MODE`.

## 4) Socket.IO event map
### Client -> Server
- `board:join`
- `board:leave`
- `board:sync`
- `cursor:move`
- `presence:update`
- `board:activity`

### Server -> Client
- `board:update`
- `users:init`
- `user:joined`
- `user:left`
- `cursor:update`
- `cursor:leave`
- `user:presence`
- `board:activity`
- `board:joined`
- `board:join:error`
- `board:sync:error`

### Realtime authorization
- `board:join`:
  - valideaza board-ul + `canReadBoard`.
  - seteaza cache access per socket (`socketBoardAccess`: `canRead/canEdit`) pentru board-ul curent.
- `board:sync`:
  - permis doar pentru roluri cu edit (`owner/editor`) din cache-ul setat la join.
- `cursor:move`:
  - permis doar pentru user cu acces read din cache-ul setat la join.
- `presence:update` / `board:activity`:
  - permis doar pentru acces read din cache-ul de join.
- note perf:
  - evenimentele realtime frecvente nu mai citesc `boards.json` per event; autorizarea hot-path ruleaza in memorie dupa validarea de la `board:join`.
  - store-ul board este in-memory; `writeDB` persista async pe disk (queue), evitand blocaje sync I/O in path-urile realtime.

## 5) AI flow (current)
1. User introduce prompt in `RightPanel`.
   - componenta UI: `frontend/src/components/RightPanel.jsx`
   - state/actions AI: `frontend/src/hooks/useRightPanelAi.js`
2. Frontend trimite prompt + system prompt (`WB_SYS`/`SW_SYS`) la `/api/ai/complete`.
   - prompturile sunt definite in `frontend/src/ai/prompts.js`
3. Backend apeleaza DeepSeek in JSON mode (cu fallback daca modelul nu suporta) si valideaza/repair JSON.
4. Frontend foloseste prioritar `payload.json` (daca exista), altfel parse fallback pe `text`.
   - parse helper: `parseAiJson` din `frontend/src/ai/helpers.js`
5. `applyParsed` normalizeaza noduri/arrows ca sa evite crash la schema partiala.
6. Normalizarea shape-urilor foloseste `SHAPE_TYPES` + `SHAPE_DEFAULTS` (include cloud/cylinder/etc.).
7. Canvas aplica noduri + arrows.

## 5.1) AI endpoint guardrails
1. `POST /api/ai/complete` are rate-limit per client:
   - config: `AI_RATE_WINDOW_SEC`, `AI_RATE_MAX`.
2. Metrics runtime sunt expuse in `GET /api/health`:
   - requests/success/errors/repaired/rate_limited
   - last_error/last_model/last_usage/last_latency_ms

## 5.2) Execution planner flow (v1 hardened)
1. User deschide sectiunea `EXECUTION PLAN` in `RightPanel`.
2. User adauga context (PRD/repo/issues) + optional `replace canvas`.
3. Frontend foloseste prompt dedicat `EXEC_SYS` si apeleaza `/api/ai/complete`.
4. `EXEC_SYS` cere JSON strict pe schema:
   - `objectives[]`
   - `milestones[]`
   - `tasks[]` cu campuri obligatorii (`stage/owner/priority/status/dueDate/milestoneId`)
   - `risks[]`
5. Hook-ul `useRightPanelAi` ruleaza pipeline dedicat:
   - `normalizeExecutionPlan(...)`
   - `applyExecutionPlan(...)`
6. Renderer-ul execution construieste deterministic:
   - lanes `NOW/NEXT/LATER`
   - task cards cu metadata `execution*`
   - milestones/risk panels + arrows de tip `depends on`, `milestone`, `risk`
7. Metadata `execution*` ramane pe noduri pentru pasul urmator de sync bidirectional cu Jira/GitHub/Azure.

## 5.3) GitHub sync flow (hardened)
1. Din `EXECUTION PLAN`, user seteaza:
   - `repo` (`owner/repo`)
   - auth prin OAuth (`Connect GitHub`) sau fallback env token
   - issue state (`open/all/closed`) pentru import
   - `incremental import` toggle
   - `conflict strategy` pentru push
2. `Import -> Board`:
   - frontend -> `POST /api/boards/:id/integrations/github/import`
   - payload support:
     - `incremental` (default true)
     - `since` (optional)
     - `idempotencyKey` (optional, trimis de frontend)
   - backend transforma issues in plan execution structurat
   - backend parseaza dependinte issue mai robust:
     - URL issue
     - `owner/repo#123`
     - `issue #123` / `/issues/123`
     - linii `depends-on:/blocked-by:/requires:`
   - in incremental mode:
     - foloseste `since` din sync state per repo
     - face merge delta cu task-urile execution deja existente pe board pentru acelasi repo
   - idempotency:
     - replay pentru key deja procesat
     - `409` daca acelasi key e in curs (`pending`)
   - frontend aplica planul prin `applyExecutionPlan(...)`
3. `Push Board -> Issues`:
   - frontend extrage task-uri execution din noduri (`extractExecutionTasksForSync`)
   - frontend -> `POST /api/boards/:id/integrations/github/push`
   - payload include `idempotencyKey` (optional)
   - backend face upsert issues (`create`/`update` dupa `issueNumber`)
   - backend reconciliaza milestone-urile din task cards:
     - creeaza milestone-uri lipsa
     - update `state` (`open/closed`) + `due_on`
   - backend aplica conflict strategy:
     - `skip_remote_newer`
     - `prefer_board`
     - `prefer_remote`
   - conflict check:
     - compara `issue.updated_at` remote cu metadata locala (`issueUpdatedAt`/`lastSyncedAt`)
   - response include:
     - `milestones: { desired, matched, created, updated }`
     - `idempotency` info (`key`, `replayed`)
   - frontend actualizeaza metadata pe noduri:
     - `executionIssueNumber`
     - `executionIssueUrl`
     - `executionIssueState`
     - `executionIssueUpdatedAt`
     - `executionLastSyncedAt`
     - `executionRepo`
4. Audit:
   - import: `board.github.import`
   - push: `board.github.push`
5. Sync state persistat in `board.integrations.github[repoKey]`:
   - `last_import_*`
   - `last_push_*`
   - `last_issue_updated_at`
   - `last_conflicts`, `last_conflict_strategy`
6. Reliability:
   - call-urile GitHub folosesc retry/backoff cu jitter + suport `Retry-After`
   - idempotency cache per board in:
     - `board.integrations.github_idempotency`

## 5.4) GitHub OAuth flow (phase 3)
1. Frontend cere status:
   - `GET /api/integrations/github/oauth/status`
   - endpoint-ul este `optAuth`:
     - cu user autenticat -> status complet (`connected/account/source`)
     - fara user/token valid -> status `connected:false` (fara 401 hard fail)
2. User initiaza conectarea:
   - `GET /api/integrations/github/oauth/start`
   - backend returneaza authorize URL cu state semnat
3. GitHub redirect:
   - `GET /api/integrations/github/oauth/callback`
   - backend schimba `code` pe access token, citeste `/user`, salveaza token criptat per user
4. Callback popup:
   - trimite `postMessage` catre opener (`type: boardai:github-oauth`)
   - frontend refresheaza status OAuth
5. Deconectare:
   - `DELETE /api/integrations/github/oauth/status`
6. Token lookup pentru import/push:
   - request/header -> user vault token -> `GITHUB_TOKEN` env fallback

## 5.5) Jira import flow (phase 1 start)
1. User completeaza in `EXECUTION PLAN`:
   - `site` (`https://company.atlassian.net`)
   - `project key` (optional daca foloseste jql custom ulterior)
   - `jiraEmail` + `jiraToken` (optional daca exista env fallback pe server)
   - state filter (`open/all/closed`)
2. Frontend cheama:
   - `POST /api/boards/:id/integrations/jira/import`
3. Backend:
   - autentifica request-ul Jira (basic auth sau bearer fallback)
   - ruleaza Jira search (`/rest/api/3/search/jql`)
   - mapeaza issues -> plan execution (`milestones/tasks/risks`)
   - mapeaza `fixVersions` -> milestones
   - mapeaza `issuelinks` -> dependsOn
4. Frontend aplica planul prin `applyExecutionPlan(...)`.
5. Backend persista sync state:
   - `board.integrations.jira[site::project]`
6. Audit:
   - `board.jira.import`

## 6) File upload AI flow
1. User incarca fisier in `FileZone`.
   - componenta UI: `frontend/src/components/FileZone.jsx`
   - este folosita direct in `RightPanel`.
2. Frontend ruleaza planner (`SW_PLAN_SYS`) pentru recomandare template:
   - `recommendedTemplate`, `alternatives`, `complexity`, `needsTable`.
3. UI afiseaza card de selectie template in RightPanel.
4. Dupa alegere explicita template, frontend ruleaza generator (`SW_SYS`) cu `Template ales: ...`.
5. Daca `needsTable=true`, generatorul este ghidat sa foloseasca structura tabelara.

## 7) Table editing flow
### 7.1) Spreadsheet node flow (`type: "sheet"`)
1. Inserezi `sheet` din toolbar (`B`/`N`) sau templates (`table`/`spreadsheet`).
2. Selectezi celula in grid si editezi continutul direct in celula sau in formula bar.
3. Daca textul incepe cu `=`, evaluatorul ruleaza formula:
   - referinte/range/functii (`SUM/AVG/MIN/MAX/COUNT`).
4. Containerul permite `+/- rows` si `+/- cols` in header-ul node-ului.
5. Cand `sheet` este selectat si focusul nu este intr-un input:
   - `Arrow`/`Tab`/`Enter` navigheaza celula activa in interiorul tabelului.
   - typing scrie direct in celula activa.

### 7.2) Legacy table metadata flow (`tableId/*`)
1. Selectezi un nod din tabel.
2. `PropsPanel` detecteaza `tableId` si afiseaza controale tabel.
   - componenta UI: `frontend/src/components/PropsPanel.jsx`
3. Actiunile dispatcheaza reducer events:
   - `TABLE_ADD_ROW`, `TABLE_DEL_ROW`, `TABLE_ADD_COL`, `TABLE_DEL_COL`, `TABLE_SET_COL_WIDTH`.
4. Reducerul modifica nodurile asociate tabelului pastrand istoricul undo/redo.

## 8) Quick interaction map
- Toolbar:
  - Tidy = auto-layout selectie
  - Wrap Frame = incadrare selectie in frame
- RightToolPanel (desktop):
  - categorii colapsabile: Board Elements, Media, Structure, Interaction
  - quick actions: undo, redo, snap, dep mode
- Mobile shell:
  - Bottom bar:
    - `Pan/Select`
    - `Add`
    - `Connect`
    - `Undo`
    - `Panel`
    - `More`
  - Bottom sheets:
    - `insert` (tools)
    - `panel` (inspector/AI/history)
    - `more` (secondary commands)
- Keyboard:
  - `Esc` = reset global add mode -> `Select`
  - `V` = Select
  - `H` = Pan
  - `Space hold` = Pan temporar
  - Ctrl+Shift+L = tidy selectie
  - N = sheet container
  - O = deck container
  - Tab (1 selectie) = add child
  - Enter (1 selectie) = add sibling
  - Cand focusul este pe `sheet`:
    - Arrow/Tab/Enter = navigare celule
    - typing = editare celula activa
  - Cand focusul este pe `deck`:
    - ArrowLeft/ArrowRight = slide prev/next
    - typing/backspace/delete = editare camp activ (`title` sau `body`)
    - Enter in `title` muta pe `body`, Enter in `body` adauga newline

## 9) Prompt strategy (current)
- `WB_SYS` = "Miro-grade studio architect" pentru idei generale.
- `SW_PLAN_SYS` = template planner pentru upload de fisiere.
- `SW_SYS` = knowledge mapper pentru generarea structurii finale dupa alegere template.
- locatie curenta prompturi: `frontend/src/ai/prompts.js`
- helpere AI comune: `frontend/src/ai/helpers.js`
- Ambele impun JSON strict si structura actionabila.

## 10) Live deployment topology (Hetzner)
- Domain public: `board.private-driver.ro`
- Frontend served by nginx from: `/var/www/board/dist`
- Backend service:
  - systemd: `board-private-driver.service`
  - command: `node /var/www/board/backend/server.js`
  - bind: `127.0.0.1:8925`
- Nginx routing:
  - `/` -> static SPA (`try_files ... /index.html`)
  - `/api/*` -> `127.0.0.1:8925`
  - `/socket.io/*` -> `127.0.0.1:8925` (upgrade headers enabled)
- TLS:
  - Let's Encrypt cert for `board.private-driver.ro`
  - HTTP -> HTTPS redirect activ

## 11) Mobile stability flow (2026-03-05)
### 11.1) Touch + gesture pipeline
1. `Canvas` initializes `createInputController({ longPressMs: 400, moveTolerance: 10 })`.
2. Touch start:
   - canvas: starts pan flow in `navigate`
   - node: selects node and enables drag flow
   - connector: selects connector and enables long-press connector menu
3. Touch move:
   - press state updated (`movePress`) -> long-press canceled after movement threshold
   - drag updates throttled with `requestAnimationFrame`
   - pinch branch always active for 2 touches (independent from mode)
4. Touch end:
   - if long-press consumed -> close drag flow
   - else finalize drag/select.

### 11.2) Mobile mode state mapping
1. Tool <-> mode mapping uses `lib/input/modeController.js`.
2. Modes:
   - `navigate` (`pan`)
   - `select`
   - `add:<type>`
   - `connect` (`arrow`)
3. Transitions:
   - add placement -> `navigate` by default (unless `Stay in add mode` is ON)
   - connect completion -> `select`
   - global mobile exit -> `navigate`.

### 11.3) Android back order
`InnerApp` popstate guard handles:
1. close `mobileSheet`
2. close search/templates
3. close canvas transient UI via `board:close-transient-ui`
4. exit active mode to `navigate`
5. fallback to native page back.

### 11.4) Mobile contextual actions
1. Quick actions bar appears when selection exists:
   - Duplicate
   - Style (opens panel sheet)
   - Connect
   - Delete
2. Long-press contextual sheets:
   - canvas / container / node / selection via `buildContextMenu`
   - connector via dedicated connector group builder.

### 11.5) Connector selection/edit flow parity
1. Connector render layer accepts pointer input (`pointerEvents: auto`) and each connector has enlarged transparent hit path.
2. Desktop:
   - click connector -> `selectedArrow`
   - popover style editor near connector midpoint.
3. Mobile:
   - tap connector -> `selectedArrow`
   - dedicated bottom sheet editor opens with routing/style/jump/default actions.

### 11.6) Mobile creation speed flow
1. Long press canvas => open radial menu.
2. Drag finger towards radial option + release => insert action.
3. Smart placement:
   - with selection -> place near selected anchor.
   - connector drop on empty -> create node + auto connector.
4. Gesture shortcuts:
   - double tap canvas -> add node
   - double tap node -> edit text
   - two-finger swipe down/up -> undo/redo.
5. Multi-select quick arrange:
   - mobile quick action -> arrange sheet (vertical/horizontal/grid).
6. AI quick insert:
   - prompt in mobile `More` sheet
   - call `/api/ai/complete`
   - normalize + add nodes/arrows + tidy.



## 12) AI Thinking Engine flow (2026-03-05)
### 12.1) Components
- `frontend/src/components/AiThinkingPanel.jsx`
  - collapsible AI copilot section embedded in `RightPanel`
  - actions: generate board, generate flow, expand ideas, organize structure, decision helper, summarize
  - structured preview + explicit confirm insert
- `frontend/src/hooks/useThinkingCopilot.js`
  - central AI thinking state + commands
  - context extraction + prompt building
  - preview lifecycle + commit

### 12.2) Data/context flow
1. User triggers intent from AI Thinking panel.
2. Hook builds compact board context from current state:
   - nodes, arrows, clusters, containers, selection, disconnected nodes
   - capped payload for performance.
3. Hook calls `/api/ai/complete` via `aiCall` with `THINKING_SYS` + intent payload.
4. Response normalized to:
   - `preview.nodes`
   - `preview.arrows`
   - `preview.decision`
   - `preview.suggestions`
5. User confirms insertion:
   - dispatch `APPLY` (+ optional replace)
   - dispatch `SEL` on inserted nodes
   - optional `TIDY` for layout polish.

### 12.3) Smart suggestions
- Computed locally from board heuristics (node/arrow topology + selection state).
- Examples:
  - disconnected ideas -> suggest flow generation
  - dense sticky brainstorm -> suggest organize structure
  - task-like notes -> suggest execution plan board
  - one selected node -> suggest idea expansion
  - multi-selection -> suggest decision helper

### 12.4) Platform behavior
- Desktop: available in right sidebar (`RightPanel`).
- Mobile: same panel rendered inside existing `mobileSheet="panel"` bottom sheet.

## 13) Collaboration + Agents flow (2026-03-05)
### 13.1) Collaboration engine UI/data
1. `InnerApp` keeps collaboration state:
   - `collabUsersBySocket`
   - `collabActivity`
   - `myPresence`
   - meeting assistant state (`meetingNotes`, `meetingSuggestions`)
2. Socket listeners in `InnerApp`:
   - `users:init`, `user:joined`, `user:left`
   - `cursor:update`, `cursor:leave`
   - `user:presence`
   - `board:activity`
3. `Canvas` receives `collabUsers` for `RemoteCursors`.
4. `RightPanel` receives `collab` model and renders:
   - `CollaborationPanel`
   - `AgentPanel`

### 13.2) Presence flow
1. User changes state from panel (`active|idle|presenting`) -> `presence:update`.
2. Activity timer in `InnerApp`:
   - auto `idle` after inactivity
   - auto `active` on interaction.
3. Server updates room user state and broadcasts `user:presence`.

### 13.3) Activity timeline flow
1. `WBP` emits activity for key reducer actions using `emitActivity`.
2. Additional collaboration/agent actions use `onEmitActivity`.
3. Backend broadcasts `board:activity` to the full room (`io.to(boardId)`).
4. `CollaborationPanel` timeline shows aggregated events.

### 13.4) Meeting assistant flow
1. User pastes notes in `CollaborationPanel`.
2. Frontend calls `/api/ai/complete` with meeting schema prompt.
3. Suggestions preview (`tasks/milestones/decisions`) is shown in panel.
4. `Apply suggestions` inserts execution nodes/connectors on board.

### 13.5) AI agents flow
1. `RightPanel` uses `useBoardAgents`.
2. Agents:
   - Planner
   - Research
   - Connector
   - Risk
3. Agents create proposals (pending) first.
4. User can `Approve` / `Reject` / `Undo` from action history.

## 14) Spreadsheet AI Analysis flow (2026-03-05)
### 14.1) Panel wiring
1. `RightPanel` mounts `useSpreadsheetAi(...)` and renders `SpreadsheetAiPanel`.
2. Section is available on desktop sidebar and mobile `mobileSheet="panel"` bottom sheet.
3. Panel activates only when exactly one selected node is `type: "sheet"`.

### 14.2) Data extraction + analysis pipeline
1. Hook builds board-level spreadsheet engine:
   - `createSpreadsheetEngine({ nodes, arrows })`
2. Hook extracts:
   - selected sheet dataset (`extractSpreadsheetDataset`)
   - related datasets (incoming/outgoing flow edges)
3. Action buttons (`Analyze/Summarize/Detect anomalies/Generate insights`) run async pipeline:
   - deterministic analysis (`summarizeSpreadsheetDataset`, `detectSpreadsheetAnomalies`, `buildDeterministicInsights`)
   - optional AI augmentation via `/api/ai/complete` with `SHEET_ANALYSIS_SYS`
   - context payload limited in size before send.
4. Output rendered as structured `insightCards`.

### 14.3) Natural language query flow
1. User asks question in `SpreadsheetAiPanel` query input.
2. Hook tries deterministic answer first (`answerSpreadsheetQuery`), including:
   - total/sum
   - avg
   - highest/lowest
   - count
   - revenue-like patterns (`price * quantity`).
3. If deterministic parsing fails, hook calls AI (`SHEET_ANALYSIS_SYS`) for query answer fallback.

### 14.4) Anomaly visualization flow
1. Hook sends anomaly map to `InnerApp` via `onSpreadsheetAnomalyMapChange`.
2. `InnerApp` stores map in `sheetAiAnomalyMapBySheet`.
3. `Canvas` passes per-sheet map to `SpreadsheetNode`.
4. `SpreadsheetNode` highlights abnormal cells by severity (`low/medium/high`) in grid render.

### 14.5) Chart and KPI node flow
1. Chart actions call `buildChartGraph(...)` and dispatch `APPLY`:
   - bar chart
   - line chart
   - pie chart
2. KPI actions call `buildKpiNode(...)` + connector from source sheet to KPI.
3. `InnerApp` auto-refreshes KPI nodes:
   - detects nodes with `kpiBinding`
   - recalculates value from current sheet dataset (`computeKpiValue`)
   - updates node text/value via `UPD_MULTI` when source data changes.

### 14.6) Relationship discovery -> formula generation
1. Relationship suggestions are built from sheet flow + column semantics:
   - incoming/outgoing data dependencies
   - formula templates for same-sheet or cross-sheet price/quantity cases.
2. User clicks `Create formula`.
3. Hook writes generated formula into active cell (`sheetCells`) of selected sheet (`UPD` dispatch).

## 1.2) Editor layout zones (desktop/mobile)
1. Desktop zones:
   - Left tool rail (`RightToolPanel` compact mode): icon-only creation/interaction tools.
   - Top bar (`TopBar`): global board actions (undo/redo, zoom, search, board title, share/collab toggle, export).
   - Right inspector (`RightPanel`): context-aware panel.
2. Context inspector mode resolution (`RightPanel`):
   - `connector` daca exista connector selectat.
   - `spreadsheet` daca selectie unica este node `sheet`.
   - `node` daca selectie unica este alt node.
   - `board` daca nu exista selectie.
3. Mobile:
   - insert/tools in bottom sheet (`RightToolPanel` embedded mode).
   - inspector in bottom sheet (`RightPanel` fill mode).
   - context actions in bottom-sheet menu pentru long-press.
4. Canvas menu AI quick action:
   - right click canvas -> `Generate board`.
   - action dispatch -> `runQuickAiBoard` prompt flow.

## 15) High-speed canvas interaction flow (2026-03-05)
### 15.1) Quick add connected node
1. Hover/select node -> quick `+` action appears (edge buttons desktop, contextual button mobile).
2. Click `+` -> `createConnectedNode(fromNodeId,direction)`:
   - create node in smart position
   - create connector with port anchors by direction
   - select new node.

### 15.2) Drag smart-connect suggestion
1. Drag node (`drag.type="node"`).
2. `resolveSmartConnectCandidate(...)` checks nearby nodes without existing direct edge.
3. Canvas renders dashed suggestion path and inline `Connect` CTA.
4. `Connect` -> `ADD_ARR` using connector defaults + source/target ports.

### 15.3) Selection model extensions
1. Connector selection:
   - click connector -> primary `selectedArrow`
   - shift+click -> toggle in `selectedConnectorIds`.
2. Lasso selection:
   - selects nodes by bbox overlap
   - selects connectors by midpoint/route points/route bbox overlap.
3. Keyboard delete:
   - if only connector selection exists -> delete selected connectors.

### 15.4) Inline editing and shortcuts
1. Inline text editor (`ET`):
   - double-click to edit
   - `Enter` confirm
   - `Esc` cancel.
2. Shortcuts:
   - `N` -> add node at viewport center
   - `C` -> connector tool
   - blocked while typing in input/textarea/contenteditable.

### 15.5) Quick layout actions
1. Multi-selection opens `AlignPanel`.
2. Added layout actions:
   - vertical
   - horizontal
   - grid.
3. Applies via `UPD_MULTI` / `TIDY`.
