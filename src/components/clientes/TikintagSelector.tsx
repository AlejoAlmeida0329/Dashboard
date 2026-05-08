"use client";

/**
 * TikintagSelector — section-level dropdown that switches the dossier
 * to a different tikintag without going back to /clientes (CLI-V2-01).
 *
 * Mirrors `EmpresaFilter` in `src/components/filters/empresa-filter.tsx`
 * but writes the selection to the URL PATH (/clientes/{id}) rather than
 * to a search-param. Path-based selection preserves the established v1.0
 * dynamic-route convention (the existing share-URL flow already uses
 * /clientes/[empresaId]); the v2 dossier inherits the same shape.
 *
 * On change: `router.push("/clientes/{newId}" + preserved query string)`.
 * The current `searchParams` (filters + presenter mode) ride along so the
 * user keeps their date range / presenter context across switches —
 * Phase 9 essentials: "Cambio de cliente reconfigura todo el dossier sin
 * recarga" (CONTEXT.md specifics).
 *
 * Encoding: tikintags carry a leading `$` (e.g. `$mario`). RFC 3986 reserves
 * `$` outside path segments, so `encodeURIComponent` is required when
 * embedding in `/clientes/{tikintag}` — `$mario` → `%24mario`. Decoding
 * happens automatically in the page route param.
 *
 * Implementation: native `<select>` (same convention as EmpresaFilter; once
 * the 235-tikintag list grows past ~500 a Combobox swap is non-breaking
 * because the URL contract is the only stable surface).
 */

import { useRouter, useSearchParams } from "next/navigation";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type TikintagOption = {
  id: string;
  nombre: string;
};

type Props = {
  options: TikintagOption[];
  current: string;
};

export function TikintagSelector({ options, current }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const onChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (!next || next === current) return;
    const qs = searchParams.toString();
    const path = `/clientes/${encodeURIComponent(next)}`;
    router.push(qs ? `${path}?${qs}` : path);
  };

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="tikintag-selector" className="sr-only">
        Tikintag
      </Label>
      <select
        id="tikintag-selector"
        value={current}
        onChange={onChange}
        className={cn(
          "h-8 rounded-lg border border-input bg-background px-2.5 text-sm font-mono outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:pointer-events-none disabled:opacity-50",
        )}
      >
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
