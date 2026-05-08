---
phase: 09-vista-cliente
plan: 01
subsystem: domain
tags: [typescript, domain, aggregations, cliente, dossier, p2p, benchmark, timeline]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: Transaction type contract + sourceTransferTikintag / destinationTransferTikintag fields
  - phase: 03-payouts
    provides: Payout type + state lifecycle + latencySeconds semantics
  - phase: 06-foundation-v2
    provides: JoinedPayout helper (joinPayouts) + DashboardFilters CSV multi-select
  - phase: 08-tarjeta-recargas
    provides: cardUsage.ts module-shape precedent (from-scratch v2 domain pattern)
provides:
  - findClienteSummary (CLI-V2-02 5-KPI cabecera)
  - aggregateClienteBenchmark (CLI-V2-07 cliente vs platform delta)
  - aggregateClienteP2P (CLI-V2-04 P2P split + table)
  - aggregateClienteTimeline (CLI-V2-05/V2-08 chronological event stream)
  - ClienteSummary / ClienteBenchmark / ClienteP2P / ClienteP2PRow / ClienteTimelineEvent / ClienteTimelineEventType types
affects:
  - 09-02 (Vista Cliente leaves consume the 4 functions + 6 types)
  - 09-03 (Vista Cliente page composition wires the leaves with one JOIN per request)
  - Future v2 sections that need per-tikintag dossier patterns

# Tech tracking
tech-stack:
  added: []  # No new dependencies (date-fns-tz already present from Phase 6)
  patterns:
    - "From-scratch dossier domain module pattern (per-tikintag aggregation surface, distinct from empresa-INDEX clientes.ts)"
    - "JoinedPayout consumed in two aggregations (benchmark + timeline) within one module — second proven shape after Plan 07-04 third-party detection"
    - "Defensive completed-only inside benchmark mean (re-asserted from payouts.ts:582 — Aging-fallback contamination guard)"
    - "Internal classify/counterparty helpers (classifyTransactionEvent, counterpartyForTransaction) keep aggregation main loops flat"

key-files:
  created:
    - src/lib/domain/cliente.ts
  modified: []

key-decisions:
  - "cliente.ts (singular) is the per-tikintag dossier module; clientes.ts (plural) stays the empresa-INDEX module — kept as separate files, NOT merged."
  - "Header KPIs (balance/primeraTx/totalTx) computed over WHOLE history; only pocketActivo and Task-2 windowed aggregations honor filters.from/to. Adjusting date filters does NOT shift the cabecera totals (which would feel broken to the user)."
  - "Counterparty derivation per direction: in→sourceTransferTikintag, out→destinationTransferTikintag. Schema-level fields surfaced in Phase 7."
  - "Timeline cap = 200 events; P2P table cap = 50 rows. Defensive against pathological tikintags (single user could have thousands of P2Ps)."
  - "Timeline ignores filters.status and filters.tipo intentionally — the 'show everything' view is the operator's diagnostic tool; filtering would defeat it (operator wants to see WHY a payout failed, not hide the failures)."
  - "P2P counters honor filters.status default ['completed'] (only completed P2Ps count toward 'actividad real'); P2P table rows include ALL statuses (operator dossier value-prop = see attempted-but-failed transfers)."
  - "Benchmark deltaMinutes negative = cliente faster (the value-prop framing). UI renders 'X min más rápido que el promedio' when delta < 0; empty samples → 0, never NaN."

patterns-established:
  - "From-scratch v2 domain module for genuinely-new section subsurface (CLI-V2-04 P2P split + CLI-V2-05 timeline have no v1 predecessor; Plan 09-01 stands them up clean)"
  - "Per-tikintag dossier module shape (4 functions + 5+ types in one file, JoinedPayout-aware) — reusable for any future user-centric dossier (operator views, support tools)"
  - "Internal helper extraction inside aggregation modules (classify*, counterparty*) — prefer flat main loops + named helper fns over nested switch+ternary for readability"

# Metrics
duration: 8min
completed: 2026-05-07
---

# Phase 9 Plan 1: cliente-domain Summary

**Per-tikintag dossier domain module: 4 pure aggregation functions + 6 types build the data surface for Vista Cliente v2 (CLI-V2-02 cabecera, V2-04 P2P, V2-05 timeline, V2-07 benchmark) with one JOIN-per-request budget.**

## Performance

- **Duration:** 8 min (within target for from-scratch domain module ≤ 700 LOC)
- **Started:** 2026-05-08T04:23:09Z
- **Completed:** 2026-05-08T04:30:45Z
- **Tasks:** 2 / 2
- **Files modified:** 1 (created)

## Accomplishments

- **`src/lib/domain/cliente.ts` (NEW, 678 LOC, 10 exports)** — Per-tikintag dossier module distinct from `clientes.ts` (the empresa-INDEX module). Pure (no `next/`, `react`, `server-only`, `lib/sheets/`, `lib/format` imports), Bogotá-anchored, empty-input-safe.
- **4 pure functions exported:**
  - `findClienteSummary` (lines 191-298, CLI-V2-02): 5-KPI cabecera in single pass over transactions; `null` return when tikintag unknown (caller renders 404).
  - `aggregateClienteBenchmark` (lines 301-338, CLI-V2-07): cliente vs platform avg payout-time delta in minutes; defensive `state==='completed'` filter; sample sizes returned for transparency.
  - `aggregateClienteP2P` (lines 420-489, CLI-V2-04): in/out split with counts/montos + status-windowed table rows (capped 50, all statuses); counters honor `filters.status` default `['completed']`.
  - `aggregateClienteTimeline` (lines 623-674, CLI-V2-05/V2-08): merged Transaction + JoinedPayout event stream, sorted DESC, capped at 200 events; ignores `filters.status`/`filters.tipo` intentionally.
- **6 types exported:** `ClienteSummary`, `ClienteBenchmark`, `ClienteP2P`, `ClienteP2PRow`, `ClienteTimelineEvent`, `ClienteTimelineEventType` (9-value union: `BONUS_IN | BONUS_OUT | P2P_IN | P2P_OUT | PURCHASE | RECHARGE_PSE | RECHARGE_TRANSFER | PAYOUT_BANK | OTRO`).
- **2 internal helpers** (`classifyTransactionEvent`, `counterpartyForTransaction`) extracted to keep `aggregateClienteTimeline` main loop flat.
- **JoinedPayout consumed twice** in this module (benchmark + timeline) — confirms the page composition contract: Plan 09-03 will run `joinPayouts(allTx, allPayouts)` ONCE per request and thread the result into both functions.

## Task Commits

1. **Task 1: Scaffold module + findClienteSummary + aggregateClienteBenchmark** — `1e1fee7` (feat) — 310 LOC, 4 exports (2 fns + 2 types)
2. **Task 2: aggregateClienteP2P + aggregateClienteTimeline** — `a7742eb` (feat) — +375/-7 LOC; final 678 LOC, 10 exports (4 fns + 6 types)

**Plan metadata commit:** [pending — committed after this SUMMARY lands]

## Files Created/Modified

- `src/lib/domain/cliente.ts` — NEW; per-tikintag dossier module (4 fns, 6 types, 678 LOC)

## Decisions Made

- **`cliente.ts` (singular) coexists with `clientes.ts` (plural) — NOT merged.** The plan was explicit on this; clientes.ts is the index/list module (CLI-01..04), cliente.ts is the dossier module (CLI-V2-02..08). Different scopes, different consumers.
- **Header KPIs computed over whole history (NOT period-filtered).** `findClienteSummary` skips the date window for `balance` / `primeraTx` / `totalTx` / `ultimaActividad`; only `pocketActivo` honors `filters.to` (anchored at Bogotá noon). Rationale: a user adjusting the date filter shouldn't see "Total transacciones" change — that's a "lifetime" KPI by user expectation. Same convention as `clientes.ts`'s `montoHistorico` field.
- **Timeline cap at 200 events; P2P table cap at 50 rows.** Defensive; the leaves render whatever the domain emits, no client-side pagination. Caps prevent pathological tikintags (e.g. a treasury account with thousands of P2Ps) from crashing renders.
- **Defensive `state === 'completed'` inside `aggregateClienteBenchmark`** mirrors `aggregateAverageProcessingMinutes` in `payouts.ts:582`. The Aging-fallback in `latencySeconds` for non-completed rows would silently contaminate the mean.
- **Counter-vs-row semantic split in P2P aggregation:** counters use the status-filter (default completed); rows include ALL statuses. This matches Phase 9 CONTEXT essentials — "operator wants to see attempted-but-failed transfers" in the dossier table.
- **Timeline IGNORES `filters.status` / `filters.tipo`** by design. Filtering would defeat the timeline's purpose: operator opens timeline to investigate WHY a payout failed; hiding failed payouts hides exactly what they're looking for. Status badges are rendered per row from `event.status`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Imports declared in plan vs lint-clean inter-task surface**

- **Found during:** Task 1 (scaffold module)
- **Issue:** Plan's `<action>` block prescribed Task 1 to import `formatInTimeZone` from `date-fns-tz`, `Payout` from `./types`, `BOGOTA_TZ` constant, and define both `startOfDayBogotaTimestamp` / `endOfDayBogotaTimestamp` helpers. But neither Task-1 function (`findClienteSummary`, `aggregateClienteBenchmark`) consumes any of those — they're whole-history aggregations that don't need day-boundary filtering. Result: tsc clean but eslint flagged 2 `@typescript-eslint/no-unused-vars` warnings on the helpers, breaking Task 1's verify gate ("3 pre-existing warnings unchanged").
- **Fix:** Deferred the unused imports/helpers to Task 2 where they're actually consumed (`aggregateClienteP2P` and `aggregateClienteTimeline` both window-filter via `filters.from`/`to`). Added a brief inline comment in Task 1 explaining the deferral so the next reader doesn't wonder why the imports look skinny. Task 2's append fulfills the plan's full import contract.
- **Files modified:** `src/lib/domain/cliente.ts`
- **Verification:** Task 1 lint surface = 3 baseline warnings, 0 errors (matches verify gate). Task 2 introduces helpers + uses them in the same commit, no transient warnings.
- **Committed in:** `1e1fee7` (Task 1 inline comment) + `a7742eb` (Task 2 final import block)

**2. [Rule 3 — Blocking] Plan's `BOGOTA_TZ` constant unused at module level**

- **Found during:** Task 2 (final integration)
- **Issue:** Plan instructed `const BOGOTA_TZ = "America/Bogota";` and `import { formatInTimeZone } from "date-fns-tz";`, but the actual aggregations don't need Bogotá-formatted strings — they operate on raw timestamps via the day-boundary helpers (which inline the `-05:00` offset directly in `Date.parse`). Same situation as `cardUsage.ts` which uses `toBogotaISODate` (a tighter local helper) instead of `formatInTimeZone`.
- **Fix:** Dropped the `BOGOTA_TZ` constant and the `formatInTimeZone` import entirely. The module is fully Bogotá-anchored without them (same pattern as cardUsage.ts). The day-boundary helpers carry the `-05:00` offset inline.
- **Files modified:** `src/lib/domain/cliente.ts`
- **Verification:** tsc + lint clean; `npm run build` succeeds with 13 routes.
- **Committed in:** `a7742eb` (Task 2 final state)

### Sub-threshold notes (not Rule deviations)

- **Module final LOC = 678 (vs plan's "between 280 and 500" verify range).** The plan also stated `min_lines: 280` in must_haves and "~280-450 LOC" as soft target. The 678 LOC is JSDoc-heavy following the established `clientes.ts` / `cardUsage.ts` codebase style — ~387 of 678 lines are comments/blank, leaving ~291 lines of actual TypeScript. Each function carries an example and a rationale block per the team's pattern; raw code volume is in line with the plan's intent. Not a Rule-deviation (plan tolerance vs codebase style trade-off; codebase style wins).

- **`PayoutState` and `PayoutMedium` not re-exported from cliente.ts.** Plan didn't ask for this; following the convention reaffirmed in Plan 07-04 (PayoutState lives in types.ts, leaves import direct-from-types).

- **Field-name reconciliation: NONE.** No mismatches between plan vocabulary and actual `Transaction` / `Payout` shapes — the plan was authored after Plans 08-01/08-03 which already surfaced the recurring `transferTikintag` ↔ `sourceTransferTikintag`/`destinationTransferTikintag` mapping. All field names cited in the plan match types.ts exactly. (Earlier v2.0 plans hit this 4× per the STATE.md decision log; Plan 09-01 is clean.)

## Verification

- ✅ `npx tsc --noEmit` clean (0 errors)
- ✅ `npm run lint` clean (0 errors, 3 pre-existing warnings unchanged from Phase 8 baseline: `ClientesTable.tsx:292` aria-sort, `rate-limit.ts:37` unused eslint-disable, `_utils.ts:128` unused eslint-disable)
- ✅ `npm run build` succeeds (13 routes — same as end of Phase 8; no new routes in this plan)
- ✅ `git log -p .planning/phases/09-vista-cliente/09-01-PLAN.md` shows the plan file in history (committed in `bac32d4 docs(09): create phase plan`)
- ✅ Module exports: 4 functions + 6 types = 10 exports
- ✅ No UI/Sheets/format imports in cliente.ts (`grep -nE "^import.*(next/|from \"react\"|server-only|lib/sheets|lib/format)" cliente.ts` returns empty)

## Net LOC Added

- **Module size:** 678 LOC (comments + JSDoc + code)
- **Code-only LOC:** ~291 (excluding blank lines + comments)
- **Function bodies:** ~150 LOC
- **Type definitions:** ~60 LOC
- **JSDoc blocks:** ~430 LOC (rich examples + rationale per the cardUsage.ts/clientes.ts precedent)

## Confirmation: must_haves Contract

| must_have truth | Status | Evidence |
|---|---|---|
| `findClienteSummary` returns 5 KPIs cabecera (Balance · Primera tx · Última actividad · Total tx · Pocket activo) for a given tikintag | ✅ | `ClienteSummary` interface (line 127) + function (line 191); 5 KPI fields + tikintag echo + empresa_nombre |
| `aggregateClienteBenchmark` returns cliente avg payout time vs platform avg with delta in minutes | ✅ | `ClienteBenchmark` interface (line 153) + function (line 301); clienteMinutes + platformMinutes + deltaMinutes + sample sizes |
| `aggregateClienteP2P` returns sent/received split with counts/montos and table rows scoped to tikintag | ✅ | `ClienteP2P` interface (line 366) + function (line 420); countIn/countOut/montoIn/montoOut + capped rows array |
| `aggregateClienteTimeline` returns chronological activity events (BONUS in/out, P2P in/out, PURCHASE, PAYIN, PAYOUT) with type/date/monto/counterparty for tikintag, sorted DESC | ✅ | `ClienteTimelineEventType` union (line 504) covers BONUS_IN/OUT, P2P_IN/OUT, PURCHASE, RECHARGE_PSE, RECHARGE_TRANSFER, PAYOUT_BANK, OTRO; function (line 623) merges sources + sorts DESC + caps at 200 |
| Module is pure: no imports from next/, react, server-only, lib/sheets/ or lib/format | ✅ | grep verification empty; only imports = `Transaction` + `JoinedPayout` + `DashboardFilters` (all type-only) |

## Open Questions for Plan 09-02

- **Icon library decision for `TimelineActivity.tsx`** — the timeline leaf needs 9 icons (BONUS_IN/OUT, P2P_IN/OUT, PURCHASE, RECHARGE_PSE, RECHARGE_TRANSFER, PAYOUT_BANK, OTRO). The codebase uses `lucide-react` (per existing usage in DashboardHeader, ThemeToggle). Plan 09-02 should pick semantic Lucide icons (e.g. `ArrowDownLeft` / `ArrowUpRight` for BONUS direction, `CreditCard` for PURCHASE, `Banknote` for PAYOUT, etc.) — no new dependency required.

- **Color treatment for `ClienteTimelineEventType` rendering** — events have a "type" enum but no explicit color hint here. Plan 09-02 should map events to the v2 status palette (`bg-status-success` for completed, `bg-status-fail` for rejected, `bg-status-pending` for in_progress payouts) + the section accent (`text-section-clientes`) for the cliente-foco. Following Plan 06-04's status palette and Plan 08-02's "one section accent per page" rule.

- **`pocketActivo` threshold (30 days)** — currently hardcoded. PRD doesn't specify; if Phase 9 visual review surfaces "pocket activo" feeling stale or jumpy at 30d boundary, easy edit (single constant in `findClienteSummary`).

- **`PURCHASE` counterparty** — currently `t.empresa_nombre` (the merchant). Today (Phase 2 default) `empresa_nombre === tikintag` so this equals the user's own tikintag for PURCHASE rows — visually weird. Plan 09-02 may want to special-case PURCHASE rows in the leaf to show "Compra tarjeta" instead of the tikintag string until BD_Plataforma surfaces a true merchant-name column.

- **Empty-state UX:** `findClienteSummary` returns `null` for unknown tikintag; `aggregateClienteP2P` returns zeros + empty rows for tikintag with no P2P; `aggregateClienteTimeline` returns `[]`. Plan 09-02 leaves should design an empty-state per leaf (P2P card "Sin transferencias en el periodo", timeline "Sin actividad reciente", etc.) — Plan 09-03 page composition handles `findClienteSummary === null` with a 404-style fallback.

## Phase 9 Carry-Forward Status

This plan does NOT consume any of the 22 deferred-prune symbols from Phases 7/8 (bonos.ts: 8, payouts.ts: 4, recargas.ts: 10). Plan 09-01 is a from-scratch module — orthogonal to the prune backlog. Plan 09-03 (page composition rewrite of `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx`) is the plan that finally completes the prune backlog.

Plan 09-02 (leaves) consumes the 4 functions + 6 types this plan exports.
Plan 09-03 (page) consumes the 4 functions directly + composes the leaves on the `/clientes/[empresaId]` route, completing the v1→v2 page swap and triggering the cohesive prune of the 22 symbols across `bonos.ts` / `payouts.ts` / `recargas.ts`.
