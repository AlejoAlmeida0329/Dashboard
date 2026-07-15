/**
 * Clientes (empresas-INDEX) domain — pure aggregations over `Transaction[]`
 * for the /clientes list page (CLI-01..04).
 *
 * This module is the SINGLE SOURCE OF TRUTH for "qué es una empresa",
 * "cuándo está activa", "cuál es su histórico vs el período". UI consumers
 * (Plan 05-02 components, Plan 05-04 page composition) import the functions
 * here and stay dumb about the underlying data shape. Mirror of `bonos.ts`
 * / `recargas.ts` design rules — same shape, same purity guarantees,
 * adapted to empresa-centric aggregations.
 *
 * Design rules (deliberate, mirror of bonos.ts/recargas.ts):
 *   - NO imports from `next/`, `react`, `server-only`, `lib/sheets/`, or
 *     `lib/format`. This makes every function callable from Server
 *     Components, Client Components, scripts, and (future) tests without
 *     setup.
 *   - All functions are pure: same input → same output, no side effects.
 *   - Date math is anchored to "America/Bogota" (UTC-5, no DST) — same
 *     convention as `url-state.ts` / `bonos.ts` / `recargas.ts` so filters
 *     and aggregations agree on what "a day" means.
 *
 * Per-empresa-DOSSIER concerns vs empresas-INDEX concerns:
 *   This module is the empresas-INDEX module — it powers the /clientes
 *   LIST page (table of all empresas). Per-tikintag dossier aggregations
 *   (cabecera, benchmark, P2P, timeline) live in `cliente.ts` (singular)
 *   alongside the Vista Cliente v2 dossier route. The two modules
 *   intentionally coexist (different scopes, different consumers, different
 *   shapes).
 *
 * Post Plan 09-03 prune: the v1 profile-page surface (findEmpresa,
 * EmpresaProfileSummary, aggregateMonthlyActivity, MonthlyActivity) was
 * deleted once the v1 /clientes/[empresaId] page was rewritten as the
 * Vista Cliente v2 dossier. The dossier consumes `cliente.ts` instead.
 *
 * --- Clientes Domain Contract ---
 *
 * - **An empresa** = one distinct `empresa_id` seen across BD_Plataforma
 *   transactions. Today (Phase 2 decision) `empresa_id === tikintag`; once
 *   BD_Plataforma adds a real display-name column, this module surfaces it
 *   automatically via the schema's transform.
 *
 * - **Status convention**: `'activa'` = the empresa has ≥1 activity-counting
 *   tx (direction='in' AND status='completed') in the date filter window;
 *   `'inactiva'` = does not. Tying status to the filter window (not to a
 *   fixed "last 30 days") lets the user explore "who was active in Q1
 *   vs Q2" by adjusting the date range — the dashboard's filters double as
 *   activity probes.
 *
 * - **Histórico vs Período**: `montoHistorico` is absolute — sum across
 *   ALL TIME of activity-counting tx for the empresa, regardless of the
 *   filter window. `montoPeriod` is sum within the filter window. Both are
 *   produced from a SINGLE pass over transactions to amortize the cost
 *   (the list page renders both columns side-by-side).
 *
 * - **Empresa filter is IGNORED for the index**: the table on /clientes
 *   shows all empresas, regardless of `filters.empresa`. The empresa filter
 *   in the URL is a profile-picker (Plan 05-04 routes `?empresa=$mario` to
 *   /clientes/$mario), NOT a row-narrowing operator on the index. Documented
 *   inline in `deriveEmpresasIndex` JSDoc.
 *
 * - **The "activity-counting" predicate** = `direction === 'in' && status
 *   === 'completed'`. Universal across bonos / recargas / inicio: a tx
 *   counts as activity only if money actually arrived. Rejected tx never
 *   landed money; outflows are downstream of activity (refunds, payouts,
 *   fees) and would double-count if they triggered "activa".
 */

import { payoutBusinessMinutes } from "@/lib/business-hours";
import type { JoinedPayout } from "./join";
import type { Transaction } from "./types";
import type { DashboardFilters } from "@/lib/url-state";

// --- Date parse helpers -----------------------------------------------------

/**
 * Parse a `YYYY-MM-DD` filter string as the START of that day in Bogotá
 * (i.e. 00:00:00 COT, which is 05:00:00 UTC). Returns `-Infinity` if the
 * string is missing or unparseable so callers can use `>=` without
 * special-casing.
 *
 * We intentionally do NOT use `new Date(s)` because that interprets
 * `'2026-04-27'` as midnight UTC, which is 19:00 the previous day in
 * Bogotá — silent off-by-one for every range filter.
 *
 * Verbatim copy from `bonos.ts` / `recargas.ts`. DRY-ing across modules
 * costs more than the inline ~10 lines (would require a new shared util
 * that's imported by every domain module; the inline cost is a one-time
 * copy).
 */
function startOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.NEGATIVE_INFINITY;
  // Cheap shape check: we expect strict YYYY-MM-DD from `url-state.ts`.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.NEGATIVE_INFINITY;
  // Bogotá is UTC-5 with no DST. 00:00 in Bogotá == 05:00 UTC.
  const t = Date.parse(`${s}T00:00:00-05:00`);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

/**
 * Parse a `YYYY-MM-DD` filter string as the END of that day in Bogotá
 * (i.e. 23:59:59.999 COT). Returns `+Infinity` if missing/unparseable.
 *
 * The "end of day" semantic matters: a user setting `to=2026-04-29`
 * expects to see transactions stamped at 22:00 on the 29th included.
 *
 * Verbatim copy from `bonos.ts`.
 */
function endOfDayBogotaTimestamp(s: string | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(`${s}T23:59:59.999-05:00`);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

// --- Predicates -------------------------------------------------------------

/**
 * "Activity-counting" predicate. Mirror of the bonos / recargas / inicio
 * filter contracts: only completed inflows count as activity. Direction='in'
 * + status='completed' is the universal "money actually arrived" gate.
 */
function isActivityCounting(t: Transaction): boolean {
  return t.direction === "in" && t.status === "completed";
}

// --- Output types -----------------------------------------------------------

/** Activity status of an empresa in the current filter window. */
export type EmpresaStatus = "activa" | "inactiva";

/** One row in the /clientes list table. */
export interface EmpresaListRow {
  empresa_id: string;
  empresa_nombre: string;
  /** Count of activity-counting tx in date filter window. */
  txPeriod: number;
  /** Sum of monto for activity-counting tx in date filter window (COP). */
  montoPeriod: number;
  /** Sum of monto for activity-counting tx across ALL TIME (COP). */
  montoHistorico: number;
  /** Most recent activity-counting tx fecha across ALL TIME. */
  ultimaActividad: Date;
  /** Most recent activity-counting tx fecha WITHIN date filter window; null if none. */
  ultimaActividadInPeriod: Date | null;
  /** 'activa' if ultimaActividadInPeriod is non-null; else 'inactiva'. */
  status: EmpresaStatus;
}

/** Header KPIs for /clientes list page. */
export interface EmpresasIndexSummary {
  totalEmpresas: number;
  empresasActivas: number;
}

// --- Aggregations -----------------------------------------------------------

/**
 * Build the per-empresa index that powers the /clientes list table.
 *
 * Algorithm (single pass over `transactions`):
 *   1. For each activity-counting tx (direction='in' && status='completed'):
 *      - Lookup or create per-empresa accumulator keyed by `empresa_id`.
 *      - Accumulate `txHistorico++`, `montoHistorico += monto`.
 *      - Update `ultimaActividad` to max(ultimaActividad, tx.fecha).
 *      - If the tx's fecha falls within `[fromTs, toTs]` (Bogotá-anchored):
 *        - Accumulate `txPeriod++`, `montoPeriod += monto`.
 *        - Update `ultimaActividadInPeriod` to max(ultimaActividadInPeriod, tx.fecha).
 *   2. Empresa name is "first occurrence wins" per `empresa_id` (mirror of
 *      `empresas.ts` registry).
 *   3. Skip rows with empty / whitespace `empresa_id` defensively (a row
 *      should never reach here with empty empresa_id given the schema, but
 *      this guard prevents a phantom blank row in the table if data drifts).
 *   4. `status = 'activa'` if `ultimaActividadInPeriod !== null`, else
 *      `'inactiva'`.
 *   5. Sort the output by `montoHistorico` DESC (largest empresas first;
 *      matches the Bonos-leaderboard convention).
 *
 * The empresa filter (`filters.empresa`) is **IGNORED** here on purpose:
 * the /clientes table is the place where the user picks an empresa, NOT
 * where they narrow to one. Plan 05-04 routes a clicked row to
 * `/clientes/$mario` (or whatever empresa_id) which then renders the
 * Vista Cliente v2 dossier (Phase 9). Narrowing the index would defeat
 * the table's purpose.
 *
 * Pure: returns a new array; does not mutate `transactions`.
 *
 * @example
 *   deriveEmpresasIndex(allTx, { from: '2026-04-01', to: '2026-04-30' })
 *   // → [
 *   //     { empresa_id: '$mario',    montoHistorico: 5_000_000, montoPeriod: 1_200_000, status: 'activa', ... },
 *   //     { empresa_id: '$tikincol', montoHistorico: 3_500_000, montoPeriod:         0, status: 'inactiva', ... },
 *   //   ]
 */
export function deriveEmpresasIndex(
  transactions: Transaction[],
  filters: DashboardFilters,
): EmpresaListRow[] {
  const fromTs = startOfDayBogotaTimestamp(filters.from);
  const toTs = endOfDayBogotaTimestamp(filters.to);

  // Per-empresa accumulator. We keep `txHistorico` internal (not in the
  // EmpresaListRow output) — the list table doesn't need it; the dossier
  // (Phase 9 cliente.ts) carries its own per-tikintag totals.
  type Acc = EmpresaListRow & { txHistorico: number };
  const byEmpresa = new Map<string, Acc>();

  for (const t of transactions) {
    if (!isActivityCounting(t)) continue;
    const id = t.empresa_id;
    if (!id || id.trim().length === 0) continue;
    // Sólo identidades $username. Las phone-format son la primera tx
    // pre-registro del mismo usuario y duplicarían la lista (backend
    // 2026-05-21).
    if (!id.startsWith("$")) continue;

    const ts = t.fecha.getTime();
    if (!Number.isFinite(ts)) continue;
    const inWindow = ts >= fromTs && ts <= toTs;

    let cur = byEmpresa.get(id);
    if (!cur) {
      cur = {
        empresa_id: id,
        empresa_nombre: t.empresa_nombre || id,
        txHistorico: 0,
        txPeriod: 0,
        montoPeriod: 0,
        montoHistorico: 0,
        ultimaActividad: t.fecha,
        ultimaActividadInPeriod: null,
        status: "inactiva",
      };
      byEmpresa.set(id, cur);
    }

    cur.txHistorico += 1;
    cur.montoHistorico += t.monto;
    if (t.fecha.getTime() > cur.ultimaActividad.getTime()) {
      cur.ultimaActividad = t.fecha;
    }

    if (inWindow) {
      cur.txPeriod += 1;
      cur.montoPeriod += t.monto;
      if (
        cur.ultimaActividadInPeriod === null ||
        t.fecha.getTime() > cur.ultimaActividadInPeriod.getTime()
      ) {
        cur.ultimaActividadInPeriod = t.fecha;
      }
    }
  }

  const rows: EmpresaListRow[] = Array.from(byEmpresa.values()).map((acc) => {
    // Strip the internal txHistorico from the output shape.
    const { txHistorico: _txHistorico, ...row } = acc;
    void _txHistorico;
    return {
      ...row,
      status: row.ultimaActividadInPeriod !== null ? "activa" : "inactiva",
    };
  });

  rows.sort((a, b) => b.montoHistorico - a.montoHistorico);
  return rows;
}

/**
 * Compute header KPIs for the /clientes list page from the index rows.
 *
 * Pure. Empty input → `{ totalEmpresas: 0, empresasActivas: 0 }`
 * (no NaN / Infinity).
 *
 * @example
 *   summarizeEmpresasIndex([
 *     { ..., status: 'activa' },
 *     { ..., status: 'activa' },
 *     { ..., status: 'inactiva' },
 *   ])
 *   // → { totalEmpresas: 3, empresasActivas: 2 }
 */
export function summarizeEmpresasIndex(
  rows: EmpresaListRow[],
): EmpresasIndexSummary {
  let empresasActivas = 0;
  for (const r of rows) {
    if (r.status === "activa") empresasActivas += 1;
  }
  return {
    totalEmpresas: rows.length,
    empresasActivas,
  };
}

/** Stats de colaboradores + payouts + compras para una empresa (Vista Cliente). */
export interface EmpresaCollaboratorStats {
  /**
   * Distinct count of collaborators: `destinationTransferTikintag` across
   * COMPLETED BONUS rows where `sourceTransferTikintag === empresa_id`. Se
   * excluyen self-bonos (sender === receiver) y filas con cualquiera de los
   * dos lados vacío.
   */
  collaboratorCount: number;
  /**
   * Distinct collaborators con al menos un PAYOUT_BANK (cualquier estado)
   * atribuido a su tikintag.
   */
  usersWithBankWithdrawalsCount: number;
  /**
   * Conteo de PAYOUT_BANK (JoinedPayout) cuya `transaction.empresa_id`
   * pertenece al set de colaboradores de la empresa. Incluye TODOS los
   * estados (completed/in_progress/failed).
   */
  bankWithdrawalsCount: number;
  /**
   * Suma de `monto` (COP) de los payouts COMPLETADOS de colaboradores.
   * Filtra a `state === 'completed'` para no inflar con intentos fallidos.
   */
  bankWithdrawalsTotal: number;
  /**
   * Ticket promedio de retiros = `bankWithdrawalsTotal / completados`.
   * `null` cuando no hay payouts completados.
   */
  bankWithdrawalsAvgTicket: number | null;
  /**
   * Promedio de `latencySeconds / 60` sobre payouts de colaboradores
   * RESTRINGIDO a `state === 'completed'` (failed/in_progress cargan el
   * fallback Aging y contaminarían la media — convención Phase 3).
   * `null` cuando no hay payouts completados.
   */
  avgPayoutMinutes: number | null;
  /**
   * Promedio de minutos hábiles (08:00–18:00 COT, L-V, sin festivos) sobre
   * los mismos payouts completados. Para comparar contra el SLA de 12h
   * hábiles. `null` cuando no hay payouts completados.
   */
  avgPayoutBusinessMinutes: number | null;
  /**
   * Distinct tikintags (de los colaboradores) que han hecho al menos una
   * PURCHASE direction='out' status='completed'.
   */
  cardUsersCount: number;
  /**
   * Conteo de PURCHASE direction='out' status='completed' rows donde
   * `empresa_id ∈ collaborators`.
   */
  cardPurchasesCount: number;
  /**
   * Suma de `Math.abs(monto)` (COP) de esas compras (PURCHASE-out trae monto
   * negativo en la convención de Phase 2; lo invertimos para sumar como
   * desembolso positivo, consistente con `summarizePurchases`).
   */
  cardPurchasesTotal: number;
  /**
   * Ticket promedio de compras = `cardPurchasesTotal / cardPurchasesCount`.
   * `null` cuando no hay compras.
   */
  cardPurchasesAvgTicket: number | null;
  /**
   * Breakdown de bancos donde retiran los colaboradores. Cada entry trae
   * el código `Payout.medium` (lowercased upstream) y la cantidad de
   * retiros sobre TODOS los estados — un retiro fallido a Bancolombia
   * sigue siendo evidencia de que ese banco se usa. Ordenado DESC por
   * count; tie-break alfabético.
   */
  banksBreakdown: { bank: string; count: number }[];
}

/** Fila de bonos emitidos agrupados por fecha (Bogotá). */
export interface BonosEmitidosPorFechaRow {
  /** `YYYY-MM-DD` Bogotá date. */
  fecha: string;
  /** Conteo de bonos emitidos en esa fecha. */
  bonosCount: number;
  /** Distinct colaboradores receptores en esa fecha. */
  colaboradoresCount: number;
  /** Suma de `Math.abs(monto)` (COP) de esos bonos. */
  montoTotal: number;
}

/**
 * Computa stats de "colaboradores + sus payouts" para UNA empresa (para
 * la card del dossier `/clientes/[empresaId]`).
 *
 * Modelo (decisión de producto): un "colaborador" de la empresa $E es un
 * tikintag T tal que existe un BONUS completado con
 * `sourceTransferTikintag === $E` AND `destinationTransferTikintag === T`.
 * Es el modelo "la empresa paga a sus usuarios por bono".
 *
 * Luego "los retiros de sus colaboradores" son los PAYOUT_BANK joineados
 * cuya transacción origen tiene `empresa_id ∈ colaboradores($E)`.
 *
 * NO se aplica ventana de fecha — el cliente quiere ver el rooster vitalicio
 * y la eficiencia agregada, no una porción.
 *
 * Pure.
 */
export function aggregateEmpresaCollaboratorStats(
  empresaId: string,
  transactions: Transaction[],
  joinedPayouts: JoinedPayout[],
): EmpresaCollaboratorStats {
  // 1. Set de colaboradores de la empresa. Sólo identidades $username
  // cuentan — los formato número-celular son la primera tx de un usuario
  // antes de crear su $username y duplicarían (backend 2026-05-21).
  const collaborators = new Set<string>();
  for (const t of transactions) {
    if (t.tipo !== "BONUS") continue;
    if (t.status !== "completed") continue;
    if (t.sourceTransferTikintag !== empresaId) continue;
    const receiver = t.destinationTransferTikintag;
    if (!receiver) continue;
    if (!receiver.startsWith("$")) continue;
    if (receiver === empresaId) continue;
    collaborators.add(receiver);
  }

  // 2. Walk payouts; cuenta los que correspondan a tikintags en el set.
  let bankWithdrawalsCount = 0;
  let bankWithdrawalsTotal = 0;
  let latencySum = 0;
  let businessMinutesSum = 0;
  let completedCount = 0;
  const usersWithWithdrawals = new Set<string>();
  const bankCounts = new Map<string, number>();
  for (const p of joinedPayouts) {
    const tikintag = p.transaction?.empresa_id;
    if (!tikintag) continue;
    if (!collaborators.has(tikintag)) continue;
    bankWithdrawalsCount += 1;
    usersWithWithdrawals.add(tikintag);
    const bank = p.medium || "OTRO_MEDIUM";
    bankCounts.set(bank, (bankCounts.get(bank) ?? 0) + 1);
    if (p.state === "completed" && Number.isFinite(p.latencySeconds)) {
      latencySum += p.latencySeconds;
      businessMinutesSum += payoutBusinessMinutes(p.fecha, p.latencySeconds);
      bankWithdrawalsTotal += p.monto;
      completedCount += 1;
    }
  }
  const banksBreakdown = Array.from(bankCounts.entries())
    .map(([bank, count]) => ({ bank, count }))
    .sort((a, b) =>
      b.count !== a.count ? b.count - a.count : a.bank.localeCompare(b.bank),
    );

  // 3. Walk PURCHASE-out completed rows; aggregate por colaborador.
  const cardUsers = new Set<string>();
  let cardPurchasesCount = 0;
  let cardPurchasesTotal = 0;
  for (const t of transactions) {
    if (t.tipo !== "PURCHASE") continue;
    if (t.direction !== "out") continue;
    if (t.status !== "completed") continue;
    if (!collaborators.has(t.empresa_id)) continue;
    cardUsers.add(t.empresa_id);
    cardPurchasesCount += 1;
    cardPurchasesTotal += Math.abs(t.monto);
  }

  return {
    collaboratorCount: collaborators.size,
    usersWithBankWithdrawalsCount: usersWithWithdrawals.size,
    bankWithdrawalsCount,
    bankWithdrawalsTotal,
    bankWithdrawalsAvgTicket:
      completedCount > 0 ? bankWithdrawalsTotal / completedCount : null,
    avgPayoutMinutes:
      completedCount > 0 ? latencySum / completedCount / 60 : null,
    avgPayoutBusinessMinutes:
      completedCount > 0 ? businessMinutesSum / completedCount : null,
    cardUsersCount: cardUsers.size,
    cardPurchasesCount,
    cardPurchasesTotal,
    cardPurchasesAvgTicket:
      cardPurchasesCount > 0 ? cardPurchasesTotal / cardPurchasesCount : null,
    banksBreakdown,
  };
}

/**
 * Agrega los BONUS-out emitidos por la empresa, agrupados por fecha Bogotá.
 *
 * Filtro: `tipo === 'BONUS'` AND `sourceTransferTikintag === empresaId` AND
 * `status === 'completed'`. Es la misma definición de "colaboradores" que
 * usa `aggregateEmpresaCollaboratorStats` — los receptores aquí son los
 * mismos colaboradores que se cuentan allá.
 *
 * Cada row trae:
 *   - `bonosCount` — cantidad de bonos en esa fecha
 *   - `colaboradoresCount` — distintos receptores en esa fecha
 *   - `montoTotal` — suma absoluta de monto
 *
 * Sin ventana de fecha (lifetime). Ordenado DESC por fecha (más reciente
 * primero — para paginación 10 por página, el cliente quiere ver lo
 * último arriba).
 *
 * Pure.
 */
export function aggregateBonosEmitidosPorFecha(
  transactions: Transaction[],
  empresaId: string,
): BonosEmitidosPorFechaRow[] {
  type Acc = {
    fecha: string;
    bonosCount: number;
    receivers: Set<string>;
    montoTotal: number;
  };
  const byDate = new Map<string, Acc>();
  for (const t of transactions) {
    if (t.tipo !== "BONUS") continue;
    if (t.status !== "completed") continue;
    if (t.sourceTransferTikintag !== empresaId) continue;
    // Sólo el lado OUT (sender). BD_Plataforma genera 2 filas espejo
    // por bono (sender direction='out' + receiver direction='in') y AMBAS
    // tienen `sourceTransferTikintag === empresaId`. Sin este guard,
    // `bonosCount` y `montoTotal` se duplican (bug verificado 2026-05-25
    // contra $skala día 21-may: 32 filas match → reportaba 15/16 bonos pero
    // monto doblado de $12.798.276 a $25.596.552).
    if (t.direction !== "out") continue;
    const receiver = t.destinationTransferTikintag;
    if (!receiver) continue;
    // `colaboradoresCount` cuenta TODOS los receivers distintos del día
    // (cualquier formato — $username o phone). Decisión de producto
    // 2026-05-25: aquí el cliente quiere "¿a cuántas personas distintas
    // les pagué hoy?", no la versión deduplicada $-only que usa la card
    // Tus Colaboradores para el rooster vitalicio.
    const fecha = bogotaDateKey(t.fecha);
    let acc = byDate.get(fecha);
    if (!acc) {
      acc = {
        fecha,
        bonosCount: 0,
        receivers: new Set<string>(),
        montoTotal: 0,
      };
      byDate.set(fecha, acc);
    }
    acc.bonosCount += 1;
    acc.receivers.add(receiver);
    acc.montoTotal += Math.abs(t.monto);
  }
  return Array.from(byDate.values())
    .map((a) => ({
      fecha: a.fecha,
      bonosCount: a.bonosCount,
      colaboradoresCount: a.receivers.size,
      montoTotal: a.montoTotal,
    }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Format `Date` → `YYYY-MM-DD` en Bogotá (UTC-5). */
function bogotaDateKey(d: Date): string {
  const shifted = new Date(d.getTime() + -5 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ============================================================================
// Colaboradores no registrados (usuarios que recibieron bonos y nunca crearon
// su $username)
// ============================================================================

/**
 * Umbral de bonos para clasificar un celular como "no registrado con certeza".
 *
 * El PRIMER bono de todo usuario siempre se paga a su número celular — es la
 * identidad inmutable antes de que cree su `$username` (backend 2026-05-21).
 * Por eso un celular con UN solo bono es ambiguo: puede ser (a) alguien que
 * nunca se registró, o (b) el primer bono de alguien que DESPUÉS se registró
 * (sus bonos siguientes ya salen bajo su `$username`, otra identidad).
 *
 * Con ≥2 bonos la ambigüedad desaparece: si tuviera cuenta, el segundo bono
 * habría ido al `$username`. Que sigan cayendo al celular prueba que al
 * momento de esos pagos NO tenía cuenta. Ese es el criterio de negocio.
 */
const MIN_BONOS_NO_REGISTRADO = 2;

/**
 * Normaliza un teléfono colombiano a su número nacional de 10 dígitos para
 * deduplicar el mismo celular escrito en formatos distintos.
 *
 * BD_Plataforma guarda el mismo número como `573106325908`, `+573106325908`,
 * `+3106325908` o `3106325908` según cómo se capturó. Sin normalizar, el
 * mismo usuario se contaría varias veces (y peor: sus 2 bonos se verían como
 * "2 personas con 1 bono", rompiendo el umbral). Quita todo lo no-dígito y,
 * si viene con código país (57 + 10 dígitos = 12), lo retira.
 */
function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^0-9]/g, "");
  if (digits.length === 12 && digits.startsWith("57")) {
    digits = digits.slice(2);
  }
  return digits;
}

/** Un colaborador no registrado: celular con ≥2 bonos que nunca creó `$username`. */
export interface ColaboradorNoRegistrado {
  /** Teléfono normalizado a 10 dígitos nacionales. */
  telefono: string;
  /** Cantidad de bonos que recibió esta persona (siempre ≥ MIN_BONOS_NO_REGISTRADO). */
  bonosCount: number;
}

/** Resultado de `aggregateColaboradoresNoRegistrados`. */
export interface ColaboradoresNoRegistrados {
  /** Cantidad de colaboradores no registrados (celulares distintos con ≥2 bonos). */
  count: number;
  /**
   * Celulares en formato número (no `$username`) que recibieron 1 solo bono.
   * Ambiguos por diseño (podrían ser primeros-bonos de gente ya registrada) —
   * NO se cuentan en `count`, pero se exponen para transparencia del denominador.
   */
  ambiguosCount: number;
  /** Lista de no registrados, ordenada DESC por `bonosCount` (luego teléfono ASC). */
  celulares: ColaboradorNoRegistrado[];
}

/**
 * Identifica los colaboradores de una empresa que recibieron bonos pero NUNCA
 * se registraron en la app (siguen en formato celular con ≥2 bonos).
 *
 * Método (dos pasos):
 *
 * PASO 1 — aprender qué celulares YA tienen cuenta. Cuando un usuario crea su
 * `$username`, la columna `tikintag` (dueño del wallet) de sus filas
 * `direction='in'` muestra ese `$username`, aunque el `destinationTransferTikintag`
 * histórico siga guardando su número celular. En una fila `in`, `tikintag` y
 * el destino son la MISMA persona (la que recibe), así que
 * `número → $username` es un enlace válido = "este celular ya se registró".
 * (En filas `out` el `tikintag` es el REMITENTE, no el receptor, y enlazaría
 * mal — por eso sólo se aprende de filas `in`.)
 *
 * PASO 2 — contar bonos de la empresa (`tipo==='BONUS'` AND `status==='completed'`
 * AND `direction==='out'` AND `sourceTransferTikintag===empresaId`) por receptor.
 * Un receptor es NO registrado si su `destinationTransferTikintag` es formato
 * celular (no `$`) Y ese número NO aparece en el mapa del Paso 1. Se agrupan
 * por teléfono normalizado y se reportan quienes acumulan ≥ MIN_BONOS_NO_REGISTRADO.
 *
 * Sin ventana de fecha (lifetime). Pure. O(n) en dos pasadas.
 */
export function aggregateColaboradoresNoRegistrados(
  transactions: Transaction[],
  empresaId: string,
): ColaboradoresNoRegistrados {
  // PASO 1: celulares que ya se registraron (aparecen con `$username` como
  // dueño del wallet en alguna fila `in`). Aprendido de TODA la plataforma —
  // si el número recibió cualquier cosa en un wallet con `$username`, tiene
  // cuenta, no sólo si fue un bono.
  const celularesRegistrados = new Set<string>();
  for (const t of transactions) {
    if (t.direction !== "in") continue;
    if (!t.tikintag.startsWith("$")) continue;
    const dst = t.destinationTransferTikintag;
    if (!dst || dst.startsWith("$")) continue;
    const tel = normalizePhone(dst);
    if (tel.length > 0) celularesRegistrados.add(tel);
  }

  // PASO 2: bonos-out de la empresa a receptores en formato celular que NO
  // están en el set de registrados.
  const bonosPorTelefono = new Map<string, number>();
  for (const t of transactions) {
    if (t.tipo !== "BONUS") continue;
    if (t.status !== "completed") continue;
    if (t.direction !== "out") continue;
    if (t.sourceTransferTikintag !== empresaId) continue;
    const receiver = t.destinationTransferTikintag;
    if (!receiver) continue;
    // Sólo formato celular: los `$username` ya están registrados.
    if (receiver.startsWith("$")) continue;
    const telefono = normalizePhone(receiver);
    if (telefono.length === 0) continue;
    // Este celular ya creó cuenta (aparece con `$username` en filas `in`).
    if (celularesRegistrados.has(telefono)) continue;
    bonosPorTelefono.set(telefono, (bonosPorTelefono.get(telefono) ?? 0) + 1);
  }

  const celulares: ColaboradorNoRegistrado[] = [];
  let ambiguosCount = 0;
  for (const [telefono, bonosCount] of bonosPorTelefono) {
    if (bonosCount >= MIN_BONOS_NO_REGISTRADO) {
      celulares.push({ telefono, bonosCount });
    } else {
      ambiguosCount += 1;
    }
  }

  celulares.sort((a, b) =>
    b.bonosCount !== a.bonosCount
      ? b.bonosCount - a.bonosCount
      : a.telefono.localeCompare(b.telefono),
  );

  return { count: celulares.length, ambiguosCount, celulares };
}
