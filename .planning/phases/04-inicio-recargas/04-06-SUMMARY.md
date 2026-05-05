---
phase: 04-inicio-recargas
plan: 06
subsystem: ui
tags: [react-server-components, react-client-component, recharts, presenter-mode, cliente-foco, kpi-cards, recargas, cross-feature-reuse]

# Dependency graph
requires:
  - phase: 04-inicio-recargas
    provides: RecargaSummary, RecargaByDate, RecargaByEmpresa output types (Plan 04-03)
  - phase: 04-inicio-recargas
    provides: data-presenter-empresa-hide CSS gate (Plan 04-04)
  - phase: 04-inicio-recargas
    provides: DeltaBadge atom (Plan 04-05) — REUSED, NOT duplicated
  - phase: 02-bonos
    provides: SalesTable shape conventions (mirrored line-for-line for top-10 table)
  - phase: 02-bonos
    provides: BonosChart visual conventions (currentColor + tabular-nums)
provides:
  - RecargasKPICards (Server Component) — 2-card grid (montoTotal + count) with delta
  - RecargasTrendChart (Client Component) — Recharts BarChart, daily-only, dataKey="monto"
  - RecargasTable (Server Component) — top 10 empresas, 4 columns, no presenter-hide
  - HechosCuradosRecargas (Server Component) — 2-card editorial reel with cliente-foco hide
affects:
  - 04-08 (Recargas page composition consumes all 4 components)
  - Establishes DeltaBadge as the single delta atom (Inicio + Recargas both consume from inicio/)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-feature atom reuse: DeltaBadge lives in src/components/inicio/ and is imported from there by Recargas. Single source of truth for the delta primitive — NOT promoted to a shared/ui/ directory because there's only one consumer outside its origin (Plan 04-06). If a third consumer appears, promote then."
    - "Daily-only trend chart for the non-héroe pestaña. RecargasTrendChart drops the granularity prop entirely — no week branch in tickFormatter — per 04-CONTEXT.md 'Recargas no es héroe, basta con monto + count'."
    - "No internal-only column in Recargas table. Mirror of SalesTable shape but ZERO data-presenter-hide attributes — Recargas has no Comisión/Take rate column to hide; the full table is fine in cliente-foco for the cliente's own data."
    - "Empty-state copy is first-class. Each section handles its own empty case: table 'Sin recargas en el período' (centered, py-8); HechosCurados 'Sin recargas en el período' per card."

key-files:
  created:
    - src/components/recargas/RecargasKPICards.tsx (75 LOC)
    - src/components/recargas/RecargasTrendChart.tsx (96 LOC)
    - src/components/recargas/RecargasTable.tsx (90 LOC)
    - src/components/recargas/HechosCuradosRecargas.tsx (104 LOC)
  modified: []

key-decisions:
  - "DeltaBadge is REUSED from `@/components/inicio/DeltaBadge`, NOT duplicated. Plan 04-06 explicitly forbids creating a Recargas-local copy. The atom stays in inicio/ (its birthplace, Plan 04-05) because there are exactly two consumers — promotion to a shared dir would be premature abstraction."
  - "RecargasTrendChart uses BarChart (matches GMVTrendChart visual treatment) with `dataKey=\"monto\"` (the recargas trend point shape is `{date, count, monto}`, not the generic `{bucket, value}`). Daily-only — granularity prop dropped entirely."
  - "RecargasTable mirrors SalesTable's structure but drops the presenter-hidden columns (Comisión, % del total in bonos). Recargas's '% del total' column stays VISIBLE in both presenter and internal views — it's a relative position within the cliente's own data, fair to share."
  - "HechosCuradosRecargas has 2 cards (vs HechosCurados' 3) per CONTEXT.md cut-priority: top empresa recargadora + recarga más grande. Both narrative angles, no inverted-delta latency angle (latency is Inicio's concern)."
  - "RecargasKPICards has NO data-presenter-hide on either card. Recargas doesn't expose internal-only KPIs — montoTotal + count are both fair-share metrics."

patterns-established:
  - "Cross-feature reuse pattern formalized: import atoms from their birth module via @-alias rather than promote to shared/ on first reuse. Promote only when there's a third consumer."
  - "Daily-only Recharts wrapper as a simpler sibling to the bucket-aware variant. Future non-héroe trend charts in Phase 5 can mirror RecargasTrendChart instead of GMVTrendChart."

# Metrics
duration: ~6m active (sequential execution after Wave 2 parallel-spawn timeouts on 04-05)
completed: 2026-05-05
---

# Phase 4 Plan 06: Recargas Visual Leaves Summary

**4 visual leaves for /recargas: RecargasKPICards (2 cards with delta), RecargasTrendChart (daily-only BarChart), RecargasTable (top 10 empresas, 4 cols), HechosCuradosRecargas (2-card editorial reel with cliente-foco hide). DeltaBadge reused from inicio/ — single delta atom for the project.**

## Performance

- **Duration:** ~6 min wall-clock (sequential single-agent execution after Wave 2 parallel-spawn approach kept timing out on 04-05).
- **Tasks:** 2
- **Files created:** 4
- **Files modified:** 0
- **Total LOC:** 365

## Commits

- `61bfabe` `feat(04-06): RecargasKPICards + RecargasTrendChart` — Task 1. KPICards reuses DeltaBadge from `@/components/inicio/DeltaBadge`; TrendChart is daily-only (no granularity prop).
- `c98f8c6` `feat(04-06): RecargasTable + HechosCuradosRecargas` — Task 2. Table is 4-column with no presenter-hide; HechosCurados outer wrapper carries `data-presenter-empresa-hide`.
- `(metadata)` `docs(04-06): complete recargas visual leaves plan` — final metadata commit (this SUMMARY + STATE.md).

## Verification (all green)

- `npx tsc --noEmit` → clean (silent success).
- `npm run build` → ✓ Compiled successfully in 9.0s, TS 7.5s, all 11 routes emitted, /recargas still `ƒ` (Dynamic, page composition is Plan 04-08).
- `grep -c "use client" src/components/recargas/{RecargasKPICards,RecargasTable,HechosCuradosRecargas}.tsx` → 0 (Server Components).
- `grep "use client" src/components/recargas/RecargasTrendChart.tsx` → 1 (Client Component for Recharts).
- `grep -c "data-presenter-hide" src/components/recargas/RecargasKPICards.tsx` → 0 (no internal-only KPI in Recargas).
- `grep -c "data-presenter-hide" src/components/recargas/RecargasTable.tsx` → 0 (no internal-only column in Recargas).
- `grep -c "data-presenter-empresa-hide" src/components/recargas/HechosCuradosRecargas.tsx` → 1 (outer wrapper only — semantic must_have satisfied).
- `grep -c "@/components/inicio/DeltaBadge" src/components/recargas/RecargasKPICards.tsx` → 1 (cross-feature reuse confirmed; no duplicate atom).
- No regression on existing /inicio, /bonos, /payouts routes — all still emit `ƒ` (Dynamic) in build output.

## Deliverables in HEAD

- `src/components/recargas/RecargasKPICards.tsx` — 75 LOC. Server Component. 2-card grid (`grid-cols-1 sm:grid-cols-2`). Cards: Total recargado / # de recargas. Each Card has DeltaBadge in CardContent. NO `data-presenter-hide`.
- `src/components/recargas/RecargasTrendChart.tsx` — 96 LOC. Client Component. Recharts `BarChart` 320px height. `stroke=fill="currentColor"`. `dataKey="monto"`, `dataKey="date"` on XAxis. Daily-only tickFormatter (`"2026-04-15"` → `"15/04"`). `minPointSize={2}` keeps zero-monto bars visible.
- `src/components/recargas/RecargasTable.tsx` — 90 LOC. Server Component. `<Card>` chrome with title "Top 10 empresas por recargas". 4 columns (Empresa, # recargas, $ recargado, % del total) — all always visible. Empty state: centered py-8 "Sin recargas en el período".
- `src/components/recargas/HechosCuradosRecargas.tsx` — 104 LOC. Server Component. Outer div with `data-presenter-empresa-hide`. 2-card grid (`md:grid-cols-2`): top empresa recargadora (monto + count subline) + recarga más grande (monto + empresa · fecha subline). Empty-state copy per card.

## Deviations

**0 plan-spec deviations.** Plan executed as written. Sequential execution chosen over Wave 2 parallel-spawn after 04-05's three consecutive stream timeouts — single-agent close ran ~6 min end-to-end with no retries needed.

## Stable contracts for Plan 04-08 (page composition)

- `RecargasKPICards` props: `summary: { current: RecargaSummary; prior: RecargaSummary | null }`.
- `RecargasTrendChart` props: `data: RecargaByDate[]`.
- `RecargasTable` props: `rows: RecargaByEmpresa[]` (caller `.slice(0, 10)` since component does NOT slice internally).
- `HechosCuradosRecargas` props: `topEmpresa: RecargaByEmpresa | null; recargaMasGrande: Transaction | null`.

## Patterns to Reuse (Phase 5+)

- **Cross-feature atom reuse via @-alias**, not premature promotion. Wait for 3 consumers before promoting to a shared dir.
- **Daily-only Recharts wrapper** as a simpler sibling to bucket-aware variants. Use when the chart's parent pestaña isn't the héroe.
- **No-presenter-hide tables** for cliente-facing relative metrics (% del total IS fair to show in cliente-foco when it's the cliente's own data).
