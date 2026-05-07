/**
 * ThirdPartyPayouts — Pagos a terceros (PAY-V2-08).
 *
 * Server Component. Card + table with the payouts whose `holder`
 * (cardholder full name) does NOT match the originating transaction's
 * `tikintag`. Sort: provided by `aggregateThirdPartyPayouts` (DESC by
 * monto — largest third-party transfer first).
 *
 * Empty state: "Sin pagos a terceros en el período".
 *
 * Vision (07-CONTEXT.md "capas en Payouts" — tercera capa, diagnóstico):
 *   Sits below the protagonists. The KPI count (in PayoutsKPICardsV2)
 *   gives the at-a-glance answer; this table gives the audit detail
 *   (which tikintag, who received, how much).
 *
 * Format gates: formatCOP (Monto), with badge color via state.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ThirdPartyPayoutRow } from "@/lib/domain/payouts";
import type { PayoutState } from "@/lib/domain/types";
import { formatCOP } from "@/lib/format";

type Props = {
  rows: ThirdPartyPayoutRow[];
};

function displayBancoName(code: string): string {
  if (code === "OTRO_MEDIUM") return "Sin medio";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function StateBadge({ state }: { state: PayoutState }) {
  if (state === "completed") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-status-success/15 text-status-success">
        Completado
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-status-fail/15 text-status-fail">
        Fallido
      </span>
    );
  }
  if (state === "in_progress") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-status-pending/15 text-status-pending">
        En curso
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      {state}
    </span>
  );
}

export function ThirdPartyPayouts({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos a terceros</CardTitle>
        <CardDescription>
          El Holder de la tarjeta no coincide con la tikintag solicitante
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin pagos a terceros en el período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Tikintag</th>
                  <th className="pb-2 font-medium">Holder</th>
                  <th className="pb-2 font-medium text-right tabular-nums">
                    Monto
                  </th>
                  <th className="pb-2 font-medium">Banco</th>
                  <th className="pb-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.transactionId}
                    className="border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="max-w-[180px] truncate py-2 font-mono text-xs">
                      {r.tikintag}
                    </td>
                    <td
                      className="max-w-[260px] truncate py-2"
                      title={r.holder}
                    >
                      {r.holder}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.monto)}
                    </td>
                    <td className="py-2">{displayBancoName(r.medium)}</td>
                    <td className="py-2">
                      <StateBadge state={r.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
