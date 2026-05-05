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

import type { DashboardFilters } from "@/lib/url-state";

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

/**
 * One empresa whose first-ever transaction landed in the filter window.
 * Carried inside `EmpresasNuevasResult.shown`.
 */
export interface EmpresaNueva {
  empresa_id: string;
  empresa_nombre: string;
  /** Timestamp of the empresa's earliest-ever transaction in the dataset. */
  firstTx: Date;
}

/**
 * Result shape for `findEmpresasNuevasActivadas` — caps shown to top 5
 * with overflowCount carrying the rest for the "+N más" display.
 */
export interface EmpresasNuevasResult {
  /** Up to 5 entries, sorted ascending by `firstTx` (earliest activation first). */
  shown: EmpresaNueva[];
  /** Total count beyond `shown.length` (i.e. `total - 5`, or 0 if `total ≤ 5`). */
  overflowCount: number;
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

// --- Empresas nuevas activadas ---------------------------------------------

/** Maximum number of `EmpresaNueva` entries surfaced in `shown`. */
const EMPRESAS_NUEVAS_CAP = 5;

/**
 * Find empresas whose FIRST-EVER transaction in the dataset falls
 * within the active filter window. Caps shown to top 5 (sorted by
 * firstTx ascending — earliest activation first); overflowCount
 * carries the rest for "+N más" display.
 *
 * IMPORTANT (Pitfall 5 in 04-RESEARCH.md): callers MUST pass the
 * FULL transaction dataset (allTx from getCachedTransactions), NOT
 * the period-filtered subset. If you pass a filtered subset, every
 * empresa in that subset will appear "new" because their earliest
 * tx in the filtered subset is by definition in-period.
 *
 * Cost: O(N) single pass over allTx (~3188 rows in production), well
 * under 5ms. No second fetch needed — getCachedTransactions is React
 * cache()-deduped per request, so this function is callable alongside
 * other domain reads without quota cost.
 *
 * Behavior:
 *   - Empty/missing window (`filters.from` or `filters.to` undefined or
 *     unparseable) → returns `{ shown: [], overflowCount: 0 }`. The
 *     "earliest activation" question requires a defined window; we
 *     degrade gracefully rather than guess.
 *   - Empresa filter active (`filters.empresa` set) → results are
 *     narrowed to that single empresa BEFORE the cap. CONTEXT.md's
 *     cliente-foco contract hides hechos curados via CSS, but this
 *     filter ensures sane shape if ever rendered (e.g. if a future
 *     view drops the CSS hide).
 *   - No empresas activated in window → returns `{ shown: [],
 *     overflowCount: 0 }` (caller renders empty-state copy).
 *
 * Pure: returns a fresh result object; does not mutate input.
 *
 * @example
 *   findEmpresasNuevasActivadas(allTx, { from: '2026-04-01', to: '2026-04-30' })
 *   // when $a's earliest tx = 2026-03-15, $b's = 2026-04-10, $c's = 2026-04-25
 *   // → { shown: [
 *   //       { empresa_id: '$b', firstTx: 2026-04-10 },
 *   //       { empresa_id: '$c', firstTx: 2026-04-25 },
 *   //     ], overflowCount: 0 }
 */
export function findEmpresasNuevasActivadas(
  allTransactions: Transaction[],
  filters: DashboardFilters,
): EmpresasNuevasResult {
  // Window guard: hechos curados are period-relative; without a window
  // there's no meaningful "new in this period" answer.
  if (!filters.from || !filters.to) {
    return { shown: [], overflowCount: 0 };
  }
  // Cheap shape check on the date strings to avoid producing an Invalid
  // Date that silently includes everything (NaN comparisons are always
  // false, so windowStart=NaN/windowEnd=NaN would filter to []).
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(filters.from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(filters.to)
  ) {
    return { shown: [], overflowCount: 0 };
  }

  // Bogotá-anchored window bounds. Same literal-offset convention as
  // bonos.ts and url-state.ts so "the 1st" means the 1st in Bogotá,
  // not in UTC.
  const windowStart = new Date(`${filters.from}T00:00:00-05:00`).getTime();
  const windowEnd = new Date(`${filters.to}T23:59:59.999-05:00`).getTime();
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd)) {
    return { shown: [], overflowCount: 0 };
  }

  // Single O(N) pass: track each empresa's earliest-ever transaction.
  // First-occurrence-wins for empresa_nombre (mirror of empresas.ts /
  // findTopEmpresaByGMV convention — stable labels across reads).
  const firstTxByEmpresa = new Map<
    string,
    { fecha: Date; nombre: string }
  >();
  for (const tx of allTransactions) {
    const txTime = tx.fecha.getTime();
    if (!Number.isFinite(txTime)) continue;
    const cur = firstTxByEmpresa.get(tx.empresa_id);
    if (!cur || txTime < cur.fecha.getTime()) {
      firstTxByEmpresa.set(tx.empresa_id, {
        fecha: tx.fecha,
        nombre: tx.empresa_nombre || tx.empresa_id,
      });
    }
  }

  // Empresa filter (cliente-foco belt-and-suspenders). The `__all__`
  // sentinel is used elsewhere in the dashboard for "no narrowing"; we
  // honor the same convention here even though `filters.empresa` is
  // typed as `string | undefined` and will normally be undefined when
  // not narrowing.
  const empresaFilter =
    filters.empresa && filters.empresa !== "__all__" ? filters.empresa : null;

  // Filter to empresas whose first-ever tx falls in [windowStart, windowEnd].
  const inWindow: EmpresaNueva[] = [];
  for (const [empresa_id, { fecha, nombre }] of firstTxByEmpresa) {
    if (empresaFilter && empresa_id !== empresaFilter) continue;
    const txTime = fecha.getTime();
    if (txTime >= windowStart && txTime <= windowEnd) {
      inWindow.push({
        empresa_id,
        empresa_nombre: nombre,
        firstTx: fecha,
      });
    }
  }

  // Sort ascending by firstTx — earliest activation first reads as the
  // most "interesting" because it's the longest-tenured of the new
  // cohort within the window.
  inWindow.sort((a, b) => a.firstTx.getTime() - b.firstTx.getTime());

  const shown = inWindow.slice(0, EMPRESAS_NUEVAS_CAP);
  const overflowCount = Math.max(0, inWindow.length - EMPRESAS_NUEVAS_CAP);

  // Result is intentionally NOT memoized inside this function. The full
  // dataset pass is O(N) with a tiny per-row cost (single Map lookup +
  // numeric compare) — well under 5ms on 3188-row production data. The
  // upstream fetch (getCachedTransactions) is the expensive step and
  // React `cache()` already dedupes it per request.
  return { shown, overflowCount };
}
