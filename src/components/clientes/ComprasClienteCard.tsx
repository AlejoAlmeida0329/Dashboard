/**
 * ComprasClienteCard — Compras con tarjeta del usuario (CLI-V2-06).
 *
 * Server Component. Consumes `PurchaseSummary` from Plan 08-01 (the page
 * composition runs `filterPurchases` narrowed to `empresa_id === tikintag`
 * then `summarizePurchases` over that subset and threads the result here).
 *
 * Layout: ONE card with three inline stats — Compras totales (PRIMARY
 * headline) · Volumen COP · Ticket promedio personal. The headline is the
 * count because that's what the dossier's "card holder behavior" question
 * leads with ("¿cuántas compras hizo este usuario?"); volumen and ticket
 * are secondary lines.
 *
 * Why a single card instead of a 3-card strip (the `KPICardsCardUsage`
 * shape from Plan 08-02): the parent dossier page already houses 5 other
 * sections (cabecera + retiros + bonos + p2p + timeline) — keeping
 * Compras as a single compact card preserves the dossier's vertical
 * rhythm. KPICardsCardUsage exists at the section-level page where 3
 * cards are the focal kpi strip; here Compras is just one of several
 * dimensions and the three values fit in one card without losing
 * legibility.
 *
 * Note: Plan 09-03 may add a recent-purchases mini-list inside this card
 * later if visual checkpoint reveals the need; out of scope for 09-02
 * leaves and intentionally NOT pre-emptively scaffolded to avoid YAGNI.
 *
 * Empty state: `summary.totalCompras === 0` → headline renders "0",
 * volumen + ticket both render "—" via formatCOP. Card chrome stays for
 * layout stability across filters — same convention as `BonosClienteCards`.
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes — purchase
 * counts/volumen are visible to clients in presenter mode (no internal-
 * only intelligence).
 *
 * One-section-accent-per-page rule: this leaf does NOT use
 * `text-section-tarjeta` (the Uso Tarjeta page's accent). It also does
 * NOT use `text-section-clientes` — that accent is reserved for the
 * benchmark KPI in `ClienteKPIHeader`. Headlines render in
 * `text-foreground` per Plan 08-02 codified rule.
 *
 * Format gates: all COP / integer values via `@/lib/format`.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PurchaseSummary } from "@/lib/domain/cardUsage";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: PurchaseSummary;
};

export function ComprasClienteCard({ summary }: Props) {
  const hasData = summary.totalCompras > 0;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Compras con tarjeta</CardDescription>
        <CardTitle className="font-heading text-3xl tabular-nums">
          {formatInteger(summary.totalCompras)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Volumen
            </p>
            <p className="text-sm tabular-nums">
              {hasData ? formatCOP(summary.volumenCOP) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ticket promedio
            </p>
            <p className="text-sm tabular-nums">
              {hasData ? formatCOP(summary.ticketPromedio) : "—"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {hasData
            ? "Compras con tarjeta en el período"
            : "Sin compras en el período"}
        </p>
      </CardContent>
    </Card>
  );
}
