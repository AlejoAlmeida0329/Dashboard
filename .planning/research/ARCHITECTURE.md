# Architecture Research

**Domain:** Next.js (App Router) read-only dashboard fed by Google Sheets API, password-gated, deployed on Vercel
**Researched:** 2026-04-27
**Confidence:** HIGH (Next.js 16.2 docs verified; googleapis Node runtime requirement verified)

---

## Executive Summary

This is a **server-rendered read-only dashboard** with a single shared-password gate. The architecture is unusually simple because there is no per-user state, no writes, and the data source is one external API (Google Sheets). The dominant decisions are:

1. **Server Components fetch directly from Sheets** — no Route Handlers + client SWR layer. Live reads + low-traffic internal use means each request page-loads against Sheets is fine.
2. **A thin adapter layer** (`src/lib/sheets/`) is the single seam that hides Sheets specifics behind typed domain functions like `getTransactions()`, `getPayoutTimes()`. **This is the single most important boundary in the whole architecture** — it is what makes the eventual swap to a real DB / Tikin core integration cheap.
3. **`proxy.ts`** (formerly `middleware.ts` in Next.js ≤15 — renamed in Next.js 16) handles the password gate by checking a signed session cookie. It runs on Node.js by default in 16.2 but **must not import googleapis** anyway — the proxy should stay tiny and only verify the session cookie.
4. **Charts (Recharts/Tremor) are Client Components** by necessity. Server Components fetch + shape data, then pass plain serializable props down to client chart components.
5. **The "skeleton phase" hunch is correct** — confirm and refine below. Auth + Sheets adapter + layout shell with empty tabs must exist before any tab is built, because every tab depends on those two primitives.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                     │
│  ┌────────────────────┐    ┌─────────────────────────────────────────┐  │
│  │ Login form         │    │ Dashboard pages (HTML streamed from RSC)│  │
│  │ (Client Component) │    │  ┌──────────┐  ┌──────────────────┐    │  │
│  │  POSTs to action   │    │  │ Server   │  │ <ChartCard>      │    │  │
│  └─────────┬──────────┘    │  │ Component│→ │ "use client"     │    │  │
│            │               │  │ (fetch + │  │ (Recharts/Tremor)│    │  │
│            │               │  │ shape)   │  │ <DateRangeFilter>│    │  │
│            │               │  └──────────┘  └──────────────────┘    │  │
│            │               └─────────────────────────────────────────┘  │
└────────────┼────────────────────────────┬────────────────────────────────┘
             │ POST /login                │ GET /, /bonos, /payouts ...
             │ (Server Action)            │
             ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS (Vercel, Node runtime)                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  proxy.ts  (runs on every protected route — Node runtime)       │     │
│  │   • read `session` cookie → verify with jose                    │     │
│  │   • redirect to /login if absent/invalid                        │     │
│  │   • DOES NOT call Sheets, DOES NOT import googleapis            │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  app/(dashboard)/<tab>/page.tsx  (React Server Component)       │     │
│  │   const rows = await getTransactions({ from, to })              │     │
│  │   const kpis = computeKpis(rows)                                │     │
│  │   return <ChartCard data={kpis} />                              │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  src/lib/sheets/  (the adapter — server-only)                   │     │
│  │                                                                 │     │
│  │   client.ts        →  shared GoogleAuth + sheets v4 client      │     │
│  │   transactions.ts  →  getTransactions(): Transaction[]          │     │
│  │   payout-times.ts  →  getPayoutTimes():  PayoutTime[]           │     │
│  │   <future>.ts      →  one file per sheet, same shape            │     │
│  │                                                                 │     │
│  │   Each file:                                                    │     │
│  │     1. fetches range via sheets.spreadsheets.values.get         │     │
│  │     2. validates rows with Zod                                  │     │
│  │     3. maps to typed domain object (Transaction, PayoutTime)    │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  googleapis (npm)  — Node-only, uses native crypto, http2       │     │
│  └────────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │  HTTPS + JWT (service account)
                                   ▼
                        ┌──────────────────────┐
                        │  Google Sheets API    │
                        │  (transactions sheet, │
                        │   payouts sheet, ...) │
                        └──────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `proxy.ts` | Auth gate. Verify session cookie on every protected request. Redirect to `/login` if missing/invalid. Nothing else. | `next/server` + `jose` (HS256 verify). ~30 lines. Node runtime (default in 16.2). |
| `app/(auth)/login/page.tsx` | Render password form. Public route. | Client Component for the form, Server Action handler. |
| `app/login/actions.ts` | Compare submitted password against `DASHBOARD_PASSWORD` env var. On match, sign a JWT, set httpOnly cookie, redirect to `/`. | Server Action (`'use server'`). Uses `jose` + `cookies()` from `next/headers`. |
| `app/(dashboard)/layout.tsx` | Shell: top nav with the 5 tabs, brand, logout. Verifies session via DAL. | RSC. Calls `verifySession()` which redirects if invalid. |
| `app/(dashboard)/<tab>/page.tsx` | Per-tab page. Reads search params (date range, client filter), calls one or more `lib/sheets` functions, computes aggregations, passes plain data to chart Client Components. | RSC, async function. |
| `src/lib/sheets/client.ts` | Build a singleton authenticated `sheets_v4.Sheets` client from the service account env vars. Server-only. | `googleapis` + `'server-only'` import. |
| `src/lib/sheets/<sheet>.ts` | One module per sheet/tab. Fetch range, validate with Zod, map to domain type. | Pure async functions returning typed arrays. |
| `src/lib/domain/` | Domain types (`Transaction`, `PayoutTime`, `Cliente`, `Bono`, `Recarga`) and computation helpers (`computeKpis`, `aggregateByMonth`). Pure, no I/O. | Plain TS modules. Easy to unit-test. |
| `src/lib/auth/session.ts` | `encrypt`/`decrypt`/`createSession`/`destroySession`/`verifySession`. The DAL for auth. | `jose` + `cookies()`. Marked `'server-only'`. |
| `src/components/charts/` | Client Components wrapping Recharts/Tremor. Receive plain serializable props. | `'use client'` at top of each file. |
| `src/components/ui/` | Shared layout/UI primitives (Card, KpiTile, DateRangePicker). Client when interactive, otherwise server. | Mix; default to RSC, opt into `'use client'` only when needed. |

---

## Recommended Project Structure

```
Dashboard_Tikin/
├── .env.local                          # local-only secrets (NOT committed)
├── .env.example                        # template (committed)
├── next.config.ts
├── tsconfig.json
├── package.json
├── proxy.ts                            # auth gate (Node runtime, ≤30 LOC)
└── src/
    ├── app/
    │   ├── layout.tsx                  # root layout (html/body, fonts, providers)
    │   ├── page.tsx                    # redirects to /inicio
    │   ├── login/
    │   │   ├── page.tsx                # public login page (Client form)
    │   │   └── actions.ts              # 'use server' login Server Action
    │   ├── logout/
    │   │   └── route.ts                # POST → clear cookie → redirect /login
    │   └── (dashboard)/                # ROUTE GROUP: protected; URL-invisible
    │       ├── layout.tsx              # nav + verifySession() guard
    │       ├── inicio/page.tsx         # tab 1: Inicio (overview KPIs)
    │       ├── bonos/page.tsx          # tab 2: Bonos
    │       ├── recargas/page.tsx       # tab 3: Recargas
    │       ├── payouts/page.tsx        # tab 4: Payouts
    │       └── clientes/page.tsx       # tab 5: Clientes
    ├── lib/
    │   ├── sheets/                     # ★ THE KEY BOUNDARY
    │   │   ├── client.ts               # auth + sheets_v4 singleton
    │   │   ├── config.ts               # SPREADSHEET_IDS, RANGES per sheet
    │   │   ├── transactions.ts         # getTransactions(filters): Transaction[]
    │   │   ├── payout-times.ts         # getPayoutTimes(filters): PayoutTime[]
    │   │   └── _utils.ts               # row→object mapping helpers
    │   ├── domain/                     # data-source-agnostic types & logic
    │   │   ├── types.ts                # Transaction, PayoutTime, Cliente, ...
    │   │   ├── schemas.ts              # Zod schemas (one per row shape)
    │   │   ├── kpis.ts                 # computeRevenue(), activeClientes()
    │   │   └── aggregations.ts         # groupByMonth(), pivotByCliente()
    │   ├── auth/
    │   │   ├── session.ts              # encrypt/decrypt/create/destroy
    │   │   └── dal.ts                  # verifySession() with React.cache
    │   └── format.ts                   # money, dates, percentages (es-CO)
    ├── components/
    │   ├── ui/                         # generic primitives
    │   │   ├── card.tsx
    │   │   ├── kpi-tile.tsx
    │   │   ├── data-table.tsx          # 'use client' (sortable)
    │   │   └── date-range-picker.tsx   # 'use client'
    │   ├── charts/                     # ALL client-only
    │   │   ├── line-chart.tsx          # 'use client'
    │   │   ├── bar-chart.tsx           # 'use client'
    │   │   └── donut-chart.tsx         # 'use client'
    │   └── layout/
    │       ├── tab-nav.tsx             # the 5-tab top nav
    │       └── shell.tsx               # branded shell (header, footer)
    └── styles/
        └── globals.css
```

### Structure Rationale

- **`src/`:** Standard Next.js convention. Cleanly separates application code from `next.config.ts`, `proxy.ts`, configs.
- **`(dashboard)` route group:** Parentheses-wrapped folder is invisible in URLs. It groups all protected routes under one shared `layout.tsx` (the tab nav + session check) without polluting the URL with `/dashboard/...`. The 5 tabs sit at root URLs (`/inicio`, `/bonos`, …) which is what an internal team and a screen-shared client demo want.
- **`lib/sheets/` is the seam.** Every tab depends on it. Components NEVER import `googleapis` directly. When the move to a real DB happens, swap this folder's bodies; signatures stay; tabs don't change.
- **`lib/domain/` is data-source-agnostic.** Types, Zod schemas, and pure aggregation functions live here. They have no idea where `Transaction[]` came from. This is what allows Sheets → Tikin core swap without touching aggregation/chart code.
- **`lib/auth/` separated from `lib/sheets/`** so the proxy can import auth utilities without dragging googleapis into the proxy bundle (even though Node runtime supports it, smaller proxy = faster cold start).
- **`components/charts/` flat:** Charts are leaf Client Components. Keep them flat and small.
- **No `pages/`:** Pure App Router.

---

## Architectural Patterns

### Pattern 1: Server Component fetches → plain props → Client chart

**What:** Page is a Server Component. It awaits `lib/sheets/*` functions, runs domain aggregations, passes the result as plain serializable props to a `'use client'` chart component.

**When to use:** Every chart-bearing page (i.e. all five tabs).

**Trade-offs:**
- ✅ No client-side fetching plumbing, no Route Handler, no SWR, no loading flicker beyond `loading.tsx`.
- ✅ Service-account credentials never leave the server bundle.
- ✅ `googleapis` is automatically excluded from the client bundle (it imports `'server-only'`-tagged modules).
- ⚠️  No background refresh. To refresh data, the user reloads. Acceptable per project constraints (live reads, low traffic).
- ⚠️  Slow Sheets calls block the page. Mitigate with `loading.tsx` and (optionally) `<Suspense>` per chart for streaming.

**Example:**
```tsx
// src/app/(dashboard)/bonos/page.tsx
import { getTransactions } from '@/lib/sheets/transactions'
import { computeBonosKpis, aggregateBonosByMonth } from '@/lib/domain/kpis'
import { LineChart } from '@/components/charts/line-chart'
import { KpiTile } from '@/components/ui/kpi-tile'

export const dynamic = 'force-dynamic'  // live reads, no caching

export default async function BonosPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; cliente?: string }>
}) {
  const { from, to, cliente } = await searchParams
  const txs = await getTransactions({ from, to, cliente, type: 'BONO' })
  const kpis = computeBonosKpis(txs)
  const monthly = aggregateBonosByMonth(txs)

  return (
    <section>
      <KpiTile label="Bonos vendidos" value={kpis.count} />
      <KpiTile label="Revenue (comisión)" value={kpis.commissionRevenue} format="money" />
      <LineChart data={monthly} xKey="month" yKey="amount" />
    </section>
  )
}
```

### Pattern 2: One adapter file per sheet (additive)

**What:** Each Google Sheet (current and future) gets its own file under `src/lib/sheets/`, exporting one or more typed query functions. The file is fully responsible for: range identifier, raw fetch, Zod validation, mapping to domain type.

**When to use:** Always, from the first sheet. Adding a new sheet later means dropping in a new file — no rewrites elsewhere.

**Trade-offs:**
- ✅ Adding a 3rd, 4th, 5th sheet is purely additive.
- ✅ Each file's contract is dead simple: in = filter args, out = `Promise<DomainType[]>`.
- ✅ Domain types live in `lib/domain/` so they can be referenced from charts without circular dependency.
- ⚠️  Some duplicated boilerplate (auth, range fetch). Mitigate with a small `_utils.ts` helper.

**Example:**
```ts
// src/lib/sheets/transactions.ts
import 'server-only'
import { getSheetsClient } from './client'
import { SPREADSHEETS } from './config'
import { TransactionRowSchema } from '@/lib/domain/schemas'
import type { Transaction } from '@/lib/domain/types'

export async function getTransactions(filters?: {
  from?: string
  to?: string
  cliente?: string
  type?: 'BONO' | 'RECARGA' | 'PAYOUT'
}): Promise<Transaction[]> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEETS.transactions.id,
    range: SPREADSHEETS.transactions.range, // e.g. 'Transacciones!A2:H'
  })
  const rows = res.data.values ?? []
  const transactions: Transaction[] = rows
    .map((r) => TransactionRowSchema.safeParse(r))
    .filter((p) => p.success)
    .map((p) => p.data) // Zod transform produces a Transaction
  return applyFilters(transactions, filters)
}
```

### Pattern 3: Session in signed cookie, verified in `proxy.ts` and DAL

**What:** Login Server Action signs a tiny JWT (`{ authed: true, exp }`) with `jose` and sets it as an httpOnly cookie. `proxy.ts` decrypts it on every protected route for an optimistic check (redirect on miss). Server Components and Server Actions re-verify via a `verifySession()` DAL that uses `React.cache`.

**When to use:** Anywhere a user-distinguishing identity is NOT needed (this project — single shared password). For real per-user auth, use a library (NextAuth/Auth.js, Clerk, etc.) — not relevant here.

**Trade-offs:**
- ✅ Stateless: no DB, no session store, scales trivially on Vercel.
- ✅ Proxy stays small and Node-runtime-friendly.
- ✅ Per Next.js docs, proxy alone is NOT a security boundary — re-verifying inside Server Components/Actions via DAL is the recommended pattern.
- ⚠️  Cookie size matters; payload is tiny here.
- ⚠️  Requires `SESSION_SECRET` env var (separate from `DASHBOARD_PASSWORD`).

**Example:**
```ts
// proxy.ts (project root or src/proxy.ts)
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/auth/session'

const PUBLIC = ['/login']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (PUBLIC.includes(path)) return NextResponse.next()

  const cookie = req.cookies.get('session')?.value
  const payload = await decrypt(cookie)
  if (!payload?.authed) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
}
```

```ts
// src/lib/auth/dal.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from './session'

export const verifySession = cache(async () => {
  const c = (await cookies()).get('session')?.value
  const payload = await decrypt(c)
  if (!payload?.authed) redirect('/login')
  return { authed: true as const }
})
```

---

## Data Flow

### Request Flow (a typical tab load)

```
[User clicks /bonos]
      │
      ▼
[proxy.ts]   reads `session` cookie → verifies with jose → ok? continue
      │                                                  → no? redirect /login
      ▼
[(dashboard)/layout.tsx]   (RSC) calls verifySession() (cached) → renders shell + tabs
      │
      ▼
[(dashboard)/bonos/page.tsx]   (RSC, async)
      │  await getTransactions({ from, to })   ← from src/lib/sheets/transactions.ts
      ▼
[lib/sheets/transactions.ts]
      │  getSheetsClient()                     ← singleton from client.ts
      │  sheets.spreadsheets.values.get(...)   ← HTTPS to Google
      │  rows.map(Zod parse) → Transaction[]
      ▼
[lib/domain/kpis.ts]   computeBonosKpis(txs) → { count, commissionRevenue }
      │
      ▼
[Server-rendered HTML stream]   <KpiTile/> + <LineChart data={...}/>
      │  (LineChart is a Client Component; receives serialized props,
      │   hydrates Recharts in the browser)
      ▼
[Browser]   sees full page; chart hydrates; tab navigation prefetches RSC.
```

### Login Flow

```
[User submits password form on /login]
      │
      ▼
[Server Action: app/login/actions.ts]
      │  if (formData.password !== process.env.DASHBOARD_PASSWORD) → return { error }
      │  const jwt = await encrypt({ authed: true })
      │  cookies().set('session', jwt, { httpOnly, secure, sameSite: 'lax', maxAge: 7d })
      │  redirect('/inicio')
      ▼
[Client]   navigated; subsequent requests carry the cookie.
```

### Key Data Flows

1. **Tab page → Sheets:** RSC awaits adapter → adapter awaits Sheets API → typed array → aggregation → chart props. Synchronous from the user's perspective; one full server round-trip per navigation.
2. **Login → cookie set:** Server Action validates, signs JWT, sets cookie, redirects. No fetch, no Sheets touch.
3. **Filter change (date range, client filter):** Filters are URL `searchParams`. Changing them triggers a Next.js navigation (RSC re-render with new params) → new Sheets fetch → new aggregations → new chart props. **This is why filters should live in the URL, not React state** — it makes sharing filtered views with clients trivial.
4. **Logout:** Hit `/logout` → clear cookie → redirect to `/login`.

---

## Caching Strategy

### Decision: no caching by default; ISR optional later

| Strategy | When | How |
|----------|------|-----|
| **`export const dynamic = 'force-dynamic'`** (default for tab pages) | Always for v1. Live reads per the project constraint. | Add at top of each tab `page.tsx`. Equivalent to `cache: 'no-store'` on `fetch`. |
| **`React.cache(getTransactions)`** | If a single page calls `getTransactions()` multiple times (e.g., main chart + KPI tile both need it), wrap the function with React's `cache` so it dedupes within one request. | Wrap export in `lib/sheets/transactions.ts`. |
| **`unstable_cache` / ISR with `revalidate: 60`** | Future. If Sheets quota or page latency become a problem. Adds a 60-second staleness window for a faster page. | Opt in per-function later, not now. |

**Don't:** use Next.js `fetch()` with cache options for `googleapis` calls — `googleapis` uses gaxios under the hood, not Next's instrumented fetch. Caching must be done at the function level (`React.cache` or `unstable_cache`), not at the HTTP level.

---

## Edge vs Node Runtime

| Surface | Runtime | Why |
|---------|---------|-----|
| `proxy.ts` | **Node** (default in Next.js 16.2; was Edge in ≤14) | We don't need to import `googleapis` here, but Node default removes any concern. Keep it small regardless — no Sheets calls. |
| All `app/**/page.tsx` | **Node** (default for RSC) | `googleapis` requires Node-native modules (`crypto`, `http2`, `fs`-adjacent helpers). Confirmed in Next.js Edge Runtime docs: "Native Node.js APIs are not supported." |
| `app/login/actions.ts` | **Node** | Uses `cookies()` from `next/headers` and `jose` (works on both, but page is Node anyway). |
| Future Route Handlers (e.g. `/api/health`) | **Node** unless trivial | Default. Only switch to Edge with `export const runtime = 'edge'` if the handler is genuinely Web-API-only. |

**Rule of thumb:** Anything that touches `lib/sheets/` is Node. Period.

> **Important platform note:** As of Next.js 16, the `runtime` config option is **not available in `proxy.ts`** — proxy always runs on Node when self-hosted/on Vercel. This is a change from middleware in Next.js ≤15, which defaulted to Edge. Source: Next.js 16.2 docs, "proxy.js" reference.

---

## Auth Boundary Detail

**Public routes:** `/login`, `/_next/static/*`, `/_next/image/*`, `/favicon.ico`. Optionally `/api/health` if added.

**Protected routes:** Everything else, declared via `proxy.ts` matcher (negative lookahead).

**Cookie shape:**
```
Name:     session
Value:    <JWT signed with HS256 by jose, payload={ authed: true, exp }>
HttpOnly: true
Secure:   true (in prod)
SameSite: lax
Path:     /
Max-Age:  604800  (7 days; renewable on activity if desired)
```

**Why this is enough:**
- Single shared password, no per-user state. The JWT payload literally only needs `authed: true` (+ `exp` for natural expiry).
- HttpOnly + Secure + SameSite-lax covers XSS and CSRF for read-only navigations.
- The cookie is set ONLY by the login Server Action, never by `proxy.ts` (per Next.js docs: cookie creation should go through a Server Action or Route Handler, not proxy).

**Re-verification inside the app:**
- `(dashboard)/layout.tsx` calls `verifySession()` from `lib/auth/dal.ts`. This is the second line of defense — proxy is not enough on its own per Next.js security guidance.
- Any Server Action that mutates state (none in v1, but logout for instance) calls `verifySession()` first.

---

## Component Boundaries (Server vs Client)

| Component | Type | Reason |
|-----------|------|--------|
| All `page.tsx` | Server | Need to `await` Sheets and access env vars. |
| All `layout.tsx` | Server | Same. |
| `LineChart`, `BarChart`, `DonutChart` (Recharts/Tremor wrappers) | **Client** | Recharts uses browser APIs (SVG layout, ResizeObserver). Mark `'use client'` at top of file. |
| `DateRangePicker` | **Client** | Calendar UI = state + event handlers. |
| `ClienteFilter` (dropdown) | **Client** | Same. Updates URL searchParams via `useRouter().push`. |
| `KpiTile`, `Card`, `Section` | Server | Pure layout, no state. Cheaper as RSC. |
| `DataTable` (sortable, filterable) | **Client** | Sorting/filter UI. Receives raw rows as props. |
| `TabNav` | Could be either | Server is fine if just `<Link>`s. Mark client only if active-tab highlighting needs `usePathname`. Prefer server with conditional className via `headers()` if possible. |
| `LoginForm` | **Client** | Uses `useActionState` for inline errors. |

**The line for charts:** Server Component owns the data, Client Component owns the rendering. The Client Component should be **dumb** — it receives `data: ChartDatum[]` and config (colors, labels, axes). All transformation has already happened server-side. This keeps the Client bundle small (no domain logic on the client) and means the eventual Sheets → DB swap doesn't change a single chart file.

---

## Build Order / Phase Sequence

**Confirming the hunch:** YES — a "skeleton phase" should come first. The dependency graph is unambiguous.

### Dependency graph

```
                   ┌─────────────────────────┐
                   │  Phase 0: Skeleton      │
                   │  (auth + adapter +      │
                   │   layout shell)         │
                   └────────────┬────────────┘
                                │
         ┌──────────────────────┼─────────────────────┐
         │                      │                     │
         ▼                      ▼                     ▼
  ┌──────────────┐      ┌──────────────┐      ┌─────────────┐
  │ Phase 2:     │      │ Phase 3:     │      │ Phase 4:    │
  │ Bonos        │      │ Recargas     │      │ Payouts     │
  │ (uses TX     │      │ (uses TX     │      │ (uses TX +  │
  │  sheet)      │      │  sheet)      │      │  payout-    │
  └──────┬───────┘      └──────┬───────┘      │  times)     │
         │                     │              └──────┬──────┘
         │                     │                     │
         │                     ▼                     │
         │              ┌──────────────┐             │
         │              │ Phase 5:     │             │
         │              │ Clientes     │             │
         │              │ (aggregates  │             │
         │              │  TX rows)    │             │
         │              └──────┬───────┘             │
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
                        ┌──────────────┐
                        │ Phase 1 (or  │
                        │ last):       │
                        │ Inicio       │
                        │ (overview —  │
                        │  reuses      │
                        │  Bonos/Pay-  │
                        │  outs/Cli-   │
                        │  entes KPIs) │
                        └──────────────┘
```

### Suggested sequence

| Phase | Name | What ships | Why this order |
|-------|------|------------|----------------|
| **0** | **Skeleton** (mandatory first) | `npx create-next-app` → `proxy.ts` (auth gate) → `lib/auth/session.ts` + login page → `lib/sheets/client.ts` (auth singleton, no queries yet) → `(dashboard)/layout.tsx` with the 5-tab nav → 5 empty tab pages (`<h1>Bonos</h1>` placeholders). | Every subsequent phase imports from these. No tab can be built without the adapter and the gate. Login + tab nav + a green "Sheets connection works" smoke test is the v0.1 deliverable. |
| **1** (or last) | **Inicio** | The overview tab. KPIs aggregated across multiple sheets. | Two valid placements: (a) **first** with placeholder KPIs to give stakeholders something to look at while other tabs incubate; (b) **last** because real Inicio KPIs are derivatives of Bonos/Payouts/Clientes. Recommend **last** for real KPIs, with a stub from Phase 0 so the URL works. |
| **2** | **Bonos** | First real tab. Forces the full pipeline: `getTransactions` adapter → domain types → aggregations → first real Recharts integration. | Bonos is the revenue tab — highest stakeholder interest, sharpest validation that the architecture works end-to-end. Building it first establishes patterns that the next 3 tabs reuse. |
| **3** | **Recargas** | Reuses `getTransactions` (different filter), reuses chart components from Bonos. Should be small. | Same data source as Bonos. By now patterns are set; this is mostly composition. |
| **4** | **Payouts** | First tab to use the *second* sheet (`payout-times`). Validates that adding a new sheet is purely additive (drop a new file in `lib/sheets/`). | Tests the additive-adapter promise. If anything in the architecture is broken, it surfaces here. |
| **5** | **Clientes** | Aggregations across transactions grouped by cliente. Adds the cliente filter that other tabs may also use. | Cross-cutting filter (cliente) is best designed once Bonos/Recargas/Payouts have shown what filters they need. Building it last lets the filter design absorb real requirements. |
| **6** | **Inicio (real)** | Overview KPIs sourced from helpers built in Phases 2–5. Polish + presentational pass for client demos. | KPI definitions stabilize only after the per-tab tabs are live. Doing this last avoids rework. Also a natural moment to do design/presentation polish before showing clients. |

**Phase 0 acceptance criteria (recommended GSD definition):**
- [ ] `/login` renders, accepts the shared password, sets a signed cookie, redirects to `/inicio`.
- [ ] `/logout` clears the cookie and returns to `/login`.
- [ ] All 5 tabs render placeholder content behind the auth gate.
- [ ] `lib/sheets/client.ts` successfully authenticates with the service account in a smoke-test Server Action / page (e.g. `/inicio` shows "Connected to Sheets — read 12 rows from Transacciones").
- [ ] Deploy to Vercel works; env vars set; protected routes are actually protected.

---

## Future-Proofing Without Overengineering

Two boundaries do all the work:

1. **`src/lib/sheets/<sheet>.ts` exports `Promise<DomainType[]>`.** When Tikin core integration arrives, replace the body of each function (call internal API, query a Postgres view, whatever) — keep the signature. Charts/pages don't change.

2. **`src/lib/domain/` is data-source-agnostic.** Types and aggregations don't import from `lib/sheets/`. They take arrays in, return computed values out.

**What we're explicitly NOT doing (YAGNI):**
- ❌ A formal Repository interface with multiple implementations. One-implementation interfaces are speculative. The function signature IS the contract.
- ❌ A query builder / ORM-shaped layer. Direct functions per query are fine.
- ❌ A separate `services/` layer. The adapter IS the service for v1.
- ❌ Generic "data fetcher" abstraction. Each sheet is hand-mapped because Sheets schemas are arbitrary.

**Migration path when Tikin core lands (sketch):**
1. Stand up a new `src/lib/tikin/` adapter folder with the same function signatures.
2. Switch imports tab-by-tab: `from '@/lib/sheets/transactions'` → `from '@/lib/tikin/transactions'`. Or have `@/lib/data/transactions` re-export based on an env flag for staged rollout.
3. Delete `lib/sheets/` when all tabs migrated.
4. Charts, pages, domain code, auth, layout — all unchanged.

That migration touches *one folder* if the boundary is respected.

---

## Anti-Patterns

### Anti-Pattern 1: Calling `googleapis` directly from a `page.tsx`
**What people do:** Skip `lib/sheets/` and write `const sheets = google.sheets({ ... })` inside a route file.
**Why it's wrong:** Every component that does this is impossible to swap to a different data source later. Also makes type duplication and Zod validation harder. Also leaks credential handling into route code.
**Do this instead:** All `googleapis` imports live in `lib/sheets/client.ts`. All Sheets reads go through typed adapter functions.

### Anti-Pattern 2: Route Handlers + client SWR for data the Server Component could fetch
**What people do:** Build `/api/bonos` Route Handler, then `useSWR('/api/bonos')` in a Client Component.
**Why it's wrong:** Adds a hop, JSON serialization, loading-state plumbing, and two surfaces to secure (Route Handler must re-verify session). For internal-traffic, live-read pages, you gain nothing. App Router is designed to make this unnecessary.
**Do this instead:** Server Component awaits adapter directly. Use Route Handlers only when you genuinely need an HTTP API surface (mobile client, third-party webhook, public CORS endpoint — none of which apply here).

### Anti-Pattern 3: Setting the session cookie inside `proxy.ts`
**What people do:** Try to refresh or create the auth cookie in proxy.
**Why it's wrong:** Per Next.js docs: "you cannot set an initial session cookie in proxy. The login flow should always go through a Route Handler or Server Action." Proxy can read cookies but should not be the place that mints them.
**Do this instead:** Cookie is set by `app/login/actions.ts` (Server Action). Proxy only reads/verifies.

### Anti-Pattern 4: Charts as Server Components
**What people do:** Try to render Recharts inside a Server Component.
**Why it's wrong:** Recharts/Tremor use browser APIs (SVG measurement, ResizeObserver). They're client-only. Mixing them into RSC errors at build time.
**Do this instead:** RSC computes data and passes plain props. `'use client'` at the top of every chart file. Chart files import nothing from `lib/sheets/` — they should import only from `lib/domain/types.ts` (or be entirely prop-typed locally).

### Anti-Pattern 5: Storing filter state in React state
**What people do:** `const [from, setFrom] = useState(...)` in a Client Component, then re-fetch on change.
**Why it's wrong:** Re-fetch needs a new client→server round trip. Also: the URL no longer represents the current view, so sharing a filtered view with a colleague (or screen-sharing for a client) breaks. And it forces you back into Route Handlers + SWR (anti-pattern 2).
**Do this instead:** Filters live in `searchParams`. The Client filter component does `router.push(?from=...&to=...)`. RSC re-renders with new params. URL is shareable.

### Anti-Pattern 6: Service-account JSON inlined in `next.config.ts` or read from disk at runtime
**What people do:** Read `service-account.json` with `fs.readFileSync` at request time.
**Why it's wrong:** Vercel's filesystem is ephemeral; bundling the JSON file ships secrets if not careful; rotating credentials requires a redeploy.
**Do this instead:** Store `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (with `\n` newlines preserved) as Vercel env vars. `lib/sheets/client.ts` builds the auth from those.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Sheets API v4 | `googleapis` npm + service account (JWT) auth, server-side only. | Quotas: 300 read req/min/project, 60/min/user. Low traffic project — not a concern. Keep singleton client. Share with editor permission per spreadsheet. |
| Vercel | Deploy via Git. Env vars in dashboard. | `DASHBOARD_PASSWORD`, `SESSION_SECRET`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `SPREADSHEET_TRANSACTIONS_ID`, `SPREADSHEET_PAYOUTS_ID`. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/(dashboard)/*` ↔ `lib/sheets/*` | Direct async function call (RSC awaits) | Single direction. Pages depend on adapter; adapter knows nothing of pages. |
| `lib/sheets/*` ↔ `lib/domain/types.ts` | Adapter imports types | Adapter returns `Transaction[]` etc. Types defined once in `lib/domain/`. |
| `lib/domain/kpis.ts` ↔ `lib/sheets/*` | NONE | Domain logic must not import from `lib/sheets/`. Take data in, return computed values. This is the future-proofing seam. |
| `proxy.ts` ↔ `lib/auth/*` | Direct import (Node runtime) | Proxy must NOT import `lib/sheets/*`. |
| `components/charts/*` ↔ `lib/sheets/*` | NONE | Client Components must not import server-only modules. Charts get data through props. |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Internal use, ≤10 viewers, ad-hoc | Current architecture. Live reads, no cache. |
| Daily team use, 10–50 viewers | Add `unstable_cache` with 30–60s `revalidate` on hot adapter functions. Keep live read for "force-refresh" via a query param. |
| Client-portal scale (out of scope per project doc) | Move off Sheets entirely (Postgres, BigQuery view, or Tikin core). Keep adapter signatures. |

### Scaling Priorities (what breaks first)

1. **Sheets API latency.** A page that calls 3 sheets sequentially feels slow. Mitigate: `Promise.all` parallel calls in adapters, then `<Suspense>` per chart for streaming.
2. **Sheets API quota** (very unlikely at internal-team scale). Mitigate: 60s `unstable_cache`.
3. **Service-account secret rotation.** Rotate annually or on team change. Documented in `.env.example`.

---

## Sources

### HIGH confidence (Next.js 16.2 official docs, fetched 2026-04-27)

- [Next.js Authentication guide (v16.2.4)](https://nextjs.org/docs/app/building-your-application/authentication) — Server Actions for login, cookies via `next/headers`, DAL pattern, `verifySession()` with `React.cache`, "do not set cookies in proxy", proxy is not the only line of defense.
- [Next.js Fetching Data (v16.2.4)](https://nextjs.org/docs/app/getting-started/fetching-data) — Server Components fetch directly, plain props to Client Components, `Promise.all` for parallel, `React.cache` memoization, Suspense streaming.
- [Next.js proxy.js (v16.2.4)](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — `middleware.ts` deprecated and renamed to `proxy.ts` in v16.0; defaults to **Node.js runtime**; `runtime` config is not available in proxy; "the login flow should always go through a Route Handler or Server Action."
- [Next.js Edge Runtime (v16.2.4)](https://nextjs.org/docs/app/api-reference/edge) — "Native Node.js APIs are not supported"; `googleapis` requires Node runtime.
- [Next.js Project structure (v16.2.4)](https://nextjs.org/docs/app/getting-started/project-structure) — Route groups `(group)`, private folders `_folder`, optional `src/`, colocation rules.
- [Next.js 16 release notes](https://nextjs.org/blog/next-16) — current stable line is 16.2.x; Turbopack default; React Compiler stable.

### MEDIUM confidence (community sources, cross-referenced with official)

- [Google Auth Library Node.js (GitHub)](https://github.com/googleapis/google-auth-library-nodejs) — service account JWT auth requires Node-native crypto.
- [GoogleAPIs Node Client (GitHub)](https://github.com/googleapis/google-api-nodejs-client) — `googleapis` is the umbrella package; service account flow.
- [Iron Session](https://github.com/vvo/iron-session) and [jose](https://github.com/panva/jose) — recommended by Next.js docs as session management primitives.

### LOW confidence (not relied on for any architectural claim)

- Various 2025–2026 dev.to and Medium articles on Next.js + Sheets integrations (used only for sanity-checking that this pattern is common in the wild).

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Project structure | HIGH | Verified against Next.js 16.2 official project-structure docs. |
| Server vs Client boundaries | HIGH | Verified against Next.js 16.2 fetching-data and server-and-client-components docs. |
| `proxy.ts` runtime + naming | HIGH | Directly from Next.js 16.2 proxy reference (v16 renamed middleware → proxy; Node default). |
| Auth pattern (cookie + DAL) | HIGH | Mirrors official Next.js Authentication guide almost verbatim. |
| Sheets adapter pattern | MEDIUM-HIGH | Standard practice; not codified in any single source but logically derived from Next.js Server Component data-fetching guidance + googleapis Node-only constraint. |
| Build order | MEDIUM | Derived from dependency analysis (skeleton must precede tabs); verified against project's iterative-build philosophy. The Inicio-last call is judgment, not doctrine. |
| Edge vs Node decision | HIGH | googleapis Node-only is verified; Next.js 16.2 proxy Node default is verified. |

---

*Architecture research for: Tikin Dashboard (Next.js + Google Sheets, password-gated, Vercel)*
*Researched: 2026-04-27*
