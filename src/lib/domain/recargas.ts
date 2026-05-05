/**
 * Recargas domain — pure aggregations over `Transaction[]`.
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué es una recarga", "cómo
 * se cuenta", "cómo se agrupa". UI consumers (Plan 04-06 components, Plan
 * 04-08 page) import the functions here and stay dumb about the underlying
 * data shape. Mirror of `bonos.ts` line-for-line — same shape, same
 * conventions, same purity guarantees.
 *
 * Design rules (deliberate, mirror of bonos.ts):
 *   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`, or
 *     `lib/format`. Date formatting is done via `formatInTimeZone` from
 *     `date-fns-tz` directly so this module stays free of the project's
 *     Intl gate. This makes every function callable from Server Components,
 *     Client Components, scripts, and (future) tests without setup.
 *   - All functions are pure: same input → same output, no side effects,
 *     no `Date.now()` or `process.env` reads.
 *   - Date math is anchored to "America/Bogota" (UTC-5, no DST) — same
 *     convention as `url-state.ts` and `bonos.ts` so filters and
 *     aggregations agree on what "a day" means.
 *   - `pctDelTotal` returns a fraction 0..1 (consumed by `formatPercent`
 *     in `format.ts` which expects a fraction). Zero divisor → 0, never
 *     NaN/Infinity (Pitfall: empty result sets crashing the chart).
 *
 * --- Recargas Filter Contract ---
 *
 * A "recarga" in Tikin's domain = the user puts money INTO their wallet.
 * Two `transaction_type` values express this intent in BD_Plataforma:
 *   - `PAYIN_PSE` — recarga via PSE (online bank debit)
 *   - `PAYIN_TRANSFER` — recarga via direct transfer
 *
 * Other PAYIN-shaped tipos exist (PURCHASE has `direction='in'` for the
 * receiving side, BONUS is also `direction='in'`) but those are different
 * intents — PURCHASE is a sale TO the user from another empresa, BONUS is
 * a promotion. Recargas is specifically "user-initiated funding". The
 * domain distinction matters for the highlight-reel narrative on /recargas
 * (Plan 04-08): "X recargas, $Y montoTotal" reads as "users put money in"
 * and would be misleading if it conflated PURCHASE/BONUS rows.
 *
 * Default filter (the "what is a recarga?" definition):
 *   1. `tipo` ∈ RECHARGE_TIPOS (currently `PAYIN_PSE` + `PAYIN_TRANSFER`)
 *   2. `direction === 'in'` — defensive (these tipos should always be
 *      `in` in production, but a future schema drift could leak `out`
 *      reversal rows; this guard keeps the count clean).
 *   3. `status === 'completed'` — rejected recargas never landed money;
 *      excluding them matches the Bonos convention.
 *
 * Then applied (in order, AND-combined): from / to (Bogotá-anchored) and
 * optional empresa.
 */

import { formatInTimeZone } from "date-fns-tz";

import type { Transaction, TransactionType } from "./types";
import type { DashboardFilters } from "@/lib/url-state";

// --- Constants --------------------------------------------------------------

/**
 * `transaction_type` values that count as a "recarga" for the Recargas tab.
 *
 * Phase 2 Plan 01 captured live distinct transaction_types and confirmed
 * `PAYIN_PSE` and `PAYIN_TRANSFER` exist in production data — see
 * 02-01-SUMMARY.md "Diagnostic Findings" + types.ts JSDoc on
 * `TransactionType`. If Tikin later splits into more PAYIN variants
 * (e.g. `PAYIN_NEQUI`, `PAYIN_DAVIPLATA`), append them to this array —
 * that's the only edit needed.
 */
const RECHARGE_TIPOS: readonly TransactionType[] = [
  "PAYIN_PSE",
  "PAYIN_TRANSFER",
];

const BOGOTA_TZ = "America/Bogota";

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
 * Verbatim copy from `bonos.ts:53-60`. DRY-ing across modules costs more
 * than the inline ~10 lines (would require a new shared util that's
 * imported by every domain module; the inline cost is a one-time copy).
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
 * expects to see transactions stamped at 22:00 on the 29th included.
 *
 * Verbatim copy from `bonos.ts:69-74`.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Output types -----------------------------------------------------------

/** Header KPIs for the Recargas tab. */
export interface RecargaSummary {
  /** Number of recargas in the filtered range. */
  count: number;
  /** Sum of `monto` — total $ recargado (COP). */
  montoTotal: number;
}

/** One point on the trend "recargas en el tiempo" chart. */
export interface RecargaByDate {
  /** ISO date `YYYY-MM-DD` interpreted in Bogotá. */
  date: string;
  /** Number of recargas that day. */
  count: number;
  /** Sum of `monto` for that day (COP). */
  monto: number;
}

/** One row in the leaderboard / "recargas por empresa" table. */
export interface RecargaByEmpresa {
  empresa_id: string;
  empresa_nombre: string;
  count: number;
  /** Sum of `monto` for this empresa (COP). */
  monto: number;
  /**
   * `monto / sum(monto across all empresas in the filtered set)`.
   * Fraction 0..1; pass to `formatPercent` from `format.ts` directly.
   * Returns 0 when total is 0 (not NaN).
   */
  pctDelTotal: number;
}

// --- Filtering --------------------------------------------------------------

/**
 * Apply the Recargas default filter contract to a list of transactions.
 *
 * Default filter (the "what is a recarga?" definition):
 *   1. `tipo` ∈ RECHARGE_TIPOS (`PAYIN_PSE` + `PAYIN_TRANSFER`)
 *   2. `direction === 'in'` — outgoing entries (e.g. reversos) are
 *      excluded so the recargas count is not double-decremented when a
 *      recarga is later refunded out. Refunds appear as separate
 *      `REFUND` transactions and don't contaminate Recargas.
 *   3. `status === 'completed'` — rejected recargas never landed money.
 *      Captured live: only `completed` and `rejected` exist in
 *      BD_Plataforma.status (02-01-SUMMARY.md). If Tikin later adds
 *      an in-flight status like `pending`, it falls back to
 *      `OTRO_STATUS` (per types.ts) and is automatically excluded
 *      until this filter is updated explicitly.
 *
 * Then applied (in order, AND-combined):
 *   4. `from` filter — `t.fecha >= startOfDay(from)` in Bogotá.
 *      Unparseable `from` → no lower bound (degrade gracefully).
 *   5. `to` filter — `t.fecha <= endOfDay(to)` in Bogotá.
 *      Unparseable `to` → no upper bound.
 *   6. `empresa` filter — `t.empresa_id === filters.empresa`.
 *      Empty/undefined → no empresa restriction.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * @example
 *   filterRecargas(allTransactions, { from: '2026-04-01', to: '2026-04-30' })
 *   // → only PAYIN_PSE/PAYIN_TRANSFER transactions in April 2026, completed, direction=in
 */
export function filterRecargas(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const rechargeTypeSet = new Set<string>(RECHARGE_TIPOS);
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;

  return transactions.filter((t) => {
    if (!rechargeTypeSet.has(t.tipo)) return false;
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
 * Compute header KPIs from an already-filtered list of recargas.
 *
 * Pure. Empty input → `{ count: 0, montoTotal: 0 }` (no NaN / Infinity).
 *
 * @example
 *   summarizeRecargas([{ monto: 100000, ... }, { monto: 50000, ... }])
 *   // → { count: 2, montoTotal: 150000 }
 *   summarizeRecargas([])
 *   // → { count: 0, montoTotal: 0 }
 */
export function summarizeRecargas(recargas: Transaction[]): RecargaSummary {
  let montoTotal = 0;
  for (const r of recargas) {
    montoTotal += r.monto;
  }
  return { count: recargas.length, montoTotal };
}

/**
 * Group recargas by Bogotá calendar date, producing one point per day
 * that has data. NO zero-fill — same convention as `aggregateBonosByDate`.
 * Days with zero recargas simply don't appear; the chart library handles
 * continuous-axis spacing on its own. Zero-fill would also make the
 * dashboard look like the source of truth on "no-recarga days" — which
 * it isn't (Sheets is).
 *
 * Output is sorted ASCENDING by `date` so a line chart can plot it
 * without re-sorting.
 *
 * @example
 *   aggregateRecargasByDate([
 *     { fecha: new Date('2026-04-27T18:00:00Z'), monto: 100000, ... }, // 13:00 Bogotá → 27
 *     { fecha: new Date('2026-04-28T01:00:00Z'), monto: 200000, ... }, // 20:00 prev day Bogotá → 27
 *     { fecha: new Date('2026-04-29T05:00:00Z'), monto:  50000, ... }, // 00:00 Bogotá → 29
 *   ])
 *   // → [
 *   //     { date: '2026-04-27', count: 2, monto: 300000 },
 *   //     { date: '2026-04-29', count: 1, monto:  50000 },
 *   //   ]
 */
export function aggregateRecargasByDate(
  recargas: Transaction[],
): RecargaByDate[] {
  const byDay = new Map<string, RecargaByDate>();
  for (const r of recargas) {
    const date = formatInTimeZone(r.fecha, BOGOTA_TZ, "yyyy-MM-dd");
    const cur = byDay.get(date);
    if (cur) {
      cur.count += 1;
      cur.monto += r.monto;
    } else {
      byDay.set(date, { date, count: 1, monto: r.monto });
    }
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * Group recargas by empresa, computing `count`, `monto`, and
 * `pctDelTotal` per empresa. Result is sorted DESCENDING by `monto`
 * (largest empresa first) — convenient for both the leaderboard and the
 * full table.
 *
 * `pctDelTotal` is computed against the SUM of `monto` of THE INPUT
 * (i.e. all recargas already passed the filter). The pct totals to 1.0
 * across all rows when the input is non-empty. When the input is
 * empty, every row's `pctDelTotal` is 0 (vacuously true).
 *
 * `empresa_nombre` is taken from the first transaction seen for each
 * empresa_id (first-occurrence-wins). Today (Phase 2+) `empresa_id ===
 * empresa_nombre === tikintag` (see 02-01-SUMMARY.md "Empresa identity
 * decision") so this is exact; once a real display-name column exists,
 * the schema's transform will fill `empresa_nombre` distinctly and this
 * function will surface it automatically without any change here.
 *
 * @example
 *   aggregateRecargasByEmpresa([
 *     { empresa_id: '$mario',    empresa_nombre: '$mario',    monto: 200000, ... },
 *     { empresa_id: '$tikincol', empresa_nombre: '$tikincol', monto: 100000, ... },
 *   ])
 *   // → [
 *   //     { empresa_id: '$mario',    ..., count: 1, monto: 200000, pctDelTotal: 0.667 },
 *   //     { empresa_id: '$tikincol', ..., count: 1, monto: 100000, pctDelTotal: 0.333 },
 *   //   ]
 */
export function aggregateRecargasByEmpresa(
  recargas: Transaction[],
): RecargaByEmpresa[] {
  // First pass: aggregate by empresa_id.
  const byEmpresa = new Map<string, RecargaByEmpresa>();
  let montoTotalAll = 0;
  for (const r of recargas) {
    montoTotalAll += r.monto;
    const cur = byEmpresa.get(r.empresa_id);
    if (cur) {
      cur.count += 1;
      cur.monto += r.monto;
    } else {
      byEmpresa.set(r.empresa_id, {
        empresa_id: r.empresa_id,
        empresa_nombre: r.empresa_nombre,
        count: 1,
        monto: r.monto,
        pctDelTotal: 0, // filled in second pass
      });
    }
  }

  // Second pass: pctDelTotal. Guard against zero divisor (Pitfall: empty
  // input or all-zero montos producing NaN/Infinity that crash the chart).
  const safeTotal = montoTotalAll > 0 ? montoTotalAll : 0;
  const rows = Array.from(byEmpresa.values());
  for (const row of rows) {
    row.pctDelTotal = safeTotal > 0 ? row.monto / safeTotal : 0;
  }

  // Sort descending by monto (largest empresa first).
  rows.sort((a, b) => b.monto - a.monto);
  return rows;
}

/**
 * Take the top 10 (by `monto`) entries from a pre-sorted
 * `RecargaByEmpresa[]`. Idiomatic call:
 *
 *   const top = top10RecargasEmpresas(aggregateRecargasByEmpresa(recargas));
 *
 * If `rows.length < 10`, returns all rows. Returns a NEW array (does not
 * mutate the input) so the leaderboard and the full table can render
 * from the same source without interfering. Mirror of `top10Empresas`
 * in `bonos.ts`.
 *
 * @example
 *   top10RecargasEmpresas([{ ... 12 rows pre-sorted desc ... }])
 *   // → first 10
 *   top10RecargasEmpresas([{ ... 3 rows ... }])
 *   // → all 3
 */
export function top10RecargasEmpresas(
  rows: RecargaByEmpresa[],
): RecargaByEmpresa[] {
  return rows.slice(0, 10);
}
