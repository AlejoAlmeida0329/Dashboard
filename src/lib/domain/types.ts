/**
 * Domain types — pure TypeScript, source-agnostic.
 *
 * NO imports from `lib/sheets/` are allowed here. The whole point of this
 * module is that downstream code (components, page handlers, business logic)
 * can talk in domain terms without knowing whether the data came from a
 * Google Sheet, a database, an API, or a fixture.
 *
 * Optional fields (`destination_type`, future `status`, `failure_reason`) are
 * `?` because the source Sheet may or may not have them. Phases that NEED a
 * field check for its presence in their own scope.
 */

export type TransactionType = "BONO" | "RECARGA" | "PAYOUT" | "OTRO";

export type DestinationType = "tarjeta" | "cuenta_bancaria";

export interface Transaction {
  /** Synthetic stable identifier built from fecha + empresa + tipo. */
  id: string;
  /** Parsed timestamp; the adapter interprets the raw cell in Bogotá time. */
  fecha: Date;
  /** COP amount, finite number. Positives and negatives both allowed. */
  monto: number;
  /** Normalised category — anything outside the known set falls to OTRO. */
  tipo: TransactionType;
  /** Stable empresa identifier (slug or uuid). NOT the display name. */
  empresa_id: string;
  /** Display name for the empresa. Safe to render directly. */
  empresa_nombre: string;
  /** Present only on rows where the destination is known. */
  destination_type?: DestinationType;
  // status, failure_reason: deferred to v2 per REQUIREMENTS.md (Plan 02 scope).
}
