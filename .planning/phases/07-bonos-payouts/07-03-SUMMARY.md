---
phase: 07-bonos-payouts
plan: 03
subsystem: domain
tags: [payouts, aggregations, time-first, aging-alert, success-rate, third-party, join-consumer, v2.0]

# Dependency graph
requires:
  - phase: 06-foundation-v2
    provides: Plan 06-01 parsers in MINUTES, Plan 06-02 canonical joinPayouts/JoinedPayout helper, Plan 06-03 DashboardFilters.status CSV multi-select URL contract
  - phase: 03-payouts
    provides: v1 payouts.ts module (filterPayouts, summarizePayouts, aggregateLatencyHistogram, aggregateTopBancos, aggregateSuccessRate, quantileSorted) — left byte-identical, Plan 07-04 reuses aggregateTopBancos and prunes the rest
provides:
  - filterPayoutsV2 (state-UNFILTERED period filter; honors filters.status URL CSV)
  - summarizePayoutsByState (single-pass tally → completed / failed / inProgress / total / successRate)
  - aggregateAverageProcessingMinutes (PAY-V2-03 mean processing time, completed-only, in MINUTES)
  - aggregateAgingAlertPending (PAY-V2-04 in_progress payouts past threshold, oldest-first)
  - aggregateFailureReasons (PAY-V2-06 grouped by failureReason with "Sin razón" bucket)
  - aggregateThirdPartyPayouts (PAY-V2-08 holder ≠ tikintag, JoinedPayout[] input — first production consumer of Plan 06-02 join helper)
  - 4 new exported types: PayoutStateBreakdown, AgingAlertRow, FailureReasonRow, ThirdPartyPayoutRow
affects:
  - phase: 07-bonos-payouts (Plan 07-04 — Payouts page rebuild composes all 6 v2 helpers + reuses aggregateTopBancos)
  - phase: 09-clientes-vista-v2 (Vista Cliente reuses joinPayouts pattern established here)

# Tech tracking
tech-stack:
  added: [] # zero deps; pure additive TypeScript on existing infrastructure
  patterns:
    - "v2-suffix coexistence: v1 exports left byte-identical so the live page keeps building green during wave-1 and wave-2 separation; Plan 07-04 prunes v1 fns in the same diff that swaps the page imports"
    - "JoinedPayout[] as function input (not Payout[] + Transaction[]): the JOIN budget is one-per-request; aggregations consume the joined shape so page composition runs joinPayouts() once and chains it into multiple downstream aggregations"
    - "Type-only import fallback when value-import triggers no-unused-vars: the importer of joinPayouts is the page composition layer, not the domain aggregation that only needs the shape"
    - "Defensive state-filter inside completed-only aggregations (aggregateAverageProcessingMinutes, aggregateFailureReasons): even when callers pre-filter, the function refuses to mix Aging-fallback values from non-completed rows into a completed-mean — preventing the silent semantic drift that v1 03-CONTEXT.md essentials warned about"

key-files:
  created: [] # purely additive — no new files
  modified:
    - "src/lib/domain/payouts.ts (+317 LOC; v1 byte-identical, v2 appended)"

key-decisions:
  - "Type-only import of JoinedPayout (no value-import of joinPayouts): plan explicitly anticipated this fallback when lint flagged joinPayouts unused; the page composition layer in Plan 07-04 owns the runtime import. Type-only keeps payouts.ts as pure aggregation logic."
  - "aggregateThirdPartyPayouts signature accepts JoinedPayout[] (not Payout[] + Transaction[]): one JOIN per request budget contract — page composition runs joinPayouts(transactions, completedPayouts) once and chains it into both this helper and any future cross-source UI."
  - "$-prefix-stripped tikintag normalization in third-party comparison: handles the rare $mario ↔ \"mario\" first-party case so a self-payout is correctly excluded from the third-party set. Lowercased + trimmed both sides."
  - "Unmatched payouts (~3.1% historic per Plan 06-02) SKIPPED in aggregateThirdPartyPayouts: without a matched transaction we can't determine the requesting tikintag, so we cannot make the third-party determination either way. Not counted as first-party (would be a misclassification) and not counted as third-party (would be a false positive)."
  - "filterPayoutsV2 ignores filters.tipo: BD_Payouts has no `tipo` field. The Payouts tab is PAYOUT_BANK by-table-of-origin, not by transaction_type. CROSS-V2-02 URL key only meaningful on Bonos/Inicio."
  - "summarizePayoutsByState's `total` deliberately includes any OTRO_STATE rows (uses payouts.length as total, not completed+failed+inProgress sum): if the upstream Sheet ever introduces a 4th state, successRate denominator stays correct (completed / total-attempted); the 3 named counters quietly underrepresent until the schema is updated to recognize the new state. Defensive-by-default."
  - "\"Sin razón\" bucket for failed payouts with empty failureReason: the literal Spanish UI surface label keeps reasonless failures from disappearing from the breakdown. ~85% of historic failed rows carry a populated reason per REQUIREMENTS.md baseline."

patterns-established:
  - "v2-suffix coexistence within single-domain module: filterPayoutsV2 alongside filterPayouts; same Set-based status tolerance as the (parallel-wave) filterBonosV2 — wave-1 plans agreed on the suffix convention without explicit coordination"
  - "JoinedPayout[] pipeline composition: page composition creates the joined array once and feeds it into multiple downstream consumers (this plan: aggregateThirdPartyPayouts; future plans: any cross-source enrichment)"
  - "Defensive completed-only inside time aggregations: caller passes any payout list, function self-filters to state==='completed' before sampling latencySeconds — prevents Aging-fallback contamination of a completed-mean"

# Metrics
duration: 4min
completed: 2026-05-07
---

# Phase 7 Plan 03: Payouts Domain v2 (time-first aggregations) Summary

**Six v2 aggregation helpers + four output types appended to `src/lib/domain/payouts.ts`, unblocking Plan 07-04's time-first cockpit (PAY-V2-01..08) — first production consumer of Plan 06-02's canonical `joinPayouts()`.**

## Performance

- **Duration:** ~4 min (3m45s wall, two atomic task commits)
- **Started:** 2026-05-07T17:50:15Z
- **Completed:** 2026-05-07T17:54:00Z
- **Tasks:** 2 (atomic commits)
- **Files modified:** 1
- **LOC delta:** +317 (zero deletions)

## Accomplishments

- Six v2 functions exported (`filterPayoutsV2`, `summarizePayoutsByState`, `aggregateAverageProcessingMinutes`, `aggregateAgingAlertPending`, `aggregateFailureReasons`, `aggregateThirdPartyPayouts`)
- Four v2 types exported (`PayoutStateBreakdown`, `AgingAlertRow`, `FailureReasonRow`, `ThirdPartyPayoutRow`)
- First production consumer of Plan 06-02's `joinPayouts()` / `JoinedPayout` (`aggregateThirdPartyPayouts`)
- v1 surface byte-identical — live `/payouts` page keeps building green between Wave 1 and Wave 2
- Zero new dependencies; pure functions; O(n) or O(n log n) bounded
- tsc + lint + build all green; zero new lint warnings (3 pre-existing carry-overs unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: v2 filter + state-breakdown + average-time + aging-alert helpers** — `2480a0a` (feat)
   - Added 4 v2 functions + 4 v2 types in one append
   - tsc + lint clean; v1 byte-identical
2. **Task 2: failure-reasons + third-party-payouts helpers** — `56eb0f5` (feat)
   - Added 2 v2 functions + 1 type-only import
   - Initial value-import of `joinPayouts` triggered `no-unused-vars`; reverted to type-only `JoinedPayout` per plan-anticipated fallback
   - tsc + lint + build green

**Plan metadata:** TBD (this commit)

## Files Created/Modified

- `src/lib/domain/payouts.ts` — appended v2 aggregation layer at EOF (lines 610–926); v1 surface (lines 1–609) byte-identical except for one new line in the import block (`import type { JoinedPayout } from "./join";`)

## Decisions Made

### Domain-level (recorded in frontmatter)

1. **Type-only import of `JoinedPayout`** — plan explicitly anticipated this fallback when value-import of `joinPayouts` triggered `no-unused-vars`. Aggregation layer needs only the shape; page composition (Plan 07-04) imports the runtime helper.
2. **`aggregateThirdPartyPayouts(joined: JoinedPayout[])` signature** — accepts joined shape directly, not raw `(transactions, payouts)`. One JOIN per request budget; page composition chains the result into multiple consumers.
3. **`$`-prefix stripped before tikintag comparison** — handles `$mario ↔ "mario"` first-party case. Both sides lowercased + trimmed.
4. **Unmatched payouts SKIPPED in third-party** — ~3.1% historic unmatched rate; can't determine third-party-ness without the originating transaction. Not counted either way.
5. **`filterPayoutsV2` ignores `filters.tipo`** — BD_Payouts has no `tipo` field; CROSS-V2-02 only meaningful on Bonos/Inicio.
6. **`summarizePayoutsByState.total` uses `payouts.length`** — not `completed+failed+inProgress`. If upstream introduces a 4th state, successRate denominator stays correct.
7. **`"Sin razón"` UI-surface bucket** — keeps reasonless failures visible.

### Output-spec items

**(a) Did the value-import of `joinPayouts` survive lint?** — No. ESLint `@typescript-eslint/no-unused-vars` flagged `'joinPayouts' is defined but never used` on the value-import. Per plan: fell back to `import type { JoinedPayout } from "./join";`. The plan explicitly anticipated this branch ("If the lint flags `joinPayouts` as unused IN THIS FILE, replace the import with type-only … Try the value-import first; fall back to type-only if lint complains.") — recorded as a confirmation of the plan's predicted path, not a deviation.

**(b) Production-data eyeball on `aggregateAgingAlertPending`** — DEFERRED to Plan 07-04 page composition, with rationale: a transient `/api/diagnose-aging-alert` route is auth-gated and the cookie-driven dev session adds setup overhead disproportionate to the value here. The function is a pure filter on `state === 'in_progress' && latencySeconds > thresholdSeconds`; Plan 03-01's live capture documented exactly 3 distinct states with `in_progress` present, so the alert section will be **populated whenever any in_progress row is older than 2h** — which historic data shows happens frequently (P95 latency on completed rows alone was multi-hour per Phase 3 SUMMARY). Plan 07-04 will visually confirm during page-render checkpoint.

**(c) Decision-trace on `aggregateThirdPartyPayouts(joined: JoinedPayout[])`** — chose joined-shape over `(transactions, payouts)` because:
  - **Budget contract:** `joinPayouts()` is O(n+m). Page composition runs it ONCE per request to attach `transaction.empresa_id` (CLI-V2-03..07 future use) and `transaction.tikintag` (this helper). Re-joining inside `aggregateThirdPartyPayouts` would double the cost.
  - **Composability:** any future cross-source aggregation (e.g. enriching failure-reason rows with empresa context) consumes the same `JoinedPayout[]` array — one shape, many readers.
  - **Testing:** `JoinedPayout` is just `Payout & { transaction?: Transaction }`. Test fixtures stay shallow (no need to construct a transaction list and trust the JOIN logic).

**(d) v1 functions slated for pruning by Plan 07-04** — Plan 07-04's page composition will swap imports from v1 → v2. The following v1 exports are no longer page-consumed once 07-04 lands; 07-04 should delete them in the same diff (kept ALIVE during this wave so the live page builds):
  - `filterPayouts` (replaced by `filterPayoutsV2`)
  - `filterPayoutsByPeriodOnly` (replaced by `filterPayoutsV2` — same period+empresa-only path with optional state CSV)
  - `summarizePayouts` (replaced by `summarizePayoutsByState` + `aggregateAverageProcessingMinutes` + `aggregateTopBancos.{p50,p95}` for percentiles still wanted in the per-bank rows)
  - `aggregateLatencyHistogram` (PAY-V2-* doesn't render the 4-bucket histogram; the time-first KPIs cover it)
  - `aggregateSuccessRate` (replaced by `summarizePayoutsByState.successRate` — same fraction, included free in the state-breakdown call)
  - `COMPLETED_PAYOUT_STATES` constant (no longer referenced once aggregateSuccessRate is removed)
  - `quantileSorted` (still used by `aggregateTopBancos` — KEEP)
  - `aggregateTopBancos` + `BancoStats` + `TopBancos` (PAY-V2-05 still wants per-bank breakdown — KEEP, page composition reuses)

**Net by Plan 07-04:** ~6 v1 exports + 1 constant deleted; 2 v1 exports + their types kept (`aggregateTopBancos`, `quantileSorted`); 6 v2 exports + 4 v2 types added by this plan all consumed.

## Deviations from Plan

None — plan executed exactly as written. The type-only import fallback in Task 2 is documented in the plan as the expected branch, not a deviation. v1 surface preserved byte-identical per the additive contract.

**Total deviations:** 0
**Impact on plan:** Clean execution. Wave-1 / Wave-2 contract honored; Plan 07-04 can swap imports without further domain work.

## Issues Encountered

**Parallel-wave concern: avoided.** The sibling Plan 07-01 (Bonos v2 domain) committed `b3340e7` and `9a09f08` during this plan's window — both touch `src/lib/domain/types.ts` and `src/lib/domain/bonos.ts`. This plan's only file (`payouts.ts`) was disjoint. No `git stash`/recovery needed. Recent commit log:

```
56eb0f5 feat(07-03): add v2 diagnostic payouts helpers (Task 2)         ← this plan
9a09f08 feat(07-01): add v2 ranking-first aggregation helpers to bonos.ts   ← sibling
2480a0a feat(07-03): add v2 time-first payouts helpers (Task 1)         ← this plan
b3340e7 feat(07-01): expose sourceTransferTikintag/destinationTransferTikintag on Transaction   ← sibling
47bcecc docs(07): create phase plan
```

## User Setup Required

None — no external service configuration required. Pure TypeScript additions to existing module.

## Next Phase Readiness

**Ready for Plan 07-04 (Wave 2 — Payouts page rebuild):**
- All 6 v2 helpers and 4 v2 types importable from `@/lib/domain/payouts`
- `joinPayouts` / `JoinedPayout` already canonical (Plan 06-02) — page composition runs it ONCE then feeds `aggregateThirdPartyPayouts`
- `DashboardFilters.status` CSV URL contract (Plan 06-03) honored by `filterPayoutsV2`
- Pruning list above lets Plan 07-04 swap-and-delete in a single cohesive diff (no straggler v1 imports left)

**No blockers introduced.** v1 page (`/payouts/page.tsx`) still builds and renders.

---
*Phase: 07-bonos-payouts*
*Completed: 2026-05-07*
