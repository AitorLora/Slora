"use client";

import { use, useState } from "react";
import { InvestorShell } from "@/components/layout/InvestorShell";
import {
  sociedades, assets, bookings,
  type BookingStatus, type AssetStatus,
} from "@/lib/mock-data";
import { notFound } from "next/navigation";

const ESTADO_BADGE: Record<AssetStatus, { label: string; color: string; bg: string }> = {
  ACTIVO:        { label: "Disponible",    color: "var(--green-text)", bg: "var(--green-bg)" },
  ALERTA:        { label: "Alerta 50-100h", color: "var(--amber-text)", bg: "var(--amber-bg)" },
  MANTENIMIENTO: { label: "Mantenimiento", color: "var(--gray-text)",  bg: "var(--gray-bg)" },
};

const RESERVA_BADGE: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber-text)", bg: "var(--amber-bg)" },
  confirmada: { label: "Confirmada", color: "#0C447C",           bg: "var(--blue-light)" },
  en_curso:   { label: "En curso",   color: "#0369A1",           bg: "#E0F2FE" },
  completada: { label: "Completada", color: "var(--green-text)", bg: "var(--green-bg)" },
  cancelada:  { label: "Cancelada",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
};

export default function PanelInversorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sociedad = sociedades.find(s => s.id === id);
  if (!sociedad) notFound();

  const activosSoc  = assets.filter(a => a.sociedad_id === id);
  const reservasSoc = bookings.filter(b => b.sociedad_id === id);

  const cobrado    = reservasSoc.filter(b => b.estado === "completada").reduce((s, b) => s + b.ingreso_neto, 0);
  const proyectado = reservasSoc.filter(b => b.estado !== "cancelada").reduce((s, b) => s + b.ingreso_neto, 0);
  const alertas    = activosSoc.filter(a => a.estado === "ALERTA" || a.estado === "MANTENIMIENTO");

  const [busqueda, setBusqueda] = useState("");
  const reservasFiltradas = reservasSoc
    .filter(r => {
      const q = busqueda.toLowerCase();
      return !q || r.cliente.toLowerCase().includes(q) || r.activo_nombre.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <InvestorShell sociedad={sociedad.nombre}>
      {/* Alerta de activos */}
      {alertas.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl mb-5 border"
          style={{ background: "var(--amber-bg)", borderColor: "var(--amber)" }}
        >
          <span className="text-[18px] flex-shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-[13px] font-semibold mb-1" style={{ color: "var(--amber-text)" }}>
              {alertas.length} activo{alertas.length > 1 ? "s necesitan" : " necesita"} revisión
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {alertas.map(a => (
                <span key={a.id} className="text-[12px]" style={{ color: "var(--amber-text)" }}>
                  {a.nombre} — <span className="font-mono font-medium">{a.horas_desde_servicio}h</span> desde último servicio
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Cobrado",    value: `€${cobrado.toLocaleString("es-ES")}`,    sub: "reservas completadas", accent: true },
          { label: "Proyectado", value: `€${proyectado.toLocaleString("es-ES")}`, sub: "sin canceladas" },
          { label: "Activos",    value: activosSoc.length,                         sub: `${activosSoc.filter(a => a.estado === "ACTIVO").length} disponibles` },
          { label: "Reservas",   value: reservasSoc.length,                        sub: `${reservasSoc.filter(b => b.estado === "completada").length} completadas` },
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

      <div className="grid xl:grid-cols-5 gap-5">

        {/* Flota */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b" style={{ background: "var(--navy)", borderColor: "var(--border)" }}>
              <p className="text-[13px] font-semibold text-white">Flota</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#7BAFD4" }}>
                {activosSoc.length} activo{activosSoc.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ background: "var(--surface)" }}>
              {activosSoc.map((a, i) => {
                const badge = ESTADO_BADGE[a.estado];
                const pct   = Math.min((a.horas_desde_servicio / 100) * 100, 100);
                const horaColor =
                  a.horas_desde_servicio >= 100 ? "var(--red)" :
                  a.horas_desde_servicio >= 50  ? "var(--amber)" : "var(--green)";
                return (
                  <div
                    key={a.id}
                    className="px-4 py-3 hover:bg-[var(--muted)] transition-colors"
                    style={{ borderBottom: i < activosSoc.length - 1 ? "1px solid var(--border)" : "none" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <p className="text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{a.nombre}</p>
                        <p className="font-mono text-[11px]" style={{ color: "var(--text-3)" }}>{a.matricula} · {a.modelo}</p>
                      </div>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.color }} />
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: horaColor }} />
                      </div>
                      <span className="font-mono text-[11px]" style={{ color: horaColor }}>
                        {a.horas_desde_servicio}h / 100h
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reservas */}
        <div className="xl:col-span-3">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Reservas</p>
              <input
                type="text"
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border text-[12px] outline-none focus:border-[var(--blue)] w-[160px]"
                style={{ borderColor: "var(--border)", background: "var(--muted)", color: "var(--foreground)" }}
              />
            </div>

            {reservasFiltradas.length === 0 ? (
              <div className="text-center py-10" style={{ color: "var(--text-3)", background: "var(--surface)" }}>
                <p className="text-2xl mb-2 opacity-40">📋</p>
                <p className="text-[13px]">Sin reservas</p>
              </div>
            ) : (
              <div style={{ background: "var(--surface)" }}>
                {reservasFiltradas.map((r, i) => {
                  const badge = RESERVA_BADGE[r.estado];
                  const fecha = new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)] transition-colors"
                      style={{ borderBottom: i < reservasFiltradas.length - 1 ? "1px solid var(--border)" : "none" }}
                    >
                      <div className="w-12 flex-shrink-0 text-center">
                        <p className="font-mono text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>€{r.ingreso_neto}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{fecha}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-mono text-[10px] text-white px-1 py-0.5 rounded flex-shrink-0" style={{ background: "var(--navy)" }}>
                            {r.activo_id}
                          </span>
                          <span className="text-[12px] font-medium truncate" style={{ color: "var(--foreground)" }}>{r.cliente}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                          {r.duracion} · {r.hora} · {r.fuente}
                        </p>
                      </div>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </InvestorShell>
  );
}
