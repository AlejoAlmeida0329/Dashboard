/**
 * TopRechargers — top 10 users by recharge volume (REC-V2-07).
 *
 * Server Component. Raw `<table>` markup (no shadcn `ui/table` primitive
 * exists in repo — same convention as Plan 07-02's TopEmisores /
 * TopReceptores and v1 SalesTable). The wrapping Card chrome is provided
 * by the page (recargas/page.tsx); this leaf only renders the table body.
 *
 * Columns (left to right):
 *   1. `#`              — ranking index (1..N)
 *   2. Tikintag         — user-level identifier (e.g. `$mario`)
 *   3. Empresa          — best-effort empresa display label (today same
 *                          as tikintag per 02-01 empresa-identity rule)
 *   4. Recargas         — count of recargas in the period
 *   5. Volumen          — sum of Math.abs(monto) in COP
 *   6. Recarga promedio — volumen / recargas (zero-safe via domain helper)
 *
 * Numeric columns right-aligned with `tabular-nums` for stable digit grid.
 *
 * Empty state: single muted-foreground line "Sin recargas en el período".
 *
 * v1→v2 difference (Plan 08-04 contract): this ranks USERS by
 * `tikintag`, NOT empresas. v1's `RecargasTable` ranked by `empresa_id`
 * (which today projects to tikintag, but the v2 ranking is anchored at
 * the user level so a future empresa↔tikintag separation doesn't change
 * the ranking semantics — see Plan 08-03 SUMMARY decision).
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes here per
 * Plan 08-04 conservative-default policy.
 *
 * Format gates: all COP, integer values via `@/lib/format`.
 */

import type { TopRecharger } from "@/lib/domain/recargas";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: TopRecharger[];
};

export function TopRechargers({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin recargas en el período
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="pb-2 font-medium tabular-nums">#</th>
            <th className="pb-2 font-medium">Tikintag</th>
            <th className="pb-2 font-medium">Empresa</th>
            <th className="pb-2 text-right font-medium tabular-nums">
              Recargas
            </th>
            <th className="pb-2 text-right font-medium tabular-nums">
              Volumen
            </th>
            <th className="pb-2 text-right font-medium tabular-nums">
              Recarga promedio
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.tikintag} className="border-b last:border-b-0">
              <td className="py-2 font-mono tabular-nums text-muted-foreground">
                {index + 1}
              </td>
              <td
                className="max-w-[180px] truncate py-2 font-mono"
                title={row.tikintag}
              >
                {row.tikintag}
              </td>
              <td
                className="max-w-[220px] truncate py-2"
                title={row.empresa ?? "—"}
              >
                {row.empresa ?? "—"}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatInteger(row.recargas)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCOP(row.volumenCOP)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {formatCOP(row.recargaPromedio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
