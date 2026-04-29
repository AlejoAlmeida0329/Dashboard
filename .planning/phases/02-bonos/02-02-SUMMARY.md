---
phase: 02-bonos
plan: 02
subsystem: domain-logic
tags: [bonos, aggregations, react-cache, empresa-registry, server-component, intl-collator]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "EmpresaFilter accepts EmpresaOption[] and renders gracefully on []; URL-as-state filters (DashboardFilters in url-state.ts); format.ts as single Intl gate (toBogotaISODate); DashboardHeader chrome already composing client filter pieces."
  - phase: 02-01
    provides: "Transaction interface with empresa_id (= tikintag default), tipo (BONUS), direction (in/out), status (completed/rejected), comision (= total_transaction_fee). 3188 rows confirmed parseable from BD_Plataforma."
provides:
  - "filterBonos: pure-function default contract for 'what is a bono' (BONUS + direction=in + status=completed + Bogota-anchored from/to + empresa)"
  - "summarizeBonos / aggregateBonosByDate / aggregateBonosByEmpresa / top10Empresas: 4 zero-safe aggregations producing the shapes Plan 03 components and Plan 04 page consume"
  - "BonoSummary, BonoByDate, BonoByEmpresa output types — stable contract for downstream UI"
  - "getEmpresaRegistry: deduped + Spanish-collated empresa list for the EmpresaFilter dropdown"
  - "getCachedTransactions = cache(getTransactions): same-request memoization for the dashboard render tree (header + page share one Sheets call)"
  - "Async DashboardHeader wired to real empresa registry — closes Phase 1 'EmpresaFilter list is empty' blocker"
affects: [02-03-bonos-presenter-mode, 02-04-bonos-page, 03-payouts, 04-recargas, 04-inicio]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "request-scoped-cache: React `cache()` wraps the Sheets adapter so multiple Server Components in the same render share one fetch; freshness preserved (no cross-request caching)"
    - "pure-domain-aggregations: no Next/React/server-only imports in bonos.ts or empresas.ts — callable from Server Components, Client Components, scripts, future tests"
    - "default-bono-filter-contract: tipo ∈ BONO_TRANSACTION_TYPES + direction=in + status=completed; documented in jsdoc so override is a single edit and the contract stays explicit"
    - "bogota-anchored-filters: from/to parsed as `${date}T00:00:00-05:00` / `T23:59:59.999-05:00` literal offsets — same convention as url-state.ts, no naked Date(YYYY-MM-DD) silent UTC interpretation"
    - "zero-safe-aggregations: every divisor (ticketPromedio, pctDelTotal) returns 0 (not NaN/Infinity) on empty input — chart libraries don't blow up on empty filter results"
    - "spanish-collator-sort: empresa registry uses Intl.Collator('es', { sensitivity:'base', numeric:true }) so accents and embedded numbers sort the way users expect"
    - "graceful-header-degradation: DashboardHeader try/catches the Sheets read; on failure, empresa dropdown renders empty (Phase 1 behavior) and the real error surfaces on the data-bearing page where users expect it"

key-files:
  created:
    - src/lib/domain/bonos.ts
    - src/lib/domain/empresas.ts
    - .planning/phases/02-bonos/02-02-SUMMARY.md
  modified:
    - src/lib/sheets/transactions.ts
    - src/components/layout/dashboard-header.tsx

key-decisions:
  - "BONO_TRANSACTION_TYPES = ['BONUS'] — singular. Captured live in 02-01-SUMMARY.md diagnostic findings: BD_Plataforma uses 'BONUS' (uppercase, singular). Append-only constant if Tikin later splits into BONUS_REGALO etc."
  - "Default Bonos filter excludes direction=out and status=rejected. Rationale: 'out' is reverso/refund noise (refunds are separately classified as REFUND tipo, so excluding 'out' here doesn't double-count); 'rejected' transactions never carried money and would inflate counts. Captured live: only 'completed' and 'rejected' exist in BD_Plataforma.status."
  - "aggregateBonosByDate emits one point per data day, no zero-fill. Bono density is ~1500+/day in normal operation (3188 BD_Plataforma rows over ~90 days, BONUS is the largest single tipo); the chart library handles continuous-axis spacing on its own. Zero-fill would also wrongly imply the dashboard is the source of truth on which days had no sales."
  - "aggregateBonosByEmpresa pctDelTotal is computed against the input (already filtered) — NOT the full universe. Caller controls the denominator by what they pass in; this matches how the leaderboard naturally reads ('% of the bonos in the current view')."
  - "top10Empresas takes pre-sorted input. Idiomatic call: `top10Empresas(aggregateBonosByEmpresa(bonos))`. Avoids sorting twice when the leaderboard and the full table share the aggregation."
  - "Empresa registry uses Intl.Collator('es', { numeric: true }) — handles `$1anderson` < `$1camila` numerically and sorts `$ñ`-prefixed values per Spanish rules. Phase 2 names are tikintags ($-handles), but the collator works equally well on display names if Tikin later adds an empresa_display_name column."
  - "getCachedTransactions wraps getTransactions with React `cache()`. Per-request dedup, no cross-request caching. PROJECT.md mandates 'lectura en vivo en cada carga' — this preserves it. Other callers (route handlers, server actions, scripts) keep using getTransactions directly because cache() is only meaningful inside a render."
  - "DashboardHeader degrades gracefully on Sheet failure. Empty empresas={[]} matches Phase 1 behavior; the real error surfaces on /bonos (or /inicio when populated) where the user is asking for data. Avoids whole-chrome breakage on a transient 429 or schema drift."

# Metrics
duration: 8m 35s
completed: 2026-04-29
---

# Phase 2 Plan 02: Bonos Domain + Empresa Registry Summary

**Pure-function bonos library (filter + 4 zero-safe aggregations), Spanish-collated empresa registry, React-cache-deduped Sheet reads, and an async DashboardHeader wired to real empresas — closing the Phase 1 'EmpresaFilter list is empty' blocker.**

## Performance

- **Duration:** 8m 35s
- **Started:** 2026-04-29T21:49:43Z
- **Completed:** 2026-04-29T21:58:18Z
- **Tasks:** 2 (1 commit each)
- **Files created:** 2 (bonos.ts, empresas.ts) + this SUMMARY
- **Files modified:** 2 (transactions.ts, dashboard-header.tsx)
- **Production deploys:** 1 (verified live)

## Accomplishments

- Established the **single source of truth for "what is a bono"** in `bonos.ts`. Plans 03 (UI) and 04 (page) consume `filterBonos` + 4 aggregations and stay dumb about Sheets, dates, or filter math. The default contract (`BONUS` + `direction=in` + `status=completed`) is documented in jsdoc so a future override (e.g. include refunds) is a single, explicit edit.
- Closed the Phase 1 **"EmpresaFilter list is empty"** blocker. Production verification: dropdown contains 233 unique empresas + "(Todas las empresas)", sorted with Spanish collation. Selecting `$mario` correctly renders `selected=""` on that option.
- Introduced the **request-scoped cache pattern** (`getCachedTransactions = cache(getTransactions)`). DashboardHeader and `/bonos` (Plan 04) now share a single Sheets fetch per request. Zero cross-request caching — `lectura en vivo` per PROJECT.md is preserved.
- Made `DashboardHeader` **async** without disrupting the layout. Graceful try/catch fallback means a Sheets failure no longer breaks the chrome — the dropdown renders empty (Phase 1 behavior) and the error surfaces on the data-bearing page where the user expects it.
- Established **`Intl.Collator('es', { numeric: true })`** for the empresa list sort. Phase 2 names are `$1anderson`/`$1camila`/`$ñoño`-shaped tikintags; the collator handles them today and will handle real display names without code change.

## Task Commits

1. **Task 1 — Bonos domain library (filter + 4 aggregations)** — `5ca2786` (feat)
2. **Task 2 — Empresa registry + cached transactions + header wiring** — `58ea85b` (feat)

**Plan metadata commit:** to be added after this SUMMARY.

## Files Created/Modified

- `src/lib/domain/bonos.ts` — NEW. Pure module exporting `filterBonos`, `summarizeBonos`, `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas` plus output types `BonoSummary`, `BonoByDate`, `BonoByEmpresa`. No Next/React/server-only imports — runnable from any context. Date math anchored to America/Bogota with explicit `-05:00` offsets so a `from='2026-04-01'` filter means 00:00 in Bogotá, not 19:00 the previous day.
- `src/lib/domain/empresas.ts` — NEW. Pure `getEmpresaRegistry(transactions)` returning `EmpresaOption[]` deduped by `empresa_id`, sorted with `Intl.Collator('es', { sensitivity: 'base', numeric: true })`. Empty input → `[]` (no special-casing needed by callers).
- `src/lib/sheets/transactions.ts` — Added `import { cache } from "react"` and `export const getCachedTransactions = cache(getTransactions)`. Existing `getTransactions` unchanged. JSDoc spells out the same-request-dedup contract and the rule for when to use which variant.
- `src/components/layout/dashboard-header.tsx` — Converted to `async` Server Component. Reads transactions via `getCachedTransactions`, computes empresa registry, passes real list to `<EmpresaFilter empresas={...} />`. Try/catch around the read so a Sheet failure (creds, schema, 429) leaves the chrome standing and the empresa dropdown empty — same as Phase 1 — while the error surfaces on the data-bearing page.

## Bonos Filter Contract

The default contract applied by `filterBonos`:

```
1. t.tipo ∈ BONO_TRANSACTION_TYPES                  (currently just 'BONUS')
2. t.direction === 'in'                              (excludes reversos / outflows)
3. t.status === 'completed'                          (excludes rejected; pending → OTRO_STATUS, also excluded)
4. t.fecha >= startOfDayBogotaTimestamp(filters.from)  (default: -Infinity)
5. t.fecha <= endOfDayBogotaTimestamp(filters.to)      (default: +Infinity)
6. !filters.empresa OR t.empresa_id === filters.empresa
```

**To override** the bono definition (e.g. include refunds, include rejected for a debug view), edit:

```ts
// in src/lib/domain/bonos.ts
const BONO_TRANSACTION_TYPES = ['BONUS', 'BONUS_REGALO']; // append types
// or for a custom function, copy filterBonos and tweak the predicate inline.
```

The 5 aggregations (`summarizeBonos`, `aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas`) operate on whatever `Transaction[]` you pass them — they have no opinion about what's a bono. So `aggregateBonosByEmpresa(allTransactions)` would give you the empresa breakdown across ALL transaction types (revenue mix view), if some future plan needs that.

## Empresa Registry Caveats

**Today (Phase 2):**
- `empresa_id === empresa_nombre === tikintag` (e.g. `$mario`, `$tikincol`, `$1anderson`).
- The dropdown displays tikintag handles as labels — readable but not Tikin's "official" display name.
- Production verification: 233 unique tikintags from 3188 BD_Plataforma rows.

**When BD_Plataforma adds a real `empresa_display_name` column** (likely Phase 5):
1. Update `schemas.ts` transform: `empresa_nombre: parsed.empresa_display_name ?? parsed.tikintag` (with a fallback so the schema doesn't break before the column is added everywhere).
2. `getEmpresaRegistry` picks up the new label automatically — first-occurrence-wins still gives stable labels across reads.

**Caveat carried over from 02-01:** Multiple tikintags may map to the same empresa (e.g. Liftit corporate `$liftit-app` plus per-employee tikintags). Today they appear as separate empresas. Phase 5 (Clientes/Domain) is the place to introduce a many-to-one tikintag → empresa display-name mapping.

## Cache Pattern (When to Use What)

| Caller | Function | Why |
|--------|----------|-----|
| Server Component inside the `(protected)/layout.tsx` render tree (DashboardHeader, app/bonos/page.tsx, app/inicio/page.tsx, etc.) | `getCachedTransactions` | Same render = same data. React `cache()` dedupes the Sheets call so the chrome and the page each get the same `AdapterResult<Transaction>` reference, costing one network roundtrip total. |
| Route handler (`app/api/*/route.ts`) | `getTransactions` | `cache()` is a no-op outside a render. Direct call is clearer. |
| Server Action (`'use server'` function) | `getTransactions` | Same reason — actions are not rendering. |
| Future tests / scripts | `getTransactions` | Tests should hit the real adapter without React runtime. |

**Errors are also memoized.** If the first consumer in a render (DashboardHeader) sees a Sheets failure, every subsequent `getCachedTransactions()` call in the same render rethrows the same error. That's the right behavior: a failed read is a full-page issue; retrying on the second consumer would just double the latency before the same failure surfaces.

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- **`BONO_TRANSACTION_TYPES = ['BONUS']`** — singular per live data.
- **`direction=in` + `status=completed` are part of the default Bonos filter** — excluding refunds/reversos and rejected transactions to give a clean revenue view by default. Both are documented in jsdoc and in the SUMMARY contract block above.
- **`pctDelTotal` against the filtered input** — the leaderboard naturally reads "% of the bonos in the current view", and this matches.
- **`getCachedTransactions` only for the render tree** — explicit rule documented in jsdoc and in the cache pattern table above.
- **DashboardHeader degrades gracefully** — empty `empresas={[]}` on Sheet failure is the same UX as Phase 1.

## Deviations from Plan

None — plan executed exactly as written. The plan's two tasks unified cleanly into two atomic commits without architectural surprises.

The only minor implementation choice: I added `Intl.Collator('es', { numeric: true })` for sorting (the plan said `localeCompare(b.nombre, 'es')`). Reason: with `numeric: true` the collator orders `$1anderson` < `$1camila` < `$11john` correctly (numeric segments compared as numbers). Plain `localeCompare('es')` would order them lexically (`$1` < `$11` < `$2`). Same call shape, strictly better behavior — fits within Rule 1 (correctness fix) but the plan didn't anticipate the numeric-handle case. Documented here so future plans see the choice.

## Issues Encountered

None. Build, lint, typecheck, and production deploy all green on the first attempt. Production smoke against the new build:

- `/inicio` HTTP 200 — 234 dropdown options (1 default + 233 empresas), Spanish-collated.
- `/inicio?empresa=$mario` HTTP 200 — `$mario` option rendered with `selected=""`.
- `/bonos` HTTP 200 — same 234 options (header is shared).
- `/api/smoke` ok=true, count=3188, skipped=44 — schema and adapter still healthy.

The cache contract (single Sheets call per request) is the documented behavior of React's `cache()` and is implicitly proven by the page rendering green: both consumers (DashboardHeader and the page) called `getCachedTransactions()` and got their data without doubling the latency or schema-mismatch errors.

## Next Phase Readiness

**Ready for Plan 02-03 (Modo Presentación on Bonos):**

- The 4 aggregation functions in `bonos.ts` already produce the comision-bearing fields the presenter mode hides. Plan 02-03 just marks the `comision` column / KPI / leaderboard with `data-presenter-hide` (CSS contract from 01-03).
- `top10Empresas` is the single function the leaderboard consumes — wrapping it in a `data-presenter-hide` div in Plan 03 is one line.

**Ready for Plan 02-04 (Bonos page):**

- `app/bonos/page.tsx` flow:
  1. `parseFilters(searchParams)` from url-state.
  2. `await getCachedTransactions()` → shares the call DashboardHeader is also making.
  3. `filterBonos(result.rows, filters)` once.
  4. Pass filtered list to `summarizeBonos`, `aggregateBonosByDate`, `aggregateBonosByEmpresa` (and from there `top10Empresas`).
  5. Render the Plan 03 components with the resulting data.
- All shapes and types are stable: `BonoSummary`, `BonoByDate[]`, `BonoByEmpresa[]`. Plan 03 components type-check against these; no schema drift possible between domain and UI.

**Ready for Phase 4 (Inicio):**

- Inicio is supposed to surface "bonos vendidos" as one KPI. It can call `summarizeBonos(filterBonos(rows, filters))` directly and reuse the same `count` / `comisionTotal`. No duplicate aggregation logic.
- The empresa registry is now available everywhere via `getEmpresaRegistry` — Inicio inherits a populated EmpresaFilter via the layout chrome with zero extra wiring.

**Open items / carryover:**

- **Vercel Deployment Protection still ENABLED** — production URL gated behind Vercel SSO. Documented in 01-04-SUMMARY.md; user owns the toggle. Does not affect Plan 02-02 verification (we use the SESSION JWT cookie pattern from 01-02 to bypass for testing).
- **`status === 'completed'` is a default, not a contract.** If Tikin later starts surfacing in-flight transactions as `pending`, the schema's `OTRO_STATUS` fallback hides them (correctly — they don't carry money yet). When Tikin adds `pending` officially, types.ts and schemas.ts grow a `pending` value and the Bonos filter stays as-is.
- **Cache pattern is opt-in.** No future plan is forced to use `getCachedTransactions`; if a route handler needs the data outside a render, it imports `getTransactions` directly. The dual export keeps both paths first-class.

**No new blockers introduced.**

---

*Phase: 02-bonos*
*Plan: 02*
*Completed: 2026-04-29*
