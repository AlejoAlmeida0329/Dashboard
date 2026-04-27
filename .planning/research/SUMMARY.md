# Project Research Summary

**Project:** Tikin Dashboard
**Domain:** B2B fintech operations dashboard (read-only, Next.js + Google Sheets API, internal use + client presentations)
**Researched:** 2026-04-27
**Confidence:** HIGH

## Executive Summary

Tikin Dashboard is a low-traffic, read-only operations dashboard with a doubly-served audience (internal team + projection to corporate clients in calls). Research across stack, features, architecture, and pitfalls converges on a clear, low-risk path: a Next.js 16.2 (App Router) app with Server Components fetching live from Google Sheets via the official `googleapis` Node SDK, gated by a single shared password (bcrypt-hashed env var + `jose` JWT in HttpOnly cookie + `proxy.ts` boundary), styled with shadcn/ui + Recharts, deployed on Vercel.

The dominant risk is not the stack — it's the seam between the dashboard and Google Sheets. Three problems compound: (a) the binding rate limit is **60 reads/min per service account**, not the much-quoted 300/min/project; (b) Sheets schema is brittle (a renamed column silently breaks production); and (c) the "project to clients in calls" use case raises the cost of any failure to embarrassing — a blank screen, a slow load, or a filter leak that exposes another client's data is a credibility event. The roadmap must front-load a "skeleton phase" (auth + Sheets adapter + layout shell + loading/error states) that concretizes these defenses before any tab is built.

The feature landscape is well-understood: ~6 KPIs on Inicio is the industry ceiling, Payouts is the highest-leverage tab for differentiation (P50/P95 latency, success rate, failures by cause), and a "Presenter Mode" that hides revenue/comisión/leaderboards when projecting to clients is the keystone for the client-call workflow. About 30% of the highest-value features depend on three Sheet columns whose presence has not been confirmed (`status`, `failure_reason`, `destination_type`) — the first task of `/gsd:define-requirements` should be confirming/adding those.

## Key Findings

### Recommended Stack

Next.js 16.2 (App Router) is the right call. Server Components fetch Sheets directly with `cache: 'no-store'` (no SWR, no Route Handlers, no ISR). Auth is the standard Next.js pattern from the official docs: bcrypt-hashed shared password env var, Server Action signs a `jose` JWT into an HttpOnly+Secure+SameSite cookie, `proxy.ts` (renamed from `middleware.ts` in v16) verifies it. UI is shadcn/ui (Tailwind v4) + Recharts (which shadcn `chart` uses under the hood) + TanStack Table v8 via shadcn `data-table`. Deployment is Vercel Hobby (sufficient — function timeout is 10s, Sheets `batchGet` is sub-second; Vercel-native Password Protection is paid-tier, off the table on Hobby).

**Core technologies:**
- **Next.js 16.2 App Router**: framework — Server Components are the right primitive for live Sheets reads; `proxy.ts` Node-runtime gate is now default
- **`googleapis` Node SDK**: Sheets adapter — `spreadsheets.values.batchGet` to coalesce reads under the 60/min/service-account quota; Node runtime only (Edge will not work)
- **`jose` + bcrypt**: auth — JWT in HttpOnly cookie + bcrypt-hashed password env var; rate-limit the login endpoint with Upstash
- **shadcn/ui + Tailwind v4 + Recharts + TanStack Table v8**: UI — single coherent stack, all client-component-friendly, presentable enough to project to clients
- **Zod**: schema validation at the Sheets boundary — every row goes through a parse; bad rows are logged, not silently dropped

Detail in [STACK.md](./STACK.md).

### Expected Features

The 5 tabs match the standard B2B fintech ops dashboard: an overview, three transaction-type tabs, a customer profile tab. Inicio should ship 6–8 KPIs (resist 12+; trends and deltas tell more than additional cards). Payouts is where Tikin can differentiate with success rate + P50/P95 + failures-by-cause + destination split — Tikin already has the payout-times Sheet, so the data is there. Bonos is the revenue tab: sales by company, period, average ticket, comisión earned, top customers. Recargas and Clientes are more conventional. Presenter Mode is a cross-cutting must-have given the client-call use case.

**Must have (table stakes):**
- Inicio: total volume, take rate / comisión, active corporate clients, payout success rate, MoM growth, date range filter
- Bonos: sales by company, sales over time, comisión earned, average ticket
- Recargas: volume over time, by company, success vs failure
- Payouts: success rate, average time-to-payout, failures by cause, destination split (tarjeta vs banco)
- Clientes: list with last activity, lifetime value (rolling 90-day $ for Tikin's % model), per-cliente drill-down
- Cross-cutting: shared cliente filter, date range filter via URL `searchParams` (shareable), loading skeletons + error boundaries (no blank screens)

**Should have (competitive):**
- Presenter Mode toggle (one switch hides revenue, take rate, comisión, top-empresas leaderboards) — keystone for client calls
- P50/P95 payout latency badges per destination type
- "Generate client view" button (auto-filters + enables Presenter Mode for a chosen empresa)
- Compare to previous period delta on every KPI

**Defer (v2+):**
- Per-end-user drill-down
- ML forecasts / anomaly detection
- Manual retry buttons (write operations explicitly out of scope)
- Real-time WebSocket updates (live reads on page load is enough)
- Per-user login / role-based access

Detail in [FEATURES.md](./FEATURES.md).

### Architecture Approach

A standard Next.js 16.2 App Router layout. The single most important design boundary is `src/lib/sheets/<sheet>.ts` exporting `Promise<DomainType[]>` — this is the seam between Sheets specifics and the rest of the app. `lib/domain/` stays data-source-agnostic so an eventual swap from Sheets to Tikin's core API replaces function bodies, not call sites. Pages are Server Components that import these adapters and render charts (Recharts/Tremor are necessarily Client Components — they receive plain data props). Filters live in URL `searchParams`, not React state, so URLs are shareable for client demos.

**Major components:**
1. **Auth gate** — `proxy.ts` verifies cookie on every request; `lib/auth/` contains login Server Action, session helpers, `verifySession()` DAL
2. **Sheets adapter layer** — `lib/sheets/transactions.ts`, `lib/sheets/payout-times.ts`, etc. Each exports typed domain rows; Zod validates schema; one file per Sheet so adding a new Sheet is additive
3. **Domain types** — `lib/domain/{transaction, bono, recarga, payout, cliente}.ts` — pure types, no Sheets concepts leak in
4. **App shell** — `app/(protected)/layout.tsx` with tab nav, `app/(public)/login/page.tsx`; per-tab routes under `app/(protected)/{inicio,bonos,recargas,payouts,clientes}`
5. **UI primitives** — `components/ui/` (shadcn) + `components/charts/` (chart wrappers) + `components/filters/` (date range, cliente picker, presenter-mode toggle)

Detail in [ARCHITECTURE.md](./ARCHITECTURE.md).

### Critical Pitfalls

Top 6 from PITFALLS.md (all severity Critical):

1. **Service-account JSON leak** — never commit, never ship to client bundle. Split into two env vars (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`), mark Sensitive on Vercel, handle `\n` escape at runtime. Reference: Vercel April 2026 incident.
2. **Filter leak across clientes** — when projecting to client A, accidentally show client B's data. Prevent by stable client IDs (not display names), centralized cliente filter that defaults to "internal" view, automated test that checks filtered output never contains other client IDs.
3. **Sheets schema brittleness** — column gets renamed, dashboard silently shows wrong numbers. Address columns by header name (not index), validate schema with Zod at boot/first read, fail loud not silent.
4. **Plain-text password + no rate limit** — store bcrypt hash, use timing-safe compare, rate-limit login with Upstash (5 attempts / 5 min / IP).
5. **Blank-screen-during-demo** — Sheets call slow + no skeleton + no error fallback = catastrophic during a client call. Mandatory `loading.tsx` and `error.tsx` per route from Phase 0.
6. **Treating Sheets as authoritative** — running totals don't match because reversals double-count, currency mixed (COP vs USD), timezone bugs. Validate at the adapter, normalize to a single currency for display, use `date-fns-tz` for all dates.

Detail in [PITFALLS.md](./PITFALLS.md).

## Implications for Roadmap

The research strongly suggests a **skeleton-first** roadmap. Every tab depends on the same scaffolding (auth, Sheets adapter, layout, loading/error). Build it once, well, then iterate per tab.

### Phase 1: Skeleton (Auth + Sheets Adapter + Shell)
**Rationale:** Auth gate, Sheets adapter, and layout-with-empty-tabs are dependencies of every other phase. Doing them once correctly prevents 10 of the 18 documented pitfalls from ever occurring.
**Delivers:** Deployed Vercel app at a placeholder URL where login works, all 5 tab routes render an empty layout, Sheets adapter can read from the transactions Sheet with Zod validation, `proxy.ts` blocks unauthenticated access, `loading.tsx` and `error.tsx` exist on every route.
**Addresses:** Auth + cross-cutting infrastructure from FEATURES.md
**Avoids:** Pitfalls 1, 3, 4, 5, 6 (service account leak, schema brittleness, password handling, blank screen, currency/timezone)
**Uses:** Next.js 16.2, googleapis, jose, bcrypt, Zod, shadcn shell, Upstash rate-limit
**Implements:** Auth gate + Sheets adapter layer + app shell from ARCHITECTURE.md

### Phase 2: Bonos (revenue tab — most familiar data shape)
**Rationale:** Bonos is the revenue tab and the most direct read of the existing transactions Sheet. It exercises the full pipeline (Sheet → adapter → domain → page → chart) on a single tab end-to-end.
**Delivers:** Sales by empresa, sales over time, comisión earned, average ticket, top empresas, date range filter, cliente filter.
**Uses:** Sheets adapter from Phase 1, Recharts + TanStack Table from stack, URL `searchParams` filters

### Phase 3: Payouts (highest differentiator, second-Sheet integration)
**Rationale:** Forces the second Sheet integration (payout-times) early. Highest-value tab per FEATURES.md. The P50/P95 + success rate work informs how Inicio aggregates show payouts.
**Delivers:** Success rate, P50/P95 latency, failures by cause, destination split (tarjeta vs banco), SLA badges per destination.

### Phase 4: Recargas
**Rationale:** Conventional pattern, builds on the same infrastructure as Bonos.
**Delivers:** Volume over time, by company, success vs failure.

### Phase 5: Clientes (cross-cutting cliente filter cements here)
**Rationale:** Clientes tab is per-client profile + list. Cliente filter is naturally centered on this data, and Presenter Mode design depends on cliente identity being clean.
**Delivers:** Cliente list with last activity + rolling 90-day $, per-cliente drill-down, "Generate client view" button (auto-filters + Presenter Mode).

### Phase 6: Inicio (real KPIs — derivative of all tabs above)
**Rationale:** Inicio aggregates across the other tabs. Building it last means the aggregations reuse work already done. A stub from Phase 1 means stakeholders had a URL to look at the whole time.
**Delivers:** 6–8 KPI cards, MoM trend, comisión-earned hero number, payout success-rate badge, sales-over-time chart, Presenter Mode toggle.

### Phase 7: Domain migration & Presenter Mode polish
**Rationale:** Custom domain (`dashboard.tikin.co`), Presenter Mode hide-list refined with sales-team feedback, performance pass.

### Phase Ordering Rationale

- **Skeleton first** because every tab depends on auth + Sheets adapter + layout. Building tabs first and adding auth later means auth retrofits (always painful).
- **Bonos before Payouts** because Bonos is one Sheet (transactions, already there), Payouts is two (transactions + payout-times) — single-Sheet end-to-end first reduces variables.
- **Inicio last** because it's *derivative*: real KPIs are aggregations of per-tab work. Building it first means rebuilding when the per-tab definitions land.
- **Clientes before Inicio** because Inicio's "active corporate clients" KPI depends on cliente identity being stable, which Phase 5 nails down.
- **Domain migration last** because all that's standard Vercel work; no reason to spend time there until the product is solid.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Skeleton):** moderate — auth pattern is well-documented but the exact Zod schema design depends on the actual Sheets columns. `/gsd:define-requirements` should confirm the columns first.
- **Phase 5 (Clientes):** if rolling 90-day $ aggregation and cliente health-score logic are wanted, that's domain-specific work not fully covered here.
- **Phase 7 (Polish):** Presenter Mode hide-list needs sales-team input — not a research question, a stakeholder one.

Phases with standard patterns (skip research-phase):
- **Phase 2 (Bonos), 3 (Payouts), 4 (Recargas):** standard chart + table + filter patterns, all covered by FEATURES.md and ARCHITECTURE.md.
- **Phase 6 (Inicio):** KPI aggregation is straightforward once the per-tab work exists.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against Next.js 16.2 official docs (Apr 2026), Google Sheets API limits docs, Vercel docs, shadcn docs |
| Features | HIGH | Cross-validated across 4+ fintech KPI references (Stripe, Razorpay, DigitalDefynd, Finro, Custify); MEDIUM-HIGH on cliente health pattern |
| Architecture | HIGH | Verified against Next.js 16.2 project-structure, fetching-data, and proxy.ts reference docs; MEDIUM on build-order judgment (Inicio-last is opinionated) |
| Pitfalls | HIGH | Quotas verified from official Google docs; Vercel April 2026 incident referenced for env var handling; MEDIUM on fintech reconciliation specifics (need Tikin data confirmation) |

**Overall confidence:** HIGH

### Gaps to Address

These should be resolved during `/gsd:define-requirements` or early in Phase 1, not by more research:

- **Sheet schema confirmation** — does the transactions Sheet have `status`, `failure_reason`, `destination_type` columns? ~30% of the most-valuable features depend on these. If not, lowest-cost fix is adding them upstream before Phase 2.
- **Stable cliente identity in Sheets** — names alone are filter-leak prone. Need a stable client ID column (slug or numeric).
- **Reversal/refund data model** — how are they recorded today? Affects how to avoid double-counting in totals.
- **Currency mix** — COP only? COP + USD? Affects display normalization.
- **Presenter Mode hide-list** — exact items need sales-team sign-off, not research.
- **"Live" tolerance** — is a 30-second cache acceptable to call it "live"? Would massively help Sheets quota headroom and demo reliability.

## Sources

### Primary (HIGH confidence)
- Next.js 16.2 official docs (Authentication, Fetching Data, proxy.ts, Project Structure, Edge Runtime, Error Handling, loading.js) — `nextjs.org/docs`
- Next.js 16 release blog — `nextjs.org/blog/next-16`
- Google Sheets API Usage Limits (April 2026) — `developers.google.com/workspace/sheets/api/limits`
- Google Sheets API Read & Write Cell Values — `developers.google.com/workspace/sheets/api/guides/values`
- shadcn/ui Chart docs — `ui.shadcn.com/docs/components/chart`
- Vercel Functions Limits, Sensitive Environment Variables, Fluid Compute, April 2026 security bulletin — `vercel.com/docs`
- Stripe Web Dashboard documentation — `docs.stripe.com/dashboard/basics`
- google-auth-library-nodejs and googleapis Node clients — `github.com/googleapis/`

### Secondary (MEDIUM confidence)
- Razorpay, Clearly Payments, Count.co, IXOPAY — payment success rate practices
- DigitalDefynd 20 Important Fintech KPIs (2026), Finro Fintech KPI Guide
- Custify, Chameleon — customer health score patterns
- Geckoboard, ChartMogul — ARPA / SaaS revenue patterns
- Pluxee, HealthJoy — corporate benefits platform patterns
- AgencyAnalytics, TapClicks — presentation mode / dashboard export patterns
- Earezki — Hardening Next.js 15 Login (timing attacks)

### Tertiary (LOW confidence — needs validation)
- Recharts 3.8.x React 19 peer dep behavior — works but `--legacy-peer-deps` may be needed on first install; verify at install time
- Exact `googleapis` minor version — npm page returned 403; resolve with `npm view googleapis version` at install time

---
*Research completed: 2026-04-27*
*Ready for roadmap: yes*
