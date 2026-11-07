/* ================================================================ INICIO, PROVEEDORES, GASTOS, SUELDOS, INFORMES y DATOS */
const diasDesde = f => Math.round((new Date(hoy() + 'T12:00:00') - new Date(f + 'T12:00:00')) / 864e5);
const vtoTxt = f => { if (!f) return ''; const d = -diasDesde(f); return d < 0 ? `<span class="neg">venció el ${dm(f)}</span>` : d === 0 ? '<b class="neg">vence hoy</b>' : d === 1 ? '<b>vence mañana</b>' : `vence ${DIAS_C[diaSemana(f)]} ${dm(f)}`; };

P.principal = async (main) => {
  const d = await api('/api/inicio');
  const tv = d.sin_acreditar.reduce((a, x) => a + x.importe, 0);
  main.innerHTML = cabecera('home', CFG().nombre_negocio || 'Inicio', fechaLarga(hoy()),
    `<button class="btn" id="inR">${ico('file')} Cargar resumen / factura</button><button class="btn verde grande" id="inP">${ico('plus')} Cargar pago</button>`) +
    `<div class="kpis"><div class="kpi" style="--c:var(--rojo)"><small>Les debés a los proveedores</small><b>${money(d.deuda)}</b></div>
      <div class="kpi" style="--c:var(--naranja)"><small>A pagar en los próximos 7 días</small><b>${money(d.vence_semana)}</b></div>
      <div class="kpi" style="--c:var(--violeta)" data-ir="pagos" data-a="sinacreditar"><small>Pagado y todavía sin acreditar</small><b>${money(tv)}</b><div class="det">${d.sin_acreditar.length} pago${d.sin_acreditar.length === 1 ? '' : 's'}</div></div>
      <div class="kpi" style="--c:var(--turquesa)"><small>Pagado en ${MESES[+hoy().slice(5, 7) - 1].toLowerCase()}</small><b>${money((d.mes.PROVEEDOR || 0) + (d.mes.GASTO || 0) + (d.mes.SUELDO || 0))}</b>
        <div class="det">Proveedores ${money0(d.mes.PROVEEDOR || 0)} · gastos ${money0(d.mes.GASTO || 0)} · sueldos ${money0(d.mes.SUELDO || 0)}</div></div></div>
    ${d.sin_comprobante ? `<div class="aviso" style="margin-bottom:12px">${ico('clip')} Hay <b>${d.sin_comprobante}</b> pago${d.sin_comprobante === 1 ? '' : 's'} de los últimos 60 días sin comprobante adjunto. <a href="#" id="inSC">Ver</a></div>` : ''}
    <h3 class="sep-t">${ico('edificio')} Para pagar (próximos 7 días)</h3>
    <div class="prov-grid">${d.proveedores.map(p => `<div class="card prov-c" data-p="${p.id}"><div class="inl" style="justify-content:space-between"><b style="font-size:16px">${esc(p.nombre)}</b>
        ${p.vencido > 0.009 ? '<span class="pill rojo">Vencido</span>' : p.vence_semana > 0.009 ? '<span class="pill naranja">Vence en 7 días</span>' : p.saldo > 0.009 ? '' : '<span class="pill ATENDIDO">Al día</span>'}</div>
      <div class="prov-n"><small>Le debés</small><b class="${p.saldo > 0.009 ? 'neg' : ''}">${money(Math.max(0, p.saldo))}</b></div>
      ${p.saldo < -0.009 ? `<div class="pos chico">Tenés ${money(-p.saldo)} a favor</div>` : ''}
      ${p.pendientes.map(x => `<div class="pend-r"><span>Resumen ${dm(x.fecha)} · ${vtoTxt(x.vencimiento)}</span><b>${money0(x.falta)}</b></div>`).join('')}
      ${p.sin_acreditar_n ? `<div class="muted chico" style="margin-top:6px">${ico('reloj')} ${p.sin_acreditar_n} pago${p.sin_acreditar_n === 1 ? '' : 's'} sin acreditar (${money0(p.sin_acreditar)})</div>` : ''}
      <div class="inl" style="margin-top:10px"><button class="btn chico verde" data-pp="${p.id}">${ico('peso')} Pagar</button><button class="btn chico" data-rr="${p.id}">${ico('file')} Resumen</button></div></div>`).join('')
      || `<div class="card vacio-g">${ico('edificio')}<p>Cargá los proveedores en Proveedores.</p></div>`}</div>
    <div class="cols2"><div class="card"><h3>${ico('reloj')} Pagos sin acreditar</h3>
      ${d.sin_acreditar.length ? `<div class="tabla-x"><table class="t comp"><tbody>${d.sin_acreditar.map(x => `<tr data-g="${x.id}" class="${x.demorado ? 'demorado' : ''}" style="cursor:pointer">
        <td class="chico">${dmy(x.fecha)}<div class="${x.demorado ? 'neg' : 'muted'}">${x.dias === 0 ? 'hoy' : `hace ${x.dias} día${x.dias === 1 ? '' : 's'}`}</div></td><td><b>${esc(x.proveedor)}</b><div class="muted chico">${esc(MEDIOS[x.medio] || '')}${x.cuenta ? ' · ' + esc(x.cuenta) : ''}${x.operacion ? ' · op. ' + esc(x.operacion) : ''}</div></td>
        <td class="r"><b>${money(x.importe)}</b></td><td>${x.n_adjuntos ? ico('clip') : '<span class="neg chico">sin comp.</span>'}</td>
        <td><button class="btn chico" data-ac="${x.id}">${ico('check')} Acreditado</button></td></tr>`).join('')}</tbody></table></div>
        <div class="ayuda">Cuando veas el pago reflejado en la cuenta de la droguería, tocá "Acreditado". En rojo: hace más de ${d.dias_aviso} días.</div>` : '<div class="muted">Todos tus pagos ya figuran acreditados. 👍</div>'}</div>
      <div class="card"><h3>${ico('hist')} Lo último que cargaste</h3><table class="t comp"><tbody>${d.ultimos.map(x => `<tr data-g="${x.id}" style="cursor:pointer"><td class="chico">${dmy(x.fecha)}</td>
        <td><span class="tipo-i t${x.tipo}">${ico(TIPO_ICO[x.tipo])}</span> ${esc(quienPago(x))}</td><td class="r">${money0(x.importe)}</td><td>${miniComp(x.adjunto)}</td></tr>`).join('') || '<tr><td class="vacio">Todavía no cargaste pagos</td></tr>'}</tbody></table></div></div>`;
  const re = () => ir('principal');
  $('#inP').onclick = () => cargarPago({}, re);
  $('#inR').onclick = () => cargarResumen({}, re);
  if ($('#inSC')) $('#inSC').onclick = e => { e.preventDefault(); sinComprobante(); };
  main.onclick = async e => {
    const v = e.target.closest('[data-ver]'); if (v) return verArchivo(v.dataset.ver);
    const pp = e.target.closest('[data-pp]'); if (pp) return cargarPago({ tipo: 'PROVEEDOR', proveedor_id: +pp.dataset.pp }, re);
    const rr = e.target.closest('[data-rr]'); if (rr) return cargarResumen({ proveedor_id: +rr.dataset.rr }, re);
    const a = e.target.closest('[data-ac]'); if (a) { await api(`/api/pagos/${a.dataset.ac}/acreditado`, { acreditado: 1 }); toast('Marcado como acreditado'); return re(); }
    const g = e.target.closest('[data-g]'); if (g) return verPago(+g.dataset.g, re);
    const k = e.target.closest('[data-ir]'); if (k) return ir(k.dataset.ir, k.dataset.a);
    const p = e.target.closest('[data-p]'); if (p) ir('proveedor', p.dataset.p);
  };
};

async function sinComprobante() {
  const l = (await api('/api/pagos?desde=' + sumarDias(hoy(), -60))).filter(p => !p.n_adjuntos && p.medio !== 'EFECTIVO');
  const m = modal('Pagos sin comprobante', `<p class="muted" style="margin-top:0">Tocá uno para adjuntarle la foto o el PDF.</p><div class="tabla-x"><table class="t comp"><tbody>${l.map(filaPago).join('')}</tbody></table></div>`,
    '<button class="btn pri" data-cerrar>Cerrar</button>', 'xl', 'clip');
  m.onclick = e => { const r = e.target.closest('[data-g]'); if (r) { m.cerrar(); verPago(+r.dataset.g, () => ir('principal')); } };
}

/* ---------------------------------------------------------------- PROVEEDORES */
P.proveedores = async (main) => {
  const l = await api('/api/proveedores');
  main.innerHTML = cabecera('edificio', 'Proveedores', 'Lo que te facturan, lo que les pagaste y el saldo de cada uno', `<button class="btn pri" id="prN">${ico('plus')} Agregar proveedor</button>`) +
    `<div class="card"><div class="tabla-x"><table class="t"><thead><tr><th>Proveedor</th><th class="r">Le debés</th><th class="r">Próximos 7 días</th><th class="r ocultar-movil">Sin acreditar</th><th class="ocultar-movil">Último pago</th><th></th></tr></thead><tbody>
    ${l.map(p => `<tr data-p="${p.id}" class="${p.activo ? '' : 'anulado'}" style="cursor:pointer"><td><b>${esc(p.nombre)}</b>${p.principal ? ' <span class="pill os">Principal</span>' : ''}${p.contacto || p.telefono ? `<div class="muted chico">${esc([p.contacto, p.telefono].filter(Boolean).join(' · '))}</div>` : ''}</td>
      <td class="r ${p.saldo > 0.009 ? 'neg' : p.saldo < -0.009 ? 'pos' : ''}"><b>${p.saldo < -0.009 ? 'a favor ' + money(-p.saldo) : money(p.saldo)}</b></td>
      <td class="r">${p.vence_semana > 0.009 ? `<b>${money(p.vence_semana)}</b>${p.vencido > 0.009 ? '<div class="neg chico">hay vencido</div>' : ''}` : '<span class="muted">—</span>'}</td>
      <td class="r ocultar-movil">${p.sin_acreditar_n ? `${money0(p.sin_acreditar)} <span class="muted chico">(${p.sin_acreditar_n})</span>` : ''}</td><td class="chico ocultar-movil">${p.ultimo_pago ? dmy(p.ultimo_pago) : ''}</td>
      <td><div class="acc"><button class="ab verde" data-pp="${p.id}" data-tip="Cargar pago">${ico('peso')}</button><button class="ab gris" data-rr="${p.id}" data-tip="Cargar resumen">${ico('file')}</button></div></td></tr>`).join('')}</tbody>
    <tfoot><tr><td>TOTAL</td><td class="r">${money(l.reduce((a, p) => a + Math.max(0, p.saldo), 0))}</td><td class="r">${money(l.reduce((a, p) => a + p.vence_semana, 0))}</td><td class="r ocultar-movil">${money(l.reduce((a, p) => a + p.sin_acreditar, 0))}</td><td colspan="2"></td></tr></tfoot></table></div></div>`;
  $('#prN').onclick = () => editarProveedor({}, id => ir('proveedor', id));
  main.onclick = e => {
    const pp = e.target.closest('[data-pp]'); if (pp) return cargarPago({ tipo: 'PROVEEDOR', proveedor_id: +pp.dataset.pp }, () => ir('proveedores'));
    const rr = e.target.closest('[data-rr]'); if (rr) return cargarResumen({ proveedor_id: +rr.dataset.rr }, () => ir('proveedores'));
    const p = e.target.closest('[data-p]'); if (p) ir('proveedor', p.dataset.p);
  };
};

function editarProveedor(p, luego) {
  const m = modal(p.id ? 'Modificar proveedor' : 'Agregar proveedor', `<div class="g">
    <div class="full"><label>Nombre</label><input name="nombre" value="${esc(p.nombre || '')}" placeholder="Ej. Laboratorio, distribuidora de perfumería"></div>
    <div><label>CUIT</label><input name="cuit" value="${esc(p.cuit || '')}"></div><div><label>Días para pagar el resumen</label><input name="dias_pago" inputmode="numeric" value="${esc(p.dias_pago || 7)}"><div class="ayuda">Para calcular solo la fecha de pago</div></div>
    <div><label>Contacto (cobranzas)</label><input name="contacto" value="${esc(p.contacto || '')}"></div><div><label>Teléfono / WhatsApp</label><input name="telefono" value="${esc(p.telefono || '')}"></div>
    <div><label>Email</label><input name="email" value="${esc(p.email || '')}"></div><div><label>CBU / alias para transferir</label><input name="cbu" value="${esc(p.cbu || '')}"></div>
    <div class="full"><label>Notas</label><textarea name="notas">${esc(p.notas || '')}</textarea></div>
    <div class="full inl" style="gap:18px"><label class="chk"><input type="checkbox" name="principal" ${p.principal ? 'checked' : ''}> Proveedor principal (siempre en el Inicio)</label>
      ${p.id ? `<label class="chk"><input type="checkbox" name="activo" ${p.activo ? 'checked' : ''}> Activo</label>` : ''}</div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="epOk">${ico('check')} Guardar</button>`, 'ancho', 'edificio');
  $('#epOk', m).onclick = async () => { const d = leer($('.mb', m)); d.id = p.id; if (!p.id) d.activo = 1;
    try { const r = await api('/api/proveedores', d); m.cerrar(); olvidarListas(); toast('Proveedor guardado'); luego && luego(r.id); } catch (e) { fallo(e); } };
}

/* resumen semanal / factura que llega */
async function cargarResumen(pre = {}, luego) {
  const L = await listas(true);
  const r = pre;
  const prov = id => L.prov.find(x => x.id === +id);
  const m = modal(r.id ? 'Modificar resumen' : 'Cargar resumen o factura', `<div class="g">
    <div class="full"><label>Proveedor</label><select id="crP"><option value="">Elegí…</option>${L.prov.filter(x => x.activo).map(x => `<option value="${x.id}" ${x.id === +r.proveedor_id ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}</select></div>
    <div><label>Fecha de cierre del resumen</label><input type="date" id="crF" value="${esc(r.fecha || hoy())}"></div>
    <div><label>Fecha de pago (vencimiento)</label><input type="date" id="crV" value="${esc(r.vencimiento || '')}"><div class="ayuda" id="crVa"></div></div>
    <div><label>Importe a pagar</label>${campoMonto('id="crI" style="font-size:18px;font-weight:800"', r.importe)}</div>
    <div><label>N° de resumen / factura (opcional)</label><input id="crN" value="${esc(r.numero || '')}"></div>
    <div class="full"><label>Notas</label><input id="crO" value="${esc(r.notas || '')}" placeholder="Ej. incluye perfumería"></div></div>
    ${r.id ? '' : '<label style="margin-top:10px">Foto o PDF del resumen (opcional)</label><div id="crA"></div>'}
    <div class="ayuda" style="margin-top:8px">Para empezar: si ya le debías algo de antes, cargalo como un resumen con la nota "saldo anterior".</div>`,
    `${r.id ? `<button class="btn rojo" id="crB">${ico('trash')} Borrar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="crOk">${ico('check')} Guardar</button>`, 'ancho', 'file');
  const zona = r.id ? null : zonaAdjuntos($('#crA', m), []);
  const c0 = m.cerrar; m.cerrar = () => { zona && zona.soltar(); c0(); };
  const sugerir = () => { const p = prov($('#crP', m).value); const f = $('#crF', m).value; if (!p || !f) return;
    const v = sumarDias(f, p.dias_pago || 7); if (!r.id || !$('#crV', m).value) $('#crV', m).value = v; $('#crVa', m).textContent = `${p.dias_pago || 7} días después del cierre`; };
  $('#crP', m).onchange = sugerir; $('#crF', m).onchange = sugerir; if (!r.id) sugerir();
  setTimeout(() => ($('#crP', m).value ? $('#crI', m) : $('#crP', m)).focus(), 60);
  $('#crOk', m).onclick = async () => {
    try { const x = await apiConfirmando('/api/resumenes', { id: r.id, proveedor_id: $('#crP', m).value, fecha: $('#crF', m).value, vencimiento: $('#crV', m).value, importe: $('#crI', m).value, numero: $('#crN', m).value, notas: $('#crO', m).value });
      if (!x) return; if (zona) { try { await subirAdjuntos({ resumen_id: x.id }, zona.pendientes()); } catch (e) { fallo(e); } }
      m.cerrar(); olvidarListas(); toast('Resumen guardado'); luego && luego(); } catch (e) { fallo(e); }
  };
  if ($('#crB', m)) $('#crB', m).onclick = async () => { if (!await confirmar('¿Borrar este resumen?', 'Borrar')) return; await api('/api/resumenes/' + r.id, undefined, 'DELETE'); m.cerrar(); olvidarListas(); toast('Resumen borrado'); luego && luego(); };
}

P.proveedor = async (main, id) => {
  const p = await api('/api/proveedores/' + id);
  const re = () => ir('proveedor', id);
  main.innerHTML = cabecera('edificio', p.nombre, [p.contacto, p.telefono, p.cbu && 'CBU/alias ' + p.cbu].filter(Boolean).join(' · ') || 'Proveedor',
    `<button class="btn" id="pvV">${ico('izq')} Proveedores</button><button class="btn" id="pvE">${ico('lapiz')} Datos</button><button class="btn" id="pvR">${ico('file')} Cargar resumen</button>
     <button class="btn verde grande" id="pvP">${ico('peso')} Cargar pago</button>`) +
    `<div class="kpis"><div class="kpi" style="--c:var(--rojo)"><small>Le debés (según tus pagos)</small><b class="${p.saldo > 0.009 ? 'neg' : 'pos'}">${p.saldo < -0.009 ? 'a favor ' + money(-p.saldo) : money(p.saldo)}</b></div>
      <div class="kpi" style="--c:var(--violeta)"><small>Pagado sin acreditar</small><b>${money(p.sin_acreditar)}</b><div class="det">${p.sin_acreditar_n} pago${p.sin_acreditar_n === 1 ? '' : 's'}</div></div>
      <div class="kpi" style="--c:var(--naranja)"><small>Lo que te debería figurar en ${esc(p.nombre)}</small><b>${money(p.saldo_proveedor)}</b><div class="det">hasta que acrediten lo pendiente</div></div>
      <div class="kpi" style="--c:var(--turquesa)"><small>Total facturado / pagado</small><b style="font-size:17px">${money0(p.facturado)} / ${money0(p.pagado)}</b></div></div>
    <div class="prov-ed"><div class="card"><h3>${ico('file')} Resúmenes y facturas</h3>
      <div class="tabla-x"><table class="t comp"><thead><tr><th>Cierre</th><th>Pago</th><th class="r">Importe</th><th class="r">Falta</th><th></th></tr></thead><tbody>
      ${p.resumenes.slice().reverse().map(x => `<tr data-r="${x.id}" style="cursor:pointer" class="${x.vencido ? 'demorado' : ''}"><td class="chico">${dmy(x.fecha)}${x.numero ? `<div class="muted">N° ${esc(x.numero)}</div>` : ''}${x.notas ? `<div class="muted">${esc(x.notas)}</div>` : ''}</td>
        <td class="chico">${x.falta > 0.009 ? vtoTxt(x.vencimiento) : dmy(x.vencimiento)}</td><td class="r">${money(x.importe)}</td>
        <td class="r">${x.falta > 0.009 ? `<b class="neg">${money(x.falta)}</b>` : ''}</td><td>${x.estado_pago === 'PAGADO' ? '<span class="pill ATENDIDO">Pagado</span>' : x.estado_pago === 'PARCIAL' ? '<span class="pill naranja">Parcial</span>' : '<span class="pill rojo">Pendiente</span>'}</td></tr>`).join('')
        || '<tr><td colspan="5" class="vacio">Todavía no cargaste resúmenes</td></tr>'}</tbody></table></div>
      <div class="ayuda">Los pagos se descuentan primero de los resúmenes que vencen antes.</div></div>
    <div class="card"><h3>${ico('cuenta')} Cuenta corriente</h3><div class="tabla-x"><table class="t comp"><thead><tr><th>Fecha</th><th>Movimiento</th><th class="r">Importe</th><th class="r">Saldo</th><th></th></tr></thead><tbody>
      ${p.movimientos.map(mv => `<tr ${mv.tipo === 'PAGO' ? `data-g="${mv.id}"` : `data-r="${mv.id}"`} style="cursor:pointer"><td class="chico">${dmy(mv.fecha)}</td>
        <td>${mv.tipo === 'RESUMEN' ? `Resumen${mv.x.numero ? ' N° ' + esc(mv.x.numero) : ''}` : `Pago${mv.x.cuenta ? ' · ' + esc(mv.x.cuenta) : ''}<div class="muted chico">${esc(MEDIOS[mv.x.medio] || '')}${mv.x.acreditado ? '' : ' · <b style="color:var(--naranja)">sin acreditar</b>'}</div>`}</td>
        <td class="r">${mv.debe ? money0(mv.debe) : `<span class="pos">-${money0(mv.haber)}</span>`}</td><td class="r ${mv.saldo > 0.009 ? 'neg' : ''}">${money0(mv.saldo)}</td>
        <td>${mv.adjuntos.length ? miniComp(mv.adjuntos[0].archivo) : mv.tipo === 'PAGO' && mv.x.medio !== 'EFECTIVO' ? '<span class="neg chico">sin comp.</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin movimientos</td></tr>'}</tbody></table></div></div></div>`;
  $('#pvV').onclick = () => ir('proveedores');
  $('#pvE').onclick = () => editarProveedor(p, re);
  $('#pvR').onclick = () => cargarResumen({ proveedor_id: p.id }, re);
  $('#pvP').onclick = () => cargarPago({ tipo: 'PROVEEDOR', proveedor_id: p.id }, re);
  main.onclick = e => {
    const v = e.target.closest('[data-ver]'); if (v) return verArchivo(v.dataset.ver);
    const g = e.target.closest('[data-g]'); if (g) return verPago(+g.dataset.g, re);
    const r = e.target.closest('[data-r]'); if (r) { const x = p.resumenes.find(z => z.id === +r.dataset.r); if (x) cargarResumen(x, re); }
  };
};

/* ---------------------------------------------------------------- GASTOS y SUELDOS */
const RM = { desde: primeroMes(), hasta: hoy() };
const filtroMes = () => `<div class="barra-filtro"><div><label>Desde</label><input type="date" id="rmD" value="${RM.desde}"></div><div><label>Hasta</label><input type="date" id="rmH" value="${RM.hasta}"></div>
  <div><button class="btn chico" data-rm="mes">Este mes</button> <button class="btn chico" data-rm="ant">Mes anterior</button> <button class="btn chico" data-rm="anio">Este año</button></div></div>`;
function engancharFiltroMes(re) {
  $('#rmD').onchange = e => { RM.desde = e.target.value; re(); };
  $('#rmH').onchange = e => { RM.hasta = e.target.value; re(); };
  $$('[data-rm]').forEach(b => b.onclick = () => { const h = hoy();
    if (b.dataset.rm === 'mes') { RM.desde = primeroMes(); RM.hasta = h; }
    if (b.dataset.rm === 'ant') { const u = sumarDias(primeroMes(), -1); RM.desde = u.slice(0, 8) + '01'; RM.hasta = u; }
    if (b.dataset.rm === 'anio') { RM.desde = h.slice(0, 4) + '-01-01'; RM.hasta = h; }
    re(); });
}

P.gastos = async (main) => {
  const l = await api(`/api/pagos?tipo=GASTO&desde=${RM.desde}&hasta=${RM.hasta}`);
  const porCat = {}; l.forEach(p => porCat[p.categoria] = (porCat[p.categoria] || 0) + p.importe);
  const re = () => ir('gastos');
  main.innerHTML = cabecera('peso', 'Gastos', 'Alquiler, internet, luz, impuestos y gastos personales que salen de la cuenta de la farmacia',
    `<button class="btn verde grande" id="gaN">${ico('plus')} Cargar gasto</button>`) + filtroMes() +
    `<div class="kpis"><div class="kpi" style="--c:var(--pri)"><small>Total de gastos</small><b>${money(l.reduce((a, p) => a + p.importe, 0))}</b><div class="det">${l.length} pagos</div></div>
      ${Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, t]) => `<div class="kpi" style="--c:var(--turquesa)"><small>${esc(c)}</small><b>${money(t)}</b></div>`).join('')}</div>
    <div class="card"><div class="tabla-x"><table class="t comp"><thead><tr><th>Fecha</th><th>Gasto</th><th class="r">Importe</th><th>Cómo / desde</th><th class="ocultar-movil">N° operación</th><th>Comp.</th><th></th></tr></thead>
      <tbody>${l.map(filaPago).join('') || '<tr><td colspan="7" class="vacio">No hay gastos en esas fechas</td></tr>'}</tbody></table></div></div>
    <div class="ayuda">Los tipos de gasto (Alquiler, Internet…) se cambian en Datos > Configuración.</div>`;
  engancharFiltroMes(re);
  $('#gaN').onclick = () => cargarPago({ tipo: 'GASTO' }, re);
  main.onclick = e => { const v = e.target.closest('[data-ver]'); if (v) return verArchivo(v.dataset.ver); const r = e.target.closest('[data-g]'); if (r) verPago(+r.dataset.g, re); };
};

function editarEmpleado(x, luego) {
  const c = CFG();
  const m = modal(x.id ? 'Modificar empleado' : 'Agregar empleado', `<div class="g">
    <div class="full"><label>Nombre y apellido</label><input name="nombre" value="${esc(x.nombre || '')}"></div>
    <div><label>Cobra por día</label>${campoMonto('name="valor_dia"', x.id ? x.valor_dia : aNum(c.sueldo_valor_dia))}</div>
    <div><label>Días por semana</label><input name="dias_semana" inputmode="decimal" value="${esc(String(x.id ? x.dias_semana ?? 7 : c.sueldo_dias || 7).replace('.', ','))}"></div>
    <div><label>Cena cuando hace turno</label>${campoMonto('name="cena"', x.id ? x.cena : aNum(c.sueldo_cena))}</div>
    <div><label>CBU / alias</label><input name="cbu" value="${esc(x.cbu || '')}"></div>
    <div><label>CUIL</label><input name="cuil" value="${esc(x.cuil || '')}"></div><div><label>Teléfono</label><input name="telefono" value="${esc(x.telefono || '')}"></div>
    <div><label>Llevar la cuenta desde</label><input type="date" name="cuenta_desde" value="${esc(x.cuenta_desde || sumarDias(viernesDe(hoy()), -6))}"><div class="ayuda">Los pagos de antes no cuentan</div></div>
    <div><label>Saldo al empezar (opcional)</label>${campoMonto('name="saldo_inicial"', x.saldo_inicial || '')}<div class="ayuda">Si le debías algo, en positivo. Si te debía (adelanto viejo), en negativo: -50.000</div></div>
    <div class="full"><label>Notas</label><input name="notas" value="${esc(x.notas || '')}"></div>
    ${x.id ? `<div class="full"><label class="chk"><input type="checkbox" name="activo" ${x.activo ? 'checked' : ''}> Trabaja en la farmacia</label></div>` : ''}</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="eeOk">${ico('check')} Guardar</button>`, 'ancho', 'user');
  $('#eeOk', m).onclick = async () => { const d = leer($('.mb', m)); d.id = x.id; if (!x.id) d.activo = 1;
    try { const r = await api('/api/empleados', d); m.cerrar(); olvidarListas(); toast('Guardado'); luego && luego(r.id); } catch (e) { fallo(e); } };
}

/* ---------------------------------------------------------------- SUELDOS SEMANALES (se pagan los viernes) */
let SU_VIE = null;
const nDias = n => String(+n || 0).replace('.', ',');
const rangoSemana = v => `sáb ${dmy(sumarDias(v, -6)).slice(0, 5)} al vie ${dmy(v).slice(0, 5)}`;
function lineaSaldo(v, cuando) {
  if (Math.abs(v) < 0.01) return `<span class="muted">${cuando}: al día</span>`;
  return v > 0 ? `${cuando} le quedaste debiendo <b class="neg">${money(v)}</b>` : `${cuando} cobró de más <b class="pos">${money(-v)}</b> <span class="muted">(se descuenta)</span>`;
}
P.sueldos = async (main) => {
  SU_VIE = SU_VIE || viernesDe(hoy());
  const r = await api('/api/sueldos?viernes=' + SU_VIE);
  const re = () => ir('sueldos');
  const esEsta = r.viernes === viernesDe(hoy());
  main.innerHTML = cabecera('users', 'Sueldos', 'Cada semana cuenta sola como semana normal. Si hubo turno, falta o algo distinto, tocá "Días y turnos".',
    `<button class="btn" id="suE">${ico('plus')} Agregar empleado</button>`) +
    `<div class="card su-sem"><button class="btn" id="suAnt" title="Semana anterior">${ico('izq')}</button>
      <div class="su-sem-t"><b>Semana del ${rangoSemana(r.viernes)}</b><small>${esEsta ? 'esta semana · se paga este viernes' : r.viernes < hoy() ? 'semana pasada' : 'semana que viene'}</small></div>
      <button class="btn" id="suSig" title="Semana siguiente" style="transform:scaleX(-1)">${ico('izq')}</button>
      ${esEsta ? '' : `<button class="btn chico" id="suHoy">Ir a esta semana</button>`}</div>
    <div class="kpis"><div class="kpi" style="--c:var(--pri)"><small>Ganaron esta semana</small><b>${money(r.total_semana)}</b></div>
      <div class="kpi" style="--c:var(--verde, #1f9d55)"><small>Falta pagar el viernes ${dmy(r.viernes).slice(0, 5)}</small><b>${money(r.total_a_pagar)}</b></div></div>
    <div class="su-grid">${r.empleados.map(x => {
      const w = x.semana, e = x.empleado;
      return `<div class="card su-c" data-emp="${e.id}">
        <div class="su-cab"><b>${esc(e.nombre)}</b><span><button class="ab" data-ee="${e.id}" title="Modificar empleado">${ico('lapiz')}</button></span></div>
        ${w.fuera ? `<div class="su-falta">${ico('alerta')} Esta semana es anterior a cuando empezaste a llevar la cuenta (${dmy(e.cuenta_desde)})</div>` : ''}
        <div class="su-fila"><span>Semana: ${nDias(w.dias)} días × ${money0(w.valor_dia)}${w.turnos ? ` + ${nDias(w.turnos)} turno${w.turnos == 1 ? '' : 's'}` : ''}${w.extra ? ` + ${money0(w.extra)} ${esc(w.extra_detalle || 'extra')}` : ''}
          ${w.propuesta && !w.fuera ? '<em class="muted">(semana normal)</em>' : ''}</span><b>${money(w.total)}</b></div>
        ${w.turnos ? `<div class="su-sub muted">Turnos: ${nDias(w.turnos)} × (${money0(w.valor_dia)} + cena ${money0(w.cena)})</div>` : ''}
        <div class="su-fila"><span>${lineaSaldo(x.saldo_antes, 'De antes')}</span><b>${Math.abs(x.saldo_antes) < 0.01 ? '' : (x.saldo_antes > 0 ? '+ ' : '− ') + money(Math.abs(x.saldo_antes))}</b></div>
        ${x.pagos.map(p => `<div class="su-fila su-pago" data-g="${p.id}"><span>${p.adelanto ? 'Adelanto' : 'Pagado'} el ${DIAS_C[(new Date(p.fecha + 'T12:00').getDay() + 6) % 7].toLowerCase()} ${dmy(p.fecha).slice(0, 5)}</span><b>− ${money(p.importe)}</b></div>`).join('')}
        <div class="su-total ${x.a_pagar < -0.009 ? 'afavor' : x.a_pagar < 0.01 ? 'aldia' : ''}">${x.a_pagar > 0.009 ? `<span>A pagar el viernes</span><b>${money(x.a_pagar)}</b>`
          : x.a_pagar < -0.009 ? `<span>Cobró de más · se descuenta el viernes ${dmy(sumarDias(r.viernes, 7)).slice(0, 5)}</span><b>${money(-x.a_pagar)}</b>` : `<span>Semana pagada</span><b>${ico('check')}</b>`}</div>
        <div class="su-bot">
          ${x.a_pagar > 0.009 ? `<button class="btn verde" data-pagar="${e.id}">${ico('peso')} Pagar ${money0(x.a_pagar)}</button>` : ''}
          <button class="btn" data-adel="${e.id}">${ico('plus')} Adelanto</button>
          <button class="btn" data-sem="${e.id}">${ico('lapiz')} Días y turnos</button>
          <button class="btn" data-cta="${e.id}">${ico('cuenta')} Cuenta</button></div></div>`; }).join('') || `<div class="card vacio-g">${ico('users')}<p>Agregá a los chicos que trabajan en la farmacia.</p></div>`}</div>
    <div class="ayuda">Cómo se calcula: cada semana (sábado a viernes) cuenta sola como semana normal: días × lo que cobra por día. Si hizo turno, faltó o hubo un extra, cambialo en "Días y turnos" (cada turno es un día más + la cena). A eso se le resta lo que ya le pagaste o adelantaste en la semana,
      y se suma o resta lo que quedó de la semana anterior. Si un viernes le pagás más de lo que le toca, la diferencia aparece como "cobró de más" y se descuenta sola el viernes siguiente.</div>`;
  const est = id => r.empleados.find(x => x.empleado.id === id);
  $('#suE').onclick = () => editarEmpleado({}, re);
  $('#suAnt').onclick = () => { SU_VIE = sumarDias(r.viernes, -7); re(); };
  $('#suSig').onclick = () => { SU_VIE = sumarDias(r.viernes, 7); re(); };
  if ($('#suHoy')) $('#suHoy').onclick = () => { SU_VIE = viernesDe(hoy()); re(); };
  main.onclick = e => {
    const b = e.target.closest('button,[data-g]'); if (!b) return;
    if (b.dataset.ee) return editarEmpleado(est(+b.dataset.ee).empleado, re);
    if (b.dataset.sem) return editarSemana(+b.dataset.sem, r.viernes, false, re);
    if (b.dataset.pagar) return editarSemana(+b.dataset.pagar, r.viernes, true, re);
    if (b.dataset.adel) { const x = est(+b.dataset.adel);
      return cargarPago({ tipo: 'SUELDO', empleado_id: x.empleado.id, adelanto: 1, periodo: 'Adelanto semana al vie ' + dmy(r.viernes).slice(0, 5), fecha: r.viernes < hoy() ? r.viernes : hoy() }, re); }
    if (b.dataset.cta) return cuentaEmpleado(+b.dataset.cta);
    if (b.dataset.g) return verPago(+b.dataset.g, re);
  };
};

/* días trabajados, turnos y extras de una semana; con "pagar" sigue directo al pago */
async function editarSemana(eid, viernes, pagar, luego) {
  const x = await api(`/api/sueldos/${eid}?viernes=${viernes}`), w = x.semana, e = x.empleado;
  const m = modal(`${esc(e.nombre)} · semana del ${rangoSemana(x.viernes)}`, `<div class="g">
    <div><label>Días que trabajó</label><input id="swD" inputmode="decimal" value="${nDias(w.dias)}"><div class="ayuda">De 0 a 7 (medio día: 0,5)</div></div>
    <div><label>Cobra por día</label>${campoMonto('id="swV"', w.valor_dia)}</div>
    <div><label>Turnos que hizo</label><input id="swT" inputmode="numeric" value="${nDias(w.turnos)}"><div class="ayuda">Cada turno: un día más + la cena</div></div>
    <div><label>Cena por turno</label>${campoMonto('id="swC"', w.cena)}</div>
    <div><label>Extra (opcional)</label>${campoMonto('id="swX"', w.extra || '')}<div class="ayuda">Negativo para descontar</div></div>
    <div><label>Qué es el extra</label><input id="swXd" value="${esc(w.extra_detalle || '')}" placeholder="Ej. feriado, premio, faltante de caja"></div>
    <div class="full"><label>Notas</label><input id="swN" value="${esc(w.notas || '')}"></div></div>
    <div class="su-calc" id="swR"></div>`,
    `${!w.propuesta ? `<button class="btn rojo" id="swB">${ico('trash')} Borrar semana</button>` : ''}<button class="btn" data-cerrar>Cancelar</button>
     <button class="btn ${pagar ? '' : 'pri'}" id="swOk">${ico('check')} Guardar</button>${pagar ? `<button class="btn verde grande" id="swPg">${ico('peso')} Guardar y pagar</button>` : ''}`, 'ancho', 'users');
  const calc = () => {
    const d = aNum($('#swD', m).value) || 0, v = aNum($('#swV', m).value) || 0, t = aNum($('#swT', m).value) || 0, c = aNum($('#swC', m).value) || 0, ex = aNum($('#swX', m).value) || 0;
    const tot = d * v + t * (v + c) + ex, ap = x.saldo_antes + tot - x.pagado;
    $('#swR', m).innerHTML = `<div><span>${nDias(d)} días × ${money0(v)}</span><b>${money(d * v)}</b></div>
      ${t ? `<div><span>${nDias(t)} turno${t == 1 ? '' : 's'} × (${money0(v)} + cena ${money0(c)})</span><b>${money(t * (v + c))}</b></div>` : ''}
      ${ex ? `<div><span>Extra</span><b>${money(ex)}</b></div>` : ''}
      <div class="tot"><span>Ganó en la semana</span><b>${money(tot)}</b></div>
      ${Math.abs(x.saldo_antes) > 0.009 ? `<div><span>${x.saldo_antes > 0 ? 'Le quedaste debiendo de antes' : 'Cobró de más antes (se descuenta)'}</span><b>${x.saldo_antes > 0 ? '+ ' : '− '}${money(Math.abs(x.saldo_antes))}</b></div>` : ''}
      ${x.pagado ? `<div><span>Ya le pagaste / adelantaste esta semana</span><b>− ${money(x.pagado)}</b></div>` : ''}
      <div class="tot grande"><span>${ap >= 0 ? 'A pagar el viernes' : 'Cobró de más (se descuenta la semana que viene)'}</span><b>${money(Math.abs(ap))}</b></div>`;
    return { tot, ap };
  };
  $$('input', m).forEach(i => i.addEventListener('input', calc)); calc();
  const guardar = async () => api('/api/sueldos/semana', { empleado_id: eid, viernes: x.viernes, dias: $('#swD', m).value, valor_dia: $('#swV', m).value, turnos: $('#swT', m).value,
    cena: $('#swC', m).value, extra: $('#swX', m).value, extra_detalle: $('#swXd', m).value, notas: $('#swN', m).value });
  $('#swOk', m).onclick = async () => { try { await guardar(); m.cerrar(); toast('Semana guardada'); luego && luego(); } catch (er) { fallo(er); } };
  if ($('#swPg', m)) $('#swPg', m).onclick = async () => {
    try { const g = await guardar(); m.cerrar(); const ap = g.estado.a_pagar;
      if (ap <= 0.009) { toast('Semana guardada: no le corresponde cobrar (ya cobró de más)'); return luego && luego(); }
      cargarPago({ tipo: 'SUELDO', empleado_id: eid, importe: ap, periodo: 'Semana al vie ' + dmy(x.viernes).slice(0, 5), fecha: x.viernes < hoy() ? x.viernes : hoy() }, luego);
    } catch (er) { fallo(er); } };
  if ($('#swB', m)) $('#swB', m).onclick = async () => { if (!await confirmar('¿Borrar los días cargados de esta semana? (los pagos no se borran)', 'Borrar')) return;
    try { await api(`/api/sueldos/semana/${eid}/${x.viernes}`, undefined, 'DELETE'); m.cerrar(); toast('Semana borrada'); luego && luego(); } catch (er) { fallo(er); } };
}

async function cuentaEmpleado(eid) {
  const r = await api(`/api/sueldos/${eid}/cuenta`);
  const m = modal('Cuenta de ' + esc(r.empleado.nombre), `<div class="su-saldo ${r.saldo < -0.009 ? 'afavor' : r.saldo > 0.009 ? 'debe' : ''}">${Math.abs(r.saldo) < 0.01 ? 'Están al día'
      : r.saldo > 0 ? `Le debés <b>${money(r.saldo)}</b>` : `Cobró de más <b>${money(-r.saldo)}</b> (se le descuenta)`}<small>Hoy, contando las semanas cargadas y todo lo que le pagaste</small></div>
    <div class="tabla-x"><table class="t comp"><thead><tr><th>Fecha</th><th>Qué</th><th class="r">Ganó</th><th class="r">Le pagaste</th><th class="r">Saldo</th></tr></thead><tbody>
    ${r.movimientos.map(x => `<tr><td>${dmy(x.fecha)}</td><td>${esc(x.detalle)}</td><td class="r">${x.gano ? money(x.gano) : ''}</td><td class="r">${x.pago ? money(x.pago) : ''}</td>
      <td class="r ${x.saldo < -0.009 ? 'pos' : x.saldo > 0.009 ? 'neg' : ''}">${money(x.saldo)}</td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Todavía no hay movimientos</td></tr>'}</tbody></table></div>
    <div class="ayuda">Saldo en rojo: le debés. En verde: cobró de más (te debe a vos).</div>`, `<button class="btn" data-cerrar>Cerrar</button>`, 'xl', 'cuenta');
}

/* ---------------------------------------------------------------- INFORMES */
const INF = { desde: hoy().slice(0, 4) + '-01-01', hasta: hoy(), agrupar: 'mes' };
P.informes = async (main) => {
  const r = await api(`/api/informe?desde=${INF.desde}&hasta=${INF.hasta}&agrupar=${INF.agrupar}`);
  const t = r.totales;
  const et = p => INF.agrupar === 'anio' ? p : nombreMes(p);
  const tabla = (tit, icono, l) => `<div class="card"><h3>${ico(icono)} ${tit}</h3><table class="t comp"><tbody>${l.map(x => `<tr><td>${esc(x.nombre || '—')}${x.tipo === 'TERCERO' ? ' <span class="muted chico">(pagó por mí)</span>' : ''}</td><td class="c muted chico">${x.n}</td><td class="r"><b>${money(x.total)}</b></td></tr>`).join('') || '<tr><td class="vacio">—</td></tr>'}</tbody></table></div>`;
  main.innerHTML = cabecera('chart', 'Informes', `${dmy(r.desde)} al ${dmy(r.hasta)}`, `<button class="btn" onclick="window.print()">${ico('print')} Imprimir</button>`) +
    `<div class="barra-filtro"><div><label>Ver por</label><div class="seg" id="iAg"><button data-v="mes" class="${INF.agrupar === 'mes' ? 'act' : ''}">Mes</button><button data-v="anio" class="${INF.agrupar === 'anio' ? 'act' : ''}">Año</button></div></div>
      <div><label>Desde</label><input type="date" id="iD" value="${INF.desde}"></div><div><label>Hasta</label><input type="date" id="iH" value="${INF.hasta}"></div></div>
    <div class="kpis"><div class="kpi" style="--c:var(--pri)"><small>Total pagado</small><b>${money(t.total)}</b></div>
      <div class="kpi" style="--c:var(--rojo)"><small>A proveedores</small><b>${money(t.PROVEEDOR)}</b><div class="det">facturado en el período ${money0(r.facturado_proveedores)}</div></div>
      <div class="kpi" style="--c:var(--naranja)"><small>Gastos</small><b>${money(t.GASTO)}</b></div><div class="kpi" style="--c:var(--violeta)"><small>Sueldos</small><b>${money(t.SUELDO)}</b></div></div>
    <div class="card"><h3>${ico('chart')} Por ${INF.agrupar === 'anio' ? 'año' : 'mes'}</h3>${r.periodos.length > 1 ? barras(r.periodos.map(x => ({ v: x.total, l: INF.agrupar === 'anio' ? x.periodo : MESES[+x.periodo.slice(5) - 1].slice(0, 3), t: et(x.periodo) })), money0) : ''}
      <div class="tabla-x" style="margin-top:10px"><table class="t comp"><thead><tr><th>Período</th><th class="r">Proveedores</th><th class="r">Gastos</th><th class="r">Sueldos</th><th class="r">Total</th></tr></thead><tbody>
      ${r.periodos.slice().reverse().map(x => `<tr><td>${et(x.periodo)}</td><td class="r">${money(x.PROVEEDOR)}</td><td class="r">${money(x.GASTO)}</td><td class="r">${money(x.SUELDO)}</td><td class="r"><b>${money(x.total)}</b></td></tr>`).join('') || '<tr><td colspan="5" class="vacio">Sin pagos</td></tr>'}</tbody>
      ${r.periodos.length ? `<tfoot><tr><td>TOTAL</td><td class="r">${money(t.PROVEEDOR)}</td><td class="r">${money(t.GASTO)}</td><td class="r">${money(t.SUELDO)}</td><td class="r">${money(t.total)}</td></tr></tfoot>` : ''}</table></div></div>
    <div class="cols2"><div>${tabla('A cada proveedor', 'edificio', r.por_proveedor)}${tabla('Gastos por tipo', 'peso', r.por_categoria)}</div>
      <div>${tabla('Desde dónde salió la plata', 'card', r.por_cuenta)}${tabla('Sueldos por empleado', 'users', r.por_empleado)}${tabla('Por medio de pago', 'recibo', r.por_medio.map(x => ({ ...x, nombre: MEDIOS[x.nombre] || x.nombre })))}</div></div>`;
  const re = () => ir('informes');
  $$('#iAg [data-v]').forEach(b => b.onclick = () => { INF.agrupar = b.dataset.v; re(); });
  $('#iD').onchange = e => { INF.desde = e.target.value; re(); };
  $('#iH').onchange = e => { INF.hasta = e.target.value; re(); };
};

/* ---------------------------------------------------------------- DATOS: bancos / personas y configuración */
P.cuentas = async (main) => {
  const l = await api('/api/cuentas');
  const TT = { BANCO: 'Cuenta bancaria', TERCERO: 'Otra persona que paga por mí', EFECTIVO: 'Efectivo' };
  main.innerHTML = cabecera('card', 'Bancos y quién paga', 'Desde dónde sale la plata de cada pago: tus cuentas, efectivo o alguien que transfiere por vos (ej. tu suegro)',
    `<button class="btn pri" id="ctN">${ico('plus')} Agregar</button>`) +
    `<div class="card"><table class="t"><thead><tr><th>Nombre</th><th>Tipo</th><th class="r">Pagos</th><th></th></tr></thead><tbody>
    ${l.map(c => `<tr class="${c.activo ? '' : 'anulado'}"><td><b>${esc(c.nombre)}</b>${c.notas ? `<div class="muted chico">${esc(c.notas)}</div>` : ''}</td><td>${TT[c.tipo]}</td><td class="r">${c.pagos}</td>
      <td><button class="ab" data-c="${c.id}">${ico('lapiz')}</button></td></tr>`).join('')}</tbody></table></div>`;
  const editar = c => { const m = modal(c.id ? 'Modificar' : 'Agregar', `<div class="g"><div><label>Nombre</label><input id="ecN" value="${esc(c.nombre || '')}" placeholder="Ej. Banco Nación cta. cte."></div>
      <div><label>Es</label><select id="ecT">${Object.entries(TT).map(([k, v]) => `<option value="${k}" ${k === (c.tipo || 'BANCO') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="full"><label>Notas</label><input id="ecO" value="${esc(c.notas || '')}" placeholder="Ej. CBU, de quién es la cuenta"></div>
      ${c.id ? `<div class="full"><label class="chk"><input type="checkbox" id="ecA" ${c.activo ? 'checked' : ''}> Se sigue usando</label></div>` : ''}</div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ecOk">Guardar</button>`, '', 'card');
    $('#ecOk', m).onclick = async () => { try { await api('/api/cuentas', { id: c.id, nombre: $('#ecN', m).value, tipo: $('#ecT', m).value, notas: $('#ecO', m).value, activo: $('#ecA', m) ? ($('#ecA', m).checked ? 1 : 0) : 1 });
      m.cerrar(); olvidarListas(); ir('cuentas'); } catch (e) { fallo(e); } }; };
  $('#ctN').onclick = () => editar({});
  main.onclick = e => { const b = e.target.closest('[data-c]'); if (b) editar(l.find(c => c.id === +b.dataset.c)); };
};

P.config = async (main) => {
  const c = await api('/api/config');
  main.innerHTML = cabecera('conf', 'Configuración', '', `<button class="btn verde grande" id="cfOk">${ico('check')} Guardar</button>`) +
    `<div class="card"><h3>${ico('edificio')} Datos</h3><div class="g"><div><label>Nombre de la farmacia</label><input name="nombre_negocio" value="${esc(c.nombre_negocio)}"></div>
      <div><label>Avisar si un pago no se acreditó en (días)</label><input name="dias_aviso_acreditar" inputmode="numeric" value="${esc(c.dias_aviso_acreditar)}"></div>
      <div class="full"><label>Tipos de gasto (separados por coma)</label><input name="categorias_gasto" value="${esc(c.categorias_gasto)}"></div></div></div>
    <div class="card"><h3>${ico('users')} Sueldos (lo que se propone a cada empleado nuevo)</h3><div class="g">
      <div><label>Por día</label>${campoMonto('name="sueldo_valor_dia"', aNum(c.sueldo_valor_dia))}</div>
      <div><label>Días por semana</label><input name="sueldo_dias" inputmode="decimal" value="${esc(c.sueldo_dias)}"></div>
      <div><label>Cena cuando hacen turno</label>${campoMonto('name="sueldo_cena"', aNum(c.sueldo_cena))}</div></div>
      <div class="ayuda">Lo de cada uno se cambia en Sueldos, tocando el lápiz al lado del nombre.</div></div>
    <div class="card"><h3>${ico('db')} Copia de seguridad</h3><div id="cfCopia"></div></div>
    <div class="card"><h3>📲 La app en este celular</h3><div id="cfApp"></div></div>
    <div class="muted chico" style="text-align:center;margin-top:16px">Pagos Farmacia · ${esc(marcaTexto())}</div>`;
  tarjetaCopia($('#cfCopia')); tarjetaApp($('#cfApp'));
  $('#cfOk').onclick = async () => { try { const d = leer(main);
    delete d.undefined; await api('/api/config', d); ME = await api('/api/me'); toast('Guardado'); $('#gymNom').textContent = CFG().nombre_negocio; } catch (e) { fallo(e); } };
};
