# Bugs - Passenger Role
> Reported: 2026-02-17 | Status: IN PROGRESS
> Last Updated: 2026-02-17 (Round 3 deployed)

---

## BUG-P1: Notificări push — nu se pot activa
**Severity**: Medium
**Steps**: Înregistrare → Dashboard → Accept notificări din prompt browser
**Error**: "Notificările sunt blocate. Pentru a le activa, accesează setările browser-ului și permite notificările pentru acest site."
**Cause**: Browser-ul blochează notificările push (probabil site-ul e HTTP nu HTTPS, sau a fost refuzat anterior). De verificat dacă este implementat Service Worker / Push API corect.
**Status**: TODO — needs HTTPS infrastructure change

---

## BUG-P2: Geolocation Timeout (repetat)
**Severity**: Medium
**Steps**: Dashboard pasager se încarcă (automat, fără user gesture)
**Error**: `Geolocation error: Timeout expired`
**Cause**: `enableHighAccuracy: true` cu timeout prea scurt.
**Fix Applied**: Added fallback — tries highAccuracy first (10s timeout), on timeout retries with `enableHighAccuracy: false` (15s timeout, 10min cache)
**File**: `src/contexts/AppContext.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P3: Meniu hamburger arată "Guest" în loc de numele utilizatorului
**Severity**: High
**Fix Applied**: Changed Home.tsx to use `authUser` from AuthContext (has real name from DB) instead of `appUser` from AppContext
**File**: `src/pages/passenger/Home.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P4: Schimbarea limbii în română nu funcționează
**Severity**: Medium
**Steps**: Setări → Language → Selectează Română → Salvează
**Actual**: Selectat vizual dar interfața rămâne în engleză
**Cause**: i18n not fully implemented — `preferred_language` saved in DB but frontend doesn't apply translations
**Status**: TODO — Feature (i18n system needed)

---

## BUG-P5: /api/api/notifications/preferences — URL dublu `/api/api/`
**Severity**: High
**Fix Applied**: Removed `/api` prefix from NOTIFICATION_API endpoint constants since `BASE_URL` already contains `/api`
**File**: `src/types/notifications.ts`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P6: Light mode activat dar harta rămâne dark
**Severity**: Medium
**Fix Applied**: Added `key={actualTheme}` to TileLayer component to force React to unmount/remount on theme change
**File**: `src/components/shared/MapView.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P7: Privacy — Export date nu funcționează (redirecționează la Support)
**Severity**: Medium
**Fix Applied**: Connected "Export My Data" button to real `GET /api/gdpr/export-my-data` endpoint. Downloads JSON file with blob + createElement('a') approach.
**File**: `src/pages/passenger/PrivacySettings.tsx`
**Status**: ✅ FIXED (Round 2) — Deployed 2026-02-17

---

## BUG-P8: Privacy — bifele de consimțământ nu se salvează vizibil / stare incertă
**Severity**: Medium
**Investigation**: Privacy settings page already correctly connected to `GET/PUT /api/user/privacy-settings` with loading state, error handling, and revert on failure.
**Status**: ✅ VERIFIED WORKING — No fix needed

---

## BUG-P9: Mesagerie — Attach photo nu funcționează
**Severity**: Medium
**Cause**: Upload de imagini nu este implementat (menționat în Known Remaining Work: "Image upload: S3/GCS for message attachments")
**Status**: TODO (known limitation — needs S3/GCS integration)

---

## BUG-P10: Raport/Support — Text ascuns sub butonul Submit
**Severity**: Low
**Steps**: Pagina de trimitere raport/support ticket
**Actual**: Un text din partea de jos nu se vede, acoperit de butonul Submit
**Fix Applied**: Added `pb-24` to content div to ensure enough padding below content for fixed Submit button
**File**: `src/pages/passenger/ReportIssue.tsx`
**Status**: ✅ FIXED (Round 3) — Deployed 2026-02-17

---

## BUG-P11: După trimitere raport — pagina "PrivateDriver" fără buton Back
**Severity**: High
**Fix Applied**: Changed `navigate('/v2/passenger/support-tickets')` to `navigate(-1)` to go back to previous page
**File**: `src/pages/passenger/ReportIssue.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P12: Metoda de plată — Cash nu se poate seta ca default după adăugare card
**Severity**: High
**Fix Applied**: Fixed cash default logic — only sets cash as default if no other method is default. Added re-fetch on API failure in handleSetDefault.
**File**: `src/pages/passenger/Payments.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P13: Add Payment — CVV field tip password (browser warning)
**Severity**: Low
**Fix Applied**: Changed `type="password"` to `type="text" inputMode="numeric" autoComplete="cc-csc"`
**File**: `src/pages/passenger/AddPaymentMethod.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P14: Notificare mesaj de la șofer — lipsește badge + notificare push
**Severity**: High
**Fix Applied**:
- Added Messages tab to BottomNavigation with MessageSquare icon + unread badge count
- Added `/v2/passenger/messages` route in App.tsx
- Badge fetches unread count from conversations API, polls every 30s
- Added "bottomNav.messages" translations (en: "Messages", ro: "Mesaje")
**Files**: `src/components/shared/BottomNavigation.tsx`, `src/App.tsx`, `src/i18n/en.ts`, `src/i18n/ro.ts`
**Status**: ✅ FIXED (Round 2) — Deployed 2026-02-17

---

## BUG-P15: Rating după cursă — 500 Internal Server Error
**Severity**: Critical
**Fix Applied**:
- Added missing `from datetime import datetime` import
- Fixed passenger verification to support 3 formats: `passengers[]` array, `userId` string, `passengerId` string
- Wrapped driver rating aggregation in try/except so rating submission succeeds even if driver update fails
**File**: `backend/app/routes/ride.py`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P16: DialogContent fără DialogTitle — accessibility warning
**Severity**: Low
**Investigation**: Searched all 16 files with DialogContent — all were compliant with DialogTitle. Warning was from old build.
**Status**: ✅ VERIFIED COMPLIANT — No fix needed

---

## BUG-P17: Nu se poate adăuga oprire — 404 route
**Severity**: High
**Fix Applied**: Changed route from `/v2/passenger/destination-search` to `/v2/passenger/search` (existing route)
**File**: `src/pages/passenger/RideOptions.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-P18: Locații salvate — nu găsește adrese
**Severity**: High
**Steps**: Setări → Saved Places → Caută adresă
**Fix Applied**: Rewrote EditPlace.tsx with full autocomplete search using `/api/places/autocomplete` (Photon + Nominatim fallback). Added:
- Debounced search (400ms) with suggestions dropdown
- Search icon + loading spinner in input
- Auto-fill name from selected suggestion
- Coordinates stored from autocomplete result
- Static map preview showing selected location
- Also added `pb-24` for fixed Submit button spacing
**File**: `src/pages/passenger/EditPlace.tsx`
**Status**: ✅ FIXED (Round 3) — Deployed 2026-02-17

---

## FEATURE-P1: Locații salvate — Home / Work / Custom
**Type**: Feature (parțial implementat)
**Priority**: High
**Status**: ✅ DONE — Search fixed (P18), type picker (Home/Work/Other) already existed, save to API works

---

## FEATURE-P2: Coadă de așteptare — niciun șofer disponibil
**Type**: Feature (LIPSĂ)
**Priority**: High
**Status**: TODO — Feature nou

---

## FEATURE-P3: Șofer poate prelua cursă nouă în timp ce finalizează cursa curentă
**Type**: Feature (LIPSĂ)
**Priority**: Medium
**Status**: TODO — Feature nou (logică complexă)

---

## FEATURE-P4: Curse cu opriri — tarifare oprire + timer așteptare
**Type**: Feature (parțial implementat — oprirea există dar tarifarea nu)
**Priority**: High
**Status**: TODO — Feature nou (complex)

---

## Summary — Bugs
| # | Bug | Severity | Status |
|---|-----|----------|--------|
| P1 | Notificări push blocate | Medium | TODO |
| P2 | Geolocation timeout | Medium | ✅ FIXED |
| P3 | Hamburger menu arată "Guest" | High | ✅ FIXED |
| P4 | Limba română nu se aplică | Medium | TODO |
| P5 | URL dublu /api/api/ | High | ✅ FIXED |
| P6 | Light mode — harta rămâne dark | Medium | ✅ FIXED |
| P7 | Export date → redirect la support | Medium | ✅ FIXED |
| P8 | Privacy bife — stare incertă | Medium | ✅ VERIFIED |
| P9 | Attach photo în mesaje | Medium | TODO (known) |
| P10 | Text ascuns sub Submit | Low | ✅ FIXED |
| P11 | După raport — pagină fără Back | High | ✅ FIXED |
| P12 | Cash nu se poate seta default | High | ✅ FIXED |
| P13 | CVV field tip password | Low | ✅ FIXED |
| P14 | Lipsește badge mesaj nou | High | ✅ FIXED |
| P15 | Rating cursă → 500 | **Critical** | ✅ FIXED |
| P16 | DialogContent fără DialogTitle | Low | ✅ VERIFIED |
| P17 | Add Stop → 404 | High | ✅ FIXED |
| P18 | Saved Places — search nu merge | High | ✅ FIXED |

**Total: 18 bugs** — 14 FIXED/VERIFIED, 4 remaining (1 infra, 1 i18n, 1 S3, 1 push notif)

## Summary — Features Lipsă
| # | Feature | Priority | Status |
|---|---------|----------|--------|
| FP1 | Saved Places — Home/Work/Custom cu search corect | High | ✅ DONE |
| FP2 | Coadă așteptare când niciun șofer disponibil | High | TODO |
| FP3 | Șofer acceptă cursă nouă în avans | Medium | TODO |
| FP4 | Opriri — tarif fix + timer așteptare | High | TODO |

**Total features lipsă: 4**

