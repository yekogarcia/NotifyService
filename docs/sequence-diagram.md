# Diagrama de Secuencia — NotitifyService

## 1. Crear Notificación (API → 202 Accepted)

```mermaid
sequenceDiagram
    participant C as Cliente (PMS)
    participant GW as AuthGuard + RateLimit
    participant Ctrl as NotificationController
    participant UC as CreateNotificationUseCase
    participant ICU as IdempotencyCheck
    participant VTU as ValidateTemplate
    participant VR as ValidateRecipients
    participant DB as PostgreSQL
    participant Q as BullMQ (Redis)

    C->>GW: POST /api/v1/notifications
    GW->>GW: Validar API Key / JWT
    GW->>GW: Verificar Rate Limit
    GW->>Ctrl: Request validado

    Ctrl->>UC: execute(tenantId, dto)

    UC->>ICU: execute(tenantId, idempotencyKey)
    ICU->>DB: SELECT * FROM notifications WHERE tenant_id AND idempotency_key
    DB-->>ICU: null (no existe)

    UC->>VTU: execute(tenantId, templateCode, channels, language)
    VTU->>DB: SELECT active version WHERE template_code AND channel AND language
    DB-->>VTU: TemplateVersion (encontrado)

    UC->>VR: validateRecipients(recipients)
    VR-->>UC: Recipients validados

    UC->>DB: BEGIN TRANSACTION
    UC->>DB: INSERT INTO notifications (status=QUEUED)
    UC->>DB: INSERT INTO notification_recipients
    UC->>DB: INSERT INTO notification_deliveries (status=QUEUED)
    UC->>DB: COMMIT

    UC->>Q: queue.add('process-notification', { notificationId })
    Q-->>UC: Job encolado

    UC-->>Ctrl: { notificationId, status: QUEUED, correlationId }
    Ctrl-->>C: 202 Accepted

    Note over C,Q: La API responde en < 500ms sin esperar al proveedor
```

## 2. Idempotencia — Solicitud Duplicada

```mermaid
sequenceDiagram
    participant C as Cliente
    participant Ctrl as NotificationController
    participant UC as CreateNotificationUseCase
    participant ICU as IdempotencyCheck
    participant DB as PostgreSQL

    C->>Ctrl: POST /api/v1/notifications (idempotencyKey: "res-1001")
    Ctrl->>UC: execute(tenantId, dto)

    UC->>ICU: execute(tenantId, "res-1001")
    ICU->>DB: SELECT * WHERE idempotency_key = "res-1001"
    DB-->>ICU: Notification existente

    ICU-->>UC: Notification existente
    UC-->>Ctrl: { notificationId, status: QUEUED, idempotent: true }
    Ctrl-->>C: 202 Accepted (misma notificationId)

    Note over C,DB: No se crea duplicado. Se retorna la notificación existente.
```

## 3. Procesamiento Asíncrono (Worker → Provider)

```mermaid
sequenceDiagram
    participant Q as BullMQ Queue
    participant W as DeliveryWorker
    participant DD as DeliveryDispatcher
    participant CR as ChannelRegistry
    participant Ch as EmailChannel
    participant P as SES Adapter
    participant AWS as AWS SES
    participant AR as AttemptRepository
    participant DR as DeliveryRepository
    participant DB as PostgreSQL

    Q->>W: consume('process-notification', { notificationId })
    W->>DB: SELECT deliveries WHERE notification_id AND status=QUEUED

    loop Para cada delivery
        W->>DD: dispatch(deliveryId, renderedContent)

        DD->>DR: updateStatus(deliveryId, PROCESSING)
        DR->>DB: UPDATE deliveries SET status=PROCESSING

        DD->>CR: getChannel(EMAIL)
        CR-->>DD: EmailChannel

        DD->>Ch: send(deliveryId, to, subject, body)
        Ch->>P: sendEmail(to, subject, body)
        P->>AWS: SendEmail API call
        AWS-->>P: { MessageId: "ses-123" }
        P-->>Ch: { success: true, providerMessageId: "ses-123" }
        Ch-->>DD: SendResult

        DD->>AR: save(attempt { result: SUCCESS, providerMessageId })
        AR->>DB: INSERT INTO notification_attempts

        DD->>DR: updateStatus(deliveryId, SENT)
        DR->>DB: UPDATE deliveries SET status=SENT
    end

    W->>DB: UPDATE notifications SET status=SENT
```

## 4. Reintentos con Backoff Exponencial

```mermaid
sequenceDiagram
    participant W as DeliveryWorker
    participant DD as DeliveryDispatcher
    participant P as Provider
    participant RH as RetryHandler
    participant EC as ErrorClassifier
    participant BS as BackoffStrategy
    participant Q as RetryQueue
    participant DLQ as DeadLetterQueue
    participant DB as PostgreSQL

    W->>DD: dispatch(deliveryId, content)
    DD->>P: send(...)
    P-->>DD: { success: false, errorType: HTTP_500 }

    DD->>EC: classify(500)
    EC-->>DD: { result: TRANSIENT_ERROR }

    DD->>RH: handleRetry(deliveryId, TRANSIENT_ERROR, attemptCount=1)
    RH->>RH: shouldRetry? true (1 < 3)
    RH->>BS: getDelay(attemptNumber=2)
    BS-->>RH: 2000ms

    RH->>Q: add('retry-delivery', { deliveryId }, { delay: 2000ms })
    RH-->>DD: { willRetry: true, delayMs: 2000 }

    Note over W,Q: Intento 2 después de 2s...

    Q->>W: consume('retry-delivery')
    W->>DD: dispatch(deliveryId, content)
    DD->>P: send(...)
    P-->>DD: { success: false, errorType: HTTP_500 }

    DD->>RH: handleRetry(deliveryId, TRANSIENT_ERROR, attemptCount=2)
    RH->>BS: getDelay(attemptNumber=3)
    BS-->>RH: 4000ms
    RH->>Q: add('retry-delivery', { deliveryId }, { delay: 4000ms })

    Note over W,Q: Intento 3 después de 4s... también falla

    DD->>RH: handleRetry(deliveryId, TRANSIENT_ERROR, attemptCount=3)
    RH->>RH: shouldRetry? false (3 >= 3)
    RH->>DLQ: moveToDLQ(deliveryId, "Max attempts exhausted")
    DLQ->>Q: add('dead-letter', { deliveryId, reason })

    DLQ->>DB: UPDATE deliveries SET status=FAILED
```

## 5. Error Permanente (No Retry)

```mermaid
sequenceDiagram
    participant W as DeliveryWorker
    participant DD as DeliveryDispatcher
    participant P as Provider
    participant EC as ErrorClassifier
    participant AR as AttemptRepository
    participant DR as DeliveryRepository
    participant DB as PostgreSQL

    W->>DD: dispatch(deliveryId, content)
    DD->>P: send(...)
    P-->>DD: { success: false, errorType: HTTP_400, errorMessage: "Invalid email" }

    DD->>EC: classify(400)
    EC-->>DD: { result: PERMANENT_ERROR }

    DD->>AR: save(attempt { result: PERMANENT_ERROR, errorType: HTTP_400 })
    AR->>DB: INSERT INTO notification_attempts

    DD->>DR: updateStatus(deliveryId, FAILED)
    DR->>DB: UPDATE deliveries SET status=FAILED

    Note over W,DB: No se programa reintento. Fallo inmediato.
```

## 6. Preferencias de Usuario

```mermaid
sequenceDiagram
    participant C as Cliente
    participant Ctrl as NotificationController
    participant UC as CreateNotificationUseCase
    participant AP as ApplyPreferences
    participant PR as PreferenceResolver
    participant DB as PostgreSQL

    C->>Ctrl: POST /notifications { channels: [EMAIL, SMS, PUSH], recipient: { userId: "user_123" } }
    Ctrl->>UC: execute(tenantId, dto)

    UC->>AP: execute(recipients, channels)
    AP->>PR: resolve("user_123", [EMAIL, SMS, PUSH])
    PR->>DB: SELECT * FROM notification_preferences WHERE user_id = "user_123"
    DB-->>PR: [{ channel: SMS, enabled: false }]

    PR-->>AP: [EMAIL, PUSH] (SMS filtrado)
    AP-->>UC: [{ recipient, channels: [EMAIL, PUSH] }]

    UC->>DB: INSERT deliveries solo para EMAIL y PUSH

    Note over C,DB: SMS omitido por preferencia del usuario (OFF)
```

## 7. Cambio de Proveedor (Swap sin modificar dominio)

```mermaid
sequenceDiagram
    participant Admin as Administrador
    participant PrC as ProviderController
    participant DB as PostgreSQL
    participant W as DeliveryWorker
    participant CR as ChannelRegistry
    participant SGD as SendGridAdapter
    participant SG as SendGrid API

    Admin->>PrC: PUT /providers/:id { providerType: SENDGRID }
    PrC->>DB: UPDATE notification_providers SET provider_type = SENDGRID
    DB-->>PrC: Updated

    Note over Admin,DB: Nuevas entregas usarán SendGrid automáticamente

    W->>CR: getChannel(EMAIL)
    CR->>DB: SELECT provider WHERE tenant_id AND channel = EMAIL
    DB-->>CR: { providerType: SENDGRID }
    CR->>SGD: new SendGridAdapter(config, secretRef)
    CR-->>W: EmailChannel con SendGrid

    W->>SGD: sendEmail(to, subject, body)
    SGD->>SG: POST /v3/mail/send
    SG-->>SGD: { messageId }

    Note over Admin,SG: El dominio y application layer no fueron modificados
```
