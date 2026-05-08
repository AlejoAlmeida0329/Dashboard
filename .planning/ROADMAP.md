# Roadmap: Tikin Dashboard

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-05-06)
- 🚧 **v2.0 Analytics** — Phases 6-10 (in planning, started 2026-05-07)

## Overview

v1.0 entregó el dashboard interno + presentable a clientes con 5 pestañas, auth, filtros globales y Modo Presentación + cliente-foco share-URL. v2.0 refactoriza el contenido a una **lente operativa** (usuarios activos, tasa de éxito, tipos de transacción, eficiencia de payouts, comportamiento por tikintag) según el PRD v2 del usuario, manteniendo el design system y la auth. Pivota de empresas/revenue a tikintags/operativo, añade pestaña Uso Tarjeta (NEW), refactoriza Recargas con PAYIN_TRANSFER, enriquece Vista Cliente con dual-purpose declarado, y consolida la fundación cross-cutting (parsing de campos texto, JOIN canónico `transaction_id`, filtros globales extendidos).

## Phases

**Phase Numbering:**
- Integer phases (6, 7, 8…): Planned milestone work
- Decimal phases (6.1, 6.2…): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-05-06</summary>

Detalle archivado en [.planning/milestones/v1.0-ROADMAP.md](./milestones/v1.0-ROADMAP.md). Resumen en [.planning/MILESTONES.md](./MILESTONES.md).

- [x] **Phase 1: Foundation** — auth + Sheets adapter + layout shell
- [x] **Phase 2: Bonos** — leaderboard + tabla + KPIs
- [x] **Phase 3: Payouts** — P50/P95 + histograma latencia + TopBancos
- [x] **Phase 4: Inicio + Recargas** — 5 KPIs + 2 charts + 3 hechos curados (Inicio); Recargas tab
- [x] **Phase 5: Clientes + Domain** — lista 233 empresas + perfil con cliente-foco share-URL (INFRA-04 deferido)

</details>

### 🚧 v2.0 Analytics (Phases 6-10) — In planning

**Milestone Goal:** Refactor a vista de analytics operativa según PRD v2. 6 secciones (Inicio · Bonos · Payouts · Uso Tarjeta · Vista Cliente · Recargas) con métricas P0/P1/P2 priorizadas, parsing robusto de campos texto, JOIN canónico via `transaction_id`, dual-purpose declarado en Vista Cliente.

- [x] **Phase 6: Foundation v2** — cross-cutting: parsing utils, JOIN helper, filtros globales extendidos, paleta por sección, dark mode, sistema de visibility por métrica
- [x] **Phase 7: Bonos + Payouts (rebuilt)** — split source/destination en Bonos; eficiencia/banco/fallos/terceros en Payouts
- [x] **Phase 8: Uso Tarjeta + Recargas** — pestaña nueva PURCHASE; Recargas extendida con PAYIN_TRANSFER
- [ ] **Phase 9: Vista Cliente (rebuilt)** — selector tikintag, 5 KPIs cabecera, JOIN enriquecido, P2P, tiempo vs benchmark, timeline cronológico (dual-purpose visibility)
- [ ] **Phase 10: Inicio + Infrastructure** — home page agregada (operativo lens) + dominio propio (INFRA-04)

## Phase Details

### Phase 6: Foundation v2

**Goal:** Cross-cutting infrastructure que cada sección hereda — parsing de campos texto del Sheet, JOIN helper canónico `transaction_id`, filtros globales extendidos (estado + tipo de transacción), paleta por sección, dark mode, sistema de visibility por métrica para Vista Cliente dual-purpose.

**Depends on:** v1.0 milestone shipped (Phases 1-5)

**Requirements:** CROSS-V2-01, CROSS-V2-02, CROSS-V2-03, CROSS-V2-04, CROSS-V2-05, CROSS-V2-06, CROSS-V2-07

**Success Criteria** (what must be TRUE):
1. `parseAging()` y `parseTotalTime()` convierten strings tipo `'X years X mons X days X hours X mins X secs'` a minutos correctamente para todos los formatos presentes en el Sheet
2. `parseCOPAmount()` convierte strings `'COP X,XXX.XX'` a `number` correctamente, incluyendo edge cases (negativos, ceros, vacíos)
3. `joinPayouts()` retorna 773/798 (96.9%) match usando `BD_Plataforma.transaction_id ↔ BD_Payouts.Transaction ID`
4. Filtro global de **estado de transacción** (completed/failed/in_progress) y **tipo de transacción** (multi-select) persisten via URL `searchParams` y se aplican a queries en todas las pestañas
5. Paleta por sección aplicada (Inicio Indigo · Bonos Violet · Payouts Cyan · Tarjeta Amber · Clientes Emerald · Recargas Teal) + colores de estado (Verde/Rojo/Amarillo)
6. Toggle de modo oscuro funcional site-wide con persistencia
7. Sistema `data-presenter-metric-hide` extendido del v1.0 permite ocultar métricas individuales en `presenter=1`

**Research:** Likely
**Research topics:** Tailwind v4 + shadcn dark mode pattern (next-themes); edge cases de parsing en formatos de PostgreSQL interval-like; verificación de schema Zod para nuevos campos texto

### Phase 7: Bonos + Payouts (rebuilt + extended)

**Goal:** Bonos refactorizado con split source/destination (top emisores vs top receptores, flujo enviados vs recibidos); Payouts extendido con tiempo promedio, aging alert, razones de fallo, distribución por banco, pagos a terceros via JOIN.

**Depends on:** Phase 6 (parsing utils + JOIN helper + filtros + paleta)

**Requirements:** BON-V2-01, BON-V2-02, BON-V2-03, BON-V2-04, BON-V2-05, BON-V2-06, BON-V2-07, PAY-V2-01, PAY-V2-02, PAY-V2-03, PAY-V2-04, PAY-V2-05, PAY-V2-06, PAY-V2-07, PAY-V2-08

**Success Criteria** (what must be TRUE):
1. Bonos page muestra **total recibidos vs enviados** filtrando por `destination_transfer_tikintag` y `source_transfer_tikintag` correctamente; ticket promedio + volumen split emitidos/recibidos visibles
2. Bonos page muestra **top emisores y top receptores** en tablas rankeables, más flujo temporal en barras apiladas (enviados vs recibidos)
3. Payouts page muestra **3 KPIs por estado** con colores semáforo (completed 728 verde · failed 63 rojo · in_progress 7 amarillo) y **tasa de éxito** (91.2%) con semáforo
4. Payouts page calcula **tiempo promedio** vía parsing `Total Time`, muestra **aging alert** (>2h pendientes), **distribución por banco** (Nequi 54.6% top), **razones de fallo** (Balance insuficiente más común), **volumen retirado COP** vía parsing `Value`
5. Payouts page muestra **pagos a terceros** (Holder ≠ tikintag) en KPI + tabla via JOIN `transaction_id` → `Holder`

**Research:** Unlikely (extiende patrones establecidos de v1.0 Bonos y Payouts)

### Phase 8: Uso Tarjeta + Recargas

**Goal:** Pestaña nueva Uso Tarjeta (PURCHASE) con KPIs, adopción y tendencia. Recargas refactorizada para incluir PAYIN_TRANSFER junto a PAYIN_PSE con métricas del PRD v2 (137 recargas, 40 usuarios, $743M COP).

**Depends on:** Phase 6 (parsing utils + filtros + paleta)

**Requirements:** CARD-V2-01, CARD-V2-02, CARD-V2-03, CARD-V2-04, CARD-V2-05, CARD-V2-06, REC-V2-01, REC-V2-02, REC-V2-03, REC-V2-04, REC-V2-05, REC-V2-06, REC-V2-07, REC-V2-08

**Success Criteria** (what must be TRUE):
1. Uso Tarjeta tab live en `/uso-tarjeta` con **KPIs** (compras totales, volumen COP, ticket promedio, adopción % usuarios con ≥1 PURCHASE)
2. Uso Tarjeta tab muestra **tendencia temporal** (granularidad día/semana/mes) y **top usuarios** por uso de tarjeta en tabla rankeable
3. Recargas tab unifica **PAYIN_PSE + PAYIN_TRANSFER** = 137 recargas con totales, volumen ($743M COP), **adopción** (40/235 = 17%), recarga promedio ($5.4M)
4. Recargas tab muestra **split PSE vs Transfer** (~85%/15%), **distribución por monto** (histograma <$100K / $100K-$1M / >$1M), **top usuarios** rankeables, **tendencia temporal**

**Research:** Unlikely (Uso Tarjeta sigue patrones de Bonos/Payouts; Recargas extiende implementación v1.0)

### Phase 9: Vista Cliente (rebuilt — dual-purpose)

**Goal:** Vista Cliente refactorizada con selector tikintag (235 usuarios), 5 KPIs cabecera, retiros banco enriquecidos via JOIN, P2P enviadas/recibidas, compras tarjeta personales, tiempo promedio cliente vs benchmark plataforma, y timeline cronológico. Dual-purpose declarado: 🔍 Uso Interno (todo visible) vs 🤝 Reuniones con Clientes (`presenter=1` oculta timeline crudo).

**Depends on:** Phase 6 (JOIN helper + visibility system); idealmente Phases 7-8 ejecutadas para reutilizar lógica de domain libraries

**Requirements:** CLI-V2-01, CLI-V2-02, CLI-V2-03, CLI-V2-04, CLI-V2-05, CLI-V2-06, CLI-V2-07, CLI-V2-08

**Success Criteria** (what must be TRUE):
1. Selector de **tikintag** (dropdown con 235 usuarios) funciona como filtro principal de la sección, persiste via URL
2. **Tarjeta resumen del cliente** muestra 5 KPIs cabecera (Balance · Primera tx · Última actividad · Total tx · Pocket activo), todas visibles en presenter
3. **Retiros banco enriquecidos** via JOIN con BD_Payouts en tabla detallada (Holder, Bank, Aging, Status, Failure Reason); visible en presenter
4. **P2P enviadas/recibidas, bonos in/out, compras tarjeta** del usuario rendereados en cards/tablas, todos visibles en presenter
5. **Tiempo promedio de payouts del cliente vs benchmark plataforma** calculado y mostrado en KPI comparativo (clave en presenter — argumento de eficiencia)
6. **Timeline cronológico** de toda la actividad del usuario (con ícono por tipo) `presenter-hide` cuando `?empresa=$X&presenter=1` está activo (uso interno revela patrones que no se muestran a clientes)

**Research:** Unlikely (rebuild de v1.0 Clientes con visibility por métrica usando sistema de Phase 6)

### Phase 10: Inicio + Infrastructure

**Goal:** Home page (Inicio) reescrita como agregado de las secciones bajo lente operativa (usuarios activos, volumen IN/OUT, tasa de éxito, tipos de transacción, actividad temporal, top 10 usuarios). Resolver INFRA-04 carry-forward de v1.0 con dominio propio configurado.

**Depends on:** Phases 7-9 (Inicio agrega lógica de domain libraries de las secciones; INFRA-04 puede ejecutarse en paralelo si decisión de dominio se toma upfront)

**Requirements:** INI-V2-01, INI-V2-02, INI-V2-03, INI-V2-04, INI-V2-05, INI-V2-06, INFRA-04

**Success Criteria** (what must be TRUE):
1. Inicio muestra **usuarios activos** (tikintags DISTINCT con ≥1 tx completed), **volumen IN vs OUT** separado, **tasa de éxito global** con semáforo (98.1%/1.6%/0.2% baseline)
2. Inicio muestra **donut chart** por tipo de transacción (max 6 segmentos + "Otros") y **actividad temporal** (línea con granularidad día/semana/mes selectable)
3. Inicio muestra **top 10 usuarios** por volumen en tabla rankeable
4. Dashboard accesible en **dominio propio configurado** (e.g. `dashboard.tikin.co`) con SSL y env vars correctas; INFRA-04 cerrado

**Research:** Likely
**Research topics:** Vercel custom domain config (DNS records, SSL provisioning, scoping de env vars a Production+Preview); Vercel Deployment Protection bypass via custom domain

## Progress

**Execution Order:**
Phases execute in numeric order: 6 → 7 → 8 → 9 → 10. Phases 7 y 8 son independientes entre sí (ambas dependen solo de Phase 6) — pueden paralelizarse si se desea. INFRA-04 de Phase 10 puede empezar en paralelo con Phases 7-9 si la decisión de dominio se toma upfront.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | — | ✅ Complete | 2026-04-29 |
| 2. Bonos | v1.0 | — | ✅ Complete | 2026-05-01 |
| 3. Payouts | v1.0 | — | ✅ Complete | 2026-05-03 |
| 4. Inicio + Recargas | v1.0 | — | ✅ Complete | 2026-05-05 |
| 5. Clientes + Domain | v1.0 | — | ✅ Complete | 2026-05-06 |
| 6. Foundation v2 | v2.0 | 4/4 | ✅ Complete | 2026-05-07 |
| 7. Bonos + Payouts | v2.0 | 4/4 | ✅ Complete | 2026-05-07 |
| 8. Uso Tarjeta + Recargas | v2.0 | 4/4 | ✅ Complete | 2026-05-07 |
| 9. Vista Cliente | v2.0 | 0/TBD | Not started | — |
| 10. Inicio + Infrastructure | v2.0 | 0/TBD | Not started | — |

---
*Roadmap created: 2026-05-07 (v2.0 milestone kickoff)*
