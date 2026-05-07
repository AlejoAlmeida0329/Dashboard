# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07 al iniciar milestone v2.0 Analytics)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 7 — Bonos + Payouts (rebuilt + extended) — Wave 2 in progress (07-04 Payouts complete; 07-02 Bonos finalizing in parallel)

## Current Position

Phase: 7 of 10 (Bonos + Payouts)
Plan: 07-04 complete (Payouts page v2 time-first cockpit + partial v1 prune); 07-02 page commits on master (`e6f9ab6` + `6c74f52`) finalizing in parallel
Status: In progress — Phase 7 Wave 2 nearly complete, 07-02 sibling finalize race tolerated
Last activity: 2026-05-07 — Completed 07-04-PLAN.md (Payouts page v2 — TIME-FIRST cockpit + first production consumer of joinPayouts() + partial v1 prune deferring 4 symbols still consumed by Inicio + Clientes pages)

Progress: v1.0 ✅ SHIPPED (Phases 1-5) · v2.0 🚧 1/5 phases shipped + Phase 7 3/4 plans · Phase 7: 3/4 plans ███░ (75%)

## Performance Metrics

**Velocity (v1.0 baseline):**
- Total plans completed in v1.0: 24 (1 deferred — INFRA-04 carry-forward)
- Total commits: 88 commits in 10 días
- Total LOC produced: ~9150 TypeScript LOC en 76 archivos
- Total execution time: 2026-04-27 → 2026-05-06 (10 días calendario)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | TBD | ✅ |
| 2. Bonos | TBD | ✅ |
| 3. Payouts | TBD | ✅ |
| 4. Inicio + Recargas | TBD | ✅ |
| 5. Clientes + Domain | TBD | ✅ (1 plan deferred) |

**Recent Trend:**
- Last 5 plans (v1.0 closing): 12-plan zero-deviation streak (plan-spec literal-block fidelity demonstrated)
- Trend: improving — domain libraries + UI leaves + page composition demonstrated deterministic parity in late v1.0

*Updated after each plan completion in v2.0*

## Accumulated Context

### Decisions (recent, affecting current work)

Decisions están loggeadas en PROJECT.md Key Decisions table. Recent ones que afectan Phase 6 (Foundation v2):

- **JOIN canónico = `transaction_id` (técnico) / `reference` (semántico via PRD)** — código usa `transaction_id`, JSDoc cita PRD por convención. Verificación histórica 773/798 (96.9%) match; live re-verificación Plan 06-02 = 768/797 (96.36%, satisface ≥96%). CROSS-V2-04. **Helper canónico `joinPayouts()` en `src/lib/domain/join.ts` (Plan 06-02)** — `joinIndex` + `joinMatchStats` + tipo `JoinedPayout` exportados. Migración del inline-join de `payouts/page.tsx` deferida a Phase 7+.
- **Modo Presentación + cliente-foco share-URL preservados en v2.0** — PRD declara dual-purpose explícito en Vista Cliente; visibility por métrica refinada en CLI-V2-* requirements y CROSS-V2-07.
- **Reutilizar componentes/diseño/auth de v1.0** donde apliquen — design system aprobado; refactorizar solo data + nuevas vistas.
- **6 secciones (no 5)** — Recargas vuelve en v2 con scope expandido (PSE + Transfer); Uso Tarjeta es una sección distinta para PURCHASE.
- **`parseCOPAmount` returns `number | null`** (Plan 06-01) — null = explicit "no value" signal; v2.0 callers branch on `=== null` to distinguish missing vs zero. Zod schemas wrap and translate null → `addIssue + z.NEVER`.
- **`parsers.ts` public API in MINUTES, `schemas.ts` internal path in SECONDS** (Plan 06-01) — `parseAging`/`parseTotalTime` return minutes (PRD v2 expectation); `parsePgIntervalSeconds` kept exported and used by `schemas.ts` for `Payout.latencySeconds` backward-compat (Phase 3 percentiles).
- **CSV multi-select URL serialization** (Plan 06-03) — `?status=completed,failed&tipo=BONUS,P2P` chosen over repeated keys. Empty array → param omitted (parity with absent key). Stable URL ordering: from → to → empresa → status → tipo → presenter.
- **Filter option lists hardcoded in components** (Plan 06-03) — `StatusFilter` + `TypeFilter` declare their own `value/label` arrays; NOT auto-derived from `TransactionType` union. UI labels (e.g. "Compra (tarjeta)") are UI concerns; defensive fallbacks (UKNOWN, OTRO) excluded from filter options. Schema additions don't auto-pollute the dropdown.
- **Phase 6 ships filter UI + URL contract only** (Plan 06-03) — domain functions (`filterBonos`, `filterPayouts`, etc.) NOT touched. Each Phase 7+ section decides which filters to honor in its data layer.
- **Diagnostic-route lifecycle pattern reaffirmed** (Plan 06-02) — temp `/api/diagnose-*` routes for live verification get created, exercised via temporary proxy.ts PUBLIC_PATHS extension, then deleted (route) + reverted (proxy) BEFORE the task commit. Source never lands in git history. Mirrors Plans 02-01 and 03-01.
- **next-themes wired with `attribute="class"` + `defaultTheme="system"`** (Plan 06-04) — aligns with the existing `@custom-variant dark (&:is(.dark *))` selector in `globals.css` (zero v1.0 dark CSS rewritten). First visit respects OS preference; user override persists in localStorage. `<html suppressHydrationWarning>` required because next-themes flips `.dark` before React hydrates. ThemeToggle stays VISIBLE in presenter mode (operator control during meetings).
- **v2.0 paleta = OKLCH, lifted +0.10 lightness for dark** (Plan 06-04) — 6 section vars (`--section-{inicio|bonos|payouts|tarjeta|clientes|recargas}`) + 3 status vars (`--status-{success|fail|pending}`) declared in `:root`, mirrored brighter in `.dark`. Exposed to Tailwind via `@theme inline { --color-section-*: var(--section-*) }` so `text-section-bonos`, `bg-status-success`, etc. resolve as utilities. Status palette intentionally aliases section hues (verde ≡ emerald, amarillo ≡ amber) — single semantic source per hue family.
- **Conservative-default per-metric visibility** (Plan 06-04, CROSS-V2-07) — `[data-presenter="on"] [data-presenter-metric-hide] { display: none !important }`. Default policy: ALL metrics visible in presenter; opt-out by tagging individual elements. Distinct from chrome `data-presenter-hide` and cliente-foco `data-presenter-empresa-hide`. Phase 9 (Vista Cliente CLI-V2-08) tags the cronological timeline.
- **React 19 `react-hooks/set-state-in-effect` requires per-call eslint-disable for next-themes mount gate** (Plan 06-04 deviation) — canonical `useEffect → setMounted(true)` pattern collides with the React 19 lint rule. Resolution: keep the documented next-themes pattern + focused single-line `eslint-disable-next-line` + JSDoc explaining the why. Future plans adopting "subscribe → setState" patterns may need similar exceptions; if more than 2-3 cases appear, consider project-level config exception.
- **v2-alongside-v1 coexistence pattern in domain modules** (Plan 07-01) — when a Wave-1 plan extends a domain library that's still consumed by a live page, append v2 exports BELOW v1 in the same file and keep v1 byte-identical. The Wave-2 plan that rewrites the consuming page does the import swap + v1 prune in ONE cohesive diff. Result: the live build never goes red mid-wave. Applied to `bonos.ts` (5 v2 functions added; v1 untouched until Plan 07-02 swaps `/bonos/page.tsx`).
- **`Transaction.sourceTransferTikintag` / `destinationTransferTikintag` first-class fields** (Plan 07-01) — surfaced from BD_Plataforma `source_transfer_tikintag` / `destination_transfer_tikintag` columns that the schema parsed but discarded since Phase 2. Pure-add to the `Transaction` interface (typed `string | undefined`); 2-edit surgical schema add (types.ts JSDoc + schemas.ts transform write). v1 callers unaffected (undefined-by-default). v2 Bonos rankings (BON-V2-05/06) read these directly: top emisores ranks by `sourceTransferTikintag`, top receptores by `destinationTransferTikintag`, irrespective of `direction`.
- **v2 Bonos filter does NOT pre-filter `direction`** (Plan 07-01) — v1 `filterBonos` collapsed to `direction=in`; `filterBonosV2` lets BOTH directions through and downstream aggregations (`summarizeBonosV2` splits in/out, `aggregateTopEmisores` ranks the sender column, `aggregateTopReceptores` ranks the receiver column) partition at aggregation time. One filter pass → many aggregation paths. `filters.tipo` INTENTIONALLY ignored by `filterBonosV2` (Bonos tab is BONUS-by-definition); `filters.status` CSV honored verbatim with default `['completed']` when absent or empty.
- **Parallel-wave git race RECONFIRMED in v2.0** (Plan 07-01 Wave 1, sibling 07-03 racing on `payouts.ts`) — sibling agent's uncommitted Task-2 working-tree changes appeared in my `git status` as `M src/lib/domain/payouts.ts` despite Plan 07-01 never touching that file. Recovery: explicit pathspec stage (`git add -- src/lib/domain/bonos.ts`) — leaves sibling's pending file untouched, commit contains exactly the plan's intended diff. Confirms STATE.md's prior guidance pattern (also used in v1.0). Lint may transiently report new warnings in sibling-owned files (e.g. unused imports awaiting the sibling's consumer commit) — these are NOT plan-owned and disappear once the sibling's Task 2 lands.
- **`JoinedPayout[]` as aggregation function input** (Plan 07-03) — `aggregateThirdPartyPayouts(joined: JoinedPayout[])` accepts the joined shape directly, NOT `(transactions, payouts)`. Page composition runs `joinPayouts()` ONCE per request and chains the result into multiple downstream aggregations (this plan: third-party detection; future plans: any cross-source enrichment). One JOIN per request budget contract. Composability: downstream consumers all read the same `Payout & { transaction?: Transaction }` shape. First production consumer of Plan 06-02's canonical helper.
- **Type-only import fallback for v2 aggregation modules** (Plan 07-03) — when a domain aggregation file needs only the SHAPE of `JoinedPayout` (page composition layer owns the runtime `joinPayouts` call), use `import type { JoinedPayout } from "./join";` instead of value-import. Plan 07-03 attempted value-import first (per plan), got `no-unused-vars`, fell back to type-only — this branch is the canonical resolution for any v2 aggregation that consumes the joined shape without invoking the JOIN.
- **`$`-prefix-stripped tikintag normalization in third-party comparison** (Plan 07-03 PAY-V2-08) — `aggregateThirdPartyPayouts` lowercases + trims both sides; when `tikintag` starts with `$` (the on-Sheet convention per Plan 02-01 SUMMARY), strips the leading `$` before comparison. Catches the rare `$mario ↔ "mario"` first-party case that would otherwise misclassify a self-payout as third-party. Unmatched payouts (~3.1% historic per Plan 06-02) SKIPPED, not counted either way.
- **Defensive completed-only inside time aggregations** (Plan 07-03) — `aggregateAverageProcessingMinutes` and `aggregateFailureReasons` self-filter to the relevant state inside the function, even though callers typically pre-filter. Prevents Aging-fallback contamination of a completed-mean (the silent semantic drift v1 03-CONTEXT.md essentials warned about). `latencySeconds` carries `Total Time` for completed rows and `Aging` for non-completed; these aggregations refuse to mix the two.
- **`summarizePayoutsByState.total` uses `payouts.length`** (Plan 07-03) — not `completed + failed + inProgress`. If upstream Sheet ever introduces a 4th state (e.g. `cancelled`, `pending_review`), `successRate` denominator stays correct (numerator = completed, denominator = total-attempted including the unrecognized state); the 3 named counters quietly underrepresent until the schema is updated. Defensive-by-default.
- **Wave-1 v2-suffix coexistence convention** (Plans 07-01 + 07-03 in parallel) — both wave-1 plans independently chose `<fn>V2` suffix for their parallel additions (`filterBonosV2`, `summarizeBonosV2`, `filterPayoutsV2`, `summarizePayoutsByState`). Convention emerged organically without explicit cross-plan coordination — Plans 07-02 + 07-04 (Wave 2) will swap imports and prune v1 fns in a single cohesive diff each.
- **Partial v1 payouts prune — 4 symbols KEPT alive deferred to Phase 9 + Phase 10** (Plan 07-04 deviation, Rule 4 architectural / scope). Plan 07-04 was supposed to delete the full v1 set per Plan 07-03's pruning list, but a `grep -rE` audit of `src/` BEFORE deletion surfaced 4 symbols still consumed outside `/payouts/page.tsx`: **`filterPayouts`** (used by `inicio/page.tsx` Latencia destacada hecho + `clientes/[empresaId]/page.tsx` mini cards), **`summarizePayouts`** (same two consumers), **`PayoutSummary`** interface (used by `HechosCurados.tsx` + `EmpresaMiniCards.tsx` as prop type), and **`COMPLETED_PAYOUT_STATES`** constant (still consumed internally by the kept-alive `filterPayouts`). Plan 07-03 SUMMARY's pruning list assumed `/payouts/page.tsx` was the sole consumer — incorrect. Plan 07-04's verify section explicitly anticipates this gate ("STOP and surface — that file needs a swap before the prune can land") and the output spec sanctions a flag-for-future-cleanup branch. **DELETED in Plan 07-04** (only consumed by the rewritten page + deleted v1 leaves): `filterPayoutsByPeriodOnly`, `aggregateLatencyHistogram`, `LatencyBucket`, `LatencyBucketLabel`, `HISTOGRAM_BUCKET_ORDER`, `aggregateSuccessRate`, `SuccessRate`. **Migration path:** Phase 10 (Inicio v2 rewrite) replaces `filterPayouts + summarizePayouts` for the Latencia destacada hecho with v2 helpers (`summarizePayoutsByState` + `aggregateAverageProcessingMinutes`); Phase 9 (Vista Cliente v2 rewrite of `clientes/[empresaId]/page.tsx`) does the same for empresa mini-cards. After BOTH phases land, the 4 kept-alive symbols become orphans — final prune lands as a 1-task cleanup in whichever phase touches `payouts.ts` last. **No behavior change to Inicio or Clientes pages today** — they keep building and rendering identically against the kept-alive surface.
- **Time-first cockpit layout pattern established** (Plan 07-04 PAY-V2-01..08) — PRIMARY KPI text-4xl with section accent (`text-section-payouts`); semáforo-bound color on the second protagonist via threshold helper (`successRateAccent`: ≥95% verde, ≥85% amber, else rojo); conditional null-render alert between protagonists and quality semáforo (AgingAlert returns `null` when `rows.length === 0` — health = absence of card, not a positive placeholder); diagnostic layer at bottom in `lg:grid-cols-2`. Reusable shape for any future operational/quality dashboards (Phase 9 Vista Cliente expected to inherit). Conditional null-render pattern reusable for any future alert/queue widget.
- **JoinedPayout pipeline at page-composition** (Plan 07-04 first production wiring) — page composition runs `joinPayouts(transactions, completed)` ONCE per request, then chains the result into `aggregateThirdPartyPayouts`. Confirms the Plan 06-02 + Plan 07-03 design contract (one-JOIN-per-request budget). React `cache()` dedupes the BD_Plataforma fetch with DashboardHeader's empresa-registry call, so the always-on JOIN doesn't double-pay quota. Phase 9 Vista Cliente will reuse the same pipeline shape (run JOIN once, chain into multiple aggregations for empresa enrichment + tikintag-based metrics).
- **`PayoutState` type lives in `types.ts`, not re-exported from `payouts.ts`** (Plan 07-04 import-fix) — `ThirdPartyPayouts.tsx` initially imported `PayoutState` from `@/lib/domain/payouts` (where the plan implicitly suggested), tsc surfaced `TS2459: declares locally but not exported`. Resolution: `import type { PayoutState } from "@/lib/domain/types";`. Future v2 components rendering payout state badges should import directly from `types.ts`. (Note: Phase 9+ may consider whether to re-export `PayoutState` from `payouts.ts` for ergonomics — for now, direct-from-types-ts is the canonical path.)

### Pending Todos

Ninguno aún para v2.0. Carry-forwards de v1.0 deferreds NO se trasladan (decisión 2026-05-07 — quedan en `milestones/v1.0-REQUIREMENTS.md` para referencia histórica; surgen caso por caso vía `/gsd:add-todo`).

### Blockers/Concerns (carry-forward al milestone v2.0)

- **Sheet header H corregido por usuario 2026-05-07** — verificación end-to-end pendiente (no recargó browser después de "Ya"). Riesgo: cualquier edición upstream rompe el adapter; schema validation captura el error pero requiere intervención manual.
- **INFRA-04 (custom domain) deferido desde v1.0** — Plan 05-05 pospuesto. Decisión pendiente upfront: subdomain / apex / defer definitivo. Cliente-flow LIVE en `.vercel.app` con SSO de Vercel.
- **Vercel Deployment Protection ENABLED por defecto** — la URL `.vercel.app` requiere SSO. Mitigación: custom domain (INFRA-04) bypassa el SSO.
- **3 deudas de seguridad de v1.0** documentadas en `01-04-SUMMARY.md`: GCP key NO rotada, password 5-char, env vars solo Production target.
- **Vercel CLI fuera de PATH** — pre-condición: `export PATH="$HOME/.nvm/versions/node/v24.11.0/bin:$PATH"` para deploy tasks.
- **Parallel-wave git race** observado 3 veces en v1.0 — recovery: `git stash --include-untracked` o `git commit -- <pathspec>`.
- **dotenv-expand bug** — bcrypt hashes con salt empezando en letra/dígito se corrompen al ser leídos por `@next/env`. Mitigación: escape `\$` en `.env.local`.

## Session Continuity

Last session: 2026-05-07 — Plan 07-04 (Wave 2 Payouts page rebuild) ejecutado y aprobado en visual checkpoint; Plan 07-02 (Wave 2 Bonos page rebuild) finalizando en paralelo (page commits `e6f9ab6` + `6c74f52` ya en master). **Phase 7: 3/4 plans (75%).**

**v2.0 actions tomadas hoy:**
- ✅ `/gsd:new-milestone` — milestone iniciado
- ✅ `/gsd:define-requirements` — 51 requirements en 8 categorías (REQUIREMENTS.md)
- ✅ `/gsd:create-roadmap` — 5 fases (6-10) con success criteria + research flags + traceability completo
- ✅ `/gsd:plan-phase 6` — Phase 6 plans creados (06-01 a 06-04)
- ✅ `/gsd:execute-plan 06-01` — `src/lib/domain/parsers.ts` creado; `schemas.ts` refactorizado a delegar; tsc + lint + build green
- ✅ `/gsd:execute-plan 06-03` (Wave 1) — `DashboardFilters.status`/`tipo` + `StatusFilter`/`TypeFilter` + header wired; tsc + lint + build green; zero deps añadidas
- ✅ `/gsd:execute-plan 06-02` (Wave 1) — `src/lib/domain/join.ts` (148 LOC) con `joinPayouts`/`joinIndex`/`joinMatchStats`/`JoinedPayout`; live match-rate 768/797 (96.36%, ≥96% threshold); tsc + lint + build green; zero deps añadidas
- ✅ `/gsd:execute-plan 06-04` (Wave 2) — next-themes ThemeProvider + ThemeToggle + 9 paleta CSS vars (light + dark) + `data-presenter-metric-hide` rule + header polish; tsc + lint + build green; zero deps añadidas; user-approved visual checkpoint

**Phase 7 Wave 1 actions (2026-05-07, parallel orchestration):**
- ✅ `/gsd:execute-plan 07-01` (Wave 1) — Bonos domain v2: `filterBonosV2` + `summarizeBonosV2` + `aggregateBonosByDateV2` + `aggregateTopEmisores` + `aggregateTopReceptores` + 3 v2 types (`BonoSummaryV2`, `BonoByDateV2`, `BonoTikintagRow`) + `Transaction.sourceTransferTikintag` / `destinationTransferTikintag` (pure-add 2-edit schema); v1 byte-identical; tsc + lint (0 errors) + build green; parallel-wave git race con sibling 07-03 manejado vía explicit `--` pathspec
- ✅ `/gsd:execute-plan 07-03` (Wave 1) — Payouts domain v2: `filterPayoutsV2` + `summarizePayoutsByState` + `aggregateAverageProcessingMinutes` + `aggregateAgingAlertPending` + `aggregateFailureReasons` + `aggregateThirdPartyPayouts` (first production consumer of Plan 06-02 `joinPayouts()`); 4 new types; v1 byte-identical; tsc + lint + build green; zero deps; no parallel-wave git race despite shared `src/lib/domain/` directory

**Phase 7 Wave 2 actions (2026-05-07, parallel orchestration):**
- ✅ `/gsd:execute-plan 07-04` (Wave 2) — Payouts page rebuild: 5 new v2 leaf components (PayoutsKPICardsV2, AgingAlert, StatusBreakdownCards, FailureReasons, ThirdPartyPayouts) + TopBancos restyle (section-payouts left-edge + per-row volume bars) + `formatMinutes` helper + page rewrite with TIME-FIRST cockpit (KPI header → AgingAlert conditional → StatusBreakdown → TopBancos → FailureReasons / ThirdParty in lg:grid-cols-2) + first production consumer of `joinPayouts()` chained into `aggregateThirdPartyPayouts`. **Partial v1 prune** (Rule 4 deviation): deleted 7 symbols whose only consumer was the rewritten page + 2 deleted v1 leaves (`PayoutsKPICards.tsx`, `LatencyHistogram.tsx`); KEPT alive 4 symbols (`filterPayouts`, `summarizePayouts`, `PayoutSummary`, `COMPLETED_PAYOUT_STATES`) still consumed by Inicio + Clientes pages — deferred to Phase 9 + Phase 10 page rewrites. tsc + lint (0 errors, 3 pre-existing warnings unchanged) + build all green; visual checkpoint approved by user.
- 🚧 `/gsd:execute-plan 07-02` (Wave 2) — Bonos page rebuild: page commits `e6f9ab6` (page rewrite) + `6c74f52` (v2 leaves) on master; SUMMARY + STATE.md finalize race in parallel with this plan's finalize.

**Next:**
1. `/gsd:plan-phase 8` — Recargas (PSE + Transfer) page composition — first never-before-built section in v2.0 milestone
2. Phase 9 (Vista Cliente v2) and Phase 10 (Inicio v2) inherit the deferred-prune migration: each must replace `filterPayouts + summarizePayouts + PayoutSummary` consumers with v2 helpers (`summarizePayoutsByState` + `aggregateAverageProcessingMinutes`) — final prune of the kept-alive 4 symbols lands when both rewrites are complete.

Stopped at: Completed 07-04-PLAN.md (Phase 7 Wave 2 75% closed; 3/4 plans; 07-02 sibling finalize in flight)
Resume file: None
