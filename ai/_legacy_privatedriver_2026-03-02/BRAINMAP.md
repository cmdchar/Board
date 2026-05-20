# BRAINMAP - premium.private-driver.ro

> Generated: 2026-02-28
> Scope: full snapshot of current code + live runtime checks
> Goal: arata clar ce este implementat si ce mai trebuie facut

---

## Update 2026-03-02 — Admin users API 500 fixed

- Endpoint:
  - `GET /api/admin/users?page=1&limit=20`
- Failure observed:
  - response `500` in admin UI.
  - traceback in premium runtime:
    - `backend/app/routes/admin.py:get_all_users`
    - `user["createdAt"].isoformat()` on a string value.
- Fix applied:
  - switched date serialization to `_to_iso_or_str(...)` for:
    - users list endpoint
    - drivers list endpoint (preventive consistency).
- Deployment:
  - updated `/var/www/premium/backend/app/routes/admin.py`
  - restarted `privatedriver-premium`.
- Validation:
  - `/api/admin/users?page=1&limit=20` -> `200`
  - `/api/admin/drivers?page=1&limit=20` -> `200`

---

## Update 2026-03-02 — Admin dashboard KPI deep-links

- Updated page:
  - `src/pages/admin/Dashboard.tsx`
- Change:
  - all KPI containers on `/admin/dashboard` are now click-through links to their operational pages.
- Link map:
  - `Total Users` -> `/admin/users`
  - `Active Drivers` -> `/admin/drivers-management`
  - `Total Rides` -> `/admin/trips`
  - `Total Revenue` -> `/admin/financial-management`
  - `Active Rides` -> `/admin/trips`
  - `Today's Rides` -> `/admin/trips`
  - `Avg Rating` -> `/admin/feedback`
  - `Today Revenue` -> `/admin/financial-management`
- Validation:
  - local build PASS.

---

## Update 2026-03-01 — RBAC closure on shared ride endpoint + driver history hardening

- Critical runtime drift fixed on premium:
  - endpoint: `GET /api/rides/{ride_id}`
  - deployed route now enforces:
    - authenticated access (`Depends(get_current_user)`)
    - role/ownership authorization (`user` own rides, `driver` assigned rides, staff roles allowed).
- Live access matrix validated:
  - unauthenticated -> `401`
  - owner user/driver -> `200`
  - non-owner user/driver -> `403`
  - admin staff -> `200`
- Regression found during full-suite re-run and fixed:
  - endpoint: `GET /api/driver/rides/history`
  - root cause: legacy-only parsing (`ride.passengers[0]...`) crashed on new/mixed ride docs.
  - patch in `backend/app/routes/driver.py`:
    - schema-tolerant pickup/dropoff parsing (`passengers` + `pickup/pickupLocation` + `dropoff/destination/dropoffLocation`)
    - safe passenger lookup and date serialization
    - crash-free history response on mixed datasets.
- Post-fix global validation:
  - `BASE_URL=https://premium.private-driver.ro npm run e2e` -> `110/110 PASS`.

---

## Update 2026-03-01 — Brainmap complet all-roles (final handoff)

- Consolidated artifact generated for visual AI rendering:
  - `ai/defalcat/brainmapAllRoles.md`
- Scope:
  - all role dashboards (`user`, `driver`, `fleet_manager`, `support`, `admin`);
  - frontend routing + guards + role menus;
  - backend domain routers and critical cross-role channels;
  - realtime Socket.IO rooms/events;
  - Mongo primary data domains + Supabase bridge;
  - Mermaid diagrams + JSON graph (`nodes`/`edges`) for auto-render tools.

---

## Update 2026-03-01 — Full-system verification closed (110/110 PASS)

- Runtime links reconfirmed end-to-end on premium:
  - role auth pages:
    - `/v2/driver/auth`
    - `/v2/passenger/auth`
  - backend compliance bridge:
    - driver fleet lookup now resolves legacy owner-id mappings (`ownerId`) in operator compliance flow.
- Cross-layer validation status:
  - frontend route render + API calls + backend RBAC + DB-backed role flows: PASS in full E2E run.
  - verified domains in one pass:
    - auth, rides, executive bookings, driver APIs, messaging, support tickets, admin dashboards, fleet analytics/financials.
- Test baseline on live premium:
  - `BASE_URL=https://premium.private-driver.ro npm run e2e` -> `110/110 PASS`.

---

## Update 2026-03-01 — Financial export endpoints confirmed live on premium

- Production runtime (`premium.private-driver.ro`) now confirmed for:
  - `GET /api/fleet/analytics/earnings/export`
  - `GET /api/fleet/analytics/reports/export`
  - `GET /api/admin/financial-exports/anaf/monthly?download=true`
  - `GET /api/admin/financial-exports/arr/audit-pack?download=true`
- Frontend triggers validated:
  - `/fleet/earnings` -> `Export` button -> earnings export endpoint (`200`)
  - `/fleet/reports` -> `Export All` button -> reports export endpoint (`200`)
- Backend compatibility hardening:
  - financial export month parsing no longer depends on external `dateutil`; internal parser used in `FinancialExportService`.

---

## Update 2026-03-01 — Financial flows Admin+Fleet hardened

- Frontend financial connections updated:
  - `src/pages/fleet/Reports.tsx`
    - `GET /api/fleet/analytics/reports?range=<week|month|quarter|year>`
    - `GET /api/fleet/analytics/reports/export?period=...&report_type=<all|kpis|drivers|vehicles|trips>`
  - `src/pages/fleet/Earnings.tsx`
    - `GET /api/fleet/analytics/earnings?group_by=driver&period=<week|month>`
    - `GET /api/fleet/analytics/earnings/export?period=...&group_by=driver`
  - `src/pages/admin/FinancialManagement.tsx`
    - paginated full-load for:
      - `GET /api/admin/trip-financials?skip=...&limit=100`
      - `GET /api/invoices/all?page=...&limit=200`
    - exports:
      - `GET /api/admin/financial-exports/anaf/monthly?month=YYYY-MM&download=true`
      - `GET /api/admin/financial-exports/arr/audit-pack?month=YYYY-MM&download=true`
- Result:
  - no unsupported high-limit calls in admin financial UI;
  - fleet report/financial exports now execute real backend downloads with auth headers;
  - improved error visibility for fleet financial screens.

---

## Update 2026-03-01 — Passenger Dashboard Audit/Fix (targeted)

- Passenger entrypoint confirmed: `/v2/passenger` -> `src/pages/passenger/Home.tsx` (guard `requiredRoles=['user']`).
- Navigation sources confirmed:
  - shared bottom nav: `src/components/shared/BottomNavigation.tsx`
  - home sheet menu: `src/pages/passenger/Home.tsx`
  - profile secondary menu: `src/pages/passenger/Profile.tsx`
  - settings sub-navigation: `src/pages/passenger/Settings.tsx`
- Targeted runtime fixes applied:
  - `src/pages/passenger/History.tsx` (response parsing for `/api/rider/rides`)
  - `src/pages/passenger/Notifications.tsx` (remove invalid `role=passenger` filter)
  - `src/pages/passenger/RideDetail.tsx` (booking detail path + payload mapping hardening)
  - `src/pages/passenger/RideOptions.tsx` (cancel route normalization)
  - `src/App.tsx` (remove stale `PassengerAuth` import)
- Detailed audit record:
  - `ai/defalcat/braindashboardUSER.md`

## Update 2026-03-01 — Driver Dashboard Audit/Fix (targeted)

- Driver entrypoint confirmed: `/v2/driver` -> `src/pages/driver/Home.tsx` (guard `requiredRoles=['driver']`).
- Navigation sources confirmed:
  - shared bottom nav: `src/components/shared/BottomNavigation.tsx`
  - home sheet menu: `src/pages/driver/Home.tsx`
  - profile secondary menu: `src/pages/driver/Profile.tsx`
  - settings sub-navigation: `src/pages/driver/Settings.tsx`
- Targeted runtime fixes applied:
  - `src/services/api.ts` (`acceptRideRequest`/`rejectRideRequest` endpoint correction)
  - `src/pages/driver/WaitingForPassenger.tsx` and `src/pages/driver/TripInProgress.tsx` (waybill route fix)
  - `src/pages/driver/Help.tsx` + `backend/app/routes/driver.py` (quick links route hardening)
  - token-gated fetch updates:
    - `src/pages/driver/Documents.tsx`
    - `src/pages/driver/Earnings.tsx`
    - `src/pages/driver/Premium.tsx`
    - `src/pages/driver/Settings.tsx`
    - `src/pages/driver/Vehicle.tsx`
    - `src/pages/driver/Help.tsx`
  - `src/pages/driver/PremiumDashboard.tsx` (query `enabled: !!token`)
- Validation executed:
  - `npm run build` PASS
  - `npm run test` PASS
  - `npm run e2e:driver` PASS (`16/16`)
- Detailed audit record:
  - `ai/defalcat/braindashboardDriver.md`

## Update 2026-03-01 — Cross User+Driver Audit/Fix (targeted)

- Scope covered:
  - shared lifecycle flows user<->driver (request/accept/reject/status updates),
  - shared messaging channels and notification flows,
  - shared ride detail endpoint hardening.
- Targeted runtime fixes applied:
  - `src/pages/driver/Home.tsx`
    - notifications overlay now uses `/api/notifications/list` (without `role=driver` filter).
  - `backend/app/routes/ride.py`
    - `GET /api/rides/{ride_id}` now requires authenticated user (`Depends(get_current_user)`);
    - added role/ownership authorization:
      - staff (`admin/support/fleet_manager`) allowed,
      - passenger only for own rides,
      - driver only for assigned rides.
- Validation executed:
  - `npm run build` PASS
  - `npm run test` PASS
  - `npm run e2e:passenger` PASS (`23/23`)
  - `npm run e2e:driver` PASS (`16/16`)
  - `npm run e2e:messaging` PASS (`16/16`)
  - `python -m compileall backend/app/routes/ride.py` PASS
- Detailed audit record:
  - `ai/defalcat/crossuserdriver.md`

---

## 1) Snapshot General (AS-IS)

- Frontend routes in `src/App.tsx`: **134**
- Frontend page files in `src/pages/**`: **118**
- Backend route files in `backend/app/routes`: **33** (`32` incluse explicit in `main.py` + `rider_router` din `user.py`)
- Backend endpoints (`@router.get/post/put/patch/delete`): **304**
- Primary DB: **MongoDB**
- Supabase: **bridge/sync layer**, nu DB primar
- Realtime: **Socket.IO** + SSE notifications
- Premium live domain: **https://premium.private-driver.ro**

Supabase premium wiring update (2026-03-01):
- new project credentials configured in local + premium backend env
- backend sync bridge is online (`/api/sync/status` healthy)
- project currently has financial tables only (`legal_entities`, `trip_financials`, `invoices`)
- missing bridge core tables prepared in migration:
  - `supabase/migrations/20260301_create_bridge_core_tables.sql`

Supabase post-migration update (2026-03-01 later):
- migration executed in dashboard; bridge tables are now available.
- sync layer compatibility patch deployed for premium data shape:
  - `drivers` payload aligned with bridge schema
  - documents source fallback (`documents` or `compliance_documents`)
- verified synced rows in Supabase:
  - `users=14`, `drivers=5`, `vehicle_documents=5`, `audit_logs=186`, `conversations=25`, `messages=35`, `support_tickets=3`.
- webhook auth update:
  - `/api/sync/webhook/supabase` accepts `X-Sync-Token=<SYNC_WEBHOOK_SECRET>` for direct Supabase dashboard integration
  - signature headers remain supported.

Live sanity check (2026-02-28):
- `GET /api/health` -> `healthy`
- Login test conturi: `admin/support/driver/user/fleet_manager` -> toate `200`
- Core role endpoints smoke -> `200`:
  - `/api/admin/dashboard`
  - `/api/support/tickets`
  - `/api/driver/home`
  - `/api/rider/rides`
  - `/api/fleet/stats`
  - `/api/rides/config`
  - `/api/premium/drivers`
  - `/api/conversations`

---

## 2) Ce Este Facut (Complet sau Functional in productie)

### 2.1 Model premium executive (fara ridesharing instant)

- Product mode premium activ (`executive_only`) cu flow de booking manual.
- Redirect-uri de hard cleanup pentru flow instant legacy in rutele V2.
- Booking flow executive functional:
  - estimare,
  - creare booking,
  - confirm/reject sofer,
  - start/stop wait,
  - complete service,
  - rerouting la reject.

### 2.2 Pricing + stops/wait + contract

- Tarifare `trip_km` one-way (fara retur) + `hourly_hire` explicit.
- Opriri nelimitate cu reguli stop/wait aplicate in backend.
- Contract PDF auto-per-booking (versionare, hash, download passenger/driver).
- Pagini legale publice aliniate modelului contractual per booking.

### 2.3 Mesagerie (reguli noi de intimitate)

- Canale staff (`admin`, `support`, `fleet_manager`) initiate oricand.
- Peer chat (`user` <-> `driver` / `user` <-> `user`) permis doar cu context de cursa eligibil.
- Fereastra post-cursa configurabila din `system_settings.messaging.timeout_after_ride_hours` (fallback `8h`).
- `GET /api/conversations/contacts` role-scoped + privacy gate.
- `GET /api/conversations/search/messages` activ (full-text cu pagination + RBAC visibility).
- `GET/POST/PUT/DELETE /api/support/canned-responses` activ (scope + ownership rules).
- UI tabs separate in mesagerie passenger/driver: `Toate`, `Support`, `Admin`, `Fleet`.
- Canned response picker integrat in chat pentru staff (`support/admin/fleet_manager`).
- Premium booking status in `PremiumRideRequest` actualizat realtime prin Socket.IO (`executive_booking_status`), fara polling periodic.

### 2.4 Auth + OAuth

- Auth clasic (`/api/auth/login`, refresh, devices) functional.
- Google OAuth implementat end-to-end:
  - `/api/auth/google/url`
  - `/api/auth/google/callback`
  - flow frontend in `RoleAuthPage.tsx`.

### 2.5 Functionalitati enterprise deja active

- Admin/Fleet/Support dashboards conectate la API real.
- Upload imagine mesagerie + profile operational.
- Notifications API + web push (VAPID) disponibile.
- SMTP live pentru emailuri executive pe premium.

---

## 3) Frontend Map (Rute + Stare)

## 3.1 Route groups (din `src/App.tsx`)

- Public routes: **18**
- Auth routes: **2**
- Admin routes: **24**
- Fleet routes: **12**
- Support routes: **6**
- V2 Passenger routes: **33**
- V2 Driver routes: **30**
- Legacy redirects: **3**
- Misc (`/v2`, `/v2/`, `/install`, catch-all etc.): **6**

### 3.2 Page files (din `src/pages/**`)

- `admin`: **23**
- `fleet`: **12**
- `driver`: **22**
- `passenger`: **31**
- `support`: **6**
- `public`: **18**
- `auth`: **3**
- `root` (`AppSelector`, `InstallPage`, `NotFound`): **3**

### 3.3 Legacy/orphan page files

- Instant premium orphan pages removed from codebase:
  - `src/pages/driver/IncomingRequest.tsx`
  - `src/pages/driver/PremiumIncomingRequest.tsx`
  - `src/pages/driver/PremiumNavigateToPickup.tsx`
  - `src/pages/driver/PremiumTripCompleted.tsx`
  - `src/pages/driver/PremiumTripInProgress.tsx`
  - `src/pages/driver/PremiumWaitingForPassenger.tsx`
  - `src/pages/passenger/DriverMatched.tsx`
  - `src/pages/passenger/FindingDriver.tsx`
- Routes still exist only as compatibility redirects in `src/App.tsx`.

---

## 4) Backend API Map (Fișiere + Endpointuri)

> Endpoint count by route file (`backend/app/routes/*.py`):

| Route file | Endpoints |
|---|---:|
| `admin.py` | 29 |
| `admin_premium.py` | 2 |
| `audit.py` | 4 |
| `auth.py` | 10 |
| `conversations.py` | 10 |
| `documents.py` | 12 |
| `driver.py` | 41 |
| `driver_aliases.py` | 3 |
| `executive.py` | 16 |
| `favorite_drivers.py` | 3 |
| `financial_exports.py` | 7 |
| `fleet.py` | 18 |
| `fleet_analytics.py` | 7 |
| `fleet_pricing.py` | 11 |
| `fleet_vehicles.py` | 8 |
| `gdpr.py` | 5 |
| `invoices.py` | 3 |
| `legal_entities.py` | 6 |
| `notifications.py` | 17 |
| `payments.py` | 11 |
| `places.py` | 2 |
| `premium.py` | 8 |
| `project_map.py` | 1 |
| `promotions.py` | 6 |
| `referrals.py` | 7 |
| `ride.py` | 11 |
| `rider.py` | 1 |
| `saved_places.py` | 4 |
| `support.py` | 12 |
| `sync.py` | 6 |
| `trip_financials.py` | 6 |
| `uploads.py` | 6 |
| `user.py` | 11 |
| **TOTAL** | **304** |

### 4.1 Router inclusion integrity

- Route files detectate: **33**
- Include_router in `main.py`: **32**
- `rider.py` este inclus prin `rider_router` importat din `user.py`.
- Rezultat: **nu exista route file "uitat" la runtime**.

---

## 5) Integrari Externe (Stare curenta)

### 5.1 Maps / geocoding

- `places/autocomplete` + `places/details` active.
- `DestinationSearch` foloseste autocomplete realtime (`/api/places/autocomplete`).
- Harta itinerariu premium cu route + stops este functionala.

### 5.2 Email

- SMTP configurat in premium (mail.smart-promotions.ro, flow validat).
- `notification_service.py` suporta `smtp/sendgrid/auto`.

### 5.3 Push notifications

- Web Push (VAPID) implementat (`web_push_service.py`, `/api/notifications/vapid-public-key`).
- FCM server flow exista in `notification_service.py`.
- Push diagnostics backend active:
  - `GET /api/notifications/push/health`
  - `POST /api/notifications/push/test-self`
- Validarea finala ramasa: delivery pe device/token mobil real.

### 5.4 Payments

- Payments API + Stripe routes exista (`/api/payments/*`).
- Stripe depinde de `STRIPE_SECRET_KEY`/webhook config pentru productie completa.

### 5.5 OAuth

- Google OAuth backend+frontend implementat si functional pe endpoint init (`/api/auth/google/url` -> 200).

---

## 6) Compliance + Legal (Stare)

- Document legal operational `Firma.MD` exista in root.
- `/legal` public actualizat pentru modelul nou (contract-cadru + anexa automata per booking).
- Contract booking artifacts (PDF + hash + istoric) implementate in backend.

---

## 7) Ce Mai Trebuie Facut (Backlog real, curatat)

## P0 (recomandat imediat)

1. Stripe production readiness end-to-end:
- confirmare chei live/test, webhook secret, smoke complet `intent -> confirm -> refund` pe premium.

2. FCM mobile delivery validation:
- cod backend este gata (`/api/notifications/push/health` + `/api/notifications/push/test-self`);
- mai ramane validarea finala pe token/device real.

## P1 (polish)

3. Performance pass (route-level lazy loading, chunk split).

4. Analytics extins (custom KPI enterprise/fleet).

### Observatie importanta despre backlog vechi

In `ai/TASKS.md` existau itemi marcati pending care sunt deja implementati in cod:
- Nominatim/places autocomplete: **implementat**.
- Google OAuth flow: **implementat**.

Acestea au fost aliniate la realitate in update-ul curent al documentatiei.

---

## 8) Matrice Done vs Remaining (executive premium)

| Domeniu | Stare |
|---|---|
| Executive booking only model | DONE |
| Instant ridesharing flow removal (runtime) | DONE |
| Pricing trip_km one-way + hourly_hire | DONE |
| Stops + wait charging logic | DONE |
| Contract PDF per booking + download | DONE |
| Messaging privacy gate + staff tabs | DONE |
| Server-side message search | DONE |
| Canned responses support | DONE |
| Premium realtime (replace polling) | DONE |
| Legacy orphan pages cleanup | DONE |
| Push readiness endpoints + self-test | DONE |
| Legal page alignment (`/legal`) | DONE |
| SMTP live notifications | DONE |
| Stripe production hardening | REMAINING |
| FCM real-device validation | REMAINING |

---

## 9) Next Steps (Exact)

1. Ruleaza P0 tehnic: Stripe + FCM real-device validation.
2. Ruleaza P1 polish: performance + analytics.
3. Dupa fiecare lot, actualizeaza:
- `ai/CHANGELOG_AI.md`
- `ai/BRAIN.md`
- `ai/TASKS.md`
- `ai/BRAINMAP.md`

---

## 10) Sync Webhook Contract Notes (2026-03-01)

- Endpoint: `POST /api/sync/webhook/supabase`
- Auth accepted:
  - HMAC signature headers (`X-Webhook-Signature` / `X-Sync-Signature` / `X-Supabase-Signature`)
  - or static `X-Sync-Token=<SYNC_WEBHOOK_SECRET>`
- Payload tolerance (important):
  - `record` can be `null` (seen on DELETE variants)
  - `old_record` can be `null` (seen on INSERT variants)
  - handler now resolves entity id from either `record.id` or `old_record.id`
- Runtime behavior:
  - `users` INSERT/UPDATE → sync from Supabase
  - `users` DELETE → Mongo soft-delete by `supabase_id`
  - `rides` INSERT/UPDATE → sync from Supabase
  - `rides` DELETE → Mongo soft-delete/status=deleted by `supabase_id`

---

## 11) Runtime Hotfixes (2026-03-01)

- `GET /api/admin/dashboard`:
  - fixed crash on legacy rides where `createdAt` is string, not datetime.
  - serialization is now tolerant (`datetime|string`) in `admin.py`.
- Post-fix smoke on premium runtime:
  - admin `dashboard` 200
  - support `tickets` 200
  - driver `home` 200
  - user `rider/rides` 200
  - fleet `stats` 200

---

## 12) Legal Compliance Flow Map (2026-03-01)

- Fleet -> Driver onboarding (new):
  - `POST /api/fleet/drivers` => creates invitation token (`driver_invitations`)
  - `GET /api/fleet/driver-invites` => invite status list
  - `POST /api/fleet/driver-invites/{invite_id}/revoke` => revoke pending invite
  - `GET /api/auth/driver-invitation/validate?token=...` => public invitation preview
  - `POST /api/auth/register` (role=driver, inviteToken required) => consumes invite and creates driver bound to fleet/legal entity
- Fleet legal linkage:
  - `GET /api/fleet/legal-entity`
  - `PUT /api/fleet/legal-entity`
- Executive legal enforcement:
  - booking creation requires driver with valid `fleet + legal_entity` context
  - booking stores `fleetId`, `legalEntityId`, `operatorSnapshot`, `driverSnapshot`
  - contract service renders legal operator as contractual party and driver as delegated executor

