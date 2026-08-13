/**
 * dashboard.js
 * ---------------------------------------------------------------------------
 * Section renderers for the Maxim Fleet Intelligence Hub.
 *
 * Consumes the intelligence model produced by insights.js and paints every
 * dashboard section: hero summary, fleet KPIs, utilization, maintenance,
 * lifecycle, financial, AI recommendations and the Action Center. Also owns
 * the vehicle detail modal and the KPI drill-down drawers.
 *
 * All renderers are idempotent — they fully repaint their container — so the
 * app can re-render on refresh, filter change, theme change and resize.
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  let model = null;       // current intelligence model (set by renderAll)

  const U = () => Maxim.UI;
  const $ = (sel) => document.querySelector(sel);

  /** Render every section from a fresh model. */
  function renderAll(m) {
    model = m;
    renderHero(m);
    renderKpis(m);
    renderUtilization(m);
    renderMaintenance(m);
    renderLifecycle(m);
    renderFinancial(m);
    renderRecommendations(m);
    renderActionCenter();
  }

  /* ------------------------------------------------------------------ *
   *  Hero — executive command deck
   * ------------------------------------------------------------------ */
  function renderHero(m) {
    const { fmt, sparkline } = U();
    const f = m.fleet;
    const flagged = f.highRisk + m.utilization.underCount + f.maintenanceBacklog;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    $('#hero-narrative').innerHTML =
      `${greet}. The leased portfolio is running at <strong>${f.avgUtil}% average utilization</strong> across
       <strong>${fmt.int(f.total)} assets</strong> in ${new Set(m.vehicles.map(v => v.region)).size} branch regions.
       <strong>${fmt.int(flagged)} items need attention</strong> this week —
       ${m.lifecycle.endOfLife.length} replacement candidates, ${m.utilization.underCount} under-utilized units and
       ${m.maintenance.criticalCount} active critical faults.`;

    $('#hero-stats').innerHTML = `
      <div class="pulse"><span class="pulse-label">Assets under lease</span><span class="pulse-value">${fmt.int(f.total)}</span><span class="pulse-sub">${fmt.int(f.active)} active today</span></div>
      <div class="pulse"><span class="pulse-label">Monthly lease billing</span><span class="pulse-value">${fmt.moneyC(f.monthlyBilling)}</span><span class="pulse-sub">${fmt.moneyC(f.monthlyBilling * 12)} annualized</span></div>
      <div class="pulse"><span class="pulse-label">Fleet utilization · 12 wk</span><span class="pulse-value">${f.avgUtil}%</span><span class="pulse-spark">${sparkline(f.weeklyAvg, { width: 130, height: 34, color: '#5598e7' })}</span></div>
      <div class="pulse pulse-alert"><span class="pulse-label">Flagged for action</span><span class="pulse-value">${fmt.int(flagged)}</span><span class="pulse-sub">across lifecycle · utilization · service</span></div>`;

    $('#hero-meta').textContent =
      `Data as of ${fmt.date(m.portfolio.generatedAt)} · sample portfolio simulating live MyGeotab feeds (Device, Trip, StatusData, FaultData)`;
  }

  /* ------------------------------------------------------------------ *
   *  Fleet KPI grid
   * ------------------------------------------------------------------ */
  function renderKpis(m) {
    const { fmt, kpiCard } = U();
    const f = m.fleet;
    const host = $('#kpi-grid');
    host.innerHTML = '';

    const cards = [
      { label: 'Total leased vehicles', value: fmt.int(f.total), icon: 'truck', sub: 'national portfolio', onClick: () => drill('all') },
      { label: 'Active vehicles', value: fmt.int(f.active), icon: 'zap', delta: f.trends.active, deltaSuffix: ' pts', goodWhen: 'up', sub: 'vs 86% target' },
      { label: 'Inactive / idle', value: fmt.int(f.idle + f.offLease), icon: 'clock', sub: `${f.idle} idle · ${f.offLease} off-lease`, onClick: () => drill('idle') },
      { label: 'Average utilization', value: f.avgUtil + '%', icon: 'gauge', delta: f.trends.utilization, deltaSuffix: ' pts', goodWhen: 'up', spark: f.weeklyAvg, sub: '4-wk vs prior 4-wk' },
      { label: 'Approaching replacement', value: fmt.int(f.nearReplacement), icon: 'refresh', sub: 'lifecycle score < 50', onClick: () => drill('replacement') },
      { label: 'High-risk assets', value: fmt.int(f.highRisk), icon: 'alert', delta: f.trends.highRisk, goodWhen: 'down', sub: 'critical fault or score < 35', onClick: () => drill('highrisk') },
      { label: 'Maintenance backlog', value: fmt.int(f.maintenanceBacklog), icon: 'wrench', delta: f.trends.backlog, goodWhen: 'down', sub: 'open work orders', onClick: () => drill('backlog') },
      { label: 'Average age', value: f.avgAge + ' yrs', icon: 'calendar', sub: 'in-service basis' },
      { label: 'Average mileage', value: fmt.kmC(f.avgKm), icon: 'route', sub: 'odometer feed' }
    ];
    cards.forEach(c => host.appendChild(kpiCard(c)));
  }

  /* ------------------------------------------------------------------ *
   *  Utilization intelligence
   * ------------------------------------------------------------------ */
  function renderUtilization(m) {
    const { fmt, compositionBar, heatmap, table, badge } = U();
    const u = m.utilization;

    compositionBar($('#util-bands'), [
      { label: 'High (75%+)', value: u.bands.high.length, onClick: () => drillList('High utilization (75%+)', u.bands.high) },
      { label: 'Moderate (40–74%)', value: u.bands.moderate.length, onClick: () => drillList('Moderate utilization', u.bands.moderate) },
      { label: 'Low (10–39%)', value: u.bands.low.length, onClick: () => drillList('Low utilization', u.bands.low) },
      { label: 'Idle (<10%)', value: u.bands.idle.length, onClick: () => drillList('Idle assets', u.bands.idle) }
    ], { fmtVal: fmt.int });

    $('#util-callout').innerHTML = `
      <div class="callout-num">${u.underCount}</div>
      <div class="callout-body"><strong>${u.underCount} vehicles have utilization below 25%.</strong>
      Lease spend attached to this parked capacity is <strong>${fmt.money(u.monthlySavings)}/month</strong> —
      the addressable pool for redistribution, seasonal flex terms or fleet right-sizing.</div>
      <div class="callout-actions">
        <button type="button" class="btn btn-sm" data-action="crm" data-scope="under-utilized">Create CRM tasks</button>
        <button type="button" class="btn btn-sm btn-ghost" data-drill="under">View all ${u.underCount}</button>
      </div>`;

    heatmap($('#util-heatmap'), u.heatmap);

    const utilCols = [
      { key: 'unit', label: 'Unit', fmt: r => `<span class="mono">${r.unit}</span>` },
      { key: 'assetClass', label: 'Class' },
      { key: 'customer', label: 'Customer', sortVal: r => r.customer.name, fmt: r => U().esc(r.customer.name) },
      { key: 'region', label: 'Branch' },
      { key: 'utilization', label: 'Util 30d', align: 'right', fmt: r => `<strong>${r.utilization}%</strong>` },
      { key: 'status', label: 'Status', fmt: r => badge(r.status) }
    ];
    table($('#util-top'), { columns: utilCols, rows: u.top, defaultSort: 'utilization', onRow: r => openVehicle(r.id) });
    table($('#util-under'), {
      columns: utilCols.slice(0, 5).concat([{
        key: 'waste', label: 'Idle spend/mo', align: 'right',
        sortVal: r => r.lease.monthlyRate * (1 - r.utilization / 100),
        fmt: r => fmt.money(r.lease.monthlyRate * (1 - r.utilization / 100))
      }]),
      rows: u.under, onRow: r => openVehicle(r.id)
    });
  }

  /* ------------------------------------------------------------------ *
   *  Maintenance intelligence
   * ------------------------------------------------------------------ */
  function renderMaintenance(m) {
    const { fmt, lineChart, hBarChart, table, badge, icon } = U();
    const mt = m.maintenance;

    $('#maint-stats').innerHTML = `
      <div class="stat"><span class="stat-v">${mt.openAlerts.length}</span><span class="stat-l">open fault alerts</span><span class="stat-s">${mt.criticalCount} critical</span></div>
      <div class="stat"><span class="stat-v">${mt.pmDue.length}</span><span class="stat-l">PM due &lt; 3,000 km</span><span class="stat-s">odometer-triggered</span></div>
      <div class="stat"><span class="stat-v">${mt.openWorkOrders}</span><span class="stat-l">open work orders</span><span class="stat-s">shop backlog</span></div>
      <div class="stat"><span class="stat-v">${fmt.int(mt.totalDowntime90d)}</span><span class="stat-l">downtime days · 90d</span><span class="stat-s">≈ ${fmt.moneyC(mt.totalDowntime90d * 350)} customer impact</span></div>`;

    lineChart($('#maint-trend'), m.portfolio.months, mt.monthlyCost,
      { fmtVal: fmt.money, title: 'Fleet maintenance spend, trailing 12 months' });

    hBarChart($('#maint-downtime'), mt.downtimeByClass.slice(0, 6).map(d =>
      ({ label: d.label, value: d.value, tip: `<strong>${d.label}</strong><br>${d.value} downtime days in 90 days` })),
      { fmtVal: n => n + ' d', title: 'Downtime days by asset class, 90 days' });

    // Open alerts feed (top 6 by severity).
    $('#maint-alerts').innerHTML = mt.openAlerts.slice(0, 6).map(a => `
      <div class="alert-row">
        <span class="alert-sev">${badge(a.f.severity)}</span>
        <div class="alert-main">
          <span class="mono alert-unit">${a.v.unit}</span>
          <span class="alert-desc"><span class="mono">${a.f.code}</span> — ${U().esc(a.f.desc)}</span>
          <span class="alert-sub">${U().esc(a.v.assetClass)} · ${U().esc(a.v.customer.name)} · ${U().esc(a.v.region)}</span>
        </div>
        <div class="alert-act">
          <button type="button" class="btn btn-sm" data-action="maintenance" data-scope="${a.v.unit}">${icon('wrench', 14)} Work order</button>
          <button type="button" class="btn btn-sm btn-ghost" data-vehicle="${a.v.id}">Detail</button>
        </div>
      </div>`).join('') || '<p class="empty">No open fault alerts in the current filter.</p>';

    // High-cost / rising-trend table.
    table($('#maint-cost-table'), {
      columns: [
        { key: 'unit', label: 'Unit', fmt: r => `<span class="mono">${r.unit}</span>` },
        { key: 'assetClass', label: 'Class' },
        { key: 'ytd', label: 'Maint. YTD', align: 'right', sortVal: r => r.maintenance.ytdCost, fmt: r => fmt.money(r.maintenance.ytdCost) },
        { key: 'cpk', label: '$/km', align: 'right', sortVal: r => r.maintenance.costPerKm, fmt: r => '$' + r.maintenance.costPerKm.toFixed(2) },
        { key: 'trend', label: 'Trend', sortVal: r => r.maintenance.costTrend, fmt: r => r.maintenance.costTrend === 1 ? '<span class="trend bad">rising</span>' : (r.maintenance.costTrend === -1 ? '<span class="trend good">improving</span>' : '<span class="trend flat">flat</span>') },
        { key: 'repeat', label: 'Repeat failure', fmt: r => r.maintenance.repeatSystem ? badge(r.maintenance.repeatSystem, 'serious') : '<span class="muted">—</span>' }
      ],
      rows: mt.highCost, defaultSort: 'ytd', onRow: r => openVehicle(r.id)
    });

    const worst = mt.rising[0];
    $('#maint-callout').innerHTML = worst ? `
      <div class="callout-num">${U().icon('trendUp', 26)}</div>
      <div class="callout-body"><strong>Replace unit ${worst.unit} — maintenance trend is rising.</strong>
      ${fmt.money(worst.maintenance.ytdCost)} YTD on a ${worst.year} ${U().esc(worst.make)} ${U().esc(worst.model)}
      at ${fmt.kmC(worst.odometerKm)}${worst.maintenance.repeatSystem ? `, with repeat ${worst.maintenance.repeatSystem.toLowerCase()} failures` : ''}.
      Lifecycle score ${worst.lifecycleScore} puts it in the "${worst.lifeBand.label}" band.</div>
      <div class="callout-actions">
        <button type="button" class="btn btn-sm" data-action="proposal" data-scope="${worst.unit}">Replacement proposal</button>
        <button type="button" class="btn btn-sm btn-ghost" data-vehicle="${worst.id}">Open unit</button>
      </div>` : '';
  }

  /* ------------------------------------------------------------------ *
   *  Lifecycle intelligence
   * ------------------------------------------------------------------ */
  function renderLifecycle(m) {
    const { fmt, compositionBar, table, badge, STATUS } = U();
    const l = m.lifecycle;

    $('#life-score').innerHTML = `
      <span class="life-avg">${l.avgScore}</span>
      <span class="life-avg-label">fleet average lifecycle score<br><span class="muted">age · duty · maintenance · downtime · condition</span></span>`;

    compositionBar($('#life-bands'), [
      { label: 'Healthy (70+)', value: l.bands.healthy.length, color: STATUS.good, onClick: () => drillList('Healthy assets', l.bands.healthy) },
      { label: 'Monitor (50–69)', value: l.bands.monitor.length, color: STATUS.warning, onClick: () => drillList('Monitor band', l.bands.monitor) },
      { label: 'Plan (35–49)', value: l.bands.plan.length, color: STATUS.serious, onClick: () => drillList('Plan replacement', l.bands.plan) },
      { label: 'Replace now (<35)', value: l.bands.replace.length, color: STATUS.critical, onClick: () => drillList('Replace now', l.bands.replace) }
    ], { fmtVal: fmt.int });

    // Replacement runway — the signature element: quarterly forecast lane.
    const maxUnits = Math.max(...l.forecast.map(q => q.units.length), 1);
    $('#life-runway').innerHTML = `
      <div class="runway" role="img" aria-label="Forecasted replacement schedule, next 8 quarters">
        ${l.forecast.map((q) => `
          <div class="rw-q" data-q="${q.label}">
            <div class="rw-bar-zone"><div class="rw-bar" style="height:${Math.max(6, q.units.length / maxUnits * 100)}%"><span class="rw-count">${q.units.length}</span></div></div>
            <div class="rw-tick"></div>
            <div class="rw-label">${q.label}</div>
            <div class="rw-capex">${q.capex ? fmt.moneyC(q.capex) : '—'}</div>
          </div>`).join('')}
        <div class="rw-lane" aria-hidden="true"></div>
      </div>`;
    $('#life-runway').querySelectorAll('.rw-q').forEach((qEl, i) => {
      const q = l.forecast[i];
      U().bindTip(qEl, `<strong>${q.label}</strong><br>${q.units.length} units forecast to cross the replacement threshold<br>Est. capex ${fmt.money(q.capex)}${q.units.length ? '<br><span class="muted">' + q.units.slice(0, 5).map(v => v.unit).join(', ') + (q.units.length > 5 ? '…' : '') + '</span>' : ''}`);
      qEl.addEventListener('click', () => q.units.length && drillList('Forecast ' + q.label, q.units));
    });

    table($('#life-candidates'), {
      columns: [
        { key: 'unit', label: 'Unit', fmt: r => `<span class="mono">${r.unit}</span>` },
        { key: 'assetClass', label: 'Class' },
        { key: 'year', label: 'Year', align: 'right' },
        { key: 'odo', label: 'Odometer', align: 'right', sortVal: r => r.odometerKm, fmt: r => fmt.kmC(r.odometerKm) },
        { key: 'score', label: 'Score', align: 'right', sortVal: r => r.lifecycleScore, fmt: r => `<strong>${r.lifecycleScore}</strong>` },
        { key: 'band', label: 'Band', sortVal: r => r.lifecycleScore, fmt: r => badge(r.lifeBand.label) },
        { key: 'act', label: '', fmt: r => `<button type="button" class="btn btn-sm" data-action="proposal" data-scope="${r.unit}">Proposal</button>` }
      ],
      rows: l.candidates, defaultSort: 'score', onRow: r => openVehicle(r.id)
    });
    // Flip default sort so worst scores lead.
    const firstTh = $('#life-candidates th[data-key="score"]');
    if (firstTh) firstTh.click();
  }

  /* ------------------------------------------------------------------ *
   *  Financial intelligence
   * ------------------------------------------------------------------ */
  function renderFinancial(m) {
    const { fmt, compositionBar, hBarChart, table } = U();
    const fin = m.financial;

    $('#fin-stats').innerHTML = `
      <div class="stat"><span class="stat-v">${fmt.moneyC(fin.totalTco)}</span><span class="stat-l">est. annual TCO</span><span class="stat-s">lease + maintenance + fuel</span></div>
      <div class="stat"><span class="stat-v">$${fin.avgCostPerKm.toFixed(2)}</span><span class="stat-l">avg cost per km</span><span class="stat-s">portfolio mean</span></div>
      <div class="stat"><span class="stat-v">$${fin.avgCostPerHour.toFixed(2)}</span><span class="stat-l">avg cost per engine hour</span><span class="stat-s">powered assets</span></div>
      <div class="stat"><span class="stat-v">${fin.leaseEfficiency}%</span><span class="stat-l">lease utilization efficiency</span><span class="stat-s">${fmt.moneyC(fin.idleLeaseSpend)}/mo on low-work assets</span></div>`;

    compositionBar($('#fin-comp'), [
      { label: 'Lease', value: fin.comp.lease },
      { label: 'Maintenance', value: fin.comp.maint },
      { label: 'Fuel', value: fin.comp.fuel }
    ], { fmtVal: fmt.moneyC });

    hBarChart($('#fin-costkm'), fin.costPerKmByClass.map(d =>
      ({ label: d.label, value: d.value, tip: `<strong>${d.label}</strong><br>$${d.value.toFixed(2)} per km (all-in)` })),
      { fmtVal: n => '$' + n.toFixed(2), title: 'Cost per kilometre by asset class' });

    table($('#fin-roi'), {
      columns: [
        { key: 'unit', label: 'Unit', sortVal: r => r.v.unit, fmt: r => `<span class="mono">${r.v.unit}</span>` },
        { key: 'class', label: 'Class', sortVal: r => r.v.assetClass, fmt: r => U().esc(r.v.assetClass) },
        { key: 'score', label: 'Score', align: 'right', sortVal: r => r.v.lifecycleScore, fmt: r => String(r.v.lifecycleScore) },
        { key: 'saving', label: 'Est. saving/yr', align: 'right', sortVal: r => r.saving, fmt: r => `<strong>${fmt.money(r.saving)}</strong>` },
        { key: 'payback', label: 'Payback', align: 'right', sortVal: r => r.payback || 99, fmt: r => r.payback ? r.payback + ' yrs' : '—' },
        { key: 'act', label: '', fmt: r => `<button type="button" class="btn btn-sm" data-action="proposal" data-scope="${r.v.unit}">Proposal</button>` }
      ],
      rows: fin.roi, defaultSort: 'saving', onRow: r => openVehicle(r.v.id)
    });

    $('#fin-callout').innerHTML = `
      <div class="callout-num">${fmt.moneyC(fin.roiTotal)}</div>
      <div class="callout-body"><strong>Replacement ROI opportunity.</strong>
      Retiring the ${fin.roi.length} highest-burn assets avoids an estimated <strong>${fmt.money(fin.roiTotal)}/year</strong>
      in excess maintenance and downtime versus healthy replacements — before residual and remarketing upside.</div>
      <div class="callout-actions"><button type="button" class="btn btn-sm" data-action="proposal" data-scope="roi-set">Generate proposals</button></div>`;
  }

  /* ------------------------------------------------------------------ *
   *  AI recommendations
   * ------------------------------------------------------------------ */
  function renderRecommendations(m) {
    const { badge, esc } = U();
    const recos = Maxim.RecommendationEngine.generate(m);
    $('#reco-grid').innerHTML = recos.map((r, i) => `
      <article class="reco">
        <header class="reco-head">${badge(r.priority)}<span class="reco-cat">${esc(r.category)}</span></header>
        <h3 class="reco-title">${esc(r.title)}</h3>
        <p class="reco-detail">${esc(r.detail)}</p>
        <dl class="reco-meta">
          <div><dt>Impact</dt><dd>${esc(r.impact)}</dd></div>
          <div><dt>Estimated value</dt><dd>${esc(r.value)}</dd></div>
          <div><dt>Next step</dt><dd>${esc(r.nextStep)}</dd></div>
        </dl>
        <footer class="reco-actions">${r.actions.map((a, j) =>
          `<button type="button" class="btn btn-sm ${j ? 'btn-ghost' : ''}" data-reco="${i}" data-recoact="${j}">${esc(a.label)}</button>`).join('')}
        </footer>
      </article>`).join('');

    $('#reco-grid').querySelectorAll('[data-reco]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = recos[+btn.dataset.reco].actions[+btn.dataset.recoact];
        Maxim.actions.dispatch(a.action, a.payload, recos[+btn.dataset.reco].title);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   *  Action Center
   * ------------------------------------------------------------------ */
  function renderActionCenter() {
    const { icon, esc, fmt } = U();
    const quick = [
      ['maintenance', 'wrench', 'Schedule maintenance'],
      ['contact', 'user', 'Contact customer'],
      ['reassign', 'route', 'Reassign vehicle'],
      ['lease', 'clipboard', 'Review lease terms'],
      ['proposal', 'refresh', 'Replacement proposal'],
      ['export', 'download', 'Export fleet report'],
      ['crm', 'link', 'Create CRM task']
    ];
    $('#action-quick').innerHTML = quick.map(([a, ic, label]) =>
      `<button type="button" class="action-tile" data-action="${a}" data-scope="manual">${icon(ic, 20)}<span>${label}</span></button>`).join('');

    const paint = (queue) => {
      $('#action-queue').innerHTML = queue.length ? queue.map(q => `
        <div class="q-row">
          <span class="q-time mono">${q.time.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</span>
          <span class="q-label">${esc(q.label)}${q.context ? ` <span class="muted">· ${esc(String(q.context))}</span>` : ''}</span>
          <span class="q-sys">${esc(q.system)}</span>
        </div>`).join('')
        : '<p class="empty">No actions queued yet. Actions taken anywhere in the hub land here, ready to sync to Maxim\'s systems once integrated.</p>';
    };
    paint(Maxim.actions.queue);
    if (!renderActionCenter._bound) {
      Maxim.actions.onChange(paint);
      renderActionCenter._bound = true;
    }
  }

  /* ------------------------------------------------------------------ *
   *  Vehicle detail modal
   * ------------------------------------------------------------------ */
  function openVehicle(id) {
    const v = model.vehicles.find(x => x.id === id) || model.portfolio.vehicles.find(x => x.id === id);
    if (!v) return;
    const { fmt, badge, sparkline, scoreRing, esc, modal } = U();
    const { body } = modal();

    body.innerHTML = `
      <header class="vm-head">
        <div>
          <div class="vm-unit mono">${v.unit}</div>
          <h3 class="vm-title">${v.year} ${esc(v.make)} ${esc(v.model)}</h3>
          <div class="vm-sub">${esc(v.assetClass)} · ${esc(v.customer.name)} <span class="muted">(${esc(v.customer.industry)})</span> · ${esc(v.region)} branch</div>
          <div class="vm-badges">${badge(v.status)} ${badge(v.lifeBand.label)} ${v.maintenance.repeatSystem ? badge('Repeat: ' + v.maintenance.repeatSystem, 'serious') : ''}</div>
        </div>
        <div class="vm-score">${scoreRing(v.lifecycleScore, v.lifeBand, 78)}<span class="vm-score-label">lifecycle score</span></div>
      </header>

      <div class="vm-grid">
        <div class="vm-stat"><dt>Odometer</dt><dd>${fmt.km(v.odometerKm)}</dd></div>
        <div class="vm-stat"><dt>Engine hours</dt><dd>${v.engineHours ? fmt.hrs(v.engineHours) : '— (asset tracker)'}</dd></div>
        <div class="vm-stat"><dt>Utilization 30d</dt><dd>${v.utilization}%</dd></div>
        <div class="vm-stat"><dt>Idle time</dt><dd>${v.idlePct != null ? v.idlePct + '%' : '—'}</dd></div>
        <div class="vm-stat"><dt>Fuel economy</dt><dd>${v.fuelL100 ? v.fuelL100 + ' L/100km' : '—'}</dd></div>
        <div class="vm-stat"><dt>Harsh events 90d</dt><dd>${v.harshEvents90d}</dd></div>
        <div class="vm-stat"><dt>Lease rate</dt><dd>${fmt.money(v.lease.monthlyRate)}/mo</dd></div>
        <div class="vm-stat"><dt>Lease remaining</dt><dd>${v.lease.monthsRemaining} of ${v.lease.termMonths} mo</dd></div>
        <div class="vm-stat"><dt>Est. TCO / yr</dt><dd>${fmt.money(v.econ.tco)}</dd></div>
        <div class="vm-stat"><dt>Cost per km</dt><dd>$${v.econ.costPerKm.toFixed(2)}</dd></div>
        <div class="vm-stat"><dt>Next PM in</dt><dd>${fmt.km(v.maintenance.kmToNextPm)}</dd></div>
        <div class="vm-stat"><dt>In service</dt><dd>${fmt.date(v.inServiceDate)}</dd></div>
      </div>

      <div class="vm-cols">
        <section>
          <h4>Utilization · trailing 12 weeks</h4>
          <div class="vm-spark">${sparkline(v.utilizationHistory, { width: 300, height: 56 })}</div>
          <h4>Active faults</h4>
          ${v.faults.length ? v.faults.map(f => `<div class="vm-fault">${badge(f.severity)}<span class="mono">${esc(f.code)}</span> ${esc(f.desc)} <span class="muted">· ${fmt.date(f.date)}</span></div>`).join('') : '<p class="empty">No active fault codes.</p>'}
        </section>
        <section>
          <h4>Maintenance history <span class="muted">(${fmt.money(v.maintenance.ytdCost)} YTD)</span></h4>
          <div class="vm-events">${v.maintenance.events.slice(0, 6).map(ev =>
            `<div class="vm-event"><span class="mono muted">${fmt.date(ev.date)}</span><span>${esc(ev.type)}</span><span class="num">${fmt.money(ev.cost)}</span></div>`).join('')}</div>
        </section>
      </div>

      <footer class="vm-actions">
        <button type="button" class="btn" data-action="maintenance" data-scope="${v.unit}">Schedule maintenance</button>
        <button type="button" class="btn btn-ghost" data-action="contact" data-scope="${esc(v.customer.name)}">Contact customer</button>
        <button type="button" class="btn btn-ghost" data-action="reassign" data-scope="${v.unit}">Reassign vehicle</button>
        <button type="button" class="btn btn-ghost" data-action="proposal" data-scope="${v.unit}">Replacement proposal</button>
      </footer>
      <p class="vm-vin muted mono">VIN ${v.vin}</p>`;
  }

  /* ------------------------------------------------------------------ *
   *  Drill-down drawers
   * ------------------------------------------------------------------ */
  const DRILLS = {
    all: (m) => ['All leased vehicles', m.vehicles],
    idle: (m) => ['Idle & inactive assets', m.vehicles.filter(v => v.status === 'Idle' || v.status === 'Off-Lease')],
    replacement: (m) => ['Approaching replacement (score < 50)', m.vehicles.filter(v => v.lifecycleScore < 50)],
    highrisk: (m) => ['High-risk assets', m.vehicles.filter(v => v.lifecycleScore < 35 || v.faults.some(f => f.severity === 'Critical'))],
    backlog: (m) => ['Open work orders', m.vehicles.filter(v => v.maintenance.openWorkOrders > 0)],
    under: (m) => ['Utilization below 25%', m.vehicles.filter(v => v.utilization < 25 && v.status !== 'Off-Lease')]
  };

  function drill(kind) {
    const [title, rows] = DRILLS[kind](model);
    drillList(title, rows);
  }

  /** Open a drawer with a sortable, exportable vehicle list. */
  function drillList(title, rows) {
    const { fmt, badge, table, drawer, esc } = U();
    const { body } = drawer();
    body.innerHTML = `
      <header class="dr-head"><h3>${esc(title)}</h3><span class="muted">${rows.length} vehicles</span>
        <button type="button" class="btn btn-sm btn-ghost dr-export">${U().icon('download', 14)} CSV</button></header>
      <div class="dr-table"></div>`;
    table(body.querySelector('.dr-table'), {
      columns: [
        { key: 'unit', label: 'Unit', fmt: r => `<span class="mono">${r.unit}</span>` },
        { key: 'assetClass', label: 'Class' },
        { key: 'customer', label: 'Customer', sortVal: r => r.customer.name, fmt: r => esc(r.customer.name) },
        { key: 'region', label: 'Branch' },
        { key: 'utilization', label: 'Util', align: 'right', fmt: r => r.utilization + '%' },
        { key: 'lifecycleScore', label: 'Score', align: 'right' },
        { key: 'status', label: 'Status', fmt: r => badge(r.status) }
      ],
      rows, onRow: r => openVehicle(r.id)
    });
    body.querySelector('.dr-export').addEventListener('click', () =>
      U().exportCSV(title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.csv',
        ['Unit', 'Class', 'Customer', 'Branch', 'Region', 'Utilization %', 'Lifecycle score', 'Status', 'Odometer km', 'Monthly rate'],
        rows.map(r => [r.unit, r.assetClass, r.customer.name, r.region, r.region, r.utilization, r.lifecycleScore, r.status, r.odometerKm, r.lease.monthlyRate])));
  }

  Maxim.dashboard = { renderAll, openVehicle, drill, drillList };

})(window.Maxim = window.Maxim || {});
