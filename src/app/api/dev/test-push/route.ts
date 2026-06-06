import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────────────────────
// Endpoint de PRUEBAS — solo desarrollo.
//
// Abrir en el navegador:  http://localhost:3000/api/dev/test-push
//
// Por defecto BORRA todas las reservas externas (id_externo != null) y vuelve a
// lanzar el cron sync-ical, que reimporta las mock y dispara el push al móvil.
// Así cada recarga = reset + push, sin necesidad de token.
//
//   ?keep   → no borra nada, solo sincroniza (verás "ya_existian" y push 0).
//
// Bloqueado en producción: devuelve 404.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const keep = url.searchParams.has("keep");

  const supabase = createAdminClient();

  let borradas = 0;
  if (!keep) {
    const { count } = await supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .not("id_externo", "is", null);

    const { error } = await supabase
      .from("reservas")
      .delete()
      .not("id_externo", "is", null);
    if (error) {
      return NextResponse.json({ error: `No se pudieron borrar las reservas: ${error.message}` }, { status: 500 });
    }
    borradas = count ?? 0;
  }

  // Reusa el cron real (que ya envía el push) autenticando con el secret.
  const secret = process.env.CRON_SECRET;
  const syncUrl = new URL("/api/cron/sync-ical", url.origin);
  const res = await fetch(syncUrl, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
    cache: "no-store",
  });
  const sync = await res.json();

  return NextResponse.json({
    modo: keep ? "solo-sync" : "reset+sync",
    reservas_externas_borradas: borradas,
    sync,
  });
}
