---
phase: 08-tarjeta-recargas
plan: 03
subsystem: domain
tags: [recargas, pse, transfer, aggregations, v2, transactions]

# Dependency graph
requires:
  - phase: 06-foundation-v2
    provides: "DashboardFilters.status CSV (Plan 06-03); parsers.ts (Plan 06-01)"
  - phase: 07-bonos-payouts
    provides: "v2-alongside-v1 coexistence pattern (Plans 07-01 / 07-03); v2-suffix convention"
  - phase: 02-bonos
    provides: "Transaction interface + RECHARGE_TIPOS + Bogotá-anchored from/to helpers"
provides:
  - "filterRecargasV2 — PAYIN_PSE+PAYIN_TRANSFER scope honoring filters.status (default ['completed'])"
  - "summarizeRecargasV2 — totalRecargas + volumenCOP + recargaPromedio (zero-safe)"
  - "aggregateRechargesByDateV2 — daily buckets with PSE vs TRANSFER per-method split (richer than v1 totals-only)"
  - "aggregateRechargeAdoption — distinct-tikintag adoption ratio (REC-V2-03)"
  - "aggregateRechargeMethodSplit — count-based PSE/TRANSFER share (REC-V2-04)"
  - "aggregateRechargeAmountDistribution — 3 fixed buckets <100K / 100K-1M / >1M (REC-V2-06)"
  - "aggregateTopRechargers — tikintag-grouped ranking by volumenCOP DESC (REC-V2-07)"
  - "6 v2 types: RecargaSummaryV2, RecargaByDateV2, RechargeAdoption, RechargeMethodSplit, RechargeAmountBucket, TopRecharger"
affects: [08-04-recargas-page, 09-vista-cliente, 10-inicio-v2]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v2-alongside-v1 coexistence (third application; mirrors Plans 07-01 / 07-03)"
    - "explicit-pathspec staging in parallel-wave (third occurrence in v2.0)"
    - "count-based share semantics for split-by-tipo cards (PRD reading anchor)"
    - "literal {pse, transfer} return shape for direct two-card binding (NOT array)"
    - "stable-axis bucket return (always returns all buckets even when zero)"

key-files:
  created: []
  modified:
    - "src/lib/domain/recargas.ts (+462 lines; v1 byte-identical, v2 appended below)"

key-decisions:
  - "Field-name reconciliation: PLAN.md draft used non-existent fields (transactionAmount, transferTikintag, transferEmpresa); actual Transaction fields (monto, tikintag, empresa_id/empresa_nombre) used in v2 implementation"
  - "Math.abs(monto) defensive guard kept across v2 surface even though direction='in' rows are positive in production"
  - "Count-based share in RechargeMethodSplit (NOT volume-based) anchored to PRD '85% PSE / 15% Transfer' reading"
  - "aggregateRechargesByDateV2 RICHER than v1 aggregateRecargasByDate (per-method PSE/TRANSFER split vs totals-only)"
  - "Amount distribution boundary inclusivity: bottom <100K (strict), middle 100K-1M (inclusive both ends), top >1M (strict)"
  - "Stable-axis bucket return: aggregateRechargeAmountDistribution always returns all 3 buckets even when some are zero (chart x-axis stability)"
  - "Top rechargers grouped by tikintag, NOT empresa_id (future-proofs against the 02-01 empresa-identity divergence path)"
  - "v1 surface 100% kept alive (10 exports byte-identical) — clientes/[empresaId]/page.tsx + EmpresaMiniCards.tsx still consume them; deferred prune to Phase 9 Vista Cliente rewrite"

patterns-established:
  - "v2-suffix coexistence: third occurrence (bonos.ts → payouts.ts → recargas.ts) — pattern proven for parallel-wave Wave-1 plans"
  - "Defensive Math.abs across v2 surface for amount-based aggregations (consistent zero-safety + future schema-drift insurance)"
  - "Field-name reconciliation by sub-agent: when PLAN.md cites fields that don't exist on the type, sub-agent uses actual fields and documents under [Rule 3 - Blocking] deviations"

# Metrics
duration: 6 min
completed: 2026-05-07
---

# Phase 8 Plan 3: Recargas Domain v2 Surface Summary

**Recargas domain extended with 7 v2 aggregations (filter + summarize + byDate + adoption + methodSplit + amountDistribution + topRechargers) and 6 v2 types appended below v1 — v1 surface byte-identical (10 exports preserved for clientes consumers).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-07T21:16:15Z
- **Completed:** 2026-05-07T21:22:17Z
- **Tasks:** 2
- **Files modified:** 1
- **Lines added:** 462 (zero deletions inside v1 block)

## Accomplishments

- **7 v2 functions appended** to `src/lib/domain/recargas.ts`:
  - `filterRecargasV2(transactions, filters)` — PAYIN_PSE + PAYIN_TRANSFER + direction='in' + status CSV (default `["completed"]`) + Bogotá from/to + optional empresa
  - `summarizeRecargasV2(rows)` — `totalRecargas` + `volumenCOP` + `recargaPromedio` (zero-safe)
  - `aggregateRechargesByDateV2(rows)` — daily Bogotá buckets with PSE vs TRANSFER per-method counts/volumes (RICHER than v1 totals-only)
  - `aggregateRechargeAdoption(allTx, recargaRows)` — distinct-tikintag numerator/denominator (REC-V2-03; mirrors `aggregatePurchaseAdoption` from cardUsage.ts)
  - `aggregateRechargeMethodSplit(rows)` — PSE vs TRANSFER count + volume + share BY COUNT (REC-V2-04)
  - `aggregateRechargeAmountDistribution(rows)` — 3 fixed buckets `<$100K / $100K-$1M / >$1M` always returned (REC-V2-06)
  - `aggregateTopRechargers(rows, limit=10)` — tikintag-grouped ranking by `volumenCOP` DESC (REC-V2-07)
- **6 v2 types appended:** `RecargaSummaryV2`, `RecargaByDateV2`, `RechargeAdoption`, `RechargeMethodSplit`, `RechargeAmountBucket`, `TopRecharger`
- **v1 surface preserved BYTE-IDENTICAL** — all 10 v1 exports unchanged at original line numbers (120, 128, 138, 184, 222, 252, 299, 352, 387, 420)
- **`tsc --noEmit` 0 errors / `npm run lint` 0 errors / `npm run build` succeeds** at every commit boundary
- **Atomic commits via explicit `--` pathspec** in active Wave-1 race with sibling 08-01

## Task Commits

Each task was committed atomically with explicit pathspec (`git add -- src/lib/domain/recargas.ts`):

1. **Task 1: Append v2 types + filterRecargasV2 + summarizeRecargasV2 + aggregateRechargesByDateV2** — `af8d2bb` (feat)
2. **Task 2: Append 4 aggregations — adoption + methodSplit + amountDistribution + topRechargers** — `d07ed47` (feat)

**Plan metadata:** (this commit, after SUMMARY creation) `docs(08-03): complete recargas-domain-v2 plan`

## Files Created/Modified

- `src/lib/domain/recargas.ts` — Extended v1 (433 → 895 lines, +462 net append). v1 block (lines 1-433) byte-identical; v2 surface appended below a clearly delimited section header `// ====== v2 — REC-V2-01..08 surface (appended Plan 08-03; v1 above is byte-identical)`.

## v1 Symbols KEPT ALIVE (Phase 9 Deferred Prune)

All 10 v1 exports preserved verbatim because they're still consumed by `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx`:

| v1 Export | Type | Consumer |
|-----------|------|----------|
| `filterRecargas` | function | clientes/[empresaId]/page.tsx, EmpresaMiniCards.tsx |
| `summarizeRecargas` | function | clientes/[empresaId]/page.tsx, EmpresaMiniCards.tsx |
| `aggregateRecargasByDate` | function | clientes/[empresaId]/page.tsx (chart) |
| `aggregateRecargasByEmpresa` | function | clientes/[empresaId]/page.tsx |
| `top10RecargasEmpresas` | function | clientes/[empresaId]/page.tsx |
| `findTopEmpresaRecargadora` | function | clientes/[empresaId]/page.tsx (hecho curado) |
| `findRecargaMasGrande` | function | clientes/[empresaId]/page.tsx (hecho curado) |
| `RecargaSummary` | interface | EmpresaMiniCards.tsx (prop type) |
| `RecargaByDate` | interface | clientes consumers |
| `RecargaByEmpresa` | interface | clientes consumers |

**Migration path:** Phase 9 (Vista Cliente v2 rewrite of `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx`) replaces these v1 consumers with v2 helpers in one cohesive diff. Final v1 prune lands when Phase 9 ships. **No behavior change to Clientes page today** — kept-alive surface is byte-identical to v1.0. Mirrors the deferral pattern established by Plans 07-02 (bonos) and 07-04 (payouts).

## Decisions Made

- **Field-name reconciliation [Rule 3 - Blocking].** The PLAN.md draft cited `tx.transactionAmount`, `tx.transferTikintag`, `tx.transferEmpresa` — these fields do NOT exist on the `Transaction` interface (per `src/lib/domain/types.ts`). Actual fields used: `tx.monto`, `tx.tikintag`, `tx.empresa_id` / `tx.empresa_nombre`. Documented in the v2 section header comment and in deviations below. The plan's intent maps cleanly to the actual fields; no semantic change.
- **Count-based share in `RechargeMethodSplit`.** Plan instruction was explicit: "shares are 0..1 by COUNT (not volume) — count-based share matches PRD baseline reading '85% PSE / 15% Transfer' (count, not COP)". A volume-weighted share would tell a different story than the page caption. The split type returns volumes alongside counts so the page can also show COP if it wants — but `share` is anchored to the PRD reading.
- **Literal `{ pse, transfer }` return shape (NOT array)** for `RechargeMethodSplit`. The v2 page binds two cards directly off `result.pse` / `result.transfer` without `.find()` or index lookup. Same convention as `summarizePayoutsByState`'s by-state shape.
- **`aggregateRechargesByDateV2` is RICHER than v1 `aggregateRecargasByDate`.** v1 emits `{ date, count, monto }` totals-only. v2 emits `{ date, pseCount, pseVolumen, transferCount, transferVolumen, totalCount, totalVolumen }` so the v2 stacked-trend chart (REC-V2-04 + REC-V2-08) can visualize PSE vs TRANSFER over time. v1 stays alive for clientes consumers that don't need the per-method split. Both functions coexist on the same module.
- **Amount distribution boundary inclusivity is UNAMBIGUOUS.** Bottom bucket `<$100K` is strictly less-than (`amount < 100_000`). Middle bucket `$100K-$1M` is inclusive on BOTH ends (`100_000 <= amount <= 1_000_000`) — exactly $100K and exactly $1M land in the middle. Top bucket `>$1M` is strictly greater-than (`amount > 1_000_000`). Documented in the function JSDoc to prevent off-by-cent surprises.
- **Stable-axis bucket return.** `aggregateRechargeAmountDistribution` always returns all 3 buckets even when some are zero — the v2 chart needs a stable x-axis across filter changes; a bucket disappearing mid-render would re-shuffle the layout.
- **Top rechargers grouped by `tikintag`, NOT `empresa_id`.** Today they're the same projection per the 02-01 empresa-identity decision, but the v2 page binds to the user-level identifier so a future empresa↔tikintag separation doesn't change the ranking semantics. `empresa` field on `TopRecharger` carries first-seen `empresa_nombre` for display.
- **`Math.abs(monto)` defensive across the v2 surface.** Direction='in' rows have positive `monto` in production data, but the `Math.abs` guard matches the v2 patterns in `bonos.ts` / `payouts.ts` and future-proofs against schema-drift where a refund/reversal might leak through.
- **Reused module-private `RECHARGE_TIPOS` constant.** Did NOT redeclare. `filterRecargasV2` references the existing const directly via closure.
- **`filters.tipo` INTENTIONALLY ignored** in `filterRecargasV2`, same as `filterBonosV2` and `filterPayoutsV2`. The Recargas tab is recharge-by-definition (PAYIN_PSE + PAYIN_TRANSFER); the global `tipo` multi-select drives Inicio/Vista Cliente cross-cuts, not this tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Field-name reconciliation: PLAN.md cited fields that don't exist on `Transaction`**

- **Found during:** Task 1 (filterRecargasV2 implementation)
- **Issue:** PLAN.md `<action>` blocks referenced `tx.transactionAmount`, `tx.transferTikintag`, `tx.transferEmpresa` as if they existed on the `Transaction` interface. Reading `src/lib/domain/types.ts` confirmed they do NOT — the actual fields are `tx.monto`, `tx.tikintag`, `tx.empresa_id` / `tx.empresa_nombre`. Implementing the plan literally would fail tsc with "Property 'transactionAmount' does not exist on type 'Transaction'".
- **Fix:** Used actual field names in v2 implementation. Mapping applied:
  - `tx.transactionAmount` → `tx.monto` (kept `Math.abs` wrapper as plan instructed)
  - `tx.transferTikintag` → `tx.tikintag`
  - `tx.transferEmpresa` → `tx.empresa_nombre` (display label) / `tx.empresa_id` (filter key)
- **Files modified:** `src/lib/domain/recargas.ts` (v2 section only — v1 untouched)
- **Verification:** Documented the reconciliation in the v2 section header comment at the top of the appended block (lines 437-460); tsc passes with 0 errors; lint passes with 0 errors.
- **Committed in:** `af8d2bb` (Task 1) and `d07ed47` (Task 2) — pervasive across the v2 surface, called out once in the section header rather than per-function.

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial — pure mechanical field-name substitution. No semantic change to plan intent. The plan's `<must_haves>` checklist validates by function names + behavior contracts, all of which are satisfied. No scope creep.

## Issues Encountered

None — plan executed cleanly across both tasks.

## Parallel-Wave Race Observations

**Sibling 08-01 (`src/lib/domain/cardUsage.ts`) racing on the same domain directory in active Wave 1:**

- **Untracked-file phase (during Task 1):** `git status` showed sibling's untracked `src/lib/domain/cardUsage.ts` alongside my modified `src/lib/domain/recargas.ts`. Lint output transiently surfaced the unused-import warning `'toBogotaISODate' is defined but never used` from cardUsage.ts. Confirmed NOT plan-owned (Plan 08-03 only touches recargas.ts).
- **First sibling commit (between Task 1 and Task 2):** sibling committed `0292834 feat(08-01): create cardUsage.ts scaffold with filter and summarize`. The transient lint warning disappeared (sibling completed initial commit which cleaned the unused import or it stopped being flagged once tracked).
- **Second sibling commit (during my Task 2 verification):** sibling committed `7bf2063 feat(08-01): add adoption + by-date + top-users aggregations` while my Task 2 was building. Did NOT affect my build.
- **Recovery applied:** explicit `--` pathspec staging on every commit (`git add -- src/lib/domain/recargas.ts`). Result: my commits contain exactly recargas.ts diffs, sibling's parallel cardUsage.ts work landed independently in interleaved commits — no merge conflicts, no rebase needed, no work lost. Final `git log --oneline -5` shows clean interleaved history:

  ```
  d07ed47 feat(08-03): append 4 v2 aggregations ...           ← mine (Task 2)
  7bf2063 feat(08-01): add adoption + by-date + top-users ... ← sibling
  0292834 feat(08-01): create cardUsage.ts scaffold ...       ← sibling
  af8d2bb feat(08-03): append v2 types + filterRecargasV2 ... ← mine (Task 1)
  7a4d85b docs(08): create phase plan
  ```

**Confirms STATE.md guidance:** parallel-wave git race is a NON-EVENT when both agents discipline themselves to (a) explicit pathspec staging only, (b) work in disjoint files. Third occurrence of this pattern documented in v2.0 (Plans 07-01/07-03 in Phase 7 Wave 1, Plan 07-02/07-04 in Phase 7 Wave 2 with `git stash`, now Plan 08-01/08-03 in Phase 8 Wave 1 without stash needed).

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors (3 pre-existing warnings, unchanged from STATE.md baseline) |
| `npm run build` | ✅ All routes compile, including `/recargas` (still using v1 today; v2 wires up in Plan 08-04) |
| `git diff --stat` v1 byte-identity | ✅ 462 insertions / 0 deletions over 2 commits — APPEND-ONLY confirmed |
| v1 export count + names | ✅ 10 exports unchanged (lines 120, 128, 138, 184, 222, 252, 299, 352, 387, 420 — exact baseline match) |
| v2 export count | ✅ 13 new exports (7 functions + 6 types) |
| Total exports | ✅ 23 (v1=10 + v2=13) — meets verification floor `≥23` |
| File length | ✅ 895 lines (≥600 required) |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 08-04 (Recargas page rebuild)** can now import and consume the 7 v2 functions + 6 v2 types directly. Page composition pattern: filter once with `filterRecargasV2`, chain into `summarizeRecargasV2` + `aggregateRechargeMethodSplit` + `aggregateRechargesByDateV2` + `aggregateRechargeAmountDistribution` + `aggregateTopRechargers` (one filter pass → multiple aggregations, mirroring the page-composition pattern from Plans 07-02 / 07-04). Adoption requires the un-recharge-filtered universe (period-only) — page composition will pass the period-filtered `transactions` as `allTx` to `aggregateRechargeAdoption`.
- **No blockers** — domain surface is feature-complete for the v2 page rebuild.
- **Phase 9 Vista Cliente** inherits a third deferred-prune migration: replace v1 `filterRecargas + summarizeRecargas + RecargaSummary + (5 other v1 fns/types)` consumers with v2 helpers (or keep v1 if simpler — clientes mini-cards arguably want the simpler v1 shape). Joins the bonos and payouts deferred-prune lists from Phase 7 already on the Phase 9 docket.

---
*Phase: 08-tarjeta-recargas*
*Completed: 2026-05-07*
