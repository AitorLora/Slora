"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface InvestorShellProps {
  children: React.ReactNode;
  sociedad: string;
}

export function InvestorShell({ children, sociedad }: InvestorShellProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>

      {/* Topbar */}
      <header
        className="flex items-center justify-between px-6 py-3.5 border-b sticky top-0 z-10 print:hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.3px]" style={{ color: "var(--navy)" }}>
              Slora
            </p>
            <p className="text-[11px]" style={{ color: "var(--text-3)" }}>Puerto del Molinar · Palma</p>
          </div>
          <div className="w-px h-7 mx-1" style={{ background: "var(--border)" }} />
          <span
            className="text-[13px] font-semibold px-2.5 py-1 rounded-lg"
            style={{ background: "var(--blue-light)", color: "var(--navy)" }}
          >
            {sociedad}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-[0.07em] px-2 py-0.5 rounded-full"
            style={{ background: "var(--muted)", color: "var(--text-3)" }}
          >
            Portal inversor
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium transition-colors hover:bg-[var(--muted)]"
            style={{ borderColor: "var(--border)", color: "var(--text-2)", background: "var(--surface)" }}
          >
            ⎙ Imprimir
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-colors"
            style={{ background: "#EF4444", color: "#fff", border: "1px solid #DC2626" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#DC2626"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "#EF4444"; }}
          >
            ↪ Cerrar sesión
          </button>
        </div>
      </header>

      {/* Cabecera solo visible al imprimir */}
      <div className="hidden print:flex items-center justify-between px-6 py-4 mb-2 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <p className="text-[18px] font-bold" style={{ color: "var(--navy)" }}>Slora — {sociedad}</p>
          <p className="text-[12px]" style={{ color: "var(--text-3)" }}>Portal del inversor</p>
        </div>
        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
          {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Contenido */}
      <main className="max-w-5xl mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
