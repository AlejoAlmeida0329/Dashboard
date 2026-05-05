/**
 * RecargasKPICards — 2-KPI grid for the /recargas tab.
 *
 * Server Component (no `"use client"`). Renders 2 cards in a
 * `grid-cols-1 sm:grid-cols-2` layout — Recargas is NOT the héroe pestaña
 * (per 04-CONTEXT.md), so the KPI strip stays minimal: just volume and
 * count, both with deltas vs the prior window.
 *
 * Card order:
 *   1. Total $ recargado    — `formatCOP(montoTotal)` + delta
 *   2. # transacciones       — `formatInteger(count)` + delta
 *
 * Cliente-foco contract: NO `data-presenter-hide` on either card. Recargas
 * has no internal-only KPI — Comisión / take-rate are Inicio's concern;
 * here we just show volume, which is fair to share with empresas. Per
 * 04-CONTEXT.md: "Recargas no es héroe, basta con monto + count".
 *
 * Cross-feature reuse: `DeltaBadge` is imported from `inicio/` (Plan 04-05).
 * NOT duplicated here — the project owns a SINGLE delta atom.
 *
 * Format gates: every numeric value flows through `@/lib/format`
 * (formatCOP, formatInteger). Pitfall 9 single Intl gate preserved.
 */

import { DeltaBadge } from "@/components/inicio/DeltaBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RecargaSummary } from "@/lib/domain/recargas";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: { current: RecargaSummary; prior: RecargaSummary | null };
};

export function RecargasKPICards({ summary }: Props) {
  const { current, prior } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* 1. Total $ recargado */}
      <Card>
        <CardHeader>
          <CardDescription>Total recargado</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(current.montoTotal)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge
            current={current.montoTotal}
            prior={prior?.montoTotal ?? null}
          />
        </CardContent>
      </Card>

      {/* 2. # transacciones */}
      <Card>
        <CardHeader>
          <CardDescription># de recargas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(current.count)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.count} prior={prior?.count ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
