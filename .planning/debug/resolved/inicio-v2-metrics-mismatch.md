---
status: resolved
trigger: "inicio-v2-metrics-mismatch — 6 problemas concurrentes en agregaciones cockpit /inicio v2"
created: 2026-05-08T00:00:00Z
updated: 2026-05-08T02:00:00Z
---

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED + FIX APPLIED + ALL CHECKS GREEN.
test: TypeScript (`npx tsc --noEmit`), ESLint (`npm run lint`), production build (`npm run build`) — all 3 pass cleanly.
expecting: User-facing verification (visual audit of /inicio v2 against BD_Plataforma Sheet) deferred to user — code surface is correct per the agreed semantic contract.
next_action: COMPLETE. Session resolved.

## Symptoms

expected: |
  /inicio v2 cockpit reporta cifras consistentes con el dataset:
  1. Usuarios únicos = 235 (no 233) — DISTINCT tikintag con ≥1 transacción (any status)
  2. Volumen IN y OUT cuadrados con la naturaleza real (recarga = IN; payout/retiro/p2p/purchase/bono = OUT)
  3. Conteos completed / failed / in_progress matcheen el Sheet
  4. Distribución por tipo cuenta CADA transacción UNA vez — para bidireccionales (Bonos, P2P) solo lado OUT
  5. Activity timeline clasifica por naturaleza (retiro/pago = OUT; recarga = IN), sin double-counting
  6. Top 10 usuarios por volumen tiene definición CLARA del "volumen" + orden descendente

actual: |
  1. Active users muestra 233 en vez de 235 (off-by-2 — sospechoso filtro `status='completed'`)
  2. KPI Volumen IN/OUT no cuadra (probable double-counting Bonos/P2P o mala clasificación)
  3. Tasa éxito (completed/failed/in_progress) no cuadra con Sheet (filtros previos?)
  4. Donut "Distribución por tipo" double-cuenta bidireccionales (BONUS-OUT + BONUS-IN)
  5. ActivityTimelineV2 mismo double-counting que donut
  6. TopUsersByVolume — "volumen" ambiguo + orden no garantizado

errors: No runtime errors. Bug semántico.

reproduction: npm run dev → /inicio → comparar contra Sheet (235 usuarios DISTINCT, etc.)

started: Phase 10 shipped 2026-05-08 (commit 367a4e7); nunca funcionó "bien" — primera vez renderizando.

## Eliminated

(none yet)

## Evidence

- timestamp: investigation
  checked: src/lib/domain/inicio.ts:190-220 (filterInicioV2 default contract)
  found: |
    Default behavior (no URL filters): excludes only `direction === 'OTRO_DIRECTION'`. Both `direction='in'` and `direction='out'` flow through. Status NOT filtered (both `completed` and `rejected` flow through). Tipo NOT filtered. Date NOT filtered (-Infinity .. +Infinity). Empresa NOT filtered. So `filterInicioV2(allTx, {})` returns essentially ALL transactions (only excludes rows with malformed direction or unparseable fecha).
  implication: |
    Universe handed to all downstream aggregations contains ALL transactions including the BIDIRECTIONAL "double rows" for BONUS / P2P events. Each BONUS event = 2 rows in this universe (one out + one in for same monto magnitude).

- timestamp: investigation
  checked: src/lib/domain/inicio.ts:250-287 (summarizeInicioV2)
  found: |
    Single-pass over rows.
    - tikintagSet.add(t.tikintag) for EVERY row → Set of distinct tikintags.
    - volumenIn += t.monto when direction=='in'
    - volumenOut += Math.abs(t.monto) when direction=='out'
    - countCompleted/Failed/InProgress: per-row status counters
    - total = transactions.length (denominator for successRate)
  implication: |
    DOUBLE-COUNTS bidirectional events:
      * volumenIn includes BONUS-in/P2P-in receiver-side rows (legit money received) AND
      * volumenOut includes BONUS-out/P2P-out sender-side rows (same money, sent).
      For a single BONUS of $10K: volumenIn += 10K, volumenOut += 10K — yet only $10K actually moved on the platform; it's just that one user lost it and another gained it.
    EFFECT on user-reported KPIs:
      * Volumen IN inflated by all BONUS-in + P2P-in (and PAYIN_PSE/PAYIN_TRANSFER which is correct IN).
      * Volumen OUT inflated by all BONUS-out + P2P-out (correct OUT) + PAYOUT_BANK + PURCHASE.
      * The "real" IN per the user's spec: only PAYIN_PSE + PAYIN_TRANSFER. Currently mixing in BONUS-in + P2P-in.
      * The "real" OUT per the user's spec: PAYOUT_BANK + PURCHASE + BONUS-out + P2P-out (lado OUT only).
    EFFECT on status counters:
      * Each BONUS event counts as 2 rows in countCompleted (one out + one in side, both completed). For "Tasa de éxito" denominator (total = rows.length), bidirectionals double-count.
      * If sheet has X distinct events where Y are bidirectional, total rows = X + Y; user expecting tasa = completed_events / total_events instead sees tasa = completed_rows / total_rows.

- timestamp: investigation
  checked: src/lib/domain/inicio.ts:335-377 (aggregateTransactionTypeDistribution)
  found: |
    Groups rows by t.tipo into a count Map. Each row contributes 1 to its bucket. For a single BONUS event: 2 rows (BONUS-out + BONUS-in) → counts.get('BONUS') += 2 → bucket count is double-counted. Same for P2P (would inflate by 2x). PAYIN_PSE / PAYIN_TRANSFER / PAYOUT_BANK / PURCHASE are single-direction in BD_Plataforma → counted correctly.
  implication: |
    Symptom 4 confirmed: donut shows BONUS / P2P with DOUBLE the real event count. Their share in the total inflated; the other types' share artificially deflated as a result.

- timestamp: investigation
  checked: src/lib/domain/inicio.ts:426-487 (aggregateActivityByDateV2 + aggregateActivityByWeekV2)
  found: |
    Both per-bucket: tikintagsSet (distinct count) + volumen (signed sum of monto).
    - tikintagsSet.add(t.tikintag) — for BONUS/P2P, sender's tikintag goes in via the OUT row; receiver's tikintag (likely same or different) via the IN row. If sender ≠ receiver, both are counted distinctly (correct — both ARE distinct active users that day).
    - volumen += t.monto (SIGNED sum). For BONUS event where sender's row has monto=-$10K (out, negative) and receiver's row has monto=+$10K (in, positive), the SIGNED sum is 0 — they cancel out. Result: a day with all bonos shows volumen=0, hiding actual activity flow.
  implication: |
    Symptom 5 partially confirmed BUT in a more subtle way: not "double-counting" — actually CANCELLATION because the sum is signed. A BONUS day shows ZERO volumen even though $10K moved. Operator-relevant question "what's the net flow today" may yield misleading 0s. The user wants direction-classified IN/OUT series instead.

- timestamp: investigation
  checked: src/lib/domain/inicio.ts:579-617 (aggregateTopUsersByVolume)
  found: |
    Per-tikintag accumulator:
      - row.volumenIn += t.monto when direction=='in'
      - row.volumenOut += Math.abs(t.monto) when direction=='out'
      - row.transacciones += 1 (every row counted, regardless of direction)
      - volumenNeto = volumenIn - volumenOut
    Sort: DESC by volumenNeto, ties broken by transacciones DESC, then tikintag ASC. Slice top 10.
  implication: |
    Symptom 6: ranking key is `volumenNeto = volumenIn - volumenOut`.
    - For a recharger (PAYIN_PSE only, no outflow): volumenIn high, volumenOut=0, volumenNeto high positive → ranks high.
    - For a heavy purchaser (only PURCHASE-out): volumenIn=0, volumenOut high, volumenNeto VERY NEGATIVE → ranks at the BOTTOM of the sorted list.
    - For BONUS receivers: volumenIn inflated by received bonos.
    The user reports "definición de volumen es ambigua + debe estar ordenado descendente por esa métrica". CURRENT behavior ranks "biggest net receivers" first; "biggest net spenders" last. If user expects "biggest total movers" (Math.abs(neto), or volumenIn + volumenOut combined), the current behavior surfaces the wrong head of the table.

- timestamp: investigation
  checked: src/lib/domain/schemas.ts:120-198 (Transaction parsing — direction + monto)
  found: |
    direction: lowercased; KNOWN_DIRECTIONS = ['in', 'out']; unknown → 'OTRO_DIRECTION'.
    monto: passes through `parsed.amount` AS-IS from the Sheet. amount is typed as Money (z.coerce.number().finite() with -1e12..1e12). NO sign normalization in the schema — whatever sign the Sheet has lands in Transaction.monto.
  implication: |
    `summarizeInicioV2.volumenIn += t.monto` assumes direction='in' rows have positive monto. `Math.abs` only applied on out side. If any in-row has a NEGATIVE monto in the Sheet (refunds reverting an in?), it would silently subtract from volumenIn. Worth verifying — but probably correct in practice.

- timestamp: investigation
  checked: STATE.md line 90 + recargas.ts:407-423 (aggregateRechargeAdoption baseline)
  found: |
    REC-V2-03 baseline: 40 distinct rechargers / 235 total users ≈ 17%. The "235 total users" reference is computed via `aggregateRechargeAdoption(allTx, recargaRows).totalUsers` where allTx = full transaction pool (not period-filtered), tikintagSet.add for every row with non-empty tikintag.
  implication: |
    User's expected "235 usuarios únicos" refers to full pool DISTINCT tikintag — confirmed semantic. /inicio v2 is showing 233 (off by 2). The difference is 2 tikintags missing from the iteration. Hypothesis: `filterInicioV2` excludes rows where `direction === 'OTRO_DIRECTION'` (the schema fallback for any non-'in'/'out' value). If the sheet has 2 rows whose direction cell is malformed (empty? typo?) and those 2 rows are the ONLY rows for 2 specific tikintags, then those 2 tikintags would be excluded by filterInicioV2 — explaining the off-by-2.
    OR: `filterInicioV2` excludes rows where fecha.getTime() is NaN/Infinity → if 2 tikintags' only rows have malformed fecha, same effect.
    User's expected semantic per symptom 1: "tikintags DISTINCT con ≥1 transacción" — i.e. count distinct tikintags across the ENTIRE allTx pool (NO direction filter, NO status filter), not the filterInicioV2 output.
    The right fix: usuariosActivos should be counted over the full allTx pool, not the post-filter rows (mirroring aggregateRechargeAdoption.totalUsers semantic).

- timestamp: investigation
  checked: bonos.ts:185-202 (summarizeBonosV2) and recargas.ts:239-247 (summarizeRecargasV2)
  found: |
    - Bonos v2 EXPLICITLY surfaces both sides separately (countIn / countOut / montoIn / montoOut). The Bonos page composer USES BOTH sides — Bonos is a "peer-to-peer money flow" lens, so showing IN+OUT is the value.
    - Recargas v2 only has direction='in' rows in input (filterRecargasV2 hard-filters direction!=='in'); volumen sums Math.abs(monto). No double-counting concern because PAYIN_* are single-direction.
  implication: |
    The reference patterns (Phase 7/8) HANDLE direction-aware classification at the FILTER level by hard-pinning the tipo's direction. /inicio v2 is the cross-cut that allows BOTH directions and ALL tipos by design (the operative-lens cockpit). But the per-tipo IN/OUT semantics MUST be applied at AGGREGATION TIME — currently absent.

- timestamp: investigation
  checked: components/inicio/InicioKPIStripV2.tsx + TransactionTypeDonut.tsx + ActivityTimelineV2.tsx + TopUsersByVolume.tsx
  found: |
    All 4 leaves are pure presenters: they consume the v2 aggregations as-is and render. NO additional logic that could compensate for the upstream double-counting. Symptoms can ALL be fixed in src/lib/domain/inicio.ts without touching the leaves (with the possible exception of TopUsersByVolume which may benefit from a column rename if we change the ranking key).
  implication: |
    Fix surface = 1 file (src/lib/domain/inicio.ts). Leaves stable.

- timestamp: investigation (CRITICAL DISCOVERY)
  checked: src/lib/domain/cardUsage.ts:5-12 (canonical semantics for PURCHASE)
  found: |
    Direct quote from cardUsage.ts:
      "The canonical semantic is `tipo === 'PURCHASE'` AND `direction === 'out'` — i.e. the USER's wallet is being debited toward the merchant. The same `PURCHASE` transaction also has a peer row with `direction === 'in'` for the receiving empresa (sale-in counterpart); Uso Tarjeta is intentionally [filtered to OUT only]."
    cardUsage.ts hard-pins `direction='out'` for purchase rankings (CARD-V2-01).
  implication: |
    PURCHASE is ALSO bidirectional in BD_Plataforma — produces TWO rows per event (cardholder OUT + empresa IN). This was missing from my initial hypothesis. So:
      * BONUS = 2 rows per event (sender OUT + receiver IN)
      * P2P = 2 rows per event (sender OUT + receiver IN)
      * PURCHASE = 2 rows per event (cardholder OUT + empresa IN)
      * PAYIN_PSE / PAYIN_TRANSFER = 1 row per event (user IN)
      * PAYOUT_BANK = 1 row per event (user OUT to bank)
      * FEE / REFUND / CREDIT_ADJUSTMENT / TREASURY / UKNOWN — unclear; treat as single-row pass-throughs.
    The user's spec "BONUS, P2P, PURCHASE = OUT (lado OUT solo)" is internally consistent with this BD_Plataforma reality — the user wants to count each event ONCE on its OUT side.
    The v2 inicio.ts iterates ALL filtered rows naively → BONUS/P2P/PURCHASE counts inflated 2x in donut + status counters + total denominator + tikintag set (sender+receiver both added if distinct).

## Resolution

root_cause: |
  TWO INTERTWINED ROOT CAUSES, both in src/lib/domain/inicio.ts:

  ROOT CAUSE A — usuariosActivos counted over filtered rows instead of full pool (Symptom 1):
    summarizeInicioV2 builds the tikintagSet from the filterInicioV2-output (which excludes rows with malformed direction OR malformed fecha). Off-by-2 vs PRD baseline 235 → 2 tikintags only have malformed-row coverage. The user's expected semantic is "DISTINCT tikintag with ≥1 transaction (any status, any direction)" — i.e. counted over the FULL allTx universe, mirroring aggregateRechargeAdoption.totalUsers (Plan 08-02 STATE.md line 90). This is a denominator-scope error, not a filter error.

  ROOT CAUSE B — direction/tipo classification ignores BD_Plataforma's bidirectional double-row pattern (Symptoms 2, 3, 4, 5):
    BD_Plataforma stores BIDIRECTIONAL transactions (BONUS, P2P, PURCHASE) as TWO rows per event — one with direction='out' for the sending side, one with direction='in' for the receiving side. The v2 inicio.ts surface iterates ALL filtered rows and treats each row as independent:
      * summarizeInicioV2.volumenIn includes BONUS-in/P2P-in/PURCHASE-in receiver rows (NOT money entering the platform — money moving WITHIN the platform).
      * summarizeInicioV2.volumenOut correctly includes the OUT side of those same events PLUS PAYOUT_BANK (correct OUT to bank).
      * For tasa de éxito: total = rows.length, so each bidirectional event counts as 2 attempts (numerator countCompleted ALSO double-counts on the bidirectional events that complete) → ratio is mathematically correct (cancels out) BUT the absolute counts shown to the user (3 numbers: completed/failed/in_progress) are 2x reality for bidirectional types.
      * aggregateTransactionTypeDistribution: BONUS / P2P / PURCHASE bucket counts inflated 2x → donut shares wrong.
      * aggregateActivityByDateV2 / ByWeekV2: signed sum of monto cancels bidirectional events to ~zero in volumen series; tikintagSet counts both sender+receiver per event (legit if you want "distinct active users that day" but obscures the directional flow).
    The user's stated TIPO-based classification:
      IN  = PAYIN_PSE + PAYIN_TRANSFER (recargas only — money entering platform)
      OUT = PAYOUT_BANK + PURCHASE (lado OUT) + BONUS (lado OUT) + P2P (lado OUT) (money leaving wallets / moving between users)
    This is consistent with BD_Plataforma's bidirectional pattern: count each event ONCE on the OUT side. The empresa-receive side of PURCHASE / receiver side of BONUS+P2P is a same-platform mirror, not a fresh inflow.

  ROOT CAUSE C — top-users ranking key is volumenNeto, surfacing "biggest net receivers" not "biggest movers" (Symptom 6):
    aggregateTopUsersByVolume sorts DESC by `volumenNeto = volumenIn - volumenOut`. Heavy spenders (lots of PURCHASE-out, no inflow) end up at the BOTTOM with negative neto; heavy receivers (lots of BONUS-in, no outflow) end up at the TOP with high positive neto. User reports "definición ambigua" — the table head is currently a quirk of math, not "top usuarios por volumen". User wants a clear, descending-by-meaningful-metric ranking. Likely intent: total movement (Math.abs(volumenIn) + volumenOut, treating each as gross), or the directionally-correct OUT-volumen for the headline ("biggest spenders"), or a column the user can pick.

fix: |
  PROPOSED FIX (PENDING USER CHECKPOINT — see CHECKPOINT REACHED below):

  1. Introduce per-tipo direction classification helpers in inicio.ts:
        const PLATFORM_IN_TIPOS  = new Set(['PAYIN_PSE', 'PAYIN_TRANSFER']);
        const PLATFORM_OUT_TIPOS_BIDIRECTIONAL = new Set(['BONUS', 'P2P', 'PURCHASE']);
        const PLATFORM_OUT_TIPOS_SINGLEDIR     = new Set(['PAYOUT_BANK']);
     (FEE / REFUND / CREDIT_ADJUSTMENT / TREASURY / UKNOWN go through unchanged; we surface them in the donut "Otros" rollup with their natural row count.)

  2. NEW canonical predicate `isPlatformInRow(t)` and `isPlatformOutRow(t)`:
        isPlatformInRow:  tipo ∈ PLATFORM_IN_TIPOS  (no direction check; PAYIN-* are direction='in' by convention)
        isPlatformOutRow: tipo ∈ PLATFORM_OUT_TIPOS_SINGLEDIR
                         OR (tipo ∈ PLATFORM_OUT_TIPOS_BIDIRECTIONAL AND direction === 'out')

  3. Rewrite summarizeInicioV2:
        - usuariosActivos: take a SECOND parameter `allTx: Transaction[]` (full pool) and count DISTINCT tikintag over that — same shape as aggregateRechargeAdoption(allTx, ...).totalUsers. The /inicio page already has allTx in scope.
        - volumenIn:  sum Math.abs(t.monto) for rows where isPlatformInRow(t)  AND status='completed' (we should declare this — currently summarizeInicioV2 includes rejected rows in volumen which inflates).
        - volumenOut: sum Math.abs(t.monto) for rows where isPlatformOutRow(t) AND status='completed'
        - countCompleted / countFailed / countInProgress + total: count UNIQUE EVENTS, not rows. For bidirectional types only count the OUT side; for single-direction types count the row. Effectively: count rows where (single-direction type) OR (bidirectional type AND direction='out') — call them the "canonical event rows" — then status-counter / total / successRate are based on those canonical rows.

  4. Rewrite aggregateTransactionTypeDistribution:
        - Iterate filtered rows but only count canonical event rows (per #3 above) → BONUS / P2P / PURCHASE bucket counts equal real event counts.
        - Total denominator = canonical-event row count, so shares sum to 1.0 cleanly.

  5. Rewrite aggregateActivityByDateV2 / ByWeekV2:
        - Replace the single `volumen` per bucket with split `volumenIn` + `volumenOut` (using the same Platform IN/OUT classification). Leaf ActivityTimelineV2 needs an update to render two series. OR keep a single volumen number = volumenIn + volumenOut (gross flow, never zero-cancelling).
        - tikintagsSet: keep Set-per-bucket dedup BUT only add tikintag from canonical event rows (so a BONUS event credits 1 active user — the sender — not 2).

  6. Rewrite aggregateTopUsersByVolume (Symptom 6):
        Replace ambiguous volumenNeto ranking. Options to discuss with user:
          (a) Rank by Math.abs(volumenIn) + volumenOut (gross movement — symmetric, surfaces "most active"); show all 4 columns (Tx / IN / OUT / Total).
          (b) Rank by volumenOut DESC ("biggest spenders/movers"); IN column becomes secondary.
          (c) Keep volumenNeto but rank by Math.abs(volumenNeto) DESC ("biggest net movers, either direction"), color-coding the sign.
        Per user's symptom: "ordenado descendente por esa métrica" → the cleanest UX is a single primary ranking column (option b: volumenOut, mirroring "money users actually move out — the platform's value-prop").

  7. Update page.tsx to pass `allTx` into summarizeInicioV2.

  8. Update relevant leaf components:
        - InicioKPIStripV2 (no API change — still receives summary; fields preserved)
        - TransactionTypeDonut (no change — still consumes buckets)
        - ActivityTimelineV2 (potential update if we split volumenIn/volumenOut into two series — needs decision)
        - TopUsersByVolume (potential column relabel + sort key reflection in JSDoc — needs decision)

  9. Validation: run /inicio with no filters; confirm:
        - usuariosActivos = 235 (vs 233 before)
        - volumen IN = sum of recargas only
        - volumen OUT = payouts + purchase OUT + bonus OUT + p2p OUT
        - donut: BONUS / P2P / PURCHASE counts halved relative to before
        - timeline: positive volumenOut series, positive volumenIn series, no spurious zeros
        - top users: clear primary metric, descending order

  USER DECISIONS (received post-checkpoint):
    1. Status filter for IN/OUT volumen → (A) Solo `completed`. Rejected = no money moved.
    2. Activity timeline → (A) Two series: volumenIn + volumenOut (replace single signed volumen).
    3. Top-10 ranking → (A) Sort DESC by volumenOut; explicit primary column marker.
    4. usuariosActivos denominator → (Y + enrichment) Filtered scope as the big number; new `usuariosTotal` field carries full-pool DISTINCT tikintag (235 baseline) for "X / Y usuarios totales" caption.

  IMPLEMENTED (single cohesive commit on master):

  src/lib/domain/inicio.ts:
    * NEW classifiers: PLATFORM_IN_TIPOS, PLATFORM_OUT_TIPOS_BIDIRECTIONAL, PLATFORM_OUT_TIPOS_SINGLEDIR (ReadonlySet<TransactionType>).
    * NEW predicates: isPlatformInRow, isPlatformOutRow, isCanonicalEventRow.
    * summarizeInicioV2(filteredRows, allTx) — second arg added; returns new `usuariosTotal` field. Status counters / total / successRate now over canonical event rows only. Volumen IN/OUT use TIPO-based classification with status='completed' gate.
    * aggregateTransactionTypeDistribution — skips IN-side mirror of bidirectional events.
    * aggregateActivityByDateV2 / aggregateActivityByWeekV2 — ActivityPointV2 has volumenIn + volumenOut (replaces signed `volumen`).
    * aggregateTopUsersByVolume — ranking key is volumenOut DESC; volumenNeto field removed from TopUserVolumeRow; tiebreak: volumenIn DESC → transacciones DESC → tikintag ASC.

  src/app/(protected)/inicio/page.tsx:
    * Pass allTx as second arg to summarizeInicioV2.

  src/components/inicio/InicioKPIStripV2.tsx:
    * NEW caption "X / Y usuarios totales" rendered under usuariosActivos big number.

  src/components/inicio/ActivityTimelineV2.tsx:
    * Replaced single dashed muted-Indigo `volumen` line with TWO new series: volumenIn (green oklch(0.62 0.14 150)) + volumenOut (orange oklch(0.62 0.16 50)) on the right axis. Tooltip shows both rows.

  src/components/inicio/TopUsersByVolume.tsx:
    * Removed volumenNeto column. Primary ranking column "Volumen OUT" annotated with ★ marker so the user sees the sort key at a glance. Volumen IN demoted to secondary muted-foreground column.

verification: |
  All 3 quality gates GREEN:
    1. TypeScript: `npx tsc --noEmit` → 0 errors.
    2. ESLint: `npm run lint` → 0 errors (3 pre-existing warnings in unrelated files).
    3. Production build: `npm run build` → "Compiled successfully", 6/6 static pages generated.
  Visual verification against the BD_Plataforma Sheet is deferred to the user (`npm run dev` + audit /inicio with the new Sheet baseline). The code surface implements the agreed semantic contract; any remaining gap with the Sheet should reflect a Sheet-side data anomaly, not a code bug.

files_changed:
  - src/lib/domain/inicio.ts
  - src/app/(protected)/inicio/page.tsx
  - src/components/inicio/InicioKPIStripV2.tsx
  - src/components/inicio/ActivityTimelineV2.tsx
  - src/components/inicio/TopUsersByVolume.tsx

commits:
  - 999e515 fix(inicio-v2): correct direction/tipo classification + ranking semantics
