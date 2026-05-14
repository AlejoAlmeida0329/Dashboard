"use client";

/**
 * TimelineActivity — feed cronológico de eventos del tikintag (CLI-V2-08),
 * client-paginado de a 10.
 *
 * Recibe `ClienteTimelineEvent[]` ya ordenadas DESC por fecha desde el
 * dominio. La página envuelve este leaf en `<div data-presenter-hide>` para
 * ocultar la sección completa en presenter mode.
 */

import { useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CreditCard,
  ShoppingCart,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PaginationFooter } from "@/components/clientes/PaginationFooter";
import type {
  ClienteTimelineEvent,
  ClienteTimelineEventType,
} from "@/lib/domain/cliente";
import { formatBogotaDate, formatCOP } from "@/lib/format";

const PAGE_SIZE = 10;

type Props = {
  events: ClienteTimelineEvent[];
};

type IconComponent = typeof Activity;

function iconAndColor(type: ClienteTimelineEventType): {
  Icon: IconComponent;
  cls: string;
} {
  switch (type) {
    case "BONUS_IN":
      return { Icon: ArrowDownLeft, cls: "text-status-success" };
    case "BONUS_OUT":
      return { Icon: ArrowUpRight, cls: "text-foreground" };
    case "P2P_IN":
      return { Icon: ArrowDownLeft, cls: "text-status-success" };
    case "P2P_OUT":
      return { Icon: ArrowUpRight, cls: "text-foreground" };
    case "PURCHASE":
      return { Icon: ShoppingCart, cls: "text-section-tarjeta" };
    case "RECHARGE_PSE":
      return { Icon: Banknote, cls: "text-section-recargas" };
    case "RECHARGE_TRANSFER":
      return { Icon: Banknote, cls: "text-section-recargas" };
    case "PAYOUT_BANK":
      return { Icon: CreditCard, cls: "text-section-payouts" };
    default:
      return { Icon: Activity, cls: "text-muted-foreground" };
  }
}

function typeLabel(type: ClienteTimelineEventType): string {
  switch (type) {
    case "BONUS_IN":
      return "Bono recibido";
    case "BONUS_OUT":
      return "Bono enviado";
    case "P2P_IN":
      return "P2P recibida";
    case "P2P_OUT":
      return "P2P enviada";
    case "PURCHASE":
      return "Compra tarjeta";
    case "RECHARGE_PSE":
      return "Recarga PSE";
    case "RECHARGE_TRANSFER":
      return "Recarga Transfer";
    case "PAYOUT_BANK":
      return "Retiro banco";
    default:
      return "Otro";
  }
}

function statusBadge(
  status: string,
): { label: string; cls: string } | null {
  switch (status) {
    case "completed":
      return null;
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

function looksLikeTikintag(s: string): boolean {
  return s.startsWith("$");
}

function counterpartyLabel(
  type: ClienteTimelineEventType,
  counterparty: string | undefined,
): string {
  if (type === "PURCHASE") return "Compra tarjeta";
  return counterparty ?? "—";
}

export function TimelineActivity({ events }: Props) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  const slice = events.slice(start, start + PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad cronológica</CardTitle>
        <CardDescription>
          Histórico paginado, fecha descendente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sin actividad registrada para este tikintag en el período
            seleccionado.
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {slice.map((evt, idx) => {
                const { Icon, cls } = iconAndColor(evt.type);
                const badge = statusBadge(evt.status);
                const cp = counterpartyLabel(evt.type, evt.counterparty);
                const isTikintag = looksLikeTikintag(cp);
                return (
                  <li
                    key={evt.id || `noid-${start + idx}`}
                    className="flex items-start gap-3 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <span className={`mt-0.5 flex-shrink-0 ${cls}`}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {typeLabel(evt.type)}
                        </p>
                        {badge ? (
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                          {formatBogotaDate(evt.fecha)}
                        </span>
                        {" · "}
                        <span
                          className={isTikintag ? "font-mono" : undefined}
                        >
                          {cp}
                        </span>
                      </p>
                    </div>
                    <p className="flex-shrink-0 text-sm tabular-nums">
                      {formatCOP(evt.monto)}
                    </p>
                  </li>
                );
              })}
            </ul>
            <PaginationFooter
              page={page}
              totalPages={totalPages}
              total={events.length}
              onPrev={() => setPage((p) => Math.max(0, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
