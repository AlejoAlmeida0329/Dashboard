/**
 * Canonical JOIN: BD_Plataforma transactions ↔ BD_Payouts payouts.
 *
 * **Naming convention (technical vs semantic):**
 *   The JOIN runs on `BD_Plataforma.transaction_id` ↔ `BD_Payouts.Transaction ID`.
 *   In the Tikin codebase those map to the domain fields `Transaction.id` and
 *   `Payout.transactionId` respectively (schema-level translation in
 *   `src/lib/domain/schemas.ts`).
 *
 *   The PRD v2 (CROSS-V2-04) calls the same JOIN by the SEMANTIC name
 *   `reference` — i.e. "the canonical reference both sources share." DO NOT
 *   confuse this with the column literally named `reference` in BD_Plataforma:
 *   that column carries blockchain hashes (hex strings) and is NOT a JOIN key.
 *   Code keeps the technical name (`transaction_id` / `transactionId`) and
 *   this JSDoc cites the semantic PRD name for cross-document traceability.
 *
 * **Verification baseline (2026-05-04, pre-Phase-6 historic capture):**
 *   773 / 798 (96.9 %) BD_Payouts rows matched a BD_Plataforma row by this
 *   key against full production data. The 25 unmatched rows are payouts
 *   whose originating transaction is older than the BD_Plataforma snapshot
 *   window — expected, not a bug. Captured in `.planning/STATE.md` and the
 *   v2.0 ROADMAP. Re-verifiable via `joinMatchStats()` (see below).
 *
 * **Use-cases this helper unblocks:**
 *   - **CLI-V2-03..07 (Vista Cliente):** enrich each Payout with the
 *     originating Transaction's `empresa_id` so the Vista Cliente can narrow
 *     payouts by empresa (BD_Payouts has no native empresa column).
 *   - **PAY-V2-08 (pagos a terceros):** identify payouts where
 *     `payout.holder ≠ transaction.tikintag` — i.e. the cardholder is NOT
 *     the tikintag empresa. Requires the JOIN to read `tikintag` from the
 *     Transaction side.
 *   - **Any future cross-source v2.0 metric** that needs both the
 *     transaction context (type, direction, fees) and the payout context
 *     (state, latency, destination bank).
 *
 * **Pattern formalized (replaces ad-hoc inline join):**
 *   This module replaces the ad-hoc `Map<transactionId, empresa_id>` built
 *   inline in `src/app/(protected)/payouts/page.tsx` (lines ~125-138 prior
 *   to v2.0). The page-level usage is intentionally LEFT IN PLACE for now
 *   — Phase 7+ adopts this helper as part of v2.0 page rewrites; the
 *   migration is non-mandatory in Plan 06-02 because the inline form works
 *   and a refactor without behavior change is best done alongside the
 *   broader v2.0 page composition.
 *
 * **Purity:**
 *   All exported functions are pure. They never mutate inputs, never read
 *   `Date.now`, env, or any I/O. Safe to call from Server Components,
 *   route handlers, tests, and diagnostic scripts.
 */

import type { Payout, Transaction } from "./types";

/**
 * Payout enriched with its originating BD_Plataforma row when one was
 * found. `transaction` is undefined when the payout's `transactionId` is
 * absent from the supplied transactions list (the historic 25/798 ≈ 3.1 %
 * unmatched rate against full prod data).
 *
 * Callers should null-check `transaction` rather than assume the join hit;
 * `transaction?.empresa_id` is the canonical empresa enrichment idiom for
 * v2.0 page composition.
 */
export interface JoinedPayout extends Payout {
  /** Matched BD_Plataforma row, undefined when no match. */
  transaction?: Transaction;
}

/**
 * Build a `Map<transaction_id, Transaction>` index. Factored out so callers
 * that already own a transactions list (e.g. UI rows iterating row-by-row)
 * can build the index ONCE and reuse it for many lookups.
 *
 * Pure. O(n) over `transactions`.
 *
 * @example
 *   const byId = joinIndex(txResult.rows);
 *   const enriched = payoutsResult.rows.map((p) => ({
 *     ...p,
 *     empresa_id: p.empresa_id ?? byId.get(p.transactionId)?.empresa_id,
 *   }));
 */
export function joinIndex(
  transactions: Transaction[],
): Map<string, Transaction> {
  const byId = new Map<string, Transaction>();
  for (const t of transactions) {
    byId.set(t.id, t);
  }
  return byId;
}

/**
 * Canonical JOIN. Returns a NEW array of `JoinedPayout` — `payouts` and
 * `transactions` are never mutated.
 *
 * Behavior:
 *   - For each payout `p`, attaches the matched `Transaction` as
 *     `p.transaction` (undefined when no match).
 *   - Empty `transactions`: returns the payouts shallow-copied with
 *     `transaction: undefined` everywhere. No throw.
 *   - Empty `payouts`: returns `[]`.
 *   - Order preserved: result[i] mirrors payouts[i].
 *
 * Pure. O(n + m) where n = transactions, m = payouts.
 */
export function joinPayouts(
  transactions: Transaction[],
  payouts: Payout[],
): JoinedPayout[] {
  const byId = joinIndex(transactions);
  return payouts.map((p) => ({
    ...p,
    transaction: byId.get(p.transactionId),
  }));
}

/**
 * Diagnostic counters for verifying the JOIN against real data.
 *
 * Returns `{ matched, unmatched, total, rate }` where:
 *   - `total = payouts.length`
 *   - `matched = count of payouts whose transactionId is in the index`
 *   - `unmatched = total - matched`
 *   - `rate = total > 0 ? matched / total : 0` (in [0, 1])
 *
 * Used by `/api/diagnose/join` (and similar one-off diagnostic routes) to
 * confirm the historic 773/798 ≈ 96.9 % baseline still holds when the
 * Sheet upstream is edited. Not used in any production page render.
 *
 * Pure. O(n + m).
 */
export function joinMatchStats(
  transactions: Transaction[],
  payouts: Payout[],
): { matched: number; unmatched: number; total: number; rate: number } {
  const byId = joinIndex(transactions);
  let matched = 0;
  for (const p of payouts) {
    if (byId.has(p.transactionId)) matched += 1;
  }
  const total = payouts.length;
  return {
    matched,
    unmatched: total - matched,
    total,
    rate: total > 0 ? matched / total : 0,
  };
}
