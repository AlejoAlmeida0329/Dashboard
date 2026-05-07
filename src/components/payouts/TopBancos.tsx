/**
 * Top bancos por volumen — Server Component, ALWAYS VISIBLE.
 *
 * Replaces the originally-planned `DestinationSplit.tsx` (tarjeta vs banco).
 * Plan 03-01 confirmed all 798 production payouts are to banks (12 distinct
 * codes, zero card payouts), so PAY-04's "split por destino" is reinterpreted
 * at REAL granularity: top N banks by montoTotal + an "Otros bancos" rollup.
 *
 * Visibility (decided 2026-05-04 with user):
 *   - NO `data-presenter-hide` here. The widget stays visible in Modo
 *     Presentación. At cliente-foco view (`?empresa=$X&presenter=1`)
 *     the data is already narrowed to that empresa's payouts via the
 *     URL filter, so showing "their banks" doesn't leak other clients'
 *     info — it tells the cliente "where your money is going".
 *
 * Format gates:
 *   - All COP values via `formatCOP`.
 *   - Counts via `formatInteger`.
 *   - Durations (P50/P95) via `formatDuration` — same compact `H:MM:SS`
 *     used by `PayoutsKPICards.tsx`.
 *   - Zero direct `Intl.NumberFormat` / `toLocaleString`.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BancoStats, TopBancos as TopBancosData } from "@/lib/domain/payouts";
import { formatCOP, formatDuration, formatInteger } from "@/lib/format";

type Props = {
  data: TopBancosData;
};

/**
 * Pretty-print a `Payout.medium` bank code:
 *   - `"Otros bancos"` (literal) → unchanged (already display-ready)
 *   - `"OTRO_MEDIUM"` (Plan 03-01 fallback constant) → "Sin medio"
 *   - others (`"bancolombia"`, `"banco_de_bogota"`, …) → Title Case with
 *     spaces (`"Bancolombia"`, `"Banco De Bogota"`, `"Nequi"`).
 *
 * Tikin can override per-bank display names later by extending this map;
 * for now, the title-cased code is human-readable enough for the dashboard.
 */
function displayBancoName(code: string): string {
  if (code === "Otros bancos") return code;
  if (code === "OTRO_MEDIUM") return "Sin medio";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function BancoRow({
  stats,
  maxMonto,
}: {
  stats: BancoStats;
  maxMonto: number;
}) {
  // Bar width as a fraction of the leader; clamps at 4% so even tiny banks
  // produce a visible stub. The bar is the v2 cockpit accent — it lets the
  // user eyeball relative volume without reading every COP value.
  const widthPct =
    maxMonto > 0
      ? Math.max(4, Math.round((stats.montoTotal / maxMonto) * 100))
      : 0;

  return (
    <li className="flex flex-col gap-1 py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="truncate font-medium">
          {displayBancoName(stats.medium)}
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm tabular-nums">
          <span>
            <span className="text-muted-foreground">Pagos </span>
            {formatInteger(stats.count)}
          </span>
          <span>
            <span className="text-muted-foreground">Volumen </span>
            {formatCOP(stats.montoTotal)}
          </span>
          <span>
            <span className="text-muted-foreground">P50 </span>
            <span className="font-mono">
              {formatDuration(stats.p50Seconds)}
            </span>
          </span>
          <span>
            <span className="text-muted-foreground">P95 </span>
            <span className="font-mono">
              {formatDuration(stats.p95Seconds)}
            </span>
          </span>
        </span>
      </div>
      {widthPct > 0 && (
        <span
          className="block h-1.5 rounded bg-section-payouts/70"
          style={{ width: `${widthPct}%` }}
        />
      )}
    </li>
  );
}

export function TopBancos({ data }: Props) {
  const isEmpty = data.top.length === 0 && data.otros.count === 0;
  const maxMonto = data.top[0]?.montoTotal ?? data.otros.montoTotal ?? 0;

  return (
    <Card className="border-l-4 border-section-payouts">
      <CardHeader>
        <CardTitle>Bancos con más volumen</CardTitle>
        <CardDescription>
          Top {data.top.length} bancos por $ pagado en el período
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">
            Sin payouts en el período seleccionado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.top.map((b) => (
              <BancoRow key={b.medium} stats={b} maxMonto={maxMonto} />
            ))}
            {data.otros.count > 0 && (
              <BancoRow key="otros" stats={data.otros} maxMonto={maxMonto} />
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
