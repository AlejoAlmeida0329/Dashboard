---
phase: 03-payouts
plan: 03
subsystem: ui
tags: [react, recharts, server-components, client-components, shadcn, format-helpers, latency-percentiles, presenter-mode]

requires:
  - phase: 03-payouts
    provides: "Plan 03-02 — payouts.ts pure-module aggregations + 5 stable output type interfaces (PayoutSummary, LatencyBucket, BancoStats, TopBancos, SuccessRate)"
  - phase: 02-bonos
    provides: "Plan 02-03 — component conventions: 'use client' only on chart, stroke=currentColor + tailwind tokens (no hex), data-presenter-hide CSS contract from Plan 01-03"
  - phase: 01-foundation
    provides: "Plan 01-03 — format.ts single Intl gate, presenter mode CSS contract"

provides:
  - "src/lib/format.ts: formatDuration(seconds) helper — pure JS H:MM:SS formatter (no Intl, no day rollover)"
  - "src/components/payouts/PayoutsKPICards.tsx: 5-card hero grid (count, $ volumen, P50, P95, success rate)"
  - "src/components/payouts/TopBancos.tsx: Server Component top N bank rows + Otros bancos rollup (replaces planned DestinationSplit.tsx)"
  - "src/components/payouts/LatencyHistogram.tsx: Client Component Recharts BarChart (single-series, 4 fixed buckets, minPointSize for zero-bar safety)"
  - "Component conventions established: HH:MM:SS via font-mono + tabular-nums; hero KPIs always visible; only Tikin-internal KPIs (revenue, success rate) carry data-presenter-hide"

affects: ["03-04 (Payouts page composition consumes these 3 components verbatim)", "04 (Recargas — same conventions for time-to-credit + success-rate KPIs if Tikin adds them)"]

tech-stack:
  added: []  # Zero new dependencies — recharts already installed by Plan 02-03
  patterns:
    - "Hero metric format: font-mono + tabular-nums for digit alignment in HH:MM:SS"
    - "Single-series BarChart with minPointSize for zero-bucket visibility"
    - "Server Component for static lists (TopBancos rows); Client Component reserved for chart leaves needing DOM (Recharts ResponsiveContainer)"
    - "displayBancoName helper as a private file-level pure function for code-to-display mapping (extends easily to per-bank override map if Tikin requests)"

key-files:
  created:
    - "src/components/payouts/PayoutsKPICards.tsx"
    - "src/components/payouts/TopBancos.tsx"
    - "src/components/payouts/LatencyHistogram.tsx"
  modified:
    - "src/lib/format.ts (added formatDuration export)"

key-decisions:
  - "formatDuration is pure JS (no Intl) — colon convention is locale-invariant"
  - "No day rollover: 90061s renders as '25:01:01', not '1d 1:01:01' (ops-friendly continuous hours)"
  - "P50/P95 cards use font-mono for digit alignment across cards (mirrors HH:MM:SS terminal/ops dashboard reading)"
  - "5-card lg:grid-cols-5 layout for KPIs (count, $, P50, P95, success-rate); stacks 2-col then 1-col on smaller widths"
  - "Only success-rate card carries data-presenter-hide — same pattern as Bonos's 'Comisión total' (revenue/quality metrics are Tikin-internal)"
  - "TopBancos is ALWAYS visible (no presenter-hide) — at cliente-foco view the URL filter narrows data to that empresa's banks; not a leak"
  - "DestinationSplit.tsx is NOT created — replaced by TopBancos at real granularity (12 bank codes vs the planned tarjeta/banco binary that doesn't exist in production data)"
  - "LatencyHistogram is single-series (no medium stack) — all production payouts are bank, a stack would show one color and zeros"
  - "minPointSize={2} on the Bar — keeps zero-count buckets visible (Recharts hides zero-height bars by default)"

patterns-established:
  - "Hero technical KPIs use font-mono + tabular-nums for cross-card digit alignment — reusable for Phase 4 Recargas time-to-credit if added"
  - "Visibility convention: hero KPIs always visible; only revenue/internal-quality KPIs carry data-presenter-hide"
  - "Single Intl gate convention extends to Phase 3: zero new Intl callsites in src/components/payouts/"

duration: 6m 8s
completed: 2026-05-04
---

# Phase 3 Plan 3: Payouts Visual Components Summary

**3 React leaves (KPI cards, latency histogram, top-bancos widget) + formatDuration helper, type-safe against Plan 03-02's stable output interfaces, ready for Plan 03-04 page composition**

## Performance

- **Duration:** 6m 8s
- **Started:** 2026-05-04T15:10:19Z
- **Completed:** 2026-05-04T15:16:27Z
- **Tasks:** 2 (both atomic commits)
- **Files modified:** 4 (1 modified, 3 created)

## Accomplishments

- `formatDuration` added to the single-Intl-gate `format.ts` — pure JS, locale-invariant, fixture-verified against 9 cases (boundary 720s, NaN/null/undefined, negative, large 90061s, zero)
- `PayoutsKPICards.tsx` ships the 5-card hero grid with HH:MM:SS P50/P95 in `font-mono + tabular-nums` so digits line up across cards (the "incuestionable" reading from CONTEXT.md)
- `TopBancos.tsx` ships the destination story at real granularity — top N bank rows + "Otros bancos" rollup row — replacing the originally-planned `DestinationSplit.tsx` (which would have been a tarjeta=0/banco=100% degenerate widget per Plan 03-01 findings)
- `LatencyHistogram.tsx` ships a single-series Recharts BarChart with `minPointSize={2}` so the eventual zero-count buckets stay visible — ready to tell the "la mayoría son inmediatos" story when Plan 03-04 wires real data

## Task Commits

Each task was committed atomically:

1. **Task 1: formatDuration helper + PayoutsKPICards** — `fb7c04a` (feat)
2. **Task 2: TopBancos + LatencyHistogram** — `974ca32` (feat)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified

- `src/lib/format.ts` — Added `formatDuration` export (pure JS, no Intl). Single Intl gate intact (zero new `Intl.NumberFormat` instances).
- `src/components/payouts/PayoutsKPICards.tsx` (new, 131 lines) — Server Component, 5-card grid (count, $ volumen, P50, P95 always visible; success-rate carries `data-presenter-hide`)
- `src/components/payouts/TopBancos.tsx` (new, 114 lines) — Server Component, top N bank rows + Otros rollup, ALWAYS visible. Internal `displayBancoName` helper title-cases bank codes.
- `src/components/payouts/LatencyHistogram.tsx` (new, 99 lines) — Client Component (Recharts), single-series BarChart with 4 fixed buckets, `minPointSize={2}`, `stroke="currentColor"` for theme-aware rendering

## Decisions Made

### `formatDuration` design

- **Pure JS, no Intl.** The colon convention (H:MM:SS) is locale-invariant — French, Spanish, English all use the same digits and separators in this format. Pulling in `Intl.DurationFormat` would add browser-support uneven (Safari 18.4+) and `Intl.RelativeTimeFormat` produces locale-text like "12 minutes ago" / "hace 12 minutos" which clashes with the "técnico/compacto" CONTEXT.md decision.
- **No day rollover.** `formatDuration(90061)` returns `'25:01:01'` instead of `'1d 1:01:01'`. Continuous hours map to ops-dashboard reading conventions (terminal logs, monitoring tools, latency dashboards) and avoid mixing units. The `<24h` Recharts bucket already separates the "fast" cases visually; the duration helper just renders raw seconds.
- **Edge cases:** `null`/`undefined`/`NaN`/`Infinity`/`<0` → `'—'` (em dash, our standard "no data" marker, same as `formatCOP`/`formatInteger`/`formatPercent`).
- **Floor semantics:** `Math.floor(seconds)` discards fractional seconds without rounding. Plan 03-02's `quantileSorted` can return values like `6840.5` — flooring keeps the displayed string honest (we have at least 6840s = 1:54:00 of latency, even if exact bound is 6840.5s).

### KPI grid layout

- **5-card `lg:grid-cols-5` row.** All 5 cards land in one horizontal row at desktop/widescreen (≥1024px). At tablet (640-1024px) we drop to 2-col (which gives count+$, P50+P95, success-rate alone wrapping). On mobile we stack 1-col. Tailwind's progressive enhancement covers the common ranges.
- **Hero typography for P50/P95:** `font-mono text-3xl tabular-nums`. Mono ensures `0:12:04` and `2:31:18` digits align across cards. `tabular-nums` ensures equal-width digits within proportional fonts (paranoid double-belt-and-suspenders since `font-mono` already implies fixed-width — but cheap insurance and consistent with Bonos KPI styling from Plan 02-03).
- **Empty-state copy:** `count === 0` → "Sin payouts en el período seleccionado". `count > 0` → "En el período". Avoids showing meaningless zero-derived values without context.

### TopBancos layout

- **Single Card with row list.** Mirror of `Leaderboard.tsx` shape from Plan 02-03 — list of items with primary text on left, stats on right. `<ul className="divide-y divide-border">` adds row separators without explicit borders.
- **Per-row stats:** count, $ volumen, P50, P95. Wrapped at `sm` breakpoint so on mobile the bank name lands on row 1 and stats wrap below.
- **Otros bancos row appears only if count > 0.** Plan 03-02's aggregator emits a zero-placeholder when there are ≤ N total banks; we hide that row visually so the widget doesn't show an empty footer line.
- **`displayBancoName` helper** title-cases codes:
  - `bancolombia` → `Bancolombia`
  - `banco_de_bogota` → `Banco De Bogota`
  - `OTRO_MEDIUM` → `Sin medio` (the Plan 03-01 fallback constant)
  - `Otros bancos` → unchanged (already display-ready, matches Plan 03-02's literal string)
- **NOT presenter-hidden.** Per user's 2026-05-04 decision: at cliente-foco view (`?empresa=$X&presenter=1`) the URL filter narrows data to that empresa's payouts, so showing their banks tells the cliente "where your money goes" — no information leak.

### LatencyHistogram conventions

- **Single Bar series.** `LatencyBucket` from Plan 03-02 is `{bucket, count}` (no medium dimension). Stacking by medium would show one color (bank) and zeros for tarjeta — visually misleading.
- **`minPointSize={2}` keeps zero-count bars visible.** Recharts hides zero-height bars by default; for a stable-shape 4-bucket histogram, that would mask "we had 0 in this bucket" as "this bucket doesn't exist". 2 pixels is enough to see a tiny stub without misrepresenting the count.
- **`stroke="currentColor"` + `fill="currentColor"`.** Mirror of `BonosChart.tsx` from Plan 02-03 — chart respects theme via the parent's `text-foreground` token. Theme switches don't touch this file.
- **No `<Card>` wrapper.** Plan 03-04's `payouts/page.tsx` provides Card chrome (mirroring how `bonos/page.tsx` wraps `BonosChart`). Keeps the chart leaf reusable in different chrome.
- **No `<Legend>`.** Only one series; legend would be visual noise.
- **`allowDecimals={false}` on YAxis.** Counts are integers; preventing `1.5` ticks on small datasets keeps the axis honest.

### Visibility contract

- `data-presenter-hide` on success-rate card ONLY. Tikin-internal quality metric (same logic as Bonos "Comisión total" from Plan 02-03 = Tikin revenue).
- KPIs (count, $ volumen, P50, P95) + LatencyHistogram + TopBancos = all visible in BOTH internal AND presenter modes. The cliente-foco transformation comes from the URL `empresa` filter narrowing the data feed, NOT from hiding components.

## Deviations from Plan

None — plan executed exactly as written.

The plan's literal `<action>` blocks compiled clean on first build; every grep-style `<verify>` check passed. Minor presentation interpretations (e.g. line-counts, exact JSX shape of `BancoRow`) were within the plan's spirit and explicitly delegated by phrases like "flex with bank name on left, stats on right".

**Total deviations:** 0
**Impact on plan:** Pure execution. Phase 3 Plan 3 followed the deterministic-execute pattern from Plan 03-02 — heavy upfront pre-work in plan-author phase (literal code blocks, fixture-verified expected outputs cited inline, scope adjustment pre-resolved from 03-01 findings, output type contracts already stable from 03-02) translated to a 6-minute mechanical execute.

## Issues Encountered

None.

The dev-server smoke test (live `/api/payouts-smoke` via `curl`) was deferred because the auth gate uses Next.js Server Actions (which require a CSRF-shaped multipart POST, not a simple `password=...` form post). Regression-free status is structurally guaranteed instead:
- Zero modifications to `src/lib/sheets/`, `src/lib/domain/payouts.ts`, or `src/app/api/payouts-smoke/`
- `npm run build` compiled cleanly with full TypeScript type-checking across the dependency graph
- `npm run lint` 0 errors
- 4 pre-existing routes (`/bonos`, `/inicio`, `/payouts`, `/api/payouts-smoke`) still in build manifest

## User Setup Required

None — no external service configuration. Phase 3 is internal-only UI work.

## Next Phase Readiness

### Ready for Plan 03-04 (Payouts page composition)

- 3 components shipped, all type-safe against Plan 03-02's stable output types (`PayoutSummary`, `LatencyBucket`, `BancoStats`, `TopBancos`, `SuccessRate`)
- All format conventions established (HH:MM:SS via `formatDuration`, COP via `formatCOP`, % via `formatPercent`, integers via `formatInteger`)
- Visibility contract clean: only success-rate card has `data-presenter-hide`
- Plan 03-04 work scope: assemble `payouts/page.tsx` consuming these components + run the `transactionId → empresa_id` join from BD_Plataforma when `filters.empresa` is set (Plan 03-02 design recommendation, surfaced in 03-02-SUMMARY.md "Recommended call shape")

### No new blockers

The single component-level concern that could surface in Plan 03-04 visual checking is the histogram's `minPointSize={2}` decision: if real data shows a 4:0:0:0 distribution (everything `<1h`), the empty buckets will render as 2-pixel stubs that some viewers might read as "tiny but non-zero counts". If that happens, two mitigations exist:
- Drop `minPointSize` and accept that empty buckets visually disappear (Recharts default)
- Add a tooltip-only "(0 payouts)" hint on hover

Both are 1-line edits to `LatencyHistogram.tsx`. Defer until Plan 03-04 visual QA tells us which problem (if any) is real.

### Component conventions established for Phase 4+

- Hero technical metrics (latencies, durations, time-to-X) use `font-mono` + `tabular-nums` for digit alignment — reusable for Phase 4 Recargas if it adds time-to-credit KPIs
- Single Intl gate convention holds across all 3 new components — zero new `Intl.NumberFormat` callsites
- Visibility contract: hero KPIs always visible, only revenue/internal-quality KPIs carry `data-presenter-hide`

---
*Phase: 03-payouts*
*Completed: 2026-05-04*
