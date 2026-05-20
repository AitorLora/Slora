"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { TARIFAS_MOTO, TARIFAS_BARCO, DURACIONES_MOTO, DURACIONES_BARCO, type BarcoCategoria } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import { JetSkiIcon } from "@/components/icons/JetSkiIcon";
import { TimeInput } from "@/components/ui/TimeInput";

type Tipo = "moto" | "barco";

function hoy() { return new Date().toISOString().split("T")[0]; }
function horaActual() {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes() >= 30 ? "30" : "00"}`;
}

function SelectBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="border-2 rounded-xl py-3 px-2 text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ borderColor: active ? "var(--blue)" : "var(--border)", background: active ? "var(--blue-light)" : "var(--surface)" }}>
      {children}
    </button>
  );
}

export default function PresupuestoPage() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("moto");
  const [cantidad, setCantidad] = useState(1);
  const [categoria, setCategoria] = useState<BarcoCategoria>("quicksilver");
  const [duracion, setDuracion] = useState(DURACIONES_MOTO[0]);
  const [hora, setHora] = useState(horaActual());
  const [fecha, setFecha] = useState(hoy());
  const [activosDB, setActivosDB] = useState<{ id: string; tipo: string; estado: string; categoria?: string }[]>([]);
  const [ocupados, setOcupados] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("activos").select("id, tipo, estado, capacidad, nombre").then(({ data }) => {
      setActivosDB((data ?? []).map((a: any) => ({
        ...a,
        categoria: a.tipo === "barco"
          ? (a.nombre?.toLowerCase().includes("quicksilver") ? "quicksilver" : (a.capacidad ?? 6) >= 7 ? "sin_licencia_7" : "sin_licencia_6")
          : undefined,
      })));
    });
  }, []);

  useEffect(() => {
    if (!fecha) return;
    const supabase = createClient();
    supabase.from("reservas").select("activo_id").eq("fecha", fecha).neq("estado", "cancelada")
      .then(({ data }) => setOcupados((data ?? []).map((r: any) => r.activo_id)));
  }, [fecha]);

  function dispBarco(cat: BarcoCategoria) {
    return activosDB.filter(a => a.tipo === "barco" && a.estado === "ACTIVO" && a.categoria === cat && !ocupados.includes(a.id)).length;
  }

  const duraciones = tipo === "barco" ? DURACIONES_BARCO : DURACIONES_MOTO;

  // Si cambia el tipo, reinicia duración al primer valor disponible
  function cambiarTipo(t: Tipo) {
    setTipo(t);
    setDuracion(t === "barco" ? DURACIONES_BARCO[0] : DURACIONES_MOTO[0]);
  }

  const precioUnit = (() => {
    if (tipo === "moto") return TARIFAS_MOTO[duracion] ?? 0;
    const t = TARIFAS_BARCO[categoria];
    return duracion === "Medio día" ? t.medio_dia : t.dia_completo;
  })();

  const unidades      = tipo === "moto" ? cantidad : 1;
  const totalAlquiler = precioUnit * unidades;
  const fianza        = 300 * unidades;
  const totalCobrar   = totalAlquiler + fianza;

  return (
    <AppShell title="Presupuesto" subtitle="Calcula el precio y convierte en reserva">
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start" }}>

        {/* ── Formulario ── */}
        <div className="rounded-xl border p-5 space-y-6" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

          {/* Tipo */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Tipo de alquiler</p>
            <div className="grid grid-cols-2 gap-3">
              {(["moto", "barco"] as Tipo[]).map(t => (
                <SelectBtn key={t} active={tipo === t} onClick={() => cambiarTipo(t)}>
                  <div className="flex justify-center mb-1">
                    {t === "moto" ? <JetSkiIcon size={28} color="var(--blue)" /> : <span className="text-2xl">⛵</span>}
                  </div>
                  <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {t === "moto" ? "Moto de agua" : "Barco"}
                  </p>
                </SelectBtn>
              ))}
            </div>
          </div>

          {/* Nº motos */}
          {tipo === "moto" && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Número de motos</p>
              <div className="grid grid-cols-4 gap-2">
                {[1,2,3,4].map(n => (
                  <SelectBtn key={n} active={cantidad === n} onClick={() => setCantidad(n)}>
                    <p className="text-[20px] font-semibold" style={{ color: "var(--foreground)" }}>{n}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{n === 1 ? "unidad" : "unidades"}</p>
                  </SelectBtn>
                ))}
              </div>
            </div>
          )}

          {/* Tipo de barco */}
          {tipo === "barco" && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Tipo de barco</p>
              <div className="space-y-2">
                {(Object.entries(TARIFAS_BARCO) as [BarcoCategoria, typeof TARIFAS_BARCO[BarcoCategoria]][]).map(([cat, info]) => {
                  const disp = dispBarco(cat);
                  return (
                    <button key={cat} onClick={() => setCategoria(cat)}
                      className="w-full border-2 rounded-xl px-4 py-3 text-left transition-all"
                      style={{ borderColor: categoria === cat ? "var(--blue)" : "var(--border)", background: categoria === cat ? "var(--blue-light)" : "var(--surface)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{info.label}</p>
                          <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{info.descripcion}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-[12px] font-medium" style={{ color: "var(--foreground)" }}>
                            €{info.medio_dia} · €{info.dia_completo}
                          </p>
                          <p className="text-[10px]" style={{ color: "var(--text-3)" }}>Medio día · Día completo</p>
                          <p className="text-[11px] mt-0.5" style={{ color: disp ? "var(--green-text)" : "var(--red-text)" }}>
                            {disp ? `${disp} disponible${disp > 1 ? "s" : ""}` : "Sin disponibilidad"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Duración */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.08em] font-medium mb-3" style={{ color: "var(--text-3)" }}>Duración</p>
            <div className={`grid gap-2 ${tipo === "barco" ? "grid-cols-2" : "grid-cols-4"}`}>
              {duraciones.map(d => {
                const p = tipo === "moto" ? TARIFAS_MOTO[d] : (d === "Medio día" ? TARIFAS_BARCO[categoria].medio_dia : TARIFAS_BARCO[categoria].dia_completo);
                return (
                  <SelectBtn key={d} active={duracion === d} onClick={() => setDuracion(d)}>
                    <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>{d}</p>
                    <p className="font-mono text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>€{p}</p>
                  </SelectBtn>
                );
              })}
            </div>
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
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
        </div>

        {/* ── Resultado sticky ── */}
        <div className="rounded-xl border p-5 space-y-4" style={{ background: "var(--surface)", borderColor: "var(--border)", position: "sticky", top: "88px" }}>
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] font-medium" style={{ color: "var(--text-3)" }}>Total estimado</p>
            <p className="font-mono text-[38px] font-semibold tracking-[-2px] leading-tight mt-1" style={{ color: "var(--navy)" }}>
              €{totalAlquiler.toLocaleString("es-ES")}
            </p>
          </div>

          {/* Desglose */}
          <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
            {[
              [`${unidades} ${tipo === "moto" ? `moto${unidades > 1 ? "s" : ""}` : TARIFAS_BARCO[categoria].label} × ${duracion}`, `€${precioUnit} c/u`],
              ["Total alquiler", `€${totalAlquiler.toLocaleString("es-ES")}`],
              [`Fianza (€300 × ${unidades})`, `€${fianza.toLocaleString("es-ES")}`],
            ].map(([k, v], i) => (
              <div key={k} className="flex justify-between items-center px-3 py-2.5 text-[12px]"
                style={{ borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-3)" }}>{k}</span>
                <span className="font-mono font-medium" style={{ color: "var(--foreground)" }}>{v}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-3 py-3 text-[14px] font-semibold" style={{ color: "var(--navy)" }}>
              <span>Total a cobrar</span>
              <span className="font-mono">€{totalCobrar.toLocaleString("es-ES")}</span>
            </div>
          </div>

          <button onClick={() => {
            const params = new URLSearchParams({
              from: "presupuesto",
              tipo,
              cantidad: String(cantidad),
              categoria,
              duracion,
              hora,
              fecha,
              fuente: "Directo",
            });
            router.push(`/reservas?${params.toString()}`);
          }}
            className="w-full py-2.5 rounded-lg text-[13px] font-medium text-white transition-colors"
            style={{ background: "var(--navy)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--navy-light)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--navy)")}>
            Convertir en reserva →
          </button>

          {/* Tarifas */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.06em] font-medium mb-2" style={{ color: "var(--text-3)" }}>
              {tipo === "moto" ? "Tarifas motos 2026" : "Tarifas barcos 2026"}
            </p>
            {tipo === "moto" ? (
              <div className="grid grid-cols-2 rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {DURACIONES_MOTO.map((d, i) => (
                  <div key={d} className="flex items-center justify-between px-3 py-2 text-[12px]"
                    style={{ borderBottom: i < 2 ? "1px solid var(--border)" : "none", borderRight: i % 2 === 0 ? "1px solid var(--border)" : "none" }}>
                    <span style={{ color: "var(--text-2)" }}>{d}</span>
                    <span className="font-mono font-semibold" style={{ color: "var(--foreground)" }}>€{TARIFAS_MOTO[d]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {(Object.entries(TARIFAS_BARCO) as [BarcoCategoria, typeof TARIFAS_BARCO[BarcoCategoria]][]).map(([cat, info], i, arr) => (
                  <div key={cat} className="flex items-center justify-between px-3 py-2.5 text-[12px]"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div>
                      <p style={{ color: "var(--text-2)" }}>{info.label}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-3)" }}>{info.descripcion}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold" style={{ color: "var(--foreground)" }}>€{info.medio_dia} / €{info.dia_completo}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-3)" }}>½ día / día</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            {[
              { color: "var(--red)",   text: "Combustible a cargo del cliente" },
              { color: "var(--amber)", text: "Fianza €300 / unidad" },
            ].map(({ color, text }) => (
              <div key={text} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-3)" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
