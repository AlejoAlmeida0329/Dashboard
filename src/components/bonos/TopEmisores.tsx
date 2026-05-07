/**
 * Top emisores — Server Component (Plan 07-02 BON-V2-05).
 *
 * Protagonist component in the v2 ranking-first cockpit (07-CONTEXT.md):
 * ranks tikintags by how many BONUS they sent (`sourceTransferTikintag`),
 * regardless of `direction`. Caller pre-truncates to N rows (typical N = 10).
 *
 * Visual treatment:
 *   - Card with `border-l-4 border-section-bonos` left accent stripe.
 *   - Tight `text-sm` table; rank column uses `tabular-nums` + muted color.
 *   - Tikintag column is the protagonist: `font-medium` + truncate.
 *   - Empty state: a single TR spanning all 4 cells with friendly copy.
 *
 * Note on the table primitive: the project does not ship a `@/components/ui/
 * table` shadcn primitive (only Card, Button, Input, Label, Separator,
 * Skeleton, Sonner, Switch). Following the v1 SalesTable convention we use
 * raw <table> markup styled with Tailwind utilities — same idiom across the
 * codebase.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BonoTikintagRow } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: BonoTikintagRow[];
};

export function TopEmisores({ rows }: Props) {
  return (
    <Card className="border-l-4 border-l-section-bonos">
      <CardHeader>
        <CardTitle>Top emisores</CardTitle>
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
                    Sin emisores en el período
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
