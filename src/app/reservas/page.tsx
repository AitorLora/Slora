"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NuevaReservaModal, type ModalInitialValues } from "@/components/reservas/NuevaReservaModal";
import { createClient } from "@/lib/supabase/client";
import { cambiarEstadoReserva, eliminarReserva, crearReserva } from "./actions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { BarcoCategoria } from "@/lib/mock-data";

const ESTADO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber-text)", bg: "var(--amber-bg)" },
  confirmada: { label: "Confirmada", color: "#0C447C",           bg: "var(--blue-light)" },
  en_curso:   { label: "En curso",   color: "#0369A1",           bg: "#E0F2FE" },
  completada: { label: "Completada", color: "var(--green-text)", bg: "var(--green-bg)" },
  cancelada:  { label: "Cancelada",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
  conflicto:  { label: "Conflicto",  color: "var(--red-text)",   bg: "var(--red-bg)" },
};

const ESTADOS = ["pendiente", "confirmada", "en_curso", "completada", "cancelada"];

export default function ReservasPage() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [sociedades, setSociedades] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen]           = useState(false);
  const [modalInitial, setModalInitial]     = useState<ModalInitialValues | undefined>();
  const [busqueda, setBusqueda]             = useState("");
  const [estadoFiltro, setEstadoFiltro]     = useState("");
  const [sociedadFiltro, setSociedadFiltro] = useState("");
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  const [confirmar, setConfirmar] = useState<{ id: number; cliente: string } | null>(null);
  async function cargar() {
    try {
      const supabase = createClient();
      const [{ data: res, error: e1 }, { data: soc, error: e2 }] = await Promise.all([
        supabase.from("reservas").select("*").order("created_at", { ascending: false }),
        supabase.from("sociedades").select("id, nombre"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setReservas(res ?? []);
      setSociedades(soc ?? []);
    } catch {
      // la UI mostrará lista vacía; el usuario puede recargar la página
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  // Detectar params de presupuesto en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "presupuesto") return;
    const iv: ModalInitialValues = {};
    const t = params.get("tipo");
    if (t === "moto" || t === "barco") iv.tipo = t;
    const c = params.get("cantidad"); if (c) iv.cantidad = Number(c);
    const cat = params.get("categoria"); if (cat) iv.categoria = cat as BarcoCategoria;
    const dur = params.get("duracion"); if (dur) iv.duracion = dur;
    const h = params.get("hora"); if (h) iv.hora = h;
    const f = params.get("fecha"); if (f) iv.fecha = f;
    const fu = params.get("fuente"); if (fu) iv.fuente = fu;
    setModalInitial(iv);
    setModalOpen(true);
    window.history.replaceState({}, "", "/reservas");
  }, []);

  // Realtime: escuchar cambios en reservas
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reservas-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtradas = reservas.filter(r => {
    const q = busqueda.toLowerCase();
    if (q && !r.cliente?.toLowerCase().includes(q) && !r.activo_id?.toLowerCase().includes(q) && !r.fuente?.toLowerCase().includes(q)) return false;
    if (estadoFiltro && r.estado !== estadoFiltro) return false;
    if (sociedadFiltro && r.sociedad_id !== sociedadFiltro) return false;
    return true;
  });

  const conflictos = reservas.filter(r => r.estado === "conflicto").length;

  const actions = (
    <button
      onClick={() => { setModalInitial(undefined); setModalOpen(true); }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
      style={{ background: "var(--navy)" }}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--navy-light)")}
      onMouseLeave={e => (e.currentTarget.style.background = "var(--navy)")}
    >
      + Nueva reserva
    </button>
  );

  return (
    <AppShell title="Reservas" subtitle={`${filtradas.length} reservas`} actions={actions}>

      {/* Banner conflictos */}
      {conflictos > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border"
          style={{ background: "var(--red-bg)", borderColor: "var(--red-text)" }}>
          <span className="text-[18px]">⚠️</span>
          <p className="text-[13px] font-semibold" style={{ color: "var(--red-text)" }}>
            {conflictos} reserva{conflictos > 1 ? "s en conflicto" : " en conflicto"} — mismo activo y fecha. Revisa y resuelve manualmente.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "var(--text-3)" }}>⌕</span>
          <input type="text" placeholder="Buscar cliente, activo, plataforma..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
        </div>
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
          className="px-3 py-2 rounded-lg border text-[13px] outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={sociedadFiltro} onChange={e => setSociedadFiltro(e.target.value)}
          className="px-3 py-2 rounded-lg border text-[13px] outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
          <option value="">Todas las sociedades</option>
          {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>Cargando...</div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
          <p className="text-3xl mb-3 opacity-40">📋</p>
          <p>No hay reservas con estos filtros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(r => {
            const est = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
            const fecha = r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
            return (
              <div key={r.id}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors hover:border-[var(--border-2)]"
                style={{ background: "var(--surface)", borderColor: r.estado === "conflicto" ? "var(--red-text)" : "var(--border)" }}>

                <div className="w-16 flex-shrink-0">
                  <p className="font-mono text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
                    €{Number(r.ingreso_neto).toLocaleString("es-ES")}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[11px] text-white px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: "var(--navy)" }}>
                      {r.activo_id}
                    </span>
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>{r.cliente}</span>
                    <span className="text-[12px]" style={{ color: "var(--text-3)" }}>· {r.duracion} · {r.hora}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                    <span>{fecha}</span>
                    <span>·</span>
                    <span>{r.tipo === "moto" ? "Moto" : "Barco"}</span>
                    <span>·</span>
                    <span className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--muted)" }}>{r.fuente}</span>
                    {r.notas && <><span>·</span><span className="italic">{r.notas}</span></>}
                  </div>
                </div>

                {/* Dropdown estado */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setMenuAbierto(menuAbierto === r.id ? null : r.id)}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full"
                    style={{ color: est.color, background: est.bg }}>
                    {est.label} ▾
                  </button>
                  {menuAbierto === r.id && (
                    <div className="absolute right-0 top-[calc(100%+4px)] rounded-lg border overflow-hidden z-20 min-w-[130px]"
                      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                      {ESTADOS.map(e => (
                        <button key={e} onClick={async () => {
                          setMenuAbierto(null);
                          await cambiarEstadoReserva(r.id, e);
                          cargar();
                        }}
                          className="w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 hover:bg-[var(--muted)]"
                          style={{ color: "var(--foreground)" }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESTADO_STYLE[e]?.color }} />
                          {ESTADO_STYLE[e]?.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Eliminar */}
                <button onClick={() => setConfirmar({ id: r.id, cliente: r.cliente })}
                  className="text-[18px] leading-none px-2 py-1 rounded flex-shrink-0 hover:bg-[var(--red-bg)]"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--red-text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {menuAbierto !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
      )}

      <ConfirmModal
        open={confirmar !== null}
        titulo="Eliminar reserva"
        mensaje={`¿Eliminar la reserva de ${confirmar?.cliente}? Esta acción no se puede deshacer.`}
        labelConfirmar="Eliminar"
        onCancelar={() => setConfirmar(null)}
        onConfirmar={async () => {
          if (!confirmar) return;
          await eliminarReserva(confirmar.id);
          setConfirmar(null);
          cargar();
        }}
      />

      <NuevaReservaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialValues={modalInitial}
        onGuardar={async (booking) => {
          await crearReserva({
            activo_id: booking.activo_id,
            sociedad_id: booking.sociedad_id,
            tipo: booking.tipo,
            cliente: booking.cliente,
            fecha: booking.fecha,
            hora: booking.hora,
            duracion: booking.duracion,
            horas_consumidas: booking.horas_consumidas,
            ingreso_neto: booking.ingreso_neto,
            fuente: booking.fuente,
            notas: booking.notas,
          });
          cargar();
        }}
      />
    </AppShell>
  );
}
