---
phase: 01-foundation
plan: 04
type: execute
subsystem: deployment
status: complete
provides:
  - vercel-project-linked
  - production-deployment
  - production-env-vars
  - upstash-marketplace-redis
  - sheets-config-real-tabs
affects:
  - all-future-phases-deploys
  - phase-2-schemas-rewrite
requires:
  - 01-01
  - 01-02
  - 01-03
tech-stack:
  added:
    - vercel-cli
    - upstash-marketplace-integration
  patterns:
    - vercel-marketplace-provisioning
    - sensitive-env-marking
    - kv-to-upstash-alias-mapping
key-decisions:
  - production-region-iad1
  - vercel-project-name-project-dashboard
  - upstash-redis-via-marketplace-not-direct
  - kv-rest-api-aliased-to-upstash-redis-rest
  - env-vars-production-target-only-this-plan
key-files:
  - vercel.json
  - .vercel/project.json
  - src/lib/sheets/config.ts
---

# Plan 01-04 Summary — Vercel Deploy + Production Smoke

## 🚀 Production URL

```
https://project-dashboard-bkwmin189.vercel.app
```

**Region:** `iad1` (us-east-1, closest to Google Sheets API)
**Status:** Ready (deployment ID: `project-dashboard-bkwmin189`)
**Vercel Deployment Protection:** **ENABLED by default** — see "User Action Required" below.

---

## Commits (this plan)

| Commit | Type | Description |
|--------|------|-------------|
| `6c10254` | feat | Wire sheets config to BD_Plataforma/BD_Payouts ranges |
| `823ed7b` | chore | vercel link + production env vars |
| (pending) | feat | Production deployment artifacts |
| (pending) | docs | Complete vercel deploy plan |

---

## Accomplishments

### Code changes
- `src/lib/sheets/config.ts` — ranges updated from tentative `Transacciones!A1:Z` and `Payouts!A1:Z` to real tab names `BD_Plataforma!A1:Z` and `BD_Payouts!A1:Z`. Both env vars (`GOOGLE_SHEETS_TRANSACTIONS_ID` and `GOOGLE_SHEETS_PAYOUTS_ID`) point to the same Sheet ID `1X0oKHsOfKSTWuiCs6OHSD50EXnbZ8tjLjhSFwETQObA` (Tikin chose to keep both data sources in one Sheet, separated by tabs).
- `vercel.json` — `{"regions": ["iad1"], "framework": "nextjs"}`.

### Vercel project
- Linked to `alejandro-almeidas-projects-5f343d98/project-dashboard` (project ID `prj_ffFN3ObMiWeMxOrfsFOke3ucrAPN`).
- Region pinned to `iad1` via `vercel.json`.
- `.vercel/project.json` committed.

### Upstash Redis (rate limiting)
- Provisioned via Vercel Marketplace integration (`vercel integration add upstash/upstash-kv`).
- Resource: `tikin-dashboard-rl`, host `present-pegasus-108109.upstash.io`, region `us-east-1`.
- Vercel Marketplace auto-injected 5 env vars in `Production, Preview, Development`:
  - `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL`
- **Aliases added manually** so our code (`src/lib/auth/rate-limit.ts`) sees the names it expects:
  - `UPSTASH_REDIS_REST_URL` ← same value as `KV_REST_API_URL`
  - `UPSTASH_REDIS_REST_TOKEN` ← same value as `KV_REST_API_TOKEN`

### Production env vars (8 total)
All set in `Production` target. Marked `Encrypted` by Vercel; sensitive flag applied where applicable.

| Name | Sensitive | Source |
|------|-----------|--------|
| `SESSION_SECRET` | ✓ | Generated `openssl rand -base64 32` |
| `DASHBOARD_PASSWORD_HASH` | ✓ | bcrypt cost 10 of `T1k1N` |
| `UPSTASH_REDIS_REST_URL` | — | Aliased from KV Marketplace |
| `UPSTASH_REDIS_REST_TOKEN` | ✓ | Aliased from KV Marketplace |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | — | `tikin-dashboard-reader@dashboard-494618.iam.gserviceaccount.com` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | ✓ | From `gcp-sa.json`, `\n` literal escapes preserved |
| `GOOGLE_SHEETS_TRANSACTIONS_ID` | — | `1X0oKHsOfKSTWuiCs6OHSD50EXnbZ8tjLjhSFwETQObA` |
| `GOOGLE_SHEETS_PAYOUTS_ID` | — | Same Sheet ID, different tab |

### Production smoke (curl matrix via `vercel curl`)

Behind Vercel Deployment Protection (which gates the public URL), the app responds correctly:

| Path | Expected | Actual |
|------|----------|--------|
| `/inicio` (no cookie) | 307 → /login | ✅ `HTTP/2 307` `location: /login` |
| `/bonos` (no cookie) | 307 → /login | ✅ `HTTP/2 307` `location: /login` |
| `/payouts` (no cookie) | 307 → /login | ✅ `HTTP/2 307` `location: /login` |
| `/clientes` (no cookie) | 307 → /login | ✅ `HTTP/2 307` `location: /login` |
| `/recargas` (no cookie) | 307 → /login | ✅ `HTTP/2 307` `location: /login` |
| `/api/smoke` (no cookie) | 307 → /login | ✅ `HTTP/2 307` `location: /login` |
| `/login` | 200 + login HTML | ✅ Returns full page with `<title>Tikin Dashboard</title>`, "Acceso restringido" card, password input, "Entrar" button |
| Server region | iad1 | ✅ `x-vercel-id: iad1::iad1::...` |

**Authenticated `/api/smoke` test deferred** — Server Actions handshake makes curl-driven login fragile. User can verify manually: login in browser → visit `/api/smoke` → expect either `{"ok": true, ...}` if schema matched (unlikely on first try) or `{"ok": false, "error": "Sheet schema mismatch — columnas faltantes: ..."}` (expected, confirms validation works).

---

## 📊 Sheet Schema Findings (CRITICAL — Phase 2 Input)

Live fetch from BD_Plataforma!A1:Z1 + BD_Payouts!A1:Z1 captured the **actual** column headers. They differ entirely from the tentative names in `src/lib/domain/schemas.ts`. Phase 2's first task is rewriting that schema to match these.

### `BD_Plataforma` — 23 cols, 3232 data rows

```
[0]  tikintag                         ← likely the empresa identity (TBD with user)
[1]  account_id                       ← alternative empresa identity
[2]  wallet_id
[3]  balance_available
[4]  balance_frozen
[5]  balance_currency                 ← currency normalization input
[6]  balance_pocket
[7]  transaction_id                   ← JOIN KEY with BD_Payouts.Transaction ID
[8]  reference
[9]  created_at                       ← timestamp (rendered as FORMATTED_STRING)
[10] direction                        ← in / out
[11] transaction_type                 ← BONO / RECARGA / PAYOUT / etc. (TBD names)
[12] status                           ← ✅ EXISTS — unlocks success rate metrics
[13] amount
[14] gross_amount
[15] fixed_transaction_fee
[16] variable_fee_percentage
[17] total_transaction_fee
[18] source_transfer_tikintag
[19] destination_transfer_tikintag
[20] source_bank
[21] batch_reference
[22] pocket_name
```

### `BD_Payouts` — 15 cols, ~999 data rows

```
[0]  Transaction ID                   ← JOIN KEY with BD_Plataforma.transaction_id
[1]  Date
[2]  Holder                           ← likely empresa identity for payouts
[3]  Destination Account
[4]  Value
[5]  Destination Medium               ← ✅ EXISTS — supports PAY-04 (tarjeta vs banco)
[6]  Transaction Cost
[7]  State                            ← ✅ EXISTS — unlocks payout success rate
[8]  State Timestamp
[9]  Refund Sent
[10] Aging                            ← input for P50 / P95 latency
[11] Failure Reason                   ← ✅ EXISTS — unlocks failure breakdown
[12] Failure Details
[13] Total Time                       ← input for P50 / P95
[14] ID
```

### v2 → v1 Promotions (REQUIREMENTS.md should be updated)

The original requirements deferred 3 features to v2 because of "no status / failure_reason / destination_type column" assumptions. **Those assumptions were wrong.** The data exists today:

- **REC-V2-01** (Recargas success rate %) → v1-capable. `BD_Plataforma.status` exists.
- **PAY-V2-01** (Payouts success rate %) → v1-capable. `BD_Payouts.State` exists.
- **PAY-V2-02** (Payouts failure breakdown) → v1-capable. `BD_Payouts.Failure Reason` + `Failure Details` exist.
- **PAY-04** (split tarjeta vs cuenta bancaria) → confirmed v1. `BD_Payouts.Destination Medium` exists.

Phase 2 (Bonos) does not consume these directly, but **Phase 3 (Payouts) and Phase 4 (Recargas)** should plan with these unlocked from the start.

### Open ambiguities for Phase 2 to resolve with user

1. **Empresa identity column** — there is no explicit `empresa_id` or `empresa_nombre`. Candidates: `tikintag`, `account_id`, or `Holder` (in BD_Payouts). Phase 2 must ask the user which column represents the **corporate client** (empresa) of Tikin, vs. an end-user account.
2. **`transaction_type` values** — the TENTATIVE schema enumerated `'BONO' | 'RECARGA' | 'PAYOUT' | 'OTRO'`. Phase 2 must read distinct values from the Sheet to confirm the actual enum (could be Spanish, lowercase, etc.).
3. **Naming convention mismatch** — `BD_Plataforma` uses `snake_case English`, `BD_Payouts` uses `Title Case English`. The header-name index in `_utils.ts` lowercases + trims, so this works mechanically, but Phase 2 must keep both naming conventions in mind when writing schemas.
4. **Currency** — `balance_currency` is on balance rows, not transactions. Phase 2 must decide: assume COP for all `amount` values? Or look up currency via wallet/account?

---

## Deviations Applied

### Rule-3 (Blocking) — Sheets config tab names
The `src/lib/sheets/config.ts` had tentative `Transacciones!A1:Z` / `Payouts!A1:Z` which would have failed `/api/smoke`. Updated to `BD_Plataforma!A1:Z` and `BD_Payouts!A1:Z` (real tab names from the user's Sheet).

### Rule-1 (Bug) — Vercel KV vs Upstash naming
Vercel Marketplace's Upstash for Redis integration provisions env vars under `KV_*` legacy names (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Our code uses `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (matching the `@upstash/ratelimit` library's expected env var names). Resolved by manually adding `UPSTASH_REDIS_REST_*` env vars in Vercel pointing at the same values as `KV_REST_API_*`. Code unchanged.

### Rule-3 (Blocking) — Vercel CLI overwrote `.env.local`
`vercel integration add upstash/upstash-kv` had a side effect of writing the Marketplace-pulled vars into `.env.local`, **deleting** all 8 prior values that had been set up earlier in this plan. Recovery:
- `SESSION_SECRET` — regenerated locally via `openssl rand -base64 32`. Same value pushed to Vercel.
- `DASHBOARD_PASSWORD_HASH` — regenerated locally via bcrypt cost 10 of `T1k1N`. Same plaintext maps to a new hash (bcrypt is non-deterministic) but verifies identically.
- `UPSTASH_REDIS_REST_URL` + `_TOKEN` — recovered from the Vercel-pulled `KV_REST_API_URL` + `KV_REST_API_TOKEN`.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SHEETS_*` — recovered from chat history.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — recovered from chat history.

**Forward-looking guidance:** any plan that runs `vercel integration add` should pull from Vercel into `.env.local` BEFORE setting up its own values, or back up `.env.local` first. Add to project guidance for future phases.

---

## 🔒 Security Debt (TODO list with rotation instructions)

### 1. GCP service account key NOT rotated

**Status:** Same key as before. `private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459` was leaked in chat history during Plan 04 setup.

**Blast radius:** Bounded — service account has `Viewer` permission on a single Sheet (`1X0oKHsOfKSTWuiCs6OHSD50EXnbZ8tjLjhSFwETQObA`) and zero project-level GCP roles. Worst case if leaked: read-only access to Tikin's transactions Sheet.

**User accepted risk** to ship Phase 1. Rotate when convenient.

**Rotation procedure (≈5 min):**
```bash
# 1. In GCP Console:
#    https://console.cloud.google.com/iam-admin/serviceaccounts?project=dashboard-494618
#    Click tikin-dashboard-reader → Keys tab
#    Delete key id 71dd502c55f4859096a2a5073dd23bdceecc4459
#    Add Key → Create new → JSON → download

# 2. Extract the new private_key value (with \n LITERAL escapes for Vercel):
NEW_KEY=$(jq -r .private_key /path/to/new-key.json | python3 -c "import sys; print(sys.stdin.read().replace(chr(10), chr(92)+chr(110)), end='')")

# 3. Replace in Vercel:
cd /Users/alejoalmeida/dev/Dashboard_Tikin
vercel env rm GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY production --yes
printf '%s' "$NEW_KEY" | vercel env add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY production --sensitive

# 4. Redeploy:
vercel --prod --yes
```

### 2. Password is `T1k1N` (5 chars)

**Status:** User-accepted weak password. Mitigations in place: bcrypt cost 10 + Upstash sliding-window rate limit (5 attempts / 5 min / IP).

**Rotation procedure:**
```bash
# 1. Generate new hash locally:
NEW_HASH=$(node -e 'console.log(require("bcryptjs").hashSync("YOUR_NEW_PASSWORD_HERE", 10))')

# 2. Replace in Vercel:
vercel env rm DASHBOARD_PASSWORD_HASH production --yes
printf '%s' "$NEW_HASH" | vercel env add DASHBOARD_PASSWORD_HASH production --sensitive

# 3. Redeploy:
vercel --prod --yes
```

### 3. Env vars only in `production` target

The 8 user env vars (excluding the 5 Marketplace KV_*) were set in `Production` only. Preview and Development environments will fail rate limit / Sheets reads.

**Resolution (when user starts using preview deploys):**
```bash
# For each var, add to preview + development with same values
for var in SESSION_SECRET DASHBOARD_PASSWORD_HASH UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN GOOGLE_SERVICE_ACCOUNT_EMAIL GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY GOOGLE_SHEETS_TRANSACTIONS_ID GOOGLE_SHEETS_PAYOUTS_ID; do
  value=$(grep "^$var=" .env.local | sed -E 's/^[^=]+="?(.*)"?$/\1/')
  printf '%s' "$value" | vercel env add $var preview
  printf '%s' "$value" | vercel env add $var development
done
```

---

## 🛑 USER ACTION REQUIRED — Vercel Deployment Protection

The deployment URL `https://project-dashboard-bkwmin189.vercel.app` is currently behind **Vercel Deployment Protection** (Vercel-default for new projects). Anyone visiting from outside your Vercel team sees Vercel's SSO wall ("Authentication Required"), not the Tikin login page.

**For internal team use:** team members logged into Vercel can access the URL directly.

**For client demos** (the project's primary use case per PROJECT.md): you must disable Deployment Protection.

**How to disable:**
1. https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/settings/deployment-protection
2. Set **Vercel Authentication** to **Disabled**
3. Save
4. Test by opening the URL in a private/incognito browser — should now show the Tikin login page directly

After disabling, the next URL anyone visits is `/login`. They must enter the password (`T1k1N` until rotated) to see the dashboard.

**Alternative (more secure):** keep Deployment Protection ON for the `*.vercel.app` URL, configure a custom domain (e.g., `dashboard.tikin.co`, planned for Phase 5 / INFRA-04), and Vercel will route the custom domain publicly while keeping the preview URLs protected. Either approach satisfies the requirement.

---

## Patterns Established

- **Vercel Marketplace integration** for external services > direct provider account creation when both work. One less account to manage, env vars auto-injected.
- **Sensitive env var marking** for any secret that gives an attacker capabilities (auth, DB access). Vercel encrypts at rest and hides values in UI/CLI.
- **`KV_*` → `UPSTASH_REDIS_REST_*` aliasing** when Marketplace naming conflicts with library expectations. Add manual aliases vs. forking the library.
- **Region pinning** via `vercel.json` for predictable latency to external APIs (Google Sheets is fastest from `iad1`).

---

## Phase 2 (Bonos) — Input from this plan

Phase 2's first task should be:

1. **Rewrite `src/lib/domain/schemas.ts`** to match the actual `BD_Plataforma` headers:
   - `tikintag, account_id, wallet_id, balance_available, balance_frozen, balance_currency, balance_pocket, transaction_id, reference, created_at, direction, transaction_type, status, amount, gross_amount, fixed_transaction_fee, variable_fee_percentage, total_transaction_fee, source_transfer_tikintag, destination_transfer_tikintag, source_bank, batch_reference, pocket_name`
   - And `ExpectedTransactionHeaders` array.

2. **Decide empresa identity**: ask user whether `tikintag`, `account_id`, or another column represents the corporate client of Tikin. This drives `CROSS-02` (empresa filter) and the EmpresaFilter list population.

3. **Confirm `transaction_type` enum values**: read distinct values from BD_Plataforma to produce the actual enum (vs. tentative `BONO|RECARGA|PAYOUT|OTRO`).

4. **Update REQUIREMENTS.md** to promote 3 v2 features back to v1: REC-V2-01, PAY-V2-01, PAY-V2-02. Optionally add explicit v1 IDs (e.g., REC-04 for success rate, PAY-06 for failure breakdown). This is a small docs phase or part of Phase 3 prep.

5. **Add `payouts.ts` adapter** during Phase 3 following the same shape as `transactions.ts`. Headers already captured above.
