/**
 * Payouts page — Server Component composition for the v2 Payouts tab.
 *
 * Vision (07-CONTEXT.md essentials "Payouts: time-first" + "capas en Payouts"):
 *   First scroll = velocidad (tiempo promedio + tasa éxito) + alerta de
 *   pendientes con > 2h aging when applicable. Second scroll = calidad
 *   (3 KPIs por estado semáforo) + diagnóstico (bancos, razones de fallo,
 *   pagos a terceros). User who only reads the first scroll already has a
 *   useful operational answer.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Plan 06-03 contract).
 *   2. Fetch BD_Payouts AND BD_Plataforma in parallel — UNCONDITIONAL JOIN
 *      because we always need `transaction.tikintag` for `aggregateThirdPartyPayouts`
 *      (PAY-V2-08). React `cache()` already dedupes the BD_Plataforma fetch
 *      with DashboardHeader's empresa-registry call — same-request memo,
 *      no extra cost.
 *   3. Empresa join (preserved from v1): patches `Payout.empresa_id` from
 *      the matching `Transaction.empresa_id` so `?empresa=$X` URL filter
 *      narrows correctly. Used by `filterPayoutsV2`.
 *   4. Apply v2 filter: `filterPayoutsV2` (state-UNFILTERED period filter
 *      that honors the `filters.status` URL CSV per CROSS-V2-01). The
 *      output `periodOnly` feeds the breakdown, aging alert, failure
 *      reasons. The `completed` subset feeds tiempo promedio, volumen,
 *      top bancos, and the third-party JOIN.
 *   5. Run 6 v2 aggregations + reuse Phase 3 `aggregateTopBancos`. Run
 *      `joinPayouts(transactions, completed)` ONCE then chain into
 *      `aggregateThirdPartyPayouts` (PAY-V2-08 — first production
 *      consumer of the canonical Plan 06-02 helper).
 *   6. Render the time-first cockpit per layout below.
 *
 * Filter propagation invariant:
 *   All leaf renderings derive from `periodOnly` or `completed`. DO NOT
 *   compute aggregations off `payoutsResult.rows` directly — that would
 *   bypass the date/empresa/status URL filter and the empresa join, and
 *   the leaves would silently drift apart.
 *
 * Empresa join contract:
 *   `Payout.empresa_id` is undefined upstream; we always run the join.
 *   The `p.empresa_id ?? lookup` fallback preserves any future case where
 *   Tikin populates a holder→empresa mapping directly in BD_Payouts.
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
 *   - If the filtered universe (`periodOnly`) is empty, render the v2 KPI
 *     header with zeros + a friendly empty-state Card. AgingAlert returns
 *     null in that path; the diagnostic layer is skipped entirely.
 *
 * Layout (responsive):
 *   - Mobile: everything stacked, `space-y-6`.
 *   - Desktop: KPI header reflows 5 → 2 → 1 col via PayoutsKPICardsV2
 *     internal grid; FailureReasons + ThirdPartyPayouts side-by-side at
 *     `lg:grid-cols-2`.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AgingAlert } from "@/components/payouts/AgingAlert";
import { FailureReasons } from "@/components/payouts/FailureReasons";
import { PayoutsKPICardsV2 } from "@/components/payouts/PayoutsKPICardsV2";
import { StatusBreakdownCards } from "@/components/payouts/StatusBreakdownCards";
import { ThirdPartyPayouts } from "@/components/payouts/ThirdPartyPayouts";
import { TopBancos } from "@/components/payouts/TopBancos";

import { joinPayouts } from "@/lib/domain/join";
import {
  aggregateAgingAlertPending,
  aggregateAverageProcessingMinutes,
  aggregateFailureReasons,
  aggregateThirdPartyPayouts,
  aggregateTopBancos,
  filterPayoutsV2,
  summarizePayoutsByState,
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

  // Both fetches are unconditional in v2 — `aggregateThirdPartyPayouts`
  // always needs `transaction.tikintag`. React `cache()` ensures the
  // shared `getCachedTransactions()` call across DashboardHeader and
  // here resolves to a single fetch per request.
  let payoutsResult;
  let txResult;
  try {
    [payoutsResult, txResult] = await Promise.all([
      getCachedPayouts(),
      getCachedTransactions(),
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

  // Empresa join (preserved from v1): patches Payout.empresa_id from the
  // matching Transaction.empresa_id so `?empresa=$X` narrows correctly.
  // The fallback `p.empresa_id ?? lookup` preserves any future case where
  // Tikin populates a holder→empresa mapping directly in BD_Payouts.
  const txEmpresaByTransactionId = new Map(
    txResult.rows.map((t) => [t.id, t.empresa_id]),
  );
  const enrichedPayouts = payoutsResult.rows.map((p) => ({
    ...p,
    empresa_id: p.empresa_id ?? txEmpresaByTransactionId.get(p.transactionId),
  }));

  // Period+empresa+status universe — feeds the breakdown, aging alert,
  // and failure reasons. v2 filter does NOT pre-filter state by default;
  // when `filters.status` is set (CROSS-V2-01), it narrows accordingly.
  const periodOnly = filterPayoutsV2(enrichedPayouts, filters);

  // Completed subset — feeds tiempo promedio, volumen, top bancos, and
  // the JOIN that drives third-party detection. Reuses the rows already
  // passed by `filterPayoutsV2` so any URL status filter is honored.
  const completed = periodOnly.filter((p) => p.state === "completed");

  // Aggregates.
  const breakdown = summarizePayoutsByState(periodOnly);
  const avgMinutes = aggregateAverageProcessingMinutes(completed);
  const agingRows = aggregateAgingAlertPending(periodOnly, 120);
  const failureRows = aggregateFailureReasons(periodOnly);
  const topBancos = aggregateTopBancos(completed);
  const montoTotalCompleted = completed.reduce((s, p) => s + p.monto, 0);

  // Third-party requires the JOIN. We join completed payouts only —
  // settled bank transfers — per PAY-V2-08 KPI semantics. One JOIN per
  // request budget contract; chained into the aggregation below.
  const joinedCompleted = joinPayouts(txResult.rows, completed);
  const thirdParty = aggregateThirdPartyPayouts(joinedCompleted);

  // Empty-state branch: render the KPI header (with zeros) + a friendly
  // explanatory Card. Skip the diagnostic layer entirely — there's no
  // signal to mine. AgingAlert returns null in this path naturally.
  if (periodOnly.length === 0) {
    return (
      <div className="space-y-6">
        <PayoutsKPICardsV2
          avgMinutes={avgMinutes}
          breakdown={breakdown}
          montoTotalCompleted={montoTotalCompleted}
          thirdPartyCount={thirdParty.length}
        />
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

  // Time-first cockpit (07-CONTEXT.md "velocidad → calidad → diagnóstico"):
  return (
    <div className="space-y-6">
      {/* Tiempo + Tasa éxito + Volumen + Terceros — TIME-FIRST. */}
      <PayoutsKPICardsV2
        avgMinutes={avgMinutes}
        breakdown={breakdown}
        montoTotalCompleted={montoTotalCompleted}
        thirdPartyCount={thirdParty.length}
      />

      {/* Aging alert — only when something's stuck. AgingAlert returns
          null when rows is empty (no awkward placeholder). */}
      <AgingAlert rows={agingRows} />

      {/* Quality semáforo — 3 KPIs por estado. */}
      <StatusBreakdownCards breakdown={breakdown} />

      {/* Diagnóstico — bancos | razones | terceros. */}
      <TopBancos data={topBancos} />
      <div className="grid gap-6 lg:grid-cols-2">
        <FailureReasons rows={failureRows} />
        <ThirdPartyPayouts rows={thirdParty} />
      </div>
    </div>
  );
}
