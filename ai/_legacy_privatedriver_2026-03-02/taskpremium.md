# Task — `premium.private-driver.ro` (Executive Booking / Chauffeur)

Data: **2026-02-27**  
Repo/instanță de lucru: `H:\Users\nicus\Documents\premium.private-driver.ro` (copie izolată; nu afectează `v5.private-driver.ro`)  
Scop: transformăm produsul din “ride‑hailing on‑demand” într-un **model real de rezervări chauffeur / executive** (fără “Rezervare rapidă”), pentru a **reduce riscul** de încadrare ca “platformă digitală de transport programat” (OUG 49/2019) și pentru a poziționa corect serviciul ca premium/corporate.

> Notă: acesta este un plan tehnic + produs + conformitate. Nu reprezintă consultanță juridică; validează modelul final cu avocat + contabil. Obiectivul este **aliniere de produs în substanță** (nu “cosmetizare”).

---

## 0) Guardrails (obligatorii)

- Nu urmărim “ocolirea” legii prin ascunderea funcțiilor; schimbăm **natura serviciului** (pre‑contractare + rezervare + pachete).
- Tot ce e “on‑demand / matching instant / tarif per km + acceptare imediată” trebuie **dezactivat tehnic** + eliminat gradual din UX.
- Instanță separată: domeniu + port + service + director + DB **separate** (ca să nu stricăm `v5` / `x`).

---

## 1) Izolare (să nu stricăm proiectul existent)

- [x] Copie locală creată: `H:\Users\nicus\Documents\premium.private-driver.ro`
- [x] Repo include `agents.md` + `ai/` (memorie separată pentru premium)
- [ ] **DB separată** pentru premium (obligatoriu la deploy): `privatedriver_premium`
- [ ] **Port separat** backend (propus: `8915`) + `systemd` service separat (propus: `privatedriver-premium`)
- [ ] **Director separat** pe server: `/var/www/premium`
- [ ] Chei/integrare separate (Supabase/Stripe/SendGrid/FCM) sau dezactivate până la confirmare

---

## 2) Audit rapid — ce e “exact ca Bolt” (VERIFICAT în cod)

### On‑demand / matching / broadcast (backend)
- `backend/app/routes/ride.py` → `POST /api/rides/request`:
  - calculează tarif pe distanță/durată (`calculate_fare_with_stops`)
  - creează `bookings` cu status `requested`
  - declanșează matching/broadcast (`process_booking_request`) când **nu** e `scheduledTime`
- `backend/app/services/booking_service.py` → `process_booking_request()`:
  - `find_nearby_drivers()` + `emit_new_ride_request()` (Socket.IO) + push (FCM)
  - model “queue/searching/drivers_notified”
- `backend/app/services/scheduler_service.py`:
  - transformă scheduled → requested și declanșează broadcast cu 30 min înainte
- `backend/app/routes/ride.py` include pooling: `GET /api/rides/available-pools` (necompatibil cu premium chauffeur)

### On‑demand / hărți / “nearby drivers” (frontend)
- `src/pages/passenger/Home.tsx`:
  - fetch + stare `nearbyDrivers` + markere pe hartă (“șoferi în apropiere”)
- `src/pages/passenger/FindingDriver.tsx` + `src/pages/passenger/DriverMatched.tsx`:
  - flow tipic “căutăm șofer” → “șofer găsit” (real‑time)
- `src/services/api.ts`:
  - `requestRide()` → `POST /rides/request` (on‑demand)

### Realtime (WebSocket)
- `backend/app/websocket/socket_handler.py` + `src/services/websocketService.ts`:
  - room-uri de ride (`join_ride_room`) + evenimente de ride request/accept/status (susțin matching instant)

### Ce avem deja “aproape de modelul dorit” (reutilizabil)
- `backend/app/routes/premium.py`:
  - `POST /api/premium/rides/request` = cerere către **șofer specific** (status `pending`)
  - accept/reject manual: `PUT /api/premium/rides/{ride_id}/accept|reject`
  - polling status: `GET /api/premium/rides/{ride_id}/status`
  - (dar azi poate fi folosit și “acum”; trebuie transformat în **rezervare** cu lead‑time + pachete)

---

## 3) Audit complet (obligatoriu înainte de refactor mare)

### A) Inventar repo & config (rulează și salvează output în `ai/` ca referință)
- [ ] `ls` în root
- [ ] `cat package.json`
- [ ] `cat README.md`
- [ ] `tree -L 4` (dacă există)
- [ ] `.env.example` + orice config map/OSRM/Nominatim
- [ ] “schema DB” (Mongo): documentează colecțiile și câmpurile cheie folosite de ride/booking/premium
- [ ] Lista de routes: `backend/app/routes/*` + prefix-uri + endpoint-uri critice
- [ ] Lista evenimente Socket.IO (server + client)
- [ ] Worker jobs/background tasks: scheduler + orice “retries” / cron

### B) Fișiere cheie de citit (și notat în raport)
- Passenger “request/book/matching”: `src/pages/passenger/Home.tsx`, `RideOptions.tsx`, `FindingDriver.tsx`, `DriverMatched.tsx`, `RideInProgress.tsx`
- Pricing logic: `backend/app/services/payment_service.py`, `backend/app/routes/payments.py`, orice “surge”
- Dispatch/matching/jobs: `backend/app/services/booking_service.py`, `backend/app/services/ride_matching.py`, `backend/app/services/scheduler_service.py`
- Payment integration: `backend/app/routes/payments.py` + `src/pages/passenger/Payments.tsx` + `src/pages/passenger/AddPaymentMethod.tsx`
- Geolocation/maps: `src/pages/passenger/MapSelect.tsx`, `src/components/*map*`, OSRM/Nominatim config
- Terms/privacy/booking confirmation: `src/pages/public/TermsPage.tsx`, `src/pages/passenger/Legal.tsx` (dacă există), backend `gdpr.py`, `documents.py`, `invoices.py`

### C) Deliverable după audit (în `ai/`)
- [ ] Raport: “ce funcționalități îl fac Bolt‑like” + unde sunt în cod (fișiere/endpoints/evenimente)
- [ ] Lista minimă de schimbări “product + tehnic” ca să fie **rezervare executive** (fără on‑demand)
- [ ] “KEEP/REMOVE/CHANGE/ADD” final (cu path-uri)
- [ ] Risk register (ce risc legal rămâne dacă păstrăm elemente)

---

## 4) Decizii blocate (trebuie clarificate înainte de implementare)

1) Contractare: Platforma este **intermediar** (contract pasager–operator) sau este **operator/transportator** (entitatea ta)?  
2) Plăți: **preplată/depozit obligatoriu** sau permiți și cash?  
3) Transfer aeroport: “preț fix per cursă” sau “pachet transfer” (preferabil pachet + policy clar)?

---

## 5) Model țintă (executive booking) — comportament de produs

### Constrângeri UX (must)
- ❌ Fără “Rezervare rapidă” / “Găsește șofer în 3 minute”
- ✅ Minim lead time: `>= 60 min` (configurabil)
- ✅ “Request to book”: status `pending_confirmation` până confirmă manual (driver/dispatch)
- ✅ Preț: **pachet** (orar) / **transfer** (fix) / minimum fare mare
- ✅ Confirmare + termeni acceptați per rezervare + log email/SMS

### Lifecycle recomandat (booking)
- `draft` → `pending_confirmation` → `confirmed` → `in_service` → `completed`
- `cancelled_by_client` / `cancelled_by_driver` / `no_show` (cu policy snapshot)

---

## 6) Date de logat + documente de generat (minim conformitate)

### Ce logăm (DB)
- Booking core:
  - `scheduledStartAt` (UTC datetime), `durationPackageMinutes` / `transferCode`, pickup/dropoff (address + lat/lng), notes
  - `pricingSnapshot` (pachet complet + monedă + taxe + policy anulare)
  - `termsAcceptance` (`terms_version`, `acceptedAt`, `ip`, `userAgent`)
  - `confirmation` (`confirmedAt`, `confirmedByUserId`, canal confirmare)
- Audit / events (colecție separată recomandată):
  - `booking_events`: create/update/status-change/cancel/confirm (cine, când, de unde)
- Comunicări:
  - `communication_logs`: `channel` (email/sms/push), `template`, `to`, `provider_id`, `status`, `error`, `createdAt`
- Plăți:
  - `payment_intents` / `transactions` (depozit, captură, refund) + referință booking
- Documente:
  - `documents`: confirmare rezervare, contract/termeni, factură (dacă e cazul), cu hash + storage path

### Ce generăm (în platformă)
- Confirmare rezervare (email + pagină):
  - date client, data/oră, pachet, pickup, politici anulare, contact suport
- Termeni / contract (acceptare explicită):
  - versiune + timestamp + dovadă acceptare
- Factură / bon:
  - folosește modulele existente (`invoices.py`, `legal_entities.py`) dar adaptează la model (pachete/transfer)

---

## 7) Riscuri legale (non-exhaustive) dacă păstrăm elemente on‑demand

> Scop: “red flags” pe care trebuie să le scoatem din premium, altfel risc de re‑încadrare rămâne ridicat.

- Dacă păstrăm **matching instant + broadcast** către șoferi → seamănă direct cu platformă de transport programat.
- Dacă păstrăm **tarif per km/durată + surge** și “acceptă cursa acum” → întărește modelul ride‑hailing.
- Dacă păstrăm **harta cu șoferi în apropiere + ETA** → UX tipic Bolt/Uber.
- Dacă păstrăm “Go Online / Available now” în driver → semnal on‑demand.
- Dacă păstrăm “pooling” / curse partajate → complet în afara premium chauffeur.

Mitigare: feature flags + blocare backend + refactor UI; apoi eliminare completă din instanța premium.

---

## 8) PLAN pe 2 săptămâni (MVP “Executive Booking Only”)

### P0 — Deploy instanță separată (premium.private-driver.ro)

- [ ] DNS: `premium.private-driver.ro` → A record către `116.203.80.227`
- [ ] Deploy pe server cu `ops/deploy_x_server.sh` folosind env override:
  - `DOMAIN=premium.private-driver.ro`
  - `APP_DIR=/var/www/premium`
  - `BACKEND_PORT=8915`
  - `SERVICE_NAME=privatedriver-premium`
- [ ] `.env` server (premium):
  - `MONGO_URI=mongodb://admin:admin@v4-mongodb:27017/privatedriver_premium?authSource=admin`
  - dezactivează/segmentează cheile Supabase/Stripe/SendGrid/FCM până confirmăm fluxurile
- [ ] Health checks:
  - `GET https://premium.private-driver.ro/api/health` = `200`
  - WebSocket `/socket.io/` funcțional

### P0 — Feature flags (control gradual + kill-switch)

- [ ] Extinde `system_settings` (`_id: "platform"`) cu:
  - `product.mode = "executive_only"`
  - `booking.minLeadTimeMinutes = 60`
  - `booking.manualConfirmation = true`
  - `pricing.model = "packages"`
  - `ui.disableOnDemand = true`
  - `ui.hideNearbyDrivers = true`
- [ ] Backend: enforcement (nu doar UI):
  - blochează `POST /api/rides/request` când `executive_only`
  - oprește `process_booking_request` și scheduler broadcast când `executive_only`

### P0 — Passenger flow (fără FindingDriver / matching)

- [ ] `src/pages/passenger/Home.tsx`
  - scoate “nearby drivers” + ETA + “Rezervare rapidă”
  - adaugă selector: pickup, dropoff, **data/oră**, **pachet** (hourly/transfer)
  - CTA: “Trimite cerere de rezervare”
- [ ] Înlocuiește `FindingDriver` cu `BookingPending`:
  - `src/pages/passenger/FindingDriver.tsx` → devine status `pending_confirmation`
- [ ] `DriverMatched / RideInProgress`:
  - intră doar după `confirmed` (nu după matching instant)

### P0 — Backend booking model (executive)

Abordare minimă (rapidă): refolosim routerul `premium` dar schimbăm semantica din “ride now” în “booking”.

- [ ] Statusuri booking:
  - `pending_confirmation` / `confirmed` / `cancelled` / `in_service` / `completed`
- [ ] Endpointuri MVP (poate sub `/api/executive/*` pentru claritate):
  - `POST /api/executive/bookings` (create: include `scheduledStartAt`, `packageId`)
  - `GET /api/executive/bookings/me` (pasager)
  - `GET /api/executive/bookings/{id}`
  - `POST /api/executive/bookings/{id}/cancel`
  - `POST /api/executive/bookings/{id}/confirm` (driver/admin)
- [ ] Driver:
  - `GET /api/driver/bookings/pending`
  - `POST /api/driver/bookings/{id}/confirm|reject`

### P1 — Pricing pachete (fără per‑km/surge)

- [ ] Colecții noi:
  - `service_packages` (hourly)
  - `service_transfers` (transfer packages: aeroport etc.)
- [ ] Endpoint:
  - `GET /api/executive/packages`
- [ ] Snapshot pricing per booking:
  - `booking.pricingSnapshot` (pachet + policy anulare + taxe)

### P1 — Notificări + log comunicări

- [ ] Email (SendGrid) + opțional SMS:
  - “cerere primită”
  - “rezervare confirmată”
  - “rezervare anulată”
- [ ] DB `communication_logs` (obligatoriu)

### P1 — Legal UI minim

- [ ] `src/pages/public/TermsPage.tsx`:
  - rescrie poziționarea pentru premium: rezervări chauffeur / executive
- [ ] Acceptare termeni per booking:
  - `terms_version`, `accepted_at`, `ip`, `user_agent`

---

## 9) PLAN pe 6 săptămâni (produs complet)

- [ ] Calendar disponibilitate șofer (sloturi) + dispatch UI (admin/fleet)
- [ ] Corporate accounts:
  - entități, cost centers, reguli de facturare, utilizatori multipli
- [ ] Contract per booking (PDF) + hash + arhivare
- [ ] Preplată/depozit + refund policy + facturare coerentă (pachete/transfer)
- [ ] Raportare: export rezervări, revenue, SLA confirmare
- [ ] Hard-remove on‑demand code paths din premium (după stabilizare)
- [ ] Update E2E (Playwright) pentru flow “executive booking” (nu ride request)

---

## 10) KEEP / REMOVE / CHANGE / ADD (pentru instanța premium)

### KEEP
- Auth + RBAC, admin/support/fleet dashboards, messaging, uploads, audit logs (infrastructură).
- Places autocomplete + MapSelect (doar pentru selectare adresă, fără “nearby drivers”).

### REMOVE
- On‑demand funnel: `FindingDriver` (matching), `nearby drivers`, broadcast automatic, surge, pooling, Economy/Comfort/XL.
- Driver “Go Online / Available now” (dacă există în premium).
- PWA shortcuts “Request Ride / Go Online”: `vite.config.ts`.

### CHANGE
- `POST /api/rides/request` → blocat în `executive_only` (mesaj clar “rezervările se fac cu minim 60 min înainte”).
- `backend/app/services/booking_service.py` → nu mai face `find_nearby_drivers`/broadcast în premium.
- `backend/app/services/scheduler_service.py` → nu mai convertește scheduled→requested pentru broadcast; doar remindere/alertare dispatch.
- `src/pages/passenger/Home.tsx` → devine “Book chauffeur” (data/oră + pachet).

### ADD
- Router `executive` + modele booking + colecții pachete + `communication_logs` + acceptare termeni per booking.
- Admin UI: management pachete + setări booking mode + lead time.

---

## 11) Fișiere / Module cheie (unde lucrăm)

Frontend:
- `src/pages/passenger/Home.tsx`
- `src/pages/passenger/RideOptions.tsx`
- `src/pages/passenger/FindingDriver.tsx` (transformat în `BookingPending`)
- `src/pages/public/TermsPage.tsx`
- `src/pages/admin/Settings.tsx`
- `src/services/api.ts`
- `src/services/websocketService.ts` (evenimente ride vs booking)
- `vite.config.ts` (PWA shortcuts)

Backend:
- `backend/app/routes/ride.py` (blocare on‑demand)
- `backend/app/routes/premium.py` (de refolosit/înghețat sau split în `executive.py`)
- `backend/app/routes/driver.py`
- `backend/app/routes/admin.py` (system_settings)
- `backend/app/services/booking_service.py`
- `backend/app/services/scheduler_service.py`
- `backend/app/services/notification_service.py`
- `backend/app/websocket/socket_handler.py`

---

## 12) QA checklist (acceptance)

- [ ] Nu există CTA “now/instant” nicăieri (UI + PWA shortcuts + deep links).
- [ ] `POST /api/rides/request` este blocat în `executive_only` (backend enforcement).
- [ ] Nu există broadcast automat către șoferi (Socket.IO + push) în executive mode.
- [ ] Lead time validat strict (UTC, `>= minLeadTimeMinutes`).
- [ ] Booking lifecycle complet: create → confirm → cancel (cu `booking_events`).
- [ ] Pricing = pachete (nu per km); `pricingSnapshot` persistat.
- [ ] Email/SMS confirmări: trimise + log în `communication_logs`.
- [ ] Terms acceptance: version + timestamp + ip/ua.
- [ ] E2E: suite nouă “executive booking” + smoke pe admin/driver/passenger.

---

## 13) 2 arhitecturi alternative (și cu ce începem)

### (A) Doar rezervări (minimal)
- Un singur produs: “rezervare cu șofer privat” cu lead time minim, confirmare manuală.
- Avantaj: implementare rapidă (reuse `premium` flow).
- Dezavantaj: dacă prețul rămâne per‑km/durată, risc de “ride‑hailing” rămâne.

### (B) Rezervări + pachete orare + transferuri (recomandat)
- Booking obligatoriu + selectare pachet (orar) sau transfer fix (ex: aeroport).
- Avantaj: rupe dependența de per‑km/surge, întărește poziționarea premium/corporate.
- Dezavantaj: ceva mai mult efort (pachete + pricing snapshot + admin UI).

**Recomandare de start:** (B) dar “thin slice” în 2 săptămâni: 1 pachet orar + 1 transfer aeroport + booking flow cu confirmare manuală. Motiv: schimbă clar substanța produsului și elimină rapid cele mai mari red flags (on‑demand, per‑km, broadcast).  


