# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07 al iniciar milestone v2.0 Analytics)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Phase 6 — Foundation v2 (cross-cutting infrastructure para v2.0)

## Current Position

Phase: 6 of 10 (Foundation v2) — first phase of v2.0 milestone
Plan: 06-01 + 06-03 complete (Wave 1 parallel execution)
Status: In progress
Last activity: 2026-05-07 — Completed 06-03-PLAN.md (filtros globales Estado + Tipo + URL CSV)

Progress: v1.0 ✅ SHIPPED (Phases 1-5) · v2.0 🚧 0/5 phases (0%) · Phase 6: 2/4 plans ██░░ (50%)

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

- **JOIN canónico = `transaction_id` (técnico) / `reference` (semántico via PRD)** — código usa `transaction_id`, JSDoc cita PRD por convención. Verificación 773/798 (96.9%) match. CROSS-V2-04.
- **Modo Presentación + cliente-foco share-URL preservados en v2.0** — PRD declara dual-purpose explícito en Vista Cliente; visibility por métrica refinada en CLI-V2-* requirements y CROSS-V2-07.
- **Reutilizar componentes/diseño/auth de v1.0** donde apliquen — design system aprobado; refactorizar solo data + nuevas vistas.
- **6 secciones (no 5)** — Recargas vuelve en v2 con scope expandido (PSE + Transfer); Uso Tarjeta es una sección distinta para PURCHASE.
- **`parseCOPAmount` returns `number | null`** (Plan 06-01) — null = explicit "no value" signal; v2.0 callers branch on `=== null` to distinguish missing vs zero. Zod schemas wrap and translate null → `addIssue + z.NEVER`.
- **`parsers.ts` public API in MINUTES, `schemas.ts` internal path in SECONDS** (Plan 06-01) — `parseAging`/`parseTotalTime` return minutes (PRD v2 expectation); `parsePgIntervalSeconds` kept exported and used by `schemas.ts` for `Payout.latencySeconds` backward-compat (Phase 3 percentiles).
- **CSV multi-select URL serialization** (Plan 06-03) — `?status=completed,failed&tipo=BONUS,P2P` chosen over repeated keys. Empty array → param omitted (parity with absent key). Stable URL ordering: from → to → empresa → status → tipo → presenter.
- **Filter option lists hardcoded in components** (Plan 06-03) — `StatusFilter` + `TypeFilter` declare their own `value/label` arrays; NOT auto-derived from `TransactionType` union. UI labels (e.g. "Compra (tarjeta)") are UI concerns; defensive fallbacks (UKNOWN, OTRO) excluded from filter options. Schema additions don't auto-pollute the dropdown.
- **Phase 6 ships filter UI + URL contract only** (Plan 06-03) — domain functions (`filterBonos`, `filterPayouts`, etc.) NOT touched. Each Phase 7+ section decides which filters to honor in its data layer.

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

Last session: 2026-05-07 — Plan 06-03 ejecutado (filtros globales Estado + Tipo, URL CSV serialization).

**v2.0 actions tomadas hoy:**
- ✅ `/gsd:new-milestone` — milestone iniciado
- ✅ `/gsd:define-requirements` — 51 requirements en 8 categorías (REQUIREMENTS.md)
- ✅ `/gsd:create-roadmap` — 5 fases (6-10) con success criteria + research flags + traceability completo
- ✅ `/gsd:plan-phase 6` — Phase 6 plans creados (06-01 a 06-04)
- ✅ `/gsd:execute-plan 06-01` — `src/lib/domain/parsers.ts` creado; `schemas.ts` refactorizado a delegar; tsc + lint + build green
- ✅ `/gsd:execute-plan 06-03` (Wave 1) — `DashboardFilters.status`/`tipo` + `StatusFilter`/`TypeFilter` + header wired; tsc + lint + build green; zero deps añadidas

**Next:**
1. Wave 1 sibling plans (06-02, 06-04) — completion pendiente de los otros agentes paralelos en este wave
2. Tras Wave 1 completar, validate `/gsd:execute-phase` checkpoint o avanzar a Phase 7 planning

Stopped at: Completed 06-03-PLAN.md
Resume file: None
