"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { TARIFAS_MOTO, TARIFAS_BARCO, HORAS_CONSUMIDAS, FUENTES, type BarcoCategoria } from "@/lib/mock-data";

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

  await supabase.from("reservas").update({ estado }).eq("id", id);

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

  await supabase.from("reservas").update({ estado: "eliminada" }).eq("id", id);
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
  // Fix 7: validar fecha+hora (no solo fecha) para evitar reservas retroactivas intradiarias
  const ahora = new Date();
  const fechaHoraReserva = new Date(`${data.fecha}T${data.hora}:00`);
  if (fechaHoraReserva < ahora) {
    throw new Error("No se pueden crear reservas en fechas u horas pasadas.");
  }

  // Fix 4: validar apertura y cierre según tipo (barco 09-21, moto 09-22)
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

  // Comprobar solapamiento de fechas (doble booking)
  const { data: solapadas } = await supabase
    .from("reservas")
    .select("id")
    .eq("activo_id", data.activo_id)
    .eq("fecha", data.fecha)
    .in("estado", ["pendiente", "confirmada", "en_curso"]);

  if (solapadas && solapadas.length > 0) {
    throw new Error("Este activo ya tiene una reserva en esa fecha. Elige otro activo u otra fecha.");
  }

  if (!FUENTES.includes(data.fuente)) throw new Error("Fuente de reserva no válida.");

  const { data: activo, error: activoError } = await supabase
    .from("activos").select("sociedad_id, licencia, capacidad").eq("id", data.activo_id).maybeSingle();
  if (activoError || !activo) throw new Error("Activo no encontrado");

  // CRÍTICO 2: calcular precio en servidor, ignorar valor del cliente
  let ingreso_neto: number;
  if (data.tipo === "moto") {
    ingreso_neto = TARIFAS_MOTO[data.duracion] ?? 0;
  } else {
    const cat: BarcoCategoria = activo.licencia ? "con_licencia"
      : (activo.capacidad ?? 6) >= 7 ? "sin_licencia_7" : "sin_licencia_6";
    const t = TARIFAS_BARCO[cat];
    ingreso_neto = data.duracion === "Medio día" ? t.medio_dia : t.dia_completo;
  }

  // Fix 5: calcular horas_consumidas en servidor, ignorar valor del cliente
  const horas_consumidas = HORAS_CONSUMIDAS[data.duracion] ?? 4;

  // UNIQUE INDEX en DB protege contra race condition (reserva_activo_fecha_activa ON reservas(activo_id, fecha) WHERE estado IN ('pendiente','confirmada','en_curso'))
  const { error } = await supabase.from("reservas").insert({
    ...data,
    horas_consumidas,
    sociedad_id: activo.sociedad_id,
    estado: "confirmada",
    ingreso_neto,
  });
  if (error) {
    console.error("[crearReserva] DB error:", error);
    // Fix 1: capturar violación de constraint único (race condition)
    if (error.code === "23505") {
      throw new Error("Este activo ya fue reservado en esa fecha. Elige otro activo u otra fecha.");
    }
    throw new Error("Error al procesar la solicitud. Inténtalo de nuevo.");
  }

  revalidatePath("/reservas");
  revalidatePath("/dashboard");
}
