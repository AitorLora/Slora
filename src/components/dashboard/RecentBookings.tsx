import { bookings } from "@/lib/mock-data";

export function RecentBookings() {
  return (
    <div className="rounded-xl border overflow-hidden bg-[var(--surface)] border-[var(--border)]">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <p className="text-[13px] font-semibold text-[var(--foreground)]">Reservas Recientes</p>
        <span className="text-[11px] text-[var(--text-3)]">Últimos 7 días</span>
      </div>
      <div>
        {bookings.map((booking, i) => (
          <div
            key={booking.id}
            className="px-4 py-3 flex items-center gap-3 hover:bg-[var(--muted)] transition-colors"
            style={{ borderBottom: i < bookings.length - 1 ? "1px solid var(--border)" : "none" }}
          >
            {/* Price */}
            <div className="w-14 flex-shrink-0">
              <p className="font-mono text-[14px] font-semibold text-[var(--foreground)]">
                €{booking.ingreso_neto}
              </p>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-mono text-[11px] text-white px-1.5 py-0.5 rounded bg-[var(--navy)]">
                  {booking.activo_nombre.split(" ").slice(-2).join("")}
                </span>
                <span className="text-[12px] font-medium truncate text-[var(--foreground)]">
                  {booking.activo_nombre}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-3)]">
                {booking.fecha} · {booking.horas_consumidas}h ·{" "}
                <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-[var(--muted)] text-[var(--text-3)]">
                  {booking.fuente}
                </span>
              </p>
              <p className="text-[11px] font-medium mt-0.5 text-[var(--blue)]">
                {booking.sociedad_nombre}
              </p>
            </div>

            {/* Badge */}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 bg-[var(--green-bg)] text-[var(--green-text)]">
              Completada
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
