/**
 * Chart rendering helpers (Chart.js)
 */

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(destroyChart);
}

// ── Monthly Rainfall Bar Chart ─────────────────────────────────────────────
function renderMonthlyRainfallChart(canvasId, monthlyData, year) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const filtered = year ? monthlyData.filter(m => m.year === year) : monthlyData.slice(-12);
  const labels   = filtered.map(m => `${MONTH_SHORT[m.month-1]} ${m.year}`);

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Rainfall (mm)', data: filtered.map(m => roundTo(m.rainfallMm, 1)),
          backgroundColor: 'rgba(56,189,248,0.7)', borderColor: '#0ea5e9',
          borderWidth: 1, yAxisID: 'y' },
        { label: 'Total Harvest (KL)', data: filtered.map(m => roundTo(m.totalHarvestKL, 1)),
          type: 'line', borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)',
          borderWidth: 2, pointRadius: 3, yAxisID: 'y1', fill: false },
        { label: 'Total Demand (KL)', data: filtered.map(m => roundTo(m.totalDemandKL, 1)),
          type: 'line', borderColor: '#f59e0b', backgroundColor: 'transparent',
          borderWidth: 2, borderDash: [5,3], pointRadius: 3, yAxisID: 'y1', fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter' } } },
                 tooltip: { mode: 'index', intersect: false } },
      scales: {
        y:  { type: 'linear', position: 'left',  title: { display: true, text: 'Rainfall (mm)' }, grid: { color: '#f1f5f9' } },
        y1: { type: 'linear', position: 'right', title: { display: true, text: 'Volume (KL)' },
               grid: { drawOnChartArea: false } },
        x:  { grid: { display: false } }
      }
    }
  });
}

// ── Cumulative Balance (area chart) ───────────────────────────────────────
function renderCumulativeBalanceChart(canvasId, dailyResults, sampleEvery = 7) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const sampled = dailyResults.filter((_, i) => i % sampleEvery === 0);
  const labels  = sampled.map(d => formatDateKey(d.date));
  const data    = sampled.map(d => roundTo(d.cumulativeBalance, 1));

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cumulative Water Balance (KL)',
        data,
        borderColor: '#6366f1',
        backgroundColor: (ctx) => {
          const grad = ctx.chart.ctx.createLinearGradient(0, 0, 0, 300);
          grad.addColorStop(0,   'rgba(99,102,241,0.4)');
          grad.addColorStop(0.5, 'rgba(99,102,241,0.1)');
          grad.addColorStop(1,   'rgba(99,102,241,0.0)');
          return grad;
        },
        borderWidth: 2, pointRadius: 0, fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' },
                 tooltip: { mode: 'nearest', intersect: false,
                   callbacks: { label: ctx => `Balance: ${ctx.parsed.y.toLocaleString()} KL` } } },
      scales: {
        x: { ticks: { maxTicksLimit: 12, maxRotation: 0 }, grid: { display: false } },
        y: { title: { display: true, text: 'KL' },
             grid: { color: '#f1f5f9' },
             ticks: { callback: v => v.toLocaleString() } }
      }
    }
  });
}

// ── Annual Rainfall Bar Chart ──────────────────────────────────────────────
function renderAnnualRainfallChart(canvasId, annualData) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: annualData.map(a => a.year),
      datasets: [
        { label: 'Annual Rainfall (mm)', data: annualData.map(a => roundTo(a.rainfallMm, 0)),
          backgroundColor: annualData.map(a => a.rainfallMm < 600 ? 'rgba(239,68,68,0.7)' : 'rgba(56,189,248,0.7)'),
          borderWidth: 1 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false },
                 tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} mm` } } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: 'Rainfall (mm)' }, grid: { color: '#f1f5f9' },
             ticks: { callback: v => `${v} mm` } }
      }
    }
  });
}

// ── 5-Year Forecast Chart ─────────────────────────────────────────────────
function render5YearForecastChart(canvasId, forecastResults) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = forecastResults.map(r => `${r.year} (${Math.round(r.occupancy*100)}%)`);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Annual Demand (KL)', data: forecastResults.map(r => roundTo(r.annualDemandKL, 0)),
          backgroundColor: 'rgba(249,115,22,0.7)', borderColor: '#f97316', borderWidth: 1 },
        { label: 'Annual Harvest (KL)', data: forecastResults.map(r => roundTo(r.annualHarvestKL, 0)),
          backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 1 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: 'KL / year' }, grid: { color: '#f1f5f9' },
             ticks: { callback: v => v.toLocaleString() } }
      }
    }
  });
}

// ── Catchment Breakdown Donut ─────────────────────────────────────────────
function renderCatchmentDonut(canvasId, params) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !params.catchments) return;

  const dp     = computeDerivedParams(params);
  const labels = dp.catchments.map(c => c.name);
  const data   = dp.catchments.map(c => roundTo(c.area, 0));
  const colors = ['#3b82f6','#10b981','#f59e0b','#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6'];

  chartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toLocaleString()} sqm` } }
      }
    }
  });
}

// ── Worst-Year Monthly Chart ──────────────────────────────────────────────
function renderWorstYearChart(canvasId, worstYearMonthly, worstYear) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const labels = worstYearMonthly.map(m => MONTH_SHORT[m.month-1]);
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Rainfall (mm)', data: worstYearMonthly.map(m => roundTo(m.rainfallMm,1)),
          backgroundColor: 'rgba(56,189,248,0.6)', yAxisID: 'y' },
        { label: 'Harvest (KL)', data: worstYearMonthly.map(m => roundTo(m.totalHarvestKL,1)),
          type: 'line', borderColor: '#10b981', pointRadius: 4, borderWidth: 2,
          yAxisID: 'y1', fill: false },
        { label: 'Demand (KL)', data: worstYearMonthly.map(m => roundTo(m.totalDemandKL,1)),
          type: 'line', borderColor: '#ef4444', pointRadius: 4, borderWidth: 2,
          borderDash: [4,3], yAxisID: 'y1', fill: false },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' },
                 title: { display: true, text: `Worst Year: ${worstYear}` } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Rainfall (mm)' } },
        y1: { position: 'right', title: { display: true, text: 'Volume (KL)' }, grid: { drawOnChartArea: false } },
        x:  { grid: { display: false } }
      }
    }
  });
}

// ── Rainfall Heatmap (calendar rows per year) ─────────────────────────────
function renderRainfallHeatmap(containerId, rainfallData, year) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const maxRain = Math.max(1, ...Object.values(rainfallData).filter(v => v > 0));
  const months  = Array.from({ length: 12 }, (_, mi) => {
    const days = getDaysInMonth(year, mi+1);
    return Array.from({ length: days }, (_, di) => {
      const key  = `${year}-${String(mi+1).padStart(2,'0')}-${String(di+1).padStart(2,'0')}`;
      const rain = rainfallData[key] || 0;
      return { day: di+1, rain, key };
    });
  });

  container.innerHTML = `
    <div class="heatmap-grid">
      ${months.map((days, mi) => `
        <div class="heatmap-month">
          <div class="heatmap-month-label">${MONTH_SHORT[mi]}</div>
          <div class="heatmap-days">
            ${days.map(d => {
              const intensity = d.rain > 0 ? Math.min(1, d.rain / maxRain) : 0;
              const bg = d.rain > 0
                ? `rgba(56,189,248,${0.15 + intensity * 0.85})`
                : '#f8fafc';
              return `<div class="heatmap-day" style="background:${bg}" title="${d.key}: ${d.rain} mm">${d.rain > 0 ? '' : ''}</div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>`;
}
