# Phase 3: Payouts - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<vision>
## How This Should Work

La pestaña Payouts es la pantalla más mostrada a clientes. Cuando un cliente la ve proyectada, los **tiempos P50/P95** son el héroe — son lo que el cliente paga por ver. Todo lo demás (count, $ volumen, split por destino, histograma) acompaña al relato central de "tu plata sale rápido".

El número P50/P95 se presenta en formato **compacto y técnico** (HH:MM:SS o equivalente). No hay "12 minutos" en lenguaje humano; hay precisión. La pantalla debe sentirse como un dashboard operacional real, no como una landing de marketing — y precisamente por eso transmite confianza al cliente.

El **histograma de latencia** (`<1h / 1-6h / 6-24h / >24h`) cuenta la historia de "la mayoría son inmediatos": el bucket `<1h` se ve visualmente dominante, los demás casi no aparecen. Es el momento "wow" de la demo. La narrativa visual refuerza al número.

</vision>

<essential>
## What Must Be Nailed

**Números incuestionables.**

Si una empresa pregunta "¿de qué sale ese P95?", debe poder defenderse línea por línea. No hay margen para off-by-one en el percentil, no hay payouts cancelados sumándose por error, no hay buckets de histograma corriendo de límites mal puestos. El cálculo es la pieza que justifica todo el resto — si los números no son sólidos, el polish visual da igual.

- Percentil computado con algoritmo industria-standard (R-7 / lineal interpolación), no truncado al índice ceil
- Filtro consistente: solo payouts que efectivamente se completaron (excluir cancelados / fallidos / pendientes)
- Buckets de histograma con límites explícitos y documentados (`<1h` = strictly less than 3600s, etc.)
- Mismo set de payouts alimenta count + $ + P50 + P95 + histograma — no hay agregadores que diverjan

</essential>

<specifics>
## Specific Ideas

- **P50/P95 layout**: KPIs grandes arriba como hero. Formato HH:MM:SS o ISO duration. Precisión técnica > calidez.
- **Histograma**: el bucket `<1h` debe verse contundentemente dominante. Cuidado con los gotchas de Recharts (zero-bars ocultos por default — usar `minPointSize` para que buckets vacíos sigan visibles con label).
- **Split tarjeta vs banco**: presente en TODAS las métricas (PAY-04). El histograma probablemente lo refleja como barras apiladas o agrupadas (a refinar en plan).
- **PAY-V2-01 success rate%** ENTRA en Phase 3 como KPI presenter-hidden (la data existe, costo marginal bajo, refuerza confianza interna del equipo Tikin).
- **PAY-V2-02 failure breakdown** NO entra en Phase 3 — diferido hasta tener más claridad sobre cómo se usaría en la conversación con cliente.
- **Modo Presentación**: success rate oculto, todos los demás widgets visibles (KPIs, histograma, split). El cliente ve la velocidad; no ve los porcentajes operativos del equipo.

</specifics>

<notes>
## Additional Context

**Vibe del producto en esta pantalla**: dashboard operacional sólido, no marketing. La confianza se transmite por precisión técnica + visual contundente, no por copywriting amable.

**Prioridad implícita**: correctness > polish. El research ya marcó que tres unknowns (`Aging` vs `Total Time` units, `Destination Medium` valores, `Holder` vs `tikintag`) requieren live data antes de escribir el schema — el plan los resuelve con diagnostic-then-cleanup en la primera task. Eso es consistente con "números incuestionables": no escribimos un schema sobre suposiciones.

**Out of scope de Phase 3** (queda para v2 o después):
- Failure breakdown / causas de fallo (PAY-V2-02)
- SLA badges per destino (PAY-V2-03)
- Trend de P95 en el tiempo (PAY-V2-04)
- Per-empresa payout health card (PAY-V2-05)
- In-flight queue de pendientes (PAY-V2-06)

</notes>

---

*Phase: 03-payouts*
*Context gathered: 2026-05-04*
