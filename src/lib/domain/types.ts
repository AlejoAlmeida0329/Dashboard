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

/* ============================================================================
 * Payouts (BD_Payouts) — Phase 3 Plan 01
 * ----------------------------------------------------------------------------
 * 15-column tab. Schema captured live 2026-05-04 via a diagnostic route
 * (deleted; mirrors Plan 02-01 pattern) against 798 production rows.
 * Source-format gotchas the diagnostic surfaced:
 *   - `Value` and `Transaction Cost` are pre-formatted strings like
 *     `"COP 200,000.00"` (not raw numbers). Schema parses them.
 *   - `Aging` and `Total Time` are PostgreSQL interval strings like
 *     `"0 years 0 mons N days HH hours MM mins SS.fff secs"`. Schema parses
 *     them to seconds (number).
 *   - `Total Time` is EMPTY for in_progress / failed payouts (the payout
 *     hasn't ended). `Aging` is always present (it's the row's age = now -
 *     created_at). For COMPLETED payouts both are present and `Total Time`
 *     is the canonical "time-to-payout" we want for P50/P95 + histogram.
 *     The `latencySeconds` field carries Total Time when present, falling
 *     back to Aging otherwise — Plan 03-02 will filter to state==completed
 *     before percentile, so the fallback is just defensive.
 *   - `Holder` is a CARDHOLDER FULL NAME (e.g. "Angela Yaneth leal liberato"),
 *     NOT a tikintag. The empresa filter cannot match Holder → tikintag
 *     directly. Plan 03-02 (page composition) will join via `transactionId`
 *     to BD_Plataforma to enrich `empresa_id` if the URL filter is active.
 *   - `Destination Medium` is a BANK CODE (e.g. "bancolombia", "nequi",
 *     "daviplata"), NOT "tarjeta"/"cuenta_bancaria" as 03-RESEARCH.md
 *     speculated. All 798 production rows are bank payouts — no card
 *     payouts in the dataset. PAY-04's "split tarjeta vs banco" may need
 *     reinterpretation in Plan 03-02/03 (likely "split by bank" or simply
 *     "all payouts are to banks").
 * ========================================================================== */

/**
 * Payout lifecycle state. Captured live 2026-05-04 (798 rows): exactly
 * three values appear in BD_Payouts.State:
 *   - `completed` — payout settled to the destination account
 *   - `in_progress` — payout submitted but not yet settled (no Total Time)
 *   - `failed` — payout rejected by the destination bank (Failure Reason
 *      may carry a description)
 * `OTRO_STATE` is fallback for any future unseen value so a Sheet edit
 * doesn't break the parse.
 */
export type PayoutState = "completed" | "in_progress" | "failed" | "OTRO_STATE";

/**
 * Destination Medium — i.e. the destination BANK / wallet provider.
 *
 * Captured live 2026-05-04 (798 rows): 12 distinct bank codes appear:
 *   bancolombia, nequi, daviplata, nubank, banco_de_bogota, banco_davivienda,
 *   banco_caja_social_bcsc, banco_av_villas, banco_falabella,
 *   banco_bbva_colombia, banco_mundo_mujer, davibank.
 *
 * Type kept open as `string` (with `OTRO_MEDIUM` constant for fallbacks)
 * because Tikin onboards new banks regularly. Phase 3 page composition
 * groups by this string for the destination split (PAY-04). The schema
 * lowercases + trims raw cells before storage so case drift can't fragment
 * counts.
 *
 * NOTE: 03-RESEARCH.md anticipated `tarjeta` vs `cuenta_bancaria` split.
 * Reality: all observed payouts are to bank accounts (no card payouts in
 * BD_Payouts as of capture). Plans 03-02/03 should treat this as "split
 * by bank" or surface "all payouts are to banks" in the destination KPI.
 */
export type PayoutMedium = string;
export const OTRO_MEDIUM = "OTRO_MEDIUM" as const;

export interface Payout {
  /**
   * Stable id from BD_Payouts.Transaction ID — same domain as
   * Transaction.id, enables join to BD_Plataforma for empresa enrichment.
   */
  transactionId: string;
  /**
   * Internal Sheet row id (BD_Payouts.ID, a 64-char hash). Distinct from
   * `transactionId`. Used as the row's primary key for dedup; a single
   * `transactionId` may have multiple Payout rows (refund+retry per
   * 03-RESEARCH.md Pitfall 9).
   */
  internalId: string;
  /** Parsed timestamp from BD_Payouts.Date. */
  fecha: Date;
  /**
   * `Holder` raw string — the cardholder/account-holder full name. NOT a
   * tikintag. Provisional empresa identity ONLY when no join is performed;
   * Plan 03-02 will populate `empresa_id` via `transactionId` join.
   */
  holder: string;
  /** Payout amount in COP, parsed from BD_Payouts.Value (`"COP 200,000.00"`). */
  monto: number;
  /** Tikin's transaction cost in COP, parsed from BD_Payouts.Transaction Cost. */
  costo: number;
  /**
   * Normalized destination bank/wallet code. Lowercased+trimmed raw
   * `Destination Medium` cell. See `PayoutMedium` JSDoc for the 12 known
   * codes; any unseen value is preserved as-is (lowercased) so future
   * additions surface in the dashboard rather than collapse to OTRO.
   */
  medium: PayoutMedium;
  /** Lifecycle state. Phase 3 percentile/histogram filter `state==completed`. */
  state: PayoutState;
  /**
   * Time-to-payout IN SECONDS.
   *
   * Decision (data-driven, 2026-05-04): use `Total Time` (state_timestamp
   * − date) when present; fall back to `Aging` otherwise. `Total Time` is
   * the canonical end-to-end latency for COMPLETED payouts; it's empty
   * for `in_progress`/`failed` rows in production. Both columns are
   * PostgreSQL interval strings parsed via `parsePgInterval` — see
   * `src/lib/domain/schemas.ts` Money/Interval helpers.
   *
   * Plan 03-02's percentile/histogram will filter to `state==completed`
   * before computing — non-completed `latencySeconds` values exist as a
   * defensive default and SHOULD NOT influence headline P50/P95 numbers
   * (per 03-CONTEXT.md essentials: "solo payouts que efectivamente se
   * completaron").
   */
  latencySeconds: number;
  /** Failure reason raw string (BD_Payouts.Failure Reason); presenter-hidden. */
  failureReason?: string;
  /** Failure details raw string (BD_Payouts.Failure Details). */
  failureDetails?: string;
  /**
   * Optional empresa_id once joined with BD_Plataforma; undefined if join
   * not performed. Plan 03-01 (this plan) leaves this undefined; Plan
   * 03-02 (page composition) will populate it via the Transaction ID join.
   */
  empresa_id?: string;
}

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
