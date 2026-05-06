/**
 * Recargas page — Server Component composition for the Recargas tab.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Phase 1 contract).
 *   2. Compute the same-length immediately-prior window via
 *      `computePriorPeriod(filters)` (Plan 04-01). Returns `null` when the
 *      filter is unbounded — KPI badges fall back to em-dash in that case.
 *   3. Fetch transactions via `getCachedTransactions` — same call
 *      `DashboardHeader` makes. React `cache()` dedupes the Sheets API
 *      roundtrip so chrome and page share a single fetch per request.
 *   4. Apply `filterRecargas` (Plan 04-03). The RECHARGE_TIPOS guard lives
 *      INSIDE the domain layer — the page never branches on tipo strings.
 *      Run it twice over the same `allTx`: once for the current window,
 *      once for the prior window. Single Sheets read, dual filter pass.
 *   5. Run zero-safe aggregations: `summarizeRecargas` (2 KPIs),
 *      `aggregateRecargasByDate` (chart series), `aggregateRecargasByEmpresa`
 *      + `top10RecargasEmpresas` (table top-10), and the two hechos
 *      curados (`findTopEmpresaRecargadora`, `findRecargaMasGrande`).
 *   6. Render KPICards + TrendChart + Table + HechosCuradosRecargas. All
 *      Plan 04-06 leaves; the page itself stays prop-only.
 *
 * Why simpler than `/inicio`:
 *   - 2 KPIs (no comisión / take rate equivalents) → no presenter-only
 *     metric to hide. `?presenter=1` alone behaves identical to default.
 *   - 1 chart only (recargas by date) → no granularity switch needed; the
 *     domain emits daily buckets and the chart renders them as bars.
 *   - 2 hechos curados (vs Inicio's 3) → no payouts cross-fetch needed.
 *
 * Cliente-foco contract delegation:
 *   Visibility flips for `?presenter=1&empresa=$X` are 100% CSS-driven,
 *   handled inside the leaves (Plan 04-06):
 *     - `HechosCuradosRecargas` wrapper: `data-presenter-empresa-hide`
 *       (component internal — page wires no attribute).
 *     - KPIs, chart, and table stay visible — cliente seeing their own
 *       totals + trend + ranking row is desired (RESEARCH cliente-foco
 *       definition: "show the client what's about THEM").
 *   No React conditionals on presenter / empresa here.
 *
 * Empty-state behavior:
 *   Mirror `bonos/page.tsx`. When `currentRecargas.length === 0`, KPICards
 *   still renders zero values (zero-safe), the chart Card shows the "Sin
 *   datos" copy, the table shows its own empty-state, and HechosCurados
 *   show their respective "sin recargas" sentences. NO short-circuit with a
 *   single empty Card — preserves layout consistency, reads as "your
 *   filter excluded everything", not "the dashboard is broken".
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read per
 *     PROJECT.md "lectura en vivo en cada carga".
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error handling:
 *   - If `getCachedTransactions()` throws (creds missing, schema drift,
 *     transient 429), we render an inline `<Card>` with the underlying
 *     error message rather than letting the route group's `error.tsx`
 *     swallow it with a generic copy. Mirror of bonos + payouts + inicio.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { HechosCuradosRecargas } from "@/components/recargas/HechosCuradosRecargas";
import { RecargasKPICards } from "@/components/recargas/RecargasKPICards";
import { RecargasTable } from "@/components/recargas/RecargasTable";
import { RecargasTrendChart } from "@/components/recargas/RecargasTrendChart";

import { computePriorPeriod } from "@/lib/domain/period";
import {
  aggregateRecargasByDate,
  aggregateRecargasByEmpresa,
  filterRecargas,
  findRecargaMasGrande,
  findTopEmpresaRecargadora,
  summarizeRecargas,
  top10RecargasEmpresas,
} from "@/lib/domain/recargas";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Recargas · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RecargasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const priorWindow = computePriorPeriod(filters);

  let txResult;
  try {
    txResult = await getCachedTransactions();
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

  const allTx = txResult.rows;

  // Current period (filtered to RECHARGE_TIPOS by the domain layer).
  const currentRecargas = filterRecargas(allTx, filters);

  // Prior period: same allTx, different window. Null when filters lack
  // from/to (unbounded comparisons aren't meaningful → KPI badges → em-dash).
  const priorRecargas = priorWindow
    ? filterRecargas(allTx, {
        ...filters,
        from: priorWindow.from,
        to: priorWindow.to,
      })
    : null;

  const summary = {
    current: summarizeRecargas(currentRecargas),
    prior: priorRecargas ? summarizeRecargas(priorRecargas) : null,
  };

  const trendData = aggregateRecargasByDate(currentRecargas);
  const byEmpresa = aggregateRecargasByEmpresa(currentRecargas);
  const top10 = top10RecargasEmpresas(byEmpresa);

  // Hechos curados: both operate on the current-window data; they're
  // intentionally null-safe so the leaf can render its own empty-state copy.
  const topEmpresa = findTopEmpresaRecargadora(byEmpresa);
  const recargaMasGrande = findRecargaMasGrande(currentRecargas);

  return (
    <div className="space-y-6">
      <RecargasKPICards summary={summary} />

      <Card>
        <CardHeader>
          <CardTitle>Recargas en el tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Sin datos suficientes para tendencia. Ampliá el período.
            </p>
          ) : (
            <RecargasTrendChart data={trendData} />
          )}
        </CardContent>
      </Card>

      <RecargasTable rows={top10} />

      <HechosCuradosRecargas
        topEmpresa={topEmpresa}
        recargaMasGrande={recargaMasGrande}
      />
    </div>
  );
}
