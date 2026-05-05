"use client";

/**
 * PresenterFrame — the outer wrapper that owns the `data-presenter`
 * and `data-empresa-filter` attributes used by the global CSS to
 * grow typography, hide chrome, and gate cliente-foco visibility.
 *
 * Why a Client Component:
 *   In the Next.js App Router, layouts do NOT receive `searchParams`
 *   and do NOT re-render on soft navigation. Reading the presenter
 *   flag inside the Server-Component layout would freeze the value at
 *   the first render. We need this wrapper to react to URL changes
 *   live (e.g. user toggles presenter mode → URL changes → frame
 *   updates), so it's a Client Component using `useSearchParams`.
 *
 * Cliente-foco gate (`data-empresa-filter`):
 *   When a specific empresa is selected (`?empresa=<id>`), the
 *   wrapper writes `data-empresa-filter="active"`; otherwise "none".
 *   Paired with `data-presenter="on"` in globals.css, this hides
 *   elements tagged `data-presenter-empresa-hide` (e.g. the Inicio
 *   "hechos curados" container, the EmpresasActivasChart card)
 *   that only make sense from Tikin's internal multi-empresa view.
 *
 * It is intentionally a thin shell: no business logic, just the
 * attributes + a flex column layout. All dashboard children — header,
 * tab nav, main — are passed in as `children`.
 */

import { useSearchParams } from "next/navigation";

export function PresenterFrame({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const presenter = searchParams.get("presenter") === "1" ? "on" : "off";
  // EmpresaFilter writes "" (or removes the param entirely) for the
  // "Todas las empresas" option, so checking the empty string is
  // sufficient today. Defensive `__all__` guard kept for future-proofing
  // in case a sentinel constant is introduced later (Plan 02-02 STATE
  // entry mentioned the literal as tentative; verified absent in
  // src/lib/url-state.ts and src/components/filters/empresa-filter.tsx
  // at the time this code was written).
  const empresaParam = searchParams.get("empresa") ?? "";
  const empresaFilter =
    empresaParam !== "" && empresaParam !== "__all__" ? "active" : "none";

  return (
    <div
      data-presenter={presenter}
      data-empresa-filter={empresaFilter}
      className="flex min-h-full flex-1 flex-col"
    >
      {children}
    </div>
  );
}
