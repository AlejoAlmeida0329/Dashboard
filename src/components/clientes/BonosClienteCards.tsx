/**
 * BonosClienteCards — Bonos recibidos vs enviados para tikintag (CLI-V2-04).
 *
 * Server Component. Consumes `BonoSummaryV2` (Plan 07-01) — the page
 * composition (Plan 09-03) runs `filterBonosV2` narrowed to
 * `empresa_id === tikintag` then `summarizeBonosV2` over that subset and
 * threads the result here.
 *
 * Layout: a 2-card responsive grid (1 → 2 cols).
 *   - Card 1: Recibidos — countIn (PRIMARY headline) · monto recibido ·
 *             ticket promedio recibido
 *   - Card 2: Enviados — countOut (PRIMARY headline) · monto enviado ·
 *             ticket promedio enviado
 *
 * Per-direction ticket promedio derivation: `BonoSummaryV2.ticketPromedio`
 * is across BOTH directions combined. The cards want PER-DIRECTION averages
 * (the dossier value-prop is "qué tan grandes son los bonos que ENVÍA vs
 * los que RECIBE este usuario"), so we derive locally:
 *   ticketIn  = countIn  > 0 ? montoIn  / countIn  : 0
 *   ticketOut = countOut > 0 ? montoOut / countOut : 0
 *
 * Empty state: counts === 0 → "—" subtext via formatCOP. Card chrome stays
 * for layout stability across filter changes.
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes — bonos in/out
 * are visible to clients in presenter mode (no internal-only intelligence
 * here; same conservative default as `MethodSplitCard`).
 *
 * One-section-accent-per-page rule: this leaf does NOT use
 * `text-section-clientes`. The section accent lives EXCLUSIVELY in
 * `ClienteKPIHeader`'s benchmark KPI per Plan 08-02's codified rule.
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
import type { BonoSummaryV2 } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: BonoSummaryV2;
};

export function BonosClienteCards({ summary }: Props) {
  const ticketIn =
    summary.countIn > 0 ? summary.montoIn / summary.countIn : 0;
  const ticketOut =
    summary.countOut > 0 ? summary.montoOut / summary.countOut : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* 1. Recibidos */}
      <Card>
        <CardHeader>
          <CardDescription>Bonos recibidos</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(summary.countIn)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm tabular-nums">
            {formatCOP(summary.montoIn)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            Ticket promedio:{" "}
            {summary.countIn > 0 ? formatCOP(ticketIn) : "—"}
          </p>
        </CardContent>
      </Card>

      {/* 2. Enviados */}
      <Card>
        <CardHeader>
          <CardDescription>Bonos enviados</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(summary.countOut)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm tabular-nums">
            {formatCOP(summary.montoOut)}
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            Ticket promedio:{" "}
            {summary.countOut > 0 ? formatCOP(ticketOut) : "—"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
