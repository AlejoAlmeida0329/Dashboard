---
phase: 04-inicio-recargas
plan: 03
subsystem: domain
tags: [typescript, recargas, payin_pse, payin_transfer, date-fns-tz, pure-module, hechos-curados]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: bonos.ts pure-domain pattern (filter + summary + 3 aggregations + top10), Bogotá-anchored date helpers, RecargaByEmpresa shape mirror, pctDelTotal zero-safety convention
  - phase: 02-bonos
    provides: Transaction interface (id, fecha, monto, tipo, direction, status, empresa_id, empresa_nombre)
  - phase: 02-bonos
    provides: TransactionType enum (PAYIN_PSE, PAYIN_TRANSFER captured live in 02-01-SUMMARY.md)
  - phase: 01-foundation
    provides: DashboardFilters shape (from, to, empresa, presenter), Bogotá-TZ date convention from url-state.ts
provides:
  - filterRecargas (Recargas filter contract: tipo ∈ {PAYIN_PSE, PAYIN_TRANSFER} + direction='in' + status='completed' + Bogotá-anchored from/to + optional empresa)
  - summarizeRecargas (RecargaSummary = {count, montoTotal})
  - aggregateRecargasByDate (RecargaByDate[] = {date, count, monto}, sorted asc by date, no zero-fill)
  - aggregateRecargasByEmpresa (RecargaByEmpresa[] sorted desc by monto, pctDelTotal zero-safe)
  - top10RecargasEmpresas (rows.slice(0, 10))
  - findTopEmpresaRecargadora (hecho curado — first row of pre-sorted RecargaByEmpresa[] or null)
  - findRecargaMasGrande (hecho curado — single Transaction with max monto, tie-break on chronologically-earlier fecha, or null)
  - 3 stable output type interfaces (RecargaSummary, RecargaByDate, RecargaByEmpresa)
affects: [04-06 RecargasKPICards/RecargasTable UI consumers, 04-08 page composition wiring filterRecargas + 4 aggregations + 2 hechos curados]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure domain module shape (mirror of bonos.ts/payouts.ts): no next/, react, server-only, lib/sheets/, lib/format imports — only date-fns-tz runtime + type-only ./types and @/lib/url-state"
    - "Inline date helpers (startOfDayBogotaTimestamp/endOfDayBogotaTimestamp) verbatim copied from bonos.ts rather than DRY-ing across modules — third domain module to establish this convention"
    - "Hechos curados as pure functions returning T | null (deterministic tie-break for findRecargaMasGrande prefers chronologically-earlier fecha)"
    - "Module decoupled from @/lib/format Intl gate via direct formatInTimeZone import (slight divergence from bonos.ts which uses toBogotaISODate from @/lib/format)"

key-files:
  created:
    - src/lib/domain/recargas.ts (433 lines, 7 functions + 3 types + 1 const)
  modified: []

key-decisions:
  - "RECHARGE_TIPOS = ['PAYIN_PSE', 'PAYIN_TRANSFER'] — the 'user puts money in' tipos per types.ts; PURCHASE/BONUS are different intents (sale to user / promotion) and excluded so the highlight-reel narrative stays clean"
  - "filterRecargas mirrors filterBonos contract verbatim: direction='in' + status='completed' guards stay defensive even though PAYIN_* tipos should always be 'in' in production — keeps the count clean if a future schema drift leaks 'out' reversal rows"
  - "aggregateRecargasByDate uses formatInTimeZone directly (not toBogotaISODate from @/lib/format) — module stays decoupled from the project's Intl gate. Plan-level verify check explicitly requires NO @/lib/format import in the recargas module"
  - "findTopEmpresaRecargadora is trivial first-of-sorted-rows pick (since aggregateRecargasByEmpresa already sorts desc by monto). Module stays composable: caller chains aggregate → findTop without re-sorting"
  - "findRecargaMasGrande tie-break on equal monto prefers chronologically-earlier fecha — keeps output deterministic across renders. JSDoc documents this so UI consumers in Plan 04-06 don't accidentally rely on tie-order"
  - "Inline date helpers verbatim copied from bonos.ts (third module after bonos.ts and payouts.ts to make this DRY-vs-cohesion call). The shared util would require all three domain modules to import a fourth file — inline ~22 lines is the cheaper choice when only three modules need it"

patterns-established:
  - "Hecho curado as pure T | null function: empty input → null, non-empty → deterministic pick. Mirror in Plan 04-04 (inicio-hechos.ts) for the 3 inicio hechos curados"
  - "Multi-tipo set as constant: RECHARGE_TIPOS pattern (vs bonos' single BONO_TRANSACTION_TYPES) — Set membership check via Set<string> for O(1) lookup. Reusable for future tipo-set-based domain modules (e.g. if Tikin adds PAYIN_NEQUI/PAYIN_DAVIPLATA, append to RECHARGE_TIPOS — single edit point)"
  - "JSDoc 'Recargas Filter Contract' section at file top documents the WHY of the tipo set — paralleling Bonos' 'Bonos Filter Contract' so Phase 5+ readers can find the contract by ctrl-F-ing 'Filter Contract' across domain modules"

# Metrics
duration: 3m 54s
completed: 2026-05-05
---

# Phase 04 Plan 03: Recargas Domain Library Summary

**Pure recargas.ts domain module with 7 functions (filter + summary + 3 aggregations + 2 hechos curados) over RECHARGE_TIPOS = {PAYIN_PSE, PAYIN_TRANSFER}, mirror of bonos.ts shape ready for Plans 04-06 (UI) and 04-08 (page composition).**

## Performance

- **Duration:** 3m 54s
- **Started:** 2026-05-05T02:11:53Z
- **Completed:** 2026-05-05T02:15:47Z
- **Tasks:** 2 / 2
- **Files modified:** 1 (created)

## Accomplishments

- Plan executed exactly as written — ZERO deviations (FIFTH consecutive zero-deviation plan after 02-04, 03-02, 03-03, 03-04). The plan-author's "mirror-the-proven-pattern" approach (bonos.ts is production-validated since Plan 02-04) → fewer architectural choices means fewer ways to get this wrong.
- 7 stable functions exported: `filterRecargas`, `summarizeRecargas`, `aggregateRecargasByDate`, `aggregateRecargasByEmpresa`, `top10RecargasEmpresas`, `findTopEmpresaRecargadora`, `findRecargaMasGrande`.
- 3 stable output type interfaces exported: `RecargaSummary`, `RecargaByDate`, `RecargaByEmpresa` — contracts for Plan 04-06 (RecargasKPICards, RecargasTable) and Plan 04-08 (page composition).
- All 5 must_have truths from PLAN.md verified.
- Module confirmed pure: only `date-fns-tz` runtime import + type-only `./types` and `@/lib/url-state` imports. No `next/`, `react`, `server-only`, `lib/sheets/`, or `lib/format` imports.
- Per-task atomic-commit pattern preserved (mirror of 02-02 / 02-04 / 03-02 / 03-03 / 03-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create recargas.ts with filter + summary + 3 aggregations** — `51cd230` (feat)
2. **Task 2: Add findTopEmpresaRecargadora + findRecargaMasGrande hechos curados** — `25ef95a` (feat)

**Plan metadata:** `<this commit>` (docs: complete recargas domain plan)

## Files Created/Modified

- `src/lib/domain/recargas.ts` (created, 433 lines) — Pure recargas domain module mirroring bonos.ts. Contains:
  - `RECHARGE_TIPOS` constant: `['PAYIN_PSE', 'PAYIN_TRANSFER']`
  - `BOGOTA_TZ` constant: `"America/Bogota"`
  - 2 file-private date helpers (verbatim copy of bonos.ts:53-74)
  - 3 exported output type interfaces
  - 7 exported pure functions

## Final Function Signatures

```ts
// Filter
export function filterRecargas(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[];

// Summary KPIs
export function summarizeRecargas(recargas: Transaction[]): RecargaSummary;

// Aggregations
export function aggregateRecargasByDate(recargas: Transaction[]): RecargaByDate[];
export function aggregateRecargasByEmpresa(recargas: Transaction[]): RecargaByEmpresa[];
export function top10RecargasEmpresas(rows: RecargaByEmpresa[]): RecargaByEmpresa[];

// Hechos curados
export function findTopEmpresaRecargadora(rows: RecargaByEmpresa[]): RecargaByEmpresa | null;
export function findRecargaMasGrande(recargas: Transaction[]): Transaction | null;
```

```ts
// Output types
export interface RecargaSummary {
  count: number;
  montoTotal: number;
}
export interface RecargaByDate {
  date: string;       // YYYY-MM-DD (Bogotá calendar)
  count: number;
  monto: number;
}
export interface RecargaByEmpresa {
  empresa_id: string;
  empresa_nombre: string;
  count: number;
  monto: number;
  pctDelTotal: number;  // fraction 0..1, zero-safe
}
```

## Mental-Fixture Verification Results

All fixtures cited in PLAN.md `<verify>` sections matched expected behavior:

| Fixture | Expected | Verified |
|---------|----------|----------|
| `summarizeRecargas([])` | `{ count: 0, montoTotal: 0 }` | ✓ Loop body never enters; `recargas.length === 0` |
| `filterRecargas` with `tipo: "BONUS"` | excluded | ✓ `rechargeTypeSet.has("BONUS")` is false |
| `aggregateRecargasByEmpresa` with 2 empresas (montoTotal=300) | empresa-1 (200, pct=0.667), empresa-2 (100, pct=0.333) | ✓ `200/300 ≈ 0.667`, `100/300 ≈ 0.333`, sorted desc |
| `findTopEmpresaRecargadora([])` | `null` | ✓ `rows.length === 0` short-circuit |
| `findRecargaMasGrande([])` | `null` | ✓ Empty guard returns null |
| `findRecargaMasGrande` with montos `[100, 500, 200]` | the 500 transaction | ✓ Reduce traverses; `500 > 100` → best=500; `200 > 500` false → keeps 500 |

## RECHARGE_TIPOS Set & Rationale

**Set:** `["PAYIN_PSE", "PAYIN_TRANSFER"]`

**Why these two:** A "recarga" in Tikin's domain = the user puts money INTO their wallet. Two `transaction_type` values express this intent in BD_Plataforma:
- `PAYIN_PSE` — recarga via PSE (online bank debit)
- `PAYIN_TRANSFER` — recarga via direct transfer

**Why NOT others:**
- `PURCHASE` has `direction='in'` for the receiving side, but it's a sale TO the user from another empresa — different intent.
- `BONUS` is also `direction='in'` but it's a promotion — different intent (and owned by Bonos tab).
- Conflating PURCHASE/BONUS with PAYIN_* would make the "X recargas, $Y montoTotal" highlight-reel narrative misleading.

**If Tikin adds variants** (e.g. `PAYIN_NEQUI`, `PAYIN_DAVIPLATA`): append to `RECHARGE_TIPOS` — single-edit-point migration. The Set membership check picks them up automatically.

## Stable Contracts for Downstream Plans

**Plan 04-06 (RecargasKPICards, RecargasTable):**
- `RecargaSummary` interface: `RecargasKPICards` consumes `{count, montoTotal}` from `summarizeRecargas`.
- `RecargaByEmpresa[]`: `RecargasTable` (top 10) consumes `top10RecargasEmpresas(aggregateRecargasByEmpresa(...))`.
- `RecargaByDate[]`: optional trend chart (not required by 04-CONTEXT.md but available if Plan 04-08 wires it).

**Plan 04-08 (page composition / `/recargas` page):**
- `filterRecargas(transactions, filters)` is the entry point — page composition mirrors `bonos/page.tsx` shape (Plan 02-04).
- 4 aggregation calls feed the 4 visible widgets (KPIs, trend, leaderboard top 10, hechos curados card).
- 2 hechos curados (`findTopEmpresaRecargadora`, `findRecargaMasGrande`) feed the highlight-reel cards per 04-CONTEXT.md `<specifics>` section.
- Cliente-foco contract: hechos curados card carries `data-presenter-empresa-hide` (CSS attribute introduced by parallel Plan 04-01) so it disappears in `?presenter=1&empresa=$X` view — domain library stays dumb about this and just answers "given these inputs, what's the top empresa / largest recarga?".

## Decisions Made

None - followed plan as specified.

The plan-author phase pre-resolved every architectural choice:
- Tipo set membership (PAYIN_PSE + PAYIN_TRANSFER) cited from 02-01-SUMMARY.md production capture.
- Date helpers (inline copy from bonos.ts) — third module to establish this convention.
- Date formatting via `formatInTimeZone` directly (not via `@/lib/format`) — explicit verify check enforced this divergence from bonos.ts.
- Output type shape (RecargaSummary {count, montoTotal} — narrower than BonoSummary which carries ticketPromedio/comisionTotal/montoTotal) — simpler because Recargas highlight-reel doesn't need ticket-promedio/comisión.
- Tie-break for `findRecargaMasGrande` (chronologically-earlier fecha on equal monto) — pre-specified in PLAN.md so deterministic output is the contract, not an implementation detail.

## Deviations from Plan

None - plan executed exactly as written.

This is the FIFTH consecutive zero-deviation plan (after 02-04, 03-02, 03-03, 03-04). Pattern reinforces: domain library plans achieve near-deterministic execution when (a) literal code blocks ship in `<action>`, (b) verify steps cite expected outputs to the digit, (c) reference module is mirror-able line-for-line, (d) divergences from the reference (here: no `@/lib/format` import) are explicit in `<verify>`.

---

**Total deviations:** 0
**Impact on plan:** Plan compiled clean on first build, all `<verify>` fixtures matched expected values, full `npm run build` succeeded (Next 16.2.4 Turbopack, ✓ Compiled successfully in 9.1s, TS 8.0s, all 11 routes emitted).

## Issues Encountered

None.

Two unrelated working-tree modifications (from parallel plans 04-01 / 04-02 / 04-04 running in parallel waves) were correctly excluded from this plan's commits — only `src/lib/domain/recargas.ts` was staged per the plan's `files_modified` declaration.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `recargas.ts` is complete and ready for consumption by:
  - **Plan 04-06**: UI components (`RecargasKPICards`, `RecargasTable`, optional `RecargasChart`, `RecargasHechosCurados`) — type contracts (RecargaSummary, RecargaByDate, RecargaByEmpresa, Transaction) are stable.
  - **Plan 04-08**: Page composition (`/recargas/page.tsx`) — mirrors `bonos/page.tsx` skeleton from Plan 02-04. Conditional cross-tab fetch pattern from Plan 03-04 is NOT needed here (BD_Plataforma is the single source for recargas; no join required).
- **No blockers.** All upstream dependencies (Plan 02-01 Transaction shape, Plan 01-03 DashboardFilters) are stable.
- **No concerns.** Module is ~433 LOC with comprehensive JSDoc; future maintainers extending RECHARGE_TIPOS or adjusting filter contract can find the single edit-point in <30 seconds.

---
*Phase: 04-inicio-recargas*
*Completed: 2026-05-05*
