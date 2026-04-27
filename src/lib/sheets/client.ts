import "server-only";

import { google, type sheets_v4 } from "googleapis";

/**
 * Singleton Google Sheets v4 client authenticated with a service account JWT.
 *
 * The JWT is built lazily on first access so that:
 *  - Importing this module never throws (so build-time tree-shaking and
 *    static analysis are not poisoned by a missing env var).
 *  - The error path is exercised at runtime, with a clear message naming the
 *    missing variable, the first time anyone actually tries to read a Sheet.
 *
 * Pitfall 1 (credentials) and Pitfall 11 (leaking Sheets concerns into the
 * rest of the app) are closed because:
 *  - `'server-only'` prevents this module from being bundled into client code.
 *  - Only this file knows about `googleapis` / JWT — the rest of the codebase
 *    talks to typed adapters (transactions.ts, payouts.ts).
 *
 * The `\n` replacement on the private key is required because Vercel (and
 * most secret stores) flatten multi-line values to single lines with literal
 * `\n` escape sequences. Without the replace, googleapis fails with an opaque
 * "error:1E08010C:DECODER routines::unsupported" parse error.
 */
let cachedClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Sheets credentials missing — set GOOGLE_SERVICE_ACCOUNT_* env vars",
    );
  }

  const auth = new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}
