/**
 * RecargasTable — Server Component table for the /recargas tab.
 *
 * Mirrors `bonos/SalesTable.tsx` shape line-for-line, adapted for the
 * `RecargaByEmpresa` row shape. Renders top 10 empresas pre-sorted DESC by
 * `monto` (per `aggregateRecargasByEmpresa`).
 *
 * Columns (left to right):
 *   1. Empresa             (always visible)
 *   2. # recargas          (always visible)
 *   3. $ recargado         (always visible)
 *   4. % del total         (always visible)
 *
 * Cliente-foco contract: NO `data-presenter-hide` on any column. Per
 * 04-CONTEXT.md, Recargas has no internal-only column — the full table is
 * fine even in Modo Presentación for the cliente's own data. Comisión / take
 * rate live in Inicio, not here.
 *
 * Format gates:
 *   - `$ recargado` via `formatCOP`.
 *   - `# recargas` via `formatInteger`.
 *   - `% del total` via `formatPercent` (expects fraction 0..1; recargas.ts
 *     `pctDelTotal` returns a fraction by contract — same as bonos.ts).
 *   - Zero direct `Intl.NumberFormat` / `toLocaleString` calls.
 *
 * No interactive sort in Phase 4 — REC-03 doesn't request it. The rows
 * arrive already sorted DESC by `monto`. If a future phase needs
 * click-to-sort, it lives in a Client Component wrapper, not here.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecargaByEmpresa } from "@/lib/domain/recargas";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";

type Props = {
  rows: RecargaByEmpresa[];
};

export function RecargasTable({ rows }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top 10 empresas por recargas</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin recargas en el período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Empresa</th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    # recargas
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    $ recargado
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    % del total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.empresa_id} className="border-b last:border-b-0">
                    <td
                      className="max-w-[280px] truncate py-2"
                      title={r.empresa_nombre}
                    >
                      {r.empresa_nombre}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatInteger(r.count)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatCOP(r.monto)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
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
