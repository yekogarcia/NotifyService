# NotifyService - Context Document

> Last updated: 2026-09-23
> This file captures the full context of the NotifyService project. Update it whenever significant changes are made.
> 
> **opencode.md** is the context file for OpenCode sessions. Keep it updated with architecture decisions, auth flows, and endpoint changes.
> **plan.md** holds the active work plan with `[PENDIENTE]`/`[EN PROGRESO]`/`[COMPLETADO]` labels — check it first on session start.

---

## Overview

Multi-channel notification service built with NestJS + TypeORM + PostgreSQL. Supports EMAIL, SMS, PUSH, WHATSAPP, WEBHOOK, SLACK, TEAMS. Multi-tenant architecture with application-level authentication via JWT.

**Stack:** NestJS 10, Fastify, PostgreSQL, TypeORM, Redis/BullMQ, JWT, argon2id

---

## Project Structure

```
src/
  main.ts                          # Fastify bootstrap, global prefix /api/v1, Swagger at /docs
  app.module.ts                    # Root module, global APP_GUARD, all entity registrations
  shared/
    config/env.config.ts           # Typed env config
    infrastructure/
      database/database.module.ts  # TypeORM root config
      queue/                       # RedisService, queue name constants
      guards/
        auth.guard.ts              # Global guard (API Key + JWT + @Public())
        public.decorator.ts        # @Public() decorator
      middleware/                   # rate-limit, correlation
      logger/                      # Winston logger services
      metrics/                     # Delivery/Error metrics (not wired yet)
  modules/
    tenants/                       # CRUD tenants (PUBLIC endpoints)
    applications/                  # CRUD applications (PROTECTED)
    auth/                          # Login endpoint, JWT strategy
    notifications/                 # Create notification, repositories
    templates/                     # CRUD templates with versioning
    deliveries/                    # Delivery dispatcher, channels, worker, DLQ
    preferences/                   # User channel preferences + device tokens
    providers/                     # Provider config (SES, Twilio, FCM, etc.)
    health/                        # Health check endpoints
```

---

## Database Tables (12 tables)

### Core Multi-Tenant Tables

| Table | PK | Scope | Description |
|-------|-----|-------|-------------|
| `tenants` | id (uuid) | root | Organizations. Unique slug. |
| `applications` | id (uuid) | tenant | Apps that send notifications. Has client_id + client_secret (argon2). |

### Notification Pipeline Tables

| Table | PK | FK | Scope | Description |
|-------|-----|----|----|-------------|
| `notifications` | id | tenant_id, application_id | tenant+app | Core notification intent. Has idempotency_key. |
| `notification_recipients` | id | notification_id | notification | Who receives (user_id, email, or phone). |
| `notification_deliveries` | id | notification_id, recipient_id | notification | Per-channel delivery. Tracks status + attempts. |
| `notification_attempts` | id | delivery_id | delivery | Individual send attempts with results/errors. |
| `notification_events` | id | tenant_id, application_id | tenant+app | Audit log / event store. |

### Configuration Tables

| Table | PK | Scope | Description |
|-------|-----|-------|-------------|
| `notification_templates` | id | tenant+app | Template definitions (code per tenant+app). |
| `notification_template_versions` | id | template | Versioned content per language+channel. |
| `notification_providers` | id | tenant | Provider configs (SES, Twilio, FCM...). Shared by tenant. |
| `notification_provider_channels` | id | tenant | Maps provider to channel (1 active per channel). |
| `notification_preferences` | id | tenant+app | User opt-in/opt-out per channel. |
| `notification_devices` | id | tenant+app | Device tokens for push notifications. |

### Key Relationships

```
tenants (1)
  └── applications (N)
        └── notifications (N)
              ├── notification_recipients (N)
              │     └── notification_deliveries (N)
              │           └── notification_attempts (N)
              └── notification_events (N)

tenants (1)
  ├── notification_templates (N)
  │     └── notification_template_versions (N)
  ├── notification_providers (N)
  │     └── notification_provider_channels (N)
  ├── notification_preferences (N)
  └── notification_devices (N)
```

---

## Authentication Flow

### Two OAuth 2.0 Grant Types

| Grant Type | Credenciales | Para quién | Uso |
|------------|-------------|------------|-----|
| `password` | `username` + `password` | Admin platform | Login para gestionar apps y notificaciones |
| `client_credentials` | `client_id` + `client_secret` | Backend externo | Generar y enviar notificaciones |

### Flujo Completo

```
1. POST /tenants { name, slug }                         → Crea tenant
2. POST /auth/token { username, password }              → Login admin (JWT type: admin)
3. POST /applications { name }                           → Crea app (tenant desde JWT admin), retorna client_id + client_secret (UNA SOLA VEZ)
4. POST /oauth/token { grant_type: "client_credentials", client_id, client_secret }
                                                       → Login backend externo (JWT type: api)
5. POST /oauth/refresh { client_id, client_secret, refresh_token }
                                                       → Renueva tokens
```

### Guard Architecture
- **Global guard** registered via `APP_GUARD` in `app.module.ts`
- Supports: API Key (`X-API-Key` header) OR JWT Bearer token
- `@Public()` decorator skips auth on specific routes
- Password grant tokens (type: admin) and client_credentials tokens (type: api) both work with JWT auth

### JWT Payloads

**Password grant (admin):**
```json
{
  "type": "admin",
  "sub": "<tenant-uuid>",
  "tenantId": "<tenant-uuid>",
  "email": "admin@example.com",
  "tenantName": "Tenant Name"
}
```

**Client credentials grant (api):**
```json
{
  "type": "api",
  "sub": "<application-uuid>",
  "tenantId": "<tenant-uuid>",
  "clientId": "app_...",
  "appName": "App Name"
}
```

### OAuth Endpoints

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| POST | `/api/v1/oauth/token` | `grant_type=password`, `username`, `password` | Login admin |
| POST | `/api/v1/oauth/token` | `grant_type=client_credentials`, `client_id`, `client_secret` | Login backend externo |
| POST | `/api/v1/oauth/refresh` | `client_id`, `client_secret`, `refresh_token` | Renovar tokens |

### Credential Hashing
- Algorithm: **argon2id** (memoryCost=65536, timeCost=3, parallelism=4)
- `client_secret` stored as hash, plain text returned only once on creation

---

## API Endpoints Summary

All routes prefixed with `/api/v1`.

### Auth (OAuth 2.0)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/oauth/token` | Public | Login (grant_type: password o client_credentials) |
| POST | `/oauth/refresh` | Public | Renovar tokens con refresh_token |

### Tenants (Public)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/tenants` | Public | Create tenant |
| GET | `/tenants` | Public | List all |
| GET | `/tenants/:id` | Public | Get by ID (UUID validated) |
| PATCH | `/tenants/:id` | Public | Update |
| DELETE | `/tenants/:id` | Public | Delete (cascade) |

### Applications (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/applications` | Bearer | Create (tenant from JWT; returns credentials) |
| GET | `/applications` | Bearer | List for tenant (from JWT) |
| GET | `/applications/:id` | Bearer | Get by ID |
| PATCH | `/applications/:id` | Bearer | Update |
| DELETE | `/applications/:id` | Bearer | Delete |
| POST | `/applications/:id/rotate-secret` | Bearer | Rotate secret |

### Notifications (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/notifications` | Bearer | Create (202 Accepted) |
| GET | `/notifications/:id` | Bearer | Get with deliveries+attempts |
| GET | `/notifications` | Bearer | List (pagination stub) |

### Templates (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/templates` | Bearer | Create with versions |
| GET | `/templates/:code` | Bearer | Get by code |
| PATCH | `/templates/:code/versions/:version/activate` | Bearer | Activate version |

### Providers (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/providers` | Bearer | Create (tenant from JWT; accepts `secret` encrypted at rest into `secretRef`, or plain `secretRef`) |
| PUT | `/providers/:id` | Bearer | Update (re-encrypts if `secret` provided; responses mask secretRef) |
| POST | `/providers/:id/channels` | Bearer | Map to channel (persists, 1 active per channel per tenant) |

**SES email sending:** create provider with `providerType: "SES"` and `config: { transport: "smtp", host, port, secure, starttls, username, fromAddress }`; the CSV password goes in `secret` (AES-256-GCM with `SECRETS_MASTER_KEY` → `enc:v1:` in `secret_ref` — no per-provider `.env` vars, DB alone is useless without the master key). `fromAddress` must be an identity verified in SES (e.g. `contacto@semic.com.co`). The registry builds a `SmtpAdapter` (nodemailer) when `transport === "smtp"`, otherwise falls back to the AWS SDK adapter. Delivery channels resolve the provider per `(tenant, channel)` via `ProviderRegistry` (Redis cache TTL 300s, invalidated on save), falling back to legacy env vars when no mapping exists.

**WhatsApp Cloud API sending (Meta):** create provider with `providerType: "WHATSAPP_CLOUD"` and `config: { phoneNumberId, apiVersion? }`; the permanent access token goes in `secret` (same AES-256-GCM encryption). Then `POST /providers/:id/channels` with `{ "channel": "WHATSAPP" }`. The registry builds a `WhatsAppCloudAdapter` (raw fetch to `graph.facebook.com`). Recipients need `phone` in E.164 (`+573001234567`). **Template convention for `channel=WHATSAPP` versions:** `subject` = Meta HSM template name (e.g. `order_created_es`) → sends `type: "template"` with ordered params extracted/rendered from `body` `{{vars}}` + `notification.data`; `subject: null` → free text (`type: "text"`, session window ≤24h). `language` must match the Meta template language code exactly. Status webhooks (`sent`/`delivered`/`failed`) arrive at `GET/POST /webhooks/whatsapp` (verify token `WHATSAPP_VERIFY_TOKEN`, optional HMAC `WHATSAPP_APP_SECRET`) and update the delivery by `provider_message_id` (wamid).

### Preferences (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| PUT | `/preferences/:userId` | Bearer | Set preferences |
| GET | `/preferences/:userId` | Bearer | Get preferences |

### Devices (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/devices` | Bearer | Register device |
| DELETE | `/devices/:token` | Bearer | Unregister device |

### Deliveries (Protected)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/deliveries/:id/retry` | Bearer | Retry failed delivery |

### Webhooks (Public)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/webhooks/whatsapp` | Public (verify token) | Meta handshake: echoes `hub.challenge` when `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN` |
| POST | `/webhooks/whatsapp` | Public (+ optional `X-Hub-Signature-256`) | WhatsApp status updates → delivery `SENT`/`DELIVERED`/`FAILED` by wamid |

### Health
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | Public | Health check |
| GET | `/health/providers` | Public | Provider status |

---

## Enums

```typescript
NotificationStatus: CREATED | QUEUED | PROCESSING | SENT | DELIVERED | FAILED
DeliveryStatus:    CREATED | QUEUED | PROCESSING | SENT | DELIVERED | FAILED | RETRYING
ChannelType:       EMAIL | SMS | PUSH | WHATSAPP | WEBHOOK | SLACK | TEAMS
RecipientType:     INTERNAL_USER | EXTERNAL_USER | EMAIL | PHONE
AttemptResult:     SUCCESS | TRANSIENT_ERROR | PERMANENT_ERROR
ProviderType:      SES | TWILIO | FCM | SENDGRID | INFOBIP | SMTP | WHATSAPP_CLOUD
EventType:         NOTIFICATION_CREATED | DELIVERY_QUEUED | ATTEMPT_STARTED | ATTEMPT_SUCCESS |
                   ATTEMPT_FAILED | DELIVERY_SENT | DELIVERY_DELIVERED | DELIVERY_FAILED | DLQ_ENTERED
Platform:          IOS | ANDROID | WEB
```

---

## State Machines

### Notification Status
```
CREATED → QUEUED → PROCESSING → SENT → DELIVERED
                                      ↘ FAILED
```

### Delivery Status
```
CREATED → QUEUED → PROCESSING → SENT → DELIVERED
                   ↗ RETRYING ↘  ↘ FAILED (webhook failure after send)
                                ↘ FAILED (→ Dead Letter Queue)
```

---

## Environment Variables

```env
PORT=8080
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/notifications
REDIS_URL=redis://localhost:6379
API_KEY='dev-api-key'
JWT_SECRET='dev-jwt-secret'
DEFAULT_LANGUAGE='es'
MAX_RETRY_ATTEMPTS='3'
RATE_LIMIT_PER_MINUTE='100'
# AES-256-GCM master key for provider secrets at rest (openssl rand -hex 32)
SECRETS_MASTER_KEY='<64-char-hex>'
# WhatsApp Cloud API
WHATSAPP_VERIFY_TOKEN='dev-whatsapp-verify-token'   # webhook handshake token
WHATSAPP_APP_SECRET=                                # optional: enables X-Hub-Signature-256 verification
# Legacy fallbacks (optional; prefer DB provider config)
WHATSAPP_ACCESS_TOKEN=                              # fallback token when no provider mapping
WHATSAPP_PHONE_NUMBER_ID=                           # fallback phoneNumberId
WHATSAPP_API_VERSION=v21.0
SES_REGION, SES_FROM_ADDRESS, SES_SECRET_REF
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
FCM_SERVICE_ACCOUNT_KEY
```

---

## Key Scripts

```bash
npm run build          # Build TypeScript
npm run start:dev      # Dev mode with watch
npm run lint           # ESLint + auto-fix
npm run migration:run  # Run TypeORM migrations
npm run test           # Run Jest tests
```

---

## Architecture Decisions

1. **Multi-tenant isolation:** Every business table has `tenant_id` FK with CASCADE delete
2. **Application scoping:** `notifications`, `templates`, `preferences`, `devices`, `events` have `application_id`
3. **Providers shared by tenant:** `notification_providers` are NOT per-app (tenant-level); active mapping per channel lives in `notification_provider_channels` and delivery channels resolve through `ProviderRegistry`
4. **Idempotency:** Unique constraint on `(tenant_id, application_id, idempotency_key)` prevents duplicate notifications
5. **Template versioning:** Each template supports multiple versions per language+channel, only 1 active at a time
6. **Secret management:** `client_secret` hashed with argon2id; provider secrets encrypted with AES-256-GCM (`SECRETS_MASTER_KEY` in .env) and stored as `enc:v1:<iv>:<tag>:<data>` in `notification_providers.secret_ref`; non-sensitive refs (ARN, env var name) stored plain
7. **Queue-based delivery:** BullMQ with Redis for async notification processing, retry with exponential backoff, dead letter queue for failed deliveries
8. **Dynamic provider resolution:** at send time each channel asks `ProviderRegistry` for the active provider of `(tenantId, channel)` (Redis cache `provider:{tenantId}:{channel}`, TTL 300s, invalidated on config save); no mapping → legacy env-based adapter fallback. `delivery.provider_id` records which provider was used
9. **WhatsApp (Meta Cloud API):** `WHATSAPP_CLOUD` provider + `WhatsappChannel`; HSM vs free-text selected by template version `subject` (Meta template name vs null); params rendered from `body` `{{vars}}` with `notification.data`; status correlation by wamid in `notification_deliveries.provider_message_id`; `notifications.language` (migración 0023) selects the active template version per language in the worker

---

## Migrations (23 total)

| # | Table | Purpose |
|---|-------|---------|
| 0001 | tenants | Create tenants |
| 0002 | notification_templates | Create templates |
| 0003 | notification_template_versions | Create template versions |
| 0004 | notifications | Create notifications |
| 0005 | notification_recipients | Create recipients |
| 0006 | notification_deliveries | Create deliveries |
| 0007 | notification_attempts | Create attempts |
| 0008 | notification_providers | Create providers |
| 0009 | notification_provider_channels | Create provider-channel mappings |
| 0010 | notification_preferences | Create preferences |
| 0011 | notification_devices | Create devices |
| 0012 | notification_events | Create events |
| 0013 | applications | Create applications |
| 0015 | notifications | Add application_id FK |
| 0016 | notification_templates | Add application_id FK |
| 0017 | notification_preferences | Add application_id FK |
| 0018 | notification_devices | Add application_id FK |
| 0019 | notification_events | Add application_id FK |
| 0021 | oauth_tokens | Create oauth_tokens (refresh tokens) |
| 0022 | oauth_tokens | Make application_id nullable (password grant) |
| 0023 | notifications | Add language column (NOT NULL, default 'es') |

---

## Pending / TODO

- [ ] MetricsModule exists but is NOT wired into AppModule
- [ ] Rate limit middleware exists but is NOT applied globally
- [ ] Correlation middleware exists but is NOT applied globally
- [ ] Notification findAll endpoint is a stub (no pagination implementation)
- [ ] Template activate endpoint doesn't pass tenantId to use-case
- [x] SMTP provider E2E send verified 2026-09-22 (delivery SENT, secret encrypted `enc:v1:`)
