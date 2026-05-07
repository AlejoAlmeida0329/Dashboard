"use client";

/**
 * Stacked-bar timeline — Client Component (Plan 07-02 BON-V2-07).
 *
 * Plots `enviados` (countOut) vs `recibidos` (countIn) per Bogotá day as
 * stacked bars (Recharts BarChart). The chart sits below the rankings as
 * a CONTEXT sub-protagonist (07-CONTEXT.md essentials: rankings dominate
 * the first scroll; the chart explains "when").
 *
 * Color choices (no Tailwind opacity on bars — Recharts doesn't compose
 * Tailwind opacity gracefully on `<Bar fill=...>`; we hard-code two OKLCH
 * shades anchored on the section-bonos hue):
 *   - countOut → darker shade (the "enviados" stack base)
 *   - countIn  → lighter shade (the "recibidos" stack on top)
 *
 * Both shades are pinned to `oklch(L 0.20 295)` with L = 0.50 (darker) and
 * L = 0.65 (lighter); 295° is the Bonos hue established in Plan 06-04. The
 * lift is comfortably visible in both light and dark modes (the .dark CSS
 * already lifts the section vars +0.10 lightness — the chart fills are
 * stable across themes because we don't read CSS vars from JS here).
 *
 * Why a Client Component:
 *   - Recharts ResponsiveContainer needs the actual DOM (window resize).
 *   - The wrapping page stays a Server Component; this leaf is the only
 *     piece that hydrates.
 *
 * Empty state: render a simple <p> instead of an empty Recharts axis frame.
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

import type { BonoByDateV2 } from "@/lib/domain/bonos";
import { formatCOP, formatInteger } from "@/lib/format";

const FILL_OUT = "oklch(0.50 0.20 295)"; // enviados — darker violet
const FILL_IN = "oklch(0.65 0.20 295)"; // recibidos — lighter violet

type Props = {
  data: BonoByDateV2[];
};

type TooltipPayload = {
  payload?: BonoByDateV2;
  dataKey?: string;
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
        <span className="text-muted-foreground">Recibidos</span>
        <span className="text-right text-foreground">
          {formatInteger(row.countIn)}
        </span>
        <span className="text-muted-foreground">Enviados</span>
        <span className="text-right text-foreground">
          {formatInteger(row.countOut)}
        </span>
        <span className="text-muted-foreground">$ recibido</span>
        <span className="text-right text-foreground">
          {formatCOP(row.montoIn)}
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
            className="text-muted-foreground"
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(n: number) => formatInteger(n)}
            tick={{ fontSize: 12 }}
            className="text-muted-foreground"
          />
          <Tooltip content={<FlowTooltip />} cursor={{ fillOpacity: 0.1 }} />
          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
          <Bar
            dataKey="countOut"
            name="Enviados"
            stackId="bonos"
            fill={FILL_OUT}
          />
          <Bar
            dataKey="countIn"
            name="Recibidos"
            stackId="bonos"
            fill={FILL_IN}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
