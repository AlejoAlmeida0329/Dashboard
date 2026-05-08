# Requirements: Tikin Dashboard v2.0 Analytics

**Defined:** 2026-05-07
**Milestone:** v2.0 Analytics — refactor a vista de analytics operativa según PRD v2
**Core Value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio (transacciones, payouts, eficiencia, actividad por usuario) sin tener que abrir Sheets ni armar reportes ad-hoc — y que se vea presentable cuando se proyecta a clientes.

**Source of truth:** PRD v2 (`~/Downloads/PRD_Dashboard_Tikin_v2.docx`) → reflejado en `PROJECT.md` "Active (v2.0 scope)". El research del v1.0 (`research/FEATURES.md`, lente revenue) está superseded por el pivot del PRD v2 a lente operativa. Los 18 deferreds del v1.0 archive quedan registrados en `milestones/v1.0-REQUIREMENTS.md` y NO carry-forward a este REQUIREMENTS.md (decisión 2026-05-07).

## v1 Requirements

51 requirements del milestone v2.0 distribuidos en 8 categorías. "v1" en este archivo = scope committed para esta milestone (v2.0 del producto).

### Cross-cutting

- [x] **CROSS-V2-01**: Filtro global de estado de transacción (completed / failed / in_progress)
- [x] **CROSS-V2-02**: Filtro global de tipo de transacción (multi-select: BONUS / PAYOUT_BANK / PURCHASE / P2P / PAYIN_PSE / PAYIN_TRANSFER / etc.)
- [x] **CROSS-V2-03**: Parsing robusto de campos texto del Sheet — `Aging` y `Total Time` (formato `'X years X mons X days X hours X mins X secs'` → minutos), `Value` y `Transaction Cost` (formato `'COP X,XXX.XX'` → number)
- [x] **CROSS-V2-04**: JOIN canónico `BD_Plataforma.transaction_id ↔ BD_Payouts.Transaction ID`. El código usa `transaction_id`; JSDoc en cada función que lo use cita al PRD por su nombre semántico (`reference`). Verificación con datos: 773/798 (96.9%) match con `transaction_id`; 0/798 con la columna `reference` real (que contiene hex hashes blockchain, no JOIN keys).
- [x] **CROSS-V2-05**: Paleta por sección — Inicio Indigo `#4F46E5` · Bonos Violet `#7C3AED` · Payouts Cyan `#0891B2` · Tarjeta Amber `#D97706` · Clientes Emerald `#059669` · Recargas Teal `#0F766E`. Estados: Verde `#059669` completed · Rojo `#DC2626` failed · Amarillo `#D97706` in_progress.
- [x] **CROSS-V2-06**: Modo oscuro (recomendado por PRD)
- [x] **CROSS-V2-07**: Modo Presentación con visibility por métrica en Vista Cliente — dual-purpose declarado por PRD: 🔍 Uso Interno (todo visible) vs 🤝 Reuniones con Clientes (`presenter=1` oculta métricas internas). Reglas por métrica documentadas en CLI-V2-02..08. El mecanismo (CSS data-attribute system + cliente-foco share-URL `?empresa=$X&presenter=1`) se reutiliza de v1.0.

### Inicio (rebuilt — operativo lens)

- [x] **INI-V2-01**: Usuarios activos — tikintags DISTINCT con ≥1 tx completed en el período
- [x] **INI-V2-02**: Volumen total transaccionado, separado IN vs OUT
- [x] **INI-V2-03**: Tasa de éxito global (KPI + semáforo). Baseline data: 98.1% completed / 1.6% failed / 0.2% in_progress
- [x] **INI-V2-04**: Desglose por tipo de transacción (donut chart, max 6 segmentos + "Otros")
- [x] **INI-V2-05**: Actividad en el tiempo (línea con granularidad día/semana/mes selectable)
- [x] **INI-V2-06**: Top 10 usuarios por volumen (tabla rankeable)

### Bonos (rebuilt — split source/destination)

- [x] **BON-V2-01**: Total bonos recibidos (BONUS · direction=in · tikintag = `destination_transfer_tikintag`)
- [x] **BON-V2-02**: Total bonos enviados (BONUS · direction=out · tikintag = `source_transfer_tikintag`)
- [x] **BON-V2-03**: Volumen total en bonos COP, dividido emitidos / recibidos
- [x] **BON-V2-04**: Ticket promedio por bono
- [x] **BON-V2-05**: Top emisores de bonos
- [x] **BON-V2-06**: Top receptores de bonos
- [x] **BON-V2-07**: Flujo de bonos en el tiempo (barras apiladas enviados vs recibidos)

### Payouts (extended)

- [x] **PAY-V2-01**: 3 KPIs por estado con color verde/rojo/amarillo. Baseline: completed 728 · failed 63 · in_progress 7
- [x] **PAY-V2-02**: Tasa de éxito de payouts (KPI + semáforo). Baseline: 91.2%
- [x] **PAY-V2-03**: Tiempo promedio de procesamiento (parsing `Total Time`)
- [x] **PAY-V2-04**: Payouts pendientes con aging (tabla urgente, alert si superan 2h)
- [x] **PAY-V2-05**: Distribución por banco destino (top 5 + Otros, barras horizontales). Baseline: Nequi 54.6% (436/798)
- [x] **PAY-V2-06**: Razones de fallo (`Failure Reason` — barras + tabla). Baseline: Balance insuficiente más común (29 casos)
- [x] **PAY-V2-07**: Volumen total retirado COP (parsing `Value`)
- [x] **PAY-V2-08**: Pagos a terceros — Holder ≠ tikintag solicitante (KPI + tabla via JOIN `transaction_id`)

### Uso Tarjeta (NEW — replaces v1.0 Recargas slot in tab order)

- [x] **CARD-V2-01**: Total compras con tarjeta (PURCHASE · direction=out)
- [x] **CARD-V2-02**: Volumen total de compras COP
- [x] **CARD-V2-03**: Ticket promedio de compra
- [x] **CARD-V2-04**: Adopción de tarjeta (% usuarios con ≥1 PURCHASE)
- [x] **CARD-V2-05**: Tendencia de uso en el tiempo
- [x] **CARD-V2-06**: Top usuarios por uso de tarjeta (tabla rankeable)

### Vista Cliente (rebuilt — más rica, dual-purpose)

> **Dual-purpose declarado por PRD v2** (gobernado por CROSS-V2-07):
> - 🔍 **Uso Interno**: detectar patrones, anomalías, clientes de alto valor. Visibility = TODO visible (no presenter-hide).
> - 🤝 **Reuniones con Clientes**: argumento de valor en tiempo real. Visibility = aplicar `presenter=1` para ocultar métricas internas (timeline crudo, anomalías).

- [x] **CLI-V2-01**: Selector de tikintag (dropdown de 235 usuarios — filtro principal de la sección)
- [x] **CLI-V2-02**: Tarjeta resumen del cliente — Balance · Primera tx · Última actividad · Total tx · Pocket activo (5 KPIs cabecera). **Visibility: todas visibles en presenter.**
- [x] **CLI-V2-03**: Retiros banco enriquecidos via JOIN con BD_Payouts (tabla detallada). **Visibility: visible en presenter — argumento de valor.**
- [x] **CLI-V2-04**: Bonos recibidos vs enviados del usuario (2 KPIs + monto). **Visibility: visibles.**
- [x] **CLI-V2-05**: Transferencias P2P enviadas/recibidas (NEW — 2 KPIs + tabla). **Visibility: visibles.**
- [x] **CLI-V2-06**: Compras con tarjeta del usuario (tabla + ticket promedio personal). **Visibility: visible.**
- [x] **CLI-V2-07**: Tiempo promedio de payouts del cliente vs benchmark plataforma (KPI comparativo). **Visibility: clave en presenter — argumento de eficiencia.**
- [x] **CLI-V2-08**: Timeline cronológico de toda la actividad del usuario (con ícono por tipo). **Visibility: presenter-hide en cliente-foco — uso interno; revela patrones que no se muestran a clientes.**

### Recargas (refactored — extiende a PAYIN_TRANSFER + métricas PRD v2)

> Datos baseline: 137 recargas (116 PSE + 21 Transfer) · 40 usuarios únicos (17% adopción) · ~$743M COP volumen · Recarga promedio $5.4M · 100% completadas.

- [x] **REC-V2-01**: Total recargas realizadas (PAYIN_PSE + PAYIN_TRANSFER, direction=in)
- [x] **REC-V2-02**: Volumen total recargado COP
- [x] **REC-V2-03**: Usuarios que han recargado (KPI + % de adopción 40/235)
- [x] **REC-V2-04**: PSE vs Transferencia (2 KPIs o donut con split 85% / 15%)
- [x] **REC-V2-05**: Recarga promedio
- [x] **REC-V2-06**: Distribución de montos (histograma: <$100K / $100K-$1M / >$1M)
- [x] **REC-V2-07**: Top usuarios por volumen recargado (tabla rankeable)
- [x] **REC-V2-08**: Recargas en el tiempo (línea temporal)

### Infrastructure

- [ ] **INFRA-04**: Migración a dominio propio (e.g. `dashboard.tikin.co`) — carry-forward del v1.0; diferido en Plan 05-05/Phase 5. **Deferido nuevamente 2026-05-08 en Plan 10-03** — usuario optó por shipping de v2.0 sin custom domain ("lo del dominio lo hago despues"); cliente-foco UX continúa via `*.vercel.app` + Vercel SSO challenge hasta que un milestone futuro lo resucite. Carry-forward chain abierto.

## v2 Requirements (Deferred)

Vacío al iniciar este milestone. Los carry-forwards del v1.0 archive (period-vs-period comparison, PDF export, print stylesheet, YoY, cohorts, heatmaps, health badges, concentration view, etc.) NO se trasladan a este REQUIREMENTS.md por decisión del usuario (2026-05-07): el PRD v2 pivotó la lente y no los priorizó. Quedan registrados en `milestones/v1.0-REQUIREMENTS.md` para referencia histórica; si surge demanda durante la ejecución, se evaluan caso por caso vía `/gsd:add-todo`.

## Out of Scope

Exclusiones explícitas para prevenir scope creep. Razonamiento se mantiene a través de milestones.

| Feature | Razón |
|---------|-------|
| Login por usuario (email/password individuales o Google login) | Password compartido funcionó en v1.0 |
| Acceso 24/7 de los clientes finales al dashboard | No es portal de cliente |
| Multi-tenant con vistas propias por cliente | Cliente-foco share-URL en v1.0 cumple el caso sin cuentas |
| Escritura/edición de data desde el dashboard | Solo lectura |
| Integración directa con el sistema core de Tikin | Sheets sigue siendo fuente de verdad |
| Cache / refresh diferido | Lectura en vivo en cada page load funcionó bien en v1.0 |
| Versión móvil dedicada | Responsive básico es suficiente |
| Real-time / WebSocket updates | Polling es overkill para uso interno |
| Drill-down a empleados / usuarios finales | PII en pantalla compartida con cliente |
| ML forecasting / anomaly detection | Riesgo de alucinación con cliente |
| Botón de retry / acción manual sobre payouts fallidos | Solo lectura |
| Dashboards configurables / drag-drop por usuario | Las 6 secciones SON los dashboards |
| Alertas / notificaciones in-app | No es producto de monitoreo |
| Drill-down a lista cruda de transacciones | Riesgo de PII |
| Per-user role-based widget visibility | Modo Presentación cubre el caso (CROSS-V2-07) |
| Goal/target lines en gráficas | Targets requieren governance que no se va a mantener |
| Migración a Excel local (sugerida ambiguamente por PRD) | Sheets sigue siendo la fuente; PRD describe data shape, no cambia la fuente |

## Traceability

Mapped during `/gsd:create-roadmap` (2026-05-07). All 51 v1 requirements mapped to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CROSS-V2-01 | Phase 6 | Complete |
| CROSS-V2-02 | Phase 6 | Complete |
| CROSS-V2-03 | Phase 6 | Complete |
| CROSS-V2-04 | Phase 6 | Complete |
| CROSS-V2-05 | Phase 6 | Complete |
| CROSS-V2-06 | Phase 6 | Complete |
| CROSS-V2-07 | Phase 6 | Complete |
| BON-V2-01   | Phase 7 | Complete |
| BON-V2-02   | Phase 7 | Complete |
| BON-V2-03   | Phase 7 | Complete |
| BON-V2-04   | Phase 7 | Complete |
| BON-V2-05   | Phase 7 | Complete |
| BON-V2-06   | Phase 7 | Complete |
| BON-V2-07   | Phase 7 | Complete |
| PAY-V2-01   | Phase 7 | Complete |
| PAY-V2-02   | Phase 7 | Complete |
| PAY-V2-03   | Phase 7 | Complete |
| PAY-V2-04   | Phase 7 | Complete |
| PAY-V2-05   | Phase 7 | Complete |
| PAY-V2-06   | Phase 7 | Complete |
| PAY-V2-07   | Phase 7 | Complete |
| PAY-V2-08   | Phase 7 | Complete |
| CARD-V2-01  | Phase 8 | Complete |
| CARD-V2-02  | Phase 8 | Complete |
| CARD-V2-03  | Phase 8 | Complete |
| CARD-V2-04  | Phase 8 | Complete |
| CARD-V2-05  | Phase 8 | Complete |
| CARD-V2-06  | Phase 8 | Complete |
| REC-V2-01   | Phase 8 | Complete |
| REC-V2-02   | Phase 8 | Complete |
| REC-V2-03   | Phase 8 | Complete |
| REC-V2-04   | Phase 8 | Complete |
| REC-V2-05   | Phase 8 | Complete |
| REC-V2-06   | Phase 8 | Complete |
| REC-V2-07   | Phase 8 | Complete |
| REC-V2-08   | Phase 8 | Complete |
| CLI-V2-01   | Phase 9 | Complete |
| CLI-V2-02   | Phase 9 | Complete |
| CLI-V2-03   | Phase 9 | Complete |
| CLI-V2-04   | Phase 9 | Complete |
| CLI-V2-05   | Phase 9 | Complete |
| CLI-V2-06   | Phase 9 | Complete |
| CLI-V2-07   | Phase 9 | Complete |
| CLI-V2-08   | Phase 9 | Complete |
| INI-V2-01   | Phase 10 | Complete |
| INI-V2-02   | Phase 10 | Complete |
| INI-V2-03   | Phase 10 | Complete |
| INI-V2-04   | Phase 10 | Complete |
| INI-V2-05   | Phase 10 | Complete |
| INI-V2-06   | Phase 10 | Complete |
| INFRA-04    | Phase 10 | Pending (deferred 2026-05-08 in Plan 10-03 — user chose to ship v2.0 without custom domain; carry-forward to next milestone) |

**Coverage:**
- v1 requirements: 51 total
- Mapped to phases: 51 ✓
- Unmapped: 0 ✓

**Phase distribution:**
- Phase 6 (Foundation v2): 7 reqs — CROSS-V2-01..07
- Phase 7 (Bonos + Payouts): 15 reqs — BON-V2-01..07 + PAY-V2-01..08
- Phase 8 (Uso Tarjeta + Recargas): 14 reqs — CARD-V2-01..06 + REC-V2-01..08
- Phase 9 (Vista Cliente): 8 reqs — CLI-V2-01..08
- Phase 10 (Inicio + Infrastructure): 7 reqs — INI-V2-01..06 + INFRA-04

---
*Requirements defined: 2026-05-07*
*Last updated: 2026-05-08 — Phase 10 closeout: INI-V2-01..06 Complete; INFRA-04 deferred carry-forward*
