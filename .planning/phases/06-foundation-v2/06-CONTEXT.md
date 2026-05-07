# Phase 6: Foundation v2 - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<vision>
## How This Should Work

Foundation v2 entrega la **plomería cross-cutting** que todas las secciones de v2.0 (Phases 7-10) van a heredar. Cuando esté lista, abrir cualquier pestaña debe sentirse cohesivo y los datos deben ser confiables — la fundación es invisible cuando funciona y dolorosa cuando no.

Las tres lentes son igualmente importantes:

1. **Datos confiables primero** — parsing de campos texto del Sheet (`parseAging`, `parseTotalTime`, `parseCOPAmount`) y JOIN canónico `transaction_id ↔ Transaction ID` funcionan correctamente. Las phases 7-9 simplemente consumen datos limpios.
2. **Sensación cohesiva del dashboard** — dark mode site-wide con toggle, paleta por sección aplicada consistentemente (Indigo · Violet · Cyan · Amber · Emerald · Teal), filtros globales en top bar. Cualquier pestaña abierta se siente parte del mismo producto.
3. **Flexibilidad para dual-purpose** — sistema `data-presenter-metric-hide` por métrica habilita que Vista Cliente (Phase 9) sea presentable a clientes ocultando ciertas métricas en `presenter=1`.

</vision>

<essential>
## What Must Be Nailed

**Parsing + JOIN es el cimiento** — si esto falla, todas las métricas de v2.0 son basura. Lo demás (paleta, dark mode, filtros, visibility) puede iterar después si hace falta. Esto NO.

- **`parseAging()` y `parseTotalTime()`** convierten strings tipo `'X years X mons X days X hours X mins X secs'` a minutos correctamente para todos los formatos del Sheet
- **`parseCOPAmount()`** convierte strings `'COP X,XXX.XX'` a number correctamente, edge cases incluidos (negativos, ceros, vacíos)
- **`joinPayouts()`** retorna 773/798 (96.9%) match usando `BD_Plataforma.transaction_id ↔ BD_Payouts.Transaction ID` — verificación CROSS-V2-04 ya validada históricamente

</essential>

<specifics>
## Specific Ideas

**Dark mode:**
- Toggle visible + persistente (header o sidebar — claramente visible)
- Default: respeta preferencia del OS en primera visita
- Persiste por usuario site-wide

**Filtros globales extendidos:**
- Top bar persistente site-wide (patrón tipo Linear / Datadog)
- Date-range + estado de transacción (multi-select) + tipo de transacción (multi-select)
- Cambio en la barra afecta a TODAS las pestañas
- Estado persiste via URL `searchParams`

**Sistema de visibility por métrica:**
- Default: **toda métrica visible** en `presenter=1`
- Opt-out individual: solo se ocultan métricas marcadas explícitamente con `data-presenter-metric-hide`
- Conservador — nada se "pierde" por accidente al proyectar a clientes
- Extiende el sistema de Phase 5 v1.0 (cliente-foco share-URL)

**Paleta por sección:**
- Inicio Indigo · Bonos Violet · Payouts Cyan · Tarjeta Amber · Clientes Emerald · Recargas Teal
- Colores de estado: Verde (completed) · Rojo (failed) · Amarillo (in_progress)

</specifics>

<notes>
## Additional Context

**Equilibrio de las tres lentes:** El usuario eligió "todo equilibrado" — datos confiables + cohesión visual + flexibilidad dual-purpose pesan igual. Sin embargo, al sharpen-the-core, identificó parsing/JOIN como el único punto donde NO se puede fallar. Esto significa: planifica las tres áreas con calidad pareja, pero si hay que hacer trade-off de tiempo, el parsing/JOIN gana.

**Reutilización de v1.0:** El visibility system extiende lo que ya existe de v1.0 (cliente-foco share-URL con `presenter=1`). Dark mode, paleta y filtros refinan el design system aprobado — no rompen, refinan.

**Posibles unknowns para research:**
- Tailwind v4 + shadcn dark mode pattern (next-themes)
- Edge cases de parsing en formatos PostgreSQL interval-like (¿hay variantes raras en el Sheet?)
- Schema validation con Zod para los nuevos campos texto

</notes>

---

*Phase: 06-foundation-v2*
*Context gathered: 2026-05-07*
