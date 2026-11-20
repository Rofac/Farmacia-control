/* Pagos Farmacia: "Qué hay que pagar" día por día, gastos fijos, ordenar las categorías y los datos de la farmacia (logo). */
'use strict';

const MESES_MIN = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const mesTxt = p => p ? MESES_MIN[+p.slice(5, 7) - 1] + ' ' + p.slice(0, 4) : '';
const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const diaTxt = f => { const d = new Date(f + 'T12:00:00'), h = hoy(); const dd = Math.round((d - new Date(h + 'T12:00:00')) / 864e5);
  return (dd === 0 ? 'Hoy' : dd === 1 ? 'Mañana' : DIAS_SEM[d.getDay()][0].toUpperCase() + DIAS_SEM[d.getDay()].slice(1)) + ' ' + dmy(f).slice(0, 5); };
const AG_ICO = { RESUMEN: 'edificio', CHEQUE: 'cheque', SUELDO: 'users', FIJO: 'fijo' };
const AG_TXT = { RESUMEN: 'Resumen', CHEQUE: 'Cheque', SUELDO: 'Sueldo', FIJO: 'Gasto fijo' };

/* ---------------------------------------------------------------- QUÉ HAY QUE PAGAR (día por día) */
let AG_DIAS = 30, AG_VER = 'todo';
P.agenda = async (main) => {
  const d = await api('/api/agenda?dias=' + AG_DIAS);
  const re = () => ir('agenda');
  const ver = AG_VER === 'todo' ? d.items : d.items.filter(x => x.tipo === AG_VER);
  /* agrupado por día (lo atrasado junto, arriba) */
  const dias = []; let acum = 0;
  const at = ver.filter(x => x.atrasado);
  if (at.length) { const t = at.reduce((a, x) => a + x.importe, 0); acum += t; dias.push({ fecha: null, items: at, total: t, acum }); }
  for (const x of ver.filter(x => !x.atrasado)) {
    let g = dias[dias.length - 1]; if (!g || g.fecha !== x.fecha) { g = { fecha: x.fecha, items: [], total: 0 }; dias.push(g); }
    g.items.push(x); g.total += x.importe; acum += x.importe; g.acum = acum;
  }
  const saldo = d.saldo, total = ver.reduce((a, x) => a + x.importe, 0);
  const falta = saldo === null ? null : dias.find(g => g.acum > saldo + 0.009);
  main.innerHTML = cabecera('cal', 'Qué hay que pagar', `Lo que vence en los próximos ${AG_DIAS} días: resúmenes, cheques que se debitan, sueldos y gastos fijos`,
    `<button class="btn" id="agFijos">${ico('fijo')} Gastos fijos</button>`) +
    `<div class="kpis">
      <div class="kpi" style="--c:var(--rojo)"><small>Atrasado</small><b>${money(d.atrasado)}</b><div class="det">${d.items.filter(x => x.atrasado).length} cosas</div></div>
      <div class="kpi" style="--c:var(--naranja)"><small>Próximos 7 días</small><b>${money(d.semana)}</b></div>
      <div class="kpi" style="--c:var(--pri)"><small>Total ${AG_DIAS} días</small><b>${money(d.total)}</b><div class="det">${d.items.length} pagos</div></div>
      <div class="kpi ag-saldo" style="--c:var(--verde, #1f9d55);cursor:pointer" id="agSaldo"><small>Tengo en el banco ${d.saldo_fecha ? '(' + dmy(d.saldo_fecha).slice(0, 5) + ')' : ''}</small>
        <b>${saldo === null ? '<span class="muted" style="font-size:15px">Tocá para ponerlo</span>' : money(saldo)}</b>
        <div class="det">${saldo === null ? 'y te digo si te alcanza' : falta ? `<span class="neg">No alcanza ${falta.fecha ? 'el ' + diaTxt(falta.fecha).toLowerCase() : 'para lo atrasado'}</span>` : '<span class="pos">Alcanza para todo</span>'}</div></div></div>
    <div class="card" style="padding:10px 12px"><div class="inl" style="justify-content:space-between">
      <div class="seg ag-ver" id="agVer">${[['todo', 'Todo'], ['RESUMEN', 'Resúmenes'], ['CHEQUE', 'Cheques'], ['SUELDO', 'Sueldos'], ['FIJO', 'Gastos fijos']].map(([k, t]) => `<button data-v="${k}" class="${k === AG_VER ? 'act' : ''}">${t}</button>`).join('')}</div>
      <div class="seg" id="agDias">${[15, 30, 60].map(n => `<button data-n="${n}" class="${n === AG_DIAS ? 'act' : ''}">${n} días</button>`).join('')}</div></div></div>
    ${dias.map(g => `<div class="card ag-dia ${g.fecha === null ? 'atr' : ''} ${saldo !== null && g.acum > saldo + 0.009 ? 'no-alcanza' : ''}">
      <div class="ag-cab"><b>${g.fecha === null ? `${ico('alerta')} Atrasado` : diaTxt(g.fecha)}</b><span class="sp"></span>
        <span class="ag-tot">${money(g.total)}</span><span class="muted chico ag-acum" title="Lo que llevás juntando hasta este día">acum. ${money0(g.acum)}${saldo !== null ? ` · ${g.acum > saldo + 0.009 ? '<b class="neg">faltan ' + money0(g.acum - saldo) + '</b>' : 'quedan ' + money0(saldo - g.acum)}` : ''}</span></div>
      ${g.items.map((x, i) => `<div class="ag-it t${x.tipo}" data-i="${d.items.indexOf(x)}">
        <span class="ag-ico">${ico(AG_ICO[x.tipo])}</span>
        <div class="ag-tx"><b>${esc(x.titulo)}</b><small>${AG_TXT[x.tipo]}${g.fecha === null ? ' · ' + dmy(x.fecha) : ''} · ${esc(x.detalle)}</small></div>
        <div class="ag-imp">${money(x.importe)}</div>
        <div class="ag-acc">${x.tipo === 'CHEQUE' ? `<button class="btn chico" data-deb="${d.items.indexOf(x)}">${ico('check')} Se debitó</button>`
          : x.tipo === 'SUELDO' ? `<button class="btn chico" data-su="${d.items.indexOf(x)}">${ico('users')} Ver</button>`
          : `<button class="btn chico verde" data-pagar="${d.items.indexOf(x)}">${ico('peso')} Pagar</button>`}
          ${x.tipo === 'FIJO' ? `<button class="ab" data-salt="${d.items.indexOf(x)}" title="Este mes no se paga">${ico('x')}</button>` : ''}</div></div>`).join('')}</div>`).join('')
      || `<div class="card vacio-g">${ico('check')}<p>No hay nada para pagar en los próximos ${AG_DIAS} días.</p><p class="muted chico">Cargá los gastos fijos (alquiler, internet, Plex...) y los resúmenes de las droguerías para verlos acá.</p></div>`}
    <div class="ayuda">Los sueldos de las semanas que vienen son estimados (días × lo que cobra por día). Lo de los cheques es el día que se debitan de la cuenta.</div>`;
  $('#agFijos').onclick = () => ir('fijos');
  $$('#agVer button').forEach(b => b.onclick = () => { AG_VER = b.dataset.v; re(); });
  $$('#agDias button').forEach(b => b.onclick = () => { AG_DIAS = +b.dataset.n; re(); });
  $('#agSaldo').onclick = () => ponerSaldo(saldo, re);
  main.onclick = async e => {
    const b = e.target.closest('[data-pagar],[data-deb],[data-su],[data-salt]'); if (!b) return;
    const x = d.items[+(b.dataset.pagar ?? b.dataset.deb ?? b.dataset.su ?? b.dataset.salt)];
    if (b.dataset.pagar !== undefined) return pagarItem(x, re);
    if (b.dataset.su !== undefined) { if (typeof SU_VIE !== 'undefined') SU_VIE = x.viernes; return ir('sueldos'); }
    if (b.dataset.deb !== undefined) { try { await api(`/api/cheques/${x.cheque_id}/debitado`, { fecha: hoy() }); toast('Cheque marcado como debitado'); re(); } catch (er) { fallo(er); } return; }
    if (b.dataset.salt !== undefined) {
      if (!await confirmar(`¿<b>${esc(x.titulo)}</b> de ${mesTxt(x.periodo)} no se paga?<br><br>Deja de aparecer para ese mes (los demás meses siguen).`, 'Este mes no se paga')) return;
      try { await api(`/api/fijos/${x.fijo_id}/saltear`, { periodo: x.periodo }); toast('Listo: ese mes no se paga'); re(); } catch (er) { fallo(er); }
    }
  };
};
function ponerSaldo(actual, luego) {
  const m = modal('¿Cuánto tenés en el banco?', `<p style="margin-top:0">Poné lo que tenés hoy para pagar (por ejemplo, el saldo del banco más lo de Mercado Pago). Te marca en rojo el día en que no te alcanzaría.</p>
    <label>Saldo de hoy</label>${campoMonto('id="sbI" style="font-size:20px;font-weight:800"', actual === null ? '' : actual)}
    <div class="ayuda">Se guarda con la fecha de hoy. Para que sirva, actualizalo cada tanto. Vacío = no usar.</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="sbOk">${ico('check')} Guardar</button>`, '', 'peso');
  $('#sbOk', m).onclick = async () => { try { const v = $('#sbI', m).value.trim(); await api('/api/agenda/saldo', { saldo: v === '' ? '' : aNum(v) }); m.cerrar(); luego(); } catch (e) { fallo(e); } };
  setTimeout(() => { if (!m.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') $('#sbI', m).focus(); }, 60);
}
function pagarItem(x, luego) {
  if (x.tipo === 'RESUMEN') return cargarPago({ tipo: 'PROVEEDOR', proveedor_id: x.proveedor_id, importe: x.importe }, luego);
  if (x.tipo === 'FIJO') return cargarPago({ tipo: 'GASTO', categoria: x.categoria, importe: x.importe || '', concepto: x.titulo + ' · ' + mesTxt(x.periodo), medio: x.medio, cuenta_id: x.cuenta_id,
    fijo_id: x.fijo_id, fijo_periodo: x.periodo, fijo_nombre: x.titulo, fijo_mes: mesTxt(x.periodo), variable: x.variable }, luego);
}

/* ---------------------------------------------------------------- GASTOS FIJOS */
P.fijos = async (main) => {
  const l = await api('/api/fijos'), act = l.filter(g => g.activo), baja = l.filter(g => !g.activo);
  const re = () => ir('fijos'), mesHoy = hoy().slice(0, 7);
  const totMes = act.filter(g => (+g.cada || 1) === 1).reduce((a, g) => a + g.importe, 0);
  const estado = g => g.pagado_mes ? `<span class="pill ATENDIDO">Pagado ${dmy(g.pagado_mes.fecha).slice(0, 5)}</span>`
    : g.salteado_mes ? '<span class="pill">Este mes no</span>'
    : g.proximo ? (g.proximo.vencido ? `<span class="pill rojo">Venció ${dmy(g.proximo.vence).slice(0, 5)}</span>` : g.proximo.dias <= 3 ? `<span class="pill naranja">${g.proximo.dias === 0 ? 'Vence hoy' : 'En ' + g.proximo.dias + ' día' + (g.proximo.dias === 1 ? '' : 's')}</span>` : `<span class="pill">Vence ${dmy(g.proximo.vence).slice(0, 5)}</span>`) : '';
  main.innerHTML = cabecera('fijo', 'Gastos fijos', 'Lo que se paga todos los meses: alquiler, internet, Plex, monotributos, cuotas…',
    `<button class="btn" id="fjDe">${ico('hist')} Desde lo que ya pagaste</button><button class="btn verde grande" id="fjN">${ico('plus')} Agregar gasto fijo</button>`) +
    `<div class="kpis"><div class="kpi" style="--c:var(--pri)"><small>Gastos fijos por mes</small><b>${money(totMes)}</b><div class="det">${act.length} gastos fijos</div></div>
      <div class="kpi" style="--c:var(--rojo)"><small>Vencidos sin pagar</small><b>${money(act.filter(g => g.proximo && g.proximo.vencido && !g.pagado_mes).reduce((a, g) => a + g.importe, 0))}</b></div>
      <div class="kpi" style="--c:var(--verde, #1f9d55)"><small>Pagados en ${MESES_MIN[+mesHoy.slice(5) - 1]}</small><b>${money(act.filter(g => g.pagado_mes).reduce((a, g) => a + g.pagado_mes.importe, 0))}</b><div class="det">${act.filter(g => g.pagado_mes).length} de ${act.length}</div></div></div>
    <div class="card"><div class="tabla-x"><table class="t comp fijos-t"><thead><tr><th>Día</th><th>Gasto</th><th class="r">Importe</th><th>Este mes</th><th></th></tr></thead><tbody>
      ${act.map(g => `<tr data-f="${g.id}" style="cursor:pointer"><td class="fj-dia"><b>${g.dia}</b><small>${(+g.cada || 1) === 1 ? 'c/mes' : 'c/' + g.cada + ' meses'}</small></td>
        <td class="fj-nom"><b>${esc(g.nombre)}</b><div class="muted chico">${esc(g.categoria)}${esPersonal(g.categoria) ? ' · personal' : ''}${g.cuenta ? ' · ' + esc(g.cuenta) : ''}${g.hasta ? ' · hasta ' + mesTxt(g.hasta) : ''}</div></td>
        <td class="r fj-imp"><b>${money(g.importe)}</b>${g.variable ? '<div class="muted chico">aprox.</div>' : ''}</td><td class="fj-est">${estado(g)}</td>
        <td class="nowrap fj-acc">${!g.pagado_mes && g.proximo ? `<button class="btn chico verde" data-pf="${g.id}">${ico('peso')} Pagar</button>` : ''}</td></tr>`).join('')
        || `<tr><td colspan="5" class="vacio">Todavía no cargaste gastos fijos. Tocá <b>"Desde lo que ya pagaste"</b> para armarlos rápido con los pagos de este mes.</td></tr>`}</tbody></table></div></div>
    ${baja.length ? `<details class="card"><summary class="muted">Dados de baja (${baja.length})</summary>${baja.map(g => `<div class="inl" style="margin:6px 0"><span class="sp">${esc(g.nombre)} · ${money(g.importe)}</span><button class="btn chico" data-f="${g.id}">Volver a usar</button></div>`).join('')}</details>` : ''}
    <div class="ayuda">Aparecen en <b>Qué hay que pagar</b> el día que vencen. Al tocar <b>Pagar</b> se carga el gasto solo (categoría, importe y de qué mes es). Si un mes no se paga, en Qué hay que pagar tocá la ✕.</div>`;
  $('#fjN').onclick = () => editarFijo({}, re);
  $('#fjDe').onclick = () => fijoDesdePagos(re);
  main.onclick = e => {
    const pf = e.target.closest('[data-pf]');
    if (pf) { const g = act.find(x => x.id === +pf.dataset.pf); return pagarItem({ tipo: 'FIJO', titulo: g.nombre, categoria: g.categoria, importe: g.importe, medio: g.medio, cuenta_id: g.cuenta_id, fijo_id: g.id, periodo: g.proximo.periodo, variable: g.variable }, re); }
    const f = e.target.closest('[data-f]'); if (f) editarFijo(l.find(x => x.id === +f.dataset.f), re);
  };
};
async function editarFijo(g, luego) {
  const L = await listas(true), cats = categoriasGasto(); if (g.categoria && !cats.includes(g.categoria)) cats.push(g.categoria);
  const ctas = L.cuentas.filter(x => x.activo || x.id === g.cuenta_id);
  const m = modal(g.id ? 'Modificar gasto fijo' : 'Agregar gasto fijo', `<div class="g">
    <div class="full"><label>Nombre</label><input id="gfN" value="${esc(g.nombre || '')}" placeholder="Ej. Alquiler Roma 2, Internet Starlink, Monotributo Franco"></div>
    <div><label>Qué gasto es</label><select id="gfC"><option value="">Elegí…</option>${opcionesGasto(cats, g.categoria)}</select></div>
    <div><label>Importe</label>${campoMonto('id="gfI" style="font-weight:800"', g.importe ?? '')}<label class="chk" style="margin-top:6px"><input type="checkbox" id="gfV" ${g.variable ? 'checked' : ''}> Cambia todos los meses (es aproximado)</label></div>
    <div><label>Vence el día</label><input id="gfD" type="number" min="1" max="31" inputmode="numeric" value="${esc(g.dia || '')}" placeholder="1 a 31"></div>
    <div><label>Cada cuánto</label><select id="gfK">${[[1, 'Todos los meses'], [2, 'Cada 2 meses'], [3, 'Cada 3 meses'], [6, 'Cada 6 meses'], [12, 'Una vez por año']].map(([v, t]) => `<option value="${v}" ${v === (+g.cada || 1) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div><label>Desde qué mes</label><input id="gfDe" type="month" value="${esc(g.desde || hoy().slice(0, 7))}"></div>
    <div><label>Hasta (opcional, ej. última cuota)</label><input id="gfHa" type="month" value="${esc(g.hasta || '')}"></div>
    <div><label>Cómo se paga</label><select id="gfM">${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}" ${k === (g.medio || 'TRANSFERENCIA') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div><label>Desde dónde</label><select id="gfK2"><option value="">Elegí…</option>${ctas.map(x => `<option value="${x.id}" ${x.id === +g.cuenta_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
    <div class="full"><label>Notas</label><input id="gfO" value="${esc(g.notas || '')}" placeholder="Ej. CBU del dueño, N° de cliente"></div></div>`,
    `${g.id && g.activo ? `<button class="btn rojo" id="gfB" style="margin-right:auto">${ico('x')} Dar de baja</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="gfOk">${ico('check')} Guardar</button>`, 'ancho', 'fijo');
  $('#gfOk', m).onclick = async () => {
    try { await api('/api/fijos', { id: g.id, nombre: $('#gfN', m).value, categoria: $('#gfC', m).value, importe: aNum($('#gfI', m).value), variable: $('#gfV', m).checked ? 1 : 0, dia: $('#gfD', m).value,
      cada: $('#gfK', m).value, desde: $('#gfDe', m).value, hasta: $('#gfHa', m).value, medio: $('#gfM', m).value, cuenta_id: $('#gfK2', m).value, notas: $('#gfO', m).value });
      m.cerrar(); toast('Gasto fijo guardado'); luego && luego(); } catch (e) { fallo(e); }
  };
  if ($('#gfB', m)) $('#gfB', m).onclick = async () => { if (!await confirmar(`¿Dar de baja <b>${esc(g.nombre)}</b>?<br>Deja de aparecer para pagar. Los pagos ya hechos quedan.`, 'Dar de baja', true)) return;
    try { await api('/api/fijos/' + g.id, null, 'DELETE'); m.cerrar(); toast('Dado de baja'); luego && luego(); } catch (e) { fallo(e); } };
  setTimeout(() => { if (!m.contains(document.activeElement) || document.activeElement.tagName === 'BUTTON') $('#gfN', m).focus(); }, 60);
}
/* armar gastos fijos con los gastos que ya se pagaron (últimos 45 días) */
async function fijoDesdePagos(luego) {
  const l = (await api(`/api/pagos?tipo=GASTO&desde=${sumarDias(hoy(), -45)}&hasta=${hoy()}`)).filter(p => p.estado !== 'ANULADO');
  const ya = new Set((await api('/api/fijos')).filter(g => g.activo).map(g => (g.nombre || '').toLowerCase()));
  const m = modal('Gastos fijos desde lo que ya pagaste', `<p style="margin-top:0">Marcá los que se pagan <b>todos los meses</b>. Se crean con el mismo importe, el mismo día y desde la misma cuenta (después los podés cambiar).</p>
    <div class="fj-de">${l.map((p, i) => { const nom = p.concepto || p.categoria; return `<label class="chk fj-op ${ya.has(nom.toLowerCase()) ? 'ya' : ''}"><input type="checkbox" data-i="${i}" ${ya.has(nom.toLowerCase()) ? 'disabled' : ''}>
      <span><b>${esc(nom)}</b><small>${esc(p.categoria)} · día ${+p.fecha.slice(8)} · ${money(p.importe)}${p.cuenta ? ' · ' + esc(p.cuenta) : ''}${ya.has(nom.toLowerCase()) ? ' · ya es fijo' : ''}</small></span></label>`; }).join('') || '<p class="muted">No hay gastos en los últimos 45 días.</p>'}</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="fdOk">${ico('check')} Crear los marcados</button>`, 'ancho', 'fijo');
  $('#fdOk', m).onclick = async () => {
    const sel = $$('input[data-i]:checked', m).map(c => l[+c.dataset.i]); if (!sel.length) return toast('Marcá al menos uno');
    try { for (const p of sel) await api('/api/fijos', { nombre: p.concepto || p.categoria, categoria: p.categoria, importe: p.importe, dia: +p.fecha.slice(8), cada: 1, desde: sumarMeses(p.fecha.slice(0, 7), 1), medio: p.medio, cuenta_id: p.cuenta_id });
      m.cerrar(); toast(`Listo: ${sel.length} gasto${sel.length === 1 ? '' : 's'} fijo${sel.length === 1 ? '' : 's'}`); luego && luego(); } catch (e) { fallo(e); }
  };
}
const sumarMeses = (p, n) => { let [y, m] = p.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}`; };

/* ---------------------------------------------------------------- ORDENAR MIS GASTOS (propone la categoría nueva de cada gasto) */
async function ordenarGastos() {
  const d = await api('/api/gastos/ordenar');
  let farm = [...d.farmacia], pers = [...d.personal];
  /* las que usa y no están en la lista nueva, se agregan donde corresponda */
  for (const g of [...d.grupos.map(x => x.sugerida), ...d.fijos.map(x => x.sugerida)]) if (!farm.includes(g) && !pers.includes(g)) farm.splice(farm.length - 1, 0, g);
  const sel = (v) => `<select class="og-s">${[['Farmacia', farm], ['Personal', pers]].map(([t, l]) => `<optgroup label="${t}">${l.map(c => `<option ${c === v ? 'selected' : ''}>${esc(c)}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const porCat = {}; d.grupos.forEach((g, i) => (porCat[g.categoria || '(sin categoría)'] = porCat[g.categoria || '(sin categoría)'] || []).push(i));
  const m = modal('Ordenar mis gastos', `<p style="margin-top:0">Te propongo una categoría para cada gasto que ya cargaste, separando <b>Farmacia</b> de <b>Personal</b>. Revisá y cambiá lo que no te guste: <b>no se cambia nada hasta que tocás Aplicar</b>.</p>
    <div class="og-cats"><div><b>${ico('edificio')} Farmacia</b><div class="muted chico">${farm.map(esc).join(' · ')}</div></div><div><b>${ico('home')} Personal</b><div class="muted chico">${pers.map(esc).join(' · ')}</div></div></div>
    ${Object.entries(porCat).map(([cat, ids]) => `<div class="og-g"><div class="og-h">Hoy: <b>${esc(cat)}</b> <span class="muted chico">(${ids.reduce((a, i) => a + d.grupos[i].n, 0)} pagos)</span></div>
      ${ids.map(i => { const g = d.grupos[i]; return `<div class="og-r" data-i="${i}"><div class="og-t"><b>${esc(g.concepto || '(sin detalle)')}</b><small>${g.n} pago${g.n === 1 ? '' : 's'} · ${money(g.total)}</small></div>
        <span class="og-f">→</span>${sel(g.sugerida)}</div>`; }).join('')}</div>`).join('') || '<p class="muted">Todavía no hay gastos cargados.</p>'}
    ${d.fijos.length ? `<div class="og-g"><div class="og-h">Gastos fijos</div>${d.fijos.map((f, i) => `<div class="og-r" data-f="${i}"><div class="og-t"><b>${esc(f.nombre)}</b><small>hoy: ${esc(f.categoria)}</small></div><span class="og-f">→</span>${sel(f.sugerida)}</div>`).join('')}</div>` : ''}
    <div class="ayuda">Farmar, Barrichi, ADN, Lidherma y parecidos los puse en "Compras a proveedores". Si querés llevar la cuenta de lo que les debés, agregalos en Proveedores.</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ogOk">${ico('check')} Aplicar</button>`, 'xl', 'lista');
  $('#ogOk', m).onclick = async () => {
    const cambios = $$('.og-r[data-i]', m).map(r => { const g = d.grupos[+r.dataset.i]; return { categoria: g.categoria, concepto: g.concepto || '', a: $('select', r).value }; }).filter(c => c.a !== c.categoria);
    const fijos = $$('.og-r[data-f]', m).map(r => ({ id: d.fijos[+r.dataset.f].id, a: $('select', r).value }));
    const usadas = new Set([...cambios.map(c => c.a), ...fijos.map(f => f.a), ...$$('.og-s', m).map(s => s.value)]);
    const categorias = [...farm, ...pers].filter((c, i, a) => a.indexOf(c) === i && (d.farmacia.includes(c) || d.personal.includes(c) || usadas.has(c)));
    if (!await confirmar(`Se van a cambiar <b>${cambios.length}</b> grupo${cambios.length === 1 ? '' : 's'} de gastos de categoría y la lista queda en ${categorias.length} categorías (${pers.length} personales).<br><br>Antes se guarda una copia automática por si querés volver atrás.`, 'Aplicar')) return;
    try { await SRV.copiaDiaria(true); const r = await api('/api/gastos/ordenar', { cambios, fijos, categorias, personales: pers });
      m.cerrar(); ME = await api('/api/me'); toast(`Listo: ${r.cambiados} pagos reacomodados`); recargar(); } catch (e) { fallo(e); }
  };
}

/* ---------------------------------------------------------------- LOGO Y DATOS DE LA FARMACIA */
function pintarMarca() {
  const c = CFG(), nom = c.nombre_negocio || 'Mi farmacia';
  $('#gymNom').textContent = nom; document.title = 'Pagos · ' + nom;
  $('#logo').innerHTML = `<img src="img/roma_logo.png" alt="${esc(nom)}">`; $('#logo').classList.add('con-logo');
  $('#topTit').innerHTML = `<img class="tit-logo" src="img/roma_ico.png" alt=""><span>${esc(nom)} · Pagos</span>`;
  for (const el of [$('#logo'), $('#gymNom'), $('#topTit')]) { el.style.cursor = 'pointer'; el.title = 'Datos de la farmacia'; el.onclick = () => { if (typeof cerrarMenuMovil === 'function') cerrarMenuMovil(); datosFarmacia(); }; }
}
function datosFarmacia() {
  const c = CFG();
  const filas = [['Razón social', c.razon_social], ['CUIT', c.cuit], ['Nombre', c.nombre_negocio], ['Dirección', c.direccion], ['Localidad', c.localidad], ['Teléfono', c.telefono_farmacia], ['Email', c.email_farmacia]].filter(x => x[1]);
  const texto = filas.map(([k, v]) => `${k}: ${v}`).join('\n');
  const m = modal('', `<div class="df-logo"><img src="img/roma_logo.png" alt=""></div>
    <div class="df">${filas.map(([k, v]) => `<div class="df-r"><small>${k}</small><b>${esc(v)}</b><button class="ab" data-cp="${esc(v)}" title="Copiar">${ico('copiar')}</button></div>`).join('')}</div>
    <div class="muted chico" style="text-align:center;margin-top:8px">Se cambian en Datos &gt; Configuración</div>`,
    `<button class="btn" id="dfCp">${ico('copiar')} Copiar todo</button><button class="btn verde" id="dfWa">${ico('wa')} Mandar por WhatsApp</button>`, '', 'edificio');
  m.onclick = async e => { const b = e.target.closest('[data-cp]'); if (b) { await copiarTexto(b.dataset.cp); toast('Copiado: ' + b.dataset.cp); } };
  $('#dfCp', m).onclick = async () => { await copiarTexto(texto); toast('Datos copiados'); };
  $('#dfWa', m).onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}
async function copiarTexto(t) { try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } }
