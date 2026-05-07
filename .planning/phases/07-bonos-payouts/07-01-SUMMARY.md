---
phase: 07-bonos-payouts
plan: 01
subsystem: domain
tags: [bonos, transactions, aggregations, ranking, source-transfer-tikintag, destination-transfer-tikintag, zod, schema]

requires:
  - phase: 02-bonos
    provides: Transaction interface, TransactionRowSchema, BD_Plataforma adapter, v1 bonos aggregations (filterBonos / summarizeBonos / aggregateBonosByDate / aggregateBonosByEmpresa / top10Empresas), BONO_TRANSACTION_TYPES, Bogotá-anchored date helpers
  - phase: 06-foundation-v2
    provides: DashboardFilters.status CSV multi-select (CROSS-V2-01), URL filter contract Plan 06-03 (filters.status array), parsers.ts public API, joinPayouts canonical helper (informational — not consumed by this plan)
provides:
  - Transaction.sourceTransferTikintag (optional string) — sender's tikintag from BD_Plataforma source_transfer_tikintag
  - Transaction.destinationTransferTikintag (optional string) — receiver's tikintag from BD_Plataforma destination_transfer_tikintag
  - filterBonosV2(transactions, filters) — broader v2 filter (both directions, status CSV honored, completed default)
  - summarizeBonosV2(bonos) → BonoSummaryV2 (split countIn/countOut/montoIn/montoOut + combined ticketPromedio)
  - aggregateBonosByDateV2(bonos) → BonoByDateV2[] (stacked-bar timeline with both directions per Bogotá day)
  - aggregateTopEmisores(bonos, n=10) → BonoTikintagRow[] (rank by sourceTransferTikintag, BON-V2-05)
  - aggregateTopReceptores(bonos, n=10) → BonoTikintagRow[] (rank by destinationTransferTikintag, BON-V2-06)
  - 3 new exported types: BonoSummaryV2, BonoByDateV2, BonoTikintagRow
affects:
  - 07-02 (Bonos page rebuild — directly consumes all 5 v2 functions and 3 v2 types)
  - 09-vista-cliente (CLI-V2-* may reuse aggregateTopEmisores/Receptores filtered by empresa)
  - 10-inicio-infra (Inicio cross-cuts may sum BonoSummaryV2 across sections)

tech-stack:
  added: []
  patterns:
    - "v1/v2 coexistence: v2 helpers added ALONGSIDE v1 in the same domain file, no v1 edits — live page builds green between waves while page composition swap is staged"
    - "Selector-parameterized aggregation: shared internal aggregateByTikintag(bonos, selector, n) reused by aggregateTopEmisores and aggregateTopReceptores (DRY ranking math, single sort/slice path)"
    - "Pure-add schema enrichment: TransactionRowSchema fields source_transfer_tikintag / destination_transfer_tikintag were already declared as OptionalString — only the .transform() write paths are new (no parsed-row Zod shape change)"

key-files:
  created: []
  modified:
    - src/lib/domain/types.ts (Transaction interface +2 optional fields, +24 lines)
    - src/lib/domain/schemas.ts (TransactionRowSchema.transform +2 propagation lines)
    - src/lib/domain/bonos.ts (+217 lines: 3 types + 5 exported functions + 1 internal helper, v1 untouched)

key-decisions:
  - "v2 filter does NOT pre-filter direction (v1 collapsed to direction=in) — both BONUS-in and BONUS-out flow through filterBonosV2; downstream consumers (summarizeBonosV2, top emisores ranks out, top receptores ranks in) split the population by direction at aggregation time. Reason: a single filtered Transaction[] can power KPIs + both rankings + the stacked timeline without re-filtering"
  - "filters.status CSV honored verbatim when present; default 'completed' when absent or empty — matches v1 default semantics (rejected/in_progress bonos never carried money) AND honors the CROSS-V2-01 URL contract from Plan 06-03 simultaneously"
  - "filters.tipo INTENTIONALLY ignored by filterBonosV2 — the Bonos tab is BONUS-by-definition; the global tipo multi-select drives Inicio/Vista Cliente cross-cuts, not this tab. (Per Plan 06-03 SUMMARY: each Phase 7+ section decides which filters to honor in its own data layer.)"
  - "OTRO_DIRECTION rows excluded from BOTH in/out buckets in summarizeBonosV2 and aggregateBonosByDateV2 — defensive fallback rows surface as a count discrepancy that future telemetry can flag rather than silently inflate either side"
  - "Empty/undefined tikintag selectors EXCLUDED from rankings — a peer-less bono cannot be attributed to a sender or receiver, so it's filtered out of aggregateTopEmisores / aggregateTopReceptores rather than bucketed under a sentinel label. Distinct from the 'Sin razón' bucket convention Plan 07-03 uses for failureReason — there the sentinel is informative (failures with no reason); here the row is uninterpretable for ranking"
  - "Default n=10 for ranking helpers — matches v1 top10Empresas convention; Plan 07-02 may pass smaller n for cockpit-density variants (per 07-CONTEXT.md essential 'densidad informativa')"
  - "v1 functions kept byte-identical — Plan 07-02 (Wave 2) will swap imports + prune v1 in one cohesive diff that rewrites src/app/(protected)/bonos/page.tsx; this preserves /bonos build-green guarantee between Wave 1 and Wave 2"

patterns-established:
  - "Schema field propagation pattern: when a Zod field is already declared in TransactionRowSchema (.object) but NOT written in the final .transform(), surfacing it onto Transaction is a 2-edit surgical add — types.ts (interface field + JSDoc) + schemas.ts (transform write line). No defaulting/normalization at the transform layer; downstream branches on undefined cleanly"
  - "v2-alongside-v1 coexistence pattern: append v2 exports below v1 in the same domain module; page composition swap (and v1 prune) happens in the wave-2 diff that rewrites the consuming page — ensures the live build never goes red between waves"

duration: 4m 2s
completed: 2026-05-07
---

# Phase 07 Plan 01: Bonos Domain v2 — Split Source/Destination Aggregations Summary

**Surfaced sourceTransferTikintag + destinationTransferTikintag on Transaction (2-edit surgical schema add) and shipped 5 v2 ranking-first aggregation helpers (filterBonosV2, summarizeBonosV2, aggregateBonosByDateV2, aggregateTopEmisores, aggregateTopReceptores) alongside untouched v1 — Plan 07-02 page rebuild can now compose top emisores + top receptores as protagonists without further domain work.**

## Performance

- **Duration:** 4m 2s
- **Started:** 2026-05-07T17:49:54Z
- **Completed:** 2026-05-07T17:53:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Transaction interface exposes both `sourceTransferTikintag?: string` and `destinationTransferTikintag?: string` with JSDoc citing BON-V2-05 / BON-V2-06 ranking semantics
- `TransactionRowSchema.transform` now writes both fields onto the produced Transaction (was discarding them despite parsing them — the two `OptionalString` declarations had been there all along)
- `bonos.ts` exports 5 v2 functions and 3 v2 types covering: split-direction filter, split header KPIs, stacked-bar timeline, and two rankings (emisores, receptores). All v1 functions remain present and byte-identical so `/bonos` page keeps building between Wave 1 and Wave 2
- All gates green: `tsc --noEmit` 0 errors, `npm run build` compiled successfully (12 routes generated, including `/bonos`), `npm run lint` 0 errors and only the 3 pre-existing warnings in unrelated v1 files (ClientesTable.tsx, rate-limit.ts, _utils.ts) plus 2 sibling-owned warnings on `payouts.ts` from Plan 07-03 working-tree state (not part of this plan's commit)

## Task Commits

Each task was committed atomically:

1. **Task 1: Surface source/destination tikintag on Transaction interface and schema** — `b3340e7` (feat)
2. **Task 2: Add v2 aggregation helpers to bonos.ts (alongside v1)** — `9a09f08` (feat)

**Plan metadata:** _pending — added in the closing commit_ (docs)

## Files Created/Modified
- `src/lib/domain/types.ts` — Transaction interface gains 2 optional fields (`sourceTransferTikintag`, `destinationTransferTikintag`) with full JSDoc explaining the BD_Plataforma source columns and the BON-V2-05/06 ranking rationale (+24 lines, pure add)
- `src/lib/domain/schemas.ts` — `TransactionRowSchema.transform` propagates `parsed.source_transfer_tikintag` and `parsed.destination_transfer_tikintag` onto the produced Transaction (+2 lines, no defaulting/normalization at this layer)
- `src/lib/domain/bonos.ts` — appended after `top10Empresas`: 3 v2 types (`BonoSummaryV2`, `BonoByDateV2`, `BonoTikintagRow`), `filterBonosV2`, `summarizeBonosV2`, `aggregateBonosByDateV2`, internal `aggregateByTikintag` helper, exported `aggregateTopEmisores`, exported `aggregateTopReceptores` (+217 lines; v1 block above untouched)

## Decisions Made
See `key-decisions` in frontmatter — the most consequential ones for downstream waves:

1. **`filterBonosV2` does NOT pre-filter direction** (v1 collapsed to `direction=in`). Plan 07-02 page composition splits the filtered population at aggregation time: top emisores ranks the `out` side, top receptores ranks the `in` side, the summary counts both. One filter pass → many aggregation paths.
2. **`filters.status` CSV honored verbatim, default `'completed'`** — single source of truth for the URL contract (CROSS-V2-01 / Plan 06-03) and the v1 default semantics in one Set lookup.
3. **`filters.tipo` ignored by `filterBonosV2`** — Bonos tab is BONUS-by-definition. Per Plan 06-03 SUMMARY, each section decides per-filter honoring; this is the Bonos call.
4. **OTRO_DIRECTION rows neutralized**, not bucketed — silent inflation of either side is worse than a count discrepancy that future telemetry can flag.
5. **Tikintag selectors with empty/undefined values EXCLUDED from rankings** — distinct from Plan 07-03's "Sin razón" bucket pattern; ranking exclusion is correct here because peer-less bonos cannot be attributed to a sender or receiver (uninterpretable for the ranking question), whereas a failure reason absence is itself an informative datum.

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with the literal-block fidelity the v1.0 closing streak demonstrated (per STATE.md "12-plan zero-deviation streak").

## Issues Encountered

**1. Parallel-wave git race with Plan 07-03 (Wave 1, sibling agent on `payouts.ts`)** — observed exactly as STATE.md warned ("Parallel-wave git race observed 3 times in v1.0").

- **Symptom after Task 2 verification:** `git status` showed `M src/lib/domain/payouts.ts` as an unstaged modification despite Plan 07-01 never touching that file. The sibling agent (07-03) had committed Task 1 (`2480a0a`) BUT also had Task 2 partial work in the shared working tree (uncommitted +99 lines adding `aggregateFailureReasons` and the `joinPayouts` import).
- **Lint surface:** 2 new warnings appeared in `payouts.ts` (`'joinPayouts' is defined but never used`, `'JoinedPayout' is defined but never used`) — these are sibling-owned, expected to disappear once 07-03 Task 2 commits the consumer (`aggregateThirdPartyPayouts`).
- **Recovery:** Per STATE.md guidance, used `git add -- src/lib/domain/bonos.ts` (explicit `--` pathspec) to stage ONLY Plan 07-01's file, leaving the sibling's pending `payouts.ts` work in the working tree untouched. Commit `9a09f08` contains exactly 1 file (bonos.ts +217 lines), zero overlap with the sibling. No `git stash` needed.
- **Verification:** Final `tsc --noEmit` and `npm run build` both green against the combined working-tree state — confirms my domain additions compile cleanly even with the sibling's pending payouts.ts (which itself type-checks because the unused-but-declared imports are types/values, not errors). Build emitted all 12 routes including `/bonos` and `/payouts` successfully.

**2. `npx`/`npm`/`node` not on `$PATH` in the shell context** — pre-existing v1.0 blocker carried into v2.0 (STATE.md "Vercel CLI fuera de PATH" — same root cause: nvm-shimmed Node, non-login shell). Resolution: `export PATH="$HOME/.nvm/versions/node/v24.11.0/bin:$PATH"` prefixed on every gate-check command. Not a deviation; documented infra reality.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plan 07-02 (Wave 2 — Bonos page rebuild):**
- All 5 v2 functions (`filterBonosV2`, `summarizeBonosV2`, `aggregateBonosByDateV2`, `aggregateTopEmisores`, `aggregateTopReceptores`) importable from `@/lib/domain/bonos`
- All 3 v2 types (`BonoSummaryV2`, `BonoByDateV2`, `BonoTikintagRow`) exported alongside the functions
- `Transaction.sourceTransferTikintag` and `Transaction.destinationTransferTikintag` typed `string | undefined` — page composition can safely branch on `=== undefined` without a defensive normalize step
- v1 `filterBonos` / `summarizeBonos` / `aggregateBonosByDate` / `aggregateBonosByEmpresa` / `top10Empresas` still exported and consumed by the live `/bonos` page — Plan 07-02 will swap imports + prune v1 in one cohesive diff so `/bonos` never builds red mid-wave
- `filters.status` URL honoring works against the live URL contract from Plan 06-03 (verified by code path: `filters.status && filters.status.length > 0 ? new Set(filters.status) : new Set(['completed'])` — direct delegation to the parsed CSV array)

**No new blockers.** No production data sanity check was performed (the plan listed it as "if convenient — not required"); coverage of `sourceTransferTikintag` / `destinationTransferTikintag` populated values in BD_Plataforma can be observed live via `/api/diagnose` if Plan 07-02 wants to validate non-zero ranking rows before shipping the page rebuild.

---
*Phase: 07-bonos-payouts*
*Completed: 2026-05-07*
