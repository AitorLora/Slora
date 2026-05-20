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
