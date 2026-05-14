/**
 * Vista Cliente v2 dossier — Server Component composition for
 * /clientes/[empresaId] (CLI-V2-01..08).
 *
 * Pipeline (per request):
 *   1. Decode `empresaId` from the URL path. Tikintags carry a `$` prefix
 *      (e.g. `$mario`) which is percent-encoded as `%24` in URL path
 *      segments per RFC 3986; without `decodeURIComponent` the lookup
 *      below would never match a real tikintag.
 *   2. Read URL filters via `parseFilters(searchParams)` (Phase 1
 *      contract). The path's `empresaId` is the dossier subject; any URL
 *      `?empresa=…` searchParam is irrelevant here (the path is the
 *      picker). For v2 domain functions that honor `filters.empresa`
 *      (e.g. `filterBonosV2`, `filterPurchases`) we build
 *      `tikintagFilters = { ...filters, empresa: empresaId }` to narrow
 *      to THIS tikintag without the caller having to do it again.
 *   3. Fetch BD_Plataforma + BD_Payouts in parallel (`Promise.all`) — a
 *      single try/catch renders an inline error Card on failure (mirror
 *      of every other v2 page).
 *   4. `joinPayouts(allTx, allPayouts)` ONCE per request (Plan 06-02
 *      contract; ratified by Plans 09-01/09-02). The JoinedPayout[]
 *      result is threaded into THREE consumers in this page:
 *        - `aggregateClienteBenchmark` (CLI-V2-07 cliente vs platform delta)
 *        - `aggregateClienteTimeline` (CLI-V2-08 PAYOUT_BANK rows)
 *        - `RetirosBancoTable` (CLI-V2-03 — narrowed to this tikintag)
 *      Re-running the JOIN for each consumer would silently double O(n+m)
 *      cost; the single-call discipline is the page-composition budget.
 *   5. Compute / narrow per dossier section:
 *        - `summary = findClienteSummary(allTx, empresaId, filters)` —
 *          `null` → render 404 fallback Card with link back to /clientes
 *          (the dossier doesn't exist; same in-page pattern as the
 *          schema-error Card, NOT a Next.js notFound()).
 *        - `benchmark = aggregateClienteBenchmark(joined, empresaId)`.
 *        - `clientPayouts = joined.filter(...empresa_id===empresaId)` —
 *          narrow JOIN result for the table; preserves the matched
 *          Transaction context for each row.
 *        - `bonosFiltered = filterBonosV2(allTx, tikintagFilters)`;
 *          `bonosSummary = summarizeBonosV2(bonosFiltered)`.
 *        - `p2p = aggregateClienteP2P(allTx, empresaId, filters)`.
 *        - `purchasesFiltered = filterPurchases(allTx, tikintagFilters)`;
 *          `purchasesSummary = summarizePurchases(purchasesFiltered)`.
 *        - `timelineEvents = aggregateClienteTimeline(allTx, joined,
 *          empresaId, filters)`.
 *        - `tikintagOptions = getEmpresaRegistry(allTx)` — same registry
 *          DashboardHeader's EmpresaFilter consumes; React `cache()` on
 *          the BD_Plataforma fetch dedupes the read across the layout +
 *          this page within one request.
 *   6. Render in this order (single column on mobile, mixed on lg):
 *        - Back link "← Volver a empresas".
 *        - TikintagSelector dropdown (235 options) for in-place dossier
 *          switching without going back to /clientes.
 *        - ClienteKPIHeader — 6 KPIs in a single Card (Balance · Primera
 *          tx · Última actividad · Total tx · Pocket activo · Tiempo vs
 *          benchmark, with the benchmark KPI carrying the section accent).
 *        - RetirosBancoTable — full-width Card; failure-reason cells
 *          collapse in `?presenter=1` via data-presenter-metric-hide
 *          (Plan 06-04 paleta system).
 *        - Two-column grid: BonosClienteCards + ComprasClienteCard.
 *        - P2PCards — full-width Card.
 *        - TimelineActivity — wrapped in `<div data-presenter-hide>` so
 *          the entire timeline section disappears in presenter mode (per
 *          09-02 open question — whole-component presenter-hide is the
 *          PAGE's responsibility, not the leaf's).
 *        - GenerarVistaClienteButton — wrapped in
 *          `<div data-presenter-hide>` (the share-URL flow itself is an
 *          internal-mode action; once presenter is on, the button is no
 *          longer relevant).
 *   7. Module-level metadata:
 *        - `dynamic = 'force-dynamic'` per PROJECT.md "lectura en vivo en
 *          cada carga".
 *        - `generateMetadata` returns the dossier title with the decoded
 *          tikintag.
 *
 * Cliente-foco share URL contract (CONTEXT.md):
 *   GenerarVistaClienteButton now generates `/clientes/{empresaId}?presenter=1`
 *   (NOT `/inicio?empresa=…&presenter=1` like v1). Per CONTEXT.md
 *   "El URL persiste la selección para que un share-link te lleve al
 *   cliente exacto en el modo correcto" — the share-link lands on the
 *   dossier itself, in presenter mode, with the timeline section
 *   automatically hidden so the cliente sees the clean executive view.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read.
 *   - `params` and `searchParams` are both `Promise<...>` per Next 16's
 *     dynamic-route signature.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error / 404 handling:
 *   - If either Sheets read throws (creds missing, schema drift, transient
 *     429), we render an inline `<Card>` with the underlying error
 *     message rather than letting the route group's `error.tsx` swallow
 *     it with a generic copy. Mirror of /bonos / /payouts / /inicio /
 *     /recargas.
 *   - If `findClienteSummary` returns null (unknown tikintag, or no
 *     activity-counting tx ever), we render a friendly "Empresa no
 *     encontrada" Card with a link back to /clientes. NOT a Next.js
 *     `notFound()` — same in-page pattern as the schema-error Card.
 */

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Plan 09-02 leaves
import { BonosClienteCards } from "@/components/clientes/BonosClienteCards";
import { ClienteKPIHeader } from "@/components/clientes/ClienteKPIHeader";
import { ComprasClienteCard } from "@/components/clientes/ComprasClienteCard";
import { GenerarVistaClienteButton } from "@/components/clientes/GenerarVistaClienteButton";
import { P2PCards } from "@/components/clientes/P2PCards";
import { RetirosBancoTable } from "@/components/clientes/RetirosBancoTable";
import { TikintagSelector } from "@/components/clientes/TikintagSelector";
import { TimelineActivity } from "@/components/clientes/TimelineActivity";
import { UltimasP2PTable } from "@/components/clientes/UltimasP2PTable";
import { UltimosBonosTable } from "@/components/clientes/UltimosBonosTable";

// Domain
import { filterBonosV2, summarizeBonosV2 } from "@/lib/domain/bonos";
import { filterPurchases, summarizePurchases } from "@/lib/domain/cardUsage";
import {
  aggregateClienteP2P,
  aggregateClienteTimeline,
  findClienteSummary,
} from "@/lib/domain/cliente";
import { getEmpresaRegistry } from "@/lib/domain/empresas";
import { joinPayouts } from "@/lib/domain/join";

// Sheets
import { getCachedPayouts } from "@/lib/sheets/payouts";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: params + searchParams are both Promises on dynamic routes.
  params: Promise<{ empresaId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PageProps) {
  const { empresaId } = await params;
  return {
    title: `${decodeURIComponent(empresaId)} · Vista Cliente · Tikin Dashboard`,
  };
}

export default async function VistaClientePage({
  params,
  searchParams,
}: PageProps) {
  const { empresaId: rawEmpresaId } = await params;
  // tikintags carry `$` (e.g. `$mario`) — percent-encoded in URL path segments.
  const empresaId = decodeURIComponent(rawEmpresaId);

  const sp = await searchParams;
  const filters = parseFilters(sp);
  // The dossier narrows to THIS tikintag regardless of any URL ?empresa=…
  // (the path is the picker, the URL filter is irrelevant here). Threaded
  // into v2 domain filters that honor `filters.empresa`.
  const tikintagFilters = { ...filters, empresa: empresaId };

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
  const allPayouts = payoutsResult.rows;

  // 5a. Cabecera summary — null when tikintag unknown → 404 fallback.
  const summary = findClienteSummary(allTx, empresaId, filters);
  if (!summary) {
    return (
      <div className="space-y-6">
        <Link
          href="/clientes"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Volver a empresas
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Empresa no encontrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No hay actividad registrada para{" "}
              <span className="font-mono">{empresaId}</span>.
            </p>
            <Link href="/clientes" className="text-sm underline">
              Volver a la lista de empresas
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 5b. Single JOIN per request — threaded into timeline + RetirosBancoTable
  //     narrowed prop. Plan 06-02 contract; do NOT re-run joinPayouts
  //     elsewhere on this page.
  const joined = joinPayouts(allTx, allPayouts);

  // 5c. Narrow the JOIN result for the table — keeps `transaction.empresa_id`
  //     match in scope; preserves matched Transaction context for each row.
  const clientPayouts = joined.filter(
    (p) => p.transaction?.empresa_id === empresaId,
  );

  // 5d. Bonos in/out split for THIS tikintag.
  const bonosFiltered = filterBonosV2(allTx, tikintagFilters);
  const bonosSummary = summarizeBonosV2(bonosFiltered);

  // 5e. P2P sent/received + table for THIS tikintag.
  const p2p = aggregateClienteP2P(allTx, empresaId, filters);

  // 5f. Compras (PURCHASE direction='out') for THIS tikintag.
  const purchasesFiltered = filterPurchases(allTx, tikintagFilters);
  const purchasesSummary = summarizePurchases(purchasesFiltered);

  // 5g. Timeline events: chronological feed across all tx + payouts.
  const timelineEvents = aggregateClienteTimeline(
    allTx,
    joined,
    empresaId,
    filters,
  );

  // 5h. Tikintag selector options — derived from the same registry the
  //     DashboardHeader's EmpresaFilter consumes (235 entries today).
  //     React `cache()` on the BD_Plataforma fetch dedupes the read
  //     across the layout + this page within one request.
  const tikintagOptions = getEmpresaRegistry(allTx);

  return (
    <div className="space-y-6">
      <Link
        href="/clientes"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Volver a empresas
      </Link>

      <TikintagSelector options={tikintagOptions} current={empresaId} />

      <ClienteKPIHeader summary={summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BonosClienteCards summary={bonosSummary} />
        <ComprasClienteCard summary={purchasesSummary} />
      </div>

      <P2PCards p2p={p2p} />

      <RetirosBancoTable payouts={clientPayouts} />

      <UltimasP2PTable rows={p2p.rows} />

      <UltimosBonosTable transactions={bonosFiltered} />

      <div data-presenter-hide>
        <TimelineActivity events={timelineEvents} />
      </div>

      <div className="flex justify-end" data-presenter-hide>
        <GenerarVistaClienteButton empresaId={empresaId} />
      </div>
    </div>
  );
}
