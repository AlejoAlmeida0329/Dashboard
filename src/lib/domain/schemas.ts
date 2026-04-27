import { z } from "zod";

import type { Transaction, TransactionType } from "./types";

/**
 * Headers expected on the transactions Sheet (lower-case, no whitespace).
 * Tentative — Plan 04 production smoke confirms against the live Sheet.
 *
 * If the real headers differ, AJUSTAR ESTE archivo (the schema and this
 * tuple), no el adapter. The adapter is generic over header→object mapping;
 * the schema owns the contract with the Sheet.
 */
export const ExpectedTransactionHeaders = [
  "fecha",
  "monto",
  "tipo",
  "empresa_id",
  "empresa_nombre",
] as const;

export type ExpectedTransactionHeader = (typeof ExpectedTransactionHeaders)[number];

const KNOWN_TRANSACTION_TYPES: TransactionType[] = ["BONO", "RECARGA", "PAYOUT"];

/**
 * Validate a single transaction row.
 *
 * Input shape: `{ [header_lowercased]: unknown }`. The adapter (transactions.ts)
 * builds this object from the row + headerIndexMap so that this schema never
 * sees raw positional arrays — Pitfall 3 (schema brittleness on column reorder)
 * is closed because reordering columns in the Sheet doesn't move our keys.
 *
 * `z.coerce.number().finite()` rejects NaN and ±Infinity, which is the path
 * formula errors take after `Number()` coercion — Pitfall 13.
 */
export const TransactionRowSchema = z
  .object({
    fecha: z.coerce.date(),
    monto: z.coerce.number().finite().min(-1e10).max(1e10),
    tipo: z.string().transform((s): TransactionType => {
      const upper = s.trim().toUpperCase();
      return (KNOWN_TRANSACTION_TYPES as string[]).includes(upper)
        ? (upper as TransactionType)
        : "OTRO";
    }),
    empresa_id: z.string().min(1),
    empresa_nombre: z.string().min(1),
    destination_type: z.enum(["tarjeta", "cuenta_bancaria"]).optional(),
  })
  .transform(
    (parsed): Transaction => ({
      id: `${parsed.fecha.toISOString()}-${parsed.empresa_id}-${parsed.tipo}`,
      fecha: parsed.fecha,
      monto: parsed.monto,
      tipo: parsed.tipo,
      empresa_id: parsed.empresa_id,
      empresa_nombre: parsed.empresa_nombre,
      destination_type: parsed.destination_type,
    }),
  );

export type TransactionRowInput = z.input<typeof TransactionRowSchema>;
