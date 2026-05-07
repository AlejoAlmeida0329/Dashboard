# Phase 7: Bonos + Payouts (rebuilt + extended) - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<vision>
## How This Should Work

Phase 7 reconstruye dos pestañas que ya existían en v1.0, pero esta vez cada una **cuenta su propia historia** — no son dashboards gemelos. Se sienten como dos productos distintos compartiendo el mismo design system.

**Bonos** se siente como una **red social interna**. Cuando alguien entra a la pestaña, lo primero que ve es **quién está dando y quién está recibiendo**: rankings de top emisores y top receptores son la pieza central de la pantalla. La pregunta que la pestaña responde es "¿quién está más activo regalando vs recibiendo bonos?". Los KPIs agregados (volumen, ticket promedio) y la línea temporal son contexto, no protagonistas.

**Payouts** se siente como una **vista operativa de eficiencia**. Cuando alguien entra, la pregunta primaria es "¿qué tan rápido procesamos?" — tiempo promedio, P50/P95, y el aging alert (>2h pendientes) dominan la primera mitad de la pantalla. La calidad del flujo (3 KPIs por estado, tasa de éxito) y el diagnóstico (bancos, razones de fallo, terceros) son capas posteriores que profundizan la respuesta inicial.

Visualmente, ambas pestañas se sienten **densas, no huecas**. v1.0 tenía mucho whitespace y pocas métricas simultáneas. v2.0 debe sentirse como un dashboard real — más información por pantalla, menos clicks para llegar a una respuesta. Como un cockpit, no como una landing page.

</vision>

<essential>
## What Must Be Nailed

- **Bonos: ranking-first** — top emisores y top receptores son visualmente protagonistas. No enterrados al fondo en tablas secundarias. El "quién" es la respuesta principal de la pestaña.
- **Payouts: time-first** — tiempo promedio + aging alert dominan el primer scroll. La pregunta de velocidad se responde antes que cualquier desglose de calidad o diagnóstico.
- **Densidad informativa** — más métricas por pantalla que v1.0, sin caos. La pantalla debe sentirse "llena" pero estructurada. Whitespace estratégico, no por defecto.

</essential>

<specifics>
## Specific Ideas

- **No son gemelos** — aunque ambas comparten el design system v2.0 (paleta por sección de Phase 6: Bonos Violet, Payouts Cyan), su layout y jerarquía visual son distintos. Bonos arranca con tablas/rankings; Payouts arranca con KPIs grandes + alerts.
- **Cockpit-feel** — densidad como dashboard operativo real, no como un slide deck. Compactar información sin sacrificar legibilidad.
- **Capas en Payouts** — primera capa: velocidad. Segunda capa: calidad (semáforo por estado). Tercera capa: diagnóstico (bancos, fallos, terceros). El usuario que solo lee el primer scroll ya tiene una respuesta operativa útil.

</specifics>

<notes>
## Additional Context

- 15 requirements en total: 7 en Bonos (BON-V2-01..07) + 8 en Payouts (PAY-V2-01..08).
- Phase 7 depende de Phase 6 (cerrada): parsers de tiempo en minutos, JOIN canónico (`joinPayouts()` para PAY-V2-08 pagos a terceros), filtros globales URL-persistidos, paleta por sección.
- Las dos secciones son independientes entre sí — pueden plan-arse en orden serial sin compartir code paths críticos. Sí comparten el principio narrativo del milestone v2.0 (lente operativa).
- v1.0 ya tenía implementaciones funcionales de ambas pestañas (Phase 2 Bonos, Phase 3 Payouts). El rebuild reutiliza la fundación de domain libraries pero rediseña layout + métricas según PRD v2.

</notes>

---

*Phase: 07-bonos-payouts*
*Context gathered: 2026-05-07*
