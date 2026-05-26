"use client";

import { useState, useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onGuardar: (data: {
    matricula: string;
    modelo: string;
    tipo: "moto" | "barco";
    sociedad_id?: string;
    capacidad: number;
    horas_motor: number;
    licencia?: boolean;
  }) => Promise<void>;
}

export function NuevoActivoModal({ open, onClose, onGuardar }: Props) {
  const [sociedades, setSociedades] = useState<{ id: string; nombre: string }[]>([]);
  const [matricula, setMatricula]   = useState("");
  const [modelo, setModelo]         = useState("");
  const [tipo, setTipo]             = useState<"moto" | "barco">("moto");
  const [sociedad_id, setSociedad]  = useState("");
  const [capacidad, setCapacidad]   = useState(2);
  const [horas_motor, setHoras]     = useState(0);
  const [licencia, setLicencia]     = useState(false);
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().from("sociedades").select("id, nombre").then(({ data }) => {
        setSociedades(data ?? []);
        if (data?.length) setSociedad(data[0].id);
      });
    });
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function reset() {
    setMatricula(""); setModelo(""); setTipo("moto");
    setCapacidad(2); setHoras(0); setLicencia(false); setError("");
  }

  const MATRICULA_RE = /^[A-Z]{1,3}-\d{3,5}-[A-Z]{1,2}$/i;

  async function handleGuardar() {
    if (!matricula.trim() || !modelo.trim()) {
      setError("Matrícula y modelo son obligatorios.");
      return;
    }
    if (!MATRICULA_RE.test(matricula.trim())) {
      setError("Formato de matrícula inválido. Ejemplo: MA-1234-A");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await onGuardar({
        matricula: matricula.trim(),
        modelo: modelo.trim(),
        tipo,
        sociedad_id: sociedad_id || undefined,
        capacidad,
        horas_motor,
        licencia: tipo === "barco" ? licencia : undefined,
      });
      reset();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error al guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
>
      <div className="w-full max-w-md rounded-2xl border overflow-hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}>

        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <p className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>Nuevo activo</p>
          <button onClick={() => { reset(); onClose(); }}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--muted)] text-[18px] leading-none"
            style={{ color: "var(--text-3)" }}>×</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Tipo */}
          <div className="flex gap-2">
            {(["moto", "barco"] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className="flex-1 py-2 rounded-xl text-[13px] font-medium border transition-colors"
                style={{
                  borderColor: tipo === t ? "var(--blue)" : "var(--border)",
                  background: tipo === t ? "var(--blue-light)" : "var(--muted)",
                  color: tipo === t ? "var(--blue)" : "var(--text-2)",
                }}>
                {t === "moto" ? "Moto de agua" : "Barco"}
              </button>
            ))}
          </div>

          {/* Matrícula */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Matrícula</label>
            <input value={matricula} onChange={e => setMatricula(e.target.value.toUpperCase())}
              placeholder="ej. MA-1234-A"
              maxLength={12}
              className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] font-mono"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Modelo</label>
            <input value={modelo} onChange={e => setModelo(e.target.value)}
              placeholder={tipo === "moto" ? "ej. Sea-Doo Spark 3up" : "ej. Quicksilver 505"}
              className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
          </div>

          {/* Licencia — solo para barcos */}
          {tipo === "barco" && (
            <button onClick={() => setLicencia(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors"
              style={{
                borderColor: licencia ? "var(--blue)" : "var(--border)",
                background: licencia ? "var(--blue-light)" : "var(--muted)",
              }}>
              <span className="text-[13px]" style={{ color: "var(--foreground)" }}>Requiere licencia náutica</span>
              <span className="w-8 h-4 rounded-full flex items-center px-0.5 transition-colors"
                style={{ background: licencia ? "var(--blue)" : "var(--border)" }}>
                <span className="w-3 h-3 rounded-full bg-white transition-transform"
                  style={{ transform: licencia ? "translateX(16px)" : "translateX(0)" }} />
              </span>
            </button>
          )}

          {/* Sociedad — dropdown personalizado */}
          {sociedades.length > 0 && (
            <div>
              <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Sociedad</label>
              <div ref={dropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-[13px] text-left transition-colors"
                  style={{
                    borderColor: dropdownOpen ? "var(--blue)" : "var(--border)",
                    background: "var(--surface)",
                    color: "var(--foreground)",
                  }}>
                  <span>{sociedades.find(s => s.id === sociedad_id)?.nombre ?? "Seleccionar..."}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    style={{ color: "var(--text-3)", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] rounded-xl border overflow-hidden z-30"
                    style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
                    {sociedades.map(s => {
                      const selected = s.id === sociedad_id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setSociedad(s.id); setDropdownOpen(false); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] text-left transition-colors hover:bg-[var(--muted)]"
                          style={{ color: selected ? "var(--blue)" : "var(--foreground)", background: selected ? "var(--blue-light)" : "transparent" }}>
                          <span className="font-medium">{s.nombre}</span>
                          {selected && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--blue)", flexShrink: 0 }}>
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Capacidad y horas */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Capacidad (pax)</label>
              <input type="number" min={1} value={capacidad} onChange={e => setCapacidad(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Horas de motor</label>
              <input type="number" min={0} value={horas_motor} onChange={e => setHoras(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
            </div>
          </div>

          {error && <p className="text-[12px]" style={{ color: "var(--red-text)" }}>{error}</p>}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={() => { reset(); onClose(); }}
            className="flex-1 py-2.5 rounded-xl border text-[13px] font-medium hover:bg-[var(--muted)] transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={guardando}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--navy)" }}>
            {guardando ? "Guardando..." : "Guardar activo"}
          </button>
        </div>
      </div>
    </div>
  );
}
