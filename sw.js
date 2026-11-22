// Service worker de BTC Zonas.
// Archivos de la app: primero la red (para que veas siempre la última versión) y, sin conexión, la copia guardada.
// Librería del gráfico: copia guardada primero.
// Las APIs de precios no pasan por aquí: siempre van en directo.

const VERSION = "btc-zonas-v16";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

const LIBRERIA = "https://cdn.jsdelivr.net/npm/lightweight-charts@4.2.0/dist/lightweight-charts.standalone.production.js";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const peticion = evento.request;
  if (peticion.method !== "GET") return;
  const url = new URL(peticion.url);

  if (url.origin === self.location.origin) {
    evento.respondWith(
      fetch(peticion)
        .then((respuesta) => {
          if (respuesta && respuesta.ok) {
            const copia = respuesta.clone();
            caches.open(VERSION).then((cache) => cache.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() =>
          caches.match(peticion, { ignoreSearch: true })
            .then((guardada) => guardada || caches.match("./index.html"))
        )
    );
    return;
  }

  if (peticion.url === LIBRERIA) {
    evento.respondWith(
      caches.match(peticion).then((guardada) => {
        if (guardada) return guardada;
        return fetch(peticion).then((respuesta) => {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(peticion, copia));
          return respuesta;
        });
      })
    );
  }
});
