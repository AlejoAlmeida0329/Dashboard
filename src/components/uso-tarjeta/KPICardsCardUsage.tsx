/**
 * KPICardsCardUsage — Top KPI strip for /uso-tarjeta (Plan 08-02 CARD-V2-02).
 *
 * Server Component. Renders THREE KPI cards in a responsive 1 → 3 col grid:
 *   1. Compras totales   (formatInteger)  — PRIMARY, text-4xl, text-section-tarjeta
 *   2. Volumen           (formatCOP)      — secondary, text-3xl
 *   3. Ticket promedio   (formatCOP)      — secondary, text-3xl
 *
 * Section accent rule (Plan 08-02 visual conventions): EXACTLY ONE card on the
 * page carries `text-section-tarjeta` (Amber, Phase 6 Plan 04 OKLCH). The
 * "Compras totales" card is the focal metric — eye-magnet first position,
 * primary count headline. AdoptionCard intentionally does NOT use the section
 * accent; it stays on the foreground/muted pair so the page reads with one
 * clear protagonist instead of competing accent zones.
 *
 * Format gates:
 *   - All COP / integer values flow through `@/lib/format`. ZERO
 *     `Intl.NumberFormat` / `toLocaleString` here (Pitfall 9 / format.ts gate).
 *   - Empty period → `summarizePurchases` returns zeros (no NaN), and the
 *     numbers render as $0 / 0 — preserves layout stability across filters.
 *     Same convention as PayoutsKPICardsV2.
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

export function KPICardsCardUsage({ summary }: Props) {
  const hasData = summary.totalCompras > 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 1. Compras totales — PRIMARY (section accent lands here) */}
      <Card>
        <CardHeader>
          <CardDescription>Compras totales</CardDescription>
          <CardTitle className="font-heading text-section-tarjeta text-4xl tabular-nums">
            {formatInteger(summary.totalCompras)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData ? "Compras con tarjeta en el período" : "Sin compras en el período"}
          </p>
        </CardContent>
      </Card>

      {/* 2. Volumen */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.volumenCOP)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Suma de compras (COP)
          </p>
        </CardContent>
      </Card>

      {/* 3. Ticket promedio */}
      <Card>
        <CardHeader>
          <CardDescription>Ticket promedio</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.ticketPromedio)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `Sobre ${formatInteger(summary.totalCompras)} compras`
              : "Sin compras en el período"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
