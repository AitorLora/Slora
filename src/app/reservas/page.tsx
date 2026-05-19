"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { NuevaReservaModal } from "@/components/reservas/NuevaReservaModal";
import { bookings as initialBookings, sociedades, type Booking, type BookingStatus } from "@/lib/mock-data";

const ESTADO_STYLE: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pendiente:  { label: "Pendiente",  color: "var(--amber-text)", bg: "var(--amber-bg)" },
  confirmada: { label: "Confirmada", color: "#0C447C",           bg: "var(--blue-light)" },
  en_curso:   { label: "En curso",   color: "#0369A1",           bg: "#E0F2FE" },
  completada: { label: "Completada", color: "var(--green-text)", bg: "var(--green-bg)" },
  cancelada:  { label: "Cancelada",  color: "var(--gray-text)",  bg: "var(--gray-bg)" },
};

const ESTADOS: BookingStatus[] = ["pendiente", "confirmada", "en_curso", "completada", "cancelada"];

export default function ReservasPage() {
  const [reservas, setReservas] = useState<Booking[]>(initialBookings);
  const [modalOpen, setModalOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<BookingStatus | "">("");
  const [sociedadFiltro, setSociedadFiltro] = useState("");
  const [menuAbierto, setMenuAbierto] = useState<number | null>(null);
  let nextId = Math.max(...reservas.map(r => r.id)) + 1;

  const filtradas = reservas
    .filter(r => {
      const q = busqueda.toLowerCase();
      if (q && !r.cliente.toLowerCase().includes(q) && !r.activo_nombre.toLowerCase().includes(q) && !r.fuente.toLowerCase().includes(q)) return false;
      if (estadoFiltro && r.estado !== estadoFiltro) return false;
      if (sociedadFiltro && r.sociedad_id !== sociedadFiltro) return false;
      return true;
    })
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  function cambiarEstado(id: number, estado: BookingStatus) {
    setReservas(rs => rs.map(r => r.id === id ? { ...r, estado } : r));
    setMenuAbierto(null);
  }

  function eliminar(id: number) {
    setReservas(rs => rs.filter(r => r.id !== id));
  }

  function guardarReserva(booking: Omit<Booking, "id">) {
    setReservas(rs => [{ id: nextId++, ...booking }, ...rs]);
  }

  const actions = (
    <button
      onClick={() => setModalOpen(true)}
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
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[180px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px]" style={{ color: "var(--text-3)" }}>⌕</span>
          <input
            type="text"
            placeholder="Buscar cliente, activo, plataforma..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)]"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          />
        </div>
        {/* Estado */}
        <select
          value={estadoFiltro}
          onChange={e => setEstadoFiltro(e.target.value as BookingStatus | "")}
          className="px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_STYLE[e].label}</option>)}
        </select>
        {/* Sociedad */}
        <select
          value={sociedadFiltro}
          onChange={e => setSociedadFiltro(e.target.value)}
          className="px-3 py-2 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] cursor-pointer"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
        >
          <option value="">Todas las sociedades</option>
          {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>

      {/* Lista de reservas */}
      {filtradas.length === 0 ? (
        <div className="text-center py-16" style={{ color: "var(--text-3)" }}>
          <p className="text-3xl mb-3 opacity-40">📋</p>
          <p>No hay reservas con estos filtros</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map(r => {
            const est = ESTADO_STYLE[r.estado];
            const fecha = new Date(r.fecha + "T12:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors hover:border-[var(--border-2)]"
                style={{ background: "var(--surface)", borderColor: "var(--border)" }}
              >
                {/* Precio */}
                <div className="w-16 flex-shrink-0">
                  <p className="font-mono text-[18px] font-semibold" style={{ color: "var(--foreground)" }}>
                    €{r.ingreso_neto}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className="font-mono text-[11px] text-white px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: "var(--navy)" }}
                    >
                      {r.activo_id}
                    </span>
                    <span className="text-[13px] font-medium truncate" style={{ color: "var(--foreground)" }}>
                      {r.cliente}
                    </span>
                    <span className="text-[12px]" style={{ color: "var(--text-3)" }}>· {r.duracion} · {r.hora}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-3)" }}>
                    <span>{fecha}</span>
                    <span>·</span>
                    <span>{r.tipo === "moto" ? "Moto" : "Barco"}</span>
                    <span>·</span>
                    <span
                      className="font-mono text-[10px] px-1 py-0.5 rounded"
                      style={{ background: "var(--muted)" }}
                    >
                      {r.fuente}
                    </span>
                    {r.notas && <><span>·</span><span className="italic">{r.notas}</span></>}
                  </div>
                  <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--blue)" }}>
                    {r.sociedad_nombre}
                  </p>
                </div>

                {/* Estado dropdown */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={() => setMenuAbierto(menuAbierto === r.id ? null : r.id)}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
                    style={{ color: est.color, background: est.bg }}
                  >
                    {est.label} ▾
                  </button>
                  {menuAbierto === r.id && (
                    <div
                      className="absolute right-0 top-[calc(100%+4px)] rounded-lg border overflow-hidden z-20 min-w-[130px]"
                      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                    >
                      {ESTADOS.map(e => (
                        <button
                          key={e}
                          onClick={() => cambiarEstado(r.id, e)}
                          className="w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 transition-colors hover:bg-[var(--muted)]"
                          style={{ color: "var(--foreground)" }}
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ background: ESTADO_STYLE[e].color }}
                          />
                          {ESTADO_STYLE[e].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Eliminar */}
                <button
                  onClick={() => eliminar(r.id)}
                  className="text-[18px] leading-none px-2 py-1 rounded transition-colors flex-shrink-0 hover:bg-[var(--red-bg)]"
                  style={{ color: "var(--text-3)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--red-text)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-3)")}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Cerrar menú al hacer clic fuera */}
      {menuAbierto !== null && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuAbierto(null)} />
      )}

      <NuevaReservaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onGuardar={guardarReserva}
      />
    </AppShell>
  );
}
