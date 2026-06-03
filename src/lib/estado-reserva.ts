// Estado efectivo de una reserva, derivado de la hora actual (zona España).
//
// La BD persiste el estado y un cron (update-states) lo va moviendo, pero el cron
// corre periódicamente: entre ejecuciones, una reserva "confirmada" cuya salida ya
// empezó seguiría mostrándose como "confirmada". Para el operario el estado debe ser
// SIEMPRE el real en este instante, así que lo recalculamos al pintar.
//
// Solo se derivan los estados del ciclo de vida temporal (confirmada → en_curso →
// completada). Los estados de gestión (pendiente, cancelada, rechazada, conflicto)
// los decide una persona y se respetan tal cual.
//
// El override manual persiste de forma MONÓTONA: el estado mostrado nunca retrocede
// por debajo del que el operario fijó a mano. Si marca "Completada" antes de la hora
// de fin (el cliente devolvió antes), se mantiene Completada; el tiempo solo puede
// avanzar el estado, nunca rebajarlo. Así no hace falta una columna extra en la BD.

// Orden del ciclo temporal (mayor = más avanzado)
const RANGO: Record<string, number> = { confirmada: 0, en_curso: 1, completada: 2 };

function toMins(hora: string): number {
  const [h, m] = (hora ?? "09:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

// Estado que dicta el reloj para una reserva del ciclo temporal
function estadoPorTiempo(r: { fecha?: string | null; hora?: string | null; horas_consumidas?: number | null }): string {
  const ahora = new Date();
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(ahora);
  const horaEspana = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(ahora);

  const fecha   = String(r.fecha ?? "").slice(0, 10);
  const nowMins = toMins(horaEspana);
  const start   = toMins(r.hora ?? "09:00");
  const end     = start + Math.max(1, Number(r.horas_consumidas ?? 4)) * 60;

  if (fecha < hoy) return "completada";
  if (fecha > hoy) return "confirmada";
  // Es hoy
  if (nowMins < start) return "confirmada";
  if (nowMins < end)   return "en_curso";
  return "completada";
}

export function estadoEfectivo(r: {
  estado: string;
  fecha?: string | null;
  hora?: string | null;
  horas_consumidas?: number | null;
}): string {
  if (!(r.estado in RANGO)) return r.estado; // pendiente, cancelada, rechazada, conflicto → tal cual

  const porTiempo = estadoPorTiempo(r);
  // Nunca retroceder por debajo del estado fijado en BD (override manual del operario)
  return RANGO[porTiempo] >= RANGO[r.estado] ? porTiempo : r.estado;
}
