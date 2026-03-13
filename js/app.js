/**
 * Main Application Controller
 */

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  currentTab: 'projects',
  activeProject: null,
  rainfallViewYear: new Date().getFullYear() - 1,
  rainfallViewMonth: 1,
  simulationResult: null,
  forecastResult: null,
  isDirty: false,
};

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  const savedId = getActiveProjectId();
  if (savedId) {
    state.activeProject = getProject(savedId);
  }
  navigateTo('projects');
});

// ── Navigation ─────────────────────────────────────────────────────────────
function navigateTo(tab) {
  state.currentTab = tab;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  destroyAllCharts();

  switch (tab) {
    case 'projects':  renderProjectsPage(main); break;
    case 'reference': renderReferencePage(main); break;
    case 'inputs':    renderInputsPage(main);    break;
    case 'rainfall':  renderRainfallPage(main);  break;
    case 'analysis':  renderAnalysisPage(main);  break;
  }
}

function renderNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.tab));
  });
}

// ── PROJECTS PAGE ──────────────────────────────────────────────────────────
function renderProjectsPage(container) {
  const projects = getAllProjects();
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Water Management Projects</h1>
        <p class="page-subtitle">Manage projects across different locations</p>
      </div>
      <button class="btn btn-primary" onclick="showCreateProjectModal()">
        <span class="btn-icon">+</span> New Project
      </button>
    </div>

    ${projects.length === 0 ? `
      <div class="empty-state">
        <div class="empty-icon">💧</div>
        <h3>No projects yet</h3>
        <p>Create your first project to get started</p>
        <button class="btn btn-primary" onclick="showCreateProjectModal()">Create Project</button>
      </div>
    ` : `
      <div class="project-grid">
        ${projects.map(p => renderProjectCard(p)).join('')}
      </div>
    `}

    <div id="modal-backdrop" class="modal-backdrop hidden" onclick="closeModal()"></div>
    <div id="modal-container"></div>
  `;
}

function renderProjectCard(p) {
  const isActive = state.activeProject && state.activeProject.id === p.id;
  const rainfallCount = Object.keys(p.rainfallData || {}).length;
  const stats = getRainfallStats(p.rainfallData || {});
  const dp = computeDerivedParams(p.params);

  return `
    <div class="project-card ${isActive ? 'project-card-active' : ''}">
      <div class="project-card-header">
        <div>
          <h3 class="project-name">${p.name}</h3>
          <p class="project-location">📍 ${p.location || 'No location set'}</p>
        </div>
        ${isActive ? '<span class="badge badge-active">Active</span>' : ''}
      </div>
      <div class="project-meta-grid">
        <div class="meta-item"><span class="meta-label">Land</span><span class="meta-val">${p.params.landSize} Ac</span></div>
        <div class="meta-item"><span class="meta-label">Villas</span><span class="meta-val">${p.params.numVillas}</span></div>
        <div class="meta-item"><span class="meta-label">Population</span><span class="meta-val">${dp.totalPop}</span></div>
        <div class="meta-item"><span class="meta-label">Rainfall Days</span><span class="meta-val">${rainfallCount}</span></div>
      </div>
      <div class="project-card-footer">
        <button class="btn btn-sm btn-outline" onclick="selectProject('${p.id}')">
          ${isActive ? '✓ Selected' : 'Select'}
        </button>
        <button class="btn btn-sm btn-primary" onclick="selectAndGo('${p.id}', 'inputs')">Edit</button>
        <button class="btn btn-sm btn-primary" onclick="selectAndGo('${p.id}', 'rainfall')">Rainfall</button>
        <button class="btn btn-sm btn-success" onclick="selectAndGo('${p.id}', 'analysis')">Analysis</button>
        <button class="btn btn-sm btn-danger" onclick="confirmDelete('${p.id}', '${p.name}')">Delete</button>
      </div>
    </div>
  `;
}

function selectProject(id) {
  state.activeProject = getProject(id);
  setActiveProject(id);
  navigateTo('projects');
}

function selectAndGo(id, tab) {
  state.activeProject = getProject(id);
  setActiveProject(id);
  navigateTo(tab);
}

function showCreateProjectModal() {
  document.getElementById('modal-backdrop').classList.remove('hidden');
  document.getElementById('modal-container').innerHTML = `
    <div class="modal">
      <div class="modal-header"><h2>New Project</h2><button onclick="closeModal()" class="modal-close">×</button></div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">Project Name *</label>
          <input id="new-proj-name" class="form-input" placeholder="e.g. Sunrise Villas – Coorg" />
        </div>
        <div class="form-group">
          <label class="form-label">Location</label>
          <input id="new-proj-loc" class="form-input" placeholder="e.g. Coorg, Karnataka" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="createProject()">Create Project</button>
      </div>
    </div>
  `;
}

function createProject() {
  const name = document.getElementById('new-proj-name').value.trim();
  const loc  = document.getElementById('new-proj-loc').value.trim();
  if (!name) { alert('Please enter a project name'); return; }
  const p = createNewProject(name, loc);
  state.activeProject = p;
  setActiveProject(p.id);
  closeModal();
  navigateTo('inputs');
}

function confirmDelete(id, name) {
  if (confirm(`Delete project "${name}"? This cannot be undone.`)) {
    deleteProject(id);
    if (state.activeProject && state.activeProject.id === id) {
      state.activeProject = null;
    }
    navigateTo('projects');
  }
}

function closeModal() {
  document.getElementById('modal-backdrop')?.classList.add('hidden');
  const mc = document.getElementById('modal-container');
  if (mc) mc.innerHTML = '';
}

// ── REFERENCE PAGE ─────────────────────────────────────────────────────────
function renderReferencePage(container) {
  const ref = REFERENCE_PROJECT.params;
  const dp  = computeDerivedParams(ref);
  const dailyDomL = dp.totalPop * (ref.lpcd / ref.occupantsPerVilla);

  container.innerHTML = `
    <div class="page-header">
      <div><h1 class="page-title">Reference Project</h1>
           <p class="page-subtitle">Read-only baseline from Excel template</p></div>
    </div>

    <div class="ref-grid">
      <!-- Site Parameters -->
      <div class="card">
        <div class="card-title">Site Parameters</div>
        ${refRow('Land Size', ref.landSize, 'Acres')}
        ${refRow('Number of Villas', ref.numVillas, 'nos.')}
        ${refRow('BUA per Villa', ref.bua, 'sq ft')}
        ${refRow('Bedrooms', ref.bedrooms, 'BHK')}
        ${refRow('Occupants per Villa', ref.occupantsPerVilla, 'persons')}
        ${refRow('Total Population', dp.totalPop, 'persons')}
      </div>

      <!-- Water Demand -->
      <div class="card">
        <div class="card-title">Domestic Water Demand</div>
        ${refRow('LPCD (per person)', ref.lpcd / ref.occupantsPerVilla, 'lpcd')}
        <div class="ref-section-label">Breakdown per person (lpcd):</div>
        ${Object.entries(ref.waterBreakdown).map(([k,v]) => refRow(capitalize(k), v, 'lpcd')).join('')}
        ${refRow('Total per household', ref.lpcd, 'L/day (4 persons)')}
        ${refRow('Daily Domestic (all villas)', (dailyDomL/1000).toFixed(1), 'KL/day')}
        ${refRow('Monthly Domestic', ((dailyDomL/1000)*30).toFixed(0), 'KL/month')}
      </div>

      <!-- Farm & Irrigation -->
      <div class="card">
        <div class="card-title">Farm & Irrigation</div>
        ${refRow('Farm Area', ref.farmArea.toFixed(0), 'sq mtr')}
        ${refRow('Forest Area', ref.forestArea, 'sq mtr')}
        ${refRow('Road Area', ref.roadArea.toFixed(0), 'sq mtr')}
        ${refRow('Total Drip Lines', ref.totalDripLines, 'nos.')}
        ${refRow('Drip Flow Rate', ref.dripFlowRate, 'LPH per line')}
        ${refRow('Total Drip Flow', ref.totalDripLines * ref.dripFlowRate, 'L/hr')}
        ${refRow('Daily Drip Water (30 min)', ((ref.totalDripLines * ref.dripFlowRate * 0.5) * ref.dripEfficiency / 1000).toFixed(1), 'KL/day')}
      </div>

      <!-- Catchment Areas -->
      <div class="card">
        <div class="card-title">Rainfall Harvesting – Catchment Areas</div>
        <table class="ref-table">
          <thead><tr><th>Location</th><th>Area (sqm)</th><th>Coeff.</th><th>Type</th></tr></thead>
          <tbody>
            ${ref.catchments.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.area.toLocaleString()}</td>
                <td>${c.coeff}</td>
                <td><span class="type-badge type-${c.type}">${c.type}</span></td>
              </tr>`).join('')}
            <tr class="total-row">
              <td><strong>TOTAL</strong></td>
              <td><strong>${dp.totalCatchmentArea.toLocaleString()}</strong></td><td></td><td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Run-off Coefficients -->
      <div class="card">
        <div class="card-title">Run-off Coefficients Guide</div>
        <table class="ref-table">
          <thead><tr><th>Surface Type</th><th>Coefficient</th><th>Example</th></tr></thead>
          <tbody>
            <tr><td>Hard Surface</td><td>0.85</td><td>Roofs, roads, paved</td></tr>
            <tr><td>Semi-Hardscape</td><td>0.60</td><td>Parking, compacted</td></tr>
            <tr><td>Semi-Softscape</td><td>0.40</td><td>Gravel, mixed</td></tr>
            <tr><td>Softscape</td><td>0.34</td><td>Lawn, gardens, farm</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Demand Formula -->
      <div class="card">
        <div class="card-title">Key Calculation Formulas</div>
        <div class="formula-block">
          <p class="formula-title">Daily Domestic Demand</p>
          <code>= Population × (LPCD ÷ 1000) × Diversity%</code>
          <p class="formula-example">e.g. 728 × (50÷1000) × 0.30 = 10.9 KL/day</p>
        </div>
        <div class="formula-block">
          <p class="formula-title">Daily Harvestable Water (per catchment)</p>
          <code>= (Rainfall_mm ÷ 1000) × Run-off Coeff × Area_sqm</code>
          <p class="formula-example">e.g. (10÷1000) × 0.85 × 6198 = 52.7 KL</p>
        </div>
        <div class="formula-block">
          <p class="formula-title">Cumulative Balance</p>
          <code>= Σ (Daily Harvest − Daily Demand)</code>
          <p class="formula-example">Min. value = Storage required</p>
        </div>
      </div>
    </div>
  `;

  // Catchment donut
  setTimeout(() => renderCatchmentDonut('ref-catchment-donut', ref), 50);
}

function refRow(label, val, unit) {
  return `<div class="ref-row"><span class="ref-label">${label}</span><span class="ref-val">${typeof val === 'number' ? val.toLocaleString() : val} <small>${unit}</small></span></div>`;
}

// ── INPUTS PAGE ────────────────────────────────────────────────────────────
function requireProject(container) {
  if (!state.activeProject) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>No project selected</h3>
        <p>Select or create a project first</p>
        <button class="btn btn-primary" onclick="navigateTo('projects')">Go to Projects</button>
      </div>`;
    return false;
  }
  return true;
}

function renderInputsPage(container) {
  if (!requireProject(container)) return;
  const p = state.activeProject;
  const params = p.params;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Project Inputs – ${p.name}</h1>
        <p class="page-subtitle">${p.location || ''}</p>
      </div>
      <button class="btn btn-primary" onclick="saveInputs()">💾 Save Changes</button>
    </div>

    <div class="inputs-grid">
      <!-- Section 1: Site Parameters -->
      <div class="card">
        <div class="card-title">1. Site Parameters</div>
        ${inputRow('landSize',         'Land Size',           params.landSize,           'Acres',   'number')}
        ${inputRow('numVillas',        'Number of Villas',    params.numVillas,          'nos.',    'number')}
        ${inputRow('bua',              'BUA per Villa',       params.bua,                'sq ft',   'number')}
        ${inputRow('bedrooms',         'Bedrooms',            params.bedrooms,           'BHK',     'number')}
        ${inputRow('occupantsPerVilla','Occupants per Villa', params.occupantsPerVilla,  'persons', 'number')}
      </div>

      <!-- Section 2: Water Demand -->
      <div class="card">
        <div class="card-title">2. Water Demand</div>
        ${inputRow('lpcdPerPerson',    'LPCD per Person',         params.lpcdPerPerson || 50,   'L/person/day',  'number')}
        ${inputRow('farmingMonthlyKL', 'Farming Demand',          params.farmingMonthlyKL,      'KL/month',      'number')}
        ${inputRow('landscapingMonthlyKL','Landscaping Demand',   params.landscapingMonthlyKL,  'KL/month',      'number')}
        ${inputRow('swimmingPoolMonthlyKL','Swimming Pool',       params.swimmingPoolMonthlyKL, 'KL/month',      'number')}
        ${inputRow('amenitiesMonthlyKL',  'Amenities',           params.amenitiesMonthlyKL,     'KL/month',      'number')}
        ${inputRow('goshalaMontlyKL', 'Goshala (Cattle)',         params.goshalaMontlyKL || 0,  'KL/month',      'number')}
      </div>

      <!-- Section 3: Irrigation -->
      <div class="card">
        <div class="card-title">3. Irrigation System</div>
        ${inputRow('farmArea',         'Farm Area',           params.farmArea,           'sq mtr',  'number')}
        ${inputRow('forestArea',       'Forest Area',         params.forestArea,         'sq mtr',  'number')}
        ${inputRow('roadArea',         'Road Area',           params.roadArea,           'sq mtr',  'number')}
        ${inputRow('totalDripLines',   'Total Drip Lines',    params.totalDripLines,     'nos.',    'number')}
        ${inputRow('dripFlowRate',     'Drip Flow Rate',      params.dripFlowRate,       'LPH',     'number')}
        ${inputRow('dripDurationMin',  'Drip Duration',       params.dripDurationMin,    'min/day', 'number')}
        ${inputRow('dripEfficiency',   'Drip Efficiency',     params.dripEfficiency,     '(0–1)',   'number', 0, 1, 0.01)}
        ${inputRow('sprinklerFlowRate','Sprinkler Flow Rate', params.sprinklerFlowRate,  'LPH',     'number')}
        ${inputRow('sprinklerEfficiency','Sprinkler Effic.',  params.sprinklerEfficiency,'(0–1)',   'number', 0, 1, 0.01)}
      </div>

      <!-- Section 4: Catchment Areas -->
      <div class="card card-full">
        <div class="card-title">4. Rainfall Harvesting – Catchment Areas</div>
        <table class="input-table" id="catchment-table">
          <thead>
            <tr>
              <th>Location</th>
              <th>Area (sq mtr)</th>
              <th>Run-off Coefficient</th>
              <th>Surface Type</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="catchment-tbody">
            ${params.catchments.map((c, i) => renderCatchmentRow(c, i)).join('')}
          </tbody>
        </table>
        <button class="btn btn-sm btn-outline mt-2" onclick="addCatchmentRow()">+ Add Row</button>
      </div>

      <!-- Section 5: Occupancy Ramp -->
      <div class="card">
        <div class="card-title">5. Occupancy Ramp (5-Year Forecast)</div>
        ${[0,1,2,3,4].map(i => inputRow(`occupancy_${i}`, `Year ${i+1} (${2027+i})`,
            Math.round((params.occupancyRamp[i]||0)*100), '%', 'number', 0, 100)).join('')}
      </div>

      <!-- Section 6: Simulation Years -->
      <div class="card">
        <div class="card-title">6. Historical Simulation Period</div>
        ${inputRow('simStartYear', 'Start Year', p.simulationYears?.start || 2005, '', 'number', 1990, 2024)}
        ${inputRow('simEndYear',   'End Year',   p.simulationYears?.end   || 2024, '', 'number', 1991, 2024)}
      </div>

      <!-- Section 7: Diversity Schedule -->
      <div class="card card-full">
        <div class="card-title">7. Seasonal Diversity Schedule (%)</div>
        <p class="section-note">Percentage of maximum occupancy present on weekdays vs weekends each month</p>
        <table class="input-table">
          <thead><tr><th>Month</th><th>Weekday (%)</th><th>Weekend (%)</th></tr></thead>
          <tbody>
            ${(p.diversitySchedule?.months || []).map((m, i) => `
              <tr>
                <td>${m.month}</td>
                <td><input class="table-input" type="number" min="0" max="100"
                     id="div_weekday_${i}" value="${m.weekday}" /></td>
                <td><input class="table-input" type="number" min="0" max="100"
                     id="div_weekend_${i}" value="${m.weekend}" /></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCatchmentRow(c, i) {
  return `
    <tr id="catch-row-${i}">
      <td><input class="table-input" id="catch_name_${i}" value="${c.name}" /></td>
      <td><input class="table-input" type="number" id="catch_area_${i}" value="${c.area}" min="0" /></td>
      <td>
        <select class="table-input" id="catch_coeff_${i}" onchange="updateCoeffFromType(${i})">
          <option value="0.85" ${c.coeff===0.85?'selected':''}>0.85 – Hard surface</option>
          <option value="0.60" ${c.coeff===0.60?'selected':''}>0.60 – Semi-hard</option>
          <option value="0.40" ${c.coeff===0.40?'selected':''}>0.40 – Semi-soft</option>
          <option value="0.34" ${c.coeff===0.34?'selected':''}>0.34 – Softscape</option>
          <option value="custom">Custom…</option>
        </select>
        <input class="table-input" type="number" id="catch_coeff_custom_${i}"
               style="display:${[0.85,0.60,0.40,0.34].includes(c.coeff)?'none':'inline-block'};width:70px"
               value="${c.coeff}" step="0.01" min="0" max="1" />
      </td>
      <td><span class="type-badge type-${c.type}">${c.type}</span></td>
      <td><button class="btn btn-xs btn-danger" onclick="removeCatchmentRow(${i})">✕</button></td>
    </tr>`;
}

function addCatchmentRow() {
  const p  = state.activeProject.params;
  const i  = p.catchments.length;
  p.catchments.push({ id: `area_${i}`, name: 'New Area', area: 0, coeff: 0.85, type: 'hard' });
  const tbody = document.getElementById('catchment-tbody');
  if (tbody) {
    const row = document.createElement('tr');
    row.id    = `catch-row-${i}`;
    row.innerHTML = renderCatchmentRow(p.catchments[i], i).replace(/^<tr[^>]*>/, '').replace(/<\/tr>$/, '');
    tbody.appendChild(row);
  }
}

function removeCatchmentRow(i) {
  document.getElementById(`catch-row-${i}`)?.remove();
}

function saveInputs() {
  const p = state.activeProject;
  if (!p) return;

  const numVal = id => parseFloat(document.getElementById(id)?.value || 0) || 0;

  // Basic params
  const fields = ['landSize','numVillas','bua','bedrooms','occupantsPerVilla',
                  'lpcdPerPerson','farmingMonthlyKL','landscapingMonthlyKL',
                  'swimmingPoolMonthlyKL','amenitiesMonthlyKL','goshalaMontlyKL',
                  'farmArea','forestArea','roadArea','totalDripLines','dripFlowRate',
                  'dripDurationMin','dripEfficiency','sprinklerFlowRate','sprinklerEfficiency'];
  fields.forEach(f => { p.params[f] = numVal(f); });

  // Occupancy ramp
  p.params.occupancyRamp = [0,1,2,3,4].map(i => numVal(`occupancy_${i}`) / 100);

  // Simulation years
  p.simulationYears = {
    start: parseInt(document.getElementById('simStartYear')?.value) || 2005,
    end:   parseInt(document.getElementById('simEndYear')?.value)   || 2024,
  };

  // Catchments
  const newCatchments = [];
  let i = 0;
  while (document.getElementById(`catch_name_${i}`) || document.getElementById(`catch-row-${i}`)) {
    const nameEl  = document.getElementById(`catch_name_${i}`);
    const areaEl  = document.getElementById(`catch_area_${i}`);
    const coeffEl = document.getElementById(`catch_coeff_${i}`);
    if (nameEl && areaEl && coeffEl) {
      let coeff = parseFloat(coeffEl.value);
      if (isNaN(coeff)) coeff = parseFloat(document.getElementById(`catch_coeff_custom_${i}`)?.value || 0.85);
      newCatchments.push({
        id:    `area_${i}`,
        name:  nameEl.value,
        area:  parseFloat(areaEl.value) || 0,
        coeff: coeff,
        type:  coeff >= 0.80 ? 'hard' : coeff >= 0.55 ? 'semihard' : coeff >= 0.35 ? 'semisoft' : 'soft',
      });
    }
    i++;
  }
  if (newCatchments.length > 0) p.params.catchments = newCatchments;

  // Diversity schedule
  if (p.diversitySchedule?.months) {
    p.diversitySchedule.months = p.diversitySchedule.months.map((m, idx) => ({
      ...m,
      weekday: numVal(`div_weekday_${idx}`),
      weekend: numVal(`div_weekend_${idx}`),
    }));
  }

  p.updatedAt = new Date().toISOString();
  saveProject(p);
  state.activeProject = p;

  showToast('Project saved successfully!', 'success');
}

function inputRow(id, label, value, unit, type, min, max, step) {
  const attrs = [
    type  ? `type="${type}"`   : '',
    min != null ? `min="${min}"` : (type==='number' ? 'min="0"' : ''),
    max != null ? `max="${max}"` : '',
    step  ? `step="${step}"`   : (type==='number' ? 'step="any"' : ''),
  ].filter(Boolean).join(' ');

  return `
    <div class="input-row">
      <label class="input-label">${label}</label>
      <div class="input-with-unit">
        <input id="${id}" class="form-input" ${attrs} value="${value}" />
        ${unit ? `<span class="input-unit">${unit}</span>` : ''}
      </div>
    </div>`;
}

// ── RAINFALL PAGE ──────────────────────────────────────────────────────────
function renderRainfallPage(container) {
  if (!requireProject(container)) return;
  const p = state.activeProject;
  const year  = state.rainfallViewYear;
  const month = state.rainfallViewMonth;

  const yearRange = { start: p.simulationYears?.start || 2005,
                      end:   p.simulationYears?.end   || 2024 };
  const annualStats = computeAnnualStats(p.rainfallData, year);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Rainfall Data – ${p.name}</h1>
        <p class="page-subtitle">Enter daily rainfall (mm) for historical analysis</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" onclick="seedSampleData()" title="Populate 20-year demo data">🌱 Load Sample Data</button>
        <label class="btn btn-outline" title="Import Excel (.xlsx) or CSV (.csv)">
          📥 Import Excel / CSV
          <input type="file" accept=".xlsx,.csv" style="display:none" onchange="importFile(event)" />
        </label>
        <button class="btn btn-outline" onclick="exportCSV()">📤 Export CSV</button>
      </div>
    </div>

    <!-- Year selector & stats -->
    <div class="rainfall-toolbar">
      <div class="year-nav">
        <button class="btn btn-sm btn-outline" onclick="prevYear()">◀ Prev</button>
        <select class="form-select year-select" onchange="changeYear(this.value)">
          ${Array.from({length: yearRange.end - yearRange.start + 1}, (_,i) => {
            const y = yearRange.start + i;
            return `<option value="${y}" ${y===year?'selected':''}>${y}</option>`;
          }).join('')}
        </select>
        <button class="btn btn-sm btn-outline" onclick="nextYear()">Next ▶</button>
      </div>
      <div class="annual-stats">
        <span class="stat-chip stat-blue">Total: <strong>${annualStats.total.toFixed(0)} mm</strong></span>
        <span class="stat-chip stat-green">Rainy Days: <strong>${annualStats.rainyDays}</strong></span>
        <span class="stat-chip stat-amber">Max Day: <strong>${annualStats.max.toFixed(1)} mm</strong></span>
        <span class="stat-chip stat-grey">Entered: <strong>${annualStats.entered} / 365</strong></span>
      </div>
    </div>

    <!-- Month tabs -->
    <div class="month-tabs">
      ${MONTH_SHORT.map((m, i) => {
        const mStats = computeMonthStats(p.rainfallData, year, i+1);
        return `<button class="month-tab ${i+1===month?'month-tab-active':''}"
                  onclick="changeMonth(${i+1})">
          <span>${m}</span>
          <small>${mStats.total.toFixed(0)}mm</small>
        </button>`;
      }).join('')}
    </div>

    <!-- Daily entry grid -->
    <div class="card">
      <div class="card-title">${MONTH_NAMES[month-1]} ${year} – Daily Rainfall (mm)</div>
      <div id="daily-grid">${renderDailyGrid(p.rainfallData, year, month)}</div>
    </div>

    <!-- Annual heatmap -->
    <div class="card">
      <div class="card-title">Annual Rainfall Heatmap – ${year}</div>
      <div id="heatmap-container" class="heatmap-container"></div>
    </div>

    <!-- Annual chart -->
    <div class="card">
      <div class="card-title">Monthly Rainfall Distribution – ${year}</div>
      <div style="height:220px"><canvas id="monthly-rainfall-bar"></canvas></div>
    </div>
  `;

  renderRainfallHeatmap('heatmap-container', p.rainfallData, year);

  // Monthly bar for current year
  const months12 = Array.from({length:12}, (_,i) => ({
    year, month: i+1,
    rainfallMm: computeMonthStats(p.rainfallData, year, i+1).total
  }));
  setTimeout(() => {
    const ctx = document.getElementById('monthly-rainfall-bar');
    if (ctx) {
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: MONTH_SHORT,
          datasets: [{ label: 'Rainfall (mm)', data: months12.map(m => m.rainfallMm),
            backgroundColor: 'rgba(56,189,248,0.7)', borderColor: '#0ea5e9', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' } } } }
      });
    }
  }, 50);
}

function renderDailyGrid(rainfallData, year, month) {
  const days = getDaysInMonth(year, month);
  const rows = [];
  for (let i = 0; i < days; i += 7) {
    const batch = Array.from({length: Math.min(7, days - i)}, (_, j) => {
      const d   = i + j + 1;
      const key = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const val = rainfallData[key] !== undefined ? rainfallData[key] : '';
      const dt  = new Date(year, month-1, d);
      const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
      const isWE= dt.getDay() === 0 || dt.getDay() === 6;
      return `
        <div class="day-cell ${isWE ? 'day-weekend' : ''}">
          <div class="day-header">
            <span class="day-num">${d}</span>
            <span class="day-dow">${dow}</span>
          </div>
          <input class="day-input ${val > 0 ? 'day-has-rain' : ''}"
                 type="number" min="0" max="2000" step="0.1"
                 value="${val}"
                 id="rain_${key}"
                 onchange="updateRainfall('${key}', this.value)"
                 onblur="updateRainfall('${key}', this.value)"
                 placeholder="0" />
          <div class="day-unit">mm</div>
        </div>`;
    });
    rows.push(`<div class="day-row">${batch.join('')}</div>`);
  }
  return rows.join('');
}

function updateRainfall(key, value) {
  const p = state.activeProject;
  if (!p) return;
  updateProjectRainfall(p.id, key, value === '' ? null : parseFloat(value));
  state.activeProject = getProject(p.id);
  // Update cell highlight
  const input = document.getElementById(`rain_${key}`);
  if (input) input.classList.toggle('day-has-rain', parseFloat(value) > 0);
  // Refresh month stats chips
  refreshMonthStats();
}

function refreshMonthStats() {
  const p = state.activeProject;
  const y = state.rainfallViewYear;
  const m = state.rainfallViewMonth;
  const stats = computeMonthStats(p.rainfallData, y, m);
  document.querySelectorAll('.month-tab').forEach((btn, i) => {
    const s = computeMonthStats(p.rainfallData, y, i+1);
    const small = btn.querySelector('small');
    if (small) small.textContent = `${s.total.toFixed(0)}mm`;
  });
}

// ── Unified file importer: handles both .xlsx and .csv ────────
function importFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();

  if (ext === 'xlsx' || ext === 'xls') {
    importExcelFile(file);
  } else {
    importCSVFile(file);
  }
}

function importCSVFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const result = importRainfallCSV(state.activeProject.id, e.target.result);
    state.activeProject = getProject(state.activeProject.id);
    showToast(`✅ Imported ${result.count.toLocaleString()} records from CSV.${result.errors.length ? ' ' + result.errors[0] : ''}`, 'success');
    navigateTo('rainfall');
  };
  reader.readAsText(file);
}

function importExcelFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb    = XLSX.read(e.target.result, { type: 'array', cellDates: false });

      // Look for 'Rainfall_Data' sheet first, otherwise use first sheet
      const sheetName = wb.SheetNames.includes('Rainfall_Data')
                        ? 'Rainfall_Data'
                        : wb.SheetNames[0];
      const ws    = wb.Sheets[sheetName];
      const rows  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      // Build rain data: scan every row for (date-string, number) pair
      const rainData = {};
      let count = 0;
      const errors = [];

      for (const row of rows) {
        if (!row || row.length < 2) continue;

        // Find the date cell and rainfall cell
        // Template layout: col 0=Date(YYYY-MM-DD), col 3=Rainfall
        // Also handle CSV-style: col 0=Date, col 1=Rainfall
        let dateVal = null, rainVal = null;

        // Try template layout (col A = date string, col D = rainfall)
        const colA = row[0];
        const colD = row[3];   // column D (index 3) in the template

        // Also try simple 2-col layout (col A = date, col B = rainfall)
        const colB = row[1];

        // Determine date
        if (typeof colA === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(colA.trim())) {
          dateVal = colA.trim();
        } else if (colA instanceof Date) {
          const d = colA;
          dateVal = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        } else {
          // Try to detect Excel serial date number
          if (typeof colA === 'number' && colA > 35000 && colA < 50000) {
            const jsDate = new Date(Math.round((colA - 25569) * 86400 * 1000));
            dateVal = `${jsDate.getUTCFullYear()}-${String(jsDate.getUTCMonth()+1).padStart(2,'0')}-${String(jsDate.getUTCDate()).padStart(2,'0')}`;
          }
        }
        if (!dateVal) continue;

        // Determine rainfall: prefer col D (template), fall back to col B (simple CSV)
        if (colD !== null && colD !== undefined && !isNaN(Number(colD))) {
          rainVal = Number(colD);
        } else if (colB !== null && colB !== undefined && !isNaN(Number(colB))) {
          rainVal = Number(colB);
        }
        if (rainVal === null || isNaN(rainVal)) continue;

        if (rainVal < 0 || rainVal > 2000) {
          errors.push(`Skipped ${dateVal}: value ${rainVal} out of range`);
          continue;
        }

        rainData[dateVal] = rainVal;
        count++;
      }

      if (count === 0) {
        showToast('⚠️ No valid data found. Check that Column A has dates (YYYY-MM-DD) and Column D has rainfall values.', 'error');
        return;
      }

      // Merge into project
      const p = state.activeProject;
      Object.assign(p.rainfallData, rainData);
      p.updatedAt = new Date().toISOString();
      saveProject(p);
      state.activeProject = getProject(p.id);

      const errMsg = errors.length ? ` (${errors.length} rows skipped)` : '';
      showToast(`✅ Imported ${count.toLocaleString()} records from "${file.name}"${errMsg}`, 'success');
      navigateTo('rainfall');

    } catch (err) {
      showToast(`❌ Error reading Excel file: ${err.message}`, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function seedSampleData() {
  const p = state.activeProject;
  if (!p) return;
  if (!confirm('This will load 20 years of sample rainfall data (2005–2024). Existing data will be overwritten. Continue?')) return;
  const count = loadSampleData(p.id);
  state.activeProject = getProject(p.id);
  showToast(`Loaded ${count.toLocaleString()} daily records (2005–2024)`, 'success');
  navigateTo('rainfall');
}

function exportCSV() {
  const p    = state.activeProject;
  const csv  = exportCSVRainfall(p.rainfallData);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${p.name.replace(/\s+/g,'_')}_rainfall.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function prevYear() {
  const p   = state.activeProject;
  const min = p.simulationYears?.start || 2005;
  if (state.rainfallViewYear > min) {
    state.rainfallViewYear--;
    navigateTo('rainfall');
  }
}

function nextYear() {
  const p   = state.activeProject;
  const max = p.simulationYears?.end || 2024;
  if (state.rainfallViewYear < max) {
    state.rainfallViewYear++;
    navigateTo('rainfall');
  }
}

function changeYear(y) {
  state.rainfallViewYear = parseInt(y);
  navigateTo('rainfall');
}

function changeMonth(m) {
  state.rainfallViewMonth = m;
  const grid = document.getElementById('daily-grid');
  if (grid) {
    grid.innerHTML = renderDailyGrid(state.activeProject.rainfallData,
                                     state.rainfallViewYear, m);
  }
  document.querySelectorAll('.month-tab').forEach((btn,i) => {
    btn.classList.toggle('month-tab-active', i+1 === m);
  });
}

function computeAnnualStats(data, year) {
  const prefix = `${year}-`;
  const vals = Object.entries(data)
    .filter(([k]) => k.startsWith(prefix))
    .map(([,v]) => Number(v));
  return {
    total: vals.reduce((s,v) => s+v, 0),
    max: vals.length ? Math.max(...vals) : 0,
    rainyDays: vals.filter(v => v > 0).length,
    entered: vals.length,
  };
}

function computeMonthStats(data, year, month) {
  const prefix = `${year}-${String(month).padStart(2,'0')}-`;
  const vals = Object.entries(data)
    .filter(([k]) => k.startsWith(prefix))
    .map(([,v]) => Number(v));
  return { total: vals.reduce((s,v) => s+v, 0), count: vals.length };
}

// ── ANALYSIS PAGE ──────────────────────────────────────────────────────────
function renderAnalysisPage(container) {
  if (!requireProject(container)) return;
  const p = state.activeProject;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Analysis – ${p.name}</h1>
        <p class="page-subtitle">Running simulation…</p>
      </div>
      <button class="btn btn-primary" onclick="runAnalysis()">▶ Run Analysis</button>
    </div>
    <div id="analysis-body">
      <div class="analysis-placeholder">
        <div class="empty-icon">📊</div>
        <p>Click "Run Analysis" to compute results from your rainfall data</p>
      </div>
    </div>
  `;

  // Auto-run if data is available
  const dataCount = Object.keys(p.rainfallData || {}).length;
  if (dataCount > 0) setTimeout(runAnalysis, 100);
}

function runAnalysis() {
  const p = state.activeProject;
  if (!p) return;

  const dp  = computeDerivedParams(p.params);
  const sim = runSimulation(dp, p.rainfallData,
                            p.simulationYears?.start || 2005,
                            p.simulationYears?.end   || 2024,
                            p.diversitySchedule);

  const monthly = aggregateByMonth(sim.dailyResults);
  const annual  = aggregateByYear(sim.dailyResults);
  const worst   = findWorstYear(sim.dailyResults);
  const worstM  = worst ? getWorstYearMonthly(sim.dailyResults, worst.year) : [];

  const forecast = run5YearForecast(dp, p.rainfallData,
                                    p.params.forecastStartYear || 2027,
                                    p.params.occupancyRamp || [0.1,0.2,0.3,0.5,0.7],
                                    p.diversitySchedule);

  const totalDemandAnnual = monthly.reduce((s,m) => s+m.totalDemandKL, 0) / (annual.length || 1);
  const totalHarvestAnnual= monthly.reduce((s,m) => s+m.totalHarvestKL, 0) / (annual.length || 1);
  const avgMonthlyDemand  = totalDemandAnnual / 12;
  const avgMonthlyHarvest = totalHarvestAnnual / 12;

  const body = document.getElementById('analysis-body');
  body.innerHTML = `
    <!-- KPI Row -->
    <div class="kpi-row">
      ${kpiCard('Max Storage Required', sim.maxStorageRequired.toFixed(0), 'KL', 'kpi-red', 'Worst-case tank size (all time)')}
      ${kpiCard('Avg Annual Demand',    totalDemandAnnual.toFixed(0),       'KL/yr',  'kpi-amber', 'Total water needed per year')}
      ${kpiCard('Avg Annual Harvest',   totalHarvestAnnual.toFixed(0),      'KL/yr',  'kpi-green', 'Rainwater captured per year')}
      ${kpiCard('Self-Sufficiency',     totalHarvestAnnual > 0 ? Math.min(100,(totalHarvestAnnual/totalDemandAnnual*100)).toFixed(0) : 0, '%', 'kpi-blue', 'Harvest ÷ Demand')}
    </div>
    ${kpiCard2Row(dp, sim)}

    <!-- Charts row 1 -->
    <div class="charts-row">
      <div class="card chart-card">
        <div class="card-title">Cumulative Water Balance</div>
        <div class="chart-container"><canvas id="ch-cumBalance"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-title">Annual Rainfall</div>
        <div class="chart-container"><canvas id="ch-annualRain"></canvas></div>
      </div>
    </div>

    <!-- Charts row 2 -->
    <div class="charts-row">
      <div class="card chart-card chart-wide">
        <div class="card-title">Monthly Rainfall vs Demand vs Harvest (avg all years)</div>
        <div class="chart-container"><canvas id="ch-monthlyAvg"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-title">Catchment Areas</div>
        <div class="chart-container"><canvas id="ch-donut"></canvas></div>
      </div>
    </div>

    <!-- Worst year -->
    ${worst ? `
    <div class="charts-row">
      <div class="card chart-card chart-wide">
        <div class="card-title">Worst Year Analysis – ${worst.year} (${worst.rainfallMm.toFixed(0)} mm total)</div>
        <div class="chart-container"><canvas id="ch-worstYear"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-title">Worst Year Monthly Breakdown</div>
        ${renderWorstYearTable(worstM)}
      </div>
    </div>` : ''}

    <!-- 5-year forecast -->
    <div class="charts-row">
      <div class="card chart-card">
        <div class="card-title">5-Year Demand Forecast (Occupancy Ramp)</div>
        <div class="chart-container"><canvas id="ch-forecast"></canvas></div>
      </div>
      <div class="card chart-card">
        <div class="card-title">5-Year Summary Table</div>
        ${render5YearTable(forecast)}
      </div>
    </div>

    <!-- Monthly detail table -->
    <div class="card">
      <div class="card-title">Monthly Detail Table (All Years)</div>
      ${renderMonthlyTable(monthly)}
    </div>
  `;

  // Render charts
  setTimeout(() => {
    renderCumulativeBalanceChart('ch-cumBalance', sim.dailyResults, 7);
    renderAnnualRainfallChart('ch-annualRain', annual);

    // Monthly averages across all years
    const avgMonthly = computeAvgMonthly(monthly);
    renderMonthlyRainfallChart('ch-monthlyAvg', avgMonthly);

    renderCatchmentDonut('ch-donut', p.params);
    if (worst) renderWorstYearChart('ch-worstYear', worstM, worst.year);
    render5YearForecastChart('ch-forecast', forecast);
  }, 100);
}

function kpiCard(label, value, unit, cls, note) {
  return `
    <div class="kpi-card ${cls}">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${Number(value).toLocaleString()}<span class="kpi-unit">${unit}</span></div>
      <div class="kpi-note">${note}</div>
    </div>`;
}

function kpiCard2Row(dp, sim) {
  const monthlyDomestic = dp.totalPop * (dp.lpcdPerPerson || dp.lpcd/dp.occupantsPerVilla) / 1000 * 0.40 * 30;
  return `
    <div class="kpi-row">
      ${kpiCard('Total Population',     dp.totalPop.toLocaleString(), 'persons', 'kpi-indigo', 'At full occupancy')}
      ${kpiCard('Monthly Domestic',     monthlyDomestic.toFixed(0),  'KL/mo',   'kpi-teal',   'Avg domestic demand')}
      ${kpiCard('Monthly Farming',      dp.farmingMonthlyKL.toFixed(0), 'KL/mo', 'kpi-green',  'Drip + sprinkler')}
      ${kpiCard('Total Catchment Area', dp.totalCatchmentArea.toLocaleString(), 'sqm', 'kpi-blue', 'All harvesting surfaces')}
    </div>`;
}

function computeAvgMonthly(monthly) {
  const byMonth = {};
  for (const m of monthly) {
    if (!byMonth[m.month]) byMonth[m.month] = { year: 9999, month: m.month, rainfallMm: 0, totalHarvestKL: 0, totalDemandKL: 0, n: 0 };
    byMonth[m.month].rainfallMm     += m.rainfallMm;
    byMonth[m.month].totalHarvestKL += m.totalHarvestKL;
    byMonth[m.month].totalDemandKL  += m.totalDemandKL;
    byMonth[m.month].n++;
  }
  return Object.values(byMonth).sort((a,b) => a.month-b.month).map(m => ({
    ...m,
    rainfallMm:     m.rainfallMm     / m.n,
    totalHarvestKL: m.totalHarvestKL / m.n,
    totalDemandKL:  m.totalDemandKL  / m.n,
  }));
}

function renderWorstYearTable(worstM) {
  return `<table class="analysis-table">
    <thead><tr><th>Month</th><th>Rain (mm)</th><th>Harvest (KL)</th><th>Demand (KL)</th><th>Balance</th></tr></thead>
    <tbody>
      ${worstM.map(m => {
        const bal = m.totalHarvestKL - m.totalDemandKL;
        return `<tr>
          <td>${MONTH_SHORT[m.month-1]}</td>
          <td>${m.rainfallMm.toFixed(1)}</td>
          <td>${m.totalHarvestKL.toFixed(0)}</td>
          <td>${m.totalDemandKL.toFixed(0)}</td>
          <td class="${bal >= 0 ? 'positive' : 'negative'}">${bal.toFixed(0)}</td>
        </tr>`;}).join('')}
    </tbody>
  </table>`;
}

function render5YearTable(forecast) {
  return `<table class="analysis-table">
    <thead><tr><th>Year</th><th>Occ%</th><th>Pop</th><th>Ann.Demand</th><th>Ann.Harvest</th><th>Storage</th></tr></thead>
    <tbody>
      ${forecast.map(r => `<tr>
        <td>${r.year}</td>
        <td>${Math.round(r.occupancy*100)}%</td>
        <td>${r.population}</td>
        <td>${r.annualDemandKL.toFixed(0)} KL</td>
        <td>${r.annualHarvestKL.toFixed(0)} KL</td>
        <td>${r.maxStorageKL.toFixed(0)} KL</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function renderMonthlyTable(monthly) {
  const recent = monthly.slice(-36);
  return `<div style="overflow-x:auto;max-height:340px;overflow-y:auto">
    <table class="analysis-table">
      <thead style="position:sticky;top:0;background:#fff">
        <tr><th>Month</th><th>Rainfall (mm)</th><th>Harvest (KL)</th><th>Demand (KL)</th><th>Daily Avg Demand</th><th>Net (KL)</th></tr>
      </thead>
      <tbody>
        ${recent.map(m => {
          const net = m.totalHarvestKL - m.totalDemandKL;
          return `<tr>
            <td>${MONTH_SHORT[m.month-1]} ${m.year}</td>
            <td>${m.rainfallMm.toFixed(1)}</td>
            <td>${m.totalHarvestKL.toFixed(0)}</td>
            <td>${m.totalDemandKL.toFixed(0)}</td>
            <td>${(m.totalDemandKL / m.days).toFixed(1)}</td>
            <td class="${net >= 0 ? 'positive' : 'negative'}">${net.toFixed(0)}</td>
          </tr>`;}).join('')}
      </tbody>
    </table>
  </div>`;
}

// ── UTILITIES ──────────────────────────────────────────────────────────────
function capitalize(s) {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}

function showToast(msg, type = 'info') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
