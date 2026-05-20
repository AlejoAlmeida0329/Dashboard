"use client";

/**
 * RetirosBancoTable — tabla de payouts enriquecida del dossier Vista Cliente
 * (CLI-V2-03).
 *
 * Client Component. Recibe el conjunto histórico de `JoinedPayout` ya
 * narrowed a `transaction.empresa_id === tikintag`; la página corre
 * `joinPayouts(allTx, allPayouts)` UNA sola vez y filtra antes de pasar acá.
 *
 * Pagina del lado del cliente: 10 filas por página, control Prev/Next.
 *
 * Columnas: Fecha · Holder · Banco · Monto · Tiempo · Estado · Razón de fallo
 * (la última con `data-presenter-metric-hide` para colapsar en presenter).
 *
 * Formato vía `@/lib/format`. Sin `Intl.NumberFormat` / `toLocaleString` aquí.
 */

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaginationFooter } from "@/components/clientes/PaginationFooter";
import { SlaBadge } from "@/components/payouts/SlaBadge";
import { payoutBusinessMinutes } from "@/lib/business-hours";
import type { JoinedPayout } from "@/lib/domain/join";
import type { PayoutState } from "@/lib/domain/types";
import { formatBogotaDate, formatCOP, formatMinutes } from "@/lib/format";

const PAGE_SIZE = 10;

type Props = {
  payouts: JoinedPayout[];
};

function displayBanco(code: string): string {
  if (!code || code === "OTRO_MEDIUM") return "Sin medio";
  return code
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
  const rows = useMemo(
    () => [...payouts].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()),
    [payouts],
  );

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos retiros a banco</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sin retiros para este tikintag en el período seleccionado.
          </p>
        ) : (
          <>
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
                      Tiempo (Crudo)
                    </th>
                    <th className="pb-2 font-medium">Tiempo (Hábil)</th>
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
                  {slice.map((p) => {
                    const badge = statusBadge(p.state);
                    const minutes = Number.isFinite(p.latencySeconds)
                      ? p.latencySeconds / 60
                      : 0;
                    const businessMinutes = payoutBusinessMinutes(
                      p.fecha,
                      p.latencySeconds,
                    );
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
                          {p.state === "completed" ? (
                            <SlaBadge businessMinutes={businessMinutes} />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
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
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              total={rows.length}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
