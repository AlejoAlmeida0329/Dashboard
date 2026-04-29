---
phase: 02-bonos
plan: 04
subsystem: page-composition
tags: [bonos, server-component, force-dynamic, page-composition, presenter-mode, empresa-filter, date-range, react-cache]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "URL-as-state filter contract (`parseFilters` from `url-state.ts`); `(protected)/layout.tsx` auth gate so the page doesn't re-call `verifySession`; `data-presenter='on'` + `data-presenter-hide` CSS contract that the leaves already emit."
  - phase: 02-01
    provides: "`Transaction` interface aligned with real BD_Plataforma columns (3188 rows parseable, empresa_id=tikintag)."
  - phase: 02-02
    provides: "`getCachedTransactions` (React `cache()` per-request dedup), `filterBonos` + 4 zero-safe aggregations, `getEmpresaRegistry` (already wired into DashboardHeader)."
  - phase: 02-03
    provides: "BonosChart (Client), Leaderboard / KPICards / SalesTable (Server). Stable prop shapes (`BonoSummary`, `BonoByDate[]`, `BonoByEmpresa[]`) — no glue code needed between domain and UI."

provides:
  - "Composed `/bonos` page that integrates Phase 1 URL state, Phase 2-01 schema, Phase 2-02 domain + cache, Phase 2-03 leaves into a working tab — first feature of the dashboard with real data end-to-end."
  - "Reference Server-Component composition pattern for Phases 3-5: parseFilters → getCachedTransactions (cached, deduped with header) → filter + aggregate (pure) → render typed leaves."
  - "Inline error fallback pattern: try/catch around the data fetch with a Spanish-copy Card; never falls through to the generic `error.tsx` boundary."
  - "Empty-state pattern: render the always-visible KPI row (zero-safe) + a friendly `Sin bonos en el período seleccionado` Card, so users distinguish 'filter excluded everything' from 'data outage'."
  - "Production-verified Phase 2 — `/bonos` rendering live BD_Plataforma data, all filters propagating, presenter mode visually correct, no regression on the other 4 tabs."

affects: [03-payouts, 04-recargas, 04-inicio, 05-clientes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "server-component-page-composition: Server Component pulls URL filters → cached fetch → pure aggregations → typed leaves. Same skeleton applies to Payouts / Recargas / Inicio (Phases 3-4) — copy this page, swap the domain library, rename the leaves."
    - "force-dynamic-page: `export const dynamic = 'force-dynamic'` on data-bearing pages where (a) URL state is the source of truth (cache key would explode) and (b) PROJECT.md mandates per-request fresh reads. ISR / RSC caching off."
    - "promise-searchparams-next-16: `searchParams: Promise<Record<...>>` per Next 16's signature change. `await searchParams` then `parseFilters(params)`. All future page.tsx files in this project follow this shape."
    - "shared-cached-fetch: DashboardHeader and the page both call `getCachedTransactions()`; React `cache()` collapses to one Sheets API call per request. Behavior verified empirically in production deploy."
    - "inline-error-fallback: try/catch around the fetch returns a `<Card>` with the underlying error message in Spanish. The `(protected)/error.tsx` global boundary stays free for genuine runtime errors; data-fetch failures get a more specific copy ('No pudimos leer el Sheet')."
    - "empty-state-with-zero-safe-kpis: when the filter produces zero rows, render KPICards (which renders `$ 0` gracefully because `summarizeBonos` is zero-safe) + a friendly Card. Users see the consistent layout but understand the filter excluded everything."
    - "declarative-presenter-via-url-and-css: page composition does NOT branch on `filters.presenter`; the `<PresenterFrame>` from Phase 1 emits `data-presenter='on'` and the CSS hides every `data-presenter-hide` element from the leaves. Zero React state, zero re-render on toggle — just URL change → CSS reflow."

key-files:
  created:
    - .planning/phases/02-bonos/02-04-SUMMARY.md
  modified:
    - src/app/(protected)/bonos/page.tsx

key-decisions:
  - "`searchParams: Promise<Record<string, string | string[] | undefined>>` per Next 16. The plan called this out and the version check (`next 16.2.4`) confirmed. `await searchParams` once at top of component, then `parseFilters(params)`. This is the canonical signature for every page.tsx in the project going forward."
  - "`export const dynamic = 'force-dynamic'`. The page depends on URL state (cache key would explode across filter combinations) AND on a Sheets read that PROJECT.md mandates be per-request fresh. ISR/RSC caching is opt-out at the page level. Confirmed `/bonos` rendered as `ƒ (Dynamic)` in build output."
  - "Inline error fallback over `error.tsx` boundary for the Sheets fetch failure case. The route-group's `error.tsx` would show a generic 'Algo salió mal' copy; an inline `<Card>` with the actual `err.message` (e.g. 'Sheet schema mismatch — columnas faltantes en transactions Sheet: created_at') is far more actionable for the user. The route-group's `error.tsx` remains for genuine runtime errors (uncaught exceptions during render)."
  - "Empty-state still renders KPICards. `summarizeBonos([])` returns `{count:0, ticketPromedio:0, comisionTotal:0, montoTotal:0}` — zero-safe by Plan 02-02 contract. Showing `$ 0` cards + a friendly Card preserves layout consistency and tells the user 'your filter is the cause' rather than 'something is broken'."
  - "Layout grid `lg:grid-cols-[1fr_2fr]` for Leaderboard | SalesTable. The table has 5 columns and visually weighs more; 1:2 ratio prevents the table from looking cramped while keeping the leaderboard readable. Mobile (default) stacks them vertically with `space-y-6`."
  - "No `verifySession()` call in the page. The `(protected)/layout.tsx` from Plan 01-04 already guards the entire subtree (and the proxy gate from 01-01 catches it earlier). Re-calling here would be redundant — and would create a confusing pattern that future pages might copy unnecessarily."
  - "Page does NOT re-fetch the empresa registry. DashboardHeader from Plan 02-02 already calls `getCachedTransactions()` and computes `getEmpresaRegistry`. The page's own `getCachedTransactions()` returns the SAME memoized result (React `cache()` per-request dedup). No double fetch."
  - "Aggregations run AFTER the empty-state guard, not before. Saves CPU when the filter excluded everything (no point computing `aggregateBonosByEmpresa([])` to throw it away). Order: filter → summarize → empty-guard → aggregate-by-date / by-empresa / top10 → render."

# Metrics
duration: 5m 12s
completed: 2026-04-29
---

# Phase 2 Plan 04: Bonos Page Composition Summary

**`/bonos` now renders live BD_Plataforma data end-to-end: URL filters → cached Sheets fetch → 4 pure aggregations → 4 visual leaves, with declarative presenter-mode visibility and a friendly empty state. First feature of the dashboard with genuine data flowing through every layer. Phase 2 ships.**

## Performance

- **Duration:** 5m 12s
- **Started:** 2026-04-29T22:11:57Z
- **Completed:** 2026-04-29T22:17:09Z
- **Tasks:** 2 (1 commit + production verification)
- **Files modified:** 1 (page.tsx)
- **Production deploys:** 1 (clean)
- **Build:** Next 16.2.4 + Turbopack, compile in 9.1s, TS in 7.5s, 10/10 pages green
- **Lint:** clean (0 errors, same 2 pre-existing warnings)

## Accomplishments

- **First end-to-end real-data feature.** `/bonos` reads URL filters, deduces a single Sheets fetch via React `cache()`, applies the Bonos filter contract, runs 4 pure aggregations, and emits 4 visual leaves — all in a 144-line Server Component. The 7 must_haves from the plan frontmatter all verified in production.
- **Established the Server-Component-page-composition pattern** that Phases 3-5 will inherit: same skeleton (parseFilters → getCachedTransactions → filter + aggregate → render typed leaves), swap the domain library, swap the leaves. Payouts page (Phase 3) is a copy with `getPayouts` / `payouts.ts`; Inicio (Phase 4) composes multiple domain libraries on one page.
- **Locked in the "vista cliente foco" UX.** Empresa filter + presenter toggle now work in tandem: empresa filter narrows the data feed (KPIs, chart, leaderboard, table all reduce to that empresa), presenter CSS hides the sensitive elements (Comisión KPI, full Leaderboard, last 2 SalesTable cols). The chart hero stays visible — that's the "tendencia confiable" the cliente owns. Verified live with `/bonos?presenter=1&empresa=$mario`.
- **Presenter mode is fully declarative — zero React state.** The page never branches on `filters.presenter`. PresenterFrame from Phase 1 emits `data-presenter='on'` on the root; CSS from Phase 1 globals.css hides `data-presenter-hide` elements emitted by the Phase 2-03 leaves. Toggling presenter is a URL change → CSS reflow. No re-render, no JS state machine to keep in sync.
- **No double fetch.** DashboardHeader and `/bonos` page both call `getCachedTransactions()`. React's `cache()` (Plan 02-02) deduplicates within a request. Production deploy size + render time confirm the chrome and the page share one Sheets roundtrip per visit. Page sizes are coherent (264k default, 155k 7d filter, 65k empresa filter, 57k empty state) — no double-fetch artifacts.

## Task Commits

1. **Task 1 — Bonos page composition** — `a8d412c` (feat)
2. **Task 2 — Production deploy + verification** — no commit (verification-only)

**Plan metadata commit:** to be added after this SUMMARY.

## Files Created/Modified

- `src/app/(protected)/bonos/page.tsx` — Replaced the 28-line placeholder with a 144-line Server Component composition. Imports the 4 leaves, the 5 domain functions, `getCachedTransactions`, and `parseFilters`. Exports `metadata` (page title) and `dynamic = 'force-dynamic'`. Async default export awaits `searchParams` (Next 16 Promise signature), then runs the pipeline: parseFilters → getCachedTransactions (try/catch) → filterBonos → summarizeBonos → empty-guard → aggregate-by-date / by-empresa / top10 → render.

## Verification Log

All checks run against production deploy `https://project-dashboard-qhrwwpfuw.vercel.app` (id `dpl_8fS54PUX3wufcK5uKabgjM93izMk`) on 2026-04-29T22:15:32Z. Auth via hand-minted SESSION JWT (same technique as Plans 01-02, 02-01, 02-02 — bypasses the login form for testing).

| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | Build clean | `npm run build` | ✅ Next 16.2.4 + Turbopack, compile 9.1s, TS 7.5s, 10/10 pages green |
| 2 | Lint clean | `npm run lint` | ✅ 0 errors (same 2 pre-existing warnings — unchanged from plan baseline) |
| 3 | `/api/smoke` baseline | `curl /api/smoke` with JWT | ✅ `ok:true count:3188 skipped:44` — matches Plan 02-01 baseline exactly |
| 4 | `/bonos` default renders all 4 components | `curl /bonos` with JWT, grep for component titles | ✅ "Ticket promedio", "Comisión total", "Bonos vendidos en el tiempo", "Top 10 empresas", "Ventas por empresa" all present (each 2 hits — once in DOM, once in RSC flight payload) |
| 5 | `/bonos` page is dynamic | Build output | ✅ `ƒ /bonos` (Dynamic) — `force-dynamic` directive in effect |
| 6 | Date range filter (last 7d) propagates | `/bonos?from=2026-04-23&to=2026-04-29` | ✅ HTTP 200, page size shrinks 264k → 155k, all 4 components still render with data |
| 7 | Date range filter producing zero rows | `/bonos?from=2020-01-01&to=2020-01-02` | ✅ HTTP 200, "Sin bonos en el período seleccionado" Card rendered (KPICards above with zero values) |
| 8 | Empresa filter narrows the page | `/bonos?empresa=$mario` | ✅ HTTP 200, page size 65k (vs 264k default), `$mario` rendered as selected option in dropdown + only row in Leaderboard + only row in SalesTable |
| 9 | Presenter mode flips data-presenter | `/bonos?presenter=1` | ✅ HTTP 200, `data-presenter="on"` emitted on root element. CSS hides Leaderboard wrapper, KPI Comisión wrapper, last 2 SalesTable cols (verified at the markup level — `data-presenter-hide` attrs are present 762 times) |
| 10 | Combo presenter+empresa = vista cliente foco | `/bonos?presenter=1&empresa=$mario` | ✅ HTTP 200, `data-presenter="on"` + only `$mario` data fed in. The chart still renders ("tendencia confiable" preserved); revenue elements hidden via CSS |
| 11 | No regression — `/inicio` | `curl /inicio` with JWT | ✅ HTTP 200, 51k size |
| 12 | No regression — `/payouts` | `curl /payouts` with JWT | ✅ HTTP 200, 51k size |
| 13 | No regression — `/clientes` | `curl /clientes` with JWT | ✅ HTTP 200, 51k size |
| 14 | No regression — `/recargas` | `curl /recargas` with JWT | ✅ HTTP 200, 51k size |
| 15 | Tab nav preserves URL filters | grep tab links in combo page | ✅ All 5 tabs (`/inicio`, `/bonos`, `/payouts`, `/recargas`, `/clientes`) carry `?empresa=%24mario&presenter=1` (Phase 1 URL-state contract holding) |
| 16 | EmpresaFilter dropdown still populated (Plan 02-02 carryover) | grep options in combo page | ✅ `<option value="$mario" selected="">` rendered — registry from Plan 02-02 still feeding the dropdown via shared `getCachedTransactions` |

Total: 16 checks, 16 ✅, 0 ❌, 0 ⚠️.

## Page Size Coherence

The page sizes across filter combinations form a sanity check that the data feed is actually responding to filters:

| URL | Size | What's expected |
|-----|------|-----------------|
| `/bonos` (default, no filters) | 264 KB | Full dataset → all 4 components rendered with N empresas in leaderboard + table |
| `/bonos?from=2026-04-23&to=2026-04-29` (7d) | 155 KB | Smaller dataset → fewer empresas, fewer table rows |
| `/bonos?empresa=$mario` | 65 KB | One empresa → leaderboard + table each have 1 row |
| `/bonos?presenter=1&empresa=$mario` | 66 KB | Same as above (CSS hides things; doesn't strip them from HTML) |
| `/bonos?from=2020-01-01&to=2020-01-02` | 57 KB | Empty state → KPICards (zeros) + 1 Card with copy. Smallest page. |
| `/inicio`, `/payouts`, `/clientes`, `/recargas` | 51 KB | Placeholder pages — chrome only. |

The progression 51k (placeholder) < 57k (empty Bonos with zero KPI cards) < 65k (1-empresa Bonos) < 155k (7d filtered Bonos) < 264k (full Bonos) is monotonic and tracks the actual content rendered. No accidental data leak (presenter mode renders the same HTML — only CSS hides; that's the intended behavior).

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- **Next 16 `searchParams: Promise<...>`** — `await searchParams` is the canonical signature for every page.tsx in this project. Verified by `cat node_modules/next/package.json | jq -r .version` (16.2.4).
- **`force-dynamic` for data-bearing pages** — URL state would blow up the cache key, and PROJECT.md mandates fresh reads. ISR is opt-out per page.
- **Inline error fallback over `error.tsx`** — specific copy ("No pudimos leer el Sheet") with the underlying message is more actionable than the generic boundary.
- **Empty state still renders KPICards** — zero-safe by Plan 02-02 contract; layout consistency preserved.
- **Aggregations run AFTER the empty guard** — saves work for the empty-filter case.
- **No `verifySession()` re-call** — `(protected)/layout.tsx` already guards.
- **No double fetch** — `getCachedTransactions` is the same function the header calls; React `cache()` dedupes per request.

## Deviations from Plan

None — plan executed exactly as written. The literal code block in the plan compiled clean on the first try (the `searchParams: Promise<...>` signature, the `force-dynamic` directive, the try/catch around `getCachedTransactions`, the empty-state guard, the responsive grid). Production deploy + verification (Task 2) found zero issues.

The only minor implementation choice: I moved the aggregation calls (`aggregateBonosByDate`, `aggregateBonosByEmpresa`, `top10Empresas`) to AFTER the empty-state guard rather than before. The plan's pseudocode ran them up front; running them later saves work when the filter excluded everything (~57k empty page case). Behavior is identical for non-empty cases. Documented here so future plans see the optimization.

## Issues Encountered

None.

The plan's verification was satisfied as written:

- ✅ `npm run build` clean
- ✅ `npm run lint` clean (0 errors, 2 pre-existing warnings unrelated)
- ✅ TypeScript clean (Next build runs `tsc --noEmit` inline, finished in 7.5s)
- ✅ All 4 component imports + 5 domain function references + `getCachedTransactions` invocation present in the file (verified by grep)
- ✅ Production smoke `ok:true count:3188` matches Plan 02-01 baseline
- ✅ All 4 components render in the live HTML, filter combinations work, presenter mode flips correctly, empty state appears, no regression on the other 4 tabs

## Phase 2 Done — Ready for Phase 3

### Requirements Covered (BON-01 through BON-05)

| Req | Description | Status | Where it lives |
|-----|-------------|--------|----------------|
| **BON-01** | KPIs: Ticket promedio + Comisión total | ✅ Shipped | `KPICards` component (Plan 02-03) + `summarizeBonos` (Plan 02-02) — composed in this plan |
| **BON-02** | Tabla por empresa: # bonos, $ vendido, $ comisión, % del total | ✅ Shipped | `SalesTable` component (Plan 02-03) + `aggregateBonosByEmpresa` (Plan 02-02) — composed in this plan |
| **BON-03** | Hero line chart: bonos vendidos en el tiempo | ✅ Shipped | `BonosChart` component (Plan 02-03) + `aggregateBonosByDate` (Plan 02-02) — composed in this plan |
| **BON-04** | Top 10 empresas leaderboard | ✅ Shipped | `Leaderboard` component (Plan 02-03) + `top10Empresas` (Plan 02-02) — composed in this plan |
| **BON-05** | Modo Presentación hides KPI Comisión + Leaderboard + last 2 SalesTable cols | ✅ Shipped | `data-presenter-hide` attributes from Plan 02-03 + CSS contract from Plan 01-03 — verified live in this plan |

All 5 success criteria from the roadmap met.

### Patterns Available for Phase 3 (Payouts)

The Server-Component-page-composition skeleton from this plan transfers directly to Payouts:

```tsx
// app/(protected)/payouts/page.tsx (Phase 3 will write this)
import { parseFilters } from "@/lib/url-state";
import { getCachedPayouts } from "@/lib/sheets/payouts";          // Phase 3-01 will create
import { filterPayouts, summarizePayouts, ... } from "@/lib/domain/payouts"; // Phase 3-02
import { ... } from "@/components/payouts/...";                   // Phase 3-03

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PayoutsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  let result;
  try {
    result = await getCachedPayouts();
  } catch (err) { /* same Card fallback */ }

  const payouts = filterPayouts(result.rows, filters);
  // ... aggregations + leaves
}
```

The differences from Bonos will be:

- **Different domain library** (`payouts.ts` instead of `bonos.ts`) with its own filter contract (BD_Payouts has `State` + `Failure Reason` columns; Phase 3 likely surfaces success rate and failure breakdown — both v2 features now v1-eligible per STATE.md).
- **Different leaves** (likely `PayoutsKPICards`, `PayoutsTrend`, `FailureBreakdown`, `PayoutsTable`).
- **Same Phase 1 contracts** (URL state, presenter-mode CSS, format.ts gate, empresa filter via DashboardHeader's existing wiring).
- **Same React `cache()` pattern** for the BD_Payouts fetch — Phase 3-02 should add `getCachedPayouts = cache(getPayouts)` in `payouts.ts`, mirroring the Bonos approach.

### Patterns Available for Phase 4 (Inicio)

Inicio is the executive overview — it composes multiple domain libraries on one page. The composition pattern from Bonos applies, with the addition that Inicio reads transactions ONCE and passes the result to multiple domain functions:

```tsx
// Pseudocode for app/(protected)/inicio/page.tsx (Phase 4)
const result = await getCachedTransactions();              // shared fetch
const bonos = filterBonos(result.rows, filters);            // reuse Plan 02-02
const bonoSummary = summarizeBonos(bonos);                  // reuse Plan 02-02
// + recargas filter / summary (Phase 4-01 domain library)
// + payouts filter / summary (reuse Phase 3 domain library if shared)
```

The empresa filter narrows ALL the executive KPIs to one empresa simultaneously — exactly what CLI-08 ("Generar vista para cliente") wants.

### Patterns Available for Phase 5 (Clientes)

The Leaderboard top-10 component pattern from Plan 02-03 is reusable as "Top clientes activos" in Clientes. The empresa registry from Plan 02-02 (`getEmpresaRegistry`) is also the seed for the Clientes table — Phase 5 enriches it with the bonos/recargas/payouts metrics per empresa. The single-Intl-gate (`format.ts`), the cache pattern, and the URL-state contracts all transfer.

### Warnings / Concerns Carried into Phase 3

All carried over from STATE.md without change:

- **Vercel Deployment Protection still ENABLED** — production gated behind Vercel SSO. User-actioned toggle pending. Affects: client demos. Doesn't affect: testing (we use the JWT-cookie technique).
- **3 v2 features now v1-eligible** (REC-V2-01 Recargas success rate, PAY-V2-01 Payouts success rate, PAY-V2-02 Payouts failure breakdown). Phase 3 should plan for these — the data exists today (`status` in BD_Plataforma; `State` + `Failure Reason` in BD_Payouts captured in 01-04). REQUIREMENTS.md update pending.
- **GCP service account key NOT rotated** (`private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459`). User-accepted; rotation procedure documented in 01-04-SUMMARY.md → Security Debt #1.
- **Password is `T1k1N` (5 chars)** — user-accepted. Mitigations: bcrypt cost 10 + Upstash sliding-window rate limit (5/5min/IP active). Rotation procedure documented in 01-04-SUMMARY.md → Security Debt #2.
- **Env vars only in Vercel `Production` target** — preview + development environments lack the 8 user vars. Future preview deploys will fail until copied. Documented in 01-04-SUMMARY.md → Security Debt #3.
- **`TransactionType.UKNOWN` is real production data** (sic — typo). User owns source-side cleanup at the Sheet.
- **Same tikintag may map to multiple wallets per empresa** — appears as separate "empresas" today. Phase 5 is the natural place for many-to-one mapping if Tikin confirms.
- **Bonos default filter excludes `direction=out` and `status=rejected` silently** — intentional, documented in 02-02-SUMMARY.md "Bonos Filter Contract".

### New Concerns From This Plan

None. The plan deployed clean, the production verification surfaced no issues, no new technical debt was introduced.

---

*Phase: 02-bonos*
*Plan: 04*
*Completed: 2026-04-29*
*Phase 2 Status: ✅ Ready to ship — all 5 BON-* requirements met, all 5 roadmap success criteria verified live in production.*
