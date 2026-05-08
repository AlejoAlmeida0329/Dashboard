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

// Note on imports: the Task-2 functions (`aggregateClienteP2P` /
// `aggregateClienteTimeline`) will append `formatInTimeZone` from `date-fns-tz`
// (for Bogotá date math), the day-boundary helpers, and the `Payout` /
// `BOGOTA_TZ` symbols. They are deliberately deferred from Task 1 to keep
// the lint surface clean (no `unused-vars` warnings during the inter-task
// commit window). The plan declares this module's full import contract in
// its `<action>` block; Task 2's append fulfills it.

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

