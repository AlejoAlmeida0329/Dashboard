/**
 * Bonos page — v2 ranking-first cockpit (Plan 07-02).
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (CROSS-V2 contract).
 *   2. Fetch transactions via `getCachedTransactions` — the SAME function
 *      `DashboardHeader` calls. React `cache()` dedupes the Sheets API
 *      roundtrip so the chrome and the page share one fetch per request.
 *   3. Apply the v2 Bonos filter contract (`filterBonosV2` from Plan 07-01:
 *      tipo=BONUS + status CSV honored / default 'completed' + Bogotá-anchored
 *      from/to + optional empresa; BOTH directions flow through; `tipo`
 *      filter intentionally ignored).
 *   4. Run the 4 v2 aggregations:
 *        - `summarizeBonosV2`        → split in/out counts + ticket promedio
 *        - `aggregateBonosByDateV2`  → stacked-bar timeline points
 *        - `aggregateTopEmisores`    → ranking by sourceTransferTikintag
 *        - `aggregateTopReceptores`  → ranking by destinationTransferTikintag
 *   5. Compose the cockpit:
 *        - KPICardsV2 header (5 cards: countIn, countOut, montoIn, montoOut,
 *          ticketPromedio)
 *        - TopEmisores | TopReceptores side-by-side (lg:grid-cols-2) — the
 *          PROTAGONIST per 07-CONTEXT.md essentials ("ranking-first").
 *        - BonosFlowChart stacked-bar timeline as CONTEXT below.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` because the page is a function of URL
 *     state (filters) AND of an external data source (Sheets) that should
 *     read fresh on every visit (PROJECT.md "lectura en vivo en cada
 *     carga"). No ISR, no cross-request caching.
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error and empty handling:
 *   - If `getCachedTransactions()` throws (creds missing, schema drift,
 *     transient 429), we render an inline Card with a Spanish error
 *     message rather than letting the route group's `error.tsx` boundary
 *     swallow it with a generic copy.
 *   - If the filter produces zero bonos, we still render KPICardsV2 (which
 *     renders zeros gracefully) plus a friendly "Sin bonos en el período
 *     seleccionado" Card — the user knows the filter is the cause, not a
 *     data outage.
 *
 * Layout (responsive):
 *   - Mobile (default): everything stacked, `space-y-6`.
 *   - Desktop (`lg:`): TopEmisores | TopReceptores 50/50 grid; chart full-width.
 *   - XL (`xl:`): KPICardsV2 widens to 5-column grid (mobile shows 1, sm 2).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BonosFlowChart } from "@/components/bonos/BonosFlowChart";
import { KPICardsV2 } from "@/components/bonos/KPICardsV2";
import { TopEmisores } from "@/components/bonos/TopEmisores";
import { TopReceptores } from "@/components/bonos/TopReceptores";

import {
  aggregateBonosByDateV2,
  aggregateTopEmisores,
  aggregateTopReceptores,
  filterBonosV2,
  summarizeBonosV2,
} from "@/lib/domain/bonos";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Bonos · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BonosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let result;
  try {
    result = await getCachedTransactions();
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
              : "Error desconocido al leer transacciones."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const bonos = filterBonosV2(result.rows, filters);
  const summary = summarizeBonosV2(bonos);

  if (bonos.length === 0) {
    return (
      <div className="space-y-6">
        <KPICardsV2 summary={summary} />
        <Card>
          <CardHeader>
            <CardTitle>Sin bonos en el período seleccionado</CardTitle>
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

  const byDate = aggregateBonosByDateV2(bonos);
  const topEmisores = aggregateTopEmisores(bonos, 10);
  const topReceptores = aggregateTopReceptores(bonos, 10);

  return (
    <div className="space-y-6">
      <KPICardsV2 summary={summary} />

      {/* Protagonistas — top emisores ↔ top receptores side-by-side. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopEmisores rows={topEmisores} />
        <TopReceptores rows={topReceptores} />
      </div>

      {/* Contexto — flujo en el tiempo. */}
      <Card>
        <CardHeader>
          <CardTitle>Flujo de bonos · enviados vs recibidos</CardTitle>
        </CardHeader>
        <CardContent>
          <BonosFlowChart data={byDate} />
        </CardContent>
      </Card>
    </div>
  );
}
