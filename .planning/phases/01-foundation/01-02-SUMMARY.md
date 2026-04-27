---
phase: 01-foundation
plan: 02
subsystem: data-adapter
tags: [googleapis, google-auth-library, zod, jwt, sheets, server-only, date-fns-tz]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Plan 01-01 — Auth gate (`verifySession()` in `@/lib/auth/dal`), session cookie, src/proxy.ts. Plan 02 reuses verifySession to gate /api/smoke."
provides:
  - Sheets adapter layer (`src/lib/sheets/`): client singleton, config, generic utils, transactions adapter
  - Domain layer (`src/lib/domain/`): pure types (Transaction, TransactionType, DestinationType) and Zod row schemas
  - `ExpectedTransactionHeaders` tuple for boot-time schema validation
  - `getTransactions()` returning `AdapterResult<Transaction>` with rows / skipped / lastReadAt / warnings
  - `/api/smoke` Route Handler — auth-gated end-to-end check of the adapter
  - `withRetry()` helper for 429 exponential backoff with jitter (used by all future adapters)
  - `headerIndexMap()` / `getCellByHeader()` / `isEmptyRow()` / `isFormulaError()` reusable across all sheet readers
  - `'server-only'` boundary at every file under `src/lib/sheets/` so googleapis cannot leak into client bundles
affects: [02-bonos, 03-payouts, 04-inicio-recargas, 05-clientes-domain]

# Tech tracking
tech-stack:
  added:
    - googleapis@171.4.0
    - google-auth-library@10.6.2
    - date-fns@4.1.0
    - date-fns-tz@3.2.0
  patterns:
    - "'server-only' guard on every module under src/lib/sheets/ (cannot be bundled into client code)"
    - "Lazy JWT singleton: getSheetsClient() builds + caches the auth on first call; throws clear error if env vars are missing instead of failing at module load"
    - "Header→index map built ONCE per read; downstream code accesses cells by header NAME, never by positional index — closes Pitfall 3 (column reorder)"
    - "Boot-time schema check inside the adapter: if any expected header is missing, throw a SCHEMA mismatch error naming exactly which headers are absent — fail loud, not silent"
    - "Per-row Zod safeParse with skip-and-count semantics: bad rows increment a `skipped` counter and add a diagnostic warning; the read does NOT throw on a single bad row"
    - "AdapterResult<T> shape (rows / skipped / lastReadAt / warnings) reusable for every future sheet adapter (payouts, etc.)"
    - "withRetry helper retries ONLY on 429s (code/status === 429); non-429 errors are re-thrown immediately so schema mismatches and auth failures aren't masked"
    - "z.coerce.number().finite() on monto rejects NaN and ±Infinity — the precise path that formula errors take after Number() coercion (Pitfall 13)"

key-files:
  created:
    - src/lib/sheets/client.ts
    - src/lib/sheets/config.ts
    - src/lib/sheets/_utils.ts
    - src/lib/sheets/transactions.ts
    - src/lib/domain/types.ts
    - src/lib/domain/schemas.ts
    - src/app/api/smoke/route.ts
  modified:
    - package.json (deps added: googleapis, google-auth-library, date-fns, date-fns-tz)
    - package-lock.json

key-decisions:
  - "Lazy JWT singleton, not module-top-level instantiation. Importing the module never throws; the missing-creds error is raised the first time getSheetsClient() is called. This means Plan 03 (parallel) can do `import { getTransactions } from '@/lib/sheets/transactions'` in dev without GCP creds being set, and still build."
  - "Tab names ('Transacciones', 'Payouts') and header names ('fecha','monto','tipo','empresa_id','empresa_nombre','destination_type') are TENTATIVE. Plan 04 production smoke validates against the live Sheet. Mismatch surfaces as a clear schema error naming the missing column — adjust src/lib/domain/schemas.ts (and config.ts range if tab name differs), no other file needs to change."
  - "destination_type, status, failure_reason are optional (`?`) on the Transaction type. Per REQUIREMENTS.md, status/failure_reason are deferred to v2 because data assumptions aren't yet confirmed. destination_type is confirmed (PAY-04) and the schema accepts it as optional so a row missing the column is still parsed."
  - "Smoke endpoint route is /api/smoke, NOT /api/_smoke. Next.js App Router treats `_`-prefixed folders as PRIVATE (non-routable per Next docs `02-project-structure.md`); `_smoke/route.ts` would never appear in the build manifest. Documented as Rule-1 deviation below."
  - "Smoke endpoint is gated by verifySession(). Curl-testing in Plan 04 production requires a session cookie (login first). The cost is one extra step in production verification; the benefit is no anonymous traffic enumerating Sheet schema mismatches."
  - "valueRenderOption=UNFORMATTED_VALUE + dateTimeRenderOption=FORMATTED_STRING. UNFORMATTED_VALUE avoids es-CO locale-formatted strings (`$1.234.567` vs `1234567`). FORMATTED_STRING on dates gives ISO-like text that z.coerce.date() can parse without us reimplementing serial-date arithmetic."
  - "withRetry retries ONLY on 429. Default 3 retries, base 250 ms, cap 4 s, with jitter. Non-429 errors (auth, schema, network) are re-thrown immediately — masking those behind retries would hide real bugs."

patterns-established:
  - "src/lib/sheets/* is the ONLY place googleapis is imported. Future adapters (payouts.ts) follow the same shape: import getSheetsClient + utils, define an Expected{X}Headers tuple, parse rows with a Zod schema in src/lib/domain/, return AdapterResult<T>."
  - "src/lib/domain/* is data-source-agnostic. NO imports from lib/sheets/ are allowed there — verified by inspection (`grep -r '^import' src/lib/domain/` returns only `zod` and `./types`). Future swap of Sheets for a DB or API only needs a new adapter file; consumers don't change."
  - "Header normalization: trim + toLowerCase. The Sheet can have 'Fecha', ' fecha ', or 'FECHA' and the adapter still finds the column. Schema keys are always lower-cased, no exceptions."
  - "Skip-and-count: when a row is bad (empty, formula error, parse failure), it is counted in `skipped` with a one-line warning. The read returns successfully. Consumers (routes, future business logic) decide whether the skip rate is acceptable. This avoids the trap where a single bad row in a 10k-row Sheet brings the whole dashboard down."

# Metrics
duration: 7m 50s
completed: 2026-04-27
---

# Phase 1 Plan 2: Sheets Adapter + Smoke Endpoint Summary

**Read-only Google Sheets adapter with JWT singleton, header-name access, per-row Zod validation that survives empty rows and formula errors, 429 backoff, and an auth-gated `/api/smoke` Route Handler that exercises the pipeline end-to-end.**

## Performance

- **Duration:** 7m 50s
- **Started:** 2026-04-27T17:33:56Z
- **Completed:** 2026-04-27T17:41:46Z
- **Tasks:** 3
- **Files created:** 7 source files
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- The single most important architectural seam in the project is now in place: every future tab (Bonos, Recargas, Payouts, Inicio, Clientes) reads through `getTransactions()` and a future `getPayouts()`. None of them touch googleapis.
- `'server-only'` enforcement verified empirically: `find .next/static -name '*.js' | xargs grep -l googleapis` returns zero hits across all 12 client static chunks.
- End-to-end smoke pipeline verified live in dev:
  - Unauth `GET /api/smoke` → `307 -> /login` (proxy gate working).
  - Authed (hand-minted JWT for the same SESSION_SECRET) → `HTTP 500 {"ok":false,"error":"Sheets credentials missing — set GOOGLE_SERVICE_ACCOUNT_* env vars"}` — exact expected message; auth path passes, adapter is reached, error path serializes correctly. Live read deferred to Plan 04 when user supplies GCP creds.
- Closes Pitfalls 3 (schema brittleness on column reorder), 6/7 (no rate-limit handling), 11 (Sheets concerns leaking into the rest of the app), 13 (formula errors → NaN crashes).

## Task Commits

Each task was committed atomically:

1. **Task 1: Sheets client singleton + config + utils** — `46490fb` (chore)
2. **Task 2: Domain types + Zod schemas** — `8163887` (feat)
3. **Task 3: Transactions adapter + /api/smoke Route Handler** — `3bd1f95` (feat)

Plan metadata commit will be added next, capturing this SUMMARY and the STATE.md update.

## Files Created/Modified

### Sheets adapter (`src/lib/sheets/`)
- `client.ts` — Lazy JWT singleton. `getSheetsClient()` returns the cached `sheets_v4.Sheets` client; first call validates env vars and throws with a clear message if missing. `'server-only'` guarded.
- `config.ts` — `SPREADSHEETS` const with `{id, range}` for `transactions` and `payouts`. Tab names tentative; comment names the file to edit if they're wrong.
- `_utils.ts` — Five helpers: `headerIndexMap`, `getCellByHeader`, `isEmptyRow`, `isFormulaError`, `withRetry`. The whole file is the abstraction boundary that lets the rest of the codebase pretend Sheets are typed.
- `transactions.ts` — `getTransactions(): Promise<AdapterResult<Transaction>>`. Full pipeline: client → withRetry fetch → headerIndexMap → boot-time schema check → per-row formula-error skip → per-row Zod safeParse → return rows/skipped/lastReadAt/warnings. `'server-only'` guarded.

### Domain (`src/lib/domain/`)
- `types.ts` — `Transaction`, `TransactionType` (BONO|RECARGA|PAYOUT|OTRO), `DestinationType` (tarjeta|cuenta_bancaria). NO imports from `lib/sheets/`.
- `schemas.ts` — `TransactionRowSchema` (Zod, validates a `{header_lowercased: cellValue}` object), `ExpectedTransactionHeaders` tuple. `z.coerce.number().finite()` on `monto` rejects formula-error NaN.

### Routes
- `src/app/api/smoke/route.ts` — `GET` handler gated by `verifySession()`. Returns `{ok, count, skipped, lastReadAt, warnings, sample}` on success or `{ok: false, error}` on adapter throw. `dynamic = 'force-dynamic'` so a stale OK never masks broken upstream.

### Build & deps
- `package.json` — Added `googleapis@171.4.0`, `google-auth-library@10.6.2`, `date-fns@4.1.0`, `date-fns-tz@3.2.0`. (zod was already present from Plan 01-01.)
- `package-lock.json` — Lockfile updated; 18 transitive packages added.

## Decisions Made

See frontmatter `key-decisions` for the full list with rationale. Highlights:

- **Lazy JWT singleton.** Module imports never throw; missing-creds error is raised inside `getSheetsClient()`. Lets parallel Plan 03 import the adapter in dev without GCP creds.
- **Tentative headers.** `fecha`, `monto`, `tipo`, `empresa_id`, `empresa_nombre`, `destination_type` are best-guess. Plan 04 confirms against live Sheet; mismatch surfaces as a clear schema error naming the missing column. No other code changes if real headers differ.
- **Smoke endpoint at `/api/smoke`, not `/api/_smoke`.** Next.js App Router treats `_`-prefixed folders as PRIVATE (non-routable). Documented as deviation below.
- **Smoke endpoint behind auth gate.** Adds a curl step in Plan 04 verification (login first, then GET with cookie); avoids anonymous schema enumeration.
- **`withRetry` retries ONLY on 429.** Auth/schema/network errors re-thrown immediately so they aren't masked.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `_smoke` folder is non-routable in Next.js App Router**
- **Found during:** Task 3 (smoke endpoint verification).
- **Issue:** Plan specified `src/app/api/_smoke/route.ts`. After writing it, `npm run build` route table did NOT list `/api/_smoke`, and the file was silently absent from `.next/`. Per Next 16 docs (`node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`, "Route groups and private folders"), folders prefixed with `_` are treated as PRIVATE (non-routable) — used for colocating non-route files. The plan author's intention (signal "internal/diagnostic") collides with the framework convention.
- **Fix:** Renamed `src/app/api/_smoke/` → `src/app/api/smoke/`. Updated the route's docstring header to describe the rename. Function and contract identical to plan; only the URL changes from `/api/_smoke` to `/api/smoke`.
- **Files modified:** `src/app/api/smoke/route.ts` (renamed from `_smoke/route.ts`).
- **Verification:** Post-rename `npm run build` route table now lists `ƒ /api/smoke`. Curl unauth GET → 307 to /login; curl with valid session JWT → HTTP 500 with the expected `Sheets credentials missing` JSON error.
- **Committed in:** `3bd1f95` (Task 3 commit).

---

**Total deviations:** 1 auto-fixed (1 bug — plan vs framework convention).
**Impact on plan:** No scope expansion. The plan's `must_haves.artifacts` entry for `src/app/api/_smoke/route.ts` simply lives at `src/app/api/smoke/route.ts` instead. All other contracts hold. Future plans referring to "the smoke endpoint" should use `/api/smoke`.

## Issues Encountered

- **Live Sheets read deferred.** GCP service account credentials are not yet provided by the user (per project state and pre-execution context). The four env vars are empty in `.env.local`. As planned for this scenario, build/tsc were verified clean and the runtime error path was verified live: an authenticated `GET /api/smoke` returns the exact `Sheets credentials missing — set GOOGLE_SERVICE_ACCOUNT_* env vars` message with HTTP 500. This proves the auth path, route handler, and adapter error propagation all work; only the live Google Sheets call is unexercised. Plan 04 (Vercel) is the next opportunity to validate against real creds and the real Sheet schema.
- **Parallel coordination with Plan 03.** Plan 03 (app shell) ran concurrently and committed `cf8f643 feat(01-03): format module + URL state helpers` between this plan's Task 2 and Task 3 commits. A transient `tsc --noEmit` run mid-execution showed Plan 03's own type errors in `src/app/(protected)/layout.tsx` (their work-in-progress); a re-run after Plan 03 stabilized was clean. None of Plan 02's files were touched. No coordination issue surfaced; the path-ownership split (sheets+domain+api/smoke vs app/(protected)+components/filters+components/layout+lib/format+lib/url-state) held.

## User Setup Required

**External services require manual configuration before Plan 04 (production):**

1. Create GCP project and service account `tikin-dashboard-reader` (Service Accounts → Create, no IAM roles needed).
2. Enable Google Sheets API on the project (APIs & Services → Library).
3. Generate JSON key for the service account (Keys → Add Key → JSON). Do NOT commit; `.gitignore` already blocks `*service-account*.json` and friends (Plan 01-01).
4. Share BOTH Sheets (transactions + payouts) with the service account email as Viewer.
5. Populate the four env vars in Vercel project settings:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` (= `client_email` from JSON)
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (= `private_key`, paste single-line with literal `\n` escapes — adapter handles the `.replace(/\\n/g, '\n')` conversion)
   - `GOOGLE_SHEETS_TRANSACTIONS_ID` (the `<ID>` between `/d/` and `/edit` in the Sheet URL)
   - `GOOGLE_SHEETS_PAYOUTS_ID` (same, for the payouts Sheet)
6. After deploy, hit `/api/smoke` (after logging in once to get a session cookie). Expected:
   - `{"ok": true, "count": <N>, "skipped": <K>, "lastReadAt": "...", "warnings": [], "sample": [...]}` if everything matches.
   - `{"ok": false, "error": "Sheet schema mismatch — columnas faltantes en transactions Sheet: <list>. ..."}` if the tentative header names don't match the real Sheet — this is information, not a bug. Adjust `src/lib/domain/schemas.ts` and `ExpectedTransactionHeaders` to match the live schema and redeploy.

## Next Phase Readiness

**Ready for Plan 03 (app shell, parallel):**
- The adapter API (`getTransactions`) is stable. Plan 03 can import it once it has its server components in place. Until then, Plan 03 doesn't actually call into the adapter — it just wires the UI shell.

**Ready for Plan 04 (Vercel production):**
- All code paths are exercisable. The user-setup checklist above is the only gate.
- The smoke endpoint provides a single-URL verification that everything wired correctly: auth + cookie + Sheets fetch + Zod validation + JSON serialization.

**Ready for Phase 2+ (feature work — Bonos, Payouts, Inicio, Clientes):**
- Pattern established. To add the payouts adapter:
  1. Create `src/lib/sheets/payouts.ts` mirroring `transactions.ts`.
  2. Add `Payout` type to `src/lib/domain/types.ts`.
  3. Add `PayoutRowSchema` and `ExpectedPayoutHeaders` to `src/lib/domain/schemas.ts`.
  4. Reuse `getSheetsClient`, `headerIndexMap`, `isEmptyRow`, `isFormulaError`, `withRetry` from `_utils.ts`.
  5. Optionally add a payouts case to `/api/smoke` or a separate route.

**Coordination note for Plan 03:** Plan 03 owns `src/components/layout/`, `src/app/(protected)/`, `src/components/filters/`, `src/lib/format.ts`, `src/lib/url-state.ts`. None were modified here. If Plan 03 wants to call the adapter, it imports `import { getTransactions } from '@/lib/sheets/transactions'` and `import type { Transaction } from '@/lib/domain/types'`. Both already exist on `master` after `3bd1f95`.

**Open items (carried from prior plans, still blocking for Plan 04):**
- `DASHBOARD_PASSWORD_HASH` is the bcrypt of placeholder `tikin-dev-2026` (from Plan 01-01). User must rotate before Vercel production.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` empty in `.env.local`; rate-limit fail-open in dev, MUST be set in Vercel before Plan 04.
- New: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY / GOOGLE_SHEETS_TRANSACTIONS_ID / GOOGLE_SHEETS_PAYOUTS_ID empty; required for the live read in Plan 04. See User Setup Required above.

---
*Phase: 01-foundation*
*Plan: 02*
*Completed: 2026-04-27*
