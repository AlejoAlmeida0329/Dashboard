/**
 * Cliente domain (v2) — pure aggregations over `Transaction[]` /
 * `JoinedPayout[]` for the Vista Cliente v2 dossier (Phase 9 Plans 09-02
 * leaves + 09-03 page composition).
 *
 * Distinct from `clientes.ts` (plural) — that module is the empresa-INDEX
 * surface for the `/clientes` LIST page (CLI-01..04 derives the table of
 * empresas, monthly activity, etc.). THIS module is the per-tikintag
 * DOSSIER surface for `/clientes/[empresaId]` v2: header KPIs + benchmark
 * + P2P + chronological timeline.
 *
 * Brand new module in Phase 9 (no v1 predecessor at this granularity —
 * v1 `clientes/[empresaId]/page.tsx` reused `summarizeBonos` /
 * `summarizePayouts` / `summarizeRecargas` directly, with no per-cliente
 * benchmark or unified timeline). The v2 PRD adds CLI-V2-02, V2-04, V2-05,
 * V2-07, V2-08 which are genuinely new aggregations — encapsulating them
 * in a dedicated module keeps the page thin (Plan 09-03) and the leaves
 * pure (Plan 09-02).
 *
 * Design rules (deliberate, mirror of cardUsage.ts / clientes.ts / bonos.ts):
 *   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`, or
 *     `lib/format`. Date formatting (when needed) goes through
 *     `formatInTimeZone` from `date-fns-tz` directly. This makes every
 *     function callable from Server Components, Client Components, scripts,
 *     and (future) tests without setup.
 *   - All functions are pure: same input → same output, no side effects.
 *     `findClienteSummary` defaults `pocketActivo`'s `asOf` to `new Date()`
 *     when `filters.to` is absent — the only `Date.now()` read in the
 *     module, mirrored from `aggregateMonthlyActivity` in clientes.ts.
 *   - Date math is anchored to "America/Bogota" (UTC-5, no DST) — same
 *     convention as `url-state.ts` / the rest of the domain layer.
 *   - Empty inputs degrade to zeros / empty arrays / null where appropriate,
 *     never NaN/Infinity (Pitfall: empty result sets crashing leaf charts).
 *
 * REQUIREMENTS traceability (milestones/v2.0-REQUIREMENTS.md):
 *   CLI-V2-02  cabecera 5 KPIs (Balance · Primera tx · Última actividad ·
 *              Total tx · Pocket activo) — `findClienteSummary`.
 *   CLI-V2-04  P2P split + table for tikintag — `aggregateClienteP2P`.
 *   CLI-V2-05  chronological timeline (presenter-hide) —
 *              `aggregateClienteTimeline`.
 *   CLI-V2-07  benchmark cliente vs plataforma —
 *              `aggregateClienteBenchmark`.
 *   CLI-V2-08  presenter-hide tagging applied at the page layer (Plan 09-03);
 *              this module emits the data unconditionally and the page
 *              tags the wrapping element.
 *
 * Prior art:
 *   - src/lib/domain/cardUsage.ts  — period filter + tikintag rankings idiom.
 *   - src/lib/domain/clientes.ts   — Bogotá date helpers + activity-counting
 *                                     predicate (verbatim copy below; sixth
 *                                     domain module to make the DRY-vs-
 *                                     cohesion call).
 *   - src/lib/domain/payouts.ts    — `aggregateAverageProcessingMinutes`
 *                                     defensive `state==='completed'` guard
 *                                     reused for the benchmark.
 *   - src/lib/domain/join.ts       — `JoinedPayout` shape consumed for
 *                                     benchmark + timeline payout enrichment.
 */

import type { Transaction } from "./types";
import type { JoinedPayout } from "./join";
import type { DashboardFilters } from "@/lib/url-state";

// --- Date parse helpers (Bogotá-anchored) ----------------------------------
//
// Verbatim copies from `clientes.ts:86-109`. Sixth domain module to make
// the DRY-vs-cohesion call: a shared util would force every domain module
// to import it (new dependency surface), trading a 10-line copy for a
// shared symbol. Inline cost wins.

/**
 * Parse a `YYYY-MM-DD` filter string as the START of that day in Bogotá
 * (00:00:00 COT == 05:00:00 UTC). Returns `-Infinity` if the string is
 * missing or unparseable so callers can use `>=` without special-casing.
 *
 * We deliberately do NOT use `new Date(s)` because that interprets
 * `'2026-04-27'` as midnight UTC (= 19:00 the previous day in Bogotá),
 * silent off-by-one for every range filter.
 */
function startOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.NEGATIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.NEGATIVE_INFINITY;
  // Bogotá is UTC-5 with no DST. 00:00 in Bogotá == 05:00 UTC.
  const t = Date.parse(`${s}T00:00:00-05:00`);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Parse a `YYYY-MM-DD` filter string as the END of that day in Bogotá
 * (23:59:59.999 COT). Returns `+Infinity` if missing/unparseable. The
 * "end of day" semantic matters: `to=2026-04-29` should include a tx
 * stamped at 22:00 on the 29th.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Predicates -------------------------------------------------------------

/**
 * "Activity-counting" predicate. Verbatim copy from `clientes.ts:118-120`:
 * direction='in' + status='completed' is the universal "money actually
 * arrived" gate. Used by `findClienteSummary` for `ultimaActividad` and
 * `pocketActivo` — both are "did this user receive money recently"
 * questions, not "did this user transact at all".
 */
function isActivityCounting(t: Transaction): boolean {
  return t.direction === "in" && t.status === "completed";
}

// --- Output types -----------------------------------------------------------

/**
 * Cabecera de 5 KPIs para Vista Cliente (CLI-V2-02).
 *
 * The 5 KPIs the dossier shows at the top:
 *   - Balance — net wallet position (inflows − outflows) for completed tx.
 *   - Primera tx — earliest dated transaction of any kind.
 *   - Última actividad — latest activity-counting transaction.
 *   - Total tx — count of every transaction tied to the tikintag.
 *   - Pocket activo — boolean "has activity in the last 30 days" relative
 *     to filters.to (or now() when `to` absent).
 */
export interface ClienteSummary {
  /** tikintag this summary belongs to (echoed for debugging / labelling). */
  tikintag: string;
  /** Display name. First-occurrence-wins per `empresa_nombre`; falls back to tikintag. */
  empresa_nombre: string;
  /** Net wallet balance approximation in COP — sum of inflows minus sum of outflows for completed transactions of this tikintag. Negative possible. */
  balance: number;
  /** Date of earliest transaction (any tipo, any direction, any status) for this tikintag. null if none. */
  primeraTx: Date | null;
  /** Date of latest activity-counting transaction (direction=in && status=completed) for this tikintag. null if none. */
  ultimaActividad: Date | null;
  /** Count of ALL transactions (any tipo / direction / status) carrying empresa_id === tikintag. */
  totalTx: number;
  /** "Pocket activo" — true when the tikintag has at least one activity-counting tx in the last 30 calendar days (Bogotá) relative to filters.to or today. */
  pocketActivo: boolean;
}

/**
 * Cliente vs plataforma processing-time benchmark (CLI-V2-07).
 *
 * The "argument-of-eficiencia" KPI per Phase 9 CONTEXT essentials — the
 * sixth-card-of-the-cabecera number that demonstrates this cliente settles
 * payouts faster (or slower) than the platform average. Negative
 * `deltaMinutes` is GOOD (cliente is faster). UI renders the framing
 * conditionally on the sign.
 */
export interface ClienteBenchmark {
  /** Cliente's avg processing time across COMPLETED payouts attributable to tikintag (minutes). 0 when no payouts found. */
  clienteMinutes: number;
  /** Platform-wide avg processing time across all COMPLETED payouts (minutes). 0 when none. */
  platformMinutes: number;
  /** clienteMinutes - platformMinutes. Negative = cliente faster than platform (the value-prop number). */
  deltaMinutes: number;
  /** Number of completed payouts for the cliente (denominator transparency). */
  clienteSampleSize: number;
  /** Number of completed payouts for the platform (denominator transparency). */
  platformSampleSize: number;
}

// --- Functions: Header / Benchmark -----------------------------------------

/**
 * Compute the 5-KPI header summary for a single tikintag (CLI-V2-02).
 *
 * Single pass over `transactions`. Skips rows whose `empresa_id !== tikintag`.
 * Filter range is NOT applied here — the cabecera shows whole-history KPIs
 * (balance, primera tx, total tx) so a user adjusting the `from`/`to`
 * filters doesn't see those numbers shift. `filters` is consumed only to
 * anchor the `pocketActivo` 30-day window: `asOf = filters.to ? Bogotá-noon-of(filters.to) : new Date()`.
 *
 * Returns `null` when the tikintag has zero matching rows (unknown user —
 * the page should render a 404-style "cliente no encontrado" fallback
 * rather than a card full of zeros).
 *
 * Pure (modulo the `Date.now()` default when `filters.to` is absent — same
 * convention as `aggregateMonthlyActivity` in clientes.ts).
 *
 * @example
 *   findClienteSummary(allTx, "$mario", { to: "2026-04-30" })
 *   // → { tikintag: "$mario", balance: 125000, primeraTx: <Date>,
 *   //     ultimaActividad: <Date>, totalTx: 47, pocketActivo: true }
 *   findClienteSummary(allTx, "$nonexistent", {})
 *   // → null
 */
export function findClienteSummary(
  transactions: Transaction[],
  tikintag: string,
  filters: DashboardFilters,
): ClienteSummary | null {
  let totalTx = 0;
  let balance = 0;
  let primeraTxTs = Number.POSITIVE_INFINITY;
  let primeraTx: Date | null = null;
  let ultimaActividadTs = Number.NEGATIVE_INFINITY;
  let ultimaActividad: Date | null = null;
  let empresa_nombre: string | undefined;
  let pocketActivo = false;

  // pocketActivo window: 30 days back from filters.to (or now). Anchor at
  // Bogotá noon of filters.to so we don't have day-boundary drift.
  const asOfTs = filters.to
    ? Date.parse(`${filters.to}T12:00:00-05:00`)
    : Date.now();
  const pocketWindowStart = Number.isFinite(asOfTs)
    ? asOfTs - 30 * 24 * 60 * 60 * 1000
    : Number.NEGATIVE_INFINITY;

  for (const t of transactions) {
    if (t.empresa_id !== tikintag) continue;

    totalTx += 1;

    // First-occurrence-wins for empresa_nombre; falls back to tikintag.
    if (empresa_nombre === undefined) {
      empresa_nombre = t.empresa_nombre || t.empresa_id;
    }

    // Balance: completed only. Tx schema preserves sign (in is positive,
    // out is negative), so simple sum nets correctly.
    if (t.status === "completed") {
      balance += t.monto;
    }

    // Primera tx: earliest fecha across ANY tx (no status / direction filter).
    const ts = t.fecha.getTime();
    if (Number.isFinite(ts) && ts < primeraTxTs) {
      primeraTxTs = ts;
      primeraTx = t.fecha;
    }

    // Última actividad: latest activity-counting fecha.
    if (isActivityCounting(t)) {
      if (Number.isFinite(ts) && ts > ultimaActividadTs) {
        ultimaActividadTs = ts;
        ultimaActividad = t.fecha;
      }
      // Pocket activo: any activity-counting tx within the 30-day window.
      if (Number.isFinite(ts) && ts >= pocketWindowStart && ts <= asOfTs) {
        pocketActivo = true;
      }
    }
  }

  if (totalTx === 0) return null;

  return {
    tikintag,
    empresa_nombre: empresa_nombre || tikintag,
    balance,
    primeraTx,
    ultimaActividad,
    totalTx,
    pocketActivo,
  };
}

/**
 * Compute cliente vs plataforma processing-time benchmark (CLI-V2-07).
 *
 * Input is `JoinedPayout[]` (the page composition runs `joinPayouts(allTx,
 * allPayouts)` ONCE per request and threads the result here — same one-
 * JOIN-per-request budget as Plan 07-04). Page composition shape:
 *
 *   const joined = joinPayouts(transactions, payouts);
 *   const benchmark = aggregateClienteBenchmark(joined, "$mario");
 *
 * Two means are computed:
 *   - clienteMinutes = mean(latency / 60) over COMPLETED payouts where
 *     `p.transaction?.empresa_id === tikintag`. Unmatched payouts (the
 *     historic ~3.1% per Plan 06-02) cannot be attributed → SKIPPED.
 *   - platformMinutes = mean(latency / 60) over ALL COMPLETED payouts
 *     (regardless of empresa attribution).
 *
 * `deltaMinutes = clienteMinutes - platformMinutes`. NEGATIVE means cliente
 * is FASTER than platform — the value-prop framing UI renders as "X min
 * más rápido que el promedio". Sample sizes carried for denominator
 * transparency (a benchmark from 1 cliente payout vs 798 platform payouts
 * is technically valid but should be flagged in the UI).
 *
 * Defensive `state === 'completed'` filter mirrors
 * `aggregateAverageProcessingMinutes` in payouts.ts:582 — `latencySeconds`
 * carries `Total Time` for completed rows but `Aging` for non-completed,
 * and mixing the two contaminates the mean (the silent semantic drift
 * 03-CONTEXT.md essentials warned about).
 *
 * Pure. Empty input or zero-sample-size on either side → `0` for the
 * relevant minutes, never NaN/Infinity. O(n).
 *
 * @example
 *   aggregateClienteBenchmark(joinedPayouts, "$mario")
 *   // → { clienteMinutes: 45, platformMinutes: 62, deltaMinutes: -17,
 *   //     clienteSampleSize: 8, platformSampleSize: 773 }
 *   //   // cliente is 17 min faster than the platform average
 */
export function aggregateClienteBenchmark(
  joinedPayouts: JoinedPayout[],
  tikintag: string,
): ClienteBenchmark {
  let clienteSeconds = 0;
  let clienteCount = 0;
  let platformSeconds = 0;
  let platformCount = 0;

  for (const p of joinedPayouts) {
    if (p.state !== "completed") continue;
    if (!Number.isFinite(p.latencySeconds)) continue;

    // Platform pool: all completed payouts.
    platformSeconds += p.latencySeconds;
    platformCount += 1;

    // Cliente pool: completed payouts attributable to this tikintag via
    // the joined Transaction's empresa_id.
    if (p.transaction?.empresa_id === tikintag) {
      clienteSeconds += p.latencySeconds;
      clienteCount += 1;
    }
  }

  const clienteMinutes = clienteCount > 0 ? clienteSeconds / clienteCount / 60 : 0;
  const platformMinutes =
    platformCount > 0 ? platformSeconds / platformCount / 60 : 0;
  const deltaMinutes = clienteMinutes - platformMinutes;

  return {
    clienteMinutes,
    platformMinutes,
    deltaMinutes,
    clienteSampleSize: clienteCount,
    platformSampleSize: platformCount,
  };
}

// ============================================================================
// P2P aggregation (CLI-V2-04)
// ============================================================================

/** One row of the P2P transactions table for the cliente dossier (CLI-V2-04). */
export interface ClienteP2PRow {
  /** Date of the P2P transaction. */
  fecha: Date;
  /** "in" (received by tikintag) or "out" (sent by tikintag). */
  direction: "in" | "out";
  /** Counterparty tikintag (sourceTransferTikintag when direction=in; destinationTransferTikintag when direction=out). undefined if Sheet cell empty. */
  contraparte: string | undefined;
  /** Monto in COP, signed per the underlying tx (direction=in is positive, direction=out is negative — UI takes Math.abs for display). */
  monto: number;
  /** Tx status (completed/rejected/etc). */
  status: string;
}

/**
 * P2P split + table for the cliente dossier (CLI-V2-04).
 *
 * Counts and montos count COMPLETED rows only (rejected P2Ps don't count
 * towards "actividad real"). The `rows` array carries ALL in-window P2Ps
 * regardless of status — completed AND rejected are both worth showing in
 * the dossier table (the user wants to see attempted-but-failed transfers).
 */
export interface ClienteP2P {
  /** Count of P2P direction=in completed transactions for tikintag. */
  countIn: number;
  /** Count of P2P direction=out completed transactions for tikintag. */
  countOut: number;
  /** Sum of monto for direction=in (positive). */
  montoIn: number;
  /** Absolute sum of monto for direction=out (positive — Math.abs applied). */
  montoOut: number;
  /** Last 50 P2P rows (any direction, any status), date DESC. Cap prevents pathological renders if a tikintag has thousands of P2Ps. */
  rows: ClienteP2PRow[];
}

/**
 * Compute P2P aggregations for a single tikintag in the filter window
 * (CLI-V2-04).
 *
 * Filter pipeline:
 *   1. `t.tipo === "P2P"` AND `t.empresa_id === tikintag` AND in Bogotá
 *      window from `filters.from`/`filters.to` (inclusive ends).
 *   2. Counters (`countIn`/`countOut`/`montoIn`/`montoOut`) honor
 *      `filters.status` CSV with default `["completed"]`. A rejected P2P
 *      attempt didn't actually move money so it shouldn't bloat the
 *      "envío/recepción" KPIs.
 *   3. `rows` array carries ALL in-window P2Ps regardless of status — the
 *      table-level view of the dossier shows attempted+failed transfers
 *      for operator visibility (the v2 dossier's value-prop is "see
 *      everything about this client"). Cap at 50 rows (pathologically
 *      heavy P2P users could otherwise bloat the page render).
 *
 * Direction → counterparty mapping:
 *   - `direction === "in"`  → counterparty = `t.sourceTransferTikintag`
 *     (the SENDER who pushed money to this user).
 *   - `direction === "out"` → counterparty = `t.destinationTransferTikintag`
 *     (the RECEIVER this user pushed money to).
 *   - undefined when the source-row's transfer-tikintag cell is empty;
 *     the UI renders `—` in that case.
 *
 * `filters.tipo` is INTENTIONALLY ignored here — this aggregation is
 * P2P-by-definition (consistent with `filterBonosV2` BONUS-by-def,
 * `filterPayoutsV2` PAYOUT-by-def, `filterPurchases` PURCHASE-by-def).
 *
 * Pure. Empty input → `{ countIn: 0, countOut: 0, montoIn: 0, montoOut: 0,
 * rows: [] }`. Never NaN.
 *
 * @example
 *   aggregateClienteP2P(allTx, "$mario", { from: "2026-04-01", to: "2026-04-30" })
 *   // → { countIn: 5, countOut: 3, montoIn: 250000, montoOut: 180000,
 *   //     rows: [
 *   //       { fecha: <Date>, direction: "in",  contraparte: "$ana",   monto: 100000, status: "completed" },
 *   //       { fecha: <Date>, direction: "out", contraparte: "$pedro", monto: -50000, status: "completed" },
 *   //       ...
 *   //     ] }
 */
export function aggregateClienteP2P(
  transactions: Transaction[],
  tikintag: string,
  filters: DashboardFilters,
): ClienteP2P {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const counterStatusSet =
    filters.status && filters.status.length > 0
      ? new Set<string>(filters.status)
      : new Set<string>(["completed"]);

  let countIn = 0;
  let countOut = 0;
  let montoIn = 0;
  let montoOut = 0;
  const rows: ClienteP2PRow[] = [];

  for (const t of transactions) {
    if (t.tipo !== "P2P") continue;
    if (t.empresa_id !== tikintag) continue;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < fromTs || ts > toTs) continue;

    // Determine direction class. Schema may carry "OTRO_DIRECTION"
    // defensively; a P2P with that direction can't be classified for the
    // KPI splits but we still surface the row in the table.
    const isIn = t.direction === "in";
    const isOut = t.direction === "out";

    // Row collection (ALL statuses).
    if (isIn || isOut) {
      const contraparte = isIn
        ? t.sourceTransferTikintag
        : t.destinationTransferTikintag;
      rows.push({
        fecha: t.fecha,
        direction: isIn ? "in" : "out",
        contraparte,
        monto: t.monto,
        status: t.status,
      });
    }

    // Counter accumulation: status-filtered (default completed).
    if (counterStatusSet.has(t.status)) {
      if (isIn) {
        countIn += 1;
        montoIn += t.monto;
      } else if (isOut) {
        countOut += 1;
        montoOut += Math.abs(t.monto);
      }
    }
  }

  // Sort rows by fecha DESC. Client-side paginator (UltimasP2PTable) slices
  // 10-at-a-time — the historical tail stays accessible via pagination.
  rows.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return {
    countIn,
    countOut,
    montoIn,
    montoOut,
    rows,
  };
}

// ============================================================================
// Timeline aggregation (CLI-V2-05 / CLI-V2-08)
// ============================================================================

/**
 * Bucketed event types for the chronological timeline (CLI-V2-05).
 *
 * The UI (Plan 09-02 `TimelineActivity.tsx`) maps each value to an icon
 * + color per the v2.0 design palette. `OTRO` is a defensive fallback so
 * unrecognized future tipos surface in the timeline rather than silently
 * disappearing — same convention as the `OTRO`/`OTRO_STATUS`/`OTRO_DIRECTION`
 * fallbacks throughout the schema layer.
 */
export type ClienteTimelineEventType =
  | "BONUS_IN"
  | "BONUS_OUT"
  | "P2P_IN"
  | "P2P_OUT"
  | "PURCHASE"
  | "RECHARGE_PSE"
  | "RECHARGE_TRANSFER"
  | "PAYOUT_BANK"
  | "OTRO";

/** One event in the cliente's chronological timeline (CLI-V2-05). */
export interface ClienteTimelineEvent {
  /** Stable id for React keys. transaction_id when sourced from Transaction; payout transactionId when sourced from Payout. */
  id: string;
  /** Bucketed event type for icon/color rendering. */
  type: ClienteTimelineEventType;
  /** Event date (Bogotá-anchored timestamp). */
  fecha: Date;
  /** Display monto in COP (always positive — direction encoded in `type`). 0 when monto absent. */
  monto: number;
  /** Counterparty / destination label. Bonos+P2P → tikintag of peer; Payouts → bank `medium`; Purchases → empresa_nombre; PAYINs → method ("PSE" / "Transfer"). */
  counterparty: string | undefined;
  /** Transaction status pass-through ("completed" / "rejected" / payout state for PAYOUT_BANK). */
  status: string;
}

/**
 * Classify a Transaction row to its timeline event type. Pure helper for
 * `aggregateClienteTimeline` — encapsulates the tipo → ClienteTimelineEventType
 * mapping so the main loop stays flat.
 */
function classifyTransactionEvent(t: Transaction): ClienteTimelineEventType {
  switch (t.tipo) {
    case "BONUS":
      if (t.direction === "in") return "BONUS_IN";
      if (t.direction === "out") return "BONUS_OUT";
      return "OTRO";
    case "P2P":
      if (t.direction === "in") return "P2P_IN";
      if (t.direction === "out") return "P2P_OUT";
      return "OTRO";
    case "PURCHASE":
      return "PURCHASE";
    case "PAYIN_PSE":
      return "RECHARGE_PSE";
    case "PAYIN_TRANSFER":
      return "RECHARGE_TRANSFER";
    default:
      return "OTRO";
  }
}

/**
 * Derive counterparty label for a Transaction-sourced timeline event.
 * Centralizes the per-tipo label rule so the main loop stays flat.
 */
function counterpartyForTransaction(
  t: Transaction,
  type: ClienteTimelineEventType,
): string | undefined {
  switch (type) {
    case "BONUS_IN":
    case "P2P_IN":
      return t.sourceTransferTikintag;
    case "BONUS_OUT":
    case "P2P_OUT":
      return t.destinationTransferTikintag;
    case "PURCHASE":
      // Phase 2 default: empresa_nombre === tikintag (the merchant). Phase
      // 9+ may evolve this when BD_Plataforma surfaces a true merchant col.
      return t.empresa_nombre || undefined;
    case "RECHARGE_PSE":
      return "PSE";
    case "RECHARGE_TRANSFER":
      return "Transfer";
    default:
      return undefined;
  }
}

/**
 * Build the chronological timeline of activity events for a single
 * tikintag (CLI-V2-05). Merges two sources:
 *
 *   1. **Transaction events** — every `transactions` row whose
 *      `empresa_id === tikintag` and falls in the Bogotá window.
 *      Mapped by tipo+direction to a `ClienteTimelineEventType`.
 *   2. **Payout events** — every `joinedPayouts` row whose joined
 *      `transaction.empresa_id === tikintag`. Always classified as
 *      `PAYOUT_BANK` (the only tipo in BD_Payouts). counterparty =
 *      `p.medium` (bank code), status = `p.state`.
 *
 * The merged stream is sorted by `fecha.getTime()` DESCENDING and capped at
 * 200 events. UI (Plan 09-02 TimelineActivity.tsx) renders all items the
 * domain emits — no client-side pagination, the cap is the only pagination.
 *
 * `monto` is always returned positive (`Math.abs(t.monto || 0)` /
 * `Math.abs(p.monto || 0)`). The DIRECTION semantic is encoded in `type`
 * (BONUS_IN vs BONUS_OUT) — the leaf renders "+/-" prefixes based on
 * type, not on a signed monto.
 *
 * `filters.status` and `filters.tipo` are INTENTIONALLY ignored: the
 * timeline is a "show everything that happened" view; status badges are
 * rendered per row from `event.status`. Filtering by status would defeat
 * the timeline's purpose (operator wants to see WHY a payout failed —
 * filtering out failed payouts hides the very thing they're investigating).
 *
 * Pure. Empty inputs → `[]`. O(n + m) where n = transactions, m = payouts.
 *
 * @example
 *   aggregateClienteTimeline(allTx, joinedPayouts, "$mario",
 *                            { from: "2026-04-01", to: "2026-04-30" })
 *   // → [
 *   //     { id: "tx_847", type: "BONUS_IN",    fecha: <Date 2026-04-29>, monto: 50000,  counterparty: "$ana",        status: "completed" },
 *   //     { id: "tx_812", type: "PURCHASE",    fecha: <Date 2026-04-25>, monto: 12500,  counterparty: "Pollos Mario", status: "completed" },
 *   //     { id: "po_113", type: "PAYOUT_BANK", fecha: <Date 2026-04-20>, monto: 200000, counterparty: "bancolombia", status: "completed" },
 *   //   ]
 */
export function aggregateClienteTimeline(
  transactions: Transaction[],
  joinedPayouts: JoinedPayout[],
  tikintag: string,
  filters: DashboardFilters,
): ClienteTimelineEvent[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);
  const events: ClienteTimelineEvent[] = [];

  // Source 1: Transaction rows attributable to tikintag.
  for (const t of transactions) {
    if (t.empresa_id !== tikintag) continue;
    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < fromTs || ts > toTs) continue;

    const type = classifyTransactionEvent(t);
    const counterparty = counterpartyForTransaction(t, type);
    const monto = Math.abs(Number.isFinite(t.monto) ? t.monto : 0);

    events.push({
      id: t.id,
      type,
      fecha: t.fecha,
      monto,
      counterparty,
      status: t.status,
    });
  }

  // Source 2: Payout rows joined to tikintag.
  for (const p of joinedPayouts) {
    if (p.transaction?.empresa_id !== tikintag) continue;
    const ts = p.fecha.getTime();
    if (!Number.isFinite(ts)) continue;
    if (ts < fromTs || ts > toTs) continue;

    const monto = Math.abs(Number.isFinite(p.monto) ? p.monto : 0);

    events.push({
      id: p.transactionId,
      type: "PAYOUT_BANK",
      fecha: p.fecha,
      monto,
      counterparty: p.medium || undefined,
      status: p.state,
    });
  }

  // Sort DESC by date. Client-side paginator (TimelineActivity) slices the
  // feed 10-at-a-time so the historical tail stays reachable via the pager.
  events.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  return events;
}

