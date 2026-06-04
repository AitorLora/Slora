"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NuevaReservaModal, type ModalInitialValues } from "@/components/reservas/NuevaReservaModal";
import { createClient } from "@/lib/supabase/client";
import { cambiarEstadoReserva, eliminarReserva, crearReserva, confirmarReservaExterna, rechazarReservaExterna } from "./actions";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { BarcoCategoria } from "@/lib/mock-data";
import { Clock, CalendarDays, Search, Anchor } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cacheGet, cacheSet, queueAdd, queueGetAll, queueRemove } from "@/lib/offline-db";
import { estadoEfectivo } from "@/lib/estado-reserva";

const ESTADO_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber-text)", bg: "var(--amber-bg)" },
  confirmada: { label: "Confirmada", color: "#0C447C",           bg: "var(--blue-light)" },
  en_curso:   { label: "En curso",   color: "#0369A1",           bg: "#E0F2FE" },
  completada: { label: "Completada", color: "var(--green-text)", bg: "var(--green-bg)" },
  cancelada:  { label: "Cancelada",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
  rechazada:  { label: "Rechazada",  color: "#9B1C1C",           bg: "#FEF2F2" },
  conflicto:  { label: "Conflicto",  color: "var(--red-text)",   bg: "var(--red-bg)" },
};

const ESTADOS = ["confirmada", "en_curso", "completada", "cancelada"];

export default function ReservasPage() {
  const [reservas, setReservas]         = useState<any[]>([]);
  const [sociedades, setSociedades]     = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading]           = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [modalInitial, setModalInitial] = useState<ModalInitialValues | undefined>();
  const [busqueda, setBusqueda]         = useState("");
  const [estadoFiltro, setEstadoFiltro]     = useState("");
  const [sociedadFiltro, setSociedadFiltro] = useState("");
  const [menuAbierto, setMenuAbierto]   = useState<{ id: number; top: number; left: number } | null>(null);
  const [confirmar, setConfirmar]       = useState<{ id: number; cliente: string; accion?: "cancelar" } | null>(null);
  const [errorCarga, setErrorCarga]     = useState("");
  const [accionando, setAccionando]     = useState<Set<number>>(new Set());
  const [tabActivo, setTabActivo]       = useState<"todas" | "pendientes">("todas");
  const [syncPendiente, setSyncPendiente] = useState(0);
  const [, setTick] = useState(0);
  const online = useOnlineStatus();

  // Refresca el estado derivado (Confirmada → En curso → Completada) cada minuto
  // sin necesidad de recargar ni esperar al cron.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  async function cargar(isOnline = true) {
    try {
      if (isOnline) {
        const supabase = createClient();
        const [{ data: res, error: e1 }, { data: soc, error: e2 }, { data: act }] = await Promise.all([
          supabase.from("reservas").select("*, activos(modelo, matricula, capacidad, licencia)").gte("fecha", `${new Date().getFullYear() - 1}-01-01`).order("created_at", { ascending: false }),
          supabase.from("sociedades").select("id, nombre"),
          supabase.from("activos").select("id, nombre, matricula, tipo, sociedad_id, horas_motor, horas_desde_servicio, estado, capacidad, licencia"),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;
        setReservas(res ?? []);
        setSociedades(soc ?? []);
        // Guardar copia en caché local (incluye flota para uso offline del modal)
        await Promise.all([
          cacheSet("reservas", res ?? []),
          cacheSet("sociedades", soc ?? []),
          cacheSet("activos", act ?? []),
        ]);
      } else {
        // Sin conexión: cargar desde IndexedDB
        const [cachedRes, cachedSoc] = await Promise.all([
          cacheGet<any[]>("reservas"),
          cacheGet<{ id: string; nombre: string }[]>("sociedades"),
        ]);
        setReservas(cachedRes ?? []);
        setSociedades(cachedSoc ?? []);
        // Contar cuántas hay en cola de sync
        const pendientes = await queueGetAll();
        setSyncPendiente(pendientes.length);
      }
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

  useEffect(() => { cargar(online); }, [online]);

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

  // Realtime (solo cuando hay conexión)
  useEffect(() => {
    if (!online) return;
    const supabase = createClient();
    const channel = supabase
      .channel("reservas-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservas" }, () => cargar(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [online]);

  // Sincronización al recuperar conexión
  useEffect(() => {
    if (!online) return;
    (async () => {
      const pendientes = await queueGetAll();
      if (pendientes.length === 0) return;

      let synced = 0;
      for (const item of pendientes) {
        if (item.type === "crear_reserva") {
          try {
            await crearReserva(item.data as any);
            await queueRemove(item.id);
            synced++;
          } catch {
            // Se reintentará la próxima vez que haya conexión
          }
        }
      }
      setSyncPendiente(0);
      if (synced > 0) cargar(true);
    })();
  }, [online]);

  // ── Filtros ────────────────────────────────────────────────────────────

  const filtradas = reservas.filter(r => {
    const q = busqueda.toLowerCase();
    if (q && !r.cliente?.toLowerCase().includes(q) && !r.activo_nombre?.toLowerCase().includes(q) && !r.fuente?.toLowerCase().includes(q)) return false;
    if (estadoFiltro && r.estado !== estadoFiltro) return false;
    if (sociedadFiltro && r.sociedad_id !== sociedadFiltro) return false;
    return true;
  });

  const esPendienteExterna = (r: any) => Boolean(r.id_externo && r.estado === "pendiente");
  const claveFechaHora = (r: any) => `${String(r.fecha ?? "").slice(0, 10)}T${r.hora ?? "00:00"}`;

  const ordenadas = [...filtradas].sort((a, b) => {
    const pa = esPendienteExterna(a), pb = esPendienteExterna(b);
    if (pa !== pb) return pa ? -1 : 1;

    if (pa) {
      const ka = claveFechaHora(a), kb = claveFechaHora(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }
    const fa = String(a.fecha ?? "").slice(0, 10), fb = String(b.fecha ?? "").slice(0, 10);
    if (fa !== fb) return fa < fb ? 1 : -1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });

  const conflictos = reservas.filter(r => r.estado === "conflicto").length;

  // Mobile: agrupación por fecha y tabs
  const hoyStr  = new Date().toISOString().slice(0, 10);
  const manaStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  function grupoFecha(fecha: string) {
    const f = String(fecha ?? "").slice(0, 10);
    if (f === hoyStr) return "Hoy";
    if (f === manaStr) return "Mañana";
    return f > hoyStr ? "Próximas reservas" : "Pasadas";
  }

  // Móvil: Hoy → Mañana → Próximas → Pasadas (dentro de cada grupo, por hora asc)
  const ordenadasMobile = [...filtradas].sort((a, b) => {
    const pa = esPendienteExterna(a), pb = esPendienteExterna(b);
    if (pa !== pb) return pa ? -1 : 1;
    if (pa) {
      const ka = claveFechaHora(a), kb = claveFechaHora(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    }
    const fa = String(a.fecha ?? "").slice(0, 10);
    const fb = String(b.fecha ?? "").slice(0, 10);
    const aFutura = fa >= hoyStr, bFutura = fb >= hoyStr;
    if (aFutura !== bFutura) return aFutura ? -1 : 1;
    if (fa !== fb) return aFutura ? (fa < fb ? -1 : 1) : (fa < fb ? 1 : -1);
    return (a.hora ?? "").localeCompare(b.hora ?? "");
  });

  const pendientesExternas = ordenadasMobile.filter(esPendienteExterna);
  const vistaActual = tabActivo === "pendientes" ? pendientesExternas : ordenadasMobile;

  const actions = (
    <div className="flex items-center gap-2">
      {syncPendiente > 0 && (
        <span className="text-[11px] font-medium px-2.5 py-1 rounded-full"
          style={{ background: "#FEF3C7", color: "#92400E" }}>
          {syncPendiente} pendiente{syncPendiente > 1 ? "s" : ""} de sync
        </span>
      )}
      <button
        onClick={() => { setModalInitial(undefined); setModalOpen(true); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
        style={{ background: "var(--navy)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--navy-light)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--navy)")}
      >
        + Nueva reserva
      </button>
    </div>
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

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP: tabla original
          ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
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

        {/* Tabla */}
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

              <div style={{ background: "var(--surface)", minWidth: "680px" }}>
                {ordenadas.map((r, i) => {
                  const estadoView     = estadoEfectivo(r);
                  const est            = ESTADO_STYLE[estadoView] ?? ESTADO_STYLE.pendiente;
                  const fecha          = r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
                  const esExtPendiente = Boolean(r.id_externo && r.estado === "pendiente");
                  const dispResult     = esExtPendiente ? estaDisponible(r) : { ok: true as const };
                  const disponible     = dispResult.ok;
                  const conflictoCon   = !dispResult.ok ? dispResult.conflictoCon : null;
                  const enProceso      = accionando.has(r.id);
                  const borderLeft     = r.estado === "conflicto"
                    ? "3px solid var(--red-text)"
                    : esExtPendiente
                    ? "3px solid #F59E0B"
                    : "3px solid transparent";

                  return (
                    <div key={r.id} className="relative"
                      style={{ borderBottom: i < ordenadas.length - 1 ? "1px solid var(--border)" : "none" }}>

                      {esExtPendiente && (
                        <div className="absolute inset-0 animate-pulse pointer-events-none"
                          style={{ background: "rgba(245,158,11,0.07)" }} />
                      )}

                      <div
                        className="relative grid px-4 py-2 items-center transition-colors"
                        style={{ gridTemplateColumns: "64px 1.5fr 1.2fr 1fr 1fr 0.9fr 1.1fr 28px", gap: "8px", borderLeft }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--muted)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>

                        <span className="font-mono text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                          {esExtPendiente && r.ingreso_neto === 0
                            ? <span style={{ color: "var(--text-3)" }}>—</span>
                            : `€${Number(r.ingreso_neto).toLocaleString("es-ES")}`}
                        </span>

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

                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                          {r.cliente}
                        </span>

                        <span className="text-[12px]" style={{ color: "var(--text-3)" }}>{fecha}</span>

                        <div>
                          <p className="text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{r.duracion}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{r.hora}</p>
                        </div>

                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded truncate inline-block font-semibold"
                          style={{ background: "var(--muted)", color: "var(--text-2)" }}>
                          {r.fuente}
                        </span>

                        <div className="relative">
                          {esExtPendiente ? (
                            <span className="flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full"
                              style={{ color: est.color, background: est.bg }}>
                              {est.label}
                            </span>
                          ) : (
                            <button
                              onClick={(ev) => {
                                if (menuAbierto?.id === r.id) { setMenuAbierto(null); return; }
                                const rect = ev.currentTarget.getBoundingClientRect();
                                setMenuAbierto({ id: r.id, top: rect.bottom + 4, left: rect.right });
                              }}
                              className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full w-full justify-between"
                              style={{ color: est.color, background: est.bg }}>
                              <span>{est.label}</span>
                              <span>▾</span>
                            </button>
                          )}
                          {menuAbierto && menuAbierto.id === r.id && (
                            <div className="fixed rounded-lg border overflow-hidden z-50 min-w-[130px]"
                              style={{ top: menuAbierto.top, left: menuAbierto.left, transform: "translateX(-100%)", background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                              {ESTADOS.map(e => {
                                const activo = e === estadoView;
                                return (
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
                                    style={{ color: "var(--foreground)", background: activo ? "var(--muted)" : "transparent", fontWeight: activo ? 600 : 400 }}>
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESTADO_STYLE[e]?.color }} />
                                    {ESTADO_STYLE[e]?.label}
                                    {activo && <span className="ml-auto text-[10px]" style={{ color: "var(--text-3)" }}>actual</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <button onClick={() => setConfirmar({ id: r.id, cliente: r.cliente })}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[13px] hover:bg-[var(--red-bg)] transition-colors"
                          style={{ color: "var(--text-3)" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "var(--red-text)")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                          ×
                        </button>
                      </div>

                      {esExtPendiente && (
                        <div className="relative px-4 py-1.5 flex items-center justify-between gap-4"
                          style={{ borderTop: "1px dashed rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.04)", borderLeft }}>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0${disponible ? " animate-pulse" : ""}`}
                                style={{ background: disponible ? "#16A34A" : "#DC2626" }} />
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
                          </div>

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
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE: cards con tabs y agrupación por fecha
          ══════════════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden">
        {/* Filter pills */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto no-scrollbar">
          <div className="relative flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Clock size={14} style={{ color: "var(--text-3)" }} />
            </span>
            <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)}
              className="pl-7 pr-3 py-2 rounded-full border text-[12px] outline-none appearance-none cursor-pointer"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: estadoFiltro ? "var(--foreground)" : "var(--text-3)" }}>
              <option value="">Estados</option>
              {Object.entries(ESTADO_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="relative flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <CalendarDays size={14} style={{ color: "var(--text-3)" }} />
            </span>
            <select value={sociedadFiltro} onChange={e => setSociedadFiltro(e.target.value)}
              className="pl-7 pr-3 py-2 rounded-full border text-[12px] outline-none appearance-none cursor-pointer"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: sociedadFiltro ? "var(--foreground)" : "var(--text-3)" }}>
              <option value="">Sociedades</option>
              {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div className="relative flex-1 min-w-[120px]">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Search size={14} style={{ color: "var(--text-3)" }} />
            </span>
            <input type="text" placeholder="Buscar..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-full border text-[12px] outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setTabActivo("todas")}
            className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors"
            style={{
              background: tabActivo === "todas" ? "var(--navy)" : "transparent",
              color: tabActivo === "todas" ? "#FFFFFF" : "var(--text-2)",
              border: tabActivo === "todas" ? "none" : "1px solid var(--border)",
            }}>
            Todas {ordenadas.length}
          </button>
          <button onClick={() => setTabActivo("pendientes")}
            className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors"
            style={{
              background: tabActivo === "pendientes" ? "var(--navy)" : "transparent",
              color: tabActivo === "pendientes" ? "#FFFFFF" : "var(--text-2)",
              border: tabActivo === "pendientes" ? "none" : "1px solid var(--border)",
            }}>
            Pendientes {pendientesExternas.length}
          </button>
        </div>

        {/* Lista de cards */}
        {loading ? (
          <div className="text-center py-16" style={{ color: "var(--text-3)" }}>Cargando...</div>
        ) : vistaActual.length === 0 ? (
          <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
            <p className="text-3xl mb-3 opacity-40">📋</p>
            <p>No hay reservas en esta vista</p>
          </div>
        ) : (
          <div>
            {(() => {
              let lastGroup = "";
              return vistaActual.map((r) => {
                const group      = grupoFecha(r.fecha);
                const showHeader = group !== lastGroup;
                if (showHeader) lastGroup = group;

                const estadoView     = estadoEfectivo(r);
                const est            = ESTADO_STYLE[estadoView] ?? ESTADO_STYLE.pendiente;
                const fecha          = r.fecha ? new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
                const isExtPendiente = esPendienteExterna(r);
                const dispResult     = isExtPendiente ? estaDisponible(r) : { ok: true as const };
                const disponible     = dispResult.ok;
                const conflictoCon   = !dispResult.ok ? dispResult.conflictoCon : null;
                const enProceso      = accionando.has(r.id);

                return (
                  <div key={r.id}>
                    {showHeader && (
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] mb-2 mt-4 first:mt-0"
                        style={{ color: "var(--text-3)" }}>
                        {group}
                      </p>
                    )}

                    {isExtPendiente ? (
                      <div className="rounded-xl border mb-3 overflow-hidden"
                        style={{
                          borderColor: "var(--border)",
                          borderLeft: disponible ? "4px solid var(--green)" : "4px solid var(--red)",
                          background: "var(--surface)",
                          boxShadow: "var(--shadow-card)",
                        }}>
                        <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: disponible ? "var(--green-bg)" : "var(--red-bg)" }}>
                            <Anchor size={16} style={{ color: disponible ? "var(--green-text)" : "var(--red-text)" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[14px] font-semibold truncate" style={{ color: "var(--foreground)" }}>
                                {r.activos?.modelo && r.activos?.matricula
                                  ? `${r.activos.modelo} (${r.activos.matricula})`
                                  : (r.activo_nombre ?? r.activo_id)}
                              </p>
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
                            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-2)" }}>{r.cliente}</p>
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
                      <div className="rounded-xl border mb-2 px-4 py-3 flex items-center gap-3"
                        style={{
                          borderColor: "var(--border)",
                          borderLeft: "4px solid var(--blue)",
                          background: "var(--surface)",
                          boxShadow: "var(--shadow-card)",
                        }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                            {r.cliente}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{fecha} · {r.hora}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: "var(--muted)", color: "var(--text-2)" }}>{r.fuente}</span>
                            {r.activos?.licencia === false && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>Sin licencia</span>
                            )}
                          </div>
                        </div>

                        {/* Estado tocable → menú de cambio de estado / cancelar */}
                        <div className="relative flex-shrink-0">
                          <button
                            onClick={(ev) => {
                              if (menuAbierto?.id === r.id) { setMenuAbierto(null); return; }
                              const rect = ev.currentTarget.getBoundingClientRect();
                              setMenuAbierto({ id: r.id, top: rect.bottom + 4, left: rect.right });
                            }}
                            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full"
                            style={{ background: est.bg, color: est.color }}>
                            <span>{est.label}</span>
                            <span>▾</span>
                          </button>
                          {menuAbierto && menuAbierto.id === r.id && (
                            <div className="fixed rounded-lg border overflow-hidden z-50 min-w-[150px]"
                              style={{ top: menuAbierto.top, left: menuAbierto.left, transform: "translateX(-100%)", background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                              {ESTADOS.map(e => {
                                const activo = e === estadoView;
                                return (
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
                                    className="w-full text-left px-3 py-2.5 text-[13px] flex items-center gap-2 active:bg-[var(--muted)]"
                                    style={{ color: "var(--foreground)", background: activo ? "var(--muted)" : "transparent", fontWeight: activo ? 600 : 400 }}>
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESTADO_STYLE[e]?.color }} />
                                    {ESTADO_STYLE[e]?.label}
                                    {activo && <span className="ml-auto text-[10px]" style={{ color: "var(--text-3)" }}>actual</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Eliminar */}
                        <button onClick={() => setConfirmar({ id: r.id, cliente: r.cliente })}
                          aria-label="Eliminar reserva"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-[16px] flex-shrink-0 active:bg-[var(--red-bg)]"
                          style={{ color: "var(--text-3)" }}>
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {menuAbierto !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
      )}

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
          const payload = {
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
          };

          if (!online) {
            // Sin conexión: encolar para sync posterior
            await queueAdd("crear_reserva", payload as Record<string, unknown>);
            // Añadir optimistamente al estado local con id temporal
            const optimista = {
              ...payload,
              id: `offline-${Date.now()}`,
              estado: "pendiente",
              ingreso_neto: 0,
              _offline: true,
              created_at: new Date().toISOString(),
              activos: null,
            };
            setReservas(prev => [optimista, ...prev]);
            setSyncPendiente(p => p + 1);
            return;
          }

          await crearReserva(payload);
          cargar(true);
        }}
      />
    </AppShell>
  );
}
