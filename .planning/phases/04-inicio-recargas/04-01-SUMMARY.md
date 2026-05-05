---
phase: 04-inicio-recargas
plan: 01
subsystem: domain
tags: [typescript, period, inicio, gmv, take-rate, empresas-activas, bonos-vendidos, date-fns, date-fns-tz, iso-week, pure-module]

# Dependency graph
requires:
  - phase: 02-bonos
    provides: bonos.ts pure-domain pattern (filter + summarize + aggregations), Bogotá-anchored date helpers (startOfDayBogotaTimestamp/endOfDayBogotaTimestamp at lines 53-74), Transaction interface (monto, comision, empresa_id, tipo, direction, status, fecha)
  - phase: 02-bonos
    provides: TransactionType enum with BONUS captured live (Plan 02-01)
  - phase: 01-foundation
    provides: DashboardFilters shape (from, to, empresa, presenter), Bogotá UTC-5 no-DST convention from url-state.ts, format.ts single Intl gate
provides:
  - computePriorPeriod (same-length immediately-prior window in Bogotá calendar; null when filters lack from/to or are malformed)
  - pctChange (zero-safe percent change as fraction; null when prior is 0/NaN/non-finite)
  - filterCompletedIn (Inicio default filter contract: direction='in' + status='completed' + Bogotá-anchored from/to + optional empresa; NO tipo filter — Inicio aggregates ALL completed inflows)
  - summarizeInicio (5 KPIs: gmv, comision, takeRate, empresasActivas, bonosVendidos; single-pass reduce; empty-input safe)
  - aggregateGMVByDate (GMVPoint[] sorted asc by YYYY-MM-DD bucket, no zero-fill)
  - aggregateGMVByWeek (GMVPoint[] sorted asc by RRRR-Www ISO week bucket)
  - aggregateActiveEmpresasByDate (ActiveEmpresaPoint[] with Set<empresa_id> dedup per bucket — Pitfall 11 closed)
  - aggregateActiveEmpresasByWeek (same with ISO-week bucket)
  - 4 stable output type interfaces (InicioSummary, InicioDeltaSummary, GMVPoint, ActiveEmpresaPoint)
affects: [04-02 inicio-hechos.ts (consumes filterCompletedIn for hechos curados scoping), 04-03 recargas.ts (consumes computePriorPeriod + pctChange for prior-period KPIs), 04-05 KPICardsInicio (consumes InicioDeltaSummary), 04-07 inicio page composition (wires filterCompletedIn + 4 aggregations + period utilities)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Period utilities as foundational module: period.ts has NO dependency on lib/format (avoids circular dep — period.ts is more foundational than format.ts), inlines literal Bogotá `T00:00:00-05:00` offset construction same as bonos.ts:53-62"
    - "Pure domain module shape continues the bonos.ts/payouts.ts/recargas.ts pattern: no next/, react, server-only, lib/sheets/ imports — only date-fns + date-fns-tz runtime + type-only DashboardFilters / Transaction / TransactionType"
    - "Inline date helpers (startOfDayBogotaTimestamp/endOfDayBogotaTimestamp) verbatim from bonos.ts:53-74 — fourth domain module after bonos.ts/payouts.ts/recargas.ts to make this DRY-vs-cohesion call"
    - "ISO week-numbering year format `RRRR-'W'II` (not `yyyy-'W'II`) to bucket year-boundary days correctly (Dec 30/31 → Jan W01 of next year)"
    - "Set<empresa_id> per bucket for distinct-empresa aggregation — guarantees a single empresa with N tx in one bucket counts as 1, not N (Pitfall 11)"
    - "pctChange returns `number | null` (not `number | NaN`) — caller renders em-dash for null, never Infinity/NaN leaking into KPI cards"

key-files:
  created:
    - src/lib/domain/period.ts (108 lines, 2 functions + JSDoc)
    - src/lib/domain/inicio.ts (361 lines, 6 functions + 4 types + 1 private const + 2 private helpers)
  modified: []

key-decisions:
  - "computePriorPeriod returns same-length immediately-prior window (April 30d → March 2-31, NOT March 1-31) — the user's spec in 04-CONTEXT.md is explicit: prior = same number of days, not the prior calendar month. Validated via fixture: April 1-30 (30d) → March 2-31 (30d, lengthDays=30, priorTo=Mar 31, priorFrom=Mar 31 - 29 = Mar 2)."
  - "computePriorPeriod returns null on missing OR malformed from/to (defensive shape check + finite-timestamp check + monotonic check toMs >= fromMs) — there is no defined 'prior' for an unbounded window. Caller renders em-dash via pctChange's null fallback"
  - "pctChange null on prior===0 / non-finite / NaN current — three distinct null cases (zero divisor, non-finite divisor, non-finite numerator) all collapse to null at one return site. Mirror of bonos.ts:286 pctDelTotal pattern"
  - "Inicio filter contract = direction='in' + status='completed' + from/to/empresa (NO tipo='BONUS' filter). 04-CONTEXT.md vision: GMV is total volume across ALL completed inflows, not just bonos. The bonosVendidos KPI is computed inside summarizeInicio over the full filtered set"
  - "summarizeInicio is single-pass reduce: tracks gmv, comision, bonosVendidos, Set<empresa_id> in one loop. takeRate computed AFTER (gmv > 0 ? comision/gmv : 0) so empty input → 0 (zero-safe), never NaN. Set→size for distinct count"
  - "Active-empresa aggregators use Map<bucket, Set<empresa_id>> shape — Set.add on existing id is no-op, set.size is the distinct count. Pitfall 11 (RESEARCH.md) explicitly closed: 1 empresa with 10 tx in one day counts as 1 active, not 10"
  - "Week bucket format `RRRR-'W'II` (e.g. 2026-W18) chosen over `yyyy-'W'II`. Rationale: yyyy is the calendar year, RRRR is the ISO week-numbering year — they differ for ~5 days/year at year boundaries (e.g. 2024-12-30 belongs to ISO week 2025-W01). Using yyyy would mis-bucket those days. RRRR-Www is also lexicographically chronological (string sort works as date sort)"
  - "period.ts decouples from @/lib/format intentionally — it's foundational and cannot import format.ts without risking circular deps. Direct `formatInTimeZone(d, 'America/Bogota', 'yyyy-MM-dd')` is used. inicio.ts also uses formatInTimeZone directly (same convention as recargas.ts per Plan 04-03 STATE entry)"

patterns-established:
  - "Foundational module isolation: period.ts is more foundational than format.ts (period can be called from anywhere including format itself in theory). Phase 4+ utility modules that are 'too foundational for format.ts' inline the Bogotá offset construction directly rather than introducing a circular dep risk"
  - "InicioDeltaSummary { current, prior } as a stable contract for 'KPI with delta vs prior' UI consumers — Plan 04-05 KPICardsInicio renders {current.gmv, pctChange(current.gmv, prior?.gmv ?? 0)} per card. Reusable beyond Inicio if Recargas adds delta support in v2 (REC-V2-XX)"
  - "Half-open period contract: from/to are inclusive both-ends (lengthDays = differenceInCalendarDays + 1, same as filterBonos). priorTo = subDays(fromDate, 1), priorFrom = subDays(priorTo, lengthDays - 1). The prior window is also inclusive both-ends so length matches"
  - "Multi-bucket-granularity aggregations: aggregateGMVByDate / aggregateGMVByWeek expose the same { bucket, value } shape with different bucket strings — UI can switch granularity by swapping which aggregator it calls without changing render logic. Same shape extension to ActiveEmpresaPoint { bucket, count }"

# Metrics
duration: 6m 9s
completed: 2026-05-05
---

# Phase 04 Plan 01: Period + Inicio Domain Library Summary

**Two pure foundational modules: `period.ts` (computePriorPeriod for same-length prior windows + zero-safe pctChange) and `inicio.ts` (filterCompletedIn + 5-KPI summarizeInicio + 4 chart aggregations with Pitfall-11-closed empresa dedup), both anchored to Bogotá calendar with no next/react/server-only/sheets imports.**

## Performance

- **Duration:** 6m 9s
- **Started:** 2026-05-05T02:12:11Z
- **Completed:** 2026-05-05T02:18:20Z
- **Tasks:** 2
- **Files created:** 2
- **Lines added:** 469 (108 period.ts + 361 inicio.ts)

## Accomplishments

- **Period math centralized** — `computePriorPeriod` and `pctChange` are the two reusable primitives every Phase 4 KPI delta will consume. Plan 04-03 (Recargas) and Plan 04-05 (KPICardsInicio) import directly from `period.ts`.
- **Inicio cross-cutting aggregations shipped** — `filterCompletedIn` is the default filter contract for Inicio (different from Bonos: NO tipo filter; aggregates ALL completed inflows). `summarizeInicio` returns the 5 headline KPIs (gmv, comision, takeRate, empresasActivas, bonosVendidos) in a single-pass reduce, empty-input safe, zero-divisor safe.
- **Trend-chart primitives ready** — `aggregateGMVByDate` / `aggregateGMVByWeek` and `aggregateActiveEmpresasByDate` / `aggregateActiveEmpresasByWeek` cover both granularities of the Inicio trend charts. Active-empresa variants close Pitfall 11 (Set-per-bucket dedup: 1 empresa with N tx in one bucket counts as 1, not N).
- **All 7 must_have truths verified** — see `<verification>` results below.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create period.ts with computePriorPeriod + pctChange** — `28d709c` (feat) — see "Issues Encountered" below: my commit message landed on a commit that captured an unrelated file. The actual `period.ts` deliverable was committed by a parallel agent in `76052a1` (`feat(04-04): add data-empresa-filter attribute to PresenterFrame`) which co-shipped period.ts. Content of `period.ts` in HEAD is byte-identical to what I wrote to disk.
2. **Task 2: Create inicio.ts with filter + summary + 4 chart aggregations** — `4d7c9ee` (feat)

## Files Created/Modified

- `src/lib/domain/period.ts` (108 lines) — `computePriorPeriod(filters) → {from, to} | null` and `pctChange(current, prior) → number | null`. Imports: `differenceInCalendarDays`, `subDays` from `date-fns`; `formatInTimeZone` from `date-fns-tz`; type-only `DashboardFilters` from `@/lib/url-state`. NO `lib/format` import (foundational module).
- `src/lib/domain/inicio.ts` (361 lines) — `filterCompletedIn`, `summarizeInicio`, `aggregateGMVByDate`, `aggregateGMVByWeek`, `aggregateActiveEmpresasByDate`, `aggregateActiveEmpresasByWeek`, plus 4 types (`InicioSummary`, `InicioDeltaSummary`, `GMVPoint`, `ActiveEmpresaPoint`). Imports: `formatInTimeZone` from `date-fns-tz`; type-only `Transaction`, `TransactionType` from `./types`; type-only `DashboardFilters` from `@/lib/url-state`. NO `next/react/server-only/lib/sheets/lib/format` imports.

## Verification Results

All 7 must_have truths from the plan frontmatter verified live via `tsx` + `npm run build`:

| # | Claim | Verification | Result |
|---|-------|-------------|--------|
| 1 | `computePriorPeriod` returns same-length prior window in Bogotá (April 2026 → March 2-31, NOT March 1-31) | `computePriorPeriod({from:'2026-04-01',to:'2026-04-30'})` | `{from:'2026-03-02',to:'2026-03-31'}` ✓ |
| 2 | `computePriorPeriod` returns null on missing/malformed from/to | `computePriorPeriod({})` | `null` ✓ |
| 3 | `pctChange` zero-safe (prior=0 → null) | `pctChange(100, 0)` | `null` ✓ — `pctChange(120,100)`=0.2, `pctChange(0,100)`=-1, `pctChange(100,NaN)`=null |
| 4 | `summarizeInicio` returns 5 KPIs over `Transaction[]` | `summarizeInicio([])` | `{gmv:0,comision:0,takeRate:0,empresasActivas:0,bonosVendidos:0}` ✓ — sample 3-tx fixture: gmv=175k, comision=8.75k, takeRate=0.05, empresasActivas=2, bonosVendidos=2 ✓ |
| 5 | `aggregateGMVByDate/Week` return `{bucket,value}` | Sample fixture 2026-04-29 | weekly bucket = `2026-W18` ✓; daily sorted asc `[{04-27,150k},{04-29,200k}]` ✓ |
| 6 | `aggregateActiveEmpresasByDate/Week` dedupe via Set (Pitfall 11) | 3 tx empresa A on Apr 15 + 2 tx empresa B on Apr 16 | `[{04-15,count:1},{04-16,count:1}]` ✓ (NOT count:3 / count:2) |
| 7 | Both modules PURE — no next/react/server-only/lib/sheets imports | `grep -rE '("next/\|"react"\|"server-only"\|@/lib/sheets/)' src/lib/domain/period.ts src/lib/domain/inicio.ts` | empty (PURE) ✓ |

Additional verification gates:

- `npx tsc --noEmit`: zero errors ✓
- `npm run build` (Next 16.2.4 Turbopack): `✓ Compiled successfully in 8.7s`, TypeScript 7.2s, all routes generated ✓
- Single Intl gate preserved: `grep -E "Intl\.|toLocaleString" src/lib/domain/period.ts src/lib/domain/inicio.ts` empty ✓
- Line counts: period.ts 108 (≥60 required), inicio.ts 361 (≥180 required) ✓
- Export count inicio.ts: 10 (4 types + 6 functions; ≥9 required) ✓

## Decisions Made

- **`computePriorPeriod` semantics: same-length prior, not prior calendar period.** April 2026 (30 days) → March 2-31 (30 days, NOT March 1-31). Length is the unit of comparison; the user's CONTEXT.md vision spelled this out and the fixture verifies it.
- **`pctChange` returns null (not NaN/Infinity) on zero divisor.** Three null cases collapse to one return site: `prior === 0`, `prior` non-finite, `current` non-finite. Caller renders em-dash via `formatPercent(null) → '—'`.
- **Inicio default filter contract is broader than Bonos** — NO `tipo === 'BONUS'` filter. GMV is total volume across all completed inflows (BONUS, PAYIN_*, P2P, etc.); the `bonosVendidos` KPI is computed inside `summarizeInicio` over the full set.
- **Week bucket uses `RRRR-'W'II`, not `yyyy-'W'II`.** ISO week-numbering year aligns with ISO week-of-year; calendar year does not. Year-boundary days (e.g. Dec 30/31 in some years) belong to ISO week W01 of the next year, and `RRRR` correctly buckets them.
- **`period.ts` is decoupled from `@/lib/format`** — it's a more foundational module than format.ts, so it inlines the literal Bogotá `T00:00:00-05:00` offset (mirror of `bonos.ts:53-62`) and imports `formatInTimeZone` from `date-fns-tz` directly to format the prior-period dates as YYYY-MM-DD. No circular dep risk.
- **`inicio.ts` also imports `formatInTimeZone` directly** (not via `toBogotaISODate` from `@/lib/format`) — same convention as `recargas.ts` per Plan 04-03's STATE entry. This keeps domain modules independent of the project's Intl gate while preserving the gate's purpose (no `Intl.NumberFormat`/`toLocaleString` outside format.ts; `formatInTimeZone` does NOT use Intl, it's a pure date-fns function).
- **Inline date helpers verbatim from `bonos.ts`** — fourth module (after bonos/payouts/recargas) to inline `startOfDayBogotaTimestamp`/`endOfDayBogotaTimestamp` rather than DRY-ing across modules. The shared util would require all four to import a fifth file; ~22 inline lines is the cheaper choice. This convention is now firmly established for the project's domain layer.

## Deviations from Plan

The plan execution itself produced **zero technical deviations** — both files were written exactly per the plan's `<action>` blocks, all `<verify>` fixtures matched expected values to the digit, all gates green on first try.

However, **one operational deviation** occurred outside the plan's authoring intent (documented for transparency, not a correctness issue):

### Concurrency Conflict with Parallel Agent

**1. [Operational] Parallel agent shipped period.ts independently before my commit landed**

- **Found during:** Task 1 commit step
- **Issue:** A separate Claude session (also operating on this repository in `--teammate-mode tmux`) was concurrently executing Phase 4 plans 04-02, 04-03, and 04-04. The sibling shipped commits `76052a1` (Plan 04-04, which also created `period.ts` as part of its scope sharing), `51cd230` (Plan 04-03), `1c92940` (Plan 04-04), `25ef95a` (Plan 04-03), `3a502a3` (Plan 04-02), `e291e0e` (Plan 04-04 metadata) — all between when I started and when I finished.
- **Concrete impact:** Between my `git status` (which showed `?? src/lib/domain/inicio-hechos.ts` as untracked, presumably from the sibling's in-progress 04-02 work) and my `git add src/lib/domain/period.ts && git commit`, the sibling's `76052a1` landed first and added `period.ts` to HEAD. My subsequent `git add` of `period.ts` was a no-op (working-tree content matched HEAD byte-for-byte — both versions of `period.ts` are identical). The commit then captured `inicio-hechos.ts` (which had been newly tracked by an intermediate sibling commit) under MY commit message, producing commit `28d709c` with my Task-1 message but only `inicio-hechos.ts` in its diff.
- **Why no rollback:** The plan's deliverable (`period.ts` exists in HEAD with the correct exports + JSDoc + purity invariants) IS satisfied — content is byte-identical to what I would have committed. Rewriting the misfiled commit would require destructive `git reset --hard` against shared history (the sibling's commits depend on it). Per the safety protocol, destructive ops require explicit user approval; here the file content is correct so a forensic note is sufficient.
- **Verification:** `diff <(git show HEAD:src/lib/domain/period.ts) src/lib/domain/period.ts` returns no diff (IDENTICAL). `git show 28d709c --name-status` shows `A src/lib/domain/inicio-hechos.ts` (the misfile). The actual `period.ts` introduction is at `76052a1` (`A src/lib/domain/period.ts`).
- **No correctness impact:** All 7 must_have truths are satisfied by the code in HEAD. Both build and tsc pass. Task 2 (`inicio.ts`) was committed cleanly afterwards (`4d7c9ee`).

---

**Total deviations:** 1 operational (concurrency conflict, no correctness impact)
**Impact on plan:** None on deliverables — both `period.ts` and `inicio.ts` exist in HEAD with the exact content the plan required, all verification gates pass. The git log is slightly noisier than ideal (one commit message references content that landed in a sibling's commit), but no rework is needed.

## Issues Encountered

- **Concurrent agent conflict (described above)** — multiple Claude `--teammate-mode tmux` sessions running on the same repo concurrently. Forward guidance: future plan execution should add a top-of-execution `git fetch && git status` race-detection step, OR the orchestrator should serialize plan execution (orchestrator already does this within a single conductor; cross-conductor parallelism is the gap). For this plan I worked around it by treating the sibling's `period.ts` as already-satisfying-the-deliverable rather than fighting for write priority.

## User Setup Required

None — no external service configuration introduced.

## Next Phase Readiness

**Ready for downstream plans:**

- **Plan 04-02 (inicio-hechos.ts)** can import `filterCompletedIn` from `@/lib/domain/inicio` to scope its hecho-curado computations to the active filter window. Note: per `git log`, sibling agent has already shipped 04-02 (commit `3a502a3`), which means it likely couldn't have used `filterCompletedIn` (which only lands in this commit `4d7c9ee`). Verify whether 04-02's `findEmpresasNuevasActivadas` reaches into `Transaction[]` directly or whether it expects pre-filtered input — if direct, post-04-01 cleanup may want to refactor 04-02 to use the new helper.
- **Plan 04-03 (recargas.ts)** is shipped (sibling commit `51cd230`/`25ef95a`); cross-check that it does NOT duplicate `period.ts` exports or re-implement `pctChange`. If it does, Plan 04-08 page composition is the natural cleanup point (delete duplicates, import from `@/lib/domain/period`).
- **Plan 04-05 (KPICardsInicio component)** can consume `InicioDeltaSummary` directly: `summarizeInicio(filterCompletedIn(tx, filters))` for current, plus `summarizeInicio(filterCompletedIn(tx, {...filters, ...priorPeriod}))` for prior, then render each KPI as `{value, pctChange(current.x, prior?.x ?? 0)}`.
- **Plan 04-07 (inicio page composition)** wires `filterCompletedIn` + `summarizeInicio` + 4 chart aggregations + `computePriorPeriod` for prior-period data. Pattern reusable from `bonos/page.tsx` and `payouts/page.tsx` (Phase 2-04 / Phase 3-04 reference shapes).

**No blockers introduced by this plan.**

**Concern for Phase 4 cleanup pass:**

- The concurrent-agent activity has scattered Phase 4 commits in unusual order (04-04 before 04-01, 04-03 before 04-02 metadata). Phase 4's eventual phase-completion docs commit should reconcile the ordering narrative. Suggested cleanup: a phase-end `docs(04): reconcile execution narrative` commit that documents the as-shipped order vs the planned order, so Phase 5 readers don't get confused tracing dependencies.

---
*Phase: 04-inicio-recargas*
*Completed: 2026-05-05*
