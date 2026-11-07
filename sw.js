/* Guarda la app en el celular para que abra sin internet, y recibe los comprobantes que se comparten desde el banco o Mercado Pago.
   Al cambiar VERSION, el celular baja la versión nueva la próxima vez que abre la app con internet. */
const VERSION = 'pag-1.0.1';
const ARCHIVOS = ['./', 'index.html', 'manifest.webmanifest', 'static/estilo.css', 'static/app.js', 'static/pagos.js', 'static/pantallas.js',
  'js/zip.js', 'js/servidor.js', 'js/movil.js', 'lib/sql-wasm.js', 'lib/sql-wasm.wasm', 'lib/pdf.js', 'lib/pdf.worker.js',
  'img/favicon.png', 'img/icono-180.png', 'img/icono-192.png', 'img/icono-512.png', 'img/icono-maskable.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
/* sólo se borran las versiones viejas DE ESTA APP (las otras apps de rofac.github.io comparten el mismo lugar) */
const PREFIJO = VERSION.split('-')[0] + '-';
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith(PREFIJO) && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
/* si no está guardado y la señal es mala, no se queda colgada esperando: a los 8 segundos usa lo que haya */
const conTiempo = (p, ms) => Promise.race([p, new Promise(ok => setTimeout(() => ok(null), ms))]);

/* el comprobante compartido se deja guardado para que la app lo tome al abrir */
const idb = () => new Promise((ok, mal) => {
  const r = indexedDB.open('rofac_pagos', 1);
  r.onupgradeneeded = () => { const d = r.result; for (const t of ['base', 'archivos', 'copias', 'compartidos']) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t); };
  r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
});
async function recibir(req) {
  try {
    const fd = await req.formData(), archivos = fd.getAll('archivos').filter(f => f && typeof f !== 'string');
    const d = await idb();
    await new Promise((ok, mal) => { const tx = d.transaction('compartidos', 'readwrite');
      tx.objectStore('compartidos').put({ archivos, title: fd.get('title') || '', text: fd.get('text') || '', cuando: Date.now() }, 'ultimo');
      tx.oncomplete = ok; tx.onerror = () => mal(tx.error); });
  } catch (e) { /* igual se abre la app */ }
  return Response.redirect('./?compartido=1#principal', 303);
}

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method === 'POST' && u.pathname.endsWith('/compartir')) return e.respondWith(recibir(e.request));
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/comprobante/')) return e.respondWith(new Response('', { status: 204 }));   // las fotos las pone la app
  e.respondWith(caches.open(VERSION).then(async c => {
    const g = await c.match(e.request, { ignoreSearch: true }); if (g) return g;
    const red = fetch(e.request).then(x => { if (x.ok) c.put(e.request, x.clone()); return x; }).catch(() => null);
    const r = await conTiempo(red, 8000);
    return r || (await c.match('index.html')) || (await red) || Response.error();
  }));
});
