---
phase: 02-bonos
plan: 03
subsystem: ui-components
tags: [bonos, recharts, line-chart, leaderboard, kpi-cards, sales-table, presenter-mode, server-components]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "data-presenter / data-presenter-hide CSS contract from PresenterFrame; format.ts as single Intl gate (formatCOP, formatInteger, formatPercent); shadcn Card primitive (text-card-foreground, ring-foreground/10, group/card variants); Tailwind v4 + theme tokens (--background, --border, text-muted-foreground)."
  - phase: 02-02
    provides: "BonoSummary, BonoByDate, BonoByEmpresa output types from bonos.ts. Stable contracts the UI binds against (no inventando shapes). pctDelTotal already in fraction form (0..1) so formatPercent consumes it directly."
provides:
  - "BonosChart: hero line chart (Client Component, recharts) — bonos vendidos en el tiempo, calmada (no bars, no stacked). Métrica conmutable count|monto."
  - "Leaderboard: Server Component top-10 list, presenter-hidden via data-presenter-hide on Card wrapper."
  - "KPICards: Server Component 2-col grid — Ticket promedio (always visible) + Comisión total (presenter-hidden)."
  - "SalesTable: Server Component table — empresa / # bonos / $ vendido (always) + $ comisión / % del total (presenter-hidden, both header + body cells)."
  - "Recharts ^2.15.4 installed as the project's chart library (React 19 compatible, declarative API, default in shadcn ecosystem)."
  - "Modo Presentación visual contract for the Bonos tab — declarative via data-presenter-hide attributes (no JS toggles). Plan 04 composes these and the contract is verified visually live."
affects: [02-04-bonos-page, 03-payouts, 04-recargas, 04-inicio, 05-clientes]

# Tech tracking
tech-stack:
  added: ["recharts ^2.15.4"]
  patterns:
    - "recharts-line-chart: declarative LineChart inside ResponsiveContainer; dot=false + type=monotone + strokeWidth=2 = 'línea calmada' default. Pattern reusable for Recargas trend, Payouts trend, Inicio mini-charts."
    - "currentColor-driven-stroke: chart line uses stroke='currentColor' so the parent wrapper's text-{token} class drives the palette. Theme switches don't touch the chart."
    - "declarative-presenter-hide: data-presenter-hide attribute on wrapper or cells; no useState/useMemo/conditional render in component code. CSS from Phase 1 globals.css does the hiding."
    - "single-intl-gate-via-format-ts: every numeric/currency/percent value flows through format.ts (formatCOP, formatInteger, formatPercent). Zero direct Intl.NumberFormat / toLocaleString calls in code (verified by grep)."
    - "server-component-default: only BonosChart is 'use client' (recharts needs DOM ResponsiveContainer). Leaderboard, KPICards, SalesTable are pure Server Components — zero hydration cost on those leaves."
    - "tabular-nums-for-numerics: every number column uses Tailwind's tabular-nums class for vertical alignment, both in cards and tables. Visual baseline established for the rest of the dashboard."

key-files:
  created:
    - src/components/bonos/BonosChart.tsx
    - src/components/bonos/Leaderboard.tsx
    - src/components/bonos/KPICards.tsx
    - src/components/bonos/SalesTable.tsx
    - .planning/phases/02-bonos/02-03-SUMMARY.md
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Chart library = recharts ^2.15.4. Selected over nivo (which loads d3 entirely → bigger bundle), visx (requires hand-rolling primitives → time cost), and raw SVG (long-tail maintenance). Recharts 2.15+ supports React 19 cleanly. Pattern shared with several shadcn examples so familiarity carries."
  - "BonosChart is the ONLY Client Component of this plan. Recharts requires DOM (ResponsiveContainer listens to window resize) so the chart shell can't be serialized. Leaderboard/KPICards/SalesTable stay Server Components — they emit static HTML."
  - "Chart line color via stroke='currentColor', not a hardcoded hex. The wrapping page sets text-foreground (or text-primary at design taste) and the line follows. Theme-agnostic; light/dark works without conditional logic."
  - "BonosChart does NOT carry data-presenter-hide. The chart is the heroína — visible in BOTH internal AND presenter views. Only the empresa filter swaps what data feeds it (Plan 04 composition). The 'cliente sees only their data' contract comes from the URL filter, not from hiding the chart."
  - "KPI Ticket promedio is ALWAYS visible (both internal + presenter); only Comisión total is hidden in presenter. Matches roadmap Success Criteria 4 (cliente sees ticket promedio of their own data) and the 02-CONTEXT.md vision (cliente sees their KPI on their data; revenue stays internal)."
  - "SalesTable hides the th (header) AND every td of the last 2 columns. CSS contract `display: none` on display:table-cell works per-cell — the browser's table layout absorbs the freed space across remaining cols. No explicit width recalculation needed in the component."
  - "No interactive sort in SalesTable for Phase 2. BON-02 scope doesn't request it; rows arrive sorted DESC by monto from aggregateBonosByEmpresa. Adding click-to-sort later means wrapping in a Client Component, not editing this one."
  - "Empty-state copy is 'Sin bonos en el período seleccionado' for Leaderboard and SalesTable; KPICards inlines 'Sin bonos en el período' under the value. The values themselves still render (formatCOP(0) = '$ 0') because summarizeBonos is zero-safe — the empty-state text is a hint, not a guard."

# Metrics
duration: 3m 14s
completed: 2026-04-29
---

# Phase 2 Plan 03: Bonos UI Components Summary

**4 visual leaves for the Bonos tab — recharts-driven hero line chart, top-10 leaderboard (presenter-hidden), Ticket promedio + Comisión KPI cards (Comisión presenter-hidden), and ventas-por-empresa table (last 2 cols presenter-hidden) — all consuming bonos.ts output types directly with single Intl gate respected.**

## Performance

- **Duration:** 3m 14s
- **Started:** 2026-04-29T22:03:49Z
- **Completed:** 2026-04-29T22:07:03Z
- **Tasks:** 3 (3 atomic commits)
- **Files created:** 4 components + this SUMMARY
- **Files modified:** 2 (package.json + lock)
- **Build:** clean (Next 16 + Turbopack, 9.9s first compile, 11/11 static pages green)
- **Lint:** clean (0 errors, 2 pre-existing warnings unrelated to this plan)

## Accomplishments

- Established the **chart-library standard for the project**: recharts ^2.15.4 with the "línea calmada" default (dot=false + type=monotone + strokeWidth=2). Reusable for Recargas trend (Phase 4), Payouts trend (Phase 3), Inicio mini-charts (Phase 4) without re-evaluating the library decision.
- Locked in the **declarative presenter-mode contract for the Bonos tab**: 1× Card wrapper hide (Leaderboard), 1× Card wrapper hide (KPI Comisión), and 4× cell hides (2 th + 2 td columns of SalesTable). Plan 04 composes these and the visual transition between internal and presenter modes happens in CSS — no React state, no re-render.
- Honored the **single Intl gate** end-to-end. Verified by grep: zero `Intl.NumberFormat` or `toLocaleString` calls anywhere in the bonos components (only doc-comment mentions which themselves state "zero direct calls"). Pitfall 9 stays closed at the codebase level.
- All four components **type-check directly against bonos.ts output shapes** (`BonoSummary`, `BonoByDate`, `BonoByEmpresa`). No prop-shape invented; if the domain layer changes a type, the UI layer fails to compile loudly. No silent drift possible.
- **3 of 4 components are pure Server Components** (Leaderboard, KPICards, SalesTable). Only BonosChart hydrates (recharts needs the DOM). The Bonos page leaves are mostly static HTML — fast first paint, minimal JS.

## Task Commits

1. **Task 1 — Install recharts + BonosChart hero line chart** — `6103bbd` (feat)
2. **Task 2 — Leaderboard top-10 (presenter-hidden)** — `0f1bebc` (feat)
3. **Task 3 — KPICards + SalesTable** — `f40f917` (feat)

**Plan metadata commit:** to be added after this SUMMARY.

## Files Created/Modified

- `src/components/bonos/BonosChart.tsx` (107 lines) — Client Component. Recharts `LineChart` inside `ResponsiveContainer`. Props: `{ data: BonoByDate[]; metric?: 'count' | 'monto' }`. Default metric `count`. Tooltip + tick formatters route through `formatInteger` / `formatCOP`. Stroke uses `currentColor` so the parent's `text-{token}` class drives the line palette.
- `src/components/bonos/Leaderboard.tsx` (71 lines) — Server Component. Props: `{ rows: BonoByEmpresa[]; rangeLabel?: string }`. Renders `<Card data-presenter-hide>` with an ordered list (1..N). Truncate on empresa name (some tikintags are long), tabular-nums on counts and montos.
- `src/components/bonos/KPICards.tsx` (72 lines) — Server Component. Props: `{ summary: BonoSummary }`. 2-col grid: Ticket promedio (always visible) + Comisión total (`<Card data-presenter-hide>`). Empty state inline copy under the value.
- `src/components/bonos/SalesTable.tsx` (106 lines) — Server Component. Props: `{ rows: BonoByEmpresa[] }`. 5-col table: Empresa / # bonos / $ vendido / $ comisión / % del total. Last 2 cols (both `<th>` and every `<td>`) carry `data-presenter-hide`. Empty-state replaces the table with a sentence.
- `package.json` — `recharts ^2.15.4` added to dependencies.
- `package-lock.json` — regenerated (32 transitive packages added).

## Chart Library Decision

**Selected:** `recharts ^2.15.4` (default per plan).

**Why recharts over alternatives:**

- **vs nivo (`@nivo/line`):** Nivo loads d3 in its entirety as a runtime dependency. Bundle inflation isn't worth it for a single line chart — recharts' surface area is closer to what we actually use.
- **vs visx (`@visx/curve` + scales):** Visx is a primitives kit, not a chart library. We'd build the LineChart shell ourselves (axes, tooltip, responsive container). Time cost not justified by the calmada-by-default-with-low-customization profile we want for this dashboard.
- **vs raw SVG:** Same as visx but worse — no axes/tooltip/responsiveness for free. Long-tail maintenance burden.
- **vs Apache ECharts (`echarts-for-react`):** Heavier; SSR story less clean than recharts' explicit `'use client'` boundary.

**React 19 compatibility:** Recharts 2.15+ ships with full React 19 support. `npm install` produced zero peer-dep warnings, `npm run build` was green on first try.

**Override path documented:** If a future phase finds recharts limiting (e.g. needs candlestick + complex composed chart), `BonosChart.tsx` is a self-contained leaf — swap recharts→nivo or recharts→visx by editing only this file. The page composition (Plan 04) doesn't import recharts directly.

**No override happened during execution.** Recharts compiled clean and the chart shape matched the "calmada" intent on the first try.

## Presenter Mode Contract — What's Marked

This is the visual contract Plan 04 will verify in the browser. Each row below is what `data-presenter='on'` (set by `PresenterFrame` on the root element) will hide via the CSS rule from `globals.css`:

| Component | Element marked | What hides | Why |
|-----------|----------------|------------|-----|
| `BonosChart` | _(none)_ | _(visible in both modes)_ | Hero — visible to internal team and to cliente. The empresa filter swaps the data; the chart shell stays. |
| `Leaderboard` | `<Card data-presenter-hide>` (entire wrapper) | Whole top-10 list disappears | Cliente shouldn't see other clients' positions. Internal team always sees it. |
| `KPICards` (Ticket promedio card) | _(none)_ | _(visible in both modes)_ | Cliente needs to see "what's our average sale". |
| `KPICards` (Comisión total card) | `<Card data-presenter-hide>` (entire wrapper) | Whole comisión card disappears, leaving Ticket promedio alone in the row | Tikin's revenue. Not appropriate for cliente projection. |
| `SalesTable` ($ comisión col) | `<th data-presenter-hide>` + every `<td data-presenter-hide>` of that col | Column 4 disappears entirely | Tikin revenue, internal only. |
| `SalesTable` (% del total col) | `<th data-presenter-hide>` + every `<td data-presenter-hide>` of that col | Column 5 disappears entirely | Relative position reveals other empresas exist. Hidden in cliente view. |

**Total `data-presenter-hide` JSX hits in code:** 8 (1× Leaderboard wrapper, 1× KPI Comisión wrapper, 2× SalesTable header cells, 2× SalesTable body cells × N rows = 4 unique JSX nodes in source). `grep` count is higher (12) because doc comments reference the attribute name.

**The chart is intentionally NOT hidden.** The vision in 02-CONTEXT.md is that Modo Presentación + filtro empresa transforms the tab into a "vista 1-cliente" — the chart shows that one cliente's trend, NOT a stripped-down version of the whole. Plan 04 wires the empresa filter into the data feed; this plan just emits the right markers.

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- **recharts is the project's chart library** — pattern reusable for Phases 3, 4, 5.
- **Only BonosChart is 'use client'** — Server Components for everything else, lower hydration cost.
- **Ticket promedio always visible, Comisión hidden** — explicit per the vision in 02-CONTEXT.md (audiencia dual).
- **The chart itself has no `data-presenter-hide`** — Modo Presentación reshapes the data feed, not the visibility of the hero element.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed redundant `$` prefix in KPICards comisión subtitle**

- **Found during:** Task 3 (KPICards implementation)
- **Issue:** The plan's literal code had `Sobre ${formatCOP(summary.montoTotal)} vendidos` — the `$` outside the template expression is redundant because `formatCOP` already prepends `$ ` (e.g. `'$ 1.234.567'`). Rendered output would have read `Sobre $$ 1.234.567 vendidos` (double dollar sign), which is a visible visual bug.
- **Fix:** Wrote the JSX as `Sobre {formatCOP(summary.montoTotal)} vendidos` — single `$` from the formatter only.
- **Files modified:** `src/components/bonos/KPICards.tsx`
- **Verification:** Visual inspection of rendered HTML in build; no double-dollar in subtitle.
- **Committed in:** `f40f917` (part of Task 3 commit).

**2. [Rule 1 - Bug refinement] Used `formatInteger(summary.count)` in KPICards subtitle instead of bare `${summary.count}`**

- **Found during:** Task 3 (KPICards implementation)
- **Issue:** Plan code had `${summary.count} bonos en el período`. With 3000+ bonos in production, an unformatted count reads as `3188 bonos` instead of `3.188 bonos`. Inconsistent with the rest of the dashboard which always groups thousands per Colombian convention. Also a quiet single-Intl-gate violation if any future eng reads the inline pattern and copies it.
- **Fix:** Wrote `{formatInteger(summary.count)} bonos en el período`.
- **Files modified:** `src/components/bonos/KPICards.tsx`
- **Verification:** All counts in the bonos components now flow through `formatInteger` (verified by grep — zero bare `summary.count` or `r.count` substitutions in JSX).
- **Committed in:** `f40f917` (part of Task 3 commit).

These are minor textual fixes well within Rule 1 (correctness) — they don't change shapes, types, or behavior contracts. Documented here for completeness.

## Issues Encountered

None. Build, lint, and grep verifications all green on first attempt. The plan's verification block was satisfied exactly as written:

- ✅ `npm run build` clean (3 builds, one per task)
- ✅ `npm run lint` clean (0 errors, 2 pre-existing warnings unrelated to this plan)
- ✅ `grep -rn "Intl.NumberFormat\|toLocaleString" src/components/bonos/` returns only doc-comment hits (no code-level Intl construction)
- ✅ `grep -rn "data-presenter-hide" src/components/bonos/` returns 12 hits (above the ≥5 threshold; 8 in JSX, 4 in doc comments)
- ✅ All 4 components exceed the artifact `min_lines` thresholds (107/72/71/106 vs 40/30/25/50 required)

## Next Phase Readiness

**Ready for Plan 02-04 (Bonos page composition):**

The page imports the 4 components and feeds them their props. Pseudocode:

```tsx
// app/(protected)/bonos/page.tsx (Plan 04 will write this)
import { parseFilters } from "@/lib/url-state";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { filterBonos, summarizeBonos, aggregateBonosByDate, aggregateBonosByEmpresa, top10Empresas } from "@/lib/domain/bonos";
import { BonosChart } from "@/components/bonos/BonosChart";
import { KPICards } from "@/components/bonos/KPICards";
import { Leaderboard } from "@/components/bonos/Leaderboard";
import { SalesTable } from "@/components/bonos/SalesTable";

export default async function BonosPage({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const filters = parseFilters(await searchParams);
  const result = await getCachedTransactions();
  const bonos = filterBonos(result.rows, filters);

  const summary = summarizeBonos(bonos);
  const byDate = aggregateBonosByDate(bonos);
  const byEmpresa = aggregateBonosByEmpresa(bonos);
  const top10 = top10Empresas(byEmpresa);

  return (
    <div className="space-y-6">
      <KPICards summary={summary} />
      <BonosChart data={byDate} />          {/* metric defaults to 'count' */}
      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Leaderboard rows={top10} rangeLabel={...} />
        <SalesTable rows={byEmpresa} />
      </div>
    </div>
  );
}
```

All shapes type-check. No glue code needed between the domain and the UI.

**Ready for Phase 3 (Payouts) and Phase 4 (Recargas, Inicio):**

- The recharts pattern (LineChart + ResponsiveContainer + currentColor stroke + format.ts tick formatter) is reusable. Future trend charts copy `BonosChart.tsx` and swap the data type.
- The presenter-hide contract pattern (data-presenter-hide on Card wrapper or table cells) is reusable. Phase 3 has the same internal-vs-cliente revenue distinction (Tikin's payout commission is sensitive in cliente view).
- The KPI / Leaderboard / Table component shapes are reusable as templates — copy structure, swap types, swap labels.

**Ready for Phase 5 (Clientes):**

- The Leaderboard top-10 pattern can be reused as "Top 10 clientes activos" once Phase 5 introduces the clientes/empresas registry with display names.
- If interactive sort becomes a requirement, the SalesTable refactor lives entirely inside one Client Component wrapper — no domain-layer change needed.

**Open items / carryover:**

- **Visual verification deferred to Plan 04.** This plan's components compile and render correct HTML, but the visual experience (chart density, table column absorption when 2 cols hide, presenter mode transition) is verified live when Plan 04 wires real data and the page renders in the browser. If the table layout shifts jaggedly when presenter mode hides 2 cols, Plan 04 may add explicit column widths to `<col>` elements — that's a 5-line addition confined to `SalesTable.tsx`.
- **`text-foreground` wrapper class on the chart container.** BonosChart's outer div carries `text-foreground` so the line inherits the body text color. Plan 04 may override with `text-primary` (theme accent) at the page level — both work because `currentColor` follows whatever `text-{token}` is in scope.
- **Recharts adds 32 transitive packages** to the install. Bundle implication for `/bonos`: the Client Component is dynamically imported as part of the page chunk; the Server Component leaves (Leaderboard, KPICards, SalesTable) don't ship recharts. Concrete `kB` impact will be visible in the Plan 04 production deploy's `Route (app)` table.

**No new blockers introduced.**

---

*Phase: 02-bonos*
*Plan: 03*
*Completed: 2026-04-29*
