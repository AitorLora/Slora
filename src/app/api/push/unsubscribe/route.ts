import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Elimina la suscripción push de un dispositivo (al desactivar las notificaciones).
export async function POST(request: Request) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const endpoint = payload?.endpoint as string | undefined;
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint requerido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
