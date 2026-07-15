"use client";

/**
 * ColaboradoresNoRegistradosCard — usuarios que recibieron bonos de la empresa
 * pero nunca se registraron en la app.
 *
 * Un "no registrado" es un número celular (no `$username`) que acumula ≥2
 * bonos: el primer bono de todo usuario siempre cae al celular antes de crear
 * su cuenta, así que sólo con 2+ bonos en formato celular tenemos certeza de
 * que nunca se registró. Ver `aggregateColaboradoresNoRegistrados`.
 *
 * KPI grande (cantidad) + tabla paginada de celulares (10/página).
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
import type { ColaboradoresNoRegistrados } from "@/lib/domain/clientes";
import { formatInteger } from "@/lib/format";

const PAGE_SIZE = 10;

type Props = {
  data: ColaboradoresNoRegistrados;
};

export function ColaboradoresNoRegistradosCard({ data }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.celulares.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = data.celulares.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Colaboradores no registrados</CardTitle>
        <CardDescription>
          Colaboradores que no han creado cuenta en Tikin
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums">
            {formatInteger(data.count)}
          </span>
          <span className="text-sm text-muted-foreground">sin registrar</span>
        </div>

        {data.celulares.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Ningún colaborador con 2 o más bonos quedó sin registrarse.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 font-medium">Celular</th>
                    <th className="pb-2 text-right font-medium tabular-nums">
                      Bonos recibidos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {slice.map((c) => (
                    <tr
                      key={c.telefono}
                      className="border-b last:border-b-0 hover:bg-muted/40"
                    >
                      <td className="py-2 font-mono tabular-nums">
                        {c.telefono}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatInteger(c.bonosCount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              total={data.celulares.length}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
