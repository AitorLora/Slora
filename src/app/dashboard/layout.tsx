import { AppShell } from "@/components/layout/AppShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell title="Dashboard" subtitle="Temporada 2026 · Abr – Sep">
      {children}
    </AppShell>
  );
}
