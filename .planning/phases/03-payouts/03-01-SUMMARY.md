---
phase: 03-payouts
plan: 01
subsystem: data-foundation
tags: [zod, sheets, schema, bd-payouts, payouts, postgres-interval, cop-string-parsing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Sheets adapter pipeline (`getTransactions()` + `AdapterResult<T>`), header→index map (lowercases+trims), Zod parse-and-skip semantics, `withRetry` 429-only retry, `/api/smoke` route, real BD_Payouts column inventory captured live in 01-04-SUMMARY.md"
  - phase: 02-bonos
    provides: "Diagnostic-then-cleanup pattern (Plan 02-01 — temporary /api/diagnose route created, captured live distinct values, deleted before commit). Single-Intl-gate convention (`src/lib/format.ts`). React `cache()` wrapper pattern (`getCachedX = cache(getX)` for per-request dedup)."
provides:
  - "Live-data-aligned `Payout` interface (transactionId, internalId, fecha, holder, monto, costo, medium, state, latencySeconds, failureReason?, failureDetails?, empresa_id?)"
  - "PayoutState enum (completed | in_progress | failed | OTRO_STATE)"
  - "PayoutMedium type (open `string` — 12 distinct bank codes captured live; not the tarjeta/cuenta_bancaria split 03-RESEARCH.md speculated)"
  - "ExpectedPayoutHeaders tuple covering all 15 BD_Payouts columns (lowercased+trimmed exactly as headerIndexMap normalizes)"
  - "MoneyFromCOP Zod helper — parses `\"COP 200,000.00\"`-style strings to numbers"
  - "parsePgInterval helper — converts PostgreSQL interval strings (`\"0 years 0 mons N days HH hours MM mins SS.fff secs\"`) to seconds"
  - "PayoutRowSchema with .transform() returning Payout shape; latencySeconds = Total Time when present (canonical for completed), Aging fallback for in_progress/failed"
  - "src/lib/sheets/payouts.ts: getPayouts() + getCachedPayouts (mirror of transactions.ts shape); reuses AdapterResult<T> type"
  - "/api/payouts-smoke route: live verification ok=true count=797 skipped=1 (0.13%) against production BD_Payouts"
  - "Resolution of 3 unknowns from 03-RESEARCH.md: (1) Aging/Total Time are PG interval STRINGS not numbers; Total Time canonical for completed payouts. (2) Destination Medium is BANK CODES, not tarjeta/banco. (3) Holder is CARDHOLDER NAME, not tikintag — empresa filter requires Transaction ID join (Plan 03-02 will implement)."
affects: [03-02-payouts-domain, 03-03-payouts-page, 03-04-payouts-presenter, 04-recargas, 04-inicio]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "cop-string-parsing: BD_Payouts.Value and Transaction Cost ship as pre-formatted `\"COP 200,000.00\"` strings (not numbers); MoneyFromCOP Zod helper strips non-digit/decimal/sign chars then Number()"
    - "pg-interval-parsing: Aging and Total Time ship as PostgreSQL interval strings; parsePgInterval helper converts to seconds via regex (`(-?\\d+)\\s+years?\\s+...`); 0-emptied strings handled defensively (return 0)"
    - "live-data-grounded-enums (carry-over from 02-01): PayoutState union sourced from /api/diagnose-payouts captured against 798 production rows BEFORE writing schema; OTRO_STATE fallback for future unseen values"
    - "diagnostic-then-cleanup (carry-over from 02-01): temporary /api/diagnose-payouts route created mid-plan to capture three live unknowns, deleted before commit; production never carried inspection-only code; single commit shows rewrite + cleanup state"
    - "open-string-type-for-evolving-domains: PayoutMedium typed as `string` (with OTRO_MEDIUM constant) rather than a closed union — Tikin onboards new banks regularly; closed union would force ongoing schema-edit churn"
    - "canonical-vs-fallback-latency: latencySeconds prefers Total Time (state_timestamp − date, populated for completed) over Aging (now − date, always populated); fallback handles in_progress/failed defensively, but Plan 03-02 percentile MUST filter to state==completed first per 03-CONTEXT.md essentials"

key-files:
  created:
    - src/lib/sheets/payouts.ts (155 lines — adapter + cache wrapper)
    - src/app/api/payouts-smoke/route.ts (40 lines — auth-gated smoke)
  modified:
    - src/lib/domain/types.ts (+105 lines — Payout interface, PayoutState, PayoutMedium)
    - src/lib/domain/schemas.ts (+200 lines — ExpectedPayoutHeaders, MoneyFromCOP, parsePgInterval, PayoutRowSchema)

key-decisions:
  - "Holder is a CARDHOLDER FULL NAME (e.g. \"Angela Yaneth leal liberato\"), NOT a tikintag. Empresa filter (CROSS-02) cannot match Holder → tikintag directly. Plan 03-02 (page composition) MUST join via Transaction ID to BD_Plataforma to populate Payout.empresa_id when the URL filter is active. Default Payout.empresa_id is undefined; the join is the override path."
  - "Destination Medium is a BANK CODE (12 distinct values: bancolombia, nequi, daviplata, nubank, banco_de_bogota, banco_davivienda, banco_caja_social_bcsc, banco_av_villas, banco_falabella, banco_bbva_colombia, banco_mundo_mujer, davibank), NOT 'tarjeta'/'cuenta_bancaria' as 03-RESEARCH.md speculated. All 798 production rows are bank payouts — no card payouts in BD_Payouts. PAY-04's 'split tarjeta vs banco' will be reinterpreted by Plan 03-02/03 as either 'split by bank' (more useful) or 'all payouts are to banks' (degenerate). PayoutMedium typed as open `string` rather than a closed union so Tikin onboarding new banks doesn't churn the schema."
  - "Aging and Total Time are PostgreSQL interval STRINGS (e.g. `\"0 years 0 mons 12 days 20 hours 30 mins 38.656877 secs\"`), NOT numbers and NOT seconds. parsePgInterval helper converts to seconds via regex. 03-RESEARCH.md anticipated either seconds, minutes, hours, or formatted-duration strings — reality was the formatted-duration variant."
  - "Total Time is canonical latency for COMPLETED payouts (state_timestamp − date). It is EMPTY for in_progress/failed rows in production. Aging is always populated (now − date) but represents the row's age, not the time-to-payout. Decision: latencySeconds = Total Time when > 0, Aging otherwise. Plan 03-02 MUST filter to state==completed before percentile/histogram so the fallback never influences headline numbers — per 03-CONTEXT.md essentials: 'solo payouts que efectivamente se completaron'."
  - "Value and Transaction Cost ship as pre-formatted strings like `\"COP 200,000.00\"` (probably Looker / report-export upstream). MoneyFromCOP transform strips non-digit/decimal/sign chars then Number()-coerces. Phase 1's `Money` (z.coerce.number().finite()) cannot handle this — would skip every row. Confirmed live: 797/798 rows parse cleanly post-fix."
  - "Date and State Timestamp ship as `\"April 27, 2026, 9:48 AM\"`-style English-locale strings. JS `new Date()` constructor accepts this format on V8 (Node + Chrome + Vercel runtime); confirmed by sample inspection. parseHumanDate wrapper returns Invalid Date (NaN .getTime()) on unparseable input; Zod refines and skips."
  - "PayoutState union: completed | in_progress | failed | OTRO_STATE. Captured live (lowercase in Sheet). Phase 3 percentile/histogram default filter is state==completed; success rate KPI (PAY-V2-01) needs the full set."
  - "Adapter uses `.get()` (one range), NOT `batchGet` (two ranges). 03-RESEARCH.md recommended batchGet to coalesce BD_Plataforma + BD_Payouts into one quota unit. Rationale for divergence: transactions.ts already ships and uses its own `.get()`; React `cache()` already dedupes per-request; two cached fetches = two `.get()` calls = same quota cost as one batchGet (1 unit each). batchGet would only save quota if we coalesced INTO ONE cache wrapper used across both pages, which is a larger refactor. Future optimization path documented in payouts.ts JSDoc: `getCachedSheetsBundle()` if quota becomes a real concern."
  - "Reused Phase 1's `AdapterResult<T>` type (imported from transactions.ts) instead of defining a new one. transactions.ts continues to be the canonical export site. Future adapters (recargas in Phase 4) follow the same import pattern."
  - "Diagnostic route was NEVER COMMITTED — created in Task 1, used to capture live shape, deleted in Task 2 before the single feat commit. Mirrors Plan 02-01 pattern exactly. Production HEAD never carried inspection-only code. Single commit `94ccc9a` shows the rewrite + cleanup state."

patterns-established:
  - "Pattern 1: Sheet adapters can mirror transactions.ts byte-for-byte (header check, isEmptyRow + isFormulaError + per-row safeParse + skip-and-count + warnings cap-10). The pipeline is genuinely Sheet-shape-independent — only schemas.ts + types.ts change per new tab."
  - "Pattern 2: When the Sheet ships data in unexpected formats (interval strings, pre-formatted currency, locale dates), absorb the parsing in dedicated Zod helpers in schemas.ts so the Payout/Transaction interface stays clean (number/Date), not the original string. Downstream code never sees the wire format."
  - "Pattern 3: Open `string` type with constant `OTRO_X` is preferable to a closed union when the domain evolves (banks, payment providers). Closed unions are correct for genuinely finite domains (status, direction)."
  - "Pattern 4: When live data contradicts research speculation (research said 'tarjeta vs banco', reality is 'all banks'), document the contradiction explicitly in the SUMMARY so downstream plans don't carry the wrong assumption forward."

# Metrics
duration: 8m 19s
completed: 2026-05-04
---

# Phase 3 Plan 01: Payouts Sheets Adapter Summary

**Live-data-grounded BD_Payouts adapter (797 rows, 0.13% skip rate) with three resolution unknowns: Aging/Total Time are PG interval strings (Total Time canonical), Destination Medium is BANK CODES not tarjeta/banco, Holder is cardholder name requiring Transaction ID join for empresa filter.**

## Performance

- **Duration:** 8m 19s
- **Started:** 2026-05-04T14:22:25Z
- **Completed:** 2026-05-04T14:30:44Z
- **Tasks:** 2/2 (diagnostic capture + adapter/schema/smoke + cleanup)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- BD_Payouts adapter (`getPayouts` + `getCachedPayouts`) ingests 797/798 live rows on first try (0.13% skip rate — one row had a numeric Holder cell)
- Three open questions from 03-RESEARCH.md resolved with concrete production data:
  1. **Aging vs Total Time:** Both are PostgreSQL interval STRINGS, not numbers. Total Time is canonical (state_timestamp − date) but empty for non-completed rows. `latencySeconds = Total Time when > 0, else Aging fallback`.
  2. **Destination Medium:** All 12 distinct values are bank codes (`bancolombia`, `nequi`, `daviplata`, `nubank`, `banco_de_bogota`, etc.). NO `tarjeta` or `cuenta_bancaria` values exist in production data. PAY-04's split needs reinterpretation by Plan 03-02/03.
  3. **Holder ↔ tikintag:** Holder is a cardholder full name, NOT a tikintag. Plan 03-02 must join via Transaction ID to BD_Plataforma to populate `empresa_id` when the URL empresa filter is active.
- Two new Zod helpers (`MoneyFromCOP` parses `"COP 200,000.00"`; `parsePgInterval` parses `"0 years 0 mons N days HH hours MM mins SS.fff secs"`) absorb BD_Payouts' unusual wire formats so the `Payout` domain interface stays clean (numbers and Dates).
- /api/smoke regression check confirms transactions adapter unchanged: count=3188, skipped=44 — identical to pre-plan.
- `npm run build` clean (zero TS errors); single Intl gate preserved (`src/lib/format.ts` is still the only Intl-using file in `src/lib/**`).

## Task Commits

Single commit captures the rewrite + cleanup state — production never carried inspection-only code (mirror of Plan 02-01 pattern):

1. **Task 1 + Task 2 combined: payouts adapter + schema + smoke endpoint** — `94ccc9a` (feat)

_Note on commit count: this plan deviates from the per-task atomic-commit convention because the plan's `<done>` for Task 2 explicitly says "single commit captures the rewrite + cleanup state". Diagnostic route was created, used, deleted within the same plan and never reached a commit boundary — same as Plan 02-01._

## Files Created/Modified

### Created

- **`src/lib/sheets/payouts.ts`** (155 lines) — `getPayouts(): Promise<AdapterResult<Payout>>` + `getCachedPayouts = cache(getPayouts)`. Mirror of `transactions.ts` line-for-line: lazy JWT client, `withRetry` 429-only, header→index map, missing-header error naming "BD_Payouts Sheet", per-row Zod safeParse with skip-and-count, warnings capped at 10. Uses `.get()` (one range) — documented future optimization path to `batchGet` if quota becomes a concern.
- **`src/app/api/payouts-smoke/route.ts`** (40 lines) — auth-gated (`verifySession()`) smoke endpoint mirroring `/api/smoke`. Returns `{ok, count, skipped, lastReadAt, warnings, sample}`. `dynamic = "force-dynamic"` so a stale OK can't mask a broken upstream.

### Modified

- **`src/lib/domain/types.ts`** (+105 lines) — appended Payout interface, PayoutState union (`completed | in_progress | failed | OTRO_STATE`), PayoutMedium open string type, OTRO_MEDIUM constant. JSDoc captures all live findings inline so Plan 03-02 doesn't need to re-read this SUMMARY.
- **`src/lib/domain/schemas.ts`** (+200 lines) — appended ExpectedPayoutHeaders tuple (15 cols, lowercased+trimmed), KNOWN_PAYOUT_STATES list, MoneyFromCOP helper, parsePgInterval helper (pure function, exported only via the schema's transform), parseHumanDate wrapper, PayoutRowSchema with `.transform()` returning Payout shape.

### Created and immediately deleted (mirror of Plan 02-01)

- `src/app/api/diagnose-payouts/route.ts` — diagnostic route capturing 15 headers, 798 rowCount, 10 sample rows, distinct values for `destination_medium` (12 banks), `state` (3 lifecycle states), `aging` (30 string samples), `total_time` (30 string samples + empty markers), 30 `holder` samples. Used to capture the JSON output that drove all schema decisions in Task 2; deleted before final commit. Production HEAD never carried it.

## Diagnostic Findings

### Live capture (2026-05-04, 798 BD_Payouts rows)

**Headers (15 cols, lowercased + trimmed):**
```
transaction id, date, holder, destination account, value, destination medium,
transaction cost, state, state timestamp, refund sent, aging, failure reason,
failure details, total time, id
```

**Distinct `state` values (3):** `completed`, `in_progress`, `failed`

**Distinct `destination medium` values (12 — all bank codes):**
```
bancolombia, nequi, daviplata, nubank, banco_de_bogota, banco_davivienda,
banco_caja_social_bcsc, banco_av_villas, banco_falabella, banco_bbva_colombia,
banco_mundo_mujer, davibank
```

**`aging` and `total time` shape:**
- All 798 values are STRINGS in PG interval format: `"0 years 0 mons N days HH hours MM mins SS.fff secs"`.
- `aging` is always populated (row's age = now − created_at).
- `total time` is empty for `in_progress` and `failed` rows; populated for `completed` (= state_timestamp − date).

**`holder` shape (30 distinct samples):**
- Cardholder/account-holder full names (e.g. `"Angela Yaneth leal liberato"`, `"María"`, `"Mónica varela"`).
- One outlier: `"BD_Payouts"` (looks like a Sheet self-reference; safely parses but is meaningless).
- Confirmed NOT in the tikintag domain (tikintags are `$mario`-shaped handles).

### `value` and `transaction cost` shape

Pre-formatted strings: `"COP 200,000.00"`, `"COP 5,229.46"`, `"COP 1,500,000.00"`. The `MoneyFromCOP` helper strips `"COP"`, spaces, and thousands-separator commas, then `Number()`.

### `date` and `state timestamp` shape

English-locale strings: `"April 27, 2026, 9:48 AM"`, `"March 24, 2026, 3:45 PM"`. Parsed via `new Date(s)` (V8 supports this format).

## Schema Mapping Table

| BD_Payouts column      | Payout field        | Transform                                                                |
|------------------------|---------------------|--------------------------------------------------------------------------|
| `transaction id`       | `transactionId`     | `z.string().min(1)`                                                      |
| `id`                   | `internalId`        | `z.string().min(1)`                                                      |
| `date`                 | `fecha`             | `parseHumanDate()` — JS Date from English-locale string                  |
| `holder`               | `holder`            | `z.string().min(1)` (kept raw — full-name cardholder)                    |
| `value`                | `monto`             | `MoneyFromCOP` — strips "COP "/commas, Number()                          |
| `transaction cost`     | `costo`             | `MoneyFromCOP`                                                           |
| `destination medium`   | `medium`            | lowercase + trim; bank code preserved as-is; empty → `"OTRO_MEDIUM"`     |
| `state`                | `state`             | lowercase + trim; one of `completed/in_progress/failed`, else `OTRO_STATE`|
| `total time`           | `latencySeconds`*   | `parsePgInterval()` to seconds; **canonical when > 0**                  |
| `aging`                | `latencySeconds`*   | `parsePgInterval()` to seconds; **fallback when total time empty**       |
| `failure reason`       | `failureReason`     | `OptionalString` (trimmed; empty → undefined)                            |
| `failure details`      | `failureDetails`    | `OptionalString`                                                         |
| `destination account`  | (tolerated, dropped)| `OptionalString` — present in Sheet but not consumed by Payout interface |
| `state timestamp`      | (tolerated, dropped)| `OptionalString` — Plan 03-02 may consume for stale-payout detection     |
| `refund sent`          | (tolerated, dropped)| `OptionalString` — all 10 sampled rows have `"-"`; effectively unused    |

`*` `latencySeconds = total time when > 0, else aging`. Plan 03-02 MUST filter to `state==completed` before percentile/histogram so the fallback never affects headline P50/P95 numbers (per 03-CONTEXT.md essentials: "números incuestionables"; "solo payouts que efectivamente se completaron").

## Skip Rate Analysis

**`/api/payouts-smoke` live result:** `{ok: true, count: 797, skipped: 1, warnings: ["Row 188: parse failed — holder: Invalid input: expected string, received number"]}`.

**The 1 skipped row:** Row 188 has a numeric `holder` cell. Likely a name that Sheets autoconverted to a number (e.g. an all-digit display name, or a phone number used as a holder identifier). 798 → 797 is well under the 5% threshold the plan named (would have flagged a schema bug); 0.13% skip rate is comparable to the 1.36% transactions adapter achieved post-Plan 02-01.

**Forward guidance:** If skip rate climbs in production over time, the warning message names the column (`holder`); resolution would be to widen the schema to `z.union([z.string(), z.number()]).transform(s => String(s).trim())` similarly to OptionalString. Not done now because (a) one row in 798 doesn't justify the change, and (b) schema strictness surfaces source-data-quality issues to Tikin (same rationale as keeping `UKNOWN` typo verbatim in TransactionType).

## Decision: `.get()` over `batchGet`

03-RESEARCH.md recommended `batchGet` to coalesce BD_Plataforma + BD_Payouts into one Sheets API quota unit. We ship `.get()` (single range, BD_Payouts only).

**Rationale:**
- `transactions.ts` already ships and uses its own `.get()`. Switching it to share a `batchGet` with payouts.ts is a non-trivial refactor of working code.
- React `cache()` already dedupes per-request: `getCachedTransactions()` and `getCachedPayouts()` each fire ONCE per render, regardless of how many Server Components consume them. Two cached fetches = two `.get()` calls = 2 quota units.
- A single `batchGet` of both ranges would also be 1 quota unit (per Sheets API docs). Net savings: 1 quota unit per render.
- Tikin's quota: 60 reads/min/user. Real dashboard load is well under 1 render/sec. The 1-quota-unit optimization is real but not urgent.

**Future optimization path** (NOT for Plan 03-01):
Introduce a shared `getCachedSheetsBundle(): { transactions, payouts }` cache wrapper that internally calls `batchGet([transactions.range, payouts.range])`. Touch only when `429` rate-limit errors start appearing in production logs.

This is documented inline in `payouts.ts` JSDoc so future plans don't need to re-derive the rationale.

## Decisions Made

(See `key-decisions` in frontmatter for the full list with rationale; the most consequential ones for downstream plans are summarized here.)

- **Holder requires Transaction ID join** for empresa filter — Plan 03-02 page composition has new work scope.
- **PAY-04 "split tarjeta vs banco" needs reinterpretation** — there is no tarjeta data in production. Plan 03-02 either splits by bank (12 categories — likely too many for a clean visualization) or surfaces "all payouts are to banks" as a single-category KPI.
- **`latencySeconds` is Total Time first, Aging fallback** — Plan 03-02 percentile MUST filter to `state==completed` before reading `latencySeconds`.
- **PayoutMedium typed as open `string`** — Plan 03-02/03 component code can't `switch` exhaustively; treat as a key for grouping (Map<medium, count>) rather than a discriminated union.
- **Single commit pattern preserved** — diagnostic route created, used, deleted in same plan; production HEAD only sees the rewrite + cleanup state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Plan's PayoutMedium type assumption was wrong**

- **Found during:** Task 1 (diagnostic capture)
- **Issue:** Plan said `PayoutMedium = "tarjeta" | "cuenta_bancaria" | "OTRO_MEDIUM"` with mapping like `"Tarjeta" → "tarjeta"`, `"Cuenta Bancaria" → "cuenta_bancaria"`. Live data has 12 distinct bank codes (`bancolombia`, `nequi`, etc.) and NO tarjeta/cuenta_bancaria values. Closing the type to `tarjeta | cuenta_bancaria | OTRO_MEDIUM` would force every production row to fall through to OTRO_MEDIUM, hiding the data.
- **Fix:** Typed `PayoutMedium` as open `string` with `OTRO_MEDIUM` constant for genuinely empty cells. Schema lowercases + trims raw cell. Bank codes preserved as-is so downstream UI can group by them.
- **Files modified:** `src/lib/domain/types.ts`, `src/lib/domain/schemas.ts`
- **Verification:** /api/payouts-smoke sample row shows `medium: "banco_caja_social_bcsc"` — bank code preserved.
- **Committed in:** `94ccc9a`
- **Forward impact:** Plan 03-02/03 must reinterpret PAY-04's "split tarjeta vs banco". Documented inline in PayoutMedium JSDoc and in this SUMMARY's "Decisions Made".

**2. [Rule 1 — Bug] Plan's schema assumed `Aging` and `Total Time` were numbers**

- **Found during:** Task 1 (diagnostic capture)
- **Issue:** Plan gave three speculative paths — seconds (number), minutes (number), or formatted "HH:MM:SS" string. Reality: PostgreSQL interval STRINGS like `"0 years 0 mons 12 days 20 hours 30 mins 38.656877 secs"`. None of plan's three paths handle this.
- **Fix:** Added `parsePgInterval()` helper to schemas.ts using regex. Used in Zod transforms for `aging` and `total time`.
- **Files modified:** `src/lib/domain/schemas.ts`
- **Verification:** Smoke sample shows `latencySeconds: 13496.086909` for a row with `aging: "0 years 0 mons 0 days 3 hours 44 mins 56.086909 secs"` — math: 3*3600+44*60+56.086909 = 13496.086909 ✓.
- **Committed in:** `94ccc9a`

**3. [Rule 1 — Bug] Plan's schema used `Money` for `value` and `transaction cost`**

- **Found during:** Task 2 (would have surfaced as 100% skip rate at smoke)
- **Issue:** Phase 1's `Money = z.coerce.number().finite()` cannot parse `"COP 200,000.00"` strings. `Number("COP 200,000.00")` returns NaN; finite() rejects; row skipped. Would have been a 100% skip rate.
- **Fix:** Added `MoneyFromCOP` Zod transform that strips non-digit/decimal/sign chars before Number()-coercing. Used for `value` and `transaction cost` only; `Money` stays for transactions adapter (which has raw numeric cells).
- **Files modified:** `src/lib/domain/schemas.ts`
- **Verification:** Smoke sample shows `monto: 200000, costo: 5229.46` for a row whose raw cells are `"COP 200,000.00"` and `"COP 5,229.46"` ✓.
- **Committed in:** `94ccc9a`

**4. [Rule 1 — Bug] Plan's schema used `z.coerce.date()` for `date`**

- **Found during:** Task 2 (would have surfaced as parse failures at smoke)
- **Issue:** `date` cells are English-locale strings like `"April 27, 2026, 9:48 AM"`. `z.coerce.date()` calls `new Date(value)` internally — V8 actually accepts this format, BUT zod's coerce is more conservative on edge cases (e.g. an empty string yields Invalid Date which coerce treats as a parse failure). Cleaner to use an explicit `parseHumanDate` wrapper that handles the failure path with a custom Zod issue message.
- **Fix:** `parseHumanDate(s)` returns `new Date(NaN)` for non-strings, otherwise `new Date(s)`. Schema transforms `date` via this helper and adds a custom issue if `.getTime() === NaN`.
- **Files modified:** `src/lib/domain/schemas.ts`
- **Verification:** Smoke sample shows `fecha: "2026-04-27T14:48:00.000Z"` (ISO output of correctly parsed `"April 27, 2026, 9:48 AM"`) ✓.
- **Committed in:** `94ccc9a`

### Single-Commit Pattern

The plan's `<done>` for Task 2 explicitly required: "A single commit captures the rewrite + cleanup state — production never carried inspection-only code." This conflicts with the orchestrator's generic "per-task atomic commit" rule. The plan's pattern (mirror of 02-01) wins — single feat commit `94ccc9a` includes:
- Adapter (`src/lib/sheets/payouts.ts`)
- Schema additions (`src/lib/domain/schemas.ts`)
- Type additions (`src/lib/domain/types.ts`)
- Smoke route (`src/app/api/payouts-smoke/route.ts`)

The diagnostic route at `src/app/api/diagnose-payouts/route.ts` was created in Task 1, used to capture findings, and deleted before commit. Git never tracked it. This precisely mirrors Plan 02-01's pattern documented in `02-01-SUMMARY.md`.

## Authentication Gates

None encountered. `.env.local` already had `GOOGLE_SERVICE_ACCOUNT_*` and `GOOGLE_SHEETS_PAYOUTS_ID` from Phase 1, plus `SESSION_SECRET` to sign a session cookie for diagnostic + smoke calls (used `jose` directly via a one-liner Node script rather than the login UI form). Dev server pre-flight (kill port 3000 if in use; nvm path resolution because lazy-load shells don't expose `npm` directly) was the only setup friction — captured for future plans that need local dev.

## Verification Checklist

- [x] `npm run build` succeeded (zero TS errors)
- [x] `npm run lint` passed (only 2 pre-existing warnings unrelated to this plan)
- [x] `/api/payouts-smoke` ok=true count=797 skipped=1 (0.13%)
- [x] `/api/diagnose-payouts` returns 404 (route deleted)
- [x] `/api/smoke` STILL ok=true count=3188 skipped=44 (no regression on transactions adapter)
- [x] `grep -r "diagnose-payouts" src/` returns nothing (clean)
- [x] `grep -E "(new Intl\\.|toLocaleString|toLocaleDateString)" src/lib/sheets/payouts.ts src/lib/domain/schemas.ts src/lib/domain/types.ts` returns nothing (single Intl gate preserved)
- [x] No new files outside `src/lib/sheets/`, `src/lib/domain/`, `src/app/api/payouts-smoke/`

## Next Phase Readiness

**Plan 03-02 (payouts domain + page) is unblocked.** The Payout interface is stable; pure-function aggregations can be written against it. Three forward-impact items to remember:

1. **Empresa join required.** When the URL filter `?empresa=$X` is active, page composition must build a `Map<transactionId, empresaId>` from BD_Plataforma's transactions and use it to populate `Payout.empresa_id` for filtering. No-filter case can skip the join entirely.

2. **Percentile filter is `state==completed`.** Per 03-CONTEXT.md essentials. The `latencySeconds` fallback to Aging exists defensively but headline P50/P95 must NOT include in_progress/failed rows.

3. **Destination split needs design call.** The histogram split-by-medium tarjeta/banco from 03-RESEARCH.md doesn't exist. Options: (a) histogram split by `state==completed` only (not by medium); (b) group by bank — top 5 banks + "otros"; (c) drop the split entirely. User input may be needed in Plan 03-02 brainstorming.

**Blockers/concerns to add to STATE.md:**

- BD_Payouts has NO card payouts in production — PAY-04's split assumption needs reinterpretation.
- BD_Payouts has empresa identity decoupled from BD_Plataforma's tikintag — every empresa-filtered Payouts query requires a Transaction ID join.
- One row had a numeric `Holder` cell (Row 188 in current data); skip rate 0.13% is acceptable but worth monitoring as data grows.
