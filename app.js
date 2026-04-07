/* =========================================================
   PRISON STATISTICS DASHBOARD — app.js
   Reads: 3510015401_databaseLoadingData.csv (relative path)
   ========================================================= */

'use strict';

// ── Metric definitions ─────────────────────────────────────
// parentId: null → standalone or top-level; childOf → string key of parent
const METRICS = [
  { key: 'total_actual_in',       label: 'Total Actual-In',             csvName: 'Total actual-in count',                      unit: 'Persons', isParent: true,  childOf: null,              color: '#58a6ff' },
  { key: 'sentenced',             label: 'Sentenced',                   csvName: 'Sentenced, actual-in count',                 unit: 'Persons', isParent: false, childOf: 'total_actual_in', color: '#3fb950' },
  { key: 'remand',                label: 'Remand',                      csvName: 'Remand, actual-in count',                    unit: 'Persons', isParent: false, childOf: 'total_actual_in', color: '#d29922' },
  { key: 'other_statuses',        label: 'Other Statuses',              csvName: 'Other statuses, actual-in count',            unit: 'Persons', isParent: false, childOf: 'total_actual_in', color: '#bc8cff' },
  { key: 'on_register',           label: 'On-Register',                 csvName: 'On-register count',                          unit: 'Persons', isParent: true,  childOf: null,              color: '#f778ba' },
  { key: 'incarceration_rate',    label: 'Incarceration Rate',          csvName: 'Incarceration rates per 100,000 adults',     unit: 'Rate',    isParent: true,  childOf: null,              color: '#f85149' },
  { key: 'total_community',       label: 'Total Community Supervision', csvName: 'Total community supervision count',          unit: 'Persons', isParent: true,  childOf: null,              color: '#39d353' },
  { key: 'probation',             label: 'Probation',                   csvName: 'Probation, community supervision',           unit: 'Persons', isParent: false, childOf: 'total_community', color: '#56d364' },
  { key: 'conditional',           label: 'Conditional Sentence',        csvName: 'Conditional sentence, community supervision',unit: 'Persons', isParent: false, childOf: 'total_community', color: '#ffa657' },
  { key: 'prov_parole',           label: 'Provincial Parole',           csvName: 'Provincial parole, community supervision',   unit: 'Persons', isParent: false, childOf: 'total_community', color: '#ff7b72' },
  { key: 'probation_rate',        label: 'Probation Rate',              csvName: 'Probation rates per 100,000 adults',         unit: 'Rate',    isParent: true,  childOf: null,              color: '#e3b341' },
];

const METRIC_MAP = Object.fromEntries(METRICS.map(m => [m.key, m]));

// Default active metrics (parents only + incarceration rate)
const DEFAULT_ACTIVE = ['total_actual_in', 'incarceration_rate', 'total_community'];

// ── State ──────────────────────────────────────────────────
let rawData = {};   // key → { year: string, value: number }[]
let allYears = [];
let activeMetrics = new Set(DEFAULT_ACTIVE);
let yearStart = '2010/2011';
let yearEnd   = '';     // populated after data loads

// Chart instances
let mainChart, custodyChart, communityChart;

// ── Helpers ────────────────────────────────────────────────
const fmtNum = (n, unit) => {
  if (n == null || isNaN(n)) return '—';
  if (unit === 'Rate') return n.toFixed(2);
  return n >= 1000 ? n.toLocaleString('en-CA', { maximumFractionDigits: 1 }) : n.toFixed(1);
};

const pct = (a, b) => {
  if (!a || !b || b === 0) return null;
  return ((a - b) / Math.abs(b)) * 100;
};

const cssVar = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// ── Theme toggle ───────────────────────────────────────────
const themeBtn = document.getElementById('theme-toggle');
const themeIcon = themeBtn.querySelector('.theme-icon');
let isDark = true;

themeBtn.addEventListener('click', () => {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  document.body.classList.toggle('light', !isDark);
  themeIcon.textContent = isDark ? '☀️' : '🌙';
  refreshAllCharts();
});

// ── Data loading ───────────────────────────────────────────
async function loadData() {
  // Use relative path so the folder can be moved
  const csvPath = '3510015401_databaseLoadingData.csv';
  const response = await fetch(csvPath);
  const text = await response.text();

  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

  METRICS.forEach(m => { rawData[m.key] = []; });

  const yearSet = new Set();

  parsed.data.forEach(row => {
    const csvName = row['Custodial and community supervision'];
    const ref     = row['REF_DATE'];
    const valStr  = row['VALUE'];
    const status  = row['STATUS'];

    if (!csvName || !ref) return;

    // Skip suppressed / not-available rows
    if (status && (status === '..' || status === '...')) return;

    const val = parseFloat(valStr);
    if (isNaN(val)) return;

    const metric = METRICS.find(m => m.csvName === csvName);
    if (!metric) return;

    rawData[metric.key].push({ year: ref, value: val });
    yearSet.add(ref);
  });

  allYears = Array.from(yearSet).sort();

  // Default end year = last year
  yearEnd = allYears[allYears.length - 1];
  // Default start = 2010 or earliest if not present
  yearStart = allYears.find(y => y.startsWith('2010')) || allYears[0];

  buildControls();
  render();
}

// ── Controls ───────────────────────────────────────────────
function buildControls() {
  // Year selectors
  const startSel = document.getElementById('year-start');
  const endSel   = document.getElementById('year-end');

  allYears.forEach(y => {
    startSel.appendChild(new Option(y, y));
    endSel.appendChild(new Option(y, y));
  });
  startSel.value = yearStart;
  endSel.value   = yearEnd;

  startSel.addEventListener('change', () => { yearStart = startSel.value; render(); });
  endSel.addEventListener('change',   () => { yearEnd   = endSel.value;   render(); });

  // Quick buttons
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const yrs = parseInt(btn.dataset.years);
      if (yrs === 0) {
        yearStart = allYears[0];
      } else {
        const lastIdx = allYears.indexOf(yearEnd);
        const newStartIdx = Math.max(0, lastIdx - yrs + 1);
        yearStart = allYears[newStartIdx];
      }
      startSel.value = yearStart;
      document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  // Metric pills
  const pillsEl = document.getElementById('metric-pills');
  METRICS.forEach(m => {
    const pill = document.createElement('button');
    pill.id = `pill-${m.key}`;
    pill.className = 'metric-pill' + (m.isParent ? ' parent-pill' : '') + (activeMetrics.has(m.key) ? ' active' : '');
    pill.textContent = m.label;
    pill.style.setProperty('--pill-color', m.color);
    if (activeMetrics.has(m.key)) {
      pill.style.background = m.color;
    }
    pill.addEventListener('click', () => {
      if (activeMetrics.has(m.key)) {
        activeMetrics.delete(m.key);
        pill.classList.remove('active');
        pill.style.background = '';
      } else {
        activeMetrics.add(m.key);
        pill.classList.add('active');
        pill.style.background = m.color;
      }
      render();
    });
    pillsEl.appendChild(pill);
  });
}

// ── Filtered data helpers ─────────────────────────────────
function filteredYears() {
  const si = allYears.indexOf(yearStart);
  const ei = allYears.indexOf(yearEnd);
  return allYears.slice(si, ei + 1);
}

function getSeriesData(metricKey, years) {
  const map = Object.fromEntries((rawData[metricKey] || []).map(d => [d.year, d.value]));
  return years.map(y => map[y] ?? null);
}

// ── Render orchestrator ────────────────────────────────────
function render() {
  const years = filteredYears();
  renderKPIs(years);
  renderMainChart(years);
  renderCustodyChart(years);
  renderCommunityChart(years);
  renderGrowthTable(years);
}

function refreshAllCharts() {
  const years = filteredYears();
  renderMainChart(years);
  renderCustodyChart(years);
  renderCommunityChart(years);
}

// ── KPI Cards ──────────────────────────────────────────────
function renderKPIs(years) {
  const container = document.getElementById('kpi-cards');
  container.innerHTML = '';

  const lastYear  = years[years.length - 1];
  const firstYear = years[0];

  activeMetrics.forEach(key => {
    const m  = METRIC_MAP[key];
    const map = Object.fromEntries((rawData[key] || []).map(d => [d.year, d.value]));
    const lastVal  = map[lastYear];
    const firstVal = map[firstYear];
    const change   = pct(lastVal, firstVal);

    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.style.setProperty('--card-color', m.color);

    let changeHtml = '';
    if (change !== null) {
      const cls = change > 0 ? 'pos' : change < 0 ? 'neg' : 'neu';
      const arrow = change > 0 ? '▲' : change < 0 ? '▼' : '→';
      changeHtml = `<div class="kpi-change ${cls}">${arrow} ${Math.abs(change).toFixed(1)}% over period</div>`;
    }

    card.innerHTML = `
      <div class="kpi-label">${m.label}</div>
      <div class="kpi-value">${fmtNum(lastVal, m.unit)}</div>
      ${changeHtml}
      <div class="kpi-period">${firstYear} → ${lastYear}</div>
    `;
    container.appendChild(card);
  });
}

// ── Chart helpers ──────────────────────────────────────────
function chartThemeDefaults() {
  const textColor   = isDark ? '#8b949e' : '#57606a';
  const gridColor   = isDark ? 'rgba(48,54,61,0.7)' : 'rgba(208,215,222,0.7)';
  return {
    plugins: {
      legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 }, padding: 14 } },
      tooltip: {
        backgroundColor: isDark ? '#1c2333' : '#fff',
        borderColor: isDark ? '#30363d' : '#d0d7de',
        borderWidth: 1,
        titleColor: isDark ? '#e6edf3' : '#1f2328',
        bodyColor:  isDark ? '#8b949e' : '#57606a',
        padding: 10,
        cornerRadius: 8,
      }
    },
    scales: {
      x: { ticks: { color: textColor, font: { family: 'Inter', size: 10 }, maxRotation: 45 }, grid: { color: gridColor } },
      y: { ticks: { color: textColor, font: { family: 'Inter', size: 10 } },                  grid: { color: gridColor } },
    },
    animation: { duration: 400 },
    responsive: true,
    maintainAspectRatio: false,
  };
}

// ── Main trend chart ───────────────────────────────────────
function renderMainChart(years) {
  const canvas = document.getElementById('main-chart');
  const defaults = chartThemeDefaults();

  // Build datasets only for active non-child metrics (or user can pick any)
  const datasets = [];
  activeMetrics.forEach(key => {
    const m    = METRIC_MAP[key];
    const data = getSeriesData(key, years);
    datasets.push({
      label: m.label + (m.unit === 'Rate' ? ' (rate)' : ''),
      data,
      borderColor: m.color,
      backgroundColor: m.color + '22',
      tension: 0.35,
      fill: false,
      pointRadius: years.length > 30 ? 2 : 4,
      pointHoverRadius: 6,
      borderWidth: 2,
    });
  });

  if (mainChart) mainChart.destroy();
  mainChart = new Chart(canvas, {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      ...defaults,
      interaction: { mode: 'index', intersect: false },
    },
  });
}

// ── Custody breakdown (stacked area) ──────────────────────
function renderCustodyChart(years) {
  const canvas = document.getElementById('custody-chart');
  const defaults = chartThemeDefaults();

  const childKeys = METRICS.filter(m => m.childOf === 'total_actual_in').map(m => m.key);
  const datasets = childKeys.map(key => {
    const m = METRIC_MAP[key];
    return {
      label: m.label,
      data: getSeriesData(key, years),
      borderColor: m.color,
      backgroundColor: m.color + '55',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
    };
  });

  if (custodyChart) custodyChart.destroy();
  custodyChart = new Chart(canvas, {
    type: 'line',
    data: { labels: years, datasets },
    options: {
      ...defaults,
      interaction: { mode: 'index', intersect: false },
      scales: {
        ...defaults.scales,
        y: { ...defaults.scales.y, stacked: true },
      },
    },
  });
}

// ── Community supervision (stacked bar) ───────────────────
function renderCommunityChart(years) {
  const canvas = document.getElementById('community-chart');
  const defaults = chartThemeDefaults();

  const childKeys = METRICS.filter(m => m.childOf === 'total_community').map(m => m.key);
  const datasets = childKeys.map(key => {
    const m = METRIC_MAP[key];
    return {
      label: m.label,
      data: getSeriesData(key, years),
      backgroundColor: m.color + '99',
      borderColor: m.color,
      borderWidth: 1,
    };
  });

  if (communityChart) communityChart.destroy();
  communityChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: years, datasets },
    options: {
      ...defaults,
      interaction: { mode: 'index', intersect: false },
      scales: {
        ...defaults.scales,
        x: { ...defaults.scales.x, stacked: true },
        y: { ...defaults.scales.y, stacked: true },
      },
    },
  });
}

// ── Growth table ───────────────────────────────────────────
function renderGrowthTable(years) {
  const thead = document.getElementById('growth-thead');
  const tbody = document.getElementById('growth-tbody');
  thead.innerHTML = '';
  tbody.innerHTML = '';

  if (!activeMetrics.size || years.length < 2) return;

  // Header row
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Fiscal Year</th>';
  activeMetrics.forEach(key => {
    const m = METRIC_MAP[key];
    const th = document.createElement('th');
    th.textContent = m.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // Data rows (show each year, with YoY % change in parentheses)
  years.forEach((yr, i) => {
    const tr = document.createElement('tr');
    const tdYear = document.createElement('td');
    tdYear.textContent = yr;
    tr.appendChild(tdYear);

    activeMetrics.forEach(key => {
      const m   = METRIC_MAP[key];
      const map = Object.fromEntries((rawData[key] || []).map(d => [d.year, d.value]));
      const val     = map[yr];
      const prevVal = i > 0 ? map[years[i - 1]] : null;
      const change  = pct(val, prevVal);

      const td = document.createElement('td');

      if (val == null || isNaN(val)) {
        td.innerHTML = '<span class="na">—</span>';
      } else {
        let changeStr = '';
        if (change !== null) {
          const cls   = change > 0 ? 'pos' : change < 0 ? 'neg' : 'na';
          const arrow = change > 0 ? '△' : change < 0 ? '▽' : '';
          changeStr = ` <span class="${cls}">${arrow}${Math.abs(change).toFixed(1)}%</span>`;
        }
        td.innerHTML = `${fmtNum(val, m.unit)}${changeStr}`;
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ── Bootstrap ──────────────────────────────────────────────
loadData().catch(err => {
  console.error('Failed to load data:', err);
  document.querySelector('.dashboard').innerHTML =
    `<div style="padding:2rem;color:var(--red)">
       ⚠️ Could not load data file. Make sure <code>3510015401_databaseLoadingData.csv</code> is in the same folder.
     </div>`;
});
