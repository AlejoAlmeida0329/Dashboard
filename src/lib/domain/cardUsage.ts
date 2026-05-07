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

// --- Bogotá date formatting (local helper for by-date aggregation) ---------

/**
 * Format a Date as a Bogotá `YYYY-MM-DD` string. Local helper instead of
 * pulling in `formatInTimeZone` from `date-fns-tz` to keep this module's
 * import surface minimal — Bogotá is +/-5h from UTC with no DST, so the
 * arithmetic is straightforward and deterministic.
 *
 * Equivalent to `formatInTimeZone(d, "America/Bogota", "yyyy-MM-dd")` for
 * any finite Date; returns `'1970-01-01'` for an invalid Date so a
 * pathological row can't crash the chart.
 */
function toBogotaISODate(d: Date): string {
  const t = d.getTime();
  if (!Number.isFinite(t)) return "1970-01-01";
  // Shift the instant by -5h (UTC-5) so the resulting UTC fields align
  // with the Bogotá wall-clock fields, then read the UTC parts.
  const shifted = new Date(t - 5 * 60 * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// --- Aggregations -----------------------------------------------------------

/**
 * Compute Uso Tarjeta adoption KPI (CARD-V2-04 — "% usuarios con ≥1
 * compra en el periodo").
 *
 * Two-input signature is deliberate:
 *   - `purchaseRows` = the PURCHASE direction=out filtered set (numerator).
 *   - `allTx` = the broader user pool the page is scoping to (denominator —
 *     typically the same period-filtered superset the page uses for any
 *     other Inicio-style cross-cut). The caller MUST pre-filter `allTx`
 *     to the same period the page is showing; this function does NOT
 *     re-filter internally because the page is the budget-keeper for
 *     period-scoping (one filter pass, multiple aggregations).
 *
 * Both numerator and denominator count distinct `tikintag` values
 * (rows with empty/falsy tikintag are skipped — defensive against future
 * schema gaps; in practice every BD_Plataforma row has a tikintag).
 *
 * Order-of-magnitude calibration (PRD baseline 2026-05): roughly 40
 * usuarios con compra / 235 usuarios totales ≈ 17%. Live ratio depends
 * on the active period filter; this helper's job is to compute the
 * fraction for whatever period the page is on.
 *
 * Pure. Empty inputs → `{ usersWithPurchase: 0, totalUsers: 0,
 * adoptionRate: 0 }` (no NaN / Infinity).
 */
export function aggregatePurchaseAdoption(
  allTx: Transaction[],
  purchaseRows: Transaction[],
): PurchaseAdoption {
  const purchaseTikintags = new Set<string>();
  for (const t of purchaseRows) {
    if (t.tikintag) purchaseTikintags.add(t.tikintag);
  }
  const totalTikintags = new Set<string>();
  for (const t of allTx) {
    if (t.tikintag) totalTikintags.add(t.tikintag);
  }
  const usersWithPurchase = purchaseTikintags.size;
  const totalUsers = totalTikintags.size;
  const adoptionRate = totalUsers > 0 ? usersWithPurchase / totalUsers : 0;
  return { usersWithPurchase, totalUsers, adoptionRate };
}

/**
 * Group purchases by Bogotá calendar date, producing one bucket per day
 * that has data (CARD-V2-05 — "tendencia temporal").
 *
 * NO zero-fill at this layer. Days with zero compras simply don't appear;
 * the chart leaf in Plan 08-02 handles its own empty-axis spacing — same
 * convention as `aggregateRecargasByDate` and `aggregateBonosByDateV2`.
 *
 * NO granularity argument. CARD-V2-05 mentions "granularidad día / semana /
 * mes", but that re-bucketing is a UI/leaf concern (same as Inicio v1's
 * TimelineChart). Domain emits daily; the chart re-buckets to weekly /
 * monthly when the user picks that toggle.
 *
 * Output sorted ASCENDING by `date` so a line chart can plot it without
 * re-sorting. Empty input → `[]`.
 */
export function aggregatePurchasesByDate(
  rows: Transaction[],
): PurchaseByDate[] {
  const byDay = new Map<string, PurchaseByDate>();
  for (const r of rows) {
    const date = toBogotaISODate(r.fecha);
    const cur = byDay.get(date);
    if (cur) {
      cur.compras += 1;
      cur.volumenCOP += Math.abs(r.monto);
    } else {
      byDay.set(date, { date, compras: 1, volumenCOP: Math.abs(r.monto) });
    }
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * Top-N tikintags ranked by card-spend volume (CARD-V2-06).
 *
 * Groups by `t.tikintag` (the user spending). Rows where tikintag is
 * empty/falsy are skipped — defensive: a peer-less row cannot be
 * attributed to a user. Per group: count + sum(|monto|) +
 * ticketPromedio (volumen / count) + first-row's `empresa_nombre` as a
 * best-effort label.
 *
 * Sorted DESCENDING by `volumenCOP`; ties broken by `compras` DESC so
 * output is deterministic across renders. Sliced to `limit` (default 10
 * per CARD-V2-06).
 *
 * `empresa: string | undefined` because in a future schema where empresa
 * is a separate display column it may be absent for some rows. Today
 * (Phase 2 default) `empresa_nombre === tikintag` for every row so this
 * field is always populated — but the type signature stays defensive
 * for the eventual schema evolution.
 *
 * Pure. Empty input → `[]`. O(n + k log k) where k = distinct tikintags.
 */
export function aggregateTopCardUsers(
  rows: Transaction[],
  limit: number = 10,
): TopCardUser[] {
  const acc = new Map<string, TopCardUser>();
  for (const r of rows) {
    if (!r.tikintag) continue;
    const cur = acc.get(r.tikintag);
    const amount = Math.abs(r.monto);
    if (cur) {
      cur.compras += 1;
      cur.volumenCOP += amount;
    } else {
      acc.set(r.tikintag, {
        tikintag: r.tikintag,
        empresa: r.empresa_nombre || undefined,
        compras: 1,
        volumenCOP: amount,
        ticketPromedio: 0, // filled in second pass
      });
    }
  }
  const out = Array.from(acc.values());
  for (const row of out) {
    row.ticketPromedio = row.compras > 0 ? row.volumenCOP / row.compras : 0;
  }
  out.sort((a, b) =>
    b.volumenCOP !== a.volumenCOP
      ? b.volumenCOP - a.volumenCOP
      : b.compras - a.compras,
  );
  return out.slice(0, limit);
}
