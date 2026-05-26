"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { TARIFAS_MOTO, TARIFAS_BARCO, type BarcoCategoria } from "@/lib/mock-data";

const ESTADOS_VALIDOS = ["pendiente", "confirmada", "en_curso", "completada", "cancelada"] as const;

export async function cambiarEstadoReserva(id: number, estado: string) {
  if (!ESTADOS_VALIDOS.includes(estado as any)) throw new Error("Estado no válido");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).single();
  const { data: reserva } = await supabase
    .from("reservas").select("sociedad_id").eq("id", id).single();

  if (!reserva) throw new Error("Reserva no encontrada");
  if (perfil?.rol !== "master" && perfil?.sociedad_id !== reserva.sociedad_id) {
    throw new Error("Sin permiso para esta reserva");
  }

  await supabase.from("reservas").update({ estado }).eq("id", id);
  revalidatePath("/reservas");
}

export async function eliminarReserva(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).single();
  const { data: reserva } = await supabase
    .from("reservas").select("sociedad_id").eq("id", id).single();

  if (!reserva) throw new Error("Reserva no encontrada");
  if (perfil?.rol !== "master" && perfil?.sociedad_id !== reserva.sociedad_id) {
    throw new Error("Sin permiso para esta reserva");
  }

  await supabase.from("reservas").delete().eq("id", id);
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
  // IMPORTANTE 3: validar fecha en servidor
  const hoy = new Date().toISOString().split("T")[0];
  if (data.fecha < hoy) throw new Error("No se pueden crear reservas en fechas pasadas.");

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

  const { data: activo } = await supabase
    .from("activos").select("sociedad_id, licencia, capacidad").eq("id", data.activo_id).single();
  if (!activo) throw new Error("Activo no encontrado");

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

  const { error } = await supabase.from("reservas").insert({
    ...data,
    sociedad_id: activo.sociedad_id,
    estado: "confirmada",
    ingreso_neto,
  });
  if (error) {
    console.error("[crearReserva] DB error:", error);
    throw new Error("Error al procesar la solicitud. Inténtalo de nuevo.");
  }

  revalidatePath("/reservas");
  revalidatePath("/dashboard");
}
