/**
 * Inicio "hechos curados" domain — narrative primitives for the editorial
 * highlight reel that /inicio renders (top empresa del período, empresas
 * nuevas activadas).
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué empresa lideró el
 * período" y "qué empresas se activaron en el período". UI consumers
 * (Plan 04-05 HechosCurados component, Plan 04-07 page composition)
 * import the functions here and stay dumb about the underlying data
 * shape.
 *
 * The "latencia destacada" hecho is intentionally NOT in this module — it
 * reuses `summarizePayouts` from `./payouts` directly (Phase 3's percentile
 * is the right primitive; no new function needed).
 *
 * Design rules (mirror of bonos.ts / empresas.ts):
 *   - NO imports from `next/`, `react`, `server-only`, or `lib/sheets/`.
 *     This makes every function callable from Server Components, Client
 *     Components, scripts, and (future) tests without setup.
 *   - All functions are pure: same input → same output, no side effects,
 *     no `Date.now()` or `process.env` reads.
 *   - Date math is anchored to "America/Bogota" via literal `T00:00:00-05:00`
 *     / `T23:59:59.999-05:00` offsets — same convention as bonos.ts and
 *     url-state.ts so filters and aggregations agree on what "a day" means.
 *   - Lives in a SEPARATE module from `./inicio` so wave-1 plans (04-01
 *     KPIs/deltas, 04-02 hechos curados, 04-03 trend aggregations,
 *     04-04 recargas hechos) don't conflict on file ownership.
 */

import type { Transaction } from "./types";

// --- Output types -----------------------------------------------------------

/**
 * The single empresa with highest GMV in a filtered period.
 * Consumed by Plan 04-05's HechosCurados component to render the
 * "Top empresa del período" hecho.
 */
export interface TopEmpresaResult {
  empresa_id: string;
  empresa_nombre: string;
  /** Sum of `monto` across the filtered transactions for this empresa (COP). */
  gmv: number;
}

// --- Top empresa by GMV -----------------------------------------------------

/**
 * Given a FILTERED Transaction[] (already reduced to direction=in,
 * status=completed, in-period — caller's responsibility), return the
 * single empresa with highest GMV.
 *
 * Returns null on empty input. The caller renders an empty-state
 * Card ("Sin transacciones en el período") when null.
 *
 * Decision (04-RESEARCH.md Open Question 1): "top" is by GMV
 * absolute, NOT by growth. Simpler, no prior-period dependency,
 * easier to read in the hecho copy ("$ X facturados").
 *
 * Edge cases:
 *   - Single-empresa input → returns that empresa with its full GMV.
 *   - All-zero GMV input → returns the lexicographically-first empresa
 *     with `gmv: 0`. Acceptable; the page renders the empty-state copy
 *     when `gmv === 0`.
 *   - Tie on max GMV → picks the lexicographically-first `empresa_id`
 *     for determinism (rare in practice given continuous monto values).
 *
 * Pure: returns a fresh object; does not mutate input.
 *
 * @example
 *   findTopEmpresaByGMV([
 *     { empresa_id: '$a', empresa_nombre: '$a', monto: 100, ... },
 *     { empresa_id: '$b', empresa_nombre: '$b', monto: 200, ... },
 *     { empresa_id: '$c', empresa_nombre: '$c', monto:  50, ... },
 *   ])
 *   // → { empresa_id: '$b', empresa_nombre: '$b', gmv: 200 }
 *
 *   findTopEmpresaByGMV([])
 *   // → null
 */
export function findTopEmpresaByGMV(
  filteredTransactions: Transaction[],
): TopEmpresaResult | null {
  if (filteredTransactions.length === 0) return null;

  // First-occurrence-wins for empresa_nombre (mirror getEmpresaRegistry
  // convention from empresas.ts — stable labels across reads).
  const byEmpresa = new Map<string, { empresa_nombre: string; gmv: number }>();
  for (const t of filteredTransactions) {
    const cur = byEmpresa.get(t.empresa_id);
    if (cur) {
      cur.gmv += t.monto;
    } else {
      byEmpresa.set(t.empresa_id, {
        empresa_nombre: t.empresa_nombre || t.empresa_id,
        gmv: t.monto,
      });
    }
  }

  // Reduce to single max-GMV entry. On tie, lexicographically-first
  // empresa_id wins for determinism.
  let topId: string | null = null;
  let topNombre = "";
  let topGmv = Number.NEGATIVE_INFINITY;
  for (const [id, { empresa_nombre, gmv }] of byEmpresa) {
    if (
      gmv > topGmv ||
      (gmv === topGmv && (topId === null || id < topId))
    ) {
      topId = id;
      topNombre = empresa_nombre;
      topGmv = gmv;
    }
  }

  // Defensive: byEmpresa is non-empty (we guarded length=0 at entry), so
  // topId is guaranteed non-null here. The `?? ''` keeps TS happy without
  // requiring a non-null assertion.
  return {
    empresa_id: topId ?? "",
    empresa_nombre: topNombre,
    gmv: topGmv,
  };
}
