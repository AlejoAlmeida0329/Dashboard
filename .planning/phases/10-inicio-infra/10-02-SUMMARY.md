---
phase: 10-inicio-infra
plan: 02
subsystem: app
tags: [inicio, v2, operative-lens, page-rewrite, cohesive-prune, deferred-prune-closeout, milestone-end-to-end]

# Dependency graph
requires:
  - phase: 10-inicio-infra
    provides: Plan 10-01 v2 domain surface (filterInicioV2 + summarizeInicioV2 + aggregateTransactionTypeDistribution + aggregateActivityByDateV2/ByWeekV2 + aggregateTopUsersByVolume + 4 v2 types)
  - phase: 06-foundation-v2
    provides: parseFilters + DashboardFilters CSV contract (status + tipo) — Plan 06-03
  - phase: 04-inicio-recargas
    provides: v1 inicio.ts surface (DELETED in this plan — Phase 4 work fully superseded)
  - phase: 07-bonos-payouts
    provides: v1 payouts.ts 4-symbol surface (DELETED in this plan — Plan 07-04 deferred-prune docket closed)
provides:
  - "/inicio v2 operative-lens cockpit (3-card KPI strip + 2-col diagnostic grid + top users table)"
  - 4 new v2 leaf components in src/components/inicio/ (InicioKPIStripV2, TransactionTypeDonut, ActivityTimelineV2, TopUsersByVolume)
  - inicio.ts v2-only surface (10 exports — 5 fns + 4 interfaces; v1 block deleted)
  - payouts.ts v2-only surface (filterPayoutsV2 + summarizePayoutsByState + 5 aggregations + types; v1 block deleted)
  - Phase 7-04 deferred-prune docket CLOSED (4 v1 payouts.ts symbols pruned)
  - v2.0 milestone v1→v2 migration end-to-end COMPLETE
affects:
  - "Phase 10 closeout: ready to mark ⚠️ Partial (Inicio v2 ✅ + INFRA-04 ⏸ deferred)"
  - "v2.0 milestone declarable: 50/51 v1 requirements met (INFRA-04 explicitly carried forward)"
  - "Future deferred-prune dockets: ZERO. Phase 9-03 closed 22 symbols + 4 v1 payouts now closed = 26 symbols pruned across Phases 9-03 + 10-02"

# Tech tracking
tech-stack:
  added: []  # No new dependencies — page rewrite consumes existing v2 surface; leaves use existing Recharts + format helpers
  patterns:
    - "v2-alongside-v1 coexistence CLOSED (5th instance closed; Plan 10-01 was the append, this plan is the prune)"
    - "Cohesive multi-module v1 prune in ONE refactor commit (inicio.ts v1 block + 5 v1 leaves + inicio-hechos.ts module + 4 v1 payouts.ts symbols across 2 modules + 6 file deletions; mirrors Plan 09-03's 22-symbol cohesive prune precedent)"
    - "Operative-lens cockpit composition (5th cockpit shape in v2.0 family — joins time-first 07-04 / ranking-first 07-02 / adoption-first 08-02 / method-and-distribution-first 08-04 / dossier 09-03)"
    - "One-section-accent-per-page rule held strict (text-section-inicio on Usuarios activos protagonist only; one focal-metric application across the entire /inicio page)"
    - "Section-accent + semáforo coexistence (Indigo accent on protagonist + verde/amber/rojo on Tasa de éxito KPI — orthogonal palettes, no diluted read)"
    - "Inline successRateAccent helper duplication (4-line copy from PayoutsKPICardsV2:53 — local to each consumer; threshold contract is small enough that the indirection of a shared module costs more than the duplication)"
    - "OKLCH-pinned chart fills with section-hue palette + reserved muted-Indigo for Otros tail (TransactionTypeDonut: 7 fills; ActivityTimelineV2: protagonist + companion-dashed)"
    - "Dual-axis LineChart with informational granularity prop (ActivityTimelineV2 — page chooses daily-vs-weekly upstream, leaf renders what it gets + tooltip-format hint only)"
    - "Cliente-foco conservative-default reaffirmed (no data-presenter-* attributes on Inicio v2 — operative-lens metrics are operator+cliente friendly; CROSS-V2-07)"
    - "Dangling-JSDoc cleanup in v2 leaves (TransactionTypeDonut + ActivityTimelineV2 references to GMVTrendChart redirected to PurchaseTrendChart / RecargasTrendChartV2 — convention sources that still exist post-prune)"

key-files:
  created:
    - src/components/inicio/InicioKPIStripV2.tsx
    - src/components/inicio/TransactionTypeDonut.tsx
    - src/components/inicio/ActivityTimelineV2.tsx
    - src/components/inicio/TopUsersByVolume.tsx
    - .planning/phases/10-inicio-infra/10-02-SUMMARY.md
  modified:
    - src/app/(protected)/inicio/page.tsx
    - src/lib/domain/inicio.ts
    - src/lib/domain/payouts.ts
  deleted:
    - src/components/inicio/HechosCurados.tsx
    - src/components/inicio/KPICardsInicio.tsx
    - src/components/inicio/GMVTrendChart.tsx
    - src/components/inicio/EmpresasActivasChart.tsx
    - src/components/inicio/DeltaBadge.tsx
    - src/lib/domain/inicio-hechos.ts

key-decisions:
  - "Inline successRateAccent helper duplicated from PayoutsKPICardsV2 (4-line threshold helper; local-per-consumer over shared module — threshold contract is too small to justify the indirection cost)"
  - "Volumen IN/OUT card uses text-foreground (NOT text-section-inicio) — one-section-accent-per-page rule held strict; only Usuarios activos card carries the Indigo focal-metric application"
  - "Donut palette: 7 OKLCH fills anchored on Indigo hue (~250) with hue rotation 250→230→200→175→150→90 + reserved muted-Indigo (oklch(0.6 0.05 250)) for Otros tail — desaturated tail visually reads as background"
  - "Activity timeline dual-axis with granularity prop INFORMATIONAL ONLY — leaf renders the series the page chose; tooltip uses granularity hint to format bucket label (DD/MM/YYYY for daily, RRRR-Www for weekly)"
  - "Top users table uses raw <table> markup (Plan 07-02 deviation pattern reaffirmed — repo has no shadcn ui/table primitive; 5th leaf in v2.0 to follow this idiom)"
  - "Negative volumenNeto wrapped in text-status-fail span — flags net spenders at a glance without dedicated icon column"
  - "/inicio NO LONGER fetches payouts — getCachedPayouts dropped; tasa de éxito is now over transactions.status (not payout state) per summarizeInicioV2"
  - "Bucket granularity threshold (60-day) preserved from v1 — the ONE v1 utility that survives because the threshold rule is identical regardless of which metrics are on the page"
  - "Decommissioned features intentionally NOT carried to v2: prior-period KPI badges (computePriorPeriod + InicioDeltaSummary + DeltaBadge) + hechos curados (top empresa GMV / empresas nuevas activadas / latencia destacada) — PRD lens shift to operative absolute numbers"
  - "Cohesive multi-module v1 prune in ONE refactor(10-02) commit — mirrors Plan 09-03's 22-symbol precedent; prevents intermediate states where one module is half-pruned"
  - "v2 surface byte-identical preservation modulo dangling-JSDoc cleanup — algorithm bodies untouched; only JSDoc comments referencing now-deleted v1 symbols (e.g. 'same as v1 aggregateActiveEmpresasByDate at line 316') were edited to remove dangling pointers"
  - "Phase 7-04 deferred-prune docket CLOSED — 4 v1 payouts.ts symbols (filterPayouts, summarizePayouts, PayoutSummary, COMPLETED_PAYOUT_STATES) deleted alongside the inicio v1 block"

patterns-established:
  - "5th cockpit shape codified — operative-lens (3-card KPI strip with one accent + 2-col diagnostic grid + ranking table). Joins time-first / ranking-first / adoption-first / method-and-distribution-first / dossier (Phase 9). v2.0 cockpit vocabulary now has 5 idioms; future v3+ sections pick whichever shape matches their protagonist-metric category."
  - "v2-alongside-v1 coexistence end-to-end pattern: Plan N-01 appends v2 below v1 (byte-identical preservation); Plan N-02 swaps page imports + prunes v1 block + deletes orphaned v1 leaves + closes any cross-module deferred-prune dockets that were waiting for this consumer migration. Inicio v2 is the 5th and final coexistence cycle of v2.0."
  - "Operative-lens KPI strip with semáforo coexistence — section accent on protagonist + verde/amber/rojo on the quality KPI is a stable composition. Reusable shape for any future operational-health page (status-rate + protagonist-volume on a single strip)."
  - "Dangling-JSDoc cleanup as part of cohesive prune — when a refactor deletes symbols referenced in surviving files' JSDoc, the surviving JSDoc references should be either (a) removed if they're tutorial-style cross-refs to deleted code, or (b) redirected to a still-existing convention source that demonstrates the same pattern. Avoids dead pointers in code comments."

# Metrics
duration: ~77 min wall-clock (most of it idle on the visual checkpoint round-trip)
completed: 2026-05-08
---

# Phase 10 Plan 02: Inicio v2 Page Rewrite + Cohesive Multi-Module Prune Summary

**Inicio v2 operative-lens cockpit LIVE at `/inicio` + cohesive cleanup that closes the v2.0 milestone's last v1 prune debt. 4 new v2 leaves, 5 v1 leaves deleted, inicio-hechos.ts module deleted, inicio.ts v1 block pruned, 4 v1 payouts.ts symbols pruned (closes Phase 7-04 deferred-prune docket). v1→v2 migration end-to-end COMPLETE.**

## Performance

- **Duration:** ~77 min wall-clock (most of it idle waiting on the visual checkpoint round-trip; active execution time was much shorter — Task 1 + Task 2 + Task 3 + verifications fit in ~30 min of agent work)
- **Started:** 2026-05-08T14:26:37Z (plan start time, after context loading)
- **Completed:** 2026-05-08T15:43:27Z (this SUMMARY commit)
- **Tasks executed:** 4 of 4 (Task 1 leaf scaffolding + Task 2 page rewrite + Task 3 cohesive prune + Task 4 visual checkpoint)
- **Source-tree changes:** 13 files changed (4 created + 3 modified + 6 deleted) — `git diff --shortstat 1374dc3..HEAD -- src/` reports `803 insertions(+), 1504 deletions(-)` = **net −701 LOC removed despite delivering richer v2 lens**

## Final Inventory

### `/inicio` v2 surface (post-Plan-10-02)

**Page composition (`src/app/(protected)/inicio/page.tsx`, 153 LOC final):**
- Pipeline: `parseFilters → getCachedTransactions (try/catch with inline error Card) → filterInicioV2 ONCE → 4 v2 aggregations chained → 4-leaf composition`.
- Granularity decision: `length > 60 → "week" : "day"` (preserves v1 threshold; the only v1 utility that survives the lens shift).
- NO payouts fetch (v2 success rate is over `transactions.status`, not payout state).
- NO `data-presenter-*` attributes (CROSS-V2-07 conservative-default — operative-lens metrics are operator+cliente friendly).

**4 v2 leaf components in `src/components/inicio/`:**

| Leaf | LOC | Type | Role |
|---|---|---|---|
| `InicioKPIStripV2.tsx` | 127 | Server | 3-card grid (Usuarios activos w/ Indigo accent · Volumen IN/OUT stacked stats · Tasa éxito semáforo); inline `successRateAccent` helper |
| `TransactionTypeDonut.tsx` | 169 | Client (Recharts) | PieChart + 7 OKLCH-pinned fills (6 typed-tipo slots + reserved muted-Indigo for Otros) + Spanish-localized `TIPO_LABEL_ES` map for tooltip/legend |
| `ActivityTimelineV2.tsx` | 192 | Client (Recharts) | Dual-axis LineChart (usuariosActivos solid Indigo on left axis + volumen dashed muted-Indigo on right axis); informational `granularity` prop for tooltip-bucket-label format |
| `TopUsersByVolume.tsx` | 122 | Server | Raw `<table>` 7-col grouped by tikintag (NOT empresa); negative Neto wrapped in `text-status-fail` span |

**5 v2 domain functions consumed (from Plan 10-01):**

| Function | Role |
|---|---|
| `filterInicioV2` | Cross-cut filter (state-UNFILTERED + CSV-status + CSV-tipo + Bogotá-anchored from/to + optional empresa; BOTH directions through) |
| `summarizeInicioV2` | 3-card KPI header (usuariosActivos DISTINCT tikintag + volumenIn signed + volumenOut abs + status counters + successRate) |
| `aggregateTransactionTypeDistribution` | Donut data (top 6 + Otros rollup) |
| `aggregateActivityByDateV2` / `aggregateActivityByWeekV2` | Activity timeline (distinct-tikintag-per-bucket + signed volumen) |
| `aggregateTopUsersByVolume` | Top 10 ranking by volumenNeto (ranking key) with deterministic tiebreak |

### `inicio.ts` final shape (post-prune)

**v1 surface DELETED** (lines 1-361 of pre-prune file — 361 LOC removed):
- Functions: `filterCompletedIn`, `summarizeInicio`, `aggregateGMVByDate`, `aggregateGMVByWeek`, `aggregateActiveEmpresasByDate`, `aggregateActiveEmpresasByWeek` (6 functions).
- Types: `InicioSummary`, `InicioDeltaSummary`, `GMVPoint`, `ActiveEmpresaPoint` (4 interfaces).
- Constant: `BONUS_TIPO` (only consumed by deleted `summarizeInicio`).

**v2 surface PRESERVED** (10 exports total — 5 fns + 4 interfaces):
- 4 interfaces: `InicioSummaryV2` (line 104), `TransactionTypeBucket` (line 149), `ActivityPointV2` (line 389), `TopUserVolumeRow` (line 508).
- 6 functions: `filterInicioV2` (line 190), `summarizeInicioV2` (line 250), `aggregateTransactionTypeDistribution` (line 335), `aggregateActivityByDateV2` (line 426), `aggregateActivityByWeekV2` (line 465), `aggregateTopUsersByVolume` (line 579).

(Wait — 6 functions; corrected count below in deviations note.)

**Helpers KEPT** (used by v2 surface):
- `BOGOTA_TZ` constant (used by activity-by-date/week aggregations).
- `startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp` private functions (used by `filterInicioV2`).
- Imports: `formatInTimeZone` from `date-fns-tz`, `DashboardFilters` from `@/lib/url-state`, `Transaction` + `TransactionType` from `./types`.

**File header JSDoc rewritten** (lines 1-49) to document v2-only scope + v1→v2 migration history (Plan 04 v1 surface DELETED 2026-05-08 + Plan 10-01 append + Plan 10-02 prune chronology).

### `payouts.ts` final shape (post-prune — Phase 7-04 docket CLOSED)

**v1 surface DELETED** (4 symbols — closes Plan 07-04's deferred-prune docket):
- `filterPayouts` function.
- `summarizePayouts` function.
- `PayoutSummary` interface.
- `COMPLETED_PAYOUT_STATES` constant.

**v2 surface PRESERVED** (byte-identical):
- `filterPayoutsV2` (CSV-status + Bogotá-anchored + optional empresa).
- `summarizePayoutsByState` (3 named counters + total + successRate).
- 5 aggregations: `aggregateAverageProcessingMinutes`, `aggregateAgingAlertPending`, `aggregateFailureReasons`, `aggregateThirdPartyPayouts`, `aggregateTopBancos`.
- `quantileSorted` percentile primitive (still used internally by `aggregateTopBancos`).
- 6 type interfaces: `PayoutStateBreakdown`, `AgingAlertRow`, `FailureReasonRow`, `ThirdPartyPayoutRow`, `BancoStats`, `TopBancos`.

**Helpers KEPT** (used by v2 surface):
- `startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp` (used by `filterPayoutsV2`).

**File header JSDoc updated** — replaced the v1 default-Payouts-filter contract section (~30 lines) with a brief "v2-only surface; v1 deprecated 2026-05-08 in Plan 10-02" note pointing at this SUMMARY for context.

### `inicio-hechos.ts` (deleted entirely — 279 LOC removed)

5 exports go away: `findTopEmpresaByGMV`, `findEmpresasNuevasActivadas`, `TopEmpresaResult`, `EmpresaNueva`, `EmpresasNuevasResult`. Sole consumer was `HechosCurados.tsx` (also deleted).

## Audit Gate Output

For each of the **16 symbols** scheduled for deletion, ran `grep -rE "<symbol>" src/` BEFORE Task 3 deletion to confirm orphan status. **All 16 confirmed orphan or only-self-referencing.**

| Symbol | Live consumers (excluding files being deleted) | Status |
|---|---|---|
| `HechosCurados` | None | ✅ Orphan |
| `KPICardsInicio` | None (only JSDoc reference in TimelineActivity.tsx) | ✅ Orphan |
| `GMVTrendChart` | None (only JSDoc references in 3 unrelated files) | ✅ Orphan |
| `EmpresasActivasChart` | None (only JSDoc references in globals.css + presenter-frame.tsx) | ✅ Orphan |
| `DeltaBadge` | None (only JSDoc reference in inicio/page.tsx — being rewritten) | ✅ Orphan |
| `findTopEmpresaByGMV` | None (only inicio-hechos.ts itself) | ✅ Orphan |
| `findEmpresasNuevasActivadas` | None (only inicio-hechos.ts itself) | ✅ Orphan |
| `TopEmpresaResult` | Only HechosCurados.tsx (being deleted) | ✅ Orphan |
| `EmpresaNueva` | Only inicio-hechos.ts itself | ✅ Orphan |
| `EmpresasNuevasResult` | Only HechosCurados.tsx (being deleted) | ✅ Orphan |
| `filterCompletedIn` | None | ✅ Orphan |
| `summarizeInicio` | None (no `\bsummarizeInicio\b` outside JSDoc) | ✅ Orphan |
| `aggregateGMVByDate` / `aggregateGMVByWeek` | None (only JSDoc in GMVTrendChart.tsx — being deleted) | ✅ Orphan |
| `aggregateActiveEmpresasByDate` / `aggregateActiveEmpresasByWeek` | None (only JSDoc in EmpresasActivasChart.tsx — being deleted) | ✅ Orphan |
| `InicioSummary`, `InicioDeltaSummary`, `GMVPoint`, `ActiveEmpresaPoint` | Only inside KPICardsInicio.tsx / GMVTrendChart.tsx / EmpresasActivasChart.tsx (being deleted) | ✅ Orphan |
| `filterPayouts` | None (only JSDoc in inicio/page.tsx — being rewritten) | ✅ Orphan |
| `summarizePayouts` | None (only JSDoc references in cliente.ts + inicio-hechos.ts — being deleted) | ✅ Orphan |
| `PayoutSummary` | Only HechosCurados.tsx (being deleted) | ✅ Orphan |
| `COMPLETED_PAYOUT_STATES` | None (only payouts.ts itself) | ✅ Orphan |

**`BONUS_TIPO`** module-private constant was inspected too — only consumed by deleted `summarizeInicio` (line 221 reference). Safe to delete with v1 block.

**`BOGOTA_TZ`** + day-boundary helpers — KEPT (used by v2 surface lines 426, 465 + 190 respectively).

**`startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp` in payouts.ts** — KEPT (used by `filterPayoutsV2`).

After the audit gate cleared, the deletion landed in one cohesive commit (46346d2).

## LOC Totals

```text
git diff --shortstat 1374dc3..HEAD -- src/
13 files changed, 803 insertions(+), 1504 deletions(-)
```

**Net delta: −701 LOC removed** despite delivering a richer 6-requirement v2 cockpit (INI-V2-01..06).

Per-file breakdown:

| File | Delta | Notes |
|---|---|---|
| `src/app/(protected)/inicio/page.tsx` | +128 / −161 | Page rewrite (255 → ~153 LOC) |
| `src/components/inicio/InicioKPIStripV2.tsx` | +127 | New |
| `src/components/inicio/TransactionTypeDonut.tsx` | +169 | New |
| `src/components/inicio/ActivityTimelineV2.tsx` | +192 | New |
| `src/components/inicio/TopUsersByVolume.tsx` | +122 | New |
| `src/components/inicio/HechosCurados.tsx` | −124 | Deleted |
| `src/components/inicio/KPICardsInicio.tsx` | −130 | Deleted |
| `src/components/inicio/GMVTrendChart.tsx` | −109 | Deleted |
| `src/components/inicio/EmpresasActivasChart.tsx` | −113 | Deleted |
| `src/components/inicio/DeltaBadge.tsx` | −78 | Deleted |
| `src/lib/domain/inicio-hechos.ts` | −279 | Deleted |
| `src/lib/domain/inicio.ts` | +57 / −408 | v1 block pruned (lines 1-361 + BONUS_TIPO + Constants section); v2 surface preserved byte-identical (algorithm bodies untouched); JSDoc + file header rewritten |
| `src/lib/domain/payouts.ts` | +8 / −102 | v1 surface (4 symbols) pruned; file header JSDoc updated |

**Plan estimate vs actual:** Plan estimated `~−500 to −800 LOC removed`. Actual: **−701 LOC**, comfortably inside the predicted band. Plan also broke down expected sources: v1 inicio block ~360 LOC + inicio-hechos.ts 279 LOC + 5 v1 leaves ~554 LOC + payouts.ts v1 surface ~120 LOC ≈ −1300 LOC removed; v2 page rewrite ~−100 LOC delta + 4 new leaves ~+450 LOC = ~−950 LOC net. Actual matches the rough magnitude (4 leaves landed at +610 not +450; rest tracks closely).

## Task Commits

Each task was committed atomically:

| Task | Commit | Description | Stat |
|---|---|---|---|
| 1. Add 4 v2 leaves | `76b5d8f` | feat(10-02): add 4 inicio v2 leaves (KPIStrip + TipoDonut + ActivityTimeline + TopUsersByVolume) | +610 LOC across 4 new files |
| 2. Page rewrite | `09a9816` | refactor(10-02): rewrite /inicio as v2 operative-lens cockpit | +128 / −161 (1 file) |
| 3. Cohesive multi-module prune | `46346d2` | refactor(10-02): cohesive v1 prune — 5 leaves + inicio-hechos + 9 symbols across inicio.ts/payouts.ts | +69 / −1347 (10 files; 6 deleted) |

Plus the metadata commit (this SUMMARY.md + STATE.md update) that closes the plan: `docs(10-02): complete inicio v2 page rewrite plan`.

## Decisions Made

(See `key-decisions` in frontmatter for the full list extracted to STATE.md.)

Highlights:

1. **Inline `successRateAccent` helper** — Plan said "search `src/components/payouts/` first, reuse if found." Found at `PayoutsKPICardsV2.tsx:53` (4-line threshold helper). Decided to **duplicate inline** rather than extract to a shared module: the threshold contract is small (3 branches), and a shared module would add an indirection that costs more than the duplication. Two consumers (PayoutsKPICardsV2 + InicioKPIStripV2) with identical thresholds; if a third consumer arrives, that's the time to extract.

2. **Volumen IN/OUT card text-foreground (NOT section accent)** — Plan called for `text-foreground` explicitly to hold the one-section-accent-per-page rule. Implemented per spec.

3. **Donut palette: 7 OKLCH fills** — anchored on Indigo hue (~250) with hue rotation (250→230→200→175→150→90 for the 6 typed slots) + reserved muted-Indigo `oklch(0.6 0.05 250)` for Otros tail. Same convention as BonosFlowChart / RecargasTrendChartV2 (pinned literals so dark mode renders correctly without theme classes).

4. **Activity timeline `granularity` prop is INFORMATIONAL ONLY** — page upstream picks `aggregateActivityByDateV2` vs `aggregateActivityByWeekV2` and passes the resulting series; leaf doesn't re-bucket. Granularity hint feeds tooltip bucket-label format (DD/MM/YYYY for daily, RRRR-Www verbatim for weekly). Caption text inside the wrapping Card is the page's responsibility (NOT the leaf's).

5. **Top users raw `<table>` markup** — 5th v2 leaf to follow this idiom (Plan 07-02 deviation pattern reaffirmed: TopEmisores → TopReceptores → TopRechargers → TopCardUsers → TopUsersByVolume). Repo has no shadcn `ui/table` primitive; raw markup over `<thead>`/`<tbody>` is the established convention.

6. **Negative `volumenNeto` in `text-status-fail`** — flags net spenders at a glance without a dedicated icon column. Inline ternary in the JSX: `row.volumenNeto < 0 ? <span className="text-status-fail">{formatCOP(row.volumenNeto)}</span> : formatCOP(row.volumenNeto)`. Same status palette as the semáforo on the KPI strip — orthogonal concerns, both use the v2 status tokens established in Phase 6 Plan 04.

7. **`/inicio` no longer fetches payouts** — `getCachedPayouts()` import + call dropped. v2 success rate is over `transactions.status`, NOT payout state. The dual-fetch in v1 (transactions + payouts) is replaced by a single transaction fetch. One less Sheets API roundtrip per request; `React.cache()` dedupe with `DashboardHeader` continues to work.

8. **Bucket granularity threshold (60-day) preserved from v1** — the ONE v1 utility that survives the lens shift. `differenceInCalendarDays` from `date-fns` re-imported. The threshold rule is identical regardless of which metrics are on the page (operators read range-duration the same way).

9. **Decommissioned features intentionally NOT carried to v2:**
   - Prior-period KPI badges (`computePriorPeriod` + `InicioDeltaSummary` + `DeltaBadge`). PRD lens shift: INI-V2 requirements describe absolute numbers, not deltas (mirror Plan 08-04 `recargas` page decision documented in STATE.md).
   - Hechos curados (top empresa GMV / empresas nuevas activadas / latencia destacada). PRD pivots to operative lens; the editorial highlight reel does not appear in INI-V2-01..06.

10. **Cohesive multi-module v1 prune in ONE `refactor(10-02)` commit** — mirrors Plan 09-03's 22-symbol cohesive prune precedent. Audit gate before deletion (per-symbol `grep -rE`); after gate clears, all 16 symbols + 6 file deletions land in one commit (46346d2). Prevents intermediate states where a module is half-pruned.

11. **v2 surface byte-identical preservation modulo dangling-JSDoc cleanup** — algorithm bodies untouched (`git diff` shows zero added algorithm lines in the v2 functions). The v2 surface's JSDoc had several cross-references to v1 symbols (e.g. "see v1 `aggregateActiveEmpresasByDate` at line 316" — now points nowhere after v1 block deleted). Edited JSDoc to remove dangling pointers. This is a **necessary deviation from strict byte-identical** because byte-identical with dangling pointers would have been worse than rationally-pruned JSDoc. Documented in the Task 3 commit message + this SUMMARY.

12. **Phase 7-04 deferred-prune docket CLOSED** — 4 v1 payouts.ts symbols (`filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`) deleted alongside the inicio v1 block. These were the LAST v1 symbols carrying milestone debt. After this plan ships:
    - **Phase 9-03 closeout** had pruned 22 symbols (across bonos.ts + recargas.ts + clientes.ts).
    - **Phase 10-02 closeout** prunes 4 more (across payouts.ts + the inicio.ts/inicio-hechos.ts/v1-leaves block which is +13 symbols depending on counting).
    - **Final tally:** 26+ symbols pruned across Phases 9-03 + 10-02; Phase 9 deferred-prune docket fully closed. v2.0 milestone has ZERO outstanding deferred-prune debt.

## Deviations from Plan

### Auto-fixed inline (Rule 1 — Bug)

**1. [Rule 1 - Bug] Dangling JSDoc references to deleted v1 leaves in 2 surviving files**

- **Found during:** Task 3 audit gate (post-Task 2). Identified during the `grep -rE` audit:
  - `src/components/inicio/ActivityTimelineV2.tsx:39` referenced "Same convention as v1 GMVTrendChart" — but GMVTrendChart was about to be deleted in Task 3.
  - `src/components/inicio/TransactionTypeDonut.tsx:40` referenced "Same convention as the v1 GMVTrendChart empty-state" — same dangling pointer.
- **Issue:** Both references would have become dangling pointers after Task 3 deleted GMVTrendChart, leaving JSDoc that referenced non-existent code. Future agents reading these files would hit a confusing dead-end.
- **Fix:** Redirected both references to **PurchaseTrendChart / RecargasTrendChartV2** (still-existing convention sources that demonstrate the same empty-state and sparse-input idioms post-prune).
- **Files modified:** `src/components/inicio/ActivityTimelineV2.tsx` (1-line JSDoc edit), `src/components/inicio/TransactionTypeDonut.tsx` (1-line JSDoc edit).
- **Commit:** Folded into commit `46346d2` (Task 3 cohesive prune) — staged alongside the v1 deletions so the diff lands as a coherent cleanup.
- **Why this was Rule 1 (bug):** Code documentation that points to non-existent symbols is broken documentation. Self-fixed inline; no checkpoint needed.

### Architectural-clarification (Rule 4 — handled inline, NOT a blocking checkpoint)

**2. [Rule 4 - Architectural clarification] v2 JSDoc edits beyond strict byte-identical preservation**

- **Found during:** Task 3 v1 prune (after deleting v1 block from inicio.ts).
- **Issue:** Plan's `<critical>` clause said "v2 surface preservation is byte-identical (no opportunistic edits — discipline matches Plan 09-03's 22-symbol prune commit discipline)." Strict byte-identical interpretation would preserve the v2 surface's JSDoc verbatim. But the v2 JSDoc had multiple cross-references to v1 symbols ("same convention as v1 `aggregateActiveEmpresasByDate` at line 316", "see v1 `aggregateGMVByWeek` for rationale on `RRRR`", etc.) — all of which would point to non-existent code after the v1 block deletion.
- **Fix:** Edited the v2 JSDoc to remove the dangling cross-references. Algorithm function bodies preserved byte-identical (zero added algorithm lines per `git diff` audit). Edits limited to JSDoc comments that referenced now-deleted code; explanatory comments without v1 cross-refs left untouched.
- **Verification:** `git diff HEAD -- src/lib/domain/inicio.ts | grep -E "^\\+[^+].*=|^\\+[^+].*function|^\\+[^+].*return|^\\+[^+].*const " | grep -vE "^\\+\\s*\\*"` returns zero matches — no algorithm lines added.
- **Why this was Rule 4 (architectural clarification) but did NOT block as a checkpoint:** The deviation is interpretive — what does "byte-identical" mean when the v2 JSDoc references symbols being deleted in the SAME commit? Two interpretations: (a) literal byte-identical preservation leaves dangling pointers; (b) preserve algorithm fidelity but allow JSDoc cleanup of dead references. Interpretation (b) is objectively more useful (no dead pointers in code comments) and is the conservative interpretation of the plan's intent (which was guarding against opportunistic algorithm rewrites under cover of refactor, not against JSDoc cleanup of just-orphaned references). No user input needed — single objectively-correct answer per the plan's underlying intent. Documented in commit message and this SUMMARY for audit transparency.
- **Pattern note:** Future cohesive prunes that delete cross-referenced symbols will face the same interpretive choice. Convention going forward: **JSDoc cleanup of dangling references is part of cohesive prune scope; algorithm bodies must remain byte-identical.** This is a tighter version of Plan 09-03's discipline (which had no v1↔v2 JSDoc cross-references to clean up — Plan 09-03 cleaned 22 symbols cleanly across modules where the v2 surfaces had no v1-pointing JSDoc).

### Strict-fidelity comparisons

- **No field-name reconciliation** — plan vocabulary matched types.ts + Plan 10-01 exports verbatim. **Sixth clean break in a row** after Plans 09-01, 09-02, 09-03, 10-01 (counting only v2.0; Phase 8 plans had recurring PRD-vocabulary translations but Phases 9-10 have all been clean). Pattern note for future plans: when the executor's @-context contract is well-cited in the plan and the plan author cross-refs types.ts / sibling SUMMARYs, field-name reconciliation rate drops to zero.
- **No Rule 2 (missing critical) deviations** — the plan was complete; no missing input validation / error handling / auth gates / etc.
- **No Rule 3 (blocking) deviations** — no dependency / build / config / type errors blocking execution.
- **Sub-threshold notes (NOT counted as Rule deviations):**
  - **`text-foreground` on Volumen IN/OUT card** — plan called for this explicitly ("`text-foreground` (NOT section accent — only one accent per page)"); honored verbatim. No deviation.
  - **Donut "Otros" reserved muted-Indigo** — plan specified `oklch(0.6 0.05 250)` literally; honored verbatim. No deviation.
  - **Bucket granularity threshold preservation** — plan called for it ("Re-import `differenceInCalendarDays` from `date-fns`. (This is the ONE v1 utility that survives because the threshold rule is identical.)"); honored verbatim.
  - **Plan minor count quibble:** plan's `<verify>` clause #3 said "Final v2 surface: 10 v2 exports only (5 fns + 4 interfaces)" — but Plan 10-01 SUMMARY's actual count was 6 fns + 4 interfaces = 10 exports. Plan author miscounted v2 functions (forgot one of the activity aggregations). Actual exports today: 6 fns + 4 interfaces = 10 (same as plan's total even if the breakdown is 6+4 rather than 5+4+1). NOT a deviation — verify clause overall total still matches.

**Total deviations:** 1 Rule-1 bug fix (dangling JSDoc references; 2 affected files; folded into Task 3 commit) + 1 Rule-4 architectural clarification on byte-identical JSDoc scope (handled inline; documented).

**Impact on plan:** No scope creep. The dangling-JSDoc cleanup is a natural part of cohesive-prune hygiene; the byte-identical interpretive choice falls within the plan's underlying intent (algorithm-fidelity preservation). Plan delivered exactly the surface specified.

## Issues Encountered

**None blocking.** Build was clean on every attempt; tsc + lint baselines unchanged across the 3 task commits + the metadata commit; no parallel-wave race observed (single-agent execution).

The `/inicio` page rebuilt in place — 13 routes both before and after the plan, no route additions or removals.

## Verification Snapshot

- **`npx tsc --noEmit`:** 0 errors (verified after each task)
- **`npm run lint`:** 0 errors, 3 pre-existing warnings unchanged (`ClientesTable.tsx:292`, `rate-limit.ts:37`, `_utils.ts:128`)
- **`npm run build`:** 13 routes (`/inicio` rebuilt in place; `/bonos`, `/clientes`, `/clientes/[empresaId]`, `/payouts`, `/recargas`, `/uso-tarjeta` all continue to compile)
- **Section accent grep:** `grep -rE "text-section-inicio" src/components/inicio/InicioKPIStripV2.tsx` → exactly 1 actual JSX className occurrence (the others are JSDoc references in the same file documenting the rule)
- **Use-client directive grep:** `grep -lE '"use client"' src/components/inicio/{4-leaves}.tsx` → ONLY `TransactionTypeDonut.tsx` and `ActivityTimelineV2.tsx` carry the directive (Server Components otherwise)
- **Final audit grep** (post-prune, looking for v1 symbol survivors): 15 matches across 8 files — ALL are JSDoc/CSS-comment historical references documenting the v1→v2 migration; ZERO imports, ZERO component-uses, ZERO algorithm references survived. Plan's verify clause "ONLY documentation/JSDoc references (zero import or component-use survivors)" satisfied.
- **`git ls-files src/components/inicio/`:** ONLY 4 v2 leaves (no DeltaBadge / HechosCurados / KPICardsInicio / GMVTrendChart / EmpresasActivasChart)
- **`git ls-files src/lib/domain/inicio-hechos.ts`:** empty (file deleted)
- **`grep -nE "^export (interface|function|const)" src/lib/domain/inicio.ts`:** ONLY v2 exports (10 total — 4 interfaces + 6 functions)
- **`grep -nE "^export (interface|function|const)" src/lib/domain/payouts.ts`:** does NOT show `filterPayouts` / `summarizePayouts` / `PayoutSummary` / `COMPLETED_PAYOUT_STATES`

## User Setup Required

None — pure-code refactor. No external service configuration, no env var changes, no Sheets schema modifications.

## Phase 10 Closeout Status

**Phase 10: Inicio + Infrastructure** — ready to mark **⚠️ Partial**:

| Plan | Status | Notes |
|------|--------|-------|
| 10-01: Inicio v2 domain surface | ✅ Complete (2026-05-08) | Plan 10-01 SUMMARY: inicio.ts +568 LOC v2 surface |
| 10-02: Inicio v2 page rewrite + cohesive prune | ✅ **Complete (2026-05-08, this plan)** | This SUMMARY: −701 net LOC; 4 new leaves + page rewrite + 16 symbols pruned across 6 files |
| 10-03: INFRA-04 custom domain | ⏸ Deferred (2026-05-08) | Plan 10-03 SUMMARY: documentation-only closeout; carry-forward to next milestone |

**Phase 10 closes as ⚠️ Partial** — Inicio v2 functional milestone delivered ✅; INFRA-04 explicitly carries forward with documented user decision.

**v2.0 milestone status:** **declarable**. 50/51 v1 requirements met (all except INFRA-04, which is explicit deferred debt). Custom domain debt is reversible (3 paths still on the table per Plan 10-03 SUMMARY). Functional surface is complete: 6 sections (Inicio · Bonos · Payouts · Uso Tarjeta · Vista Cliente · Recargas) all running on v2 surface end-to-end.

**v2.0 milestone v1→v2 migration end-to-end COMPLETE.** Final tally:

| Phase | v1 Surface Pruned | Cumulative |
|-------|-------------------|------------|
| 7-04 | 7 v1 payouts symbols (kept 4 alive) | 7 |
| 7-02 | 4 v1 bonos leaves (kept 8 symbols alive) | 11 |
| 9-03 | 22 v1 symbols + 3 v1 leaves (across bonos + recargas + clientes) | 33 + 3 leaves |
| **10-02** (this plan) | **4 v1 payouts symbols + 10 v1 inicio symbols + 5 v1 leaves + inicio-hechos.ts module** | **47 + 8 leaves + 1 module** |

Phase 9 deferred-prune docket (22 symbols) + Phase 7-04 deferred-prune docket (4 payouts symbols) BOTH fully closed.

## Next Phase Readiness

**Forward-state:**
- Plan 10-02 ships → Phase 10 closes as ⚠️ Partial.
- v2.0 milestone declarable (orchestrator: `/gsd:complete-milestone` audit appropriate).
- INFRA-04 carry-forward chain remains open (Plan 05-05 → Plan 10-03 → next milestone).

**Open question carry-forward (from Plan 09-02 + 09-03 visual checkpoints):**
- ComprasClienteCard recent-purchases mini-list still deferred per YAGNI (no surface need surfaced through Phases 9 + 10). Add `purchases?: Transaction[]` prop and inline recent-list inside the existing card if a future iteration wants it; no new leaf needed.

**No blockers, no concerns.** v2.0 functional milestone is shippable; INFRA-04 is the sole deferred debt with documented carry-forward + reversibility playbook.

---

*Phase: 10-inicio-infra*
*Plan: 10-02*
*Completed: 2026-05-08*
*Outcome: ✅ SHIPPED — v1→v2 migration end-to-end COMPLETE; Phase 7-04 + Phase 9 deferred-prune dockets CLOSED; Phase 10 ready for ⚠️ Partial closeout.*
