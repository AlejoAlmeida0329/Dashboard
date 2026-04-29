# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation) — **COMPLETE**
Plan: 4 of 4 (Vercel Deploy + Production Smoke) — completed
Status: Phase 1 done. **Production live at https://project-dashboard-bkwmin189.vercel.app**. Ready for Phase 2 planning.
Last activity: 2026-04-29 — Completed 01-04-PLAN.md (Vercel deploy + production smoke + real Sheet headers captured)

Progress (Phase 1 plans): ██████████ 100% (4/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: ~14m
- Total execution time: ~57m (over 3 calendar days due to user_setup gates)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4/4 | ~57m | ~14m |

**Recent Trend:**
- 01-01 (11m 24s), 01-02 (7m 50s), 01-03 (13m 14s), 01-04 (~25m active + several gate-waits for GCP/Vercel/Upstash setup)
- Trend: 01-04 longer due to external-service setup checkpoints (GCP service account creation + Sheets API enable propagation + Vercel Marketplace Upstash). Future deploy plans should be faster (project + integrations already linked).

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

### Pending Todos

None yet.

### Blockers/Concerns

- **Vercel Deployment Protection ENABLED by default** — production URL requires Vercel SSO. For client demos (per PROJECT.md primary use case) USER must disable: https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/settings/deployment-protection → Vercel Authentication → Disabled. Or wait for Phase 5 (custom domain `dashboard.tikin.co`) which can route public.
- **Schema mismatch in `src/lib/domain/schemas.ts`** — Plan 04 captured real headers; current schemas use tentative names. Phase 2 first task: rewrite schemas to match actual BD_Plataforma columns (`tikintag`, `account_id`, `transaction_id`, `created_at`, `transaction_type`, `status`, `amount`, etc.). Live `/api/smoke` will fail with a clear "schema mismatch" error until then — that's expected behavior, not a bug.
- **Empresa identity column ambiguous** — BD_Plataforma has no explicit `empresa_id` or `empresa_nombre`. Phase 2 must ask user whether `tikintag`, `account_id`, or another column represents the corporate client of Tikin (vs. an end-user account).
- **3 v2 features now v1-eligible** — REC-V2-01 (Recargas success rate), PAY-V2-01 (Payouts success rate), PAY-V2-02 (Payouts failure breakdown). The data exists today (`status` in BD_Plataforma, `State` + `Failure Reason` in BD_Payouts). REQUIREMENTS.md should be updated by Phase 2 or a small docs phase.
- **GCP service account key NOT rotated** — `private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459` was leaked in chat history during Plan 04 setup. SA scope: Viewer on one Sheet only. User accepted to ship Phase 1; rotation procedure documented in 01-04-SUMMARY.md → Security Debt #1.
- **Password is `T1k1N` (5 chars)** — user-accepted. Mitigations: bcrypt cost 10 + Upstash sliding-window rate limit (5/5min/IP active in production). Rotation procedure documented in 01-04-SUMMARY.md → Security Debt #2.
- **Env vars only in Vercel `Production` target** — preview + development environments lack the 8 user vars (auth + GCP + Sheets). Future preview deploys will fail. Resolution procedure (loop over vars adding to preview + development) documented in 01-04-SUMMARY.md → Security Debt #3.
- **EmpresaFilter list is empty** — Phase 1 ships with `empresas={[]}`. Phase 2 (Bonos) will compute the empresa registry once schemas are rewritten and the empresa identity column is decided.

## Session Continuity

Last session: 2026-04-29 16:54 UTC
Stopped at: Completed 01-04-PLAN.md (Vercel deploy + production smoke). Phase 1 100% complete. 4 atomic commits across plans 01-04. Production live at https://project-dashboard-bkwmin189.vercel.app behind Vercel Deployment Protection. Ready for Phase 2 planning.
Resume file: None
