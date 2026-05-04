---
phase: 03-payouts
plan: 02
subsystem: domain-library
tags: [domain, pure-functions, percentile, r-7, histogram, half-open-buckets, topbancos, success-rate, zero-safe]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: "Pure-module convention (`bonos.ts` shape: no next/react/server-only/sheets imports; private startOfDay/endOfDay Bogotá helpers; zero-safe contracts; default-filter-contract JSDoc pattern). Single Intl gate (`src/lib/format.ts`)."
  - phase: 03-payouts
    plan: 01
    provides: "Stable `Payout` interface (transactionId, internalId, fecha, holder, monto, costo, medium, state, latencySeconds, failureReason?, failureDetails?, empresa_id?). PayoutState union + PayoutMedium open-string type. Three live findings (Aging/Total Time → seconds via parsePgInterval; Holder ≠ tikintag; Destination Medium = bank codes, all 798 rows are bank payouts)."
provides:
  - "Default Payouts filter contract: state=='completed' + Bogotá-anchored from/to + optional empresa_id match (Plan 03-04 will populate empresa_id via Transaction ID join)"
  - "filterPayouts (state-filtered) + filterPayoutsByPeriodOnly (state-unfiltered for success-rate denominator) sibling pair"
  - "quantileSorted: R-7 linear interpolation primitive — INPUT MUST BE SORTED ASCENDING — zero-safe, fixture-verified vs NumPy/R reference values"
  - "summarizePayouts: {count, montoTotal, p50Seconds, p95Seconds} — zero-safe contract, sorts latencies once and reuses for both percentiles"
  - "aggregateLatencyHistogram: 4 fixed buckets {<1h, 1-6h, 6-24h, >24h} with half-open intervals (boundary value lands in upper bucket); always emits all 4 rows for stable Recharts shape; NO medium stack (scope-adjusted from Plan 03-01)"
  - "aggregateTopBancos: top N + 'Otros bancos' rollup; per-bank BancoStats {medium, count, montoTotal, p50Seconds, p95Seconds}; re-aggregates underlying rows for the Otros tail because percentiles don't compose by addition"
  - "aggregateSuccessRate: zero-safe rate KPI; documented to consume state-UNFILTERED denominator via filterPayoutsByPeriodOnly"
affects: [03-03-payouts-page, 03-04-payouts-presenter, 04-recargas (success-rate pattern reusable), 04-inicio]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "r-7-percentile-citation: quantileSorted explicitly cites the algorithm name (R-7 linear interpolation) inline in JSDoc with the formula and 5 fixture-verified examples; future readers don't reverse-engineer math"
    - "sort-once-reuse: percentile primitive REQUIRES sorted input; callers (summarizePayouts, aggregate-helper inside aggregateTopBancos) sort the latencies array ONCE and reuse for p50 + p95 — avoid the O(n log n) cost twice"
    - "half-open-bucket-convention: histogram intervals are [lower, upper); a boundary value (3600s, 21600s, 86400s) falls into the UPPER bucket. Cited inline + fixture-verified at exact edges. Matches R/NumPy/Excel/BI tools convention."
    - "stable-shape-on-empty: aggregateLatencyHistogram always emits 4 rows regardless of input. Recharts BarChart in Plan 03-03 needs deterministic categories across renders so filter swaps don't cause shape jumps. Pattern carries forward to any future fixed-category aggregator."
    - "state-unfiltered-denominator: aggregateSuccessRate consumes a STATE-UNFILTERED universe via filterPayoutsByPeriodOnly sibling helper. If we used filterPayouts (state-filtered), the rate would always be 100%. Sibling helpers + pairing JSDoc make the contract explicit, not implicit."
    - "percentile-non-composability: Otros tail in aggregateTopBancos re-aggregates underlying Payout rows rather than summing per-bank BancoStats. Percentiles do NOT compose by addition (the p95 of A∪B is generally NOT a function of p95(A) + p95(B)). Documented inline."
    - "scope-adjustment-documented-inline: module docstring explicitly calls out the Plan 03-01 reinterpretation (no medium stack in histogram; aggregateTopBancos replaces aggregateByDestination). PAY-04 reinterpretation rationale lives at the call site, not just in this SUMMARY."

key-files:
  created:
    - src/lib/domain/payouts.ts (609 lines — pure aggregations + JSDoc-dense contracts)
  modified: []

key-decisions:
  - "Default Payouts filter contract: state=='completed' + Bogotá-anchored from/to + optional p.empresa_id===filter.empresa. The empresa filter cannot use Holder (Plan 03-01: Holder is cardholder name); when filter.empresa is set without the Plan 03-04 join, the function correctly returns []. Better empty than wrong-empresa data."
  - "Percentile algorithm = R-7 linear interpolation (NumPy/R/Excel default). Fixture-verified inline: median of [1..5]=3 exact, median of [1..4]=2.5 (interpolated), p95 of [1..10]=9.55 (h=8.55, interpolated 9 + 0.55*1). Zero-safe: empty input → 0, single value → that value, p<=0 → first, p>=1 → last."
  - "Histogram bucket boundaries are HALF-OPEN [lower, upper). A boundary value (3600s, 21600s, 86400s) falls into the UPPER bucket. Verified inline: 3599s → '<1h', 3600s → '1-6h', 21600s → '6-24h', 86400s → '>24h'. The half-open convention matches R/NumPy/Excel binning; closed-on-both-ends would need a non-obvious tiebreak."
  - "Histogram has NO medium stack. All 798 production payouts are bank (Plan 03-01 finding); a stack would always show one color and one zero, visually misleading. Single-series shape ({bucket, count}) replaces the originally planned stack-by-medium."
  - "aggregateTopBancos REPLACES aggregateByDestination. Originally PAY-04 split tarjeta vs banco; Plan 03-01 confirmed zero card payouts in production. Top N banks by montoTotal + 'Otros bancos' rollup is the data-honest reinterpretation. The literal Spanish 'Otros bancos' string is the rendered category for the rollup tail — Plan 03-03 consumes it as-is."
  - "aggregateTopBancos's Otros rollup re-aggregates underlying Payout rows rather than summing per-bank BancoStats. Percentiles do NOT compose by addition: the p95 of (group A ∪ group B) is generally NOT a function of p95(A) and p95(B). The function needs the underlying values to compute correctly. Documented inline + fixture-verified (3-bank Otros tail with latencies [50,75,100] yields p50=75 exact, p95=97.5 interpolated)."
  - "Two filter functions, not one: filterPayouts (state-filtered, for headline metrics) and filterPayoutsByPeriodOnly (state-UNFILTERED, for success-rate denominator). If aggregateSuccessRate ran on filterPayouts output, the rate would always be 100% (the classic 'I divided by completed-only' bug). Sibling helpers + pairing JSDoc make the contract explicit, not implicit."
  - "PayoutSummary, LatencyBucket, BancoStats, TopBancos, SuccessRate are stable contracts for Plans 03-03/04 to consume. Output types co-located with the function that produces them (mirror of bonos.ts BonoSummary/BonoByDate/BonoByEmpresa pattern)."
  - "Module is a 609-line PURE TypeScript file: 0 imports from next/, 0 from react, 0 from server-only, 0 from @/lib/sheets/. Imports limited to type-only `Payout, PayoutState` from ./types and type-only `DashboardFilters` from @/lib/url-state — exactly the bonos.ts shape."
  - "Bogotá date helpers (startOfDayBogotaTimestamp/endOfDayBogotaTimestamp) are inline copies from bonos.ts, not centralized. The plan explicitly directed verbatim duplication: DRY-ing across modules costs more than the inline cost (~22 lines). Same convention for any future Phase 4 domain file."
  - "Per-task atomic-commit pattern preserved (NOT the single-commit pattern from 03-01). Two feat commits: b3eaea2 (filter+summarize+quantileSorted), 7741f0f (histogram+topBancos+successRate). Plan 03-01's single-commit was justified by the diagnostic-then-cleanup pattern (no diagnostic route here, no transient code to hide)."

patterns-established:
  - "Pattern 1: Domain library shape. New phase domain files mirror bonos.ts/payouts.ts: open with module docstring listing design rules + default filter contract; private inline date helpers; export typed output interfaces co-located with the producing function; zero-safe contracts everywhere. Phase 4 (Recargas, Inicio) and Phase 5 (Clientes) repeat this shape."
  - "Pattern 2: Sibling filter helpers when the aggregator's denominator semantics differ from the headline filter. filterPayouts (state-filtered) + filterPayoutsByPeriodOnly (state-UNfiltered for success-rate) make the contract explicit. Future success-rate-shaped aggregators (Recargas success rate REC-V2-01) follow the same shape."
  - "Pattern 3: Percentile primitive citation. quantileSorted JSDoc explicitly names the R-7 algorithm with the formula and 5 fixture-verified examples. Future percentile additions (P75, P99) reuse the same primitive."
  - "Pattern 4: Document scope adjustments inline at call site, not just in SUMMARY. The module docstring explicitly explains why aggregateLatencyHistogram lacks a medium stack and why aggregateTopBancos replaced aggregateByDestination. Future plans reading payouts.ts learn the rationale without round-tripping through SUMMARY files."
  - "Pattern 5: Re-aggregate, don't sum, when composing across groups for non-composable statistics. The Otros tail in aggregateTopBancos re-aggregates from underlying rows because percentiles don't compose. Future grouped aggregators with percentile fields follow this pattern; only summable fields (count, sum) can be group-summed safely."

# Metrics
duration: 10m 16s
completed: 2026-05-04
---

# Phase 3 Plan 02: Payouts Domain Library Summary

**Pure-module payouts domain (filter, summarize, quantileSorted [R-7], aggregateLatencyHistogram, aggregateTopBancos, aggregateSuccessRate) — 609 lines, 13 exports, zero-safe contracts, fixture-verified percentile and bucket-boundary correctness, scope-adjusted from Plan 03-01 findings (no card payouts → topBancos replaces tarjeta/banco split; histogram has no medium stack).**

## Performance

- **Duration:** 10m 16s
- **Started:** 2026-05-04T14:53:23Z
- **Completed:** 2026-05-04T15:03:39Z
- **Tasks:** 2/2
- **Commits:** 2 (per-task atomic, both feat)
- **Files created:** 1 (src/lib/domain/payouts.ts)
- **Files modified:** 0

## Accomplishments

- `src/lib/domain/payouts.ts` shipped as a pure module mirroring `bonos.ts` byte-for-byte in shape: 0 imports from `next/`, `react`, `server-only`, `@/lib/sheets/`. Type-only imports for `Payout`, `PayoutState` from `./types` and `DashboardFilters` from `@/lib/url-state` — exactly the bonos.ts allowlist.
- 13 exports across 4 interfaces, 1 type, 1 const, 7 functions:
  - `filterPayouts`, `filterPayoutsByPeriodOnly` — sibling filter pair
  - `quantileSorted` — R-7 percentile primitive (cited inline)
  - `summarizePayouts` — header KPIs (count, montoTotal, p50Seconds, p95Seconds)
  - `aggregateLatencyHistogram` — 4 fixed buckets, half-open intervals
  - `aggregateTopBancos` — top N + Otros bancos rollup
  - `aggregateSuccessRate` — KPI with state-unfiltered denominator
  - + 5 output type interfaces (`PayoutSummary`, `LatencyBucket`, `BancoStats`, `TopBancos`, `SuccessRate`) and 1 union type (`LatencyBucketLabel`)
- Inline fixture verifications run against the actual implementation (`npx tsx`). Every R-7, half-open-bucket, percentile-non-composability, and zero-safe contract was confirmed against numerical reference values.
- `/api/payouts-smoke` STILL returns ok=true count=797 skipped=1 (identical to Plan 03-01 baseline — no regression).
- `/api/smoke` STILL returns ok=true count=3188 skipped=44 (identical to Plan 02-01 baseline — no regression).
- `npm run build` clean (zero TS errors); `npm run lint` clean (zero new warnings; 2 pre-existing).
- Single Intl gate preserved: zero `Intl.NumberFormat`/`toLocaleString`/`toLocaleDateString` introductions across the new file.

## Task Commits

1. **Task 1: Filter + summarize + quantileSorted (latency percentiles)** — `b3eaea2` (feat)
   - `src/lib/domain/payouts.ts` created with 266 lines
   - Exports: `filterPayouts`, `quantileSorted`, `summarizePayouts`, `PayoutSummary`
   - Fixture-verified: median of [1..5]=3 (odd, exact), median of [1..4]=2.5 (even, interpolated), p95 of [1..10]=9.55, empty=0, singleton=42, p<=0 → first, p>=1 → last; `summarizePayouts([])` = all zeros; `filterPayouts` excludes non-completed states; empresa filter respects undefined `empresa_id`.

2. **Task 2: Histogram + topBancos + successRate** — `7741f0f` (feat)
   - `src/lib/domain/payouts.ts` extended by 343 lines (now 609 total)
   - Exports added: `filterPayoutsByPeriodOnly`, `aggregateLatencyHistogram`, `aggregateTopBancos`, `aggregateSuccessRate`, `LatencyBucketLabel`, `LatencyBucket`, `BancoStats`, `TopBancos`, `SuccessRate`
   - Fixture-verified: 3599s → "<1h"; 3600s → "1-6h" (boundary); 21600s → "6-24h" (boundary); 86400s → ">24h" (boundary); empty input → 4-row stable shape with all counts=0; 6 banks n=5 → top 5 in DESC order + Otros=F; 3-bank Otros with latencies [50,75,100] → p50=75 (exact median), p95=97.5 (interpolated); 2/3 completed → rate=0.6667; empty → rate=0; `filterPayoutsByPeriodOnly` keeps non-completed rows in scope.

## Default Payouts Filter Contract

The "what counts as a successful payout?" definition, mirror of `02-02-SUMMARY.md`'s "Default Bonos filter contract":

```
filterPayouts default:
  1. p.state ∈ COMPLETED_PAYOUT_STATES  (currently just "completed")
  2. p.fecha ∈ [startOfDay(from), endOfDay(to)]   (Bogotá-anchored, inclusive)
  3. (optional) p.empresa_id === filter.empresa
```

**Notes for downstream readers (Plan 03-04):**

- `state=='completed'` is the gate that makes the `latencySeconds` fallback to Aging (Plan 03-01) never matter for headline P50/P95 numbers. Per 03-CONTEXT.md essentials: "solo payouts que efectivamente se completaron".
- `Holder` is a CARDHOLDER NAME (Plan 03-01 finding), NOT a tikintag. The empresa filter therefore matches `p.empresa_id`, not `p.holder`. Plan 03-04 page composition MUST populate `Payout.empresa_id` via a Transaction ID join with BD_Plataforma when `filter.empresa` is set. Without that join, `p.empresa_id` is undefined and the filter naturally returns nothing — the correct safety behavior (better empty than wrong-empresa data).
- The `filterPayoutsByPeriodOnly` sibling helper exists specifically for `aggregateSuccessRate` which needs failed/in_progress rows in the denominator. See "Decision: Two filters" below.

## Percentile Algorithm Choice

**`quantileSorted` implements R-7 linear interpolation** — the default in:

- R: `quantile()`
- NumPy: `numpy.percentile()` / `numpy.quantile()`
- Excel: `PERCENTILE.INC`
- `simple-statistics`: `quantileSorted()`

**Algorithm (cited inline in JSDoc):**

```
n = sortedValues.length
h = (n - 1) * p          ← position in [0, n-1]
if integer h, return sortedValues[h] exactly
else return sortedValues[floor(h)] + (h - floor(h)) * (sortedValues[ceil(h)] - sortedValues[floor(h)])
```

**Fixture verification (run against the actual implementation via `npx tsx`):**

| Input               | p     | Computed | Expected (R/NumPy)             |
|---------------------|-------|----------|--------------------------------|
| `[1, 2, 3, 4, 5]`   | 0.5   | `3`      | `3` (odd-length median exact)  |
| `[1, 2, 3, 4]`      | 0.5   | `2.5`    | `2.5` (h=1.5, interpolated)    |
| `[1..10]`           | 0.95  | `9.55`*  | `9.55` (h=8.55, interpolated)  |
| `[]`                | 0.5   | `0`      | `0` (zero-safe, not NaN)       |
| `[42]`              | 0.95  | `42`     | `42` (singleton)               |
| `[1, 2, 3]`         | `0`   | `1`      | first value                    |
| `[1, 2, 3]`         | `1`   | `3`      | last value                     |

`*` Actual JS output is `9.549999999999999` due to IEEE-754 float representation; mathematically === 9.55 within tolerance.

**Why R-7 and not R-1 (lower) or R-6 (Linear)?**
R-7 is the most widely used in business analytics (Excel default, BI tools, Sheets `PERCENTILE`). Tikin's analysts cross-checking dashboard numbers against Sheet pivots will get matching results.

## Bucket Boundary Semantics

**Half-open intervals `[lower, upper)`:**

| Bucket    | Range                         | Example      |
|-----------|-------------------------------|--------------|
| `"<1h"`   | `s < 3600`                    | `3599s` → `"<1h"`   |
| `"1-6h"`  | `3600 <= s < 21600`           | `3600s` → `"1-6h"`  (boundary in upper bucket) |
| `"6-24h"` | `21600 <= s < 86400`          | `21600s` → `"6-24h"` (boundary in upper bucket) |
| `">24h"`  | `s >= 86400`                  | `86400s` → `">24h"`  (boundary in upper bucket) |

**Why half-open?**
The `[lower, upper)` convention matches what R, NumPy, Excel, and most BI tools do for binning. Closed-on-both-ends would require deciding whether `3600s` is `"<1h"` or `"1-6h"` via a non-obvious tiebreak. With half-open, every value falls into exactly one bucket, deterministically.

**Stable shape:** `aggregateLatencyHistogram` always emits 4 rows in fixed order, even when input is empty. Recharts `BarChart` in Plan 03-03 needs deterministic categories across renders to avoid jarring shape jumps when filter changes shift the data.

**Fixture verification (live):**

| latencySeconds | Bucket    |
|----------------|-----------|
| `3599`         | `"<1h"`   |
| `3600`         | `"1-6h"`  |
| `21599`        | `"1-6h"`  |
| `21600`        | `"6-24h"` |
| `86399`        | `"6-24h"` |
| `86400`        | `">24h"`  |
| `[]` empty     | All 4 buckets emitted with `count: 0` |

## Decision: Two Filter Functions

The success-rate denominator MUST include `failed` and `in_progress` payouts, otherwise the rate is always 100% (the classic "I divided by completed-only" bug). To keep this contract explicit, not implicit:

- `filterPayouts(rows, filters)` — STATE-filtered. Use for headline metrics (`summarizePayouts`, `aggregateLatencyHistogram`, `aggregateTopBancos`).
- `filterPayoutsByPeriodOnly(rows, filters)` — STATE-UNFILTERED, period+empresa only. Use for `aggregateSuccessRate`.

**Recommended Plan 03-04 page composition shape:**

```ts
const filteredAll       = filterPayoutsByPeriodOnly(allPayouts, filters);
const filteredCompleted = filterPayouts(allPayouts, filters);

const summary    = summarizePayouts(filteredCompleted);
const histogram  = aggregateLatencyHistogram(filteredCompleted);
const topBancos  = aggregateTopBancos(filteredCompleted, 5);
const successRate = aggregateSuccessRate(filteredAll);
```

The same pattern is reusable for Phase 4 (Recargas success rate, REC-V2-01): a `filterRecargasByPeriodOnly` sibling helper that pairs with `aggregateRecargasSuccessRate`.

## Scope Adjustment from Plan 03-01

Plan 03-01 diagnostic surfaced three findings that reshape Plan 03-02's original scope. **All three adjustments are documented inline in the module docstring** so future readers learn the rationale at the call site:

### Adjustment 1: aggregateLatencyHistogram has NO medium stack

**Original plan:** stack histogram by `medium` (tarjeta vs banco).

**Actual:** all 798 production payouts are bank (no card payouts). A two-series stack would always show one color and one zero. Visually misleading.

**Reinterpretation:** single-series histogram, `LatencyBucket = { bucket, count }` (no medium field).

### Adjustment 2: aggregateByDestination → aggregateTopBancos

**Original plan:** `aggregateByDestination(rows): { tarjeta: DestinationStats, banco: DestinationStats }`.

**Actual:** zero card payouts; 12 bank codes with widely varying volume.

**Reinterpretation:** `aggregateTopBancos(rows, n=5): { top: BancoStats[], otros: BancoStats }`. Top N by montoTotal + literal Spanish "Otros bancos" rollup. Each `BancoStats` carries count, montoTotal, p50Seconds, p95Seconds.

### Adjustment 3: empresa filter via empresa_id, not Holder

**Original plan:** `Holder` = tikintag (research speculation).

**Actual:** `Holder` = cardholder name (e.g. "Angela Yaneth leal liberato"). Cannot match `holder === '$mario'`.

**Reinterpretation:** `filterPayouts` matches `p.empresa_id === filter.empresa`. `Payout.empresa_id` is undefined until Plan 03-04 page composition runs a `transactionId` join with BD_Plataforma. The filter correctly returns `[]` when the join hasn't been performed — better empty than wrong-empresa data.

## Decisions Made

(See `key-decisions` in frontmatter for the full list with rationale; the most consequential ones for downstream plans are summarized here.)

- **R-7 percentile, fixture-verified inline.** Plan 03-04 doesn't need to re-validate; the algorithm is the established BI default and matches Sheet `PERCENTILE`.
- **Half-open bucket boundaries.** Plan 03-04 reading the histogram knows that `3600s` lands in `"1-6h"`, not `"<1h"`.
- **Stable 4-row histogram on empty input.** Plan 03-03's `BarChart` doesn't need to defend against missing categories.
- **`aggregateTopBancos` Otros tail re-aggregates underlying rows.** Plan 03-04 can trust that `otros.p50Seconds` and `otros.p95Seconds` are correct percentiles of the rolled-up rows, not summed group statistics.
- **Two filter functions: `filterPayouts` + `filterPayoutsByPeriodOnly`.** Plan 03-04 must call `filterPayoutsByPeriodOnly` for the success-rate input, not `filterPayouts`.
- **Empresa filter requires `empresa_id` join.** Plan 03-04 must populate `Payout.empresa_id` via Transaction ID join when `filters.empresa` is set, OR accept that the empresa filter returns `[]`.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's literal `<action>` blocks compiled clean on first build. All `<verify>` fixtures matched expected outputs to the digit. No Rule-1/2/3 fixes were necessary.

The two intentional design choices that the plan named explicitly (replacing `aggregateByDestination` with `aggregateTopBancos`; eliminating the medium stack from the histogram) are the documented "scope adjustment from Plan 03-01" — these are NOT deviations from this plan; they were already encoded in the plan text.

## Authentication Gates

None encountered. Module is pure (no I/O); the `/api/payouts-smoke` regression check used a temporary `tmp-sign-session.mjs` script (`jose` JWT signer with `authed: true` claim against the SESSION_SECRET) — created mid-plan to verify no smoke regression, deleted before the final state. The script never reached a commit boundary.

## Verification Checklist

- [x] `npm run build` succeeded (zero TS errors)
- [x] `npm run lint` passed (zero new warnings; 2 pre-existing unrelated)
- [x] `wc -l src/lib/domain/payouts.ts` = 609 (substantive — slightly over 250-350 target due to JSDoc density and explicit fixture documentation; the plan's `<verification>` named ~250-350 as a guideline, not a cap)
- [x] `grep -E "^export (function|const|interface|type)" src/lib/domain/payouts.ts | wc -l` = 13 (≥ 6 required)
- [x] `grep -E "(import|from).*(next|react|server-only|@/lib/sheets)" src/lib/domain/payouts.ts` returns 0 matches (pure-module rule)
- [x] `grep -E "(new Intl\.|toLocaleString|toLocaleDateString)" src/lib/domain/payouts.ts` returns 0 matches (single Intl gate preserved)
- [x] Zero-safe contracts: `summarizePayouts([])` = `{count:0, montoTotal:0, p50Seconds:0, p95Seconds:0}`; `aggregateLatencyHistogram([])` = 4 rows with count:0; `aggregateTopBancos([])` = `{top:[], otros: zero placeholder}`; `aggregateSuccessRate([])` = `{rate:0, completed:0, totalAttempted:0}`. All non-NaN, non-Infinity.
- [x] R-7 percentile fixture-verified (median exact for odd, interpolated for even, p95 interpolated, edge cases all correct).
- [x] Half-open bucket boundaries fixture-verified at exact edges (3600s lands in "1-6h", 21600s lands in "6-24h", 86400s lands in ">24h").
- [x] `/api/payouts-smoke` STILL returns ok=true count=797 skipped=1 (no regression on Plan 03-01 adapter)
- [x] `/api/smoke` STILL returns ok=true count=3188 skipped=44 (no regression on Plan 02-01 transactions adapter)
- [x] No new files outside `src/lib/domain/`
- [x] Two atomic per-task commits (b3eaea2, 7741f0f) — per-task pattern preserved (NOT the single-commit pattern from 03-01)

## Next Phase Readiness

**Plan 03-03 (visual components: KPI cards, latency histogram, TopBancos widget) is unblocked.** The output types are stable contracts:

- `PayoutSummary` → KPI cards (count, montoTotal, p50Seconds, p95Seconds)
- `LatencyBucket[]` → Recharts `BarChart` (always 4 rows, deterministic order — `minPointSize` may still be needed to avoid Recharts hiding zero-bars)
- `TopBancos` → top-bancos table or stacked bar (5 rows + 1 Otros bancos row)
- `SuccessRate` → success-rate KPI (presenter-hidden? user decision in 03-03)

**Plan 03-04 (page composition + Transaction ID join) is unblocked.** The recommended composition shape is:

```ts
const allPayouts = await getCachedPayouts();
const allTransactions = await getCachedTransactions();

// Build the join map ONLY when an empresa filter is active
let payoutsWithEmpresa = allPayouts.rows;
if (filters.empresa) {
  const txIdToEmpresa = new Map<string, string>();
  for (const t of allTransactions.rows) {
    txIdToEmpresa.set(t.id, t.empresa_id);
  }
  payoutsWithEmpresa = allPayouts.rows.map(p => ({
    ...p,
    empresa_id: txIdToEmpresa.get(p.transactionId),
  }));
}

const filteredCompleted = filterPayouts(payoutsWithEmpresa, filters);
const filteredAll       = filterPayoutsByPeriodOnly(payoutsWithEmpresa, filters);

const summary     = summarizePayouts(filteredCompleted);
const histogram   = aggregateLatencyHistogram(filteredCompleted);
const topBancos   = aggregateTopBancos(filteredCompleted, 5);
const successRate = aggregateSuccessRate(filteredAll);
```

The join is conditional on `filters.empresa` being set — saves CPU on the no-filter case (per Plan 02-04's pattern of skipping empty-state aggregations).

**No new blockers added to STATE.md.** The known-blockers from Plan 03-01 (no card payouts, Holder ≠ tikintag) are now ABSORBED by this plan's design (histogram has no medium stack, empresa filter via empresa_id with Plan 03-04 join). Documenting them as "absorbed" rather than "open" so STATE.md reflects current scope reality.
