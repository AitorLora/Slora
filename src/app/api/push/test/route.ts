import { NextResponse } from "next/server";
import { sendPushToAll } from "@/lib/push";

// Envía una notificación de prueba a todos los dispositivos suscritos.
// Protegido con CRON_SECRET:  /api/push/test?secret=...
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = new URL(request.url).searchParams.get("secret");
  if (secret && given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendPushToAll({
    title: "Prueba · Slora",
    body: "Si ves esto, las notificaciones funcionan 🎉",
    url: "/reservas",
    tag: "slora-test",
  });

  return NextResponse.json({ ok: true, ...result });
}
