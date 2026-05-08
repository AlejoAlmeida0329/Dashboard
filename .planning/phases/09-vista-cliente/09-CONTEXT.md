# Phase 9: Vista Cliente — Context

**Gathered:** 2026-05-07
**Status:** Ready for research

<vision>
## How This Should Work

Vista Cliente se siente como **el dossier ejecutivo del cliente**. Cuando seleccionas un tikintag (de los 235 usuarios), abres el expediente completo de esa persona en una sola pantalla densa: arriba todo lo importante a un golpe de vista (cabecera de KPIs), abajo el detalle desplegado por dimensión (retiros banco, P2P, compras tarjeta, bonos, timeline).

La pantalla tiene una segunda personalidad — **dual-purpose invisible al cliente**. En modo presentación (`?empresa=$X&presenter=1`) el cliente ve una vista limpia y profesional pensada para él, sin sospechar que existe otro modo. En modo interno tú ves todo el contexto extra sin fricción: timeline cronológico, razones de fallo crudas en payouts, comparativos vs otros clientes, anomalías detectadas. Mismo URL base, dos experiencias radicalmente distintas según el flag.

El selector de tikintag es el switch principal de la sección — cambias de cliente y todo el dossier se reconfigura. El URL persiste la selección para que un share-link te lleve al cliente exacto en el modo correcto.

</vision>

<essential>
## What Must Be Nailed

- **Cabecera de 6 KPIs perfecta en 2 segundos** — Balance · Primera tx · Última actividad · Total tx · Pocket activo · **Tiempo vs benchmark** (con treatment especial: color/borde que lo distingue del resto). Si el header no es legible y jerárquico al instante, el resto del dossier no importa. Es lo primero que cliente y tú ven.

- **Benchmark vs plataforma como argumento de eficiencia** — el sexto KPI (tiempo del cliente vs promedio de la plataforma) es **el momento de venta** en reuniones. No vive como hero card aislado; vive embebido en la cabecera con jerarquía visual elevada. Siempre visible en presenter.

- **Dual-purpose verdaderamente invisible** — el cliente nunca debería sospechar que hay un "modo". La vista que ve en presentación se siente como una vista limpia diseñada para él, no como una versión censurada de algo más completo. La diferencia entre modos es contexto operativo agregado en interno, no contenido removido visiblemente.

</essential>

<specifics>
## Specific Ideas

**Composición del KPI strip:**
- 6 KPIs en una fila (los 5 originales del PRD v2 + benchmark)
- Benchmark con treatment especial (color/borde) que lo distingue sin romper la uniformidad

**Qué revela el modo interno (más allá del timeline que ya marca el roadmap):**
- **Timeline cronológico crudo** — toda la actividad del usuario con ícono por tipo (presenter-hide explícito del roadmap)
- **Razones de fallo crudas en payouts** — en presenter ves "Failed: 3"; en interno ves la columna completa con razón específica por transacción (Balance insuficiente, banco rechazó, etc.)
- **Comparativos vs otros clientes** — posición del cliente en ranking interno, percentiles. Argumento que NO compartes con el cliente pero usas internamente para entender dónde está parado
- **Patrones / anomalías detectadas** — alertas de comportamiento atípico, flags internos. Inteligencia operativa.

**Esto extiende el alcance presenter-hide del roadmap** — no es solo timeline, son cuatro capas de intelligence interna. La disciplina del roadmap (presenter-hide solo timeline) era el mínimo; la visión real es un layer interno más rico.

**Selector tikintag:**
- Dropdown principal de la sección con los 235 usuarios
- Persiste vía URL searchParams (consistente con cliente-foco share-URL del v1.0)
- Cambio de cliente reconfigura todo el dossier sin recarga

</specifics>

<notes>
## Additional Context

**Relación con el roadmap original:**
El roadmap especifica timeline como única sección presenter-hide. La visión del usuario amplía esto: presenter-hide cubre cuatro capas (timeline + razones de fallo crudas + comparativos vs otros + patrones/anomalías). Investigar durante research/planning si esta expansión requiere ajustar success criterion #6 del roadmap, o si se modela como sistema generalizado de visibility por métrica (consistente con CROSS-V2-07 de Phase 6).

**Carry-forward de Phase 8:**
22 símbolos v1 deferidos en 3 módulos esperan consolidación final aquí (bonos.ts: 8, payouts.ts: 4, recargas.ts: 10). La Vista Cliente reutiliza domain libraries de las secciones — Phase 9 es el momento natural para limpiar lo que quedó deferido.

**Disciplina dual-purpose:**
El énfasis del usuario en "invisible al cliente, obvio para ti" es la guía de UX cuando haya ambigüedad sobre cómo presentar algo en presenter mode. Default: si el cliente puede sospechar que hay algo oculto, está mal diseñado.

</notes>

---

*Phase: 09-vista-cliente*
*Context gathered: 2026-05-07*
