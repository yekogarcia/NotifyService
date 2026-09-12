<!--
Sync Impact Report
===================
Version change: (unfilled template) → 1.0.0
Modified principles:
  - [PRINCIPLE_1_NAME] → I. Arquitectura Desacoplada
  - [PRINCIPLE_2_NAME] → II. Separación de Responsabilidades
  - [PRINCIPLE_3_NAME] → III. Notification ≠ Delivery
  - [PRINCIPLE_4_NAME] → IV. Procesamiento Asíncrono
  - [PRINCIPLE_5_NAME] → V. Idempotencia Obligatoria
Added sections:
  - Principle VI: Proveedores Intercambiables
  - Principle VII: Observabilidad
  - Principle VIII: Seguridad
  - Principle IX: Evolución Incremental
  - Principle X: Calidad
  - Section: Restricciones Tecnológicas
  - Section: Puertas de Calidad y Flujo de Desarrollo
Removed sections: (none)
Follow-up TODOs: (none)
-->

# NotitifyService Constitution

## Core Principles

### I. Arquitectura Desacoplada

El núcleo de notificaciones NO DEBE depender directamente de proveedores
como Twilio, SES o Firebase. La dependencia fluye en una sola dirección:

Clean Architecture + exagonal

```
Domain/Application
       ↓
Port/Interface
       ↓
Provider Adapter
```

**Regla**: Ningún caso de uso DEBE depender directamente de un SDK de
proveedor externo. Todo acceso a proveedores externos DEBE realizarse
a través de un puerto (interface) definido en el dominio.

**Razón**: Permite probar el dominio sin infraestructura real y sustituir
proveedores sin alterar la lógica de negocio.

### II. Separación de Responsabilidades

El sistema DEBE separar el código en cuatro capas:

- **Domain**: Entidades, value objects y reglas de negocio puras.
- **Application**: Casos de uso y orquestación de flujos.
- **Infrastructure**: Adaptadores de proveedores, colas, persistencia.
- **Presentation**: Controladores HTTP, DTOs, serialización.

Los controladores NO DEBEN contener lógica de negocio. Su única
responsabilidad es recibir, validar y delegar.

### III. Notification ≠ Delivery

Una **notificación** representa una intención de comunicación.
Una **entrega** (delivery) representa el envío por un canal específico.
Cada entrega puede tener múltiples **intentos** (attempts).

```
Notification
   └── Delivery
          └── Attempts
```

El modelo de datos DEBE reflejar esta jerarquía. Una notificación no
es un envío; un envío no es una notificación.

### IV. Procesamiento Asíncrono

La API NO DEBE esperar a que el proveedor externo termine el envío.
El flujo DEBE ser:

```
API → Persist → Queue → Worker → Provider
```

La API DEBE responder `202 Accepted` inmediatamente tras persistir la
notificación y encolar el trabajo. El procesamiento del proveedor ocurre
en un worker asíncrono.

### V. Idempotencia Obligatoria

Toda solicitud o evento DEBE poder procesarse de forma idempotente.
No DEBEN generarse notificaciones duplicadas por reintentos del cliente
o del worker. Cada solicitud DEBE incluir un identificador de
idempotencia que el sistema utiliza para deduplicar.

### VI. Proveedores Intercambiables

DEBE ser posible cambiar un proveedor sin modificar el dominio:

- Twilio → Infobip
- SES → SendGrid
- FCM → Otro proveedor

La sustitución solo requiere implementar un nuevo adaptador que cumpla
el puerto definido en el dominio. Ningún cambio en las capas Domain o
Application DEBE ser necesario para intercambiar proveedores.

### VII. Observabilidad

Toda operación DEBE permitir rastrear los siguientes identificadores:

- `sourceSystem`
- `correlationId`
- `eventId`
- `notificationId`
- `deliveryId`
- `providerMessageId`

Estos identificadores DEBEN propagarse a través de logs, métricas y
trazas distribuidas. No existe operación no rastreable.

### VIII. Seguridad

- Autenticación service-to-service obligatoria.
- Validación de payloads en todo punto de entrada.
- Rate limiting activo en todos los endpoints.
- Secretos fuera del código (variables de entorno o gestor de secretos).
- No almacenar credenciales directamente en tablas.
- Protección de información sensible (PII) en notificaciones.

### IX. Evolución Incremental

NO DEBEN crearse microservicios independientes innecesarios desde el
inicio. La arquitectura inicial DEBE ser:

```
Modular Monolith + Workers
```

Componentes solo DEBEN extraerse cuando exista una necesidad real
demostrada (cuello de botella de rendimiento, escalabilidad
independiente, despliegue independiente).

### X. Calidad

- TypeScript estricto (`strict: true`, sin `any`).
- ESLint sin excepciones no justificadas.
- Tests unitarios obligatorios para lógica de dominio.
- Tests de integración para flujos completos.
- Validación de contratos (OpenAPI/Swagger).
- Migraciones de base de datos versionadas.
- Logs estructurados (JSON).
- Manejo explícito de errores (no `throw` silencioso, no `catch` de `any`).

## Restricciones Tecnológicas

- **Lenguaje**: TypeScript en modo estricto.
- **Estilo**: ESLint + Prettier; reglas deshabilitadas requieren justificación.
- **Documentación de API**: OpenAPI/Swagger generado desde el código.
- **Base de datos**: Migraciones versionadas y reversibles.
- **Logs**: Formato JSON estructurado con correlación de identificadores.
- **Gestión de secretos**: Variables de entorno o gestor externo; nunca
  credenciales hardcodeadas ni almacenadas en texto plano.

## Puertas de Calidad y Flujo de Desarrollo

- Todo PR DEBE pasar tests unitarios y de integración.
- Todo PR DEBE pasar linting sin errores.
- Todo cambio de contrato de API DEBE actualizar la documentación Swagger.
- Code review obligatorio antes de merge.
- Toda nueva funcionalidad DEBE incluir tests que demuestren su comportamiento.
- Errores DEBEN manejarse de forma explícita; no se permite `catch`
  silencioso que oculta fallos.

## Governance

Esta constitución es el documento supremo del proyecto. Toda decisión
de arquitectura, implementación y revisión DEBE cumplir los principios
aquí establecidos.

**Procedimiento de enmienda**:

1. Proponer el cambio documentando el principio afectado y su justificación.
2. Revisar el impacto en el código existente y elaborar un plan de migración.
3. Aprobar por consenso del equipo.
4. Actualizar la versión según la política de versionado semántico.
5. Comunicar el cambio a todos los contribuyentes.

**Política de versionado** (semántica):

- **MAJOR**: Eliminación o redefinición incompatible de principios existentes.
- **MINOR**: Nuevo principio o expansión material de guía existente.
- **PATCH**: Clarificaciones, correcciones de redacción, refinamientos no
  semánticos.

**Revisión de cumplimiento**:

- Todo PR y code review DEBE verificar cumplimiento con esta constitución.
- Complejidad no justificada DEBE ser rechazada en revisión.
- Usar `.specify/memory/constitution.md` como referencia de desarrollo.

**Version**: 1.0.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11
