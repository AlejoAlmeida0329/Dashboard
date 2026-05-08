/**
 * Uso Tarjeta page — Server Component composition for the /uso-tarjeta tab.
 *
 * First brand-new section in v2.0 (every other tab is a v1 carryforward —
 * Uso Tarjeta is greenfield per PRD). Closes CARD-V2-01..06.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (CROSS-V2 contract).
 *   2. Fetch transactions via `getCachedTransactions` — the SAME function
 *      `DashboardHeader` calls. React `cache()` dedupes the Sheets API
 *      roundtrip so the chrome and the page share one fetch per request.
 *   3. Apply the Uso Tarjeta filter contract (`filterPurchases` from Plan
 *      08-01: tipo=PURCHASE + direction=out + status CSV honored / default
 *      `["completed"]` + Bogotá-anchored from/to + optional empresa;
 *      `filters.tipo` intentionally ignored).
 *   4. Run the 4 v2 aggregations:
 *        - `summarizePurchases`         → totalCompras + volumenCOP + ticketPromedio
 *        - `aggregatePurchaseAdoption`  → adoption rate (two-arg signature)
 *        - `aggregatePurchasesByDate`   → daily Bogotá buckets for the trend
 *        - `aggregateTopCardUsers`      → top 10 users by volumenCOP DESC
 *   5. Compose the cockpit:
 *        - KPICardsCardUsage header (3 cards: compras / volumen / ticket promedio)
 *        - AdoptionCard — the headline metric per CARD-V2-04 (conversation
 *          driver in customer meetings).
 *        - PurchaseTrendChart full-width below.
 *        - TopCardUsers ranking table at the bottom.
 *
 * ADOPTION DENOMINATOR DECISION (Plan 08-02):
 *   `aggregatePurchaseAdoption(allTx, purchaseRows)` is called with the
 *   FULL `getCachedTransactions().rows` as the denominator scope — NOT
 *   the period-filtered superset. Rationale:
 *     - PRD baseline 40/235 ≈ 17% is a global-pool reading (it answers
 *       "what fraction of our user base ever uses the tarjeta", not "what
 *       fraction of users active in the last 7 days made a card purchase").
 *     - Page-level filters in practice scope to recent windows; period-
 *       filtering the denominator would inflate adoption artificially in
 *       short windows (a user inactive in the period can't be a denominator
 *       member, but they'd contribute to the global readout).
 *     - Phase 9 Vista Cliente may revisit if a per-period denominator
 *       becomes desirable (e.g. for a per-empresa adoption mini-card).
 *   The numerator (`purchaseRows`) IS period-filtered — that's the question
 *   "how many users made a card purchase in this period?".
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
 * Empty-state behavior:
 *   When `purchaseRows.length === 0`, the leaves render their own zero-state
 *   placeholders (KPICardsCardUsage shows zeros, AdoptionCard shows the
 *   adoption % computed from the full pool with zero numerator,
 *   PurchaseTrendChart shows "Sin datos suficientes", TopCardUsers shows the
 *   "Sin compras en el período seleccionado" row). The page does NOT
 *   short-circuit with a single empty Card — same pattern as bonos / recargas
 *   v1 / v2 cockpits. Preserves layout consistency, reads as "your filter
 *   excluded everything", not "the dashboard is broken".
 *
 * Cliente-foco visibility:
 *   NO `data-presenter-*` attributes on this page in this plan. Uso Tarjeta
 *   is presenter-friendly by default (CROSS-V2-07 conservative-default
 *   policy — all metrics visible in presenter; opt-out by tagging individual
 *   elements). Phase 9 may revisit if dual-purpose visibility per metric
 *   becomes a CLI-V2 requirement for Uso Tarjeta.
 *
 * Error handling:
 *   - If `getCachedTransactions()` throws (creds missing, schema drift,
 *     transient 429), we render an inline Card with a Spanish error
 *     message rather than letting the route group's `error.tsx` boundary
 *     swallow it with a generic copy. Mirror of bonos + payouts + recargas.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { AdoptionCard } from "@/components/uso-tarjeta/AdoptionCard";
import { KPICardsCardUsage } from "@/components/uso-tarjeta/KPICardsCardUsage";
import { PurchaseTrendChart } from "@/components/uso-tarjeta/PurchaseTrendChart";
import { TopCardUsers } from "@/components/uso-tarjeta/TopCardUsers";

import {
  aggregatePurchaseAdoption,
  aggregatePurchasesByDate,
  aggregateTopCardUsers,
  filterPurchases,
  summarizePurchases,
} from "@/lib/domain/cardUsage";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Uso Tarjeta · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UsoTarjetaPage({ searchParams }: PageProps) {
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
  const purchaseRows = filterPurchases(allTx, filters);

  // One filter pass, multiple aggregations (Plan 08-01 composition contract).
  const summary = summarizePurchases(purchaseRows);
  // Adoption denominator = FULL allTx pool (NOT period-filtered) — see
  // page-level JSDoc above for rationale.
  const adoption = aggregatePurchaseAdoption(allTx, purchaseRows);
  const trendData = aggregatePurchasesByDate(purchaseRows);
  const topRows = aggregateTopCardUsers(purchaseRows, 10);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Uso Tarjeta</h1>
        <p className="text-sm text-muted-foreground">
          Compras con tarjeta en el período
        </p>
      </header>

      <KPICardsCardUsage summary={summary} />

      <AdoptionCard adoption={adoption} />

      <Card>
        <CardHeader>
          <CardTitle>Tendencia de uso</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseTrendChart data={trendData} />
        </CardContent>
      </Card>

      <TopCardUsers rows={topRows} />
    </div>
  );
}
