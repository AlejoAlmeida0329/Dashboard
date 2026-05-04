import "server-only";

import { cache } from "react";

import { getSheetsClient } from "./client";
import { SPREADSHEETS } from "./config";
import {
  getCellByHeader,
  headerIndexMap,
  isEmptyRow,
  isFormulaError,
  withRetry,
} from "./_utils";
import {
  ExpectedPayoutHeaders,
  PayoutRowSchema,
} from "@/lib/domain/schemas";
import type { Payout } from "@/lib/domain/types";
import type { AdapterResult } from "./transactions";

/**
 * Read all payouts from the configured Sheet (BD_Payouts tab).
 *
 * Mirrors `getTransactions()` line-for-line. Pipeline:
 *   1. Resolve the Sheets client (lazy JWT init; throws if creds missing).
 *   2. Fetch with `withRetry` so a transient 429 doesn't fail the whole load.
 *   3. Build a header→index map from row 0 (Pitfall 3 mitigation).
 *   4. Boot-time check that every header in `ExpectedPayoutHeaders` is
 *      present. If not, throw a SCHEMA mismatch error naming the missing
 *      headers — fail loud rather than return silent `undefined`.
 *   5. For each data row: skip blanks, collect cells into a {header→cell}
 *      object, drop the row if any cell is a formula error, otherwise pass
 *      to Zod for validation. Failed parses are skipped (counted), not thrown.
 *
 * Why `.get()` (one range) and not `batchGet` (two ranges)?
 *   03-RESEARCH.md recommended `batchGet` to coalesce BD_Plataforma +
 *   BD_Payouts into one quota unit. But:
 *     - `transactions.ts` already ships and uses its own `.get()`.
 *     - React `cache()` already dedupes per-request — DashboardHeader's
 *       `getCachedTransactions()` and `/payouts/page`'s
 *       `getCachedPayouts()` each fire ONCE per render. Two cached fetches
 *       = two `.get()` calls = same quota (1 unit each, vs 1 unit batchGet).
 *       BatchGet would only save quota if we coalesced INTO ONE
 *       cache-wrapper used across both pages, which is a larger refactor.
 *   Future optimization path: introduce a shared
 *   `getCachedSheetsBundle()` that batchGets both ranges and exposes
 *   `transactions` + `payouts` AdapterResults — touch only when quota
 *   becomes a real concern.
 */
export async function getPayouts(): Promise<AdapterResult<Payout>> {
  const sheets = getSheetsClient();
  const lastReadAt = new Date();

  if (!SPREADSHEETS.payouts.id) {
    throw new Error(
      "Sheets credentials missing — set GOOGLE_SHEETS_PAYOUTS_ID env var",
    );
  }

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEETS.payouts.id,
      range: SPREADSHEETS.payouts.range,
      valueRenderOption: "UNFORMATTED_VALUE",
      dateTimeRenderOption: "FORMATTED_STRING",
    }),
  );

  const allRows = (res.data.values ?? []) as unknown[][];
  if (allRows.length < 2) {
    return {
      rows: [],
      skipped: 0,
      lastReadAt,
      warnings: ["BD_Payouts vacío o sin headers"],
    };
  }

  const map = headerIndexMap(allRows[0]);

  const missingHeaders = ExpectedPayoutHeaders.filter((h) => !map.has(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `Sheet schema mismatch — columnas faltantes en BD_Payouts Sheet: ${missingHeaders.join(", ")}. ` +
        "Verifica el Sheet o ajusta src/lib/domain/schemas.ts si los nombres cambiaron upstream.",
    );
  }

  const rows: Payout[] = [];
  let skipped = 0;
  const warnings: string[] = [];

  for (let i = 1; i < allRows.length; i++) {
    const raw = allRows[i];
    if (isEmptyRow(raw)) {
      skipped++;
      continue;
    }

    let rowHasFormulaError = false;
    const obj: Record<string, unknown> = {};
    for (const [header] of map.entries()) {
      const cell = getCellByHeader(raw, map, header);
      if (isFormulaError(cell)) {
        rowHasFormulaError = true;
        if (warnings.length < 10) {
          warnings.push(
            `Row ${i + 1}: formula error en "${header}": ${String(cell)}`,
          );
        }
        break;
      }
      obj[header] = cell;
    }

    if (rowHasFormulaError) {
      skipped++;
      continue;
    }

    const parsed = PayoutRowSchema.safeParse(obj);
    if (!parsed.success) {
      skipped++;
      if (warnings.length < 10) {
        warnings.push(
          `Row ${i + 1}: parse failed — ${parsed.error.issues
            .slice(0, 2)
            .map((iss) => `${iss.path.join(".") || "<root>"}: ${iss.message}`)
            .join("; ")}`,
        );
      }
      continue;
    }
    rows.push(parsed.data);
  }

  return { rows, skipped, lastReadAt, warnings };
}

/**
 * React `cache()`-wrapped variant of `getPayouts` for SAME-REQUEST
 * deduplication.
 *
 * Mirrors the `getCachedTransactions` rule from `transactions.ts`:
 *   - Same-request memoization across all Server Components in the
 *     same render tree (e.g. `/payouts/page.tsx` + any future component
 *     that needs payouts data in the same render).
 *   - NO cross-request caching — each new request re-reads the Sheet,
 *     preserving "lectura en vivo" per PROJECT.md.
 *
 * Usage rule:
 *   - Server Components inside the dashboard layout tree: import
 *     `getCachedPayouts` (this function).
 *   - Outside-of-render code (route handlers, server actions, scripts):
 *     import `getPayouts` directly. `cache()` is a no-op outside render.
 */
export const getCachedPayouts = cache(getPayouts);
