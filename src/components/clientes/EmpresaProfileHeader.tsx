/**
 * EmpresaProfileHeader — Server Component header for /clientes/[empresaId].
 *
 * Renders:
 *   - empresa_nombre (large, font-heading)
 *   - Status badge (Activa / Inactiva — same convention as ClientesTable)
 *   - "Última actividad: <date>" line (formatBogotaDate)
 *   - 4 inline KPIs: $ período, $ histórico, # tx período, # tx histórico
 *
 * Cliente-foco contract: NO data-presenter-hide here. The header is fine
 * for cliente view — it shows their own name + their own activity. The
 * share-URL flow (Plan 05-04 button) replaces this view with /inicio
 * anyway.
 *
 * Format gates: formatCOP, formatInteger, formatBogotaDate.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EmpresaProfileSummary } from "@/lib/domain/clientes";
import { formatBogotaDate, formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: EmpresaProfileSummary;
};

export function EmpresaProfileHeader({ summary }: Props) {
  const isActiva = summary.status === "activa";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <CardTitle className="font-heading text-2xl">
            {summary.empresa_nombre}
          </CardTitle>
          <span
            className={
              isActiva ? "text-sm text-foreground" : "text-sm text-muted-foreground"
            }
          >
            {isActiva ? "Activa" : "Inactiva"}
          </span>
        </div>
        <CardDescription>
          Última actividad: {formatBogotaDate(summary.ultimaActividad)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="$ del período" value={formatCOP(summary.montoPeriod)} />
          <Stat label="$ histórico" value={formatCOP(summary.montoHistorico)} />
          <Stat label="# tx período" value={formatInteger(summary.txPeriod)} />
          <Stat label="# tx histórico" value={formatInteger(summary.txHistorico)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl tabular-nums">{value}</p>
    </div>
  );
}
