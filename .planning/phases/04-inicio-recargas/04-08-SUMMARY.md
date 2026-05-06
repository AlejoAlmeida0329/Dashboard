---
phase: 04-inicio-recargas
plan: 08
subsystem: page-composition
tags: [react-server-component, page-composition, dual-period-filter, cliente-foco, hechos-curados, sheets-cache, vercel-prod-deploy, phase-4-ships]

# Dependency graph
requires:
  - phase: 04-inicio-recargas
    provides: filterRecargas + summarizeRecargas + 3 aggregations + 2 hechos curados (Plan 04-03)
  - phase: 04-inicio-recargas
    provides: data-presenter-empresa-hide CSS gate + PresenterFrame wrapper (Plan 04-04)
  - phase: 04-inicio-recargas
    provides: 4 visual leaves — RecargasKPICards, RecargasTrendChart, RecargasTable, HechosCuradosRecargas (Plan 04-06)
  - phase: 02-bonos
    provides: page composition skeleton (mirrored line-for-line); getCachedTransactions + DashboardHeader pattern
  - phase: 04-inicio-recargas
    provides: dual-period filter + computePriorPeriod pattern (Plan 04-07; Recargas v1 uses it for the 2-KPI deltas)
provides:
  - Live `/recargas` page rendering BD_Plataforma data filtered to RECHARGE_TIPOS: 2 KPIs with deltas, 1 trend chart, top-10 empresas table, 2 hechos curados, all filters working, cliente-foco contract end-to-end
  - Phase 4 SHIPS — both `/inicio` and `/recargas` live in production at `https://project-dashboard-4b4fxxmdr.vercel.app` (deployment `dpl_8GprZ3cAoemQCczDTRRLeqy4WNqS`)
affects:
  - Phase 5 CLI-07 (mini-resumen 3 cards Bonos/Recargas/Payouts) — now points to a populated `/recargas` page rather than the Phase 1 placeholder
  - Phase 5 CLI-08 ("Generar vista para cliente") — already unblocked by Plan 04-07 cliente-foco verification on `/inicio`; this plan adds Recargas as the second tab where the share-URL lands cleanly

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-period filter pattern reused from Plan 04-07 verbatim. `currentRecargas = filterRecargas(allTx, filters)` + `priorRecargas = filterRecargas(allTx, {...filters, from: priorWindow.from, to: priorWindow.to})` over the SAME unfiltered `allTx`. ONE Sheets read, second window derived in-memory. computePriorPeriod returns null when filter is unbounded → priorRecargas null → KPI badges em-dash via pctChange."
    - "Page emits ZERO `data-presenter-*hide` attributes — visibility delegation 100% to leaves. Recargas has no Comisión / Take rate equivalent (no Tikin-internal-only KPI), so the page itself adds NO `data-presenter-hide`; HechosCuradosRecargas wrapper carries its own `data-presenter-empresa-hide` per Plan 04-06. Page-side grep on visibility attributes returns 0 hits in JSX (the only match is in JSDoc, which is a comment). Different chrome ownership pattern than `/inicio` (which page-wraps EmpresasActivasChart in a presenter-empresa-hide Card)."
    - "Mirror of `/inicio` skeleton minus complications. Removed: payouts cross-fetch (no latencia hecho), bucket-granularity switch (RecargasTrendChart from Plan 04-06 is daily-only), 3rd hecho curado, presenter-only KPIs. Kept: dual-period filter, inline error fallback, empty-state delegation to leaves, NO verifySession (route group layout already guards), `dynamic = 'force-dynamic'`."
    - "Single Sheets fetch (no Promise.all). Recargas needs only BD_Plataforma — BD_Payouts has no recarga-related data. Sequential await is the simplest correct shape. Pattern reusable for any future single-tab page (Phase 5 may have similar shapes)."

key-files:
  created:
    - .planning/phases/04-inicio-recargas/04-08-SUMMARY.md
  modified:
    - src/app/(protected)/recargas/page.tsx (Phase 1 placeholder Card → 175 LOC full composition; commit 559bc9b)

key-decisions:
  - "`?presenter=1` (presenter alone, no empresa) behaves IDENTICAL to default on `/recargas`. Recargas has only 2 KPIs (`Total $ recargado`, `# transacciones`) — both are pure volume metrics, neither is Tikin-internal-only. There's no Comisión/Take rate equivalent to hide. The page emits zero `data-presenter-hide` attributes; the leaves emit zero too. Modo Presentación on Recargas is a typography/chrome bump only (handled by the global PresenterFrame), not a visibility flip. Cliente-foco state (`?presenter=1&empresa=$X`) hides ONLY HechosCuradosRecargas."
  - "Cliente sees their own table row (no presenter-empresa-hide on RecargasTable). Per CONTEXT.md cliente-foco definition: 'show the cliente what's about THEM'. The empresa-filtered top-10 table will show Mario's row only (or an empty-state if no recargas). Hiding it would deprive the cliente of their own number — defeats the share-URL story."
  - "RecargasTrendChart does NOT degenerate to flat line under empresa filter. Unlike EmpresasActivasChart on `/inicio` (which becomes y=1 horizontal line when filtered to one empresa), the recargas trend keeps its bar-height variability — each day has a count of recargas FOR that empresa, not a 'distinct empresas active that day' count. Net: NO page-level Card wrap with `data-presenter-empresa-hide` needed (unlike Plan 04-07 EmpresasActivasChart). Chart stays visible in cliente-foco — desired."
  - "Single sequential `await getCachedTransactions()` (no Promise.all). The two-tab parallel fetch from Plan 04-07 was justified by needing both BD_Plataforma and BD_Payouts; Recargas only reads BD_Plataforma. React `cache()` already dedupes the call with DashboardHeader. Sequential await is the simplest shape that's correct."
  - "2 KPIs (not 3 or 4). Plan-author scoped tightly to REC-01 (Total $ recargado) + REC-02 (# transacciones). REC-V2-01 (success rate) is v2 because the `status='completed'` filter is already inside `filterRecargas`'s default contract — adding a denominator KPI requires `filterRecargasByPeriodOnly` (state-unfiltered) sibling helper, not v1 scope. Decision deferred consistently with Phase 3 PAY-V2-01 (Payouts success rate) and Phase 5 scope."
  - "No `verifySession()` call (mirror of bonos / payouts / inicio pages). The `(protected)` route group layout from Plan 01-04 already guards the entire subtree (and the proxy gate from 01-01 catches it earlier)."
  - "Inline `<Card>` error fallback on Sheets fetch failure (mirror of bonos / payouts / inicio). Try/catch around `getCachedTransactions()` returns a `<Card>` with `err.message` rather than relying on the route group's `error.tsx` boundary."

patterns-established:
  - "Page-composition plan in Phase 5+ that mirrors a SINGLE-tab fetch (no payouts join, no cross-tab enrichment) follows this 04-08 skeleton: parseFilters → optional computePriorPeriod → single sequential `await getCachedTransactions()` → `filter*` once or twice → aggregations + hechos → JSX render of typed leaves. No Promise.all needed."
  - "When the page-leaf system has NO presenter-only KPI on a given tab, the page emits zero `data-presenter-*hide` attributes — visibility flips happen entirely inside leaves. Recargas page is the canonical example. `/payouts` is a similar shape but page wraps LatencyHistogram in a Card without presenter attribute (chart stays visible). Pattern: only emit page-level visibility attributes when the editorial-block boundary is OUTSIDE any leaf's chrome ownership."

# Metrics
duration: ~30m active (Task 1 implementation by background agent ~15 min on 2026-05-05; checkpoint pause + user verification ~24h calendar; SUMMARY + STATE.md update + Vercel prod deploy + metadata commit ~5 min orchestrator-direct on 2026-05-06)
completed: 2026-05-06
---

# Phase 4 Plan 08: Recargas Page Composition Summary

**Replaces the Phase 1 placeholder at `/recargas` with the live page: 2 KPIs with deltas (Total $ recargado, # transacciones), 1 trend bar chart, top-10 empresas table, 2 hechos curados (top empresa recargadora, recarga más grande). Cliente-foco contract verified end-to-end across all 4 URL states. Phase 4 SHIPS — both `/inicio` and `/recargas` live in production.**

## Performance

- **Duration:** ~30m active. Task 1 (page rewrite) ran ~15 min via background agent on 2026-05-05; checkpoint paused for human verification (~24h calendar pause); SUMMARY + STATE.md update + Vercel prod deploy + metadata commit ~5 min orchestrator-direct on 2026-05-06.
- **Tasks:** 1 implementation (Task 1) + 1 checkpoint (Task 2 — approved) + 1 deploy (Task 3 — shipped both `/inicio` and `/recargas` together as the Phase 4 user-facing pair).
- **Files created:** 1 (this SUMMARY).
- **Files modified:** 1 (page.tsx; commit 559bc9b on 2026-05-05).
- **Final page.tsx:** 175 LOC (vs ~37 LOC Phase 1 placeholder).

## Commits

- `559bc9b` `feat(04-08): replace recargas/page.tsx with full composition` — Task 1, the only code commit. Wires RecargasKPICards + RecargasTrendChart + RecargasTable + HechosCuradosRecargas from Plan 04-06; dual-period filter; inline error fallback. Single sequential Sheets fetch (no Promise.all needed for single-tab data).
- `(metadata)` `docs(04-08): complete recargas page composition plan` — final metadata commit (this SUMMARY + STATE.md update).

## Verification (all green)

- `npx tsc --noEmit` → clean (silent success at end of Task 1).
- `npm run build` → ✓ Compiled successfully (Next 16.2.4 Turbopack), all routes emitted, `/recargas` now `ƒ` (Dynamic) with full composition.
- `grep -c "filterRecargas" src/app/(protected)/recargas/page.tsx` → 4 (1 in JSDoc + 1 import + 2 actual calls — current + prior period). The plan's verify check `=== 2` referred to **call sites**; total grep including import + JSDoc reads as 4.
- `grep -cE "data-presenter-hide|data-presenter-empresa-hide" src/app/(protected)/recargas/page.tsx` → 1 (JSDoc reference on line 33; **zero JSX attribute emissions** — the must_have "page itself adds NO visibility attributes" is satisfied; leaves carry their own).
- `dynamic = "force-dynamic"` present (line 87).
- 4 cliente-foco URL states verified manually by user (response: "approved"):
  1. `/recargas` (no filters): 2 KPIs + trend chart + top-10 table + 2 hechos curados visible.
  2. `?presenter=1`: identical to default (no Tikin-internal KPI to hide); chrome-only flip via global PresenterFrame.
  3. `?empresa=$X`: 2 KPIs filtered to that empresa's recargas; chart filtered; table shows just that empresa's row (or empty); 2 hechos curados show empresa-related (top empresa = $X; recarga más grande from $X's recargas).
  4. `?presenter=1&empresa=$X` (CLIENTE-FOCO): 2 KPIs visible, chart visible, table visible (cliente sees their own row — desired), **2 hechos curados HIDDEN** (HechosCuradosRecargas wrapper carries `data-presenter-empresa-hide`).
- Empty state (`?from=2026-12-01&to=2026-12-31`): KPIs render `$ 0` / `0`, chart shows "Sin datos suficientes para tendencia. Ampliá el período.", table shows empty-state copy, hechos render their per-card empty messages. No crash.
- No regression on `/bonos`, `/payouts`, `/inicio`, `/clientes` — all render as before.
- **Production deploy:** `vercel --prod` → `https://project-dashboard-4b4fxxmdr.vercel.app` (deployment id `dpl_8GprZ3cAoemQCczDTRRLeqy4WNqS`, alias `https://project-kr6et.vercel.app`, region iad1). `vercel ls` confirms `● Ready Production`. Curl smoke: `/login` HTTP 200; `/recargas` HTTP 307 redirect to `/login` (proxy gate intact). Supersedes the previous Phase 3 production at `https://project-dashboard-allec5r4i.vercel.app` (which kept `/inicio` and `/recargas` as Phase 1 placeholders).

## Deliverables in HEAD

- `src/app/(protected)/recargas/page.tsx` — 175 LOC. Server Component. Pipeline: `parseFilters` → `computePriorPeriod` → single sequential `await getCachedTransactions()` (no Promise.all — single-tab data) → `filterRecargas` twice (current + prior over same allTx) → `summarizeRecargas` twice → `aggregateRecargasByDate` → `aggregateRecargasByEmpresa` + `top10RecargasEmpresas` → 2 hechos curados (`findTopEmpresaRecargadora`, `findRecargaMasGrande`) → JSX render. Top-level JSDoc (~60 lines) documents the pipeline + dual-period reuse + cliente-foco delegation + empty-state convention + error handling + why simpler than `/inicio`.

## Deviations

**0 plan-spec deviations on Task 1.** Plan executed as written; the literal code blocks from `<action>` compiled clean on first build, the 6 verify checks all green, the 4-URL cliente-foco contract held on first manual verification.

**Operational note (not a deviation):** Task 3 (Vercel `--prod` deploy) executed at plan close on 2026-05-06 rather than the moment Task 1 landed on 2026-05-05. Reason: Plan 04-07 deferred its own Task 3 with explicit "batch with Plan 04-08" rationale — Phase 4 ships `/inicio` + `/recargas` together as the user-facing pair. This single deploy supersedes both Phase 1 placeholders simultaneously, matching CONTEXT.md vision "Phase 4 closes when both hero tabs are live." Vercel CLI was found at `/Users/alejoalmeida/.nvm/versions/node/v24.11.0/bin/vercel` (not on default PATH; required explicit PATH export). Deploy ran clean in ~2 min; build artifacts include all 8 routes (`/login`, `/logout`, `/inicio`, `/bonos`, `/payouts`, `/recargas`, `/clientes`, `/api/smoke`). Auth as `alejandro-9264` carried over from previous Phase 3 deploy session.

## Phase 4 Ships

Phase 4 (Inicio + Recargas) is now COMPLETE. Both hero tabs ship together at `https://project-dashboard-4b4fxxmdr.vercel.app`:
- `/inicio` — 5 KPIs with deltas (GMV / Comisión / Take rate / Empresas activas / Bonos vendidos), GMV trend + Empresas activas charts (bucket-aware at 60-day threshold), 3 hechos curados (top empresa GMV / latencia destacada / empresas nuevas activadas), full cliente-foco contract (Plan 04-07).
- `/recargas` — 2 KPIs with deltas (Total $ recargado / # transacciones), trend bar chart, top-10 empresas table, 2 hechos curados (top empresa recargadora / recarga más grande), cliente-foco delegated to leaves (this plan).

Phase 5 (Clientes + Domain) is the next milestone:
- CLI-07 (mini-resumen 3 cards Bonos/Recargas/Payouts) now points to a populated `/recargas` page (Phase 1 placeholder dissolved).
- CLI-08 ("Generar vista para cliente") already unblocked by Plan 04-07 cliente-foco verification on `/inicio`; this plan adds `/recargas` as the second tab where the share-URL lands cleanly.

The orchestrator should next: (a) run gsd-verifier on Phase 4, (b) update ROADMAP.md to mark Phase 4 ✅ Complete.
