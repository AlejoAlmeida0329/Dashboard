/**
 * TopRetirosBanco — top 20 usuarios que más retiros a banco han iniciado.
 *
 * Server Component. Card + table. Sort: count DESC (provided by
 * `aggregateTopRetirosBanco`).
 *
 * Columns:
 *   1. `#`           — ranking index
 *   2. Tikintag      — originating user
 *   3. Total         — count of retiros (any state)
 *   4. Completados   — count of completed retiros
 *   5. Fallidos      — count of failed retiros
 *   6. En curso      — count of in_progress retiros
 *   7. Volumen       — sum of monto across completed (COP)
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TopRetiroRow } from "@/lib/domain/payouts";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: TopRetiroRow[];
};

export function TopRetirosBanco({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 20 usuarios por retiros a banco</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin retiros en el período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium tabular-nums">#</th>
                  <th className="pb-2 font-medium">Tikintag</th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Total
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Completados
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Fallidos
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    En curso
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Volumen
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.tikintag}
                    className="border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="py-2 font-mono tabular-nums text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="max-w-[200px] truncate py-2 font-mono">
                      {r.tikintag}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {formatInteger(r.count)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-status-success">
                      {formatInteger(r.countCompleted)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-status-fail">
                      {formatInteger(r.countFailed)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-status-pending">
                      {formatInteger(r.countInProgress)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.montoCompleted)}
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
