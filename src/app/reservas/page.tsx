"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NuevaReservaModal, type ModalInitialValues } from "@/components/reservas/NuevaReservaModal";
import { createClient } from "@/lib/supabase/client";
import { cambiarEstadoReserva, eliminarReserva, crearReserva, confirmarReservaExterna, rechazarReservaExterna } from "./actions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { BarcoCategoria } from "@/lib/mock-data";

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

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "var(--text-3)" }}>⌕</span>
          <input type="text" placeholder="Buscar cliente, activo, canal..."
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
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div className="overflow-x-auto">
            {/* Cabecera */}
            <div className="grid px-3 py-1.5 text-[10px] uppercase tracking-[0.06em] font-medium"
              style={{ gridTemplateColumns: "64px 1.5fr 1.2fr 1fr 1fr 0.9fr 1.1fr 28px", gap: "6px", minWidth: "680px", color: "var(--text-3)", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <span>Ingreso</span>
              <span>Activo</span>
              <span>Cliente</span>
              <span>Fecha</span>
              <span>Duración</span>
              <span>Canal</span>
              <span>Estado</span>
              <span />
            </div>

            {/* Filas */}
            <div style={{ background: "var(--surface)", minWidth: "680px" }}>
              {ordenadas.map((r, i) => {
                const est              = ESTADO_STYLE[r.estado] ?? ESTADO_STYLE.pendiente;
                const fecha            = r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
                const esExtPendiente   = Boolean(r.id_externo && r.estado === "pendiente");
                const dispResult       = esExtPendiente ? estaDisponible(r) : { ok: true as const };
                const disponible       = dispResult.ok;
                const conflictoCon     = !dispResult.ok ? dispResult.conflictoCon : null;
                const enProceso        = accionando.has(r.id);
                const borderLeft       = r.estado === "conflicto"
                  ? "3px solid var(--red-text)"
                  : esExtPendiente
                  ? "3px solid #F59E0B"
                  : "3px solid transparent";

                return (
                  <div
                    key={r.id}
                    className="relative"
                    style={{ borderBottom: i < ordenadas.length - 1 ? "1px solid var(--border)" : "none" }}>

                    {/* Fondo pulsante (solo reservas externas pendientes) */}
                    {esExtPendiente && (
                      <div
                        className="absolute inset-0 animate-pulse pointer-events-none"
                        style={{ background: "rgba(245,158,11,0.07)" }}
                      />
                    )}

                    {/* Fila principal */}
                    <div
                      className="relative grid px-4 py-2 items-center transition-colors"
                      style={{
                        gridTemplateColumns: "64px 1.5fr 1.2fr 1fr 1fr 0.9fr 1.1fr 28px",
                        gap: "8px",
                        borderLeft,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>

                      {/* Ingreso */}
                      <span className="font-mono text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                        {esExtPendiente && r.ingreso_neto === 0
                          ? <span style={{ color: "var(--text-3)" }}>—</span>
                          : `€${Number(r.ingreso_neto).toLocaleString("es-ES")}`}
                      </span>

                      {/* Activo */}
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="font-mono text-[11px] text-white px-1.5 py-0.5 rounded inline-block truncate max-w-full leading-snug" style={{ background: "var(--navy)" }}>
                          {r.activos?.modelo && r.activos?.matricula
                            ? `${r.activos.modelo} (${r.activos.matricula})`
                            : (r.activo_nombre ?? r.activo_id)}
                        </span>
                        {(r.activos?.capacidad != null || r.activos?.licencia != null) && (
                          <div className="flex items-center gap-1 flex-wrap">
                            {r.activos?.capacidad != null && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm leading-none" style={{ background: "var(--surface-2, #F1F5F9)", color: "var(--text-2)" }}>
                                {r.activos.capacidad} P
                              </span>
                            )}
                            {r.activos?.licencia != null && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm leading-none" style={{ background: "var(--surface-2, #F1F5F9)", color: "var(--text-2)" }}>
                                {r.activos.licencia ? "Requiere Licencia" : "Sin Licencia"}
                              </span>
                            )}
                          </div>
                        )}
                        {r.notas && <p className="text-[10px] italic truncate" style={{ color: "var(--text-3)" }}>{r.notas}</p>}
                      </div>

                      {/* Cliente */}
                      <span className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {r.cliente}
                      </span>

                      {/* Fecha */}
                      <span className="text-[12px]" style={{ color: "var(--text-3)" }}>{fecha}</span>

                      {/* Duración + hora */}
                      <div>
                        <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{r.duracion}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{r.hora}</p>
                      </div>

                      {/* Canal */}
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded truncate inline-block font-semibold"
                        style={{ background: "var(--muted)", color: "var(--text-2)" }}>
                        {r.fuente}
                      </span>

                      {/* Estado */}
                      <div className="relative">
                        {r.estado === "cancelada" || esExtPendiente ? (
                          <span
                            className="flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full"
                            style={{ color: est.color, background: est.bg }}>
                            {est.label}
                          </span>
                        ) : (
                        <button
                          onClick={() => setMenuAbierto(menuAbierto === r.id ? null : r.id)}
                          className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full w-full justify-between"
                          style={{ color: est.color, background: est.bg }}>
                          <span>{est.label}</span>
                          <span>▾</span>
                        </button>)}
                        {menuAbierto === r.id && (
                          <div className="absolute right-0 top-[calc(100%+4px)] rounded-lg border overflow-hidden z-20 min-w-[130px]"
                            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                            {ESTADOS.map(e => (
                              <button key={e} onClick={async () => {
                                setMenuAbierto(null);
                                if (e === "cancelada") {
                                  setConfirmar({ id: r.id, cliente: r.cliente, accion: "cancelar" });
                                  return;
                                }
                                try {
                                  await cambiarEstadoReserva(r.id, e);
                                  cargar();
                                } catch {
                                  setErrorCarga("Error al cambiar el estado.");
                                }
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
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[13px] hover:bg-[var(--red-bg)] transition-colors"
                        style={{ color: "var(--text-3)" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "var(--red-text)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                        ×
                      </button>
                    </div>

                    {/* Sub-banner de validación (solo reservas externas pendientes) */}
                    {esExtPendiente && (
                      <div
                        className="relative px-4 py-1.5 flex items-center justify-between gap-4"
                        style={{
                          borderTop:  "1px dashed rgba(245,158,11,0.35)",
                          background: "rgba(245,158,11,0.04)",
                          borderLeft,
                        }}>

                        {/* Indicador de disponibilidad */}
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-block w-2 h-2 rounded-full flex-shrink-0${disponible ? " animate-pulse" : ""}`}
                              style={{ background: disponible ? "#16A34A" : "#DC2626" }}
                            />
                            <span className="text-[11px] font-medium" style={{ color: disponible ? "#15803D" : "#B91C1C" }}>
                              {disponible ? "Disponible" : "No disponible"}
                            </span>
                          </div>
                          {!disponible && conflictoCon && (
                            <p className="text-[10px] pl-4 truncate" style={{ color: "var(--text-3)" }}>
                              Bloqueada por <span className="font-medium" style={{ color: "var(--foreground)" }}>{conflictoCon.cliente}</span>
                              {conflictoCon.fuente ? ` (${conflictoCon.fuente})` : ""} · {conflictoCon.hora}
                              {conflictoCon.estado !== "pendiente" && (
                                <span className="ml-1" style={{ color: "#B91C1C" }}>— ya confirmada</span>
                              )}
                            </p>
                          )}
                          {process.env.NODE_ENV === "development" && (
                            <span className="text-[9px] opacity-40 pl-4" style={{ color: "var(--text-3)" }}>
                              f:{String(r.fecha).slice(0,10)} h:{r.hora} hc:{r.horas_consumidas} id_ext:{r.id_externo ? "✓" : "✗"}
                            </span>
                          )}
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleConfirmarExterna(r.id)}
                            disabled={!disponible || enProceso}
                            className="px-3 py-1 rounded text-[11px] font-semibold text-white transition-opacity"
                            style={{
                              background: disponible ? "#16A34A" : "#9CA3AF",
                              cursor:     disponible && !enProceso ? "pointer" : "not-allowed",
                              opacity:    enProceso ? 0.5 : 1,
                            }}>
                            {enProceso ? "…" : "✓ Confirmar"}
                          </button>
                          <button
                            onClick={() => handleRechazarExterna(r.id)}
                            disabled={enProceso}
                            className="px-3 py-1 rounded text-[11px] font-semibold text-white transition-opacity"
                            style={{
                              background: "#DC2626",
                              cursor:     !enProceso ? "pointer" : "not-allowed",
                              opacity:    enProceso ? 0.5 : 1,
                            }}>
                            {enProceso ? "…" : "✕ Rechazar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
