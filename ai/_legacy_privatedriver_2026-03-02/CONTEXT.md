# PROJECT CONTEXT

## Project Overview
PrivateDriver is a multi-surface mobility platform (legacy_instant + private driver) with a React web frontend and a FastAPI backend. It supports 5 user roles (admin, support, driver, user/passenger, fleet_manager), admin and fleet dashboards, real-time updates via Socket.IO, and full messaging system. Data persistence uses MongoDB, with a Supabase bridge for legal compliance sync. The repository also contains Flutter mobile code. Frontend calls REST endpoints under /api. Deployment uses Docker containers on Ubuntu server.

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, react-router-dom, shadcn/ui (Tailwind), Recharts for charts, PWA
- **Backend**: FastAPI (Uvicorn), Pydantic, SlowAPI (rate limiting), Socket.IO
- **Database**: MongoDB (PyMongo sync + Motor async), Supabase bridge (sync/webhooks)
- **Auth**: JWT tokens (localStorage), 5 roles. Supabase Auth for Flutter mobile.
- **Realtime**: Socket.IO via backend/app/websocket/socket_handler.py — ride tracking, location, messaging
- **Maps/External Services**: OSRM routing (self-hosted), Nominatim geocoding
- **Styling**: Tailwind CSS, shadcn/ui components, lucide-react icons

## Architecture Notes

### Project Structure
```
/var/www/v4-full/
├── frontend/src/          # React app
│   ├── components/        # Reusable components (admin/, chat/, driver/, shared/, ui/)
│   ├── pages/             # Page components (admin/, driver/, fleet/, passenger/, support/)
│   ├── services/          # API client + WebSocket
│   ├── hooks/             # Custom hooks (useAuth, useToast, useMultiRoleMessages)
│   ├── types/             # TypeScript types
│   └── contexts/          # AuthContext
├── backend/app/           # FastAPI app
│   ├── routes/            # API endpoints (auth, user, driver, ride, rider, admin, fleet, conversations, etc.)
│   ├── services/          # Business logic (auth_service, supabase_bridge, ride_matching, etc.)
│   ├── models/            # Pydantic models
│   ├── utils/             # database.py, security.py
│   └── websocket/         # socket_handler.py
└── ai/                    # AI memory system (this folder)
```

### How Frontend Connects to Backend
- Frontend fetches via `/api` prefix using `fetch()` with JWT auth header
- API responses follow `{ success: true, data: { ... } }` pattern
- Auth via `useAuth()` context providing `token`
- Toast notifications via `useToast()` hook

### How Backend Connects to Database
- Sync: `get_database()` → PyMongo client
- Async: `get_async_database()` → Motor client
- Both connect to `mongodb://admin:admin@v4-mongodb:27017/privatedriver?authSource=admin`
- Supabase bridge syncs selected data to Postgres for legal compliance

## Deployment Environment (v4-full)
- **Server**: root@private-driver.ro (116.203.80.227), Ubuntu 24.04
- **Frontend**: http://v4-full.private-driver.ro:3000 → Docker: v4-frontend (nginx)
- **API**: http://v4-full.private-driver.ro:8888 → Docker: v4-backend (FastAPI/Uvicorn)
- **MongoDB**: Docker: v4-mongodb (port 27017)
- **Deploy workflow**:
  1. Local: `npm run build` (Vite)
  2. `scp dist/* root@private-driver.ro:/var/www/v4-full/frontend/dist/`
  3. `docker cp dist/. v4-frontend:/usr/share/nginx/html/`
  4. `scp backend/... root@private-driver.ro:/var/www/v4-full/backend/...`
  5. `docker cp ... v4-backend:/app/...`
  6. `docker restart v4-backend && docker exec v4-frontend nginx -s reload`

## Key Collections (MongoDB)
- `users` — all user accounts (5 roles)
- `drivers` — driver profiles (linked to users by userId)
- `rides` — active and completed rides
- `bookings` — ride requests before matching
- `conversations` — messaging conversations (with ride_id, participant info)
- `messages` — individual messages (linked to conversation_id)
- `support_tickets` — support tickets
- `notifications` — user notifications
- `system_settings` — platform configuration (messaging timeout, etc.)
- `trip_financials` — financial records per ride (OUG 49/2019)
- `legal_entities` — PFA/SRL entities for drivers
- `driver_premium` — premium driver applications and rates
- `driver_settings` — per-driver preferences

## Global Rules
- Do NOT change architecture without writing in DECISIONS.md
- Do NOT delete files unless task explicitly requires it
- Always extend existing structure when possible
- Backend uses both snake_case and camelCase fields — always handle both
- FastAPI: static routes MUST be defined BEFORE dynamic /{param} routes

