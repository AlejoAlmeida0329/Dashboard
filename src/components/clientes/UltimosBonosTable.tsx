"use client";

/**
 * UltimosBonosTable — histórico de bonos in/out del tikintag, paginado.
 *
 * Recibe `transactions: Transaction[]` ya filtradas (filterBonosV2 con empresa
 * fijada al tikintag). Las ordena DESC por fecha y pagina de a 10.
 *
 * Columnas: Fecha · Dirección · Contraparte · Monto · Estado.
 * Contraparte:
 *   - direction === "in"  → `sourceTransferTikintag` (remitente)
 *   - direction === "out" → `destinationTransferTikintag` (receptor)
 */

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaginationFooter } from "@/components/clientes/PaginationFooter";
import type { Transaction } from "@/lib/domain/types";
import { formatBogotaDate, formatCOP } from "@/lib/format";

const PAGE_SIZE = 10;

type Props = {
  transactions: Transaction[];
};

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "completed":
      return {
        label: "Completado",
        cls: "bg-status-success/10 text-status-success",
      };
    case "rejected":
      return { label: "Rechazado", cls: "bg-status-fail/10 text-status-fail" };
    case "failed":
      return { label: "Falló", cls: "bg-status-fail/10 text-status-fail" };
    case "in_progress":
      return {
        label: "En curso",
        cls: "bg-status-pending/10 text-status-pending",
      };
    default:
      return {
        label: status || "—",
        cls: "bg-muted text-muted-foreground",
      };
  }
}

function counterparty(t: Transaction): string | undefined {
  return t.direction === "in"
    ? t.sourceTransferTikintag
    : t.destinationTransferTikintag;
}

export function UltimosBonosTable({ transactions }: Props) {
  const rows = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => b.fecha.getTime() - a.fecha.getTime(),
      ),
    [transactions],
  );

  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos bonos</CardTitle>
        <CardDescription>
          Histórico paginado, fecha descendente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sin bonos para este tikintag en el período seleccionado.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Dirección</th>
                    <th className="pb-2 font-medium">Contraparte</th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      Monto
                    </th>
                    <th className="pb-2 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((t, i) => {
                    const badge = statusBadge(t.status);
                    const isIn = t.direction === "in";
                    const cp = counterparty(t);
                    return (
                      <tr
                        key={`${t.fecha.getTime()}-${start + i}`}
                        className="border-b last:border-b-0 hover:bg-muted/40"
                      >
                        <td className="py-2 tabular-nums">
                          {formatBogotaDate(t.fecha)}
                        </td>
                        <td className="py-2">
                          <span
                            className={
                              isIn ? "text-status-success" : "text-foreground"
                            }
                          >
                            {isIn ? "Recibido" : "Enviado"}
                          </span>
                        </td>
                        <td
                          className="max-w-[200px] truncate py-2 font-mono"
                          title={cp ?? "—"}
                        >
                          {cp ?? "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {formatCOP(Math.abs(t.monto))}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
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
