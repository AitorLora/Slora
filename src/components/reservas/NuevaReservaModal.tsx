"use client";

import { useState, useEffect } from "react";
import {
  TARIFAS_MOTO, TARIFAS_BARCO, FUENTES, HORAS_CONSUMIDAS,
  DURACIONES_MOTO, DURACIONES_BARCO,
  type Booking, type BarcoCategoria,
} from "@/lib/mock-data";
import { TimeInput } from "@/components/ui/TimeInput";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { cacheGet, cacheSet } from "@/lib/offline-db";

type Paso = 1 | 2 | 3 | 4 | 5;

interface ActivoDB {
  id: string;
  nombre: string;
  matricula: string;
  tipo: "moto" | "barco";
  sociedad_id: string;
  horas_motor: number;
  horas_desde_servicio: number;
  estado: string;
  capacidad?: number;
  licencia?: boolean;
  categoria?: BarcoCategoria;
}

export interface ModalInitialValues {
  tipo?: "moto" | "barco";
  cantidad?: number;
  categoria?: BarcoCategoria;
  duracion?: string;
  hora?: string;
  fecha?: string;
  fuente?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onGuardar: (b: Omit<Booking, "id">) => Promise<void>;
  initialValues?: ModalInitialValues;
}

function categoriaBarco(a: { licencia?: boolean; capacidad?: number }): BarcoCategoria {
  if (a.licencia) return "con_licencia";
  if ((a.capacidad ?? 6) >= 7) return "sin_licencia_7";
  return "sin_licencia_6";
}

function hoy() {
  // Devuelve la fecha local en España, no en UTC.
  // Sin esto, a las 23:xx España (= 21:xx UTC) el date-picker bloquea "hoy" como pasado.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}
function ahora() {
  const d = new Date();
  const h = d.getHours();
  const m = d.getMinutes() >= 30 ? 30 : 0;
  // La operativa es 09:00–21:00. Fuera de ese horario, la salida por defecto es 09:00
  // (evita que el selector arranque en una hora que no se puede ajustar).
  if (h < 9 || h > 20) return "09:00";
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function NuevaReservaModal({ open, onClose, onGuardar, initialValues }: Props) {
  const online = useOnlineStatus();
  const [activos, setActivos]           = useState<ActivoDB[]>([]);
  // Franjas ya ocupadas en la fecha (minutos desde medianoche), para detectar solape por hora
  const [reservasFecha, setReservasFecha] = useState<{ activo_id: string; inicioMin: number; finMin: number }[]>([]);
  const [sociedades, setSociedades]     = useState<{ id: string; nombre: string }[]>([]);
  const [paso, setPaso]       = useState<Paso>(1);
  const [tipo, setTipo]       = useState<"moto" | "barco" | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [categoria, setCategoria] = useState<BarcoCategoria | null>(null);
  const [duracion, setDuracion] = useState("");
  const [fuente, setFuente]   = useState("Manual");
  const [cliente, setCliente] = useState("");
  const [hora, setHora]       = useState(ahora());
  const [fecha, setFecha]     = useState(hoy());
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");

  // Carga activos y sociedades al abrir (online: Supabase + caché; offline: IndexedDB)
  useEffect(() => {
    if (!open) return;
    const iv = initialValues ?? {};
    setPaso(1);
    setTipo(iv.tipo ?? null);
    setCantidad(iv.cantidad ?? 1);
    setCategoria(iv.categoria ?? null);
    setDuracion(iv.duracion ?? "");
    setFuente(iv.fuente ?? "Manual");
    setCliente("");
    setHora(iv.hora ?? ahora());
    setFecha(iv.fecha ?? hoy());
    setError("");

    if (!online) {
      Promise.all([
        cacheGet<any[]>("activos"),
        cacheGet<{ id: string; nombre: string }[]>("sociedades"),
      ]).then(([cachedActivos, cachedSoc]) => {
        if (!cachedActivos?.length) {
          setError("Sin conexión y sin datos en caché. Abre el modal con conexión al menos una vez.");
          return;
        }
        setActivos(cachedActivos.map(act => ({
          ...act,
          categoria: act.tipo === "barco" ? categoriaBarco(act) : undefined,
        })));
        setSociedades(cachedSoc ?? []);
      }).catch(() => {
        setError("Error al leer los datos sin conexión.");
      });
      return;
    }

    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      Promise.all([
        supabase.from("activos").select("id, nombre, matricula, tipo, sociedad_id, horas_motor, horas_desde_servicio, estado, capacidad, licencia"),
        supabase.from("sociedades").select("id, nombre"),
      ]).then(([{ data: a }, { data: s }]) => {
        const conCategoria = (a ?? []).map(act => ({
          ...act,
          categoria: act.tipo === "barco" ? categoriaBarco(act) : undefined,
        }));
        setActivos(conCategoria);
        setSociedades(s ?? []);
        // Actualizar caché para uso offline futuro
        cacheSet("activos", a ?? []);
        cacheSet("sociedades", s ?? []);
      }).catch(() => {
        setError("Error al cargar los activos. Cierra el modal y vuelve a intentarlo.");
      });
    });
  }, [open, online]);

  // Recarga las franjas ocupadas cuando cambia la fecha (offline: usa caché de reservas)
  useEffect(() => {
    if (!open || !fecha) return;

    function toSlots(rows: any[]) {
      return rows.map((r: any) => {
        const [hh, mm] = (r.hora ?? "09:00").split(":").map(Number);
        const inicioMin = hh * 60 + mm;
        return { activo_id: r.activo_id, inicioMin, finMin: inicioMin + (r.horas_consumidas ?? 4) * 60 };
      });
    }

    if (!online) {
      cacheGet<any[]>("reservas").then(cached => {
        const del_dia = (cached ?? []).filter(r =>
          String(r.fecha ?? "").slice(0, 10) === fecha &&
          ["pendiente", "confirmada", "en_curso"].includes(r.estado)
        );
        setReservasFecha(toSlots(del_dia));
      });
      return;
    }

    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient()
        .from("reservas")
        .select("activo_id, hora, horas_consumidas")
        .eq("fecha", fecha)
        .in("estado", ["pendiente", "confirmada", "en_curso"])
        .then(({ data }) => setReservasFecha(toSlots(data ?? [])));
    });
  }, [open, fecha, online]);

  // Limpia el error de guardado al ajustar hora/fecha/duración (p. ej. tras corregir una hora pasada)
  useEffect(() => {
    setError("");
  }, [hora, fecha, duracion]);

  if (!open) return null;

  // ¿La franja [iniMin, finMin) solapa con alguna reserva existente de este activo?
  // Solape estricto de intervalos — mismo criterio que el servidor en crearReserva().
  const slotOcupado = (activoId: string, iniMin: number, finMin: number) =>
    reservasFecha.some(r => r.activo_id === activoId && iniMin < r.finMin && finMin > r.inicioMin);

  // Franja pedida según la hora seleccionada. Si aún no hay duración (pasos 1-2),
  // se usa la duración mínima del catálogo: estimación permisiva que no oculta un
  // activo libre a esa hora. El paso 3 refina con la duración real.
  const franjaPedida = (t: "moto" | "barco") => {
    const [hh, mm] = (hora || "09:00").split(":").map(Number);
    const iniMin = hh * 60 + mm;
    const cat = t === "barco" ? DURACIONES_BARCO : DURACIONES_MOTO;
    const horas = duracion && cat.includes(duracion)
      ? (HORAS_CONSUMIDAS[duracion] ?? 4)
      : Math.min(...cat.map(d => HORAS_CONSUMIDAS[d] ?? 4));
    return { iniMin, finMin: iniMin + horas * 60 };
  };

  const disponibles = (t: "moto" | "barco", cat?: BarcoCategoria) => {
    const { iniMin, finMin } = franjaPedida(t);
    return activos.filter(a =>
      a.tipo === t &&
      a.estado === "ACTIVO" &&
      !slotOcupado(a.id, iniMin, finMin) &&
      (t === "moto" || !cat || a.categoria === cat)
    );
  };

  // Activos asignados por rotación (los N de menos horas de motor, libres en la fecha)
  const activosAsignados = (() => {
    if (!tipo) return [];
    const disp = disponibles(tipo, tipo === "barco" ? (categoria ?? undefined) : undefined);
    const sorted = [...disp].sort((a, b) => a.horas_motor - b.horas_motor);
    return tipo === "moto" ? sorted.slice(0, cantidad) : sorted.slice(0, 1);
  })();

  const activoAsignado = activosAsignados[0] ?? null;
  const suficientesActivos = tipo === "moto" ? activosAsignados.length >= cantidad : activosAsignados.length >= 1;

  const sociedad_nombre = activoAsignado
    ? (sociedades.find(s => s.id === activoAsignado.sociedad_id)?.nombre ?? "")
    : "";

  const precio = (() => {
    if (!tipo || !duracion) return 0;
    if (tipo === "moto") return (TARIFAS_MOTO[duracion] ?? 0) * cantidad;
    if (!categoria) return 0;
    const t = TARIFAS_BARCO[categoria];
    return duracion === "Medio día" ? t.medio_dia : t.dia_completo;
  })();

  const fianza = 300 * (tipo === "moto" ? cantidad : 1);
  const duraciones = tipo === "barco" ? DURACIONES_BARCO : DURACIONES_MOTO;

  const errorHorario = (() => {
    if (!tipo || !hora || !duracion) return "";
    const [hh, mm] = hora.split(":").map(Number);
    const minInicio = hh * 60 + mm;
    if (minInicio < 9 * 60)
      return `Las salidas empiezan a las 09:00.`;
    const minFin = minInicio + (HORAS_CONSUMIDAS[duracion] ?? 4) * 60;
    if (minFin > 21 * 60)
      return `Esta reserva terminaría después de las 21:00. Elige una hora anterior.`;
    // Si la reserva es para hoy, la hora no puede haber pasado ya (hora de España).
    // Mismo criterio que el servidor en crearReserva(): así no se llega al paso 5 con un error.
    if (fecha === hoy()) {
      const horaEspana = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date());
      const [nh, nm] = horaEspana.split(":").map(Number);
      if (minInicio < nh * 60 + nm)
        return `Esa hora ya ha pasado. Elige una hora posterior.`;
    }
    return "";
  })();

  const puedeAvanzar = (() => {
    if (paso === 1) return tipo !== null && disponibles(tipo).length > 0;
    if (paso === 2) return tipo === "moto" ? cantidad >= 1 : categoria !== null;
    if (paso === 3) return duracion !== "" && fecha !== "" && suficientesActivos && errorHorario === "";
    if (paso === 4) return cliente.trim().length > 0;
    return true;
  })();

  async function guardar() {
    if (!tipo || !activoAsignado || !cliente.trim() || !suficientesActivos) return;
    setError("");
    setGuardando(true);
    const ingresoUnitario = tipo === "moto" ? (TARIFAS_MOTO[duracion] ?? 0) : precio;
    try {
      for (const activo of activosAsignados) {
        await onGuardar({
          activo_id: activo.id,
          activo_nombre: activo.nombre,
          sociedad_id: activo.sociedad_id,
          sociedad_nombre: sociedades.find(s => s.id === activo.sociedad_id)?.nombre ?? "",
          tipo,
          cliente: cliente.trim(),
          fecha,
          hora,
          duracion,
          horas_consumidas: HORAS_CONSUMIDAS[duracion] ?? 4,
          ingreso_neto: ingresoUnitario,
          fuente,
          estado: "confirmada",
          notas: "",
        });
      }
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error al guardar la reserva");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(10,37,64,0.5)" }}
    >
      <div className="w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: "var(--surface)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Nueva reserva</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <div key={n} className="h-1 rounded-full transition-all"
                    style={{ width: n <= paso ? "20px" : "8px", background: n <= paso ? "var(--blue)" : "var(--border)" }} />
                ))}
              </div>
              {!online && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ background: "#FEF3C7", color: "#92400E" }}>
                  Sin conexión · Caché local
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-[20px] leading-none px-2 py-1 rounded hover:bg-[var(--muted)]" style={{ color: "var(--text-3)" }}>×</button>
        </div>

        <div className="px-5 py-5">

          {/* PASO 1 — Fecha + Tipo */}
          {paso === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: "var(--text-3)" }}>¿Para qué fecha?</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  min={hoy()}
                  className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: "var(--text-3)" }}>¿Qué quiere alquilar?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["moto", "barco"] as const).map(t => (
                    <button key={t} onClick={() => setTipo(t)}
                      className="border-2 rounded-xl px-4 py-4 text-center transition-all"
                      style={{ borderColor: tipo === t ? "var(--blue)" : "var(--border)", background: tipo === t ? "var(--blue-light)" : "var(--surface)" }}>
                      <p className="text-[14px] font-semibold tracking-wide" style={{ color: tipo === t ? "var(--blue)" : "var(--foreground)" }}>
                        {t === "moto" ? "Moto de agua" : "Barco"}
                      </p>
                      <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
                        {disponibles(t).length} disponible{disponibles(t).length !== 1 ? "s" : ""}
                      </p>
                    </button>
                  ))}
                </div>
                {tipo !== null && disponibles(tipo).length === 0 && (
                  <p className="text-[12px] mt-3 text-center font-medium" style={{ color: "var(--red-text)" }}>
                    No hay {tipo === "moto" ? "motos" : "barcos"} disponibles en este momento
                  </p>
                )}
              </div>
            </div>
          )}

          {/* PASO 2a — Nº motos */}
          {paso === 2 && tipo === "moto" && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>¿Cuántas motos?</p>
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setCantidad(n)}
                    className="border-2 rounded-xl py-4 text-center transition-all"
                    style={{ borderColor: cantidad === n ? "var(--blue)" : "var(--border)", background: cantidad === n ? "var(--blue-light)" : "var(--surface)" }}>
                    <p className="text-[22px] font-semibold" style={{ color: "var(--foreground)" }}>{n}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{n === 1 ? "unidad" : "unidades"}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PASO 2b — Tipo de barco */}
          {paso === 2 && tipo === "barco" && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>¿Qué tipo de barco?</p>
              <div className="space-y-2">
                {(Object.entries(TARIFAS_BARCO) as [BarcoCategoria, typeof TARIFAS_BARCO[BarcoCategoria]][]).filter(([cat]) =>
                  activos.some(a => a.tipo === "barco" && a.estado === "ACTIVO" && a.categoria === cat)
                ).map(([cat, info]) => {
                  const totalCat = activos.filter(a => a.tipo === "barco" && a.estado === "ACTIVO" && a.categoria === cat).length;
                  return (
                    <button key={cat} onClick={() => setCategoria(cat)}
                      className="w-full border-2 rounded-xl px-4 py-3 text-left transition-all"
                      style={{ borderColor: categoria === cat ? "var(--blue)" : "var(--border)", background: categoria === cat ? "var(--blue-light)" : "var(--surface)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{info.label}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{info.descripcion}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[13px] font-medium" style={{ color: "var(--foreground)" }}>€{info.medio_dia} / €{info.dia_completo}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-3)" }}>Medio día / Día completo</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                            {totalCat} barco{totalCat !== 1 ? "s" : ""} en flota
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {categoria && activoAsignado && (
                <div className="mt-3 space-y-2">
                  <div className="px-3 py-2 rounded-lg text-[12px]" style={{ background: "var(--muted)", color: "var(--text-2)" }}>
                    <span className="font-medium" style={{ color: "var(--navy)" }}>Asignado por rotación:</span>{" "}
                    {activoAsignado.nombre} · {activoAsignado.matricula} · {activoAsignado.horas_motor}h motor
                  </div>
                  {activoAsignado.horas_desde_servicio >= 100 && (
                    <div className="px-3 py-2.5 rounded-lg flex items-center gap-2 text-[12px]" style={{ background: "var(--amber-bg)", color: "var(--amber-text)" }}>
                      <span className="text-[14px] flex-shrink-0">🔧</span>
                      <span>Este activo tiene que pasar por mantenimiento
                        <span className="ml-1 opacity-75">({activoAsignado.horas_desde_servicio}h / 100h)</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PASO 3 — Fecha, duración, hora, fuente */}
          {paso === 3 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Duración del alquiler</p>
              <div className={`grid gap-2 ${tipo === "barco" ? "grid-cols-2" : "grid-cols-4"}`}>
                {duraciones.map(d => {
                  const p = tipo === "moto"
                    ? TARIFAS_MOTO[d]
                    : categoria ? (d === "Medio día" ? TARIFAS_BARCO[categoria].medio_dia : TARIFAS_BARCO[categoria].dia_completo) : 0;
                  return (
                    <button key={d} onClick={() => setDuracion(d)}
                      className="border-2 rounded-xl py-2.5 px-2 text-center transition-all"
                      style={{ borderColor: duracion === d ? "var(--blue)" : "var(--border)", background: duracion === d ? "var(--blue-light)" : "var(--surface)" }}>
                      <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>{d}</p>
                      <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>€{p}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>Hora de salida</label>
                <TimeInput value={hora} onChange={setHora} />
                {errorHorario && (
                  <p className="mt-1.5 text-[12px]" style={{ color: "var(--red-text)" }}>⚠ {errorHorario}</p>
                )}
              </div>
              <div className="mt-3">
                <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>Origen</label>
                <select value={fuente} onChange={e => setFuente(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
                  {FUENTES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              {suficientesActivos ? (
                <div className="mt-3 space-y-2">
                  <div className="px-3 py-2.5 rounded-lg" style={{ background: "var(--muted)" }}>
                    <p className="text-[10px] uppercase tracking-[0.06em] font-medium mb-1.5" style={{ color: "var(--text-3)" }}>
                      {activosAsignados.length > 1 ? "Activos asignados" : "Activo asignado"}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activosAsignados.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium"
                          style={{ background: "var(--navy)", color: "white" }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#4ade80" }} />
                          <span className="font-mono">{a.matricula}</span>
                          <span style={{ color: "rgba(255,255,255,0.6)" }}>·</span>
                          <span>{a.nombre}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {activosAsignados.some(a => a.horas_desde_servicio >= 100) && (
                    <div className="px-3 py-2.5 rounded-lg flex items-start gap-2" style={{ background: "var(--amber-bg)" }}>
                      <span className="text-[14px] flex-shrink-0 mt-0.5">🔧</span>
                      <div className="space-y-0.5">
                        {activosAsignados.filter(a => a.horas_desde_servicio >= 100).map(a => (
                          <p key={a.id} className="text-[12px]" style={{ color: "var(--amber-text)" }}>
                            <span className="font-mono font-semibold">{a.matricula}</span> — Este activo tiene que pasar por mantenimiento
                            <span className="ml-1 text-[11px] opacity-75">({a.horas_desde_servicio}h / 100h)</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : tipo ? (
                <div className="mt-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
                  {tipo === "moto"
                    ? `Solo hay ${disponibles("moto").length} moto${disponibles("moto").length !== 1 ? "s" : ""} disponible${disponibles("moto").length !== 1 ? "s" : ""} para esta fecha. Reduce la cantidad o elige otra fecha.`
                    : "Sin activos disponibles para esta fecha. Elige otra fecha."}
                </div>
              ) : null}
            </div>
          )}

          {/* PASO 4 — Cliente */}
          {paso === 4 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Datos del cliente</p>
              <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>Nombre *</label>
              <input type="text" placeholder="Nombre del cliente" value={cliente} onChange={e => setCliente(e.target.value)} autoFocus
                className="w-full px-3 py-2.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
            </div>
          )}

          {/* PASO 5 — Resumen */}
          {paso === 5 && activoAsignado && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Resumen de la reserva</p>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>

                {/* Fila Activo — chips */}
                <div className="flex items-start justify-between gap-3 px-4 py-2.5 text-[12px]" style={{ borderBottom: "1px solid var(--border)" }}>
                  <span className="flex-shrink-0 pt-0.5" style={{ color: "var(--text-3)" }}>Activo</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {activosAsignados.map(a => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
                        style={{ background: "var(--navy)", color: "white" }}>
                        <span className="font-mono tracking-wide">{a.matricula}</span>
                        <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
                        <span style={{ color: "rgba(255,255,255,0.8)" }}>{a.nombre}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {[
                  ["Cliente",   cliente],
                  ["Tipo",      tipo === "moto" ? `${cantidad} moto${cantidad > 1 ? "s" : ""} de agua` : `${categoria ? TARIFAS_BARCO[categoria].label : ""}`],
                  ["Fecha",     new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })],
                  ["Duración",  `${duracion} · Salida ${hora}`],
                  ["Origen",    fuente],
                  ["Sociedad",  sociedad_nombre],
                ].map(([k, v], i, arr) => (
                  <div key={k} className="flex justify-between items-center px-4 py-2.5 text-[12px]"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ color: "var(--text-3)" }}>{k}</span>
                    <span className="font-medium text-right" style={{ color: "var(--foreground)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-xl border p-4 space-y-2" style={{ borderColor: "var(--border)" }}>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: "var(--text-3)" }}>Alquiler</span>
                  <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>€{precio}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span style={{ color: "var(--text-3)" }}>Fianza (€300 × {tipo === "moto" ? cantidad : 1})</span>
                  <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>€{fianza}</span>
                </div>
                <div className="flex justify-between pt-2 mt-1 border-t text-[14px] font-semibold" style={{ borderColor: "var(--border)" }}>
                  <span style={{ color: "var(--navy)" }}>Total a cobrar</span>
                  <span className="font-mono" style={{ color: "var(--navy)" }}>€{precio + fianza}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error al guardar */}
        {error && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: "var(--red-bg)", color: "var(--red-text)" }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button onClick={() => paso > 1 ? setPaso((paso - 1) as Paso) : onClose()}
            disabled={guardando}
            className="px-4 py-2 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--muted)] disabled:opacity-40"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
            {paso === 1 ? "Cancelar" : "← Atrás"}
          </button>
          <button onClick={() => paso < 5 ? setPaso((paso + 1) as Paso) : guardar()}
            disabled={!puedeAvanzar || (paso === 5 && !suficientesActivos) || guardando}
            className="px-5 py-2 rounded-lg text-[13px] font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "var(--navy)" }}>
            {paso === 5 ? (guardando ? "Guardando..." : "Confirmar reserva") : "Siguiente →"}
          </button>
        </div>
      </div>
    </div>
  );
}
