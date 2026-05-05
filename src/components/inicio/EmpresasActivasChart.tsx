"use client";

/**
 * Empresas-activas trend chart for /inicio — Recharts LineChart.
 *
 * CONTEXT.md vision: a line conveys continuity of headcount better than
 * discrete bars for "how many distinct empresas were active each period".
 * Buckets are pre-computed by `aggregateActiveEmpresasByDate`
 * (granularity=day) or `aggregateActiveEmpresasByWeek` (granularity=week).
 * Both emit the stable `{bucket, count}` shape with Set-per-bucket dedup
 * (Pitfall 11: 1 empresa with N tx in one bucket counts as 1, not N).
 *
 * Design rules — mirror of `BonosChart` (LineChart variant) + same
 * `stroke="currentColor"` convention as `GMVTrendChart`:
 *   - Single line, `dot={false}`, `type="monotone"`, `strokeWidth={2}`.
 *     Calmado enough to fade into background, loud enough to read trend.
 *   - All numeric tick / tooltip values flow through `formatInteger` from
 *     `@/lib/format` — single Intl gate preserved.
 *   - `tickFormatter` compacts bucket strings the same way
 *     `GMVTrendChart` does (`"2026-04-15"` → `"15/04"`,
 *     `"2026-W17"` → `"W17"`).
 *   - NO `<Card>` wrapper — page provides the Card chrome.
 *   - NO `<Legend>` — single series.
 *
 * Why a Client Component:
 *   Recharts' `ResponsiveContainer` reads the actual DOM (window resize
 *   listener). The wrapping `inicio/page.tsx` stays a Server Component.
 *
 * Cliente-foco: this chart degenerates to a flat line at y=1 when the
 * empresa filter is active (the empresa is the only "active empresa"
 * for every bucket). Plan 04-04 introduced the `data-presenter-empresa-hide`
 * CSS gate; Plan 04-07 page composition will tag THIS chart's outer
 * Card with that attribute so cliente-foco hides it without React work.
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

import type { ActiveEmpresaPoint } from "@/lib/domain/inicio";
import { formatInteger } from "@/lib/format";

type Props = {
  /**
   * Pre-aggregated points from `aggregateActiveEmpresasByDate` or
   * `aggregateActiveEmpresasByWeek`. Already sorted ascending by bucket.
   */
  data: ActiveEmpresaPoint[];
  /**
   * Hint for axis tick formatting. Bucket strings already encode the
   * granularity (`YYYY-MM-DD` vs `RRRR-Www`); this drives label compaction.
   */
  granularity: "day" | "week";
};

export function EmpresasActivasChart({ data, granularity }: Props) {
  const tickFormatter = (b: string) =>
    granularity === "week"
      ? b.slice(5) // "2026-W17" → "W17"
      : `${b.slice(8)}/${b.slice(5, 7)}`; // "2026-04-15" → "15/04"

  return (
    <div className="h-[320px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            tickFormatter={tickFormatter}
          />
          <YAxis
            stroke="currentColor"
            tick={{ fontSize: 12 }}
            tickFormatter={formatInteger}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(v: number) => [formatInteger(v), "Empresas activas"]}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
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
