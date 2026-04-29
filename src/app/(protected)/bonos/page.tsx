/**
 * Bonos page — Server Component composition for the Bonos tab.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Phase 1 contract).
 *   2. Fetch transactions via `getCachedTransactions` — the SAME function
 *      `DashboardHeader` calls. React `cache()` dedupes the Sheets API
 *      roundtrip so the chrome and the page share one fetch per request.
 *   3. Apply the Bonos default filter contract (`filterBonos` from Plan 02:
 *      tipo=BONUS + direction=in + status=completed + Bogotá-anchored
 *      from/to + optional empresa).
 *   4. Run the 4 zero-safe aggregations (`summarizeBonos`,
 *      `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas`).
 *   5. Render KPICards + BonosChart + Leaderboard + SalesTable, all from
 *      Plan 03. Modo Presentación visibility is fully declarative via the
 *      `data-presenter-hide` attributes the leaves already emit.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` because the page is a function of URL
 *     state (filters) AND of an external data source (Sheets) that should
 *     read fresh on every visit (PROJECT.md "lectura en vivo en cada
 *     carga"). No ISR, no cross-request caching.
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *   - The empresa registry fetch lives in DashboardHeader (already shipped
 *     in Plan 02-02); we don't re-fetch it.
 *
 * Error and empty handling:
 *   - If `getCachedTransactions()` throws (creds missing, schema drift,
 *     transient 429), we render an inline Card with a Spanish error
 *     message rather than letting the route group's `error.tsx` boundary
 *     swallow it with a generic copy.
 *   - If the filter produces zero bonos, we still render KPICards (which
 *     renders zeros gracefully) plus a friendly "Sin bonos en el período
 *     seleccionado" Card — the user knows the filter is the cause, not a
 *     data outage.
 *
 * Layout (responsive):
 *   - Mobile (default): everything stacked, `space-y-6`.
 *   - Desktop (`lg:`): Leaderboard | SalesTable lado a lado en proporción
 *     1:2 — la tabla pesa más por sus 5 columnas. Chart hero ocupa el
 *     ancho completo.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BonosChart } from "@/components/bonos/BonosChart";
import { KPICards } from "@/components/bonos/KPICards";
import { Leaderboard } from "@/components/bonos/Leaderboard";
import { SalesTable } from "@/components/bonos/SalesTable";

import {
  aggregateBonosByDate,
  aggregateBonosByEmpresa,
  filterBonos,
  summarizeBonos,
  top10Empresas,
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

  const bonos = filterBonos(result.rows, filters);
  const summary = summarizeBonos(bonos);

  if (bonos.length === 0) {
    return (
      <div className="space-y-6">
        <KPICards summary={summary} />
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

  const byDate = aggregateBonosByDate(bonos);
  const byEmpresa = aggregateBonosByEmpresa(bonos);
  const top10 = top10Empresas(byEmpresa);

  return (
    <div className="space-y-6">
      <KPICards summary={summary} />

      <Card>
        <CardHeader>
          <CardTitle>Bonos vendidos en el tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <BonosChart data={byDate} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Leaderboard rows={top10} />
        <SalesTable rows={byEmpresa} />
      </div>
    </div>
  );
}
