# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 2 of 4 (Sheets Adapter + Smoke Endpoint) — completed
Status: In progress — Plan 01-03 running in parallel; ready for Plan 01-04
Last activity: 2026-04-27 — Completed 01-02-PLAN.md (Sheets adapter + /api/smoke route)

Progress (Phase 1 plans): █████░░░░░ 50% (2/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 9m 37s
- Total execution time: 19m 14s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2/4 | 19m 14s | 9m 37s |

**Recent Trend:**
- Last 5 plans: 01-01 (11m 24s), 01-02 (7m 50s)
- Trend: ↓ faster (smaller scope; Plan 02 had 3 tasks vs Plan 01's 3-but-bigger tasks; deps already cached locally)

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

### Pending Todos

None yet.

### Blockers/Concerns

- Columna `status` (success/fail) en transacciones — no confirmada. Si la quieres en v1, hay que pulgarear primero la presencia/ausencia de la columna en Sheets antes de Phase 3.
- **`DASHBOARD_PASSWORD_HASH` is a placeholder** — bcrypt of `tikin-dev-2026`. User must rotate to a real password before Plan 04 (Vercel production).
- **Upstash creds empty in `.env.local`** — rate limiter fails open with one-time warning in dev. Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` MUST be set in Vercel before Plan 04 deploy.
- **GCP service account creds empty in `.env.local`** — `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEETS_TRANSACTIONS_ID`, `GOOGLE_SHEETS_PAYOUTS_ID`. Live Sheet read deferred to Plan 04. User must complete the GCP setup checklist (see 01-02-SUMMARY.md "User Setup Required") before Vercel deploy.
- **Tentative Sheet schema** — header names and tab names in `src/lib/domain/schemas.ts` and `src/lib/sheets/config.ts` are best guesses. Plan 04's first `/api/smoke` hit will validate; mismatch returns a clear error naming the missing columns. Adjust at that point, not now.

## Session Continuity

Last session: 2026-04-27 17:42 UTC
Stopped at: Completed 01-02-PLAN.md (Sheets adapter + /api/smoke). Plan 01-03 running in parallel; not yet stable on master at the time of this update — Plan 03's commit `cf8f643 feat(01-03): format module + URL state helpers` already landed but its full feature set is still in flight.
Resume file: None
