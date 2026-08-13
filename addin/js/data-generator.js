/**
 * data-generator.js
 * ---------------------------------------------------------------------------
 * Sample data layer for the Maxim Fleet Intelligence Hub.
 *
 * Generates a realistic, seeded 500-unit national leasing portfolio:
 * multiple asset classes, branches, leasing customers, utilization history,
 * maintenance records, fault events, fuel profiles and lease economics.
 *
 * The generator is deterministic per seed so the demo is stable between
 * page loads, while the "Refresh data" control can request a new seed to
 * simulate a live re-query. When the add-in is pointed at a live MyGeotab
 * database, this module is simply no longer called — geotab-service.js is
 * the only consumer.
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Seeded pseudo-random helpers (mulberry32) — deterministic per seed
   * ------------------------------------------------------------------ */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------------ *
   *  Portfolio configuration — Maxim branch network, customers, classes
   * ------------------------------------------------------------------ */

  /** Maxim branch network (regions used for segmentation). */
  const REGIONS = [
    'Winnipeg', 'Brandon', 'Regina', 'Saskatoon', 'Calgary',
    'Edmonton', 'Vancouver', 'Mississauga', 'Montréal'
  ];

  /** Fictional leasing customers with an industry tag (feeds the industry templates). */
  const CUSTOMERS = [
    { name: 'Bison Ridge Contracting',   industry: 'Construction'   },
    { name: 'Keystone Aggregates',       industry: 'Construction'   },
    { name: 'Stonebridge Site Services', industry: 'Construction'   },
    { name: 'Northgate Utilities Group', industry: 'Utilities'      },
    { name: 'Tamarack Energy Services',  industry: 'Oil & Gas'      },
    { name: 'City of Whitmore Falls',    industry: 'Municipal'      },
    { name: 'Polaris Parcel Express',    industry: 'Delivery'       },
    { name: 'Seine River Distribution',  industry: 'Delivery'       },
    { name: 'Aspen Creek Foods',         industry: 'Delivery'       },
    { name: 'Red River Cold Chain',      industry: 'Delivery'       },
    { name: 'Prairie Grain Logistics',   industry: 'Transportation' },
    { name: 'Lakehead Freight Systems',  industry: 'Transportation' },
    { name: 'Boreal Forest Products',    industry: 'Transportation' },
    { name: 'Wheatland Co-op Fuels',     industry: 'Oil & Gas'      },
    { name: 'Glacier West Mechanical',   industry: 'Field Service'  },
    { name: 'Chinook Field Services',    industry: 'Field Service'  }
  ];

  /**
   * Asset class definitions. Counts sum to exactly 500.
   * `powered:false` marks trailers (asset trackers: no engine hours / fuel).
   * `normCostKm` is the healthy-fleet maintenance $/km norm used for scoring.
   */
  const ASSET_CLASSES = [
    { name: 'Highway Tractor',  count: 110, powered: true,  kmYr: [95000, 150000], rate: [4300, 5800], fuel: [34, 42], lifeKm: 1350000, lifeYrs: 11, normCostKm: 0.145, utilBase: 74, season: [4, 0],
      makes: [['Freightliner', 'Cascadia'], ['Volvo', 'VNL 760'], ['Kenworth', 'T680'], ['Peterbilt', '579'], ['International', 'LT625']] },
    { name: 'Day Cab Tractor',  count: 55,  powered: true,  kmYr: [55000, 95000],  rate: [3500, 4600], fuel: [36, 45], lifeKm: 1100000, lifeYrs: 12, normCostKm: 0.15, utilBase: 66, season: [5, 1],
      makes: [['Freightliner', 'Cascadia 116'], ['Mack', 'Anthem'], ['International', 'LT Day Cab'], ['Kenworth', 'T880']] },
    { name: 'Straight Truck',   count: 70,  powered: true,  kmYr: [28000, 60000],  rate: [2300, 3200], fuel: [22, 30], lifeKm: 600000,  lifeYrs: 12, normCostKm: 0.13, utilBase: 58, season: [3, 2],
      makes: [['Hino', 'L6'], ['International', 'MV607'], ['Freightliner', 'M2 106'], ['Isuzu', 'FTR']] },
    { name: 'Reefer Straight Truck', count: 40, powered: true, kmYr: [30000, 65000], rate: [2900, 3900], fuel: [25, 33], lifeKm: 550000, lifeYrs: 10, normCostKm: 0.17, utilBase: 69, season: [7, 3],
      makes: [['Hino', 'L6 Reefer'], ['Freightliner', 'M2 Reefer'], ['International', 'MV Reefer']] },
    { name: 'Dry Van Trailer',  count: 95,  powered: false, kmYr: [40000, 110000], rate: [750, 1050],  fuel: null,     lifeKm: 1600000, lifeYrs: 15, normCostKm: 0.035, utilBase: 55, season: [6, 4],
      makes: [['Utility', '4000D-X'], ['Great Dane', 'Champion'], ['Wabash', 'DuraPlate'], ['Manac', 'Dry Van 53']] },
    { name: 'Flatbed Trailer',  count: 45,  powered: false, kmYr: [30000, 90000],  rate: [800, 1200],  fuel: null,     lifeKm: 1400000, lifeYrs: 15, normCostKm: 0.04, utilBase: 47, season: [10, 5],
      makes: [['Manac', 'Flatbed 48'], ['Lode King', 'Renown'], ['Doepker', 'Legacy']] },
    { name: 'Cargo Van',        count: 55,  powered: true,  kmYr: [18000, 45000],  rate: [1250, 1750], fuel: [12, 16], lifeKm: 350000,  lifeYrs: 8,  normCostKm: 0.10, utilBase: 52, season: [3, 0.5],
      makes: [['Ford', 'Transit 250'], ['RAM', 'ProMaster 2500'], ['Mercedes-Benz', 'Sprinter 2500'], ['GMC', 'Savana 2500']] },
    { name: 'Service Pickup',   count: 30,  powered: true,  kmYr: [15000, 40000],  rate: [1050, 1500], fuel: [13, 18], lifeKm: 320000,  lifeYrs: 8,  normCostKm: 0.09, utilBase: 43, season: [5, 2.5],
      makes: [['Ford', 'F-550 Service'], ['RAM', '5500 Service'], ['Chevrolet', 'Silverado 3500HD']] }
  ];

  /** Maintenance event catalogue: [type, cost range, downtime-days range, system]. */
  const MAINT_EVENTS = [
    ['PM Service (A)',            [350, 700],    [0, 1], 'Preventive'],
    ['PM Service (B)',            [900, 1800],   [1, 2], 'Preventive'],
    ['Brake reline & drums',      [1800, 4200],  [1, 3], 'Brakes'],
    ['Aftertreatment / DPF regen',[1200, 6500],  [1, 4], 'Aftertreatment'],
    ['EGR valve replacement',     [1500, 3800],  [1, 3], 'Aftertreatment'],
    ['Coolant system repair',     [600, 2600],   [1, 2], 'Cooling'],
    ['Electrical / harness',      [400, 2200],   [0, 2], 'Electrical'],
    ['Tire replacement (set)',    [1600, 5400],  [0, 1], 'Tires'],
    ['Suspension / airbag',       [900, 3200],   [1, 2], 'Suspension'],
    ['Transmission service',      [1400, 7800],  [2, 5], 'Driveline'],
    ['Turbocharger replacement',  [3800, 8200],  [2, 5], 'Engine'],
    ['Reefer unit service',       [700, 3900],   [1, 3], 'Reefer'],
    ['Liftgate repair',           [500, 2400],   [1, 2], 'Body'],
    ['Body / door repair',        [350, 2900],   [0, 2], 'Body']
  ];

  /** Realistic fault-code catalogue: [code, description, severity]. */
  const FAULT_CODES = [
    ['SPN 3719 FMI 0',  'DPF soot load — regeneration required',     'Major'],
    ['SPN 100 FMI 1',   'Engine oil pressure low',                   'Critical'],
    ['SPN 110 FMI 0',   'Engine coolant temperature high',           'Critical'],
    ['SPN 597 FMI 2',   'Brake switch circuit fault',                'Major'],
    ['SPN 1569 FMI 31', 'Engine derate active — emissions system',   'Critical'],
    ['SPN 168 FMI 1',   'Battery voltage low',                       'Minor'],
    ['SPN 4364 FMI 18', 'SCR NOx conversion efficiency low',         'Major'],
    ['P0401',           'EGR flow insufficient',                     'Major'],
    ['P0128',           'Coolant thermostat below regulating temp',  'Minor'],
    ['C0265',           'ABS module relay circuit',                  'Major'],
    ['B1317',           'Cab body control voltage high',             'Minor'],
    ['ThermoKing A17',  'Reefer high discharge pressure',            'Major'],
    ['SPN 639 FMI 14',  'J1939 network communication fault',         'Minor'],
    ['SPN 96 FMI 3',    'Fuel level sensor circuit',                 'Minor']
  ];

  /* ------------------------------------------------------------------ *
   *  Generator
   * ------------------------------------------------------------------ */

  /**
   * Build a full sample portfolio.
   * @param {number} seed - RNG seed; identical seeds produce identical fleets.
   * @returns {object} portfolio { vehicles, weeks, months, fuelPrice, generatedAt, seed }
   */
  function generatePortfolio(seed) {
    const rnd = mulberry32(seed);
    const rand  = (min, max) => min + rnd() * (max - min);
    const randi = (min, max) => Math.floor(rand(min, max + 1));
    /** Bell-ish distribution: average of two uniforms. */
    const randn = (min, max) => (rand(min, max) + rand(min, max)) / 2;
    const pick  = (arr) => arr[Math.floor(rnd() * arr.length)];
    const chance = (p) => rnd() < p;

    const now = new Date();

    // Trailing 12 ISO week labels (used by the utilization heatmap) and
    // trailing 12 month labels (used by maintenance/financial trends).
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
      const d = new Date(now.getTime() - w * 7 * 86400000);
      weeks.push(d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }));
    }
    // Trailing 12 *complete* months — the current partial month would render
    // as a false cliff on trend charts.
    const months = [];
    for (let m = 12; m >= 1; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      months.push(d.toLocaleDateString('en-CA', { month: 'short', year: '2-digit' }));
    }

    const vehicles = [];
    let unitNo = 1001;

    ASSET_CLASSES.forEach((cls) => {
      for (let i = 0; i < cls.count; i++) {
        const [make, model] = pick(cls.makes);

        // --- Age & duty cycle -------------------------------------------------
        const ageYears = +randn(0.6, Math.min(cls.lifeYrs + 1.5, 11)).toFixed(1);
        const inService = new Date(now.getTime() - ageYears * 365.25 * 86400000);
        const year = inService.getFullYear();
        const annualKm = Math.round(randn(cls.kmYr[0], cls.kmYr[1]) / 500) * 500;
        const odometerKm = Math.round(annualKm * ageYears * rand(0.88, 1.12));
        const engineHours = cls.powered ? Math.round(odometerKm / rand(42, 58)) : null;

        // --- Utilization ------------------------------------------------------
        // Each class has a duty-cycle personality (base level + seasonal wave);
        // a deliberate slice of every class under-performs so the utilization
        // intelligence has something real to find.
        let baseUtil;
        const utilRoll = rnd();
        if (utilRoll < 0.07)      baseUtil = rand(1, 9);                            // effectively parked
        else if (utilRoll < 0.19) baseUtil = rand(11, 28);                          // under-utilized
        else                      baseUtil = randn(cls.utilBase - 16, cls.utilBase + 20); // class norm
        // season: [amplitude, phase] — e.g. flatbeds peak in construction season.
        const utilizationHistory = weeks.map((_, w) => {
          const seasonal = cls.season[0] * Math.sin((w / 12) * Math.PI * 2 + cls.season[1]);
          return Math.max(0, Math.min(100, Math.round(baseUtil + seasonal + rand(-9, 9))));
        });
        const utilization = Math.round(
          utilizationHistory.slice(-4).reduce((a, b) => a + b, 0) / 4);

        // --- Lease economics --------------------------------------------------
        // Leases renew: remaining term wraps within the current cycle, with a
        // small slice of the fleet genuinely at end of contract.
        const leaseTermMonths = pick([48, 60, 60, 72, 72, 84]);
        const monthsElapsed = Math.round(ageYears * 12) % leaseTermMonths;
        const leaseMonthsRemaining = chance(0.03) ? 0 : leaseTermMonths - monthsElapsed;
        const monthlyRate = Math.round(randn(cls.rate[0], cls.rate[1]) / 25) * 25;

        // --- Maintenance history ---------------------------------------------
        // Event frequency and cost climb with age; a small set of units gets a
        // "chronic" multiplier so repeat-failure detection has real targets.
        const chronic = chance(0.07);
        const eventCount = Math.max(1, Math.round(randn(1, 3) + ageYears * 0.9 + (chronic ? 3 : 0)));
        const events = [];
        let ytdCost = 0, downtimeDays90d = 0;
        const chronicSystem = chronic ? pick(MAINT_EVENTS.filter(e => e[3] !== 'Preventive'))[3] : null;
        for (let e = 0; e < eventCount; e++) {
          let ev = pick(MAINT_EVENTS);
          if (!cls.powered)      ev = pick(MAINT_EVENTS.filter(x => ['Brakes', 'Tires', 'Suspension', 'Body', 'Electrical', 'Preventive'].includes(x[3])));
          if (cls.name !== 'Reefer Straight Truck' && ev[3] === 'Reefer') ev = MAINT_EVENTS[0];
          if (chronic && e % 2 === 0) ev = MAINT_EVENTS.find(x => x[3] === chronicSystem) || ev;
          const ageFactor = 1 + (ageYears / cls.lifeYrs) * 1.4;   // older = costlier repairs
          const cost = Math.round(rand(ev[1][0], ev[1][1]) * ageFactor / 10) * 10;
          const dt = randi(ev[2][0], ev[2][1]);
          const daysAgo = randi(3, 360);
          events.push({
            date: new Date(now.getTime() - daysAgo * 86400000),
            type: ev[0], system: ev[3], cost, downtimeDays: dt
          });
          if (daysAgo <= 240) ytdCost += cost;          // rough calendar-YTD window
          if (daysAgo <= 90)  downtimeDays90d += dt;
        }
        events.sort((a, b) => b.date - a.date);

        // Repeat failure: 3+ non-PM events on the same system in the window.
        const bySystem = {};
        events.forEach(ev => { if (ev.system !== 'Preventive') bySystem[ev.system] = (bySystem[ev.system] || 0) + 1; });
        const repeatSystem = Object.keys(bySystem).find(s => bySystem[s] >= 3) || null;

        // Cost trend: -1 improving, 0 flat, +1 rising. Old + chronic skews rising.
        const trendRoll = rnd() + ageYears / cls.lifeYrs * 0.55 + (chronic ? 0.3 : 0);
        const costTrend = trendRoll > 1.05 ? 1 : (trendRoll < 0.45 ? -1 : 0);

        const kmSincePm = randi(2000, cls.powered ? 24000 : 40000);
        const pmIntervalKm = cls.powered ? 25000 : 45000;

        // --- Active faults & inspections --------------------------------------
        const faults = [];
        const faultP = 0.06 + ageYears / cls.lifeYrs * 0.22 + (chronic ? 0.22 : 0);
        if (cls.powered && chance(faultP)) {
          const n = chance(0.3) ? 2 : 1;
          for (let f = 0; f < n; f++) {
            const fc = pick(FAULT_CODES.filter(x =>
              cls.name === 'Reefer Straight Truck' || !x[0].startsWith('ThermoKing')));
            faults.push({
              code: fc[0], desc: fc[1], severity: fc[2],
              date: new Date(now.getTime() - randi(0, 21) * 86400000)
            });
          }
        }
        const dvirDefects90d = chance(0.18) ? randi(1, 4) : 0;

        // --- Status ------------------------------------------------------------
        let status = 'Active';
        if (utilization < 5 && chance(0.75)) status = 'Idle';
        else if (chance(0.035)) status = 'In Shop';
        else if (leaseMonthsRemaining === 0) status = 'Off-Lease';

        vehicles.push({
          id: 'b' + unitNo,
          unit: 'MX-' + unitNo,
          vin: makeVin(rnd),
          assetClass: cls.name,
          powered: cls.powered,
          make, model, year,
          region: pick(REGIONS),
          customer: pickCustomer(cls.name, rnd),
          status,
          inServiceDate: inService,
          ageYears,
          annualKm,
          odometerKm,
          engineHours,
          utilization,
          utilizationHistory,
          idlePct: cls.powered ? +rand(4, 34).toFixed(1) : null,
          fuelL100: cls.powered ? +randn(cls.fuel[0], cls.fuel[1]).toFixed(1) : null,
          harshEvents90d: cls.powered ? randi(0, 26) : 0,
          dvirDefects90d,
          faults,
          lease: {
            termMonths: leaseTermMonths,
            monthsRemaining: leaseMonthsRemaining,
            monthlyRate,
            estResidual: Math.round(monthlyRate * leaseTermMonths * rand(0.16, 0.30) / 100) * 100
          },
          maintenance: {
            ytdCost,
            costPerKm: +(ytdCost / Math.max(annualKm * 0.66, 1)).toFixed(3),
            events,
            openWorkOrders: status === 'In Shop' ? randi(1, 2) : (chance(0.07) ? 1 : 0),
            kmToNextPm: Math.max(0, pmIntervalKm - kmSincePm),
            downtimeDays90d,
            costTrend,
            repeatSystem
          },
          // Class norms carried on the record so downstream engines don't
          // need to re-join against ASSET_CLASSES.
          norms: { lifeKm: cls.lifeKm, lifeYrs: cls.lifeYrs, normCostKm: cls.normCostKm }
        });
        unitNo++;
      }
    });

    return {
      seed,
      generatedAt: now,
      fuelPrice: 1.72,            // CAD $/L diesel assumption used in TCO math
      weeks,
      months,
      vehicles,
      regions: REGIONS.slice(),
      customers: CUSTOMERS.slice(),
      assetClasses: ASSET_CLASSES.map(c => c.name)
    };

    /** Customers are weighted toward classes their industry would lease. */
    function pickCustomer(className, rng) {
      const freight = ['Prairie Grain Logistics', 'Lakehead Freight Systems', 'Boreal Forest Products', 'Wheatland Co-op Fuels'];
      const urban   = ['Polaris Parcel Express', 'Seine River Distribution', 'Aspen Creek Foods', 'Red River Cold Chain'];
      const trades  = ['Bison Ridge Contracting', 'Keystone Aggregates', 'Stonebridge Site Services', 'Northgate Utilities Group',
                       'Tamarack Energy Services', 'City of Whitmore Falls', 'Glacier West Mechanical', 'Chinook Field Services'];
      let pool;
      if (['Highway Tractor', 'Day Cab Tractor', 'Dry Van Trailer', 'Flatbed Trailer'].includes(className)) {
        pool = rng() < 0.75 ? freight : trades;
      } else if (['Cargo Van', 'Service Pickup'].includes(className)) {
        pool = rng() < 0.6 ? trades : urban;
      } else {
        pool = rng() < 0.7 ? urban : freight;
      }
      const name = pool[Math.floor(rng() * pool.length)];
      return CUSTOMERS.find(c => c.name === name);
    }
  }

  /** 17-char VIN-like string (excludes I/O/Q as real VINs do). */
  function makeVin(rng) {
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    let v = '';
    for (let i = 0; i < 17; i++) v += chars[Math.floor(rng() * chars.length)];
    return v;
  }

  Maxim.DataGenerator = { generatePortfolio };

})(window.Maxim = window.Maxim || {});
