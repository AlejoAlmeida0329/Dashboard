/**
 * TopUsersByVolume — top 10 users by volumen OUT (INI-V2-06).
 *
 * Server Component. Raw `<table>` markup. Card chrome is provided by the
 * page (inicio/page.tsx); this leaf renders only the table body.
 *
 * Ranking key: `volumenOut` DESC. Operative framing — "¿quién mueve más
 * plata fuera de su wallet Tikin?" (PAYOUT_BANK + PURCHASE-out).
 *
 * Columns (left to right):
 *   1. `#`              — ranking index (1..N)
 *   2. Tikintag         — user-level identifier; `font-mono` for `$`-prefix
 *   3. Empresa          — empresa que MÁS bonos le pagó a este usuario
 *                         (BONUS-in `sourceTransferTikintag` más frecuente);
 *                         em-dash cuando el usuario nunca recibió bono
 *   4. Tx               — canonical event rows for this user (any status)
 *   5. Ticket promedio  — `volumenOut / count(completed OUT events)`
 *   6. Volumen OUT ★    — RANKING KEY — sum PAYOUT_BANK + PURCHASE-out
 *                         completados (COP)
 *
 * Numeric columns right-aligned with `tabular-nums`.
 */

import type { TopUserVolumeRow } from "@/lib/domain/inicio";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: TopUserVolumeRow[];
};

export function TopUsersByVolume({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin transacciones en el período.
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
            <th className="pb-2 text-right font-medium tabular-nums">Tx</th>
            <th className="pb-2 text-right font-medium tabular-nums">
              Ticket promedio
            </th>
            {/* Primary ranking column — marked with ★ so the user can see
                at a glance which metric the table is sorted by. */}
            <th className="pb-2 text-right font-medium tabular-nums text-foreground">
              <span aria-hidden="true">★ </span>
              <span title="Columna de ordenamiento (descendente)">
                Volumen OUT
              </span>
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
                className="max-w-[220px] truncate py-2 font-mono"
                title={row.empresa ?? "—"}
              >
                {row.empresa ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatInteger(row.transacciones)}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {formatCOP(row.ticketPromedio)}
              </td>
              <td className="py-2 text-right tabular-nums font-medium text-foreground">
                {formatCOP(row.volumenOut)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
