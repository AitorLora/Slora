"use client";

import { AppShell } from "@/components/layout/AppShell";
import { sociedades, assets, bookings } from "@/lib/mock-data";

export default function SociedadesPage() {
  const stats = sociedades.map(soc => {
    const activos       = assets.filter(a => a.sociedad_id === soc.id);
    const motos         = activos.filter(a => a.tipo === "moto");
    const barcos        = activos.filter(a => a.tipo === "barco");
    const reservasSoc   = bookings.filter(b => b.sociedad_id === soc.id);
    const cobrado       = reservasSoc.filter(b => b.estado === "completada").reduce((s, b) => s + b.ingreso_neto, 0);
    const proyectado    = reservasSoc.filter(b => b.estado !== "cancelada").reduce((s, b) => s + b.ingreso_neto, 0);
    const totalReservas = reservasSoc.length;
    const alertas       = activos.filter(a => a.estado === "ALERTA" || a.estado === "MANTENIMIENTO");
    return { soc, activos, motos, barcos, cobrado, proyectado, totalReservas, alertas };
  });

  const totalCobrado    = stats.reduce((s, x) => s + x.cobrado, 0);
  const totalProyectado = stats.reduce((s, x) => s + x.proyectado, 0);
  const totalActivos    = assets.length;

  return (
    <AppShell title="Sociedades" subtitle={`${sociedades.length} inversores activos`}>

      {/* KPIs globales */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Inversores",       value: sociedades.length,                         sub: "sociedades registradas" },
          { label: "Cobrado (total)",  value: `€${totalCobrado.toLocaleString("es-ES")}`, sub: "suma de todas las sociedades", accent: true },
          { label: "Activos en flota", value: totalActivos,                               sub: "motos y barcos combinados" },
        ].map(({ label, value, sub, accent }) => (
          <div
            key={label}
            className="rounded-xl p-4 border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderTop: accent ? "3px solid var(--blue)" : "1px solid var(--border)",
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.05em] mb-1.5" style={{ color: "var(--text-3)" }}>{label}</p>
            <p className="font-mono text-[26px] font-semibold tracking-[-1px]" style={{ color: "var(--foreground)" }}>{value}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Tarjetas de sociedades */}
      <div className="space-y-4">
        {stats.map(({ soc, activos, motos, barcos, cobrado, proyectado, totalReservas, alertas }) => (
          <div
            key={soc.id}
            className="rounded-xl border overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
          >
            {/* Cabecera */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                  style={{ background: "var(--navy)" }}
                >
                  {soc.nombre.charAt(0)}
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{soc.nombre}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                    {activos.length} activo{activos.length !== 1 ? "s" : ""} · {totalReservas} reservas
                  </p>
                </div>
              </div>

              {/* Alerta si hay activos que revisar */}
              {alertas.length > 0 && (
                <span
                  className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full"
                  style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}
                >
                  ⚠️ {alertas.length} activo{alertas.length > 1 ? "s" : ""} con alerta
                </span>
              )}
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-4 divide-x divide-[var(--border)]">
              {[
                { label: "Cobrado",    value: `€${cobrado.toLocaleString("es-ES")}`,    mono: true, accent: cobrado > 0 },
                { label: "Proyectado", value: `€${proyectado.toLocaleString("es-ES")}`, mono: true },
                { label: "Motos",      value: motos.length,   sub: `${motos.filter(a => a.estado === "ACTIVO").length} disponibles` },
                { label: "Barcos",     value: barcos.length,  sub: `${barcos.filter(a => a.estado === "ACTIVO").length} disponibles` },
              ].map(({ label, value, mono, accent, sub }, i) => (
                <div key={label} className="px-5 py-4" style={{ borderLeft: i > 0 ? "1px solid var(--border)" : "none" }}>
                  <p className="text-[10px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>{label}</p>
                  <p
                    className={`text-[20px] font-semibold ${mono ? "font-mono tracking-[-1px]" : ""}`}
                    style={{ color: accent ? "var(--blue)" : "var(--foreground)" }}
                  >
                    {value}
                  </p>
                  {sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{sub}</p>}
                </div>
              ))}
            </div>

            {/* Lista de activos */}
            <div className="border-t" style={{ borderColor: "var(--border)" }}>
              <div
                className="grid px-5 py-2 text-[10px] uppercase tracking-[0.06em] font-medium"
                style={{ gridTemplateColumns: "10px 120px 1fr 80px 100px 110px", gap: "12px", color: "var(--text-3)", background: "var(--muted)" }}
              >
                <span /><span>Matrícula</span><span>Modelo</span><span>Cap.</span><span>H. Motor</span><span>Estado</span>
              </div>
              {activos.map((a, i) => {
                const dotColor = a.estado === "ACTIVO" ? "var(--green)" : a.estado === "ALERTA" ? "var(--amber)" : "var(--text-3)";
                const badgeStyle =
                  a.estado === "ACTIVO"        ? { color: "var(--green-text)", bg: "var(--green-bg)", label: "Disponible" } :
                  a.estado === "ALERTA"        ? { color: "var(--amber-text)", bg: "var(--amber-bg)", label: "Alerta" } :
                                                 { color: "var(--gray-text)",  bg: "var(--gray-bg)",  label: "Mantenimiento" };
                return (
                  <div
                    key={a.id}
                    className="grid px-5 py-2.5 items-center hover:bg-[var(--muted)] transition-colors"
                    style={{
                      gridTemplateColumns: "10px 120px 1fr 80px 100px 110px",
                      gap: "12px",
                      borderTop: i === 0 ? "none" : "1px solid var(--border)",
                    }}
                  >
                    <span className="w-2 h-2 rounded-full block" style={{ background: dotColor }} />
                    <span className="font-mono text-[12px] font-medium" style={{ color: "var(--navy)" }}>{a.matricula}</span>
                    <span className="text-[12px]" style={{ color: "var(--text-2)" }}>{a.modelo}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{a.capacidad ? `${a.capacidad} pax` : "—"}</span>
                    <span className="font-mono text-[12px]" style={{ color: "var(--foreground)" }}>{a.horas_motor}h</span>
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit"
                      style={{ color: badgeStyle.color, background: badgeStyle.bg }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: badgeStyle.color }} />
                      {badgeStyle.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
