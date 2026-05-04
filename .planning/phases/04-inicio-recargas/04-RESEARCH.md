# Phase 4: Inicio + Recargas — Research

**Researched:** 2026-05-04
**Domain:** Editorial dashboard tab composition over already-cached Sheets data; delta-vs-prior-period KPIs; Recharts trend charts; "first-time activation" cohort detection
**Confidence:** HIGH on stack reuse and patterns already proven in Phases 1–3; MEDIUM on delta-period semantics for irregular custom ranges; MEDIUM on bucket-granularity heuristic (one defensible default plus an explicit punt to plan-author).

## Summary

The stack is fully closed and Phase 4 introduces ZERO new libraries. Recharts (`^2.15.4`) is already battle-tested in this codebase via `BonosChart.tsx` (LineChart) and `LatencyHistogram.tsx` (BarChart) with the established pattern: `stroke="currentColor"` + `formatX` from `lib/format.ts` + Card chrome at the page level. The shadcn `chart` component primitive is **deliberately not installed** (verified: `src/components/ui/` has no `chart.tsx`); the codebase composes Recharts directly. Phase 4 must preserve this convention — **do not** run `npx shadcn@latest add chart` to introduce `ChartContainer` / `ChartConfig` because (a) it adds a hidden surface ("chart system" theme tokens) the project doesn't own, and (b) the latest shadcn chart wrapper is Recharts v3 oriented while this codebase pins v2.

The genuinely-new surface is three-fold:

1. **Delta logic** = "same window size, immediately previous." Computed from `filters.from`/`filters.to` by measuring the active range length in days (Bogotá-anchored), then subtracting that span from `from` to derive `priorFrom`/`priorTo`. The math is local and pure — no library beyond `date-fns` already in `package.json`. Zero-safe percent-change formula matches the `pctDelTotal` convention from `bonos.ts` line 286.

2. **Hechos curados** are derived from the same `Transaction[]` already loaded by `getCachedTransactions()` (React `cache()`-deduped per request — see `lib/sheets/transactions.ts:166`). "Empresas nuevas activadas" requires a single O(N) pass over the FULL dataset (3188 rows, in-memory) to build `firstTxByEmpresa: Map<empresa_id, Date>`, then filter to those whose first-ever falls inside the active window. **No second fetch is needed.** Cost: ~3188 iterations + map allocations, well under 5ms — verified pattern matches `getEmpresaRegistry`'s O(N) sweep in `domain/empresas.ts:54`.

3. **Bucket granularity** (day vs week) for the GMV trend chart: defer the autoswitch heuristic to the plan-author with a clear default — DAILY when the active range ≤ 60 days, WEEKLY when > 60 days. This matches Stripe Dashboard's adaptive behavior and is implementable as a single `if`-branch in the page composition (no Recharts feature switch — the chart receives pre-aggregated points).

**Primary recommendation:** Mirror the Phase 3 page-composition shape (`payouts/page.tsx:92-189`) exactly. Add ONE new domain module (`src/lib/domain/inicio.ts`) for cross-cutting aggregations (GMV summary, empresas activas in time, empresas nuevas, top empresa, GMV by date+week) and ONE for recargas (`src/lib/domain/recargas.ts` paralleling `bonos.ts`). Delta computation lives ONCE in `inicio.ts` as a generic `computePriorPeriod(filters)` helper that returns `{ from, to } | null` (null when no `from` is set) and is consumed by both pages.

## Standard Stack

The libraries below are ALREADY installed and verified in the codebase. **Phase 4 adds nothing.** Versions are pinned in `package.json` (verified 2026-05-04).

### Core (already installed, already used)

| Library                  | Version    | Purpose in Phase 4                                                           | Why standard here                                                                                                          |
|--------------------------|------------|------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `next`                   | 16.2.4     | App Router page.tsx + Server Components for `/inicio` and `/recargas`        | Already the project base; `dynamic = "force-dynamic"` per-page is established (see `payouts/page.tsx:85`).                 |
| `react`                  | 19.2.4     | Server Components default, leaf charts as `"use client"`                     | Same.                                                                                                                      |
| `recharts`               | ^2.15.4    | LineChart / BarChart for INI-06 (GMV trend) + INI-07 (Empresas activas) + REC-01 trend | Battle-tested via `BonosChart.tsx` + `LatencyHistogram.tsx`. **Recharts v2.x — do NOT upgrade to v3.x in this phase.**     |
| `date-fns`               | ^4.1.0     | `subDays`, `differenceInCalendarDays` for prior-period math                  | Already used in `url-state.ts:23`; `subDays` is imported and proven.                                                       |
| `date-fns-tz`            | ^3.2.0     | All Bogotá-anchored date math                                                | `formatInTimeZone`, `toZonedTime` already wrapped in `lib/format.ts` — DO NOT import `date-fns-tz` directly in domain modules. |
| `zod`                    | ^4.3.6     | (Indirect) — schemas for Transaction/Payout already exist                    | Phase 4 reuses `Transaction[]` and `Payout[]` shapes; no new schemas required.                                             |
| `tailwindcss` + `@tailwindcss/postcss` | ^4 | All styling, including the `data-presenter-hide` CSS contract              | Verified in `globals.css:146-152`.                                                                                         |
| `class-variance-authority` + `clsx` + `tailwind-merge` | latest | shadcn card composition                                            | Already used by `Card`.                                                                                                    |
| `lucide-react`           | ^1.11.0    | Up/down arrows for delta indicators (`ArrowUpRight`, `ArrowDownRight`, `Minus`) | Project's icon set; verified import shape works in Client Components.                                                      |

### Components (already installed)

| Component                                | Path                                          | Phase 4 use                                                |
|------------------------------------------|-----------------------------------------------|------------------------------------------------------------|
| `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription` | `src/components/ui/card.tsx`        | KPI cards + chart chrome + hechos curados containers       |
| `Skeleton`                               | `src/components/ui/skeleton.tsx`              | Optional — only if any leaf becomes async client (NOT needed in Phase 4 if Server Components do all data work) |
| `Separator`                              | `src/components/ui/separator.tsx`             | Optional — divides hechos curados from KPIs                |

### NOT installed and must NOT be installed in Phase 4

| Library / component                | Why not                                                                                                                   |
|------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `chart.tsx` shadcn primitive       | The codebase composes Recharts directly. Adding `ChartContainer`/`ChartConfig` introduces a parallel theming surface that conflicts with the existing `currentColor` + `text-foreground` pattern. Verified absent: `ls src/components/ui/` shows no `chart.tsx`. |
| Recharts v3                        | Breaking type changes (`TooltipProps<ValueType, NameType>` etc.); existing `BonosChart.tsx` and `LatencyHistogram.tsx` are written against v2.15.4 — upgrade is out of scope. |
| `numeral.js`, `accounting.js`      | `lib/format.ts` is the single Intl gate (Pitfall 9 in `format.ts:7`). Adding a number-formatting library breaks that contract. |
| `react-use`, `usehooks-ts`         | Inicio + Recargas pages are Server Components; charts that hydrate use only Recharts' own ResponsiveContainer. No client-side state hooks needed. |
| `chart.js`, `victory`, `nivo`      | Recharts is the chosen chart library; there is no scenario in Phase 4 that motivates a second one. |

### Alternatives Considered

| Instead of                                | Could Use                              | Tradeoff                                                                                                |
|-------------------------------------------|----------------------------------------|---------------------------------------------------------------------------------------------------------|
| Direct Recharts components                | shadcn `chart.tsx` wrapper             | Wrapper unifies tooltip styling and theme tokens, but the codebase already has consistent Card chrome at the page level + `currentColor` strokes. Rewriting two existing leaves to fit the wrapper exceeds Phase 4's scope. |
| Single-page SSR aggregation               | Client-side data fetch with `useSWR`   | SSR is mandatory: pages declare `dynamic = "force-dynamic"` and the entire data path is server. Client fetch would re-roundtrip Sheets per render and break empresa-filter join logic. |
| Computing delta in component              | Computing delta in `lib/domain/inicio.ts` | Domain modules are pure (no `next/`, no `react`); delta math belongs here so it's testable from scripts and reusable across `/inicio` and `/recargas`. |

**Installation:** *No installs required.* Verify with `cat package.json | grep -E "(recharts|date-fns|zod)"` — should show all three at the versions listed above.

## Architecture Patterns

### Recommended Project Structure (additions for Phase 4)

```
src/
├── lib/
│   └── domain/
│       ├── bonos.ts          # already exists
│       ├── payouts.ts        # already exists
│       ├── empresas.ts       # already exists — Phase 4 reuses for empresa registry
│       ├── inicio.ts         # NEW — GMV summary, empresas activas series, empresas nuevas, top empresa, GMV-by-bucket, prior-period helper
│       └── recargas.ts       # NEW — filterRecargas, summarizeRecargas, aggregateRecargasByDate, aggregateRecargasByEmpresa, top10
├── components/
│   ├── inicio/
│   │   ├── KPICardsInicio.tsx    # 5 KPI cards with delta. Server Component. data-presenter-hide on Comisión + Take rate.
│   │   ├── DeltaBadge.tsx         # Tiny shared atom: "+12,3%" or "−4,1%" with arrow + tabular-nums. Server Component (pure formatting).
│   │   ├── GMVTrendChart.tsx      # Client Component. Recharts BarChart with bucket-aware data shape.
│   │   ├── EmpresasActivasChart.tsx # Client Component. Recharts LineChart.
│   │   └── HechosCurados.tsx      # Server Component wrapper. data-presenter-hide on the WHOLE container (per CONTEXT.md cliente-foco contract).
│   └── recargas/
│       ├── RecargasKPICards.tsx   # 2 KPI cards with delta + tendencia chart
│       ├── RecargasTable.tsx      # Top 10 by empresa, mirroring SalesTable
│       └── HechosCuradosRecargas.tsx # Server Component. data-presenter-hide on container.
└── app/
    └── (protected)/
        ├── inicio/
        │   └── page.tsx            # Server Component composition; mirrors payouts/page.tsx structure
        └── recargas/
            └── page.tsx            # Same shape as bonos/page.tsx
```

**Key invariant:** All domain modules in `src/lib/domain/` are PURE (no `next/`, no `react`, no `lib/sheets/` imports — see `payouts.ts:9-22`). `inicio.ts` and `recargas.ts` MUST follow this convention.

### Pattern 1: Prior-Period Computation (the central new primitive)

**What:** Given the active filters, return `{ from, to }` for "the same-size window immediately before."

**When to use:** Once per page render, in the page composition. Pass the result into a SECOND set of filter+aggregate calls to compute prior-period summaries. Each KPI card receives `{ current, prior }` and computes its delta.

**Math (Bogotá-anchored, day-resolution):**

- Length = `differenceInCalendarDays(toDate, fromDate, { in: BogotaTZ }) + 1` (inclusive both ends — same convention as `filterBonos`/`filterPayouts`).
- `priorTo` = `fromDate − 1 day` in Bogotá calendar.
- `priorFrom` = `priorTo − (length − 1) days`.

**Edge cases the helper must handle:**

| Filter state                      | Prior-period output                                                                                |
|-----------------------------------|----------------------------------------------------------------------------------------------------|
| `from` and `to` both set          | Return `{ from: priorFrom, to: priorTo }` per formula above.                                       |
| Either `from` or `to` missing     | Return `null`. Pages render KPIs without delta badges. (Avoids comparing "all time" to "before all time"). |
| `from === to` (single-day filter) | length=1; `priorFrom === priorTo === fromDate − 1 day`. Valid.                                     |
| `from > to` (malformed)           | Return `null`. Caller responsibility: this should never happen in URL state (`url-state.ts` gates), but defensive. |
| Range crosses month/year boundary | Pure day arithmetic — no special case needed. "April 2026" (30d) → "March 1–30 2026" (30d), NOT "March 2026" (31d). User accepted this in CONTEXT.md spec. |

**Implementation lives in:** `src/lib/domain/inicio.ts` — see Code Examples section.

### Pattern 2: Delta Formatting (visual atom)

**What:** A reusable `DeltaBadge` Server Component that renders `+12,3%` (green/up), `−4,1%` (red/down), or `—` (no prior or no change), with `lucide-react` arrow icon + `tabular-nums` + `font-mono`.

**Zero-safe percent change:**

```ts
function pctChange(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) {
    // Prior=0: undefined growth rate. Show absolute (or em-dash). Decision: em-dash.
    return null;
  }
  return (current - prior) / prior; // fraction, consumed by formatPercent
}
```

This mirrors `bonos.ts:286` (`pctDelTotal` zero-safe pattern). The fraction is fed to `formatPercent` from `lib/format.ts:78` (single Intl gate preserved).

**Visual rules (from CONTEXT.md "tipografía mono+tabular-nums"):**
- Up: `text-emerald-600` + `ArrowUpRight` icon
- Down: `text-rose-600` + `ArrowDownRight` icon
- Flat (delta === 0): `text-muted-foreground` + `Minus` icon
- Null (no prior): render `<span className="text-muted-foreground">—</span>`

**Pitfall to avoid:** Don't use `text-green-500` / `text-red-500` directly — those don't respect dark mode well in Tailwind v4 with the project's theme. Use `emerald` / `rose` which have semantic OKLCH-friendly values across light/dark.

### Pattern 3: Five-KPI Grid with Two Hidden Cards (presenter-mode reflow)

**What:** A `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` of 5 cards where 2 (Comisión, Take rate) carry `data-presenter-hide`. In presenter mode the CSS contract collapses them via `display: none !important` (verified `globals.css:150`).

**Visual outcome of the collapse:**
- Internal view (5 visible): full row at `lg`.
- Presenter mode (3 visible): 3 cards in `lg:grid-cols-5` leaves 2 empty slot widths on the right. **This is acceptable per Phase 1's existing behavior** — verify against `PayoutsKPICards.tsx` (5 cards, 1 hidden in presenter): the 4 visible cards leave 1 empty slot at `lg`.
- Cliente-foco (`presenter=on` + `empresa=$X`): 3 visible cards (GMV, Empresas activas — degenerate to 1, Bonos vendidos), still in 5-col grid.

**Two acceptable solutions for the empty-slot problem:**

| Solution | When to use | Tradeoff |
|----------|-------------|----------|
| **(A) Accept empty slots.** Match Phase 3 pattern.    | Default. Phase 3 already does this and it reads fine — the visual rhythm is preserved. | Two empty cells at `lg` in presenter mode. Visually fine because cards are bordered. |
| **(B) Auto-flow with `lg:grid-cols-3` in presenter.** Add a CSS rule: `[data-presenter="on"] .kpi-grid { @apply lg:grid-cols-3; }` | If the user explicitly notes the empty slots feel "off" during plan-author review. | More CSS surface, more conditional reasoning, but tighter visual balance. |

**Decision for plan-author:** Default to **(A)** unless mock review explicitly flags it. Don't pre-engineer for a problem the existing project hasn't pushed back on.

**Cliente-foco "Empresas activas degenerada a 1" decision (per CONTEXT.md):** Keep the card visible showing literal "1" with the description "Tu empresa". Do NOT show the "Empresas activas en el tiempo" chart in cliente-foco — it would be a flat line at y=1. Replace it with a "Tu actividad en el tiempo" mini-chart showing the empresa's transaction count by day, OR hide the chart entirely (decision: hide via `data-presenter-hide` on the card chrome AND simultaneously detect `filters.empresa` set → show alternative chart). See Cliente-Foco Edge Cases section for full contract.

### Pattern 4: Bucket-Aware Time Series (day vs week)

**What:** When the active range is short (≤60 days), aggregate GMV by day; when longer, aggregate by ISO week (Mon-Sun, Bogotá-anchored).

**Why 60 days as threshold:** A 60-day chart at daily granularity = 60 bars, which renders comfortably on a 1280px viewport with ~20px per bar. Beyond 60 bars, individual bars become indistinguishable; switching to weekly buckets gives ~12 bars for a 90-day window.

**Implementation:** Compute the day-count once (`length` from prior-period helper); branch:

```ts
const granularity: "day" | "week" = length > 60 ? "week" : "day";
const trendData = granularity === "week"
  ? aggregateGMVByWeek(transactions)   // YYYY-Www output
  : aggregateGMVByDate(transactions);  // YYYY-MM-DD output
```

The chart leaf component receives a uniform `{ bucket: string; value: number }[]` shape and doesn't care about the granularity — it just renders bars/line with the bucket labels Recharts displays as-is on the X-axis.

**ISO week math:** Use `formatInTimeZone(d, BOGOTA_TZ, "RRRR-'W'II")` to produce `YYYY-Www` keys. `R` = ISO week-numbering year, `I` = ISO week-of-year. Verified pattern: `format.ts:114` already uses `formatInTimeZone` with `dd/MM/yyyy` patterns.

**Anti-pattern:** Don't use Recharts' built-in `interval` prop to thin out daily bars at long ranges — it leaves DAILY data buckets but only LABELS some ticks, which still renders 90 thin bars. Pre-aggregate the data.

### Pattern 5: Domain Module Shape (mirroring `bonos.ts` and `payouts.ts`)

Both new modules MUST follow the established shape:

**`src/lib/domain/inicio.ts` exports:**

```ts
// --- Constants ---
const RECHARGE_TRANSACTION_TYPES: readonly TransactionType[] = ["PAYIN_PSE", "PAYIN_TRANSFER"];

// --- Output types ---
export interface InicioSummary {
  gmv: number;             // sum of monto for in+completed transactions
  comision: number;        // sum of comision (Tikin revenue)
  takeRate: number;        // fraction 0..1; comision/gmv, zero-safe
  empresasActivas: number; // distinct empresa_id count
  bonosVendidos: number;   // count of BONUS+in+completed
}

export interface InicioDeltaSummary {
  current: InicioSummary;
  prior: InicioSummary | null;  // null when no prior period (no from filter)
}

export interface ActiveEmpresaPoint {
  bucket: string;   // YYYY-MM-DD or YYYY-Www
  count: number;    // distinct empresas active in that bucket
}

export interface GMVPoint {
  bucket: string;
  value: number;    // sum of monto
}

// --- Prior-period helper ---
export function computePriorPeriod(filters: DashboardFilters): { from: string; to: string } | null;

// --- Pure aggregations ---
export function summarizeInicio(transactions: Transaction[]): InicioSummary;
export function aggregateGMVByDate(transactions: Transaction[]): GMVPoint[];
export function aggregateGMVByWeek(transactions: Transaction[]): GMVPoint[];
export function aggregateActiveEmpresasByDate(transactions: Transaction[]): ActiveEmpresaPoint[];
export function aggregateActiveEmpresasByWeek(transactions: Transaction[]): ActiveEmpresaPoint[];

// --- Hechos curados primitives (full-dataset comparisons) ---
export function findTopEmpresaByGMV(filteredTransactions: Transaction[]): { empresa_id: string; empresa_nombre: string; gmv: number } | null;
export function findEmpresasNuevasActivadas(
  allTransactions: Transaction[],   // FULL dataset, NOT filtered
  filters: DashboardFilters,         // window for "activated within"
): { empresa_id: string; empresa_nombre: string; firstTx: Date }[];
```

**`src/lib/domain/recargas.ts` exports** (paralleling `bonos.ts`):

```ts
const RECHARGE_TRANSACTION_TYPES: readonly TransactionType[] = ["PAYIN_PSE", "PAYIN_TRANSFER"];

export interface RecargaSummary { count: number; montoTotal: number; }
export interface RecargaByDate { date: string; count: number; monto: number; }
export interface RecargaByEmpresa { empresa_id: string; empresa_nombre: string; count: number; monto: number; pctDelTotal: number; }

export function filterRecargas(transactions: Transaction[], filters: DashboardFilters): Transaction[];
export function summarizeRecargas(recargas: Transaction[]): RecargaSummary;
export function aggregateRecargasByDate(recargas: Transaction[]): RecargaByDate[];
export function aggregateRecargasByEmpresa(recargas: Transaction[]): RecargaByEmpresa[];
export function top10RecargasEmpresas(rows: RecargaByEmpresa[]): RecargaByEmpresa[];
// Hechos curados:
export function findRecargaMasGrande(recargas: Transaction[]): Transaction | null;
export function findTopEmpresaRecargadora(recargas: Transaction[]): RecargaByEmpresa | null;
```

### Anti-Patterns to Avoid

- **Computing delta inside the component.** Component receives raw `current` and `prior` numbers (or `null`); the math is in `inicio.ts`. Why: testability + reusability + single source of truth for the zero-safe rule.
- **Re-fetching transactions for the prior period.** `getCachedTransactions()` returns the FULL dataset already; just filter it twice with two different windows.
- **Hardcoding "month" or "week" in the chart leaf.** The leaf is bucket-agnostic. Bucket choice happens in page composition.
- **Using `<Date>` for chart X-axis dataKey.** Recharts handles `string` X-axis better than `Date` (no TZ confusion). Pre-format to ISO strings in domain functions.
- **Conditional rendering of presenter-mode hides via React.** All visibility flips through `data-presenter-hide` CSS contract. JS-side conditionals duplicate logic and break SSR consistency.
- **Naming domain types with `Inicio*` prefix while values are bonos-shaped.** `InicioSummary` carries cross-cutting metrics (GMV, take rate). Don't conflate with `BonoSummary`.

## Don't Hand-Roll

Problems that look simple but have existing solutions or established patterns in this codebase.

| Problem                                                | Don't Build                                          | Use Instead                                                                | Why                                                                                                  |
|--------------------------------------------------------|------------------------------------------------------|----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| Date range arithmetic (subtract N days, get day count) | Custom `Date` math with `getTime() - N * 86400000`   | `date-fns` `subDays`, `differenceInCalendarDays` (already imported `url-state.ts:23`) | DST-safe (Bogotá has none, but principle holds), well-tested.                                        |
| ISO week formatting                                    | `Math.floor((dayOfYear + offset) / 7)`               | `formatInTimeZone(d, BOGOTA_TZ, "RRRR-'W'II")` from `date-fns-tz`         | ISO 8601 week-numbering has subtle edge cases (year boundaries, week-1 rule). Use the library.        |
| Currency / percent / integer formatting                | `value.toLocaleString("es-CO", { ... })`              | `formatCOP`, `formatPercent`, `formatInteger` from `@/lib/format`          | Single Intl gate (Pitfall 9 in `format.ts:7`). Verified by grep: zero direct `Intl.NumberFormat` outside `format.ts`. |
| Duration formatting (latency hecho curado)             | Manual `Math.floor(s/3600)` etc.                     | `formatDuration` from `@/lib/format:98`                                    | Already returns `H:MM:SS` consistent with Payouts page.                                              |
| Percentile (P50) for "latencia destacada" hecho        | NumPy / sorting + interpolation by hand              | `quantileSorted` from `@/lib/domain/payouts:208`                          | R-7 algorithm, fixture-verified. Already used.                                                       |
| Empresa registry / nombre lookup                       | Re-build `Map<id, nombre>` in `inicio.ts`            | `getEmpresaRegistry` from `@/lib/domain/empresas:54`                       | First-occurrence-wins rule already established. DashboardHeader already calls it.                    |
| Filter URL state                                       | `useSearchParams` + manual coercion                  | `parseFilters(searchParams)` from `@/lib/url-state:52`                     | Single canonical reader; tolerates `string | string[] | undefined`.                                  |
| Building a navigation URL with new filters             | String concatenation                                 | `buildUrl(pathname, filters)` from `@/lib/url-state:70`                    | Stable param order; consistent with rest of app.                                                     |
| Recharts ResponsiveContainer wrapping                  | Custom `useResizeObserver` hook                      | `ResponsiveContainer` from `recharts`                                      | Already proven in `BonosChart.tsx:69`.                                                               |
| Recharts X-axis tick formatter for dates               | Custom format on every render                        | Pass `formatBogotaDate` (or a wrapper that takes ISO string) to `tickFormatter` | Existing pattern: `BonosChart.tsx:81` passes `formatValue` to `tickFormatter`.                       |
| Recharts theme integration                             | Hardcoded hex colors (`fill="#2563eb"`)              | `stroke="currentColor"` + `fill="currentColor"` + parent `text-foreground` / `text-primary` | Theme switches free. `BonosChart.tsx:98`, `LatencyHistogram.tsx:89` confirm this is THE pattern.    |
| Recharts tooltip styling                               | Custom rendering of `<TooltipContent>`               | `contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "0.5rem" }}` | Established Phase 2 / Phase 3 pattern. Theme-aware via CSS vars.                                     |
| Card chrome around a chart                             | Custom `<div className="rounded-lg border ...">`     | Page-level `<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent><Chart /></CardContent></Card>` | `bonos/page.tsx:129-136` and `payouts/page.tsx:178-185` set the precedent.                           |
| Presenter-mode visibility toggling                     | `useSearchParams() + presenter === "1" ? null : ...` | `data-presenter-hide` attribute on element                                 | CSS contract `[data-presenter="on"] [data-presenter-hide] { display: none !important; }`. SSR-safe, no hydration mismatch. |
| Empty state copy ("Sin recargas en el período")        | Custom messaging per page                            | Mirror Phase 2 / Phase 3 pattern: render a `<Card><CardHeader><CardTitle>Sin X en el período seleccionado</CardTitle></CardHeader><CardContent>Probá ampliando el rango...</CardContent></Card>` | Verified in `bonos/page.tsx:103-117` and `payouts/page.tsx:152-168`.                                 |
| Sorting Spanish strings (top 10 empresas)              | `localeCompare("es")` inline                         | Already implicit via existing pattern in `aggregateBonosByEmpresa` (sort by monto, not name) — for name-based sort use `Intl.Collator("es")` already in `empresas.ts:66` | Spanish accent-aware sort already proven.                                                            |
| Skipping the prior period when no `from` is set        | Inline guard in every KPI card                       | `computePriorPeriod` returns `null`; `DeltaBadge` accepts `null` and renders `—` | Single point of truth for "no comparison possible".                                                  |

**Key insight:** The reason hand-rolling is forbidden here is that this codebase already has 2 phases of accumulated patterns. Every "look it's just a small div" reinvention silently drifts the project's voice. Phase 4 must read as the same product as Phase 2 and Phase 3, both visually and architecturally.

## Common Pitfalls

### Pitfall 1: Division-by-zero in delta computation when prior period has zero activity

**What goes wrong:** `(current - 0) / 0 = Infinity` or `NaN` displayed as `"+∞%"` or `"NaN%"` — both visually catastrophic and break tabular-nums alignment.

**Why it happens:** New empresa with first sale in the active period has `priorGMV = 0`. The naive formula `(current - prior) / prior` blows up.

**How to avoid:**
```ts
function pctChange(current: number, prior: number): number | null {
  if (!Number.isFinite(prior) || prior === 0) return null;
  return (current - prior) / prior;
}
```
Render `null` as em-dash (`—`). Same convention as `formatCOP(null)` returning `"—"` (`format.ts:60`).

**Warning signs:** Visual `Infinity%` in dev; an unfiltered grep `grep -rn "/ prior" src/lib/domain/inicio.ts` showing un-guarded division.

### Pitfall 2: Prior period crosses month/year boundary with day-count drift

**What goes wrong:** "April 2026" (30 days) prior is computed as "March 1–30" (30 days), but a developer might intuitively think "the previous month" (March 1–31, 31 days). The CONTEXT.md spec is explicit: **same window size**, not "same calendar month."

**Why it happens:** Mental model conflict between "last month" (calendar-bound) and "last 30 days" (length-bound). The spec wins: length-bound.

**How to avoid:** The `computePriorPeriod` helper computes `length` once and applies it as a delta. Document the choice IN-CODE with the spec quote:

```ts
// Per 04-CONTEXT.md "Specific Ideas":
//   Filtro = "abril 2026" → compara contra "marzo 2026"
//      (ventana del mismo tamaño, inmediatamente previa)
//   Filtro custom (5 días) → ventana de 5 días previa al `from`.
// We compute by LENGTH IN DAYS, not by calendar boundary.
```

**Warning signs:** Discussion in plan review about "but March has 31 days" — the answer is always "we compare 30 days to 30 days."

### Pitfall 3: Recharts renders nothing when data array is empty

**What goes wrong:** When the active filter produces zero in-period transactions, `aggregateGMVByDate(bonos)` returns `[]`. Recharts' LineChart silently renders an empty plot area with axes — looks like a layout bug.

**Why it happens:** Verified via [recharts/recharts#334](https://github.com/recharts/recharts/issues/334): "Currently nothing gets rendered if data is an empty array."

**How to avoid:** Page composition guards BEFORE rendering the chart:
```tsx
{trendData.length === 0 ? (
  <p className="text-sm text-muted-foreground py-12 text-center">
    Sin datos en el período seleccionado.
  </p>
) : (
  <GMVTrendChart data={trendData} />
)}
```

**Warning signs:** Empty card with two visible axes and no marks. **Stable shape contracts (like `aggregateLatencyHistogram`'s 4-bucket guarantee, see `payouts.ts:330`) DO NOT apply to time-series charts** — there's no fixed bucket set for "all dates in April."

### Pitfall 4: Recharts charts with < 2 data points render as a single floating dot

**What goes wrong:** A 1-day filter that produces 1 transaction renders as a single `activeDot` with no line and no axis ticks beyond the one point — visually broken.

**Why it happens:** A line needs ≥2 points to draw a segment. Recharts doesn't error; it just shows a dot.

**How to avoid:** Decision in plan: when `trendData.length < 2`, render the same empty-state copy ("Sin suficiente data para tendencia. Ampliá el período."). Treat single-point as effectively empty for the chart.

### Pitfall 5: "Empresas nuevas activadas" computed against the FILTERED dataset (gives wrong answer)

**What goes wrong:** Filtering transactions to the active window FIRST, then asking "which empresas have their first transaction in this window?" gives every empresa whose ONLY transactions fall in the window — including empresas that have transactions outside the window. Wrong answer.

**Why it happens:** Conceptual mismatch — "first ever" requires comparing against the entire history, not just the visible slice.

**How to avoid:** `findEmpresasNuevasActivadas` takes BOTH the full unfiltered dataset AND the filters:

```ts
export function findEmpresasNuevasActivadas(
  allTransactions: Transaction[],   // pass result.rows directly, NO filter
  filters: DashboardFilters,
): { empresa_id: string; empresa_nombre: string; firstTx: Date }[] {
  // 1. Build firstTxByEmpresa from the FULL dataset.
  const firstByEmpresa = new Map<string, { fecha: Date; nombre: string }>();
  for (const t of allTransactions) {
    if (t.status !== "completed") continue;  // only completed counts as activation
    const cur = firstByEmpresa.get(t.empresa_id);
    if (!cur || t.fecha.getTime() < cur.fecha.getTime()) {
      firstByEmpresa.set(t.empresa_id, { fecha: t.fecha, nombre: t.empresa_nombre });
    }
  }
  // 2. Filter to those whose firstTx falls inside the active window.
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const result = [];
  for (const [id, { fecha, nombre }] of firstByEmpresa) {
    const ts = fecha.getTime();
    if (ts >= fromTs && ts <= toTs) {
      result.push({ empresa_id: id, empresa_nombre: nombre, firstTx: fecha });
    }
  }
  // 3. Sort by firstTx ascending (oldest first within the window).
  result.sort((a, b) => a.firstTx.getTime() - b.firstTx.getTime());
  return result;
}
```

**Warning signs:** Empresas appearing in "nuevas activadas" that have transactions in BD_Plataforma from months earlier.

### Pitfall 6: Timezone drift in date-bucket keys

**What goes wrong:** A transaction stamped at `2026-04-28T01:00:00Z` (= 2026-04-27 20:00 Bogotá) is bucketed as April 28 if you call `t.fecha.toISOString().slice(0,10)` instead of `toBogotaISODate(t.fecha)`. KPI shows `+1` for the wrong day.

**Why it happens:** UTC vs Bogotá split. Bogotá is UTC-5; any time before 05:00 UTC is the previous Bogotá day.

**How to avoid:** ALWAYS use `toBogotaISODate(d)` from `@/lib/format` for bucket keys. NEVER call `Date.prototype.toISOString` for display or grouping. Verified pattern: `bonos.ts:222` uses `toBogotaISODate(b.fecha)`.

**Warning signs:** A grep `grep -rn "toISOString\|getUTC" src/lib/domain/inicio.ts` returning hits.

### Pitfall 7: KPI grid empty slots in presenter mode (cosmetic)

**What goes wrong:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-5` with 2 cards `data-presenter-hide`. In presenter mode at `lg` viewport, 3 cards leave 2 empty slot widths.

**Why it happens:** CSS Grid with `display: none` on a child collapses the cell; the auto-flow doesn't reflow column count.

**How to avoid:** Two acceptable solutions documented in Pattern 3 above. Default to **(A) accept** unless mock review flags it.

**Warning signs:** Visual feedback during plan review explicitly mentioning "the right side feels empty." Apply solution (B) only on demand.

### Pitfall 8: Take rate sensitivity to denominator

**What goes wrong:** `takeRate = comisionTotal / gmv` where `gmv = 0` → NaN/Infinity. Same root as Pitfall 1.

**How to avoid:**
```ts
const takeRate = gmv > 0 ? comisionTotal / gmv : 0;
```
Same idiom as `bonos.ts:194` (`ticketPromedio = count > 0 ? montoTotal / count : 0`).

### Pitfall 9: Presenter mode + empresa filter without empresa filter on prior period

**What goes wrong:** When `filters.empresa = "$mario"`, current period is Mario-only, but if prior-period filters DON'T propagate the empresa filter, prior-period sums are global and the delta says "Mario went from 100% of all GMV to 5% of all GMV — DOWN 95%!"

**How to avoid:** `computePriorPeriod` returns ONLY the date overrides; the caller MUST merge with the rest of the filters:

```ts
const priorWindow = computePriorPeriod(filters);
const priorFilters: DashboardFilters = priorWindow
  ? { ...filters, from: priorWindow.from, to: priorWindow.to }
  : null;
```

Note `...filters` keeps `empresa` and `presenter` intact. Document this in `computePriorPeriod`'s JSDoc.

### Pitfall 10: Hechos curados visible in cliente-foco

**What goes wrong:** CONTEXT.md is explicit: "Los 3 hechos curados se ocultan TODOS" when both `presenter=1` AND `empresa` is set. A naive `data-presenter-hide` only hides on presenter mode regardless of empresa. If an internal user has `presenter=1` without empresa, they SHOULD still see hechos curados.

**Wait — re-read CONTEXT.md:** "Modo Presentación además **oculta Comisión y Take rate** (por roadmap) — incluso en cliente-foco." And "Los 3 hechos curados se ocultan TODOS — son lectura interna de Tikin."

**Re-read more carefully:** The "se ocultan TODOS" sentence is in the "Contrato de cliente-foco (filtro empresa activo + presenter on)" section — so hechos curados hide ONLY in cliente-foco (both flags set), not in plain presenter mode.

**Decision:** This is a 2-flag conditional that the CSS contract alone doesn't handle. Two implementation paths:

| Approach | How | Tradeoff |
|----------|-----|----------|
| **CSS-only:** Add a new attribute `data-empresa-filter="active"` set by the layout when `filters.empresa` is set, and add CSS rule `[data-presenter="on"][data-empresa-filter="active"] [data-presenter-empresa-hide] { display: none !important; }`. | Tag hechos curados containers with `data-presenter-empresa-hide`. | Symmetric with existing `data-presenter-hide`; layout-side change is small (PresenterFrame already runs client-side and reads searchParams). |
| **SSR conditional:** In page composition, `{ !(filters.presenter === "1" && filters.empresa) && <HechosCurados /> }`. | Inline check on the page. | Works but breaks the "all visibility flips through CSS" invariant. |

**Recommendation:** **CSS-only**. Plan-author should add the `data-empresa-filter` attribute on the `(protected)/layout.tsx`'s outer wrapper (where `data-presenter` already sits via `PresenterFrame`). One CSS rule in `globals.css`. Then hechos curados containers carry the new attribute. Wire-up cost is low; symmetry with existing pattern is high.

**Warning signs:** Plan tasks computing `if (presenter && empresa) return null` instead of marking with attributes.

### Pitfall 11: Deduplicating "transaction is in two buckets" when computing empresas-active

**What goes wrong:** A bucket says "5 empresas active in week 17" — but a single empresa with 10 transactions in that week shouldn't count as 10. Need distinct empresa per bucket.

**How to avoid:** `aggregateActiveEmpresasByDate` builds `Map<bucket, Set<empresa_id>>`, then emits `{ bucket, count: set.size }`.

**Verified pattern:** Same idiom as `getEmpresaRegistry` (`empresas.ts:54`) using `Map<id, ...>` for dedupe.

## Code Examples

Verified patterns adapted from existing modules. All examples are pseudocode-correct (TypeScript-checks-able) but plan-author will refine in actual implementation.

### Prior-period computation (`src/lib/domain/inicio.ts`)

Adapted from existing date helpers in `bonos.ts:53-74` and `url-state.ts:104`.

```ts
// Source: pattern derived from bonos.ts startOfDayBogotaTimestamp + url-state.ts subDays usage
import { differenceInCalendarDays, subDays } from "date-fns";
import { toBogotaISODate } from "@/lib/format";
import type { DashboardFilters } from "@/lib/url-state";

/**
 * Given the active filters, return the immediately-prior window of the
 * SAME LENGTH IN DAYS (Bogotá calendar). Returns null when either
 * `from` or `to` is missing — there is no defined "prior" for an
 * unbounded window.
 *
 * Per 04-CONTEXT.md spec:
 *   - "abril 2026" (30d) → "marzo 1–30 2026" (30d), NOT March 1–31.
 *   - 5-day custom range → 5-day window immediately before `from`.
 *
 * Pure: same input → same output.
 */
export function computePriorPeriod(
  filters: DashboardFilters,
): { from: string; to: string } | null {
  if (!filters.from || !filters.to) return null;

  // Validate shape (defensive — url-state.ts already enforces YYYY-MM-DD).
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.from)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) return null;

  const fromDate = new Date(`${filters.from}T00:00:00-05:00`);
  const toDate = new Date(`${filters.to}T00:00:00-05:00`);
  if (toDate.getTime() < fromDate.getTime()) return null; // malformed

  // Inclusive day count: "April 1 to April 30" = 30 days.
  const lengthDays = differenceInCalendarDays(toDate, fromDate) + 1;

  const priorTo = subDays(fromDate, 1);
  const priorFrom = subDays(priorTo, lengthDays - 1);

  return {
    from: toBogotaISODate(priorFrom),
    to: toBogotaISODate(priorTo),
  };
}
```

### Generic delta summary (page composition)

```ts
// In src/app/(protected)/inicio/page.tsx (Server Component)
const filters = parseFilters(params);
const priorWindow = computePriorPeriod(filters);

// Same data, two filter passes.
const currentTx = filterCompletedIn(allTx, filters);
const priorTx = priorWindow
  ? filterCompletedIn(allTx, { ...filters, from: priorWindow.from, to: priorWindow.to })
  : null;

const summary: InicioDeltaSummary = {
  current: summarizeInicio(currentTx),
  prior: priorTx ? summarizeInicio(priorTx) : null,
};
```

### DeltaBadge component (`src/components/inicio/DeltaBadge.tsx`)

Server Component (pure formatting). No `"use client"`.

```tsx
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatPercent } from "@/lib/format";

type Props = {
  /** Current period value */
  current: number;
  /** Prior period value, or null when no prior is computable */
  prior: number | null;
};

export function DeltaBadge({ current, prior }: Props) {
  if (prior === null || !Number.isFinite(prior) || prior === 0) {
    return <span className="text-xs text-muted-foreground tabular-nums">—</span>;
  }

  const change = (current - prior) / prior; // fraction
  const sign = change > 0 ? "up" : change < 0 ? "down" : "flat";

  const Icon = sign === "up" ? ArrowUpRight : sign === "down" ? ArrowDownRight : Minus;
  const colorClass =
    sign === "up" ? "text-emerald-600 dark:text-emerald-400" :
    sign === "down" ? "text-rose-600 dark:text-rose-400" :
    "text-muted-foreground";

  // formatPercent handles sign: 0.123 → "+12,3 %" (Intl es-CO). NOTE: Intl
  // does NOT auto-add "+" — wrap manually if user wants explicit positive sign.
  const display = formatPercent(Math.abs(change));
  const prefix = sign === "up" ? "+" : sign === "down" ? "−" : "";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {prefix}{display}
    </span>
  );
}
```

### KPI card with delta (mirrors `bonos/KPICards.tsx`)

```tsx
// src/components/inicio/KPICardsInicio.tsx — Server Component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InicioDeltaSummary } from "@/lib/domain/inicio";
import { formatCOP, formatInteger, formatPercent } from "@/lib/format";
import { DeltaBadge } from "./DeltaBadge";

type Props = { summary: InicioDeltaSummary };

export function KPICardsInicio({ summary }: Props) {
  const { current, prior } = summary;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* 1. GMV — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>GMV / Volumen total</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(current.gmv)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.gmv} prior={prior?.gmv ?? null} />
        </CardContent>
      </Card>

      {/* 2. Comisión — oculta en presenter */}
      <Card data-presenter-hide>
        <CardHeader>
          <CardDescription>Comisión / Revenue</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatCOP(current.comision)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.comision} prior={prior?.comision ?? null} />
        </CardContent>
      </Card>

      {/* 3. Take rate — oculta en presenter */}
      <Card data-presenter-hide>
        <CardHeader>
          <CardDescription>Take rate</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatPercent(current.takeRate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.takeRate} prior={prior?.takeRate ?? null} />
        </CardContent>
      </Card>

      {/* 4. Empresas activas — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Empresas activas</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(current.empresasActivas)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.empresasActivas} prior={prior?.empresasActivas ?? null} />
        </CardContent>
      </Card>

      {/* 5. Bonos vendidos — siempre visible */}
      <Card>
        <CardHeader>
          <CardDescription>Bonos vendidos</CardDescription>
          <CardTitle className="font-heading text-3xl tabular-nums">
            {formatInteger(current.bonosVendidos)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DeltaBadge current={current.bonosVendidos} prior={prior?.bonosVendidos ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
```

### Bucket-aware GMV trend chart (Client Component, mirrors `BonosChart.tsx`)

```tsx
// src/components/inicio/GMVTrendChart.tsx
"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GMVPoint } from "@/lib/domain/inicio";
import { formatCOP } from "@/lib/format";

type Props = {
  data: GMVPoint[];
  /** Hint for axis tick formatting; bucket strings already convey it but this drives label compaction. */
  granularity: "day" | "week";
};

export function GMVTrendChart({ data, granularity }: Props) {
  return (
    <div className="h-[320px] w-full text-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 12 }}
            stroke="currentColor"
            // Compact label: "2026-04-15" → "15/04"; "2026-W17" → "W17"
            tickFormatter={(b: string) =>
              granularity === "week"
                ? b.slice(5)               // "W17"
                : b.slice(8) + "/" + b.slice(5, 7)   // "15/04"
            }
          />
          <YAxis
            stroke="currentColor"
            tick={{ fontSize: 12 }}
            tickFormatter={formatCOP}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(v: number) => [formatCOP(v), "GMV"]}
            contentStyle={{
              background: "var(--background)",
              border: "1px solid var(--border)",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
          />
          <Bar dataKey="value" fill="currentColor" minPointSize={2} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Inicio page composition (mirrors `bonos/page.tsx`)

```tsx
// src/app/(protected)/inicio/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICardsInicio } from "@/components/inicio/KPICardsInicio";
import { GMVTrendChart } from "@/components/inicio/GMVTrendChart";
import { EmpresasActivasChart } from "@/components/inicio/EmpresasActivasChart";
import { HechosCurados } from "@/components/inicio/HechosCurados";
import {
  computePriorPeriod,
  summarizeInicio,
  aggregateGMVByDate,
  aggregateGMVByWeek,
  aggregateActiveEmpresasByDate,
  aggregateActiveEmpresasByWeek,
  findTopEmpresaByGMV,
  findEmpresasNuevasActivadas,
  filterCompletedIn,  // shared helper inside inicio.ts
} from "@/lib/domain/inicio";
// reuse Phase 3 modules for "latencia destacada" hecho:
import { filterPayouts, summarizePayouts } from "@/lib/domain/payouts";
import { getCachedTransactions } from "@/lib/sheets/transactions";
import { getCachedPayouts } from "@/lib/sheets/payouts";
import { parseFilters } from "@/lib/url-state";
import { differenceInCalendarDays } from "date-fns";

export const metadata = { title: "Inicio · Tikin Dashboard" };
export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function InicioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);
  const priorWindow = computePriorPeriod(filters);

  // One fetch for transactions, one for payouts (Phase 3 hecho re-uses them).
  // Both are React.cache()-deduped per request.
  let txResult, payoutsResult;
  try {
    [txResult, payoutsResult] = await Promise.all([
      getCachedTransactions(),
      getCachedPayouts(),
    ]);
  } catch (err) {
    return (
      <Card>
        <CardHeader><CardTitle>No pudimos leer el Sheet</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {err instanceof Error ? err.message : "Error desconocido."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const allTx = txResult.rows;

  // Current period
  const currentTx = filterCompletedIn(allTx, filters);
  // Prior period (filters merged with prior dates; preserves empresa+presenter)
  const priorTx = priorWindow
    ? filterCompletedIn(allTx, { ...filters, from: priorWindow.from, to: priorWindow.to })
    : null;

  const summary = {
    current: summarizeInicio(currentTx),
    prior: priorTx ? summarizeInicio(priorTx) : null,
  };

  // Granularity from active range length
  const length =
    filters.from && filters.to
      ? differenceInCalendarDays(
          new Date(`${filters.to}T00:00:00-05:00`),
          new Date(`${filters.from}T00:00:00-05:00`),
        ) + 1
      : 30;
  const granularity: "day" | "week" = length > 60 ? "week" : "day";

  const gmvSeries = granularity === "week"
    ? aggregateGMVByWeek(currentTx)
    : aggregateGMVByDate(currentTx);
  const activeSeries = granularity === "week"
    ? aggregateActiveEmpresasByWeek(currentTx)
    : aggregateActiveEmpresasByDate(currentTx);

  // Hechos curados (FULL dataset for empresas-nuevas)
  const topEmpresa = findTopEmpresaByGMV(currentTx);
  const empresasNuevas = findEmpresasNuevasActivadas(allTx, filters);
  const payoutsCurrent = filterPayouts(payoutsResult.rows, filters);
  const payoutsPrior = priorWindow
    ? filterPayouts(payoutsResult.rows, { ...filters, from: priorWindow.from, to: priorWindow.to })
    : null;
  const latenciaCurrent = summarizePayouts(payoutsCurrent);
  const latenciaPrior = payoutsPrior ? summarizePayouts(payoutsPrior) : null;

  return (
    <div className="space-y-6">
      <KPICardsInicio summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              GMV en el tiempo
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({granularity === "week" ? "semanal" : "diario"})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gmvSeries.length < 2 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Sin datos suficientes para tendencia. Ampliá el período.
              </p>
            ) : (
              <GMVTrendChart data={gmvSeries} granularity={granularity} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Empresas activas en el tiempo</CardTitle></CardHeader>
          <CardContent>
            {activeSeries.length < 2 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                Sin datos suficientes para tendencia. Ampliá el período.
              </p>
            ) : (
              <EmpresasActivasChart data={activeSeries} granularity={granularity} />
            )}
          </CardContent>
        </Card>
      </div>

      <HechosCurados
        topEmpresa={topEmpresa}
        latenciaCurrent={latenciaCurrent}
        latenciaPrior={latenciaPrior}
        empresasNuevas={empresasNuevas}
      />
    </div>
  );
}
```

## Scope Decision Heuristics

CONTEXT.md flags scope risk: highlight reel + deltas + 3 hechos curados + Recargas variant exceed roadmap's original "5 KPIs + 2 charts." Plan-author should split aggressively. Use these heuristics:

### Splitting rules

| If... | Then... |
|-------|---------|
| Total estimated tasks for Phase 4 > 12 | Split into Plan 04-01 "Inicio domain + KPIs + charts" and Plan 04-02 "Inicio hechos curados" and Plan 04-03 "Recargas" |
| Single plan covers > 8 tasks | Split that plan |
| Recargas tasks total > 5 | Drop hechos curados from Recargas (keep KPIs + table only) — CONTEXT.md says "Recargas no es héroe" |
| `findEmpresasNuevasActivadas` proves expensive on 3188 rows | Cap output to top 5 nuevas; document the cap; defer "show all" to Phase 5 if needed |
| Cliente-foco "Empresas activas degenerada" decision becomes contentious | Default to "hide the chart entirely in cliente-foco via `data-presenter-empresa-hide`" — do not invent the alternative chart in Phase 4 |
| GMV bucket granularity discussion expands | Lock in the 60-day threshold; explicitly state in plan that "user can request adjustment in Phase 5 if needed"; move on |

### Cut-priority order (when scope must shrink)

If plans don't fit, cut in THIS order (preserves cliente-foco impecable):

1. **Recargas hechos curados** (top empresa recargadora, recarga más grande) — replace with single KPI + table
2. **Inicio "Empresas nuevas activadas" hecho** — recortar "antes que sacrificar cliente-foco" (CONTEXT.md spec)
3. **Inicio "Latencia destacada" hecho** — already redundant with Phase 3 page; defer to Phase 5 if it doesn't fit
4. **Inicio bucket granularity autoswitch** — lock to daily always; make plan author add weekly later if needed
5. **DeltaBadge for Empresas activas / Bonos vendidos** — keep delta on GMV only

**Never cut:**
- 5 KPI cards (without deltas if needed) — they're roadmap-mandated
- 2 trend charts at daily granularity — roadmap-mandated
- Recargas 2 KPIs + table top 10 — roadmap-mandated, unblocks Phase 5

### Sequence guidance

Recommended task ordering within a single plan (mirror Phase 2/3):

1. Domain module (`inicio.ts` or `recargas.ts`) — pure functions, types, prior-period helper. Zero UI.
2. KPI Cards Server Component (with DeltaBadge atom).
3. Chart leaves (Client Components).
4. Page composition — wires everything.
5. Hechos curados — last because they depend on patterns established in 1–4.
6. Cliente-foco edge case verification.

This ordering means tasks 1–2 are testable independently; if Phase 4 must ship in pieces, an MVP Inicio (KPIs + charts) ships before hechos curados land.

## Cliente-Foco Edge Cases

When `?presenter=1&empresa=$X` is set on `/inicio`, specific things can render badly. The plan-author MUST verify each case explicitly.

### Edge case 1: Empresas activas KPI = 1 (always)

**Render:** Card shows "Empresas activas: 1" with delta usually `—` (prior period also has 1, or is null because the empresa wasn't active prior).

**Fix:** Acceptable as-is. The card text is technically correct (the cliente IS the only active empresa in their filter). Optionally change description from "En el período" to "Tu empresa" when `filters.empresa` set:

```tsx
<CardDescription>
  {filters.empresa ? "Tu empresa" : "Empresas activas"}
</CardDescription>
```

### Edge case 2: Empresas activas EN EL TIEMPO chart = flat line at y=1

**Render:** A line/bar chart with all values = 1. Visually empty / nonsense.

**Fix:** When `filters.empresa` is set, EITHER hide the chart entirely OR replace with a different chart. CONTEXT.md states: "DECISIÓN a tomar en el plan." Plan-author choice — recommended: hide via the `data-presenter-empresa-hide` mechanism (Pitfall 10 above). Reason: "Tu actividad en el tiempo" already lives implicitly in the GMV chart. A second chart for the same empresa duplicates without adding info.

```tsx
<Card data-presenter-empresa-hide>
  <CardHeader><CardTitle>Empresas activas en el tiempo</CardTitle></CardHeader>
  ...
</Card>
```

Pair with new CSS rule:
```css
[data-presenter="on"][data-empresa-filter="active"] [data-presenter-empresa-hide] {
  display: none !important;
}
```

### Edge case 3: 3 hechos curados visible to client (privacy violation)

**Render:** Top empresa = the cliente (already obvious). Empresas nuevas = potentially OTHER clients' info (data leak). Latencia = redundant with Payouts tab anyway.

**Fix:** Hide the entire HechosCurados container with `data-presenter-empresa-hide`. SSR-only check NOT recommended; CSS contract preserves the visibility-flips-via-data-attr invariant.

```tsx
<HechosCurados
  ...
  className="data-presenter-empresa-hide"  // OR add wrapper Card with attribute
/>
```

### Edge case 4: GMV chart with 0 transactions for the empresa in the period

**Render:** Empty chart (Pitfall 3). User sees "GMV en el tiempo" card with empty body.

**Fix:** Already covered by Pitfall 3 guard (`gmvSeries.length < 2 ? <EmptyMessage /> : <Chart />`). Same fallback applies.

### Edge case 5: Delta for new empresa (no prior activity)

**Render:** GMV current = X, GMV prior = 0 → delta = `null` → renders `—`.

**Fix:** Already correct via Pitfall 1 guard. The `—` is honest: "no comparison possible." Acceptable.

### Edge case 6: Cliente-foco URL shared with viewer who has no auth

**Render:** Layout's auth gate redirects to `/login`. Cliente never sees data.

**Fix:** Out of scope for Phase 4 — Phase 5 (CLI-08) handles "Generar vista para cliente" which presumably creates a stable shareable URL with appropriate auth model. Phase 4 just needs to render correctly for an authed Tikin user simulating the cliente view.

### Edge case 7: Bucket granularity switches mid-render

**Render:** A user clicks a 90-day preset → granularity flips to weekly between renders. Recharts re-mounts the chart. Slight flicker.

**Fix:** Acceptable. Recharts handles mount/unmount cleanly. No special handling needed.

### Edge case 8: Hechos curados with empty data

**Render:**
- `topEmpresa = null` (no transactions in period) → render "Sin transacciones en el período" copy.
- `empresasNuevas = []` → render "Ninguna empresa nueva activada en este período" copy.
- `latenciaCurrent.count = 0` → render "—" for the P50.

**Fix:** Each hecho is a self-contained Card with its own empty-state. Pattern matches Phase 2 / Phase 3 empty-state cards.

### Verification checklist for cliente-foco (plan-author MUST do this)

For the plan-author's Verify task in Phase 4 plans, hit each URL manually and confirm:

- [ ] `/inicio` (no filters): Internal view. 5 KPIs + 2 charts + 3 hechos curados visible.
- [ ] `/inicio?presenter=1`: Presenter view. 3 KPIs (Comisión + Take rate hidden), 2 charts visible, 3 hechos curados STILL visible (CONTEXT.md states hechos hide only in cliente-foco, not plain presenter).
- [ ] `/inicio?empresa=$mario`: Filtered view. 5 KPIs (delta against Mario's prior period), 2 charts (empresas activas chart shows flat 1 — visible because no presenter), 3 hechos curados visible.
- [ ] `/inicio?presenter=1&empresa=$mario`: **Cliente-foco.** 3 KPIs (Comisión + Take rate hidden), GMV chart visible, Empresas activas chart HIDDEN, hechos curados ALL HIDDEN.
- [ ] All four URLs: NO `Infinity%`, NO `NaN%`, NO `—%` malformed strings. Empty windows show em-dash for delta, not error states.
- [ ] All four URLs: Page renders without server error even when `from`/`to` are absent (delta null, page still renders KPIs without delta badges).

## State of the Art (2026)

The "highlight reel" pattern (vs. "panel ejecutivo") is supported by current SOTA dashboards:

| Pattern | Where seen | Phase 4 alignment |
|---------|------------|-------------------|
| KPI cards with delta-vs-prior at the top | Stripe Dashboard, Linear Insights, Vercel Analytics, Looker Studio Scorecards | Inicio's 5 KPIs match this layout exactly. |
| Adaptive bucket granularity (autosize day/week/month) | Stripe Dashboard, Mixpanel, Amplitude | Phase 4 implements day/week threshold at 60 days. |
| Editorial / narrative blocks alongside KPIs | Linear "Pulse," Vercel "Project insights" | "Hechos curados" section maps to this pattern. |
| Per-customer projection mode | Stripe Customer Portal, Vercel Team views | Cliente-foco implements this via existing `presenter=1&empresa=$X` URL contract. |
| Tabular-nums + monospaced numerals for delta | Linear, Stripe | Already in `KPICards.tsx:43` `font-heading text-3xl tabular-nums` pattern. Phase 4 extends with `font-mono` for deltas (matching Phase 3's `font-mono` for P50/P95). |

| Old approach | Current approach | When changed | Impact for Phase 4 |
|--------------|------------------|--------------|---------------------|
| Recharts v2 with manual styling | Recharts v3 + shadcn `chart.tsx` wrapper | shadcn chart component released 2024-Q1 | Phase 4 stays on v2 + manual styling; project will not adopt the wrapper retroactively. |
| Imperative `useEffect`-based filter state | URL searchParams + Server Components | Next 13 App Router (2023) | Already adopted in `url-state.ts`. Phase 4 follows. |
| KPI cards as separate fetch endpoints | Single Server Component composition | Next App Router pattern (2024 SOTA) | Already adopted in `payouts/page.tsx`. Phase 4 follows. |

**Deprecated/outdated:**
- `Recharts v2` will eventually be replaced project-wide, but **NOT in Phase 4**.
- shadcn's old `chart.tsx` component is not aligned with v2; do not install.

## Open Questions

Items where the research couldn't lock down a single answer; plan-author or user must decide.

### 1. "Top empresa del período" — by GMV absolute or by growth?

- **What we know:** CONTEXT.md says "definir en research/plan si es por mayor GMV absoluto o por mayor crecimiento; user-aceptado que Claude proponga"
- **What's unclear:** Both have merit. GMV absolute = "biggest customer" (revenue concentration story). Growth = "fastest-growing" (momentum story).
- **Recommendation:** **By GMV absolute.** Reasons: (a) `findTopEmpresaByGMV` runs on the FILTERED current period, no prior-period dependency, simpler. (b) "Crecimiento" requires comparing to prior period AND filters out empresas absent in prior period — hides info. (c) The leaderboard / SalesTable in Phase 2 already orders by `monto` desc — this hecho is a single-line callout of THAT story. Consistent voice.
- **If plan-author disagrees:** Trivial to swap implementation later; the hecho's render shape is identical.

### 2. Cliente-foco "Empresas activas degenerada" — hide chart or replace it?

- **What we know:** CONTEXT.md says decision lives in the plan. "Hide" is the simplest path.
- **What's unclear:** "Replace with mini-resumen pestañas" was floated in CONTEXT.md but is undefined in scope.
- **Recommendation:** **Hide the chart in cliente-foco** via `data-presenter-empresa-hide`. Adding a different chart introduces design-decision surface that doesn't have a roadmap line item. Defer "what to show instead" to Phase 5 if user wants more there.

### 3. Bucket granularity threshold — 60 days?

- **What we know:** Stripe and Mixpanel switch around 30–90 days. 60 days is in the middle.
- **What's unclear:** Whether 60 vs 30 vs 90 reads better visually. No A/B data.
- **Recommendation:** **Lock 60 days.** Plan-author should NOT spend cycles on this; if it reads wrong in production, swap the constant in `inicio.ts` later. Single number, well-isolated.

### 4. Should "empresas nuevas activadas" cap output?

- **What we know:** 3188 historical transactions; if a 90-day window is active and many empresas onboarded recently, the list could be 20+.
- **What's unclear:** Visual budget for the hecho. CONTEXT.md doesn't specify.
- **Recommendation:** **Cap at 5 nuevas, sorted by firstTx ascending (oldest activation first within the window).** Show "+N más" if total > 5. Matches Phase 2/3 leaderboard's top-10 convention scaled down.

### 5. Recargas page — separate trend chart or skip?

- **What we know:** REC-01 says "Total $ recargado + tendencia." CONTEXT.md says Recargas is not the hero.
- **What's unclear:** Whether the trend lives as a small chart or just a sparkline next to the KPI.
- **Recommendation:** **Single mid-size chart (320px height) below the KPI cards, mirroring `BonosChart`.** No sparkline (sparklines are a different visual primitive not used elsewhere). Keep voice consistent.

## Sources

### Primary (HIGH confidence)

- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/domain/bonos.ts` — Established domain module pattern (filterX, summarizeX, aggregateXByDate, aggregateXByEmpresa, top10X)
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/domain/payouts.ts` — Same pattern + zero-safe percentile reuse
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/domain/empresas.ts` — Empresa registry pattern (Map-based dedupe)
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/format.ts` — Single Intl gate; `formatCOP`, `formatPercent`, `formatInteger`, `formatDuration`, `toBogotaISODate`
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/url-state.ts` — `parseFilters`, `buildUrl`, `presetDateRange`, `DashboardFilters` type
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/components/bonos/BonosChart.tsx` — Recharts LineChart pattern
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/components/payouts/LatencyHistogram.tsx` — Recharts BarChart pattern
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/components/bonos/KPICards.tsx` — KPI card composition
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/components/payouts/PayoutsKPICards.tsx` — 5-card grid + presenter-hide pattern
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/app/(protected)/bonos/page.tsx` — Page composition shape
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/app/(protected)/payouts/page.tsx` — Page composition with two cached fetches
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/app/globals.css` — Presenter mode CSS contract (`[data-presenter="on"] [data-presenter-hide] { display: none !important; }`)
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/sheets/transactions.ts:166` — `getCachedTransactions = cache(getTransactions)` confirms React `cache()` per-request dedup
- `/Users/alejoalmeida/dev/Dashboard_Tikin/src/lib/domain/types.ts:33` — Confirms Phase 4 filters on `PAYIN_PSE` + `PAYIN_TRANSFER`
- `/Users/alejoalmeida/dev/Dashboard_Tikin/package.json` — Recharts ^2.15.4, date-fns ^4.1.0, Next 16.2.4, React 19.2.4
- `/Users/alejoalmeida/dev/Dashboard_Tikin/.planning/phases/04-inicio-recargas/04-CONTEXT.md` — Phase scope spec

### Secondary (MEDIUM confidence)

- shadcn/ui Chart docs at https://ui.shadcn.com/docs/components/chart — confirmed via WebFetch: `ChartContainer` requires `config` + `className` with `min-h-*`; project deliberately doesn't install
- shadcn/ui chart Recharts v2 vs v3 compat: GitHub issue [shadcn-ui/ui#9892](https://github.com/shadcn-ui/ui/issues/9892) — confirmed shadcn chart v3-oriented; codebase pinned to Recharts v2.15.4
- Recharts empty-array rendering: GitHub issue [recharts/recharts#334](https://github.com/recharts/recharts/issues/334) — confirms empty array renders nothing; mitigation = guard before mounting chart
- Stripe Dashboard delta semantics: [Stripe support](https://support.stripe.com/questions/customizing-the-date-range-for-dashboard-home-charts) — confirms "previous period" can mean entire previous period (length-bound, not calendar-bound)
- Cohort / first-time customer pattern reference: [phoenixstrategy.group blog](https://www.phoenixstrategy.group/blog/key-metrics-for-customer-acquisition-dashboards) — confirms "First Purchase Date" cohort logic standard
- KPI division-by-zero best practice: [graphed.com PowerBI guide](https://www.graphed.com/blog/how-to-calculate-percentage-change-in-power-bi) — confirms guard formula or BLANK fallback as standard

### Tertiary (LOW confidence — verified against codebase rather than authoritative external)

- ISO week formatting in date-fns-tz uses `RRRR-'W'II` pattern — verified format string is supported via date-fns format docs but not test-run in codebase. **Plan-author must verify with a single REPL print** (`formatInTimeZone(new Date(), "America/Bogota", "RRRR-'W'II")`) before relying on it. If it doesn't produce `2026-W18` shape, fall back to manual ISO week math.

## Metadata

**Confidence breakdown:**
- Stack reuse: HIGH — every library and component named is verified-installed via `package.json` and `ls`
- Architecture patterns: HIGH — every pattern named has a verified-existing precedent in Phase 2 or Phase 3
- Delta logic + zero-safe: HIGH — math is local, formula well-established, mirrored on existing zero-safe patterns in `bonos.ts`
- "Empresas nuevas" implementation: HIGH — single in-memory pass over already-cached data; cost negligible
- Bucket granularity heuristic: MEDIUM — 60-day threshold is defensible but not empirically tested; explicit punt to plan-author
- Cliente-foco edge cases: MEDIUM — `data-presenter-empresa-hide` mechanism is a NEW CSS contract; plan-author must verify it integrates cleanly with existing `data-presenter` infrastructure
- ISO week date-fns format string: LOW — pattern not verified live in codebase; plan-author must confirm

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (30 days; stack is stable, codebase patterns are mature)
**Re-research triggers:** Recharts v3 upgrade decision; shadcn chart component installation; major Tailwind v4 changes
