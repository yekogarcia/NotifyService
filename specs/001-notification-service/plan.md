# Implementation Plan: Servicio de Notificaciones

**Branch**: `001-notification-service` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-notification-service/spec.md`

## Summary

Sistema de notificaciones multi-canal (EMAIL, SMS, PUSH) que permite a
sistemas externos solicitar notificaciones vía API REST, procesarlas
asíncronamente mediante workers, y rastrear entregas e intentos. Arquitectura
hexagonal sobre NestJS + Fastify con modular monolith + workers, persistencia
en PostgreSQL, colas con BullMQ + Redis, y proveedores intercambiables por
canal.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode, `strict: true`, sin `any`)

**Primary Dependencies**: NestJS, Fastify, TypeORM, BullMQ, Redis,
class-validator, Swagger/OpenAPI, OpenTelemetry, Jest

**Storage**: PostgreSQL (via TypeORM con migraciones versionadas)

**Testing**: Jest (tests unitarios + tests de integración)

**Target Platform**: Linux server (Docker, despliegue en OpenShift)

**Project Type**: web-service (modular monolith + async workers)

**Performance Goals**: 1,000 req/min, respuesta 202 en < 500ms
independiente del proveedor, 99.9% de entregas eventualmente procesadas

**Constraints**: < 500ms p95 en API, rate limiting en todos los endpoints,
idempotencia obligatoria, secretos fuera del código, logs estructurados JSON

**Scale/Scope**: Modular monolith con workers asíncronos. Inicial: 3 canales
(EMAIL, SMS, PUSH), 3 proveedores (SES, Twilio, FCM). Multi-tenant.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principio | Estado | Justificación |
|---|-----------|--------|---------------|
| I | Arquitectura Desacoplada | PASS | Arquitectura hexagonal: Domain/Application → Port/Interface → Provider Adapter. Ningún caso de uso depende de SDK de proveedor. |
| II | Separación de Responsabilidades | PASS | Capas Domain, Application, Infrastructure, Interfaces. Controladores solo reciben, validan y delegan. |
| III | Notification ≠ Delivery | PASS | Entidades separadas: Notification → Delivery → Attempt. Modelo de datos refleja la jerarquía. |
| IV | Procesamiento Asíncrono | PASS | API → Persist → Queue (BullMQ) → Worker → Provider. API responde 202 Accepted inmediatamente. |
| V | Idempotencia Obligatoria | PASS | idempotencyKey en every request. Deduplicación a nivel de persistencia. |
| VI | Proveedores Intercambiables | PASS | Adapters por proveedor detrás de ports. Cambio de SES→SendGrid no toca Domain/Application. |
| VII | Observabilidad | PASS | OpenTelemetry + structured logging. Correlation IDs propagados: sourceSystem, correlationId, eventId, notificationId, deliveryId, providerMessageId. |
| VIII | Seguridad | PASS | JWT/API Key service-to-service, rate limiting, class-validator en payloads, secretos en env/gestor, no credenciales en tablas. |
| IX | Evolución Incremental | PASS | Modular monolith + workers. No microservicios innecesarios. Extracción solo si hay necesidad demostrada. |
| X | Calidad | PASS | TypeScript strict, ESLint, Jest unit+integration, Swagger/OpenAPI, migraciones versionadas, logs JSON, manejo explícito de errores. |

**Gate Result**: ALL PASS. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-notification-service/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── notification-api.md
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── modules/
│   ├── notifications/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── enums/
│   │   │   └── repositories/
│   │   │
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   ├── create-notification/
│   │   │   │   ├── process-notification/
│   │   │   │   ├── retry-delivery/
│   │   │   │   └── cancel-notification/
│   │   │   └── dto/
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── persistence/
│   │   │   ├── messaging/
│   │   │   └── providers/
│   │   │
│   │   └── interfaces/
│   │       └── controllers/
│   │
│   ├── templates/
│   ├── preferences/
│   ├── providers/
│   ├── deliveries/
│   └── health/
│
├── shared/
│   ├── domain/
│   ├── infrastructure/
│   └── config/
│
└── main.ts

tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: Single project (modular monolith) following Hexagonal /
Clean Architecture. Each module contains domain, application, infrastructure,
and interfaces layers. Shared kernel in `shared/` for cross-cutting domain
concepts and infrastructure config. Workers run in the same process via
BullMQ consumers.

## Complexity Tracking

> No constitution violations. Table not required.
