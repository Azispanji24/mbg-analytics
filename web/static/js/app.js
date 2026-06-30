/* ================================================================
   MBG Analytics — Frontend JavaScript
   Handles: API polling, Chart rendering, Table rendering, D3 Network
   ================================================================ */

const API = {
  status  : () => fetch('/api/status').then(r => r.json()),
  start   : () => fetch('/api/start',  { method: 'POST' }).then(r => r.json()),
  reset   : () => fetch('/api/reset',  { method: 'POST' }).then(r => r.json()),
  results : () => fetch('/api/results').then(r => r.json()),
  rules   : (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`/api/rules?${q}`).then(r => r.json());
  },
};

// ─── Global State ────────────────────────────────────────────────────
let allRules     = [];
let allItemsets  = [];
let pollTimer    = null;
let charts       = {};
let globalData   = null;

// ─── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const status = await API.status();
  if (status.stage === 'done') {
    showDone();
    await loadAndRender();
  } else if (['downloading','ocr','mining'].includes(status.stage)) {
    updateProgressUI(status);
    showProgress();
    startPolling();
  }
  initFilterListeners();
});

// ─── Start Preset (instant) ───────────────────────────────────────────
async function startPreset() {
  disableModeBtns();
  showProgress();
  const res = await API.start ? null : null; // placeholder
  await fetch('/api/start-preset', { method: 'POST' });
  startPolling();
}

// ─── Start Drive (full pipeline) ─────────────────────────────────────
async function startDrive() {
  const ok = confirm(
    'Mode Analisis dari Drive akan:\n' +
    '  - Download 846 gambar dari Google Drive\n' +
    '  - Jalankan OCR pada setiap gambar\n' +
    '  - Proses bisa memakan 30-60 menit\n\n' +
    'Lanjutkan?'
  );
  if (!ok) return;
  disableModeBtns();
  showProgress();
  await fetch('/api/start-drive', { method: 'POST' });
  startPolling();
}

function disableModeBtns() {
  const btnP = document.getElementById('btn-preset');
  const btnD = document.getElementById('btn-drive');
  if (btnP) btnP.disabled = true;
  if (btnD) btnD.disabled = true;
}

async function resetProcessing() {
  if (pollTimer) clearInterval(pollTimer);
  await API.reset();
  location.reload();
}

// ─── Polling ─────────────────────────────────────────────────────────
function startPolling() {
  pollTimer = setInterval(async () => {
    const status = await API.status();
    updateProgressUI(status);
    if (status.stage === 'done') {
      clearInterval(pollTimer);
      showDone();
      await loadAndRender();
    } else if (status.stage === 'error') {
      clearInterval(pollTimer);
      showError(status.error);
    }
  }, 1500);
}

function updateProgressUI(s) {
  const bar   = document.getElementById('progress-bar');
  const pct   = document.getElementById('progress-pct');
  const msg   = document.getElementById('progress-msg');
  const stage = document.getElementById('stage-label');

  const labels = {
    idle: 'Idle', downloading: '📥 Download', ocr: '🔍 OCR',
    mining: '⛏️ Mining', done: '✅ Selesai', error: '❌ Error'
  };

  bar.style.width    = `${s.progress}%`;
  pct.textContent    = `${s.progress}%`;
  msg.textContent    = s.message;
  stage.textContent  = labels[s.stage] || s.stage;
  if (s.stage === 'error') bar.style.background = '#ef4444';
}

// ─── UI Helpers ──────────────────────────────────────────────────────
function showProgress() {
  document.getElementById('progress-container').style.display = 'block';
}
function showDone() {
  const btnP    = document.getElementById('btn-preset');
  const btnD    = document.getElementById('btn-drive');
  const btnR    = document.getElementById('btn-reset');
  const btnDL   = document.getElementById('btn-download');
  if (btnP)  btnP.style.display  = 'none';
  if (btnD)  btnD.style.display  = 'none';
  if (btnR)  btnR.style.display  = 'flex';
  if (btnDL) btnDL.style.display = 'inline-flex'; // tampilkan tombol download
  updateProgressUI({ stage:'done', progress:100, message:'Analisis selesai! ✅' });
}

// ─── Download Hasil Analisis ──────────────────────────────────────
async function downloadResults() {
  const btnDL = document.getElementById('btn-download');
  if (btnDL) {
    btnDL.disabled = true;
    btnDL.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Menyiapkan...
    `;
  }

  try {
    const res = await fetch('/api/download');
    if (!res.ok) {
      const err = await res.json().catch(() => ({ msg: 'Gagal mengunduh' }));
      alert('❌ ' + (err.msg || 'Gagal mengunduh hasil analisis.'));
      return;
    }
    // Trigger browser download
    const blob        = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match       = disposition.match(/filename="?([^"]+)"?/);
    const filename    = match ? match[1] : 'MBG_Analytics_Hasil.zip';
    const url         = URL.createObjectURL(blob);
    const a           = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('❌ Terjadi kesalahan: ' + e.message);
  } finally {
    if (btnDL) {
      btnDL.disabled = false;
      btnDL.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download Hasil Analisis
        <span class="btn-sub">(.xlsx Excel)</span>
      `;
    }
  }
}

// ─── Load & Render Everything ─────────────────────────────────────────
async function loadAndRender() {
  const res = await API.results();
  if (!res.ok) return;
  globalData = res.data;
  const d    = globalData;

  allRules    = d.rules    || [];
  allItemsets = d.frequent_itemsets || [];

  // Update hero subtitle dengan jumlah gambar aktual
  const imgTxt = document.getElementById('img-count-txt');
  if (imgTxt) imgTxt.textContent = `${(d.meta.total_images||0).toLocaleString('id-ID')} foto menu`;

  // Tampilkan info last_updated & sumber data
  const updBar = document.getElementById('last-updated-bar');
  if (updBar && d.meta.last_updated) {
    const src = d.meta.source === 'drive' ? 'Google Drive' : 'Data Preset';
    const newImg = d.meta.new_images_this_run > 0
      ? ` &nbsp;|&nbsp; <span style="color:#22c55e;font-weight:700">+${d.meta.new_images_this_run} gambar baru</span>`
      : '';
    updBar.innerHTML = `Terakhir diperbarui: ${d.meta.last_updated} &nbsp;|&nbsp; Sumber: ${src}${newImg}`;
    updBar.style.display = 'block';
  }

  // Stats strip
  animateVal('val-images', d.meta.total_images);
  animateVal('val-tx',     d.meta.total_transactions);
  animateVal('val-items',  d.meta.unique_items.length);
  animateVal('val-freq',   d.meta.total_frequent_itemsets);
  animateVal('val-rules',  d.meta.total_rules);
  animateVal('val-top',    d.meta.total_rules_filtered);

  // Charts
  renderItemFreqChart(d.item_frequency);
  renderFormatChart(d.meta.format_dist);
  renderDistChart(d.item_dist_per_transaction);
  renderScatterChart(allRules);

  // Tables / Grids
  renderRulesTable(allRules);
  renderItemsetsGrid(allItemsets.slice(0, 40));
  renderTopRules(d.rules_filtered);

  // Network
  renderNetwork(allRules.slice(0, 30), d.item_frequency);
}

// ─── Animate Counter ─────────────────────────────────────────────────
function animateVal(id, target) {
  const el  = document.getElementById(id);
  const dur = 800;
  const step = Math.ceil(target / (dur / 16));
  let cur = 0;
  const tick = setInterval(() => {
    cur = Math.min(cur + step, target);
    el.textContent = cur.toLocaleString('id-ID');
    if (cur >= target) clearInterval(tick);
  }, 16);
}

// ─── Charts ──────────────────────────────────────────────────────────
const CHART_COLORS = [
  '#6c63ff','#00d4ff','#ff6b9d','#ffd93d','#22c55e',
  '#f97316','#a78bfa','#34d399','#fb7185','#60a5fa',
  '#fbbf24','#4ade80','#f472b6','#38bdf8','#c084fc'
];

function chartDefaults() {
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
}
chartDefaults();

function renderItemFreqChart(freq) {
  const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0, 15);
  const labels = sorted.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
  const data   = sorted.map(([,v]) => v);

  if (charts.items) charts.items.destroy();
  const ctx = document.getElementById('chart-items').getContext('2d');
  charts.items = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Frekuensi',
        data,
        backgroundColor: CHART_COLORS.map(c => c + 'cc'),
        borderColor:     CHART_COLORS,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        label: ctx => ` ${ctx.raw} transaksi`
      }}},
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderFormatChart(dist) {
  if (charts.formats) charts.formats.destroy();
  const ctx = document.getElementById('chart-formats').getContext('2d');
  charts.formats = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['PNG','JPG','JPEG'],
      datasets: [{
        data: [dist.png||0, dist.jpg||0, dist.jpeg||0],
        backgroundColor: ['#6c63ff','#00d4ff','#ff6b9d'],
        borderWidth: 2,
        borderColor: '#161921',
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } } }
    }
  });
}

function renderDistChart(dist) {
  if (charts.dist) charts.dist.destroy();
  const sorted = Object.entries(dist).sort((a,b)=>+a[0]-+b[0]);
  const ctx = document.getElementById('chart-dist').getContext('2d');
  charts.dist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([k]) => `${k} item`),
      datasets: [{
        label: 'Transaksi',
        data: sorted.map(([,v]) => v),
        backgroundColor: '#6c63ffcc',
        borderColor: '#6c63ff',
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderScatterChart(rules) {
  if (charts.scatter) charts.scatter.destroy();
  const ctx = document.getElementById('chart-scatter').getContext('2d');
  const pts = rules.map(r => ({
    x: r.support,
    y: r.confidence,
    r: Math.max(4, r.lift * 3),
    label: `${r.antecedents} → ${r.consequents}`,
    lift: r.lift
  }));

  charts.scatter = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Rules',
        data: pts,
        backgroundColor: pts.map(p =>
          p.lift > 2 ? '#ff6b9d88' :
          p.lift > 1.5 ? '#f9731688' : '#6c63ff66'
        ),
        borderColor: pts.map(p =>
          p.lift > 2 ? '#ff6b9d' : p.lift > 1.5 ? '#f97316' : '#6c63ff'
        ),
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pt = ctx.raw;
              return [
                pt.label,
                `Support: ${(pt.x*100).toFixed(1)}%`,
                `Confidence: ${(pt.y*100).toFixed(1)}%`,
                `Lift: ${pt.lift.toFixed(3)}`,
              ];
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Support' }, min: 0,
             grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { title: { display: true, text: 'Confidence' }, min: 0.5, max: 1.05,
             grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// ─── Rules Table ─────────────────────────────────────────────────────
function renderRulesTable(rules) {
  const tbody = document.getElementById('rules-tbody');
  if (!rules.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Tidak ada rules yang sesuai filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = rules.map((r, i) => {
    const ants = r.antecedents.split(', ').map(a =>
      `<span class="item-tag">${a}</span>`).join('');
    const cons = r.consequents.split(', ').map(c =>
      `<span class="item-tag consequent">${c}</span>`).join('');

    let strength, sClass;
    if (r.lift >= 2.0) { strength = '🔥 Sangat Kuat'; sClass = 'strength-high'; }
    else if (r.lift >= 1.5) { strength = '⚡ Kuat'; sClass = 'strength-mid'; }
    else { strength = '📌 Lemah'; sClass = 'strength-low'; }

    return `<tr>
      <td class="rule-num">#${i+1}</td>
      <td>${ants}</td>
      <td>${cons}</td>
      <td><span class="metric-val support">${(r.support*100).toFixed(1)}%</span></td>
      <td><span class="metric-val confidence">${(r.confidence*100).toFixed(1)}%</span></td>
      <td><span class="metric-val lift">${r.lift.toFixed(3)}</span></td>
      <td><span class="strength-badge ${sClass}">${strength}</span></td>
    </tr>`;
  }).join('');
}

// ─── Itemsets Grid ────────────────────────────────────────────────────
function renderItemsetsGrid(itemsets) {
  const grid = document.getElementById('itemsets-grid');
  if (!itemsets.length) {
    grid.innerHTML = '<div class="itemset-placeholder">Tidak ada data.</div>';
    return;
  }

  const maxSup = itemsets[0].support;
  grid.innerHTML = itemsets.map(is => {
    const items = is.itemset.split(', ').map(item =>
      `<span class="item">${item}</span>`).join(' + ');
    const pct = (is.support / maxSup * 100).toFixed(0);
    return `<div class="itemset-card">
      <div class="itemset-items">${items}</div>
      <div class="itemset-footer">
        <div class="support-bar-wrap">
          <div class="support-bar-track">
            <div class="support-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <span class="support-num">${(is.support*100).toFixed(1)}%</span>
        <span class="length-badge" style="margin-left:8px">${is.length}-item</span>
      </div>
    </div>`;
  }).join('');
}

// ─── Top Rules ────────────────────────────────────────────────────────
function renderTopRules(rules) {
  const grid = document.getElementById('top-rules-grid');
  if (!rules || !rules.length) {
    grid.innerHTML = '<div class="top-rule-placeholder">Tidak ada rules signifikan.</div>';
    return;
  }

  const colors = ['#6c63ff','#00d4ff','#ff6b9d','#ffd93d','#22c55e'];
  grid.innerHTML = rules.map((r, i) => {
    const ants = r.antecedents.split(', ').map(a =>
      `<span class="item-tag">${a}</span>`).join('');
    const cons = r.consequents.split(', ').map(c =>
      `<span class="item-tag consequent">${c}</span>`).join('');
    const c = colors[i % colors.length];

    return `<div class="top-rule-card" style="--accent:${c}">
      <span class="top-rule-num">#${i+1}</span>
      <div class="top-rule-label">Jika ada</div>
      <div class="top-rule-antecedent">${ants}</div>
      <div class="top-rule-arrow">↓</div>
      <div class="top-rule-label">Maka ada</div>
      <div class="top-rule-consequent">${cons}</div>
      <div class="top-rule-metrics">
        <div class="metric-item">
          <div class="value" style="color:var(--accent-green)">${(r.support*100).toFixed(1)}%</div>
          <div class="label">Support</div>
        </div>
        <div class="metric-item">
          <div class="value" style="color:var(--accent-4)">${(r.confidence*100).toFixed(1)}%</div>
          <div class="label">Confidence</div>
        </div>
        <div class="metric-item">
          <div class="value" style="color:${c}">${r.lift.toFixed(2)}x</div>
          <div class="label">Lift</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ─── D3 Network Graph ─────────────────────────────────────────────────
function renderNetwork(rules, freqMap) {
  const container = document.getElementById('network-graph');
  container.innerHTML = '';

  const W = container.clientWidth  || 800;
  const H = container.clientHeight || 480;

  // Build nodes & links
  const nodeSet  = new Set();
  const links    = [];

  rules.forEach(r => {
    const ants = r.antecedents.split(', ');
    const cons = r.consequents.split(', ');
    ants.forEach(a => nodeSet.add(a));
    cons.forEach(c => nodeSet.add(c));
    ants.forEach(a => cons.forEach(c => {
      links.push({ source: a, target: c, lift: r.lift, confidence: r.confidence });
    }));
  });

  const nodes = Array.from(nodeSet).map(id => ({
    id,
    freq: freqMap[id] || 1
  }));
  const maxFreq = Math.max(...nodes.map(n => n.freq));

  const svg = d3.select('#network-graph')
    .append('svg')
    .attr('width', W).attr('height', H);

  // Arrow markers
  svg.append('defs').selectAll('marker')
    .data(['high','mid','low'])
    .enter().append('marker')
    .attr('id', d => `arrow-${d}`)
    .attr('viewBox','0 -5 10 10')
    .attr('refX', 20).attr('refY', 0)
    .attr('markerWidth', 6).attr('markerHeight', 6)
    .attr('orient','auto')
    .append('path').attr('d','M0,-5L10,0L0,5')
    .attr('fill', d => d==='high' ? '#ff6b9d' : d==='mid' ? '#f97316' : '#475569');

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-220))
    .force('center', d3.forceCenter(W/2, H/2))
    .force('collision', d3.forceCollide().radius(d => nodeR(d.freq, maxFreq) + 8));

  // Draw links
  const link = svg.append('g').selectAll('line')
    .data(links).enter().append('line')
    .attr('stroke', d => d.lift > 2 ? '#ff6b9d' : d.lift > 1.5 ? '#f97316' : '#475569')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', d => Math.min(4, d.lift))
    .attr('marker-end', d => `url(#arrow-${d.lift>2?'high':d.lift>1.5?'mid':'low'})`);

  // Draw nodes
  const node = svg.append('g').selectAll('g')
    .data(nodes).enter().append('g')
    .call(d3.drag()
      .on('start', (e,d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; })
      .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y; })
      .on('end',   (e,d) => { if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null; })
    );

  node.append('circle')
    .attr('r', d => nodeR(d.freq, maxFreq))
    .attr('fill', (_, i) => CHART_COLORS[i % CHART_COLORS.length] + 'cc')
    .attr('stroke', (_, i) => CHART_COLORS[i % CHART_COLORS.length])
    .attr('stroke-width', 2)
    .append('title').text(d => `${d.id} (${d.freq} transaksi)`);

  node.append('text')
    .attr('text-anchor','middle').attr('dy','0.35em')
    .attr('fill','white').attr('font-size', d => nodeR(d.freq, maxFreq) > 18 ? 12 : 10)
    .attr('font-weight','600').attr('font-family','Inter, sans-serif')
    .attr('pointer-events','none')
    .text(d => d.id.charAt(0).toUpperCase() + d.id.slice(1));

  sim.on('tick', () => {
    link
      .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('transform', d => `translate(${Math.max(30, Math.min(W-30,d.x))},${Math.max(30,Math.min(H-30,d.y))})`);
  });
}

function nodeR(freq, maxFreq) {
  return 12 + (freq / maxFreq) * 22;
}

// ─── Filters ─────────────────────────────────────────────────────────
function initFilterListeners() {
  document.getElementById('filter-lift').addEventListener('input', e => {
    document.getElementById('lift-val').textContent = (+e.target.value).toFixed(1);
  });
  document.getElementById('filter-conf').addEventListener('input', e => {
    document.getElementById('conf-val').textContent = (e.target.value * 100).toFixed(0) + '%';
  });
}

function applyFilters() {
  if (!allRules.length) return;
  const minLift = +document.getElementById('filter-lift').value;
  const minConf = +document.getElementById('filter-conf').value;
  const limit   = +document.getElementById('filter-limit').value;

  const filtered = allRules
    .filter(r => r.lift >= minLift && r.confidence >= minConf)
    .slice(0, limit);

  renderRulesTable(filtered);
  renderScatterChart(filtered);
}

function resetFilters() {
  document.getElementById('filter-lift').value = 0;
  document.getElementById('filter-conf').value = 0;
  document.getElementById('filter-limit').value = 20;
  document.getElementById('lift-val').textContent = '0.0';
  document.getElementById('conf-val').textContent = '0%';
  renderRulesTable(allRules.slice(0, 20));
  renderScatterChart(allRules);
}
