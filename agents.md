# agents.md — BoardAI (whiteboardclaude)

> Fisier de intrare pentru orice agent AI pe acest repo.
> Citeste acest fisier primul, apoi fisierele din `ai/`.

---

## Proiect

**BoardAI** — whiteboard colaborativ in timp real.

| | |
|--|--|
| Frontend dev | `http://localhost:5173` |
| Backend API dev | `http://localhost:3001` |
| Stack | React 18 + Vite + Express + Socket.IO |
| Persistenta | JSON file store (`backend/data/boards.json`) |
| Auth | Nu exista autentificare (nume local in `localStorage`) |

---

## Arhitectura curenta

### Frontend
- locatie: `frontend/`
- entry: `frontend/src/main.jsx`
- aplicatia este in principal in `frontend/src/App.jsx`
- Vite proxy:
  - `/api` -> `http://localhost:3001`
  - `/socket.io` -> `http://localhost:3001`

### Backend
- locatie: `backend/`
- entry: `backend/server.js`
- Express REST + Socket.IO pe acelasi server HTTP
- stocare in fisier JSON local (`backend/data/boards.json`)

### Tooling local
- `.claude/launch.json`: profile launch frontend/backend
- `.claude/settings.local.json`: permisiuni locale Claude tool
- `.vite/`: folder prezent dar gol (momentan nefolosit)

---

## Workflow obligatoriu

### La START in orice sesiune
1. Citeste `agents.md`.
2. Citeste `ai/BRAIN.md` (stare curenta + next steps).
3. Citeste `ai/TASKS.md` (taskuri active).
4. Daca modifici arhitectura/data-flow, citeste si `ai/BRAINMAP.md` + `ai/DECISIONS.md`.

### La FINAL dupa orice modificare
1. Actualizeaza `ai/CHANGELOG_AI.md` (ce ai schimbat si de ce).
2. Actualizeaza `ai/BRAIN.md` (stare noua + urmatorii pasi exacti).
3. Daca s-au schimbat rute/evente/fluxuri, actualizeaza `ai/BRAINMAP.md`.
4. Daca s-a schimbat modelul de date, actualizeaza `ai/database.md`.
5. Daca s-a schimbat arhitectura, actualizeaza `ai/DECISIONS.md`.
6. Ruleaza deploy standard:
   - `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1`
   - optional rapid (fara rebuild local): `powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1 -SkipBuild`
   - scop: orice schimbare aprobata trebuie sa fie vizibila online pe `https://board.private-driver.ro`.

La mesajul **"continue"**: reia din `ai/BRAIN.md`, sectiunea `Next Steps (Exact)`.

---

## Conventii tehnice

### Backend (Express + Socket.IO)
- mentine prefixul REST: `/api/*`
- endpointuri existente:
  - `GET /api/boards`
  - `GET /api/boards/:id`
  - `POST /api/boards`
  - `PUT /api/boards/:id`
  - `DELETE /api/boards/:id`
  - `GET /api/health`
- board schema in store:
  - `{ id, name, data, created_at, updated_at }`
- timestampuri in secunde Unix (`Math.floor(Date.now()/1000)`)
- la orice update de board: actualizeaza `updated_at`

### WebSocket (Socket.IO)
- join flow obligatoriu pe board:
  1. `board:join`
  2. apoi `board:sync` / `cursor:move`
- evenimente active:
  - client -> server: `board:join`, `board:leave`, `board:sync`, `cursor:move`
  - server -> client: `board:update`, `users:init`, `user:joined`, `cursor:update`, `cursor:leave`

### Frontend (React)
- foloseste API prin path relativ (`/api/...`) pentru a ramane compatibil cu proxy Vite
- foloseste singleton Socket.IO din `App.jsx`
- salvare:
  - local backup in `localStorage` (`boardai_v7`)
  - persistenta backend cu debounce (~1200ms)

---

## Comenzi utile

```bash
# backend
cd backend
npm install
npm run dev

# frontend
cd frontend
npm install
npm run dev

# build frontend
cd frontend
npm run build

# deploy standard (recommended after each change)
cd ..
powershell -ExecutionPolicy Bypass -File ops\\deploy_now.ps1
```

---

## Erori comune pe acest proiect

| Eroare | Cauza probabila | Fix rapid |
|---|---|---|
| `EADDRINUSE: 3001` | backend deja pornit | opreste procesul vechi sau schimba `PORT` |
| `Unexpected token ... in JSON` la backend start | `boards.json` corupt | restaureaza fisierul JSON valid din backup |
| board-ul nu se sincronizeaza in timp real | clientul nu a trimis `board:join` | verifica ordinea join -> sync |
| frontend nu atinge API-ul | Vite proxy lipsa/incorect | verifica `frontend/vite.config.js` |

---

## Reguli de siguranta

- Nu introduce mock API nou daca exista endpoint real.
- Nu hardcoda host-uri de productie in frontend.
- Nu loga date sensibile in consola (tokeni/chei).
- Nu sterge `backend/data/boards.json` fara backup.

---

## Structura minima asteptata

```text
whiteboardclaude/
├── agents.md
├── .claude/
├── .vite/
├── ai/
│   ├── README_AGENT.md
│   ├── CONTEXT.md
│   ├── BRAIN.md
│   ├── TASKS.md
│   ├── BRAINMAP.md
│   ├── CHANGELOG_AI.md
│   ├── DECISIONS.md
│   └── database.md
├── frontend/
└── backend/
```

*Ultima actualizare: 2026-03-02*
