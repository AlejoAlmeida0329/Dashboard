---
phase: 06-foundation-v2
plan: 03
subsystem: filters
tags: [url-state, multi-select, dropdown, dashboard-header, react-server-components]

requires:
  - phase: 01-foundation
    provides: DashboardFilters base type, parseFilters/buildUrl helpers, EmpresaFilter pattern
  - phase: 06-foundation-v2
    provides: nothing yet — this is the first plan in 06 to land that touches url-state.ts
provides:
  - DashboardFilters.status (string[] — completed/failed/in_progress, CROSS-V2-01)
  - DashboardFilters.tipo (string[] — BONUS/PAYOUT_BANK/PURCHASE/P2P/PAYIN_PSE/PAYIN_TRANSFER/FEE/REFUND/CREDIT_ADJUSTMENT/TREASURY, CROSS-V2-02)
  - StatusFilter component (URL-driven multi-select dropdown)
  - TypeFilter component (URL-driven multi-select dropdown)
  - CSV serialization convention for multi-select URL params
affects:
  - 07-bonos-payouts
  - 08-tarjeta-recargas
  - 09-vista-cliente
  - 10-inicio-infra

tech-stack:
  added: []
  patterns:
    - "Multi-select URL state via CSV param (not repeated keys)"
    - "Native <details> + checkbox dropdown (zero-dep multi-select UI)"
    - "Hardcoded filter option lists decoupled from domain TransactionType union (UI labels are not domain concerns)"

key-files:
  created:
    - src/components/filters/status-filter.tsx
    - src/components/filters/type-filter.tsx
  modified:
    - src/lib/url-state.ts
    - src/components/layout/dashboard-header.tsx

key-decisions:
  - "CSV serialization for multi-select (?status=completed,failed) chosen over repeated keys (?status=completed&status=failed) for URL brevity, copy-pasteability, and human readability"
  - "Empty array omitted from URL — 'no filter applied' and 'absent key' are treated identically by parseFilters (single source of truth)"
  - "Filter option lists hardcoded in components, NOT imported from TransactionType union — UI labels (e.g. 'Compra (tarjeta)') are a UI concern; defensive fallbacks (UKNOWN, OTRO) are excluded from user-facing filter options"
  - "Native <details>/<summary> + checkbox markup over Base UI Popover or Combobox library — Phase 6 prioritizes foundation; UX polish deferred to Phase 7+ if usage shows it's needed"
  - "Stable URL ordering: from -> to -> empresa -> status -> tipo -> presenter (canonical for proxy cache + readable browser history diffs)"
  - "Phase 6 ships UI + URL contract only; domain functions (filterBonos, filterPayouts, etc.) NOT touched — each Phase 7+ section decides which filters to honor in its own data layer"

patterns-established:
  - "Multi-select filter pattern: client component reads URL via useSearchParams + parseFilters, mutates via buildUrl + router.push, no React state for the persistent value (only ephemeral UI like dropdown open/close if needed)"
  - "URL-state extension protocol: adding a new filter = (1) extend DashboardFilters type, (2) read in parseFilters, (3) write in buildUrl with stable position, (4) build the client-component dropdown that reads/writes via the helpers"
  - "Filter component contract: self-contained Client Component, no props (URL is the source of truth), styled to match h-8 rounded-lg neighbors in DashboardHeader"

duration: 4m 17s
completed: 2026-05-07
---

# Phase 06 Plan 03: Filtros globales de Estado y Tipo Summary

**Multi-select StatusFilter (completed/failed/in_progress) y TypeFilter (10 tipos de transacción) en el header, con persistencia en URL via CSV (?status=...,...&tipo=...,...) y zero deps añadidas.**

## Performance

- **Duration:** 4m 17s
- **Started:** 2026-05-07T16:40:57Z
- **Completed:** 2026-05-07T16:45:14Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `DashboardFilters` extendido con `status?: string[]` y `tipo?: string[]` — `parseFilters` y `buildUrl` manejan CSV serialization con stable ordering
- `StatusFilter` y `TypeFilter` (255 LOC combinados) listos para consumo en cualquier página — URL-driven, sin React state para el valor persistente
- `DashboardHeader` ahora renderiza 4 filtros: DateRange → Empresa → Estado → Tipo, todos dentro del mismo `data-presenter-hide` group (modo presentación los oculta automáticamente)
- Build + tsc + lint todos limpios; sin nuevos warnings introducidos
- Ningún domain function tocado — Phase 7+ pueden importar `filters.status` / `filters.tipo` y aplicarlos por-tab sin cambios de infraestructura

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DashboardFilters and URL helpers in url-state.ts** — `c33796c` (feat)
2. **Task 2: Create StatusFilter and TypeFilter client components** — `9ca6980` (feat)
3. **Task 3: Wire StatusFilter and TypeFilter into DashboardHeader** — `fcedb90` (feat)

## Files Created/Modified

- `src/lib/url-state.ts` — Extended `DashboardFilters` type with `status[]` + `tipo[]`; added `getCSV` helper; updated `parseFilters` and `buildUrl` to handle CSV multi-select serialization; updated JSDoc to document the convention
- `src/components/filters/status-filter.tsx` (NEW, 121 LOC) — Multi-select dropdown for transaction status. Hardcoded 3 options (completed/failed/in_progress). URL-driven via `parseFilters`/`buildUrl`. Native `<details>` collapsible + checkbox UI. Trigger label: "Estado" (none) / "Estado: Completed" (single) / "Estado: 2" (multi).
- `src/components/filters/type-filter.tsx` (NEW, 134 LOC) — Multi-select dropdown for transaction type. Hardcoded 10 options (BONUS, PAYOUT_BANK, PURCHASE, P2P, PAYIN_PSE, PAYIN_TRANSFER, FEE, REFUND, CREDIT_ADJUSTMENT, TREASURY) — excludes UKNOWN/OTRO defensive fallbacks. Same component contract as StatusFilter.
- `src/components/layout/dashboard-header.tsx` — Added imports + JSX renders for StatusFilter and TypeFilter inside the existing `data-presenter-hide` group, in order: DateRange → Empresa → Estado → Tipo. Header remains a Server Component; the new filters are self-contained Client Components reading URL state directly (no props).

## Decisions Made

- **CSV multi-select serialization** (`?status=completed,failed`) chosen over repeated keys (`?status=completed&status=failed`) — shorter URLs, easier to share/paste in Slack, more readable in browser history
- **Empty array → absent key** — `parseFilters` returns `undefined` for both `?status=` and missing param; `buildUrl` omits the key entirely when the array is empty. Single source of truth, no edge cases for downstream consumers
- **Hardcoded option lists** in components, decoupled from `TransactionType` union — UI labels ("Compra (tarjeta)", "Recarga PSE") are UI concerns, not domain concerns. Adding a new transaction type to the schema does NOT auto-pollute the dropdown — requires deliberate UI update. Defensive fallbacks (UKNOWN, OTRO) excluded from user-facing options
- **Native `<details>` + checkbox** over Base UI Popover or Combobox library — Phase 6 is foundation infrastructure, not UX polish. KEEP IT SIMPLE. If usage shows we need keyboard-friendly combobox semantics (typeahead, ARIA listbox), Phase 7+ can swap the trigger without changing the URL contract
- **Stable URL ordering** preserved: `from → to → empresa → status → tipo → presenter` — canonical URLs for proxy cache, readable diffs in browser history
- **Domain functions untouched** — `filterBonos`, `filterPayouts`, etc. NOT modified in this plan. Each Phase 7+ section will decide which filters to honor in its own data layer (Inicio shows global success rate; Bonos filters only BONUS rows; etc.)

## Deviations from Plan

None - plan executed exactly as written.

All three tasks landed with the verification criteria met as specified:

- Task 1: `grep "status?: string\[\]"` returns 1 (verified post-edit), tsc passes, JSDoc updated
- Task 2: Both files start with `"use client"`, both >50 LOC (121 + 134), tsc + build pass, both reference `buildUrl`/`parseFilters`
- Task 3: Header has 4 occurrences of StatusFilter/TypeFilter (2 imports + 2 JSX renders), build passes

## Issues Encountered

- **`npm run build` race with parallel agent (Wave 1)** — First build attempt hit "Another next build process is already running" lock from a sibling agent. Recovered by running `npm run lint` first (which doesn't lock) then retrying `npm run build` once the sibling finished. No code changes needed.
- **Untracked files from parallel agents** present in working tree (`src/app/api/diagnose-join/`, `src/lib/domain/join.ts`) — handled per STATE.md guidance by staging only my own files explicitly with `git add <pathspec>` (never `git add .`/`git add -A`) so each agent commits its own scope cleanly.

## User Setup Required

None - no external service configuration required. New filters are pure UI + URL state; no env vars, secrets, or infra changes.

## Next Phase Readiness

**Ready for Phase 7+:**

- `filters.status` and `filters.tipo` available on `parseFilters(searchParams)` in any Server Component or Client Component — domain functions can read them directly (`filterBonos({ ...rows, status: filters.status, tipo: filters.tipo })` etc.)
- `buildUrl(pathname, { ...filters, status: [...], tipo: [...] })` works for any client-side filter mutation in future plans
- Header bar already renders the 4 filters in the agreed order; Plan 04 (palette + dark mode) will only re-style them, not change layout

**Phase 7+ todos this plan does NOT solve:**

- Per-section filter application: each domain library (`filter-bonos.ts`, `filter-payouts.ts`, `filter-recargas.ts`, etc.) needs to honor `filters.status` / `filters.tipo` in its own predicate. Bonos likely ignores `tipo` since the section is BONUS-only by definition; Inicio shows the cross-cut and likely respects both. Each Phase 7+ plan owns this decision.
- Filter option list maintenance: if Tikin adds a new payout state ("paused", "review_pending", etc.) the hardcoded list in `status-filter.tsx` must be updated manually — by design (UI is not auto-derived from schema).
- Combobox upgrade: native `<details>` works for the current option counts (3 status + 10 tipo). If a Phase 7+ section needs typeahead or grouped options, the trigger UI can be swapped without touching the URL contract.

---
*Phase: 06-foundation-v2*
*Completed: 2026-05-07*
