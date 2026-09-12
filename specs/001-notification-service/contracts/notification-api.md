# API Contract: Notification Service

**Date**: 2026-09-11 | **Feature**: 001-notification-service

Base URL: `/api/v1`

Authentication: API Key header (`X-API-Key`) or Bearer JWT (`Authorization: Bearer <token>`)

All responses include `X-Correlation-Id` header for tracing.

---

## POST /notifications

Create a notification request. Returns 202 immediately; processing is async.

### Request

```json
{
  "sourceSystem": "hotel-pms",
  "eventType": "reservation.confirmed",
  "idempotencyKey": "reservation-RES-1001",
  "recipient": {
    "userId": "user_123"
  },
  "channels": ["EMAIL", "PUSH"],
  "templateCode": "reservation.confirmed",
  "language": "es",
  "data": {
    "reservationCode": "RES-1001",
    "guestName": "Juan Pérez",
    "checkInDate": "2026-09-15"
  }
}
```

**Multiple recipients**:

```json
{
  "recipients": [
    { "userId": "user_123" },
    { "email": "external@example.com" },
    { "phone": "+34600000000" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sourceSystem | string | YES | Requesting system identifier |
| eventType | string | YES | Event type (ej. reservation.confirmed) |
| idempotencyKey | string | YES | Deduplication key |
| recipient | object | NO* | Single recipient (mutually exclusive with `recipients`) |
| recipients | array | NO* | Multiple recipients |
| channels | string[] | YES | Delivery channels (EMAIL, SMS, PUSH) |
| templateCode | string | YES | Template code to render |
| language | string | NO | Locale (default: tenant default) |
| data | object | NO | Variables for template rendering |

*Exactly one of `recipient` or `recipients` MUST be present.

### Responses

**202 Accepted** — Notification persisted and queued:

```json
{
  "notificationId": "uuid",
  "status": "QUEUED",
  "correlationId": "uuid"
}
```

**202 Accepted** — Idempotent duplicate (existing notification returned):

```json
{
  "notificationId": "existing-uuid",
  "status": "QUEUED",
  "correlationId": "uuid",
  "idempotent": true
}
```

**400 Bad Request** — Validation error:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "channels must be a non-empty array",
  "details": [{ "field": "channels", "rule": "min_items", "value": 0 }]
}
```

**401 Unauthorized** — Missing or invalid credentials.

**429 Too Many Requests** — Rate limit exceeded.

---

## GET /notifications/{id}

Retrieve a notification with its deliveries and attempts.

### Response

**200 OK**:

```json
{
  "id": "uuid",
  "sourceSystem": "hotel-pms",
  "eventType": "reservation.confirmed",
  "status": "PROCESSING",
  "templateCode": "reservation.confirmed",
  "channels": ["EMAIL", "PUSH"],
  "createdAt": "2026-09-11T10:00:00Z",
  "deliveries": [
    {
      "id": "uuid",
      "channel": "EMAIL",
      "status": "SENT",
      "provider": "SES",
      "attemptCount": 1,
      "attempts": [
        {
          "attemptNumber": 1,
          "result": "SUCCESS",
          "providerMessageId": "ses-msg-123",
          "attemptedAt": "2026-09-11T10:00:02Z"
        }
      ]
    },
    {
      "id": "uuid",
      "channel": "PUSH",
      "status": "RETRYING",
      "provider": "FCM",
      "attemptCount": 2,
      "attempts": [
        {
          "attemptNumber": 1,
          "result": "TRANSIENT_ERROR",
          "errorType": "PROVIDER_TIMEOUT",
          "attemptedAt": "2026-09-11T10:00:01Z"
        },
        {
          "attemptNumber": 2,
          "result": "TRANSIENT_ERROR",
          "errorType": "PROVIDER_500",
          "attemptedAt": "2026-09-11T10:00:05Z"
        }
      ]
    }
  ]
}
```

**404 Not Found** — Notification does not exist or belongs to another tenant.

---

## GET /notifications

List notifications with pagination and filters.

### Query Parameters

| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by status |
| sourceSystem | string | Filter by source system |
| page | int | Page number (default 1) |
| limit | int | Items per page (default 50, max 100) |

### Response

**200 OK**:

```json
{
  "items": [{ "id": "uuid", "status": "QUEUED", "..." : "..." }],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

---

## POST /templates

Create a new template.

### Request

```json
{
  "code": "reservation.confirmed",
  "description": "Reservation confirmation notification",
  "versions": [
    {
      "version": 1,
      "language": "es",
      "channel": "EMAIL",
      "subject": "Confirmación de reserva {{reservationCode}}",
      "body": "Hola {{guestName}}, tu reserva {{reservationCode}}..."
    },
    {
      "version": 1,
      "language": "es",
      "channel": "SMS",
      "body": "Reserva {{reservationCode}} confirmada"
    }
  ]
}
```

### Response

**201 Created**: Template with versions.

---

## PATCH /templates/{code}/versions/{version}/activate

Activate a specific template version (deactivates others for same code/language/channel).

### Response

**200 OK**: Activated version.

---

## PUT /preferences/{userId}

Set channel preferences for a user.

### Request

```json
{
  "preferences": [
    { "channel": "EMAIL", "enabled": true },
    { "channel": "SMS", "enabled": false },
    { "channel": "PUSH", "enabled": true }
  ]
}
```

### Response

**200 OK**: Updated preferences.

---

## GET /health

Health check endpoint.

### Response

**200 OK**:

```json
{
  "status": "healthy",
  "checks": {
    "database": "up",
    "redis": "up",
    "queue": "up"
  }
}
```
