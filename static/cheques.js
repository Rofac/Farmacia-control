/* ================================================================ CHEQUES (los que doy yo: físicos y eCheq). Aparte del calendario. */
const TIPO_CH = { FISICO: 'Cheque', ECHEQ: 'eCheq' };
const cuandoCh = d => d < 0 ? `hace ${-d} día${d === -1 ? '' : 's'}` : d === 0 ? 'HOY' : d === 1 ? 'mañana' : `en ${d} días`;

P.cheques = async (main, vista) => {
  let ver = vista === 'historial' ? 'HISTORIAL' : 'PENDIENTES', L = [], datos = null;
  let f = { desde: sumarDias(hoy(), -90), hasta: sumarDias(hoy(), 60) };
  main.innerHTML = cabecera('cheque', 'Cheques', 'Los cheques y eCheq que diste, y cuándo se debitan',
    `<button class="btn verde grande" id="chN">${ico('plus')} Cargar cheque</button>`) + `
    <div class="kpis" id="chK"></div>
    <div class="tabs" id="chT"><button data-v="PENDIENTES">Por debitar</button><button data-v="HISTORIAL">Debitados y anulados</button></div>
    <div id="chF"></div><div id="chL"></div>`;
  const cargar = async () => {
    $$('#chT button').forEach(b => b.classList.toggle('act', b.dataset.v === ver));
    datos = await api(`/api/cheques?ver=${ver}&desde=${f.desde}&hasta=${f.hasta}`);
    L = datos.lista;
    $('#chK').innerHTML = `
      <div class="kpi" style="--c:var(--rojo)"><small>Se debita hoy y mañana</small><b>${money(datos.hoy_manana)}</b><div class="det">${datos.hoy_manana_n} cheque${datos.hoy_manana_n === 1 ? '' : 's'}</div></div>
      <div class="kpi" style="--c:var(--naranja)"><small>En los próximos 7 días</small><b>${money(datos.semana)}</b><div class="det">${datos.semana_n} cheque${datos.semana_n === 1 ? '' : 's'}</div></div>
      <div class="kpi" style="--c:var(--violeta)"><small>Total por debitar</small><b>${money(datos.total)}</b><div class="det">${datos.n} cheque${datos.n === 1 ? '' : 's'}</div></div>`;
    $('#chF').innerHTML = ver === 'HISTORIAL' ? `<div class="inl" style="margin-bottom:12px"><div><label>Se pagaban desde</label><input type="date" id="chD" value="${f.desde}"></div>
      <div><label>Hasta</label><input type="date" id="chH" value="${f.hasta}"></div><button class="btn chico" id="chCsv" style="align-self:flex-end">${ico('bajar')} Excel</button></div>` : '';
    if ($('#chD')) { $('#chD').onchange = e => { f.desde = e.target.value; cargar(); }; $('#chH').onchange = e => { f.hasta = e.target.value; cargar(); };
      $('#chCsv').onclick = () => bajarCSV('cheques', ['Tipo', 'Número', 'Banco', 'A quién', 'Importe', 'Lo hice', 'Se paga', 'Estado', 'Debitado', 'Notas'],
        L.map(c => [TIPO_CH[c.tipo], c.numero, c.cuenta || '', c.quien, c.importe, c.emision, c.fecha_pago, c.estado, c.debitado_fecha, c.notas])); }
    if (!L.length) { $('#chL').innerHTML = `<div class="card vacio-g">${ico('cheque')}<p>${ver === 'PENDIENTES' ? 'No tenés cheques por debitar.' : 'No hay cheques en esas fechas.'}</p></div>`; return; }
    $('#chL').innerHTML = `<div class="card ch-lista">${L.map(c => { const col = c.estado !== 'PENDIENTE' ? '' : c.dias < 0 ? 'rojo' : c.dias <= 1 ? 'naranja' : '';
        return `<div class="ch-f ${col}" data-c="${c.id}" style="${c.estado === 'ANULADO' ? 'opacity:.55' : ''}">
        <div class="ch-fe"><b>${dmy(c.fecha_pago)}</b>${c.estado === 'PENDIENTE' ? `<span class="pill ${col || 'PENDIENTE'}">${c.dias < 0 ? '¿Ya se debitó? ' : ''}${cuandoCh(c.dias)}</span>` : c.estado === 'DEBITADO' ? `<span class="pill ATENDIDO">Debitado ${dm(c.debitado_fecha)}</span>` : '<span class="pill gris">Anulado</span>'}</div>
        <div class="ch-q"><b>${esc(c.quien)}</b><div class="muted chico">${TIPO_CH[c.tipo]}${c.numero ? ' N° ' + esc(c.numero) : ''}${c.cuenta ? ' · ' + esc(c.cuenta) : ''} · lo hiciste el ${dm(c.emision)}${c.pago_id ? ' · cargado como pago' : ''}</div></div>
        <div class="ch-i"><b>${money(c.importe)}</b>${c.estado === 'PENDIENTE' ? `<button class="btn chico verde" data-deb="${c.id}">${ico('check')} Debitado</button>` : ''}</div></div>`; }).join('')}
      ${ver === 'PENDIENTES' ? '<div class="ayuda" style="margin-top:10px">Cuando veas que el cheque salió de la cuenta, tocá "Debitado" y pasa al historial. Está aparte del calendario: no se mezcla con los turnos ni con lo anotado.</div>' : ''}</div>`;
  };
  $('#chT').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; ver = b.dataset.v; history.replaceState(null, '', '#cheques' + (ver === 'HISTORIAL' ? '/historial' : '')); cargar(); };
  $('#chN').onclick = () => cargarCheque({}, cargar);
  main.onclick = async e => {
    const d = e.target.closest('[data-deb]');
    if (d) { e.stopPropagation(); try { await api(`/api/cheques/${d.dataset.deb}/debitado`, { debitado: 1 }); toast('Cheque marcado como debitado'); cargar(); } catch (x) { fallo(x); } return; }
    const r = e.target.closest('[data-c]'); if (r) verCheque(+r.dataset.c, cargar);
  };
  cargar();
};

async function cargarCheque(pre, luego) {
  const L = await listas(true);
  const c = pre.id ? await api('/api/cheques/' + pre.id) : { tipo: 'ECHEQ', emision: hoy(), fecha_pago: '', proveedor_id: pre.proveedor_id || '', cuenta_id: '' };
  const bancos = L.cuentas.filter(x => (x.activo && x.tipo === 'BANCO') || x.id === c.cuenta_id);
  if (!c.cuenta_id) { const ch = bancos.find(x => /chaco/i.test(x.nombre)) || bancos[0]; c.cuenta_id = ch ? ch.id : ''; }
  const provs = L.prov.filter(x => x.activo || x.id === c.proveedor_id);
  const otro = !!(c.id && !c.proveedor_id);
  const m = modal(c.id ? 'Modificar cheque' : 'Cargar cheque', `
    <div class="seg grande" id="ccT">${Object.entries(TIPO_CH).map(([k, v]) => `<button type="button" data-t="${k}" class="${k === c.tipo ? 'act' : ''}">${v}${k === 'FISICO' ? ' (papel)' : ''}</button>`).join('')}</div>
    <div class="g" style="margin-top:12px">
      <div><label>A quién se lo diste</label><select id="ccP"><option value="">Elegí…</option>${provs.map(x => `<option value="${x.id}" ${x.id === +c.proveedor_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
        <option value="otro" ${otro ? 'selected' : ''}>Otro (escribir)</option></select></div>
      <div id="ccQw" style="${otro ? '' : 'display:none'}"><label>Nombre</label><input id="ccQ" value="${esc(c.a_quien || '')}" placeholder="Ej. Alquiler, contador"></div>
      <div><label>Importe</label>${campoMonto('id="ccI" style="font-size:18px;font-weight:800"', c.importe)}</div>
      <div><label>N° de cheque</label><input id="ccN" value="${esc(c.numero || '')}" inputmode="numeric"></div>
      <div><label>Lo hiciste el</label><input type="date" id="ccE" value="${esc(c.emision)}"></div>
      <div><label>Fecha de pago (cuándo se debita)</label><input type="date" id="ccF" value="${esc(c.fecha_pago)}"></div>
      <div style="${bancos.length > 1 ? '' : 'display:none'}"><label>Banco</label><select id="ccK">${bancos.map(x => `<option value="${x.id}" ${x.id === +c.cuenta_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}<option value="">—</option></select></div>
      <div class="full"><label>Nota (opcional)</label><input id="ccNo" value="${esc(c.notas || '')}" placeholder="Ej. paga resumen del 03/11"></div></div>
    ${bancos.length === 1 ? `<div class="muted chico" style="margin-top:6px">${ico('card')} De ${esc(bancos[0].nombre)}</div>` : ''}
    ${!c.id ? `<label class="chk" id="ccPw" style="margin-top:12px"><input type="checkbox" id="ccPg" checked> <span>Cargarlo también como <b>pago al proveedor</b> (así se descuenta de lo que le debés)</span></label>` : c.pago_id ? '<div class="ayuda" style="margin-top:10px">Está unido a un pago: si cambiás el importe o la fecha, el pago se cambia igual.</div>' : ''}`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn verde grande" id="ccOk">${ico('check')} Guardar cheque</button>`, 'xl', 'cheque');
  let tipo = c.tipo;
  $('#ccT', m).onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; tipo = b.dataset.t; $$('#ccT button', m).forEach(x => x.classList.toggle('act', x === b)); };
  const pq = () => { const o = $('#ccP', m).value === 'otro'; $('#ccQw', m).style.display = o ? '' : 'none'; if ($('#ccPw', m)) $('#ccPw', m).style.display = o || !$('#ccP', m).value ? 'none' : ''; };
  $('#ccP', m).onchange = pq; pq();
  setTimeout(() => (!$('#ccP', m).value ? $('#ccP', m) : $('#ccI', m)).focus(), 60);
  $('#ccOk', m).onclick = async () => {
    const pv = $('#ccP', m).value;
    if (!pv) return toast('Elegí a quién se lo diste', 'err');
    if (!$('#ccF', m).value) return toast('Poné la fecha de pago (cuándo se debita)', 'err');
    const d = { id: c.id, tipo, proveedor_id: pv === 'otro' ? '' : pv, a_quien: pv === 'otro' ? $('#ccQ', m).value : '', importe: $('#ccI', m).value, numero: $('#ccN', m).value,
      emision: $('#ccE', m).value, fecha_pago: $('#ccF', m).value, cuenta_id: $('#ccK', m).value, notas: $('#ccNo', m).value,
      como_pago: $('#ccPg', m) && $('#ccPg', m).checked && pv !== 'otro' ? 1 : 0 };
    try { const r = await apiConfirmando('/api/cheques', d); if (!r) return; m.cerrar(); olvidarListas(); toast(c.id ? 'Cheque modificado' : r.pago_id ? 'Cheque guardado y cargado como pago' : 'Cheque guardado'); luego && luego(); }
    catch (x) { fallo(x); }
  };
}

async function verCheque(id, luego) {
  const c = await api('/api/cheques/' + id), d = Math.round((new Date(c.fecha_pago + 'T12:00:00') - new Date(hoy() + 'T12:00:00')) / 864e5);
  const m = modal(`${TIPO_CH[c.tipo]}${c.numero ? ' N° ' + esc(c.numero) : ''}`, `
    <div style="font-size:26px;font-weight:800;margin-bottom:6px">${money(c.importe)}</div>
    <table class="t comp"><tbody>
      <tr><td>A quién</td><td><b>${esc(c.quien)}</b></td></tr>
      <tr><td>Banco</td><td>${esc(c.cuenta || '—')}</td></tr>
      <tr><td>Lo hiciste el</td><td>${dmy(c.emision)}</td></tr>
      <tr><td>Se debita</td><td><b>${dmy(c.fecha_pago)}</b> ${c.estado === 'PENDIENTE' ? `(${cuandoCh(d)})` : ''}</td></tr>
      <tr><td>Estado</td><td>${c.estado === 'PENDIENTE' ? 'Por debitar' : c.estado === 'DEBITADO' ? `<span class="pos">Debitado el ${dmy(c.debitado_fecha)}</span>` : 'Anulado · ' + esc(c.anulado_motivo)}</td></tr>
      ${c.pago_id ? `<tr><td>Pago</td><td><a href="#" id="vcPg">Ver el pago al proveedor</a>${c.pago_estado === 'ANULADO' ? ' (anulado)' : ''}</td></tr>` : ''}
      ${c.notas ? `<tr><td>Nota</td><td>${esc(c.notas)}</td></tr>` : ''}</tbody></table>`,
    `${c.estado !== 'ANULADO' ? `<button class="btn" id="vcAn" style="color:var(--rojo)">${ico('xc')} Anular</button>` : `<button class="btn" id="vcRe">Volver a pendiente</button>`}
     ${c.estado === 'DEBITADO' ? '<button class="btn" id="vcNo">No se debitó</button>' : ''}
     <button class="btn" id="vcEd">${ico('lapiz')} Modificar</button>
     ${c.estado === 'PENDIENTE' ? `<button class="btn verde" id="vcDb">${ico('check')} Debitado</button>` : '<button class="btn pri" data-cerrar>Cerrar</button>'}`, '', 'cheque');
  const fin = msg => { m.cerrar(); toast(msg); olvidarListas(); luego && luego(); };
  const b = (s, fn) => { const e = $(s, m); if (e) e.onclick = async ev => { ev.preventDefault(); try { await fn(); } catch (x) { fallo(x); } }; };
  b('#vcDb', async () => { await api(`/api/cheques/${id}/debitado`, { debitado: 1 }); fin('Cheque marcado como debitado'); });
  b('#vcNo', async () => { await api(`/api/cheques/${id}/debitado`, { debitado: 0 }); fin('Volvió a "por debitar"'); });
  b('#vcRe', async () => { await api(`/api/cheques/${id}/reactivar`, {}); fin('Cheque pendiente de nuevo'); });
  b('#vcEd', async () => { m.cerrar(); cargarCheque({ id }, luego); });
  b('#vcPg', async () => { m.cerrar(); verPago(c.pago_id, luego); });
  b('#vcAn', async () => {
    const mot = await pedirMotivo('Anular el cheque', 'No se borra: queda anotado como ANULADO con el motivo.' + (c.pago_id && c.pago_estado === 'ACTIVO' ? '<br><br>Como está cargado como pago, <b>también se anula el pago</b> (vuelve a figurar como deuda con el proveedor).' : ''));
    if (!mot) return;
    await api(`/api/cheques/${id}/anular`, { motivo: mot, anular_pago: 1 }); fin('Cheque anulado');
  });
}
