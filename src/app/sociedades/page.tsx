import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/AppShell";

export default async function SociedadesPage() {
  const supabase = await createClient();

  const [{ data: sociedades }, { data: activos }, { data: reservas }] = await Promise.all([
    supabase.from("sociedades").select("id, nombre"),
    supabase.from("activos").select("id, tipo, estado, sociedad_id"),
    supabase.from("reservas").select("sociedad_id, estado, ingreso_neto"),
  ]);

  const socs = sociedades ?? [];
  const acts = activos ?? [];
  const revs = reservas ?? [];

  const stats = socs.map(soc => {
    const activosSoc  = acts.filter(a => a.sociedad_id === soc.id);
    const motos       = activosSoc.filter(a => a.tipo === "moto");
    const barcos      = activosSoc.filter(a => a.tipo === "barco");
    const reservasSoc = revs.filter(r => r.sociedad_id === soc.id);
    const cobrado     = reservasSoc.filter(r => r.estado === "completada").reduce((s, r) => s + Number(r.ingreso_neto), 0);
    const proyectado  = reservasSoc.filter(r => r.estado !== "cancelada").reduce((s, r) => s + Number(r.ingreso_neto), 0);
    const alertas     = activosSoc.filter(a => a.estado === "ALERTA" || a.estado === "MANTENIMIENTO");
    return { soc, activosSoc, motos, barcos, cobrado, proyectado, totalReservas: reservasSoc.length, alertas };
  });

  const totalCobrado = stats.reduce((s, x) => s + x.cobrado, 0);

  return (
    <AppShell title="Sociedades" subtitle={`${socs.length} inversores activos`}>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Inversores",       value: socs.length,                               sub: "sociedades registradas" },
          { label: "Cobrado (total)",  value: `€${totalCobrado.toLocaleString("es-ES")}`, sub: "suma de todas las sociedades", accent: true },
          { label: "Activos en flota", value: acts.length,                               sub: "motos y barcos combinados" },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="rounded-xl p-4 border"
            style={{ background: "var(--surface)", borderColor: "var(--border)", borderTop: accent ? "3px solid var(--blue)" : "1px solid var(--border)" }}>
            <p className="text-[11px] uppercase tracking-[0.05em] mb-1.5" style={{ color: "var(--text-3)" }}>{label}</p>
            <p className="font-mono text-[26px] font-semibold tracking-[-1px]" style={{ color: "var(--foreground)" }}>{value}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>{sub}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {stats.map(({ soc, activosSoc, motos, barcos, cobrado, proyectado, totalReservas, alertas }) => (
          <div key={soc.id} className="rounded-xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                  style={{ background: "var(--navy)" }}>
                  {soc.nombre.charAt(0)}
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{soc.nombre}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                    {activosSoc.length} activo{activosSoc.length !== 1 ? "s" : ""} · {totalReservas} reservas
                  </p>
                </div>
              </div>
              {alertas.length > 0 && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
                  ⚠️ {alertas.length} activo{alertas.length > 1 ? "s" : ""} con alerta
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 divide-x divide-[var(--border)]">
              {[
                { label: "Cobrado",    value: `€${cobrado.toLocaleString("es-ES")}`,    mono: true, accent: cobrado > 0 },
                { label: "Proyectado", value: `€${proyectado.toLocaleString("es-ES")}`, mono: true },
                { label: "Motos",      value: motos.length,  sub: `${motos.filter(a => a.estado === "ACTIVO").length} disponibles` },
                { label: "Barcos",     value: barcos.length, sub: `${barcos.filter(a => a.estado === "ACTIVO").length} disponibles` },
              ].map(({ label, value, mono, accent, sub }, i) => (
                <div key={label} className="px-5 py-4" style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <p className="text-[10px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>{label}</p>
                  <p className={`text-[20px] font-semibold ${mono ? "font-mono tracking-[-1px]" : ""}`}
                    style={{ color: accent ? "var(--blue)" : "var(--foreground)" }}>
                    {value}
                  </p>
                  {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{sub}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
