/**
 * MethodSplitCard — PSE vs Transferencia split (REC-V2-04).
 *
 * Server Component. Renders a single Card titled "PSE vs Transferencia"
 * with a two-column body — left = PSE block, right = Transfer block.
 *
 * Per-block content:
 *   - Method label (PSE | Transferencia)
 *   - Count (formatInteger)
 *   - Share % (formatPercent — count-based, NOT volume-based; per
 *     Plan 08-03 decision anchored to PRD baseline reading "85% PSE /
 *     15% Transferencia")
 *   - Volumen COP (formatCOP)
 *   - Thin horizontal CSS-only bar visualizing the share — keeps server-
 *     render simple, avoids Recharts overhead for a static split.
 *
 * Empty state (totalCount === 0): single muted-foreground line "Sin
 * recargas en el período". The card chrome stays for layout stability
 * across filter changes.
 *
 * Cliente-foco contract: NO `data-presenter-*` attributes here per
 * Plan 08-04 conservative-default policy. Phase 9 may revisit if a
 * CLI-V2 requirement covers Recargas presenter behavior.
 *
 * Format gates: all COP, integer, percent values via `@/lib/format`.
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RechargeMethodSplit } from "@/lib/domain/recargas";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";

type Props = {
  split: RechargeMethodSplit;
};

export function MethodSplitCard({ split }: Props) {
  const totalCount = split.pse.count + split.transfer.count;

  return (
    <Card>
      <CardHeader>
        <CardTitle>PSE vs Transferencia</CardTitle>
        <CardDescription>
          Distribución por método (share por cantidad)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin recargas en el período
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {/* PSE */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                PSE
              </p>
              <p className="font-heading text-2xl tabular-nums">
                {formatInteger(split.pse.count)}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {formatPercent(split.pse.share)}
              </p>
              <span
                aria-hidden="true"
                className="block h-1.5 rounded bg-section-recargas/70"
                style={{
                  width: `${Math.max(4, Math.round(split.pse.share * 100))}%`,
                }}
              />
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatCOP(split.pse.volumen)}
              </p>
            </div>

            {/* Transferencia */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Transferencia
              </p>
              <p className="font-heading text-2xl tabular-nums">
                {formatInteger(split.transfer.count)}
              </p>
              <p className="text-sm tabular-nums text-muted-foreground">
                {formatPercent(split.transfer.share)}
              </p>
              <span
                aria-hidden="true"
                className="block h-1.5 rounded bg-section-recargas/40"
                style={{
                  width: `${Math.max(4, Math.round(split.transfer.share * 100))}%`,
                }}
              />
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatCOP(split.transfer.volumen)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
