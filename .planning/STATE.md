# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-07 al iniciar milestone v2.0 Analytics)

**Core value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio sin abrir Sheets, presentable cuando se proyecta a clientes.
**Current focus:** v2.0 Analytics — defining requirements

## Current Position

Phase: Not started — milestone v2.0 just kicked off
Plan: —
Status: Defining requirements (run `/gsd:define-requirements`)
Last activity: 2026-05-07 — milestone v2.0 Analytics started; PROJECT.md updated with PRD-derived scope

Progress: v1.0 ✅ SHIPPED · v2.0 🚧 in planning

## Accumulated Context

### v2.0 Goal (from user PRD v2)

Refactor el dashboard a vista de analytics operativa según el PRD detallado del usuario (`~/Downloads/PRD_Dashboard_Tikin_v2.docx`, parsed to `/tmp/prd_tikin_v2.txt` durante la sesión 2026-05-07; supersede `PRD_Dashboard_Tikin.docx` v1). El usuario aprobó el design system de v1.0 ("me gusta cómo se ven las gráficas") pero quiere reescribir qué se muestra y bajo qué lente: pasar del lente revenue (GMV / Comisión / Take rate / Empresas) al lente operativo (usuarios activos / tasa de éxito / tipos de transacción / eficiencia / comportamiento por tikintag).

**6 secciones del PRD v2:**
1. **Inicio** — usuarios activos, volumen IN/OUT, tasa de éxito global, donut por tipo, actividad en el tiempo, top 10 usuarios
2. **Bonos** — split source/destination con top emisores y receptores, flujo enviados vs recibidos
3. **Payouts** — extender con tiempo promedio (parsing Total Time), aging alert (>2h), razones de fallo, pagos a terceros (Holder ≠ tikintag)
4. **Uso Tarjeta (NEW)** — compras PURCHASE: KPIs + adopción + tendencia + top usuarios
5. **Vista Cliente** — más rica que v1.0, **dual-purpose declarado por PRD** (🔍 Uso Interno + 🤝 Reuniones con Clientes): selector tikintag (235), 5 KPIs cabecera (incluye balance + pocket), retiros enriquecidos (JOIN), bonos in/out, **P2P (NUEVO)**, compras tarjeta, tiempo vs benchmark, timeline cronológico
6. **Recargas (refactored)** — PAYIN_PSE + **PAYIN_TRANSFER (NEW)** = 137 recargas, 40 usuarios, $743M, 100% completadas. 8 métricas: total · volumen · usuarios % adopción · PSE vs Transfer · promedio · distribución de montos · top usuarios · tendencia temporal.

**Cross-cutting nuevos:**
- Filtros globales: estado de transacción + tipo de transacción (multi-select)
- Parsing de campos texto: Aging/Total Time → minutes; Value/Transaction Cost → number
- JOIN canónico: campo real `BD_Plataforma.transaction_id` ↔ `BD_Payouts.Transaction ID`. PRD lo nombra semánticamente `reference` (legacy/conceptual). Decisión del usuario (opción C, 2026-05-07): código usa `transaction_id`; JSDoc cita el nombre PRD por convención. Verificación con datos: 773/798 match con `transaction_id`, 0/798 con la columna `reference` real (que contiene hex hashes blockchain, no UUIDs).
- **Modo Presentación + cliente-foco share-URL preservados** — justificado por dual-purpose de Vista Cliente. Visibility por métrica: KPIs cabecera + bonos + P2P + compras + tiempo vs benchmark + retiros enriquecidos = visibles en `presenter=1`. Timeline cronológico crudo = `presenter-hide` (uso interno).

### Reuse strategy v1.0 → v2.0

- ✓ Reuse: auth flow, Sheets adapter shell, force-dynamic page pattern, design system (shadcn/ui + Tailwind + recharts), KPICard / Card / Tabs componentes, layout `(protected)` + `PresenterFrame`, `parseFilters` / `buildUrl`, **Modo Presentación + cliente-foco share-URL** (rescatados — justificado por dual-purpose de Vista Cliente del PRD v2).
- 🔄 Refactor: domain libraries (lente cambió empresas→tikintags), schema (parse text fields), filtros globales (añadir 2 nuevos), pestaña Recargas (extender PAYIN_PSE → PAYIN_PSE + PAYIN_TRANSFER, refactorizar métricas según PRD v2 sección 6).
- ➕ NEW: pestaña Uso Tarjeta (PURCHASE), pagos a terceros en Payouts, P2P en Vista Cliente, donut por tipo en Inicio, distribución de montos en Recargas.
- ❌ Eliminate: KPIs revenue (Comisión / Take rate / GMV) → KPIs operativos; leaderboard de bonos por revenue → top emisores/receptores; "hechos curados" (Phase 4 v1.0) → reemplazados por donut + actividad temporal.

### Open Blockers (carry-forward al milestone v2.0)

- **Sheet header H corregido por usuario 2026-05-07** — celda H1 en BD_Plataforma decía `L` en lugar de `transaction_id`. Reportado por debugger session `.planning/debug/sheets-schema-transaction-id.md`. Usuario respondió "Ya" pero verificación end-to-end pendiente (no recargó browser). Riesgo: cualquier edición upstream del Sheet rompe el adapter; schema validation captura el error pero requiere intervención manual.
- **INFRA-04 (custom domain) deferido** desde v1.0 — Plan 05-05 pospuesto. Decisión pendiente: `subdomain-tikin <domain>` / `apex-other <domain>` / `defer-domain` definitivo. Cliente-flow LIVE en `.vercel.app`.
- **Vercel Deployment Protection ENABLED por defecto** — la URL de producción `.vercel.app` requiere SSO de Vercel. Mitigación: custom domain (INFRA-04) bypassa el SSO.
- **3 deudas de seguridad de v1.0** documentadas en `01-04-SUMMARY.md`:
  1. GCP service account key NO rotada (filtrada en chat history durante setup)
  2. Password 5-char (`T1k1N` / `tikin2026` post-2026-05-07) — bcrypt cost 10 + Upstash rate limit 5/5min/IP activos
  3. Env vars solo en Vercel `Production` target — preview + development carecen
- **`TransactionType.UKNOWN` (sic)** preservado verbatim en producción — typo en data fuente; user owns la limpieza source-side.
- **Same `tikintag` puede mapear a múltiples wallets por empresa** — corporate vs employee wallets aparecen como entidades separadas. Para v2.0 con lente "tikintag = usuario" esto es features-aligned, ya no es bug.

### Operational Notes

- **Vercel CLI 52.0.0** ubicado en `/Users/alejoalmeida/.nvm/versions/node/v24.11.0/bin/vercel` (NO en default PATH).
- **Auth Vercel**: `alejandro-9264` carry-over; scope `alejandro-almeidas-projects-5f343d98`; project `project-dashboard`.
- **Parallel-wave git race** observado 3 veces en v1.0 — recovery: `git stash --include-untracked` o `git commit -- <pathspec>`.
- **dotenv-expand bug 2026-05-07**: bcrypt hashes con salt empezando en letra/dígito se corrompen al ser leídos por `@next/env`. Mitigación: escape `\$` en `.env.local`. Aplicado a `DASHBOARD_PASSWORD_HASH` actual.
- **Dev server local environment**: PATH export requerido (`/Users/alejoalmeida/.nvm/versions/node/v24.13.1/bin`) para `npm run dev`.
- **PRD del usuario**: ground truth para v2.0 data model y métricas. Una corrección documentada: línea 22/350 dicen `reference` como JOIN key — corregir a `transaction_id` antes de empezar.

## Session Continuity

Last session: 2026-05-07 — milestone v2.0 Analytics kickoff.

**v1.0 archived (commits desde milestone close):**
- `chore: complete v1.0 milestone` (commit `13d0a10`, 2026-05-06)
- Tag local `v1.0` creado (no pusheado)

**v2.0 actions tomadas hoy:**
- Sheet schema bug detectado y root-caused (debugger session: `.planning/debug/sheets-schema-transaction-id.md`)
- Password reset workflow: `T1k1N` → `tikin2026` (regenerated 2 veces por dotenv-expand bug; final hash con escape `\$`)
- PROJECT.md actualizado con scope v2.0 derivado del PRD (5 secciones, ~40 requirements iniciales en Active)

**Next milestone flow:**
1. ✅ `/gsd:new-milestone` — DONE (este turno)
2. **`/gsd:define-requirements`** — refinar los Active requirements del PROJECT.md, mover a `.planning/REQUIREMENTS.md` con scope claro v1 vs v2
3. `/gsd:create-roadmap` — descomponer en fases (sugerencia: una fase por sección + una fase de cross-cutting + una fase opcional INFRA-04)
4. `/gsd:plan-phase 1` — primera fase (probablemente cross-cutting: parsing utils + filtros globales nuevos + JOIN helper, fundación para todas las secciones)

Resume file: None
