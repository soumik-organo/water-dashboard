/**
 * Water Management Calculation Engine
 * Replicates Excel: Water net zero calculator - 2nd rough.xlsx
 *
 * Antharam-derived ratios (cross-sheet from "Reference project- Antharam"):
 *   drippersPerSqm       = 2.3917  (B11)
 *   farmSprinklersPerSqm = 0.12311 (B16)
 *   villaSprinklersPerSqm= 0.01799 (B22)
 *
 * All irrigation runs 30 min/day. 55 = L per sprinkler per session (not LPH).
 * Excel chain: farmDripArea * drippersPerSqm * 4LPH * 0.5hr * 0.9eff = daily drip L
 */

const REFERENCE_PROJECT = {
  id: 'reference', name: 'Reference Project \u2013 Antharam', location: 'Antharam, 60 Acres',
  isReference: true,
  params: {
    landSize: 60, numVillas: 182, bua: 2700, bedrooms: 3, occupantsPerVilla: 4,
    lpcdPerPerson: 170,
    farmDripArea: 14948.675, farmSprinklerArea: 1047.81, villaIrrigArea: 3360.268,
    drippersPerSqm: 2.3917, farmSprinklersPerSqm: 0.12311, villaSprinklersPerSqm: 0.017985,
    dripFlowRate: 4, dripDurationMin: 30, dripEfficiency: 0.90,
    sprinklerSessionLPU: 55, sprinklerEfficiency: 0.70,
    catchments: [
      { id: 'villaRoof',       name: 'Villa Roof Tops',   area: 6198.402, coeff: 0.85, type: 'hard' },
      { id: 'villaGarden',     name: 'Villa Garden',      area: 11637,    coeff: 0.34, type: 'soft' },
      { id: 'farm',            name: 'Farm',              area: 20234,    coeff: 0.34, type: 'soft' },
      { id: 'forest',          name: 'Forest',            area: 8093,     coeff: 0.34, type: 'soft' },
      { id: 'tribeClub',       name: 'Tribe Club',        area: 1858,     coeff: 0.85, type: 'hard' },
      { id: 'clusterWalkways', name: 'Cluster Walkways',  area: 1296,     coeff: 0.34, type: 'semisoft' },
      { id: 'roads',           name: 'Roads',             area: 3695,     coeff: 0.85, type: 'hard' },
      { id: 'tribeHouses',     name: 'Tribe Houses',      area: 1500,     coeff: 0.85, type: 'hard' },
    ],
    goshalaMontlyKL: 0, swimmingPoolMonthlyKL: 0, amenitiesMonthlyKL: 0,
    landscapingMonthlyKL: 0, farmingMonthlyKL: 0,
    occupancyRamp: [0.10, 0.20, 0.30, 0.50, 0.70],
  }
};

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getDiversityFactor(date, diversitySchedule) {
  if (diversitySchedule && diversitySchedule.type === 'monthly') {
    const month     = date.getMonth();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const s = diversitySchedule.months[month];
    return isWeekend ? s.weekend / 100 : s.weekday / 100;
  }
  const week      = getISOWeek(date);
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  if (week >= 1  && week <= 17) return isWeekend ? 0.50 : 0.30;
  if (week === 18)               return isWeekend ? 0.50 : 0.60;
  if (week >= 19 && week <= 30) return 0.60;
  if (week === 31)               return isWeekend ? 0.30 : 0.60;
  if (week >= 32 && week <= 39) return isWeekend ? 0.50 : 0.30;
  if (week === 40)               return isWeekend ? 0.30 : 0.60;
  if (week >= 41 && week <= 43) return 0.60;
  if (week === 44)               return isWeekend ? 0.30 : 0.60;
  if (week >= 45 && week <= 51) return isWeekend ? 0.50 : 0.30;
  return 0.75;
}

/**
 * computeDerivedParams
 * Excel New Project sheet - key cells:
 *   B11 = farmDripArea * drippersPerSqm
 *   B12 = B11 * 4 LPH (total drip flow)
 *   B13 = B12 / 2 (30-min session)
 *   B22 = B13 * 0.90 (drip L/day after efficiency)
 *   D22 = B22 * 30 / 1000 (drip KL/month)
 *   B14 = farmSprinklerArea * farmSprinklersPerSqm
 *   B15 = B14 * 55 (55 L/sprinkler/session)
 *   B23 = B15 * 0.70 (farm sprinkler L/day)
 *   D23 = B23 * 30 / 1000 (farm sprinkler KL/month)
 *   B18 = villaIrrigArea * villaSprinklersPerSqm
 *   B19 = B18 * 55
 *   B24 = B19 * 0.70 (villa sprinkler L/day)
 *   D24 = B24 * 30 / 1000 (villa irrigation KL/month)
 *   D29 = SUM all non-domestic monthly KL
 *   D30 = D29 / 30 (daily non-domestic KL - used in Sheet 4)
 */
function computeDerivedParams(p) {
  const totalPop      = p.numVillas * p.occupantsPerVilla;
  const farmDripArea  = p.farmDripArea || p.farmArea || 0;
  const drippersPerSqm = p.drippersPerSqm || 0;

  let numDrippers, dripDailyL;
  if (drippersPerSqm > 0 && farmDripArea > 0) {
    numDrippers = farmDripArea * drippersPerSqm;
    const totalDripFlow = numDrippers * (p.dripFlowRate || 4);
    dripDailyL  = totalDripFlow * 0.5 * (p.dripEfficiency || 0.9);
  } else {
    numDrippers = p.totalDripLines || 0;
    dripDailyL  = numDrippers * (p.dripFlowRate || 4) * ((p.dripDurationMin || 30) / 60) * (p.dripEfficiency || 0.9);
  }
  const dripMonthlyKL = (dripDailyL * 30) / 1000;

  const farmSprinklerArea    = p.farmSprinklerArea || 0;
  const farmSprinklersPerSqm = p.farmSprinklersPerSqm || 0;
  const sprSession = p.sprinklerSessionLPU || 55;
  let numSprFarm, sprFarmDailyL;
  if (farmSprinklersPerSqm > 0 && farmSprinklerArea > 0) {
    numSprFarm    = farmSprinklerArea * farmSprinklersPerSqm;
    sprFarmDailyL = numSprFarm * sprSession * (p.sprinklerEfficiency || 0.7);
  } else {
    numSprFarm    = p.numSprinklersFarm || Math.floor((p.farmArea || 0) / (p.sprinklerAreaPerUnit || 16));
    sprFarmDailyL = numSprFarm * sprSession * (p.sprinklerEfficiency || 0.7);
  }
  const farmSprMonthlyKL = (sprFarmDailyL * 30) / 1000;

  const villaIrrigArea        = p.villaIrrigArea || 0;
  const villaSprinklersPerSqm = p.villaSprinklersPerSqm || 0;
  let numSprVilla, sprVillaDailyL;
  if (villaSprinklersPerSqm > 0 && villaIrrigArea > 0) {
    numSprVilla    = villaIrrigArea * villaSprinklersPerSqm;
    sprVillaDailyL = numSprVilla * sprSession * (p.sprinklerEfficiency || 0.7);
  } else {
    numSprVilla    = p.numSprinklersVilla || Math.floor(villaIrrigArea / (p.sprinklerAreaPerUnit || 16));
    sprVillaDailyL = numSprVilla * sprSession * (p.sprinklerEfficiency || 0.7);
  }
  const villaSprMonthlyKL = (sprVillaDailyL * 30) / 1000;

  const farmingMonthlyKL = dripMonthlyKL + farmSprMonthlyKL + villaSprMonthlyKL;
  const totalMonthlyKL   = farmingMonthlyKL
    + (p.goshalaMontlyKL       || 0)
    + (p.swimmingPoolMonthlyKL || 0)
    + (p.amenitiesMonthlyKL    || 0)
    + (p.landscapingMonthlyKL  || 0);
  const totalNonDomesticDailyKL = totalMonthlyKL / 30;

  return {
    ...p, totalPop, farmDripArea,
    numDrippers:            Math.round(numDrippers),
    dripDailyL:             Math.round(dripDailyL),
    dripMonthlyKL:          roundTo(dripMonthlyKL, 2),
    numSprinklersFarm:      Math.round(numSprFarm),
    sprFarmDailyL:          Math.round(sprFarmDailyL),
    farmSprMonthlyKL:       roundTo(farmSprMonthlyKL, 2),
    numSprinklersVilla:     Math.round(numSprVilla),
    sprVillaDailyL:         Math.round(sprVillaDailyL),
    villaSprMonthlyKL:      roundTo(villaSprMonthlyKL, 2),
    farmingDailyKL:         (dripDailyL + sprFarmDailyL + sprVillaDailyL) / 1000,
    farmingMonthlyKL:       roundTo(farmingMonthlyKL, 2),
    totalMonthlyKL:         roundTo(totalMonthlyKL, 2),
    totalNonDomesticDailyKL: roundTo(totalNonDomesticDailyKL, 2),
    totalCatchmentArea:     (p.catchments || []).reduce((s, c) => s + c.area, 0),
  };
}

function calcDay(date, rainfallMm, params, diversitySchedule) {
  const diversity  = getDiversityFactor(date, diversitySchedule);
  const domesticKL = (params.totalPop * (params.lpcdPerPerson || params.lpcd / params.occupantsPerVilla) / 1000) * diversity;
  const harvestByArea = {};
  let totalHarvestKL = 0;
  for (const c of params.catchments) {
    const kl = (rainfallMm / 1000) * c.coeff * c.area;
    harvestByArea[c.id] = kl;
    totalHarvestKL += kl;
  }
  const otherDailyKL = params.totalNonDomesticDailyKL || (
    (params.farmingMonthlyKL + (params.landscapingMonthlyKL || 0) +
     (params.swimmingPoolMonthlyKL || 0) + (params.amenitiesMonthlyKL || 0) +
     (params.goshalaMontlyKL || 0)) / 30
  );
  const totalDemandKL = domesticKL + otherDailyKL;
  const dailyDiffKL   = totalHarvestKL - totalDemandKL;
  return { date, diversity, rainfallMm, domesticKL, harvestByArea, totalHarvestKL, otherDailyKL, totalDemandKL, dailyDiffKL };
}

function runSimulation(params, rainfallData, startYear, endYear, diversitySchedule) {
  const dp = computeDerivedParams(params);
  const results = [];
  let cumBalance = 0, minBalance = 0, maxBalance = 0;
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
  return { dailyResults: results, maxStorageRequired: Math.abs(minBalance), minBalance, maxBalance, params: dp };
}

function aggregateByMonth(dailyResults) {
  const monthly = {};
  for (const d of dailyResults) {
    const key = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,'0')}`;
    if (!monthly[key]) {
      monthly[key] = { year: d.date.getFullYear(), month: d.date.getMonth()+1,
                       rainfallMm: 0, domesticKL: 0, totalHarvestKL: 0, totalDemandKL: 0, days: 0, endBalance: 0 };
    }
    const m = monthly[key];
    m.rainfallMm += d.rainfallMm; m.domesticKL += d.domesticKL;
    m.totalHarvestKL += d.totalHarvestKL; m.totalDemandKL += d.totalDemandKL;
    m.days++; m.endBalance = d.cumulativeBalance;
  }
  return Object.values(monthly).sort((a,b) => a.year*100+a.month - (b.year*100+b.month));
}

function aggregateByYear(dailyResults) {
  const annual = {};
  for (const d of dailyResults) {
    const y = d.date.getFullYear();
    if (!annual[y]) {
      annual[y] = { year: y, rainfallMm: 0, domesticKL: 0, totalHarvestKL: 0, totalDemandKL: 0,
                    minBalance: Infinity, maxBalance: -Infinity };
    }
    const a = annual[y];
    a.rainfallMm += d.rainfallMm; a.domesticKL += d.domesticKL;
    a.totalHarvestKL += d.totalHarvestKL; a.totalDemandKL += d.totalDemandKL;
    if (d.cumulativeBalance < a.minBalance) a.minBalance = d.cumulativeBalance;
    if (d.cumulativeBalance > a.maxBalance) a.maxBalance = d.cumulativeBalance;
  }
  return Object.values(annual).sort((a,b) => a.year - b.year);
}

function findWorstYear(dailyResults) {
  const annual = aggregateByYear(dailyResults);
  return annual.reduce((worst, y) => (!worst || y.rainfallMm < worst.rainfallMm) ? y : worst, null);
}

function getWorstYearMonthly(dailyResults, worstYear) {
  return aggregateByMonth(dailyResults.filter(d => d.date.getFullYear() === worstYear));
}

/**
 * run5YearForecast - Sheet 4 logic
 * Occupancy ramp 2027-2031: 10/20/25/35/50%
 * Non-domestic demand stays fixed (Excel Sheet 4 M1=D30 is constant)
 */
function run5YearForecast(params, rainfallData, startYear, occupancyRamp, diversitySchedule) {
  const dp = computeDerivedParams(params);
  const results = [];
  for (let i = 0; i < 5; i++) {
    const occupancy    = occupancyRamp[i] || 0;
    const forecastYear = startYear + i;
    const scaledParams = {
      ...dp,
      totalPop: Math.round(params.numVillas * params.occupantsPerVilla * occupancy),
      totalNonDomesticDailyKL: dp.totalNonDomesticDailyKL,
    };
    const sim     = runSimulation(scaledParams, rainfallData, forecastYear, forecastYear, diversitySchedule);
    const monthly = aggregateByMonth(sim.dailyResults);
    results.push({
      year: forecastYear, occupancy, population: scaledParams.totalPop,
      annualDemandKL:  roundTo(monthly.reduce((s, m) => s + m.totalDemandKL, 0), 0),
      annualHarvestKL: roundTo(monthly.reduce((s, m) => s + m.totalHarvestKL, 0), 0),
      maxStorageKL:    roundTo(sim.maxStorageRequired, 0),
      monthly,
    });
  }
  return results;
}

/** calcIrrigationBreakdown - returns D22:D29 breakdown from New Project sheet */
function calcIrrigationBreakdown(p) {
  const dp = computeDerivedParams(p);
  return {
    dripFarmingKL:      dp.dripMonthlyKL,
    farmSprinklerKL:    dp.farmSprMonthlyKL,
    villaIrrigKL:       dp.villaSprMonthlyKL,
    goshalKL:           p.goshalaMontlyKL        || 0,
    swimmingPoolKL:     p.swimmingPoolMonthlyKL  || 0,
    amenitiesKL:        p.amenitiesMonthlyKL     || 0,
    landscapingKL:      p.landscapingMonthlyKL   || 0,
    totalMonthlyKL:     dp.totalMonthlyKL,
    totalDailyKL:       dp.totalNonDomesticDailyKL,
    numDrippers:        dp.numDrippers,
    numSprinklersFarm:  dp.numSprinklersFarm,
    numSprinklersVilla: dp.numSprinklersVilla,
  };
}

function calcReferenceStats() {
  const p = REFERENCE_PROJECT.params;
  const dp = computeDerivedParams(p);
  return { dp, totalPop: dp.totalPop,
    dailyDomesticL: dp.totalPop * (p.lpcdPerPerson || 170),
    monthlyDomesticKL: dp.totalPop * (p.lpcdPerPerson || 170) / 1000 * 30 };
}

function calcMonthlyWaterDemand(params) {
  const dp = computeDerivedParams(params);
  const daysPerMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  const monthNames   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return daysPerMonth.map((days, i) => {
    const domestic = dp.totalPop * (dp.lpcdPerPerson || dp.lpcd / dp.occupantsPerVilla) / 1000 * 0.40 * days;
    const other    = dp.totalNonDomesticDailyKL * days;
    return { month: monthNames[i], days, domesticKL: domestic, farmingKL: dp.farmingMonthlyKL, totalKL: domestic + other };
  });
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function getDaysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function parseCSVRainfall(csvText) {
  const lines = csvText.trim().split('\n');
  const data  = {};
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 2) continue;
    const dateStr = parts[0].trim(), mm = parseFloat(parts[1].trim());
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(mm)) data[dateStr] = mm;
  }
  return data;
}

function exportCSVRainfall(rainfallData) {
  const lines = ['Date,Rainfall (mm)'];
  for (const key of Object.keys(rainfallData).sort()) lines.push(`${key},${rainfallData[key]}`);
  return lines.join('\n');
}

function roundTo(val, decimals) { return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals); }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
