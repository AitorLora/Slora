"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";

type Plataforma = "clickandboat" | "sandboat";
type Duracion   = "half_day" | "full_day";

const PLATAFORMA_LABEL: Record<Plataforma, string> = {
  clickandboat: "Click and Boat",
  sandboat:     "Sandboat",
};

function hoy() { return new Date().toISOString().split("T")[0]; }

function buildClickAndBoatPayload(form: FormState) {
  const [first, ...rest] = form.cliente.split(" ");
  return {
    event:      "booking.new",
    booking_id: `CB-${Date.now()}`,
    boat:   { name: form.activo_nombre },
    renter: { first_name: first ?? form.cliente, last_name: rest.join(" ") || undefined },
    rental: {
      start_date: form.fecha,
      start_time: form.hora,
      type:       form.duracion,
    },
  };
}

function buildSandboatPayload(form: FormState) {
  return {
    event:        "reservation.created",
    id:           `SB-${Date.now()}`,
    boat_name:    form.activo_nombre,
    skipper_name: form.cliente,
    departure_at: `${form.fecha}T${form.hora}:00`,
    rental_type:  form.duracion,
  };
}

interface FormState {
  cliente:       string;
  activo_nombre: string;
  fecha:         string;
  hora:          string;
  duracion:      Duracion;
}

interface Resultado {
  ok:     boolean;
  status: number;
  body:   any;
}

export default function SimuladorPage() {
  const [plataforma, setPlataforma] = useState<Plataforma>("clickandboat");
  const [secret, setSecret]         = useState("");
  const [form, setForm]             = useState<FormState>({
    cliente:       "Juan García",
    activo_nombre: "",
    fecha:         hoy(),
    hora:          "09:00",
    duracion:      "half_day",
  });
  const [enviando, setEnviando]   = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const payload = plataforma === "clickandboat"
    ? buildClickAndBoatPayload(form)
    : buildSandboatPayload(form);

  async function enviar() {
    setEnviando(true);
    setResultado(null);
    try {
      const res = await fetch(`/api/webhooks/${plataforma}`, {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-webhook-secret":  secret,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      setResultado({ ok: res.ok, status: res.status, body });
    } catch (e: any) {
      setResultado({ ok: false, status: 0, body: { error: e.message } });
    } finally {
      setEnviando(false);
    }
  }

  const field = (label: string, node: React.ReactNode) => (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.07em] font-medium mb-1.5"
        style={{ color: "var(--text-3)" }}>{label}</label>
      {node}
    </div>
  );

  const inputCls = "w-full px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" };

  return (
    <AppShell title="Simulador de plataformas" subtitle="Prueba la recepción de reservas desde Click and Boat y Sandboat">
      <div className="grid gap-5 lg:grid-cols-2 max-w-5xl">

        {/* Columna izquierda — formulario */}
        <div className="space-y-4 rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--text-3)" }}>
            Configuración del envío
          </p>

          {/* Selector de plataforma */}
          <div className="grid grid-cols-2 gap-2">
            {(["clickandboat", "sandboat"] as Plataforma[]).map(p => (
              <button key={p} onClick={() => setPlataforma(p)}
                className="border-2 rounded-xl py-3 text-center transition-all"
                style={{
                  borderColor: plataforma === p ? "var(--blue)" : "var(--border)",
                  background:  plataforma === p ? "var(--blue-light)" : "var(--muted)",
                }}>
                <p className="text-[13px] font-semibold" style={{ color: plataforma === p ? "var(--blue)" : "var(--foreground)" }}>
                  {PLATAFORMA_LABEL[p]}
                </p>
              </button>
            ))}
          </div>

          {/* Secret */}
          {field("Webhook secret (x-webhook-secret)",
            <input type="password" value={secret} onChange={e => setSecret(e.target.value)}
              placeholder="El mismo valor que WEBHOOK_SECRET en .env.local"
              className={inputCls} style={inputStyle} />
          )}

          <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
            <p className="text-[11px] uppercase tracking-[0.07em] font-medium mb-3" style={{ color: "var(--text-3)" }}>
              Datos de la reserva
            </p>
            <div className="space-y-3">
              {field("Nombre del cliente",
                <input type="text" value={form.cliente}
                  onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))}
                  className={inputCls} style={inputStyle} />
              )}
              {field("Nombre del activo (debe coincidir exactamente con Slora)",
                <input type="text" value={form.activo_nombre}
                  onChange={e => setForm(f => ({ ...f, activo_nombre: e.target.value }))}
                  placeholder="Ej: Sea-Doo GTX 1"
                  className={inputCls} style={inputStyle} />
              )}
              <div className="grid grid-cols-2 gap-3">
                {field("Fecha",
                  <input type="date" value={form.fecha} min={hoy()}
                    onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                )}
                {field("Hora de salida",
                  <input type="time" value={form.hora}
                    onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                    className={inputCls} style={inputStyle} />
                )}
              </div>
              {field("Duración",
                <div className="grid grid-cols-2 gap-2">
                  {(["half_day", "full_day"] as Duracion[]).map(d => (
                    <button key={d} onClick={() => setForm(f => ({ ...f, duracion: d }))}
                      className="border-2 rounded-lg py-2 text-[13px] font-medium transition-all"
                      style={{
                        borderColor: form.duracion === d ? "var(--blue)" : "var(--border)",
                        background:  form.duracion === d ? "var(--blue-light)" : "var(--muted)",
                        color:       form.duracion === d ? "var(--blue)" : "var(--foreground)",
                      }}>
                      {d === "half_day" ? "Medio día (4h)" : "Día completo (8h)"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button onClick={enviar} disabled={enviando || !form.activo_nombre || !secret}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40"
            style={{ background: "var(--navy)" }}>
            {enviando ? "Enviando..." : `Simular reserva desde ${PLATAFORMA_LABEL[plataforma]}`}
          </button>
        </div>

        {/* Columna derecha — payload + respuesta */}
        <div className="space-y-4">

          {/* Payload preview */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
              <p className="text-[11px] uppercase tracking-[0.07em] font-medium" style={{ color: "var(--text-3)" }}>
                Payload que se enviará
              </p>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                style={{ background: "var(--surface)", color: "var(--text-2)" }}>
                POST /api/webhooks/{plataforma}
              </span>
            </div>
            <pre className="px-4 py-3 text-[11px] font-mono overflow-x-auto leading-relaxed"
              style={{ color: "var(--text-2)", background: "var(--surface)" }}>
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>

          {/* Respuesta */}
          {resultado && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: resultado.ok ? "var(--green-text)" : "var(--red-text)" }}>
              <div className="px-4 py-3 border-b flex items-center gap-2"
                style={{
                  borderColor: resultado.ok ? "var(--green-text)" : "var(--red-text)",
                  background:  resultado.ok ? "var(--green-bg)" : "var(--red-bg)",
                }}>
                <span className="text-[15px]">{resultado.ok ? "✅" : "❌"}</span>
                <p className="text-[12px] font-semibold"
                  style={{ color: resultado.ok ? "var(--green-text)" : "var(--red-text)" }}>
                  {resultado.ok ? "Reserva creada correctamente" : `Error ${resultado.status}`}
                </p>
              </div>
              <pre className="px-4 py-3 text-[11px] font-mono overflow-x-auto leading-relaxed"
                style={{ color: "var(--text-2)", background: "var(--surface)" }}>
                {JSON.stringify(resultado.body, null, 2)}
              </pre>
            </div>
          )}

          {/* Instrucciones */}
          {!resultado && (
            <div className="rounded-xl border p-4 space-y-3"
              style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
              <p className="text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                Cómo usar este simulador
              </p>
              <ol className="space-y-2">
                {[
                  "Añade WEBHOOK_SECRET y SUPABASE_SERVICE_ROLE_KEY en tu .env.local",
                  "Pon el mismo valor del secret en el campo de arriba",
                  "Escribe exactamente el nombre del activo como aparece en Flota",
                  "Pulsa «Simular» y revisa la respuesta",
                  "Si sale error 404, el nombre del activo no coincide",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-2)" }}>
                    <span className="font-mono text-[10px] font-bold mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-white"
                      style={{ background: "var(--navy)" }}>{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
              <div className="pt-2 border-t text-[11px] font-mono rounded-lg px-3 py-2"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-3)" }}>
                {`# .env.local\nWEBHOOK_SECRET=tu_clave_secreta\nSUPABASE_SERVICE_ROLE_KEY=tu_service_role_key`}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
