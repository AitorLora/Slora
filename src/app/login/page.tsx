"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }

    // Leer perfil para saber a dónde redirigir
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Error al obtener sesión"); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, sociedad_id")
      .eq("id", user.id)
      .single();

    if (profile?.role === "inversor" && profile.sociedad_id) {
      router.push(`/sociedades/${profile.sociedad_id}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--navy)" }}
    >
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-white text-[26px] font-semibold tracking-[-0.5px]">
            SLORA <span style={{ color: "#7BAFD4", fontWeight: 400 }}></span>
          </p>
          
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 shadow-xl" style={{ background: "var(--surface)" }}>
          <p className="text-[16px] font-semibold mb-1" style={{ color: "var(--foreground)" }}>
            Iniciar sesión
          </p>
          <p className="text-[13px] mb-5" style={{ color: "var(--text-3)" }}>
            Accede a tu panel de gestión
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full px-3 py-2.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] transition-colors"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 rounded-lg border text-[13px] outline-none focus:border-[var(--blue)] transition-colors"
                style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
              />
            </div>

            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg" style={{ color: "var(--red-text)", background: "var(--red-bg)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: "var(--blue)" }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "var(--navy-light)")}
              onMouseLeave={e => (e.currentTarget.style.background = "var(--blue)")}
            >
              {loading ? "Accediendo..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
