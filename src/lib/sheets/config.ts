/**
 * Central configuration for Google Sheets sources.
 *
 * Tab names confirmed in Plan 04: 'BD_Plataforma' (transactions) and
 * 'BD_Payouts' (payouts). Both tabs live in the SAME spreadsheet, so the
 * env vars `GOOGLE_SHEETS_TRANSACTIONS_ID` and `GOOGLE_SHEETS_PAYOUTS_ID`
 * are typically set to the same Sheet ID (kept separate so Phase 3+ can
 * split them across sheets if needed without code changes).
 *
 * Env vars are read at module-evaluation time, but the values default to ''
 * to avoid throwing at import. The validation that creds are present happens
 * inside `getSheetsClient()` in client.ts and inside the per-source adapter
 * (transactions.ts, payouts.ts) when it sees an empty `id`.
 */
export const SPREADSHEETS = {
  transactions: {
    id: process.env.GOOGLE_SHEETS_TRANSACTIONS_ID ?? "",
    range: "BD_Plataforma!A1:Z",
  },
  payouts: {
    id: process.env.GOOGLE_SHEETS_PAYOUTS_ID ?? "",
    range: "BD_Payouts!A1:Z",
  },
} as const;

export type SpreadsheetKey = keyof typeof SPREADSHEETS;
