/**
 * Inicio domain — pure aggregations over `Transaction[]` for the /inicio
 * v2 operative-lens cockpit (Phase 10 — Plans 10-01 + 10-02 + 10-04 fix).
 *
 * This module owns the v2 cross-cutting Inicio aggregations:
 *   - filterInicioV2 — cross-cut filter (state-UNFILTERED + CSV-status +
 *     CSV-tipo + Bogotá-anchored from/to + optional empresa; BOTH directions)
 *   - summarizeInicioV2 — operative-lens KPIs (usuariosActivos + usuariosTotal
 *     + IN/OUT volumen + status counters + successRate)
 *   - aggregateTransactionTypeDistribution — donut data (top-N + Otros rollup)
 *   - aggregateActivityByDateV2 / aggregateActivityByWeekV2 — distinct-tikintag
 *     per bucket time series with split IN/OUT volumen
 *   - aggregateTopUsersByVolume — top-N tikintag ranking by volumenOut
 *
 * REQUIREMENTS traceability (milestones/v2.0-REQUIREMENTS.md):
 *   INI-V2-01  usuarios activos (DISTINCT tikintag) + volumen IN/OUT split
 *   INI-V2-02  tasa de éxito global con semáforo (98.1% baseline)
 *   INI-V2-03  donut por tipo (top 6 + Otros) — baseline 98.1% / 1.6% / 0.2%
 *   INI-V2-04  honor filters.tipo when present (cross-cut narrowing)
 *   INI-V2-05  actividad temporal — distinct tikintag por bucket + IN/OUT volumen
 *   INI-V2-06  top N usuarios por volumen OUT grouped by tikintag (NOT empresa)
 *
 * History:
 *   - Plan 04-01..04-07: v1 revenue-lens surface (DELETED 2026-05-08).
 *   - Plan 10-01: v2 surface introduced.
 *   - Plan 10-02: v1 block pruned; /inicio rewritten to v2.
 *   - Plan 10-04 fix (2026-05-08): direction/tipo classification rewritten
 *     to match BD_Plataforma's bidirectional double-row pattern. BD stores
 *     BONUS / P2P / PURCHASE as TWO rows per event (one OUT for sender +
 *     one IN for receiver, same monto magnitude). The v2 cross-cut now
 *     classifies events using a TIPO-BASED platform-flow lens — IN ≡
 *     PAYIN_PSE + PAYIN_TRANSFER, OUT ≡ PAYOUT_BANK + (BONUS/P2P/PURCHASE
 *     limited to direction='out'). Each event counts ONCE on its OUT side;
 *     the IN-side mirror of bidirectional events is intra-platform and not
 *     a fresh inflow.
 *     Also: usuariosActivos now reflects the filtered scope (period+empresa)
 *     while a NEW usuariosTotal field carries the full-pool DISTINCT
 *     tikintag denominator (PRD baseline 235) for the "X / Y" caption UX.
 *
 * Design rules (deliberate, mirror of `bonos.ts:9-22`):
 *   - NO imports from `next/`, `react`, `server-only`, or `lib/sheets/`.
 *   - All functions are pure: same input → same output, no side effects.
 *   - Bogotá is UTC-5 with no DST. Date arithmetic anchored to Bogotá.
 *   - Empty-input safe across all aggregators.
 */

import { formatInTimeZone } from "date-fns-tz";

import type { DashboardFilters } from "@/lib/url-state";

import type { Transaction, TransactionType } from "./types";

const BOGOTA_TZ = "America/Bogota";

// --- Date parse helpers (verbatim from bonos.ts:53-74) ---------------------

/**
 * Parse a `YYYY-MM-DD` filter string as the START of that day in Bogotá
 * (i.e. 00:00:00 COT, which is 05:00:00 UTC). Returns `-Infinity` if
 * missing or unparseable so callers can use `>=` without special-casing.
 *
 * We intentionally do NOT use `new Date(s)` because that interprets
 * `'2026-04-27'` as midnight UTC, which is 19:00 the previous day in
 * Bogotá — silent off-by-one for every range filter.
 */
function startOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.NEGATIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.NEGATIVE_INFINITY;
  const t = Date.parse(`${s}T00:00:00-05:00`);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Parse a `YYYY-MM-DD` filter string as the END of that day in Bogotá
 * (i.e. 23:59:59.999 COT). Returns `+Infinity` if missing/unparseable.
 *
 * The "end of day" semantic matters: a user setting `to=2026-04-29`
 * expects to see transactions stamped at 22:00 on the 29th included.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Direction classification (Plan 10-04 fix — TIPO-BASED platform-flow lens)

/**
 * Tipos that ARE platform inflows when present. PAYIN_PSE / PAYIN_TRANSFER
 * are recargas — money entering the Tikin platform from the user's bank.
 * Each event = exactly 1 row in BD_Plataforma (direction='in').
 */
const PLATFORM_IN_TIPOS: ReadonlySet<TransactionType> = new Set([
  "PAYIN_PSE",
  "PAYIN_TRANSFER",
]);

/**
 * Tipos that ARE platform outflows when present, and produce TWO rows per
 * event in BD_Plataforma (sender OUT + receiver IN, same monto magnitude).
 * Counted ONCE on the OUT side — the IN-side mirror is an intra-platform
 * counterpart, not a fresh inflow. Verified pattern (cardUsage.ts:5-12 +
 * bonos v2 contract).
 */
const PLATFORM_OUT_TIPOS_BIDIRECTIONAL: ReadonlySet<TransactionType> = new Set([
  "BONUS",
  "P2P",
  "PURCHASE",
]);

/**
 * Tipos that ARE platform outflows when present, single-row per event.
 * PAYOUT_BANK = retiro a banco (money leaving the platform to a bank).
 */
const PLATFORM_OUT_TIPOS_SINGLEDIR: ReadonlySet<TransactionType> = new Set([
  "PAYOUT_BANK",
]);

/**
 * `true` for rows that represent platform inflows (recargas). Each event
 * is exactly one row, so no double-counting concern at the row level.
 */
function isPlatformInRow(t: Transaction): boolean {
  return PLATFORM_IN_TIPOS.has(t.tipo);
}

/**
 * `true` for rows that represent the canonical OUT side of a platform
 * outflow event. For bidirectional types (BONUS / P2P / PURCHASE) we
 * require `direction === 'out'` so each event counts once. For
 * single-direction OUT types (PAYOUT_BANK), the row is its own canonical
 * representative.
 */
function isPlatformOutRow(t: Transaction): boolean {
  if (PLATFORM_OUT_TIPOS_SINGLEDIR.has(t.tipo)) return true;
  if (PLATFORM_OUT_TIPOS_BIDIRECTIONAL.has(t.tipo)) return t.direction === "out";
  return false;
}

/**
 * `true` for rows that represent the canonical event row — i.e. either the
 * inflow row or the OUT side of an outflow. The IN-side mirror of
 * bidirectional outflows + any non-platform-flow row (FEE / REFUND /
 * CREDIT_ADJUSTMENT / TREASURY / UKNOWN / OTRO) is excluded so that
 * counters / shares / status ratios are computed over EVENTS, not rows.
 *
 * Non-classified types (FEE, REFUND, CREDIT_ADJUSTMENT, TREASURY, UKNOWN,
 * OTRO) are NOT counted as canonical events — they're operational
 * artifacts, not user-flow events. They appear in row-level pass-throughs
 * (the donut "Otros" bucket if their count is large enough) but don't
 * inflate the volumen / status / users headline.
 */
function isCanonicalEventRow(t: Transaction): boolean {
  return isPlatformInRow(t) || isPlatformOutRow(t);
}

// --- v2 Output types --------------------------------------------------------

/**
 * v2 headline KPIs for /inicio (INI-V2-01 + INI-V2-02).
 *
 * Plan 10-04 fix: counters are now over CANONICAL EVENT rows
 * (`isCanonicalEventRow`) — bidirectional types (BONUS / P2P / PURCHASE)
 * count once on their OUT side. Volumen splits use TIPO-based
 * classification: IN ≡ PAYIN_*, OUT ≡ PAYOUT_BANK + bidirectional-OUT.
 *
 * Volumen sums are restricted to `status === 'completed'` — rejected
 * transactions did not move money, and the headline KPI should answer
 * "how much money actually flowed" not "how much was attempted."
 */
export interface InicioSummaryV2 {
  /**
   * DISTINCT tikintag count across the FILTERED input rows (period +
   * empresa scope) — answers "¿cuántos tikintags estuvieron activos en el
   * período mostrado?". Counted over ALL rows in the filtered scope (any
   * direction, any status, any tipo) — a user appearing in a rejected row
   * still counts as "active".
   */
  usuariosActivos: number;
  /**
   * DISTINCT tikintag count across the FULL transaction pool (NO period /
   * empresa filter; only direction!=='OTRO_DIRECTION' and a non-empty
   * tikintag). Mirrors `aggregateRechargeAdoption.totalUsers` — the
   * "alcance histórico" denominator. PRD baseline reading: 235 distinct
   * tikintags over the full BD_Plataforma universe.
   *
   * Surfaced so the leaf KPI can render an "X / Y usuarios totales"
   * caption — the gap between the two reveals reactivation opportunity.
   */
  usuariosTotal: number;
  /**
   * Sum of `Math.abs(monto)` across rows where `isPlatformInRow(t)` AND
   * `status === 'completed'` (INI-V2-01). I.e. recargas only.
   */
  volumenIn: number;
  /**
   * Sum of `Math.abs(monto)` across rows where `isPlatformOutRow(t)` AND
   * `status === 'completed'` — i.e. PAYOUT_BANK + (BONUS/P2P/PURCHASE on
   * the OUT side).
   */
  volumenOut: number;
  /**
   * Count of CANONICAL EVENT rows with `status === 'completed'`.
   * Numerator for `successRate`. Each bidirectional event counts once.
   */
  countCompleted: number;
  /**
   * Count of CANONICAL EVENT rows with `status === 'rejected'`.
   * BD_Plataforma uses `rejected` for failures; the v2 KPI label reads
   * "fallidas" for clarity.
   */
  countFailed: number;
  /**
   * Count of CANONICAL EVENT rows with `status === 'OTRO_STATUS'` —
   * defensive for any future pending-like state. Currently 0 in
   * production (Phase 2 schema only sees `completed` + `rejected`).
   */
  countInProgress: number;
  /**
   * Total CANONICAL EVENT rows = countCompleted + countFailed +
   * countInProgress. Denominator for `successRate`.
   */
  total: number;
  /** `countCompleted / total`; zero-safe `0` when total === 0. */
  successRate: number;
}

/**
 * One bucket of the donut-by-tipo distribution (INI-V2-03 + INI-V2-04).
 *
 * `tipo` is typed as `string` (NOT `TransactionType`) so the rolled-up
 * `"Otros"` literal can sit alongside the typed enum values. Same pattern
 * as `BancoStats.medium` (`payouts.ts:278`) where the medium union is
 * widened to allow the rolled-up tail bucket.
 */
export interface TransactionTypeBucket {
  /** Either a literal `TransactionType` value OR `"Otros"` for the rolled-up tail. */
  tipo: string;
  /** Count of rows in this bucket — each platform event counted once. */
  count: number;
  /** `count / total` (0..1); zero-safe `0` when total === 0. */
  share: number;
}

// --- v2 Filter --------------------------------------------------------------

/**
 * Apply the Inicio v2 default filter contract to a list of transactions.
 *
 * Filter semantics (mirror of `filterPayoutsV2` at `payouts.ts:508-532`):
 *   1. Status: state-UNFILTERED by default (BOTH `completed` and
 *      `rejected` flow through). When `filters.status` is non-empty (CSV
 *      multi-select per CROSS-V2-01): narrow to that Set.
 *   2. Tipo: when `filters.tipo` is non-empty: narrow to that Set.
 *   3. Bogotá-anchored from/to (inclusive ends).
 *   4. Optional `empresa` filter — keep only rows where
 *      `t.empresa_id === filters.empresa`.
 *   5. Direction: BOTH `in` and `out` allowed. Skip ONLY
 *      `direction === 'OTRO_DIRECTION'` defensively.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * Cross-cut nature (vs siblings): /inicio v2 is the one tab where ALL
 * tipos AND BOTH directions are in scope by default. Downstream
 * aggregations classify rows into IN / OUT / canonical-event using the
 * TIPO-based helpers above — the filter is INTENTIONALLY broad to keep
 * a single filter pass feeding all four aggregations.
 */
export function filterInicioV2(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;
  const statusSet =
    filters.status && filters.status.length > 0
      ? new Set<string>(filters.status)
      : undefined;
  const tipoSet =
    filters.tipo && filters.tipo.length > 0
      ? new Set<string>(filters.tipo)
      : undefined;

  return transactions.filter((t) => {
    if (t.direction === "OTRO_DIRECTION") return false;
    if (statusSet && !statusSet.has(t.status)) return false;
    if (tipoSet && !tipoSet.has(t.tipo)) return false;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && t.empresa_id !== empresa) return false;

    return true;
  });
}

// --- v2 KPI summary ---------------------------------------------------------

/**
 * Compute the v2 Inicio headline KPIs from the FILTERED list (INI-V2-01 +
 * INI-V2-02).
 *
 * Why `usuariosTotal` is injected from the caller (not derived here):
 *   `allTx` (post-Zod) is missing 2 tikintags that only appear in rows
 *   rejected by the schema (empty `transaction_id`). The user-facing
 *   "alcance histórico" baseline is 235 distinct values in column A of
 *   BD_Plataforma; computing from `allTx` returns 233. The caller fetches
 *   the canonical pool size via `getCachedAllTikintags()` (a raw column
 *   read that bypasses Zod) and passes the number through.
 *
 *   - Counters are over CANONICAL EVENT rows — bidirectional types
 *     (BONUS / P2P / PURCHASE) count once on the OUT side.
 *   - Volumen sums restricted to `status === 'completed'` (rejected ≠
 *     moved money).
 *   - `volumenIn` = sum `Math.abs(monto)` over `isPlatformInRow` AND
 *     `status='completed'`. PAYIN_* in BD_Plataforma are positive monto in
 *     practice; `Math.abs` is defensive consistency with the OUT side.
 *   - `volumenOut` = sum `Math.abs(monto)` over `isPlatformOutRow` AND
 *     `status='completed'`. BD_Plataforma stores OUT montos as negative;
 *     `Math.abs` recovers the gross value.
 *
 * Single-pass reduce over `filteredRows`. Pure. Empty inputs → all zeros,
 * `successRate: 0`.
 */
export function summarizeInicioV2(
  filteredRows: Transaction[],
  usuariosTotalPool: number,
): InicioSummaryV2 {
  let volumenIn = 0;
  let volumenOut = 0;
  let countCompleted = 0;
  let countFailed = 0;
  let countInProgress = 0;
  const filteredTikintagSet = new Set<string>();

  for (const t of filteredRows) {
    if (t.tikintag) filteredTikintagSet.add(t.tikintag);

    // Status counters + total — over canonical event rows only, so each
    // bidirectional event contributes exactly one (the OUT side).
    if (!isCanonicalEventRow(t)) continue;

    if (t.status === "completed") countCompleted += 1;
    else if (t.status === "rejected") countFailed += 1;
    else if (t.status === "OTRO_STATUS") countInProgress += 1;

    // Volumen — restricted to completed (rejected ≠ money moved).
    if (t.status === "completed") {
      if (isPlatformInRow(t)) {
        volumenIn += Math.abs(t.monto);
      } else if (isPlatformOutRow(t)) {
        volumenOut += Math.abs(t.monto);
      }
    }
  }

  const total = countCompleted + countFailed + countInProgress;
  const successRate = total > 0 ? countCompleted / total : 0;

  return {
    usuariosActivos: filteredTikintagSet.size,
    usuariosTotal: usuariosTotalPool,
    volumenIn,
    volumenOut,
    countCompleted,
    countFailed,
    countInProgress,
    total,
    successRate,
  };
}

// --- v2 Tipo distribution (top-N + Otros rollup) ---------------------------

/**
 * Group an already-filtered list by `tipo` and return a top-N + "Otros"
 * rollup distribution (INI-V2-03 + INI-V2-04).
 *
 * Plan 10-04 fix: counts each EVENT once. For bidirectional types
 * (BONUS / P2P / PURCHASE) only the OUT side contributes; for IN types
 * (PAYIN_*) and single-direction OUT (PAYOUT_BANK) the row is its own
 * representative. Non-classified types (FEE / REFUND / CREDIT_ADJUSTMENT
 * / TREASURY / UKNOWN / OTRO) flow through with their natural row count.
 *
 * Algorithm:
 *   1. Iterate filtered rows; per row, decide whether it's COUNTABLE:
 *        - canonical event row → count (1 per event by definition above)
 *        - non-classified type → count (1 per row; these have no
 *          bidirectional pattern, so 1 row = 1 event)
 *        - IN-side mirror of bidirectional event (BONUS-in / P2P-in /
 *          PURCHASE-in) → SKIP (already counted on the OUT side)
 *   2. Group countable rows by `tipo` into a count Map.
 *   3. Sort groups DESC by count (ties broken by `tipo` lexicographic
 *      ASC for determinism across renders).
 *   4. If `groups.length <= n`: return all groups (no "Otros" bucket).
 *   5. Else: top-N kept verbatim, remaining tail rolled up as a single
 *      `{ tipo: "Otros", count: sum, share: ... }` bucket.
 *   6. Each bucket's `share = count / total` over countable rows.
 *
 * Empty input → `[]`.
 *
 * Pure.
 */
export function aggregateTransactionTypeDistribution(
  transactions: Transaction[],
  n = 6,
): TransactionTypeBucket[] {
  if (transactions.length === 0) return [];

  // Group by tipo, but skip the IN-side mirror of bidirectional events
  // (those would double-count on top of their canonical OUT row).
  const counts = new Map<TransactionType, number>();
  let total = 0;
  for (const t of transactions) {
    if (
      PLATFORM_OUT_TIPOS_BIDIRECTIONAL.has(t.tipo) &&
      t.direction !== "out"
    ) {
      // BONUS-in / P2P-in / PURCHASE-in — same event as a corresponding
      // OUT row that we'll count instead. Skip.
      continue;
    }
    counts.set(t.tipo, (counts.get(t.tipo) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return [];

  // Sort groups DESC by count; ties broken by tipo lexicographic ASC.
  const sorted = Array.from(counts.entries()).sort((a, b) =>
    b[1] !== a[1] ? b[1] - a[1] : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );

  if (sorted.length <= n) {
    return sorted.map(([tipo, count]) => ({
      tipo,
      count,
      share: count / total,
    }));
  }

  // Top-N + Otros tail rollup
  const top = sorted.slice(0, n);
  const tail = sorted.slice(n);
  const otrosCount = tail.reduce((acc, [, c]) => acc + c, 0);

  const buckets: TransactionTypeBucket[] = top.map(([tipo, count]) => ({
    tipo,
    count,
    share: count / total,
  }));
  buckets.push({
    tipo: "Otros",
    count: otrosCount,
    share: otrosCount / total,
  });
  return buckets;
}

// --- v2 Activity time series (distinct tikintag + IN/OUT volumen) ----------

/**
 * One point on the v2 activity time series chart (INI-V2-05).
 *
 * Plan 10-04 fix: replaced single signed `volumen` with split
 * `volumenIn` + `volumenOut` (both positive sums of `Math.abs(monto)`,
 * restricted to `status === 'completed'` per the same rule as
 * `summarizeInicioV2`).
 *
 * Daily and weekly variants share this shape. The v2 chart renders
 * `usuariosActivos` (left axis, integer) and the two volumen series
 * (right axis, COP) over the same x-axis.
 */
export interface ActivityPointV2 {
  /** `YYYY-MM-DD` for daily granularity, `RRRR-Www` for weekly. */
  bucket: string;
  /**
   * DISTINCT tikintag count in this bucket (a single tikintag with N
   * transactions in one day/week counts as 1 active user, NOT N).
   * Counted over ALL filtered rows in the bucket (any direction, any
   * status, any tipo) — same liberal definition as `usuariosActivos` on
   * the headline KPI.
   */
  usuariosActivos: number;
  /**
   * Sum of `Math.abs(monto)` over rows where `isPlatformInRow(t)` AND
   * `status === 'completed'` (recargas — PAYIN_*).
   */
  volumenIn: number;
  /**
   * Sum of `Math.abs(monto)` over rows where `isPlatformOutRow(t)` AND
   * `status === 'completed'` (PAYOUT_BANK + BONUS/P2P/PURCHASE on the
   * OUT side).
   */
  volumenOut: number;
}

/**
 * Group transactions by Bogotá calendar date and emit one point per
 * non-empty bucket (INI-V2-05 daily granularity).
 *
 * Plan 10-04 fix: emits split `volumenIn` + `volumenOut` per bucket
 * (each `Math.abs(monto)` over completed canonical rows of the
 * respective direction). Same Set-per-bucket dedup for tikintags.
 *
 * NO zero-fill — Recharts continuous-axis spacing handles missing days.
 *
 * Output sorted ASCENDING by `bucket` (string-sortable since
 * `YYYY-MM-DD` is lexicographically chronological). Empty input → `[]`.
 *
 * Pure.
 */
export function aggregateActivityByDateV2(
  transactions: Transaction[],
): ActivityPointV2[] {
  const byBucket = new Map<
    string,
    { tikintags: Set<string>; volumenIn: number; volumenOut: number }
  >();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "yyyy-MM-dd");
    let acc = byBucket.get(bucket);
    if (!acc) {
      acc = { tikintags: new Set<string>(), volumenIn: 0, volumenOut: 0 };
      byBucket.set(bucket, acc);
    }
    if (t.tikintag) acc.tikintags.add(t.tikintag);
    if (t.status === "completed") {
      if (isPlatformInRow(t)) acc.volumenIn += Math.abs(t.monto);
      else if (isPlatformOutRow(t)) acc.volumenOut += Math.abs(t.monto);
    }
  }
  return Array.from(byBucket, ([bucket, acc]) => ({
    bucket,
    usuariosActivos: acc.tikintags.size,
    volumenIn: acc.volumenIn,
    volumenOut: acc.volumenOut,
  })).sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

/**
 * ISO-week variant of `aggregateActivityByDateV2` (INI-V2-05 weekly
 * granularity).
 *
 * Bucket format `RRRR-'W'II` (e.g. `2026-W18`). Using `RRRR` (ISO
 * week-numbering year) instead of `yyyy` (calendar year) avoids
 * mis-bucketing ~5 days per year (e.g. 2024-12-30 / 2024-12-31 are in
 * 2025-W01).
 *
 * NO zero-fill. Sorted ASCENDING by `bucket`. Empty input → `[]`.
 *
 * Pure.
 */
export function aggregateActivityByWeekV2(
  transactions: Transaction[],
): ActivityPointV2[] {
  const byBucket = new Map<
    string,
    { tikintags: Set<string>; volumenIn: number; volumenOut: number }
  >();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "RRRR-'W'II");
    let acc = byBucket.get(bucket);
    if (!acc) {
      acc = { tikintags: new Set<string>(), volumenIn: 0, volumenOut: 0 };
      byBucket.set(bucket, acc);
    }
    if (t.tikintag) acc.tikintags.add(t.tikintag);
    if (t.status === "completed") {
      if (isPlatformInRow(t)) acc.volumenIn += Math.abs(t.monto);
      else if (isPlatformOutRow(t)) acc.volumenOut += Math.abs(t.monto);
    }
  }
  return Array.from(byBucket, ([bucket, acc]) => ({
    bucket,
    usuariosActivos: acc.tikintags.size,
    volumenIn: acc.volumenIn,
    volumenOut: acc.volumenOut,
  })).sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

// --- v2 Top users by volume (grouped by tikintag, NOT empresa) -------------

/**
 * One row of the top-users-by-volume ranking (INI-V2-06).
 *
 * Plan 10-04 fix: ranking key is now `volumenOut` DESC (NOT `volumenNeto`)
 * — the operative-lens framing answers "who moves the most money out of
 * their Tikin wallet?" (purchases + payouts + bonos sent + p2p sent).
 * Heavy spenders/movers surface at the top; the secondary `volumenIn`
 * column shows their inflow context.
 *
 * Grouped by `tikintag` (the user) NOT by `empresa_id` — same convention
 * as TopRecharger / TopCardUser / TopEmisores / TopReceptores.
 */
export interface TopUserVolumeRow {
  /** Ranking key: the user's tikintag. */
  tikintag: string;
  /**
   * Best-effort empresa label (first observed `empresa_nombre` for this
   * tikintag).
   */
  empresa: string | undefined;
  /**
   * Sum of `Math.abs(monto)` across `isPlatformInRow(t)` rows for this
   * tikintag (recargas — PAYIN_*). Restricted to `status === 'completed'`.
   * Defensive `Math.abs` keeps the column positive even if a future
   * schema drift introduces signed in-row montos.
   */
  volumenIn: number;
  /**
   * Sum of `Math.abs(monto)` across `isPlatformOutRow(t)` rows for this
   * tikintag (PAYOUT_BANK + BONUS/P2P/PURCHASE on the OUT side).
   * Restricted to `status === 'completed'`. RANKING KEY for the table.
   */
  volumenOut: number;
  /**
   * Count of CANONICAL EVENT rows for this tikintag (any direction in the
   * platform-flow lens — PAYIN_* + PAYOUT_BANK + bidirectional-OUT — and
   * any status). Each event counts once.
   */
  transacciones: number;
}

/**
 * Top-N tikintags ranked by `volumenOut` DESC (INI-V2-06).
 *
 * Algorithm:
 *   1. Group rows by `tikintag` into accumulator Map. Per group:
 *      - For platform-IN rows with status='completed':
 *        `volumenIn += Math.abs(monto)`.
 *      - For platform-OUT rows with status='completed':
 *        `volumenOut += Math.abs(monto)`.
 *      - For canonical event rows (any status): increment `transacciones`.
 *      - Capture first-observed `empresa_nombre` (first-occurrence-wins).
 *   2. Sort DESC by `volumenOut`. Deterministic tiebreak: then DESC by
 *      `volumenIn` (between two equal-spenders, the bigger receiver wins);
 *      then DESC by `transacciones`; then `tikintag` lexicographic ASC.
 *   3. Slice to top `limit`.
 *
 * Rows where `tikintag` is empty/falsy are skipped — defensive.
 * Rows that are NOT canonical event rows (IN-side mirror of bidirectional
 * events, FEE / REFUND / CREDIT_ADJUSTMENT / TREASURY / UKNOWN / OTRO) are
 * skipped — they're not the user's flow.
 *
 * Pure. Empty input → `[]`.
 */
export function aggregateTopUsersByVolume(
  transactions: Transaction[],
  limit = 10,
): TopUserVolumeRow[] {
  const acc = new Map<string, TopUserVolumeRow>();
  for (const t of transactions) {
    if (!t.tikintag) continue;
    if (!isCanonicalEventRow(t)) continue;

    let row = acc.get(t.tikintag);
    if (!row) {
      row = {
        tikintag: t.tikintag,
        empresa: t.empresa_nombre || undefined,
        volumenIn: 0,
        volumenOut: 0,
        transacciones: 0,
      };
      acc.set(t.tikintag, row);
    }
    row.transacciones += 1;
    if (t.status === "completed") {
      if (isPlatformInRow(t)) {
        row.volumenIn += Math.abs(t.monto);
      } else if (isPlatformOutRow(t)) {
        row.volumenOut += Math.abs(t.monto);
      }
    }
  }

  const ranked = Array.from(acc.values());
  ranked.sort((a, b) => {
    if (b.volumenOut !== a.volumenOut) return b.volumenOut - a.volumenOut;
    if (b.volumenIn !== a.volumenIn) return b.volumenIn - a.volumenIn;
    if (b.transacciones !== a.transacciones)
      return b.transacciones - a.transacciones;
    return a.tikintag < b.tikintag ? -1 : a.tikintag > b.tikintag ? 1 : 0;
  });
  return ranked.slice(0, limit);
}
