/* Pulse core: tabs, panel registry, theme tokens and chart helpers.
   Add a chart: create assets/panels/<name>.js with Pulse.register({...}) and add a <script> tag. */
(function () {
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'markets', label: 'Cross-asset & Sectors' },
  ];
  const panels = [];
  const D = window.PULSE_DATA || null;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const num = v => v != null && !isNaN(v);

  const Pulse = {
    data: D, css, TABS,
    register(p) { p.state = p.state || {}; panels.push(p); },

    fmt: (v, d = 1, s = '') => num(v) ? Number(v).toFixed(d) + s : '–',
    sgn: (v, d = 1, s = '%') => num(v) ? (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + s : '–',
    dir: v => num(v) ? (v > 0 ? 'up' : v < 0 ? 'down' : '') : '',

    /* Shared Plotly layout: quiet grid, no modebar, system font, unified hover */
    layout(extra = {}) {
      const g = css('--grid'), m = css('--muted');
      const ax = { gridcolor: g, zeroline: false, linecolor: css('--axis'), tickcolor: 'rgba(0,0,0,0)', tickfont: { color: m, size: 11 }, automargin: true, showspikes: false };
      const base = {
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { family: 'system-ui,-apple-system,Segoe UI,Roboto,sans-serif', color: css('--ink-2'), size: 12 },
        margin: { l: 8, r: 8, t: 8, b: 8 }, showlegend: false, hovermode: 'x unified',
        hoverlabel: { bgcolor: css('--card'), bordercolor: css('--axis'), font: { color: css('--ink'), size: 12 } },
        xaxis: Object.assign({}, ax, { showgrid: false, showline: true }),
        yaxis: Object.assign({}, ax),
      };
      for (const k of Object.keys(extra)) {
        base[k] = (/^[xy]axis\d*$/.test(k)) ? Object.assign({}, ax, k.startsWith('x') ? { showgrid: false } : {}, extra[k]) : extra[k];
      }
      return base;
    },
    /* x-range with room for outside labels on both sides of zero */
    padRange(vals, pad = .32) {
      const v = vals.filter(num), lo = Math.min(0, ...v), hi = Math.max(0, ...v), w = (hi - lo) || 1;
      return [lo - (lo < 0 ? w * pad : w * .02), hi + (hi > 0 ? w * pad : w * .02)];
    },
    plot(el, traces, layout) {
      return Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false, displaylogo: false });
    },
    hline(y, yref = 'y', color) {
      return { type: 'line', xref: 'paper', x0: 0, x1: 1, yref, y0: y, y1: y, line: { color: color || css('--axis'), width: 1, dash: 'dot' }, layer: 'below' };
    },
    vline(x, xref = 'x') {
      return { type: 'line', yref: 'paper', y0: 0, y1: 1, xref, x0: x, x1: x, line: { color: css('--axis'), width: 1, dash: 'dot' }, layer: 'below' };
    },

    /* Segmented control. opts: [[value,label],...] */
    seg(opts, value, onChange) {
      const w = document.createElement('div'); w.className = 'seg';
      opts.forEach(([v, l]) => {
        const b = document.createElement('button'); b.textContent = l; b.type = 'button';
        if (v === value) b.className = 'on';
        b.onclick = () => { w.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); onChange(v); };
        w.appendChild(b);
      });
      return w;
    },

    spark(vals, color) {
      const v = (vals || []).filter(num); if (v.length < 2) return '';
      const mn = Math.min(...v), mx = Math.max(...v), w = 140, h = 30, r = mx - mn || 1;
      const pts = v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + ',' + (h - 2 - (x - mn) / r * (h - 4)).toFixed(1)).join(' ');
      return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="${pts}"/></svg>`;
    },
    bandColor: b => css(b === 'good' ? '--good' : b === 'bad' ? '--bad' : '--warn'),

    card(p) {
      const el = document.createElement('section');
      el.className = 'card' + (p.width === 'half' ? ' half' : '');
      el.id = 'panel-' + p.id;
      el.innerHTML = `<div class="card-head"><div><h2>${p.title}</h2>${p.subtitle ? `<p class="sub">${p.subtitle}</p>` : ''}</div><div class="card-tools"></div></div><div class="body"></div>`;
      return el;
    },

    start() {
      const root = document.getElementById('panels');
      if (!D) { root.innerHTML = '<div class="card">No data found. Run <code>python scripts/build_data.py --sample</code>.</div>'; return; }
      const m = D.meta;
      document.getElementById('meta').textContent = `Data as of ${m.asof} · updated ${m.generated_at}`;
      const notes = [];
      if (m.sample) notes.push('Sample data: synthetic numbers for layout preview. Run the “Update data & deploy” workflow to load real prices.');
      if (m.aliases) Object.keys(m.aliases).forEach(k => notes.push(`Tadawul (${k}) has no Yahoo feed today, so it is shown using the ${m.aliases[k]} ETF as a proxy.`));
      if (m.missing && m.missing.length) notes.push('Unavailable: ' + m.missing.join(', '));
      const nb = document.getElementById('notice');
      if (notes.length) { nb.hidden = false; nb.innerHTML = notes.join('<br>'); }

      const tabsEl = document.getElementById('tabs');
      tabsEl.innerHTML = TABS.map(t => `<button class="tab" role="tab" data-tab="${t.id}">${t.label}</button>`).join('');
      const current = () => { const h = location.hash.slice(1); return TABS.some(t => t.id === h) ? h : TABS[0].id; };

      const draw = () => {
        const tab = current();
        tabsEl.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
        root.innerHTML = '';
        panels.filter(p => (p.tab || 'overview') === tab)
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
          .forEach(p => {
            const c = Pulse.card(p); root.appendChild(c);
            try { p.render(c.querySelector('.body'), D, c.querySelector('.card-tools'), p.state); }
            catch (e) { c.querySelector('.body').innerHTML = `<div class="err">Panel failed: ${e.message}</div>`; console.error(p.id, e); }
          });
      };
      tabsEl.onclick = e => { const b = e.target.closest('.tab'); if (b) { location.hash = b.dataset.tab; } };
      window.addEventListener('hashchange', () => { draw(); window.scrollTo({ top: 0 }); });
      Pulse.redraw = draw; draw();

      document.getElementById('themeBtn').onclick = () => {
        const r = document.documentElement;
        const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
        r.dataset.theme = dark ? 'light' : 'dark';
        try { localStorage.setItem('pulse-theme', r.dataset.theme); } catch (e) {}
        draw();
      };
    },
  };
  try { const t = localStorage.getItem('pulse-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  window.Pulse = Pulse;
})();
