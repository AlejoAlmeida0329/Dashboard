import "server-only";

/**
 * Helpers for the Sheets adapter layer.
 *
 * These exist so the rest of the codebase can pretend Sheets are typed
 * domain objects, while this file absorbs the messy reality of:
 *  - Header rows shifting position when columns are reordered (header→index map)
 *  - Empty trailing rows in the response (`isEmptyRow`)
 *  - Formula errors leaking into cells (`isFormulaError` — Pitfall 13)
 *  - Sheets API rate limits (429 with exponential backoff — Pitfall 6/7)
 *
 * NUNCA acceder a celdas por índice posicional fuera de este archivo.
 */

type Row = unknown[];

/**
 * Build a {normalized_header → column_index} map from the header row.
 * Headers are trimmed and lower-cased so "Fecha" / " fecha " / "FECHA" all map
 * to the same key. This is the SOLE place we look at row[0]; downstream code
 * must use this map to find the cell for a given header name.
 */
export function headerIndexMap(headerRow: Row): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const cell = headerRow[i];
    if (typeof cell !== "string") continue;
    const key = cell.trim().toLowerCase();
    if (key.length === 0) continue;
    if (!map.has(key)) {
      // First occurrence wins; if the Sheet has a duplicate header (rare),
      // we ignore the second to keep behavior deterministic.
      map.set(key, i);
    }
  }
  return map;
}

/**
 * Look up the cell value for a given header name. Returns `undefined` if the
 * header isn't in the map — the caller decides whether that's a fatal error
 * (boot-time schema check) or an optional field.
 */
export function getCellByHeader(
  row: Row,
  map: Map<string, number>,
  header: string,
): unknown {
  const idx = map.get(header.trim().toLowerCase());
  if (idx === undefined) return undefined;
  return row[idx];
}

/**
 * True if the row is effectively blank — Sheets often returns trailing rows
 * with all cells either undefined, null, an empty string, or whitespace-only.
 * These should be silently skipped, not surfaced as parse errors.
 */
export function isEmptyRow(row: Row): boolean {
  if (!row || row.length === 0) return true;
  for (const cell of row) {
    if (cell === undefined || cell === null) continue;
    if (typeof cell === "string" && cell.trim() === "") continue;
    return false;
  }
  return true;
}

/**
 * True if the cell value is a Sheets formula-error sentinel
 * (`#REF!`, `#N/A`, `#DIV/0!`, `#NAME?`, `#NUM!`, `#VALUE!`, `#ERROR!`, `#NULL!`).
 * UNFORMATTED_VALUE leaks these as plain strings starting with `#`.
 */
const FORMULA_ERROR_PATTERN = /^#(REF|N\/A|DIV\/0|NAME|NUM|VALUE|ERROR|NULL)\b/i;

export function isFormulaError(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith("#")) return false;
  return FORMULA_ERROR_PATTERN.test(trimmed);
}

interface RetryOptions {
  /** Defaults to 3. Total attempts = maxRetries + 1 (the initial try). */
  maxRetries?: number;
  /** Defaults to 250 ms. */
  baseDelayMs?: number;
  /** Defaults to 4000 ms. */
  capDelayMs?: number;
}

interface ErrorWithCode {
  code?: number | string;
  status?: number | string;
  response?: { status?: number };
}

function isRateLimitError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as ErrorWithCode;
  if (e.code === 429 || e.code === "429") return true;
  if (e.status === 429 || e.status === "429") return true;
  if (e.response?.status === 429) return true;
  return false;
}

/**
 * Retry with exponential backoff + jitter for Sheets 429 rate-limit errors.
 * NON-429 errors are re-thrown immediately — we don't want to mask schema
 * mismatches or auth failures behind retries.
 *
 * Delay schedule (default base 250 ms, cap 4 s):
 *   attempt 1 fail → wait ~250 ms (+ up to 250 ms jitter), retry
 *   attempt 2 fail → wait ~500 ms, retry
 *   attempt 3 fail → wait ~1000 ms, retry
 *   attempt 4 fail → throw
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 250;
  const capDelayMs = options.capDelayMs ?? 4000;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= maxRetries) {
        throw err;
      }
      const exp = Math.pow(2, attempt) * baseDelayMs;
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(exp + jitter, capDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
}
