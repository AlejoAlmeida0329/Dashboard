# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 2 — Bonos

## Current Position

Phase: 2 of 5 (Bonos) — in progress
Plan: 1 of 4 (Schemas Rewrite) — completed
Status: Schema mismatch blocker closed. `/api/smoke` green against production (count=3188, skipped=44, 1.36%). Ready for Plan 02-02 (Bonos tab UI).
Last activity: 2026-04-29 — Completed 02-01-PLAN.md (rewrote domain schema to real BD_Plataforma headers; transaction_type/direction/status enums grounded in live data; empresa_id default = tikintag)

Progress (all plans, total 5+4+...): █░░░░░░░░░ 5/? (Phase 1 done 4/4; Phase 2 in progress 1/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~14m
- Total execution time: ~68m (over 3 calendar days due to user_setup gates)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4/4 | ~57m | ~14m |
| 02-bonos | 1/4 | ~11m | ~11m |

**Recent Trend:**
- 01-01 (11m 24s), 01-02 (7m 50s), 01-03 (13m 14s), 01-04 (~25m active + several gate-waits for GCP/Vercel/Upstash setup), 02-01 (11m 22s)
- Trend: 02-01 came in at ~11m despite a Rule-1 deviation (vfp range bug) and 2 production deploys. Plan 1's architectural seam (header-name lookup + Zod parse-and-skip) made the rewrite cheap — the adapter (transactions.ts) didn't need a single change.

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

### Pending Todos

None yet.

### Blockers/Concerns

- **Vercel Deployment Protection ENABLED by default** — production URL requires Vercel SSO. For client demos (per PROJECT.md primary use case) USER must disable: https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/settings/deployment-protection → Vercel Authentication → Disabled. Or wait for Phase 5 (custom domain `dashboard.tikin.co`) which can route public.
- **3 v2 features now v1-eligible** — REC-V2-01 (Recargas success rate), PAY-V2-01 (Payouts success rate), PAY-V2-02 (Payouts failure breakdown). The data exists today (`status` in BD_Plataforma confirmed `completed`/`rejected` live; `State` + `Failure Reason` in BD_Payouts captured by 01-04). REQUIREMENTS.md should be updated by Phase 2 or a small docs phase.
- **GCP service account key NOT rotated** — `private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459` was leaked in chat history during Plan 04 setup. SA scope: Viewer on one Sheet only. User accepted to ship Phase 1; rotation procedure documented in 01-04-SUMMARY.md → Security Debt #1.
- **Password is `T1k1N` (5 chars)** — user-accepted. Mitigations: bcrypt cost 10 + Upstash sliding-window rate limit (5/5min/IP active in production). Rotation procedure documented in 01-04-SUMMARY.md → Security Debt #2.
- **Env vars only in Vercel `Production` target** — preview + development environments lack the 8 user vars (auth + GCP + Sheets). Future preview deploys will fail. Resolution procedure (loop over vars adding to preview + development) documented in 01-04-SUMMARY.md → Security Debt #3.
- **EmpresaFilter list is empty** — Phase 1 ships with `empresas={[]}`. Plan 02-02 will compute the unique empresa registry from `getTransactions()` rows (using `Transaction.empresa_id`/`Transaction.empresa_nombre`, default = tikintag). Schema is now ready (closes the prior "empresa identity ambiguous" concern); only the UI-side wiring remains.
- **TransactionType.UKNOWN is a real value in production data** (sic — typo). Schema preserves it verbatim rather than silently mapping to OTRO so the data-quality issue stays visible in dashboards. User owns source-side cleanup at the Sheet.
- **Same tikintag may map to multiple wallets per empresa** — e.g. Liftit might have a corporate `$liftit-app` wallet and individual employee wallets with different tikintags. Today they appear as separate "empresas" in the dashboard. Phase 5 (Clientes/Domain) is the natural place to introduce a many-to-one tikintag → empresa display-name mapping if Tikin confirms that's needed.

**Resolved this session:**
- ~~Schema mismatch in `src/lib/domain/schemas.ts`~~ — closed by Plan 02-01. /api/smoke green: count=3188, skipped=44.
- ~~Empresa identity column ambiguous~~ — decided in Plan 02-01: default = tikintag (override is 2-line edit in schemas.ts).

## Session Continuity

Last session: 2026-04-29 21:44 UTC
Stopped at: Completed 02-01-PLAN.md (schemas rewrite to real BD_Plataforma headers). Phase 2 in progress (1/4). /api/smoke verde contra producción (count=3188, skipped=44, 1.36%). Latest production deploy: https://project-dashboard-44v5hovqa.vercel.app. Domain types are now grounded in live data — Plans 02-02 through 02-04 can consume Transaction/TransactionType/TransactionStatus with confidence.
Resume file: None
