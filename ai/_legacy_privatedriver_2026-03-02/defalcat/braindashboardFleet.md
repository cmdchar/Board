## Dashboard Fleet — Audit & Fix (2026-03-01)

### Rezumat
- Status general: Probleme minore
- Nr. meniuri verificate: 9 (după consolidare) + 3 rute detaliu
- Nr. ecrane testate: 12
- Nr. bugfix-uri aplicate: 3

### Meniuri & Rute (tabel)
| Meniu | Ruta | Componentă/Ecran | Backend calls (da/nu + ce) | Status (OK/Fixed/Broken) | Note |
|---|---|---|---|---|---|
| Dashboard | `/fleet/dashboard` | `Dashboard.tsx` | Da: `GET /api/fleet/stats` | Fixed | token-gated fetch |
| Vehicles | `/fleet/vehicles` | `Vehicles.tsx` | Da: `GET /api/fleet/vehicles` | Fixed | token-gated fetch |
| Vehicle Detail | `/fleet/vehicles/:licensePlate` | `VehicleDetail.tsx` | Da: `GET /api/fleet/vehicles/{plate}`, fallback list, `PUT /status`, `PUT /assign`, `POST /maintenance` | Fixed | token-gated fetch |
| Drivers | `/fleet/drivers` | `Drivers.tsx` | Da: `GET /api/fleet/drivers` | Fixed | token-gated fetch |
| Driver Detail | `/fleet/drivers/:driverId` | `DriverDetail.tsx` | Da: `GET /api/fleet/drivers/{id}`, `GET /api/fleet/trips`, `PUT /api/fleet/drivers/{id}` | Fixed | token-gated fetch |
| Trips | `/fleet/trips` | `Trips.tsx` | Da: `GET /api/fleet/trips` | Fixed | token-gated fetch |
| Earnings | `/fleet/earnings` | `Earnings.tsx` | Da: `GET /api/fleet/stats`, `GET /api/fleet/analytics/earnings` | Fixed | token-gated fetch |
| Reports | `/fleet/reports` | `Reports.tsx` | Da: `GET /api/fleet/stats`, `GET /api/fleet/analytics/reports` | Fixed | token-gated fetch |
| Messages | `/fleet/messages` | `Messages.tsx` | Da: `getConversations`, `searchConversationMessages`, chat API via `ChatDetail` | Fixed | integrat în `FleetLayout` |
| Support | `/fleet/support` | `Support.tsx` | Da: `getSupportTickets`, `createSupportTicket` | Fixed | acces direct din meniu |
| Support Ticket Detail | `/fleet/support/:ticketId` | `SupportTicketDetail.tsx` | Da: `getSupportTicket` + chat API via `ChatDetail` | OK | |
| Settings | `/fleet/settings` | `Settings.tsx` | Da: `GET/PUT /api/fleet/settings` | Fixed | token-gated fetch |

### Probleme găsite (listă)
- Severitate: Major
  Unde: `src/components/fleet/FleetLayout.tsx`
  Simptom: rutele existente `/fleet/messages` și `/fleet/support` nu aveau intrări în meniu.
  Cauză: navigația Fleet avea doar 7 item-uri; cele 2 rute erau orfane (accesibile doar manual URL).
  Fix aplicat (cu referință la fișierele modificate): adăugate item-urile `Messages` și `Support` în meniul Fleet în [src/components/fleet/FleetLayout.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/components/fleet/FleetLayout.tsx).
  Cum se testează (pași clari): 1. Login fleet_manager. 2. Verifică sidebar. 3. Click pe `Messages` și `Support`; confirmă navigare la `/fleet/messages` și `/fleet/support`.

- Severitate: Major
  Unde: `src/pages/fleet/Messages.tsx`
  Simptom: ecranul de mesagerie fleet nu folosea `FleetLayout`, rezultând UX inconsistent și lipsă navigație contextuală de rol.
  Cauză: pagina renderiza direct container propriu fără layout-ul de dashboard.
  Fix aplicat (cu referință la fișierele modificate): pagina a fost integrată în `FleetLayout`, inclusiv pentru lista de conversații și chat detail în [src/pages/fleet/Messages.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Messages.tsx).
  Cum se testează (pași clari): 1. Login fleet_manager. 2. Deschide `/fleet/messages`. 3. Verifică header/sidebar fleet + deschide o conversație și revino.

- Severitate: Major
  Unde: multiple pagini Fleet (`Dashboard`, `Drivers`, `DriverDetail`, `Vehicles`, `VehicleDetail`, `Trips`, `Earnings`, `Reports`, `Settings`)
  Simptom: la primul mount puteau porni request-uri cu token nul (race la inițializare auth), ducând la 401/empty-state fals până la refresh.
  Cauză: `useEffect([])` + fetch direct cu header `Authorization: Bearer ${token}` înainte ca tokenul să fie disponibil.
  Fix aplicat (cu referință la fișierele modificate): fetch-urile au fost token-gated și dependente de `[token]` în:
  [src/pages/fleet/Dashboard.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Dashboard.tsx),
  [src/pages/fleet/Drivers.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Drivers.tsx),
  [src/pages/fleet/DriverDetail.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/DriverDetail.tsx),
  [src/pages/fleet/Vehicles.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Vehicles.tsx),
  [src/pages/fleet/VehicleDetail.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/VehicleDetail.tsx),
  [src/pages/fleet/Trips.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Trips.tsx),
  [src/pages/fleet/Earnings.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Earnings.tsx),
  [src/pages/fleet/Reports.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Reports.tsx),
  [src/pages/fleet/Settings.tsx](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/fleet/Settings.tsx).
  Cum se testează (pași clari): 1. Login fleet_manager. 2. Hard refresh pe fiecare pagină Fleet. 3. Confirmă că datele se încarcă fără request-uri 401 inițiale.

### Fișiere modificate
- `src/components/fleet/FleetLayout.tsx` — meniuri consolidate cu rutele existente (`Messages`, `Support`).
- `src/pages/fleet/Messages.tsx` — integrare `FleetLayout` + current user id din auth context.
- `src/pages/fleet/Dashboard.tsx` — token-gated fetch.
- `src/pages/fleet/Drivers.tsx` — token-gated fetch.
- `src/pages/fleet/DriverDetail.tsx` — token-gated fetch + update flow guard.
- `src/pages/fleet/Vehicles.tsx` — token-gated fetch.
- `src/pages/fleet/VehicleDetail.tsx` — token-gated fetch pentru vehicle/drivers.
- `src/pages/fleet/Trips.tsx` — token-gated fetch.
- `src/pages/fleet/Earnings.tsx` — token-gated fetch.
- `src/pages/fleet/Reports.tsx` — token-gated fetch.
- `src/pages/fleet/Settings.tsx` — token-gated fetch/save.

### Validări executate
- `npm run build` -> PASS
- `npm run e2e:support` -> `12/12 PASS`
- `npm run e2e:smoke` -> `34/34 PASS` (include Fleet API smoke)
- `npm run e2e:messaging` -> `16/16 PASS`
