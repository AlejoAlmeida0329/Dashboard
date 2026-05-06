/**
 * EmpresaMiniCards — Server Component, 3 mini cards summarizing this
 * empresa's activity in Bonos, Recargas, Payouts. CLI-07.
 *
 * Each card shows count + the most-relevant single metric for that domain:
 *   - Bonos: # bonos + Ticket promedio
 *   - Recargas: # recargas + Total recargado
 *   - Payouts: # payouts + Mediana (P50) latency
 *
 * Pattern: page composition uses Phase 2/3/4 domain functions
 * (filterBonos+summarizeBonos / filterRecargas+summarizeRecargas /
 * filterPayouts+summarizePayouts) narrowed to {filters, empresa: empresaId}
 * and passes the 3 summaries here.
 *
 * Cliente-foco contract: NO data-presenter-hide on the wrapper or any card.
 * The cliente seeing their own per-domain summaries is desired.
 *
 * Format gates: formatCOP, formatInteger, formatDuration.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BonoSummary } from "@/lib/domain/bonos";
import type { PayoutSummary } from "@/lib/domain/payouts";
import type { RecargaSummary } from "@/lib/domain/recargas";
import { formatCOP, formatDuration, formatInteger } from "@/lib/format";

type Props = {
  bonos: BonoSummary;
  recargas: RecargaSummary;
  payouts: PayoutSummary;
};

export function EmpresaMiniCards({ bonos, recargas, payouts }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardDescription>Bonos</CardDescription>
          <CardTitle className="font-heading text-2xl tabular-nums">
            {formatInteger(bonos.count)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Ticket promedio:{" "}
            <span className="font-mono tabular-nums">
              {formatCOP(bonos.ticketPromedio)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Total:{" "}
            <span className="font-mono tabular-nums">
              {formatCOP(bonos.montoTotal)}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Recargas</CardDescription>
          <CardTitle className="font-heading text-2xl tabular-nums">
            {formatInteger(recargas.count)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Total recargado:{" "}
            <span className="font-mono tabular-nums">
              {formatCOP(recargas.montoTotal)}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Payouts</CardDescription>
          <CardTitle className="font-heading text-2xl tabular-nums">
            {formatInteger(payouts.count)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Mediana (P50):{" "}
            <span className="font-mono tabular-nums">
              {payouts.count === 0 ? "—" : formatDuration(payouts.p50Seconds)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Volumen:{" "}
            <span className="font-mono tabular-nums">
              {formatCOP(payouts.montoTotal)}
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
