---
phase: 05-clientes-domain
plan: 04
subsystem: page-composition
tags: [react-server-component, page-composition, dynamic-route, cliente-foco, share-url, payouts-id-join, transaction-id-join, vercel-prod-deploy, phase-5-partial-ship]

# Dependency graph
requires:
  - phase: 05-clientes-domain
    provides: deriveEmpresasIndex + summarizeEmpresasIndex + findEmpresa + aggregateMonthlyActivity (Plan 05-01 domain library)
  - phase: 05-clientes-domain
    provides: ClientesKPICards + ClientesTable visual leaves with row Links to /clientes/[empresaId] (Plan 05-02)
  - phase: 05-clientes-domain
    provides: EmpresaProfileHeader + EmpresaActivityChart + EmpresaMiniCards + GenerarVistaClienteButton (Plan 05-03)
  - phase: 04-inicio-recargas
    provides: cliente-foco contract end-to-end on /inicio destination (Plan 04-07) — the share-URL target
  - phase: 03-payouts
    provides: Transaction ID join pattern for payouts.empresa_id enrichment (Plan 03-04 /payouts/page.tsx)
  - phase: 02-bonos
    provides: filterBonos + summarizeBonos (consumed by EmpresaMiniCards on profile page)
  - phase: 03-payouts
    provides: filterPayouts + summarizePayouts (consumed by EmpresaMiniCards on profile page)
  - phase: 04-inicio-recargas
    provides: filterRecargas + summarizeRecargas (consumed by EmpresaMiniCards on profile page)
provides:
  - Live `/clientes` page (replaces Phase 1 placeholder) — KPIs + sortable + searchable empresa list, row Links preserve date filter and strip empresa
  - Live `/clientes/[empresaId]` dynamic route (NEW) — profile header + 12-month activity chart + 3 mini-cards (Bonos/Recargas/Payouts narrowed to that empresa) + Generar vista para cliente button
  - Phase 5 partial ship — cliente-facing flow LIVE in production at `https://project-dashboard-z0fpsm5hl.vercel.app` (deployment `dpl_DuX1cwaKwBiQpPQn2ifstLwcvFa1`); supersedes Phase 4 production at `https://project-dashboard-4b4fxxmdr.vercel.app`
  - CLI-01..CLI-08 covered end-to-end (CLI-08 share-URL closes Phase 5 UX); INFRA-04 (custom domain) deferred to Plan 05-05
affects:
  - Phase 5 Plan 05-05 (custom domain dashboard.tikin.co) — DEFERRED by user request, decision pending; Plan 05-05 routes the production deployment landed here
  - Roadmap (post-Phase-5) — Phase 5 is functionally complete from the cliente-foco UX standpoint; only INFRA-04 (custom domain) remains for full Phase 5 close

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dynamic route with async params + decodeURIComponent for $-tikintags. The empresaId path segment carries `$mario` as `%24mario` in the URL (RFC 3986 — `$` is sub-delim, MUST be percent-encoded in path segments). Page does `const { empresaId: rawEmpresaId } = await params; const empresaId = decodeURIComponent(rawEmpresaId);` to recover the canonical `$mario` shape that downstream domain functions expect. Mirrors Plan 05-02's row-Link `encodeURIComponent` on the producer side."
    - "Promise.all parallel fetch for two-tab profile pages (mirror of /inicio/page.tsx Plan 04-07). The profile page reads BOTH BD_Plataforma and BD_Payouts because the EmpresaMiniCards Payouts card needs payout latency P50 + count + volumen narrowed to the empresa. `[txResult, payoutsResult] = await Promise.all([getCachedTransactions(), getCachedPayouts()])` — single-shot parallel fetch, both behind the React `cache()` wrapper so DashboardHeader doesn't re-fetch on the same request."
    - "Transaction ID join for payouts.empresa_id enrichment (canonical pattern from /payouts/page.tsx Plan 03-04). BD_Payouts rows don't carry empresa_id natively; the join is `txMap.get(payout.transactionId)`. This profile page reuses the SAME 3-line idiom verbatim — proves the pattern is reusable across pages, not Plan-03-04-specific."
    - "Profile page IGNORES URL `?empresa=` parameter; the path segment IS the picker. `const empresaFilters = { ...filters, empresa: empresaId }` — date filters from URL are preserved; empresa is forced to the path-segment value regardless of any URL `?empresa=` (which would be a stale leftover from /clientes navigation). Documented in JSDoc + must_have truth #2. The /clientes list page does the OPPOSITE: it ignores `?empresa=` because the table IS the picker."
    - "Single page emits exactly ONE `data-presenter-hide` attribute (on the GenerarVistaClienteButton wrapper). Per must_have, the button is the only profile chrome that must hide in presenter mode (because if presenter is already on, the user is in cliente-foco view already; the share-URL trigger would be redundant). Other than that ONE attribute, all visibility delegation is leaf-internal (zero attributes on the leaves themselves per Plan 05-03 design)."
    - "Inline 'Empresa no encontrada' fallback for unknown empresaId — avoids Next 16's notFound() route which would render a generic 404 chrome. Custom Card with link back to /clientes preserves header/sidebar context and matches the page-shell convention used elsewhere for Sheets-error fallback."

key-files:
  created:
    - src/app/(protected)/clientes/[empresaId]/page.tsx (NEW dynamic route, 228 LOC)
    - .planning/phases/05-clientes-domain/05-04-SUMMARY.md
  modified:
    - src/app/(protected)/clientes/page.tsx (Phase 1 placeholder Card → 103 LOC full composition; commit d10ec5a)

key-decisions:
  - "/clientes (list page) IGNORES the URL `?empresa=` parameter. The page is a PICKER — narrowing it by empresa would be a UX paradox (one row, no list). `parseFilters(params)` extracts date + presenter; the empresa key is silently dropped at the deriveEmpresasIndex boundary by passing `filters` (which contains it) and letting the domain function decide (deriveEmpresasIndex documented to ignore empresa per Plan 05-01). Documented in page-level JSDoc."
  - "/clientes/[empresaId] (profile page) FORCES empresa to the path segment. The opposite of the list page. `empresaFilters = { ...filters, empresa: empresaId }` — date filters preserved, empresa forced. Stale `?empresa=` from /clientes navigation (which the list-page row Link strips via buildUrl, but a manually-edited URL might carry) is overridden silently."
  - "Profile page's GenerarVistaClienteButton wrapper carries `data-presenter-hide` (single page-level visibility attribute on this page). Rationale: if the user already has presenter ON when looking at a profile, they're already in 'show the client their stuff' mode — the share-URL trigger is redundant chrome that should hide. Per Plan 05-03's documented design, the button leaf itself has no attribute (presentation-only); the page wraps it in a div with the attribute, mirroring the Inicio HechosCurados page-wrap pattern."
  - "Promise.all parallel fetch for the profile page (mirror of /inicio/page.tsx Plan 04-07). The list page (/clientes) needs only BD_Plataforma → single sequential `await getCachedTransactions()` (mirror of /recargas/page.tsx Plan 04-08). Pattern: parallel fetch ONLY when the page genuinely needs both tabs; otherwise sequential await is the simplest correct shape."
  - "Inline 'Empresa no encontrada' Card fallback (NOT Next's notFound() helper). Reasons: (a) preserves the page chrome (header, sidebar, filters), (b) keeps the user on the same canonical URL with a clear path back to /clientes, (c) matches the inline error-fallback convention from /bonos /payouts /inicio /recargas pages for Sheets failure (consistent failure-state look across the app)."
  - "Transaction ID join for payouts.empresa_id reuses the EXACT 3-line idiom from /payouts/page.tsx Plan 03-04. Pattern verbatim: `const txMap = new Map(txResult.rows.map((t) => [t.id, t.empresa_id])); const enrichedPayouts = payoutsResult.rows.map((p) => ({ ...p, empresa_id: p.empresa_id ?? txMap.get(p.transactionId) }))`. Then filter: `filterPayouts(enrichedPayouts, empresaFilters)`. Proves the join pattern is reusable cross-page."
  - "Date-bound `asOf` for the 12-month chart anchors at `filters.to ? new Date(\\`${filters.to}T12:00:00-05:00\\`) : new Date()`. Mid-day Bogotá to avoid UTC-boundary off-by-one in `subMonths`/`format`. When user has set a date filter, the chart's rolling 12-month window ends at the filter's `to` date — matching the period the rest of the page shows. When no date filter, defaults to today's rolling 12-month window."

patterns-established:
  - "Dual-page pattern for any future list+profile domain. /clientes list page (single-tab fetch, ignores empresa URL filter, table is picker) + /clientes/[empresaId] profile page (multi-tab parallel fetch, forces empresa from path, mini-cards narrow Phase 2/3/4 domains by passing empresaFilters). Future domains (e.g. tikintag-level analytics, account-level views) follow the same skeleton."
  - "Path-segment-overrides-query-string discipline for dynamic routes. Profile pages SHOULD ignore URL `?empresa=` and force the path segment. List pages SHOULD ignore URL `?empresa=` (it's a picker). Filter (e.g. /bonos /payouts /inicio /recargas) pages CONSUME URL `?empresa=` because the chrome dropdown is the writer. Documented contract per page in their JSDoc."
  - "ONE page-level `data-presenter-hide` attribute on profile pages (the share-URL trigger). Other visibility delegation 100% leaf-internal. Profile pages don't have Tikin-internal-only KPIs because the entire page IS the cliente's data — the only thing to hide in presenter mode is the chrome that initiates the share-URL flow."

# Metrics
duration: ~70m active (Task 1 + Task 2 implementation by background agent ~25 min on 2026-05-06; checkpoint pause + user verification ~minutes; Task 3 deploy + SUMMARY + STATE.md update + metadata commit ~10 min orchestrator-direct continuation on 2026-05-06)
completed: 2026-05-06
---

# Phase 5 Plan 04: Clientes Page Composition Summary

**Replaces the Phase 1 placeholder at `/clientes` with the live list page (KPIs + sortable + searchable empresa table) AND ships the new dynamic route `/clientes/[empresaId]` (profile header + 12-month activity chart + 3 mini-cards Bonos/Recargas/Payouts narrowed to that empresa + Generar vista para cliente button). Cliente-foco share-URL flow CLI-08 closes end-to-end. Phase 5 cliente-facing flow LIVE in production; only INFRA-04 (custom domain, Plan 05-05) deferred.**

## Performance

- **Duration:** ~70m active. Tasks 1+2 (page implementations) ran ~25 min via background agent on 2026-05-06; checkpoint paused for human verification (minutes); Task 3 (Vercel `--prod` deploy) + SUMMARY + STATE.md update + metadata commit ~10 min orchestrator-direct continuation on 2026-05-06.
- **Tasks:** 2 implementations (Task 1 list page rewrite + Task 2 profile page creation) + 1 checkpoint (human-verify — approved) + 1 deploy (Task 3).
- **Files created:** 2 (the new profile page + this SUMMARY).
- **Files modified:** 1 (the list page; commit d10ec5a).
- **Final page LOC:** /clientes/page.tsx 103 LOC (vs ~37 LOC Phase 1 placeholder); /clientes/[empresaId]/page.tsx 228 LOC (NEW). Both well above plan's `min_lines` (80 + 130).

## Commits

- `d10ec5a` `feat(05-04): replace clientes/page.tsx with full list-page composition` — Task 1. Mirror of `/recargas/page.tsx` shape: single sequential `await getCachedTransactions()`, then `deriveEmpresasIndex(txResult.rows, filters)` + `summarizeEmpresasIndex(rows)` → JSX render of `<ClientesKPICards summary={summary} />` over `<ClientesTable rows={rows} />`. Inline `<Card>` fallback on Sheets failure. NO `verifySession` (route group layout guards).
- `177d976` `feat(05-04): create clientes/[empresaId]/page.tsx dynamic profile route` — Task 2. Mirror of `/inicio/page.tsx` shape: `Promise.all([getCachedTransactions(), getCachedPayouts()])` parallel fetch. Then: `findEmpresa` for header (returns null → "Empresa no encontrada" Card fallback); `aggregateMonthlyActivity` for the 12-month chart (asOf bound to `filters.to` or today); `filterBonos` + `filterRecargas` + `filterPayouts` (with Transaction ID enrichment for `empresa_id`) all narrowed to `empresaFilters = { ...filters, empresa: empresaId }`; 3 summarizers feed `<EmpresaMiniCards>`. Single page-level `data-presenter-hide` on the `<GenerarVistaClienteButton>` wrapper div.
- `(metadata)` `docs(05-04): complete clientes page composition plan` — final metadata commit (this SUMMARY + STATE.md update).

## Verification (all green)

- `npx tsc --noEmit` → clean.
- `npm run build` → ✓ Compiled successfully (Next 16.2.4 Turbopack, ~46s on Vercel build worker), all routes emitted. New routes in build output: `ƒ /clientes` and `ƒ /clientes/[empresaId]` (12 routes total now, was 11).
- All Plan-spec verify checks for both tasks satisfied (deriveEmpresasIndex/summarizeEmpresasIndex calls, findEmpresa/aggregateMonthlyActivity/decodeURIComponent calls, filter*x3 calls, Promise.all === 1, single data-presenter-hide on profile page).
- Cliente-foco flow verified manually by user (response: "approved") across all 7 verification segments A-G:
  - **A. /clientes list page**: KPIs visible, 6-column sortable table, search input filters, empty period shows all-empresas-inactiva.
  - **B. Row click → profile**: Date preserved, empresa stripped, URL shows `%24<tikintag>`, profile renders.
  - **C. Profile page**: Header with status badge + Última actividad + 4 stats; 12-month bar chart; 3 mini-cards (Bonos/Recargas/Payouts); button visible; back link works.
  - **D. Unknown empresa**: "Empresa no encontrada" Card.
  - **E. CLI-08 share-URL flow**: Generar vista → /inicio?empresa=$X&presenter=1; cliente-foco contract holds (3 KPIs visible, Comisión + Take rate hidden, EmpresasActivasChart hidden, HechosCurados hidden, chrome hidden); URL is source of truth on reload.
  - **F. Filter persistence**: Date filter → table reflects → profile preserves → Generar vista carries filter into /inicio.
  - **G. No regression**: /bonos, /payouts, /inicio, /recargas all render as before with their existing cliente-foco contracts.
- **Production deploy:** `vercel --prod` → `https://project-dashboard-z0fpsm5hl.vercel.app` (deployment id `dpl_DuX1cwaKwBiQpPQn2ifstLwcvFa1`, alias `https://project-kr6et.vercel.app`, region `iad1`, status `● Ready Production`, build duration ~1m). Curl smoke green:
  - `curl -sI https://project-dashboard-z0fpsm5hl.vercel.app/login` → `HTTP/2 200`
  - `curl -sI https://project-dashboard-z0fpsm5hl.vercel.app/clientes` → `HTTP/2 307` location `/login` (proxy gate intact)
  - `curl -sI 'https://project-dashboard-z0fpsm5hl.vercel.app/clientes/%24mario'` → `HTTP/2 307` location `/login` (proxy gate intact on the new dynamic route)
- **Supersedes** the prior Phase 4 production at `https://project-dashboard-4b4fxxmdr.vercel.app` (which kept `/clientes` as the Phase 1 placeholder Card). New deploy ships the full Phase 5 cliente flow ON TOP of Phase 4's `/inicio` + `/recargas`.

## Deliverables in HEAD

- `src/app/(protected)/clientes/page.tsx` (103 LOC) — Server Component. Top-level JSDoc (~30 LOC) explaining: (a) page IGNORES the empresa URL filter (table is the picker, not the destination); (b) cliente-foco delegation absent here (list is internal navigation only); (c) Sheets-failure inline `<Card>` fallback. Pipeline: parseFilters → single sequential getCachedTransactions → deriveEmpresasIndex (which itself ignores empresa filter per Plan 05-01) → summarizeEmpresasIndex → render `<ClientesKPICards>` over `<ClientesTable>`.

- `src/app/(protected)/clientes/[empresaId]/page.tsx` (228 LOC, NEW) — Server Component with async `generateMetadata` for per-request page title. Top-level JSDoc (~40 LOC) explaining: (a) empresaId from URL path segment (decodeURIComponent for `%24` → `$`); (b) Transaction ID join for payouts mirrors /payouts/page.tsx Plan 03-04; (c) cliente-foco enforcement at share-URL boundary (this page is internal — Tikin team viewing); (d) error/404 handling with inline Card fallback. Pipeline: parseFilters + force empresa from path → Promise.all parallel fetch BD_Plataforma + BD_Payouts → findEmpresa (null guard → 404 Card) → aggregateMonthlyActivity with date-bound asOf → 3 domain filters narrowed to empresaFilters (with Transaction ID enrichment for payouts) → 3 summarizers → render header + 12-month chart Card + EmpresaMiniCards + GenerarVistaClienteButton wrapped in `data-presenter-hide` div + back link.

## Live Data Observations (production smoke)

The new production deploy carries the Phase 5 cliente flow live; data observations from local dev (parity with prod data since both read the same BD_Plataforma + BD_Payouts):
- **Total empresas** in /clientes default view: ~233 (matches Phase 1 EmpresaFilter count of 233 real + 1 default).
- **Empresas activas** (subset with at least one `direction='in' + status='completed'` tx in the period): varies with the date filter window; default (no filter) shows the period-since-Sheet-inception count.
- **Profile data** flows correctly for arbitrary tikintags (`$mario`, `$tikincol`, etc.); 12-month chart shows zero-filled months as minPointSize=2 visible bars; mini-cards render `0` / `—` for empresas with no recent activity in any one of Bonos/Recargas/Payouts.

## Deviations

**0 plan-spec deviations on Tasks 1 + 2.** Plan executed as written; literal code blocks from `<action>` compiled clean on first build, all Plan-spec verify checks green, the 7-segment human-verify checkpoint approved on first pass.

**13th consecutive technical-zero-deviation plan** (after 02-04, 03-02, 03-03, 03-04, 04-03, 04-01, 04-02, 04-07, 04-08, 05-01, 05-03, 05-02).

**Operational note (not a deviation):** Task 3 (Vercel `--prod` deploy) executed at plan close on 2026-05-06 in orchestrator-direct continuation after the human-verify checkpoint approval. Vercel CLI was found at `/Users/alejoalmeida/.nvm/versions/node/v24.11.0/bin/vercel` (not on default PATH; required explicit PATH export — same as Plans 01-04, 04-08). Auth as `alejandro-9264` carried over from previous Phase 3/4 deploy sessions. Deploy ran clean in ~2 min total (~46s build + ~1m output upload + ~30s alias + finalize). Build output includes all 12 routes including the 2 new ones (`ƒ /clientes` + `ƒ /clientes/[empresaId]`).

## Phase 5 Status

Phase 5 (Clientes + Domain) cliente-facing flow is LIVE in production:
- `/clientes` — KPIs (Total empresas / Empresas activas) + sortable + searchable empresa table; row Links navigate to profile preserving date filter, stripping empresa.
- `/clientes/[empresaId]` — Profile header (empresa nombre + status + última actividad + 4 inline KPIs) + 12-month activity bar chart + 3 mini-cards (Bonos / Recargas / Payouts narrowed to that empresa via empresaFilters) + Generar vista para cliente button.
- **CLI-08 cliente-foco share-URL flow closes Phase 5 UX**: Generar vista navigates to `/inicio?empresa=$X&presenter=1` carrying date filter; /inicio cliente-foco contract enforced (3 visible KPIs / GMV chart / Comisión + Take rate hidden / EmpresasActivasChart hidden / HechosCurados hidden / chrome hidden).

**Plan 05-05 (custom domain dashboard.tikin.co)** is DEFERRED by user request — custom domain decision pending. INFRA-04 stays open until Plan 05-05 ships. Phase 5 is **4 of 5 plans complete** (05-01 + 05-02 + 05-03 + 05-04 done; 05-05 deferred). The cliente-flow shipped here works on the existing Vercel URL (`https://project-dashboard-z0fpsm5hl.vercel.app`) until Plan 05-05 routes `dashboard.tikin.co` to this same project.

The orchestrator should next: (a) run gsd-verifier on Phase 5 (4-of-5 plans), (b) update ROADMAP.md to mark Phase 5 partial-ship status, (c) wait for user decision on Plan 05-05 custom domain.
