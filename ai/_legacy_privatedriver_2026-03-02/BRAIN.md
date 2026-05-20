# BRAIN – CURRENT AI STATE

## Summary
PrivateDriver v4-full mobility platform: React/Vite frontend + FastAPI backend + MongoDB + Socket.IO realtime + Supabase sync bridge. Deployed on Docker (3 containers: v4-frontend, v4-backend, v4-mongodb) at v4-full.private-driver.ro. Frontend on port 3000, API on port 8888.

**Platform Status**: 100% connected to real backend — ZERO mock data on any active page. All 5 roles working. All features deployed and live.

## Premium Fork (NEW — 2026-02-27)
- Workdir: `H:\Users\nicus\Documents\premium.private-driver.ro` (copie izolată; nu afectează `v5.private-driver.ro`)
- Scop: model **Executive Booking Only**, cu confirmare manuală și pachete programate
- Tasklist: `ai/taskpremium.md`
- Status: implementare completă + fix de producție pentru API base/VAPID aplicat și deploy live (ready for manual QA)

## Latest Update (2026-03-02, admin users endpoint 500 hotfix)
- Issue:
  - `/api/admin/users?page=1&limit=20` returned `500` in admin panel.
  - runtime error: `AttributeError: 'str' object has no attribute 'isoformat'`.
- Root cause:
  - mixed date types in Mongo (`createdAt`/`updatedAt` as `datetime` or `string`) while endpoint used direct `.isoformat()`.
- Fix:
  - `backend/app/routes/admin.py` now uses `_to_iso_or_str(...)` in:
    - `get_all_users`
    - `get_all_drivers` (preventive hardening).
  - deployed backend file to premium and restarted `privatedriver-premium`.
- Validation:
  - `python -m compileall backend/app/routes/admin.py` PASS
  - live:
    - `/api/admin/users?page=1&limit=20` -> `200`
    - `/api/admin/drivers?page=1&limit=20` -> `200`

## Latest Update (2026-03-02, admin dashboard KPI navigation links)
- Scope:
  - improve admin dashboard usability by adding direct navigation from KPI containers.
- Implemented:
  - `src/pages/admin/Dashboard.tsx` now maps KPI cards to admin routes and wraps cards with `Link`.
  - Primary cards:
    - `Total Users` -> `/admin/users`
    - `Active Drivers` -> `/admin/drivers-management`
    - `Total Rides` -> `/admin/trips`
    - `Total Revenue` -> `/admin/financial-management`
  - Secondary cards:
    - `Active Rides`/`Today's Rides` -> `/admin/trips`
    - `Avg Rating` -> `/admin/feedback`
    - `Today Revenue` -> `/admin/financial-management`
- Validation:
  - `npm run build` PASS

## Latest Update (2026-03-01, security closure + full revalidation on premium)
- Scope:
  - continue from previous `Next Steps (Exact)` with hard focus on RBAC and runtime drift checks.
- Critical security issue closed:
  - found live drift on `/api/rides/{ride_id}`:
    - server route missed `Depends(get_current_user)` and ownership checks, allowing unauthenticated access.
  - deployed secured local `backend/app/routes/ride.py` to premium runtime and restarted service.
- RBAC matrix verified live:
  - unauthenticated -> `401`
  - owner passenger (`test.user`) -> `200`
  - owner driver (`test.driver`) -> `200`
  - non-owner passenger -> `403`
  - non-owner driver (`driver.focsani`) -> `403`
  - admin staff -> `200`
- Regression found and fixed during post-hotfix E2E:
  - `/api/driver/rides/history` returned `500` (`KeyError: 'passengers'`) on mixed ride schemas.
  - patched `backend/app/routes/driver.py` history serializer to support both legacy and new ride shapes safely.
  - deployed backend patch and restarted `privatedriver-premium`.
- Final validation:
  - targeted endpoint check: `/api/driver/rides/history` -> `200`
  - full live suite: `BASE_URL=https://premium.private-driver.ro npm run e2e` -> **110/110 PASS**

## Latest Update (2026-03-01, full-system re-verification completed)
- Scope:
  - full platform audit requested across UI, frontend/backend links, role flows (`user/driver/fleet/support/admin`) and DB-connected endpoints.
- Fixes applied during audit:
  - fixed runtime crash on role auth routes (`/v2/driver/auth`, `/v2/passenger/auth`) in `RoleAuthPage` (pre-init variable usage).
  - fixed legal-compliance driver lookup compatibility:
    - compliance fleet query now supports legacy `ownerId` mapping for fleet linkage.
  - aligned E2E coverage to current business model:
    - executive booking payload includes required `driverId` and current fields;
    - replaced fragile network-wait assertions with direct authenticated API assertions on selected tests.
- Deploy:
  - backend + frontend synced to premium and service restarted.
- Final validation (live on `https://premium.private-driver.ro`):
  - full Playwright suite: **110/110 PASS**
  - confirms end-to-end operational paths across:
    - auth/login all roles
    - passenger flows
    - driver flows
    - messaging
    - support tickets
    - admin dashboards
    - executive booking lifecycle
    - API smoke + RBAC boundaries

## Latest Update (2026-03-01, live deploy + re-verification Admin/Fleet financial)
- Deployed to premium runtime:
  - backend files:
    - `backend/app/routes/fleet.py`
    - `backend/app/routes/financial_exports.py`
    - `backend/app/services/financial_exports.py`
  - frontend bundle synced to `/var/www/premium/dist/`
  - `privatedriver-premium` restarted and nginx reloaded.
- Financial export runtime status on `https://premium.private-driver.ro`:
  - Fleet exports (earnings/reports): `200` CSV downloads.
  - Admin exports (ANAF/ARR): `200` CSV downloads.
- Additional backend hardening:
  - removed dependency on `python-dateutil` for financial exports month parsing (`_month_bounds` internal helper).
- Validation:
  - health local service + public API: healthy
  - browser automation validated export button flows in Fleet UI (`/fleet/earnings`, `/fleet/reports`)
  - targeted API checks for admin/fleet financial endpoints: PASS
- Residual (outside this financial scope):
  - `e2e:admin` on premium still has 1 flaky settings-network wait assertion (`17/18` pass).
  - `e2e:smoke` driver suite fails on `403` due legal-enforcement/test-fixture mismatch (known pre-existing).

## Latest Update (2026-03-01, admin+fleet financial visibility hardening)
- Scope:
  - close remaining financial gaps so Admin/Fleet can always load real financial detail and export reports.
- Implemented:
  - Fleet Reports page wired to real CSV exports:
    - `/api/fleet/analytics/reports/export?period=...&report_type=...`
  - Fleet Reports period selector wired to backend range query:
    - `/api/fleet/analytics/reports?range=...`
  - Fleet Earnings page hardened with proper load/export error handling and user feedback (toasts).
  - Admin Financial Management now fetches complete datasets via paginated loops (instead of invalid `limit=500`):
    - trip financials via `/api/admin/trip-financials` (`skip/limit=100`)
    - invoices via `/api/invoices/all` (`page/limit=200`)
  - Auth-gated query execution added (`enabled: !!token`) for admin financial fetches.
- Validation:
  - `npm run build` PASS
  - `npm run e2e:admin` PASS (`18/18`)
  - `npm run e2e:smoke` PASS (`34/34`)
- Remaining recommended manual checks:
  - Fleet account: open `/fleet/earnings` and `/fleet/reports`, run each export type.
  - Admin account: open `/admin/financial-management`, confirm full rows are visible and both ANAF/ARR exports download.

## Latest Update (2026-03-01, all-role consolidated brainmap)
- Created final consolidated map for all dashboards/roles:
  - `ai/defalcat/brainmapAllRoles.md`
- Content includes:
  - role entrypoints + guards (user/driver/fleet/support/admin),
  - consolidated menus per role,
  - backend domain map (`auth`, `ride`, `executive`, `fleet`, `support`, `conversations`, `notifications`, `admin`, finance),
  - cross-role interaction matrix,
  - Socket.IO rooms/events topology,
  - data-layer map (Mongo primary + Supabase bridge),
  - Mermaid diagrams + machine-readable JSON graph (`nodes`/`edges`) for external AI visualization.

## Latest Update (2026-03-01, passenger dashboard audit + fixes)
- Scope: dashboard role `user`/Pasager only (routing, menus, backend connectivity).
- Confirmed/fixed issues:
  - `History` now parses `/api/rider/rides` for both wrapped and direct payload forms.
  - `Notifications` no longer filters by wrong role (`passenger`); reads full user notification stream.
  - `RideDetail` now resolves booking detail correctly via `/api/rider/rides/{id}` (with fallback to `/api/rides/{id}`).
  - `RideOptions` cancel now routes directly to `/v2/passenger` (no legacy alias hop).
  - removed stale `PassengerAuth` import from `App.tsx`.
- Validation:
  - `npm run build` PASS
  - `npm run test` PASS
- Audit doc generated:
  - `ai/defalcat/braindashboardUSER.md`

## Latest Update (2026-03-01, driver dashboard audit + fixes)
- Scope: dashboard role `driver` only (routing, menus, backend connectivity).
- Confirmed/fixed issues:
  - fixed ride-request action endpoint mismatch in frontend API service:
    - `/api/driver/rides/{id}/accept`
    - `/api/driver/rides/{id}/reject`
  - fixed broken waybill navigation from legacy ride pages (`/v2/driver/trip/current` -> `/v2/driver/trip/:id`).
  - fixed Help quick links:
    - backend defaults now point to valid routes (`/driver-guidelines`, `/safety-tips`, `/terms`)
    - frontend maps legacy URLs to valid routes as fallback.
  - token-gated fetch hardening on driver screens:
    - `Documents`, `Earnings`, `Premium`, `Settings`, `Vehicle`, `Help`
  - `PremiumDashboard` query now waits for auth token (`enabled: !!token`).
- Validation:
  - `npm run build` PASS
  - `npm run test` PASS
  - `npm run e2e:driver` PASS (`16/16`)
- Audit doc generated:
  - `ai/defalcat/braindashboardDriver.md`

## Latest Update (2026-03-01, cross user+driver audit + fixes)
- Scope: common user-driver flows only (ride lifecycle, messaging, notifications, shared ride detail endpoint).
- Confirmed/fixed issues:
  - driver home notifications now use role-agnostic list endpoint (`/api/notifications/list`) to avoid hiding valid notifications.
  - security hardening on shared ride detail endpoint:
    - `GET /api/rides/{ride_id}` now requires auth and ownership/role authorization.
- Validation:
  - `npm run build` PASS
  - `npm run test` PASS
  - `npm run e2e:passenger` PASS (`23/23`)
  - `npm run e2e:driver` PASS (`16/16`)
  - `npm run e2e:messaging` PASS (`16/16`)
  - `python -m compileall backend/app/routes/ride.py` PASS
- Audit doc generated:
  - `ai/defalcat/crossuserdriver.md`

## Latest Update (2026-03-01, legal model enforcement: fleet-only drivers)
- Implemented legal hardening in runtime:
  - driver registration is invitation-only (`driver_invitations`);
  - drivers without active `fleet + legal entity` are blocked from driver endpoints;
  - executive bookings enforce valid operator context and persist `operatorSnapshot`;
  - contract document parties are now `Passenger` + `Operator (entitate juridică)`, with driver as delegated executor.
- New fleet operations:
  - `POST /api/fleet/drivers` now issues invitation (no direct role promotion);
  - `GET /api/fleet/driver-invites`, `POST /api/fleet/driver-invites/{id}/revoke`;
  - `GET/PUT /api/fleet/legal-entity` for fleet -> legal entity linkage.
- Auth/UI:
  - `/api/auth/driver-invitation/validate` added.
  - driver register UI requires invite token and can prefill from URL.
- Live validation:
  - register driver without invite -> blocked.
  - invite + register with valid token -> PASS.
  - executive booking with legally linked driver -> PASS + contract generated.

## Remaining Go-Live Blockers (real)
1. Secret rotation (mandatory): Supabase keys, SMTP credentials, Firebase service-account key.
2. FCM final validation on real device tokens (backend channel is ready).
3. Stripe production hardening only if online card payments are required at launch.

## Latest Update (2026-03-01, launch readiness hardening)
- Fixed premium backend crash on admin dashboard:
  - endpoint: `GET /api/admin/dashboard`
  - root cause: mixed date types (`datetime` + `string`) in `createdAt`, unsafe direct `.isoformat()`
  - patch: safe serializer in `backend/app/routes/admin.py` (`_to_iso_or_str`) + usage in dashboard/fleet serialization.
- Deploy:
  - updated `/var/www/premium/backend/app/routes/admin.py`
  - restarted `privatedriver-premium` (active).
- Live role smoke:
  - admin `/api/admin/dashboard` -> 200
  - support `/api/support/tickets` -> 200
  - driver `/api/driver/home` -> 200
  - user `/api/rider/rides` -> 200
  - fleet_manager `/api/fleet/stats` -> 200
  - result: **5/5 PASS**.
- Remaining true go-live blockers:
  - Stripe production hardening (if online card payment required now)
  - FCM real-device delivery validation (backend channel is ready).

## Latest Update (2026-03-01, webhook setup unblocked for Supabase dashboard)
- Sync webhook endpoint now supports simpler auth for Supabase Database Webhooks:
  - new accepted header: `X-Sync-Token`
  - expected value: `SYNC_WEBHOOK_SECRET` from backend env
  - HMAC signature headers remain supported in parallel.
- Backend file updated/deployed:
  - `backend/app/routes/sync.py`
  - premium service restart + health PASS.
- Live checks:
  - no auth header -> `401` (`Webhook signature or sync token required`)
  - with `X-Sync-Token` -> `200` (`Webhook processed`)
- Operational effect:
  - Supabase webhooks can now be configured directly from dashboard UI without custom Edge Function for signing.

## Latest Update (2026-03-01, Supabase migration applied + end-to-end DB verification complete)
- User confirmed migration execution in Supabase dashboard.
- Full post-migration validation performed:
  - Supabase core bridge tables now exist and are queryable.
  - `POST /api/sync/full` now performs real sync (non-zero totals).
- Runtime compatibility fix applied and deployed:
  - `supabase_bridge.py` patched to:
    - remove `is_online` from driver sync payload (schema compatibility),
    - support `userId`/`user_id`,
    - sync documents from `documents` OR `compliance_documents` (fallback),
    - normalize legacy/compliance document fields.
- Live sync result after patch:
  - `users=14`, `drivers=5`, `vehicle_documents=5`, `audit_logs=186`, `conversations=25`, `messages=35`, `support_tickets=3`.
- Role/database communication status:
  - all 5 roles can access and operate their DB-backed endpoints;
  - RBAC denies remain correct on restricted admin endpoints;
  - messaging privacy gates remain enforced (`403` for unrelated peer chats).
- Remaining operational item:
  - ensure Supabase database webhook is configured to `POST /api/sync/webhook/supabase` with `SYNC_WEBHOOK_SECRET` (if not already set in dashboard).

## Latest Update (2026-03-01, full DB audit across Mongo + Supabase + all roles)
- MongoDB premium runtime (`privatedriver_premium2`) verified:
  - core collections present and active (`users`, `drivers`, `bookings`, `conversations`, `messages`, `notifications`, `system_settings`, etc.)
  - role records confirmed for all 5 roles (`admin`, `support`, `driver`, `user`, `fleet_manager`)
- API role matrix verified live on `premium.private-driver.ro`:
  - each role can access own DB-backed endpoints (`/auth/me`, role dashboards, conversations, notifications)
  - RBAC boundaries confirmed (`/api/admin/dashboard` returns `403` for non-admin roles)
- Messaging/privacy matrix verified:
  - `user -> support` create/send: PASS
  - `driver -> fleet_manager` create/send: PASS
  - `support` reply in thread: PASS
  - `driver -> unrelated user` create blocked with `403`: PASS
  - stored `messages.sender_name` aligns with profile names.
- Support ticket DB write path validated end-to-end:
  - tickets created by `user`, `driver`, `fleet_manager`
  - status updates by `support` to `closed` PASS
  - persisted in Mongo (`support_tickets` count increased and closed).
- Supabase new project audit remains the main blocker:
  - present tables: `legal_entities`, `trip_financials`, `invoices`
  - missing bridge core tables: `users`, `rides`, `drivers`, `vehicle_documents`, `audit_logs`, `conversations`, `messages`, `support_tickets`, `location_history`
  - `/api/sync/status` is healthy but `/api/sync/full` remains zero-synced until migration is executed.
- Next mandatory ops:
  - run `supabase/migrations/20260301_create_bridge_core_tables.sql`
  - configure Supabase DB webhook to `/api/sync/webhook/supabase` with `SYNC_WEBHOOK_SECRET`.

## Latest Update (2026-03-01, Supabase premium project wiring)
- New Supabase project credentials received and wired:
  - local frontend `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - local backend `backend/.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SYNC_WEBHOOK_SECRET`
  - server backend `/var/www/premium/backend/.env`: same keys applied + service restart
  - mobile local config `mobile/env.json` switched to new project URL/key.
- Live runtime:
  - `privatedriver-premium` restarted successfully
  - `GET https://premium.private-driver.ro/api/health` -> healthy
  - `GET /api/sync/status` -> healthy (bridge process active)
- Supabase schema audit on new project:
  - present: `legal_entities`, `trip_financials`, `invoices`
  - missing bridge/mobile core tables: `users`, `rides`, `drivers`, `vehicle_documents`, `audit_logs`, `conversations`, `messages`, `support_tickets`, `location_history`
- New migration prepared for SQL Editor:
  - `supabase/migrations/20260301_create_bridge_core_tables.sql`
  - includes core tables + indexes + RLS baseline policies (`users`, `rides`, `location_history`)
- Remaining to complete Supabase integration:
  - run the new migration in Supabase project
  - configure Supabase DB webhook to `https://premium.private-driver.ro/api/sync/webhook/supabase`
  - use configured `SYNC_WEBHOOK_SECRET` on both sides.

## Latest Update (2026-03-01, FCM v1 secret provisioned + channel live on premium)
- Service-account credential uploaded on server:
  - local source: `private-driver-e0996-firebase-adminsdk-fbsvc-d8e7fa4d2a.json`
  - target: `/var/www/premium/backend/secrets/firebase-service-account.json`
  - permissions hardened: `600`, owner `root:root`
- Runtime actions:
  - restart `privatedriver-premium`
  - health check: `GET https://premium.private-driver.ro/api/health` -> healthy
- Push diagnostics (driver + passenger smoke):
  - `GET /api/notifications/push/health`:
    - `activeChannel=v1`
    - `v1Configured=true`
    - `projectId=private-driver-e0996`
    - `v1Error=null`
  - `POST /api/notifications/push/test-self`:
    - `fcm.attempted=true`
    - `fcm.success=false` with `No fcmToken found for current user`
    - `webPush.deliveredCount=0`
- Status:
  - backend FCM v1 operational blocker is resolved (secret path now valid).
  - remaining for full completion: real device login/subscription to write `fcmToken`/web device + final end-to-end delivery check.
- Security note:
  - key used in prior chat context should still be rotated in Firebase and replaced server-side for production hygiene.

## Latest Update (2026-02-28, non-Stripe completion sweep + docs sync)
- Verified and finalized all non-Stripe backlog items in code:
  - message full-text search (`/api/conversations/search/messages`) + UI integration
  - canned responses CRUD (`/api/support/canned-responses`) + picker in chat
  - premium booking realtime (`executive_booking_status`) replacing passenger polling
  - push readiness endpoints (`/api/notifications/push/health`, `/api/notifications/push/test-self`)
  - legacy premium-instant page files removed from `src/pages`
- Runtime hardening:
  - fixed `notifications.py` model-order bug (`PushSelfTestRequest` defined before usage) to avoid import-time failures.
- Cleanup alignment:
  - `project_map.py` updated to reflect redirect-only legacy routes.
- Current audited metrics:
  - frontend routes: `134`
  - frontend page files: `118`
  - backend route files: `33` (`32` include_router + `rider_router`)
  - backend endpoints: `304`
- Local validation rerun:
  - `npm run build` -> PASS
  - `python -m compileall` for touched backend routes/services -> PASS

## Latest Update (2026-02-28, FCM operational validation on premium)
- Deployed live on server:
  - `backend/app/routes/notifications.py`
  - `backend/app/services/notification_service.py`
  - service restart `privatedriver-premium` + health check PASS.
- Ran push validation across all 5 test roles using:
  - `GET /api/notifications/push/health`
  - `POST /api/notifications/push/test-self`
- Runtime outcome:
  - endpoint layer works (no longer 404)
  - `fcm.configured=false` (missing server key)
  - `hasFcmToken=false` for all test users
  - test response returns `No fcmToken found for current user`
- Server + DB audit confirms operational blocker:
  - `FCM_SERVER_KEY` missing in premium/x/v4 envs
  - Mongo users with `fcmToken`:
    - `privatedriver`: `0`
    - `privatedriver_premium2`: `0`
- Status:
  - backend readiness DONE
  - real-device delivery validation pending key + token provisioning

## Latest Update (2026-03-01, FCM v1 support rollout)
- Backend push service upgraded to support Firebase HTTP v1 via service account:
  - `FCM_MODE=auto|v1|legacy`
  - service-account credentials source:
    - `FCM_SERVICE_ACCOUNT_FILE` or `FCM_SERVICE_ACCOUNT_JSON`
  - fallback to legacy key remains available.
- Premium deploy completed:
  - `notification_service.py` deployed
  - `google-auth` installed in premium venv
  - service restarted healthy.
- Current premium env:
  - `FCM_MODE=v1`
  - `FCM_PROJECT_ID=private-driver-e0996`
  - `FCM_SERVICE_ACCOUNT_FILE` configured, but target file missing.
- Health check confirms blocker:
  - `/api/notifications/push/health` returns `activeChannel=none` and `v1Error=Service account file not found`.
- Security blocker:
  - service-account private key shared in chat must be rotated/revoked before production validation.

## Latest Update (2026-02-28, messaging privacy window enforcement + role tabs)
- Privacy policy for direct chat is now enforced backend-first:
  - staff channels (`admin/support/fleet_manager`) remain always available
  - non-staff direct chat requires shared ride/booking context
  - chat window for completed rides uses configurable timeout from `system_settings.messaging.timeout_after_ride_hours`
  - default fallback timeout is now `8` hours
- Backend path:
  - `backend/app/routes/conversations.py`
  - enforced create/send/contact rules for peer chats (`403` when no ride context)
- Frontend path:
  - `src/pages/passenger/Messages.tsx`
  - `src/pages/driver/Messages.tsx`
  - separate tabs live: `Toate`, `Support`, `Admin`, `Fleet`
  - quick actions live: `Mesaj Support`, `Mesaj Admin`, `Mesaj Fleet`
- Live validation on `premium.private-driver.ro`:
  - `GET /api/health` healthy
  - user contacts return staff roles (`support/admin/fleet_manager`)
  - temp user -> temp user direct create (no ride) -> `403` (expected)
  - temp user -> support/admin/fleet direct create -> `200` (expected)
  - driver -> unrelated temp user direct create -> `403` (expected)
  - admin/fleet -> unrelated temp user direct create -> `200` (expected)
  - sending in non-ride peer conversation (`ride_id=null`) -> `403`
  - sending in support/fleet conversation -> `200`
  - Playwright UI check confirms tabs/buttons present on:
    - `/v2/passenger/messages`
    - `/v2/driver/messages`

## Latest Update (2026-02-28, messaging cross-role + profile-name consistency)
- Messaging API and UI hardened for requested communication matrix:
  - user <-> driver
  - user/driver -> support/admin/fleet manager
- Backend:
  - `conversations.py` now resolves participant names/roles live from `users` collection for list/detail responses
  - new endpoint `GET /api/conversations/contacts` with role-scoped contact discovery
- Frontend:
  - passenger and driver Messages pages include quick-start buttons:
    - `Mesaj Support`
    - `Mesaj Admin`
    - `Mesaj Fleet`
  - chat components no longer depend on missing `localStorage.userId`; fallback uses `user_data.id` (fixes own/other detection + read behavior)
  - support message views prefer dynamic participant labels
- Live validation on `premium.private-driver.ro`:
  - contacts endpoint returns expected roles for user and driver
  - bidirectional send PASS on pairs:
    - user<->driver, user<->support, driver<->support, user<->admin, driver<->fleet
  - sender name consistency PASS: `message.sender_name == /api/auth/me name`

## Latest Update (2026-02-28, SMTP email activ pe premium)
- Email delivery layer upgraded:
  - `notification_service.py` supports `EMAIL_PROVIDER=auto|smtp|sendgrid`
  - SMTP authenticated transport added (SSL/STARTTLS, timeout, sender identity)
  - `auto` mode now prefers SMTP and falls back to SendGrid
- Premium production config:
  - SMTP credentials configured on server (`mail.smart-promotions.ro`)
  - connectivity check showed `465` timeout from server; switched live config to `587 + STARTTLS`
  - service restarted: `privatedriver-premium`
- Live validation:
  - direct SMTP send from backend service returns success (`status_code=250`, message-id present)
  - executive lifecycle email audit no longer `skipped`/`failed` for tested flow
  - `communication_logs` for smoke booking now shows `status=sent` on templates:
    - `executive_booking_request_received`
    - `executive_booking_driver_memento_created`
    - `executive_booking_confirmed`
  - smoke bookings canceled afterward (`cancelled_by_operator`) for DB hygiene

## Latest Update (2026-02-28, auto contract PDF per booking + in-app download)
- Contract artifact system implemented end-to-end:
  - NEW service `backend/app/services/executive_contract_service.py`
    - auto-generates contractual PDF snapshots per booking stage
    - archives files in `uploads/executive_contracts/{bookingId}/`
    - persists metadata in new collection `booking_contracts`
    - computes/stores SHA-256 hash for integrity
    - updates booking with `contractDocument` (latest metadata + download URL)
  - generation wired in executive lifecycle:
    - create (`pending_confirmation`)
    - driver/admin confirm (`confirmed`)
    - wait stop (`wait_updated`)
    - cancel (`cancelled_*`)
    - complete (`completed`)
  - dedicated contract APIs:
    - `GET /api/executive/bookings/{booking_id}/contracts`
    - `GET /api/executive/bookings/{booking_id}/contracts/latest`
    - `GET /api/executive/bookings/{booking_id}/contracts/latest/download`
    - `GET /api/executive/bookings/{booking_id}/contracts/{contract_id}/download`
- Frontend wiring:
  - `PremiumRideRequest` includes direct contract download button + latest version metadata
  - `ExecutiveBookings` (driver) includes `Contract PDF` action on active cards
  - `api.ts` extended with contract metadata/types and download API
- Communication hooks:
  - executive lifecycle now attempts email notifications (create/confirm/memento/cancel/complete)
  - every email attempt is audited in `communication_logs` (`sent` / `skipped` / `failed`)
  - when SendGrid is not configured, status is `skipped` without blocking booking flow
- Runtime hardening:
  - WeasyPrint runtime mismatch observed on server (`PDF.__init__...`)
  - fallback minimal PDF generator added inside contract service; contract flow remains operational even if WeasyPrint stack is broken
- Live validation done:
  - create booking -> contract metadata present
  - passenger download -> 200 `application/pdf`
  - driver confirm -> confirmed contract snapshot generated
  - driver download latest -> 200 `application/pdf`
  - contract history endpoint returns archived versions
  - `BASE_URL=https://premium.private-driver.ro npm run e2e:executive` -> `9/9 PASS` (includes contract metadata + PDF download checks)

## Latest Update (2026-02-28, driver reject reroute flow)
- Core behavior change:
  - refuzul șoferului NU mai anulează booking-ul (`cancelled_by_driver`)
  - booking-ul este rerutat automat către alți șoferi (`pending_confirmation`, `driverUserId=null`)
- Backend routing logic:
  - tracking pe booking:
    - `rejectedDriverIds`
    - `driverRejectionCount`
    - `lastDriverRejection`
    - `assignmentState=searching_next_driver`
  - șoferul care refuză este exclus din lista pending pentru acel booking
  - la refuz se notifică:
    - pasagerul (`Șofer indisponibil`, cerere redirecționată)
    - pool de șoferi online eligibili (`Cerere executive disponibilă`)
  - la confirmare, dacă șoferul există în `rejectedDriverIds`, confirmarea este blocată
- Frontend:
  - `PremiumRideRequest` afișează mesaj explicit de rerouting când booking-ul e în `searching_next_driver`
  - `ExecutiveBookings` mesaj de reject actualizat la semantică de redirecționare
- Live validation done:
  - reject response: `status=pending_confirmation`, `rerouted=true`
  - rejected driver nu mai vede booking-ul
  - alt driver îl vede în pending
  - pasagerul primește notificare de indisponibilitate + rerouting

## Latest Update (2026-02-28, driver reminders + navigation in executive flow)
- Driver acceptance flow extended:
  - la confirmare rezervare se creează memento explicit pentru șofer (`Memento rezervare creat`)
  - booking-ul primește stare `driverReminder` (accept time + remind time + ready notification guard)
- Time-based start readiness:
  - `GET /api/executive/bookings/driver/active` trimite notificare „Cursa este gata de pornire” când `scheduledStartAt <= now` (o singură dată per booking)
- Driver UI executive:
  - `ExecutiveBookings` permite `Start cursă` doar în fereastra de start (10 minute înainte de ora programată) sau dacă deja e `in_service`
  - înainte de fereastră: buton disabled cu countdown „Disponibil în ...”
  - butoane de navigare rapide adăugate în card:
    - Google Maps
    - Waze
  - target navigation:
    - pre-start -> pickup
    - in_service -> următoarea oprire nefinalizată, altfel destinația finală
- Validation/deploy:
  - backend compile PASS
  - frontend build PASS
  - live smoke: confirm booking -> memento driver prezent în `/api/notifications/list?role=driver`

## Latest Update (2026-02-28, one-way fare hotfix for `trip_km`)
- Root issue fixed:
  - `trip_km` tarifare aliniată la cerință: taxare doar pe traseul dus (pickup -> opriri -> destinație), fără retur.
- Backend:
  - `backend/app/services/executive_pricing.py`
    - `calculate_executive_trip_quote` nu mai adaugă componenta de timp în `rawAmount` pentru modul `trip_km`
    - formula activă: `rawAmount = distanceKm * perKmRate`, cu `minimumFare` păstrat
    - `_normalize_route_points` ignoră puncte consecutive duplicate (guard anti-umflare rută)
  - hotfix deployat live pe `premium.private-driver.ro` (service restart `privatedriver-premium`)
- Frontend:
  - `PremiumRideRequest` afișează explicit că tarifarea `trip_km` este doar dus, fără retur
  - `PrivateDriverProfile` clarifică estimarea „Calcul doar pe dus, fără retur”
- Validation:
  - `python -m compileall backend/app/services/executive_pricing.py` PASS
  - `npm run build` PASS
  - `/api/health` live `200`
  - smoke estimate live confirmă formula one-way (raw = km x tarif/km)

## Latest Update (2026-02-28, pricing model refactor: trip_km default + hourly_hire explicit)
- Root issue fixed:
  - premium booking no longer auto-forces hourly package pricing
  - default booking path is now `trip_km` (route-based fare for A -> stops -> B)
- Backend:
  - new estimate endpoint: `POST /api/executive/estimate`
  - booking payload supports:
    - `pricingMode`: `trip_km` | `hourly_hire`
    - `hourlyHours` (for hourly hire)
  - create booking computes pricing via shared deterministic context:
    - `trip_km`: distance/time/min-fare + planned stop fixed fees
    - `hourly_hire`: `hours * hourlyRate` + planned stop fixed fees
  - pricing resolver expanded to ride/hour hierarchy:
    - `admin -> fleet -> pfa/srl -> driver`
  - stop/wait lifecycle logic remains active and compatible with new pricing modes
- Frontend:
  - `PremiumRideRequest` now has explicit mode selector:
    - `Cursă punctuală (tarif pe km)` (default)
    - `Închiriere șofer pe oră` + hour input
  - page uses live estimate API for accurate pricing snapshot before submit
  - submit sends `pricingMode` + `hourlyHours` as needed
  - driver executive cards now display meaningful title even when booking has no package (`trip_km`)
- Role pricing configuration aligned:
  - admin settings: global `executiveRidePricing`
  - fleet settings: override `executiveRidePricing`
  - legal entities (PFA/SRL): override `executiveRidePricing`
  - driver premium rates: includes `hourlyRate`
- Validation:
  - `python -m compileall backend/app` PASS
  - `npm run build` PASS

## Latest Update (2026-02-28, route reordering controls in PremiumRideRequest)
- Added route reordering directly in booking request page:
  - swap pickup/destination
  - move pickup down
  - move destination up
  - move each stop up/down
- Reordering works across boundaries:
  - first stop can replace pickup
  - last stop can replace destination
- State remains consistent after each move:
  - updates `pickup`, `destination`, `stops`
  - keeps `selectedDriver` and `estimatedPrice`
- Booking safety unchanged:
  - controls are disabled after leaving `draft` state.
- Validation:
  - `npm run build` PASS
  - live UI check confirms `Inversează pickup/destinație` + `Sus/Jos` controls visible
- Deploy:
  - release `release/privatedriver-x-20260228-092600.tar.gz`
  - live on `premium.private-driver.ro`, health OK

## Latest Update (2026-02-28, editable route points in PremiumRideRequest)
- Passenger can now edit route points directly from executive booking request page:
  - edit pickup
  - add/edit/remove stops
  - edit destination
- `DestinationSearch` now supports premium return flow with explicit edit modes:
  - `pickup`, `destination`, `add_stop`, `edit_stop`
  - returns to `/v2/passenger/premium-ride-request` with updated route state
- Driver selection context is preserved while editing (`selectedDriver`, `estimatedPrice` remain attached).
- Safety rule kept:
  - route editing controls are active only while booking is in `draft` state.
- Validation:
  - `npm run build` PASS
  - smoke check confirmed search opens with context title (`Editează pickup`)
- Deploy:
  - release `release/privatedriver-x-20260228-091846.tar.gz`
  - live on `premium.private-driver.ro`, health OK

## Latest Update (2026-02-28, itinerary map centering fixed)
- Fixed centering issue where `PremiumRideRequest` map could open outside itinerary area.
- `pickup` and `destination` are now normalized robustly (supports nested objects + numeric strings).
- `MapView` fit-bounds now includes full route polyline coordinates (not only start/end), keeping route anchored in viewport.
- Validation (live):
  - route is drawn
  - pickup/stop/destination markers are all visible inside map bounds
  - stop marker numbering remains active
- Deploy:
  - release `release/privatedriver-x-20260228-090327.tar.gz`
  - live on `premium.private-driver.ro`, health OK

## Latest Update (2026-02-28, map itinerary stops visible + numbered stop markers)
- `MapView` suportă acum marker stop dedicat:
  - cerc numerotat pentru opriri (`1`, `2`, `3`, ...)
  - fallback `x` dacă indexul nu este disponibil
- `PremiumRideRequest` normalizează opririle indiferent de formatul din state (`stop.lat/lng` sau `stop.location.lat/lng`)
- itinerariul folosește opririle normalizate pentru:
  - `routeVia` (A -> opriri -> B)
  - marker-ele stop (`stopOrder`)
  - payload booking (`stops`)
- map visibility:
  - `fitAllMarkers` activat pe `PremiumRideRequest` ca să se vadă traseul complet cu opriri
- Validation:
  - `npm run build` -> PASS
  - live check (browser automation) confirmă marker text `1` pe hartă + `Oprire 1` în sumar
- Deploy:
  - release `release/privatedriver-x-20260228-085628.tar.gz`
  - live pe `premium.private-driver.ro`, service `privatedriver-premium`, health OK

## Latest Update (2026-02-28, stop/wait contract flow + unlimited stops + role pricing)
- Core executive flow extins end-to-end:
  - backend wait lifecycle complet (`start-service`, `complete-service`, `wait/start`, `wait/stop`, `driver/active`)
  - contract charging logic stabilizat (fără dublare taxă fixă pe opririle planificate)
- Passenger flow:
  - opriri nelimitate în Home + RideOptions
  - `stops` propagate complet pe flow premium (`PrivateDrivers -> PrivateDriverProfile -> PremiumRideRequest`)
  - `PremiumRideRequest` afișează harta cu itinerariu A -> opriri -> B și trimite `stops` în booking payload
- Driver flow:
  - dashboard executive are acum și rezervări active + acțiuni operaționale:
    - Start cursă
    - Start așteptare
    - Continuă cursa (stop wait)
    - Finalizează cursa
- Pricing hierarchy (admin/fleet/pfa/driver):
  - resolver backend: `admin -> fleet -> pfa -> driver`
  - UI configurare:
    - admin settings: global `executiveStopPricing`
    - fleet settings: override `executiveStopPricing`
    - driver premium: `stopFixedFee` + `freeWaitMinutes`
    - admin financial management: inline edit `executiveStopPricing` pentru entități PFA
- Validation:
  - `npm run build` -> PASS
  - `python -m compileall backend/app` -> PASS

## Latest Update (2026-02-28, pricing transparency for client)
- Passenger pricing disclosure improved across booking journey:
  - `RideOptions`: executive notice now states estimated fare can be adjusted for long stops
  - `PrivateDriverProfile`: explicit stop/wait tariff rule shown with driver-specific values
  - `PremiumRideRequest`: dedicated warning card + checkbox wording confirms client acknowledges final fare may increase beyond free-wait threshold
- Validation:
  - `npm run build` -> PASS

## Latest Update (2026-02-28, reservation UI visibility + concrete request details)
- Fixed overlap on reservation pages where fixed bottom CTA covered lower content:
  - `PrivateDriverProfile`: increased bottom safe spacing for full readability above CTA
  - `PremiumRideRequest`: increased bottom spacing to keep cards/buttons visible
- Added explicit concrete booking details on ride request page:
  - pickup location
  - destination location
  - current estimated fare
- Deploy completed live on premium domain:
  - archive: `release/privatedriver-x-20260228-084657.tar.gz`
  - target: `premium.private-driver.ro` (`/var/www/premium`, service `privatedriver-premium`, port `8915`)
- Live UI validation (automated):
  - footer buttons visible/not clipped
  - concrete booking detail fields present on `PremiumRideRequest`

## Latest Update (2026-02-28, functional verification + legal compliance pack)
- Functional verification:
  - `npm run build` -> PASS
  - backend compile checks (main/routes/services cheie) -> PASS
  - `BASE_URL=https://premium.private-driver.ro npm run e2e:executive` -> `9/9 PASS`
  - premium API smoke:
    - login `200` pentru toate rolurile test
    - `rides/config` `200` (mode `executive_only`)
    - admin/support/driver/user/fleet role endpoints -> `200`
      - support check final pe `/api/support/tickets` + `/api/conversations` (nu `/api/support/dashboard`, care nu există)
- Legal/compliance deliverable:
  - fișier nou `Firma.MD` creat în root cu:
    - model legal recomandat (intermediere + operator)
    - CAEN Rev.3 recomandate (`5232`, `4933` + CAEN tech suport)
    - pași după înființare firmă (ANAF/ARR/platform authorization/GDPR)
    - design contract automat per cursă (contract-cadru + anexă per booking)
    - listă surse oficiale pentru validare juridică

## Latest Update (2026-02-28, `/legal` live aligned to auto-contract model)
- Updated public legal pages to reflect contract-per-booking legal flow:
  - `src/pages/public/LegalDocumentsPage.tsx`
  - `src/pages/public/PassengerTransportContractPage.tsx`
- Key updates live on `https://premium.private-driver.ro/legal`:
  - explicit `Per rezervare` badge for passenger transport contract
  - wording `Contract-cadru + anexă automată per rezervare confirmată`
  - FAQ + legal notice aligned to automatic contractual document per confirmed booking
  - cookies route fixed (`/cookies`)
- Validation:
  - `npm run build` passed
  - frontend synced to `/var/www/premium/dist` + nginx reload
  - live page text markers confirmed via browser automation

## Latest Update (2026-02-28, Passenger page unblocked when GPS permission is denied)
- Issue:
  - on `/v2/passenger`, denied/pending geolocation states were fully blocking UI and users could not continue with manual address flow
- Fix:
  - `src/pages/passenger/Home.tsx` no longer hard-blocks page on denied/pending location
  - added non-blocking location warning banner with:
    - retry location action
    - manual pickup action (`/v2/passenger/search`)
  - `src/components/gdpr/CookieConsentBanner.tsx` link corrected to `/cookies`
- Validation:
  - `npm run build` -> pass
  - frontend redeployed on `premium.private-driver.ro`
  - passenger click-check script confirms interactive search controls available (`where_button_found=true`, no click errors)

## Latest Update (2026-02-28, New premium drivers seeded by city)
- Added 4 real driver accounts in premium DB `privatedriver_premium2`:
  - Focșani: `driver.focsani@private-driver.ro`
  - Galați: `driver.galati@private-driver.ro`
  - București: `driver.bucuresti@private-driver.ro`
  - Botoșani: `driver.botosani@private-driver.ro`
- Each driver has:
  - Mongo user (`role=driver`, test password hash),
  - driver profile (`driver_status=online`, location coordinates, vehicle data),
  - approved premium profile (`driver_premium.status=approved`)
- Frontend county filters updated to expose requested locations:
  - `src/pages/passenger/PrivateDrivers.tsx` includes `Focșani` and `Botoșani`
- Validation:
  - `/api/premium/drivers` returns all 4 drivers (online)
  - login test for new driver account successful
  - frontend deployed live on premium domain

## Latest Update (2026-02-28, Dynamic counties + location-scoped premium drivers list)
- Passenger driver selection page updated to match requested behavior:
  - counties list is now dynamic from real available drivers (no static hardcoded list)
  - default mode is location-scoped (nearby drivers only)
  - full national list is available only via explicit toggle button (`Deblochează lista completă`)
- Backend support added:
  - `/api/premium/drivers` accepts `lat/lng`, returns driver `location`, and computes `distance`
  - response sorting prioritizes online + nearest + higher rating
- Frontend files updated:
  - `src/pages/passenger/PrivateDrivers.tsx`
  - `src/types/ride.ts`
- Backend file updated/deployed:
  - `backend/app/routes/premium.py`
- Validation:
  - backend compile pass
  - frontend build pass + redeploy
  - API checks confirmed distances for Focșani/Galați/București/Botoșani drivers relative to client coordinates

## Latest Update (2026-02-27, Premium DB isolation final fix + test auth restore)
- Incident:
  - login pentru toate rolurile pica cu `401 Invalid email or password` după migrarea pe baza nouă
- Root cause:
  - backend premium rula pe DB greșită în `.env`: `privatedriver_premium22` (goală), nu pe baza izolată pregătită (`privatedriver_premium2`)
- Fix:
  - audit DB-uri în Mongo (`privatedriver_premium2` vs `privatedriver_premium22`)
  - corectat `.env` premium:
    - `MONGO_URI` -> `.../privatedriver_premium2?authSource=admin`
    - `MONGODB_URL` -> `.../privatedriver_premium2?authSource=admin`
  - restart `privatedriver-premium`
  - sincronizat hash-urile de parolă pentru cele 5 conturi test în `privatedriver_premium2`
- Verificări:
  - `systemctl is-active privatedriver-premium` -> `active`
  - login API pe `https://premium.private-driver.ro/api/auth/login` -> `200` pentru:
    - admin (`test.admin@private-driver.ro`)
    - support (`test.support@private-driver.ro`)
    - driver (`test.driver@private-driver.ro`)
    - user (`test.user@private-driver.ro`)
    - fleet_manager (`fleet.user@private-driver.ro`)

## Latest Update (2026-02-27, production fallback fix: `api.example.com` + VAPID)
- Incident observat în browser:
  - `ERR_NAME_NOT_RESOLVED` pe `api.example.com/conversations` și `api.example.com/rides/config`
  - `InvalidAccessError` la push subscribe (applicationServerKey invalid)
- Fix:
  - helper nou `src/lib/runtimeConfig.ts` pentru normalizare API base + validare VAPID key
  - toate modulele frontend care foloseau direct `VITE_API_URL` migrate la `API_BASE_URL`
  - `usePushNotifications` ignoră chei VAPID placeholder și validează cheia de server înainte de subscribe
  - `realtimeNotifications` SSE URL corectat la `/api/notifications/realtime/connect`
  - `.env` + `.env.example` ajustate la defaults sigure (`VITE_API_URL=/api`, VAPID gol)
- Deploy + server config:
  - release `release/privatedriver-x-20260227-233138.tar.gz` pe `premium.private-driver.ro`
  - VAPID configurat pe backend premium și serviciu restartat
- Verificări:
  - bundle live `assets/index-Cz7_pvvC.js` fără `api.example.com`
  - `/api/rides/config` auth -> 200
  - `/api/conversations?page=1&limit=50` auth -> 200
  - `/api/notifications/vapid-public-key` -> 200 (key valid)
  - Playwright executive -> `9/9 passed`

## Latest Update (2026-02-27, Full repo cleanup + final validation)
- Cleanup complet aplicat în repo:
  - runtime (`src`, `backend/app`, `public`, `index.html`)
  - seed/test support (`backend/seed*`, `backend/tests`)
  - docs și instrucțiuni (`agents.md`, `.github/`, `skills/`, `docs/`, `important.md`, `ai/`)
  - mobile assistant wording (`mobile/README.md`, `mobile/lib/services/ai_*`)
- Verificări finale:
  - scan global repo pentru termeni legacy: zero rezultate
  - `npm run build`: pass (`assets/index-DyZyT_fg.js`)
  - `python -m py_compile` pe fișierele backend modificate: pass
  - Playwright executive suite live: `9/9 passed`
- Live premium:
  - `https://premium.private-driver.ro` -> 200
  - `https://premium.private-driver.ro/api/health` -> `PrivateDriver Premium API is running`

## Latest Update (2026-02-27, Zero-trace legacy_instant cleanup + premium redeploy)
- Runtime cleanup final (fără urme legacy_instant/instant în codul activ `src` + `backend/app` + metadata publică):
  - `backend/app/main.py`: OpenAPI description + `/health` + root message rebranduite la `PrivateDriver Premium`
  - `backend/app/routes/driver.py`: ARR description aliniată la executive booking
  - `src/i18n/ro.ts`, `src/i18n/en.ts`: copy landing mutat la wording operațional executive
  - `index.html`, `public/icons/manifest.json`: SEO/PWA metadata aliniate la modelul premium
- QA/Validation:
  - scan runtime: `rg ... src backend/app public index.html` -> zero match pentru `legacy_instant|legacy-instant|instant|transport programat|rezervare rapidă`
  - `npm run build` -> pass (`assets/index-DyZyT_fg.js`)
  - `python -m py_compile backend/app/main.py backend/app/__init__.py backend/app/routes/driver.py` -> pass
- Deploy:
  - release: `release/privatedriver-x-20260227-222508.tar.gz`
  - target: `premium.private-driver.ro` (`/var/www/premium`, `privatedriver-premium`, `8915`)
  - post-deploy backend sync: `main.py` + `__init__.py` și restart service
- Live:
  - homepage `200`, bundle activ `assets/index-DyZyT_fg.js`
  - `/api/health` -> `{"status":"healthy","message":"PrivateDriver Premium API is running"}`

## Latest Update (2026-02-27, Premium Full Alignment Pass + E2E + redeploy)
- Frontend premium alignment (authenticated flows):
  - `src/pages/passenger/Onboarding.tsx` rescris pe rezervare executive (fără matching instant).
  - `src/pages/driver/Onboarding.tsx` forțează onboarding `private_hire` (fără alegere legacy_instant).
  - `src/pages/driver/Documents.tsx` forțează documente `private_hire`, elimină selector legacy_instant din UI.
  - `src/pages/admin/DocumentVerification.tsx` fallback `serviceType=private_hire` + badge UI aliniat.
  - `src/pages/admin/FinancialManagement.tsx` copy aliniat la rezervări executive.
- Backend alignment:
  - `backend/app/routes/driver.py` normalizează `serviceType=private_hire` în `executive_only` la submit onboarding.
  - `backend/app/routes/gdpr.py` actualizează textul politicii pentru model executive booking.
- QA automat:
  - suită nouă Playwright: `e2e/executive/executive-booking.spec.ts` (pasager create/list/cancel, driver pending+confirm, admin package CRUD).
  - script nou: `npm run e2e:executive`.
  - rezultat: `9/9 passed` pe `https://premium.private-driver.ro` (include setup auth).
- Deploy:
  - release: `release/privatedriver-x-20260227-220023.tar.gz`
  - target: `premium.private-driver.ro` (`/var/www/premium`, `privatedriver-premium`, port `8915`)
  - live checks: homepage `200`, `/api/health` healthy, bundle activ `assets/index-BQtMR7HD.js`.

## Latest Update (2026-02-27, Premium Landing Repositioning + redeploy)
- Landing page messaging actualizat complet pentru modelul premium executive booking:
  - `src/i18n/ro.ts` (`landing.*`) rescris pe rezervări executive, confirmare manuală, pachete orare/transfer.
  - `src/i18n/en.ts` (`landing.*`) aliniat la același positioning.
- Redeploy live executat pe instanța premium:
  - release: `release/privatedriver-x-20260227-211816.tar.gz`
  - domeniu: `https://premium.private-driver.ro`
  - service: `privatedriver-premium`
- Verificare:
  - homepage `200` și bundle nou activ (`assets/index-x1PPoJHq.js`)
  - screenshot nou: `ai/screenshots/premium-home-public-20260227-landing-v2.png`

## Latest Update (2026-02-27, Premium Executive Completion Pass)
- Backend:
  - `driver.py` blochează explicit endpointurile instant în `executive_only` (`ride-requests`, `ride accept/reject`)
  - `executive.py` + `driver.py` scriu `communication_logs` pentru notificările din lifecycle executive
  - `admin.py` are CRUD complet pentru `service_packages` sub `/api/admin/executive/packages`
- Frontend:
  - `DriverHome` consumă config executive și afișează doar pending executive bookings în loc de instant ride requests
  - `RideOptions` nu mai navighează către `finding-driver`
  - `App.tsx` redirecționează rutele legacy (`finding-driver`, `driver-matched`, `driver/incoming-request`)
  - `vite.config.ts` elimină shortcuturile PWA instant
  - `AdminSettings` include control executive flags + management complet pachete (`service_packages`)
- Validare:
  - `python -m py_compile` trecut pe fișierele backend modificate
  - `npm run build` trecut

## Next Steps (Exact)
1. Rulează QA manual UI pe premium pentru noile acțiuni contractuale:
   - pasager: `PremiumRideRequest` (download contract în `pending` + `confirmed`)
   - șofer: `ExecutiveBookings` (download `Contract PDF` pe booking activ)
   - acces control: verifică că utilizatorii neparticipanți primesc `403` pe download contract.
2. Decide formatul final legal al contractului PDF (template text, clauze, branding firmă) împreună cu avocatul; apoi înlocuiește template-ul tehnic curent.
3. Închide pachetul operațional:
   - finalizează configurarea notificărilor de producție (email/SMS dacă rămân în scope),
   - finalizează push mobil FCM pe premium (login pe device real pentru token + `push/test-self` cu delivery confirmat),
   - rulează cleanup pentru booking-urile de test generate în QA (`privatedriver_premium2`).

## Latest Update (2026-02-27, Deploy premium.private-driver.ro)
- Instanță live separată creată:
  - domeniu `premium.private-driver.ro`
  - app dir `/var/www/premium`
  - service `privatedriver-premium`
  - backend `127.0.0.1:8915` proxat prin nginx
- SSL activ (Let's Encrypt) pe premium domain.
- DB separată activă: `privatedriver_premium`.
- Startup issue rezolvat:
  - `.env` inițial avea credențiale Mongo invalide (`privatedriver_app`), serviciul crăpa cu `async_db=None`.
  - trecut la `admin:admin` + `authSource=admin` pe DB premium.
- Date bootstrap:
  - clone `privatedriver -> privatedriver_premium` prin `mongodump/mongorestore` (namespace remap), apoi enforce `executive_only` în `system_settings`.
- Verificat live:
  - `/api/health` = healthy
  - login test admin = OK
  - `/api/rides/config` = executive_only flags
  - instant blocat (`/api/rides/request` 403)
  - driver instant queue endpoint returnează empty + mesaj executive.

## Latest Update (2026-02-27, Premium P0 Executive Slice)
- Audit livrat: `ai/premium_audit_report_2026-02-27.md`
- Backend:
  - feature flags executive în `system_settings` (`product/booking/pricing/ui`)
  - blocare instant pe `/api/rides/request` în `executive_only`
  - matching/broadcast oprit în `booking_service` și `scheduler_service` în `executive_only`
  - endpointuri noi `/api/executive/*` + endpointuri driver `/api/driver/bookings/*`
  - endpoint nou de config pentru frontend: `GET /api/rides/config`
- Frontend:
  - `Home.tsx` respectă `disableOnDemand` + `hideNearbyDrivers`
  - `RideOptions.tsx` forțează continuarea spre flow executive când instant e dezactivat
  - `PremiumRideRequest.tsx` migrat la rezervare executive reală (date/time + package + pending_confirmation)
- Validare:
  - `python -m py_compile` trecut pe fișierele backend modificate
  - `npm ci` + `npm run build` trecute

## Latest Update (2026-02-26, Local Info Hub)
- Local mini-platform created for centralized local discovery of server/deploy/secrets context:
  - source in repo: `tools/info-hub/`
  - global runtime path: `C:\Users\nicus\.codex\info-hub`
- Runtime verified locally:
  - `http://127.0.0.1:8877` (UI)
  - `GET /api/health` returns `200`
  - `GET /api/files`, `GET /api/search`, `GET /api/vault/keys` operational.
- Boot/login auto-start enabled:
  - startup entry: `C:\Users\nicus\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\NicusInfoHub.cmd`
- Local access updated to:
  - `http://127.0.0.1:1986` (old `8877` retired).
- Launch fix applied for PowerShell compatibility:
  - separate `info-hub.out.log` / `info-hub.err.log` redirection in `launch_hub.ps1`.
- Vault execution fix applied:
  - `hub_server.py` executes secret script via `pwsh` (fallback `powershell`) for consistent key retrieval.
- DeepSeek integration added in Info Hub:
  - endpoint `POST /api/ai/ask` and UI panel `AI Assistant (DeepSeek)`.
  - key source order: env `INFO_HUB_DEEPSEEK_KEY` then vault path `desktop_import_2026_02_26.ai_provider_keys.deepseek`.
  - multi-key fallback implemented (tries next key if one is invalid).
  - default safety: context is redacted unless `allow_sensitive` is explicitly enabled in UI.
- Locate mode added for "unde gasesc X":
  - endpoint `GET /api/locate` + Search `Locate` button in UI.
  - returns ranked `where_to_find` paths (deterministic, no LLM required).
  - search indexing now includes workspace docs root (`H:\Users\nicus\Documents\v5.private-driver.ro`) when present.
- Knowledge-base expansion completed:
  - locate and AI context now include both file results and vault values (redacted by default).
  - vault snapshot is indexed with cache and can be rebuilt via `POST /api/vault/reindex`.
  - goal achieved: natural-language query can identify "unde gasesc" across the whole local data base, not just fixed examples.
  - Romanian-to-English token expansion added for better retrieval on local phrasing (`parola`, `conectare`, `baza de date`, etc.).
- Write flow added for future secrets:
  - `POST /api/vault/set` + UI card `Add/Update Secret` in Info Hub.
  - new secret is stored in DPAPI vault and becomes searchable immediately through `Locate`/`Ask`.
  - write audit log maintained at `C:\Users\nicus\.codex\info-hub\vault_write_audit.log`.
- Unified Chat mode now active:
  - single visible chat module in UI; backend route `POST /api/chat`.
  - chat auto-decides between knowledge lookup and vault write actions.
  - user no longer needs to choose separate tools (`search`, `ai`, `locate`, `set`) for standard flows.

## Previous Update (2026-02-26, Server handover archive)
- Server handover pack generated for external team onboarding/deploy on new subdomain.
- Live server snapshot captured from `root@private-driver.ro` and packaged in sanitized form (infra, ports, services, nginx/certbot, app dirs, env key names).
- New shareable archive: `release/server-subdomain-handover-20260226.zip`.
- Snapshot highlights:
  - host `ubuntu-4gb-nbg1-1` (`116.203.80.227`), Ubuntu 24.04.3 LTS,
  - active runtimes: Docker `v4-full` (`3000/8888`) + systemd `privatedriver-x` (`8898`) + `privatedriver-v5` (`8905`),
  - disk pressure observed (`/` at ~92% used), noted in handover docs.

## Older Update (2026-02-24)
- `v5.private-driver.ro` is **LIVE** with HTTPS. systemd service `privatedriver-v5` on port 8905, nginx, certbot SSL.
- Shares same MongoDB (`privatedriver` db via v4-mongodb Docker container at `172.19.0.2:27017`, `admin:admin`).
- All 5 test logins verified working on v5.
- Deploy ops: `ops/create_release.ps1` + `ops/deploy_x_server.sh` (with `DOMAIN=v5.private-driver.ro APP_DIR=/var/www/v5 BACKEND_PORT=8905 SERVICE_NAME=privatedriver-v5`).

## Older Update (2026-02-19)
- `x.private-driver.ro` frontend+backend stabilized after repeated deploy/runtime issues.
- Geolocation/map startup hardening:
  - `src/contexts/AppContext.tsx`: fast-first geolocation strategy + last known location persistence.
  - `src/pages/passenger/MapSelect.tsx`: better initial centering and fallback flow; reduced early geolocation race behavior.
  - `src/pages/driver/Home.tsx`: less aggressive GPS tracking, timeout-tolerant behavior.
- Passenger/Driver i18n fixes:
  - `src/pages/driver/Home.tsx` + `src/components/driver/MenuHeader.tsx`: menu/dashboard/overlay strings moved to `t(...)`.
  - `src/pages/passenger/Profile.tsx` + `src/pages/passenger/Settings.tsx`: removed hardcoded English labels, now fully language-driven.
  - Added translation keys in `src/i18n/ro.ts` and `src/i18n/en.ts`.
- WebSocket reliability fix:
  - `src/services/websocketService.ts`: removed reserved event misuse (`disconnect`/`connection` emit to server), made `connect()` idempotent, guarded room joins until connected.
  - Fixed console/runtime error: `Uncaught Error: "disconnect" is a reserved event name`.
- Deploy/ops hardening for `x`:
  - `ops/deploy_x_server.sh`: preserve backend `.env` across release sync, skip `certbot --nginx` when cert already exists, enforce readable perms on `dist`.
  - Nginx cache policy for PWA shell/static assets validated (no-store for shell, immutable for hashed assets).
- Incident resolved during deploy:
  - Frontend assets 404 on `x` traced to filesystem permissions (`/var/www/x/dist/assets` was `700`); corrected to `755/644` and automated in deploy script.
- Current live status:
  - Frontend serves latest bundle on `x`.
  - `https://x.private-driver.ro/api/health` returns `200 OK`.

## In Progress (NOW)
- Passenger `map-select` visibility + stale-location fix deployed on `x.private-driver.ro`:
  - `src/pages/passenger/MapSelect.tsx` now uses viewport-height layout (`h-[100dvh]`) plus minimum map area to prevent `leaflet-container` height collapse.
  - Map page now attempts fresh geolocation lookup even when cached `lastKnownLocation` exists, preventing sticky old location (ex: `Casa Chiojdeni`) when GPS permission is granted.
  - Live deploy executed (`privatedriver-x-20260222-054555.tar.gz`), now serving `assets/index-BU5N6DYy.js`.
  - Live validation passed:
    - map container renders with non-zero height and loaded tiles,
    - stale cached location is replaced by fresh GPS coordinates when geolocation permission is allowed.
- Ride-chat `403` diagnostics and fix deployed on `x.private-driver.ro`:
  - Backend `can_send_message` now treats only hard-closed statuses as blocked and keeps active/intermediate ride states chat-open (`arrived`, `waiting`, `in_progress`, etc.).
  - Completed-ride timeout comparison is now robust to multiple timestamp formats (datetime/ISO/unix).
  - Frontend chat send now surfaces backend `detail` message (not generic `Failed to send message`).
  - Live deploy executed (`privatedriver-x-20260222-053530.tar.gz`) and smoke-verified:
    - `arrived` ride conversation send -> `200`,
    - completed/expired window conversation -> `403` with explicit window-closed detail.
- Passenger dashboard hotfix deployed on `x.private-driver.ro`:
  - Fixed blocked click/tap area on passenger Home by removing `allowDragFromContent` overlay usage in `DraggableBottomSheet` mount.
  - Additional blocker fixed: `CookieConsentBanner` no longer overlays bottom-sheet controls on `/v2/passenger` and `/v2/driver` (moved to top on dashboard routes).
  - Cookie banner route detection hardened for trailing-slash variants (`/^\/v2\/(passenger|driver)(\/|$)/`).
  - Banner overlap mitigation: passenger/driver install/push banners moved to top so ride menu actions remain clickable.
  - Frontend rebuilt and redeployed; live now serves `assets/index-Chw4cKxr.js`.
- Service worker refresh hardening deployed:
  - `workbox.skipWaiting=true` and `workbox.clientsClaim=true` added so new builds activate immediately on clients.
  - Live `sw.js` confirms `skipWaiting()` + `clientsClaim()`.
- Operational tooling added for forced server-side refresh:
  - New script: `/var/www/x/rebuild_x_server_full.sh` (source: `ops/rebuild_x_server_full.sh`).
  - Performs backup + cleanup + full rebuild + redeploy + restart + health checks in one command.
  - Script executed once on live and then hardened with retry-based verification to avoid startup timing false negatives.
  - Live frontend was re-synced from current local workspace afterward to keep latest hotfix bundle active (`index-Chw4cKxr.js`).
- Push activation backend config fixed on `x`:
  - Added `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_EMAIL` in `/var/www/x/backend/.env`.
  - Restarted `privatedriver-x`; `GET /api/notifications/vapid-public-key` now returns `200` (was `503`).
  - Authenticated `POST /api/notifications/register` returns `200`.
- PWA manifest/static noise fix on `x`:
  - Removed missing screenshot/shortcut references from generated manifest.
  - Added backward-compat static files for stale cached manifests (`/icons/shortcut-*.png`, `/screenshots/*.png`, `/icons/icon-128x128.png`) so legacy requests return `200`.
- Profile/reviews/messaging pass remains deployed and healthy:
  - reviews endpoints live for both roles, avatar upload endpoints live, passenger messages back button live.
  - Integrity checks for profile rename vs ride ownership remain valid (ID-based ownership intact).

## Legacy Backlog (x/private-driver.ro)
1. Confirmă deciziile blocate din `ai/taskpremium.md` (contractare / preplată / transferuri) pentru a fixa politicile finale.
2. Adaugă Admin UI pentru `service_packages` + setări executive (mod, lead time, ui flags) în `/admin/settings`.
3. Hard-remove/ascunde route-uri și CTA-uri instant rămase (`FindingDriver`, `DriverMatched`, fallback-uri “standard ride”) în instanța premium.
4. Extinde flow-ul executive cu jurnal complet `communication_logs` (email/SMS placeholders + event logging).
5. QA: creează/actualizează E2E pentru `executive booking` (create, pending_confirmation, confirm/reject, cancel) + smoke API pe `/api/executive/*`.
6. Pregătește deploy izolat premium (DB `privatedriver_premium`, port `8915`, service `privatedriver-premium`, app dir `/var/www/premium`).

---

## What Currently Works (Complete Feature List)

### Authentication & Authorization
- JWT login for 5 roles: admin, support, driver, user (passenger), fleet_manager
- All 5 test users working and verified
- Supabase Auth UUID sync complete (Flutter mobile login fixed)
- **Role-Specific Auth Pages** (2026-02-12): AppSelector → `/v2/passenger/auth` or `/v2/driver/auth` with login/register tabs
  - Registration auto-sends role (user for passenger, driver for driver)
  - Google sign-in flow now wired end-to-end via backend callback + frontend hash session restore
  - Backend phone field now optional at registration
- Rate limiting: login 10/min, register 5/min, refresh 30/min

### Admin Panel (23 pages — 100% connected, audited 2026-02-17)
Pages: Dashboard, Trips, Users, DriversManagement, Fleets, Vehicles, Payments, Pricing, Disputes, Feedback, AuditLogs, Invoices, Settings, DatabaseExplorer, PremiumApplications, DocumentVerification, Messages, SupportTickets, Promotions, Referrals, Analytics, FinancialManagement, ProjectMap

Key features:
- **Settings** — Platform config with messaging timeout slider (1-24h)
- **Analytics** (2026-02-14) — Real data from `/api/admin/analytics/overview` (monthly rides/revenue/users, hourly distribution, KPIs)
- **FinancialManagement** (2026-02-14) — Connected to trip_financials + legal_entities + invoices (3 real endpoints)
- **PremiumApplications** (2026-02-15) — Full approve/reject workflow connected to `/api/admin/premium/applications`
- **DatabaseExplorer** — Direct MongoDB CRUD for any collection

### Fleet Panel (11 pages — 100% connected, audited 2026-02-17)
Pages: Dashboard, Vehicles, VehicleDetail, Drivers, DriverDetail, Trips, Earnings, Reports, Settings, Messages, Support

### Driver Pages (28 pages — 26 active + 2 LEGACY)
Pages: Home, Earnings, History, Profile, Settings, Vehicle, Help, Documents, Notifications, Messages, Premium, TripDetail, ActiveRide, IncomingRequest, NavigateToPickup, WaitingForPassenger, RideCompleted, Onboarding, EditProfile, RequestPayout, PremiumDashboard, PremiumIncomingRequest, PremiumNavigateToPickup, PremiumWaitingForPassenger, PremiumTripInProgress, PremiumTripCompleted, TripInProgress [LEGACY], TripCompleted [LEGACY]

Key fixes and features:
- **Home Bug Fix** (2026-02-14): activeRide lookup was dead code (return before lookup). Now returns enriched active ride data with passenger info
- **Premium Status Bug Fix** (2026-02-14): get_premium_status was calling async function without await. Fixed with async_db
- **RequestPayout** (2026-02-14): 2 new endpoints (GET /api/driver/payouts/balance, POST /api/driver/payouts/request). Real balance from completed rides minus payouts
- **PremiumDashboard** (2026-02-14): New endpoint GET /api/driver/premium/dashboard with complex aggregation. Period selector (week/month/quarter). All 4 charts use real data
- **Onboarding** (2026-02-14): 2 new endpoints (GET /api/driver/onboarding/status, POST /api/driver/onboarding/declarations). Declarations saved to driver_declarations collection
- **EditProfile** (2026-02-14): Connected to getUserProfile + updateUserProfile (was hardcoded)
- **WaitingForPassenger** (2026-02-14): Real data from useAuth + location.state (was hardcoded)
- **Driver Flow Audit** (2026-02-15): Fixed waybill 500 (type safety + HTML fallback), settings 400 (showDestination field missing), IncomingRequest (connected accept/reject API), NavigateToPickup (connected arrived status API + GPS), WaitingForPassenger (connected start trip + cancel API)
- **Premium Ride Flow ACTIVATED** (2026-02-16): All 5 premium pages connected to real API — replaced useChatMessages mock with ChatDetail+conversationId, GPS tracking, real ride status updates, real rating submission, Haversine distance calculation
- **Notifications.tsx Fix** (2026-02-16): Switched from raw fetch('/api/notifications/list') to api.ts functions (getNotifications, markAllNotificationsAsRead, deleteNotification)
- **Rating Bug Fix** (2026-02-16): Fixed 2 bugs in rating flow:
  - Backend `rider_rate_ride` in user.py only queried `bookings._id` but frontend sends `rideId` from `rides` collection → now also searches `bookings.rideId`
  - Frontend `PremiumTripCompleted.tsx` sent `feedback` as string but `RatePassengerRequest` expects `List[str]` → wrapped in array
- **TripInProgress / TripCompleted**: LEGACY pages, NOT used in production flow. Real flow uses ActiveRide.tsx → RideCompleted.tsx

Premium driver ride flow pages (5 pages — ALL CONNECTED 2026-02-16):
- PremiumIncomingRequest — acceptRideRequest/rejectRideRequest API, real coords
- PremiumNavigateToPickup — updateRideStatus('arrived'), GPS watchPosition + updateDriverLocation, real ChatDetail
- PremiumWaitingForPassenger — updateRideStatus('in-progress'/'cancelled'), GPS tracking, real ChatDetail, wait fee tracking
- PremiumTripInProgress — GPS Haversine distance (real, not simulated), updateRideStatus('completed'), updateDriverLocation, real ChatDetail, real fare calculation
- PremiumTripCompleted — submitPassengerRating(rideId, {rating, feedback, comment}), loading states + error handling
- All 5 pages: replaced mock useChatMessages+ChatDrawer with real ChatDetail+conversationId, replaced hardcoded coordinates with request state data

### Passenger Pages (33 pages — 29 active + 4 STATIC)
Pages: Home, DestinationSearch, RideOptions, FindingDriver, DriverMatched, RideInProgress, RideCompleted, History, RideDetail, Payments, AddPaymentMethod, SavedPlaces, EditPlace, Promotions, Referrals, PrivateDrivers, PrivateDriverProfile, PremiumRideRequest, Notifications, Messages, SupportTickets, TrustedDevices, PrivacySettings, ReportIssue, MapSelect, EditProfile, Help, LanguageSettings, Auth, Onboarding, Profile (STATIC), Settings (STATIC), Legal (STATIC)

Key fixes:
- **Passenger Dashboard** (2026-02-14): ALL settings verified working — NotificationSettings, PaymentMethods, PrivacySettings, SavedLocations, LanguagePreference, SupportReports, TrustedDevices
- **Notifications Clear All** (2026-02-14): New `POST /api/notifications/clear-all` endpoint
- **Language Persistence** (2026-02-14): format_user_response() now returns preferred_language
- **Privacy Export** (2026-02-17): Connected to real `GET /api/gdpr/export-my-data` with JSON file download
- **Help** (2026-02-14): Fetches FAQ from /api/driver/help/faq + contact with fallback to default array
- **EditProfile** (2026-02-14): Connected to real API (was hardcoded with setTimeout)
- **BottomNavigation** (2026-02-17): Messages tab with unread badge count (polls conversations API every 30s)
- **EditPlace** (2026-02-17): Full address autocomplete via `/api/places/autocomplete` (Photon + Nominatim fallback), map preview
- **Bug Fixes** (2026-02-17): 14/18 passenger bugs fixed — see `ai/bugs-passenger.md` for details

### Support Pages (6 pages — 100% connected, audited + hardened 2026-02-18)
Pages: Dashboard (KPIs), Tickets (search, filters), TicketDetail (messaging), ChatDetailPage (conversation view), Messages (all conversations), Notifications (center)
- Full SupportLayout with sidebar navigation, header with logout/theme toggle
- Can message all platform users (admin, drivers, passengers, fleet)
- Ticket assignment, status updates, real analytics from DB with teamMemberStats
- 2026-02-18 hardening:
  - Analytics supports both snake_case/camelCase time fields; KPI reliability improved
  - Category filter wired end-to-end (`support/admin` tickets pages → API → backend query)
  - Ticket conversations are auto-created and auto-repaired if missing
  - New support endpoint `GET /api/support/contacts` (search + role + pagination)
  - Support `New Conversation` composer implemented with role filters
  - `support/admin` can list all conversations in messages dashboard

### Premium/Private Drivers (COMPLETE 2026-02-15)
Full end-to-end flow working:
1. **Driver applies**: `POST /api/driver/premium/apply` → creates entry in `driver_premium` with status: pending, rate_card, services, languages
2. **Driver sets rates**: `PUT /api/driver/premium/rates` → update pricing (only when approved)
3. **Driver checks status**: `GET /api/driver/premium/status` → reads from driver_premium
4. **Admin lists applications**: `GET /api/admin/premium/applications` → enriched list with driver info, vehicle, stats, proposed rates
5. **Admin reviews**: `PUT /api/admin/premium/applications/{id}/review` → approve/reject/start_review with history tracking
   - On approve: sets `driver_premium.status = "approved"` + `drivers.enable_private_hire = True`
   - On reject: requires rejection reason, sets status = "rejected"
6. **Passenger browses**: `GET /api/premium/drivers` → queries `driver_premium.status == "approved"`, enriched with user/vehicle/rating data
7. **Passenger sees detail**: `GET /api/premium/drivers/{id}` → full profile with rate card, services, languages, reviews
8. **Passenger requests ride**: `POST /api/premium/rides/request` → creates ride in DB + driver notification
9. **Passenger polls status**: `GET /api/premium/rides/{id}/status` → checks for driver response
10. **Driver responds**: `PUT /api/premium/rides/{id}/accept` or `/reject`

Frontend pages: PrivateDrivers.tsx, PrivateDriverProfile.tsx, PremiumRideRequest.tsx (real API polling), PremiumApplications.tsx (admin)

Key bugs fixed (2026-02-15):
- `premium.py` listing was querying `enable_private_hire: True` (field never set) → now queries `driver_premium.status == "approved"`
- Data model conflict: `driverId` vs `driver_user_id` → `_find_premium_settings()` helper handles all variants
- Missing admin endpoints → created `admin_premium.py`
- PremiumRideRequest used Math.random() → now uses real API + polling every 3s

### Messaging System (2026-02-07)
- `conversations.py` — Full CRUD with messaging window enforcement
- Conversations auto-created on ride accept (driver ↔ passenger)
- Messaging window: active during ride + configurable timeout (default 3h) after completion
- Support/admin chats permanent (no timeout)
- Timeout configurable from Admin Settings UI (slider 1-24h)
- WebSocket events: join_conversation, leave_conversation, message:new, message:read, typing:start/stop

### Financial System
- OUG 49/2019 compliant — trip_financials auto-created on ride completion
- Split payment tracking (commission vs transport)
- Supabase sync for legal compliance
- Legal entities (PFA/SRL) management
- Financial exports with history tracking
- Invoice generation (async Motor rewrite)

### Image Upload (2026-02-11)
- `/api/uploads/message-image` — Local filesystem storage with Pillow optimization
- Supports JPG/PNG/WEBP/GIF, max 10MB, auto-resize (1200x1200), thumbnail generation (300x300)
- Storage: `/app/uploads/messages/{conversation_id}/{uuid}.jpg`
- Auth + path traversal protection

### Real-time (Socket.IO)
- Ride tracking, location updates, ride status changes
- Messaging: join_conversation, leave_conversation, message:new, message:read, typing:indicator
- Room pattern: `conv_{conversation_id}`, `driver_{userId}`, `user_{userId}`, `ride_{rideId}`

### Ride System
- Full lifecycle: request → match → accept → arrive → in-progress → complete/cancel
- Wait timer with stops
- Route calculation via OSRM
- 4 ride types: economy, comfort, xl, private
- Scheduled rides via APScheduler

### Dark/Light Mode Toggle (2026-02-11)
- ThemeContext with localStorage persistence, system preference detection
- Three modes: light, dark, system (auto-detect)
- Meta theme-color dynamic updates
- Map tiles synchronize with theme (CartoDB Dark Matter / Voyager)

### Supabase Sync Bridge
- MongoDB ↔ Supabase bidirectional sync
- Webhook receiver for Supabase events (INSERT, UPDATE, DELETE with soft-delete)
- Manual sync (single entity, bulk, full)
- Bulk sync both directions: mongo→supabase AND supabase→mongo (fixed 2026-02-15)

### Other Systems
- Document Management: KYC system for drivers, compliance documents
- Notifications: Real-time SSE + DB persistence + FCM logging stub
- Audit logs: GDPR compliant audit trail
- GDPR: Data rights endpoints
- Promotions & Referrals: Marketing system
- Favorite drivers/passengers: Passenger favorites
- Driver aliases: Convenience endpoints

---

## Complete Development History (Chronological)

### 2026-02-03 — Project Initialization
- AI memory system created (/ai folder with BRAIN.md, TASKS.md, CHANGELOG_AI.md, etc.)
- Initial deployment to Docker containers

### 2026-02-04 — Admin Panel (Mock → Real)
- Removed mockAdminData.ts and mockFleetData.ts
- Converted all 13 admin/fleet pages to real API
- Zero mock data in admin/fleet panels

### 2026-02-05 — Driver Pages Backend
- Created all driver backend endpoints (profile, home, earnings, history, settings, premium, etc.)
- Connected all driver frontend pages to real API

### 2026-02-07 — Messaging + Fixes
- Full messaging system with ride-based window enforcement
- Admin settings with messaging timeout config
- Fixed 404 endpoints (rider/rides, rides/categories, payments/methods, auth/devices)
- Fixed RideTypeCard crash (added 'private' type)
- Flutter UUID sync fix
- Accessibility fixes (DialogDescription, SheetDescription)

### 2026-02-11 — Premium + Upload + Support + Theme
- Premium drivers listing API (`/api/premium/drivers`)
- Image upload with local storage (Pillow optimization)
- Complete support dashboard (5 pages, SupportLayout)
- Dark/light mode toggle
- Icons & assets (10 sizes + OG image + favicon)
- Fixed 11 critical API endpoints (support, notifications, driver aliases)
- Backend container rebuild (fixed ImportError)
- Platform management scripts (8 scripts in /root/)

### 2026-02-12 — Role-Specific Auth
- RoleAuthPage component with login/register tabs for passenger and driver
- AppSelector redirects to auth pages when not authenticated
- Backend phone field made optional
- Google sign-in placeholder

### 2026-02-14 — Complete Bug Fix + Mock Removal + Backend TODOs
Session 1 (bugs + mock pages):
- Fixed 2 CRITICAL backend bugs: driver home dead code, premium status async/await
- Converted 6 mock pages to real API: driver EditProfile, passenger EditProfile, admin Analytics, admin FinancialManagement, driver RequestPayout, driver PremiumDashboard
- Fixed 4 more backend bugs: duplicate rating route, hardcoded support analytics, uploads missing auth, legal_entities fake JWT
- Converted 2 more mock pages: passenger Help, driver Onboarding
- Created 8 new backend endpoints

Session 2 (passenger dashboard):
- Verified all passenger settings (8/11 already working)
- Fixed 4 issues: language persistence, notifications clear-all, privacy buttons, ReportIssue redirect

Session 3 (backend TODOs + cleanup):
- Fixed invoices.py (sync → async Motor rewrite)
- Fixed financial_exports.py (real auth + export history)
- Fixed sync.py DELETE handling (soft-delete)
- Fixed notifications.py (DB save + FCM stub)
- Fixed WaitingForPassenger hardcoded data
- Removed legacy SplashScreen.tsx + Index.tsx

### 2026-02-15 — Premium Driver Complete Implementation + Deploy + Driver Flow Audit
- COMPLETE REWRITE of premium.py — fixed listing (enable_private_hire → driver_premium.status), added ride endpoints
- NEW admin_premium.py — admin approval workflow (GET applications + PUT review)
- Fixed data model conflict (driverId vs driver_user_id) with cross-module compatibility
- Replaced PremiumRideRequest Math.random simulation with real API + polling
- Added bulk sync supabase→mongo (was TODO 501)
- Deployed everything to server (frontend build + backend files)
- **Driver Flow Audit**: Fixed waybill 500 (type safety + weasyprint HTML fallback), settings 400 (showDestination missing from model), IncomingRequest (connected to acceptRideRequest/rejectRideRequest API), NavigateToPickup (connected to updateRideStatus 'arrived' + GPS tracking), WaitingForPassenger (connected to updateRideStatus 'in-progress' + cancel with reason)
- All 3 containers running and healthy

### 2026-02-16 — Premium Ride Flow Activation + Driver Notifications Fix
- **All 5 Premium ride flow pages connected to real API** (were 100% mock with zero API calls):
  - PremiumIncomingRequest: acceptRideRequest/rejectRideRequest (done 2026-02-15)
  - PremiumNavigateToPickup: updateRideStatus('arrived'/'cancelled'), GPS tracking, real ChatDetail (done 2026-02-15)
  - PremiumWaitingForPassenger: updateRideStatus('in-progress'/'cancelled'), GPS tracking, real ChatDetail
  - PremiumTripInProgress: GPS Haversine distance (replaces simulated +0.015km/s), updateRideStatus('completed'), updateDriverLocation, real ChatDetail
  - PremiumTripCompleted: submitPassengerRating(rideId, {rating, feedback, comment})
- **Eliminated from all 5 pages**: useChatMessages mock hook, ChatDrawer with fake data, hardcoded coordinates, setTimeout simulations
- **Replaced with**: ChatDetail + conversationId (fetched via getConversations matching rideId), GPS watchPosition, real API calls with loading states + error handling
- **Driver Notifications.tsx**: Fixed raw fetch calls → api.ts functions (getNotifications, markAllNotificationsAsRead, deleteNotification)
- TypeScript: 0 errors, Build: success, Deployed to server

### 2026-02-17 — Admin Panel Audit (12 fixes) + Fleet Panel Audit (4 fixes)
**Admin Panel Audit** — Systematic audit of all 22 admin pages vs backend endpoints. Fixed 12 response parsing issues:
- Dashboard.tsx: Fixed stats/analytics parsing for direct JSON responses (no success wrapper)
- DriversManagement.tsx: Fixed drivers list parsing (`data.data?.drivers || data.data || []`)
- Vehicles.tsx: Fixed vehicles list and stats parsing for wrapped vs direct responses
- Payments.tsx: Fixed payments list parsing for nested data
- Invoices.tsx: Fixed invoices response parsing
- AuditLogs.tsx: Fixed audit logs response parsing
- Disputes.tsx: Fixed disputes response parsing
- Fleets.tsx: Fixed fleets list parsing
- Earnings.tsx (admin): Fixed earnings response parsing
- Users.tsx: Fixed users list parsing
- RideDetail.tsx: Fixed ride detail response parsing
- Analytics.tsx: Fixed analytics response parsing
- All 26/26 admin API endpoints tested OK on live server

**Fleet Panel Audit** — Systematic audit of all 11 fleet pages vs 4 backend route files. Fixed 4 response parsing issues:
- Earnings.tsx: Fixed stats + earnings parsing (expected `success` wrapper but `/api/fleet/stats` and `/api/fleet/analytics/earnings` return direct JSON)
- Reports.tsx: Fixed stats + reports parsing (expected `success` wrapper but both endpoints return direct JSON)
- DriverDetail.tsx: Fixed performance summary parsing (`/api/fleet/analytics/drivers/{id}/summary` returns `{driverId, stats: {...}}` not wrapped) + trips parsing (`/api/fleet/trips` returns `{trips: [], total: N}`)
- VehicleDetail.tsx: Fixed fallback endpoint parsing (`/api/fleet/vehicles` returns bare array, not `{success, data}`)
- All 11 fleet API endpoints tested OK on live server
- Build: success, Deployed to server

### 2026-02-17 (session 2) — Support Panel Audit (7 fixes)

**Support Panel Audit** — Systematic audit of all 6 support pages vs backend routes. Fixed 7 issues (4 frontend + 3 backend):
- Dashboard.tsx: Analytics fields mapped from backend's nested structure (`overview.open` → `openTickets`, `performance.avg_resolution_time` → `avgResolutionTime`) + ticket field normalization (snake_case → camelCase)
- Tickets.tsx: Added field normalization layer for snake_case fields (`ticket_number` → `ticketNumber`, `response_count` → `responseCount`, etc.)
- TicketDetail.tsx: Fixed data nesting (`data.ticket` → `data` directly) + snake_case field normalization + `submittedByName`/`submittedByRole` mapped from `creator_name` + uses `conversationId` for ChatDetail
- ChatDetailPage.tsx: Fixed conversation nesting (`convData?.data` → `convData?.data?.conversation || convData?.data`)
- Backend support.py: Changed `update_ticket_status` from query parameter to JSON body (`UpdateStatusRequest` model)
- Backend support.py: Changed `assign_ticket` from query parameter to JSON body (`AssignTicketRequest` model)
- Backend support.py: Added `teamMemberStats` to analytics response (queries support/admin users with assigned/resolved counts)
- All 9 support endpoints tested OK on live server
- Build: success, Frontend + Backend deployed to server

### 2026-02-17 (session 3) — Bug Fixing Marathon (25 bugs, 21 fixed, 3 rounds deployed)
Comprehensive manual testing session covering passenger and driver roles. Created bug tracking system (`ai/bugs-passenger.md`, `ai/bugs-driver.md`).

**Round 1 — 10 fixes (backend + frontend):**
- P15/D6: Rating 500 → missing datetime import + passenger verification for 3 formats + try/except driver update (`ride.py`)
- D4: Reject ride 400 → added "pending", "searching" to allowed statuses (`driver.py`)
- P5: URL dublu /api/api/ → removed prefix from NOTIFICATION_API constants (`notifications.ts`)
- P3: Guest name → use authUser from AuthContext (`passenger/Home.tsx`)
- P17: Add Stop 404 → fixed route path (`RideOptions.tsx`)
- P6: Map dark in light mode → added `key={actualTheme}` to TileLayer (`MapView.tsx`)
- P13: CVV password field → type="text" inputMode="numeric" (`AddPaymentMethod.tsx`)
- P11: No back after report → `navigate(-1)` (`ReportIssue.tsx`)
- P12: Cash default broken → fixed logic + re-fetch on failure (`Payments.tsx`)
- P2/D1: Geolocation timeout → fallback without highAccuracy (`AppContext.tsx`)

**Round 2 — 6 fixes:**
- D2/D3: WebSocket wss:// loop → relative path + polling first (`websocketService.ts`)
- D5: PWA icon 404 → corrected path (`driver/Home.tsx`)
- P7: Privacy export → connected to GDPR endpoint with download (`PrivacySettings.tsx`)
- P14/D7: Message badge → Messages tab in BottomNavigation with unread count + driver menu badge (`BottomNavigation.tsx`, `driver/Home.tsx`, `App.tsx`, `i18n/*.ts`)

**Round 3 — 2 fixes:**
- P10: Text hidden under Submit → added pb-24 (`ReportIssue.tsx`)
- P18/FP1: Saved Places search → full autocomplete with `/api/places/autocomplete` + Nominatim fallback + map preview (`EditPlace.tsx`)

**Score: 21/25 bugs fixed.** Remaining: P1 (push notifs → needs HTTPS), P4 (i18n → needs translation system), P9 (photo attach → needs S3), D3 (401 loop → partially fixed via D2, monitor)

### 2026-02-18 (session 4) — Driver + Passenger Full Live Re-Audit
- Fresh live audit run at `2026-02-18T12:25:25Z` on `http://v4-full.private-driver.ro:8888`.
- Coverage: auth, rides, messaging, notifications, support, payments, permissions, cleanup.
- Results:
  - Auth: **3/3 PASS**
  - Driver: **34/35 PASS**
  - Passenger: **33/35 PASS** in raw run; estimate check corrected to proper endpoint and passed on retest
  - Cleanup: **5/5 PASS**
- Confirmed working:
  - Driver and passenger can both create direct conversations and send messages.
  - Notifications list/preferences/mark/clear flows work on both roles.
  - Ride request + booking status + cancel works for passenger.
  - Permission boundaries return expected `403` for restricted endpoints.
- Confirmed live blockers (real, reproducible):
  1. `GET /api/driver/rides/history` -> `400 Invalid ride ID`
  2. `POST /api/saved-places` -> `500` while still inserting (retested with valid `type: favorite`)
  3. Support ticket detail for new driver/passenger tickets still returns `conversation_id: null` (also from admin view)

### 2026-02-18 (session 5) — `x.private-driver.ro` Rollout (Local + Ubuntu)
- Added deployment tooling:
  - `ops/prepare_x_release.ps1` (build + package release archive on Windows)
  - `ops/deploy_x_server.sh` (deploy in `/var/www/x`, systemd, nginx, certbot)
  - `ops/DEPLOY_X.md` (execution runbook)
- Deployed archive to server and provisioned:
  - app root `/var/www/x`
  - backend service `privatedriver-x` on port `8898`
  - nginx vhost + SSL for `x.private-driver.ro`
- Validation on `x`:
  - frontend `https://x.private-driver.ro` -> `200`
  - backend health `https://x.private-driver.ro/api/health` -> healthy
  - auth login works with test users
  - `GET /api/driver/rides/history` -> fixed (`200`)
  - support ticket detail includes `conversation_id` -> fixed
  - `POST /api/saved-places` fixed in follow-up patch (session 6)

### 2026-02-18 (session 6) — Saved Places Fix Deployed on `x`
- Root cause confirmed from logs: `PydanticSerializationError` due to raw Mongo `ObjectId` in response payload for `POST /api/saved-places`.
- Fix applied in `backend/app/routes/saved_places.py`:
  - Added serializer helper `_serialize_place_doc`
  - Normalized all responses to return `id` string instead of raw `_id`
  - Updated create/update/list paths and switched to `model_dump()` for pydantic v2
- Deployed patched route file to `/var/www/x/backend/app/routes/saved_places.py` and restarted `privatedriver-x`.
- Final targeted verification on `x`:
  - `GET /api/driver/rides/history` -> `200`
  - `POST /api/saved-places` -> `200`
  - support ticket detail contains `conversation_id` -> `True`

### 2026-02-18 (session 7) — Full Live Passenger + Driver Recheck on `x` (Ride + Map + Language + Theme)
- Executed live online checks exactly for requested scope (`https://x.private-driver.ro`) with test passenger + driver users.
- API flow validated end-to-end:
  - passenger request ride -> driver sees request -> driver accepts -> passenger sees matched + driver details
  - nearby drivers endpoint confirmed data for map markers (`count >= 1` around pickup)
- UI checks validated:
  - Passenger map renders Leaflet + OSM tiles (`/v2/passenger/map-select`)
  - Driver map renders Leaflet + Carto tiles (driver active ride page)
  - Passenger language toggle works (`document.documentElement.lang` changed `ro -> en`)
- New issues confirmed:
  1. **Theme toggle desynced (passenger + driver settings)**  
     Initial switch state is out of sync with effective page theme (`aria-checked=true` while page is light). First toggle can appear no-op; second toggle applies class correctly. Root cause likely split state between `AppContext` and `ThemeContext`.
  2. **Driver language navigation broken**  
     Driver settings points to `/v2/passenger/language`, but route is protected for `user` role only, so driver is redirected back and cannot access language settings.
  3. **Ride cancel endpoint showed one transient 500 during cleanup**, then succeeded on direct retest (`PUT /api/driver/ride/{id}/status?status=cancelled` returned `200`).

### 2026-02-18 (session 8) — Fixes Applied + Deployed on `x` for Session 7 Findings
- Frontend fixes:
  - Passenger and driver settings now use `ThemeContext` for dark/light toggle state/actions (instead of `AppContext`), removing first-click desync.
  - Added driver language route `"/v2/driver/language"` protected for role `driver`.
  - Driver settings language button now navigates to `"/v2/driver/language"` (no longer blocked by passenger-only route guard).
- Backend fix:
  - Hardened `cancelled` branch in `update_ride_status` (`driver.py`) so booking reset / re-broadcast errors do not crash request.
  - Added safe passenger lookup and guarded socket emit errors with warning logs.
- Deploy + verification on `x`:
  - Updated backend file in `/var/www/x/backend/app/routes/driver.py` and restarted `privatedriver-x`.
  - Updated frontend static bundle in `/var/www/x/dist`.
  - Health check passed: `http://127.0.0.1:8898/api/health` healthy.
  - Live retest passed:
    - Theme toggles change effective theme on first click (passenger + driver).
    - Driver language navigation opens `https://x.private-driver.ro/v2/driver/language`.
    - New ride cancel test returns `200` on first cancel call.

### 2026-02-18 (session 9) — Fleet Final Hardening on `x` (Remaining 500s)
- Trigger: Fleet CRUD smoke + live logs exposed remaining backend errors on `x`:
  1. `PUT /api/fleet/drivers/{id}` -> `500`
  2. `GET /api/fleet/vehicles/{vehicle_number}` -> `500`
  3. `GET /api/rides/nearby-drivers` -> intermittent `500` (`KeyError: vehicleNumber`) for legacy driver docs
- Root causes confirmed from `/var/log/privatedriver-x.log`:
  - `ResponseValidationError` (`vehicleNumber` missing) when serializing legacy driver docs against strict `DriverResponse`.
  - `PydanticSerializationError` for raw BSON `ObjectId` in vehicle detail response.
- Fixes applied in `backend/app/routes/fleet.py`:
  - Added `_driver_response_payload()` normalizer for strict/safe `DriverResponse` output.
  - Hardened `update_fleet_driver()` with `driver_id` validation and normalized return payload.
  - Updated `get_fleet_vehicle_detail()` to return `_json_safe(vehicle)` + string `id`.
- Fixes applied in `backend/app/services/ride_matching.py`:
  - Hardened `find_nearby_drivers()` with legacy-safe fallbacks:
    - avoid direct-key crashes for `vehicleType`/`vehicleNumber`,
    - robust user lookup (`_id` or `id`),
    - skip invalid `currentLocation` entries.
- Deploy on `x`:
  - Uploaded patched file to `/var/www/x/backend/app/routes/fleet.py`
  - Uploaded patched file to `/var/www/x/backend/app/services/ride_matching.py`
  - Restarted `privatedriver-x` and verified health (`/api/health` healthy).
- Verification:
  - Fleet CRUD smoke now `11/11` PASS (availability update+rollback, vehicle detail/update, assign/unassign, status rollback, maintenance).
  - Passenger `GET /api/rides/nearby-drivers` returns `200` with driver list after patch.
  - Cross-role mini smoke on `x` now `18/18` PASS.
  - Cleanup: deactivated smoke vehicles `SMOKE-X-001`, `SMOKE-X-37545`, `SMOKE-X-37668`.

### 2026-02-19 (session 10) — Messaging System Full Audit on `x` (Requested Pairs)
- Scope requested: full messaging verification for:
  1. `client (user) <-> driver`
  2. `client (user) <-> support`
  3. `driver <-> support`
- Execution details (live on `https://x.private-driver.ro`):
  - Main messaging smoke run id: `b54daaf8`
  - Checks: `30/30 PASS`
  - Verified for each pair:
    - conversation creation/reuse,
    - message send in both directions,
    - message retrieval by receiver,
    - mark-read endpoint (`PUT /api/conversations/{id}/messages/read`).
  - Ticket-linked support flows validated:
    - ticket create (`POST /api/support/tickets`),
    - ticket detail returns valid `conversation_id`,
    - messaging through `/api/conversations/{conversation_id}/messages`.
  - Additional direct conversation checks:
    - `user <-> support` direct conversation send works.
    - `driver <-> support` direct conversation send works.
- Security/isolation verification:
  - Separate security smoke: `10/10 PASS`
  - Confirmed:
    - user cannot access driver ticket/conversation (`403`),
    - driver cannot access user ticket/conversation (`403`),
    - support can access both (`200`).
- Cleanup:
  - all audit-created support tickets were closed after tests.

### 2026-02-19 (session 11) — Messaging UI Live Audit on `x` (Playwright)
- Trigger: requested explicit UI validation (not only API) for messaging pairs:
  1. client ↔ driver
  2. client ↔ support
  3. driver ↔ support
- Added reproducible script:
  - `ai/ui_messaging_audit_playwright.cjs`
- Execution:
  - Installed runtime browser for one-off execution: `npx -y -p playwright@1.53.0 playwright install chromium`
  - Ran audit: `npx -y -p playwright@1.53.0 node ai/ui_messaging_audit_playwright.cjs`
  - Run ID: `ui-mlsy4hcu`
- UI coverage:
  - direct conversation flows across requested pairs:
    - open conversation in UI list,
    - send message,
    - verify receive/reply on opposite role UI.
  - support ticket chat UI:
    - support replies from `/support/tickets/:ticketId`,
    - passenger/driver can read those replies in their messages UI conversation.
- Result:
  - `11/11 PASS`
  - no failed checks, no screenshots generated.
- Cleanup:
  - script auto-closed created ticket artifacts.

---

## What Remains To Be Done

### HIGH PRIORITY
1. **Stripe production integration** — singurul bloc major rămas la nivel de cod business (payment intents, webhooks, refunds, settlement flow).

### OPERATIONAL VALIDATION (non-code)
1. **FCM real-device delivery** — backend readiness este implementată (`push/health`, `push/test-self`, timeout/token guards), dar mai trebuie validat pe token/device mobil real.

### QUALITY / POLISH
1. **i18n Romanian completion** — chei există, dar nu toate paginile sunt migrate complet.
2. **Performance pass** — lazy loading/chunk split pe rute mari.
3. **Advanced analytics** — KPI suplimentari pe admin/fleet.

### KNOWN LIMITATIONS (Not Bugs)
- Driver TripInProgress + TripCompleted are LEGACY pages (not used in production flow — ActiveRide.tsx is the real page)
- Some passenger pages are STATIC (Profile, Settings, Legal) — by design
- bulk_sync_financials_to_supabase.py needs SUPABASE_SERVICE_KEY env var

---

## Blockers / Open Questions
- Promotion code structure: flat discount % or complex rules?
- Referral system: one-time discount or ongoing?
- Stripe: which plan/region? Live or test keys first?
- FCM mobile: test tokens available for both driver + passenger?

---

## Environment
- **Server**: root@private-driver.ro (116.203.80.227)
- **Frontend**: http://v4-full.private-driver.ro:3000
- **API**: http://v4-full.private-driver.ro:8888
- **Docker containers**: v4-frontend (nginx), v4-backend (FastAPI), v4-mongodb (MongoDB)
- **Deploy workflow**: Local build (npm run build) → scp to server → docker cp into containers → docker restart / nginx reload
- **DB**: mongodb://admin:admin@v4-mongodb:27017/privatedriver?authSource=admin
- **Test users**: test.admin / test.support / test.driver / test.user / fleet.user @private-driver.ro (all: Rares102018)

---

## Statistics
```
TOTAL PAGES:         118
  Admin:              23
  Fleet:              12
  Driver:             22
  Passenger:          31
  Support:             6
  Public:             18
  Auth (shared):       3
  Root:                3

ACTIVE MOCK PAGES:    0 (all converted to real API)
ACTIVE BACKEND BUGS:  0 (all original bugs resolved)
KNOWN OPEN ITEMS:     Stripe integration + FCM real-device validation + i18n pass
BUGS FIXED:          21/25 (historic 2026-02-17 baseline)
BACKEND TODO:         0

BACKEND ROUTES:      304 endpoints in 33 route files
WEBSOCKET EVENTS:    ~15 bidirectional events
DB COLLECTIONS:      ~25+ active collections
NEW ENDPOINTS (2026-02-28 sweep): message search, canned responses CRUD, push health/self-test
```

### Backend Route Files (33 total)
```
Core:        auth.py, user.py, driver.py, rider.py, ride.py
Messaging:   conversations.py, notifications.py, support.py
Admin:       admin.py, admin_premium.py
Executive:   executive.py
Premium:     premium.py
Fleet:       fleet.py, fleet_vehicles.py, fleet_pricing.py, fleet_analytics.py
Payments:    payments.py, invoices.py, trip_financials.py, financial_exports.py
Documents:   documents.py, uploads.py
Data:        saved_places.py, places.py, favorite_drivers.py, driver_aliases.py
Marketing:   promotions.py, referrals.py
Legal/Sync:  sync.py, gdpr.py, audit.py, legal_entities.py
Other:       project_map.py
```

### Endpoint Testing Summary (2026-02-17 Full Audit)
```
Admin endpoints:     26/26 tested OK (12 frontend fixes applied)
Fleet endpoints:     11/11 tested OK (4 frontend fixes applied)
Support endpoints:    9/9  tested OK (4 frontend + 3 backend fixes applied)
Driver endpoints:    Audited 2026-02-15/16, bug fixes 2026-02-17 (6/7 fixed)
Passenger endpoints: Audited 2026-02-14, bug fixes 2026-02-17 (14/18 fixed)
```

### Bug Tracking (2026-02-17 Manual Testing Session)
```
Bug files:           ai/bugs-passenger.md, ai/bugs-driver.md
Passenger bugs:      18 documented → 14 FIXED, 4 remaining
Driver bugs:          7 documented →  6 FIXED, 1 partially fixed
Features requested:   4 (FP1 done, FP2-FP4 TODO)
Fix rounds:           3 rounds, all deployed
```

---

## Update 2026-03-01 (Supabase Webhooks Premium)

- Root cause found for missing INSERT/DELETE sync behavior: webhook payload parser in `sync.py` required `record` and `old_record` as non-null dict, but Supabase sends `null` for one of them depending on event type.
- Backend patch applied:
  - `record`/`old_record` are optional.
  - ID extraction is tolerant (`record` or `old_record`).
  - DELETE handlers now use `db is not None` (fix for pymongo bool error).
- Deploy status:
  - Applied to premium runtime (`/var/www/premium/backend/app/routes/sync.py`) and `privatedriver-premium` restarted.
  - Parity copy pushed to `v4-backend`.
- Validation status:
  - Live webhook endpoint returns `200` for INSERT payload form (`old_record: null`) and DELETE payload form (`record: null`).
  - Previous `ValidationError` crashes and Mongo DB truthiness crash no longer reproducible.

## Next Steps (Exact)
1. Run manual UI sanity pass on premium (all roles) focused on visual overlap and navigation regressions after latest backend hotfixes:
   - passenger booking request screens
   - driver history + active ride screens
   - admin/fleet financial screens and exports
2. Continue webhook monitoring in `/var/log/privatedriver-premium.log` for Supabase sync events and capture payloads if any new `500` appears.
3. Close remaining go-live operational blockers:
   - rotate exposed secrets (Supabase, SMTP, Firebase service account)
   - validate FCM delivery on real devices with stored `fcmToken`
   - decide Stripe production go-live timing (if online card payments are needed at launch)

