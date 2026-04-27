# Tikin Dashboard

## What This Is

Dashboard web para Tikin (billetera digital B2B que vende bonos corporativos a empresas y permite a los usuarios finales gastar en tarjetas o transferir a cuentas bancarias). Centraliza la información transaccional y operativa de la plataforma — actualmente dispersa en Google Sheets — en una página web con pestañas (Inicio, Bonos, Recargas, Payouts, Clientes) que el equipo ejecutivo y comercial usa internamente y proyecta a clientes corporativos en llamadas.

## Core Value

Una sola URL donde el equipo de Tikin ve métricas frescas del negocio (bonos vendidos, recargas, payouts, clientes activos) sin tener que abrir Sheets ni armar reportes ad-hoc — y que se vea presentable cuando se proyecta a clientes.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Web app en Next.js que lee Google Sheets en vivo vía API
- [ ] Estructura de pestañas: Inicio, Bonos, Recargas, Payouts, Clientes
- [ ] Pestaña **Inicio**: vista de overview con KPIs principales del negocio (a definir progresivamente)
- [ ] Pestaña **Bonos**: data sobre venta de bonos corporativos (revenue principal vía % de comisión)
- [ ] Pestaña **Recargas**: movimientos de recargas en la plataforma
- [ ] Pestaña **Payouts**: data de retiros (a tarjetas y a cuentas bancarias) más data de tiempos de payouts
- [ ] Pestaña **Clientes**: información sobre los clientes corporativos (las empresas que compran bonos)
- [ ] Conexión con las dos hojas de Google Sheets actuales (transacciones de plataforma y tiempos de payouts)
- [ ] Password compartido único para proteger el acceso (todo el equipo usa el mismo)
- [ ] Despliegue inicial en Vercel
- [ ] Migración a dominio propio (ej. `dashboard.tikin.co`) cuando esté estable
- [ ] Diseño presentable para mostrar a clientes corporativos en llamadas
- [ ] Capacidad de filtrar/segmentar para mostrar la data de un cliente específico en presentaciones

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Login por usuario (email/password individuales o Google login) — se decidió password compartido por simplicidad
- Acceso 24/7 de los clientes finales al dashboard — los clientes solo lo ven cuando Tikin proyecta en llamadas, no es un portal de cliente
- Multi-tenant con vistas propias por cliente — se resuelve filtrando data, no creando cuentas
- Escritura/edición de data desde el dashboard — es solo lectura de Sheets
- Integración directa con el sistema core de Tikin — fuente de verdad sigue siendo Google Sheets en esta etapa
- Cache / refresh diferido — la lectura es en vivo en cada carga
- Versión móvil dedicada — diseño responsive básico es suficiente, el uso primario es desktop/proyección

## Context

- **Negocio**: Tikin es una billetera digital B2B. Vende bonos corporativos a empresas y cobra un % por la transacción. Los empleados/usuarios finales reciben sus bonos y pueden gastar el dinero en tarjetas asociadas o transferirlo a sus cuentas bancarias.
- **Audiencias del dashboard**:
  - **Equipo ejecutivo** (interno): seguimiento de KPIs y salud del negocio
  - **Equipo comercial** (interno): visibilidad de pipeline, clientes activos, bonos vendidos
  - **Clientes corporativos** (externo, indirecto): se les proyecta data filtrada en llamadas comerciales / de seguimiento
- **Estado actual de la data**: dos hojas en Google Sheets:
  1. Transacciones de la plataforma (todo lo transaccionado)
  2. Tiempos de payouts
- **Filosofía de construcción**: iterativa. Se va organizando la información por pestaña a medida que avanza el proyecto, no se intenta especificar todo al inicio.
- **Antecedentes del usuario**: ha usado Looker Studio y Power BI antes; descarta esa ruta porque quiere una página web custom (mejor presentación a clientes y más control).

## Constraints

- **Tech stack**: Next.js + Google Sheets API — decidido por preferencia y por margen de personalización para presentación a clientes
- **Hosting**: Vercel para fase de prueba; dominio propio (esperado `dashboard.tikin.co` o similar) para producción
- **Auth**: password compartido único — sin gestión de usuarios individuales
- **Frescura de data**: lectura en vivo en cada page load contra Google Sheets API
- **Fuente de datos**: Google Sheets como fuente de verdad mientras dura esta etapa del proyecto
- **Audiencia mixta**: el diseño debe ser usable internamente y a la vez presentable a clientes corporativos

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stack Next.js + Sheets API (vs Looker Studio / Power BI / low-code) | Mejor presentación a clientes, control total del diseño, margen para crecer cuando salga de Sheets | — Pending |
| Password compartido único (vs login por usuario) | Simplicidad — uso interno + presentaciones puntuales, no justifica gestión de cuentas | — Pending |
| Lectura en vivo de Sheets (vs cache / refresh diferido) | Data siempre fresca; volumen de tráfico bajo (uso interno) hace que la latencia sea aceptable | — Pending |
| Vercel inicial → dominio propio | Vercel para iterar rápido sin fricción; dominio propio cuando esté listo para presentar formalmente | — Pending |
| Sheets como fuente de verdad (vs integración directa al core) | Es el estado actual del negocio; integración directa es trabajo grande que no bloquea valor inmediato | — Pending |
| Construcción iterativa por pestaña (vs especificar todo upfront) | El usuario tiene visión clara de pestañas pero la data específica se afina en el camino | — Pending |

---
*Last updated: 2026-04-27 after initialization*
