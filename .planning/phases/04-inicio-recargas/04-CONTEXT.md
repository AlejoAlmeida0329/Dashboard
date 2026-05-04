# Phase 4: Inicio + Recargas - Context

**Gathered:** 2026-05-04
**Status:** Ready for research

<vision>
## How This Should Work

`/inicio` no es un panel estático. Es un **highlight reel** — lectura editorial del negocio. Cuando alguien abre la pestaña, en 3 segundos lee una historia, no consulta una grilla de números.

La estructura tiene tres capas:

1. **Cinco KPIs grandes con delta vs período anterior**: GMV, Comisión/Revenue, Take rate %, Empresas activas, Bonos vendidos. Cada uno muestra su número del período + cuánto cambió respecto al período inmediatamente previo (si el filtro = "últimos 7 días", se compara contra los 7 previos; si = "abril 2026", contra "marzo 2026"). El delta refleja el filtro activo, no una ventana fija. Lectura: *"¿mejor o peor que antes?"*

2. **Dos gráficas de tendencia**: GMV en el tiempo y Empresas activas en el tiempo, sensibles al filtro de fecha.

3. **Tres "hechos curados"** (sección narrativa, vista interna Tikin):
   - **Top empresa del período** — quién generó más GMV o creció más
   - **Latencia destacada** — P50 de payouts del período + cómo se compara con el período anterior
   - **Empresas nuevas activadas** — empresas con su primera actividad-de-siempre dentro del período

`/recargas` también es highlight reel, no un mirror funcional de Bonos. Mantiene consistencia narrativa con Inicio: KPIs con deltas + 1-2 hechos curados propios (top empresa recargadora, recarga más grande del período) + tabla top 10. Recargas no es la pestaña estrella, pero respeta la voz editorial del proyecto.

</vision>

<essential>
## What Must Be Nailed

**Inicio en cliente-foco (`?presenter=1&empresa=$X`) tiene que verse impecable.** Esa vista es lo que un cliente leerá primero cuando se le genere su URL personalizada (CLI-08 en Phase 5). Si esa vista narra bien la historia del cliente, el dashboard cumple su propósito principal.

Versión interna de Inicio puede recortarse si hace falta — pero la cliente-foco no.

**Contrato de cliente-foco** (filtro empresa activo + presenter on):

- Los **3 hechos curados se ocultan TODOS** — son lectura interna de Tikin (top empresa, empresas nuevas → no tienen sentido cuando el cliente es la única empresa visible; latencia se mantiene como sería redundante con la pestaña Payouts).
- Quedan los **5 KPIs con sus deltas** (ya filtrados a esa empresa) + las **2 gráficas de tendencia** con su data.
- Modo Presentación además **oculta Comisión y Take rate** (por roadmap) — incluso en cliente-foco. El cliente ve GMV, Empresas activas (degenerada a 1), Bonos vendidos.

- [Esencial 1] Cliente-foco de `/inicio` se ve narrativo, limpio, sin elementos huérfanos
- [Esencial 2] Los 5 KPIs con deltas calculados correctamente sobre la ventana del filtro activo
- [Esencial 3] Recargas existe con KPIs + tabla top 10 — no bloquea Phase 5

</essential>

<specifics>
## Specific Ideas

**Delta logic** = "mismo período, atrás":
- Filtro = "últimos 7 días" → compara contra los 7 días previos
- Filtro = "abril 2026" → compara contra "marzo 2026" (ventana del mismo tamaño, inmediatamente previa)
- Filtro custom (ej. 5 días arbitrarios) → ventana de 5 días previa al `from` del filtro

**Hechos curados de Inicio** (vista interna):
- *Top empresa del período* — definir en research/plan si es por mayor GMV absoluto o por mayor crecimiento; user-aceptado que Claude proponga
- *Latencia destacada* — P50 de payouts del período + delta vs período anterior; reúsa la lógica de Phase 3
- *Empresas nuevas activadas* — empresas cuya **primera transacción de siempre** cae dentro del período. Esto requiere comparar contra el dataset histórico completo, no solo el período. Si resulta caro, recortar antes que sacrificar cliente-foco

**Hechos curados de Recargas** (vista interna):
- Top empresa recargadora del período
- Recarga más grande del período (monto + empresa + fecha)

**Caso degenerado en cliente-foco**: la gráfica "Empresas activas en el tiempo" siempre será 1 cuando hay filtro de empresa. Decisión a tomar en el plan: ocultarla o reemplazarla por otra métrica útil para el cliente (ej. "Tu actividad en el tiempo" mostrando count de transacciones, o un mini-resumen de pestañas).

**Consistencia visual**: las dos pestañas (Inicio + Recargas) deben sentirse del mismo proyecto que /bonos y /payouts — formatos COP / Intl / time, tipografía mono+tabular-nums para deltas (mismo principio que P50/P95 de Payouts), KPIs en cards.

</specifics>

<notes>
## Additional Context

**Por qué "highlight reel" sobre "panel ejecutivo"**: el user explícitamente rechazó la opción de Inicio como pulso ejecutivo (5 números arriba + 2 curvas) por sentirlo demasiado "panel de control" y prefirió la lectura editorial. El dashboard debe tener voz, no parecer Jira ni Notion (consistente con la sensibilidad ya establecida en Phase 1: clean, calmado, no corporate).

**Por qué cliente-foco es la esencia**: Phase 5 (CLI-08 "Generar vista para cliente") cierra el flow de presentación end-to-end. El botón aplicará filtro de empresa + activará Modo Presentación + navegará a /inicio. Si /inicio cliente-foco no narra bien, todo el flow se siente flojo. Por eso Phase 4 prioriza esa vista sobre la versión interna.

**Recargas no es el héroe**: la decisión de mantener consistencia narrativa con Inicio (highlight reel también) es por estética del producto, no porque Recargas sea pestaña estrella. Si en plan el costo de hechos curados de Recargas se vuelve desproporcionado, recortar primero ahí — Inicio no.

**Riesgo de scope**: el "highlight reel" expande el alcance original del roadmap (que solo pedía 5 KPIs + 2 gráficas). Los deltas + 3 hechos curados + variantes en Recargas suman superficie. El plan-author debe evaluar si esto cabe en plans atomicos del tamaño habitual o requiere splitting más agresivo. La regla de cliente-foco-impecable da la heurística de qué cortar si no cabe.

**Alineación con Phase 5**: Inicio populado con cliente-foco impecable es **precondición** para que CLI-08 cierre bien. Phase 5 hereda este contrato sin re-trabajo.

</notes>

---

*Phase: 04-inicio-recargas*
*Context gathered: 2026-05-04*
