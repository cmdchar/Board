# Brainmap Complet Multi-Rol (User + Driver + Fleet + Support + Admin)

Data: 2026-03-01  
Scope: platforma `premium.private-driver.ro` (frontend + backend + realtime + data layer), consolidat pentru vizualizare automată în alt AI.

## 1) Entry Points + Guards pe rol

| Rol | Entrypoint UI | Guard frontend | Navigație principală | Layout/Container |
|---|---|---|---|---|
| Passenger (`user`) | `/v2/passenger` | `ProtectedRoute requiredRoles=['user']` | bottom nav + home sheet + profile/settings submenus | `BottomNavigation` + pagini passenger |
| Driver (`driver`) | `/v2/driver` | `ProtectedRoute requiredRoles=['driver']` | bottom nav + home sheet + profile/settings | `BottomNavigation` + pagini driver |
| Fleet (`fleet_manager`) | `/fleet/dashboard` | `ProtectedRoute requiredRoles=['fleet_manager']` | sidebar fleet | `FleetLayout` |
| Support (`support`) | `/support/dashboard` | `ProtectedRoute requiredRoles=['support']` | sidebar support | `SupportLayout` |
| Admin (`admin`) | `/admin/dashboard` | `ProtectedRoute requiredRoles=['admin']` | sidebar admin | `AdminLayout` |

Surse routing: `src/App.tsx`  
Surse meniuri: `src/components/admin/AdminLayout.tsx`, `src/components/fleet/FleetLayout.tsx`, `src/components/support/SupportLayout.tsx`, `src/components/shared/BottomNavigation.tsx`, `src/pages/passenger/Home.tsx`, `src/pages/driver/Home.tsx`.

## 2) Meniuri consolidate pe rol

### Passenger
- Bottom nav: `Acasă`, `Mesaje`, `Istoric`, `Profil`.
- Home sheet: `Cursele tale`, `Metode de plată`, `Promoții`, `Setări`, `Ajutor & Suport`.
- Profile: `Plăți`, `Locații salvate`, `Promoții`, `Setări`, `Ajutor`, `Legal`.
- Settings subroutes: `Limbă`, `Privacy`, `Trusted devices`, `Notification settings`.

### Driver
- Bottom nav: `Acasă`, `Istoric`, `Câștiguri`, `Profil`.
- Home sheet: `Notificări`, `Mesaje`, `Premium`, `Documente`, `Vehicul`, `Câștiguri`, `Setări`, `Ajutor`.
- Profile: `Vehicle Details`, `Settings`, `Help & Support`.
- Settings sections: `Premium`, `Appearance`, `Driving preferences`, `Notifications`, `Navigation`.

### Fleet
- Sidebar: `Dashboard`, `Vehicles`, `Drivers`, `Trips`, `Earnings`, `Reports`, `Messages`, `Support`, `Settings`.

### Support
- Sidebar: `Dashboard`, `Tickets`, `Messages`, `Notifications`.

### Admin
- Sidebar: `Dashboard`, `Trips`, `Users`, `Drivers`, `Premium Apps`, `Fleets`, `Vehicles`, `Payments`, `Financial Mgmt`, `Pricing`, `Disputes`, `Feedback`, `Audit Logs`, `Analytics`, `Invoices`, `Document Verification`, `Messages`, `Support Tickets`, `Promotions`, `Referrals`, `Settings`, `Database Explorer`, `Project Map`.

## 3) Backend domenii funcționale (single source API)

- Auth & RBAC: `/api/auth/*`, `ProtectedRoute` + backend role checks.
- Ride standard: `/api/rides/*`, `/api/rider/rides*`, `/api/driver/rides*`.
- Executive booking: `/api/executive/*`, `/api/driver/bookings/*`.
- Fleet operations: `/api/fleet/*` (drivers, vehicles, trips, settings, legal entity, invitations).
- Support operations: `/api/support/*` (tickets, assignment, canned responses, analytics).
- Messaging: `/api/conversations/*` (list, contacts, create, messages, search, read).
- Notifications: `/api/notifications/*` (list, register/unregister push, preferences, read/clear).
- Admin control plane: `/api/admin/*`, plus `/api/audit/*`, `/api/admin/db/*`, `/api/admin/project-map/*`.
- Financial/compliance: `/api/legal-entities/*`, `/api/trip-financials/*`, `/api/invoices/*`, `/api/documents/*`.

## 4) Interacțiuni cross-role (business links)

| From | To | Canal | Reguli |
|---|---|---|---|
| Passenger | Driver | ride request / booking + chat | chat direct permis doar cu context ride/booking eligibil |
| Passenger | Support/Admin/Fleet | messaging + support tickets | inițiere permisă oricând pentru canale staff |
| Driver | Passenger | accept/reject/status update + chat | ownership + context checks pe ride endpoints |
| Driver | Fleet | operational management | driver onboarding este invite-only din flotă |
| Fleet | Driver | invites, status, vehicule, trips | driver trebuie legat de `fleet + legal entity` |
| Support | Toți | tickets + conversații | suport operațional cross-role |
| Admin | Toți | settings/policies/compliance/finance | control-plane global, impact asupra tuturor fluxurilor |

## 5) Realtime map (Socket.IO)

Rooms:
- personal: `user_{id}`, `driver_{id}`
- ride: `ride_{ride_id}`
- conversation: `conv_{conversation_id}`
- executive booking: `exec_booking_{booking_id}`

Events principale:
- Ride lifecycle: `new_ride_request`, `ride_accepted`, `ride_started`, `ride_completed`, `ride_status_changed`, `driver_location`.
- Messaging: `join_conversation`, `message:new`, `message:read`, `typing:indicator`.
- Executive lifecycle: `executive_booking_status`, `executive_booking_available`.

## 6) Data layer map

MongoDB (primar):
- Identity/RBAC: `users`, `drivers`, `fleets`, `driver_invitations`.
- Operations: `rides`, `bookings`, `driver_settings`, `driver_premium`, `vehicles`.
- Communications: `conversations`, `messages`, `support_tickets`, `notifications`.
- Legal/finance: `legal_entities`, `trip_financials`, `invoices`, `booking_contracts`, `service_packages`, `system_settings`.
- Compliance/audit: `documents`, audit collections.

Supabase (bridge/sync):
- sync operational tables pentru interop (ex. `users`, `drivers`, `conversations`, `messages`, `support_tickets`, `vehicle_documents`, `audit_logs`), fără a deveni DB principal.

## 7) Mermaid — Topologie completă

```mermaid
flowchart LR
  subgraph FE[Frontend Dashboards]
    U[Passenger UI]
    D[Driver UI]
    F[Fleet UI]
    S[Support UI]
    A[Admin UI]
  end

  subgraph API[FastAPI Domain Routers]
    AUTH[/auth/]
    RIDE[/ride + rider + driver/]
    EXEC[/executive/]
    FLEET[/fleet/]
    SUP[/support/]
    MSG[/conversations/]
    NOTIF[/notifications/]
    ADM[/admin + audit + db explorer/]
    FIN[/legal_entities + invoices + trip_financials/]
  end

  subgraph RT[Socket.IO]
    WSROOMS[user_* / driver_* / ride_* / conv_* / exec_booking_*]
  end

  subgraph DB[MongoDB Primary]
    M1[(users/drivers/fleets)]
    M2[(rides/bookings/vehicles)]
    M3[(conversations/messages/support_tickets/notifications)]
    M4[(legal_entities/trip_financials/invoices/booking_contracts/system_settings)]
  end

  subgraph SB[Supabase Bridge]
    SB1[(sync tables)]
  end

  U --> AUTH
  U --> RIDE
  U --> EXEC
  U --> MSG
  U --> NOTIF

  D --> AUTH
  D --> RIDE
  D --> EXEC
  D --> MSG
  D --> NOTIF

  F --> AUTH
  F --> FLEET
  F --> MSG
  F --> SUP

  S --> AUTH
  S --> SUP
  S --> MSG
  S --> NOTIF

  A --> AUTH
  A --> ADM
  A --> MSG
  A --> SUP
  A --> FIN

  RIDE --> WSROOMS
  EXEC --> WSROOMS
  MSG --> WSROOMS
  NOTIF --> WSROOMS

  AUTH --> M1
  RIDE --> M2
  EXEC --> M2
  FLEET --> M1
  FLEET --> M2
  SUP --> M3
  MSG --> M3
  NOTIF --> M3
  ADM --> M1
  ADM --> M2
  ADM --> M3
  FIN --> M4
  EXEC --> M4
  ADM --> M4

  M1 -.sync.-> SB1
  M2 -.sync.-> SB1
  M3 -.sync.-> SB1
  M4 -.sync.-> SB1
```

## 8) Mermaid — Ride/Booking lifecycle cross-role

```mermaid
sequenceDiagram
  participant P as Passenger
  participant API as Ride/Executive API
  participant DR as Driver
  participant FL as Fleet
  participant WS as Socket.IO
  participant DB as MongoDB

  P->>API: create request/booking
  API->>DB: save booking
  API->>WS: emit availability/status
  WS-->>DR: new request / executive_booking_available
  DR->>API: accept/reject
  API->>DB: update state
  API->>WS: ride_status_changed / executive_booking_status
  WS-->>P: status update
  DR->>API: start service / wait start-stop / complete
  API->>DB: persist timeline + charges + contract snapshots
  API->>WS: status updates
  FL->>API: manages driver/legal context
```

## 9) Mermaid — Messaging privacy model

```mermaid
flowchart TD
  C1[Start conversation request] --> C2{Target role staff?}
  C2 -- Yes --> C3[Allow anytime]
  C2 -- No --> C4{Shared ride/booking context valid?}
  C4 -- No --> C5[Reject 403]
  C4 -- Yes --> C6{Within post-ride window?}
  C6 -- No --> C5
  C6 -- Yes --> C7[Allow conversation]
  C3 --> C8[Messages persisted + WS fanout]
  C7 --> C8
```

## 10) Graph JSON (pentru AI de vizualizare)

```json
{
  "meta": {
    "name": "premium-private-driver-all-roles",
    "date": "2026-03-01",
    "source": "code + role audits",
    "version": "1.0"
  },
  "nodes": [
    { "id": "role_user", "label": "Passenger", "type": "role" },
    { "id": "role_driver", "label": "Driver", "type": "role" },
    { "id": "role_fleet", "label": "Fleet Manager", "type": "role" },
    { "id": "role_support", "label": "Support", "type": "role" },
    { "id": "role_admin", "label": "Admin", "type": "role" },

    { "id": "ui_passenger", "label": "/v2/passenger", "type": "ui" },
    { "id": "ui_driver", "label": "/v2/driver", "type": "ui" },
    { "id": "ui_fleet", "label": "/fleet/dashboard", "type": "ui" },
    { "id": "ui_support", "label": "/support/dashboard", "type": "ui" },
    { "id": "ui_admin", "label": "/admin/dashboard", "type": "ui" },

    { "id": "api_auth", "label": "/api/auth/*", "type": "api" },
    { "id": "api_ride", "label": "/api/rides + /api/rider + /api/driver", "type": "api" },
    { "id": "api_exec", "label": "/api/executive/*", "type": "api" },
    { "id": "api_fleet", "label": "/api/fleet/*", "type": "api" },
    { "id": "api_support", "label": "/api/support/*", "type": "api" },
    { "id": "api_conversations", "label": "/api/conversations/*", "type": "api" },
    { "id": "api_notifications", "label": "/api/notifications/*", "type": "api" },
    { "id": "api_admin", "label": "/api/admin/*", "type": "api" },
    { "id": "api_finance", "label": "/api/legal-entities + /api/invoices + /api/trip-financials", "type": "api" },

    { "id": "ws", "label": "Socket.IO", "type": "realtime" },
    { "id": "db_mongo", "label": "MongoDB (primary)", "type": "database" },
    { "id": "db_supabase", "label": "Supabase (bridge)", "type": "database" }
  ],
  "edges": [
    { "from": "role_user", "to": "ui_passenger", "label": "uses" },
    { "from": "role_driver", "to": "ui_driver", "label": "uses" },
    { "from": "role_fleet", "to": "ui_fleet", "label": "uses" },
    { "from": "role_support", "to": "ui_support", "label": "uses" },
    { "from": "role_admin", "to": "ui_admin", "label": "uses" },

    { "from": "ui_passenger", "to": "api_auth", "label": "auth" },
    { "from": "ui_passenger", "to": "api_ride", "label": "rides" },
    { "from": "ui_passenger", "to": "api_exec", "label": "executive booking" },
    { "from": "ui_passenger", "to": "api_conversations", "label": "messages" },
    { "from": "ui_passenger", "to": "api_notifications", "label": "notifications" },

    { "from": "ui_driver", "to": "api_auth", "label": "auth" },
    { "from": "ui_driver", "to": "api_ride", "label": "ride actions" },
    { "from": "ui_driver", "to": "api_exec", "label": "executive lifecycle" },
    { "from": "ui_driver", "to": "api_conversations", "label": "messages" },
    { "from": "ui_driver", "to": "api_notifications", "label": "notifications" },

    { "from": "ui_fleet", "to": "api_auth", "label": "auth" },
    { "from": "ui_fleet", "to": "api_fleet", "label": "fleet ops" },
    { "from": "ui_fleet", "to": "api_support", "label": "tickets" },
    { "from": "ui_fleet", "to": "api_conversations", "label": "messages" },

    { "from": "ui_support", "to": "api_auth", "label": "auth" },
    { "from": "ui_support", "to": "api_support", "label": "ticketing" },
    { "from": "ui_support", "to": "api_conversations", "label": "messages" },
    { "from": "ui_support", "to": "api_notifications", "label": "notifications" },

    { "from": "ui_admin", "to": "api_auth", "label": "auth" },
    { "from": "ui_admin", "to": "api_admin", "label": "control plane" },
    { "from": "ui_admin", "to": "api_finance", "label": "finance/compliance" },
    { "from": "ui_admin", "to": "api_support", "label": "support ops" },
    { "from": "ui_admin", "to": "api_conversations", "label": "messages" },

    { "from": "api_ride", "to": "ws", "label": "ride realtime" },
    { "from": "api_exec", "to": "ws", "label": "executive realtime" },
    { "from": "api_conversations", "to": "ws", "label": "chat realtime" },
    { "from": "api_notifications", "to": "ws", "label": "notification realtime" },

    { "from": "api_auth", "to": "db_mongo", "label": "read/write" },
    { "from": "api_ride", "to": "db_mongo", "label": "read/write" },
    { "from": "api_exec", "to": "db_mongo", "label": "read/write" },
    { "from": "api_fleet", "to": "db_mongo", "label": "read/write" },
    { "from": "api_support", "to": "db_mongo", "label": "read/write" },
    { "from": "api_conversations", "to": "db_mongo", "label": "read/write" },
    { "from": "api_notifications", "to": "db_mongo", "label": "read/write" },
    { "from": "api_admin", "to": "db_mongo", "label": "read/write" },
    { "from": "api_finance", "to": "db_mongo", "label": "read/write" },

    { "from": "db_mongo", "to": "db_supabase", "label": "sync bridge" }
  ]
}
```

## 11) Observații cheie pentru interpretare vizuală

- `Admin` este control-plane (nu doar un rol de operare), pentru că scrie în `system_settings` și influențează toate fluxurile.
- `Fleet` este nod legal/operational critic: invite-only onboarding + legătură cu entitatea juridică.
- `Passenger` și `Driver` au cea mai densă legătură realtime (ride + booking + messaging + notifications).
- `MongoDB` este sursa de adevăr; `Supabase` rămâne doar bridge de sincronizare.
