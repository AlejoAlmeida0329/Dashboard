"use client";

/**
 * EmpresaActivityChart — Client Component, 12-month bar chart of an
 * empresa's monto by month. Mirror of `BonosChart` / `RecargasTrendChart`
 * shape (recharts ResponsiveContainer + BarChart, currentColor stroke,
 * Card chrome supplied by the page in Plan 05-04).
 *
 * Cliente-foco contract: NO data-presenter-hide. The chart is the cliente's
 * own activity timeline — desired in cliente view.
 *
 * Format gates: formatCOP for tooltip + Y-axis. Month labels rendered
 * raw as `yyyy-MM` strings (locale-invariant numeric format).
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyActivity } from "@/lib/domain/clientes";
import { formatCOP } from "@/lib/format";

type Props = {
  data: MonthlyActivity[];
};

export function EmpresaActivityChart({ data }: Props) {
  return (
    <div className="h-[320px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <XAxis
            dataKey="month"
            stroke="currentColor"
            fontSize={12}
            tickMargin={8}
          />
          <YAxis
            stroke="currentColor"
            fontSize={12}
            tickFormatter={(v: number) => formatCOP(v)}
            tickMargin={8}
            width={90}
          />
          <Tooltip
            cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
            }}
            formatter={(v: number) => [formatCOP(v), "Monto"]}
          />
          <Bar
            dataKey="monto"
            fill="currentColor"
            stroke="currentColor"
            fillOpacity={0.6}
            minPointSize={2}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
