/**
 * AgingAlert — urgent in_progress payouts past the > 2h threshold (PAY-V2-04).
 *
 * Server Component. Conditional render:
 *   - rows.length > 0  → red-bordered Card with table sorted oldest-first
 *   - rows.length === 0 → returns null (page composition flows directly
 *     from KPI header to status semáforo; "queue is healthy" is the
 *     ABSENCE of this card, not a green "all clear" message).
 *
 * Vision (07-CONTEXT.md essential "Payouts: time-first" + "capas en Payouts"):
 *   When something's stuck, surface it BEFORE the success semáforo. The
 *   warning glyph in the title is part of the literal title — the card
 *   reads as an alert, not a passive table.
 *
 * Format gates: formatMinutes for Aging column, formatCOP for Monto.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AgingAlertRow } from "@/lib/domain/payouts";
import { formatCOP, formatMinutes } from "@/lib/format";

type Props = {
  rows: AgingAlertRow[];
};

/**
 * Pretty-print a `Payout.medium` bank code (mirror of TopBancos's helper —
 * intentionally inlined here to avoid a tiny shared util file).
 */
function displayBancoName(code: string): string {
  if (code === "OTRO_MEDIUM") return "Sin medio";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function AgingAlert({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <Card className="border-l-4 border-status-fail">
      <CardHeader>
        <CardTitle className="text-status-fail">
          ⚠ Pagos pendientes con &gt; 2h de aging
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Tikintag holder</th>
                <th className="pb-2 pr-4 font-medium text-right tabular-nums">
                  Aging
                </th>
                <th className="pb-2 pr-4 font-medium text-right tabular-nums">
                  Monto
                </th>
                <th className="pb-2 font-medium">Banco</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.internalId}
                  className="border-b last:border-b-0 hover:bg-muted/40"
                >
                  <td
                    className="max-w-[280px] truncate py-2 pr-4"
                    title={r.holder}
                  >
                    {r.holder}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums font-mono text-status-fail">
                    {formatMinutes(r.agingMinutes)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCOP(r.monto)}
                  </td>
                  <td className="py-2">{displayBancoName(r.medium)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
