# Requirements: Tikin Dashboard

**Defined:** 2026-04-27
**Core Value:** Una sola URL donde el equipo de Tikin ve métricas frescas del negocio (bonos vendidos, recargas, payouts, clientes activos) sin tener que abrir Sheets ni armar reportes ad-hoc — y que se vea presentable cuando se proyecta a clientes.

## v1 Requirements

Requirements para el primer release. Cada uno mapea a una fase del roadmap.

### Cross-cutting

Capacidades transversales que aplican a todas las pestañas del dashboard.

- [ ] **CROSS-01**: Filtro global de rango de fechas (7d / 30d / MTD / QTD / YTD / custom) que aplica a todas las pestañas
- [ ] **CROSS-02**: Filtro global de empresa (single-select, sticky entre pestañas, codificado en URL para compartir)
- [ ] **CROSS-03**: Formato consistente de moneda (COP, separador de miles, sin decimales en números grandes) y fechas en es-CO
- [ ] **CROSS-04**: Timestamp visible de "última lectura" en cada vista (data en vivo desde Sheets en cada page load)
- [ ] **CROSS-05**: Estados de loading, empty y error decentes en cada widget (no spinners crudos ni pantalla en blanco)
- [ ] **CROSS-06**: Toggle "Modo Presentación" que oculta widgets internos (revenue, comisión, take rate, leaderboards de otras empresas), agranda fuentes y limpia chrome de navegación

### Authentication

- [ ] **AUTH-01**: Password compartido único protege el acceso a todo el dashboard
- [ ] **AUTH-02**: Sesión persiste en cookie HttpOnly (no requiere re-login en cada page load)
- [ ] **AUTH-03**: Login tiene rate limiting (5 intentos / 5 min / IP) para evitar brute-force

### Infrastructure

- [ ] **INFRA-01**: Despliegue en Vercel (etapa de prueba)
- [ ] **INFRA-02**: Conexión a las dos hojas de Google Sheets actuales vía API (transacciones de plataforma + tiempos de payouts)
- [ ] **INFRA-03**: Validación de schema en cada lectura de Sheets — si una columna esperada falta o cambia de tipo, el dashboard falla con error claro (no muestra números incorrectos en silencio)
- [ ] **INFRA-04**: Migración a dominio propio (ej. `dashboard.tikin.co`) una vez estable

### Inicio

Pestaña de overview ejecutivo con KPIs principales del negocio.

- [ ] **INI-01**: Usuario ve KPI de GMV / Volumen total transado en el período seleccionado
- [ ] **INI-02**: Usuario ve KPI de Comisión / Revenue generado en el período (oculto en Modo Presentación)
- [ ] **INI-03**: Usuario ve KPI de Take rate % (oculto en Modo Presentación)
- [ ] **INI-04**: Usuario ve KPI de Empresas activas en el período (con ≥1 transacción)
- [ ] **INI-05**: Usuario ve KPI de Bonos emitidos / vendidos (count) en el período
- [ ] **INI-06**: Usuario ve gráfica de tendencia de GMV en el tiempo (barras diarias o semanales según período seleccionado)
- [ ] **INI-07**: Usuario ve gráfica de tendencia de Empresas activas en el tiempo

### Bonos

Pestaña de venta de bonos corporativos (revenue principal vía % de comisión).

- [ ] **BON-01**: Usuario ve gráfica de Bonos vendidos en el tiempo (línea o barras según período)
- [ ] **BON-02**: Usuario ve tabla de Ventas por empresa con nombre, # bonos, $ vendido, $ comisión, % del total. Columnas comisión y % ocultas en Modo Presentación
- [ ] **BON-03**: Usuario ve KPI de Ticket promedio por bono
- [ ] **BON-04**: Usuario ve KPI de Comisión total ganada en el período (oculto en Modo Presentación)
- [ ] **BON-05**: Usuario ve leaderboard Top 10 empresas por $ vendido en el período (oculto en Modo Presentación)

### Recargas

Pestaña de movimientos de recarga en la plataforma.

- [ ] **REC-01**: Usuario ve KPI de Total $ recargado en el período + tendencia
- [ ] **REC-02**: Usuario ve KPI de # de transacciones de recarga en el período
- [ ] **REC-03**: Usuario ve tabla de Recargas por empresa (top 10, ordenable y filtrable)

### Payouts

Pestaña de retiros (a tarjetas y a cuentas bancarias) más data de tiempos de payouts. Vista de mayor uso en presentaciones a clientes.

- [ ] **PAY-01**: Usuario ve KPI de # de payouts procesados + $ volumen en el período
- [ ] **PAY-02**: Usuario ve KPI de Tiempo medio (P50) hasta payout (de la hoja de tiempos existente)
- [ ] **PAY-03**: Usuario ve KPI de Tiempo P95 hasta payout (95% de los payouts se completan en menos de X)
- [ ] **PAY-04**: Usuario ve split por tipo de destino — tarjeta vs cuenta bancaria — en todas las métricas de Payouts
- [ ] **PAY-05**: Usuario ve histograma de latencia de payouts con buckets `<1h / 1-6h / 6-24h / >24h`

### Clientes

Pestaña de empresas corporativas: vista de lista + vista de perfil por empresa.

- [ ] **CLI-01**: Usuario ve tabla de empresas (nombre, fecha última actividad, total $ histórico, $ del período seleccionado)
- [ ] **CLI-02**: Usuario puede ordenar columnas de la tabla (por $, por recencia, por nombre)
- [ ] **CLI-03**: Usuario puede buscar empresa por nombre
- [ ] **CLI-04**: Usuario ve KPIs en cabecera de la pestaña — Total empresas + Empresas activas
- [ ] **CLI-05**: Usuario ve vista de perfil de una empresa con header (nombre, status, fecha última actividad)
- [ ] **CLI-06**: Usuario ve gráfica de actividad mensual de la empresa (últimos 12 meses, $ vendido por mes)
- [ ] **CLI-07**: Usuario ve mini-resumen de 3 cards (Bonos / Recargas / Payouts) en el perfil de empresa seleccionada
- [ ] **CLI-08**: Usuario tiene botón "Generar vista para cliente" que aplica filtro de empresa + activa Modo Presentación + lleva a pestaña Inicio

## v2 Requirements

Diferidos a futuro release. Reconocidos pero no en el roadmap actual.

### Cross-cutting

- **CROSS-V2-01**: Comparación período vs período (delta + flecha) en KPIs y gráficas
- **CROSS-V2-02**: Export a PDF con branding (logo + período en header) para screenshots post-llamada
- **CROSS-V2-03**: Print stylesheet — vista lista para imprimir / exportar a PDF nativo del browser

### Inicio

- **INI-V2-01**: YoY comparison — este mes vs mismo mes del año anterior (cuando haya ≥12 meses de data)
- **INI-V2-02**: Widget Top 5 empresas del período (uso interno, no presentación)

### Bonos

- **BON-V2-01**: Repeat-buyer cohort — % de empresas del período que también compraron el período anterior
- **BON-V2-02**: Sales by company segment (SMB / Mid / Enterprise por bandas de $)
- **BON-V2-03**: Overlay YoY — barras de este año + línea del año anterior

### Recargas

- **REC-V2-01**: Success rate % (requiere columna `status` en transacciones)
- **REC-V2-02**: Failures by cause / breakdown de motivos (requiere columna `failure_reason`)
- **REC-V2-03**: Recargas por canal / source — PSE, tarjeta, transferencia, etc. (requiere columna `channel`)
- **REC-V2-04**: Heatmap de día de semana / hora del día
- **REC-V2-05**: Repeat-recharge behavior — % empresas que recargaron ≥2x en período
- **REC-V2-06**: Avg ticket por recarga + tendencia

### Payouts

- **PAY-V2-01**: Success rate % (requiere columna `status` en transacciones)
- **PAY-V2-02**: Failures by cause / breakdown de motivos (requiere columna `failure_reason`)
- **PAY-V2-03**: SLA badges por tipo de destino — ej. "Tarjetas: 92% en <2h" / "Bancos: 88% en <24h"
- **PAY-V2-04**: Trend de P95 en el tiempo (¿estamos mejorando?)
- **PAY-V2-05**: Per-empresa payout health card — success%, P50, P95 filtrados a un cliente
- **PAY-V2-06**: In-flight / pending queue — count de payouts en curso + más antiguo pendiente

### Clientes

- **CLI-V2-01**: Health badge verde/amarillo/rojo basado en reglas (recencia + tendencia $)
- **CLI-V2-02**: Cohort retention (requiere `signup_date` por empresa)
- **CLI-V2-03**: Concentration view — top 10 empresas como % del GMV total + métrica HHI
- **CLI-V2-04**: Quarterly contribution view — este Q vs Q anterior vs mismo Q año anterior

## Out of Scope

Excluidos explícitamente. Documentados para evitar scope creep.

| Feature | Razón |
|---------|-------|
| Login por usuario (email/password individuales o OAuth) | Decidido en PROJECT.md: password compartido es suficiente para uso interno + presentaciones |
| Acceso 24/7 de clientes finales al dashboard | No es portal de cliente — solo se proyecta en llamadas comerciales |
| Multi-tenant con cuentas / vistas propias por cliente | Se resuelve filtrando data, no creando cuentas |
| Escritura / edición de data desde el dashboard | Solo lectura — Google Sheets sigue siendo la fuente de verdad |
| Integración directa con el sistema core de Tikin | Fuera de alcance en esta etapa; Sheets como fuente intermedia |
| Cache / refresh diferido | Lectura en vivo en cada page load — volumen de tráfico bajo justifica latencia |
| Versión móvil dedicada | Responsive básico es suficiente; uso primario es desktop / proyección |
| Real-time / WebSocket updates | Polling es overkill para uso interno; refresh manual + timestamp es suficiente |
| Drill-down a empleados / usuarios finales | PII — alto riesgo en pantalla compartida con cliente |
| ML forecasting / anomaly detection | Riesgo de alucinación en pantalla con cliente; data no suficientemente limpia |
| Botón de retry / acción manual sobre payouts fallidos | Solo lectura — acción operativa pertenece al sistema core |
| Dashboards configurables / drag-drop por usuario | Las 5 pestañas SON los dashboards; reinventar layout es scope creep |
| Alertas / notificaciones in-app por umbral | No es producto de monitoreo; alertas viven en email/Slack si se necesitan |
| Drill-down a lista cruda de transacciones | Riesgo de PII; este es un dashboard, no una herramienta de data |
| Per-user role-based widget visibility | Cubierto por Modo Presentación (one-toggle hides internal info) |
| Goal/target lines en gráficas ("deberíamos estar en $X") | Targets requieren governance que no se va a mantener; deltas período-vs-período cubren la dirección |

## Traceability

Qué fase cubre cada requirement.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CROSS-01 | Phase 1 | Pending |
| CROSS-02 | Phase 1 | Pending |
| CROSS-03 | Phase 1 | Pending |
| CROSS-04 | Phase 1 | Pending |
| CROSS-05 | Phase 1 | Pending |
| CROSS-06 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 5 | Pending |
| INI-01 | Phase 4 | Pending |
| INI-02 | Phase 4 | Pending |
| INI-03 | Phase 4 | Pending |
| INI-04 | Phase 4 | Pending |
| INI-05 | Phase 4 | Pending |
| INI-06 | Phase 4 | Pending |
| INI-07 | Phase 4 | Pending |
| BON-01 | Phase 2 | Pending |
| BON-02 | Phase 2 | Pending |
| BON-03 | Phase 2 | Pending |
| BON-04 | Phase 2 | Pending |
| BON-05 | Phase 2 | Pending |
| REC-01 | Phase 4 | Pending |
| REC-02 | Phase 4 | Pending |
| REC-03 | Phase 4 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| PAY-05 | Phase 3 | Pending |
| CLI-01 | Phase 5 | Pending |
| CLI-02 | Phase 5 | Pending |
| CLI-03 | Phase 5 | Pending |
| CLI-04 | Phase 5 | Pending |
| CLI-05 | Phase 5 | Pending |
| CLI-06 | Phase 5 | Pending |
| CLI-07 | Phase 5 | Pending |
| CLI-08 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0 ✓

**Distribución por fase:**
- Phase 1 (Foundation): 12 reqs (AUTH, INFRA-01/02/03, CROSS)
- Phase 2 (Bonos): 5 reqs (BON)
- Phase 3 (Payouts): 5 reqs (PAY)
- Phase 4 (Inicio + Recargas): 10 reqs (INI, REC)
- Phase 5 (Clientes + Domain): 9 reqs (CLI, INFRA-04)

## Notes on Data Assumptions

Estas suposiciones se hicieron al definir requirements. Si una resulta falsa al implementar, el requirement correspondiente se mueve a v2 o cambia de scope.

- **`status` (success / fail / pending) en transacciones** — no confirmado. Su filosofía declarada: "yo te pido la data como la quiero ver, no algo que no se pueda hacer". Por defecto v1 NO incluye success rate hasta que se confirme presencia o se agregue upstream. Se difirió a v2 (REC-V2-01, PAY-V2-01).
- **`failure_reason` en transacciones** — confirmado que NO existe y es difícil de agregar. Breakdown de causas de fallo queda en v2 hasta que cambie.
- **`destination_type` (tarjeta vs cuenta bancaria)** — confirmado que SÍ existe. Habilita PAY-04 en v1 (split por destino).
- **`signup_date` por empresa** — confirmado que NO existe. Cohort retention y "días desde onboarding" quedan fuera de v1.

---
*Requirements defined: 2026-04-27*
*Last updated: 2026-04-27 after roadmap mapping (41/41 mapped)*
