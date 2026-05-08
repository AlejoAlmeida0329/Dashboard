/**
 * DashboardHeader — top chrome that sits above the TabNav.
 *
 * Server Component. Composes:
 *   - Logo (left)
 *   - DateRangePicker (center, hidden in presenter mode)
 *   - LastRefresh + ThemeToggle + PresenterToggle + Salir (right)
 *
 * Empresa / status / tipo filters were removed from the UI — the URL
 * params (`?empresa=`, `?status=`, `?tipo=`) still propagate through
 * `parseFilters()` and the domain layer for direct-link / cliente-foco
 * use cases, just no header dropdowns to set them interactively.
 */

import { DateRangePicker } from "@/components/filters/date-range-picker";
import { LastRefresh } from "@/components/layout/last-refresh";
import { PresenterToggle } from "@/components/layout/presenter-toggle";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
        </div>

        <div className="ml-auto flex items-center gap-4">
          <LastRefresh />
          <ThemeToggle />
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
