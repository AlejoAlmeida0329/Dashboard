import { z } from "zod";

import { parseCOPAmount, parsePgIntervalSeconds } from "./parsers";
import type {
  Payout,
  PayoutState,
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
      sourceTransferTikintag: parsed.source_transfer_tikintag,
      destinationTransferTikintag: parsed.destination_transfer_tikintag,
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

/* ============================================================================
 * Payouts (BD_Payouts) — Phase 3 Plan 01
 * ----------------------------------------------------------------------------
 * Schema captured live 2026-05-04 via a diagnostic route (deleted; mirrors
 * Plan 02-01 pattern) against 798 production rows. Sheet stores values in
 * unexpected formats — see helpers below.
 * ========================================================================== */

/**
 * Headers expected on the BD_Payouts Sheet (lowercased + trimmed).
 *
 * Confirmed live 2026-05-04 against the real Sheet (15 columns, 798 rows).
 * Headers contain spaces (e.g. `"transaction id"` with the embedded space) —
 * `headerIndexMap` lowercases + trims, so this matches the live key shape.
 *
 * If a header changes upstream, the adapter throws a clear "schema mismatch
 * — columnas faltantes en BD_Payouts Sheet: X, Y, Z" error naming exactly
 * which expected header is absent. Resolution: edit this tuple and the
 * matching schema field.
 */
export const ExpectedPayoutHeaders = [
  "transaction id",
  "date",
  "holder",
  "destination account",
  "value",
  "destination medium",
  "transaction cost",
  "state",
  "state timestamp",
  "refund sent",
  "aging",
  "failure reason",
  "failure details",
  "total time",
  "id",
] as const;

export type ExpectedPayoutHeader = (typeof ExpectedPayoutHeaders)[number];

/**
 * Distinct `state` values captured live 2026-05-04 (lowercase in Sheet).
 * Unseen values fall back to `OTRO_STATE`.
 */
const KNOWN_PAYOUT_STATES: readonly PayoutState[] = [
  "completed",
  "in_progress",
  "failed",
];

/**
 * Zod-friendly wrapper around `parseCOPAmount` (from `./parsers`).
 *
 * BD_Payouts stores `Value` and `Transaction Cost` as pre-formatted
 * strings like `"COP 200,000.00"`, `"COP 5,229.46"`, `"COP 1,500,000.00"`.
 * UNFORMATTED_VALUE doesn't strip the formatting because the cell is
 * actually a TEXT cell upstream (probably from a Looker / report export).
 *
 * `parseCOPAmount` returns `null` for empty / non-finite inputs; here we
 * map that to a Zod custom issue so the row is skipped (mirrors Money's
 * behavior). Behavior preserved verbatim from the original inline
 * implementation against 798 production rows.
 *
 * Examples:
 *   "COP 200,000.00" → 200000
 *   "COP 5,229.46"   → 5229.46
 *   "COP 1,500,000.00" → 1500000
 */
const MoneyFromCOP = z
  .union([z.string(), z.number()])
  .transform((v, ctx): number => {
    const n = parseCOPAmount(v);
    if (n === null) {
      const message =
        typeof v === "number"
          ? "Money is not finite"
          : v.replace(/[^0-9.\-]/g, "").length === 0
          ? `Money string had no parseable digits: "${v}"`
          : `Money string parsed to non-finite number: "${v}"`;
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return n;
  });

/**
 * Parse a PostgreSQL interval string to SECONDS — thin delegate to
 * `parsePgIntervalSeconds` in `./parsers`.
 *
 * Kept in this file as a one-liner so the `aging` / `total time` Zod
 * transforms below stay readable, and so the seconds-based contract for
 * `Payout.latencySeconds` is explicit at the call site (parsers.ts also
 * exposes minute-returning APIs for v2.0 consumers — schemas.ts is the
 * one place that still needs seconds).
 */
function parsePgInterval(s: unknown): number {
  return parsePgIntervalSeconds(s);
}

/**
 * Parse a BD_Payouts date string like `"April 27, 2026, 9:48 AM"` into a Date.
 *
 * BD_Payouts.Date arrives as a comma-separated English locale string
 * (the Sheet appears to render dates as TEXT for readability). JS's
 * built-in `Date()` constructor accepts this format on V8 (Node + Chrome
 * + Vercel runtime), validated against the diagnostic samples.
 *
 * Returns Invalid Date (whose .getTime() is NaN) when the string is
 * unparseable; the schema's `.refine()` catches that and skips the row.
 */
function parseHumanDate(s: unknown): Date {
  if (typeof s !== "string") return new Date(NaN);
  return new Date(s);
}

/**
 * Validate a single BD_Payouts row.
 *
 * Input shape: `{ [header_lowercased_with_spaces]: unknown }`. The
 * adapter (payouts.ts) builds this object from the row + headerIndexMap
 * so the schema never sees raw positional arrays.
 *
 * Schema decisions (live-grounded 2026-05-04):
 *   - `value` & `transaction cost` parsed from `"COP 200,000.00"`-style strings.
 *   - `date` & `state timestamp` parsed from `"April 27, 2026, 9:48 AM"`-style.
 *   - `aging` & `total time` parsed from PostgreSQL interval strings to seconds.
 *   - `latencySeconds` = total_time when > 0, else aging (defensive fallback;
 *     non-completed rows have empty total_time).
 *   - `medium` = lowercased+trimmed bank code (the 12 distinct values
 *     are bank/wallet codes; no `tarjeta` data in production).
 *   - `state` = one of completed/in_progress/failed, else OTRO_STATE.
 *
 * Final `.transform()` is the SINGLE place where Sheet column names get
 * mapped to domain field names.
 */
export const PayoutRowSchema = z
  .object({
    "transaction id": z.string().min(1),
    date: z.unknown().transform((v, ctx): Date => {
      const d = parseHumanDate(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({
          code: "custom",
          message: `Date string unparseable: ${String(v)}`,
        });
        return z.NEVER;
      }
      return d;
    }),
    holder: z.string().min(1),
    value: MoneyFromCOP,
    "destination medium": z
      .union([z.string(), z.number()])
      .transform((v) => {
        const s = typeof v === "string" ? v : String(v);
        const norm = s.trim().toLowerCase();
        return norm.length === 0 ? "OTRO_MEDIUM" : norm;
      }),
    "transaction cost": MoneyFromCOP,
    state: z.string().transform((s): PayoutState => {
      const lower = s.trim().toLowerCase();
      return (KNOWN_PAYOUT_STATES as readonly string[]).includes(lower)
        ? (lower as PayoutState)
        : "OTRO_STATE";
    }),
    aging: z.unknown().transform((v, ctx): number => {
      const n = parsePgInterval(v);
      if (Number.isNaN(n)) {
        ctx.addIssue({
          code: "custom",
          message: `Aging interval unparseable: ${String(v)}`,
        });
        return z.NEVER;
      }
      return n;
    }),
    "total time": z.unknown().transform((v): number => {
      const n = parsePgInterval(v);
      // Tolerate parse failures here — total_time is empty for non-completed
      // rows, and we fall back to aging in the outer transform.
      return Number.isNaN(n) ? 0 : n;
    }),
    "failure reason": OptionalString,
    "failure details": OptionalString,
    id: z.string().min(1),
    // Tolerate the remaining columns silently — present in the Sheet but
    // not consumed by the Payout interface in Phase 3.
    "destination account": OptionalString,
    "state timestamp": OptionalString,
    "refund sent": OptionalString,
  })
  .transform(
    (parsed): Payout => ({
      transactionId: parsed["transaction id"],
      internalId: parsed.id,
      fecha: parsed.date,
      holder: parsed.holder,
      monto: parsed.value,
      costo: parsed["transaction cost"],
      medium: parsed["destination medium"],
      state: parsed.state,
      // Total Time when > 0 (canonical for completed); Aging otherwise.
      // See Payout.latencySeconds JSDoc + 03-CONTEXT.md essentials —
      // Plan 03-02 filters to state==completed before percentile, so the
      // fallback only matters defensively for the success-rate KPI path.
      latencySeconds:
        parsed["total time"] > 0 ? parsed["total time"] : parsed.aging,
      failureReason: parsed["failure reason"],
      failureDetails: parsed["failure details"],
    }),
  );

export type PayoutRowInput = z.input<typeof PayoutRowSchema>;
