import { createClient } from "@supabase/supabase-js";

// Cliente con service role key — para procesos server-to-server sin sesión de usuario (crons)
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
