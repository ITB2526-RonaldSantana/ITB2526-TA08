/* ============================================================
   DATA.JSON — Base de dades del centre (dataclean 2024)
   Institut Tecnològic de Barcelona (ITB)
   ============================================================ */
const DB = {
  centro: "Institut Tecnològic de Barcelona (ITB)",
  curs: "2024-2025",

  electricitat: {
    // Estimació anual basada en infraestructura real del centre:
    // Quadres QGP+OGP renovats (maig 2024), HVAC reparat (juliol 2024),
    // aules informàtiques FP, climatització, il·luminació.
    consum_anual_kwh: 85000,
    cost_kwh_eur: 0.17,
    // Perfil estacional: pics a hivern (calefacció) i tardor/primavera (màx. activitat)
    // Mínims a estiu (centre quasi buit)
    perfil_mensual: [0.95, 0.92, 0.88, 0.78, 0.82, 0.75, 0.45, 0.40, 0.80, 0.96, 1.00, 0.98],
    telecom_anual_eur: 960, // DIGI 30€/mes + O2 50€/mes = 960€/any
    manteniment_2024: [
      { data: "2024-05-23", concepte: "Renovació quadres QGP+OGP", import_eur: 2548.02 },
      { data: "2024-07-05", concepte: "Reparació urgència HVAC",   import_eur: 348.48  },
      { data: "2024-09-13", concepte: "Treballs ferro i fusta",    import_eur: 1012.98 }
    ]
  },

  aigua: {
    // Dades reals de consum horari (plataforma de monitoratge):
    // 25/02/2024 → 4.530 L  |  28/02/2024 → 7.650 L  |  29/02/2024 → 3.190 L
    // Mitjana diària: ~5.123 L → ~1.075 m³/any (centre ~400 alumnes)
    consum_diari_mig_litres: 5123,
    consum_anual_m3: 1075,
    cost_m3_eur: 2.85,
    // Pics a final de curs (juny) i màxima activitat escolar; mínims a estiu
    perfil_mensual: [0.80, 0.82, 0.90, 0.95, 1.00, 1.10, 0.35, 0.30, 0.95, 0.98, 0.85, 0.80],
    mostres: [
      { data: "2024-02-25", litres: 4530, tipus: "dia_laborable" },
      { data: "2024-02-28", litres: 7650, tipus: "dia_alta_activitat" },
      { data: "2024-02-29", litres: 3190, tipus: "dia_mitja_jornada" }
    ]
  },

  material_oficina: {
    // Factures reals Lyreco 2024
    total_facturat_2024: 637.43,
    consum_anual_estimat_eur: 850, // inclou mesos sense factura
    // Pics a final/inici de curs i primavera; mínim a estiu
    perfil_mensual: [0.60, 0.65, 0.85, 0.90, 1.00, 0.95, 0.10, 0.10, 0.80, 1.00, 1.00, 0.70],
    factures: [
      { data: "2024-04-30", import_net: 126.68, items: ["Recambis borrador Faibo x10","Borradors magnètics Faibo x6","Paper A4 Navigator 80g x15 resmes"] },
      { data: "2024-05-07", import_net: 102.35, items: ["Marcador Pilot Begreen verd x25","Marcador vermell x30","Marcador negre x30","Marcador blau x30"] },
      { data: "2024-06-04", import_net: 215.90, items: ["Recambi marcador verd x30","Recambi negre x40","Paper A4 Navigator 80g x30 resmes"] },
      { data: "2024-06-19", import_net: 28.40,  items: ["Recambi marcador pissarra negre x40"] },
      { data: "2024-10-16", import_net: 109.40, items: ["Paper A4 Navigator 80g x20 resmes (5,47€/resma)"] },
      { data: "2024-11-07", import_net: 54.70,  items: ["Paper A4 Navigator 80g x10 resmes"] }
    ]
  },

  neteja: {
    // Factures reals 2024
    total_facturat_2024: 995.85,
    consum_anual_estimat_eur: 1800,
    // Pics durant curs escolar; mínim a estiu
    perfil_mensual: [0.80, 0.80, 0.90, 0.90, 1.00, 0.95, 0.20, 0.20, 0.95, 1.00, 1.00, 0.75],
    factures: [
      { data: "2024-05-27", import_net: 375.80, items: ["Neteja jardí, patis i entrada","Transport i deixalleria","Descompte borsa hores licitació 30h"] },
      { data: "2024-06-20", import_net: 620.05, items: ["Paper eixugamans x10 fardells","Paper eixugamans mecha x5 fardells","Paper WC industrial x10 fardells","Sacs industrials x20","Bosses basura petites x30","Sabó mans 5L x3 garrafes"] }
    ]
  }
};

/* ============================================================
   CONSTANTS I ESTAT
   ============================================================ */
const MESOS  = ["Gen","Feb","Mar","Abr","Mai","Jun","Jul","Ago","Set","Oct","Nov","Des"];
const FACTOR = 0.70; // reducció del 30%
// Per-category savings state
let millores = {
  elec:  false,
  agua:  false,
  ofic:  false,
  net:   false
};
let charts = {};

// Helper: returns factor for each category
function fE() { return millores.elec ? FACTOR : 1; }
function fA() { return millores.agua ? FACTOR : 1; }
function fO() { return millores.ofic ? FACTOR : 1; }
function fN() { return millores.net  ? FACTOR : 1; }
// Returns true if at least one category has savings applied
function anyMillores() { return Object.values(millores).some(v => v); }

/* ============================================================
   HELPERS DE FORMAT
   ============================================================ */
const fmtN = (n, d = 0) => n.toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtE = n => fmtN(n, 2) + ' €';
const fmtK = n => fmtN(n, 0) + ' kWh';
const fmtM = n => fmtN(n, 1) + ' m³';

/* ============================================================
   DISTRIBUCIÓ MENSUAL (algoritme amb variabilitat estacional)
   ============================================================ */
function valorMensual(anual, perfil, mes) {
  const suma = perfil.reduce((a, b) => a + b, 0);
  return anual * perfil[mes] / suma;
}

const getElec  = m => valorMensual(DB.electricitat.consum_anual_kwh,          DB.electricitat.perfil_mensual,     m);
const getAigua = m => valorMensual(DB.aigua.consum_anual_m3,                  DB.aigua.perfil_mensual,            m);
const getOfic  = m => valorMensual(DB.material_oficina.consum_anual_estimat_eur, DB.material_oficina.perfil_mensual, m);
const getNet   = m => valorMensual(DB.neteja.consum_anual_estimat_eur,         DB.neteja.perfil_mensual,           m);

/* ============================================================
   RANG DE MESOS SELECCIONATS
   ============================================================ */
function getRang() {
  let d = parseInt(document.getElementById('f-desde').value);
  let h = parseInt(document.getElementById('f-hasta').value);
  if (h < d) { let t = d; d = h; h = t; }
  const r = [];
  for (let i = d; i <= h; i++) r.push(i);
  return r;
}

/* ============================================================
   RENDER: KPIs ANUALS
   ============================================================ */
function renderKPIs() {
  const eA = DB.electricitat.consum_anual_kwh             * fE();
  const aA = DB.aigua.consum_anual_m3                     * fA();
  const oA = DB.material_oficina.consum_anual_estimat_eur * fO();
  const nA = DB.neteja.consum_anual_estimat_eur           * fN();

  const savTag = (active) => active
    ? '<span style="font-size:.65rem;background:#c8e6c9;color:#1b5e20;border-radius:10px;padding:.1rem .4rem;margin-left:.3rem">−30%</span>'
    : '';

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi elec"><div class="val">${fmtK(eA)}${savTag(millores.elec)}</div><div class="lbl">⚡ Electricitat anual projectada</div></div>
    <div class="kpi agua"><div class="val">${fmtM(aA)}${savTag(millores.agua)}</div><div class="lbl">💧 Aigua anual projectada</div></div>
    <div class="kpi ofic"><div class="val">${fmtE(oA)}${savTag(millores.ofic)}</div><div class="lbl">📋 Material oficina anual</div></div>
    <div class="kpi limp"><div class="val">${fmtE(nA)}${savTag(millores.net)}</div><div class="lbl">🧹 Neteja anual</div></div>
  `;

  // KPIs d'estalvi per al Pla
  document.getElementById('ahorro-elec-plan').textContent    = fmtE(DB.electricitat.consum_anual_kwh * DB.electricitat.cost_kwh_eur * 0.30);
  document.getElementById('ahorro-agua-plan').textContent    = fmtE(DB.aigua.consum_anual_m3 * DB.aigua.cost_m3_eur * 0.30);
  document.getElementById('ahorro-oficina-plan').textContent = fmtE(DB.material_oficina.consum_anual_estimat_eur * 0.30);
  document.getElementById('ahorro-limpieza-plan').textContent= fmtE(DB.neteja.consum_anual_estimat_eur * 0.30);
}

/* ============================================================
   RENDER: KPIs DE PERÍODE
   ============================================================ */
function renderKPIPeriode() {
  const r   = getRang();
  const lbl = `${MESOS[r[0]]}–${MESOS[r[r.length - 1]]}`;

  const eP = r.reduce((s, m) => s + getElec(m),  0) * fE();
  const aP = r.reduce((s, m) => s + getAigua(m), 0) * fA();
  const oP = r.reduce((s, m) => s + getOfic(m),  0) * fO();
  const nP = r.reduce((s, m) => s + getNet(m),   0) * fN();

  document.getElementById('kpi-periodo').innerHTML = `
    <div class="kpi elec"><div class="val">${fmtK(eP)}</div><div class="lbl">⚡ Electricitat ${lbl}</div></div>
    <div class="kpi agua"><div class="val">${fmtM(aP)}</div><div class="lbl">💧 Aigua ${lbl}</div></div>
    <div class="kpi ofic"><div class="val">${fmtE(oP)}</div><div class="lbl">📋 Material ${lbl}</div></div>
    <div class="kpi limp"><div class="val">${fmtE(nP)}</div><div class="lbl">🧹 Neteja ${lbl}</div></div>
  `;
}

/* ============================================================
   RENDER: TAULA 8 CÀLCULS OBLIGATORIS
   ============================================================ */
function renderTaula8() {
  const r   = getRang();
  const lbl = `${MESOS[r[0]]}–${MESOS[r[r.length - 1]]}`;

  const eA = DB.electricitat.consum_anual_kwh;
  const aA = DB.aigua.consum_anual_m3;
  const oA = DB.material_oficina.consum_anual_estimat_eur;
  const nA = DB.neteja.consum_anual_estimat_eur;

  const eP = r.reduce((s, m) => s + getElec(m),  0);
  const aP = r.reduce((s, m) => s + getAigua(m), 0);
  const oP = r.reduce((s, m) => s + getOfic(m),  0);
  const nP = r.reduce((s, m) => s + getNet(m),   0);

  const rows = [
    [1, '⚡ Electricitat projectada',   'Any complet', fmtK(eA), fmtK(eA * FACTOR)],
    [2, '⚡ Electricitat període',       lbl,           fmtK(eP), fmtK(eP * FACTOR)],
    [3, '💧 Aigua projectada',           'Any complet', fmtM(aA), fmtM(aA * FACTOR)],
    [4, '💧 Aigua període',              lbl,           fmtM(aP), fmtM(aP * FACTOR)],
    [5, '📋 Material oficina projectat', 'Any complet', fmtE(oA), fmtE(oA * FACTOR)],
    [6, '📋 Material oficina període',   lbl,           fmtE(oP), fmtE(oP * FACTOR)],
    [7, '🧹 Neteja projectada',          'Any complet', fmtE(nA), fmtE(nA * FACTOR)],
    [8, '🧹 Neteja període',             lbl,           fmtE(nP), fmtE(nP * FACTOR)]
  ];

  document.getElementById('tbody-calculos').innerHTML = rows.map(r => `
    <tr>
      <td style="font-weight:800;color:var(--wood-tan)">${r[0]}</td>
      <td>${r[1]}</td>
      <td>${r[2]}</td>
      <td>${r[3]}</td>
      <td style="color:var(--eco-dark);font-weight:800">${r[4]}</td>
    </tr>`).join('');
}

/* ============================================================
   RENDER: TAULA PLA 3 ANYS
   ============================================================ */
function renderTaulaPla() {
  const eA = DB.electricitat.consum_anual_kwh;
  const aA = DB.aigua.consum_anual_m3;
  const oA = DB.material_oficina.consum_anual_estimat_eur;
  const nA = DB.neteja.consum_anual_estimat_eur;

  const rows = [
    ['⚡ Electricitat (kWh)', fmtN(eA),    fmtN(eA * .9),    fmtN(eA * .8),    fmtN(eA * .7)],
    ['💧 Aigua (m³)',         fmtM(aA),    fmtM(aA * .9),    fmtM(aA * .8),    fmtM(aA * .7)],
    ['📋 Material (€)',       fmtE(oA),    fmtE(oA * .9),    fmtE(oA * .8),    fmtE(oA * .7)],
    ['🧹 Neteja (€)',         fmtE(nA),    fmtE(nA * .9),    fmtE(nA * .8),    fmtE(nA * .7)]
  ];

  document.getElementById('tbody-plan').innerHTML = rows.map(r => `
    <tr>
      <td style="font-weight:700">${r[0]}</td>
      <td>${r[1]}</td>
      <td>${r[2]}</td>
      <td>${r[3]}</td>
      <td style="color:var(--eco-dark);font-weight:800">${r[4]}</td>
    </tr>`).join('');
}

/* ============================================================
   CHARTS — COLORS
   ============================================================ */
const C = {
  elec: 'rgba(64,145,108,.85)',
  agua: 'rgba(66,165,245,.85)',
  ofic: 'rgba(107,58,42,.85)',
  net:  'rgba(156,39,176,.8)',
  eB:   'rgb(27,67,50)',
  aB:   'rgb(21,101,192)',
  oB:   'rgb(59,35,20)',
  nB:   'rgb(123,31,162)'
};

function mkChart(id, type, labels, datasets, extra = {}) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  charts[id] = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
      scales: ['pie','doughnut'].includes(type) ? {} : {
        y: { beginAtZero: true, grid: { color: 'rgba(168,110,60,.1)' } },
        x: { grid: { color: 'rgba(168,110,60,.1)' } }
      },
      ...extra
    }
  });
}

/* ============================================================
   RENDER: GRÀFICS DEL DASHBOARD
   - Ressalta el rang seleccionat (mesos actius brillants, resta grisos)
   - Mostra base + millores com a datasets separats si estan actives
   - Afegeix línia de mitjana del període seleccionat
   - Tooltips amb unitats i indicador de si el mes és dins del rang
   ============================================================ */
function renderDashCharts() {
  const rang = getRang();

  const elecBase  = MESOS.map((_, i) => +(getElec(i)).toFixed(0));
  const elecMill  = MESOS.map((_, i) => +(getElec(i) * fE()).toFixed(0));
  const aguaBase  = MESOS.map((_, i) => +(getAigua(i)).toFixed(1));
  const aguaMill  = MESOS.map((_, i) => +(getAigua(i) * fA()).toFixed(1));
  const oficBase  = MESOS.map((_, i) => +(getOfic(i)).toFixed(2));
  const oficMill  = MESOS.map((_, i) => +(getOfic(i) * fO()).toFixed(2));
  const netBase   = MESOS.map((_, i) => +(getNet(i)).toFixed(2));
  const netMill   = MESOS.map((_, i) => +(getNet(i) * fN()).toFixed(2));

  // Mitjana del rang seleccionat
  const avg = (arr) => {
    const vals = rang.map(i => arr[i]);
    return +(vals.reduce((s,v) => s+v, 0) / vals.length).toFixed(1);
  };
  const avgLine = (val) => Array(12).fill(val);

  // Opcions compartides
  const opts = (unit) => ({
    responsive: true,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 14 } },
      tooltip: {
        callbacks: {
          label: ctx => " " + ctx.dataset.label + ": " + ctx.parsed.y.toLocaleString("ca-ES") + " " + unit,
          afterBody: (items) => rang.includes(items[0]?.dataIndex)
            ? ["✅ Dins del període seleccionat"] : ["⬜ Fora del període"]
        }
      }
    },
    scales: {
      y: { beginAtZero: true, grid: { color: "rgba(168,110,60,.1)" } },
      x: { grid: { color: "rgba(168,110,60,.08)" } }
    }
  });

  // ⚡ ELECTRICITAT
  const elecDs = [{
    label: "Base (kWh)",
    data: elecBase,
    backgroundColor: MESOS.map((_, i) => rang.includes(i) ? C.elec : "rgba(64,145,108,.18)"),
    borderColor: C.eB, borderWidth: 1, borderRadius: 4
  }];
  if (millores.elec) elecDs.push({
    label: "Amb millores (kWh)",
    data: elecMill,
    backgroundColor: MESOS.map((_, i) => rang.includes(i) ? "rgba(201,168,76,.85)" : "rgba(201,168,76,.15)"),
    borderColor: "rgba(201,168,76,.9)", borderWidth: 1, borderRadius: 4
  });
  elecDs.push({
    label: "Mitjana període (" + avg(millores.elec ? elecMill : elecBase) + " kWh)",
    data: avgLine(avg(millores.elec ? elecMill : elecBase)),
    type: "line", borderColor: "#e53935", borderDash: [5,4],
    borderWidth: 1.5, pointRadius: 0, fill: false
  });
  mkChart("ch-elec", "bar", MESOS, elecDs, opts("kWh"));

  // 💧 AIGUA
  const aguaDs = [{
    label: "Base (m³)",
    data: aguaBase,
    backgroundColor: MESOS.map((_, i) => rang.includes(i) ? C.agua : "rgba(66,165,245,.18)"),
    borderColor: C.aB, borderWidth: 1, borderRadius: 4
  }];
  if (millores.agua) aguaDs.push({
    label: "Amb millores (m³)",
    data: aguaMill,
    backgroundColor: MESOS.map((_, i) => rang.includes(i) ? "rgba(201,168,76,.85)" : "rgba(201,168,76,.15)"),
    borderColor: "rgba(201,168,76,.9)", borderWidth: 1, borderRadius: 4
  });
  aguaDs.push({
    label: "Mitjana període (" + avg(millores.agua ? aguaMill : aguaBase) + " m³)",
    data: avgLine(avg(millores.agua ? aguaMill : aguaBase)),
    type: "line", borderColor: "#e53935", borderDash: [5,4],
    borderWidth: 1.5, pointRadius: 0, fill: false
  });
  mkChart("ch-agua", "bar", MESOS, aguaDs, opts("m³"));

  // 📋 MATERIAL
  const oficDs = [{
    label: "Base (€)",
    data: oficBase,
    borderColor: C.oB,
    backgroundColor: "rgba(107,58,42,.12)", fill: true, tension: .4,
    pointBackgroundColor: MESOS.map((_, i) => rang.includes(i) ? C.oB : "rgba(107,58,42,.2)"),
    pointRadius: MESOS.map((_, i) => rang.includes(i) ? 5 : 3)
  }];
  if (millores.ofic) oficDs.push({
    label: "Amb millores (€)",
    data: oficMill,
    borderColor: "rgba(201,168,76,.9)", borderDash: [4,3],
    backgroundColor: "rgba(201,168,76,.08)", fill: true, tension: .4,
    pointRadius: MESOS.map((_, i) => rang.includes(i) ? 5 : 2)
  });
  mkChart("ch-oficina", "line", MESOS, oficDs, opts("€"));

  // 🧹 NETEJA
  const netDs = [{
    label: "Base (€)",
    data: netBase,
    borderColor: C.nB,
    backgroundColor: "rgba(156,39,176,.1)", fill: true, tension: .4,
    pointBackgroundColor: MESOS.map((_, i) => rang.includes(i) ? C.nB : "rgba(156,39,176,.2)"),
    pointRadius: MESOS.map((_, i) => rang.includes(i) ? 5 : 3)
  }];
  if (millores.net) netDs.push({
    label: "Amb millores (€)",
    data: netMill,
    borderColor: "rgba(201,168,76,.9)", borderDash: [4,3],
    backgroundColor: "rgba(201,168,76,.08)", fill: true, tension: .4,
    pointRadius: MESOS.map((_, i) => rang.includes(i) ? 5 : 2)
  });
  mkChart("ch-limpieza", "line", MESOS, netDs, opts("€"));
}

/* ============================================================
   RENDER: GRÀFICS COMPARATIUS (secció Gràfics)
   ============================================================ */
function updateComparativo() {
  const vista = document.getElementById('vista-chart')?.value || 'mensual';
  let labels, eD, aD, oD, nD;

  if (vista === 'mensual') {
    labels = MESOS;
    eD = MESOS.map((_, i) => +(getElec(i)  * fE() * DB.electricitat.cost_kwh_eur).toFixed(2));
    aD = MESOS.map((_, i) => +(getAigua(i) * fA() * DB.aigua.cost_m3_eur).toFixed(2));
    oD = MESOS.map((_, i) => +(getOfic(i)  * fO()).toFixed(2));
    nD = MESOS.map((_, i) => +(getNet(i)   * fN()).toFixed(2));
  } else {
    labels = ['T1 Gen-Mar','T2 Abr-Jun','T3 Jul-Set','T4 Oct-Des'];
    const g = (fn, factor, c) => [[0,1,2],[3,4,5],[6,7,8],[9,10,11]]
      .map(t => +(t.reduce((s, m) => s + fn(m), 0) * factor * (c || 1)).toFixed(2));
    eD = g(getElec,  fE(), DB.electricitat.cost_kwh_eur);
    aD = g(getAigua, fA(), DB.aigua.cost_m3_eur);
    oD = g(getOfic,  fO(), 1);
    nD = g(getNet,   fN(), 1);
  }

  mkChart('ch-comparativo', 'bar', labels, [
    { label: '⚡ Electricitat (€)', data: eD, backgroundColor: C.elec },
    { label: '💧 Aigua (€)',        data: aD, backgroundColor: C.agua },
    { label: '📋 Material (€)',     data: oD, backgroundColor: C.ofic },
    { label: '🧹 Neteja (€)',       data: nD, backgroundColor: C.net  }
  ]);

  // Donut distribució
  const tots = [
    DB.electricitat.consum_anual_kwh             * DB.electricitat.cost_kwh_eur * fE(),
    DB.aigua.consum_anual_m3                     * DB.aigua.cost_m3_eur         * fA(),
    DB.material_oficina.consum_anual_estimat_eur * fO(),
    DB.neteja.consum_anual_estimat_eur           * fN()
  ];
  mkChart('ch-pie', 'doughnut', ['Electricitat','Aigua','Material','Neteja'], [{
    data: tots.map(v => +v.toFixed(2)),
    backgroundColor: [C.elec, C.agua, C.ofic, C.net]
  }]);

  // Projecció 3 anys
  const base = (
    DB.electricitat.consum_anual_kwh * DB.electricitat.cost_kwh_eur +
    DB.aigua.consum_anual_m3 * DB.aigua.cost_m3_eur +
    DB.material_oficina.consum_anual_estimat_eur +
    DB.neteja.consum_anual_estimat_eur
  );
  mkChart('ch-proyeccion', 'line', ['2024','2025','2026','2027'], [
    { label: 'Escenari base (€)', data: [base, base, base, base],
      borderColor: '#e53935', borderDash: [6,3], fill: false, tension: 0, pointRadius: 4 },
    { label: 'Amb millores −30% (€)', data: [base, base*.9, base*.8, base*.7],
      borderColor: C.eB, backgroundColor: 'rgba(64,145,108,.1)', fill: true, tension: .35, pointRadius: 5 }
  ]);

  // Aigua mensual base vs millores
  mkChart('ch-agua2', 'line', MESOS, [
    { label: 'Consum base (m³)', data: MESOS.map((_, i) => +getAigua(i).toFixed(1)),
      borderColor: C.aB, backgroundColor: 'rgba(66,165,245,.15)', fill: true, tension: .4 },
    { label: 'Amb millores (m³)', data: MESOS.map((_, i) => +(getAigua(i) * FACTOR).toFixed(1)),
      borderColor: '#1565c0', borderDash: [5,3], fill: false, tension: .4 }
  ]);
}

/* ============================================================
   CONTROLS DE FILTRE
   ============================================================ */
function setCursoEscolar() {
  document.getElementById('f-desde').value = 8; // Setembre
  document.getElementById('f-hasta').value = 5; // Juny
  updateAll();
}

function setAnioCompleto() {
  document.getElementById('f-desde').value = 0;
  document.getElementById('f-hasta').value = 11;
  updateAll();
}

/* ============================================================
   TOGGLE MILLORES (per categoria)
   ============================================================ */
function applyMejoras() {
  millores.elec = document.getElementById('toggle-elec').checked;
  millores.agua = document.getElementById('toggle-agua').checked;
  millores.ofic = document.getElementById('toggle-ofic').checked;
  millores.net  = document.getElementById('toggle-net').checked;

  const badge = document.getElementById('mejoras-badge');
  const badgePlan = document.getElementById('mejoras-badge-plan');
  const show = anyMillores();
  if (badge) badge.style.display = show ? 'inline-block' : 'none';
  if (badgePlan) badgePlan.style.display = show ? 'inline-block' : 'none';

  // Update status label
  const lbl = document.getElementById('toggle-label');
  if (!anyMillores()) {
    lbl.textContent = 'Selecciona les categories on vols aplicar el 30% d\'estalvi';
    lbl.style.color = '#888';
  } else {
    const names = [];
    if (millores.elec) names.push('Electricitat');
    if (millores.agua) names.push('Aigua');
    if (millores.ofic) names.push('Material');
    if (millores.net)  names.push('Neteja');
    lbl.textContent = '✅ Millores aplicades a: ' + names.join(', ');
    lbl.style.color = '#1b4332';
  }

  updateAll();
}

function applyTodasMillores(val) {
  ['toggle-elec','toggle-agua','toggle-ofic','toggle-net'].forEach(id => {
    document.getElementById(id).checked = val;
  });
  applyMejoras();
}

/* ============================================================
   PLA 30% — NAVEGACIÓ PER BLOCS
   ============================================================ */
function showPlanBlock(id, btn) {
  // Update active tab
  document.querySelectorAll('.plan-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const blocks = document.querySelectorAll('.plan-block');
  if (id === 'all') {
    blocks.forEach(b => b.classList.remove('hidden'));
  } else {
    blocks.forEach(b => {
      b.id === id ? b.classList.remove('hidden') : b.classList.add('hidden');
    });
    // Scroll to block smoothly
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
  // Re-render simulator if switching to it
  if (id === 'pb-simulador') recalcSim();
}

/* ============================================================
   NAVEGACIÓ
   ============================================================ */
function showSection(id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'graficos') setTimeout(updateComparativo, 120);
}

/* ============================================================
   SIMULADOR AVANÇAT (secció Càlculs)
   ============================================================ */

// Valors per defecte del simulador
const SIM_DEFAULTS = {
  aules: 20, hores: 8, potlum: 500, potpc: 800, dies: 180, reduElec: 30,
  alumnes: 400, litres: 12, reduAgua: 30,
  resmes: 200, marcadors: 300, reduOfic: 30,
  espais: 15, costnet: 150, reduNet: 30
};

function getSimVal(id) { return parseFloat(document.getElementById(id)?.value ?? 0); }

function recalcSim() {
  // ⚡ Electricitat: (aules × (potLlum + potPC) × hores × dies) / 1000
  const aules    = getSimVal('sim-aules');
  const hores    = getSimVal('sim-hores');
  const potlum   = getSimVal('sim-potlum');
  const potpc    = getSimVal('sim-potpc');
  const dies     = getSimVal('sim-dies');
  const reduElec = getSimVal('sim-redu-elec') / 100;

  const kwhBase  = (aules * (potlum + potpc) * hores * dies) / 1000;
  const kwhAmbM  = kwhBase * (1 - reduElec);
  const costElecBase = kwhBase * DB.electricitat.cost_kwh_eur;
  const costElecMill = kwhAmbM * DB.electricitat.cost_kwh_eur;
  const estalviElec  = costElecBase - costElecMill;

  // 💧 Aigua: alumnes × litres/dia × dies / 1000 → m³
  const alumnes   = getSimVal('sim-alumnes');
  const litres    = getSimVal('sim-litres');
  const reduAgua  = getSimVal('sim-redu-agua') / 100;
  const m3Base    = (alumnes * litres * dies) / 1000;
  const m3AmbM    = m3Base * (1 - reduAgua);
  const costAigBase = m3Base * DB.aigua.cost_m3_eur;
  const costAigMill = m3AmbM * DB.aigua.cost_m3_eur;
  const estalviAig  = costAigBase - costAigMill;

  // 📋 Material: resmes × 5.47 + marcadors × 0.89
  const resmes    = getSimVal('sim-resmes');
  const marcadors = getSimVal('sim-marcadors');
  const reduOfic  = getSimVal('sim-redu-ofic') / 100;
  const costOficBase = resmes * 5.47 + marcadors * 0.89;
  const costOficMill = costOficBase * (1 - reduOfic);
  const estalviOfic  = costOficBase - costOficMill;

  // 🧹 Neteja: espais/dia × cost productes/mes × 12
  const espais    = getSimVal('sim-espais');
  const costnet   = getSimVal('sim-costnet');
  const reduNet   = getSimVal('sim-redu-net') / 100;
  const costNetBase = costnet * 12 * (espais / SIM_DEFAULTS.espais);
  const costNetMill = costNetBase * (1 - reduNet);
  const estalviNet  = costNetBase - costNetMill;

  const totalEstalvi = estalviElec + estalviAig + estalviOfic + estalviNet;

  // KPIs
  document.getElementById('kpi-sim').innerHTML = `
    <div class="kpi elec">
      <div class="val">${fmtK(kwhAmbM)}</div>
      <div class="lbl">⚡ kWh simulats · estalvi ${fmtE(estalviElec)}/any</div>
    </div>
    <div class="kpi agua">
      <div class="val">${fmtM(m3AmbM)}</div>
      <div class="lbl">💧 m³ simulats · estalvi ${fmtE(estalviAig)}/any</div>
    </div>
    <div class="kpi ofic">
      <div class="val">${fmtE(costOficMill)}</div>
      <div class="lbl">📋 Material simulat · estalvi ${fmtE(estalviOfic)}/any</div>
    </div>
    <div class="kpi limp">
      <div class="val">${fmtE(costNetMill)}</div>
      <div class="lbl">🧹 Neteja simulada · estalvi ${fmtE(estalviNet)}/any</div>
    </div>
    <div class="kpi sav" style="grid-column:1/-1">
      <div class="val">💰 ${fmtE(totalEstalvi)}</div>
      <div class="lbl">Estalvi total anual estimat amb els paràmetres actuals</div>
    </div>
  `;

  // Detall
  document.getElementById('sim-detall').innerHTML = `
    <strong>⚡ Electricitat:</strong> ${aules} aules × ${potlum+potpc}W × ${hores}h × ${dies} dies = <strong>${fmtK(kwhBase)}</strong> base → <strong>${fmtK(kwhAmbM)}</strong> amb ${Math.round(reduElec*100)}% reducció &nbsp;|&nbsp; Cost: ${fmtE(costElecMill)}/any<br>
    <strong>💧 Aigua:</strong> ${alumnes} persones × ${litres}L × ${dies} dies = <strong>${fmtM(m3Base)}</strong> base → <strong>${fmtM(m3AmbM)}</strong> amb ${Math.round(reduAgua*100)}% reducció &nbsp;|&nbsp; Cost: ${fmtE(costAigMill)}/any<br>
    <strong>📋 Material:</strong> ${resmes} resmes × 5,47€ + ${marcadors} marcadors × 0,89€ = <strong>${fmtE(costOficBase)}</strong> base → <strong>${fmtE(costOficMill)}</strong> amb ${Math.round(reduOfic*100)}% reducció<br>
    <strong>🧹 Neteja:</strong> ${espais} espais, ${fmtE(costnet)}/mes = <strong>${fmtE(costNetBase)}</strong> base → <strong>${fmtE(costNetMill)}</strong> amb ${Math.round(reduNet*100)}% reducció
  `;

  // Badge
  const isDefault = Object.entries(SIM_DEFAULTS).every(([k,v]) => {
    const el = document.getElementById('sim-' + k.replace(/([A-Z])/g,'-$1').toLowerCase());
    return !el || parseFloat(el.value) === v;
  });
  const badge = document.getElementById('sim-badge');
  if (badge) badge.style.display = isDefault ? 'none' : 'inline-block';
}

function resetSimulador() {
  const map = {
    'sim-aules': SIM_DEFAULTS.aules,    'sim-hores': SIM_DEFAULTS.hores,
    'sim-potlum': SIM_DEFAULTS.potlum,  'sim-potpc': SIM_DEFAULTS.potpc,
    'sim-dies': SIM_DEFAULTS.dies,      'sim-redu-elec': SIM_DEFAULTS.reduElec,
    'sim-alumnes': SIM_DEFAULTS.alumnes,'sim-litres': SIM_DEFAULTS.litres,
    'sim-redu-agua': SIM_DEFAULTS.reduAgua,
    'sim-resmes': SIM_DEFAULTS.resmes,  'sim-marcadors': SIM_DEFAULTS.marcadors,
    'sim-redu-ofic': SIM_DEFAULTS.reduOfic,
    'sim-espais': SIM_DEFAULTS.espais,  'sim-costnet': SIM_DEFAULTS.costnet,
    'sim-redu-net': SIM_DEFAULTS.reduNet
  };
  const labels = {
    'sim-aules':'lbl-aules','sim-hores':'lbl-hores',
    'sim-potlum':'lbl-potlum','sim-potpc':'lbl-potpc',
    'sim-dies':'lbl-dies','sim-redu-elec':'lbl-redu-elec',
    'sim-alumnes':'lbl-alumnes','sim-litres':'lbl-litres',
    'sim-redu-agua':'lbl-redu-agua',
    'sim-resmes':'lbl-resmes','sim-marcadors':'lbl-marcadors',
    'sim-redu-ofic':'lbl-redu-ofic',
    'sim-espais':'lbl-espais','sim-costnet':'lbl-costnet',
    'sim-redu-net':'lbl-redu-net'
  };
  const units = {
    'sim-potlum':'W','sim-potpc':'W','sim-litres':'L','sim-costnet':'€',
    'sim-redu-elec':'%','sim-redu-agua':'%','sim-redu-ofic':'%','sim-redu-net':'%'
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = val;
    const lblEl = document.getElementById(labels[id]);
    if (lblEl) lblEl.textContent = val + (units[id] || '');
  });
  recalcSim();
}


function updateAll() {
  renderKPIs();
  renderKPIPeriode();
  renderTaula8();
  renderTaulaPla();
  renderDashCharts();
  if (document.getElementById('graficos').classList.contains('active')) {
    updateComparativo();
  }
}

/* ============================================================
   EXPORTACIÓ PDF
   ============================================================ */
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Capçalera
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(59, 35, 20);
  doc.text('Calculadora de Ahorro Energético — ITB', 105, 18, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90, 62, 43);
  doc.text('Institut Tecnològic de Barcelona · Fase 3 · Curs 2024-2025', 105, 26, { align: 'center' });

  doc.setDrawColor(107, 58, 42);
  doc.setLineWidth(.7);
  doc.line(15, 30, 195, 30);

  // Contingut
  const items = [
    ['⚡ Electricitat anual projectada', fmtK(DB.electricitat.consum_anual_kwh * fE())],
    ['💧 Aigua anual projectada',        fmtM(DB.aigua.consum_anual_m3 * fA())],
    ['📋 Material oficina anual',        fmtE(DB.material_oficina.consum_anual_estimat_eur * fO())],
    ['🧹 Neteja anual',                  fmtE(DB.neteja.consum_anual_estimat_eur * fN())],
    ['', ''],
    ['Millores ⚡ Electricitat (−30%)', millores.elec ? 'SÍ' : 'NO'],
    ['Millores 💧 Aigua (−30%)',        millores.agua ? 'SÍ' : 'NO'],
    ['Millores 📋 Material (−30%)',     millores.ofic ? 'SÍ' : 'NO'],
    ['Millores 🧹 Neteja (−30%)',       millores.net  ? 'SÍ' : 'NO'],
    ['', ''],
    ['Data generació', new Date().toLocaleDateString('ca-ES')]
  ];

  let y = 42;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(27, 67, 50);
  doc.text('Resum de Consum Anual', 15, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  items.forEach(([k, v]) => {
    if (k) { doc.text(k, 18, y); doc.text(v, 140, y); y += 7; }
    else y += 4;
  });

  // Peu de pàgina
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Generat automàticament · ' + new Date().toLocaleString('ca-ES'), 105, 290, { align: 'center' });

  doc.save('ITB_Estalvi_Energetic_2024-2025.pdf');
}

/* ============================================================
   INICIALITZACIÓ
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => { updateAll(); recalcSim(); });

/* ============================================================
   AUDITORIA IN SITU — Contrast teòric vs. real (Càlculs)
   ============================================================ */
const TEORICS = {
  potActiuW: 20 * (500 + 800),   // 20 aules × (llum+PC)
  potSBW:    20 * 30,
  hores: 8, dies: 180,
  kwhAny: DB.electricitat.consum_anual_kwh,
  persones: 400, litresDia: 12,
  m3Any: DB.aigua.consum_anual_m3,
  resmesAny: 200, marcadorsAny: 300
};

function gv(id) {
  const el = document.getElementById(id);
  return (el && el.value !== '') ? parseFloat(el.value) : null;
}

function calcAudit() {
  const rows = [];

  // ⚡ kWh/dia actiu
  const equips = gv('a-equips'), watts = gv('a-watts'), hores = gv('a-hores');
  if (equips !== null && watts !== null && hores !== null) {
    const realKwh  = +(equips * watts * hores / 1000).toFixed(2);
    const teoKwh   = +(TEORICS.potActiuW * TEORICS.hores / 1000).toFixed(2);
    rows.push({ label: '⚡ Consum actiu aula/dia', unit: 'kWh', teoric: teoKwh, real: realKwh });
  }

  // ⚡ kWh/any standby
  const sb = gv('a-standby');
  if (equips !== null && sb !== null) {
    const realSB = +(equips * sb * 24 * TEORICS.dies / 1000).toFixed(0);
    const teoSB  = +(TEORICS.potSBW * 24 * TEORICS.dies / 1000).toFixed(0);
    rows.push({ label: '⚡ Standby anual', unit: 'kWh/any', teoric: teoSB, real: realSB });
  }

  // 💧 m³/dia per càlcul
  const pers = gv('a-pers'), lit = gv('a-litres');
  if (pers !== null && lit !== null) {
    const realM3  = +(pers * lit / 1000).toFixed(3);
    const teoM3   = +(TEORICS.persones * TEORICS.litresDia / 1000).toFixed(3);
    rows.push({ label: '💧 Consum aigua/dia (càlcul)', unit: 'm³/dia', teoric: teoM3, real: realM3 });
  }

  // 💧 m³/dia per comptador
  const ci = gv('a-comp-ini'), cf = gv('a-comp-fi');
  if (ci !== null && cf !== null) {
    const realComp = +(cf - ci).toFixed(3);
    const teoM3    = +(TEORICS.persones * TEORICS.litresDia / 1000).toFixed(3);
    rows.push({ label: '💧 Consum aigua/dia (comptador)', unit: 'm³/dia', teoric: teoM3, real: realComp });
  }

  // 📋 Resmes/mes
  const resmes = gv('a-resmes'), mesos = gv('a-mesos') || 3;
  if (resmes !== null) {
    const realRes = +(resmes / mesos).toFixed(1);
    const teoRes  = +(TEORICS.resmesAny / 12).toFixed(1);
    rows.push({ label: '📋 Resmes paper/mes', unit: 'resmes', teoric: teoRes, real: realRes });
  }

  // 🖊️ Marcadors/mes
  const marc = gv('a-marc');
  if (marc !== null) {
    const realMarc = +(marc / mesos).toFixed(1);
    const teoMarc  = +(TEORICS.marcadorsAny / 12).toFixed(1);
    rows.push({ label: '🖊️ Marcadors/mes', unit: 'ud', teoric: teoMarc, real: realMarc });
  }

  const out = document.getElementById('contrast-output');
  if (!out) return;

  if (rows.length === 0) {
    out.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-soft);font-size:.85rem">⬆️ Introdueix dades per veure el contrast automàtic</div>';
    return;
  }

  let html = `<div class="contrast-row contrast-head">
    <div>Indicador</div><div style="text-align:right">Teòric</div>
    <div style="text-align:right">Real mesurat</div><div style="text-align:center">Desviació</div>
  </div>`;

  const devs = [];
  rows.forEach(r => {
    const dev    = r.teoric > 0 ? +((r.real - r.teoric) / r.teoric * 100).toFixed(1) : null;
    const devAbs = dev !== null ? Math.abs(dev) : 0;
    if (dev !== null) devs.push(devAbs);
    const cls   = dev === null ? '' : devAbs <= 15 ? 'dev-ok' : devAbs <= 30 ? 'dev-warn' : 'dev-bad';
    const arrow = dev === null ? '—' : dev > 0 ? '▲' : '▼';
    const hint  = dev === null ? '' : devAbs <= 15 ? '✅ Fiable' : devAbs <= 30 ? '⚠️ Reviseu' : '❌ Desviació alta';
    const barC  = devAbs <= 15 ? '#40916c' : devAbs <= 30 ? '#e65100' : '#c62828';
    html += `<div class="contrast-row">
      <div>
        <div style="font-weight:700;color:var(--text)">${r.label}</div>
        <div style="font-size:.72rem;color:var(--text-soft)">${hint}</div>
        <div class="dev-bar-wrap"><div class="dev-bar" style="width:${Math.min(100,devAbs*2)}%;background:${barC}"></div></div>
      </div>
      <div style="text-align:right;color:var(--text-soft)">${r.teoric.toLocaleString('ca-ES')} <span style="font-size:.7rem">${r.unit}</span></div>
      <div style="text-align:right;font-weight:700;color:var(--text)">${r.real.toLocaleString('ca-ES')} <span style="font-size:.7rem">${r.unit}</span></div>
      <div style="text-align:center" class="${cls}">${arrow} ${dev !== null ? Math.abs(dev)+'%' : '—'}</div>
    </div>`;
  });

  if (devs.length > 0) {
    const avg = +(devs.reduce((a,b)=>a+b,0)/devs.length).toFixed(1);
    const gc  = avg <= 15 ? 'badge-green' : avg <= 30 ? 'badge-gold' : 'badge-red';
    const gt  = avg <= 15 ? '✅ Calculadora fiable' : avg <= 30 ? '⚠️ Recomana revisió' : '❌ Dades teòriques poc fiables';
    html += `<div style="padding:.75rem 1rem;background:rgba(64,145,108,.07);display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">
      <span style="font-size:.83rem;font-weight:700;color:var(--wood-dark)">Desviació mitjana:</span>
      <span style="font-size:1.1rem;font-weight:800;color:var(--eco-dark)">${avg}%</span>
      <span class="badge ${gc}">${gt}</span>
      <span style="font-size:.75rem;color:var(--text-soft);margin-left:auto">${devs.length} indicadors contrastats</span>
    </div>`;
  }

  out.innerHTML = html;
}

function clearAudit() {
  document.querySelectorAll('.audit-in').forEach(el => el.value = '');
  calcAudit();
}