"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function crearActivo(data: {
  matricula: string;
  modelo: string;
  tipo: "moto" | "barco";
  sociedad_id?: string;
  capacidad: number;
  horas_motor: number;
  licencia?: boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).single();

  // Master puede asignar a cualquier sociedad; el resto solo a la suya
  const sociedad_id = perfil?.rol === "master" && data.sociedad_id
    ? data.sociedad_id
    : perfil?.sociedad_id;
  if (!sociedad_id) throw new Error("Perfil sin sociedad asignada");

  const { error } = await supabase.from("activos").insert({
    id: crypto.randomUUID(),
    ...data,
    sociedad_id,
    horas_desde_servicio: 0,
    estado: "ACTIVO",
    // IMPORTANTE 2: nombre = tipo + matrícula, no solo matrícula
    nombre: `${data.tipo === "moto" ? "Moto" : "Barco"} ${data.matricula}`,
  });
  if (error) {
    console.error("[crearActivo] DB error:", error);
    throw new Error("Error al procesar la solicitud. Inténtalo de nuevo.");
  }
  revalidatePath("/flota");
}

export async function eliminarActivo(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).single();
  const { data: activo } = await supabase
    .from("activos").select("sociedad_id").eq("id", id).single();

  if (!activo) throw new Error("Activo no encontrado");
  if (perfil?.rol !== "master" && perfil?.sociedad_id !== activo.sociedad_id) {
    throw new Error("Sin permiso para este activo");
  }

  const { data: reservasActivas } = await supabase
    .from("reservas")
    .select("id")
    .eq("activo_id", id)
    .in("estado", ["pendiente", "confirmada", "en_curso"]);

  if (reservasActivas && reservasActivas.length > 0) {
    throw new Error(`Este activo tiene ${reservasActivas.length} reserva(s) activa(s). Cancélalas antes de eliminar.`);
  }

  const { error } = await supabase.from("activos").delete().eq("id", id);
  if (error) {
    console.error("[eliminarActivo] DB error:", error);
    throw new Error("Error al procesar la solicitud. Inténtalo de nuevo.");
  }
  revalidatePath("/flota");
}

export async function marcarRevision(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("perfiles").select("sociedad_id, rol").eq("id", user.id).single();
  const { data: activo } = await supabase
    .from("activos").select("sociedad_id").eq("id", id).single();

  if (!activo) throw new Error("Activo no encontrado");
  if (perfil?.rol !== "master" && perfil?.sociedad_id !== activo.sociedad_id) {
    throw new Error("Sin permiso para este activo");
  }

  await supabase
    .from("activos")
    .update({ horas_desde_servicio: 0, estado: "ACTIVO" })
    .eq("id", id);
  revalidatePath("/flota");
}
