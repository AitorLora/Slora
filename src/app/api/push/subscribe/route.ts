import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Guarda (o actualiza) la suscripción push de un dispositivo.
export async function POST(request: Request) {
  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const endpoint = payload?.endpoint as string | undefined;
  const p256dh = payload?.keys?.p256dh as string | undefined;
  const auth = payload?.keys?.auth as string | undefined;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Suscripción incompleta" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        endpoint,
        p256dh,
        auth,
        user_agent: request.headers.get("user-agent") ?? null,
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
