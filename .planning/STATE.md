# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 1 of 4 (Bootstrap + Auth Gate) — completed
Status: In progress — ready for Plan 01-02
Last activity: 2026-04-27 — Completed 01-01-PLAN.md (Next.js bootstrap + auth gate)

Progress (Phase 1 plans): ██░░░░░░░░ 25% (1/4)

## Performance Metrics

**Velocity:**
- Total plans completed: 1
- Average duration: 11m 24s
- Total execution time: 11m 24s

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 1/4 | 11m 24s | 11m 24s |

**Recent Trend:**
- Last 5 plans: 01-01 (11m 24s)
- Trend: — (insufficient data)

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap (2026-04-27): 5-phase compression — Foundation, Bonos, Payouts, Inicio+Recargas, Clientes+Domain. Inicio antes de Clientes para que CLI-08 ("Generar vista para cliente") aterrice en Inicio populado.
- Requirements (2026-04-27): Success rate (Recargas + Payouts) y failure breakdowns diferidos a v2 por data assumptions; `destination_type` confirmado, habilita PAY-04.
- Plan 01-01 (2026-04-27): Session JWT 30-day expiry, bcrypt cost 10, cookie SameSite=lax, rate-limit 5/5min/IP via Upstash sliding window, two-layer auth (proxy gate + DAL re-verify), timing-safe bcrypt always runs.
- Plan 01-01 (2026-04-27): `proxy.ts` lives at `src/proxy.ts` (NOT project root) because Next 16 looks for the proxy file at the same level as `app/`, which is `src/` when `--src-dir` is enabled. Documented as Rule-1 deviation in 01-01-SUMMARY.md.

### Pending Todos

None yet.

### Blockers/Concerns

- Columna `status` (success/fail) en transacciones — no confirmada. Si la quieres en v1, hay que pulgarear primero la presencia/ausencia de la columna en Sheets antes de Phase 3.
- **`DASHBOARD_PASSWORD_HASH` is a placeholder** — bcrypt of `tikin-dev-2026`. User must rotate to a real password before Plan 04 (Vercel production).
- **Upstash creds empty in `.env.local`** — rate limiter fails open with one-time warning in dev. Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` MUST be set in Vercel before Plan 04 deploy.

## Session Continuity

Last session: 2026-04-27 17:30 UTC
Stopped at: Completed 01-01-PLAN.md (bootstrap + auth gate). Working tree clean. Ready for 01-02.
Resume file: None
