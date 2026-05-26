"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard, CalendarCheck, Anchor, Calculator, Building2, BarChart3, LogOut, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",   href: "/dashboard",   Icon: LayoutDashboard },
  { label: "Reservas",    href: "/reservas",    Icon: CalendarCheck },
  { label: "Flota",       href: "/flota",       Icon: Anchor },
  { label: "Presupuesto", href: "/presupuesto", Icon: Calculator },
  { label: "Sociedades",  href: "/sociedades",  Icon: Building2 },
  { label: "Reportes",    href: "/reportes",    Icon: BarChart3 },
];

interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function AppShell({ children, title, subtitle, actions }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cierra el menú móvil al cambiar de ruta
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Cierra el menú móvil al hacer resize a desktop
  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <>
        {/* Logo */}
        <div
          className="border-b flex-shrink-0"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          {collapsed && !mobile ? (
            <div className="py-5 flex justify-center">
              <span className="text-white font-bold text-[18px]">S</span>
            </div>
          ) : (
            <div className="px-4 py-5">
              <p className="text-white font-semibold text-[17px] tracking-[-0.3px]">
                Slora <span style={{ color: "#7BAFD4", fontWeight: 400 }}>Nautic</span>
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "#7BAFD4" }}>
                Puerto del Molinar · Palma
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className={cn("pt-4 flex-1", collapsed && !mobile ? "px-2" : "px-3")}>
          <nav className="space-y-0.5">
            {navItems.map(({ label, href, Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed && !mobile ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all w-full",
                    collapsed && !mobile && "justify-center px-2",
                    isActive
                      ? "text-white font-medium"
                      : "text-[#6A9DBF] hover:text-[#C5DCF0] hover:bg-white/5"
                  )}
                  style={isActive ? { background: "rgba(255,255,255,0.1)" } : {}}
                >
                  <Icon size={15} className="flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  {(!collapsed || mobile) && <span className="tracking-[-0.01em]">{label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div
          className={cn(
            "pb-4 pt-3 border-t space-y-2 flex-shrink-0",
            collapsed && !mobile ? "px-2" : "px-3"
          )}
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className={cn("flex items-center", collapsed && !mobile ? "justify-center" : "gap-1")}>
            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] transition-all",
                collapsed && !mobile ? "" : "flex-1"
              )}
              style={{ color: "#6A9DBF" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#FCA5A5"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#6A9DBF"; }}
            >
              <LogOut size={14} strokeWidth={1.8} className="flex-shrink-0" />
              {(!collapsed || mobile) && <span className="tracking-[-0.01em]">Cerrar sesión</span>}
            </button>

            {/* Colapsar — solo desktop, inline con logout */}
            {!mobile && !collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                title="Colapsar menú"
                className="flex items-center justify-center p-2 rounded-lg transition-all flex-shrink-0"
                style={{ color: "#4A7FA5" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7BAFD4"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4A7FA5"; }}
              >
                <PanelLeftClose size={14} strokeWidth={1.8} />
              </button>
            )}
            {!mobile && collapsed && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                title="Expandir menú"
                className="flex items-center justify-center p-2 rounded-lg transition-all"
                style={{ color: "#4A7FA5" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#7BAFD4"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4A7FA5"; }}
              >
                <PanelLeftOpen size={14} strokeWidth={1.8} />
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--background)" }}>

      {/* ── Sidebar desktop ── */}
      <aside
        className={cn(
          "hidden lg:flex min-h-screen flex-col flex-shrink-0 overflow-y-auto print:hidden transition-all duration-300",
          collapsed ? "w-[56px]" : "w-[220px]"
        )}
        style={{ background: "var(--navy)" }}
      >
        <SidebarContent />
      </aside>

      {/* ── Sidebar móvil: backdrop ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar móvil: panel deslizante ── */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 w-[220px] flex flex-col overflow-y-auto z-50 print:hidden transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: "var(--navy)" }}
      >
        <SidebarContent mobile />
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header
          className="flex items-center justify-between px-4 lg:px-6 py-3.5 border-b sticky top-0 z-10 print:hidden"
          style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 1px 0 var(--border)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburguesa — solo móvil */}
            <button
              className="lg:hidden flex flex-col gap-[5px] flex-shrink-0 p-1"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú"
            >
              <span className="block w-5 h-[2px] rounded" style={{ background: "var(--foreground)" }} />
              <span className="block w-5 h-[2px] rounded" style={{ background: "var(--foreground)" }} />
              <span className="block w-5 h-[2px] rounded" style={{ background: "var(--foreground)" }} />
            </button>

            <div className="min-w-0">
              <p
                className="text-[15px] lg:text-[16px] font-semibold truncate"
                style={{ color: "var(--foreground)" }}
              >
                {title}
              </p>
              {subtitle && (
                <p className="text-[11px] lg:text-[12px] mt-0.5 truncate" style={{ color: "var(--text-3)" }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0 ml-3">
              {actions}
            </div>
          )}
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
