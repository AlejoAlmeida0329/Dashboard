/**
 * ClientesKPICards — 2-KPI grid for the /clientes list page (CLI-04).
 *
 * Server Component (no `"use client"`). The two counts (`totalEmpresas`,
 * `empresasActivas`) are pure server-side aggregations and never change
 * via client interaction — keeping this Server keeps the hydration cost
 * at zero and ships static HTML on first paint.
 *
 * Cliente-foco contract: BOTH cards are ALWAYS visible. Neither carries
 * `data-presenter-hide` because empresa counts are public-facing — the
 * cliente seeing "we serve N empresas total" / "M are active right now"
 * is a normal share-with-cliente fact (not Tikin-internal-only the way
 * Comisión or Take rate would be). Mirror of the Recargas decision in
 * Plan 04-06 where volume + count are fine to share.
 *
 * Format gates: every numeric value flows through `@/lib/format`
 * (formatInteger). Pitfall 9 single Intl gate preserved — zero direct
 * `Intl.NumberFormat` / `toLocaleString` calls here.
 *
 * Stable contract: consumes `EmpresasIndexSummary` from
 * `@/lib/domain/clientes` (Plan 05-01). Plan 05-04 wires it.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EmpresasIndexSummary } from "@/lib/domain/clientes";
import { formatInteger } from "@/lib/format";

type Props = {
  summary: EmpresasIndexSummary;
};

export function ClientesKPICards({ summary }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* 1. Total empresas */}
      <Card>
        <CardHeader>
          <CardDescription>Total empresas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(summary.totalEmpresas)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Empresas con actividad histórica
          </p>
        </CardContent>
      </Card>

      {/* 2. Empresas activas */}
      <Card>
        <CardHeader>
          <CardDescription>Empresas activas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(summary.empresasActivas)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Con ≥1 transacción en el período
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
