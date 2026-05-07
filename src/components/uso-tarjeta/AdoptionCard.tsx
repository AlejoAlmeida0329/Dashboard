/**
 * AdoptionCard — Adoption rate headline for /uso-tarjeta (CARD-V2-04).
 *
 * Server Component. Single Card showing what fraction of users in the
 * broader pool have made at least one card purchase in the filtered range.
 *
 * PRD baseline reading (2026-05): roughly 40 usuarios con compra / 235
 * usuarios totales ≈ 17%. This is the conversation-driver in customer
 * meetings — "X% de tus usuarios usan la tarjeta" — so AdoptionCard sits
 * prominently above the trend chart in the cockpit composition.
 *
 * Section accent rule (Plan 08-02): the page applies `text-section-tarjeta`
 * on EXACTLY ONE focal metric — KPICardsCardUsage owns it ("Compras totales"
 * primary card). AdoptionCard intentionally uses `text-foreground` so the
 * page reads with one clear protagonist accent instead of two competing
 * Amber zones. The percentage stays a text-4xl headline regardless.
 *
 * Zero-safe contract: when `adoption.totalUsers === 0` the percentage is
 * meaningless (0/0 ≈ 0 numerically) — render a "Sin datos" placeholder
 * instead. Domain layer guarantees no NaN; this is a UX guard for the
 * empty-pool case.
 *
 * Format gates: `formatPercent` for the adoptionRate fraction (0..1);
 * `formatInteger` for numerator/denominator subtext.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PurchaseAdoption } from "@/lib/domain/cardUsage";
import { formatInteger, formatPercent } from "@/lib/format";

type Props = {
  adoption: PurchaseAdoption;
};

export function AdoptionCard({ adoption }: Props) {
  const hasUsers = adoption.totalUsers > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adopción de tarjeta</CardTitle>
      </CardHeader>
      <CardContent>
        {hasUsers ? (
          <div className="space-y-1">
            <p className="font-heading text-4xl tabular-nums text-foreground">
              {formatPercent(adoption.adoptionRate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatInteger(adoption.usersWithPurchase)} de{" "}
              {formatInteger(adoption.totalUsers)} usuarios con al menos una
              compra en el período
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin datos</p>
        )}
      </CardContent>
    </Card>
  );
}
