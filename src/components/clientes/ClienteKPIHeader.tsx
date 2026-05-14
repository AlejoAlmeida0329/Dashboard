/**
 * ClienteKPIHeader — cabecera de fechas del dossier Vista Cliente.
 *
 * Server Component. Three date-anchored stats lead the dossier so the
 * cliente recognizes "since when have we been active and what's our
 * footprint" before any KPI cards: Primera tx · Última actividad · Total tx.
 *
 * Balance, Pocket activo and Tiempo vs benchmark were removed (the page
 * leads with the actionable transaction-shape KPIs in BonosClienteCards /
 * P2PCards / ComprasClienteCard instead).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClienteSummary } from "@/lib/domain/cliente";
import { formatBogotaDate, formatInteger } from "@/lib/format";

type Props = {
  summary: ClienteSummary;
};

export function ClienteKPIHeader({ summary }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{summary.empresa_nombre}</CardTitle>
        <CardDescription className="font-mono">
          {summary.tikintag}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Primera tx"
            value={
              summary.primeraTx ? formatBogotaDate(summary.primeraTx) : "—"
            }
            subText="Histórico"
          />
          <Stat
            label="Última actividad"
            value={
              summary.ultimaActividad
                ? formatBogotaDate(summary.ultimaActividad)
                : "—"
            }
            subText="Recibido completado"
          />
          <Stat
            label="Total tx"
            value={formatInteger(summary.totalTx)}
            subText="Histórico"
          />
        </div>
      </CardContent>
    </Card>
  );
}

type StatProps = {
  label: string;
  value: string;
  subText?: string;
};

function Stat({ label, value, subText }: StatProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-heading text-2xl tabular-nums text-foreground">
        {value}
      </p>
      {subText ? (
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {subText}
        </p>
      ) : null}
    </div>
  );
}
