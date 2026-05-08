/**
 * Inicio domain — pure aggregations over `Transaction[]` for the /inicio
 * "highlight reel". Phase 4's editorial reading of the business: 5 KPIs
 * with deltas + 2 trend charts + 3 hechos curados.
 *
 * This module owns the cross-cutting Inicio aggregations (cross-cutting
 * because Inicio looks at ALL completed inflows, not just bonuses):
 *   - filterCompletedIn — the default filter contract for Inicio
 *   - summarizeInicio — the 5 headline KPIs (gmv, comision, takeRate,
 *     empresasActivas, bonosVendidos)
 *   - aggregateGMVByDate / aggregateGMVByWeek — the GMV trend chart
 *   - aggregateActiveEmpresasByDate / aggregateActiveEmpresasByWeek —
 *     the "empresas activas en el tiempo" chart (deduped per bucket;
 *     Pitfall 11 closed)
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

// --- Constants --------------------------------------------------------------

/**
 * `transaction_type` value that counts as a "bono vendido" for the
 * Inicio bonosVendidos KPI. Mirror of `bonos.ts:39` so the two tabs
 * agree on what a bono is.
 */
const BONUS_TIPO: TransactionType = "BONUS";

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

// --- Output types -----------------------------------------------------------

/**
 * The 5 headline KPIs of the /inicio tab. Each one will be paired with
 * a delta vs prior period at the page level (Plan 04-05) by computing
 * `summarizeInicio(filterCompletedIn(tx, filters))` and
 * `summarizeInicio(filterCompletedIn(tx, priorFilters))` and feeding
 * `pctChange` from `period.ts`.
 */
export interface InicioSummary {
  /** Gross merchandise value: sum of `monto` across completed inflows. */
  gmv: number;
  /** Sum of `comision` — Tikin's revenue. */
  comision: number;
  /**
   * `comision / gmv` as a fraction 0..1 (zero-safe: returns 0 when
   * `gmv === 0`). Pass to `formatPercent` directly.
   */
  takeRate: number;
  /** Distinct empresa_id count in the filtered set. */
  empresasActivas: number;
  /** Count of `tipo === 'BONUS'` rows in the filtered set. */
  bonosVendidos: number;
}

/**
 * Pair of summaries for the "delta vs prior" KPI cards. `prior === null`
 * when no prior window can be computed (filters lack from/to). Plan
 * 04-05's KPICardsInicio renders an em-dash for delta in that case.
 */
export interface InicioDeltaSummary {
  current: InicioSummary;
  prior: InicioSummary | null;
}

/** One point on the GMV trend chart (line by day or by ISO week). */
export interface GMVPoint {
  /** `YYYY-MM-DD` for daily granularity, `YYYY-Www` (e.g. `2026-W18`) for weekly. */
  bucket: string;
  /** Sum of `monto` across rows that fall in this bucket. */
  value: number;
}

/** One point on the "empresas activas en el tiempo" chart. */
export interface ActiveEmpresaPoint {
  /** `YYYY-MM-DD` for daily, `YYYY-Www` for weekly — same shape as GMVPoint. */
  bucket: string;
  /**
   * Distinct count of `empresa_id` for rows in this bucket. A single
   * empresa with N transactions in one bucket counts as 1 (Pitfall 11).
   */
  count: number;
}

// --- Filtering --------------------------------------------------------------

/**
 * Apply the Inicio default filter contract to a list of transactions.
 *
 * Default filter (the "what counts as activity in Inicio?" definition):
 *   1. `direction === 'in'` — outgoing entries (refunds, etc.) excluded
 *      so GMV is not double-decremented when sales are reversed.
 *   2. `status === 'completed'` — rejected transactions never carried
 *      money. Captured live (Plan 02-01): only `completed` and
 *      `rejected` exist in BD_Plataforma.status.
 *
 * Difference vs `filterBonos`: NO `tipo === 'BONUS'` filter — Inicio
 * aggregates over ALL completed inflows, not just bonuses (CONTEXT.md
 * vision: GMV is total volume, not just bonos). The bonosVendidos KPI
 * is computed inside `summarizeInicio` over the full filtered set.
 *
 * Then applied (in order, AND-combined):
 *   3. `from` filter — `t.fecha >= startOfDay(from)` in Bogotá.
 *      Unparseable `from` → no lower bound.
 *   4. `to` filter — `t.fecha <= endOfDay(to)` in Bogotá. Unparseable
 *      `to` → no upper bound.
 *   5. `empresa` filter — `t.empresa_id === filters.empresa`.
 *      Empty/undefined → no empresa restriction.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * @example
 *   filterCompletedIn(allTransactions, { from: '2026-04-01', to: '2026-04-30' })
 *   // → all completed inflows in April 2026 (BONUS, PAYIN_*, P2P, etc.)
 */
export function filterCompletedIn(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;

  return transactions.filter((t) => {
    if (t.direction !== "in") return false;
    if (t.status !== "completed") return false;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && t.empresa_id !== empresa) return false;

    return true;
  });
}

// --- Aggregations -----------------------------------------------------------

/**
 * Compute the 5 headline KPIs from an already-filtered list. Single-pass
 * reduce — no intermediate arrays.
 *
 * Empty input → `{ gmv: 0, comision: 0, takeRate: 0, empresasActivas: 0,
 * bonosVendidos: 0 }` (no NaN / Infinity / divide-by-zero).
 *
 * `takeRate` is `comision / gmv` only when `gmv > 0`; otherwise 0. This
 * preserves the Phase 1 invariant (zero-safe percent fractions) so the
 * KPI card never shows `NaN%` or `Infinity%` even when the filter
 * excluded everything.
 *
 * @example
 *   summarizeInicio([
 *     { monto: 100000, comision: 5000, empresa_id: '$a', tipo: 'BONUS', ... },
 *     { monto:  50000, comision: 2500, empresa_id: '$a', tipo: 'PAYIN_PSE', ... },
 *     { monto:  25000, comision: 1250, empresa_id: '$b', tipo: 'BONUS', ... },
 *   ])
 *   // → { gmv: 175000, comision: 8750, takeRate: 0.05,
 *   //     empresasActivas: 2, bonosVendidos: 2 }
 */
export function summarizeInicio(transactions: Transaction[]): InicioSummary {
  let gmv = 0;
  let comision = 0;
  let bonosVendidos = 0;
  const empresaSet = new Set<string>();

  for (const t of transactions) {
    gmv += t.monto;
    comision += t.comision;
    if (t.tipo === BONUS_TIPO) bonosVendidos += 1;
    empresaSet.add(t.empresa_id);
  }

  const takeRate = gmv > 0 ? comision / gmv : 0;
  const empresasActivas = empresaSet.size;

  return { gmv, comision, takeRate, empresasActivas, bonosVendidos };
}

// --- GMV time series --------------------------------------------------------

/**
 * Group transactions by Bogotá calendar date and sum `monto` per bucket.
 * NO zero-fill — the Recharts continuous-axis spacing handles missing
 * days (same decision as `aggregateBonosByDate`, Plan 02-02 STATE entry).
 *
 * Output is sorted ASCENDING by `bucket` so a line chart can plot it
 * without re-sorting.
 *
 * Empty input → `[]`.
 *
 * @example
 *   aggregateGMVByDate([
 *     { fecha: new Date('2026-04-27T18:00:00Z'), monto: 100000, ... }, // Bogotá: 13:00 → 27
 *     { fecha: new Date('2026-04-27T19:30:00Z'), monto:  50000, ... }, // Bogotá: 14:30 → 27
 *     { fecha: new Date('2026-04-29T05:00:00Z'), monto: 200000, ... }, // Bogotá: 00:00 → 29
 *   ])
 *   // → [{ bucket: '2026-04-27', value: 150000 },
 *   //    { bucket: '2026-04-29', value: 200000 }]
 */
export function aggregateGMVByDate(transactions: Transaction[]): GMVPoint[] {
  const byBucket = new Map<string, number>();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "yyyy-MM-dd");
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + t.monto);
  }
  return Array.from(byBucket, ([bucket, value]) => ({ bucket, value })).sort(
    (a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0),
  );
}

/**
 * Group transactions by ISO-week (Bogotá calendar) and sum `monto` per
 * bucket. ISO week-numbering year + ISO week-of-year format — `2026-W18`
 * means week 18 of the ISO week-numbering year 2026 (Mon Apr 27, 2026
 * - Sun May 3, 2026).
 *
 * Why ISO week (`RRRR-'W'II`) and not `yyyy-'W'II`? Because the last few
 * days of a calendar year may belong to ISO week 1 of the NEXT year (and
 * vice versa). `RRRR` is the "ISO week-numbering year" — it agrees with
 * `II` on which year the week belongs to. Using `yyyy` would mis-bucket
 * ~5 days per year (e.g. 2024-12-30 / 2024-12-31 are in 2025-W01).
 *
 * NO zero-fill (same as date variant). Sorted ascending by bucket
 * (string-sortable since `RRRR-Www` is lexicographically chronological).
 *
 * Empty input → `[]`.
 */
export function aggregateGMVByWeek(transactions: Transaction[]): GMVPoint[] {
  const byBucket = new Map<string, number>();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "RRRR-'W'II");
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + t.monto);
  }
  return Array.from(byBucket, ([bucket, value]) => ({ bucket, value })).sort(
    (a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0),
  );
}

// --- Active empresas time series -------------------------------------------

/**
 * Group transactions by Bogotá calendar date and emit the count of
 * DISTINCT empresa_id per bucket.
 *
 * Pitfall 11 (RESEARCH.md): a single empresa with 10 transactions in
 * one day MUST count as 1 active empresa for that day, NOT 10. The
 * `Map<bucket, Set<empresa_id>>` shape ensures this — adding the same
 * id to the set twice is a no-op.
 *
 * NO zero-fill. Sorted ascending by bucket. Empty input → `[]`.
 *
 * @example
 *   aggregateActiveEmpresasByDate([
 *     { fecha: '2026-04-15', empresa_id: '$a', ... },  // 3 tx for empresa a on 4/15
 *     { fecha: '2026-04-15', empresa_id: '$a', ... },
 *     { fecha: '2026-04-15', empresa_id: '$a', ... },
 *     { fecha: '2026-04-16', empresa_id: '$b', ... },  // 2 tx for empresa b on 4/16
 *     { fecha: '2026-04-16', empresa_id: '$b', ... },
 *   ])
 *   // → [{ bucket: '2026-04-15', count: 1 },
 *   //    { bucket: '2026-04-16', count: 1 }]
 *   // (NOT count:3 / count:2 — distinct-empresa, not transaction-count)
 */
export function aggregateActiveEmpresasByDate(
  transactions: Transaction[],
): ActiveEmpresaPoint[] {
  const byBucket = new Map<string, Set<string>>();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "yyyy-MM-dd");
    let set = byBucket.get(bucket);
    if (!set) {
      set = new Set<string>();
      byBucket.set(bucket, set);
    }
    set.add(t.empresa_id);
  }
  return Array.from(byBucket, ([bucket, set]) => ({
    bucket,
    count: set.size,
  })).sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

/**
 * ISO-week variant of `aggregateActiveEmpresasByDate`. Same Set-per-
 * bucket dedup contract — Pitfall 11 closed at week granularity too.
 *
 * Bucket format `RRRR-'W'II` (e.g. `2026-W18`); see `aggregateGMVByWeek`
 * for the rationale on `RRRR` vs `yyyy`.
 *
 * NO zero-fill. Sorted ascending. Empty input → `[]`.
 */
export function aggregateActiveEmpresasByWeek(
  transactions: Transaction[],
): ActiveEmpresaPoint[] {
  const byBucket = new Map<string, Set<string>>();
  for (const t of transactions) {
    const bucket = formatInTimeZone(t.fecha, BOGOTA_TZ, "RRRR-'W'II");
    let set = byBucket.get(bucket);
    if (!set) {
      set = new Set<string>();
      byBucket.set(bucket, set);
    }
    set.add(t.empresa_id);
  }
  return Array.from(byBucket, ([bucket, set]) => ({
    bucket,
    count: set.size,
  })).sort((a, b) => (a.bucket < b.bucket ? -1 : a.bucket > b.bucket ? 1 : 0));
}

// =============================================================================
// === Inicio v2 surface (Plan 10-01 — operative lens) =========================
// =============================================================================
//
// Phase 10 shifts /inicio from a revenue lens (GMV / take rate / empresas
// activas) to an OPERATIVE lens — usuarios activos por tikintag, volumen
// IN-vs-OUT split, tasa de éxito global, distribution por tipo, actividad
// temporal por tikintag, top usuarios por volumen neto.
//
// REQUIREMENTS traceability (milestones/v2.0-REQUIREMENTS.md):
//   INI-V2-01  usuarios activos (DISTINCT tikintag) + volumen IN/OUT split
//   INI-V2-02  tasa de éxito global con semáforo (98.1% baseline)
//   INI-V2-03  donut por tipo (top 6 + Otros) — baseline 98.1% / 1.6% / 0.2%
//   INI-V2-04  honor filters.tipo when present (cross-cut narrowing)
//   INI-V2-05  actividad temporal — distinct tikintag por bucket + volumen
//   INI-V2-06  top N usuarios por volumen NETO grouped by tikintag (NOT empresa)
//
// v2-alongside-v1 coexistence (fifth instance after bonos/payouts/recargas/
// cardUsage Wave-1 plans — Plan 10-02 will swap inicio/page.tsx imports + prune
// the v1 block + the 4 v1 payouts.ts symbols + inicio-hechos.ts entirely in
// one cohesive diff). The v1 block above is byte-identical; v2 functions
// here append BELOW it without touching the v1 surface.
//
// Pure-domain rules (mirror v1 block above):
//   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`,
//     `lib/format`. v2 reuses the v1 imports already declared at the top
//     of this file (`formatInTimeZone`, `DashboardFilters`, `Transaction`,
//     `TransactionType`).
//   - All v2 functions pure: same input → same output, no side effects.
//   - Bogotá-anchored date math reuses v1 helpers `startOfDayBogotaTimestamp`
//     and `endOfDayBogotaTimestamp` (no duplication).
//   - Empty-input safe: zero/empty-array/zero-share, never NaN/Infinity.

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
 *   3. Bogotá-anchored from/to (inclusive ends) — reuses `startOfDayBogotaTimestamp`
 *      / `endOfDayBogotaTimestamp` from the v1 block above.
 *   4. Optional `empresa` filter (cliente-foco): when set, keep only
 *      rows where `t.empresa_id === filters.empresa`.
 *   5. Direction: BOTH `in` and `out` allowed (drop the v1 `direction
 *      !== 'in'` short-circuit). Skip ONLY `direction === 'OTRO_DIRECTION'`
 *      defensively — keeps the IN/OUT split sums clean if a future Sheet
 *      edit introduces a third value.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * Cross-cut nature (vs `filterCompletedIn` v1): /inicio v2 is the one tab
 * where ALL tipos AND BOTH directions are in scope by default (it's the
 * "operative health" page — operators want to see PURCHASE-out alongside
 * BONUS-in alongside PAYOUT_BANK-out etc.). Other v2 tabs hard-pin their
 * tipo (BONUS / PURCHASE / PAYIN_*) — this one does not.
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
