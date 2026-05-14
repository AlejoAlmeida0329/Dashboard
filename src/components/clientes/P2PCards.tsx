/**
 * P2PCards — Cards de resumen P2P recibidas/enviadas para tikintag
 * (CLI-V2-05).
 *
 * Server Component. Consume `ClienteP2P` y renderiza únicamente la fila de
 * dos cards (count + monto). La tabla detallada vive ahora en
 * `UltimasP2PTable` (client component paginado).
 *
 * Formato vía `@/lib/format`.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClienteP2P } from "@/lib/domain/cliente";
import { formatCOP, formatInteger } from "@/lib/format";

type Props = {
  p2p: ClienteP2P;
};

export function P2PCards({ p2p }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardDescription>P2P recibidas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(p2p.countIn)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm tabular-nums">{formatCOP(p2p.montoIn)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completadas en el período
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>P2P enviadas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(p2p.countOut)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm tabular-nums">{formatCOP(p2p.montoOut)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completadas en el período
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
