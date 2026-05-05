"use client";

/**
 * RecargasTrendChart — daily monto-recargado bar chart for the /recargas tab.
 *
 * Mirrors `GMVTrendChart.tsx` (Plan 04-05) shape line-for-line. Differences:
 *   - Daily-only (no granularity prop). Per 04-CONTEXT.md "Recargas no es
 *     héroe": keep it simple — week aggregation is Inicio's concern.
 *   - `dataKey="monto"` (the trend point shape from `aggregateRecargasByDate`
 *     uses `{date, count, monto}`, not the generic `{bucket, value}`).
 *   - Tooltip label "Recargado".
 *
 * Design rules match GMVTrendChart:
 *   - `stroke="currentColor"` + `fill="currentColor"` so the chart respects
 *     theme via the parent's `text-foreground` token. NO hardcoded hex.
 *   - All numeric tick / tooltip values flow through `formatCOP` from
 *     `@/lib/format` — Pitfall 9 single Intl gate preserved.
 *   - `minPointSize={2}` keeps zero-value bars visible.
 *   - `tickFormatter` compacts ISO dates: `"2026-04-15"` → `"15/04"`.
 *   - NO `<Card>` wrapper — the page provides the Card chrome.
 *   - NO `<Legend>` — single series.
 *
 * No `data-presenter-hide` here — the trend chart is fine in both views.
 *
 * Why a Client Component: Recharts' `ResponsiveContainer` reads the actual
 * DOM (window resize listener); the wrapping `recargas/page.tsx` stays a
 * Server Component.
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

import type { RecargaByDate } from "@/lib/domain/recargas";
import { formatCOP } from "@/lib/format";

type Props = {
  /** Pre-aggregated daily points from `aggregateRecargasByDate`. */
  data: RecargaByDate[];
};

export function RecargasTrendChart({ data }: Props) {
  const tickFormatter = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;

  return (
    <div className="h-[320px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            tickFormatter={tickFormatter}
          />
          <YAxis
            stroke="currentColor"
            tick={{ fontSize: 12 }}
            tickFormatter={formatCOP}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(v: number) => [formatCOP(v), "Recargado"]}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Bar
            dataKey="monto"
            fill="currentColor"
            minPointSize={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
