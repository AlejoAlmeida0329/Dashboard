---
phase: 07-bonos-payouts
verified: 2026-05-07T19:17:03Z
status: passed
human_approved: 2026-05-07 (user approved both Wave 2 visual checkpoints + final verification checklist)
score: 5/5 must-haves verified
human_verification:
  - test: "Browse /bonos with default range; confirm KPICardsV2 shows 5 cards (Bonos recibidos, Bonos enviados, Volumen recibido, Volumen enviado, Ticket promedio) with non-zero numbers when data is present"
    expected: "5 cards render in 1→2→5 col grid, in/out counts and montos differ, ticketPromedio computed across both directions"
    why_human: "Visual layout, responsive grid, and live Sheets data correctness need a browser"
  - test: "Browse /bonos and inspect Top emisores | Top receptores tables side-by-side"
    expected: "lg:grid-cols-2 places them in two columns on desktop; ranks are descending by count (ties by monto); both show real tikintags from sourceTransferTikintag and destinationTransferTikintag respectively"
    why_human: "Cannot verify visual side-by-side layout and real tikintag values without running"
  - test: "Browse /bonos and verify the BonosFlowChart stacked-bar timeline renders enviados (darker violet) over recibidos (lighter violet) per Bogotá day"
    expected: "Recharts BarChart with two Bar series on stackId='bonos'; tooltip shows Recibidos / Enviados counts plus $ recibido / $ enviado in COP"
    why_human: "Recharts hydration only happens in browser; visual stacking and tooltip cannot be inspected via grep"
  - test: "Browse /payouts and inspect PayoutsKPICardsV2 — first scroll shows Tiempo promedio (text-4xl), Tasa de éxito (semáforo color), Total payouts, Volumen retirado, Pagos a terceros"
    expected: "5 cards render; Tasa de éxito accent color matches threshold (≥95% green / ≥85% amber / else red); Tiempo promedio formatted via formatMinutes (e.g. '45 min', '2h 5min')"
    why_human: "Color thresholds and visual hierarchy require a browser; live data drives whether semáforo is green or amber"
  - test: "Browse /payouts; if any in_progress payouts exceed 2h aging, AgingAlert renders red-bordered Card before the StatusBreakdownCards; otherwise it disappears entirely"
    expected: "Conditional rendering — null when no rows; red border-l-4 status-fail with table sorted oldest-first when present"
    why_human: "Depends on live data state; the conditional null-render branch cannot be statically verified"
  - test: "Browse /payouts and verify StatusBreakdownCards shows 3 cards with semáforo dots (verde Completados / rojo Fallidos / amber En curso)"
    expected: "1→3 col grid; each card has a colored dot, the count via formatInteger, and percent del total via formatPercent (or '—' when total is 0)"
    why_human: "Visual semáforo verification requires browser"
  - test: "Browse /payouts and verify TopBancos lists Nequi/Bancolombia/etc by descending volumen with a bar visualization"
    expected: "Card with border-l-4 border-section-payouts; rows sorted desc by montoTotal; 'Otros bancos' rollup at the bottom when there are >5 banks; bar widths proportional to leader"
    why_human: "Visual bar widths and order require a browser"
  - test: "Browse /payouts and verify FailureReasons + ThirdPartyPayouts side-by-side at lg:grid-cols-2"
    expected: "FailureReasons shows top-5 horizontal bars with collapsible 'Ver todas las razones'; ThirdPartyPayouts shows table with Tikintag | Holder | Monto | Banco | Estado columns sorted desc by monto"
    why_human: "Visual side-by-side layout and details element collapse behavior require a browser"
  - test: "Apply filters via URL: /payouts?status=failed&from=2026-04-01&to=2026-04-30 — confirm StatusBreakdownCards shows only failed counts (filterPayoutsV2 honors filters.status)"
    expected: "completed = 0, inProgress = 0, failed > 0; tasa de éxito = 0%; KPI Pagos a terceros may also drop because completed subset becomes empty"
    why_human: "Validates the v2 contract that filterPayoutsV2 narrows by URL status — needs round-trip with real Sheets data"
---

# Phase 7: Bonos & Payouts v2 — Verification Report

**Phase Goal:** Bonos refactorizado con split source/destination (top emisores vs top receptores, flujo enviados vs recibidos); Payouts extendido con tiempo promedio, aging alert, razones de fallo, distribución por banco, pagos a terceros via JOIN.

**Verified:** 2026-05-07T19:17:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | Bonos page splits in/out using source/destination tikintag fields with ticket promedio + volumen visible | ✓ VERIFIED | `bonos/page.tsx:103-104` calls `filterBonosV2` (no `direction` pre-filter; honors `filters.status` per CROSS-V2-01) + `summarizeBonosV2` (counts/montos by direction). `KPICardsV2.tsx` renders 5 cards: Bonos recibidos, Bonos enviados, Volumen recibido, Volumen enviado, Ticket promedio. Schema `schemas.ts:185-186` maps `source_transfer_tikintag`/`destination_transfer_tikintag` Sheet columns to typed fields. |
| 2   | Bonos page shows top emisores + top receptores tables + stacked-bar flujo temporal | ✓ VERIFIED | `bonos/page.tsx:126-127` calls `aggregateTopEmisores(bonos, 10)` + `aggregateTopReceptores(bonos, 10)`. `bonos/page.tsx:134-137` places `TopEmisores` and `TopReceptores` side-by-side in `lg:grid-cols-2`. `BonosFlowChart.tsx:128-139` renders Recharts `<Bar>` with two series (`countOut` + `countIn`) on `stackId="bonos"`. |
| 3   | Payouts page shows 3 KPIs por estado con semáforo + tasa de éxito con semáforo | ✓ VERIFIED | `payouts/page.tsx:156` calls `summarizePayoutsByState(periodOnly)` returning `{completed, failed, inProgress, total, successRate}`. `StatusBreakdownCards.tsx` renders 3 cards with `bg-status-success` / `bg-status-fail` / `bg-status-pending` dots. `PayoutsKPICardsV2.tsx:53-57` `successRateAccent()` applies thresholds: ≥95% green, ≥85% amber, else red. |
| 4   | Payouts page calculates tiempo promedio, aging alert, distribución por banco, razones de fallo, volumen retirado COP | ✓ VERIFIED | `payouts/page.tsx:157-161` runs `aggregateAverageProcessingMinutes(completed)` (parses `Total Time` via `latencySeconds`), `aggregateAgingAlertPending(periodOnly, 120)` (>2h threshold), `aggregateFailureReasons(periodOnly)`, `aggregateTopBancos(completed)`, plus `montoTotalCompleted` reduce. Schema `schemas.ts:407-409` populates `latencySeconds = total_time when > 0 else aging` and `failureReason = parsed["failure reason"]`. Components `AgingAlert.tsx`, `FailureReasons.tsx`, `TopBancos.tsx`, `PayoutsKPICardsV2.tsx` render each. |
| 5   | Payouts page shows pagos a terceros (Holder ≠ tikintag) via JOIN | ✓ VERIFIED | `payouts/page.tsx:166-167` runs `joinPayouts(txResult.rows, completed)` ONCE then `aggregateThirdPartyPayouts(joinedCompleted)`. Helper at `payouts.ts:704-727` strips leading `$` and lowercases both sides before comparison; skips unmatched and empty rows; sorts DESC by monto. KPI count rendered in `PayoutsKPICardsV2.tsx:131-143`; full table in `ThirdPartyPayouts.tsx`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/(protected)/bonos/page.tsx` | v2 page composition | ✓ VERIFIED | 150 lines, server component, imports + uses 5 v2 helpers + 4 v2 components, `dynamic = 'force-dynamic'`, error+empty-state branches present |
| `src/app/(protected)/payouts/page.tsx` | v2 page composition with JOIN | ✓ VERIFIED | 222 lines, server component, parallel `Promise.all` fetch of payouts+transactions, empresa join, single `joinPayouts` call chained into `aggregateThirdPartyPayouts`, error+empty-state branches |
| `src/lib/domain/bonos.ts` | v2 helpers ground page | ✓ VERIFIED | 534 lines, exports `filterBonosV2`, `summarizeBonosV2`, `aggregateBonosByDateV2`, `aggregateTopEmisores`, `aggregateTopReceptores`, `BonoSummaryV2`, `BonoByDateV2`, `BonoTikintagRow`. v1 functions retained (documented carry-forward for /clientes) |
| `src/lib/domain/payouts.ts` | v2 helpers ground page | ✓ VERIFIED | 727 lines, exports `filterPayoutsV2`, `summarizePayoutsByState`, `aggregateAverageProcessingMinutes`, `aggregateAgingAlertPending`, `aggregateFailureReasons`, `aggregateThirdPartyPayouts`, `PayoutStateBreakdown`, `AgingAlertRow`, `FailureReasonRow`, `ThirdPartyPayoutRow`. v1 functions retained (documented carry-forward) |
| `src/components/bonos/KPICardsV2.tsx` | 5 v2 KPI cards | ✓ VERIFIED | 123 lines, renders 5 cards in `1 → 2 → 5` col grid, accents `text-section-bonos`, all formatting via `formatCOP`/`formatInteger` |
| `src/components/bonos/TopEmisores.tsx` | ranking table by sourceTransferTikintag | ✓ VERIFIED | 87 lines, `border-l-4 border-l-section-bonos`, table with #, Tikintag, Bonos, Volumen columns, empty-state row |
| `src/components/bonos/TopReceptores.tsx` | ranking table by destinationTransferTikintag | ✓ VERIFIED | 76 lines, mirror of TopEmisores with same border accent and column structure |
| `src/components/bonos/BonosFlowChart.tsx` | Recharts stacked-bar timeline | ✓ VERIFIED | 144 lines, client component, two `<Bar>` series stacked on `stackId="bonos"`, custom tooltip showing in/out counts + COP, hard-coded OKLCH violet shades for theme stability |
| `src/components/payouts/PayoutsKPICardsV2.tsx` | time-first 5 KPI header | ✓ VERIFIED | 146 lines, renders Tiempo promedio (text-4xl primary), Tasa de éxito (semáforo color), Total payouts, Volumen retirado, Pagos a terceros; threshold logic `successRateAccent()` |
| `src/components/payouts/AgingAlert.tsx` | conditional alert table | ✓ VERIFIED | 95 lines, `if (rows.length === 0) return null` (correct conditional render); red border + `text-status-fail`; sorted oldest-first by aggregator |
| `src/components/payouts/StatusBreakdownCards.tsx` | 3 KPIs por estado con semáforo | ✓ VERIFIED | 99 lines, 3 cards in `md:grid-cols-3`, each with semáforo dot (`bg-status-success`/`bg-status-fail`/`bg-status-pending`), zero-safe percent display ('—' when total = 0) |
| `src/components/payouts/FailureReasons.tsx` | hybrid bars + collapsible details | ✓ VERIFIED | 138 lines, top-5 div-based horizontal bars, `<details>` collapsible full table, positive-tone empty state ('Sin fallos en el período') |
| `src/components/payouts/ThirdPartyPayouts.tsx` | tabla pagos a terceros | ✓ VERIFIED | 130 lines, table with Tikintag, Holder, Monto, Banco, Estado columns; StateBadge component for visual state; empty-state copy |
| `src/components/payouts/TopBancos.tsx` | distribución por banco con barras | ✓ VERIFIED | 141 lines, `border-l-4 border-section-payouts`, rows sorted desc by montoTotal, "Otros bancos" rollup at bottom, bar widths proportional to leader |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `bonos/page.tsx` | `lib/domain/bonos.ts` v2 helpers | direct call | ✓ WIRED | Imports + invokes `filterBonosV2`, `summarizeBonosV2`, `aggregateBonosByDateV2`, `aggregateTopEmisores`, `aggregateTopReceptores` (lines 58-63, 103-127) |
| `bonos/page.tsx` | v2 components | render | ✓ WIRED | Imports + renders `KPICardsV2`, `TopEmisores`, `TopReceptores`, `BonosFlowChart` with explicit `summary={}` / `rows={}` / `data={}` props (lines 52-55, 129-148) |
| `bonos/page.tsx` | `getCachedTransactions()` | server fetch | ✓ WIRED | Line 85, error try/catch path renders inline Card on failure (lines 87-101) |
| `bonos/page.tsx` | `parseFilters(searchParams)` | URL state | ✓ WIRED | Line 81; `filterBonosV2` honors `filters.status` per CROSS-V2-01 (bonos.ts:390-393) |
| `payouts/page.tsx` | `lib/domain/payouts.ts` v2 helpers | direct call | ✓ WIRED | Imports + invokes 6 v2 helpers (lines 76-84, 148-167) |
| `payouts/page.tsx` | `joinPayouts` (lib/domain/join.ts) | composition | ✓ WIRED | Single call at line 166, output threaded into `aggregateThirdPartyPayouts(joinedCompleted)` (line 167) |
| `payouts/page.tsx` | v2 components | render | ✓ WIRED | All 6 components rendered (PayoutsKPICardsV2, AgingAlert, StatusBreakdownCards, TopBancos, FailureReasons, ThirdPartyPayouts) with explicit props (lines 67-73, 197-220) |
| `payouts/page.tsx` | parallel Sheets fetch | `Promise.all([getCachedPayouts(), getCachedTransactions()])` | ✓ WIRED | Line 112-115; React `cache()` dedupes the BD_Plataforma read with DashboardHeader |
| `payouts/page.tsx` | empresa join | inline `Map<transactionId, empresa_id>` | ✓ WIRED | Lines 137-143; falls back to `p.empresa_id ?? lookup` to preserve future direct-mapping in BD_Payouts |
| `Transaction.sourceTransferTikintag` | Sheet column `source_transfer_tikintag` | schema transform | ✓ WIRED | `schemas.ts:44`, `:160`, `:185` map column → field; `bonos.ts:520` selector reads from typed field |
| `Transaction.destinationTransferTikintag` | Sheet column `destination_transfer_tikintag` | schema transform | ✓ WIRED | `schemas.ts:45`, `:161`, `:186` map column → field; `bonos.ts:533` selector reads from typed field |
| `Payout.latencySeconds` | Sheet `Total Time` (fallback `Aging`) | parser | ✓ WIRED | `schemas.ts:407` `total_time when > 0 else aging`; `aggregateAverageProcessingMinutes` filters to completed defensively |
| `Payout.failureReason` | Sheet `failure reason` column | schema transform | ✓ WIRED | `schemas.ts:409` `parsed["failure reason"]`; `aggregateFailureReasons` buckets undefined under "Sin razón" |

### Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| BON-V2-01 Bonos recibidos KPI | ✓ SATISFIED | `KPICardsV2` card 1 + `summarizeBonosV2.countIn`/`montoIn` |
| BON-V2-02 Bonos enviados KPI | ✓ SATISFIED | `KPICardsV2` card 2 + `summarizeBonosV2.countOut`/`montoOut` |
| BON-V2-03 Volumen recibido | ✓ SATISFIED | `KPICardsV2` card 3 |
| BON-V2-04 Volumen enviado | ✓ SATISFIED | `KPICardsV2` card 4 |
| BON-V2-05 Top emisores | ✓ SATISFIED | `aggregateTopEmisores` + `TopEmisores` |
| BON-V2-06 Top receptores | ✓ SATISFIED | `aggregateTopReceptores` + `TopReceptores` |
| BON-V2-07 Flujo temporal stacked | ✓ SATISFIED | `aggregateBonosByDateV2` + `BonosFlowChart` |
| PAY-V2-01 Tasa de éxito con semáforo | ✓ SATISFIED | `summarizePayoutsByState.successRate` + `successRateAccent()` thresholds in `PayoutsKPICardsV2` |
| PAY-V2-02 3 KPIs por estado | ✓ SATISFIED | `StatusBreakdownCards` |
| PAY-V2-03 Tiempo promedio | ✓ SATISFIED | `aggregateAverageProcessingMinutes` + `formatMinutes` |
| PAY-V2-04 Aging alert >2h | ✓ SATISFIED | `aggregateAgingAlertPending(periodOnly, 120)` + `AgingAlert` |
| PAY-V2-05 Distribución por banco (Nequi etc.) | ✓ SATISFIED | `aggregateTopBancos` + `TopBancos` |
| PAY-V2-06 Razones de fallo | ✓ SATISFIED | `aggregateFailureReasons` + `FailureReasons` |
| PAY-V2-07 Volumen retirado COP | ✓ SATISFIED | `montoTotalCompleted` reduce + `PayoutsKPICardsV2` card 4 |
| PAY-V2-08 Pagos a terceros via JOIN | ✓ SATISFIED | `joinPayouts` + `aggregateThirdPartyPayouts` + `ThirdPartyPayouts` table + KPI count |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | — | — | All Phase 7 files free of TODO/FIXME/HACK; "placeholder" matches are JSDoc references describing zero-safe semantics, not actual stubs |

### Build & Lint Verification

- **TypeScript:** `tsc --noEmit` exits clean — no type errors across the project
- **ESLint:** `eslint src/app/(protected)/bonos src/app/(protected)/payouts src/components/bonos src/components/payouts src/lib/domain/bonos.ts src/lib/domain/payouts.ts` exits clean with no warnings or errors
- **Imports:** All v2 helpers used in pages are exported from their domain modules; all v2 components are imported and rendered with explicit props

### Documented Carry-Forwards (Not Gaps)

These v1 elements deliberately remain in `bonos.ts` / `payouts.ts` per phase scope:

- `filterBonos`, `summarizeBonos`, `BonoSummary`, `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas`, `BonoByDate`, `BonoByEmpresa` — consumed by `clientes/[empresaId]/page.tsx` and `EmpresaMiniCards.tsx`. Prune lands in Phase 9 (Vista Cliente rebuild).
- `filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES` — consumed by `/inicio`, `/clientes`, `HechosCurados`, `EmpresaMiniCards`. Prune lands in Phases 9 (Clientes) and 10 (Inicio).

The Phase 7 contract (rebuilt /bonos and /payouts pages plus their v2 domain helpers) is fully satisfied; v1 retention is intentional cross-page bridging during incremental v2.0 migration.

### Human Verification Required

The 9 items in the frontmatter `human_verification` array cover:

1. **Visual layout** — responsive grids (1→2→5 cards, lg:grid-cols-2 splits, side-by-side rankings)
2. **Color semáforo** — successRate threshold accents and status dot colors against live data
3. **Recharts hydration** — stacked-bar tooltip rendering and ResponsiveContainer behavior
4. **Conditional rendering** — AgingAlert null-render branch depends on live data state
5. **URL filter round-trip** — `?status=failed` should narrow `summarizePayoutsByState` output

### Gaps Summary

No gaps detected. All 5 must-haves verified at all three levels (existence, substantive implementation, wiring). All 15 requirements (BON-V2-01..07 + PAY-V2-01..08) trace to concrete domain helpers and rendered components. Build passes typecheck and lint clean. Phase 7 goal achievement is structurally complete; only browser-based human verification remains for visual + live-data confirmation.

---

_Verified: 2026-05-07T19:17:03Z_
_Verifier: Claude (gsd-verifier)_
