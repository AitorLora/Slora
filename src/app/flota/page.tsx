"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { assets as initialAssets, sociedades, bookings, type Asset, type AssetStatus, type AssetType } from "@/lib/mock-data";

const ESTADO_DOT: Record<AssetStatus, string> = {
  ACTIVO:        "var(--green)",
  ALERTA:        "var(--amber)",
  MANTENIMIENTO: "var(--text-3)",
};

const ESTADO_BADGE: Record<AssetStatus, { label: string; color: string; bg: string }> = {
  ACTIVO:        { label: "Disponible",     color: "var(--green-text)", bg: "var(--green-bg)" },
  ALERTA:        { label: "Alerta 50-100h", color: "var(--amber-text)", bg: "var(--amber-bg)" },
  MANTENIMIENTO: { label: "Mantenimiento",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
};

function calcularEstado(horas: number): AssetStatus {
  if (horas >= 100) return "MANTENIMIENTO";
  if (horas >= 50)  return "ALERTA";
  return "ACTIVO";
}

export default function FlotaPage() {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [tipoFiltro, setTipoFiltro] = useState<AssetType | "">("");
  const [estadoFiltro, setEstadoFiltro] = useState<AssetStatus | "">("");

  function marcarRevision(id: string) {
    setAssets(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, horas_desde_servicio: 0, estado: "ACTIVO" }
          : a
      )
    );
  }

  const alertas = assets.filter(a => a.estado === "ALERTA" || a.estado === "MANTENIMIENTO");

  const activosFiltrados = assets.filter(a => {
    if (tipoFiltro && a.tipo !== tipoFiltro) return false;
    if (estadoFiltro && a.estado !== estadoFiltro) return false;
    return true;
  });

  const filters = (
    <div className="flex items-center gap-2">
      <select
        value={tipoFiltro}
        onChange={e => setTipoFiltro(e.target.value as AssetType | "")}
        className="px-3 py-1.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
      >
        <option value="">Todos los tipos</option>
        <option value="moto">Motos de agua</option>
        <option value="barco">Barcos</option>
      </select>
      <select
        value={estadoFiltro}
        onChange={e => setEstadoFiltro(e.target.value as AssetStatus | "")}
        className="px-3 py-1.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
      >
        <option value="">Todos los estados</option>
        <option value="ACTIVO">Disponible</option>
        <option value="ALERTA">Alerta</option>
        <option value="MANTENIMIENTO">Mantenimiento</option>
      </select>
    </div>
  );

  return (
    <AppShell title="Flota" subtitle={`${activosFiltrados.length} activos`} actions={filters}>

      {/* Banner de alertas */}
      {alertas.length > 0 && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl mb-5 border"
          style={{ background: "var(--amber-bg)", borderColor: "var(--amber)" }}
        >
          <span className="text-[18px] flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
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

      {/* Agrupado por sociedad */}
      <div className="space-y-5">
        {sociedades.map(soc => {
          const activos = activosFiltrados.filter(a => a.sociedad_id === soc.id);
          if (!activos.length) return null;

          const ingTotales = bookings
            .filter(b => b.sociedad_id === soc.id && b.estado === "completada")
            .reduce((s, b) => s + b.ingreso_neto, 0);

          return (
            <div key={soc.id} className="rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {/* Cabecera sociedad */}
              <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--navy)" }}>
                <span className="text-[13px] font-semibold text-white">{soc.nombre}</span>
                <span className="text-[11px]" style={{ color: "#7BAFD4" }}>
                  {activos.length} activo{activos.length !== 1 ? "s" : ""} · €{ingTotales.toLocaleString("es-ES")} cobrado
                </span>
              </div>

              {/* Cabecera tabla */}
              <div
                className="grid px-4 py-2 text-[10px] uppercase tracking-[0.06em] font-medium"
                style={{
                  gridTemplateColumns: "14px 110px 90px 1fr 50px 90px 140px 120px 36px",
                  gap: "12px",
                  color: "var(--text-3)",
                  background: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span /><span>Matrícula</span><span>Tipo</span><span>Modelo</span>
                <span>Cap.</span><span>H. Motor</span><span>Desde servicio</span>
                <span>Estado</span><span />
              </div>

              {/* Filas */}
              <div style={{ background: "var(--surface)" }}>
                {activos.map((a, i) => {
                  const badge = ESTADO_BADGE[a.estado];
                  const horaColor =
                    a.horas_desde_servicio >= 100 ? "var(--red)" :
                    a.horas_desde_servicio >= 50  ? "var(--amber)" : "var(--green)";
                  const pct = Math.min((a.horas_desde_servicio / 100) * 100, 100);
                  const necesitaRevision = a.estado === "ALERTA" || a.estado === "MANTENIMIENTO";

                  return (
                    <div
                      key={a.id}
                      className="grid px-4 py-3 items-center transition-colors hover:bg-[var(--muted)]"
                      style={{
                        gridTemplateColumns: "14px 110px 90px 1fr 50px 90px 140px 120px 36px",
                        gap: "12px",
                        borderBottom: i < activos.length - 1 ? "1px solid var(--border)" : "none",
                      }}
                    >
                      <span className="w-2 h-2 rounded-full block flex-shrink-0" style={{ background: ESTADO_DOT[a.estado] }} />

                      <span className="font-mono text-[12px] font-medium" style={{ color: "var(--navy)" }}>
                        {a.matricula}
                      </span>

                      <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
                        {a.tipo === "moto" ? "Moto de agua" : "Barco"}
                      </span>

                      <span className="text-[12px]" style={{ color: "var(--text-2)" }}>{a.modelo}</span>

                      <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                        {a.capacidad ? `${a.capacidad} pax` : "—"}
                      </span>

                      <span className="font-mono text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
                        {a.horas_motor}h
                      </span>

                      {/* Barra progreso + horas */}
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "var(--border)", maxWidth: "52px" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: horaColor }}
                          />
                        </div>
                        <span className="font-mono text-[12px] font-medium" style={{ color: horaColor }}>
                          {a.horas_desde_servicio}h
                        </span>
                        <span className="text-[10px]" style={{ color: "var(--text-3)" }}>/ 100h</span>
                      </div>

                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ color: badge.color, background: badge.bg }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: badge.color }} />
                        {badge.label}
                      </span>

                      {/* Botón revisión */}
                      {necesitaRevision ? (
                        <button
                          onClick={() => marcarRevision(a.id)}
                          title="Marcar revisión realizada — reinicia contador"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] transition-colors hover:scale-110"
                          style={{ background: "var(--green-bg)", color: "var(--green-text)" }}
                        >
                          🔧
                        </button>
                      ) : (
                        <span className="w-7 h-7" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
