"use client";

/**
 * BonosPorFechaTable — bonos emitidos por la empresa agrupados por fecha
 * Bogotá. Reemplaza el listado per-row de `UltimosBonosTable`.
 *
 * Columnas: Fecha · Colaboradores pagados · Bonos · Monto total.
 * Pagina 10 por página. Las filas vienen ya ordenadas DESC por fecha
 * desde el dominio.
 */

import { useState } from "react";

import { PaginationFooter } from "@/components/clientes/PaginationFooter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BonosEmitidosPorFechaRow } from "@/lib/domain/clientes";
import { formatCOP, formatInteger } from "@/lib/format";

const PAGE_SIZE = 10;

type Props = {
  rows: BonosEmitidosPorFechaRow[];
};

/** Formato `YYYY-MM-DD` → `DD/MM/YYYY` (consistente con formatBogotaDate). */
function formatDateKey(key: string): string {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function BonosPorFechaTable({ rows }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bonos por fecha</CardTitle>
        <CardDescription>
          Histórico agrupado por día — colaboradores pagados, cantidad de
          bonos y monto total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sin bonos emitidos por esta empresa.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      Colaboradores pagados
                    </th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      Bonos
                    </th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      Monto total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((r) => (
                    <tr
                      key={r.fecha}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="py-2 tabular-nums">
                        {formatDateKey(r.fecha)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatInteger(r.colaboradoresCount)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatInteger(r.bonosCount)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatCOP(r.montoTotal)}
                      </td>
                    </tr>
                  ))}
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
