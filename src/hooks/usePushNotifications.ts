"use client";

import { useCallback, useEffect, useState } from "react";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushState =
  | "loading"      // comprobando estado inicial
  | "unsupported"  // el navegador/dispositivo no soporta push (ej. iOS sin instalar la PWA)
  | "default"      // soportado pero aún no suscrito
  | "denied"       // el usuario bloqueó los permisos
  | "subscribed";  // recibiendo notificaciones

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }
    (async () => {
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "subscribed" : "default");
    })().catch(() => setState("default"));
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !VAPID_PUBLIC) return;
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "default");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
        });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setState(res.ok ? "subscribed" : "default");
    } catch {
      setState("default");
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("default");
    } catch {
      setState("subscribed");
    }
  }, [supported]);

  return { state, supported, subscribe, unsubscribe };
}
