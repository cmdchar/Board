# CONTEXT - BoardAI

## Project overview
BoardAI este o aplicatie de whiteboard colaborativ in timp real.
Arhitectura: frontend React/Vite + backend Express/Socket.IO + persistenta JSON local.

## Tech stack
- Frontend: React 18, Vite 5, socket.io-client
- Backend: Node.js, Express 4, Socket.IO 4, uuid, dotenv
- Data store: `backend/data/boards.json`
- AI provider: DeepSeek (prin backend proxy)

## Runtime URLs (local)
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/api/health`

## Repo map
- `frontend/src/main.jsx` - React entry
- `frontend/src/App.jsx` - aplicatia principala (editor + selector board + AI panel)
- `frontend/vite.config.js` - proxy API + socket
- `backend/server.js` - REST + Socket.IO + DeepSeek proxy + JSON persistence
- `backend/.env` - config local DeepSeek
- `.claude/launch.json` - launch presets
- `.claude/settings.local.json` - local permissions
- `.vite/` - director gol (rezervat)

## Current known constraints
- Nu exista autentificare server-side.
- Identitatea userului este locala (`localStorage`, key `boardai_me`).
- `App.jsx` este monolitic (dimensiune mare), greu de mentinut.
- Persistenta este single-file JSON (fara locking transactional).
- Endpointul AI nu are inca rate-limit.
