interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

export function KpiCard({ label, value, sub, accent = false }: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        borderTop: accent ? "3px solid var(--blue)" : "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <p className="text-[11px] uppercase tracking-[0.05em] mb-1.5" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
      <p
        className="font-mono text-[26px] font-semibold tracking-[-1px] leading-none"
        style={{ color: "var(--foreground)" }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1" style={{ color: "var(--text-3)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
