/**
 * Inicio page — Server Component composition for the Phase 4 hero tab.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Phase 1 contract).
 *   2. Compute the same-length immediately-prior window via
 *      `computePriorPeriod(filters)` (Plan 04-01). Returns `null` when the
 *      filter is unbounded — caller renders em-dash deltas in that case.
 *   3. Fetch BD_Plataforma + BD_Payouts in parallel (`Promise.all`). React
 *      `cache()` dedupes the BD_Plataforma fetch with DashboardHeader's
 *      identical call — same-request memoization, no double roundtrip.
 *   4. Apply the Inicio default filter contract (`filterCompletedIn` from
 *      Plan 04-01: direction='in' + status='completed' + Bogotá from/to +
 *      optional empresa). Run it twice — once for current, once for the
 *      prior window — over the SAME `allTx` array (no second fetch).
 *   5. Run the 4 zero-safe aggregations (5 KPIs via `summarizeInicio`,
 *      bucket-aware GMV + active-empresas chart series via the granularity
 *      switch below).
 *   6. Run the 3 hechos curados domain calls (`findTopEmpresaByGMV`,
 *      `findEmpresasNuevasActivadas`, plus latencia destacada via Phase 3's
 *      `summarizePayouts` over the filtered payouts).
 *   7. Render KPICardsInicio + GMV chart + Empresas-activas chart +
 *      HechosCurados, all from Plan 04-05.
 *
 * Dual-period filter pattern:
 *   The deltas on every KPI come from comparing `summarizeInicio(currentTx)`
 *   against `summarizeInicio(priorTx)`. Both runs operate on the SAME
 *   `allTx` array (the unfiltered Sheets fetch), narrowed by two different
 *   windows. There is exactly ONE Sheets read per request — the
 *   prior-period numbers reuse the cached payload. This keeps lectura-en-
 *   vivo fresh (no cross-request cache) while staying within the Sheets
 *   quota (no doubled fetches).
 *
 * Bucket granularity threshold:
 *   ≤60 days → daily buckets (`aggregateGMVByDate` + `aggregateActiveEmpresasByDate`).
 *   >60 days → weekly buckets (...ByWeek variants, ISO `RRRR-Www` keys).
 *   The card subtitle reflects the choice (`(diario)` / `(semanal)`) so the
 *   reader knows what each bar/dot represents. Default (no from/to) length
 *   is 30 — keeps daily buckets when the user lands without a date filter.
 *
 * Cliente-foco contract delegation:
 *   Visibility flips for `?presenter=1&empresa=$X` are 100% CSS-driven
 *   (Plan 04-04 gate + Plan 04-05 attributes):
 *     - Comisión + Take rate cards: `data-presenter-hide` (KPICardsInicio internal)
 *     - HechosCurados outer wrapper: `data-presenter-empresa-hide` (component internal)
 *     - EmpresasActivasChart Card: `data-presenter-empresa-hide` ON THE CARD
 *       (page-level, since the chart degenerates to flat y=1 when filtered
 *       to one empresa — RESEARCH Edge case 2).
 *   No React conditionals on presenter / empresa here. The URL state flows
 *   through `PresenterFrame`'s outer wrapper and CSS picks up the rest.
 *
 * Why KPICardsInicio renders even when `currentTx.length === 0`:
 *   `summarizeInicio([])` is zero-safe (returns `{gmv:0, comision:0, ...}`).
 *   Showing zero-value cards + chart empty-state copy + hecho-curado empty
 *   states preserves layout consistency and reads as "your filter excluded
 *   everything", not "the dashboard is broken". Same convention as
 *   `bonos/page.tsx` empty-state branch.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read per
 *     PROJECT.md "lectura en vivo en cada carga".
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error handling:
 *   - If either Sheets read throws (creds missing, schema drift, transient
 *     429), we render an inline `<Card>` with the underlying error message
 *     rather than letting the route group's `error.tsx` swallow it with a
 *     generic copy. Mirror of bonos/page.tsx + payouts/page.tsx.
 */

import { differenceInCalendarDays } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EmpresasActivasChart } from "@/components/inicio/EmpresasActivasChart";
import { GMVTrendChart } from "@/components/inicio/GMVTrendChart";
import { HechosCurados } from "@/components/inicio/HechosCurados";
import { KPICardsInicio } from "@/components/inicio/KPICardsInicio";

import {
  aggregateActiveEmpresasByDate,
  aggregateActiveEmpresasByWeek,
  aggregateGMVByDate,
  aggregateGMVByWeek,
  filterCompletedIn,
  summarizeInicio,
} from "@/lib/domain/inicio";
import {
  findEmpresasNuevasActivadas,
  findTopEmpresaByGMV,
} from "@/lib/domain/inicio-hechos";
import { filterPayouts, summarizePayouts } from "@/lib/domain/payouts";
import { computePriorPeriod } from "@/lib/domain/period";
import { getCachedPayouts } from "@/lib/sheets/payouts";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Inicio · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InicioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const priorWindow = computePriorPeriod(filters);

  let txResult;
  let payoutsResult;
  try {
    [txResult, payoutsResult] = await Promise.all([
      getCachedTransactions(),
      getCachedPayouts(),
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
              : "Error desconocido al leer datos."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const allTx = txResult.rows;

  // Current period (filtered).
  const currentTx = filterCompletedIn(allTx, filters);

  // Prior period: same allTx, different window. Null when filters lack
  // from/to (unbounded comparisons aren't meaningful → KPI badges → em-dash).
  const priorTx = priorWindow
    ? filterCompletedIn(allTx, {
        ...filters,
        from: priorWindow.from,
        to: priorWindow.to,
      })
    : null;

  const summary = {
    current: summarizeInicio(currentTx),
    prior: priorTx ? summarizeInicio(priorTx) : null,
  };

  // Bucket granularity: ≤60 days → daily, >60 days → weekly. The default
  // (no from/to) is 30 days so daily buckets render on the unfiltered land.
  const length =
    filters.from && filters.to
      ? differenceInCalendarDays(
          new Date(`${filters.to}T00:00:00-05:00`),
          new Date(`${filters.from}T00:00:00-05:00`),
        ) + 1
      : 30;
  const granularity: "day" | "week" = length > 60 ? "week" : "day";

  const gmvSeries =
    granularity === "week"
      ? aggregateGMVByWeek(currentTx)
      : aggregateGMVByDate(currentTx);
  const activeSeries =
    granularity === "week"
      ? aggregateActiveEmpresasByWeek(currentTx)
      : aggregateActiveEmpresasByDate(currentTx);

  // Hechos curados.
  // findEmpresasNuevasActivadas REQUIRES the FULL dataset (allTx) — it
  // determines "new" by checking each empresa's first-EVER transaction
  // against the window. Passing currentTx here would make every empresa
  // look "new" (Pitfall 5 from RESEARCH).
  const topEmpresa = findTopEmpresaByGMV(currentTx);
  const empresasNuevas = findEmpresasNuevasActivadas(allTx, filters);

  // Latencia destacada — reuses Phase 3's summarizePayouts over the SAME
  // filter window (current) and the prior window (delta). The HechosCurados
  // leaf renders an INVERTED DeltaBadge (lower P50 = green = improvement).
  const payoutsCurrent = filterPayouts(payoutsResult.rows, filters);
  const payoutsPrior = priorWindow
    ? filterPayouts(payoutsResult.rows, {
        ...filters,
        from: priorWindow.from,
        to: priorWindow.to,
      })
    : null;
  const latenciaCurrent = summarizePayouts(payoutsCurrent);
  const latenciaPrior = payoutsPrior ? summarizePayouts(payoutsPrior) : null;

  return (
    <div className="space-y-6">
      <KPICardsInicio summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              GMV en el tiempo{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({granularity === "week" ? "semanal" : "diario"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gmvSeries.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Sin datos suficientes para tendencia. Ampliá el período.
              </p>
            ) : (
              <GMVTrendChart data={gmvSeries} granularity={granularity} />
            )}
          </CardContent>
        </Card>

        <Card data-presenter-empresa-hide>
          <CardHeader>
            <CardTitle>Empresas activas en el tiempo</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSeries.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Sin datos suficientes para tendencia. Ampliá el período.
              </p>
            ) : (
              <EmpresasActivasChart
                data={activeSeries}
                granularity={granularity}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <HechosCurados
        topEmpresa={topEmpresa}
        empresasNuevas={empresasNuevas}
        latenciaCurrent={latenciaCurrent}
        latenciaPrior={latenciaPrior}
      />
    </div>
  );
}
