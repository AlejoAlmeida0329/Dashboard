/**
 * Public parsing API for v2.0 domain libraries.
 *
 * Per CROSS-V2-03, Phases 7-10 (Bonos v2, Tarjeta+Recargas, Vista Cliente,
 * Inicio+Infra) consume parsing primitives directly — no longer through Zod
 * schema transforms. This module exposes those primitives in the units the
 * PRD v2 expects:
 *
 *   - `parseAging(s)`     → MINUTES (number; NaN on bad input)
 *   - `parseTotalTime(s)` → MINUTES (number; NaN on bad input; 0 on empty)
 *   - `parseCOPAmount(s)` → number | null (null = "no value", explicit signal)
 *
 * Backward-compatibility note: `src/lib/domain/schemas.ts` continues to use
 * the internal seconds-based helper (`parsePgIntervalSeconds`) for the
 * existing `Payout.latencySeconds` field, which Phase 3 percentiles depend
 * on. The Zod transforms in schemas.ts delegate here so logic lives in one
 * place; only the exposed unit (seconds vs minutes) differs.
 *
 * The parsing logic is verbatim from the original `parsePgInterval` /
 * `MoneyFromCOP` helpers in schemas.ts — proven against 798 production rows
 * in BD_Payouts captured live 2026-05-04.
 */

/**
 * Parse a PostgreSQL interval string to SECONDS.
 *
 * Internal helper used both by this module's public minutes-returning APIs
 * and by `schemas.ts` (which keeps the seconds-based contract for
 * `Payout.latencySeconds` to avoid regressions in Phase 3 percentiles).
 *
 * Format expected (from BD_Payouts `Aging` / `Total Time` columns):
 *   `"0 years 0 mons 12 days 20 hours 30 mins 38.656877 secs"`
 *
 * Years and months are converted with average lengths (365.25 d/y, 30.44 d/mo)
 * for defensive correctness; in production 798/798 rows have y=mo=0 so the
 * y/mo factors never matter.
 *
 * @param s Unknown input. Strings are parsed; everything else returns NaN.
 * @returns Number of seconds. `0` for empty string. `NaN` for unparseable
 *          input (caller decides whether to skip or fall back).
 */
export function parsePgIntervalSeconds(s: unknown): number {
  if (typeof s !== "string") return NaN;
  const trimmed = s.trim();
  if (trimmed === "") return 0;
  const m = trimmed.match(
    /(-?\d+)\s+years?\s+(-?\d+)\s+mons?\s+(-?\d+)\s+days?\s+(-?\d+)\s+hours?\s+(-?\d+)\s+mins?\s+(-?\d+(?:\.\d+)?)\s+secs?/i,
  );
  if (!m) return NaN;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const se = Number(m[6]);
  // 365.25 d/y, 30.44 d/mo (average) — defensive; real data has y=mo=0.
  return y * 365.25 * 86400 + mo * 30.44 * 86400 + d * 86400 + h * 3600 + mi * 60 + se;
}

/**
 * Parse `BD_Payouts.Aging` (PostgreSQL interval) to MINUTES.
 *
 * Per CROSS-V2-03, this is the public API for v2.0 phases. `Aging` is
 * always present in BD_Payouts — it is the row's age (now − created_at) —
 * so it is the defensive fallback for `latencySeconds` when `Total Time`
 * is empty (in_progress / failed payouts).
 *
 * @param s Unknown input. Strings are parsed; everything else returns NaN.
 * @returns Minutes (number). `0` for empty string. `NaN` for unparseable.
 */
export function parseAging(s: unknown): number {
  const seconds = parsePgIntervalSeconds(s);
  if (!Number.isFinite(seconds)) return seconds; // preserves NaN
  return seconds / 60;
}

/**
 * Parse `BD_Payouts.Total Time` (PostgreSQL interval) to MINUTES.
 *
 * Per CROSS-V2-03, this is the public API for v2.0 phases. `Total Time`
 * is the canonical end-to-end latency for COMPLETED payouts (state_timestamp
 * − date). It is EMPTY for `in_progress` and `failed` payouts because the
 * payout has not ended yet — empty string returns `0` (not NaN), matching
 * the existing schemas.ts tolerance for the fallback path.
 *
 * @param s Unknown input. Strings are parsed; everything else returns NaN.
 * @returns Minutes (number). `0` for empty string. `NaN` for unparseable.
 */
export function parseTotalTime(s: unknown): number {
  const seconds = parsePgIntervalSeconds(s);
  if (!Number.isFinite(seconds)) return seconds; // preserves NaN
  return seconds / 60;
}

/**
 * Parse a BD_Payouts COP-formatted string to a number.
 *
 * Per CROSS-V2-03, this is the public API for v2.0 phases. BD_Payouts
 * stores `Value` and `Transaction Cost` as pre-formatted strings like
 * `"COP 200,000.00"`, `"COP -5,229.46"`, `"COP 1,500,000.00"` (TEXT cells,
 * likely from a Looker / report export — UNFORMATTED_VALUE doesn't strip
 * the formatting).
 *
 * Strategy: strip non-digit/decimal/sign chars (handles "COP", spaces,
 * thousands separators), then `Number()`.
 *
 * Edge cases (explicitly handled):
 *   - **Negativos:** `"COP -5,229.46"` → `-5229.46` (sign preserved)
 *   - **Ceros:** `"COP 0.00"` → `0` (a valid number, NOT null)
 *   - **Vacíos:** `""` → `null` (explicit "no value" signal for v2.0
 *     callers — distinguishes "missing" from "zero")
 *   - **NaN/Infinity:** non-finite numeric input or `"COP NaN"` → `null`
 *
 * Number input fast-path: a finite number echoes; non-finite returns null.
 *
 * @param s Unknown input. Strings or numbers accepted.
 * @returns Number (including negatives and zero), or `null` when no value
 *          is present or the input is unparseable / non-finite.
 */
export function parseCOPAmount(s: unknown): number | null {
  if (typeof s === "number") {
    return Number.isFinite(s) ? s : null;
  }
  if (typeof s !== "string") return null;
  // Strip "COP", spaces, thousands separators (commas).
  // Keep digits, sign, and decimal point.
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  if (cleaned.length === 0) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}
