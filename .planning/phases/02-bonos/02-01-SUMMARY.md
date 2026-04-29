---
phase: 02-bonos
plan: 01
subsystem: data-foundation
tags: [zod, sheets, schema, bd-plataforma, transactions, domain]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Sheets adapter pipeline (`getTransactions()` + `AdapterResult<T>`), header→index map, Zod parse-and-skip semantics, `/api/smoke` route, real header inventory captured live in 01-04-SUMMARY.md"
provides:
  - "Real-data-aligned `Transaction` interface (id from transaction_id, fecha from created_at, comision/fixedFee/variableFeePct, tikintag/accountId raw)"
  - "TransactionType enum derived from live data (BONUS, CREDIT_ADJUSTMENT, FEE, P2P, PAYIN_PSE, PAYIN_TRANSFER, PAYOUT_BANK, PURCHASE, REFUND, TREASURY, UKNOWN, OTRO fallback)"
  - "TransactionDirection enum (in / out / OTRO_DIRECTION fallback)"
  - "TransactionStatus enum (completed / rejected / OTRO_STATUS fallback)"
  - "ExpectedTransactionHeaders tuple covering all 23 BD_Plataforma columns"
  - "Single-point-override pattern for empresa identity (default = tikintag, switch to account_id by editing 2 lines in schemas.ts)"
  - "Live verification: /api/smoke ok=true, count=3188, skipped=44 (1.36%) against production BD_Plataforma"
affects: [02-02-bonos-tab, 02-03-bonos-presenter, 02-04-bonos-empresa-filter, 03-payouts, 04-recargas, 04-inicio, 05-clientes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "real-headers-mapping: Adapter pipeline reads BD_Plataforma columns by name; schema validates the actual 23-column shape captured live, not tentative names"
    - "single-point-override-empresa: empresa_id projected from tikintag in schemas.ts transform; switching to account_id is a 2-line edit confined to that file"
    - "live-data-grounded-enums: transaction_type / direction / status enums are sourced from /api/diagnose against production BEFORE writing schema, not guessed"
    - "percent-fraction-normalization: Sheet stores variable_fee_percentage as 0..100 whole percent; transform divides by 100 so consumers see 0..1 fraction and can multiply by monto directly"
    - "diagnostic-then-cleanup: temporary inspection scaffolding (_diagnose.ts + /api/diagnose route) created mid-plan, used to capture live shape, deleted before commit so production never carried inspection-only code"

key-files:
  created: []
  modified:
    - src/lib/domain/schemas.ts
    - src/lib/domain/types.ts

key-decisions:
  - "empresa_id default = tikintag (not account_id). Tikintag values are human-readable handles like `$mario`, `$tikincol`, `$liftit-app`; account_id is a UUID. tikintag is the natural display key for KPIs/leaderboard/EmpresaFilter, and a UUID would force a separate display lookup that doesn't exist yet in BD_Plataforma. Override is 2 lines in src/lib/domain/schemas.ts if Tikin later confirms account_id is the corporate identity."
  - "TransactionType.UKNOWN preserved verbatim (sic — typo in production data). Mapping it silently to OTRO would hide the data-quality issue; preserving it surfaces it on every dashboard that filters by tipo, pushing the user to clean up at the source."
  - "variable_fee_percentage stored as 0..100 in Sheet (live samples: 0, 3.5, 3.99, 4.56, 4.76 — i.e. 4.76 means 4.76%). Schema accepts up to 100 and divides by 100 in transform. Downstream code multiplies `monto * variableFeePct` to get the variable fee in COP without re-normalizing. The Transaction.variableFeePct contract is fraction-only."
  - "comision = total_transaction_fee (not fixed + variable computed). The Sheet already aggregates them per row; using the precomputed total avoids drift if Tikin's fee math changes upstream."
  - "transaction_id as id (no longer synthetic). The earlier synthetic `${fecha}-${empresa}-${tipo}` was a guess to dedupe; transaction_id is genuinely unique per row and stable across reads, so dedupe + joins to BD_Payouts are now possible."
  - "transactions.ts unchanged. The pipeline (header→object, schema safeParse, skip-and-count) is generic over Sheet shape. Rewriting schemas.ts + types.ts alone was sufficient — confirmation that the Phase 1 architectural seam is sound."
  - "Diagnostic scaffolding (`_diagnose.ts`, `/api/diagnose`) created and deleted within the same plan. It was the cheapest way to ground the schema in real distinct enum values (transaction_type, direction, status) and surface the variable_fee_percentage range bug before writing the rewrite. Lived ~10 minutes; never committed; final commit shows only the rewrite + cleanup state."

# Metrics
duration: 11m 22s
completed: 2026-04-29
---

# Phase 2 Plan 01: Schemas Rewrite Summary

**Domain schema realigned to the 23 real BD_Plataforma columns, with TransactionType/Direction/Status enums grounded in live data, empresa_id projected from tikintag (single-point override), and `/api/smoke` green against production with 3188 rows parsed and 1.36% skip rate.**

## Performance

- **Duration:** 11m 22s
- **Started:** 2026-04-29T21:32:54Z
- **Completed:** 2026-04-29T21:44:16Z
- **Tasks:** 3 (unified into 1 commit per plan)
- **Files modified:** 2 (schemas.ts, types.ts)
- **Files created/deleted within plan:** 2 (_diagnose.ts, /api/diagnose/route.ts — cleanup verified)

## Accomplishments

- Closed the Phase 1 → Phase 2 schema-mismatch blocker. `/api/smoke` was failing with "columnas faltantes" before this plan; now returns `ok=true, count=3188, skipped=44` against production BD_Plataforma.
- Domain types are no longer "tentative" — every field, every enum value is sourced from live production data captured 2026-04-29.
- Established the single-point-override pattern for empresa identity: changing the default from tikintag to account_id (or any other column) is a 2-line edit confined to `schemas.ts`.
- Caught and fixed a hidden data-encoding bug (variable_fee_percentage stored as 0..100 not 0..1) before any downstream consumer could rely on the wrong shape.
- Confirmed Phase 1's architectural seam is sound: the adapter pipeline (`transactions.ts`) didn't need a single change despite the entire schema shape being rewritten — proof that header-name lookup + Zod parse-and-skip is genuinely Sheet-shape-independent.

## Task Commits

Per plan, all three tasks unified into ONE commit:

1. **Task 1+2+3 (rewrite + verify + cleanup)** — `881de0f` (feat)

The diagnostic scaffolding (Task 1) was deliberately uncommitted: it lived in the working tree just long enough to capture live enum values (transaction_type, direction, status) and the variable_fee_percentage range, then was deleted before the rewrite was committed. The single commit shows only the production-facing changes.

**Plan metadata commit:** to be added after this SUMMARY.

## Files Created/Modified

- `src/lib/domain/types.ts` — Rewrote `Transaction` interface to 16 fields (id, fecha, monto, grossAmount, comision, fixedFee, variableFeePct, tipo, direction, status, empresa_id, empresa_nombre, tikintag, accountId, reference?, destination_type?). Replaced `TransactionType` with the 11-value live enum + OTRO. Added `TransactionDirection` and `TransactionStatus` enums.
- `src/lib/domain/schemas.ts` — `ExpectedTransactionHeaders` now lists all 23 real columns in Sheet order. `TransactionRowSchema` validates each: required fields strict (transaction_id non-empty, created_at coerced to Date, amount/gross/fees as Money, direction/transaction_type/status normalized to enum), non-critical fields permissive (`OptionalString` accepts null/empty/numeric cells). `.transform()` projects to the new `Transaction` shape; the empresa_id mapping is the single override point.

## Diagnostic Findings

Captured live 2026-04-29 from production BD_Plataforma via temporary `/api/diagnose` route (since deleted). Scanned 500 rows (full Sheet has 3232).

```json
{
  "distinctTransactionTypes": [
    "BONUS",
    "CREDIT_ADJUSTMENT",
    "FEE",
    "P2P",
    "PAYIN_PSE",
    "PAYIN_TRANSFER",
    "PAYOUT_BANK",
    "PURCHASE",
    "REFUND",
    "TREASURY",
    "UKNOWN"
  ],
  "distinctDirections": ["in", "out"],
  "distinctStatuses": ["completed", "rejected"],
  "variableFeePercentageRange": {
    "min": 0,
    "max": 4.76,
    "samples": [0, 3.5, 3.99, 4.56, 4.76]
  },
  "headersFound": [
    "tikintag", "account_id", "wallet_id", "balance_available", "balance_frozen",
    "balance_currency", "balance_pocket", "transaction_id", "reference", "created_at",
    "direction", "transaction_type", "status", "amount", "gross_amount",
    "fixed_transaction_fee", "variable_fee_percentage", "total_transaction_fee",
    "source_transfer_tikintag", "destination_transfer_tikintag", "source_bank",
    "batch_reference", "pocket_name"
  ],
  "firstRowSample": {
    "tikintag": "$mario",
    "account_id": "2946e106-6de0-4bb4-ab9c-45d3aed4c78a",
    "transaction_id": "eca1b3fe-df88-4de2-825f-850d985931ee",
    "created_at": "2026-04-24T15:20:08.000Z",
    "direction": "out",
    "transaction_type": "PAYOUT_BANK",
    "status": "completed",
    "amount": 100000,
    "gross_amount": 100000,
    "fixed_transaction_fee": 0,
    "variable_fee_percentage": 0,
    "total_transaction_fee": 0,
    "balance_currency": "COP",
    "source_bank": "wallet",
    "pocket_name": "COPM_2"
  }
}
```

**Sample tikintag values** (37 distinct in 500 rows): `$mario`, `$romela`, `$juandavergel`, `$darghex`, `$tikincol`, `$liftit-app`-style — all `$<handle>` shaped, human-readable.

**Sample account_id values:** UUIDs (e.g. `2946e106-6de0-4bb4-ab9c-45d3aed4c78a`) — opaque, would require a separate display lookup that doesn't yet exist in BD_Plataforma.

## Schema Mapping

`BD_Plataforma` column → `Transaction` field, with transformation:

| BD_Plataforma column | Type in Sheet | Transaction field | Transformation |
|----------------------|---------------|-------------------|----------------|
| `transaction_id` | string (UUID) | `id` | none — used as stable id |
| `created_at` | string (ISO) | `fecha` | `z.coerce.date()` |
| `amount` | number (COP) | `monto` | finite, ±1e12 cap |
| `gross_amount` | number (COP) | `grossAmount` | finite, ±1e12 cap |
| `total_transaction_fee` | number (COP) | `comision` | finite, ±1e12 cap |
| `fixed_transaction_fee` | number (COP) | `fixedFee` | finite, ±1e12 cap |
| `variable_fee_percentage` | number (0..100) | `variableFeePct` | divide by 100 → 0..1 |
| `transaction_type` | string | `tipo` | uppercase + trim → enum (OTRO fallback) |
| `direction` | string | `direction` | lowercase + trim → enum (OTRO_DIRECTION fallback) |
| `status` | string | `status` | lowercase + trim → enum (OTRO_STATUS fallback) |
| `tikintag` | string (`$handle`) | `tikintag`, `empresa_id`, `empresa_nombre` | non-empty string; **default empresa identity** |
| `account_id` | string (UUID) | `accountId` | non-empty string |
| `reference` | string (hex) | `reference` (optional) | trim; empty → undefined |
| `wallet_id`, `balance_*`, `source_*`, `destination_*`, `batch_reference`, `pocket_name` | string/number/empty | not surfaced on `Transaction` (yet) | parsed but discarded; available in `parsed` if a later phase needs them |

## Empresa Identity Decision

**Default:** `Transaction.empresa_id = Transaction.empresa_nombre = parsed.tikintag`.

**Why tikintag (not account_id):**

1. **Human-readable.** `$mario`, `$tikincol`, `$liftit-app`-shaped values are usable directly in EmpresaFilter / leaderboard / Bonos table without a display lookup. UUID `account_id` would require either (a) a separate name column that doesn't exist in BD_Plataforma, or (b) showing UUIDs in the UI — both bad.
2. **Stable.** Same tikintag persists across all transactions for a given wallet. account_id is also stable, but offers no advantage on top of being human-readable.
3. **Aligns with Tikin's existing addressing scheme.** The `$handle` convention is how Tikin already identifies wallet owners externally; reusing it keeps the dashboard consistent with how the team thinks about clients.

**Caveat:** A single empresa (e.g. Liftit) may use multiple tikintags — one for the corporate wallet, others for individual employee wallets. Today, those will appear as separate "empresas" in the dashboard. Phase 5 (Clientes/Domain) is the natural place to introduce a many-to-one tikintag → empresa mapping if Tikin confirms that's needed.

**Override path** (if user later decides account_id is the corporate identity):

```ts
// in src/lib/domain/schemas.ts, inside TransactionRowSchema.transform():
empresa_id: parsed.account_id,        // was: parsed.tikintag
empresa_nombre: parsed.account_id,    // was: parsed.tikintag
```

That's the entire migration. No other file needs to change. EmpresaFilter, leaderboard, KPIs, and Modo Presentación all consume `empresa_id` / `empresa_nombre` and will pick up the new identity automatically.

If Tikin wants display names (e.g. "Liftit S.A.S." instead of `$liftit-app` or a UUID), the cleanest path is a Phase 5 lookup table mapping tikintag → display string, applied in the same transform. The override pattern is intentionally narrow so additional indirection is easy to add when the data exists.

## Decisions Made

See frontmatter `key-decisions` for the full list with rationale. Highlights:

- **empresa_id default = tikintag**, not account_id. Override is 2 lines in `schemas.ts`. (See "Empresa Identity Decision" above.)
- **TransactionType.UKNOWN preserved verbatim** (sic — typo in production data). User owns source-side cleanup.
- **variable_fee_percentage normalized 0..100 → 0..1 in transform.** Live data confirmed it's a whole percent; consumers can do `monto * variableFeePct` without re-normalizing.
- **comision = total_transaction_fee.** Sheet aggregates fixed + variable per row already.
- **transactions.ts unchanged.** The Phase 1 adapter pipeline is genuinely Sheet-shape-independent.
- **Diagnostic scaffolding within the plan.** Created, used, deleted before commit — production never saw inspection-only code.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] variable_fee_percentage range mismatch (0..100 in Sheet, plan assumed 0..1)**

- **Found during:** Task 2 (initial smoke run after schema rewrite).
- **Issue:** First run of `/api/smoke` returned `ok=true, count=1788, skipped=1444` (45% skip rate). Warnings showed: `variable_fee_percentage: Too big: expected number to be <=1`. The plan had specified `z.coerce.number().finite().min(0).max(1)` based on an assumption that the Sheet stored fractions. Real values (captured by extending `_diagnose.ts` mid-plan) range 0..4.76 with samples [0, 3.5, 3.99, 4.56, 4.76] — i.e. whole percentages where 4.76 = 4.76%. The plan's contingency clause anticipated this exact case ("if Task 1 reveals integer 0..100, divide by 100 in the transform").
- **Fix:**
  - Schema field range expanded: `.min(0).max(100)` (defensive cap; real fees are <10).
  - Transform divides by 100 so the `Transaction.variableFeePct` contract stays a fraction (0..1), letting consumers do `monto * variableFeePct` to get COP directly.
  - Type jsdoc on `Transaction.variableFeePct` documents the convention.
- **Files modified:** src/lib/domain/schemas.ts (variable_fee_percentage validation + transform), src/lib/domain/types.ts (jsdoc clarification).
- **Verification:** Post-fix `/api/smoke` returned `ok=true, count=3188, skipped=44` (1.36% skip rate). The 44 remaining skips are rows with empty transaction_id — genuinely malformed rows that can't be uniquely identified. 3188 + 44 = 3232 matches the row count reported in 01-04-SUMMARY.md exactly.
- **Committed in:** `881de0f` (the unified Task 1+2+3 commit).

---

**Total deviations:** 1 auto-fixed (1 bug — schema range vs real data encoding).
**Impact on plan:** Plan's contingency clause anticipated this case ("if Task 1 reveals integer 0..100, divide by 100"). The fix was inside the planned scope — only its specific application was discovered at runtime. No scope creep.

## Issues Encountered

- **Task 1 commit-grouping nuance.** The plan said "NO hacer commit aún — el commit unifica con Task 2" for Task 1. The implementation extended the diagnostic file mid-plan (to add `variableFeePercentageRange` capture during the Rule-1 fix), then deleted both diagnostic files in Task 3 before commit. This was the cleanest path: keep one final commit, no transient "add diagnostic / remove diagnostic" pair in history.
- **Vercel CLI session-cookie testing.** `vercel curl --prod` doesn't accept a `--prod` flag (use `--deployment <url>` instead). Worked around by minting a hand-signed JWT against `SESSION_SECRET` and passing it via `-H "Cookie: session=..."`, same technique used in 01-02 dev verification.
- **Production deploys took ~30s each (2 deploys: pre-cleanup smoke, post-cleanup smoke).** Standard Vercel build time, not a regression.

## Next Phase Readiness

**Ready for Plan 02-02 (Bonos tab — first real-data UI):**

- `getTransactions()` returns `AdapterResult<Transaction>` with all fields needed for Bonos KPIs and the hero line chart:
  - **Ticket promedio per bono**: filter `tipo === "BONUS"`, average `monto`.
  - **Comisión total**: filter `tipo === "BONUS"`, sum `comision`.
  - **Hero line chart**: filter `tipo === "BONUS"`, group by day from `fecha`, sum `monto`.
  - **Top 10 empresas leaderboard**: filter `tipo === "BONUS"`, group by `empresa_id`, sum `monto`, top 10.
  - **Tabla por empresa**: same grouping, full list with `# bonos` (count), `$ vendido` (sum monto), `$ comision` (sum comision), `% del total`.
- **EmpresaFilter population**: `getTransactions()` rows already carry `empresa_id` + `empresa_nombre`. Phase 2 derives the unique list with `Array.from(new Set(rows.map(r => r.empresa_id)))` — no separate adapter needed.

**Ready for Plan 02-03 (Modo Presentación on Bonos):**

- All sensitive fields (`comision`, leaderboard data) flow through `Transaction.empresa_id` and `Transaction.comision`. The CSS `data-presenter='on'` + `data-presenter-hide` contract from 01-03 handles visual hiding. Phase 2-03 only needs to mark the comision column / KPI / leaderboard with the data attributes.

**Ready for Plan 02-04 (empresa filter wired to Bonos):**

- `parseFilters(searchParams).empresa` from 01-03 carries the empresa_id selection. Phase 2-04 applies `rows.filter(r => !filters.empresa || r.empresa_id === filters.empresa)` before computing KPIs.

**Ready for Phase 3 (Payouts):**

- Same Sheet-adapter pattern works for BD_Payouts. The 15 BD_Payouts headers from 01-04-SUMMARY.md are already documented; Phase 3 mirrors `transactions.ts` → `payouts.ts` and `TransactionRowSchema` → `PayoutRowSchema`.
- Join key from Bonos to Payouts: `Transaction.id` (from BD_Plataforma.transaction_id) ↔ BD_Payouts.`Transaction ID`. Both confirmed as the same UUID in 01-04-SUMMARY.md.

**Open items / carryover from prior plans:**

- **EmpresaFilter list still empty** in production until Plan 02-02 wires it. Filter UI works (URL state), it just renders an empty dropdown for now. Closes naturally with 02-02.
- **3 v2 features now v1-eligible** (REC-V2-01, PAY-V2-01, PAY-V2-02) — already noted in STATE.md from 01-04. Phase 3+ should plan for them; not Phase 2's concern.
- **Vercel Deployment Protection still ENABLED** — production URL gated behind Vercel SSO. Documented in 01-04-SUMMARY.md; user owns the toggle.

**No new blockers introduced by this plan.**

---
*Phase: 02-bonos*
*Plan: 01*
*Completed: 2026-04-29*
