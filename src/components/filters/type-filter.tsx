"use client";

/**
 * TypeFilter — multi-select dropdown over transaction `tipo` (BONUS,
 * PAYOUT_BANK, PURCHASE, P2P, PAYIN_PSE, PAYIN_TRANSFER, FEE, REFUND,
 * CREDIT_ADJUSTMENT, TREASURY).
 *
 * Spec: CROSS-V2-02. Phase 6 entrega la UI; cada Phase 7+ decide cómo
 * aplicar `filters.tipo` en sus domain functions (cada sección tiene
 * tipos relevantes — Bonos sólo BONUS, Payouts sólo PAYOUT_BANK, etc.;
 * Inicio puede mostrar el cross-cut completo). Esto NO toca domain
 * functions todavía.
 *
 * Option list is hardcoded (and re-declared locally) instead of
 * importing the `TransactionType` union from domain types.ts because:
 *   - We exclude the defensive fallbacks (`UKNOWN`, `OTRO`) — they're
 *     parser safety nets, not user-facing filter intents.
 *   - The label/value mapping is a UI concern, not a domain concern.
 *   - Decoupling the filter from schemas.ts means a Sheet adding a
 *     new transaction type doesn't auto-pollute the dropdown without
 *     a deliberate UI update.
 *
 * URL contract:
 *   - Param: `?tipo=BONUS,P2P,PAYOUT_BANK` (CSV).
 *   - Empty selection → param removed entirely.
 *   - Persists across navigation via URL (Next.js soft nav).
 *
 * Implementation: native `<details>` collapsible with checkbox
 * children. Same minimalist approach as StatusFilter — Phase 7+ may
 * upgrade if usage shows it's needed.
 *
 * Trigger label compresses the selection:
 *   - Empty: "Tipo"
 *   - Single: "Tipo: Bonus"
 *   - Multi: "Tipo: 3"
 */

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { buildUrl, parseFilters } from "@/lib/url-state";
import { cn } from "@/lib/utils";

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "BONUS", label: "Bonus" },
  { value: "PAYOUT_BANK", label: "Payout (banco)" },
  { value: "PURCHASE", label: "Compra (tarjeta)" },
  { value: "P2P", label: "P2P" },
  { value: "PAYIN_PSE", label: "Recarga PSE" },
  { value: "PAYIN_TRANSFER", label: "Recarga Transfer" },
  { value: "FEE", label: "Comisión" },
  { value: "REFUND", label: "Refund" },
  { value: "CREDIT_ADJUSTMENT", label: "Ajuste" },
  { value: "TREASURY", label: "Tesorería" },
];

export function TypeFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramsObj: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (!(k in paramsObj)) paramsObj[k] = v;
  });
  const filters = parseFilters(paramsObj);
  const selected = filters.tipo ?? [];

  const triggerLabel = (() => {
    if (selected.length === 0) return "Tipo";
    if (selected.length === 1) {
      const opt = TYPE_OPTIONS.find((o) => o.value === selected[0]);
      return `Tipo: ${opt?.label ?? selected[0]}`;
    }
    return `Tipo: ${selected.length}`;
  })();

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    const url = buildUrl(pathname, {
      ...filters,
      tipo: next.length > 0 ? next : undefined,
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
        aria-label="Filtrar por tipo"
      >
        {triggerLabel}
        <span aria-hidden className="ml-1.5 text-xs opacity-60">
          ▾
        </span>
      </summary>
      <div
        className={cn(
          "absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
        )}
        role="group"
        aria-label="Opciones de tipo"
      >
        {TYPE_OPTIONS.map((opt) => {
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
