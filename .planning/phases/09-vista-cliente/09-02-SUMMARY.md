---
phase: 09-vista-cliente
plan: 02
subsystem: ui
tags: [react, server-components, client-component, lucide-react, tailwind, presenter, dossier]

# Dependency graph
requires:
  - phase: 09-vista-cliente
    provides: Plan 09-01 — cliente.ts domain module (ClienteSummary, ClienteBenchmark, ClienteP2P, ClienteP2PRow, ClienteTimelineEvent, ClienteTimelineEventType)
  - phase: 07-bonos
    provides: BonoSummaryV2 type from Plan 07-01 (consumed by BonosClienteCards)
  - phase: 08-tarjeta-recargas
    provides: PurchaseSummary type from Plan 08-01 (consumed by ComprasClienteCard)
  - phase: 06-foundation-v2
    provides: JoinedPayout type from Plan 06-02 (consumed by RetirosBancoTable)
  - phase: 06-foundation-v2
    provides: data-presenter-metric-hide CSS gate (consumed by RetirosBancoTable failure-reason cells)
provides:
  - TikintagSelector — Client Component path-based dossier switch (CLI-V2-01)
  - ClienteKPIHeader — 6-KPI cabecera with benchmark accent (CLI-V2-02 + CLI-V2-07)
  - RetirosBancoTable — JoinedPayout[] table with presenter-metric-hide on Razón de fallo (CLI-V2-03)
  - BonosClienteCards — 2-card in/out split over BonoSummaryV2 (CLI-V2-04)
  - P2PCards — 2-card header + raw <table> for ClienteP2P (CLI-V2-05)
  - ComprasClienteCard — single-card 3-stat compras summary (CLI-V2-06)
  - TimelineActivity — chronological feed with Lucide icons + status badges (CLI-V2-08)
affects:
  - 09-03 (Vista Cliente page composition mounts these 7 leaves on /clientes/[empresaId])

# Tech tracking
tech-stack:
  added: []  # No new dependencies (lucide-react ^1.11.0 already in package.json)
  patterns:
    - "Per-tikintag dossier leaf pattern (7 leaves over 4 domain types — ClienteSummary/Benchmark/P2P/Timeline + 3 cross-section types BonoSummaryV2/PurchaseSummary/JoinedPayout)"
    - "Inline Stat helper for KPI strip uniformity (ClienteKPIHeader Stat — 6 KPIs share shape, variant prop for benchmark accent)"
    - "Status badge inline helper per leaf (RetirosBancoTable, P2PCards, TimelineActivity each carry their own statusBadge() over the local status alphabet — no shared util module)"
    - "Counterparty special-case at leaf layer (TimelineActivity overrides domain's PURCHASE counterparty='empresa_nombre' to literal 'Compra tarjeta' until BD_Plataforma surfaces a true merchant column)"
    - "Presenter-hide separation (leaf vs page) — leaves carry data-presenter-metric-hide ONLY on internal-only sub-elements (failure-reason cells); whole-component presenter-hide is the page's responsibility"
    - "Native <select> + path-based router.push pattern (TikintagSelector mirrors EmpresaFilter shape but writes to URL path /clientes/{id} not searchParam)"

key-files:
  created:
    - src/components/clientes/TikintagSelector.tsx
    - src/components/clientes/ClienteKPIHeader.tsx
    - src/components/clientes/RetirosBancoTable.tsx
    - src/components/clientes/BonosClienteCards.tsx
    - src/components/clientes/P2PCards.tsx
    - src/components/clientes/ComprasClienteCard.tsx
    - src/components/clientes/TimelineActivity.tsx
  modified: []

key-decisions:
  - "Lucide icon mapping for ClienteTimelineEventType resolved at this leaf layer (open question from 09-01): ArrowDownLeft for IN flows, ArrowUpRight for OUT flows, ShoppingCart for PURCHASE, Banknote for RECHARGE_PSE/TRANSFER, CreditCard for PAYOUT_BANK, Activity fallback for OTRO."
  - "Status palette per leaf: badges use bg-status-{success|fail|pending}/10 + text-status-{...} class pair for in_progress/failed/rejected; completed renders without badge (absence is the green light) in TimelineActivity, with explicit 'Completado' badge in RetirosBancoTable + P2PCards (table contexts where badge presence is the column convention)."
  - "PURCHASE counterparty override at leaf: TimelineActivity replaces domain's empresa_nombre fallback (today equals tikintag, would render '$mario → $mario') with literal 'Compra tarjeta'. Single-point change when BD_Plataforma adds a true merchant column."
  - "TimelineActivity is the ONE place in the dossier where multiple section accents legitimately co-occur — they're taxonomic markers (ShoppingCart=text-section-tarjeta, Banknote=text-section-recargas, CreditCard=text-section-payouts), not page-level emphasis. This is orthogonal to the one-section-accent-per-page rule."
  - "ClienteKPIHeader is the ONLY component carrying text-section-clientes / border-section-clientes in the JSX (one-section-accent rule held). Other 6 leaves use text-foreground / text-muted-foreground for value class; status palette colors are independent of section accent."
  - "Empty states are per-leaf with consistent muted-foreground voice: 'Sin retiros para este tikintag en el período seleccionado.' / 'Sin P2P para este tikintag en el período seleccionado.' / 'Sin actividad registrada para este tikintag en el período seleccionado.'. Card chrome stays for layout stability across filter changes (BonosClienteCards / ComprasClienteCard render '0' values inside the card; RetirosBancoTable / P2PCards / TimelineActivity render the placeholder INSIDE the CardContent so the card title still anchors)."
  - "ComprasClienteCard renders as single card (3 inline stats), NOT as a 3-card strip — the dossier already houses 5 other sections; a 3-card Compras strip would compete for vertical space. Plan 09-03 visual checkpoint may add a recent-purchases mini-list inside if needed (deferred per YAGNI)."
  - "Per-direction ticket promedio derived locally in BonosClienteCards (BonoSummaryV2.ticketPromedio is across both directions; per-direction averages are the dossier value-prop)."
  - "Presenter-hide at the LEAF layer reserved for cell-level opt-outs (RetirosBancoTable failure-reason th/td carry data-presenter-metric-hide). Whole-component presenter-hide is the PAGE's responsibility — TimelineActivity gets wrapped in <div data-presenter-hide> by Plan 09-03, not at the leaf."
  - "TikintagSelector encodes tikintag with encodeURIComponent for $-prefix safety in URL path segments ($mario → %24mario per RFC 3986)."
  - "Native <select> over Combobox for the 235-tikintag list (matches EmpresaFilter convention; Combobox swap is non-breaking when list grows past ~500 because URL contract is the only stable surface)."

patterns-established:
  - "Per-tikintag dossier leaf split: 7 leaves consume 4 domain types from cliente.ts (Plan 09-01) plus 3 cross-section types (BonoSummaryV2 from Plan 07-01, PurchaseSummary from Plan 08-01, JoinedPayout from Plan 06-02). Leaves are pure presentational — no domain logic, no Sheets imports, no format gates leaked. Reusable shape for any future user-centric dossier."
  - "Status-badge-per-leaf-context pattern reaffirmed: RetirosBancoTable handles PayoutState alphabet (completed/in_progress/failed/OTRO_STATE); P2PCards + TimelineActivity handle Transaction.status alphabet (completed/rejected/failed/in_progress/...). Each leaf carries its OWN statusBadge() helper rather than sharing a util — the alphabets are different and the labels are context-specific. Same precedent as AgingAlert's displayBancoName / TopBancos's helper."
  - "Section accent as taxonomic marker (TimelineActivity icons): when multiple section accents co-occur as a key/legend (one-per-event-type), they read as taxonomy not emphasis. Distinct from page-level accent (one-per-page protagonist). Future leaves with cross-section event streams can adopt this pattern."
  - "Counterparty special-case at leaf (TimelineActivity PURCHASE override): when a domain field's UX rendering is unsatisfying TODAY but the domain shape will improve in the future, prefer leaf-layer override (single edit point) over domain-layer special-casing (would propagate the cosmetic concern into the pure aggregation surface)."
  - "Inline Stat helper component (ClienteKPIHeader): when a card carries N visually-uniform sub-blocks with a small variant axis, an inline component beats N hand-rolled divs. Variant prop ('default' | 'benchmark') threads the section accent without scattering Tailwind classes."

# Metrics
duration: 7min
completed: 2026-05-08
---

# Phase 9 Plan 2: cliente-leaves Summary

**Seven Vista Cliente v2 leaf components: 1 Client Component selector + 6 Server Components covering cabecera (with benchmark accent), retiros banco, bonos in/out, P2P split+table, compras card, timeline feed — pure presentational over Plan 09-01 domain types + reused v2 cross-section surfaces.**

## Performance

- **Duration:** 7 min (within target — 7 leaves at ~1176 LOC, ~150-200 LOC/leaf median)
- **Started:** 2026-05-08T04:38:38Z
- **Completed:** 2026-05-08T04:45:33Z
- **Tasks:** 2 / 2
- **Files modified:** 7 (created)

## Accomplishments

- **TikintagSelector.tsx (79 LOC, Client Component)** — Native `<select>` of all 235 tikintag options with path-based `router.push("/clientes/{encodeURIComponent(id)}{?qs}")`, preserving `searchParams` (filters + presenter mode) across switches. Mirrors `EmpresaFilter` import shape but writes to the URL PATH instead of a searchParam.
- **ClienteKPIHeader.tsx (235 LOC, Server Component)** — 6-KPI grid (Balance · Primera tx · Última actividad · Total tx · Pocket activo · Tiempo vs benchmark) inside a single Card. Benchmark KPI (#6) carries `border-l-4 border-section-clientes pl-3` accent + delta-sign semáforo subtext (faster=green, slower=red, equal=muted). Sample-size footer (`N vs M payouts`) renders for benchmark transparency. Inline Stat helper keeps grid uniform; variant prop threads the accent.
- **RetirosBancoTable.tsx (192 LOC, Server Component)** — Raw `<table>` over `JoinedPayout[]` with 7 columns (Fecha, Holder, Banco, Monto, Tiempo, Estado, Razón de fallo). Razón de fallo `<th>` + `<td>` carry `data-presenter-metric-hide` so the column collapses in presenter (3 attribute occurrences). Title-cased bank labels via inline `displayBanco` helper. Status badge per `PayoutState` (completed=verde, in_progress=amber, failed=rojo).
- **BonosClienteCards.tsx (97 LOC, Server Component)** — 2-card grid (Recibidos / Enviados) over `BonoSummaryV2`. Per-direction ticket promedio derived locally (`BonoSummaryV2.ticketPromedio` is across both directions; the dossier wants per-direction averages). Renders "—" when count === 0.
- **P2PCards.tsx (207 LOC, Server Component)** — 2-card header (Recibidas/Enviadas) + raw `<table>` "Últimas P2P" with Fecha · Dirección · Contraparte · Monto · Estado columns. Direction column color-asymmetric (in=text-status-success, out=text-foreground). Contraparte rendered with `font-mono` (tikintags). Counter-vs-row semantic split honored (counters honor `filters.status`; rows include all statuses). Inline P2PRow + statusBadge helpers.
- **ComprasClienteCard.tsx (96 LOC, Server Component)** — Single card with Compras totales headline + 2-column inline grid for Volumen / Ticket promedio. No recent-list (deferred to 09-03 visual checkpoint per YAGNI; the dossier already has 5 other sections so a 3-card Compras strip would compete for vertical space).
- **TimelineActivity.tsx (270 LOC, Server Component)** — Vertical `<ul>` of `ClienteTimelineEvent`s with Lucide icon + Spanish type label + meta line (date · counterparty) + right-aligned monto + status badge for non-completed. Icon map: ArrowDownLeft (IN flows, text-status-success), ArrowUpRight (OUT flows, text-foreground), ShoppingCart (PURCHASE, text-section-tarjeta), Banknote (RECHARGE_PSE/TRANSFER, text-section-recargas), CreditCard (PAYOUT_BANK, text-section-payouts), Activity (OTRO, text-muted-foreground). PURCHASE counterparty hardcoded to "Compra tarjeta" (overrides domain's empresa_nombre fallback). NO `data-presenter-*` attributes in the leaf — Plan 09-03 wraps in `<div data-presenter-hide>` at the page layer.

## Task Commits

1. **Task 1: TikintagSelector + ClienteKPIHeader + RetirosBancoTable + BonosClienteCards** — `4f60f44` (feat) — 4 files, 603 LOC
2. **Task 2: P2PCards + ComprasClienteCard + TimelineActivity** — `03793f7` (feat) — 3 files, 573 LOC

**Plan metadata commit:** [pending — committed after this SUMMARY lands]

## Files Created/Modified

- `src/components/clientes/TikintagSelector.tsx` — NEW; Client Component dropdown for tikintag selection (CLI-V2-01)
- `src/components/clientes/ClienteKPIHeader.tsx` — NEW; 6-KPI strip including benchmark with visual distinction (CLI-V2-02 + CLI-V2-07)
- `src/components/clientes/RetirosBancoTable.tsx` — NEW; Enriched payouts table for selected tikintag (CLI-V2-03)
- `src/components/clientes/BonosClienteCards.tsx` — NEW; Bonos in/out split for tikintag (CLI-V2-04)
- `src/components/clientes/P2PCards.tsx` — NEW; P2P sent/received cards + recent rows table (CLI-V2-05)
- `src/components/clientes/ComprasClienteCard.tsx` — NEW; Purchases summary card (CLI-V2-06)
- `src/components/clientes/TimelineActivity.tsx` — NEW; Chronological activity feed with icons (CLI-V2-08; presenter-hide candidate wrapped in 09-03)

## Decisions Made

### Open questions from 09-01 SUMMARY — resolved at this leaf layer

- **Icon mapping for `ClienteTimelineEventType`** — resolved as documented in `iconAndColor()` in TimelineActivity.tsx: 9-value union → 6 distinct Lucide icons (ArrowDownLeft + ArrowUpRight do double-duty for BONUS_IN/P2P_IN and BONUS_OUT/P2P_OUT respectively, distinguished by `typeLabel()` Spanish text + status badge). Icon color = section accent for cross-section types (PURCHASE→tarjeta, RECHARGE→recargas, PAYOUT_BANK→payouts), status palette for direction signals (IN flows = green = "money arrived"), muted for OTRO.
- **Status palette per leaf** — each leaf carries its own `statusBadge()` because the status alphabet differs: RetirosBancoTable handles `PayoutState` ("completed"/"in_progress"/"failed"/"OTRO_STATE"); P2PCards + TimelineActivity handle Transaction.status ("completed"/"rejected"/"failed"/"in_progress"/...). Same precedent as AgingAlert/TopBancos's inline `displayBancoName` (small helper inline beats new util module). RetirosBancoTable + P2PCards include "Completado/Completada" badge (table contexts where badge presence is the column convention); TimelineActivity OMITS the badge for completed (the absence IS the green light, reduces visual noise in a 200-event feed).
- **PURCHASE counterparty visual special-case** — resolved at the LEAF layer in TimelineActivity (not the domain). The domain's `counterpartyForTransaction` returns `t.empresa_nombre` for PURCHASE which today equals the tikintag itself ("$mario → $mario" reads weird). Leaf override `counterpartyLabel()` substitutes literal "Compra tarjeta". Single edit point when BD_Plataforma surfaces a true merchant column — revert the override, no domain churn.
- **Empty-state UX per leaf** — consistent muted-foreground voice ("Sin retiros para este tikintag en el período seleccionado.", "Sin P2P para este tikintag en el período seleccionado.", "Sin actividad registrada para este tikintag en el período seleccionado."). Cards-only leaves (BonosClienteCards / ComprasClienteCard) render "0" + "—" inside the card so chrome doesn't collapse; table-bearing leaves (RetirosBancoTable / P2PCards / TimelineActivity) render the placeholder INSIDE the CardContent so the card title still anchors the section.

### Other decisions

- **One-section-accent-per-page rule held strictly.** ClienteKPIHeader is the ONLY component with `text-section-clientes` / `border-section-clientes` in JSX (the benchmark KPI). Other 6 leaves use `text-foreground` / `text-muted-foreground` for value classes. Documented in JSDoc on each leaf.
- **TimelineActivity icons as taxonomic markers, not page accents.** The timeline is the ONE place where multiple section accents legitimately co-occur — they read as a key/legend (each event "belongs" to a section). Distinct from page-level emphasis. Documented in TimelineActivity.tsx JSDoc.
- **Presenter-hide separation: leaf carries cell-level opt-outs only.** RetirosBancoTable's failure-reason `<th>`/`<td>` carry `data-presenter-metric-hide`. Whole-component presenter-hide (TimelineActivity) is the PAGE's responsibility — Plan 09-03 wraps in `<div data-presenter-hide>`. Keeps the leaf reusable for future internal-only contexts where presenter mode shouldn't apply at all.
- **Native `<select>` over Combobox for 235-tikintag list.** Mirrors EmpresaFilter convention; Combobox swap is non-breaking when list grows past ~500 because URL contract is stable.
- **`encodeURIComponent` on tikintag in TikintagSelector.** Tikintags carry `$` (e.g. `$mario`); RFC 3986 reserves `$` outside path segments. `$mario` → `%24mario` in URL path; Next.js automatically decodes the param.
- **Per-direction ticket promedio derived locally in BonosClienteCards.** `BonoSummaryV2.ticketPromedio` is across both directions; the dossier UI wants per-direction averages. Two lines of arithmetic in the leaf rather than a domain-layer split.
- **ComprasClienteCard as single card (NOT 3-card strip).** The dossier already houses 5 sections; a 3-card Compras strip would compete for vertical space. Plan 09-03 visual checkpoint may add recent-purchases mini-list (deferred per YAGNI).
- **TimelineActivity OMITS "Completada" badge.** In a feed of up to 200 events, redundant badges on every successful row would dominate the visual field. The status badge appears ONLY for non-completed states (rejected/failed/in_progress) — by exception, not by default. Rationale: "the absence is the green light" — same convention as the AgingAlert "queue is healthy = no card" pattern (Plan 07-04).

## Deviations from Plan

### None

The plan's 7-component spec was followed exactly. All 7 files created with the specified shapes, props, imports, and styling. No bugs encountered during implementation; tsc + lint + build clean on every gate.

### Sub-threshold notes (not Rule deviations)

- **Plan's prescribed inline `formatMinutes` helper not needed in ClienteKPIHeader.** The plan said "Define a local `formatMinutes(min: number): string` helper inline (e.g. `> 60` → `\`${(min/60).toFixed(1)} h\``, `< 60` → `\`${Math.round(min)} min\``)". Reading `src/lib/format.ts` revealed `formatMinutes` already exists as the canonical helper (Phase 7-04 introduced it for the v2 Payouts cockpit; same shape with humanized output: "—" / "<1 min" / "X min" / "Xh Ymin" / "Xd"). Reused the canonical helper instead of duplicating — preserves the format-gate policy ("DO NOT instantiate `Intl.NumberFormat` outside `format.ts`"). Same applied for RetirosBancoTable's "Aging / Total Time" column.
- **TikintagSelector skipped `usePathname`.** The plan instructed not to use it (the path is hardcoded `/clientes/{id}` rather than reused via pathname). Confirmed implementation matches the plan's `<action>` block guidance ("`usePathname` is NOT used (we hardcode `/clientes/{id}`); use `useRouter` + `useSearchParams` from `next/navigation`").
- **TikintagSelector `<select>` className adapted.** EmpresaFilter's `<select>` doesn't carry `font-mono`, but tikintags ARE `$`-prefixed strings that read better in monospace. Added `font-mono` to the select itself + the option list. Negligible visual divergence; matches the Contraparte cell convention in P2PCards.

## Verification

- ✅ All 7 component files exist (`src/components/clientes/{TikintagSelector,ClienteKPIHeader,RetirosBancoTable,BonosClienteCards,P2PCards,ComprasClienteCard,TimelineActivity}.tsx`)
- ✅ Among the 7 NEW files, only TikintagSelector carries `"use client"` (other 6 are Server Components)
- ✅ No component imports from `server-only` or `lib/sheets/`. TikintagSelector imports `next/navigation` (the prescribed Client Component navigation hooks — matches EmpresaFilter's exact import shape; the plan's `key_links` explicitly lists this)
- ✅ `npx tsc --noEmit` clean (0 errors)
- ✅ `npm run lint` clean (0 errors, 3 pre-existing warnings unchanged from Phase 8 baseline: `ClientesTable.tsx:292` aria-sort, `rate-limit.ts:37` unused eslint-disable, `_utils.ts:128` unused eslint-disable)
- ✅ `npm run build` succeeds (still 13 routes — no new routes in this plan; page composition lands in 09-03)
- ✅ `data-presenter-metric-hide` appears 3 times in `RetirosBancoTable.tsx` (failure-reason `<th>` + `<td>` cells)
- ✅ `lucide-react` import in TimelineActivity.tsx (6 icons: ArrowDownLeft, ArrowUpRight, ShoppingCart, Banknote, CreditCard, Activity — Wallet from plan was unused, dropped per "no unused imports" lint rule)
- ✅ One-section-accent-per-page rule held: only `ClienteKPIHeader.tsx` carries JSX `text-section-clientes` / `border-section-clientes` (the benchmark KPI); other 6 leaves carry only the strings in JSDoc comments documenting the rule (NOT in JSX)
- ✅ TimelineActivity carries NO `data-presenter-*` JSX attributes (only the strings appear in JSDoc explaining the page-vs-leaf separation)

## Net LOC Added

- **Total LOC across 7 files:** 1176
- **Per-leaf median:** ~168 LOC
- **TikintagSelector:** 79 LOC (smallest — Client Component shape with single concern)
- **ClienteKPIHeader:** 235 LOC (largest — 6 KPIs + inline Stat helper + benchmark logic)
- **RetirosBancoTable:** 192 LOC (raw table + status badge + bank label helper)
- **BonosClienteCards:** 97 LOC (2-card grid, smallest of the cards-only leaves)
- **P2PCards:** 207 LOC (2 cards + raw table + statusBadge + P2PRow inline component)
- **ComprasClienteCard:** 96 LOC (single card, 3 inline stats — by-design compact)
- **TimelineActivity:** 270 LOC (icon map + label map + status badge + counterparty override + main render — largest because it carries 4 helper functions to keep the JSX flat)

JSDoc-heavy following the established `clientes.ts` / `cardUsage.ts` / `payouts.tsx` codebase style — each component opens with a substantial doc block explaining REQUIREMENTS traceability, layout intent, format gates, and presenter contract before any code.

## Confirmation: must_haves Contract

| must_have truth | Status | Evidence |
|---|---|---|
| TikintagSelector dropdown lists all 235 tikintag options and navigates to /clientes/{newTikintag} on change preserving searchParams | ✅ | Native `<select>` over `options` prop; `onChange` reads `searchParams.toString()` and threads as `?qs` if non-empty; encodeURIComponent on the new id |
| ClienteKPIHeader renders 6 KPIs in a single Card; benchmark KPI has visually distinct treatment | ✅ | 6 Stat blocks in `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`; benchmark Stat carries `variant="benchmark"` → `border-l-4 border-section-clientes pl-3` accent stripe + `text-section-clientes` headline + delta-sign subtext |
| RetirosBancoTable renders Holder, Bank, Aging (formatted), Status, Failure Reason columns over a JoinedPayout[] subset | ✅ | 7-column raw `<table>` (Fecha, Holder, Banco, Monto, Tiempo, Estado, Razón de fallo); formatMinutes for Tiempo; status badge for Estado; failure-reason cells carry `data-presenter-metric-hide` |
| BonosClienteCards renders received vs sent with counts + montos in 2 mini-cards | ✅ | 2-card `md:grid-cols-2` grid; countIn/countOut as PRIMARY headlines; montoIn/montoOut subtext; per-direction ticket promedio derived locally |
| P2PCards renders sent vs received cards plus a recent table of P2P rows | ✅ | 2-card header + raw `<table>` "Últimas P2P" with 5 columns; ClienteP2P consumed; rows already capped at 50 by domain |
| ComprasClienteCard renders count + volumen COP + ticket promedio personal | ✅ | Single Card with totalCompras headline + 2-col inline grid (Volumen / Ticket promedio); empty-state subtext |
| TimelineActivity renders chronological event list with icon-by-type and is wrappable in a presenter-hide container | ✅ | Vertical `<ul>` over `ClienteTimelineEvent[]`; iconAndColor() map → 6 distinct Lucide icons; NO `data-presenter-*` attributes in the leaf (Plan 09-03 wraps externally) |

| must_have artifact | Min lines | Actual | Status |
|---|---|---|---|
| TikintagSelector.tsx | ≥ 60 | 79 | ✅ |
| ClienteKPIHeader.tsx | ≥ 100 | 235 | ✅ |
| RetirosBancoTable.tsx | ≥ 70 | 192 | ✅ |
| BonosClienteCards.tsx | ≥ 60 | 97 | ✅ |
| P2PCards.tsx | ≥ 90 | 207 | ✅ |
| ComprasClienteCard.tsx | ≥ 50 | 96 | ✅ |
| TimelineActivity.tsx | ≥ 80 | 270 | ✅ |

| key_link | Status |
|---|---|
| ClienteKPIHeader.tsx → cliente.ts (consumes ClienteSummary + ClienteBenchmark) | ✅ types imported from `@/lib/domain/cliente` |
| TimelineActivity.tsx → cliente.ts (consumes ClienteTimelineEvent[]) | ✅ ClienteTimelineEvent + ClienteTimelineEventType imported from `@/lib/domain/cliente` |
| TikintagSelector.tsx → next/navigation (useRouter + useSearchParams) | ✅ both hooks imported (usePathname intentionally NOT imported per plan) |
| RetirosBancoTable.tsx → join.ts (props are JoinedPayout[]) | ✅ JoinedPayout imported from `@/lib/domain/join` |

## Open Questions for Plan 09-03

- **Should ComprasClienteCard add a recent-purchases mini-list?** Currently it's a single card with 3 stats (count, volumen, ticket promedio). Plan 09-03 visual checkpoint may reveal that a recent-list is needed for parity with the dossier's other "table" sections (RetirosBancoTable, P2PCards, TimelineActivity). If so: add a `purchases?: Transaction[]` prop and render an inline recent-list inside the same card; no new leaf needed.
- **Page-layer presenter-hide wrappers** — Plan 09-03 is responsible for wrapping `<TimelineActivity>` in `<div data-presenter-hide>` at the page composition level. Per CONTEXT.md essentials, the presenter-hide alcance might extend beyond timeline (raw failure reasons, comparativos, anomalías). RetirosBancoTable's failure-reason cells already carry `data-presenter-metric-hide`; future internal-only intelligence layers (comparativos, anomalías) would land as separate sections in the page composition with their own presenter wrappers.
- **Page composition data flow** — page must run `joinPayouts(allTx, allPayouts)` ONCE per request (per Plan 09-01 contract) and thread the JoinedPayout[] result into BOTH `aggregateClienteBenchmark` AND `aggregateClienteTimeline` AND the narrowed `RetirosBancoTable` payouts prop. Plan 09-03 must not call `joinPayouts` more than once.
- **Tikintag list source** — TikintagSelector takes `options: { id, nombre }[]` as a prop. Page composition must derive the 235-tikintag list from `findClientesIndex` (Plan 09-01's clientes.ts neighbor) or a similar empresa registry, sorted alphabetically by id, and thread it down. The current `clientes.ts` `findClientesIndex` returns `{ tikintag, nombre }` shape — straightforward map to `{ id, nombre }`.
- **Default tikintag when route param undefined** — `/clientes/[empresaId]` route requires a tikintag. Plan 09-03 must handle the case where `findClienteSummary` returns `null` (unknown tikintag) with a 404-style fallback. The selector itself never rendered without a `current` value (the page guarantees it).

## Phase 9 Carry-Forward Status

This plan does NOT consume any of the 22 deferred-prune symbols from Phases 7/8 (bonos.ts: 8, payouts.ts: 4, recargas.ts: 10). All 7 leaves consume v2 surfaces directly:
- `BonoSummaryV2` (Plan 07-01) — NOT a deferred symbol
- `PurchaseSummary` (Plan 08-01) — NOT a deferred symbol
- `JoinedPayout` (Plan 06-02) — NOT a deferred symbol
- `ClienteSummary` / `ClienteBenchmark` / `ClienteP2P` / `ClienteP2PRow` / `ClienteTimelineEvent` / `ClienteTimelineEventType` (Plan 09-01) — NEW

Plan 09-03 (page composition) is the plan that finally completes the prune backlog by replacing `EmpresaMiniCards` and the v1 page body in `clientes/[empresaId]/page.tsx`, freeing the 22 deferred symbols for cohesive removal.
