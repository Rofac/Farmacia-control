/* ================================================================ utilidades */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => (Number(n) < 0 ? '-$ ' : '$ ') + Math.abs(Number(n || 0)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money0 = n => (Number(n) < 0 ? '-$ ' : '$ ') + Math.abs(Number(n || 0)).toLocaleString('es-AR', { maximumFractionDigits: 0 });
const num = n => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const isoLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const hoy = () => isoLocal(new Date());
const dmy = s => s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : (s || '');
const dm = s => s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : (s || '');
const dmyh = s => s && s.length >= 16 ? `${dmy(s)} ${s.slice(11, 16)}` : dmy(s);
/* el viernes de la semana (sábado a viernes) en que cae una fecha: ese día se pagan los sueldos */
const viernesDe = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return isoLocal(d); };
const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoLocal(d); };
const primeroMes = () => hoy().slice(0, 8) + '01';
const diaSemana = iso => (new Date(iso + 'T12:00:00').getDay() + 6) % 7;        // 0 = lunes
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DIAS_C = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fechaLarga = iso => `${DIAS[diaSemana(iso)]} ${+iso.slice(8, 10)} de ${MESES[+iso.slice(5, 7) - 1].toLowerCase()}`;
const nombreMes = ym => `${MESES[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
const edad = f => { if (!f) return ''; const n = new Date(f + 'T12:00:00'), h = new Date(); let e = h.getFullYear() - n.getFullYear();
  if (h.getMonth() < n.getMonth() || (h.getMonth() === n.getMonth() && h.getDate() < n.getDate())) e--; return e >= 0 && e < 130 ? e : ''; };
let MEDIOS = { TRANSFERENCIA: 'Transferencia', DEPOSITO: 'Depósito', EFECTIVO: 'Efectivo', CHEQUE: 'Cheque', ECHEQ: 'eCheq', DEBITO: 'Débito automático', TARJETA: 'Tarjeta', OTRO: 'Otro' };
const ESTADOS = { PENDIENTE: 'Pendiente', ATENDIDO: 'Atendido', CANCELO: 'Canceló', FALTO: 'Faltó' };
const opciones = (lista, sel, vacio, campo = 'nombre') => (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : '') +
  lista.map(x => `<option value="${x.id}" ${String(x.id) === String(sel ?? '') ? 'selected' : ''}>${esc(x[campo])}</option>`).join('');
const opcMedios = sel => Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
const iniciales = n => (n || '').split(/\s+/).filter(w => w.length > 1 && !/^(de|del|la|el|los|las|y)$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
/* importes como se escriben en Argentina: "29.500" = 29500 · "29.500,50" = 29500,5 · "1250,5" = 1250,5 (igual que el servidor) */
function aNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[$\s\u00a0]/g, '');
  if (!s) return 0;
  const neg = s.startsWith('-'); s = s.replace(/^[+-]/, '');
  if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = (s.match(/,/g).length === 1) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');          // 5.346.894
  else if (/^\d+\.\d{1,2}$/.test(s)) { /* 1250.5: un solo punto con 1 o 2 decimales */ }
  else s = s.replace(/\./g, '');                                              // 534.6894 (puntos mal puestos al corregir) = 5346894
  const x = parseFloat(s);
  return isNaN(x) ? NaN : (neg ? -x : x);
}
/* número para poner en un campo de importe: 29500 -> "29.500" · 1250.5 -> "1.250,5" */
const fmtIn = n => n === null || n === undefined || n === '' || isNaN(+n) ? '' : (+n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
/* campo de importe: texto (no "number", que en algunos navegadores toma 29.500 como 29,5) y se reacomoda al salir */
const campoMonto = (attrs = '', valor = '') => `<input ${attrs} class="monto" inputmode="decimal" autocomplete="off" value="${esc(fmtIn(valor))}" placeholder="$ 0">`;
document.addEventListener('focusout', e => {
  const i = e.target;
  if (i && i.classList && i.classList.contains('monto') && i.value.trim() !== '') { const x = aNum(i.value); if (!isNaN(x)) i.value = fmtIn(x); }
});
/* al entrar al campo se sacan los puntos de miles (así al corregir no se mezclan) y abajo se muestra cómo se va a tomar */
document.addEventListener('focusin', e => {
  const i = e.target;
  if (i && i.classList && i.classList.contains('monto') && i.value.trim() !== '') { const x = aNum(i.value); if (!isNaN(x)) i.value = String(x).replace('.', ','); }
});
document.addEventListener('input', e => {
  const i = e.target; if (!i || !i.classList || !i.classList.contains('monto')) return;
  let eco = i.nextElementSibling && i.nextElementSibling.classList.contains('monto-eco') ? i.nextElementSibling : null;
  if (!eco) { eco = document.createElement('div'); eco.className = 'monto-eco'; eco.style.cssText = 'font-size:12px;color:#2e7d32;font-weight:700;margin-top:2px'; i.insertAdjacentElement('afterend', eco); }
  const x = aNum(i.value);
  eco.textContent = !i.value.trim() ? '' : isNaN(x) ? 'Revisá el número' : '= $ ' + x.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  eco.style.color = isNaN(x) ? '#c62828' : '#2e7d32';
});
/* avisos importantes de la ficha médica, en rojo */
const alertasHtml = (a, chico = false) => a && a.length ? `<div class="alerta-med ${chico ? 'chica' : ''}">${ico('alerta')} <div><b>ATENCIÓN:</b> ${a.map(esc).join(' · ')}</div></div>` : '';

async function api(url, datos, metodo) {
  const opt = datos !== undefined ? { method: metodo || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) }
    : (metodo ? { method: metodo } : {});
  const r = await fetch(url, opt);
  if (r.status === 401) { location.href = '/entrar'; throw new Error('Tenés que entrar con la clave'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error ' + r.status);
  return j;
}
/* POST que puede pedir confirmación ("¿Lo damos igual?"): la vuelve a mandar con forzar */
async function apiConfirmando(url, datos) {
  const r = await api(url, datos);
  if (r.confirmar) {
    if (!await confirmar(esc(r.confirmar), 'Sí, darlo igual', false)) return null;
    return api(url, { ...datos, forzar: 1 });
  }
  return r;
}

function toast(msg, tipo = 'ok') {
  const d = document.createElement('div');
  d.className = tipo; d.textContent = msg;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), tipo === 'err' ? 6000 : 3200);
}
const fallo = e => toast(e.message || String(e), 'err');
const marcaTexto = () => `${window.MARCA || 'RoFac'} v${window.VERSION || ''}`;
const pieImpresion = () => `<div style="text-align:center;font-size:9px;color:#999;margin-top:18px">Sistema de gestión ${esc(marcaTexto())}</div>`;

/* pone el cursor en un campo sin robárselo a alguien que ya está escribiendo (evita que, tipeando rápido, se mezclen los campos) */
function enfocar(el, dentro) {
  if (!el) return;
  const a = document.activeElement;
  if (dentro ? (a && dentro.contains(a)) : (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName))) return;
  el.focus();
}
/* ---------------- modal genérico: devuelve el elemento; cerrar con m.cerrar() */
function modal(titulo, cuerpo, botones = '', clase = '', icono = '') {
  const bg = document.createElement('div');
  bg.className = 'mbg';
  bg.innerHTML = `<div class="modal ${clase}"><div class="mh">${icono ? ico(icono) : ''}<span>${titulo}</span><span class="x">${ico('x')}</span></div>
    <div class="mb">${cuerpo}</div>${botones ? `<div class="mf">${botones}</div>` : ''}</div>`;
  document.body.appendChild(bg);
  bg.cerrar = () => { bg.remove(); document.removeEventListener('keydown', esc_); bg.alCerrar && bg.alCerrar(); };
  const esc_ = e => { if (e.key === 'Escape' && $$('.mbg').length && $$('.mbg').pop() === bg) bg.cerrar(); };
  document.addEventListener('keydown', esc_);
  $('.x', bg).onclick = bg.cerrar;
  $$('[data-cerrar]', bg).forEach(b => b.onclick = bg.cerrar);
  if (innerWidth > 900) setTimeout(() => enfocar($('[autofocus]', bg) || $('.mb input:not([type=checkbox]):not([type=hidden]):not([readonly]), .mb select', bg), bg), 30);
  return bg;
}
function confirmar(msg, txtSi = 'Aceptar', peligro = true) {
  return new Promise(res => {
    const m = modal('Confirmar', `<div style="font-size:15px;line-height:1.55">${msg}</div>`,
      `<button class="btn" data-cerrar>Cancelar</button><button class="btn ${peligro ? 'rojo' : 'pri'}" id="cfSi">${txtSi}</button>`);
    $('.x', m).onclick = () => { m.cerrar(); res(false); };
    $('[data-cerrar]', m).onclick = () => { m.cerrar(); res(false); };
    $('#cfSi', m).onclick = () => { m.cerrar(); res(true); };
    setTimeout(() => $('#cfSi', m).focus(), 40);
  });
}
/* lee los campos [name] de un contenedor */
function leer(el) {
  const o = {};
  $$('[name]', el).forEach(i => { if (i.type === 'radio') { if (i.checked) o[i.name] = i.value; } else o[i.name] = i.type === 'checkbox' ? (i.checked ? 1 : 0) : i.value; });
  return o;
}
const abrirWA = url => window.open(url, '_blank');
function bajarCSV(nombre, titulos, filas) {
  const c = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const txt = '﻿' + [titulos, ...filas].map(f => f.map(c).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = nombre + '.csv'; a.click();
}

const ICONS = {
  mate: '<path d="M7 9h10l-1 9a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3z"/><path d="M6.5 9a5.5 5.5 0 0 1 11 0"/><path d="M14 9l4-7"/>',
  pedido: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  foto: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  izq: '<polyline points="15 18 9 12 15 6"/>',

  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 4a4 4 0 0 1 0 8M22 21v-1a6 6 0 0 0-4-5.6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>',
  kine: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v6M8 21l4-8 4 8M6 10.5l6-2 6 2"/>',
  db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calmas: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 13v6M9 16h6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  peso: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  recibo: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 9h8M8 13h6"/>',
  edificio: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01"/>',
  hist: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 3"/>',
  wa: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z"/><path d="M9 9.2c.2 2.9 2.9 5.6 5.8 5.8l1.2-1.4-2-1.1-1 .7a4.2 4.2 0 0 1-2.1-2.1l.7-1-1.1-2z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  mas: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  ayuda: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  luna: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  pin: '<path d="M12 17v5M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V17h14v-1.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  der: '<path d="m9 18 6-6-6-6"/>', izq: '<path d="m15 18-6-6 6-6"/>', abajo: '<path d="m6 9 6 6 6-6"/>',
  okc: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  xc: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  bajar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  subir: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  lapiz: '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  reloj: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  salud: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  conf: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  llave: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  camara: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6"/>',
  evo: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  pesa: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  archivo: '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  hoja: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6"/>',
  manzana: '<path d="M12 7c-1.5-1.3-3.4-1.6-5-.8C4.3 7.5 3.5 11 5 14.6 6.2 17.6 8.4 21 10.6 21c.7 0 1-.4 1.4-.4s.7.4 1.4.4c2.2 0 4.4-3.4 5.6-6.4 1.5-3.6.7-7.1-2-8.4-1.6-.8-3.5-.5-5 .8z"/><path d="M12 7c0-2 1-4 3-5"/>',
  balanza: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 9a5 5 0 0 1 8 0M12 9.5l1.5-2"/>',
  plato: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>',
  regla: '<path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4zM7.5 10.5l2-2M10.5 13.5l2-2M13.5 16.5l2-2"/>',
  diente: '<path d="M7 3c-2.5 0-4 2-4 5 0 2.5 1 4 1.6 6.5.6 2.4 1 6.5 3 6.5 1.8 0 1.9-3.5 2.4-5.2.3-1 .8-1.6 2-1.6s1.7.6 2 1.6c.5 1.7.6 5.2 2.4 5.2 2 0 2.4-4.1 3-6.5.6-2.5 1.6-4 1.6-6.5 0-3-1.5-5-4-5-1.8 0-3 1-5 1S8.8 3 7 3z"/>',
  presu: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 11v7M14.5 12.5h-3.3a1.4 1.4 0 0 0 0 2.8h1.6a1.4 1.4 0 0 1 0 2.8H9.5"/>',
  med: '<path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7zM7 10l7 7"/>',
  cuenta: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9M13 13h5M13 17h5"/>',
  menos: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>',
  entrar: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>',
  regalo: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  copa: '<path d="M8 22h8M12 15v7M5 3h14l-7 12z"/><path d="M7.5 7h9"/>',
  ticket: '<path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M9 5v14" stroke-dasharray="2 2"/>',
  barra: '<path d="M4 8h16M6 8v12M18 8v12M9 3h6l-1 5h-4z"/>',
  luna2: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  vip: '<path d="m2 8 5 4 5-8 5 8 5-4-2 12H4z"/>',
  caja3: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="M6 7V4h12v3M2 13h20M10 16h4"/>',
  hoy: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="2"/>',
};
const ico = (n, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}>${ICONS[n] || ''}</svg>`;

/* ================================================================ estado y catálogos */
let ME = null;
const esAdmin = () => ME && ME.rol === 'ADMIN';
const CFG = () => ME.cfg;

/* ================================================================ menú */
const MENU = [
  { id: 'principal', t: 'Inicio', i: 'home' },
  { id: 'pagos', t: 'Pagos y comprobantes', i: 'recibo' },
  { id: 'proveedores', t: 'Proveedores', i: 'edificio' },
  { id: 'gastos', t: 'Gastos', i: 'peso' },
  { id: 'sueldos', t: 'Sueldos', i: 'users' },
  { id: 'informes', t: 'Informes', i: 'chart' },
  { t: 'Datos', i: 'db', titulo: 'DATOS', sub: [
    { id: 'cuentas', t: 'Bancos y quién paga', i: 'card' },
    { id: 'config', t: 'Configuración y copia de seguridad', i: 'conf' }] },
];
const OCULTAS = { proveedor: '' };   // pantallas que no están en el menú
/* p puede ser 'a|b' (alcanza con uno) */
const puede = () => true;
let MENU_VIS = [];
const esMovil = () => innerWidth <= 900;
function pintarMenu() {
  MENU_VIS = MENU.map(m => m.sub ? { ...m, sub: m.sub.filter(s => puede(s.p)) } : m).filter(m => m.sub ? m.sub.length : puede(m.p));
  $('#menu').innerHTML = MENU_VIS.map((m, i) => `<div class="mi" data-m="${i}" title="${esc(m.t)}">${ico(m.i)}<span>${esc(m.t)}</span>
    ${m.sub ? ico('der', 'class="i flecha"') : ''}</div><div class="subm" data-sm="${i}" style="display:none"></div>`).join('');
  $$('#menu .mi').forEach(el => el.onclick = e => {
    const m = MENU_VIS[+el.dataset.m];
    if (!m.sub) { cerrarFly(); cerrarMenuMovil(); return ir(m.id); }
    e.stopPropagation();
    if (esMovil()) {        // en el celular el submenú se despliega abajo
      const sm = $(`[data-sm="${el.dataset.m}"]`);
      const abierto = sm.style.display !== 'none';
      $$('#menu .subm').forEach(x => x.style.display = 'none');
      if (abierto) return;
      sm.innerHTML = m.sub.map(s => `<div class="mi" style="padding-left:34px;font-weight:500" data-ir="${s.id}">${ico(s.i)}<span>${esc(s.t)}</span></div>`).join('');
      sm.style.display = '';
      $$('[data-ir]', sm).forEach(d => d.onclick = () => { cerrarMenuMovil(); ir(d.dataset.ir); });
      return;
    }
    abrirFly(m, el);
  });
}
function abrirFly(m, el) {
  const f = $('#flyout');
  f.innerHTML = `<div class="ft">${esc(m.titulo)}</div>` + m.sub.map((s, i) => `<div class="fi" data-i="${i}">${ico(s.i)} ${esc(s.t)}</div>`).join('');
  const r = el.getBoundingClientRect();
  f.classList.add('act');
  f.style.left = (r.right + 6) + 'px';
  f.style.top = Math.max(8, Math.min(r.top - 8, innerHeight - f.offsetHeight - 10)) + 'px';
  $$('.fi', f).forEach(d => d.onclick = () => { cerrarFly(); ir(m.sub[+d.dataset.i].id); });
}
const cerrarFly = () => $('#flyout').classList.remove('act');
const cerrarMenuMovil = () => document.body.classList.remove('menu-abierto');
document.addEventListener('click', e => {
  if (!e.target.closest('#flyout') && !e.target.closest('#menu')) cerrarFly();
  if (!e.target.closest('#notifs') && !e.target.closest('#btnNotif')) $('#notifs').classList.remove('act');
});

/* ================================================================ navegación */
const P = {};          // pantallas: P[nombre] = async (main, arg) => {}
let actual = '';
let SIN_GUARDAR = '';       // texto del aviso si hay cambios sin guardar en la pantalla actual
let hashActual = '';
window.addEventListener('beforeunload', e => { if (SIN_GUARDAR) { e.preventDefault(); e.returnValue = ''; } });
async function ir(id, arg) {
  if (!id) return;
  if (SIN_GUARDAR) {
    if (!await confirmar(`${esc(SIN_GUARDAR)}<br>¿Salir igual? Se pierden los cambios.`, 'Salir sin guardar')) {
      if (location.hash !== hashActual) history.pushState(null, '', hashActual);
      return;
    }
    SIN_GUARDAR = '';
  }
  if (!P[id]) id = 'principal';
  const todos = MENU.flatMap(m => m.sub || [m]);
  const req = (todos.find(x => x.id === id) || {}).p || OCULTAS[id];
  if (req && !puede(req)) { toast('No tenés permiso para esa sección', 'err'); id = 'principal'; arg = undefined; }
  actual = id;
  const hash = '#' + id + (arg !== undefined && arg !== null && typeof arg !== 'object' ? '/' + arg : '');
  if (location.hash !== hash) history.pushState(null, '', hash);
  hashActual = hash;
  $$('#menu > .mi').forEach(el => {
    const m = MENU_VIS[+el.dataset.m];
    el.classList.toggle('act', m.id === id || !!(m.sub && m.sub.some(s => s.id === id || (id === 'paciente' && s.id === 'pacientes'))));
  });
  /* cada pantalla se dibuja en un contenedor nuevo: si una pantalla anterior termina de cargar tarde, no pisa a la actual */
  const fuera = $('#main');
  fuera.innerHTML = '';
  const main = document.createElement('div');
  fuera.appendChild(main);
  main.innerHTML = '<div class="muted" style="padding:30px">Cargando…</div>';
  window.scrollTo(0, 0);
  try { await P[id](main, arg); } catch (e) { if (main.isConnected) main.innerHTML = `<div class="card neg">${esc(e.message)}</div>`; }
  if (main.isConnected && window.RespaldoUI) RespaldoUI.enganchar(main, id, () => ir('config'));
}
const recargar = () => { const [id, arg] = location.hash.slice(1).split('/'); return ir(id || actual, arg); };
window.addEventListener('popstate', () => { const [id, arg] = location.hash.slice(1).split('/'); if (ME) ir(id || 'principal', arg); });

function cabecera(icono, titulo, sub, der = '') {
  return `<div class="ph"><div><h1>${ico(icono)} ${esc(titulo)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div><div class="der">${der}</div></div>`;
}


/* ================================================================ barra superior */
async function iniciar() {
  try { ME = await api('/api/me'); } catch (e) { return; }
  MEDIOS = ME.medios || MEDIOS;
  const nom = CFG().nombre_negocio || 'Mi farmacia';
  $('#gymNom').textContent = nom; $('#logo').innerHTML = ico('recibo'); $('#topTit').textContent = nom + ' · Pagos'; document.title = 'Pagos · ' + nom;
  $('#btnAyuda').innerHTML = ico('ayuda') + '<span class="lbl"> Ayuda</span>';
  $('#btnMenuMov').innerHTML = ico('menu');
  $('#btnMini').innerHTML = ico('pin', 'style="width:15px;height:15px"');
  $('#btnTurnoRapido').innerHTML = ico('plus') + '<span class="lbl"> Cargar pago</span>';
  $('#btnTurnoRapido').onclick = () => cargarPago({}, () => recargar());
  const tema = () => $('#btnTema').innerHTML = ico(document.documentElement.dataset.theme === 'dark' ? 'sol' : 'luna', 'style="width:15px;height:15px"');
  tema();
  $('#btnTema').onclick = () => { const d = document.documentElement.dataset.theme === 'dark' ? '' : 'dark'; document.documentElement.dataset.theme = d; try { localStorage.setItem('tema', d); } catch (e) {} tema(); };
  if (document.documentElement.classList.contains('mini-pre')) document.body.classList.add('mini');
  $('#btnMini').onclick = () => { document.body.classList.toggle('mini'); try { localStorage.setItem('mini', document.body.classList.contains('mini') ? '1' : '0'); } catch (e) {} };
  $('#btnMenuMov').onclick = () => document.body.classList.toggle('menu-abierto');
  $('#velo').onclick = cerrarMenuMovil;
  $('#btnAyuda').onclick = ayuda;
  $('#btnNotif').onclick = verNotifs;
  pintarMenu();
  actualizarBarra(); setInterval(actualizarBarra, 120000);
  const [id, arg] = location.hash.slice(1).split('/');
  ir(id || 'principal', arg);
}
async function actualizarBarra() {
  try { const n = await api('/api/avisos'); $('#btnNotif').innerHTML = ico('bell') + '<span class="lbl"> Avisos</span>' + (n.length ? `<span class="badge">${n.length}</span>` : ''); $('#btnNotif')._n = n; } catch (e) {}
}
function verNotifs() {
  const n = $('#btnNotif')._n || [], el = $('#notifs');
  el.innerHTML = n.length ? n.map((x, i) => `<div class="n" data-i="${i}">${ico(x.ico)} ${esc(x.texto)}</div>`).join('') : '<div class="n muted">No hay avisos</div>';
  el.classList.toggle('act');
  $$('[data-i]', el).forEach(d => d.onclick = () => { el.classList.remove('act'); ir(n[+d.dataset.i].ir, n[+d.dataset.i].arg); });
}
function ayuda() {
  modal('Cómo se usa', `<div style="line-height:1.7">
    <b>1. Cuando llega el resumen de la droguería</b> (o una factura): Proveedores > el proveedor > <b>Cargar resumen</b>: fecha de cierre, fecha de pago e importe. Así sabés cuánto le debés y cuándo vence.<br>
    <b>2. Cuando pagás</b>: botón <b>Cargar pago</b> (arriba). Elegís Proveedor, Gasto o Sueldo, el importe, cómo (transferencia, depósito…), <b>desde dónde</b> salió la plata
      (tu banco, o tu suegro si transfirió él), el N° de operación y adjuntás la <b>foto o el PDF del comprobante</b>. También podés, desde la app del banco o de Mercado Pago, tocar <b>Compartir</b> en el comprobante y elegir <b>Pagos Farmacia</b>.<br>
    <b>3. Cuando la droguería lo refleja en su cuenta</b>: tocá <b>Acreditado</b>. En el Inicio ves los pagos que todavía no te acreditaron y hace cuántos días.<br>
    <b>4. Si te reclaman un pago</b>: Pagos y comprobantes > buscá por proveedor, fecha o importe (ej. 1.250.000) y abrí o descargá el comprobante para mandarlo.<br>
    <b>Bancos y quién paga</b>: cargá tus cuentas (Nación, Galicia…) y a las personas que pagan por vos (ej. tu suegro).<br>
    <b>Copia de seguridad</b>: todo queda en este celular. En Configuración tocá <b>Hacer copia</b> y mandala a tu Google Drive (una vez por semana, la app te avisa).</div>`, '<button class="btn pri" data-cerrar>Entendido</button>', 'ancho', 'ayuda');
}
function barras(datos, fmt = num, alto = 130) {
  const max = Math.max(1, ...datos.map(x => Math.abs(x.v)));
  return `<div class="barras" style="height:${alto}px">${datos.map(x => `<div style="height:${Math.abs(x.v) / max * 100}%" title="${esc(x.t || x.l)}: ${fmt(x.v)}"><span>${x.v ? fmt(x.v) : ''}</span></div>`).join('')}</div>
    <div class="barras-l">${datos.map(x => `<span>${esc(x.l)}</span>`).join('')}</div>`;
}
document.addEventListener('DOMContentLoaded', iniciar);
