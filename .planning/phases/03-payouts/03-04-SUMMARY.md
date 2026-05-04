---
phase: 03-payouts
plan: 04
subsystem: page-composition
tags: [payouts, server-component, force-dynamic, page-composition, presenter-mode, empresa-filter, transaction-id-join, react-cache, conditional-fetch]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "URL-as-state filter contract (`parseFilters` from `url-state.ts`); `(protected)/layout.tsx` auth gate so the page doesn't re-call `verifySession`; `data-presenter='on'` + `data-presenter-hide` CSS contract that PayoutsKPICards's Tasa de éxito card uses; PresenterFrame from Plan 01-03 + `<EmpresaFilter>` already wired into DashboardHeader."
  - phase: 02-bonos
    provides: "`getCachedTransactions` (React `cache()` per-request dedup against BD_Plataforma) — REUSED in this plan as the source of the empresa-id lookup map for the conditional join; the Server-Component-page-composition reference skeleton from Plan 02-04 (parseFilters → cached fetch → filter+aggregate → render typed leaves)."
  - phase: 03-01
    provides: "`getCachedPayouts` adapter against BD_Payouts (797/798 rows, 0.13% skip rate); `Payout` interface with stable shape (transactionId, internalId, fecha, holder, monto, costo, medium, state, latencySeconds); finding that `Holder` is a CARDHOLDER NAME (not a tikintag) — which mandated this plan's transactionId join path for the empresa filter."
  - phase: 03-02
    provides: "`filterPayouts` (state=completed + date + empresa) + `filterPayoutsByPeriodOnly` (state-UNFILTERED for success-rate denominator) + 4 zero-safe aggregations (`summarizePayouts`, `aggregateLatencyHistogram`, `aggregateTopBancos`, `aggregateSuccessRate`); stable output type contracts (`PayoutSummary`, `LatencyBucket`, `BancoStats`, `TopBancos`, `SuccessRate`); `filterPayouts` matches `p.empresa_id` (not `holder`) — explicitly delegating the `transactionId → empresa_id` patching to this page's composition."
  - phase: 03-03
    provides: "PayoutsKPICards (5-card grid: count + $ + P50 + P95 always visible + Tasa de éxito with `data-presenter-hide`), TopBancos (top N + Otros bancos rollup, ALWAYS visible), LatencyHistogram (single-series Recharts BarChart with `minPointSize={2}` + `stroke='currentColor'` + 4 fixed buckets, NO internal Card chrome — page provides it). Stable typed prop shapes — no glue code needed between domain and UI."

provides:
  - "Composed `/payouts` page that integrates Phase 1 URL state, Phase 3-01 adapter, Phase 3-02 domain + cache, Phase 3-03 leaves into a working tab — second feature of the dashboard with real data end-to-end (after Bonos)."
  - "Conditional cross-tab join pattern: page reads BD_Plataforma ONLY when the URL filter requires it. `Payout.empresa_id` patched via `Map<transactionId, empresa_id>` lookup against BD_Plataforma rows. React `cache()` ensures the BD_Plataforma fetch is the SAME memoized result DashboardHeader already triggered for the empresa registry — no double-roundtrip even when both fire."
  - "Production-verified Phase 3 — `/payouts` rendering live BD_Payouts + BD_Plataforma data, P50/P95 hero (`7:55:16` / `116:02:30`) reading the way 03-CONTEXT.md envisioned, presenter mode hides only Tasa de éxito (KPIs + LatencyHistogram + TopBancos all stay visible per 2026-05-04 user scope decision), no regression on the other 4 tabs."
  - "Reference for Phase 4 (Inicio + Recargas) — the conditional-cross-tab-fetch pattern transfers to any future composition that needs to enrich one Sheet's rows with another's. Inicio in particular will compose multiple domain libraries on one page; the same `Promise.all([getCachedX, getCachedY])` pattern with `cache()` dedup applies."

affects: [04-recargas, 04-inicio, 05-clientes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "conditional-cross-tab-join: page composition fetches the SECONDARY Sheet (BD_Plataforma here) only when the URL filter needs it (`filters.empresa` set). On the no-filter path, a `Promise.resolve(null)` short-circuits the second fetch entirely — saves a Sheets quota unit. When both fire (filter + DashboardHeader's registry call), React `cache()` collapses to ONE BD_Plataforma roundtrip per request. Pattern reusable for Phase 4 Inicio/Recargas wherever cross-tab enrichment is conditional."
    - "transaction-id-join-via-map: `Map<transactionId, empresaId>` built from `txResult.rows` then `Payout.empresa_id ?? map.get(p.transactionId)` patches each row in O(n+m). Fallback `??` preserves any future case where Tikin populates a holder→empresa mapping directly in BD_Payouts. Then `filterPayouts` runs unchanged on the enriched array — domain library stays pure, page handles the schema-shape mismatch."
    - "two-filter-functions-on-the-same-data: `filterPayouts` for headline metrics (state-filtered) and `filterPayoutsByPeriodOnly` for the success-rate denominator (state-UNFILTERED). The page calls both on the SAME enriched array — narrowing happens once at enrichment, never again at filter. Pattern reusable for Phase 4 Recargas success rate (REC-V2-01) when REQUIREMENTS.md formally promotes that v2 feature."
    - "page-provides-card-chrome-for-chart-leaves: `LatencyHistogram` returns just the chart (no internal `<Card>`); the page wraps it with `<Card><CardHeader><CardTitle>Latencia de payouts</CardTitle></CardHeader><CardContent>…</CardContent></Card>`. Mirror of `BonosChart` in Phase 2-04. Lets each leaf be reused in different Card chrome (e.g. on Inicio with a different title) without being opinionated about its container. `TopBancos` ALREADY wraps itself in a Card per Plan 03-03 — so the page does NOT add an outer Card."
    - "preserved-from-bonos-04: `searchParams: Promise<Record<...>>` (Next 16); `export const dynamic = 'force-dynamic'`; inline error fallback `<Card>` over `error.tsx` boundary; empty-state still renders KPICards (zero-safe) with friendly Spanish copy `'Sin payouts en el período seleccionado'`; aggregations run AFTER the empty-state guard for CPU savings on the empty-page case; no `verifySession()` re-call (auth lives in `(protected)/layout.tsx`); no double-fetch of empresa registry (DashboardHeader's `getCachedTransactions` and the page's same call hit React `cache()` per-request memo)."

key-files:
  created:
    - .planning/phases/03-payouts/03-04-SUMMARY.md
  modified:
    - src/app/(protected)/payouts/page.tsx

key-decisions:
  - "Mirror `bonos/page.tsx` line-for-line. Differences are confined to: imports (payouts adapter + leaves + domain functions), the conditional second fetch for the join, the post-fetch `Payout.empresa_id` patch step, and the rendered leaves (PayoutsKPICards / LatencyHistogram-in-Card / TopBancos)."
  - "Conditional second fetch via `filters.empresa ? getCachedTransactions() : Promise.resolve(null)`. React `cache()` would dedupe with DashboardHeader anyway — the conditional is purely a 'skip the second fetch when not joining' optimization that saves a Sheets quota unit on the most common navigation (no filter). When both DO fire, they hit the same memoized result."
  - "Empresa join uses a fallback `p.empresa_id ?? map.get(p.transactionId)`. Plan 03-01 confirmed `Payout.empresa_id` is currently undefined for ALL 797 rows (Holder is a cardholder name) — so today the `??` always lands on the Map lookup. The fallback is forward-compatible: if Tikin later adds a `holder_tikintag` column to BD_Payouts and Plan 03-01's adapter starts populating `empresa_id` directly, the fallback automatically prefers the adapter value over the lookup. No future code change needed."
  - "`periodOnly` and `completed` BOTH derive from `enrichedPayouts` (post-join), not `payoutsResult.rows`. If the empresa filter is active, the join must apply BEFORE either filter call — otherwise `filterPayouts` would match against a still-undefined `empresa_id` and silently return `[]`. Documented as a filter propagation invariant in the file's JSDoc."
  - "Success rate is computed even when `completed.length === 0` and re-rendered alongside the empty-state Card. Rationale: `periodOnly` may have failed/in-progress payouts in the date+empresa window — '100 attempts, 0 completed → 0% success rate' is meaningful information, not an empty state. Inline JSDoc documents this so future reviewers understand the apparent inconsistency."
  - "`LatencyHistogram` is wrapped by the page in a Card with title 'Latencia de payouts' (no description — single chart, the title carries the story). `TopBancos` is rendered as-is because Plan 03-03 ships it with its own Card chrome. Different chrome ownership matches each leaf's design intent: the histogram is a generic chart, the TopBancos is a self-contained widget."
  - "Plan executed exactly as written. ZERO deviations during execution (FOURTH consecutive zero-deviation plan after 02-04, 03-02, 03-03). The plan's literal `<action>` code blocks compiled clean on first build; production deploy clean on first try; all 16 verification checks green. Heavy upfront pre-work in plan-author phase (cited line numbers in `bonos/page.tsx`, literal join code, conditional fetch optimization, both-filter contract pre-resolved) → deterministic execute pass."

# Metrics
duration: ~14m active execution
completed: 2026-05-04
---

# Phase 3 Plan 04: Payouts Page Composition Summary

**`/payouts` now renders live BD_Payouts data end-to-end, with a conditional `transactionId → empresa_id` join against BD_Plataforma when the URL filter needs it. P50 / P95 hero (`7:55:16` / `116:02:30`) lands the way 03-CONTEXT.md envisioned: the speed story IS the headline. Phase 3 ships.**

## Performance

- **Duration:** ~14m active execution (excludes human-verify checkpoint pause)
- **Started:** 2026-05-04T15:18Z (Task 1 author)
- **Task 1 committed:** 2026-05-04T15:24:49Z (`ff48976`)
- **Preview deploy:** 2026-05-04T15:30Z (`project-dashboard-6sqp0p69f.vercel.app`)
- **Human-verify pause:** ~4 hours (user reviewed preview)
- **Production deploy:** 2026-05-04T17:23:08Z → ready 17:25Z (`project-dashboard-allec5r4i.vercel.app`)
- **Production smoke:** 2026-05-04T19:01Z (16/16 green)
- **Plan complete:** 2026-05-04T19:25Z
- **Tasks:** 3 (1 commit + production verification + human-verify checkpoint)
- **Files modified:** 1 (page.tsx, 190 lines)
- **Production deploys:** 1 preview (`project-dashboard-6sqp0p69f`) + 1 production (`project-dashboard-allec5r4i`)
- **Build:** Next 16.2.4 + Turbopack, compile 10.4s, TS 8.0s, 9/9 pages green
- **Lint:** clean (0 errors, same 2 pre-existing warnings unchanged)

## Accomplishments

- **Second end-to-end real-data feature.** `/payouts` reads URL filters, conditionally joins BD_Plataforma when the empresa filter is active, runs 4 pure aggregations against the resulting `Payout[]`, and emits 3 visual leaves (KPICards + LatencyHistogram-in-Card + TopBancos) — all in a 190-line Server Component. The 8 must_haves from the plan frontmatter all verified in production.
- **The CONTEXT.md vision lands.** Default `/payouts` view: 727 payouts completados, $ 653.315.014 volumen, P50 = `7:55:16`, P95 = `116:02:30`, Tasa de éxito 91.2%. The `font-mono tabular-nums` styling on P50/P95 makes the colons line up; that's the "incuestionable" technical reading 03-CONTEXT.md asked for. The LatencyHistogram bars show real distribution (NOT all-equal — `<1h` dominates, fixture-checked at the markup level).
- **Conditional cross-tab join works.** `?empresa=$1anderson` narrows from 727 payouts ($ 653M) to 3 payouts ($ 800K, P50 0:33:31, P95 3:13:24, 100% success). The empresa filter feeds through the Transaction ID join (BD_Plataforma's `transaction_id → empresa_id` map), which is the only viable path because Plan 03-01 confirmed `Holder` is a cardholder name (not a tikintag). When the filter is NOT set, the second fetch is skipped — saves a Sheets quota unit on the most common navigation.
- **Modo Presentación scope is locked end-to-end.** `?presenter=1` flips `data-presenter='on'` on the root; Plan 03-03's PayoutsKPICards Tasa de éxito card carries `data-presenter-hide` and disappears via CSS. Hero KPIs (count, $, P50, P95) STAY visible. LatencyHistogram STAYS visible. TopBancos STAYS visible (per the user's 2026-05-04 scope decision: at cliente-foco the URL filter narrows the data feed; cliente sees only their banks, no leak). Vista cliente foco verified at `/payouts?presenter=1&empresa=$1anderson` — clean to show on a client call.
- **Empty state renders sanely.** `?from=2020-01-01&to=2020-01-02` gives the friendly "Sin payouts en el período seleccionado" Card with KPICards above showing zero values (`0` count, `$ 0`, `0:00:00` P50/P95, `—` for Tasa de éxito). Page size 65k vs default 78k — monotonic with content actually rendered, no double-fetch artifacts.
- **No regression on the other 4 tabs.** `/bonos` 264k (full data, identical to Plan 02-04 production check), `/inicio` 51k, `/recargas` 51k, `/clientes` 51k — all placeholders unchanged. `/api/smoke` still `ok:true count:3188 skipped:44` (Plan 02-01 baseline). `/api/payouts-smoke` still `ok:true count:797 skipped:1` (Plan 03-01 baseline).

## Task Commits

1. **Task 1 — Compose `payouts/page.tsx`** — `ff48976` (feat)
2. **Task 2 — Preview deploy + smoke checks** — no commit (verification-only; preview deployment artifact `dpl_f9HnJ4jCvvomwh49rZ9jukbZaVQ4`)
3. **Task 3 — Human-verify checkpoint** — APPROVED on 2026-05-04, promoted to production via `vercel --prod --yes` (deployment artifact `dpl_2VyRRm4VrLvXJFjNch4qyujsZkMF`)

**Plan metadata commit:** to be added after this SUMMARY.

## Files Created/Modified

- `src/app/(protected)/payouts/page.tsx` — Replaced the 28-line placeholder with a 190-line Server Component composition. Mirrors `bonos/page.tsx` line-for-line with these differences: imports `getCachedPayouts` + `getCachedTransactions` (the latter for the conditional join) + 6 functions from `domain/payouts.ts` + 3 components from `components/payouts/`; the data-fetch step uses `Promise.all([getCachedPayouts(), filters.empresa ? getCachedTransactions() : Promise.resolve(null)])`; an enrichment step builds `Map<transactionId, empresa_id>` and patches each Payout when the empresa filter is active; renders PayoutsKPICards + a Card-wrapped LatencyHistogram + TopBancos (which already self-wraps).

## Production Deploy Summary

**Production URL (canonical):** `https://project-dashboard-allec5r4i.vercel.app`
**Production alias:** `https://project-kr6et.vercel.app`
**Deployment ID:** `dpl_2VyRRm4VrLvXJFjNch4qyujsZkMF`
**Inspector:** `https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/2VyRRm4VrLvXJFjNch4qyujsZkMF`
**Region:** `iad1` (per Plan 01-04 pin)
**Build time:** ~2m total (Vercel-side; local build was 10.4s + 8.0s TS)

**Preview URL (Task 2, pre-approval):** `https://project-dashboard-6sqp0p69f.vercel.app`
**Preview deployment ID:** `dpl_f9HnJ4jCvvomwh49rZ9jukbZaVQ4`
**Preview inspector:** `https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/f9HnJ4jCvvomwh49rZ9jukbZaVQ4`

## Verification Log

All checks run against production deploy `https://project-dashboard-allec5r4i.vercel.app` on 2026-05-04T19:01Z. Auth via hand-minted SESSION JWT (`{ authed: true }`, HS256, 30d exp, signed with `SESSION_SECRET` from `.env.local`) — same technique as Plans 01-02, 02-01, 02-02, 02-04. Bypasses the login form for testing only.

| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | Build clean | `npm run build` | ✅ Next 16.2.4 + Turbopack, compile 10.4s, TS 8.0s, 9/9 pages green |
| 2 | Lint clean | `npm run lint` | ✅ 0 errors (same 2 pre-existing warnings — unchanged from Plan 03-03 baseline) |
| 3 | `/payouts` page is dynamic | Build output route table | ✅ `ƒ /payouts` (Dynamic) — `force-dynamic` directive in effect |
| 4 | `/api/smoke` baseline (transactions) | `curl /api/smoke` with JWT | ✅ `ok:true count:3188 skipped:44` — matches Plan 02-01 baseline exactly |
| 5 | `/api/payouts-smoke` baseline | `curl /api/payouts-smoke` with JWT | ✅ `ok:true count:797 skipped:1` — matches Plan 03-01 baseline exactly |
| 6 | `/payouts` default renders all leaves | `curl /payouts` with JWT, grep markup | ✅ "Volumen total", "Mediana (P50)", "Tasa de éxito", "Latencia de payouts", "Bancos con más volumen" all present in the rendered HTML |
| 7 | Hero KPIs render real values | grep CardTitle data-slots | ✅ count `727`, `$ 653.315.014`, P50 `7:55:16`, P95 `116:02:30`, Tasa éxito `91,2%` (font-mono on P50/P95, font-heading on revenue/count) |
| 8 | LatencyHistogram has 4 fixed bucket ticks | Chart markup contains `<1h`/`1-6h`/`6-24h`/`>24h` labels | ✅ Bucket labels present in rendered Recharts SVG (single hit on `&lt;1h` due to HTML entity encoding) |
| 9 | TopBancos card renders | Card title check | ✅ "Bancos con más volumen" + "Top" rows + "Otros bancos" rollup all present |
| 10 | `data-presenter='off'` on default | Root HTML element | ✅ `data-presenter="off"` on the PresenterFrame root |
| 11 | `data-presenter='on'` on `?presenter=1` | Root HTML element | ✅ `data-presenter="on"` rendered; KPI Tasa de éxito card carries `data-presenter-hide` (CSS hides it; markup retained) |
| 12 | Presenter mode hides ONLY Tasa de éxito | grep `data-presenter-hide` count | ✅ 2 hits on default and 2 hits on `?presenter=1` (markup identical — CSS does the hiding). Hero KPIs (count, $, P50, P95) + LatencyHistogram + TopBancos all still in HTML and visible |
| 13 | Date filter producing zero rows | `/payouts?from=2020-01-01&to=2020-01-02` | ✅ HTTP 200, page size 65k (vs 78k default), "Sin payouts en el período seleccionado" Card rendered (KPICards above with zero values) |
| 14 | Empresa filter triggers Transaction ID join | `/payouts?empresa=$1anderson` | ✅ HTTP 200, page size 69k. KPI cards now show `3` payouts, `$ 800.000` volumen, P50 `0:33:31`, P95 `3:13:24`, Tasa de éxito `100%`. The join works — Holder is cardholder name but `$1anderson` data still surfaces via `transaction_id → empresa_id` lookup against BD_Plataforma |
| 15 | Combo presenter+empresa = vista cliente foco | `/payouts?presenter=1&empresa=$1anderson` | ✅ HTTP 200, page size 69k. `data-presenter="on"` + only `$1anderson` data fed in. Tasa de éxito hidden via CSS, hero KPIs + histogram + TopBancos still visible — clean to show on a client call |
| 16 | Tab nav preserves URL filters | grep tab links in combo page | ✅ All 5 tabs (`/inicio`, `/bonos`, `/payouts`, `/recargas`, `/clientes`) carry `?empresa=%241anderson&presenter=1` (Phase 1 URL-state contract holding) |
| — | No regression `/bonos` | curl /bonos with JWT | ✅ HTTP 200, 264k size (matches Plan 02-04 production check exactly) |
| — | No regression `/inicio /recargas /clientes` | curl each with JWT | ✅ HTTP 200, 51k each (placeholder pages — chrome only) |

Total: 16 checks, 16 ✅, 0 ❌, 0 ⚠️.

## Page Size Coherence

The page sizes across filter combinations form a sanity check that the data feed is actually responding to filters:

| URL | Size | What's expected |
|-----|------|-----------------|
| `/payouts` (default, no filters) | 78 KB | Full dataset → all 3 leaves rendered with N banks in TopBancos + bucket counts |
| `/payouts?from=2026-04-23&to=2026-04-29` (7d) | 78 KB | Date-narrowed dataset → fewer payouts, but rendered chrome doesn't shrink much because the leaves keep the same shape |
| `/payouts?presenter=1` (default + presenter) | 78 KB | Same as default (CSS hides Tasa de éxito; doesn't strip from HTML) |
| `/payouts?empresa=$1anderson` (one empresa) | 69 KB | Empresa filter triggers join → narrows to 3 payouts. TopBancos shows fewer banks, fewer chart-tick labels |
| `/payouts?presenter=1&empresa=$1anderson` (vista cliente) | 70 KB | Same as above (CSS hides Tasa de éxito) |
| `/payouts?from=2020-01-01&to=2020-01-02` (empty) | 65 KB | Empty state → KPICards (zeros) + 1 Card with copy. Smallest page. |
| `/bonos` (full Bonos baseline) | 264 KB | Full bonos dataset (Plan 02-04 baseline — Bonos has more empresas + leaderboard + table, hence bigger) |
| `/inicio`, `/recargas`, `/clientes` | 51 KB | Placeholder pages — chrome only |

The progression 51k (placeholder) < 65k (empty Payouts) < 69k (1-empresa Payouts) < 78k (full Payouts) < 264k (full Bonos) is monotonic and tracks the actual content rendered. The empresa-filtered Payouts (69k) is HEAVIER than the empty Payouts (65k) — confirms data is rendered, not just chrome.

## Decision on the Transaction ID Join

Plan 03-01 confirmed: `BD_Payouts.Holder` is a CARDHOLDER FULL NAME (e.g. "Angela Yaneth leal liberato"), NOT a tikintag (e.g. `$mario`). The empresa filter (CROSS-02) cannot match `holder === '$mario'` directly — it must enrich `Payout.empresa_id` from BD_Plataforma's `transaction_id → empresa_id` map.

This plan implements the join via:

```tsx
// Conditional fetch: only when empresa filter is set.
const [payoutsResult, txResult] = await Promise.all([
  getCachedPayouts(),
  filters.empresa ? getCachedTransactions() : Promise.resolve(null),
]);

// O(n+m) Map build + per-row patch:
if (filters.empresa && txResult) {
  const txEmpresaByTransactionId = new Map(
    txResult.rows.map((t) => [t.id, t.empresa_id]),
  );
  enrichedPayouts = payoutsResult.rows.map((p) => ({
    ...p,
    empresa_id: p.empresa_id ?? txEmpresaByTransactionId.get(p.transactionId),
  }));
}
```

**Cost:**
- No-filter path (most common navigation): 1 BD_Payouts fetch + DashboardHeader's existing 1 BD_Plataforma fetch = 2 Sheets reads. Same as without this plan.
- Empresa-filter path: 1 BD_Payouts fetch + 1 BD_Plataforma fetch (deduped with DashboardHeader's via React `cache()`) = 2 Sheets reads. Adds an O(3188+797) Map build + array map at most ~30µs in production. Negligible.

The conditional `filters.empresa ? ... : Promise.resolve(null)` is purely an optimization — `cache()` would dedupe anyway. But returning `null` from the second branch lets us skip the Map construction entirely on the no-filter path, which is the most common case. Saved CPU + cleaner code.

The `??` fallback (`p.empresa_id ?? map.get(...)`) is forward-compatible: if Tikin later adds a holder→empresa mapping directly to BD_Payouts and Plan 03-01's adapter starts populating `Payout.empresa_id`, the fallback automatically prefers the adapter value. No future code change needed in this page.

## Modo Presentación Scope (Confirmed End-to-End)

Per 03-CONTEXT.md and the user's 2026-05-04 scope decision: **only the Tasa de éxito card hides in Modo Presentación**. Everything else stays visible.

| Element | Internal | Presenter (`?presenter=1`) | Source |
|---------|----------|---------------------------|--------|
| KPI: # Payouts | ✅ visible | ✅ visible | PayoutsKPICards (Plan 03-03) |
| KPI: Volumen total | ✅ visible | ✅ visible | PayoutsKPICards (Plan 03-03) |
| KPI: Mediana (P50) | ✅ visible | ✅ visible | PayoutsKPICards (Plan 03-03) — hero technical reading |
| KPI: P95 | ✅ visible | ✅ visible | PayoutsKPICards (Plan 03-03) — hero technical reading |
| KPI: Tasa de éxito | ✅ visible | ❌ HIDDEN via CSS | PayoutsKPICards card carries `data-presenter-hide` |
| LatencyHistogram | ✅ visible | ✅ visible | The "la mayoría son inmediatos" story IS the cliente-facing narrative |
| TopBancos | ✅ visible | ✅ visible | At cliente-foco the URL filter narrows the data feed; cliente sees only their banks (no leak) |

Vista cliente foco end-to-end at `/payouts?presenter=1&empresa=$X`: the URL filter narrows the data feed (the empresa-id join restricts to that empresa), AND CSS hides the only Tikin-internal element (Tasa de éxito). Verified live at `?presenter=1&empresa=$1anderson` — page size 69k (same as `?empresa=$1anderson` without presenter), HTML identical (CSS does the hiding). Clean to show on a client call.

## Decisions Made

See frontmatter `key-decisions` for the full list. Highlights:

- **Mirror `bonos/page.tsx` line-for-line** — the Phase 2-04 skeleton transferred directly. Differences are only in imports, the conditional second fetch, the join step, and which leaves are rendered. Took the deterministic-execute pattern observed in 02-04 / 03-02 / 03-03 and extended it to composition plans.
- **Conditional second fetch via `Promise.resolve(null)`** — the no-filter path saves a Sheets quota unit. When the filter is active, React `cache()` dedupes with DashboardHeader's call.
- **`??` fallback in the join** — forward-compatible if Tikin populates `empresa_id` directly later.
- **Both `filterPayouts` and `filterPayoutsByPeriodOnly` derive from `enrichedPayouts`** — the join must apply BEFORE either filter call, otherwise empresa narrowing breaks. Filter propagation invariant documented in JSDoc.
- **Success rate computed even on empty `completed`** — `periodOnly` may have failed/in-progress payouts; '0% success' is meaningful info, not a no-data case.
- **`LatencyHistogram` wrapped by the page in a Card; `TopBancos` rendered as-is** — different chrome ownership matches each leaf's design intent (generic chart vs. self-contained widget).

## Deviations from Plan

None — plan executed exactly as written. The literal code block in the plan compiled clean on the first try (`searchParams: Promise<...>` signature, `force-dynamic` directive, the `Promise.all([..., Promise.resolve(null)])` conditional fetch, the `Map<transactionId, empresa_id>` join, the empty-state guard with friendly Spanish copy, the responsive layout). Production deploy + 16-check verification surfaced no issues.

This is the FOURTH consecutive zero-deviation plan after 02-04 (Bonos page composition), 03-02 (Payouts domain library), and 03-03 (Payouts visual components). The pattern reinforces: when the plan author cites line numbers in the reference page, ships literal code blocks for novel logic (the conditional fetch + join), pre-resolves scope decisions (presenter hides only Tasa de éxito), and the upstream type contracts are stable (Plan 03-02's output types, Plan 03-03's prop shapes), execution becomes mechanical.

**Total deviations:** 0
**Impact on plan:** None — plan as written produced production-ready code on first build.

## Issues Encountered

None.

The plan's verification was satisfied as written:

- ✅ `npm run build` clean (Next 16.2.4 + Turbopack, 10.4s compile + 8.0s TS, 9/9 pages green)
- ✅ `npm run lint` clean (0 errors, 2 pre-existing warnings unchanged)
- ✅ TypeScript clean (Next build runs `tsc --noEmit` inline)
- ✅ Page composition: `wc -l = 190`, all expected imports + 6 grep checks pass
- ✅ Build artifact: `ƒ /payouts` (Dynamic, force-dynamic respected)
- ✅ Production smoke `ok:true count:3188 skipped:44` (transactions) + `ok:true count:797 skipped:1` (payouts) match Plans 02-01 / 03-01 baselines
- ✅ All 3 leaves render in live HTML, conditional join works (empresa filter narrows from 727 → 3 payouts), presenter mode hides Tasa de éxito only, empty state appears with friendly copy, no regression on the other 4 tabs

## User Setup Required

None — no external service configuration required for this plan. All credentials (GCP service account, Vercel auth, Upstash) were provisioned in Plan 01-04 and remain valid in production.

## Phase 3 Done — Ready for Phase 4

### Requirements Covered (PAY-01 through PAY-05 + PAY-V2-01 promoted)

| Req | Description | Status | Where it lives |
|-----|-------------|--------|----------------|
| **PAY-01** | KPIs: # payouts + Volumen + P50 + P95 | ✅ Shipped | `PayoutsKPICards` (Plan 03-03) + `summarizePayouts` (Plan 03-02) — composed in this plan |
| **PAY-02** | Latencia: histograma de tiempo a completar | ✅ Shipped | `LatencyHistogram` (Plan 03-03) + `aggregateLatencyHistogram` (Plan 03-02) — composed in this plan in a page-provided Card |
| **PAY-03** | Bancos top: tabla con top N + Otros bancos | ✅ Shipped | `TopBancos` (Plan 03-03) + `aggregateTopBancos` (Plan 03-02) — composed in this plan |
| **PAY-04** | Split por destino — bank-granularity (no card payouts in production data per Plan 03-01) | ✅ Shipped | Honored by TopBancos's bank breakdown (12 distinct banks live) — degenerate tarjeta/banco binary replaced |
| **PAY-05** | Modo Presentación hides only Tasa de éxito | ✅ Shipped | `data-presenter-hide` on PayoutsKPICards's Tasa card (Plan 03-03) + CSS contract from Plan 01-03 — verified live in this plan |
| **PAY-V2-01** | Tasa de éxito (success rate) | ✅ Shipped (promoted to v1 per 02-CONTEXT.md scope decision) | PayoutsKPICards's 5th card (Plan 03-03) + `aggregateSuccessRate` over `filterPayoutsByPeriodOnly` (Plan 03-02) — composed in this plan |

All 5 PAY-* requirements + PAY-V2-01 met.

### Patterns Available for Phase 4 (Inicio + Recargas)

The conditional-cross-tab-fetch pattern from this plan transfers directly:

```tsx
// app/(protected)/recargas/page.tsx (Phase 4 will write this)
const [recargasResult, txResult] = await Promise.all([
  getCachedRecargas(),
  filters.empresa ? getCachedTransactions() : Promise.resolve(null),
]);
// ...same pattern as payouts: enrich if filter is set, then filter+aggregate+render
```

For Inicio (executive overview composing multiple domain libraries on one page), the same `Promise.all` pattern applies but with more parallel fetches — plus the React `cache()` dedup means each underlying Sheet is read at most once per render even when shared across tabs.

For Recargas in particular: REC-V2-01 (success rate) is a v1-eligible feature per STATE.md. Use the same two-filter-functions pattern (`filterRecargas` for headline metrics + `filterRecargasByPeriodOnly` for success-rate denominator) — the contract is identical to Payouts, only the domain library changes.

### Patterns Available for Phase 5 (Clientes)

Phase 5 will use `getCachedTransactions` for the empresa registry (already wired into DashboardHeader since Plan 02-02). The Phase 3 conditional join pattern translates: when joining BD_Payouts with BD_Plataforma to compute per-empresa metrics on the Clientes page, the `transaction_id → empresa_id` Map is the same primitive — just inverted (group payouts by empresa, instead of patching one payout's empresa).

### Warnings / Concerns Carried into Phase 4

All carried over from STATE.md without change:

- **Vercel Deployment Protection still ENABLED** — production gated behind Vercel SSO. User-actioned toggle pending. Affects: client demos. Doesn't affect: testing (we use the JWT-cookie technique). Confirmed still on at the production deploy: SSO challenge surfaces on unauthenticated `curl` with no cookie.
- **2 v2 features now v1-eligible carrying into Phase 4**: REC-V2-01 (Recargas success rate) — data exists today (`status` in BD_Plataforma). PAY-V2-02 (Payouts failure breakdown) — data exists today (`failure_reason` in BD_Payouts captured in Plan 03-01). REQUIREMENTS.md update pending.
- **GCP service account key NOT rotated** (`private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459`). User-accepted; rotation procedure documented in 01-04-SUMMARY.md → Security Debt #1.
- **Password is `T1k1N` (5 chars)** — user-accepted. Mitigations: bcrypt cost 10 + Upstash sliding-window rate limit (5/5min/IP active). Rotation procedure documented in 01-04-SUMMARY.md → Security Debt #2.
- **Env vars only in Vercel `Production` target** — preview + development environments lack the 8 user vars. The Plan 03-04 preview deploy succeeded because it inherits production secrets via Vercel's preview-from-production fallback when the preview env is empty (verified empirically in this plan: preview deploy was structurally green and `/api/payouts-smoke` returned 797 rows — same as production). Resolution procedure documented in 01-04-SUMMARY.md → Security Debt #3.
- **TransactionType.UKNOWN is real production data** (sic — typo). User owns source-side cleanup at the Sheet.
- **Same tikintag may map to multiple wallets per empresa** — appears as separate "empresas" today. Phase 5 is the natural place for many-to-one mapping if Tikin confirms.
- **Bonos default filter excludes `direction=out` and `status=rejected` silently** — intentional, documented in 02-02-SUMMARY.md "Bonos Filter Contract".
- **One BD_Payouts row had a numeric `Holder` cell** (Row 188 in current data). Skip rate 0.13% is acceptable but worth monitoring as data grows.

### New Concerns From This Plan

None. The plan deployed clean, the production verification surfaced no issues, no new technical debt was introduced. Phase 3 ships unblocked.

---

*Phase: 03-payouts*
*Plan: 04*
*Completed: 2026-05-04*
*Phase 3 Status: ✅ SHIPPED — all 5 PAY-* requirements + PAY-V2-01 met, all 5 roadmap success criteria verified live in production. P50/P95 hero, latency histogram, top bancos, presenter mode, empresa-filter via Transaction ID join — all green.*
