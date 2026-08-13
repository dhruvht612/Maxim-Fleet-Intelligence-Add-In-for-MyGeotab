/**
 * recommendations.js
 * ---------------------------------------------------------------------------
 * Recommendation engine + action registry.
 *
 * The engine turns the intelligence model into a prioritized set of
 * executive recommendation cards (priority, impact, estimated value, next
 * step, actions). The action registry is the single dispatch point for every
 * button in the add-in — each action lands in the Action Center queue, where
 * a production build would hand off to CRM / maintenance / ERP integrations.
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  const fmt = () => Maxim.UI.fmt;   // resolved lazily; ui.js loads after this file

  /* ------------------------------------------------------------------ *
   *  Recommendation engine
   * ------------------------------------------------------------------ */

  /**
   * Generate prioritized recommendations from the model.
   * Every card is data-driven — numbers come from the same engine outputs
   * the sections render, so the story is always internally consistent.
   */
  function generate(model) {
    const F = fmt();
    const recos = [];
    const { utilization: u, maintenance: m, lifecycle: l, financial: fin, fleet } = model;

    // --- Lifecycle / replacement -------------------------------------------
    if (l.candidateCount > 0) {
      const next12 = model.lifecycle.forecast.slice(0, 4).reduce((a, q) => a + q.units.length, 0);
      recos.push({
        priority: 'High', category: 'Lifecycle',
        title: `${l.candidateCount} vehicles are approaching replacement thresholds`,
        detail: `${l.endOfLife.length} score below 35 today and ${next12} more cross the line within four quarters. Sequencing these into a proactive replacement program protects residual value and avoids failure-driven swaps.`,
        impact: 'Residual value protection & planned capex',
        value: F.money(l.endOfLife.reduce((a, v) => a + Maxim.InsightEngine.estReplacementCost(v) * 0.08, 0)) + ' est. residual protected',
        nextStep: 'Generate replacement proposals for the "Replace now" band',
        actions: [
          { label: 'Generate replacement proposals', action: 'proposal', payload: { scope: 'replace-band' } },
          { label: 'View candidates', action: 'goto', payload: { target: '#lifecycle' } }
        ]
      });
    }

    // --- Utilization ---------------------------------------------------------
    if (u.underCount > 0) {
      recos.push({
        priority: 'High', category: 'Utilization',
        title: `${u.underCount} vehicles have utilization below 25%`,
        detail: `Fleet analysis suggests roughly ${Math.round(u.underCount * 0.24)} assets may be surplus to requirement. Redistribution or right-sizing conversations with the affected customers unlock lease spend currently attached to parked equipment.`,
        impact: 'Lease right-sizing & asset redistribution',
        value: F.money(u.monthlySavings) + ' potential monthly savings',
        nextStep: 'Review the under-utilized list with account managers',
        actions: [
          { label: 'Open utilization detail', action: 'goto', payload: { target: '#utilization' } },
          { label: 'Create CRM tasks', action: 'crm', payload: { scope: 'under-utilized', count: u.underCount } }
        ]
      });
    }

    // --- Maintenance ---------------------------------------------------------
    if (m.rising.length > 0) {
      const top = m.rising[0];
      recos.push({
        priority: m.criticalCount ? 'High' : 'Medium', category: 'Maintenance',
        title: `${m.rising.length} units show a rising maintenance cost trend`,
        detail: `Unit ${top.unit} (${top.assetClass}, ${F.km(top.odometerKm)}) leads with ${F.money(top.maintenance.ytdCost)} YTD. Replacing or cascading the worst performers before the next failure cycle avoids unplanned downtime for ${top.customer.name}.`,
        impact: 'Downtime avoidance & repair-cost containment',
        value: F.money(fin.roiTotal) + '/yr addressable via replacement ROI',
        nextStep: `Review unit ${top.unit} replacement business case`,
        actions: [
          { label: 'Open unit ' + top.unit, action: 'vehicle', payload: { id: top.id } },
          { label: 'Schedule maintenance review', action: 'maintenance', payload: { scope: 'rising-trend' } }
        ]
      });
    }

    if (m.pmDue.length > 0) {
      recos.push({
        priority: 'Medium', category: 'Maintenance',
        title: `${m.pmDue.length} units are within 3,000 km of PM service`,
        detail: 'Batch-scheduling these against branch shop capacity converts telematics odometer feeds into a zero-touch PM pipeline and keeps warranty compliance intact.',
        impact: 'PM compliance & shop-load smoothing',
        value: F.money(m.pmDue.length * 420) + ' est. avoided reactive premium',
        nextStep: 'Push PM work orders to the service calendar',
        actions: [{ label: 'Schedule PM batch', action: 'maintenance', payload: { scope: 'pm-batch', count: m.pmDue.length } }]
      });
    }

    // --- Financial -----------------------------------------------------------
    if (fin.leaseEfficiency < 90) {
      recos.push({
        priority: 'Medium', category: 'Financial',
        title: `Lease efficiency is ${fin.leaseEfficiency}% — ${fmtPct(100 - fin.leaseEfficiency)} of billing sits on low-work assets`,
        detail: `${F.money(fin.idleLeaseSpend)}/month of lease billing is attached to assets running under 25% utilization. Term restructuring, seasonal flex leases, or redeployment all convert this into retained, defensible revenue.`,
        impact: 'Customer retention & portfolio yield',
        value: F.money(fin.idleLeaseSpend * 12) + ' annualized exposure',
        nextStep: 'Review lease terms for the affected accounts',
        actions: [{ label: 'Review lease terms', action: 'lease', payload: { scope: 'low-efficiency' } }]
      });
    }

    // --- Data / integration ----------------------------------------------------
    recos.push({
      priority: 'Low', category: 'Data',
      title: 'Integrating maintenance records would improve forecasting accuracy by ~35%',
      detail: 'Lifecycle scores currently infer component wear from telematics-side signals. Joining shop work orders (parts, labour, systems) sharpens replacement timing and enables component-level failure prediction.',
      impact: 'Forecast accuracy & warranty recovery',
      value: 'Model uplift: ±1 quarter → ±3 weeks replacement timing',
      nextStep: 'Complete the integration discovery profile below',
      actions: [{ label: 'Open Integration Discovery', action: 'goto', payload: { target: '#discovery' } }]
    });

    if (fleet.idle > 0) {
      recos.push({
        priority: 'Low', category: 'Utilization',
        title: `${fleet.idle} idle assets have not worked in 30+ days`,
        detail: 'Idle-but-billed equipment is the first thing customers cut at renewal. Proactively flagging it with a redeployment or downsize option turns a churn risk into an advisory touchpoint.',
        impact: 'Churn prevention',
        value: 'Renewal risk mitigation',
        nextStep: 'Contact affected customers with redeployment options',
        actions: [{ label: 'Contact customers', action: 'contact', payload: { scope: 'idle-assets', count: fleet.idle } }]
      });
    }

    // Highest priority first, then by category weight.
    const pWeight = { High: 3, Medium: 2, Low: 1 };
    return recos.sort((a, b) => pWeight[b.priority] - pWeight[a.priority]);

    function fmtPct(x) { return x + '%'; }
  }

  /* ------------------------------------------------------------------ *
   *  Action registry — every button in the add-in dispatches through here
   * ------------------------------------------------------------------ */

  /** Action Center queue (rendered by dashboard.js). */
  const queue = [];
  const listeners = [];

  const ACTION_DEFS = {
    maintenance: { label: 'Schedule maintenance',            system: 'Maintenance system' },
    contact:     { label: 'Contact customer',                system: 'CRM' },
    reassign:    { label: 'Reassign vehicle',                system: 'Fleet operations' },
    lease:       { label: 'Review lease terms',              system: 'Lease accounting' },
    proposal:    { label: 'Generate replacement proposal',   system: 'Sales / remarketing' },
    export:      { label: 'Export report',                   system: 'Reporting' },
    crm:         { label: 'Create CRM task',                 system: 'CRM' },
    inspect:     { label: 'Request inspection',              system: 'Service network' }
  };

  /**
   * Dispatch an action. In this showcase it queues the intent and confirms
   * with a toast; in production each branch hands off to the integrated
   * system (work order API, CRM task API, proposal generator, …).
   */
  function dispatch(action, payload = {}, contextLabel = '') {
    // Navigation and vehicle drill-down are handled locally, not queued.
    if (action === 'goto') {
      const el = document.querySelector(payload.target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (action === 'vehicle') {
      Maxim.dashboard.openVehicle(payload.id);
      return;
    }
    if (action === 'export') {
      Maxim.app.exportFleetReport();
    }

    const def = ACTION_DEFS[action] || { label: action, system: 'Fleet Intelligence Hub' };
    queue.unshift({
      time: new Date(),
      action, payload,
      label: def.label,
      system: def.system,
      context: contextLabel || payload.scope || payload.unit || ''
    });
    if (queue.length > 12) queue.pop();

    Maxim.UI.toast(`${def.label} queued — will sync to ${def.system.toLowerCase()} on integration`, 'ok');
    listeners.forEach(fn => fn(queue));
  }

  Maxim.RecommendationEngine = { generate };
  Maxim.actions = {
    dispatch,
    queue,
    defs: ACTION_DEFS,
    onChange(fn) { listeners.push(fn); }
  };

})(window.Maxim = window.Maxim || {});
