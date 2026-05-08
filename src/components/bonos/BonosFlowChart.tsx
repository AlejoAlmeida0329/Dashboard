"use client";

/**
 * Line timeline — Client Component (BON-V2-07).
 *
 * Plots `countOut` (bonos enviados) per Bogotá day as a single line.
 * Replaces the v2 stacked-bar chart now that v2 Bonos is OUT-only.
 *
 * Color: section-bonos hue (`oklch(0.50 0.20 295)`), pinned in JS for
 * Recharts compatibility (theme variable lifts apply only to dark mode
 * via CSS, but the JS-pinned shade is comfortably visible in both).
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

import type { BonoByDateV2 } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

const STROKE = "oklch(0.50 0.20 295)";

type Props = {
  data: BonoByDateV2[];
};

type TooltipPayload = {
  payload?: BonoByDateV2;
  value?: number;
};

function FlowTooltip({
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
        <span className="text-muted-foreground">Enviados</span>
        <span className="text-right text-foreground">
          {formatInteger(row.countOut)}
        </span>
        <span className="text-muted-foreground">$ enviado</span>
        <span className="text-right text-foreground">
          {formatCOP(row.montoOut)}
        </span>
      </div>
    </div>
  );
}

export function BonosFlowChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin actividad en el período
      </p>
    );
  }

  return (
    <div className="h-[280px] w-full">
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
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(n: number) => formatInteger(n)}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip content={<FlowTooltip />} />
          <Line
            type="monotone"
            dataKey="countOut"
            name="Enviados"
            stroke={STROKE}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
