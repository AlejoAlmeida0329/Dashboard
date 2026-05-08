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
  ExpectedTransactionHeaders,
  TransactionRowSchema,
} from "@/lib/domain/schemas";
import type { Transaction } from "@/lib/domain/types";

export interface AdapterResult<T> {
  rows: T[];
  /** Rows skipped because they were blank, contained formula errors, or failed Zod parse. */
  skipped: number;
  /** Wall clock at the moment we issued the spreadsheets.values.get call. */
  lastReadAt: Date;
  /** Diagnostic messages for the first few problematic rows; capped by the route handler. */
  warnings: string[];
}

/**
 * Read all transactions from the configured Sheet.
 *
 * Pipeline:
 *   1. Resolve the Sheets client (lazy JWT init; throws if creds missing).
 *   2. Fetch with `withRetry` so a transient 429 doesn't fail the whole load.
 *   3. Build a header→index map from row 0 (Pitfall 3 mitigation).
 *   4. Boot-time check that every header in `ExpectedTransactionHeaders` is
 *      present. If not, throw a SCHEMA mismatch error naming the missing
 *      headers — fail loud rather than return silent `undefined`.
 *   5. For each data row: skip blanks, collect cells into a {header→cell}
 *      object, drop the row if any cell is a formula error, otherwise pass
 *      to Zod for validation. Failed parses are skipped (counted), not thrown.
 *
 * Returns an AdapterResult so consumers can surface the skipped count to ops
 * (a high skip rate is a real signal that the Sheet is breaking upstream).
 */
export async function getTransactions(): Promise<AdapterResult<Transaction>> {
  const sheets = getSheetsClient();
  const lastReadAt = new Date();

  if (!SPREADSHEETS.transactions.id) {
    throw new Error(
      "Sheets credentials missing — set GOOGLE_SHEETS_TRANSACTIONS_ID env var",
    );
  }

  const res = await withRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEETS.transactions.id,
      range: SPREADSHEETS.transactions.range,
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
      warnings: ["Sheet vacío o sin headers"],
    };
  }

  const map = headerIndexMap(allRows[0]);

  const missingHeaders = ExpectedTransactionHeaders.filter((h) => !map.has(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `Sheet schema mismatch — columnas faltantes en transactions Sheet: ${missingHeaders.join(", ")}. ` +
        "Verifica el Sheet o ajusta src/lib/domain/schemas.ts si los nombres cambiaron upstream.",
    );
  }

  const rows: Transaction[] = [];
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
          warnings.push(`Row ${i + 1}: formula error en "${header}": ${String(cell)}`);
        }
        break;
      }
      obj[header] = cell;
    }

    if (rowHasFormulaError) {
      skipped++;
      continue;
    }

    const parsed = TransactionRowSchema.safeParse(obj);
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
 * React `cache()`-wrapped variant of `getTransactions` for SAME-REQUEST
 * deduplication.
 *
 * Why: in the Bonos page render, both `DashboardHeader` (fetching the
 * empresa registry for the filter dropdown) and `app/bonos/page.tsx`
 * (fetching the bono aggregations) need the full transactions list. We
 * don't want to hit the Sheets API twice per request — the underlying
 * data is identical and a single 2-second roundtrip is the worst part
 * of dashboard latency.
 *
 * What `cache()` provides:
 *   - Same-request memoization across all Server Components in the
 *     same render tree. Header and page receive the SAME
 *     `AdapterResult<Transaction>` reference (stable object identity).
 *   - NO cross-request caching. Each new request re-reads the Sheet —
 *     dashboard freshness is preserved (per PROJECT.md "Cache / refresh
 *     diferido — la lectura es en vivo en cada carga").
 *
 * Usage rule:
 *   - Server Components inside the dashboard layout tree: import
 *     `getCachedTransactions` (this function).
 *   - Outside-of-render code (route handlers, server actions, scripts):
 *     import `getTransactions` directly. `cache()` is only meaningful
 *     during a render and is a no-op outside it.
 *
 * Caveat: errors thrown by `getTransactions` are also memoized for the
 * lifetime of the request — every consumer in the same render sees the
 * same error. That is the intended behavior (a failed Sheets read is a
 * full-page failure; no point retrying on the second consumer).
 */
export const getCachedTransactions = cache(getTransactions);
