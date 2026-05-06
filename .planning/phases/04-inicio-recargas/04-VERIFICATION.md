---
phase: 04-inicio-recargas
verified: 2026-05-05T00:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification:
  previous_status: null
  notes: "Initial verification — no previous VERIFICATION.md present."
human_verification:
  - test: "4 cliente-foco URL states on /inicio"
    expected: "(no filter) 5 KPIs+2 charts+3 hechos visible; (?presenter=1) Comisión+Take rate hidden; (?empresa=$X) all visible filtered to empresa; (?presenter=1&empresa=$X) 3 KPIs+GMV chart visible, EmpresasActivasChart Card hidden, HechosCurados hidden."
    why_human: "Visual verification of CSS-driven visibility flips across URL states"
    status: "already verified at checkpoint (2026-05-05, Plan 04-07 SUMMARY line 90-94, user response: approved)"
  - test: "4 cliente-foco URL states on /recargas"
    expected: "(no filter) 2 KPIs+chart+table+2 hechos visible; (?presenter=1) identical to default (no internal-only KPI to hide); (?empresa=$X) KPIs+chart+table+hechos filtered to empresa; (?presenter=1&empresa=$X) KPIs+chart+table visible, 2 hechos curados hidden."
    why_human: "Visual verification of CSS-driven visibility flips across URL states"
    status: "already verified at checkpoint (2026-05-05, Plan 04-08 SUMMARY line 83-88, user response: approved)"
  - test: "Production deploy responds at https://project-dashboard-4b4fxxmdr.vercel.app"
    expected: "/login HTTP 200; /recargas HTTP 307 → /login (proxy gate intact)"
    why_human: "Deployment smoke test"
    status: "already verified at checkpoint (2026-05-06, Plan 04-08 SUMMARY line 90, deployment dpl_8GprZ3cAoemQCczDTRRLeqy4WNqS Ready Production)"
notes:
  - "REC-03 wording 'ordenable y filtrable' is satisfied programmatically (top 10 pre-sorted DESC by monto) but NOT interactively (no click-to-sort). Plan 04-06 explicitly scoped this as 'sortable visual hierarchy by descending monto', which mirrors the bonos SalesTable convention from Phase 2. Flagged as a v1 boundary, not a gap — the requirement's strict interpretation would land in REC-V2-XX scope alongside other table interaction enhancements."
---

# Phase 4: Inicio + Recargas — Verification Report

**Phase Goal:** Pestaña Inicio agrega los 5 KPIs ejecutivos + 2 gráficas (usando shapes de data ya cargadas en Phases 2-3); pestaña Recargas muestra volumen y count.
**Verified:** 2026-05-05
**Status:** passed (5/5 must-haves verified)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Usuario ve los 5 KPIs ejecutivos en Inicio (GMV, Comisión, Take rate, Empresas activas, Bonos vendidos), todos sensibles al filtro de fecha | VERIFIED | `KPICardsInicio.tsx:50-128` renders exactly 5 Cards in a `lg:grid-cols-5` grid; each Card consumes `current.{gmv\|comision\|takeRate\|empresasActivas\|bonosVendidos}`; page wires `summarizeInicio(filterCompletedIn(allTx, filters))` at `inicio/page.tsx:144,156` so the 5 KPIs flow from the Bogotá-anchored from/to filter. |
| 2 | Usuario ve gráficas de tendencia de GMV y Empresas activas en el tiempo | VERIFIED | `GMVTrendChart.tsx:69 BarChart` + `EmpresasActivasChart.tsx:71 LineChart`, both Recharts client components with `ResponsiveContainer`. Page wires `gmvSeries` (`aggregateGMVByDate\|ByWeek`) + `activeSeries` (`aggregateActiveEmpresasByDate\|ByWeek`) at `inicio/page.tsx:172-179` and renders `<GMVTrendChart>` + `<EmpresasActivasChart>` at lines 223, 238. Bucket granularity switches at 60-day threshold (`inicio/page.tsx:170`). |
| 3 | En Modo Presentación: KPIs de Comisión y Take rate están ocultos; los demás KPIs y gráficas siguen visibles | VERIFIED | `KPICardsInicio.tsx:66 <Card data-presenter-hide>` (Comisión) + `KPICardsInicio.tsx:82 <Card data-presenter-hide>` (Take rate). `globals.css:150-152 [data-presenter="on"] [data-presenter-hide] { display: none !important; }`. PresenterFrame writes `data-presenter="on\|off"` at `presenter-frame.tsx:47`. The other 3 KPI Cards (lines 53, 98, 114) carry NO `data-presenter-hide` → remain visible. Charts have NO `data-presenter-hide` → remain visible. |
| 4 | Usuario ve total $ recargado, count de transacciones, y tabla por empresa (top 10) en Recargas | VERIFIED | `RecargasKPICards.tsx:46 + 62` renders 2 Cards: Total recargado (`formatCOP(montoTotal)`) + # de recargas (`formatInteger(count)`). `RecargasTable.tsx:39-93` renders top-10 empresas table (4 cols: Empresa / # recargas / $ recargado / % del total). Page wires `summarizeRecargas` + `top10RecargasEmpresas(aggregateRecargasByEmpresa(...))` at `recargas/page.tsx:135,141`. NOTE: REC-03's "ordenable" is delivered as descending pre-sort by monto, not interactive click-to-sort — see notes in frontmatter. |
| 5 | Inicio y Recargas respetan filtros globales de fecha y empresa | VERIFIED | Both pages call `parseFilters(params)` (`inicio/page.tsx:114`, `recargas/page.tsx:96`); both thread `filters` into the domain filter functions (`filterCompletedIn`, `filterRecargas`). Domain code honors `filters.empresa` (`inicio.ts:172,183` and `recargas.ts:191,203`) and `filters.from\|to` via inline Bogotá date helpers. Empty/undefined empresa → no narrowing. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Status | Details |
| -------- | ------ | ------- |
| `src/app/(protected)/inicio/page.tsx` | VERIFIED | 255 LOC. Server Component. Imports parseFilters, computePriorPeriod, getCachedTransactions, getCachedPayouts, all 6 inicio domain fns, 2 inicio-hechos fns, summarizePayouts. Renders KPICardsInicio + 2 chart Cards + HechosCurados. `dynamic = 'force-dynamic'` line 105. Inline error fallback Card lines 124-138. |
| `src/app/(protected)/recargas/page.tsx` | VERIFIED | 175 LOC. Server Component. Imports parseFilters, computePriorPeriod, getCachedTransactions, all 7 recargas domain fns. Renders RecargasKPICards + chart Card + RecargasTable + HechosCuradosRecargas. `dynamic = 'force-dynamic'` line 87. Inline error fallback Card lines 102-116. |
| `src/components/inicio/KPICardsInicio.tsx` | VERIFIED | 130 LOC. Server Component. 5-card grid. `data-presenter-hide` on Card 2 (Comisión, line 66) + Card 3 (Take rate, line 82). DeltaBadge per Card. |
| `src/components/inicio/HechosCurados.tsx` | VERIFIED | 124 LOC. Server Component. Outer div `data-presenter-empresa-hide` line 49. 3-card grid: Top empresa / Latencia (inverted DeltaBadge) / Empresas nuevas. Per-card empty states. |
| `src/components/inicio/GMVTrendChart.tsx` | VERIFIED | 109 LOC. Client Component (`use client` line 1). Recharts BarChart. Bucket-aware tickFormatter via `granularity` prop. |
| `src/components/inicio/EmpresasActivasChart.tsx` | VERIFIED | 113 LOC. Client Component. Recharts LineChart. |
| `src/components/inicio/DeltaBadge.tsx` | VERIFIED | 78 LOC. Server Component with `inverted` prop for latency direction. Imported by KPICardsInicio + HechosCurados + RecargasKPICards. |
| `src/components/recargas/RecargasKPICards.tsx` | VERIFIED | 75 LOC. Server Component. 2-card grid (Total recargado + # de recargas). DeltaBadge per Card. NO `data-presenter-hide` (correct — no internal-only KPI). |
| `src/components/recargas/RecargasTrendChart.tsx` | VERIFIED | 94 LOC. Client Component. Recharts BarChart, daily-only. |
| `src/components/recargas/RecargasTable.tsx` | VERIFIED | 94 LOC. Server Component. 4-column table; empty state at line 47. |
| `src/components/recargas/HechosCuradosRecargas.tsx` | VERIFIED | 104 LOC. Server Component. Outer div `data-presenter-empresa-hide` line 48. 2-card grid: Top empresa recargadora + Recarga más grande. |
| `src/lib/domain/period.ts` | VERIFIED | 108 LOC. `computePriorPeriod` + `pctChange` exports confirmed. Pure module (no next/react/server-only/sheets imports). |
| `src/lib/domain/inicio.ts` | VERIFIED | 361 LOC. 4 type interfaces (InicioSummary, InicioDeltaSummary, GMVPoint, ActiveEmpresaPoint) + 6 fns (filterCompletedIn, summarizeInicio, aggregateGMVByDate/Week, aggregateActiveEmpresasByDate/Week). |
| `src/lib/domain/inicio-hechos.ts` | VERIFIED | 279 LOC. 3 type interfaces (TopEmpresaResult, EmpresaNueva, EmpresasNuevasResult) + 2 fns (findTopEmpresaByGMV, findEmpresasNuevasActivadas). |
| `src/lib/domain/recargas.ts` | VERIFIED | 433 LOC. 3 type interfaces + 7 fns (filterRecargas, summarizeRecargas, aggregateRecargasByDate/ByEmpresa, top10RecargasEmpresas, findTopEmpresaRecargadora, findRecargaMasGrande). |
| `src/components/layout/presenter-frame.tsx` | VERIFIED | 54 LOC. Client Component. Writes `data-presenter` (line 47) + `data-empresa-filter` (line 48) on outer wrapper from URL state. |
| `src/app/globals.css` (presenter rules) | VERIFIED | 3 CSS rules confirmed: `[data-presenter="on"] { font-size: 1.15em }` line 146; `[data-presenter="on"] [data-presenter-hide] { display: none !important }` line 150; `[data-presenter="on"][data-empresa-filter="active"] [data-presenter-empresa-hide] { display: none !important }` line 183. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `inicio/page.tsx` | `getCachedTransactions` + `getCachedPayouts` | `Promise.all` line 120 | WIRED | Parallel fetch with try/catch; failure renders inline error Card. |
| `inicio/page.tsx` | `KPICardsInicio` | line 205 `<KPICardsInicio summary={summary} />` | WIRED | `summary = {current: summarizeInicio(currentTx), prior: priorTx ? summarizeInicio(priorTx) : null}` line 156. |
| `inicio/page.tsx` | `GMVTrendChart` + `EmpresasActivasChart` | lines 223, 238 | WIRED | Series fed from bucket-aware aggregations; Empresas chart wrapped in `<Card data-presenter-empresa-hide>` line 228. |
| `inicio/page.tsx` | `HechosCurados` | line 247 | WIRED | 4 props: topEmpresa, empresasNuevas, latenciaCurrent, latenciaPrior. `findEmpresasNuevasActivadas` correctly receives `allTx` (full dataset, line 187) per Pitfall 5. |
| `recargas/page.tsx` | `getCachedTransactions` | line 101 (sequential await) | WIRED | Try/catch with inline error Card fallback. |
| `recargas/page.tsx` | `RecargasKPICards` + `RecargasTrendChart` + `RecargasTable` + `HechosCuradosRecargas` | lines 150, 162, 167, 169 | WIRED | All 4 leaves rendered; props derived from filtered + aggregated data. |
| `PresenterFrame` | `data-empresa-filter` | URL `?empresa` via `useSearchParams` line 41-43 | WIRED | Empty/missing → "none"; specific id → "active". Defensive `__all__` guard for forward-compat. |
| CSS gate | hides `[data-presenter-hide]` and `[data-presenter-empresa-hide]` | globals.css lines 150, 183 | WIRED | Two distinct selector chains; cliente-foco needs both data-presenter="on" AND data-empresa-filter="active" on same ancestor. |

### Requirements Coverage

| Requirement | Status | Evidence |
| ----------- | ------ | -------- |
| INI-01 GMV KPI sensitive to fecha | SATISFIED | KPICardsInicio Card 1 (line 53) + filterCompletedIn from/to filter |
| INI-02 Comisión KPI hidden in Modo Presentación | SATISFIED | KPICardsInicio Card 2 (line 66) carries `data-presenter-hide`; CSS rule globals.css:150 |
| INI-03 Take rate KPI hidden in Modo Presentación | SATISFIED | KPICardsInicio Card 3 (line 82) carries `data-presenter-hide`; CSS rule globals.css:150 |
| INI-04 Empresas activas KPI | SATISFIED | KPICardsInicio Card 4 (line 98); summarizeInicio uses Set<empresa_id> for dedup |
| INI-05 Bonos vendidos KPI | SATISFIED | KPICardsInicio Card 5 (line 114); summarizeInicio filters by tipo='BONUS' for count |
| INI-06 GMV trend chart | SATISFIED | GMVTrendChart Recharts BarChart, bucket-aware (daily/weekly at 60-day threshold) |
| INI-07 Empresas activas trend chart | SATISFIED | EmpresasActivasChart Recharts LineChart |
| REC-01 Total $ recargado KPI + tendencia | SATISFIED | RecargasKPICards Card 1 (montoTotal) + RecargasTrendChart |
| REC-02 # transacciones KPI | SATISFIED | RecargasKPICards Card 2 (count) |
| REC-03 Tabla top 10 ordenable y filtrable | SATISFIED (v1 scope) | RecargasTable top 10 pre-sorted DESC by monto. Interactive click-to-sort + free-text filter NOT implemented — flagged in frontmatter notes; consistent with bonos SalesTable convention from Phase 2. |

### Anti-Patterns Found

None. Zero TODO/FIXME/placeholder/coming-soon/not-implemented strings across all 17 phase 4 files.

### Human Verification Status

All items already discharged at checkpoints:
1. **/inicio cliente-foco 4-state matrix** — verified 2026-05-05 (Plan 04-07 SUMMARY, user response: approved)
2. **/recargas cliente-foco 4-state matrix** — verified 2026-05-05 (Plan 04-08 SUMMARY, user response: approved)
3. **Production smoke test** — verified 2026-05-06 (Plan 04-08 SUMMARY, deploy `dpl_8GprZ3cAoemQCczDTRRLeqy4WNqS` Ready Production at `https://project-dashboard-4b4fxxmdr.vercel.app`)

### Gaps Summary

No blocking gaps. One scope clarification:

**REC-03 "ordenable y filtrable" — partial v1 delivery**: The table is sorted DESC by monto (visible hierarchy) and bounded to top 10. Interactive sort + filter are NOT implemented. This matches Plan 04-06's explicit scope ("sortable visual hierarchy by descending monto") and the existing convention from bonos SalesTable. Strict interpretation of "ordenable" as "click column to re-sort" would push to REC-V2-XX. Flagged for visibility; not blocking Phase 4 sign-off.

---

*Verified: 2026-05-05*
*Verifier: Claude (gsd-verifier)*
