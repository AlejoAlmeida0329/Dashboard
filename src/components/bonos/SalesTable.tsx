/**
 * Ventas por empresa — Server Component table for the Bonos tab.
 *
 * Columns (left to right):
 *   1. Empresa             (always visible)
 *   2. # bonos             (always visible)
 *   3. $ vendido           (always visible)
 *   4. $ comisión          ← `data-presenter-hide` on th + td (Tikin revenue)
 *   5. % del total         ← `data-presenter-hide` on th + td (relative position)
 *
 * In Modo Presentación the CSS contract hides cols 4 and 5 entirely.
 * Browser layout absorbs the freed space across the remaining columns —
 * Plan 04 will visually verify the table doesn't shift jaggedly.
 *
 * Format gates:
 *   - `$ vendido` and `$ comisión` via `formatCOP`.
 *   - `# bonos` via `formatInteger`.
 *   - `% del total` via `formatPercent` (expects fraction 0..1; bonos.ts
 *     `pctDelTotal` returns a fraction by contract).
 *   - Zero direct `Intl.NumberFormat` / `toLocaleString` calls.
 *
 * No interactive sort in Phase 2 — BON-02 doesn't request it. The rows
 * arrive already sorted DESC by `monto` (per `aggregateBonosByEmpresa`).
 * If a future phase needs click-to-sort, it lives in a Client Component
 * wrapper, not here.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BonoByEmpresa } from "@/lib/domain/bonos";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";

type Props = {
  rows: BonoByEmpresa[];
};

export function SalesTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ventas por empresa</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin bonos en el período seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Empresa</th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    # bonos
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    $ vendido
                  </th>
                  <th
                    className="pb-2 text-right font-medium tabular-nums"
                    data-presenter-hide
                  >
                    $ comisión
                  </th>
                  <th
                    className="pb-2 text-right font-medium tabular-nums"
                    data-presenter-hide
                  >
                    % del total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.empresa_id} className="border-b last:border-b-0">
                    <td className="max-w-[280px] truncate py-2">
                      {r.empresa_nombre}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(r.count)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.monto)}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums"
                      data-presenter-hide
                    >
                      {formatCOP(r.comision)}
                    </td>
                    <td
                      className="py-2 text-right tabular-nums"
                      data-presenter-hide
                    >
                      {formatPercent(r.pctDelTotal)}
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
