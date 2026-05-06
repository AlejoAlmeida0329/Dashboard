---
phase: 04-inicio-recargas
plan: 07
subsystem: page-composition
tags: [react-server-component, page-composition, dual-period-filter, bucket-aware-aggregation, cliente-foco, hechos-curados, sheets-cache]

# Dependency graph
requires:
  - phase: 04-inicio-recargas
    provides: filterCompletedIn + summarizeInicio + 4 chart aggregations + InicioDeltaSummary type (Plan 04-01)
  - phase: 04-inicio-recargas
    provides: findTopEmpresaByGMV + findEmpresasNuevasActivadas + output types (Plan 04-02)
  - phase: 04-inicio-recargas
    provides: data-presenter-empresa-hide CSS gate + PresenterFrame wrapper (Plan 04-04)
  - phase: 04-inicio-recargas
    provides: 5 visual leaves — DeltaBadge, KPICardsInicio, GMVTrendChart, EmpresasActivasChart, HechosCurados (Plan 04-05)
  - phase: 03-payouts
    provides: PayoutSummary + summarizePayouts + filterPayouts (reused for latencia hecho destacada delta)
  - phase: 02-bonos
    provides: page composition skeleton (bonos/page.tsx, mirrored line-for-line); getCachedTransactions + DashboardHeader pattern
provides:
  - Live `/inicio` page rendering BD_Plataforma + BD_Payouts data: 5 KPIs with deltas, 2 trend charts (bucket-aware), 3 hechos curados, all filters working, cliente-foco contract end-to-end
  - Dual-period filter pattern: `filterCompletedIn(allTx, filters)` + `filterCompletedIn(allTx, {...filters, from: prior.from, to: prior.to})` over the SAME fetched payload (one Sheets read per request, both windows derived in-memory)
  - 60-day bucket-granularity threshold with subtitle hint (`(diario)` / `(semanal)`)
  - Page-level Card wrapper for EmpresasActivasChart with `data-presenter-empresa-hide` (chart degenerates to flat y=1 when empresa-filtered → cliente-foco hides the whole Card)
affects:
  - 04-08 (Recargas page composition mirrors this skeleton minus hechos-curados-3 + payouts join)
  - Phase 5 CLI-08 ("Generar vista para cliente") — cliente-foco contract verified end-to-end on the hero tab; the precondition for landing the cliente-share URL on a populated /inicio is now satisfied

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-period filter over single fetch. Both `currentTx` and `priorTx` derive from `filterCompletedIn(allTx, ...)` — same `allTx` array, different windows. `computePriorPeriod` returns null when filter is unbounded → caller renders em-dash deltas. Reusable for any future delta-bearing page (Phase 5 if Clientes adds period comparisons)."
    - "Parallel Sheets fetch via `Promise.all([getCachedTransactions(), getCachedPayouts()])`. React `cache()` already dedupes the BD_Plataforma fetch with DashboardHeader's identical call; the parallel kick-off saves one round-trip on the initial paint when payouts is also needed."
    - "Bucket-granularity decision lives in the PAGE, not in the leaf. The page computes `length` from filters.from/to (default 30 when unbounded), picks `granularity: 'day' | 'week'`, calls the matching aggregator pair, and threads `granularity` to GMVTrendChart for tickFormatter switching. Charts stay bucket-agnostic; the page is the orchestrator."
    - "Page-level Card wraps EmpresasActivasChart so `data-presenter-empresa-hide` attaches to the Card (whole editorial block hides) NOT to the inner chart (which would leave the empty Card chrome visible). Different chrome ownership than HechosCurados (which carries its own attribute internally per Plan 04-05)."
    - "Inline `<Card>` error fallback on Sheets fetch failure (mirror of bonos/page.tsx + payouts/page.tsx). Try/catch around `Promise.all` returns a Card with `err.message` rather than relying on the route group's `error.tsx` boundary."
    - "`findEmpresasNuevasActivadas(allTx, filters)` MUST receive the unfiltered `allTx` (NOT `currentTx`). RESEARCH Pitfall 5: a filtered subset would mark every empresa in subset as 'new' by definition. The page is the trust boundary — domain function does not validate."

key-files:
  created:
    - .planning/phases/04-inicio-recargas/04-07-SUMMARY.md
  modified:
    - src/app/(protected)/inicio/page.tsx (placeholder Card → 255 LOC full composition; +246/-18 in commit 26c8432)

key-decisions:
  - "Promise.all parallel fetch (not sequential await pair). The two Sheets reads are independent (BD_Plataforma + BD_Payouts) — kicking them in parallel saves one network round-trip on cache-miss requests. React `cache()` still dedupes the BD_Plataforma fetch with DashboardHeader on the same render."
  - "Prior-period summary computed via `summarizeInicio(filterCompletedIn(allTx, priorWindowFilters))` — second filter pass over the SAME `allTx` payload, NO second Sheets fetch. computePriorPeriod returns null when filters unbounded → priorTx is null → KPI deltas render as em-dash via `pctChange(current, null)`."
  - "Page wraps EmpresasActivasChart in a `<Card data-presenter-empresa-hide>` at the composition layer. GMVTrendChart's Card carries no presenter attribute (chart is heroína — visible in cliente-foco). HechosCurados already carries its own `data-presenter-empresa-hide` on the outer wrapper (Plan 04-05). Net: exactly ONE page-level grep hit for the attribute, semantic must_have satisfied."
  - "Bucket subtitle hint rendered as small muted span inside CardTitle (`<span className=\"text-sm font-normal text-muted-foreground\"> ({granularity === 'week' ? 'semanal' : 'diario'})</span>`) — keeps the title typographic hierarchy intact while telling the reader what each bar represents. Same pattern reusable for Plan 04-08 if Recargas adds bucket switching."
  - "Empty-state branch is implicit: `summarizeInicio([])` is zero-safe (returns `{gmv:0, comision:0, takeRate:0, empresasActivas:0, bonosVendidos:0}`); the `<2 points` chart guard renders friendly Spanish copy instead of a floating dot; HechosCurados handles its own per-card empty states (Plan 04-05). The page short-circuits NOTHING — layout consistency preserved, the user reads 'your filter excluded everything' rather than 'the dashboard is broken'."
  - "No `verifySession()` call in the page (mirror of bonos/page.tsx + payouts/page.tsx). The `(protected)` route group layout already guards the entire subtree."

patterns-established:
  - "Plan 04-08 (Recargas page composition) mirrors this skeleton minus the hechos-curados-3 + summarizePayouts join: parseFilters → Promise.all single Sheets fetch → filterRecargas → summarizeRecargas + aggregateRecargasByDate → render RecargasKPICards + RecargasTrendChart + RecargasTable + HechosCuradosRecargas. No prior-period delta required for Recargas v1 (REC-V2-XX scope)."
  - "Page-level Card wrapping for charts whose visibility flips at the editorial-block level (EmpresasActivasChart in cliente-foco). When the leaf already provides its own Card (e.g. TopBancos in Plan 03-04), the page renders it as-is — chrome ownership matches design intent."

# Metrics
duration: ~25m active (Task 1 implementation by background agent ~15 min; checkpoint pause + user verification ~ same-day; SUMMARY + STATE.md update ~5 min by orchestrator-direct close)
completed: 2026-05-05
---

# Phase 4 Plan 07: Inicio Page Composition Summary

**Replaces the Phase 1 placeholder at `/inicio` with the live hero page: 5 KPIs with deltas, GMV + Empresas-activas trend charts (bucket-aware at 60-day threshold), 3 hechos curados (top empresa GMV / latencia destacada / empresas nuevas activadas). Cliente-foco contract verified end-to-end across all 4 URL states.**

## Performance

- **Duration:** ~25 min active. Task 1 (page rewrite) ran ~15 min via background agent; checkpoint paused for human verification (same-day approval); SUMMARY + STATE.md update ~5 min orchestrator-direct.
- **Tasks:** 2 implementation (Task 1 + checkpoint) + 1 deferred deploy (Task 3 left for batch with Plan 04-08).
- **Files created:** 1 (this SUMMARY).
- **Files modified:** 1 (page.tsx; +246/-18 LOC in commit 26c8432).
- **Final page.tsx:** 255 LOC (vs ~37 LOC placeholder).

## Commits

- `26c8432` `feat(04-07): replace inicio page placeholder with full composition` — Task 1, the only code commit. Wires KPICardsInicio + GMVTrendChart + EmpresasActivasChart + HechosCurados from Plan 04-05; dual-period filter; 60-day bucket threshold; cliente-foco Card wrap; inline error fallback.
- `(metadata)` `docs(04-07): complete inicio page composition plan` — final metadata commit (this SUMMARY + STATE.md).

## Verification (all green)

- `npx tsc --noEmit` → clean (silent success).
- `npm run build` → ✓ Compiled successfully in 9.2s (Next 16.2.4 Turbopack), all routes emitted, `/inicio` now `ƒ` (Dynamic) with full composition.
- `grep -c "filterCompletedIn"` src/app/(protected)/inicio/page.tsx → 2 occurrences (current + prior periods, single Sheets fetch).
- `grep -c "findEmpresasNuevasActivadas"` → 1 call, passes `allTx` (FULL dataset) per RESEARCH Pitfall 5 guard.
- `grep -c "data-presenter-empresa-hide"` → 1 page-level occurrence (on EmpresasActivasChart Card; HechosCurados carries its own internally).
- `grep -c "Promise.all"` → 1 (parallel BD_Plataforma + BD_Payouts fetch).
- `dynamic = "force-dynamic"` present (line 105).
- 4 cliente-foco URL states verified manually by user (response: "approved"):
  1. `/inicio` (no filters): 5 KPIs + 2 charts + 3 hechos curados visible.
  2. `?presenter=1`: Comisión + Take rate hidden (3 KPIs); charts + hechos curados still visible.
  3. `?empresa=$X`: 5 KPIs filtered; 2 charts visible (Empresas activas chart shows flat y=1 because empresa-filtered but visible since not cliente-foco); hechos curados visible.
  4. `?presenter=1&empresa=$X` (cliente-foco): 3 KPIs + GMV chart visible; **EmpresasActivasChart Card HIDDEN; HechosCurados ALL HIDDEN**. Clean editorial reading of the cliente's data.
- Bucket granularity: 30-day window → daily; 90-day window → weekly. Card subtitle reflects the choice.
- Empty state: KPI cards render zero values, charts render Spanish empty-state copy, no crash.
- No regression on /bonos, /payouts (still ship), /recargas (still placeholder for Plan 04-08), /clientes (still placeholder for Phase 5).

## Deliverables in HEAD

- `src/app/(protected)/inicio/page.tsx` — 255 LOC. Server Component. Pipeline: `parseFilters` → `computePriorPeriod` → parallel `Promise.all` Sheets fetch → `filterCompletedIn` twice (current + prior over same allTx) → `summarizeInicio` twice → bucket switch (`length > 60 ? 'week' : 'day'`) → 4 chart aggregations → 3 hechos curados (`findTopEmpresaByGMV`, `findEmpresasNuevasActivadas`, `summarizePayouts` for latencia delta) → JSX render. Top-level JSDoc (~70 lines) documents the 7-step pipeline + dual-period pattern + bucket threshold + cliente-foco delegation + empty-state convention + error handling.

## Deviations

**0 plan-spec deviations on Task 1.** Plan executed as written; the literal code blocks from `<action>` compiled clean on first build, the 8 verify checks all green, the 4-URL cliente-foco contract held on first manual verification.

**Operational deviation:** Task 3 (Vercel `--prod` deploy) intentionally deferred to batch with Plan 04-08 (Recargas page composition). Rationale: Phase 4 ships /inicio + /recargas together as the "user-facing pair"; deploying /inicio alone would put a half-shipped Phase 4 in production. Plan 04-08's deploy step will cover both.

## Patterns to Reuse for Plan 04-08

- **Page skeleton:** parseFilters → Promise.all single Sheets fetch → filterRecargas → summarizeRecargas + aggregateRecargasByDate → render. Mirror this 04-07 file line-for-line, then strip out: (a) prior-period filter pass (no v1 deltas for Recargas), (b) computePriorPeriod import, (c) HechosCurados import + props (replace with HechosCuradosRecargas which is a different shape), (d) summarizePayouts call (no payouts join needed).
- **Bucket switching:** keep the 60-day threshold pattern if Recargas adds it; if v1 stays daily-only, drop the granularity switch. RecargasTrendChart from Plan 04-06 is daily-only by current spec.
- **Page-level Card wrap with `data-presenter-empresa-hide`:** apply to any Recargas chart that degenerates to a flat line at y=1 under empresa filter. RecargasTrendChart most likely needs this guard (one empresa's recargas timeline is the same shape as N empresas' if N=1).
- **Empty state:** keep KPI cards rendering zero values; per-leaf empty-state copy (HechosCuradosRecargas already handles its own per Plan 04-06).
- **No verifySession**, **no `error.tsx` reliance**, **inline Card error fallback with err.message**.
