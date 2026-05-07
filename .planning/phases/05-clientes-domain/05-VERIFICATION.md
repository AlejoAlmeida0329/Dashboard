---
phase: 05-clientes-domain
verified: 2026-05-06T20:15:00Z
status: human_needed
score: 4/5 must-haves verified (1 deferred by user)
human_verification:
  - test: "Verify Phase 5 cliente-flow end-to-end on production Vercel URL"
    expected: |
      1. Navigate to https://project-dashboard-z0fpsm5hl.vercel.app/clientes
      2. Confirm 2 KPI cards on top (Total empresas + Empresas activas) with non-zero counts
      3. Confirm sortable + searchable empresa table renders rows
      4. Click any row → /clientes/[empresaId] profile loads with header, 12-month chart, 3 mini-cards
      5. Click "Generar vista para cliente" → lands on /inicio?empresa=$X&presenter=1
      6. On /inicio (presenter ON): Comisión + Take rate cards hidden, HechosCurados hidden,
         EmpresasActivasChart Card hidden, GMV chart visible, KPIs narrowed to that empresa
    why_human: "Live data + real Sheets fetch + browser CSS rendering can only be confirmed by user interaction"
  - test: "Confirm INFRA-04 (custom domain dashboard.tikin.co) deferral status"
    expected: |
      Plan 05-05 was DEFERRED by user during execution. Custom-domain decision pending.
      Until INFRA-04 ships, the dashboard is reachable only at the Vercel URL
      (https://project-dashboard-z0fpsm5hl.vercel.app). When user is ready, re-open
      Plan 05-05 to pick a domain and configure DNS + Vercel custom domain.
    why_human: "DNS / Vercel domain configuration is an out-of-codebase infra task; cannot be code-verified"
---

# Phase 5: Clientes + Domain Verification Report

**Phase Goal:** Pestaña Clientes con lista + perfil; botón "Generar vista para cliente" cierra el flujo de presentación end-to-end; dashboard accesible en dominio propio.
**Verified:** 2026-05-06T20:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary

4 of 5 success criteria are achieved in code and shipped to production at the Vercel URL. The 5th criterion (custom domain `dashboard.tikin.co`) is **deliberately deferred by user request** — Plan 05-05 was not executed; INFRA-04 stays open. This is a planning-level decision, not a missing implementation. Status is `human_needed` (not `gaps_found`) because:

1. The deferral is intentional and documented in 05-04-SUMMARY.md.
2. The cliente-flow that depended on this phase (CLI-01..CLI-08) is fully implemented and works on the existing Vercel URL.
3. Custom-domain configuration is an out-of-codebase infra task; the planner / user owns it, not the verifier.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                                                                          | Status      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | Usuario ve tabla de empresas con columnas ordenables (por $, recencia, nombre), búsqueda por nombre, y KPIs en cabecera (Total empresas + Empresas activas)                                                                                    | VERIFIED    | `ClientesKPICards.tsx` (72 lines, renders Total + Activas via `summarizeEmpresasIndex`). `ClientesTable.tsx` (305 lines) implements 6-column sort (`empresa_nombre`, `txPeriod`, `montoPeriod`, `montoHistorico`, `ultimaActividad`, `status`) with `useState` + `useMemo` + `Intl.Collator` for natural-order name sort, and case-insensitive `Input type="search"` filter on `empresa_nombre`. `clientes/page.tsx` wires `deriveEmpresasIndex` + `summarizeEmpresasIndex` and passes both to the leaves.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2   | Usuario abre perfil de una empresa con header (nombre, status, última actividad), gráfica de actividad mensual de los últimos 12 meses, y mini-resumen 3 cards (Bonos / Recargas / Payouts) de esa empresa                                     | VERIFIED    | `[empresaId]/page.tsx` (228 lines) calls `findEmpresa` for header data → renders `EmpresaProfileHeader` (nombre, status badge, última actividad + 4 KPIs); calls `aggregateMonthlyActivity` (12-month zero-filled series) → renders `EmpresaActivityChart` (recharts BarChart). For mini-cards it narrows `empresaFilters = { ...filters, empresa: empresaId }` and applies Phase 2/3/4 domain functions: `filterBonos+summarizeBonos`, `filterRecargas+summarizeRecargas`, and `filterPayouts+summarizePayouts` over an enriched payouts array (transactionId join from BD_Plataforma to backfill `empresa_id` because BD_Payouts.holder is a cardholder name). Result passed to `EmpresaMiniCards` (3 cards: count + ticket promedio / total recargado / mediana P50). Returns "Empresa no encontrada" Card when `findEmpresa` returns null.                                                                                                          |
| 3   | Botón "Generar vista para cliente" aplica el filtro de empresa, activa Modo Presentación, y navega a Inicio populado con la data del cliente seleccionado                                                                                      | VERIFIED    | `GenerarVistaClienteButton.tsx` (51 lines) reads current URL params via `useSearchParams`, calls `parseFilters`, builds `buildUrl("/inicio", { ...current, empresa: empresaId, presenter: "1" })`, and `router.push`s. The destination `/inicio` page consumes `filters.empresa` through `filterCompletedIn`, `filterPayouts`, `findTopEmpresaByGMV` etc. — confirmed in `inicio/page.tsx:144,192`. `PresenterFrame` (Client wrapper at `(protected)/layout.tsx`) writes `data-presenter="on"` + `data-empresa-filter="active"` to the outer div, which CSS in `globals.css:146-183` uses to hide `data-presenter-hide` (Comisión + Take rate KPI cards) and `data-presenter-empresa-hide` (HechosCurados + EmpresasActivasChart Card on Inicio). All Tikin-internal sections collapse; cliente-foco view renders. End-to-end CLI-08 flow is fully wired.                                                                                              |
| 4   | Dashboard responde en dominio propio (ej. dashboard.tikin.co) además de la URL de Vercel, con HTTPS funcionando                                                                                                                                | DEFERRED    | **Plan 05-05 was DEFERRED by user during execution** (documented in `05-04-SUMMARY.md:31,136`). No custom-domain configuration exists in the repo (`vercel.json` carries only `regions` + `framework`; no `tikin.co` references in `src/`). INFRA-04 remains open in `REQUIREMENTS.md:32`. The cliente-flow shipped works on the existing Vercel URL `https://project-dashboard-z0fpsm5hl.vercel.app`. This is a deliberate planning-level decision, not a code gap. To close: re-open Plan 05-05, pick a domain, configure Vercel + DNS.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 5   | Filtros globales y Modo Presentación se respetan en todas las vistas de Clientes                                                                                                                                                               | VERIFIED    | Both Clientes pages call `parseFilters(searchParams)` and pass the resulting `DashboardFilters` into the domain functions (`deriveEmpresasIndex(allTx, filters)` for date-window split histórico/período + status; `findEmpresa(allTx, empresaId, filters)` for header period KPIs; profile page narrows mini-card aggregations to `empresaFilters`). The list page IGNORES `filters.empresa` by design (the table is the picker, not narrowable) — documented in `clientes.ts` JSDoc and `clientes/page.tsx`. `ClientesTable` row hrefs preserve `from`/`to`/`presenter` and strip `empresa` (so a click navigates to that empresa's profile). The whole subtree is wrapped in `PresenterFrame`, so `data-presenter` and `data-empresa-filter` flow through every view. Profile page also tags `GenerarVistaClienteButton` wrapper with `data-presenter-hide` so the button disappears when presenter mode is already on.                              |

**Score:** 4/5 verified · 1 deliberately deferred (INFRA-04)

### Required Artifacts

| Artifact                                                          | Expected                                                                                                                       | Status     | Details                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/domain/clientes.ts`                                      | 4 functions (`deriveEmpresasIndex`, `summarizeEmpresasIndex`, `findEmpresa`, `aggregateMonthlyActivity`) + 5 types             | VERIFIED   | 516 lines. All 4 functions exported with JSDoc + algorithm narrative. 5 types exported (`EmpresaStatus`, `EmpresaListRow`, `EmpresasIndexSummary`, `EmpresaProfileSummary`, `MonthlyActivity`). Pure (no `next/`/`server-only`/`react`/`sheets/` imports beyond `date-fns-tz`). Bogotá-anchored date math. |
| `src/components/clientes/ClientesKPICards.tsx`                    | Server Component, 2 cards (Total empresas + Empresas activas)                                                                  | VERIFIED   | 72 lines. Server (no `"use client"`). Consumes `EmpresasIndexSummary`. Format gates respected (`formatInteger`).                                                                                                       |
| `src/components/clientes/ClientesTable.tsx`                       | Client Component, sortable (6 cols) + searchable empresa list, row links to profile                                            | VERIFIED   | 305 lines. `"use client"`. 6-column sort with toggleable direction, default `montoHistorico` DESC. `Intl.Collator` for name sort. Search input filters by `empresa_nombre.toLowerCase().includes(q)`. Row links use `buildUrl` preserving `from/to/presenter`, stripping `empresa`. Empty/no-match copy. |
| `src/components/clientes/EmpresaProfileHeader.tsx`                | Server Component, header (nombre, status, última actividad, 4 KPIs)                                                            | VERIFIED   | 73 lines. Server. Renders nombre + status badge + última actividad + 4 stats (`$ período`, `$ histórico`, `# tx período`, `# tx histórico`).                                                                          |
| `src/components/clientes/EmpresaActivityChart.tsx`                | Client Component, 12-month bar chart                                                                                           | VERIFIED   | 75 lines. `"use client"`. Recharts `BarChart` with currentColor stroke (matches Bonos/Recargas chart shapes). `formatCOP` for tooltip + Y-axis. 320px height.                                                          |
| `src/components/clientes/EmpresaMiniCards.tsx`                    | Server Component, 3 mini cards (Bonos / Recargas / Payouts)                                                                    | VERIFIED   | 106 lines. Server. Consumes `BonoSummary`, `RecargaSummary`, `PayoutSummary` from Phase 2/3/4 domains. Each card shows count + most-relevant single metric (Ticket promedio / Total recargado / Mediana P50).         |
| `src/components/clientes/GenerarVistaClienteButton.tsx`           | Client Component, navigates to `/inicio?empresa=<id>&presenter=1`                                                              | VERIFIED   | 51 lines. `"use client"`. `useRouter().push(buildUrl("/inicio", { ...current, empresa, presenter: "1" }))`. Preserves existing date filters.                                                                          |
| `src/app/(protected)/clientes/page.tsx`                           | Server Component composition: parseFilters → fetch → deriveEmpresasIndex → summarizeEmpresasIndex → render KPIs + Table         | VERIFIED   | 103 lines. `dynamic = "force-dynamic"`. Reads searchParams (Promise per Next 16). Inline Card error fallback for Sheets failure. Two leaves wired. Cliente-list IGNORES `filters.empresa` by design.                  |
| `src/app/(protected)/clientes/[empresaId]/page.tsx`               | Dynamic Server Component composition: parseFilters → decodeURIComponent → parallel fetch → findEmpresa → aggregateMonthlyActivity → narrow mini-cards → render | VERIFIED   | 228 lines. `dynamic = "force-dynamic"`. `params` + `searchParams` are Promises (Next 16 dynamic-route signature). Decodes `$mario` etc. from path. `Promise.all` parallel fetch (transactions + payouts). `findEmpresa → null` → "Empresa no encontrada" Card with link back. `asOf = filters.to ?? new Date()` for 12-month rolling window. Transaction-ID join for payouts (mirrors `/payouts/page.tsx`). `data-presenter-hide` on the button wrapper. |
| Custom domain `dashboard.tikin.co` (or chosen alternative)        | DNS + Vercel custom domain configured; HTTPS working                                                                           | DEFERRED   | Plan 05-05 not executed. `vercel.json` has no domain config; no `tikin.co` references in `src/`. Live URL is the Vercel default. INFRA-04 open. **Status by design — user explicitly deferred.**                       |

### Key Link Verification

| From                                  | To                                          | Via                                                                                                          | Status   | Details                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clientes/page.tsx`                   | `clientes.ts` aggregations                  | `deriveEmpresasIndex(txResult.rows, filters)` + `summarizeEmpresasIndex(rows)`                               | WIRED    | Imports + calls confirmed at lines 52-53, 94-95.                                                                                                                                                                                                                                                                                   |
| `clientes/page.tsx`                   | `ClientesKPICards` + `ClientesTable`        | JSX `<ClientesKPICards summary={summary} />` + `<ClientesTable rows={rows} />`                               | WIRED    | Lines 99-100. Both leaves rendered with the aggregated data.                                                                                                                                                                                                                                                                       |
| `[empresaId]/page.tsx`                | `clientes.ts` aggregations                  | `findEmpresa(allTx, empresaId, filters)` + `aggregateMonthlyActivity(allTx, empresaId, asOf)`                | WIRED    | Lines 86-87 imports, 152 + 177 calls. Profile narrowing via `empresaFilters` (line 123) for mini-cards.                                                                                                                                                                                                                            |
| `[empresaId]/page.tsx`                | Phase 2/3/4 domain functions                | `filterBonos+summarizeBonos`, `filterRecargas+summarizeRecargas`, `filterPayouts+summarizePayouts`           | WIRED    | Lines 84, 89, 90 imports. Lines 180-195 calls. Payouts join via `txMap` (lines 186-190) backfills `empresa_id`.                                                                                                                                                                                                                    |
| `ClientesTable` row link              | `/clientes/[empresaId]`                     | `<Link href={buildUrl("/clientes/${encodeURIComponent(r.empresa_id)}", linkFilters)}>`                       | WIRED    | Lines 227-235. `linkFilters` strips `empresa` (line 90) so click navigates to THIS empresa, not the prior one. `encodeURIComponent` for `$` in tikintags.                                                                                                                                                                          |
| `GenerarVistaClienteButton`           | `/inicio` with empresa + presenter          | `router.push(buildUrl("/inicio", { ...current, empresa: empresaId, presenter: "1" }))`                       | WIRED    | Lines 38-44. Reads URL via `useSearchParams`, builds destination with all current filters + forced `empresa` + `presenter=1`.                                                                                                                                                                                                       |
| Inicio page                           | empresa-narrowed aggregations               | `filterCompletedIn(allTx, filters)` + `filterPayouts(payoutsResult.rows, filters)` (filters.empresa included) | WIRED    | `inicio/page.tsx:144,192`. Confirmed by Phase 4 verification; consumes `filters.empresa` from `parseFilters`.                                                                                                                                                                                                                      |
| `(protected)/layout.tsx`              | Modo Presentación CSS attributes            | `<PresenterFrame>` wrapping all children                                                                     | WIRED    | `layout.tsx:36`. `PresenterFrame` reads `useSearchParams` and writes `data-presenter` + `data-empresa-filter` to the outer div (`presenter-frame.tsx:46-49`). CSS in `globals.css:146-183` consumes the attributes to hide `data-presenter-hide` + `data-presenter-empresa-hide` elements (Comisión, Take rate, HechosCurados, EmpresasActivasChart Card). |
| `TabNav`                              | `/clientes` route                           | `{ href: "/clientes", label: "Clientes" }`                                                                   | WIRED    | `tab-nav.tsx:29`. Tab visible in chrome.                                                                                                                                                                                                                                                                                           |

### Requirements Coverage

| Requirement | Status      | Blocking Issue                                                                                                                       |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| CLI-01      | SATISFIED   | Tabla de empresas con nombre + última actividad + $ histórico + $ período renderizada en `ClientesTable` con datos de `deriveEmpresasIndex`. |
| CLI-02      | SATISFIED   | 6 columnas con sort toggleable; default `montoHistorico` DESC; `Intl.Collator` para sort natural por nombre.                         |
| CLI-03      | SATISFIED   | `<Input type="search">` filtra por substring case-insensitive sobre `empresa_nombre`.                                                |
| CLI-04      | SATISFIED   | `ClientesKPICards` renderiza Total empresas + Empresas activas via `summarizeEmpresasIndex`.                                          |
| CLI-05      | SATISFIED   | `EmpresaProfileHeader` renderiza nombre + status badge + última actividad + 4 KPIs.                                                  |
| CLI-06      | SATISFIED   | `EmpresaActivityChart` con recharts `BarChart` sobre `aggregateMonthlyActivity` (12 buckets zero-filled).                            |
| CLI-07      | SATISFIED   | `EmpresaMiniCards` con 3 cards (Bonos/Recargas/Payouts) usando filterX+summarizeX de Phase 2/3/4 narrowed por `empresaFilters`.       |
| CLI-08      | SATISFIED   | `GenerarVistaClienteButton` navega a `/inicio?empresa=<id>&presenter=1`. PresenterFrame + CSS cierran el flujo end-to-end.            |
| INFRA-04    | DEFERRED    | Plan 05-05 deferred by user. Custom domain pending; cliente-flow live on `https://project-dashboard-z0fpsm5hl.vercel.app`.            |

### Anti-Patterns Found

| File                                          | Line  | Pattern                            | Severity | Impact                                                                                                                          |
| --------------------------------------------- | ----- | ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/clientes/ClientesTable.tsx`   | 144   | `placeholder="Buscar empresa…"`    | Info     | Legitimate HTML attribute on `<Input type="search">` — user-facing hint text, NOT a code stub. Not actionable.                 |

No blocker anti-patterns. No `TODO`/`FIXME`/`not implemented`/empty returns/console.log stubs in the Phase 5 surface area.

### Human Verification Required

#### 1. End-to-end cliente-flow on production

**Test:**
1. Navigate to `https://project-dashboard-z0fpsm5hl.vercel.app/clientes`
2. Confirm 2 KPI cards on top (Total empresas + Empresas activas) with non-zero counts
3. Confirm sortable + searchable empresa table renders rows
4. Click any row → `/clientes/[empresaId]` profile loads with header, 12-month chart, 3 mini-cards
5. Click "Generar vista para cliente" → lands on `/inicio?empresa=$X&presenter=1`
6. On `/inicio` (presenter ON): Comisión + Take rate cards hidden, HechosCurados hidden, EmpresasActivasChart Card hidden, GMV chart visible, KPIs narrowed to that empresa

**Expected:** All 6 steps complete without errors; cliente-foco view shows only what a cliente should see.
**Why human:** Live data + real Sheets fetch + browser CSS rendering can only be confirmed through user interaction.

#### 2. INFRA-04 deferral confirmation

**Test:** Confirm that the custom-domain decision is still pending and that re-opening Plan 05-05 is the right next step when the user is ready.

**Expected:** User acknowledges the deferral and decides whether to:
- Re-open Plan 05-05 now (pick domain + configure DNS + Vercel)
- Keep deferred until further stability validation
- Drop the requirement (close INFRA-04 with rationale)

**Why human:** DNS / Vercel domain configuration is an out-of-codebase infra task; the verifier cannot pick a domain or configure DNS.

### Gaps Summary

**No code gaps.** All 4 implementation plans (05-01..05-04) shipped substantive, correctly-wired code. The fifth criterion (custom domain) is a planning-level deferral, not a missing implementation:

- Code: 9 artifacts, 1,529 lines total, all imported and used.
- Wiring: 9 key links verified (page → domain → leaves; row links; button → /inicio; Inicio narrowing; PresenterFrame).
- Requirements: 8/9 SATISFIED, 1 DEFERRED by user.
- Anti-patterns: only one `placeholder` hit which is a legitimate HTML attribute.

**Action pending:** User confirms (a) the cliente-flow works as expected on the Vercel URL, and (b) when to re-open Plan 05-05 for INFRA-04. Phase 5 cannot be marked fully complete in ROADMAP until INFRA-04 is either shipped or formally dropped — but the cliente-facing functionality of Phase 5 is production-ready today.

---

_Verified: 2026-05-06T20:15:00Z_
_Verifier: Claude (gsd-verifier)_
