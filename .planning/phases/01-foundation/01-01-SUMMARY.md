---
phase: 01-foundation
plan: 01
subsystem: auth
tags: [next, react, jose, jwt, bcrypt, upstash, ratelimit, shadcn, tailwind, proxy, server-actions]

# Dependency graph
requires:
  - phase: 00-research
    provides: STACK.md decision (Next 16 + Server Actions + jose + bcryptjs + Upstash), PITFALLS.md (1 = creds; 4 = plain-text password / no rate limit)
provides:
  - Next.js 16.2.4 + React 19.2.4 project skeleton with App Router, TypeScript, Tailwind v4, ESLint, src-dir layout
  - shadcn UI primitives (button, card, input, label, skeleton, separator, sonner, switch) wired with base-nova style
  - JWT session encrypt/decrypt (jose, HS256, 30-day expiry) gated by 'server-only'
  - DAL re-verify helper (verifySession) wrapped in React.cache for Server Component second-line defense
  - Login Server Action: rate-limit → Zod → timing-safe bcrypt → JWT cookie → redirect
  - Logout Route Handler (GET and POST) that clears the session cookie
  - Auth gate proxy at src/proxy.ts (Next 16 file convention) protecting all routes except /login and assets
  - .env.example documenting the 8 phase-1 env vars (auth + Sheets contracts)
  - .env.local seeded with SESSION_SECRET and PLACEHOLDER bcrypt password hash
  - .gitignore hardened against credential JSON file leaks (Pitfall 1)
affects: [02-bonos, 03-payouts, 04-inicio-recargas, 05-clientes-domain]

# Tech tracking
tech-stack:
  added:
    - next@16.2.4
    - react@19.2.4 / react-dom@19.2.4
    - typescript@5
    - tailwindcss@4 (+ @tailwindcss/postcss)
    - jose@6.2.3
    - bcryptjs@3.0.3 (+ @types/bcryptjs)
    - "@upstash/ratelimit@2.0.8"
    - "@upstash/redis@1.37.0"
    - zod@4.3.6
    - server-only@0.0.1 (transitive of next, made explicit so it resolves at runtime)
    - shadcn registry (8 primitives, base-nova style, neutral base color)
  patterns:
    - "'server-only' guard on every module under src/lib/auth/ to prevent client bundling"
    - "Stateless JWT in HttpOnly+SameSite=Lax cookie; payload carries only { authed: true } — no PII, no password"
    - "Two-layer auth: optimistic proxy gate (src/proxy.ts) + DAL verifySession() in Server Components (per Next.js docs)"
    - "Timing-safe login: bcrypt.compare ALWAYS runs (against DUMMY_HASH if env var missing) so wrong-env-var and wrong-password are indistinguishable by latency"
    - "Rate limit BEFORE bcrypt to deny brute-force amplification through compare cycles"
    - "Fail-open rate limiter with one-time console.warn when Upstash creds are absent — acceptable in local dev, MUST be set in production"

key-files:
  created:
    - package.json
    - tsconfig.json
    - next.config.ts
    - eslint.config.mjs
    - postcss.config.mjs
    - components.json
    - .gitignore
    - .env.example
    - .env.local (gitignored)
    - src/app/layout.tsx (Inter font, lang="es-CO", Toaster)
    - src/app/page.tsx (redirect to /inicio)
    - src/app/login/page.tsx
    - src/app/login/login-form.tsx
    - src/app/login/actions.ts
    - src/app/logout/route.ts
    - src/lib/auth/session.ts
    - src/lib/auth/dal.ts
    - src/lib/auth/rate-limit.ts
    - src/lib/utils.ts (shadcn cn helper)
    - src/components/ui/{button,card,input,label,separator,skeleton,sonner,switch}.tsx
    - src/proxy.ts
  modified: []

key-decisions:
  - "SESSION_DURATION_SECONDS = 60*60*24*30 (30 days). Long enough that team members rarely re-login, short enough that a stolen cookie has finite blast radius."
  - "bcrypt cost factor 10 (~70ms hash). Industry default; balances brute-force resistance against Server Action latency."
  - "JWT alg HS256 with shared SESSION_SECRET (32-byte base64). Single-tenant dashboard — no asymmetric requirement, simpler key management."
  - "Cookie sameSite='lax' (not 'strict'). Allows the dashboard to be opened from email/Slack links pointing to specific routes; CSRF risk for the login form is mitigated by Server Actions' built-in origin check."
  - "Rate limit window: sliding 5 attempts / 5 min / IP, prefix 'tikin-login'. Aligned with AUTH-03 spec."
  - "src/proxy.ts (NOT root proxy.ts) — Next 16 looks for the proxy file at the same level as app/, which is src/ when --src-dir is used. Plan text was wrong; runtime confirmed via fresh dev compile log."
  - "Logout excluded from proxy matcher — the route clears the cookie itself; bouncing it through the proxy would create a useless extra hop or, worse, redirect chain edge cases."
  - "Empty Upstash env vars in .env.local intentionally — fail-open with console.warn. Plan 04 makes them mandatory in Vercel."

patterns-established:
  - "src/lib/auth/* is the single source of truth for session and rate-limit. Other code imports from there, never duplicates JWT or rate-limit logic."
  - "Server Actions return a typed { error?: string } discriminated union and consume formData via Zod. Pattern reused by future actions."
  - "Proxy is an OPTIMISTIC gate, not the authorization boundary. Every page or action that exposes data MUST also call verifySession() from the DAL."
  - "Constants exported from session.ts (SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS, getSessionCookieOptions). Never hand-roll cookie attributes elsewhere."

# Metrics
duration: 11m 24s
completed: 2026-04-27
---

# Phase 1 Plan 1: Foundation — Bootstrap and Auth Gate Summary

**Next.js 16.2.4 project bootstrapped with shadcn primitives plus full auth flow: jose JWT cookie, bcrypt password compare, Upstash sliding-window rate limit, and an optimistic src/proxy.ts gate redirecting all unauthenticated traffic to /login.**

## Performance

- **Duration:** 11m 24s
- **Started:** 2026-04-27T17:18:41Z
- **Completed:** 2026-04-27T17:30:05Z
- **Tasks:** 3
- **Files created:** 25 source files + lockfile + 5 public SVGs
- **Files modified:** 1 (layout.tsx — twice, once for our content and once cleaned up after shadcn injected Geist alongside Inter)

## Accomplishments

- Empty repo (only `.planning/`, `.git/`, `.claude/`) bootstrapped into a fully working Next 16.2 + React 19.2 app without disturbing existing planning artifacts.
- 8 shadcn primitives installed and the components.json wired up to the base-nova style + neutral base color.
- Auth flow proven end-to-end with curl: unauthenticated GET on `/`, `/inicio`, and any other route returns `307 Location: /login`; `/login` renders 200; `/logout` clears the cookie and redirects.
- All four PITFALLS-1/4 surface areas closed: credential JSON glob in `.gitignore`, password stored only as bcrypt hash, login rate-limited (with prod-mandatory Upstash), session is HttpOnly+SameSite=Lax JWT.

## Task Commits

Each task was committed atomically:

1. **Task 1: Bootstrap Next.js 16.2 + shadcn primitives + .env scaffolding** — `c444689` (chore)
2. **Task 2: Auth foundation — session.ts, dal.ts, rate-limit.ts** — `519afa9` (feat)
3. **Task 3: Login page + Server Action + proxy.ts gate + logout route** — `bce06e3` (feat)

Plan metadata commit will be added next, capturing this SUMMARY and STATE update.

## Files Created/Modified

### Project bootstrap
- `package.json` — name `tikin-dashboard`, scripts `dev/build/start/lint`, full dep set.
- `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs` — standard Next 16 scaffolding.
- `components.json` — shadcn config (style: base-nova, baseColor: neutral, RSC: true, src/-aware aliases).
- `.gitignore` — adds `*credentials*.json`, `*service-account*.json`, `gcp-*.json` patterns plus `.env.local` block (Pitfall 1).
- `.env.example` — documents all 8 phase-1 env vars including Sheets keys used in Plan 02.
- `.env.local` — seeded with SESSION_SECRET (`openssl rand -base64 32`) and PLACEHOLDER `DASHBOARD_PASSWORD_HASH` for plain text `tikin-dev-2026`.

### Auth library (`src/lib/auth/`)
- `session.ts` — `encrypt`, `decrypt`, `SESSION_COOKIE_NAME`, `SESSION_DURATION_SECONDS`, `getSessionCookieOptions`. Throws on missing/short SESSION_SECRET. JWT HS256, 30-day expiry.
- `dal.ts` — `verifySession()` wrapped in `cache()` from React. Reads cookie, decrypts, redirects to `/login` if invalid.
- `rate-limit.ts` — `loginLimiter` instance. When Upstash env vars are present, uses `Ratelimit.slidingWindow(5, '5 m')` keyed by `tikin-login`. When absent, returns a no-op limiter that always succeeds and `console.warn`s once.

### Login flow
- `src/app/login/page.tsx` — Server Component, centered Card, bounces already-authenticated users to `/`.
- `src/app/login/login-form.tsx` — Client Component using `useActionState`, password Input with `autoComplete="current-password"`, error display via `aria-describedby`.
- `src/app/login/actions.ts` — Server Action `loginAction(prev, formData)`. Pipeline: read x-forwarded-for IP → `loginLimiter.limit(ip)` → Zod parse → `bcrypt.compare` against `DASHBOARD_PASSWORD_HASH ?? DUMMY_HASH` → on success `encrypt({ authed: true })` → cookie set → `redirect('/')`. On any failure, returns `{ error: string }`.
- `src/app/logout/route.ts` — GET and POST handlers that delete the cookie and redirect.

### Proxy
- `src/proxy.ts` — default export proxy with `PUBLIC_PATHS = ['/login']`. Matcher excludes `_next/static`, `_next/image`, `favicon.ico`, `logout`. Imports `decrypt` and `SESSION_COOKIE_NAME` from `@/lib/auth/session`.

### Layout and shadcn
- `src/app/layout.tsx` — `lang="es-CO"`, Inter font (`--font-sans`), `<Toaster />` (sonner) in body, `cn()` helper for classes.
- `src/app/page.tsx` — `redirect('/inicio')` (which the proxy intercepts before resolution to /login when unauthenticated; once Plan 03 lands /inicio, it serves there).
- `src/components/ui/*` — 8 shadcn primitives. `src/lib/utils.ts` — `cn()`.

## Decisions Made

See frontmatter `key-decisions` for the full list with rationale. Highlights:

- **30-day session.** Team uses dashboard daily but has no IT to reset broken sessions; long expiry beats lockout pain.
- **Cookie SameSite=lax** because the dashboard will be linked from Slack/email; Server Actions enforce origin check separately so login is still CSRF-safe.
- **Timing-safe bcrypt** — even when DASHBOARD_PASSWORD_HASH is unset, we still hash against a dummy. Closes a side-channel that would otherwise reveal the deployment's auth-misconfiguration to anonymous traffic.
- **Rate limit before bcrypt** — prevents the cost-amplification brute-force where attackers force the server to spend ~70ms per attempt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] proxy.ts must be in `src/`, not at project root, when `--src-dir` is used**
- **Found during:** Task 3 (proxy gate verification).
- **Issue:** Plan stated `proxy.ts en raíz del proyecto (NO en src/)`. With the file at `/proxy.ts`, the dev server reported no "proxy.ts compiled" log, the `middleware-manifest.json` was empty (`{ "middleware": {}, "sortedMiddleware": [] }`), and `GET /inicio` returned a raw 404 instead of redirecting through the gate. Build output also lacked the `ƒ Proxy (Middleware)` row.
- **Root cause:** Per Next 16 docs (`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` line 35) the proxy file is detected at the same level as the `app` directory — that is `src/` when `--src-dir` is set, not the project root. Confirmed in source: `next/dist/lib/constants.js` defines `PROXY_LOCATION_REGEXP = '(?:src/)?proxy'` and `next/dist/build/index.js` checks `isAtConventionLevel = normalizedFileDir === '/' || normalizedFileDir === '/src'`.
- **Fix:** Moved `proxy.ts` → `src/proxy.ts`. Cleared `.next/` and restarted dev. Log now shows `proxy.ts: 75ms`, build output shows `ƒ Proxy (Middleware)`, and curl-driven gate matrix passes.
- **Files modified:** moved one file, no content change.
- **Verification:** Six-case curl matrix in Task 3 commit message; all six pass.
- **Committed in:** `bce06e3` (Task 3 commit).

**2. [Rule 3 — Blocking] `server-only` package not hoisted by npm; explicit install required**
- **Found during:** Task 2 (auth lib creation).
- **Issue:** The `'server-only'` import is essential for preventing accidental client-bundling of `session.ts`, `dal.ts`, `rate-limit.ts`. Although `server-only@0.0.1` is listed as a transitive dep of `next`, npm 11 did not hoist it to top-level `node_modules/`, so a fresh runtime `require.resolve('server-only')` failed.
- **Why caught early:** While the unused-module tree-shake masked it during the initial Task-1 build, importing the modules from the login page in Task 3 would have failed at compile time.
- **Fix:** `npm install server-only` to add it as a direct dep.
- **Files modified:** `package.json`, `package-lock.json`.
- **Verification:** `node -e "require.resolve('server-only')"` succeeds; subsequent build and tsc pass.
- **Committed in:** `519afa9` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking). Both essential and reversible only by re-introducing real defects.
**Impact on plan:** No scope expansion. The plan's `must_haves.artifacts` entry for `proxy.ts` simply lives at `src/proxy.ts` instead of `/proxy.ts`. All other contracts hold.

## Issues Encountered

- **`create-next-app` rejects directory name `Dashboard_Tikin`** because npm's `name` validator forbids capitals. Worked around by running `create-next-app` in `/tmp/tikin-bootstrap`, copying generated files into the project root, and renaming `package.json#name` to `tikin-dashboard`. The `.planning/`, `.git/`, and `.claude/` directories were untouched — copy was selective (public/, src/, plus individual config files).
- **shadcn init touched `src/app/layout.tsx`** and injected a redundant Geist font import alongside our Inter setup. Cleaned up to a single Inter declaration after init completed. (Captured in the Task 1 commit.)
- **Server Action positive/negative password test via curl was infeasible.** Next 16 binds Server Action IDs to encrypted, render-time payloads (`$ACTION_REF_1`, `$ACTION_KEY` hidden inputs change per request). A curl POST that bypasses the React renderer returns 404 from the Action dispatcher. Documented as manual verification below; the underlying loginAction code is statically verified by tsc + build, and its dependencies (rate-limit, encrypt/decrypt, cookie set) are all curl-verifiable in isolation.

## Manual Verification Steps for Reviewer

These need a browser and the dev server (`npm run dev`):

1. `open http://localhost:3000/` → redirects to `/login`.
2. On `/login`, type `tikin-dev-2026`, submit. Expect: redirect to `/`, which redirects to `/inicio`. (`/inicio` itself returns 404 until Plan 03; the auth flow is what matters here. After cookie is set, the proxy lets the request through.)
3. DevTools → Application → Cookies → `localhost:3000` → confirm `session` row: `HttpOnly ✓`, `Secure ✗` (we're on http://localhost so secure is off in dev), `SameSite Lax`.
4. Click `<a href="/logout">` (or hit URL directly) → redirects to `/login`, cookie row gone.
5. Type a wrong password → form re-renders inline error "Password incorrecto." (no redirect, no cookie).
6. Spam the login form 6 times with wrong password from the same browser session — current local config has Upstash empty, so step 6 returns the same "incorrecto" error (rate limit fail-open with `[rate-limit] Upstash env vars missing` warning logged once on first request). In production with Upstash configured, attempt 6 would receive "Demasiados intentos. Intenta de nuevo en unos minutos."

## Next Phase Readiness

**Ready for Plan 02 (Sheets adapter):**
- Auth gate is in place, so any new route added in Plan 02+ is automatically protected.
- `verifySession()` available from `@/lib/auth/dal` for server-side data fetchers.
- `.env.example` already lists the four Sheets env vars Plan 02 will populate.

**Open items, BLOCKING for Plan 04 (production):**
- `DASHBOARD_PASSWORD_HASH` is the bcrypt of the PLACEHOLDER string `tikin-dev-2026`. The user MUST choose a real password and replace the hash before Vercel deployment.
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are intentionally empty in `.env.local`. They MUST be set in Vercel project settings before Plan 04. Without them, AUTH-03 (rate limiting) is non-functional in production.

**Soft note:** Plan 03 will create `/inicio`. Currently `src/app/page.tsx` `redirect('/inicio')` resolves to a 404 that the proxy converts to a `/login` redirect for unauthenticated users (the desired behavior). For authenticated users hitting `/` it still produces a 404 — acceptable as a transient state until `/inicio` ships.

---
*Phase: 01-foundation*
*Plan: 01*
*Completed: 2026-04-27*
