/**
 * Bonos domain — pure aggregations over `Transaction[]`.
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué es un bono", "cómo se
 * cuenta", "cómo se agrupa". UI consumers (Plan 07-02 components, Plan
 * 07-04 page) import the functions here and stay dumb about the underlying
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
 *
 * v2-only surface (post Plan 09-03 prune):
 *   The v1 surface (filterBonos, summarizeBonos, aggregateBonosByDate,
 *   aggregateBonosByEmpresa, top10Empresas, BonoSummary, BonoByDate,
 *   BonoByEmpresa) was deleted in Plan 09-03 once the last v1 consumer
 *   (clientes/[empresaId] v1 page + EmpresaMiniCards) was rewritten /
 *   deleted. The v2 surface — `BonoSummaryV2`, `BonoByDateV2`,
 *   `BonoTikintagRow`, `filterBonosV2`, `summarizeBonosV2`,
 *   `aggregateBonosByDateV2`, `aggregateTopEmisores`, `aggregateTopReceptores`
 *   — is the only public surface.
 */

import { formatInTimeZone } from "date-fns-tz";

import { BOGOTA_TZ, toBogotaISODate } from "@/lib/format";
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

// === v2 Output types (Plan 07-01 — split source/destination) ================

/**
 * Header KPIs for the v2 Bonos surface. Carries BOTH directions because
 * Vista Cliente needs the cliente's bonos recibidos (countIn / montoIn).
 * The /bonos tab itself only renders the OUT side (countOut / montoOut /
 * ticketPromedio); see `KPICardsV2`.
 *
 * `ticketPromedio` is computed over OUT only — the operative-lens KPI is
 * "ticket promedio de bonos pagados". Vista Cliente displays its own
 * per-direction breakdown (BonosClienteCards) instead of this single
 * promedio.
 */
export interface BonoSummaryV2 {
  /** Bonos recibidos in the filtered range (BONUS direction=in). */
  countIn: number;
  /** Bonos enviados in the filtered range (BONUS direction=out). */
  countOut: number;
  /** Sum of `monto` for bonos recibidos (COP). */
  montoIn: number;
  /** Sum of `monto` for bonos enviados (COP). */
  montoOut: number;
  /**
   * Average ticket size of bonos enviados: `montoOut / countOut`.
   * `0` (not NaN) when there are no bonos enviados.
   */
  ticketPromedio: number;
  /**
   * Sum of `comision` (= `total_transaction_fee` from the Sheet) across
   * bonos enviados. The fee Tikin charged the empresa pagadora to send
   * those bonos.
   */
  feeOut: number;
  /**
   * `feeOut / montoOut` — effective fee percentage on bonos enviados
   * (0..1 fraction). `0` when `montoOut === 0`.
   */
  feeOutPct: number;
}

/** One point on the v2 timeline (in vs out per Bogotá day). */
export interface BonoByDateV2 {
  /** ISO date `YYYY-MM-DD` interpreted in Bogotá. */
  date: string;
  countIn: number;
  countOut: number;
  montoIn: number;
  montoOut: number;
}

/** One row of the top-emisores or top-receptores ranking. */
export interface BonoTikintagRow {
  /** Tikintag (sender for emisores, receiver for receptores). */
  tikintag: string;
  /** Number of bonos this tikintag emitted/received in the filtered set. */
  count: number;
  /** Sum of `monto` across those bonos (COP). */
  monto: number;
}

// === v2 Filter (allows BOTH directions; honors filters.status from URL) =====

/**
 * v2 Bonos filter:
 *   1. `tipo` ∈ BONO_TRANSACTION_TYPES (currently just `'BONUS'`).
 *   2. `direction` is NOT pre-filtered. Both `in` and `out` flow through;
 *      v2 page composition splits them downstream (top emisores ranks the
 *      `out` side, top receptores ranks the `in` side, summary counts both).
 *   3. Status:
 *        - When `filters.status` is undefined or empty: default to `completed`
 *          (rejected/in_progress bonos never carried money).
 *        - When `filters.status` is set (CROSS-V2-01 URL filter): honor the
 *          user's selection verbatim. The Set lookup tolerates the
 *          `OTRO_STATUS` fallback gracefully.
 *   4. Bogotá-anchored from/to (inclusive ends).
 *   5. Optional `empresa` filter — `t.empresa_id === filters.empresa`.
 *   6. `filters.tipo` is INTENTIONALLY ignored: the Bonos tab is BONUS-by-
 *      definition; the global `tipo` multi-select drives Inicio/Vista
 *      Cliente cross-cuts, not this tab. (CROSS-V2-02 honoring is
 *      per-section per Plan 06-03 SUMMARY.)
 *
 * Pure: returns a new array; does not mutate `transactions`.
 */
export function filterBonosV2(
  transactions: Transaction[],
  filters: DashboardFilters,
): Transaction[] {
  const bonoTypeSet = new Set<string>(BONO_TRANSACTION_TYPES);
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const empresa = filters.empresa;
  const statusSet =
    filters.status && filters.status.length > 0
      ? new Set<string>(filters.status)
      : new Set<string>(["completed"]);

  return transactions.filter((t) => {
    if (!bonoTypeSet.has(t.tipo)) return false;
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
 * Compute v2 header KPIs from an already-filtered list of bonos.
 *
 * Pure. Empty input → `{ countIn: 0, countOut: 0, montoIn: 0, montoOut: 0,
 * ticketPromedio: 0 }` (no NaN / Infinity).
 *
 * "in" / "out" partitioning is by `direction`. Rows with
 * `direction === 'OTRO_DIRECTION'` (the defensive fallback in
 * `types.ts`) are NOT counted on either side — they're surfaced as a
 * count discrepancy that future telemetry can flag, but they don't
 * silently inflate either bucket.
 */
export function summarizeBonosV2(bonos: Transaction[]): BonoSummaryV2 {
  let countIn = 0;
  let countOut = 0;
  let montoIn = 0;
  let montoOut = 0;
  let feeOut = 0;
  for (const b of bonos) {
    if (b.direction === "in") {
      countIn += 1;
      montoIn += b.monto;
    } else if (b.direction === "out") {
      countOut += 1;
      montoOut += b.monto;
      feeOut += b.comision;
    }
  }
  const ticketPromedio = countOut > 0 ? montoOut / countOut : 0;
  const feeOutPct = montoOut > 0 ? feeOut / montoOut : 0;
  return {
    countIn,
    countOut,
    montoIn,
    montoOut,
    ticketPromedio,
    feeOut,
    feeOutPct,
  };
}

/**
 * Group bonos by Bogotá calendar date producing one point per day with
 * data, partitioning each day's count and monto by direction (in vs out).
 *
 * Output sorted ASCENDING by `date` (no zero-fill — same convention as
 * the legacy v1 by-date aggregation that lived here pre Plan 09-03).
 * The shape matches a stacked-bar Recharts dataset directly: each row
 * carries `countIn` + `countOut` (or `montoIn` + `montoOut` if Plan 07-02
 * chooses to stack by amount).
 */
export function aggregateBonosByDateV2(bonos: Transaction[]): BonoByDateV2[] {
  const byDay = new Map<string, BonoByDateV2>();
  for (const b of bonos) {
    const date = toBogotaISODate(b.fecha);
    let cur = byDay.get(date);
    if (!cur) {
      cur = { date, countIn: 0, countOut: 0, montoIn: 0, montoOut: 0 };
      byDay.set(date, cur);
    }
    if (b.direction === "in") {
      cur.countIn += 1;
      cur.montoIn += b.monto;
    } else if (b.direction === "out") {
      cur.countOut += 1;
      cur.montoOut += b.monto;
    }
  }
  return Array.from(byDay.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * Same shape as `aggregateBonosByDateV2` but bucket = Bogotá calendar
 * month (`YYYY-MM`). Used by /bonos when the requested range spans more
 * than 60 days — daily granularity becomes noisy and the operative
 * read-out is "qué meses pagamos más bonos".
 */
export function aggregateBonosByMonthV2(bonos: Transaction[]): BonoByDateV2[] {
  const byMonth = new Map<string, BonoByDateV2>();
  for (const b of bonos) {
    const date = formatInTimeZone(b.fecha, BOGOTA_TZ, "yyyy-MM");
    let cur = byMonth.get(date);
    if (!cur) {
      cur = { date, countIn: 0, countOut: 0, montoIn: 0, montoOut: 0 };
      byMonth.set(date, cur);
    }
    if (b.direction === "in") {
      cur.countIn += 1;
      cur.montoIn += b.monto;
    } else if (b.direction === "out") {
      cur.countOut += 1;
      cur.montoOut += b.monto;
    }
  }
  return Array.from(byMonth.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
}

/**
 * Top emisores de bonos — rank tikintags by total monto SENT (DESC).
 * Tiebreak: count DESC, then tikintag lex ASC.
 *
 * Reads `sourceTransferTikintag` (Plan 07-01 schema add). A bono with no
 * `sourceTransferTikintag` is excluded from the ranking entirely.
 * Default `n = 10`.
 *
 * Pure. Returns a NEW array.
 */
export function aggregateTopEmisores(
  bonos: Transaction[],
  n = 10,
): BonoTikintagRow[] {
  const acc = new Map<string, BonoTikintagRow>();
  for (const b of bonos) {
    if (b.direction !== "out") continue;
    const tikintag = b.sourceTransferTikintag;
    if (!tikintag || tikintag.length === 0) continue;
    const cur = acc.get(tikintag);
    if (cur) {
      cur.count += 1;
      cur.monto += b.monto;
    } else {
      acc.set(tikintag, { tikintag, count: 1, monto: b.monto });
    }
  }
  const rows = Array.from(acc.values());
  rows.sort((a, b) => {
    if (b.monto !== a.monto) return b.monto - a.monto;
    if (b.count !== a.count) return b.count - a.count;
    return a.tikintag < b.tikintag ? -1 : a.tikintag > b.tikintag ? 1 : 0;
  });
  return rows.slice(0, n);
}
