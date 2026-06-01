"use client";

interface Props {
  open: boolean;
  titulo: string;
  mensaje: string;
  labelConfirmar?: string;
  colorConfirmar?: string;
  icono?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ConfirmModal({
  open,
  titulo,
  mensaje,
  labelConfirmar = "Eliminar",
  colorConfirmar,
  icono,
  onConfirmar,
  onCancelar,
}: Props) {
  if (!open) return null;

  const bgConfirmar = colorConfirmar ?? "var(--red-text)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,37,64,0.45)", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancelar(); }}
    >
      <div
        className="w-full max-w-[400px] rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Icono + título */}
        <div className="px-6 pt-6 pb-4">
          {icono && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px] mb-3"
              style={{ background: "var(--muted)" }}>
              {icono}
            </div>
          )}
          <p className="text-[15px] font-semibold leading-snug" style={{ color: "var(--foreground)" }}>
            {titulo}
          </p>
          <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--text-3)" }}>
            {mensaje}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
          <button
            onClick={onCancelar}
            className="px-4 py-2 rounded-xl border text-[13px] font-medium transition-colors hover:bg-[var(--surface)]"
            style={{ borderColor: "var(--border)", color: "var(--text-2)", background: "var(--surface)" }}>
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-white transition-opacity hover:opacity-85"
            style={{ background: bgConfirmar }}>
            {labelConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
