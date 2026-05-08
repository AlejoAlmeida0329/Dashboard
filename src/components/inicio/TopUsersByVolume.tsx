/**
 * TopUsersByVolume — top 10 users by volumen neto (INI-V2-06).
 *
 * Server Component. Raw `<table>` markup (no shadcn `ui/table` primitive
 * exists in repo — same convention as Plan 07-02's TopEmisores /
 * TopReceptores, Plan 08's TopRechargers / TopCardUsers). The wrapping
 * Card chrome is provided by the page (inicio/page.tsx); this leaf only
 * renders the table body.
 *
 * Columns (left to right):
 *   1. `#`           — ranking index (1..N, 1-based)
 *   2. Tikintag      — user-level identifier (e.g. `$mario`); `font-mono`
 *                      for `$`-prefix legibility
 *   3. Empresa       — denormalized label (first observed `empresa_nombre`);
 *                      muted em-dash when undefined
 *   4. Tx            — count of transactions in any direction
 *   5. Volumen IN    — sum of `monto` for `direction === 'in'` (COP)
 *   6. Volumen OUT   — sum of `Math.abs(monto)` for `direction === 'out'` (COP)
 *   7. Neto          — `volumenIn - volumenOut`; positive default,
 *                      negative wrapped in `text-status-fail` to flag net
 *                      spenders at a glance
 *
 * Numeric columns right-aligned with `tabular-nums` for stable digit grid.
 *
 * Empty state: single muted-foreground line "Sin transacciones en el
 * período." — same convention as TopRechargers / TopCardUsers.
 *
 * v1→v2 difference (Plan 10-02 contract): this ranks USERS by `tikintag`,
 * NOT empresas. The v1 page surfaced `empresa_id`-grouped rankings under
 * GMV editorial framing; v2 anchors at the user level (tikintag) — same
 * shift catalogued in STATE.md (Plan 08-04 — "tikintag is the canonical
 * user identity at v2 ranking layer"). Joins the family of v2 user-lens
 * rankings (TopEmisores, TopReceptores, TopCardUsers, TopRechargers).
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes here per Plan
 * 10-02 conservative-default policy — top 10 by volume is the kind of
 * metric the cliente WANTS to see (it's the operative-lens proof of
 * "your platform is the most-used place"), and the empresa filter
 * already narrows the table to the relevant subset.
 *
 * Format gates: all COP, integer values via `@/lib/format`.
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
              Volumen IN
            </th>
            <th className="pb-2 text-right font-medium tabular-nums">
              Volumen OUT
            </th>
            <th className="pb-2 text-right font-medium tabular-nums">Neto</th>
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
                {row.empresa ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatInteger(row.transacciones)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCOP(row.volumenIn)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatCOP(row.volumenOut)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {row.volumenNeto < 0 ? (
                  <span className="text-status-fail">
                    {formatCOP(row.volumenNeto)}
                  </span>
                ) : (
                  formatCOP(row.volumenNeto)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
