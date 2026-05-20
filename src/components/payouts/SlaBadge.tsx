/**
 * SlaBadge — pill que lee "X hábiles · ✓ dentro de SLA" o
 * "X hábiles · ⚠ +Y vs SLA" según el verdict contra el SLA de 12h hábiles.
 *
 * Server Component. Pura, sin estado. Consumida desde:
 *   - PayoutsKPICardsV2 (KPI grande tiempo promedio)
 *   - PayoutTimeByEmpresa (col vs SLA)
 *   - AgingAlert (col vs SLA)
 *   - RetirosBancoTable del dossier (col SLA)
 *   - ColaboradoresPayoutsCard (sub-stat)
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { SLA_BUSINESS_MINUTES, slaStatus } from "@/lib/business-hours";
import { formatMinutes } from "@/lib/format";

type Props = {
  businessMinutes: number;
  /** Mostrar siempre con icono + label (default `true`). Si `false`, sólo texto compacto. */
  withIcon?: boolean;
};

export function SlaBadge({ businessMinutes, withIcon = true }: Props) {
  const verdict = slaStatus(businessMinutes);
  const within = verdict === "within";
  const Icon = within ? CheckCircle2 : AlertTriangle;
  const cls = within ? "text-status-success" : "text-status-fail";
  const diff = Math.abs(businessMinutes - SLA_BUSINESS_MINUTES);
  const label = within
    ? "dentro de SLA"
    : `+${formatMinutes(diff)} vs SLA`;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs tabular-nums ${cls}`}
    >
      {withIcon ? <Icon className="size-3" /> : null}
      <span className="font-mono">
        {formatMinutes(businessMinutes)} hábiles
      </span>
      <span className="text-muted-foreground">·</span>
      <span>{label}</span>
    </span>
  );
}
