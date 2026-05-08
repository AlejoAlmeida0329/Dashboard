/**
 * Recargas page — v2 method-and-distribution-first cockpit (Plan 08-04).
 *
 * Vision (08-CONTEXT.md essentials + REC-V2-01..08):
 *   First scroll = how many recargas + how much $ entered (KPI strip with
 *   Teal section accent on the primary metric). Second scroll = method
 *   protagonists (PSE vs Transferencia split + amount distribution side by
 *   side). Third scroll = top users by recharge volume. Fourth scroll =
 *   stacked PSE/TRANSFER timeline. User who only reads the first scroll
 *   already has a useful operational answer.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Plan 06-03 contract).
 *   2. Fetch transactions via `getCachedTransactions` — same call
 *      `DashboardHeader` makes. React `cache()` dedupes the Sheets API
 *      roundtrip so chrome and page share a single fetch per request.
 *   3. Apply `filterRecargasV2` (Plan 08-03): PAYIN_PSE + PAYIN_TRANSFER +
 *      direction='in' + status CSV (default `["completed"]`) + Bogotá from/to
 *      + optional empresa. ONE filter pass feeds all six aggregations below.
 *   4. Run six v2 aggregations:
 *        - `summarizeRecargasV2`              → 4-card KPI header
 *        - `aggregateRechargeAdoption`        → adoption % (REC-V2-03)
 *        - `aggregateRechargeMethodSplit`     → PSE/Transfer split (REC-V2-04)
 *        - `aggregateRechargeAmountDistribution` → 3 buckets (REC-V2-06)
 *        - `aggregateTopRechargers`           → top 10 by tikintag (REC-V2-07)
 *        - `aggregateRechargesByDateV2`       → stacked timeline points
 *   5. Render the cockpit per layout below. All 5 leaves are Plan 08-04
 *      Server Components except RecargasTrendChartV2 (Recharts requires DOM).
 *
 * Adoption denominator decision (mirrors Plan 08-02):
 *   `aggregateRechargeAdoption` is called with the FULL `allTx` (NOT a
 *   period-filtered subset). Same convention as Plan 08-02's
 *   `aggregatePurchaseAdoption` call. The denominator is the population of
 *   all known users in the platform; period scoping applies only to the
 *   numerator (`recargaRows`). A period-filtered denominator would conflate
 *   "user existed in the period" with "user adopted the feature in the
 *   period" — confusing for an adoption KPI.
 *
 * Removed from v1:
 *   - `computePriorPeriod` + prior-period KPI badges. v2 KPIs are stand-alone
 *     (PRD lens shift: REC-V2 omits the period-vs-period badge concept).
 *   - `findTopEmpresaRecargadora` / `findRecargaMasGrande` hechos curados.
 *     v2 is user-and-method-and-amount-centric, NOT empresa-centric.
 *
 * Cliente-foco contract:
 *   NO `data-presenter-*` attributes here per Plan 08-04 conservative-default
 *   policy (CROSS-V2-07). The page metric set is intentionally non-sensitive
 *   for empresa-foco mode (each user already sees their own slice via the
 *   `?empresa=$X` URL filter; no per-metric hides needed). Phase 9 may
 *   revisit if a CLI-V2 requirement covers Recargas presenter behavior.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read per
 *     PROJECT.md "lectura en vivo en cada carga".
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route group's
 *     layout already guards the entire subtree.
 *
 * Error and empty handling:
 *   - If `getCachedTransactions()` throws (creds missing, schema drift,
 *     transient 429), we render an inline Card with the underlying error
 *     message rather than letting the route group's `error.tsx` swallow it.
 *   - If the filtered universe is empty, each leaf renders its own
 *     zero-state placeholder. The page does NOT short-circuit — preserves
 *     layout consistency, reads as "your filter excluded everything", not
 *     "the dashboard is broken".
 *
 * Layout (responsive):
 *   - Mobile: everything stacked, `space-y-6`.
 *   - Desktop: KPI strip 1 → 2 → 4 cols (managed inside RecargasKPICardsV2);
 *     MethodSplitCard | AmountDistribution at `lg:grid-cols-2`;
 *     TopRechargers + TrendChart full-width.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AmountDistribution } from "@/components/recargas/AmountDistribution";
import { MethodSplitCard } from "@/components/recargas/MethodSplitCard";
import { RecargasKPICardsV2 } from "@/components/recargas/RecargasKPICardsV2";
import { RecargasTrendChartV2 } from "@/components/recargas/RecargasTrendChartV2";
import { TopRechargers } from "@/components/recargas/TopRechargers";

import {
  aggregateRechargeAdoption,
  aggregateRechargeAmountDistribution,
  aggregateRechargeMethodSplit,
  aggregateRechargesByDateV2,
  aggregateTopRechargers,
  filterRecargasV2,
  summarizeRecargasV2,
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

  // ONE filter pass feeds all six aggregations.
  const recargaRows = filterRecargasV2(allTx, filters);

  const summary = summarizeRecargasV2(recargaRows);
  // Adoption denominator = full allTx pool (NOT period-filtered) — same
  // decision as Plan 08-02's `aggregatePurchaseAdoption` call.
  const adoption = aggregateRechargeAdoption(allTx, recargaRows);
  const methodSplit = aggregateRechargeMethodSplit(recargaRows);
  const amountBuckets = aggregateRechargeAmountDistribution(recargaRows);
  const topRows = aggregateTopRechargers(recargaRows, 10);
  const trendData = aggregateRechargesByDateV2(recargaRows);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl">Recargas</h1>
        <p className="text-sm text-muted-foreground">
          PSE + Transferencia · entradas a la plataforma
        </p>
      </header>

      {/* KPI strip — 4 cards: total + volumen + adopción + recarga promedio.
          Section accent (text-section-recargas) on the primary metric only. */}
      <RecargasKPICardsV2 summary={summary} adoption={adoption} />

      {/* Diagnostic protagonists — PSE vs Transferencia | distribución por monto. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MethodSplitCard split={methodSplit} />
        <AmountDistribution buckets={amountBuckets} />
      </div>

      {/* Top rechargers ranking — by tikintag (NOT empresa per REC-V2-07). */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 usuarios por volumen recargado</CardTitle>
        </CardHeader>
        <CardContent>
          <TopRechargers rows={topRows} />
        </CardContent>
      </Card>

      {/* Stacked PSE/TRANSFER timeline — context below the rankings. */}
      <Card>
        <CardHeader>
          <CardTitle>Recargas en el tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <RecargasTrendChartV2 data={trendData} />
        </CardContent>
      </Card>
    </div>
  );
}
