"use client";

/**
 * Latency histogram for the Payouts tab — single-series Recharts BarChart.
 *
 * Design rules (mirror of `BonosChart.tsx` from Plan 02-03):
 *   - SINGLE Bar series. Plan 03-02's `aggregateLatencyHistogram` emits
 *     `LatencyBucket[]` shaped `{bucket, count}` — no `medium` stack.
 *     All 798 production payouts are to banks; a stack-by-medium would
 *     show one color and zeros, which is visually misleading.
 *   - Stable 4-bucket shape on every render (`<1h`, `1-6h`, `6-24h`, `>24h`)
 *     even when count=0 in some buckets. Plan 03-02's aggregator guarantees
 *     this; the chart trusts the contract.
 *   - `minPointSize={2}` keeps zero-count bars VISIBLE — Recharts hides
 *     zero-height bars by default, which would mask "we had 0 in this
 *     bucket" as "this bucket doesn't exist". `2` pixels is enough to see
 *     a tiny stub but small enough not to misrepresent the count.
 *   - `stroke="currentColor"` + `fill="currentColor"` so the chart respects
 *     theme via the parent's `text-foreground` token. No hardcoded hex.
 *   - All numeric tick / tooltip values flow through `formatInteger` from
 *     `@/lib/format` — single Intl gate preserved.
 *   - NO `<Legend>`: only one series, the legend would be visual noise.
 *   - NO `<Card>` wrapper here. Plan 03-04's `payouts/page.tsx` provides
 *     the Card chrome around this leaf, mirroring how `bonos/page.tsx`
 *     wraps `BonosChart`.
 *
 * Why a Client Component:
 *   - Recharts' `ResponsiveContainer` needs the actual DOM (window resize
 *     listener). The chart shell can't be serialized for RSC handoff.
 *   - The wrapping page stays a Server Component; this leaf is the only
 *     piece on the Payouts route that hydrates.
 *
 * No `data-presenter-hide` here — the histogram is the "la mayoría son
 * inmediatos" story (CONTEXT.md), visible in BOTH internal AND presenter
 * views.
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

import type { LatencyBucket } from "@/lib/domain/payouts";
import { formatInteger } from "@/lib/format";

type Props = {
  /** Pre-aggregated 4-row histogram from `aggregateLatencyHistogram`. */
  buckets: LatencyBucket[];
};

export function LatencyHistogram({ buckets }: Props) {
  return (
    <div className="h-[300px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={buckets}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <XAxis
            dataKey="bucket"
            stroke="currentColor"
            tick={{ fontSize: 12 }}
          />
          <YAxis
            stroke="currentColor"
            tick={{ fontSize: 12 }}
            tickFormatter={formatInteger}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value: number) => [formatInteger(value), "Payouts"]}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Bar
            dataKey="count"
            fill="currentColor"
            minPointSize={2}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
