"use client";

import { use, useState, useEffect } from "react";
import { InvestorShell } from "@/components/layout/InvestorShell";
import { createClient } from "@/lib/supabase/client";
import { notFound } from "next/navigation";

const ESTADO_ACTIVO: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVO:        { label: "Disponible",     color: "var(--green-text)", bg: "var(--green-bg)" },
  ALERTA:        { label: "Alerta 50-100h", color: "var(--amber-text)", bg: "var(--amber-bg)" },
  MANTENIMIENTO: { label: "Mantenimiento",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
};

const ESTADO_RESERVA: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber-text)", bg: "var(--amber-bg)" },
  confirmada: { label: "Confirmada", color: "#0C447C",           bg: "var(--blue-light)" },
  en_curso:   { label: "En curso",   color: "#0369A1",           bg: "#E0F2FE" },
  completada: { label: "Completada", color: "var(--green-text)", bg: "var(--green-bg)" },
  cancelada:  { label: "Cancelada",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
  conflicto:  { label: "Conflicto",  color: "var(--red-text)",   bg: "var(--red-bg)" },
};

export default function PanelInversorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [sociedad, setSociedad] = useState<{ id: string; nombre: string } | null>(null);
  const [activos, setActivos]   = useState<any[]>([]);
  const [reservas, setReservas] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [notFound404, setNotFound404] = useState(false);

  async function cargar() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNotFound404(true); return; }
      const { data: profile } = await supabase.from("perfiles").select("sociedad_id, rol").eq("id", user.id).single();
      if (profile?.rol !== "master" && profile?.sociedad_id !== id) { setNotFound404(true); return; }
      const [{ data: soc, error: e1 }, { data: acts, error: e2 }, { data: revs, error: e3 }] = await Promise.all([
        supabase.from("sociedades").select("id, nombre").eq("id", id).single(),
        supabase.from("activos").select("*").eq("sociedad_id", id),
        supabase.from("reservas").select("*").eq("sociedad_id", id).order("created_at", { ascending: false }),
      ]);
      if (e1 || e2 || e3) throw e1 ?? e2 ?? e3;
      if (!soc) { setNotFound404(true); return; }
      setSociedad(soc);
      setActivos(acts ?? []);
      setReservas(revs ?? []);
    } catch {
      // error de red o permisos — la UI mostrará estado vacío
    }
  }

  useEffect(() => { cargar(); }, [id]);

  // Realtime: cualquier cambio en reservas de esta sociedad se refleja al instante
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`reservas-sociedad-${id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "reservas", filter: `sociedad_id=eq.${id}` },
        () => cargar()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  if (notFound404) notFound();
  if (!sociedad) return null;

  const cobrado    = reservas.filter(r => r.estado === "completada").reduce((s, r) => s + Number(r.ingreso_neto), 0);
  const proyectado = reservas.filter(r => r.estado !== "cancelada").reduce((s, r) => s + Number(r.ingreso_neto), 0);
  const disponibles = activos.filter(a => a.estado === "ACTIVO").length;
  const completadas = reservas.filter(r => r.estado === "completada").length;
  const alertas     = activos.filter(a => a.estado === "ALERTA" || a.estado === "MANTENIMIENTO");

  const reservasFiltradas = reservas.filter(r => {
    const q = busqueda.toLowerCase();
    return !q || r.cliente?.toLowerCase().includes(q) || r.activo_id?.toLowerCase().includes(q);
  });

  return (
    <InvestorShell sociedad={sociedad.nombre}>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Cobrado",     value: `€${cobrado.toLocaleString("es-ES")}`,    accent: true },
          { label: "Proyectado",  value: `€${proyectado.toLocaleString("es-ES")}` },
          { label: "Disponibles", value: `${disponibles}/${activos.length}` },
          { label: "Completadas", value: completadas },
        ].map(({ label, value, accent }) => (
          <div key={label} className="rounded-xl p-4 border"
            style={{ background: "var(--surface)", borderColor: "var(--border)", borderTop: accent ? "3px solid var(--blue)" : undefined }}>
            <p className="text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>{label}</p>
            <p className="font-mono text-[22px] font-semibold tracking-[-1px]" style={{ color: "var(--foreground)" }}>{value}</p>
          </div>
        ))}
      </div>

      {alertas.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-5 border"
          style={{ background: "var(--amber-bg)", borderColor: "var(--amber)" }}>
          <span>⚠️</span>
          <p className="text-[13px] font-semibold" style={{ color: "var(--amber-text)" }}>
            {alertas.map(a => a.nombre).join(", ")} — revisión pendiente
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-5">
        {/* Flota */}
        <div className="md:col-span-2 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>Tu flota</p>
          </div>
          {activos.map((a, i) => {
            const badge = ESTADO_ACTIVO[a.estado] ?? ESTADO_ACTIVO.ACTIVO;
            const pct = Math.min((a.horas_desde_servicio / 100) * 100, 100);
            const horaColor = a.horas_desde_servicio >= 100 ? "var(--red)" : a.horas_desde_servicio >= 50 ? "var(--amber)" : "var(--green)";
            return (
              <div key={a.id} className="px-4 py-3 hover:bg-[var(--muted)] transition-colors"
                style={{ borderBottom: i < activos.length - 1 ? "1px solid var(--border)" : "none", background: "var(--surface)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[12px] font-medium" style={{ color: "var(--navy)" }}>{a.matricula}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: badge.color, background: badge.bg }}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-[12px] mb-2" style={{ color: "var(--text-2)" }}>{a.modelo}</p>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: horaColor }} />
                  </div>
                  <span className="font-mono text-[11px]" style={{ color: horaColor }}>{a.horas_desde_servicio}h</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reservas en tiempo real */}
        <div className="md:col-span-3 rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
            <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              Reservas
              <span className="ml-2 text-[10px] font-normal px-1.5 py-0.5 rounded" style={{ color: "var(--green-text)", background: "var(--green-bg)" }}>
                ● En vivo
              </span>
            </p>
            <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="px-2.5 py-1 rounded-lg border text-[12px] outline-none w-36"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
          </div>
          {reservasFiltradas.length === 0 ? (
            <div className="text-center py-10" style={{ color: "var(--text-3)", background: "var(--surface)" }}>
              <p>No hay reservas todavía</p>
            </div>
          ) : (
            reservasFiltradas.map((r, i) => {
              const badge = ESTADO_RESERVA[r.estado] ?? ESTADO_RESERVA.pendiente;
              const fecha = r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }) : "—";
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--muted)] transition-colors"
                  style={{ borderBottom: i < reservasFiltradas.length - 1 ? "1px solid var(--border)" : "none", background: "var(--surface)" }}>
                  <span className="font-mono text-[11px] text-white px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--navy)" }}>
                    {r.activo_id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>{r.cliente}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{fecha} · {r.duracion} · {r.fuente}</p>
                  </div>
                  <span className="font-mono text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    €{Number(r.ingreso_neto).toLocaleString("es-ES")}
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: badge.color, background: badge.bg }}>
                    {badge.label}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </InvestorShell>
  );
}
