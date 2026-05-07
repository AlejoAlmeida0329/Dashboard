# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07 al iniciar milestone v2.0 Analytics)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 6 — Foundation v2 (cross-cutting infrastructure para v2.0)

## Current Position

Phase: 6 of 10 (Foundation v2) — first phase of v2.0 milestone COMPLETE
Plan: 06-01 + 06-02 + 06-03 + 06-04 complete (Phase 6 done)
Status: Phase complete — ready for `/gsd:execute-phase` close-out / Phase 7 planning
Last activity: 2026-05-07 — Completed 06-04-PLAN.md (dark mode + paleta v2.0 + visibility por métrica)

Progress: v1.0 ✅ SHIPPED (Phases 1-5) · v2.0 🚧 1/5 phases (20%) · Phase 6: 4/4 plans ████ (100%)

## Performance Metrics

**Velocity (v1.0 baseline):**
- Total plans completed in v1.0: 24 (1 deferred — INFRA-04 carry-forward)
- Total commits: 88 commits in 10 días
- Total LOC produced: ~9150 TypeScript LOC en 76 archivos
- Total execution time: 2026-04-27 → 2026-05-06 (10 días calendario)

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | TBD | ✅ |
| 2. Bonos | TBD | ✅ |
| 3. Payouts | TBD | ✅ |
| 4. Inicio + Recargas | TBD | ✅ |
| 5. Clientes + Domain | TBD | ✅ (1 plan deferred) |

**Recent Trend:**
- Last 5 plans (v1.0 closing): 12-plan zero-deviation streak (plan-spec literal-block fidelity demonstrated)
- Trend: improving — domain libraries + UI leaves + page composition demonstrated deterministic parity in late v1.0

*Updated after each plan completion in v2.0*

## Accumulated Context

### Decisions (recent, affecting current work)

Decisions están loggeadas en PROJECT.md Key Decisions table. Recent ones que afectan Phase 6 (Foundation v2):

- **JOIN canónico = `transaction_id` (técnico) / `reference` (semántico via PRD)** — código usa `transaction_id`, JSDoc cita PRD por convención. Verificación histórica 773/798 (96.9%) match; live re-verificación Plan 06-02 = 768/797 (96.36%, satisface ≥96%). CROSS-V2-04. **Helper canónico `joinPayouts()` en `src/lib/domain/join.ts` (Plan 06-02)** — `joinIndex` + `joinMatchStats` + tipo `JoinedPayout` exportados. Migración del inline-join de `payouts/page.tsx` deferida a Phase 7+.
- **Modo Presentación + cliente-foco share-URL preservados en v2.0** — PRD declara dual-purpose explícito en Vista Cliente; visibility por métrica refinada en CLI-V2-* requirements y CROSS-V2-07.
- **Reutilizar componentes/diseño/auth de v1.0** donde apliquen — design system aprobado; refactorizar solo data + nuevas vistas.
- **6 secciones (no 5)** — Recargas vuelve en v2 con scope expandido (PSE + Transfer); Uso Tarjeta es una sección distinta para PURCHASE.
- **`parseCOPAmount` returns `number | null`** (Plan 06-01) — null = explicit "no value" signal; v2.0 callers branch on `=== null` to distinguish missing vs zero. Zod schemas wrap and translate null → `addIssue + z.NEVER`.
- **`parsers.ts` public API in MINUTES, `schemas.ts` internal path in SECONDS** (Plan 06-01) — `parseAging`/`parseTotalTime` return minutes (PRD v2 expectation); `parsePgIntervalSeconds` kept exported and used by `schemas.ts` for `Payout.latencySeconds` backward-compat (Phase 3 percentiles).
- **CSV multi-select URL serialization** (Plan 06-03) — `?status=completed,failed&tipo=BONUS,P2P` chosen over repeated keys. Empty array → param omitted (parity with absent key). Stable URL ordering: from → to → empresa → status → tipo → presenter.
- **Filter option lists hardcoded in components** (Plan 06-03) — `StatusFilter` + `TypeFilter` declare their own `value/label` arrays; NOT auto-derived from `TransactionType` union. UI labels (e.g. "Compra (tarjeta)") are UI concerns; defensive fallbacks (UKNOWN, OTRO) excluded from filter options. Schema additions don't auto-pollute the dropdown.
- **Phase 6 ships filter UI + URL contract only** (Plan 06-03) — domain functions (`filterBonos`, `filterPayouts`, etc.) NOT touched. Each Phase 7+ section decides which filters to honor in its data layer.
- **Diagnostic-route lifecycle pattern reaffirmed** (Plan 06-02) — temp `/api/diagnose-*` routes for live verification get created, exercised via temporary proxy.ts PUBLIC_PATHS extension, then deleted (route) + reverted (proxy) BEFORE the task commit. Source never lands in git history. Mirrors Plans 02-01 and 03-01.
- **next-themes wired with `attribute="class"` + `defaultTheme="system"`** (Plan 06-04) — aligns with the existing `@custom-variant dark (&:is(.dark *))` selector in `globals.css` (zero v1.0 dark CSS rewritten). First visit respects OS preference; user override persists in localStorage. `<html suppressHydrationWarning>` required because next-themes flips `.dark` before React hydrates. ThemeToggle stays VISIBLE in presenter mode (operator control during meetings).
- **v2.0 paleta = OKLCH, lifted +0.10 lightness for dark** (Plan 06-04) — 6 section vars (`--section-{inicio|bonos|payouts|tarjeta|clientes|recargas}`) + 3 status vars (`--status-{success|fail|pending}`) declared in `:root`, mirrored brighter in `.dark`. Exposed to Tailwind via `@theme inline { --color-section-*: var(--section-*) }` so `text-section-bonos`, `bg-status-success`, etc. resolve as utilities. Status palette intentionally aliases section hues (verde ≡ emerald, amarillo ≡ amber) — single semantic source per hue family.
- **Conservative-default per-metric visibility** (Plan 06-04, CROSS-V2-07) — `[data-presenter="on"] [data-presenter-metric-hide] { display: none !important }`. Default policy: ALL metrics visible in presenter; opt-out by tagging individual elements. Distinct from chrome `data-presenter-hide` and cliente-foco `data-presenter-empresa-hide`. Phase 9 (Vista Cliente CLI-V2-08) tags the cronological timeline.
- **React 19 `react-hooks/set-state-in-effect` requires per-call eslint-disable for next-themes mount gate** (Plan 06-04 deviation) — canonical `useEffect → setMounted(true)` pattern collides with the React 19 lint rule. Resolution: keep the documented next-themes pattern + focused single-line `eslint-disable-next-line` + JSDoc explaining the why. Future plans adopting "subscribe → setState" patterns may need similar exceptions; if more than 2-3 cases appear, consider project-level config exception.

### Pending Todos

Ninguno aún para v2.0. Carry-forwards de v1.0 deferreds NO se trasladan (decisión 2026-05-07 — quedan en `milestones/v1.0-REQUIREMENTS.md` para referencia histórica; surgen caso por caso vía `/gsd:add-todo`).

### Blockers/Concerns (carry-forward al milestone v2.0)

- **Sheet header H corregido por usuario 2026-05-07** — verificación end-to-end pendiente (no recargó browser después de "Ya"). Riesgo: cualquier edición upstream rompe el adapter; schema validation captura el error pero requiere intervención manual.
- **INFRA-04 (custom domain) deferido desde v1.0** — Plan 05-05 pospuesto. Decisión pendiente upfront: subdomain / apex / defer definitivo. Cliente-flow LIVE en `.vercel.app` con SSO de Vercel.
- **Vercel Deployment Protection ENABLED por defecto** — la URL `.vercel.app` requiere SSO. Mitigación: custom domain (INFRA-04) bypassa el SSO.
- **3 deudas de seguridad de v1.0** documentadas en `01-04-SUMMARY.md`: GCP key NO rotada, password 5-char, env vars solo Production target.
- **Vercel CLI fuera de PATH** — pre-condición: `export PATH="$HOME/.nvm/versions/node/v24.11.0/bin:$PATH"` para deploy tasks.
- **Parallel-wave git race** observado 3 veces en v1.0 — recovery: `git stash --include-untracked` o `git commit -- <pathspec>`.
- **dotenv-expand bug** — bcrypt hashes con salt empezando en letra/dígito se corrompen al ser leídos por `@next/env`. Mitigación: escape `\$` en `.env.local`.

## Session Continuity

Last session: 2026-05-07 — Plan 06-04 ejecutado (dark mode + paleta v2.0 + visibility por métrica). **Phase 6 cerrada (4/4 plans).**

**v2.0 actions tomadas hoy:**
- ✅ `/gsd:new-milestone` — milestone iniciado
- ✅ `/gsd:define-requirements` — 51 requirements en 8 categorías (REQUIREMENTS.md)
- ✅ `/gsd:create-roadmap` — 5 fases (6-10) con success criteria + research flags + traceability completo
- ✅ `/gsd:plan-phase 6` — Phase 6 plans creados (06-01 a 06-04)
- ✅ `/gsd:execute-plan 06-01` — `src/lib/domain/parsers.ts` creado; `schemas.ts` refactorizado a delegar; tsc + lint + build green
- ✅ `/gsd:execute-plan 06-03` (Wave 1) — `DashboardFilters.status`/`tipo` + `StatusFilter`/`TypeFilter` + header wired; tsc + lint + build green; zero deps añadidas
- ✅ `/gsd:execute-plan 06-02` (Wave 1) — `src/lib/domain/join.ts` (148 LOC) con `joinPayouts`/`joinIndex`/`joinMatchStats`/`JoinedPayout`; live match-rate 768/797 (96.36%, ≥96% threshold); tsc + lint + build green; zero deps añadidas
- ✅ `/gsd:execute-plan 06-04` (Wave 2) — next-themes ThemeProvider + ThemeToggle + 9 paleta CSS vars (light + dark) + `data-presenter-metric-hide` rule + header polish; tsc + lint + build green; zero deps añadidas; user-approved visual checkpoint

**Next:**
1. `/gsd:execute-phase 6` close-out — orchestrator updates ROADMAP.md (Phase 6 → ✅ shipped) and REQUIREMENTS.md (CROSS-V2-01..07 → ✅) at phase-completion step
2. `/gsd:plan-phase 7` — unification of Bonos + Payouts under v2.0 sections layout

Stopped at: Completed 06-04-PLAN.md (Phase 6 fully closed)
Resume file: None
