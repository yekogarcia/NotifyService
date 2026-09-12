---

description: "Task list for notification service implementation"
---

# Tasks: Servicio de Notificaciones

**Input**: Design documents from `/specs/001-notification-service/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are included as the user explicitly requested testing tasks (Fase 12).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single project: `src/`, `tests/` at repository root
- Hexagonal architecture: `src/modules/{module}/domain|application|infrastructure|interfaces/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic NestJS structure

- [X] T001 Create NestJS project with `nest new` in repository root (`package.json`, `nest-cli.json`, `src/main.ts`, `src/app.module.ts`)
- [X] T002 Configure Fastify adapter in `src/main.ts` (replace Express with `@nestjs/platform-fastify`)
- [X] T003 [P] Configure TypeScript strict mode in `tsconfig.json` (`"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`)
- [X] T004 [P] Configure ESLint in `.eslintrc.js` with NestJS rules, no unjustified disables
- [X] T005 [P] Configure Prettier in `.prettierrc` (single quotes, 80 cols, trailing comma)
- [X] T006 Configure environment variables in `.env` and `src/shared/config/env.config.ts` (DATABASE_URL, REDIS_URL, PORT, API_KEY, JWT_SECRET)
- [X] T007 [P] Configure health checks in `src/modules/health/health.controller.ts` (GET /health endpoint)
- [X] T008 [P] Configure Swagger/OpenAPI in `src/main.ts` (SwaggerModule.setup at `/docs`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and domain model that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Infrastructure Base

- [X] T009 Configure PostgreSQL connection in `src/shared/config/database.config.ts` (TypeORM DataSource with env vars)
- [X] T010 Configure TypeORM module in `src/shared/infrastructure/database/database.module.ts` (NestJS TypeOrmModule.forRootAsync)
- [X] T011 Configure migration runner in `data-source.ts` (TypeORM DataSource for CLI migrations, `npm run migration:generate/run`)
- [X] T012 [P] Configure Redis connection in `src/shared/config/redis.config.ts` (ioredis with env vars)
- [X] T013 Configure BullMQ queue module in `src/shared/infrastructure/queue/queue.module.ts` (notification queue, retry queue, DLQ)
- [X] T014 [P] Create configuration module in `src/shared/config/config.module.ts` (validated env config via @nestjs/config)
- [X] T015 [P] Create structured JSON logger in `src/shared/infrastructure/logger/logger.service.ts` (Winston/pino with JSON format, correlationId support)
- [X] T016 Configure correlation/transaction ID middleware in `src/shared/infrastructure/middleware/correlation.middleware.ts` (generates X-Correlation-Id, propagates to all logs)

### Domain Model

- [X] T017 [P] Create Notification entity in `src/modules/notifications/domain/entities/notification.entity.ts` (id UUID PK, tenant_id UUID FK NOT NULL, source_system VARCHAR(255) NOT NULL, event_type VARCHAR(255) NOT NULL, template_code VARCHAR(255) NOT NULL, data JSONB NOT NULL default '{}', idempotency_key VARCHAR(255) NOT NULL, status VARCHAR(20) NOT NULL default 'CREATED', correlation_id UUID NOT NULL, event_id UUID NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL. Status: CREATED→QUEUED→PROCESSING→SENT→DELIVERED→FAILED. UNIQUE(tenant_id, idempotency_key))
- [X] T018 [P] Create NotificationRecipient entity in `src/modules/notifications/domain/entities/notification-recipient.entity.ts` (id UUID PK, notification_id UUID FK NOT NULL, recipient_type VARCHAR(20) NOT NULL [INTERNAL_USER|EXTERNAL_USER|EMAIL|PHONE], user_id VARCHAR(255) NULL, email VARCHAR(255) NULL, phone VARCHAR(20) NULL, created_at TIMESTAMPTZ NOT NULL. At least one of user_id/email/phone MUST be NOT NULL)
- [X] T019 [P] Create NotificationDelivery entity in `src/modules/notifications/domain/entities/notification-delivery.entity.ts` (id UUID PK, notification_id UUID FK NOT NULL, recipient_id UUID FK NOT NULL, channel VARCHAR(20) NOT NULL, provider_id UUID FK NULL, status VARCHAR(20) NOT NULL default 'CREATED', attempt_count INT NOT NULL default 0, max_attempts INT NOT NULL default 3, provider_message_id VARCHAR(255) NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL. Status: CREATED→QUEUED→PROCESSING→SENT→DELIVERED→FAILED→RETRYING)
- [X] T020 [P] Create NotificationAttempt entity in `src/modules/notifications/domain/entities/notification-attempt.entity.ts` (id UUID PK, delivery_id UUID FK NOT NULL, attempt_number INT NOT NULL, result VARCHAR(20) NOT NULL [SUCCESS|TRANSIENT_ERROR|PERMANENT_ERROR], provider_message_id VARCHAR(255) NULL, error_type VARCHAR(100) NULL, error_message TEXT NULL, attempted_at TIMESTAMPTZ NOT NULL. UNIQUE(delivery_id, attempt_number))
- [X] T021 [P] Create Template entity in `src/modules/templates/domain/entities/template.entity.ts` (id UUID PK, tenant_id UUID FK NOT NULL, code VARCHAR(255) NOT NULL, description TEXT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL. UNIQUE(tenant_id, code))
- [X] T022 [P] Create TemplateVersion entity in `src/modules/templates/domain/entities/template-version.entity.ts` (id UUID PK, template_id UUID FK NOT NULL, version INT NOT NULL, language VARCHAR(10) NOT NULL, channel VARCHAR(20) NOT NULL, subject TEXT NULL, body TEXT NOT NULL, is_active BOOLEAN NOT NULL default false, created_at TIMESTAMPTZ NOT NULL, activated_at TIMESTAMPTZ NULL. UNIQUE(template_id, version, language, channel). PARTIAL UNIQUE INDEX(template_id, language, channel) WHERE is_active=true)
- [X] T023 [P] Create Provider entity in `src/modules/providers/domain/entities/provider.entity.ts` (id UUID PK, tenant_id UUID FK NOT NULL, name VARCHAR(100) NOT NULL, provider_type VARCHAR(50) NOT NULL, config JSONB NOT NULL default '{}', secret_ref VARCHAR(255) NOT NULL, is_active BOOLEAN NOT NULL default true, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL)
- [X] T024 [P] Create domain enums in `src/modules/notifications/domain/enums/` (NotificationStatus, DeliveryStatus, ChannelType, RecipientType, AttemptResult, ProviderType)
- [X] T025 [P] Create value objects in `src/modules/notifications/domain/value-objects/` (NotificationId, TenantId, IdempotencyKey, CorrelationId, SourceSystem, EventType, TemplateCode)

### Persistence

- [X] T026 Create tenants migration in `migrations/0001-create-tenants.ts` (id UUID PK gen_random_uuid(), name VARCHAR(255) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE, is_active BOOLEAN NOT NULL default true, created_at/updated_at TIMESTAMPTZ NOT NULL)
- [X] T027 [P] Create notification_templates migration in `migrations/0002-create-notification-templates.ts` (UNIQUE(tenant_id, code))
- [X] T028 [P] Create template_versions migration in `migrations/0003-create-template-versions.ts` (UNIQUE(template_id, version, language, channel), PARTIAL UNIQUE INDEX(template_id, language, channel) WHERE is_active=true)
- [X] T029 [P] Create notifications migration in `migrations/0004-create-notifications.ts` (UNIQUE(tenant_id, idempotency_key), INDEX(tenant_id, status), INDEX(tenant_id, created_at))
- [X] T030 [P] Create notification_recipients migration in `migrations/0005-create-notification-recipients.ts` (INDEX(notification_id), CHECK constraint: at least one of user_id/email/phone NOT NULL)
- [X] T031 [P] Create notification_deliveries migration in `migrations/0006-create-notification-deliveries.ts` (INDEX(notification_id), INDEX(status), INDEX(recipient_id, channel))
- [X] T032 [P] Create notification_attempts migration in `migrations/0007-create-notification-attempts.ts` (INDEX(delivery_id), UNIQUE(delivery_id, attempt_number))
- [X] T033 [P] Create notification_providers migration in `migrations/0008-create-notification-providers.ts` (INDEX(tenant_id, provider_type))
- [X] T034 [P] Create notification_provider_channels migration in `migrations/0009-create-provider-channels.ts` (UNIQUE(tenant_id, channel) WHERE is_active=true)
- [X] T035 [P] Create notification_preferences migration in `migrations/0010-create-notification-preferences.ts` (UNIQUE(tenant_id, user_id, channel))
- [X] T036 [P] Create notification_devices migration in `migrations/0011-create-notification-devices.ts` (INDEX(tenant_id, user_id), UNIQUE(tenant_id, device_token))
- [X] T037 [P] Create notification_events migration in `migrations/0012-create-notification-events.ts` (INDEX(notification_id), INDEX(correlation_id), INDEX(tenant_id, created_at))
- [X] T038 Create repository interfaces in `src/modules/notifications/domain/repositories/` (NotificationRepository, DeliveryRepository, AttemptRepository — port interfaces, NOT implementations)
- [X] T039 Create TypeORM repository implementations in `src/modules/notifications/infrastructure/persistence/` (notification.repository.impl.ts, delivery.repository.impl.ts, attempt.repository.impl.ts)

**Checkpoint**: Foundation ready — database schema, domain entities, repositories, queue infra, logging. User story implementation can now begin.

---

## Phase 3: User Story 1 — Solicitar Notificación vía API (Priority: P1) [MVP]

**Goal**: External systems can request notifications via authenticated API and receive 202 Accepted immediately.

**Independent Test**: Send HTTP POST with valid credentials and payload → API responds 202, notification persisted in QUEUED status.

### Implementation for User Story 1

- [X] T040 [P] [US1] Create CreateNotificationDTO in `src/modules/notifications/application/dto/create-notification.dto.ts` (sourceSystem: string, eventType: string, idempotencyKey: string, recipient OR recipients: RecipientDTO[], channels: ChannelType[], templateCode: string, language?: string, data?: Record<string, any>. Use class-validator decorators: @IsString, @IsNotEmpty, @IsArray, @ValidateNested)
- [X] T041 [P] [US1] Create recipient validation in `src/modules/notifications/application/use-cases/create-notification/validate-recipients.ts` (validate recipient_type is one of INTERNAL_USER|EXTERNAL_USER|EMAIL|PHONE, at least one of userId/email/phone provided per recipient)
- [X] T042 [P] [US1] Create template validation in `src/modules/notifications/application/use-cases/create-notification/validate-template.ts` (verify template exists for templateCode, has active version for requested channels and language)
- [X] T043 [US1] Implement idempotency check in `src/modules/notifications/application/use-cases/create-notification/idempotency-check.ts` (query by tenant_id + idempotency_key; if exists, return existing notification with idempotent=true. Relies on UNIQUE(tenant_id, idempotency_key) constraint)
- [X] T044 [US1] Create CreateNotificationUseCase in `src/modules/notifications/application/use-cases/create-notification/create-notification.use-case.ts` (orchestrates: validate DTO → check idempotency → validate template → validate recipients → create notification entity → create deliveries → persist in transaction → enqueue jobs → return 202. Depends on T040-T043)
- [X] T045 [US1] Create NotificationController in `src/modules/notifications/interfaces/controllers/notification.controller.ts` (POST /api/v1/notifications → 202 Accepted with notificationId, status, correlationId. GET /api/v1/notifications/:id → 200 with notification + deliveries + attempts. @ApiTags, @ApiResponse decorators for Swagger)
- [X] T046 [US1] Create unit tests in `tests/unit/notifications/create-notification.spec.ts` (test happy path, validation errors, idempotent duplicate returns existing)

**Checkpoint**: User Story 1 (MVP) complete — notifications can be created via API with 202 response and idempotency.

---

## Phase 4: User Story 2 — Procesamiento Asíncrono (Priority: P1)

**Goal**: Workers consume queued jobs and deliver notifications through provider adapters without blocking the API.

**Independent Test**: Create notification → API returns 202 before provider processes → worker eventually processes delivery → status transitions QUEUED→PROCESSING→SENT/FAILED.

### Implementation for User Story 2

- [X] T047 [P] [US2] Create NotificationChannel interface in `src/modules/deliveries/domain/channel.interface.ts` (send(delivery, renderedContent): Promise<SendResult>)
- [X] T048 [P] [US2] Create EmailProvider port interface in `src/modules/providers/domain/email-provider.interface.ts` (sendEmail(to, subject, body): Promise<ProviderResult>)
- [X] T049 [P] [US2] Create SmsProvider port interface in `src/modules/providers/domain/sms-provider.interface.ts` (sendSms(to, body): Promise<ProviderResult>)
- [X] T050 [P] [US2] Create PushProvider port interface in `src/modules/providers/domain/push-provider.interface.ts` (sendPush(deviceToken, title, body): Promise<ProviderResult>)
- [X] T051 [P] [US2] Create SES adapter in `src/modules/providers/infrastructure/adapters/ses.adapter.ts` (implements EmailProvider, uses @aws-sdk/client-ses, reads secret_ref for credentials)
- [X] T052 [P] [US2] Create Twilio adapter in `src/modules/providers/infrastructure/adapters/twilio.adapter.ts` (implements SmsProvider, uses twilio SDK, reads secret_ref for credentials)
- [X] T053 [P] [US2] Create FCM adapter in `src/modules/providers/infrastructure/adapters/fcm.adapter.ts` (implements PushProvider, uses firebase-admin, reads secret_ref for credentials)
- [X] T054 [P] [US2] Create EmailChannel in `src/modules/deliveries/infrastructure/channels/email.channel.ts` (implements NotificationChannel, resolves EmailProvider from registry, calls sendEmail)
- [X] T055 [P] [US2] Create SmsChannel in `src/modules/deliveries/infrastructure/channels/sms.channel.ts` (implements NotificationChannel, resolves SmsProvider, calls sendSms)
- [X] T056 [P] [US2] Create PushChannel in `src/modules/deliveries/infrastructure/channels/push.channel.ts` (implements NotificationChannel, resolves PushProvider, calls sendPush)
- [X] T057 [US2] Create ChannelRegistry in `src/modules/deliveries/application/channel-registry.ts` (maps ChannelType → NotificationChannel instance. Depends on T054-T056)
- [X] T058 [US2] Create DeliveryDispatcher in `src/modules/deliveries/application/delivery-dispatcher.ts` (resolves channel from registry, renders template, calls channel.send, persists attempt, updates delivery status. Depends on T057)
- [X] T059 [US2] Create DeliveryWorker in `src/modules/deliveries/infrastructure/workers/delivery.worker.ts` (BullMQ Worker consumer: receives job → calls DeliveryDispatcher → handles result. Depends on T058)
- [X] T060 [US2] Create delivery status state machine in `src/modules/deliveries/domain/delivery-status.ts` (valid transitions: CREATED→QUEUED→PROCESSING→SENT→DELIVERED, PROCESSING→RETRYING→PROCESSING, PROCESSING→FAILED)

**Checkpoint**: User Story 2 complete — workers process deliveries asynchronously through provider adapters.

---

## Phase 5: User Story 4 — Reintentos Automáticos (Priority: P1)

**Goal**: Failed deliveries retry automatically with exponential backoff, classify errors, and route to DLQ after max attempts.

**Independent Test**: Mock provider returns HTTP 500 → delivery marked RETRYING → multiple attempts with increasing delay → after max attempts, delivery enters DLQ as FAILED.

### Implementation for User Story 4

- [X] T061 [P] [US4] Create RetryPolicy in `src/modules/deliveries/domain/retry-policy.ts` (maxAttempts: number default 3, shouldRetry(error): boolean based on error classification)
- [X] T062 [P] [US4] Create error classifier in `src/modules/deliveries/domain/error-classifier.ts` (HTTP 5xx/timeout → TRANSIENT_ERROR, HTTP 4xx → PERMANENT_ERROR, provider-specific: email bounce → PERMANENT_ERROR)
- [X] T063 [P] [US4] Create backoff strategy in `src/modules/deliveries/domain/backoff-strategy.ts` (exponential: delay = base * 2^attempt, base=1000ms, max=30000ms)
- [X] T064 [US4] Implement retry handler in `src/modules/deliveries/application/retry-handler.ts` (on TRANSIENT_ERROR: increment attempt_count, schedule retry with backoff via BullMQ delayed job. On PERMANENT_ERROR: mark FAILED immediately. Depends on T061-T063)
- [X] T065 [US4] Implement Dead Letter Queue in `src/modules/deliveries/infrastructure/dlq/dead-letter-queue.ts` (when attempt_count >= max_attempts and last attempt fails: move job to DLQ, mark delivery FAILED, log with correlation IDs)
- [X] T066 [US4] Implement attempt persistence in `src/modules/deliveries/infrastructure/persistence/attempt.repository.impl.ts` (persist each attempt with attempt_number, result, provider_message_id, error_type, error_message, attempted_at)
- [X] T067 [US4] Create manual retry endpoint in `src/modules/deliveries/interfaces/controllers/delivery.controller.ts` (POST /api/v1/deliveries/:id/retry → re-enqueue delivery job, reset status to QUEUED)

**Checkpoint**: User Story 4 complete — transient errors retry with backoff, permanent errors fail fast, DLQ catches exhausted retries.

---

## Phase 6: User Story 5 — Configurar Plantillas (Priority: P2)

**Goal**: Administrators can create, version, and activate templates with per-channel, per-language content and variable rendering.

**Independent Test**: Create template with `{{reservationCode}}` → request notification with data → delivered content contains rendered value.

### Implementation for User Story 5

- [X] T068 [P] [US5] Create CreateTemplateUseCase in `src/modules/templates/application/use-cases/create-template.use-case.ts` (create template + initial versions in transaction)
- [X] T069 [P] [US5] Create UpdateTemplateVersionUseCase in `src/modules/templates/application/use-cases/update-template-version.use-case.ts` (activate/deactivate version; deactivating activates no other automatically — admin must activate another. Enforce PARTIAL UNIQUE INDEX(template_id, language, channel) WHERE is_active=true)
- [X] T070 [P] [US5] Create GetTemplateUseCase in `src/modules/templates/application/use-cases/get-template.use-case.ts` (fetch template with active versions, filter by language/channel)
- [X] T071 [P] [US5] Create TemplateRenderer in `src/modules/templates/application/template-renderer.ts` (interface: render(template, data): string)
- [X] T072 [US5] Integrate Handlebars in `src/modules/templates/infrastructure/handlebars-renderer.ts` (implements TemplateRenderer, compiles template body, interpolates {{variables}} from data payload. Depends on T071)
- [X] T073 [US5] Create variable validation in `src/modules/templates/application/validate-variables.ts` (extract {{var}} from template, check all present in data payload; missing vars → log warning, leave placeholder or use default)
- [X] T074 [P] [US5] Create locale resolver in `src/modules/templates/application/locale-resolver.ts` (resolve template version by language; fallback to tenant default language if requested language not available)
- [X] T075 [US5] Create template endpoints in `src/modules/templates/interfaces/controllers/template.controller.ts` (POST /api/v1/templates, PATCH /api/v1/templates/:code/versions/:version/activate, GET /api/v1/templates/:code. Swagger decorators)

**Checkpoint**: User Story 5 complete — templates are created, versioned, activated, and rendered with variables.

---

## Phase 7: User Story 6 — Consultar Entregas y Auditoría (Priority: P2)

**Goal**: Operators can trace any notification from request to delivery, including who requested, what event, provider used, attempts, and failure reasons.

**Independent Test**: Process a notification → query GET /notifications/:id → response includes full delivery chain with attempts and audit data.

### Implementation for User Story 6

- [X] T076 [P] [US6] Create notification-scoped logger in `src/shared/infrastructure/logger/notification-logger.ts` (log with notificationId, sourceSystem, eventType as structured fields)
- [X] T077 [P] [US6] Create delivery-scoped logger in `src/shared/infrastructure/logger/delivery-logger.ts` (log with deliveryId, channel, provider, providerMessageId)
- [X] T078 [US6] Enhance correlation ID propagation in `src/shared/infrastructure/middleware/correlation.middleware.ts` (propagate correlationId, eventId, notificationId, deliveryId, providerMessageId through API → worker → provider calls. OpenTelemetry context propagation)
- [X] T079 [P] [US6] Create delivery metrics in `src/shared/infrastructure/metrics/delivery-metrics.ts` (counters: deliveries_sent, deliveries_failed, deliveries_retried; histograms: delivery_duration. OpenTelemetry instruments)
- [X] T080 [P] [US6] Create error metrics in `src/shared/infrastructure/metrics/error-metrics.ts` (counters: errors_by_type, errors_by_provider; labels: errorType, provider, channel)
- [X] T081 [US6] Add provider health checks in `src/modules/health/health.controller.ts` (extend GET /health to check provider connectivity: SES, Twilio, FCM. Return per-provider status)
- [X] T082 [P] [US6] Create notification query endpoint in `src/modules/notifications/interfaces/controllers/notification.controller.ts` (extend GET /api/v1/notifications/:id to include deliveries[].attempts[] with provider, result, errorType, errorMessage. Add GET /api/v1/notifications with pagination + filters: status, sourceSystem, page, limit)
- [X] T083 [P] [US6] Create notification_events persistence in `src/modules/notifications/infrastructure/persistence/event.repository.impl.ts` (persist to notification_events table on every state transition: NOTIFICATION_CREATED, DELIVERY_QUEUED, ATTEMPT_STARTED, ATTEMPT_SUCCESS, ATTEMPT_FAILED, DELIVERY_SENT, DELIVERY_DELIVERED, DELIVERY_FAILED, DLQ_ENTERED)

**Checkpoint**: User Story 6 complete — full audit trail and observability for all notification operations.

---

## Phase 8: User Story 7 — Gestionar Canales y Proveedores (Priority: P2)

**Goal**: Administrators can configure which providers handle which channels, and swap providers without touching domain code.

**Independent Test**: Change EMAIL provider from SES to SendGrid → new deliveries use SendGrid → no changes in domain/application layers.

### Implementation for User Story 7

- [X] T084 [US7] Create ProviderRegistry in `src/modules/providers/application/provider-registry.ts` (maps provider_type → adapter instance. Resolves provider for (tenant_id, channel) from notification_provider_channels. Cache in Redis with TTL. Depends on T051-T053)
- [X] T085 [US7] Create provider configuration endpoints in `src/modules/providers/interfaces/controllers/provider.controller.ts` (POST /api/v1/providers — create provider with secret_ref. PUT /api/v1/providers/:id — update config. POST /api/v1/providers/:id/channels — map provider to channel. Enforce UNIQUE(tenant_id, channel) WHERE is_active=true)
- [X] T086 [P] [US7] Create SendGrid adapter in `src/modules/providers/infrastructure/adapters/sendgrid.adapter.ts` (implements EmailProvider — demonstrates provider swap without domain changes)
- [X] T087 [P] [US7] Create Infobip adapter in `src/modules/providers/infrastructure/adapters/infobip.adapter.ts` (implements SmsProvider — demonstrates provider swap from Twilio)

**Checkpoint**: User Story 7 complete — providers are configurable and swappable per channel via admin API.

---

## Phase 9: User Story 8 — Preferencias de Usuario (Priority: P3)

**Goal**: Users can configure channel preferences (ON/OFF) and the system respects them when creating deliveries.

**Independent Test**: Set user preferences (SMS: OFF) → request notification with [EMAIL, SMS] → only EMAIL delivery created.

### Implementation for User Story 8

- [X] T088 [P] [US8] Create NotificationPreference entity in `src/modules/preferences/domain/entities/preference.entity.ts` (id UUID PK, tenant_id UUID FK NOT NULL, user_id VARCHAR(255) NOT NULL, channel VARCHAR(20) NOT NULL, enabled BOOLEAN NOT NULL default true. UNIQUE(tenant_id, user_id, channel))
- [X] T089 [P] [US8] Create Device entity in `src/modules/preferences/domain/entities/device.entity.ts` (id UUID PK, tenant_id UUID FK NOT NULL, user_id VARCHAR(255) NOT NULL, device_token VARCHAR(500) NOT NULL, platform VARCHAR(20) NOT NULL [IOS|ANDROID|WEB], is_active BOOLEAN NOT NULL default true. UNIQUE(tenant_id, device_token))
- [X] T090 [US8] Create PreferenceResolver in `src/modules/preferences/application/preference-resolver.ts` (for a given user_id and channels: fetch preferences, default to enabled=true if no preference exists, return filtered channel list)
- [X] T091 [US8] Create preference endpoints in `src/modules/preferences/interfaces/controllers/preference.controller.ts` (PUT /api/v1/preferences/:userId — set channel preferences. GET /api/v1/preferences/:userId — get current preferences)
- [X] T092 [US8] Create device registration endpoints in `src/modules/preferences/interfaces/controllers/device.controller.ts` (POST /api/v1/devices — register device token. DELETE /api/v1/devices/:token — unregister)
- [X] T093 [US8] Apply preferences in create-notification flow in `src/modules/notifications/application/use-cases/create-notification/apply-preferences.ts` (after validating channels, before creating deliveries: resolve preferences per recipient, filter out disabled channels. If all channels disabled for a recipient, skip that recipient with log)

**Checkpoint**: User Story 8 complete — user preferences are respected, device tokens are managed.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Testing, security hardening, and final validation across all user stories

- [X] T094 [P] Create unit tests for domain entities and value objects in `tests/unit/notifications/` and `tests/unit/deliveries/`
- [X] T095 [P] Create unit tests for use cases in `tests/unit/notifications/create-notification.spec.ts` (happy path, validation errors, idempotency, template not found, invalid channels)
- [X] T096 [P] Create integration tests for repository layer in `tests/integration/repositories/` (NotificationRepository, DeliveryRepository, AttemptRepository with test PostgreSQL)
- [X] T097 [P] Create integration tests for queue/worker in `tests/integration/queue/` (enqueue job → worker consumes → delivery processed, retry with backoff, DLQ after max attempts)
- [X] T098 [P] Create unit tests for provider adapters in `tests/unit/providers/` (SES, Twilio, FCM with mocked SDKs — verify adapter calls provider correctly, maps responses)
- [X] T099 Create idempotency integration tests in `tests/integration/idempotency/idempotency.spec.ts` (send same request twice concurrently → only one notification created, both get same response)
- [X] T100 Create retry integration tests in `tests/integration/retry/retry.spec.ts` (transient error → retries with backoff → eventually succeeds; permanent error → immediate FAILED; max attempts → DLQ)
- [X] T101 Create E2E tests in `tests/e2e/notification-flow.e2e-spec.ts` (full flow: create notification → 202 → worker processes → delivery sent → query notification → see deliveries + attempts + audit trail. Run quickstart.md scenarios)
- [X] T102 [P] Add rate limiting middleware in `src/shared/infrastructure/middleware/rate-limit.middleware.ts` (per-tenant rate limit on POST /notifications, configurable via env)
- [X] T103 [P] Add API Key / JWT authentication guard in `src/shared/infrastructure/guards/auth.guard.ts` (validate X-API-Key or Authorization Bearer token, extract tenant_id from credentials)
- [X] T104 Run quickstart.md validation scenarios and verify all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Phase 3) can start after Foundational — no dependencies on other stories
  - US2 (Phase 4) depends on US1 (needs notification + deliveries persisted to process)
  - US4 (Phase 5) depends on US2 (retry is part of the delivery worker flow)
  - US5 (Phase 6) can start after Foundational — independent (templates are standalone)
  - US6 (Phase 7) depends on US2 (needs deliveries/attempts to query)
  - US7 (Phase 8) depends on US2 (needs provider adapters to exist)
  - US8 (Phase 9) depends on US1 (preferences applied during notification creation)
- **Polish (Phase 10)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Foundational only — MVP entry point
- **US2 (P1)**: Foundational + US1 (processes what US1 creates)
- **US4 (P1)**: Foundational + US2 (retries what US2 delivers)
- **US5 (P2)**: Foundational only — independent
- **US6 (P2)**: Foundational + US2 (queries what US2 produces)
- **US7 (P2)**: Foundational + US2 (configures providers US2 uses)
- **US8 (P3)**: Foundational + US1 (filters channels during US1 flow)

### Within Each User Story

- Models/entities before services
- Interfaces/ports before adapter implementations
- Use cases before controllers
- Core implementation before integration

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T003-T008)
- All Foundational entity tasks marked [P] can run in parallel (T017-T025)
- All migration tasks marked [P] can run in parallel (T027-T037)
- US2: Provider interfaces (T048-T050) and adapters (T051-T053) and channels (T054-T056) all parallel
- US5: Template use cases (T068-T071) parallel, renderer integration sequential
- US6: Loggers and metrics (T076-T080) all parallel
- US7: Additional adapters (T086-T087) parallel
- US8: Entity creation (T088-T089) parallel
- Polish: Unit/integration/provider tests (T094-T098) all parallel

---

## Parallel Example: User Story 2

```bash
# Launch all provider interfaces together:
Task: "Create EmailProvider port in src/modules/providers/domain/email-provider.interface.ts"
Task: "Create SmsProvider port in src/modules/providers/domain/sms-provider.interface.ts"
Task: "Create PushProvider port in src/modules/providers/domain/push-provider.interface.ts"

# Launch all provider adapters together:
Task: "Create SES adapter in src/modules/providers/infrastructure/adapters/ses.adapter.ts"
Task: "Create Twilio adapter in src/modules/providers/infrastructure/adapters/twilio.adapter.ts"
Task: "Create FCM adapter in src/modules/providers/infrastructure/adapters/fcm.adapter.ts"

# Launch all channel implementations together:
Task: "Create EmailChannel in src/modules/deliveries/infrastructure/channels/email.channel.ts"
Task: "Create SmsChannel in src/modules/deliveries/infrastructure/channels/sms.channel.ts"
Task: "Create PushChannel in src/modules/deliveries/infrastructure/channels/push.channel.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T039) — CRITICAL, blocks all stories
3. Complete Phase 3: User Story 1 (T040-T046)
4. **STOP and VALIDATE**: POST /notifications → 202 + idempotency works
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test independently → MVP! (notifications created via API)
3. Add US2 → Test independently → Workers deliver through providers
4. Add US4 → Test independently → Retries with backoff + DLQ
5. Add US5 → Test independently → Templates render variables
6. Add US6 → Test independently → Full audit trail queryable
7. Add US7 → Test independently → Providers swappable via admin API
8. Add US8 → Test independently → User preferences respected
9. Polish → All tests pass, security hardened, quickstart validated

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (notification creation) → then US2 (async processing)
   - Developer B: US5 (templates) — independent, can start immediately
3. After US2 completes:
   - Developer A: US4 (retries) → then US6 (observability)
   - Developer C: US7 (provider management) → then US8 (preferences)
4. All converge for Polish phase

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- US3 (Idempotency) is satisfied by T043 within US1 — idempotency is integral to notification creation
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All tasks include file paths per the hexagonal architecture structure from plan.md
- Data model constraints from data-model.md are quoted verbatim in entity/migration tasks
