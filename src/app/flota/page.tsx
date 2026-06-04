"use client";

import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NuevoActivoModal } from "@/components/flota/NuevoActivoModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { createClient } from "@/lib/supabase/client";
import { marcarRevision, crearActivo, eliminarActivo } from "./actions";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cacheGet } from "@/lib/offline-db";

type AssetStatus = "ACTIVO" | "ALERTA" | "MANTENIMIENTO";
type AssetType = "moto" | "barco";

const ESTADO_BADGE: Record<AssetStatus, { label: string; color: string; bg: string }> = {
  ACTIVO:        { label: "Disponible",     color: "var(--green-text)", bg: "var(--green-bg)" },
  ALERTA:        { label: "Alerta 50-100h", color: "var(--amber-text)", bg: "var(--amber-bg)" },
  MANTENIMIENTO: { label: "Mantenimiento",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
};

const ESTADO_DOT: Record<AssetStatus, string> = {
  ACTIVO: "var(--green)", ALERTA: "var(--amber)", MANTENIMIENTO: "var(--text-3)",
};

export default function FlotaPage() {
  const [activos, setActivos]     = useState<any[]>([]);
  const [sociedades, setSociedades] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [modalOpen, setModalOpen]       = useState(false);
  const [confirmar, setConfirmar]             = useState<{ id: string; matricula: string; error?: string } | null>(null);
  const [confirmarRevision, setConfirmarRevision] = useState<{ id: string; matricula: string } | null>(null);
  const [errorCarga, setErrorCarga]     = useState("");
  const [tipoFiltro, setTipoFiltro]     = useState<AssetType | "">("");
  const [estadoFiltro, setEstadoFiltro] = useState<AssetStatus | "">("");
  const online = useOnlineStatus();

  async function cargar() {
    setErrorCarga("");
    if (!online) {
      const [cachedActivos, cachedSociedades] = await Promise.all([
        cacheGet<any[]>("activos"),
        cacheGet<any[]>("sociedades"),
      ]);
      setActivos(cachedActivos ?? []);
      setSociedades((cachedSociedades ?? []) as { id: string; nombre: string }[]);
      setLoading(false);
      return;
    }
    try {
      const supabase = createClient();
      const [{ data: a, error: e1 }, { data: s, error: e2 }] = await Promise.all([
        supabase.from("activos").select("*").order("sociedad_id").limit(200),
        supabase.from("sociedades").select("id, nombre"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setActivos(a ?? []);
      setSociedades(s ?? []);
    } catch {
      setErrorCarga("Error al cargar los datos. Recarga la página.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [online]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("activos-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "activos" }, () => cargar())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtrados = activos.filter(a => {
    if (tipoFiltro && a.tipo !== tipoFiltro) return false;
    if (estadoFiltro && a.estado !== estadoFiltro) return false;
    return true;
  });

  const alertas = activos.filter(a => a.estado === "ALERTA" || a.estado === "MANTENIMIENTO");

  const actions = (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white transition-colors"
        style={{ background: "var(--navy)" }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--navy-light)")}
        onMouseLeave={e => (e.currentTarget.style.background = "var(--navy)")}>
        + Nuevo activo
      </button>
    </div>
  );


  return (
    <AppShell title="Flota" subtitle={`${filtrados.length} activos`} actions={actions}>

      {errorCarga && (
        <div className="px-4 py-3 rounded-xl mb-4 border text-[13px]"
          style={{ background: "var(--red-bg)", borderColor: "var(--red-text)", color: "var(--red-text)" }}>
          {errorCarga}
        </div>
      )}

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value as AssetType | "")}
          className="px-3 py-2 rounded-lg border text-[13px] outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
          <option value="">Todos los tipos</option>
          <option value="moto">Motos de agua</option>
          <option value="barco">Barcos</option>
        </select>
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value as AssetStatus | "")}
          className="px-3 py-2 rounded-lg border text-[13px] outline-none cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Disponible</option>
          <option value="ALERTA">Alerta</option>
          <option value="MANTENIMIENTO">Mantenimiento</option>
        </select>
      </div>

      {alertas.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl mb-5 border"
          style={{ background: "var(--amber-bg)", borderColor: "var(--amber)" }}>
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

      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>Cargando...</div>
      ) : (
        <div className="space-y-5">
          {sociedades.map(soc => {
            const activosSoc = filtrados.filter(a => a.sociedad_id === soc.id);
            if (!activosSoc.length) return null;
            return (
              <div key={soc.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between px-4 py-3" style={{ background: "var(--navy)" }}>
                  <span className="text-[13px] font-semibold text-white">{soc.nombre}</span>
                  <span className="text-[11px]" style={{ color: "#7BAFD4" }}>
                    {activosSoc.length} activo{activosSoc.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* ── Móvil: tarjetas (la llave de mantenimiento va junto a la matrícula) ── */}
                <div className="lg:hidden" style={{ background: "var(--surface)" }}>
                  {activosSoc.map((a, i) => {
                    const badge = ESTADO_BADGE[a.estado as AssetStatus] ?? ESTADO_BADGE.ACTIVO;
                    const horaColor = a.horas_desde_servicio >= 100 ? "var(--red)" : a.horas_desde_servicio >= 50 ? "var(--amber)" : "var(--green)";
                    const pct = Math.min((a.horas_desde_servicio / 100) * 100, 100);
                    const necesitaRevision = a.estado === "ALERTA" || a.estado === "MANTENIMIENTO";
                    const critico = a.horas_desde_servicio >= 100;
                    return (
                      <div key={a.id} className="px-4 py-3"
                        style={{ borderBottom: i < activosSoc.length - 1 ? "1px solid var(--border)" : "none" }}>
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ESTADO_DOT[a.estado as AssetStatus] }} />
                          <span className="font-mono text-[13px] font-medium" style={{ color: "var(--navy)" }}>{a.matricula}</span>
                          {(critico || necesitaRevision) && (
                            <button
                              onClick={() => setConfirmarRevision({ id: a.id, matricula: a.matricula })}
                              aria-label="Marcar revisión realizada"
                              title={critico ? `Requiere revisión · ${a.horas_desde_servicio}h` : "Marcar revisión realizada"}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-[12px] flex-shrink-0"
                              style={{ background: critico ? "var(--amber-bg)" : "var(--green-bg)", color: critico ? "var(--amber-text)" : "var(--green-text)" }}>
                              🔧
                            </button>
                          )}
                          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ color: badge.color, background: badge.bg }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
                            {badge.label}
                          </span>
                          <button
                            onClick={() => setConfirmar({ id: a.id, matricula: a.matricula })}
                            aria-label="Eliminar activo"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[16px] flex-shrink-0 active:bg-[var(--red-bg)]"
                            style={{ color: "var(--text-3)" }}>
                            ×
                          </button>
                        </div>
                        <p className="text-[13px] mt-1.5" style={{ color: "var(--foreground)" }}>{a.nombre}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
                          {a.tipo === "moto" ? "Moto de agua" : "Barco"}
                          {a.modelo ? ` · ${a.modelo}` : ""}
                          {a.capacidad ? ` · ${a.capacidad} pax` : ""}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-3)" }}>{a.horas_motor}h motor</span>
                          <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "var(--border)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: horaColor }} />
                          </div>
                          <span className="font-mono text-[11px] font-medium flex-shrink-0" style={{ color: horaColor }}>
                            {a.horas_desde_servicio}h / 100h
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="hidden lg:block overflow-x-auto">
                  <div className="grid px-4 py-2 text-[10px] uppercase tracking-[0.06em] font-medium"
                    style={{ gridTemplateColumns: "14px 110px 110px 90px 120px 50px 90px 140px 120px 36px 32px", gap: "12px", minWidth: "1020px", color: "var(--text-3)", background: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
                    <span /><span>Matrícula</span><span>Nombre</span><span>Tipo</span><span>Modelo</span>
                    <span>Cap.</span><span>H. Motor</span><span>Desde servicio</span><span>Estado</span><span /><span />
                  </div>

                  <div style={{ background: "var(--surface)", minWidth: "1020px" }}>
                    {activosSoc.map((a, i) => {
                      const badge = ESTADO_BADGE[a.estado as AssetStatus] ?? ESTADO_BADGE.ACTIVO;
                      const horaColor = a.horas_desde_servicio >= 100 ? "var(--red)" : a.horas_desde_servicio >= 50 ? "var(--amber)" : "var(--green)";
                      const pct = Math.min((a.horas_desde_servicio / 100) * 100, 100);
                      const necesitaRevision = a.estado === "ALERTA" || a.estado === "MANTENIMIENTO";
                      return (
                        <div key={a.id}
                          className="grid px-4 py-3 items-center hover:bg-[var(--muted)] transition-colors"
                          style={{ gridTemplateColumns: "14px 110px 110px 90px 120px 50px 90px 140px 120px 36px 32px", gap: "12px", minWidth: "1020px", borderBottom: i < activosSoc.length - 1 ? "1px solid var(--border)" : "none" }}>
                          <span className="w-2 h-2 rounded-full block" style={{ background: ESTADO_DOT[a.estado as AssetStatus] }} />
                          <span className="font-mono text-[12px] font-medium" style={{ color: "var(--navy)" }}>{a.matricula}</span>
                          <span className="text-[12px] truncate" style={{ color: "var(--foreground)" }}>{a.nombre}</span>
                          <span className="text-[12px]" style={{ color: "var(--text-3)" }}>{a.tipo === "moto" ? "Moto de agua" : "Barco"}</span>
                          <span className="text-[12px]" style={{ color: "var(--text-2)" }}>{a.modelo}</span>
                          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{a.capacidad ? `${a.capacidad} pax` : "—"}</span>
                          <span className="font-mono text-[12px] font-medium" style={{ color: "var(--foreground)" }}>{a.horas_motor}h</span>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 rounded-full overflow-hidden flex-1" style={{ background: "var(--border)", maxWidth: "52px" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: horaColor }} />
                            </div>
                            <span className="font-mono text-[12px] font-medium" style={{ color: horaColor }}>{a.horas_desde_servicio}h</span>
                            <span className="text-[10px]" style={{ color: "var(--text-3)" }}>/ 100h</span>
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                            style={{ color: badge.color, background: badge.bg }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.color }} />
                            {badge.label}
                          </span>
                          {a.horas_desde_servicio >= 100 ? (
                            <div className="relative group flex items-center justify-center w-7 h-7">
                              <button
                                onClick={() => setConfirmarRevision({ id: a.id, matricula: a.matricula })}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] hover:scale-110 transition-all cursor-pointer"
                                style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
                                🔧
                              </button>
                              <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                                style={{ background: "var(--navy)", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
                                Requiere revisión · {a.horas_desde_servicio}h desde el último servicio
                                <span className="absolute bottom-[-4px] right-3 w-2 h-2 rotate-45 block" style={{ background: "var(--navy)" }} />
                              </div>
                            </div>
                          ) : necesitaRevision ? (
                            <button onClick={() => setConfirmarRevision({ id: a.id, matricula: a.matricula })}
                              title="Marcar revisión realizada"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[14px] hover:scale-110 transition-transform"
                              style={{ background: "var(--green-bg)", color: "var(--green-text)" }}>
                              🔧
                            </button>
                          ) : <span className="w-7 h-7" />}
                          <button
                            onClick={() => setConfirmar({ id: a.id, matricula: a.matricula })}
                            title="Eliminar activo"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] hover:bg-[var(--red-bg)] transition-colors"
                            style={{ color: "var(--text-3)" }}
                            onMouseEnter={e => (e.currentTarget.style.color = "var(--red-text)")}
                            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}>
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmar !== null}
        icono="🗑️"
        titulo="Eliminar activo"
        mensaje={confirmar?.error ?? `¿Eliminar ${confirmar?.matricula}? Esta acción no se puede deshacer.`}
        labelConfirmar={confirmar?.error ? "Cerrar" : "Eliminar"}
        onCancelar={() => setConfirmar(null)}
        onConfirmar={async () => {
          if (!confirmar || confirmar.error) { setConfirmar(null); return; }
          try {
            await eliminarActivo(confirmar.id);
            setConfirmar(null);
            cargar();
          } catch (e: any) {
            setConfirmar(prev => prev ? { ...prev, error: e.message } : null);
          }
        }}
      />

      <ConfirmModal
        open={confirmarRevision !== null}
        icono="🔧"
        titulo="Confirmar mantenimiento"
        mensaje={`¿Marcar el mantenimiento de ${confirmarRevision?.matricula} como realizado? El contador de horas desde el último servicio se reiniciará a 0h y el estado pasará a Disponible.`}
        labelConfirmar="Confirmar revisión"
        colorConfirmar="var(--navy)"
        onCancelar={() => setConfirmarRevision(null)}
        onConfirmar={async () => {
          if (!confirmarRevision) return;
          try {
            await marcarRevision(confirmarRevision.id);
            cargar();
          } catch {
            setErrorCarga("Error al marcar la revisión. Inténtalo de nuevo.");
          } finally {
            setConfirmarRevision(null);
          }
        }}
      />

      <NuevoActivoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onGuardar={async (data) => {
          await crearActivo(data);
          cargar();
        }}
      />
    </AppShell>
  );
}
