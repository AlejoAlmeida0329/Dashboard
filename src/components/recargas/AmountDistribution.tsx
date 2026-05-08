/**
 * AmountDistribution — 3-bucket recarga amount histogram (REC-V2-06).
 *
 * Server Component. Renders a single Card titled "Distribución por monto"
 * with a 3-row mini-table showing each bucket:
 *   `Bucket | Recargas | Volumen | Share %`
 *
 * Bucket boundaries (UNAMBIGUOUS per Plan 08-03 JSDoc):
 *   - `<$100K`     — `amount < 100_000`              (strictly less)
 *   - `$100K-$1M`  — `100_000 <= amount <= 1_000_000` (inclusive both ends)
 *   - `>$1M`       — `amount > 1_000_000`            (strictly greater)
 *
 * Stable axis: ALL 3 buckets always render even when count === 0 — the
 * domain helper `aggregateRechargeAmountDistribution` returns the full
 * set every call; this component just iterates. A bucket disappearing
 * mid-render would re-shuffle the layout when filters change.
 *
 * Share % is computed in-component as `count / sumCount` (zero-safe; falls
 * back to 0 when the period is empty). NOT delegated to the domain helper
 * because share is a presentational concern that depends on which buckets
 * are surfaced (here: all 3, always).
 *
 * Mini-table chosen over horizontal stacked bar (per plan recommendation):
 *   - Server-renderable without Recharts.
 *   - Numeric columns right-aligned, `tabular-nums` — easier to scan.
 *   - The "Share %" column already implies a relative magnitude; a chart
 *     would over-weight visual budget on a 3-row split.
 *
 * Format gates: all COP, integer, percent values via `@/lib/format`.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RechargeAmountBucket } from "@/lib/domain/recargas";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";

type Props = {
  buckets: RechargeAmountBucket[];
};

export function AmountDistribution({ buckets }: Props) {
  const totalCount = buckets.reduce((s, b) => s + b.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución por monto</CardTitle>
        <CardDescription>
          Recargas agrupadas por tamaño de ticket
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 font-medium">Bucket</th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Recargas
                </th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Volumen
                </th>
                <th className="pb-2 text-right font-medium tabular-nums">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                const share = totalCount > 0 ? b.count / totalCount : 0;
                return (
                  <tr key={b.label} className="border-b last:border-b-0">
                    <td className="py-2 font-mono">{b.label}</td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(b.count)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(b.volumenCOP)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {totalCount > 0 ? formatPercent(share) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
