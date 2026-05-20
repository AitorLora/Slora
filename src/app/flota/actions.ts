"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function crearActivo(data: {
  matricula: string;
  modelo: string;
  tipo: "moto" | "barco";
  sociedad_id: string;
  capacidad: number;
  horas_motor: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  const { error } = await supabase.from("activos").insert({
    ...data,
    horas_desde_servicio: 0,
    estado: "ACTIVO",
    nombre: data.matricula,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/flota");
}

export async function eliminarActivo(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: reservasActivas } = await supabase
    .from("reservas")
    .select("id")
    .eq("activo_id", id)
    .in("estado", ["pendiente", "confirmada", "en_curso"]);

  if (reservasActivas && reservasActivas.length > 0) {
    throw new Error(`Este activo tiene ${reservasActivas.length} reserva(s) activa(s). Cancélalas antes de eliminar.`);
  }

  const { error } = await supabase.from("activos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/flota");
}

export async function marcarRevision(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");
  await supabase
    .from("activos")
    .update({ horas_desde_servicio: 0, estado: "ACTIVO" })
    .eq("id", id);
  revalidatePath("/flota");
}
