/**
 * Empresa profile page — Server Component composition for
 * /clientes/[empresaId] (CLI-05/06/07/08).
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Phase 1 contract).
 *      The empresaId for this profile comes from the URL PATH segment
 *      (`params.empresaId`), NOT from `filters.empresa`. Any URL `empresa`
 *      param is irrelevant on this route — the path is the picker.
 *   2. `decodeURIComponent(rawEmpresaId)` — tikintags carry a `$` prefix
 *      (e.g. `$mario`) which is percent-encoded as `%24` in URL path
 *      segments per RFC 3986. Without decoding, `findEmpresa` would never
 *      match a real empresa_id.
 *   3. Build `empresaFilters = { ...filters, empresa: empresaId }` so the
 *      Phase 2/3/4 domain `filter*` calls narrow to THIS empresa for the
 *      mini-cards (CLI-07). Date filters from the URL are preserved.
 *   4. Fetch BD_Plataforma + BD_Payouts in parallel (`Promise.all`) — both
 *      are needed: transactions for header/chart/bonos+recargas; payouts
 *      for the Payouts mini-card (with the transactionId join below).
 *   5. `findEmpresa(allTx, empresaId, filters)` returns the profile header
 *      data or `null` for unknown empresaId → renders 404 fallback Card.
 *   6. `aggregateMonthlyActivity(allTx, empresaId, asOf)` returns the
 *      12-month zero-filled activity series for the chart (CLI-06). `asOf`
 *      anchors to `filters.to` when present, today otherwise — the rolling
 *      window slides with the URL date filter.
 *   7. Phase 2/3/4 mini-card aggregations narrowed to this empresa:
 *        - Bonos: `summarizeBonos(filterBonos(allTx, empresaFilters))`
 *        - Recargas: `summarizeRecargas(filterRecargas(allTx, empresaFilters))`
 *        - Payouts: `summarizePayouts(filterPayouts(enrichedPayouts, empresaFilters))`
 *      Each domain layer applies its own default predicate (Bonos:
 *      tipo='BONUS', Recargas: RECHARGE_TIPOS, Payouts: state='completed')
 *      plus the date+empresa narrowing.
 *   8. Render: back-link → EmpresaProfileHeader → Card-wrapped
 *      EmpresaActivityChart → EmpresaMiniCards → GenerarVistaClienteButton.
 *
 * Transaction ID join for payouts (mirror of /payouts/page.tsx Plan 03-04):
 *   BD_Payouts.holder is a CARDHOLDER NAME, not a tikintag — so the
 *   empresa filter cannot match `holder === '$mario'`. The only way to
 *   honor `?empresa=$X` on payouts is to build a `Map<transactionId,
 *   empresa_id>` from BD_Plataforma rows and patch each Payout's
 *   `empresa_id` via lookup. We always do this here (the page IS narrowed
 *   to one empresa), unconditional unlike /payouts which gates the join
 *   on `filters.empresa`.
 *
 * Cliente-foco contract delegation:
 *   `data-presenter-hide` on the GenerarVistaClienteButton wrapper ONLY.
 *   Once the button is clicked and presenter is on, the user is on /inicio
 *   anyway; if they navigate back to a profile while presenter is on, the
 *   button shouldn't be visible (presenter-on profile would imply "vista
 *   para cliente" already engaged). All other content stays visible — the
 *   profile IS the cliente's own data, hiding it would defeat the page.
 *   The Tikin-internal share-URL flow runs from this page, but the page
 *   itself is internal-only (Tikin team viewing); the cliente never lands
 *   here directly.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read per
 *     PROJECT.md "lectura en vivo en cada carga".
 *   - `params` and `searchParams` are both `Promise<...>` per Next 16's
 *     dynamic-route signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error / 404 handling:
 *   - If either Sheets read throws (creds missing, schema drift, transient
 *     429), we render an inline `<Card>` with the underlying error message
 *     rather than letting the route group's `error.tsx` swallow it with a
 *     generic copy. Mirror of bonos + payouts + inicio + recargas.
 *   - If `findEmpresa` returns null (unknown empresaId, or no
 *     activity-counting tx ever), we render a friendly "Empresa no
 *     encontrada" Card with a link back to /clientes. NOT a Next.js
 *     `notFound()` — same in-page pattern as the schema-error Card.
 */

import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { EmpresaActivityChart } from "@/components/clientes/EmpresaActivityChart";
import { EmpresaMiniCards } from "@/components/clientes/EmpresaMiniCards";
import { EmpresaProfileHeader } from "@/components/clientes/EmpresaProfileHeader";
import { GenerarVistaClienteButton } from "@/components/clientes/GenerarVistaClienteButton";

import { filterBonos, summarizeBonos } from "@/lib/domain/bonos";
import {
  aggregateMonthlyActivity,
  findEmpresa,
} from "@/lib/domain/clientes";
import { filterPayouts, summarizePayouts } from "@/lib/domain/payouts";
import { filterRecargas, summarizeRecargas } from "@/lib/domain/recargas";
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
    title: `${decodeURIComponent(empresaId)} · Clientes · Tikin Dashboard`,
  };
}

export default async function EmpresaProfilePage({
  params,
  searchParams,
}: PageProps) {
  const { empresaId: rawEmpresaId } = await params;
  // tikintags carry `$` (e.g. `$mario`) — percent-encoded in URL path segments.
  const empresaId = decodeURIComponent(rawEmpresaId);

  const sp = await searchParams;
  const filters = parseFilters(sp);
  // The PROFILE page narrows to THIS empresa regardless of any URL
  // ?empresa=… (the path is the picker, the URL filter is irrelevant here).
  const empresaFilters = { ...filters, empresa: empresaId };

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

  // Profile header data — null when empresa unknown.
  const profile = findEmpresa(allTx, empresaId, filters);
  if (!profile) {
    return (
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
            ← Volver a la lista de empresas
          </Link>
        </CardContent>
      </Card>
    );
  }

  // 12-month activity: rolling window ending at filters.to (or today).
  // Anchor the asOf at noon Bogotá to avoid DST/timezone-edge surprises.
  const asOf = filters.to
    ? new Date(`${filters.to}T12:00:00-05:00`)
    : new Date();
  const monthly = aggregateMonthlyActivity(allTx, empresaId, asOf);

  // Mini-cards: narrow each Phase 2/3/4 domain to this empresa.
  const bonosCurrent = filterBonos(allTx, empresaFilters);
  const recargasCurrent = filterRecargas(allTx, empresaFilters);

  // Payouts join: empresa filter requires `Payout.empresa_id`. Build the
  // Map<transactionId, empresa_id> mirror of /payouts/page.tsx Plan 03-04.
  // Unconditional here because the page is always narrowed to one empresa.
  const txMap = new Map(txResult.rows.map((t) => [t.id, t.empresa_id]));
  const enrichedPayouts = payoutsResult.rows.map((p) => ({
    ...p,
    empresa_id: p.empresa_id ?? txMap.get(p.transactionId),
  }));
  const payoutsCurrent = filterPayouts(enrichedPayouts, empresaFilters);

  const bonosSummary = summarizeBonos(bonosCurrent);
  const recargasSummary = summarizeRecargas(recargasCurrent);
  const payoutsSummary = summarizePayouts(payoutsCurrent);

  return (
    <div className="space-y-6">
      <Link
        href="/clientes"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Volver a empresas
      </Link>

      <EmpresaProfileHeader summary={profile} />

      <Card>
        <CardHeader>
          <CardTitle>Actividad últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <EmpresaActivityChart data={monthly} />
        </CardContent>
      </Card>

      <EmpresaMiniCards
        bonos={bonosSummary}
        recargas={recargasSummary}
        payouts={payoutsSummary}
      />

      <div className="flex justify-end" data-presenter-hide>
        <GenerarVistaClienteButton empresaId={empresaId} />
      </div>
    </div>
  );
}
