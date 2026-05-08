/**
 * Inicio page — v2 operative-lens cockpit (Plan 10-02).
 *
 * Vision (10-CONTEXT.md essentials + INI-V2-01..06):
 *   First scroll = "¿quién usa la plataforma y cuánto fluye, con qué éxito?"
 *   (3-card KPI strip: Usuarios activos w/ Indigo accent · Volumen IN/OUT ·
 *   Tasa de éxito w/ semáforo). Second scroll = diagnostic protagonists
 *   (donut por tipo + actividad temporal side by side at lg breakpoint).
 *   Third scroll = top 10 usuarios por volumen neto. The first scroll alone
 *   already carries the operative-health story; the diagnostic layers add
 *   color but the headline answer is immediate.
 *
 *   This is the v1→v2 lens shift catalogued in STATE.md and Phase 10 PRD:
 *   - v1 was REVENUE-focused (GMV / comisión / take rate / empresas activas
 *     / bonos vendidos + 3 hechos curados editorial reel).
 *   - v2 is OPERATIVE-focused (usuarios activos by tikintag, volumen
 *     direction-split, tasa de éxito semáforo, tipo distribution, activity
 *     time series, top 10 users by volumen neto). All v1 leaves + the
 *     hechos curados domain module are deleted in Task 3 of this same plan.
 *
 * Pipeline (per request):
 *   1. Read URL filters via `parseFilters(searchParams)` (Plan 06-03 contract).
 *   2. Fetch transactions via `getCachedTransactions` — the same call
 *      `DashboardHeader` makes; React `cache()` dedupes the Sheets API
 *      roundtrip so chrome and page share a single fetch per request. NO
 *      payouts fetch — v2 Inicio's tasa de éxito is computed over the
 *      transactions' `status` field (NOT payout state) per `summarizeInicioV2`.
 *   3. Apply `filterInicioV2` (Plan 10-01): cross-cut filter — both
 *      directions, all tipos by default; CSV multi-select narrows on demand.
 *      ONE filter pass feeds all four aggregations below.
 *   4. Bucket granularity: ≤60 days → daily, >60 days → weekly. Same
 *      threshold rule the v1 page used (the only utility that survives the
 *      lens shift — operators read range duration the same way regardless
 *      of which metrics are on the page).
 *   5. Run four v2 aggregations:
 *        - `summarizeInicioV2`                     → 3-card KPI header
 *        - `aggregateTransactionTypeDistribution`  → donut data (top 6 + Otros)
 *        - `aggregateActivityByDateV2/ByWeekV2`    → activity timeline
 *        - `aggregateTopUsersByVolume`             → top 10 users table
 *   6. Render the cockpit per layout below. KPIStrip + TopUsersByVolume are
 *      Server Components; TransactionTypeDonut + ActivityTimelineV2 hydrate
 *      because Recharts requires DOM access.
 *
 * Decommissioned features (intentionally NOT carried to v2 — Plan 10-02
 * contract):
 *   - Prior-period KPI badges (`computePriorPeriod` + `InicioDeltaSummary`
 *     + `DeltaBadge` deltas). PRD lens shift: INI-V2 requirements describe
 *     absolute numbers, not deltas (mirror Plan 08-04 `recargas` page
 *     decision).
 *   - Hechos curados (top empresa GMV / empresas nuevas activadas /
 *     latencia destacada). PRD pivots to operative lens; the editorial
 *     highlight reel does not appear in INI-V2-01..06.
 *
 * Cliente-foco contract:
 *   NO `data-presenter-*` attributes here per Plan 10-02 conservative-default
 *   policy (CROSS-V2-07). The v2 metric set is intentionally non-sensitive:
 *   tasa de éxito is the value-prop, not a secret. The empresa filter still
 *   works (filterInicioV2 honors `filters.empresa`); the cliente-foco
 *   share-URL was retargeted to `/clientes/{tikintag}` in Plan 09-03, so
 *   /inicio is no longer the cliente landing page.
 *
 * Phase deferred-prune docket closed by this plan:
 *   Plan 10-02 Task 3 prunes the v1 `inicio.ts` block (filterCompletedIn +
 *   summarizeInicio + 4 GMV/empresa aggregations + 4 v1 types), the entire
 *   `inicio-hechos.ts` module, and the 4 v1 `payouts.ts` symbols
 *   (filterPayouts, summarizePayouts, PayoutSummary, COMPLETED_PAYOUT_STATES)
 *   that have been kept alive since Phase 7-04 specifically to back the v1
 *   Inicio "latencia destacada" hecho. With this plan that hecho is gone,
 *   so the symbols can finally die — the Phase 7-04 deferral docket closes
 *   together with the v1 inicio block.
 *
 * Rendering rules:
 *   - `dynamic = 'force-dynamic'` — fresh per-request Sheets read per
 *     PROJECT.md "lectura en vivo en cada carga".
 *   - `searchParams` is a `Promise<...>` per Next 16's signature change.
 *   - `verifySession()` is NOT called here — the `(protected)` route
 *     group's layout already guards the entire subtree.
 *
 * Error / empty handling:
 *   - If `getCachedTransactions()` throws (creds missing, schema drift,
 *     transient 429), we render an inline `<Card>` with the underlying
 *     error message rather than letting the route group's `error.tsx`
 *     swallow it (mirror of recargas/page.tsx).
 *   - If the filtered universe is empty, each leaf renders its own
 *     zero-state placeholder. The page does NOT short-circuit — preserves
 *     layout consistency.
 */

import { differenceInCalendarDays } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ActivityTimelineV2 } from "@/components/inicio/ActivityTimelineV2";
import { InicioKPIStripV2 } from "@/components/inicio/InicioKPIStripV2";
import { TopUsersByVolume } from "@/components/inicio/TopUsersByVolume";
import { TransactionTypeDonut } from "@/components/inicio/TransactionTypeDonut";

import {
  aggregateActivityByDateV2,
  aggregateActivityByWeekV2,
  aggregateTopUsersByVolume,
  aggregateTransactionTypeDistribution,
  filterInicioV2,
  summarizeInicioV2,
} from "@/lib/domain/inicio";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Inicio · Tikin Dashboard",
};

// Fresh per-request: depends on URL state and on a live Sheets read.
export const dynamic = "force-dynamic";

type PageProps = {
  // Next 16: searchParams is a Promise on the Server Component signature.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InicioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let txResult;
  try {
    txResult = await getCachedTransactions();
  } catch (err) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No pudimos leer el Sheet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {err instanceof Error
              ? err.message
              : "Error desconocido al leer transacciones."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const allTx = txResult.rows;

  // ONE filter pass feeds all four aggregations.
  const inicioRows = filterInicioV2(allTx, filters);

  // Bucket granularity: ≤60 days → daily, >60 days → weekly. Default
  // (no from/to) is 30 days so daily buckets render on the unfiltered land.
  const length =
    filters.from && filters.to
      ? differenceInCalendarDays(
          new Date(`${filters.to}T00:00:00-05:00`),
          new Date(`${filters.from}T00:00:00-05:00`),
        ) + 1
      : 30;
  const granularity: "day" | "week" = length > 60 ? "week" : "day";

  // summarizeInicioV2 takes BOTH the filtered rows (period-scoped counters)
  // AND the full transaction pool (for the `usuariosTotal` denominator —
  // the "alcance histórico" 235 baseline used in the leaf KPI's "X / Y
  // usuarios totales" caption). Plan 10-04 fix.
  const summary = summarizeInicioV2(inicioRows, allTx);
  const tipoDistribution = aggregateTransactionTypeDistribution(inicioRows, 6);
  const activitySeries =
    granularity === "week"
      ? aggregateActivityByWeekV2(inicioRows)
      : aggregateActivityByDateV2(inicioRows);
  const topUsers = aggregateTopUsersByVolume(inicioRows, 10);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl">Inicio</h1>
        <p className="text-sm text-muted-foreground">
          Lente operativa ·{" "}
          {granularity === "week" ? "vista semanal" : "vista diaria"}
        </p>
      </header>

      {/* KPI strip — 3 cards: usuarios activos (Indigo accent) · volumen IN/OUT · tasa de éxito (semáforo). */}
      <InicioKPIStripV2 summary={summary} />

      {/* Diagnostic protagonists — distribución por tipo | actividad temporal. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribución por tipo de transacción</CardTitle>
          </CardHeader>
          <CardContent>
            <TransactionTypeDonut buckets={tipoDistribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Actividad en el tiempo{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({granularity === "week" ? "semanal" : "diario"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityTimelineV2
              data={activitySeries}
              granularity={granularity}
            />
          </CardContent>
        </Card>
      </div>

      {/* Top users ranking — by tikintag (NOT empresa per INI-V2-06). */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 usuarios por volumen</CardTitle>
        </CardHeader>
        <CardContent>
          <TopUsersByVolume rows={topUsers} />
        </CardContent>
      </Card>
    </div>
  );
}
