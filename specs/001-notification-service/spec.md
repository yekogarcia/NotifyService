# Feature Specification: Servicio de Notificaciones

**Feature Branch**: `001-notification-service`

**Created**: 2026-09-11

**Status**: Draft

**Input**: User description: "Sistema de notificaciones con 10 features: crear notificaciones, gestionar destinatarios, canales, plantillas, entrega y seguimiento, reintentos, idempotencia, preferencias, proveedores y auditoría. Incluye historias de usuario, criterios de aceptación y future scope."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Solicitar Notificación vía API (Priority: P1)

Como sistema consumidor, quiero solicitar una notificación mediante una
API para no implementar lógica de email, SMS o push en cada aplicación.
La API recibe el sistema origen, tipo de evento, destinatario, canales,
código de plantilla y datos, y responde 202 Accepted inmediatamente.

**Why this priority**: Es el punto de entrada fundamental del sistema.
Sin esta capacidad no existe el servicio de notificaciones. Todos los
demás flujos dependen de que una notificación pueda ser creada.

**Independent Test**: Enviar una solicitud HTTP válida con credenciales
de servicio y verificar que la API responde 202 y persiste la
notificación en estado QUEUED.

**Acceptance Scenarios**:

1. **Given** el consumidor tiene credenciales válidas, **When** envía una solicitud válida con sourceSystem, eventType, recipient, channels, templateCode y data, **Then** la API persiste la notificación, la solicitud queda en estado QUEUED, y la API responde 202 Accepted.
2. **Given** el consumidor envía una solicitud sin credenciales válidas, **When** la API recibe la solicitud, **Then** responde 401 Unauthorized y no persiste ninguna notificación.
3. **Given** el consumidor envía una solicitud con payload inválido (campos requeridos faltantes), **When** la API recibe la solicitud, **Then** responde 400 Bad Request con un mensaje descriptivo del error.

---

### User Story 2 - Procesamiento Asíncrono (Priority: P1)

Como plataforma, quiero procesar las notificaciones de forma asíncrona
para que la respuesta de la API no dependa de la disponibilidad del
proveedor externo. La API persiste y encola; un worker procesa la
entrega contra el proveedor.

**Why this priority**: Garantiza que el sistema consumidor no se bloquee
esperando proveedores externos. Es un principio constitucional
(Principio IV) no negociable.

**Independent Test**: Solicitar una notificación, verificar que la API
responde 202 antes de que el proveedor haya procesado, y luego verificar
que el worker eventualmente procesa la entrega.

**Acceptance Scenarios**:

1. **Given** una notificación persistida en estado QUEUED, **When** el worker la procesa, **Then** el estado cambia a PROCESSING y luego a SENT o FAILED según la respuesta del proveedor.
2. **Given** el proveedor externo no está disponible, **When** el worker intenta procesar, **Then** la entrega se marca para reintento y la API ya ha respondido 202 al consumidor sin esperar.

---

### User Story 3 - Idempotencia (Priority: P1)

Como sistema, quiero evitar duplicados mediante una clave de
idempotencia. Si llega dos veces la misma solicitud (mismo eventType +
idempotencyKey), debe generarse una sola notificación lógica.

**Why this priority**: Los reintentos son inevitables en sistemas
distribuidos. Sin idempotencia, los reintentos generan notificaciones
duplicadas que violan el Principio V de la constitución.

**Independent Test**: Enviar la misma solicitud dos veces con el mismo
idempotencyKey y verificar que solo se crea una notificación.

**Acceptance Scenarios**:

1. **Given** existe una notificación con idempotencyKey X, **When** se recibe nuevamente la misma solicitud con idempotencyKey X, **Then** no se crea otra notificación y se retorna la notificación existente.
2. **Given** no existe una notificación con idempotencyKey Y, **When** se recibe una solicitud con idempotencyKey Y, **Then** se crea una nueva notificación.

---

### User Story 4 - Reintentos Automáticos (Priority: P1)

Como sistema, quiero reintentar entregas fallidas automáticamente con
backoff exponencial y un máximo de intentos configurable, clasificando
errores como transitorios o permanentes.

**Why this priority**: Los proveedores externos fallan transitoriamente.
Sin reintentos, una notificación se pierde al primer fallo temporal del
proveedor.

**Independent Test**: Simular que un proveedor devuelve HTTP 500,
verificar que la entrega se marca RETRYING y se programa un nuevo
intento con backoff.

**Acceptance Scenarios**:

1. **Given** el proveedor devuelve HTTP 500 (error transitorio), **When** el worker procesa la entrega, **Then** la entrega se marca como RETRYING y se programa un nuevo intento con backoff exponencial.
2. **Given** el proveedor devuelve HTTP 400 (error permanente, ej. email inválido), **When** el worker procesa la entrega, **Then** la entrega se marca como FAILED sin reintentar.
3. **Given** una entrega ha alcanzado el máximo de intentos configurado, **When** el último intento falla, **Then** la entrega se mueve a Dead Letter Queue y se marca como FAILED.

---

### User Story 5 - Configurar Plantillas (Priority: P2)

Como administrador, quiero configurar plantillas por canal e idioma para
reutilizar mensajes sin modificar código. Las plantillas deben ser
versionables, con activación/desactivación de versiones y renderizado de
variables.

**Why this priority**: Sin plantillas, cada cambio de mensaje requiere
código. Es esencial para operatividad pero no bloquea el MVP de envío.

**Independent Test**: Crear una plantilla con variables, solicitar una
notificación que la use, y verificar que el contenido renderizado
contiene los valores correctos.

**Acceptance Scenarios**:

1. **Given** existe una plantilla "reservation.confirmed" versión 1 activa con contenido para EMAIL y PUSH, **When** se solicita una notificación con templateCode "reservation.confirmed" y channels ["EMAIL", "PUSH"], **Then** se generan entregas con el contenido renderizado para cada canal.
2. **Given** existe una plantilla versión 1 activa y versión 2 inactiva, **When** el administrador activa versión 2, **Then** las nuevas notificaciones usan versión 2 y las existentes conservan su versión original.
3. **Given** una plantilla con variable `{{reservationCode}}`, **When** se solicita una notificación con data `{"reservationCode": "RES-1001"}`, **Then** el contenido renderado contiene "RES-1001" en lugar de la variable.

---

### User Story 6 - Consultar Entregas y Auditoría (Priority: P2)

Como operador, quiero consultar el historial de entregas e intentos para
diagnosticar errores. Debe ser posible saber quién solicitó la
notificación, qué evento la originó, qué proveedor se utilizó, cuántos
intentos tuvo y por qué falló.

**Why this priority**: Esencial para operación y diagnóstico, pero el
sistema funciona sin esta capacidad de consulta (los datos se persisten
de todas formas).

**Independent Test**: Solicitar una notificación, dejar que se procese,
y consultar el historial de entregas para verificar que contiene toda la
información de auditoría.

**Acceptance Scenarios**:

1. **Given** existe una notificación procesada con 2 intentos (1 fallido, 1 exitoso), **When** el operador consulta el historial, **Then** ve la notificación con sus entregas, cada entrega con sus intentos, y cada intento con proveedor, resultado y razón de fallo si aplica.
2. **Given** existe una notificación fallida, **When** el operador consulta el detalle, **Then** puede ver quién la solicitó (sourceSystem), qué evento la originó (eventType), qué proveedor se usó, cuántos intentos tuvo y por qué falló.

---

### User Story 7 - Gestionar Canales y Proveedores (Priority: P2)

Como administrador, quiero configurar qué canales están disponibles y qué
proveedor usa cada canal (EMAIL→SES, SMS→Twilio, PUSH→FCM), de forma que
pueda cambiar proveedores sin modificar el dominio.

**Why this priority**: La configuración de canales y proveedores es
necesaria para operar, pero el sistema puede iniciarse con configuración
fija y exponer gestión más tarde.

**Independent Test**: Configurar un proveedor distinto para un canal y
verificar que las nuevas entregas usan el nuevo proveedor sin cambios en
el dominio.

**Acceptance Scenarios**:

1. **Given** el canal EMAIL está configurado con proveedor SES, **When** el administrador cambia el proveedor a SendGrid, **Then** las nuevas entregas por EMAIL usan SendGrid sin requerir cambios en el dominio.
2. **Given** los canales iniciales EMAIL, SMS y PUSH están disponibles, **When** se solicita una notificación con un canal no soportado (ej. WHATSAPP), **Then** la API responde 400 indicando que el canal no está disponible.

---

### User Story 8 - Preferencias de Usuario (Priority: P3)

Como usuario, quiero configurar mis preferencias de canal (Email: ON,
SMS: OFF, Push: ON) para que el sistema respete mi decisión sobre qué
canales usar para notificarme.

**Why this priority**: Mejora la experiencia del usuario final pero no
bloquea la funcionalidad core de envío. Las notificaciones pueden enviarse
sin preferencias inicialmente.

**Independent Test**: Configurar preferencias para un usuario, solicitar
una notificación para ese usuario, y verificar que solo se entregan los
canales activos.

**Acceptance Scenarios**:

1. **Given** el usuario "user_123" tiene Email: ON, SMS: OFF, Push: ON, **When** se solicita una notificación para ese usuario con channels ["EMAIL", "SMS", "PUSH"], **Then** solo se generan entregas para EMAIL y PUSH.
2. **Given** el usuario no tiene preferencias configuradas, **When** se solicita una notificación, **Then** se intenta entregar por todos los canales solicitados (preferencias por defecto: todas ON).

---

### Edge Cases

- What happens when a recipient has no contact information for the requested channel? (ej. usuario sin email pero canal EMAIL solicitado)
- What happens when a template doesn't exist for the given templateCode?
- What happens when a template doesn't have content for the requested channel?
- What happens when user preferences disable ALL requested channels?
- What happens when the queue is full and cannot accept new notifications?
- What happens when a provider returns a permanent error (ej. bounced email, invalid phone)?
- What happens when all channels fail for a single notification?
- What happens when a template variable is missing from the data payload?
- What happens when multiple recipients are specified and some fail while others succeed?
- What happens when a template version is deactivated and no other active version exists?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow external systems to request notifications via an authenticated API
- **FR-002**: System MUST accept notification requests containing sourceSystem, eventType, recipient, channels, templateCode, data, and idempotencyKey
- **FR-003**: System MUST support multiple recipient types: internal user (by userId), external user, direct email, and direct phone
- **FR-004**: System MUST support multiple recipients in a single notification request
- **FR-005**: System MUST support EMAIL, SMS, and PUSH channels in the initial release
- **FR-006**: System MUST persist the notification and queue it for async processing before responding to the API caller
- **FR-007**: System MUST respond 202 Accepted immediately after persisting the notification
- **FR-008**: System MUST track delivery status through the lifecycle: CREATED → QUEUED → PROCESSING → SENT → DELIVERED → FAILED
- **FR-009**: System MUST implement automatic retries for transient failures with a configurable maximum number of attempts
- **FR-010**: System MUST use exponential backoff between retry attempts
- **FR-011**: System MUST route deliveries to a Dead Letter Queue after exhausting the maximum retry attempts
- **FR-012**: System MUST classify errors as transient (retryable) or permanent (non-retryable)
- **FR-013**: System MUST ensure idempotent processing: duplicate requests with the same idempotencyKey MUST NOT create duplicate notifications
- **FR-014**: System MUST return the existing notification when a duplicate idempotencyKey is received
- **FR-015**: System MUST allow administrators to create and version templates
- **FR-016**: System MUST support language/locale definition per template
- **FR-017**: System MUST allow defining separate content per channel within a single template
- **FR-018**: System MUST render template variables from the notification data payload
- **FR-019**: System MUST support activating and deactivating template versions, with only one active version per template code
- **FR-020**: System MUST allow users to configure channel preferences (ON/OFF) per channel
- **FR-021**: System MUST respect user preferences and skip delivery for channels marked OFF
- **FR-022**: System MUST allow configuration of providers per channel (ej. EMAIL→SES, SMS→Twilio, PUSH→FCM)
- **FR-023**: System MUST allow swapping a provider for a channel without modifying domain or application layers
- **FR-024**: System MUST record audit information for each notification: sourceSystem, eventType, provider used, attempt count, and failure reason
- **FR-025**: System MUST propagate correlation identifiers (correlationId, eventId, notificationId, deliveryId, providerMessageId) across all operations
- **FR-026**: System MUST validate all incoming payloads against the expected schema
- **FR-027**: System MUST enforce rate limiting on all API endpoints

### Key Entities *(include if feature involves data)*

- **Notification**: Represents an intent to communicate. Key attributes: id, sourceSystem, eventType, recipient(s), channels, templateCode, data, idempotencyKey, status, createdAt. A notification has one or more Deliveries.
- **Delivery**: Represents the send attempt for a specific channel. Key attributes: id, notificationId, channel, provider, status, createdAt. A delivery has one or more Attempts.
- **Attempt**: Individual try at delivering through a provider. Key attributes: id, deliveryId, providerMessageId, result, errorType, errorMessage, attemptedAt.
- **Template**: Reusable message definition. Key attributes: code, version, language, channelContents (map of channel → content), active. One active version per code.
- **Recipient**: Target of a notification. Can be internal user (userId), external user, direct email, or direct phone.
- **Channel**: Delivery method. Initial: EMAIL, SMS, PUSH. Future: WHATSAPP, WEBHOOK, SLACK, TEAMS.
- **Provider**: External service adapter for a channel. Configured per channel, swappable without domain changes.
- **UserPreference**: Per-user channel opt-in/opt-out settings. Key attributes: userId, channel, enabled (ON/OFF).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: External systems receive a 202 response within 500ms of submitting a notification request, regardless of provider availability
- **SC-002**: System processes at least 1,000 notification requests per minute without degradation in response time
- **SC-003**: 99.9% of notifications with valid recipients and active channels are eventually delivered or marked as FAILED after exhausting retries
- **SC-004**: Duplicate requests with the same idempotencyKey never produce more than one logical notification (100% deduplication)
- **SC-005**: Operators can trace any notification from request to final delivery status in under 30 seconds using the audit trail
- **SC-006**: Transient provider failures are retried automatically and 95% recover within the maximum retry attempts
- **SC-007**: Template changes (new version activation) take effect for new notifications within 1 minute without system restart

## Assumptions

- External systems authenticate via service-to-service credentials (API keys or OAuth2 tokens)
- Initial channels are EMAIL, SMS, and PUSH; WHATSAPP, WEBHOOK, SLACK, and TEAMS are future scope
- Architecture starts as a modular monolith with async workers, not microservices (per constitution Principle IX)
- Providers are initially configured as: EMAIL→SES, SMS→Twilio, PUSH→FCM
- User preferences default to all channels ON when no preferences are explicitly configured
- Templates use simple variable interpolation (e.g., `{{variableName}}`) from the notification data payload
- Error classification: HTTP 5xx and timeouts are transient (retryable); HTTP 4xx are permanent (non-retryable)
- The following are explicitly out of scope for the initial release: marketing campaigns, advanced segmentation, complex analytics, visual template editor, WhatsApp Business API, multi-region deployment, provider billing/reconciliation, and machine learning
