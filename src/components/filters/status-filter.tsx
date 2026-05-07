"use client";

/**
 * StatusFilter — multi-select dropdown over transaction lifecycle
 * status (completed / failed / in_progress).
 *
 * Spec: CROSS-V2-01. Phase 6 entrega la UI; cada Phase 7+ decide cómo
 * aplicar `filters.status` en sus domain functions (Inicio agrega
 * tasa de éxito global; Bonos / Payouts / Recargas filtran su tabla,
 * etc.). Esto NO toca domain functions todavía.
 *
 * URL contract:
 *   - Param: `?status=completed,failed,in_progress` (CSV).
 *   - Empty selection → param removed entirely (handled by buildUrl).
 *   - Selection persists across navigation via URL (Next.js soft nav).
 *
 * Implementation: native `<details>` collapsible with checkbox
 * children. No external dropdown library — Phase 6 prioritizes
 * foundation, not UX polish. If usage shows we need keyboard-friendly
 * combobox semantics, Phase 7+ can swap the trigger without changing
 * this URL contract.
 *
 * The trigger button label compresses the selection:
 *   - Empty: "Estado"
 *   - Single: "Estado: Completed"
 *   - Multi: "Estado: 2"  (count, not list — keeps the bar compact)
 *
 * Styling mirrors `EmpresaFilter` so the two filters sit naturally
 * next to each other in the header.
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { buildUrl, parseFilters } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "in_progress", label: "In progress" },
];

export function StatusFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsObj: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (!(k in paramsObj)) paramsObj[k] = v;
  });
  const filters = parseFilters(paramsObj);
  const selected = filters.status ?? [];

  const triggerLabel = (() => {
    if (selected.length === 0) return "Estado";
    if (selected.length === 1) {
      const opt = STATUS_OPTIONS.find((o) => o.value === selected[0]);
      return `Estado: ${opt?.label ?? selected[0]}`;
    }
    return `Estado: ${selected.length}`;
  })();

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    const url = buildUrl(pathname, {
      ...filters,
      status: next.length > 0 ? next : undefined,
    });
    router.push(url);
  };

  return (
    <details className="relative">
      <summary
        className={cn(
          "inline-flex h-8 cursor-pointer list-none items-center rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors select-none",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "[&::-webkit-details-marker]:hidden",
        )}
        aria-label="Filtrar por estado"
      >
        {triggerLabel}
        <span aria-hidden className="ml-1.5 text-xs opacity-60">
          ▾
        </span>
      </summary>
      <div
        className={cn(
          "absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
        )}
        role="group"
        aria-label="Opciones de estado"
      >
        {STATUS_OPTIONS.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(opt.value)}
                className="h-3.5 w-3.5"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </details>
  );
}
