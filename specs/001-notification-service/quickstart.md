# Quickstart: Servicio de Notificaciones

**Date**: 2026-09-11 | **Feature**: 001-notification-service

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (for local infra)

## Setup

1. Start local infrastructure:

```bash
docker compose up -d postgres redis
```

2. Install dependencies:

```bash
npm install
```

3. Run migrations:

```bash
npm run migration:run
```

4. Seed initial data (tenant, providers, template):

```bash
npm run seed
```

5. Start the application (API + workers):

```bash
npm run start:dev
```

API available at `http://localhost:3000/api/v1`
Swagger UI at `http://localhost:3000/docs`

## Validation Scenarios

### Scenario 1: Create Notification (Happy Path)

**Validates**: FR-001, FR-002, FR-006, FR-007, SC-001

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "X-API-Key: test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "hotel-pms",
    "eventType": "reservation.confirmed",
    "idempotencyKey": "res-1001",
    "recipient": { "userId": "user_123" },
    "channels": ["EMAIL", "PUSH"],
    "templateCode": "reservation.confirmed",
    "language": "es",
    "data": { "reservationCode": "RES-1001", "guestName": "Juan" }
  }'
```

**Expected**: HTTP 202 with `notificationId` and `status: "QUEUED"`.

### Scenario 2: Idempotency (Duplicate Request)

**Validates**: FR-013, FR-014, SC-004

Send the same request twice with the same `idempotencyKey`.

**Expected**: Both responses return the same `notificationId`. Only one
notification exists in the database.

### Scenario 3: Async Processing

**Validates**: FR-006, FR-007, FR-008

After Scenario 1, poll the notification status:

```bash
curl http://localhost:3000/api/v1/notifications/{notificationId} \
  -H "X-API-Key: test-key"
```

**Expected**: Status transitions from QUEUED → PROCESSING → SENT/DELIVERED
(or FAILED if provider is mocked to fail).

### Scenario 4: Retry on Transient Failure

**Validates**: FR-009, FR-010, FR-012

Configure a mock provider to return HTTP 500. Create a notification.

**Expected**: Delivery status goes to RETRYING. Multiple attempts are
recorded with increasing delay (backoff). After max attempts, delivery
moves to FAILED and enters Dead Letter Queue.

### Scenario 5: Permanent Error (No Retry)

**Validates**: FR-012

Configure a mock provider to return HTTP 400 (invalid email). Create a
notification.

**Expected**: Delivery immediately marked FAILED. Only 1 attempt recorded.
No retry scheduled.

### Scenario 6: User Preferences

**Validates**: FR-020, FR-021

Set user preferences (SMS: OFF), then request a notification with
channels ["EMAIL", "SMS"].

**Expected**: Only EMAIL delivery is created. SMS is skipped.

### Scenario 7: Template Rendering

**Validates**: FR-017, FR-018, FR-019

Create a template with `{{reservationCode}}` variable. Request a
notification with `data: { "reservationCode": "RES-1001" }`.

**Expected**: Delivered content contains "RES-1001" (not the placeholder).

### Scenario 8: Audit Trail

**Validates**: FR-024, FR-025, SC-005

After processing a notification, query its detail endpoint.

**Expected**: Response includes sourceSystem, eventType, provider used,
attempt count, failure reasons, and all correlation IDs.

## Test Commands

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Contract tests
npm run test:contract

# All tests
npm run test
```

## References

- [Spec](./spec.md) — Feature requirements and acceptance criteria
- [Data Model](./data-model.md) — Entity definitions and relationships
- [API Contract](./contracts/notification-api.md) — Endpoint specifications
- [Research](./research.md) — Technical decision rationale
