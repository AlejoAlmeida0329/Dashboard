---
phase: 09-vista-cliente
plan: 03
subsystem: ui
tags: [next-app-router, server-components, dossier, presenter-mode, prune, share-url, vista-cliente]

# Dependency graph
requires:
  - phase: 09-vista-cliente
    provides: Plan 09-01 — cliente.ts domain (findClienteSummary, aggregateClienteBenchmark, aggregateClienteP2P, aggregateClienteTimeline + 6 types)
  - phase: 09-vista-cliente
    provides: Plan 09-02 — 7 leaf components (TikintagSelector, ClienteKPIHeader, RetirosBancoTable, BonosClienteCards, P2PCards, ComprasClienteCard, TimelineActivity)
  - phase: 07-bonos
    provides: filterBonosV2 + summarizeBonosV2 (Plan 07-01)
  - phase: 08-tarjeta-recargas
    provides: filterPurchases + summarizePurchases (Plan 08-01)
  - phase: 06-foundation-v2
    provides: joinPayouts + JoinedPayout (Plan 06-02)
  - phase: 06-foundation-v2
    provides: data-presenter-hide + data-presenter-metric-hide CSS gates (Plan 06-04 paleta)
provides:
  - Vista Cliente v2 dossier mounted at /clientes/[empresaId]
  - Cliente-foco share URL retargeted to dossier-itself + presenter mode
  - 22 v1 symbols pruned (bonos.ts: 8, recargas.ts: 10, clientes.ts: 4 orphans)
  - Phase 9 deferred-prune docket CLOSED (modulo payouts.ts v1 surface intentionally preserved for Phase 10)
affects:
  - 10-inicio-v2 (last consumer of payouts.ts v1 surface — filterPayouts/summarizePayouts/PayoutSummary/COMPLETED_PAYOUT_STATES)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — leaf surface from 09-02 already available
  patterns:
    - "Per-tikintag dossier page composition (single JOIN per request threaded into 3 consumers — benchmark + timeline + narrowed table)"
    - "Path-based dossier subject + searchParams as filter scope (URL ?empresa= ignored on this route — path is the picker)"
    - "Two-orchestrator presenter-hide model (page wraps timeline + button in <div data-presenter-hide>; leaf RetirosBancoTable carries data-presenter-metric-hide on failure-reason cells)"
    - "404-style fallback Card when findClienteSummary === null (same in-page pattern as schema-error Card; NOT next.js notFound())"
    - "Cliente-foco share URL = dossier itself + presenter mode (v1 → /inicio?empresa=...&presenter=1; v2 → /clientes/{id}?presenter=1)"
    - "Cohesive multi-module v1 prune (3 modules edited in 1 commit; 22 symbols deleted, v2 surfaces preserved byte-identical)"

key-files:
  created:
    - .planning/phases/09-vista-cliente/09-03-SUMMARY.md
  modified:
    - src/app/(protected)/clientes/[empresaId]/page.tsx
    - src/components/clientes/GenerarVistaClienteButton.tsx
    - src/lib/domain/bonos.ts
    - src/lib/domain/recargas.ts
    - src/lib/domain/clientes.ts
    - .planning/STATE.md
  deleted:
    - src/components/clientes/EmpresaProfileHeader.tsx
    - src/components/clientes/EmpresaMiniCards.tsx
    - src/components/clientes/EmpresaActivityChart.tsx

key-decisions:
  - "Path-based dossier subject — empresaId from URL path is the dossier subject; URL ?empresa= searchParam is irrelevant on this route. Built tikintagFilters = { ...filters, empresa: empresaId } for v2 domain functions that honor filters.empresa."
  - "Single JOIN per request — joinPayouts(allTx, allPayouts) called ONCE; result threaded into aggregateClienteBenchmark + aggregateClienteTimeline + narrowed RetirosBancoTable payouts prop. Plan 06-02 contract enforced."
  - "Cliente-foco share URL retargeted from /inicio to dossier itself — GenerarVistaClienteButton now generates /clientes/{empresaId}?presenter=1 (was /inicio?empresa=...&presenter=1 in v1). Per CONTEXT.md 'el URL persiste la selección para que un share-link te lleve al cliente exacto en el modo correcto'."
  - "TimelineActivity wrapped in <div data-presenter-hide> at the page composition layer (per 09-02 open question — whole-component presenter-hide is page's responsibility, not the leaf's)."
  - "GenerarVistaClienteButton wrapped in <div data-presenter-hide> — once presenter is on, the share-URL flow is irrelevant (the cliente is already viewing it)."
  - "404 fallback Card when findClienteSummary returns null — in-page pattern (NOT next.js notFound()) mirroring the schema-error Card. Includes back link + decoded tikintag display."
  - "v1 prune is cohesive single-commit across 3 modules — bonos.ts (8), recargas.ts (10), clientes.ts (4 orphans) deleted in one refactor commit. Avoids partial-prune intermediate states."
  - "payouts.ts v1 surface intentionally preserved — filterPayouts/summarizePayouts/PayoutSummary/COMPLETED_PAYOUT_STATES still consumed by inicio/page.tsx + HechosCurados; Phase 10 closes that loop."
  - "Layout grid: ClienteKPIHeader (full-width) → RetirosBancoTable (full-width) → grid lg:grid-cols-2 (BonosClienteCards | ComprasClienteCard) → P2PCards (full-width) → TimelineActivity (full-width, presenter-hidden) → GenerarVistaClienteButton (right-aligned, presenter-hidden). Single column on mobile; 2-col only for the bonos/compras pair on lg."
  - "Audit gate before deletions — grep -rE 'EmpresaProfileHeader|EmpresaMiniCards|EmpresaActivityChart' src/ confirmed only the to-be-deleted files contained matches before git rm; same gate run for the 22 v1 symbols (all external refs proved JSDoc-only)."

patterns-established:
  - "Vista Cliente dossier composition pattern — Server Component page (force-dynamic) + Promise.all sheets fetch + try/catch error Card + parseFilters + path-based empresa subject + tikintagFilters helper + single JOIN per request + 7 leaves mounted in mixed-grid layout with two-orchestrator presenter-hide. Reusable for any future per-entity dossier page (operator views, support tools)."
  - "Cohesive multi-module v1 prune pattern — when a page rewrite frees v1 surfaces across multiple domain modules simultaneously, prune all in ONE commit (not one-per-module). Prevents intermediate states where a module is half-pruned. Audit gate (per-symbol grep across src/) MUST precede the deletion; only JSDoc/comment references are acceptable orphans."
  - "Cliente-foco share URL contract for per-entity pages — share-link target = the page itself + ?presenter=1, NOT a redirect to a different page. Aligns share semantics with what the operator was looking at when they clicked Generate. Reusable for any future shareable internal-mode page (e.g. operator views, support dashboards)."

# Metrics
duration: 16min
completed: 2026-05-08
---

# Phase 9 Plan 3: cliente-page Summary

**Vista Cliente v2 dossier composed at /clientes/[empresaId] — 7 leaves mounted with single-JOIN-per-request budget, cliente-foco share URL retargeted to dossier-itself, 22 v1 symbols pruned across bonos/recargas/clientes in one cohesive commit. Phase 9 closeout.**

## Performance

- **Duration:** 16 min (within target for page composition + multi-module prune)
- **Started:** 2026-05-08T04:54:40Z
- **Completed:** 2026-05-08T05:10:48Z
- **Tasks:** 3 / 3 (including the user-approved visual checkpoint)
- **Files modified:** 5 modified + 1 created (SUMMARY) + 3 deleted v1 leaves

## Accomplishments

- **`/clientes/[empresaId]/page.tsx` rewritten** (229 → 289 LOC) as Vista Cliente v2 dossier composition: 7 leaves mounted (TikintagSelector + ClienteKPIHeader + RetirosBancoTable + BonosClienteCards + ComprasClienteCard + P2PCards + TimelineActivity) + GenerarVistaClienteButton; single `joinPayouts(allTx, allPayouts)` call threaded into 3 consumers (benchmark + timeline + narrowed table); 404 fallback Card when `findClienteSummary === null`; layout single-column on mobile, mixed grid on `lg` for the bonos/compras pair only.
- **Cliente-foco share URL retargeted** — `GenerarVistaClienteButton` now generates `/clientes/{empresaId}?presenter=1` (NOT `/inicio?empresa=…&presenter=1` as in v1). Per CONTEXT.md "el URL persiste la selección para que un share-link te lleve al cliente exacto en el modo correcto."
- **3 v1 leaf component files deleted** (orphaned after page rewrite — sole consumer was the v1 page that no longer imports them): `EmpresaProfileHeader.tsx`, `EmpresaMiniCards.tsx`, `EmpresaActivityChart.tsx` (~530 LOC removed).
- **22 v1 domain symbols pruned in one cohesive `refactor` commit** across 3 modules:
  - **`bonos.ts` (-237 LOC)**: 8 symbols deleted (`filterBonos`, `summarizeBonos`, `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas`, `BonoSummary`, `BonoByDate`, `BonoByEmpresa`); v2 surface preserved byte-identical (`BonoSummaryV2`, `BonoByDateV2`, `BonoTikintagRow`, `filterBonosV2`, `summarizeBonosV2`, `aggregateBonosByDateV2`, `aggregateTopEmisores`, `aggregateTopReceptores`).
  - **`recargas.ts` (-326 LOC)**: 10 symbols deleted (`filterRecargas`, `summarizeRecargas`, `aggregateRecargasByDate`, `aggregateRecargasByEmpresa`, `top10RecargasEmpresas`, `findTopEmpresaRecargadora`, `findRecargaMasGrande`, `RecargaSummary`, `RecargaByDate`, `RecargaByEmpresa`); v2 surface preserved (13 v2 exports byte-identical).
  - **`clientes.ts` (-229 LOC)**: 4 orphaned symbols deleted (`findEmpresa`, `EmpresaProfileSummary`, `aggregateMonthlyActivity`, `MonthlyActivity`) plus internal helper `subMonthsLabel` (only consumed by `aggregateMonthlyActivity`) plus unused `formatInTimeZone` import + `BOGOTA_TZ` constant; empresas-INDEX surface preserved (`deriveEmpresasIndex`, `summarizeEmpresasIndex`, `EmpresaListRow`, `EmpresasIndexSummary`, `EmpresaStatus`) — still powers the `/clientes` list page.
- **Phase 9 deferred-prune docket CLOSED** for bonos.ts + recargas.ts + clientes.ts orphans (22 symbols). `payouts.ts` v1 surface (`filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`) intentionally NOT touched — `inicio/page.tsx` + `HechosCurados.tsx` still consume; Phase 10 closes that loop.
- **User-approved visual checkpoint** — dossier renders correctly at `/clientes/[empresaId]`; KPI strip shows 6 KPIs with benchmark accent; tikintag selector switches dossier preserving searchParams; presenter mode hides timeline + GenerarVistaClienteButton + RetirosBancoTable failure-reason column; cliente-foco share URL lands on dossier in presenter mode; 404 fallback works; dark mode preserves Emerald accent; no console errors.

## Task Commits

1. **Task 1: Page rewrite + delete v1 leaves + presenter-hide wiring** — `e8d3d09` (feat) — page rewrite + GenerarVistaClienteButton retarget + 3 v1 leaves removed; +211 / −397 LOC.
2. **Task 2: v1 prune across bonos.ts + recargas.ts + clientes.ts orphans** — `03efba3` (refactor) — 22 v1 symbols deleted in one cohesive commit; +109 / −901 LOC.
3. **Task 3: Visual checkpoint** — user typed "approved" after verifying dossier behavior end-to-end. No commit (checkpoint task is verification-only).

**Plan metadata commit:** [pending — committed after this SUMMARY lands]

## Files Created/Modified

- `src/app/(protected)/clientes/[empresaId]/page.tsx` — REWRITTEN; 229 → 289 LOC; replaces v1 (header + 12-month chart + 3 mini-cards) with v2 dossier composition (selector + 6-KPI cabecera + 5 sections + presenter-hidden timeline + presenter-hidden share button).
- `src/components/clientes/GenerarVistaClienteButton.tsx` — REWRITTEN; share URL target switched from `/inicio?empresa=…&presenter=1` to `/clientes/{empresaId}?presenter=1`; uses URLSearchParams instead of buildUrl (presenter flag forced regardless of incoming searchParams).
- `src/lib/domain/bonos.ts` — TRIMMED; 534 → 297 LOC; v1 surface (8 symbols) deleted; v2 surface preserved byte-identical.
- `src/lib/domain/recargas.ts` — TRIMMED; 895 → 569 LOC; v1 surface (10 symbols) deleted; v2 surface preserved byte-identical.
- `src/lib/domain/clientes.ts` — TRIMMED; 516 → 287 LOC; 4 orphaned symbols deleted (post-EmpresaProfileHeader/EmpresaActivityChart removal); empresas-INDEX surface preserved for /clientes list page; dropped now-unused `formatInTimeZone` + `BOGOTA_TZ` + `subMonthsLabel`.
- `src/components/clientes/EmpresaProfileHeader.tsx` — DELETED (orphaned).
- `src/components/clientes/EmpresaMiniCards.tsx` — DELETED (orphaned).
- `src/components/clientes/EmpresaActivityChart.tsx` — DELETED (orphaned).
- `.planning/phases/09-vista-cliente/09-03-SUMMARY.md` — NEW.
- `.planning/STATE.md` — UPDATED (Phase 9 closeout).

## Decisions Made

### Page composition

- **Path-based dossier subject is canonical; URL `?empresa=` ignored on this route.** The dossier narrows to the path's `empresaId`; any URL `?empresa=` searchParam is irrelevant here (the path IS the picker). Built `tikintagFilters = { ...filters, empresa: empresaId }` to thread to v2 domain functions that honor `filters.empresa` (`filterBonosV2`, `filterPurchases`); date filters from the URL pass through unchanged.
- **Single JOIN per request — `joinPayouts(allTx, allPayouts)` called ONCE.** Result threaded into THREE consumers in this page: `aggregateClienteBenchmark` (CLI-V2-07), `aggregateClienteTimeline` (CLI-V2-08), and `RetirosBancoTable` (narrowed to `joined.filter(p => p.transaction?.empresa_id === empresaId)`). Plan 06-02 contract preserved; Plan 09-01 + 09-02 forward-design contract honored.
- **TimelineActivity wrapped in `<div data-presenter-hide>` at the page layer.** Per 09-02 open question — whole-component presenter-hide is the PAGE's responsibility, not the leaf's. Keeps TimelineActivity reusable for future internal-only contexts where presenter-mode shouldn't apply at all.
- **GenerarVistaClienteButton also wrapped in `<div data-presenter-hide>`.** Once presenter is ON, the share-URL flow is moot (the cliente is already viewing the dossier). Mirrors the v1 wrapper pattern.
- **404 fallback uses in-page Card, NOT `notFound()`.** Same convention as the schema-error Card already established across all v2 pages. The 404 Card includes the back link to `/clientes` and shows the decoded tikintag in `<span className="font-mono">` so the user sees exactly what wasn't found.
- **Layout: single-column stack with one mixed grid.** TikintagSelector (top) → ClienteKPIHeader (full-width) → RetirosBancoTable (full-width) → `lg:grid-cols-2` (BonosClienteCards | ComprasClienteCard) → P2PCards (full-width) → TimelineActivity (full-width, presenter-hidden) → GenerarVistaClienteButton (right-aligned, presenter-hidden). Bonos/compras pair share a row only on `lg+`; everything stacks on mobile.

### Cliente-foco share URL

- **Share URL retargeted from `/inicio` to dossier-itself.** v1 `GenerarVistaClienteButton` redirected to `/inicio?empresa=…&presenter=1` (the cliente landed on Inicio with the empresa-scoped filter applied). v2 redirects to `/clientes/{empresaId}?presenter=1` per CONTEXT.md "el URL persiste la selección para que un share-link te lleve al cliente exacto en el modo correcto." The cliente lands on the SAME view the operator was looking at, in presenter mode.
- **`URLSearchParams` builder over `buildUrl(parseFilters)` round-trip.** v1 used `parseFilters → buildUrl` round-trip to preserve searchParams across the navigation. v2 uses raw `URLSearchParams.set` because the destination URL is a different path that doesn't carry the same filter contract semantics — direct param-by-param copy is cleaner and forces `presenter=1` regardless of incoming `presenter` value.

### v1 prune

- **Cohesive single-commit prune across 3 modules.** All 22 v1 symbols deleted in ONE `refactor(09-03):` commit (not 3 commits, one per module). Avoids intermediate states where one module is pruned and another isn't; preserves the "v1 surfaces freed by Task 1's page rewrite" framing as a single conceptual change.
- **Audit gate before deletion — grep -rE per symbol.** Confirmed every external reference for the 22 symbols was JSDoc/comment-only (cross-module historical notes, e.g. `recargas.ts` JSDoc citing `aggregateBonosByDate`'s convention). No actual code consumers. Same discipline as Plans 07-02 / 07-04 / 08-03 / 08-04 used for deferral decisions; this time the audit greenlit the deletion.
- **`payouts.ts` v1 surface explicitly preserved.** `filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES` still consumed by `inicio/page.tsx` (Latencia destacada hecho) + `HechosCurados.tsx` (prop type). Phase 10 (Inicio v2 rewrite) closes that loop.
- **`clientes.ts` empresas-INDEX surface explicitly preserved.** `deriveEmpresasIndex`, `summarizeEmpresasIndex`, `EmpresaListRow`, `EmpresasIndexSummary`, `EmpresaStatus` still power `/clientes` list page (CLI-01..04). Only the 4 dossier-orphans (`findEmpresa`, `EmpresaProfileSummary`, `aggregateMonthlyActivity`, `MonthlyActivity`) deleted plus their unique helper `subMonthsLabel` plus their unique imports (`formatInTimeZone`, `BOGOTA_TZ`).
- **`BONO_TRANSACTION_TYPES` and `RECHARGE_TIPOS` constants kept** — both still consumed by their respective v2 filter functions (`filterBonosV2` / `filterRecargasV2`).

## Deviations from Plan

### None

The plan's 3-task spec (page rewrite + 22-symbol prune + visual checkpoint) was followed exactly. No bugs encountered during execution; tsc + lint + build clean on every gate. No field-name reconciliation needed (third clean-break plan in a row after 09-01 and 09-02).

### Sub-threshold notes (NOT Rule deviations)

- **`recargas.ts` final LOC (569) slightly above the plan's `350-540` soft target.** The v2 surface is JSDoc-heavy (rationale + examples per function); raw v2 code-only LOC fits the target. Not a rule deviation — codebase JSDoc convention is intentional, established since `clientes.ts` / `cardUsage.ts` precedent.
- **`clientes.ts` final LOC (287) slightly above the plan's `150-250` soft target.** Same reason — module-header JSDoc is extensive (history + filter contract + activity-counting predicate documentation) and `deriveEmpresasIndex` carries a thorough algorithm-description comment block. Pruning the JSDoc would lose context for future readers.
- **`bonos.ts` final LOC (297) — within the plan's `250-330` target.** No notes.
- **Page LOC (289) above the plan's `min_lines: 150` floor.** The page-header JSDoc is substantial (pipeline documentation + cliente-foco share URL contract + error/404 handling rules + JOIN-budget rationale) — the page is the central composition artifact for Phase 9 and warrants the documentation density.
- **Plan's "module-header JSDoc to drop the 'v1 byte-identical / v2 alongside' note" instruction honored** — both `bonos.ts` and `recargas.ts` module-header JSDoc rewritten to declare v2-only surface and explain the post-09-03 prune; the coexistence note is gone.

## Verification

- ✅ Plan 09-01 (`1e1fee7`, `a7742eb`) + Plan 09-02 (`4f60f44`, `03793f7`) + Plan 09-03 (`e8d3d09`, `03efba3`) all in `git log`.
- ✅ `npx tsc --noEmit` clean (0 errors).
- ✅ `npm run lint` clean (0 errors, 3 pre-existing warnings unchanged from Phase 8 baseline: `ClientesTable.tsx:292` aria-sort, `rate-limit.ts:37` unused eslint-disable, `_utils.ts:128` unused eslint-disable).
- ✅ `npm run build` succeeds (still 13 routes — Phase 9 rebuilds /clientes/[empresaId] in place; no new routes).
- ✅ `grep -rE "filterBonos\b|summarizeBonos\b|filterRecargas\b|summarizeRecargas\b|findEmpresa\b|aggregateMonthlyActivity\b" src/` returns only JSDoc / comment / module-header references — zero actual code consumers.
- ✅ User typed "approved" at the visual checkpoint after verifying:
  - 6-KPI cabecera renders with benchmark Emerald accent + delta-sign semáforo subtext
  - TikintagSelector dropdown switches dossier preserving searchParams (date filter survives switching)
  - All 5 sections render (RetirosBancoTable + BonosClienteCards + ComprasClienteCard + P2PCards + TimelineActivity)
  - Modo Presentación (`?presenter=1`): timeline section disappears + GenerarVistaClienteButton hides + RetirosBancoTable failure-reason column collapses + cabecera and other 4 sections remain visible
  - Cliente-foco share URL: button lands on `/clientes/{tikintag}?presenter=1` (not `/inicio`)
  - 404 fallback: `/clientes/$nonexistent` renders "Empresa no encontrada" Card with link back to /clientes
  - Dark mode: Emerald accent on benchmark KPI remains visible
  - No console errors during all interactions
- ✅ All 22 v1 symbols deleted; payouts.ts v1 surface intentionally preserved for Phase 10.

## Net LOC Churn

- **Page rewrite:** `+211 / −397` (net `−186` over v1 page)
- **3 v1 leaf component files deleted:** `−530` LOC (EmpresaProfileHeader, EmpresaMiniCards, EmpresaActivityChart)
- **3 domain modules pruned:** `+109 / −901` (net `−792` LOC across bonos.ts + recargas.ts + clientes.ts)
- **GenerarVistaClienteButton.tsx:** `+23 / −15` (net `+8` LOC — slightly more JSDoc + URLSearchParams idiom)
- **Plan total net:** `~−1500 LOC` removed from the codebase. Vista Cliente v2 dossier composition is LEANER than the v1 surfaces it replaces, despite delivering the richer 6-KPI cabecera + benchmark + 5 sections + presenter-hide system the PRD called for.

## Confirmation: must_haves Contract

| must_have truth | Status | Evidence |
|---|---|---|
| Visiting /clientes/[tikintag] renders v2 dossier (selector + 6-KPI header + retiros + bonos + p2p + compras + timeline) | ✅ | page.tsx mounts all 7 leaves; user-approved visual checkpoint |
| Switching tikintag via selector navigates to /clientes/{newTikintag} preserving searchParams | ✅ | TikintagSelector implements path-based router.push with searchParams.toString() preservation; verified in checkpoint with `?from/&to` filter survival |
| Timeline section is hidden when ?presenter=1 is set; KPI header + retiros + bonos + p2p + compras remain visible | ✅ | `<div data-presenter-hide><TimelineActivity .../></div>` wrapper at page layer; verified in checkpoint |
| Failure Reason column collapses in RetirosBancoTable when presenter=1 | ✅ | RetirosBancoTable th/td cells carry `data-presenter-metric-hide` (Plan 09-02); page mounts the leaf unchanged; verified in checkpoint |
| v1 bonos symbols deleted (8) | ✅ | bonos.ts 534 → 297 LOC; grep confirms 0 code consumers |
| v1 recargas symbols deleted (10) | ✅ | recargas.ts 895 → 569 LOC; grep confirms 0 code consumers |
| Orphaned clientes.ts symbols deleted (4) | ✅ | clientes.ts 516 → 287 LOC; findEmpresa/EmpresaProfileSummary/aggregateMonthlyActivity/MonthlyActivity all gone |
| Build green: tsc + lint + npm run build pass; same 13 routes | ✅ | All three gates clean; 13 routes preserved |
| User-approved visual checkpoint after dossier renders | ✅ | User typed "approved" |

| must_have artifact | Min lines | Actual | Status |
|---|---|---|---|
| src/app/(protected)/clientes/[empresaId]/page.tsx | ≥ 150 | 289 | ✅ |
| src/lib/domain/bonos.ts | ≥ 250 | 297 | ✅ |
| src/lib/domain/recargas.ts | ≥ 250 | 569 | ✅ |
| src/lib/domain/clientes.ts | ≥ 150 | 287 | ✅ |

| key_link | Status |
|---|---|
| page.tsx → joinPayouts (single call, chained into RetirosBancoTable + benchmark + timeline) | ✅ `joinPayouts(allTx, allPayouts)` once on line 169 |
| page.tsx → filterBonosV2 (narrowed to empresa=tikintag) | ✅ `filterBonosV2(allTx, tikintagFilters)` |
| page.tsx → filterPurchases (narrowed to empresa=tikintag) | ✅ `filterPurchases(allTx, tikintagFilters)` |
| page.tsx → TimelineActivity wrapped in data-presenter-hide | ✅ `<div data-presenter-hide><TimelineActivity events={timelineEvents} /></div>` |
| page.tsx → TikintagSelector mounted with options from getEmpresaRegistry | ✅ `<TikintagSelector options={tikintagOptions} current={empresaId} />` where tikintagOptions = `getEmpresaRegistry(allTx)` |

## Open Questions / Carry-Forward to Phase 10

- **payouts.ts v1 surface remains alive — 4 symbols deferred.** `inicio/page.tsx` still consumes `filterPayouts` + `summarizePayouts`; `HechosCurados.tsx` still types its props as `PayoutSummary`. Phase 10 (Inicio v2 rewrite) is the natural close: replace the Latencia destacada hecho with v2 helpers (`summarizePayoutsByState` + `aggregateAverageProcessingMinutes`), restructure `HechosCurados.tsx` props, then delete the 4 v1 symbols + the now-unused `COMPLETED_PAYOUT_STATES` constant. Net effect after Phase 10: `payouts.ts` becomes v2-only.
- **ComprasClienteCard still single-stat (no recent-purchases mini-list).** Plan 09-02 deferred this per YAGNI; Plan 09-03 visual checkpoint did not surface a need for it (the dossier already houses 5 other sections; vertical space is at a premium). Leave as-is. If a future iteration wants the mini-list, add a `purchases?: Transaction[]` prop and render an inline recent-list inside the same card; no new leaf needed.
- **Phase 9 closeout: ALL 8 CLI-V2-* requirements met.**
  - ✅ CLI-V2-01 (TikintagSelector dropdown switching dossier without /clientes round-trip)
  - ✅ CLI-V2-02 (5-KPI cabecera + benchmark = 6 KPIs)
  - ✅ CLI-V2-03 (RetirosBancoTable with presenter-metric-hide on failure-reason)
  - ✅ CLI-V2-04 (BonosClienteCards in/out split + P2PCards sent/received split)
  - ✅ CLI-V2-05 (TimelineActivity chronological feed)
  - ✅ CLI-V2-06 (ComprasClienteCard count + volumen + ticket promedio)
  - ✅ CLI-V2-07 (Tiempo vs benchmark with section accent in cabecera)
  - ✅ CLI-V2-08 (TimelineActivity wrapped in data-presenter-hide; presenter-hide system fully wired)

## Phase 9 Carry-Forward Status

**Closed:**
- ✅ bonos.ts deferred-prune docket (8 symbols deleted)
- ✅ recargas.ts deferred-prune docket (10 symbols deleted)
- ✅ clientes.ts orphans (4 symbols + helpers deleted)
- ✅ 3 v1 leaf component files (EmpresaProfileHeader, EmpresaMiniCards, EmpresaActivityChart)

**Carry-forward to Phase 10:**
- 4 payouts.ts v1 symbols (filterPayouts, summarizePayouts, PayoutSummary, COMPLETED_PAYOUT_STATES) — still consumed by inicio/page.tsx + HechosCurados.tsx; deferred to Phase 10 Inicio v2 rewrite.

**Phase 9 status:** ✅ COMPLETE (3/3 plans landed; user-approved visual checkpoint)
