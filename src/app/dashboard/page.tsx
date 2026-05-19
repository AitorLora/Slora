import { KpiCard } from "@/components/dashboard/KpiCard";
import { FleetTable } from "@/components/dashboard/FleetTable";
import { RecentBookings } from "@/components/dashboard/RecentBookings";
import { assets } from "@/lib/mock-data";

const MESES = [
  { mes: "Abr", cobrado: 400,  proy: 400  },
  { mes: "May", cobrado: 1950, proy: 2500 },
  { mes: "Jun", cobrado: 0,    proy: 3200 },
  { mes: "Jul", cobrado: 0,    proy: 5800 },
  { mes: "Ago", cobrado: 0,    proy: 6400 },
  { mes: "Sep", cobrado: 0,    proy: 2100 },
];
const MAX_BAR = 6400;

const PERF = assets.map((a, i) => ({
  ...a,
  ing: [320, 150, 480, 210, 105, 720, 390, 660][i] ?? 200,
  sal: [3, 1, 4, 2, 1, 3, 2, 3][i] ?? 2,
}));

export default function DashboardPage() {
  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Cobrado"    value="€2.350"  sub="reservas completadas" accent />
        <KpiCard label="Proyectado" value="€20.400" sub="todas sin canceladas" />
        <KpiCard label="Reservas"   value={12}      sub="en temporada" />
        <KpiCard label="Unidades"   value={`${assets.length}/${assets.length}`} sub="activos en flota" />
      </div>

      {/* Ingresos por mes */}
      <div className="rounded-xl border p-5 bg-[var(--surface)] border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Ingresos por mes</p>
          <div className="flex gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
              <span className="w-2 h-2 rounded-sm inline-block bg-[var(--blue)]" />
              Cobrado
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
              <span className="w-2 h-2 rounded-sm inline-block border border-[var(--blue)] bg-[var(--blue-light)]" />
              Proyectado
            </span>
          </div>
        </div>
        <div className="space-y-2.5">
          {MESES.map(({ mes, cobrado, proy }) => {
            const pw = Math.round((proy / MAX_BAR) * 100);
            const cw = Math.round((cobrado / MAX_BAR) * 100);
            return (
              <div key={mes} className="grid items-center gap-2.5" style={{ gridTemplateColumns: "36px 1fr 56px" }}>
                <span className="font-mono text-[11px] font-medium text-[var(--text-3)]">{mes}</span>
                <div className="h-[22px] rounded relative overflow-hidden bg-[var(--muted)]">
                  <div className="absolute inset-y-0 left-0 rounded bg-[var(--blue-light)]" style={{ width: `${pw}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded bg-[var(--blue)]" style={{ width: `${cw}%` }} />
                </div>
                <span className="font-mono text-[11px] text-right text-[var(--text-2)]">
                  {cobrado ? `€${cobrado.toLocaleString("es-ES")}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rendimiento por unidad */}
      <div className="rounded-xl border overflow-hidden bg-[var(--surface)] border-[var(--border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">Rendimiento por unidad</p>
          <span className="text-[11px] text-[var(--text-3)]">temporada actual</span>
        </div>
        <div className="grid px-4 py-2 text-[10px] uppercase tracking-[0.06em] font-medium text-[var(--text-3)] bg-[var(--muted)]"
          style={{ gridTemplateColumns: "14px 130px 130px 1fr 90px", gap: "10px" }}>
          <span /><span>ID</span><span>Sociedad</span><span>Rendimiento</span><span className="text-right">€ / Sal.</span>
        </div>
        {PERF.map((a) => {
          const pct = Math.round((a.ing / 800) * 100);
          const dotColor = a.estado === "ACTIVO" ? "var(--green)" : a.estado === "ALERTA" ? "var(--amber)" : "var(--text-3)";
          return (
            <div
              key={a.id}
              className="grid px-4 py-2 items-center border-b last:border-0 border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
              style={{ gridTemplateColumns: "14px 130px 130px 1fr 90px", gap: "10px" }}
            >
              <span className="w-2 h-2 rounded-full block flex-shrink-0" style={{ background: dotColor }} />
              <span className="font-mono text-[12px] font-medium text-[var(--navy)] truncate">{a.nombre}</span>
              <span className="text-[11px] text-[var(--text-3)] truncate">{a.sociedad_nombre.split(" ")[0]}</span>
              <div className="h-1.5 rounded-full overflow-hidden bg-[var(--muted)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--blue), var(--bl-accent))" }}
                />
              </div>
              <div className="text-right">
                <span className="font-mono text-[12px] font-medium text-[var(--foreground)]">€{a.ing}</span>
                {" "}
                <span className="text-[11px] text-[var(--text-3)]">{a.sal} sal.</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fleet Table + Bookings */}
      <div className="grid xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <FleetTable />
        </div>
        <div>
          <RecentBookings />
        </div>
      </div>
    </div>
  );
}
