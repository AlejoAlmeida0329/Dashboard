/**
 * RecargasClienteCard — Recargas (PSE + Transfer) del usuario.
 *
 * Server Component. Consume `RecargaSummaryV2` ya filtrado a
 * `empresa_id === tikintag` por la composición de página.
 *
 * Mismo patrón visual que `ComprasClienteCard` y `BonosClienteCards`.
 *
 * Sin esto, las cards no suman al `totalTx` del header (el dossier
 * mostraba bonos + p2p + compras pero NO recargas, dejando un gap).
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RecargaSummaryV2 } from "@/lib/domain/recargas";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  summary: RecargaSummaryV2;
};

export function RecargasClienteCard({ summary }: Props) {
  const hasData = summary.totalRecargas > 0;

  return (
    <Card>
      <CardHeader>
        <CardDescription>Recargas</CardDescription>
        <CardTitle className="font-heading text-3xl tabular-nums">
          {formatInteger(summary.totalRecargas)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Volumen
            </p>
            <p className="text-sm tabular-nums">
              {hasData ? formatCOP(summary.volumenCOP) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ticket promedio
            </p>
            <p className="text-sm tabular-nums">
              {hasData ? formatCOP(summary.recargaPromedio) : "—"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {hasData
            ? "Recargas PSE + Transfer en el período"
            : "Sin recargas en el período"}
        </p>
      </CardContent>
    </Card>
  );
}
