/**
 * Inicio domain — pure aggregations over `Transaction[]` for the /inicio
 * v2 operative-lens cockpit (Phase 10 — Plans 10-01 + 10-02).
 *
 * This module owns the v2 cross-cutting Inicio aggregations:
 *   - filterInicioV2 — cross-cut filter (state-UNFILTERED + CSV-status +
 *     CSV-tipo + Bogotá-anchored from/to + optional empresa; BOTH directions)
 *   - summarizeInicioV2 — operative-lens KPIs (usuariosActivos + IN/OUT
 *     volumen + status counters + successRate)
 *   - aggregateTransactionTypeDistribution — donut data (top-N + Otros rollup)
 *   - aggregateActivityByDateV2 / aggregateActivityByWeekV2 — distinct-tikintag
 *     per bucket time series with signed volumen
 *   - aggregateTopUsersByVolume — top-N tikintag ranking by volumenNeto
 *
 * REQUIREMENTS traceability (milestones/v2.0-REQUIREMENTS.md):
 *   INI-V2-01  usuarios activos (DISTINCT tikintag) + volumen IN/OUT split
 *   INI-V2-02  tasa de éxito global con semáforo (98.1% baseline)
 *   INI-V2-03  donut por tipo (top 6 + Otros) — baseline 98.1% / 1.6% / 0.2%
 *   INI-V2-04  honor filters.tipo when present (cross-cut narrowing)
 *   INI-V2-05  actividad temporal — distinct tikintag por bucket + volumen
 *   INI-V2-06  top N usuarios por volumen NETO grouped by tikintag (NOT empresa)
 *
 * History:
 *   - Plan 04-01..04-07: v1 revenue-lens surface (filterCompletedIn +
 *     summarizeInicio + aggregateGMV* / aggregateActiveEmpresas* + 4 v1
 *     types). DELETED 2026-05-08 in Plan 10-02 — the v2 surface fully
 *     replaces the v1 lens; the v1 inicio-hechos.ts module + 5 v1 leaves
 *     died in the same cohesive prune commit.
 *   - Plan 10-01: v2 surface appended below v1 (coexistence — fifth
 *     instance after bonos / payouts / recargas / cardUsage).
 *   - Plan 10-02: v1 block pruned; v2 surface byte-identical preservation.
 *     /inicio rewritten to consume the v2 surface; v1→v2 milestone migration
 *     end-to-end COMPLETE.
 *
 * Design rules (deliberate, mirror of `bonos.ts:9-22`):
 *   - NO imports from `next/`, `react`, `server-only`, or `lib/sheets/`.
 *     Every function is callable from Server Components, Client
 *     Components, scripts, and (future) tests without setup.
 *   - All functions are pure: same input → same output, no side effects,
 *     no `Date.now()` or `process.env` reads.
 *   - Bogotá is UTC-5 with no DST. Date arithmetic is anchored to the
 *     Bogotá calendar — agreeing with `url-state.ts` and `bonos.ts` on
 *     what "a day" / "a week" means.
 *   - Inline `startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp`
 *     verbatim from `bonos.ts:53-74`. DRY across domain modules costs
 *     more than the inline ~22 lines (Plan 03-02 precedent).
 *   - Empty-input safe across all aggregators. No NaN / Infinity / divide-
 *     by-zero leaking into KPI cards or charts.
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

// --- v2 Output types --------------------------------------------------------

/**
 * v2 headline KPIs for /inicio (INI-V2-01 + INI-V2-02).
 *
 * Computed over a state-UNFILTERED universe so `successRate` denominator =
 * total attempted (completed + rejected + any future OTRO_STATUS); see
 * `summarizePayoutsByState.total` convention from `payouts.ts:557` —
 * defensive against future state additions.
 *
 * Baseline (REQUIREMENTS.md INI-V2-02): 98.1% completed / 1.6% rejected /
 * 0.2% in_progress over the BD_Plataforma full universe — semáforo verde.
 */
export interface InicioSummaryV2 {
  /** DISTINCT tikintag count across the input rows (INI-V2-01). */
  usuariosActivos: number;
  /** Sum of `monto` across rows where `direction === 'in'` (INI-V2-01). */
  volumenIn: number;
  /**
   * Sum of `Math.abs(monto)` across rows where `direction === 'out'`.
   * BD_Plataforma stores PURCHASE / PAYOUT / out-bound montos as negatives;
   * `Math.abs` matches the `summarizePurchases` convention at
   * `cardUsage.ts:213` (gross spend, not net).
   */
  volumenOut: number;
  /** Count of `status === 'completed'` rows (INI-V2-02 numerator). */
  countCompleted: number;
  /**
   * Count of `status === 'rejected'` rows. BD_Plataforma uses `rejected`
   * for failures (see `types.ts:63`); surfaced as `countFailed` in v2 for
   * UX clarity — the headline KPI label reads "fallidas" not "rechazadas".
   */
  countFailed: number;
  /**
   * Count of `status === 'OTRO_STATUS'` rows — defensive: any future
   * pending-like state captured live falls here. Currently 0 in
   * production (Phase 2 schema only sees `completed` + `rejected`).
   */
  countInProgress: number;
  /**
   * `rows.length` — denominator for successRate. Mirrors
   * `summarizePayoutsByState.total = payouts.length` (payouts.ts:557): if
   * a future state lands the three named counters underrepresent, but the
   * total stays correct.
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
  /** Count of rows in this bucket. */
  count: number;
  /** `count / total` (0..1); zero-safe `0` when total === 0. */
  share: number;
}

// --- v2 Filter --------------------------------------------------------------

/**
 * Apply the Inicio v2 default filter contract to a list of transactions.
 *
 * Filter semantics (mirror of `filterPayoutsV2` at `payouts.ts:508-532` —
 * the established v2-CSV-status pattern):
 *   1. Status: state-UNFILTERED by default (BOTH `completed` and
 *      `rejected` flow through so `summarizeInicioV2` can compute
 *      `successRate` from a single input). When `filters.status` is
 *      non-empty (CSV multi-select per CROSS-V2-01): narrow to that Set.
 *   2. Tipo: when `filters.tipo` is non-empty (CSV multi-select per
 *      CROSS-V2-02): narrow to that Set. INI-V2-04 — the donut-by-tipo
 *      is over the FULL type universe by default; the URL filter narrows
 *      everything if present.
 *   3. Bogotá-anchored from/to (inclusive ends) — uses local helpers
 *      `startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp`.
 *   4. Optional `empresa` filter (cliente-foco): when set, keep only
 *      rows where `t.empresa_id === filters.empresa`.
 *   5. Direction: BOTH `in` and `out` allowed (the cross-cut answer to
 *      "platform-wide health"). Skip ONLY `direction === 'OTRO_DIRECTION'`
 *      defensively — keeps the IN/OUT split sums clean if a future Sheet
 *      edit introduces a third value.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * Cross-cut nature (vs siblings): /inicio v2 is the one tab where ALL
 * tipos AND BOTH directions are in scope by default (it's the "operative
 * health" page — operators want to see PURCHASE-out alongside BONUS-in
 * alongside PAYOUT_BANK-out etc.). Other v2 tabs hard-pin their tipo
 * (BONUS / PURCHASE / PAYIN_*) — this one does not.
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
 * Compute the v2 Inicio headline KPIs from an already-filtered list
 * (INI-V2-01 + INI-V2-02).
 *
 * Single-pass reduce — no intermediate arrays. For each row:
 *   - Increment IN/OUT volumen per `direction` (out montos taken absolute
 *     so the headline volumen is gross-flow, not net).
 *   - Increment status counter (`countCompleted` / `countFailed` /
 *     `countInProgress`) per `status`.
 *   - Add `tikintag` to a Set for `usuariosActivos` distinct count.
 *
 * Pure. Empty input → all zeros, `successRate: 0` (no NaN / Infinity).
 *
 * Baseline (PRD v2 INI-V2-02): 98.1% / 1.6% / 0.2% — semáforo verde over
 * the global universe; per-period readings vary with the URL filter.
 *
 * @example
 *   summarizeInicioV2([
 *     { direction: 'in',  status: 'completed', monto:  100000, tikintag: '$a', ... },
 *     { direction: 'out', status: 'completed', monto: -50000,  tikintag: '$b', ... },
 *     { direction: 'in',  status: 'rejected',  monto:  25000,  tikintag: '$a', ... },
 *   ])
 *   // → { usuariosActivos: 2, volumenIn: 125000, volumenOut: 50000,
 *   //     countCompleted: 2, countFailed: 1, countInProgress: 0,
 *   //     total: 3, successRate: 0.667 }
 */
export function summarizeInicioV2(
  transactions: Transaction[],
): InicioSummaryV2 {
  let volumenIn = 0;
  let volumenOut = 0;
  let countCompleted = 0;
  let countFailed = 0;
  let countInProgress = 0;
  const tikintagSet = new Set<string>();

  for (const t of transactions) {
    if (t.direction === "in") {
      volumenIn += t.monto;
    } else if (t.direction === "out") {
      volumenOut += Math.abs(t.monto);
    }

    if (t.status === "completed") countCompleted += 1;
    else if (t.status === "rejected") countFailed += 1;
    else if (t.status === "OTRO_STATUS") countInProgress += 1;

    if (t.tikintag) tikintagSet.add(t.tikintag);
  }

  const total = transactions.length;
  const successRate = total > 0 ? countCompleted / total : 0;

  return {
    usuariosActivos: tikintagSet.size,
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
 * Algorithm:
 *   1. Group rows by `tipo` into a count Map.
 *   2. Sort groups DESC by count (ties broken by `tipo` lexicographic ASC
 *      for determinism across renders).
 *   3. If `groups.length <= n`: return all groups (no "Otros" bucket).
 *   4. Else: top-N kept verbatim, remaining tail rolled up as a single
 *      `{ tipo: "Otros", count: sum, share: ... }` bucket (mirror of the
 *      `aggregateTopBancos` Otros-rollup pattern from `payouts.ts`).
 *   5. Each bucket's `share = count / total`, where `total = transactions.length`
 *      (the denominator is the FULL filtered input, not the visible-N
 *      slice — so visible shares always sum to ≤ 1.0 and the Otros share
 *      makes them sum to exactly 1.0).
 *
 * Empty input → `[]` (no point emitting an "Otros: 0" placeholder).
 *
 * Sorting in the final output: DESC by count keeps the ranking
 * deterministic; the Otros bucket — when present — naturally sits at the
 * tail because top-N already ranked higher; ties broken by `tipo`
 * lexicographic ASC.
 *
 * Baseline (PRD v2 INI-V2-03 — donut over completed-in BD_Plataforma):
 *   PAYIN_PSE / PAYIN_TRANSFER / BONUS / P2P / PAYOUT_BANK / PURCHASE +
 *   Otros tail (CREDIT_ADJUSTMENT, FEE, REFUND, TREASURY, UKNOWN, OTRO).
 *   Default n=6 picks up the 6 most frequent tipos in production.
 *
 * Pure. Returns a new array; does not mutate input.
 *
 * @example
 *   aggregateTransactionTypeDistribution([
 *     { tipo: 'BONUS', ... }, { tipo: 'BONUS', ... }, { tipo: 'P2P', ... },
 *     { tipo: 'FEE', ... }, { tipo: 'REFUND', ... }, { tipo: 'TREASURY', ... },
 *     { tipo: 'UKNOWN', ... },
 *   ], 3)
 *   // → [
 *   //   { tipo: 'BONUS', count: 2, share: 0.286 },
 *   //   { tipo: 'FEE',   count: 1, share: 0.143 },
 *   //   { tipo: 'P2P',   count: 1, share: 0.143 },
 *   //   { tipo: 'Otros', count: 3, share: 0.429 },  // REFUND + TREASURY + UKNOWN
 *   // ]
 */
export function aggregateTransactionTypeDistribution(
  transactions: Transaction[],
  n = 6,
): TransactionTypeBucket[] {
  const total = transactions.length;
  if (total === 0) return [];

  // Group by tipo
  const counts = new Map<TransactionType, number>();
  for (const t of transactions) {
    counts.set(t.tipo, (counts.get(t.tipo) ?? 0) + 1);
  }

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

// --- v2 Activity time series (distinct tikintag + signed volumen) -----------

/**
 * One point on the v2 activity time series chart (INI-V2-05).
 *
 * Daily and weekly variants share this shape. The v2 chart renders BOTH
 * series over the same x-axis (a single line for `usuariosActivos`, an
 * area / dashed companion for `volumen`) so a single output type carries
 * both streams.
 */
export interface ActivityPointV2 {
  /** `YYYY-MM-DD` for daily granularity, `RRRR-Www` for weekly. */
  bucket: string;
  /**
   * DISTINCT tikintag count in this bucket (a single tikintag with N
   * transactions in one day/week counts as 1 active user, NOT N).
   * Set-per-bucket dedup convention.
   */
  usuariosActivos: number;
  /**
   * Signed sum of `monto` across the bucket's rows (positives + negatives).
   * The operator-relevant question is "what's the net flow today?"; the
   * v2 page renders this as a single line, NOT a per-direction split
   * (the IN/OUT split lives in the headline KPIs from `summarizeInicioV2`).
   * Negative values are valid (a day where outflows exceeded inflows).
   */
  volumen: number;
}

/**
 * Group transactions by Bogotá calendar date and emit one point per
 * non-empty bucket, with distinct-tikintag count + signed volumen sum
 * (INI-V2-05 daily granularity).
 *
 * Set-per-bucket dedup: a tikintag with multiple transactions in one day
 * counts as 1 active user (Pitfall 11) — keyed by `tikintag`.
 *
 * Volumen is the signed sum (no `Math.abs`): the v2 chart line answers
 * "what's the net flow that day?", not "how much money moved through?".
 *
 * NO zero-fill — Recharts continuous-axis spacing handles missing days.
 *
 * Output sorted ASCENDING by `bucket` (string-sortable since
 * `YYYY-MM-DD` is lexicographically chronological). Empty input → `[]`.
 *
 * Pure: returns a new array; does not mutate input.
 */
export function aggregateActivityByDateV2(
  transactions: Transaction[],
): ActivityPointV2[] {
  const byBucket = new Map<
    string,
    { tikintags: Set<string>; volumen: number }
  >();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "yyyy-MM-dd");
    let acc = byBucket.get(bucket);
    if (!acc) {
      acc = { tikintags: new Set<string>(), volumen: 0 };
      byBucket.set(bucket, acc);
    }
    if (t.tikintag) acc.tikintags.add(t.tikintag);
    acc.volumen += t.monto;
  }
  return Array.from(byBucket, ([bucket, acc]) => ({
    bucket,
    usuariosActivos: acc.tikintags.size,
    volumen: acc.volumen,
  })).sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

/**
 * ISO-week variant of `aggregateActivityByDateV2` (INI-V2-05 weekly
 * granularity). Same Set-per-bucket dedup contract — Pitfall 11 closed
 * at week granularity too.
 *
 * Bucket format `RRRR-'W'II` (e.g. `2026-W18`). Using `RRRR` (ISO
 * week-numbering year) instead of `yyyy` (calendar year) avoids
 * mis-bucketing ~5 days per year (e.g. 2024-12-30 / 2024-12-31 are in
 * 2025-W01).
 *
 * NO zero-fill. Sorted ASCENDING by `bucket` (string-sortable since
 * `RRRR-Www` is lexicographically chronological). Empty input → `[]`.
 *
 * Pure.
 */
export function aggregateActivityByWeekV2(
  transactions: Transaction[],
): ActivityPointV2[] {
  const byBucket = new Map<
    string,
    { tikintags: Set<string>; volumen: number }
  >();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "RRRR-'W'II");
    let acc = byBucket.get(bucket);
    if (!acc) {
      acc = { tikintags: new Set<string>(), volumen: 0 };
      byBucket.set(bucket, acc);
    }
    if (t.tikintag) acc.tikintags.add(t.tikintag);
    acc.volumen += t.monto;
  }
  return Array.from(byBucket, ([bucket, acc]) => ({
    bucket,
    usuariosActivos: acc.tikintags.size,
    volumen: acc.volumen,
  })).sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

// --- v2 Top users by volume (grouped by tikintag, NOT empresa) -------------

/**
 * One row of the top-users-by-volume ranking (INI-V2-06).
 *
 * Grouped by `tikintag` (the user) NOT by `empresa_id`. This is the
 * explicit v1→v2 user-lens shift catalogued in STATE.md (Plan 08-04
 * — "tikintag is the canonical user identity at v2 ranking layer").
 * Joins the family of v2 user-lens rankings:
 *   - Bonos TopEmisores  / TopReceptores  (sourceTransferTikintag / dest...)
 *   - Uso Tarjeta TopCardUsers           (tikintag)
 *   - Recargas TopRechargers             (tikintag)
 *   - Inicio TopUsersByVolume            (tikintag) ← this one
 *
 * The `empresa` column is shown as a denormalized label for table
 * display (the user's first observed `empresa_nombre`), NOT the
 * ranking key — same convention as `TopRecharger.empresa` in
 * `recargas.ts:371` and `TopCardUser.empresa` in `cardUsage.ts:124`.
 */
export interface TopUserVolumeRow {
  /** Ranking key: the user's tikintag. */
  tikintag: string;
  /**
   * Best-effort empresa label (first observed `empresa_nombre` for this
   * tikintag). Today (Phase 2 default) `empresa_nombre === tikintag` so
   * this field is always populated; type stays `string | undefined`
   * defensively for the eventual schema evolution where empresa becomes
   * a separate display column.
   */
  empresa: string | undefined;
  /**
   * Sum of `monto` across `direction === 'in'` rows for this tikintag
   * (gross inflows; positives only by direction-sign convention).
   */
  volumenIn: number;
  /**
   * Sum of `Math.abs(monto)` across `direction === 'out'` rows for this
   * tikintag (gross outflows; abs because BD_Plataforma stores out
   * montos as negative — same convention as `summarizePurchases` and
   * `summarizeInicioV2.volumenOut`).
   */
  volumenOut: number;
  /**
   * `volumenIn - volumenOut` — the RANKING KEY per INI-V2-06. The
   * operator-relevant headline is "net activity": positive = net
   * receiver (more inflow than outflow), negative = net spender. Both
   * extremes are interesting at the top of a ranking; the v2 page can
   * sort the table by abs(volumenNeto) at the leaf if it wants the
   * "most active in either direction" framing, or keep DESC by signed
   * neto for the "biggest net receivers" framing.
   */
  volumenNeto: number;
  /** Count of rows for this tikintag (any direction, any status). */
  transacciones: number;
}

/**
 * Top-N tikintags ranked by `volumenNeto` DESC (INI-V2-06).
 *
 * Algorithm:
 *   1. Group rows by `tikintag` into accumulator Map. Per group:
 *      - Sum `monto` per direction (`in` → volumenIn,
 *        `out` → volumenOut via `Math.abs`).
 *      - Increment `transacciones` on every row regardless of direction
 *        / status (this is the "how active is this user" headline,
 *        complementing the ranking key).
 *      - Capture first-observed `empresa_nombre` (first-occurrence-wins).
 *   2. Compute `volumenNeto = volumenIn - volumenOut` per tikintag.
 *   3. Sort DESC by `volumenNeto`. Deterministic tiebreak: then DESC
 *      by `transacciones`, then `tikintag` lexicographic ASC.
 *   4. Slice to top `limit`.
 *
 * Rows where `tikintag` is empty/falsy are skipped — defensive: a
 * peer-less row cannot be attributed to a user.
 *
 * Pure. Empty input → `[]`. O(n + k log k) where k = distinct tikintags.
 *
 * @example
 *   aggregateTopUsersByVolume([
 *     { tikintag: '$alice', direction: 'in',  monto:  100000, ... },
 *     { tikintag: '$alice', direction: 'out', monto: -25000,  ... },
 *     { tikintag: '$bob',   direction: 'in',  monto:  50000,  ... },
 *   ], 5)
 *   // → [
 *   //   { tikintag: '$alice', volumenIn: 100000, volumenOut: 25000,
 *   //     volumenNeto: 75000, transacciones: 2, empresa: '$alice' },
 *   //   { tikintag: '$bob',   volumenIn:  50000, volumenOut:     0,
 *   //     volumenNeto: 50000, transacciones: 1, empresa: '$bob'   },
 *   // ]
 */
export function aggregateTopUsersByVolume(
  transactions: Transaction[],
  limit = 10,
): TopUserVolumeRow[] {
  const acc = new Map<string, TopUserVolumeRow>();
  for (const t of transactions) {
    if (!t.tikintag) continue;
    let row = acc.get(t.tikintag);
    if (!row) {
      row = {
        tikintag: t.tikintag,
        empresa: t.empresa_nombre || undefined,
        volumenIn: 0,
        volumenOut: 0,
        volumenNeto: 0, // computed in second pass
        transacciones: 0,
      };
      acc.set(t.tikintag, row);
    }
    if (t.direction === "in") {
      row.volumenIn += t.monto;
    } else if (t.direction === "out") {
      row.volumenOut += Math.abs(t.monto);
    }
    row.transacciones += 1;
  }

  const ranked = Array.from(acc.values());
  for (const row of ranked) {
    row.volumenNeto = row.volumenIn - row.volumenOut;
  }
  ranked.sort((a, b) => {
    if (b.volumenNeto !== a.volumenNeto) return b.volumenNeto - a.volumenNeto;
    if (b.transacciones !== a.transacciones)
      return b.transacciones - a.transacciones;
    return a.tikintag < b.tikintag ? -1 : a.tikintag > b.tikintag ? 1 : 0;
  });
  return ranked.slice(0, limit);
}
