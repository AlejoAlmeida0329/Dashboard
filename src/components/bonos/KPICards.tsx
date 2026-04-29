/**
 * Header KPIs for the Bonos tab — Server Component.
 *
 * Renders two cards in a 2-col grid (1-col on mobile):
 *   1. Ticket promedio por bono — ALWAYS VISIBLE in both internal and
 *      Modo Presentación (cliente needs to see "what's the average sale").
 *   2. Comisión total ganada — `data-presenter-hide` on the wrapper so
 *      the CSS contract from Phase 1 hides it in Modo Presentación.
 *      This is Tikin's revenue and not appropriate to show to a cliente
 *      projecting their own data.
 *
 * Format gates:
 *   - All COP values via `formatCOP`.
 *   - Empty-state copy ("Sin bonos en el período") avoids dividing by zero
 *     visually — `summarizeBonos` already returns `ticketPromedio = 0`
 *     for an empty filter, but the subtitle warns the user that the value
 *     is meaningful.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BonoSummary } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: BonoSummary;
};

export function KPICards({ summary }: Props) {
  const hasData = summary.count > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Ticket promedio — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Ticket promedio por bono</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.ticketPromedio)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `${formatInteger(summary.count)} bonos en el período`
              : "Sin bonos en el período"}
          </p>
        </CardContent>
      </Card>

      {/* Comisión — oculto en Modo Presentación */}
      <Card data-presenter-hide>
        <CardHeader>
          <CardDescription>Comisión total ganada</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.comisionTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Sobre {formatCOP(summary.montoTotal)} vendidos
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
