/**
 * Bonos page — v2 OUT-only cockpit.
 *
 * Pipeline:
 *   1. Read URL filters via `parseFilters(searchParams)`.
 *   2. Fetch transactions via `getCachedTransactions` (shared with chrome).
 *   3. Apply `filterBonosV2` (BONUS rows; default `completed`; date range;
 *      empresa optional).
 *   4. Run aggregations on the OUT-only surface:
 *        - `summarizeBonosV2`        → 3-card KPI header (count, monto, ticket)
 *        - `aggregateBonosByDateV2`  → line timeline
 *        - `aggregateTopEmisores`    → ranking by monto DESC
 *
 * Layout:
 *   1. KPICardsV2 header (3 cards)
 *   2. BonosFlowChart line timeline (CONTEXT — sits above the ranking)
 *   3. TopEmisores ranking (PROTAGONIST)
 */

import { differenceInCalendarDays } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { BonosFlowChart } from "@/components/bonos/BonosFlowChart";
import { KPICardsV2 } from "@/components/bonos/KPICardsV2";
import { TopEmisores } from "@/components/bonos/TopEmisores";

import {
  aggregateBonosByDateV2,
  aggregateBonosByMonthV2,
  aggregateTopEmisores,
  filterBonosV2,
  summarizeBonosV2,
} from "@/lib/domain/bonos";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { parseFilters } from "@/lib/url-state";

export const metadata = {
  title: "Bonos · Tikin Dashboard",
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BonosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let result;
  try {
    result = await getCachedTransactions();
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

  const bonos = filterBonosV2(result.rows, filters);
  const summary = summarizeBonosV2(bonos);

  if (bonos.length === 0) {
    return (
      <div className="space-y-6">
        <KPICardsV2 summary={summary} />
        <Card>
          <CardHeader>
            <CardTitle>Sin bonos en el período seleccionado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Probá ampliando el rango de fechas o quitando el filtro de
              empresa.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Adaptive granularity: ≤60 days → daily; else monthly. With no
  // explicit range the chart shows all-time data and goes monthly.
  const rangeDays =
    filters.from && filters.to
      ? differenceInCalendarDays(
          new Date(`${filters.to}T00:00:00-05:00`),
          new Date(`${filters.from}T00:00:00-05:00`),
        ) + 1
      : Number.POSITIVE_INFINITY;
  const granularity: "day" | "month" = rangeDays > 60 ? "month" : "day";
  const byBucket =
    granularity === "month"
      ? aggregateBonosByMonthV2(bonos)
      : aggregateBonosByDateV2(bonos);
  const topEmisores = aggregateTopEmisores(bonos, 10);

  return (
    <div className="space-y-6">
      <KPICardsV2 summary={summary} />

      <Card>
        <CardHeader>
          <CardTitle>
            Flujo de bonos enviados{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({granularity === "month" ? "mensual" : "diario"})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BonosFlowChart data={byBucket} />
        </CardContent>
      </Card>

      <TopEmisores rows={topEmisores} />
    </div>
  );
}
