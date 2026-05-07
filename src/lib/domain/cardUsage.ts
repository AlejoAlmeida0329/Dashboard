/**
 * Uso Tarjeta domain (v2) — pure aggregations over `Transaction[]` for the
 * /uso-tarjeta page (Phase 8 Plan 08-02 composes this surface).
 *
 * "Uso Tarjeta" = compras realizadas con la tarjeta Tikin. The canonical
 * semantic is `tipo === "PURCHASE"` AND `direction === "out"` — i.e. the
 * USER's wallet is being debited toward the merchant. The same `PURCHASE`
 * transaction also has a peer row with `direction === "in"` for the
 * receiving empresa (sale-in counterpart); Uso Tarjeta is intentionally
 * the SPEND side.
 *
 * Brand new section in v2.0 (no v1 predecessor). This file follows the
 * conventions established by Phase 7 v2 modules (`bonos.ts` v2 surface,
 * `payouts.ts` v2 surface):
 *   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`, or
 *     `lib/format` heavy paths. Date formatting is local via the same
 *     Bogotá-anchored idiom as `recargas.ts`.
 *   - All functions are pure: same input → same output, no side effects.
 *   - Date math is anchored to "America/Bogota" (UTC-5, no DST) — same
 *     convention as `url-state.ts` and the rest of the domain layer.
 *   - Empty inputs degrade to zeros, never NaN/Infinity (Pitfall: empty
 *     result sets crashing the chart leaves).
 *
 * REQUIREMENTS traceability (milestones/v2.0-REQUIREMENTS.md):
 *   CARD-V2-01  filter to PURCHASE direction=out
 *   CARD-V2-02  summary: totalCompras + volumenCOP + ticketPromedio
 *   CARD-V2-04  adoption ratio (% usuarios con ≥1 compra)
 *   CARD-V2-05  tendencia temporal por día (chart re-buckets a granularidad)
 *   CARD-V2-06  top usuarios (default 10) ranked by volumen
 *
 * Prior art:
 *   - src/lib/domain/recargas.ts  — period filter + by-date aggregation shape
 *   - src/lib/domain/bonos.ts     — v2 default-status fallback + tikintag
 *                                    ranking aggregator pattern (top emisores
 *                                    / top receptores) reused for top users
 */

import type { DashboardFilters } from "@/lib/url-state";
import type { Transaction } from "@/lib/domain/types";

// --- Date parse helpers (Bogotá-anchored, local copy of recargas.ts idiom) ---

/**
 * Parse a `YYYY-MM-DD` filter string as the START of that day in Bogotá
 * (00:00:00 COT == 05:00:00 UTC). Returns `-Infinity` if the string is
 * missing or unparseable so callers can use `>=` without special-casing.
 *
 * We deliberately do NOT use `new Date(s)` because that interprets
 * `'2026-04-27'` as midnight UTC (= 19:00 the previous day in Bogotá),
 * silent off-by-one for every range filter. Verbatim copy of the
 * `recargas.ts` / `bonos.ts` helper — DRY-ing across modules costs more
 * than the inline ~10 lines (would require a shared util that every
 * domain module imports; the inline cost is a one-time copy per module).
 */
function startOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.NEGATIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.NEGATIVE_INFINITY;
  // Bogotá is UTC-5 with no DST. 00:00 in Bogotá == 05:00 UTC.
  const t = Date.parse(`${s}T00:00:00-05:00`);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Parse a `YYYY-MM-DD` filter string as the END of that day in Bogotá
 * (23:59:59.999 COT). Returns `+Infinity` if missing/unparseable.
 *
 * The "end of day" semantic matters: `to=2026-04-29` should include a
 * transaction stamped at 22:00 on the 29th.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Output types -----------------------------------------------------------

/** Header KPIs for the Uso Tarjeta tab (CARD-V2-02). */
export interface PurchaseSummary {
  /** Count of completed PURCHASE direction=out rows in the filtered range. */
  totalCompras: number;
  /** Sum of `Math.abs(monto)` over the same rows (COP). */
  volumenCOP: number;
  /** `volumenCOP / totalCompras`. `0` (not NaN) when totalCompras === 0. */
  ticketPromedio: number;
}

/**
 * Adoption KPI — what fraction of users in the broader pool have made
 * at least one card purchase in the filtered range (CARD-V2-04).
 */
export interface PurchaseAdoption {
  /** Distinct `tikintag` values in the PURCHASE-out filtered set. */
  usersWithPurchase: number;
  /**
   * Distinct `tikintag` values in the broader transaction pool the page
   * scopes to (typically the period-filtered superset, NOT just PURCHASE).
   */
  totalUsers: number;
  /** `usersWithPurchase / totalUsers`. Fraction 0..1. `0` when totalUsers === 0. */
  adoptionRate: number;
}

/** One bucket of the Uso Tarjeta time-series (CARD-V2-05). */
export interface PurchaseByDate {
  /** ISO date `YYYY-MM-DD` interpreted in Bogotá. */
  date: string;
  /** Number of compras that day. */
  compras: number;
  /** Sum of `Math.abs(monto)` for that day (COP). */
  volumenCOP: number;
}

/** One row of the top-card-users ranking (CARD-V2-06). */
export interface TopCardUser {
  /** The user's tikintag (the wallet doing the spending). */
  tikintag: string;
  /**
   * Best-effort empresa label (from the first observed row's
   * `empresa_nombre`). Optional because a future schema where empresa is
   * a separate display column may leave it unpopulated for some rows.
   */
  empresa: string | undefined;
  /** Number of compras attributed to this tikintag. */
  compras: number;
  /** Sum of `Math.abs(monto)` (COP). */
  volumenCOP: number;
  /** `volumenCOP / compras` for this tikintag. `0` when compras === 0. */
  ticketPromedio: number;
}

// --- Filtering --------------------------------------------------------------

/**
 * Apply the Uso Tarjeta default filter contract to a list of transactions.
 *
 * Filter semantics (CARD-V2-01):
 *   1. `tipo === "PURCHASE"` AND `direction === "out"` — canonical
 *      "user spends on card" semantic. The matching peer row (PURCHASE
 *      direction=in for the receiving empresa) is intentionally excluded
 *      so the ticket is counted once per user-spend, not once per side.
 *   2. Status:
 *        - When `filters.status` is undefined or empty: default to
 *          `["completed"]` (matches CROSS-V2-01 + Phase 6 contract — a
 *          rejected purchase didn't actually charge the user).
 *        - When `filters.status` is set (CSV multi-select): honor the
 *          user's selection verbatim. The Set lookup tolerates the
 *          `OTRO_STATUS` fallback gracefully.
 *   3. Bogotá-anchored from/to (inclusive ends) — same convention as
 *      `filterRecargas` / `filterBonosV2`.
 *   4. Optional `empresa` filter (cliente-foco): when set, keep only
 *      rows where `t.empresa_id === filters.empresa`. Same convention
 *      as the rest of the domain layer.
 *   5. `filters.tipo` is INTENTIONALLY ignored: Uso Tarjeta is
 *      PURCHASE-by-definition; the global `tipo` multi-select drives
 *      Inicio / Vista Cliente cross-cuts, not this tab. (Same convention
 *      as `filterBonosV2` and `filterPayoutsV2`.)
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * @example
 *   filterPurchases(allTransactions, { from: '2026-04-01', to: '2026-04-30' })
 *   // → only PURCHASE direction=out completed transactions in April 2026
 */
export function filterPurchases(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;
  const statusSet =
    filters.status && filters.status.length > 0
      ? new Set<string>(filters.status)
      : new Set<string>(["completed"]);

  return transactions.filter((t) => {
    if (t.tipo !== "PURCHASE") return false;
    if (t.direction !== "out") return false;
    if (!statusSet.has(t.status)) return false;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && t.empresa_id !== empresa) return false;

    return true;
  });
}

// --- Summary KPI ------------------------------------------------------------

/**
 * Compute Uso Tarjeta header KPIs from an already-filtered list of
 * PURCHASE-out rows (CARD-V2-02).
 *
 * Pure. Empty input → `{ totalCompras: 0, volumenCOP: 0, ticketPromedio: 0 }`
 * (no NaN / Infinity).
 *
 * `monto` is taken absolute because PURCHASE direction=out rows carry
 * negative montos (debit from the user's wallet). The KPI surfaces the
 * GROSS volume of card spend, which is the headline number on the page.
 *
 * @example
 *   summarizePurchases([{ monto: -100000, ... }, { monto: -50000, ... }])
 *   // → { totalCompras: 2, volumenCOP: 150000, ticketPromedio: 75000 }
 *   summarizePurchases([])
 *   // → { totalCompras: 0, volumenCOP: 0, ticketPromedio: 0 }
 */
export function summarizePurchases(rows: Transaction[]): PurchaseSummary {
  let volumenCOP = 0;
  for (const r of rows) {
    volumenCOP += Math.abs(r.monto);
  }
  const totalCompras = rows.length;
  const ticketPromedio = totalCompras > 0 ? volumenCOP / totalCompras : 0;
  return { totalCompras, volumenCOP, ticketPromedio };
}
