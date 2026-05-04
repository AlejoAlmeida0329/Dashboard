/**
 * Header KPIs for the Payouts tab — Server Component.
 *
 * Renders FIVE shadcn cards in a 5-col grid (stacks on smaller widths):
 *   1. Payouts procesados (count)         — ALWAYS VISIBLE
 *   2. Volumen total ($ COP)              — ALWAYS VISIBLE
 *   3. Mediana (P50) — HERO, HH:MM:SS     — ALWAYS VISIBLE
 *   4. P95          — HERO, HH:MM:SS      — ALWAYS VISIBLE
 *   5. Tasa de éxito (%)                  — `data-presenter-hide` (Tikin's
 *       internal-quality KPI; not appropriate to show to a cliente
 *       projecting their own data — same convention as Bonos's
 *       "Comisión total" card from Plan 02-03).
 *
 * Vision (03-CONTEXT.md "incuestionable"):
 *   - P50 and P95 are HERO. Compact / technical `H:MM:SS` reading
 *     (e.g. `'0:12:04'`, not `'12 minutos'`). The `formatDuration`
 *     helper from `@/lib/format` is the source of truth for that
 *     format; we wrap the digits in `font-mono` + `tabular-nums` so
 *     the colons line up across cards.
 *
 * Format gates:
 *   - All COP, integer, percent, and duration values flow through
 *     `@/lib/format`. ZERO `Intl.NumberFormat` / `toLocaleString` here.
 *   - `summary.p50Seconds === 0` (zero-safe contract from Plan 03-02)
 *     renders as `'0:00:00'` — meaningful when count > 0; the
 *     description copy below the value clarifies the empty case.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PayoutSummary, SuccessRate } from "@/lib/domain/payouts";
import {
  formatCOP,
  formatDuration,
  formatInteger,
  formatPercent,
} from "@/lib/format";

type Props = {
  summary: PayoutSummary;
  successRate: SuccessRate;
};

export function PayoutsKPICards({ summary, successRate }: Props) {
  const hasData = summary.count > 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. Payouts procesados — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Payouts procesados</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(summary.count)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData ? "En el período" : "Sin payouts en el período seleccionado"}
          </p>
        </CardContent>
      </Card>

      {/* 2. Volumen total — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen total</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.montoTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Suma de payouts completados
          </p>
        </CardContent>
      </Card>

      {/* 3. Mediana (P50) — HERO, siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Mediana (P50)</CardDescription>
          <CardTitle className="font-mono text-3xl tabular-nums">
            {formatDuration(summary.p50Seconds)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            50% de los payouts se completan en menos de este tiempo
          </p>
        </CardContent>
      </Card>

      {/* 4. P95 — HERO, siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>P95</CardDescription>
          <CardTitle className="font-mono text-3xl tabular-nums">
            {formatDuration(summary.p95Seconds)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            95% de los payouts se completan en menos de este tiempo
          </p>
        </CardContent>
      </Card>

      {/* 5. Tasa de éxito — oculto en Modo Presentación */}
      <Card data-presenter-hide>
        <CardHeader>
          <CardDescription>Tasa de éxito</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatPercent(successRate.rate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {formatInteger(successRate.completed)} de{" "}
            {formatInteger(successRate.totalAttempted)} payouts
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
