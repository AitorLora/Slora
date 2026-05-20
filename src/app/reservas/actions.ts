"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const ESTADOS_VALIDOS = ["pendiente", "confirmada", "en_curso", "completada", "cancelada"] as const;

export async function cambiarEstadoReserva(id: number, estado: string) {
  if (!ESTADOS_VALIDOS.includes(estado as any)) throw new Error("Estado no válido");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  await supabase.from("reservas").update({ estado }).eq("id", id);
  revalidatePath("/reservas");
}

export async function eliminarReserva(id: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  await supabase.from("reservas").delete().eq("id", id);
  revalidatePath("/reservas");
}

export async function crearReserva(data: {
  activo_id: string;
  sociedad_id: string;
  tipo: "moto" | "barco";
  cliente: string;
  fecha: string;
  hora: string;
  duracion: string;
  horas_consumidas: number;
  ingreso_neto: number;
  fuente: string;
  notas?: string;
}) {
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

  const { data: activo } = await supabase.from("activos").select("sociedad_id").eq("id", data.activo_id).single();
  if (!activo) throw new Error("Activo no encontrado");

  const { error } = await supabase.from("reservas").insert({ ...data, sociedad_id: activo.sociedad_id, estado: "pendiente" });
  if (error) throw new Error(error.message);

  revalidatePath("/reservas");
  revalidatePath("/dashboard");
}
