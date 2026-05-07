---
phase: 06-foundation-v2
plan: 01
subsystem: parsing
tags: [zod, parsers, postgres-interval, cop-currency, domain]

# Dependency graph
requires:
  - phase: 03-payouts
    provides: parsePgInterval / MoneyFromCOP helpers proven against 798 prod rows
provides:
  - parseAging
  - parseTotalTime
  - parseCOPAmount
affects: [07-bonos-payouts, 08-tarjeta-recargas, 09-vista-cliente, 10-inicio-infra]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public-vs-internal API split: parsers.ts exposes minutes (public, per PRD v2) while schemas.ts keeps the seconds path internal for backward-compat with Payout.latencySeconds"
    - "Zod transforms delegate to pure parser functions — schema becomes a thin error-mapping layer, parsing logic lives in one place"

key-files:
  created:
    - src/lib/domain/parsers.ts
  modified:
    - src/lib/domain/schemas.ts

key-decisions:
  - "parseCOPAmount returns number | null (not number | NaN) — null is the explicit no-value signal for v2.0 callers; distinguishes 'missing' from 'zero'"
  - "parsePgIntervalSeconds (seconds-based) kept internal but exported so schemas.ts can import it; parseAging/parseTotalTime (minutes) are the public v2.0 API"
  - "schemas.ts parsePgInterval becomes a one-line delegate (not deleted) so the two PayoutRowSchema call sites stay readable and the seconds contract is explicit at the call site"
  - "MoneyFromCOP error messages preserved verbatim so Zod issue logs are unchanged for existing log-grepping consumers"

patterns-established:
  - "Public parser API in `src/lib/domain/parsers.ts`: pure functions, source-agnostic, JSDoc cites the requirement (CROSS-V2-03) + enumerates edge cases"
  - "Schemas as thin error-mapping wrappers: Zod transforms call into pure parsers and translate null/NaN into ctx.addIssue + z.NEVER"

# Metrics
duration: 4min
completed: 2026-05-07
---

# Phase 6 Plan 1: Parsing API Extraction Summary

**Extracted `parseAging` / `parseTotalTime` / `parseCOPAmount` from buried Zod helpers into a public `src/lib/domain/parsers.ts` module that returns minutes (PRD v2 units), while `schemas.ts` keeps producing `Payout.latencySeconds` in seconds for Phase 3 backward-compat.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-07T16:40:58Z
- **Completed:** 2026-05-07T16:45:00Z (approx)
- **Tasks:** 2 / 2
- **Files modified:** 2 (1 created, 1 refactored)

## Accomplishments
- New public parsing API for v2.0 phases at `src/lib/domain/parsers.ts` with three exported functions: `parseAging`, `parseTotalTime`, `parseCOPAmount` (plus `parsePgIntervalSeconds` for internal seconds path)
- `schemas.ts` refactored to delegate to `parsers.ts` — parsing logic now lives in one place
- Zero regression in `PayoutRowSchema`: `Payout.latencySeconds` continues to be produced in SECONDS (verified against `payouts.ts` `PayoutSummary.p50Seconds` / `p95Seconds` JSDoc, unchanged)
- All gates passed cleanly: `tsc --noEmit` (0 errors), `npm run lint` (0 new errors, 3 pre-existing warnings), `npm run build` (compiled successfully)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create parsers.ts with public parsing API** — `5b3dab0` (feat)
2. **Task 2: Refactor schemas.ts to delegate to parsers.ts** — `6689a2b` (refactor)

**Plan metadata:** `007d89f` (docs)

## Files Created/Modified

- `src/lib/domain/parsers.ts` (created, 132 lines) — public parsing API for v2.0 domain libraries
  - `parsePgIntervalSeconds(s)` — internal seconds-based PostgreSQL interval parser (kept exported so `schemas.ts` can import)
  - `parseAging(s)` — public, returns minutes (CROSS-V2-03)
  - `parseTotalTime(s)` — public, returns minutes (CROSS-V2-03); empty string → 0
  - `parseCOPAmount(s)` — public, returns `number | null` (null = explicit no-value signal); handles negativos, ceros, vacíos, NaN/Infinity
- `src/lib/domain/schemas.ts` (modified, +23 / -59 lines) — refactored to delegate
  - Imports `parseCOPAmount`, `parsePgIntervalSeconds` from `./parsers`
  - `MoneyFromCOP` Zod transform now wraps `parseCOPAmount`; error messages preserved verbatim
  - `parsePgInterval` becomes a one-line delegate to `parsePgIntervalSeconds`
  - `TransactionRowSchema` untouched (does not use these helpers)
  - All exported types/symbols unchanged (Phase 3 consumers see identical surface)

## Decisions Made

1. **`parseCOPAmount` returns `number | null` (not throwing/NaN).** The plan-spec semantics distinguish "missing/empty" (null) from "zero" (a valid number). v2.0 callers can branch cleanly on `=== null`. The Zod wrapper translates null → `ctx.addIssue + z.NEVER` to preserve the existing "skip row on bad money" contract.

2. **Kept `parsePgIntervalSeconds` exported, not file-private.** This let `schemas.ts` import it directly instead of duplicating the regex. The seconds-based contract is documented at both module-doc and call-site level so future readers can't accidentally flip units.

3. **Kept the local `parsePgInterval(s)` function in schemas.ts as a one-line delegate** rather than inlining `parsePgIntervalSeconds(v)` at the two call sites. The one-line wrapper preserves the readability of the `aging` and `total time` Zod transforms (no churn in those blocks) and gives the seconds contract a name visible at the call site.

4. **Preserved `MoneyFromCOP` Zod issue messages verbatim** by reconstructing them in the wrapper based on input shape. Even though parser logic moved, the strings logged on bad rows are identical to before — protects any downstream log-grepping or error-monitoring rules.

## Deviations from Plan

None — plan executed exactly as written. The plan offered the `parsePgIntervalSeconds` export as optional ("If you exported `parsePgIntervalSeconds` from parsers.ts, import it. If not, keep the private function..."); chose the import path as recommended.

## Authentication Gates

None — fully autonomous plan, no external services required.

## Issues Encountered

- Pre-existing unrelated modification on `src/lib/url-state.ts` (not staged for this plan). Left untouched in working tree per Plan 06-01 scope.
- Pre-existing lint warnings (3) on unrelated files (`ClientesTable.tsx`, `rate-limit.ts`, `_utils.ts`) — 0 errors; no warnings introduced by this plan.
- `npx`/`node` not on default PATH — resolved via NVM PATH export documented in STATE.md "Blockers/Concerns" carry-forward.

## Next Phase Readiness

- **Phase 7 (Bonos+Payouts v2)** can import `parseAging` / `parseTotalTime` / `parseCOPAmount` directly from `src/lib/domain/parsers.ts`. The minutes contract matches the PRD v2 expectation for time KPIs.
- **Phase 3 backward-compat preserved**: `Payout.latencySeconds` still in seconds — `payouts.ts` `p50Seconds` / `p95Seconds` percentiles continue working unchanged.
- **Remaining Plan 06-CONTEXT.md "essential" items still TODO**:
  - JOIN canónico verification 773/798 in production runtime (logic is in place; needs end-to-end smoke against the corrected Sheet header H — this is the carry-forward from STATE.md "Blockers/Concerns").
  - Dark mode site-wide + paleta por sección + filtros globales + visibility-by-metric system — these are upcoming plans in Phase 6.

---
*Phase: 06-foundation-v2*
*Completed: 2026-05-07*
