# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06 después del milestone v1.0)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** Planning next milestone (v1.1)

## Current Position

Phase: Not started — v1.0 milestone shipped 2026-05-06
Plan: Not started
Status: Ready to plan v1.1
Last activity: 2026-05-06 — v1.0 milestone complete (5 phases, 24 plans, ~9150 LOC, 88 commits, production at https://project-dashboard-z0fpsm5hl.vercel.app)

Progress: v1.0 ✅ SHIPPED (40/41 reqs; INFRA-04 carry-forward)

## Accumulated Context

### Key Decisions (resumen — full log en PROJECT.md y .planning/milestones/v1.0-ROADMAP.md)

- **Stack**: Next.js 16.2 + Google Sheets API (`googleapis` `batchGet`) + `jose` JWT + bcrypt + Upstash Redis para rate limit. Validado v1.0.
- **Auth**: password compartido único + cookie HttpOnly + rate limit 5/5min/IP. Validado v1.0.
- **Lectura en vivo**: cada page load re-fetcha Sheets; React `cache()` deduplica intra-render (page + DashboardHeader comparten 1 fetch). Quota 60/min/SA nunca tocó techo en producción.
- **Filtros globales**: date range + empresa, URL-persisted via `parseFilters` / `buildUrl`, sticky entre pestañas.
- **Modo Presentación**: CSS data-attribute system (`data-presenter`, `data-empresa-filter` en el layout root via `PresenterFrame`); cero React state propagation; ownership delegada a leaves.
- **Cliente-foco share-URL**: `?empresa=$X&presenter=1` → todas las pestañas auto-aplican empresa filter + esconden Tikin-internal widgets via `data-presenter-empresa-hide`. CLI-08 cierra el flujo end-to-end.
- **Per-task atomic commits**: 88 commits en 10 días = 1 commit por unidad verificable. Bisect-friendly.
- **Track record zero-deviation**: 12 plans consecutivos con plan-spec literal-block fidelity (Phase 2 final + Phase 3 + Phase 4 final + Phase 5 código).

### Open Blockers (carry-forward al próximo milestone)

- **INFRA-04 (custom domain) deferido** — Plan 05-05 pospuesto el 2026-05-06 por decisión del usuario. Decisión pendiente: `subdomain-tikin <domain>` / `apex-other <domain>` / `defer-domain` definitivo. Mientras tanto, cliente-flow LIVE en `.vercel.app`.
- **Vercel Deployment Protection ENABLED por defecto** — la URL de producción `.vercel.app` requiere SSO de Vercel. Mitigación: custom domain (INFRA-04) bypassa el SSO. Hasta entonces el demo a clientes via `.vercel.app` requiere disable manual en Vercel settings (https://vercel.com/alejandro-almeidas-projects-5f343d98/project-dashboard/settings/deployment-protection).
- **3 deudas de seguridad** documentadas en `01-04-SUMMARY.md`:
  1. **GCP service account key NO rotada** — `private_key_id 71dd502c55f4859096a2a5073dd23bdceecc4459` filtrada en chat history durante setup. SA scope: Viewer en una sola Sheet. Procedimiento de rotación documentado.
  2. **Password 5-char (`T1k1N`)** — usuario aceptado. Mitigaciones activas: bcrypt cost 10 + Upstash sliding-window rate limit 5/5min/IP.
  3. **Env vars solo en Vercel `Production` target** — preview + development carecen de las 8 user vars (auth + GCP + Sheets). Future preview deploys fallarán.
- **3 v2 features ahora v1-eligible para próximo milestone**: REC-V2-01 (Recargas success rate) + PAY-V2-02 (Payouts failure breakdown). Las columnas-blocker (`status` + `Failure Reason`) resultaron existir en producción durante v1.0.
- **`TransactionType.UKNOWN` (sic)** preservado verbatim en producción — typo en data fuente; user owns la limpieza source-side en la Sheet.
- **Same `tikintag` puede mapear a múltiples wallets por empresa** — corporate vs employee wallets aparecen como empresas separadas (233 unique tikintags en producción). Próximo milestone puede introducir many-to-one mapping si Tikin lo confirma.

### Operational Notes

- **Vercel CLI 52.0.0** ubicado en `/Users/alejoalmeida/.nvm/versions/node/v24.11.0/bin/vercel` (NO en default PATH). Cada deploy task requiere PATH export explícito.
- **Auth Vercel**: `alejandro-9264` carry-over entre sessions; scope `alejandro-almeidas-projects-5f343d98`; project `project-dashboard`.
- **Parallel-wave git race** observado 3 veces en v1.0 (Phase 4 + Phase 5). Recovery patterns documentados:
  - `git stash --include-untracked` de archivos foreign antes de staging
  - O `git commit -- <pathspec>` para limitar scope de commit (recomendado como estándar para parallel-wave plans)

## Session Continuity

Last session: 2026-05-06 — v1.0 milestone close.

**v1.0 archived:**
- `.planning/MILESTONES.md` — entry creado
- `.planning/milestones/v1.0-ROADMAP.md` — full phase details (5 fases, 24 plans, decisions, tech debt)
- `.planning/milestones/v1.0-REQUIREMENTS.md` — 40/41 reqs marked complete; INFRA-04 deferred
- Tag: `v1.0` (pendiente push al remote)

**Deleted (fresh para próximo milestone):**
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`

**Next milestone flow:**
1. `/gsd:discuss-milestone` — thinking partner, crea context file
2. `/gsd:new-milestone` — actualiza PROJECT.md con nuevos goals
3. `/gsd:research-project` — (opcional) research de ecosystem
4. `/gsd:define-requirements` — scope de qué construir en v1.1
5. `/gsd:create-roadmap` — plan de cómo construirlo

Resume file: None
