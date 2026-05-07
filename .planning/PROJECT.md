# Tikin Dashboard

## What This Is

Dashboard web para Tikin (billetera digital B2B que vende bonos corporativos a empresas y permite a los usuarios finales gastar en tarjetas o transferir a cuentas bancarias). Centraliza la información transaccional y operativa de la plataforma — actualmente dispersa en Google Sheets — en una página web con pestañas (Inicio, Bonos, Recargas, Payouts, Clientes) que el equipo ejecutivo y comercial usa internamente y proyecta a clientes corporativos en llamadas. **v1.0 SHIPPED 2026-05-06**: 5 pestañas funcionales end-to-end con auth + filtros globales + Modo Presentación + cliente-foco share-URL flow.

## Current State

**Shipped:** v1.0 MVP (2026-05-06)
**Production:** https://project-dashboard-z0fpsm5hl.vercel.app
**Stack:** Next.js 16.2 (App Router) + TypeScript + Tailwind + recharts + Zod, sobre Google Sheets API (`googleapis` `batchGet`), auth con `jose` JWT + bcrypt + Upstash Redis para rate limit. ~9150 LOC TypeScript en 76 archivos.

Ver `.planning/MILESTONES.md` para resumen del milestone y `.planning/milestones/v1.0-ROADMAP.md` para detalle de fases.

## Core Value

Una sola URL donde el equipo de Tikin ve métricas frescas del negocio (bonos vendidos, recargas, payouts, clientes activos) sin tener que abrir Sheets ni armar reportes ad-hoc — y que se vea presentable cuando se proyecta a clientes. **Validado en v1.0**: el cliente-foco share-URL (`?empresa=$X&presenter=1`) ejecuta exactamente este caso de uso.

## Requirements

### Validated

<!-- Shipped y confirmados durante v1.0. Cumulative record across milestones. -->

- ✓ Web app en Next.js que lee Google Sheets en vivo vía API — v1.0
- ✓ Estructura de pestañas: Inicio, Bonos, Recargas, Payouts, Clientes — v1.0
- ✓ Pestaña Inicio: vista de overview con 5 KPIs ejecutivos + 2 charts bucket-aware + 3 hechos curados — v1.0
- ✓ Pestaña Bonos: leaderboard + tabla + KPIs (ticket promedio, comisión) con cliente-foco hide — v1.0
- ✓ Pestaña Recargas: 2 KPIs + chart + top-10 + 2 hechos curados — v1.0
- ✓ Pestaña Payouts: P50/P95 + histograma latencia + TopBancos (split por destino con granularidad real) — v1.0
- ✓ Pestaña Clientes: lista 233 empresas + perfil con 12-month chart + 3 mini-cards + "Generar vista para cliente" — v1.0
- ✓ Conexión a las dos hojas de Google Sheets — v1.0 (BD_Plataforma 3188 tx + BD_Payouts 798 payouts)
- ✓ Password compartido único + sesión cookie HttpOnly + rate limit — v1.0
- ✓ Despliegue inicial en Vercel — v1.0
- ✓ Diseño presentable para clientes corporativos en llamadas — v1.0
- ✓ Capacidad de filtrar/segmentar para mostrar data de un cliente específico — v1.0 (cliente-foco share-URL)

### Active

<!-- Carry-forward del v1.0 milestone + nuevos goals para próximo milestone -->

- [ ] **Migración a dominio propio** (e.g. `dashboard.tikin.co`) — INFRA-04 deferido en Phase 5/Plan 05-05; pendiente decisión del usuario sobre qué dominio usar (`subdomain-tikin <domain>` / `apex-other <domain>` / `defer-domain`)
- [ ] Próximos goals a definir vía `/gsd:discuss-milestone` + `/gsd:new-milestone`

### Out of Scope

<!-- Boundaries explícitos. Razonamiento se mantiene a través de milestones. -->

- Login por usuario (email/password individuales o Google login) — password compartido funcionó en v1.0; sin demanda de cambio
- Acceso 24/7 de los clientes finales al dashboard — no es portal de cliente
- Multi-tenant con vistas propias por cliente — el cliente-foco share-URL en v1.0 cumple el caso sin cuentas
- Escritura/edición de data desde el dashboard — solo lectura
- Integración directa con el sistema core de Tikin — Sheets sigue siendo fuente de verdad
- Cache / refresh diferido — lectura en vivo en cada page load funcionó bien en v1.0 (React `cache()` deduplica intra-render)
- Versión móvil dedicada — responsive básico es suficiente
- Real-time / WebSocket updates — polling es overkill para uso interno
- Drill-down a empleados / usuarios finales — PII en pantalla compartida con cliente
- ML forecasting / anomaly detection — riesgo de alucinación en pantalla con cliente
- Botón de retry / acción manual sobre payouts fallidos — solo lectura
- Dashboards configurables / drag-drop por usuario — las 5 pestañas SON los dashboards
- Alertas / notificaciones in-app — no es producto de monitoreo
- Drill-down a lista cruda de transacciones — riesgo de PII
- Per-user role-based widget visibility — Modo Presentación cubre el caso
- Goal/target lines en gráficas — targets requieren governance que no se va a mantener

## Context

- **Negocio**: Tikin es una billetera digital B2B. Vende bonos corporativos a empresas y cobra un % por la transacción. Los empleados/usuarios finales reciben sus bonos y pueden gastar el dinero en tarjetas asociadas o transferirlo a sus cuentas bancarias.
- **Audiencias del dashboard**:
  - **Equipo ejecutivo** (interno): seguimiento de KPIs y salud del negocio
  - **Equipo comercial** (interno): visibilidad de pipeline, clientes activos, bonos vendidos
  - **Clientes corporativos** (externo, indirecto): se les proyecta data filtrada en llamadas (cliente-foco share-URL implementa esto explícitamente)
- **Estado actual de la data**: dos hojas en Google Sheets (BD_Plataforma con 3188 tx + BD_Payouts con 798 payouts; 233 empresas únicas via `tikintag`).
- **Filosofía de construcción**: iterativa por pestaña — funcionó bien en v1.0 (Phase 4 Inicio agregó shapes de data ya cargadas en Phases 2-3 sin re-trabajo).
- **Antecedentes del usuario**: ha usado Looker Studio y Power BI antes; descartó esa ruta por preferencia de página web custom (mejor presentación a clientes y más control). Validado en v1.0 — el design system + cliente-foco share-URL + Modo Presentación no se podrían haber hecho en herramienta low-code.
- **Insights post-shipping**: 3 v2 features ahora v1-eligible para próximo milestone (REC-V2-01 success rate + PAY-V2-02 failure breakdown — sus columnas-blocker resultaron existir en producción).

## Constraints

- **Tech stack**: Next.js 16.2 + Google Sheets API + Vercel — confirmado durante v1.0
- **Hosting**: Vercel funcionó en v1.0; dominio propio sigue pendiente (INFRA-04 deferido)
- **Auth**: password compartido único — funcionó en v1.0; deuda de seguridad documentada (5-char password, GCP key no rotada, env vars solo Production)
- **Frescura de data**: lectura en vivo confirmada — quota de Sheets nunca tocó techo
- **Fuente de datos**: Google Sheets sigue siendo fuente de verdad
- **Audiencia mixta**: Modo Presentación + cliente-foco share-URL resolvió la audiencia mixta en v1.0

## Key Decisions

<!-- Decisions que constraen trabajo futuro. Outcomes capturados post-v1.0. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stack Next.js + Sheets API (vs Looker / Power BI / low-code) | Mejor presentación a clientes, control total del diseño | ✓ Validated v1.0 — Modo Presentación + cliente-foco no eran posibles en low-code |
| Password compartido único (vs login por usuario) | Simplicidad — uso interno + presentaciones puntuales | ✓ Validated v1.0 — sin demanda de cambio. ⚠️ Revisit: deuda de seguridad (5-char password, GCP key no rotada). |
| Lectura en vivo de Sheets (vs cache / refresh diferido) | Data siempre fresca; volumen bajo | ✓ Validated v1.0 — React `cache()` deduplica intra-render; quota nunca tocó techo |
| Vercel inicial → dominio propio | Iterar rápido sin fricción | ⚠️ Pending: dominio propio (INFRA-04) deferido a próximo milestone |
| Sheets como fuente de verdad (vs integración directa al core) | No bloquea valor inmediato | ✓ Validated v1.0 — adapter abstrae el boundary; el día que se mueva al core, solo cambia el adapter |
| Construcción iterativa por pestaña (vs especificar todo upfront) | Visión de pestañas clara, data se afina en el camino | ✓ Validated v1.0 — Phase 4 reutilizó shapes de Phase 2-3 sin re-trabajo |
| PAY-04 reinterpretado como TopBancos (vs split tarjeta-vs-banco) | Data real tenía cero tarjetas | ✓ Good — espíritu del requirement honrado con granularidad real |
| Cliente-foco gate via CSS data-attribute (vs React state propagation) | Ownership delegada a leaves; consistencia con Modo Presentación | ✓ Good — funcionó en /bonos, /payouts, /inicio, /recargas, /clientes sin re-arquitectura |
| Per-task atomic commits + plan + phase metadata commits | Bisect-friendly | ✓ Good — 88 commits en 10 días, 1 por unidad verificable |
| Vercel CLI fuera de PATH | Documentar como pre-condición de deploy tasks | ⚠️ Revisit: cada vez que se ejecuta un deploy task, requiere PATH export explícito |

---
*Last updated: 2026-05-06 después del milestone v1.0*
