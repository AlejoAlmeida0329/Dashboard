/**
 * DeltaBadge — pure formatting atom for "+12,3%" / "−4,1%" / "—" deltas.
 *
 * Server Component (no `"use client"`). Renders an arrow icon + a percent
 * fraction with an explicit sign prefix, in a color that signals direction:
 *   - up    → emerald (default) / rose (when `inverted`, i.e. latency)
 *   - down  → rose    (default) / emerald (when `inverted`, i.e. latency)
 *   - flat  → muted-foreground
 *
 * No prior or zero/non-finite prior → renders an em-dash. This matches the
 * `pctChange` null-when-undefined contract from `period.ts` and Pitfall 9
 * (single Intl gate via `formatPercent`).
 *
 * Why an `inverted` prop?
 *   The "latencia destacada" hecho curado wants LOWER values to read as
 *   GREEN (faster payouts = better). Default direction (used by all 5 KPI
 *   cards) keeps higher = green. Inverted swaps the semantic mapping
 *   without duplicating the icon-and-color logic.
 *
 * Pitfall 9 (single Intl gate): `formatPercent` is the only path used to
 * render the percentage; `Intl.NumberFormat` is never instantiated here.
 */

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { formatPercent } from "@/lib/format";

type Props = {
  /** Current period value. */
  current: number;
  /** Prior period value, or null when no prior is computable. */
  prior: number | null;
  /**
   * If true, swap up/down colors so that DOWN reads as green (improvement).
   * Used by the latency hecho curado where lower P50 = better.
   * Defaults to false (higher = green, the dashboard-wide convention).
   */
  inverted?: boolean;
};

export function DeltaBadge({ current, prior, inverted = false }: Props) {
  if (prior === null || !Number.isFinite(prior) || prior === 0) {
    return (
      <span className="text-xs text-muted-foreground tabular-nums">—</span>
    );
  }

  const change = (current - prior) / prior; // fraction
  const sign = change > 0 ? "up" : change < 0 ? "down" : "flat";

  const Icon =
    sign === "up" ? ArrowUpRight : sign === "down" ? ArrowDownRight : Minus;

  // Default: up=emerald, down=rose. Inverted: swap (latency improvement).
  const upColor = inverted
    ? "text-rose-600 dark:text-rose-400"
    : "text-emerald-600 dark:text-emerald-400";
  const downColor = inverted
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
  const colorClass =
    sign === "up" ? upColor : sign === "down" ? downColor : "text-muted-foreground";

  // formatPercent renders the magnitude; we manually prefix the sign because
  // Intl es-CO percent style does NOT auto-add "+".
  const display = formatPercent(Math.abs(change));
  const prefix = sign === "up" ? "+" : sign === "down" ? "−" : "";

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums ${colorClass}`}
    >
      <Icon className="h-3 w-3" />
      {prefix}
      {display}
    </span>
  );
}
