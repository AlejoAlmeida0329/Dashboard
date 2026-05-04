import "server-only";

import { NextResponse } from "next/server";

import { verifySession } from "@/lib/auth/dal";
import { getPayouts } from "@/lib/sheets/payouts";

/**
 * /api/payouts-smoke — end-to-end check of the BD_Payouts adapter.
 *
 * Mirror of `/api/smoke` for the transactions adapter. Auth-gated by
 * `verifySession()` so an unauthenticated visitor cannot enumerate Sheet
 * schema mismatches or trigger Sheets API calls.
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
    const result = await getPayouts();
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
