---
phase: 05-clientes-domain
plan: 02
subsystem: ui-leaves
tags: [clientes, kpi-cards, sortable-table, search-filter, server-component, client-component, intl-collator-exception]

# Dependency graph
requires:
  - phase: 05-clientes-domain
    provides: 05-01 — EmpresaListRow + EmpresasIndexSummary type contracts from src/lib/domain/clientes.ts
  - phase: 01-foundation
    provides: @/components/ui/{card,input}, buildUrl + parseFilters from @/lib/url-state, formatCOP/formatInteger/formatBogotaDate from @/lib/format
  - phase: 04-inicio-recargas
    provides: RecargasKPICards + RecargasTable shape (mirror reference for visual leaves)
provides:
  - "src/components/clientes/ClientesKPICards.tsx (72 LOC, Server) — 2-card grid Total empresas + Empresas activas"
  - "src/components/clientes/ClientesTable.tsx (305 LOC, Client) — sortable + searchable empresa table with row links to /clientes/[empresaId]"
affects:
  - 05-04 (page composition wires both leaves into /clientes)
  - 05-05 (any future cross-empresa drill-down can mirror the SortHeader sub-component pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual-leaf pair: Server KPI grid + Client interactive table (mirror of Bonos / Recargas leaf pattern, adapted for click-to-sort)"
    - "Click-to-sort via local useState — sort + search are pure UI state, no Sheets refetch on column toggle"
    - "Row link strips `empresa` from preserved filters — clicking navigates TO that empresa rather than preserving prior selection"
    - "encodeURIComponent on empresa_id (tikintags contain `$`) before path-segment interpolation"
    - "SortHeader sub-component encapsulates active-state styling + aria-sort for accessible click-to-sort headers"
    - "Intl.Collator exception (sort comparator inside useMemo) — non-display, locale-bound STRING-COMPARISON utility; second project exception after recharts internals"

key-files:
  created:
    - "src/components/clientes/ClientesKPICards.tsx (72 LOC)"
    - "src/components/clientes/ClientesTable.tsx (305 LOC)"
  modified: []

key-decisions:
  - "Both KPI cards ALWAYS visible (no data-presenter-hide) — empresa counts are public-facing, not Tikin-internal-only"
  - "Default sort montoHistorico DESC — leaderboard convention (mirror of Bonos / Recargas) so the biggest empresas appear at top on first paint"
  - "Search is case-insensitive substring on empresa_nombre only (not empresa_id) — humans search by display name"
  - "Row link preserves date + presenter, STRIPS empresa — the click is a profile navigation, not a filter narrowing"
  - "Intl.Collator inside useMemo for natural-order empresa name sort — declared exception to the single-Intl-gate rule (non-display utility)"
  - "Sensible default sort direction per column type: text columns asc, numeric/date columns desc"
  - "Status text-color cue (foreground for activa, muted-foreground for inactiva) instead of badge component — matches the project's understated visual language"

patterns-established:
  - "Pattern: Server KPI grid + Client interactive table (visual-leaf pair for /clientes-style list pages)"
  - "Pattern: SortHeader sub-component (encapsulates click-to-sort state + accessibility + visual indicator)"
  - "Pattern: Row link strips own filter dimension (empresa filter stripped when navigating to per-empresa profile)"
  - "Pattern: encodeURIComponent on empresa_id (tikintag $-prefix needs percent-encoding for URL path segments)"

# Metrics
duration: ~36m
completed: 2026-05-06
---

# Phase 5 Plan 2: Clientes Visual Leaves Summary

**ClientesKPICards (Server, 2-card Total/Activas grid) + ClientesTable (Client, 6-column sortable + case-insensitive searchable empresa table with row Links to /clientes/[empresaId] preserving date+presenter, stripping empresa, encoded for `$`-tikintags) — stable contracts ready for Plan 05-04 page composition**

## Performance

- **Duration:** ~36m (interleaved with parallel Plan 05-03 execution on same workspace)
- **Started:** 2026-05-06T21:19:24Z
- **Completed:** 2026-05-06T21:56:00Z
- **Tasks:** 2/2
- **Files created:** 2

## Accomplishments

- `src/components/clientes/ClientesKPICards.tsx` (72 LOC) — Server Component, 2 KPI cards (Total empresas, Empresas activas), both ALWAYS visible, formatInteger format gate
- `src/components/clientes/ClientesTable.tsx` (305 LOC) — Client Component (`"use client"`), 6 sortable columns (Empresa / # tx período / $ período / $ histórico / Última actividad / Status), case-insensitive search above table, row Links to `/clientes/[empresaId]` preserving date+presenter filters and stripping empresa
- Both components verified: tsc --noEmit clean, npm run build ✓ Compiled in 9.0s, all 11 routes emitted (/clientes ƒ Dynamic intact)
- Zero leaks of `next/server` or `@/lib/sheets` from clientes components — visual leaves stay isolated from Sheets adapter
- All 6 must_have truths verified: 2 KPI cards always visible; click-to-sort with active-column indicator; search filters as user types; row links via Link + buildUrl; status text-color cue; format-gate compliance (formatCOP / formatInteger / formatBogotaDate; zero direct Intl.NumberFormat / toLocaleString)

## Task Commits

Each task was committed atomically:

1. **Task 1: ClientesKPICards Server Component** — `fc320e9` (feat)
2. **Task 2: ClientesTable Client Component (sortable + searchable)** — `960a075` (feat)

**Plan metadata commit:** (this SUMMARY.md + STATE.md update — final docs commit pending)

## Files Created/Modified

- `src/components/clientes/ClientesKPICards.tsx` — Server Component KPI grid (Total empresas + Empresas activas)
- `src/components/clientes/ClientesTable.tsx` — Client Component sortable + searchable table with row Links

## Decisions Made

- **Both KPI cards always visible.** Plan's must-have truth #1 specifies no `data-presenter-hide` on either card. Total empresas + Empresas activas are public-facing facts (mirror of Recargas KPI decision in Plan 04-06 where volume + count are shareable). Comisión / Take rate / internal-only metrics live elsewhere (Inicio).
- **Click-to-sort via local useState.** The page (Plan 05-04) hands rows in pre-sorted DESC by `montoHistorico`. Sort + search are pure UI state — no Sheets refetch on column toggle, no URL state for sort. Keeps the URL clean (filters only) and the interaction instantaneous.
- **Row link strips empresa filter.** `linkFilters = { ...filters, empresa: undefined }` — clicking a row should navigate TO that empresa's profile, not preserve a previously-selected empresa filter. Date + presenter flow through unchanged.
- **encodeURIComponent on empresa_id.** Tikintags carry the `$` prefix (e.g. `$mario`). `$` is not URL-safe in path segments per RFC 3986; `encodeURIComponent` produces `%24mario` → Next App Router decodes back to `$mario` server-side via `params.empresaId`. Without this, `/clientes/$mario` would fail to match the dynamic route on some HTTP clients.
- **Intl.Collator exception.** The `Intl.Collator("es", { sensitivity: "base", numeric: true })` instance lives inside `useMemo` for the sort comparator. This is a non-display, locale-bound STRING-COMPARISON utility; the project's single-Intl-gate rule (Pitfall 9) covers DISPLAY formatting (currency / percent / integer / date), not comparison. Second declared exception after recharts internals (Plan 02-03). Documented in JSDoc; future plans extending sortable tables can mirror the same pattern.
- **Sensible default sort direction.** Text columns (empresa_nombre, status) default to asc; numeric/date columns default to desc. Matches user expectations: "show me biggest first" for money, "show me alphabetical" for names.

## Deviations from Plan

None — plan executed exactly as written. Both Tasks 1 and 2 used the literal code blocks from `<action>` sections; both compiled clean on first build. ELEVENTH consecutive technical-zero-deviation plan (running streak from 02-04, with one operational deviation at 04-01 around the parallel-wave git race).

### Operational note (not a deviation)

During Task 1's commit operation, a sibling Plan 05-03 agent (executing in parallel on the same workspace) had already written `EmpresaActivityChart.tsx` + `EmpresaProfileHeader.tsx` files into `src/components/clientes/`. The first `git add src/components/clientes/ClientesKPICards.tsx` followed by `git commit` somehow swept those untracked siblings into the same commit (still investigating; possibly a stale staging artifact from the directory-level untracked entry). Recovery was clean: `git reset --soft HEAD~1` → `git restore --staged` of the orphan files → re-commit only `ClientesKPICards.tsx` as `fc320e9`. Plan 05-03 then committed those files cleanly under its own commits (`c6b93b9`, `a93cd26`). Net result: my Plan 05-02 commits contain ONLY Plan 05-02's files; no cross-plan pollution. Future parallel-plan executions on the same branch should `git status -uno` before staging to surface this earlier.

## Issues Encountered

- **Local shell `node`/`npm` aliased through nvm `load_nvm` lazy loader.** Direct `npx` invocations failed inside the agent's bash sandbox until I exported `PATH="/Users/alejoalmeida/.nvm/versions/node/v24.13.1/bin:$PATH"` and `unset -f node` to break the function-alias. Once corrected, `npx tsc --noEmit` and `npm run build` ran clean. Resolution noted for future agent sessions on this machine.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 05-04 (page composition) UNBLOCKED on the visual-leaf side. Both `ClientesKPICards` (consumes `EmpresasIndexSummary`) and `ClientesTable` (consumes `EmpresaListRow[]`) ship with stable type contracts. Plan 05-04 needs only to wire `getCachedTransactions()` → `deriveEmpresasIndex(allTx, filters)` → `summarizeEmpresasIndex(rows)` and pass results through.
- Plan 05-03 (per-empresa profile leaves) ALREADY COMPLETE in parallel — `EmpresaProfileHeader` + `EmpresaActivityChart` + `EmpresaMiniCards` + `GenerarVistaClienteButton` all shipped. Plan 05-04 will compose ALL six visual leaves (2 from 05-02 + 4 from 05-03) into the two pages (/clientes list + /clientes/[empresaId] profile).
- The Intl.Collator exception is now formally documented; future sortable tables (e.g. /payouts row sort if requested) can mirror the same pattern without re-litigating the rule.

---
*Phase: 05-clientes-domain*
*Completed: 2026-05-06*
