"use client";

/**
 * EmpresaFilter — single-select dropdown that scopes the dashboard to
 * one empresa.
 *
 * Phase 1 reality: the parent passes `empresas={[]}` because we have
 * no Sheets data yet. The select still renders gracefully — the
 * "(Todas las empresas)" option is always present, and the user can
 * pick it (a no-op since it's already the default). Phase 2+ will
 * pass a real list once the empresa registry is computed from
 * transaction Sheets.
 *
 * Like every other filter, the selected empresa is written to the URL
 * (`?empresa=<id>`), not React state — sticky across navigation,
 * shareable.
 *
 * Implementation: native `<select>`. We don't need a custom Combobox
 * for v1; once the empresa list grows past a dozen entries, swap in
 * a Combobox without changing the URL contract.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";
import { buildUrl, parseFilters } from "@/lib/url-state";
import { cn } from "@/lib/utils";

export type EmpresaOption = {
  id: string;
  nombre: string;
};

type EmpresaFilterProps = {
  empresas: EmpresaOption[];
};

export function EmpresaFilter({ empresas }: EmpresaFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsObj: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (!(k in paramsObj)) paramsObj[k] = v;
  });
  const filters = parseFilters(paramsObj);

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value || undefined;
    const url = buildUrl(pathname, { ...filters, empresa: next });
    router.push(url);
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="empresa-filter" className="sr-only">
        Empresa
      </Label>
      <select
        id="empresa-filter"
        value={filters.empresa ?? ""}
        onChange={onChange}
        className={cn(
          "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        <option value="">(Todas las empresas)</option>
        {empresas.map((empresa) => (
          <option key={empresa.id} value={empresa.id}>
            {empresa.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
