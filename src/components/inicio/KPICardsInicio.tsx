/**
 * KPICardsInicio — 5-KPI grid for the /inicio "highlight reel".
 *
 * Server Component (no `"use client"`). Renders 5 cards in a single row at
 * `lg`+ via `lg:grid-cols-5` (stacks to 2-col / 1-col on smaller widths,
 * mirroring `PayoutsKPICards`).
 *
 * Card order (matches CONTEXT.md vision and 04-RESEARCH.md):
 *   1. GMV / Volumen total            — ALWAYS VISIBLE
 *   2. Comisión / Revenue              — `data-presenter-hide` (Tikin's
 *       internal revenue; not appropriate to show to a cliente)
 *   3. Take rate                       — `data-presenter-hide` (same reason)
 *   4. Empresas activas                — ALWAYS VISIBLE
 *   5. Bonos vendidos                  — ALWAYS VISIBLE
 *
 * Visibility is 100% CSS-driven via the `data-presenter-hide` attribute
 * (Phase 1 contract). NO React conditionals on presenter or empresa state
 * inside this component — the URL state flows through `PresenterFrame`'s
 * outer wrapper and CSS picks up the rest.
 *
 * Each card pairs a hero number with a `DeltaBadge` showing percent change
 * vs the prior period. When `summary.prior === null` (filters lack from/to,
 * or the prior window is invalid), the badge renders an em-dash for ALL
 * five cards — single point of "no comparison possible".
 *
 * Format gates: every numeric value flows through `@/lib/format`
 * (formatCOP, formatInteger, formatPercent). Zero `Intl.NumberFormat`
 * here (Pitfall 9 single Intl gate preserved).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InicioDeltaSummary } from "@/lib/domain/inicio";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";

import { DeltaBadge } from "./DeltaBadge";

type Props = {
  summary: InicioDeltaSummary;
};

export function KPICardsInicio({ summary }: Props) {
  const { current, prior } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. GMV — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>GMV / Volumen total</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(current.gmv)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.gmv} prior={prior?.gmv ?? null} />
        </CardContent>
      </Card>

      {/* 2. Comisión — oculta en Modo Presentación */}
      <Card data-presenter-hide>
        <CardHeader>
          <CardDescription>Comisión / Revenue</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(current.comision)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge
            current={current.comision}
            prior={prior?.comision ?? null}
          />
        </CardContent>
      </Card>

      {/* 3. Take rate — oculta en Modo Presentación */}
      <Card data-presenter-hide>
        <CardHeader>
          <CardDescription>Take rate</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatPercent(current.takeRate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge
            current={current.takeRate}
            prior={prior?.takeRate ?? null}
          />
        </CardContent>
      </Card>

      {/* 4. Empresas activas — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Empresas activas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(current.empresasActivas)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge
            current={current.empresasActivas}
            prior={prior?.empresasActivas ?? null}
          />
        </CardContent>
      </Card>

      {/* 5. Bonos vendidos — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Bonos vendidos</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(current.bonosVendidos)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge
            current={current.bonosVendidos}
            prior={prior?.bonosVendidos ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
