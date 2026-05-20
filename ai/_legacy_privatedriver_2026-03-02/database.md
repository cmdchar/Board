# Database Structure - PrivateDriver v4

## Overview

The app uses a dual-database architecture:
- **MongoDB** (primary) - used by the FastAPI backend + React PWA
- **Supabase/PostgreSQL** (secondary) - used by the Flutter mobile app

Data is synced MongoDB -> Supabase via `supabase_bridge.py` (REST API).
Full sync endpoint: `POST /api/sync/full` (admin only).

### Latest Update (2026-03-01, premium Supabase project bootstrap)
- New Supabase premium project wired in env (`hjtfgvrycuhwednuqwmc.supabase.co`).
- Audit result on new project:
  - existing: `legal_entities`, `trip_financials`, `invoices`
  - missing: bridge core tables (`users`, `rides`, `drivers`, `vehicle_documents`, `audit_logs`, `conversations`, `messages`, `support_tickets`, `location_history`)
- New migration prepared:
  - `supabase/migrations/20260301_create_bridge_core_tables.sql`
  - includes missing bridge/mobile tables + indexes + baseline RLS policies for `users`, `rides`, `location_history`.

### Latest Update (2026-03-01, post-migration sync compatibility)
- Bridge migration was applied and core Supabase tables are live.
- Sync layer updated for premium data shape:
  - `drivers` sync no longer sends unsupported `is_online` field for bridge schema.
  - documents sync now supports fallback source collection:
    - `documents` (legacy) OR `compliance_documents` (premium)
  - document field normalization supports both models (`document_type/doc_type`, `issue_date/issued_at`, `expiry_date/expires_at`, `file_path/file_url`, `status/verification_status`).
- Verified Supabase operational counts after sync:
  - `users=14`, `drivers=5`, `vehicle_documents=5`, `audit_logs=186`, `conversations=25`, `messages=35`, `support_tickets=3`.

### Latest Update (2026-02-28, premium contract artifacts)
- New MongoDB collection: `booking_contracts` (premium executive)
  - Stores versioned contractual artifacts per booking stage (`pending_confirmation`, `confirmed`, `wait_updated`, `completed`, etc.)
  - Core fields:
    - `bookingId`, `reference`, `version`, `stage`, `statusSnapshot`
    - `fileName`, `filePath`, `fileSize`, `mimeType`, `sha256`, `downloadUrl`
    - `generatedAt`, `generatedByUserId`, `generatedByRole`
    - `passengerUserId`, `driverUserId`
    - snapshots: `termsAcceptance`, `pricingSnapshot`, `contractSnapshot`
- `bookings` documents now include `contractDocument` (latest pointer metadata):
  - `latestContractId`, `reference`, `stage`, `version`
  - `generatedAt`, `fileName`, `fileSize`, `sha256`, `downloadUrl`

### Latest Update (2026-02-28, messaging/search/support toolkit)
- New endpoint `GET /api/conversations/search/messages`:
  - searches in `messages.content` + `messages.sender_name`
  - returns only conversations visible to current user (role + participant constraints).
- New MongoDB collection: `support_canned_responses`
  - used by `GET/POST/PUT/DELETE /api/support/canned-responses`
  - role scopes: `global`, `support`, `admin`, `fleet_manager`
  - ownership rules: admin or creator can update/deactivate entries.

---

## MongoDB (privatedriver)

Connection: `mongodb://admin:admin@mongodb:27017/privatedriver?authSource=admin`

### Collections

#### users (10 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `email` | string | Unique |
| `password` | string | bcrypt hash |
| `name` | string | |
| `phone` | string | |
| `role` | string | `user`, `driver`, `admin`, `fleet`, `support` |
| `rating` | number | 0-5 scale |
| `totalRides` | number | |
| `isOnline` | boolean | |
| `preferences` | object | `{ quiet_ride, temperature }` |
| `savedLocations` | array | |
| `bypassDocuments` | boolean | Admin bypass for driver docs |
| `supabase_id` | string | Reference to Supabase UUID |
| `createdAt` | ISODate | camelCase |
| `updatedAt` | ISODate | camelCase |

#### drivers (4 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `userId` | string | References users._id |
| `vehicleType` | string | sedan, van, etc. |
| `vehicleNumber` | string | |
| `licenseNumber` | string | |
| `currentLocation` | object | `{ lat, lng }` |
| `isAvailable` | boolean | |
| `rating` | number | 0-5 |
| `totalTrips` | number | |
| `createdAt` | ISODate | |
| `updatedAt` | ISODate | |

#### documents (30 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `owner_type` | string | `driver`, `vehicle` |
| `owner_id` | string | References drivers._id |
| `document_type` | string | `driving_license_front`, `driving_license_back`, `criminal_record`, `medical_certificate`, `professional_certificate`, `vehicle_registration`, `vehicle_insurance_rca`, `vehicle_itp` |
| `document_number` | string | |
| `issue_date` | string | ISO date |
| `expiry_date` | string | ISO date |
| `status` | string | `pending`, `verified`, `rejected`, `expired` |
| `file_name` | string | |
| `file_path` | string | |
| `mime_type` | string | |
| `file_size` | number | bytes |
| `createdAt` | ISODate | |

#### audit_logs (62 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `user_id` | string | Who performed the action |
| `action` | string | e.g. `driver.bypass_documents` |
| `entity_type` | string | e.g. `driver`, `user` |
| `entity_id` | string | |
| `old_data` | object | Previous state (nullable) |
| `new_data` | object | New state (nullable) |
| `ip_address` | string | |
| `user_agent` | string | |
| `request_method` | string | GET, POST, etc. |
| `request_path` | string | |
| `status_code` | number | |
| `error_message` | string | nullable |
| `created_at` | ISODate | snake_case |

#### conversations (3 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `participants` | ObjectId[] | User IDs |
| `participant_names` | string[] | |
| `participant_roles` | string[] | |
| `title` | string | |
| `is_ticket` | boolean | Linked to support ticket |
| `last_message` | object | `{ content, sender_name, sender_role }` |
| `last_message_at` | ISODate | |
| `created_at` | ISODate | snake_case |
| `updated_at` | ISODate | |

#### messages (7 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `conversation_id` | ObjectId | References conversations._id |
| `sender_id` | ObjectId | References users._id |
| `sender_role` | string | |
| `sender_name` | string | |
| `content` | string | |
| `type` | string | `text` |
| `is_read` | boolean | |
| `read_by` | ObjectId[] | |
| `created_at` | ISODate | |

#### support_canned_responses (new)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `title` | string | Template short title |
| `content` | string | Template body injected in chat |
| `category` | string | e.g. booking, payments, support |
| `scope` | string | `global`, `support`, `admin`, `fleet_manager` |
| `is_active` | boolean | Soft-delete flag |
| `is_default` | boolean | Built-in template marker |
| `created_by` | string | Creator user id |
| `created_by_role` | string | Creator role |
| `created_at` | ISODate | |
| `updated_at` | ISODate | |

#### support_tickets (2 docs)
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `ticket_number` | string | e.g. `TK-001` |
| `created_by` | string | User ID |
| `assigned_to` | string | Admin/support user ID |
| `status` | string | `open`, `in_progress`, `resolved`, `closed` |
| `priority` | string | `low`, `medium`, `high`, `urgent` |
| `category` | string | |
| `title` | string | |
| `description` | string | |
| `conversation_id` | ObjectId | References conversations._id |
| `response_count` | number | |
| `created_at` | ISODate | |
| `updated_at` | ISODate | |
| `resolved_at` | ISODate | nullable |

#### refresh_tokens (51 docs) - NOT synced to Supabase
| Field | Type | Notes |
|-------|------|-------|
| `_id` | ObjectId | Primary key |
| `userId` | string | |
| `tokenHash` | string | |
| `createdAt` | ISODate | |
| `expiresAt` | ISODate | |
| `revokedAt` | ISODate | nullable |
| `replacedByTokenHash` | string | nullable |
| `userAgent` | string | |
| `ipAddress` | string | |

### Naming Convention Note
- `users`, `drivers`, `documents`: **camelCase** timestamps (`createdAt`, `updatedAt`)
- `audit_logs`, `conversations`, `messages`, `support_tickets`: **snake_case** timestamps (`created_at`, `updated_at`)

---

## Supabase / PostgreSQL

Project: `rgqtaugxtbpatgdscwra`
URL: `https://rgqtaugxtbpatgdscwra.supabase.co`

### Synced Tables (data from MongoDB)

#### users (19 rows - 10 from MongoDB + 9 pre-existing)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | Links to MongoDB _id |
| `email` | text | UNIQUE, NOT NULL | |
| `password_hash` | text | | |
| `phone` | text | NOT NULL | |
| `name` | text | NOT NULL | |
| `role` | text | NOT NULL | user, driver, admin, fleet, support |
| `profile_image` | text | | |
| `preferences` | jsonb | | Default: `{"quiet_ride": false, "temperature": "normal"}` |
| `saved_locations` | jsonb | | Default: `[]` |
| `rating_score` | integer | CHECK 0-100 | MongoDB rating * 20 |
| `completed_rides` | integer | | Default 0 |
| `cancelled_rides` | integer | | Default 0 |
| `is_active` | boolean | | Default true |
| `is_verified` | boolean | | Default false |
| `email_verified` | boolean | | Default false |
| `phone_verified` | boolean | | Default false |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |
| `last_login_at` | timestamptz | | |
| `deleted_at` | timestamptz | | Soft delete |

#### drivers (4 rows)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | |
| `user_id` | text | | MongoDB user ObjectId (was UUID, changed to TEXT) |
| `vehicle_type` | text | | |
| `vehicle_number` | text | | |
| `vehicle_id` | text | | |
| `license_number` | text | | |
| `license_expiry` | timestamptz | | |
| `cnp` | text | | Romanian national ID |
| `address` | text | | |
| `contract_type` | text | | |
| `iban` | text | | |
| `arr_certificate_expiry` | timestamptz | | |
| `current_location` | jsonb | | `{lat, lng}` |
| `is_available` | boolean | | |
| `is_online` | boolean | | |
| `rating` | numeric | CHECK 0-5 | |
| `rating_score` | integer | CHECK 0-100 | |
| `total_trips` | integer | | |
| `completed_trips` | integer | | |
| `cancelled_trips` | integer | | |
| `acceptance_rate` | numeric | | |
| `total_revenue` | numeric | | |
| `total_distance` | numeric | | |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |
| `approved_at` | timestamptz | | |
| `suspended_at` | timestamptz | | |

#### vehicle_documents (30 rows)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | |
| `vehicle_id` | text | | MongoDB driver/owner ObjectId (was UUID, changed to TEXT) |
| `type` | text | NOT NULL | No check constraint (removed for MongoDB compat) |
| `document_number` | text | NOT NULL | |
| `issue_date` | date | NOT NULL | |
| `expiry_date` | date | NOT NULL | |
| `file_url` | text | | Maps from MongoDB `file_path` |
| `file_size` | integer | | |
| `verified` | boolean | | Maps from `status == "verified"` |
| `verified_by` | text | | Was UUID, changed to TEXT |
| `verified_at` | timestamptz | | |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |

#### audit_logs (62 rows)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | |
| `user_id` | text | | |
| `action` | text | NOT NULL | |
| `entity_type` | text | | |
| `entity_id` | text | | |
| `old_data` | jsonb | | |
| `new_data` | jsonb | | |
| `ip_address` | text | | |
| `user_agent` | text | | |
| `request_method` | text | | |
| `request_path` | text | | |
| `status_code` | integer | | |
| `error_message` | text | | |
| `created_at` | timestamptz | | |

#### conversations (3 rows)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | |
| `participants` | text[] | | ObjectIds as strings |
| `participant_names` | text[] | | |
| `participant_roles` | text[] | | |
| `title` | text | | |
| `is_ticket` | boolean | | |
| `last_message` | jsonb | | |
| `last_message_at` | timestamptz | | |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |

#### messages (7 rows)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | |
| `conversation_id` | text | | ObjectId as string |
| `sender_id` | text | | ObjectId as string |
| `sender_role` | text | | |
| `sender_name` | text | | |
| `content` | text | | |
| `type` | text | | Default `text` |
| `is_read` | boolean | | |
| `read_by` | text[] | | ObjectIds as strings |
| `created_at` | timestamptz | | |

#### support_tickets (2 rows)
| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| `id` | uuid | PK, auto | |
| `mongodb_id` | text | UNIQUE | |
| `ticket_number` | text | | |
| `created_by` | text | | |
| `assigned_to` | text | | |
| `status` | text | | Default `open` |
| `priority` | text | | Default `medium` |
| `category` | text | | |
| `title` | text | | |
| `description` | text | | |
| `conversation_id` | text | | |
| `response_count` | integer | | |
| `created_at` | timestamptz | | |
| `updated_at` | timestamptz | | |
| `resolved_at` | timestamptz | | |

### Empty Tables (Supabase-only, for Flutter app)

#### rides (0 rows)
Core ride/trip data with full fare breakdown: `base_fare`, `distance_fare`, `time_fare`, `wait_cost`, `stops_cost`, `surge_multiplier`, `total_fare`, `platform_commission`, `driver_earnings`. Status flow: `requested` -> `accepted` -> `arrived` -> `in-progress` -> `completed`/`cancelled`.

#### bookings (0 rows)
Ride requests before matching. Fields: `user_id`, `pickup_location`, `dropoff_location`, `want_pooling`, `fare`, `estimated_distance`, `estimated_duration`.

#### vehicles (0 rows)
Fleet vehicle registry: `vehicle_number` (unique), `vin`, `make`, `model`, `year`, `color`, `driver_id`, `status`, `current_mileage`, maintenance tracking, cost tracking.

#### notifications (0 rows)
Push/email/SMS notifications: `user_id`, `type`, `title`, `message`, `data` (jsonb), `action_url`, delivery tracking (`sent_push`, `sent_email`, `sent_sms`).

#### feedback (0 rows)
Ride ratings: `user_id`, `driver_id`, `ride_id`, `rating` (1-5), `comment`, `tags[]`, `driver_response`.

#### payment_methods (0 rows)
Saved payment methods: `type` (card/cash/wallet/bank_transfer), card details, bank details, `is_default`, `is_verified`.

#### payment_transactions (0 rows)
Payment history: `type` (charge/refund/payout/fee), `amount`, `currency` (RON), `status`, external payment gateway IDs.

#### invoices (0 rows)
Billing invoices: `type` (customer/driver_commission/platform_fee), `line_items` (jsonb), `subtotal`, `tax`, `total`, `status` (pending/paid/overdue/cancelled).

#### pricing_config (1 row)
Global pricing: `base_fare` (4 RON), `per_km_rate` (4 RON), `pooling_discount_percent` (25%), `wait_minute_fee` (1 RON), `minimum_fare` (10 RON), `platform_commission_percent` (15%), `cancellation_fee` (5 RON).

#### pricing_zones (0 rows)
Geo pricing zones: `name`, `type` (normal/premium/airport/downtown), `coordinates` (jsonb polygon), `price_multiplier`.

#### surge_pricing_rules (0 rows)
Dynamic pricing: `multiplier`, `conditions` (jsonb), `zones[]`, `priority`.

#### promo_codes (0 rows)
Discount codes: `code` (unique), `discount_type`, `discount_value`, `max_discount`, validity period, usage limits.

#### promo_code_usage (0 rows)
Tracks promo code redemptions per user/ride.

#### fleet_settings (1 row)
Fleet config: `service_areas`, `business_hours`, `max_cancellations_per_day` (3), `min_driver_rating` (3.0), auto-approve toggles, notification preferences.

#### fleet_analytics (0 rows)
Daily fleet stats: revenue, trips, active drivers/vehicles, utilization, demand heatmap, predicted demand.

#### fleet_alerts (0 rows)
Operational alerts: `severity` (info/warning/critical), `entity_type`, `action_required`, `resolved_at`.

#### driver_performance (0 rows)
Period-based driver metrics: trips, revenue, online hours, utilization, safety score, fleet ranking.

#### maintenance_records (0 rows)
Vehicle maintenance: `type`, `cost`, `mileage`, `next_service_due`.

#### api_keys (0 rows)
External API keys: `key_hash`, `permissions[]`, `expires_at`.

#### webhooks (0 rows)
Webhook configurations: `url`, `events[]`, `secret`, failure tracking.

### Views

#### active_rides
```sql
SELECT r.*, d.user_id AS driver_user_id, u.name AS driver_name, u.phone AS driver_phone
FROM rides r
  LEFT JOIN drivers d ON r.driver_id = d.id
  LEFT JOIN users u ON d.user_id = u.mongodb_id
WHERE r.status IN ('accepted', 'arrived', 'in-progress');
```

#### driver_earnings_summary
```sql
SELECT d.id, d.user_id, u.name, count(r.id), sum(r.driver_earnings), avg(r.driver_earnings), sum(r.distance), d.rating, d.rating_score
FROM drivers d
  LEFT JOIN users u ON d.user_id = u.mongodb_id
  LEFT JOIN rides r ON r.driver_id = d.id AND r.status = 'completed'
GROUP BY d.id, d.user_id, u.name, d.rating, d.rating_score;
```

#### fleet_overview
```sql
SELECT online_drivers, available_drivers, active_vehicles, pending_requests, active_rides, today_revenue
FROM drivers d CROSS JOIN vehicles v CROSS JOIN rides r;
```

---

## Sync Architecture

### Direction: MongoDB -> Supabase
- **Sync service**: `backend/app/services/supabase_bridge.py`
- **Sync routes**: `backend/app/routes/sync.py` (prefix `/api/sync`)
- **Auto-sync helpers**: `backend/app/utils/auto_sync.py`

### Sync Mapping

| MongoDB Collection | Supabase Table | Key Field Mappings |
|---|---|---|
| `users` | `users` | `_id` -> `mongodb_id`, `totalRides` -> `completed_rides`, `rating` * 20 -> `rating_score` |
| `drivers` | `drivers` | `userId` -> `user_id`, `vehicleType` -> `vehicle_type`, `totalTrips` -> `total_trips` |
| `documents` | `vehicle_documents` | `owner_id` -> `vehicle_id`, `document_type` -> `type`, `file_path` -> `file_url`, `status=="verified"` -> `verified` |
| `audit_logs` | `audit_logs` | Direct mapping (already snake_case) |
| `conversations` | `conversations` | Direct mapping, ObjectIds serialized to strings |
| `messages` | `messages` | Direct mapping, ObjectIds serialized to strings |
| `support_tickets` | `support_tickets` | Direct mapping |
| `refresh_tokens` | NOT SYNCED | Sensitive auth data |

### Sync Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sync/full` | POST | Sync ALL collections (admin only) |
| `/api/sync/manual` | POST | Sync single entity |
| `/api/sync/bulk` | POST | Sync all entities of one type |
| `/api/sync/status` | GET | Sync health check |
| `/api/sync/webhook/supabase` | POST | Supabase webhook receiver (HMAC verified) |

### Schema Changes Made for Compatibility
- `drivers.user_id`: UUID -> TEXT (stores MongoDB ObjectId strings)
- `vehicle_documents.vehicle_id`: UUID -> TEXT
- `vehicle_documents.verified_by`: UUID -> TEXT
- `vehicle_documents_type_check`: DROPPED (MongoDB has more doc types than original constraint)
- `users_role_check`: DROPPED (MongoDB has `fleet`, `support` roles not in original)
- Views `active_rides`, `driver_earnings_summary` recreated to join via `mongodb_id` instead of UUID `id`

---

## Row Level Security (RLS)

All tables have RLS enabled. Key policies:
- `service_role` has full access on all tables (used by backend)
- `anon`/`authenticated` have SELECT on synced tables
- `bookings`: users can only select/insert their own bookings

---

## Data Counts (as of 2026-02-07)

| Source | users | drivers | documents | audit_logs | conversations | messages | tickets | refresh_tokens |
|--------|-------|---------|-----------|------------|---------------|----------|---------|----------------|
| MongoDB | 10 | 4 | 30 | 62 | 3 | 7 | 2 | 51 |
| Supabase | 19* | 4 | 30 | 62 | 3 | 7 | 2 | - |

*Supabase users: 10 from MongoDB + 9 pre-existing from initial setup

---

## Premium Executive Additions (2026-02-27)

### New/Extended MongoDB Usage

#### bookings (extended fields for executive lifecycle)
- `bookingType`: `"executive"`
- `serviceType`: `"executive"`
- `productMode`: `"executive_only"`
- `status`: `pending_confirmation | confirmed | cancelled_by_client | cancelled_by_driver | completed`
- `scheduledStartAt`: datetime (UTC)
- `packageId`, `packageType`
- `pricingSnapshot`: package + amount/currency + cancellation policy + pricing model
- `termsAcceptance`: `terms_version`, `acceptedAt`, `ip`, `userAgent`
- `confirmation`: `confirmedAt`, `confirmedByUserId`, `confirmedByRole`, `channel`
- `stops`: planned stops list (`id`, `order`, `location`)
- `activeWaitEvent`: current waiting timer context while in service
- `contract`:
  - `version`: `executive-stop-wait-v1`
  - `stops`: planned/completed stop states
  - `waitEvents`: detailed wait sessions (`startedAt`, `endedAt`, duration, fees, pricingRule)
  - `charges`: `packageAmount`, `stopsFixedAmount`, `waitAmount`, `totalAmount`
- `pricingSnapshot.stopPolicy`:
  - `stopFixedFee`
  - `waitMinuteFee`
  - `freeWaitMinutes`
  - `source` (`admin|fleet|pfa|driver`)
  - `sourceId`
- `pricingSnapshot.stopChargesEstimate`:
  - `count`, `totalFixed`
- `pricingSnapshot.estimatedTotal`

#### service_packages (new, optional seed fallback exists in code)
- Used by `GET /api/executive/packages`
- Core fields:
  - `name`, `type` (`hourly` / `transfer`), `durationMinutes`, `price`, `currency`, `description`, `cancellationPolicy`, `active`

#### booking_events (new audit trail)
- One document per booking event:
  - `bookingId`, `eventType`, `actorId`, `actorRole`, `payload`, `createdAt`
- Events produced in current flow:
  - `created`, `confirmed`, `cancelled`, `rejected`

#### communication_logs (new communication audit trail)
- One document per outbound communication attempt (currently in-app notifications for executive lifecycle):
  - `bookingId`, `channel`, `template`, `to`, `status`, `provider_id`, `error`, `metadata`, `createdAt`
- Current channels/templates in use:
  - `channel: "in_app"`
  - templates for request/confirm/cancel/reject executive flows

---

## Legal Compliance Additions (2026-03-01)

### New collection: `driver_invitations`
- Purpose: enforce invitation-only onboarding for driver accounts.
- Key fields:
  - `tokenHash` (SHA-256 of invite token)
  - `fleetId`, `fleetName`
  - `legalEntityId`, `legalEntityName`
  - `email`
  - `vehicleType`, `vehicleNumber`, `licenseNumber`
  - `status` (`pending|accepted|expired|revoked`)
  - `invitedByUserId`, `invitedByName`
  - `expiresAt`, `acceptedAt`, `consumedByUserId`
  - `createdAt`, `updatedAt`

### Booking schema extension (executive legal binding)
- `bookings` now persist:
  - `fleetId`
  - `legalEntityId`
  - `operatorSnapshot` (name, type, CUI, reg no, address, contact)
  - `driverSnapshot` (delegated executor details)

### Contract persistence extension
- `booking_contracts` now also stores:
  - `fleetId`
  - `legalEntityId`
  - `operatorSnapshot`

