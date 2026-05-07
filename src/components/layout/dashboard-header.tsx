/**
 * DashboardHeader — top chrome that sits above the TabNav.
 *
 * Server Component (async). Composes the interactive header pieces:
 *   - Logo (left)
 *   - DateRangePicker + EmpresaFilter (center, hidden in presenter mode)
 *   - LastRefresh + PresenterToggle + Salir link (right)
 *
 * The filter components and presenter toggle are Client Components
 * that read URL state via `useSearchParams`. The header itself stays
 * a Server Component because it has no state of its own — it just
 * arranges static and client children, and now also fetches the
 * empresa registry for the EmpresaFilter dropdown.
 *
 * Phase 2 wiring (was Phase 1: `empresas={[]}`):
 *   - Reads transactions via `getCachedTransactions` so this fetch is
 *     deduped with whatever the page (e.g. /bonos) is also doing in
 *     the same render — single Sheets call per request.
 *   - Computes the unique empresa list with `getEmpresaRegistry`.
 *   - Degrades gracefully: if the Sheet read throws (creds missing,
 *     schema drift, network), the dropdown renders empty just as in
 *     Phase 1 and the real error surfaces on the data-bearing page
 *     (where users expect to see it).
 */

import { DateRangePicker } from "@/components/filters/date-range-picker";
import {
  EmpresaFilter,
  type EmpresaOption,
} from "@/components/filters/empresa-filter";
import { StatusFilter } from "@/components/filters/status-filter";
import { TypeFilter } from "@/components/filters/type-filter";
import { LastRefresh } from "@/components/layout/last-refresh";
import { PresenterToggle } from "@/components/layout/presenter-toggle";
import { getEmpresaRegistry } from "@/lib/domain/empresas";
import { getCachedTransactions } from "@/lib/sheets/transactions";

export async function DashboardHeader() {
  let empresas: EmpresaOption[] = [];
  try {
    const result = await getCachedTransactions();
    empresas = getEmpresaRegistry(result.rows);
  } catch (err) {
    // Sheet read failed (creds missing, schema mismatch, transient
    // network). Render the filter empty — the page itself will surface
    // the underlying error to the user on its own. Logging here lets
    // ops see the failure in Vercel Functions output without breaking
    // the chrome render.
    console.error("[DashboardHeader] empresa registry failed:", err);
  }

  return (
    <header className="border-b bg-background">
      <div className="flex flex-wrap items-center gap-4 px-6 py-3">
        <span className="font-heading text-base font-semibold">
          Tikin Dashboard
        </span>

        <div
          data-presenter-hide
          className="flex flex-wrap items-center gap-2"
        >
          <DateRangePicker />
          <EmpresaFilter empresas={empresas} />
          <StatusFilter />
          <TypeFilter />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <LastRefresh />
          <PresenterToggle />
          <a
            href="/logout"
            data-presenter-hide
            className="text-xs text-muted-foreground hover:underline"
          >
            Salir
          </a>
        </div>
      </div>
    </header>
  );
}
