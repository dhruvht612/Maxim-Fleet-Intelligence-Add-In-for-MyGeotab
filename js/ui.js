/**
 * ui.js
 * ---------------------------------------------------------------------------
 * Component library for the Maxim Fleet Intelligence Hub.
 *
 * Everything visual and reusable lives here: number formatting, the icon set,
 * KPI cards, badges, the SVG chart kit (sparkline / bar / h-bar / line /
 * heatmap / composition bar), the shared tooltip, sortable tables with CSV
 * export, the vehicle modal, drill-down drawer and toasts.
 *
 * Charts are dependency-free inline SVG. Chrome colors are CSS custom
 * properties so both themes restyle without re-render; series and ramp hexes
 * are read from the active theme at render time (the app re-renders on theme
 * change and resize).
 * ---------------------------------------------------------------------------
 */
(function (Maxim) {
  'use strict';

  /* ------------------------------------------------------------------ *
   *  Formatting
   * ------------------------------------------------------------------ */
  const fmt = {
    int: (n) => Math.round(n).toLocaleString('en-CA'),
    money: (n) => '$' + Math.round(n).toLocaleString('en-CA'),
    /** Compact money for KPI surfaces: $1.24M / $86k. */
    moneyC: (n) => {
      const a = Math.abs(n);
      if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
      if (a >= 1e4) return '$' + Math.round(n / 1e3) + 'k';
      return '$' + Math.round(n).toLocaleString('en-CA');
    },
    km: (n) => Math.round(n).toLocaleString('en-CA') + ' km',
    kmC: (n) => (n >= 1000 ? Math.round(n / 1000) + 'k km' : Math.round(n) + ' km'),
    pct: (n) => Math.round(n) + '%',
    date: (d) => d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }),
    hrs: (n) => Math.round(n).toLocaleString('en-CA') + ' h'
  };

  /** Parse HTML into a single element. */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ------------------------------------------------------------------ *
   *  Theme-aware chart colors
   * ------------------------------------------------------------------ */

  /** Validated categorical palette (light / dark steps of the same hues). */
  const SERIES = {
    light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
    dark:  ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181']
  };
  /** Sequential blue ramp, light→dark (heatmap magnitude). */
  const RAMP = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
    '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'];
  /** Status palette (fixed, never used as series colors). */
  const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const series = (i) => (isDark() ? SERIES.dark : SERIES.light)[i % 5];
  /** Sequential color for a 0–100 value. Dark mode skips the palest steps. */
  function rampColor(v) {
    const r = isDark() ? RAMP.slice(3) : RAMP;
    return r[Math.min(r.length - 1, Math.floor((v / 101) * r.length))];
  }

  /* ------------------------------------------------------------------ *
   *  Icon set — minimal 24px stroke glyphs
   * ------------------------------------------------------------------ */
  const ICONS = {
    truck: '<rect x="1" y="5" width="14" height="11" rx="1"/><path d="M15 9h4l3 3v4h-7z"/><circle cx="6" cy="18.5" r="1.8"/><circle cx="18" cy="18.5" r="1.8"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-10.3A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.7C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.7" r="2.1"/>',
    route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6"/>',
    gauge: '<path d="M4.5 16.5a8.5 8.5 0 1 1 15 0"/><path d="M12 14l4.2-4.2"/><circle cx="12" cy="14" r="1.4"/>',
    fuel: '<path d="M5 21V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15"/><path d="M4 21h11"/><path d="M7 9h5"/><path d="M14 10h2l3 3v5.5a1.5 1.5 0 0 1-3 0V13"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    alert: '<path d="M12 3.5 22 21H2z"/><path d="M12 10v4.5"/><path d="M12 18h.01"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    activity: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    battery: '<rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 11v2"/><path d="M6 11v2"/><path d="M10 11v2"/>',
    refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/>',
    sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M1.5 12h3M19.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="M21 21l-4.8-4.8"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    dollar: '<path d="M12 1.5v21"/><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    layers: '<path d="M12 2 2 7.5l10 5.5 10-5.5z"/><path d="M2 12.5 12 18l10-5.5"/><path d="M2 17.5 12 23l10-5.5"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="17" rx="2"/><path d="M16 2.5v4M8 2.5v4M3 10.5h18"/>',
    zap: '<path d="M13 2 3 14h8l-1 8 10-12h-8z"/>',
    grid: '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
    snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
    trendUp: '<path d="M3 17.5 9.5 11l4 4L21 6.5"/><path d="M15.5 6.5H21V12"/>',
    check: '<path d="M20 6 9 17.5 4 12.5"/>'
  };

  /**
   * Inline SVG icon.
   * @param {string} name key in ICONS
   * @param {number} [size]
   */
  function icon(name, size = 18) {
    return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.grid}</svg>`;
  }

  /* ------------------------------------------------------------------ *
   *  Shared tooltip
   * ------------------------------------------------------------------ */
  const tooltip = {
    node: null,
    ensure() {
      if (!this.node) {
        this.node = el('<div class="viz-tooltip" role="status" hidden></div>');
        document.body.appendChild(this.node);
      }
      return this.node;
    },
    show(html, x, y) {
      const t = this.ensure();
      t.innerHTML = html;
      t.hidden = false;
      const r = t.getBoundingClientRect();
      const px = Math.min(x + 14, window.innerWidth - r.width - 10);
      const py = Math.max(8, y - r.height - 12);
      t.style.transform = `translate(${px}px, ${py}px)`;
    },
    hide() { if (this.node) this.node.hidden = true; }
  };

  /** Attach show/move/hide tooltip handlers to a mark. */
  function bindTip(node, html) {
    node.addEventListener('mouseenter', (e) => tooltip.show(html, e.clientX, e.clientY));
    node.addEventListener('mousemove', (e) => tooltip.show(html, e.clientX, e.clientY));
    node.addEventListener('mouseleave', () => tooltip.hide());
  }

  /* ------------------------------------------------------------------ *
   *  Chart kit
   * ------------------------------------------------------------------ */

  const measure = (container, fallback = 560) =>
    Math.max(220, Math.floor(container.getBoundingClientRect().width) || fallback);

  /**
   * Sparkline — tiny single-series trend with an end dot.
   * @param {number[]} values
   */
  function sparkline(values, { width = 120, height = 34, color } = {}) {
    const c = color || series(0);
    const min = Math.min(...values), max = Math.max(...values);
    const span = (max - min) || 1;
    const px = (i) => 2 + (i / (values.length - 1)) * (width - 6);
    const py = (v) => height - 4 - ((v - min) / span) * (height - 9);
    const d = values.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
    const last = values[values.length - 1];
    return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${px(values.length - 1).toFixed(1)}" cy="${py(last).toFixed(1)}" r="3" fill="${c}"/>
    </svg>`;
  }

  /**
   * Vertical bar chart with direct value labels and hover tooltips.
   * @param {HTMLElement} container
   * @param {{label:string, value:number, tip?:string}[]} data
   */
  function barChart(container, data, { height = 210, color, fmtVal = fmt.int, title = '' } = {}) {
    const w = measure(container);
    const c = color || series(0);
    const pad = { t: 22, r: 8, b: 26, l: 8 };
    const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
    const max = Math.max(...data.map(d => d.value), 1);
    const bw = Math.min(44, (iw / data.length) * 0.6);
    const step = iw / data.length;

    let bars = '', labels = '', grid = '';
    for (let g = 1; g <= 3; g++) {
      const gy = pad.t + ih - (ih * g / 3);
      grid += `<line x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}" class="c-grid"/>`;
    }
    data.forEach((d, i) => {
      const h = Math.max(2, (d.value / max) * ih);
      const x = pad.l + step * i + (step - bw) / 2;
      const y = pad.t + ih - h;
      bars += `<rect data-i="${i}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${c}" class="c-bar"/>`;
      labels += `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" class="c-val">${fmtVal(d.value)}</text>`;
      labels += `<text x="${(x + bw / 2).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="c-lab">${esc(d.label)}</text>`;
    });

    container.innerHTML = `<svg width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-label="${esc(title)}">
      ${grid}<line x1="${pad.l}" y1="${pad.t + ih}" x2="${w - pad.r}" y2="${pad.t + ih}" class="c-axis"/>${bars}${labels}</svg>`;

    container.querySelectorAll('rect[data-i]').forEach(r => {
      const d = data[+r.dataset.i];
      bindTip(r, d.tip || `<strong>${esc(d.label)}</strong><br>${fmtVal(d.value)}`);
    });
  }

  /**
   * Horizontal bar chart — labels left, direct value labels at bar ends.
   * @param {{label:string, value:number, tip?:string}[]} data
   */
  function hBarChart(container, data, { color, fmtVal = fmt.int, title = '', rowH = 30 } = {}) {
    const w = measure(container);
    const c = color || series(0);
    const labW = Math.min(190, w * 0.34);
    const valW = 62;
    const height = data.length * rowH + 8;
    const iw = w - labW - valW - 10;
    const max = Math.max(...data.map(d => d.value), 0.001);

    let out = '';
    data.forEach((d, i) => {
      const bw = Math.max(2, (d.value / max) * iw);
      const y = 4 + i * rowH;
      out += `<text x="${labW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end" class="c-lab c-lab-row">${esc(d.label)}</text>
        <rect data-i="${i}" x="${labW}" y="${y + (rowH - 14) / 2}" width="${bw.toFixed(1)}" height="14" rx="3" fill="${c}" class="c-bar"/>
        <text x="${labW + bw + 8}" y="${y + rowH / 2 + 4}" class="c-val">${fmtVal(d.value)}</text>`;
    });

    container.innerHTML = `<svg width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-label="${esc(title)}">
      <line x1="${labW}" y1="2" x2="${labW}" y2="${height - 2}" class="c-axis"/>${out}</svg>`;

    container.querySelectorAll('rect[data-i]').forEach(r => {
      const d = data[+r.dataset.i];
      bindTip(r, d.tip || `<strong>${esc(d.label)}</strong><br>${fmtVal(d.value)}`);
    });
  }

  /**
   * Single-series line chart with area wash, hover crosshair + tooltip.
   * @param {string[]} labels x labels
   * @param {number[]} values
   */
  function lineChart(container, labels, values, { height = 220, color, fmtVal = fmt.int, title = '' } = {}) {
    const w = measure(container);
    const c = color || series(0);
    const pad = { t: 14, r: 14, b: 26, l: 46 };
    const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
    const max = Math.max(...values) * 1.12 || 1;
    const px = (i) => pad.l + (i / (values.length - 1)) * iw;
    const py = (v) => pad.t + ih - (v / max) * ih;

    const d = values.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
    const area = d + ` L ${px(values.length - 1).toFixed(1)} ${pad.t + ih} L ${pad.l} ${pad.t + ih} Z`;

    let grid = '', ticks = '';
    for (let g = 0; g <= 3; g++) {
      const gy = pad.t + ih - (ih * g / 3);
      grid += `<line x1="${pad.l}" y1="${gy}" x2="${w - pad.r}" y2="${gy}" class="c-grid"/>`;
      ticks += `<text x="${pad.l - 8}" y="${gy + 4}" text-anchor="end" class="c-lab">${fmt.moneyC(max * g / 3)}</text>`;
    }
    // Sparse x labels: first, two mids, last.
    [0, 4, 8, labels.length - 1].forEach(i => {
      ticks += `<text x="${px(i).toFixed(1)}" y="${height - 8}" text-anchor="middle" class="c-lab">${esc(labels[i])}</text>`;
    });

    container.innerHTML = `<svg width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-label="${esc(title)}">
      ${grid}${ticks}
      <path d="${area}" fill="${c}" opacity="0.09"/>
      <path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <line class="c-cross" y1="${pad.t}" y2="${pad.t + ih}" stroke-dasharray="3 3" hidden/>
      <circle class="c-dot" r="4" fill="${c}" stroke="var(--surface)" stroke-width="2" hidden/>
      <rect class="c-hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent"/></svg>`;

    // Crosshair: nearest-index hover.
    const svg = container.firstElementChild;
    const hit = svg.querySelector('.c-hit'), cross = svg.querySelector('.c-cross'), dot = svg.querySelector('.c-dot');
    hit.addEventListener('mousemove', (e) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(0, Math.min(values.length - 1,
        Math.round(((e.clientX - r.left) - pad.l) / iw * (values.length - 1))));
      const x = px(i), y = py(values[i]);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.hidden = false;
      dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.hidden = false;
      tooltip.show(`<strong>${esc(labels[i])}</strong><br>${fmtVal(values[i])}`, e.clientX, e.clientY);
    });
    hit.addEventListener('mouseleave', () => { cross.hidden = true; dot.hidden = true; tooltip.hide(); });
  }

  /**
   * Utilization heatmap — CSS grid of cells, sequential blue ramp,
   * per-cell tooltip and a min→max ramp legend.
   * @param {{rows:string[], cols:string[], values:number[][]}} data
   */
  function heatmap(container, data) {
    const { rows, cols, values } = data;
    const grid = el(`<div class="heatmap" style="grid-template-columns: minmax(110px, 170px) repeat(${cols.length}, 1fr);"></div>`);

    grid.appendChild(el('<div class="hm-corner"></div>'));
    cols.forEach((c, i) => grid.appendChild(el(
      `<div class="hm-col">${i % 2 === 0 ? esc(c) : ''}</div>`)));

    rows.forEach((r, ri) => {
      grid.appendChild(el(`<div class="hm-row" title="${esc(r)}">${esc(r)}</div>`));
      cols.forEach((c, ci) => {
        const v = values[ri][ci];
        const cell = el(`<div class="hm-cell" style="background:${rampColor(v)}" tabindex="0" aria-label="${esc(r)}, week of ${esc(c)}: ${v}% utilization"></div>`);
        bindTip(cell, `<strong>${esc(r)}</strong><br>Week of ${esc(c)} — <strong>${v}%</strong> avg utilization`);
        grid.appendChild(cell);
      });
    });

    const legend = el(`<div class="hm-legend"><span>0%</span><span class="hm-ramp" style="background:linear-gradient(90deg, ${(isDark() ? RAMP.slice(3) : RAMP).join(',')})"></span><span>100%</span><span class="hm-legend-note">avg weekly utilization</span></div>`);
    container.innerHTML = '';
    container.appendChild(grid);
    container.appendChild(legend);
  }

  /**
   * Composition bar — one horizontal 100% bar with 2px gaps and a legend
   * carrying the actual values (used for TCO mix and utilization bands).
   * @param {{label:string, value:number, color?:string, tip?:string, onClick?:function}[]} parts
   */
  function compositionBar(container, parts, { fmtVal = fmt.moneyC } = {}) {
    const total = parts.reduce((a, p) => a + p.value, 0) || 1;
    const bar = el('<div class="comp-bar" role="img"></div>');
    const legend = el('<div class="comp-legend"></div>');
    parts.forEach((p, i) => {
      const c = p.color || series(i);
      const segEl = el(`<div class="comp-seg" style="width:${(p.value / total * 100).toFixed(2)}%;background:${c}"></div>`);
      bindTip(segEl, p.tip || `<strong>${esc(p.label)}</strong><br>${fmtVal(p.value)} · ${Math.round(p.value / total * 100)}%`);
      if (p.onClick) { segEl.classList.add('is-click'); segEl.addEventListener('click', p.onClick); }
      bar.appendChild(segEl);
      const li = el(`<button type="button" class="comp-key"><span class="key-dot" style="background:${c}"></span>${esc(p.label)} <strong>${fmtVal(p.value)}</strong><span class="key-pct">${Math.round(p.value / total * 100)}%</span></button>`);
      if (p.onClick) li.addEventListener('click', p.onClick); else li.disabled = true;
      legend.appendChild(li);
    });
    container.innerHTML = '';
    container.appendChild(bar);
    container.appendChild(legend);
  }

  /**
   * Lifecycle score ring — small radial gauge, colored by band severity
   * (status palette; always paired with the band label, never color alone).
   */
  function scoreRing(score, band, size = 64) {
    const color = { healthy: STATUS.good, monitor: STATUS.warning, plan: STATUS.serious, replace: STATUS.critical }[band.key];
    const r = (size - 10) / 2, circ = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="score-ring" role="img" aria-label="Lifecycle score ${score}, ${esc(band.label)}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--grid)" stroke-width="6"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round"
        stroke-dasharray="${(circ * score / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
      <text x="50%" y="50%" dy="6" text-anchor="middle" class="score-num">${score}</text></svg>`;
  }

  /* ------------------------------------------------------------------ *
   *  KPI cards, badges, trend chips
   * ------------------------------------------------------------------ */

  /**
   * KPI card.
   * @param {object} o {label, value, sub, spark, delta, goodWhen, icon, onClick}
   */
  function kpiCard(o) {
    const card = el(`<button type="button" class="kpi" ${o.onClick ? '' : 'disabled'}>
      <span class="kpi-top"><span class="kpi-ic">${icon(o.icon || 'gauge', 16)}</span><span class="kpi-label">${esc(o.label)}</span></span>
      <span class="kpi-value">${o.value}</span>
      <span class="kpi-foot">${o.delta !== undefined ? trendChip(o.delta, o.goodWhen, o.deltaSuffix) : ''}<span class="kpi-sub">${esc(o.sub || '')}</span></span>
      ${o.spark ? `<span class="kpi-spark">${sparkline(o.spark, { width: 110, height: 30 })}</span>` : ''}
    </button>`);
    if (o.onClick) card.addEventListener('click', o.onClick);
    return card;
  }

  /**
   * Trend chip: ▲/▼ + value, colored by whether the direction is good.
   * @param {number} delta signed change
   * @param {'up'|'down'} goodWhen which direction is favourable
   */
  function trendChip(delta, goodWhen = 'up', suffix = '') {
    if (delta === 0 || delta === undefined || isNaN(delta)) {
      return '<span class="trend flat">— flat</span>';
    }
    const up = delta > 0;
    const good = (up && goodWhen === 'up') || (!up && goodWhen === 'down');
    const arrow = up
      ? '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 9 8H1z" fill="currentColor"/></svg>'
      : '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.5 1 2h8z" fill="currentColor"/></svg>';
    return `<span class="trend ${good ? 'good' : 'bad'}" title="${up ? 'Up' : 'Down'} vs prior period">${arrow}${Math.abs(delta)}${suffix}</span>`;
  }

  /** Status badge for a vehicle state or severity. */
  function badge(text, kind) {
    const k = kind || ({
      'Active': 'good', 'Idle': 'warn', 'In Shop': 'serious', 'Off-Lease': 'muted',
      'Critical': 'crit', 'Major': 'serious', 'Minor': 'muted',
      'High': 'crit', 'Medium': 'warn', 'Low': 'muted',
      'Healthy': 'good', 'Monitor': 'warn', 'Plan replacement': 'serious', 'Replace now': 'crit'
    }[text] || 'muted');
    return `<span class="badge b-${k}">${esc(text)}</span>`;
  }

  /* ------------------------------------------------------------------ *
   *  Sortable table + CSV export
   * ------------------------------------------------------------------ */

  /**
   * Render a sortable data table.
   * @param {object} cfg
   *   columns: [{key, label, align?, fmt?, sortVal?}]
   *   rows: object[]  (raw row objects; fmt renders each cell)
   *   onRow?: fn(row) — row click handler
   *   csvName?: string — adds an export button to the host card header if present
   */
  function table(container, cfg) {
    let sortKey = cfg.defaultSort || null;
    let sortDir = -1;

    function value(row, col) {
      return col.sortVal ? col.sortVal(row) : row[col.key];
    }

    function render() {
      const rows = cfg.rows.slice();
      if (sortKey) {
        const col = cfg.columns.find(c => c.key === sortKey);
        rows.sort((a, b) => {
          const av = value(a, col), bv = value(b, col);
          return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sortDir;
        });
      }
      const thead = cfg.columns.map(c =>
        `<th class="${c.align === 'right' ? 'ta-r' : ''} ${sortKey === c.key ? 'sorted' : ''}" data-key="${c.key}" role="button" tabindex="0" title="Sort by ${esc(c.label)}">${esc(c.label)}${sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}</th>`).join('');
      const tbody = rows.map((r, i) =>
        `<tr data-i="${i}" class="${cfg.onRow ? 'is-click' : ''}">${cfg.columns.map(c =>
          `<td class="${c.align === 'right' ? 'ta-r num' : ''}">${c.fmt ? c.fmt(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('');

      container.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table></div>`;

      container.querySelectorAll('th').forEach(th => {
        const go = () => {
          const k = th.dataset.key;
          sortDir = (sortKey === k) ? -sortDir : -1;
          sortKey = k;
          render();
        };
        th.addEventListener('click', go);
        th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
      if (cfg.onRow) {
        container.querySelectorAll('tbody tr').forEach(tr =>
          tr.addEventListener('click', () => cfg.onRow(rows[+tr.dataset.i])));
      }
    }
    render();
  }

  /**
   * Download rows as CSV.
   * @param {string} filename
   * @param {string[]} headers
   * @param {Array<Array>} rows
   */
  function exportCSV(filename, headers, rows) {
    const csv = [headers, ...rows]
      .map(r => r.map(cell => {
        const s = String(cell == null ? '' : cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(','))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast(`Exported ${filename}`, 'ok');
  }

  /* ------------------------------------------------------------------ *
   *  Modal, drawer, toast
   * ------------------------------------------------------------------ */

  function overlayShell(kind) {
    const wrap = el(`<div class="${kind}-overlay" role="dialog" aria-modal="true">
      <div class="${kind}"><button type="button" class="ol-close" aria-label="Close">${icon('x', 18)}</button>
      <div class="${kind}-content"></div></div></div>`);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('.ol-close').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('.ol-close').focus();
    return { wrap, body: wrap.querySelector(`.${kind}-content`), close };
  }

  /** Centered modal — returns {body, close}. */
  const modal = () => overlayShell('modal');
  /** Right-hand drill-down drawer — returns {body, close}. */
  const drawer = () => overlayShell('drawer');

  /** Transient notification, top right. */
  function toast(msg, kind = 'ok') {
    let host = document.querySelector('.toast-host');
    if (!host) { host = el('<div class="toast-host" aria-live="polite"></div>'); document.body.appendChild(host); }
    const t = el(`<div class="toast t-${kind}">${kind === 'ok' ? icon('check', 15) : icon('alert', 15)}<span>${esc(msg)}</span></div>`);
    host.appendChild(t);
    setTimeout(() => t.classList.add('leave'), 3400);
    setTimeout(() => t.remove(), 3900);
  }

  /* ------------------------------------------------------------------ *
   *  Exports
   * ------------------------------------------------------------------ */
  Maxim.UI = {
    fmt, el, esc, icon, series, rampColor, STATUS,
    sparkline, barChart, hBarChart, lineChart, heatmap, compositionBar, scoreRing,
    kpiCard, trendChip, badge, table, exportCSV,
    modal, drawer, toast, tooltip, bindTip
  };

})(window.Maxim = window.Maxim || {});
