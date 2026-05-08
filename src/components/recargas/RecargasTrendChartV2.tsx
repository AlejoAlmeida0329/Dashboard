"use client";

/**
 * RecargasTrendChartV2 — stacked PSE/TRANSFER timeline (REC-V2-04 + REC-V2-08).
 *
 * Client Component (Recharts ResponsiveContainer needs the actual DOM —
 * window resize listener). The wrapping page stays a Server Component;
 * this leaf is the only piece that hydrates.
 *
 * Implementation choice: STACKED BAR CHART (per Plan 08-04 implementer's
 * choice between stacked-bars vs two-series lines). Rationale:
 *   - The story is "how many recargas per day, by method" — a stacked
 *     count is a more direct read of the daily volume than two separate
 *     lines that the eye has to mentally sum.
 *   - Mirrors Plan 07-02's BonosFlowChart shape (stacked-bar timeline),
 *     keeping cockpit conventions consistent across v2 sections.
 *   - X = date, Y = count; tooltip shows PSE count + Transfer count + total.
 *
 * Color choices (no Tailwind opacity on bars — Recharts doesn't compose
 * Tailwind opacity gracefully on `<Bar fill=...>`; we hard-code two OKLCH
 * shades anchored on the section-recargas hue 200°):
 *   - PSE      → darker shade (the larger, more frequent stack base)
 *   - Transfer → lighter shade (the smaller stack on top)
 *
 * Both shades are pinned to `oklch(L 0.16 200)` with L = 0.50 (PSE) and
 * L = 0.65 (Transfer); 200° is the Recargas Teal hue established in
 * Phase 6 Plan 04. The lift is comfortably visible in both light and
 * dark modes (the .dark CSS already lifts the section vars +0.10
 * lightness — the chart fills are stable across themes because we don't
 * read CSS vars from JS here).
 *
 * Empty state: render a simple <p> instead of an empty Recharts axis frame.
 *
 * X-axis tick formatter: short date `dd/MM` from ISO `yyyy-MM-dd`.
 *
 * Format gates: tooltip values via `@/lib/format` (formatInteger).
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RecargaByDateV2 } from "@/lib/domain/recargas";
import { formatCOP, formatInteger } from "@/lib/format";

const FILL_PSE = "oklch(0.50 0.16 200)"; // darker teal
const FILL_TRANSFER = "oklch(0.65 0.16 200)"; // lighter teal

type Props = {
  data: RecargaByDateV2[];
};

type TooltipPayload = {
  payload?: RecargaByDateV2;
  dataKey?: string;
  value?: number;
};

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-sm">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">PSE</span>
        <span className="text-right text-foreground">
          {formatInteger(row.pseCount)}
        </span>
        <span className="text-muted-foreground">Transferencia</span>
        <span className="text-right text-foreground">
          {formatInteger(row.transferCount)}
        </span>
        <span className="border-t pt-0.5 text-muted-foreground">Total</span>
        <span className="border-t pt-0.5 text-right font-medium text-foreground">
          {formatInteger(row.totalCount)}
        </span>
        <span className="col-span-2 mt-1 text-[0.7rem] text-muted-foreground tabular-nums">
          {formatCOP(row.totalVolumen)}
        </span>
      </div>
    </div>
  );
}

const tickFormatter = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

export function RecargasTrendChartV2({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes para tendencia. Ampliá el período.
      </p>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border opacity-50"
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={tickFormatter}
            className="text-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(n: number) => formatInteger(n)}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip content={<TrendTooltip />} cursor={{ fillOpacity: 0.1 }} />
          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
          <Bar
            dataKey="pseCount"
            name="PSE"
            stackId="recargas"
            fill={FILL_PSE}
          />
          <Bar
            dataKey="transferCount"
            name="Transferencia"
            stackId="recargas"
            fill={FILL_TRANSFER}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
