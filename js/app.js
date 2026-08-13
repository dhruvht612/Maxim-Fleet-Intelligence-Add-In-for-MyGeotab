/**
 * app.js
 * ---------------------------------------------------------------------------
 * Application shell: bootstrapping, global state, filters, search, theme,
 * refresh/export, and the MyGeotab Add-In lifecycle registration.
 *
 * Load order (index.html): data-generator → geotab-service → insights →
 * recommendations → ui → dashboard → integrations → app (this file).
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const state = {
    seed: 20260813,
    portfolio: null,
    model: null,
    filters: { region: '', assetClass: '', status: '' }
  };

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */

  /**
   * Initialize the hub.
   * @param {object|null} api - live MyGeotab api when running as an add-in,
   *   null when running standalone (mock mode).
   */
  async function boot(api) {
    Maxim.service = new Maxim.GeotabService(api);
    applyStoredTheme();
    wireChrome();
    Maxim.integrations.renderAll();   // static sections don't need data
    await loadData();
  }

  /** Load (or reload) data through the service layer and repaint. */
  async function loadData(newSeed) {
    document.body.classList.add('is-loading');
    if (newSeed !== undefined) state.seed = newSeed;
    try {
      await Maxim.service.authenticate();
      state.portfolio = await Maxim.service.loadPortfolio(newSeed);
      buildFilterOptions();
      applyFilters(true);
    } catch (err) {
      console.error('Maxim Fleet Intelligence: data load failed', err);
      Maxim.UI.toast('Could not load fleet data from the Geotab service layer', 'warn');
    } finally {
      document.body.classList.remove('is-loading');
    }
  }

  /** Re-run the insight engine against the current filter set and repaint. */
  function applyFilters(skipToast) {
    const f = state.filters;
    const subset = state.portfolio.vehicles.filter(v =>
      (!f.region || v.region === f.region) &&
      (!f.assetClass || v.assetClass === f.assetClass) &&
      (!f.status || v.status === f.status));

    state.model = Maxim.InsightEngine.build(state.portfolio, subset);
    Maxim.dashboard.renderAll(state.model);

    const active = Object.values(f).filter(Boolean).length;
    $('#filter-count').textContent = active
      ? `${subset.length} of ${state.portfolio.vehicles.length} vehicles · ${active} filter${active > 1 ? 's' : ''}`
      : `${state.portfolio.vehicles.length} vehicles`;
    if (!skipToast && active) Maxim.UI.toast(`Filtered to ${subset.length} vehicles`, 'ok');
  }

  /* ------------------------------------------------------------------ *
   *  Chrome: filters, search, buttons, theme, resize
   * ------------------------------------------------------------------ */

  function buildFilterOptions() {
    const p = state.portfolio;
    const fill = (sel, values, label) => {
      const s = $(sel);
      s.innerHTML = `<option value="">${label}</option>` +
        values.map(v => `<option${state.filters[s.dataset.filter] === v ? ' selected' : ''}>${v}</option>`).join('');
    };
    fill('#f-region', p.regions, 'All branches');
    fill('#f-class', p.assetClasses, 'All asset classes');
    fill('#f-status', ['Active', 'Idle', 'In Shop', 'Off-Lease'], 'All statuses');
  }

  function wireChrome() {
    // Filter selects.
    document.querySelectorAll('.filterbar select').forEach(sel =>
      sel.addEventListener('change', () => {
        state.filters[sel.dataset.filter] = sel.value;
        applyFilters();
      }));
    $('#f-clear').addEventListener('click', () => {
      state.filters = { region: '', assetClass: '', status: '' };
      buildFilterOptions();
      applyFilters();
    });

    // Refresh — new seed simulates a live re-query.
    $('#btn-refresh').addEventListener('click', async () => {
      await loadData(Math.floor(Math.random() * 1e9));
      Maxim.UI.toast('Data refreshed from Geotab service layer', 'ok');
    });

    // Export current (filtered) fleet report.
    $('#btn-export').addEventListener('click', exportFleetReport);

    // Theme toggle.
    $('#btn-theme').addEventListener('click', () => {
      const dark = document.documentElement.getAttribute('data-theme') !== 'dark';
      setTheme(dark ? 'dark' : 'light');
      applyFilters(true);            // repaint charts with theme-stepped palette
    });

    wireSearch();

    // Delegated action buttons: any [data-action] / [data-vehicle] / [data-drill].
    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-action]');
      if (act) { Maxim.actions.dispatch(act.dataset.action, { scope: act.dataset.scope }); return; }
      const veh = e.target.closest('[data-vehicle]');
      if (veh) { Maxim.dashboard.openVehicle(veh.dataset.vehicle); return; }
      const dr = e.target.closest('[data-drill]');
      if (dr) Maxim.dashboard.drill(dr.dataset.drill);
    });

    // Section-level export buttons.
    document.querySelectorAll('[data-export-section]').forEach(btn =>
      btn.addEventListener('click', () => exportSection(btn.dataset.exportSection)));

    // Charts re-render on resize (they measure their container).
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => state.model && Maxim.dashboard.renderAll(state.model), 220);
    });

    // Active-section highlight in the top nav while scrolling.
    const links = [...document.querySelectorAll('.topnav a[href^="#"]')];
    const sections = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id));
        }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });
    sections.forEach(s => obs.observe(s));
  }

  /** Type-ahead vehicle / customer search with keyboard support. */
  function wireSearch() {
    const input = $('#search');
    const results = $('#search-results');
    let items = [], cursor = -1;

    const close = () => { results.hidden = true; cursor = -1; };

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { close(); return; }
      items = state.portfolio.vehicles.filter(v =>
        v.unit.toLowerCase().includes(q) ||
        v.customer.name.toLowerCase().includes(q) ||
        v.assetClass.toLowerCase().includes(q) ||
        (v.make + ' ' + v.model).toLowerCase().includes(q)
      ).slice(0, 8);
      results.innerHTML = items.length ? items.map((v, i) => `
        <button type="button" class="sr-item" data-i="${i}">
          <span class="mono">${v.unit}</span>
          <span>${Maxim.UI.esc(v.make)} ${Maxim.UI.esc(v.model)} · ${Maxim.UI.esc(v.assetClass)}</span>
          <span class="muted">${Maxim.UI.esc(v.customer.name)} · ${Maxim.UI.esc(v.region)}</span>
        </button>`).join('')
        : '<div class="sr-empty">No matching vehicles</div>';
      results.hidden = false;
      results.querySelectorAll('.sr-item').forEach(b =>
        b.addEventListener('click', () => { Maxim.dashboard.openVehicle(items[+b.dataset.i].id); close(); input.value = ''; }));
    });

    input.addEventListener('keydown', (e) => {
      const opts = [...results.querySelectorAll('.sr-item')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        cursor = (cursor + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % (opts.length || 1);
        opts.forEach((o, i) => o.classList.toggle('is-focus', i === cursor));
      } else if (e.key === 'Enter' && cursor >= 0 && opts[cursor]) {
        opts[cursor].click();
      } else if (e.key === 'Escape') close();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) close(); });
  }

  /* ------------------------------------------------------------------ *
   *  Theme
   * ------------------------------------------------------------------ */
  function setTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('maxim-theme', mode); } catch (e) { /* sandboxed iframe */ }
    const btn = $('#btn-theme');
    btn.innerHTML = Maxim.UI.icon(mode === 'dark' ? 'sun' : 'moon', 17);
    btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
  function applyStoredTheme() {
    // Priority: ?theme= override (demos) → saved preference → OS setting.
    const urlTheme = new URLSearchParams(location.search).get('theme');
    let saved = null;
    try { saved = localStorage.getItem('maxim-theme'); } catch (e) { /* ignore */ }
    setTheme(['light', 'dark'].includes(urlTheme) ? urlTheme
      : saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  }

  /* ------------------------------------------------------------------ *
   *  Exports
   * ------------------------------------------------------------------ */

  /** Full fleet report for the current filter set. */
  function exportFleetReport() {
    const vs = state.model.vehicles;
    Maxim.UI.exportCSV('maxim-fleet-intelligence-report.csv',
      ['Unit', 'VIN', 'Class', 'Year', 'Make', 'Model', 'Customer', 'Industry', 'Branch', 'Status',
        'Odometer km', 'Engine hours', 'Utilization %', 'Idle %', 'Lifecycle score', 'Band',
        'Maint YTD $', 'Open WOs', 'Monthly rate $', 'Lease months left', 'Est TCO $/yr', 'Cost $/km'],
      vs.map(v => [v.unit, v.vin, v.assetClass, v.year, v.make, v.model, v.customer.name, v.customer.industry,
        v.region, v.status, v.odometerKm, v.engineHours || '', v.utilization, v.idlePct || '',
        v.lifecycleScore, v.lifeBand.label, v.maintenance.ytdCost, v.maintenance.openWorkOrders,
        v.lease.monthlyRate, v.lease.monthsRemaining, v.econ.tco, v.econ.costPerKm]));
    Maxim.actions.dispatch('export', { scope: 'fleet-report' });
  }

  /** Section-scoped exports wired to the section header buttons. */
  function exportSection(section) {
    const m = state.model, F = Maxim.UI.fmt;
    if (section === 'utilization') {
      Maxim.UI.exportCSV('maxim-utilization.csv',
        ['Unit', 'Class', 'Customer', 'Branch', 'Utilization %', 'Idle spend $/mo'],
        m.vehicles.map(v => [v.unit, v.assetClass, v.customer.name, v.region, v.utilization,
          Math.round(v.lease.monthlyRate * (1 - v.utilization / 100))]));
    } else if (section === 'maintenance') {
      Maxim.UI.exportCSV('maxim-maintenance.csv',
        ['Unit', 'Class', 'Maint YTD $', '$/km', 'Trend', 'Repeat system', 'Downtime 90d', 'Open WOs'],
        m.vehicles.map(v => [v.unit, v.assetClass, v.maintenance.ytdCost, v.maintenance.costPerKm,
          v.maintenance.costTrend === 1 ? 'rising' : v.maintenance.costTrend === -1 ? 'improving' : 'flat',
          v.maintenance.repeatSystem || '', v.maintenance.downtimeDays90d, v.maintenance.openWorkOrders]));
    } else if (section === 'lifecycle') {
      Maxim.UI.exportCSV('maxim-lifecycle.csv',
        ['Unit', 'Class', 'Year', 'Odometer km', 'Score', 'Band'],
        m.vehicles.map(v => [v.unit, v.assetClass, v.year, v.odometerKm, v.lifecycleScore, v.lifeBand.label]));
    } else if (section === 'financial') {
      Maxim.UI.exportCSV('maxim-financial.csv',
        ['Unit', 'Class', 'Lease $/yr', 'Maint $/yr', 'Fuel $/yr', 'TCO $/yr', '$/km'],
        m.vehicles.map(v => [v.unit, v.assetClass, v.econ.lease, v.econ.maint, v.econ.fuel, v.econ.tco, v.econ.costPerKm]));
    }
  }

  /* ------------------------------------------------------------------ *
   *  MyGeotab Add-In lifecycle
   * ------------------------------------------------------------------ */
  Maxim.app = { boot, loadData, exportFleetReport, state };

  if (window.geotab && window.geotab.addin) {
    // Running inside MyGeotab: the framework injects the authenticated api.
    const addinFactory = function () {
      return {
        /** Called once when MyGeotab loads the add-in. */
        initialize(api, pageState, ready) {
          // Always release MyGeotab's loading state, even if boot fails —
          // otherwise the page stays blurred behind its spinner forever.
          boot(api)
            .catch((err) => console.error('Maxim Fleet Intelligence: initialize failed', err))
            .then(ready);
        },
        /** Called every time the user navigates to the add-in. */
        focus() { /* re-query on focus in live mode if data is stale */ },
        /** Called when the user navigates away. */
        blur() { /* release timers/feeds here in live mode */ }
      };
    };
    // MyGeotab resolves the entry point from the camelCased add-in name in
    // config.json ("Maxim Fleet Intelligence Hub"); keep the legacy key too.
    window.geotab.addin.maximFleetIntelligenceHub = addinFactory;
    window.geotab.addin.maximFleetIntelligence = addinFactory;
  } else {
    // Standalone showcase: boot in mock mode.
    document.addEventListener('DOMContentLoaded', () => boot(null));
  }

})(window.Maxim = window.Maxim || {});
