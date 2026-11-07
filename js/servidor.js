/* Pagos Farmacia en el celular: el mismo "servidor" del programa de la PC, pero corriendo adentro del navegador.
   La base es SQLite (igual que en la PC, así se puede pasar de una a otra) y se guarda en el celular (IndexedDB).
   Los comprobantes (fotos y PDF) se guardan aparte, en el celular. */
'use strict';

const SRV = (() => {
  const MARCA = 'RoFac', VERSION = '1.0';
  const TIPOS = ['PROVEEDOR', 'GASTO', 'SUELDO'];
  const MEDIOS = { TRANSFERENCIA: 'Transferencia', DEPOSITO: 'Depósito', EFECTIVO: 'Efectivo', CHEQUE: 'Cheque', ECHEQ: 'eCheq', DEBITO: 'Débito automático', TARJETA: 'Tarjeta', OTRO: 'Otro' };
  const DEFAULT_CONFIG = {
    nombre_negocio: 'Farmacia Roma',
    categorias_gasto: 'Alquiler,Internet,Luz,Agua,Gas,Teléfono,Impuestos,Contador,Limpieza,Mantenimiento,Seguro,Personales,Otros',
    dias_aviso_acreditar: '5', sueldo_valor_dia: '24000', sueldo_dias: '7', sueldo_cena: '12000', celular: '0',
  };
  const PROVEEDORES_INICIALES = ['Droguería del Sud', 'Cofaral', 'Monroe Americana'];
  const SCHEMA = `
CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS cuentas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, tipo TEXT DEFAULT 'BANCO', notas TEXT DEFAULT '', activo INTEGER DEFAULT 1, orden INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, cuit TEXT DEFAULT '', telefono TEXT DEFAULT '', email TEXT DEFAULT '',
  contacto TEXT DEFAULT '', cbu TEXT DEFAULT '', notas TEXT DEFAULT '', dias_pago INTEGER DEFAULT 7, principal INTEGER DEFAULT 0, activo INTEGER DEFAULT 1, creado TEXT);
CREATE TABLE IF NOT EXISTS resumenes (id INTEGER PRIMARY KEY AUTOINCREMENT, proveedor_id INTEGER NOT NULL REFERENCES proveedores(id), fecha TEXT NOT NULL,
  vencimiento TEXT DEFAULT '', numero TEXT DEFAULT '', importe REAL NOT NULL, notas TEXT DEFAULT '', estado TEXT DEFAULT 'ACTIVO', creado TEXT);
CREATE INDEX IF NOT EXISTS idx_res ON resumenes(proveedor_id, vencimiento);
CREATE TABLE IF NOT EXISTS empleados (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, cuil TEXT DEFAULT '', cbu TEXT DEFAULT '', telefono TEXT DEFAULT '',
  sueldo REAL DEFAULT 0, notas TEXT DEFAULT '', activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT NOT NULL, fecha TEXT NOT NULL, importe REAL NOT NULL, medio TEXT DEFAULT 'TRANSFERENCIA',
  cuenta_id INTEGER REFERENCES cuentas(id), proveedor_id INTEGER REFERENCES proveedores(id), categoria TEXT DEFAULT '', empleado_id INTEGER REFERENCES empleados(id),
  periodo TEXT DEFAULT '', concepto TEXT DEFAULT '', operacion TEXT DEFAULT '', notas TEXT DEFAULT '', acreditado INTEGER DEFAULT 0, acreditado_fecha TEXT DEFAULT '',
  estado TEXT DEFAULT 'ACTIVO', anulado_motivo TEXT DEFAULT '', creado TEXT, modificado TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS idx_pag ON pagos(tipo, fecha);
CREATE INDEX IF NOT EXISTS idx_pag_prov ON pagos(proveedor_id, fecha);
CREATE TABLE IF NOT EXISTS adjuntos (id INTEGER PRIMARY KEY AUTOINCREMENT, pago_id INTEGER, resumen_id INTEGER, archivo TEXT NOT NULL, nombre TEXT DEFAULT '',
  tipo TEXT DEFAULT '', tam INTEGER DEFAULT 0, creado TEXT);
CREATE INDEX IF NOT EXISTS idx_adj ON adjuntos(pago_id);
CREATE TABLE IF NOT EXISTS sueldo_semanas (id INTEGER PRIMARY KEY AUTOINCREMENT, empleado_id INTEGER NOT NULL REFERENCES empleados(id), viernes TEXT NOT NULL,
  dias REAL DEFAULT 0, valor_dia REAL DEFAULT 0, turnos REAL DEFAULT 0, cena REAL DEFAULT 0, extra REAL DEFAULT 0, extra_detalle TEXT DEFAULT '',
  total REAL DEFAULT 0, notas TEXT DEFAULT '', creado TEXT, modificado TEXT DEFAULT '', UNIQUE(empleado_id, viernes));
CREATE TABLE IF NOT EXISTS actividad (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT NOT NULL, accion TEXT NOT NULL, detalle TEXT DEFAULT '');`;
  const MIGRACIONES = {
    empleados: [['valor_dia', 'REAL DEFAULT 0'], ['dias_semana', 'REAL DEFAULT 7'], ['cena', 'REAL DEFAULT 0'], ['saldo_inicial', 'REAL DEFAULT 0'], ['cuenta_desde', "TEXT DEFAULT ''"]],
    pagos: [['adelanto', 'INTEGER DEFAULT 0']],
  };

  class ErrorNegocio extends Error {}
  const E = m => { throw new ErrorNegocio(m); };

  /* ------------------------------------------------ guardado en el celular (IndexedDB) */
  let IDB = null, SQL = null, DB = null;
  const idbAbrir = () => new Promise((ok, mal) => {
    const r = indexedDB.open('rofac_pagos', 1);
    r.onupgradeneeded = () => { const d = r.result; for (const t of ['base', 'archivos', 'copias', 'compartidos']) if (!d.objectStoreNames.contains(t)) d.createObjectStore(t); };
    r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error);
  });
  const idb = (store, modo, f) => new Promise((ok, mal) => {
    const tx = IDB.transaction(store, modo), s = tx.objectStore(store); let res;
    const q = f(s); if (q) q.onsuccess = () => { res = q.result; };
    tx.oncomplete = () => ok(res); tx.onerror = () => mal(tx.error); tx.onabort = () => mal(tx.error || new Error('No se pudo guardar en el celular'));
  });
  const idbGet = (st, k) => idb(st, 'readonly', s => s.get(k));
  const idbPut = (st, k, v) => idb(st, 'readwrite', s => s.put(v, k));
  const idbDel = (st, k) => idb(st, 'readwrite', s => s.delete(k));
  const idbKeys = st => idb(st, 'readonly', s => s.getAllKeys());

  let guardando = Promise.resolve();
  function guardarBase() {   // en orden, una escritura después de la otra
    const datos = DB.export();
    guardando = guardando.then(() => idbPut('base', 'pagos.db', datos)).catch(e => { console.error(e); alert('No se pudo guardar en el celular: ' + e.message); });
    return guardando;
  }

  /* ------------------------------------------------ SQL */
  const lim = v => v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v;
  function q(sql, par = []) {
    const st = DB.prepare(sql); st.bind(par.map(lim)); const out = [];
    while (st.step()) out.push(st.getAsObject());
    st.free(); return out;
  }
  const q1 = (sql, par) => q(sql, par)[0] || null;
  const val = (sql, par) => { const r = q1(sql, par); return r ? Object.values(r)[0] : null; };
  function run(sql, par = []) { DB.run(sql, par.map(lim)); return val('SELECT last_insert_rowid()'); }

  /* ------------------------------------------------ utilidades (iguales a las del programa de la PC) */
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const hoy = () => iso(new Date());
  const ahora = () => { const d = new Date(); return iso(d) + ' ' + d.toTimeString().slice(0, 8); };
  const masDias = (f, n) => { const d = new Date(f.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const entreDias = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  const r2 = x => Math.round((Number(x || 0) + 0.0000001) * 100) / 100;
  const sum = (l, f) => l.reduce((s, x) => s + (f ? f(x) : x), 0);
  function num(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim().replace(/[$  ]/g, '');
    if (!s) return 0;
    const neg = s.startsWith('-'); s = s.replace(/^[+-]+/, '');
    if (s.includes(',') && s.includes('.')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes(',')) s = (s.match(/,/g).length === 1) ? s.replace(',', '.') : s.replace(/,/g, '');
    else if (s.includes('.') && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    else if (s.includes('.') && !/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') E('Importe inválido: ' + v);
    const x = parseFloat(s);
    if (!isFinite(x)) E('Importe inválido: ' + v);
    return neg ? -x : x;
  }
  const importe = (v, campo = 'importe') => { const x = r2(num(v)); if (x <= 0) E('Escribí el ' + campo); return x; };
  const fechaOk = (v, campo = 'fecha') => { const s = String(v || '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(new Date(s + 'T12:00:00')) || iso(new Date(s + 'T12:00:00')) !== s) E('Falta o es inválida la ' + campo); return s; };
  const txt = (v, largo = 200) => String(v ?? '').split(/\s+/).filter(Boolean).join(' ').slice(0, largo);
  const moneyTxt = n => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dmy = s => s && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : (s || '');
  const fg = x => String(+Number(x).toPrecision(12)).replace('.', ',');   // como "%g" de Python, con coma
  const anotar = (accion, detalle = '') => { try { run('INSERT INTO actividad(fecha, accion, detalle) VALUES (?,?,?)', [ahora(), accion, String(detalle || '').slice(0, 300)]); } catch (e) { /* */ } };
  const getConfig = () => Object.fromEntries(q('SELECT clave, valor FROM config').map(r => [r.clave, r.valor]));
  const _f = v => { const x = parseFloat(String(v || 0).replace(/\./g, '').replace(',', '.')); return isNaN(x) ? 0 : x; };

  /* ------------------------------------------------ abrir / crear la base */
  function initDb() {
    DB.exec('PRAGMA foreign_keys = ON;');
    DB.exec(SCHEMA);
    for (const [t, cols] of Object.entries(MIGRACIONES)) {
      const ex = q(`PRAGMA table_info(${t})`).map(c => c.name);
      for (const [c, tipo] of cols) if (!ex.includes(c)) DB.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${tipo}`);
    }
    for (const [k, v] of Object.entries(DEFAULT_CONFIG)) run('INSERT OR IGNORE INTO config(clave, valor) VALUES (?, ?)', [k, v]);
    const cfg = getConfig();
    run("UPDATE empleados SET cuenta_desde = ? WHERE COALESCE(cuenta_desde,'') = ''", [sabadoDe(hoy())]);
    run('UPDATE empleados SET valor_dia = ?, cena = ? WHERE COALESCE(valor_dia,0) = 0', [_f(cfg.sueldo_valor_dia), _f(cfg.sueldo_cena)]);
    if (!q1("SELECT 1 FROM config WHERE clave = 'iniciales'")) {
      if (!q1('SELECT 1 FROM proveedores')) for (const n of PROVEEDORES_INICIALES) run('INSERT INTO proveedores(nombre, principal, creado) VALUES (?, 1, ?)', [n, ahora()]);
      if (!q1('SELECT 1 FROM cuentas')) run("INSERT INTO cuentas(nombre, tipo, orden) VALUES ('Efectivo', 'EFECTIVO', 0)");
      run("INSERT INTO config(clave, valor) VALUES ('iniciales', '1')");
    }
  }
  async function abrir() {
    IDB = await idbAbrir();
    SQL = SQL || await initSqlJs({ locateFile: f => 'lib/' + f });
    const datos = await idbGet('base', 'pagos.db');
    DB = datos ? new SQL.Database(datos) : new SQL.Database();
    initDb();
    await guardarBase();
  }
  /* una base nueva (la que vino de la PC o de una copia): se revisa antes de reemplazar */
  function probarBase(bytes) {
    let d;
    try { d = new SQL.Database(bytes); d.exec('SELECT COUNT(*) FROM pagos; SELECT COUNT(*) FROM proveedores;'); }
    catch (e) { try { d && d.close(); } catch (x) { /* */ } E('Ese archivo no es una base de Pagos Farmacia'); }
    const n = d.exec('SELECT (SELECT COUNT(*) FROM pagos), (SELECT COUNT(*) FROM proveedores), (SELECT COUNT(*) FROM adjuntos)')[0].values[0];
    d.close();
    return { pagos: n[0], proveedores: n[1], adjuntos: n[2] };
  }
  async function reemplazarBase(bytes, archivos) {
    probarBase(bytes);
    await copiaDiaria(true);
    if (archivos) {
      await idb('archivos', 'readwrite', s => s.clear());
      for (const [k, v] of Object.entries(archivos)) await idbPut('archivos', k, v);
    }
    DB.close();
    DB = new SQL.Database(bytes);
    initDb();
    await guardarBase();
  }

  /* ------------------------------------------------ cuentas */
  const R = {};
  const ruta = (metodo, patron, f) => { (R[metodo] = R[metodo] || []).push([new RegExp('^' + patron.replace(/<int>/g, '(\\d+)').replace(/<str>/g, '([^/]+)') + '$'), f]); };

  ruta('GET', '/api/me', () => ({ nombre: getConfig().nombre_negocio || '', rol: 'ADMIN', permisos: [], cfg: getConfig(), medios: MEDIOS, marca: MARCA, version: VERSION }));
  ruta('GET', '/api/config', () => { const c = Object.fromEntries(Object.entries(getConfig()).filter(([k]) => !k.startsWith('_'))); return c; });
  ruta('POST', '/api/config', d => {
    for (let [k, v] of Object.entries(d)) if (k in DEFAULT_CONFIG) {
      if (['sueldo_valor_dia', 'sueldo_dias', 'sueldo_cena'].includes(k)) v = String(+r2(num(v)));
      run('INSERT OR REPLACE INTO config(clave, valor) VALUES (?, ?)', [k, String(v).trim()]);
    }
    return { ok: true };
  });
  ruta('GET', '/api/cuentas', () => q("SELECT c.*, (SELECT COUNT(*) FROM pagos p WHERE p.cuenta_id = c.id AND p.estado = 'ACTIVO') AS pagos FROM cuentas c ORDER BY c.activo DESC, c.orden, c.nombre COLLATE NOCASE"));
  ruta('POST', '/api/cuentas', d => {
    const nombre = txt(d.nombre, 60); if (!nombre) E('Escribí el nombre (ej. Banco Nación, Galicia, Suegro)');
    const tipo = ['BANCO', 'EFECTIVO', 'TERCERO'].includes(d.tipo) ? d.tipo : 'BANCO';
    let cid;
    if (d.id) { cid = +d.id; run('UPDATE cuentas SET nombre=?, tipo=?, notas=?, activo=? WHERE id=?', [nombre, tipo, txt(d.notas, 200), (d.activo ?? 1) ? 1 : 0, cid]); }
    else cid = run('INSERT INTO cuentas(nombre, tipo, notas, orden) VALUES (?,?,?,?)', [nombre, tipo, txt(d.notas, 200), (val('SELECT MAX(orden) FROM cuentas') || 0) + 1]);
    return { ok: true, id: cid };
  });

  /* ------------------------------------------------ proveedores, resúmenes y saldo */
  function estadoProveedor(pid) {
    const res = q("SELECT * FROM resumenes WHERE proveedor_id = ? AND estado = 'ACTIVO' ORDER BY COALESCE(NULLIF(vencimiento,''), fecha), fecha, id", [pid]);
    const pag = q("SELECT * FROM pagos WHERE proveedor_id = ? AND tipo = 'PROVEEDOR' AND estado = 'ACTIVO' ORDER BY fecha, id", [pid]);
    const totalRes = r2(sum(res, x => x.importe)), totalPag = r2(sum(pag, x => x.importe));
    let disp = totalPag; const h = hoy();
    for (const x of res) {
      x.pagado = r2(Math.min(x.importe, Math.max(0, disp))); disp = r2(disp - x.pagado);
      x.falta = r2(x.importe - x.pagado);
      x.estado_pago = x.falta < 0.01 ? 'PAGADO' : x.pagado > 0.009 ? 'PARCIAL' : 'PENDIENTE';
      x.vencido = !!(x.falta > 0.009 && x.vencimiento && x.vencimiento < h);
    }
    const sinAcr = pag.filter(x => !x.acreditado);
    return { resumenes: res, pagos: pag, facturado: totalRes, pagado: totalPag, saldo: r2(totalRes - totalPag), sin_acreditar: r2(sum(sinAcr, x => x.importe)),
      sin_acreditar_n: sinAcr.length, saldo_proveedor: r2(totalRes - totalPag + sum(sinAcr, x => x.importe)) };
  }
  const hastaSemana = () => masDias(hoy(), 7);
  ruta('GET', '/api/proveedores', () => {
    const out = q('SELECT * FROM proveedores ORDER BY activo DESC, principal DESC, nombre COLLATE NOCASE'), hs = hastaSemana();
    for (const p of out) {
      const e = estadoProveedor(p.id);
      for (const k of ['saldo', 'facturado', 'pagado', 'sin_acreditar', 'sin_acreditar_n', 'saldo_proveedor']) p[k] = e[k];
      const pend = e.resumenes.filter(x => x.falta > 0.009);
      p.vence_semana = r2(sum(pend.filter(x => (x.vencimiento || x.fecha) <= hs), x => x.falta));
      p.vencido = r2(sum(pend.filter(x => x.vencido), x => x.falta));
      p.proximo = pend.map(x => x.vencimiento || x.fecha).sort()[0] || '';
      p.ultimo_pago = e.pagos.length ? e.pagos[e.pagos.length - 1].fecha : '';
    }
    return out;
  });
  ruta('POST', '/api/proveedores', d => {
    const nombre = txt(d.nombre, 80); if (!nombre) E('Escribí el nombre del proveedor');
    const par = [nombre, txt(d.cuit, 20), txt(d.telefono, 40), txt(d.email, 100), txt(d.contacto, 80), txt(d.cbu, 60), String(d.notas || '').trim().slice(0, 1000),
      Math.trunc(num(d.dias_pago || 7)) || 7, d.principal ? 1 : 0, (d.activo ?? 1) ? 1 : 0];
    if (q1('SELECT id FROM proveedores WHERE nombre = ? COLLATE NOCASE AND id != ?', [nombre, +d.id || 0])) E('Ya hay un proveedor que se llama ' + nombre);
    let pid;
    if (d.id) { pid = +d.id; run('UPDATE proveedores SET nombre=?, cuit=?, telefono=?, email=?, contacto=?, cbu=?, notas=?, dias_pago=?, principal=?, activo=? WHERE id=?', [...par, pid]); }
    else pid = run('INSERT INTO proveedores(nombre, cuit, telefono, email, contacto, cbu, notas, dias_pago, principal, activo, creado) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [...par, ahora()]);
    return { ok: true, id: pid };
  });
  ruta('GET', '/api/proveedores/<int>', (d, pid) => {
    let p = q1('SELECT * FROM proveedores WHERE id = ?', [+pid]); if (!p) throw Object.assign(new Error('No existe'), { status: 404 });
    const e = estadoProveedor(+pid); Object.assign(p, e);
    const adj = {};
    for (const a of q('SELECT a.* FROM adjuntos a LEFT JOIN pagos g ON g.id = a.pago_id LEFT JOIN resumenes r ON r.id = a.resumen_id WHERE g.proveedor_id = ? OR r.proveedor_id = ? ORDER BY a.id', [+pid, +pid])) {
      const k = a.pago_id ? 'P' + a.pago_id : 'R' + a.resumen_id; (adj[k] = adj[k] || []).push(a);
    }
    const cuentas = Object.fromEntries(q('SELECT id, nombre FROM cuentas').map(c => [c.id, c.nombre]));
    const movs = [...e.resumenes.map(x => ({ fecha: x.fecha, tipo: 'RESUMEN', id: x.id, debe: x.importe, haber: 0, x, adjuntos: adj['R' + x.id] || [] })),
      ...e.pagos.map(x => ({ fecha: x.fecha, tipo: 'PAGO', id: x.id, debe: 0, haber: x.importe, x: Object.assign({}, x, { cuenta: cuentas[x.cuenta_id] || '' }), adjuntos: adj['P' + x.id] || [] }))];
    movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.tipo === 'RESUMEN' ? 0 : 1) - (b.tipo === 'RESUMEN' ? 0 : 1) || a.id - b.id);
    let s = 0; for (const m of movs) { s = r2(s + m.debe - m.haber); m.saldo = s; }
    p.movimientos = movs.reverse(); delete p.pagos;
    return p;
  });
  ruta('POST', '/api/resumenes', d => {
    const pid = +d.proveedor_id || 0, prov = q1('SELECT * FROM proveedores WHERE id = ?', [pid]); if (!prov) E('Elegí el proveedor');
    const f = fechaOk(d.fecha || hoy());
    const venc = d.vencimiento ? fechaOk(d.vencimiento, 'fecha de pago') : masDias(f, prov.dias_pago || 7);
    if (venc < f) E('La fecha de pago no puede ser antes del cierre');
    const par = [pid, f, venc, txt(d.numero, 40), importe(d.importe), String(d.notas || '').trim().slice(0, 500)];
    let rid;
    if (d.id) { rid = +d.id; run('UPDATE resumenes SET proveedor_id=?, fecha=?, vencimiento=?, numero=?, importe=?, notas=? WHERE id=?', [...par, rid]); }
    else {
      if (q1("SELECT id FROM resumenes WHERE proveedor_id = ? AND fecha = ? AND ABS(importe - ?) < 0.01 AND estado = 'ACTIVO'", [pid, f, par[4]]) && !d.forzar)
        return { confirmar: `Ya cargaste un resumen de ${prov.nombre} del ${dmy(f)} por ${moneyTxt(par[4])}. ¿Lo cargo igual?` };
      rid = run('INSERT INTO resumenes(proveedor_id, fecha, vencimiento, numero, importe, notas, creado) VALUES (?,?,?,?,?,?,?)', [...par, ahora()]);
    }
    anotar('Resumen ' + (d.id ? 'modificado' : 'cargado'), `${prov.nombre} ${dmy(f)} ${moneyTxt(par[4])}`);
    return { ok: true, id: rid };
  });
  ruta('DELETE', '/api/resumenes/<int>', (d, rid) => {
    const r = q1('SELECT r.*, p.nombre FROM resumenes r JOIN proveedores p ON p.id = r.proveedor_id WHERE r.id = ?', [+rid]);
    if (r) { run("UPDATE resumenes SET estado = 'ANULADO' WHERE id = ?", [+rid]); anotar('Resumen borrado', `${r.nombre} ${dmy(r.fecha)} ${moneyTxt(r.importe)}`); }
    return { ok: true };
  });

  /* ------------------------------------------------ empleados y SUELDOS SEMANALES (sábado a viernes) */
  const viernesDe = f => { const d = new Date(f.slice(0, 10) + 'T12:00:00'); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7)); return iso(d); };
  const sabadoDe = f => masDias(viernesDe(f), -6);
  const totalSemana = (dias, valor, turnos, cena, extra) => r2(dias * valor + turnos * (valor + cena) + extra);
  const propuesta = (e, viernes) => { const dias = e.dias_semana ?? 7;
    return { id: null, empleado_id: e.id, viernes, dias, valor_dia: e.valor_dia || 0, turnos: 0, cena: e.cena || 0, extra: 0, extra_detalle: '', notas: '',
      total: totalSemana(dias, e.valor_dia || 0, 0, e.cena || 0, 0), propuesta: true }; };
  function semanas(e, hasta) {
    const guardadas = Object.fromEntries(q('SELECT * FROM sueldo_semanas WHERE empleado_id = ?', [e.id]).map(r => [r.viernes, r]));
    const out = Object.values(guardadas).filter(w => w.viernes <= hasta);
    const cd = e.cuenta_desde || '';
    if (cd && (e.activo ?? 1)) { let v = viernesDe(cd); while (v <= hasta) { if (!guardadas[v]) out.push(propuesta(e, v)); v = masDias(v, 7); } }
    return out.sort((a, b) => a.viernes.localeCompare(b.viernes));
  }
  function congelar(e, antesDe) {
    for (const w of semanas(e, masDias(antesDe, -7))) if (w.propuesta)
      run("INSERT OR IGNORE INTO sueldo_semanas(empleado_id, viernes, dias, valor_dia, turnos, cena, extra, total, notas, creado) VALUES (?,?,?,?,0,?,0,?,'semana normal',?)",
        [e.id, w.viernes, w.dias, w.valor_dia, w.cena, w.total, ahora()]);
  }
  function estadoEmpleado(e, viernes) {
    const desdeSem = masDias(viernes, -6), cd = e.cuenta_desde || '0000-00-00', sems = semanas(e, viernes);
    let sem = sems.find(w => w.viernes === viernes);
    if (!sem) {
      const g = q1('SELECT * FROM sueldo_semanas WHERE empleado_id = ? AND viernes = ?', [e.id, viernes]);
      sem = g || Object.assign(propuesta(e, viernes), { fuera: viernes < viernesDe(cd) });
      if (sem.fuera) sem.total = 0;
    }
    const ganAntes = sum(sems.filter(w => w.viernes < viernes), w => w.total);
    const pagAntes = val("SELECT COALESCE(SUM(importe),0) FROM pagos WHERE tipo = 'SUELDO' AND estado = 'ACTIVO' AND empleado_id = ? AND fecha >= ? AND fecha < ?", [e.id, cd, desdeSem]);
    const pagosSem = q("SELECT id, fecha, importe, adelanto, medio, periodo FROM pagos WHERE tipo = 'SUELDO' AND estado = 'ACTIVO' AND empleado_id = ? AND fecha >= ? AND fecha <= ? AND fecha >= ? ORDER BY fecha, id",
      [e.id, desdeSem, viernes, cd]);
    const saldoAntes = r2((e.saldo_inicial || 0) + ganAntes - pagAntes), pagado = r2(sum(pagosSem, p => p.importe));
    return { empleado: e, viernes, desde: desdeSem, semana: sem, saldo_antes: saldoAntes, pagos: pagosSem, pagado, a_pagar: r2(saldoAntes + sem.total - pagado) };
  }
  ruta('GET', '/api/empleados', () => q("SELECT e.*, (SELECT MAX(fecha) FROM pagos p WHERE p.empleado_id = e.id AND p.estado = 'ACTIVO') AS ultimo_pago, " +
    "(SELECT COALESCE(SUM(importe),0) FROM pagos p WHERE p.empleado_id = e.id AND p.estado = 'ACTIVO' AND substr(p.fecha,1,7) = ?) AS mes FROM empleados e ORDER BY e.activo DESC, e.nombre COLLATE NOCASE", [hoy().slice(0, 7)]));
  ruta('POST', '/api/empleados', d => {
    const nombre = txt(d.nombre, 80); if (!nombre) E('Escribí el nombre');
    const cfg = getConfig(), vacio = v => v === null || v === undefined || v === '';
    const valor = !vacio(d.valor_dia) ? r2(num(d.valor_dia)) : r2(num(cfg.sueldo_valor_dia));
    const dias = !vacio(d.dias_semana) ? num(d.dias_semana) : num(cfg.sueldo_dias || 7);
    const cena = !vacio(d.cena) ? r2(num(d.cena)) : r2(num(cfg.sueldo_cena));
    if (valor < 0 || cena < 0 || !(dias >= 0 && dias <= 7)) E('Revisá lo que cobra por día, los días por semana (0 a 7) y la cena');
    const desde = d.cuenta_desde ? fechaOk(d.cuenta_desde, 'fecha desde cuándo se lleva la cuenta') : sabadoDe(hoy());
    const activo = (d.activo ?? 1) ? 1 : 0;
    const par = [nombre, txt(d.cuil, 20), txt(d.cbu, 60), txt(d.telefono, 40), r2(valor * dias), String(d.notas || '').trim().slice(0, 500), activo, valor, dias, cena, r2(num(d.saldo_inicial)), desde];
    let eid;
    if (d.id) {
      eid = +d.id; const viejo = q1('SELECT * FROM empleados WHERE id = ?', [eid]);
      if (viejo && (Math.abs((viejo.valor_dia || 0) - valor) > 0.009 || Math.abs((viejo.dias_semana || 0) - dias) > 0.009 || !activo))
        congelar(viejo, activo ? viernesDe(hoy()) : masDias(viernesDe(hoy()), 7));
      run('UPDATE empleados SET nombre=?, cuil=?, cbu=?, telefono=?, sueldo=?, notas=?, activo=?, valor_dia=?, dias_semana=?, cena=?, saldo_inicial=?, cuenta_desde=? WHERE id=?', [...par, eid]);
    } else eid = run('INSERT INTO empleados(nombre, cuil, cbu, telefono, sueldo, notas, activo, valor_dia, dias_semana, cena, saldo_inicial, cuenta_desde) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', par);
    return { ok: true, id: eid };
  });
  ruta('GET', '/api/sueldos', (d, args) => {
    const viernes = viernesDe(args.get('viernes') || hoy());
    const out = q('SELECT * FROM empleados WHERE activo = 1 ORDER BY nombre COLLATE NOCASE').map(e => estadoEmpleado(e, viernes));
    return { viernes, desde: sabadoDe(viernes), empleados: out, total_a_pagar: r2(sum(out, x => Math.max(0, x.a_pagar))), total_semana: r2(sum(out, x => x.semana.total)) };
  });
  ruta('GET', '/api/sueldos/<int>', (d, eid, args) => {
    const e = q1('SELECT * FROM empleados WHERE id = ?', [+eid]); if (!e) throw Object.assign(new Error('No existe'), { status: 404 });
    return estadoEmpleado(e, viernesDe(args.get('viernes') || hoy()));
  });
  ruta('POST', '/api/sueldos/semana', d => {
    const e = q1('SELECT * FROM empleados WHERE id = ?', [+d.empleado_id || 0]); if (!e) E('Elegí el empleado');
    const viernes = viernesDe(fechaOk(d.viernes || hoy()));
    const dias = num(d.dias), valor = r2(num(d.valor_dia)), turnos = num(d.turnos), cena = r2(num(d.cena)), extra = r2(num(d.extra));
    if (!(dias >= 0 && dias <= 7)) E('Los días trabajados van de 0 a 7');
    if (valor < 0 || cena < 0 || turnos < 0 || turnos > 14) E('Revisá lo que cobra por día, los turnos y la cena');
    const tot = totalSemana(dias, valor, turnos, cena, extra);
    if (tot < 0) E('La semana no puede dar negativa (para descontar algo usá un extra en negativo más chico)');
    const par = [dias, valor, turnos, cena, extra, txt(d.extra_detalle, 120), tot, String(d.notas || '').trim().slice(0, 500)];
    if (q1('SELECT 1 FROM sueldo_semanas WHERE empleado_id = ? AND viernes = ?', [e.id, viernes]))
      run('UPDATE sueldo_semanas SET dias=?, valor_dia=?, turnos=?, cena=?, extra=?, extra_detalle=?, total=?, notas=?, modificado=? WHERE empleado_id = ? AND viernes = ?', [...par, ahora(), e.id, viernes]);
    else run('INSERT INTO sueldo_semanas(dias, valor_dia, turnos, cena, extra, extra_detalle, total, notas, creado, empleado_id, viernes) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [...par, ahora(), e.id, viernes]);
    if (viernes >= viernesDe(hoy()) && (Math.abs((e.valor_dia || 0) - valor) > 0.009 || Math.abs((e.cena || 0) - cena) > 0.009)) {
      congelar(e, viernes); run('UPDATE empleados SET valor_dia = ?, cena = ? WHERE id = ?', [valor, cena, e.id]);
    }
    if ((e.cuenta_desde || '') > sabadoDe(viernes)) run('UPDATE empleados SET cuenta_desde = ? WHERE id = ?', [sabadoDe(viernes), e.id]);
    const est = estadoEmpleado(q1('SELECT * FROM empleados WHERE id = ?', [e.id]), viernes);
    anotar('Semana de sueldo', `${e.nombre} vie ${dmy(viernes)} ${moneyTxt(tot)}`);
    return { ok: true, estado: est };
  });
  ruta('DELETE', '/api/sueldos/semana/<int>/<str>', (d, eid, viernes) => {
    run('DELETE FROM sueldo_semanas WHERE empleado_id = ? AND viernes = ?', [+eid, viernesDe(fechaOk(viernes))]);
    anotar('Semana de sueldo borrada', `empleado ${eid} vie ${dmy(viernes)}`);
    return { ok: true };
  });
  ruta('GET', '/api/sueldos/<int>/cuenta', (d, eid) => {
    const e = q1('SELECT * FROM empleados WHERE id = ?', [+eid]); if (!e) throw Object.assign(new Error('No existe'), { status: 404 });
    const cd = e.cuenta_desde || '0000-00-00', movs = [];
    if (e.saldo_inicial) movs.push({ fecha: cd, orden: 0, tipo: 'INICIAL', detalle: 'Saldo al empezar', gano: e.saldo_inicial > 0 ? e.saldo_inicial : 0, pago: e.saldo_inicial < 0 ? -e.saldo_inicial : 0 });
    for (const w of semanas(e, viernesDe(hoy()))) {
      let det = `Semana ${dmy(sabadoDe(w.viernes)).slice(0, 5)} al ${dmy(w.viernes).slice(0, 5)}: ${fg(w.dias)} días x ${moneyTxt(w.valor_dia)}`;
      if (w.turnos) det += ` + ${fg(w.turnos)} turno${w.turnos === 1 ? '' : 's'}`;
      if (w.extra) det += ` + ${moneyTxt(w.extra)} ${w.extra_detalle || 'extra'}`;
      if (w.propuesta) det += ' (semana normal)';
      movs.push({ fecha: w.viernes, orden: 1, tipo: 'SEMANA', detalle: det, gano: w.total, pago: 0, viernes: w.viernes });
    }
    for (const p of q("SELECT * FROM pagos WHERE tipo = 'SUELDO' AND estado = 'ACTIVO' AND empleado_id = ? AND fecha >= ?", [+eid, cd]))
      movs.push({ fecha: p.fecha, orden: 2, tipo: p.adelanto ? 'ADELANTO' : 'PAGO', detalle: (p.adelanto ? 'Adelanto' : 'Pago') + (p.periodo ? ' · ' + p.periodo : '') + ' · ' + (MEDIOS[p.medio] || p.medio),
        gano: 0, pago: p.importe, pago_id: p.id });
    movs.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);
    let sal = 0; for (const m of movs) { sal = r2(sal + m.gano - m.pago); m.saldo = sal; }
    return { empleado: e, movimientos: movs.reverse(), saldo: sal };
  });

  /* ------------------------------------------------ PAGOS */
  function sqlPagos(args) {
    const g = k => args.get ? args.get(k) : args[k];
    let sql = 'SELECT p.*, c.nombre AS cuenta, c.tipo AS cuenta_tipo, v.nombre AS proveedor, e.nombre AS empleado, ' +
      '(SELECT COUNT(*) FROM adjuntos a WHERE a.pago_id = p.id) AS n_adjuntos, (SELECT a.archivo FROM adjuntos a WHERE a.pago_id = p.id ORDER BY a.id LIMIT 1) AS adjunto, ' +
      '(SELECT a.tipo FROM adjuntos a WHERE a.pago_id = p.id ORDER BY a.id LIMIT 1) AS adjunto_tipo FROM pagos p LEFT JOIN cuentas c ON c.id = p.cuenta_id ' +
      'LEFT JOIN proveedores v ON v.id = p.proveedor_id LEFT JOIN empleados e ON e.id = p.empleado_id WHERE 1=1';
    const par = [];
    if (g('estado') !== 'todos') sql += " AND p.estado = 'ACTIVO'";
    for (const [k, col] of [['tipo', 'p.tipo'], ['proveedor_id', 'p.proveedor_id'], ['empleado_id', 'p.empleado_id'], ['cuenta_id', 'p.cuenta_id'], ['categoria', 'p.categoria'], ['medio', 'p.medio']])
      if (g(k)) { sql += ` AND ${col} = ?`; par.push(/_id$/.test(k) ? +g(k) : g(k)); }
    if (g('desde')) { sql += ' AND p.fecha >= ?'; par.push(fechaOk(g('desde'))); }
    if (g('hasta')) { sql += ' AND p.fecha <= ?'; par.push(fechaOk(g('hasta'))); }
    if (['0', '1'].includes(g('acreditado'))) { sql += " AND p.tipo = 'PROVEEDOR' AND p.acreditado = ?"; par.push(+g('acreditado')); }
    const qq = String(g('q') || '').trim();
    if (qq) {
      const palabras = [], pp = [];
      for (const w of qq.split(/\s+/)) {
        palabras.push('(p.operacion LIKE ? OR p.concepto LIKE ? OR p.notas LIKE ? OR p.categoria LIKE ? OR v.nombre LIKE ? OR e.nombre LIKE ? OR c.nombre LIKE ? OR p.periodo LIKE ?)');
        for (let i = 0; i < 8; i++) pp.push('%' + w + '%');
      }
      let cond = '(' + palabras.join(' AND ') + ')';
      let x = 0; try { x = num(qq); } catch (e) { x = 0; }
      if (x > 0) { cond = '(ABS(p.importe - ?) < 0.995 OR ' + cond + ')'; pp.unshift(x); }
      sql += ' AND ' + cond; par.push(...pp);
    }
    return [sql, par];
  }
  ruta('GET', '/api/pagos', (d, args) => {
    const [sql, par] = sqlPagos(args), out = q(sql + ' ORDER BY p.fecha DESC, p.id DESC LIMIT 3000', par);
    const limF = masDias(hoy(), -Math.trunc(num(getConfig().dias_aviso_acreditar || 5)));
    for (const p of out) p.demorado = !!(p.tipo === 'PROVEEDOR' && !p.acreditado && p.estado === 'ACTIVO' && p.fecha < limF);
    return out;
  });
  ruta('GET', '/api/pagos/<int>', (d, gid) => {
    const p = q1(sqlPagos({ estado: 'todos' })[0] + ' AND p.id = ?', [+gid]); if (!p) throw Object.assign(new Error('No existe'), { status: 404 });
    p.adjuntos = q('SELECT * FROM adjuntos WHERE pago_id = ? ORDER BY id', [+gid]);
    return p;
  });
  ruta('POST', '/api/pagos', d => {
    const tipo = String(d.tipo || '').toUpperCase(); if (!TIPOS.includes(tipo)) E('Elegí qué pagaste: proveedor, gasto o sueldo');
    const medio = String(d.medio || 'TRANSFERENCIA').toUpperCase(); if (!MEDIOS[medio]) E('Medio de pago inválido');
    const cuentaId = +d.cuenta_id || null;
    if (cuentaId && !q1('SELECT 1 FROM cuentas WHERE id = ?', [cuentaId])) E('La cuenta elegida no existe');
    if (medio !== 'EFECTIVO' && !cuentaId) E('Elegí desde dónde salió la plata (banco o quién la transfirió)');
    let prov = null, emp = null, cat = '';
    if (tipo === 'PROVEEDOR') { prov = q1('SELECT * FROM proveedores WHERE id = ?', [+d.proveedor_id || 0]); if (!prov) E('Elegí el proveedor'); }
    else if (tipo === 'SUELDO') { emp = q1('SELECT * FROM empleados WHERE id = ?', [+d.empleado_id || 0]); if (!emp) E('Elegí a quién le pagaste el sueldo'); }
    else { cat = txt(d.categoria, 40); if (!cat) E('Elegí qué gasto es (alquiler, internet...)'); }
    const imp = importe(d.importe), f = fechaOk(d.fecha || hoy());
    const acr = tipo === 'PROVEEDOR' && d.acreditado ? 1 : 0, adel = tipo === 'SUELDO' && d.adelanto ? 1 : 0;
    const par = [tipo, f, imp, medio, cuentaId, prov ? prov.id : null, cat, emp ? emp.id : null, txt(d.periodo, 40), txt(d.concepto, 160), txt(d.operacion, 60), String(d.notas || '').trim().slice(0, 1000)];
    const op = par[10];
    if (op) { const rep = q1("SELECT fecha, importe FROM pagos WHERE operacion = ? AND estado = 'ACTIVO' AND id != ?", [op, +d.id || 0]);
      if (rep && !d.forzar) return { confirmar: `Ya hay un pago con el N° de operación ${op} (${dmy(rep.fecha)}, ${moneyTxt(rep.importe)}). ¿Lo guardo igual?` }; }
    let gid;
    if (d.id) {
      gid = +d.id; if (!q1('SELECT 1 FROM pagos WHERE id = ?', [gid])) E('El pago no existe');
      run('UPDATE pagos SET tipo=?, fecha=?, importe=?, medio=?, cuenta_id=?, proveedor_id=?, categoria=?, empleado_id=?, periodo=?, concepto=?, operacion=?, notas=?, modificado=?, adelanto=? WHERE id=?', [...par, ahora(), adel, gid]);
    } else gid = run('INSERT INTO pagos(tipo, fecha, importe, medio, cuenta_id, proveedor_id, categoria, empleado_id, periodo, concepto, operacion, notas, acreditado, acreditado_fecha, creado, adelanto) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [...par, acr, acr ? hoy() : '', ahora(), adel]);
    anotar('Pago ' + (d.id ? 'modificado' : 'cargado'), `${tipo.toLowerCase()} ${prov ? prov.nombre : emp ? emp.nombre : cat} ${dmy(f)} ${moneyTxt(imp)}`);
    return { ok: true, id: gid };
  });
  ruta('POST', '/api/pagos/<int>/acreditado', (d, gid) => {
    const si = (d.acreditado ?? 1) ? 1 : 0;
    run("UPDATE pagos SET acreditado = ?, acreditado_fecha = ? WHERE id = ? AND tipo = 'PROVEEDOR'", [si, si ? (d.fecha ? fechaOk(d.fecha) : hoy()) : '', +gid]);
    return { ok: true };
  });
  ruta('POST', '/api/pagos/<int>/anular', (d, gid) => {
    const motivo = txt(d.motivo, 200); if (motivo.length < 3) E('Escribí el motivo');
    const p = q1('SELECT * FROM pagos WHERE id = ?', [+gid]); if (!p || p.estado !== 'ACTIVO') E('El pago no existe o ya estaba anulado');
    run("UPDATE pagos SET estado = 'ANULADO', anulado_motivo = ? WHERE id = ?", [motivo, +gid]);
    anotar('Pago ANULADO', `#${gid} ${dmy(p.fecha)} ${moneyTxt(p.importe)}: ${motivo}`);
    return { ok: true };
  });
  ruta('POST', '/api/pagos/<int>/reactivar', (d, gid) => { run("UPDATE pagos SET estado = 'ACTIVO', anulado_motivo = '' WHERE id = ?", [+gid]); return { ok: true }; });

  /* ------------------------------------------------ comprobantes: se achican las fotos (igual que en la PC) */
  const uuid = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  async function aJpg(blob, max, calidad) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h); bmp.close && bmp.close();
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', calidad));
  }
  async function guardarArchivo(f) {
    const nombre = (f.name || 'comprobante').split(/[\\/]/).pop(), ext = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
    if (['heic', 'heif'].includes(ext)) E('Las fotos HEIC del iPhone no se pueden ver: mandala por WhatsApp y guardala desde ahí, o en el iPhone Configuración > Cámara > Formatos > "Más compatible"');
    if (!f.size) E(`El archivo ${nombre} está vacío`);
    const cab = new Uint8Array(await f.slice(0, 4).arrayBuffer()), esPdf = String.fromCharCode(...cab) === '%PDF';
    const base = uuid();
    if (esPdf || ext === 'pdf' || f.type === 'application/pdf') {
      if (!esPdf) E(`${nombre} no es un PDF válido`);
      const b = new Blob([await f.arrayBuffer()], { type: 'application/pdf' });
      await idbPut('archivos', base + '.pdf', b);
      return [base + '.pdf', nombre, 'application/pdf', b.size];
    }
    let g, t;
    try { g = await aJpg(f, 2200, 0.88); t = await aJpg(f, 360, 0.8); } catch (e) { E(`${nombre} no es una foto ni un PDF (usá JPG, PNG o PDF)`); }
    await idbPut('archivos', base + '.jpg', g); await idbPut('archivos', base + '_t.jpg', t);
    return [base + '.jpg', nombre, 'image/jpeg', g.size];
  }
  async function adjuntosSubir(fd) {
    const archivos = fd.getAll('archivos').filter(f => f && f.size !== undefined);
    if (!archivos.length) E('Elegí la foto o el PDF del comprobante');
    const pagoId = +fd.get('pago_id') || null, resumenId = +fd.get('resumen_id') || null;
    if (pagoId && !q1('SELECT 1 FROM pagos WHERE id = ?', [pagoId])) E('El pago no existe');
    if (resumenId && !q1('SELECT 1 FROM resumenes WHERE id = ?', [resumenId])) E('El resumen no existe');
    if (!pagoId && !resumenId) E('Falta el pago');
    const ids = [];
    for (const f of archivos.slice(0, 15)) {
      const [arch, nombre, tipo, tam] = await guardarArchivo(f);
      ids.push(run('INSERT INTO adjuntos(pago_id, resumen_id, archivo, nombre, tipo, tam, creado) VALUES (?,?,?,?,?,?,?)', [pagoId, resumenId, arch, nombre, tipo, tam, ahora()]));
    }
    return { ok: true, ids };
  }
  ruta('DELETE', '/api/adjuntos/<int>', async (d, aid) => {
    const a = q1('SELECT * FROM adjuntos WHERE id = ?', [+aid]);
    if (a) { run('DELETE FROM adjuntos WHERE id = ?', [+aid]); for (const n of [a.archivo, a.archivo.replace('.jpg', '_t.jpg')]) await idbDel('archivos', n).catch(() => {}); }
    return { ok: true };
  });
  /* el archivo del comprobante (para verlo o descargarlo) */
  async function comprobante(archivo, chica) {
    archivo = String(archivo).split('/').pop().split('?')[0];
    let b = chica && archivo.endsWith('.jpg') ? await idbGet('archivos', archivo.replace('.jpg', '_t.jpg')) : null;
    b = b || await idbGet('archivos', archivo);
    return b || null;
  }
  function nombreDescarga(archivo) {
    const a = q1('SELECT a.*, p.fecha, p.importe, v.nombre AS proveedor FROM adjuntos a LEFT JOIN pagos p ON p.id = a.pago_id LEFT JOIN proveedores v ON v.id = p.proveedor_id WHERE a.archivo = ?', [archivo]);
    if (!a || !a.fecha) return archivo;
    return `Comprobante ${a.proveedor || ''} ${a.fecha} ${a.importe.toFixed(2).replace('.', ',')}`.replace(/[^\w\- .,áéíóúñÁÉÍÓÚÑ]/g, '').replace(/\s+/g, ' ').trim() + '.' + archivo.split('.').pop();
  }

  /* ------------------------------------------------ INICIO, AVISOS e INFORMES */
  ruta('GET', '/api/inicio', () => {
    const h = hoy(), mes = h.slice(0, 7), hs = hastaSemana();
    const lunes = masDias(h, -((new Date(h + 'T12:00:00').getDay() + 6) % 7));
    const provs = q('SELECT * FROM proveedores WHERE activo = 1 ORDER BY principal DESC, nombre COLLATE NOCASE');
    const paraPagar = []; let deuda = 0;
    for (const p of provs) {
      const e = estadoProveedor(p.id), pend = e.resumenes.filter(x => x.falta > 0.009);
      Object.assign(p, { saldo: e.saldo, sin_acreditar: e.sin_acreditar, sin_acreditar_n: e.sin_acreditar_n });
      p.vence_semana = r2(sum(pend.filter(x => (x.vencimiento || x.fecha) <= hs), x => x.falta));
      p.vencido = r2(sum(pend.filter(x => x.vencido), x => x.falta));
      p.pendientes = pend.slice(0, 4).map(x => ({ fecha: x.fecha, vencimiento: x.vencimiento, falta: x.falta, importe: x.importe, vencido: x.vencido }));
      p.pagado_semana = r2(sum(e.pagos.filter(x => x.fecha >= lunes), x => x.importe));
      deuda = r2(deuda + Math.max(0, e.saldo));
      if (p.principal || p.saldo > 0.009 || p.sin_acreditar_n) paraPagar.push(p);
    }
    const dias = Math.trunc(num(getConfig().dias_aviso_acreditar || 5));
    const sinAcr = q("SELECT p.*, v.nombre AS proveedor, c.nombre AS cuenta, (SELECT COUNT(*) FROM adjuntos a WHERE a.pago_id = p.id) AS n_adjuntos FROM pagos p JOIN proveedores v ON v.id = p.proveedor_id " +
      "LEFT JOIN cuentas c ON c.id = p.cuenta_id WHERE p.tipo = 'PROVEEDOR' AND p.estado = 'ACTIVO' AND p.acreditado = 0 ORDER BY p.fecha, p.id");
    const limF = masDias(h, -dias);
    for (const x of sinAcr) { x.dias = entreDias(x.fecha, h); x.demorado = x.fecha < limF; }
    const totMes = Object.fromEntries(q("SELECT tipo, SUM(importe) AS t FROM pagos WHERE estado = 'ACTIVO' AND substr(fecha,1,7) = ? GROUP BY tipo", [mes]).map(r => [r.tipo, r2(r.t)]));
    const sinComp = val("SELECT COUNT(*) FROM pagos p WHERE estado = 'ACTIVO' AND medio != 'EFECTIVO' AND fecha >= ? AND NOT EXISTS (SELECT 1 FROM adjuntos a WHERE a.pago_id = p.id)", [masDias(h, -60)]);
    const ultimos = q(sqlPagos({})[0] + ' ORDER BY p.creado DESC, p.id DESC LIMIT 8');
    return { proveedores: paraPagar, deuda, vence_semana: r2(sum(paraPagar, p => p.vence_semana)), hasta_semana: hs, sin_acreditar: sinAcr, dias_aviso: dias, mes: totMes, sin_comprobante: sinComp, ultimos };
  });
  ruta('GET', '/api/avisos', () => {
    const out = [], dias = Math.trunc(num(getConfig().dias_aviso_acreditar || 5));
    const n = val("SELECT COUNT(*) FROM pagos WHERE tipo = 'PROVEEDOR' AND estado = 'ACTIVO' AND acreditado = 0 AND fecha < ?", [masDias(hoy(), -dias)]);
    if (n) out.push({ ico: 'alerta', texto: `${n} pago${n === 1 ? '' : 's'} a proveedores sin acreditar hace más de ${dias} días`, ir: 'pagos', arg: 'sinacreditar' });
    let venc = 0;
    for (const { id } of q('SELECT id FROM proveedores WHERE activo = 1')) venc += estadoProveedor(id).resumenes.filter(x => x.falta > 0.009 && (x.vencimiento || x.fecha) <= hoy()).length;
    if (venc) out.push({ ico: 'reloj', texto: `${venc} resumen${venc === 1 ? '' : 'es'} vence${venc === 1 ? '' : 'n'} hoy o ya venció`, ir: 'principal' });
    return out;
  });
  ruta('GET', '/api/informe', (d, args) => {
    const desde = fechaOk(args.get('desde') || hoy().slice(0, 5) + '01-01'), hasta = fechaOk(args.get('hasta') || hoy());
    const agr = args.get('agrupar') !== 'anio' ? 'substr(p.fecha,1,7)' : 'substr(p.fecha,1,4)';
    const base = "FROM pagos p LEFT JOIN proveedores v ON v.id = p.proveedor_id LEFT JOIN empleados e ON e.id = p.empleado_id LEFT JOIN cuentas c ON c.id = p.cuenta_id WHERE p.estado = 'ACTIVO' AND p.fecha BETWEEN ? AND ? ";
    const rng = [desde, hasta], periodos = {};
    for (const r of q(`SELECT ${agr} AS k, p.tipo, SUM(p.importe) AS t, COUNT(*) AS n ` + base + 'GROUP BY k, p.tipo', rng)) {
      const x = periodos[r.k] = periodos[r.k] || { periodo: r.k, PROVEEDOR: 0, GASTO: 0, SUELDO: 0, total: 0, n: 0 };
      x[r.tipo] = r2(r.t); x.total = r2(x.total + r.t); x.n += r.n;
    }
    const out = { desde, hasta, periodos: Object.values(periodos).sort((a, b) => a.periodo.localeCompare(b.periodo)),
      por_proveedor: q('SELECT v.nombre AS nombre, COUNT(*) AS n, SUM(p.importe) AS total ' + base + "AND p.tipo = 'PROVEEDOR' GROUP BY v.id ORDER BY total DESC", rng),
      por_categoria: q('SELECT p.categoria AS nombre, COUNT(*) AS n, SUM(p.importe) AS total ' + base + "AND p.tipo = 'GASTO' GROUP BY p.categoria ORDER BY total DESC", rng),
      por_empleado: q('SELECT e.nombre AS nombre, COUNT(*) AS n, SUM(p.importe) AS total ' + base + "AND p.tipo = 'SUELDO' GROUP BY e.id ORDER BY total DESC", rng),
      por_cuenta: q("SELECT COALESCE(c.nombre, 'Efectivo (sin cuenta)') AS nombre, c.tipo AS tipo, COUNT(*) AS n, SUM(p.importe) AS total " + base + 'GROUP BY c.id ORDER BY total DESC', rng),
      por_medio: q('SELECT p.medio AS nombre, COUNT(*) AS n, SUM(p.importe) AS total ' + base + 'GROUP BY p.medio ORDER BY total DESC', rng) };
    out.totales = Object.fromEntries(['PROVEEDOR', 'GASTO', 'SUELDO', 'total'].map(k => [k, r2(sum(out.periodos, x => x[k]))]));
    out.facturado_proveedores = r2(val("SELECT COALESCE(SUM(importe),0) FROM resumenes WHERE estado = 'ACTIVO' AND fecha BETWEEN ? AND ?", rng));
    return out;
  });
  function pagosCsv(args) {
    const [sql, par] = sqlPagos(args), l = q(sql + ' ORDER BY p.fecha, p.id', par);
    const c = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const filas = [['Fecha', 'Tipo', 'A quién / qué', 'Importe', 'Medio', 'Desde', 'N° operación', 'Concepto', 'Período', 'Acreditado', 'Comprobantes', 'Estado']];
    for (const p of l) filas.push([dmy(p.fecha), { PROVEEDOR: 'Proveedor', GASTO: 'Gasto', SUELDO: 'Sueldo' }[p.tipo], p.proveedor || p.empleado || p.categoria, p.importe.toFixed(2).replace('.', ','),
      MEDIOS[p.medio] || p.medio, p.cuenta || '', p.operacion, p.concepto, p.periodo, p.acreditado ? 'Sí ' + dmy(p.acreditado_fecha) : (p.tipo === 'PROVEEDOR' ? 'No' : ''), p.n_adjuntos, p.estado]);
    return new Blob(['﻿' + filas.map(f => f.map(c).join(';')).join('\r\n')], { type: 'text/csv' });
  }

  /* ------------------------------------------------ copias: el mismo .zip que la PC (datos/pagos.db + datos/adjuntos) */
  async function copiaZip() {
    const ent = [{ nombre: 'datos/pagos.db', datos: DB.export() }];
    for (const k of await idbKeys('archivos')) { const b = await idbGet('archivos', k); ent.push({ nombre: 'datos/adjuntos/' + k, datos: new Uint8Array(await b.arrayBuffer()) }); }
    return ZIP.crear(ent);
  }
  async function restaurar(file) {
    const cab = new Uint8Array(await file.slice(0, 16).arrayBuffer()), txtc = String.fromCharCode(...cab);
    if (txtc.startsWith('SQLite format 3')) { const b = new Uint8Array(await file.arrayBuffer()); const n = probarBase(b); await reemplazarBase(b, null); return n; }
    if (cab[0] !== 0x50 || cab[1] !== 0x4b) E('Elegí la copia: el .zip de la copia completa (de la PC o del celular) o el archivo pagos.db');
    const ents = await ZIP.leer(file);
    const db = ents.find(e => /(^|\/)pagos(_[\d-]+)?\.db$/i.test(e.nombre));
    if (!db) E('Ese .zip no tiene la base de Pagos Farmacia (pagos.db)');
    const bytes = await db.datos(), n = probarBase(bytes), archivos = {};
    for (const e of ents) { const m = e.nombre.match(/(?:^|\/)adjuntos\/([^/]+)$/); if (m && m[1]) archivos[m[1]] = new Blob([await e.datos()], { type: /\.pdf$/i.test(m[1]) ? 'application/pdf' : 'image/jpeg' }); }
    await reemplazarBase(bytes, archivos);
    return Object.assign(n, { archivos: Object.keys(archivos).length });
  }
  /* una copia por día adentro del celular (las últimas 7, sin los comprobantes) */
  async function copiaDiaria(forzar) {
    try {
      const k = (forzar ? 'antes-' + ahora().replace(/[: ]/g, '-') : 'dia-' + hoy());
      if (!forzar && await idbGet('copias', k)) return;
      await idbPut('copias', k, DB.export());
      const todas = (await idbKeys('copias')).sort((a, b) => a.slice(-19).localeCompare(b.slice(-19)));
      const dias = todas.filter(x => x.startsWith('dia-')), antes = todas.filter(x => x.startsWith('antes-'));
      for (const x of [...dias.slice(0, Math.max(0, dias.length - 7)), ...antes.slice(0, Math.max(0, antes.length - 3))]) await idbDel('copias', x);
    } catch (e) { console.warn('copia diaria', e); }
  }
  async function copiasInternas() {
    const l = [];
    for (const k of (await idbKeys('copias'))) { const b = await idbGet('copias', k); l.push({ k, tam: b.length, fecha: k.startsWith('dia-') ? k.slice(4) : k.slice(6) }); }
    return l.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
  async function volverACopia(k) { const b = await idbGet('copias', k); if (!b) E('No se encontró esa copia'); await reemplazarBase(b, null); }

  /* ------------------------------------------------ el "servidor": atiende los pedidos que antes iban a la PC */
  async function atender(metodo, url, cuerpo) {
    const u = new URL(url, location.href), path = u.pathname.replace(/^.*?(\/api\/)/, '/api/');
    if (metodo === 'POST' && path === '/api/adjuntos') { const r = await adjuntosSubir(cuerpo); await guardarBase(); return r; }
    for (const [re, f] of R[metodo] || []) {
      const m = path.match(re); if (!m) continue;
      let datos = {};
      if (cuerpo && typeof cuerpo === 'string') { try { datos = JSON.parse(cuerpo); } catch (e) { datos = {}; } }
      const r = await f(datos, ...m.slice(1).map(decodeURIComponent), u.searchParams);
      if (metodo !== 'GET') await guardarBase();
      return r;
    }
    throw Object.assign(new Error('No existe: ' + path), { status: 404 });
  }

  return { abrir, atender, comprobante, nombreDescarga, pagosCsv, copiaZip, restaurar, copiaDiaria, copiasInternas, volverACopia, probarBase, ErrorNegocio,
    cfg: getConfig, idbGet, idbPut, idbDel, idbKeys, ultimaCopia: () => val("SELECT valor FROM config WHERE clave = '_ultima_copia'") || '',
    marcarCopia: async () => { run("INSERT OR REPLACE INTO config(clave, valor) VALUES ('_ultima_copia', ?)", [ahora()]); await guardarBase(); },
    resumen: () => ({ pagos: val("SELECT COUNT(*) FROM pagos WHERE estado = 'ACTIVO'"), proveedores: val('SELECT COUNT(*) FROM proveedores'), adjuntos: val('SELECT COUNT(*) FROM adjuntos') }),
    _db: () => DB, _q: q };
})();
