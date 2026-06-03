"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { TARIFAS_MOTO, TARIFAS_BARCO, HORAS_CONSUMIDAS, FUENTES, DURACIONES_MOTO, DURACIONES_BARCO, type BarcoCategoria } from "@/lib/mock-data";

function toMins(hora: string): number {
  const [h, m] = (hora ?? "09:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

const ESTADOS_VALIDOS = ["pendiente", "confirmada", "en_curso", "completada", "cancelada"] as const;

export async function cambiarEstadoReserva(id: number, estado: string) {
  if (!ESTADOS_VALIDOS.includes(estado as any)) throw new Error("Estado no válido");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).maybeSingle();
  if (perfilError || !perfil) throw new Error("Perfil no encontrado");

  const { data: reserva, error: reservaError } = await supabase
    .from("reservas").select("sociedad_id, activo_id, horas_consumidas").eq("id", id).maybeSingle();
  if (reservaError || !reserva) throw new Error("Reserva no encontrada");

  if (perfil.rol !== "master" && perfil.sociedad_id !== reserva.sociedad_id) {
    throw new Error("Sin permiso para esta reserva");
  }

  const { error: updateError } = await supabase.from("reservas").update({ estado }).eq("id", id);
  if (updateError) throw new Error(updateError.message);

  // Al completar, sumar horas al activo
  if (estado === "completada" && reserva.activo_id && reserva.horas_consumidas) {
    const { data: activo } = await supabase
      .from("activos").select("horas_motor, horas_desde_servicio").eq("id", reserva.activo_id).maybeSingle();
    if (activo) {
      await supabase.from("activos").update({
        horas_motor: (activo.horas_motor ?? 0) + reserva.horas_consumidas,
        horas_desde_servicio: (activo.horas_desde_servicio ?? 0) + reserva.horas_consumidas,
      }).eq("id", reserva.activo_id);
      revalidatePath("/flota");
    }
  }

  revalidatePath("/reservas");
}

export async function eliminarReserva(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).maybeSingle();
  if (perfilError || !perfil) throw new Error("Perfil no encontrado");

  const { data: reserva, error: reservaError } = await supabase
    .from("reservas").select("sociedad_id").eq("id", id).maybeSingle();
  if (reservaError || !reserva) throw new Error("Reserva no encontrada");

  if (perfil.rol !== "master" && perfil.sociedad_id !== reserva.sociedad_id) {
    throw new Error("Sin permiso para esta reserva");
  }

  const { error: delError } = await supabase.from("reservas").delete().eq("id", id);
  if (delError) throw new Error(delError.message);
  revalidatePath("/reservas");
}

export async function crearReserva(data: {
  activo_id: string;
  activo_nombre: string;
  tipo: "moto" | "barco";
  cliente: string;
  fecha: string;
  hora: string;
  duracion: string;
  horas_consumidas: number;
  fuente: string;
  notas?: string;
}) {
  // La fecha debe ser hoy o posterior en hora de España
  const hoyEspana = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  if (data.fecha < hoyEspana) {
    throw new Error("No se pueden crear reservas en fechas pasadas.");
  }
  // Si es para hoy, la hora de salida no puede haber pasado ya (hora de España).
  // Se comparan minutos, no objetos Date, para evitar el desfase UTC al parsear strings.
  if (data.fecha === hoyEspana) {
    const horaEspana = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date());
    if (toMins(data.hora) < toMins(horaEspana)) {
      throw new Error("No se pueden crear reservas en horas ya pasadas.");
    }
  }

  const HORARIO = { apertura: 9, cierre: 21 };
  const [horaInicio, minInicio] = data.hora.split(":").map(Number);
  const minutosInicio = horaInicio * 60 + minInicio;
  if (minutosInicio < HORARIO.apertura * 60) {
    throw new Error(`Las salidas empiezan a las ${HORARIO.apertura}:00.`);
  }
  const horasActividad = HORAS_CONSUMIDAS[data.duracion] ?? 4;
  if (minutosInicio + horasActividad * 60 > HORARIO.cierre * 60) {
    throw new Error(`Esta reserva terminaría después de las ${HORARIO.cierre}:00. Elige una hora de salida anterior.`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  // Bloqueo por solapamiento horario (no por día completo): el negocio permite varias
  // reservas del mismo activo el mismo día en franjas que no se pisan. Solo cuentan como
  // conflicto las reservas ya comprometidas (confirmada/en_curso); las pendientes son
  // meras solicitudes que el operario resuelve en /reservas.
  const horas_consumidas = HORAS_CONSUMIDAS[data.duracion] ?? 4;
  const nuevaStart = toMins(data.hora);
  const nuevaEnd   = nuevaStart + horas_consumidas * 60;

  const { data: mismaFecha } = await supabase
    .from("reservas")
    .select("hora, horas_consumidas")
    .eq("activo_id", data.activo_id)
    .eq("fecha", data.fecha)
    .in("estado", ["confirmada", "en_curso"]);

  for (const s of mismaFecha ?? []) {
    const sStart = toMins(s.hora);
    const sEnd   = sStart + (s.horas_consumidas ?? 4) * 60;
    if (nuevaStart < sEnd && nuevaEnd > sStart) {
      throw new Error("Este activo ya tiene una reserva que se solapa con ese horario. Elige otra franja u otro activo.");
    }
  }

  if (!FUENTES.includes(data.fuente)) throw new Error("Fuente de reserva no válida.");

  const { data: activo, error: activoError } = await supabase
    .from("activos").select("sociedad_id, licencia, capacidad, tipo, estado").eq("id", data.activo_id).maybeSingle();
  if (activoError || !activo) throw new Error("Activo no encontrado");

  // El estado solo se filtraba en el cliente (NuevaReservaModal). Una llamada directa a la
  // server action podía reservar un activo en MANTENIMIENTO/ALERTA. Se valida en servidor.
  if (activo.estado !== "ACTIVO") {
    throw new Error("Este activo no está disponible para reservas (en mantenimiento o alerta).");
  }

  // El tipo lo decide el activo en BD, nunca el payload del cliente (evita inyección de precio:
  // declarar tipo "moto" sobre un barco para pagar la tarifa de moto).
  const tipo = activo.tipo as "moto" | "barco";

  // La duración debe pertenecer al catálogo del tipo de activo. Sin esto, una duración
  // fuera de catálogo caería en TARIFAS_MOTO[d] ?? 0 (alquiler gratis) y HORAS_CONSUMIDAS[d] ?? 4
  // (contador de mantenimiento descuadrado).
  const DURACIONES_VALIDAS = tipo === "moto" ? DURACIONES_MOTO : DURACIONES_BARCO;
  if (!DURACIONES_VALIDAS.includes(data.duracion)) {
    throw new Error("Duración no válida para este tipo de activo.");
  }

  // Precio calculado en servidor a partir del tipo real del activo
  let ingreso_neto: number;
  if (tipo === "moto") {
    ingreso_neto = TARIFAS_MOTO[data.duracion] ?? 0;
  } else {
    const cat: BarcoCategoria = activo.licencia ? "con_licencia"
      : (activo.capacidad ?? 6) >= 7 ? "sin_licencia_7" : "sin_licencia_6";
    const t = TARIFAS_BARCO[cat];
    ingreso_neto = data.duracion === "Medio día" ? t.medio_dia : t.dia_completo;
  }

  const { error } = await supabase.from("reservas").insert({
    ...data,
    tipo,               // sobrescribe el tipo del cliente con el real del activo
    horas_consumidas,
    sociedad_id: activo.sociedad_id,
    estado: "confirmada",
    ingreso_neto,
  });
  if (error) {
    console.error("[crearReserva] DB error:", error);
    // 23P01 = exclusion_violation (constraint reserva_no_solape) · 23505 = unique_violation.
    // Backstop atómico: cierra la ventana de carrera entre el SELECT de arriba y este INSERT.
    if (error.code === "23P01" || error.code === "23505") {
      throw new Error("Este activo ya tiene una reserva que se solapa con ese horario. Elige otra franja u otro activo.");
    }
    throw new Error("Error al procesar la solicitud. Inténtalo de nuevo.");
  }

  revalidatePath("/reservas");
  revalidatePath("/dashboard");
}

// ── Reservas externas (iCal / SamBoat / Click&Boat) ──────────────────────────

export async function confirmarReservaExterna(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).maybeSingle();
  if (!perfil) throw new Error("Perfil no encontrado");

  const { data: reserva } = await supabase
    .from("reservas")
    .select("id, activo_id, activo_nombre, sociedad_id, tipo, cliente, fecha, hora, duracion, horas_consumidas, id_externo, estado, fuente")
    .eq("id", id)
    .maybeSingle();

  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado !== "pendiente") throw new Error("Solo se pueden confirmar reservas pendientes");
  if (perfil.rol !== "master" && perfil.sociedad_id !== reserva.sociedad_id) {
    throw new Error("Sin permiso para esta reserva");
  }

  // No confirmar una reserva externa cuya salida ya ha pasado (hora de España). Las pendientes
  // sin atender pueden quedar caducadas; confirmarlas registraría actividad en una fecha pretérita.
  const hoyEspana    = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const reservaFecha = String(reserva.fecha).slice(0, 10);
  if (reservaFecha < hoyEspana) {
    throw new Error("No se puede confirmar: la fecha de la reserva ya ha pasado.");
  }
  if (reservaFecha === hoyEspana) {
    const horaEspana = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date());
    if (toMins(reserva.hora) < toMins(horaEspana)) {
      throw new Error("No se puede confirmar: la hora de salida ya ha pasado.");
    }
  }

  // Guard anti-overbooking: verificar solapamiento con reservas ya confirmadas
  const rStart = toMins(reserva.hora);
  const rEnd   = rStart + (reserva.horas_consumidas ?? 4) * 60;

  const { data: solapadas } = await supabase
    .from("reservas")
    .select("id, hora, horas_consumidas")
    .eq("activo_id", reserva.activo_id)
    .eq("fecha", reserva.fecha)
    .in("estado", ["confirmada", "en_curso"])
    .neq("id", id);

  for (const s of solapadas ?? []) {
    const sStart = toMins(s.hora);
    const sEnd   = sStart + (s.horas_consumidas ?? 4) * 60;
    if (rStart < sEnd && rEnd > sStart) {
      throw new Error("Conflicto de horario: el activo ya tiene una reserva que se solapa.");
    }
  }

  // Datos del activo para precio y email
  const { data: activo } = await supabase
    .from("activos")
    .select("licencia, capacidad, modelo, matricula")
    .eq("id", reserva.activo_id)
    .maybeSingle();

  let ingreso_neto = 0;
  if (activo) {
    if (reserva.tipo === "moto") {
      ingreso_neto = TARIFAS_MOTO[reserva.duracion] ?? 0;
    } else {
      const cat: BarcoCategoria = activo.licencia ? "con_licencia"
        : (activo.capacidad ?? 6) >= 7 ? "sin_licencia_7" : "sin_licencia_6";
      const t = TARIFAS_BARCO[cat];
      ingreso_neto = reserva.duracion === "Medio día" ? t.medio_dia : t.dia_completo;
    }
  }

  const { error } = await supabase
    .from("reservas")
    .update({ estado: "confirmada", ingreso_neto })
    .eq("id", id);

  if (error) {
    // El constraint reserva_no_solape (exclusion) atrapa la confirmación simultánea de dos
    // pendientes solapadas que el pre-chequeo anterior no vio por la ventana de carrera.
    if (error.code === "23P01" || error.code === "23505") {
      throw new Error("Conflicto de horario: el activo ya tiene una reserva confirmada que se solapa.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/reservas");

  const snap = {
    ...reserva,
    ingreso_neto,
    modelo:    activo?.modelo    ?? null,
    matricula: activo?.matricula ?? null,
    licencia:  activo?.licencia  ?? null,
  };

  after(async () => {
    await Promise.allSettled([
      enviarEmailConfirmacion(snap),
      notificarPlataforma("confirm", snap.id_externo, snap.fuente ?? "SamBoat"),
    ]);
  });
}

export async function rechazarReservaExterna(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).maybeSingle();
  if (!perfil) throw new Error("Perfil no encontrado");

  const { data: reserva } = await supabase
    .from("reservas")
    .select("id, sociedad_id, id_externo, cliente, activo_nombre, fecha, hora, duracion, fuente")
    .eq("id", id)
    .maybeSingle();

  if (!reserva) throw new Error("Reserva no encontrada");
  if (perfil.rol !== "master" && perfil.sociedad_id !== reserva.sociedad_id) {
    throw new Error("Sin permiso para esta reserva");
  }

  // "rechazada" libera el slot del UNIQUE INDEX — requiere que el constraint de BD incluya este valor
  // SQL necesario: ALTER TABLE reservas DROP CONSTRAINT reservas_estado_check;
  //               ALTER TABLE reservas ADD CONSTRAINT reservas_estado_check CHECK (estado IN ('pendiente','confirmada','en_curso','completada','cancelada','rechazada'));
  const { error } = await supabase
    .from("reservas")
    .update({ estado: "rechazada" })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/reservas");

  after(async () => {
    await Promise.allSettled([
      enviarEmailRechazo(reserva),
      notificarPlataforma("reject", reserva.id_externo, reserva.fuente ?? "SamBoat"),
    ]);
  });
}

// ── Helpers privados ──────────────────────────────────────────────────────────

async function enviarEmailConfirmacion(reserva: {
  cliente: string; activo_nombre: string; fecha: string; hora: string;
  duracion: string; ingreso_neto: number;
  modelo: string | null; matricula: string | null; licencia: boolean | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurada — email de confirmación omitido");
    return;
  }
  const { Resend } = await import("resend");
  const resend   = new Resend(apiKey);
  const from     = process.env.RESEND_FROM_EMAIL ?? "Slora Nautic <noreply@sloranautic.com>";
  const to       = process.env.MARINA_NOTIFICATION_EMAIL ?? "reservas@sloranautic.com";
  const fechaFmt = new Date(reserva.fecha + "T12:00:00")
    .toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  const licenciaRow = reserva.licencia != null
    ? `<tr><td style="padding:4px 12px 4px 0"><strong>Licencia</strong></td><td>${reserva.licencia ? "Requiere licencia de navegación" : "Sin licencia requerida"}</td></tr>`
    : "";

  await resend.emails.send({
    from,
    to: [to],
    subject: `Reserva confirmada — ${reserva.activo_nombre} · ${fechaFmt}`,
    html: `
      <h2 style="font-family:sans-serif;color:#0C447C">Reserva confirmada en Slora Nautic</h2>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><strong>Cliente</strong></td><td>${reserva.cliente}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Embarcación</strong></td><td>${reserva.activo_nombre}</td></tr>
        ${reserva.modelo    ? `<tr><td style="padding:4px 12px 4px 0"><strong>Modelo</strong></td><td>${reserva.modelo}</td></tr>` : ""}
        ${reserva.matricula ? `<tr><td style="padding:4px 12px 4px 0"><strong>Matrícula</strong></td><td>${reserva.matricula}</td></tr>` : ""}
        ${licenciaRow}
        <tr><td style="padding:4px 12px 4px 0"><strong>Fecha</strong></td><td>${fechaFmt}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Hora de salida</strong></td><td>${reserva.hora}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Duración</strong></td><td>${reserva.duracion}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Ingreso neto</strong></td><td>€${reserva.ingreso_neto}</td></tr>
      </table>
    `,
  });
}

async function enviarEmailRechazo(reserva: {
  cliente: string; activo_nombre: string; fecha: string; hora: string; duracion: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY no configurada — email de rechazo omitido");
    return;
  }
  const { Resend } = await import("resend");
  const resend   = new Resend(apiKey);
  const from     = process.env.RESEND_FROM_EMAIL ?? "Slora Nautic <noreply@sloranautic.com>";
  const to       = process.env.MARINA_NOTIFICATION_EMAIL ?? "reservas@sloranautic.com";
  const fechaFmt = new Date(reserva.fecha + "T12:00:00")
    .toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });

  await resend.emails.send({
    from,
    to: [to],
    subject: `Reserva rechazada — ${reserva.activo_nombre} · ${fechaFmt}`,
    html: `
      <h2 style="font-family:sans-serif;color:#B91C1C">Solicitud de reserva rechazada</h2>
      <p style="font-family:sans-serif;font-size:14px;color:#374151">
        La siguiente solicitud ha sido rechazada desde el panel de Slora Nautic.
        El slot queda liberado para nuevas reservas.
      </p>
      <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 12px 4px 0"><strong>Cliente</strong></td><td>${reserva.cliente}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Embarcación</strong></td><td>${reserva.activo_nombre}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Fecha</strong></td><td>${fechaFmt}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Hora</strong></td><td>${reserva.hora}</td></tr>
        <tr><td style="padding:4px 12px 4px 0"><strong>Duración</strong></td><td>${reserva.duracion}</td></tr>
      </table>
    `,
  });
}

async function notificarPlataforma(
  action: "confirm" | "reject",
  id_externo: string | null,
  fuente: string,
) {
  const webhookUrl = fuente === "Click&Boat"
    ? process.env.CLICKANDBOAT_WEBHOOK_URL
    : process.env.SAMBOAT_WEBHOOK_URL;
  const apiKey = fuente === "Click&Boat"
    ? process.env.CLICKANDBOAT_API_KEY
    : process.env.SAMBOAT_API_KEY;

  if (!webhookUrl) {
    console.warn(`[${fuente}] Webhook URL no configurada — ${action} omitido`);
    return;
  }

  await fetch(webhookUrl, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({ action, booking_uid: id_externo }),
  });
}
