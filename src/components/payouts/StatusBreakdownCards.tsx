/**
 * StatusBreakdownCards — 3 KPIs por estado con semáforo (PAY-V2-02).
 *
 * Server Component. Renders 3 KPI cards in a 1 → 3 col grid (always 3
 * cards even when one is zero, for stable layout):
 *   1. Completados — text-status-success + green dot
 *   2. Fallidos    — text-status-fail    + red dot
 *   3. En curso    — text-status-pending + amber dot
 *
 * Each card carries a percentage subtitle (count / total). Zero-safe:
 * when total === 0, the subtitle reads "—" instead of NaN%.
 *
 * Vision (07-CONTEXT.md "capas en Payouts" — segunda capa):
 *   The status semáforo is the QUALITY answer. Ships AFTER the velocity
 *   KPIs (PayoutsKPICardsV2) and the conditional AgingAlert; the user's
 *   eyes have already seen "qué tan rápido" before they see "qué tan
 *   bien".
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PayoutStateBreakdown } from "@/lib/domain/payouts";
import { formatInteger, formatPercent } from "@/lib/format";

type Props = {
  breakdown: PayoutStateBreakdown;
};

function pct(count: number, total: number): string {
  if (total === 0) return "—";
  return formatPercent(count / total);
}

export function StatusBreakdownCards({ breakdown }: Props) {
  const { completed, failed, inProgress, total } = breakdown;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 1. Completados — verde */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-status-success" />
            Completados
          </CardDescription>
          <CardTitle className="font-heading text-status-success text-3xl tabular-nums">
            {formatInteger(completed)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {pct(completed, total)} del total
          </p>
        </CardContent>
      </Card>

      {/* 2. Fallidos — rojo */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-status-fail" />
            Fallidos
          </CardDescription>
          <CardTitle className="font-heading text-status-fail text-3xl tabular-nums">
            {formatInteger(failed)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {pct(failed, total)} del total
          </p>
        </CardContent>
      </Card>

      {/* 3. En curso — amber */}
      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-status-pending" />
            En curso
          </CardDescription>
          <CardTitle className="font-heading text-status-pending text-3xl tabular-nums">
            {formatInteger(inProgress)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {pct(inProgress, total)} del total
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
