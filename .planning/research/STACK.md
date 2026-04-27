# Stack Research

**Domain:** Internal B2B operations dashboard reading live from Google Sheets, deployed to Vercel, protected by shared password
**Researched:** 2026-04-27
**Confidence:** HIGH (Next.js, Sheets client, auth, Vercel limits) | MEDIUM (chart library trade-offs, Tailwind v4 ergonomics)

## Executive Recommendation (one-liner)

**Next.js 16 (App Router, Node runtime) + `googleapis` for Sheets reads in Server Components with `cache: 'no-store'` + shadcn/ui (Tailwind v4) + Recharts via shadcn `chart` component + TanStack Table v8 via shadcn `data-table` + Jose-based JWT cookie session set by a Server Action + `proxy.ts` gate. Deploy to Vercel Hobby; Sheets calls run server-only in Node runtime, well under the 10s Hobby timeout.**

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | **16.2.x** (App Router) | Framework, routing, server rendering | v16 stable since Oct 2025; default in `create-next-app`; Turbopack stable; bundles React 19.2; the App Router is the only forward path. Confidence: **HIGH** |
| React | **19.2** (transitive via Next.js 16) | UI runtime | Bundled with Next.js 16; required by shadcn/ui current components. Confidence: **HIGH** |
| TypeScript | **5.5+** (5.1 minimum for Next 16) | Type safety | Next.js 16 dropped TS <5.1; `create-next-app` is TypeScript-first. Confidence: **HIGH** |
| Tailwind CSS | **4.x** | Styling | shadcn/ui current generation is built on Tailwind v4; CSS-first config (`@theme`); auto content detection. Confidence: **HIGH** |
| shadcn/ui | latest (CLI: `shadcn@latest`) | UI primitives, layout, data-table, chart, sidebar | Copy-paste model = no runtime dep, zero version drift; Radix-based accessibility; the de facto Next.js dashboard kit in 2026; ships its own `chart` and `data-table` components matched to your design tokens. Confidence: **HIGH** |
| `googleapis` | **^144** (or current latest) | Google Sheets API client | Official Google client. Pairs cleanly with `google-auth-library` JWT for service accounts. Better long-term bet than third-party wrappers. Confidence: **HIGH** |
| `google-auth-library` | latest (peer of `googleapis`) | JWT auth for service account | Required to authenticate the service account JSON without OAuth user flow. Confidence: **HIGH** |
| Recharts | **3.8.x** | Chart rendering | Used **under the hood** by shadcn/ui's `chart` component (officially documented). Stable, declarative, SVG, React-19 compatible. Confidence: **HIGH** |
| TanStack Table | **v8** (`@tanstack/react-table`) | Headless table logic | Powers shadcn/ui's `data-table`; sorting/filtering/pagination/columns without ceremony; client-side is fine for our row counts (Sheets rarely > a few thousand rows). Confidence: **HIGH** |
| Jose | latest (`jose`) | JWT sign/verify for the session cookie | Officially recommended by Next.js docs for stateless sessions; Edge-compatible; no extra encryption ceremony for our single-flag use case. Confidence: **HIGH** |
| Zod | **v4** (`zod`) | Login form / env validation | Lightweight schema validation for the password form input and `process.env` shape. Confidence: **HIGH** |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | latest | Icon set used by shadcn/ui | Always — pulled in by `shadcn` CLI when adding components |
| `class-variance-authority` (`cva`) | latest | Variant utilities used by shadcn | Always — installed by shadcn CLI |
| `clsx` + `tailwind-merge` | latest | Conditional class merging | Always — shadcn's `cn()` helper depends on these |
| `tw-animate-css` | latest | Animations (Tailwind v4 replacement for `tailwindcss-animate`) | Required by shadcn/ui v4 components; installed automatically by current shadcn CLI |
| `date-fns` | **v4** | Date formatting / parsing | When tabs render `created_at` columns or filter by date range |
| `bcryptjs` *(optional)* | latest | Hash the shared password env var | If you want the env var to store a hash instead of plaintext (recommended). Pure JS, works in Node runtime. |
| `react-hook-form` | latest | Login form state | Optional — a single `<input type="password">` does not require it. Use only if the login UI grows. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Turbopack | Dev + production bundler | Default in Next.js 16 — no opt-in needed. 2-5× faster builds, 10× faster Fast Refresh |
| ESLint | Linting | Next.js 16 **removed `next lint`** — install ESLint directly. `@next/eslint-plugin-next` defaults to ESLint Flat Config |
| Biome *(alternative)* | Linting + formatting | Faster than ESLint; viable replacement now that `next lint` is gone |
| Prettier | Formatting | Standard; pair with `prettier-plugin-tailwindcss` to sort utility classes |
| `dotenv-cli` | Local `.env.local` workflow | Vercel handles env injection; this only matters for local dev |

## Installation

```bash
# 1. Bootstrap the project (App Router, TypeScript, Tailwind v4 by default)
npx create-next-app@latest dashboard-tikin --app --typescript --tailwind --eslint

cd dashboard-tikin

# 2. shadcn/ui — initialize, then add the components we need
npx shadcn@latest init
npx shadcn@latest add button card input label tabs sidebar separator skeleton sonner
npx shadcn@latest add chart           # Recharts-backed chart primitives
npx shadcn@latest add table data-table # TanStack Table v8 wrapper

# 3. Google Sheets client
npm install googleapis google-auth-library

# 4. Auth + validation
npm install jose zod
npm install -D @types/node

# 5. Optional but recommended
npm install bcryptjs date-fns
npm install -D @types/bcryptjs
```

## Data Fetching Pattern (prescriptive)

**Use Server Components + `cache: 'no-store'`. No SWR, no Route Handlers, no ISR.**

```ts
// app/lib/sheets.ts
import 'server-only';
import { google } from 'googleapis';

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function readRange(spreadsheetId: string, range: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    // Force fresh data on every call. Server Components in Next 16 are
    // dynamic-by-default, but we set this explicitly so behavior survives
    // any future opt-in to Cache Components.
  });
  return res.data.values ?? [];
}
```

```ts
// app/(dashboard)/bonos/page.tsx
export const dynamic = 'force-dynamic'; // belt-and-suspenders against accidental caching

export default async function BonosPage() {
  const rows = await readRange(SHEET_ID, 'Bonos!A1:Z');
  return <BonosView rows={rows} />;
}
```

**Why this pattern:**
- **Server Components** keep the Google service-account credentials server-side — they never reach the client bundle
- **Next.js 16 is dynamic-by-default**: page is rendered on each request unless you opt into `"use cache"`. This matches the requirement to read live from Sheets every page load
- **No client-side data fetching** = no client→API round-trip = simpler, faster, fewer rate-limit pressure points
- **`export const dynamic = 'force-dynamic'`** is explicit insurance against future opts into Cache Components

**Do NOT use** SWR / TanStack Query for the primary read path. They're for client-driven data; we already have the data on the server before the page renders.

## Google Sheets API: Rate Limits & How This Pattern Handles Them

**Quotas (verified from Google's official `developers.google.com/workspace/sheets/api/limits`, updated April 2026):**

| Quota | Limit | Notes |
|-------|-------|-------|
| Read requests / minute / project | **300** | Refills every minute |
| Read requests / minute / user / project | **60** | **A service account counts as a single user** — this is the one that bites |
| Write requests / minute / project | 300 | Not relevant; we are read-only |
| Daily limit | None | Per-minute only |
| Error on overage | HTTP `429: Too many requests` | Retry with exponential backoff + jitter |

**Implications for this project:**

- The service account is a single "user" → effective ceiling is **60 reads/min** (the per-user-per-project limit), not 300
- A page load that hits 5 ranges (Inicio + 4 sub-tabs of aggregations) = 5 reads. So **12 page loads/min** before throttling
- For a low-traffic internal tool this is fine, but **batch reads** to be safe: `spreadsheets.values.batchGet` returns multiple ranges in one quota-counted request

**Mitigations to bake in from day one:**

1. **Use `batchGet` everywhere** — combine all ranges a page needs into one API call:
   ```ts
   sheets.spreadsheets.values.batchGet({ spreadsheetId, ranges: ['Bonos!A:F','Recargas!A:E'] })
   ```
2. **Two-tier in-memory dedup per request**: if multiple Server Components on the same page need the same range, fetch once and pass via React `cache()` (the React 19 primitive — not Next.js's removed cache). This deduplicates within a single render pass.
3. **429 handler with exponential backoff** (250ms → 500ms → 1s → 2s, max 3 retries, jitter ±20%). Wrap `readRange` once.
4. **Surface 429s to the UI** instead of crashing — show "Datos temporalmente no disponibles, reintentando…" so demos to clients don't show a red error page.
5. **Optional escape valve**: if traffic ever grows, add `unstable_cache` / `"use cache"` with a 30-second `cacheLife` profile. Not needed v1.

## Auth Strategy (prescriptive, implementable)

**Choice: custom Jose-based JWT cookie session, set by a Server Action, gated by `proxy.ts`. Password stored as bcrypt hash in env var.**

### Why this and not the alternatives

| Option | Verdict | Reason |
|--------|---------|--------|
| **Vercel Password Protection** | ❌ Reject | Paid tier only — Enterprise plan or Pro + $150/month "Advanced Deployment Protection" add-on. Not on Hobby. |
| **NextAuth (Auth.js) Credentials provider** | ❌ Overkill | Designed around per-user accounts. For a single shared password it adds adapter, schema, and provider config we never use. |
| **HTTP Basic Auth in `proxy.ts`** | ❌ Reject | Browser native modal looks unprofessional; you cannot project that to a corporate client. No logout. No "remember me." Credentials transit on every request as base64 (still over HTTPS, but clunky). |
| **iron-session** | ⚠️ Acceptable but heavier | Encrypts the whole session payload. Fine, but for a single boolean `{ isAuth: true }` Jose-signed JWT is lighter and is **the pattern Next.js's official auth guide demonstrates**. |
| **Jose JWT in HttpOnly cookie + `proxy.ts` check** | ✅ **Recommended** | Matches official Next.js docs (`/docs/app/guides/authentication`), Edge-compatible, minimal deps, full control over the login UI for the "looks presentable" requirement. |

### Concrete flow

```
1. User hits any route → proxy.ts intercepts
2. proxy.ts reads `session` cookie, verifies JWT with jose
3a. Valid + not expired → NextResponse.next()
3b. Invalid/missing/expired AND path !== '/login' → redirect to /login
4. /login page renders a single <input type="password"> form
5. Form submits to a Server Action `login(formData)`
6. Server Action: bcrypt.compare(input, process.env.DASHBOARD_PASSWORD_HASH)
7. On match: jose.SignJWT({ ok: true }).setExpirationTime('30d').sign(key)
   → cookies().set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60*60*24*30 })
   → redirect('/')
8. On miss: re-render /login with error via useActionState
9. Logout: a Server Action that calls cookies().delete('session')
```

**Implementation specifics:**

- **File**: `proxy.ts` at project root (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the old name is deprecated but still works for one more major). Use `proxy.ts` from day one.
- **Session secret**: `SESSION_SECRET` env var, generated via `openssl rand -base64 32` (≥32 chars required for HS256)
- **Password storage**: `DASHBOARD_PASSWORD_HASH` env var holding a bcrypt hash. Generate locally with `bcryptjs` and paste into Vercel env. **Never store the plaintext password as an env var** — anyone with read access to Vercel project settings would see it.
- **Session duration**: 30 days. The team rarely logs in; per-user revocation is not a concern (single shared secret).
- **Cookie options**: `{ httpOnly: true, secure: true, sameSite: 'lax', path: '/' }`. `secure` works automatically on Vercel (HTTPS); for local dev, conditionally drop it.
- **Routes Proxy must NOT run on**: `/_next/*`, `/api/health` (if added), and the login page itself. Standard matcher:
  ```ts
  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/login).*)'],
  };
  ```
- **Runtime**: `proxy.ts` runs on Node.js runtime by default in Next.js 16 (this is the explicit reason it was renamed from `middleware.ts`). Jose works in both runtimes.

## Vercel Deployment Specifics

| Concern | Decision | Notes |
|---------|----------|-------|
| Plan | **Hobby** for v1 | Free; sufficient for low-traffic internal use. Migrate to Pro when traffic or function-time grows |
| Function runtime | **Node.js** (default) | `googleapis` does not work on Edge Runtime (uses Node `crypto`/`stream`). Keep Sheets calls on Node-runtime Server Components |
| Function timeout | **10s on Hobby** (60s on Pro, up to 800s with Fluid Compute) | A `batchGet` with 2-3 ranges typically resolves in <1s. Plenty of headroom. |
| Region | Pin to `iad1` (Washington) or `cdg1` (Paris) | Closest to Google's `sheets.googleapis.com` US/EU regions; reduces network RTT |
| Env vars | Set in Vercel project settings (3 vars) | `SESSION_SECRET`, `DASHBOARD_PASSWORD_HASH`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEETS_TRANSACTIONS_ID`, `GOOGLE_SHEETS_PAYOUTS_ID` |
| **Service account private key** | Store as **single-line env var with `\n` escapes**, then `.replace(/\\n/g, '\n')` at runtime | Vercel env UI strips literal newlines. **Don't** try to upload the JSON file — split it into discrete vars |
| Custom domain | Add `dashboard.tikin.co` in Vercel → Domains; CNAME to `cname.vercel-dns.com` | Free with Vercel. SSL auto-provisioned |
| Logs | Vercel Logs UI is sufficient v1 | If 429s become frequent, add Axiom/Logtail integration |

**Critical guardrail:** Do **not** mark Sheets-calling routes with `runtime = 'edge'`. The `googleapis` package depends on Node-only modules. Use the default Node runtime.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 16 | Next.js 15 | If a critical dependency (e.g., a corporate auth lib) hasn't yet certified v16 — not the case here. v16 is the right call for greenfield. |
| `googleapis` | `google-spreadsheet` (theoephraim, v5.2.0, Feb 2026) | If you need a friendlier ORM-like API and don't mind a third-party wrapper layer over the official client. Still actively maintained. Tradeoff: smaller community, less direct Google support. |
| Server Components + `no-store` | Route Handler + SWR | If you later add interactive client-side filters that should refetch without a page nav. For v1's tab-switch reads, Server Components are simpler. |
| shadcn/ui (copy-paste) | Tremor (npm) | Tremor (`@tremor/react` 3.18.x, also offers a copy-paste mode now that they joined Vercel) is excellent for chart-heavy dashboards. Pick if you'd rather not assemble layout primitives. shadcn wins on layout flexibility, polish, and ecosystem. |
| Recharts (via shadcn `chart`) | visx | If a single chart needs custom interactions D3 can express but Recharts can't. Steep learning curve; not worth it for KPI cards + line/bar/donut. |
| TanStack Table v8 (via shadcn `data-table`) | AG Grid Community | If you need spreadsheet-grade features (frozen columns, virtualized 50k rows, cell editing). Overkill for read-only tables of a few thousand rows. |
| Jose JWT cookie | iron-session | If you later need to store more than a single boolean in the session (e.g., a per-user role). For a single shared password, Jose is leaner. |
| Custom Server-Action login | NextAuth Credentials | If you migrate to per-user login. Then Auth.js is the right framework. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Pages Router** | Legacy. Next.js 16 ships App Router as the only documented path; new docs assume it. | App Router (`app/` directory) |
| **`middleware.ts`** filename | Deprecated in Next.js 16; replaced by `proxy.ts` for clearer Node-runtime semantics. Still works but emits warnings. | `proxy.ts` |
| **`next lint` command** | Removed in Next.js 16. `next build` no longer runs linting. | ESLint or Biome called directly via npm script |
| **`experimental.ppr` / `experimental_ppr`** | Removed in Next.js 16; replaced by Cache Components (`cacheComponents: true`). | Don't enable Cache Components for v1 — we want fresh-on-every-load. |
| **HTTP Basic Auth via middleware** | Browser-native dialog is unprofessional and breaks the "presentable to corporate clients" requirement; no logout; no styling. | Jose JWT cookie + custom `/login` page |
| **Storing the shared password as plaintext env var** | Anyone with project-settings access in Vercel sees the plaintext. Also blocks rotating the secret without re-deploying everywhere. | bcrypt hash in `DASHBOARD_PASSWORD_HASH` |
| **Vercel Password Protection** | Paid tier only ($150/mo Pro add-on or Enterprise). | Custom auth as above. |
| **Edge Runtime for Sheets-calling routes** | `googleapis` uses Node `crypto`/`stream` — fails at runtime on Edge. | Keep Server Components on default Node runtime |
| **`force-cache` or `revalidate` on Sheets reads** | Defeats the "live read on each page load" requirement. | `cache: 'no-store'` + `export const dynamic = 'force-dynamic'` |
| **`react-google-charts` / Chart.js** | Chart.js is canvas-based (worse for export/screenshots in client demos); `react-google-charts` ironically pulls Google's Visualization SDK which is heavy and dated. | Recharts via shadcn `chart` |
| **`tailwindcss-animate`** | Deprecated in the Tailwind v4 era. | `tw-animate-css` (auto-installed by current shadcn CLI) |
| **Uploading the service-account JSON file to Vercel** | Vercel env UI doesn't accept multi-line files cleanly. | Split into `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` env vars; runtime `.replace(/\\n/g, '\n')` on the key |

## Stack Patterns by Variant

**If traffic stays internal (current case):**
- Hobby plan, single region, no caching layer, batch `values.batchGet` per page
- 60 reads/min/service-account ceiling is fine

**If you start projecting to clients live during many simultaneous calls:**
- Add `"use cache"` with `cacheLife('seconds')` or `cacheLife({ expire: 30 })` on read functions to dedupe simultaneous viewers
- Trade: data is up-to-30-seconds stale during the call window. Acceptable for KPIs.

**If multiple clients schedule concurrent demos:**
- Move to Vercel Pro for the 60s function timeout headroom and Fluid Compute
- Consider a second service account so quota is split (each gets its own 60/min)

**If you ever need to write back to Sheets (out-of-scope today):**
- Add the `https://www.googleapis.com/auth/spreadsheets` scope (drop `.readonly`)
- Wrap writes in Server Actions, never expose to client
- Watch the **300 writes/min/project** quota separately

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@16.x` | `react@19.x`, `react-dom@19.x` | Bundled together; do not mix React versions |
| `next@16.x` | Node.js **>= 20.9** | Node 18 dropped. Vercel default is current. |
| `next@16.x` | TypeScript **>= 5.1** | 5.5+ recommended |
| `recharts@3.x` | React 19 | Works; some users override `react-is` peer dep — confirm in `package.json` if a warning appears |
| `shadcn/ui` (current) | Tailwind **v4**, React 19 | The CLI installs a v4-compatible `components.json`; v3 setup steps are obsolete |
| `googleapis` | Node 18+ runtime, **NOT Edge** | Uses Node `crypto` + streams |
| `jose` | Node + Edge runtimes | Works in `proxy.ts` regardless of runtime choice |
| `@tanstack/react-table@8.x` | React 18 + 19 | The shadcn `data-table` component is built on this version |

## Implementation Checklist (for the roadmap)

```
[ ] create-next-app@latest with --app --typescript --tailwind --eslint
[ ] Initialize git, push to GitHub
[ ] shadcn init + add: button, card, input, label, tabs, sidebar, separator, skeleton, sonner, chart, data-table
[ ] Create app/lib/sheets.ts with JWT auth + readRange + batchRead helpers + 429 backoff
[ ] Create app/lib/session.ts with jose encrypt/decrypt + cookie helpers
[ ] Create app/(auth)/login/page.tsx + login Server Action with bcrypt compare
[ ] Create proxy.ts with session check + matcher excluding /login and /_next/*
[ ] Build app/(dashboard)/layout.tsx with Sidebar + tab nav (Inicio, Bonos, Recargas, Payouts, Clientes)
[ ] Stub each tab page as a Server Component with a placeholder readRange call
[ ] Generate service account JSON in Google Cloud Console, share Sheets with the service account email (Viewer)
[ ] Set 6 env vars in Vercel: SESSION_SECRET, DASHBOARD_PASSWORD_HASH, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEETS_TRANSACTIONS_ID, GOOGLE_SHEETS_PAYOUTS_ID
[ ] Deploy to Vercel; verify region is iad1 or cdg1
[ ] Add custom domain dashboard.tikin.co when ready
```

## Sources

### Primary (HIGH confidence)
- **Next.js 16 release blog** — `https://nextjs.org/blog/next-16` — verified release date Oct 21 2025; verified `proxy.ts` rename, removal of `experimental.ppr`, removal of `next lint`, Turbopack default, React 19.2 bundling, Node 20.9 minimum
- **Next.js Authentication Guide** — `https://nextjs.org/docs/app/guides/authentication` (lastUpdated 2026-04-23, version 16.2.4) — verified Jose as official recommended session library; verified `proxy.ts` example with `cookies().get('session')`; verified cookie options recommendations
- **Google Sheets API Limits** — `https://developers.google.com/workspace/sheets/api/limits` (updated April 2026) — verified 300/min/project read quota; verified 60/min/user/project quota; verified service-account-counts-as-one-user rule; verified 429 + exponential backoff guidance
- **shadcn/ui Chart docs** — `https://ui.shadcn.com/docs/components/chart` — verified Recharts is the underlying library and it is **not wrapped** but composed
- **Vercel Functions Limits** — `https://vercel.com/docs/functions/limitations` and `https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/password-protection` — verified Hobby 10s timeout, Pro 60s, Fluid Compute up to 800s; verified Vercel Password Protection requires Enterprise/Pro+add-on
- **iron-session GitHub** — `https://github.com/vvo/iron-session` — verified v8.0.1, App Router compatible, "Production ready and maintained"
- **google-spreadsheet npm** — verified v5.2.0 published Feb 2026, actively maintained by Theo Ephraim (alternative reference)

### Secondary (MEDIUM confidence)
- DEV.to and Medium 2026 dashboard guides — used for ecosystem signal (which combinations are popular), not for authoritative claims
- shadcnblocks / thefrontkit / colorlib 2026 template roundups — confirmed shadcn + TanStack + Recharts is the prevailing 2026 dashboard pattern
- Tremor website — confirmed Tremor was acquired by Vercel and now offers both copy-paste and npm modes (v3.18.x); used to validate the "alternative" recommendation

### Notes on what was NOT verified
- Exact current minor of `googleapis` (^144 stated as a likely current; the npm page returned 403 on direct fetch — confirm `npm view googleapis version` at install time)
- Whether Recharts 3.8.1 has any unresolved React 19 peer-dep edge cases beyond `react-is` override (treat as MEDIUM confidence; have a fallback to `npm install --legacy-peer-deps` ready if `npm install` warns)

---
*Stack research for: Tikin Dashboard (Next.js + Google Sheets + Vercel + shared-password)*
*Researched: 2026-04-27*
*Valid until: 2026-07-27 (90 days — Next.js minor releases land monthly; revisit if a 16.3+ release significantly changes Cache Components or Proxy semantics)*
