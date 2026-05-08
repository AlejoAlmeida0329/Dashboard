/**
 * P2PCards — Transferencias P2P enviadas/recibidas para tikintag (CLI-V2-05).
 *
 * Server Component. Consumes `ClienteP2P` from Plan 09-01 (the page
 * composition runs `aggregateClienteP2P(allTx, tikintag, filters)` and
 * threads the result here).
 *
 * Layout — TWO sections in one logical group:
 *
 *   1. Header: 2-card grid (1 → 2 cols)
 *      - Recibidas: countIn (PRIMARY headline) · monto recibido
 *      - Enviadas:  countOut (PRIMARY headline) · monto enviado
 *
 *   2. Detail: raw `<table>` "Últimas P2P" capped at 50 rows (the cap is
 *      enforced at the domain layer per Plan 09-01 — `aggregateClienteP2P`
 *      slices to 50). Columns:
 *
 *        Fecha · Dirección · Contraparte · Monto · Estado
 *
 *      - Dirección renders "Recibida" (in, text-status-success) /
 *        "Enviada" (out, text-foreground). Color asymmetry reads as
 *        "money in is good news, money out is neutral".
 *      - Contraparte: `row.contraparte ?? "—"` rendered with `font-mono`
 *        because tikintags are `$`-prefixed strings (visually a-tag).
 *      - Monto: `formatCOP(Math.abs(row.monto))` — sign is encoded in
 *        Dirección, not in the amount cell.
 *      - Estado: same status badge palette as `RetirosBancoTable` (Plan
 *        09-02 Task 1) — completed/in_progress/failed/rejected color map.
 *
 * Note about counter vs row semantics (Plan 09-01 design decision):
 *   - Counters honor `filters.status` (default `["completed"]`) so the
 *     headline numbers reflect "money actually moved".
 *   - Rows include ALL statuses so the table surfaces attempted-but-failed
 *     transfers (operator dossier value-prop).
 *   This split is intentional; the leaf simply renders what the domain emits.
 *
 * Empty state: `p2p.rows.length === 0` → muted-foreground placeholder under
 * the cards "Sin P2P para este tikintag en el período". Cards keep their
 * zero contents (countIn/countOut may both be 0 already → cards render "0";
 * cards never collapse so the layout stays stable).
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes — P2P transfers
 * (counts + table) are visible to clients in presenter mode. The dossier
 * value-prop ("we see this, you see this") favors visibility; raw status
 * codes are still rendered as Spanish-labelled badges so failed P2Ps are
 * legible without bank-internal jargon.
 *
 * Format gates: all COP / integer / date values via `@/lib/format`.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ClienteP2P, ClienteP2PRow } from "@/lib/domain/cliente";
import { formatBogotaDate, formatCOP, formatInteger } from "@/lib/format";

type Props = {
  p2p: ClienteP2P;
};

/**
 * P2P row status badge — mirrors `RetirosBancoTable.statusBadge` but works
 * over the broader Transaction.status alphabet (BD_Plataforma carries
 * "completed", "rejected", "OTRO_STATUS" etc., not the BD_Payouts state
 * lifecycle).
 */
function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case "completed":
      return {
        label: "Completada",
        cls: "bg-status-success/10 text-status-success",
      };
    case "rejected":
      return { label: "Rechazada", cls: "bg-status-fail/10 text-status-fail" };
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

export function P2PCards({ p2p }: Props) {
  return (
    <div className="space-y-4">
      {/* 1. Cards header — Recibidas / Enviadas */}
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

      {/* 2. Detail table — Últimas P2P */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas P2P</CardTitle>
          <CardDescription>
            Hasta 50 transacciones, todas las estados, fecha descendente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {p2p.rows.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              Sin P2P para este tikintag en el período seleccionado.
            </p>
          ) : (
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
                  {p2p.rows.map((row, i) => (
                    <P2PRow key={`${row.fecha.getTime()}-${i}`} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function P2PRow({ row }: { row: ClienteP2PRow }) {
  const badge = statusBadge(row.status);
  const isIn = row.direction === "in";
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/40">
      <td className="py-2 tabular-nums">{formatBogotaDate(row.fecha)}</td>
      <td className="py-2">
        <span
          className={
            isIn
              ? "text-status-success"
              : "text-foreground"
          }
        >
          {isIn ? "Recibida" : "Enviada"}
        </span>
      </td>
      <td
        className="max-w-[200px] truncate py-2 font-mono"
        title={row.contraparte ?? "—"}
      >
        {row.contraparte ?? "—"}
      </td>
      <td className="py-2 text-right tabular-nums">
        {formatCOP(Math.abs(row.monto))}
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
}
