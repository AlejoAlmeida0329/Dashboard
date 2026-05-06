# Roadmap: Tikin Dashboard

## Overview

5 fases para llegar de cero a un dashboard interno + presentable a clientes, leyendo en vivo de Google Sheets. Phase 1 monta el esqueleto (auth + adapter + filtros + Modo Presentación) que cada pestaña reutiliza. Phases 2-3 construyen las pestañas con más data específica (Bonos por revenue, Payouts por diferenciador). Phase 4 cierra Inicio (que agrega de fases anteriores) y Recargas. Phase 5 termina con Clientes (vista de perfil + botón "Generar vista para cliente") y la migración a dominio propio.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** — Auth, Sheets adapter, app shell, filtros globales y Modo Presentación *(completed 2026-04-29; production: https://project-dashboard-bkwmin189.vercel.app)*
- [ ] **Phase 2: Bonos** — Pestaña de venta de bonos (revenue principal)
- [x] **Phase 3: Payouts** — Pestaña de retiros con P50/P95 y split tarjeta vs banco *(completed 2026-05-04; production: https://project-dashboard-allec5r4i.vercel.app)*
- [x] **Phase 4: Inicio + Recargas** — Overview ejecutivo (5 KPIs + 2 gráficas) + tab de recargas *(completed 2026-05-06; production: https://project-dashboard-4b4fxxmdr.vercel.app)*
- [ ] **Phase 5: Clientes + Domain** — Lista y perfil de empresas, botón "Generar vista para cliente", dominio propio

## Phase Details

### Phase 1: Foundation
**Goal**: App autenticada con Sheets adapter, filtros globales y Modo Presentación funcionando — el esqueleto que todas las pestañas heredan.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, INFRA-01, INFRA-02, INFRA-03, CROSS-01, CROSS-02, CROSS-03, CROSS-04, CROSS-05, CROSS-06
**Success Criteria** (what must be TRUE):
  1. Visitante sin sesión no puede ver ninguna pestaña; con password correcto la sesión persiste en cookie HttpOnly entre navegaciones; login resiste brute-force con rate limiting
  2. App desplegada en Vercel lee data en vivo de las dos hojas de Sheets, con timestamp de "última lectura" visible y estados de loading/empty/error decentes en cada vista
  3. Lectura de Sheets se valida contra schema en cada llamada — falla con error claro si una columna cambia o falta, no muestra números incorrectos en silencio
  4. Filtros globales de rango de fechas y empresa persisten en URL, se mantienen entre pestañas, y todos los $ y fechas usan formato consistente (COP, separador de miles, es-CO)
  5. Toggle "Modo Presentación" oculta chrome de navegación y agranda tipografía; su estado persiste al navegar entre pestañas
**Research**: Likely (auth pattern, Sheets adapter, env var handling)
**Research topics**: Next.js 16.2 `proxy.ts` auth pattern + `jose` JWT + bcrypt; `googleapis` `batchGet` y manejo de quota 60/min/service-account; Vercel Sensitive env vars + handling de `\n` en private key; Zod validation by header name (no por índice) en boundary del adapter
**Plans**: TBD (refinado en plan-phase)

Plans:
- [ ] 01-01: TBD

### Phase 2: Bonos
**Goal**: Pestaña Bonos muestra ventas de bonos por empresa con datos en vivo y respeto a Modo Presentación.
**Depends on**: Phase 1
**Requirements**: BON-01, BON-02, BON-03, BON-04, BON-05
**Success Criteria** (what must be TRUE):
  1. Usuario ve gráfica de Bonos vendidos en el tiempo y leaderboard Top 10 empresas, ambos respondiendo al filtro global de fecha
  2. Usuario ve tabla de Ventas por empresa con columnas (# bonos, $ vendido, $ comisión, % del total)
  3. Usuario ve KPIs de Ticket promedio por bono y Comisión total ganada en el período
  4. En Modo Presentación: las columnas $ comisión y % del total están ocultas en la tabla, el KPI de Comisión está oculto, y el leaderboard está oculto
  5. Filtro de empresa reduce todas las visualizaciones de la pestaña a esa empresa
**Research**: Unlikely (chart + table + filter patterns establecidos en Phase 1)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Payouts
**Goal**: Pestaña Payouts muestra latencias P50/P95 y volúmenes con split tarjeta vs cuenta bancaria — la pantalla más mostrada a clientes.
**Depends on**: Phase 1 (Phase 2 no estrictamente requerida pero lecciones del primer tab end-to-end aplican)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05
**Success Criteria** (what must be TRUE):
  1. Usuario ve KPIs de # de payouts procesados y $ volumen del período
  2. Usuario ve KPIs de tiempo medio (P50) y P95 hasta payout, calculados sobre la hoja de tiempos de payouts
  3. Todas las métricas de Payouts splitean entre destino `tarjeta` vs `cuenta bancaria`
  4. Usuario ve histograma de latencia con buckets `<1h / 1-6h / 6-24h / >24h`
  5. Filtros globales de fecha y empresa aplican a todas las visualizaciones de Payouts
**Research**: Likely (segunda integración de Sheet + cálculo de percentiles)
**Research topics**: Estrategia de cálculo de P50/P95 (en adapter vs en cliente); `batchGet` con dos rangos en una llamada para coalescer transactions + payout-times; cómo hacer join entre transactions y payout-times sin un ID común
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Inicio + Recargas
**Goal**: Pestaña Inicio agrega los 5 KPIs ejecutivos + 2 gráficas (usando shapes de data ya cargadas en Phases 2-3); pestaña Recargas muestra volumen y count.
**Depends on**: Phase 2, Phase 3 (Inicio agrega métricas que las pestañas anteriores ya saben calcular)
**Requirements**: INI-01, INI-02, INI-03, INI-04, INI-05, INI-06, INI-07, REC-01, REC-02, REC-03
**Success Criteria** (what must be TRUE):
  1. Usuario ve los 5 KPIs ejecutivos en Inicio: GMV, Comisión/Revenue, Take rate %, Empresas activas, Bonos vendidos — todos sensibles al filtro global de fecha
  2. Usuario ve gráficas de tendencia de GMV y Empresas activas en el tiempo
  3. En Modo Presentación: KPIs de Comisión y Take rate están ocultos; los demás KPIs y gráficas siguen visibles
  4. Usuario ve total $ recargado, count de transacciones de recarga del período, y tabla por empresa (top 10 ordenable) en pestaña Recargas
  5. Inicio y Recargas respetan filtros globales de fecha y empresa
**Research**: Unlikely (agregaciones sobre shapes de data ya definidas en Phases 2-3)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Clientes + Domain
**Goal**: Pestaña Clientes con lista + perfil; botón "Generar vista para cliente" cierra el flujo de presentación end-to-end; dashboard accesible en dominio propio.
**Depends on**: Phase 4 (CLI-08 lleva a Inicio populado; perfil de empresa muestra mini-resumen Bonos/Recargas/Payouts que existen)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07, CLI-08, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Usuario ve tabla de empresas con columnas ordenables (por $, recencia, nombre), búsqueda por nombre, y KPIs en cabecera (Total empresas + Empresas activas)
  2. Usuario abre perfil de una empresa con header (nombre, status, última actividad), gráfica de actividad mensual de los últimos 12 meses, y mini-resumen 3 cards (Bonos / Recargas / Payouts) de esa empresa
  3. Botón "Generar vista para cliente" aplica el filtro de empresa, activa Modo Presentación, y navega a Inicio populado con la data del cliente seleccionado
  4. Dashboard responde en dominio propio (ej. `dashboard.tikin.co`) además de la URL de Vercel, con HTTPS funcionando
  5. Filtros globales y Modo Presentación se respetan en todas las vistas de Clientes
**Research**: Likely (configuración de dominio en Vercel + DNS)
**Research topics**: Vercel custom domain setup, DNS records (A / CNAME) en proveedor de Tikin, redirect www → apex, propagación SSL
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | ✅ Complete | 2026-04-29 |
| 2. Bonos | 4/4 | ✅ Complete | 2026-04-29 |
| 3. Payouts | 4/4 | ✅ Complete | 2026-05-04 |
| 4. Inicio + Recargas | 8/8 | ✅ Complete | 2026-05-06 |
| 5. Clientes + Domain | 0/TBD | Not started | - |
