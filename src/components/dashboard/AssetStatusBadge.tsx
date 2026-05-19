import type { AssetStatus } from "@/lib/mock-data";

const config: Record<AssetStatus, { label: string; color: string; bg: string; dot: string }> = {
  ACTIVO:        { label: "Disponible",    color: "var(--green-text)", bg: "var(--green-bg)",  dot: "var(--green)" },
  ALERTA:        { label: "Mantenimiento", color: "var(--amber-text)", bg: "var(--amber-bg)",  dot: "var(--amber)" },
  MANTENIMIENTO: { label: "Baja",          color: "var(--text-3)",     bg: "var(--gray-bg)",   dot: "var(--text-3)" },
};

export function AssetStatusBadge({ estado }: { estado: AssetStatus }) {
  const { label, color, bg, dot } = config[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color, background: bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
      {label}
    </span>
  );
}
