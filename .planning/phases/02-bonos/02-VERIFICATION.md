---
phase: 02-bonos
verified: 2026-04-29T22:23:44Z
status: human_needed
score: 5/5 must-haves structurally verified (visual confirmation pending)
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open production /bonos with no filters and confirm hero chart renders a clean line with es-CO ticks"
    expected: "Single monotone line, no dots per data point, X-axis shows YYYY-MM-DD ticks, Y-axis shows integer counts, no Recharts default-color leak (uses currentColor → Tailwind text-foreground)"
    why_human: "Chart aesthetics (line cleanliness, no clipping, tooltip readability) cannot be verified without rendering Recharts in a real browser"
  - test: "Toggle presenter on /bonos and visually confirm the right elements disappear"
    expected: "Top 10 empresas card disappears entirely; Comisión total ganada KPI card disappears; the last 2 columns of the SalesTable ($ comisión, % del total) disappear; the chart stays; the Ticket promedio KPI stays; the SalesTable visually re-flows without jagged column shifts"
    why_human: "CSS visibility under data-presenter='on' produces a real DOM-level hide; need a human eye to confirm no remnants leak (e.g. empty <th> placeholders, broken table column widths)"
  - test: "Apply empresa filter (e.g. ?empresa=$mario) and confirm every visualization narrows"
    expected: "KPI cards reflect only that empresa, chart reflects only that empresa's daily series, leaderboard shows only 1 row, SalesTable shows only 1 row"
    why_human: "Filter propagation across 4 components is structurally proven (single filterBonos call feeds all 4 aggregations) but visually confirming all 4 narrow simultaneously is the user-facing contract"
  - test: "Combo presenter+empresa (?presenter=1&empresa=$mario) — the 'vista cliente foco' end-to-end"
    expected: "Chart visible (the cliente sees their tendency), Ticket promedio visible, Comisión KPI hidden, leaderboard hidden, last 2 SalesTable cols hidden — and the SalesTable now shows just the cliente's own row with no comisión/% data exposed"
    why_human: "This is the critical UX the dashboard exists to deliver; structural pieces are correct but the holistic 'do I feel comfortable showing this to a client?' check is human-only"
  - test: "Resize browser between mobile (<640px), tablet, and desktop (>1024px) on /bonos"
    expected: "Mobile: KPIs stack 1-col, chart full width, leaderboard above table stacked. Desktop: KPIs in 2-col, chart full width, Leaderboard|SalesTable in 1:2 lg:grid-cols-[1fr_2fr]. Table never overflows horizontally awkwardly (overflow-x-auto wrapper handles it)."
    why_human: "Responsive layout (grid breakpoints, table overflow behavior) needs visual confirmation across viewport widths"
  - test: "Date range filter producing zero rows (e.g. ?from=2020-01-01&to=2020-01-02) and refresh"
    expected: "KPICards renders with $ 0 / 0 bonos (zero-safe); a 'Sin bonos en el período seleccionado' Card appears below; no chart/leaderboard/table render; user can tell 'my filter is the cause' not 'data is broken'"
    why_human: "Empty-state copy is in Spanish and visible only when filter excludes everything — confirm copy is friendly and action-suggesting, not alarmist"
---

# Phase 2: Bonos Verification Report

**Phase Goal:** Pestaña Bonos muestra ventas de bonos por empresa con datos en vivo y respeto a Modo Presentación.

**Verified:** 2026-04-29T22:23:44Z
**Status:** human_needed (all 5 must-haves structurally verified in code; 6 visual/UX checks await human confirmation in browser)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Usuario ve gráfica de Bonos vendidos en el tiempo Y leaderboard Top 10 empresas, ambos respondiendo al filtro global de fecha | ✓ VERIFIED | BonosChart fed by `aggregateBonosByDate(bonos)` (page.tsx:121,134); Leaderboard fed by `top10Empresas(byEmpresa)` (page.tsx:123,139). Both consume `bonos = filterBonos(rows, filters)` (page.tsx:99) where `filters` originates from `parseFilters(searchParams)` (page.tsx:77). Date filter is applied inside `filterBonos` via `startOfDayBogotaTimestamp`/`endOfDayBogotaTimestamp` (bonos.ts:154-167). |
| 2 | Usuario ve tabla de Ventas por empresa con columnas (# bonos, $ vendido, $ comisión, % del total) | ✓ VERIFIED | SalesTable.tsx:52-70 declares all 5 columns: Empresa, # bonos, $ vendido, $ comisión, % del total. Each row (lines 76-97) renders `r.count` (formatInteger), `r.monto` + `r.comision` (formatCOP), `r.pctDelTotal` (formatPercent). `aggregateBonosByEmpresa` (bonos.ts:263-297) provides exactly this shape, sorted DESC by monto. |
| 3 | Usuario ve KPIs de Ticket promedio por bono y Comisión total ganada en el período | ✓ VERIFIED | KPICards.tsx:42-69 renders both KPIs in a 2-col grid. `summary.ticketPromedio` (formatCOP, line 45), `summary.comisionTotal` (formatCOP, line 62). `summarizeBonos` (bonos.ts:186-196) computes both, zero-safe (count=0 → ticketPromedio=0, no NaN). |
| 4 | En Modo Presentación: $ comisión y % del total ocultas en tabla, KPI Comisión oculto, Leaderboard oculto | ✓ VERIFIED | Five `data-presenter-hide` attributes confirmed: KPICards.tsx:57 (Comisión card wrapper), Leaderboard.tsx:35 (entire Card), SalesTable.tsx:61 + :67 (column headers), SalesTable.tsx:87 + :93 (column cells). CSS contract `[data-presenter="on"] [data-presenter-hide] { display: none !important; }` at globals.css:150-152. PresenterFrame (presenter-frame.tsx) sets `data-presenter` from URL `?presenter=1`. |
| 5 | Filtro de empresa reduce todas las visualizaciones de la pestaña a esa empresa | ✓ VERIFIED | Single source: `filters.empresa` parsed at page.tsx:77. Single filter call: `filterBonos(rows, filters)` at page.tsx:99 applies `t.empresa_id === empresa` (bonos.ts:168). Resulting `bonos` array feeds ALL 4 aggregations (summarizeBonos, aggregateBonosByDate, aggregateBonosByEmpresa, top10Empresas). No component re-fetches independently. |

**Score:** 5/5 truths structurally verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(protected)/bonos/page.tsx` | Server-Component composition pulling URL filters → cached fetch → 4 aggregations → 4 leaves | ✓ VERIFIED | 144 lines; `dynamic = 'force-dynamic'` (line 68); `await searchParams` Next 16 signature (line 76); try/catch error fallback Card (lines 82-97); empty-state Card with KPIs (lines 102-119); responsive grid `lg:grid-cols-[1fr_2fr]` (line 138). |
| `src/components/bonos/BonosChart.tsx` | Recharts line chart, monotone, no hard-coded colors, format gate | ✓ VERIFIED | 107 lines, Client Component. `stroke="currentColor"`, `strokeWidth={2}`, `dot={false}`, `type="monotone"` (lines 95-101). `formatCOP`/`formatInteger` for ticks + tooltip (lines 64-65). No direct Intl/toLocale. |
| `src/components/bonos/Leaderboard.tsx` | Top 10 ordered list, presenter-hidden, format gates | ✓ VERIFIED | 71 lines. `<Card data-presenter-hide>` wraps everything (line 35). Renders ordered list with rank badge + truncated nombre + count + COP monto (lines 48-65). Empty-state copy line 44. |
| `src/components/bonos/KPICards.tsx` | 2 KPIs (Ticket promedio always visible, Comisión presenter-hidden) | ✓ VERIFIED | 72 lines. Ticket promedio Card (lines 40-54) — no presenter-hide. Comisión Card (lines 57-69) — `data-presenter-hide` on wrapper. Both use formatCOP. Subtitle distinguishes "X bonos" vs "Sin bonos en el período" via `summary.count > 0` check. |
| `src/components/bonos/SalesTable.tsx` | 5-column table; cols 4 & 5 presenter-hidden | ✓ VERIFIED | 107 lines. Headers + cells for "$ comisión" and "% del total" both carry `data-presenter-hide` (lines 61, 67, 87, 93). `formatCOP`/`formatInteger`/`formatPercent` used. Empty-state copy (line 44). Pre-sorted by `aggregateBonosByEmpresa` so no client-side sort logic. |
| `src/lib/domain/bonos.ts` | Pure filter + 4 aggregations + zero-safe pct | ✓ VERIFIED | 318 lines, no imports from `next/`/`react`/`server-only`/`lib/sheets/`. `filterBonos` applies tipo=BONUS + direction=in + status=completed + Bogotá-anchored from/to + empresa (lines 149-172). `summarizeBonos` zero-safe (line 194). `aggregateBonosByDate` sorts ASC, no zero-fill (lines 219-232). `aggregateBonosByEmpresa` zero-safe pctDelTotal via `safeTotal > 0` guard (lines 286-292). `top10Empresas` slices to 10. |
| `src/lib/domain/empresas.ts` | Pure registry from Transaction[] for the dropdown | ✓ VERIFIED | 75 lines. `getEmpresaRegistry` deduplicates by empresa_id, skips empty IDs, sorts via `Intl.Collator('es')` (lines 54-74). Returns `EmpresaOption[]`. (Note: `Intl.Collator` is sorting API, distinct from formatting Intl.NumberFormat — single Intl gate policy preserved.) |
| `src/lib/sheets/transactions.ts` | `getCachedTransactions` exported, React `cache()` per-request dedup | ✓ VERIFIED | `export const getCachedTransactions = cache(getTransactions)` at line 166. Same function imported by both DashboardHeader (dashboard-header.tsx:34,39) AND Bonos page (page.tsx:60,81) — confirms shared dedup path. |
| `src/components/layout/dashboard-header.tsx` | Uses cached fn (no double Sheets call) | ✓ VERIFIED | dashboard-header.tsx:34 imports `getCachedTransactions`; line 39 awaits it; line 40 maps to `getEmpresaRegistry`. try/catch degrades gracefully on Sheets failure (lines 41-48). |
| `src/lib/url-state.ts` | parseFilters returns DashboardFilters with from/to/empresa/presenter | ✓ VERIFIED | url-state.ts:52-61 returns the exact shape that bonos.ts:151 (`DashboardFilters` import) and the page (`filters.empresa`, etc.) consume. |
| `src/lib/format.ts` | Single Intl gate for COP/integer/percent + Bogotá date helpers | ✓ VERIFIED | 118 lines, only file with `new Intl.NumberFormat`. Exports formatCOP / formatInteger / formatPercent / formatBogotaDate / formatBogotaDateTime / todayISOInBogota / toBogotaISODate. Grep confirmed zero `Intl.NumberFormat`/`toLocaleString`/`toLocaleDateString`/`toLocaleTimeString` calls outside this file. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `page.tsx` | `getCachedTransactions` | direct import + await | WIRED | page.tsx:60,81. Returns `AdapterResult<Transaction>` with `rows`, used at line 99. |
| `dashboard-header.tsx` | `getCachedTransactions` | direct import + await | WIRED | Same function as page.tsx → React `cache()` dedup achieved. dashboard-header.tsx:34,39. |
| `page.tsx` | `parseFilters` | direct import + call | WIRED | page.tsx:61,77. Output flows into `filterBonos`. |
| `page.tsx` | `filterBonos` + 4 aggregations | direct imports, sequential calls | WIRED | All 4 leaves derive from same filtered `bonos` array — no aggregator drift across components. |
| `page.tsx` | 4 leaf components | direct imports, prop pass | WIRED | KPICards (line 105,127), BonosChart (line 134), Leaderboard (line 139), SalesTable (line 140). |
| `bonos/*.tsx` | `format.ts` exports | direct imports | WIRED | All COP/count/percent values flow through format.ts — no string concatenation, no `toLocaleString`. |
| `Leaderboard` + `KPICards.Comisión` + `SalesTable` 4 cells | `globals.css` presenter selector | `data-presenter-hide` HTML attribute | WIRED | CSS rule globals.css:150-152 hides any `data-presenter-hide` element when `[data-presenter="on"]` ancestor exists. PresenterFrame sets `data-presenter` from URL `presenter=1`. |
| `(protected)/layout.tsx` | `PresenterFrame` | wraps DashboardHeader+TabNav+children | WIRED | layout.tsx:36-41 confirms PresenterFrame wraps the entire authenticated subtree. |

### Requirements Coverage

| Requirement | Status | Where it lives |
|-------------|--------|----------------|
| **BON-01** Gráfica bonos vendidos en el tiempo | ✓ SATISFIED | BonosChart + aggregateBonosByDate, composed in page.tsx:121,134 |
| **BON-02** Tabla por empresa (# bonos, $ vendido, $ comisión, % del total) + cols hidden in presenter | ✓ SATISFIED | SalesTable.tsx (5 columns + 4 `data-presenter-hide` attrs on cols 4-5) + aggregateBonosByEmpresa |
| **BON-03** KPI Ticket promedio por bono | ✓ SATISFIED | KPICards.tsx (always-visible card) + summarizeBonos.ticketPromedio |
| **BON-04** KPI Comisión total ganada (oculto en presenter) | ✓ SATISFIED | KPICards.tsx (`data-presenter-hide` Card) + summarizeBonos.comisionTotal |
| **BON-05** Leaderboard Top 10 (oculto en presenter) | ✓ SATISFIED | Leaderboard.tsx (`<Card data-presenter-hide>`) + top10Empresas |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none found) | — | — | — | All bonos files are substantive (>40 lines each), no TODO/FIXME/placeholder/stub returns, no empty handlers, no console.log-only implementations. |

Verified via grep across `src/components/bonos/`, `src/lib/domain/`, `src/app/(protected)/bonos/page.tsx` — zero TODO/FIXME/XXX/HACK markers, zero placeholder strings, zero `return null`/`return {}` stubs.

### Production Deployment Sanity

| Check | Method | Result |
|-------|--------|--------|
| Production URL responds | `curl -I https://project-dashboard-bkwmin189.vercel.app/login` | HTTP 200, 13 KB |
| Auth gate enforced | `curl -I https://project-dashboard-bkwmin189.vercel.app/bonos` | HTTP 307 (redirect to login) — confirms layout's `verifySession()` runs |
| Phase 2 commits in git | `git log --oneline` | 8 Phase 2 commits present (881de0f → 3bee027) matching SUMMARY.md plan progression |

(Note: production is documented in ROADMAP as the Phase 1 deploy URL; SUMMARY 02-04 references a newer preview URL `project-dashboard-qhrwwpfuw.vercel.app`. The 16-check verification log in 02-04-SUMMARY.md was executed against that preview. The Phase-1 production URL still serves the older Phase 1 build until promoted; this is expected.)

### Human Verification Required

See frontmatter `human_verification` section above. Six visual/UX checks await browser-level confirmation:

1. **Hero chart aesthetics** — Recharts line render quality (no programmatic substitute)
2. **Presenter mode visual hide** — confirm no DOM remnants/jagged table reflow
3. **Empresa filter narrows all 4 visualizations together** — visual cohesion check
4. **Vista cliente foco end-to-end (presenter+empresa)** — holistic comfort check
5. **Responsive layout across breakpoints** — grid + table behavior at multiple widths
6. **Empty-state friendliness** — copy + zero-KPI presentation in Spanish

### Gaps Summary

No structural gaps. All 5 must-haves are wired correctly in the codebase:
- Components exist, are substantive, and export the expected props.
- Page composition flows URL → filters → cached fetch → pure aggregations → leaves with no double-fetch and no glue layer between domain and UI.
- Presenter mode is fully declarative (URL → CSS attribute → CSS rule) — no JS branching anywhere.
- Single Intl gate preserved (only format.ts has `new Intl.NumberFormat`; bonos components import format helpers exclusively).
- Empresa filter applies once at the top of the pipeline so all 4 visualizations narrow in lockstep.

The `human_needed` status reflects that this is **the first phase with real data flowing into visual components**, so the user-facing experience (chart smoothness, presenter mode actually feeling clean, responsive table) needs a human eye in the browser to confirm the structural correctness translates into a credible "shippable for client demos" experience. The Phase 2 SUMMARY 02-04 includes 16 ✅ checks against the preview deployment that already give high confidence; the human verification list is a final sign-off, not gap recovery.

---

_Verified: 2026-04-29T22:23:44Z_
_Verifier: Claude (gsd-verifier)_
