---
phase: 10-inicio-infra
verified: 2026-05-08T00:00:00Z
status: passed
score: 7/7 must-haves verified (6 functional INI-V2-01..06 ✅ + INFRA-04 ⏸ deferred-by-decision)
must_haves:
  truths:
    - "INI-V2-01: /inicio shows DISTINCT-tikintag usuarios activos with section accent (Indigo)"
    - "INI-V2-02: /inicio shows volumen IN/OUT split + tasa de éxito with semáforo (verde/amber/rojo)"
    - "INI-V2-03: tasa éxito KPI displays with PRD baseline-aware semáforo color helper"
    - "INI-V2-04: /inicio renders donut top 6 transaction types + Otros rollup with Spanish labels"
    - "INI-V2-05: /inicio renders activity timeline (day/week granularity selectable via 60-day URL window threshold)"
    - "INI-V2-06: /inicio renders top 10 users by volumenNeto, grouped by tikintag (NOT empresa)"
    - "INFRA-04: deferred-by-decision (user 'lo del dominio lo hago despues' — documented carry-forward)"
  artifacts:
    - path: "src/lib/domain/inicio.ts"
      provides: "v2 operative-lens domain surface (10 exports — 6 functions + 4 interfaces)"
      verified: true
    - path: "src/app/(protected)/inicio/page.tsx"
      provides: "Inicio v2 cockpit composition wiring all 6 v2 fns + 4 leaves"
      verified: true
    - path: "src/components/inicio/InicioKPIStripV2.tsx"
      provides: "3-card KPI strip with Indigo accent + semáforo"
      verified: true
    - path: "src/components/inicio/TransactionTypeDonut.tsx"
      provides: "Top 6 + Otros donut with Spanish labels"
      verified: true
    - path: "src/components/inicio/ActivityTimelineV2.tsx"
      provides: "Distinct-tikintag-per-bucket dual-axis timeline"
      verified: true
    - path: "src/components/inicio/TopUsersByVolume.tsx"
      provides: "Top-10 users by volumenNeto, grouped by tikintag"
      verified: true
deferred:
  - requirement: "INFRA-04"
    decision: "defer (second deferral; carry-forward to next milestone)"
    user_rationale: "lo del dominio lo hago despues"
    documented_in:
      - ".planning/REQUIREMENTS.md (INFRA-04 row + traceability table)"
      - ".planning/ROADMAP.md (Phase 10 row + success criterion #4 struck-through)"
      - ".planning/STATE.md (Decisions + Blockers entries refreshed)"
      - ".planning/phases/10-inicio-infra/10-03-SUMMARY.md (verbatim user reasoning)"
    reversibility: "3 original paths preserved (subdomain / apex / defer); Vercel CLI v52.0.0 reachable verified"
---

# Phase 10: Inicio + Infrastructure Verification Report

**Phase Goal:** Home page (Inicio) reescrita como agregado de las secciones bajo lente operativa (usuarios activos, volumen IN/OUT, tasa de éxito, tipos de transacción, actividad temporal, top 10 usuarios). Resolver INFRA-04 carry-forward de v1.0 con dominio propio configurado.

**Verified:** 2026-05-08
**Status:** passed (Inicio v2 functional surface fully verified ✅ + INFRA-04 explicitly deferred-by-decision ⏸)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | INI-V2-01: usuarios activos as DISTINCT tikintag count with Indigo section accent | ✓ VERIFIED | `summarizeInicioV2.usuariosActivos` (inicio.ts:104+250) → InicioKPIStripV2 card #1 with `text-section-inicio` className (line 74) — exactly 1 JSX className occurrence (one-section-accent rule held strict) |
| 2 | INI-V2-02: volumen IN vs OUT split + tasa éxito semáforo | ✓ VERIFIED | `volumenIn` / `volumenOut` / `successRate` on InicioSummaryV2 (inicio.ts:104) → InicioKPIStripV2 cards #2 (stacked Entradas/Salidas via formatCOP) + #3 (`successRateAccent` helper at line 61: ≥95 verde, ≥85 amber, else rojo per CROSS-V2-05) |
| 3 | INI-V2-03: tasa éxito with PRD baseline-aware semáforo (98.1% / 1.6% / 0.2%) | ✓ VERIFIED | `successRateAccent(rate)` ternary (InicioKPIStripV2:61-65) returns `text-status-success`/`text-status-pending`/`text-status-fail` against PRD baseline thresholds; subtitle line shows breakdown counts |
| 4 | INI-V2-04: donut top 6 tipos + Otros rollup, max 7 segments | ✓ VERIFIED | `aggregateTransactionTypeDistribution(rows, 6)` (inicio.ts:335) → TransactionTypeDonut Recharts PieChart with 7 OKLCH-pinned fills (Indigo hue rotation 250→230→200→175→150→90 + reserved muted-Indigo for Otros at line 66); Spanish-localized `TIPO_LABEL_ES` map covers all enum values |
| 5 | INI-V2-05: actividad temporal with day/week granularity | ✓ VERIFIED | Page picks `aggregateActivityByDateV2` vs `aggregateActivityByWeekV2` based on 60-day threshold (page.tsx:152-159, `differenceInCalendarDays` from date-fns); ActivityTimelineV2 dual-axis LineChart (usuariosActivos solid Indigo + volumen dashed muted-Indigo on right axis) |
| 6 | INI-V2-06: top 10 users grouped by tikintag (NOT empresa) | ✓ VERIFIED | `aggregateTopUsersByVolume(rows, 10)` (inicio.ts:579) groups by tikintag; TopUserVolumeRow has `tikintag` as primary key + `empresa` as denormalized label; TopUsersByVolume table renders 7-col with negative Neto wrapped in `text-status-fail` |
| 7 | INFRA-04: dominio propio configurado | ⏸ DEFERRED | User decision (Plan 10-03 Task 1 checkpoint): "lo del dominio lo hago despues" — second deferral of carry-forward chain (Plan 05-05 → Plan 10-03 → next milestone); documented in REQUIREMENTS.md + ROADMAP.md (success criterion #4 struck through) + STATE.md + 10-03-SUMMARY.md |

**Score:** 6/6 functional truths VERIFIED ✅ + 1/1 deferred-by-decision ⏸ documented = phase achieves goal as ⚠️ Partial **by design**.

### Required Artifacts

| Artifact | Expected | Exists | Substantive | Wired | Status |
|---|---|---|---|---|---|
| `src/lib/domain/inicio.ts` | v2-only surface (10 exports) | ✓ (617 LOC) | ✓ (v1 block deleted; only JSDoc historical refs survive) | ✓ (imported by page.tsx + 4 leaves) | ✓ VERIFIED |
| `src/app/(protected)/inicio/page.tsx` | v2 cockpit composition | ✓ (222 LOC) | ✓ (imports all 6 v2 fns; calls each with filterInicioV2 result) | ✓ (page route active in build) | ✓ VERIFIED |
| `src/components/inicio/InicioKPIStripV2.tsx` | 3-card KPI strip | ✓ (127 LOC) | ✓ (3 Card grid + successRateAccent helper) | ✓ (imported + used in page.tsx:180) | ✓ VERIFIED |
| `src/components/inicio/TransactionTypeDonut.tsx` | Donut top 6 + Otros | ✓ (169 LOC, Client) | ✓ (Recharts PieChart + 7 OKLCH fills + Spanish labels) | ✓ (imported + used in page.tsx:189) | ✓ VERIFIED |
| `src/components/inicio/ActivityTimelineV2.tsx` | Dual-axis timeline | ✓ (192 LOC, Client) | ✓ (Recharts LineChart + 2 series + dual YAxis) | ✓ (imported + used in page.tsx:203) | ✓ VERIFIED |
| `src/components/inicio/TopUsersByVolume.tsx` | Top-10 users table | ✓ (122 LOC) | ✓ (raw `<table>` 7 cols + tikintag-keyed) | ✓ (imported + used in page.tsx:217) | ✓ VERIFIED |

### v1 Surface Deletion Verification (Plan 10-02 Task 3 Cohesive Prune)

| Deleted Artifact | Status | Evidence |
|---|---|---|
| `src/components/inicio/HechosCurados.tsx` | ✓ DELETED | `ls` returns ENOENT |
| `src/components/inicio/KPICardsInicio.tsx` | ✓ DELETED | `ls` returns ENOENT |
| `src/components/inicio/GMVTrendChart.tsx` | ✓ DELETED | `ls` returns ENOENT |
| `src/components/inicio/EmpresasActivasChart.tsx` | ✓ DELETED | `ls` returns ENOENT |
| `src/components/inicio/DeltaBadge.tsx` | ✓ DELETED | `ls` returns ENOENT |
| `src/lib/domain/inicio-hechos.ts` | ✓ DELETED | `ls` returns ENOENT |
| `inicio.ts` v1 block (filterCompletedIn, summarizeInicio, aggregateGMV*, aggregateActiveEmpresas*, 4 v1 types) | ✓ DELETED | `grep -nE "^export"` shows ONLY v2 exports (10 total) |
| `payouts.ts` v1 surface (filterPayouts, summarizePayouts, PayoutSummary, COMPLETED_PAYOUT_STATES) | ✓ DELETED | `grep -nE "^(export )?(function filterPayouts\\(|function summarizePayouts\\(|interface PayoutSummary|const COMPLETED_PAYOUT_STATES)"` returns 0 matches; closes Phase 7-04 deferred-prune docket |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `inicio/page.tsx` | `filterInicioV2` + 4 v2 aggregations + `summarizeInicioV2` | `import from @/lib/domain/inicio` (no v1 import survives) | ✓ WIRED | page.tsx:98-105 imports 6 v2 functions; lines 148, 161-167 call them in pipeline |
| `InicioKPIStripV2` | `InicioSummaryV2` | `props.summary` | ✓ WIRED | Component imports type (line 48), props receive summary (line 52), renders all 6 fields (usuariosActivos, volumenIn, volumenOut, successRate, countCompleted/Failed/InProgress, total) |
| `TransactionTypeDonut` | `TransactionTypeBucket[]` | `props.buckets` | ✓ WIRED | Component imports type (line 55), maps buckets to PieChart Cells with localized labels |
| `ActivityTimelineV2` | `ActivityPointV2[]` | `props.data` + `props.granularity` | ✓ WIRED | Component imports type (line 54), renders dual-axis LineChart consuming `usuariosActivos` + `volumen` dataKeys |
| `TopUsersByVolume` | `TopUserVolumeRow[]` | `props.rows` | ✓ WIRED | Component imports type (line 44), renders 7-col table with negative-Neto highlighting |
| `inicio.ts` post-prune | v2-only surface | v1 block removed in `46346d2` cohesive refactor commit | ✓ VERIFIED | Only JSDoc historical refs survive (line 24-25 of inicio.ts; lines 25-26 of payouts.ts) |

### Requirements Coverage

| Requirement | Status | Notes |
|---|---|---|
| INI-V2-01 (usuarios activos DISTINCT tikintag) | ✓ SATISFIED | summarizeInicioV2 + InicioKPIStripV2 card #1 |
| INI-V2-02 (volumen IN/OUT split) | ✓ SATISFIED | summarizeInicioV2 + InicioKPIStripV2 card #2 |
| INI-V2-03 (tasa éxito semáforo) | ✓ SATISFIED | summarizeInicioV2.successRate + successRateAccent helper |
| INI-V2-04 (donut top 6 + Otros) | ✓ SATISFIED | aggregateTransactionTypeDistribution + TransactionTypeDonut |
| INI-V2-05 (actividad temporal day/week) | ✓ SATISFIED | aggregateActivityByDateV2/ByWeekV2 + 60-day threshold + ActivityTimelineV2 |
| INI-V2-06 (top 10 users by tikintag) | ✓ SATISFIED | aggregateTopUsersByVolume + TopUsersByVolume |
| INFRA-04 (dominio propio configurado) | ⏸ DEFERRED-BY-DECISION | User chose `defer` at Plan 10-03 Task 1 checkpoint; carry-forward to next milestone with reversibility playbook |

### Anti-Patterns Found

None. Audit:
- No TODO/FIXME/HACK in any of the 4 v2 leaves or page.tsx
- No placeholder content (no `Coming soon`, no `lorem ipsum`)
- No empty handlers (no `() => {}` in v2 surface)
- No stubbed functions returning empty (all v2 fns have real algorithm bodies; tsc clean)
- All v2 leaves render real data from props or render explicit empty-state messages (sparse-input branches in TransactionTypeDonut:125 and ActivityTimelineV2:125 + TopUsersByVolume:52)

### Build / Lint / Tsc Verification

- `npx tsc --noEmit` → exit 0 (zero TypeScript errors)
- `npm run lint` → exit 0 (3 pre-existing baseline warnings unchanged: ClientesTable.tsx:292, rate-limit.ts:37, _utils.ts:128 — all unrelated to Phase 10)
- `grep -rE "text-section-inicio" src/components/inicio/InicioKPIStripV2.tsx` → 1 actual JSX className occurrence (line 74); other 3 matches are JSDoc comments documenting the rule
- `grep -lE '"use client"' src/components/inicio/*.tsx` → ONLY TransactionTypeDonut + ActivityTimelineV2 carry the directive (Recharts hydration); KPIStrip + TopUsers stay Server Components

### v1 Surface Survivor Audit

`grep -rnE "filterCompletedIn|summarizeInicio[^V]|aggregateGMV...|filterPayouts[^V]|summarizePayouts[^B]|PayoutSummary[^V]|COMPLETED_PAYOUT_STATES" src/` returns 9 matches across 4 files — ALL JSDoc/comment historical references documenting the v1→v2 migration. ZERO imports, ZERO function-call references, ZERO algorithm references survived. Plan 10-02 Task 3 verify clause "ONLY documentation/JSDoc references (zero import or component-use survivors)" satisfied.

### Human Verification Required

None — all functional truths verified programmatically against the codebase. The visual checkpoint at the end of Plan 10-02 was already approved by the user (per 10-02-SUMMARY.md "User typed 'approved' at visual checkpoint after verifying: 3-card KPI strip with Indigo accent + semáforo; donut renders top 6 + Otros with Spanish tooltip labels; activity timeline dual-axis; top 10 users table grouped by tikintag with text-status-fail on negative Neto; URL filters; dark mode preserves Indigo accent + OKLCH chart fills; other tabs build/render fine").

### INFRA-04 Deferral Classification

INFRA-04 is **NOT** a gap. Per the verification context provided:

> "Plan 10-03 was DEFERRED per user decision ('lo del dominio lo hago despues'). INFRA-04 is explicitly carry-forward to next milestone — this is documented in 10-03-SUMMARY.md, REQUIREMENTS.md, and STATE.md. Therefore success criterion #4 is EXPECTED to be deferred/incomplete, NOT a gap. The phase outcome is ⚠️ Partial by design."

Deferral verified across 4 documents:

1. **REQUIREMENTS.md** — INFRA-04 row updated 2026-05-08 with deferral note + carry-forward chain (Plan 05-05 → Plan 10-03 → next milestone)
2. **ROADMAP.md** — Phase 10 row at "🚧 In progress (INFRA-04 deferred 2026-05-08 — see Plan 10-03 SUMMARY)"; success criterion #4 struck through with deferral note ("DEFERIDO 2026-05-08 en Plan 10-03"); footer "Last updated: 2026-05-08 — Plan 10-03 INFRA-04 deferral decision logged"
3. **STATE.md** — Decisions section has explicit entry "INFRA-04 deferral renovada — second deferral, milestone v2.0 scoped to ship sin custom domain" with verbatim user rationale; Blockers entries refreshed; Current focus reflects 3/3 plans landed (10-03 deferral closeout = ⏸); Reversibility note: 3 paths still on table (subdomain / apex / defer); Vercel CLI v52.0.0 reachability verified
4. **10-03-SUMMARY.md** — Full deferral playbook: verbatim user reasoning ("lo del dominio lo hago despues"), tasks 2-4 SKIPPED per defer branch, carry-forward chain notation, when-to-revisit triggers, what-changes-if-revisited paths, no source-tree changes (planning-artifacts only)

The deferral is **reversible** (3 original paths preserved) and the v2.0 milestone is **declarable as ⚠️ Partial** with explicit deferred debt documented.

### Gaps Summary

**No gaps blocking goal achievement.** Phase 10 delivers Inicio v2 operative-lens cockpit end-to-end (6 INI-V2 requirements verified in code) + closes the v2.0 milestone's last v1 prune debt (Phase 7-04 deferred-prune docket: 4 v1 payouts symbols + 10 v1 inicio symbols + 5 v1 leaves + inicio-hechos.ts module deleted in cohesive refactor `46346d2`). INFRA-04 is the sole pending item, and it is explicitly **deferred-by-decision** with full documentation and reversibility — this matches the phase's intended ⚠️ Partial outcome.

### Notable Findings

- **One-section-accent-per-page rule held strict:** Exactly 1 JSX `text-section-inicio` className across `src/components/inicio/` (other 3 matches in InicioKPIStripV2 are JSDoc comments documenting the rule itself).
- **Cohesive multi-module v1 prune** in single commit `46346d2`: 16 symbols + 6 file deletions across `src/components/inicio/` + `src/lib/domain/inicio.ts` + `src/lib/domain/payouts.ts` + `src/lib/domain/inicio-hechos.ts`. Algorithm bodies of v2 surface preserved byte-identical (only JSDoc cross-references to deleted v1 symbols rewritten).
- **Net LOC delta:** −701 LOC removed despite delivering richer 6-requirement v2 cockpit (INI-V2-01..06).
- **/inicio no longer fetches payouts** — v2 success rate is over `transactions.status` (not payout state per `summarizeInicioV2`); one less Sheets API roundtrip per request.
- **Phase 7-04 + Phase 9 deferred-prune dockets BOTH fully closed** — final v2.0 tally: 47+ v1 symbols + 8 v1 leaves + 1 v1 module pruned across Phases 7-02 / 7-04 / 9-03 / 10-02.

---

*Verified: 2026-05-08*
*Verifier: Claude (gsd-verifier)*
*Phase 10 outcome: ⚠️ Partial by design — Inicio v2 functional ✅ + INFRA-04 ⏸ deferred-by-decision*
