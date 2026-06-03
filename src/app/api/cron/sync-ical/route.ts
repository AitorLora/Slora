import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import * as ical from "node-ical";

function toMadrid(date: Date): { fecha: string; hora: string } {
  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(date);
  const hora  = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
  return { fecha, hora };
}

function hrsToLabel(h: number): string {
  if (h <= 2) return "2h";
  if (h <= 4) return "4h";
  if (h <= 6) return "6h";
  if (h <= 8) return "8h";
  return "Día completo";
}

const FEEDS: Array<{ envVar: string; mockFile: string; fuente: string }> = [
  { envVar: "URL_ICAL_SAMBOAT",      mockFile: "mock-samboat.ics",      fuente: "SamBoat" },
  { envVar: "URL_ICAL_CLICKANDBOAT", mockFile: "mock-clickandboat.ics", fuente: "Click&Boat" },
];

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabase = createAdminClient();
  let insertados = 0;
  const ya_existian:  string[] = [];
  const bloqueadas:   string[] = []; // slot ya confirmado por otra reserva
  const errores:      string[] = [];

  for (const feed of FEEDS) {
    let icsText: string;
    const icalUrl = process.env[feed.envVar];

    if (icalUrl) {
      try {
        const res = await fetch(icalUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        icsText = await res.text();
      } catch (e: any) {
        errores.push(`[${feed.fuente}] No se pudo obtener el calendario: ${e.message}`);
        continue;
      }
    } else {
      try {
        icsText = readFileSync(join(process.cwd(), "public", feed.mockFile), "utf-8");
      } catch {
        // Archivo mock ausente — omitir este feed silenciosamente
        continue;
      }
    }

    const events = ical.sync.parseICS(icsText);

    for (const raw of Object.values(events)) {
      if (!raw || raw.type !== "VEVENT") continue;

      const event = raw as ical.VEvent;
      const uid   = event.uid;
      if (!uid) continue;

      // Evitar duplicados por UID externo
      const { data: existing } = await supabase
        .from("reservas")
        .select("id")
        .eq("id_externo", uid)
        .maybeSingle();

      if (existing) { ya_existian.push(uid); continue; }

      // Parseo: "Cliente: Nombre | ActivoID: uuid"
      const rawDesc      = event.description;
      const desc: string = !rawDesc ? "" : typeof rawDesc === "string" ? rawDesc : String((rawDesc as any).val ?? "");
      const clienteMatch  = desc.match(/Cliente:\s*([^|]+)/);
      const activoIdMatch = desc.match(/ActivoID:\s*([0-9a-f-]{36})/i);

      if (!activoIdMatch) {
        errores.push(`[${feed.fuente}] UID ${uid}: ActivoID ausente en la descripción`);
        continue;
      }

      const cliente   = clienteMatch?.[1]?.trim() ?? "Cliente externo";
      const activo_id = activoIdMatch[1].trim();

      const { data: activo } = await supabase
        .from("activos")
        .select("nombre, sociedad_id, tipo")
        .eq("id", activo_id)
        .maybeSingle();

      if (!activo) {
        errores.push(`[${feed.fuente}] UID ${uid}: activo ${activo_id} no encontrado`);
        continue;
      }

      const startDate = event.start instanceof Date ? event.start : new Date(event.start as unknown as string);
      const endDate   = event.end   instanceof Date ? event.end   : new Date(event.end   as unknown as string);

      const { fecha, hora } = toMadrid(startDate);
      const horas_consumidas = Math.max(
        1,
        Math.round((endDate.getTime() - startDate.getTime()) / 3_600_000)
      );
      const duracion = hrsToLabel(horas_consumidas);

      const { error: insertError } = await supabase.from("reservas").insert({
        activo_id,
        activo_nombre:    activo.nombre,
        sociedad_id:      activo.sociedad_id,
        tipo:             activo.tipo,
        cliente,
        fecha,
        hora,
        duracion,
        horas_consumidas,
        ingreso_neto:     0,
        fuente:           feed.fuente,
        estado:           "pendiente",
        id_externo:       uid,
      });

      if (insertError) {
        if (insertError.code === "23505" || insertError.code === "23P01") {
          // Slot ya confirmado/en_curso (unique o exclusion violation) — se registra como bloqueado
          bloqueadas.push(`[${feed.fuente}] ${uid}`);
        } else {
          errores.push(`[${feed.fuente}] UID ${uid}: ${insertError.message}`);
        }
      } else {
        insertados++;
      }
    }
  }

  return NextResponse.json({
    ok:               true,
    insertados,
    ya_existian:      ya_existian.length,
    ya_existian_uids: ya_existian,
    bloqueadas:       bloqueadas.length,
    bloqueadas_uids:  bloqueadas,
    errores,
    timestamp:        new Date().toISOString(),
  });
}
