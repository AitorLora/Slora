"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NuevaReservaModal, type ModalInitialValues } from "@/components/reservas/NuevaReservaModal";
import { createClient } from "@/lib/supabase/client";
import { cambiarEstadoReserva, eliminarReserva, crearReserva, confirmarReservaExterna, rechazarReservaExterna } from "./actions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { BarcoCategoria } from "@/lib/mock-data";
import { Clock, CalendarDays, Search, ChevronRight, Anchor } from "lucide-react";

const ESTADO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber-text)", bg: "var(--amber-bg)" },
  confirmada: { label: "Confirmada", color: "#0C447C",           bg: "var(--blue-light)" },
  en_curso:   { label: "En curso",   color: "#0369A1",           bg: "#E0F2FE" },
  completada: { label: "Completada", color: "var(--green-text)", bg: "var(--green-bg)" },
  cancelada:  { label: "Cancelada",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
  rechazada:  { label: "Rechazada",  color: "#9B1C1C",           bg: "#FEF2F2" },
  conflicto:  { label: "Conflicto",  color: "var(--red-text)",   bg: "var(--red-bg)" },
};

const ESTADOS = ["pendiente", "confirmada", "en_curso", "completada", "cancelada"];

export default function ReservasPage() {
  const [reservas, setReservas]         = useState<any[]>([]);
  const [sociedades, setSociedades]     = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalInitial, setModalInitial] = useState<ModalInitialValues | undefined>();
  const [busqueda, setBusqueda]         = useState("");
  const [estadoFiltro, setEstadoFiltro]     = useState("");
  const [sociedadFiltro, setSociedadFiltro] = useState("");
  const [menuAbierto, setMenuAbierto]   = useState<number | null>(null);
  const [confirmar, setConfirmar]       = useState<{ id: number; cliente: string; accion?: "cancelar" } | null>(null);
  const [errorCarga, setErrorCarga]     = useState("");
  const [accionando, setAccionando]     = useState<Set<number>>(new Set());
  const [tabActivo, setTabActivo]       = useState<"todas" | "pendientes">("todas");

  async function cargar() {
    try {
      const supabase = createClient();
      const [{ data: res, error: e1 }, { data: soc, error: e2 }] = await Promise.all([
        supabase.from("reservas").select("*, activos(modelo, matricula, capacidad, licencia)").gte("fecha", `${new Date().getFullYear() - 1}-01-01`).order("created_at", { ascending: false }),
        supabase.from("sociedades").select("id, nombre"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setReservas(res ?? []);
      setSociedades(soc ?? []);
    } catch {
      setErrorCarga("Error al cargar los datos. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }

  function toMins(hora: string): number {
    const [h, m] = (hora ?? "09:00").split(":").map(Number);
    return h * 60 + (m || 0);
  }

  type DisponibilidadResult =
    | { ok: true }
    | { ok: false; conflictoCon: { id: number; cliente: string; hora: string; fuente: string; estado: string } };

  function estaDisponible(r: any): DisponibilidadResult {
    const rFecha = String(r.fecha ?? "").slice(0, 10);
    const rStart = toMins(r.hora);
    const rEnd   = rStart + Math.max(1, Number(r.horas_consumidas ?? 4)) * 60;

    for (const other of reservas) {
      if (other.id === r.id) continue;
      if (other.activo_id !== r.activo_id) continue;
      if (String(other.fecha ?? "").slice(0, 10) !== rFecha) continue;
      if (!["pendiente", "confirmada", "en_curso"].includes(other.estado)) continue;

      const oStart = toMins(other.hora);
      const oEnd   = oStart + Math.max(1, Number(other.horas_consumidas ?? 4)) * 60;
      if (!(rStart < oEnd && rEnd > oStart)) continue;

      if (other.estado === "pendiente") {
        const rCreated = new Date(r.created_at ?? 0).getTime();
        const oCreated = new Date(other.created_at ?? 0).getTime();
        if (rCreated > oCreated) {
          return { ok: false, conflictoCon: { id: other.id, cliente: other.cliente, hora: other.hora, fuente: other.fuente ?? "", estado: other.estado } };
        }
      } else {
        return { ok: false, conflictoCon: { id: other.id, cliente: other.cliente, hora: other.hora, fuente: other.fuente ?? "", estado: other.estado } };
      }
    }
    return { ok: true };
  }

  async function handleConfirmarExterna(id: number) {
    setAccionando(prev => new Set([...prev, id]));
    try {
      await confirmarReservaExterna(id);
      await cargar();
    } catch (e: any) {
      setErrorCarga(e.message ?? "Error al confirmar la reserva.");
    } finally {
      setAccionando(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  }

  async function handleRechazarExterna(id: number) {
    setAccionando(prev => new Set([...prev, id]));
    try {
      await rechazarReservaExterna(id);
      await cargar();
    } catch (e: any) {
      setErrorCarga(e.message ?? "Error al rechazar la reserva.");
    } finally {
      setAccionando(prev => { const next = new Set(prev); next.delete(id); return next; });
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

  // Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("reservas-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Filtros ────────────────────────────────────────────────────────────

  const filtradas = reservas.filter(r => {
    const q = busqueda.toLowerCase();
    if (q && !r.cliente?.toLowerCase().includes(q) && !r.activo_nombre?.toLowerCase().includes(q) && !r.fuente?.toLowerCase().includes(q)) return false;
    if (estadoFiltro && r.estado !== estadoFiltro) return false;
    if (sociedadFiltro && r.sociedad_id !== sociedadFiltro) return false;
    return true;
  });

  // Orden de visualización:
  //  1) Externas pendientes arriba (bandeja de tareas), por fecha+hora ascendente — la salida
  //     más próxima primero, para atender antes lo inminente.
  //  2) El resto debajo, por fecha descendente (lo más reciente primero), desempate created_at.
  const esPendienteExterna = (r: any) => Boolean(r.id_externo && r.estado === "pendiente");
  const claveFechaHora = (r: any) => `${String(r.fecha ?? "").slice(0, 10)}T${r.hora ?? "00:00"}`;

  const ordenadas = [...filtradas].sort((a, b) => {
    const pa = esPendienteExterna(a), pb = esPendienteExterna(b);
    if (pa !== pb) return pa ? -1 : 1;            // pendientes externas primero

    if (pa) {                                      // ambas pendientes: fecha+hora ascendente
      const ka = claveFechaHora(a), kb = claveFechaHora(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }
    // resto: fecha descendente, desempate por created_at descendente
    const fa = String(a.fecha ?? "").slice(0, 10), fb = String(b.fecha ?? "").slice(0, 10);
    if (fa !== fb) return fa < fb ? 1 : -1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  const conflictos = reservas.filter(r => r.estado === "conflicto").length;

  // Tabs y agrupación por fecha
  const hoyStr = new Date().toISOString().slice(0, 10);
  const manaStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  function grupoFecha(fecha: string) {
    const f = String(fecha ?? "").slice(0, 10);
    return f === hoyStr ? "Hoy" : f === manaStr ? "Mañana" : "Próximas reservas";
  }
  const pendientesExternas = ordenadas.filter(esPendienteExterna);
  const vistaActual = tabActivo === "pendientes" ? pendientesExternas : ordenadas;

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

      {errorCarga && (
        <div className="px-4 py-3 rounded-xl mb-4 border text-[13px]"
          style={{ background: "var(--red-bg)", borderColor: "var(--red-text)", color: "var(--red-text)" }}>
          {errorCarga}
        </div>
      )}

      {conflictos > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 border"
          style={{ background: "var(--red-bg)", borderColor: "var(--red-text)" }}>
          <span className="text-[18px]">⚠️</span>
          <p className="text-[13px] font-semibold" style={{ color: "var(--red-text)" }}>
            {conflictos} reserva{conflictos > 1 ? "s en conflicto" : " en conflicto"} — mismo activo y fecha. Revisa y resuelve manualmente.
          </p>
        </div>
      )}

      {/* Filter pills row */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
        {/* Estado pill */}
        <div className="relative flex-shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex-shrink-0">
            <Clock size={14} style={{ color: "var(--text-3)" }} />
          </span>
          <select
            value={estadoFiltro}
            onChange={e => setEstadoFiltro(e.target.value)}
            className="pl-7 pr-3 py-2 rounded-full border text-[12px] outline-none appearance-none cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: estadoFiltro ? "var(--foreground)" : "var(--text-3)" }}
          >
            <option value="">Estados</option>
            {Object.entries(ESTADO_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Sociedad pill */}
        <div className="relative flex-shrink-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex-shrink-0">
            <CalendarDays size={14} style={{ color: "var(--text-3)" }} />
          </span>
          <select
            value={sociedadFiltro}
            onChange={e => setSociedadFiltro(e.target.value)}
            className="pl-7 pr-3 py-2 rounded-full border text-[12px] outline-none appearance-none cursor-pointer"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: sociedadFiltro ? "var(--foreground)" : "var(--text-3)" }}
          >
            <option value="">Sociedades</option>
            {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        {/* Buscar pill */}
        <div className="relative flex-1 min-w-[120px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex-shrink-0">
            <Search size={14} style={{ color: "var(--text-3)" }} />
          </span>
          <input
            type="text"
            placeholder="Buscar..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-7 pr-3 py-2 rounded-full border text-[12px] outline-none"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setTabActivo("todas")}
          className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors"
          style={{
            background: tabActivo === "todas" ? "var(--navy)" : "transparent",
            color: tabActivo === "todas" ? "#FFFFFF" : "var(--text-2)",
            border: tabActivo === "todas" ? "none" : "1px solid var(--border)",
          }}
        >
          Todas {ordenadas.length}
        </button>
        <button
          onClick={() => setTabActivo("pendientes")}
          className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors"
          style={{
            background: tabActivo === "pendientes" ? "var(--navy)" : "transparent",
            color: tabActivo === "pendientes" ? "#FFFFFF" : "var(--text-2)",
            border: tabActivo === "pendientes" ? "none" : "1px solid var(--border)",
          }}
        >
          Pendientes {pendientesExternas.length}
        </button>
      </div>

      {/* Cards list */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>Cargando...</div>
      ) : vistaActual.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
          <p className="text-3xl mb-3 opacity-40">📋</p>
          <p>No hay reservas en esta vista</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          {(() => {
            let lastGroup = "";
            return vistaActual.map((r) => {
              const group = grupoFecha(r.fecha);
              const showHeader = group !== lastGroup;
              if (showHeader) lastGroup = group;

              const est = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
              const fecha = r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
              const isExtPendiente = esPendienteExterna(r);
              const dispResult = isExtPendiente ? estaDisponible(r) : { ok: true as const };
              const disponible = dispResult.ok;
              const conflictoCon = !dispResult.ok ? dispResult.conflictoCon : null;
              const enProceso = accionando.has(r.id);

              return (
                <div key={r.id}>
                  {showHeader && (
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2 mt-4 first:mt-0"
                      style={{ color: "var(--text-3)" }}>
                      {group}
                    </p>
                  )}

                  {isExtPendiente ? (
                    /* External pending card */
                    <div
                      className="rounded-xl border mb-3 overflow-hidden"
                      style={{
                        borderColor: "var(--border)",
                        borderLeft: disponible ? "4px solid var(--green)" : "4px solid var(--red)",
                        background: "var(--surface)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      {/* Card header row */}
                      <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                        {/* Icon circle */}
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: disponible ? "var(--green-bg)" : "var(--red-bg)" }}>
                          <Anchor size={16} style={{ color: disponible ? "var(--green-text)" : "var(--red-text)" }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Asset name + badges top-right */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[14px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                              {r.activos?.modelo && r.activos?.matricula
                                ? `${r.activos.modelo} (${r.activos.matricula})`
                                : (r.activo_nombre ?? r.activo_id)}
                            </p>
                            {/* Badges: estado + licencia */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                                style={{ background: est.bg, color: est.color }}>
                                {est.label}
                              </span>
                              {r.activos?.licencia === false && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                                  style={{ borderColor: "var(--border)", color: "var(--text-2)", background: "var(--gray-bg)" }}>
                                  Sin licencia
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Client name */}
                          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>{r.cliente}</p>

                          {/* Date + time + channel row */}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{fecha}</span>
                            <span className="text-[11px] font-medium" style={{ color: "var(--foreground)" }}>{r.hora}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: "var(--muted)", color: "var(--text-2)" }}>
                              {r.fuente}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Conflict/availability sub-banner */}
                      <div className="px-4 py-2 flex items-center justify-between gap-3 border-t"
                        style={{ borderColor: "rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.04)" }}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${disponible ? "animate-pulse" : ""}`}
                            style={{ background: disponible ? "var(--green)" : "var(--red)" }} />
                          <span className="text-[11px] font-medium"
                            style={{ color: disponible ? "var(--green-text)" : "var(--red-text)" }}>
                            {disponible ? "Disponible" : "No disponible"}
                          </span>
                          {!disponible && conflictoCon && (
                            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>
                              · Bloqueada por <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{conflictoCon.cliente}</span>
                              {conflictoCon.fuente ? ` (${conflictoCon.fuente})` : ""} · {conflictoCon.hora}
                            </span>
                          )}
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleConfirmarExterna(r.id)}
                            disabled={!disponible || enProceso}
                            className="px-3 py-1 rounded-lg text-[11px] font-semibold border transition-opacity"
                            style={{
                              borderColor: disponible ? "var(--green-text)" : "var(--border)",
                              color: disponible ? "var(--green-text)" : "var(--text-3)",
                              background: "transparent",
                              opacity: enProceso ? 0.5 : 1,
                              cursor: disponible && !enProceso ? "pointer" : "not-allowed",
                            }}>
                            {enProceso ? "…" : "✓ Confirmar"}
                          </button>
                          <button
                            onClick={() => handleRechazarExterna(r.id)}
                            disabled={enProceso}
                            className="px-3 py-1 rounded-lg text-[11px] font-semibold border transition-opacity"
                            style={{
                              borderColor: "var(--red-text)",
                              color: "var(--red-text)",
                              background: "transparent",
                              opacity: enProceso ? 0.5 : 1,
                            }}>
                            {enProceso ? "…" : "✗ Rechazar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Compact card for confirmed/upcoming */
                    <div
                      className="rounded-xl border mb-2 px-4 py-3 flex items-center gap-3"
                      style={{
                        borderColor: "var(--border)",
                        borderLeft: "4px solid var(--blue)",
                        background: "var(--surface)",
                        boxShadow: "var(--shadow-card)",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                            {r.cliente}
                          </p>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: est.bg, color: est.color }}>
                            {est.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{fecha} · {r.hora}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{ background: "var(--muted)", color: "var(--text-2)" }}>{r.fuente}</span>
                          {r.activos?.licencia === false && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                              style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>Sin licencia</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}

      {menuAbierto !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
      )}

      {/* Modal: eliminar / cancelar manual */}
      <ConfirmModal
        open={confirmar !== null}
        titulo={confirmar?.accion === "cancelar" ? "Cancelar reserva" : "Eliminar reserva"}
        mensaje={
          confirmar?.accion === "cancelar"
            ? `¿Cancelar la reserva de ${confirmar?.cliente}? El estado cambiará a "Cancelada".`
            : `¿Eliminar la reserva de ${confirmar?.cliente}? Esta acción no se puede deshacer.`
        }
        labelConfirmar={confirmar?.accion === "cancelar" ? "Cancelar reserva" : "Eliminar"}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={async () => {
          if (!confirmar) return;
          setConfirmar(null);
          let err = "";
          try {
            if (confirmar.accion === "cancelar") {
              await cambiarEstadoReserva(confirmar.id, "cancelada");
            } else {
              await eliminarReserva(confirmar.id);
            }
          } catch (e: any) {
            err = e.message ?? "Error al procesar la acción.";
          }
          await cargar();
          if (err) setErrorCarga(err);
        }}
      />

      <NuevaReservaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialValues={modalInitial}
        onGuardar={async (booking) => {
          await crearReserva({
            activo_id: booking.activo_id,
            activo_nombre: booking.activo_nombre,
            tipo: booking.tipo,
            cliente: booking.cliente,
            fecha: booking.fecha,
            hora: booking.hora,
            duracion: booking.duracion,
            horas_consumidas: booking.horas_consumidas,
            fuente: booking.fuente,
            notas: booking.notas,
          });
          cargar();
        }}
      />
    </AppShell>
  );
}
