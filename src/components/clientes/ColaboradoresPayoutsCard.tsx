/**
 * ColaboradoresPayoutsCard — KPIs "tus colaboradores" para el dossier
 * Vista Cliente, partida en 3 secciones con dividers:
 *
 *   1. Usuarios — 3 stats: con bonos · con retiros · con compras
 *   2. Retiros a banco — cantidad, monto, ticket, tiempo (Hábil) + bancos
 *   3. Compras con tarjeta — usuarios, monto, ticket
 *
 * Lifetime (sin ventana de fecha).
 */

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  SLA_BUSINESS_MINUTES,
  slaStatus,
} from "@/lib/business-hours";
import type { EmpresaCollaboratorStats } from "@/lib/domain/clientes";
import { formatCOP, formatInteger, formatMinutes } from "@/lib/format";

type Props = {
  stats: EmpresaCollaboratorStats;
};

/** Title-case the bank code: `bancolombia` → `Bancolombia`, `nu_bank` → `Nu Bank`. */
function displayBank(code: string): string {
  if (!code || code === "OTRO_MEDIUM") return "Sin medio";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ColaboradoresPayoutsCard({ stats }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tus colaboradores</CardTitle>
        <CardDescription>
          Vista vitalicia: usuarios que recibieron bonos tuyos y su
          actividad downstream (retiros a banco + compras con tarjeta)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sección 1 — Usuarios */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Usuarios
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Con bonos recibidos"
              value={formatInteger(stats.collaboratorCount)}
              subText="Tikintags distintos que recibieron tus bonos"
            />
            <Stat
              label="Con retiros a banco"
              value={
                stats.usersWithBankWithdrawalsCount > 0
                  ? formatInteger(stats.usersWithBankWithdrawalsCount)
                  : "—"
              }
              subText={`De ${formatInteger(stats.collaboratorCount)} colaboradores`}
            />
            <Stat
              label="Con compras tarjeta"
              value={
                stats.cardUsersCount > 0
                  ? formatInteger(stats.cardUsersCount)
                  : "—"
              }
              subText={`De ${formatInteger(stats.collaboratorCount)} colaboradores`}
            />
          </div>
        </section>

        <Separator />

        {/* Sección 2 — Retiros a banco */}
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

          {/* Bancos donde retiran */}
          {stats.banksBreakdown.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Bancos donde retiran
              </p>
              <ul className="flex flex-wrap gap-2">
                {stats.banksBreakdown.map((b) => (
                  <li
                    key={b.bank}
                    className="inline-flex items-center gap-1 rounded border bg-muted/40 px-2 py-1 text-xs"
                  >
                    <span>{displayBank(b.bank)}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatInteger(b.count)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <Separator />

        {/* Sección 3 — Compras con tarjeta */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Compras con tarjeta
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Cantidad"
              value={
                stats.cardPurchasesCount > 0
                  ? formatInteger(stats.cardPurchasesCount)
                  : "—"
              }
              subText="Compras completadas"
            />
            <Stat
              label="Monto total"
              value={
                stats.cardPurchasesTotal > 0
                  ? formatCOP(stats.cardPurchasesTotal)
                  : "—"
              }
              subText="Suma de compras completadas"
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
