/* Copia automática en Google Drive: sube el mismo .zip de la copia completa (pagos + comprobantes) a una carpeta propia de tu Drive.
   Usa el permiso más chico de Google ("drive.file"): la app sólo ve los archivos que ella misma creó, no el resto de tu Drive.
   Necesita un "ID de cliente" de Google (gratis, se crea una sola vez: ver la guía en Configuración). */
'use strict';
window.Drive = (() => {
  const K = 'rofac_pagos_drive', CARPETA = 'Farmacia Roma · Copias de Pagos', QUEDAN = 8;
  const API = 'https://www.googleapis.com/drive/v3', SUBIR = 'https://www.googleapis.com/upload/drive/v3';
  const est = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } };
  const guardarEst = x => { try { localStorage.setItem(K, JSON.stringify(Object.assign(est(), x))); } catch (e) { /* */ } };
  const clientId = () => (CFG().drive_client_id || '').trim();
  const cadaDias = () => Math.max(1, +CFG().drive_cada || 7);
  let TOKEN = null, VENCE = 0, cargando = null;

  function cargarGoogle() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return cargando = cargando || new Promise((ok, mal) => {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => ok(); s.onerror = () => { cargando = null; mal(new Error('No se pudo conectar con Google. ¿Hay internet?')); };
      document.head.appendChild(s);
    });
  }
  /* permiso de Google: la primera vez pide elegir la cuenta y aceptar; después es un toque */
  async function token(pedirCuenta) {
    if (TOKEN && Date.now() < VENCE - 60000) return TOKEN;
    if (!clientId()) throw new Error('Falta el ID de cliente de Google (Configuración > Copia automática en Google Drive)');
    await cargarGoogle();
    return new Promise((ok, mal) => {
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId(), scope: 'https://www.googleapis.com/auth/drive.file',
        callback: r => { if (r && r.access_token) { TOKEN = r.access_token; VENCE = Date.now() + (+r.expires_in || 3600) * 1000; guardarEst({ conectado: true }); ok(TOKEN); } else mal(new Error('Google no dio permiso' + (r && r.error ? ' (' + r.error + ')' : ''))); },
        error_callback: e => mal(new Error(e && e.type === 'popup_closed' ? 'Se cerró la ventana de Google sin aceptar' : 'Google no dio permiso')),
      });
      tc.requestAccessToken({ prompt: pedirCuenta || !est().conectado ? 'consent' : '' });
    });
  }
  async function g(url, opt = {}) {
    const r = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: 'Bearer ' + await token() }, opt.headers || {}) }));
    if (r.status === 401) { TOKEN = null; throw new Error('Google pidió volver a conectar: tocá "Conectar con Google Drive"'); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error('Google Drive: ' + ((j.error && j.error.message) || r.status)); }
    return r;
  }
  async function carpeta() {
    const e = est();
    if (e.carpeta) { try { const r = await (await g(`${API}/files/${e.carpeta}?fields=id,trashed`)).json(); if (r.id && !r.trashed) return r.id; } catch (x) { /* se busca o se crea */ } }
    const q = encodeURIComponent(`name = '${CARPETA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const l = await (await g(`${API}/files?q=${q}&fields=files(id)`)).json();
    let id = l.files && l.files[0] && l.files[0].id;
    if (!id) id = (await (await g(`${API}/files?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: CARPETA, mimeType: 'application/vnd.google-apps.folder' }) })).json()).id;
    guardarEst({ carpeta: id });
    return id;
  }
  /* sube la copia completa; quedan las últimas 8 */
  async function subir(aviso = true) {
    const z = await SRV.copiaZip(), nombre = `Pagos Farmacia Roma ${hoy()} ${new Date().toTimeString().slice(0, 5).replace(':', '-')}.zip`;
    if (aviso) toast('Subiendo la copia a Google Drive…');
    const dir = await carpeta(), meta = { name: nombre, parents: [dir], mimeType: 'application/zip' };
    const ini = await g(`${SUBIR}/files?uploadType=resumable&fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'application/zip' }, body: JSON.stringify(meta) });
    const loc = ini.headers.get('Location');
    let r;
    if (loc) r = await (await g(loc, { method: 'PUT', headers: { 'Content-Type': 'application/zip' }, body: z })).json();
    else {      // sin dirección de subida: en un solo paso
      const fd = new FormData(); fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' })); fd.append('file', z);
      r = await (await g(`${SUBIR}/files?uploadType=multipart&fields=id`, { method: 'POST', body: fd })).json();
    }
    try {
      const l = await (await g(`${API}/files?q=${encodeURIComponent(`'${dir}' in parents and trashed = false`)}&orderBy=createdTime desc&fields=files(id,name)&pageSize=50`)).json();
      for (const f of (l.files || []).slice(QUEDAN)) await g(`${API}/files/${f.id}`, { method: 'DELETE' });
    } catch (e) { console.warn('No se pudieron borrar copias viejas de Drive', e); }
    guardarEst({ ultima: new Date().toISOString(), ultima_nombre: nombre, tam: z.size });
    await SRV.marcarCopia();
    if (aviso) toast('Copia guardada en tu Google Drive ✓');
    return r;
  }
  const debe = () => { const u = est().ultima; return !u || (Date.now() - new Date(u).getTime()) / 864e5 >= cadaDias() - 0.04; };
  const listo = () => !!clientId() && !!est().conectado;

  /* tarjeta de Configuración */
  function tarjeta(el) {
    const e = est(), id = clientId();
    const guia = `<details class="dr-guia" ${id ? '' : 'open'}><summary><b>Cómo conseguir el "ID de cliente" de Google</b> (una sola vez, unos 10 minutos, gratis)</summary><ol>
      <li>Entrá desde la compu a <b>console.cloud.google.com</b> con tu Gmail y aceptá las condiciones.</li>
      <li>Arriba, <b>Seleccionar un proyecto → Proyecto nuevo</b>. Nombre: <i>Farmacia Roma Pagos</i> → <b>Crear</b>.</li>
      <li>En el buscador de arriba escribí <b>Google Drive API</b>, entrá y tocá <b>Habilitar</b>.</li>
      <li>Menú ☰ → <b>APIs y servicios → Pantalla de consentimiento de OAuth</b> (o "Google Auth Platform") → <b>Comenzar</b>. Nombre de la app: <i>Pagos Farmacia Roma</i>, tu mail, Público: <b>Externo</b>, aceptá y <b>Crear</b>.</li>
      <li>En <b>Público</b> → <b>Usuarios de prueba → Agregar usuarios</b>: poné tu Gmail (el de tu Drive) y guardá.</li>
      <li>En <b>Clientes</b> (o Credenciales) → <b>Crear cliente</b> → Tipo: <b>Aplicación web</b>. En <b>Orígenes autorizados de JavaScript</b> agregá <b>https://rofac.github.io</b> → <b>Crear</b>.</li>
      <li>Copiá el <b>ID de cliente</b> (termina en <i>.apps.googleusercontent.com</i>), pegalo acá abajo y tocá Guardar.</li>
      <li>Al conectar, Google puede decir <i>"Google no verificó esta app"</i>: tocá <b>Continuar</b> (es tu propia app).</li></ol></details>`;
    el.innerHTML = `<p style="margin-top:0;line-height:1.5">La copia completa (pagos y comprobantes) se sube sola a una carpeta de tu <b>Google Drive</b> llamada <i>${CARPETA}</i>. Quedan las últimas ${QUEDAN}.
      La app sólo puede ver esa carpeta, no el resto de tu Drive.</p>
      ${id ? `<div class="${listo() && !debe() ? 'pos' : 'neg'}" style="font-weight:700;margin-bottom:10px">${e.ultima ? `Última copia en Drive: ${fechaHora(e.ultima.slice(0, 16).replace('T', ' '))}` : listo() ? 'Conectado. Todavía no se subió ninguna copia.' : 'Todavía no está conectado con tu Google Drive.'}</div>
        <div class="inl"><button class="btn verde" id="drSub">${ico('nube')} ${listo() ? 'Subir copia ahora' : 'Conectar con Google Drive'}</button>
          <label class="inl" style="gap:6px;margin:0">Subir cada <select id="drCada">${[1, 3, 7].map(n => `<option value="${n}" ${n === cadaDias() ? 'selected' : ''}>${n === 1 ? 'día' : n + ' días'}</option>`).join('')}</select></label>
          ${listo() ? '<button class="btn chico" id="drDes">Desconectar</button>' : ''}</div>
        <div class="ayuda" style="margin-top:8px">Cuando toque, al abrir la app aparece arriba <b>"Subir copia a Drive"</b>: es un toque y listo (Google no deja subir sin que la app esté abierta).</div>` : ''}
      <div style="margin-top:12px"><label>ID de cliente de Google</label><div class="inl" style="flex-wrap:nowrap;gap:6px"><input id="drId" value="${esc(id)}" placeholder="123456-abc….apps.googleusercontent.com" style="flex:1">
        <button class="btn" id="drGu">Guardar</button></div></div>${guia}`;
    $('#drGu', el).onclick = async () => {
      const v = $('#drId', el).value.trim();
      if (v && !/\.apps\.googleusercontent\.com$/.test(v)) return fallo(new Error('El ID de cliente termina en .apps.googleusercontent.com: copialo entero'));
      try { await api('/api/config', { drive_client_id: v }); ME = await api('/api/me'); if (v !== id) { TOKEN = null; guardarEst({ conectado: false, carpeta: '' }); } toast('Guardado'); tarjeta(el); } catch (x) { fallo(x); }
    };
    if ($('#drSub', el)) $('#drSub', el).onclick = async () => { try { await token(!listo()); await subir(); tarjeta(el); } catch (x) { fallo(x); tarjeta(el); } };
    if ($('#drCada', el)) $('#drCada', el).onchange = async ev => { try { await api('/api/config', { drive_cada: ev.target.value }); ME = await api('/api/me'); toast('Listo'); } catch (x) { fallo(x); } };
    if ($('#drDes', el)) $('#drDes', el).onclick = () => { TOKEN = null; try { google.accounts.oauth2.revoke && TOKEN && google.accounts.oauth2.revoke(TOKEN); } catch (x) { /* */ } guardarEst({ conectado: false }); toast('Desconectado de Google Drive'); tarjeta(el); };
  }
  /* aviso en el Inicio cuando toca subir la copia */
  function enganchar(main) {
    if (!listo() || !debe() || !SRV.resumen().pagos) return false;
    const d = document.createElement('div'); d.className = 'card dr-aviso';
    d.innerHTML = `<b style="flex:1 1 220px">${ico('nube')} Ya toca subir la copia a tu Google Drive${est().ultima ? ` (la última fue el ${dmy(est().ultima.slice(0, 10))})` : ''}.</b>
      <button class="btn verde">${ico('nube')} Subir copia a Drive</button>`;
    d.querySelector('button').onclick = async ev => { ev.target.disabled = true; try { await subir(); d.remove(); } catch (x) { fallo(x); ev.target.disabled = false; } };
    main.prepend(d);
    return true;
  }
  return { tarjeta, subir, enganchar, listo, debe, _est: est };
})();
