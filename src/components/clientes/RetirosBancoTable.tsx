/**
 * RetirosBancoTable — enriched payouts table for the cliente dossier
 * (CLI-V2-03).
 *
 * Server Component. Receives a pre-filtered list of `JoinedPayout` (the
 * page composition runs `joinPayouts(allTx, allPayouts)` ONCE and narrows
 * the result to `transaction.empresa_id === tikintag` before passing it
 * here — same one-JOIN-per-request budget as Plan 07-04).
 *
 * Columns (left to right):
 *   1. Fecha           — `formatBogotaDate(p.fecha)`
 *   2. Holder          — raw `p.holder` (cardholder name; NOT a tikintag —
 *                        Pay-V2-08 third-party detection idiom carried over)
 *   3. Banco           — Title-cased `p.medium` ("bancolombia" → "Bancolombia")
 *   4. Monto           — `formatCOP(p.monto)`
 *   5. Tiempo / Aging  — `formatMinutes` of `latencySeconds / 60`. Decimals:
 *                        completed → "Total Time", failed/in_progress →
 *                        "Aging" fallback (Phase 3 schema-level convention).
 *   6. Estado          — colored badge (verde/amber/rojo per status palette)
 *   7. Razón de fallo  — `p.failureReason ?? "—"`. Carries
 *                        `data-presenter-metric-hide` on `<th>` + `<td>` so
 *                        the column collapses in presenter mode (CONTEXT.md
 *                        essentials: "razones de fallo crudas en presenter
 *                        ves 'Failed: 3'; en interno ves la columna completa").
 *
 * Sort: descending by `fecha` (most-recent first). The page composition is
 * expected to feed the leaf the already-narrowed array; this component does
 * the final sort here so the leaf is self-contained for any caller.
 *
 * Empty state: `payouts.length === 0` → muted-foreground placeholder
 * "Sin retiros para este tikintag en el período". Card chrome stays for
 * layout stability across filter changes — same convention as
 * `MethodSplitCard` and `KPICardsCardUsage` empty states.
 *
 * Raw `<table>` markup convention reaffirmed: no shadcn `ui/table`
 * primitive in this repo (Plan 07-02 deviation reaffirmed across phases).
 *
 * Cliente-foco contract: the failure-reason cells are the ONLY presenter-hide
 * tagged cells in this component. The rest stay visible to clients in
 * presenter mode (the table is a value-prop "everything we see, you see"
 * surface — except for the raw bank rejection strings which are operator-
 * only context).
 *
 * Format gates: all COP / minute / date values via `@/lib/format`. ZERO
 * `Intl.NumberFormat` / `toLocaleString` here.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { JoinedPayout } from "@/lib/domain/join";
import type { PayoutState } from "@/lib/domain/types";
import { formatBogotaDate, formatCOP, formatMinutes } from "@/lib/format";

type Props = {
  payouts: JoinedPayout[];
};

/**
 * Convert a `Payout.medium` bank code to a Title-cased display label.
 * Inline 3-line helper (no new utility module — same precedent as
 * `AgingAlert`'s `displayBancoName` and `TopBancos`'s helper).
 */
function displayBanco(code: string): string {
  if (!code || code === "OTRO_MEDIUM") return "Sin medio";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Status badge accent classes per the v2 status palette (Phase 6 Plan 04).
 * `OTRO_STATE` defensively renders as muted (a never-seen state should
 * surface but not assert green/red).
 */
function statusBadge(state: PayoutState): { label: string; cls: string } {
  switch (state) {
    case "completed":
      return {
        label: "Completado",
        cls: "bg-status-success/10 text-status-success",
      };
    case "in_progress":
      return {
        label: "En curso",
        cls: "bg-status-pending/10 text-status-pending",
      };
    case "failed":
      return { label: "Falló", cls: "bg-status-fail/10 text-status-fail" };
    default:
      return {
        label: state,
        cls: "bg-muted text-muted-foreground",
      };
  }
}

export function RetirosBancoTable({ payouts }: Props) {
  // Defensive sort copy (page comp likely already sorted; cheap to redo).
  const rows = [...payouts].sort(
    (a, b) => b.fecha.getTime() - a.fecha.getTime(),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retiros banco</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sin retiros para este tikintag en el período seleccionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Holder</th>
                  <th className="pb-2 font-medium">Banco</th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Monto
                  </th>
                  <th className="pb-2 text-right font-medium tabular-nums">
                    Tiempo
                  </th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th
                    className="pb-2 font-medium"
                    data-presenter-metric-hide
                  >
                    Razón de fallo
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const badge = statusBadge(p.state);
                  const minutes = Number.isFinite(p.latencySeconds)
                    ? p.latencySeconds / 60
                    : 0;
                  return (
                    <tr
                      key={p.internalId}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="py-2 tabular-nums">
                        {formatBogotaDate(p.fecha)}
                      </td>
                      <td
                        className="max-w-[220px] truncate py-2"
                        title={p.holder}
                      >
                        {p.holder || "—"}
                      </td>
                      <td className="py-2">{displayBanco(p.medium)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCOP(p.monto)}
                      </td>
                      <td className="py-2 text-right tabular-nums font-mono text-muted-foreground">
                        {formatMinutes(minutes)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td
                        className="max-w-[280px] truncate py-2 text-xs text-muted-foreground"
                        title={p.failureReason ?? "—"}
                        data-presenter-metric-hide
                      >
                        {p.failureReason ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
