## Cross User-Driver — Audit & Fix (2026-03-01)

### Rezumat
- Status general: Probleme minore
- Fluxuri cross-role verificate: 10
- Endpoint-uri cross-role verificate: 20+
- Bugfix-uri aplicate în acest audit: 2
- Validare automată:
  - `npm run build` PASS
  - `npm run test` PASS
  - `npm run e2e:passenger` PASS (`23/23`)
  - `npm run e2e:driver` PASS (`16/16`)
  - `npm run e2e:messaging` PASS (`16/16`)

### Fluxuri comune User ↔ Șofer (tabel)
| Flux | User (Pasager) | Șofer | Backend/WebSocket | Status | Note |
|---|---|---|---|---|---|
| Cerere cursă standard | inițiază cerere | primește cerere în Home | `POST /api/rides/request`, `GET /api/driver/ride-requests` | OK | Flux disponibil și testat API/UI |
| Accept/Reject cerere | așteaptă status booking | acceptă/refuză cerere | `POST /api/driver/rides/{rideId}/accept`, `POST /api/driver/rides/{rideId}/reject` | Fixed | endpoint-uri client corectate |
| Cursă activă (status) | vede progresul cursei | schimbă statusul cursei | `PUT /api/driver/ride/{rideId}/status`, event `ride_status_changed` | OK | sincronizare live + fallback polling |
| Camera ride (WS room) | join/leave room ride | join/leave room ride | `join_ride_room`, `leave_ride_room`, `driver_location_update` | OK | evenimente wired în frontend și backend |
| Mesagerie în ride | trimite/primește mesaje | trimite/primește mesaje | `/api/conversations*`, `/api/conversations/{id}/messages`, `join_conversation` | OK | privacy gate backend activ |
| Search mesaje | caută în conversații | caută în conversații | `GET /api/conversations/search/messages` | OK | disponibil pe ambele dashboard-uri |
| Notificări in-app | list/read/clear | list/read/clear | `/api/notifications/list`, `/api/notifications/read-all`, `/api/notifications/clear-all` | Fixed | home driver nu mai filtrează greșit pe rol |
| Istoric curse | listă ride-uri | listă ride-uri | `GET /api/rider/rides`, `GET /api/driver/rides` | OK | ambele rute valide |
| Detaliu cursă | ride detail user | waybill/ride detail șofer | `GET /api/rides/{rideId}`, `GET /api/driver/rides/{rideId}` | Fixed | securizare auth/ownership pe `/api/rides/{rideId}` |
| Executive booking realtime | status booking live | pending/active booking live | `executive_booking_status`, `/api/driver/bookings/pending`, `/api/executive/bookings/driver/active` | OK | flux premium conectat |

### Probleme găsite + fixuri
- Severitate: Major
  Unde: `src/pages/driver/Home.tsx` (overlay notificări)
  Simptom: șoferul putea vedea mai puține notificări în Home decât în pagina dedicată Notificări.
  Cauză: request-ul folosea `?role=driver`; backend filtrează deja după `user_id`, iar multe notificări nu au câmp `role`.
  Fix aplicat: eliminat filtrul de rol; Home folosește `GET /api/notifications/list`.
  Fișier: `src/pages/driver/Home.tsx`
  Testare:
  1. Login șofer.
  2. Deschide overlay-ul notificări din Home.
  3. Compară cu `/v2/driver/notifications`; lista trebuie să fie consistentă.

- Severitate: Blocker (security)
  Unde: `backend/app/routes/ride.py` -> `GET /api/rides/{ride_id}`
  Simptom: endpoint-ul de detaliu cursă era accesibil fără autentificare/ownership guard.
  Cauză: lipsea `Depends(get_current_user)` și validarea de autorizare.
  Fix aplicat:
  - adăugat auth guard;
  - adăugat control de acces pe rol:
    - `admin/support/fleet_manager` -> acces permis;
    - `user` -> doar dacă este pasagerul cursei;
    - `driver` -> doar dacă este șoferul asociat cursei.
  Fișier: `backend/app/routes/ride.py`
  Testare:
  1. request fără token la `/api/rides/{rideId}` -> trebuie `401/403`.
  2. request cu user neimplicat în cursă -> `403`.
  3. request cu pasagerul sau șoferul cursei -> `200`.

### Verificări structurale confirmate
- Rutele user și șofer există și sunt protejate cu `ProtectedRoute` în `src/App.tsx`.
- Endpoint-uri cross-role principale există:
  - `ride.py`: `/request`, `/booking/{booking_id}/status`, `/booking/{booking_id}/cancel`, `/{ride_id}`
  - `driver.py`: `/ride-requests`, `/rides/{ride_id}/accept`, `/rides/{ride_id}/reject`, `/ride/{ride_id}/status`
  - `conversations.py`: list/create/contacts/search/send/read
  - `notifications.py`: list/read-all/clear-all
- WebSocket cross-flow confirmat:
  - `join_ride_room`, `leave_ride_room`, `ride_status_changed`
  - `join_conversation`, `message_send`
  - `executive_booking_status`

### Fișiere modificate în auditul comun
- `src/pages/driver/Home.tsx` — normalizare fetch notificări (fără filtru de rol).
- `backend/app/routes/ride.py` — auth + ownership guard pentru `GET /api/rides/{ride_id}`.
- `ai/defalcat/crossuserdriver.md` — documentare audit comun user-șofer.

### Pași recomandați pentru smoke manual rapid
1. Login pasager + șofer în două sesiuni separate.
2. Pasager: creează cerere cursă.
3. Șofer: acceptă cererea din Home.
4. Verifică pe pasager actualizare status cursă (live + fallback).
5. Deschide chat în ride din ambele părți și trimite mesaje bidirecțional.
6. Verifică notificările pe ambele roluri (Home + pagina dedicată).
7. Deschide detaliu cursă cu rol autorizat (200) și neautorizat (403).
