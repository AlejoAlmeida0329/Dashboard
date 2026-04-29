/**
 * Top 10 empresas por $ vendido — Server Component, presenter-hidden.
 *
 * The leaderboard is the "internal-revenue" view: it surfaces which empresa
 * generates the most volume, and is hidden in Modo Presentación so the
 * cliente projection doesn't see other clients' positions. The hide is
 * declarative via `data-presenter-hide` on the wrapper — no JS check, no
 * conditional render — the CSS contract from Phase 1 (01-03) does the
 * actual hiding.
 *
 * Input shape:
 *   - `rows: BonoByEmpresa[]` already truncated to top 10 by the caller
 *     (idiomatic: `top10Empresas(aggregateBonosByEmpresa(bonos))`).
 *   - `rangeLabel?: string` optional period subtitle (e.g. "últimos 30 días").
 *
 * Format gates:
 *   - All COP values via `formatCOP`.
 *   - Counts via `formatInteger`.
 *   - Zero direct `Intl.NumberFormat` / `toLocaleString` calls.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BonoByEmpresa } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  /** Pre-truncated to top 10. Caller does the slicing. */
  rows: BonoByEmpresa[];
  /** Optional period subtitle, e.g. "últimos 30 días". */
  rangeLabel?: string;
};

export function Leaderboard({ rows, rangeLabel }: Props) {
  return (
    <Card data-presenter-hide>
      <CardHeader>
        <CardTitle className="text-base">
          Top 10 empresas
          {rangeLabel ? <span className="text-muted-foreground"> · {rangeLabel}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin bonos en el período seleccionado.
          </p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, idx) => (
              <li
                key={r.empresa_id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="truncate">{r.empresa_nombre}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 tabular-nums">
                  <span className="text-muted-foreground">{formatInteger(r.count)}</span>
                  <span className="font-medium">{formatCOP(r.monto)}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
