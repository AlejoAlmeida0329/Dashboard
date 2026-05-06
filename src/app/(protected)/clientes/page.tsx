/**
 * Clientes list page — Server Component composition for /clientes (CLI-01..04).
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Phase 1 contract).
 *   2. Fetch transactions via `getCachedTransactions` — same call
 *      `DashboardHeader` makes. React `cache()` dedupes the Sheets API
 *      roundtrip so chrome and page share a single fetch per request.
 *   3. Build the per-empresa index via `deriveEmpresasIndex(allTx, filters)`
 *      (Plan 05-01). Single pass over transactions; histórico-vs-período
 *      split included; 'activa'/'inactiva' tied to the filter window.
 *   4. Compute KPI counts via `summarizeEmpresasIndex(rows)`.
 *   5. Render ClientesKPICards (Total empresas + Empresas activas) above
 *      ClientesTable (sortable + searchable empresa list).
 *
 * Why this page IGNORES the empresa filter:
 *   The /clientes table is the place where the user PICKS an empresa
 *   (rows are Links to /clientes/[empresaId]), NOT where they narrow to
 *   one. `deriveEmpresasIndex` ignores `filters.empresa` by design — it
 *   returns one row per empresa regardless of selection. If the URL
 *   carries `?empresa=$mario` here, the table still shows all 233
 *   empresas; clicking any row lands on that empresa's profile (Plan
 *   05-04 dynamic route). Documented in clientes.ts JSDoc.
 *
 * Cliente-foco contract delegation:
 *   Zero `data-presenter*` attributes on this page. The list view is
 *   internal-only — Tikin team navigation, never shown to a cliente.
 *   The cliente-foco share-URL flow lives at the destination (Plan 05-04
 *   profile page → "Generar vista para cliente" → /inicio?empresa=…&presenter=1).
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
 *     swallow it with a generic copy. Mirror of bonos + payouts + inicio
 *     + recargas pages.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ClientesKPICards } from "@/components/clientes/ClientesKPICards";
import { ClientesTable } from "@/components/clientes/ClientesTable";

import {
  deriveEmpresasIndex,
  summarizeEmpresasIndex,
} from "@/lib/domain/clientes";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Clientes · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientesPage({ searchParams }: PageProps) {
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

  const rows = deriveEmpresasIndex(txResult.rows, filters);
  const summary = summarizeEmpresasIndex(rows);

  return (
    <div className="space-y-6">
      <ClientesKPICards summary={summary} />
      <ClientesTable rows={rows} />
    </div>
  );
}
