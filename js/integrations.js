/**
 * integrations.js
 * ---------------------------------------------------------------------------
 * The "beyond the dashboard" sections:
 *
 *   1. Geotab Data Showcase — every telematics data category available today,
 *      with the business use and the action it can trigger for a lessor.
 *   2. Integration Discovery Center — a structured intake that captures which
 *      business systems Maxim runs, and shows what each unlocks when joined
 *      to Geotab data. Exports a machine-readable integration profile.
 *   3. Customer Industry Templates — future add-in concepts Maxim can offer
 *      its leasing customers, per vertical.
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  /* ------------------------------------------------------------------ *
   *  1. Geotab data showcase
   * ------------------------------------------------------------------ */
  const DATA_CATALOG = [
    { icon: 'pin',      name: 'GPS location',    data: 'Live position, geofence entries, territory coverage',
      use: 'Asset recovery, branch-to-customer proximity, redeployment logistics', action: 'Trigger idle-asset relocation plan' },
    { icon: 'route',    name: 'Trips',           data: 'Start/stop, distance, duration, stop dwell per trip',
      use: 'True utilization per lease, seasonal duty patterns', action: 'Recommend asset redistribution' },
    { icon: 'clock',    name: 'Engine hours',    data: 'Cumulative PTO and engine-on hours',
      use: 'Hour-based PM for vocational units, idle-heavy duty detection', action: 'Forecast maintenance schedules' },
    { icon: 'fuel',     name: 'Fuel usage',      data: 'Fill-ups, consumption rate, L/100km by asset',
      use: 'Fuel-line TCO, outlier burn detection, EV suitability screens', action: 'Flag excess-burn units for service' },
    { icon: 'gauge',    name: 'Idling',          data: 'Idle events, duration, % of engine time',
      use: 'Fuel waste costing, anti-idle policy compliance for customers', action: 'Publish idle scorecard to customer' },
    { icon: 'alert',    name: 'Harsh driving',   data: 'Hard braking, acceleration, cornering exception events',
      use: 'Risk scoring per lease account, insurance evidence', action: 'Open driver-coaching conversation' },
    { icon: 'clipboard',name: 'DVIR',            data: 'Driver inspection reports, defects, sign-offs',
      use: 'Compliance posture per customer, defect-to-repair cycle time', action: 'Auto-create defect work order' },
    { icon: 'route',    name: 'Odometer',        data: 'Continuous odometer feed per asset',
      use: 'Lease-kilometre tracking, PM triggers, remarketing timing', action: 'Bill excess-km, schedule PM' },
    { icon: 'activity', name: 'Fault codes',     data: 'J1939/OBD engine faults with severity, reefer alarms',
      use: 'Predictive maintenance, warranty capture windows', action: 'Trigger service work order' },
    { icon: 'user',     name: 'Driver activity', data: 'Driver ID, HOS status, seatbelt, usage by operator',
      use: 'Duty-cycle attribution, customer safety programs', action: 'Deliver quarterly safety review' },
    { icon: 'battery',  name: 'Asset status',    data: 'Battery/EV state, power connect, tracker health',
      use: 'Yard-asset health, EV readiness, silent-unit detection', action: 'Dispatch tracker maintenance' },
    { icon: 'snow',     name: 'Reefer telematics', data: 'Temperature, setpoint, alarm and door events',
      use: 'Cold-chain compliance proof for food & pharma lessees', action: 'Alert customer before load loss' }
  ];

  function renderShowcase() {
    const { icon, esc } = Maxim.UI;
    $('#data-grid').innerHTML = DATA_CATALOG.map(d => `
      <article class="data-card">
        <div class="data-ic">${icon(d.icon, 20)}</div>
        <h3>${esc(d.name)}</h3>
        <dl>
          <dt>Data available</dt><dd>${esc(d.data)}</dd>
          <dt>Business use</dt><dd>${esc(d.use)}</dd>
        </dl>
        <div class="data-action">${icon('zap', 13)} ${esc(d.action)}</div>
      </article>`).join('');
  }

  /* ------------------------------------------------------------------ *
   *  2. Integration Discovery Center
   * ------------------------------------------------------------------ */
  const SYSTEM_GROUPS = [
    {
      group: 'Fleet systems', icon: 'truck',
      systems: [
        { key: 'asset-mgmt', name: 'Asset management platform',
          unlocks: 'Single asset registry: spec, ownership, warranty and telematics identity joined — no more unit-number reconciliation between systems.' },
        { key: 'inventory', name: 'Vehicle inventory / remarketing system',
          unlocks: 'Live "available to lease" pool with condition scores; remarketing timing driven by lifecycle score instead of age alone.' },
        { key: 'erp', name: 'ERP',
          unlocks: 'Cost roll-ups by customer, branch and asset class; telematics-verified billing inputs (km, hours) flowing straight to invoicing.' },
        { key: 'maintenance', name: 'Maintenance / shop management software',
          unlocks: 'Fault-to-work-order automation, true $/km by component system, and ~35% sharper replacement forecasting from parts & labour history.' },
        { key: 'crm', name: 'CRM',
          unlocks: 'Utilization and lifecycle alerts become account-manager tasks; renewal conversations armed with the customer\'s own operating data.' }
      ]
    },
    {
      group: 'Financial systems', icon: 'dollar',
      systems: [
        { key: 'lease-acct', name: 'Lease accounting platform',
          unlocks: 'Per-contract profitability with real usage against contracted kilometres; early flags on under- and over-utilized terms.' },
        { key: 'depreciation', name: 'Depreciation tracking',
          unlocks: 'Duty-adjusted depreciation curves — assets working harder depreciate on evidence, improving residual forecasting and pricing.' },
        { key: 'financing', name: 'Financing platform',
          unlocks: 'Portfolio risk view: funding cost vs asset health vs utilization, supporting refinancing and fleet-buy decisions.' }
      ]
    },
    {
      group: 'Operational systems', icon: 'layers',
      systems: [
        { key: 'fuel-cards', name: 'Fuel card / fuel management',
          unlocks: 'Transaction-vs-telematics fuel reconciliation (theft/slippage detection) and true fuel line in every TCO figure.' },
        { key: 'vendors', name: 'Service vendor network',
          unlocks: 'Out-of-network repair capture, vendor cost benchmarking by repair code, and automated PO matching to fault events.' },
        { key: 'inspections', name: 'Inspection / compliance systems',
          unlocks: 'DVIR-to-inspection joins for full compliance chains, and defect trends feeding the lifecycle score.' }
      ]
    }
  ];

  function renderDiscovery() {
    const { icon, esc } = Maxim.UI;
    $('#discovery-groups').innerHTML = SYSTEM_GROUPS.map(g => `
      <div class="disc-group">
        <h3 class="disc-group-title">${icon(g.icon, 17)} ${esc(g.group)}</h3>
        ${g.systems.map(s => `
          <div class="disc-row" data-key="${s.key}">
            <div class="disc-main">
              <span class="disc-name">${esc(s.name)}</span>
              <p class="disc-unlocks"><strong>If connected:</strong> ${esc(s.unlocks)}</p>
            </div>
            <div class="disc-inputs">
              <select class="input disc-status" aria-label="Status of ${esc(s.name)}">
                <option value="">In use?</option>
                <option>Yes — in use</option>
                <option>Planned</option>
                <option>Not used</option>
                <option>Unsure</option>
              </select>
              <input class="input disc-vendor" type="text" placeholder="Vendor / product" aria-label="Vendor for ${esc(s.name)}">
            </div>
          </div>`).join('')}
      </div>`).join('');

    // Readiness meter + profile export.
    const update = () => {
      const rows = [...document.querySelectorAll('.disc-row')];
      const answered = rows.filter(r => r.querySelector('.disc-status').value).length;
      const connected = rows.filter(r => r.querySelector('.disc-status').value === 'Yes — in use').length;
      $('#disc-meter-fill').style.width = (answered / rows.length * 100) + '%';
      $('#disc-meter-text').textContent =
        `${answered} of ${rows.length} systems profiled · ${connected} candidate integrations identified`;
    };
    document.querySelectorAll('.disc-status').forEach(s => s.addEventListener('change', update));
    update();

    $('#disc-export').addEventListener('click', () => {
      const profile = [];
      SYSTEM_GROUPS.forEach(g => g.systems.forEach(s => {
        const row = document.querySelector(`.disc-row[data-key="${s.key}"]`);
        profile.push([g.group, s.name,
          row.querySelector('.disc-status').value || 'Unanswered',
          row.querySelector('.disc-vendor').value || '']);
      }));
      Maxim.UI.exportCSV('maxim-integration-profile.csv',
        ['Group', 'System', 'Status', 'Vendor'], profile);
      Maxim.actions.dispatch('crm', { scope: 'integration-profile' }, 'Integration discovery profile submitted');
    });
  }

  /* ------------------------------------------------------------------ *
   *  3. Customer industry templates
   * ------------------------------------------------------------------ */
  const INDUSTRIES = [
    { icon: 'layers', name: 'Construction',
      kpis: ['Equipment hours vs rental cost', 'Site-to-site moves', 'Idle burn on site'],
      concept: 'Jobsite Asset Optimizer — per-project equipment costing from engine hours and geofenced site time.',
      value: 'Bill equipment to the right job automatically; cut rented-but-parked spend.' },
    { icon: 'zap', name: 'Utilities',
      kpis: ['PTO / aerial device hours', 'Storm-response coverage', 'Crew territory time'],
      concept: 'Outage Response Readiness — fleet posture map with boom-truck availability and health by service territory.',
      value: 'Prove regulator response SLAs; right-size seasonal surge fleets.' },
    { icon: 'fuel', name: 'Oil & Gas',
      kpis: ['Lease-road km', 'H2S-zone entries', 'Journey management compliance'],
      concept: 'Field Journey Manager — automated journey logs, remote-site check-ins and fatigue-window alerts.',
      value: 'Contractor-compliance evidence and lower per-site insurance loading.' },
    { icon: 'pin', name: 'Municipal',
      kpis: ['Route completion %', 'Plow/sander coverage', 'Citizen-request response'],
      concept: 'Winter Ops Dashboard — live plow coverage vs route plan, salt usage per lane-km.',
      value: 'Council-ready service-level reporting from data already flowing.' },
    { icon: 'route', name: 'Delivery',
      kpis: ['Stops per hour', 'Door-open dwell', 'Cold-chain integrity'],
      concept: 'Last-Mile Density Analyzer — stop clustering and dwell benchmarking against fleet peers.',
      value: 'Route density gains defer fleet additions — lease the right count, not more.' },
    { icon: 'truck', name: 'Transportation',
      kpis: ['Revenue km vs total km', 'Deadhead %', 'Trailer turn time'],
      concept: 'Trailer Pool Intelligence — turn-time and detention analytics per shipper dock.',
      value: 'Recover detention charges; run the same freight with fewer trailers.' },
    { icon: 'wrench', name: 'Field Service',
      kpis: ['Jobs per day', 'Wrench time vs drive time', 'First-visit fix rate'],
      concept: 'Technician Day Optimizer — drive-vs-site time and territory balancing from trip data.',
      value: 'One extra job per tech-week pays the lease on the van.' }
  ];

  function renderIndustries() {
    const { icon, esc } = Maxim.UI;
    $('#industry-grid').innerHTML = INDUSTRIES.map(d => `
      <article class="ind-card">
        <header>${icon(d.icon, 18)}<h3>${esc(d.name)}</h3></header>
        <dl>
          <dt>Key KPIs</dt><dd><ul>${d.kpis.map(k => `<li>${esc(k)}</li>`).join('')}</ul></dd>
          <dt>Add-in concept</dt><dd>${esc(d.concept)}</dd>
          <dt>Business value</dt><dd>${esc(d.value)}</dd>
        </dl>
      </article>`).join('');
  }

  Maxim.integrations = {
    renderAll() { renderShowcase(); renderDiscovery(); renderIndustries(); },
    DATA_CATALOG, SYSTEM_GROUPS, INDUSTRIES
  };

})(window.Maxim = window.Maxim || {});
