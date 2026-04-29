/**
 * Domain types — pure TypeScript, source-agnostic.
 *
 * NO imports from `lib/sheets/` are allowed here. The whole point of this
 * module is that downstream code (components, page handlers, business logic)
 * can talk in domain terms without knowing whether the data came from a
 * Google Sheet, a database, an API, or a fixture.
 *
 * Phase 2 Plan 01 rewrote this to match the real BD_Plataforma headers
 * (23 cols, 3232 rows). See 02-01-SUMMARY.md for:
 *   - Diagnostic findings (live distinct values from /api/diagnose)
 *   - Schema mapping table (BD_Plataforma column → Transaction field)
 *   - Empresa identity rationale (default = tikintag, override path)
 *
 * Optional fields are `?` because the source row may or may not have them.
 * Phases that NEED a field check for its presence in their own scope.
 */

/**
 * Real `transaction_type` values in BD_Plataforma (uppercased).
 *
 * Captured live 2026-04-29 via /api/diagnose against 500 rows:
 *   BONUS, CREDIT_ADJUSTMENT, FEE, P2P, PAYIN_PSE, PAYIN_TRANSFER,
 *   PAYOUT_BANK, PURCHASE, REFUND, TREASURY, UKNOWN
 *
 * Notes:
 *  - `UKNOWN` is a real value in the Sheet (note the missing 'N'). We
 *    accept it as-is rather than silently mapping to OTRO; the user owns
 *    cleanup at the source.
 *  - `OTRO` is the fallback for any future unseen value so that a Sheet
 *    edit doesn't blow up the parse.
 *  - Phase 2 (Bonos) primarily filters on `BONUS`; Phase 3 on
 *    `PAYOUT_BANK`; Phase 4 on `PAYIN_PSE` + `PAYIN_TRANSFER`.
 */
export type TransactionType =
  | "BONUS"
  | "CREDIT_ADJUSTMENT"
  | "FEE"
  | "P2P"
  | "PAYIN_PSE"
  | "PAYIN_TRANSFER"
  | "PAYOUT_BANK"
  | "PURCHASE"
  | "REFUND"
  | "TREASURY"
  | "UKNOWN"
  | "OTRO";

/**
 * Movement direction relative to the user's wallet.
 * `in` = funds entering, `out` = funds leaving. Captured live: only these
 * two values in production data; `OTRO_DIRECTION` is fallback for future
 * unseen values.
 */
export type TransactionDirection = "in" | "out" | "OTRO_DIRECTION";

/**
 * Transaction lifecycle status.
 * Captured live (lowercase in Sheet): `completed`, `rejected`.
 * `OTRO_STATUS` is fallback for any future unseen value (e.g. `pending`
 * if Tikin starts surfacing in-flight transactions).
 */
export type TransactionStatus = "completed" | "rejected" | "OTRO_STATUS";

export type DestinationType = "tarjeta" | "cuenta_bancaria";

export interface Transaction {
  /** Stable id from BD_Plataforma.transaction_id (no longer synthetic). */
  id: string;
  /** Parsed timestamp from created_at (Sheet returns ISO via FORMATTED_STRING). */
  fecha: Date;
  /** Numeric amount from BD_Plataforma.amount (COP). Positives and negatives both allowed. */
  monto: number;
  /** Gross amount before fees (BD_Plataforma.gross_amount). */
  grossAmount: number;
  /** Total transaction fee — what Tikin charges (sum of fixed + variable). */
  comision: number;
  /** Fixed transaction fee component. */
  fixedFee: number;
  /**
   * Variable fee as a fraction 0..1 (e.g. 0.025 for 2.5%). The Sheet
   * stores it as a whole percentage (0..100); the schema's transform
   * divides by 100 so downstream code can do `monto * variableFeePct`
   * to get the variable fee in COP without re-normalizing.
   */
  variableFeePct: number;
  /** Normalized transaction category. */
  tipo: TransactionType;
  /** Direction in/out. */
  direction: TransactionDirection;
  /** Transaction status (completed / rejected / etc.). */
  status: TransactionStatus;
  /**
   * DEFAULT empresa identity = tikintag.
   *
   * BD_Plataforma has no explicit empresa column; rather than guess, we
   * project tikintag here so downstream UI (EmpresaFilter, leaderboard,
   * etc.) has a consistent identifier today and a single edit-point if the
   * user later decides account_id is the right empresa key. To switch:
   *   1. In src/lib/domain/schemas.ts, change `empresa_id: parsed.tikintag`
   *      to `empresa_id: parsed.account_id`.
   *   2. Same for `empresa_nombre`.
   * That's the entire migration. See 02-01-SUMMARY.md "Empresa identity
   * decision" for full rationale.
   */
  empresa_id: string;
  /** Display name. Currently same string as empresa_id since BD_Plataforma has no display column. */
  empresa_nombre: string;
  /** Raw tikintag value (always available). Useful when empresa_id is later switched to account_id. */
  tikintag: string;
  /** Raw account_id value (always available). Useful for joins / Phase 5 customer mapping. */
  accountId: string;
  /** Reference / batch_reference from raw row, useful for joins to BD_Payouts. */
  reference?: string;
  /** Present when this row is a payout-shaped transaction. Phase 3 derives from BD_Payouts.Destination Medium. */
  destination_type?: DestinationType;
}
