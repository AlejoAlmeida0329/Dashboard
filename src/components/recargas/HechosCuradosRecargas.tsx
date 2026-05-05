/**
 * HechosCuradosRecargas — Recargas' editorial highlight reel.
 *
 * Server Component — pure formatting + Card composition. No client hooks.
 * Mirrors `inicio/HechosCurados.tsx` (Plan 04-05) but with 2 cards (instead
 * of 3), since Recargas has fewer narrative angles per 04-CONTEXT.md.
 *
 * Cards:
 *   1. Top empresa recargadora (the empresa with the highest sum of monto)
 *   2. Recarga más grande (the single largest recarga transaction)
 *
 * Cliente-foco contract: the outer wrapper carries
 * `data-presenter-empresa-hide`. Per Plan 04-04's CSS rule
 * (`globals.css`), this section disappears when BOTH presenter mode is
 * on AND a specific empresa is selected. In plain presenter (no empresa
 * filter) the highlights stay visible — that's the editorial story.
 *
 * Empty states are first-class:
 *   - topEmpresa = null         → "Sin recargas en el período"
 *   - recargaMasGrande = null   → "Sin recargas en el período"
 *
 * Per CONTEXT.md cut-priority: hechos here are trim-first if scope tightens,
 * but Plan 04-03 already built the domain primitives (topRecargadora,
 * largestRecarga) so the marginal cost is just rendering.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RecargaByEmpresa } from "@/lib/domain/recargas";
import type { Transaction } from "@/lib/domain/types";
import { formatBogotaDate, formatCOP, formatInteger } from "@/lib/format";

type Props = {
  topEmpresa: RecargaByEmpresa | null;
  recargaMasGrande: Transaction | null;
};

export function HechosCuradosRecargas({
  topEmpresa,
  recargaMasGrande,
}: Props) {
  return (
    <div className="space-y-4" data-presenter-empresa-hide>
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Lo destacado del período
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 1. Top empresa recargadora */}
        <Card>
          <CardHeader>
            <CardDescription>Top empresa recargadora</CardDescription>
            <CardTitle className="font-heading text-xl tabular-nums">
              {topEmpresa ? topEmpresa.empresa_nombre : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topEmpresa ? (
              <>
                <p className="font-mono text-sm tabular-nums">
                  {formatCOP(topEmpresa.monto)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatInteger(topEmpresa.count)} recargas
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin recargas en el período
              </p>
            )}
          </CardContent>
        </Card>

        {/* 2. Recarga más grande */}
        <Card>
          <CardHeader>
            <CardDescription>Recarga más grande</CardDescription>
            <CardTitle className="font-heading text-3xl tabular-nums">
              {recargaMasGrande ? formatCOP(recargaMasGrande.monto) : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recargaMasGrande ? (
              <p className="text-xs text-muted-foreground">
                {recargaMasGrande.empresa_nombre} ·{" "}
                {formatBogotaDate(recargaMasGrande.fecha)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sin recargas en el período
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
