---
phase: 05-clientes-domain
plan: 01
subsystem: domain-library
tags: [domain, clientes, empresa-index, monthly-activity, pure-module, date-fns-tz]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: bonos.ts purity contract + inline date-helper pattern (verbatim copied here)
  - phase: 03-payouts
    provides: types.ts Transaction shape (already finalized in Phase 2)
  - phase: 04-inicio-recargas
    provides: recargas.ts formatInTimeZone pattern (no @/lib/format coupling)
provides:
  - "src/lib/domain/clientes.ts — 4 pure functions + 5 stable type contracts for /clientes list + /clientes/[empresaId] profile"
  - "deriveEmpresasIndex (one row per distinct empresa_id, histórico vs período split)"
  - "summarizeEmpresasIndex (header KPIs: totalEmpresas + empresasActivas)"
  - "findEmpresa (profile header data, null on unknown empresaId)"
  - "aggregateMonthlyActivity (12-month zero-filled per-empresa series)"
  - "EmpresaListRow / EmpresasIndexSummary / EmpresaProfileSummary / MonthlyActivity / EmpresaStatus types"
affects:
  - 05-02 (ClientesKPICards + ClientesTable consume EmpresaListRow + EmpresasIndexSummary)
  - 05-03 (EmpresaProfileHeader + EmpresaActivityChart consume EmpresaProfileSummary + MonthlyActivity)
  - 05-04 (page composition wires all four functions)
  - 05-05 (cross-empresa drill-down would consume same primitives)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Activity-counting predicate (direction='in' && status='completed') as the universal 'money actually arrived' gate — fifth domain module to adopt"
    - "Inline date helpers (startOfDayBogotaTimestamp / endOfDayBogotaTimestamp) verbatim from bonos.ts:53-74 — fifth domain module to make the DRY-vs-cohesion call (cohesion wins; ~10 LOC inline cost vs cross-module shared util)"
    - "URL filter as profile picker, not row filter (deriveEmpresasIndex IGNORES filters.empresa) — explicit JSDoc"
    - "Zero-fill 12-month series so chart leaf can rely on length===12 (continuous time axis reveals 'empresa stopped transacting' patterns)"
    - "Status convention tied to the filter window (not to a fixed 'last 30 days') — date filters double as activity probes"
    - "Histórico vs Período split computed in single-pass (one walk over transactions yields both)"

key-files:
  created:
    - "src/lib/domain/clientes.ts (516 LOC)"
  modified: []

key-decisions:
  - "Empresa filter IGNORED for deriveEmpresasIndex (the table is the empresa picker, not a row narrower)"
  - "Status='activa' tied to ≥1 activity-counting tx in the date filter window (not a fixed lookback)"
  - "12-month zero-fill (always emit 12 entries) so chart leaf doesn't need empty-state branching"
  - "Histórico vs Período computed in same single pass for amortized cost"
  - "subMonthsLabel uses pure string arithmetic (year * 12 + month - 1 - n recompose) — handles year boundaries + negative n via ((total % 12) + 12) % 12"

patterns-established:
  - "Pattern: Profile-picker filter (filters.empresa is a routing parameter, not a query)"
  - "Pattern: 12-month zero-fill for editorial chart axes"

# Metrics
duration: 7m 4s
completed: 2026-05-06
---

# Phase 5 Plan 1: Clientes Domain Library Summary

**Pure clientes domain module: deriveEmpresasIndex (single-pass histórico/período split), summarizeEmpresasIndex (KPIs), findEmpresa (profile header), aggregateMonthlyActivity (12-month zero-fill chart series) — 4 functions + 5 stable type contracts, mirror of bonos/recargas/inicio purity rules**

## Performance

- **Duration:** 7m 4s
- **Started:** 2026-05-06T19:11:32Z
- **Completed:** 2026-05-06T19:18:36Z
- **Tasks:** 2/2
- **Files modified:** 1 (created)

## Accomplishments

- `src/lib/domain/clientes.ts` (516 LOC) shipped with 4 functions + 5 types
- `deriveEmpresasIndex(transactions, filters): EmpresaListRow[]` — one row per distinct empresa_id; per-row carries `txPeriod`/`montoPeriod`/`montoHistorico`/`ultimaActividad`/`ultimaActividadInPeriod`/`status`; sorted DESC by `montoHistorico`
- `summarizeEmpresasIndex(rows): EmpresasIndexSummary` — empty-input safe `{ totalEmpresas, empresasActivas }`
- `findEmpresa(transactions, empresaId, filters): EmpresaProfileSummary | null` — profile header data; null on empty empresaId or no activity ever
- `aggregateMonthlyActivity(transactions, empresaId, asOf?): MonthlyActivity[]` — 12-month zero-filled series, ascending; default `asOf = new Date()`
- Module purity verified: only type-only imports from `./types` and `@/lib/url-state`, plus runtime `formatInTimeZone` from `date-fns-tz`. Zero `next/`/`react`/`server-only`/`@/lib/sheets/`/`@/lib/format` references; zero `Intl.` / `toLocaleString` calls.
- 13 mental fixtures green: April-filter index, December-filter index (all-inactiva), summarize empty/mixed/all-inactiva, findEmpresa unknown/known/empty-empresaId, empresa-filter-ignored, sort-DESC, 12-month empty, single-tx bucketing, cross-empresa isolation, out-of-window drop, rejected+out-direction exclusion, empty-empresaId zero-fill, year-boundary asOf=2026-01 + asOf=2025-12 + default-now.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create clientes.ts with deriveEmpresasIndex + summarizeEmpresasIndex + findEmpresa** — `eec1b56` (feat)
2. **Task 2: Add aggregateMonthlyActivity for the 12-month profile chart** — `fdd1780` (feat)

## Files Created/Modified

- `src/lib/domain/clientes.ts` (created, 516 LOC) — Clientes domain library: 4 pure functions + 5 stable type contracts powering Plans 05-02 / 05-03 / 05-04.

## Decisions Made

### The "activity-counting" predicate

`isActivityCounting(t) = t.direction === "in" && t.status === "completed"` (file-private). Universal across `bonos.ts`, `recargas.ts`, `inicio.ts`, and now `clientes.ts`. A tx counts as activity only if money actually arrived: rejected tx never landed; outflows are downstream (refunds, payouts, fees) and would double-count if they triggered "activa". Documented in the file-top JSDoc "Clientes Domain Contract" so the convention is discoverable from the module entry.

### Status='activa' tied to filter window, not fixed lookback

Status is `'activa'` if the empresa has ≥1 activity-counting tx WITHIN the URL date filter window; `'inactiva'` otherwise. **Rationale:** the dashboard's `?from=&to=` filters double as activity probes — adjusting the range to "Q1 2026" lets the user see "who was active in Q1" without a separate "active-as-of" toggle. A fixed "last 30 days" baked into the predicate would force a second filter dimension and break the URL-as-state contract from Plan 01-03. Mental fixture 4 verified: same 3 transactions yield two `activa` rows under April filter and two `inactiva` rows under December filter — the empresas don't change, only their status reading does.

### Empresa filter IGNORED for deriveEmpresasIndex

`deriveEmpresasIndex` does NOT filter rows by `filters.empresa`. The /clientes table is the place where the user PICKS an empresa (clicking a row routes to `/clientes/$mario`); narrowing to one row would defeat the table. **Rationale:** the empresa filter in the URL is a profile-picker for Plan 05-04's routing, not a row-narrowing operator on the index. Documented inline in `deriveEmpresasIndex` JSDoc and verified via mental fixture 7 (`{ ..., empresa: '$A' }` returns 2 rows, not 1).

### Histórico vs Período computed in single pass

`montoHistorico` (sum across ALL TIME) and `montoPeriod` (sum within filter window) are accumulated in the SAME walk over transactions — one in-window check inside the loop emits both. **Rationale:** the list page renders both columns side-by-side; doing two passes would scan O(N) twice for no gain. Same pattern is reused inside `findEmpresa`.

### 12-month zero-fill

`aggregateMonthlyActivity` ALWAYS returns exactly 12 entries (zero-filled gaps). **Rationale:** without zero-fill, gap months would be invisible — the chart leaf needs a continuous time axis so the reader can spot "this empresa stopped transacting in October". The chart leaf can rely on `result.length === 12` and skip empty-state branching. Cost: O(12) extra Map insertions per call — negligible.

### subMonthsLabel — pure string arithmetic

Year-boundary-safe label arithmetic without instantiating a Date: parse `yyyy-MM`, compute `total = year * 12 + (month - 1) - n`, recompose. JS modulo is sign-preserving (so `-1 % 12 === -1`); guarded with `((total % 12) + 12) % 12` to land in 0..11 even for negative `n`. Verified empirically: `asOf=2026-01-15 → labels 2025-02..2026-01`; `asOf=2025-12-15 → labels 2025-01..2025-12`.

### Inline date helpers (DRY-vs-cohesion)

`startOfDayBogotaTimestamp` and `endOfDayBogotaTimestamp` copied verbatim from `bonos.ts:53-74` (also in `recargas.ts`, `inicio.ts`). Fifth domain module to make this call. **Rationale:** sharing across domain modules would require a new `src/lib/domain/_dates.ts` (or move to `lib/format` which would couple to the Intl gate). The ~10 LOC inline cost per module is a one-time copy; the benefit is each domain module remains independently readable + testable without external setup.

### `formatInTimeZone` runtime import (no `@/lib/format` coupling)

Mirror of `recargas.ts:52`. Domain modules use `date-fns-tz` directly so the project's Intl gate (`src/lib/format.ts`) stays scoped to UI-layer formatting. Verified via grep: zero `@/lib/format` references in clientes.ts; zero `Intl.` / `toLocaleString` calls.

## Deviations from Plan

None — plan executed exactly as written. The only mid-task adjustment was operational, not technical: in the first iteration of Task 1's file-write I included the `formatInTimeZone` import and `BOGOTA_TZ` constant (intended for Task 2), then the plan explicitly said "NO `formatInTimeZone` runtime import in this task (Task 2 needs it; add then)". Removed both from Task 1 immediately, added back in Task 2. Net result: each task's commit contains exactly the lines that task's `<action>` specified — no churn across the two commits.

## Issues Encountered

- `tsx` via stdin (`<<EOF | npx tsx -`) doesn't apply the `.ts` extension transform, so the first fixture-verification attempt failed on the literal `.ts` import path. Resolution: wrote a temp `_clientes_fixture.ts` file at project root, ran `npx tsx _clientes_fixture.ts`, removed before commit. Same pattern used for Tasks 2's fixtures (`_clientes_fixture2.ts`, `_clientes_fixture3.ts`). All temp files cleaned before commits — no fixture artifacts in HEAD.

## User Setup Required

None — pure module, no external services or env vars.

## Next Phase Readiness

- **Plan 05-02 unblocked:** `EmpresaListRow` and `EmpresasIndexSummary` are stable contracts for `ClientesKPICards` (consumes `EmpresasIndexSummary`) + `ClientesTable` (consumes `EmpresaListRow[]`).
- **Plan 05-03 unblocked:** `EmpresaProfileSummary` + `MonthlyActivity` are stable contracts for `EmpresaProfileHeader` + `EmpresaActivityChart`.
- **Plan 05-04 unblocked:** page composition wires `parseFilters → getCachedTransactions → deriveEmpresasIndex + summarizeEmpresasIndex` for /clientes; for /clientes/[empresaId], wires `findEmpresa + aggregateMonthlyActivity` (plus historical-only filter for the 12-month chart, which is independent of `filters.from/to` since the chart spans 12 months ending at `asOf`).
- **Pattern reusable:** the "filter as profile picker, not row filter" call is the first time this dashboard makes that distinction explicit. If Phase 5+ adds a /destinos or /tikintags drill-down view, the same convention applies (the URL `?empresa=` is for routing into that view, not for narrowing it).
- **No blockers or concerns.**

---
*Phase: 05-clientes-domain*
*Completed: 2026-05-06*
