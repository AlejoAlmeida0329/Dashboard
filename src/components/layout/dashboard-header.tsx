/**
 * DashboardHeader — top chrome that sits above the TabNav.
 *
 * Server Component. Renders only static chrome (logo + logout link)
 * here in Task 1; the interactive pieces — DateRangePicker,
 * EmpresaFilter, PresenterToggle, LastRefresh — are wired in Task 3.
 *
 * Children components that depend on URL state read it themselves
 * via `useSearchParams` (Client Components), because layouts don't
 * receive searchParams in the App Router.
 *
 * Presenter mode: anything that should disappear in presenter mode
 * is wrapped with `data-presenter-hide`, resolved by global CSS.
 */

export function DashboardHeader() {
  return (
    <header className="border-b bg-background">
      <div className="flex items-center gap-4 px-6 py-3">
        <span className="font-heading text-base font-semibold">
          Tikin Dashboard
        </span>

        {/* Filter pickers, presenter toggle, and last-refresh stamp
            are added in Task 3. */}
        <div className="ml-auto flex items-center gap-4">
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
