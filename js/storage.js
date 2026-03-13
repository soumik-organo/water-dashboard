/**
 * Project Storage Manager – uses localStorage
 */

const DB_KEY       = 'waterProjects';
const ACTIVE_KEY   = 'activeProjectId';

function getAllProjects() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  } catch { return []; }
}

function saveAllProjects(projects) {
  localStorage.setItem(DB_KEY, JSON.stringify(projects));
}

function getProject(id) {
  return getAllProjects().find(p => p.id === id) || null;
}

function saveProject(project) {
  const projects = getAllProjects();
  const idx = projects.findIndex(p => p.id === project.id);
  if (idx >= 0) projects[idx] = project;
  else          projects.push(project);
  saveAllProjects(projects);
}

function deleteProject(id) {
  const projects = getAllProjects().filter(p => p.id !== id);
  saveAllProjects(projects);
  if (getActiveProjectId() === id) clearActiveProject();
}

function createNewProject(name, location) {
  const id = 'proj_' + Date.now();
  const project = {
    id, name, location,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    params: JSON.parse(JSON.stringify({
      landSize: 26.5,
      numVillas: 174,
      bua: 2700,
      bedrooms: 2,
      occupantsPerVilla: 3,
      lpcd: 150,
      lpcdPerPerson: 50,
      waterBreakdown: {
        drinking: 7.4, cooking: 7.4, bathing: 81.5,
        washingClothes: 29.6, washingUtensils: 14.8,
        flushing: 44.4, houseCleaning: 14.9,
      },
      farmArea: 8740,
      forestArea: 10722,
      roadArea: 12291,
      roofArea: 0,
      villaIrrigArea: 0,
      totalDripLines: 24287,
      dripLinesPerBed: 3,
      dripFlowRate: 4,
      dripDurationMin: 30,
      dripEfficiency: 0.90,
      sprinklerAreaPerUnit: 16,
      sprinklerFlowRate: 55,
      sprinklerEfficiency: 0.70,
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
      occupancyRamp: [0.10, 0.20, 0.30, 0.50, 0.70],
      forecastStartYear: 2027,
      farmingMonthlyKL: 0,
      landscapingMonthlyKL: 0,
      swimmingPoolMonthlyKL: 0,
      amenitiesMonthlyKL: 0,
      goshalaMontlyKL: 0,
    })),
    rainfallData: {},   // key: "YYYY-MM-DD", value: mm
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
    simulationYears: { start: 2005, end: 2024 },
  };
  saveProject(project);
  return project;
}

function getActiveProjectId() {
  return localStorage.getItem(ACTIVE_KEY) || null;
}

function setActiveProject(id) {
  localStorage.setItem(ACTIVE_KEY, id);
}

function clearActiveProject() {
  localStorage.removeItem(ACTIVE_KEY);
}

function updateProjectRainfall(projectId, dateKey, mm) {
  const p = getProject(projectId);
  if (!p) return;
  if (mm === null || mm === '' || isNaN(Number(mm))) {
    delete p.rainfallData[dateKey];
  } else {
    p.rainfallData[dateKey] = Number(mm);
  }
  p.updatedAt = new Date().toISOString();
  saveProject(p);
}

function importRainfallCSV(projectId, csvText) {
  const p = getProject(projectId);
  if (!p) return { count: 0, errors: ['Project not found'] };
  const parsed = parseCSVRainfall(csvText);
  let count = 0;
  const errors = [];
  for (const [key, val] of Object.entries(parsed)) {
    if (val >= 0 && val <= 2000) {
      p.rainfallData[key] = val;
      count++;
    } else {
      errors.push(`Invalid value ${val} for ${key}`);
    }
  }
  p.updatedAt = new Date().toISOString();
  saveProject(p);
  return { count, errors };
}

function getRainfallStats(rainfallData) {
  const values = Object.values(rainfallData).map(Number).filter(v => !isNaN(v));
  if (!values.length) return { total: 0, max: 0, rainyDays: 0, count: 0 };
  return {
    total: values.reduce((s, v) => s + v, 0),
    max: Math.max(...values),
    rainyDays: values.filter(v => v > 0).length,
    count: values.length,
  };
}
