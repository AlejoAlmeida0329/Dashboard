/**
 * Bonos domain — pure aggregations over `Transaction[]`.
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué es un bono", "cómo se
 * cuenta", "cómo se agrupa". UI consumers (Plan 03 components, Plan 04
 * page) import the functions here and stay dumb about the underlying
 * data shape.
 *
 * Design rules (deliberate):
 *   - NO imports from `next/`, `react`, `server-only`, or `lib/sheets/`.
 *     This makes every function callable from Server Components, Client
 *     Components, scripts, and (future) tests without setup.
 *   - All functions are pure: same input → same output, no side effects,
 *     no `Date.now()` or `process.env` reads.
 *   - Date math is anchored to "America/Bogota" via `toBogotaISODate` —
 *     same convention as `url-state.ts` so filters and aggregations agree
 *     on what "a day" means.
 *   - `pctDelTotal` returns a fraction 0..1 (consumed by `formatPercent`
 *     in `format.ts` which expects a fraction). Zero divisor → 0, never
 *     NaN/Infinity (Pitfall: empty result sets crashing the chart).
 */

import { toBogotaISODate } from "@/lib/format";
import type { DashboardFilters } from "@/lib/url-state";

import type { Transaction } from "./types";

// --- Constants --------------------------------------------------------------

/**
 * `transaction_type` values that count as a "bono" for the Bonos tab.
 *
 * Phase 2 Plan 01 captured live distinct transaction_types and confirmed
 * that bonos are recorded as `BONUS` (singular, uppercase) — see
 * 02-01-SUMMARY.md "Diagnostic Findings". If Tikin later splits into
 * multiple bono variants (e.g. `BONUS_REGALO`, `BONUS_RECARGA`), append
 * them to this array — that's the only edit needed.
 */
const BONO_TRANSACTION_TYPES: readonly Transaction["tipo"][] = ["BONUS"];

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
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Output types -----------------------------------------------------------

/** Header KPIs for the Bonos tab. */
export interface BonoSummary {
  /** Number of bonos in the filtered range. */
  count: number;
  /** sum(monto) / count. `0` (not NaN) when count is `0`. */
  ticketPromedio: number;
  /** Sum of `comision` — Tikin's revenue from bonos. */
  comisionTotal: number;
  /** Sum of `monto` — total $ sold. */
  montoTotal: number;
}

/** One point on the hero "bonos vendidos en el tiempo" line chart. */
export interface BonoByDate {
  /** ISO date `YYYY-MM-DD` interpreted in Bogotá. */
  date: string;
  /** Number of bonos sold that day. */
  count: number;
  /** Sum of `monto` for that day (COP). */
  monto: number;
}

/** One row in the leaderboard / "ventas por empresa" table. */
export interface BonoByEmpresa {
  empresa_id: string;
  empresa_nombre: string;
  count: number;
  /** Sum of `monto` for this empresa (COP). */
  monto: number;
  /** Sum of `comision` for this empresa (COP). */
  comision: number;
  /**
   * `monto / sum(monto across all empresas in the filtered set)`.
   * Fraction 0..1; pass to `formatPercent` from `format.ts` directly.
   * Returns 0 when total is 0 (not NaN).
   */
  pctDelTotal: number;
}

// --- Filtering --------------------------------------------------------------

/**
 * Apply the Bonos default filter contract to a list of transactions.
 *
 * Default filter (the "what is a bono?" definition):
 *   1. `tipo` ∈ BONO_TRANSACTION_TYPES (currently just `'BONUS'`)
 *   2. `direction === 'in'` — outgoing entries (e.g. reversos) are
 *      excluded so the "ventas" count is not double-decremented when
 *      a sale is later refunded out. Refunds appear as separate
 *      `REFUND` transactions and don't contaminate Bonos.
 *   3. `status === 'completed'` — rejected transactions never carried
 *      money. Captured live: only `completed` and `rejected` exist
 *      in BD_Plataforma.status (02-01-SUMMARY.md). If Tikin later
 *      adds an in-flight status like `pending`, it falls back to
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
 *   filterBonos(allTransactions, { from: '2026-04-01', to: '2026-04-30' })
 *   // → only BONUS transactions in April 2026, completed, direction=in
 */
export function filterBonos(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const bonoTypeSet = new Set<string>(BONO_TRANSACTION_TYPES);
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;

  return transactions.filter((t) => {
    if (!bonoTypeSet.has(t.tipo)) return false;
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
 * Compute header KPIs from an already-filtered list of bonos.
 *
 * Pure. Empty input → `{ count: 0, ticketPromedio: 0, comisionTotal: 0,
 * montoTotal: 0 }` (no NaN / Infinity).
 *
 * @example
 *   summarizeBonos([{ monto: 100000, comision: 5000, ... }, { monto: 50000, comision: 2500, ... }])
 *   // → { count: 2, ticketPromedio: 75000, comisionTotal: 7500, montoTotal: 150000 }
 */
export function summarizeBonos(bonos: Transaction[]): BonoSummary {
  let montoTotal = 0;
  let comisionTotal = 0;
  for (const b of bonos) {
    montoTotal += b.monto;
    comisionTotal += b.comision;
  }
  const count = bonos.length;
  const ticketPromedio = count > 0 ? montoTotal / count : 0;
  return { count, ticketPromedio, comisionTotal, montoTotal };
}

/**
 * Group bonos by Bogotá calendar date, producing one point per day
 * that has data. NO zero-fill — bono density is high (~3000 transactions
 * across the whole Sheet, plenty of bonos per day in normal operation),
 * and the chart library in Plan 03 handles continuous-axis spacing on
 * its own. Days with zero bonos simply don't appear.
 *
 * Output is sorted ASCENDING by `date` so a line chart can plot it
 * without re-sorting.
 *
 * @example
 *   aggregateBonosByDate([
 *     { fecha: new Date('2026-04-27T18:00:00Z'), monto: 100000, ... }, // 13:00 Bogotá → 27
 *     { fecha: new Date('2026-04-28T01:00:00Z'), monto: 200000, ... }, // 20:00 prev day Bogotá → 27
 *     { fecha: new Date('2026-04-29T05:00:00Z'), monto: 50000,  ... }, // 00:00 Bogotá → 29
 *   ])
 *   // → [
 *   //     { date: '2026-04-27', count: 2, monto: 300000 },
 *   //     { date: '2026-04-29', count: 1, monto:  50000 },
 *   //   ]
 */
export function aggregateBonosByDate(bonos: Transaction[]): BonoByDate[] {
  const byDay = new Map<string, BonoByDate>();
  for (const b of bonos) {
    const date = toBogotaISODate(b.fecha);
    const cur = byDay.get(date);
    if (cur) {
      cur.count += 1;
      cur.monto += b.monto;
    } else {
      byDay.set(date, { date, count: 1, monto: b.monto });
    }
  }
  return Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Group bonos by empresa, computing `count`, `monto`, `comision`, and
 * `pctDelTotal` per empresa. Result is sorted DESCENDING by `monto`
 * (largest empresa first) — convenient for both the leaderboard and the
 * full table.
 *
 * `pctDelTotal` is computed against the SUM of `monto` of THE INPUT
 * (i.e. all bonos already passed the filter). The pct totals to 1.0
 * across all rows when the input is non-empty. When the input is
 * empty, `pctDelTotal` is 0 for every row (vacuously true).
 *
 * `empresa_nombre` is taken from the first transaction seen for each
 * empresa_id. Today (Phase 2) `empresa_id === empresa_nombre === tikintag`
 * (see 02-01-SUMMARY.md "Empresa identity decision") so this is exact;
 * once a real display-name column exists, the schema's transform will
 * fill `empresa_nombre` distinctly and this function will surface it
 * automatically without any change here.
 *
 * @example
 *   aggregateBonosByEmpresa([
 *     { empresa_id: '$mario',    empresa_nombre: '$mario',    monto: 100000, comision: 5000, ... },
 *     { empresa_id: '$mario',    empresa_nombre: '$mario',    monto:  50000, comision: 2500, ... },
 *     { empresa_id: '$tikincol', empresa_nombre: '$tikincol', monto:  25000, comision: 1250, ... },
 *   ])
 *   // → [
 *   //     { empresa_id: '$mario',    ..., count: 2, monto: 150000, comision: 7500, pctDelTotal: 0.857... },
 *   //     { empresa_id: '$tikincol', ..., count: 1, monto:  25000, comision: 1250, pctDelTotal: 0.142... },
 *   //   ]
 */
export function aggregateBonosByEmpresa(bonos: Transaction[]): BonoByEmpresa[] {
  // First pass: aggregate by empresa_id.
  const byEmpresa = new Map<string, BonoByEmpresa>();
  let montoTotalAll = 0;
  for (const b of bonos) {
    montoTotalAll += b.monto;
    const cur = byEmpresa.get(b.empresa_id);
    if (cur) {
      cur.count += 1;
      cur.monto += b.monto;
      cur.comision += b.comision;
    } else {
      byEmpresa.set(b.empresa_id, {
        empresa_id: b.empresa_id,
        empresa_nombre: b.empresa_nombre,
        count: 1,
        monto: b.monto,
        comision: b.comision,
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
 * `BonoByEmpresa[]`. Idiomatic call:
 *
 *   const top = top10Empresas(aggregateBonosByEmpresa(bonos));
 *
 * If `rows.length < 10`, returns all rows. Returns a NEW array (does not
 * mutate the input) so the leaderboard and the full table can render
 * from the same source without interfering.
 *
 * @example
 *   top10Empresas([{ ... 12 rows pre-sorted desc ... }])
 *   // → first 10
 *   top10Empresas([{ ... 3 rows ... }])
 *   // → all 3
 */
export function top10Empresas(rows: BonoByEmpresa[]): BonoByEmpresa[] {
  return rows.slice(0, 10);
}
