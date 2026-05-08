/**
 * ClienteKPIHeader — section cabecera (CLI-V2-02 + CLI-V2-07).
 *
 * Server Component. Renders the 6-KPI strip that opens the Vista Cliente
 * dossier. Per the Phase 9 CONTEXT.md essentials:
 *   "Cabecera de 6 KPIs perfecta en 2 segundos — Balance · Primera tx ·
 *    Última actividad · Total tx · Pocket activo · Tiempo vs benchmark
 *    (con treatment especial: color/borde que lo distingue del resto).
 *    Si el header no es legible y jerárquico al instante, el resto del
 *    dossier no importa."
 *
 * Layout: a single `<Card>` containing a 6-column responsive grid (2 → 3 → 6
 * cols). Each KPI is a stat block with a description label, a heading-typed
 * value, and an optional sub-text line.
 *
 * The benchmark KPI (#6) is the "argument of eficiencia" per CLI-V2-07 — the
 * value-prop number that tells the client "vos ves esto y entendés que somos
 * más rápidos que el promedio". It receives the section accent treatment:
 *
 *   - `border-l-4 border-section-clientes pl-3` on its column (Emerald
 *     accent stripe — Phase 6 Plan 04 OKLCH paleta).
 *   - Subtext renders the deltaMinutes framing with semáforo:
 *       deltaMinutes < 0  → "X más rápido que el promedio"  + text-status-success
 *       deltaMinutes > 0  → "X más lento que el promedio"   + text-status-fail
 *       deltaMinutes == 0 → "Igual al promedio"             + text-muted-foreground
 *   - Sample-size micro-line (cliente vs platform N) renders for transparency
 *     when both samples > 0; collapses when either sample is 0 (no benchmark
 *     possible — the empty-period signal).
 *
 * One-section-accent-per-page rule (Plan 08-02 codified, reaffirmed here):
 *   The benchmark KPI is the ONLY card on the page that uses
 *   `text-section-clientes` / `border-section-clientes`. The other 5 stat
 *   blocks use `text-foreground` for the headline value (with the small
 *   "Pocket activo" exception below). The page composition (Plan 09-03) MUST
 *   NOT add a second section accent to compete.
 *
 * Pocket activo color exception: `true` renders in `text-status-success`
 * (status palette green from Plan 06-04, NOT the section accent — different
 * green, different role); `false` renders in `text-muted-foreground` to read
 * as a quiet absence rather than a competing alert. This keeps the
 * "one-section-accent" rule intact.
 *
 * Presenter visibility: ALL 6 KPIs are visible in presenter mode per
 * CONTEXT.md essentials ("Tiempo vs benchmark... siempre visible en
 * presenter") — NO `data-presenter-metric-hide` attributes anywhere in
 * this component.
 *
 * Format gates: all COP / integer / minute values flow through `@/lib/format`.
 * Date values use `formatBogotaDate`. ZERO `Intl.NumberFormat` /
 * `toLocaleString` here.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ClienteBenchmark,
  ClienteSummary,
} from "@/lib/domain/cliente";
import {
  formatBogotaDate,
  formatCOP,
  formatInteger,
  formatMinutes,
} from "@/lib/format";

type Props = {
  summary: ClienteSummary;
  benchmark: ClienteBenchmark;
};

export function ClienteKPIHeader({ summary, benchmark }: Props) {
  // Pre-compute the benchmark framing strings + color class so the JSX stays
  // flat. The semáforo here is delta-sign-driven (faster=green, slower=red),
  // independent of the section accent.
  const delta = benchmark.deltaMinutes;
  const benchmarkValue = formatMinutes(Math.abs(delta));
  let benchmarkSubText: string;
  let benchmarkSubClass: string;
  if (benchmark.clienteSampleSize === 0 || benchmark.platformSampleSize === 0) {
    benchmarkSubText = "Sin datos suficientes";
    benchmarkSubClass = "text-muted-foreground";
  } else if (delta < 0) {
    benchmarkSubText = `${benchmarkValue} más rápido que el promedio`;
    benchmarkSubClass = "text-status-success";
  } else if (delta > 0) {
    benchmarkSubText = `${benchmarkValue} más lento que el promedio`;
    benchmarkSubClass = "text-status-fail";
  } else {
    benchmarkSubText = "Igual al promedio";
    benchmarkSubClass = "text-muted-foreground";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{summary.empresa_nombre}</CardTitle>
        <CardDescription className="font-mono">
          {summary.tikintag}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {/* 1. Balance */}
          <Stat
            label="Balance"
            value={formatCOP(summary.balance)}
            subText="Suma de completados"
          />

          {/* 2. Primera tx */}
          <Stat
            label="Primera tx"
            value={
              summary.primeraTx ? formatBogotaDate(summary.primeraTx) : "—"
            }
            subText="Histórico"
          />

          {/* 3. Última actividad */}
          <Stat
            label="Última actividad"
            value={
              summary.ultimaActividad
                ? formatBogotaDate(summary.ultimaActividad)
                : "—"
            }
            subText="Recibido completado"
          />

          {/* 4. Total tx */}
          <Stat
            label="Total tx"
            value={formatInteger(summary.totalTx)}
            subText="Histórico"
          />

          {/* 5. Pocket activo */}
          <Stat
            label="Pocket activo"
            value={summary.pocketActivo ? "Sí" : "No"}
            valueClassName={
              summary.pocketActivo
                ? "text-status-success"
                : "text-muted-foreground"
            }
            subText="Últimos 30 días"
          />

          {/* 6. Tiempo vs benchmark — section accent + semáforo */}
          <Stat
            label="Tiempo vs benchmark"
            value={
              benchmark.clienteSampleSize === 0 ||
              benchmark.platformSampleSize === 0
                ? "—"
                : benchmarkValue
            }
            valueClassName="text-section-clientes"
            variant="benchmark"
            subText={benchmarkSubText}
            subTextClassName={benchmarkSubClass}
            footer={
              benchmark.clienteSampleSize > 0 &&
              benchmark.platformSampleSize > 0
                ? `${formatInteger(benchmark.clienteSampleSize)} vs ${formatInteger(
                    benchmark.platformSampleSize,
                  )} payouts`
                : undefined
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

// --- Inline stat-block helper ---------------------------------------------

type StatProps = {
  label: string;
  value: string;
  valueClassName?: string;
  subText?: string;
  subTextClassName?: string;
  footer?: string;
  variant?: "default" | "benchmark";
};

/**
 * Stat block primitive — keeps the 6 KPIs on the same shape so the column
 * grid aligns. The `variant="benchmark"` adds the section-accent stripe per
 * CLI-V2-07 visual distinction.
 */
function Stat({
  label,
  value,
  valueClassName,
  subText,
  subTextClassName,
  footer,
  variant = "default",
}: StatProps) {
  const wrapperClass =
    variant === "benchmark"
      ? "border-l-4 border-section-clientes pl-3"
      : undefined;
  const valueClass =
    valueClassName ?? (variant === "benchmark" ? "text-section-clientes" : "text-foreground");
  const subClass = subTextClassName ?? "text-muted-foreground";
  return (
    <div className={wrapperClass}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-heading text-2xl tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {subText ? (
        <p className={`mt-1 text-xs tabular-nums ${subClass}`}>{subText}</p>
      ) : null}
      {footer ? (
        <p className="mt-0.5 text-[10px] uppercase tracking-wide tabular-nums text-muted-foreground">
          {footer}
        </p>
      ) : null}
    </div>
  );
}
