/**
 * PayoutsKPICardsV2 — TIME-FIRST cockpit header (PAY-V2-01..03, PAY-V2-08).
 *
 * Server Component. Renders SEVEN KPI cards in a responsive 1 → 2 → 3 col
 * grid (3+3+1 at lg+ — fits long COP values without clipping):
 *   1. Tiempo promedio   (formatMinutes)       — PRIMARY, text-4xl, section-payouts
 *   2. Tasa de éxito     (formatPercent)       — semáforo: ≥95% verde, ≥85% amber, else rojo
 *   3. Total payouts     (formatInteger)       — text-muted-foreground
 *   4. Volumen retirado  (formatCOP)           — section-payouts
 *   5. Costos totales    (formatCOP + % efect) — section-payouts (BD_Payouts.Transaction Cost)
 *   6. Pagos a terceros  (formatInteger)       — section-payouts
 *   7. Retiros / usuario (toFixed(1))          — section-payouts
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

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SLA_BUSINESS_MINUTES,
  slaStatus,
} from "@/lib/business-hours";
import type { PayoutStateBreakdown } from "@/lib/domain/payouts";
import {
  formatCOP,
  formatInteger,
  formatMinutes,
  formatPercent,
} from "@/lib/format";

type Props = {
  avgMinutes: number;
  /** Promedio en minutos hábiles (08:00–18:00 COT, L-V, sin festivos). Para SLA badge. */
  avgBusinessMinutes: number;
  breakdown: PayoutStateBreakdown;
  montoTotalCompleted: number;
  thirdPartyCount: number;
  /** Average payouts per distinct user with at least one attributable payout. */
  avgPayoutsPerUser: number;
  /** Distinct tikintags with ≥1 attributable payout (denominator of avg). */
  uniqueUsers: number;
  /** Sum of `Payout.costo` (= BD_Payouts "Transaction Cost") across completed payouts. */
  costoTotalCompleted: number;
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
  avgBusinessMinutes,
  breakdown,
  montoTotalCompleted,
  thirdPartyCount,
  avgPayoutsPerUser,
  uniqueUsers,
  costoTotalCompleted,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* 1. Tiempo promedio — PRIMARY (en HÁBILES contra SLA 12h) */}
      <Card>
        <CardHeader>
          <CardDescription>Tiempo promedio (Hábil)</CardDescription>
          <CardTitle
            className={`font-heading text-4xl tabular-nums ${
              breakdown.completed > 0
                ? slaStatus(avgBusinessMinutes) === "within"
                  ? "text-status-success"
                  : "text-status-fail"
                : "text-muted-foreground"
            }`}
          >
            {breakdown.completed > 0
              ? formatMinutes(avgBusinessMinutes)
              : "—"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {breakdown.completed > 0 ? (
            <SlaVerdictLine businessMinutes={avgBusinessMinutes} />
          ) : null}
          <p className="text-xs text-muted-foreground tabular-nums">
            Tiempo promedio (Crudo): {formatMinutes(avgMinutes)}
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

      {/* 5. Costos totales (BD_Payouts.Transaction Cost) */}
      <Card>
        <CardHeader>
          <CardDescription>Costos totales</CardDescription>
          <CardTitle className="font-heading text-section-payouts text-3xl tabular-nums">
            {formatCOP(costoTotalCompleted)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {montoTotalCompleted > 0
              ? `${((costoTotalCompleted / montoTotalCompleted) * 100).toFixed(2)}% efectivo`
              : "Sin payouts completados"}
          </p>
        </CardContent>
      </Card>

      {/* 6. Pagos a terceros */}
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

      {/* 7. Promedio retiros por usuario */}
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

/**
 * Línea de verdict para el KPI "Tiempo promedio (hábil)" — NO repite los
 * minutos (ya viven en el headline); sólo el icono + el verdict + diff.
 */
function SlaVerdictLine({ businessMinutes }: { businessMinutes: number }) {
  const within = slaStatus(businessMinutes) === "within";
  const Icon = within ? CheckCircle2 : AlertTriangle;
  const cls = within ? "text-status-success" : "text-status-fail";
  const diff = Math.abs(businessMinutes - SLA_BUSINESS_MINUTES);
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`}>
      <Icon className="size-3" />
      {within
        ? "Dentro de SLA (12h hábiles)"
        : `Excedió SLA por ${formatMinutes(diff)}`}
    </span>
  );
}
