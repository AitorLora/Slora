"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { assets, bookings, sociedades } from "@/lib/mock-data";

function exportarCSV(
  mes: string,
  mesLabel: string,
  sociedadesFiltradas: typeof sociedades,
  reservasMes: typeof bookings,
) {
  const rows: string[][] = [];
  rows.push([`Reporte Slora — ${mesLabel}`]);
  rows.push([]);
  rows.push(["Sociedad", "Activo", "Matrícula", "Tipo", "H. Inicio mes", "H. Fin mes", "Δ Horas", "Ingreso neto (€)"]);

  for (const soc of sociedadesFiltradas) {
    const activosSoc  = assets.filter(a => a.sociedad_id === soc.id);
    const reservasSoc = reservasMes.filter(b => b.sociedad_id === soc.id);

    for (const a of activosSoc) {
      const reservasActivo = reservasSoc.filter(b => b.activo_id === a.id);
      const delta   = reservasActivo.reduce((s, b) => s + b.horas_consumidas, 0);
      const ingreso = reservasActivo.reduce((s, b) => s + b.ingreso_neto, 0);
      rows.push([soc.nombre, a.nombre, a.matricula, a.tipo === "moto" ? "Moto" : "Barco",
        String(a.horas_motor - delta), String(a.horas_motor), String(delta), String(ingreso)]);
    }

    const totalHorasSoc  = reservasSoc.reduce((s, b) => s + b.horas_consumidas, 0);
    const totalIngresoSoc = reservasSoc.reduce((s, b) => s + b.ingreso_neto, 0);
    rows.push([soc.nombre, "TOTAL", "", "", "", "", String(totalHorasSoc), String(totalIngresoSoc)]);
    rows.push([]);
  }

  const csv  = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `reporte-${mes}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MESES = [
  { value: "2026-04", label: "Abril 2026" },
  { value: "2026-05", label: "Mayo 2026" },
  { value: "2026-06", label: "Junio 2026" },
];

export default function ReportesPage() {
  const [mes, setMes] = useState("2026-05");
  const [sociedadFiltro, setSociedadFiltro] = useState("");

  const mesLabel = MESES.find(m => m.value === mes)?.label ?? mes;

  // Reservas del mes seleccionado (completadas + en_curso)
  const reservasMes = bookings.filter(b =>
    b.fecha.startsWith(mes) && (b.estado === "completada" || b.estado === "en_curso")
  );

  const sociedadesFiltradas = sociedades.filter(s =>
    sociedadFiltro === "" || s.id === sociedadFiltro
  );

  // Totales globales del mes
  const totalIngreso = reservasMes.reduce((s, b) => s + b.ingreso_neto, 0);
  const totalHoras   = reservasMes.reduce((s, b) => s + b.horas_consumidas, 0);
  const totalReservas = reservasMes.length;

  const filters = (
    <div className="flex items-center gap-2">
      <select value={mes} onChange={e => setMes(e.target.value)}
        className="px-3 py-1.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
        {MESES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <select value={sociedadFiltro} onChange={e => setSociedadFiltro(e.target.value)}
        className="px-3 py-1.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
        <option value="">Todas las sociedades</option>
        {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>

      {/* separador */}
      <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

      <button
        onClick={() => exportarCSV(mes, mesLabel, sociedadesFiltradas, reservasMes)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--muted)]"
        style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--surface)" }}
      >
        ↓ CSV
      </button>
      <button
        onClick={() => window.print()}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
        style={{ background: "var(--navy)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--navy-light)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--navy)")}
      >
        ⎙ Imprimir
      </button>
    </div>
  );

  return (
    <AppShell title="Reportes" subtitle={`Reporte mensual · ${mesLabel}`} actions={filters}>

      {/* Cabecera solo visible al imprimir */}
      <div className="hidden print:block mb-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[18px] font-bold" style={{ color: "var(--navy)" }}>Slora — Reporte mensual</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-3)" }}>
              {mesLabel}
              {sociedadFiltro ? ` · ${sociedades.find(s => s.id === sociedadFiltro)?.nombre}` : " · Todas las sociedades"}
            </p>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
            Generado el {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* KPIs del mes */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Ingreso neto del mes",  value: `€${totalIngreso.toLocaleString("es-ES")}`, sub: "reservas completadas", accent: true },
          { label: "Horas de motor usadas", value: `${totalHoras}h`,  sub: "suma de toda la flota" },
          { label: "Reservas cerradas",     value: totalReservas,      sub: "completadas + en curso" },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="rounded-xl p-4 border"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderTop: accent ? "3px solid var(--blue)" : "1px solid var(--border)",
            }}>
            <p className="text-[11px] uppercase tracking-[0.05em] mb-1.5" style={{ color: "var(--text-3)" }}>{label}</p>
            <p className="font-mono text-[26px] font-semibold tracking-[-1px]" style={{ color: "var(--foreground)" }}>{value}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Reporte por sociedad */}
      <div className="space-y-5">
        {sociedadesFiltradas.map(soc => {
          const activosSoc    = assets.filter(a => a.sociedad_id === soc.id);
          const reservasSoc   = reservasMes.filter(b => b.sociedad_id === soc.id);
          const ingresoSoc    = reservasSoc.reduce((s, b) => s + b.ingreso_neto, 0);
          const horasSoc      = reservasSoc.reduce((s, b) => s + b.horas_consumidas, 0);

          // Fila por activo
          const filas = activosSoc.map(a => {
            const reservasActivo = reservasSoc.filter(b => b.activo_id === a.id);
            const deltaHoras     = reservasActivo.reduce((s, b) => s + b.horas_consumidas, 0);
            const ingresoActivo  = reservasActivo.reduce((s, b) => s + b.ingreso_neto, 0);
            const horasFinales   = a.horas_motor;
            const horasIniciales = horasFinales - deltaHoras;
            return { a, deltaHoras, ingresoActivo, horasIniciales, horasFinales };
          });

          return (
            <div key={soc.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {/* Cabecera sociedad */}
              <div className="flex items-center justify-between px-5 py-3" style={{ background: "var(--navy)" }}>
                <span className="text-[13px] font-semibold text-white">{soc.nombre}</span>
                <div className="flex items-center gap-4 text-[11px]" style={{ color: "#7BAFD4" }}>
                  <span>{horasSoc}h utilizadas</span>
                  <span className="font-mono font-semibold text-white text-[13px]">
                    €{ingresoSoc.toLocaleString("es-ES")}
                  </span>
                </div>
              </div>

              {/* Cabecera tabla */}
              <div className="grid px-5 py-2 text-[10px] uppercase tracking-[0.06em] font-medium"
                style={{
                  gridTemplateColumns: "1fr 80px 100px 100px 80px 100px",
                  gap: "12px",
                  color: "var(--text-3)",
                  background: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}>
                <span>Activo</span>
                <span>Tipo</span>
                <span className="text-right">H. Inicio mes</span>
                <span className="text-right">H. Fin mes</span>
                <span className="text-right">Δ Horas</span>
                <span className="text-right">Ingreso neto</span>
              </div>

              {/* Filas */}
              <div style={{ background: "var(--surface)" }}>
                {filas.map(({ a, deltaHoras, ingresoActivo, horasIniciales, horasFinales }, i) => (
                  <div key={a.id}
                    className="grid px-5 py-3 items-center hover:bg-[var(--muted)] transition-colors"
                    style={{
                      gridTemplateColumns: "1fr 80px 100px 100px 80px 100px",
                      gap: "12px",
                      borderBottom: i < filas.length - 1 ? "1px solid var(--border)" : "none",
                    }}>
                    <div>
                      <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{a.nombre}</p>
                      <p className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>{a.matricula}</p>
                    </div>
                    <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
                      {a.tipo === "moto" ? "Moto" : "Barco"}
                    </span>
                    <span className="font-mono text-[12px] text-right" style={{ color: "var(--text-2)" }}>
                      {horasIniciales}h
                    </span>
                    <span className="font-mono text-[12px] text-right" style={{ color: "var(--foreground)" }}>
                      {horasFinales}h
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-right"
                      style={{ color: deltaHoras > 0 ? "var(--blue)" : "var(--text-3)" }}>
                      {deltaHoras > 0 ? `+${deltaHoras}h` : "—"}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-right"
                      style={{ color: ingresoActivo > 0 ? "var(--green-text)" : "var(--text-3)" }}>
                      {ingresoActivo > 0 ? `€${ingresoActivo.toLocaleString("es-ES")}` : "—"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totales de la sociedad */}
              <div className="grid px-5 py-3 items-center border-t"
                style={{
                  gridTemplateColumns: "1fr 80px 100px 100px 80px 100px",
                  gap: "12px",
                  borderColor: "var(--border)",
                  background: "var(--muted)",
                }}>
                <span className="text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>Total {soc.nombre}</span>
                <span />
                <span />
                <span />
                <span className="font-mono text-[12px] font-semibold text-right" style={{ color: "var(--blue)" }}>
                  +{horasSoc}h
                </span>
                <span className="font-mono text-[13px] font-semibold text-right" style={{ color: "var(--navy)" }}>
                  €{ingresoSoc.toLocaleString("es-ES")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Nota al pie */}
      {reservasMes.length === 0 && (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
          <p className="text-3xl mb-3 opacity-40">📊</p>
          <p>No hay reservas completadas en {mesLabel}</p>
        </div>
      )}
    </AppShell>
  );
}
