/**
 * Recargas domain — pure aggregations over `Transaction[]`.
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué es una recarga", "cómo
 * se cuenta", "cómo se agrupa". UI consumers (Plan 08-03 components, Plan
 * 08-04 page) import the functions here and stay dumb about the underlying
 * data shape.
 *
 * Design rules (deliberate):
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
 *
 * v2-only surface (post Plan 09-03 prune):
 *   The v1 surface (filterRecargas, summarizeRecargas, aggregateRecargasByDate,
 *   aggregateRecargasByEmpresa, top10RecargasEmpresas, findTopEmpresaRecargadora,
 *   findRecargaMasGrande, RecargaSummary, RecargaByDate, RecargaByEmpresa) was
 *   deleted in Plan 09-03 once the last v1 consumer (clientes/[empresaId] v1
 *   page + EmpresaMiniCards) was rewritten / deleted. The v2 surface —
 *   `RecargaSummaryV2`, `RecargaByDateV2`, `RechargeAdoption`,
 *   `RechargeMethodSplit`, `RechargeAmountBucket`, `TopRecharger`,
 *   `filterRecargasV2`, `summarizeRecargasV2`, `aggregateRechargesByDateV2`,
 *   `aggregateRechargeAdoption`, `aggregateRechargeMethodSplit`,
 *   `aggregateRechargeAmountDistribution`, `aggregateTopRechargers` — is the
 *   only public surface.
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
 * (Plan 08-04): "X recargas, $Y volumen" reads as "users put money in"
 * and would be misleading if it conflated PURCHASE/BONUS rows.
 *
 * Default filter (the "what is a recarga?" definition):
 *   1. `tipo` ∈ RECHARGE_TIPOS (currently `PAYIN_PSE` + `PAYIN_TRANSFER`)
 *   2. `direction === 'in'` — defensive (these tipos should always be
 *      `in` in production, but a future schema drift could leak `out`
 *      reversal rows; this guard keeps the count clean).
 *   3. `status` — when `filters.status` is undefined or empty, default
 *      to `["completed"]`; when set, honor verbatim (CROSS-V2-01 URL
 *      filter).
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
 * Verbatim copy from `bonos.ts`. DRY-ing across modules costs more
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
 * Verbatim copy from `bonos.ts`.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// ============================================================================
// v2 — REC-V2-01..08 surface
// ============================================================================
//
// Field-name reconciliation note (Plan 08-03 deviation [Rule 3 - Blocking]):
// The PLAN.md draft referenced `tx.transactionAmount`, `tx.transferTikintag`,
// `tx.transferEmpresa` — these do NOT exist on the `Transaction` interface.
// Actual field names (per types.ts): `monto`, `tikintag`, `empresa_id` /
// `empresa_nombre`. v2 functions below use the ACTUAL fields. The plan's
// instruction "sum Math.abs(tx.transactionAmount)" maps to "sum
// Math.abs(tx.monto)" — `Math.abs` retained for defensive symmetry with v2
// patterns in `bonos.ts` / `payouts.ts` even though direction='in' rows
// always have positive `monto` in production data.

/** Header KPIs for the v2 Recargas tab. */
export interface RecargaSummaryV2 {
  /** Number of recargas in the filtered range (count of rows after filter). */
  totalRecargas: number;
  /** Sum of `Math.abs(monto)` across the filtered set (COP). */
  volumenCOP: number;
  /**
   * Average ticket size: `volumenCOP / totalRecargas`. `0` (not NaN) when
   * `totalRecargas` is `0`.
   */
  recargaPromedio: number;
}

/**
 * One point on the v2 stacked timeline (PSE vs TRANSFER per Bogotá day).
 *
 * The v2 stacked-trend chart needs per-method breakdown to visualize PSE vs
 * TRANSFER over time (REC-V2-04 + REC-V2-08).
 */
export interface RecargaByDateV2 {
  /** ISO date `YYYY-MM-DD` interpreted in Bogotá. */
  date: string;
  pseCount: number;
  pseVolumen: number;
  transferCount: number;
  transferVolumen: number;
  totalCount: number;
  totalVolumen: number;
}

// === v2 Filter (allows BOTH PAYIN_PSE + PAYIN_TRANSFER; honors filters.status)

/**
 * v2 Recargas filter:
 *   1. `tipo` ∈ RECHARGE_TIPOS (`PAYIN_PSE` + `PAYIN_TRANSFER`).
 *   2. `direction === "in"` — recargas are money flowing IN to the platform.
 *   3. Status:
 *        - When `filters.status` is set (CROSS-V2-01 URL filter) honor it
 *          verbatim.
 *        - When undefined or empty, default to `["completed"]` (matches
 *          Phase 6 contract + REC-V2-01 baseline of "100% completadas" →
 *          completed is the operating default but lets failed/in-progress
 *          through when explicitly requested).
 *   4. Bogotá-anchored from/to (inclusive ends).
 *   5. Optional `empresa` filter — `t.empresa_id === filters.empresa`.
 *   6. `filters.tipo` is INTENTIONALLY ignored: the Recargas tab is recharge-
 *      by-definition (PAYIN_PSE + PAYIN_TRANSFER); the global `tipo`
 *      multi-select drives Inicio/Vista Cliente cross-cuts, not this tab.
 *      (Same convention as `filterBonosV2` / `filterPayoutsV2`.)
 *
 * The downstream aggregations partition by `tipo` (PSE vs TRANSFER) at
 * aggregation time, NOT at filter time — so one filter pass can feed
 * `summarizeRecargasV2` + `aggregateRechargeMethodSplit` +
 * `aggregateRechargesByDateV2` without re-iterating.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 */
export function filterRecargasV2(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const rechargeTypeSet = new Set<string>(RECHARGE_TIPOS);
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;
  const statusSet =
    filters.status && filters.status.length > 0
      ? new Set<string>(filters.status)
      : new Set<string>(["completed"]);

  return transactions.filter((t) => {
    if (!rechargeTypeSet.has(t.tipo)) return false;
    if (t.direction !== "in") return false;
    if (!statusSet.has(t.status)) return false;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) return false;
    if (ts < fromTs) return false;
    if (ts > toTs) return false;

    if (empresa && t.empresa_id !== empresa) return false;

    return true;
  });
}

/**
 * Compute v2 header KPIs from an already-filtered list of recargas.
 *
 * Pure. Empty input → `{ totalRecargas: 0, volumenCOP: 0, recargaPromedio: 0 }`
 * (no NaN / Infinity).
 *
 * @example
 *   summarizeRecargasV2([{ monto: 100000, ... }, { monto: 50000, ... }])
 *   // → { totalRecargas: 2, volumenCOP: 150000, recargaPromedio: 75000 }
 *   summarizeRecargasV2([])
 *   // → { totalRecargas: 0, volumenCOP: 0, recargaPromedio: 0 }
 */
export function summarizeRecargasV2(rows: Transaction[]): RecargaSummaryV2 {
  let volumenCOP = 0;
  for (const r of rows) {
    volumenCOP += Math.abs(r.monto);
  }
  const totalRecargas = rows.length;
  const recargaPromedio = totalRecargas > 0 ? volumenCOP / totalRecargas : 0;
  return { totalRecargas, volumenCOP, recargaPromedio };
}

/**
 * Group recargas by Bogotá calendar date producing one point per day with
 * data, partitioning each day's count and volume by `tipo` (PSE vs TRANSFER).
 *
 * Needed for the v2 stacked trend chart that visualizes PSE vs TRANSFER over
 * time (REC-V2-04 + REC-V2-08).
 *
 * Output is sorted ASCENDING by `date` so a line/bar chart can plot it
 * without re-sorting. NO zero-fill — days with zero recargas simply don't
 * appear; the chart library handles continuous-axis spacing on its own.
 *
 * Empty input → `[]`.
 *
 * @example
 *   aggregateRechargesByDateV2([
 *     { tipo: "PAYIN_PSE",      fecha: ..., monto: 100000, ... },
 *     { tipo: "PAYIN_TRANSFER", fecha: ..., monto: 200000, ... },
 *   ])
 *   // → [{ date: '2026-04-27', pseCount: 1, pseVolumen: 100000,
 *   //      transferCount: 1, transferVolumen: 200000,
 *   //      totalCount: 2, totalVolumen: 300000 }]
 */
export function aggregateRechargesByDateV2(
  rows: Transaction[],
): RecargaByDateV2[] {
  const byDay = new Map<string, RecargaByDateV2>();
  for (const r of rows) {
    const date = formatInTimeZone(r.fecha, BOGOTA_TZ, "yyyy-MM-dd");
    let cur = byDay.get(date);
    if (!cur) {
      cur = {
        date,
        pseCount: 0,
        pseVolumen: 0,
        transferCount: 0,
        transferVolumen: 0,
        totalCount: 0,
        totalVolumen: 0,
      };
      byDay.set(date, cur);
    }
    const amount = Math.abs(r.monto);
    cur.totalCount += 1;
    cur.totalVolumen += amount;
    if (r.tipo === "PAYIN_PSE") {
      cur.pseCount += 1;
      cur.pseVolumen += amount;
    } else if (r.tipo === "PAYIN_TRANSFER") {
      cur.transferCount += 1;
      cur.transferVolumen += amount;
    }
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

// === v2 Output types — adoption + method split + buckets + top users =======

/**
 * Recharge adoption — what fraction of all known users have done at least
 * one recarga in the filtered universe.
 *
 * Mirrors the shape of `aggregatePurchaseAdoption` in `cardUsage.ts` (Plan
 * 08-01) — distinct `tikintag` numerator + denominator, ratio. Cite REC-V2-03.
 * PRD baseline reading: 40 / 235 ≈ 17% adoption.
 */
export interface RechargeAdoption {
  /** Distinct `tikintag` count among `recargaRows`. */
  usersWithRecharge: number;
  /** Distinct `tikintag` count across the entire `allTx` universe. */
  totalUsers: number;
  /** `usersWithRecharge / totalUsers`; `0` when `totalUsers` is `0`. */
  adoptionRate: number;
}

/**
 * Method split — PSE vs TRANSFER counts, volumes, and shares.
 *
 * Shares are 0..1 BY COUNT (not by volume). PRD baseline reading
 * "85% PSE / 15% Transfer" describes the COUNT split, not the COP split —
 * PSE rows are typically smaller individual amounts but happen more often;
 * a volume-weighted share would tell a different story than the one the
 * page caption is anchored to. (REC-V2-04.)
 *
 * Returned as a literal `{ pse, transfer }` shape (NOT an array) so the v2
 * page can bind two cards directly off `result.pse` / `result.transfer`
 * without `.find()` / index lookup.
 */
export interface RechargeMethodSplit {
  pse: { count: number; volumen: number; share: number };
  transfer: { count: number; volumen: number; share: number };
}

/**
 * One bucket of the recarga amount distribution (REC-V2-06).
 *
 * Three fixed buckets: <$100K, $100K-$1M, >$1M. Boundary inclusivity per
 * `aggregateRechargeAmountDistribution` JSDoc (`<` vs `<=`). The chart
 * always renders all 3 buckets even when some are zero so the x-axis is
 * stable across filter changes.
 */
export interface RechargeAmountBucket {
  /** Display label: `"<$100K"` | `"$100K-$1M"` | `">$1M"`. */
  label: string;
  /** Lower bound in COP; `null` for the bottom bucket. */
  lowerCOP: number | null;
  /** Upper bound in COP; `null` for the top bucket. */
  upperCOP: number | null;
  /** Number of recargas falling in this bucket. */
  count: number;
  /** Sum of `Math.abs(monto)` for recargas in this bucket (COP). */
  volumenCOP: number;
}

/**
 * One row of the top-rechargers ranking (REC-V2-07) — grouped by
 * `tikintag` (NOT by `empresa_id`). Today they're the same projection per
 * the empresa-identity decision in 02-01-SUMMARY, but the v2 page binds to
 * the user-level identifier so a future empresa↔tikintag separation
 * doesn't change the ranking semantics.
 */
export interface TopRecharger {
  /** The recharger's tikintag (e.g. `"$mario"`). */
  tikintag: string;
  /**
   * Best-effort empresa display label from the first row seen for this
   * tikintag (currently equal to tikintag per 02-01 empresa-identity rule).
   * `undefined` only if no rows had a defined `empresa_nombre` (defensive).
   */
  empresa: string | undefined;
  /** Number of recargas this tikintag did in the filtered range. */
  recargas: number;
  /** Sum of `Math.abs(monto)` across those recargas (COP). */
  volumenCOP: number;
  /** `volumenCOP / recargas`; `0` when `recargas` is `0` (zero-safe). */
  recargaPromedio: number;
}

// === v2 Aggregations =======================================================

/**
 * Compute recharge adoption across the period-filtered universe (REC-V2-03).
 *
 * `allTx` is the period-filtered total transaction universe (any `tipo`,
 * any `direction`, any `status`) — used to count distinct users who EXIST in
 * the platform during the period. `recargaRows` is the recarga-filtered
 * subset (e.g. output of `filterRecargasV2`). Distinct counts use
 * `tikintag`; rows with empty/undefined `tikintag` are excluded from BOTH
 * numerator and denominator (defensive — a user without a tikintag can't
 * be counted).
 *
 * Pure. Empty `allTx` → `{ usersWithRecharge: 0, totalUsers: 0,
 * adoptionRate: 0 }` (no NaN / Infinity).
 *
 * PRD baseline (Plan 08 RESEARCH): 40 distinct rechargers / 235 total
 * users ≈ 17% adoption.
 */
export function aggregateRechargeAdoption(
  allTx: Transaction[],
  recargaRows: Transaction[],
): RechargeAdoption {
  const totalSet = new Set<string>();
  for (const t of allTx) {
    if (t.tikintag && t.tikintag.length > 0) totalSet.add(t.tikintag);
  }
  const rechargerSet = new Set<string>();
  for (const r of recargaRows) {
    if (r.tikintag && r.tikintag.length > 0) rechargerSet.add(r.tikintag);
  }
  const totalUsers = totalSet.size;
  const usersWithRecharge = rechargerSet.size;
  const adoptionRate = totalUsers > 0 ? usersWithRecharge / totalUsers : 0;
  return { usersWithRecharge, totalUsers, adoptionRate };
}

/**
 * Compute the PSE vs TRANSFER method split (REC-V2-04).
 *
 * Partitions the input by `tipo` into PSE vs TRANSFER buckets; per bucket
 * computes count, sum `Math.abs(monto)`, and share = `count / totalCount`.
 * Total count = PSE count + TRANSFER count (rows with any other `tipo`
 * shouldn't appear in the input — `filterRecargasV2` already gates on
 * RECHARGE_TIPOS — but if they did, they'd be ignored, not mixed in).
 *
 * Pure. Empty input → both buckets zero with `share: 0` (no NaN).
 *
 * Decision (cited above on `RechargeMethodSplit`): shares are by COUNT,
 * not by COP. Matches PRD baseline reading "85% PSE / 15% Transfer".
 */
export function aggregateRechargeMethodSplit(
  rows: Transaction[],
): RechargeMethodSplit {
  let pseCount = 0;
  let pseVolumen = 0;
  let transferCount = 0;
  let transferVolumen = 0;
  for (const r of rows) {
    const amount = Math.abs(r.monto);
    if (r.tipo === "PAYIN_PSE") {
      pseCount += 1;
      pseVolumen += amount;
    } else if (r.tipo === "PAYIN_TRANSFER") {
      transferCount += 1;
      transferVolumen += amount;
    }
  }
  const totalCount = pseCount + transferCount;
  const pseShare = totalCount > 0 ? pseCount / totalCount : 0;
  const transferShare = totalCount > 0 ? transferCount / totalCount : 0;
  return {
    pse: { count: pseCount, volumen: pseVolumen, share: pseShare },
    transfer: {
      count: transferCount,
      volumen: transferVolumen,
      share: transferShare,
    },
  };
}

/**
 * Bucket recargas into 3 fixed amount tiers (REC-V2-06).
 *
 * Buckets, in returned order:
 *   1. `<$100K`    — `amount < 100_000`              (lowerCOP: null,    upperCOP: 100_000)
 *   2. `$100K-$1M` — `100_000 <= amount <= 1_000_000` (lowerCOP: 100_000, upperCOP: 1_000_000)
 *   3. `>$1M`      — `amount > 1_000_000`            (lowerCOP: 1_000_000, upperCOP: null)
 *
 * Boundary inclusivity (UNAMBIGUOUS):
 *   - The middle bucket is INCLUSIVE on BOTH ends — exactly $100K lands
 *     in the middle, exactly $1M lands in the middle.
 *   - The bottom bucket is `< 100K` (strictly less than).
 *   - The top bucket is `> 1M` (strictly greater than).
 *
 * Always returns all 3 buckets even when some are zero — the v2 chart
 * needs a stable axis across filter changes (a bucket disappearing
 * mid-render would re-shuffle the layout).
 *
 * Amounts use `Math.abs(monto)` (defensive — direction='in' rows are
 * already positive in production but the abs guard matches the rest of
 * the v2 surface).
 */
export function aggregateRechargeAmountDistribution(
  rows: Transaction[],
): RechargeAmountBucket[] {
  const buckets: RechargeAmountBucket[] = [
    { label: "<$100K", lowerCOP: null, upperCOP: 100_000, count: 0, volumenCOP: 0 },
    {
      label: "$100K-$1M",
      lowerCOP: 100_000,
      upperCOP: 1_000_000,
      count: 0,
      volumenCOP: 0,
    },
    { label: ">$1M", lowerCOP: 1_000_000, upperCOP: null, count: 0, volumenCOP: 0 },
  ];
  for (const r of rows) {
    const amount = Math.abs(r.monto);
    let bucket: RechargeAmountBucket;
    if (amount < 100_000) {
      bucket = buckets[0];
    } else if (amount <= 1_000_000) {
      bucket = buckets[1];
    } else {
      bucket = buckets[2];
    }
    bucket.count += 1;
    bucket.volumenCOP += amount;
  }
  return buckets;
}

/**
 * Top rechargers ranked by `volumenCOP` DESC (REC-V2-07).
 *
 * Groups recargas by `tikintag`. Rows with empty/undefined `tikintag` are
 * skipped defensively (cannot attribute a recarga to no one). Per group:
 *   - `recargas`: number of rows
 *   - `volumenCOP`: sum of `Math.abs(monto)`
 *   - `empresa`: first-seen `empresa_nombre` for that tikintag (today
 *     equal to tikintag per the 02-01 empresa-identity decision; will
 *     diverge naturally once a real display column lands)
 *   - `recargaPromedio`: `volumenCOP / recargas` (zero-safe via `recargas > 0`
 *     guard, though by construction every group has `recargas >= 1`)
 *
 * Default `limit = 10` per REC-V2-07. Returns a NEW array sliced to the
 * top-N — no mutation of the input.
 *
 * Pure. O(n + k log k) where k = distinct tikintags.
 */
export function aggregateTopRechargers(
  rows: Transaction[],
  limit = 10,
): TopRecharger[] {
  const acc = new Map<string, TopRecharger>();
  for (const r of rows) {
    const tikintag = r.tikintag;
    if (!tikintag || tikintag.length === 0) continue;
    const amount = Math.abs(r.monto);
    const cur = acc.get(tikintag);
    if (cur) {
      cur.recargas += 1;
      cur.volumenCOP += amount;
    } else {
      acc.set(tikintag, {
        tikintag,
        empresa: r.empresa_nombre || undefined,
        recargas: 1,
        volumenCOP: amount,
        recargaPromedio: 0, // filled in second pass
      });
    }
  }
  const ranked = Array.from(acc.values());
  for (const row of ranked) {
    row.recargaPromedio =
      row.recargas > 0 ? row.volumenCOP / row.recargas : 0;
  }
  ranked.sort((a, b) => b.volumenCOP - a.volumenCOP);
  return ranked.slice(0, limit);
}
