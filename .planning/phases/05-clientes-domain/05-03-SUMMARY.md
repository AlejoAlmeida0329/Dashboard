---
phase: 05-clientes-domain
plan: 03
subsystem: ui
tags: [react, server-components, recharts, nextjs, cliente-foco, share-url]

# Dependency graph
requires:
  - phase: 05-clientes-domain
    provides: "EmpresaProfileSummary + MonthlyActivity stable type contracts (Plan 05-01 clientes.ts)"
  - phase: 02-bonos
    provides: "BonoSummary type + summarizeBonos function (consumed by EmpresaMiniCards)"
  - phase: 03-payouts
    provides: "PayoutSummary type + summarizePayouts function + formatDuration helper"
  - phase: 04-inicio-recargas
    provides: "RecargaSummary type + summarizeRecargas function; /inicio cliente-foco contract (CLI-08 destination); RecargasTrendChart shape mirror reference"
  - phase: 01-foundation
    provides: "@/lib/format gates (formatCOP/formatInteger/formatDuration/formatBogotaDate); @/lib/url-state buildUrl+parseFilters; Card + Button UI primitives"
provides:
  - "EmpresaProfileHeader Server Component (CLI-05): empresa_nombre + status badge + Última actividad + 4 inline KPIs"
  - "EmpresaActivityChart Client Component (CLI-06): 12-month bar chart, recharts BarChart, currentColor stroke"
  - "EmpresaMiniCards Server Component (CLI-07): 3 mini cards Bonos/Recargas/Payouts summarizing one empresa"
  - "GenerarVistaClienteButton Client Component (CLI-08): cliente-foco share-URL trigger, navigates to /inicio?empresa=X&presenter=1"
affects: [05-04 page composition for /clientes/[empresaId]; future phases that introduce per-empresa drill-down profiles]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Page composes domain calls, leaf renders: EmpresaMiniCards is presentation-only, page (05-04) calls summarize{Bonos,Recargas,Payouts} narrowed to empresa and passes BonoSummary/RecargaSummary/PayoutSummary"
    - "Cliente-foco delegation: NO visibility attributes on any of these 4 leaves; cliente-foco enforced at the share-URL boundary (GenerarVistaClienteButton navigates AWAY to /inicio which has the visibility attributes from Plans 04-05/04-07)"
    - "Pathspec-limited git commit (`git commit -- <pathspec>`) successfully defends against parallel-wave race when sibling plan modifies same directory"

key-files:
  created:
    - src/components/clientes/EmpresaProfileHeader.tsx
    - src/components/clientes/EmpresaActivityChart.tsx
    - src/components/clientes/EmpresaMiniCards.tsx
    - src/components/clientes/GenerarVistaClienteButton.tsx
  modified: []

key-decisions:
  - "All 4 leaves are prop-only: page composition (Plan 05-04) computes domain results, passes summary types as props"
  - "Cliente-foco delegated to share-URL boundary: zero data-presenter*hide attributes on any leaf (verified via grep on JSX attribute syntax)"
  - "EmpresaMiniCards consumes Phase 2/3/4 type contracts (BonoSummary/RecargaSummary/PayoutSummary) unchanged — no new domain functions needed"
  - "Payout P50 renders em-dash when count===0 (avoids '0:00:00' false-precision)"
  - "EmpresaActivityChart uses raw `yyyy-MM` X-axis labels (locale-invariant numeric format) — no format helper needed"
  - "GenerarVistaClienteButton mirrors PresenterToggle's useSearchParams + parseFilters + buildUrl idiom — preserves existing date filter while injecting empresa + presenter"

patterns-established:
  - "Component signatures: each leaf takes a single typed Props (Header takes EmpresaProfileSummary; Chart takes MonthlyActivity[]; Mini takes 3 summary types; Button takes empresaId string). No optional props, no callbacks — pure render functions."
  - "Chrome ownership: Header carries its own Card; Chart is bare (page provides Card chrome in 05-04); Mini cards carry their own 3 Cards; Button is bare. Mirrors RecargasTrendChart (bare) vs HechosCuradosRecargas (self-Card) split from Phase 4."
  - "Verify-check anomaly handling: when `<verify>` greps conflict with the spec's own literal code (over-strict matchers), document the conflict in commit message + SUMMARY rather than mutating code to satisfy the grep."

# Metrics
duration: 5m 42s
completed: 2026-05-06
---

# Phase 5 Plan 03: Clientes profile visual leaves Summary

**4 prop-only React leaves for /clientes/[empresaId] (CLI-05 header + CLI-06 12-month chart + CLI-07 3 mini cards + CLI-08 cliente-foco share-URL button), all consuming Plan 05-01 clientes.ts and Phase 2/3/4 summary type contracts unchanged.**

## Performance

- **Duration:** 5m 42s
- **Started:** 2026-05-06T21:19:32Z
- **Completed:** 2026-05-06T21:25:14Z
- **Tasks:** 2 (both `auto`)
- **Files created:** 4

## Accomplishments

- **EmpresaProfileHeader** (CLI-05): Server Component with empresa_nombre + Activa/Inactiva status badge (ClientesTable convention) + "Última actividad: <date>" + 4 inline KPIs ($ período, $ histórico, # tx período, # tx histórico). Consumes `EmpresaProfileSummary` from Plan 05-01.
- **EmpresaActivityChart** (CLI-06): Client Component (recharts ResponsiveContainer + BarChart needs DOM). 12 monthly bars, zero-fill from `aggregateMonthlyActivity` (Plan 05-01 guarantees `result.length===12`). currentColor stroke for theme-aware via parent's `text-foreground` token; no Card chrome (page provides); no Legend (single series); `minPointSize={2}` keeps zero-month bars visible. Mirror of RecargasTrendChart shape.
- **EmpresaMiniCards** (CLI-07): Server Component, 3 mini cards summarizing this empresa's Bonos / Recargas / Payouts activity. Each card shows count + most-relevant single metric. Presentation-only — page composition (Plan 05-04) passes in `BonoSummary`, `RecargaSummary`, `PayoutSummary`. NO data-presenter-hide on the wrapper or any card.
- **GenerarVistaClienteButton** (CLI-08, the Phase 5 closing UX): Client Component. On click, builds `/inicio?<existing-filters>&empresa=<empresaId>&presenter=1` via `useSearchParams + parseFilters + buildUrl` spread (preserves existing date filter), then `router.push(url)`. Destination /inicio (Plan 04-07) honors the cliente-foco contract end-to-end (Comisión + Take rate hidden, HechosCurados block hidden, EmpresasActivasChart Card hidden, GMV chart + 3 visible KPIs remain).

All 4 components are prop-only and isolated from page-composition work. Plan 05-04 wires them into the dynamic route page.

## Task Commits

Each task was committed atomically (with pathspec-limited `git commit --` to defend against parallel Plan 05-02 race):

1. **Task 1: EmpresaProfileHeader.tsx + EmpresaActivityChart.tsx** — `c6b93b9` (feat)
2. **Task 2: EmpresaMiniCards.tsx + GenerarVistaClienteButton.tsx** — `a93cd26` (feat)

**Plan metadata:** _(this commit, after SUMMARY + STATE update)_

## Files Created/Modified

- `src/components/clientes/EmpresaProfileHeader.tsx` (73 LOC, Server) — Profile header with name + status + última actividad + 4 inline KPIs
- `src/components/clientes/EmpresaActivityChart.tsx` (75 LOC, Client) — 12-month bar chart of monto by month
- `src/components/clientes/EmpresaMiniCards.tsx` (106 LOC, Server) — 3 mini cards: Bonos / Recargas / Payouts
- `src/components/clientes/GenerarVistaClienteButton.tsx` (51 LOC, Client) — CLI-08 cliente-foco share-URL trigger

**Module purity verified:** zero `next/server` or `@/lib/sheets` imports across all 4 leaves (verified via `grep -rE "(\"next/server\"|@/lib/sheets)" src/components/clientes/Empresa*` → 0 hits). Visual leaves never touch sheets directly.

**Format gates verified:** zero `Intl.|toLocaleString` callsites across all 4 leaves (Pitfall 9 single Intl gate preserved). All numerics flow through `@/lib/format` (formatCOP / formatInteger / formatBogotaDate / formatDuration).

## Decisions Made

1. **Page composes, leaf renders.** EmpresaMiniCards is purely presentation — the page (Plan 05-04) is responsible for calling `summarizeBonos(filterBonos(allTx, {...filters, empresa: empresaId}))` (and the analogous chains for Recargas and Payouts), then passing the 3 summaries as props. This keeps the leaf stable across future domain-function changes and avoids cross-domain coupling inside `src/components/clientes/`.

2. **Cliente-foco delegation: zero visibility attributes on any of these 4 leaves.** The cliente-foco contract (Comisión hidden, HechosCurados hidden, etc.) is enforced at the share-URL boundary by `GenerarVistaClienteButton` — clicking navigates AWAY to `/inicio` (Plan 04-07), which carries the data-presenter-hide and data-presenter-empresa-hide attributes. Inside `/clientes/[empresaId]`, ALL data is the cliente's own data; hiding "their own monto" or "their own activity timeline" would defeat the page's purpose. Verified empirically via `grep 'data-presenter[^"]*"'` → 0 JSX attribute hits across all 4 files (the 4 raw `data-presenter*hide` matches are in JSDoc comments documenting what the destination /inicio hides — not on JSX).

3. **EmpresaMiniCards consumes Phase 2/3/4 type contracts unchanged.** No new domain functions needed; `BonoSummary` (Phase 2) + `RecargaSummary` (Phase 4) + `PayoutSummary` (Phase 3) ship from their existing modules. The "narrow to one empresa" semantic comes from passing `{...filters, empresa: empresaId}` to the existing `filter*` functions, not from new domain code. Confirms Phase 5's "Domain" emphasis is right-sized: Plan 05-01 added the empresa-centric aggregations (4 new functions in clientes.ts); Plan 05-03's MiniCards reuses the Phase 2/3/4 single-domain summarizers as-is.

4. **Payout P50 renders em-dash when `payouts.count === 0`.** Avoids `formatDuration(0)` → `0:00:00` false-precision when there are no completed payouts for this empresa (Plan 03-03's `formatDuration` returns `'0:00:00'` for `0` input, which would suggest "took 0 seconds" rather than "no data"). The em-dash is the project's standard "no data" marker (consistent with `formatCOP(null)` / `formatInteger(null)` / `formatPercent(null)` which all return `'—'`).

5. **EmpresaActivityChart X-axis uses raw `yyyy-MM` labels.** Locale-invariant numeric format — no formatBogotaDate helper needed. The plan-author's call: 12-month chart's job is to read "this empresa's activity over time"; abbreviated month names (es: "abr 2026") would be longer + locale-dependent. Pure `2025-05`..`2026-04` ISO labels keep the chart maintainable and theme-agnostic. Tooltip's date is also raw because tooltips on bar charts include the bucket key by default in recharts.

6. **GenerarVistaClienteButton mirrors PresenterToggle's URL-state idiom verbatim.** `useSearchParams().forEach + parseFilters + buildUrl + router.push` — same as `src/components/layout/presenter-toggle.tsx:25-39`. Preserving the existing `from`/`to` filters means a cliente sees their own data within whatever date range was visible on /clientes/$mario at click time. The `presenter: "1"` literal is the canonical "on" value per `src/lib/url-state.ts:32` (anything else means off).

## Deviations from Plan

**No code deviations.** Code is byte-identical to the plan's `<action>` literal blocks (modulo Prettier-style multi-line wrap of one `contentStyle={{...}}` object in EmpresaActivityChart, which is style-only — same JSX, same props).

### Verify-Check Anomalies (3 over-strict greps in plan)

The plan's `<verify>` section contains 3 greps that conflict with the plan's own literal `<action>` code blocks. Documenting here so future plans don't replicate the pattern:

**1. Task 2 verify check 4: `grep -c "buildUrl" src/components/clientes/GenerarVistaClienteButton.tsx === 1`**
- **Actual:** `=== 2`
- **Why:** the spec's literal code has both `import { buildUrl, parseFilters }` AND `const url = buildUrl(...)` — both lines match. Same shape as `PresenterToggle.tsx` (the reference idiom).
- **Intent satisfied:** `buildUrl` is used to construct the cliente-foco URL.
- **Suggested rewrite for future plans:** `grep -E "const \w+ = buildUrl\\(" ... === 1` to match the call only.

**2. Task 2 verify check 7: `grep -c "data-presenter-hide\|data-presenter-empresa-hide" src/components/clientes/EmpresaMiniCards.tsx src/components/clientes/GenerarVistaClienteButton.tsx === 0`**
- **Actual:** `=== 4`
- **Why:** all 4 hits are in JSDoc comments (the spec's own literal text — MiniCards line 15 documents "NO data-presenter-hide on the wrapper"; Button lines 9-11 document what the destination /inicio hides).
- **Intent satisfied:** zero JSX attribute hits via `grep 'data-presenter[^"]*"'` (which matches the attribute-with-quoted-value JSX syntax) → exit code 1.
- **Suggested rewrite for future plans:** `grep 'data-presenter[^"]*=' ... === 0` to match attribute syntax only, not comment mentions.

**3. EmpresaActivityChart `min_lines: 80` must_have**
- **Actual:** 75 LOC.
- **Why:** the plan's literal `<action>` code block is exactly 70 LOC; my Prettier-style wrap of `contentStyle={{...}}` onto 3 lines bumps to 75. Reaching 80 LOC would require splitting more JSX props onto separate lines (style-only churn).
- **Intent satisfied:** all recharts primitives the spec specifies are present (BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar with all required props), all formatters wired, currentColor strokes throughout, minPointSize=2.
- **Suggested rewrite for future plans:** specify min_lines based on the literal `<action>` block's actual line count rather than a round number.

These anomalies are reported, not "fixed" — mutating the code to pass over-strict greps would be cargo-cult work that adds nothing while diverging from the spec.

### Operational deviation: parallel-wave git race (recurrence)

This is the SAME race documented in STATE.md entries 134 + 150 (Plans 04-04 + 04-01) — but this time visible from BOTH sides in real time:

- **Initial occurrence:** my Task 1 `git add ...` + `git commit -m ...` (without pathspec) ran while Plan 05-02 had `ClientesKPICards.tsx` untracked. Plan 05-02's subsequent commit `a6ae852` swept up my 2 Task 1 files into its commit (3 files total in one diff under `feat(05-02)` message).
- **Recovery (sibling-driven):** Plan 05-02 detected the race, ran `git reset --hard HEAD~1` to undo `a6ae852`, then re-committed only its own file as `fc320e9` with single-file diff. My 2 Task 1 files reverted to untracked.
- **My second attempt:** used `git commit -- <pathspec>` (the mitigation explicitly cited in the orchestrator prompt and STATE.md entries 134/150) → commit `c6b93b9` cleanly captures only my 2 Task 1 files.
- **Task 2 commit `a93cd26`:** also pathspec-limited; clean from start.

**Net result:** code state is correct; commit history now shows the proper per-task atomic commit pattern (`c6b93b9` Task 1 + `a93cd26` Task 2 + `fc320e9` 05-02's leaf). The race added one cycle of `reset --hard + re-commit` and the temporary intermediate commit `a6ae852` no longer appears in HEAD's ancestor chain.

**Total deviations:** 0 code deviations; 3 over-strict verify-check anomalies (documented, not fixed); 1 operational git-race recurrence (recovered cleanly via pathspec mitigation). ELEVENTH consecutive technical-zero-deviation plan in this project (after 02-04, 03-02, 03-03, 03-04, 04-03, 04-01, 04-02, 04-07, 04-08, 05-01).

## Issues Encountered

- **`npx` not on default PATH** — same issue as Phase 4 deploys (Vercel CLI also wasn't on default PATH). Resolution: `export PATH="/Users/alejoalmeida/.nvm/versions/node/v24.11.0/bin:$PATH"` then call `node_modules/.bin/tsc` directly. Build still ran clean. Should NOT auto-promote to a STATE.md blocker since the Vercel CLI entry already documents the same workaround.

## User Setup Required

None. All 4 components ship as code only; no environment variables, no external services.

## Next Phase Readiness

**Ready for Plan 05-04** (`/clientes/[empresaId]` page composition):
- 4 visual leaves shipped with stable Props contracts
- 5 stable type contracts upstream from Plan 05-01 (`EmpresaProfileSummary`, `MonthlyActivity`, `EmpresaListRow`, `EmpresasIndexSummary`, `EmpresaStatus`)
- Phase 2/3/4 summary types unchanged (`BonoSummary`, `RecargaSummary`, `PayoutSummary`)
- All format gates verified (zero direct Intl across new files)
- Build clean (`npm run build` ✓ all 11 routes emitted including existing `/clientes` placeholder)

**Plan 05-04 page composition will:**
1. Read `params.empresaId` + `searchParams` → `parseFilters` → `findEmpresa(allTx, empresaId, filters)` (Plan 05-01).
2. If `null`, render 404 fallback.
3. Render `EmpresaProfileHeader summary={profileSummary}`.
4. Compute `aggregateMonthlyActivity(allTx, empresaId)` (Plan 05-01) → render `EmpresaActivityChart data={...}` inside a Card with title.
5. Compute 3 narrowed summaries — `summarizeBonos(filterBonos(allTx, {...filters, empresa: empresaId}))`, `summarizeRecargas(filterRecargas(allTx, {...filters, empresa: empresaId}))`, `summarizePayouts(filterPayouts(...payoutsWithJoin..., {...filters, empresa: empresaId}))` — render `EmpresaMiniCards bonos={...} recargas={...} payouts={...}`.
6. Render `GenerarVistaClienteButton empresaId={empresaId}` at the bottom (sticky-style or in a header bar).

**No blockers, no concerns.** The cliente-foco contract is fully delegated to /inicio (which Plan 04-07 already verified end-to-end across all 4 URL states).

---
*Phase: 05-clientes-domain*
*Completed: 2026-05-06*
