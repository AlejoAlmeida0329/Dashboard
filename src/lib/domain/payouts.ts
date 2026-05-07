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

// --- Sibling filter for success-rate denominator ----------------------------

/**
 * Filter by date+empresa but KEEP all states. Used by `aggregateSuccessRate`
 * which needs failed/in_progress rows in the denominator.
 *
 * If we used `filterPayouts` here, the rate would always be 100% (only
 * completed payouts in the numerator AND denominator). The state filter
 * is intentionally skipped.
 *
 * Pure: returns a new array; does not mutate `payouts`.
 */
export function filterPayoutsByPeriodOnly(
  payouts: Payout[],
  filters: DashboardFilters,
): Payout[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;

  return payouts.filter((p) => {
    const ts = p.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && p.empresa_id !== empresa) return false;

    return true;
  });
}

// --- Latency histogram ------------------------------------------------------

/** Histogram bucket label — fixed 4-bucket shape. */
export type LatencyBucketLabel = "<1h" | "1-6h" | "6-24h" | ">24h";

/** One row of the latency histogram. */
export interface LatencyBucket {
  bucket: LatencyBucketLabel;
  /** Total count of payouts in this bucket. */
  count: number;
}

/**
 * Bucket boundaries — half-open intervals `[lower, upper)`:
 *   - `"<1h"`:   `latencySeconds <  3600`
 *   - `"1-6h"`:  `3600  <= latencySeconds <  21600`   (6 * 3600)
 *   - `"6-24h"`: `21600 <= latencySeconds <  86400`   (24 * 3600)
 *   - `">24h"`:  `latencySeconds >= 86400`
 *
 * A boundary value (3600s, 21600s, 86400s) falls into the UPPER bucket —
 * verified inline via fixtures in JSDoc. The half-open convention matches
 * what R, NumPy, Excel, and most BI tools do for bins; closed-on-both-
 * ends would require deciding whether 3600s is "<1h" or "1-6h" via a
 * non-obvious tiebreak.
 *
 * The 4 labels are emitted in fixed order even when count=0 (stable shape
 * for Recharts `BarChart` in Plan 03-03; missing buckets cause visual
 * jumps when the data shifts on filter change).
 */
const HISTOGRAM_BUCKET_ORDER: readonly LatencyBucketLabel[] = [
  "<1h",
  "1-6h",
  "6-24h",
  ">24h",
];

/**
 * Group payouts into 4 latency buckets. Single-series shape (no medium
 * stack — see "Scope adjustment from Plan 03-01" in module docstring:
 * all production payouts are bank, so a stack would always show one
 * color and one zero, which is visually misleading).
 *
 * Always emits 4 rows in fixed order even when input is empty (stable
 * shape; Recharts BarChart in Plan 03-03 needs deterministic categories
 * across renders to avoid jarring shape changes on filter swap).
 *
 * O(n) single pass.
 *
 * @example boundary placement (verified in plan's verify section)
 *   aggregateLatencyHistogram([
 *     { latencySeconds: 600,    ... }, // 10m   → "<1h"
 *     { latencySeconds: 3600,   ... }, // 1h    → "1-6h"   (boundary, upper bucket)
 *     { latencySeconds: 21600,  ... }, // 6h    → "6-24h"  (boundary)
 *     { latencySeconds: 86400,  ... }, // 24h   → ">24h"   (boundary)
 *   ])
 *   // → [
 *   //     { bucket: "<1h",   count: 1 },
 *   //     { bucket: "1-6h",  count: 1 },
 *   //     { bucket: "6-24h", count: 1 },
 *   //     { bucket: ">24h",  count: 1 },
 *   //   ]
 *
 * @example empty input (stable shape)
 *   aggregateLatencyHistogram([])
 *   // → [{<1h:0}, {1-6h:0}, {6-24h:0}, {>24h:0}]
 */
export function aggregateLatencyHistogram(payouts: Payout[]): LatencyBucket[] {
  // Initialize all 4 buckets to count=0 so we never miss a row in output.
  const counts: Record<LatencyBucketLabel, number> = {
    "<1h": 0,
    "1-6h": 0,
    "6-24h": 0,
    ">24h": 0,
  };

  const ONE_HOUR = 3600;
  const SIX_HOURS = 6 * 3600; // 21600
  const ONE_DAY = 24 * 3600; // 86400

  for (const p of payouts) {
    const s = p.latencySeconds;
    // Half-open intervals: a boundary value falls in the UPPER bucket.
    if (s < ONE_HOUR) {
      counts["<1h"] += 1;
    } else if (s < SIX_HOURS) {
      counts["1-6h"] += 1;
    } else if (s < ONE_DAY) {
      counts["6-24h"] += 1;
    } else {
      counts[">24h"] += 1;
    }
  }

  return HISTOGRAM_BUCKET_ORDER.map((bucket) => ({
    bucket,
    count: counts[bucket],
  }));
}

// --- Top bancos (replaces aggregateByDestination per Plan 03-01 findings) ---

/** Per-bank aggregate stats (used by `aggregateTopBancos`). */
export interface BancoStats {
  /**
   * Bank code (Payout.medium), e.g. `"bancolombia"`, `"nequi"`. The literal
   * string `"Otros bancos"` is reserved for the rolled-up tail emitted by
   * `aggregateTopBancos`.
   */
  medium: string;
  count: number;
  montoTotal: number;
  p50Seconds: number;
  p95Seconds: number;
}

/** Result shape of `aggregateTopBancos`. */
export interface TopBancos {
  /** Top N banks by `montoTotal`, descending. Length 0..N. */
  top: BancoStats[];
  /**
   * Aggregate of remaining banks (positions n+1..end). When there were
   * `<=N` total banks, `otros.count === 0` (zero-safe placeholder).
   */
  otros: BancoStats;
}

/**
 * Aggregate per-bank stats and split into "top N by montoTotal" plus an
 * "Otros bancos" rollup of the rest.
 *
 * Reinterprets PAY-04's "split por destino" using real granularity. Plan
 * 03-01 confirmed all 798 production payouts are to banks (12 distinct
 * codes); the originally planned tarjeta/banco binary collapses to one
 * category. Top N + Otros surfaces the actual distribution: which banks
 * see the most $ flowing through Tikin.
 *
 * Algorithm:
 *   1. Group `payouts` by `medium` into `Map<medium, Payout[]>`.
 *   2. For each group, compute `BancoStats`: count, montoTotal, p50, p95.
 *      Sort latencies once per group; reuse for both percentiles.
 *   3. Sort groups by `montoTotal` DESC.
 *   4. `top = first N`; `otrosRows = remaining groups flattened`.
 *   5. `otros = aggregate(otrosRows, "Otros bancos")` if non-empty,
 *      otherwise a zero-safe placeholder.
 *
 * NOTE on "Otros" aggregation: we re-aggregate the underlying rows rather
 * than summing per-bank `BancoStats` because percentiles do NOT compose by
 * addition. The p95 of (group A ∪ group B) is generally NOT a function of
 * p95(A) and p95(B). We need the underlying values.
 *
 * Zero-safe: empty input → `{ top: [], otros: <zero placeholder> }`. The
 * `medium: "Otros bancos"` is the literal Spanish string Plan 03-03 will
 * render in the UI.
 *
 * @example
 *   aggregateTopBancos([
 *     { medium: "bancolombia", monto: 1000000, latencySeconds: 3600, ... },
 *     { medium: "nequi",       monto:  500000, latencySeconds: 1800, ... },
 *     { medium: "daviplata",   monto:  100000, latencySeconds: 7200, ... },
 *   ], 2)
 *   // → {
 *   //     top: [
 *   //       { medium: "bancolombia", count: 1, montoTotal: 1000000, p50Seconds: 3600, p95Seconds: 3600 },
 *   //       { medium: "nequi",       count: 1, montoTotal:  500000, p50Seconds: 1800, p95Seconds: 1800 },
 *   //     ],
 *   //     otros: { medium: "Otros bancos", count: 1, montoTotal: 100000, p50Seconds: 7200, p95Seconds: 7200 },
 *   //   }
 *
 * @example empty input
 *   aggregateTopBancos([])
 *   // → { top: [], otros: { medium: "Otros bancos", count: 0, montoTotal: 0, p50Seconds: 0, p95Seconds: 0 } }
 */
export function aggregateTopBancos(payouts: Payout[], n = 5): TopBancos {
  // Helper: compute BancoStats from a list of payouts.
  const aggregate = (rows: Payout[], label: string): BancoStats => {
    const count = rows.length;
    if (count === 0) {
      return {
        medium: label,
        count: 0,
        montoTotal: 0,
        p50Seconds: 0,
        p95Seconds: 0,
      };
    }
    let montoTotal = 0;
    const latencies: number[] = new Array(count);
    for (let i = 0; i < count; i += 1) {
      montoTotal += rows[i].monto;
      latencies[i] = rows[i].latencySeconds;
    }
    latencies.sort((a, b) => a - b);
    return {
      medium: label,
      count,
      montoTotal,
      p50Seconds: quantileSorted(latencies, 0.5),
      p95Seconds: quantileSorted(latencies, 0.95),
    };
  };

  // Empty-input fast path keeps shape stable.
  if (payouts.length === 0) {
    return {
      top: [],
      otros: aggregate([], "Otros bancos"),
    };
  }

  // Group by medium.
  const byMedium = new Map<string, Payout[]>();
  for (const p of payouts) {
    const cur = byMedium.get(p.medium);
    if (cur) {
      cur.push(p);
    } else {
      byMedium.set(p.medium, [p]);
    }
  }

  // Compute stats per group, then sort desc by montoTotal.
  const groups: BancoStats[] = [];
  for (const [medium, rows] of byMedium) {
    groups.push(aggregate(rows, medium));
  }
  groups.sort((a, b) => b.montoTotal - a.montoTotal);

  const top = groups.slice(0, n);

  // Rollup the remaining groups back into a flat row list, then aggregate
  // as a single "Otros bancos" stats row. We re-aggregate (not just sum
  // BancoStats fields) because percentiles do NOT compose by addition.
  const otrosGroupNames = new Set(groups.slice(n).map((g) => g.medium));
  if (otrosGroupNames.size === 0) {
    return { top, otros: aggregate([], "Otros bancos") };
  }
  const otrosRows: Payout[] = [];
  for (const p of payouts) {
    if (otrosGroupNames.has(p.medium)) otrosRows.push(p);
  }
  return { top, otros: aggregate(otrosRows, "Otros bancos") };
}

// --- Success rate (uses STATE-UNFILTERED input — see helper above) ----------

/** Result of `aggregateSuccessRate` — the success-rate KPI. */
export interface SuccessRate {
  /**
   * Fraction 0..1 (consume via `formatPercent` from `format.ts`). `0` when
   * `totalAttempted === 0` — zero-safe per Plan 02-02 `pctDelTotal` pattern.
   */
  rate: number;
  /** Count of rows with `state ∈ COMPLETED_PAYOUT_STATES`. */
  completed: number;
  /** Total count of rows considered (completed + non-completed). */
  totalAttempted: number;
}

/**
 * Compute the success rate KPI from a STATE-UNFILTERED universe of payouts.
 *
 * Special note on input: this function expects rows that are filtered by
 * date + empresa BUT NOT BY STATE. The denominator MUST include
 * failed/in_progress payouts, otherwise the rate is always 100% (the
 * classic "I divided by completed-only" bug).
 *
 * Recommended call shape from Plan 03-04 page composition:
 *   const filteredAll = filterPayoutsByPeriodOnly(allPayouts, filters);
 *   const filteredCompleted = filterPayouts(allPayouts, filters);
 *   const successRate = aggregateSuccessRate(filteredAll);
 *
 * Compute:
 *   - `totalAttempted = rows.length`
 *   - `completed = rows.filter(r => COMPLETED_PAYOUT_STATES.includes(r.state)).length`
 *   - `rate = totalAttempted > 0 ? completed / totalAttempted : 0`
 *     (zero-safe per Plan 02-02 `pctDelTotal` pattern)
 *
 * Plan 03-01 confirmed the rejected-equivalent state in BD_Payouts is
 * `failed` (NOT `rejected` as in BD_Plataforma).
 *
 * @example
 *   aggregateSuccessRate([
 *     { state: "completed",   ... },
 *     { state: "completed",   ... },
 *     { state: "failed",      ... },
 *   ])
 *   // → { rate: 0.6666666666666666, completed: 2, totalAttempted: 3 }
 *
 * @example empty input
 *   aggregateSuccessRate([])
 *   // → { rate: 0, completed: 0, totalAttempted: 0 }
 */
export function aggregateSuccessRate(rows: Payout[]): SuccessRate {
  const totalAttempted = rows.length;
  if (totalAttempted === 0) {
    return { rate: 0, completed: 0, totalAttempted: 0 };
  }

  const completedSet = new Set<string>(COMPLETED_PAYOUT_STATES);
  let completed = 0;
  for (const r of rows) {
    if (completedSet.has(r.state)) completed += 1;
  }

  return {
    rate: completed / totalAttempted,
    completed,
    totalAttempted,
  };
}

// === v2 Output types (Plan 07-03 — time-first) ==============================

/**
 * State breakdown across the period-filtered (state-UNFILTERED) universe.
 * Counts plus the success rate fraction in one shot — Plan 07-04 page
 * composition spreads this across 3 KPIs por estado + the tasa-de-éxito
 * semáforo without re-iterating the input.
 */
export interface PayoutStateBreakdown {
  completed: number;
  failed: number;
  inProgress: number;
  /** completed + failed + inProgress + any OTRO_STATE row in the input. */
  total: number;
  /** completed / total; `0` when total is `0` (zero-safe). */
  successRate: number;
}

/**
 * Aging-alert row: an in_progress payout whose age (latencySeconds, which
 * here equals `Aging` because `Total Time` is empty for in_progress per
 * Payout.latencySeconds JSDoc) exceeds the alert threshold.
 *
 * Rendered as the urgent-table on the v2 Payouts page (PAY-V2-04).
 */
export interface AgingAlertRow {
  transactionId: string;
  internalId: string;
  fecha: Date;
  holder: string;
  monto: number;
  medium: string;
  /**
   * Aging in MINUTES (latencySeconds / 60). For in_progress rows this is
   * literally the row's age; for completed/failed rows the field is not
   * meaningful and they are excluded by `aggregateAgingAlertPending` upstream.
   */
  agingMinutes: number;
}

/**
 * One row of the failure-reason breakdown.
 *
 * `reason` is the raw `Payout.failureReason` string (verbatim — no
 * normalization beyond the schema's already-applied trim). When the field
 * is missing on a failed row, the row is grouped under the literal
 * `"Sin razón"` bucket so the failures don't disappear from the breakdown.
 */
export interface FailureReasonRow {
  reason: string;
  count: number;
  /** Sum of `monto` (COP) across failed payouts with this reason. */
  monto: number;
}

/**
 * One row of the third-party-payouts table — payouts whose `holder`
 * (cardholder full name) does NOT match the originating transaction's
 * `tikintag`. Per PAY-V2-08 these are bank withdrawals where the
 * benefactor is a different person than the empresa solicitante.
 */
export interface ThirdPartyPayoutRow {
  transactionId: string;
  fecha: Date;
  holder: string;
  /** The originating transaction's tikintag — e.g. `"$mario"`. */
  tikintag: string;
  monto: number;
  medium: string;
  state: PayoutState;
}

// === v2 Filters (allow ALL states by default; honor filters.status) =========

/**
 * v2 Payouts filter — broader than v1 `filterPayouts`:
 *   1. State: NOT pre-filtered. By default (no `filters.status` URL key)
 *      ALL three states (completed / failed / in_progress) flow through so
 *      the v2 page can render 3 KPIs por estado AND the tasa-de-éxito
 *      semáforo from the SAME row set without re-querying.
 *   2. When `filters.status` is set (CROSS-V2-01 URL filter): honor the
 *      user's selection — narrow the universe to those states. Same Set-
 *      lookup tolerance as `filterBonosV2`.
 *   3. Bogotá-anchored from/to (inclusive ends) — same convention as v1.
 *   4. Optional `empresa` filter — `p.empresa_id === filters.empresa`.
 *      Empty/undefined → no empresa restriction. Page composition is
 *      responsible for enriching `Payout.empresa_id` via `joinPayouts()`
 *      BEFORE calling this when an empresa filter is active (same contract
 *      as v1 — see v1 JSDoc).
 *   5. `filters.tipo` is INTENTIONALLY ignored: BD_Payouts has no `tipo`
 *      field. The Payouts tab is PAYOUT_BANK by-table-of-origin, not by
 *      transaction_type.
 *
 * Pure: returns a new array; does not mutate `payouts`.
 */
export function filterPayoutsV2(
  payouts: Payout[],
  filters: DashboardFilters,
): Payout[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;
  const statusSet =
    filters.status && filters.status.length > 0
      ? new Set<string>(filters.status)
      : undefined;

  return payouts.filter((p) => {
    if (statusSet && !statusSet.has(p.state)) return false;

    const ts = p.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && p.empresa_id !== empresa) return false;

    return true;
  });
}

/**
 * Tally `state` across an already-filtered universe of payouts (typically
 * the output of `filterPayoutsV2` with no `status` URL filter set, so all
 * three states are present in the input).
 *
 * Returns counts for the three known states + the total (which may exceed
 * `completed + failed + inProgress` if any `OTRO_STATE` rows snuck in —
 * we want `successRate` to reflect the full denominator) and the
 * `successRate` fraction.
 *
 * Pure. Empty input → all zeros, `successRate: 0`.
 */
export function summarizePayoutsByState(
  payouts: Payout[],
): PayoutStateBreakdown {
  let completed = 0;
  let failed = 0;
  let inProgress = 0;
  for (const p of payouts) {
    if (p.state === "completed") completed += 1;
    else if (p.state === "failed") failed += 1;
    else if (p.state === "in_progress") inProgress += 1;
  }
  const total = payouts.length;
  return {
    completed,
    failed,
    inProgress,
    total,
    successRate: total > 0 ? completed / total : 0,
  };
}

/**
 * Mean processing time in MINUTES across COMPLETED payouts only (PAY-V2-03).
 *
 * Reads `Payout.latencySeconds` which carries `Total Time` for completed
 * rows (per the Payout interface JSDoc + Plan 06-01 SUMMARY). Filters
 * the input to `state === 'completed'` defensively so the caller doesn't
 * accidentally include `Aging`-fallback values from in_progress / failed
 * rows in the mean.
 *
 * Returns the unrounded mean (Plan 07-04 components decide on display
 * rounding via `formatMinutes` in `format.ts`). Empty completed set → `0`
 * (zero-safe).
 *
 * Pure. O(n).
 */
export function aggregateAverageProcessingMinutes(payouts: Payout[]): number {
  let count = 0;
  let totalSeconds = 0;
  for (const p of payouts) {
    if (p.state !== "completed") continue;
    if (!Number.isFinite(p.latencySeconds)) continue;
    count += 1;
    totalSeconds += p.latencySeconds;
  }
  if (count === 0) return 0;
  return totalSeconds / count / 60;
}

/**
 * Filter the period-universe to in_progress payouts whose aging exceeds
 * the threshold (default 120 minutes = 2 hours per PAY-V2-04). For
 * in_progress rows `latencySeconds` equals `Aging` (Total Time is empty
 * for non-completed rows — see Payout.latencySeconds JSDoc), so dividing
 * by 60 gives the row age in minutes.
 *
 * Returns rows sorted DESC by `agingMinutes` (oldest first, the urgent
 * one at the top of the alert table).
 *
 * Pure. O(n + k log k) where k = matching rows.
 */
export function aggregateAgingAlertPending(
  payouts: Payout[],
  thresholdMinutes = 120,
): AgingAlertRow[] {
  const thresholdSeconds = thresholdMinutes * 60;
  const out: AgingAlertRow[] = [];
  for (const p of payouts) {
    if (p.state !== "in_progress") continue;
    if (!Number.isFinite(p.latencySeconds)) continue;
    if (p.latencySeconds <= thresholdSeconds) continue;
    out.push({
      transactionId: p.transactionId,
      internalId: p.internalId,
      fecha: p.fecha,
      holder: p.holder,
      monto: p.monto,
      medium: p.medium,
      agingMinutes: p.latencySeconds / 60,
    });
  }
  out.sort((a, b) => b.agingMinutes - a.agingMinutes);
  return out;
}
