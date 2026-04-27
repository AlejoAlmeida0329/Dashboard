# Feature Research

**Domain:** B2B fintech operations dashboard (digital wallet selling corporate bonos, % take rate, payouts to cards/bank, mixed internal + client-facing audience)
**Researched:** 2026-04-27
**Confidence:** HIGH (industry patterns), MEDIUM (Tikin-specific Sheets shape — assumed from PROJECT.md)

---

## Reading Guide

The user already chose the tab structure (`Inicio / Bonos / Recargas / Payouts / Clientes`). This file does not relitigate that — it populates each tab with concrete feature candidates and forces an opinionated cut: **Table Stakes** vs **Differentiators** vs **Anti-features**.

Every feature row carries:
- **Cx** = complexity (LOW = a card + a Sheets aggregation; MED = chart + filtering logic; HIGH = needs derived data, joins across sheets, or new column)
- **Data?** = whether current Sheets data is sufficient. `OK` = exists, `+col` = needs a new column, `+sheet` = needs a new dataset
- **Use** = `Internal` (team only) / `Client` (safe to project) / `Both`

---

## Cross-Cutting Features (Apply Across Tabs)

These aren't a tab — they're affordances the whole dashboard inherits.

### Table Stakes

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| Global date-range filter (last 7d / 30d / MTD / QTD / YTD / custom) | Every metric is meaningless without a window | LOW | OK | Both |
| Client/empresa filter (single-select, sticky across tabs) | The "filter to one client for a call" use case is in PROJECT.md | LOW | OK | Both |
| Currency formatting + locale (COP, thousand separators, no decimals on big numbers) | Looks amateur otherwise when projecting | LOW | OK | Both |
| Last-refresh timestamp visible | Live-from-Sheets means the user must trust it's fresh | LOW | OK | Both |
| Loading + empty states per card | Sheets API can be slow/flaky; blank widgets look broken on a client call | LOW | OK | Both |
| Print/PDF-friendly layout (or at least print stylesheet) | Sales team will email screenshots / PDFs after calls | LOW | OK | Both |

### Differentiators

| Feature | Value | Cx | Data? | Use |
|---|---|---|---|---|
| **Presenter Mode toggle** — hides internal-only widgets (revenue/margin), enlarges fonts, removes nav chrome | Solves explicit requirement: "proyectar a clientes". One click, clean view. Big trust signal in calls. | MED | OK | Client |
| **Client-scoped URL** (`/?client=ACME`) shareable with the team | Pre-call prep: paste into Slack, opens already filtered | LOW | OK | Internal |
| **Comparison overlay** (this period vs prior period, delta + arrow) | Standard fintech polish; makes every KPI tell a story instead of just a number | MED | OK | Both |
| **Branded export** (logo + period in header) for screenshots | Replaces "I'll send you a PDF after the call" with "here's the link" | MED | OK | Client |

### Anti-Features

| Feature | Why Tempting | Why Skip | Alternative |
|---|---|---|---|
| Per-user login + role-based widget visibility | Looks "enterprise" | Out of scope per PROJECT.md (shared password). Adds auth complexity for zero current benefit. | Presenter Mode toggle covers the real need (hide internal info on screen-share) |
| Real-time / WebSocket updates | "Live data" sounds nice | Sheets API isn't push; would require polling and adds load. PROJECT.md already says "live read on page load" — that's enough. | Manual "Refresh" button + last-refresh timestamp |
| Saved custom dashboards per user | BI-tool reflex | The user explicitly rejected Looker/PBI route to avoid this complexity. Five tabs = five "dashboards". | Tabs ARE the views. Don't reinvent. |
| In-app alerts / threshold notifications | "Tell me when X drops" | Audience is execs and commercial — they look at the dashboard, they don't subscribe to it. Email/Slack alerts are a separate product. | If truly needed later, ship as an external scheduled job, not in-app. |
| ML forecasting / anomaly detection | Looks impressive in v1 demos | Hallucination risk on a client-facing screen. False alarm > value. Sheets data not clean enough. | Plain MoM/YoY comparison covers 95% of the need. |
| Write-back / edit data in dashboard | Feels productive | Out of scope per PROJECT.md (read-only). One-way breakage of Sheets-as-source-of-truth. | Edit in Sheets, view here. |
| Drill-down to raw transaction list with all fields | "Power user" feature | Risk of leaking sensitive end-user PII on a client call. Pulls scope toward being a data tool, not a dashboard. | If needed for ops debugging, build a hidden `/transactions` route gated separately, not surfaced in tabs. |

---

## Tab 1 — Inicio (Overview / Home)

**Audience priority:** Internal exec view + the one screen most likely shown first to a client.
**Design intent:** Six-to-eight headline numbers, two trend charts, no clutter. If it doesn't survive a 5-second glance, it doesn't belong here.

### Table Stakes

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| **GMV / Volumen total transado** (period KPI + MoM delta) | The "are we growing" number. Anchor of any fintech dashboard. | LOW | OK | Both |
| **Revenue / Comisión generada** (period KPI + MoM delta) | Tikin's actual revenue (% on bonos). The number that pays salaries. | LOW | OK | Both |
| **Take rate %** (revenue / GMV) | Confirms commission economics are stable. Industry-standard fintech KPI. | LOW | OK | Internal |
| **Empresas activas** (clients with ≥1 transaction in period) | Counts who is actually using the platform, not just who signed | LOW | OK | Both |
| **Bonos emitidos / vendidos** (count) | Volume sibling to GMV in $. Useful for ops capacity conversations. | LOW | OK | Both |
| **Payout success rate %** | Trust metric. If this is bad, end-users churn and clients churn next. Industry benchmark: ≥95%. | LOW | OK | Both |
| **Trend chart: GMV over time** (daily or weekly bars, period-aware) | One picture beats six numbers for "the business is healthy" | MED | OK | Both |
| **Trend chart: Active companies over time** | Detects flat or declining client base early | MED | OK | Both |

### Differentiators

| Feature | Value | Cx | Data? | Use |
|---|---|---|---|---|
| **Top 5 empresas this period** (mini leaderboard with $ and % of GMV) | Concentration insight in one widget. Sales team uses this every week. | MED | OK | Internal |
| **"Por presentar" toggle on Inicio** that swaps Revenue/Take-rate for safer client-facing metrics (volume, count, success rate) | Single most important client-call affordance | MED | OK | Client (when on) / Internal (off) |
| **YoY comparison** (this month vs same month last year) when ≥12 months of data exist | Removes seasonality noise; shows real growth | MED | OK | Both |

### Anti-Features

| Feature | Why Tempting | Why Skip | Alternative |
|---|---|---|---|
| 12+ KPI cards on home | "More info = more value" | Cognitive overload. Inicio loses its job as "the glance". | Cap at 6–8 cards. Push the rest to their tabs. |
| Customizable widget grid (drag/drop) | Power-user appeal | Five tabs already segment views. The team doesn't have time to build their own layout. | Ship one good layout; iterate based on which numbers actually get read. |
| Goal/target lines on every chart ("we should be at $X") | Plan-vs-actual look | Targets need governance no one will maintain. Stale targets are worse than no targets. | Period-vs-period delta shows direction without committing to a number. |

---

## Tab 2 — Bonos (Corporate bono sales — primary revenue)

**Audience priority:** Commercial team daily. Exec weekly. Client-facing in renewal/expansion calls.
**Design intent:** Answer "who's buying, how much, how often, and what's our cut" in three scrolls or fewer.

### Table Stakes

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| **Bonos vendidos by period** (line/bar chart, daily or weekly) | The core revenue trend. Without this, the tab has no spine. | LOW | OK | Both |
| **Sales by empresa** (table: empresa, # bonos, $ vendido, $ comisión, % of total) | Where revenue is concentrated. Supports the "filter to one client" workflow. | MED | OK | Both (commission column hidden in Presenter Mode) |
| **Average ticket** ($ per bono) + trend | Detects pricing erosion or client segment shift | LOW | OK | Internal |
| **Comisión earned** (period KPI + trend) | Mirror of GMV but in revenue terms | LOW | OK | Internal |
| **Top empresas leaderboard** (top 10 by $ vendido in period) | Standard "concentration" view. Every B2B sales dashboard has this. | LOW | OK | Both |
| **Period selector + empresa filter** (inherits global, but explicit on the tab) | Users will land on this tab from Inicio with a client filter set; needs to honor it. | LOW | OK | Both |

### Differentiators

| Feature | Value | Cx | Data? | Use |
|---|---|---|---|---|
| **Repeat-buyer cohort** (% of empresas in period that also bought last period) | Proxy for client stickiness without needing a contract/MRR concept | MED | OK | Internal |
| **Sales by company segment** (size: SMB / Mid / Enterprise — based on $ band) | Lets exec team see if growth is broad or top-heavy | MED | +col (segment) OR derive from $ thresholds | Internal |
| **Bono velocity** (avg days between bono purchases per empresa) | Predictive: rising velocity = healthy client; falling = churn risk | HIGH | OK | Internal |
| **Year-over-year stack** (this year monthly bars vs last year line overlay) | Compelling visual for board/investor screenshots | MED | OK | Both |

### Anti-Features

| Feature | Why Tempting | Why Skip | Alternative |
|---|---|---|---|
| Pipeline / forecast view ("expected bonos this month") | Looks "salesy" | No forecast data in Sheets; would require manual upkeep no one will do. Hallucinated forecasts on a client call are a disaster. | Stick to what was actually sold. Sales pipeline lives in CRM, not here. |
| Conversion funnel (orders → paid → bonos issued) | Sounds rigorous | Tikin doesn't have an "order" stage distinct from "sale" in current Sheets. Inventing one creates fake data. | Skip entirely until/unless that pipeline actually exists upstream. |
| Margin / profitability per bono | "Real revenue truth" | Cost data isn't in the Sheets. Computing fake margin will mislead exec decisions. | Show comisión (gross), label it clearly, leave net to Finance. |
| Drill-down to individual bono recipients (employees) | Granular = good | Reveals end-user PII. High risk on screen-share. Not the dashboard's job. | Keep aggregation at empresa level. Always. |

---

## Tab 3 — Recargas (Top-ups)

**Audience priority:** Internal ops. Occasionally client-facing ("here's how active your employees are").
**Design intent:** Answer "is money flowing in, from where, reliably." Smaller tab than Bonos — don't pad it.

### Table Stakes

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| **Total recargas $ by period** (chart + period KPI) | Volume of money entering the system. Mirror of GMV but for top-ups. | LOW | OK | Both |
| **Recargas count** (number of recharge transactions) | Volume signal independent of $ size | LOW | OK | Both |
| **Success rate %** (successful / attempted recargas) | Trust metric. Standard in any payments dashboard. Industry benchmark: ≥95%. | LOW | +col (status: success/fail) | Both |
| **Recargas by source / channel** (table or donut: PSE, tarjeta, transferencia, etc.) | Channel-mix is the #1 question Ops asks about top-ups | MED | +col (channel) | Internal |
| **Recargas by empresa** (top 10 table) | Lets sales/CS see who's most engaged | MED | OK | Both |

### Differentiators

| Feature | Value | Cx | Data? | Use |
|---|---|---|---|---|
| **Failure breakdown by reason** (insufficient funds, declined, timeout…) | Ops can act on this; biggest lever for improving success rate | MED | +col (failure_reason) | Internal |
| **Repeat recharge behavior** (% of empresas that recharged ≥2x in period) | Engagement / habit signal | MED | OK | Internal |
| **Avg ticket per recharge + trend** | Detects shift in usage pattern (smaller, more frequent vs larger, rare) | LOW | OK | Internal |
| **Time-of-day / day-of-week heatmap** | Capacity planning + payment-rail timing context | MED | OK | Internal |

### Anti-Features

| Feature | Why Tempting | Why Skip | Alternative |
|---|---|---|---|
| Per-employee recharge history | Granularity reflex | Surfaces end-user PII. Not the dashboard's job. | Aggregate at empresa level. |
| Real-time recharge feed ("live ticker") | Looks impressive | Adds polling complexity, no actionable use. Top-ups don't need second-by-second visibility. | Period summary + manual refresh is sufficient. |
| Predictive recharge forecasting | "Trend → projection" reflex | Cyclical business with strong day-of-month effects (payday) — naive models will be wildly wrong. | Show last-period totals; let humans estimate. |

---

## Tab 4 — Payouts (Withdrawals to cards / bank accounts)

**Audience priority:** Ops daily. Exec weekly. **Most-shown to clients** (it's the SLA they care about — "how fast do my employees get their money").
**Design intent:** Tikin already maintains a separate Sheet for payout times. Industry standard is to expose **success rate + percentile latency + failure causes**. Match that.

### Table Stakes

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| **Payout success rate %** (period KPI + trend) | Single most important payout metric. Threshold ≥95% is industry expectation. | LOW | +col (status) | Both |
| **Payouts processed** (count + $ volume) | Capacity / throughput signal | LOW | OK | Both |
| **Avg time-to-payout** (P50 / median) | The headline SLA number. From the existing Sheet. | MED | OK (existing payout-times sheet) | Both |
| **P95 time-to-payout** | P50 looks fine when 5% of payouts take days. P95 is the real customer-experience metric. Industry standard. | MED | OK | Both |
| **Failures by cause** (table: cuenta inválida, monto > límite, banco rechazó, timeout…) | Ops needs this to act. Without it, success rate is a number with no lever. | MED | +col (failure_reason) | Internal |
| **By destination type** (tarjeta vs cuenta bancaria) — split on every relevant metric above | Different rails, different SLAs, different failure modes. Mixing them hides problems. | MED | +col (destination_type) | Both |
| **In-flight / pending queue** (count of payouts currently processing, oldest pending) | Ops triage view. "Is something stuck?" | LOW | +col (status, started_at) | Internal |

### Differentiators

| Feature | Value | Cx | Data? | Use |
|---|---|---|---|---|
| **SLA badge per destination type** (e.g., "Tarjetas: 92% en <2h" / "Bancos: 88% en <24h") | Translates percentile latency into a promise clients can repeat. Killer feature for client calls. | MED | OK | Client |
| **Latency distribution histogram** (buckets: <1h, 1–6h, 6–24h, >24h) | Shows shape, not just summary stats. Defends a "P95 = X" claim visually. | MED | OK | Both |
| **Trend of P95 over time** (are we getting faster or slower?) | Operational improvement narrative for clients ("we cut P95 from 8h to 3h this quarter") | MED | OK | Both |
| **Per-empresa payout health card** (success%, P50, P95 filtered to one client) | Gold for renewal calls. Each client sees their own SLA, not the aggregate. | MED | OK | Client |

### Anti-Features

| Feature | Why Tempting | Why Skip | Alternative |
|---|---|---|---|
| Manual retry button for failed payouts | "Operational tool" feature creep | Out of scope (read-only per PROJECT.md). Belongs in core system, not dashboard. | Surface failures clearly so Ops can act in the core system. |
| Per-end-user payout history | Granular debugging | PII risk + scope creep into a support tool. | Aggregate by empresa + destination type. Use core system for individual lookup. |
| Bank-by-bank breakdown (every issuing bank) | "Detailed analytics" | Long tail of small banks → noisy table that nobody reads. | Group into Top-5-banks + "Otros" bucket if useful at all. |
| Real-time payout status WebSocket | "Live ops" appeal | Pending queue card with manual refresh covers 95% of the need. WebSocket is engineering tax for low value. | Manual refresh + clearly displayed pending count. |
| SLA breach alerting in-app | "Pro" feel | Not what this dashboard is for. Email/Slack alerts are a separate, more reliable system. | If P95 breaches matter, build that as a scheduled job outside the dashboard. |

---

## Tab 5 — Clientes (Corporate clients / empresas)

**Audience priority:** Commercial + CS team daily. Exec weekly. **Highly client-facing** when filtered to one company in a renewal call.
**Design intent:** Two views in one tab — a **list** (all empresas, sortable, scannable) and a **profile** (one empresa, deep). The profile view IS the renewal-call screen.

### Table Stakes — List view

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| **Empresas table** (name, fecha alta, last activity date, total $ vendido, $ this period, status) | Core inventory of who is a client | LOW | +col (signup_date), OK for rest | Internal |
| **Sortable columns** (by $, by recency, by name) | Table without sort = printout. Standard. | LOW | OK | Internal |
| **Search by empresa name** | If list >20 entries, search becomes table-stakes | LOW | OK | Internal |
| **Total empresas + active empresas** (KPIs at top of list) | Frames the table | LOW | OK | Both |

### Table Stakes — Profile view (selected empresa)

| Feature | Why Expected | Cx | Data? | Use |
|---|---|---|---|---|
| **Empresa header card** (name, fecha alta, status, account owner if available) | Identity / context | LOW | +col (account_owner optional) | Both |
| **Lifetime $ + this-period $** | "Big" number for the client; concentration number for Tikin | LOW | OK | Both |
| **Activity over time** (monthly $ vendido, last 12 months) | The headline chart for any renewal call | MED | OK | Both |
| **Last activity date** + days-since-last-activity | Engagement / churn signal | LOW | OK | Both |
| **Bonos / Recargas / Payouts mini-summary** (3 cards: count + $ for each, this period) | Quick view of the client's full footprint without leaving the tab | MED | OK | Both |

### Differentiators

| Feature | Value | Cx | Data? | Use |
|---|---|---|---|---|
| **Health badge** (verde / amarillo / rojo) based on simple rules: activity-recency + period-over-period $ trend | Industry standard in B2B SaaS dashboards (Custify-style). Cheap signal that scales attention. | MED | OK | Internal |
| **Quarterly contribution view** (this Q vs last Q vs same Q last year) | Renewal-call-grade narrative tool | MED | OK | Both |
| **"Generate client view" button** = applies empresa filter globally + opens Inicio in Presenter Mode | Closes the loop with the cross-cutting Presenter Mode. One-click "prep for the call". | MED | OK | Both |
| **Concentration view** (top 10 empresas as % of total GMV; HHI-style concentration metric) | Exec-level: "are we one client away from a problem?" | MED | OK | Internal |
| **Cohort retention** (of empresas that joined month X, how many were active 1/3/6/12 months later) | Shows whether the business is leaky. Hard to fake; powerful when good. | HIGH | +col (signup_date) | Internal |

### Anti-Features

| Feature | Why Tempting | Why Skip | Alternative |
|---|---|---|---|
| Full CRM features (notes, tasks, contacts, deals) | "Account management view" reflex | This is a dashboard, not a CRM. Tikin has/will have a CRM. Don't compete with it badly. | Read-only metrics here; CRM elsewhere. |
| ML churn-risk score | Looks "smart" | Not enough data, not enough events, high false-positive rate, dangerous on a client call ("our system flagged you as risky" — don't show that). | Rule-based health badge (3 colors, 2 rules) is plenty for v1. |
| Per-empresa MRR / contract value | SaaS reflex | Tikin's revenue model is % per transaction, not subscription. Forcing MRR distorts the business. | Use **rolling 90-day $ generated** as the closest natural fit. |
| Editable client notes / tags in the dashboard | "Lightweight CRM" temptation | Read-only constraint per PROJECT.md. Notes belong in CRM. | Skip. Or surface notes from CRM if integration ever happens. |
| Send-renewal-email button | "Take action" feel | Out of scope. Belongs in CRM/email tool. | Skip. |

---

## Client-Presentation Use Case (Cross-Cutting, Re-Stated)

PROJECT.md explicitly calls this out: dashboard is *projected to clients on calls*. Treat it as a first-class scenario, not an afterthought.

### What "client-presentation grade" requires

| Capability | Where it lives | Notes |
|---|---|---|
| **Presenter Mode toggle** (Cross-Cutting Differentiator) | Persistent button in nav, visible state | Hides revenue/take-rate/comisión columns and any internal-only widget. Increases font size. Removes nav chrome. One click on, one click off. |
| **Single-empresa filter, sticky across all tabs** (Cross-Cutting Table Stakes) | Global filter in nav | Once set, every tab shows that empresa's view. Persists in URL for shareable pre-call links. |
| **Profile view in Clientes tab** | Tab 5 | The actual screen most often shown — drill into one empresa, switch on Presenter Mode, share screen. |
| **No PII anywhere** | All tabs | Rule, not feature: no end-user names, emails, account numbers ever in any view. Only empresa-level aggregations. |
| **Polished empty/loading states** | All tabs | A spinner or "no data" state on a client call is jarring. Empty states should look intentional. |
| **Consistent currency / number formatting** | All tabs | Mixed `$1,234.56` vs `$1234` vs `1234 COP` looks unfinished. Pick one and enforce. |

### What presenter mode should hide (initial list — confirm during requirements)

- Take rate %, Comisión $, Margin (anywhere they appear)
- Top-empresas leaderboard (showing other clients to a client = bad)
- Concentration view in Clientes tab
- Failure-cause breakdowns in Recargas/Payouts (operational, not narrative)
- "Per-empresa health badge" if drilled outside the empresa being shown

### What presenter mode keeps (and may emphasize)

- GMV / Volumen, Bonos vendidos, Active empresas (when filtered = the client's own activity)
- Payout success rate, P50/P95 (these are the *promise* — show proudly)
- Per-empresa profile view (the "your account" screen)
- Trend charts (visual narrative)

---

## Feature Dependencies

```
[Global empresa filter]
    └── enables ──> [Per-client URL]
    └── enables ──> [Presenter Mode usefulness]
    └── enables ──> [Clientes profile view]

[Status column in Sheets (success/fail)]
    └── enables ──> [Recargas success rate]
    └── enables ──> [Payouts success rate]
    └── enables ──> [In-flight / pending queue]

[Failure_reason column in Sheets]
    └── enables ──> [Recargas failure breakdown]
    └── enables ──> [Payouts failures by cause]

[Destination_type column in Sheets (tarjeta / banco)]
    └── enables ──> [Payouts by destination type]
    └── enables ──> [SLA badge per destination type]

[Existing payout-times Sheet]
    └── enables ──> [P50, P95]
    └── enables ──> [Latency histogram]
    └── enables ──> [SLA badges]

[Signup_date column per empresa]
    └── enables ──> [Cohort retention]
    └── enables ──> [Days-since-onboarding in profile]

[Presenter Mode]
    ├── conflicts with ──> [Top empresas leaderboard visibility]
    └── conflicts with ──> [Concentration / take-rate widgets]
```

### Dependency Notes

- **Most P1/P2 differentiators on Recargas and Payouts depend on Sheets columns that may not exist yet.** Confirm during requirements (`status`, `failure_reason`, `destination_type`). If absent, propose adding them — they are cheap upstream and unlock most of the value.
- **The existing payout-times Sheet is the unlock for the entire Payouts tab differentiation.** Without it, that tab collapses to volume only. With it, P95 + SLA badges become the dashboard's most defensible client-facing feature.
- **Presenter Mode is the keystone for the client-call use case.** Without it, every other client-facing accommodation (filter, profile view, branded export) loses 80% of its value. Build it early.

---

## v1 Definition (suggested starting cut)

These are *suggestions* to seed `/gsd:define-requirements`. The user said they'll iterate per tab — so this is a strong default, not a contract.

### Launch With (v1.0)

**Cross-cutting:**
- [ ] Global date-range filter (LOW, OK)
- [ ] Global empresa filter, sticky + URL-encoded (LOW, OK)
- [ ] Currency/locale formatting + last-refresh timestamp (LOW, OK)
- [ ] Loading + empty states (LOW, OK)
- [ ] **Presenter Mode toggle** (MED, OK) — non-negotiable for client-call use case

**Inicio:**
- [ ] GMV, Revenue, Take rate, Empresas activas, Bonos emitidos, Payout success rate (six headline KPIs — LOW each)
- [ ] One trend chart: GMV over time (MED)
- [ ] One trend chart: Active companies over time (MED)

**Bonos:**
- [ ] Bonos vendidos chart (LOW)
- [ ] Sales-by-empresa table with comisión column (MED)
- [ ] Average ticket KPI (LOW)
- [ ] Top empresas leaderboard (LOW)

**Recargas:**
- [ ] Total recargas $ + count (LOW)
- [ ] Success rate % (LOW, *needs `status` column*)
- [ ] By source/channel breakdown (MED, *needs `channel` column*)
- [ ] By empresa table (MED)

**Payouts:**
- [ ] Success rate % (LOW, *needs `status` column*)
- [ ] P50 + P95 time-to-payout (MED, uses existing payout-times sheet)
- [ ] Split by destination type — tarjeta vs banco (MED, *needs `destination_type` column*)
- [ ] In-flight queue count (LOW)
- [ ] Failures by cause (MED, *needs `failure_reason` column*)

**Clientes:**
- [ ] Empresas table with sort + search (LOW)
- [ ] Profile view: header + lifetime $ + activity-over-time chart + last-activity (MED)
- [ ] "Generate client view" → applies filter + Presenter Mode (MED)

### Add After Validation (v1.x)

- [ ] **Period-over-period comparison overlays** on trend charts — once people are reading the dashboard regularly and asking "vs last month?"
- [ ] **Branded export / screenshot** — once sales team starts asking for PDFs after calls
- [ ] **Per-empresa health badge** (rule-based, 3 colors) — once CS team forms an opinion on what "healthy" means for them
- [ ] **Latency histogram + SLA badges** on Payouts — once P95 is being quoted in client calls and a visual is needed
- [ ] **Repeat-buyer cohort** on Bonos — once exec team asks "how sticky are clients?"
- [ ] **YoY comparison** — when Tikin has ≥12 months of clean data

### Future / v2+

- [ ] Cohort retention (HIGH complexity; needs signup_date discipline first)
- [ ] Bono velocity (HIGH; predictive value unclear until data is richer)
- [ ] Concentration / HHI view (when client base diversifies enough that concentration is a *real* risk to surface)
- [ ] Quarterly contribution view (when QBRs become a thing)

---

## Feature Prioritization Matrix (top selections)

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Global empresa filter (sticky, URL) | HIGH | LOW | P1 |
| Presenter Mode toggle | HIGH | MED | P1 |
| Inicio 6 KPI cards (GMV, Revenue, Take rate, Active empresas, Bonos, Payout SR) | HIGH | LOW | P1 |
| GMV trend chart (Inicio) | HIGH | MED | P1 |
| Bonos sales-by-empresa table | HIGH | MED | P1 |
| Payouts success rate + P50/P95 | HIGH | MED | P1 |
| Payouts split by destination type | HIGH | MED | P1 (if column exists) / P2 (if it needs adding) |
| Clientes profile view + activity chart | HIGH | MED | P1 |
| "Generate client view" one-click button | HIGH | MED | P1 |
| Recargas success rate | HIGH | LOW | P1 (if `status` column exists) |
| Failures by cause (Recargas + Payouts) | MED | MED | P2 |
| Period-over-period comparison overlays | MED | MED | P2 |
| Per-empresa health badge | MED | MED | P2 |
| Latency histogram (Payouts) | MED | MED | P2 |
| Branded export / PDF | MED | MED | P2 |
| Cohort retention | LOW (today, before product is in use) | HIGH | P3 |
| Bono velocity / predictive metrics | LOW | HIGH | P3 |

**Priority key:**
- **P1** — must have for v1.0 launch
- **P2** — should have, add when data + usage justify
- **P3** — defer until clear demand surfaces

---

## Competitor / Reference Pattern Analysis

Industry references used to anchor the categorization (these are *patterns*, not literal copies):

| Pattern | Reference | How Tikin Adapts |
|---|---|---|
| **Six headline KPIs on home, no more** | Stripe Dashboard, Mercado Pago dashboard | Same — Inicio caps at 6–8 cards. |
| **Payout success rate + percentile latency as trust metrics** | Stripe Payouts, payment processor benchmarks (≥95% SR) | Direct adoption — these become the centerpiece of Payouts tab. |
| **Failure-by-cause breakdown** | Razorpay, IXOPAY orchestration dashboards | Adopted for Payouts and Recargas. Critical for ops. |
| **Health-score traffic light (verde/amarillo/rojo)** | Custify, Totango (B2B SaaS CS dashboards) | Adopted simplified — rule-based, no ML. |
| **ARPA (Average Revenue Per Account) + cohort view** | ChartMogul, Geckoboard, Equals | Reframed as "rolling 90-day $ per empresa" since Tikin isn't subscription-based. |
| **Presenter / full-screen mode** | AgencyAnalytics, Looker Studio "Public" view | Adopted as Tikin-specific Presenter Mode (hides internal columns, not just chrome). |
| **Per-account profile view** | Custify, HubSpot Service Hub account view | Adopted as Clientes profile — the renewal-call screen. |

---

## Open Questions for `/gsd:define-requirements`

These need resolution before locking v1 scope. Listed in priority order:

1. **Does the transactions Sheet have a `status` column** (success / fail / pending)? If no → success rate metrics across Recargas and Payouts collapse. Adding a column upstream is cheap and unlocks 30% of the value of this dashboard.
2. **Does the transactions Sheet have a `failure_reason` column?** If no → failures-by-cause is impossible. Same fix.
3. **Does the transactions Sheet differentiate `destination_type` for payouts** (tarjeta vs banco)? If no → can't split Payouts SLAs by rail, which is the highest-value Payouts feature.
4. **Is there a way to know each empresa's signup date?** If no → cohort retention and "days since onboarding" are out for v1. Acceptable; mark as v2.
5. **What's the complete list of columns currently in both Sheets?** Without this, every "+col" note above is a guess. Should be the first artifact gathered in requirements.
6. **Is "comisión $" already a column, or computed from `bono_amount * fixed_rate`?** If computed, the rate must live somewhere stable (config). If varies per client, it must be in the Sheet.
7. **Confirm: presenter mode hides revenue/take-rate but keeps volume/success-rate** — is that the right line? Sales team (the actual users in calls) should sign off on the hide-list.
8. **What is the *fewest* metrics that would make Inicio credible?** This file proposes 6–8 KPIs + 2 charts. The user's "iterate per tab" philosophy may want fewer — confirm the floor.

---

## Sources

### Industry references (HIGH confidence)
- [Stripe Web Dashboard documentation](https://docs.stripe.com/dashboard/basics) — payout/balance dashboard patterns
- [Stripe Manage Payouts](https://docs.stripe.com/global-payouts/manage-payouts) — payout filters: processing/posted/failed/returned/canceled/scheduled
- [Stripe Reporting](https://docs.stripe.com/stripe-reports) — exportable transaction/payout reports
- [Clearly Payments — Top Payment Processing Metrics](https://www.clearlypayments.com/blog/the-most-important-payment-metrics-and-kpis/) — TSR, payout monitoring
- [Count.co — Payment Success Rate benchmarks](https://count.co/metric/payment-success-rate) — ≥95% TSR threshold
- [Razorpay — Payment Gateway Transaction Success Rate](https://razorpay.com/blog/payment-success-rate-tips-to-improve) — failure-cause taxonomy
- [IXOPAY — Payment Orchestration Success Rates](https://www.ixopay.com/blog/how-payment-orchestration-platforms-improve-transaction-success-rates) — payout dashboarding patterns
- [DigitalDefynd — 20 Important Fintech KPIs (2026)](https://digitaldefynd.com/IQ/fintech-kpis/) — fintech KPI taxonomy (transaction volume, ARPU, op-efficiency)
- [Finro — Fintech KPI Guide](https://www.finrofca.com/news/fintech-kpi-guide) — financial-services KPI structure
- [Estel Telecom — KPIs for eTop-Up Systems](https://www.esteltelecom.com/blog/top-10-kpis-for-e-top-up-and-mobile-recharge-systems-in-telecom) — recharge channel & success-rate patterns
- [i2c — KPIs for Prepaid Card Programs](https://www.i2cinc.com/blog/what-key-performance-indicators-should-you-track-for-prepaid-card-programs/) — Spend Active Rate, Balance Active Rate (relevant for bono activation)

### B2B SaaS / customer-success dashboard patterns (HIGH confidence)
- [Custify — Customer Health Dashboard](https://www.custify.com/product-health) — green/yellow/red health-badge pattern
- [Chameleon — Customer Health Score](https://www.chameleon.io/blog/customer-health-score) — frequency/breadth/depth pillars
- [101 Agencies — B2B SaaS Executive Dashboard Guide 2026](https://101agencies.com/insights/blog/b2b-saas-growth-metrics-dashboard) — exec dashboard layout
- [Geckoboard — ARPA KPI](https://www.geckoboard.com/best-practice/kpi-examples/average-revenue-per-account-arpa/) — ARPA in B2B context
- [ChartMogul — ARPA](https://chartmogul.com/saas-metrics/arpa/) — cohort + ARPA framing
- [Totango — Customer Success Dashboard KPIs](https://www.totango.com/blog/customer-success-dashboard) — CS dashboard structure

### Corporate benefits / wallet platforms (MEDIUM confidence — adjacency)
- [Pluxee — What is a Corporate Benefits Platform](https://www.pluxee.uk/blog/what-is-a-corporate-benefits-platform-and-why-your-employees-actually-care/) — competitor reference (closest analog to Tikin)
- [HealthJoy — Benefits Wallet Engagement](https://www.healthjoy.com/blog/hr/utilization/benefits-wallet-engagement/) — wallet engagement metrics (utilization rates, wallet views)

### Presentation / share-mode patterns (MEDIUM confidence)
- [AgencyAnalytics — Enable Presentation Mode](https://help.agencyanalytics.com/en/articles/4738953-enable-presentation-mode-for-dashboards) — full-screen client-share pattern
- [TapClicks — Custom Dashboard Export](https://support.tapclicks.com/hc/en-us/articles/360040410353-How-to-Create-and-Export-a-Custom-Dashboard) — demo-mode + per-client filtering
- [Salesforce — Configure Dashboard Data Visibility](https://help.salesforce.com/s/articleView?id=sf.dashboards_view_as.htm) — view-as patterns for hiding/showing

---

## Confidence Breakdown

| Area | Confidence | Reason |
|---|---|---|
| Inicio table-stakes KPIs | HIGH | Cross-validated across 4+ fintech KPI references |
| Bonos features | HIGH for sales views, MED for cohort/velocity | Cohort patterns are proven in SaaS, slightly less direct fit for transactional businesses |
| Recargas features | MEDIUM | Patterns are clear, but contingent on Sheet columns that need confirmation |
| Payouts features | HIGH | Strong industry consensus: SR + percentile latency + failure causes + destination split |
| Clientes features | HIGH for B2B account-view patterns; MEDIUM for ARPA-equivalent | Tikin's % take-rate model differs from subscription SaaS; "rolling 90-day $" is a reasoned adaptation, not a copied standard |
| Anti-features | HIGH | All grounded in PROJECT.md scope or in well-documented dashboard anti-patterns |
| Presenter Mode | HIGH conviction it's needed (PROJECT.md); MEDIUM on exact hide-list (needs sales sign-off) | The capability is mandatory; the specifics are a requirements conversation |

**Research valid until:** ~2026-07-27 (3 months — fintech dashboard patterns are stable, but Tikin's own Sheets schema may evolve and invalidate "+col" assumptions)
