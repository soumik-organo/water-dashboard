/**
 * Sample data seeder – loads realistic 20-year rainfall data
 * based on typical Indian monsoon patterns for a 570–900 mm/yr location.
 * Click "Load Sample Data" to populate a demo project.
 */

// Monthly average rainfall (mm) per year, 2005-2024
// Modelled on a typical western-ghat foothills location
const SAMPLE_ANNUAL_RAINFALL = {
  2005: [0,0,2.1,28.4,72.3,124.6,105.2,148.3,82.4,19.7,0,55.3],
  2006: [0,0,0,41.2,88.7,198.4,142.3,201.6,94.1,28.4,0,32.1],
  2007: [0,0,1.2,18.6,43.2,91.4,78.3,103.4,58.2,14.2,0,28.7],
  2008: [0,0,3.4,52.1,95.4,182.3,131.2,188.4,86.3,34.7,0,41.2],
  2009: [0,0,0,14.2,38.7,72.4,58.3,84.2,41.2,8.4,0,21.3],
  2010: [0,0,4.2,62.3,118.4,224.6,168.4,228.7,104.3,44.2,0,58.4],
  2011: [0,0,2.1,35.6,78.4,148.2,112.3,158.7,74.2,22.4,0,38.7],
  2012: [0,0,0,21.4,52.3,104.6,84.2,118.4,58.3,16.2,0,30.4],
  2013: [0,0,3.8,48.2,92.4,178.3,128.4,182.6,84.3,32.1,0,46.8],
  2014: [0,0,1.4,28.7,64.2,124.8,94.3,138.4,66.2,18.4,0,32.1],
  2015: [0,0,0,16.4,42.3,84.6,68.4,96.2,48.3,10.8,0,24.6],
  2016: [0,0,2.8,44.6,88.4,168.3,124.2,178.4,82.3,28.4,0,44.2],
  2017: [0,0,1.8,32.4,72.8,138.6,104.8,148.3,68.4,20.6,0,36.8],
  2018: [0,0,1.4,33.6,59.4,117.3,91.7,120.4,71.2,22.3,0,47.2],  // worst year
  2019: [0,0,3.2,46.8,94.6,182.4,134.8,192.6,88.4,30.2,0,48.4],
  2020: [0,0,2.4,38.4,82.3,158.6,118.4,168.3,76.4,24.8,0,40.2],
  2021: [0,0,1.6,26.8,58.4,112.6,88.4,128.4,62.3,16.4,0,34.8],
  2022: [0,0,4.8,58.2,104.6,198.4,148.6,212.8,96.4,38.4,0,52.4],
  2023: [0,0,2.2,36.8,78.4,148.6,112.4,158.6,72.4,22.8,0,38.4],
  2024: [0,0,3.6,50.4,96.8,184.2,136.4,196.4,88.8,32.4,0,48.6],
};

const DAYS_PER_MONTH = [31,28,31,30,31,30,31,31,30,31,30,31];

function generateDailyRainfall(monthlyTotals, year) {
  const data = {};
  for (let m = 0; m < 12; m++) {
    const days      = (m === 1 && year % 4 === 0) ? 29 : DAYS_PER_MONTH[m];
    const monthly   = monthlyTotals[m];
    if (monthly <= 0) continue;

    // Distribute monthly rainfall across rainy days (not uniform – cluster mid-month)
    const rainyDays = Math.max(3, Math.round(monthly / 18)); // ~18mm per rainy day
    const rainySet  = new Set();
    while (rainySet.size < Math.min(rainyDays, days)) {
      rainySet.add(Math.floor(Math.random() * days) + 1);
    }
    const rainyArr    = [...rainySet].sort((a,b)=>a-b);
    const avgPerRainy = monthly / rainyArr.length;

    for (const d of rainyArr) {
      // Add natural variation (±40%)
      const variation = 0.6 + Math.random() * 0.8;
      const dayRain   = roundTo(avgPerRainy * variation, 1);
      const key       = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      data[key]       = dayRain;
    }

    // Redistribute to hit monthly total
    const actual = rainyArr.reduce((s, d) => {
      const k = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      return s + (data[k] || 0);
    }, 0);

    const scale = monthly / (actual || 1);
    for (const d of rainyArr) {
      const k = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      if (data[k]) data[k] = roundTo(data[k] * scale, 1);
    }
  }
  return data;
}

function loadSampleData(projectId) {
  const p = getProject(projectId);
  if (!p) return;

  p.rainfallData = {};
  for (const [year, monthly] of Object.entries(SAMPLE_ANNUAL_RAINFALL)) {
    const daily = generateDailyRainfall(monthly, parseInt(year));
    Object.assign(p.rainfallData, daily);
  }

  p.simulationYears = { start: 2005, end: 2024 };
  p.updatedAt = new Date().toISOString();
  saveProject(p);

  const count = Object.keys(p.rainfallData).length;
  return count;
}
