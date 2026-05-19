"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "▣" },
  { label: "Reservas",  href: "/reservas",  icon: "📋" },
  { label: "Flota",     href: "/flota",     icon: "⛵" },
  { label: "Presupuesto", href: "/presupuesto", icon: "💶" },
  { label: "Sociedades", href: "/sociedades", icon: "🏢" },
  { label: "Reportes",  href: "/reportes",  icon: "📊" },
];

export function Sidebar() {
  const [active, setActive] = useState("/dashboard");

  return (
    <aside
      className="w-[220px] min-h-screen flex flex-col flex-shrink-0 overflow-y-auto"
      style={{ background: "var(--navy)" }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <p className="text-white font-semibold text-[17px] tracking-[-0.3px]">Slora</p>
        <p className="text-[11px] mt-0.5" style={{ color: "#7BAFD4" }}>
          Puerto del Molinar · Palma
        </p>
      </div>

      {/* Nav */}
      <div className="px-3 pt-4">
        <p className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.1em]" style={{ color: "#4A7FA5" }}>
          Navegación
        </p>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setActive(item.href)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-all w-full",
                active === item.href
                  ? "font-medium text-white"
                  : "text-[#8BB4D4] hover:text-[#C5DCF0]"
              )}
              style={
                active === item.href
                  ? { background: "rgba(26,110,191,0.25)" }
                  : { background: "transparent" }
              }
              onMouseEnter={(e) => {
                if (active !== item.href)
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                if (active !== item.href)
                  (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span className="text-base w-[18px] text-center flex-shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="mt-auto px-3 pb-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div
          className="text-center text-[11px] py-1.5 px-2 rounded-full"
          style={{ background: "rgba(26,110,191,0.2)", color: "#7BAFD4" }}
        >
          10 unidades activas
        </div>
      </div>
    </aside>
  );
}
