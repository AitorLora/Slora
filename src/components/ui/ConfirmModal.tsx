"use client";

interface Props {
  open: boolean;
  titulo: string;
  mensaje: string;
  labelConfirmar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmModal({ open, titulo, mensaje, labelConfirmar = "Eliminar", onConfirmar, onCancelar }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(10,37,64,0.5)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}
    >
      <div className="w-[400px] max-w-[90vw] rounded-xl shadow-2xl overflow-hidden" style={{ background: "var(--surface)" }}>
        <div className="px-5 pt-5 pb-4">
          <p className="text-[15px] font-semibold mb-1.5" style={{ color: "var(--foreground)" }}>{titulo}</p>
          <p className="text-[13px]" style={{ color: "var(--text-3)" }}>{mensaje}</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-lg border text-[13px] font-medium transition-colors hover:bg-[var(--muted)]"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="px-4 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
            style={{ background: "var(--red-text)" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
