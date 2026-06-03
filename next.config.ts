import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const isDev = process.env.NODE_ENV === "development";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  fallbacks: {
    document: "/offline.html",
  },
  workboxOptions: {
    // Elimina el caché manual antiguo (slora-v2) al activar el nuevo SW.
    // NO pasamos runtimeCaching: usamos los defaults de next-pwa, que cachean
    // navegación, chunks, RSC, imágenes y fuentes (necesario para offline).
    cleanupOutdatedCaches: true,
    skipWaiting: true,
    clientsClaim: true,
  },
});

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-ical"],
};

// En dev usamos Turbopack puro (sin el webpack de next-pwa, que rompe el dev server
// de Next 16). El SW solo se genera/activa en producción.
export default isDev ? nextConfig : withPWA(nextConfig);
