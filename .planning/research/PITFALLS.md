# Pitfalls Research

**Domain:** Internal/client-facing fintech dashboard — Next.js + Google Sheets API + Vercel + shared password
**Researched:** 2026-04-27
**Confidence:** HIGH (Sheets API quotas, Vercel cold starts, Next.js auth patterns verified against official docs); MEDIUM (fintech-specific reconciliation patterns from community sources)

> Severity legend: 🔴 **Critical** — will burn the project. 🟡 **Important** — will hurt. 🟢 **Nice-to-avoid** — quality issue, not existential.
>
> All pitfalls below are specific to this stack. Generic web-dev advice (XSS, SQL injection on systems we don't have, etc.) is excluded unless it has a concrete twist for this project.

---

## Critical Pitfalls

### 🔴 Pitfall 1: Service account JSON committed or shipped to client bundle

**What goes wrong:**
The Google service account `credentials.json` (or its `private_key`) ends up either (a) committed to git, (b) hard-coded in a file imported by a client component, or (c) leaked through a public API route that echoes `process.env`. Anyone with access can read every Google Sheet the service account is shared on — silently, without an audit trail Tikin controls.

**Why it happens:**
- Google Cloud downloads a real `.json` file; the natural reflex is to drop it in the repo and `import` it.
- Next.js' "everything is JavaScript" model blurs the server/client boundary; importing a server util into a `'use client'` file ships secrets to the browser.
- "It's a private repo" is treated as security. It isn't — see [Vercel's April 2026 incident](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) where non-sensitive env vars were exfiltrated via a third-party OAuth compromise.
- Newlines in `private_key` get mangled when pasted into Vercel; people work around it by checking the JSON in directly.

**How to avoid:**
- **Never** put the JSON in the repo. Add `*.json` patterns for credentials to `.gitignore` on day one (`service-account*.json`, `credentials*.json`, `gcp-*.json`).
- Store as **two** env vars in Vercel, **both marked Sensitive**: `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. In code: `process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')`.
- All Sheets-touching code lives under `src/lib/sheets/` and is imported **only** from server components, route handlers, or server actions. Add an ESLint rule (or a `server-only` import) so accidentally importing it from a client file fails the build.
- Pre-commit hook (`gitleaks` or `trufflehog`) that blocks commits containing PEM blocks (`-----BEGIN PRIVATE KEY-----`).
- Restrict the service account: it should have **Viewer** access only, and only on the two specific Sheets. Not domain-wide.

**Warning signs:**
- `git log -p | grep "BEGIN PRIVATE KEY"` returns anything → already leaked, rotate immediately.
- Any file under `app/` or `components/` that isn't in a `route.ts` / `page.tsx` server boundary references `googleapis` or the credentials.
- `next build` output mentions a credentials file in the client bundle.
- A `/api/debug` or `/api/env` endpoint exists.

**Phase to address:**
**Phase 1 — Auth & Secrets foundation** (before any Sheets read is wired up). The first commit that talks to Sheets must already use env vars and have `server-only` enforced.

**Recovery:** Rotate the service account key in GCP, redeploy, then `git filter-repo` the leak out of history (or accept history is burned and rebase from a clean point).

---

### 🔴 Pitfall 2: Showing one client's data to another client during a presentation (filter leak)

**What goes wrong:**
During a call with Client A, the comercial filters the dashboard to "Client A". A row from Client B leaks in because: (a) the filter is client-side only and a stale render shows everything for ~200ms, (b) the filter matches by a fuzzy string ("Acme" matches "Acme Corp" and "Acme Solutions"), (c) a KPI card uses an unfiltered total ("Total bonos vendidos: $X" sums across all clients while the table below filters), or (d) a tab exists that the filter doesn't apply to.

**Why it happens:**
- Filtering is implemented as a UI concern (`array.filter` in a component) instead of a data-access concern (parameter passed into the adapter).
- Aggregations are computed once at the top of the page and don't re-derive when the filter changes.
- "Internal tool" mentality — the team forgets the screen is being projected.
- Each tab has its own fetch and applies the filter independently; one tab is forgotten.

**How to avoid:**
- The **client filter is a top-level URL parameter** (`?client=acme-corp-uuid`) that every data hook reads. There is no "current client" component state.
- Match by stable ID (a slug or UUID column in Sheets), **never** by display name. Add the ID column to Sheets if it doesn't exist.
- Every aggregation re-derives from the filtered dataset. Centralize: `useFilteredData(clientId)` returns both rows and totals — there is no separate path for KPIs.
- Build a **"Presentation Mode"** toggle that:
  - Locks the URL to the selected client (greys out the selector).
  - Renders a banner: "Mostrando: Acme Corp" so the operator can't forget.
  - Hides any unfiltered tab/panel (or replaces it with a "not available in presentation mode" placeholder).
- Add a unit test: "given a filter for client A, no row in any tab has a `client_id !== A`."
- Add a runtime invariant: in production, if `presentationMode && row.client_id !== selectedClient`, throw — better a crash than a leak.

**Warning signs:**
- Code uses `client.name === '...'` or `.includes(...)` for filtering anywhere.
- A KPI is computed from a different array than the table below it.
- The filter state lives in a `useState`, not in the URL or a server param.
- During QA, switching the filter rapidly briefly shows other clients' rows (flash of unfiltered content).

**Phase to address:**
**Phase 2 — Data model & adapters** must define `client_id` as a first-class field; **Phase 4 — Presentation features** must implement Presentation Mode before the first external demo.

**Recovery:** HIGH cost if it happens in front of a client. Apologize, end the share, and audit the access path. The reputational damage is the real cost.

---

### 🔴 Pitfall 3: Schema brittleness — someone reorders/renames a column in Sheets and the dashboard breaks silently

**What goes wrong:**
Ops opens the Sheet, drags column "Monto" to a new position, or renames "Cliente" to "Empresa". The dashboard doesn't crash — it just starts showing wrong numbers, blanks, or `undefined` in subtle places. Worst case: the "Monto" column now reads what used to be "Fecha", and a date string gets summed into a financial total.

**Why it happens:**
- Column access is positional (`row[3]`) or by hard-coded header string (`row.Monto`) without validation.
- The adapter returns `any[]` because parsing was deferred. TypeScript can't help with data that came in as untyped JSON.
- No one runs validation on app boot — the first sign of breakage is a comercial in a meeting saying "este número está raro".
- Sheets has no schema enforcement; it's a freeform spreadsheet that ops edits daily.

**How to avoid:**
- **Address columns by header name, not index.** Read row 1 as headers, build a `{ headerName -> columnIndex }` map per fetch.
- **Validate every fetch with [Zod](https://zod.dev)**:
  ```ts
  const TransaccionSchema = z.object({
    fecha: z.coerce.date(),
    monto: z.coerce.number(),
    cliente_id: z.string().min(1),
    tipo: z.enum(['bono', 'recarga', 'payout']),
  });
  const Transacciones = z.array(TransaccionSchema);
  ```
  Use `.safeParse()` and on failure, render a clear "Esquema de Sheets cambió" error with the exact missing/wrong field — not a blank screen.
- **Boot-time schema check:** on cold start, fetch row 1 of each sheet and assert the expected headers exist. If not, fail loudly with a 500 + Slack alert.
- **Document the contract:** a `docs/SHEETS_SCHEMA.md` file lists every column the dashboard depends on. Linked from the Sheet itself in a "README" tab so ops knows what not to touch.
- Prefer Sheets API's `valueRenderOption=UNFORMATTED_VALUE` for numbers/dates so you get raw values, not localized strings ([docs](https://developers.google.com/workspace/sheets/api/guides/values)).

**Warning signs:**
- Adapter functions return `any[]` or `Record<string, unknown>[]`.
- Columns referenced by index: `row[3]`, `row[7]`.
- No errors in logs, but a number changed by 10× overnight.
- Headers change in Sheets and no CI check fired.

**Phase to address:**
**Phase 2 — Sheets adapter & domain types**. The adapter is not "done" until it validates with Zod and fails loudly on schema drift. This is non-negotiable; defer features instead of skipping this.

**Recovery:** MEDIUM. If headers were renamed, update the schema and redeploy. The damage is "wrong numbers shown for N hours" — possibly to a client. Add the failed schema to a regression test so it can't happen the same way twice.

---

### 🔴 Pitfall 4: Plain-text shared password + no rate limiting → trivial brute-force

**What goes wrong:**
The password is stored as `DASHBOARD_PASSWORD=tikin2026` in env. The login endpoint compares with `===`. Anyone who can guess (or who briefly saw it during a demo) gets in. Worse: an attacker scripts 1000 attempts/sec against `/api/login` and there's no rate limit. Worst: `===` is timing-leaky, so passwords can be recovered character-by-character.

**Why it happens:**
- "It's just one password, why hash it?" — but the issue isn't hashing for storage, it's protecting against timing leaks and brute force.
- Vercel's serverless model makes in-memory rate limiting useless (each invocation is fresh).
- Devs don't realize `===` on strings runs in time proportional to the matching prefix length.

**How to avoid:**
- Store the **hash** of the password in env as `DASHBOARD_PASSWORD_HASH` (bcrypt or scrypt). On login, hash the input and compare with `crypto.timingSafeEqual` ([Next.js timing-attack guidance](https://earezki.com/ai-news/2026-04-18-how-to-build-a-login-flow-in-nextjs-15-sessions-cookies-csrf-and-the-timing-attack-nobody-talks-about/)). Even with a constant-time compare, **always run the hash function** to keep response time constant, even on misses.
- **Rate limit the login endpoint** with [@upstash/ratelimit](https://upstash.com/blog/edge-rate-limiting) on Vercel KV / Upstash Redis. Sliding window: **5 attempts per 15 minutes per IP**. Run in Edge Middleware to drop attacks before they hit functions.
- After successful auth, set a session cookie:
  - `HttpOnly` (no JS access — defends XSS)
  - `Secure` (HTTPS only)
  - `SameSite=Lax` (CSRF defense; `Strict` if no cross-site links into the app)
  - `Path=/`, reasonable `Max-Age` (e.g. 7 days for internal use)
  - The cookie value is a **signed token** (JWT or HMAC), not the password itself.
- **Never** accept the password via GET / query string. POST only. Otherwise it ends up in server logs, browser history, referer headers.
- Plan for rotation: changing the password should be a one-line env var change + redeploy. Document it.

**Warning signs:**
- `DASHBOARD_PASSWORD` (not `_HASH`) in `.env.example`.
- Login route does `if (password === process.env.PASSWORD)`.
- No middleware rate limit; no `@upstash/ratelimit` dependency.
- Session cookie missing any of `HttpOnly`/`Secure`/`SameSite`.
- The password is shared in Slack/WhatsApp without a rotation plan when someone leaves.

**Phase to address:**
**Phase 1 — Auth foundation**. This is the gate to the rest of the app; it cannot be deferred. No Sheets data may be fetched until the password gate is in place with hashing + rate limit + secure cookie.

**Recovery:** LOW technically (rotate password, redeploy). HIGH if exploited and a client's data was leaked — same as Pitfall 2.

---

### 🔴 Pitfall 5: Sheets call slow + no skeleton + no error fallback → blank or broken screen during a client demo

**What goes wrong:**
The comercial opens the dashboard while sharing screen. Cold start + Sheets API call = 2-4 seconds of blank white screen. Or the Sheets API throws a 503/429 mid-call and the page renders an unhandled "Error: ECONNRESET" stack trace in front of the client. Either way, the meeting tone is now defensive.

**Why it happens:**
- Vercel functions cold-start in 2-3s when idle ([Vercel discussion](https://github.com/vercel/vercel/discussions/7961)); the Sheets call adds another 300-800ms; the first paint waits for both.
- Devs put data fetching at the page root with `await`, so React can't render anything until data resolves.
- No `loading.tsx`. No `error.tsx`. No `<Suspense>`.
- "It works on my laptop" — local dev has hot module cache; production cold path is different.

**How to avoid:**
- **`loading.tsx` per route** — Next.js renders it instantly while the page resolves ([docs](https://nextjs.org/docs/app/api-reference/file-conventions/loading)). Use a skeleton that matches the final layout (cards, table rows, chart placeholder) so layout doesn't jump.
- **`error.tsx` per route** with a presentable fallback: "No pudimos cargar los datos en este momento. Reintentar." with a retry button. **Never** show a stack trace.
- Wrap individual cards in `<Suspense>` boundaries so a slow tab doesn't block the whole page (streaming).
- **Vercel Fluid Compute** is enabled for the project ([docs](https://vercel.com/docs/fluid-compute)) — claims 99.37% zero cold starts. Confirm it's on; older Vercel projects don't get it by default.
- **Deploy region must be close to Sheets API endpoints.** Set `vercel.json` `regions: ["iad1"]` (us-east-1, where Google APIs respond fastest from us-east) or similar — not `cdg1` (Paris) which adds 200ms RTT.
- **Pre-warming:** for known demo windows, hit the dashboard once 30s before the call to warm the function. Or use a tiny Vercel cron to ping the page every 5 minutes.
- A **"Demo Mode"** flag that:
  - Pre-fetches all tabs in parallel on mount.
  - Shows a clearly visible "Última actualización: 14:23:05" timestamp so the user knows data is live.
  - Falls back to the **last successful snapshot** (cached in `unstable_cache` / `next: { revalidate: 60 }`) if the live call fails — silent degradation > red error.

**Warning signs:**
- No `loading.tsx` files in the route tree.
- `app/error.tsx` is missing or shows a generic "Something went wrong".
- DevTools shows the page hanging on a server-rendered fetch with TTFB > 1.5s.
- Lighthouse Mobile LCP > 3s.

**Phase to address:**
**Phase 3 — Presentation polish & resilience**, but `loading.tsx` and `error.tsx` go in **Phase 1** alongside the layout. The fallback-to-cache pattern lands in Phase 3 before the first client demo.

**Recovery:** MEDIUM. Each blank-screen demo costs trust. Add the fallback, push, demo again to rebuild credibility.

---

### 🔴 Pitfall 6: Treating Sheets as authoritative without validation → wrong totals on screen

**What goes wrong:**
A comercial hand-edits a row in Sheets to "fix" a typo and accidentally adds an extra zero. The dashboard sums it as `$X * 10`. The dashboard shows the inflated total in a board update. Nobody catches it for two weeks because the Sheet looks fine and the dashboard "must be right, it's automated".

**Or:** A reversed payout is recorded as a new outflow row but the original outflow row isn't marked. The dashboard double-counts: shows it as `-$X` (original) + `-$X` (the reversal entry, mis-tagged). Net should be `$0`. Reported number is `-$2X`.

**Why it happens:**
- Sheets has no validation, no constraints, no foreign keys. Anything can be typed.
- Devs assume "the source of truth is correct" because they don't know the data lifecycle.
- The dashboard does aggregations naively (`rows.reduce((s, r) => s + r.monto, 0)`) without sanity checks.
- Reversals/refunds in fintech are a known double-counting trap ([fintech transactions explainer](https://dev.to/hexstories/fintech-101-how-transactions-really-work-lj4)).

**How to avoid:**
- **Validate at the boundary** (Zod, see Pitfall 3). A `monto` field is `z.coerce.number().finite().min(-1e9).max(1e9)` — values outside that range throw, surfacing the typo.
- **Reconciliation rules in code**, not in trust:
  - A `payout_status` enum: `pending | sent | reversed | failed`. The dashboard sums only `status === 'sent'`.
  - A reversal row must reference the original (`reverses_id` column). The aggregator nets them.
  - **Idempotency keys** — if two rows have the same `transaction_id`, log an alert and use the latest by timestamp, don't sum both.
- **Sanity panels** on the Inicio tab:
  - "Outflow + Reversals = Net Outflow" displayed; if reversals > 50% of outflow in a day, flag it visually.
  - Show min/max/count alongside totals — outliers become visible.
- **Anomaly tripwires:** if today's volume is >5σ from the 30-day rolling average, render a yellow banner: "Cifras inusuales — verificar antes de presentar."
- **Audit footer:** "N filas leídas. M filas excluidas por validación. Ver detalles." — when M > 0, hover shows which rows and why.

**Warning signs:**
- Aggregations are one-line `reduce`s with no filter on status/type.
- The codebase has no concept of "reversed" or "voided".
- There's no answer to "what does the dashboard show if someone types `1000000` instead of `100000`?".
- The first time a board member spots a wrong number, the team can't reproduce it from raw Sheets.

**Phase to address:**
**Phase 2 — Domain types & business rules** must define statuses, reversals, idempotency. **Phase 3 — KPIs and tabs** consumes those rules; aggregation logic lives in `lib/metrics/` not in components.

**Recovery:** HIGH. Wrong numbers shown to leadership or clients erode trust permanently. Each "the dashboard said X but it's actually Y" moment is a setback.

---

## Important Pitfalls

### 🟡 Pitfall 7: Sheets API rate limit (300 reads/min/project, 60/user/min) hit during a demo

**What goes wrong:**
Per [Google's official limits](https://developers.google.com/workspace/sheets/api/limits): **300 reads/min/project**, **60 reads/min/user/project**. The dashboard has 5 tabs, each fetching independently on render. The team is in a meeting hitting refresh and switching tabs; QA is also testing in another window. Suddenly: HTTP 429 across the board.

**Why it happens:**
- Each tab fetches Sheets directly (no shared cache layer).
- All 5 tabs use the same service account → all count under the **60/min/user** limit, which is the binding constraint.
- Live reads on every page navigation, not deduplicated.
- No exponential backoff; failures cascade.

**How to avoid:**
- **One fetch per Sheet, per request, deduplicated.** Use Next.js' [automatic fetch memoization](https://nextjs.org/docs/app/api-reference/functions/fetch) for GET, or wrap non-fetch calls (the `googleapis` SDK uses gRPC/HTTPS but isn't `fetch`) in [React `cache()`](https://react.dev/reference/react/cache) so 5 tabs share one round-trip.
- **Short-window cache** (`unstable_cache` or `next: { revalidate: 30 }`) — 30 seconds is invisible to humans, kills 95% of API calls during rapid tab-switching. The constraint says "live reads" but 30s is functionally live for a B2B fintech dashboard.
- **One service account per environment** (dev / preview / prod) so dev testing doesn't burn prod's 60/min budget.
- **Exponential backoff with jitter** on the adapter — formula from Google: `min((2^n + jitter_ms), 32000ms)`.
- **Surface the issue** — when a 429 fires, log it with quota context and render a "Reintentando..." indicator, not a hard fail.

**Warning signs:**
- Each tab component independently calls `sheets.spreadsheets.values.get`.
- No `cache()` or `unstable_cache` wrapping the Sheets adapter.
- Logs show 429s during dev, ignored.
- All envs share one service account.

**Phase to address:**
**Phase 2 — Sheets adapter** implements deduplication and short-window cache. **Phase 3** adds backoff before the first multi-user usage.

---

### 🟡 Pitfall 8: Numbers don't match across tabs because each tab fetched at a different time

**What goes wrong:**
Inicio shows `Bonos totales: $1,200,000`. The user clicks Bonos tab; it shows `$1,210,000`. They flip back; Inicio still says the old number. A sale was made in the 4 seconds between fetches. The client on the call asks "which is correct?" and there's no good answer.

**Why it happens:**
- Each tab is a separate route with its own fetch.
- No shared "snapshot timestamp" — every tab is a fresh moment in time.
- Caching is per-tab, not per-session.

**How to avoid:**
- **One snapshot per page navigation.** Fetch all required Sheets at the route layout (or root) level, share via React context / server props. All tabs render from the same point-in-time data.
- Display a single **"Datos al: 2026-04-27 14:23:05 (UTC-5)"** timestamp in the header; it's the same on every tab.
- "Refrescar" button does a full re-fetch of all tabs simultaneously; never per-tab.
- For the sub-second-freshness use case (rare here), document explicitly that the dashboard shows "near-live" data, not tick-by-tick.

**Warning signs:**
- Each tab has its own `useEffect`/server fetch.
- No global timestamp displayed.
- Two browser tabs of the dashboard show different numbers and that's "expected".

**Phase to address:**
**Phase 2 — Data layer** centralizes snapshot fetch. **Phase 3 — Tabs** consume the shared snapshot, never fetch independently.

---

### 🟡 Pitfall 9: Currency / locale / decimal rendering inconsistencies (COP vs USD, comma vs dot)

**What goes wrong:**
- A bono price stored as `1500000` is rendered as `1,500,000` in one card, `1.500.000` in another, and `1500000.00` in a table. None of them say "COP".
- A USD-denominated payout (rare but exists) is rendered with the COP formatter: `$1,500 USD` rendered as `COP $1.500` — off by 4000×.
- The Sheet has a column with mixed `1500.50` (US dot) and `1500,50` (CO comma). `parseFloat` returns `1500` for the comma version, silently truncating cents.

**Why it happens:**
- Each component formats numbers locally with `toLocaleString()` and inconsistent options.
- The locale defaults to the server's locale (which might be `en-US` on Vercel).
- Sheets allows mixed formatting; users typing data don't enforce one convention.
- Currency isn't tracked as a column — it's assumed.

**How to avoid:**
- **One formatter module** (`lib/format/currency.ts`) used everywhere:
  ```ts
  const cop = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0, // COP has no centavos in practice
  });
  export const formatCOP = (n: number) => cop.format(n);
  ```
- **Currency is explicit** — if any column might be in a non-COP currency, add a `currency` column to the Sheet (`COP` / `USD`) and validate via Zod enum. Format using the row's currency, not a global default.
- Use `valueRenderOption=UNFORMATTED_VALUE` from Sheets API so you always get the raw number, never the locale-formatted string.
- Reject mixed-format strings at parse time: `z.coerce.number()` accepts `"1500.50"` but rejects `"1500,50"`. If ops uses commas, normalize in the adapter (`replace(',', '.')`) but only after a documented decision.

**Warning signs:**
- Multiple files call `toLocaleString` with inline options.
- No `currency` column in the schema.
- A QA pass spots different formats on different cards.

**Phase to address:**
**Phase 2 — Domain types** defines `Money = { amount: number; currency: 'COP' | 'USD' }`. **Phase 3 — Components** uses the central formatter exclusively.

---

### 🟡 Pitfall 10: Timezone bug — Vercel runs UTC, ops thinks in Bogotá time → wrong daily totals

**What goes wrong:**
The dashboard shows "Hoy: $X". `Hoy` is computed server-side via `new Date()`, which on Vercel returns UTC. Bogotá is UTC-5. At 8pm Bogotá time, the server thinks it's already the next day — "Hoy" rolls over 5 hours early. The reported daily volume is wrong. Worse: a transaction at 23:00 Bogotá on Monday gets bucketed as Tuesday in UTC, and Monday's report misses it.

**Why it happens:**
- `new Date()` and `Date.now()` are timezone-naive.
- Sheets stores dates as raw timestamps without TZ context, or as locale-formatted strings.
- "Today" is a UI concept, not a server concept; computing it on the server uses the wrong frame.
- Hydration mismatches between server (UTC) and client (Bogotá) cause subtle render bugs ([Next.js discussion](https://github.com/vercel/next.js/discussions/37877)).

**How to avoid:**
- **All date math goes through a TZ-aware library.** Recommended: [`date-fns-tz`](https://www.npmjs.com/package/date-fns-tz) or `Temporal` (now stable in Node 22+).
  ```ts
  import { toZonedTime, format } from 'date-fns-tz';
  const TZ = 'America/Bogota';
  const today = format(toZonedTime(new Date(), TZ), 'yyyy-MM-dd', { timeZone: TZ });
  ```
- **Define one canonical TZ** (`America/Bogota`) in a `lib/time.ts` constant, used everywhere.
- **Bucket by the operator's day, not UTC's day.** "Today's volume" = transactions where `toZonedTime(timestamp, 'America/Bogota')` falls in the Bogotá calendar day.
- **Render dates on the client with the explicit TZ** — never `.toLocaleString()` with no options. Always `{ timeZone: 'America/Bogota' }`.
- For Sheets data: always store as ISO 8601 with offset (`2026-04-27T14:23:05-05:00`) or as UTC + a known TZ contract. Document which.

**Warning signs:**
- Code uses `new Date()`/`Date.now()` for "today" boundaries.
- No `date-fns-tz` or `Temporal` in dependencies.
- Hydration warnings in browser console about date strings.
- Daily volume on Friday in the dashboard ≠ Friday's volume by Bogotá-time reconciliation.

**Phase to address:**
**Phase 2 — Domain types**. Define `BogotaDate` / `BogotaDateTime` types and require all date handling through them.

---

### 🟡 Pitfall 11: Sheets concerns leak into components → migration off Sheets becomes a rewrite

**What goes wrong:**
Tikin eventually wants to leave Sheets for a real database (per PROJECT.md: "fuente de verdad sigue siendo Google Sheets en esta etapa"). But `googleapis` calls, header-string column mapping, and Sheets-specific quirks (empty trailing rows, formatted-vs-unformatted values) are scattered across components. Replacing the source means rewriting the UI.

**Why it happens:**
- "Just fetch and render" is the fastest path; abstraction feels premature.
- The codebase has no domain layer — `googleapis` types flow into props.
- Components import the Sheets client directly.

**How to avoid:**
- **Hexagonal-light layering** (in this order, strict): `lib/sheets/` → `lib/adapters/` → `lib/domain/` → `lib/metrics/` → `components/`.
- Components import **only** from `lib/domain` and `lib/metrics`. They never know Sheets exists.
- The domain layer is defined first and is the contract — Zod schemas + TypeScript types. Adapters' job is to map raw Sheets rows to domain objects. If Sheets goes away, you replace the adapter, not the consumers.
- Add a lint rule: `components/**` cannot import `googleapis` or `lib/sheets/*`.

**Warning signs:**
- A component file `import`s from `googleapis` or `lib/sheets`.
- Props typed as `any` or `Record<string, any>` from the Sheets payload.
- Comments like "// header is at row[3], the date column".

**Phase to address:**
**Phase 1 — Architecture & layering** before any feature. The first PR that adds a tab must conform.

---

### 🟡 Pitfall 12: No deploy preview workflow → first time stakeholders see a feature is in production

**What goes wrong:**
A new tab is built, merged, deployed. The CEO opens prod and finds a layout bug, a wrong label, or a number off by 10. The fix takes a day; meanwhile prod is broken and the team has lost a credibility round.

**Why it happens:**
- Vercel preview URLs are auto-generated but the team doesn't share them.
- No staging stakeholder review step before merge.
- "I'll just push to main, it's faster."

**How to avoid:**
- **Branch + Vercel preview workflow:** every feature lives on a branch, Vercel auto-builds a preview URL (`feat-bonos-tab-tikindash.vercel.app`).
- **Required stakeholder approval** for visible changes: PR template includes "Preview URL: ..." and a checkbox "CEO/Comercial reviewed the preview".
- **Preview env uses a separate Sheet** (or a read-only copy) so testing doesn't pollute prod data and prod's 60/min budget isn't burned by QA.
- A `?demo=true` query param in preview activates fake data so stakeholders can review without needing real Sheets access.

**Warning signs:**
- Most commits go directly to `main`.
- The team has no shared Vercel preview links.
- Bugs are discovered "after the fact" by stakeholders.

**Phase to address:**
**Phase 0 — Project setup** establishes the branch + preview flow before any feature work.

---

### 🟡 Pitfall 13: Empty cells, formula errors, and blank rows mid-sheet

**What goes wrong:**
- Sheets API omits trailing empty rows ([docs](https://developers.google.com/workspace/sheets/api/guides/values)) but **not** empty rows in the middle. A blank row mid-data parses as `[]` or `[undefined, undefined, ...]`.
- A formula returns `#REF!`, `#N/A`, or `#DIV/0!` — these come through the API as the literal strings `"#REF!"`. `parseFloat("#REF!")` is `NaN`. `NaN` summed with anything is `NaN`. The total displays as `NaN` or as `$NaN` (depending on formatter).
- A cell with a single space `" "` parses as a non-empty string but fails number coercion silently.

**Why it happens:**
- Sheets is freeform; ops adds blank separator rows for visual clarity.
- Formulas break when ops moves rows or deletes referenced cells.
- The adapter doesn't distinguish "empty" from "error" from "valid zero".

**How to avoid:**
- **Filter empty rows** in the adapter: a row is empty if all required fields are blank/undefined. Skip them with a counter logged.
- **Detect formula errors:** before parsing, check `if (typeof v === 'string' && v.startsWith('#'))` → throw a descriptive error or skip with a structured warning.
- **Strict Zod parsing** (Pitfall 3) catches `NaN` automatically: `z.coerce.number().finite()` rejects `NaN` and `Infinity`.
- Surface skipped rows in the audit footer (Pitfall 6).

**Warning signs:**
- KPI displays `$NaN` or `Infinity`.
- Row counts off by a few from the Sheet.
- Aggregations silently incorrect when Sheets has merged cells or summary rows.

**Phase to address:**
**Phase 2 — Sheets adapter** must handle these from the first call.

---

### 🟡 Pitfall 14: Mobile / projector resolution breaking layout during a live demo

**What goes wrong:**
The dashboard is built and tested at 1440×900 (the dev's MacBook). Projected to 1920×1080 it shows extra whitespace. On a 4K conference TV cards look tiny. On a 1024×768 projector content overflows or wraps weirdly. The comercial discovers this during the call.

**Why it happens:**
- "Desktop only" decisions in PROJECT.md were taken to mean "one resolution".
- Cards use fixed widths; charts have hardcoded heights.
- No QA across viewport sizes before a demo.

**How to avoid:**
- **Responsive grid** (Tailwind `grid-cols-{n}` with breakpoints) even for desktop-only — accommodates 1024 → 4K.
- **Container queries** (Tailwind 3.4+) so cards adapt to their parent, not just the viewport.
- **Fixed aspect ratios** for charts (`aspect-video`, `aspect-[4/3]`) so they scale.
- A **"Presentation Mode"** (see Pitfall 2) optimizes typography (larger numbers, bolder labels) for projection.
- Pre-flight checklist: test on 1024×768, 1920×1080, 4K before any external demo.

**Warning signs:**
- Hardcoded `width: 800px` styles.
- Chart components without responsive props.
- The team hasn't seen the dashboard on anything but their own laptops.

**Phase to address:**
**Phase 3 — Presentation polish** validates across resolutions before the first external demo.

---

### 🟡 Pitfall 15: Service account credential rotation has no documented path

**What goes wrong:**
A dev leaves the team. The service account JSON they had is technically still active. Or: the credentials are accidentally exposed (Vercel incident, repo leak). Rotation is needed urgently — but the path is undocumented and takes hours of fumbling under pressure.

**Why it happens:**
- Setup happens once; no one writes down how to redo it.
- GCP IAM is dense; the right scopes/permissions aren't memorized.
- Rotation requires both a GCP key change and a Vercel env var update — two steps that can desync.

**How to avoid:**
- `docs/RUNBOOK.md` with a **"Rotate Sheets service account"** section: 5-step list, copy-pasteable.
- Two service accounts at all times (active + standby), so rotation is "switch which env var is active" not "create new credentials under pressure".
- Quarterly rotation calendar reminder.
- The Vercel env vars are marked Sensitive (Pitfall 1); changing them forces a redeploy automatically.

**Warning signs:**
- Nobody on the team can answer "how do we rotate the Sheets credentials?" in 30 seconds.
- Only one service account exists for the project.
- No runbook file in the repo.

**Phase to address:**
**Phase 1 — Operations setup** alongside auth.

---

## Nice-to-Avoid Pitfalls

### 🟢 Pitfall 16: Building all 5 tabs at once with shallow features instead of one tab end-to-end

**What goes wrong:**
The team wires up basic data fetches for all 5 tabs in week 1. Each tab has placeholder cards. Nothing is presentable. Three weeks in, every tab is 40% done; nothing is shippable; the first demo is delayed.

**Why it happens:**
- "Let's get the structure up first" feels productive.
- 5 tabs in PROJECT.md feels like 5 things to start.
- The iterative philosophy in PROJECT.md (`Filosofía de construcción: iterativa`) says one tab at a time, but the visual layout invites parallel work.

**How to avoid:**
- **One tab end-to-end** before starting the next. "End-to-end" means: Sheets → adapter → domain → metrics → presentable component → reviewed by stakeholder → deployed.
- **Inicio is last, not first.** It's the overview; build it after at least 2 tabs exist so you know what to surface.
- **Ship Bonos first** — it's the revenue-driving tab per PROJECT.md (`revenue principal vía % de comisión`); it has the highest demo value.
- Definition of Done per tab includes "shown to a stakeholder on a preview URL".

**Warning signs:**
- 3 tabs exist; none is fully polished.
- The team's branch list shows 4 in-progress tab branches.
- No tab has been demoed externally yet.

**Phase to address:**
**Roadmap structure** — phase ordering must enforce one-tab-at-a-time.

---

### 🟢 Pitfall 17: No domain types — adapters return `any`, codebase rots

(Covered as part of Pitfall 3 and Pitfall 11; surfacing here for completeness.)

**Phase to address:** Phase 1.

---

### 🟢 Pitfall 18: Using fancy charts library before knowing what to chart

**What goes wrong:**
The team installs Recharts, Tremor, and ApexCharts in week 1 before anyone has decided what KPIs matter. Bundle size balloons; chart components are over-engineered for not-yet-defined needs.

**Why it happens:**
- Chart libraries are exciting.
- "We'll need a chart eventually" justifies premature install.

**How to avoke:**
- Number-card UI first. Charts when the team has a specific question a chart answers better than a number.
- One library, chosen after the first 2 KPIs are validated. [Tremor](https://www.tremor.so) is the lowest-friction for B2B dashboards on Next.js; pick it only when needed.

**Phase to address:**
**Phase 3+** — defer until KPIs are validated.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Read Sheets directly from page components (no adapter layer) | Ship one tab in a day | Migration off Sheets becomes a full rewrite; testing impossible | Never — adapter layer is mandatory from PR #1 |
| Plain-text password in env | "It works", 5 min faster | Trivially brute-forceable; one leak = reputational damage; can't be timing-safe-compared | Never — hash + rate-limit are non-optional for client-facing |
| `any[]` returned from Sheets adapter | Move past TS errors quickly | Schema drift becomes silent wrong-numbers; every consumer needs defensive code | Never — Zod from day one |
| Skip `loading.tsx` / `error.tsx` | Layout simpler | Blank/red screens during live demos | Never for client-facing routes |
| One service account for dev + prod | One env to set up | Dev testing burns prod's 60 reads/min; one credential leak compromises both | Solo prototype only, before first preview deploy |
| Hardcoded column indexes (`row[3]`) | Fast first integration | Sheets re-order = silent data corruption | Never — header-name mapping required |
| Aggregations without status filter (`reduce` over all rows) | KPI ships in 1 line | Reversals double-count, refunds inflate revenue, board sees wrong number | Never for financial metrics |
| Filter as component-level state, not URL param | "Just works" with `useState` | Presentation Mode impossible; URL un-shareable; inconsistent across tabs | Internal-only views with a single user; never for client-projection |
| No timezone library, just `new Date()` | One less dep | Daily totals wrong by ~5h of transactions per night | Never — Bogota TZ is mandatory |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| **Google Sheets API auth** | Committing `credentials.json` or pasting `private_key` without `\n` handling | Two env vars (`_EMAIL`, `_PRIVATE_KEY`), marked Sensitive in Vercel, replace `\\n` → `\n` at runtime |
| **Sheets read** | Calling `values.get` per tab, ignoring rate limits | One fetch per Sheet per request, deduped via `cache()`, short-window `revalidate: 30` |
| **Sheets numbers** | Using `FORMATTED_VALUE` and parsing localized strings | `valueRenderOption=UNFORMATTED_VALUE` always; format only at render |
| **Sheets dates** | Treating cell text as a date | `UNFORMATTED_VALUE` returns serial numbers; parse via known epoch (1899-12-30) or use the `dateTimeRenderOption` `FORMATTED_STRING` and parse ISO |
| **Sheets empty rows** | Assuming `values` is dense | Filter rows where required fields are missing; trailing rows are auto-omitted, mid-sheet ones are not |
| **Sheets formula errors** | Treating `#REF!`/`#N/A` as data | Detect string starting with `#`, throw or warn structurally |
| **Vercel env vars** | Not marking secrets as Sensitive | Mark all credentials Sensitive; review the [April 2026 incident](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) lessons |
| **Vercel regions** | Default region (often `iad1`) but no explicit setting | Set `regions: ["iad1"]` in `vercel.json`; Google APIs respond fastest from US-East |
| **Vercel Fluid Compute** | Assuming it's on for older projects | Verify in project settings; enable explicitly to get sub-100ms cold starts |
| **Next.js fetch dedup** | Using `googleapis` SDK (not `fetch`) and assuming dedup | SDK calls aren't auto-deduped; wrap in `React.cache()` manually |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-tab independent Sheets fetch | Slow tab navigation; 429 spikes | Single shared snapshot per request; `cache()` + `revalidate: 30` | At 5 tabs × 5 users × 1 refresh/min = 125 reads/min, exceeds the 60/user/min limit |
| Cold-start blocks first paint | 2-4s blank screen on first hit | `loading.tsx` + Suspense streaming; pre-warm before demos; Fluid Compute on | Always — every cold start is a demo risk |
| All-data-on-Inicio aggregation | Page LCP > 4s | Stream cards individually; compute aggregates server-side and cache; lazy-load deep tables | When transactions table grows past ~5k rows |
| No `revalidate` window | Every page load = full Sheets read | `next: { revalidate: 30 }` | Always — "live" within 30s is functionally live |
| Wrong Vercel region | +200-500ms RTT to Google APIs | Explicit `regions: ["iad1"]` | Always when deployed elsewhere |
| Synchronous chart renders blocking page | Heavy chart blocks tab switch | Code-split chart libs with `next/dynamic` and `ssr: false` for client-only charts | When charts are added; before that, n/a |

**Project scale reality check:** Tikin's expected usage is small (handful of internal users + occasional client demos). The **rate-limit risk is real but bounded**; the **cold-start risk is real and immediate** because it hits during demos. Optimize for the demo path first.

---

## Security Mistakes

(Beyond OWASP basics — domain-specific.)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Plain-text shared password in env | Trivially brute-forceable | Hash (bcrypt/scrypt) + `crypto.timingSafeEqual` + always-hash on miss |
| No login rate limit | Brute force in seconds | `@upstash/ratelimit` sliding window, 5/15min per IP, in Edge Middleware |
| Cookie missing HttpOnly/Secure/SameSite | XSS or session leak | `HttpOnly; Secure; SameSite=Lax; Path=/` always |
| Service account JSON in repo | Permanent credential leak | `.gitignore` patterns, `gitleaks` pre-commit hook, env vars only |
| Service account in client bundle | Credentials shipped to every visitor | `server-only` import + ESLint rule blocking client-component imports |
| Service account with broad GCP scope | Compromise = wider blast radius | Scope to only the two Sheets, Viewer permission only |
| Password rotated in chat without app rotation | Old password keeps working | Rotation = env var change + redeploy; document in RUNBOOK |
| Filter-leak: client A sees client B's data | Reputational + possible legal | Filter at data layer with stable IDs; Presentation Mode banner; runtime invariant |
| `?password=...` in URL | Logged in Vercel logs, browser history, referers | POST only; reject GET to login route |
| Forgetting screen-share leak | Ex-employee with password retains access; demo audience sees notifications | Rotate quarterly + after departures; "Demo mode" hides irrelevant UI |
| Vercel env vars not marked Sensitive | Readable post-creation; vulnerable to OAuth-app compromise like [April 2026 incident](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) | Mark every credential Sensitive |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Blank screen during cold start in front of a client | "This dashboard feels broken" — credibility hit | `loading.tsx` skeleton + pre-warm before demos |
| Stack-trace error page on Sheets failure | "These guys can't even handle errors" | `error.tsx` with friendly retry + cached fallback |
| KPI numbers don't agree between tabs | Client asks "which is right?" — no good answer | Single snapshot per page load + visible timestamp |
| Numbers without currency or with mixed locales | Confusion / misinterpretation | One formatter module, currency always shown for financial values |
| Filter takes a moment to apply, briefly shows other clients' data | Filter leak risk | Filter in URL/server; render only matched rows; loading indicator during filter change |
| Long table with no totals row | User does mental math, gets it wrong | Footer row with sums; matches the KPI card above |
| No "last refreshed at" indicator | User doesn't know if data is current | Header timestamp on every page, in Bogotá time |
| Rapid auto-refresh updates numbers mid-presentation | Glitchy mid-share | `revalidate: 30` is OK; but no client-side polling during Presentation Mode |
| Demo'd on dev's laptop only | Layout breaks on projector / 4K screen | Pre-flight checklist across resolutions |

---

## "Looks Done But Isn't" Checklist

- [ ] **Sheets adapter:** Often missing **Zod validation on every fetch** — verify schema mismatch produces a clear error, not silent `undefined`s.
- [ ] **Sheets adapter:** Often missing **`UNFORMATTED_VALUE` setting** — verify numbers are numbers, not localized strings.
- [ ] **Login route:** Often missing **rate limit and timing-safe compare** — verify with a script that hammers it 100 times.
- [ ] **Session cookie:** Often missing **all three flags** (`HttpOnly`, `Secure`, `SameSite`) — verify in browser DevTools.
- [ ] **Loading state:** Often missing **per-route `loading.tsx`** — verify hard-refreshing each route shows a skeleton, not blank.
- [ ] **Error state:** Often missing **friendly fallback** — verify with `throw new Error()` in a server component.
- [ ] **Cache fallback:** Often missing **last-known-good snapshot** — verify by killing Sheets API access (revoke service account temporarily) and confirming dashboard still renders cached data.
- [ ] **Filter:** Often missing **all-tabs propagation** — verify filter applies on every tab including Inicio's KPIs.
- [ ] **Currency formatting:** Often missing **single source of truth** — grep for `toLocaleString` and `Intl.NumberFormat`; should appear once, in `lib/format/`.
- [ ] **Timezone:** Often missing **TZ-aware "today"** — verify "today's totals" at 23:00 Bogotá time vs 02:00 next day Bogotá: should differ by exactly Bogotá's midnight, not UTC's.
- [ ] **Reversals:** Often missing **status-aware aggregation** — verify a payout with `status=reversed` is excluded from outflow totals.
- [ ] **Schema drift:** Often missing **boot-time check** — verify renaming a column in a test Sheet causes a clear startup error, not silent breakage.
- [ ] **Resolution test:** Often missing **demo-resolution QA** — verify on 1024×768, 1920×1080, and 4K before external demo.
- [ ] **Service account scope:** Often **too broad** — verify the service account can read only the two specific Sheets, not all Drive content.
- [ ] **Preview URL flow:** Often **not used** — verify last 3 PRs were stakeholder-reviewed on a preview URL before merge.
- [ ] **Server-only enforcement:** Often missing — verify `import 'server-only'` in `lib/sheets/` and that a client component importing it fails the build.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service account JSON committed | HIGH | 1) Rotate the key in GCP immediately. 2) Update Vercel env vars. 3) Redeploy. 4) `git filter-repo` history (or accept history is burned). 5) Audit Sheet access logs for the leak window. |
| Filter leak shown to client | HIGH (reputational) | 1) Stop screen-share. 2) Apologize honestly. 3) Audit affected calls. 4) Implement Presentation Mode + tests. 5) Disclose to leadership; possibly to affected clients. |
| Schema drift broke production | MEDIUM | 1) Read the new schema. 2) Update Zod schemas. 3) Add regression test. 4) Coordinate with ops on a "no rename without notice" agreement. 5) Deploy. |
| Cold start blank during demo | MEDIUM | Acknowledge live, pivot to a static slide, follow up with cached-fallback fix the same day. |
| Wrong total shown to leadership | HIGH (trust) | 1) Identify root cause (schema? aggregation? data entry?). 2) Fix and add validation/tripwire. 3) Re-publish corrected number with explanation. 4) Document in PITFALLS so it can't recur. |
| 429 rate-limited mid-meeting | LOW (technically) | Backoff retries handle it; if persistent, fall back to last cache. Add per-user service account if it recurs. |
| Timezone bug in daily totals | MEDIUM | Switch to TZ-aware date math; backfill historical reports if any were published wrong. |
| Password leaked (post-employee, screen capture) | MEDIUM | Rotate password env var + redeploy (single change); communicate new password through secure channel. |
| Currency mis-formatted on screen during demo | LOW | Centralize formatter immediately; comms control during call. |

---

## Pitfall-to-Phase Mapping

This is the action map for the roadmap.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Service account leaks | **Phase 1 — Auth & Secrets** | `gitleaks` passes; ESLint blocks `googleapis` in `components/`; Vercel env vars marked Sensitive |
| 2. Client filter leak | **Phase 2 — Data model** + **Phase 4 — Presentation Mode** | Filter is URL param; Presentation Mode banner exists; unit test for cross-client isolation |
| 3. Schema brittleness | **Phase 2 — Sheets adapter** | Zod schemas exist; renaming a column in a test Sheet produces a clear error |
| 4. Plain-text password / no rate limit | **Phase 1 — Auth foundation** | `bcrypt.compare` + timing-safe + `@upstash/ratelimit`; cookie has 3 flags |
| 5. Slow / blank / errored screen | **Phase 1 (loading/error files)** + **Phase 3 (cache fallback)** | Every route has `loading.tsx` + `error.tsx`; cached fallback verified by killing Sheets access |
| 6. Wrong totals from unvalidated data | **Phase 2 — Domain & metrics** | Status enum exists; reversals net out; sanity tripwires render in Inicio |
| 7. Sheets API rate limit | **Phase 2 — Adapter** | Single fetch per request via `cache()`; `revalidate: 30`; backoff on 429 |
| 8. Tab numbers disagree | **Phase 2 — Snapshot model** | One snapshot per page load; visible timestamp |
| 9. Currency / locale mess | **Phase 2 — Domain types** | `Money` type with currency; central `formatCOP`; grep finds one usage point |
| 10. Timezone bug | **Phase 2 — Domain types** | `date-fns-tz` + `America/Bogota` constant; "today" tested at TZ boundaries |
| 11. Sheets concerns leak into UI | **Phase 1 — Architecture** | Lint rule blocks `googleapis` in `components/` |
| 12. No preview workflow | **Phase 0 — Setup** | Branch protection + Vercel preview required for merge |
| 13. Empty cells / formula errors | **Phase 2 — Adapter** | Adapter handles `#REF!`, blank rows, and trailing/mid empties; audit footer shows skipped rows |
| 14. Resolution breakage on demo | **Phase 3 — Polish** | Pre-flight checklist verified across 3 resolutions |
| 15. Credential rotation undocumented | **Phase 1 — Ops setup** | `docs/RUNBOOK.md` exists with a 5-step rotation procedure |
| 16. All-tabs-shallow build | **Roadmap structure (Phase 3 onwards)** | Each phase ships ONE tab end-to-end before the next starts |
| 17. `any` types | **Phase 1 — Architecture** | TS strict mode; no `any` in `lib/**` |
| 18. Premature charts | **Phase 3+** | No chart lib until at least 2 KPIs are stakeholder-validated |

---

## Sources

**Primary (HIGH confidence):**
- [Google Sheets API — Usage limits (official)](https://developers.google.com/workspace/sheets/api/limits) — verified 300 reads/min/project, 60 reads/min/user, exponential backoff formula
- [Google Sheets API — Read & write cell values (official)](https://developers.google.com/workspace/sheets/api/guides/values) — `valueRenderOption`, empty row behavior
- [Next.js — File-system conventions: loading.js (official)](https://nextjs.org/docs/app/api-reference/file-conventions/loading) — loading state semantics
- [Next.js — Error Handling (official)](https://nextjs.org/docs/app/getting-started/error-handling) — error boundary patterns
- [Next.js — fetch (official)](https://nextjs.org/docs/app/api-reference/functions/fetch) — automatic dedup, revalidate
- [Vercel — Fluid Compute (official)](https://vercel.com/docs/fluid-compute) — cold-start mitigation
- [Vercel — Cold-start guidance (official KB)](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel) — serverless performance
- [Vercel — Sensitive environment variables (official)](https://vercel.com/docs/environment-variables/sensitive-environment-variables) — secret handling
- [Vercel — April 2026 security incident bulletin](https://vercel.com/kb/bulletin/vercel-april-2026-security-incident) — env var exfiltration via OAuth compromise

**Secondary (HIGH confidence, library docs):**
- [Zod docs](https://zod.dev) — schema validation patterns
- [Upstash Ratelimit (Vercel template)](https://vercel.com/templates/next.js/ratelimit-with-upstash-redis) — sliding-window rate limit
- [`@upstash/ratelimit` GitHub](https://github.com/upstash/ratelimit-js) — Edge Middleware integration
- [`date-fns-tz`](https://www.npmjs.com/package/date-fns-tz) — TZ-aware date handling

**Tertiary (MEDIUM confidence, community):**
- [Hardening Next.js 15 Login: Sessions, CSRF, and Timing Attacks (Dev Journal, 2026-04)](https://earezki.com/ai-news/2026-04-18-how-to-build-a-login-flow-in-nextjs-15-sessions-cookies-csrf-and-the-timing-attack-nobody-talks-about/) — timing-safe compare patterns
- [How Fintech Data Leaks Actually Happen (Medium, 2026-04)](https://medium.com/@roman_fedyskyi/how-fintech-data-leaks-actually-happen-bde34325adbe) — multi-tenant filter leak patterns
- [Fintech 101: How Transactions Really Work (DEV)](https://dev.to/hexstories/fintech-101-how-transactions-really-work-lj4) — reversal / idempotency patterns
- [How to securely use Google API service account credentials (DEV)](https://dev.to/wilsonparson/how-to-securely-use-google-apis-service-account-credentials-in-a-public-repo-4k65) — credential handling
- [Google Sheets API authentication on Vercel (vercel/next.js discussion #38430)](https://github.com/vercel/next.js/discussions/38430) — env var format gotchas
- [Vercel cold-start delay discussion #7961](https://github.com/vercel/vercel/discussions/7961) — real-world cold-start figures

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Sheets API limits & behavior | HIGH | Official docs, current 2026 |
| Vercel cold-start mitigation | HIGH | Official Fluid Compute docs |
| Next.js loading/error patterns | HIGH | Official Next.js docs |
| Auth / cookie security | HIGH | Cross-verified with multiple 2026 sources |
| Service-account secret handling | HIGH | Official Vercel + GCP guidance, plus 2026 incident lessons |
| Schema validation approach | HIGH | Zod is the de facto standard |
| Fintech reversal / double-counting patterns | MEDIUM | Community sources; specific to Tikin's data model — needs domain confirmation with the Tikin team |
| Timezone handling | HIGH | Standard pattern, well-documented |
| Filter-leak scenarios | MEDIUM | Pattern is real; specific implementation needs to be tested against Tikin's Sheets schema (e.g., do clients have stable IDs today?) |
| Resolution / demo testing | MEDIUM | Generic UX hygiene — confidence high, but specifics depend on Tikin's actual demo environments |

---

## Open Questions for Domain Confirmation

These need answers from the Tikin team before some preventions can be made concrete:

1. **Do Sheets rows have stable client IDs today, or only display names?** (Drives Pitfall 2 implementation.)
2. **How are reversals/refunds recorded in Sheets today?** (Drives Pitfall 6 status enum and aggregation logic.)
3. **What currencies appear in the data?** (Likely COP only, but USD payouts to USD bank accounts may exist.)
4. **What's the tolerance for staleness?** ("Live" is in PROJECT.md, but is 30-second cache acceptable? Almost certainly yes for B2B; worth confirming.)
5. **Which Sheets API access pattern is allowed?** (Same service account for dev/prod, or separate?)
6. **Are demos always projected from the same operator's machine, or is BYOL?** (Drives the resolution-test scope.)

---

*Pitfalls research for: Tikin Dashboard (Next.js + Google Sheets API + Vercel + shared password)*
*Researched: 2026-04-27*
