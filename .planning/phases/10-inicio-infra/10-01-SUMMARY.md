---
phase: 10-inicio-infra
plan: 01
subsystem: domain
tags: [inicio, v2, operative-lens, tikintag, transaction-type-distribution, activity-series, top-users, coexistence]

# Dependency graph
requires:
  - phase: 04-inicio-recargas
    provides: v1 inicio.ts surface (filterCompletedIn / summarizeInicio / aggregateGMV* / aggregateActiveEmpresas* + 4 types) — preserved byte-identical
  - phase: 06-foundation-v2
    provides: DashboardFilters CSV contract (filters.status, filters.tipo) — Plan 06-03
  - phase: 07-bonos-payouts
    provides: filterPayoutsV2 CSV-status pattern (Plan 07-03) — mirror reference
  - phase: 08-tarjeta-recargas
    provides: aggregateTopRechargers / aggregateTopCardUsers tikintag-ranking pattern (Plans 08-01, 08-03) — mirror reference
provides:
  - filterInicioV2 — state-UNFILTERED CSV-status + CSV-tipo + Bogotá-anchored filter
  - summarizeInicioV2 — operative-lens KPIs (usuariosActivos + IN/OUT volumen + status counters + successRate)
  - aggregateTransactionTypeDistribution — top-N + Otros rollup donut data
  - aggregateActivityByDateV2 / aggregateActivityByWeekV2 — distinct-tikintag-per-bucket time series with signed volumen
  - aggregateTopUsersByVolume — top-N tikintag ranking by volumenNeto with deterministic tiebreak
  - 4 new exported types (InicioSummaryV2, TransactionTypeBucket, ActivityPointV2, TopUserVolumeRow)
affects:
  - 10-02-inicio-page-rewrite (consumes the 6 v2 functions + 4 v2 types; will swap inicio/page.tsx imports + prune v1 block + 4 v1 payouts.ts symbols + inicio-hechos.ts in one cohesive diff)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — v2 surface reuses v1 imports (formatInTimeZone, DashboardFilters, Transaction, TransactionType)
  patterns:
    - "v2-alongside-v1 coexistence (5th instance — bonos.ts 07-01, payouts.ts 07-03, recargas.ts 08-03, cardUsage.ts 08-01 from-scratch, inicio.ts 10-01)"
    - "State-UNFILTERED v2 default + URL CSV narrows on demand (mirror of filterPayoutsV2 — same Set lookup pattern)"
    - "Cross-cut filter (BOTH directions, ALL tipos) — distinct from BONUS/PURCHASE/PAYIN-pinned sibling v2 filters"
    - "DISTINCT tikintag per time bucket via Set-per-bucket (Pitfall 11 closed at v2 granularity, mirror of v1 aggregateActiveEmpresasByDate but keyed by tikintag instead of empresa_id)"
    - "Top-N + Otros rollup with stable tiebreak (count DESC → tipo lex ASC) — mirror of payouts aggregateTopBancos"
    - "Top-users-by-tikintag user-lens (canonical at v2 ranking layer per STATE.md Plan 08-04 entry)"
    - "volumenNeto = volumenIn - volumenOut as signed ranking key (operator-relevant headline; positive = net receiver, negative = net spender)"
    - "Deterministic tiebreak ladder: volumenNeto DESC → transacciones DESC → tikintag lex ASC"

key-files:
  created:
    - .planning/phases/10-inicio-infra/10-01-SUMMARY.md
  modified:
    - src/lib/domain/inicio.ts

key-decisions:
  - "v2 cross-cut filter lets BOTH directions through (drops v1 direction !== 'in' short-circuit) — Inicio is the one v2 tab where ALL tipos AND BOTH directions are in scope by default; defensively skips OTRO_DIRECTION only."
  - "successRate denominator = transactions.length (NOT countCompleted + countFailed + countInProgress) — mirrors summarizePayoutsByState.total convention. If a future state lands the three named counters quietly underrepresent until schema updates, but the total stays correct."
  - "PRD v2 INI-V2-02 baseline (98.1% completed / 1.6% rejected / 0.2% in_progress) cited inline in JSDoc — operator can compare a per-period reading against the baseline at a glance."
  - "Top-N ranking ties broken by tipo lex ASC (transaction-type distribution) and by transacciones DESC then tikintag lex ASC (top users) — both deterministic across renders."
  - "filters.tipo INTENTIONALLY honored by filterInicioV2 (unlike filterBonosV2 BONUS-by-definition / filterPayoutsV2 PAYOUT-by-table-of-origin / filterRecargasV2 PAYIN-by-definition / filterPurchases PURCHASE-by-definition). Inicio v2 is the cross-cut tab — the global tipo CSV is its native filter."
  - "Activity time series volumen field is SIGNED (NOT abs) — operator answer is 'net flow that day'; the IN/OUT split lives on summarizeInicioV2 KPIs."
  - "ActivityPointV2 single-shape carries both usuariosActivos + volumen streams — v2 chart renders a line + an area on the same x-axis (chart leaf concern in Plan 10-02; domain emits both)."
  - "Bogotá-anchored bucket helpers reused from v1 block (startOfDayBogotaTimestamp / endOfDayBogotaTimestamp at line 60 / 74) — no duplication, no new helpers."

patterns-established:
  - "5th v2-alongside-v1 coexistence — append below v1 with section-header comment block; v1 byte-identical until Wave-2 page rewrite swaps imports"
  - "Cross-cut v2 filter (BOTH directions, ALL tipos by default, URL narrows on demand)"
  - "Top-N + Otros rollup over a typed enum (TransactionType) widened to string at the bucket-type level for the 'Otros' literal"

# Metrics
duration: ~2 min (implementation only — Task 1 + Task 2 commits 2m 15s apart)
completed: 2026-05-08
---

# Phase 10 Plan 01: Inicio v2 Domain Surface Summary

**Inicio v2 operative-lens domain surface — 6 v2 functions + 4 v2 types appended below v1 block, v1 byte-identical, ready for Plan 10-02 page rewrite consumption.**

## Performance

- **Duration:** ~2 min implementation (Task 1 commit at 08:55:36, Task 2 at 08:57:51)
- **Started:** 2026-05-08T08:53:00-05:00 (approx — context loading + reads)
- **Completed:** 2026-05-08T08:57:51-05:00 (last task commit)
- **Tasks:** 2 (both auto-type, both atomic-commit)
- **Files modified:** 1 (`src/lib/domain/inicio.ts`)

## Accomplishments

- **6 new v2 exported functions** appended below the v1 block: `filterInicioV2`, `summarizeInicioV2`, `aggregateTransactionTypeDistribution`, `aggregateActivityByDateV2`, `aggregateActivityByWeekV2`, `aggregateTopUsersByVolume`.
- **4 new v2 exported types**: `InicioSummaryV2`, `TransactionTypeBucket`, `ActivityPointV2`, `TopUserVolumeRow`.
- **v1 surface (lines 1-361) byte-identical** — verified via `git diff HEAD~2 -U0 -- src/lib/domain/inicio.ts` showing exactly one append-only hunk starting at line 362.
- **Zero new dependencies** — v2 reuses v1 imports verbatim (`formatInTimeZone`, `DashboardFilters`, `Transaction`, `TransactionType`).
- **Build still 13 routes** with v1 still consumed by `inicio/page.tsx` + `HechosCurados.tsx` until Plan 10-02 swaps imports.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append v2 filter + summarizeInicioV2 + transaction-type distribution** — `8ea04b6` (feat)
   - 321 insertions: section header + InicioSummaryV2 + TransactionTypeBucket + filterInicioV2 + summarizeInicioV2 + aggregateTransactionTypeDistribution.
2. **Task 2: Append activity time series + top users by volume** — `12d0710` (feat)
   - 247 insertions: ActivityPointV2 + aggregateActivityByDateV2 + aggregateActivityByWeekV2 + TopUserVolumeRow + aggregateTopUsersByVolume.

**Total LOC added:** 568 (321 Task 1 + 247 Task 2). v1 LOC preserved: 361. File total: 929 lines.

## Final v2 Surface Inventory

Line numbers in the post-Task-2 file:

| Symbol | Line | Kind | Role |
|---|---|---|---|
| `InicioSummaryV2` | 409 | interface | INI-V2-01 + INI-V2-02 KPI shape (usuariosActivos + IN/OUT + status + successRate) |
| `TransactionTypeBucket` | 454 | interface | INI-V2-03 donut bucket (tipo + count + share); `tipo` widened to `string` for "Otros" literal |
| `filterInicioV2` | 495 | function | INI-V2-04 cross-cut filter (state-UNFILTERED, BOTH directions, ALL tipos by default; CSV narrows on demand) |
| `summarizeInicioV2` | 555 | function | INI-V2-01 + INI-V2-02 single-pass reduce |
| `aggregateTransactionTypeDistribution` | 640 | function | INI-V2-03 top-N + Otros rollup |
| `ActivityPointV2` | 694 | interface | INI-V2-05 time-series bucket (bucket + usuariosActivos + signed volumen) |
| `aggregateActivityByDateV2` | 736 | function | INI-V2-05 daily Bogotá buckets, distinct-tikintag per day |
| `aggregateActivityByWeekV2` | 775 | function | INI-V2-05 ISO-week (RRRR-Www) Bogotá buckets, distinct-tikintag per week |
| `TopUserVolumeRow` | 818 | interface | INI-V2-06 ranking row (tikintag + empresa label + IN/OUT/Neto + count) |
| `aggregateTopUsersByVolume` | 891 | function | INI-V2-06 top-N tikintag ranking (volumenNeto DESC → transacciones DESC → tikintag lex ASC) |

**v1 surface unchanged at original line numbers:** `InicioSummary` (90), `InicioDeltaSummary` (111), `GMVPoint` (117), `ActiveEmpresaPoint` (125), `filterCompletedIn` (166), `summarizeInicio` (212), `aggregateGMVByDate` (252), `aggregateGMVByWeek` (280), `aggregateActiveEmpresasByDate` (316), `aggregateActiveEmpresasByWeek` (344).

**Total exports in inicio.ts:** 20 (10 v1 + 10 v2 — 5 interfaces + 5 functions per side).

## Files Created/Modified

- `src/lib/domain/inicio.ts` — appended v2 surface below v1 block. v1 lines 1-361 byte-identical; v2 surface at lines 362-929 (568 LOC).

## Decisions Made

(See `key-decisions` in frontmatter for the full list extracted to STATE.md.)

Highlights:

- **v2 cross-cut filter lets BOTH directions through** (drops v1 `direction !== 'in'` short-circuit). Inicio v2 is the one tab where ALL tipos AND BOTH directions are in scope by default. Defensively skips `OTRO_DIRECTION` only.
- **`successRate` denominator = `transactions.length`** (NOT `countCompleted + countFailed + countInProgress`) — mirrors `summarizePayoutsByState.total` convention from `payouts.ts:557`. Defensive against future state additions.
- **`filters.tipo` INTENTIONALLY honored by `filterInicioV2`** (unlike sibling v2 filters that hard-pin their tipo: `filterBonosV2` BONUS-by-definition / `filterPayoutsV2` PAYOUT-by-table-of-origin / `filterRecargasV2` PAYIN-by-definition / `filterPurchases` PURCHASE-by-definition). Inicio v2 is the cross-cut tab — the global `tipo` CSV multi-select is its native filter.
- **Activity time series `volumen` field is SIGNED (NOT abs)** — operator-relevant answer is "net flow that day"; the IN/OUT split lives on `summarizeInicioV2` KPIs, not on the time series chart.
- **`ActivityPointV2` single-shape carries both `usuariosActivos` + `volumen`** — v2 chart can render a line + area on the same x-axis (chart leaf concern in Plan 10-02; domain emits both streams from one aggregation pass).
- **Top-N tail rollup: ties broken by `tipo` lex ASC** (transaction-type distribution); top-users ties broken by `transacciones` DESC then `tikintag` lex ASC. Both deterministic across renders.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan vocabulary matched `types.ts` field names directly (`Transaction.tikintag`, `Transaction.empresa_nombre`, `Transaction.direction`, `Transaction.status`, `Transaction.tipo`, `Transaction.monto`, `DashboardFilters.status`, `DashboardFilters.tipo`, `DashboardFilters.from/to/empresa`). No field-name reconciliation was needed — fourth clean break in a row after Plans 09-01, 09-02, 09-03 (the plan's `<output>` section flagged "expect ZERO if plan vocabulary matches types.ts — fourth clean break in a row would be notable"; we hit fifth clean break counting Plan 09-03 already shipped).

Minor count quibble (NOT a deviation): plan's `<verify>` block said "16 exports total" expecting "v1 (4 fns + 4 interfaces) + v2 (4 fns + 4 interfaces)". Actual v1 has 6 fns + 4 interfaces = 10 (the plan undercounted v1; v1 has both `aggregateGMVByDate/Week` AND `aggregateActiveEmpresasByDate/Week`, so 4 aggregations not 2). v2 delivers 6 fns + 4 interfaces = 10 (the plan called for "4 aggregations + 1 filter = 5 fns + 5 types"; the actual breakdown is 4 aggregations + 1 filter + 1 summary = 6 fns; types: 4 interfaces — `InicioSummaryV2` + `TransactionTypeBucket` + `ActivityPointV2` + `TopUserVolumeRow`). Total file exports: 20 (10 v1 + 10 v2). The plan's verify clause `wc -l` of 16 was a verification-clause undercount; the actual surface delivered matches the action specs in `<task>` blocks 1-by-1.

## Issues Encountered

**None.** Task 1 and Task 2 each compiled, linted, and built clean on first try. Lint baseline (3 pre-existing warnings) unchanged.

## Verification Snapshot

- `npx tsc --noEmit`: 0 errors
- `npm run lint`: 0 errors, 3 baseline warnings (`ClientesTable.tsx:292`, `rate-limit.ts:37`, `_utils.ts:128` — all pre-existing, unrelated to plan)
- `npm run build`: 13 routes (no consumer changes yet — v1 still consumed by `inicio/page.tsx` + `HechosCurados.tsx`)
- `git diff HEAD~2 -U0 -- src/lib/domain/inicio.ts | grep '^@@'` → single hunk: `@@ -361,0 +362,568 @@ export function aggregateActiveEmpresasByWeek(` — confirms v1 lines 1-361 byte-identical, all 568 new lines purely appended below.

## User Setup Required

None — no external service configuration required. Pure-domain TypeScript work.

## Next Phase Readiness

**Ready for Plan 10-02 (Inicio v2 page rewrite + cohesive prune):**

- 6 v2 functions + 4 v2 types are exported and consumable from `@/lib/domain/inicio`.
- v1 surface still alive — `inicio/page.tsx` + `HechosCurados.tsx` continue building/rendering identically against v1 today.
- Plan 10-02 will:
  1. Swap `inicio/page.tsx` imports from v1 to v2 surface (`filterInicioV2` + `summarizeInicioV2` + `aggregateTransactionTypeDistribution` + `aggregateActivityByDateV2`/`ByWeekV2` + `aggregateTopUsersByVolume`).
  2. Replace the v1 Latencia destacada hecho (currently uses `filterPayouts + summarizePayouts` from the kept-alive v1 payouts.ts surface) with v2 helpers (`summarizePayoutsByState` + `aggregateAverageProcessingMinutes`) — closing the Phase 7 deferred-prune docket for the 4 v1 payouts.ts symbols (`filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`).
  3. Prune the v1 inicio.ts block (10 v1 exports — 6 fns + 4 interfaces, lines 1-361).
  4. Delete `src/lib/domain/inicio-hechos.ts` entirely (last consumer of v1 inicio surface; replaced by v2 page composition).
  5. Land all swaps + prunes in one cohesive `refactor(10-02)` commit.

**Phase 10 deferred-prune docket after Plan 10-02:** ZERO. Phase 7 + 8 + 10's combined v1 prunes will be fully reconciled.

**No blockers or concerns.** Plan 10-03 (INFRA-04 — domain configuration on Vercel) is independent of 10-01 and 10-02 and may execute in parallel if desired.

---

*Phase: 10-inicio-infra*
*Plan: 10-01*
*Completed: 2026-05-08*
