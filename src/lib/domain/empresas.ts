/**
 * Empresa registry — extract the unique list of empresas seen in a
 * `Transaction[]` for the EmpresaFilter dropdown.
 *
 * Pure function. No imports from Next.js, React, server-only, or
 * lib/sheets. Given a list of transactions, returns the deduped sorted
 * list of `{ id, nombre }` pairs that EmpresaFilter consumes.
 *
 * Phase 2 reality: `empresa_id === empresa_nombre === tikintag`
 * (e.g. `$mario`, `$tikincol`) — see 02-01-SUMMARY.md "Empresa identity
 * decision". The dropdown will display tikintag handles as labels.
 *
 * When BD_Plataforma adds a real display-name column (e.g.
 * `empresa_display_name = 'Liftit S.A.S.'`):
 *   1. `schemas.ts` transform reads the new column into
 *      `Transaction.empresa_nombre` distinct from `empresa_id`.
 *   2. THIS function picks up the new nombre automatically — no edit
 *      needed here. The "first occurrence wins" rule preserves stable
 *      labels across reads.
 */

import type { EmpresaOption } from "@/components/filters/empresa-filter";

import type { Transaction } from "./types";

/**
 * Build the EmpresaFilter dropdown options from a list of transactions.
 *
 * Behavior:
 *   - Deduplicates by `empresa_id` (first occurrence's `empresa_nombre`
 *     is kept — same `headerIndexMap` rule as in `_utils.ts`).
 *   - Skips empty/whitespace `empresa_id` defensively (a row should
 *     never reach here with empty empresa_id given the schema, but
 *     this guard prevents a phantom blank option in the dropdown if
 *     the data drifts).
 *   - Sorts by `nombre` using `Intl.Collator('es')` so accented and
 *     special chars (`$mario`, `$ñoño`) sort the way a Spanish-speaking
 *     user expects.
 *   - Empty input → returns `[]`. EmpresaFilter renders gracefully on
 *     `[]` (only the "(Todas las empresas)" option shows), so callers
 *     don't need to special-case the empty Sheet / first-load case.
 *
 * @example
 *   getEmpresaRegistry([
 *     { empresa_id: '$mario',    empresa_nombre: '$mario',    ... },
 *     { empresa_id: '$tikincol', empresa_nombre: '$tikincol', ... },
 *     { empresa_id: '$mario',    empresa_nombre: '$mario',    ... }, // dupe
 *   ])
 *   // → [
 *   //     { id: '$mario',    nombre: '$mario'    },
 *   //     { id: '$tikincol', nombre: '$tikincol' },
 *   //   ]
 */
export function getEmpresaRegistry(transactions: Transaction[]): EmpresaOption[] {
  if (transactions.length === 0) return [];

  const seen = new Map<string, string>();
  for (const t of transactions) {
    const id = t.empresa_id;
    if (!id || id.trim().length === 0) continue;
    // Sólo $username; phone-format son la primera tx pre-registro del
    // mismo usuario (backend 2026-05-21) — incluirlas listaría fantasmas
    // en filtros y dropdowns.
    if (!id.startsWith("$")) continue;
    if (!seen.has(id)) {
      seen.set(id, t.empresa_nombre || id);
    }
  }

  const collator = new Intl.Collator("es", {
    sensitivity: "base",
    numeric: true,
  });

  return Array.from(seen, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
    collator.compare(a.nombre, b.nombre),
  );
}
