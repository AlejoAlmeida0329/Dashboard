/**
 * HechosCurados — Inicio's editorial highlight reel.
 *
 * Renders 3 hechos curados in a 3-col grid:
 *   1. Top empresa del período (GMV absoluto)
 *   2. Latencia destacada (P50 payouts, with INVERTED delta — lower = green)
 *   3. Empresas nuevas activadas (count + small list with overflow "+N más")
 *
 * Server Component — pure formatting + Card composition. No client hooks.
 *
 * Cliente-foco contract: the outer wrapper carries
 * `data-presenter-empresa-hide`. Per Plan 04-04's CSS rule
 * (`globals.css`), this section disappears when BOTH presenter mode is
 * on AND a specific empresa is selected. In plain presenter (no empresa
 * filter) the highlights stay visible — that's the editorial story.
 *
 * Empty states are first-class:
 *   - topEmpresa = null → "Sin transacciones en el período"
 *   - latenciaCurrent.count = 0 → "Sin payouts en el período"
 *   - empresasNuevas.shown = [] && overflow = 0 → "Ninguna empresa nueva
 *     en este período"
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBogotaDate, formatCOP, formatDuration, formatInteger } from "@/lib/format";
import { DeltaBadge } from "./DeltaBadge";

import type { EmpresasNuevasResult, TopEmpresaResult } from "@/lib/domain/inicio-hechos";
import type { PayoutSummary } from "@/lib/domain/payouts";

type Props = {
  topEmpresa: TopEmpresaResult | null;
  empresasNuevas: EmpresasNuevasResult;
  /** Payout headline KPIs over the SAME filter window as the rest of Inicio. */
  latenciaCurrent: PayoutSummary;
  /** Same shape over the immediately-prior period; null when no prior is computable. */
  latenciaPrior: PayoutSummary | null;
};

export function HechosCurados({
  topEmpresa,
  empresasNuevas,
  latenciaCurrent,
  latenciaPrior,
}: Props) {
  const totalEmpresasNuevas = empresasNuevas.shown.length + empresasNuevas.overflowCount;

  return (
    <div className="space-y-4" data-presenter-empresa-hide>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        Lo destacado del período
      </h2>

      <div className="grid gap-4 md:grid-cols-3">
        {/* 1. Top empresa */}
        <Card>
          <CardHeader>
            <CardDescription>Top empresa del período</CardDescription>
            <CardTitle className="font-heading text-xl tabular-nums">
              {topEmpresa ? topEmpresa.empresa_nombre : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topEmpresa ? (
              <p className="font-mono tabular-nums text-sm">{formatCOP(topEmpresa.gmv)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Sin transacciones en el período</p>
            )}
          </CardContent>
        </Card>

        {/* 2. Latencia destacada (inverted delta) */}
        <Card>
          <CardHeader>
            <CardDescription>Mediana de payouts</CardDescription>
            <CardTitle className="font-mono tabular-nums text-xl">
              {latenciaCurrent.count === 0 ? "—" : formatDuration(latenciaCurrent.p50Seconds)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {latenciaCurrent.count === 0 ? (
              <p className="text-xs text-muted-foreground">Sin payouts en el período</p>
            ) : (
              <DeltaBadge
                current={latenciaCurrent.p50Seconds}
                prior={latenciaPrior?.p50Seconds ?? null}
                inverted
              />
            )}
          </CardContent>
        </Card>

        {/* 3. Empresas nuevas */}
        <Card>
          <CardHeader>
            <CardDescription>Empresas nuevas activadas</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums">
              {formatInteger(totalEmpresasNuevas)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalEmpresasNuevas === 0 ? (
              <p className="text-xs text-muted-foreground">Ninguna empresa nueva en este período</p>
            ) : (
              <ul className="text-xs space-y-1">
                {empresasNuevas.shown.map((e) => (
                  <li key={e.empresa_id} className="flex justify-between gap-2">
                    <span className="truncate">{e.empresa_nombre}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatBogotaDate(e.firstTx)}
                    </span>
                  </li>
                ))}
                {empresasNuevas.overflowCount > 0 && (
                  <li className="text-muted-foreground">+{empresasNuevas.overflowCount} más</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
