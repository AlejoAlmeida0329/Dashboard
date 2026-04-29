# Phase 2: Bonos - Context

**Gathered:** 2026-04-29
**Status:** Ready for research

<vision>
## How This Should Work

Cuando alguien abre la pestaña Bonos, lo primero que ve son dos KPIs en la cabecera (Ticket promedio por bono y Comisión total ganada en el período) y, debajo, la heroína: una **gráfica de línea simple** mostrando bonos vendidos en el tiempo. Limpia, calmada, fácil de leer. Es la pestaña que cuenta una historia de momentum.

Debajo de la gráfica vienen los detalles que soportan esa historia: el leaderboard Top 10 empresas a un lado y la tabla de ventas por empresa al otro (# bonos, $ vendido, $ comisión, % del total).

El momento clave de esta pestaña es cuando se activa Modo Presentación con un filtro de empresa puesto: la pestaña se transforma en una **vista 1-cliente**. El KPI de Ticket promedio refleja solo a esa empresa, la gráfica hero muestra solo la tendencia de ese cliente, y la tabla queda con sus bonos sin las columnas sensibles ($ comisión y % del total ocultas, KPI Comisión oculto, leaderboard oculto). El cliente siente que el dashboard es "suyo" — no es una hoja interna donde lo metieron, es su propia vista.

</vision>

<essential>
## What Must Be Nailed

Las tres dimensiones son críticas — ninguna sobresale, todas deben funcionar:

- **Vista cliente fluida** — Activar Modo Presentación + filtro empresa debe transformar la pestaña en una historia orgullosa que el cliente siente como suya. Sin glitches al cambiar entre interno y proyección.
- **Tendencia confiable** — La gráfica hero refleja exactamente lo que pasó. Sin ruido, sin números que no cuadren. La credibilidad del dashboard se gana ahí.
- **Revenue claro** — En vista interna (sin Modo Presentación), el equipo Tikin ve de un vistazo qué empresa genera cuánta comisión. Es la pestaña más consultada internamente porque ahí se ve el revenue.

</essential>

<specifics>
## Specific Ideas

- **Layout "tendencia primero"**: KPIs arriba en la cabecera, gráfica hero protagonista en el centro, leaderboard + tabla en la base.
- **Gráfica hero = línea simple**, no stacked, no barras. Una sola línea calmada de bonos vendidos en el tiempo.
- **Modo Presentación + filtro empresa = vista cliente foco**: la pestaña entera se reescribe alrededor de esa empresa, no solo "censura" datos sensibles del layout global.
- **Comportamiento de ocultamiento en Modo Presentación** (del roadmap): KPI Comisión total oculto, columnas $ comisión y % del total ocultas en tabla, leaderboard Top 10 oculto.

</specifics>

<notes>
## Additional Context

- **Audiencia dual**: La pestaña sirve a dos audiencias en momentos distintos. Vista interna = equipo Tikin viendo revenue. Vista proyección (Modo Presentación + filtro empresa) = cliente viendo su propia operación. El mismo código sirve a ambos contextos vía el switch del filtro.
- **Revenue principal del negocio**: Bonos es la pestaña más cargada de revenue para Tikin (vs Recargas, Payouts). Su credibilidad numérica importa más que en otras pestañas.
- **Primera pestaña con data real**: Phase 1 dejó solo el esqueleto (auth + adapter + filtros + Modo Presentación). Phase 2 es la primera vez que el dashboard muestra datos genuinos del negocio — el patrón que se establezca aquí (cómo se computa, cómo se rinde, cómo se siente) lo heredan Phases 3-5.

</notes>

---

*Phase: 02-bonos*
*Context gathered: 2026-04-29*
