# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 2 — Bonos

## Current Position

Phase: 2 of 5 (Bonos) — in progress
Plan: 3 of 4 (Bonos UI components) — completed
Status: 4 visual leaves shipped (BonosChart, Leaderboard, KPICards, SalesTable). recharts ^2.15.4 installed as project chart library. Modo Presentación contract declarative via data-presenter-hide on 2 Card wrappers + 4 table cells. All numerics through format.ts (single Intl gate respected — verified by grep). Ready for Plan 02-04 (Bonos page composition: parseFilters → getCachedTransactions → filterBonos → 4 aggregations → 4 components).
Last activity: 2026-04-29 — Completed 02-03-PLAN.md (4 components in src/components/bonos/, recharts installed, presenter-hide contract emitted)

Progress (all plans, total 5+4+...): ██░░░░░░░░ 7/? (Phase 1 done 4/4; Phase 2 in progress 3/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: ~12m
- Total execution time: ~80m (over 3 calendar days due to user_setup gates)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4/4 | ~57m | ~14m |
| 02-bonos | 3/4 | ~23m | ~8m |

**Recent Trend:**
- 01-01 (11m 24s), 01-02 (7m 50s), 01-03 (13m 14s), 01-04 (~25m active + several gate-waits for GCP/Vercel/Upstash setup), 02-01 (11m 22s), 02-02 (8m 35s), 02-03 (3m 14s)
- Trend: 02-03 was the fastest plan executed yet (3m 14s) — pure UI leaf composition with no domain or infra surprises. Two micro Rule-1 fixes (redundant `$` prefix, unformatted count) caught at code-write time, not at build/lint. The recharts install (32 transitive packages) was the only "external" cost; React 19 compat was clean on first try. Phase 1's single Intl gate continues to absorb every numeric path without code-level Intl.NumberFormat appearing anywhere new.

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap (2026-04-27): 5-phase compression — Foundation, Bonos, Payouts, Inicio+Recargas, Clientes+Domain. Inicio antes de Clientes para que CLI-08 ("Generar vista para cliente") aterrice en Inicio populado.
- Requirements (2026-04-27): Success rate (Recargas + Payouts) y failure breakdowns diferidos a v2 por data assumptions; `destination_type` confirmado, habilita PAY-04.
- Plan 01-01 (2026-04-27): Session JWT 30-day expiry, bcrypt cost 10, cookie SameSite=lax, rate-limit 5/5min/IP via Upstash sliding window, two-layer auth (proxy gate + DAL re-verify), timing-safe bcrypt always runs.
- Plan 01-01 (2026-04-27): `proxy.ts` lives at `src/proxy.ts` (NOT project root) because Next 16 looks for the proxy file at the same level as `app/`, which is `src/` when `--src-dir` is enabled. Documented as Rule-1 deviation in 01-01-SUMMARY.md.
- Plan 01-02 (2026-04-27): Sheets adapter is the SINGLE place googleapis is imported. `'server-only'` enforced empirically (zero hits in `.next/static/*.js`). Future adapters (payouts.ts, etc.) follow the same shape: AdapterResult<T> + Expected{X}Headers + per-row Zod safeParse with skip-and-count semantics.
- Plan 01-02 (2026-04-27): Sheets client uses LAZY JWT singleton — module imports never throw, missing-creds error raised inside `getSheetsClient()` on first call. Lets parallel plans import the adapter without GCP creds set.
- Plan 01-02 (2026-04-27): Header names ('fecha','monto','tipo','empresa_id','empresa_nombre','destination_type') and tab names ('Transacciones','Payouts') are TENTATIVE. Plan 04 production smoke confirms vs live Sheet; mismatch surfaces as a clear schema error naming missing columns. Adjustment touches only `src/lib/domain/schemas.ts` and (if tab name differs) `src/lib/sheets/config.ts`.
- Plan 01-02 (2026-04-27): Smoke endpoint lives at `/api/smoke`, NOT `/api/_smoke` — Next App Router treats `_`-prefixed folders as PRIVATE (non-routable). Documented as Rule-1 deviation in 01-02-SUMMARY.md.
- Plan 01-02 (2026-04-27): `withRetry` retries ONLY on 429 (default 3 retries, base 250ms, cap 4s, jitter). Non-429 errors re-thrown immediately so schema mismatches and auth failures aren't masked by retry backoff.
- Plan 01-03 (2026-04-27): URL-as-state for ALL dashboard filters (from, to, empresa, presenter). `parseFilters(searchParams)` on read, `router.push(buildUrl(pathname, filters))` on write. Sticky across navigation, shareable, server-renderable. Future filter dimensions extend `DashboardFilters` in `src/lib/url-state.ts`; TabNav and PresenterToggle inherit them automatically via spread.
- Plan 01-03 (2026-04-27): `src/lib/format.ts` is the single Intl gate of the project. Verified by grep on every commit — no other file in `src/**/*.{ts,tsx}` calls `Intl.NumberFormat` or `toLocaleString`. Pitfall 9 (currency drift) and Pitfall 10 (timezone drift) closed at the codebase level.
- Plan 01-03 (2026-04-27): Layouts cannot read `searchParams` in App Router (don't re-render on soft nav). Documented as Rule-1 deviation in 01-03-SUMMARY.md. PresenterFrame and LastRefresh are `'use client'` wrappers reading `useSearchParams`. Future plans: any UI that must react to URL changes lives in Client Components, NOT in Server layouts.
- Plan 01-03 (2026-04-27): `data-presenter='on'|'off'` + `data-presenter-hide` is the visual contract for presenter mode. CSS does the hiding/typography bump declaratively. JS only flips the URL.
- Plan 01-03 (2026-04-27): EmpresaFilter accepts `empresas: EmpresaOption[]` and renders gracefully on `[]`. Phase 2+ feeds it real data without component changes.
- Plan 01-04 (2026-04-29): Vercel project `project-dashboard` linked under scope `alejandro-almeidas-projects-5f343d98`. Region pinned to `iad1`. Production URL: `https://project-dashboard-bkwmin189.vercel.app`.
- Plan 01-04 (2026-04-29): Upstash Redis provisioned via Vercel Marketplace integration (NOT direct Upstash account). Marketplace injects `KV_REST_API_*` env vars; we manually aliased `UPSTASH_REDIS_REST_URL`/`_TOKEN` so existing code works unchanged.
- Plan 01-04 (2026-04-29): Sheets config tab names corrected from tentative `Transacciones`/`Payouts` to real `BD_Plataforma`/`BD_Payouts`. Both data sources live in ONE Sheet ID (`1X0o...QObA`), separated by tabs.
- Plan 01-04 (2026-04-29): Real BD_Plataforma headers (23 cols) and BD_Payouts headers (15 cols) captured live. Documented verbatim in 01-04-SUMMARY.md. Schema in `src/lib/domain/schemas.ts` is now KNOWN-MISMATCHED — Phase 2's first task is rewriting it.
- Plan 01-04 (2026-04-29): Vercel CLI's `vercel integration add` overwrote `.env.local` mid-flow, deleting 8 secrets. Recovery via Anthropic chat history (orchestrator only — agents don't have this fallback). Forward guidance: any future plan that runs Marketplace integrations should pull or back up `.env.local` first.
- Plan 02-01 (2026-04-29): Domain `Transaction` interface rewritten to match real BD_Plataforma. Fields: id (from transaction_id), fecha (from created_at), monto, grossAmount, comision (= total_transaction_fee), fixedFee, variableFeePct (0..1 fraction), tipo, direction, status, empresa_id, empresa_nombre, tikintag, accountId, reference?, destination_type?. `transactions.ts` adapter unchanged — Phase 1's pipeline is genuinely Sheet-shape-independent.
- Plan 02-01 (2026-04-29): TransactionType enum derived from live data (11 values + OTRO fallback): BONUS, CREDIT_ADJUSTMENT, FEE, P2P, PAYIN_PSE, PAYIN_TRANSFER, PAYOUT_BANK, PURCHASE, REFUND, TREASURY, UKNOWN. "UKNOWN" preserved verbatim (sic — typo in production data). TransactionDirection: in/out. TransactionStatus: completed/rejected.
- Plan 02-01 (2026-04-29): empresa_id default = tikintag (e.g. `$mario`, `$tikincol`, `$liftit-app`-shaped handles). Override to account_id is a 2-line edit confined to `src/lib/domain/schemas.ts` transform. tikintag chosen over account_id because it's human-readable and aligns with Tikin's existing addressing scheme; account_id (UUID) would force a separate display lookup that doesn't exist in BD_Plataforma yet. Phase 5 (Clientes) is the natural place to add a tikintag → empresa display-name mapping if needed.
- Plan 02-01 (2026-04-29): variable_fee_percentage stored in Sheet as whole percent (0..100), confirmed live via /api/diagnose: range 0..4.76, samples [0, 3.5, 3.99, 4.56, 4.76]. Schema accepts up to 100 and divides by 100 in transform. The `Transaction.variableFeePct` contract is fraction-only (0..1) so consumers do `monto * variableFeePct` directly. Caught as Rule-1 bug after first smoke run showed 45% skip rate; fix dropped skip rate to 1.36%.
- Plan 02-01 (2026-04-29): Diagnostic-then-cleanup pattern. Temporary `_diagnose.ts` + `/api/diagnose` route created mid-plan to capture distinct enum values from production before writing schema; deleted before final commit. Production never carried inspection-only code. Single commit shows only the rewrite + cleanup state.
- Plan 02-01 (2026-04-29): /api/smoke verified green against production (count=3188, skipped=44, 1.36%). 3188 + 44 = 3232 matches the row count from 01-04-SUMMARY.md exactly. Remaining 44 skips are rows with empty transaction_id (genuinely malformed).
- Plan 02-02 (2026-04-29): `bonos.ts` is a PURE module — no `next/`, no `server-only`, no `react`. Imports limited to `./types` and `@/lib/url-state` (type-only). Functions: `filterBonos` + `summarizeBonos` + `aggregateBonosByDate` + `aggregateBonosByEmpresa` + `top10Empresas`. Output types `BonoSummary` / `BonoByDate` / `BonoByEmpresa` are stable contracts for Plans 03 and 04 UI consumers.
- Plan 02-02 (2026-04-29): Default Bonos filter contract = `tipo='BONUS' + direction='in' + status='completed'` + Bogota-anchored from/to + optional empresa. Documented inline in jsdoc and in 02-02-SUMMARY.md "Bonos Filter Contract" so override is explicit. `pending` (if Tikin adds it) falls through to `OTRO_STATUS` and is auto-excluded; types.ts grows when Tikin officially supports the value.
- Plan 02-02 (2026-04-29): `aggregateBonosByDate` does NOT zero-fill missing days. Bono density is high (~3000 BD_Plataforma rows over ~90 days, BONUS being the largest single tipo) so the chart lib in Plan 03 handles continuous-axis spacing. Zero-fill would also make the dashboard look like the source of truth on "no-sale days" — which it isn't.
- Plan 02-02 (2026-04-29): `pctDelTotal` is computed against the input passed to `aggregateBonosByEmpresa` (already filtered), not the universe of transactions. Matches "% of bonos in the current view" reading.
- Plan 02-02 (2026-04-29): Date filter uses literal `${date}T00:00:00-05:00` / `T23:59:59.999-05:00` offsets instead of `new Date(date)`. Closes the silent off-by-one where naked `new Date('2026-04-01')` parses to UTC midnight = 19:00 prev day in Bogotá. Same convention as `url-state.ts`.
- Plan 02-02 (2026-04-29): `getCachedTransactions = cache(getTransactions)` from React. Same-request memoization (DashboardHeader + page share one Sheets fetch); zero cross-request caching so "lectura en vivo" per PROJECT.md is preserved. Use `getCachedTransactions` from any Server Component in the `(protected)/layout.tsx` render tree; use `getTransactions` from route handlers, server actions, scripts.
- Plan 02-02 (2026-04-29): `DashboardHeader` is now async. Reads transactions, computes empresa registry via `getEmpresaRegistry`, passes real `EmpresaOption[]` to `<EmpresaFilter>`. Try/catch around the read → on Sheet failure the dropdown renders empty (Phase 1 behavior) and the error surfaces on the data-bearing page; chrome never breaks.
- Plan 02-02 (2026-04-29): Empresa registry sort uses `Intl.Collator('es', { sensitivity: 'base', numeric: true })`. The `numeric: true` is key for tikintags shaped like `$1anderson`/`$11john` — orders numeric segments as numbers, not lexically. Plan said `localeCompare(b.nombre, 'es')`; Rule-1 refinement because plain localeCompare would order `$1` < `$11` < `$2`. Documented as deviation in 02-02-SUMMARY.md.
- Plan 02-02 (2026-04-29): Production verification — /inicio HTTP 200, dropdown shows 234 options (1 default + 233 real empresas, alphabetical es-collated), `?empresa=$mario` correctly renders selected. /bonos same 234 options (header is shared). /api/smoke still ok=true count=3188 skipped=44.
- Plan 02-03 (2026-04-29): Chart library = recharts ^2.15.4. Selected over nivo (loads d3 entirely → bundle inflation), visx (primitives kit, not chart lib → time cost), raw SVG (no axes/tooltip/responsive for free). React 19 compatible cleanly. Override path documented: BonosChart.tsx is a self-contained leaf — swap recharts→nivo or recharts→visx by editing only that file. No override happened during execution; recharts compiled clean on first try.
- Plan 02-03 (2026-04-29): BonosChart is the ONLY 'use client' component of the Bonos UI. Recharts ResponsiveContainer needs DOM (window resize listener). Leaderboard, KPICards, SalesTable are pure Server Components — zero hydration cost, static HTML on those leaves. Pattern reusable for Phase 3+ (Recargas trend, Payouts trend, Inicio mini-charts).
- Plan 02-03 (2026-04-29): Chart line uses `stroke="currentColor"` not a hardcoded hex. The wrapping page sets `text-{token}` and the line follows. Theme switches don't touch the chart; light/dark works without conditional logic. Same pattern reusable for future trend charts.
- Plan 02-03 (2026-04-29): BonosChart does NOT carry `data-presenter-hide`. The chart is the heroína — visible in BOTH internal AND presenter views. Modo Presentación + filtro empresa transforms the tab into a "vista 1-cliente" by reshaping the data feed, NOT by hiding the chart. The "cliente sees only their data" contract comes from the URL filter (Plan 04 wires it), not from visibility toggles here.
- Plan 02-03 (2026-04-29): KPI Ticket promedio is ALWAYS visible (both internal + presenter). Only Comisión total carries `data-presenter-hide`. Matches roadmap Success Criteria 4 and 02-CONTEXT.md vision (cliente needs to see "what's our average sale" of their own data; revenue/comisión stays internal-only).
- Plan 02-03 (2026-04-29): SalesTable hides th + every td of the last 2 cols ($ comisión, % del total). CSS `display: none` on `display:table-cell` works per-cell — browser table layout absorbs freed space across remaining cols. No explicit width recalculation needed in the component. Plan 04 will visually confirm the table doesn't shift jaggedly during the mode transition; if it does, the fix is `<col>` widths inside SalesTable (5-line addition).
- Plan 02-03 (2026-04-29): Two Rule-1 micro-fixes during Task 3 — (a) removed redundant `$` prefix in `Sobre {formatCOP(...)} vendidos` (formatCOP already prepends '$ ', double-dollar would have rendered); (b) replaced bare `${summary.count}` with `formatInteger(summary.count)` (3000+ counts need thousands grouping per Colombian convention). Both documented in 02-03-SUMMARY.md "Deviations" so the patterns don't recur in future plans.

### Pending Todos

None yet.

### Blockers/Concerns

- **Vercel Deployment Protection ENABLED by default** — production URL requires Vercel SSO. For client demos (per PROJECT.md primary use case) USER must disable: https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/settings/deployment-protection → Vercel Authentication → Disabled. Or wait for Phase 5 (custom domain `dashboard.tikin.co`) which can route public.
- **3 v2 features now v1-eligible** — REC-V2-01 (Recargas success rate), PAY-V2-01 (Payouts success rate), PAY-V2-02 (Payouts failure breakdown). The data exists today (`status` in BD_Plataforma confirmed `completed`/`rejected` live; `State` + `Failure Reason` in BD_Payouts captured by 01-04). REQUIREMENTS.md should be updated by Phase 2 or a small docs phase.
- **GCP service account key NOT rotated** — `private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459` was leaked in chat history during Plan 04 setup. SA scope: Viewer on one Sheet only. User accepted to ship Phase 1; rotation procedure documented in 01-04-SUMMARY.md → Security Debt #1.
- **Password is `T1k1N` (5 chars)** — user-accepted. Mitigations: bcrypt cost 10 + Upstash sliding-window rate limit (5/5min/IP active in production). Rotation procedure documented in 01-04-SUMMARY.md → Security Debt #2.
- **Env vars only in Vercel `Production` target** — preview + development environments lack the 8 user vars (auth + GCP + Sheets). Future preview deploys will fail. Resolution procedure (loop over vars adding to preview + development) documented in 01-04-SUMMARY.md → Security Debt #3.
- **TransactionType.UKNOWN is a real value in production data** (sic — typo). Schema preserves it verbatim rather than silently mapping to OTRO so the data-quality issue stays visible in dashboards. User owns source-side cleanup at the Sheet.
- **Same tikintag may map to multiple wallets per empresa** — e.g. Liftit might have a corporate `$liftit-app` wallet and individual employee wallets with different tikintags. Today they appear as separate "empresas" in the dashboard (233 unique tikintags surfaced in production). Phase 5 (Clientes/Domain) is the natural place to introduce a many-to-one tikintag → empresa display-name mapping if Tikin confirms that's needed.
- **Bonos default filter excludes `direction=out` and `status=rejected` silently.** This is intentional — refunds are recorded as separate `REFUND` tipo rows so excluding `out` here doesn't double-count, and rejected transactions never carried money. But if Tikin asks "why does the count differ from my Sheet pivot?", the gap is here. Documented inline in 02-02-SUMMARY.md "Bonos Filter Contract".

**Resolved this session:**
- ~~Schema mismatch in `src/lib/domain/schemas.ts`~~ — closed by Plan 02-01. /api/smoke green: count=3188, skipped=44.
- ~~Empresa identity column ambiguous~~ — decided in Plan 02-01: default = tikintag (override is 2-line edit in schemas.ts).
- ~~EmpresaFilter list is empty~~ — closed by Plan 02-02. Production verification: 233 unique empresas in dropdown, Spanish-collated, URL filter works (`?empresa=$mario` selects correctly).

## Session Continuity

Last session: 2026-04-29 22:07 UTC
Stopped at: Completed 02-03-PLAN.md (4 visual leaves in src/components/bonos/, recharts ^2.15.4 installed, declarative presenter-hide contract emitted). Phase 2 in progress (3/4). All numerics flow through format.ts (single Intl gate verified by grep). Plan 02-04 (Bonos page composition) is the remaining work for Phase 2 — it parses URL filters, fetches via getCachedTransactions, runs filterBonos + 4 aggregations, and feeds the 4 components. After Plan 04 ships and is production-verified, Phase 2 closes and Phase 3 (Payouts) can start with the recharts pattern, presenter-hide pattern, and Server-Component-default leaf shape established here.
Resume file: None
