/**
 * URL state helpers for dashboard filters.
 *
 * The dashboard stores all filter state (date range, empresa, status,
 * tipo, presenter mode) in URL searchParams — never in component-local
 * React state. Reasons:
 *   - Sticky across navigation: clicking from /inicio to /bonos with a
 *     ?from/&to filter preserves the range without an effect or context.
 *   - Shareable: a URL pasted into Slack reproduces the exact view.
 *   - Server-renderable: page.tsx can read filters from props and fetch
 *     data without an extra client round-trip.
 *
 * `parseFilters(searchParams)` is the canonical way to read filters in a
 * Server Component. `buildUrl(pathname, filters)` is the canonical way
 * for a Client Component to build the next URL when a filter changes.
 *
 * Multi-select filters (`status`, `tipo`) are serialized as
 * comma-separated values: `?status=completed,failed&tipo=BONUS,P2P`.
 * CSV (instead of repeated keys like `?status=completed&status=failed`)
 * keeps URLs short, human-readable, and trivially copy-pasteable. An
 * empty array is omitted from the URL — "no filter applied" and "absent
 * key" are treated identically by `parseFilters`.
 *
 * URL ordering is stable: from → to → empresa → status → tipo →
 * presenter. Stable order keeps URLs canonical for the proxy cache and
 * makes diffs in browser history readable.
 *
 * `presetDateRange` produces ranges anchored to "today in Bogotá" — not
 * UTC and not the server's local TZ — to ensure that "Last 7 days"
 * means the same thing whether the dashboard is rendered in Vercel
 * (UTC) or in dev on a machine in any timezone.
 */

import { startOfMonth, startOfQuarter, startOfYear, subDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { BOGOTA_TZ, toBogotaISODate } from "./format";

export type DashboardFilters = {
  from?: string; // 'YYYY-MM-DD' (Bogotá calendar date)
  to?: string; // 'YYYY-MM-DD'
  empresa?: string; // empresa_id, opaque to the URL layer
  status?: string[]; // CROSS-V2-01 — multi-select: ['completed','failed','in_progress']
  tipo?: string[]; // CROSS-V2-02 — multi-select: ['BONUS','P2P','PAYOUT_BANK',...]
  presenter?: "1"; // canonical "on" value — anything else means off
};

export type DateRangePreset = "7d" | "30d" | "mtd" | "qtd" | "ytd";

const getOne = (
  searchParams: Record<string, string | string[] | undefined>,
  k: string,
): string | undefined => {
  const v = searchParams[k];
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
};

/**
 * Read a comma-separated multi-select param. Returns `undefined` when
 * the key is absent OR when the parsed array is empty (e.g. `?status=`
 * or `?status=,,`). "Absent" and "empty set" are treated identically —
 * both mean "no filter applied".
 */
const getCSV = (
  searchParams: Record<string, string | string[] | undefined>,
  k: string,
): string[] | undefined => {
  const raw = getOne(searchParams, k);
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
};

/**
 * Read DashboardFilters from a Next.js searchParams object. Tolerates
 * the fact that searchParams values can be `string | string[] |
 * undefined` (Next normalizes repeated query keys to an array) by
 * always taking the first occurrence.
 */
export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): DashboardFilters {
  return {
    from: getOne(searchParams, "from"),
    to: getOne(searchParams, "to"),
    empresa: getOne(searchParams, "empresa"),
    status: getCSV(searchParams, "status"),
    tipo: getCSV(searchParams, "tipo"),
    presenter: getOne(searchParams, "presenter") === "1" ? "1" : undefined,
  };
}

/**
 * Build a URL for `pathname` with `filters` serialized in a stable
 * order (from, to, empresa, status, tipo, presenter). Stable order
 * keeps URLs canonical for the proxy cache and for human readability.
 *
 * Multi-select filters (`status`, `tipo`) are serialized as
 * comma-separated values; an empty array is omitted entirely so the
 * URL stays clean when no filter is applied.
 *
 * Returns just `pathname` when no filters are set (no trailing `?`).
 */
export function buildUrl(pathname: string, filters: DashboardFilters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.empresa) params.set("empresa", filters.empresa);
  if (filters.status && filters.status.length > 0)
    params.set("status", filters.status.join(","));
  if (filters.tipo && filters.tipo.length > 0)
    params.set("tipo", filters.tipo.join(","));
  if (filters.presenter === "1") params.set("presenter", "1");
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Compute a `{ from, to }` ISO date range for one of the named
 * presets. All math is anchored to "today, in Bogotá" (UTC-5, no DST)
 * so that the answer does not depend on the server's clock zone.
 *
 * Conventions:
 *   - `to` is always today (inclusive end).
 *   - `7d` = today minus 6 days through today (inclusive 7 calendar
 *     days). Same shape for `30d` (29 days back).
 *   - `mtd` / `qtd` / `ytd` start at the first day of the current
 *     month / quarter / year (in Bogotá) through today.
 */
export function presetDateRange(preset: DateRangePreset): {
  from: string;
  to: string;
} {
  // Anchor: a Date object whose wall-clock fields represent the
  // current moment in Bogotá. We do all preset math on this object
  // and then convert back to ISO via `toBogotaISODate`, which formats
  // the Bogotá wall clock — so a date like "the 1st of the month"
  // means the 1st in Bogotá, regardless of what UTC thinks.
  const anchor = toZonedTime(new Date(), BOGOTA_TZ);
  const today = toBogotaISODate(new Date()); // 'YYYY-MM-DD' in Bogotá

  const back = (days: number) => toBogotaISODate(subDays(new Date(), days));

  switch (preset) {
    case "7d":
      return { from: back(6), to: today };
    case "30d":
      return { from: back(29), to: today };
    case "mtd":
      // startOfMonth(anchor) returns a Date whose UTC instant lines
      // up with "midnight on day 1" of the Bogotá-shifted month.
      // Reformatting that instant in Bogotá gives the correct YYYY-MM-01.
      return { from: toBogotaISODate(startOfMonth(anchor)), to: today };
    case "qtd":
      return { from: toBogotaISODate(startOfQuarter(anchor)), to: today };
    case "ytd":
      return { from: toBogotaISODate(startOfYear(anchor)), to: today };
  }
}

/**
 * Best-effort detection of the active preset given a current
 * `{from,to}`. Returns `null` if the range does not match any preset
 * exactly (i.e. user picked a custom range). Used by the filter
 * picker to highlight the active preset button.
 */
export function detectActivePreset(
  filters: Pick<DashboardFilters, "from" | "to">,
): DateRangePreset | null {
  if (!filters.from || !filters.to) return null;
  const presets: DateRangePreset[] = ["7d", "30d", "mtd", "qtd", "ytd"];
  for (const p of presets) {
    const r = presetDateRange(p);
    if (r.from === filters.from && r.to === filters.to) return p;
  }
  return null;
}
