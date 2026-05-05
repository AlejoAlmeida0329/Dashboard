---
phase: 04-inicio-recargas
plan: 02
subsystem: ui-domain
tags: [domain, pure-functions, inicio, hechos-curados, top-empresa, empresas-nuevas, gmv]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: "Transaction type, empresa identity convention (tikintag default), Bogotá-anchored window literals"
  - phase: 01-foundation
    provides: "DashboardFilters URL state, getCachedTransactions deduped fetch"
provides:
  - "findTopEmpresaByGMV — single empresa with highest GMV in filtered period"
  - "findEmpresasNuevasActivadas — empresas whose first-EVER tx falls in window (Pitfall 5 hardened)"
  - "TopEmpresaResult, EmpresaNueva, EmpresasNuevasResult — stable output type contracts"
affects:
  - "04-05-hechos-curados-component (consumes the two output types)"
  - "04-07-inicio-page-composition (calls both functions; passes allTx for empresas-nuevas)"
  - "Phase 5 cliente-foco (CSS hides hechos curados; empresa-filter belt-and-suspenders ensures sane shape)"

# Tech tracking
tech-stack:
  added: []  # zero new libraries; pure TypeScript
  patterns:
    - "Pure domain module with type-only imports — mirror of bonos.ts / empresas.ts"
    - "First-occurrence-wins for empresa_nombre (mirror of empresas.ts getEmpresaRegistry)"
    - "Window guard returns empty result on missing/unparseable from/to (degrades gracefully)"
    - "Top-N + overflowCount shape — reusable for any 'curated' list with '+N más' UI"

key-files:
  created:
    - "src/lib/domain/inicio-hechos.ts (180 lines, 5 exports)"
  modified: []

key-decisions:
  - "Top empresa by GMV ABSOLUTE, not by growth (no prior-period dependency, easier to read in hecho copy)"
  - "Empresas-nuevas full-dataset requirement enforced ONLY in JSDoc + caller contract; function does not validate input is unfiltered (same trust contract as bonos.ts filter functions)"
  - "Top-5 cap for empresas-nuevas with overflowCount carrying the rest — avoids unbounded list, supports '+N más' UX"
  - "Sort empresas-nuevas ascending by firstTx (earliest activation first reads as longest-tenured of new cohort)"
  - "Empresa filter (cliente-foco belt-and-suspenders) narrows BEFORE the cap; honors __all__ sentinel"
  - "EMPRESAS_NUEVAS_CAP = 5 as named constant inside module (not exported); future tuning is single-line edit"
  - "Module exports 5 names (3 interfaces + 2 functions) — interfaces co-located with functions that produce them, mirror of bonos.ts BonoSummary/BonoByDate/BonoByEmpresa pattern"
  - "No findLatenciaDestacada in this plan — Plan 04-07 page composition will reuse summarizePayouts from Phase 3 directly (Phase 3's percentile is the right primitive; no new function needed)"

patterns-established:
  - "Pure module separation by ownership: inicio.ts (KPIs+deltas, Plan 04-01) vs inicio-hechos.ts (this plan) vs recargas.ts (Plan 04-04). Wave-1 plans don't conflict on file ownership; Plan 04-07 page composition imports from all three."
  - "Pitfall 5 hardening pattern: when a function needs FULL dataset vs filtered subset, the contract is documented in IMPORTANT JSDoc paragraph + the function name (Activadas suggests period-relative) + verification fixtures cover the full-dataset case explicitly"

# Metrics
duration: 5m
completed: 2026-05-05
---

# Phase 04 Plan 02: Inicio Hechos Curados Domain Summary

**Pure domain functions for the editorial highlight reel: findTopEmpresaByGMV (top-1 GMV reduction over filtered tx) and findEmpresasNuevasActivadas (empresas with first-ever tx in window, top-5 + overflow, full-dataset hardened against Pitfall 5).**

## Performance

- **Duration:** ~5 min 10 sec
- **Started:** 2026-05-05T02:11:33Z
- **Completed:** 2026-05-05T02:16:43Z
- **Tasks:** 2
- **Files created:** 1 (src/lib/domain/inicio-hechos.ts)

## Accomplishments

- `findTopEmpresaByGMV(filteredTransactions): TopEmpresaResult | null` — single-pass O(N) Map reduction, first-occurrence-wins for empresa_nombre, deterministic tie-break (lexicographic empresa_id), null on empty input.
- `findEmpresasNuevasActivadas(allTransactions, filters): EmpresasNuevasResult` — single-pass O(N) over FULL dataset, empresa-by-empresa earliest-fecha tracking, window-bounded filter, ascending sort by firstTx, top-5 cap with overflowCount.
- 3 stable output types exported (`TopEmpresaResult`, `EmpresaNueva`, `EmpresasNuevasResult`) consumed by Plan 04-05 (HechosCurados component) and Plan 04-07 (page composition).
- Module is verified pure (zero `next/`, `react`, `server-only`, `lib/sheets/` imports — only `Transaction` and `DashboardFilters` type-only imports).
- Zero `Intl.*` / `toLocaleString` calls — single Intl gate convention (lib/format.ts) preserved.

## Task Commits

Each task was committed atomically (caveat below):

1. **Task 1: Create inicio-hechos.ts with findTopEmpresaByGMV** — `28d709c` (feat)
   - **CAVEAT:** This commit's MESSAGE reads `feat(04-01): create period.ts with computePriorPeriod + pctChange` due to a wave-1 parallel-execution race. The COMMIT CONTENT is exactly this plan's Task 1 work (sha-verified). See "Issues Encountered" below.
2. **Task 2: Add findEmpresasNuevasActivadas to inicio-hechos.ts** — `3a502a3` (feat)
   - Correctly attributed: `feat(04-02): add findEmpresasNuevasActivadas to inicio-hechos.ts`.

**Plan metadata:** *(committed after this SUMMARY)* `docs(04-02): complete inicio hechos curados plan`

## Files Created/Modified

- `src/lib/domain/inicio-hechos.ts` — New pure module. 180 lines. 5 exports (3 interfaces + 2 functions + 1 internal const `EMPRESAS_NUEVAS_CAP`).

## Final Function Signatures

```ts
export interface TopEmpresaResult {
  empresa_id: string;
  empresa_nombre: string;
  gmv: number;
}

export interface EmpresaNueva {
  empresa_id: string;
  empresa_nombre: string;
  firstTx: Date;
}

export interface EmpresasNuevasResult {
  shown: EmpresaNueva[];      // up to 5, sorted asc by firstTx
  overflowCount: number;       // total - 5, or 0 if total ≤ 5
}

export function findTopEmpresaByGMV(
  filteredTransactions: Transaction[],
): TopEmpresaResult | null;

export function findEmpresasNuevasActivadas(
  allTransactions: Transaction[],
  filters: DashboardFilters,
): EmpresasNuevasResult;
```

## Mental-Fixture Verification Results

**Task 1 (`findTopEmpresaByGMV`):**

- Empty input `[]` → `null` ✓ (length=0 guard hits)
- `[$a:100, $b:200, $c:50]` → `{ empresa_id: '$b', empresa_nombre: '$b', gmv: 200 }` ✓ (max-GMV reduction picks $b)
- Single empresa input `[$a:500]` → `{ empresa_id: '$a', empresa_nombre: '$a', gmv: 500 }` ✓
- Tie scenario `[$z:100, $a:100]` → `{ empresa_id: '$a', ..., gmv: 100 }` ✓ (lexicographic tie-break)
- All-zero GMV `[$a:0, $b:0]` → `{ empresa_id: '$a', ..., gmv: 0 }` ✓ (page renders empty-state when gmv === 0)

**Task 2 (`findEmpresasNuevasActivadas`):**

- 3 empresas, $a's earliest tx = 2026-03-15 (out), $b's = 2026-04-10 (in), $c's = 2026-04-25 (in); window 2026-04-01..2026-04-30 → `{ shown: [{$b, Apr 10}, {$c, Apr 25}], overflowCount: 0 }` ✓
- 7 empresas all activated in window (e1<e2<...<e7 by firstTx) → `{ shown: [e1..e5], overflowCount: 2 }` ✓
- `filters.from === undefined` → `{ shown: [], overflowCount: 0 }` ✓ (window guard)
- `filters.from === 'not-a-date'` → `{ shown: [], overflowCount: 0 }` ✓ (shape regex guard)
- `filters.empresa === '$mario'` with $mario activated in window → `{ shown: [{$mario, ...}], overflowCount: 0 }` ✓
- `filters.empresa === '__all__'` → no narrowing (sentinel honored) ✓
- Empty allTransactions → `{ shown: [], overflowCount: 0 }` ✓ (empty Map → empty inWindow)

**Pitfall 5 verification (full-dataset requirement):**

If a future caller accidentally passes `filterBonos(allTx, filters)` instead of `allTx`:
- The filtered subset already excludes everything outside the window.
- Each empresa's "earliest tx" in the filtered subset is by definition ≥ windowStart.
- Every empresa would be classified as "new" → output is wildly wrong.

The function does NOT validate this (mirror of `summarizeBonos`-style trust contract). Hardening lives at THREE layers:
1. JSDoc IMPORTANT paragraph cites Pitfall 5 by name and quotes the failure mode.
2. Function NAME (`findEmpresasNuevasActivadas`) implies period-relative narrowing — not "all empresas in this filter".
3. Plan 04-07 page composition is responsible for passing `txResult.rows` (the unfiltered dataset) NOT `filterBonos(...)` (the filtered subset). Plan 04-07 will inherit this contract via the JSDoc.

## Stable Contracts for Plan 04-05 (HechosCurados Component)

The HechosCurados component will receive at most three props derived from this module's outputs (the third comes from Phase 3's `summarizePayouts`):

```ts
interface HechosCuradosProps {
  topEmpresa: TopEmpresaResult | null;     // from findTopEmpresaByGMV
  empresasNuevas: EmpresasNuevasResult;    // from findEmpresasNuevasActivadas
  payoutSummary: PayoutSummary | null;     // from summarizePayouts (Phase 3 reuse)
}
```

Empty-state rendering decisions for the component:
- `topEmpresa === null` OR `topEmpresa.gmv === 0` → "Sin transacciones en el período" Card.
- `empresasNuevas.shown.length === 0` → "Sin empresas nuevas en el período" Card. (overflowCount is irrelevant when shown is empty.)
- `empresasNuevas.overflowCount > 0` → render shown list + "+{overflowCount} más" line at the end.
- `payoutSummary === null` OR `payoutSummary.count === 0` → omit the latencia destacada hecho.

## Why We Did NOT Extract `findLatenciaDestacada` Here

CONTEXT.md vision lists three hechos curados, but only two need new domain functions:

1. **Top empresa del período** → new function (`findTopEmpresaByGMV`).
2. **Empresas nuevas activadas** → new function (`findEmpresasNuevasActivadas`).
3. **Latencia destacada** → REUSES Phase 3's `summarizePayouts(payouts)` from `src/lib/domain/payouts.ts` directly. That function already returns `{ count, p50Seconds, p95Seconds, ... }` and Plan 04-07 will pass it the same `payoutsResult.rows` filtered to the period. The "P50 vs período anterior" delta is computed by composing `summarizePayouts(currentPeriodPayouts)` with `summarizePayouts(priorPeriodPayouts)` and feeding both into `pctChange` from Plan 04-01's `period.ts`. No new domain function is justified — the existing percentile primitive is exactly what's needed.

This decision is intentional and pre-resolved in the PLAN's `<objective>` section: *"The 'latencia destacada' hecho is NOT in this plan — it reuses Phase 3's `summarizePayouts` directly from `payouts.ts`, no new domain function needed."*

## Decisions Made

See "key-decisions" frontmatter list. Top three:

1. **Top empresa = absolute GMV, not growth.** Removes prior-period dependency, simplifies copy ("$ X facturados" vs "+Y% vs marzo").
2. **Top-5 cap with overflowCount.** Matches editorial reading (5 is the limit of "easy to scan"); avoids unbounded list when many empresas activate in same window.
3. **Single-pass O(N) implementations.** Both functions iterate input exactly once. ~3188 production rows × 2 passes (one per function) = well under 5ms total. No memoization layer needed — React `cache()` already dedupes the upstream fetch per request.

## Deviations from Plan

### Operational Deviations (parallel-execution race)

**1. [Rule 3 - Blocking → Self-Resolved] Wave-1 parallel commits attributed Task 1 content to wrong commit message**

- **Found during:** Task 1 commit attempt (after the orchestrator's parallel agents had already moved HEAD)
- **Issue:** The orchestrator spawned 04-01, 04-02, 04-03, 04-04 in parallel. By the time Task 1's `git add` ran, HEAD had advanced to `28d709c` (commit message: `feat(04-01): create period.ts with computePriorPeriod + pctChange`). However, the commit's content is `src/lib/domain/inicio-hechos.ts` — exactly Task 1's output. Verified by sha256 comparing `git show 28d709c:src/lib/domain/inicio-hechos.ts` against the on-disk file: identical (`ab7db587c69712d107870b3f766eda8d50467f4845c6bd3a0426ca942d519dd6`). Plan 04-01's actual `period.ts` content landed in commit `76052a1` (whose message reads `feat(04-04): add data-empresa-filter ...`). Two commits, two messages, both wrong-attributed but content-correct.
- **Fix:** Did NOT rewrite history (other parallel agents may still be in flight; rewriting could lose their work). Documented misattribution here in SUMMARY and in Task 2's commit body so the orchestrator / future debugger has the trail. Task 2 commit (`3a502a3`) is correctly attributed (`feat(04-02): ...`).
- **Files affected:** None changed by the deviation; only commit message metadata is misleading.
- **Verification:** sha256 match between HEAD `inicio-hechos.ts` content and on-disk Task 1 output. `npx tsc --noEmit` and `npx eslint` clean. Build succeeds end-to-end.
- **Committed in:** Task 1 content lives in `28d709c` (under wrong message); Task 2 content lives in `3a502a3` (correct message).

### Plan-Specification Deviations

**None — plan executed exactly as written.** Both `<action>` blocks compiled clean on first build. All `<verify>` mental fixtures matched expected values exactly. All four `<verification>` block checks pass (tsc clean, build succeeds, zero forbidden imports, zero Intl/toLocaleString calls).

---

**Total deviations:** 1 operational (parallel-race commit-message misattribution; content correct). 0 plan-spec.

**Impact on plan:** Zero functional impact. The Task 1 commit's misleading message is a cosmetic git-log issue that the orchestrator can resolve by amending or by accepting the misattribution as documentation cost of parallel execution. SUMMARY documents the trail for future debuggers. Plan 04-05 (HechosCurados component) and 04-07 (page composition) consume the module by import path — neither cares about commit messages.

## Issues Encountered

- **Wave-1 parallel-execution race produced misattributed commits** — see "Deviations" section above. Suggests a future enhancement: orchestrators spawning parallel agents on the same git worktree should serialize the commit step (e.g. via a fcntl-style commit lock) rather than the staging step. Documented for orchestrator authors.

## Next Phase Readiness

- **For Plan 04-05 (HechosCurados component):** Three output type interfaces (`TopEmpresaResult`, `EmpresaNueva`, `EmpresasNuevasResult`) are stable contracts. Component can be written against the types without depending on this module's internals.
- **For Plan 04-07 (Inicio page composition):** Both functions ready to call. The full-dataset requirement for `findEmpresasNuevasActivadas` is the ONE thing the page composition must get right — pass `txResult.rows` (the unfiltered fetch result), NOT `filterBonos(...)` or any other narrowed subset. Plan 04-07's spec should explicitly cite this contract (Pitfall 5).
- **For Phase 5 cliente-foco:** Empresa-filter belt-and-suspenders is in place. Even if a future view drops the CSS hide on hechos curados in cliente-foco, `findEmpresasNuevasActivadas` will narrow to the single filtered empresa before the cap, so the rendered shape stays sensible.
- **No blockers.** No external configuration. No new dependencies.

---
*Phase: 04-inicio-recargas*
*Plan: 02 (inicio hechos curados domain)*
*Completed: 2026-05-05*
