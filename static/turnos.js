/* ================================================================ TURNOS DE FARMACIA (guardias) y VACACIONES de los empleados */
ICONS.guardia = '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/><path d="M12 8v6M9 11h6"/>';
ICONS.playa = '<path d="M17.5 21H3M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12l3 9"/>';
const DIAS_L = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const faltaTxt = f => { const n = -diasDesde(f); return n === 0 ? 'hoy' : n === 1 ? 'mañana' : n === -1 ? 'ayer' : n > 0 ? `en ${n} días` : `hace ${-n} días`; };
const finMes = ym => sumarDias(sumarDias(ym + '-01', 32).slice(0, 8) + '01', -1);
const lunesDe = f => sumarDias(f, -diaSemana(f));
const nombreCorto = n => (n || '').split(/\s+/)[0];
const TU = { modo: 'mes', mes: hoy().slice(0, 7), lunes: lunesDe(hoy()), todas: true };
try { TU.todas = localStorage.getItem('pag_turnos_todas') !== '0'; } catch (e) {}

/* ---------------------------------------------------------------- pantalla TURNOS */
P.turnos = async (main) => {
  const desde = TU.modo === 'mes' ? lunesDe(TU.mes + '-01') : TU.lunes;
  const hasta = TU.modo === 'mes' ? sumarDias(lunesDe(finMes(TU.mes)), 6) : sumarDias(TU.lunes, 6);
  const r = await api(`/api/turnos?desde=${desde}&hasta=${hasta}`);
  const re = () => ir('turnos');
  const vacDe = f => r.vacaciones.filter(v => v.desde <= f && v.hasta >= f);
  const enMes = r.dias.filter(x => TU.modo !== 'mes' || x.fecha.slice(0, 7) === TU.mes);
  const nuestras = enMes.filter(x => x.nuestra), cedidas = enMes.filter(x => x.cedida).length, tomadas = nuestras.filter(x => x.tomada).length;
  const porF = {}; nuestras.forEach(x => porF[x.nombre] = (porF[x.nombre] || 0) + 1);
  const hayEst = enMes.some(x => x.estimado);
  const tituloSem = `${dm(TU.lunes)} al ${dm(sumarDias(TU.lunes, 6))}`;
  let cuerpo;
  if (TU.modo === 'mes') {
    cuerpo = `<div class="tu-grilla">${DIAS_C.map(d => `<div class="tu-dn">${d}</div>`).join('')}${r.dias.map(x => {
      const fuera = x.fecha.slice(0, 7) !== TU.mes, vs = vacDe(x.fecha);
      return `<div class="tu-c ${fuera ? 'fuera' : ''} ${x.nuestra ? 'nuestra' : ''} ${x.fecha === hoy() ? 'hoy' : ''} ${x.estimado ? 'est' : ''}" data-f="${x.fecha}">
        <span class="n">${+x.fecha.slice(8)}</span>
        ${x.cedida ? `<span class="f tachado">${esc(r.farmacias.find(z => z.id === x.oficial)?.corto || x.nombre_oficial)}</span>` : ''}
        ${x.nuestra || TU.todas || x.cedida ? `<span class="f">${esc(x.corto || x.nombre)}</span>` : ''}
        ${x.cambiado ? '<span class="tu-cam">⇄</span>' : ''}
        ${vs.length ? `<span class="tu-vac">${vs.map(v => `<i title="${esc(v.nombre)} de vacaciones">${esc(iniciales(v.nombre) || v.nombre.slice(0, 2))}</i>`).join('')}</span>` : ''}</div>`;
    }).join('')}</div>`;
  } else {
    cuerpo = r.dias.map(x => { const vs = vacDe(x.fecha);
      return `<div class="tu-sem ${x.fecha === hoy() ? 'hoy' : ''}" data-f="${x.fecha}"><div class="tu-sem-d"><small>${DIAS_L[diaSemana(x.fecha)]}</small><b>${+x.fecha.slice(8)}</b></div>
        <div class="tu-sem-t">${x.nuestra ? `<span class="tu-marca">Guardia ${esc(x.nombre)}</span>${x.tomada ? ' <span class="pill naranja">cambio</span>' : ''}`
          : `<span class="muted">De turno:</span> ${esc(x.nombre)}${x.cedida ? ' <span class="pill rojo">cedida</span>' : ''}`}${x.estimado ? ' <span class="pill gris">a confirmar</span>' : ''}
          ${x.nota ? `<div class="muted chico">${esc(x.nota)}</div>` : ''}
          ${vs.length ? `<div class="chico" style="margin-top:3px">${ico('playa')} De vacaciones: ${vs.map(v => esc(v.nombre)).join(', ')}</div>` : ''}</div></div>`; }).join('');
  }
  main.innerHTML = cabecera('guardia', 'Turnos de farmacia', 'Qué farmacia está de turno cada día. Las nuestras, resaltadas.',
    `<button class="btn" id="tuIcs">${ico('cal')} Al calendario del celular</button><button class="btn" id="tuLis">${ico('lista')} Listado de turnos</button>`) +
    `<div class="card tu-nav"><button class="btn" id="tuAnt">${ico('izq')}</button>
      <div class="tu-nav-t"><b>${TU.modo === 'mes' ? nombreMes(TU.mes) : 'Semana ' + tituloSem}</b>
        <small>${nuestras.length} guardia${nuestras.length === 1 ? '' : 's'} nuestra${nuestras.length === 1 ? '' : 's'}${Object.keys(porF).length ? ' · ' + Object.entries(porF).map(([n, k]) => `${esc(n)} ${k}`).join(' · ') : ''}${cedidas ? ` · ${cedidas} cedida${cedidas > 1 ? 's' : ''}` : ''}${tomadas ? ` · ${tomadas} tomada${tomadas > 1 ? 's' : ''}` : ''}</small></div>
      <button class="btn" id="tuSig">${ico('der')}</button></div>
    <div class="tu-barra"><div class="tu-seg"><button data-modo="mes" class="${TU.modo === 'mes' ? 'act' : ''}">Mes</button><button data-modo="semana" class="${TU.modo === 'semana' ? 'act' : ''}">Semana</button></div>
      ${TU.modo === 'mes' ? `<div class="tu-seg"><button data-todas="0" class="${TU.todas ? '' : 'act'}">Sólo nuestras</button><button data-todas="1" class="${TU.todas ? 'act' : ''}">Todas</button></div>` : ''}
      <button class="btn chico" id="tuHoy">Hoy</button></div>
    ${hayEst ? `<div class="aviso">${ico('info')} Desde el ${dm(sumarDias(r.confirmado_hasta, 1))} es <b>estimado</b> siguiendo la rotación (rayado). Cuando salga el listado nuevo, confirmalo en "Listado de turnos".</div>` : ''}
    <div class="card" style="padding:${TU.modo === 'mes' ? '10px' : '6px 14px'}">${cuerpo}</div>
    <div class="ayuda">Tocá un día para ver quién está de turno, cederle la guardia a otra farmacia o hacer un intercambio. ${TU.modo === 'mes' ? 'Las iniciales abajo son los empleados de vacaciones.' : ''}</div>`;
  $('#tuAnt').onclick = () => { if (TU.modo === 'mes') TU.mes = sumarDias(TU.mes + '-01', -1).slice(0, 7); else TU.lunes = sumarDias(TU.lunes, -7); re(); };
  $('#tuSig').onclick = () => { if (TU.modo === 'mes') TU.mes = sumarDias(finMes(TU.mes), 1).slice(0, 7); else TU.lunes = sumarDias(TU.lunes, 7); re(); };
  $('#tuHoy').onclick = () => { TU.mes = hoy().slice(0, 7); TU.lunes = lunesDe(hoy()); re(); };
  $$('[data-modo]', main).forEach(b => b.onclick = () => { TU.modo = b.dataset.modo; if (TU.modo === 'semana' && TU.lunes.slice(0, 7) !== TU.mes && TU.mes !== hoy().slice(0, 7)) TU.lunes = lunesDe(TU.mes + '-01'); re(); });
  $$('[data-todas]', main).forEach(b => b.onclick = () => { TU.todas = b.dataset.todas === '1'; try { localStorage.setItem('pag_turnos_todas', TU.todas ? '1' : '0'); } catch (e) {} re(); });
  $('#tuLis').onclick = () => listadoTurnos(re);
  $('#tuIcs').onclick = () => guardiasAlCalendario();
  main.onclick = e => { const c = e.target.closest('[data-f]'); if (c) diaTurno(c.dataset.f, re); };
};

/* un día: quién está de turno, cambiar la guardia, quién está de vacaciones */
async function diaTurno(f, luego) {
  const r = await api(`/api/turnos?desde=${f}&hasta=${f}`), x = r.dias[0];
  let det = '';
  if (x.cedida) det = `Era nuestra (<span class="tachado">${esc(x.nombre_oficial)}</span>) y se la cedimos a ${esc(x.nombre)}.`;
  else if (x.tomada) det = `Era de ${esc(x.nombre_oficial)} y la hacemos nosotros.`;
  else if (x.cambiado) det = `En el listado figuraba ${esc(x.nombre_oficial)}.`;
  if (x.par) det += ` Intercambio con el ${esc(fechaLarga(x.par).toLowerCase())}.`;
  if (x.nota) det += ` <i>“${esc(x.nota)}”</i>`;
  const m = modal(esc(fechaLarga(f)), `<div class="tu-dia ${x.nuestra ? 'nuestra' : ''}"><small>${x.nuestra ? 'Tenemos guardia' : 'Está de turno'}</small>
      <b>${esc(x.nombre)}</b>${det ? `<div class="chico" style="margin-top:4px">${det}</div>` : ''}${x.estimado ? '<div><span class="pill gris">a confirmar</span></div>' : ''}</div>
    ${r.vacaciones.length ? `<div class="aviso" style="margin-top:12px">${ico('playa')} De vacaciones: <b>${r.vacaciones.map(v => esc(v.nombre)).join(', ')}</b></div>` : ''}`,
    `${x.cambiado || x.nota ? `<button class="btn" id="tdO">Volver al listado</button>` : ''}<button class="btn" data-cerrar>Cerrar</button><button class="btn pri" id="tdC">${ico('lapiz')} Cambiar guardia</button>`, '', 'guardia');
  $('#tdC', m).onclick = () => { m.cerrar(); cambiarGuardia(f, r, luego); };
  if ($('#tdO', m)) $('#tdO', m).onclick = async () => { try { await api('/api/turnos/cambio/' + f, undefined, 'DELETE'); m.cerrar(); toast('Volvió a como está en el listado'); luego && luego(); } catch (e) { fallo(e); } };
}

async function cambiarGuardia(f, r, luego) {
  const x = r.dias[0], fs = r.farmacias.slice().sort((a, b) => b.nuestra - a.nuestra), nuestraOf = !!(r.farmacias.find(z => z.id === x.oficial) || {}).nuestra;
  let sel = x.turno;
  const m = modal('Cambiar guardia', `<div class="muted" style="margin-bottom:8px">${esc(fechaLarga(f))} · en el listado: <b>${esc(x.nombre_oficial)}</b></div>
    <label>¿Quién hace la guardia ese día?</label><div class="tu-pills" id="cgF">${fs.map(z => `<button type="button" data-id="${esc(z.id)}" class="${z.nuestra ? 'nues' : ''}">${esc(z.nombre)}${z.id === x.oficial ? ' <small>(listado)</small>' : ''}</button>`).join('')}</div>
    <div id="cgI" style="display:none;margin-top:12px"><label class="chk"><input type="checkbox" id="cgX" ${x.par ? 'checked' : ''}> Nos devuelve otro día (intercambio)</label>
      <div id="cgIB" style="display:none"><div class="ayuda" id="cgIA"></div><div class="tu-pills chicas" id="cgS"></div><input type="date" id="cgP" value="${esc(x.par || '')}" style="margin-top:8px"></div></div>
    <label style="margin-top:12px">Nota (opcional)</label><input id="cgN" value="${esc(x.nota || '')}" placeholder="Ej.: a cambio de…, se la pidió…">`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="cgOk">${ico('check')} Guardar</button>`, 'ancho', 'guardia');
  const pintar = async () => {
    $$('#cgF button', m).forEach(b => b.classList.toggle('act', b.dataset.id === sel));
    const puede = nuestraOf && sel !== x.oficial && !(r.farmacias.find(z => z.id === sel) || {}).nuestra;
    $('#cgI', m).style.display = puede ? '' : 'none';
    $('#cgIB', m).style.display = puede && $('#cgX', m).checked ? '' : 'none';
    if (!puede) return;
    const nom = (r.farmacias.find(z => z.id === sel) || {}).nombre;
    $('#cgIA', m).textContent = `Días que está de turno ${nom}: ese día lo hacemos nosotros (${x.nombre_oficial}).`;
    const l = (await api(`/api/turnos?desde=${sumarDias(f, -30)}&hasta=${sumarDias(f, 90)}`)).dias.filter(d => d.oficial === sel && d.fecha !== f && !d.cambiado && d.fecha >= sumarDias(hoy(), -7)).slice(0, 6);
    $('#cgS', m).innerHTML = l.map(d => `<button type="button" data-g="${d.fecha}" class="${$('#cgP', m).value === d.fecha ? 'act' : ''}">${DIAS_L[diaSemana(d.fecha)]} ${dm(d.fecha)}</button>`).join('') || '<span class="muted chico">No hay días cerca: elegí la fecha abajo.</span>';
  };
  $('#cgF', m).onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; sel = b.dataset.id; if (!x.par) $('#cgP', m).value = ''; pintar(); };
  $('#cgX', m).onchange = pintar;
  $('#cgS', m).onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; $('#cgP', m).value = b.dataset.g; $$('#cgS button', m).forEach(z => z.classList.toggle('act', z === b)); };
  $('#cgP', m).onchange = () => $$('#cgS button', m).forEach(z => z.classList.toggle('act', z.dataset.g === $('#cgP', m).value));
  pintar();
  $('#cgOk', m).onclick = async () => {
    const inter = $('#cgI', m).style.display !== 'none' && $('#cgX', m).checked, par = inter ? $('#cgP', m).value : '';
    if (inter && !par) return toast('Elegí qué día nos devuelve la guardia', 'err');
    try { await api('/api/turnos/cambio', { fecha: f, farmacia: sel, nota: $('#cgN', m).value, par }); m.cerrar(); toast('Guardia guardada'); luego && luego(); } catch (e) { fallo(e); }
  };
}

/* farmacias, listado (rotación) y hasta cuándo está confirmado */
async function listadoTurnos(luego) {
  const r = await api(`/api/turnos?desde=${hoy()}&hasta=${hoy()}`);
  const ls = r.listados.slice().reverse();
  const nom = id => (r.farmacias.find(z => z.id === id) || {}).nombre || id;
  const nues = id => (r.farmacias.find(z => z.id === id) || {}).nuestra;
  const m = modal('Listado de turnos', `${ls.map(l => `<div class="card" style="padding:12px 14px;margin-bottom:10px"><b>Desde el ${dmy(l.desde)}</b> <span class="muted chico">(cada ${l.orden.length} días se repite)</span>
      <div class="chico" style="margin-top:6px;line-height:1.7">${l.orden.map(id => nues(id) ? `<span class="tu-marca">${esc(nom(id))}</span>` : esc(nom(id))).join(' → ')}</div>
      ${r.listados.length > 1 ? `<button class="btn chico rojo" data-bl="${l.desde}" style="margin-top:8px">${ico('trash')} Borrar este listado</button>` : ''}</div>`).join('')}
    <div class="g"><div><label>Confirmado hasta</label><input type="date" id="ltC" value="${esc(r.confirmado_hasta)}"><div class="ayuda">Hasta qué día tenés el listado en papel. Después se calcula siguiendo la rotación (“a confirmar”).</div></div></div>`,
    `<button class="btn" id="ltF">${ico('edificio')} Farmacias</button><button class="btn" id="ltN">${ico('plus')} Cargar listado nuevo</button><button class="btn pri" id="ltOk">${ico('check')} Guardar fecha</button>`, 'ancho', 'lista');
  $('#ltOk', m).onclick = async () => { try { await api('/api/turnos/confirmado', { fecha: $('#ltC', m).value }); m.cerrar(); toast('Guardado'); luego && luego(); } catch (e) { fallo(e); } };
  $('#ltF', m).onclick = () => { m.cerrar(); farmaciasTurno(r.farmacias, luego); };
  $('#ltN', m).onclick = () => { m.cerrar(); listadoNuevo(r, luego); };
  m.onclick = async e => { const b = e.target.closest('[data-bl]'); if (!b) return;
    if (!await confirmar(`¿Borrar el listado que empieza el ${dmy(b.dataset.bl)}?`, 'Borrar')) return;
    try { await api('/api/turnos/listado/' + b.dataset.bl, undefined, 'DELETE'); m.cerrar(); toast('Listado borrado'); luego && luego(); } catch (er) { fallo(er); } };
}
function farmaciasTurno(lista, luego) {
  const L = lista.map(x => ({ ...x }));
  const m = modal('Farmacias de turno', '<div id="ftL"></div>', `<button class="btn" id="ftM">${ico('plus')} Agregar</button><button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="ftOk">${ico('check')} Guardar</button>`, 'ancho', 'edificio');
  const leerL = () => $$('#ftL [data-k]', m).forEach(i => { const x = L[+i.dataset.k]; x[i.dataset.c] = i.type === 'checkbox' ? (i.checked ? 1 : 0) : i.value; });
  const pintar = () => { $('#ftL', m).innerHTML = `<div class="ayuda" style="margin-top:0">Tildá las nuestras. “Corto” es como se ve en el calendario del mes.</div>` + L.map((x, k) => `<div class="g" style="align-items:end;border-bottom:1px solid var(--borde);padding:8px 0">
      <div><label>Nombre</label><input data-k="${k}" data-c="nombre" value="${esc(x.nombre)}"></div><div><label>Corto</label><input data-k="${k}" data-c="corto" value="${esc(x.corto || '')}" maxlength="12"></div>
      <div class="full inl" style="justify-content:space-between"><label class="chk"><input type="checkbox" data-k="${k}" data-c="nuestra" ${x.nuestra ? 'checked' : ''}> Es nuestra</label>
      ${x.id ? '' : `<button class="btn chico rojo" data-x="${k}">${ico('trash')}</button>`}</div></div>`).join(''); };
  pintar();
  $('#ftM', m).onclick = () => { leerL(); L.push({ nombre: '', corto: '', nuestra: 0 }); pintar(); };
  m.onclick = e => { const b = e.target.closest('[data-x]'); if (b) { leerL(); L.splice(+b.dataset.x, 1); pintar(); } };
  $('#ftOk', m).onclick = async () => { leerL(); try { await api('/api/turnos/farmacias', { farmacias: L }); m.cerrar(); toast('Farmacias guardadas'); luego && luego(); } catch (e) { fallo(e); } };
}
function listadoNuevo(r, luego) {
  const desde0 = sumarDias(r.confirmado_hasta, 1);
  const st = { desde: desde0, hasta: sumarDias(desde0, 364), orden: null };
  const nom = id => (r.farmacias.find(z => z.id === id) || {}).nombre || id;
  const m = modal('Cargar listado nuevo', '<div id="lnB"></div>', `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="lnOk">${ico('check')} Guardar listado</button>`, 'ancho', 'lista');
  const continuar = async () => {   // propone el orden actual, empezando por la que está de turno ese día
    const d = (await api(`/api/turnos?desde=${st.desde}&hasta=${st.desde}`)).dias[0], ult = r.listados[r.listados.length - 1].orden, k = Math.max(0, ult.indexOf(d.oficial));
    st.orden = ult.slice(k).concat(ult.slice(0, k));
  };
  const pintar = () => {
    $('#lnB', m).innerHTML = `<div class="g"><div><label>Empieza el</label><input type="date" id="lnD" value="${st.desde}"></div><div><label>Confirmado hasta</label><input type="date" id="lnC" value="${st.hasta}"></div></div>
      <label style="margin-top:12px">Orden (la primera es la de ese día)</label>
      ${st.orden.map((id, k) => `<div class="tu-ord"><span class="nro">${k + 1}</span><span>${esc(nom(id))}</span>
        <button class="ab gris" data-mv="${k}" data-d="-1" ${k ? '' : 'disabled'}>${ico('izq', 'style="transform:rotate(90deg)"')}</button><button class="ab gris" data-mv="${k}" data-d="1" ${k < st.orden.length - 1 ? '' : 'disabled'}>${ico('der', 'style="transform:rotate(90deg)"')}</button>
        <button class="ab rojo" data-sx="${k}">${ico('x')}</button></div>`).join('')}
      ${r.farmacias.filter(z => !st.orden.includes(z.id)).map(z => `<button class="btn chico" data-ad="${esc(z.id)}" style="margin:6px 6px 0 0">${ico('plus')} ${esc(z.nombre)}</button>`).join('')}
      <div class="ayuda">Así quedan los primeros días: ${st.orden.slice(0, 8).map((id, k) => `${dm(sumarDias(st.desde, k))} ${esc(nom(id))}`).join(' · ')}</div>`;
    $('#lnD', m).onchange = async e => { st.desde = e.target.value; st.hasta = $('#lnC', m).value; await continuar(); pintar(); };
    $('#lnC', m).onchange = e => { st.hasta = e.target.value; };
  };
  m.onclick = e => {
    const mv = e.target.closest('[data-mv]'); if (mv) { const k = +mv.dataset.mv, j = k + +mv.dataset.d; [st.orden[k], st.orden[j]] = [st.orden[j], st.orden[k]]; return pintar(); }
    const sx = e.target.closest('[data-sx]'); if (sx) { st.orden.splice(+sx.dataset.sx, 1); return pintar(); }
    const ad = e.target.closest('[data-ad]'); if (ad) { st.orden.push(ad.dataset.ad); pintar(); }
  };
  continuar().then(pintar);
  $('#lnOk', m).onclick = async () => { try { await api('/api/turnos/listado', { desde: st.desde, orden: st.orden, confirmado_hasta: st.hasta }); m.cerrar(); toast('Listado guardado'); luego && luego(); } catch (e) { fallo(e); } };
}

/* pasar las guardias nuestras al calendario del celular (.ics), con aviso la noche anterior */
async function guardiasAlCalendario() {
  const h = hoy(), r0 = await api(`/api/turnos?desde=${h}&hasta=${h}`), hasta = r0.confirmado_hasta > h ? r0.confirmado_hasta : sumarDias(h, 60);
  const l = (await api(`/api/turnos?desde=${h}&hasta=${hasta}`)).dias.filter(x => x.nuestra);
  if (!l.length) return toast('No hay guardias para pasar', 'err');
  if (!await confirmar(`Se van a pasar <b>${l.length} guardias</b> (del ${dm(h)} al ${dmy(hasta)}) al calendario del celular, con aviso a las 21 h del día anterior.<br><br>Si ya las pasaste antes, el calendario puede duplicarlas.`, 'Pasarlas', false)) return;
  const sello = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', s = f => f.replace(/-/g, '');
  const ev = l.map(x => ['BEGIN:VEVENT', `UID:guardia-${x.fecha}@rofac-pagos`, 'DTSTAMP:' + sello, `SUMMARY:Guardia ${x.nombre}`.replace(/,/g, '\\,'),
    'DTSTART;VALUE=DATE:' + s(x.fecha), 'DTEND;VALUE=DATE:' + s(sumarDias(x.fecha, 1)), ...(x.nota ? ['DESCRIPTION:' + x.nota.replace(/[,;]/g, m => '\\' + m)] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:Mañana guardia ${x.nombre}`, 'TRIGGER:-PT3H', 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RoFac//Pagos Farmacia//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  descargarArchivo(new Blob([txt], { type: 'text/calendar' }), 'guardias.ics', 'Guardias de la farmacia');
}

/* ---------------------------------------------------------------- pantalla VACACIONES */
let VA_ANIO = +hoy().slice(0, 4);
P.vacaciones = async (main) => {
  const r = await api('/api/vacaciones?anio=' + VA_ANIO);
  const re = () => ir('vacaciones');
  const rango = v => `${dm(v.desde)} al ${dm(v.hasta)}${v.desde.slice(0, 4) !== v.hasta.slice(0, 4) || v.desde.slice(0, 4) !== String(VA_ANIO) ? '/' + v.hasta.slice(2, 4) : ''}`;
  main.innerHTML = cabecera('playa', 'Vacaciones', 'Días corridos. A cada empleado le corresponden los días de su ficha (14 por año, si no se cambió).',
    `<button class="btn verde grande" id="vaN">${ico('plus')} Cargar vacaciones</button>`) +
    `<div class="card tu-nav"><button class="btn" id="vaAnt">${ico('izq')}</button><div class="tu-nav-t"><b>Vacaciones ${r.anio}</b><small>${VA_ANIO === +hoy().slice(0, 4) ? 'este año' : ''}</small></div><button class="btn" id="vaSig">${ico('der')}</button></div>
    ${r.hoy.length ? `<div class="aviso">${ico('playa')} Hoy de vacaciones: ${r.hoy.map(v => `<b>${esc(v.nombre)}</b> (vuelve el ${DIAS_L[diaSemana(sumarDias(v.hasta, 1))]} ${dm(sumarDias(v.hasta, 1))})`).join(', ')}</div>` : ''}
    ${r.proximas.length ? `<div class="info" style="margin-bottom:14px">${ico('cal')} Próximas: ${r.proximas.map(v => `${esc(v.nombre)} ${dm(v.desde)} al ${dm(v.hasta)}`).join(' · ')}</div>` : ''}
    <div class="su-grid">${r.empleados.map(x => { const e = x.empleado, pct = x.corresponden ? Math.min(100, x.tomados / x.corresponden * 100) : 0;
      return `<div class="card va-c" data-emp="${e.id}"><div class="su-cab"><b>${esc(e.nombre)}</b><span><button class="ab" data-ve="${e.id}" title="Días por año">${ico('lapiz')}</button></span></div>
        ${x.ahora ? `<div class="pill naranja" style="margin-bottom:8px">De vacaciones hasta el ${dm(x.ahora.hasta)}</div>` : ''}
        <div class="va-n"><div><small>Le corresponden</small><b>${x.corresponden}</b></div><div><small>Tomó</small><b>${x.tomados}</b></div>
          <div><small>Le quedan</small><b class="${x.quedan < 0 ? 'neg' : x.quedan === 0 ? 'muted' : 'pos'}">${x.quedan}</b></div></div>
        <div class="prog"><div style="width:${pct}%;${x.quedan < 0 ? 'background:var(--rojo)' : ''}"></div></div>
        ${x.adelanto_siguiente ? `<div class="chico" style="margin-top:6px;color:var(--naranja)"><b>${x.adelanto_siguiente} días de adelanto</b> a cuenta de ${r.anio + 1}</div>` : ''}
        ${x.quedan_anterior ? `<div class="chico muted" style="margin-top:4px">Le quedaron ${x.quedan_anterior} días de ${r.anio - 1} sin tomar</div>` : ''}
        <div style="margin-top:10px">${x.lista.map(v => `<div class="su-fila va-f" data-v="${v.id}"><span>${rango(v)} <span class="muted">· ${v.dias} día${v.dias === 1 ? '' : 's'}</span>
          ${v.anio !== r.anio ? `<span class="pill ${v.adelanto ? 'naranja' : 'gris'}">${v.adelanto ? 'adelanto ' : 'de '}${v.anio}</span>` : ''}${v.notas ? `<div class="muted chico">${esc(v.notas)}</div>` : ''}</span>${ico('lapiz')}</div>`).join('') || '<div class="muted chico">Todavía no se tomó vacaciones este año</div>'}</div>
        <div class="su-bot"><button class="btn" data-vn="${e.id}">${ico('plus')} Vacaciones</button></div></div>`; }).join('') || `<div class="card vacio-g">${ico('users')}<p>Cargá a los empleados en Sueldos.</p></div>`}</div>
    <div class="ayuda">Se cuentan días corridos (sábados, domingos y feriados incluidos). Si alguien pide más días de los que le quedan, el resto queda como <b>adelanto</b> a cuenta del año siguiente.
      Las vacaciones de enero a abril se proponen a cuenta del año anterior si todavía le quedan días. Si a alguien le corresponden más días (por antigüedad), cambialo con el lápiz.</div>`;
  $('#vaAnt').onclick = () => { VA_ANIO--; re(); };
  $('#vaSig').onclick = () => { VA_ANIO++; re(); };
  $('#vaN').onclick = () => cargarVacaciones({}, r, re);
  main.onclick = e => {
    const b = e.target.closest('[data-vn],[data-ve],[data-v]'); if (!b) return;
    if (b.dataset.vn) return cargarVacaciones({ empleado_id: +b.dataset.vn }, r, re);
    if (b.dataset.ve) return diasVacaciones(r.empleados.find(x => x.empleado.id === +b.dataset.ve).empleado, re);
    const v = r.empleados.flatMap(x => x.lista).find(z => z.id === +b.dataset.v); if (v) cargarVacaciones(v, r, re);
  };
};

async function cargarVacaciones(v, r, luego) {
  const emps = r.empleados.map(x => x.empleado), anioDe = (f, eid) => {      // de enero a abril, a cuenta del año anterior si le quedan días
    const a = +f.slice(0, 4), x = r.empleados.find(z => z.empleado.id === +eid);
    return +f.slice(5, 7) <= 4 && x && r.anio === a && x.quedan_anterior > 0 ? a - 1 : a;
  };
  const d0 = v.desde || hoy(), h0 = v.hasta || sumarDias(d0, 13);
  const m = modal(v.id ? 'Modificar vacaciones' : 'Cargar vacaciones', `<div class="g">
    <div class="full"><label>Empleado</label><select id="vcE"><option value="">Elegí…</option>${opciones(emps, v.empleado_id)}</select></div>
    <div><label>Desde (primer día que no viene)</label><input type="date" id="vcD" value="${esc(d0)}"></div>
    <div><label>Hasta (último día de vacaciones)</label><input type="date" id="vcH" value="${esc(h0)}"></div>
    <div><label>A cuenta del año</label><input id="vcA" inputmode="numeric" value="${esc(v.anio || anioDe(d0, v.empleado_id))}"></div>
    <div><label>Notas</label><input id="vcO" value="${esc(v.notas || '')}" placeholder="Opcional"></div></div>
    <div class="su-calc" id="vcR"></div>`,
    `${v.id ? `<button class="btn rojo" id="vcB">${ico('trash')} Borrar</button>` : ''}<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="vcOk">${ico('check')} Guardar</button>`, 'ancho', 'playa');
  const calc = () => {
    const d = $('#vcD', m).value, h = $('#vcH', m).value, eid = $('#vcE', m).value, x = r.empleados.find(z => z.empleado.id === +eid);
    if (!d || !h || h < d) { $('#vcR', m).innerHTML = '<div><span class="neg">Revisá las fechas</span></div>'; return; }
    const n = Math.round((new Date(h + 'T12:00:00') - new Date(d + 'T12:00:00')) / 864e5) + 1, vuelve = sumarDias(h, 1);
    $('#vcR', m).innerHTML = `<div><span>Días corridos</span><b>${n}</b></div><div><span>Vuelve a trabajar</span><b>${DIAS[diaSemana(vuelve)]} ${dm(vuelve)}</b></div>
      ${x && +$('#vcA', m).value === r.anio ? `<div><span>Le quedan de ${r.anio} (antes de éstas)</span><b>${x.quedan + (v.id && v.anio === r.anio ? v.dias : 0)}</b></div>` : ''}`;
  };
  $('#vcD', m).onchange = () => { if (!v.id) { $('#vcA', m).value = anioDe($('#vcD', m).value, $('#vcE', m).value); if ($('#vcH', m).value < $('#vcD', m).value) $('#vcH', m).value = sumarDias($('#vcD', m).value, 13); } calc(); };
  $('#vcE', m).onchange = () => { if (!v.id) $('#vcA', m).value = anioDe($('#vcD', m).value, $('#vcE', m).value); calc(); };
  $('#vcH', m).onchange = calc; $('#vcA', m).oninput = calc; calc();
  $('#vcOk', m).onclick = async () => {
    const datos = { id: v.id, empleado_id: $('#vcE', m).value, desde: $('#vcD', m).value, hasta: $('#vcH', m).value, anio: $('#vcA', m).value, notas: $('#vcO', m).value };
    try { let x = await api('/api/vacaciones', datos);
      if (x.confirmar) { if (!await confirmar(x.confirmar, 'Sí, guardar', false)) return; x = await api('/api/vacaciones', { ...datos, forzar: 1 }); }
      m.cerrar(); toast('Vacaciones guardadas'); luego && luego(); } catch (e) { fallo(e); }
  };
  if ($('#vcB', m)) $('#vcB', m).onclick = async () => {
    if (!await confirmar(`¿Borrar las vacaciones del ${dmy(v.desde)} al ${dmy(v.hasta)}?`, 'Borrar')) return;
    try { await api('/api/vacaciones/' + v.id, undefined, 'DELETE'); m.cerrar(); luego && luego();
      toastDeshacer('Vacaciones borradas', async () => { await api(`/api/vacaciones/${v.id}/reactivar`, {}); luego && luego(); }); } catch (e) { fallo(e); }
  };
}
function diasVacaciones(e, luego) {
  const m = modal('Vacaciones de ' + esc(e.nombre), `<div class="g"><div><label>Días por año</label><input id="dvN" inputmode="numeric" value="${e.vac_dias}"><div class="ayuda">14 hasta 5 años de antigüedad, 21 hasta 10, 28 hasta 20 y 35 con más de 20.</div></div>
    <div><label>Fecha de ingreso (opcional)</label><input type="date" id="dvI" value="${esc(e.ingreso || '')}"></div></div>`,
    `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" id="dvOk">${ico('check')} Guardar</button>`, '', 'playa');
  $('#dvOk', m).onclick = async () => { try { await api(`/api/empleados/${e.id}/vacaciones`, { vac_dias: $('#dvN', m).value, ingreso: $('#dvI', m).value }); m.cerrar(); toast('Guardado'); luego && luego(); } catch (er) { fallo(er); } };
}
/* aviso abajo con botón "Deshacer" */
function toastDeshacer(msg, fn) {
  const d = document.createElement('div'); d.className = 'ok'; d.innerHTML = `${esc(msg)} <button class="btn chico" style="margin-left:10px">Deshacer</button>`;
  $('#toast').appendChild(d); const t = setTimeout(() => d.remove(), 7000);
  $('button', d).onclick = async () => { clearTimeout(t); d.remove(); try { await fn(); toast('Listo, deshecho'); } catch (e) { fallo(e); } };
}

/* ---------------------------------------------------------------- en el INICIO: guardia de hoy, la próxima y quién está de vacaciones */
(function () {
  const orig = P.principal;
  P.principal = async (main, arg) => {
    await orig(main, arg);
    try {
      const [t, v] = await Promise.all([api('/api/turnos/proximas?n=3'), api('/api/vacaciones?anio=' + hoy().slice(0, 4))]);
      const h = t.hoy, p = t.proximas[0], kp = main.querySelector('.kpis'); if (!kp || !main.isConnected) return;
      const div = document.createElement('div'); div.className = 'tu-inicio';
      div.innerHTML = `<div class="card tu-ini ${h.nuestra ? 'nuestra' : ''}" data-ir="turnos">${ico('guardia')}<div><small>${h.nuestra ? 'Hoy tenemos guardia' : 'Hoy de turno'}</small><b>${esc(h.nombre)}</b></div></div>
        ${p ? `<div class="card tu-ini" data-ir="turnos">${ico('cal')}<div><small>Próxima guardia nuestra</small><b>${DIAS_L[diaSemana(p.fecha)]} ${dm(p.fecha)} · ${esc(p.nombre)}</b><span class="muted chico">${faltaTxt(p.fecha)}</span></div></div>` : ''}
        ${v.hoy.length ? `<div class="card tu-ini" data-ir="vacaciones">${ico('playa')}<div><small>De vacaciones</small><b>${v.hoy.map(x => esc(nombreCorto(x.nombre))).join(', ')}</b></div></div>` : ''}`;
      kp.insertAdjacentElement('beforebegin', div);
      $$('[data-ir]', div).forEach(x => x.onclick = e => { e.stopPropagation(); ir(x.dataset.ir); });
    } catch (e) { console.warn(e); }
  };
})();
