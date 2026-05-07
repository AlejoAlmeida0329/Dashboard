---
phase: 08-tarjeta-recargas
plan: 01
subsystem: domain
tags: [uso-tarjeta, purchase, domain-layer, aggregation, v2]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: Transaction interface + schema (consumes via type-only import)
  - phase: 06-foundation-v2
    provides: DashboardFilters URL contract (status CSV + empresa scoping)
  - phase: 07-bonos-payouts
    provides: v2-suffix coexistence pattern + tikintag-ranking aggregator shape (top emisores/receptores reused conceptually for top card users)
provides:
  - filterPurchases (PURCHASE direction=out + status default ['completed'] + Bogotá-anchored period + optional empresa)
  - summarizePurchases (totalCompras + volumenCOP + ticketPromedio)
  - aggregatePurchaseAdoption (two-arg signature; numerator from purchases, denominator from broader pool)
  - aggregatePurchasesByDate (daily Bogotá buckets; no zero-fill; no granularity arg)
  - aggregateTopCardUsers (groups by tikintag, sorts by volumenCOP DESC, default limit 10)
  - 4 interfaces: PurchaseSummary, PurchaseAdoption, PurchaseByDate, TopCardUser
affects:
  - phase: 08-tarjeta-recargas (Plan 08-02 will compose these into /uso-tarjeta page)
  - phase: 09-vista-cliente (may reuse PurchaseSummary in EmpresaMiniCards if PURCHASE shows up in the cliente cockpit)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "v2 domain library scaffold from-scratch (no v1 coexistence needed — Uso Tarjeta is new in v2)"
    - "Two-input aggregation signature (allTx + filteredRows) for ratios that need numerator and denominator from different scopes"
    - "Inlined Bogotá date helper (avoids pulling formatInTimeZone for one call site; matches recargas.ts/bonos.ts startOfDay/endOfDay idiom)"
    - "Default-limit ranking with tiebreak on secondary metric (volumen DESC, then compras DESC) for deterministic output"

key-files:
  created:
    - src/lib/domain/cardUsage.ts
  modified: []

key-decisions:
  - "filterPurchases ignores filters.tipo (Uso Tarjeta is PURCHASE-by-definition, same convention as filterBonosV2 / filterPayoutsV2)"
  - "PURCHASE direction=out is the canonical 'card spend' filter (the matching direction=in peer row is excluded so spend is counted once per ticket)"
  - "summarizePurchases takes Math.abs(monto) because PURCHASE-out rows carry negative montos"
  - "aggregatePurchaseAdoption is a two-arg fn — caller pre-filters allTx to the period; one-filter-pass-multiple-aggregations budget"
  - "aggregateTopCardUsers default limit=10, sort by volumenCOP DESC with compras DESC tiebreak (deterministic output)"
  - "TopCardUser.empresa typed string|undefined (defensive against future schema where empresa may be a separate, optionally-populated column)"
  - "No granularity arg in aggregatePurchasesByDate (week/month re-bucketing is a UI concern, same as recargas.ts / bonos.ts v2)"

patterns-established:
  - "From-scratch v2 domain library: no v1 prune needed when section is brand-new in milestone (mirrors how Phase 7 needed coexistence; Phase 8 doesn't for new sections)"
  - "Inlined Bogotá date helper as private fn (ten lines of arithmetic) over importing formatInTimeZone — reduces module surface for single-callsite uses"
  - "Two-arg adoption signature (allTx, filteredRows) reusable for any future 'X% of users do Y' KPI"

# Metrics
duration: 6 min
completed: 2026-05-07
---

# Phase 8 Plan 1: Uso Tarjeta Domain v2 Summary

**New domain library `src/lib/domain/cardUsage.ts` (380 LOC, 4 interfaces + 5 functions) exposing filter + summarize + adoption + by-date + top-users primitives for the brand-new /uso-tarjeta page (Plan 08-02 composes).**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-07T21:15:57Z
- **Completed:** 2026-05-07T21:22:09Z
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments

- Stood up the entire Uso Tarjeta domain surface from scratch (no v1 predecessor — first never-before-built section in v2.0 milestone).
- 4 exported interfaces (`PurchaseSummary`, `PurchaseAdoption`, `PurchaseByDate`, `TopCardUser`) honoring the must_haves frontmatter exports list literally.
- 5 exported functions, each pure, zero-safe (empty inputs degrade to zeros / empty arrays — never NaN / Infinity).
- `filterPurchases` honors `DashboardFilters` shape (CSV status + Bogotá period + optional empresa), defaulting to `["completed"]` when status absent or empty (matches CROSS-V2-01 + Phase 6 contract).
- `aggregatePurchaseAdoption` two-arg signature so the page composition (Plan 08-02) runs one period-filter pass and threads the result into both numerator-and-denominator computations without double-scoping.
- `aggregateTopCardUsers` default limit=10 (CARD-V2-06), sort by `volumenCOP` DESC with `compras` DESC tiebreak for deterministic output.
- All three verification commands green: `tsc --noEmit` 0 errors, `eslint` 0 errors (3 pre-existing project warnings unchanged from baseline), `next build` succeeds (12 routes).
- 9 exports total (verified via `grep -E "^export " | wc -l = 9`), file at 380 LOC (well above must_haves min_lines: 180).

## Task Commits

Each task was committed atomically with explicit pathspec staging (`git add -- src/lib/domain/cardUsage.ts`) per the parallel-wave race recovery convention from STATE.md:

1. **Task 1: scaffold + filterPurchases + summarizePurchases** — `0292834` (feat)
2. **Task 2: 3 aggregations (adoption + by-date + top-users) + Bogotá date helper** — `7bf2063` (feat)

**Plan metadata:** (this commit, the docs commit, tracked separately below)

## Files Created/Modified

- `src/lib/domain/cardUsage.ts` — Created. 380 LOC. 4 interfaces (`PurchaseSummary`, `PurchaseAdoption`, `PurchaseByDate`, `TopCardUser`) + 5 functions (`filterPurchases`, `summarizePurchases`, `aggregatePurchaseAdoption`, `aggregatePurchasesByDate`, `aggregateTopCardUsers`). File-level JSDoc cites CARD-V2-01..06 traceability and references Phase 7 v2 modules (`bonos.ts`, `payouts.ts`) as structural prior art.

## Decisions Made

1. **Inlined Bogotá date helper** instead of importing `formatInTimeZone` from `date-fns-tz`. Bogotá is +/-5h from UTC with no DST, so the arithmetic is 10 lines and deterministic. Keeps the module's import surface minimal — consistent with how `recargas.ts` and `bonos.ts` keep their own private `startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp` helpers rather than DRY-ing across modules. (Phase 7 + Phase 4 both made the same call; established convention.)

2. **`filterPurchases` ignores `filters.tipo`.** Uso Tarjeta is PURCHASE-by-definition; the global `tipo` multi-select drives Inicio / Vista Cliente cross-cuts. Same convention as `filterBonosV2` (BONUS-by-definition) and `filterPayoutsV2` (Plan 07-03 pattern).

3. **`summarizePurchases` takes `Math.abs(monto)`** because PURCHASE direction=out rows carry negative montos in BD_Plataforma (debit from the user's wallet). The KPI surfaces gross spend volume, which is the headline number.

4. **`aggregatePurchaseAdoption` two-arg signature `(allTx, purchaseRows)`** instead of one-arg-then-internal-split. Rationale: numerator (PURCHASE rows) and denominator (broader user pool) come from different filter scopes; the page composition pre-filters allTx to the period once, then chains the filtered superset into both arguments. One-filter-pass-multiple-aggregations budget — same composition contract as Plan 07-03's `JoinedPayout` pipeline.

5. **`aggregatePurchasesByDate` has NO granularity argument.** CARD-V2-05 mentions "granularidad día / semana / mes", but that re-bucketing is a UI/leaf concern (same as Inicio v1's `TimelineChart` and the Phase 7 `BonosFlowChart`). Domain emits daily; the chart re-buckets to weekly / monthly when the user picks that toggle.

6. **`aggregatePurchasesByDate` does NOT zero-fill missing days.** Same convention as `aggregateRecargasByDate` and `aggregateBonosByDateV2`. The chart leaf handles its own empty-axis spacing; zero-fill at the domain layer would also make the dashboard look like the source of truth on "no-purchase days" — which it isn't (Sheets is).

7. **`TopCardUser.empresa` typed `string | undefined`.** Today (Phase 2 default) `empresa_nombre === tikintag` for every row so the field is always populated, but the type stays defensive for the eventual schema where empresa is a separate display column that may be optionally populated. Cost: zero. Benefit: future schema-evolution doesn't trigger a type-cascade.

8. **`aggregateTopCardUsers` sort tiebreak: `volumenCOP` DESC, then `compras` DESC.** Matches the deterministic-output convention from `aggregateByTikintag` in `bonos.ts` (which sorts `count` DESC then `monto` DESC). Different primary metric here (Uso Tarjeta ranks by spend, not by frequency), so primary/tiebreak are inverted — but the determinism guarantee is preserved.

## Deviations from Plan

### Field-name translation (plan vs actual codebase)

The plan's pseudo-code referenced fictional field names not present in the actual `Transaction` interface. I translated to the actual conventions:

| Plan's pseudo-name        | Actual `Transaction` field | Notes                                               |
|---------------------------|----------------------------|-----------------------------------------------------|
| `tx.transferTikintag`     | `tx.tikintag`              | The user holding the wallet. Plan's intent matches. |
| `tx.transferEmpresa`      | `tx.empresa_nombre`        | Display label; defaults to tikintag (Phase 2).      |
| `tx.transactionAmount`    | `tx.monto`                 | Same semantic; just naming.                         |
| `tx.date`                 | `tx.fecha`                 | Spanish naming (project convention).                |
| `filters.period.from/to`  | `filters.from / filters.to`| `DashboardFilters` is flat, not nested.             |

**Why this is not a Rule-1/2/3 deviation:** The plan's pseudo-code was structural/intent guidance, not literal contract. The actual contract is the `Transaction` and `DashboardFilters` types from `src/lib/domain/types.ts` and `src/lib/url-state.ts` — these are the @-context files the plan explicitly references. Translation to actual field names is the canonical execution path.

### Task 1 export count (plan said 3 interfaces, frontmatter must_haves listed 4)

The Task 1 prose said "Define and export 3 types at the top" but the literal type block in the same task listed 4 interfaces (`PurchaseSummary`, `PurchaseAdoption`, `PurchaseByDate`, `TopCardUser`). The frontmatter `must_haves.exports` confirms 4 interfaces total, and Task 2's verify (`grep ... | wc -l = 9`) requires 4 interfaces + 5 functions = 9 exports.

**Resolution:** Followed the structural intent — defined ALL 4 interfaces upfront in Task 1 (matching the convention in `bonos.ts` and `recargas.ts` which group all types together at the top of the module), then added the 3 aggregations in Task 2. Final: 4 interfaces + 5 functions = 9 exports, must_haves list satisfied verbatim.

### Plan-script vs project-actual lint command

Plan's verification specifies `npx next lint`. Next 16 dropped `next lint`; the project uses ESLint directly via `npm run lint` (resolves to `eslint`). The intent (lint must pass with 0 errors) was honored against the actual lint runner.

**Verification:** `npm run lint` returns 0 errors, 3 pre-existing project warnings (unchanged from baseline as logged in STATE.md after Plan 07-04).

---

**Total deviations:** 0 auto-fixed (no Rule 1/2/3 fixes needed — the plan's pseudo-code translated cleanly to actual codebase conventions; no missing critical functionality, no blocking issues, no architectural changes required).

**Impact on plan:** None. The translation work was within the bounds of "follow @-context files" — those files are the authoritative type contract.

## Issues Encountered

**`npx tsc` initially unavailable** — node was not in PATH (zsh nvm lazy-load not triggered in non-interactive shells). Resolved by prepending `$HOME/.nvm/versions/node/v24.11.0/bin` to PATH for each verification command, per the STATE.md "Vercel CLI fuera de PATH" pre-condition (same shape, generalizes to any node-shimmed binary).

## Parallel-wave race observations

**Sibling Plan 08-03 (recargas v2 augment) raced concurrently on `src/lib/domain/recargas.ts`.** Two race observations during this execution:

1. **Worktree contamination at Task 2 commit time:** When I ran `git status --short` immediately before staging Task 2, sibling 08-03 had already added 265 LOC of uncommitted edits to `recargas.ts`. My `cardUsage.ts` showed 159 LOC of edits. **Recovery:** Used explicit pathspec `git add -- src/lib/domain/cardUsage.ts` to stage ONLY my file. Sibling's `recargas.ts` worktree state survived the commit untouched.

2. **No tsc/lint impact in this case:** Sibling's pure-additions to `recargas.ts` compiled and lint-passed cleanly even mid-flight (additions only, no v1 modifications) — different shape from the Phase 7 race where sibling's pending consumer commit transiently broke lint. Confirms the v2-suffix coexistence pattern (Plan 07-01/07-03 SUMMARY decisions) keeps mid-wave builds green even when both plans modify the same module: as long as both plans append-only, the race is silent.

3. **Sibling commits landed during my SUMMARY phase:** `git log` after Task 2 showed `af8d2bb` (08-03 Task 1) and `d07ed47` (08-03 Task 2) interleaved with my `0292834` and `7bf2063`. The chronological commit-graph is `08-03-T1 → 08-01-T1 → 08-01-T2 → 08-03-T2`, which is fine because (a) the two plans modify disjoint files and (b) both plans use explicit pathspec staging. No fast-forward conflict. No rebase needed.

**Pattern confirmed:** explicit `git add -- <pathspec>` is the canonical recovery for parallel-wave Wave-1 plans. No git-stash dance needed when both plans append-only and the touched files are disjoint at the file-path level.

## User Setup Required

None — no external service configuration required. Pure domain library, zero new dependencies, zero env vars.

## Next Phase Readiness

- **Plan 08-02 ready to consume:** `/uso-tarjeta/page.tsx` page composition can import `filterPurchases`, `summarizePurchases`, `aggregatePurchaseAdoption`, `aggregatePurchasesByDate`, `aggregateTopCardUsers` directly. Composition contract: page runs `filterPurchases(allTx, filters)` once → passes the filtered set + the period-scoped `allTx` to `aggregatePurchaseAdoption` for the adoption KPI; chains the filtered set into the other 3 aggregations (summary, by-date, top-users) without re-filtering.
- **No v1 prune obligation** — Uso Tarjeta is brand new, so no v1 file or v1 component needs to be deleted when Plan 08-02 lands.
- **Sibling Plan 08-03 (recargas v2 augment) progressing in parallel** — both Plan 08-03 commits already landed (`af8d2bb`, `d07ed47`); Wave 1 of Phase 8 is converging cleanly.
- **No blockers or concerns carried forward.** Verification floor (tsc + lint + build) green at SUMMARY time even with sibling worktree edits in flight.

---
*Phase: 08-tarjeta-recargas*
*Completed: 2026-05-07*
