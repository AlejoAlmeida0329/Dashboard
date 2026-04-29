"use client";

/**
 * Hero line chart for the Bonos tab — "bonos vendidos en el tiempo".
 *
 * Design rules (from 02-CONTEXT.md "Specific Ideas"):
 *   - Línea calmada: single line, no bars, no stacked. `dot={false}` +
 *     `type="monotone"` + `strokeWidth={2}`. Quiet enough to fade into
 *     the background of the page; loud enough to read the trend.
 *   - No hard-coded colors. `stroke="currentColor"` lets the parent
 *     wrapper drive the palette via Tailwind utility (e.g. `text-primary`).
 *     Theme switches don't require touching this file.
 *   - All numeric tick labels and tooltip values flow through
 *     `formatCOP` / `formatInteger` from `@/lib/format` — Pitfall 9
 *     single Intl gate is preserved (zero `Intl.NumberFormat` /
 *     `toLocaleString` calls in component code).
 *
 * Why a Client Component:
 *   - Recharts uses `ResponsiveContainer` which needs the actual DOM
 *     (window resize listener). The chart shell can't be serialized for
 *     RSC handoff.
 *   - The wrapping page (`/bonos/page.tsx`) stays a Server Component;
 *     this leaf is the only piece that hydrates.
 *
 * No `data-presenter-hide` here:
 *   - The chart is the HEROÍNA of the Bonos tab — it's visible in BOTH
 *     internal view AND presenter mode (only the empresa filter swaps
 *     what data feeds it). The CSS contract from Phase 1 only hides
 *     things explicitly marked with `data-presenter-hide`.
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

import type { BonoByDate } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  /** Pre-aggregated points from `aggregateBonosByDate`. Already sorted ASC. */
  data: BonoByDate[];
  /**
   * Which numeric dimension to plot.
   *  - `'count'`  → number of bonos sold per day (default)
   *  - `'monto'`  → COP sold per day
   */
  metric?: "count" | "monto";
};

export function BonosChart({ data, metric = "count" }: Props) {
  // Recharts wants `value: number`, not the dual-shape BonoByDate row.
  const series = data.map((d) => ({
    date: d.date,
    value: metric === "count" ? d.count : d.monto,
  }));

  // Tick / tooltip formatter routes through the single Intl gate.
  const formatValue = (n: number) =>
    metric === "count" ? formatInteger(n) : formatCOP(n);

  return (
    <div className="h-[320px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={series}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border opacity-50" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip
            formatter={(v: number) => formatValue(v)}
            labelClassName="text-foreground"
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
