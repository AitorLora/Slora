import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HORAS_CONSUMIDAS, TARIFAS_MOTO, TARIFAS_BARCO, type BarcoCategoria } from "@/lib/mock-data";

const DURACION_MAP: Record<string, string> = {
  half_day:     "Medio día",
  "half-day":   "Medio día",
  medio_dia:    "Medio día",
  full_day:     "Día completo",
  "full-day":   "Día completo",
  dia_completo: "Día completo",
};

interface ParsedBooking {
  cliente:       string;
  activo_nombre: string;
  fecha:         string;
  hora:          string;
  duracion:      string;
  fuente:        "Click and Boat" | "Sandboat";
  external_id:   string;
}

function parseClickAndBoat(body: any): ParsedBooking {
  const renter = body.renter ?? {};
  const boat   = body.boat ?? {};
  const rental = body.rental ?? {};
  return {
    cliente:       [renter.first_name, renter.last_name].filter(Boolean).join(" ") || "Sin nombre",
    activo_nombre: boat.name ?? "",
    fecha:         rental.start_date ?? "",
    hora:          rental.start_time ?? "09:00",
    duracion:      DURACION_MAP[rental.type ?? "half_day"] ?? "Medio día",
    fuente:        "Click and Boat",
    external_id:   body.booking_id ?? body.id ?? "CB-UNKNOWN",
  };
}

function parseSandboat(body: any): ParsedBooking {
  let fecha = "";
  let hora  = "09:00";
  const dep = body.departure_at ?? "";
  if (dep.includes("T")) {
    [fecha] = dep.split("T");
    hora = dep.split("T")[1]?.substring(0, 5) ?? "09:00";
  } else {
    fecha = dep;
    hora  = body.departure_time ?? "09:00";
  }
  return {
    cliente:       body.skipper_name ?? body.renter_name ?? "Sin nombre",
    activo_nombre: body.boat_name ?? "",
    fecha,
    hora,
    duracion:    DURACION_MAP[body.rental_type ?? "half_day"] ?? "Medio día",
    fuente:      "Sandboat",
    external_id: body.id ?? "SB-UNKNOWN",
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  // Verificar secret
  const secret = request.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { platform } = await params;
  if (platform !== "clickandboat" && platform !== "sandboat") {
    return NextResponse.json({ error: "Plataforma no soportada" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Parsear según plataforma
  let parsed: ParsedBooking;
  try {
    parsed = platform === "clickandboat" ? parseClickAndBoat(body) : parseSandboat(body);
  } catch (e: any) {
    return NextResponse.json({ error: `Error al parsear payload: ${e.message}` }, { status: 422 });
  }

  // Validaciones básicas
  if (!parsed.activo_nombre) {
    return NextResponse.json({ error: "Falta nombre del activo en el payload" }, { status: 422 });
  }
  if (!parsed.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) {
    return NextResponse.json({ error: `Fecha inválida: "${parsed.fecha}"` }, { status: 422 });
  }
  if (!parsed.duracion) {
    return NextResponse.json({ error: "Duración no reconocida" }, { status: 422 });
  }

  const supabase = createAdminClient();

  // Buscar activo por nombre (case-insensitive)
  const { data: activo, error: activoError } = await supabase
    .from("activos")
    .select("id, nombre, tipo, sociedad_id, licencia, capacidad")
    .ilike("nombre", parsed.activo_nombre)
    .maybeSingle();

  if (activoError || !activo) {
    return NextResponse.json({
      error: `Activo "${parsed.activo_nombre}" no encontrado. Verifica que el nombre coincida exactamente con el registrado en Slora.`,
    }, { status: 404 });
  }

  // Comprobar disponibilidad
  const { data: solapadas } = await supabase
    .from("reservas")
    .select("id")
    .eq("activo_id", activo.id)
    .eq("fecha", parsed.fecha)
    .in("estado", ["pendiente", "confirmada", "en_curso"]);

  if (solapadas && solapadas.length > 0) {
    return NextResponse.json({
      error: `El activo "${activo.nombre}" ya tiene una reserva el ${parsed.fecha}.`,
    }, { status: 409 });
  }

  // Calcular ingreso_neto en servidor
  let ingreso_neto = 0;
  if (activo.tipo === "moto") {
    ingreso_neto = TARIFAS_MOTO[parsed.duracion] ?? 0;
  } else {
    const cat: BarcoCategoria = activo.licencia ? "con_licencia"
      : (activo.capacidad ?? 6) >= 7 ? "sin_licencia_7" : "sin_licencia_6";
    const t = TARIFAS_BARCO[cat];
    ingreso_neto = parsed.duracion === "Medio día" ? t.medio_dia : t.dia_completo;
  }

  const horas_consumidas = HORAS_CONSUMIDAS[parsed.duracion] ?? 4;

  const { error: insertError } = await supabase.from("reservas").insert({
    activo_id:       activo.id,
    activo_nombre:   activo.nombre,
    sociedad_id:     activo.sociedad_id,
    tipo:            activo.tipo,
    cliente:         parsed.cliente,
    fecha:           parsed.fecha,
    hora:            parsed.hora,
    duracion:        parsed.duracion,
    horas_consumidas,
    fuente:          parsed.fuente,
    ingreso_neto,
    estado:          "confirmada",
    notas:           `Importada desde ${parsed.fuente} · Ref: ${parsed.external_id}`,
  });

  if (insertError) {
    console.error("[webhook] DB error:", insertError);
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Reserva duplicada (constraint DB)." }, { status: 409 });
    }
    return NextResponse.json({ error: "Error al guardar la reserva." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mensaje: `Reserva creada — ${activo.nombre} · ${parsed.fecha} · ${parsed.duracion}`,
    activo:  activo.nombre,
    cliente: parsed.cliente,
    fecha:   parsed.fecha,
    ingreso: ingreso_neto,
  });
}
