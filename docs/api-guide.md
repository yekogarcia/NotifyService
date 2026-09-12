# Guía Paso a Paso — Consumir la API de NotitifyService

**Base URL**: `http://localhost:3000/api/v1`
**Swagger UI**: `http://localhost:3000/docs`
**Autenticación**: Header `X-API-Key: dev-api-key` (o `Authorization: Bearer <token>`)

---

## Prerrequisitos

### 1. Levantar infraestructura

```bash
docker compose up -d postgres redis
```

### 2. Instalar dependencias y migraciones

```bash
npm install
npm run migration:run
```

### 3. Iniciar la aplicación

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api/v1`.

---

## Paso 1 — Verificar que el servicio está activo

Antes de hacer cualquier operación, verifica que el servicio y sus
dependencias (PostgreSQL, Redis) estén funcionando.

```bash
curl http://localhost:3000/api/v1/health
```

**Respuesta esperada:**

```json
{
  "status": "healthy",
  "timestamp": "2026-09-11T10:00:00.000Z",
  "checks": {
    "database": "up",
    "redis": "up",
    "queue": "up"
  }
}
```

> Si alguno de los checks no es `up`, revisa que PostgreSQL y Redis
> estén corriendo.

---

## Paso 2 — Crear una plantilla de notificación

Las notificaciones requieren una plantilla activa. Una plantilla define
el contenido por canal e idioma, con variables que se renderizan desde
el `data` de la notificación.

```bash
curl -X POST http://localhost:3000/api/v1/templates \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default-tenant",
    "code": "reservation.confirmed",
    "description": "Confirmación de reserva",
    "versions": [
      {
        "version": 1,
        "language": "es",
        "channel": "EMAIL",
        "subject": "Confirmación de reserva {{reservationCode}}",
        "body": "Hola {{guestName}}, tu reserva {{reservationCode}} para el {{checkInDate}} ha sido confirmada.",
        "isActive": true
      },
      {
        "version": 1,
        "language": "es",
        "channel": "SMS",
        "body": "Tu reserva {{reservationCode}} está confirmada. Check-in: {{checkInDate}}",
        "isActive": true
      },
      {
        "version": 1,
        "language": "es",
        "channel": "PUSH",
        "body": "Reserva {{reservationCode}} confirmada",
        "isActive": true
      }
    ]
  }'
```

**Respuesta esperada (201 Created):**

```json
{
  "id": "uuid-del-template",
  "tenantId": "default-tenant",
  "code": "reservation.confirmed",
  "description": "Confirmación de reserva",
  "createdAt": "2026-09-11T10:00:01.000Z",
  "updatedAt": "2026-09-11T10:00:01.000Z"
}
```

> Las variables `{{reservationCode}}`, `{{guestName}}`, `{{checkInDate}}`
> se reemplazan con los valores del campo `data` al crear la notificación.

---

## Paso 3 — Activar una versión de plantilla

Si creaste una versión con `isActive: false`, necesitas activarla
explícitamente. Al activar una versión, las demás versiones activas
para el mismo canal e idioma se desactivan automáticamente.

```bash
curl -X PATCH "http://localhost:3000/api/v1/templates/reservation.confirmed/versions/1/activate?language=es&channel=EMAIL" \
  -H "X-API-Key: dev-api-key"
```

**Respuesta esperada (200 OK):**

```json
{
  "id": "uuid-version",
  "templateId": "uuid-del-template",
  "version": 1,
  "language": "es",
  "channel": "EMAIL",
  "isActive": true,
  "activatedAt": "2026-09-11T10:00:02.000Z"
}
```

> Repite este paso para cada canal (SMS, PUSH) si los creaste
> inactivos.

---

## Paso 4 — Configurar proveedores por canal

El sistema necesita saber qué proveedor usar para cada canal.
Inicialmente: EMAIL → SES, SMS → Twilio, PUSH → FCM.

### 4a. Crear proveedor SES (Email)

```bash
curl -X POST http://localhost:3000/api/v1/providers \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AWS SES",
    "providerType": "SES",
    "config": { "region": "us-east-1" },
    "secretRef": "SES_ACCESS_KEY"
  }'
```

### 4b. Crear proveedor Twilio (SMS)

```bash
curl -X POST http://localhost:3000/api/v1/providers \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Twilio",
    "providerType": "TWILIO",
    "config": { "from": "+15551234567" },
    "secretRef": "TWILIO_AUTH_TOKEN"
  }'
```

### 4c. Crear proveedor FCM (Push)

```bash
curl -X POST http://localhost:3000/api/v1/providers \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Firebase FCM",
    "providerType": "FCM",
    "config": {},
    "secretRef": "FCM_SERVICE_ACCOUNT_KEY"
  }'
```

### 4d. Mapear proveedor a canal

```bash
curl -X POST http://localhost:3000/api/v1/providers/<provider-id>/channels \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{ "channel": "EMAIL" }'
```

> Repite para SMS y PUSH con sus respectivos `provider-id`.

---

## Paso 5 — Configurar preferencias de usuario (opcional)

Si el usuario quiere desactivar canales específicos, configura sus
preferencias antes de enviar notificaciones.

```bash
curl -X PUT http://localhost:3000/api/v1/preferences/user_123 \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "preferences": [
      { "channel": "EMAIL", "enabled": true },
      { "channel": "SMS", "enabled": false },
      { "channel": "PUSH", "enabled": true }
    ]
  }'
```

**Respuesta esperada (200 OK):**

```json
{
  "userId": "user_123",
  "preferences": [
    { "channel": "EMAIL", "enabled": true },
    { "channel": "SMS", "enabled": false },
    { "channel": "PUSH", "enabled": true }
  ]
}
```

> Con esta configuración, si envías una notificación con canales
> `["EMAIL", "SMS", "PUSH"]` al usuario `user_123`, solo se entregarán
> por EMAIL y PUSH. SMS se omite.

---

## Paso 6 — Crear una notificación

Este es el endpoint principal. Un sistema externo solicita el envío de
una notificación. La API responde `202 Accepted` inmediatamente sin
esperar al proveedor.

### 6a. Notificación simple (un destinatario)

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "hotel-pms",
    "eventType": "reservation.confirmed",
    "idempotencyKey": "reservation-RES-1001",
    "recipient": {
      "recipientType": "INTERNAL_USER",
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
  }'
```

**Respuesta esperada (202 Accepted):**

```json
{
  "notificationId": "a1b2c3d4-...",
  "status": "QUEUED",
  "correlationId": "e5f6g7h8-...",
  "idempotent": false
}
```

> Guarda el `notificationId` para consultar el estado después.

### 6b. Notificación con múltiples destinatarios

```bash
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "hotel-pms",
    "eventType": "reservation.confirmed",
    "idempotencyKey": "reservation-RES-1002",
    "recipients": [
      { "recipientType": "INTERNAL_USER", "userId": "user_123" },
      { "recipientType": "EMAIL", "email": "invitado@example.com" },
      { "recipientType": "PHONE", "phone": "+34600000000" }
    ],
    "channels": ["EMAIL", "SMS"],
    "templateCode": "reservation.confirmed",
    "language": "es",
    "data": {
      "reservationCode": "RES-1002",
      "guestName": "María García",
      "checkInDate": "2026-09-20"
    }
  }'
```

### 6c. Tipos de destinatario disponibles

| `recipientType` | Campo requerido | Descripción |
|-----------------|-----------------|-------------|
| `INTERNAL_USER` | `userId` | Usuario interno del sistema |
| `EXTERNAL_USER` | `userId` | Usuario externo identificado |
| `EMAIL` | `email` | Email directo sin usuario |
| `PHONE` | `phone` | Teléfono directo sin usuario |

---

## Paso 7 — Consultar el estado de una notificación

Después de crear la notificación, el worker procesa las entregas
asíncronamente. Consulta el estado para ver el progreso.

```bash
curl http://localhost:3000/api/v1/notifications/a1b2c3d4-... \
  -H "X-API-Key: dev-api-key"
```

**Respuesta esperada (200 OK):**

```json
{
  "id": "a1b2c3d4-...",
  "sourceSystem": "hotel-pms",
  "eventType": "reservation.confirmed",
  "status": "PROCESSING",
  "templateCode": "reservation.confirmed",
  "data": {
    "reservationCode": "RES-1001",
    "guestName": "Juan Pérez",
    "checkInDate": "2026-09-15"
  },
  "createdAt": "2026-09-11T10:00:00.000Z",
  "updatedAt": "2026-09-11T10:00:01.000Z",
  "recipients": [
    {
      "id": "uuid-recipient",
      "recipientType": "INTERNAL_USER",
      "userId": "user_123"
    }
  ],
  "deliveries": [
    {
      "id": "uuid-delivery-1",
      "channel": "EMAIL",
      "status": "SENT",
      "attemptCount": 1,
      "maxAttempts": 3,
      "providerMessageId": "ses-msg-123",
      "attempts": [
        {
          "id": "uuid-attempt",
          "attemptNumber": 1,
          "result": "SUCCESS",
          "providerMessageId": "ses-msg-123",
          "errorType": null,
          "errorMessage": null,
          "attemptedAt": "2026-09-11T10:00:02.000Z"
        }
      ]
    },
    {
      "id": "uuid-delivery-2",
      "channel": "PUSH",
      "status": "RETRYING",
      "attemptCount": 2,
      "maxAttempts": 3,
      "attempts": [
        {
          "attemptNumber": 1,
          "result": "TRANSIENT_ERROR",
          "errorType": "PROVIDER_TIMEOUT",
          "errorMessage": "Request timed out",
          "attemptedAt": "2026-09-11T10:00:01.000Z"
        },
        {
          "attemptNumber": 2,
          "result": "TRANSIENT_ERROR",
          "errorType": "HTTP_500",
          "errorMessage": "Server error: 500",
          "attemptedAt": "2026-09-11T10:00:05.000Z"
        }
      ]
    }
  ]
}
```

### Estados de una notificación

```
CREATED → QUEUED → PROCESSING → SENT → DELIVERED
                                     ↘ FAILED
```

### Estados de una entrega

```
CREATED → QUEUED → PROCESSING → SENT → DELIVERED
                   ↗ RETRYING ↘
                                ↘ FAILED (→ Dead Letter Queue)
```

---

## Paso 8 — Listar notificaciones

Lista notificaciones con paginación y filtros.

```bash
curl "http://localhost:3000/api/v1/notifications?page=1&limit=50" \
  -H "X-API-Key: dev-api-key"
```

### Con filtros

```bash
curl "http://localhost:3000/api/v1/notifications?status=FAILED&page=1&limit=10" \
  -H "X-API-Key: dev-api-key"
```

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | int | 1 | Número de página |
| `limit` | int | 50 | Items por página (máx 100) |
| `status` | string | — | Filtrar por estado |
| `sourceSystem` | string | — | Filtrar por sistema origen |

---

## Paso 9 — Reintento manual de una entrega fallida

Si una entrega falló y agotó los reintentos automáticos, puedes
re-encolarla manualmente.

```bash
curl -X POST http://localhost:3000/api/v1/deliveries/<delivery-id>/retry \
  -H "X-API-Key: dev-api-key"
```

**Respuesta esperada (200 OK):**

```json
{
  "deliveryId": "uuid-delivery",
  "status": "QUEUED",
  "message": "Delivery re-queued for processing"
}
```

---

## Paso 10 — Probar idempotencia

Envía la misma solicitud dos veces con el mismo `idempotencyKey`.
El sistema debe retornar la misma notificación sin crear duplicados.

```bash
# Primera solicitud
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "hotel-pms",
    "eventType": "reservation.confirmed",
    "idempotencyKey": "reservation-RES-1001",
    "recipient": { "recipientType": "INTERNAL_USER", "userId": "user_123" },
    "channels": ["EMAIL"],
    "templateCode": "reservation.confirmed",
    "language": "es",
    "data": { "reservationCode": "RES-1001", "guestName": "Juan", "checkInDate": "2026-09-15" }
  }'
```

```bash
# Segunda solicitud (mismo idempotencyKey)
curl -X POST http://localhost:3000/api/v1/notifications \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceSystem": "hotel-pms",
    "eventType": "reservation.confirmed",
    "idempotencyKey": "reservation-RES-1001",
    "recipient": { "recipientType": "INTERNAL_USER", "userId": "user_123" },
    "channels": ["EMAIL"],
    "templateCode": "reservation.confirmed",
    "language": "es",
    "data": { "reservationCode": "RES-1001", "guestName": "Juan", "checkInDate": "2026-09-15" }
  }'
```

**Ambas respuestas retornan el mismo `notificationId`:**

```json
{
  "notificationId": "a1b2c3d4-...",
  "status": "QUEUED",
  "correlationId": "e5f6g7h8-...",
  "idempotent": true
}
```

> La segunda respuesta tiene `"idempotent": true` indicando que no se
> creó una nueva notificación.

---

## Paso 11 — Gestionar dispositivos (Push)

Registra tokens de dispositivos para enviar notificaciones PUSH.

### Registrar dispositivo

```bash
curl -X POST http://localhost:3000/api/v1/devices \
  -H "X-API-Key: dev-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "deviceToken": "fcm-token-abc123",
    "platform": "ANDROID"
  }'
```

### Eliminar dispositivo

```bash
curl -X DELETE http://localhost:3000/api/v1/devices/fcm-token-abc123 \
  -H "X-API-Key: dev-api-key"
```

---

## Paso 12 — Verificar salud de proveedores

```bash
curl http://localhost:3000/api/v1/health/providers \
  -H "X-API-Key: dev-api-key"
```

**Respuesta esperada:**

```json
{
  "ses": "up",
  "twilio": "up",
  "fcm": "up"
}
```

---

## Paso 13 — Explorar con Swagger UI

Abre en el navegador:

```
http://localhost:3000/docs
```

Desde Swagger puedes:
- Ver todos los endpoints con sus esquemas
- Probar cada endpoint interactivamente
- Autorizar con `X-API-Key: dev-api-key` (botón Authorize)

---

## Resumen del flujo completo

```
1. GET  /health                        → Verificar servicio
2. POST /templates                     → Crear plantilla
3. PATCH /templates/:code/versions/:v/activate → Activar versión
4. POST /providers                     → Configurar proveedores
5. POST /providers/:id/channels        → Mapear proveedor → canal
6. PUT  /preferences/:userId           → (Opcional) Configurar preferencias
7. POST /notifications                  → Crear notificación → 202
8. GET  /notifications/:id             → Consultar estado y entregas
9. GET  /notifications                  → Listar con filtros
10. POST /deliveries/:id/retry         → (Si falla) Reintento manual
```

---

## Códigos de respuesta

| Código | Significado | Cuándo |
|--------|-------------|--------|
| 202 | Accepted | Notificación creada y encolada |
| 200 | OK | Consulta exitosa, activación, retry |
| 201 | Created | Template o provider creado |
| 400 | Bad Request | Payload inválido o campos faltantes |
| 401 | Unauthorized | API Key o JWT inválido/ausente |
| 404 | Not Found | Recurso no existe |
| 429 | Too Many Requests | Rate limit excedido |
