## Dashboard Șofer — Audit & Fix (2026-03-01)

### Rezumat
- Status general: Probleme minore
- Nr. meniuri verificate: 19
- Nr. ecrane testate: 16
- Nr. bugfix-uri aplicate: 6

### Meniuri & Rute (tabel)
| Meniu | Ruta | Componentă/Ecran | Backend calls (da/nu + ce) | Status (OK/Fixed/Broken) | Note |
|---|---|---|---|---|---|
| Acasă | `/v2/driver` | `Home.tsx` | Da: `/api/driver/home`, `/api/driver/status`, `/api/driver/location`, `/api/driver/ride-requests`, `/api/driver/bookings/pending`, `/api/executive/bookings/driver/active`, `/api/conversations`, `/api/notifications/list`, `/api/notifications/mark-all-read` | OK | Entrypoint dashboard șofer |
| Cereri cursă | overlay în Home | `RideRequests.tsx` | Da: `/api/driver/rides/{rideId}/accept`, `/api/driver/rides/{rideId}/reject` | Fixed | Endpoint-uri corectate în `api.ts` |
| Bookinguri executive | overlay în Home | `ExecutiveBookings.tsx` | Da: `/api/driver/bookings/pending`, `/api/executive/bookings/driver/active`, `/api/driver/bookings/{id}/confirm`, `/api/driver/bookings/{id}/reject`, `/api/executive/bookings/{id}/start-service`, `/api/executive/bookings/{id}/complete-service`, `/api/executive/bookings/{id}/wait/start`, `/api/executive/bookings/{id}/wait/stop` | OK | Flux premium funcțional |
| Istoric | `/v2/driver/history` | `History.tsx` | Da: `/api/driver/rides` | OK | Navigare către waybill pe `trip/:id` |
| Waybill / Detaliu cursă | `/v2/driver/trip/:id` | `TripDetail.tsx` | Da: `/api/driver/rides/{id}`, `/api/driver/rides/{id}/waybill` | OK | Rută existentă și accesibilă |
| Câștiguri | `/v2/driver/earnings` | `Earnings.tsx` | Da: `/api/driver/earnings`, `/api/driver/history` | Fixed | Fetch token-gated pentru evitarea request-ului prematur |
| Cerere payout | `/v2/driver/request-payout` | `RequestPayout.tsx` | Da: `/api/driver/payouts/balance`, `/api/driver/payouts/request` | OK | |
| Profil | `/v2/driver/profile` | `Profile.tsx` | Da: `/api/driver/profile`, `/api/uploads/profile-image` | OK | Meniu secundar pentru Vehicle/Settings/Help |
| Vehicul | `/v2/driver/vehicle` | `Vehicle.tsx` | Da: `/api/driver/profile`, `/api/driver/vehicle/requirements` | Fixed | Fetch token-gated |
| Documente | `/v2/driver/documents` | `Documents.tsx` | Da: `/api/documents/my-documents`, `/api/documents/upload` | Fixed | Fetch token-gated |
| Setări | `/v2/driver/settings` | `Settings.tsx` | Da: `/api/driver/settings`, `/api/driver/premium/status`, `/api/notifications/preferences` | Fixed | Fetch token-gated |
| Limbă | `/v2/driver/language` | `LanguageSettings.tsx` | Nu | OK | Gardă corectă pentru rol `driver` |
| Ajutor | `/v2/driver/help` | `Help.tsx` | Da: `/api/driver/help/faq`, `/api/driver/help/contact` | Fixed | Quick links legacy mapate + fallback robust |
| Notificări | `/v2/driver/notifications` | `Notifications.tsx` | Da: `/api/notifications`, `/api/notifications/read-all`, `/api/notifications/{id}` | OK | |
| Mesaje | `/v2/driver/messages` | `Messages.tsx` | Da: `/api/conversations`, `/api/conversations/contacts`, `/api/conversations/search/messages`, `/api/conversations/{id}/messages`, `/api/conversations/{id}/messages/read` | OK | |
| Premium Driver | `/v2/driver/premium` | `Premium.tsx` | Da: `/api/driver/premium/status`, `/api/driver/premium/apply`, `/api/driver/premium/rates` | Fixed | Fetch token-gated |
| Premium Dashboard | `/v2/driver/premium-dashboard` | `PremiumDashboard.tsx` | Da: `/api/driver/premium/dashboard` | Fixed | Query rulează doar după token valid (`enabled: !!token`) |
| Onboarding | `/v2/driver/onboarding` | `Onboarding.tsx` | Da: `/api/driver/onboarding/status`, `/api/driver/onboarding/declarations` | OK | Deja token-gated corect |
| Ecran activ cursă | `/v2/driver/active-ride/:rideId` | `ActiveRide.tsx` | Da: `/api/driver/ride/{rideId}/status`, `/api/driver/rides/{rideId}/rate-passenger`, `/api/conversations/*` | OK | |

### Probleme găsite (listă)
- Severitate: Major
  Unde: `src/services/api.ts` + `src/components/driver/RideRequests.tsx`
  Simptom: accept/reject pe cereri cursă folosea endpoint greșit și putea răspunde cu 404.
  Cauză: clientul apela `/api/driver/ride/{id}/accept|reject`, iar backend-ul expune `/api/driver/rides/{id}/accept|reject`.
  Fix aplicat (cu referință la fișierele modificate): corecție endpoint-uri în `acceptRideRequest`/`rejectRideRequest` din `src/services/api.ts`.
  Cum se testează (pași clari): 1. Login driver. 2. Deschide Home cu cerere nouă. 3. Apasă `Accept` sau `Reject`. 4. Confirmă request-uri 200 în Network.

- Severitate: Major
  Unde: `src/pages/driver/WaitingForPassenger.tsx`, `src/pages/driver/TripInProgress.tsx`
  Simptom: butonul `Waybill` din meniul cursei naviga către rută inexistentă.
  Cauză: era folosit `/v2/driver/trip/current`, dar ruta reală este `/v2/driver/trip/:id`.
  Fix aplicat (cu referință la fișierele modificate): navigare actualizată la `/v2/driver/trip/${rideId}` în ambele pagini.
  Cum se testează (pași clari): 1. Intră într-un flow de cursă. 2. Deschide meniul și apasă `Waybill`. 3. Verifică deschiderea paginii `/v2/driver/trip/{id}` fără 404.

- Severitate: Major
  Unde: `backend/app/routes/driver.py` și `src/pages/driver/Help.tsx`
  Simptom: quick links din Help puteau trimite către pagini inexistente.
  Cauză: backend returna implicit URL-uri legacy (`/v2/driver/help/guide|safety|terms`) care nu există în router.
  Fix aplicat (cu referință la fișierele modificate): backend default links mutate pe rute valide (`/driver-guidelines`, `/safety-tips`, `/terms`) + mapare fallback în frontend pentru linkurile legacy deja stocate.
  Cum se testează (pași clari): 1. Deschide `/v2/driver/help`. 2. Click pe fiecare quick link. 3. Confirmă navigare validă fără 404.

- Severitate: Major
  Unde: `src/pages/driver/Documents.tsx`, `src/pages/driver/Earnings.tsx`, `src/pages/driver/Premium.tsx`, `src/pages/driver/Settings.tsx`, `src/pages/driver/Vehicle.tsx`, `src/pages/driver/Help.tsx`
  Simptom: la primul mount, unele ecrane puteau face fetch cu token nul și rămâneau în stări inconsistente.
  Cauză: `useEffect([])` cu request-uri care depind de `token` din `AuthContext`.
  Fix aplicat (cu referință la fișierele modificate): toate ecranele de mai sus au fost schimbate pe token-gated fetch (`if (!token) return;`, deps `[token]`).
  Cum se testează (pași clari): 1. Login driver și hard refresh pe fiecare pagină. 2. Confirmă că datele se încarcă stabil și nu apar erori 401 la primul request.

- Severitate: Minor
  Unde: `src/pages/driver/PremiumDashboard.tsx`
  Simptom: query-ul premium dashboard putea porni înainte de token și marca ecranul în eroare.
  Cauză: `useQuery` era pornit necondiționat.
  Fix aplicat (cu referință la fișierele modificate): adăugat `enabled: !!token` și query key dependent de starea auth.
  Cum se testează (pași clari): 1. Login driver. 2. Deschide `/v2/driver/premium-dashboard`. 3. Confirmă încărcare normală fără eroare inițială.

### Fișiere modificate
- `src/services/api.ts` — endpoint accept/reject cerere cursă corectat (`rides` vs `ride`).
- `src/pages/driver/WaitingForPassenger.tsx` — fix rută waybill.
- `src/pages/driver/TripInProgress.tsx` — fix rută waybill.
- `src/pages/driver/Help.tsx` — token-gated fetch + fallback map quick links.
- `backend/app/routes/driver.py` — URL-uri implicite quick links actualizate la rute valide.
- `src/pages/driver/Documents.tsx` — token-gated fetch.
- `src/pages/driver/Earnings.tsx` — token-gated fetch.
- `src/pages/driver/Premium.tsx` — token-gated fetch.
- `src/pages/driver/Settings.tsx` — token-gated fetch.
- `src/pages/driver/Vehicle.tsx` — token-gated fetch.
- `src/pages/driver/PremiumDashboard.tsx` — query gated cu `enabled: !!token`.
