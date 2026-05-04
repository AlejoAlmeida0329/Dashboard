/**
 * Payouts domain — pure aggregations over `Payout[]`.
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué cuenta como un payout
 * exitoso", "cómo se mide la latencia", "cómo se agrupan los destinos". UI
 * consumers (Plan 03-03 components, Plan 03-04 page) import the functions
 * here and stay dumb about the underlying data shape.
 *
 * Design rules (deliberate — mirror of bonos.ts):
 *   - NO imports from `next/`, `react`, `server-only`, or `lib/sheets/`.
 *     This makes every function callable from Server Components, Client
 *     Components, scripts, and (future) tests without setup.
 *   - All functions are pure: same input → same output, no side effects,
 *     no `Date.now()` or `process.env` reads.
 *   - Date math is anchored to "America/Bogota" via the inline timestamp
 *     helpers below — same convention as `url-state.ts` so filters and
 *     aggregations agree on what "a day" means.
 *   - Zero-safe contracts everywhere: empty input never produces NaN /
 *     Infinity. Rate divisors guard with `count > 0 ? x/count : 0`.
 *   - Percentile algorithm cited explicitly (R-7) and fixture-verified —
 *     the "números incuestionables" essential of Phase 3 (03-CONTEXT.md)
 *     lives here.
 *
 * Default Payouts filter contract (the "what counts as a successful payout?"):
 *   1. `state === "completed"` — Plan 03-01 confirmed live: 3 distinct
 *      states (completed, in_progress, failed). Per 03-CONTEXT.md essentials
 *      ("solo payouts que efectivamente se completaron"), in_progress and
 *      failed do NOT influence headline P50/P95/histogram numbers. The
 *      `latencySeconds` fallback to Aging in types.ts exists defensively —
 *      this filter is the gate that makes the fallback never matter for
 *      headline numbers.
 *   2. Bogotá-anchored from/to (inclusive on both ends) — same convention
 *      as `filterBonos`.
 *   3. Optional empresa filter via `p.empresa_id === filters.empresa`.
 *      IMPORTANT: `Holder` is a CARDHOLDER NAME (Plan 03-01 finding), NOT
 *      a tikintag. So the empresa filter cannot use `holder`. Plan 03-04
 *      page composition is responsible for enriching `Payout.empresa_id`
 *      via a `transactionId` join to BD_Plataforma when `filters.empresa`
 *      is set. Without that join, `p.empresa_id` is undefined and the
 *      empresa filter naturally returns nothing — which is the correct
 *      safety behavior (better empty than wrong-empresa data).
 *
 * Scope adjustment from Plan 03-01 findings (decided 2026-05-04):
 *   - All 798 production payouts are to BANKS (12 distinct codes); zero
 *     card payouts. PAY-04's "split tarjeta vs banco" cannot be honored.
 *   - The histogram aggregator (Task 2 in this plan) has NO medium stack —
 *     emitting a tarjeta=0 series would visually misrepresent reality.
 *   - The destination story is told by `aggregateTopBancos` (top N banks
 *     by montoTotal + Otros bancos rollup) which Plan 03-03 will render
 *     as a TopBancos widget. This replaces the originally planned
 *     `aggregateByDestination` (tarjeta/banco binary).
 */

import type { DashboardFilters } from "@/lib/url-state";

import type { Payout, PayoutState } from "./types";

// --- Constants --------------------------------------------------------------

/**
 * `PayoutState` values that count as a "successfully-completed" payout
 * for headline metrics (P50/P95 latency, histogram, top-bancos amounts).
 *
 * Plan 03-01 captured live distinct states (`completed`, `in_progress`,
 * `failed`) — see 03-01-SUMMARY.md "Diagnostic Findings". Only `completed`
 * counts. If Tikin later splits completion into multiple terminal states
 * (e.g. `settled`, `confirmed`), append them to this array — that's the
 * only edit needed.
 */
const COMPLETED_PAYOUT_STATES: readonly PayoutState[] = ["completed"];

// --- Date parse helpers -----------------------------------------------------

/**
 * Parse a `YYYY-MM-DD` filter string as the START of that day in Bogotá
 * (i.e. 00:00:00 COT, which is 05:00:00 UTC). Returns `-Infinity` if the
 * string is missing or unparseable so callers can use `>=` without
 * special-casing.
 *
 * We intentionally do NOT use `new Date(s)` because that interprets
 * `'2026-04-27'` as midnight UTC, which is 19:00 the previous day in
 * Bogotá — silent off-by-one for every range filter.
 *
 * Verbatim copy from `bonos.ts` — DRY-ing across modules costs more than
 * the inline duplication; the helpers are private to each domain file.
 */
function startOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.NEGATIVE_INFINITY;
  // Cheap shape check: we expect strict YYYY-MM-DD from `url-state.ts`.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.NEGATIVE_INFINITY;
  // Bogotá is UTC-5 with no DST. 00:00 in Bogotá == 05:00 UTC.
  const t = Date.parse(`${s}T00:00:00-05:00`);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Parse a `YYYY-MM-DD` filter string as the END of that day in Bogotá
 * (i.e. 23:59:59.999 COT). Returns `+Infinity` if missing/unparseable.
 *
 * The "end of day" semantic matters: a user setting `to=2026-04-29`
 * expects to see payouts stamped at 22:00 on the 29th included.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Output types -----------------------------------------------------------

/** Header KPIs for the Payouts tab. */
export interface PayoutSummary {
  /** Number of completed payouts in the filtered range. */
  count: number;
  /** Sum of `monto` across the filtered set (COP). */
  montoTotal: number;
  /** Median (50th percentile) latency in seconds. `0` (not NaN) when count is `0`. */
  p50Seconds: number;
  /** 95th percentile latency in seconds. `0` (not NaN) when count is `0`. */
  p95Seconds: number;
}

// --- Filtering --------------------------------------------------------------

/**
 * Apply the Default Payouts filter contract to a list of payouts.
 *
 * Default filter (the "successful payout" definition):
 *   1. `state ∈ COMPLETED_PAYOUT_STATES` (currently just `'completed'`)
 *   2. `from` filter — `p.fecha >= startOfDay(from)` in Bogotá.
 *      Unparseable `from` → no lower bound (degrade gracefully).
 *   3. `to` filter — `p.fecha <= endOfDay(to)` in Bogotá.
 *      Unparseable `to` → no upper bound.
 *   4. `empresa` filter — `p.empresa_id === filters.empresa`.
 *      Empty/undefined → no empresa restriction.
 *
 * NOTE on empresa: `Payout.empresa_id` is `undefined` until Plan 03-04
 * populates it via Transaction ID join. When `filters.empresa` is set
 * but the join hasn't been performed, this function returns `[]` —
 * which is the correct safety behavior (better empty than mismatched).
 * Plan 03-04 page composition MUST run the join before calling this
 * if it intends to honor an empresa filter.
 *
 * Pure: returns a new array; does not mutate `payouts`.
 *
 * @example
 *   filterPayouts(allPayouts, { from: '2026-04-01', to: '2026-04-30' })
 *   // → only completed payouts in April 2026
 */
export function filterPayouts(
  payouts: Payout[],
  filters: DashboardFilters,
): Payout[] {
  const completedSet = new Set<string>(COMPLETED_PAYOUT_STATES);
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;

  return payouts.filter((p) => {
    if (!completedSet.has(p.state)) return false;

    const ts = p.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && p.empresa_id !== empresa) return false;

    return true;
  });
}

// --- Percentile primitive ---------------------------------------------------

/**
 * R-7 linear interpolation percentile — the default in R, NumPy
 * (`numpy.percentile`), Excel `PERCENTILE.INC`, and `simple-statistics`'s
 * `quantileSorted`. Cited inline so future readers don't have to reverse-
 * engineer the math.
 *
 * INPUT MUST BE SORTED ASCENDING. Callers are expected to sort once and
 * reuse the sorted array for multiple percentile calls (e.g. p50 + p95
 * on the same dataset). Sorting inside this function would be O(n log n)
 * per call which is wasteful for the common case.
 *
 * Algorithm (R-7):
 *   - n = sortedValues.length
 *   - h = (n - 1) * p   ← position in [0, n-1]
 *   - if integer h, return sortedValues[h] exactly
 *   - else return sortedValues[floor(h)] + (h - floor(h)) * (sortedValues[ceil(h)] - sortedValues[floor(h)])
 *
 * Edge cases (zero-safe contract):
 *   - empty input → `0` (not NaN)
 *   - single value → that value (any p)
 *   - p <= 0 → first value
 *   - p >= 1 → last value
 *
 * Verified against R/NumPy fixtures (run inline to confirm):
 *   - `quantileSorted([1, 2, 3, 4, 5], 0.5)` === `3` (median exact, n=5)
 *   - `quantileSorted([1, 2, 3, 4], 0.5)` === `2.5` (median interpolated:
 *      h=1.5, lo=1, hi=2, v[1]=2, v[2]=3, 2 + 0.5*1 = 2.5)
 *   - `quantileSorted([1..10], 0.95)` === `9.55` (h=9*0.95=8.55,
 *      v[8]=9, v[9]=10, 9 + 0.55*1 = 9.55)
 *   - `quantileSorted([], 0.5)` === `0`
 *   - `quantileSorted([42], 0.95)` === `42`
 */
export function quantileSorted(
  sortedValues: readonly number[],
  p: number,
): number {
  const n = sortedValues.length;
  if (n === 0) return 0;
  if (n === 1) return sortedValues[0];
  if (p <= 0) return sortedValues[0];
  if (p >= 1) return sortedValues[n - 1];

  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (h - lo) * (sortedValues[hi] - sortedValues[lo]);
}

// --- Aggregations -----------------------------------------------------------

/**
 * Compute header KPIs from an already-filtered list of completed payouts.
 *
 * Pure. Empty input → `{ count: 0, montoTotal: 0, p50Seconds: 0, p95Seconds: 0 }`
 * (no NaN / Infinity).
 *
 * Sort the latencies ONCE and reuse the sorted array for both p50 and p95
 * — `quantileSorted` requires sorted input and the n log n cost should not
 * be paid twice.
 *
 * @example
 *   summarizePayouts([
 *     { monto: 200000, latencySeconds: 1800,  ... }, // 30 min
 *     { monto: 500000, latencySeconds: 3600,  ... }, // 1 hour
 *     { monto: 100000, latencySeconds: 7200,  ... }, // 2 hours
 *   ])
 *   // → { count: 3, montoTotal: 800000, p50Seconds: 3600, p95Seconds: 6840 }
 *   //   (p95: h=2*0.95=1.9, v[1]=3600, v[2]=7200, 3600 + 0.9*3600 = 6840)
 */
export function summarizePayouts(payouts: Payout[]): PayoutSummary {
  const count = payouts.length;
  if (count === 0) {
    return { count: 0, montoTotal: 0, p50Seconds: 0, p95Seconds: 0 };
  }

  let montoTotal = 0;
  const latencies: number[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    const p = payouts[i];
    montoTotal += p.monto;
    latencies[i] = p.latencySeconds;
  }
  // Sort ASCENDING once; reuse for both percentile calls.
  latencies.sort((a, b) => a - b);

  const p50Seconds = quantileSorted(latencies, 0.5);
  const p95Seconds = quantileSorted(latencies, 0.95);

  return { count, montoTotal, p50Seconds, p95Seconds };
}
