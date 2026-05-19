"use client";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}

const HORAS: string[] = [];
for (let h = 8; h <= 22; h++) {
  HORAS.push(`${h.toString().padStart(2, "0")}:00`);
  if (h < 22) HORAS.push(`${h.toString().padStart(2, "0")}:30`);
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors focus-within:border-[var(--blue)]"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full outline-none bg-transparent text-[13px] cursor-pointer"
        style={{
          color: "var(--foreground)",
          fontFamily: "var(--font-dm-mono)",
          fontWeight: 500,
          border: "none",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        {HORAS.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}
