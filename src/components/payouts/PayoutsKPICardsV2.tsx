/**
 * PayoutsKPICardsV2 — TIME-FIRST cockpit header (PAY-V2-01..03, PAY-V2-08).
 *
 * Server Component. Renders SIX KPI cards in a responsive 1 → 2 → 3 col
 * grid (two rows of three at lg+ — fits long COP values without clipping):
 *   1. Tiempo promedio   (formatMinutes)       — PRIMARY, text-4xl, section-payouts
 *   2. Tasa de éxito     (formatPercent)       — semáforo: ≥95% verde, ≥85% amber, else rojo
 *   3. Total payouts     (formatInteger)       — text-muted-foreground
 *   4. Volumen retirado  (formatCOP)           — section-payouts
 *   5. Pagos a terceros  (formatInteger)       — section-payouts
 *   6. Retiros / usuario (toFixed(1))          — section-payouts
 *
 * Vision (07-CONTEXT.md essential "Payouts: time-first"):
 *   The first scroll answers "¿qué tan rápido procesamos?" before any
 *   quality semáforo or diagnóstico layer. Tiempo promedio is visually
 *   the largest card; tasa de éxito is the second protagonist with the
 *   color-bound semáforo telling the at-a-glance story.
 *
 * Format gates:
 *   - All COP, integer, percent, and minute values flow through
 *     `@/lib/format`. ZERO `Intl.NumberFormat` / `toLocaleString` here.
 *   - `avgMinutes === 0` (zero-safe contract from `aggregateAverageProcessingMinutes`)
 *     renders as `'—'` via formatMinutes — the empty-period signal.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PayoutStateBreakdown } from "@/lib/domain/payouts";
import {
  formatCOP,
  formatInteger,
  formatMinutes,
  formatPercent,
} from "@/lib/format";

type Props = {
  avgMinutes: number;
  breakdown: PayoutStateBreakdown;
  montoTotalCompleted: number;
  thirdPartyCount: number;
  /** Average payouts per distinct user with at least one attributable payout. */
  avgPayoutsPerUser: number;
  /** Distinct tikintags with ≥1 attributable payout (denominator of avg). */
  uniqueUsers: number;
};

/**
 * Pick the success-rate accent class via the agreed thresholds:
 *   ≥ 95%  → green (status-success)
 *   ≥ 85%  → amber (status-pending)
 *   else   → red   (status-fail)
 */
function successRateAccent(rate: number): string {
  if (rate >= 0.95) return "text-status-success";
  if (rate >= 0.85) return "text-status-pending";
  return "text-status-fail";
}

export function PayoutsKPICardsV2({
  avgMinutes,
  breakdown,
  montoTotalCompleted,
  thirdPartyCount,
  avgPayoutsPerUser,
  uniqueUsers,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 1. Tiempo promedio — PRIMARY */}
      <Card>
        <CardHeader>
          <CardDescription>Tiempo promedio</CardDescription>
          <CardTitle className="font-heading text-section-payouts text-4xl tabular-nums">
            {formatMinutes(avgMinutes)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Mediana de procesamiento (completados)
          </p>
        </CardContent>
      </Card>

      {/* 2. Tasa de éxito — semáforo */}
      <Card>
        <CardHeader>
          <CardDescription>Tasa de éxito</CardDescription>
          <CardTitle
            className={`font-heading text-3xl tabular-nums ${successRateAccent(
              breakdown.successRate,
            )}`}
          >
            {breakdown.total === 0 ? "—" : formatPercent(breakdown.successRate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {formatInteger(breakdown.completed)} de{" "}
            {formatInteger(breakdown.total)} payouts
          </p>
        </CardContent>
      </Card>

      {/* 3. Total payouts */}
      <Card>
        <CardHeader>
          <CardDescription>Total payouts</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-muted-foreground">
            {formatInteger(breakdown.total)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">En el período</p>
        </CardContent>
      </Card>

      {/* 4. Volumen retirado */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen retirado</CardDescription>
          <CardTitle className="font-heading text-section-payouts text-3xl tabular-nums">
            {formatCOP(montoTotalCompleted)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Suma de payouts completados
          </p>
        </CardContent>
      </Card>

      {/* 5. Pagos a terceros */}
      <Card>
        <CardHeader>
          <CardDescription>Pagos a terceros</CardDescription>
          <CardTitle className="font-heading text-section-payouts text-3xl tabular-nums">
            {formatInteger(thirdPartyCount)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Holder ≠ tikintag solicitante
          </p>
        </CardContent>
      </Card>

      {/* 6. Promedio retiros por usuario */}
      <Card>
        <CardHeader>
          <CardDescription>Retiros / usuario</CardDescription>
          <CardTitle className="font-heading text-section-payouts text-3xl tabular-nums">
            {uniqueUsers === 0 ? "—" : avgPayoutsPerUser.toFixed(1)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {uniqueUsers === 0
              ? "Sin usuarios atribuibles"
              : `Sobre ${formatInteger(uniqueUsers)} usuarios`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
