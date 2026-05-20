## Dashboard Pasager — Audit & Fix (2026-03-01)

### Rezumat
- Status general: Probleme minore
- Nr. meniuri verificate: 14
- Nr. ecrane testate: 14
- Nr. bugfix-uri aplicate: 5

### Meniuri & Rute (tabel)
| Meniu | Ruta | Componentă/Ecran | Backend calls (da/nu + ce) | Status (OK/Fixed/Broken) | Note |
|---|---|---|---|---|---|
| Acasă | `/v2/passenger` | `Home.tsx` | Da: `/api/rides/config`, `/api/rides/nearby-drivers`, `/api/rides/categories`, `/api/payments/methods`, `/api/saved-places?type=recent`, `/api/passenger/favorite-drivers`, `/api/notifications` | OK | Entrypoint dashboard pasager |
| Mesaje | `/v2/passenger/messages` | `Messages.tsx` | Da: `/api/conversations`, `/api/conversations/contacts`, `/api/conversations/search/messages`, `/api/conversations/{id}/messages` | OK | Include taburi `all/support/admin/fleet` |
| Istoric | `/v2/passenger/history` | `History.tsx` | Da: `/api/rider/rides` | Fixed | Fix parse pentru răspuns fără `success` wrapper |
| Profil | `/v2/passenger/profile` | `Profile.tsx` | Da: `/api/user/reviews`, `/api/uploads/profile-image` | OK | Meniu secundar cu acces către plăți/locații/etc. |
| Plăți | `/v2/passenger/payments` | `Payments.tsx` | Da: `/api/payments/methods`, `/api/payments/methods/default`, `/api/payments/methods/{id}` | OK | |
| Locații salvate | `/v2/passenger/places` | `SavedPlaces.tsx` | Da: `/api/saved-places` | OK | |
| Promoții | `/v2/passenger/promotions` | `Promotions.tsx` | Da: `/api/promotions`, `/api/promotions/apply` | OK | |
| Setări | `/v2/passenger/settings` | `Settings.tsx` | Da (indirect): `/api/notifications/preferences`, `/api/notifications/register`, `/api/notifications/unregister` | OK | Include submeniuri limbă/confidențialitate/dispozitive |
| Ajutor | `/v2/passenger/help` | `Help.tsx` | Da: `/api/driver/help/faq`, `/api/driver/help/contact` | OK | Endpoint-urile sunt comune pentru user autentificat |
| Legal | `/v2/passenger/legal` | `Legal.tsx` | Nu | OK | Pagină statică |
| Notificări | `/v2/passenger/notifications` | `Notifications.tsx` | Da: `/api/notifications/list`, `/api/notifications/mark-all-read`, `/api/notifications/clear-all` | Fixed | Eliminat filtru greșit `role=passenger` |
| Setări confidențialitate | `/v2/passenger/privacy-settings` | `PrivacySettings.tsx` | Da: `/api/user/privacy-settings`, `/api/gdpr/export-my-data` | OK | |
| Dispozitive de încredere | `/v2/passenger/trusted-devices` | `TrustedDevices.tsx` | Da: `/api/auth/devices`, `/api/auth/devices/{id}`, `/api/auth/devices/revoke-all` | OK | |
| Limbă | `/v2/passenger/language` | `LanguageSettings.tsx` | Nu | OK | Pagină preferințe locale |

### Probleme găsite (listă)
- Severitate: Major
  Unde: `src/pages/passenger/History.tsx`
  Simptom: istoricul rămânea gol pe răspuns valid de la backend.
  Cauză: codul cerea `data.success`, dar endpoint-ul `/api/rider/rides` poate returna direct `{ rides: [...] }`.
  Fix aplicat (cu referință la fișierele modificate): actualizare parse fallback + normalizare status + refetch condiționat de token în [`src/pages/passenger/History.tsx`](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/passenger/History.tsx).
  Cum se testează (pași clari): 1. Login user. 2. Deschide `/v2/passenger/history`. 3. Confirmă că lista se încarcă când API răspunde cu `rides`.

- Severitate: Major
  Unde: `src/pages/passenger/Notifications.tsx`
  Simptom: notificările puteau apărea goale deși userul avea notificări.
  Cauză: request-ul filtra cu `role=passenger`, iar în backend rolul userului este `user`.
  Fix aplicat (cu referință la fișierele modificate): eliminare filtru de rol, mapare robustă tip promo/promotion, fetch după token în [`src/pages/passenger/Notifications.tsx`](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/passenger/Notifications.tsx).
  Cum se testează (pași clari): 1. Login user. 2. Deschide `/v2/passenger/notifications`. 3. Verifică listă notificări + acțiuni `Mark all read` și `Clear all`.

- Severitate: Major
  Unde: `src/pages/passenger/RideDetail.tsx`
  Simptom: acces direct pe `/v2/passenger/ride/:id` putea eșua sau afișa date incomplete.
  Cauză: componenta folosea endpoint-ul `/api/rides/:id` pentru ID-uri care sunt de booking (`/api/rider/rides/:id`) și parsea greșit payload-ul.
  Fix aplicat (cu referință la fișierele modificate): fallback endpoint `rider -> rides`, mapper unificat payload rider/ride și validare state inițial în [`src/pages/passenger/RideDetail.tsx`](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/passenger/RideDetail.tsx).
  Cum se testează (pași clari): 1. Din istoric, intră pe o cursă. 2. Reîncarcă pagina pe URL-ul de detaliu. 3. Confirmă că datele cursei rămân vizibile.

- Severitate: Minor
  Unde: `src/pages/passenger/RideOptions.tsx`
  Simptom: acțiunea Cancel mergea pe rută legacy.
  Cauză: navigare la `/passenger/home` în loc de rută v2.
  Fix aplicat (cu referință la fișierele modificate): rută directă la `/v2/passenger` în [`src/pages/passenger/RideOptions.tsx`](h:/Users/nicus/Documents/premium.private-driver.ro/src/pages/passenger/RideOptions.tsx).
  Cum se testează (pași clari): 1. Deschide `/v2/passenger/ride-options`. 2. Apasă `Cancel`. 3. Verifică redirect direct către `/v2/passenger`.

- Severitate: Minor
  Unde: `src/App.tsx`
  Simptom: import nefolosit pentru `PassengerAuth` (componentă duplicată față de `RoleAuthPage`).
  Cauză: cleanup incomplet după migrarea pe `RoleAuthPage`.
  Fix aplicat (cu referință la fișierele modificate): eliminat importul nefolosit în [`src/App.tsx`](h:/Users/nicus/Documents/premium.private-driver.ro/src/App.tsx).
  Cum se testează (pași clari): 1. Rulează build. 2. Confirmă că routing pasager rămâne funcțional pe `/v2/passenger/auth`.

### Fișiere modificate
- `src/pages/passenger/History.tsx` — fix parsing + token-gated fetch.
- `src/pages/passenger/Notifications.tsx` — fix query/filter + mapări tip notificare.
- `src/pages/passenger/RideDetail.tsx` — fix endpoint/payload mapping pentru detalii cursă.
- `src/pages/passenger/RideOptions.tsx` — corecție rută cancel.
- `src/App.tsx` — cleanup import duplicat/nefolosit.
