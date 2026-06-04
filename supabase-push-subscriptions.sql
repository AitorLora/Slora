-- ─────────────────────────────────────────────────────────────────────────────
-- Slora Nautic — Tabla de suscripciones Web Push (notificaciones al móvil)
--
-- Ejecutar UNA vez en Supabase → SQL Editor. Idempotente.
--
-- Cada fila es un DISPOSITIVO/navegador suscrito. El servidor (service role)
-- lee todas las filas para enviar el push cuando entra una reserva nueva.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    text NOT NULL UNIQUE,          -- URL única del push service (FCM/Apple/Mozilla)
  p256dh      text NOT NULL,                 -- clave pública del cliente (base64url)
  auth        text NOT NULL,                 -- secreto de autenticación (base64url)
  user_agent  text,                          -- para identificar el dispositivo
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS activado SIN políticas públicas: nadie con la anon key puede leer/escribir.
-- El acceso es exclusivamente vía service role (las rutas /api/push/*), que
-- ignora RLS. Así las suscripciones quedan privadas.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
