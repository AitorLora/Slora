# Despliegue de Slora (Cloudflare Workers)

Guía completa para desplegar este proyecto, ya sea en tu cuenta o en la de un
cliente. Léela entera la primera vez; luego úsala como checklist.

---

## 0. Cómo está montado (contexto)

Slora NO es una app simple: son **dos Workers de Cloudflare**.

| Worker | Qué hace | Config |
|--------|----------|--------|
| `slora` | La app Next.js (web + API) | [wrangler.jsonc](wrangler.jsonc) |
| `slora-cron` | Mini-worker que cada 5-10 min "toca el timbre" a la app para lanzar los crons | [cron/wrangler.jsonc](cron/wrangler.jsonc) |

¿Por qué dos? El Worker de la app (generado por OpenNext) solo atiende HTTP, así
que no puede ejecutar los `scheduled()` de Cloudflare. El worker de cron sí, y
llama por HTTP a `/api/cron/*` de la app. Más detalle en [cron/index.ts](cron/index.ts).

Además se despliega con un **adaptador**: `@opennextjs/cloudflare`. Cloudflare no
entiende Next.js de forma nativa (a diferencia de Vercel), así que este adaptador
traduce el resultado de `next build` a algo que el Worker entiende.

---

## 1. El modelo de variables (LO MÁS IMPORTANTE)

En Cloudflare hay **dos entornos distintos** y cada variable vive en uno (o en los dos):

- **Build** → cuando se *compila* el código. Aquí solo se necesitan las `NEXT_PUBLIC_*`
  (se "hornean" dentro del JavaScript que va al navegador).
- **Runtime** → cuando la app *se ejecuta*. Aquí van los secretos del servidor.

> Regla: `NEXT_PUBLIC_*` → entorno **build**. Todo lo demás → entorno **runtime** (como *Secret*).

### Tabla de todas las variables

| Variable | Entorno | ¿Secreto? | De dónde sale el valor |
|----------|---------|-----------|------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | build | no (público) | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | no (público) | Supabase → Settings → API (`anon`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | build | no (público) | `node scripts/gen-vapid.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | **sí** | Supabase → Settings → API (`service_role`) |
| `CRON_SECRET` | runtime | **sí** | genéralo: `openssl rand -hex 24` |
| `VAPID_PRIVATE_KEY` | runtime | **sí** | `node scripts/gen-vapid.js` (la pareja del público) |
| `VAPID_SUBJECT` | runtime | no | `mailto:tu-email@dominio.com` |
| `WEBHOOK_SECRET` | runtime | **sí** | lo eliges tú |
| `URL_ICAL_SAMBOAT` | runtime | no | URL del feed iCal de SamBoat (si la hay) |
| `URL_ICAL_CLICKANDBOAT` | runtime | no | URL del feed iCal de Click&Boat (si la hay) |

El worker de cron necesita además: `CRON_SECRET` (el mismo que la app) y `TARGET_URL`
(la URL pública del worker de la app, ya definida en `cron/wrangler.jsonc`).

Plantilla local de referencia: [.env.example](.env.example). En desarrollo, todas
van en `.env.local` (que **nunca** se sube a git).

---

## 2. Camino A — Desplegar desde tu PC (recomendado para solo dev)

Es lo más simple y lo que hacemos durante el desarrollo.

```bash
# Una sola vez: autenticarte
npx wrangler login

# Subir los secretos de runtime (una vez por cada uno; pega el valor cuando lo pida)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put WEBHOOK_SECRET
# (y URL_ICAL_* si usas feeds reales)

# Desplegar la app (build + deploy juntos)
npm run cf:deploy

# Desplegar el worker de cron (la primera vez y cuando cambies cron/)
npx wrangler secret put CRON_SECRET --config cron/wrangler.jsonc
npm run cf:deploy:cron
```

Las `NEXT_PUBLIC_*` se leen de tu `.env.local` automáticamente durante `cf:deploy`.

---

## 3. Camino B — Desplegar desde Git (Workers Builds, auto-deploy al hacer push)

Es el equivalente al "import" de Vercel: conectas el repo y despliega solo en cada push.

### 3.1 Conectar
Dashboard → *Workers & Pages* → *Create* → *Connect to Git* → elige el repo.

### 3.2 Build configuration (¡crítico!)
Cloudflare por defecto pone `npm run build`, que **NO sirve** (genera `.next/`, no
`.open-next/`). Cámbialo a:

| Campo | Valor |
|-------|-------|
| Build command | `npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |

> Error típico si no lo cambias:
> `Could not find compiled Open Next config, did you run the build command?`

### 3.3 Variables de build
En *Settings → Build → Variables and secrets*, añade las **`NEXT_PUBLIC_*`** (texto plano):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

### 3.4 Secretos de runtime
En *Settings → Variables and Secrets* (a nivel de Worker, NO el de Build), añade como
**Secret**: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`,
`VAPID_SUBJECT`, `WEBHOOK_SECRET` (+ `URL_ICAL_*` si aplica).

### 3.5 El worker de cron NO lo cubre Workers Builds
Workers Builds despliega solo la app. El cron lo despliegas **a mano una vez** desde
una máquina con wrangler (ver Camino A, último bloque). Solo hay que rehacerlo si
cambias algo en `cron/`.

---

## 4. Supabase (la base de datos)

Reutiliza el proyecto Supabase existente (pasando sus claves) o crea uno nuevo. Si es
nuevo, ejecuta estos SQL en *Supabase → SQL Editor* (no hay migraciones automáticas):

1. [supabase-constraint-no-solape.sql](supabase-constraint-no-solape.sql) — evita overbooking.
2. [supabase-push-subscriptions.sql](supabase-push-subscriptions.sql) — tabla de notificaciones push.

Y crea las tablas/datos de la app (activos, sociedades, reservas...) según el esquema.

---

## 5. Checklist para entregar a OTRA cuenta (cliente)

Lo más limpio: que el cliente use **su** GitHub y **su** Cloudflare, y tú solo le pasas
los valores. Pasos:

- [ ] El cliente conecta el repo a su Cloudflare (Camino B, paso 3.1).
- [ ] Build command = `npx opennextjs-cloudflare build` (paso 3.2).
- [ ] Variables de build `NEXT_PUBLIC_*` (paso 3.3).
- [ ] Secretos de runtime (paso 3.4).
- [ ] Primer deploy de la app (push o Retry).
- [ ] Editar `cron/wrangler.jsonc` → `TARGET_URL` con la nueva URL del worker.
- [ ] Desplegar el worker de cron + su `CRON_SECRET` (paso 3.5).
- [ ] Crear/poblar Supabase y ejecutar los 2 SQL (sección 4).
- [ ] Probar push: suscribir un móvil (campana del header) y esperar a que el cron importe una reserva nueva.

Nada de esto incluye claves en el repositorio: todas las claves se introducen a mano en
cada cuenta (es por seguridad, igual que en Vercel).

---

## 6. Errores comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Could not find compiled Open Next config` | El Build command no genera `.open-next/` | Build command = `npx opennextjs-cloudflare build` |
| App carga pero falla con Supabase / `undefined` | Faltan `NEXT_PUBLIC_*` en build | Añadirlas en *Build → Variables* y re-desplegar |
| Crons dan `401 Unauthorized` | `CRON_SECRET` distinto entre app y worker de cron | Poner el MISMO valor en ambos workers |
| Push no llega pero `sent: 1` | El SO silenció la notificación | Revisar ajustes del dispositivo (no es la app) |
| Push falla / tabla no existe | Falta el SQL de `push_subscriptions` | Ejecutar el SQL en Supabase |
