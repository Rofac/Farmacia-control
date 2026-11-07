/* ================================================================ PAGOS con su comprobante (proveedores, gastos y sueldos) */
const TIPO_TXT = { PROVEEDOR: 'Proveedor', GASTO: 'Gasto', SUELDO: 'Sueldo' };
const TIPO_ICO = { PROVEEDOR: 'edificio', GASTO: 'peso', SUELDO: 'users' };
const compUrl = (a, chica) => `/comprobante/${a}${chica ? '?t=1' : ''}`;
const esPdf = a => /\.pdf$/i.test(a || '');
const miniComp = (archivo, cls = 'cmp-mini') => !archivo ? `<span class="${cls} sin" title="Sin comprobante">${ico('clip')}</span>`
  : esPdf(archivo) ? `<span class="${cls} pdf" data-ver="${archivo}" title="Ver comprobante">PDF</span>` : `<img class="${cls}" src="${compUrl(archivo, true)}" data-ver="${archivo}" title="Ver comprobante" loading="lazy">`;
const categoriasGasto = () => (CFG().categorias_gasto || 'Otros').split(',').map(s => s.trim()).filter(Boolean);
const quienPago = p => p.tipo === 'PROVEEDOR' ? p.proveedor : p.tipo === 'SUELDO' ? p.empleado : p.categoria;
const verArchivo = a => abrirComprobante(a);
let CACHE = {};
async function listas(forzar) {
  if (forzar || !CACHE.t || Date.now() - CACHE.t > 20000) {
    const [prov, cuentas, emp] = await Promise.all([api('/api/proveedores'), api('/api/cuentas'), api('/api/empleados')]);
    CACHE = { prov, cuentas, emp, t: Date.now() };
  }
  return CACHE;
}
const olvidarListas = () => { CACHE = {}; };

async function subirAdjuntos(destino, archivos) {
  if (!archivos.length) return;
  const fd = new FormData();
  Object.entries(destino).forEach(([k, v]) => fd.append(k, v));
  archivos.forEach(f => fd.append('archivos', f, f.name || 'captura.png'));
  const r = await fetch('/api/adjuntos', { method: 'POST', body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'No se pudo subir el comprobante');
}

/* zona para adjuntar: elegir archivo, sacar foto (celular), arrastrar o pegar (Ctrl+V) */
function zonaAdjuntos(el, existentes = [], alBorrar, iniciales = []) {
  const pend = [...iniciales];
  el.innerHTML = `<div class="adj-zona" tabindex="0"><div class="adj-l"></div>
    <label class="btn chico pri" style="margin:0">${ico('clip')} Adjuntar foto o PDF<input type="file" accept="image/*,application/pdf,.pdf" multiple hidden></label>
    <span class="muted chico">o sacale una foto · o desde la app del banco: <b>Compartir › Pagos Farmacia</b></span></div>`;
  const z = $('.adj-zona', el), lista = $('.adj-l', el);
  const pintar = () => {
    lista.innerHTML = existentes.map(a => `<div class="adj-i">${miniComp(a.archivo, 'adj-img')}<span class="chico">${esc(a.nombre || 'comprobante')}</span>
        ${alBorrar ? `<button type="button" class="ab" data-bx="${a.id}" style="color:var(--rojo)" title="Quitar">${ico('trash')}</button>` : ''}</div>`).join('')
      + pend.map((f, i) => `<div class="adj-i nuevo">${f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? '<span class="adj-img pdf">PDF</span>' : `<img class="adj-img" src="${URL.createObjectURL(f)}">`}
        <span class="chico">${esc(f.name || 'captura')}</span><button type="button" class="ab" data-bp="${i}" style="color:var(--rojo)">${ico('x')}</button></div>`).join('');
  };
  const agregar = fs => { [...fs].forEach(f => { if (f && f.size) pend.push(f); }); pintar(); };
  $('input', el).onchange = e => { agregar(e.target.files); e.target.value = ''; };
  z.ondragover = e => { e.preventDefault(); z.classList.add('sobre'); };
  z.ondragleave = () => z.classList.remove('sobre');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('sobre'); agregar(e.dataTransfer.files); };
  const pegar = e => { const fs = [...(e.clipboardData || {}).files || []]; if (fs.length && el.isConnected) { e.preventDefault(); agregar(fs.map((f, i) => f.name && f.name !== 'image.png' ? f : new File([f], `captura_${i + 1}.png`, { type: f.type }))); toast('Captura pegada'); } };
  document.addEventListener('paste', pegar);
  lista.onclick = async e => {
    const v = e.target.closest('[data-ver]'); if (v) return verArchivo(v.dataset.ver);
    const p = e.target.closest('[data-bp]'); if (p) { pend.splice(+p.dataset.bp, 1); return pintar(); }
    const b = e.target.closest('[data-bx]'); if (b && await confirmar('¿Quitar este comprobante?', 'Quitar')) { await api('/api/adjuntos/' + b.dataset.bx, undefined, 'DELETE'); existentes = existentes.filter(a => a.id !== +b.dataset.bx); pintar(); alBorrar && alBorrar(); }
  };
  pintar();
  return { pendientes: () => pend, soltar: () => document.removeEventListener('paste', pegar) };
}

/* nueva cuenta / persona que paga, desde el formulario */
function nuevaCuenta(luego) {
  const m = modal('Nueva cuenta o persona', `<div class="g2"><div><label>Nombre</label><input id="ncN" placeholder="Ej. Banco Nación, Galicia, Suegro"></div>
    <div><label>Es</label><select id="ncT"><option value="BANCO">Una cuenta bancaria mía / de la farmacia</option><option value="TERCERO">Otra persona que paga por mí</option><option value="EFECTIVO">Efectivo</option></select></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ncOk">Guardar</button>`, '', 'card');
  $('#ncOk', m).onclick = async () => { try { const r = await api('/api/cuentas', { nombre: $('#ncN', m).value, tipo: $('#ncT', m).value }); m.cerrar(); olvidarListas(); luego(r.id); } catch (e) { fallo(e); } };
}

/* ---------------------------------------------------------------- cargar / modificar un pago */
async function cargarPago(pre = {}, luego) {
  const L = await listas(true);
  const p = pre.id ? await api('/api/pagos/' + pre.id) : { tipo: pre.tipo || 'PROVEEDOR', fecha: pre.fecha || hoy(), medio: 'TRANSFERENCIA', importe: pre.importe || '', periodo: pre.periodo, adelanto: pre.adelanto ? 1 : 0, proveedor_id: pre.proveedor_id || '',
    empleado_id: pre.empleado_id || '', categoria: pre.categoria || '', operacion: pre.operacion || '', concepto: pre.concepto || '', cuenta_id: (() => { try { return +localStorage.getItem('ultCuenta') || ''; } catch (e) { return ''; } })(), adjuntos: [] };
  let tipo = p.tipo;
  const provs = L.prov.filter(x => x.activo || x.id === p.proveedor_id), emps = L.emp.filter(x => x.activo || x.id === p.empleado_id);
  const ctas = L.cuentas.filter(x => x.activo || x.id === p.cuenta_id);
  const cats = categoriasGasto(); if (p.categoria && !cats.includes(p.categoria)) cats.push(p.categoria);
  const mesAnt = (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (d.getDate() < 15 ? 1 : 0)); return MESES[d.getMonth()] + ' ' + d.getFullYear(); })();
  const m = modal(pre.id ? 'Modificar pago' : 'Cargar pago', `
    <div class="seg grande" id="cpT">${['PROVEEDOR', 'GASTO', 'SUELDO'].map(t => `<button type="button" data-t="${t}" class="${t === tipo ? 'act' : ''}">${ico(TIPO_ICO[t])} ${t === 'PROVEEDOR' ? 'A un proveedor' : t === 'GASTO' ? 'Un gasto' : 'Un sueldo'}</button>`).join('')}</div>
    <div class="g" style="margin-top:12px">
      <div class="t-PROVEEDOR"><label>Proveedor</label><select id="cpP"><option value="">Elegí…</option>${provs.map(x => `<option value="${x.id}" ${x.id === +p.proveedor_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
      <div class="t-GASTO"><label>Gasto</label><select id="cpC"><option value="">Elegí…</option>${cats.map(c => `<option ${c === p.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="t-SUELDO"><label>Empleado</label><div class="inl" style="flex-wrap:nowrap;gap:6px"><select id="cpE"><option value="">Elegí…</option>${emps.map(x => `<option value="${x.id}" ${x.id === +p.empleado_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
        <button type="button" class="ab" id="cpEN" title="Agregar empleado">${ico('plus')}</button></div></div>
      <div><label>Fecha del pago</label><input type="date" id="cpF" value="${esc(p.fecha)}"></div>
      <div><label>Importe</label>${campoMonto('id="cpI" style="font-size:18px;font-weight:800"', p.importe)}</div>
      <div><label>Cómo</label><select id="cpM">${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}" ${k === p.medio ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Desde dónde salió la plata</label><div class="inl" style="flex-wrap:nowrap;gap:6px"><select id="cpK"><option value="">Elegí…</option>${ctas.map(x => `<option value="${x.id}" ${x.id === +p.cuenta_id ? 'selected' : ''}>${esc(x.nombre)}${x.tipo === 'TERCERO' ? ' (paga por mí)' : ''}</option>`).join('')}</select>
        <button type="button" class="ab" id="cpKN" title="Agregar banco o persona">${ico('plus')}</button></div></div>
      <div><label>N° de operación / comprobante</label><input id="cpO" value="${esc(p.operacion || '')}" placeholder="Lo dice el comprobante del banco"></div>
      <div class="t-SUELDO"><label>Período</label><input id="cpPe" value="${esc(p.periodo ?? (pre.id ? '' : 'Semana al vie ' + dmy(viernesDe(hoy())).slice(0, 5)))}" placeholder="Ej. Semana al vie 06/11, aguinaldo"></div>
      <div class="t-SUELDO full"><label class="chk"><input type="checkbox" id="cpAd" ${p.adelanto ? 'checked' : ''}> Es un <b>adelanto</b> (se descuenta de lo que cobra el viernes)</label></div>
      <div class="full"><label>Detalle (opcional)</label><input id="cpD" value="${esc(p.concepto || '')}" placeholder="Ej. Resumen del 03/11 · alquiler de noviembre"></div></div>
    <div id="cpInfo"></div>
    <label style="margin-top:12px">Comprobante</label><div id="cpA"></div>
    ${!pre.id ? '<label class="chk t-PROVEEDOR" style="margin-top:10px"><input type="checkbox" id="cpAc"> Ya figura acreditado en la cuenta del proveedor</label>' : ''}`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn verde grande" id="cpOk">${ico('check')} Guardar pago</button>`, 'xl', 'recibo');
  const zona = zonaAdjuntos($('#cpA', m), p.adjuntos, pre.id ? () => {} : null, pre.archivos || []);
  const cerrar0 = m.cerrar; m.cerrar = () => { zona.soltar(); cerrar0(); };
  const pintarTipo = () => { $$('.t-PROVEEDOR,.t-GASTO,.t-SUELDO', m).forEach(x => x.style.display = x.classList.contains('t-' + tipo) ? '' : 'none'); info(); };
  const info = () => {
    const el = $('#cpInfo', m); el.innerHTML = '';
    if (tipo === 'PROVEEDOR') { const x = L.prov.find(v => v.id === +$('#cpP', m).value); if (!x) return;
      el.innerHTML = `<div class="info-prov"><span>Le debés <b class="${x.saldo > 0 ? 'neg' : ''}">${money(Math.max(0, x.saldo))}</b>${x.vence_semana > 0.009 ? ` · vence en los próximos 7 días <b>${money(x.vence_semana)}</b>` : ''}${x.saldo < -0.009 ? ` · tenés <b class="pos">${money(-x.saldo)}</b> a favor` : ''}</span>
        ${x.vence_semana > 0.009 && !pre.id ? `<button type="button" class="btn chico" id="cpTodo">Pagar ${money0(x.vence_semana)}</button>` : ''}</div>`;
      if ($('#cpTodo', m)) $('#cpTodo', m).onclick = () => { $('#cpI', m).value = fmtIn(x.vence_semana); };
      if (x.cbu) el.innerHTML += `<div class="muted chico" style="margin-top:4px">CBU / alias: <b>${esc(x.cbu)}</b></div>`; }
    if (tipo === 'SUELDO') { const x = L.emp.find(v => v.id === +$('#cpE', m).value); if (!x) return;
      api(`/api/sueldos/${x.id}?viernes=${$('#cpF', m).value || hoy()}`).then(s => {
        if (+$('#cpE', m).value !== x.id) return;
        el.innerHTML = `<div class="info-prov"><span>${s.a_pagar > 0.009 ? `A pagar el viernes ${dmy(s.viernes).slice(0, 5)}: <b>${money(s.a_pagar)}</b>` : `<b class="pos">Ya cobró de más ${money(-s.a_pagar)}</b> (se le descuenta la semana que viene)`}</span>
          ${s.a_pagar > 0.009 && !pre.id ? `<button type="button" class="btn chico" id="cpTodo">Poner ${money0(s.a_pagar)}</button>` : ''}</div>` + (x.cbu ? `<div class="muted chico" style="margin-top:4px">CBU / alias: <b>${esc(x.cbu)}</b></div>` : '');
        if ($('#cpTodo', m)) $('#cpTodo', m).onclick = () => { $('#cpI', m).value = fmtIn(s.a_pagar); };
      }).catch(() => {}); }
  };
  $('#cpT', m).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; $$('#cpT button', m).forEach(x => x.classList.toggle('act', x === b)); pintarTipo(); };
  $('#cpP', m).onchange = info; $('#cpE', m).onchange = info; $('#cpF', m).addEventListener('change', () => tipo === 'SUELDO' && info());
  $('#cpM', m).onchange = () => { if ($('#cpM', m).value === 'EFECTIVO') { const ef = ctas.find(c => c.tipo === 'EFECTIVO'); if (ef) $('#cpK', m).value = ef.id; } };
  $('#cpKN', m).onclick = () => nuevaCuenta(async id => { const l = await api('/api/cuentas'); $('#cpK', m).innerHTML = '<option value="">Elegí…</option>' + l.filter(x => x.activo).map(x => `<option value="${x.id}">${esc(x.nombre)}${x.tipo === 'TERCERO' ? ' (paga por mí)' : ''}</option>`).join(''); $('#cpK', m).value = id; });
  $('#cpEN', m).onclick = () => editarEmpleado({}, async id => { const l = await api('/api/empleados'); L.emp = l; $('#cpE', m).innerHTML = '<option value="">Elegí…</option>' + l.filter(x => x.activo).map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join(''); $('#cpE', m).value = id; info(); });
  pintarTipo();
  setTimeout(() => (tipo === 'PROVEEDOR' && !$('#cpP', m).value ? $('#cpP', m) : $('#cpI', m)).focus(), 60);
  $('#cpOk', m).onclick = async () => {
    const d = { id: pre.id, tipo, proveedor_id: $('#cpP', m).value, categoria: $('#cpC', m).value, empleado_id: $('#cpE', m).value, fecha: $('#cpF', m).value, importe: $('#cpI', m).value,
      medio: $('#cpM', m).value, cuenta_id: $('#cpK', m).value, operacion: $('#cpO', m).value, periodo: tipo === 'SUELDO' ? $('#cpPe', m).value : '', concepto: $('#cpD', m).value,
      adelanto: tipo === 'SUELDO' && $('#cpAd', m).checked ? 1 : 0,
      acreditado: $('#cpAc', m) && $('#cpAc', m).checked ? 1 : 0 };
    const btn = $('#cpOk', m); btn.disabled = true;
    try {
      const r = await apiConfirmando('/api/pagos', d); if (!r) { btn.disabled = false; return; }
      try { await subirAdjuntos({ pago_id: r.id }, zona.pendientes()); } catch (x) { fallo(x); }
      try { if (d.cuenta_id) localStorage.setItem('ultCuenta', d.cuenta_id); } catch (e) {}
      const sinComp = !zona.pendientes().length && !(p.adjuntos || []).length && d.medio !== 'EFECTIVO';
      m.cerrar(); olvidarListas(); toast(pre.id ? 'Pago modificado' : sinComp ? 'Pago guardado (sin comprobante: lo podés adjuntar después)' : 'Pago guardado con su comprobante');
      luego && luego(r.id);
    } catch (x) { fallo(x); btn.disabled = false; }
  };
}

/* ---------------------------------------------------------------- ver un pago: para mandar el comprobante cuando lo reclaman */
async function verPago(id, luego) {
  const p = await api('/api/pagos/' + id);
  const L = await listas();
  const prov = p.proveedor_id ? L.prov.find(x => x.id === p.proveedor_id) : null;
  const datos = `${CFG().nombre_negocio || ''}: pago a ${quienPago(p)} de ${money(p.importe)} el ${dmy(p.fecha)} por ${(MEDIOS[p.medio] || p.medio).toLowerCase()}${p.cuenta ? ' desde ' + p.cuenta : ''}${p.operacion ? '. N° de operación: ' + p.operacion : ''}.`;
  const m = modal(`${TIPO_TXT[p.tipo]}: ${esc(quienPago(p))}`, `
    <div class="pago-cab"><div><div class="cob-tot" style="text-align:left;margin:0">${money(p.importe)}</div>
      <div class="muted">${dmy(p.fecha)} · ${esc(MEDIOS[p.medio] || p.medio)}${p.cuenta ? ' desde <b>' + esc(p.cuenta) + '</b>' : ''}${p.operacion ? ' · N° op. <b>' + esc(p.operacion) + '</b>' : ''}</div>
      ${p.periodo ? `<div class="muted">Período: ${esc(p.periodo)}</div>` : ''}${p.concepto ? `<div>${esc(p.concepto)}</div>` : ''}
      ${p.estado === 'ANULADO' ? `<div class="neg">ANULADO: ${esc(p.anulado_motivo)}</div>` : ''}</div>
      ${p.tipo === 'PROVEEDOR' && p.estado === 'ACTIVO' ? `<div class="acr-box ${p.acreditado ? 'si' : 'no'}">${p.acreditado ? `${ico('okc')} Acreditado<br><small>${dmy(p.acreditado_fecha)}</small>` : `${ico('reloj')} Sin acreditar<br><small>${(n => n === 0 ? 'cargado hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`)(Math.round((new Date(hoy()) - new Date(p.fecha)) / 864e5))}</small>`}
        <button class="btn chico" id="vpAc">${p.acreditado ? 'Marcar sin acreditar' : ico('check') + ' Ya lo acreditaron'}</button></div>` : ''}</div>
    <div class="vp-comp">${p.adjuntos.map(a => esPdf(a.archivo) ? `<div class="vp-c"><div class="vp-pdf" data-ab="${a.archivo}">PDF<small>${esc(a.nombre || 'comprobante')}</small></div>
        <div class="inl"><button class="btn chico" data-ab="${a.archivo}">${ico('ext')} Abrir</button><a class="btn chico" href="${compUrl(a.archivo)}?descargar=1">${ico('bajar')} Compartir / guardar</a></div></div>`
      : `<div class="vp-c"><img src="${compUrl(a.archivo)}" data-ab="${a.archivo}"><div class="inl"><button class="btn chico" data-ab="${a.archivo}">${ico('ext')} Abrir grande</button>
        <a class="btn chico" href="${compUrl(a.archivo)}?descargar=1">${ico('bajar')} Compartir / guardar</a></div></div>`).join('') || `<div class="vacio-g" style="padding:20px">${ico('clip')}<p>Este pago no tiene comprobante.</p></div>`}</div>
    <div id="vpAd" style="margin-top:8px"></div>`,
    `${p.estado === 'ACTIVO' ? `<button class="btn rojo" id="vpAn">${ico('xc')} Anular</button>` : `<button class="btn" id="vpRe">Volver a activar</button>`}
     <button class="btn" id="vpCp">${ico('copiar')} Copiar datos</button>${prov && prov.telefono ? `<button class="btn" id="vpWa">${ico('wa')} WhatsApp</button>` : ''}
     <button class="btn" id="vpEd">${ico('lapiz')} Modificar</button><button class="btn pri" data-cerrar>Cerrar</button>`, 'xl', 'recibo');
  const zona = zonaAdjuntos($('#vpAd', m), []);
  const sub = document.createElement('button'); sub.className = 'btn chico verde'; sub.textContent = 'Guardar comprobante'; sub.style.marginTop = '6px';
  $('#vpAd', m).appendChild(sub);
  sub.onclick = async () => { if (!zona.pendientes().length) return toast('Primero adjuntá la foto o el PDF', 'err'); try { await subirAdjuntos({ pago_id: id }, zona.pendientes()); zona.soltar(); m.cerrar(); toast('Comprobante guardado'); verPago(id, luego); luego && luego(); } catch (x) { fallo(x); } };
  const c0 = m.cerrar; m.cerrar = () => { zona.soltar(); c0(); };
  m.onclick = e => { const a = e.target.closest('[data-ab]'); if (a) verArchivo(a.dataset.ab); };
  if ($('#vpAc', m)) $('#vpAc', m).onclick = async () => { await api(`/api/pagos/${id}/acreditado`, { acreditado: p.acreditado ? 0 : 1 }); m.cerrar(); toast(p.acreditado ? 'Marcado sin acreditar' : 'Marcado como acreditado'); olvidarListas(); luego && luego(); };
  $('#vpCp', m).onclick = async () => { try { await navigator.clipboard.writeText(datos); toast('Datos copiados: pegalos en WhatsApp o en el mail'); } catch (e) { prompt('Copiá estos datos:', datos); } };
  if ($('#vpWa', m)) $('#vpWa', m).onclick = () => { let t = String(prov.telefono).replace(/\D/g, ''); if (!t.startsWith('54')) t = '549' + t.replace(/^0/, '').replace(/^(\d{2,4})15/, '$1');
    toast('Se abre WhatsApp con el texto. Para mandar el comprobante tocá "Compartir / guardar" y elegí WhatsApp.'); window.open(`https://wa.me/${t}?text=${encodeURIComponent(datos)}`, '_blank'); };
  $('#vpEd', m).onclick = () => { m.cerrar(); cargarPago({ id }, () => { verPago(id, luego); luego && luego(); }); };
  if ($('#vpAn', m)) $('#vpAn', m).onclick = async () => { const mot = await pedirMotivo('Anular el pago', 'No se borra: queda anotado como ANULADO con el motivo.'); if (!mot) return;
    try { await api(`/api/pagos/${id}/anular`, { motivo: mot }); m.cerrar(); toast('Pago anulado'); olvidarListas(); luego && luego(); } catch (x) { fallo(x); } };
  if ($('#vpRe', m)) $('#vpRe', m).onclick = async () => { await api(`/api/pagos/${id}/reactivar`, {}); m.cerrar(); toast('Pago activo de nuevo'); luego && luego(); };
}

function pedirMotivo(titulo, texto) {
  return new Promise(res => {
    const m = modal(titulo, `<div style="line-height:1.5;margin-bottom:12px">${texto}</div><label>Motivo</label><input id="mtM" placeholder="Ej. lo cargué dos veces">`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn rojo" id="mtOk">${ico('xc')} Anular</button>`, '', 'xc');
    m.alCerrar = () => res(null);
    const ok = () => { const v = $('#mtM', m).value.trim(); if (v.length < 3) return toast('Escribí el motivo', 'err'); m.alCerrar = null; m.cerrar(); res(v); };
    $('#mtOk', m).onclick = ok; $('#mtM', m).addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}

/* ---------------------------------------------------------------- lista de pagos: el buscador de comprobantes */
const FP = { tipo: '', proveedor_id: '', cuenta_id: '', desde: '', hasta: '', q: '', acreditado: '' };
const filaPago = p => `<tr data-g="${p.id}" class="${p.estado === 'ANULADO' ? 'anulado' : ''} ${p.demorado ? 'demorado' : ''}"><td class="chico">${dmy(p.fecha)}</td>
  <td><span class="tipo-i t${p.tipo}">${ico(TIPO_ICO[p.tipo])}</span> <b>${esc(quienPago(p))}</b>${p.periodo ? ` <span class="muted chico">· ${esc(p.periodo)}</span>` : ''}${p.concepto ? `<div class="muted chico">${esc(p.concepto)}</div>` : ''}</td>
  <td class="r"><b>${money(p.importe)}</b></td><td class="chico">${esc(MEDIOS[p.medio] || p.medio)}${p.cuenta ? `<div class="muted">${esc(p.cuenta)}${p.cuenta_tipo === 'TERCERO' ? ' (pagó por mí)' : ''}</div>` : ''}</td>
  <td class="chico ocultar-movil">${esc(p.operacion || '')}</td><td>${miniComp(p.adjunto)}${p.n_adjuntos > 1 ? `<span class="muted chico"> +${p.n_adjuntos - 1}</span>` : ''}</td>
  <td>${p.tipo === 'PROVEEDOR' && p.estado === 'ACTIVO' ? (p.acreditado ? '<span class="pill ATENDIDO">Acreditado</span>' : `<button class="btn chico ${p.demorado ? 'rojo' : ''}" data-ac="${p.id}" title="El proveedor ya lo reflejó en su cuenta">${ico('check')} Acreditado</button>`) : p.estado === 'ANULADO' ? '<span class="pill rojo">Anulado</span>' : ''}</td></tr>`;
P.pagos = async (main, arg) => {
  if (arg === 'sinacreditar') { Object.assign(FP, { tipo: 'PROVEEDOR', acreditado: '0', desde: '', hasta: '' }); history.replaceState(null, '', '#pagos'); }
  if (arg && arg.startsWith && arg.startsWith('prov')) { Object.assign(FP, { tipo: 'PROVEEDOR', proveedor_id: arg.slice(4), acreditado: '' }); history.replaceState(null, '', '#pagos'); }
  const L = await listas();
  main.innerHTML = cabecera('recibo', 'Pagos y comprobantes', 'Todo lo que pagaste, con su comprobante. Buscá por proveedor, fecha, importe o N° de operación.',
    `<button class="btn" id="fpCsv">${ico('bajar')} Excel</button><button class="btn verde grande" id="fpN">${ico('plus')} Cargar pago</button>`) +
    `<div class="card filtros">
      <div class="pos-bus" style="flex:1 1 260px"><span>${ico('lupa')}</span><input id="fpQ" placeholder="Buscar: importe (ej. 1.250.000), N° de operación, nombre…" value="${esc(FP.q)}"></div>
      <div class="seg" id="fpT">${[['', 'Todos'], ['PROVEEDOR', 'Proveedores'], ['GASTO', 'Gastos'], ['SUELDO', 'Sueldos']].map(([k, t]) => `<button data-v="${k}" class="${FP.tipo === k ? 'act' : ''}">${t}</button>`).join('')}</div>
      <select id="fpP" style="width:auto"><option value="">Todos los proveedores</option>${L.prov.map(x => `<option value="${x.id}" ${String(x.id) === String(FP.proveedor_id) ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
      <select id="fpK" style="width:auto"><option value="">Desde cualquier cuenta</option>${L.cuentas.map(x => `<option value="${x.id}" ${String(x.id) === String(FP.cuenta_id) ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select>
      <div class="inl" style="gap:6px;flex-wrap:nowrap"><span class="muted chico">Desde</span><input type="date" id="fpD" value="${FP.desde}" style="width:150px"><span class="muted chico">hasta</span><input type="date" id="fpH" value="${FP.hasta}" style="width:150px"></div>
      <label class="chk"><input type="checkbox" id="fpA" ${FP.acreditado === '0' ? 'checked' : ''}> Sólo sin acreditar</label></div>
    <div class="card"><div id="fpRes" class="muted chico" style="margin-bottom:6px"></div><div class="tabla-x" id="fpL"></div></div>`;
  const url = (base = '/api/pagos') => base + '?' + new URLSearchParams(Object.entries(FP).filter(([, v]) => v !== '')).toString();
  const cargar = async () => {
    const l = await api(url());
    const t = l.filter(p => p.estado === 'ACTIVO').reduce((a, p) => a + p.importe, 0);
    $('#fpRes').innerHTML = `${l.length} pago${l.length === 1 ? '' : 's'} · total <b>${money(t)}</b>${l.some(p => p.demorado) ? ` · <span class="neg">${l.filter(p => p.demorado).length} hace más de ${CFG().dias_aviso_acreditar || 5} días sin acreditar</span>` : ''}`;
    $('#fpL').innerHTML = `<table class="t comp pagos-t"><thead><tr><th>Fecha</th><th>A quién / qué</th><th class="r">Importe</th><th>Cómo / desde</th><th class="ocultar-movil">N° operación</th><th>Comp.</th><th></th></tr></thead>
      <tbody>${l.map(filaPago).join('') || '<tr><td colspan="7" class="vacio">No hay pagos con ese filtro</td></tr>'}</tbody></table>`;
  };
  await cargar();
  let tq;
  $('#fpQ').oninput = e => { FP.q = e.target.value.trim(); clearTimeout(tq); tq = setTimeout(cargar, 250); };
  $('#fpT').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; FP.tipo = b.dataset.v; $$('#fpT button').forEach(x => x.classList.toggle('act', x === b)); cargar(); };
  $('#fpP').onchange = e => { FP.proveedor_id = e.target.value; if (FP.proveedor_id && FP.tipo !== 'PROVEEDOR') { FP.tipo = 'PROVEEDOR'; $$('#fpT button').forEach(x => x.classList.toggle('act', x.dataset.v === 'PROVEEDOR')); } cargar(); };
  $('#fpK').onchange = e => { FP.cuenta_id = e.target.value; cargar(); };
  $('#fpD').onchange = e => { FP.desde = e.target.value; cargar(); };
  $('#fpH').onchange = e => { FP.hasta = e.target.value; cargar(); };
  $('#fpA').onchange = e => { FP.acreditado = e.target.checked ? '0' : ''; cargar(); };
  $('#fpN').onclick = () => cargarPago({ tipo: FP.tipo || 'PROVEEDOR', proveedor_id: FP.proveedor_id }, cargar);
  $('#fpCsv').onclick = () => descargarArchivo(SRV.pagosCsv(new URL(url('/api/pagos.csv'), location.href).searchParams), `pagos_${hoy()}.csv`);
  $('#fpL').onclick = async e => {
    const v = e.target.closest('[data-ver]'); if (v) return verArchivo(v.dataset.ver);
    const a = e.target.closest('[data-ac]'); if (a) { await api(`/api/pagos/${a.dataset.ac}/acreditado`, { acreditado: 1 }); toast('Marcado como acreditado'); olvidarListas(); return cargar(); }
    const r = e.target.closest('[data-g]'); if (r) verPago(+r.dataset.g, cargar);
  };
};
