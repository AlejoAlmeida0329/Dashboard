---
status: checkpoint
trigger: "sheets-schema-transaction-id — Sheet schema validation falla, ExpectedTransactionHeaders espera transaction_id pero columna no existe en Sheet"
created: 2026-05-07T00:00:00Z
updated: 2026-05-07T00:30:00Z
---

## Current Focus

hypothesis: CONFIRMADO — el header de la columna 7 (0-indexed) en BD_Plataforma fue cambiado de "transaction_id" a literalmente "L" (un solo carácter). Los valores de esa columna SIGUEN siendo UUIDs válidos que joinean con BD_Payouts.Transaction ID. Es decir: data correcta, header roto.
test: Sheets API spreadsheets.values.get sobre Sheet ID `1X0oKHsOf...QObA`, tab BD_Plataforma, range A1:Z3233. Comparado con BD_Payouts.Transaction ID via set intersection.
expecting: Confirmar que columna "L" contiene los UUIDs que originalmente vivían bajo "transaction_id"
next_action: CHECKPOINT — el fix correcto es que el usuario renombre el header en el Sheet (de "L" a "transaction_id"). NO debemos cambiar schemas.ts ni renombrar el campo, porque la app v1.0 funciona con "transaction_id" y el PRD del usuario describe el JOIN incorrectamente.

## Symptoms

expected: Dashboard lee Google Sheets sin error y renderiza KPIs/tabs en localhost:3000
actual: Todos los tabs muestran error de Sheets. DashboardHeader también falla. Solo /login funciona.
errors: |
  [DashboardHeader] empresa registry failed: Error: Sheet schema mismatch — columnas faltantes en transactions Sheet: transaction_id. Verifica el Sheet o ajusta src/lib/domain/schemas.ts si los nombres cambiaron upstream.
    at getTransactions (src/lib/sheets/transactions.ts:80:11)
reproduction: |
  1. npm run dev
  2. Login con tikin2026
  3. Navegar a /inicio o cualquier tab → error inline rendered
started: 2026-05-07 (v1.0 funcionaba 2026-05-06 en producción)
context: |
  - PRD reciente menciona "BD_Tikin.xlsx" y columna 'reference' como JOIN key con BD_Payouts
  - .env.local: TRANSACTIONS_ID y PAYOUTS_ID apuntan al MISMO sheet ID (correcto — ambas tabs en el mismo Spreadsheet)
  - Tx count creció ~3188 → ~3232

## Eliminated

- hypothesis: "el Sheet ID en .env.local apunta al lugar incorrecto"
  evidence: API metadata responde con título "BD_Tikin", tabs `BD_Plataforma` (3233 rows × 26 cols) y `BD_Payouts` (1000 rows × 26 cols). Coincide con el PRD ("BD_Tikin.xlsx con 2 hojas: BD_Plataforma 3,232 transacciones · BD_Payouts 798"). Sheet ID es correcto.
  timestamp: 2026-05-07T00:25:00Z

- hypothesis: "transaction_id fue renombrado a reference"
  evidence: La columna `reference` SÍ existe en el Sheet (índice 8) Y la columna `transaction_id` también existió hasta hace poco (ahora literalmente nombrada "L" en índice 7). Los valores son DISTINTOS — `reference` tiene hex hashes (0x3b4db130...), `L`/transaction_id tiene UUIDs (eca1b3fe-df88-...). Set intersection contra BD_Payouts.Transaction ID demuestra que las UUIDs joinean (773/798 = 96.9%), los hex hashes joinean 0/798. ∴ son columnas funcionalmente diferentes; el PRD del usuario es INCORRECTO al decir que `reference` joinea.
  timestamp: 2026-05-07T00:28:00Z

- hypothesis: "el usuario quiere migrar a Excel local"
  evidence: El PRD menciona "BD_Tikin.xlsx" pero el Sheet en producción se llama "BD_Tikin" y tiene la misma estructura (mismas columnas, mismos counts). El usuario está describiendo el MISMO recurso, solo con nombre alternativo. No hay signos de migración a archivo local — sigue siendo Google Sheet.
  timestamp: 2026-05-07T00:29:00Z

## Evidence

- timestamp: 2026-05-07T00:20:00Z
  checked: src/lib/domain/schemas.ts ExpectedTransactionHeaders
  found: Lista de 23 headers esperados, posición 7 = "transaction_id" (en orden Sheet)
  implication: Schema es correcto y consistente con v1.0 que funciona en producción

- timestamp: 2026-05-07T00:21:00Z
  checked: src/lib/sheets/transactions.ts línea 78-84
  found: Validación boot-time: `ExpectedTransactionHeaders.filter((h) => !map.has(h))` — si falta cualquier header esperado, throw mensaje claro
  implication: La excepción es by-design; protege contra divergencias upstream

- timestamp: 2026-05-07T00:22:00Z
  checked: src/lib/sheets/config.ts
  found: range = "BD_Plataforma!A1:Z" para transactions, "BD_Payouts!A1:Z" para payouts. Ambos en mismo Spreadsheet ID (intencional según comment).
  implication: Config no es el problema; range es correcto.

- timestamp: 2026-05-07T00:25:00Z
  checked: Sheets API metadata + headers reales (scripts/diagnose-sheet-headers.mjs)
  found: |
    Spreadsheet "BD_Tikin" — tabs BD_Plataforma (3233r × 26c), BD_Payouts (1000r × 26c)
    BD_Plataforma headers (raw, 23 items):
      [0] tikintag, [1] account_id, [2] wallet_id, [3] balance_available,
      [4] balance_frozen, [5] balance_currency, [6] balance_pocket,
      [7] "L"  ← ESTABA "transaction_id", header sobreescrito accidentalmente
      [8] reference, [9] created_at, [10] direction, [11] transaction_type,
      [12] status, [13] amount, [14] gross_amount, [15] fixed_transaction_fee,
      [16] variable_fee_percentage, [17] total_transaction_fee,
      [18] source_transfer_tikintag, [19] destination_transfer_tikintag,
      [20] source_bank, [21] batch_reference, [22] pocket_name
    BD_Payouts headers (raw, 15 items): exactamente los 15 esperados, sin cambios.
  implication: Schema mismatch causado por UN solo header roto. Todos los demás headers están bien.

- timestamp: 2026-05-07T00:27:00Z
  checked: Valores de columna "L" (índice 7) vs columna "reference" (índice 8) vs BD_Payouts.Transaction ID
  found: |
    Muestra fila 2 (PAYOUT_BANK de $mario):
      L = "eca1b3fe-df88-4de2-825f-850d985931ee"  (UUID v4)
      reference = "0x3b4db130f41e119d98c736ca8be11b1cf1b2d599d39d8ce97f57ad64cf35c569"  (hex hash)
    BD_Payouts.Transaction ID muestras: cf75a5bf-..., b285a25f-..., 2ac832ba-... (todos UUIDs)
    
    Set intersection (todos los rows):
      BD_Payouts.Transaction ID ∩ BD_Plataforma.L          = 773/798 (96.9%)  ← JOIN funciona
      BD_Payouts.Transaction ID ∩ BD_Plataforma.reference  = 0/798   (0%)     ← JOIN no funciona
  implication: |
    1) "L" ES el transaction_id (mismos valores UUID que joinean con Payouts)
    2) "reference" es un hex hash (probablemente blockchain tx ID o id interno distinto)
    3) PRD del usuario está incorrecto — describe `reference` como JOIN key pero los datos demuestran lo contrario
    4) v1.0 que funciona en producción YA tiene la lógica correcta (usa transaction_id)
    5) ∴ el fix correcto es renombrar el header del Sheet de vuelta a "transaction_id", no cambiar el código

## Resolution

root_cause: |
  El header de la columna 7 (0-indexed) en BD_Plataforma fue cambiado accidentalmente de "transaction_id" a literalmente "L" (un solo carácter). Los valores de esa columna no fueron tocados — siguen siendo UUIDs que joinean correctamente con BD_Payouts.Transaction ID.
  
  Probable causa humana: alguien estaba editando el Sheet (preparando data para el PRD v1.1) y por un fat-finger/atajo de teclado el contenido del header se sobrescribió con "L". Es un typo en la fila 1 del Sheet, no un cambio de schema deliberado.

fix: |
  REQUIERE ACCIÓN DEL USUARIO en el Google Sheet upstream:
  1. Abrir Google Sheet "BD_Tikin" (https://docs.google.com/spreadsheets/d/1X0oKHsOfKSTWuiCs6OHSD50EXnbZ8tjLjhSFwETQObA)
  2. Ir a la tab BD_Plataforma
  3. En la fila 1, columna H (la 8ª columna, índice 7), la celda actualmente dice "L"
  4. Cambiarla a "transaction_id"
  5. Guardar
  
  Después: refrescar el dashboard. No requiere cambios de código.

  ALTERNATIVA si el usuario NO puede acceder al Sheet (decisión arquitectónica):
  - Cambiar src/lib/domain/schemas.ts: en ExpectedTransactionHeaders cambiar "transaction_id" → "L" en posición 7
  - Cambiar TransactionRowSchema: campo `transaction_id` → `L` (también ajustar el `.transform` para mapear `parsed.L` a `id`)
  - Esto deja el código funcionando contra el header roto, pero el costo es alto: el código pierde su semántica clara y futura tooling/diagnósticos que asumen el nombre original se confundirán.
  
  Recomendación firme: opción 1 (renombrar header en Sheet). Es 1 click humano vs migrar nombres en código.

verification: (pendiente — usuario debe renombrar header)
files_changed: []
