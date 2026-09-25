# NotifyService - Plan de Trabajo

> Memoria de planes para sesiones de OpenCode. Si la sesión se cierra, este archivo conserva el contexto.
>
> **Etiquetas:** `[PENDIENTE]` · `[EN PROGRESO]` · `[COMPLETADO]`
> Al terminar un plan moverlo a **Historial** y cambiar su etiqueta a `[COMPLETADO]`.

---

## Plan Activo

_(sin planes activos — ver Historial)_

---

## Historial

### [COMPLETADO] WhatsApp con Meta WhatsApp Cloud API (2026-09-23)

**Diseño final (confirmado por el usuario):**
- API: **Meta WhatsApp Cloud API** (fetch crudo a `graph.facebook.com`, sin SDK)
- Mensajes: **texto libre + Template HSM** — convención: en versiones de template con `channel=WHATSAPP`, `subject` = nombre de plantilla Meta aprobada (→ `type: "template"`), `subject: null` → texto libre (`type: "text"`)
- **Webhook de estados incluido en esta fase** (`GET/POST /api/v1/webhooks/whatsapp`)
- Migración `0023`: columna `notifications.language` (NOT NULL default `es`) — el worker filtra la versión activa por `(code, channel, language)`
- Validación: recipients WHATSAPP exigen `phone` E.164 (`^\+[1-9]\d{7,14}$`)
- Params HSM: extraídos en orden de `{{vars}}` del `body` local y renderizados con `notification.data` (el worker ahora renderiza — antes pasaba el template crudo)
- `delivery.provider_message_id` ahora **se escribe** en el dispatcher (antes solo en attempts) → correlación webhook por wamid
- State machine: `SENT → FAILED` habilitado (fallo reportado por webhook después del envío)

**Tareas:**
- [x] `ProviderType.WHATSAPP_CLOUD` + `WhatsAppProvider` interface (`sendText`/`sendTemplate`) + `WhatsAppCloudAdapter` (fetch, apiVersion default `v21.0`)
- [x] Case en `ProviderRegistry` → adapter con `accessToken` = `secret` descifrado; `phoneNumberId`/`apiVersion` en `config`
- [x] `WhatsappChannel` (subject → HSM, null → texto) + registro en `ChannelRegistry` + fallback env `'WhatsAppProvider'` en `DeliveriesModule`
- [x] `SendContext`/`RenderedContent` con `language?`/`templateParams?`
- [x] `DeliveryWorker`: render con `TemplateRenderer`, params HSM, filtro por `notification.language`, dirección WHATSAPP = `recipient.phone`
- [x] Migración 0023 + `NotificationEntity.language` + persistencia en `CreateNotificationUseCase`
- [x] `validateWhatsAppRecipients` (E.164) cuando el canal incluye WHATSAPP
- [x] `DeliveryRepository.updateProviderMessageId` + `findByProviderMessageId` + dispatcher
- [x] Webhook: `WhatsappWebhookController` (`@Public`, handshake plain-text, firma `X-Hub-Signature-256` opcional con `WHATSAPP_APP_SECRET`, `rawBody: true` en main) + `HandleWhatsappStatusUseCase` (mapa sent/delivered/failed, `read` = no-op, valida transiciones)
- [x] `.env`: `WHATSAPP_VERIFY_TOKEN` (+ vars fallback comentadas)
- [x] Tests: adapter (6), channel (5), webhook status (13), phone validation (4), `SENT→FAILED` — **84 tests OK**
- [x] `build`, `lint`, `opencode.md` actualizados
- [ ] **Pendiente E2E real** (requiere credenciales Meta: WABA + número + token + plantillas aprobadas): provider → mapeo WHATSAPP → template HSM activo → notificación → delivery `SENT` con wamid → curl simulando webhook `delivered` → `DELIVERED`

**Payload canónico:**
```json
POST /api/v1/providers
{
  "name": "Meta WhatsApp Cloud",
  "providerType": "WHATSAPP_CLOUD",
  "config": { "phoneNumberId": "108999887766", "apiVersion": "v21.0" },
  "secret": "<permanent access token>"
}
```
Luego `POST /api/v1/providers/{id}/channels` con `{ "channel": "WHATSAPP" }`.

Template HSM (`POST /api/v1/templates`): versión `channel: "WHATSAPP"`, `language` = código Meta exacto, `subject: "order_created_es"`, `body: "Hola {{name}}, tu orden {{orderId}} está lista."`. Texto libre: `subject: null`.

Webhook Meta: `https://<host>/api/v1/webhooks/whatsapp` (campos `messages`), verify token = `WHATSAPP_VERIFY_TOKEN`.

---

### [COMPLETADO] Correo vía SES-SMTP con secretos cifrados (2026-09-22)

**Diseño final (confirmado por el usuario):**
- Un tenant tiene N proveedores; **sin variables `.env` por proveedor**
- Contraseña → `secret` en el POST (HTTPS) → **AES-256-GCM con `SECRETS_MASTER_KEY`** (`5493f206...` del `.env`) → `secret_ref = enc:v1:...`. BD robada sin el `.env` es inútil. **Sin campos Base64 en el endpoint**
- Email: `providerType: "SES"` + `config.transport: "smtp"` (datos del CSV SES: host, port, username) + `config.fromAddress` (identidad verificada en SES — obligatorio porque el username es un token, no un email)
- El contrato del endpoint `POST/PUT /providers` quedó como era originalmente (`config` libre + `secret`/`secretRef`); se revirtió el rediseño con `passwordBase64`/`endpoint`/GET
- Invalidación de caché Redis re-agregada al guardar provider/mapping (sin cambio de contrato)
- WhatsApp futuro: mismo patrón (nuevo `providerType` + case en el registry)

**Tareas:**
- [x] `SecretsService` (AES-256-GCM, prefijo `enc:v1:`) con `SECRETS_MASTER_KEY` del `.env`
- [x] `POST/PUT /providers` + `POST /:id/channels` (1 activo por canal por tenant)
- [x] `ProviderRegistry` resuelve `(tenant, channel)` → adapter; caché Redis TTL 300s + invalidación
- [x] Canales de entrega (`Email/Sms/PushChannel`) usan el registry; fallback env legacy
- [x] `SmtpAdapter` con `secure`/`requireTLS`/validación de `fromAddress` con `@`
- [x] Case `SES` + `config.transport === "smtp"` → `SmtpAdapter` con `decrypt(secret_ref)` (o `process.env[secretRef]` si no cifrado); sin transport → adapter AWS SDK
- [x] Fix `POST /notifications` 500 → `application_id` desde token `client_credentials`
- [x] Limpieza: borrados providers de prueba con `secretRef: sm://...` en plano
- [x] **E2E (2026-09-22):** provider SES-SMTP (`fromAddress: contacto@semic.com.co`, secret cifrado `enc:v1:` 65 chars) → mapeado a EMAIL → notificación a `yekogarcia@yahoo.com` → **delivery `SENT`, attempt `SUCCESS`**, `providerMessageId <eec47299-...@semic.com.co>`, `provider_id` = provider SES creado
- [x] build, lint, 52 tests OK; `opencode.md` actualizado

**Payload canónico (contrato vigente):**
```json
POST /api/v1/providers
{
  "name": "AWS SES SMTP",
  "providerType": "SES",
  "config": {
    "transport": "smtp",
    "host": "<SMTP Endpoint del CSV SES>",
    "port": 587,
    "secure": false,
    "starttls": true,
    "username": "<Username del CSV SES>",
    "fromAddress": "contacto@semic.com.co"
  },
  "secret": "<Password del CSV SES>"
}
```
Luego `POST /api/v1/providers/{id}/channels` con `{ "channel": "EMAIL" }`.

---

### [COMPLETADO] Envío de correo SMTP con provider guardado + cifrado de secretos (2026-09-22)

> **Revert parcial (2026-09-22, decisión del usuario):** el endpoint `POST/PUT /providers` volvió a su contrato original — `config` libre + `secretRef` (o `secret` cifrado). Se retiraron: campos `passwordBase64`, validación SMTP obligatoria en el DTO, y los endpoints `GET /providers` y `GET /providers/channels`. Payload canónico:
> ```json
> { "name": "AWS SES SMTP", "providerType": "SES",
>   "config": { "transport": "smtp", "host": "...", "port": 587, "secure": false, "starttls": true, "username": "..." },
>   "secretRef": "sm://notify/secrets/ses-smtp-password" }
> ```
> **Pendiente de definir:** conectar `providerType: SES` + `config.transport=smtp` al `SmtpAdapter` (hoy el case SES construye el adapter AWS SDK e ignora `host/username`), y resolver `secretRef` como referencia externa (`sm://...`) para la contraseña.

**Objetivo original:** Guardar la configuración SMTP de un proveedor de correo en `notification_providers` y enviar correos reales. La contraseña puede ir cifrada con `SECRETS_MASTER_KEY` (AES-256-GCM, prefijo `enc:v1:`) vía campo `secret`.

**Tabla destino:** `notification_providers` (`config` jsonb + `secret_ref`)

| Campo del formulario | Destino en BD | Cifrado |
|----------------------|---------------|---------|
| SMTP Endpoint | `config.endpoint` | No |
| Port | `config.port` (default 587) | No |
| Username | `config.username` | No |
| Username (Base64) | `config.usernameBase64` | No (solo display) |
| Password | `secret_ref` via `SecretsService.encrypt()` | **Sí (AES-256-GCM)** |
| Password (Base64) | se decodifica → cifrado → `secret_ref` | **Sí (AES-256-GCM)** |

**Tareas (estado final tras revert):**
- [x] `SECRETS_MASTER_KEY` en `.env` + `SecretsService` (AES-256-GCM, prefijo `enc:v1:`)
- [x] Tabla `notification_providers` (migración 0008) con `config` jsonb y `secret_ref`
- [x] `POST/PUT /api/v1/providers` — contrato original: `config` libre, `secretRef` o `secret` (cifrado)
- [x] `POST /api/v1/providers/:id/channels` (mapear provider → canal, 1 activo por canal)
- [x] ~~`GET /api/v1/providers` y `GET /api/v1/providers/channels`~~ — **revertido** (no forma parte del contrato)
- [x] ~~DTO `passwordBase64` + validación SMTP en endpoint~~ — **revertido** (no forma parte del contrato)
- [x] `ProviderRegistry` resuelve el provider guardado por `(tenant, channel)` con caché Redis TTL 300s
- [x] Canales de entrega usan el registry; fallback a env si no hay config en BD
- [x] `ProviderType.SMTP` + `SmtpAdapter` (nodemailer) + caso SMTP en el registry *(infra disponible; el caso SES aún no usa transport smtp)*
- [x] Fix: `POST /notifications` 500 → `application_id` desde token `client_credentials`
- [x] `opencode.md` actualizado
- [x] Verificación: build, lint, 52 tests OK
- [x] **E2E real (2026-09-22):** provider con `password` cifrado → mapeado a EMAIL → correo a `yekogarcia@yahoo.com` → `SENT`, attempt `SUCCESS`, `providerMessageId <1ea97eea-...@yahoo.com>`
- [x] Smoke test del payload del usuario contra el endpoint revertido → 201 OK
- [ ] **Pendiente:** enviar usando `providerType SES` + `config.transport=smtp` (conectar al SmtpAdapter + resolver `secretRef` externo `sm://...`)

**Ejemplo de request (contrato vigente):**
```json
POST /api/v1/providers
{
  "name": "AWS SES SMTP",
  "providerType": "SES",
  "config": {
    "transport": "smtp",
    "host": "w7psyuziakq9.fips.wmjb.mail-manager-smtp.amazonaws.com",
    "port": 587,
    "secure": false,
    "starttls": true,
    "username": "inp-2td42lfcv7dylf5dgkfdnqvy"
  },
  "secretRef": "sm://notify/secrets/ses-smtp-password"
}
```
Luego `POST /api/v1/providers/{id}/channels` con `{ "channel": "EMAIL" }`.

---

### [COMPLETADO] Wiring de proveedores por canal — US7 (2026-09-22)

- Entidad `ProviderChannelEntity` + índice único parcial `UNIQUE(tenant_id, channel) WHERE is_active` (migración 0009)
- `ProviderRegistry` consulta `notification_provider_channels` (ya no un provider genérico por tenant)
- Endpoints CRUD de providers con tenant desde JWT (`AdminGuard`), secretos enmascarados en respuesta
- Caché Redis `provider:{tenantId}:{channel}` con invalidación al actualizar config/mapping
- Canales de entrega resuelven el provider dinámicamente por `(tenantId, channel)` y registran `delivery.provider_id` del proveedor usado
- `DeliveriesModule` importa `ProvidersModule`; env vars quedan como fallback legacy
