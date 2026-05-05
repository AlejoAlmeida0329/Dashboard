/**
 * Period utilities — pure math for "prior period" comparisons and
 * zero-safe percent change. Phase 4 introduces "delta vs período
 * anterior" as a new dashboard primitive (every Inicio KPI carries
 * one); this module owns the math so both `inicio.ts` and a future
 * `recargas.ts` can call into it without re-implementing the contract.
 *
 * Design rules (deliberate, mirror of `bonos.ts:9-22`):
 *   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`,
 *     or `lib/format`. The `lib/format` exclusion matters here because
 *     `period.ts` is more foundational than `format.ts` (it can be
 *     called from anywhere); we therefore inline the literal Bogotá
 *     `T00:00:00-05:00` offset construction (same convention as
 *     `bonos.ts:53-62`) rather than introduce a circular dependency.
 *   - Functions are pure: same input → same output, no side effects,
 *     no `Date.now()` or `process.env` reads.
 *   - Bogotá is UTC-5 with no DST. All date arithmetic is anchored to
 *     the Bogotá calendar so that "abril 2026" really means the 30
 *     calendar days observed in Bogotá, not 30 calendar days in UTC.
 *   - `pctChange` returns a fraction (0.123 = +12.3%); consumers feed
 *     this to `formatPercent` in `format.ts` (which expects a fraction).
 *     Zero-divisor → null (caller renders em-dash, never NaN/Infinity).
 */

import { differenceInCalendarDays, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import type { DashboardFilters } from "@/lib/url-state";

const BOGOTA_TZ = "America/Bogota";

// --- Prior-period window ----------------------------------------------------

/**
 * Given the active filters, return the immediately-prior window of the
 * SAME LENGTH IN DAYS (Bogotá calendar). Returns null when either
 * `from` or `to` is missing — there is no defined "prior" for an
 * unbounded window.
 *
 * Per 04-CONTEXT.md spec:
 *   - "abril 2026" (30d, 2026-04-01..2026-04-30) → "marzo 2-31 2026"
 *     (30d, 2026-03-02..2026-03-31), NOT March 1-31. Prior is the
 *     immediately-prior window of the SAME length, not the prior
 *     calendar month.
 *   - 5-day custom range (2026-04-15..2026-04-19) → 5-day window
 *     immediately before `from` (2026-04-10..2026-04-14).
 *   - "últimos 7 días" → the 7 days previous to those.
 *
 * Pure: same input → same output. No `Date.now()` reads.
 */
export function computePriorPeriod(
  filters: DashboardFilters,
): { from: string; to: string } | null {
  if (!filters.from || !filters.to) return null;

  // Defensive shape check (url-state already enforces, but a stray
  // hand-crafted URL or test fixture must not produce NaN dates).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) return null;

  // Anchor BOTH endpoints at 00:00 Bogotá (the start of that day).
  // Using a literal offset avoids the silent off-by-one where
  // `new Date('2026-04-01')` parses as UTC midnight = 19:00 the prior
  // day in Bogotá. Same convention as `bonos.ts:53-62` and `url-state.ts`.
  const fromMs = Date.parse(`${filters.from}T00:00:00-05:00`);
  const toMs = Date.parse(`${filters.to}T00:00:00-05:00`);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  if (toMs < fromMs) return null;

  const fromDate = new Date(fromMs);
  const toDate = new Date(toMs);

  // Inclusive both ends — same convention as `filterBonos`. April
  // 1–30 is 30 days (not 29).
  const lengthDays = differenceInCalendarDays(toDate, fromDate) + 1;

  const priorTo = subDays(fromDate, 1);
  const priorFrom = subDays(priorTo, lengthDays - 1);

  return {
    from: formatInTimeZone(priorFrom, BOGOTA_TZ, "yyyy-MM-dd"),
    to: formatInTimeZone(priorTo, BOGOTA_TZ, "yyyy-MM-dd"),
  };
}

// --- Percent change ---------------------------------------------------------

/**
 * Zero-safe percent change. Returns null when `prior` is 0, NaN, or
 * non-finite — caller renders em-dash. Mirrors the `pctDelTotal`
 * pattern from `bonos.ts:286` (zero-divisor → 0/null, never NaN/Infinity
 * leaking into the chart).
 *
 * Returns a fraction (0.123 = +12.3%); consumers feed this to
 * `formatPercent` in `lib/format.ts:78`.
 *
 * @example
 *   pctChange(120, 100)  // +0.2  (+20%)
 *   pctChange( 80, 100)  // -0.2  (-20%)
 *   pctChange(  0, 100)  // -1    (-100%)
 *   pctChange(100,   0)  // null  (no defined "from zero" change)
 *   pctChange(100, NaN)  // null
 */
export function pctChange(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null;
  if (!Number.isFinite(current)) return null;
  return (current - prior) / prior;
}
