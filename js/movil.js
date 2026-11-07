/* Lo propio del celular: el "servidor" adentro de la app, comprobantes, compartir desde el banco, copias e instalación. */
'use strict';

const LISTO = SRV.abrir().then(() => SRV.copiaDiaria()).catch(e => {
  document.addEventListener('DOMContentLoaded', () => { document.body.innerHTML = `<div style="padding:30px;font:16px Arial;line-height:1.5"><b>No se pudo abrir la app.</b><br>${String(e && e.message || e)}<br><br>
    Probá cerrarla y abrirla de nuevo. Si sigue igual, mandale esta pantalla a RoFac.</div>`; });
  throw e;
});
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* que el celular no borre los datos solo */ }

/* ---------- todos los pedidos que antes iban a la PC ahora los atiende la app */
const _fetch = window.fetch.bind(window);
window.fetch = async (url, opt = {}) => {
  const u = typeof url === 'string' ? url : url.url;
  if (!/(^|\/)api\//.test(new URL(u, location.href).pathname)) return _fetch(url, opt);
  await LISTO;
  try {
    const r = await SRV.atender((opt.method || 'GET').toUpperCase(), u, opt.body);
    return new Response(JSON.stringify(r ?? {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    if (!(e instanceof SRV.ErrorNegocio)) console.error(e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: e.status || (e instanceof SRV.ErrorNegocio ? 400 : 500), headers: { 'Content-Type': 'application/json' } });
  }
};

/* ---------- comprobantes: las fotos se buscan adentro del celular */
const URLS = new Map();
async function urlComprobante(archivo, chica) {
  const k = archivo + (chica ? '#t' : '');
  if (!URLS.has(k)) { const b = await SRV.comprobante(archivo, chica); URLS.set(k, b ? URL.createObjectURL(b) : ''); }
  return URLS.get(k);
}
const parteCmp = s => { const m = String(s || '').match(/\/comprobante\/([^?#]+)(\?t=1)?/); return m ? [decodeURIComponent(m[1]), !!m[2]] : null; };
function resolverImagenes(raiz) {
  const imgs = raiz.matches && raiz.matches('img[src*="/comprobante/"]') ? [raiz] : raiz.querySelectorAll ? raiz.querySelectorAll('img[src*="/comprobante/"]') : [];
  for (const img of imgs) {
    const p = parteCmp(img.getAttribute('src')); if (!p) continue;
    img.removeAttribute('src'); img.dataset.cmp = p[0];
    urlComprobante(p[0], p[1]).then(u => { if (u) img.src = u; else img.alt = 'No está el archivo'; });
  }
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) resolverImagenes(n); }).observe(document.documentElement, { childList: true, subtree: true });
/* "Compartir / guardar" un comprobante: en el celular abre para mandarlo por WhatsApp, mail o guardarlo */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href*="/comprobante/"]'); if (!a) return;
  e.preventDefault(); e.stopPropagation();
  const p = parteCmp(a.getAttribute('href')); if (p) compartirComprobante(p[0]);
}, true);
async function compartirComprobante(archivo) {
  const b = await SRV.comprobante(archivo); if (!b) return toast('No se encontró el archivo del comprobante', 'err');
  descargarArchivo(b, SRV.nombreDescarga(archivo));
}
async function descargarArchivo(blob, nombre, texto) {
  const f = new File([blob], nombre, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) {
    try { await navigator.share({ files: [f], title: nombre, text: texto || '' }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  toast('Se guardó en Descargas: ' + nombre);
  return true;
}
/* ver el comprobante grande (las fotos y también los PDF, dibujados en la pantalla) */
async function abrirComprobante(archivo) {
  const b = await SRV.comprobante(archivo); if (!b) return toast('No se encontró el archivo del comprobante', 'err');
  const pdf = /\.pdf$/i.test(archivo);
  const m = modal('Comprobante', `<div id="vcC" style="text-align:center">${pdf ? '<p class="muted">Abriendo el PDF…</p>' : `<img src="${await urlComprobante(archivo)}" style="max-width:100%;border-radius:8px">`}</div>`,
    `<button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="vcS">${ico('bajar')} Compartir / guardar</button>`, 'xl', 'recibo');
  $('#vcS', m).onclick = () => compartirComprobante(archivo);
  if (pdf) try {
    const doc = await (await cargarPdfJs()).getDocument({ data: new Uint8Array(await b.arrayBuffer()) }).promise, c = $('#vcC', m); c.innerHTML = '';
    for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
      const pg = await doc.getPage(i), vp0 = pg.getViewport({ scale: 1 }), esc_ = Math.min(2.5, (Math.min(innerWidth, 900) * (devicePixelRatio || 1)) / vp0.width), vp = pg.getViewport({ scale: esc_ });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height; cv.style.cssText = 'width:100%;border:1px solid var(--borde,#ddd);border-radius:6px;margin-bottom:8px;background:#fff';
      c.appendChild(cv); await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    }
  } catch (e) { $('#vcC', m).innerHTML = `<p class="muted">No se pudo mostrar el PDF acá. Tocá "Compartir / guardar" para abrirlo con otra app.</p>`; }
}
let _pdfjs = null;
function cargarPdfJs() {
  return _pdfjs = _pdfjs || new Promise((ok, mal) => {
    if (window.pdfjsLib) return ok(window.pdfjsLib);
    const s = document.createElement('script'); s.src = 'lib/pdf.js';
    s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.js'; ok(pdfjsLib); };
    s.onerror = () => { _pdfjs = null; mal(new Error('No se pudo cargar el lector de PDF')); };
    document.head.appendChild(s);
  });
}

/* ---------- COMPARTIR desde la app del banco o de Mercado Pago */
const sinTilde = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
async function textoPdf(file) {
  const doc = await (await cargarPdfJs()).getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise; let t = '';
  for (let i = 1; i <= Math.min(doc.numPages, 3); i++) { const c = await (await doc.getPage(i)).getTextContent(); t += c.items.map(x => x.str + (x.hasEOL ? '\n' : ' ')).join('') + '\n'; }
  return t;
}
/* lee del comprobante lo que se pueda: importe, N° de operación y a quién se le pagó */
function leerDatos(texto, L) {
  const out = {}, t = String(texto || '').replace(/ /g, ' ');
  const MONTO = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:,\\d{1,2})?)';
  const conClave = t.match(new RegExp('(?:importe|monto|total|transferiste|pagaste|enviaste|valor)[^\\d$\\n]{0,40}\\$?\\s*' + MONTO, 'i'));
  const todos = [...t.matchAll(new RegExp('\\$\\s*' + MONTO, 'g'))].map(m => aNum(m[1])).filter(x => x > 0);
  const imp = conClave ? aNum(conClave[1]) : todos.length ? Math.max(...todos) : 0;
  if (imp > 0) out.importe = imp;
  const op = t.match(/(?:operaci[oó]n|comprobante|transacci[oó]n|referencia|n[°º]\s*de\s*control|c[oó]digo de identificaci[oó]n)[^A-Za-z0-9]{0,25}(?:de mercado pago[^A-Za-z0-9]{0,5})?(?:n[°º.]*\s*:?\s*)?([A-Z0-9-]*\d[A-Z0-9-]{3,})/i);
  if (op) out.operacion = op[1];
  const tn = sinTilde(t), dig = t.replace(/\D/g, '');
  const prov = (L.prov || []).filter(p => p.activo).find(p => {
    const n = sinTilde(p.nombre).replace(/\b(drogueria|s\.?a\.?|srl|sa)\b/g, '').trim();
    return (n.length >= 4 && tn.includes(n)) || (p.cuit && p.cuit.replace(/\D/g, '').length >= 10 && dig.includes(p.cuit.replace(/\D/g, ''))) ||
      (p.cbu && p.cbu.replace(/\s/g, '').length >= 6 && (/^\d+$/.test(p.cbu.replace(/\s/g, '')) ? dig.includes(p.cbu.replace(/\s/g, '')) : tn.includes(sinTilde(p.cbu.trim()))));
  });
  if (prov) { out.tipo = 'PROVEEDOR'; out.proveedor_id = prov.id; }
  const emp = !prov && (L.emp || []).filter(e => e.activo).find(e => { const n = sinTilde(e.nombre); return n.length >= 5 && tn.includes(n); });
  if (emp) { out.tipo = 'SUELDO'; out.empleado_id = emp.id; }
  const fm = t.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/); if (fm) { const f = `${fm[3]}-${fm[2]}-${fm[1]}`; if (f <= hoy() && f >= sumarDias(hoy(), -60)) out.fecha = f; }
  return out;
}
async function recibirCompartido() {
  const c = await SRV.idbGet('compartidos', 'ultimo'); if (!c) return;
  await SRV.idbDel('compartidos', 'ultimo');
  if (Date.now() - (c.cuando || 0) > 30 * 60000) return;      // algo viejo que quedó colgado
  const archivos = (c.archivos || []).filter(f => f && f.size);
  if (!archivos.length) return toast('No llegó ningún archivo. Compartí el comprobante como imagen o PDF.', 'err');
  const L = await listas(true);
  let texto = [c.title, c.text].filter(Boolean).join('\n');
  for (const f of archivos) if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) { try { texto += '\n' + await textoPdf(f); } catch (e) { /* se carga a mano */ } }
  const d = leerDatos(texto, L);
  if (!d.operacion) for (const f of archivos) { const m = String(f.name || '').match(/(\d{8,})/); if (m) { d.operacion = m[1]; break; } }   // Mercado Pago: comprobante_<N° de operación>.png
  history.replaceState(null, '', location.pathname + '#principal');
  cargarPago(Object.assign({ archivos }, d), () => recargar());
  toast(d.importe ? 'Revisá los datos que se leyeron del comprobante y elegí ' + (d.proveedor_id ? 'desde dónde pagaste' : 'a quién le pagaste') : 'Comprobante adjuntado: completá el importe y a quién le pagaste');
}

/* ---------- copias de seguridad */
const fechaHora = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}` : '';
async function hacerCopia() {
  try {
    toast('Armando la copia con todos los comprobantes…');
    const z = await SRV.copiaZip(), nom = `pagos_respaldo_${hoy()}.zip`;
    if (await descargarArchivo(z, nom, 'Copia de Pagos Farmacia')) { await SRV.marcarCopia(); toast('Copia lista. Guardala en tu Google Drive.'); }
    if ($('#cfCopia')) tarjetaCopia($('#cfCopia'));
  } catch (e) { fallo(e); }
}
async function tarjetaCopia(el) {
  const ult = SRV.ultimaCopia(), n = SRV.resumen(), copias = await SRV.copiasInternas();
  const dias = ult ? Math.round((new Date(hoy()) - new Date(ult.slice(0, 10))) / 864e5) : null;
  el.innerHTML = `<p style="margin-top:0;line-height:1.5">Todo queda guardado <b>en este celular</b> (${n.pagos} pagos, ${n.adjuntos} comprobantes). Si se rompe, se pierde o borrás los datos de Chrome sin copia, <b>se pierde todo</b>.
      Hacé una copia una vez por semana y guardala en tu <b>Google Drive</b> (o mandátela por WhatsApp).</p>
    <div class="${dias === null || dias > 7 ? 'neg' : 'pos'}" style="font-weight:700;margin-bottom:10px">${ult ? `Última copia: ${fechaHora(ult)} (hace ${dias} día${dias === 1 ? '' : 's'})` : 'Todavía no hiciste ninguna copia'}</div>
    <div class="inl"><button class="btn verde" id="cpHacer">${ico('bajar')} Hacer copia ahora</button>
      <label class="btn" style="margin:0">${ico('db')} Traer datos de la PC / restaurar una copia<input type="file" id="cpRest" accept=".zip,.db,application/zip,application/octet-stream" hidden></label></div>
    <div class="ayuda" style="margin-top:10px;line-height:1.5"><b>Para pasar lo que tenés en la compu:</b> en el programa de la PC, Configuración > <b>"Descargar una copia completa"</b> (.zip).
      Mandate ese archivo por WhatsApp o subilo a Drive, y acá tocá <b>"Traer datos de la PC"</b> y elegilo. Pasan todos los pagos, proveedores, sueldos y comprobantes.</div>
    ${copias.length ? `<details style="margin-top:10px"><summary class="muted">Copias automáticas adentro del celular (${copias.length})</summary>
      ${copias.map(c => `<div class="inl" style="margin:6px 0"><span class="sp">${c.k.startsWith('dia-') ? 'Del día ' + dmy(c.fecha) : 'Antes de restaurar · ' + c.fecha.slice(0, 10).split('-').reverse().join('/') + ' ' + c.fecha.slice(11, 16).replace('-', ':')}</span>
        <button class="btn chico" data-vc="${esc(c.k)}">Volver a esta</button></div>`).join('')}<div class="muted chico">Son sin los comprobantes nuevos; sirven si borraste algo sin querer.</div></details>` : ''}`;
  $('#cpHacer', el).onclick = hacerCopia;
  $('#cpRest', el).onchange = async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!await confirmar(`Se van a <b>reemplazar todos los datos de este celular</b> por los de <b>${esc(f.name)}</b>.<br><br>Antes se guarda una copia automática de lo que hay ahora, por si acaso.`, 'Sí, reemplazar', true)) return;
    try { toast('Leyendo la copia…'); const r = await SRV.restaurar(f); olvidarListas(); ME = await api('/api/me'); $('#gymNom').textContent = CFG().nombre_negocio;
      toast(`Listo: ${r.pagos} pagos, ${r.proveedores} proveedores${r.archivos !== undefined ? ', ' + r.archivos + ' comprobantes' : ''}`); ir('principal'); } catch (x) { fallo(x); }
  };
  el.onclick = async e => {
    const b = e.target.closest('[data-vc]'); if (!b) return;
    if (!await confirmar('¿Volver a como estaba en esa copia? Lo que cargaste después se pierde (antes se guarda una copia de lo de ahora).', 'Volver a esa copia', true)) return;
    try { await SRV.volverACopia(b.dataset.vc); olvidarListas(); toast('Listo'); ir('principal'); } catch (x) { fallo(x); }
  };
}
window.RespaldoUI = { enganchar(main, id, irConfig) {
  if (id !== 'principal') return;
  const ult = SRV.ultimaCopia(), n = SRV.resumen(); if (!n.pagos) return;
  const dias = ult ? Math.round((new Date(hoy()) - new Date(ult.slice(0, 10))) / 864e5) : null;
  if (dias !== null && dias <= 7) return;
  const d = document.createElement('div'); d.className = 'card'; d.style.cssText = 'background:#fff4e0;border:1px solid #f2c27a;color:#7a4a00;display:flex;flex-wrap:wrap;gap:10px;align-items:center';
  d.innerHTML = `<b style="flex:1 1 220px">${dias === null ? 'Todavía no hiciste ninguna copia de seguridad.' : `Hace ${dias} días que no hacés una copia.`} Si el celular se rompe o se pierde, sin copia se pierde todo.</b>
    <button class="btn verde">${ico('bajar')} Hacer copia</button>`;
  d.querySelector('button').onclick = hacerCopia;
  main.prepend(d);
} };

/* ---------- instalar la app */
let PEDIDO_INSTALAR = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); PEDIDO_INSTALAR = e; if ($('#cfApp')) tarjetaApp($('#cfApp')); });
window.addEventListener('appinstalled', () => { PEDIDO_INSTALAR = null; toast('¡Listo! Ya tenés Pagos Farmacia en la pantalla del celular'); });
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
async function tarjetaApp(el) {
  let espacio = '';
  try { const e = await navigator.storage.estimate(); espacio = `Ocupa ${(e.usage / 1048576).toFixed(1).replace('.', ',')} MB en el celular.`; } catch (e) { /* */ }
  let persiste = false; try { persiste = await navigator.storage.persisted(); } catch (e) { /* */ }
  el.innerHTML = instalada() ? `<p style="margin-top:0">✅ Instalada. Se abre desde el ícono, <b>sin internet</b>. Para cargar un pago desde el banco o Mercado Pago: en el comprobante tocá <b>Compartir</b> y elegí <b>Pagos Farmacia</b>.</p>`
    : PEDIDO_INSTALAR ? `<p style="margin-top:0">Instalala para tenerla con su ícono y para que aparezca en <b>Compartir</b> desde el banco.</p><button class="btn verde" id="apInst">${ico('bajar')} Instalar la app</button>`
    : `<p style="margin-top:0;line-height:1.5">Para instalarla: en Chrome tocá el menú <b>⋮</b> y elegí <b>"Instalar app"</b> o <b>"Agregar a la pantalla principal"</b>.
       En iPhone: Safari > <b>Compartir</b> > "Agregar a pantalla de inicio" (en iPhone no aparece en Compartir desde el banco).</p>`;
  el.insertAdjacentHTML('beforeend', `<div class="muted chico">${espacio} ${persiste ? 'El celular no la borra solo.' : ''} · Pagos Farmacia ${esc(marcaTexto())}</div>`);
  if ($('#apInst', el)) $('#apInst', el).onclick = async () => { PEDIDO_INSTALAR.prompt(); await PEDIDO_INSTALAR.userChoice; PEDIDO_INSTALAR = null; tarjetaApp(el); };
}

/* ---------- arranque */
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(e => console.warn('sw', e));
(async () => {
  await LISTO;
  for (let i = 0; i < 100 && (typeof ME === 'undefined' || !ME); i++) await new Promise(r => setTimeout(r, 100));
  if (/[?&]compartido=1/.test(location.search) || await SRV.idbGet('compartidos', 'ultimo')) {
    history.replaceState(null, '', location.pathname + location.hash);
    recibirCompartido().catch(fallo);
  }
})();
