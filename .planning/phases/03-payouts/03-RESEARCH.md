# Phase 3: Payouts — Research

**Researched:** 2026-04-30
**Domain:** Latency analytics + Sheet adapter composition (BD_Plataforma + BD_Payouts)
**Confidence:** HIGH on stack/architecture (carried over from Phase 1+2); MEDIUM on percentile-algorithm and Recharts histogram patterns; LOW on three live-data unknowns marked explicitly below.

## Summary

Phase 3 is a near-mechanical clone of Phase 2's Server-Component-page-composition pipeline (parseFilters → cached fetch → pure aggregations → typed leaves), with three new wrinkles: (1) a **second** Sheet tab to read (`BD_Payouts`) — coalesced with `BD_Plataforma` in a single `spreadsheets.values.batchGet` call (verified to count as ONE quota unit), (2) **percentile math** (P50, P95) that should live in the pure aggregation module using the **R-7 linear-interpolation algorithm** (the industry default in R/NumPy/Excel/`simple-statistics`) — a 7-line hand-rolled `quantileSorted` is correct and avoids a new dependency, and (3) a **non-uniform-bucket histogram** for latency (`<1h / 1-6h / 6-24h / >24h`) split by `Destination Medium` — Recharts `BarChart` with a stacked-bar shape `{ bucket, tarjeta, banco }`.

**Three unknowns require live data before the schema can be written** (resolve via a temporary `/api/diagnose-payouts` route on Plan 03-01, deleted before commit, mirroring Phase 2-01's diagnostic-then-cleanup pattern):

1. **`Aging` vs `Total Time` units** — seconds? minutes? hours? Are they redundant? Which is canonical "time-to-payout"?
2. **`Destination Medium` distinct values** — exact strings to map onto `'tarjeta' | 'cuenta_bancaria' | 'OTRO_MEDIUM'`.
3. **`Holder` ↔ `tikintag` correspondence** — same identifier domain, or do we need to enrich via a `Transaction ID` join with BD_Plataforma to get `empresa_id` per payout row?

**Primary recommendation:** Adapter eagerly coerces `Aging` (or `Total Time`, whichever is canonical) to **seconds (number)** in the Zod transform; percentile + bucketization live as pure functions in `src/lib/domain/payouts.ts`; one `batchGet` call coalesces both tabs into a single AdapterResult-pair; keep Phase 1 stack — no new runtime dependencies.

## Standard Stack

The libraries/tools for Phase 3. Stack is locked from Phase 1 + Phase 2 — **no new runtime deps**.

### Core (already installed, no install needed)

| Library | Version | Purpose | Why Standard for Phase 3 |
|---------|---------|---------|--------------------------|
| `googleapis` | ^171.4.0 | Sheets API client | Already used by `transactions.ts`; `spreadsheets.values.batchGet` is the canonical multi-range read |
| `google-auth-library` | ^10.6.2 | JWT auth for Sheets | Already used; lazy singleton in `src/lib/sheets/client.ts` |
| `zod` | ^4.3.6 | Per-row schema validation | Same per-row safeParse + skip-and-count semantics as `TransactionRowSchema` |
| `recharts` | ^2.15.4 | Histogram (BarChart) + line chart for trend | Already used by `BonosChart.tsx`; `BarChart` documented for stacked + grouped |
| `next` / `react` | 16.2.4 / 19.2.4 | Server Component composition + `cache()` | Same `cache(fn)` pattern as `getCachedTransactions` |
| `date-fns` / `date-fns-tz` | ^4.1.0 / ^3.2.0 | Bogotá-anchored timestamps | Already used by `format.ts` (do not import directly elsewhere) |
| `shadcn/ui` Card | already installed | KPI + empty-state shells | Already used by Bonos leaves — same shells |

### Supporting (already installed)

| Library | Version | Purpose | When to Use in Phase 3 |
|---------|---------|---------|-------------------------|
| `clsx` / `tailwind-merge` | — | Conditional class names | For the histogram color tokens `tarjeta` vs `banco` |
| `lucide-react` | ^1.11.0 | Icons | Optional — failure-breakdown row indicator if surfaced |

### Alternatives Considered (and rejected)

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| Hand-rolled `quantileSorted` (7 lines) | `simple-statistics` npm package | +1 dep, ~50 KB unminified for one function we'd use; but R-7 algorithm verified | **Reject.** Hand-roll. Document the algorithm choice in code comment. |
| `batchGet` with two ranges | Two sequential `.get` calls | Two quota units instead of one; doubles latency for the cold render | **Reject.** Use `batchGet` (verified ONE quota unit per [Sheets API docs](https://developers.google.com/workspace/sheets/api/limits)). |
| Native `<table>` for failure breakdown | shadcn Card list | Tables are heavyweight for 5-10 rows | **Decide in Plan 03-04** — match Bonos `SalesTable.tsx` shape if list grows; otherwise list-of-rows in a Card. |
| Recharts `Histogram` component | `BarChart` with pre-bucketed data | Recharts has NO native histogram component (verified — [issue #1580](https://github.com/recharts/recharts/issues/1580) feature request still open) | **Use BarChart with pre-bucketized data array.** |

**No `npm install` step.** Phase 3 ships purely with the Phase 1+2 stack.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/(protected)/payouts/
│   └── page.tsx                  # Server Component composition (mirror /bonos/page.tsx)
├── components/payouts/           # Visual leaves (Server, except chart)
│   ├── PayoutsKPICards.tsx       # Server — count, $ volumen, P50, P95 (4 cards or 2x2)
│   ├── LatencyHistogram.tsx      # Client — Recharts BarChart, stacked tarjeta/banco
│   ├── DestinationSplit.tsx      # Server — tarjeta vs banco metrics side-by-side
│   ├── FailureBreakdown.tsx      # Server — failure_reason × count, presenter-hidden
│   └── PayoutsTable.tsx          # Server — per-empresa or per-day breakdown table
├── lib/sheets/
│   ├── payouts.ts                # NEW — getPayouts() + getCachedPayouts adapter (DEDICATED batchGet)
│   └── transactions.ts           # UNCHANGED — Phase 2 carry-over
└── lib/domain/
    ├── payouts.ts                # NEW — pure: filterPayouts, summarizePayouts, percentile,
    │                             #            aggregateLatencyHistogram, aggregateFailures, etc.
    ├── schemas.ts                # APPEND — PayoutRowSchema + ExpectedPayoutHeaders
    ├── types.ts                  # APPEND — Payout interface, PayoutState, DestinationMedium, FailureReason enums
    └── bonos.ts                  # UNCHANGED
```

**Mirror Phase 2 conventions exactly:**
- `payouts.ts` adapter follows `transactions.ts` shape — same `AdapterResult<Payout>` return, same `withRetry`, same `headerIndexMap` + `getCellByHeader` + `isFormulaError` + `isEmptyRow` use, same boot-time header check throwing on schema mismatch.
- `domain/payouts.ts` follows `domain/bonos.ts` rules: NO imports from `next/`, `react`, `server-only`, or `lib/sheets/`. Imports limited to `./types`, `@/lib/url-state` (type-only), and `@/lib/format` for date helpers like `toBogotaISODate`.
- `payouts/page.tsx` follows `bonos/page.tsx` skeleton: `await searchParams` → `parseFilters` → try/catch around `getCachedPayouts()` → empty-state guard → aggregations → render leaves. Same `export const dynamic = 'force-dynamic'`.
- Chart is the ONE Client Component (`'use client'`) — same as `BonosChart.tsx` — because Recharts `ResponsiveContainer` needs the DOM.

### Pattern 1: Coalesced batchGet for two tabs in same Sheet
**What:** A single API call retrieves both `BD_Plataforma!A1:Z` and `BD_Payouts!A1:Z`. Returns `valueRanges[]` in request order.
**When to use:** ONLY when both tabs are needed in the same render. The Payouts tab needs both: BD_Payouts as primary, BD_Plataforma to enrich `empresa_id` if `Holder ≠ tikintag` (decision pending live diagnostic).
**Why:** Verified by [Sheets API docs](https://developers.google.com/workspace/sheets/api/limits): "Each batch request, including any subrequest, is counted as one API request toward your usage limit." Free 50% of our 60-req/min/user quota that we'd otherwise spend.

**Decision tree for Plan 03-01:**
- IF `Holder` IS `tikintag` (live-verify) → BD_Payouts standalone is enough; one `.get()` for `BD_Payouts!A1:Z` is fine; no batchGet needed.
- IF `Holder` IS NOT `tikintag` AND we need empresa filter to work → use `batchGet` with both ranges; build a `Map<TransactionId, empresa_id>` from BD_Plataforma; enrich each Payout row at adapter time.

**Recommendation:** Use `batchGet` regardless. It costs no more quota than `.get` and futureproofs the Payouts tab against join needs (we'll likely need transaction-level fields later — `reference`, `tikintag`, etc. — for Phase 4 Inicio).

### Pattern 2: Percentile in pure aggregation, not in adapter
**What:** Compute P50 and P95 via `quantileSorted([sortedLatencies], 0.5 | 0.95)` AFTER `filterPayouts` runs. Adapter eagerly coerces the latency cell to `number` (seconds) but never aggregates.
**When to use:** ALWAYS. With ~999 BD_Payouts rows the cost difference between adapter-eager and aggregation-pure percentile is microseconds. **Pure module wins decisively** because:
1. Filters change the universe (date range, empresa, Destination Medium) and the percentile must be over the FILTERED set, not the full Sheet.
2. Pure functions are unit-testable and reusable from Inicio (Phase 4) which composes multiple domain libs.
3. The `Transaction[]`/`Payout[]` → number pipeline matches `summarizeBonos`'s zero-safe contract.

**Anti-pattern:** Pre-computing percentile in adapter and shipping it down via `AdapterResult<{ rows, p50, p95 }>` is wrong — it'd be invalidated by the first filter change.

### Pattern 3: Histogram as pre-bucketed data + stacked BarChart
**What:** Pure function `aggregateLatencyHistogram(payouts) → [{ bucket: '<1h', tarjeta: 12, banco: 18 }, { bucket: '1-6h', tarjeta: 30, banco: 22 }, ...]` (4 fixed rows, always emitted, even if a bucket is empty).
**Recharts shape:** `<BarChart data={hist}><Bar dataKey="tarjeta" stackId="medium" /><Bar dataKey="banco" stackId="medium" /></BarChart>`. Same `stackId` collapses both Bars onto each x-axis category. ([Recharts docs confirmed](https://recharts.org/en-US/api/Bar/))
**Empty-bucket handling:** Always emit all 4 bucket rows with zero values when no data — Recharts will render zero-height bars cleanly. Avoids the "empty bar" issue documented in [recharts/recharts#2666](https://github.com/recharts/recharts/issues/2666).

### Anti-Patterns to Avoid

- **Don't compute percentile after a partial filter pass.** The full filter contract (tipo + state + from/to + empresa + destination) must apply before `quantileSorted`. Otherwise P95 is over the wrong universe.
- **Don't sort in-place.** `quantileSorted([...latencies].sort((a,b)=>a-b), 0.95)` — sort a copy. The caller usually doesn't expect side effects, and `aggregateLatencyHistogram` reads the same array.
- **Don't compute percentile on an empty array** without a zero-safe guard. Return `0` (matching `summarizeBonos`'s zero-safe convention) or `null` if you want the KPI card to render `—` (use `formatInteger(null) === '—'` from `format.ts`).
- **Don't render the histogram with `data=[]`.** Always emit 4 rows. See Pattern 3.
- **Don't read BD_Payouts twice in the same render.** `getCachedPayouts = cache(getPayouts)` — same React 19 `cache()` rule that `getCachedTransactions` uses.
- **Don't hardcode bucket colors.** Use Tailwind/CSS-variables tokens like `fill-[var(--chart-1)]` or `className="fill-primary"` so theme switches just work — same convention as `BonosChart.tsx`'s `stroke="currentColor"`.
- **Don't rely on `Date.now()` in domain code.** Latency comes from `Aging`/`Total Time` columns; do NOT compute `Date.now() - state_timestamp` (silent bug if Vercel Function clock drifts vs Bogotá).

## Don't Hand-Roll

Problems that look simple but have existing solutions in this codebase:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sheets row → typed object | Positional index access | `headerIndexMap` + `getCellByHeader` from `_utils.ts` | Pitfall 3 (column reorder) — already solved |
| 429 retry | New retry logic | `withRetry` from `_utils.ts` | Already 250ms exponential backoff + cap, jitter |
| Empty/formula-error rows | New if-else | `isEmptyRow` + `isFormulaError` from `_utils.ts` | Already covers `#REF!`, `#N/A`, `#DIV/0!`, `#NAME?`, `#NUM!`, `#VALUE!`, `#ERROR!`, `#NULL!` |
| COP / integer / percent / date formatting | New `Intl.NumberFormat` instance | `formatCOP`, `formatInteger`, `formatPercent`, `formatBogotaDate` from `format.ts` | Pitfall 9 (single Intl gate) — locked-in |
| URL filter parsing | New `URLSearchParams` reader | `parseFilters(searchParams)` from `url-state.ts` | Already returns `DashboardFilters { from, to, empresa, presenter }` |
| Same-request fetch dedup | New memo cache | `cache()` from React 19 | Already wraps `getTransactions` as `getCachedTransactions` — same pattern for `getCachedPayouts` |
| Empresa registry / dropdown | New extraction logic | `getEmpresaRegistry` from `domain/empresas.ts` (already feeds `DashboardHeader`) | Already deduplicates + sorts with `Intl.Collator('es')` |
| Bogotá date math (start/end of day, ISO dates) | New `new Date()` parsing | `toBogotaISODate` from `format.ts`; `startOfDayBogotaTimestamp`/`endOfDayBogotaTimestamp` pattern from `bonos.ts` (port if needed) | Pitfall 10 (timezone drift) — already solved |
| Per-row Zod safeParse with skip-and-count | New per-row try/catch | Mirror `getTransactions` pipeline in `payouts.ts` | Already established pattern, returns `AdapterResult<T>` |
| Presenter-mode hide/show | New `if (filters.presenter)` branches in JSX | `data-presenter-hide` HTML attribute + Phase 1 CSS rule | Declarative, zero React state, already shipped |
| **Percentile calculation** | A `simple-statistics` npm install | **A 7-line `quantileSorted` helper in `domain/payouts.ts` using R-7 linear interpolation** | Verified algorithm; 7 lines vs +50 KB dep; one function we'd consume |
| Histogram bucketization | A `d3-array` `bin` import | A 5-line for-loop with explicit bucket-boundary `if` checks | Buckets are non-uniform (`<1h`, `1-6h`, `6-24h`, `>24h`); `d3.bin` is uniform-width by default; explicit if-cascade is clearer |

**Key insight:** The Phase 1+2 toolbox already covers everything except percentile + histogram bucketization, and both are 5-10 lines of pure TS. Resist the urge to npm-install.

## Common Pitfalls

### Pitfall 1: `Aging` / `Total Time` units unknown
**What goes wrong:** Schema coerces `Aging` to `number` and feeds it to `quantileSorted`, but the column is in seconds (or minutes, or hours) — and the histogram buckets are in HOURS. P50 = "1500" displayed as "1500h" when actually it's 25 minutes (1500 seconds).
**Why it happens:** Sheets `UNFORMATTED_VALUE` returns the raw cell value; if the user formatted the cell as "duration" we get the underlying serial number; if formatted as text we get a string like "2h 15m"; if as integer we get raw seconds. **Phase 1 captured the column EXISTS but never read its values.**
**How to avoid:** Plan 03-01 first task = **temporary `/api/diagnose-payouts` route** that samples 20 rows and prints `Aging`, `Total Time`, `State Timestamp`, `Date` side-by-side with `typeof` for each. Only after seeing the actual shape do we write the Zod schema. This is the SAME diagnostic-then-cleanup pattern Plan 02-01 used (and verified — see `02-01-SUMMARY.md` "Diagnostic scaffolding (`_diagnose.ts`, `/api/diagnose`) created and deleted within the same plan").
**Warning signs:** `quantileSorted` returns a value with three orders of magnitude larger than expected; histogram buckets all empty or all in one bucket.

### Pitfall 2: `Destination Medium` enum drift
**What goes wrong:** Hardcoded check `medium === 'card'` while the Sheet has `'TARJETA'` (Spanish, uppercase). Histogram tarjeta column always zero; banco gets all rows.
**Why it happens:** `BD_Payouts` uses Title Case English headers but the values may be Spanish, lowercase, mixed. Phase 1 confirmed the COLUMN exists — it did not capture VALUES.
**How to avoid:** Same diagnostic route surfaces distinct values. Then use the Phase 2 `OTRO_*` fallback pattern: `DestinationMedium = 'tarjeta' | 'cuenta_bancaria' | 'OTRO_MEDIUM'`. Schema transform normalizes (lowercase, trim, switch-on-known); unknown values fall to `OTRO_MEDIUM` and are surfaced in the dashboard rather than silently dropped (consistent with `UKNOWN` typo handling in `transaction_type`).
**Warning signs:** Histogram always one-sided; `aggregateFailures` shows `OTRO_MEDIUM` rows; skip count high.

### Pitfall 3: `Holder` ≠ `tikintag` makes empresa filter silently broken
**What goes wrong:** User selects `?empresa=$mario` → `DashboardHeader` populates correctly from BD_Plataforma (via `getEmpresaRegistry(transactions)`) → `/payouts` page filters BD_Payouts by `payout.holder === '$mario'` → no rows match because `Holder` is actually a UUID or display name, not the tikintag handle.
**Why it happens:** Phase 1 left this ambiguous (see `01-04-SUMMARY.md` "Open ambiguities for Phase 2 to resolve"). Phase 2 only used BD_Plataforma, where empresa = tikintag.
**How to avoid:** Diagnostic route ALSO samples 5 distinct `Holder` values and prints them next to a couple of known `tikintag` values from BD_Plataforma. Decision tree:
- **If Holder == tikintag** (e.g., both show `$mario`): standalone — `payouts.ts` adapter coerces `Holder → empresa_id` directly. No join.
- **If Holder is a different value** (e.g., a UUID, display name, or different handle): use `batchGet` to fetch BOTH tabs; build `Map<transaction_id, empresa_id>` from BD_Plataforma; enrich each Payout in the adapter transform step. Single point: `empresa_id: byTxId.get(parsed.transaction_id) ?? 'unknown'`.
**Warning signs:** Default `/payouts` works; `/payouts?empresa=$mario` returns empty; `/payouts?empresa=<uuid>` works.

### Pitfall 4: Percentile on filtered universe vs full universe
**What goes wrong:** "P95 latency" computed over the full BD_Payouts dataset and DISPLAYED on a date-range-filtered page. Customer demo: `?from=2026-04-01&to=2026-04-30&empresa=$mario` — the page shows P95 = 7h2m (lifetime), but the customer's actual April latency is 3h. They lose trust.
**Why it happens:** Adapter-eager percentile (precomputed in `getPayouts()`) shipped through `AdapterResult<{ rows, p50, p95 }>` without recomputation after filter.
**How to avoid:** Pattern 2 above. Percentile is in `domain/payouts.ts`, computed from `filterPayouts(payouts, filters)` output. Same shape as `summarizeBonos(filterBonos(...))`.
**Warning signs:** P95 KPI card is identical regardless of filters; filter changes don't reshape the histogram.

### Pitfall 5: Empty bucket renders as "no bar" when 0
**What goes wrong:** `<1h` bucket has 0 payouts; Recharts renders no bar at all; user thinks the bucket doesn't exist or the axis is broken.
**Why it happens:** Recharts default behavior — see [recharts#2666](https://github.com/recharts/recharts/issues/2666). Zero-value bars use `minPointSize=0` by default.
**How to avoid:** ALWAYS emit all 4 bucket rows with explicit zero values from `aggregateLatencyHistogram`. Set `<Bar minPointSize={2}>` so even a literal 0 shows a 2px sliver to confirm the category exists.
**Warning signs:** Histogram has 3 visible bars instead of 4 in some filter combos.

### Pitfall 6: Percentile on empty array crashes
**What goes wrong:** Filter excludes everything; `quantileSorted([], 0.95)` returns `NaN` or `undefined`; `formatInteger(NaN)` returns `—` (per `format.ts`) but `formatInteger(undefined)` does too — could mask data outage as "no data".
**Why it happens:** Hand-rolled percentile didn't guard the empty case.
**How to avoid:** Zero-safe contract — same as `summarizeBonos`. Return `0` for empty array (or have a `count` field consumers check, like `BonoSummary.count`). Document zero-safe explicitly in the JSDoc.
**Warning signs:** P50/P95 cards show literal `0` (which is unambiguous) — paired with the empty-state Card "Sin payouts en el período seleccionado", the user understands.

### Pitfall 7: BD_Payouts tab not present in source spreadsheet
**What goes wrong:** Same Sheet ID as `GOOGLE_SHEETS_TRANSACTIONS_ID` but the `BD_Payouts` tab was renamed; `batchGet` throws `Unable to parse range`.
**Why it happens:** Sheet config `BD_Payouts!A1:Z` is a string — no static check.
**How to avoid:** Same boot-time `ExpectedPayoutHeaders.filter(h => !map.has(h))` check that `transactions.ts` does. Fail loud with named missing headers. The page's existing inline error fallback Card surfaces it cleanly (Spanish copy: "No pudimos leer el Sheet").
**Warning signs:** /api/smoke (or new /api/payouts-smoke) returns the schema-mismatch error message naming missing headers.

### Pitfall 8: P50 vs P95 algorithm divergence at small N
**What goes wrong:** With only ~50 payouts in a one-empresa one-week filter, `sorted[Math.ceil(0.95*50)-1] = sorted[47]` (nearest-rank) returns a literal observed value. R-7 returns an interpolated value between `sorted[46]` and `sorted[47]`. Both are "correct" but the displayed number differs by ~5%.
**Why it happens:** No agreed-upon variant. See [Hyndman-Fan 9 definitions](https://en.wikipedia.org/wiki/Quantile).
**How to avoid:** Use **R-7 linear interpolation** (the default in R, NumPy, Excel, `simple-statistics`) — this is the most-deployed industry default and matches what an analyst pasting our data into Excel would compute. Document the choice with the source citation in the JSDoc:
> *Implements R-7 linear interpolation (the default in R `quantile()`, `numpy.percentile`, Excel `PERCENTILE.INC`, and `simple-statistics.quantileSorted`). Reference: [Hyndman-Fan 1996](https://en.wikipedia.org/wiki/Quantile#Estimating_quantiles_from_a_sample).*

### Pitfall 9: Reusing `transaction_id` as a Payout ID accidentally
**What goes wrong:** A single transaction may have multiple payout attempts (refund-and-retry). Using `transaction_id` as Payout key dedupes them away.
**Why it happens:** BD_Payouts has a `Refund Sent` column (Phase 1 captured) hinting that refunds happen. Plus `[14] ID` exists separately from `[0] Transaction ID` — they're different.
**How to avoid:** `Payout.id = ID` (column 14, the row's own primary key). `Payout.transactionId = Transaction ID` (column 0, FK to BD_Plataforma). Both are stored. The histogram counts rows by `Payout.id`; the join uses `transactionId`.
**Warning signs:** Sum of payout counts per empresa ≠ count of distinct transaction_ids in BD_Payouts.

## Code Examples

Verified patterns, ready to copy into Plan 03-01 / 03-02 / 03-03 / 03-04.

### Percentile (R-7 linear interpolation, hand-rolled)

```typescript
// src/lib/domain/payouts.ts (or new file src/lib/domain/_stats.ts if reused)
//
// Implements R-7 linear interpolation — the default in R `quantile()`,
// numpy.percentile, Excel PERCENTILE.INC, and simple-statistics.quantileSorted.
// Reference: Hyndman & Fan (1996), "Sample quantiles in statistical packages".
// https://en.wikipedia.org/wiki/Quantile#Estimating_quantiles_from_a_sample
//
// Zero-safe: empty input returns 0, never NaN/Infinity.
// Pure: does not mutate input. Caller passes a SORTED ascending array.

/**
 * @param sorted ascending-sorted numbers (e.g. latency in seconds).
 * @param p percentile as fraction in [0,1] — e.g. 0.5 for P50, 0.95 for P95.
 */
export function quantileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return sorted[0];
  if (p <= 0) return sorted[0];
  if (p >= 1) return sorted[n - 1];

  const idx = (n - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];

  const frac = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

/**
 * Compute P50 and P95 latency for a list of payouts in one pass over a sort.
 */
export function computeLatencyPercentiles(
  payouts: Payout[],
): { p50: number; p95: number; count: number } {
  if (payouts.length === 0) return { p50: 0, p95: 0, count: 0 };
  const sorted = payouts
    .map((p) => p.latencySeconds)
    .filter((s): s is number => Number.isFinite(s) && s >= 0)
    .sort((a, b) => a - b);
  return {
    p50: quantileSorted(sorted, 0.5),
    p95: quantileSorted(sorted, 0.95),
    count: sorted.length,
  };
}
```

### Latency histogram bucketization (4 fixed buckets, stacked tarjeta/banco)

```typescript
// src/lib/domain/payouts.ts
import type { Payout, DestinationMedium } from "./types";

export interface LatencyHistogramRow {
  /** Spanish label rendered in the BarChart x-axis. */
  bucket: "<1h" | "1-6h" | "6-24h" | ">24h";
  tarjeta: number;
  banco: number;
  /** Total = tarjeta + banco + (any OTRO_MEDIUM if seen). For tooltip. */
  total: number;
}

const SECONDS_IN_HOUR = 3600;

/**
 * Bucketize payouts by `latencySeconds` into 4 fixed buckets, split by
 * Destination Medium (tarjeta vs cuenta_bancaria).
 *
 * Buckets are inclusive-low / exclusive-high except the last:
 *   '<1h'   → [0,    3600)
 *   '1-6h'  → [3600, 21600)
 *   '6-24h' → [21600, 86400)
 *   '>24h'  → [86400, ∞)
 *
 * Always emits all 4 rows even when empty (Pitfall 5: zero-bar invisibility).
 *
 * Pure. Empty input → all 4 rows with zero counts (NOT NaN).
 */
export function aggregateLatencyHistogram(
  payouts: Payout[],
): LatencyHistogramRow[] {
  const rows: LatencyHistogramRow[] = [
    { bucket: "<1h",   tarjeta: 0, banco: 0, total: 0 },
    { bucket: "1-6h",  tarjeta: 0, banco: 0, total: 0 },
    { bucket: "6-24h", tarjeta: 0, banco: 0, total: 0 },
    { bucket: ">24h",  tarjeta: 0, banco: 0, total: 0 },
  ];

  for (const p of payouts) {
    const s = p.latencySeconds;
    if (!Number.isFinite(s) || s < 0) continue;

    let idx: 0 | 1 | 2 | 3;
    if      (s < 1  * SECONDS_IN_HOUR) idx = 0;
    else if (s < 6  * SECONDS_IN_HOUR) idx = 1;
    else if (s < 24 * SECONDS_IN_HOUR) idx = 2;
    else                                idx = 3;

    if (p.destinationMedium === "tarjeta") rows[idx].tarjeta += 1;
    else if (p.destinationMedium === "cuenta_bancaria") rows[idx].banco += 1;
    rows[idx].total += 1;
  }

  return rows;
}
```

### Recharts `BarChart` stacked (LatencyHistogram component)

```tsx
// src/components/payouts/LatencyHistogram.tsx
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LatencyHistogramRow } from "@/lib/domain/payouts";
import { formatInteger } from "@/lib/format";

export function LatencyHistogram({ data }: { data: LatencyHistogramRow[] }) {
  return (
    <div className="h-[320px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border opacity-50" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} className="text-muted-foreground" />
          <YAxis tickFormatter={formatInteger} tick={{ fontSize: 12 }} className="text-muted-foreground" />
          <Tooltip
            formatter={(v: number) => formatInteger(v)}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
          {/* Same stackId collapses both Bars onto each x category. */}
          {/* fill via Tailwind tokens — theme switches Just Work. */}
          <Bar dataKey="tarjeta" stackId="medium" fill="var(--chart-1)" name="Tarjeta" minPointSize={2} />
          <Bar dataKey="banco"   stackId="medium" fill="var(--chart-2)" name="Cuenta bancaria" minPointSize={2} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Adapter: `payouts.ts` skeleton with `batchGet` (mirrors `transactions.ts`)

```typescript
// src/lib/sheets/payouts.ts
import "server-only";
import { cache } from "react";

import { getSheetsClient } from "./client";
import { SPREADSHEETS } from "./config";
import {
  getCellByHeader,
  headerIndexMap,
  isEmptyRow,
  isFormulaError,
  withRetry,
} from "./_utils";
import {
  ExpectedPayoutHeaders,
  PayoutRowSchema,
  ExpectedTransactionHeaders,
  TransactionRowSchema,
} from "@/lib/domain/schemas";
import type { Payout } from "@/lib/domain/types";
import type { AdapterResult } from "./transactions"; // re-exported

/**
 * Read BD_Payouts (and BD_Plataforma if join is needed for empresa enrichment)
 * in a SINGLE batchGet call.
 *
 * Verified one-quota-unit per
 *   https://developers.google.com/workspace/sheets/api/limits
 *   "Each batch request, including any subrequest, is counted as one API
 *    request toward your usage limit."
 *
 * The response.data.valueRanges is in REQUEST ORDER:
 *   [0] BD_Payouts        (primary, always present)
 *   [1] BD_Plataforma     (only if join is needed — see Pitfall 3)
 */
export async function getPayouts(): Promise<AdapterResult<Payout>> {
  const sheets = getSheetsClient();
  const lastReadAt = new Date();

  if (!SPREADSHEETS.payouts.id) {
    throw new Error(
      "Sheets credentials missing — set GOOGLE_SHEETS_PAYOUTS_ID env var",
    );
  }

  // Decision: ALWAYS batchGet both ranges. The Plataforma rows are useful for
  // empresa enrichment AND for cross-validating Transaction IDs. One quota
  // unit either way.
  const ranges = [
    SPREADSHEETS.payouts.range,        // 'BD_Payouts!A1:Z'
    SPREADSHEETS.transactions.range,   // 'BD_Plataforma!A1:Z'
  ];

  const res = await withRetry(() =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId: SPREADSHEETS.payouts.id,
      ranges,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    }),
  );

  const valueRanges = res.data.valueRanges ?? [];
  const payoutRows = (valueRanges[0]?.values ?? []) as unknown[][];
  const txRows     = (valueRanges[1]?.values ?? []) as unknown[][];

  // ... same headerIndexMap + missing-header check + per-row safeParse +
  // skip-and-count loop as transactions.ts (reuse, do NOT re-invent)
  // PLUS: build Map<transactionId, empresaId> from txRows and pass into
  // PayoutRowSchema.transform via Zod's .superRefine() or a wrapper map.

  // ... pseudocode for clarity:
  // const byTxId = new Map<string, string>();
  // for (const r of txRows.slice(1)) { /* parse → byTxId.set(transaction_id, tikintag) */ }
  // const enriched = payouts.map(p => ({ ...p, empresa_id: byTxId.get(p.transactionId) ?? p.holder }));

  return { rows: [], skipped: 0, lastReadAt, warnings: [] }; // placeholder
}

/**
 * React `cache()`-wrapped variant — same rule as `getCachedTransactions`:
 *   - DashboardHeader (already wired) keeps reading getCachedTransactions.
 *   - /payouts/page.tsx reads getCachedPayouts.
 *   - Both fire on the same render → React dedupes per-fn → 2 Sheets calls
 *     total (one batchGet from getCachedPayouts, one .get from
 *     getCachedTransactions). NOT 4. NOT 1. The split is intentional —
 *     transactions.ts already shipped and is consumed by the chrome.
 *
 * Future optimization (NOT for Phase 3): merge the two cached fetches into
 * one shared `getCachedSheetsBundle()` if the chrome ever needs Payouts data.
 */
export const getCachedPayouts = cache(getPayouts);
```

### Page composition: `app/(protected)/payouts/page.tsx` (mirror `bonos/page.tsx`)

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { PayoutsKPICards } from "@/components/payouts/PayoutsKPICards";
import { LatencyHistogram } from "@/components/payouts/LatencyHistogram";
import { DestinationSplit } from "@/components/payouts/DestinationSplit";
import { FailureBreakdown } from "@/components/payouts/FailureBreakdown";

import {
  filterPayouts,
  summarizePayouts,
  computeLatencyPercentiles,
  aggregateLatencyHistogram,
  aggregateByDestination,
  aggregateFailures,
} from "@/lib/domain/payouts";
import { getCachedPayouts } from "@/lib/sheets/payouts";
import { parseFilters } from "@/lib/url-state";

export const metadata = { title: "Payouts · Tikin Dashboard" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let result;
  try {
    result = await getCachedPayouts();
  } catch (err) {
    return (
      <Card>
        <CardHeader><CardTitle>No pudimos leer el Sheet</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {err instanceof Error ? err.message : "Error desconocido al leer payouts."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const payouts = filterPayouts(result.rows, filters);
  const summary = summarizePayouts(payouts);
  const latency = computeLatencyPercentiles(payouts);

  if (payouts.length === 0) {
    return (
      <div className="space-y-6">
        <PayoutsKPICards summary={summary} latency={latency} />
        <Card>
          <CardHeader><CardTitle>Sin payouts en el período seleccionado</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Probá ampliando el rango de fechas o quitando el filtro de empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const histogram = aggregateLatencyHistogram(payouts);
  const byDestination = aggregateByDestination(payouts);
  const failures = aggregateFailures(payouts);

  return (
    <div className="space-y-6">
      <PayoutsKPICards summary={summary} latency={latency} />
      <Card>
        <CardHeader><CardTitle>Latencia de payouts (tarjeta vs banco)</CardTitle></CardHeader>
        <CardContent><LatencyHistogram data={histogram} /></CardContent>
      </Card>
      <DestinationSplit data={byDestination} />
      <FailureBreakdown rows={failures} /> {/* presenter-hide on the wrapper */}
    </div>
  );
}
```

## State of the Art (April 2026)

| Old Approach | Current Approach | When Changed | Impact for Phase 3 |
|--------------|------------------|--------------|--------------------|
| Two `.get()` calls (one per Sheet tab) | `batchGet` with array of ranges | Available since Sheets API v4 launch (2016); confirmed quota-equivalent in current docs | **Saves 50% of read quota in Payouts page** |
| Separate npm `simple-statistics` for percentile | Hand-rolled `quantileSorted` (R-7 linear interpolation) | This codebase's Phase-2 pattern (no-deps for ≤10-line solutions) | **No new runtime dep** |
| Recharts 3.x | Recharts 2.15.4 (locked) | Recharts 3 in alpha; not adopted yet | Use 2.x API conventions — `<Bar dataKey stackId>` pattern is unchanged in 3.x |
| `useMemo` percentile in Client Component | Server Component compute | React 19 + Next 16 enables Server Component default | **All percentile math runs server-side; no JS shipped to compute it** |
| Date-time as JS `Date` for latency | Numeric `seconds` from Sheet — pre-converted in adapter | Phase 2 single-Intl-gate convention | **Faster sort, no TZ confusion** |

**New patterns to consider for v2 / Phase 4+:**
- **Native histograms** in Prometheus-style monitoring would auto-bucket. Not needed here — we have ~999 rows and 4 fixed buckets; static bucketization is correct.
- **`d3-array` `bin`** for dynamic bucketing. Reject — buckets are non-uniform (1h, 5h, 18h widths) and product-driven. Hand-rolled if-cascade is clearer.

**Deprecated/outdated:**
- **`PERCENTILE` (Excel)** — equivalent to `PERCENTILE.INC` (R-7); Excel renamed in 2010. R-7 is still standard.
- **Nearest-rank percentile** for small N — see [hackmysql.com/eng/percentiles](https://hackmysql.com/eng/percentiles/): "Hybrid R8 (2k) is the clear winner" academically, but R-7 is the deployed industry default everywhere. We choose R-7 for compatibility with what an analyst's Excel would compute, not academic best.

## Open Questions

Three questions blocking schema-finalization. **Resolution path is the same for all three: a temporary `/api/diagnose-payouts` route in Plan 03-01 that samples 20 rows and prints columns side-by-side.** Same diagnostic-then-cleanup pattern as Plan 02-01 (verified to work, see `02-01-SUMMARY.md`).

### 1. `Aging` vs `Total Time` — units and which is canonical
**What we know:** Both columns exist in BD_Payouts (Phase 1 captured). Names suggest both are time durations. Latency columns are inputs to P50/P95 + histogram.
**What's unclear:** Units (seconds? minutes? hours? formatted duration string?). Whether they're the same value differently rendered, or different measures (e.g., Aging = since last state change; Total Time = since creation).
**Recommendation:** Plan 03-01 first task. Diagnostic samples 20 rows showing `[Date, State Timestamp, Aging, Total Time]` side by side with `typeof` for each. Decision rule:
  - If both are numeric and match within 1% → use `Total Time` (most-likely-canonical name); document the duplication.
  - If they're different → use the one matching `(State Timestamp - Date)` order of magnitude. Likely `Total Time` for end-to-end latency.
  - Convert to **seconds** in Zod schema (`z.coerce.number().finite().nonnegative()` then divide by 60 / 3600 if Sheet stores minutes / hours).

### 2. `Destination Medium` distinct values
**What we know:** Column exists. PAY-04 requires split tarjeta vs banco.
**What's unclear:** Exact strings in production data. Spanish or English? Title case or lower?
**Recommendation:** Same diagnostic. `SELECT DISTINCT destination_medium FROM BD_Payouts` essentially. Then use Phase 2 `OTRO_*` fallback pattern in the Zod schema:
```typescript
type DestinationMedium = "tarjeta" | "cuenta_bancaria" | "OTRO_MEDIUM";
const KNOWN_DESTINATION_MEDIUMS = ["tarjeta", "cuenta_bancaria"] as const;
// transform: lowercase + trim + Spanish-ize ('card' → 'tarjeta', 'bank_account' → 'cuenta_bancaria') + fallback OTRO_MEDIUM
```
Mapping logic depends on what the diagnostic shows.

### 3. `Holder` ↔ `tikintag` correspondence
**What we know:** BD_Payouts has `Holder` column; BD_Plataforma has `tikintag`. Empresa filter (CROSS-02) is single global filter populated from BD_Plataforma.
**What's unclear:** Whether `Holder` IS the same identifier domain as `tikintag` (e.g., both are `$mario`, `$tikincol`) or a different one (e.g., display name, UUID).
**Recommendation:** Diagnostic ALSO captures 5 distinct `Holder` values + 5 distinct `tikintag` values. Decision tree in Pitfall 3 above. Either way, `payouts.ts` projects `empresa_id` (single point of override, same as schemas.ts line for Transaction.empresa_id):
```typescript
// in PayoutRowSchema.transform:
empresa_id: parsed.holder,           // Default if Holder == tikintag
// ─ OR if join needed ─
empresa_id: byTxId.get(parsed.transaction_id) ?? parsed.holder, // Map populated from BD_Plataforma
```

### 4. (Decided, no live data needed) PAY-V2-01 / PAY-V2-02 inclusion in Phase 3
**Decided:** YES — fold into Phase 3. Per `01-04-SUMMARY.md` "v2 → v1 Promotions": data exists today (`State`, `Failure Reason`, `Failure Details` columns confirmed). Marginal cost is 2 pure functions + 1-2 visual leaves (`FailureBreakdown` Card list). Both presenter-hidden via `data-presenter-hide` on wrappers — they're internal commercial signals.
- **PAY-V2-01 success rate**: `summarizePayouts` adds `successRate = completed / total` field; KPI card next to volumen.
- **PAY-V2-02 failure breakdown**: `aggregateFailures(payouts)` returns `[{ reason, count, pctOfFailures }]`; rendered as Card list.

### 5. (Decided) Modo Presentación split for Payouts
**Visible to client (NO `data-presenter-hide`):**
- `PayoutsKPICards` count + $ volumen + P50 + P95 (the "screen we show clients most"; this is the demo highlight per ROADMAP.md)
- `LatencyHistogram` (split tarjeta vs banco)
- `DestinationSplit` if scoped to one empresa via filter (the client wants to see "we paid you X via cards, Y via bank")

**Hidden in Modo Presentación (`data-presenter-hide`):**
- Success rate KPI card (commercial)
- `FailureBreakdown` Card (operational, exposes Tikin's internal fail rates)
- Per-empresa table when no empresa filter is active (cross-empresa data; same convention as Bonos `Leaderboard`)

## Sources

### Primary (HIGH confidence)
- [Google Sheets API — quota limits](https://developers.google.com/workspace/sheets/api/limits) — verified `batchGet` is one quota unit per call (quoted: "Each batch request, including any subrequest, is counted as one API request toward your usage limit.")
- [Google Sheets API — spreadsheets.values.batchGet reference](https://developers.google.com/sheets/api/reference/rest/v4/spreadsheets.values/batchGet) — verified response shape `{ spreadsheetId, valueRanges[] }` in request order
- [Recharts API — Bar](https://recharts.github.io/en-US/api/Bar/) — verified `stackId` shared between Bars stacks them on the same axis category
- [Recharts API — BarChart](https://recharts.github.io/en-US/api/BarChart/) — verified data prop is `[{ key: value }]` array, `layout=horizontal` default
- `simple-statistics` `quantileSorted` source — verified R-7 linear interpolation (the algorithm we hand-roll matches)
- Existing codebase: `src/lib/sheets/transactions.ts`, `src/lib/sheets/_utils.ts`, `src/lib/domain/bonos.ts`, `src/lib/domain/schemas.ts`, `src/lib/format.ts`, `src/lib/url-state.ts` — verified patterns to mirror
- Existing planning artifacts: `.planning/phases/01-foundation/01-04-SUMMARY.md` (live BD_Payouts column inventory), `.planning/phases/02-bonos/02-01-SUMMARY.md` (diagnostic-then-cleanup pattern), `.planning/phases/02-bonos/02-04-SUMMARY.md` (page-composition pattern)
- `package.json` versions: googleapis ^171.4.0, recharts ^2.15.4, zod ^4.3.6, react 19.2.4, next 16.2.4

### Secondary (MEDIUM confidence)
- [hackmysql.com — Percentiles](https://hackmysql.com/eng/percentiles/) — argues R-8 is academically best but acknowledges R-7 is the deployed default everywhere
- [Wikipedia — Quantile](https://en.wikipedia.org/wiki/Quantile) — Hyndman-Fan 9 definitions reference; R-7 documented as R/S/numpy default
- [Prometheus Histograms practices](https://prometheus.io/docs/practices/histograms/) — confirmed linear interpolation between bucket boundaries is industry standard for SLO percentile reporting
- [Atomic Spin — Stacked Bar Charts in Recharts](https://spin.atomicobject.com/stacked-bar-charts-recharts/) — community pattern for stacked-bar `data` shape (multi-source confirms primary docs)
- [recharts/recharts#1580](https://github.com/recharts/recharts/issues/1580) — verified Recharts has NO native histogram; pre-bucketized data + BarChart is the canonical pattern
- [recharts/recharts#2666](https://github.com/recharts/recharts/issues/2666) — verified zero-value bars render as nothing by default (motivates `minPointSize`)

### Tertiary (LOW confidence — flagged for live diagnostic)
- The 3 unknowns in **Open Questions** above are unresolvable from documentation. They require sampling production BD_Payouts in Plan 03-01.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked from Phase 1+2; no new deps; package.json verified
- Architecture patterns: HIGH — direct mirror of `bonos.ts` + `transactions.ts` + `bonos/page.tsx`, all production-verified per `02-04-SUMMARY.md`
- `batchGet` one-quota-unit: HIGH — quoted from current Google docs
- Percentile R-7 algorithm: HIGH — R, NumPy, Excel, simple-statistics all default to R-7
- Recharts stacked BarChart shape: HIGH — verified API doc + multi-source community examples
- Histogram bucketization for non-uniform widths: HIGH — 5-line pure TS, no library exists in our stack that does this better
- Pitfalls #1, #2, #3 (Aging units / Destination Medium values / Holder ↔ tikintag): LOW — require live data; mitigation is the diagnostic route in Plan 03-01

**Research date:** 2026-04-30
**Valid until:** ~2026-05-30 (stable stack, slow-moving libraries; if Recharts 3.x ships in this window, re-verify Bar/BarChart props)
