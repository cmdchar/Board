# ARCHITECTURAL DECISIONS - BoardAI

## (2026-03-10) Introduce Project Vault as parallel SQLite domain, isolated from board persistence
- Context:
  - echipa are nevoie de registry centralizat pentru proiecte, credentiale, API keys, users de test si subscriptions, fara sa afecteze contractele existente de board/collaboration.
- Decision:
  1. adaugam un domeniu nou `vault.sqlite` separat de `boards.json`/`templates.json`:
     - `vault_projects`
     - `vault_records`
     - `vault_record_versions`
     - `vault_activity`
  2. secretele se stocheaza criptat (`AES-256-GCM`) folosind `VAULT_SECRET_KEY` (fallback `JWT_SECRET`);
  3. expunem API dedicat sub `/api/vault/*`, protejat cu auth existenta (`requireAuth`), inclusiv `POST /api/vault/ingest` pentru capture automat din text liber;
  4. integrarea UI se face incremental in `RightPanel` (`PROJECT VAULT`) pe desktop + mobile sheet.
- Consequence:
  - board-ul devine control center operational pentru proiecte si secrete, fara migrare riscanta pe modelul board;
  - persista debt intentional:
    - lipsa edit/delete UX complet in prima iteratie
    - fara RBAC granular pe vault (momentan auth simplu per user token).

## (2026-03-05) Fix P0 launch blockers with targeted hardening (no broad refactor)
- Context:
  - prelaunch audit a identificat blocaje P0 pe corectitudine dataflow, auth security, realtime stability si overwrite conflicts.
- Decision:
  1. pastram arhitectura curenta (React + Express + Socket.IO + JSON store), dar aplicam fix-uri punctuale:
     - dataflow sheet signature hash pe continut key/value;
     - auth hashing nou pe bcrypt (cu compat legacy + auto-upgrade);
     - `JWT_SECRET` mandatory la startup (fail-fast);
     - CORS/socket strict pe allowlist env;
     - board store in-memory + persistență async pentru eliminarea sync I/O in realtime paths;
     - revision control optimistic pe `PUT /api/boards/:id` pentru update-uri `data`.
  2. evitam introducerea de feature-uri noi sau refactor general.
- Consequence:
  - se reduc riscurile de productie fara schimbari disruptive pe fluxurile principale;
  - securitatea auth creste (bcrypt + secret strict);
  - sync-ul realtime nu mai depinde de disk I/O pe hot-path;
  - overwrite-urile silent la save sunt prevenite prin conflict response (`409`/`428`) + handling frontend.

## (2026-03-05) Deliver Premium UX as token-driven visual layer + first-run onboarding overlay
- Context:
  - cerinta produs: UX premium (Notion/Figma/Linear feel) fara schimbari in business logic backend.
- Decision:
  1. extindem design system-ul existent (`tokens.js`) cu token-uri semantice + scale-uri clare:
     - colors (`background/surface/primary/text/border`)
     - spacing (`4/8/12/16/24/32`)
     - radius (`6/10/16`)
     - motion (`120-180ms`) + easing/shadows;
  2. aplicam polish prin strat CSS global si micro-interactions (hover/press/selection/connector feedback), nu prin rescriere masiva component-by-component;
  3. introducem first-minute activation direct in editor:
     - onboarding overlay (persistat local)
     - empty-state actionable cu AI/template/brainstorm start;
  4. pastram toate fluxurile de date si API-urile existente (frontend-only UX changes).
- Consequence:
  - consistenta vizuala creste rapid, cu impact minim de risc functional;
  - onboarding scade time-to-value fara endpoint-uri noi;
  - ramane debt tehnic pe componentizare UI (multe stiluri inline in `App.jsx`).

## (2026-03-05) Add Data Flow Engine as frontend runtime graph (no backend schema/API changes)
- Context:
  - produsul necesita pipeline-uri de date intre noduri (`sheet -> transform -> chart/kpi`) cu live recompute, preview si cycle prevention, fara a modifica business logic backend.
- Decision:
  1. introducem runtime dedicat in frontend (`frontend/src/lib/dataflow/engine.js`) care construieste graful de dependente din conectori de date (`flowType:"data"`);
  2. standardizam evaluarea output-ului pe tipuri de noduri de date (`sheet`, `transform`, `chart`, `kpi`) printr-un contract unificat (echivalent `getOutputData`);
  3. rulam recompute asincron/non-blocking prin `useDataFlowEngine` (`setTimeout` + `requestIdleCallback`) si aplicam doar patch-uri delta (`UPD_MULTI`);
  4. pastram modelul board compatibil, marcand dataflow in `data.arrows[]` cu camp optional `flowType`, plus inferenta pentru board-urile vechi;
  5. prevenim ciclurile in ambele puncte:
     - la creare conector (`wouldCreateDataFlowCycle`)
     - la runtime (flag pe noduri/conectori in ciclu).
- Consequence:
  - pipeline-urile de date devin reactive fara full recompute pe board;
  - feature-ul ramane incremental/extensibil (noi transform-uri, worker offload, tipuri noi de noduri);
  - backend/persistenta raman stabile, iar compatibilitatea cu board-urile existente este mentinuta.

## (2026-03-05) Implement Spreadsheet AI as frontend analysis layer over existing spreadsheet engine
- Context:
  - produsul necesita AI Spreadsheet Analysis in editor (insights, NL query, anomalies, charts, KPI, relationship formulas), fara schimbari in business logic backend nelegate.
- Decision:
  1. pastram backend AI/API existent (`POST /api/ai/complete`) si adaugam prompt dedicat `SHEET_ANALYSIS_SYS`;
  2. construim analiza in frontend peste engine-ul deja existent `createSpreadsheetEngine`:
     - extraction dataset
     - detectie anomalii
     - insight cards
     - NL query deterministic + fallback AI;
  3. integram UI in `RightPanel` (desktop + mobile panel sheet) prin hook/component dedicate:
     - `useSpreadsheetAi`
     - `SpreadsheetAiPanel`;
  4. pastram modelul de date board compatibil:
     - charts/KPI sunt noduri standard (`APPLY`)
     - KPI binding in metadata node (`kpiBinding`) cu auto-refresh la update sheet;
  5. pentru highlight anomalii, folosim map extern per sheet in `InnerApp` si nu alteram schema celulelor.
- Consequence:
  - livrare rapida a capabilitatilor cerute fara endpoint-uri noi sau migrare schema;
  - feature-ul ramane extensibil (worker offload/perf, formula templates avansate);
  - costul compute este in frontend pentru analiza sheet mare, necesitand optimizari viitoare.

## (2026-03-05) Move spreadsheet formula evaluation to shared board-level engine for cross-sheet dependencies
- Context:
  - evaluatorul precedent rula local in fiecare `SpreadsheetNode`, fara vizibilitate asupra altor spreadsheet-uri; referintele cross-sheet si data-flow graph nu puteau fi rezolvate corect.
- Decision:
  1. extragem logica de formule in modul dedicat `frontend/src/lib/spreadsheet/engine.js`;
  2. engine-ul primeste toate sheet-urile din board si construieste dependency graph la nivel de celula + sheet-level flow edges;
  3. `SpreadsheetNode` foloseste engine-ul comun, nu evaluare locala izolata;
  4. UI de formula editing permite click-to-insert referinte din alte sheet-uri, cu highlight contextual.
- Consequence:
  - suport real pentru formule cross-sheet (`Sheet!B2`, `sheet(\"...\").B2`, `Sheet!Price[A]`);
  - recalc-ul ramane deterministic si detecteaza cicluri/referinte invalide (`#CYCLE!`, `#REF!`);
  - baza pentru V2: autocomplete sheet/cell picker + incremental recompute per changed cell.

## (2026-03-05) Return deterministic server fallback from `/api/ai/complete` instead of surfacing provider failures
- Context:
  - utilizatorii primeau erori `502/504` in UI cand providerul AI extern era instabil (timeout/invalid response/missing key), blocand fluxurile AI din editor.
- Decision:
  1. pastram endpoint-ul unic `/api/ai/complete`, dar adaugam fallback deterministic server-side controlat de env `AI_ALLOW_FALLBACK` (default ON);
  2. la fail upstream, endpoint-ul intoarce `200` cu payload JSON valid (`fallback:true`, `fallback_reason`, `model:"fallback-local"`), compatibil cu toate flow-urile existente;
  3. extindem observability in `/api/health` cu metrici `ai.fallback`, `ai.fallback_enabled`, `ai.last_fallback_reason`.
- Consequence:
  - UI nu mai cade pe erori provider transient si ramane utilizabila in productie;
  - calitatea raspunsului fallback este mai redusa fata de provider, dar predictibila si fara blocaje;
  - putem monitoriza direct rata fallback si decide tuning ulterior (timeouts/retry/provider strategy).

## (2026-03-05) Add Template Marketplace as parallel JSON domain (`templates.json`) and keep board JSON as source of truth
- Context:
  - produsul avea nevoie de template library + publish/version/use + AI template generation, fără rescriere de persistence pentru boards.
- Decision:
  1. păstrăm `boards.json` neschimbat ca sursă de adevăr pentru board-uri active;
  2. introducem domeniu separat `templates.json` pentru marketplace metadata și versions;
  3. fiecare template version salvează snapshot board compatibil (`nodes/arrows/comments/votes`);
  4. consumul template-ului se face prin endpoint dedicat `POST /api/templates/:id/use`, care creează board nou;
  5. UI marketplace rulează în editor prin panel dedicat (`TemplateMarketplacePanel`) și folosește endpoint-uri REST incrementale.
- Consequence:
  - marketplace-ul se livrează rapid, fără migrare riscantă pe modelul board existent;
  - evoluțiile viitoare (moderation, workspace-level policies, analytics avansat) pot extinde `templates.json` sau migra ulterior în DB fără impact direct pe editor core.

## (2026-03-05) Add collaboration timeline/presence as incremental Socket.IO overlay, without changing board persistence
- Context:
  - sprint-ul de colaborare cere presence states, activity timeline, comments workflows si agent transparency, fara rescrierea modelului board.
- Decision:
  1. pastram `boards.json` ca source of truth pentru continutul board-ului;
  2. adaugam colaborare ca strat realtime in `InnerApp` + Socket.IO events:
     - `presence:update`, `user:presence`
     - `board:activity`
     - `user:left`;
  3. backend-ul difuzeaza `board:activity` catre tot room-ul (`io.to`) pentru timeline consistent inclusiv actorul curent;
  4. panelul colaborativ (`CollaborationPanel`) si panelul de agenti (`AgentPanel`) sunt integrate in `RightPanel` pentru desktop + mobile sheet.
- Consequence:
  - colaborarea live si istoricul de actiuni devin vizibile in editor fara migrare de data model;
  - baza pentru CRDT/fine-grained OT ramane separata ca iteratie viitoare (v1 ramane LWW/event stream).

## (2026-03-05) Add Execution Intelligence as frontend semantic layer over board state (no backend rewrite)
- Context:
  - era necesară trecerea de la whiteboard ideation la execution workspace, dar fără modificări riscante în persistence/API core.
- Decision:
  1. introducem un layer frontend dedicat (`useExecutionIntelligence`) care derivă semantic din `nodes/arrows`:
     - `tasks`, `milestones`, `decisions`, `risks`, `dependencies`, `warnings`, `healthScore`;
  2. păstrăm board JSON ca source of truth și mapăm execution metadata direct în node fields (`execution*`);
  3. adăugăm UI modular:
     - `ExecutionPanel` în `RightPanel` (desktop + mobile sheet);
     - `ExecutionTimelineOverlay` pentru view temporal și update due dates;
  4. separăm conectorii generici de dependențe explicite:
     - dep type detectat doar din `depType`/label recognizer;
     - nu mai forțăm fallback automat la `depends_on` pentru orice connector.
- Consequence:
  - execution features sunt livrate incremental, fără schimbări de backend/domain model;
  - board-urile existente rămân compatibile;
  - routing/style pentru conectori rămân corecte și nu colorează greșit linkurile non-dependency.

## (2026-03-05) Replace ad-hoc mobile overlays with unified bottom-sheet shell + touch input controller
- Context:
  - editorul mobil era inconsistent (tools/panel overlap, acces dificil, stuck modes), iar right-click UX nu avea echivalent robust pe touch.
- Decision:
  1. inlocuim drawer-ele mobile separate cu un state unificat:
     - `mobileSheet = "" | "insert" | "panel" | "more"`;
  2. introducem shell mobil dedicat:
     - `MobileBottomBar` pentru actiuni primare;
     - `MobileBottomSheet` cu snap points pentru continuturi mari;
  3. pastram `buildContextMenu(ctx)` ca sursa unica pentru actions, dar pe mobil il randam ca action sheet (long-press), nu popup de tip desktop;
  4. introducem `createInputController(...)` pentru long-press + move tolerance in touch flow, fara rescriere completa a engine-ului canvas;
  5. setam default mobil pe `pan` (navigate-first), cu switch explicit pe `select`.
- Consequence:
  - UX mobil devine predictibil si utilizabil pe ecrane mici;
  - context actions raman consistente intre desktop/mobile (aceeasi schema de comenzi);
  - exista o baza clara pentru V2 (quick actions contextuale, multi-select touch avansat).

## (2026-03-04) Add Advanced Connectors v1 as layered geometry engine on top of legacy arrows model
- Context:
  - era nevoie de conectori Miro-like (ports per container, styles, routing, obstacle avoidance) fara rescrierea board core sau migrare riscanta de data model.
- Decision:
  1. pastram `data.arrows[]` ca storage principal si mentinem compatibilitatea cu `fromId/toId`;
  2. extindem incremental connector schema cu campuri optionale:
     - `from/to` (entityId + anchor)
     - `routing`
     - `style`
  3. introducem engine geometry separat in frontend:
     - `anchors.js` (endpoint resolve)
     - `routing.js` (A* ortho + curved/wavy path builders)
     - `model.js` (normalize style/routing/caps)
  4. renderer-ul foloseste prioritar schema noua, cu fallback deterministic pe legacy.
- Consequence:
  - conectorii noi functioneaza fara a rupe board-urile vechi;
  - se poate evolua spre V2 (ports custom, labels avansate, waypoints persistente) fara migrare majora;
  - costul de calcul routing este controlat prin obstacle index simplu + reroute debounced.

## (2026-03-04) Implement global Light/Dark via CSS variable tokens, not per-component prop branching
- Context:
  - era nevoie de theme switch complet (landing/dashboard/editor) fara refactor masiv in monolitul `App.jsx`.
- Decision:
  1. introducem palete centralizate (`dark` / `light`) in `frontend/src/styles/tokens.js`;
  2. `UI_TOKENS` devine set de referinte CSS vars (`var(--ui-*)`) cu fallback dark;
  3. aplicam tema global prin `applyUiTheme()` care seteaza variabile pe `document.documentElement`;
  4. persistam modul in `localStorage` (`boardai_theme_mode`);
  5. adaugam toggle de tema in punctele principale de intrare:
     - Landing
     - Dashboard
     - Editor TopBar.
- Consequence:
  - comutare rapida light/dark pentru majoritatea UI fara a rescrie fiecare componenta;
  - theme-ul devine extensibil (se pot adauga ulterior variante enterprise/brand).

## (2026-03-04) Harden tool-mode UX with reducer-level exit flow and shared tokenized tool panel
- Context:
  - userul putea ramane blocat in add-mode (lipsa Select/Pan vizibile in panelul principal), iar tools chrome avea inconsistente vizuale (mix alb/negru).
- Decision:
  1. extindem state-ul reducer cu:
     - `lastNonAddTool`
     - `autoReturnToSelect`;
  2. introducem action dedicat:
     - `EXIT_ADD_MODE` (escape hatch unic spre `select`);
  3. aplicam reset global pe `Esc` + click explicit pe `Select`;
  4. adaugam `Space hold` pan temporar in keyboard engine;
  5. adaugam auto-return dupa `ADD` la nivel reducer (configurabil prin `TOGGLE_AUTO_RETURN_TO_SELECT`);
  6. unificam tema panelului de unelte prin token-uri shared:
     - `frontend/src/styles/tokens.js`
     - `RightToolPanel` migreaza de la culori hardcodate la token-uri comune.
- Consequence:
  - e practic imposibil sa ramai blocat in add mode (exista reset global + Select vizibil permanent);
  - consistenta vizuala a panelului de unelte este aliniata cu chrome-ul editorului;
  - reducerul devine sursa unica pentru regulile de switch tool/add reset.

## (2026-03-04) Add parallel semantic layer (SQLite) while keeping board JSON as source of truth
- Context:
  - era nevoie de `Semantic Board Graph + Execution Health v1` fara rescrierea persistentei actuale (`boards.json`).
- Decision:
  1. pastram board store existent (`boards.json`) neschimbat ca source of truth;
  2. introducem un layer paralel in SQLite (`semantic.sqlite`) cu migrations pentru:
     - `semantic_entities`
     - `semantic_relations`
     - `board_health_snapshot`;
  3. implementam extractor/health deterministic (fara AI obligatoriu in V1);
  4. rebuild semantic:
     - async/debounced pe save/create/restore
     - sync la endpoint-ul explicit de rebuild;
  5. expunem endpoint-uri REST dedicate semantic + metrics in `/api/health`.
- Consequence:
  - obtinem graph semantic + health score incremental, fara migration risc pe modelul board existent;
  - fundatie pentru V2 (cross-board analytics, issue prioritization, AI reasoning pe graph).

## (2026-03-04) Make deck keyboard input target explicit (`title` vs `body`)
- Context:
  - dupa keyboard hardening pentru `sheet/deck`, typing in `deck` era implicit pe `slide.body`, ceea ce reducea controlul cand userul voia sa editeze rapid titlul cu tastatura.
- Decision:
  1. adaugam camp explicit in node state:
     - `deckInputTarget` (`title` | `body`);
  2. `DeckNode` afiseaza control vizual `Title/Body` in header + highlight pentru target activ;
  3. click pe zona de titlu/body seteaza target-ul curent;
  4. keyboard engine-ul `Toolbar` routeaza typing/backspace/delete pe campul activ;
  5. `Enter` in `title` comuta target-ul pe `body`, iar in `body` insereaza newline.
- Consequence:
  - editarea prezentarilor devine predictibila si mai apropiata de comportamentul unui editor de slide-uri;
  - modelul de node pentru `deck` include un camp nou, compatibil backward (fallback implicit pe `body`).

## (2026-03-03) Prioritize contextual keyboard behavior for `sheet`/`deck` over global canvas shortcuts
- Context:
  - in editor, cand utilizatorul selecta `sheet` sau `deck`, sagetile/typing activau shortcut-urile globale (tool switch / move node), nu operatiile interne asteptate.
- Decision:
  1. in keyboard engine-ul `Toolbar`, detectam focus contextual (single selected `sheet`/`deck`);
  2. pentru `sheet`:
     - `Arrow/Tab/Enter` navigheaza celulele active;
     - typing/backspace/delete editeaza celula activa;
  3. pentru `deck`:
     - `ArrowLeft/ArrowRight` schimba slide-ul;
     - typing/backspace/delete/enter editeaza `slide.body`;
  4. shortcut-urile globale ruleaza doar daca nu exista context intern activ.
- Consequence:
  - experienta devine similara cu un container functional (nu doar un node selectabil);
  - creste complexitatea keyboard routing in `Toolbar`, cu potential viitor refactor intr-un hook separat.

## (2026-03-03) Add dedicated mobile `Tools` drawer and keep it exclusive with `Panel` drawer
- Context:
  - dupa mutarea tools panel pe desktop, fluxul mobil avea acces fragmentat la unelte si risc de overlap intre panouri.
- Decision:
  1. adaugam in `TopBar` mobil un toggle nou `Tools` pe langa `Panel`;
  2. deschidem `RightToolPanel` intr-un overlay mobil dedicat;
  3. impunem exclusivitate intre drawer-e:
     - `Tools` deschide -> inchide `Panel`
     - `Panel` deschide -> inchide `Tools`;
  4. ascundem toolbar-ul mobil cand un drawer e deschis pentru evitarea conflictelor de tap.
- Consequence:
  - acces complet la tools pe mobil, similar semantic cu desktop;
  - UI mobil mai stabil in interactiuni, fara panouri suprapuse.

## (2026-03-03) Anchor desktop tools panel to left and add explicit visibility toggle
- Context:
  - feedback direct de produs: meniul de unelte trebuie pe stanga, cu control rapid hide/unhide.
- Decision:
  1. folosim acelasi `RightToolPanel`, dar cu pozitionare configurabila (`side`, `leftInset`);
  2. in `InnerApp` introducem `toolsPanelOpen` si buton persistent `Hide Tools / Show Tools`;
  3. pe mobil nu afisam acest panel (mentinem fluxul mobil existent).
- Consequence:
  - UX desktop este mai apropiat de ergonomia ceruta;
  - introducem minim debt de state UI (`toolsPanelOpen`) fara impact pe modelul de date.

## (2026-03-03) Move desktop creation tools to `RightToolPanel` while keeping legacy `Toolbar` as hidden shortcut engine
- Context:
  - cerinta de UX a fost mutarea meniului principal de unelte in partea dreapta, cu categorii clare, iconografie consistenta si labels; in acelasi timp, editorul are deja multe shortcut-uri implementate in `Toolbar`.
- Decision:
  1. introducem un panel nou de unelte pentru desktop:
     - `frontend/src/components/RightToolPanel.jsx`;
  2. in `InnerApp`, afisam `RightToolPanel` pe desktop si pastram `RightPanel` docked in dreapta;
  3. montam `Toolbar` cu `hidden=true` pe desktop pentru a pastra shortcut engine-ul existent (fara regresii de keyboard flow);
  4. pe mobil, pastram toolbar-ul vizibil (fallback mobil ramas neschimbat).
- Consequence:
  - UX desktop este aliniat cu directia Miro-like (tool discoverability pe dreapta);
  - evitam refactor risc ridicat pe shortcut-uri in acest pas;
  - ramane debt tehnic: mutarea shortcut engine-ului intr-un hook dedicat, ca toolbar-ul legacy sa poata fi eliminat complet.

## (2026-03-03) Introduce first-class `sheet` and `deck` nodes instead of table-as-sticky-pack for new content
- Context:
  - cerinta produs: "tabel Excel real (cu formule) + container PowerPoint functional", iar modelul existent de `table` era un pack de stickies/shapes.
- Decision:
  1. pastram compatibilitatea cu modelul legacy `tableId/tableRole` pentru board-urile vechi;
  2. pentru insert nou, `table` creeaza `type: "sheet"` cu stocare interna `sheetCells` si evaluator formule;
  3. introducem `type: "deck"` pentru slide containers cu `deckSlides[]` + `deckIndex`;
  4. hardenizam copy/duplicate cu deep-clone pentru payload intern (`sheetCells`, `deckSlides`) ca sa evitam referinte partajate intre clone.
- Consequence:
  - noile board-uri au primitive functionale reale pentru spreadsheet/slides;
  - persistenta ramane compatibila in JSON store fara migrare backend;
  - export/props/UX legacy raman disponibile pentru tabelele vechi pana la deprecare completa.

## (2026-03-03) Start multi-tracker roadmap with Jira import MVP first
- Context:
  - dupa GitHub sync depth, cel mai scurt drum spre segment execution superior este acoperirea unui al doilea tracker major (Jira) pe acelasi contract `execution*`.
- Decision:
  1. livram intai import Jira (fara push), pentru a valida mapping-ul `Jira -> execution plan`;
  2. mentinem contractul existent al execution renderer (tasks/milestones/risks), fara nou tip de board;
  3. suportam auth hibrid:
     - request override (`jiraEmail`/`jiraToken`)
     - env fallback (`JIRA_EMAIL`/`JIRA_TOKEN`);
  4. persistam sync metadata in `board.integrations.jira[site::project]` pentru baza de incremental/push ulterior.
- Consequence:
  - phase 1 roadmap este pornit cu valoare imediata in UI;
  - urmatorul pas ramane Jira push + Azure DevOps parity.

## (2026-03-03) Close GitHub sync depth with retry/backoff + idempotency + milestone reconciliation
- Context:
  - GitHub sync avea deja incremental import/conflict strategy, dar inca exista risc operational pe request-uri tranziente, dublu-submit si drift pe milestone-uri.
- Decision:
  1. facem `githubRequest` retry-aware (transient HTTP + `Retry-After`) cu exponential backoff;
  2. activam idempotency keys pe import/push, cu cache per board (`integrations.github_idempotency`) si stari `pending/done`;
  3. introducem reconciliere milestone la push:
     - create milestone lipsa;
     - update `state` + `due_on` dupa task cards;
  4. extindem parserul de dependinte issue pentru pattern-uri reale din body (`issue #`, `/issues/`, `depends-on:` etc.).
- Consequence:
  - sync-ul GitHub devine mai robust la retry-uri, request duplication si inconsistente milestone;
  - ramane debt de scalare: idempotency/rate-limit sunt local state (fara coordonare multi-instance).

## (2026-03-03) Move GitHub auth from manual PAT input to OAuth + per-user encrypted vault
- Context:
  - GitHub bidirectional sync era functional, dar depindea de token manual in UI (`PAT`) sau fallback global de server.
- Decision:
  1. introducem OAuth App flow server-side, cu endpoint-uri dedicate:
     - `oauth/start`
     - `oauth/callback`
     - `oauth/status`
     - `oauth/disconnect`
  2. stocam tokenul per user, criptat AES-256-GCM in `users.json` (`integrations.github.*`);
  3. schimbam rezolutia tokenului pentru import/push:
     - request/header override
     - token din vault-ul userului autentificat
     - fallback `GITHUB_TOKEN` env;
  4. eliminam input-ul de token din execution panel si pastram auth UX bazat pe connect/disconnect.
- Consequence:
  - securitate/UX mai bune fata de token manual;
  - fundatie pentru extindere OAuth similara catre Jira/Azure;
  - ramane debt enterprise: secret manager/KMS + token lifecycle management avansat.

## (2026-03-03) Harden GitHub sync with incremental pull state + conflict strategy
- Context:
  - MVP-ul GitHub sync functiona, dar risca overwrite accidental cand issue-urile erau modificate remote intre sync-uri si nu avea pull incremental stabil.
- Decision:
  1. introducem sync state per board/repo in `board.integrations.github[repoKey]`;
  2. importul suporta incremental (`since` automat din state, plus override explicit);
  3. push-ul suporta conflict strategy configurabila:
     - `skip_remote_newer`
     - `prefer_board`
     - `prefer_remote`;
  4. comparatia de conflict foloseste ancore temporale:
     - `executionIssueUpdatedAt`
     - `executionLastSyncedAt`.
- Consequence:
  - risc mai mic de “status drift” si overwrite pe date remote mai noi;
  - baza pregatita pentru reconciliation mai avansat si extindere Jira/Azure.

## (2026-03-03) Deliver GitHub bidirectional sync as first external execution integration
- Context:
  - dupa contractul execution strict, urmatorul blocaj era lipsa conectarii la sursa reala de lucru (issues/tickets), deci board-ul ramanea izolat.
- Decision:
  1. livram un MVP GitHub-first cu doua endpointuri dedicate:
     - import issues -> execution plan
     - push execution tasks -> upsert issues
  2. maparea se bazeaza pe metadata `execution*` de pe noduri, nu pe parser text-only;
  3. pastram token support hibrid:
     - token din request
     - fallback `GITHUB_TOKEN` din backend env
  4. auditam explicit operatiile:
     - `board.github.import`
     - `board.github.push`
- Consequence:
  - avem sync bidirectional functional pe un tracker real;
  - schema `execution*` este validata pentru extindere Jira/Azure in aceeasi arhitectura.

## (2026-03-03) Split execution generation into strict plan contract + deterministic renderer
- Context:
  - MVP-ul execution folosea acelasi pipeline generic `applyParsed` ca brainstorming-ul, ceea ce facea output-ul inconsistent pentru campurile critice de delivery (owner/status/prioritate/deadline).
- Decision:
  1. schimbam `EXEC_SYS` de la schema generica `nodes/arrows` la schema structurata de plan:
     - `objectives`, `milestones`, `tasks`, `risks`;
  2. in frontend, introducem pipeline dedicat:
     - `normalizeExecutionPlan(...)`
     - `applyExecutionPlan(...)`
  3. randarea in canvas devine determinista (`NOW/NEXT/LATER` lanes + panels milestones/risks + dependency links);
  4. atasam metadata `execution*` pe noduri pentru viitorul sync bidirectional.
- Consequence:
  - crestere semnificativa a consistentei execution board-urilor;
  - fundatie pregatita pentru integrarea cu Jira/GitHub/Azure fara schimbare majora de model.

## (2026-03-03) Complete refactor phase 4 by extracting PropsPanel/FileZone from App monolith
- Context:
  - dupa mutarea RightPanel + AI hooks, `App.jsx` inca continea blocuri mari de UI locale (`PropsPanel`, `FileZone`).
- Decision:
  1. extragem componente dedicate:
     - `frontend/src/components/PropsPanel.jsx`
     - `frontend/src/components/FileZone.jsx`
  2. `RightPanel` devine orchestrator pentru aceste componente si primeste explicit dependintele de tabel.
- Consequence:
  - `App.jsx` scade in complexitate;
  - panel logic reutilizabila si mai usor testabila;
  - urmeaza refactor ulterior pe alte blocuri mari (ex: `TopBar`, `Dashboard` etc.) daca se continua decompozitia.

## (2026-03-03) Start execution wedge with prompt-driven MVP inside existing RightPanel flow
- Context:
  - obiectivul strategic este diferentiere pe segmentul execution (product + engineering), nu whiteboard generalist.
- Decision:
  1. lansam rapid un MVP in UI existenta:
     - sectiune `EXECUTION PLAN` in `RightPanel`;
  2. folosim prompt dedicat (`EXEC_SYS`) in pipeline-ul AI deja stabil;
  3. re-folosim parserul/normalizerul existent pentru a aplica output-ul pe canvas.
- Consequence:
  - obtinem viteza de iteratie pe wedge fara endpoint nou dedicat;
  - urmeaza faza 2: contract structurat pentru sync bidirectional cu issue trackers.

## (2026-03-03) Add audit timeline UI as collapsible panel in RightPanel before full analytics module
- Context:
  - audit API exista, dar fara vizibilitate in editor pentru echipe.
- Decision:
  1. adaugam `AuditTimelinePanel` in `RightPanel`, langa `VersionHistoryPanel` si sharing;
  2. panel-ul suporta filtre simple in client:
     - action
     - limit
  3. backendul extinde `GET /api/boards/:id/audit` cu query filters + actor enrichment.
- Consequence:
  - utilizatorii pot vedea rapid "cine a facut ce" fara a parasi board-ul;
  - pentru volume mari ramane necesar un modul de analytics dedicat.

## (2026-03-03) Introduce in-memory rate-limit + health metrics for AI endpoint
- Context:
  - endpointul `/api/ai/complete` era fara control de trafic si fara semnale operationale.
- Decision:
  1. adaugam middleware `aiRateLimit` (per client/window) pe endpointul AI;
  2. expunem metrics runtime in `GET /api/health`:
     - traffic counters
     - error telemetry minima
     - ultima latenta/model/usage.
- Consequence:
  - risc redus de abuz accidental/automat;
  - observabilitate minima disponibila imediat, cu debt pentru storage/metrics distribuite.

## (2026-03-03) Close enterprise baseline with append-only audit store + Socket.IO RBAC checks
- Context:
  - dupa RBAC pe REST, exista inca bypass pe realtime channel si lipsa de trasabilitate a actiunilor pe board.
- Decision:
  1. introducem audit log lightweight in `backend/data/audit.json`, separat de `boards.json`;
  2. adaugam API de citire:
     - `GET /api/boards/:id/audit`
  3. inregistram evenimente cheie:
     - create/rename/save/restore/delete
     - member add/role/remove
  4. fortam autorizare in Socket.IO:
     - `board:join` -> read required
     - `board:sync` -> edit required
     - `cursor:move` -> read required
- Consequence:
  - se inchide un gap critic fata de baseline enterprise (audit + realtime enforcement);
  - log-ul ramane file-based (simplu), cu limitare pe volum via `AUDIT_MAX_EVENTS`.

## (2026-03-03) Mobile-first interaction fallback in monolith App.jsx before component split
- Context:
  - editorul era greu utilizabil pe mobil (gesturi incomplete, layout-uri fixe pe ecrane mici).
- Decision:
  1. pastram implementarea in `App.jsx` momentan (inainte de refactor phase 4), dar adaugam:
     - touch handling robust + pinch-to-zoom in canvas
     - right panel drawer pe mobil
     - toolbar bottom + overflow scrolling
     - responsive tuning in Landing/Auth/Dashboard/Search/Shortcuts
  2. evitam schimbari de data model; focus pe UX viability.
- Consequence:
  - produsul devine utilizabil pe mobil fara redesign major;
  - ramane debt structural: aceeasi logica in monolit, de extras ulterior.

## (2026-03-03) Introduce board-level RBAC in JSON store before full workspace model
- Context:
  - dupa version history, urmatorul gap critic fata de baseline enterprise era controlul de acces colaborativ (owner/editor/viewer) si sharing explicit.
- Decision:
  1. extindem schema board cu `members[]` (role per user) peste owner-ul existent (`userId`);
  2. definim guards de autorizare per operatie:
     - read: owner/editor/viewer
     - edit: owner/editor
     - manage: owner
  3. adaugam endpointuri de sharing by email:
     - `GET /api/boards/:id/members`
     - `PUT /api/boards/:id/members`
     - `DELETE /api/boards/:id/members/:userId`
  4. facem `POST /api/boards` autentificat obligatoriu pentru board-uri noi.
- Consequence:
  - board-urile noi au ownership clar si colaborare controlata;
  - frontend poate gestiona membri direct din UI;
  - ramane urmatorul pas obligatoriu: enforcement RBAC pe canalul realtime Socket.IO + audit trail.

## (2026-03-03) Add lightweight board version history in JSON store before full audit/RBAC
- Context:
  - pentru a construi baseline enterprise si a reduce riscul de data loss, era nevoie de restore point-uri pe board fara migrare DB complexa.
- Decision:
  1. extindem modelul board cu `versions[]` + metadata (`latest_version_hash`, `last_version_at`);
  2. capturam snapshot la create/save/restore;
  3. expunem endpointuri dedicate:
     - `GET /api/boards/:id/history`
     - `GET /api/boards/:id/history/:versionId`
     - `POST /api/boards/:id/history/:versionId/restore`
  4. folosim rolling update in interval scurt pentru a limita cresterea necontrolata a versiunilor.
- Consequence:
  - avem restore functional imediat, util pentru colaborare/operare;
  - ramane debt: retention policy mai avansata si mutare pe storage mai robust la scale mare.

## (2026-03-02) Move board state domain into dedicated module via factory injection
- Context:
  - dupa separarea `RightPanel`, `App.jsx` inca continea un bloc foarte mare cu reducer + constants/helpers + templates.
- Decision:
  1. introducem `frontend/src/state/boardState.js` cu `createBoardState({ T, SC, CANVAS_THEMES, uid })`;
  2. mutam in acest modul:
     - reducer + `INIT`
     - state helpers/table helpers
     - template registry `TPLS`
  3. `App.jsx` consuma acest domain prin destructuring, pastrand UI-ul separat.
- Consequence:
  - scade semnificativ complexitatea structurala a `App.jsx`;
  - logica de state devine izolata, mai usor de testat/refactorizat;
  - urmatorul pas natural este extragerea `PropsPanel` / `FileZone` si a infrastructurii realtime/API.

## (2026-03-02) Separate RightPanel into component + hook to reduce App.jsx coupling
- Context:
  - dupa extragerea prompturilor/helperele AI, `RightPanel` ramanea cea mai densa bucata de UI+logic in `App.jsx`.
- Decision:
  1. extragem UI in `frontend/src/components/RightPanel.jsx`;
  2. extragem state/actions AI si file-flow in `frontend/src/hooks/useRightPanelAi.js`;
  3. pastram in `App.jsx` doar wiring-ul de dependinte catre noua componenta (`s`, `d`, theme tokens, helpers/components).
- Consequence:
  - `App.jsx` scade in complexitate si devine mai usor de segmentat pe urmatoarele faze;
  - flow-ul AI/file generation devine izolat si refactorabil independent;
  - urmatorul pas logic este separarea reducer/canvas helpers din `App.jsx`.

## (2026-03-02) Start App.jsx modular refactor by extracting AI domain modules
- Context:
  - `frontend/src/App.jsx` a devenit prea mare si combina UI, prompturi AI si helpere de parsing/networking.
- Decision:
  1. extragem prompturile AI + constantele asociate in `frontend/src/ai/prompts.js`;
  2. extragem helper-ele AI comune in `frontend/src/ai/helpers.js` (`aiCall`, parse/plan/prompt helpers);
  3. `App.jsx` importa modulele noi si elimina duplicatele locale.
- Consequence:
  - scade dimensiunea/complexitatea locala din `App.jsx`;
  - fluxul AI devine mai usor de mentinut si testat incremental;
  - ramane de facut faza urmatoare: separarea `RightPanel` si reducer helpers in module dedicate.

## (2026-03-02) Keep complex-board organization deterministic with client-side layout actions
- Context:
  - board-urile generate AI sau colaborative devin rapid aglomerate si greu de citit.
- Decision:
  1. adaugam doua actiuni deterministe in reducer:
     - `TIDY` pentru auto-layout in grila
     - `WRAP_FRAME` pentru incadrarea selectiei
  2. expunem actiunile in toolbar + context menu + shortcut keyboard.
- Consequence:
  - utilizatorul poate reface claritatea board-ului instant, fara a depinde de AI sau editare manuala lunga.

## (2026-03-02) Keyboard-first idea capture for mind-map style workflows
- Context:
  - pentru brainstorming, viteza de capturare e esentiala.
- Decision:
  - introducem shortcut-uri pe selectie unica:
    - `Tab` => child sticky conectat
    - `Enter` => sibling node (si relink la acelasi parinte daca exista)
- Consequence:
  - flux de ideare mai fluid, apropiat de tool-uri specializate de mind mapping.

## (2026-03-02) Two-step AI flow for file uploads (plan -> user choose -> generate)
- Context:
  - userul a cerut ca la upload de fisier AI sa recomande template-ul optim vizual, dar sa intrebe explicit ce template sa foloseasca.
- Decision:
  1. introducem planner prompt separat (`SW_PLAN_SYS`) pentru selectie template + detectie tabel + evaluare complexitate;
  2. generarea structurii (`SW_SYS`) se executa doar dupa alegerea explicita a template-ului in UI.
- Consequence:
  - creste controlul utilizatorului asupra rezultatului;
  - se reduce riscul de layout nepotrivit;
  - structurile tabulare/complexe sunt tratate mai bine inainte de randare.

## (2026-03-02) Extended shape taxonomy + table-as-node-pack strategy
- Context:
  - editorul avea set minim de forme (`rect/circle/diamond`), insuficient pentru flow-uri tip Miro (cloud diagrams, architecture mapping, data grids).
- Decision:
  1. extindem `shapeType` cu:
     - `triangle`, `hexagon`, `parallelogram`, `cloud`, `cylinder`;
  2. pastram modelul de date existent (`type: "shape"`) fara a introduce tip nou pentru fiecare forma;
  3. pentru tabele, alegem strategie "table pack":
     - tool-ul `table` genereaza un grup de noduri existente (`shape` + `text`) in loc de `type: "table"` dedicat;
  4. aliniem promptul AI + normalizarea frontend la noua taxonomie.
- Consequence:
  - obtinem functionalitate extinsa rapid, compatibila retroactiv cu board-urile existente;
  - evitam migrare de schema backend/store;
  - ramane un potential next-step: editor tabel dedicat (rows/cols operations).

## (2026-03-02) Table metadata on nodes instead of introducing a table entity
- Context:
  - dupa insert-ul initial de tabel, era nevoie de operatii de editare (add/remove row/col, resize col) fara a schimba contractul backend.
- Decision:
  1. pastram modelul "totul este node", dar adaugam metadata optionala:
     - `tableId`, `tableRole`, `tableRow`, `tableCol`;
  2. implementam operatii de tabel strict in reducer pe baza acestei metadata.
- Consequence:
  - suport tabel editabil fara migrare backend;
  - compatibil cu JSON export/import existent;
  - complexitatea ramane in frontend reducer si necesita viitor refactor modular.

## (2026-03-02) Backend-validated JSON contract for AI completions
- Context:
  - generarea Spider putea esua deoarece modelul trimitea JSON imperfect sau schema incompleta.
- Decision:
  1. `/api/ai/complete` valideaza/parses server-side raspunsul DeepSeek;
  2. endpointul returneaza camp `json` deja validat (plus `repaired` flag), nu doar text brut;
  3. se foloseste JSON mode cu fallback + repair pass pentru robustete.
- Consequence:
  - frontend-ul nu mai depinde complet de parsare fragila text->JSON;
  - rata de esec la generare scade semnificativ pentru fisiere mari/complexe.

## (2026-03-02) Non-passive wheel handling for canvas interactions
- Context:
  - browserul raporta warning repetat la `preventDefault` in listener pasiv in timpul zoom/pan.
- Decision:
  1. wheel handling este atasat nativ pe canvas cu `{ passive:false }`;
  2. `preventDefault` se executa conditionat (`event.cancelable`).
- Consequence:
  - dispar warning-urile de passive listener;
  - comportamentul zoom/pan ramane controlat corect pe canvas.

## (2026-03-02) Live topology for board.private-driver.ro (Hetzner)
- Context:
  - aplicatia trebuia publicata live pe subdomeniu dedicat, fara a afecta celelalte servicii existente.
- Decision:
  1. rulam backendul BoardAI ca serviciu separat:
     - `board-private-driver.service`
     - `127.0.0.1:8925`
  2. servim frontendul static prin nginx din:
     - `/var/www/board/dist`
  3. facem reverse proxy nginx:
     - `/api/*` -> backend local `8925`
     - `/socket.io/*` -> backend local `8925` cu upgrade websocket
  4. activam TLS cu Let's Encrypt pentru `board.private-driver.ro`.
- Consequence:
  - BoardAI este izolat operational de celelalte aplicatii de pe server.
  - redeploy-ul poate fi facut independent (upload + restart service + reload nginx).

## (2026-03-02) High-capability DeepSeek system prompts for Miro-grade ideation
- Context:
  - proiectul cere asistenta AI pentru orice tip de idee si un nivel de complexitate apropiat/depasind Miro.
- Decision:
  1. definim prompturi sistem complexe pentru doua fluxuri:
     - idei generale (`WB_SYS`)
     - analiza fisier (`SW_SYS`)
  2. impunem contract JSON strict pentru compatibilitatea cu canvas engine.
  3. marim `maxTokens` la 1400 pentru output mai bogat.
- Consequence:
  - AI produce structuri mai utile pentru strategie, arhitectura si executie.
  - creste consistenta outputului vizual in board.

## (2026-03-02) Frontend AI parser fallback for noisy model responses
- Context:
  - modelele pot returna accidental text extra sau fences in jurul JSON.
- Decision:
  1. adaugam `parseAiJson` cu doua niveluri de fallback;
  2. validam explicit prezenta `nodes` ca array.
- Consequence:
  - mai putine erori la aplicarea rezultatului AI pe canvas.

## (2026-03-02) DeepSeek integration via backend proxy endpoint
- Context:
  - integrarea veche depindea de `window.claude.complete`.
- Decision:
  1. mutam apelul modelului in backend (`POST /api/ai/complete`);
  2. frontendul foloseste endpoint intern.
- Consequence:
  - cheia API ramane pe backend, nu in browser bundle.

## (2026-03-02) Backend AI config through env variables
- Context:
  - endpointul AI necesita configurare flexibila.
- Decision:
  - env vars: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `DEEPSEEK_BASE_URL` via dotenv.
- Consequence:
  - schimbare rapida de model/provider fara modificari de cod.

## (2026-03-02) AI memory reset with legacy archive
- Context:
  - folderul `ai/` era din alt proiect.
- Decision:
  1. arhivare in `ai/_legacy_privatedriver_2026-03-02/`;
  2. refacere set minim `ai/*` pentru BoardAI.
- Consequence:
  - context curat pentru sesiunile viitoare.

## (2026-03-05) Mobile mode-safety + back-guard architecture
- Context:
  - pe mobil utilizatorul putea ramane blocat in add/connect si comportamentul Back era imprevizibil fata de overlays/sheets.
- Decision:
  1. folosim maparea centralizata `tool <-> mode` (`modeController`) in UI shell mobil;
  2. adaugam reguli explicite de tranzitie:
     - add -> navigate (implicit)
     - connect -> select
  3. implementam guard pe `popstate` cu ordinea:
     - close sheet -> close menus -> close canvas overlays -> exit mode -> browser back.
- Consequence:
  - flow mobil predictibil;
  - imposibil de ramas blocat in moduri active fara iesire;
  - comportament Android Back apropiat de aplicatiile native.

## (2026-03-05) RAF throttling for touch drag updates
- Context:
  - update-urile continue pe `touchmove` produceau lag pe mobile.
- Decision:
  - `onTouchMove` nu mai aplica update direct, ci programeaza ultimul eveniment pe `requestAnimationFrame`.
- Consequence:
  - drag mai fluent pe telefoane;
  - reducere rerender pressure in timpul interactionarii.

## (2026-03-05) visualViewport-based keyboard avoidance for bottom sheets
- Context:
  - pe mobil, tastatura acoperea continutul in sheet.
- Decision:
  - `MobileBottomSheet` foloseste `window.visualViewport` pentru:
    - calcul `keyboardInset`
    - repoziționare dinamica (`bottom`)
    - snap heights pe viewport real.
- Consequence:
  - input-urile din sheet raman utilizabile cand tastatura este deschisa;
  - comportament mai stabil pe iOS/Android.

## (2026-03-05) Connector editor split by platform
- Context:
  - editorul desktop pentru connector (popover) nu era ergonomic pe mobil.
- Decision:
  1. pastram popover-ul pentru desktop;
  2. pe mobil, la selectarea connectorului, deschidem editor in `MobileBottomSheet`;
  3. marim hit-area la selectie pentru touch (`strokeWidth` transparent mai mare).
- Consequence:
  - aceleasi operatii de stil/routing disponibile pe ambele platforme;
  - selectie mult mai usoara a liniilor intre containere pe telefon.

## (2026-03-05) Radial-first mobile creation UX
- Context:
  - meniurile list-based pe mobil sunt lente pentru creare rapida de flow-uri.
- Decision:
  - long-press pe canvas deschide radial add menu cu optiuni principale orientate pe directie.
- Consequence:
  - creare mai rapida cu un singur gest (press-drag-release), fara navigare prin liste lungi.

## (2026-03-05) Mobile AI quick insert in UI layer
- Context:
  - era nevoie de “flow generation” direct din mobil, fara a modifica backend.
- Decision:
  - adaugam prompt input in shell mobil care foloseste endpointul existent `/api/ai/complete`.
- Consequence:
  - functionalitate AI quick insert disponibila imediat, fara schimbari API/business logic.

## (2026-03-05) AI Thinking Engine implemented as frontend interaction layer (preview-first)
- Context:
  - produsul trece de la whiteboard pasiv la AI thinking partner;
  - cerinta a fost sa nu modificam business logic/API nelegate de editor.
- Decision:
  1. adaugam un nou sistem prompt `THINKING_SYS` cu intent-uri explicite;
  2. implementam `useThinkingCopilot` in frontend pentru:
     - extragere context board
     - apel AI async
     - normalizare raspuns
     - preview structurat inainte de commit
  3. integrarea UI se face in `RightPanel` (desktop) + sheet-ul mobil existent.
- Consequence:
  - AI output devine controlabil si predictibil (confirm-before-insert);
  - context-awareness exista fara schimbari backend API;
  - extensibilitate crescuta pentru urmatoarele sprinturi (focus/navigation/tests).
