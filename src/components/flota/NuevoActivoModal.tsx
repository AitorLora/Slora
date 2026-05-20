"use client";

import { useState, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onGuardar: (data: {
    matricula: string;
    modelo: string;
    tipo: "moto" | "barco";
    sociedad_id: string;
    capacidad: number;
    horas_motor: number;
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
  const [guardando, setGuardando]   = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!open) return;
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().from("sociedades").select("id, nombre").then(({ data }) => {
        setSociedades(data ?? []);
        if (data?.length) setSociedad(data[0].id);
      });
    });
  }, [open]);

  function reset() {
    setMatricula(""); setModelo(""); setTipo("moto");
    setCapacidad(2); setHoras(0); setError("");
  }

  async function handleGuardar() {
    if (!matricula.trim() || !modelo.trim() || !sociedad_id) {
      setError("Matrícula, modelo y sociedad son obligatorios.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await onGuardar({ matricula: matricula.trim(), modelo: modelo.trim(), tipo, sociedad_id, capacidad, horas_motor });
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
      onClick={e => { if (e.target === e.currentTarget) { reset(); onClose(); } }}>
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
            <input value={matricula} onChange={e => setMatricula(e.target.value)}
              placeholder="ej. MW-001"
              className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
          </div>

          {/* Modelo */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Modelo</label>
            <input value={modelo} onChange={e => setModelo(e.target.value)}
              placeholder="ej. Sea-Doo Spark 3up"
              className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
          </div>

          {/* Sociedad */}
          <div>
            <label className="block text-[11px] uppercase tracking-[0.05em] mb-1" style={{ color: "var(--text-3)" }}>Sociedad</label>
            <select value={sociedad_id} onChange={e => setSociedad(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-[13px] outline-none cursor-pointer"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
              {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

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
