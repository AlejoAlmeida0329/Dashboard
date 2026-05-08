/**
 * v2 Bonos KPI header — Server Component (BON-V2-01..02).
 *
 * 3 cards: Bonos enviados (count) · Volumen enviado (COP) · Ticket
 * promedio (COP). All accents use `text-section-bonos` (Phase 6 Plan 04
 * Violet OKLCH).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BonoSummaryV2 } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: BonoSummaryV2;
};

export function KPICardsV2({ summary }: Props) {
  const hasData = summary.countOut > 0;
  const emptyHint = "Sin bonos en el período";

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>Bonos enviados</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-section-bonos">
            {formatInteger(summary.countOut)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData ? formatCOP(summary.montoOut) : emptyHint}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Volumen enviado</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-section-bonos">
            {formatCOP(summary.montoOut)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `${formatInteger(summary.countOut)} bonos`
              : emptyHint}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Ticket promedio</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-muted-foreground">
            {formatCOP(summary.ticketPromedio)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `Sobre ${formatInteger(summary.countOut)} bonos`
              : emptyHint}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
