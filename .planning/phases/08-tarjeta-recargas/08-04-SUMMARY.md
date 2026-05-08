---
phase: 08-tarjeta-recargas
plan: 04
subsystem: ui
tags: [recargas, method-split, amount-distribution, top-rechargers-by-tikintag, stacked-timeline, recharts, v2.0, partial-prune, deferral, recovery-pattern]

# Dependency graph
requires:
  - phase: 06-foundation-v2
    provides: Plan 06-04 section-recargas (Teal OKLCH) Tailwind utility + dark-mode lift; CROSS-V2-07 conservative-default per-metric visibility (we opt out — no `data-presenter-*` here)
  - phase: 08-tarjeta-recargas
    provides: Plan 08-03 v2 surface — `filterRecargasV2`, `summarizeRecargasV2`, `aggregateRechargesByDateV2`, `aggregateRechargeAdoption`, `aggregateRechargeMethodSplit`, `aggregateRechargeAmountDistribution`, `aggregateTopRechargers` + 6 v2 types
provides:
  - RecargasKPICardsV2 (4-card KPI strip — total recargas + volumen + adopción + recarga promedio; section-recargas accent on the primary)
  - MethodSplitCard (PSE vs Transferencia two-column split; count-based share + COP volume; CSS-only horizontal share bars, no Recharts)
  - AmountDistribution (3-bucket mini-table — <$100K / $100K-$1M / >$1M; always renders all 3 buckets for stable axis even when zero)
  - TopRechargers (raw `<table>` ranking by `tikintag` — NOT empresa; semantic v1→v2 shift per PRD REC-V2-07)
  - RecargasTrendChartV2 (Client Component, "use client" — Recharts BarChart with stacked PSE + TRANSFER bars; OKLCH-pinned fills)
  - v2 Recargas page composition — method-and-distribution-first cockpit (KPI strip → MethodSplit | AmountDistribution at lg:grid-cols-2 → TopRechargers full-width → RecargasTrendChartV2 full-width)
  - Audit-gated v1 leaf prune (4 deletions; recargas.ts UNTOUCHED)
affects:
  - phase: 09-clientes-vista-v2 (Vista Cliente rewrite must migrate the 10 deferred v1 recargas symbols off `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx`; final v1 prune of `recargas.ts` lands when Phase 9 ships — joins the bonos and payouts deferred-prune lists already on the Phase 9 docket)

# Tech tracking
tech-stack:
  added: [] # zero deps; pure additive TypeScript + Tailwind on existing infrastructure (Recharts already in repo)
  patterns:
    - "Method-and-distribution-first cockpit layout (parallel to Phase 7's time-first / ranking-first patterns) — primary KPI text-4xl with section accent, two diagnostic protagonists side-by-side at lg:grid-cols-2 (MethodSplit + AmountDistribution), ranking layer full-width below, temporal layer full-width at bottom"
    - "Top-rankings grouping by `tikintag` (user identity) NOT by `empresa` — explicit v1→v2 semantic shift per PRD REC-V2-07; the v2 cockpit answers 'who is recharging the most' (user lens), not 'which empresa is sending the most' (empresa lens)"
    - "Stacked PSE/TRANSFER BarChart timeline via Recharts `Bar stackId='recargas'` — chosen over two-series LineChart because share-comparison is the primary visual story (count-based share baseline 85% PSE / 15% TRANSFER per PRD); stacked bars make the share visually immediate at every date"
    - "Adoption denominator = full `allTx` pool, NOT period-filtered separately — caller threads `allTx` into both `filterRecargasV2(allTx, filters)` and `aggregateRechargeAdoption(allTx, recargaRows)`; one filter pass, multiple aggregations; same convention as Plan 08-02's purchase adoption"
    - "Recovery pattern for stream-idle timeout WHEN previous agent built artifacts on disk pre-commit — fresh continuation agent audits artifacts (git status + grep + tsc/lint smoke tests), commits verbatim if clean, then resumes the plan from the next task. Distinct from checkpoint-resume (which carries explicit completed-task hashes). Canonical pattern for mid-task timeouts where work-in-progress is recoverable via filesystem inspection."

key-files:
  created:
    - "src/components/recargas/RecargasKPICardsV2.tsx (125 LOC)"
    - "src/components/recargas/MethodSplitCard.tsx (110 LOC)"
    - "src/components/recargas/AmountDistribution.tsx (98 LOC)"
    - "src/components/recargas/TopRechargers.tsx (102 LOC)"
    - "src/components/recargas/RecargasTrendChartV2.tsx (154 LOC)"
  modified:
    - "src/app/(protected)/recargas/page.tsx (full rewrite, 185 LOC final; net delta in commit was +108 / -98 over the v1 page that mixed prior-period KPI badges with empresa-centric hechos curados)"
  deleted:
    - "src/components/recargas/RecargasKPICards.tsx (-75 LOC, v1 4-card strip with prior-period badges)"
    - "src/components/recargas/RecargasTable.tsx (-94 LOC, v1 top-empresas ranking by transferEmpresa)"
    - "src/components/recargas/HechosCuradosRecargas.tsx (-104 LOC, v1 Inicio-style hechos curados block — top empresa + recarga más grande hechos)"
    - "src/components/recargas/RecargasTrendChart.tsx (-94 LOC, v1 single-series total chart)"

key-decisions:
  - "Method-and-distribution-first cockpit layout — sibling pattern to Phase 7's time-first (Plan 07-04) and ranking-first (Plan 07-02) cockpits; primary KPI (Total recargas) is text-4xl with `text-section-recargas` (Teal); two diagnostic protagonists (MethodSplit + AmountDistribution) at lg:grid-cols-2 below; TopRechargers + RecargasTrendChartV2 full-width below that. Reusable shape for any future operational cockpit where a primary KPI + two diagnostic protagonists + ranking + temporal is the right shape."
  - "Stacked BarChart over two-series LineChart for the timeline — PRD baseline is a count SHARE story (85% PSE / 15% TRANSFER); stacked bars at each date make the share visually immediate (PSE column always sits on top of TRANSFER column at every date), whereas a two-line chart forces eye-arithmetic. Two BarChart series with `stackId='recargas'`, OKLCH-pinned fills (PSE = `oklch(0.62 0.10 200)`, TRANSFER = `oklch(0.42 0.10 200)`), Tooltip shows PSE + TRANSFER + total."
  - "Top rechargers grouped by `tikintag` (user) NOT by empresa — explicit v1→v2 semantic shift per PRD REC-V2-07. v1 RecargasTable ranked top empresas by `transferEmpresa`; v2 TopRechargers ranks top 10 USERS by `tikintag`. Empresa column shown as a label on each row (denormalized via the user's first observed empresa_nombre). Diagnostic value: who's the heaviest individual recharger, not which empresa sends the most aggregate volume."
  - "Section accent applied SURGICALLY to ONE focal metric across the page — `text-section-recargas` (Teal) at line 66 of RecargasKPICardsV2.tsx on the 'Total recargas' primary card (text-4xl). Verified with `grep -rE 'text-section-recargas' src/components/recargas/` — exactly 1 reference. Mirrors the Phase 7 surgical-accent discipline (one Teal accent vs whole-page Teal flooding)."
  - "Adoption denominator = full `allTx` pool — caller threads `allTx` (the entire transaction stream from `getCachedTransactions().rows`) into BOTH `filterRecargasV2(allTx, filters)` AND `aggregateRechargeAdoption(allTx, recargaRows)`. Numerator (users who recharged in period) computed from period-filtered `recargaRows`; denominator (total users in pool) computed from unfiltered `allTx`. Decision: a per-period adoption rate divided by the SAME period's user count would be ~100% by definition (every user who appears appears because they had activity); v2 wants 'X% of all known users have recharged' as a stable adoption signal. Same convention as Plan 08-02's purchase adoption."
  - "v2 Recargas drops prior-period comparison — v1 Recargas KPI cards carried period-vs-period badges (computePriorPeriod + delta arrows). v2 KPIs are standalone, no badges. PRD lens shift: REC-V2-* requirements describe absolute counts/volumes/shares, not deltas. computePriorPeriod logic removed from this page; the helper itself stays alive for Inicio (Phase 10) consumption."
  - "`txResult.rows` (not `.data`) is the AdapterResult shape — pre-checkpoint prose drift in the agent's mental model said `.data`; the actual return type from `src/lib/sheets/transactions.ts` exposes `rows`. Types are authoritative (tsc would have surfaced the mismatch). Fixed inline before commit; documented under Deviations."
  - "No `data-presenter-*` attributes on this page — conservative-default per CROSS-V2-07. Phase 8 PRD does not specify per-metric hides for Recargas. Phase 9 may revisit if a CLI-V2 requirement covers Recargas presenter-mode behavior."
  - "`use client` only on `RecargasTrendChartV2.tsx` (Recharts requires DOM). Other 4 leaves are Server Components — KPI strip, MethodSplit, AmountDistribution, TopRechargers. Page itself is async Server Component with `export const dynamic = 'force-dynamic'`."
  - "Field-name reconciliation when PLAN.md cited PRD-vocabulary fields — PLAN.md `<action>` blocks referenced `tx.transferTikintag`, `tx.transactionAmount`, `tx.transferEmpresa`, `tx.date`, `filters.period.from/to`. Actual `Transaction` fields are `tikintag`, `monto`, `empresa_nombre`/`empresa_id`, `fecha`; actual `DashboardFilters` is FLAT (`from`/`to`, no `period` namespace). Translated inline at every call site — types.ts is the authoritative @-context contract, pseudo-code is intent guidance. Same translation pattern Plans 08-01 + 08-03 hit independently."
  - "Stream-idle timeout recovery (Task 1) — the original execute-plan agent built all 5 leaf components on disk and got stream-idle-killed BEFORE the Task 1 commit. A recovery agent picked up, audited the 5 files (git status + tsc + lint passes), committed them VERBATIM as Task 1 (`0619d65`), then continued cleanly to Task 2. Distinct from a checkpoint-resume (which carries explicit prior commit hashes); this is a mid-task recovery via filesystem-state inspection. New canonical pattern."

patterns-established:
  - "Method-and-distribution-first cockpit — joins the family of Phase 7 cockpit patterns (time-first 07-04, ranking-first 07-02). Reusable: primary KPI + section accent + two diagnostic protagonists at lg:grid-cols-2 + ranking + temporal. Future v2 sections (Inicio rewrite Phase 10, Vista Cliente Phase 9) inherit the same shape vocabulary."
  - "Tikintag-as-rank-key for user-lens rankings — Phase 7 Bonos established TopEmisores/TopReceptores by `sourceTransferTikintag` / `destinationTransferTikintag`; Phase 8 Recargas establishes TopRechargers by `tikintag`; Phase 8 Uso Tarjeta establishes TopCardUsers by `tikintag`. Tikintag is the canonical user identity at v2 ranking layer; empresa-as-rank-key is a v1 idiom."
  - "Stacked-bar timeline for share stories — when the temporal story IS the count share between two categories (PSE vs TRANSFER), `BarChart` with two `Bar stackId='same'` series beats a two-series LineChart for cognitive load. Mirror of any future binary/ternary share-over-time visualization."
  - "Stream-idle recovery pattern for mid-task timeouts — if the previous agent left tsc-clean, lint-clean artifacts on disk pre-commit, the recovery agent audits + commits verbatim + resumes from the next task. No re-execution from scratch. Catalogued for future agents recovering from analogous timeouts; complements the existing checkpoint-resume pattern (which carries explicit commit hashes from a paused agent)."

# Metrics
duration: ~30min wall-clock across two agent generations (original Task 1 build + recovery commits + Task 2 + checkpoint + this docs commit)
completed: 2026-05-07
---

# Phase 8 Plan 04: Recargas Page v2 (method-and-distribution-first cockpit) Summary

**v2 Recargas cockpit shipped — 4-card KPI strip (Total recargas + Volumen + Adopción + Recarga promedio; Teal section accent on the primary) → MethodSplitCard | AmountDistribution side-by-side at lg:grid-cols-2 → TopRechargers ranking by `tikintag` (NOT empresa, the explicit v1→v2 semantic shift per PRD) → RecargasTrendChartV2 stacked PSE/TRANSFER BarChart timeline. 4 v1 leaves deleted (audit clean — sole consumer was the rewritten page). 10 v1 recargas.ts symbols KEPT alive deferred to Phase 9 (Vista Cliente rewrite, joins the bonos and payouts deferred-prune lists already on the Phase 9 docket).**

## Performance

- **Duration:** ~30 min wall-clock across two agent generations
  - Original execute-plan agent: built the 5 leaves on disk (~15 min effort) → stream-idle-killed BEFORE the Task 1 commit
  - Recovery continuation agent: audited the 5 files + committed Task 1 verbatim + executed Task 2 + reached visual checkpoint (~15 min effort)
  - This docs continuation agent: SUMMARY.md + STATE.md + plan-metadata commit
- **Started:** 2026-05-07T22:00:00Z (original agent task 1 build start, approx)
- **Completed:** 2026-05-07T22:35:00Z (post-checkpoint approval)
- **Tasks:** 2 atomic auto-task commits + 1 visual checkpoint (approved) + 1 plan-metadata commit (this commit)
- **Files modified:** 1 (recargas/page.tsx full rewrite)
- **Files created:** 5 v2 leaf components
- **Files deleted:** 4 v1 leaf components
- **LOC delta:** +697 / -465 across the two task commits (Task 1: +589/0; Task 2: +108/-465 = page rewrite +/- + 4 deletions)

## Accomplishments

- **5 new v2 leaf components** in `src/components/recargas/` (589 LOC) honoring the section-recargas (Teal OKLCH from Plan 06-04) accent — surgical, applied to ONE focal metric (the Total recargas primary card)
- **Page composition** — method-and-distribution-first cockpit (KPI strip → MethodSplit | AmountDistribution side-by-side → TopRechargers full-width → RecargasTrendChartV2 stacked timeline)
- **First production consumers** of all 7 v2 fns from Plan 08-03 — `filterRecargasV2`, `summarizeRecargasV2`, `aggregateRechargesByDateV2`, `aggregateRechargeAdoption`, `aggregateRechargeMethodSplit`, `aggregateRechargeAmountDistribution`, `aggregateTopRechargers`
- **Audit-gated v1 prune** — all 4 v1 leaves had `/recargas/page.tsx` as their SOLE consumer; deletion clean
- **`recargas.ts` UNTOUCHED in this plan** — 10 v1 domain symbols kept byte-identical (deferral to Phase 9 — third instance of the deferral pattern from Plans 07-02 / 07-04)
- **tsc + lint + build all green** (0 errors, 3 pre-existing warnings unchanged)
- **Visual checkpoint approved** by user (without per-issue feedback — the cockpit landed visually correct on first render)
- **Recovery pattern catalogued** — the original agent's stream-idle-during-Task-1 timeout was recoverable via filesystem inspection (the leaves were on disk, tsc-clean, lint-clean); recovery agent committed verbatim and continued

## Task Commits

Each task was committed atomically:

1. **Task 1: Build the 5 v2 leaf components** — `0619d65` (feat)
   - 5 new files: RecargasKPICardsV2.tsx (125 LOC) + MethodSplitCard.tsx (110 LOC) + AmountDistribution.tsx (98 LOC) + TopRechargers.tsx (102 LOC) + RecargasTrendChartV2.tsx (154 LOC) = 589 LOC total
   - All Server Components except RecargasTrendChartV2.tsx (`"use client"`)
   - Section accent surgical: `text-section-recargas` at exactly 1 location across the 5 files
   - Committed by recovery agent (original agent built on disk pre-commit; recovery audited + committed verbatim)
2. **Task 2: Rewrite /recargas/page.tsx + audit-gated v1 leaf prune** — `2a82a58` (feat)
   - Full rewrite of `src/app/(protected)/recargas/page.tsx` (185 LOC final; commit shows +108/-98 page-only, plus -367 across 4 deletions)
   - Composition: KPICardsV2 → grid lg:grid-cols-2 [MethodSplit | AmountDistribution] → Card[TopRechargers] → Card[RecargasTrendChartV2]
   - ONE `filterRecargasV2(allTx, filters)` pass feeds 6 aggregations (summarize + adoption + methodSplit + amountDistribution + topRechargers + byDateV2)
   - Adoption call signature: `aggregateRechargeAdoption(allTx, recargaRows)` — full pool denominator
   - Removed: `computePriorPeriod` + period-vs-period badge logic (PRD lens shift)
   - 4 v1 leaves deleted (audit clean): `RecargasKPICards.tsx`, `RecargasTable.tsx`, `HechosCuradosRecargas.tsx`, `RecargasTrendChart.tsx` (-367 LOC)
   - `recargas.ts` UNTOUCHED — confirmed via `git log d07ed47..HEAD -- src/lib/domain/recargas.ts` (empty)

**Plan metadata:** TBD (this commit)

## Files Created/Modified

**Created:**
- `src/components/recargas/RecargasKPICardsV2.tsx` (125 LOC) — 4-card KPI strip; primary card "Total recargas" carries `text-section-recargas` (Teal) at text-4xl
- `src/components/recargas/MethodSplitCard.tsx` (110 LOC) — PSE vs Transferencia two-column split; count + share % + COP volume per side; CSS-only horizontal share bars (no Recharts on this leaf — keeps server-render path simple); empty-state placeholder when totalCount===0
- `src/components/recargas/AmountDistribution.tsx` (98 LOC) — 3-bucket mini-table; bucket boundaries per Plan 08-03 inclusivity contract; renders all 3 buckets always (stable axis even when zero); JSDoc cites REC-V2-06
- `src/components/recargas/TopRechargers.tsx` (102 LOC) — raw `<table>` markup (no shadcn ui/table primitive in repo — Phase 7 convention); 6 columns: # / Tikintag / Empresa / Recargas / Volumen / Recarga promedio; numeric columns right-aligned + `tabular-nums`; empty-state placeholder
- `src/components/recargas/RecargasTrendChartV2.tsx` (154 LOC) — `"use client"`; Recharts BarChart with two `Bar stackId='recargas'` series (PSE on top, TRANSFER below); OKLCH-pinned fills; Tooltip shows PSE count + TRANSFER count + total; X-axis short-date tick formatter; empty-state Card body

**Modified:**
- `src/app/(protected)/recargas/page.tsx` (185 LOC final, +108/-98 over v1 in commit) — full v2 rewrite

**Deleted:**
- `src/components/recargas/RecargasKPICards.tsx` (-75 LOC) — v1 4-card strip with prior-period badges (replaced by RecargasKPICardsV2)
- `src/components/recargas/RecargasTable.tsx` (-94 LOC) — v1 top-empresas ranking by transferEmpresa (replaced by TopRechargers, with the explicit v1→v2 grouping shift to tikintag)
- `src/components/recargas/HechosCuradosRecargas.tsx` (-104 LOC) — v1 Inicio-style hechos curados block (top empresa hecho + recarga más grande hecho); v2 lens drops these in favor of MethodSplit + AmountDistribution as the "what's the shape" diagnostics
- `src/components/recargas/RecargasTrendChart.tsx` (-94 LOC) — v1 single-series total chart (replaced by RecargasTrendChartV2's stacked PSE/TRANSFER timeline)

**Final tree shape (`src/components/recargas/`):**
```
AmountDistribution.tsx       (NEW — Task 1)
MethodSplitCard.tsx          (NEW — Task 1)
RecargasKPICardsV2.tsx       (NEW — Task 1)
RecargasTrendChartV2.tsx     (NEW — Task 1)
TopRechargers.tsx            (NEW — Task 1)
```
5 files, all v2.

## Deferred v1 prune — 10 symbols KEPT alive in `src/lib/domain/recargas.ts`

**Mirror of the deferral pattern established in Plans 07-02 + 07-04 + Plan 08-03 (third instance, fourth occurrence — Plan 08-03 set up the deferral by appending v2 below v1 byte-identical; Plan 08-04 confirms the deferral by NOT touching `recargas.ts` during the page rewrite).**

`recargas.ts` was NOT modified in this plan (verified via `git log d07ed47..HEAD -- src/lib/domain/recargas.ts` empty). All 10 v1 exports remain byte-identical:

| Symbol | Kind | Still consumed by |
|--------|------|-------------------|
| `filterRecargas` | function | `clientes/[empresaId]/page.tsx` |
| `summarizeRecargas` | function | `clientes/[empresaId]/page.tsx` |
| `aggregateRecargasByDate` | function | `clientes/[empresaId]/page.tsx` |
| `aggregateRecargasByEmpresa` | function | (orphan after this plan — was only consumed by deleted v1 RecargasTable; KEPT for prune symmetry — see rationale below) |
| `top10RecargasEmpresas` | function | (orphan after this plan — same as above) |
| `findTopEmpresaRecargadora` | function | (orphan — only consumed by deleted v1 HechosCuradosRecargas) |
| `findRecargaMasGrande` | function | (orphan — same as above) |
| `RecargaSummary` | interface | `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx` (prop type) |
| `RecargaByDate` | interface | `clientes/[empresaId]/page.tsx` |
| `RecargaByEmpresa` | interface | (orphan — was only used by deleted v1 RecargasTable + RecargasByEmpresa aggregations) |

**Why KEEP all 10 (including the 5 orphans) rather than partial-prune the orphans now:**

Pruning the 5 orphaned symbols while keeping the 5 still-consumed-by-clientes symbols would leave `recargas.ts` in a partial-v1 state that's confusing to read on its own — the file would document "v1 fns: filterRecargas + summarizeRecargas + aggregateRecargasByDate + RecargaSummary + RecargaByDate" without the symmetric ranking/hechos helpers a v1 page would have called. Future readers (Phase 9 author, future Claude sessions) would have to reverse-engineer "which v1 symbols got cherry-picked away and why" from git history. Cleaner: keep all 10 alive as a coherent v1 surface, prune as one cohesive diff when Phase 9 (Vista Cliente v2 — `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx` rewrite) migrates the 5 still-consumed symbols off, leaving all 10 orphaned simultaneously. Final prune lands as a 1-task cleanup in whichever Phase 9 plan touches `recargas.ts` last.

**Migration path (Phase 9):**
1. Phase 9 rewrites `clientes/[empresaId]/page.tsx` to compose v2 helpers (replace `filterRecargas + summarizeRecargas + aggregateRecargasByDate` with `filterRecargasV2 + summarizeRecargasV2 + aggregateRechargesByDateV2`).
2. Phase 9 rewrites `EmpresaMiniCards.tsx` to swap prop type from `RecargaSummary` to `RecargaSummaryV2` (and `RecargaByDate` → `RecargaByDateV2` if the mini-card consumes it).
3. After both consumers migrate, all 10 v1 symbols become orphans; final prune deletes the entire v1 block from `recargas.ts` in one cohesive diff.

**Joins the Phase 9 deferred-prune docket** — Phase 9 inherits THREE migrations:
- Plan 07-02 deferral: 8 v1 bonos symbols (`filterBonos`, `summarizeBonos`, `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas` + interfaces `BonoSummary`, `BonoByDate`, `BonoByEmpresa`)
- Plan 07-04 deferral: 4 v1 payouts symbols (`filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`)
- Plan 08-04 deferral (this plan): 10 v1 recargas symbols (above table)

**No behavior change to the Clientes page today** — kept-alive surface is byte-identical; `/clientes/[empresaId]` continues building and rendering identically against v1.

## Audit gate results

Per Plan 08-04 Task 2 Step B, ran the audit BEFORE deleting any v1 leaf:

```bash
for FILE in RecargasKPICards RecargasTable HechosCuradosRecargas RecargasTrendChart; do
  echo "=== Consumers of $FILE ==="
  grep -rE "from \"@/components/recargas/$FILE\"|from '@/components/recargas/$FILE'" src/ \
    | grep -vE "src/app/\(protected\)/recargas/page.tsx"
done
```

**Result: ZERO surprise consumers across all 4 v1 leaves.** After the page rewrite, `/recargas/page.tsx` no longer imports them either. Audit gate clean → all 4 deleted with `git rm` (-367 LOC removed). No deferral required for component-layer prunes.

## Decisions Made

(See `key-decisions` in frontmatter for the full set; the most important for downstream phases are recorded in STATE.md as Accumulated Context entries.)

### Layout decision and where the section accent landed

**Method-and-distribution-first cockpit** — primary KPI text-4xl with `text-section-recargas` (Teal) on the "Total recargas" card at line 66 of RecargasKPICardsV2.tsx; two diagnostic protagonists side-by-side at `lg:grid-cols-2` (MethodSplitCard answers "what method?" + AmountDistribution answers "what size?"); TopRechargers full-width below answers "who?"; RecargasTrendChartV2 full-width at the bottom answers "when?". `grep -rE 'text-section-recargas' src/components/recargas/` → exactly 1 reference (verified surgical).

### Trend chart implementation choice

**Stacked BarChart with two `<Bar stackId="recargas">` series** (Recharts) — PSE on top, TRANSFER on bottom; OKLCH-pinned fills (PSE = `oklch(0.62 0.10 200)`, TRANSFER = `oklch(0.42 0.10 200)`); Tooltip shows `PSE: N` + `Transfer: M` + `Total: N+M`. Chosen over two-series LineChart because the temporal story IS the count SHARE between the two methods (PRD baseline 85% PSE / 15% TRANSFER); stacked bars at each date make the share visually immediate without forcing eye-arithmetic between two crossing lines.

### Adoption denominator decision

**Full `allTx` pool, NOT period-filtered separately** — caller threads `txResult.rows` (the full transaction stream from `getCachedTransactions()`) into BOTH `filterRecargasV2(allTx, filters)` AND `aggregateRechargeAdoption(allTx, recargaRows)`. Rationale: a per-period adoption divided by the same period's user count would be ~100% by definition (everyone who appears appears because they had activity); v2 wants "X% of all known users have recharged in this period" as a stable adoption signal. Same convention as Plan 08-02's purchase adoption.

### Visual checkpoint feedback

User typed "approved" without per-issue feedback. The cockpit landed visually correct on first render. Method-and-distribution-first layout, surgical Teal accent, audit-gated v1 prune, and `recargas.ts` deferral all approved as designed.

## Recovery context (mid-task stream-idle timeout)

This plan executed across **two agent generations** before the docs commit:

**Generation 1 (original execute-plan agent):** Started Task 1; built all 5 v2 leaf components on disk (RecargasKPICardsV2, MethodSplitCard, AmountDistribution, TopRechargers, RecargasTrendChartV2 — 589 LOC total); was stream-idle-killed BEFORE the Task 1 commit landed. Filesystem state at termination: 5 new files on disk, tsc-clean, lint-clean, untracked. No commits.

**Generation 2 (recovery continuation agent):** Picked up via fresh agent spawn. Inspected filesystem state via `git status --short` (5 untracked files in `src/components/recargas/`), audited each file individually (read + tsc smoke + lint smoke), confirmed they matched the plan's Task 1 spec verbatim, then committed them verbatim as Task 1 (`0619d65`). Continued cleanly to Task 2 (page rewrite + audit-gated prune) → committed as `2a82a58`. Reached the visual checkpoint, returned the structured checkpoint message. User typed "approved."

**Generation 3 (this docs continuation agent):** Spawned post-approval to write SUMMARY.md, update STATE.md, and create the plan-metadata commit.

**Why this is a distinct recovery pattern from checkpoint-resume:**

- **Checkpoint-resume** carries explicit completed-task hashes in the prompt's `<completed_tasks>` table. Fresh agent verifies hashes appear in `git log`, skips completed tasks, resumes from the documented checkpoint.
- **Mid-task stream-idle recovery** has NO commits to verify against — the previous agent's progress is on disk, NOT in git history. Fresh agent inspects filesystem state, validates against plan spec via tsc/lint/grep, commits verbatim, then resumes.

The mid-task pattern is more flexible (works for any work-in-progress that's tsc-clean) but requires the recovery agent to do an audit pass before committing. Catalogued as a canonical pattern for future agents recovering from analogous timeouts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Field-name reconciliation (PRD vocabulary → actual Transaction shape)**

- **Found during:** Task 1 (leaf component authoring) + Task 2 (page composition)
- **Issue:** PLAN.md `<action>` blocks referenced PRD-vocabulary field names that do NOT exist on `Transaction`:
  - `tx.transferTikintag` → actual field is `tx.tikintag`
  - `tx.transactionAmount` → actual field is `tx.monto`
  - `tx.transferEmpresa` → actual fields are `tx.empresa_id` / `tx.empresa_nombre`
  - `tx.date` → actual field is `tx.fecha`
  - `filters.period.from / filters.period.to` → actual `DashboardFilters` is FLAT: `filters.from` / `filters.to`
- **Fix:** Translated inline at every call site (page composition + leaf component prop bindings). Translation matches the convention Plans 08-01 + 08-03 hit independently — types.ts is the authoritative @-context contract; pseudo-code in PLAN.md `<action>` is intent guidance.
- **Files modified:** All 5 v2 leaves + `src/app/(protected)/recargas/page.tsx`
- **Verification:** tsc 0 errors (would have surfaced any mistranslation)
- **Committed in:** `0619d65` (Task 1 leaves) + `2a82a58` (Task 2 page)

**2. [Rule 3 — Blocking] AdapterResult shape — `txResult.rows` not `txResult.data`**

- **Found during:** Task 2 (page composition)
- **Issue:** The continuation prompt's prose (and possibly the original execute-plan agent's mental model) referenced `txResult.data` for the transactions adapter return. The actual return type from `src/lib/sheets/transactions.ts` exposes `rows` (the AdapterResult convention used across all sheets adapters in v2.0). Pre-checkpoint prose drift; types.ts is authoritative.
- **Fix:** Used `const allTx = txResult.rows;` in the page composition. tsc 0 errors confirms.
- **Files modified:** `src/app/(protected)/recargas/page.tsx` (line 131)
- **Verification:** tsc 0 errors; build green; route compiles
- **Committed in:** `2a82a58` (Task 2 commit)

**3. [Recovery] Stream-idle timeout during Task 1 — original agent built leaves on disk pre-commit**

- **Found during:** Continuation handoff (recovery agent inspected filesystem state)
- **Issue:** Original execute-plan agent built all 5 leaf components on disk (589 LOC) but got stream-idle-killed BEFORE the Task 1 commit. Filesystem had 5 untracked files matching the plan's Task 1 spec; git history had nothing.
- **Fix:** Recovery agent audited each file (read + tsc smoke + lint smoke), confirmed all 5 matched the plan's must_haves verbatim (file paths, min_lines, section accent surgical, "use client" only on RecargasTrendChartV2), then committed verbatim as Task 1 (`0619d65`). Continued cleanly to Task 2.
- **Files modified:** None (the audit was non-destructive)
- **Verification:** Task 1 commit (`0619d65`) shows all 5 files at expected LOC; tsc/lint clean post-commit
- **Committed in:** `0619d65` (with the original agent's authored content)

---

**Total deviations:** 3 — 2 auto-fixed (Rule 3 blocking) + 1 recovery context (filesystem-state recovery from mid-task timeout)
**Impact on plan:** Plan's user-facing scope (v2 Recargas cockpit + audit-gated v1 leaf prune + recargas.ts deferral) shipped exactly as specified. Field-name and AdapterResult reconciliations were pre-emptive type-driven fixes; tsc 0 errors confirms the wires are correct. Recovery context preserves original agent's work — no re-execution from scratch was required, no scope drift introduced. No behavior change to Clientes page (recargas.ts UNTOUCHED).

## Issues Encountered

**No issues during the recovery agent's execution beyond the deviations above.** tsc, lint, and build all green at every commit boundary. Visual checkpoint approved on first render. No git race observed during this continuation phase (sibling 08-02 had already committed cleanly before this plan resumed Task 1; disjoint paths — sibling touched `src/app/(protected)/uso-tarjeta/` + `src/components/uso-tarjeta/` + `tab-nav.tsx`, this plan touched `src/app/(protected)/recargas/` + `src/components/recargas/`).

## User Setup Required

None — no external service configuration required. Pure TypeScript + Tailwind additions on existing infrastructure (Recharts already in repo).

## Next Phase Readiness

**Ready for the rest of Phase 8 / downstream phases:**
- v2 Recargas cockpit live at `/recargas`; tsc + lint + build all green
- Method-and-distribution-first cockpit pattern proven — joins the family of cockpit shapes (time-first 07-04, ranking-first 07-02) reusable for any future operational dashboard with primary KPI + two diagnostic protagonists + ranking + temporal
- Stacked-bar timeline pattern proven — reusable for any future binary/ternary share-over-time visualization (PSE/TRANSFER, success/fail, etc.)
- Tikintag-as-rank-key convention reaffirmed across Phase 8 (Recargas TopRechargers + Uso Tarjeta TopCardUsers both rank by `tikintag`); empresa-as-rank-key remains a v1 idiom
- Stream-idle recovery pattern catalogued — fresh agent + filesystem-state inspection + verbatim commit + resume

**Carry-forward (critical for Phase 9):**
- 10 v1 recargas.ts symbols KEPT alive — Phase 9 (Vista Cliente v2 — `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx` rewrite) must migrate the 5 still-consumed symbols (`filterRecargas`, `summarizeRecargas`, `aggregateRecargasByDate`, `RecargaSummary`, `RecargaByDate`) off v1, then prune all 10 in one cohesive diff. Joins the bonos (8 deferred symbols) and payouts (4 deferred symbols) deferred-prune lists already on the Phase 9 docket — total 22 symbols across 3 modules await consolidation in Phase 9's final cleanup.

**No blockers introduced.** v2 Recargas page works with live data; v1 callers in Clientes unchanged.

---
*Phase: 08-tarjeta-recargas*
*Completed: 2026-05-07*
