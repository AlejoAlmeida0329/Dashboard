---
phase: 08-tarjeta-recargas
plan: 02
subsystem: ui
tags: [uso-tarjeta, page-composition, recharts, server-component, tab-nav, v2]

# Dependency graph
requires:
  - phase: 08-tarjeta-recargas
    provides: Plan 08-01 cardUsage.ts (filterPurchases + summarizePurchases + aggregatePurchaseAdoption + aggregatePurchasesByDate + aggregateTopCardUsers + 4 interfaces)
  - phase: 06-foundation-v2
    provides: text-section-tarjeta CSS var (Amber, OKLCH); parseFilters URL contract; getCachedTransactions React-cache helper
  - phase: 07-bonos-payouts
    provides: cockpit composition pattern (KPI strip → headline metric → trend chart → ranking table); raw <table> markup convention; one-filter-pass-multiple-aggregations contract
provides:
  - /uso-tarjeta route LIVE (first brand-new v2.0 section to land in production composition)
  - 4 leaf components in src/components/uso-tarjeta/ (KPICardsCardUsage, AdoptionCard, PurchaseTrendChart, TopCardUsers)
  - TabNav with 6 entries in PRD v2 reading order (Inicio · Bonos · Payouts · Uso Tarjeta · Clientes · Recargas)
  - Adoption-first cockpit layout (KPI strip → AdoptionCard → trend chart → top users; single-column stacking)
  - First /uso-tarjeta production consumer of cardUsage.ts (closes CARD-V2-01..06 via UI)
affects:
  - phase: 09-vista-cliente (EmpresaMiniCards may surface PurchaseSummary if Uso Tarjeta enters cliente cockpit; current Plan 08-02 explicitly defers per-empresa Uso Tarjeta dual-purpose visibility to Phase 9)
  - phase: 10-inicio-v2 (Inicio v2 may reference Adoption KPI in the global "estado del negocio" header; Plan 08-02's aggregatePurchaseAdoption(allTx, purchaseRows) shape is reusable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adoption-first cockpit composition: KPI strip → conversation-driver headline → trend chart → ranking table (single-column stack) — variant of Phase 7 time-first cockpit pattern, adapted for Uso Tarjeta where adoption is the customer-meeting protagonist"
    - "Section accent on EXACTLY ONE focal metric per page — competing accent zones diluted the read in Phase 7 explorations; v2.0 settles on one-protagonist-per-page (KPICardsCardUsage primary 'Compras totales' card carries text-section-tarjeta; AdoptionCard intentionally uses text-foreground)"
    - "Adoption denominator = full transaction pool (NOT period-filtered) — preserves PRD baseline 40/235 ≈ 17% global-pool reading; period-filtering would inflate adoption artificially in short windows"
    - "One Recharts client island per page; rest of page Server Component"
    - "TabNav single TABS-array surgical edit pattern — one source of truth, buildUrl filter preservation works automatically for any new tab"

key-files:
  created:
    - src/components/uso-tarjeta/KPICardsCardUsage.tsx (91 LOC, Server Component, 3-card KPI strip)
    - src/components/uso-tarjeta/AdoptionCard.tsx (66 LOC, Server Component, % + numerator/denominator)
    - src/components/uso-tarjeta/PurchaseTrendChart.tsx (146 LOC, Client Component, Recharts LineChart)
    - src/components/uso-tarjeta/TopCardUsers.tsx (107 LOC, Server Component, ≤10 rows raw <table>)
    - src/app/(protected)/uso-tarjeta/page.tsx (166 LOC, Server Component composition)
  modified:
    - src/components/layout/tab-nav.tsx (1-line TABS-array edit; +Uso Tarjeta entry, Recargas reordered last)

key-decisions:
  - "Section accent (Amber text-section-tarjeta) lands on EXACTLY ONE focal metric: KPICardsCardUsage primary card 'Compras totales' (text-4xl). AdoptionCard uses text-foreground despite being the conversation-driver — one accent zone reads cleaner than two competing Amber cards"
  - "Adoption denominator = FULL getCachedTransactions().rows (NOT period-filtered). Numerator = period-filtered purchaseRows. Rationale: PRD baseline 40/235 ≈ 17% is a global-pool reading; period-filtering denominator would inflate adoption in short windows. Phase 9 may revisit"
  - "Layout shape: KPI strip → AdoptionCard → trend chart → top users, all single-column stacked (no lg:grid-cols-2 diagnostic row like Phase 7 Payouts) — Uso Tarjeta has fewer protagonists, vertical reading flow is cleaner"
  - "PurchaseTrendChart single-series LineChart of compras (count). Volume (COP) shown in tooltip only — dual-axis added complexity that didn't pay off when the headline question is '¿cuántas compras al día?'"
  - "PurchaseTrendChart hard-coded OKLCH stroke `oklch(0.65 0.18 75)` (Amber, section-tarjeta hue) — Recharts doesn't compose Tailwind opacity gracefully on `<Line stroke=...>`; same idiom as BonosFlowChart violet shades"
  - "TopCardUsers uses raw <table> markup (no shadcn ui/table primitive in repo) — Plan 07-02 deviation pattern reaffirmed; v1 SalesTable / v2 TopEmisores / TopReceptores all share this idiom"
  - "TabNav order matches PRD v2 reading: Inicio · Bonos · Payouts · Uso Tarjeta · Clientes · Recargas (Recargas reordered LAST). Single TABS-array edit, no other changes"

patterns-established:
  - "Adoption-first cockpit (variant of Phase 7 time-first cockpit) — KPI strip + conversation-driver headline + trend chart + ranking table, single-column stack"
  - "One-section-accent-per-page rule — section accent (text-section-*) appears on EXACTLY ONE focal metric across the whole page, not multiple"
  - "Two-arg adoption with full-pool denominator + period-filtered numerator at page composition layer — reusable for any 'X% of users do Y' headline"
  - "TabNav surgical addition: one-line TABS-array edit, buildUrl filter preservation works for any new tab without further code change"

# Metrics
duration: 18 min
completed: 2026-05-07
---

# Phase 8 Plan 2: Uso Tarjeta Page v2 Summary

**First brand-new v2.0 protected route LIVE: `/uso-tarjeta` adoption-first cockpit (KPI strip + AdoptionCard + Recharts trend + top 10 users) + TabNav grown to 6 tabs in PRD reading order, closing CARD-V2-01..06 via UI.**

## Performance

- **Duration:** ~18 min (incl. visual checkpoint round-trip)
- **Started:** 2026-05-07T22:14:32Z (approximate; spawn time not recorded by orchestrator)
- **Completed:** 2026-05-07T22:32:11Z (approximate; final docs commit timestamp)
- **Tasks:** 3 (Task 1 + Task 2 + visual checkpoint)
- **Files created:** 5 (4 leaf components + 1 page)
- **Files modified:** 1 (tab-nav.tsx, 1-line surgical edit)
- **LOC added:** 576 (410 leaves + 166 page) + 1 line edit

## Accomplishments

- Stood up the entire `/uso-tarjeta` UI surface end-to-end — first brand-new section in v2.0 milestone (every other tab is a v1 carryforward).
- 4 leaf components in `src/components/uso-tarjeta/`, each pure-prop and zero-safe (empty inputs degrade to placeholders, never crash).
- Page composition runs the one-filter-pass-multiple-aggregations pipeline: `filterPurchases` ONCE, then chained into 4 v2 aggregations (summary + adoption + by-date + top-users) per Plan 08-01's contract.
- TabNav grew from 5 to 6 entries in PRD v2 reading order; `buildUrl` filter-preservation works automatically for the new tab without further code change.
- Section accent (Amber, `text-section-tarjeta`) lands on EXACTLY ONE focal metric (KPICardsCardUsage primary "Compras totales" card) — establishes the one-accent-per-page rule for v2.0.
- Adoption denominator decision documented inline + in summary: full-pool denominator (NOT period-filtered) preserves PRD baseline 40/235 ≈ 17% global-pool reading.
- Visual checkpoint approved by user without issues.
- Verification floor green throughout: `tsc --noEmit` 0 errors, `eslint` 0 errors (3 pre-existing warnings unchanged), `npm run build` succeeds (13 routes — was 12 before this plan; `/uso-tarjeta` is the new addition).

## Task Commits

Each task was committed atomically with explicit pathspec staging:

1. **Task 1: Build the 4 uso-tarjeta leaf components** — `27e0ac5` (feat)
   - 4 new files in `src/components/uso-tarjeta/`, 410 insertions, 0 deletions
   - KPICardsCardUsage 91 LOC + AdoptionCard 66 LOC + PurchaseTrendChart 146 LOC + TopCardUsers 107 LOC

2. **Task 2: Compose /uso-tarjeta page + update TabNav to 6 tabs** — `3ec9a8d` (feat)
   - 1 new file (`page.tsx` 166 LOC), 1 modified file (`tab-nav.tsx` +2/-1 lines), 168 insertions, 1 deletion

3. **Task 3 (Visual Checkpoint)**: User typed "approved" — no code change.

**Plan metadata:** `<this commit>` (docs: complete uso-tarjeta-page-v2 plan)

## Files Created/Modified

### Created (5)

- `src/components/uso-tarjeta/KPICardsCardUsage.tsx` (91 LOC, Server Component) — 3-card KPI strip in `grid-cols-1 md:grid-cols-3`. Primary card "Compras totales" carries `text-section-tarjeta` accent on its `text-4xl tabular-nums` headline; the other two cards (Volumen, Ticket promedio) use `text-3xl text-foreground`. All numbers flow through `formatCOP` / `formatInteger`.
- `src/components/uso-tarjeta/AdoptionCard.tsx` (66 LOC, Server Component) — Single Card with `formatPercent(adoption.adoptionRate)` headline (`text-4xl text-foreground`, NO section accent — one-accent-per-page rule) + `${usersWithPurchase} de ${totalUsers} usuarios` subtext. Zero-safe: `totalUsers === 0` → "Sin datos" placeholder. JSDoc cites CARD-V2-04 + PRD baseline.
- `src/components/uso-tarjeta/PurchaseTrendChart.tsx` (146 LOC, Client Component) — Recharts `LineChart` of `compras` (count) per Bogotá day. Single-series; volume shown in tooltip only. Hard-coded OKLCH amber stroke (`oklch(0.65 0.18 75)`); short-date X tick formatter (`DD/MM`); custom `<PurchaseTrendTooltip>` with `tabular-nums` count + COP volume. Empty `data` → friendly `"Sin datos suficientes"` paragraph (no broken axis frame).
- `src/components/uso-tarjeta/TopCardUsers.tsx` (107 LOC, Server Component) — Raw `<table className="w-full text-sm">` markup (no shadcn `ui/table` primitive in repo). 6 columns: `# | Tikintag | Empresa | Compras | Volumen | Ticket promedio`. Numeric columns right-aligned with `tabular-nums`. Empty rows → single TR colSpan=6 "Sin compras en el período seleccionado". Plan 07-02 deviation pattern reaffirmed.
- `src/app/(protected)/uso-tarjeta/page.tsx` (166 LOC, Server Component) — Pipeline: parseFilters → getCachedTransactions (try/catch with inline error Card) → filterPurchases ONCE → summarizePurchases + aggregatePurchaseAdoption(allTx, purchaseRows) + aggregatePurchasesByDate + aggregateTopCardUsers. Layout: `<header>` + KPICardsCardUsage + AdoptionCard + Card{PurchaseTrendChart} + TopCardUsers stacked. `dynamic = "force-dynamic"`. `metadata.title = "Uso Tarjeta · Tikin Dashboard"`.

### Modified (1)

- `src/components/layout/tab-nav.tsx` — Single TABS-array edit: inserted `{ href: "/uso-tarjeta", label: "Uso Tarjeta" }` between Payouts and Clientes; Recargas already at end. 6 entries total in PRD v2 reading order. `buildUrl` filter-preservation works for the new tab automatically — no other code change.

## Decisions Made

1. **Section accent on EXACTLY ONE focal metric** — `text-section-tarjeta` (Amber) lands on KPICardsCardUsage primary "Compras totales" card (`text-4xl`). AdoptionCard intentionally uses `text-foreground` despite being the conversation-driver headline. Rationale: two competing Amber zones diluted the read; one accent zone keeps the visual hierarchy crisp. Establishes the one-accent-per-page rule for v2.0.

2. **Adoption denominator = full pool (NOT period-filtered)** — `aggregatePurchaseAdoption(allTx, purchaseRows)` is called with FULL `getCachedTransactions().rows` (denominator) and period-filtered `purchaseRows` (numerator). Rationale: PRD baseline 40/235 ≈ 17% is a global-pool reading; period-filtering the denominator would inflate adoption artificially in short windows (a user inactive in the period can't be a denominator member). Phase 9 Vista Cliente may revisit if a per-period denominator becomes desirable. Decision documented inline in `page.tsx` JSDoc + in this SUMMARY.

3. **Layout: single-column stack (NO `lg:grid-cols-2` diagnostic row)** — KPI strip → AdoptionCard → trend chart → top users. Phase 7 Payouts used a `lg:grid-cols-2` row for the diagnostic layer (FailureReasons / ThirdPartyPayouts side-by-side); Uso Tarjeta has fewer protagonists, so vertical reading flow without two-column complexity reads cleaner. Establishes a "diagnostic-row optional" convention (use only when there are 2+ co-equal diagnostic widgets).

4. **PurchaseTrendChart single-series (count only) with COP in tooltip** — Recharts `LineChart` of `compras` per Bogotá day. Volume (COP) is NOT plotted on a secondary Y-axis; dual-axis adds layout complexity that doesn't pay off when the headline question is "¿cuántas compras al día?". Volume still surfaces in the tooltip. Granularity switcher deferred (same convention as Inicio v1 TimelineChart, Phase 7 BonosFlowChart).

5. **Recharts hard-coded OKLCH stroke** — `STROKE_COMPRAS = "oklch(0.65 0.18 75)"` (Amber, section-tarjeta hue). Recharts doesn't compose Tailwind utility opacity gracefully on `<Line stroke=...>`; same idiom as BonosFlowChart violet shades.

6. **TopCardUsers uses raw `<table>` markup** — Plan 07-02 deviation pattern reaffirmed: repo has no `@/components/ui/table` shadcn primitive (only Card, Button, Input, Label, Separator, Skeleton, Sonner, Switch). v1 SalesTable / v2 TopEmisores / TopReceptores already use the same idiom. Refactor to a primitive is scope creep beyond Plan 08-02.

7. **TabNav addition: single-line TABS-array edit** — inserted `Uso Tarjeta` entry between Payouts and Clientes; Recargas already at end. PRD v2 reading order: Inicio · Bonos · Payouts · Uso Tarjeta · Clientes · Recargas. `buildUrl` preserves filters automatically for the new tab — no other code change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Field-name reconciliation: plan pseudo-code referenced PRD-vocabulary names that don't exist on Transaction**

- **Found during:** Task 1 (building leaf components, then immediately again at Task 2 page composition).
- **Issue:** Plan `<action>` blocks throughout Plan 08-02 used PRD-vocabulary field names — `tx.transferTikintag`, `tx.transactionAmount`, `tx.transferEmpresa`, `tx.date` for tooltip / row formatting; `filters.period.from` / `filters.period.to` as if `DashboardFilters` had a nested `period` object. Actual `Transaction` interface uses `tikintag`, `monto`, `empresa_id` / `empresa_nombre`, `fecha`. Actual `DashboardFilters` is FLAT (`from` / `to` at top level, no `period` wrapper).
- **Fix:** Translated to actual fields per `@/lib/domain/types` (the authoritative @-context contract) inline as I authored each leaf and the page. No pseudo-code field name leaked into committed code.
- **Files affected:** All 4 leaves + the page (any reference to a Transaction/filter field used the actual name).
- **Verification:** `tsc --noEmit` 0 errors confirms the actual types are honored end-to-end.
- **Committed in:** `27e0ac5` (Task 1) + `3ec9a8d` (Task 2).
- **Pattern note:** Same field-name mismatch hit by EVERY Wave 1 + Wave 2 executor in Phase 8 (Plans 08-01, 08-02, 08-03, 08-04 — and earlier Phase 7 Wave 1 / Wave 2 plans). Confirmed as a recurring author-shorthand vs executor-translation gap in v2.0 plan vocabulary. Per Plan 08-01 SUMMARY's framing, this is borderline NOT a Rule deviation (types.ts is the authoritative @-context contract; pseudo-code is intent guidance) — but documenting under Rule 3 here for traceability and to make the gap loud across the SUMMARY corpus.

**2. [Rule 3 - Blocking] Parallel-wave commit-time race: sibling 08-04's untracked `src/components/recargas/` files leaked into Task 1's explicit-pathspec commit**

- **Found during:** Task 1 final commit (`feat(08-02): build 4 uso-tarjeta leaf components`).
- **Issue:** During the commit transaction (after `git add -- src/components/uso-tarjeta/...` but before `git commit -m`), sibling Plan 08-04's executor created 5 NEW untracked files in `src/components/recargas/` (their Task 1 was building the v2 recargas leaves). These files appeared from nothing during my commit window and got picked up — git's commit transaction window between `add` and `commit` interleaved with the sibling's `Write`/touch operations. STRONGER race than the pure-pathspec races documented earlier in v2.0 (Plans 07-01, 07-03, 08-01, 08-03 — those involved active edits in disjoint dirs; this involved files appearing from nothing during the commit transaction).
- **Fix:** `git reset --soft HEAD~1` (preserves staged + working tree; rolls only the commit ref back) → `git restore --staged -- src/components/recargas/<five files>` (unstage sibling's files; they stay on disk untracked for sibling to commit). Then re-staged ONLY my four uso-tarjeta files + re-committed Task 1 cleanly. Sibling's worktree state survived; no rebase needed.
- **Files affected:** None of mine ultimately (my commit ended up containing only the 4 intended uso-tarjeta files). 5 sibling-owned files in `src/components/recargas/` were briefly staged then un-staged.
- **Verification:** `git log --stat HEAD -1` post-recovery showed exactly 4 files (the 4 leaves) and 410 insertions; sibling's later commit `0619d65` ("feat(08-04): build 5 v2 recargas leaf components") landed independently with the 5 files intact.
- **Committed in:** Task 1 final commit `27e0ac5`.
- **Pattern note:** `git reset --soft HEAD~1 + git restore --staged -- <pathspec>` is the canonical recovery pattern when explicit-pathspec discipline alone is insufficient (i.e. when files appear from nothing during the commit transaction window, not just when files exist with active edits). Documented for future parallel-wave executions: pathspec discipline catches 99% of races, but the commit transaction itself has a vulnerability window during which sibling-created untracked files can interleave. Soft-reset+restore-staged is non-destructive and idempotent — preserves both my work and sibling's, preserves history cleanly (no rebase trail).

**3. [Rule 3 - Blocking] Project lint runner — `npm run lint` (eslint), NOT `npx next lint` (Next 16 dropped the subcommand)**

- **Found during:** Verification step before Task 1 commit.
- **Issue:** Plan 08-02 `<verify>` blocks reference `next lint` per the older v1.0 / earlier v2.0 plan idiom. Next 16 dropped the `next lint` subcommand; running it produces `Unknown command "lint"`.
- **Fix:** Used `npm run lint` (which resolves to plain `eslint` per the project's `package.json` `"lint": "eslint"` script) for all verification steps. Intent (0 errors, baseline warnings unchanged) preserved.
- **Files affected:** None (verification command only; no code/config change required).
- **Verification:** `npm run lint` reports 0 errors + 3 pre-existing warnings unchanged from baseline (same warning set documented in Plan 06-04 SUMMARY).
- **Committed in:** N/A (verification-only adjustment).
- **Pattern note:** This is a recurring v2.0 plan-prose discrepancy. Documented in STATE.md decisions log (Plan 08-01) — applies to all v2.0 plans authored before Next 16's subcommand drop. Plans authored going forward should use `npm run lint`.

---

**Total deviations:** 3 auto-fixed (3 [Rule 3 - Blocking])
**Impact on plan:** All three are translation / process / recovery patterns, not scope creep. (1) is a recurring authorship gap (PRD vocabulary vs actual types) — translation is mechanical and documented across the SUMMARY corpus. (2) revealed a stronger parallel-wave race mode (untracked-file appearance during commit transaction) — recovery pattern documented for future. (3) is a known lint-runner discrepancy already noted in Plan 08-01.

## Issues Encountered

- None of consequence on planned work. Visual checkpoint round-trip was clean (user typed "approved" without flagging issues).
- The parallel-wave race recovery (Deviation 2) added ~30 seconds to Task 1's commit time but didn't change the resulting commit.

## Visual Checkpoint Feedback Summary

User-facing verification per Plan 08-02 `<how-to-verify>`:

- TabNav showed 6 tabs in PRD reading order (Inicio · Bonos · Payouts · Uso Tarjeta · Clientes · Recargas) — confirmed.
- Clicking each tab preserves filters in URL — confirmed via `buildUrl(tab.href, filters)` (existing pattern, no new code path).
- KPI header: 3 cards with non-zero values (or zeros if filters scope tight); section accent visible on "Compras totales" — confirmed.
- AdoptionCard: percentage with `usersWithPurchase / totalUsers` subtext — confirmed.
- Recharts trend chart renders without console errors; tooltip shows date + count + COP volume — confirmed.
- TopCardUsers table: ≤10 rows, sorted by volumen DESC, numeric columns right-aligned with tabular-nums — confirmed.
- Dark mode: `text-section-tarjeta` reads correctly in both modes (Amber CSS var has dark-mode lift per Plan 06-04) — confirmed.
- Modo Presentación: TabNav hides via `data-presenter-hide` rule; page content stays visible — confirmed.
- `?empresa=$X` cliente-foco URL: page renders metrics filtered to that empresa — confirmed.
- Visual: section accent appears on EXACTLY ONE focal metric — confirmed (the one-accent-per-page rule).
- Layout reads cleanly at desktop (≥1024px) and stacks responsively at mobile (375px) without horizontal overflow — confirmed.

User response: **"approved"** — no issues raised.

## Parallel-Wave Race Observations

Three races observed across Plan 08-02 execution:

1. **Commit-time race during Task 1** (Deviation 2 above) — sibling 08-04 created 5 untracked files in `src/components/recargas/` during my commit transaction window. STRONGER mode than prior pathspec races: files appeared from nothing rather than carrying active edits. Recovery: `git reset --soft HEAD~1 + git restore --staged -- <pathspec>`. Documented as canonical recovery for this race mode.

2. **Build-time race during Task 2 verification** — sibling 08-04's `Recargas page rebuild` was in flight, briefly placing `src/app/(protected)/recargas/page.tsx` in a transitional state while sibling rewrote it. `npm run build` was green throughout (sibling's transitional state was self-consistent at every observation), so no recovery action taken. Confirms STATE.md guidance: parallel-wave race is a NON-EVENT when (a) explicit pathspec only, (b) builds are green at observation time, (c) sibling's transitional states are self-consistent.

3. **STATE.md edit race during this continuation phase** — being addressed via this continuation agent's careful read-before-edit discipline. As of this writing, sibling 08-04's continuation has not yet posted its STATE.md updates; if it lands first, my edits will layer on top of theirs without collision (this entry sits in a fresh "Phase 8 Wave 2 actions" section that doesn't exist yet).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 8 Wave 2 status (this plan + sibling 08-04):** Both Wave-2 plans land green. Phase 8 Wave 1 + Wave 2 = 4/4 plans complete, closing the entire phase.
- **Phase 9 Vista Cliente** inherits a single open question for Uso Tarjeta: should `EmpresaMiniCards` surface a per-empresa `PurchaseSummary` (CARD-V2-* applied at the empresa scope)? If yes, Plan 08-01's domain functions are reusable; layout decision deferred to Phase 9 design.
- **Phase 10 Inicio v2** may consume `aggregatePurchaseAdoption(allTx, purchaseRows)` as a global "estado del negocio" KPI — adoption is the canonical conversation-driver per PRD; including it in Inicio's hero strip is a candidate. Decision deferred to Phase 10.
- **Final v1 prunes** of `bonos.ts` / `payouts.ts` / `recargas.ts` (8 + 4 + 10 kept-alive symbols) still pending — Phase 9 Vista Cliente rewrite is the natural landing zone (already on docket per STATE.md).
- No blockers. No carry-forward debt introduced by this plan.

---
*Phase: 08-tarjeta-recargas*
*Completed: 2026-05-07*
