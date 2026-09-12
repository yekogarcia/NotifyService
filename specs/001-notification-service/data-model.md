# Data Model: Servicio de Notificaciones

**Date**: 2026-09-11 | **Feature**: 001-notification-service

## Entity Relationship Overview

```
tenants
  │
  ├── notification_templates
  │     └── notification_template_versions
  │
  ├── notifications
  │     ├── notification_recipients
  │     └── notification_deliveries
  │           └── notification_attempts
  │
  ├── notification_providers
  │     └── notification_provider_channels
  │
  ├── notification_preferences
  ├── notification_devices
  └── notification_events
```

## Tables

### tenants

Multi-tenant root. Every business entity references a tenant.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, default gen_random_uuid() | Tenant identifier |
| name | VARCHAR(255) | NOT NULL | Tenant display name |
| slug | VARCHAR(100) | NOT NULL, UNIQUE | Tenant URL slug |
| is_active | BOOLEAN | NOT NULL, default true | Soft activation |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | Last update |

---

### notification_templates

Template definition (one per code per tenant).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Template identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| code | VARCHAR(255) | NOT NULL | Template code (ej. reservation.confirmed) |
| description | TEXT | NULL | Human description |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: UNIQUE (tenant_id, code)

---

### notification_template_versions

Versioned content for a template. One active version per template code.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Version identifier |
| template_id | UUID | FK → notification_templates.id, NOT NULL | Parent template |
| version | INT | NOT NULL | Version number (1, 2, 3...) |
| language | VARCHAR(10) | NOT NULL | Locale code (ej. en, es, pt) |
| channel | VARCHAR(20) | NOT NULL | Channel (EMAIL, SMS, PUSH) |
| subject | TEXT | NULL | Subject (EMAIL only) |
| body | TEXT | NOT NULL | Rendered content body |
| is_active | BOOLEAN | NOT NULL, default false | Active flag |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| activated_at | TIMESTAMPTZ | NULL | When activated |

**Indexes**: UNIQUE (template_id, version, language, channel),
PARTIAL UNIQUE INDEX on (template_id, language, channel) WHERE is_active = true

---

### notifications

Core entity: intent to communicate.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Notification identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| source_system | VARCHAR(255) | NOT NULL | Requesting system (ej. hotel-pms) |
| event_type | VARCHAR(255) | NOT NULL | Event type (ej. reservation.confirmed) |
| template_code | VARCHAR(255) | NOT NULL | Template to use |
| data | JSONB | NOT NULL, default '{}' | Variables for template rendering |
| idempotency_key | VARCHAR(255) | NOT NULL | Deduplication key |
| status | VARCHAR(20) | NOT NULL, default 'CREATED' | Lifecycle status |
| correlation_id | UUID | NOT NULL | Cross-operation trace ID |
| event_id | UUID | NULL | External event ID |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Status transitions**: CREATED → QUEUED → PROCESSING → SENT → DELIVERED → FAILED

**Indexes**: UNIQUE (tenant_id, idempotency_key),
INDEX (tenant_id, status), INDEX (tenant_id, created_at)

---

### notification_recipients

Recipients for a notification (supports multiple).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Recipient record identifier |
| notification_id | UUID | FK → notifications.id, NOT NULL | Parent notification |
| recipient_type | VARCHAR(20) | NOT NULL | INTERNAL_USER, EXTERNAL_USER, EMAIL, PHONE |
| user_id | VARCHAR(255) | NULL | User ID (if INTERNAL_USER or EXTERNAL_USER) |
| email | VARCHAR(255) | NULL | Direct email (if EMAIL) |
| phone | VARCHAR(20) | NULL | Direct phone (if PHONE) |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Constraints**: At least one of (user_id, email, phone) MUST be NOT NULL.

**Indexes**: INDEX (notification_id)

---

### notification_deliveries

Delivery per channel per recipient for a notification.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Delivery identifier |
| notification_id | UUID | FK → notifications.id, NOT NULL | Parent notification |
| recipient_id | UUID | FK → notification_recipients.id, NOT NULL | Target recipient |
| channel | VARCHAR(20) | NOT NULL | EMAIL, SMS, PUSH |
| provider_id | UUID | FK → notification_providers.id, NULL | Resolved provider |
| status | VARCHAR(20) | NOT NULL, default 'CREATED' | Delivery status |
| attempt_count | INT | NOT NULL, default 0 | Total attempts made |
| max_attempts | INT | NOT NULL, default 3 | Configurable max |
| provider_message_id | VARCHAR(255) | NULL | Provider's message ID |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Status transitions**: CREATED → QUEUED → PROCESSING → SENT → DELIVERED → FAILED → RETRYING

**Indexes**: INDEX (notification_id), INDEX (status), INDEX (recipient_id, channel)

---

### notification_attempts

Individual send attempt for a delivery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Attempt identifier |
| delivery_id | UUID | FK → notification_deliveries.id, NOT NULL | Parent delivery |
| attempt_number | INT | NOT NULL | Sequential (1, 2, 3...) |
| result | VARCHAR(20) | NOT NULL | SUCCESS, TRANSIENT_ERROR, PERMANENT_ERROR |
| provider_message_id | VARCHAR(255) | NULL | Provider message ID for this attempt |
| error_type | VARCHAR(100) | NULL | Classified error type |
| error_message | TEXT | NULL | Error detail |
| attempted_at | TIMESTAMPTZ | NOT NULL, default now() | When attempted |

**Indexes**: INDEX (delivery_id), UNIQUE (delivery_id, attempt_number)

---

### notification_providers

Configured provider instances (ej. SES, Twilio, FCM).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Provider identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| name | VARCHAR(100) | NOT NULL | Display name |
| provider_type | VARCHAR(50) | NOT NULL | SES, TWILIO, FCM, SENDGRID, INFOBIP... |
| config | JSONB | NOT NULL, default '{}' | Non-secret config |
| secret_ref | VARCHAR(255) | NOT NULL | Reference to secret manager (NOT the secret itself) |
| is_active | BOOLEAN | NOT NULL, default true | Active flag |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: INDEX (tenant_id, provider_type)

---

### notification_provider_channels

Maps a provider to a channel for a tenant (which provider handles which channel).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Mapping identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| provider_id | UUID | FK → notification_providers.id, NOT NULL | Provider |
| channel | VARCHAR(20) | NOT NULL | EMAIL, SMS, PUSH |
| is_active | BOOLEAN | NOT NULL, default true | Active flag |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: UNIQUE (tenant_id, channel) WHERE is_active = true

---

### notification_preferences

User channel opt-in/opt-out preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Preference identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| user_id | VARCHAR(255) | NOT NULL | User identifier |
| channel | VARCHAR(20) | NOT NULL | EMAIL, SMS, PUSH |
| enabled | BOOLEAN | NOT NULL, default true | ON/OFF |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: UNIQUE (tenant_id, user_id, channel)

---

### notification_devices

Device tokens for PUSH notifications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Device identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| user_id | VARCHAR(255) | NOT NULL | User identifier |
| device_token | VARCHAR(500) | NOT NULL | FCM/APNs token |
| platform | VARCHAR(20) | NOT NULL | IOS, ANDROID, WEB |
| is_active | BOOLEAN | NOT NULL, default true | Token still valid |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: INDEX (tenant_id, user_id), UNIQUE (tenant_id, device_token)

---

### notification_events

Audit log / event store for observability and tracing.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Event identifier |
| tenant_id | UUID | FK → tenants.id, NOT NULL | Owning tenant |
| notification_id | UUID | FK → notifications.id, NULL | Related notification |
| delivery_id | UUID | FK → notification_deliveries.id, NULL | Related delivery |
| event_type | VARCHAR(100) | NOT NULL | NOTIFICATION_CREATED, DELIVERY_QUEUED, ATTEMPT_FAILED... |
| correlation_id | UUID | NOT NULL | Trace correlation |
| source_system | VARCHAR(255) | NULL | Originating system |
| metadata | JSONB | NOT NULL, default '{}' | Event-specific data |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |

**Indexes**: INDEX (notification_id), INDEX (correlation_id), INDEX (tenant_id, created_at)

## State Machines

### Notification Status

```
CREATED → QUEUED → PROCESSING → SENT → DELIVERED
                                     ↘ FAILED
```

### Delivery Status

```
CREATED → QUEUED → PROCESSING → SENT → DELIVERED
                   ↗ RETRYING ↘
                                ↘ FAILED (→ Dead Letter)
```

## Migration Notes

- All tables use UUID primary keys (gen_random_uuid()).
- All business tables have `tenant_id` for multi-tenant isolation.
- `notifications.data` uses JSONB for flexible template variables.
- `notification_providers.secret_ref` stores a reference to the secret
  manager, never the credential itself (Principle VIII).
- Soft delete via `is_active` boolean where applicable (templates, providers,
  devices, preferences).
- Partial unique indexes enforce one active template version per
  (template, language, channel) and one active provider per (tenant, channel).
- Idempotency enforced by UNIQUE (tenant_id, idempotency_key) on notifications.
