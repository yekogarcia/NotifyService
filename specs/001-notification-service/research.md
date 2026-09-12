# Research: Servicio de Notificaciones

**Date**: 2026-09-11 | **Feature**: 001-notification-service

## Resolved Decisions

### RD-01: Framework — NestJS + Fastify

**Decision**: NestJS como framework con Fastify como adapter HTTP.

**Rationale**: NestJS proporciona arquitectura modular con DI (dependency
injection) nativa, soporte para Hexagonal/Clean Architecture, y decoradores
que facilitan la separación de capas. Fastify ofrece mejor rendimiento que
Express en benchmarks. Consistencia con ecosistema empresarial existente.

**Alternatives considered**:
- Express: Más simple pero sin DI nativa, menos estructura modular.
- Fastify solo: Rápido pero sin la estructura de NestJS.
- Koa: Middleware elegante pero ecosistema más pequeño.

---

### RD-02: ORM — TypeORM con PostgreSQL

**Decision**: TypeORM como ORM sobre PostgreSQL.

**Rationale**: TypeORM integra nativamente con NestJS, soporta migraciones
versionadas, decorators para entidades, y relations. PostgreSQL ofrece
integridad referencial, JSONB para datos flexibles (notification.data),
y índices parciales para idempotencia.

**Alternatives considered**:
- Prisma: Type-safe y moderno, pero menos integración con NestJS DI y
  migraciones más opacas.
- MikroORM: Bueno para DDD pero ecosistema más pequeño.
- Knex (query builder): Más control pero más boilerplate.

---

### RD-03: Queue — BullMQ + Redis

**Decision**: BullMQ como librería de colas sobre Redis.

**Rationale**: BullMQ es nativo de Node.js, soporta retries con backoff
exponencial, dead letter queues, job priorities, y observabilidad. Redis
sirve también como cache para preferencias y configuración de proveedores.

**Alternatives considered**:
- RabbitMQ: Más robusto para messaging complejo, pero overhead operativo
  mayor. Planificado para fase posterior.
- SQS: Managed pero acopla a AWS y no aporta cache.
- Kafka: Overkill para este volumen y complejidad inicial.

---

### RD-04: Arquitectura — Hexagonal / Clean Architecture

**Decision**: Arquitectura hexagonal con capas Domain, Application,
Infrastructure, e Interfaces por módulo.

**Rationale**: Cumple Principios I y II de la constitución. El dominio no
depende de infraestructura. Los proveedores son adapters detrás de ports.
Permite testing del dominio sin dependencias externas.

**Alternatives considered**:
- Arquitectura en capas tradicional: Más simple pero acoplamiento mayor.
- DDD puro con bounded contexts: Más expresivo pero complejidad innecesaria
  para modular monolith inicial.
- CQRS: Útil para separar reads/writes pero añade complejidad no justificada
  en MVP.

---

### RD-05: Despliegue — Modular Monolith + Workers

**Decision**: Un solo proceso NestJS con workers BullMQ integrados.

**Rationale**: Cumple Principio IX de la constitución. Los workers corren
como consumers de BullMQ en el mismo proceso. Extracción a microservicios
solo si existe necesidad demostrada (cuello de botella, escalabilidad
independiente).

**Alternatives considered**:
- Microservicios desde el inicio: Violaría Principio IX. Complejidad
  operativa injustificada.
- Worker separado como proceso: Posible si la carga lo justifica, pero
  inicialmente innecesario con BullMQ.

---

### RD-06: Autenticación — JWT / API Key (Service-to-Service)

**Decision**: Autenticación service-to-service mediante API Keys o
Client Credentials OAuth2 (JWT).

**Rationale**: Cumple Principio VIII. Los consumidores son sistemas, no
usuarios. API Key para simplicidad inicial, JWT/OAuth2 para consumidores
que ya tienen un IdP. Multi-tenant con aislamiento por tenantId.

**Alternatives considered**:
- mTLS: Más seguro pero complejidad de cert management.
- Session-based: No aplica para service-to-service.

---

### RD-07: Observabilidad — OpenTelemetry + Structured Logging

**Decision**: OpenTelemetry para tracing distribuido + logger estructurado
JSON con correlation IDs.

**Rationale**: Cumple Principio VII. Todos los identificadores
(sourceSystem, correlationId, eventId, notificationId, deliveryId,
providerMessageId) se propagan en logs y traces.

**Alternatives considered**:
- Datadog APM nativo: Vendor lock-in.
- Prometheus + Grafana solo: Métricas pero sin tracing distribuido.

---

### RD-08: Renderizado de Plantillas — Interpolación de Variables

**Decision**: Interpolación simple con sintaxis `{{variableName}}` desde
el payload `data` de la notificación.

**Rationale**: Cumple FR-018. Suficiente para notificaciones transaccionales.
Contenido por canal e idioma definido en la plantilla.

**Alternatives considered**:
- Handlebars/Mustache: Más potente pero innecesario para interpolación simple.
- MJML para email: Útil para responsive HTML, puede integrarse en el
  adapter de EMAIL provider si se necesita.

---

### RD-09: Estrategia de Errores — Clasificación Transitorio vs Permanente

**Decision**: HTTP 5xx y timeouts = transitorio (retry con backoff).
HTTP 4xx = permanente (no retry, marcar FAILED).

**Rationale**: Cumple FR-009 a FR-012. Dead Letter Queue tras agotar
reintentos. Clasificación extensible para errores específicos de proveedor
(ej. bounce de email = permanente).

**Alternatives considered**:
- Circuit breaker: Complementario, puede añadirse si los proveedores
  fallan frecuentemente. No crítico para MVP.

---

### RD-10: Multi-tenancy — Aislamiento por tenantId

**Decision**: Columna `tenant_id` en todas las tablas de negocio. Filtro
automático a nivel de query.

**Rationale**: Permite que múltiples sistemas usen la plataforma sin
interferencia. El `sourceSystem` identifica al consumidor dentro del tenant.

**Alternatives considered**:
- Schema-per-tenant: Más aislamiento pero complejidad operativa mayor.
- Database-per-tenant: Máximo aislamiento pero overhead injustificado.

## Unresolved Items

None. All technical decisions provided by user input. No NEEDS CLARIFICATION
markers remain.
