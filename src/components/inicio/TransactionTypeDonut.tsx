"use client";

/**
 * TransactionTypeDonut — INI-V2-04 distribution by transaction type.
 *
 * Client Component (Recharts ResponsiveContainer needs DOM access for the
 * window resize listener). The wrapping page stays a Server Component;
 * this leaf is the only piece that hydrates.
 *
 * Renders a `PieChart` with `Pie`/`Cell`/`Tooltip`/`Legend`. Top 6 typed
 * tipos plus a rolled-up "Otros" tail (the domain layer
 * `aggregateTransactionTypeDistribution` already does the rollup; this leaf
 * just visualizes).
 *
 * Color palette — 7 OKLCH fills anchored on the section-inicio Indigo
 * hue (~250). Each fill is a pinned literal so dark mode renders correctly
 * without theme classes (mirror of BonosFlowChart / RecargasTrendChartV2
 * convention — Recharts doesn't compose Tailwind opacity gracefully on
 * `<Cell fill=...>`):
 *   slot 0  → oklch(0.55 0.18 250)  Indigo (section accent hue)
 *   slot 1  → oklch(0.62 0.16 230)  Blue
 *   slot 2  → oklch(0.55 0.16 200)  Teal
 *   slot 3  → oklch(0.62 0.14 175)  Aqua
 *   slot 4  → oklch(0.55 0.14 150)  Green
 *   slot 5  → oklch(0.62 0.12 90)   Olive
 *   slot 6  → oklch(0.6  0.05 250)  Muted Indigo — RESERVED for "Otros"
 *                                   (low-chroma so the tail visually reads
 *                                   as background, not a peer of the typed
 *                                   buckets).
 *
 * Localization (Spanish UX strings):
 *   The raw `tipo` enum values are anglicisms (BONUS, P2P, PAYIN_PSE, etc.);
 *   we render Spanish labels in the tooltip + legend. Unknown future values
 *   fall back to the raw enum — defensive against a Sheet edit landing a
 *   new tipo before this map is updated.
 *
 * Empty input handling:
 *   `buckets.length === 0` → render a friendly muted-foreground line. Recharts
 *   would otherwise show a confusing empty disk. Same empty-state idiom
 *   as PurchaseTrendChart / RecargasTrendChartV2.
 *
 * Format gates: tooltip values via `@/lib/format` (formatInteger,
 * formatPercent).
 */

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { TransactionTypeBucket } from "@/lib/domain/inicio";
import { formatInteger, formatPercent } from "@/lib/format";

const COLORS = [
  "oklch(0.55 0.18 250)", // Indigo (section accent)
  "oklch(0.62 0.16 230)", // Blue
  "oklch(0.55 0.16 200)", // Teal
  "oklch(0.62 0.14 175)", // Aqua
  "oklch(0.55 0.14 150)", // Green
  "oklch(0.62 0.12 90)", // Olive
] as const;
const COLOR_OTROS = "oklch(0.6 0.05 250)"; // Muted Indigo for the tail bucket.

const TIPO_LABEL_ES: Record<string, string> = {
  BONUS: "Bonos",
  P2P: "P2P",
  PAYIN_PSE: "Recarga PSE",
  PAYIN_TRANSFER: "Recarga Transfer",
  PAYOUT_BANK: "Retiro a banco",
  PURCHASE: "Compra tarjeta",
  FEE: "Comisión",
  REFUND: "Reverso",
  CREDIT_ADJUSTMENT: "Ajuste",
  TREASURY: "Tesorería",
  UKNOWN: "Desconocido",
  OTRO: "Otro",
  Otros: "Otros",
};

const tipoLabel = (tipo: string): string => TIPO_LABEL_ES[tipo] ?? tipo;

type Props = {
  buckets: TransactionTypeBucket[];
};

type TooltipPayload = {
  payload?: TransactionTypeBucket;
  value?: number;
};

function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="rounded-md border bg-background p-3 text-xs shadow-sm">
      <div className="mb-1 font-medium text-foreground">
        {tipoLabel(row.tipo)}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Conteo</span>
        <span className="text-right text-foreground">
          {formatInteger(row.count)}
        </span>
        <span className="text-muted-foreground">Porcentaje</span>
        <span className="text-right text-foreground">
          {formatPercent(row.share)}
        </span>
      </div>
    </div>
  );
}

export function TransactionTypeDonut({ buckets }: Props) {
  if (buckets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin transacciones en el período.
      </p>
    );
  }

  // Map each bucket to a localized display name for Recharts' Legend.
  const data = buckets.map((b) => ({ ...b, label: tipoLabel(b.tipo) }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((entry, index) => {
              const fill =
                entry.tipo === "Otros"
                  ? COLOR_OTROS
                  : COLORS[index % COLORS.length];
              return <Cell key={entry.tipo} fill={fill} />;
            })}
          </Pie>
          <Tooltip content={<DonutTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "0.75rem" }}
            iconType="circle"
            verticalAlign="bottom"
            height={36}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
