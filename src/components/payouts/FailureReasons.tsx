/**
 * FailureReasons — Razones de fallo (PAY-V2-06).
 *
 * Server Component. Hybrid bars + collapsible details:
 *   - Top 5 reasons rendered as horizontal bars (Tailwind div-based, no
 *     Recharts — this is a small categorical breakdown; a chart would
 *     overweight the visual budget).
 *   - Below the bars: a `<details>` collapsed by default with "Ver todas
 *     las razones" — when expanded, shows the full FailureReasonRow[] as
 *     a table with Razón | Cantidad | Monto perdido.
 *
 * Empty state: single positive-tone line "Sin fallos en el período".
 *
 * Vision (07-CONTEXT.md "capas en Payouts" — tercera capa: diagnóstico):
 *   Below the protagonists (KPIs + semáforo). Hybrid presentation balances
 *   "at-a-glance" (top 5 bars) with "audit-friendly" (full collapsible
 *   table) without forcing the user into a separate page.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FailureReasonRow } from "@/lib/domain/payouts";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  rows: FailureReasonRow[];
};

const TOP_N_BARS = 5;

export function FailureReasons({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Razones de fallo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-status-success">
            Sin fallos en el período.
          </p>
        </CardContent>
      </Card>
    );
  }

  const top = rows.slice(0, TOP_N_BARS);
  const topReasonCount = top[0]?.count ?? 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Razones de fallo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {top.map((r) => {
            const widthPct = Math.max(
              4,
              Math.round((r.count / topReasonCount) * 100),
            );
            return (
              <li
                key={r.reason}
                className="flex items-center gap-3 text-sm"
              >
                <span
                  className="min-w-0 flex-shrink-0 truncate"
                  style={{ flexBasis: "33%" }}
                  title={r.reason}
                >
                  {r.reason}
                </span>
                <span className="flex-1">
                  <span
                    className="block h-2 rounded bg-status-fail"
                    style={{ width: `${widthPct}%` }}
                  />
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {formatInteger(r.count)}
                </span>
              </li>
            );
          })}
        </ul>

        {rows.length > TOP_N_BARS && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Ver todas las razones ({formatInteger(rows.length)})
            </summary>
            <div className="overflow-x-auto pt-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Razón</th>
                    <th className="pb-2 font-medium text-right tabular-nums">
                      Cantidad
                    </th>
                    <th className="pb-2 font-medium text-right tabular-nums">
                      Monto perdido
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.reason}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      <td
                        className="max-w-[320px] truncate py-2"
                        title={r.reason}
                      >
                        {r.reason}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatInteger(r.count)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCOP(r.monto)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
