"use client";

/**
 * TabNav — top navigation bar across the 5 dashboard sections.
 *
 * Client Component because:
 *   - It needs `usePathname` to highlight the active tab.
 *   - It reads the current URL filters via `useSearchParams` so that
 *     each `<Link>` href preserves them (sticky filters across tabs).
 *     The layout can't pass these as props because layouts don't
 *     receive searchParams in the App Router.
 *
 * Hidden in presenter mode via the `data-presenter-hide` attribute on
 * the wrapper, which the global CSS rule resolves to `display:none`
 * whenever `[data-presenter='on']` is set on an ancestor.
 */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { buildUrl, parseFilters } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string }[] = [
  { href: "/inicio", label: "Inicio" },
  { href: "/bonos", label: "Bonos" },
  { href: "/payouts", label: "Payouts" },
  { href: "/uso-tarjeta", label: "Uso Tarjeta" },
  { href: "/clientes", label: "Clientes" },
  { href: "/recargas", label: "Recargas" },
];

export function TabNav() {
  const pathname = usePathname();
  const rawSearchParams = useSearchParams();

  // Convert URLSearchParams to the plain object shape parseFilters
  // expects. Multi-value keys are collapsed to their first occurrence,
  // matching parseFilters' own normalization.
  const paramsObj: Record<string, string> = {};
  rawSearchParams.forEach((value, key) => {
    if (!(key in paramsObj)) paramsObj[key] = value;
  });
  const filters = parseFilters(paramsObj);

  return (
    <nav
      data-presenter-hide
      aria-label="Secciones del dashboard"
      className="border-b bg-background"
    >
      <ul className="flex items-center gap-1 px-6">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={buildUrl(tab.href, filters)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
