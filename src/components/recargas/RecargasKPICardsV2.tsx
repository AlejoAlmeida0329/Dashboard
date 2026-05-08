/**
 * RecargasKPICardsV2 — METHOD-AND-DISTRIBUTION-FIRST cockpit header (REC-V2-01..03 + REC-V2-05).
 *
 * Server Component. Renders FOUR KPI cards in a responsive 1 → 2 → 4 col grid:
 *   1. Total recargas      (formatInteger)        — PRIMARY, text-4xl, section-recargas (Teal)
 *   2. Volumen recargado   (formatCOP)            — text-3xl
 *   3. Adopción            (formatPercent)        — text-3xl, with subtext `${usersWithRecharge} de ${totalUsers} usuarios`
 *   4. Recarga promedio    (formatCOP)            — text-3xl
 *
 * Vision (Plan 08-04 layout decision "method-and-distribution-first"):
 *   The first scroll answers "¿cuántas recargas y cuánto $ entró?" before any
 *   method split or amount distribution diagnostic layer. Total recargas is
 *   visually the largest card (only one carrying the Teal section accent —
 *   surgical single-metric application of `text-section-recargas` per the
 *   "EXACTLY ONE focal metric" rule), Volumen is the second protagonist with
 *   no color (avoid Teal repetition), Adopción carries the user-funnel
 *   subtext.
 *
 * Format gates:
 *   - All COP, integer, percent values flow through `@/lib/format`. ZERO
 *     `Intl.NumberFormat` / `toLocaleString` here.
 *   - Empty period (totalRecargas === 0) → recargaPromedio is 0 by zero-safe
 *     contract; formatCOP(0) renders as `"$ 0"`. Adopción card surfaces
 *     `"— de — usuarios"` when totalUsers === 0 (defensive).
 *
 * Section accent rule (Plan 08-04):
 *   `text-section-recargas` (Teal OKLCH from Phase 6 Plan 04) on EXACTLY ONE
 *   metric across the entire page. KPI #1 (Total recargas) carries it; the
 *   other 3 leaves intentionally do NOT use this token.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  RechargeAdoption,
  RecargaSummaryV2,
} from "@/lib/domain/recargas";
import {
  formatCOP,
  formatInteger,
  formatPercent,
} from "@/lib/format";

type Props = {
  summary: RecargaSummaryV2;
  adoption: RechargeAdoption;
};

export function RecargasKPICardsV2({ summary, adoption }: Props) {
  const adoptionSubtext =
    adoption.totalUsers > 0
      ? `${formatInteger(adoption.usersWithRecharge)} de ${formatInteger(adoption.totalUsers)} usuarios`
      : "Sin usuarios en el período";

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total recargas — PRIMARY (section accent: Teal) */}
      <Card>
        <CardHeader>
          <CardDescription>Total recargas</CardDescription>
          <CardTitle className="font-heading text-section-recargas text-4xl tabular-nums">
            {formatInteger(summary.totalRecargas)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            PSE + Transferencia (entradas)
          </p>
        </CardContent>
      </Card>

      {/* 2. Volumen recargado */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen recargado</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.volumenCOP)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Suma de recargas en COP
          </p>
        </CardContent>
      </Card>

      {/* 3. Adopción */}
      <Card>
        <CardHeader>
          <CardDescription>Adopción</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {adoption.totalUsers > 0
              ? formatPercent(adoption.adoptionRate)
              : "—"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {adoptionSubtext}
          </p>
        </CardContent>
      </Card>

      {/* 4. Recarga promedio */}
      <Card>
        <CardHeader>
          <CardDescription>Recarga promedio</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(summary.recargaPromedio)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Volumen / # recargas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
