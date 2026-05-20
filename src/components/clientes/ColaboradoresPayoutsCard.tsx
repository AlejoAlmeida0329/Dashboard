/**
 * ColaboradoresPayoutsCard — KPIs "tus colaboradores" para el dossier
 * Vista Cliente.
 *
 * Lifetime (sin ventana de fecha). Tres bloques dentro de la card:
 *   1. Usuarios — colaboradores totales (recibieron bonos de la empresa)
 *   2. Retiros a banco — cantidad, monto total, ticket promedio,
 *      tiempo promedio (Hábil) hero con SLA semáforo + crudo en caption
 *   3. Compras con tarjeta — usuarios distintos, cantidad, monto, ticket
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SLA_BUSINESS_MINUTES,
  slaStatus,
} from "@/lib/business-hours";
import type { EmpresaCollaboratorStats } from "@/lib/domain/clientes";
import { formatCOP, formatInteger, formatMinutes } from "@/lib/format";

type Props = {
  stats: EmpresaCollaboratorStats;
};

export function ColaboradoresPayoutsCard({ stats }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus colaboradores</CardTitle>
        <CardDescription>
          Vista vitalicia: usuarios que recibieron bonos tuyos, sus retiros a
          banco y sus compras con tarjeta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header: usuarios totales */}
        <Stat
          label="Usuarios"
          value={formatInteger(stats.collaboratorCount)}
          subText="Tikintags distintos que recibieron tus bonos"
        />

        {/* Sección 1 — Retiros a banco */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Retiros a banco
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Cantidad"
              value={
                stats.bankWithdrawalsCount > 0
                  ? formatInteger(stats.bankWithdrawalsCount)
                  : "—"
              }
              subText="Total de payouts (incluye fallidos)"
            />
            <Stat
              label="Monto total"
              value={
                stats.bankWithdrawalsTotal > 0
                  ? formatCOP(stats.bankWithdrawalsTotal)
                  : "—"
              }
              subText="Sólo payouts completados"
            />
            <Stat
              label="Ticket promedio"
              value={
                stats.bankWithdrawalsAvgTicket !== null
                  ? formatCOP(stats.bankWithdrawalsAvgTicket)
                  : "—"
              }
              subText="Sobre completados"
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Tiempo promedio (Hábil)
              </p>
              <p
                className={`mt-1 font-heading text-2xl tabular-nums ${
                  stats.avgPayoutBusinessMinutes !== null
                    ? slaStatus(stats.avgPayoutBusinessMinutes) === "within"
                      ? "text-status-success"
                      : "text-status-fail"
                    : "text-foreground"
                }`}
              >
                {stats.avgPayoutBusinessMinutes !== null
                  ? formatMinutes(stats.avgPayoutBusinessMinutes)
                  : "—"}
              </p>
              {stats.avgPayoutBusinessMinutes !== null ? (
                <SlaVerdictLine
                  businessMinutes={stats.avgPayoutBusinessMinutes}
                />
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Tiempo promedio (Crudo):{" "}
                {stats.avgPayoutMinutes !== null
                  ? formatMinutes(stats.avgPayoutMinutes)
                  : "—"}
              </p>
            </div>
          </div>
        </section>

        {/* Sección 2 — Compras con tarjeta */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Compras con tarjeta
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Usuarios con compras"
              value={
                stats.cardUsersCount > 0
                  ? formatInteger(stats.cardUsersCount)
                  : "—"
              }
              subText={`De ${formatInteger(stats.collaboratorCount)} colaboradores`}
            />
            <Stat
              label="Monto total"
              value={
                stats.cardPurchasesTotal > 0
                  ? formatCOP(stats.cardPurchasesTotal)
                  : "—"
              }
              subText={
                stats.cardPurchasesCount > 0
                  ? `${formatInteger(stats.cardPurchasesCount)} compras completadas`
                  : "Sin compras"
              }
            />
            <Stat
              label="Ticket promedio"
              value={
                stats.cardPurchasesAvgTicket !== null
                  ? formatCOP(stats.cardPurchasesAvgTicket)
                  : "—"
              }
              subText="Monto / cantidad"
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  subText,
}: {
  label: string;
  value: string;
  subText: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-heading text-2xl tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{subText}</p>
    </div>
  );
}

function SlaVerdictLine({ businessMinutes }: { businessMinutes: number }) {
  const within = slaStatus(businessMinutes) === "within";
  const Icon = within ? CheckCircle2 : AlertTriangle;
  const cls = within ? "text-status-success" : "text-status-fail";
  const diff = Math.abs(businessMinutes - SLA_BUSINESS_MINUTES);
  return (
    <span className={`mt-1 inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className="size-3" />
      {within
        ? "Dentro de SLA (12h hábiles)"
        : `Excedió SLA por ${formatMinutes(diff)}`}
    </span>
  );
}
