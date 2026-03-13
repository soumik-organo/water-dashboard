/**
 * Water Management Calculation Engine
 * Replicates all Excel logic from "Working template - Water.xlsx"
 */

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE PROJECT (from "Reference Project master - Con" sheet)
// ─────────────────────────────────────────────────────────────────────────────
const REFERENCE_PROJECT = {
  id: 'reference',
  name: 'Reference Project',
  location: 'Reference Location',
  isReference: true,
  params: {
    landSize: 60,
    numVillas: 182,
    bua: 2700,
    bedrooms: 3,
    occupantsPerVilla: 4,
    lpcd: 200,                // litres per house per day (200 = 4 persons × 50)
    lpcdPerPerson: 200/4,     // 50 lpcd breakdown below
    waterBreakdown: {
      drinking: 7.4,
      cooking: 7.4,
      bathing: 81.5,
      washingClothes: 29.6,
      washingUtensils: 14.8,
      flushing: 44.4,
      houseCleaning: 14.9,
    },
    farmArea: 19789.57,
    forestArea: 24276,
    roadArea: 27829.74,
    roofArea: 45645.6,
    villaIrrigArea: 3360,
    // Drip irrigation
    dripLinesPerBed: 3,
    totalDripLines: 54989,
    dripFlowRate: 4,          // LPH per line
    dripDurationMin: 30,      // minutes per day
    dripEfficiency: 0.9,
    // Sprinklers
    sprinklerAreaPerUnit: 16, // sqm per sprinkler
    numSprinklersVilla: 210,
    numSprinklersFarm: 129,
    sprinklerFlowRate: 55,    // LPH per sprinkler
    sprinklerEfficiency: 0.7,
    // Catchments
    catchments: [
      { id: 'villaRoof',        name: 'Villa Roof Tops',    area: 6198.402, coeff: 0.85, type: 'hard' },
      { id: 'villaGarden',      name: 'Villa Garden',       area: 11637,    coeff: 0.34, type: 'soft' },
      { id: 'farm',             name: 'Farm',               area: 20234,    coeff: 0.34, type: 'soft' },
      { id: 'forest',           name: 'Forest',             area: 8093,     coeff: 0.34, type: 'soft' },
      { id: 'tribeClub',        name: 'Tribe Club',         area: 1858,     coeff: 0.85, type: 'hard' },
      { id: 'clusterWalkways',  name: 'Cluster Walkways',   area: 1296,     coeff: 0.34, type: 'semisoft' },
      { id: 'roads',            name: 'Roads',              area: 3695,     coeff: 0.85, type: 'hard' },
      { id: 'tribeHouses',      name: 'Tribe Houses',       area: 1500,     coeff: 0.85, type: 'hard' },
    ],
    occupancyRamp: [0.10, 0.20, 0.30, 0.50, 0.70],
    farmingMonthlyKL: 0,    // to be calculated
    landscapingMonthlyKL: 0,
    swimmingPoolMonthlyKL: 0,
    amenitiesMonthlyKL: 0,
    goshalaMontlyKL: 0,
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DIVERSITY SCHEDULE
// Based on Excel week-number pattern. Returns diversity factor for a date.
// Pattern: seasonal – low season 30%/50% (wkday/wkend), peak 60%, year-end 75%
// ─────────────────────────────────────────────────────────────────────────────
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDiversityFactor(date, diversitySchedule) {
  // If custom diversity schedule provided, use it
  if (diversitySchedule && diversitySchedule.type === 'monthly') {
    const month = date.getMonth(); // 0-11
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const s = diversitySchedule.months[month];
    return isWeekend ? s.weekend / 100 : s.weekday / 100;
  }

  const week = getISOWeek(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;

  // Default Excel-derived schedule
  if (week >= 1  && week <= 17) return isWeekend ? 0.50 : 0.30;
  if (week === 18)               return isWeekend ? 0.50 : 0.60;
  if (week >= 19 && week <= 30) return 0.60;
  if (week === 31)               return isWeekend ? 0.30 : 0.60;
  if (week >= 32 && week <= 39) return isWeekend ? 0.50 : 0.30;
  if (week === 40)               return isWeekend ? 0.30 : 0.60;
  if (week >= 41 && week <= 43) return 0.60;
  if (week === 44)               return isWeekend ? 0.30 : 0.60;
  if (week >= 45 && week <= 51) return isWeekend ? 0.50 : 0.30;
  return 0.75; // week 52+
}

// ─────────────────────────────────────────────────────────────────────────────
// DERIVED PARAMETERS  (called once when params saved)
// ─────────────────────────────────────────────────────────────────────────────
function computeDerivedParams(p) {
  const totalPop     = p.numVillas * p.occupantsPerVilla;
  const totalDripFlow = p.totalDripLines * p.dripFlowRate;        // litres (all lines, 1 hr)
  const dripDaily    = totalDripFlow * (p.dripDurationMin / 60) * p.dripEfficiency; // L/day
  const numSprFarm   = Math.floor(p.farmArea / p.sprinklerAreaPerUnit);
  const numSprVilla  = p.villaIrrigArea ? Math.floor(p.villaIrrigArea / p.sprinklerAreaPerUnit) : 0;
  const sprFarmDaily = numSprFarm * p.sprinklerFlowRate * (p.dripDurationMin / 60) * p.sprinklerEfficiency;
  const sprVillaDaily= numSprVilla* p.sprinklerFlowRate * (p.dripDurationMin / 60) * p.sprinklerEfficiency;
  const farmingDailyKL = (dripDaily + sprFarmDaily + sprVillaDaily) / 1000;
  const farmingMonthlyKL = farmingDailyKL * 30;

  return {
    ...p,
    totalPop,
    totalDripFlow,
    dripDailyL: dripDaily,
    numSprinklersFarm: numSprFarm,
    numSprinklersVilla: numSprVilla,
    sprFarmDailyL: sprFarmDaily,
    sprVillaDailyL: sprVillaDaily,
    farmingDailyKL,
    farmingMonthlyKL,
    totalCatchmentArea: p.catchments.reduce((s, c) => s + c.area, 0),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CALCULATION (single day)
// ─────────────────────────────────────────────────────────────────────────────
function calcDay(date, rainfallMm, params, diversitySchedule) {
  const diversity = getDiversityFactor(date, diversitySchedule);

  // Domestic demand KL/day
  const domesticKL = (params.totalPop * (params.lpcdPerPerson || params.lpcd / params.occupantsPerVilla) / 1000) * diversity;

  // Harvestable water per catchment
  const harvestByArea = {};
  let totalHarvestKL = 0;
  for (const c of params.catchments) {
    const kl = (rainfallMm / 1000) * c.coeff * c.area;
    harvestByArea[c.id] = kl;
    totalHarvestKL += kl;
  }

  // Non-domestic daily demand
  const otherDailyKL = (params.farmingMonthlyKL + params.landscapingMonthlyKL +
                        params.swimmingPoolMonthlyKL + params.amenitiesMonthlyKL +
                        (params.goshalaMontlyKL || 0)) / 30;

  const totalDemandKL   = domesticKL + otherDailyKL;
  const dailyDiffKL     = totalHarvestKL - totalDemandKL;

  return { date, diversity, rainfallMm, domesticKL, harvestByArea, totalHarvestKL,
           otherDailyKL, totalDemandKL, dailyDiffKL };
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL SIMULATION  (historical rainfall period)
// ─────────────────────────────────────────────────────────────────────────────
function runSimulation(params, rainfallData, startYear, endYear, diversitySchedule) {
  const dp = computeDerivedParams(params);
  const results = [];
  let cumBalance = 0;
  let minBalance = 0;
  let maxBalance = 0;

  const start = new Date(startYear, 0, 1);
  const end   = new Date(endYear,   11, 31);
  const cur   = new Date(start);

  while (cur <= end) {
    const key  = formatDateKey(cur);
    const rain = (rainfallData && rainfallData[key] != null) ? Number(rainfallData[key]) : 0;

    const day  = calcDay(cur, rain, dp, diversitySchedule);
    cumBalance += day.dailyDiffKL;
    day.cumulativeBalance = cumBalance;

    if (cumBalance < minBalance) minBalance = cumBalance;
    if (cumBalance > maxBalance) maxBalance = cumBalance;

    results.push(day);
    cur.setDate(cur.getDate() + 1);
  }

  return { dailyResults: results, maxStorageRequired: Math.abs(minBalance),
           minBalance, maxBalance, params: dp };
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────
function aggregateByMonth(dailyResults) {
  const monthly = {};
  for (const d of dailyResults) {
    const key = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!monthly[key]) {
      monthly[key] = { year: d.date.getFullYear(), month: d.date.getMonth()+1,
                       rainfallMm: 0, domesticKL: 0, totalHarvestKL: 0,
                       totalDemandKL: 0, days: 0, endBalance: 0 };
    }
    const m = monthly[key];
    m.rainfallMm     += d.rainfallMm;
    m.domesticKL     += d.domesticKL;
    m.totalHarvestKL += d.totalHarvestKL;
    m.totalDemandKL  += d.totalDemandKL;
    m.days++;
    m.endBalance      = d.cumulativeBalance;
  }
  return Object.values(monthly).sort((a,b) => a.year*100+a.month - (b.year*100+b.month));
}

// ─────────────────────────────────────────────────────────────────────────────
// ANNUAL AGGREGATION
// ─────────────────────────────────────────────────────────────────────────────
function aggregateByYear(dailyResults) {
  const annual = {};
  for (const d of dailyResults) {
    const y = d.date.getFullYear();
    if (!annual[y]) {
      annual[y] = { year: y, rainfallMm: 0, domesticKL: 0, totalHarvestKL: 0,
                    totalDemandKL: 0, minBalance: Infinity, maxBalance: -Infinity };
    }
    const a = annual[y];
    a.rainfallMm     += d.rainfallMm;
    a.domesticKL     += d.domesticKL;
    a.totalHarvestKL += d.totalHarvestKL;
    a.totalDemandKL  += d.totalDemandKL;
    if (d.cumulativeBalance < a.minBalance) a.minBalance = d.cumulativeBalance;
    if (d.cumulativeBalance > a.maxBalance) a.maxBalance = d.cumulativeBalance;
  }
  return Object.values(annual).sort((a,b) => a.year - b.year);
}

// ─────────────────────────────────────────────────────────────────────────────
// WORST YEAR ANALYSIS  (finds year with minimum total rainfall)
// ─────────────────────────────────────────────────────────────────────────────
function findWorstYear(dailyResults) {
  const annual = aggregateByYear(dailyResults);
  return annual.reduce((worst, y) => (!worst || y.rainfallMm < worst.rainfallMm) ? y : worst, null);
}

function getWorstYearMonthly(dailyResults, worstYear) {
  return aggregateByMonth(dailyResults.filter(d => d.date.getFullYear() === worstYear));
}

// ─────────────────────────────────────────────────────────────────────────────
// 5-YEAR OCCUPANCY FORECAST (Occupancy based demand sheet)
// ─────────────────────────────────────────────────────────────────────────────
function run5YearForecast(params, rainfallData, startYear, occupancyRamp, diversitySchedule) {
  const results = [];
  for (let yearIdx = 0; yearIdx < 5; yearIdx++) {
    const occupancy = occupancyRamp[yearIdx];
    const forecastYear = startYear + yearIdx;
    const scaledParams = {
      ...params,
      totalPop: Math.round(params.numVillas * params.occupantsPerVilla * occupancy),
      farmingMonthlyKL: params.farmingMonthlyKL * occupancy,
      landscapingMonthlyKL: (params.landscapingMonthlyKL || 0) * occupancy,
    };

    const sim = runSimulation(scaledParams, rainfallData, forecastYear, forecastYear, diversitySchedule);
    const monthly = aggregateByMonth(sim.dailyResults);

    results.push({
      year: forecastYear,
      occupancy,
      population: scaledParams.totalPop,
      dailyDemandL: scaledParams.totalPop * (params.lpcdPerPerson || params.lpcd / params.occupantsPerVilla),
      monthlyDemandKL: monthly.reduce((s, m) => s + m.totalDemandKL, 0) / 12,
      annualDemandKL: monthly.reduce((s, m) => s + m.totalDemandKL, 0),
      annualHarvestKL: monthly.reduce((s, m) => s + m.totalHarvestKL, 0),
      maxStorageKL: sim.maxStorageRequired,
      monthly,
    });
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTHLY DEMAND SUMMARY (for single project at full occupancy)
// ─────────────────────────────────────────────────────────────────────────────
function calcMonthlyWaterDemand(params) {
  const dp = computeDerivedParams(params);
  const daysPerMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const monthNames   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Average domestic: monthly = totalPop × lpcd/person × avgDiversity × days
  // Use annual average diversity ≈ 0.40 (weighted approx)
  const avgDiversity = 0.40;
  return daysPerMonth.map((days, i) => ({
    month: monthNames[i],
    days,
    domesticKL: dp.totalPop * (dp.lpcdPerPerson || dp.lpcd / dp.occupantsPerVilla) / 1000 * avgDiversity * days,
    farmingKL:  dp.farmingMonthlyKL,
    totalKL:    dp.totalPop * (dp.lpcdPerPerson || dp.lpcd / dp.occupantsPerVilla) / 1000 * avgDiversity * days
               + dp.farmingMonthlyKL,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCE PROJECT CALCULATIONS (at full occupancy)
// ─────────────────────────────────────────────────────────────────────────────
function calcReferenceStats() {
  const p = REFERENCE_PROJECT.params;
  const dp = computeDerivedParams(p);
  const totalPop = dp.numVillas * dp.occupantsPerVilla;
  const dailyDomesticL = totalPop * (p.lpcd / p.occupantsPerVilla);
  const monthlyDomesticKL = (dailyDomesticL / 1000) * 30;
  return { dp, totalPop, dailyDomesticL, monthlyDomesticKL };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function getDaysInMonth(year, month) { // month 1-12
  return new Date(year, month, 0).getDate();
}

function parseCSVRainfall(csvText) {
  const lines = csvText.trim().split('\n');
  const data  = {};
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const dateStr = parts[0].trim();
    const mm      = parseFloat(parts[1].trim());
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(mm)) {
      data[dateStr] = mm;
    }
  }
  return data;
}

function exportCSVRainfall(rainfallData) {
  const lines = ['Date,Rainfall (mm)'];
  const sorted = Object.keys(rainfallData).sort();
  for (const key of sorted) {
    lines.push(`${key},${rainfallData[key]}`);
  }
  return lines.join('\n');
}

function roundTo(val, decimals) {
  return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec'];
