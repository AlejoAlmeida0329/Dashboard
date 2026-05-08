/**
 * PayoutTimeByEmpresa — tiempo promedio de payouts agrupado por empresa
 * pagadora de bonos. Server Component.
 *
 * "Empresa" = el sourceTransferTikintag más frecuente entre los BONUS-in
 * de cada persona (primary bono payer). Solo cuenta payouts completed.
 * Personas sin bono recibido no se atribuyen a ninguna empresa.
 *
 * Sort: DESC por cantidad de payouts; tiebreak ASC por tiempo promedio.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PayoutTimeByEmpresaRow } from "@/lib/domain/payouts";
import { formatInteger, formatMinutes } from "@/lib/format";

type Props = {
  rows: PayoutTimeByEmpresaRow[];
};

export function PayoutTimeByEmpresa({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiempo promedio de payouts por empresa</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin payouts atribuibles en el período.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Empresa</th>
                  <th className="pb-2 pr-4 text-right font-medium tabular-nums">
                    Payouts
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Tiempo promedio
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.empresa}
                    className="border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="max-w-[220px] truncate py-2 pr-4 font-mono">
                      {r.empresa}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatInteger(r.count)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMinutes(r.avgMinutes)}
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
