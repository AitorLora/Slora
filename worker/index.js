// Custom worker de next-pwa: se compila e inyecta (importScripts) dentro del
// service worker generado. Aquí van los handlers de Web Push.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Slora", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Slora";
  const options = {
    body: data.body || "",
    icon: "/jetski.jpg",
    badge: "/favicon.ico",
    tag: data.tag || "slora-reserva",
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: data.url || "/reservas" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/reservas";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        // Si ya hay una ventana de la app abierta, la enfocamos y navegamos.
        if ("focus" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
