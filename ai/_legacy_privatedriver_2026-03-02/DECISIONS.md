# ARCHITECTURAL DECISIONS

## (2026-03-01) Webhook Auth Mode Expanded: HMAC or Static Sync Token
- Context: Supabase dashboard webhooks are easier to configure with static headers; strict HMAC-only validation complicated operational setup.
- Decision:
  1. Keep HMAC signature validation support (`X-Webhook-Signature`, `X-Sync-Signature`, `X-Supabase-Signature`).
  2. Add static token fallback for dashboard compatibility:
     - `X-Sync-Token` must equal `SYNC_WEBHOOK_SECRET`.
  3. Require one of the two modes; unauthenticated calls remain rejected.
- Alternatives:
  - HMAC-only (rejected for ops friction in this deployment stage).
  - token-only (rejected because signature-based flow is still useful/compatible).
- Consequences:
  - webhook setup from Supabase UI is straightforward.
  - security baseline is maintained (secret required, no anonymous webhook calls).

## (2026-03-01) Supabase Bridge Must Support Dual Document Sources in Premium Runtime
- Context: premium Mongo runtime stores legal docs in `compliance_documents`, while legacy bridge expected `documents`; this caused false-zero document sync despite successful overall sync flow.
- Decision:
  1. Resolve document source collection dynamically at runtime:
     - prefer `documents` when present,
     - fallback to `compliance_documents` otherwise.
  2. Normalize document field mappings to support both legacy and compliance schemas.
  3. Keep target Supabase table unchanged (`vehicle_documents`) to avoid client/schema churn.
- Alternatives:
  - migrate Mongo data into legacy `documents` collection only (rejected: unnecessary operational migration).
  - create a second Supabase documents table for premium (rejected: duplicates reporting paths).
- Consequences:
  - one bridge implementation can sync both historical and premium datasets.
  - operational sync no longer silently drops documents in premium deployments.

## (2026-03-01) Premium Supabase Bridge Bootstrap via Versioned Migration
- Context: new premium Supabase project was connected, but only financial tables existed; bridge/mobile operations require additional core tables.
- Decision:
  1. Keep MongoDB as primary source and provision only required bridge tables in Supabase.
  2. Add deterministic migration file:
     - `supabase/migrations/20260301_create_bridge_core_tables.sql`
  3. Migration scope:
     - bridge tables: `users`, `rides`, `drivers`, `vehicle_documents`, `audit_logs`, `conversations`, `messages`, `support_tickets`
     - mobile table: `location_history`
     - baseline RLS policies for self-access on `users`, `rides`, `location_history`.
- Alternatives:
  - ad-hoc SQL in dashboard without versioned file (rejected: drift risk and poor reproducibility).
  - full import from legacy Supabase schema (rejected: unnecessary coupling and larger migration surface).
- Consequences:
  - provisioning is repeatable and auditable in repository.
  - remaining ops step is explicit: run migration in dashboard + set webhook secret on `/api/sync/webhook/supabase`.

## (2026-03-01) FCM Dual-Channel Strategy: HTTP v1 Preferred, Legacy Fallback
- Context: Firebase projects may no longer expose legacy server keys; premium needed push readiness with service-account credentials.
- Decision:
  1. Extend notification layer to support both channels:
     - `v1` (OAuth via service account; recommended)
     - `legacy` (server key; compatibility fallback)
  2. Add explicit mode switch:
     - `FCM_MODE=auto|v1|legacy`
     - `auto` prefers v1 when configured, then falls back to legacy.
  3. Expose push diagnostics in health payload:
     - active channel, v1/legacy readiness, and configuration errors.
- Alternatives:
  - keep legacy-only implementation (rejected: fragile long-term and unavailable for some projects).
  - migrate immediately to v1 without fallback (rejected: could break existing environments still relying on legacy keys).
- Consequences:
  - backend can run across both Firebase credential models.
  - operational setup still requires secure server-side key handling + token registration per environment.

## (2026-02-28) Close Non-Stripe Backlog with Backend-First Messaging/Realtime Controls
- Context: Premium rollout needed completion of all major non-Stripe gaps without introducing frontend-only behavior.
- Decision:
  1. Add backend-first message full-text search endpoint:
     - `GET /api/conversations/search/messages`
     - visibility constrained by conversation access + role rules.
  2. Add staff canned responses as managed backend resource:
     - `support_canned_responses` collection
     - CRUD under `/api/support/canned-responses`
     - role-scoped access (`global/support/admin/fleet_manager`).
  3. Replace passenger premium status polling with Socket.IO booking channel updates:
     - `join_executive_booking` / `leave_executive_booking`
     - `executive_booking_status` emissions from executive + driver lifecycle routes.
  4. Expose push diagnostic endpoints for operations:
     - `/api/notifications/push/health`
     - `/api/notifications/push/test-self`
     - keep real delivery validation as operational (device-token) step.
- Alternatives:
  - implement search/canned responses only in frontend state (rejected: inconsistent and non-authoritative).
  - keep polling-based premium status refresh (rejected: slower UX and avoidable request load).
- Consequences:
  - non-Stripe product backlog is functionally complete in code.
  - only Stripe integration and real-device FCM validation remain outside this scope.

## (2026-02-28) Messaging Privacy Gate for Peer Conversations (Ride-Scoped Window)
- Context: product requires strict user privacy, allowing non-staff direct chat only during ride lifecycle and limited post-ride interval, while keeping staff channels always reachable.
- Decision:
  1. Treat `admin`, `support`, `fleet_manager` as staff channels with always-allowed initiation/send.
  2. Enforce ride-scoped rule for non-staff direct chats:
     - create conversation only if users share eligible ride/booking context,
     - deny creation when no shared context (`403`),
     - deny send when conversation has no valid ride window.
  3. Use platform-configurable timeout source:
     - `system_settings.messaging.timeout_after_ride_hours`
     - default fallback: `8h`.
  4. Restrict non-staff peer contact discovery to eligible ride contexts in `GET /api/conversations/contacts`.
- Alternatives:
  - allow free direct chat between all users (rejected: privacy exposure).
  - rely only on frontend filtering without backend checks (rejected: bypass risk).
- Consequences:
  - privacy policy is backend-enforced and cannot be bypassed by UI/API clients.
  - staff escalation/support paths remain permanently available.

## (2026-02-28) Role-Scoped Messaging Contacts + Dynamic Participant Identity
- Context: product needs reliable cross-role messaging entry points (user/driver to support/admin/fleet) and profile-name consistency in conversations.
- Decision:
  1. Add `GET /api/conversations/contacts` as canonical role-scoped contact discovery endpoint.
  2. Refresh conversation participant identity at read time from `users` collection (not only stored snapshot fields).
  3. Return compatibility fields in both snake_case and camelCase for participant metadata.
- Alternatives:
  - rely only on stored `participant_names` from conversation creation (rejected: names become stale after profile edits).
  - expose full user directory to all roles (rejected: unnecessary data exposure).
- Consequences:
  - UI can always start direct chats with permitted roles without hardcoded IDs.
  - sender/participant labels remain aligned with current profile data.

## (2026-02-28) SMTP-first Email Delivery for Premium Executive Notifications
- Context: executive lifecycle email audit existed, but production delivery stayed `skipped`/`failed` when SendGrid was missing or unreachable.
- Decision:
  1. Extend `notification_service.py` with explicit provider strategy via `EMAIL_PROVIDER` (`auto|smtp|sendgrid`).
  2. Implement authenticated SMTP transport in backend (SSL/STARTTLS support, timeout, sender identity).
  3. Keep SendGrid as fallback/provider option for compatibility.
  4. Use `auto` semantics as `SMTP first -> SendGrid fallback`.
  5. Configure premium production to use SMTP domain mailbox credentials.
- Alternatives:
  - Keep SendGrid-only flow (rejected: unavailable keys and no deterministic delivery for current premium stack).
  - Implement frontend-side SMTP trigger (rejected: secret exposure and broken trust boundary).
- Consequences:
  - executive booking emails can be delivered in current premium infra without third-party API migration.
  - `communication_logs` now shows real `sent` events (provider code + message-id), improving legal/audit evidence.

## (2026-02-28) Contract Artifact per Executive Booking (PDF + SHA-256 + Versioned Archive)
- Context: platform must emit a contractual document per booking, with legal traceability and direct access for passenger/driver.
- Decision:
  1. Introduce dedicated service `executive_contract_service.py` for contract artifact generation.
  2. Persist every generated artifact in new Mongo collection `booking_contracts` (versioned by stage).
  3. Store integrity fingerprint (`sha256`) and file metadata (`fileName`, `filePath`, `fileSize`, `generatedAt`, actor).
  4. Keep latest artifact pointer on booking (`bookings.contractDocument`) for fast UI access.
  5. Expose download/list APIs under `/api/executive/bookings/{booking_id}/contracts*` with participant-based access control.
  6. Use resilient generation strategy:
     - primary path: WeasyPrint HTML -> PDF
     - fallback path: built-in minimal PDF renderer to avoid runtime dependency breakage.
- Alternatives:
  - keep only JSON contract snapshot in booking (rejected: no legal artifact, no downloadable evidence).
  - block booking flow when PDF generation fails (rejected: high operational risk; booking lifecycle must remain available).
- Consequences:
  - legal/audit posture improved through immutable contract versions per lifecycle stage.
  - backend remains deterministic even under WeasyPrint environment incompatibilities.

## (2026-02-28) Executive Stop/Wait Pricing Hierarchy + Contract Ledger
- Context: Premium platform requires legally auditable stop/wait charges with role-based pricing override (admin/fleet/pfa/driver) and explicit operational control in driver app.
- Decision:
  1. Add deterministic resolver service `executive_pricing.py` with precedence:
     - admin default (`system_settings.pricing.executiveStopPricing`)
     - fleet override (`fleet_settings.executiveStopPricing`)
     - PFA override (`legal_entities.executiveStopPricing` via driver-entity link)
     - driver override (`driver_premium.rate_card`)
  2. Persist executive booking contract snapshot at creation:
     - planned stops
     - stop/wait policy snapshot
     - initial charge ledger
  3. Introduce explicit executive service lifecycle endpoints for drivers:
     - start/complete service
     - start/stop waiting
  4. Apply wait charging rule:
     - if wait duration `<= freeWaitMinutes` -> fixed stop fee only
     - if wait duration `> freeWaitMinutes` -> fixed stop fee + wait fee (minute rate, second-based duration)
  5. Prevent fixed-fee double billing for planned stops (already included in booking estimate); add fixed fee incrementally only for ad-hoc unmatched stops.
- Alternatives:
  - Keep legacy on-demand `driver/ride/{id}/wait/toggle` for executive rides (rejected: pricing semantics and contract audit mismatch).
  - Compute stop charges only in frontend estimate (rejected: not auditable, non-authoritative).
- Consequences:
  - Charge calculation is backend-authoritative and deterministic.
  - Driver operational actions directly update contractual evidence (`contract.waitEvents`, stop completion metadata, booking events).
  - Pricing remains configurable without redeploy for admin/fleet/PFA/driver roles.

## (2026-02-27) Executive Package Catalog Managed by Admin API
- Context: Executive booking pricing moved to package-based model and required operational control without code edits.
- Decision:
  1. Expose admin CRUD endpoints under `/api/admin/executive/packages`.
  2. Persist package catalog in MongoDB collection `service_packages`.
  3. Seed default packages automatically on first admin list call when collection is empty.
- Alternatives:
  - Hardcode packages only in backend (rejected: no operational flexibility).
  - Store packages in static frontend config (rejected: backend remains source of truth for pricing snapshot).
- Consequences:
  - Admin can manage executive products live.
  - Booking flow always snapshots current package details from DB-backed source.

## (2026-02-27) Communication Audit Logging for Executive Lifecycle
- Context: Executive booking requires an auditable trail of outbound confirmations/cancellations beyond status transitions.
- Decision:
  1. Add writes to `communication_logs` for in-app notification events triggered during executive create/confirm/cancel/reject flows.
  2. Implement logging in both `/api/executive/*` and driver executive confirm/reject endpoints.
- Alternatives:
  - Keep only `booking_events` (rejected: captures lifecycle but not communication channel/template status).
- Consequences:
  - Audit trail now separates lifecycle events (`booking_events`) from communication delivery attempts (`communication_logs`).
  - Easier compliance and debugging for booking notifications.

## (2026-02-27) Premium Fork Runs in `executive_only` by Default
- Context: Premium instance must remove instant behavior in substance (not only UI) and move to manual-confirmation booking.
- Decision:
  1. Introduce platform flags in `system_settings` under `product/booking/pricing/ui`.
  2. Default mode for premium fork is `product.mode=executive_only`.
  3. Enforce flags in backend execution paths:
     - block `/api/rides/request`,
     - disable nearby/pooling execution surfaces,
     - disable matching broadcast in `booking_service`,
     - disable scheduler scheduled->requested broadcast conversion.
  4. Expose `GET /api/rides/config` so frontend can consume the same flags.
- Alternatives:
  - UI-only hide instant (rejected: backend could still execute instant dispatch).
  - Separate hard-fork codebase without feature flags (rejected for this stage: slower iteration and higher drift).
- Consequences:
  - Premium behavior is controlled centrally via DB flags and enforced backend-first.
  - On-demand code still exists in repository but is deactivated in executive mode.

## (2026-02-27) Introduce `/api/executive/*` Instead of Reusing On-Demand Contracts
- Context: Existing premium/instant endpoints model “instant accept/reject” and do not express executive booking requirements (lead-time, package snapshot, terms acceptance).
- Decision:
  1. Add dedicated `backend/app/routes/executive.py` with explicit booking lifecycle endpoints.
  2. Persist executive bookings in `bookings` with `bookingType=executive` and audit events in `booking_events`.
  3. Keep legacy premium request endpoint but block it in `executive_only`.
- Alternatives:
  - Overload `/api/premium/rides/request` with mixed semantics (rejected: unclear contract, fragile migration).
  - Store executive bookings in a totally separate collection only (rejected for now: higher migration overhead with existing tooling).
- Consequences:
  - Cleaner API contract and easier QA/E2E targeting.
  - Migration path remains incremental while preserving operational compatibility.

## (2026-02-21) Nginx Routing Precedence for API/File Endpoints on `x`
- Context: API routes serving files (e.g. `/api/uploads/serve/.../*.jpg`) were returning nginx `404` even when backend returned successful upload response.
- Decision:
  1. Use `location ^~ /api/` and `location ^~ /socket.io/` in `x.private-driver.ro` nginx config templates.
  2. Keep static hashed asset regex caching block, but prevent it from overriding API prefix matches.
- Alternatives:
  - Remove static regex cache location (rejected: would hurt frontend asset caching performance).
  - Change upload URLs to extension-less paths only (rejected as sole fix: would not solve existing API routes ending in file extensions).
- Consequences:
  - API endpoints with `.jpg/.png/.js` path suffixes are consistently proxied to backend.
  - Static frontend cache strategy remains intact for `/dist/assets`.

## (2026-02-21) Google OAuth Callback Through Backend + Fragment Session Hand-off
- Context: Role-specific auth pages required real Google sign-in without exposing OAuth client secret in frontend.
- Decision:
  1. Backend owns OAuth flow (`/api/auth/google/url` + `/api/auth/google/callback`).
  2. OAuth state is signed with HMAC (JWT secret) and includes role + safe frontend return path + origin.
  3. Backend exchanges code with Google, resolves/creates user, then redirects frontend with auth payload in URL fragment (`#...`) rather than query string.
  4. Frontend role auth page consumes fragment, restores session in local storage, and redirects by role.
- Alternatives:
  - Frontend-only OAuth code flow (rejected: would require exposing secret or PKCE redesign + more moving parts).
  - Backend callback returning plain JSON only (rejected: poor UX for browser redirect flow).
- Consequences:
  - Single server-side integration point for Google credentials.
  - Role mismatch is enforced server-side/user-safe.
  - Tokens are not logged in server URL query by default because fragment is client-side.

## (2026-02-21) Booking Search Queue + Driver Next-Ride Queue
- Context: Product required three gaps: passenger queue auto-retry (FP2), driver accepts next ride while active (FP3), and stop/wait pricing enforcement (FP4).
- Decision:
  1. Bookings now carry queue/search metadata (`queueState`, `queuePosition`, `searchAttempts`, `nextRetryAt`, `lastSearchAt`).
  2. Passenger polling endpoint (`/api/rides/booking/{id}/status`) drives safe auto-retry when retry window is reached.
  3. Driver can accept a booking as `queued` when already on an active ride; queued ride auto-activates to `accepted` when current ride completes/cancels.
  4. Wait/stop costs read from pricing config (`waitMinuteFee`, `waitStartFee`, `quickStopFee`) instead of hardcoded constants.
- Alternatives:
  - Background worker-only retry queue (rejected for now: heavier infra requirement in this iteration).
  - Keep hardcoded wait pricing (rejected: admin pricing config already exists and should be source of truth).
- Consequences:
  - Queue behavior is deterministic and transparent to frontend via status payloads.
  - Driver flow now supports one queued next ride at a time.
  - Fare estimate and runtime wait billing use the same pricing configuration semantics.

## (2026-02-07) Messaging Window Architecture
- Context: Messaging between driver and passenger needs to be time-limited after ride completion, but permanent for support/admin conversations
- Decision: Implemented a `can_send_message()` function in conversations.py that checks:
  1. If conversation has support/admin participant → always allow (permanent)
  2. If conversation is linked to a ride (`ride_id` field):
     - Ride active (accepted/in-progress/arrived) → allow
     - Ride completed → allow only within `timeout_after_ride_hours` (configurable)
     - Ride cancelled/other → deny
  3. Timeout hours stored in `system_settings` collection (`_id: "platform"`, field `messaging.timeout_after_ride_hours`)
  4. Default timeout: 3 hours
- Alternatives:
  - Hard-coded timeout (rejected: user wants admin-configurable)
  - Separate `messaging_expires_at` timestamp on conversation (rejected: harder to change retroactively)
- Consequences: Every message send checks ride status + timing. Admin can change timeout at any time and it applies immediately to all conversations.

## (2026-02-07) Auto-Conversation on Ride Accept
- Context: When a driver accepts a ride, they need to be able to communicate with the passenger immediately
- Decision: In `driver.py` `accept_ride()`, after creating the ride document, auto-create a conversation document linking both participants with `ride_id` field
- Alternatives: Create conversation lazily when first message is sent (rejected: frontend expects conversation to exist when chat is opened)
- Consequences: Every accepted ride creates a conversation. Conversation is linked to ride for messaging window enforcement.

## (2026-02-07) Platform Settings Collection
- Context: Need configurable platform settings accessible from admin panel
- Decision: Single document in `system_settings` collection with `_id: "platform"`. Nested structure: `messaging`, `general`, `notifications`, `security`. Admin endpoints `GET/PUT /api/admin/settings` with per-section updates via `$set` with dot notation.
- Alternatives: Separate documents per section (rejected: overhead for simple config). Environment variables (rejected: requires restart)
- Consequences: Settings can be changed at runtime. Default values inserted on first read.

## (2026-02-07) FastAPI Route Ordering for Static vs Dynamic Routes
- Context: `/api/rides/categories` was being matched as `/{ride_id}` parameter, returning "Invalid ride ID"
- Decision: Static routes (like `/categories`) MUST be defined BEFORE dynamic routes (like `/{ride_id}`) in FastAPI router
- Alternatives: Use regex constraints on path parameters (rejected: more complex, FastAPI matches first defined route)
- Consequences: All future static endpoints under a dynamic router must be placed before the catch-all dynamic route.

## (2026-02-04) Mock Data Removal Strategy
- Context: Admin and fleet pages used shared mock data files (mockAdminData.ts, mockFleetData.ts)
- Decision: Remove shared mock files entirely and connect all pages to real API endpoints. Each page fetches data via `fetch('/api/...')` with JWT auth header.
- Alternatives: Keep mock files as fallback (rejected: creates confusion about data source)
- Consequences: All admin/fleet pages require working backend. Zero mock data in production.

## (2026-02-03) Dual Database Architecture (MongoDB + Supabase/Postgres)
- Context: Need MongoDB for flexible document storage + real-time, and Supabase/Postgres for legal compliance (ANAF/ARR)
- Decision: MongoDB = primary operational database. Supabase = sync target for legally required data (users, trips, financials, invoices). Sync via `supabase_bridge.py` service.
- Alternatives: Single database (rejected: MongoDB lacks relational integrity for financial/legal data; Postgres lacks flexibility for real-time document ops)
- Consequences: Must maintain sync between both databases. Financial "truth" lives in both (MongoDB for operations, Supabase for legal reporting).

## (2026-03-01) Supabase Webhook Payload Must Accept Nullable `record` / `old_record`
- Context: Premium webhook endpoint returned 500 for Supabase INSERT/DELETE events because strict payload model required both `record` and `old_record` as objects.
- Decision:
  1. Treat `record` and `old_record` as optional in webhook schema.
  2. Resolve entity id from either source (`record.id` or `old_record.id`) based on event shape.
  3. For delete soft-delete branches, use explicit null check (`db is not None`) to avoid pymongo `Database.__bool__` runtime error.
- Alternatives:
  - Keep strict schema and force Supabase payload transformation (rejected: fragile and unnecessary coupling to trigger config internals).
  - Split endpoints per event type with separate models (rejected: extra complexity for same contract).
- Consequences:
  - `INSERT/UPDATE/DELETE` from Supabase are handled reliably with one endpoint.
  - Webhook retries due parser/boolean crashes are eliminated for known payload variants.

## (2026-03-01) Driver Accounts Are Fleet-Invitation-Only (Legal Compliance Gate)
- Context: Business/legal model requires contracts between passenger and legal operator entity, not passenger-driver. Driver must belong to fleet/legal entity.
- Decision:
  1. Driver registration is allowed only with valid invitation token issued by fleet (`driver_invitations`).
  2. Fleet invitation issuance requires active linked legal entity.
  3. Driver runtime access is denied if account is not linked to active fleet legal context.
  4. Executive booking persists operator context (`fleetId`, `legalEntityId`, `operatorSnapshot`) and contract rendering uses operator entity as party.
- Alternatives:
  - Keep open driver signup and validate only at trip accept (rejected: too late and allows legally non-compliant accounts).
  - Allow direct fleet promotion by email without invite (rejected: bypasses auditable onboarding chain).
- Consequences:
  - Legal traceability improves (`invite -> account -> fleet -> legal entity -> contract`).
  - Legacy drivers without fleet/legal linkage are intentionally blocked until migrated.

