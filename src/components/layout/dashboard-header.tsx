/**
 * DashboardHeader — top chrome that sits above the TabNav.
 *
 * Server Component. Composes the interactive header pieces:
 *   - Logo (left)
 *   - DateRangePicker + EmpresaFilter (center, hidden in presenter mode)
 *   - LastRefresh + PresenterToggle + Salir link (right)
 *
 * The filter components and presenter toggle are Client Components
 * that read URL state via `useSearchParams`. The header itself stays
 * a Server Component because it has no state of its own — it just
 * arranges static and client children.
 *
 * Phase 1 wiring: `EmpresaFilter` receives an empty list. Phase 2+
 * fills it from the empresa registry computed off the transactions
 * Sheet.
 */

import { DateRangePicker } from "@/components/filters/date-range-picker";
import { EmpresaFilter } from "@/components/filters/empresa-filter";
import { LastRefresh } from "@/components/layout/last-refresh";
import { PresenterToggle } from "@/components/layout/presenter-toggle";

export function DashboardHeader() {
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
          <EmpresaFilter empresas={[]} />
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
