import { NextResponse } from "next/server";

import { verifySession } from "@/lib/auth/dal";
import { getTransactions } from "@/lib/sheets/transactions";

/**
 * /api/smoke — end-to-end check of the Sheets adapter.
 *
 * Note on naming: the plan specified `/api/_smoke`, but Next.js App Router
 * treats `_`-prefixed folders as PRIVATE (non-routable) — see Next docs
 * "Route groups and private folders". The route therefore lives at
 * `/api/smoke`. Function and contract are identical to the plan.
 *
 * Auth-gated by `verifySession()` so an unauthenticated visitor cannot enumerate
 * Sheet schema mismatches or trigger Sheets API calls. To exercise this in dev,
 * log in via /login first to obtain the session cookie, then hit /api/smoke.
 *
 * Response shape:
 *   { ok: true, count, skipped, lastReadAt, warnings, sample }   — happy path
 *   { ok: false, error }                                          — adapter threw
 *
 * `dynamic = 'force-dynamic'` because we don't ever want this route cached;
 * a stale OK could mask a broken upstream.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  await verifySession();

  try {
    const result = await getTransactions();
    return NextResponse.json({
      ok: true,
      count: result.rows.length,
      skipped: result.skipped,
      lastReadAt: result.lastReadAt.toISOString(),
      warnings: result.warnings.slice(0, 5),
      sample: result.rows.slice(0, 3),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
