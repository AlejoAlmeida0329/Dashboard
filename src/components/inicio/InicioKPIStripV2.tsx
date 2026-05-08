/**
 * InicioKPIStripV2 — operative-lens cockpit header (INI-V2-01 + INI-V2-02).
 *
 * Server Component. Renders THREE KPI cards in a responsive 1 → 3 col grid:
 *   1. Usuarios activos        (formatInteger)        — PRIMARY, text-4xl,
 *                                                       section-inicio (Indigo)
 *   2. Volumen IN vs OUT       (formatCOP, two stats)  — text-3xl, no accent
 *   3. Tasa de éxito           (formatPercent)         — semáforo: ≥95% verde,
 *                                                       ≥85% amber, else rojo
 *
 * Vision (Plan 10-02 layout decision — operative-lens):
 *   The first scroll answers "¿quién usa la plataforma y cuánto fluye?" before
 *   the donut/timeline diagnostic layer. Usuarios activos is visually the
 *   largest card (only one carrying the Indigo section accent — surgical
 *   single-metric application of `text-section-inicio` per the
 *   "EXACTLY ONE focal metric" rule). Volumen IN/OUT is the second
 *   protagonist (two stacked stats, no color accent to avoid Indigo
 *   repetition). Tasa de éxito carries the semáforo (PRD baseline 98.1% =
 *   green) so the at-a-glance health story is immediate.
 *
 * Section accent rule (CROSS-V2-05 status palette):
 *   `text-section-inicio` (Indigo OKLCH from Phase 6 Plan 04) on EXACTLY ONE
 *   metric across the entire page. KPI #1 (Usuarios activos) carries it; the
 *   other 2 cards intentionally do NOT use this token. Verify post-build
 *   with `grep -rE "text-section-inicio" src/components/inicio/` → exactly 1 hit.
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
 *   Local definition keeps each file's coloring contract self-contained
 *   without introducing a new shared module.
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
      {/* 1. Usuarios activos — PRIMARY (section accent: Indigo) */}
      <Card>
        <CardHeader>
          <CardDescription>Usuarios activos</CardDescription>
          <CardTitle className="font-heading text-section-inicio text-4xl tabular-nums">
            {formatInteger(summary.usuariosActivos)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Tikintags distintos en el período
          </p>
        </CardContent>
      </Card>

      {/* 2. Volumen IN vs OUT — two stacked stats */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen IN vs OUT</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-foreground">
            {formatCOP(summary.volumenIn)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Entradas</p>
          <p className="mt-1 text-base tabular-nums text-muted-foreground">
            {formatCOP(summary.volumenOut)}
          </p>
          <p className="text-xs text-muted-foreground">Salidas</p>
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
