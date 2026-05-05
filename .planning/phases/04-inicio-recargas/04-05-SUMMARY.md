---
phase: 04-inicio-recargas
plan: 05
subsystem: ui
tags: [react-server-components, react-client-component, recharts, presenter-mode, cliente-foco, kpi-cards, delta-badge, hechos-curados]

# Dependency graph
requires:
  - phase: 04-inicio-recargas
    provides: InicioDeltaSummary, GMVPoint, ActiveEmpresaPoint output types (Plan 04-01)
  - phase: 04-inicio-recargas
    provides: TopEmpresaResult, EmpresasNuevasResult, EmpresaNueva output types (Plan 04-02)
  - phase: 04-inicio-recargas
    provides: data-presenter-empresa-hide CSS gate (Plan 04-04)
  - phase: 03-payouts
    provides: PayoutSummary type + summarizePayouts (reused for latencia hecho)
  - phase: 02-bonos
    provides: BonosChart + KPICards visual conventions (currentColor, font-mono+tabular-nums, no internal Card chrome on charts)
provides:
  - DeltaBadge atom (Server Component) with `inverted` prop for latency direction
  - KPICardsInicio (Server Component) — 5-card grid with delta sub-component
  - GMVTrendChart (Client Component) — Recharts BarChart, bucket-aware
  - EmpresasActivasChart (Client Component) — Recharts LineChart
  - HechosCurados (Server Component) — 3-card editorial highlight reel with cliente-foco hide
affects:
  - 04-07 (Inicio page composition consumes all 5 components)
  - 04-06 (RecargasKPICards reuses DeltaBadge from inicio/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DeltaBadge atom with `inverted` prop. Default direction (higher=green) for revenue/volume KPIs; inverted (lower=green) for latency. One component, two semantic mappings."
    - "Server Components for pure formatting + Card composition (DeltaBadge, KPICardsInicio, HechosCurados). Client Components only where Recharts ResponsiveContainer needs DOM (GMV/Empresas charts)."
    - "Visibility 100% CSS-driven. data-presenter-hide on Comisión/Take rate Cards; data-presenter-empresa-hide on HechosCurados outer wrapper. Zero React conditionals on presenter/empresa state."
    - "`stroke=\"currentColor\"` + `fill=\"currentColor\"` on all chart primitives. Theme switching is automatic via parent's text-foreground token. Mirror of BonosChart pattern from Plan 02-03."
    - "No internal `<Card>` chrome on chart files. Page provides chrome at the composition layer (Plan 04-07). Mirror of BonosChart per Plan 02-04 STATE entry."
    - "Empty-state copy is first-class. Each card in HechosCurados handles its own empty case with friendly Spanish copy ('Sin transacciones en el período', 'Sin payouts en el período', 'Ninguna empresa nueva en este período')."

key-files:
  created:
    - src/components/inicio/DeltaBadge.tsx (78 LOC)
    - src/components/inicio/KPICardsInicio.tsx (130 LOC)
    - src/components/inicio/GMVTrendChart.tsx (109 LOC)
    - src/components/inicio/EmpresasActivasChart.tsx (113 LOC)
    - src/components/inicio/HechosCurados.tsx (124 LOC)
  modified: []

key-decisions:
  - "DeltaBadge `inverted` prop ships in Task 1 (alongside DeltaBadge itself) rather than as a Task 3 retrofit. Plan said 'edit DeltaBadge accordingly' — bundling the prop into the atom's first commit avoids an unnecessary churn commit. HechosCurados (Task 3) consumes `inverted` directly."
  - "GMVTrendChart uses BarChart (volume reads better as bars); EmpresasActivasChart uses LineChart (count continuity reads better as a line). Per CONTEXT.md vision."
  - "tickFormatter for XAxis compacts bucket strings: '2026-04-15' → '15/04', '2026-W17' → 'W17'. Day vs week sniffed by length (≥10 chars = ISO date, else ISO week). Avoids reading granularity through props at the formatter layer."
  - "HechosCurados receives `latenciaCurrent`/`latenciaPrior` as PROPS rather than computing internally. Page (Plan 04-07) is the single fetch coordinator — passes pre-computed `summarizePayouts(...)` from the same allTx fetch."
  - "Empty states use `count === 0` as the sentinel for the latencia card (NOT `p50Seconds === 0`, which is a valid value). PayoutSummary documents `count=0 → p50Seconds=0` per Plan 03-02."
  - "JSDoc reference to `data-presenter-empresa-hide` inside HechosCurados.tsx inflates `grep -c` to 2 instead of 1. Semantic must_have is satisfied (one JSX element carries the attribute); JSDoc occurrence is documentation. Documented to prevent future verify-step false positives."

patterns-established:
  - "Two-color DeltaBadge primitive. Future plans needing inverted-direction deltas (e.g. error rates, churn) reuse DeltaBadge with `inverted`."
  - "Hecho curado as Server Component with empty-state-per-card. Each editorial card encodes its own empty copy; page never needs to gate rendering."

# Metrics
duration: ~25m active (across 3 stream-timeout retries; Tasks 1+2 by background agent, Task 3 + SUMMARY + metadata by orchestrator-direct close)
completed: 2026-05-05
---

# Phase 4 Plan 05: Inicio Visual Leaves Summary

**5 visual leaves for /inicio: DeltaBadge atom, KPICardsInicio (5 cards with delta), GMV BarChart, EmpresasActivas LineChart, HechosCurados (3-card editorial reel with cliente-foco hide). All Server Components except the two Recharts containers.**

## Performance

- **Duration:** ~25 min wall-clock (Tasks 1+2 ~13 min via background agent; Task 3 + SUMMARY + metadata ~5 min via orchestrator-direct close after agent stream timeouts).
- **Tasks:** 3
- **Files created:** 5
- **Files modified:** 0
- **Total LOC:** 554

## Commits

- `b442ddc` `feat(04-05): add DeltaBadge atom + KPICardsInicio (5 cards with delta)` — Task 1, includes the `inverted` prop on DeltaBadge from the start.
- `d68f4aa` `feat(04-05): add GMVTrendChart + EmpresasActivasChart (Client Components)` — Task 2.
- `d5c6eed` `feat(04-05): add HechosCurados container with cliente-foco hide` — Task 3, orchestrator-direct after agent stream timeouts.
- `(metadata)` `docs(04-05): complete inicio visual leaves plan` — final metadata commit (this SUMMARY + STATE.md).

## Verification (all green)

- `npx tsc --noEmit` → clean (silent success).
- `npm run build` → ✓ Compiled successfully in 13.1s, TS 7.7s, all 11 routes emitted, /inicio still `ƒ` (Dynamic, page composition is Plan 04-07).
- `grep -c "use client" src/components/inicio/{DeltaBadge,KPICardsInicio,HechosCurados}.tsx` → 0 (Server Components).
- `grep "use client" src/components/inicio/{GMVTrendChart,EmpresasActivasChart}.tsx` → both files (Client Components).
- `grep -c "data-presenter-hide" src/components/inicio/KPICardsInicio.tsx` → 2 (Comisión + Take rate Cards only).
- `grep -c "data-presenter-empresa-hide" src/components/inicio/HechosCurados.tsx` → 2 (one JSDoc reference + one JSX element; semantic must_have of single JSX element satisfied).
- `grep -c "useSearchParams\|useState\|useEffect" src/components/inicio/HechosCurados.tsx` → 0.
- `grep -c "inverted" src/components/inicio/DeltaBadge.tsx` → 7 (prop type, default param, branch logic).
- No regression on existing /bonos, /payouts routes — both still emit `ƒ` (Dynamic) in build output.

## Deliverables in HEAD

- `src/components/inicio/DeltaBadge.tsx` — 78 LOC. Server Component. Props: `current`, `prior`, `inverted?`. Renders `+X,Y%` (emerald) / `−X,Y%` (rose) / `—`. With `inverted=true`, swaps colors so down=green (latency improvement).
- `src/components/inicio/KPICardsInicio.tsx` — 130 LOC. Server Component. 5-card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-5`). Cards: GMV / Comisión [hide] / Take rate [hide] / Empresas activas / Bonos vendidos. Each Card has DeltaBadge in CardContent.
- `src/components/inicio/GMVTrendChart.tsx` — 109 LOC. Client Component. Recharts `BarChart` 320px height. `stroke=fill="currentColor"` everywhere. Bucket-aware XAxis tickFormatter. `minPointSize={2}` keeps zero-count bars visible.
- `src/components/inicio/EmpresasActivasChart.tsx` — 113 LOC. Client Component. Recharts `LineChart` same shell as BonosChart. `dataKey="count"`, YAxis tickFormatter=`formatInteger`.
- `src/components/inicio/HechosCurados.tsx` — 124 LOC. Server Component. Outer div with `data-presenter-empresa-hide`. 3-card grid (`md:grid-cols-3`): top empresa, latencia destacada (DeltaBadge inverted), empresas nuevas activadas. Empty-state copy per card.

## Deviations

**0 plan-spec deviations.** Plan executed as written; the only departure is operational, not technical:

- **Stream-timeout-driven multi-resume execution.** The gsd-executor agent hit three consecutive SDK stream timeouts during Wave 2 parallel execution. Tasks 1+2 landed cleanly under the agent (commits `b442ddc`, `d68f4aa`); Task 3 + SUMMARY + STATE.md update + metadata commit were closed orchestrator-direct after the third timeout. No file-state divergence: each commit lands atomically with its own files. Documented as Wave 2 hazard for STATE.md.

## Patterns to Reuse (Phases 5+)

- **DeltaBadge.inverted** for any future "lower is better" KPI (error rate, churn, abandonment).
- **Server-Component-by-default** for visual leaves; reach for Client only when DOM measurement is required (Recharts ResponsiveContainer).
- **Empty-state copy lives in the leaf**, not in the page. Each card knows how to render its own zero/null case in friendly Spanish.
- **Bucket-aware tickFormatter** (sniff by string length) — reusable for any future bucket-aware chart.
