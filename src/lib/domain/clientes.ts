/**
 * Clientes domain — pure aggregations over `Transaction[]` for the
 * Phase 5 list page (CLI-01..04) and per-empresa profile page (CLI-05/06).
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué es una empresa",
 * "cuándo está activa", "cuál es su histórico vs el período", "cómo se ven
 * sus últimos 12 meses". UI consumers (Plan 05-02 components, Plan 05-03
 * profile components, Plan 05-04 page composition) import the functions
 * here and stay dumb about the underlying data shape. Mirror of `bonos.ts`
 * / `recargas.ts` / `inicio.ts` design rules — same shape, same purity
 * guarantees, adapted to empresa-centric aggregations.
 *
 * Design rules (deliberate, mirror of bonos.ts/recargas.ts/inicio.ts):
 *   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`, or
 *     `lib/format`. Date formatting (when needed in Task 2) is done via
 *     `formatInTimeZone` from `date-fns-tz` directly so this module stays
 *     free of the project's Intl gate. This makes every function callable
 *     from Server Components, Client Components, scripts, and (future)
 *     tests without setup.
 *   - All functions are pure: same input → same output, no side effects
 *     beyond `Date.now()` defaulting in `aggregateMonthlyActivity` (Task 2).
 *   - Date math is anchored to "America/Bogota" (UTC-5, no DST) — same
 *     convention as `url-state.ts` / `bonos.ts` / `inicio.ts` / `recargas.ts`
 *     so filters and aggregations agree on what "a day" or "a month" means.
 *
 * --- Clientes Domain Contract ---
 *
 * - **An empresa** = one distinct `empresa_id` seen across BD_Plataforma
 *   transactions. Today (Phase 2 decision) `empresa_id === tikintag`; once
 *   BD_Plataforma adds a real display-name column, this module surfaces it
 *   automatically via the schema's transform.
 *
 * - **Status convention**: `'activa'` = the empresa has ≥1 activity-counting
 *   tx (direction='in' AND status='completed') in the date filter window;
 *   `'inactiva'` = does not. Tying status to the filter window (not to a
 *   fixed "last 30 days") lets the user explore "who was active in Q1
 *   vs Q2" by adjusting the date range — the dashboard's filters double as
 *   activity probes.
 *
 * - **Histórico vs Período**: `montoHistorico` is absolute — sum across
 *   ALL TIME of activity-counting tx for the empresa, regardless of the
 *   filter window. `montoPeriod` is sum within the filter window. Both are
 *   produced from a SINGLE pass over transactions to amortize the cost
 *   (the list page renders both columns side-by-side).
 *
 * - **Empresa filter is IGNORED for the index**: the table on /clientes
 *   shows all empresas, regardless of `filters.empresa`. The empresa filter
 *   in the URL is a profile-picker (Plan 05-04 routes `?empresa=$mario` to
 *   /clientes/$mario), NOT a row-narrowing operator on the index. Documented
 *   inline in `deriveEmpresasIndex` JSDoc.
 *
 * - **The "activity-counting" predicate** = `direction === 'in' && status
 *   === 'completed'`. Universal across bonos / recargas / inicio: a tx
 *   counts as activity only if money actually arrived. Rejected tx never
 *   landed money; outflows are downstream of activity (refunds, payouts,
 *   fees) and would double-count if they triggered "activa".
 */

import type { Transaction } from "./types";
import type { DashboardFilters } from "@/lib/url-state";

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
 * Verbatim copy from `bonos.ts:53-60` / `recargas.ts:92-99` /
 * `inicio.ts:60-67`. DRY-ing across modules costs more than the inline ~10
 * lines (would require a new shared util that's imported by every domain
 * module; the inline cost is a one-time copy). Fifth domain module to make
 * this DRY-vs-cohesion call.
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

// --- Predicates -------------------------------------------------------------

/**
 * "Activity-counting" predicate. Mirror of the bonos / recargas / inicio
 * filter contracts: only completed inflows count as activity. Direction='in'
 * + status='completed' is the universal "money actually arrived" gate.
 */
function isActivityCounting(t: Transaction): boolean {
  return t.direction === "in" && t.status === "completed";
}

// --- Output types -----------------------------------------------------------

/** Activity status of an empresa in the current filter window. */
export type EmpresaStatus = "activa" | "inactiva";

/** One row in the /clientes list table. */
export interface EmpresaListRow {
  empresa_id: string;
  empresa_nombre: string;
  /** Count of activity-counting tx in date filter window. */
  txPeriod: number;
  /** Sum of monto for activity-counting tx in date filter window (COP). */
  montoPeriod: number;
  /** Sum of monto for activity-counting tx across ALL TIME (COP). */
  montoHistorico: number;
  /** Most recent activity-counting tx fecha across ALL TIME. */
  ultimaActividad: Date;
  /** Most recent activity-counting tx fecha WITHIN date filter window; null if none. */
  ultimaActividadInPeriod: Date | null;
  /** 'activa' if ultimaActividadInPeriod is non-null; else 'inactiva'. */
  status: EmpresaStatus;
}

/** Header KPIs for /clientes list page. */
export interface EmpresasIndexSummary {
  totalEmpresas: number;
  empresasActivas: number;
}

/** Header data for the /clientes/[empresaId] profile. */
export interface EmpresaProfileSummary {
  empresa_id: string;
  empresa_nombre: string;
  status: EmpresaStatus;
  ultimaActividad: Date;
  ultimaActividadInPeriod: Date | null;
  txHistorico: number;
  montoHistorico: number;
  txPeriod: number;
  montoPeriod: number;
}

// --- Aggregations -----------------------------------------------------------

/**
 * Build the per-empresa index that powers the /clientes list table.
 *
 * Algorithm (single pass over `transactions`):
 *   1. For each activity-counting tx (direction='in' && status='completed'):
 *      - Lookup or create per-empresa accumulator keyed by `empresa_id`.
 *      - Accumulate `txHistorico++`, `montoHistorico += monto`.
 *      - Update `ultimaActividad` to max(ultimaActividad, tx.fecha).
 *      - If the tx's fecha falls within `[fromTs, toTs]` (Bogotá-anchored):
 *        - Accumulate `txPeriod++`, `montoPeriod += monto`.
 *        - Update `ultimaActividadInPeriod` to max(ultimaActividadInPeriod, tx.fecha).
 *   2. Empresa name is "first occurrence wins" per `empresa_id` (mirror of
 *      `empresas.ts` registry).
 *   3. Skip rows with empty / whitespace `empresa_id` defensively (a row
 *      should never reach here with empty empresa_id given the schema, but
 *      this guard prevents a phantom blank row in the table if data drifts).
 *   4. `status = 'activa'` if `ultimaActividadInPeriod !== null`, else
 *      `'inactiva'`.
 *   5. Sort the output by `montoHistorico` DESC (largest empresas first;
 *      matches the Bonos-leaderboard convention).
 *
 * The empresa filter (`filters.empresa`) is **IGNORED** here on purpose:
 * the /clientes table is the place where the user picks an empresa, NOT
 * where they narrow to one. Plan 05-04 routes a clicked row to
 * `/clientes/$mario` (or whatever empresa_id) which then calls
 * `findEmpresa` for the profile view. Narrowing the index would defeat
 * the table's purpose.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * @example
 *   deriveEmpresasIndex(allTx, { from: '2026-04-01', to: '2026-04-30' })
 *   // → [
 *   //     { empresa_id: '$mario',    montoHistorico: 5_000_000, montoPeriod: 1_200_000, status: 'activa', ... },
 *   //     { empresa_id: '$tikincol', montoHistorico: 3_500_000, montoPeriod:         0, status: 'inactiva', ... },
 *   //   ]
 */
export function deriveEmpresasIndex(
  transactions: Transaction[],
  filters: DashboardFilters,
): EmpresaListRow[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);

  // Per-empresa accumulator. We keep `txHistorico` internal (not in the
  // EmpresaListRow output) — the list table doesn't need it; the profile
  // does, and uses `findEmpresa` for that.
  type Acc = EmpresaListRow & { txHistorico: number };
  const byEmpresa = new Map<string, Acc>();

  for (const t of transactions) {
    if (!isActivityCounting(t)) continue;
    const id = t.empresa_id;
    if (!id || id.trim().length === 0) continue;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) continue;
    const inWindow = ts >= fromTs && ts <= toTs;

    let cur = byEmpresa.get(id);
    if (!cur) {
      cur = {
        empresa_id: id,
        empresa_nombre: t.empresa_nombre || id,
        txHistorico: 0,
        txPeriod: 0,
        montoPeriod: 0,
        montoHistorico: 0,
        ultimaActividad: t.fecha,
        ultimaActividadInPeriod: null,
        status: "inactiva",
      };
      byEmpresa.set(id, cur);
    }

    cur.txHistorico += 1;
    cur.montoHistorico += t.monto;
    if (t.fecha.getTime() > cur.ultimaActividad.getTime()) {
      cur.ultimaActividad = t.fecha;
    }

    if (inWindow) {
      cur.txPeriod += 1;
      cur.montoPeriod += t.monto;
      if (
        cur.ultimaActividadInPeriod === null ||
        t.fecha.getTime() > cur.ultimaActividadInPeriod.getTime()
      ) {
        cur.ultimaActividadInPeriod = t.fecha;
      }
    }
  }

  const rows: EmpresaListRow[] = Array.from(byEmpresa.values()).map((acc) => {
    // Strip the internal txHistorico from the output shape.
    const { txHistorico: _txHistorico, ...row } = acc;
    void _txHistorico;
    return {
      ...row,
      status: row.ultimaActividadInPeriod !== null ? "activa" : "inactiva",
    };
  });

  rows.sort((a, b) => b.montoHistorico - a.montoHistorico);
  return rows;
}

/**
 * Compute header KPIs for the /clientes list page from the index rows.
 *
 * Pure. Empty input → `{ totalEmpresas: 0, empresasActivas: 0 }`
 * (no NaN / Infinity).
 *
 * @example
 *   summarizeEmpresasIndex([
 *     { ..., status: 'activa' },
 *     { ..., status: 'activa' },
 *     { ..., status: 'inactiva' },
 *   ])
 *   // → { totalEmpresas: 3, empresasActivas: 2 }
 */
export function summarizeEmpresasIndex(
  rows: EmpresaListRow[],
): EmpresasIndexSummary {
  let empresasActivas = 0;
  for (const r of rows) {
    if (r.status === "activa") empresasActivas += 1;
  }
  return {
    totalEmpresas: rows.length,
    empresasActivas,
  };
}

/**
 * Build the per-empresa profile header data for the /clientes/[empresaId]
 * page (CLI-05).
 *
 * Single pass over transactions. For each activity-counting tx with
 * matching `empresa_id`, accumulate `txHistorico`, `montoHistorico`,
 * `ultimaActividad`; if the tx's fecha is also in the filter window,
 * accumulate `txPeriod`, `montoPeriod`, `ultimaActividadInPeriod`.
 *
 * Empresa name is "first occurrence wins" per `empresa_id` (mirror of
 * `empresas.ts` registry).
 *
 * Returns `null` if:
 *   - `empresaId` is empty / whitespace, OR
 *   - no activity-counting tx is ever seen for `empresaId` (the profile
 *     page can render its 404 fallback).
 *
 * `status = 'activa'` if `ultimaActividadInPeriod !== null`, else
 * `'inactiva'`.
 *
 * Pure: does not mutate `transactions`.
 *
 * @example
 *   findEmpresa(allTx, '$mario', { from: '2026-04-01', to: '2026-04-30' })
 *   // → {
 *   //     empresa_id: '$mario',
 *   //     empresa_nombre: '$mario',
 *   //     status: 'activa',
 *   //     ultimaActividad: <Date 2026-04-28>,
 *   //     ultimaActividadInPeriod: <Date 2026-04-28>,
 *   //     txHistorico: 142,
 *   //     montoHistorico: 5_000_000,
 *   //     txPeriod: 38,
 *   //     montoPeriod: 1_200_000,
 *   //   }
 *
 *   findEmpresa(allTx, '$unknown', filters)
 *   // → null
 */
export function findEmpresa(
  transactions: Transaction[],
  empresaId: string,
  filters: DashboardFilters,
): EmpresaProfileSummary | null {
  if (!empresaId || empresaId.trim().length === 0) return null;

  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);

  let empresa_nombre: string | null = null;
  let ultimaActividad: Date | null = null;
  let ultimaActividadInPeriod: Date | null = null;
  let txHistorico = 0;
  let montoHistorico = 0;
  let txPeriod = 0;
  let montoPeriod = 0;

  for (const t of transactions) {
    if (!isActivityCounting(t)) continue;
    if (t.empresa_id !== empresaId) continue;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) continue;

    if (empresa_nombre === null) {
      empresa_nombre = t.empresa_nombre || t.empresa_id;
    }

    txHistorico += 1;
    montoHistorico += t.monto;
    if (ultimaActividad === null || ts > ultimaActividad.getTime()) {
      ultimaActividad = t.fecha;
    }

    if (ts >= fromTs && ts <= toTs) {
      txPeriod += 1;
      montoPeriod += t.monto;
      if (
        ultimaActividadInPeriod === null ||
        ts > ultimaActividadInPeriod.getTime()
      ) {
        ultimaActividadInPeriod = t.fecha;
      }
    }
  }

  // No activity-counting tx ever seen for this empresa.
  if (ultimaActividad === null || empresa_nombre === null) return null;

  return {
    empresa_id: empresaId,
    empresa_nombre,
    status: ultimaActividadInPeriod !== null ? "activa" : "inactiva",
    ultimaActividad,
    ultimaActividadInPeriod,
    txHistorico,
    montoHistorico,
    txPeriod,
    montoPeriod,
  };
}

// --- Reserved for Task 2 ----------------------------------------------------
// `aggregateMonthlyActivity` + `MonthlyActivity` will be appended in Task 2,
// along with the runtime `formatInTimeZone` import from `date-fns-tz` and
// the `BOGOTA_TZ` constant.
