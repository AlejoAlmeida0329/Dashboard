# Project Milestones: Tikin Dashboard

## v1.0 MVP (Shipped: 2026-05-06)

**Delivered:** Dashboard interno + presentable a clientes corporativos en producción, leyendo en vivo de Google Sheets, con 5 pestañas (Inicio, Bonos, Recargas, Payouts, Clientes), auth con password compartido, filtros globales URL-persisted, y Modo Presentación con cliente-foco share-URL flow.

**Phases completed:** 1-5 (24 plans total, 1 deferred dentro de Phase 5)

**Key accomplishments:**

- **Foundation que cada pestaña hereda**: auth con JWT (jose) + bcrypt + Upstash rate limit (5/5min/IP), Google Sheets adapter con `batchGet` + Zod schema validation by header name, filtros globales (date + empresa) URL-persisted, Modo Presentación con CSS data-attribute system.
- **5 pestañas funcionales end-to-end** sobre dos hojas de Sheets (BD_Plataforma 3188 tx + BD_Payouts 798 payouts): Bonos (leaderboard + tabla + KPIs), Payouts (P50/P95 + histograma latencia + TopBancos), Inicio (5 KPIs + 2 charts bucket-aware + 3 hechos curados con prior-period deltas), Recargas (2 KPIs + chart + top-10 + 2 hechos), Clientes (lista 233 empresas + perfil con 12-month chart + 3 mini-cards Bonos/Recargas/Payouts).
- **Cliente-foco share-URL flow cierra el flujo de presentación**: botón "Generar vista para cliente" en perfil de empresa → `/inicio?empresa=$X&presenter=1` con todo lo Tikin-internal (Comisión, Take rate, EmpresasActivasChart, HechosCurados) ocultos via `data-presenter-empresa-hide` CSS gate. Cero React state propagation; ownership delegada a leaves.
- **PAY-04 reinterpretado** como TopBancos (top 5 + Otros) cuando la data reveló cero tarjetas en producción — espíritu del requirement honrado con granularidad real.
- **Track record 12-plan zero-deviation**: 12 plans consecutivos ejecutados con plan-spec literal-block fidelity (domain libraries + UI leaves + page composition demostraron paridad determinista).

**Stats:**

- 76 archivos `.ts` / `.tsx` en `src/` (~9150 LOC TypeScript)
- 161 archivos modificados en total (incluye planning artifacts)
- 5 fases, 24 plans, ~70 tareas atómicas
- 88 commits en 10 días (1 commit por unidad de trabajo verificable)
- Timeline: 2026-04-27 (init) → 2026-05-06 (Phase 5 ships)

**Git range:** `feat(01-01)` → `docs(phase-5)`

**Production:** https://project-dashboard-z0fpsm5hl.vercel.app (`dpl_DuX1cwaKwBiQpPQn2ifstLwcvFa1`, region `iad1`)

**Carry-forward al próximo milestone:**

- **INFRA-04** (custom domain `dashboard.tikin.co`): Plan 05-05 deferido — pendiente decisión de qué dominio usar.
- **REC-V2-01** y **PAY-V2-02**: ahora v1-eligible (las columnas-blocker resultaron existir en producción).
- **3 deudas de seguridad** documentadas en `01-04-SUMMARY.md`: GCP service account key NO rotada (filtrada en chat), password 5-char (`T1k1N`), env vars solo en `Production` target.

**What's next:** TBD — milestone v1.1 a definir.

**Archive:**
- `.planning/milestones/v1.0-ROADMAP.md` — full phase details
- `.planning/milestones/v1.0-REQUIREMENTS.md` — final requirement traceability

---
