---
phase: 09-vista-cliente
verified: 2026-05-08T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (automated)
human_verification:
  - test: "Selector tikintag dropdown visual + interactive switch"
    expected: "Native <select> with 235 entries; selecting a different tikintag navigates to /clientes/{newId} preserving date filters and presenter param; current value shows the active tikintag"
    why_human: "Browser-rendered <select> options + router.push side effect + URL state preservation cannot be verified by grep"
  - test: "5 KPIs cabecera visible at-a-glance + 6th benchmark KPI shows section accent"
    expected: "Card renders Balance · Primera tx · Última actividad · Total tx · Pocket activo + Tiempo vs benchmark with Emerald (text-section-clientes) accent + border-l-4 stripe; semáforo color (green/red/muted) matches deltaMinutes sign"
    why_human: "OKLCH color rendering, layout grid responsiveness (2/3/6 cols), and visual hierarchy require human inspection"
  - test: "Presenter mode hides timeline + GenerarVistaClienteButton when ?presenter=1"
    expected: "URL with ?presenter=1 sets data-presenter='on' on <body>; CSS rule [data-presenter='on'] [data-presenter-hide] { display: none } collapses TimelineActivity card and the share-button div"
    why_human: "Runtime CSS visibility under presenter=1 query param requires browser execution"
  - test: "Presenter mode collapses RetirosBancoTable failure-reason column"
    expected: "<th> 'Razón de fallo' and corresponding <td> cells disappear when ?presenter=1 active; other columns remain"
    why_human: "Per-cell CSS application via data-presenter-metric-hide attribute requires runtime DOM"
  - test: "GenerarVistaClienteButton navigates to /clientes/{empresaId}?presenter=1"
    expected: "Click triggers router.push to dossier path with presenter=1 forced; existing filters preserved (e.g. from/to dates)"
    why_human: "Client-side navigation + URLSearchParams manipulation needs browser context"
  - test: "Empty-state fallback when tikintag has zero activity"
    expected: "Visiting /clientes/{nonexistent} renders 'Empresa no encontrada' Card with link back to /clientes (NOT a Next.js notFound)"
    why_human: "Requires hitting the route with an unknown empresaId at runtime"
---

# Phase 9: Vista Cliente Verification Report

**Phase Goal:** Vista Cliente refactorizada con selector tikintag (235 usuarios), 5 KPIs cabecera, retiros banco enriquecidos via JOIN, P2P enviadas/recibidas, compras tarjeta personales, tiempo promedio cliente vs benchmark plataforma, y timeline cronológico. Dual-purpose declarado: 🔍 Uso Interno (todo visible) vs 🤝 Reuniones con Clientes (`presenter=1` oculta timeline crudo).

**Verified:** 2026-05-08
**Status:** human_needed (all automated checks pass; runtime visual + interactive behaviors require human verification)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                          | Status              | Evidence                                                                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Selector tikintag (dropdown 235 usuarios) funciona como filtro principal, persiste via URL                                                     | ✓ VERIFIED          | TikintagSelector.tsx:44-79 — uses router.push to `/clientes/{newId}` with preserved searchParams; tikintagOptions sourced from `getEmpresaRegistry(allTx)` (page.tsx:256); options threaded as `<select>` with current/onChange wiring. |
| 2   | Tarjeta resumen 5 KPIs cabecera (+ 6th benchmark) visible en presenter                                                                         | ✓ VERIFIED          | ClienteKPIHeader.tsx:107-176 renders 6 Stat blocks: Balance, Primera tx, Última actividad, Total tx, Pocket activo, Tiempo vs benchmark. NO `data-presenter-*` attributes (line scan confirms) → all visible in presenter mode.         |
| 3   | Retiros banco enriquecidos via JOIN con BD_Payouts en tabla detallada (Holder, Bank, Aging, Status, Failure Reason); visible en presenter      | ✓ VERIFIED          | RetirosBancoTable.tsx:120-188 renders 7 columns (Fecha · Holder · Banco · Monto · Tiempo · Estado · Razón de fallo). Page.tsx:223-231 runs `joinPayouts` ONCE then narrows via `transaction?.empresa_id === empresaId` filter.           |
| 4   | P2P enviadas/recibidas, bonos in/out, compras tarjeta del usuario rendereados en cards/tablas, todos visibles en presenter                     | ✓ VERIFIED          | BonosClienteCards.tsx, P2PCards.tsx (cards + 50-row table), ComprasClienteCard.tsx — all confirmed in page.tsx:273-278; none carry `data-presenter-*` attrs.                                                                            |
| 5   | Tiempo promedio cliente vs benchmark plataforma calculado y mostrado en KPI comparativo                                                        | ✓ VERIFIED          | `aggregateClienteBenchmark` (cliente.ts:301-338) computes `clienteMinutes − platformMinutes` over completed JoinedPayouts; ClienteKPIHeader.tsx:80-96, 154-175 renders semáforo + section accent + sample-size transparency footer.     |
| 6   | Timeline cronológico de toda actividad `presenter-hide` cuando `?presenter=1` activo                                                           | ✓ VERIFIED          | page.tsx:280-282 wraps `<TimelineActivity events={timelineEvents} />` in `<div data-presenter-hide>`; globals.css:182 + :242 contain CSS rules `[data-presenter="on"] [data-presenter-hide] { display: none }`.                         |

**Score:** 6/6 truths verified (automated checks)

### Required Artifacts

| Artifact                                                            | Expected                                                                       | Status                | Details                                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/domain/cliente.ts`                                         | 4 functions + 6 types: findClienteSummary, aggregateClienteBenchmark, aggregateClienteP2P, aggregateClienteTimeline | ✓ VERIFIED (678 LOC)  | All 4 exported functions confirmed (cliente.ts:191, 301, 420, 623). Types: ClienteSummary, ClienteBenchmark, ClienteP2P, ClienteP2PRow, ClienteTimelineEvent, ClienteTimelineEventType — 6 types confirmed. |
| `src/components/clientes/TikintagSelector.tsx`                      | Native `<select>` with router.push + URL state preservation                    | ✓ VERIFIED (79 LOC)   | Imports useRouter + useSearchParams; `onChange` handler builds `/clientes/${encodeURIComponent(next)}` + preserved qs.                                  |
| `src/components/clientes/ClienteKPIHeader.tsx`                      | 6-KPI grid (5 base + benchmark) with section accent on benchmark               | ✓ VERIFIED (235 LOC)  | Stat helper renders all 6 KPIs; benchmark KPI uses `text-section-clientes` + `border-l-4` stripe + sample-size footer.                                  |
| `src/components/clientes/RetirosBancoTable.tsx`                     | 7-column table with `data-presenter-metric-hide` on failure-reason cells       | ✓ VERIFIED (192 LOC)  | `<th data-presenter-metric-hide>` (line 135) + `<td data-presenter-metric-hide>` (line 178); status badge palette confirmed.                            |
| `src/components/clientes/BonosClienteCards.tsx`                     | 2 cards: Bonos recibidos / enviados                                            | ✓ VERIFIED (97 LOC)   | Consumes BonoSummaryV2; per-direction ticket promedio derived locally.                                                                                  |
| `src/components/clientes/P2PCards.tsx`                              | Cards (Recibidas/Enviadas) + table (50 rows max) with status badges            | ✓ VERIFIED (207 LOC)  | Cards header + Últimas P2P table; statusBadge palette mirrors RetirosBancoTable.                                                                        |
| `src/components/clientes/ComprasClienteCard.tsx`                    | Single card: count + volumen + ticket promedio                                 | ✓ VERIFIED (96 LOC)   | Consumes PurchaseSummary from cardUsage.ts.                                                                                                             |
| `src/components/clientes/TimelineActivity.tsx`                      | Chronological feed with icon-by-type, no `data-presenter-hide` (page wraps)    | ✓ VERIFIED (270 LOC)  | iconAndColor switch, typeLabel switch, statusBadge — Lucide icons mapped; comment confirms wrapping is page's responsibility.                            |
| `src/components/clientes/GenerarVistaClienteButton.tsx`             | Navigates to `/clientes/{empresaId}?presenter=1` (NOT v1 `/inicio`)            | ✓ VERIFIED (58 LOC)   | Path builder: `/clientes/${encodeURIComponent(empresaId)}` + forced `presenter=1`; v1→v2 contract change documented in JSDoc.                            |
| `src/app/(protected)/clientes/[empresaId]/page.tsx`                 | Composes 8 leaves; runs `joinPayouts` ONCE; wraps timeline + button in presenter-hide | ✓ VERIFIED (289 LOC)  | Single `joinPayouts` call (line 223); 5b comment ratifies one-call discipline. `<div data-presenter-hide>` wraps TimelineActivity (line 280) and GenerarVistaClienteButton (line 284). |

### Key Link Verification

| From                                                | To                                                            | Via                                                | Status     | Details                                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `[empresaId]/page.tsx`                              | `cliente.ts` domain functions                                 | named imports `findClienteSummary`, `aggregateClienteBenchmark`, `aggregateClienteP2P`, `aggregateClienteTimeline` | ✓ WIRED    | page.tsx:118-123 imports all 4 functions; lines 191, 225, 238, 245 invoke each.                                  |
| `[empresaId]/page.tsx`                              | 8 leaf components in `src/components/clientes/`               | named imports                                      | ✓ WIRED    | Lines 106-113 import all 8 leaves; lines 267-285 render each with appropriate props.                              |
| `cliente.ts`                                        | `JoinedPayout` type                                           | `import type { JoinedPayout } from "./join"`       | ✓ WIRED    | cliente.ts:61. `aggregateClienteBenchmark` and `aggregateClienteTimeline` consume `JoinedPayout[]`.              |
| `[empresaId]/page.tsx`                              | `joinPayouts` (single per-request call)                       | named import + line 223 invocation                 | ✓ WIRED    | Threaded into 3 consumers: benchmark (225), clientPayouts filter (229), timeline events (245).                   |
| `RetirosBancoTable.tsx`                             | Presenter metric-hide CSS                                     | `data-presenter-metric-hide` attr on `<th>` + `<td>` | ✓ WIRED    | Attrs at lines 135, 178; CSS rule at globals.css:242.                                                            |
| `<TimelineActivity>` wrapper                        | Presenter-hide CSS                                            | `data-presenter-hide` attr on parent `<div>`       | ✓ WIRED    | page.tsx:280 wraps; globals.css:182 hides under `[data-presenter="on"]`.                                         |
| `GenerarVistaClienteButton` click                   | `/clientes/{empresaId}?presenter=1`                           | router.push with URLSearchParams                   | ✓ WIRED    | Lines 41-51: forces `presenter=1`, encodes empresaId, preserves other params.                                    |
| `TikintagSelector` change                           | `/clientes/{newId}` + preserved query                         | router.push                                        | ✓ WIRED    | Lines 48-54: encodes newId, appends `searchParams.toString()` if present.                                        |

### Requirements Coverage

| Requirement | Status      | Evidence                                                                                                                       |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| CLI-V2-01   | ✓ SATISFIED | TikintagSelector + getEmpresaRegistry — section-level dropdown switching dossier without /clientes round-trip.                 |
| CLI-V2-02   | ✓ SATISFIED | findClienteSummary returns 5 KPIs (balance, primeraTx, ultimaActividad, totalTx, pocketActivo) → ClienteKPIHeader renders.    |
| CLI-V2-03   | ✓ SATISFIED | RetirosBancoTable consumes JoinedPayout[] (post-JOIN) with all 7 columns including failure-reason (presenter-metric-hidden).   |
| CLI-V2-04   | ✓ SATISFIED | P2PCards (cards + 50-row table) + BonosClienteCards (in/out) — both narrowed to tikintag.                                      |
| CLI-V2-05   | ✓ SATISFIED | aggregateClienteTimeline merges Transactions + JoinedPayouts; TimelineActivity renders icon-by-type list, capped at 200.      |
| CLI-V2-06   | ✓ SATISFIED | ComprasClienteCard via filterPurchases + summarizePurchases narrowed by tikintagFilters.                                       |
| CLI-V2-07   | ✓ SATISFIED | aggregateClienteBenchmark computes deltaMinutes; ClienteKPIHeader renders 6th KPI with semáforo + section accent.              |
| CLI-V2-08   | ✓ SATISFIED | Timeline wrapped in `<div data-presenter-hide>` at page layer; RetirosBancoTable failure-reason cells `data-presenter-metric-hide`; GenerarVistaClienteButton retargeted to `/clientes/{id}?presenter=1`. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none — only "placeholder" doc-string occurrences describing empty-state UX text, not stub patterns) | — | — | ℹ️ Info  | RetirosBancoTable.tsx:30, P2PCards.tsx:37, TimelineActivity.tsx:59 use the word "placeholder" in JSDoc to describe the empty-state muted-foreground line, not as a stub marker. No TODO/FIXME/XXX/HACK markers anywhere in Phase 9 files. |

### V1 Symbol Pruning

Commit `03efba3` ("refactor(09-03): prune 22 v1 symbols across bonos/recargas/clientes") confirmed:

- **bonos.ts (-8):** `filterBonos`, `summarizeBonos`, `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas`, `BonoSummary`, `BonoByDate`, `BonoByEmpresa` — grep confirms zero exports of these symbols remain.
- **recargas.ts (-10):** `filterRecargas`, `summarizeRecargas`, `aggregateRecargasByDate`, `aggregateRecargasByEmpresa`, `top10RecargasEmpresas`, `findTopEmpresaRecargadora`, `findRecargaMasGrande`, `RecargaSummary`, `RecargaByDate`, `RecargaByEmpresa` — grep confirms zero remain.
- **clientes.ts (-4):** `findEmpresa`, `EmpresaProfileSummary`, `aggregateMonthlyActivity`, `MonthlyActivity` — grep confirms zero remain.

**Total:** 22 symbols pruned (matches commit message). Net LOC change: −578 across 3 modules.

**Orphan-import scan:** Grep across `/src/` finds zero `import` statements referencing the deleted v1 symbols (excluding V2 variants). No callers broken.

### Tooling Validation

- **TypeScript compile:** `tsc --noEmit` exits 0 (no errors).
- **Format gate compliance:** All 8 leaves + page consume `@/lib/format` (formatCOP, formatBogotaDate, formatInteger, formatMinutes); zero `Intl.NumberFormat` / `toLocaleString` in Phase 9 files.

### Human Verification Required

6 items require runtime verification (see frontmatter `human_verification:`). All static structural verification passes.

### Gaps Summary

No gaps. All 6 must-haves verified at the structural level:

1. Domain layer (cliente.ts) — 4 functions + 6 types implemented and exported.
2. UI leaves (8 components in `src/components/clientes/`) — all created with substantive implementations (58–270 LOC).
3. Page composition (`/clientes/[empresaId]/page.tsx`) — single `joinPayouts` discipline preserved; presenter-hide wraps TimelineActivity + GenerarVistaClienteButton; presenter-metric-hide on failure-reason column.
4. v1 prune — 22 symbols deleted (8+10+4) per commit `03efba3`; no orphan imports.
5. v1→v2 contract change for share-URL flow — GenerarVistaClienteButton retargeted to dossier in presenter mode.
6. TypeScript compiles clean.

The remaining items (visual layout, OKLCH color rendering, runtime presenter-mode CSS toggling, router navigation side effects, empty-state fallback rendering) are inherently runtime/visual checks that grep cannot validate. These have been escalated as `human_verification:` items in the frontmatter.

---

_Verified: 2026-05-08_
_Verifier: Claude (gsd-verifier)_
