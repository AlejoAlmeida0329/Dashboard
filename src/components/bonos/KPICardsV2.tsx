/**
 * v2 Bonos KPI header — Server Component (Plan 07-02 BON-V2-01..02).
 *
 * Renders 5 KPI cards in a responsive grid (1 col mobile → 2 col sm → 5 col xl).
 * Drives the cockpit: counts split in/out, monto split in/out, plus a combined
 * ticket promedio. All accents use `text-section-bonos` (Phase 6 Plan 04 Violet
 * OKLCH).
 *
 * Design rules:
 *   - Cards stay visible even when summary counts are zero (layout stability
 *     across filter changes; the bottom row says "Sin bonos en el período").
 *   - All COP via `formatCOP`; counts via `formatInteger` (single Intl gate
 *     per format.ts, Pitfall 9).
 *   - No `data-presenter-hide` here — the v2 Bonos KPI row is a primary
 *     protagonist visible in BOTH internal AND presenter mode (per
 *     07-CONTEXT.md "ranking-first" cockpit; the hide attribute is reserved
 *     for chrome / Tikin-only revenue elsewhere).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BonoSummaryV2 } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: BonoSummaryV2;
};

export function KPICardsV2({ summary }: Props) {
  const totalBonos = summary.countIn + summary.countOut;
  const hasData = totalBonos > 0;
  const emptyHint = "Sin bonos en el período";

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {/* 1. Bonos recibidos */}
      <Card>
        <CardHeader>
          <CardDescription>Bonos recibidos</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-section-bonos">
            {formatInteger(summary.countIn)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData ? formatCOP(summary.montoIn) : emptyHint}
          </p>
        </CardContent>
      </Card>

      {/* 2. Bonos enviados */}
      <Card>
        <CardHeader>
          <CardDescription>Bonos enviados</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-section-bonos">
            {formatInteger(summary.countOut)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData ? formatCOP(summary.montoOut) : emptyHint}
          </p>
        </CardContent>
      </Card>

      {/* 3. Volumen recibido (COP) */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen recibido</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-section-bonos">
            {formatCOP(summary.montoIn)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `${formatInteger(summary.countIn)} bonos`
              : emptyHint}
          </p>
        </CardContent>
      </Card>

      {/* 4. Volumen enviado (COP) */}
      <Card>
        <CardHeader>
          <CardDescription>Volumen enviado</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-section-bonos">
            {formatCOP(summary.montoOut)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `${formatInteger(summary.countOut)} bonos`
              : emptyHint}
          </p>
        </CardContent>
      </Card>

      {/* 5. Ticket promedio */}
      <Card>
        <CardHeader>
          <CardDescription>Ticket promedio</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums text-muted-foreground">
            {formatCOP(summary.ticketPromedio)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {hasData
              ? `Sobre ${formatInteger(totalBonos)} bonos`
              : emptyHint}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
