/**
 * TopUsersByVolume — top 10 users by volumen OUT (INI-V2-06, Plan 10-04).
 *
 * Server Component. Raw `<table>` markup (no shadcn `ui/table` primitive
 * exists in repo — same convention as Plan 07-02's TopEmisores /
 * TopReceptores, Plan 08's TopRechargers / TopCardUsers). The wrapping
 * Card chrome is provided by the page (inicio/page.tsx); this leaf only
 * renders the table body.
 *
 * Plan 10-04 fix: ranking key changed from `volumenNeto` (volumenIn -
 * volumenOut, ambiguous semantic that surfaced "net receivers" at the top
 * and "net spenders" at the bottom) to `volumenOut` DESC. The operative-
 * lens framing answers "who moves the most money out of their Tikin
 * wallet?" (purchases + payouts + bonos sent + p2p sent) — the platform's
 * value-prop. Heavy spenders surface at the top.
 *
 * Columns (left to right):
 *   1. `#`              — ranking index (1..N, 1-based)
 *   2. Tikintag         — user-level identifier (e.g. `$mario`); `font-mono`
 *                         for `$`-prefix legibility
 *   3. Empresa          — denormalized label (first observed
 *                         `empresa_nombre`); muted em-dash when undefined
 *   4. Tx               — count of canonical event rows for this user
 *                         (PAYIN_* + PAYOUT_BANK + bidirectional-OUT;
 *                         each event counts once)
 *   5. Volumen IN       — sum of recargas (PAYIN_*) completados (COP)
 *   6. Volumen OUT *    — RANKING KEY (★) — sum of PAYOUT_BANK +
 *                         BONUS/P2P/PURCHASE-out completados (COP).
 *                         Header annotated with a "★" marker so the user
 *                         sees the primary ranking column at a glance.
 *
 * Numeric columns right-aligned with `tabular-nums` for stable digit grid.
 *
 * Empty state: single muted-foreground line "Sin transacciones en el
 * período." — same convention as TopRechargers / TopCardUsers.
 *
 * v1→v2 difference (Plan 10-02 contract): this ranks USERS by `tikintag`,
 * NOT empresas. The v1 page surfaced `empresa_id`-grouped rankings under
 * GMV editorial framing; v2 anchors at the user level (tikintag).
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes here per Plan
 * 10-02 conservative-default policy.
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
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {formatCOP(row.volumenIn)}
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
