"use client";

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimeInput({ value, onChange }: TimeInputProps) {
  const parts = value.split(":");
  const h = parseInt(parts[0] ?? "9", 10);
  const m = parseInt(parts[1] ?? "0", 10);

  function emit(newH: number, newM: number) {
    onChange(`${newH.toString().padStart(2, "0")}:${newM.toString().padStart(2, "0")}`);
  }

  function stepH(dir: 1 | -1) {
    if (h < 8 || h > 22) { emit(Math.min(22, Math.max(8, h)), m); return; }
    const next = h + dir;
    if (next < 8 || next > 22) return;
    emit(next, m);
  }

  function stepM() {
    emit(h, m === 0 ? 30 : 0);
  }

  return (
    <div
      className="inline-flex items-stretch rounded-lg border overflow-hidden select-none"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <span className="flex items-center px-2.5" style={{ color: "var(--text-3)", borderRight: "1px solid var(--border)" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      </span>

      {/* Horas */}
      <div className="flex flex-col items-center" style={{ borderRight: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={() => stepH(1)}
          disabled={h >= 22}
          className="px-4 py-0.5 text-[10px] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 w-full text-center"
          style={{ color: "var(--text-3)" }}
        >▲</button>
        <span
          className="font-mono text-[14px] font-semibold px-4 py-1 tabular-nums"
          style={{ color: "var(--foreground)", minWidth: "36px", textAlign: "center" }}
        >
          {h.toString().padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() => stepH(-1)}
          disabled={h <= 8}
          className="px-4 py-0.5 text-[10px] hover:bg-[var(--muted)] transition-colors disabled:opacity-30 w-full text-center"
          style={{ color: "var(--text-3)" }}
        >▼</button>
      </div>

      <span className="flex items-center px-1 font-mono text-[16px] font-bold" style={{ color: "var(--text-2)" }}>:</span>

      {/* Minutos */}
      <div className="flex flex-col items-center" style={{ borderLeft: "1px solid var(--border)" }}>
        <button
          type="button"
          onClick={stepM}
          className="px-4 py-0.5 text-[10px] hover:bg-[var(--muted)] transition-colors w-full text-center"
          style={{ color: "var(--text-3)" }}
        >▲</button>
        <span
          className="font-mono text-[14px] font-semibold px-4 py-1 tabular-nums"
          style={{ color: "var(--foreground)", minWidth: "36px", textAlign: "center" }}
        >
          {m.toString().padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={stepM}
          className="px-4 py-0.5 text-[10px] hover:bg-[var(--muted)] transition-colors w-full text-center"
          style={{ color: "var(--text-3)" }}
        >▼</button>
      </div>
    </div>
  );
}
