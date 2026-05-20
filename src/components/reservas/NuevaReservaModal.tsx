"use client";

import { useState, useEffect } from "react";
import {
  TARIFAS_MOTO, TARIFAS_BARCO, FUENTES, HORAS_CONSUMIDAS,
  DURACIONES_MOTO, DURACIONES_BARCO,
  type Booking, type BarcoCategoria,
} from "@/lib/mock-data";
import { JetSkiIcon } from "@/components/icons/JetSkiIcon";
import { TimeInput } from "@/components/ui/TimeInput";

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

function categoriaBarco(a: { nombre: string; capacidad?: number }): BarcoCategoria {
  if (a.nombre.toLowerCase().includes("quicksilver")) return "quicksilver";
  if ((a.capacidad ?? 6) >= 7) return "sin_licencia_7";
  return "sin_licencia_6";
}

function hoy() { return new Date().toISOString().split("T")[0]; }
function ahora() {
  const d = new Date();
  const h = d.getHours().toString().padStart(2, "0");
  const m = d.getMinutes() >= 30 ? "30" : "00";
  return `${h}:${m}`;
}

export function NuevaReservaModal({ open, onClose, onGuardar, initialValues }: Props) {
  const [activos, setActivos]           = useState<ActivoDB[]>([]);
  const [reservasOcupadas, setOcupadas] = useState<string[]>([]); // activo_ids reservados en la fecha
  const [sociedades, setSociedades]     = useState<{ id: string; nombre: string }[]>([]);
  const [paso, setPaso]       = useState<Paso>(1);
  const [tipo, setTipo]       = useState<"moto" | "barco" | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [categoria, setCategoria] = useState<BarcoCategoria | null>(null);
  const [duracion, setDuracion] = useState("");
  const [fuente, setFuente]   = useState("Directo");
  const [cliente, setCliente] = useState("");
  const [hora, setHora]       = useState(ahora());
  const [fecha, setFecha]     = useState(hoy());
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState("");

  // Carga activos y sociedades al abrir
  useEffect(() => {
    if (!open) return;
    const iv = initialValues ?? {};
    setPaso(1);
    setTipo(iv.tipo ?? null);
    setCantidad(iv.cantidad ?? 1);
    setCategoria(iv.categoria ?? null);
    setDuracion(iv.duracion ?? "");
    setFuente(iv.fuente ?? "Directo");
    setCliente("");
    setHora(iv.hora ?? ahora());
    setFecha(iv.fecha ?? hoy());

    import("@/lib/supabase/client").then(({ createClient }) => {
      const supabase = createClient();
      Promise.all([
        supabase.from("activos").select("id, nombre, matricula, tipo, sociedad_id, horas_motor, horas_desde_servicio, estado, capacidad"),
        supabase.from("sociedades").select("id, nombre"),
      ]).then(([{ data: a }, { data: s }]) => {
        const conCategoria = (a ?? []).map(act => ({
          ...act,
          categoria: act.tipo === "barco" ? categoriaBarco(act) : undefined,
        }));
        setActivos(conCategoria);
        setSociedades(s ?? []);
      });
    });
  }, [open]);

  // Recarga activos ocupados cuando cambia la fecha
  useEffect(() => {
    if (!open || !fecha) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient()
        .from("reservas")
        .select("activo_id")
        .eq("fecha", fecha)
        .in("estado", ["pendiente", "confirmada", "en_curso"])
        .then(({ data }) => {
          setOcupadas((data ?? []).map((r: any) => r.activo_id));
        });
    });
  }, [open, fecha]);

  if (!open) return null;

  const disponibles = (t: "moto" | "barco", cat?: BarcoCategoria) =>
    activos.filter(a =>
      a.tipo === t &&
      a.estado === "ACTIVO" &&
      !reservasOcupadas.includes(a.id) &&
      (t === "moto" || !cat || a.categoria === cat)
    );

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

  const puedeAvanzar = (() => {
    if (paso === 1) return tipo !== null;
    if (paso === 2) return tipo === "moto" ? cantidad >= 1 : categoria !== null;
    if (paso === 3) return duracion !== "" && fecha !== "" && suficientesActivos;
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
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-[480px] max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl" style={{ background: "var(--surface)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Nueva reserva</p>
            <div className="flex gap-1 mt-1.5">
              {[1,2,3,4,5].map(n => (
                <div key={n} className="h-1 rounded-full transition-all"
                  style={{ width: n <= paso ? "20px" : "8px", background: n <= paso ? "var(--blue)" : "var(--border)" }} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-[20px] leading-none px-2 py-1 rounded hover:bg-[var(--muted)]" style={{ color: "var(--text-3)" }}>×</button>
        </div>

        <div className="px-5 py-5">

          {/* PASO 1 — Tipo */}
          {paso === 1 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>¿Qué quiere alquilar?</p>
              <div className="grid grid-cols-2 gap-3">
                {(["moto", "barco"] as const).map(t => (
                  <button key={t} onClick={() => setTipo(t)}
                    className="border-2 rounded-xl p-5 text-center transition-all"
                    style={{ borderColor: tipo === t ? "var(--blue)" : "var(--border)", background: tipo === t ? "var(--blue-light)" : "var(--surface)" }}>
                    <div className="flex justify-center mb-2">
                      {t === "moto" ? <JetSkiIcon size={36} color="var(--blue)" /> : <span className="text-3xl">⛵</span>}
                    </div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{t === "moto" ? "Moto de agua" : "Barco"}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>
                      {disponibles(t).length} disponibles hoy
                    </p>
                  </button>
                ))}
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
                {(Object.entries(TARIFAS_BARCO) as [BarcoCategoria, typeof TARIFAS_BARCO[BarcoCategoria]][]).map(([cat, info]) => {
                  const disp = disponibles("barco", cat).length;
                  return (
                    <button key={cat} onClick={() => setCategoria(cat)} disabled={disp === 0}
                      className="w-full border-2 rounded-xl px-4 py-3 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ borderColor: categoria === cat ? "var(--blue)" : "var(--border)", background: categoria === cat ? "var(--blue-light)" : "var(--surface)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{info.label}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{info.descripcion}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[13px] font-medium" style={{ color: "var(--foreground)" }}>€{info.medio_dia} / €{info.dia_completo}</p>
                          <p className="text-[10px]" style={{ color: "var(--text-3)" }}>Medio día / Día completo</p>
                          <p className="text-[11px] mt-0.5" style={{ color: disp ? "var(--green-text)" : "var(--red-text)" }}>
                            {disp ? `${disp} disponible${disp > 1 ? "s" : ""}` : "Sin disponibilidad"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {categoria && activoAsignado && (
                <div className="mt-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: "var(--muted)", color: "var(--text-2)" }}>
                  <span className="font-medium" style={{ color: "var(--navy)" }}>Asignado por rotación:</span>{" "}
                  {activoAsignado.nombre} · {activoAsignado.matricula} · {activoAsignado.horas_motor}h motor
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
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>Fecha</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
                    style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1.5" style={{ color: "var(--text-3)" }}>Hora de salida</label>
                  <TimeInput value={hora} onChange={setHora} />
                </div>
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
                <div className="mt-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: "var(--muted)", color: "var(--text-2)" }}>
                  <span className="font-medium" style={{ color: "var(--navy)" }}>
                    {activosAsignados.length > 1 ? "Activos asignados:" : "Activo asignado:"}
                  </span>{" "}
                  {activosAsignados.map(a => `${a.nombre} (${a.matricula})`).join(" · ")}
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
                {[
                  ["Cliente",   cliente],
                  ["Activo",    activosAsignados.map(a => `${a.nombre} (${a.matricula})`).join(", ")],
                  ["Tipo",      tipo === "moto" ? `${cantidad} moto${cantidad > 1 ? "s" : ""} de agua` : `${categoria ? TARIFAS_BARCO[categoria].label : ""}`],
                  ["Fecha",     new Date(fecha + "T12:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })],
                  ["Duración",  `${duracion} · Salida ${hora}`],
                  ["Origen",    fuente],
                  ["Sociedad",  sociedad_nombre],
                ].map(([k, v], i, arr) => (
                  <div key={k} className="flex justify-between items-center px-4 py-2.5 text-[12px]"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ color: "var(--text-3)" }}>{k}</span>
                    <span className="font-medium" style={{ color: "var(--foreground)" }}>{v}</span>
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
