/**
 * Payouts page — Server Component composition for the Payouts tab.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Phase 1 contract).
 *   2. Fetch BD_Payouts via `getCachedPayouts`. When `filters.empresa` is set,
 *      ALSO fetch BD_Plataforma via `getCachedTransactions` so we can build a
 *      `Map<transactionId, empresa_id>` and patch each Payout's `empresa_id`
 *      (the join). Plan 03-01 confirmed BD_Payouts.Holder is a CARDHOLDER
 *      NAME, not a tikintag — so the empresa filter cannot match `holder`.
 *      The transactionId join is the only way to honor `?empresa=...`.
 *   3. Apply the Payouts default filter contract (`filterPayouts` from Plan
 *      03-02: state=completed + Bogotá from/to + optional empresa). Also
 *      compute `filterPayoutsByPeriodOnly` (state-UNFILTERED) for the
 *      success rate denominator — failed/in_progress payouts must count in
 *      the denominator or the rate is always 100%.
 *   4. Run the 4 zero-safe aggregations (`summarizePayouts`,
 *      `aggregateLatencyHistogram`, `aggregateTopBancos`, `aggregateSuccessRate`).
 *   5. Render PayoutsKPICards + LatencyHistogram (wrapped in a Card) +
 *      TopBancos. Modo Presentación visibility is fully declarative via
 *      `data-presenter-hide` on the Tasa de éxito card from Plan 03-03.
 *
 * Filter propagation invariant:
 *   All four leaf renderings derive from `completed` (or `periodOnly` for
 *   successRate). DO NOT compute aggregations off `payoutsResult.rows`
 *   directly — that would bypass the date/empresa filter and the empresa
 *   join, and the leaves would silently drift apart.
 *
 * Empresa join contract:
 *   When `filters.empresa` is set, we read BD_Plataforma to map
 *   `transaction_id → empresa_id` and patch each Payout's `empresa_id`.
 *   React `cache()` dedupes the BD_Plataforma fetch with DashboardHeader's
 *   empresa registry call — same-request memoization, no double-roundtrip.
 *   When `filters.empresa` is NOT set, the second fetch is skipped entirely
 *   (saves a Sheets quota unit on the no-filter path).
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read per
 *     PROJECT.md "lectura en vivo en cada carga".
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error and empty handling:
 *   - If either Sheets read throws (creds missing, schema drift, transient
 *     429), we render an inline Card with the underlying error message
 *     rather than letting the route group's `error.tsx` swallow it with
 *     a generic copy.
 *   - If the filter produces zero completed rows, we still render
 *     PayoutsKPICards (zero-safe) + the Spanish empty-state Card. Note:
 *     `successRate` is still computed off `periodOnly` even on empty
 *     `completed`, because `periodOnly` may have failed payouts (e.g.
 *     "100 attempts, 0 completed → 0% success rate" is meaningful, not
 *     a no-data case).
 *
 * Layout (responsive):
 *   - Mobile: everything stacked, `space-y-6`.
 *   - Desktop: KPICards reflow 5-col → 2-col → 1-col via PayoutsKPICards
 *     internal grid; histogram + TopBancos full-width Cards.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { LatencyHistogram } from "@/components/payouts/LatencyHistogram";
import { PayoutsKPICards } from "@/components/payouts/PayoutsKPICards";
import { TopBancos } from "@/components/payouts/TopBancos";

import {
  aggregateLatencyHistogram,
  aggregateSuccessRate,
  aggregateTopBancos,
  filterPayouts,
  filterPayoutsByPeriodOnly,
  summarizePayouts,
} from "@/lib/domain/payouts";
import { getCachedPayouts } from "@/lib/sheets/payouts";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Payouts · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  // Fetch payouts always; fetch transactions ONLY when an empresa filter is
  // active and we therefore need the transactionId → empresa_id join. React
  // `cache()` ensures DashboardHeader's identical `getCachedTransactions()`
  // call (for the empresa registry) and ours hit the SAME memoized result
  // per request — no double-fetch even when both run.
  let payoutsResult;
  let txResult;
  try {
    [payoutsResult, txResult] = await Promise.all([
      getCachedPayouts(),
      filters.empresa ? getCachedTransactions() : Promise.resolve(null),
    ]);
  } catch (err) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos leer el Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {err instanceof Error
              ? err.message
              : "Error desconocido al leer payouts."}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Empresa join: when the filter is active, build a Map<transactionId,
  // empresa_id> from BD_Plataforma rows and patch each Payout. The fallback
  // `p.empresa_id ?? lookup` preserves any future case where Tikin populates
  // a holder→empresa mapping directly in BD_Payouts.
  let enrichedPayouts = payoutsResult.rows;
  if (filters.empresa && txResult) {
    const txEmpresaByTransactionId = new Map(
      txResult.rows.map((t) => [t.id, t.empresa_id]),
    );
    enrichedPayouts = payoutsResult.rows.map((p) => ({
      ...p,
      empresa_id: p.empresa_id ?? txEmpresaByTransactionId.get(p.transactionId),
    }));
  }

  // periodOnly = state-UNFILTERED universe, used as the success-rate
  // denominator. Failed/in_progress rows that fall in the date+empresa
  // window must count here or the rate is always 100%.
  const periodOnly = filterPayoutsByPeriodOnly(enrichedPayouts, filters);

  // completed = ALL filters applied (state=completed + date + empresa).
  // Headline KPIs, histogram, and TopBancos derive from this set.
  const completed = filterPayouts(enrichedPayouts, filters);

  const successRate = aggregateSuccessRate(periodOnly);
  const summary = summarizePayouts(completed);

  if (completed.length === 0) {
    return (
      <div className="space-y-6">
        <PayoutsKPICards summary={summary} successRate={successRate} />
        <Card>
          <CardHeader>
            <CardTitle>Sin payouts en el período seleccionado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Probá ampliando el rango de fechas o quitando el filtro de
              empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const histogram = aggregateLatencyHistogram(completed);
  const topBancos = aggregateTopBancos(completed);

  return (
    <div className="space-y-6">
      <PayoutsKPICards summary={summary} successRate={successRate} />

      <Card>
        <CardHeader>
          <CardTitle>Latencia de payouts</CardTitle>
        </CardHeader>
        <CardContent>
          <LatencyHistogram buckets={histogram} />
        </CardContent>
      </Card>

      <TopBancos data={topBancos} />
    </div>
  );
}
