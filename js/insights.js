/**
 * insights.js
 * ---------------------------------------------------------------------------
 * Insight generation engine.
 *
 * Takes the raw portfolio (vehicles + telematics aggregates) and derives the
 * intelligence model every dashboard section renders from:
 *
 *   fleet        — executive summary counters and trend deltas
 *   utilization  — segmentation, top/under-utilized, heatmap, savings math
 *   maintenance  — alerts, PM pipeline, high-cost units, downtime, repeats
 *   lifecycle    — per-unit lifecycle score, bands, replacement forecast
 *   financial    — TCO, cost/km, cost/hour, lease efficiency, ROI targets
 *
 * Pure functions of the input data: no DOM access, no service calls. This is
 * the layer that would stay identical when live MyGeotab data replaces the
 * sample generator.
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  /** Utilization banding thresholds (% of available working time in motion). */
  const BANDS = { high: 75, moderate: 40, low: 10 };   // below `low` = idle

  /** Lifecycle score bands. */
  const LIFE_BANDS = [
    { key: 'healthy', label: 'Healthy',          min: 70 },
    { key: 'monitor', label: 'Monitor',          min: 50 },
    { key: 'plan',    label: 'Plan replacement', min: 35 },
    { key: 'replace', label: 'Replace now',      min: 0 }
  ];

  /**
   * Lifecycle score, 0–100 (100 = healthy new asset).
   * Weighted on age, accumulated duty, maintenance economics & trend,
   * downtime, and open condition signals — the composite Maxim would use to
   * time replacements and remarketing.
   */
  function lifecycleScore(v) {
    let s = 100;
    // Age and duty use a power curve: mid-life assets stay healthy, the
    // penalty accelerates as an asset approaches its class life limits.
    s -= Math.min(30, Math.pow(v.ageYears / v.norms.lifeYrs, 1.6) * 30); // age vs class life
    s -= Math.min(26, Math.pow(v.odometerKm / v.norms.lifeKm, 1.6) * 26); // duty vs class life
    const costRatio = v.maintenance.costPerKm / v.norms.normCostKm;      // maint $/km vs norm
    s -= Math.min(20, Math.max(0, (costRatio - 0.8)) * 9);
    if (v.maintenance.costTrend === 1) s -= 8;                           // rising cost trajectory
    if (v.maintenance.repeatSystem)    s -= 6;                           // chronic system failures
    s -= Math.min(8, v.maintenance.downtimeDays90d * 1.1);               // recent downtime
    v.faults.forEach(f => { s -= f.severity === 'Critical' ? 5 : (f.severity === 'Major' ? 3 : 1); });
    if (v.dvirDefects90d >= 3) s -= 3;
    return Math.round(Math.max(4, Math.min(99, s)));
  }

  function lifeBand(score) {
    return LIFE_BANDS.find(b => score >= b.min);
  }

  /**
   * Per-unit annual operating economics (lessee-facing view):
   * lease + maintenance + fuel. Trailers simply have no fuel line.
   */
  function unitEconomics(v, fuelPrice) {
    const lease = v.lease.monthlyRate * 12;
    const maint = Math.round(v.maintenance.ytdCost * (12 / 8));          // annualize ~8-month YTD window
    const fuel = v.powered ? Math.round(v.annualKm * (v.fuelL100 / 100) * fuelPrice) : 0;
    const tco = lease + maint + fuel;
    return {
      lease, maint, fuel, tco,
      costPerKm: +(tco / Math.max(v.annualKm, 1)).toFixed(2),
      costPerHour: v.powered && v.engineHours
        ? +(tco / Math.max(v.engineHours / Math.max(v.ageYears, 0.5), 1)).toFixed(2)
        : null
    };
  }

  /**
   * Build the complete intelligence model.
   * @param {object} portfolio - output of GeotabService.loadPortfolio()
   * @param {object[]} vehicles - the (possibly filtered) vehicle subset to analyse
   */
  function build(portfolio, vehicles) {
    const vs = vehicles || portfolio.vehicles;
    const n = vs.length || 1;

    // Enrich every record once: score, band, economics.
    vs.forEach(v => {
      v.lifecycleScore = lifecycleScore(v);
      v.lifeBand = lifeBand(v.lifecycleScore);
      v.econ = unitEconomics(v, portfolio.fuelPrice);
    });

    return {
      portfolio,
      vehicles: vs,
      fleet: fleetSummary(vs, portfolio),
      utilization: utilizationIntel(vs, portfolio),
      maintenance: maintenanceIntel(vs, portfolio),
      lifecycle: lifecycleIntel(vs, portfolio),
      financial: financialIntel(vs, portfolio)
    };

    /* ------------------------------------------------------------------ *
     *  1. Executive fleet summary
     * ------------------------------------------------------------------ */
    function fleetSummary(vs, p) {
      const active   = vs.filter(v => v.status === 'Active').length;
      const idle     = vs.filter(v => v.status === 'Idle').length;
      const inShop   = vs.filter(v => v.status === 'In Shop').length;
      const offLease = vs.filter(v => v.status === 'Off-Lease').length;
      const avgUtil  = Math.round(vs.reduce((a, v) => a + v.utilization, 0) / n);
      const avgAge   = +(vs.reduce((a, v) => a + v.ageYears, 0) / n).toFixed(1);
      const avgKm    = Math.round(vs.reduce((a, v) => a + v.odometerKm, 0) / n);
      const nearReplacement = vs.filter(v => v.lifecycleScore < 50).length;
      const highRisk = vs.filter(v =>
        v.lifecycleScore < 35 || v.faults.some(f => f.severity === 'Critical')).length;
      const backlog  = vs.reduce((a, v) => a + v.maintenance.openWorkOrders, 0);
      const monthlyBilling = vs.reduce((a, v) => a + v.lease.monthlyRate, 0);

      // Fleet-average weekly utilization curve (hero + KPI sparklines).
      const weeklyAvg = p.weeks.map((_, i) =>
        Math.round(vs.reduce((a, v) => a + v.utilizationHistory[i], 0) / n));

      // Period-over-period deltas: last 4 weeks vs previous 4.
      const rec4  = weeklyAvg.slice(-4).reduce((a, b) => a + b, 0) / 4;
      const prev4 = weeklyAvg.slice(4, 8).reduce((a, b) => a + b, 0) / 4;

      return {
        total: vs.length, active, idle, inShop, offLease,
        avgUtil, avgAge, avgKm, nearReplacement, highRisk,
        maintenanceBacklog: backlog, monthlyBilling, weeklyAvg,
        trends: {
          utilization: +(rec4 - prev4).toFixed(1),
          active: Math.round((active / n) * 100) - 86,     // vs 86% portfolio target
          backlog: backlog - Math.round(n * 0.11),         // vs rolling norm
          highRisk: highRisk - Math.round(n * 0.05)
        }
      };
    }

    /* ------------------------------------------------------------------ *
     *  2. Utilization intelligence
     * ------------------------------------------------------------------ */
    function utilizationIntel(vs, p) {
      const seg = { high: [], moderate: [], low: [], idle: [] };
      vs.forEach(v => {
        if (v.utilization >= BANDS.high)          seg.high.push(v);
        else if (v.utilization >= BANDS.moderate) seg.moderate.push(v);
        else if (v.utilization >= BANDS.low)      seg.low.push(v);
        else                                      seg.idle.push(v);
      });

      const sorted = vs.slice().sort((a, b) => b.utilization - a.utilization);
      const under = vs.filter(v => v.utilization < 25 && v.status !== 'Off-Lease')
        .sort((a, b) => a.utilization - b.utilization);

      // Lease dollars flowing to under-worked assets = the savings pool a
      // right-sizing / redistribution conversation starts from.
      const monthlyWaste = under.reduce((a, v) => a + Math.round(v.lease.monthlyRate * (1 - v.utilization / 100)), 0);

      // Heatmap: asset class × trailing 12 weeks, mean utilization.
      const classes = p.assetClasses.filter(c => vs.some(v => v.assetClass === c));
      const heat = classes.map(c => {
        const rows = vs.filter(v => v.assetClass === c);
        return p.weeks.map((_, w) =>
          Math.round(rows.reduce((a, v) => a + v.utilizationHistory[w], 0) / (rows.length || 1)));
      });

      return {
        bands: seg,
        top: sorted.slice(0, 8),
        under: under.slice(0, 8),
        underCount: under.length,
        idleCount: seg.idle.length,
        monthlySavings: monthlyWaste,
        heatmap: { rows: classes, cols: p.weeks, values: heat }
      };
    }

    /* ------------------------------------------------------------------ *
     *  3. Maintenance intelligence
     * ------------------------------------------------------------------ */
    function maintenanceIntel(vs, p) {
      const openAlerts = [];
      vs.forEach(v => v.faults.forEach(f => openAlerts.push({ v, f })));
      openAlerts.sort((a, b) => sevRank(b.f.severity) - sevRank(a.f.severity));

      const pmDue = vs.filter(v => v.maintenance.kmToNextPm < 3000 && v.status !== 'Off-Lease')
        .sort((a, b) => a.maintenance.kmToNextPm - b.maintenance.kmToNextPm);

      const highCost = vs.slice()
        .sort((a, b) => b.maintenance.ytdCost - a.maintenance.ytdCost)
        .slice(0, 8);

      const repeats = vs.filter(v => v.maintenance.repeatSystem);

      // Downtime by asset class (90-day, total days).
      const classes = p.assetClasses.filter(c => vs.some(v => v.assetClass === c));
      const downtimeByClass = classes.map(c => ({
        label: c,
        value: vs.filter(v => v.assetClass === c)
          .reduce((a, v) => a + v.maintenance.downtimeDays90d, 0)
      })).sort((a, b) => b.value - a.value);

      // Fleet maintenance spend across the trailing 12 *complete* months
      // (the current partial month would chart as a false drop).
      const now = p.generatedAt;
      const monthly = p.months.map(() => 0);
      vs.forEach(v => v.maintenance.events.forEach(ev => {
        const dm = (now.getFullYear() - ev.date.getFullYear()) * 12 + (now.getMonth() - ev.date.getMonth());
        if (dm >= 1 && dm <= 12) monthly[12 - dm] += ev.cost;
      }));

      const rising = vs.filter(v => v.maintenance.costTrend === 1)
        .sort((a, b) => b.maintenance.ytdCost - a.maintenance.ytdCost);

      return {
        openAlerts,
        criticalCount: openAlerts.filter(a => a.f.severity === 'Critical').length,
        pmDue,
        highCost,
        repeats,
        rising,
        downtimeByClass,
        monthlyCost: monthly,
        totalDowntime90d: vs.reduce((a, v) => a + v.maintenance.downtimeDays90d, 0),
        openWorkOrders: vs.reduce((a, v) => a + v.maintenance.openWorkOrders, 0)
      };
    }

    /* ------------------------------------------------------------------ *
     *  4. Lifecycle intelligence
     * ------------------------------------------------------------------ */
    function lifecycleIntel(vs, p) {
      const byBand = {};
      LIFE_BANDS.forEach(b => { byBand[b.key] = vs.filter(v => v.lifeBand.key === b.key); });

      const candidates = vs.filter(v => v.lifecycleScore < 50)
        .sort((a, b) => a.lifecycleScore - b.lifecycleScore);

      // Replacement runway: forecast the quarter each at-risk unit crosses
      // the replacement threshold, projecting current duty + score decay.
      const quarters = [];
      const now = p.generatedAt;
      for (let q = 0; q < 8; q++) {
        const d = new Date(now.getFullYear(), now.getMonth() + 3 * q, 1);
        quarters.push({
          label: 'Q' + (Math.floor(d.getMonth() / 3) + 1) + ' ' + d.getFullYear(),
          units: [], capex: 0
        });
      }
      vs.forEach(v => {
        if (v.lifecycleScore >= 62 || v.status === 'Off-Lease') return;
        // Score points lost per quarter ≈ duty + age decay; rising maint accelerates it.
        const decay = 2.2 + (v.annualKm / v.norms.lifeKm) * 24 + (v.maintenance.costTrend === 1 ? 1.6 : 0);
        const qToThreshold = Math.max(0, Math.floor((v.lifecycleScore - 35) / decay));
        if (qToThreshold < 8) {
          const q = quarters[qToThreshold];
          q.units.push(v);
          q.capex += estReplacementCost(v);
        }
      });

      return {
        bands: byBand,
        avgScore: Math.round(vs.reduce((a, v) => a + v.lifecycleScore, 0) / n),
        endOfLife: byBand.replace,
        candidates: candidates.slice(0, 10),
        candidateCount: candidates.length,
        forecast: quarters
      };
    }

    /* ------------------------------------------------------------------ *
     *  5. Financial intelligence
     * ------------------------------------------------------------------ */
    function financialIntel(vs, p) {
      const totalTco = vs.reduce((a, v) => a + v.econ.tco, 0);
      const comp = {
        lease: vs.reduce((a, v) => a + v.econ.lease, 0),
        maint: vs.reduce((a, v) => a + v.econ.maint, 0),
        fuel:  vs.reduce((a, v) => a + v.econ.fuel, 0)
      };

      const powered = vs.filter(v => v.powered && v.econ.costPerHour);
      const avgCostPerKm = +(vs.reduce((a, v) => a + v.econ.costPerKm, 0) / n).toFixed(2);
      const avgCostPerHour = powered.length
        ? +(powered.reduce((a, v) => a + v.econ.costPerHour, 0) / powered.length).toFixed(2) : 0;

      // Cost per km by asset class.
      const classes = p.assetClasses.filter(c => vs.some(v => v.assetClass === c));
      const costPerKmByClass = classes.map(c => {
        const rows = vs.filter(v => v.assetClass === c);
        return { label: c, value: +(rows.reduce((a, v) => a + v.econ.costPerKm, 0) / rows.length).toFixed(2) };
      }).sort((a, b) => b.value - a.value);

      // Lease efficiency: utilization delivered per lease dollar, expressed
      // as % of billing attached to working (≥40% utilized) assets.
      const billing = vs.reduce((a, v) => a + v.lease.monthlyRate, 0);
      const workingBilling = vs.filter(v => v.utilization >= 40)
        .reduce((a, v) => a + v.lease.monthlyRate, 0);
      const leaseEfficiency = Math.round((workingBilling / Math.max(billing, 1)) * 100);

      // Replacement ROI: for "replace now" units, compare their current
      // maintenance + downtime burn to a healthy-unit profile.
      const roi = vs.filter(v => v.lifecycleScore < 35).map(v => {
        const currentBurn = v.econ.maint + v.maintenance.downtimeDays90d * 4 * 350; // $350/day downtime cost
        const newBurn = Math.round(v.annualKm * v.norms.normCostKm * 0.55);
        const saving = currentBurn - newBurn;
        return { v, saving, payback: saving > 0 ? +(estReplacementCost(v) * 0.18 / saving).toFixed(1) : null };
      }).filter(r => r.saving > 2500).sort((a, b) => b.saving - a.saving);

      return {
        totalTco, comp, avgCostPerKm, avgCostPerHour,
        costPerKmByClass, leaseEfficiency,
        monthlyBilling: billing,
        idleLeaseSpend: vs.filter(v => v.utilization < 25)
          .reduce((a, v) => a + v.lease.monthlyRate, 0),
        roi: roi.slice(0, 6),
        roiTotal: roi.reduce((a, r) => a + r.saving, 0)
      };
    }
  }

  /** Rough replacement capex per class (used for runway + ROI math). */
  function estReplacementCost(v) {
    const table = {
      'Highway Tractor': 215000, 'Day Cab Tractor': 185000, 'Straight Truck': 145000,
      'Reefer Straight Truck': 175000, 'Dry Van Trailer': 62000, 'Flatbed Trailer': 68000,
      'Cargo Van': 66000, 'Service Pickup': 92000
    };
    return table[v.assetClass] || 100000;
  }

  function sevRank(s) { return s === 'Critical' ? 3 : (s === 'Major' ? 2 : 1); }

  Maxim.InsightEngine = { build, BANDS, LIFE_BANDS, estReplacementCost };

})(window.Maxim = window.Maxim || {});
