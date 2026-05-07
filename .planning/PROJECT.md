# Tikin Dashboard

## What This Is

Dashboard web para Tikin (billetera digital B2B que vende bonos corporativos a empresas y permite a los usuarios finales gastar en tarjetas o transferir a cuentas bancarias). Centraliza la información transaccional y operativa de la plataforma — actualmente dispersa en Google Sheets — en una página web con secciones (Inicio, Bonos, Payouts, Uso Tarjeta, Vista Cliente) que el equipo ejecutivo y comercial usa internamente y proyecta a clientes corporativos en llamadas. **v1.0 SHIPPED 2026-05-06**: 5 pestañas con auth + filtros globales + Modo Presentación + cliente-foco share-URL. **v2.0 EN CURSO** (2026-05-07): refactor a vista de **analytics operativa** según PRD detallado del usuario — pivot del lente "revenue" a "eficiencia/operativo" con métricas P0/P1/P2 priorizadas, parsing robusto de campos texto, y JOIN canónico via `transaction_id`.

## Current State

**Last shipped:** v1.0 MVP (2026-05-06) — production at https://project-dashboard-z0fpsm5hl.vercel.app
**Stack:** Next.js 16.2 (App Router) + TypeScript + Tailwind + recharts + Zod, sobre Google Sheets API (`googleapis` `batchGet`), auth con `jose` JWT + bcrypt + Upstash Redis para rate limit. ~9150 LOC TypeScript en 76 archivos.

Ver `.planning/MILESTONES.md` para resumen del milestone v1.0 y `.planning/milestones/v1.0-ROADMAP.md` para detalle de fases.

## Core Value

Una sola URL donde el equipo de Tikin ve métricas frescas del negocio (transacciones, payouts, eficiencia, actividad por usuario) sin tener que abrir Sheets ni armar reportes ad-hoc — y que se vea presentable cuando se proyecta a clientes.

**Validado en v1.0**: el cliente-foco share-URL (`?empresa=$X&presenter=1`) ejecuta el caso de proyección a clientes. **Refinado para v2.0**: la lente cambia de "revenue/comercial" a "analytics operativa" — usuarios activos, tasa de éxito, tipos de transacción, eficiencia de payouts, comportamiento por tikintag.

## Current Milestone: v2.0 Analytics

**Status:** Defining requirements (2026-05-07 started)

**Goal:** Refactor el dashboard a vista de analytics operativa según el PRD detallado. 5 secciones (Inicio, Bonos, Payouts, Uso Tarjeta, Vista Cliente) con métricas P0/P1/P2 priorizadas. JOIN canónico `BD_Plataforma.transaction_id ↔ BD_Payouts.Transaction ID`. Parsing robusto de campos texto (Aging, Total Time, Value, Transaction Cost). Reutilizar componentes/diseño/auth de v1.0 donde apliquen.

**PRD source of truth:** `~/Downloads/PRD_Dashboard_Tikin.docx` (extracted to `/tmp/prd_tikin.txt` durante esta sesión)

**Reuse strategy (v1.0 → v2.0):**
- ✓ Reuse: auth flow (login/JWT/bcrypt/rate-limit), Sheets adapter shell (googleapis + Zod schema validation by header name), force-dynamic page pattern, design system (shadcn/ui + Tailwind + recharts), componentes KPICard / Card / Tabs, layout `(protected)` + `PresenterFrame`, parseFilters / buildUrl URL-state utility.
- 🔄 Refactor: domain libraries (lente cambió de "empresas/revenue" a "tikintags/operativo"), schema (parse Aging/Total Time/Value text fields), filtros globales (añadir estado y tipo de transacción multi-select).
- ❌ Replace/eliminate: pestaña Recargas (PAYIN_PSE) → Uso Tarjeta (PURCHASE), KPIs de Comisión/Take rate/GMV (revenue lens) → Volumen IN/OUT/Tasa de éxito (operativo).
- ❓ TBD durante define-requirements: Modo Presentación + cliente-foco share-URL — el PRD no los menciona; son la inversión más diferenciada de v1.0 y podrían quedar fuera de scope o promoverse.

## Requirements

### Validated

<!-- Shipped y confirmados durante v1.0. Cumulative record across milestones. -->

- ✓ Web app en Next.js que lee Google Sheets en vivo vía API — v1.0
- ✓ Estructura de pestañas: Inicio, Bonos, Recargas, Payouts, Clientes — v1.0 (Recargas será reemplazada por Uso Tarjeta en v2.0; Clientes se renombra Vista Cliente y se enriquece)
- ✓ Auth con password compartido + cookie HttpOnly + rate limit — v1.0
- ✓ Filtros globales URL-persisted (date range + empresa) — v1.0 (v2.0 extiende con estado + tipo de transacción)
- ✓ Modo Presentación con CSS data-attribute system — v1.0 (TBD en v2.0)
- ✓ Cliente-foco share-URL (`?empresa=$X&presenter=1`) — v1.0 (TBD en v2.0)
- ✓ Despliegue en Vercel — v1.0
- ✓ Diseño presentable para clientes corporativos en llamadas — v1.0
- ✓ Lectura en vivo de Sheets con React `cache()` deduplicación — v1.0

### Active (v2.0 scope — refinar via /gsd:define-requirements)

<!-- Carry-forward del v1.0 milestone + nuevos goals derivados del PRD. -->

**Cross-cutting (todas las secciones)**
- [ ] **CROSS-V2-01** Filtro global de estado de transacción (completed / failed / in_progress)
- [ ] **CROSS-V2-02** Filtro global de tipo de transacción (multi-select: BONUS / PAYOUT_BANK / PURCHASE / P2P / PAYIN_PSE / etc.)
- [ ] **CROSS-V2-03** Parsing de campos texto: `Aging` y `Total Time` (`'X years X mons X days X hours X mins X secs'` → minutos), `Value` y `Transaction Cost` (`'COP X,XXX.XX'` → number)
- [ ] **CROSS-V2-04** JOIN canónico documentado: `BD_Plataforma.transaction_id ↔ BD_Payouts.Transaction ID` (corrige typo del PRD que decía `reference`)
- [ ] **CROSS-V2-05** Paleta por sección: Inicio Indigo · Bonos Violet · Payouts Cyan · Tarjeta Amber · Clientes Emerald
- [ ] **CROSS-V2-06** Modo oscuro (recomendado por PRD)

**Inicio (rebuilt)**
- [ ] **INI-V2-01** Usuarios activos: tikintags DISTINCT con ≥1 tx completed en período
- [ ] **INI-V2-02** Volumen total transaccionado, separado IN vs OUT
- [ ] **INI-V2-03** Tasa de éxito global (KPI + semáforo, dato actual: 98.1% / 1.6% / 0.2%)
- [ ] **INI-V2-04** Desglose por tipo de transacción (donut chart, max 6 segmentos + "Otros")
- [ ] **INI-V2-05** Actividad en el tiempo (línea con granularidad día/semana/mes selectable)
- [ ] **INI-V2-06** Top 10 usuarios por volumen (tabla rankeable)

**Bonos (rebuilt — split source/destination)**
- [ ] **BON-V2-01** Total bonos recibidos (BONUS · direction=in · tikintag = destination_transfer_tikintag)
- [ ] **BON-V2-02** Total bonos enviados (BONUS · direction=out · tikintag = source_transfer_tikintag)
- [ ] **BON-V2-03** Volumen total en bonos COP, dividido emitidos / recibidos
- [ ] **BON-V2-04** Ticket promedio por bono
- [ ] **BON-V2-05** Top emisores de bonos
- [ ] **BON-V2-06** Top receptores de bonos
- [ ] **BON-V2-07** Flujo de bonos en el tiempo (barras apiladas enviados vs recibidos)

**Payouts (extended)**
- [ ] **PAY-V2-01** 3 KPIs por estado (completed: 728 · failed: 63 · in_progress: 7) con color verde/rojo/amarillo
- [ ] **PAY-V2-02** Tasa de éxito de payouts (91.2% — KPI + semáforo)
- [ ] **PAY-V2-03** Tiempo promedio de procesamiento (parsing Total Time)
- [ ] **PAY-V2-04** Payouts pendientes con aging (tabla urgente, alert si superan 2h)
- [ ] **PAY-V2-05** Distribución por banco destino (top 5 + Otros, barras horizontales)
- [ ] **PAY-V2-06** Razones de fallo (Failure Reason — barras + tabla)
- [ ] **PAY-V2-07** Volumen total retirado COP (parsing Value)
- [ ] **PAY-V2-08** Pagos a terceros: Holder ≠ tikintag solicitante (KPI + tabla via JOIN transaction_id)

**Uso Tarjeta (NEW — replaces Recargas)**
- [ ] **CARD-V2-01** Total compras con tarjeta (PURCHASE · direction=out)
- [ ] **CARD-V2-02** Volumen total de compras COP
- [ ] **CARD-V2-03** Ticket promedio de compra
- [ ] **CARD-V2-04** Adopción de tarjeta (% usuarios con ≥1 PURCHASE)
- [ ] **CARD-V2-05** Tendencia de uso en el tiempo
- [ ] **CARD-V2-06** Top usuarios por uso de tarjeta (tabla rankeable)

**Vista Cliente (rebuilt — más rica)**
- [ ] **CLI-V2-01** Selector de tikintag (dropdown 235 usuarios — filtro principal)
- [ ] **CLI-V2-02** Tarjeta resumen del cliente: Balance · Primera tx · Última actividad · Total tx · Pocket activo (5 KPIs cabecera)
- [ ] **CLI-V2-03** Retiros banco enriquecidos via JOIN con BD_Payouts (tabla detallada)
- [ ] **CLI-V2-04** Bonos recibidos vs enviados del usuario (2 KPIs + monto)
- [ ] **CLI-V2-05** Transferencias P2P enviadas/recibidas (NEW — 2 KPIs + tabla)
- [ ] **CLI-V2-06** Compras con tarjeta del usuario (tabla + ticket promedio personal)
- [ ] **CLI-V2-07** Tiempo promedio de payouts del cliente vs benchmark plataforma (KPI comparativo)
- [ ] **CLI-V2-08** Timeline cronológico de toda la actividad del usuario (con ícono por tipo)

**Carry-forward de v1.0:**
- [ ] **INFRA-04** Migración a dominio propio (e.g. `dashboard.tikin.co`) — deferido en Phase 5/Plan 05-05; pendiente decisión del usuario sobre qué dominio usar

### Out of Scope

<!-- Boundaries explícitos. Razonamiento se mantiene a través de milestones. -->

- Login por usuario (email/password individuales o Google login) — password compartido funcionó en v1.0
- Acceso 24/7 de los clientes finales al dashboard — no es portal de cliente
- Multi-tenant con vistas propias por cliente — el cliente-foco share-URL en v1.0 cumple el caso sin cuentas
- Escritura/edición de data desde el dashboard — solo lectura
- Integración directa con el sistema core de Tikin — Sheets sigue siendo fuente de verdad
- Cache / refresh diferido — lectura en vivo en cada page load funcionó bien en v1.0
- Versión móvil dedicada — responsive básico es suficiente
- Real-time / WebSocket updates — polling es overkill para uso interno
- Drill-down a empleados / usuarios finales — PII en pantalla compartida con cliente
- ML forecasting / anomaly detection — riesgo de alucinación con cliente
- Botón de retry / acción manual sobre payouts fallidos — solo lectura
- Dashboards configurables / drag-drop por usuario — las 5 secciones SON los dashboards
- Alertas / notificaciones in-app — no es producto de monitoreo
- Drill-down a lista cruda de transacciones — riesgo de PII
- Per-user role-based widget visibility — Modo Presentación cubre el caso
- Goal/target lines en gráficas — targets requieren governance que no se va a mantener
- **Migración a Excel local** (sugerida ambiguamente por el PRD que dice "archivo BD_Tikin.xlsx") — el ID de Sheets sigue siendo la fuente; el PRD describe el data shape, no cambia la fuente

## Context

- **Negocio**: Tikin es una billetera digital B2B. Vende bonos corporativos a empresas y cobra un % por la transacción. Los empleados/usuarios finales reciben sus bonos y pueden gastar el dinero en tarjetas asociadas o transferirlo a sus cuentas bancarias.
- **Audiencias del dashboard**:
  - **Equipo ejecutivo** (interno): seguimiento de KPIs y salud del negocio
  - **Equipo comercial** (interno): visibilidad de pipeline, clientes activos, eficiencia operativa
  - **Clientes corporativos** (externo, indirecto): se les proyecta data filtrada en llamadas
- **Estado actual de la data** (post-v1.0, según PRD):
  - **BD_Plataforma**: 3,232 transacciones · 235 usuarios únicos (tikintags) · 12 tipos de transacción
  - **BD_Payouts**: 798 retiros bancarios procesados (728 completed, 63 failed, 7 in_progress)
  - **JOIN**: `BD_Plataforma.transaction_id ↔ BD_Payouts.Transaction ID` (verificado: 773/798 = 96.9% match)
  - **Distribución por tipo (PRD)**: BONUS 43% (1404 tx; 698 recibidos / 706 enviados) · PAYOUT_BANK 24% · PURCHASE 14% (446 compras tarjeta) · P2P 10% (308 transferencias) · otros
  - **Banco más usado**: Nequi 54.6% (436/798)
  - **Fallo más común**: Balance insuficiente (29 casos)
- **Filosofía de construcción**: iterativa por sección — funcionó bien en v1.0; v2.0 mantiene el patrón.
- **Antecedentes del usuario**: ha usado Looker Studio y Power BI antes; el dashboard custom validó esa decisión en v1.0 (presentación a clientes + Modo Presentación + cliente-foco no eran posibles en low-code).
- **Insight del usuario post-v1.0**: "me gusta cómo se ven las gráficas, pero le hace falta mucho más" — el design system de v1.0 sobrevive; lo que pivota es qué se muestra y bajo qué lente.

## Constraints

- **Tech stack**: Next.js 16.2 + Google Sheets API + Vercel — confirmado durante v1.0; sin cambios en v2.0.
- **Hosting**: Vercel funcionó en v1.0; dominio propio sigue pendiente (INFRA-04 deferido).
- **Auth**: password compartido único — v2.0 no cambia la decisión; deuda de seguridad documentada (5-char password, GCP key no rotada, env vars solo Production target).
- **Frescura de data**: lectura en vivo en cada page load + React `cache()` para deduplicación intra-render.
- **Fuente de datos**: Google Sheets sigue siendo fuente de verdad. El PRD describe la **estructura** del data, no cambia la **fuente**.
- **Audiencia mixta**: dashboard interno + presentable a clientes — TBD en v2.0 si se mantiene Modo Presentación o se reemplaza con un mecanismo distinto.
- **Sheet upstream depende del usuario**: el header de columna H del Sheet (transaction_id) fue editado externamente en algún momento (rompió temporalmente el dev local 2026-05-07; corregido). Riesgo: cualquier edición upstream del Sheet rompe el adapter — schema validation captura esto pero requiere intervención manual del usuario.

## Key Decisions

<!-- Decisions que constraen trabajo futuro. Outcomes capturados post-v1.0; v2.0 decisions agregadas según se tomen. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stack Next.js + Sheets API (vs Looker / Power BI / low-code) | Mejor presentación a clientes, control total del diseño | ✓ Validated v1.0 |
| Password compartido único (vs login por usuario) | Simplicidad — uso interno + presentaciones puntuales | ✓ Validated v1.0. ⚠️ Revisit: deuda de seguridad |
| Lectura en vivo de Sheets (vs cache / refresh diferido) | Data siempre fresca; volumen bajo | ✓ Validated v1.0 |
| Vercel inicial → dominio propio | Iterar rápido sin fricción | ⚠️ Pending: INFRA-04 deferido a v2.0+ |
| Sheets como fuente de verdad (vs integración directa al core) | No bloquea valor inmediato | ✓ Validated v1.0 |
| Construcción iterativa por sección (vs especificar todo upfront) | Visión de pestañas clara, data se afina en el camino | ✓ Validated v1.0 |
| PAY-04 reinterpretado como TopBancos (vs split tarjeta-vs-banco) | Data real tenía cero tarjetas | ✓ Good v1.0 — espíritu del requirement honrado |
| Cliente-foco gate via CSS data-attribute (vs React state propagation) | Ownership delegada a leaves; consistencia con Modo Presentación | ✓ Good v1.0 — TBD si se preserva en v2.0 |
| Per-task atomic commits + plan + phase metadata commits | Bisect-friendly | ✓ Good v1.0 — política mantenida en v2.0 |
| Vercel CLI fuera de PATH | Documentar como pre-condición de deploy tasks | ⚠️ Revisit: cada deploy requiere PATH export explícito |
| **v2.0 (no v1.1)** porque la lente del data model cambia (revenue → operativo) | Captura la magnitud del pivot; v1.1 sería un patch incremental | — Pending (decisión post-shipping) |
| **PRD es ground truth para data model y métricas v2.0** | Usuario invirtió en organizar reportes; ya pensó la lente correcta | — Pending |
| **JOIN canónico = `transaction_id`** (corrige typo del PRD que decía `reference`) | Verificado con datos: 773/798 (96.9%) match con `transaction_id`, 0/798 con `reference` | ✓ Good — documentado en cross-cutting requirements |
| **Reutilizar componentes/diseño/auth de v1.0** donde apliquen | Usuario aprobó el design system; refactorizar solo data + nuevas vistas | — Pending |

---
*Last updated: 2026-05-07 al iniciar milestone v2.0 Analytics*
