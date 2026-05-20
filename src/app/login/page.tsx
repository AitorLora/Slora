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
      .from("perfiles")
      .select("rol, sociedad_id")
      .eq("id", user.id)
      .single();

    if (profile?.rol === "inversor" && profile.sociedad_id) {
      router.push(`/sociedades/${profile.sociedad_id}`);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: "radial-gradient(ellipse 80% 60% at 50% 55%, #0D3060 0%, #0A2540 55%, #061828 100%)",
      }}
    >
      <div className="w-full max-w-[360px]">

        {/* Logo */}
        <div className="text-center mb-8">
          <p
            className="text-white"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "76px",
              fontWeight: 300,
              fontStyle: "italic",
              letterSpacing: "0.12em",
              lineHeight: 1,
              textShadow: "0 2px 32px rgba(122,175,212,0.35), 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            Slora
          </p>

          {/* Separador decorativo */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <div style={{ width: "36px", height: "1px", background: "linear-gradient(to right, transparent, #7BAFD4)" }} />
            <span style={{ color: "#7BAFD4", fontSize: "9px", letterSpacing: "0.45em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
              Nautic Management
            </span>
            <div style={{ width: "36px", height: "1px", background: "linear-gradient(to left, transparent, #7BAFD4)" }} />
          </div>
        </div>

        {/* Card glassmorphism */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.09)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 12px 60px rgba(0,0,0,0.4), 0 0 80px rgba(26,110,191,0.12), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <p
            className="mb-1 text-center"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "26px",
              fontWeight: 400,
              color: "rgba(255,255,255,0.95)",
              letterSpacing: "0.02em",
            }}
          >
            Iniciar sesión
          </p>
          <p className="text-[12px] mb-7 text-center" style={{ color: "rgba(122,175,212,0.8)" }}>
            Accede a tu panel de gestión
          </p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] font-medium mb-2 uppercase tracking-widest" style={{ color: "rgba(122,175,212,0.7)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full py-2.5 text-[14px] outline-none transition-all bg-transparent"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  borderBottom: "1px solid rgba(122,175,212,0.35)",
                  caretColor: "#7BAFD4",
                }}
                onFocus={e => (e.currentTarget.style.borderBottomColor = "rgba(122,175,212,0.9)")}
                onBlur={e => (e.currentTarget.style.borderBottomColor = "rgba(122,175,212,0.35)")}
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium mb-2 uppercase tracking-widest" style={{ color: "rgba(122,175,212,0.7)" }}>
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full py-2.5 text-[14px] outline-none transition-all bg-transparent"
                style={{
                  color: "rgba(255,255,255,0.9)",
                  borderBottom: "1px solid rgba(122,175,212,0.35)",
                  caretColor: "#7BAFD4",
                }}
                onFocus={e => (e.currentTarget.style.borderBottomColor = "rgba(122,175,212,0.9)")}
                onBlur={e => (e.currentTarget.style.borderBottomColor = "rgba(122,175,212,0.35)")}
              />
            </div>

            {error && (
              <p className="text-[12px] px-3 py-2 rounded-lg" style={{ color: "#FCA5A5", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.25)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white transition-all disabled:opacity-50 mt-2"
              style={{
                background: "linear-gradient(135deg, #1A6EBF 0%, #0A2540 100%)",
                border: "1px solid rgba(255,255,255,0.12)",
                fontFamily: "var(--font-cormorant)",
                fontSize: "18px",
                fontWeight: 500,
                letterSpacing: "0.06em",
              }}
              onMouseEnter={e => !loading && (e.currentTarget.style.background = "linear-gradient(135deg, #2280D8 0%, #0D3060 100%)")}
              onMouseLeave={e => (e.currentTarget.style.background = "linear-gradient(135deg, #1A6EBF 0%, #0A2540 100%)")}
            >
              {loading ? "Accediendo..." : "Entrar →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
