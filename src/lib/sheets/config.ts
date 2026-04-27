/**
 * Central configuration for Google Sheets sources.
 *
 * Tab names ('Transacciones', 'Payouts') and ranges are tentative — Plan 04
 * production smoke will confirm against the live Sheets. If they fail, ajustar
 * aquí en una sola línea (no hace falta tocar el adapter).
 *
 * Env vars are read at module-evaluation time, but the values default to ''
 * to avoid throwing at import. The validation that creds are present happens
 * inside `getSheetsClient()` in client.ts and inside the per-source adapter
 * (transactions.ts, payouts.ts) when it sees an empty `id`.
 */
export const SPREADSHEETS = {
  transactions: {
    id: process.env.GOOGLE_SHEETS_TRANSACTIONS_ID ?? "",
    range: "Transacciones!A1:Z",
  },
  payouts: {
    id: process.env.GOOGLE_SHEETS_PAYOUTS_ID ?? "",
    range: "Payouts!A1:Z",
  },
} as const;

export type SpreadsheetKey = keyof typeof SPREADSHEETS;
