import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: reservas }, { data: activos }] = await Promise.all([
    supabase.from("reservas").select("ingreso_neto, estado, fecha, sociedad_id, activo_id"),
    supabase.from("activos").select("id, estado"),
  ]);

  const cobrado = (reservas ?? [])
    .filter(r => r.estado === "completada")
    .reduce((s, r) => s + Number(r.ingreso_neto), 0);

  const proyectado = (reservas ?? [])
    .filter(r => r.estado !== "cancelada")
    .reduce((s, r) => s + Number(r.ingreso_neto), 0);

  const totalReservas = (reservas ?? []).length;
  const totalActivos = (activos ?? []).length;
  const activosDisponibles = (activos ?? []).filter(a => a.estado === "ACTIVO").length;

  // Agrupar ingresos cobrados y proyectados por mes
  const mesesMap: Record<string, { cobrado: number; proy: number }> = {};
  for (const r of reservas ?? []) {
    const mes = r.fecha?.slice(0, 7); // "2026-05"
    if (!mes) continue;
    if (!mesesMap[mes]) mesesMap[mes] = { cobrado: 0, proy: 0 };
    if (r.estado === "completada") mesesMap[mes].cobrado += Number(r.ingreso_neto);
    if (r.estado !== "cancelada") mesesMap[mes].proy += Number(r.ingreso_neto);
  }

  const MESES_LABELS: Record<string, string> = {
    "2026-04": "Abr", "2026-05": "May", "2026-06": "Jun",
    "2026-07": "Jul", "2026-08": "Ago", "2026-09": "Sep",
  };

  const meses = Object.entries(mesesMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({ mes: MESES_LABELS[key] ?? key, ...val }));

  const maxBar = Math.max(...meses.map(m => m.proy), 1);

  // Últimas 5 reservas
  const { data: recientes } = await supabase
    .from("reservas")
    .select("id, cliente, activo_id, ingreso_neto, estado, fecha")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Cobrado"    value={`€${cobrado.toLocaleString("es-ES")}`}     sub="reservas completadas" accent />
        <KpiCard label="Proyectado" value={`€${proyectado.toLocaleString("es-ES")}`}  sub="todas sin canceladas" />
        <KpiCard label="Reservas"   value={totalReservas}                              sub="en temporada" />
        <KpiCard label="Unidades"   value={`${activosDisponibles}/${totalActivos}`}    sub="activos disponibles" />
      </div>

      {/* Ingresos por mes */}
      {meses.length > 0 && (
        <div className="rounded-xl border p-5 bg-[var(--surface)] border-[var(--border)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Ingresos por mes</p>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
                <span className="w-2 h-2 rounded-sm inline-block bg-[var(--blue)]" />Cobrado
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
                <span className="w-2 h-2 rounded-sm inline-block border border-[var(--blue)] bg-[var(--blue-light)]" />Proyectado
              </span>
            </div>
          </div>
          <div className="space-y-2.5">
            {meses.map(({ mes, cobrado: c, proy: p }) => {
              const pw = Math.round((p / maxBar) * 100);
              const cw = Math.round((c / maxBar) * 100);
              return (
                <div key={mes} className="grid items-center gap-2.5" style={{ gridTemplateColumns: "36px 1fr 56px" }}>
                  <span className="font-mono text-[11px] font-medium text-[var(--text-3)]">{mes}</span>
                  <div className="h-[22px] rounded relative overflow-hidden bg-[var(--muted)]">
                    <div className="absolute inset-y-0 left-0 rounded bg-[var(--blue-light)]" style={{ width: `${pw}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded bg-[var(--blue)]" style={{ width: `${cw}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-right text-[var(--text-2)]">
                    {c ? `€${c.toLocaleString("es-ES")}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Últimas reservas */}
      {(recientes ?? []).length > 0 && (
        <div className="rounded-xl border overflow-hidden bg-[var(--surface)] border-[var(--border)]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Últimas reservas</p>
          </div>
          {recientes!.map(r => {
            const estadoColor =
              r.estado === "completada" ? "var(--green-text)" :
              r.estado === "confirmada" ? "#0C447C" :
              r.estado === "en_curso"   ? "#0369A1" :
              r.estado === "cancelada"  ? "var(--gray-text)" : "var(--amber-text)";
            const estadoBg =
              r.estado === "completada" ? "var(--green-bg)" :
              r.estado === "confirmada" ? "var(--blue-light)" :
              r.estado === "en_curso"   ? "#E0F2FE" :
              r.estado === "cancelada"  ? "var(--gray-bg)" : "var(--amber-bg)";
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                <span className="font-mono text-[11px] text-white px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--navy)" }}>
                  {r.activo_id}
                </span>
                <span className="flex-1 text-[13px] font-medium text-[var(--foreground)] truncate">{r.cliente}</span>
                <span className="font-mono text-[13px] font-semibold text-[var(--foreground)]">€{Number(r.ingreso_neto).toLocaleString("es-ES")}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: estadoColor, background: estadoBg }}>
                  {r.estado.charAt(0).toUpperCase() + r.estado.slice(1).replace("_", " ")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {(reservas ?? []).length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
          <p className="text-3xl mb-3 opacity-40">📊</p>
          <p>No hay datos todavía. Añade reservas para ver el dashboard.</p>
        </div>
      )}
    </div>
  );
}
