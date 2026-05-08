"use client";

/**
 * ActivityTimelineV2 — INI-V2-05 distinct-tikintag-per-bucket time series.
 *
 * Client Component (Recharts ResponsiveContainer needs DOM access for the
 * window resize listener). The wrapping page stays a Server Component;
 * this leaf is the only piece that hydrates.
 *
 * Renders a `LineChart` with TWO series sharing the X-axis:
 *   - Series 1: `usuariosActivos`  — solid Indigo line on the LEFT y-axis
 *                                    (the protagonist — answers "¿cuántos
 *                                    tikintags distintos?").
 *   - Series 2: `volumen`          — dashed muted-Indigo line on the RIGHT
 *                                    y-axis (signed net flow per bucket;
 *                                    can be negative, so the y-axis allows
 *                                    decimals + crosses zero).
 *
 * Color choices — pinned OKLCH literals anchored on the section-inicio
 * Indigo hue (~250). Recharts doesn't compose Tailwind opacity gracefully
 * on `<Line stroke=...>`; the muted-Indigo dashed companion line uses a
 * low-chroma variant so it visually recedes behind the protagonist users
 * line:
 *   solid Indigo  → oklch(0.55 0.18 250)
 *   muted Indigo  → oklch(0.55 0.05 250)  (low chroma)
 *
 * Granularity:
 *   The `granularity` prop is informational only (`"day" | "week"`) — the
 *   page upstream chooses the right aggregation
 *   (`aggregateActivityByDateV2` vs `aggregateActivityByWeekV2`) and passes
 *   the resulting series in. This leaf doesn't re-bucket; it just renders
 *   what it gets. The granularity hint is used only for tooltip formatting
 *   ("YYYY-MM-DD" vs "YYYY-Www" labels).
 *
 * Empty / sparse handling:
 *   `data.length < 2` → render a friendly muted-foreground line. With
 *   < 2 points Recharts paints either nothing (0 points) or a single dot
 *   that misleads as "the trend" (1 point). Same convention as
 *   PurchaseTrendChart / RecargasTrendChartV2 sparse-input handling.
 *
 * Format gates: tooltip values via `@/lib/format` (formatInteger, formatCOP).
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

import type { ActivityPointV2 } from "@/lib/domain/inicio";
import { formatCOP, formatInteger } from "@/lib/format";

const STROKE_USERS = "oklch(0.55 0.18 250)"; // Indigo — section-inicio hue
const STROKE_VOLUMEN = "oklch(0.55 0.05 250)"; // Muted Indigo — companion stream

type Props = {
  data: ActivityPointV2[];
  granularity: "day" | "week";
};

type TooltipPayload = {
  payload?: ActivityPointV2;
  dataKey?: string;
  value?: number;
};

/**
 * Format the bucket label for the tooltip header. Daily buckets are
 * already in `YYYY-MM-DD` shape; weekly buckets are `YYYY-Www`.
 */
function bucketLabel(bucket: string, granularity: "day" | "week"): string {
  if (granularity === "week") return bucket; // RRRR-Www is already readable.
  // Daily: convert YYYY-MM-DD → DD/MM/YYYY for human readability.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return bucket;
  return `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}/${bucket.slice(0, 4)}`;
}

/**
 * Short tick label for the X-axis. Daily → DD/MM. Weekly → leave RRRR-Www.
 */
function tickFormatter(bucket: string, granularity: "day" | "week"): string {
  if (granularity === "week") return bucket;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bucket)) return bucket;
  return `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`;
}

function ActivityTooltip({
  active,
  payload,
  label,
  granularity,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  granularity: "day" | "week";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-sm">
      <div className="mb-1 font-medium text-foreground">
        {label ? bucketLabel(label, granularity) : ""}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Usuarios</span>
        <span className="text-right text-foreground">
          {formatInteger(row.usuariosActivos)}
        </span>
        <span className="text-muted-foreground">Volumen</span>
        <span className="text-right text-foreground">
          {formatCOP(row.volumen)}
        </span>
      </div>
    </div>
  );
}

export function ActivityTimelineV2({ data, granularity }: Props) {
  if (data.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin datos suficientes para tendencia. Ampliá el período.
      </p>
    );
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 24, bottom: 8, left: 16 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-border opacity-50"
          />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 12 }}
            tickFormatter={(b: string) => tickFormatter(b, granularity)}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="left"
            allowDecimals={false}
            tickFormatter={(n: number) => formatInteger(n)}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(n: number) => formatCOP(n)}
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            width={90}
          />
          <Tooltip
            content={<ActivityTooltip granularity={granularity} />}
            cursor={{ stroke: "currentColor", strokeOpacity: 0.1 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="usuariosActivos"
            name="Usuarios activos"
            stroke={STROKE_USERS}
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="volumen"
            name="Volumen"
            stroke={STROKE_VOLUMEN}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
