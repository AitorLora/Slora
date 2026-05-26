"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { createClient } from "@/lib/supabase/client";

function exportarCSV(mes: string, mesLabel: string, sociedadesFiltradas: any[], reservasMes: any[], activos: any[]) {
  const rows: string[][] = [];
  rows.push([`Reporte Slora — ${mesLabel}`]);
  rows.push([]);
  rows.push(["Sociedad", "Activo", "Matrícula", "Tipo", "Δ Horas", "Ingreso neto (€)"]);

  for (const soc of sociedadesFiltradas) {
    const activosSoc  = activos.filter(a => a.sociedad_id === soc.id);
    const reservasSoc = reservasMes.filter(r => r.sociedad_id === soc.id);
    for (const a of activosSoc) {
      const reservasActivo = reservasSoc.filter(r => r.activo_id === a.id);
      const delta   = reservasActivo.reduce((s: number, r: any) => s + Number(r.horas_consumidas), 0);
      const ingreso = reservasActivo.reduce((s: number, r: any) => s + Number(r.ingreso_neto), 0);
      rows.push([soc.nombre, a.nombre, a.matricula, a.tipo === "moto" ? "Moto" : "Barco", String(delta), String(ingreso)]);
    }
    rows.push([soc.nombre, "TOTAL", "", "",
      String(reservasSoc.reduce((s: number, r: any) => s + Number(r.horas_consumidas), 0)),
      String(reservasSoc.reduce((s: number, r: any) => s + Number(r.ingreso_neto), 0)),
    ]);
    rows.push([]);
  }

  // CRÍTICO 3: sanitizar CSV injection (fórmulas =, +, -, @, tab, CR)
  const sanitize = (c: string) => `"${String(c).replace(/^([=+\-@\t\r])/, "'$1").replace(/"/g, '""')}"`;
  const csv  = rows.map(r => r.map(sanitize).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `reporte-${mes}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportesPage() {
  const [reservas, setReservas]   = useState<any[]>([]);
  const [activos, setActivos]     = useState<any[]>([]);
  const [sociedades, setSociedades] = useState<any[]>([]);
  const [mes, setMes]             = useState("");
  const [errorCarga, setErrorCarga] = useState("");
  const [sociedadFiltro, setSociedadFiltro] = useState("");

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("reservas").select("*").gte("fecha", `${new Date().getFullYear()}-01-01`),
      supabase.from("activos").select("id, nombre, matricula, tipo, sociedad_id, horas_motor"),
      supabase.from("sociedades").select("id, nombre"),
    ]).then(([{ data: r, error: e1 }, { data: a, error: e2 }, { data: s, error: e3 }]) => {
      if (e1 || e2 || e3) {
        setErrorCarga("Error al cargar los datos. Recarga la página.");
        return;
      }
      setReservas(r ?? []);
      setActivos(a ?? []);
      setSociedades(s ?? []);
      const meses = [...new Set((r ?? []).map((x: any) => x.fecha?.slice(0, 7)).filter(Boolean))].sort();
      if (meses.length) setMes(meses[meses.length - 1]);
    });
  }, []);

  // Meses disponibles (dinámico desde los datos)
  const mesesDisponibles = [...new Set(reservas.map(r => r.fecha?.slice(0, 7)).filter(Boolean))].sort();
  function mesLabel(m: string) {
    const [year, month] = m.split("-");
    return new Date(Number(year), Number(month) - 1).toLocaleString("es-ES", { month: "long", year: "numeric" });
  }
  const MESES_LABELS: Record<string, string> = Object.fromEntries(mesesDisponibles.map(m => [m, mesLabel(m)]));

  const reservasMes = reservas.filter(r =>
    r.fecha?.startsWith(mes) && r.estado !== "cancelada"
  );
  const sociedadesFiltradas = sociedades.filter(s => !sociedadFiltro || s.id === sociedadFiltro);

  const totalIngreso  = reservasMes.reduce((s, r) => s + Number(r.ingreso_neto), 0);
  const totalHoras    = reservasMes.reduce((s, r) => s + Number(r.horas_consumidas), 0);
  const totalReservas = reservasMes.length;

  const filters = (
    <div className="flex items-center gap-2">
      <select value={mes} onChange={e => setMes(e.target.value)}
        className="px-3 py-1.5 rounded-lg border text-[13px] outline-none cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
        {mesesDisponibles.map(m => <option key={m} value={m}>{MESES_LABELS[m] ?? m}</option>)}
      </select>
      <select value={sociedadFiltro} onChange={e => setSociedadFiltro(e.target.value)}
        className="px-3 py-1.5 rounded-lg border text-[13px] outline-none cursor-pointer"
        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
        <option value="">Todas las sociedades</option>
        {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select>
      <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />
      <button onClick={() => exportarCSV(mes, MESES_LABELS[mes] ?? mes, sociedadesFiltradas, reservasMes, activos)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium hover:bg-[var(--muted)] transition-colors"
        style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--surface)" }}>
        ↓ CSV
      </button>
      <button onClick={() => setTimeout(() => window.print(), 0)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white"
        style={{ background: "var(--navy)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--navy-light)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--navy)")}>
        ⎙ Imprimir
      </button>
    </div>
  );

  return (
    <AppShell title="Reportes" subtitle={`Reporte mensual · ${MESES_LABELS[mes] ?? mes}`} actions={filters}>
      {errorCarga && (
        <div className="px-4 py-3 rounded-xl mb-4 border text-[13px]"
          style={{ background: "var(--red-bg)", borderColor: "var(--red-text)", color: "var(--red-text)" }}>
          {errorCarga}
        </div>
      )}
      <div className="hidden print:block mb-6 pb-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[18px] font-bold" style={{ color: "var(--navy)" }}>Slora — Reporte mensual</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--text-3)" }}>{MESES_LABELS[mes] ?? mes}</p>
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
            Generado el {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Ingreso neto del mes",  value: `€${totalIngreso.toLocaleString("es-ES")}`, sub: "completadas + en curso", accent: true },
          { label: "Horas de motor usadas", value: `${totalHoras}h`, sub: "suma de toda la flota" },
          { label: "Reservas cerradas",     value: totalReservas, sub: "completadas + en curso" },
        ].map(({ label, value, sub, accent }) => (
          <div key={label} className="rounded-xl p-4 border"
            style={{ background: "var(--surface)", borderColor: "var(--border)", borderTop: accent ? "3px solid var(--blue)" : "1px solid var(--border)" }}>
            <p className="text-[11px] uppercase tracking-[0.05em] mb-1.5" style={{ color: "var(--text-3)" }}>{label}</p>
            <p className="font-mono text-[26px] font-semibold tracking-[-1px]" style={{ color: "var(--foreground)" }}>{value}</p>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>{sub}</p>
          </div>
        ))}
      </div>

      {reservasMes.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
          <p className="text-3xl mb-3 opacity-40">📊</p>
          <p>No hay reservas en {MESES_LABELS[mes] ?? mes}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sociedadesFiltradas.map(soc => {
            const activosSoc   = activos.filter(a => a.sociedad_id === soc.id);
            const reservasSoc  = reservasMes.filter(r => r.sociedad_id === soc.id);
            const ingresoSoc   = reservasSoc.reduce((s, r) => s + Number(r.ingreso_neto), 0);
            const horasSoc     = reservasSoc.reduce((s, r) => s + Number(r.horas_consumidas), 0);

            return (
              <div key={soc.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ background: "var(--navy)" }}>
                  <span className="text-[13px] font-semibold text-white">{soc.nombre}</span>
                  <div className="flex items-center gap-4 text-[11px]" style={{ color: "#7BAFD4" }}>
                    <span>{horasSoc}h utilizadas</span>
                    <span className="font-mono font-semibold text-white text-[13px]">€{ingresoSoc.toLocaleString("es-ES")}</span>
                  </div>
                </div>
                <div className="grid px-5 py-2 text-[10px] uppercase tracking-[0.06em] font-medium"
                  style={{ gridTemplateColumns: "1fr 80px 80px 100px", gap: "12px", color: "var(--text-3)", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                  <span>Activo</span><span>Tipo</span><span className="text-right">Δ Horas</span><span className="text-right">Ingreso neto</span>
                </div>
                <div style={{ background: "var(--surface)" }}>
                  {activosSoc.map((a, i) => {
                    const reservasActivo = reservasSoc.filter(r => r.activo_id === a.id);
                    const deltaHoras     = reservasActivo.reduce((s, r) => s + Number(r.horas_consumidas), 0);
                    const ingresoActivo  = reservasActivo.reduce((s, r) => s + Number(r.ingreso_neto), 0);
                    return (
                      <div key={a.id} className="grid px-5 py-3 items-center hover:bg-[var(--muted)] transition-colors"
                        style={{ gridTemplateColumns: "1fr 80px 80px 100px", gap: "12px", borderBottom: i < activosSoc.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div>
                          <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{a.nombre}</p>
                          <p className="font-mono text-[10px]" style={{ color: "var(--text-3)" }}>{a.matricula}</p>
                        </div>
                        <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{a.tipo === "moto" ? "Moto" : "Barco"}</span>
                        <span className="font-mono text-[12px] font-semibold text-right" style={{ color: deltaHoras > 0 ? "var(--blue)" : "var(--text-3)" }}>
                          {deltaHoras > 0 ? `+${deltaHoras}h` : "—"}
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-right" style={{ color: ingresoActivo > 0 ? "var(--green-text)" : "var(--text-3)" }}>
                          {ingresoActivo > 0 ? `€${ingresoActivo.toLocaleString("es-ES")}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid px-5 py-3 items-center border-t"
                  style={{ gridTemplateColumns: "1fr 80px 80px 100px", gap: "12px", borderColor: "var(--border)", background: "var(--muted)" }}>
                  <span className="text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>Total {soc.nombre}</span>
                  <span /><span className="font-mono text-[12px] font-semibold text-right" style={{ color: "var(--blue)" }}>+{horasSoc}h</span>
                  <span className="font-mono text-[13px] font-semibold text-right" style={{ color: "var(--navy)" }}>€{ingresoSoc.toLocaleString("es-ES")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
