import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  const now = new Date();

  const todaySpain = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(now);
  const timeSpain  = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);
  const [h, m] = timeSpain.split(":").map(Number);
  const nowMins = h * 60 + m;

  // Incluir ayer para capturar reservas que terminaron después de la medianoche
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdaySpain = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(yesterday);

  const { data: reservas, error } = await supabase
    .from("reservas")
    .select("id, fecha, hora, horas_consumidas, estado")
    .in("estado", ["confirmada", "en_curso"])
    .gte("fecha", yesterdaySpain);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const toEnCurso:   number[] = [];
  const toCompletada: number[] = [];

  for (const r of reservas ?? []) {
    const [rH, rM]  = (r.hora ?? "09:00").split(":").map(Number);
    const startMins = rH * 60 + rM;
    const endMins   = startMins + (r.horas_consumidas ?? 4) * 60;

    if (r.estado === "confirmada") {
      if (r.fecha < todaySpain) {
        toCompletada.push(r.id);               // fecha pasada → completada directamente
      } else if (r.fecha === todaySpain && startMins <= nowMins) {
        toEnCurso.push(r.id);                  // hoy, hora de inicio alcanzada
      }
    } else if (r.estado === "en_curso") {
      if (r.fecha < todaySpain || (r.fecha === todaySpain && endMins <= nowMins)) {
        toCompletada.push(r.id);               // hora de fin alcanzada
      }
    }
  }

  if (toEnCurso.length > 0) {
    await supabase.from("reservas").update({ estado: "en_curso"   }).in("id", toEnCurso);
  }
  if (toCompletada.length > 0) {
    await supabase.from("reservas").update({ estado: "completada" }).in("id", toCompletada);
  }

  // Auto-vencimiento: cualquier reserva pendiente (externa o Manual) cuyo horario ya pasó y
  // nadie atendió → se cancela. Incluye las de hoy cuya hora de fin ya terminó, no solo días
  // anteriores. Se reutiliza 'cancelada' (ya en el CHECK constraint de la DB).
  const { data: vencidas } = await supabase
    .from("reservas")
    .select("id, fecha, hora, horas_consumidas")
    .eq("estado", "pendiente")
    .lte("fecha", todaySpain);

  const caducadas = (vencidas ?? [])
    .filter(r => {
      if (r.fecha < todaySpain) return true;            // día anterior → vencida
      const [rH, rM]  = (r.hora ?? "09:00").split(":").map(Number);
      const endMins   = rH * 60 + rM + (r.horas_consumidas ?? 4) * 60;
      return endMins <= nowMins;                          // hoy, pero su franja ya terminó
    })
    .map(r => r.id);
  if (caducadas.length > 0) {
    await supabase
      .from("reservas")
      .update({ estado: "cancelada", notas: "Caducada automáticamente: pendiente no atendida" })
      .in("id", caducadas);
  }

  return NextResponse.json({
    ok: true,
    en_curso:   toEnCurso.length,
    completada: toCompletada.length,
    caducadas:  caducadas.length,
    timestamp:  now.toISOString(),
  });
}
