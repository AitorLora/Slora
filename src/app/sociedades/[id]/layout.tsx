import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SociedadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfiles")
    .select("sociedad_id, rol")
    .eq("id", user.id)
    .single();

  if (profile?.rol !== "master" && profile?.sociedad_id !== id) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
