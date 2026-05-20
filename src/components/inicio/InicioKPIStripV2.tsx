/**
 * InicioKPIStripV2 — operative-lens cockpit header (INI-V2-01 + INI-V2-02).
 *
 * Server Component. Renders THREE KPI cards in a responsive 1 → 3 col grid:
 *   1. Usuarios activos        (formatInteger)        — PRIMARY, text-4xl,
 *                                                       section-inicio (Indigo)
 *                                                       + caption "X / Y
 *                                                       usuarios totales"
 *                                                       (alcance histórico —
 *                                                       Plan 10-04)
 *   2. Volumen IN vs OUT       (formatCOP, two stats)  — text-3xl, no accent
 *   3. Tasa de éxito           (formatPercent)         — semáforo: ≥95% verde,
 *                                                       ≥85% amber, else rojo
 *
 * Vision (Plan 10-02 layout decision + Plan 10-04 reactivation lens):
 *   The first scroll answers "¿quién usa la plataforma y cuánto fluye?"
 *   before the donut/timeline diagnostic layer. Usuarios activos is
 *   visually the largest card (only one carrying the Indigo section
 *   accent). Below the big number, a small caption "X / Y usuarios
 *   totales" surfaces the gap between period-active users and the full
 *   pool — visualizing reactivation opportunity at a glance. PRD baseline:
 *   235 usuarios totales (full BD_Plataforma DISTINCT tikintag count).
 *
 * Section accent rule (CROSS-V2-05 status palette):
 *   `text-section-inicio` (Indigo OKLCH from Phase 6 Plan 04) on EXACTLY ONE
 *   metric across the entire page. KPI #1 (Usuarios activos) carries it; the
 *   other 2 cards intentionally do NOT use this token.
 *
 * Format gates:
 *   - All COP, integer, percent values flow through `@/lib/format`. ZERO
 *     `Intl.NumberFormat` / `toLocaleString` here.
 *   - Empty period (summary.total === 0) → successRate is 0 by zero-safe
 *     contract; we render `'—'` instead of `'0,0%'` to mirror the
 *     PayoutsKPICardsV2 convention (the empty-period signal).
 *
 * successRateAccent helper:
 *   Inline 4-line copy of the same helper at PayoutsKPICardsV2:53 — the
 *   thresholds match (≥95 verde / ≥85 amber / else rojo per CROSS-V2-05).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InicioSummaryV2 } from "@/lib/domain/inicio";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";

type Props = {
  summary: InicioSummaryV2;
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

export function InicioKPIStripV2({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {/* 1. Usuarios activos — PRIMARY (section accent: Indigo).
          Caption "X / Y usuarios totales" surfaces alcance histórico
          (full-pool DISTINCT tikintag, PRD baseline 235) so the
          reactivation gap is visible at a glance. */}
      <Card>
        <CardHeader>
          <CardDescription>Usuarios activos</CardDescription>
          <CardTitle className="font-heading text-section-inicio text-4xl tabular-nums">
            {formatInteger(summary.usuariosActivos)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatInteger(summary.usuariosActivos)} /{" "}
            {formatInteger(summary.usuariosTotal)} usuarios totales
          </p>
          <p className="text-xs text-muted-foreground">
            Tikintags distintos en el período
          </p>
        </CardContent>
      </Card>

      {/* 2. Volumen IN vs OUT — side-by-side stats so cada label queda
          pegado a su número (en lugar de label-arriba / valor-debajo que
          confundía cuál era cuál). IN en verde (entra plata = buena
          noticia), OUT neutro. */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen IN vs OUT</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Entradas
              </p>
              <p className="mt-1 font-heading text-2xl tabular-nums text-status-success">
                {formatCOP(summary.volumenIn)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Recargas (PSE + Transfer)
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Salidas
              </p>
              <p className="mt-1 font-heading text-2xl tabular-nums text-foreground">
                {formatCOP(summary.volumenOut)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Retiros a banco + compras tarjeta
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tasa de éxito — semáforo */}
      <Card>
        <CardHeader>
          <CardDescription>Tasa de éxito</CardDescription>
          <CardTitle
            className={`font-heading text-3xl tabular-nums ${successRateAccent(
              summary.successRate,
            )}`}
          >
            {summary.total === 0 ? "—" : formatPercent(summary.successRate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatInteger(summary.countCompleted)} /{" "}
            {formatInteger(summary.countFailed)} /{" "}
            {formatInteger(summary.countInProgress)}
          </p>
          <p className="text-xs text-muted-foreground">
            Completadas / Fallidas / En curso
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
