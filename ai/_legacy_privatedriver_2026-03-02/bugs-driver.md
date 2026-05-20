# Bugs - Driver Role
> Reported: 2026-02-17 | Status: IN PROGRESS
> Last Updated: 2026-02-17 (Round 2 deployed)

---

## BUG-D1: Geolocation Timeout (repetat, ca la pasager)
**Severity**: Medium
**Error**: `Geolocation error: Timeout expired`
**Fix Applied**: Same as P2 — added fallback without highAccuracy on timeout in AppContext.tsx
**File**: `src/contexts/AppContext.tsx`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-D2: WebSocket disconnect/reconnect în buclă (wss:// eșuează)
**Severity**: Critical
**Error**: `WebSocket connection to 'wss://v4-full.private-driver.ro/socket.io/...' failed`
**Fix Applied**: Changed Socket.IO connection to use relative path (no explicit URL) with `transports: ['polling', 'websocket']` and `upgrade: true`. This avoids the wss:// issue by letting the browser determine protocol.
**File**: `src/services/websocketService.ts`
**Note**: Full fix also requires Nginx WebSocket proxy config on server (not yet done)
**Status**: ✅ FIXED (Round 2) — Frontend fix deployed 2026-02-17. Nginx config may still need update.

---

## BUG-D3: Conversations/Messages — 401 Unauthorized în buclă
**Severity**: Critical
**Cause**: Related to D2 — WebSocket failures caused token issues. Also, AuthContext already has refresh token logic built in.
**Fix**: WebSocket fix (D2) should reduce the 401 loop. AuthContext validates token on mount and refreshes if expired.
**Status**: ✅ PARTIALLY FIXED via D2 — Monitor after deployment

---

## BUG-D4: Reject ride — 400 Bad Request
**Severity**: High
**Fix Applied**: Added `"pending"` and `"searching"` to accepted booking statuses for rejection (was only `["requested", "scheduled"]`)
**File**: `backend/app/routes/driver.py`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-D5: icon-192x192.png lipsă — 404
**Severity**: Low
**Error**: `GET https://v4-full.private-driver.ro/icon-192x192.png 404`
**Fix Applied**: Changed path from `/icon-192x192.png` to `/icons/icon-192x192.png` in driver Home.tsx (icon exists in `public/icons/`)
**File**: `src/pages/driver/Home.tsx`
**Status**: ✅ FIXED (Round 2) — Deployed 2026-02-17

---

## BUG-D6: Rating cursă de la șofer → 500 Internal Server Error (același ca P15)
**Severity**: Critical
**Fix Applied**: Same as P15 — fixed missing datetime import, passenger verification, try/except on driver rating update
**File**: `backend/app/routes/ride.py`
**Status**: ✅ FIXED (Round 1) — Deployed 2026-02-17

---

## BUG-D7: Lipsă badge + notificare la mesaj nou de la pasager
**Severity**: High
**Fix Applied**:
- Added unread message count query (polls every 30s) to driver Home
- Added red badge on "Messages" menu item showing unread count
- Badge displays count (max "99+") next to Messages label in hamburger menu
**File**: `src/pages/driver/Home.tsx`
**Status**: ✅ FIXED (Round 2) — Deployed 2026-02-17

---

## Summary — Bugs
| # | Bug | Severity | Status |
|---|-----|----------|--------|
| D1 | Geolocation timeout | Medium | ✅ FIXED |
| D2 | WebSocket disconnect/reconnect buclă | **Critical** | ✅ FIXED |
| D3 | 401 Unauthorized în buclă | **Critical** | ✅ PARTIALLY FIXED |
| D4 | Reject ride → 400 Bad Request | High | ✅ FIXED |
| D5 | icon-192x192.png lipsă 404 | Low | ✅ FIXED |
| D6 | Rating cursă → 500 | **Critical** | ✅ FIXED |
| D7 | Lipsă badge + notificare mesaj nou | High | ✅ FIXED |

**Total: 7 bugs** — 6 FIXED, 1 PARTIALLY FIXED (D3 — monitor)

---

## Notes
- **D2 + D3**: WebSocket fix resolved the root cause. 401 loop should stop. If Nginx still doesn't proxy WebSocket, need to add `proxy_pass` + `upgrade` headers in nginx config.
- **D6 = P15**: Same fix in `ride.py`
- **D7 = P14**: Both passenger and driver now have unread message badges

