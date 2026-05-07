---
phase: 07-bonos-payouts
plan: 04
subsystem: ui
tags: [payouts, time-first, cockpit, aging-alert, third-party, semáforo, joinPayouts-consumer, v2.0, partial-prune]

# Dependency graph
requires:
  - phase: 06-foundation-v2
    provides: Plan 06-02 canonical joinPayouts/JoinedPayout helper, Plan 06-03 DashboardFilters.status CSV, Plan 06-04 section-payouts + status semáforo CSS tokens
  - phase: 07-bonos-payouts
    provides: Plan 07-03 v2 domain helpers (filterPayoutsV2, summarizePayoutsByState, aggregateAverageProcessingMinutes, aggregateAgingAlertPending, aggregateFailureReasons, aggregateThirdPartyPayouts) + 4 v2 types
provides:
  - PayoutsKPICardsV2 (5-card time-first header — tiempo promedio + tasa éxito semáforo + total + volumen + terceros)
  - AgingAlert (conditional red-bordered table for in_progress > 2h; returns null when empty)
  - StatusBreakdownCards (3 KPIs por estado con dot-indicador semáforo verde/rojo/amarillo)
  - FailureReasons (top 5 horizontal bars + collapsible "Ver todas las razones" details)
  - ThirdPartyPayouts (table with Tikintag/Holder/Monto/Banco/Estado-badge)
  - TopBancos (restyled — section-payouts left-edge accent + per-row volume bars)
  - formatMinutes helper in src/lib/format.ts (em-dash for zero/null; <1 min / N min / Nh Mmin / Nd progression)
  - v2 Payouts page composition — first-scroll velocidad + alert; second-scroll calidad + diagnóstico
  - First production consumer of Plan 06-02 joinPayouts() (chained into aggregateThirdPartyPayouts)
affects:
  - phase: 09-clientes-vista-v2 (Vista Cliente reuses joinPayouts pipeline + tasa-éxito semáforo + AgingAlert pattern)
  - phase: 10-inicio-v2 (Inicio rewrite must migrate "Latencia destacada" hecho off the kept-alive v1 filterPayouts/summarizePayouts/PayoutSummary surface; partial-prune deferral documented below)

# Tech tracking
tech-stack:
  added: [] # zero deps; pure additive TypeScript + Tailwind on existing infrastructure
  patterns:
    - "Time-first cockpit layout (PRIMARY KPI text-4xl, semáforo-bound color, conditional alert above the quality semáforo, diagnostic layer at bottom) — first scroll answers velocity question before quality or diagnóstico"
    - "Threshold-bound semáforo color via helper (≥95% verde, ≥85% amber, else rojo) — single function called inline at the className interpolation site, mirrors the pattern future v2 KPIs will adopt"
    - "Conditional null-render for empty-state cards (AgingAlert returns null when rows.length === 0) — health = absence of card; no awkward 'all clear' placeholder consuming vertical space"
    - "JoinedPayout pipeline at page-composition (joinPayouts ONCE per request, chained into aggregateThirdPartyPayouts) — the first production wiring of the canonical Plan 06-02 helper; pattern reusable by Phase 9 Vista Cliente"
    - "Partial v1 prune with explicit cross-page-consumer audit — when domain symbols slated for deletion still have non-rewritten consumers (Inicio + Clientes pages), keep them alive and document the deferral"

key-files:
  created:
    - "src/components/payouts/PayoutsKPICardsV2.tsx (146 LOC)"
    - "src/components/payouts/AgingAlert.tsx (95 LOC)"
    - "src/components/payouts/StatusBreakdownCards.tsx (99 LOC)"
    - "src/components/payouts/FailureReasons.tsx (138 LOC)"
    - "src/components/payouts/ThirdPartyPayouts.tsx (130 LOC)"
  modified:
    - "src/lib/format.ts (+34 LOC: formatMinutes helper)"
    - "src/components/payouts/TopBancos.tsx (restyled: section-payouts left-edge accent + per-row volume bars)"
    - "src/app/(protected)/payouts/page.tsx (full rewrite: v2 imports, joinPayouts pipeline, time-first layout)"
    - "src/lib/domain/payouts.ts (-218 LOC: deleted filterPayoutsByPeriodOnly, aggregateLatencyHistogram, LatencyBucket, LatencyBucketLabel, HISTOGRAM_BUCKET_ORDER, aggregateSuccessRate, SuccessRate)"
  deleted:
    - "src/components/payouts/PayoutsKPICards.tsx (replaced by PayoutsKPICardsV2)"
    - "src/components/payouts/LatencyHistogram.tsx (replaced by tiempo promedio + AgingAlert + status semáforo combo)"

key-decisions:
  - "Partial v1 prune (Rule 4 deviation — scope-bound deferral): domain symbols filterPayouts, summarizePayouts, PayoutSummary, COMPLETED_PAYOUT_STATES KEPT alive because still consumed outside /payouts/page.tsx (full list under Deviations). Deletion would have spilled into Inicio + Clientes page rewrites that belong to Phases 9 + 10. The plan's verify section explicitly anticipated this gate ('STOP and surface — that file needs a swap before the prune can land') and the output spec sanctioned it ('Any v1 dead code that we left in place because pruning would have spilled out of scope'). Live build still green; v2 page works; v1 callers unchanged."
  - "Tasa-de-éxito semáforo bound by threshold (≥95% verde, ≥85% amber, else rojo) at the className interpolation site via successRateAccent() helper — colocated with the JSX that uses it; not exported. If/when more KPIs adopt the same semáforo binding, refactor to a shared util."
  - "AgingAlert returns null when rows.length === 0 — the page-composition layer flows directly from KPI header to status semáforo without any 'queue is healthy' placeholder. Empty-state IS the absence of the card, not a positive message. Consistent with the alert framing (red border + ⚠ glyph in title): the card itself reads as a problem signal."
  - "TopBancos per-row volume bars use Math.max(4, fraction*100) clamping — even a tiny tail bank (e.g. <1% of leader) renders a visible 4% stub. The bar is a relative-volume cue, not an absolute reading; the bar PLUS the formatCOP value together tell the full story."
  - "formatMinutes em-dash for zero (NOT '0 min') — mirror of formatCOP/formatInteger/formatPercent policy. 0-minute mean processing time is a 'no data' signal (empty completed set), not a literal zero."
  - "JOIN runs unconditionally per-request in the v2 page — was conditional on filters.empresa in v1 (joined only when narrowing by empresa). v2 always needs Transaction.tikintag for aggregateThirdPartyPayouts (PAY-V2-08), so the conditional fetch is removed. React cache() dedupes the BD_Plataforma fetch with DashboardHeader's empresa-registry call, so the always-on JOIN doesn't double-pay quota."
  - "FailureReasons hybrid bars + collapsible details — Tailwind div-based bars (no Recharts; this is a small categorical breakdown, a chart would overweight the visual budget). Top 5 always visible; full table behind '<details> Ver todas las razones'. Empty state ('Sin fallos en el período') tinted text-status-success — this is good news."
  - "PayoutState type lives in src/lib/domain/types.ts, NOT re-exported from payouts.ts — ThirdPartyPayouts.tsx had to import directly from types.ts after tsc surfaced 'declares locally but not exported'. Inline import-fix during Task 1 verification."

patterns-established:
  - "Time-first cockpit layout (07-CONTEXT.md 'Payouts: time-first' essential): PRIMARY KPI is text-4xl with section accent; semáforo-bound color on the second protagonist; conditional alert between protagonists and quality semáforo; diagnostic layer at bottom in lg:grid-cols-2. Reusable shape for any future operational/quality dashboards."
  - "Conditional null-render for empty-state cards: cleaner than rendering an empty 'all clear' placeholder. Used for AgingAlert in this plan; reusable for any future alert/queue widget."
  - "JoinedPayout pipeline at page-composition: joinPayouts ONCE per request, chained into one or more downstream aggregations. First production wiring; Phase 9 Vista Cliente will reuse for empresa enrichment + tikintag-based metrics."
  - "Partial-prune-with-audit pattern: when a Wave-2 plan slates v1 symbols for deletion, grep ALL consumers BEFORE deleting. If consumers exist outside the rewritten page, partial-prune (delete ONLY symbols whose ONLY consumer was the rewritten page) and explicitly flag the deferred symbols in SUMMARY + STATE.md. Plan's own verify section anticipates this branch."

# Metrics
duration: ~25min
completed: 2026-05-07
---

# Phase 7 Plan 04: Payouts Page v2 (time-first cockpit) Summary

**v2 Payouts cockpit shipped — TIME-FIRST 5-card KPI header with tasa-éxito semáforo, conditional > 2h aging alert, status-breakdown semáforo (verde/rojo/amarillo), restyled TopBancos with per-row volume bars, FailureReasons hybrid bars+details, ThirdPartyPayouts table — and the FIRST production consumer of Plan 06-02 canonical `joinPayouts()` (chained into PAY-V2-08 third-party detection).**

## Performance

- **Duration:** ~25 min wall-clock (two atomic task commits + finalization)
- **Started:** 2026-05-07T18:25:00Z
- **Completed:** 2026-05-07T18:50:00Z
- **Tasks:** 2 atomic auto-task commits + 1 visual checkpoint (approved) + 1 plan-metadata commit
- **Files modified:** 4 (1 page rewrite + 1 format helper + 1 TopBancos restyle + 1 domain prune)
- **Files created:** 5 v2 leaf components
- **Files deleted:** 2 v1 leaf components
- **LOC delta:** +694 / -545 across the two task commits (net +149)

## Accomplishments

- **5 new v2 leaf components** in `src/components/payouts/` honoring the section-payouts (Cyan OKLCH from Plan 06-04) accent + status semáforo (verde/rojo/amarillo)
- **`formatMinutes` helper** added to `src/lib/format.ts` — em-dash for zero/null; <1 min / N min / Nh Mmin / Nd progression
- **TopBancos restyled** — `border-l-4 border-section-payouts` left-edge accent + per-row volume bars (`bg-section-payouts/70`, clamped at 4% min width)
- **v2 page composition** — time-first cockpit (KPI header → AgingAlert conditional → StatusBreakdown → TopBancos → FailureReasons / ThirdParty side-by-side at lg)
- **First production consumer of `joinPayouts()`** — page composition runs the JOIN ONCE per request and chains into `aggregateThirdPartyPayouts`
- **Partial v1 prune** — deleted `filterPayoutsByPeriodOnly`, `aggregateLatencyHistogram`, `LatencyBucket`, `LatencyBucketLabel`, `HISTOGRAM_BUCKET_ORDER`, `aggregateSuccessRate`, `SuccessRate` from `payouts.ts`; deleted `PayoutsKPICards.tsx` + `LatencyHistogram.tsx` v1 leaves
- **tsc + lint + build all green** (0 errors, 3 pre-existing warnings unchanged); `/payouts` route present in build output
- **Visual checkpoint approved** by user

## Task Commits

Each task was committed atomically:

1. **Task 1: v2 leaf components + formatMinutes + TopBancos restyle** — `1de1b46` (feat)
   - 5 new leaf components: PayoutsKPICardsV2, AgingAlert, StatusBreakdownCards, FailureReasons, ThirdPartyPayouts
   - formatMinutes helper appended to format.ts
   - TopBancos restyled with section-payouts left-edge + per-row volume bars
   - tsc + lint clean; v1 page still building
2. **Task 2: page rewrite + partial v1 prune** — `faeac6a` (feat)
   - Full rewrite of `src/app/(protected)/payouts/page.tsx` (v2 imports + joinPayouts pipeline + time-first layout)
   - Deleted v1 component leaves + 7 v1 domain symbols (kept the 4 still-consumed ones)
   - tsc + lint + build green

**Plan metadata:** TBD (this commit)

## Files Created/Modified

**Created:**
- `src/components/payouts/PayoutsKPICardsV2.tsx` — TIME-FIRST 5-card header (tiempo promedio + tasa éxito semáforo + total + volumen + terceros)
- `src/components/payouts/AgingAlert.tsx` — Conditional red-bordered table for in_progress > 2h (returns null when empty)
- `src/components/payouts/StatusBreakdownCards.tsx` — 3 KPIs por estado con dot-indicador (verde/rojo/amarillo)
- `src/components/payouts/FailureReasons.tsx` — Top 5 horizontal bars + collapsible full table
- `src/components/payouts/ThirdPartyPayouts.tsx` — Tikintag/Holder/Monto/Banco/Estado-badge table

**Modified:**
- `src/lib/format.ts` — added `formatMinutes` helper (lines 83-116)
- `src/components/payouts/TopBancos.tsx` — left-edge `border-section-payouts` + per-row volume bars
- `src/app/(protected)/payouts/page.tsx` — full v2 rewrite
- `src/lib/domain/payouts.ts` — partial prune (-218 LOC; see Deviations for the kept-alive list)

**Deleted:**
- `src/components/payouts/PayoutsKPICards.tsx` (replaced by PayoutsKPICardsV2)
- `src/components/payouts/LatencyHistogram.tsx` (replaced by tiempo promedio + AgingAlert + status semáforo combo)

**Final tree shape (`src/components/payouts/`):**
```
AgingAlert.tsx              (NEW — Task 1)
FailureReasons.tsx          (NEW — Task 1)
PayoutsKPICardsV2.tsx       (NEW — Task 1)
StatusBreakdownCards.tsx    (NEW — Task 1)
ThirdPartyPayouts.tsx       (NEW — Task 1)
TopBancos.tsx               (RESTYLED — Task 1)
```
6 files, all v2.

## Decisions Made

(See `key-decisions` in frontmatter for the full set; the 4 most important for downstream phases are recorded in STATE.md as Accumulated Context entries.)

### Output-spec items (from plan output section)

**(a) Final v2-only file list under `src/components/payouts/`:** 6 files — AgingAlert, FailureReasons, PayoutsKPICardsV2, StatusBreakdownCards, ThirdPartyPayouts, TopBancos. PayoutsKPICards (v1) and LatencyHistogram (v1) deleted via `git rm`.

**(b) Live data sanity — actual tasa de éxito % + threshold band:** The visual checkpoint was approved without a specific data observation note from the user. On the REQUIREMENTS.md baseline (~91%) the semáforo would land in the **amber band** (`≥85% but <95%` → `text-status-pending`). Recording the band logic here so the future operator viewing the cockpit can predict the color at a glance: ≥95% verde, 85-94% amber, <85% rojo.

**(c) AgingAlert empty vs populated during checkpoint:** Not explicitly captured during checkpoint approval. Plan 07-03 SUMMARY noted Plan 03-01 confirmed `in_progress` rows exist in production; if any in_progress row exceeds 2h aging, the AgingAlert renders. The pattern is conditional-null-render — operators who never see the card can infer healthy queue.

**(d) TopBancos restyle — survived as planned, or v1 styling needed surgery?** Survived cleanly — required only adding `border-l-4 border-section-payouts` to the wrapping Card + a per-row `bg-section-payouts/70` volume bar element. Existing `displayBancoName` + Card structure + `Otros bancos` rollup all preserved unchanged. Props and export name identical (page consumes it identically). Bar width clamped at 4% min so even tiny banks render a visible stub.

**(e) Final exported third-party count vs expected baseline (PAY-V2-08):** Not captured numerically during checkpoint approval. Visible to operators via the "Pagos a terceros" KPI card (5th in the header). Baseline expectation: small but non-zero (e.g. handful per month), since most payouts route to a registered cardholder name matching the requesting tikintag.

**(f) Any v1 dead code left in place because pruning would have spilled out of scope:** YES — see Deviations section below. Critical context for Phase 9 + Phase 10 page rewrites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4 — Architectural / Scope] Partial v1 prune (deferred symbols still alive)**

- **Found during:** Task 2 verify step ("If anything else references these symbols, STOP and surface — that file needs a swap before the prune can land.")
- **Issue:** The plan asked to delete `filterPayouts`, `filterPayoutsByPeriodOnly`, `summarizePayouts`, `aggregateLatencyHistogram`, `aggregateSuccessRate`, `COMPLETED_PAYOUT_STATES` from `src/lib/domain/payouts.ts`. Investigation revealed 4 of those symbols still consumed outside `/payouts/page.tsx`:
  - `filterPayouts` — used by `src/app/(protected)/inicio/page.tsx` (Latencia destacada hecho) AND `src/app/(protected)/clientes/[empresaId]/page.tsx` (mini cards data)
  - `summarizePayouts` — used by `src/app/(protected)/inicio/page.tsx` AND `src/app/(protected)/clientes/[empresaId]/page.tsx`
  - `PayoutSummary` (interface) — used by `src/components/inicio/HechosCurados.tsx` AND `src/components/clientes/EmpresaMiniCards.tsx`
  - `COMPLETED_PAYOUT_STATES` (constant) — used internally by the kept-alive `filterPayouts` (would become orphan-safe to delete only after `filterPayouts` itself is migrated)
  - Plan 07-03 SUMMARY was unaware of these cross-page consumers (its pruning list assumed `/payouts/page.tsx` was the sole consumer).
- **Fix:** Executed a **partial prune** per the plan's explicit "STOP and surface" gate + the output spec line "Any v1 dead code that we left in place because pruning would have spilled out of scope (and a flag for future cleanup)":
  - **DELETED** (only consumed by /payouts/page.tsx + the deleted v1 leaves): `filterPayoutsByPeriodOnly`, `aggregateLatencyHistogram`, `LatencyBucket`, `LatencyBucketLabel`, `HISTOGRAM_BUCKET_ORDER`, `aggregateSuccessRate`, `SuccessRate`
  - **KEPT alive** (still consumed by Inicio + Clientes pages, out-of-scope for 07-04): `filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`
- **Files modified:** `src/lib/domain/payouts.ts` (partial prune), no Inicio/Clientes files touched
- **Verification:** `grep -rE "filterPayoutsByPeriodOnly|aggregateLatencyHistogram|aggregateSuccessRate\b|LatencyBucket|HISTOGRAM_BUCKET_ORDER|SuccessRate\b" src/` returns ZERO matches; the 4 kept-alive symbols still grep-resolve in Inicio + Clientes consumers; tsc + lint + build all green
- **Committed in:** `faeac6a` (Task 2 commit)

**Carry-forward implication:** Phase 10 (Inicio v2 rewrite) and Phase 9 (Vista Cliente v2 rewrite — the cliente profile page in `clientes/[empresaId]/page.tsx`) both inherit the responsibility of finishing this prune. The migration path:
1. Phase 10 rewrites `/inicio/page.tsx` to compose v2 helpers (replacing `filterPayouts` + `summarizePayouts` for the "Latencia destacada" hecho — likely via `summarizePayoutsByState` for tasa de éxito + `aggregateAverageProcessingMinutes` for tiempo promedio); `HechosCurados.tsx` swaps the prop type from `PayoutSummary` to whatever the v2 helper emits.
2. Phase 9 rewrites `/clientes/[empresaId]/page.tsx` mini-cards similarly; `EmpresaMiniCards.tsx` swaps its prop type.
3. After BOTH phases land, the kept-alive symbols become orphans — final prune lands in whichever phase touches `payouts.ts` last (or as a 1-task cleanup plan).

---

**Total deviations:** 1 — partial-prune scope deferral (Rule 4)
**Impact on plan:** Plan 07-04's user-facing scope (v2 Payouts cockpit) shipped exactly as specified — KPI header, conditional aging alert, status semáforo, restyled TopBancos, FailureReasons + ThirdPartyPayouts diagnostic pair. Only the `payouts.ts` cleanup is partially deferred. **No behavior change to Inicio or Clientes pages — they keep building and rendering identically.** No scope creep introduced.

## Issues Encountered

**`PayoutState` import location:** `ThirdPartyPayouts.tsx` initially imported `PayoutState` from `@/lib/domain/payouts` (where the plan implicitly suggested), but `payouts.ts` does NOT re-export `PayoutState` — the type lives in `src/lib/domain/types.ts`. tsc surfaced `TS2459: Module '"@/lib/domain/payouts"' declares 'PayoutState' locally, but it is not exported.` Fixed in the same task by switching to `import type { PayoutState } from "@/lib/domain/types";`. Single-line edit. Recorded for future v2 components rendering payout state badges.

**Apparent file-revert false alarm:** During Task 1 the system reminders showed `format.ts` and `TopBancos.tsx` as if reverted (old content) after my Edits succeeded. Re-reading the files confirmed the changes WERE on disk — the system reminders were stale snapshots, not actual reverts. Lost ~2 minutes re-applying changes that were already in place; resolved by explicit re-reads + `git status` to verify actual disk state. No real revert occurred; file-system state was always correct.

## User Setup Required

None — no external service configuration required. Pure TypeScript + Tailwind additions on existing infrastructure.

## Next Phase Readiness

**Ready for the rest of Phase 7 / downstream phases:**
- v2 Payouts cockpit live at `/payouts`; tsc + lint + build all green
- `joinPayouts()` first production consumer pattern proven — Phase 9 Vista Cliente can adopt the same pipeline shape (run JOIN once at page composition, chain into multiple aggregations)
- `formatMinutes` helper available project-wide for any future MIN-shaped KPI
- Section-payouts (Cyan) + status semáforo (verde/rojo/amarillo) Tailwind utilities in production use — visual contract validated by user during checkpoint approval
- Conditional null-render pattern (AgingAlert) reusable for future alert/queue widgets

**Carry-forward (critical for Phase 9 + Phase 10):**
- 4 v1 payouts symbols (`filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`) kept alive — Phase 10 (Inicio v2) and Phase 9 (Vista Cliente v2) must migrate their consumers to v2 helpers as part of those phases' page rewrites. Final prune lands when both rewrites are complete.

**No blockers introduced.** v2 Payouts page works with live data; v1 callers in Inicio + Clientes unchanged.

---
*Phase: 07-bonos-payouts*
*Completed: 2026-05-07*
