// Worker dedicado a los cron de Slora.
//
// El Worker principal (OpenNext) solo atiende HTTP, así que los cron triggers
// no pueden ejecutar su lógica directamente. Este Worker minúsculo se dispara
// con los triggers de Cloudflare y llama por HTTP a los endpoints del Worker
// principal, autenticándose con CRON_SECRET (igual que hacía Vercel Cron).

interface Env {
  CRON_SECRET: string;
  TARGET_URL: string;
}

async function hit(env: Env, path: string): Promise<void> {
  const res = await fetch(`${env.TARGET_URL}${path}`, {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  console.log(`cron ${path} -> ${res.status}`);
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // */10 → sync-ical (traer reservas externas iCal); resto (*/5) → update-states
    const path =
      event.cron === "*/10 * * * *" ? "/api/cron/sync-ical" : "/api/cron/update-states";
    ctx.waitUntil(hit(env, path));
  },
};
