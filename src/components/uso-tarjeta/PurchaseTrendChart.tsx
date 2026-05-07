"use client";

/**
 * PurchaseTrendChart — Daily purchase timeline (Plan 08-02 CARD-V2-05).
 *
 * Client Component (Recharts requires DOM access for ResponsiveContainer).
 * The wrapping page stays a Server Component; this leaf is the only piece
 * that hydrates.
 *
 * Renders a single-series LineChart of `compras` (count) per Bogotá day.
 * Single-series is intentional — keeps the chart readable. Volume (COP) is
 * NOT plotted as a secondary axis here; dual-axis adds layout complexity
 * that doesn't pay off when the headline question is "¿cuántas compras al
 * día?". COP volume is still surfaced in the tooltip for context.
 *
 * Granularity: domain emits daily buckets (CARD-V2-05). No granularity
 * switcher in this plan — re-bucketing to weekly/monthly is a future
 * enhancement (same convention as Inicio v1's TimelineChart and Phase 7
 * BonosFlowChart).
 *
 * Color choice: hard-coded OKLCH shade anchored on the section-tarjeta hue
 * (Amber, ~75°). Same idiom as BonosFlowChart's hard-coded violet shades —
 * Recharts doesn't compose Tailwind opacity gracefully on `<Line stroke=...>`.
 *
 * Empty state: render a friendly `<p>` instead of an empty Recharts axis frame.
 *
 * Tooltip: locale-aware short date + integer count + COP volume via
 * `formatInteger` and `formatCOP` (Pitfall 9 / format.ts gate).
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { PurchaseByDate } from "@/lib/domain/cardUsage";
import { formatCOP, formatInteger } from "@/lib/format";

const STROKE_COMPRAS = "oklch(0.65 0.18 75)"; // Amber — section-tarjeta hue

type Props = {
  data: PurchaseByDate[];
};

type TooltipPayload = {
  payload?: PurchaseByDate;
  value?: number;
};

/**
 * Convert a `YYYY-MM-DD` ISO date string to a short DD/MM tick label.
 * Cheap string-slice rather than a full date parse — the domain layer
 * already emits the date in Bogotá-anchored ISO form.
 */
function shortDate(iso: string): string {
  // Expecting `YYYY-MM-DD`; defensive against a malformed value (returns the raw input).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function PurchaseTrendTooltip({
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
      <div className="mb-1 font-medium text-foreground">
        {label ? shortDate(label) : ""}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Compras</span>
        <span className="text-right text-foreground">
          {formatInteger(row.compras)}
        </span>
        <span className="text-muted-foreground">Volumen</span>
        <span className="text-right text-foreground">
          {formatCOP(row.volumenCOP)}
        </span>
      </div>
    </div>
  );
}

export function PurchaseTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes
      </p>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border opacity-50"
          />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(n: number) => formatInteger(n)}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip
            content={<PurchaseTrendTooltip />}
            cursor={{ stroke: "currentColor", strokeOpacity: 0.1 }}
          />
          <Line
            type="monotone"
            dataKey="compras"
            name="Compras"
            stroke={STROKE_COMPRAS}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
