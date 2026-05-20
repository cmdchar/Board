# Premium Audit Report — Executive Booking Migration

Date: 2026-02-27  
Workspace: `H:\Users\nicus\Documents\premium.private-driver.ro`

## 1) Bolt-like Surfaces (Found)

### Backend
- `POST /api/rides/request` in `backend/app/routes/ride.py`
  - creates booking with immediate status and triggers matching pipeline when `scheduledTime` is missing.
- `process_booking_request()` in `backend/app/services/booking_service.py`
  - `find_nearby_drivers` + Socket.IO `emit_new_ride_request` + push notifications.
- `process_scheduled_rides()` in `backend/app/services/scheduler_service.py`
  - converts scheduled to requested and starts broadcast flow.
- `GET /api/rides/nearby-drivers`, `GET /api/rides/available-pools` in `backend/app/routes/ride.py`
  - map + pooling surfaces specific to instant model.

### Frontend
- Passenger instant funnel:
  - `src/pages/passenger/Home.tsx` (nearby drivers + instant categories)
  - `src/pages/passenger/RideOptions.tsx` (standard instant options)
  - `src/pages/passenger/FindingDriver.tsx` (live matching wait)
  - `src/pages/passenger/DriverMatched.tsx` (instant match continuation)
- API contract:
  - `requestRide()` in `src/services/api.ts` -> `/rides/request`

## 2) KEEP / REMOVE / CHANGE / ADD

### KEEP
- Auth/RBAC, admin/support/fleet panels, messaging infra, upload infra, audit infra.
- Private driver catalog flow (`/api/premium/drivers*`) as source for chauffeur selection.

### REMOVE (executive mode behavior)
- On-demand booking entry (`/api/rides/request`) execution path.
- Nearby driver broadcast/search and scheduler conversion to requested+broadcast.
- Nearby drivers/pooling responses as active UX model.

### CHANGE
- Platform settings now include feature flags:
  - `product.mode=executive_only`
  - `booking.minLeadTimeMinutes`
  - `booking.manualConfirmation`
  - `pricing.model=packages`
  - `ui.disableOnDemand`
  - `ui.hideNearbyDrivers`
- Passenger premium request page changed from countdown-based instant accept to manual executive booking flow.

### ADD
- New executive API (`/api/executive/*`):
  - `GET /packages`
  - `POST /bookings`
  - `GET /bookings/me`
  - `GET /bookings/{id}`
  - `POST /bookings/{id}/cancel`
  - `POST /bookings/{id}/confirm`
- Driver executive booking actions:
  - `GET /api/driver/bookings/pending`
  - `POST /api/driver/bookings/{id}/confirm`
  - `POST /api/driver/bookings/{id}/reject`
- `GET /api/rides/config` for frontend feature-flag consumption.

## 3) Risk Register (Current)
- **High**: legacy routes/pages (`FindingDriver`, `/api/premium/rides/request`) still exist in codebase; now blocked or bypassed in executive mode but not yet fully removed.
- **High**: package management UI in admin is not yet implemented; currently packages are read from `service_packages` or fallback defaults.
- **Medium**: passenger flow still offers legacy route components in router; behavior is now constrained by executive config and UI changes.
- **Medium**: legal documents/terms pages need premium-specific text pass (deferred for next slice).

## 4) Completed in this slice
- Executive feature flags enforced in backend.
- On-demand backend execution blocked in executive mode.
- Matching broadcast and scheduled broadcast conversion disabled in executive mode.
- Executive booking API introduced with pending confirmation lifecycle.
- Frontend switched to executive booking request UX for premium flow.

