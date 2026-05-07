/**
 * TopCardUsers — Top 10 card users ranking table (Plan 08-02 CARD-V2-06).
 *
 * Server Component. Renders ≤ 10 rows ranked by `volumenCOP` DESC (with
 * `compras` DESC tiebreak — deterministic per Plan 08-01's contract).
 *
 * Columns:
 *   #  |  Tikintag  |  Empresa  |  Compras  |  Volumen  |  Ticket promedio
 *
 * Numeric columns are right-aligned with `tabular-nums` for clean
 * decimal-point alignment across rows.
 *
 * Note on the table primitive: the project does NOT ship a `@/components/ui/
 * table` shadcn primitive (only Card, Button, Input, Label, Separator,
 * Skeleton, Sonner, Switch). Following the v1 SalesTable / v2 TopEmisores /
 * TopReceptores convention we use raw <table> markup styled with Tailwind
 * utilities — same idiom across the codebase (Plan 07-02 documented this
 * deviation; reaffirmed here).
 *
 * Empty state: a single TR spanning all 6 cells with friendly Spanish copy.
 *
 * Format gates: `formatInteger` for compras, `formatCOP` for volumen and
 * ticketPromedio (Pitfall 9 / format.ts gate).
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TopCardUser } from "@/lib/domain/cardUsage";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: TopCardUser[];
};

export function TopCardUsers({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top usuarios por uso de tarjeta</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">#</th>
                <th className="pb-2 font-medium">Tikintag</th>
                <th className="pb-2 font-medium">Empresa</th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Compras
                </th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Volumen
                </th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Ticket promedio
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-sm text-muted-foreground"
                  >
                    Sin compras en el período seleccionado
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr
                    key={r.tikintag}
                    className="border-b last:border-b-0 hover:bg-muted/40"
                  >
                    <td className="py-2 pr-2 text-xs tabular-nums text-muted-foreground">
                      {idx + 1}
                    </td>
                    <td className="max-w-[220px] truncate py-2 font-medium">
                      {r.tikintag}
                    </td>
                    <td className="max-w-[220px] truncate py-2 text-muted-foreground">
                      {r.empresa ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(r.compras)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.volumenCOP)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.ticketPromedio)}
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
