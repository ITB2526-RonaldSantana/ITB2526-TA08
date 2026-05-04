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

  // Actualitzar teòric F3 a la taula d'inventari quan canvien els sliders
  if (typeof calcInv === 'function') calcInv();
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
   INVENTARI D'EQUIPS — Auditoria aula (Simulador Pla 30%)
   Columnes: tipus · quantitat · W nominal · hores · W standby
             → consum real diari (kWh) · consum teòric F3 (kWh)
             → desviació % · conclusió
   ============================================================ */

// Consum teòric Fase 3: s'obté dels sliders del simulador (potència il·luminació + PC × hores)
// Es recalcula dinàmicament cada vegada per reflectir el que l'usuari té configurat
function getTeoF3() {
  const potlum = parseFloat(document.getElementById('sim-potlum')?.value || 500);
  const potpc  = parseFloat(document.getElementById('sim-potpc')?.value  || 800);
  const hores  = parseFloat(document.getElementById('sim-hores')?.value  || 8);
  return (potlum + potpc) * hores / 1000; // kWh/dia per aula
}

// Equips per defecte — camp "always" = true → equip 24h (no entra al teòric F3)
const INV_DEFAULTS = [
  { nom: 'PC Alumnes (Torre)',        q: 30, w: 100,  h: 11, sb: 1.5, always: false },
  { nom: 'Monitor PC',               q: 30, w: 16,   h: 11, sb: 0.5, always: false },
  { nom: 'Pissarra Digital',         q: 1,  w: 132,  h: 9,  sb: 0.5, always: false },
  { nom: 'Aire Condicionat / FRED',  q: 1,  w: 3490, h: 10, sb: 0,   always: false },
  { nom: 'Aire Condicionat / CALOR', q: 1,  w: 2820, h: 10, sb: 0,   always: false },
  { nom: 'Switch / Xarxa',           q: 1,  w: 1484, h: 24, sb: 0,   always: true  },
];

let invRows = [];
let invRowId = 0;

function initInv() {
  invRows = [];
  invRowId = 0;
  INV_DEFAULTS.forEach(d => addInvRow(d));
}

function addInvRow(data) {
  const id = invRowId++;
  const d  = data || { nom: '', q: 1, w: 0, h: 8, sb: 0, always: false };
  invRows.push({ id, ...d });
  renderInvTable();
}

function removeInvRow(id) {
  invRows = invRows.filter(r => r.id !== id);
  renderInvTable();
}

function renderInvTable() {
  const tbody = document.getElementById('inv-tbody');
  if (!tbody) return;

  tbody.innerHTML = invRows.map(r => `
    <tr id="inv-row-${r.id}" style="${r.always ? 'background:rgba(21,101,192,.06)' : ''}">
      <td>
        <input class="inv-in" style="width:130px;text-align:left" value="${r.nom}"
          oninput="invUpdate(${r.id},'nom',this.value)" placeholder="Nom equip">
      </td>
      <td><input class="inv-in" type="number" min="0" value="${r.q}"
            oninput="invUpdate(${r.id},'q',+this.value)"></td>
      <td><input class="inv-in" type="number" min="0" value="${r.w}"
            oninput="invUpdate(${r.id},'w',+this.value)"></td>
      <td><input class="inv-in" type="number" min="0" max="24" step="0.5" value="${r.h}"
            oninput="invUpdate(${r.id},'h',+this.value)"></td>
      <td><input class="inv-in" type="number" min="0" step="0.1" value="${r.sb}"
            oninput="invUpdate(${r.id},'sb',+this.value)"></td>
      <td style="text-align:center">
        <label style="display:flex;align-items:center;justify-content:center;gap:4px;cursor:pointer;font-size:.72rem;color:${r.always ? '#1565c0' : 'var(--text-soft)'}">
          <input type="checkbox" ${r.always ? 'checked' : ''}
            onchange="invUpdate(${r.id},'always',this.checked)"
            style="accent-color:#1565c0;cursor:pointer">
          24h
        </label>
      </td>
      <td class="calc-cell" id="inv-real-${r.id}">—</td>
      <td class="calc-cell" id="inv-teo-${r.id}">—</td>
      <td id="inv-dev-${r.id}">—</td>
      <td><button onclick="removeInvRow(${r.id})" style="background:none;border:none;cursor:pointer;color:#c62828;font-size:.9rem">✕</button></td>
    </tr>`).join('');

  calcInv();
}

function invUpdate(id, field, val) {
  const row = invRows.find(r => r.id === id);
  if (row) { row[field] = val; calcInv(); }
}

function calcInv() {
  let totSB = 0, totReal = 0;

  // Separar equips lectius (comparables amb F3) dels 24h (always=true)
  const lectiuRows = invRows.filter(r => !r.always);
  const always24Rows= invRows.filter(r =>  r.always);

  // Potència nominal total LECTIVA per distribuir el teòric proporcionalment
  const totPotLectiu = lectiuRows.reduce((s, r) => s + r.q * r.w, 0);
  const totTeoF3 = getTeoF3(); // kWh/dia de la F3 (solo equips lectius)

  let totReal24 = 0; // kWh/dia dels equips 24h

  invRows.forEach(r => {
    const realKwh = r.q * r.w * r.h / 1000;
    const sbW     = r.q * r.sb;
    totSB   += sbW;
    totReal += realKwh;
    if (r.always) totReal24 += realKwh;

    const rEl = document.getElementById(`inv-real-${r.id}`);
    const tEl = document.getElementById(`inv-teo-${r.id}`);
    const dEl = document.getElementById(`inv-dev-${r.id}`);

    if (rEl) rEl.textContent = realKwh.toFixed(2) + ' kWh';

    if (r.always) {
      // Equips 24h: no tenen teòric F3, es marquen com a "No inclòs F3"
      if (tEl) tEl.innerHTML = '<span style="font-size:.7rem;color:#1565c0;font-weight:700">🔵 24h</span>';
      if (dEl) dEl.innerHTML = '<span style="font-size:.7rem;color:#1565c0">No inclòs</span>';
    } else {
      // Equips lectius: distribuir teòric proporcionalment
      const pes    = totPotLectiu > 0 ? (r.q * r.w) / totPotLectiu : 0;
      const teoKwh = +(pes * totTeoF3).toFixed(2);
      const devRow = teoKwh > 0 ? +((realKwh - teoKwh) / teoKwh * 100).toFixed(1) : null;

      if (tEl) tEl.textContent = teoKwh.toFixed(2) + ' kWh';
      if (dEl && devRow !== null) {
        const absD = Math.abs(devRow);
        const cls  = absD <= 15 ? 'dev-ok' : devRow > 0 ? 'dev-pos' : 'dev-neg';
        dEl.innerHTML = `<span class="${cls}">${devRow > 0 ? '▲' : '▼'} ${absD}%</span>`;
      } else if (dEl) {
        dEl.textContent = '—';
      }
    }
  });

  // Totals separats: lectiu vs 24h
  const totTeo     = getTeoF3();          // kWh/dia teòric F3 (equips lectius)
  const totRealLec = totReal - totReal24; // kWh/dia real equips lectius
  const dev        = totTeo > 0 ? +((totRealLec - totTeo) / totTeo * 100).toFixed(1) : null;

  const sbEl   = document.getElementById('inv-tot-sb');
  const rEl    = document.getElementById('inv-tot-real');
  const tEl    = document.getElementById('inv-tot-teo');
  const dEl    = document.getElementById('inv-tot-dev');
  const concEl = document.getElementById('inv-conclusio');

  if (sbEl) sbEl.textContent = totSB.toFixed(1) + ' W';
  if (rEl)  rEl.innerHTML = `${totReal.toFixed(2)} kWh/dia
    <div style="font-size:.68rem;color:#1565c0;font-weight:600">
      (${totRealLec.toFixed(2)} lectiu + ${totReal24.toFixed(2)} 24h)
    </div>`;
  if (tEl)  tEl.textContent = totTeo.toFixed(2) + ' kWh/dia';

  if (dEl && dev !== null) {
    const abs = Math.abs(dev);
    const cls = abs <= 10 ? 'dev-ok' : dev > 0 ? 'dev-pos' : 'dev-neg';
    dEl.innerHTML = `<span class="${cls}">${dev > 0 ? '▲' : '▼'} ${abs}%</span>
      <div style="font-size:.68rem;color:#1565c0;margin-top:2px">equips lectius</div>`;
  }

  // Conclusió
  if (concEl) {
    concEl.style.display = 'block';
    const abs = dev !== null ? Math.abs(dev) : 0;
    let bg, icon, text;

    if (dev === null) {
      bg = 'rgba(168,110,60,.08)'; icon = 'ℹ️';
      text = 'Introdueix dades per veure la conclusió.';
    } else if (abs <= 10) {
      bg = 'rgba(64,145,108,.1)'; icon = '✅';
      text = `La calculadora és <strong>fiable pels equips lectius</strong>. Desviació de ${abs}% (≤10%), dins del marge acceptable.
        Els equips 24h (switch, servidor...) generaven la distorsió anterior perquè la Fase 3 no els separava.`;
    } else if (dev > 10) {
      bg = 'rgba(198,40,40,.08)'; icon = '❌';
      text = `La calculadora <strong>infraestima</strong> el consum lectiu en un ${abs}%.
        Real lectiu: <strong>${totRealLec.toFixed(2)} kWh/dia</strong> vs. teòric F3: <strong>${totTeo.toFixed(2)} kWh/dia</strong>.
        Possible causa: potències nominals reals superiors a les estimades, o hores d'ús majors.`;
    } else {
      bg = 'rgba(201,168,76,.1)'; icon = '⚠️';
      text = `La calculadora <strong>sobreestima</strong> el consum lectiu en un ${abs}%.
        Real lectiu: <strong>${totRealLec.toFixed(2)} kWh/dia</strong> vs. teòric F3: <strong>${totTeo.toFixed(2)} kWh/dia</strong>.
        Possible causa: hores d'ús reals menors o potències inferiors a les suposades.`;
    }

    concEl.style.background  = bg;
    concEl.style.border = `1.5px solid ${abs <= 10 ? 'rgba(64,145,108,.3)' : abs <= 30 ? 'rgba(201,168,76,.4)' : 'rgba(198,40,40,.3)'}`;
    concEl.innerHTML = `<strong style="font-size:.85rem">${icon} Conclusió:</strong> ${text}
      <div style="margin-top:.5rem;display:flex;flex-wrap:wrap;gap:.8rem;font-size:.75rem;color:var(--text-soft)">
        <span>💤 Standby total: <strong>${totSB.toFixed(1)} W</strong></span>
        <span>📅 Projecció lectiva anual: <strong>${(totRealLec * 180).toFixed(0)} kWh</strong></span>
        <span>🔵 Equips 24h anual: <strong>${(totReal24 * 365).toFixed(0)} kWh</strong></span>
        <span>📐 Teòric F3 anual: <strong>${(totTeo * 180).toFixed(0)} kWh</strong></span>
      </div>`;
  }
}

function resetInv() {
  initInv();
}

// Inicialitzar taula quan es carrega
document.addEventListener('DOMContentLoaded', () => { initInv(); });

/* ============================================================
   CALCULADORA D'APARELLS — kWh/any per equip
   ============================================================ */
const AP_DEFAULTS = [
  { nom:'PC Alumnes (Torre)',        u:30, w:100,  sb:1.5, hUs:6,  hSb:18, dies:180 },
  { nom:'Monitor PC',               u:30, w:16,   sb:0.5, hUs:6,  hSb:18, dies:180 },
  { nom:'Portàtil Professor',       u:1,  w:45,   sb:0.5, hUs:7,  hSb:1,  dies:180 },
  { nom:'Pissarra Digital',         u:1,  w:132,  sb:0.5, hUs:6,  hSb:2,  dies:180 },
  { nom:'Projector',                u:1,  w:280,  sb:1,   hUs:5,  hSb:0,  dies:180 },
  { nom:'Aire Condicionat (FRED)',  u:1,  w:3490, sb:0,   hUs:6,  hSb:0,  dies:120 },
  { nom:'Aire Condicionat (CALOR)', u:1,  w:2820, sb:0,   hUs:6,  hSb:0,  dies:80  },
  { nom:'Switch / Xarxa',           u:1,  w:1484, sb:0,   hUs:24, hSb:0,  dies:365 },
];

let apRows = [], apId = 0;

function apInit() {
  apRows = []; apId = 0;
  AP_DEFAULTS.forEach(d => apAddRow(d));
}

function apAddRow(data) {
  const id = apId++;
  apRows.push({ id, ...(data || { nom:'', u:1, w:0, sb:0, hUs:8, hSb:0, dies:180 }) });
  apRender();
}

function apRemove(id) {
  apRows = apRows.filter(r => r.id !== id);
  apRender();
}

function apUpdate(id, field, val) {
  const r = apRows.find(r => r.id === id);
  if (r) { r[field] = (field === 'nom') ? val : +val; apCalc(); }
}

function apRender() {
  const tbody = document.getElementById('ap-tbody');
  if (!tbody) return;
  tbody.innerHTML = apRows.map(r => `
    <tr>
      <td><input class="ap-in wide" value="${r.nom}" placeholder="Nom aparell"
        oninput="apUpdate(${r.id},'nom',this.value)"></td>
      <td><input class="ap-in" type="number" min="0" value="${r.u}"
        oninput="apUpdate(${r.id},'u',this.value)"></td>
      <td><input class="ap-in" type="number" min="0" value="${r.w}"
        oninput="apUpdate(${r.id},'w',this.value)"></td>
      <td><input class="ap-in" type="number" min="0" step="0.1" value="${r.sb}"
        oninput="apUpdate(${r.id},'sb',this.value)"></td>
      <td><input class="ap-in" type="number" min="0" max="24" step="0.5" value="${r.hUs}"
        oninput="apUpdate(${r.id},'hUs',this.value)"></td>
      <td><input class="ap-in" type="number" min="0" max="24" step="0.5" value="${r.hSb}"
        oninput="apUpdate(${r.id},'hSb',this.value)"></td>
      <td><input class="ap-in" type="number" min="1" max="365" value="${r.dies}"
        oninput="apUpdate(${r.id},'dies',this.value)"></td>
      <td class="ap-kwh" id="ap-us-${r.id}">—</td>
      <td class="ap-kwh" id="ap-sb-${r.id}" style="color:var(--wood-mid)">—</td>
      <td class="ap-kwh" id="ap-tot-${r.id}" style="font-size:.88rem">—</td>
      <td class="ap-cost" id="ap-cost-${r.id}">—</td>
      <td><button onclick="apRemove(${r.id})"
        style="background:none;border:none;cursor:pointer;color:#c62828;font-size:.9rem">✕</button></td>
    </tr>`).join('');
  apCalc();
}

function apCalc() {
  const tarifa = parseFloat(document.getElementById('ap-tarifa')?.value || 0.17);
  const diesGlobal = parseInt(document.getElementById('ap-dies')?.value || 180);

  let totUs = 0, totSb = 0, totKwh = 0, totCost = 0;

  apRows.forEach(r => {
    const dies  = r.dies || diesGlobal;
    const kwhUs = r.u * r.w  * r.hUs * dies / 1000;
    const kwhSb = r.u * r.sb * r.hSb * dies / 1000;
    const kwhTot= kwhUs + kwhSb;
    const cost  = kwhTot * tarifa;

    totUs   += kwhUs;
    totSb   += kwhSb;
    totKwh  += kwhTot;
    totCost += cost;

    const fmt = (v) => v.toFixed(1);
    const fmtC = (v) => v.toFixed(2) + ' €';

    const uEl = document.getElementById(`ap-us-${r.id}`);
    const sEl = document.getElementById(`ap-sb-${r.id}`);
    const tEl = document.getElementById(`ap-tot-${r.id}`);
    const cEl = document.getElementById(`ap-cost-${r.id}`);
    if (uEl) uEl.textContent = fmt(kwhUs)  + ' kWh';
    if (sEl) sEl.textContent = fmt(kwhSb)  + ' kWh';
    if (tEl) tEl.textContent = fmt(kwhTot) + ' kWh';
    if (cEl) cEl.textContent = fmtC(cost);
  });

  // Totals
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ap-tot-us',   totUs.toFixed(1)   + ' kWh/any');
  set('ap-tot-sb',   totSb.toFixed(1)   + ' kWh/any');
  set('ap-tot-kwh',  totKwh.toFixed(1)  + ' kWh/any');
  set('ap-tot-cost', totCost.toFixed(2) + ' €/any');

  // KPI summary cards
  const summary = document.getElementById('ap-summary');
  if (!summary) return;
  const co2 = (totKwh * 0.233).toFixed(0); // factor emissions mitjà Espanya
  summary.innerHTML = `
    <div class="ap-kpi" style="background:linear-gradient(135deg,#1b5e20,#40916c)">
      <div class="val">${totKwh.toFixed(0)} kWh</div>
      <div class="lbl">Consum total anual</div>
    </div>
    <div class="ap-kpi" style="background:linear-gradient(135deg,#0d47a1,#42a5f5)">
      <div class="val">${totSb.toFixed(0)} kWh</div>
      <div class="lbl">D'ells en standby</div>
    </div>
    <div class="ap-kpi" style="background:linear-gradient(135deg,var(--wood-dark),var(--wood-tan))">
      <div class="val">${totCost.toFixed(0)} €</div>
      <div class="lbl">Cost total anual (${tarifa} €/kWh)</div>
    </div>
    <div class="ap-kpi" style="background:linear-gradient(135deg,#4a148c,#9c27b0)">
      <div class="val">${co2} kg</div>
      <div class="lbl">CO₂ equivalent (0,233 kg/kWh)</div>
    </div>
    <div class="ap-kpi" style="background:linear-gradient(135deg,#bf360c,#ff7043)">
      <div class="val">${(totSb / totKwh * 100).toFixed(1)}%</div>
      <div class="lbl">% del consum és standby</div>
    </div>`;
}

function apReset() { apInit(); }

document.addEventListener('DOMContentLoaded', () => { apInit(); });
