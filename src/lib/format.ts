/**
 * Single source of truth for all locale and timezone formatting in the
 * Tikin Dashboard. Every COP currency, percentage, integer, date, or
 * datetime that surfaces in the UI MUST go through one of the helpers
 * exported here.
 *
 * Why this exists:
 *   - Pitfall 9 (currency drift): If multiple files instantiate
 *     `Intl.NumberFormat` independently, they will eventually diverge
 *     on `maximumFractionDigits`, `currencyDisplay`, or grouping symbol
 *     (es-CO uses `.` for thousands and `,` for decimals — easy to flip
 *     by accident).
 *   - Pitfall 10 (timezone drift): Vercel Functions run in UTC. Bogotá
 *     is UTC-5 with no DST. A naked `new Date().toLocaleString('es-CO')`
 *     in a Server Component running on Vercel produces UTC-flavored
 *     output, not what a Bogotá-based viewer expects. We force
 *     America/Bogota explicitly via date-fns-tz.
 *
 * Policy:
 *   - DO NOT call `Intl.NumberFormat`, `toLocaleString`,
 *     `toLocaleDateString`, or `toLocaleTimeString` outside this file.
 *   - DO NOT instantiate naked `new Date(...)` for display. If you need
 *     "now" for display, call `formatBogotaDateTime(new Date())` once
 *     at the render site — the Date constructor is fine for capturing
 *     the moment; it is the formatting that must be centralized.
 */

import { formatInTimeZone } from "date-fns-tz";
import { es as esLocale } from "date-fns/locale";

export const BOGOTA_TZ = "America/Bogota";

// --- Numbers ----------------------------------------------------------------

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  // COP in practice has no decimals (centavos do not circulate). The
  // dashboard surfaces aggregate revenue and payouts in whole pesos.
  maximumFractionDigits: 0,
});

const intCO = new Intl.NumberFormat("es-CO", {
  maximumFractionDigits: 0,
});

const pctCO = new Intl.NumberFormat("es-CO", {
  style: "percent",
  maximumFractionDigits: 1,
});

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

/**
 * `formatCOP(1234567)` → `'$ 1.234.567'`
 * `formatCOP(null)` → `'—'` (em dash, our standard "no data" marker)
 */
export const formatCOP = (n: number | null | undefined): string => {
  if (!isFiniteNumber(n)) return "—";
  return cop.format(n);
};

/**
 * `formatInteger(15234)` → `'15.234'`. Use for transaction counts,
 * user counts, etc.
 */
export const formatInteger = (n: number | null | undefined): string => {
  if (!isFiniteNumber(n)) return "—";
  return intCO.format(n);
};

/**
 * Expects a fraction (0.235 → '23,5%'), NOT an already-multiplied
 * percentage. This matches how `Intl.NumberFormat({style:'percent'})`
 * works and avoids the classic bug of "multiplying by 100 twice".
 */
export const formatPercent = (n: number | null | undefined): string => {
  if (!isFiniteNumber(n)) return "—";
  return pctCO.format(n);
};

/**
 * Format a number of minutes for KPI display.
 *
 * Examples:
 *   formatMinutes(0)      → "—"        (em-dash, our standard "no data" marker)
 *   formatMinutes(0.5)    → "<1 min"
 *   formatMinutes(3.7)    → "4 min"
 *   formatMinutes(45)     → "45 min"
 *   formatMinutes(125)    → "2h 5min"
 *   formatMinutes(180)    → "3h"
 *   formatMinutes(1440)   → "1d"
 *   formatMinutes(2880)   → "2d"
 *   formatMinutes(null)   → "—"
 *   formatMinutes(NaN)    → "—"
 *
 * Used by the v2 Payouts cockpit (Plan 07-04 PAY-V2-03 "tiempo promedio")
 * + the AgingAlert table. Mirrors the formatDuration policy below: a
 * single shape across the dashboard, em-dash for missing/zero rather than
 * "0 min" or "NaN min".
 */
export const formatMinutes = (m: number | null | undefined): string => {
  if (m === null || m === undefined) return "—";
  if (!Number.isFinite(m)) return "—";
  if (m === 0) return "—";
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const mm = Math.round(m - h * 60);
    return mm > 0 ? `${h}h ${mm}min` : `${h}h`;
  }
  const d = Math.round(m / 1440);
  return `${d}d`;
};

/**
 * `formatDuration(720)` → `'0:12:00'`
 * `formatDuration(3661)` → `'1:01:01'`
 * `formatDuration(90061)` → `'25:01:01'` (no day rollover; ops-friendly continuous hours)
 * `formatDuration(0)` → `'0:00:00'`
 * `formatDuration(null | undefined | NaN | Infinity | <0)` → `'—'`
 *
 * Compact / technical HH:MM:SS per Phase 3 CONTEXT.md vision (P50/P95 as
 * "incuestionable" numbers, presented as a real ops-dashboard reading,
 * not a humanized "12 minutes" marketing line).
 *
 * Pure JS — does NOT use Intl (no locale variation; this is purely
 * numeric formatting and the colon convention is universal). Single
 * Intl gate (Pitfall 9) is preserved.
 */
export const formatDuration = (seconds: number | null | undefined): string => {
  if (!isFiniteNumber(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${h}:${pad(m)}:${pad(s)}`;
};

// --- Dates ------------------------------------------------------------------

/**
 * `formatBogotaDate(new Date('2026-04-27T05:00:00Z'))` → `'27/04/2026'`
 * (the UTC instant 05:00Z is 00:00 in Bogotá, which is the 27th).
 */
export const formatBogotaDate = (d: Date): string =>
  formatInTimeZone(d, BOGOTA_TZ, "dd/MM/yyyy", { locale: esLocale });

/**
 * `formatBogotaDateTime(new Date('2026-04-27T18:00:00Z'))`
 *   → `'27/04/2026 13:00:00 COT'`
 *
 * The trailing 'COT' is a literal string (single-quoted in the format
 * pattern) — Bogotá has no DST so the offset is always UTC-5 and we
 * label it Colombia Time consistently.
 */
export const formatBogotaDateTime = (d: Date): string =>
  formatInTimeZone(d, BOGOTA_TZ, "dd/MM/yyyy HH:mm:ss 'COT'", {
    locale: esLocale,
  });

/**
 * Bogotá's "today" as an ISO date string `YYYY-MM-DD`. Used by URL
 * state helpers (filters store dates as ISO date in URL searchParams).
 */
export const todayISOInBogota = (): string =>
  formatInTimeZone(new Date(), BOGOTA_TZ, "yyyy-MM-dd");

/**
 * Convert a Date → `'YYYY-MM-DD'` interpreted in Bogotá. Useful when
 * we have a JS Date and need to write it into a URL searchParam.
 */
export const toBogotaISODate = (d: Date): string =>
  formatInTimeZone(d, BOGOTA_TZ, "yyyy-MM-dd");
