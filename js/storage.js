/**
 * Project Storage Manager – uses localStorage
 * Default values from "Water net zero calculator - 2nd rough.xlsx"
 * New Project sheet (Saptapatha, 26.5 acres, 174 villas)
 */

const DB_KEY     = 'waterProjects';
const ACTIVE_KEY = 'activeProjectId';

function getAllProjects() {
  try { return JSON.parse(localStorage.getItem(DB_KEY) || '[]'); }
  catch { return []; }
}
function saveAllProjects(projects) { localStorage.setItem(DB_KEY, JSON.stringify(projects)); }
function getProject(id) { return getAllProjects().find(p => p.id === id) || null; }
function saveProject(project) {
  const projects = getAllProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) projects[idx] = project; else projects.push(project);
  saveAllProjects(projects);
}
function deleteProject(id) {
  saveAllProjects(getAllProjects().filter(p => p.id !== id));
  if (getActiveProjectId() === id) clearActiveProject();
}

function createNewProject(name, location) {
  const id = 'proj_' + Date.now();
  const project = {
    id, name, location,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    params: JSON.parse(JSON.stringify({
      // Site (New Project B1-B5)
      landSize: 26.5, numVillas: 174, bua: 3173, bedrooms: 2, occupantsPerVilla: 3,
      // Domestic demand (Sheet 3 B1=170 LPCD, B2=522)
      lpcdPerPerson: 170,
      // Irrigation areas (New Project B6, B10, B17)
      farmDripArea:       20234,  // sq m – 2-line drip farm area
      farmSprinklerArea:  2000,   // sq m – sprinkler farm area
      villaIrrigArea:     20000,  // sq m – villa irrigation area
      // Antharam calibration ratios (from Reference project- Antharam sheet)
      drippersPerSqm:        2.3917,   // ratio B11
      farmSprinklersPerSqm:  0.12311,  // ratio B16
      villaSprinklersPerSqm: 0.017985, // ratio B22
      // Irrigation constants (fixed)
      dripFlowRate:        4,     // LPH per dripper
      dripDurationMin:     30,    // 30-min session
      dripEfficiency:      0.90,
      sprinklerSessionLPU: 55,    // L per sprinkler per 30-min session
      sprinklerEfficiency: 0.70,
      // Non-irrigation demand (New Project B25, B26)
      goshalaMontlyKL:       20000,  // KL/month
      swimmingPoolMonthlyKL: 526,    // KL/month
      amenitiesMonthlyKL:    0,
      landscapingMonthlyKL:  0,
      farmingMonthlyKL:      0,      // computed
      // Catchment areas + runoff coefficients (Sheet 3 F16-M16 + areas)
      catchments: [
        { id: 'villaRoof',       name: 'Villa Roof Tops',   area: 6198.4, coeff: 0.85, type: 'hard' },
        { id: 'villaGarden',     name: 'Villa Garden',      area: 11637,  coeff: 0.34, type: 'soft' },
        { id: 'farm',            name: 'Farm',              area: 20234,  coeff: 0.34, type: 'soft' },
        { id: 'forest',          name: 'Forest',            area: 8093,   coeff: 0.34, type: 'soft' },
        { id: 'tribeClub',       name: 'Tribe Club',        area: 1858,   coeff: 0.85, type: 'hard' },
        { id: 'clusterWalkways', name: 'Cluster Walkways',  area: 1296,   coeff: 0.34, type: 'semisoft' },
        { id: 'roads',           name: 'Roads',             area: 3695,   coeff: 0.85, type: 'hard' },
        { id: 'tribeHouses',     name: 'Tribe Houses',      area: 1500,   coeff: 0.85, type: 'hard' },
      ],
      // 5-year occupancy ramp (Sheet 4 C3-G3): 2027-2031
      occupancyRamp:     [0.10, 0.20, 0.25, 0.35, 0.50],
      forecastStartYear: 2027,
    })),
    rainfallData: {},
    // Diversity schedule (Sheet 3 col C)
    diversitySchedule: {
      type: 'monthly',
      months: [
        { month: 'Jan', weekday: 30, weekend: 50 },
        { month: 'Feb', weekday: 30, weekend: 50 },
        { month: 'Mar', weekday: 30, weekend: 50 },
        { month: 'Apr', weekday: 60, weekend: 60 },
        { month: 'May', weekday: 60, weekend: 60 },
        { month: 'Jun', weekday: 60, weekend: 60 },
        { month: 'Jul', weekday: 60, weekend: 60 },
        { month: 'Aug', weekday: 30, weekend: 50 },
        { month: 'Sep', weekday: 30, weekend: 50 },
        { month: 'Oct', weekday: 30, weekend: 50 },
        { month: 'Nov', weekday: 30, weekend: 50 },
        { month: 'Dec', weekday: 75, weekend: 75 },
      ]
    },
    simulationYears: { start: 2009, end: 2025 },
  };
  saveProject(project);
  return project;
}

function getActiveProjectId() { return localStorage.getItem(ACTIVE_KEY) || null; }
function setActiveProject(id)  { localStorage.setItem(ACTIVE_KEY, id); }
function clearActiveProject()  { localStorage.removeItem(ACTIVE_KEY); }

function updateProjectRainfall(projectId, dateKey, mm) {
  const p = getProject(projectId);
  if (!p) return;
  if (mm === null || mm === '' || isNaN(Number(mm))) delete p.rainfallData[dateKey];
  else p.rainfallData[dateKey] = Number(mm);
  p.updatedAt = new Date().toISOString();
  saveProject(p);
}

function importRainfallCSV(projectId, csvText) {
  const p = getProject(projectId);
  if (!p) return { count: 0, errors: ['Project not found'] };
  const parsed = parseCSVRainfall(csvText);
  let count = 0; const errors = [];
  for (const [key, val] of Object.entries(parsed)) {
    if (val >= 0 && val <= 2000) { p.rainfallData[key] = val; count++; }
    else errors.push(`Invalid value ${val} for ${key}`);
  }
  p.updatedAt = new Date().toISOString();
  saveProject(p);
  return { count, errors };
}

function getRainfallStats(rainfallData) {
  const values = Object.values(rainfallData).map(Number).filter(v => !isNaN(v));
  if (!values.length) return { total: 0, max: 0, rainyDays: 0, count: 0 };
  return { total: values.reduce((s,v) => s+v, 0), max: Math.max(...values),
           rainyDays: values.filter(v => v > 0).length, count: values.length };
}
