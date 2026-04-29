import { z } from "zod";

import type {
  Transaction,
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from "./types";

/**
 * Headers expected on the BD_Plataforma Sheet (lower-case, no whitespace).
 *
 * Confirmed live 2026-04-29 via /api/diagnose against the real Sheet (23
 * columns, 3232 rows). Listed in Sheet order even though the adapter looks
 * up by NAME via headerIndexMap — the order documents intent and helps
 * humans align this file with the live Sheet.
 *
 * If a header changes upstream, the adapter throws a clear "schema mismatch
 * — columnas faltantes: X, Y, Z" error naming exactly which expected header
 * is absent. Resolution: edit this tuple and the matching schema field.
 */
export const ExpectedTransactionHeaders = [
  "tikintag",
  "account_id",
  "wallet_id",
  "balance_available",
  "balance_frozen",
  "balance_currency",
  "balance_pocket",
  "transaction_id",
  "reference",
  "created_at",
  "direction",
  "transaction_type",
  "status",
  "amount",
  "gross_amount",
  "fixed_transaction_fee",
  "variable_fee_percentage",
  "total_transaction_fee",
  "source_transfer_tikintag",
  "destination_transfer_tikintag",
  "source_bank",
  "batch_reference",
  "pocket_name",
] as const;

export type ExpectedTransactionHeader = (typeof ExpectedTransactionHeaders)[number];

/**
 * Distinct transaction_type values captured live 2026-04-29. The schema
 * uppercases + trims the raw cell, then compares against this set; unseen
 * values fall back to "OTRO" so a future Sheet edit can't break the parse.
 *
 * Note: "UKNOWN" (sic — typo in source) is preserved verbatim, not
 * silently mapped to OTRO. The user owns source-side cleanup.
 */
const KNOWN_TRANSACTION_TYPES: readonly TransactionType[] = [
  "BONUS",
  "CREDIT_ADJUSTMENT",
  "FEE",
  "P2P",
  "PAYIN_PSE",
  "PAYIN_TRANSFER",
  "PAYOUT_BANK",
  "PURCHASE",
  "REFUND",
  "TREASURY",
  "UKNOWN",
];

/** Distinct direction values captured live 2026-04-29. Lowercase in Sheet. */
const KNOWN_DIRECTIONS: readonly TransactionDirection[] = ["in", "out"];

/** Distinct status values captured live 2026-04-29. Lowercase in Sheet. */
const KNOWN_STATUSES: readonly TransactionStatus[] = ["completed", "rejected"];

/**
 * Optional-string field. Accepts both string-typed cells and numeric/null
 * cells (Sheets can return number, undefined, or null even on "string"
 * columns). Coerces to string and trims; empty becomes undefined.
 */
const OptionalString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return undefined;
    const s = typeof v === "string" ? v : String(v);
    const trimmed = s.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  });

/** Currency-amount field. Accepts the wide COP range; rejects NaN/Infinity. */
const Money = z.coerce.number().finite().min(-1e12).max(1e12);

/**
 * Validate a single transaction row.
 *
 * Input shape: `{ [header_lowercased]: unknown }`. The adapter
 * (transactions.ts) builds this object from the row + headerIndexMap so the
 * schema never sees raw positional arrays — closes Pitfall 3 (column reorder).
 *
 * `z.coerce.number().finite()` rejects NaN and ±Infinity, the path that
 * formula errors take after Number() coercion (Pitfall 13). The adapter
 * also screens isFormulaError() upstream so most error rows never reach the
 * schema.
 *
 * Final `.transform()` is the SINGLE place where Sheet column names get
 * mapped to domain field names. Migration to a different empresa identity
 * (e.g. account_id) is a one-line edit on the `empresa_id` line.
 */
export const TransactionRowSchema = z
  .object({
    transaction_id: z.string().min(1),
    created_at: z.coerce.date(),
    tikintag: z.string().min(1),
    account_id: z.string().min(1),
    direction: z.string().transform((s): TransactionDirection => {
      const norm = s.trim().toLowerCase();
      return (KNOWN_DIRECTIONS as readonly string[]).includes(norm)
        ? (norm as TransactionDirection)
        : "OTRO_DIRECTION";
    }),
    transaction_type: z.string().transform((s): TransactionType => {
      const upper = s.trim().toUpperCase();
      return (KNOWN_TRANSACTION_TYPES as readonly string[]).includes(upper)
        ? (upper as TransactionType)
        : "OTRO";
    }),
    status: z.string().transform((s): TransactionStatus => {
      const lower = s.trim().toLowerCase();
      return (KNOWN_STATUSES as readonly string[]).includes(lower)
        ? (lower as TransactionStatus)
        : "OTRO_STATUS";
    }),
    amount: Money,
    gross_amount: Money,
    fixed_transaction_fee: Money,
    /**
     * Variable fee — stored in the Sheet as a WHOLE PERCENTAGE (0..100),
     * confirmed live via /api/diagnose 2026-04-29: range 0..4.76 with samples
     * [0, 3.5, 3.99, 4.56, 4.76]. We accept up to 100 (defensive cap; real
     * fees never approach that) and convert to a 0..1 fraction in the
     * transform below so downstream code can multiply by `monto` directly
     * to get the variable component in COP.
     */
    variable_fee_percentage: z.coerce.number().finite().min(0).max(100),
    total_transaction_fee: Money,
    // Non-critical fields — accepted as optional strings so a missing or
    // empty cell does not skip the row. Phase 2 reads tikintag/accountId
    // for empresa identity; the rest are payload for Phases 3-5.
    reference: OptionalString,
    wallet_id: OptionalString,
    balance_available: OptionalString,
    balance_frozen: OptionalString,
    balance_currency: OptionalString,
    balance_pocket: OptionalString,
    source_transfer_tikintag: OptionalString,
    destination_transfer_tikintag: OptionalString,
    source_bank: OptionalString,
    batch_reference: OptionalString,
    pocket_name: OptionalString,
  })
  .transform(
    (parsed): Transaction => ({
      id: parsed.transaction_id,
      fecha: parsed.created_at,
      monto: parsed.amount,
      grossAmount: parsed.gross_amount,
      // Decision: use total_transaction_fee as "comisión" — it's what Tikin
      // charges per transaction (fixed + variable rolled up by source).
      comision: parsed.total_transaction_fee,
      fixedFee: parsed.fixed_transaction_fee,
      // Sheet stores percentages as whole numbers (e.g. 4.76 = 4.76%); we
      // expose them as 0..1 fractions per the Transaction.variableFeePct
      // contract so consumers can do `monto * variableFeePct` directly.
      variableFeePct: parsed.variable_fee_percentage / 100,
      tipo: parsed.transaction_type,
      direction: parsed.direction,
      status: parsed.status,
      tikintag: parsed.tikintag,
      accountId: parsed.account_id,
      // SINGLE-POINT OVERRIDE for empresa identity. Default = tikintag.
      // To switch to account_id, change BOTH lines below to `parsed.account_id`.
      // No other file needs to change. See 02-01-SUMMARY.md "Empresa identity
      // decision" for rationale.
      empresa_id: parsed.tikintag,
      empresa_nombre: parsed.tikintag,
      reference: parsed.reference,
      // Phase 2 does not consume destination_type. Phase 3 (Payouts) will
      // derive it from BD_Payouts.Destination Medium during the join.
      destination_type: undefined,
    }),
  );

export type TransactionRowInput = z.input<typeof TransactionRowSchema>;
