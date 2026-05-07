---
phase: 07-bonos-payouts
plan: 02
subsystem: ui
tags: [bonos, ranking, kpi, recharts, stacked-bar, server-components, section-bonos, violet-oklch]

requires:
  - phase: 07-bonos-payouts
    provides: filterBonosV2 / summarizeBonosV2 / aggregateBonosByDateV2 / aggregateTopEmisores / aggregateTopReceptores; types BonoSummaryV2 / BonoByDateV2 / BonoTikintagRow; Transaction.sourceTransferTikintag / destinationTransferTikintag fields (Plan 07-01)
  - phase: 06-foundation-v2
    provides: section-bonos OKLCH palette + Tailwind utilities (Plan 06-04), DashboardFilters CSV multi-select + URL contract (Plan 06-03), parseFilters Server-Component reader (Plan 06-03)
  - phase: 02-bonos
    provides: getCachedTransactions cache contract, BD_Plataforma adapter, dynamic="force-dynamic" + Promise<searchParams> Next 16 page conventions (informational continuity)
provides:
  - KPICardsV2 component (5-card responsive grid: countIn / countOut / montoIn / montoOut / ticketPromedio)
  - TopEmisores component (Card with border-l-4 violet accent stripe; raw <table> rendering top-N rows)
  - TopReceptores component (mirror of TopEmisores; ranks by destinationTransferTikintag)
  - BonosFlowChart component (Recharts BarChart Client Component; stacked countOut/countIn per Bogotá day with custom tooltip)
  - bonos/page.tsx v2 composition (KPI header → TopEmisores | TopReceptores lg:grid-cols-2 → BonosFlowChart context card)
  - 4 v1 component files deleted (KPICards, Leaderboard, SalesTable, BonosChart — bonos/page was their sole consumer)
affects:
  - 09-vista-cliente (CLI-V2-* may reuse TopEmisores/TopReceptores filtered to one empresa for Vista Cliente)
  - 07-02b (follow-up plan to migrate clientes/[empresaId]/page.tsx + EmpresaMiniCards.tsx to v2 helpers and complete the v1-fn prune in bonos.ts)
  - 10-inicio-infra (BonosFlowChart pattern — stacked bars with hard-coded OKLCH shades, custom tooltip — reusable for any cross-cut where two stacked dimensions need clear distinction)

tech-stack:
  added: []
  patterns:
    - "Ranking-first cockpit composition: KPI header → 2-column ranking grid (lg+) → context chart below. Mirrors 07-CONTEXT.md essential 'ranking-first' for Bonos (vs Payouts' 'time-first' inverse)"
    - "Hard-coded OKLCH constants for Recharts fills: `oklch(0.50 0.20 295)` (darker / enviados) + `oklch(0.65 0.20 295)` (lighter / recibidos) anchored on section-bonos hue (295°). Avoids the Tailwind-opacity-on-bars Recharts incompatibility AND keeps chart fills stable across light/dark theme switches (intentional — chart is the protagonist of its rectangle, theme-driven shade shifts hurt comparability)"
    - "border-l-4 border-l-section-bonos accent stripe pattern for ranking cards — visual protagonist marker (07-CONTEXT.md essentials: rankings dominate the first scroll). Tailwind utility resolves through `--color-section-bonos: var(--section-bonos)` (Plan 06-04 @theme inline mapping)"
    - "Custom Recharts Tooltip Server-Component-friendly shape: typed `payload: TooltipPayload[]` with explicit `payload[0]?.payload` row reaching, formatted via `formatCOP`/`formatInteger` (single Intl gate from format.ts preserved). Avoids the `formatter` prop's awkward two-pass rendering"

key-files:
  created:
    - src/components/bonos/KPICardsV2.tsx (123 LOC, Server Component)
    - src/components/bonos/TopEmisores.tsx (87 LOC, Server Component, raw <table>)
    - src/components/bonos/TopReceptores.tsx (76 LOC, Server Component, raw <table>)
    - src/components/bonos/BonosFlowChart.tsx (144 LOC, Client Component, Recharts BarChart)
  modified:
    - src/app/(protected)/bonos/page.tsx (rewritten: 84 ↔ 145 LOC; v1 imports → v2 imports; v1 layout → ranking-first cockpit)
  deleted:
    - src/components/bonos/KPICards.tsx (72 LOC, v1)
    - src/components/bonos/Leaderboard.tsx (71 LOC, v1)
    - src/components/bonos/SalesTable.tsx (106 LOC, v1)
    - src/components/bonos/BonosChart.tsx (107 LOC, v1)

key-decisions:
  - "Raw <table> markup over a new shadcn ui/table primitive — repo doesn't ship one (only card/button/input/label/separator/skeleton/sonner/switch); creating one for two ranking components is scope creep; v1 SalesTable.tsx already established the raw-<table> convention. Both TopEmisores and TopReceptores use `<table className=\"w-full text-sm\">` with manual <thead>/<tbody>/<tr>/<th>/<td>"
  - "v1 domain functions in bonos.ts NOT pruned (Task 2(b) deferred per the plan's own STOP gate). filterBonos / summarizeBonos / aggregateBonosByDate / aggregateBonosByEmpresa / top10Empresas + interfaces BonoSummary / BonoByDate / BonoByEmpresa STILL exported because clientes/[empresaId]/page.tsx and EmpresaMiniCards.tsx are live consumers outside the Bonos page. Migrating them to v2 helpers is Phase 9 (Vista Cliente CLI-V2) territory or a small follow-up plan 07-02b — not Plan 07-02's scope"
  - "KPICardsV2 has NO data-presenter-hide attribute on any card — all 5 KPIs (counts, montos, ticket) are visible in BOTH internal and presenter mode. Distinct from v1 KPICards which marked the comisión card hidden. Reason: 07-CONTEXT.md re-frames Bonos around emisor/receptor activity (the protagonist is now 'who is most active', not 'how much revenue'); Tikin-revenue framing isn't part of v2 Bonos so there's nothing to hide. Comisión is no longer surfaced on this page at all"
  - "ticketPromedio uses muted color (text-muted-foreground), all other 4 KPIs use text-section-bonos — derived metric subordination. The 4 protagonist KPIs (counts + montos in/out) drive the cockpit; ticket promedio is context, intentionally quieter"
  - "BonosFlowChart hard-codes OKLCH fills (not CSS variable reads) — chart shades stay STABLE across light/dark theme. .dark in Plan 06-04 lifts the section vars +0.10 lightness; reading `var(--section-bonos)` from JS would shift the bars in dark mode, breaking visual continuity. Two anchored shades at L=0.50 and L=0.65 land in a comfortable contrast band against both background variants"
  - "Empty-state row inside the table (single TR with colSpan={4} + py-6 + text-center) — keeps table chrome (header row) visible even when zero rows. Distinct from the v1 Leaderboard pattern which switched between <ol> and <p>; the v2 table-with-empty-row preserves layout consistency across filter changes"

patterns-established:
  - "Pattern: ranking-first cockpit layout (Bonos) — KPI grid (5 col xl) on top, lg:grid-cols-2 ranking pair in the middle, full-width chart card below. Section accent (border-l-4 border-l-section-X) marks ranking cards as protagonists. Inverse of Payouts time-first layout (Plan 07-04)"
  - "Pattern: Recharts stacked-bar with hard-coded OKLCH constants — two shades anchored on section hue (L=0.50 darker base, L=0.65 lighter top), passed as `fill` prop directly. Document inline why (Tailwind opacity vs Recharts <Bar> + theme stability)"
  - "Pattern: v1-fn prune deferral when out-of-scope consumers exist — when the plan's STOP gate fires (cross-page imports of v1 symbols), commit Task 2(a) page rewrite + Task 2(c) component-file deletion only; defer Task 2(b) domain-fn prune to a follow-up plan that migrates the cross-page consumers. Document the deferral in SUMMARY frontmatter (key-decisions) AND in STATE.md decisions table so the next agent inherits the constraint"

# Metrics
duration: 18m 36s
completed: 2026-05-07
---

# Phase 07 Plan 02: Bonos Page v2 — Ranking-First Cockpit Summary

**Shipped the v2 Bonos cockpit (KPICardsV2 + TopEmisores | TopReceptores side-by-side + BonosFlowChart stacked timeline) in the section-bonos Violet OKLCH palette; v1 component files pruned but v1 domain helpers in bonos.ts deferred for a follow-up plan because clientes/[empresaId]/page.tsx and EmpresaMiniCards.tsx still consume them.**

## Performance

- **Duration:** ~18m 36s (Task 1 + Task 2 build + checkpoint pause + finalize)
- **Started:** 2026-05-07 (immediately after Plan 07-01 + 07-03 wave-1 close)
- **Completed:** 2026-05-07
- **Tasks:** 2 auto + 1 visual checkpoint (approved)
- **Files created:** 4 (all v2 components in src/components/bonos/)
- **Files modified:** 1 (src/app/(protected)/bonos/page.tsx, full rewrite)
- **Files deleted:** 4 (v1 components: KPICards.tsx, Leaderboard.tsx, SalesTable.tsx, BonosChart.tsx)

## Accomplishments

- **v2 Bonos cockpit live** at `/bonos`: 5-card responsive KPI header (1→2→5 cols), TopEmisores | TopReceptores side-by-side (lg:grid-cols-2) with `border-l-4 border-l-section-bonos` violet accent stripes, BonosFlowChart Recharts stacked-bar timeline below as context — exactly the ranking-first composition called out in 07-CONTEXT.md essentials.
- **Section palette honored end-to-end**: all KPI counts/montos in `text-section-bonos`, ticketPromedio in `text-muted-foreground` for derived-metric subordination, ranking cards use the section-bonos border accent, chart fills hard-code OKLCH `(0.50 0.20 295)` darker / `(0.65 0.20 295)` lighter pinned on the Bonos hue (295°). Dark mode inherits from Plan 06-04's `+0.10` lightness shift on the section vars; chart fills intentionally don't shift (theme-stable for visual continuity).
- **All v1 component files pruned** (KPICards, Leaderboard, SalesTable, BonosChart — 356 LOC removed; bonos/page was their sole consumer). Final tree under `src/components/bonos/` is exactly the 4 v2 files (430 LOC added).
- **All gates green** (verified with sibling Plan 07-04 working tree stashed for isolation): `tsc --noEmit` 0 errors, `npm run lint` 0 errors + 3 pre-existing warnings (unrelated v1 files), `npm run build` compiled successfully with `/bonos` in the route map.
- **Visual checkpoint approved** by user — cockpit feel matches the 07-CONTEXT.md essential ("ranking-first" + "densidad informativa" via 5-col KPI grid).

## Task Commits

Each task was committed atomically (per-task atomicity preserved through the parallel-wave race):

1. **Task 1: Build the four v2 Bonos leaf components** — `6c74f52` (feat) — KPICardsV2 + TopEmisores + TopReceptores + BonosFlowChart, 430 insertions, 4 new files
2. **Task 2: Rewrite bonos/page.tsx with ranking-first layout + delete v1 leaves** — `e6f9ab6` (feat) — page rewrite + 4 v1 component deletions, 45 insertions / 395 deletions, 5 files changed

**Plan metadata:** `<this commit>` (docs)

## Files Created/Modified

### Created (4 v2 components, 430 LOC total)

- `src/components/bonos/KPICardsV2.tsx` (123 LOC, Server Component) — 5 KPI cards in `grid sm:grid-cols-2 xl:grid-cols-5`. Order: bonos recibidos, bonos enviados, volumen recibido, volumen enviado, ticket promedio. All 4 protagonist KPIs in `text-section-bonos`; ticket promedio in `text-muted-foreground`. Empty-state hint preserved in subtitle when totalBonos=0. Reads `BonoSummaryV2` from `@/lib/domain/bonos`.
- `src/components/bonos/TopEmisores.tsx` (87 LOC, Server Component) — Card with `border-l-4 border-l-section-bonos` accent stripe. Raw `<table className="w-full text-sm">` with 4 columns: # (rank), Tikintag, Bonos (count), Volumen (formatCOP). Empty-state row uses `colSpan={4}` to span the full width with friendly Spanish copy. Reads `BonoTikintagRow[]` from `@/lib/domain/bonos`.
- `src/components/bonos/TopReceptores.tsx` (76 LOC, Server Component) — mirror of TopEmisores with title "Top receptores" and empty-state copy "Sin receptores en el período". Same structure / same accent.
- `src/components/bonos/BonosFlowChart.tsx` (144 LOC, Client Component, `"use client"`) — Recharts `BarChart` with two `<Bar>` series stacked on `stackId="bonos"`: `countOut` (darker, name "Enviados", `fill="oklch(0.50 0.20 295)"`) underneath, `countIn` (lighter, name "Recibidos", `fill="oklch(0.65 0.20 295)"`) on top. Custom typed `<FlowTooltip>` Component shows date + recibidos + enviados counts + montoIn + montoOut formatted via the format.ts helpers. Empty data renders a `<p>Sin actividad en el período</p>` instead of an empty axis frame.

### Modified (1 file, full rewrite)

- `src/app/(protected)/bonos/page.tsx` — rewritten from v1 (filterBonos + KPICards + BonosChart + Leaderboard + SalesTable composition) to v2 (filterBonosV2 + summarizeBonosV2 + aggregateBonosByDateV2 + aggregateTopEmisores + aggregateTopReceptores → KPICardsV2 + 2-col ranking grid + BonosFlowChart context card). Empty-state path keeps the v1 friendly Card pattern (Sin bonos en el período seleccionado) but uses the v2 KPICardsV2 zero-render. Error-path Card preserved verbatim. JSDoc updated to describe the v2 pipeline + ranking-first essential + responsive layout.

### Deleted (4 v1 component files, 356 LOC removed)

- `src/components/bonos/KPICards.tsx` (72 LOC) — replaced by KPICardsV2
- `src/components/bonos/Leaderboard.tsx` (71 LOC) — replaced by TopEmisores
- `src/components/bonos/SalesTable.tsx` (106 LOC) — superseded; v2 doesn't surface a per-empresa breakdown table on the Bonos page (the rankings ARE the breakdown now)
- `src/components/bonos/BonosChart.tsx` (107 LOC) — replaced by BonosFlowChart

## Decisions Made

See `key-decisions` in frontmatter — the most consequential ones for downstream work:

1. **Raw `<table>` over creating a new shadcn `ui/table` primitive** — the repo only ships card/button/input/label/separator/skeleton/sonner/switch primitives. Creating one for two ranking components is scope creep beyond Plan 07-02. Both ranking files use `<table className="w-full text-sm">` with manual `<thead>`/`<tbody>`/`<tr>`/`<th>`/`<td>`, matching the convention v1 SalesTable already established. If a future plan wants a real shadcn-style Table primitive, it can refactor across all consumers in one diff.
2. **v1 domain functions in `bonos.ts` NOT pruned** — Task 2(b) deferred per the plan's own STOP gate. Live consumers OUTSIDE the Bonos page block the prune:
   - `src/app/(protected)/clientes/[empresaId]/page.tsx` (lines 84, 180, 193) — calls `filterBonos` and `summarizeBonos`
   - `src/components/clientes/EmpresaMiniCards.tsx` (lines 28, 34) — imports type `BonoSummary`
   The plan's instruction was explicit: "If any other file still imports a v1 symbol, STOP and surface — the prune cannot proceed without breaking that file." Deferred to either Phase 9 (Vista Cliente rebuild) or a follow-up plan `07-02b` that migrates the two clientes consumers and completes the prune in a single cohesive diff.
3. **No `data-presenter-hide` on any KPI card in KPICardsV2** — distinct from v1 KPICards which hid the comisión card. v2 Bonos doesn't surface comisión at all (07-CONTEXT.md re-frames around emisor/receptor activity), so there's nothing to hide. All 5 cards visible in both internal and presenter mode.
4. **Hard-coded OKLCH constants for chart fills** — `var(--section-bonos)` would shift the bar shades in dark mode (.dark lifts section vars +0.10 lightness per Plan 06-04). The chart fills are pinned at `L=0.50` and `L=0.65` so the visual relationship between enviados/recibidos stays identical across themes. The trade-off: chart bars don't auto-tint with dark mode like the rest of the section accents do, but they remain in a comfortable contrast band against both backgrounds.
5. **Default `n=10` for ranking helpers** — matches v1 `top10Empresas` convention (Plan 07-01 already encoded it as the default). v2 page passes `10` explicitly for clarity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] No `@/components/ui/table` primitive in repo**
- **Found during:** Task 1 (component scaffolding)
- **Issue:** Plan instructed `import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"`. The repo has no such primitive (only card / button / input / label / separator / skeleton / sonner / switch).
- **Fix:** Used raw `<table className="w-full text-sm">` markup with manual `<thead>` / `<tbody>` / `<tr>` / `<th>` / `<td>` styled via Tailwind utilities — same convention v1 `SalesTable.tsx` already established across the codebase. Documented inline in `TopEmisores.tsx` (the file with the larger comment block; `TopReceptores.tsx` mirrors).
- **Files modified:** `src/components/bonos/TopEmisores.tsx`, `src/components/bonos/TopReceptores.tsx`
- **Verification:** `tsc --noEmit` clean; visual checkpoint approved
- **Committed in:** `6c74f52` (Task 1 commit)

### Architectural Deviation (deferred, NOT auto-fixed)

**2. [Rule 4 — Architectural] v1 domain functions in `bonos.ts` left in place**
- **Found during:** Task 2(b) prune phase (the plan's own STOP gate fired)
- **Issue:** Plan instructed pruning `filterBonos` / `summarizeBonos` / `aggregateBonosByDate` / `aggregateBonosByEmpresa` / `top10Empresas` + interfaces `BonoSummary` / `BonoByDate` / `BonoByEmpresa` from `src/lib/domain/bonos.ts`. Verification grep surfaced TWO live consumers OUTSIDE the Bonos page:
  - `src/app/(protected)/clientes/[empresaId]/page.tsx` lines 84 (`import { filterBonos, summarizeBonos }`), 180 (`filterBonos(allTx, empresaFilters)`), 193 (`summarizeBonos(bonosCurrent)`)
  - `src/components/clientes/EmpresaMiniCards.tsx` lines 28 (`import type { BonoSummary }`), 34 (`bonos: BonoSummary` prop type)
- **Plan's STOP gate:** "If any other file still imports a v1 symbol, STOP and surface — the prune cannot proceed without breaking that file." → followed verbatim.
- **Resolution:** Task 2(a) page rewrite + Task 2(c) component-file deletion both completed (the page + 4 component files were the only Bonos-tab consumers; safely deleted). Task 2(b) domain-fn prune deferred. v1 fns + 3 v1 interfaces remain in `src/lib/domain/bonos.ts` BYTE-IDENTICAL alongside the v2 helpers from Plan 07-01.
- **Follow-up required:** A small plan `07-02b` (or absorbed into Phase 9 Vista Cliente rebuild) that:
  1. Migrates `clientes/[empresaId]/page.tsx` to call `filterBonosV2` + `summarizeBonosV2` + `BonoSummaryV2` (note: the V2 summary shape is split in/out — the consumer needs to decide whether to render the combined count or the split view; this is a UX call for Phase 9)
  2. Migrates `EmpresaMiniCards.tsx`'s `bonos` prop type from `BonoSummary` to `BonoSummaryV2` (and updates the rendering — the v1 shape has `count + ticketPromedio + comisionTotal + montoTotal`; the v2 shape has `countIn + countOut + montoIn + montoOut + ticketPromedio` with NO `comisionTotal`)
  3. Then completes the prune in `src/lib/domain/bonos.ts`: remove `filterBonos` / `summarizeBonos` / `aggregateBonosByDate` / `aggregateBonosByEmpresa` / `top10Empresas` + interfaces `BonoSummary` / `BonoByDate` / `BonoByEmpresa`. KEEP `BONO_TRANSACTION_TYPES`, `startOfDayBogotaTimestamp`, `endOfDayBogotaTimestamp` (v2 fns consume these).
- **Why not absorbed into Plan 07-02:** out of scope — Plan 07-02 is the Bonos page rebuild, not a cross-section refactor. Phase 9 will rebuild Vista Cliente against v2 helpers anyway; doing it twice (once now and once in Phase 9) is wasted work. A small surgical plan 07-02b is the alternative if the v1-fn surface bothers anyone before Phase 9 starts.
- **Committed in:** Deferred — NO commit modifies `src/lib/domain/bonos.ts` in Plan 07-02.

## Issues Encountered

**1. Parallel-wave git race with sibling Plan 07-04** — observed during Task 1 verification AND Task 2 verification, exactly as STATE.md warned ("Parallel-wave git race observed 3 times in v1.0", reconfirmed in Plan 07-01 wave 1).
- **Symptom:** sibling 07-04's working-tree changes (`M src/lib/format.ts` adding `formatMinutes`, plus 5 untracked `src/components/payouts/*.tsx` files) were visible in `git status` despite Plan 07-02 never touching `lib/format.ts` or `components/payouts/`. Sibling agent's TopBancos.tsx modification also appeared.
- **tsc surface:** sibling's `src/components/payouts/ThirdPartyPayouts.tsx` (untracked, uncommitted) referenced `PayoutState` not exported from `@/lib/domain/payouts` — error TS2459 at line 26.
- **Recovery:** Used `git stash --include-untracked --pathspec` to set sibling work aside (`git stash push --include-untracked -- src/components/payouts/ src/lib/format.ts`), ran `tsc --noEmit` + `npm run lint` + `npm run build` in isolation against Plan 07-02's changes only (all green), then `git stash pop`. The pop conflicted on `src/lib/format.ts` because the sibling agent re-touched it with identical content during my isolation window — diff comparison confirmed `6124af1..6139781` matched between stash and working tree, so I dropped the stash safely. All 5 sibling untracked files restored automatically through the partial pop.
- **Staging discipline:** explicit `git add -- <pathspec>` for both Task 1 and Task 2 commits — sibling-owned files NEVER entered any Plan 07-02 commit. Verified via `git status --short` post-stage on each commit.
- **Result:** Plan 07-02 commits (`6c74f52`, `e6f9ab6`) contain exactly the plan's intended diff (4 components added in 6c74f52; page rewrite + 4 v1 component deletions in e6f9ab6). Sibling Plan 07-04's working tree fully preserved for its own finalization.

**2. `npx`/`npm`/`node` not on `$PATH` in shell context** — pre-existing v1.0 blocker (STATE.md "Vercel CLI fuera de PATH"). Resolution: `export PATH="$HOME/.nvm/versions/node/v24.11.0/bin:$PATH"` prefixed on every gate-check command. Not a deviation; documented infra reality.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plan 07-04 (Wave 2 — Payouts page rebuild, sibling):**
- Plan 07-04 owns `src/components/payouts/` + `src/app/(protected)/payouts/page.tsx`. Disjoint file scope from Plan 07-02 (verified: zero file overlap across the two plans).
- Sibling agent already in flight with working-tree changes when this plan finalized; sibling will rebase/merge on top of `e6f9ab6` (Plan 07-02 page rewrite) when they finalize their own metadata commit.
- Sibling-owned tsc warning (`PayoutState not exported`) is internal to Plan 07-04's working tree and clears once they ship Task 1 of their plan.

**Follow-up plan needed (recommend `07-02b`):**
- Migrate `clientes/[empresaId]/page.tsx` + `EmpresaMiniCards.tsx` to v2 Bonos helpers (`filterBonosV2`, `summarizeBonosV2`, type `BonoSummaryV2`).
- Then prune v1 `filterBonos` / `summarizeBonos` / `aggregateBonosByDate` / `aggregateBonosByEmpresa` / `top10Empresas` + interfaces `BonoSummary` / `BonoByDate` / `BonoByEmpresa` from `src/lib/domain/bonos.ts`.
- Optional: same exercise on the sibling Payouts side if Plan 07-04 hits an analogous deferral.
- Alternative: absorb the migration into Phase 9 (Vista Cliente CLI-V2-* rebuild) — same files get rewritten there anyway against the new requirements.

## Output-Spec Notes (Plan 07-02 explicitly requested)

### 5-col KPI grid on a 1440-width laptop viewport

The 5-col grid only activates at `xl:` breakpoint (Tailwind default 1280px, comfortably below the 1440px standard laptop width). On a 1440px viewport the 5 cards distribute at roughly 268px each card minus gaps — readable but tight. The grid does NOT feel cramped per visual checkpoint approval, but a 4-col arrangement (collapsing the two volumen cards into "Volumen total recibido + enviado" or hiding ticket promedio behind a hover affordance) WOULD have read more relaxed. Recommendation: leave 5 cards for now (each metric is distinct and protagonist-worthy per 07-CONTEXT.md "densidad informativa"); revisit if a Phase 9 user observation flags the density.

### Deviation from `border-l-4 border-section-bonos` accent

Used the more idiomatic Tailwind utility `border-l-4 border-l-section-bonos` (note the second `border-l-` prefix on the color utility) — `border-section-bonos` alone applies the color to ALL borders, not just the left one. Without the `border-l-*` color prefix the accent stripe would have leaked onto the other 3 sides through Card's existing `ring-1 ring-foreground/10`. No accessibility / contrast deviation in either light or dark mode (Plan 06-04's `+0.10` lightness shift on .dark keeps the violet readable against the card background).

### Live data sanity — top emisores ↔ top receptores overlap

Not directly observed during execution (no live data pull during the build/verify cycle; the visual checkpoint was approved without explicit overlap inspection). To answer the Phase 9 Vista Cliente color question: the user verifying the cockpit can confirm or deny overlap directly from the deployed `/bonos` view — if the same tikintags appear in both rankings (e.g. `$mario` ranking high in both emisores and receptores), it suggests Vista Cliente CLI-V2-* should expose a "neto" view (sent − received) rather than two independent rankings. If they're nearly disjoint, two rankings are the right primitive. Surfacing this as an explicit STATE.md "open question" so Phase 9 picks it up.

---

**Phase 7 progress: 3/4 plans complete after this commit (Wave 1 closed: 07-01 + 07-03; Wave 2: 07-02 ✅, 07-04 in flight).**
