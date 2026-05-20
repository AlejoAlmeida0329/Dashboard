/**
 * Business-hours utilities anchored to Bogotá (UTC-5, sin DST).
 *
 * SLA de Tikin: 12 horas hábiles desde la creación del payout hasta su
 * completado. Hora hábil = 08:00 a 18:00, lunes a viernes, excluyendo
 * festivos colombianos.
 *
 * Por qué importa medir en horas hábiles (no calendario):
 *   Un payout iniciado un viernes a las 17:00 que se completa el lunes a
 *   las 09:00 muestra ~64h calendario, pero en horas hábiles tardó solo
 *   1h (17:00→18:00 viernes + 08:00→09:00 lunes). Mostrar las dos
 *   lecturas separa "tiempo wall-clock que ve el usuario" de "tiempo
 *   contra promesa comercial".
 *
 * Para extender festivos:
 *   Agregá las fechas en `COLOMBIAN_HOLIDAYS_BOGOTA` en formato YYYY-MM-DD.
 *   El cómputo es O(1) en el lookup por día.
 */

/** Festivos colombianos 2025-2026 (incluye movibles por Ley Emiliani). */
export const COLOMBIAN_HOLIDAYS_BOGOTA: ReadonlySet<string> = new Set([
  // 2025
  "2025-01-01", // Año Nuevo
  "2025-01-06", // Reyes Magos
  "2025-03-24", // San José (movido)
  "2025-04-17", // Jueves Santo
  "2025-04-18", // Viernes Santo
  "2025-05-01", // Día del Trabajo
  "2025-06-02", // Ascensión (movido)
  "2025-06-23", // Corpus Christi (movido)
  "2025-06-30", // Sagrado Corazón (movido)
  "2025-07-20", // Independencia
  "2025-08-07", // Batalla de Boyacá
  "2025-08-18", // Asunción (movido)
  "2025-10-13", // Día de la Raza (movido)
  "2025-11-03", // Todos los Santos (movido)
  "2025-11-17", // Independencia de Cartagena (movido)
  "2025-12-08", // Inmaculada Concepción
  "2025-12-25", // Navidad
  // 2026
  "2026-01-01",
  "2026-01-12", // Reyes Magos (movido)
  "2026-03-23", // San José (movido)
  "2026-04-02", // Jueves Santo
  "2026-04-03", // Viernes Santo
  "2026-05-01",
  "2026-05-18", // Ascensión (movido)
  "2026-06-08", // Corpus Christi (movido)
  "2026-06-15", // Sagrado Corazón (movido)
  "2026-07-20",
  "2026-08-07",
  "2026-08-17", // Asunción (movido)
  "2026-10-12", // Día de la Raza
  "2026-11-02", // Todos los Santos (movido)
  "2026-11-16", // Independencia de Cartagena (movido)
  "2026-12-08",
  "2026-12-25",
]);

/** SLA de Tikin para payouts a banco. */
export const SLA_BUSINESS_HOURS = 12;
export const SLA_BUSINESS_MINUTES = SLA_BUSINESS_HOURS * 60;

/** Horario hábil diario en Bogotá. */
const BUSINESS_HOUR_START = 8; // 08:00
const BUSINESS_HOUR_END = 18; // 18:00

const COT_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Verdict contra el SLA de 12h. */
export type SlaVerdict = "within" | "breached";

export function slaStatus(businessMinutes: number): SlaVerdict {
  return businessMinutes <= SLA_BUSINESS_MINUTES ? "within" : "breached";
}

// --- Bogotá date helpers ---------------------------------------------------

/** YYYY-MM-DD del instante en Bogotá. */
function bogotaDateKey(ms: number): string {
  const shifted = new Date(ms + COT_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Timestamp UTC para `dayKey` a `hour:minute` Bogotá. */
function bogotaInstant(dayKey: string, hour: number, minute = 0): number {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return Date.parse(`${dayKey}T${hh}:${mm}:00-05:00`);
}

/** Avanza un día calendario (Bogotá) desde un YYYY-MM-DD. */
function nextDayKey(dayKey: string): string {
  // Parse al mediodía UTC para evitar bordes de DST en otros TZs accidentales.
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Es sábado o domingo en Bogotá. */
function isWeekend(dayKey: string): boolean {
  const dow = new Date(`${dayKey}T12:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

/** Es día hábil: ni fin de semana ni festivo colombiano. */
export function isBusinessDay(dayKey: string): boolean {
  return !isWeekend(dayKey) && !COLOMBIAN_HOLIDAYS_BOGOTA.has(dayKey);
}

// --- Core API --------------------------------------------------------------

/**
 * Cuenta los minutos hábiles entre `start` y `end` aplicando la ventana
 * 08:00–18:00 COT, excluyendo fines de semana y festivos.
 *
 * Comportamiento:
 *   - end <= start  → 0 (defensivo)
 *   - Día no hábil  → contribuye 0
 *   - Día hábil     → intersección de [start, end] con [08:00, 18:00] COT
 *
 * Pura. O(días_calendario_entre_start_y_end).
 *
 * @example
 *   // Viernes 17:00 → Lunes 09:00 (mismo TZ)
 *   businessMinutesBetween(viernes17, lunes09)
 *   // → 60 (17:00-18:00 viernes) + 60 (08:00-09:00 lunes) = 120
 */
export function businessMinutesBetween(start: Date, end: Date): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  if (endMs <= startMs) return 0;

  let total = 0;
  let dayKey = bogotaDateKey(startMs);
  const endDayKey = bogotaDateKey(endMs);

  // Cortacircuito de seguridad: ningún payout debería abarcar más de 5 años.
  let safety = 2000;

  while (safety-- > 0) {
    if (isBusinessDay(dayKey)) {
      const winOpen = bogotaInstant(dayKey, BUSINESS_HOUR_START);
      const winClose = bogotaInstant(dayKey, BUSINESS_HOUR_END);
      const segStart = Math.max(startMs, winOpen);
      const segEnd = Math.min(endMs, winClose);
      if (segEnd > segStart) {
        total += (segEnd - segStart) / 60000;
      }
    }
    if (dayKey === endDayKey) break;
    dayKey = nextDayKey(dayKey);
  }

  return total;
}

/**
 * Helper específico para payouts: dado el inicio (`fecha`) y la duración
 * total en segundos (`latencySeconds`, que en payouts completados representa
 * `Total Time`), devuelve los minutos hábiles transcurridos.
 */
export function payoutBusinessMinutes(
  fecha: Date,
  latencySeconds: number,
): number {
  if (!Number.isFinite(latencySeconds) || latencySeconds <= 0) return 0;
  const end = new Date(fecha.getTime() + latencySeconds * 1000);
  return businessMinutesBetween(fecha, end);
}
