/**
 * Top receptores — Server Component (Plan 07-02 BON-V2-06).
 *
 * Sibling of TopEmisores: ranks tikintags by how many BONUS they received
 * (`destinationTransferTikintag`), regardless of `direction`. Same layout
 * conventions (border-l-4 violet accent, tight table, prominent tikintag
 * column).
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BonoTikintagRow } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: BonoTikintagRow[];
};

export function TopReceptores({ rows }: Props) {
  return (
    <Card className="border-l-4 border-l-section-bonos">
      <CardHeader>
        <CardTitle>Top receptores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Tikintag</th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Bonos
                </th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Volumen
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Sin receptores en el período
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.tikintag}
                    className="border-b last:border-b-0"
                  >
                    <td className="py-2 pr-2 text-xs tabular-nums text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="max-w-[220px] truncate py-2 font-medium">
                      {r.tikintag}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(r.count)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.monto)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
