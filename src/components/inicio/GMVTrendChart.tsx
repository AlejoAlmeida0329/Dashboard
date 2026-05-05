"use client";

/**
 * GMV trend chart for /inicio — bucket-aware Recharts BarChart.
 *
 * CONTEXT.md vision: GMV is volume; bars read more legibly than a line
 * for "how much money moved per period". Buckets are pre-computed by
 * `aggregateGMVByDate` (granularity=day) or `aggregateGMVByWeek`
 * (granularity=week) — both emit the stable `{bucket, value}` shape so
 * this component flips between them by switching the input array.
 *
 * Design rules (mirror of `LatencyHistogram` from Plan 03-02 + the
 * `BonosChart` conventions from Plan 02-03):
 *   - `stroke="currentColor"` + `fill="currentColor"` so the chart
 *     respects theme via the parent's `text-foreground` token. NO
 *     hardcoded hex.
 *   - All numeric tick / tooltip values flow through `formatCOP` from
 *     `@/lib/format` — Pitfall 9 single Intl gate preserved.
 *   - `minPointSize={2}` keeps zero-value bars visible (Recharts hides
 *     zero-height bars by default; would mask "we had 0 sales here" as
 *     "this bucket doesn't exist").
 *   - `tickFormatter` compacts bucket strings: `"2026-04-15"` → `"15/04"`,
 *     `"2026-W17"` → `"W17"`. Slicing avoids any locale parsing.
 *   - NO `<Card>` wrapper — the page provides the Card chrome (same
 *     convention as `BonosChart` / `LatencyHistogram`).
 *   - NO `<Legend>` — single series, the legend would be visual noise.
 *
 * Why a Client Component:
 *   Recharts' `ResponsiveContainer` reads the actual DOM (window resize
 *   listener). The chart shell can't be serialized for RSC handoff.
 *   The wrapping `inicio/page.tsx` stays a Server Component.
 *
 * No `data-presenter-hide` here — the GMV chart is the heroína of the
 * /inicio tab in BOTH internal AND presenter views.
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

import type { GMVPoint } from "@/lib/domain/inicio";
import { formatCOP } from "@/lib/format";

type Props = {
  /** Pre-aggregated points from `aggregateGMVByDate` or `aggregateGMVByWeek`. */
  data: GMVPoint[];
  /**
   * Hint for axis tick formatting. Bucket strings already encode the
   * granularity (`YYYY-MM-DD` vs `RRRR-Www`); this drives label compaction.
   */
  granularity: "day" | "week";
};

export function GMVTrendChart({ data, granularity }: Props) {
  const tickFormatter = (b: string) =>
    granularity === "week"
      ? b.slice(5) // "2026-W17" → "W17"
      : `${b.slice(8)}/${b.slice(5, 7)}`; // "2026-04-15" → "15/04"

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
            dataKey="bucket"
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
            formatter={(v: number) => [formatCOP(v), "GMV"]}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Bar
            dataKey="value"
            fill="currentColor"
            minPointSize={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
