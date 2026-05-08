/**
 * TimelineActivity — Feed cronológico de eventos del tikintag (CLI-V2-08).
 *
 * Server Component. Consumes `ClienteTimelineEvent[]` from Plan 09-01 — the
 * domain layer already sorts events DESC by `fecha` and caps the array at
 * 200 events. This leaf is purely presentational; no client-side sorting
 * or pagination.
 *
 * Per-event row layout:
 *   - Icon by event type (Lucide React) — colored per type for at-a-glance
 *     classification (greens for IN flows, neutral for OUT flows, section-
 *     accents for section-typed activity).
 *   - Type label in Spanish ("Bono recibido", "P2P enviada", "Compra
 *     tarjeta", "Recarga PSE", "Recarga Transfer", "Retiro banco", "Otro").
 *   - Meta line: date · counterparty (font-mono when counterparty looks
 *     like a tikintag, plain text otherwise — `looksLikeTikintag` predicate
 *     below).
 *   - Right-aligned monto (`formatCOP`) with `tabular-nums` for digit grid.
 *   - Status badge for non-completed states (rejected, failed, in_progress)
 *     so the operator can spot problem rows without reading the status
 *     column.
 *
 * IMPORTANT — presenter-hide is the PAGE'S responsibility, not the LEAF's:
 *   This component does NOT carry `data-presenter-hide` / `-metric-hide`.
 *   Plan 09-03 wraps `<TimelineActivity />` in a `<div data-presenter-hide>`
 *   in the page composition. Keeping the attribute OUT of the leaf lets
 *   future plans reuse the timeline (e.g. an internal-only debug panel
 *   where presenter mode shouldn't apply at all). Same separation pattern
 *   as `KPICardsInicio` (the cards carry their own attributes) vs the
 *   section accent (the page chooses where it lands).
 *
 * Icon mapping (open question from 09-01 SUMMARY, resolved here):
 *   BONUS_IN          → ArrowDownLeft  (text-status-success)
 *   BONUS_OUT         → ArrowUpRight   (text-foreground)
 *   P2P_IN            → ArrowDownLeft  (text-status-success)
 *   P2P_OUT           → ArrowUpRight   (text-foreground)
 *   PURCHASE          → ShoppingCart   (text-section-tarjeta)
 *   RECHARGE_PSE      → Banknote       (text-section-recargas)
 *   RECHARGE_TRANSFER → Banknote       (text-section-recargas)
 *   PAYOUT_BANK       → CreditCard     (text-section-payouts)
 *   OTRO              → Activity       (text-muted-foreground)
 *
 * Color treatment uses the v2 status palette + cross-section accents. NOTE:
 * the timeline is the ONE place in the dossier where multiple section
 * accents legitimately co-occur — they're being used as taxonomic markers
 * (each event "belongs" to a section), not as page-level accent. This is
 * orthogonal to the one-section-accent-per-page rule which governs the
 * page's protagonist accent. The icons read as a key/legend, not as
 * competing emphasis.
 *
 * PURCHASE counterparty special-case (open question from 09-01 SUMMARY,
 * resolved here): the domain layer maps PURCHASE counterparty to
 * `t.empresa_nombre` which today equals the tikintag itself (BD_Plataforma
 * doesn't surface a true merchant name). The leaf renders "Compra tarjeta"
 * as the counterparty label for PURCHASE rows so the timeline doesn't read
 * "$mario → $mario" — a future BD_Plataforma column upgrade can revert
 * this special-case in one place.
 *
 * Empty state: `events.length === 0` → muted-foreground placeholder
 * "Sin actividad registrada para este tikintag en el período".
 *
 * Format gates: COP via `formatCOP`, dates via `formatBogotaDate`. ZERO
 * `Intl.NumberFormat` / `toLocaleString` here.
 */

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
import type {
  ClienteTimelineEvent,
  ClienteTimelineEventType,
} from "@/lib/domain/cliente";
import { formatBogotaDate, formatCOP } from "@/lib/format";

type Props = {
  events: ClienteTimelineEvent[];
};

type IconComponent = typeof Activity;

/**
 * Icon + color mapping per event type. Returns the Lucide icon component
 * + Tailwind color class. Centralized so the JSX stays flat and the
 * mapping is editable in one place.
 */
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

/** Spanish display label per event type. */
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

/**
 * Status badge for non-happy-path events. Returns null when the row is
 * "completed" (no badge needed — the absence is the green light). Maps
 * Transaction.status AND PayoutState lifecycle vocabularies onto a single
 * Spanish-labeled palette.
 */
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

/**
 * Heuristic: does the counterparty string look like a tikintag (and so
 * deserve `font-mono`)? Tikintags are lowercase + start with `$` — a
 * narrower match than "any string with `$`" so future merchant names
 * containing `$` accidentally don't get mono-spaced.
 */
function looksLikeTikintag(s: string): boolean {
  return s.startsWith("$");
}

/**
 * Counterparty label override for PURCHASE — domain layer returns
 * `empresa_nombre` which today equals the tikintag (no true merchant
 * column yet). Render a generic label so the timeline doesn't read
 * "$mario → $mario".
 */
function counterpartyLabel(
  type: ClienteTimelineEventType,
  counterparty: string | undefined,
): string {
  if (type === "PURCHASE") return "Compra tarjeta";
  return counterparty ?? "—";
}

export function TimelineActivity({ events }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividad cronológica</CardTitle>
        <CardDescription>
          Hasta 200 eventos, fecha descendente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            Sin actividad registrada para este tikintag en el período
            seleccionado.
          </p>
        ) : (
          <ul className="space-y-3">
            {events.map((evt) => {
              const { Icon, cls } = iconAndColor(evt.type);
              const badge = statusBadge(evt.status);
              const cp = counterpartyLabel(evt.type, evt.counterparty);
              const isTikintag = looksLikeTikintag(cp);
              return (
                <li
                  key={evt.id}
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
                        className={
                          isTikintag ? "font-mono" : undefined
                        }
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
        )}
      </CardContent>
    </Card>
  );
}
