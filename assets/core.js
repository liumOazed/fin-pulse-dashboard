/* Pulse core: panel registry, theme, helpers. Add a chart = Pulse.register({...}) in a new panels/*.js */
(function () {
  const panels = [];
  const D = window.PULSE_DATA || null;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const Pulse = {
    data: D,
    register(p) { panels.push(p); },
    css,
    fmt: (v, d = 1, s = '') => (v == null || isNaN(v)) ? '–' : Number(v).toFixed(d) + s,
    sgn: (v, d = 1, s = '%') => (v == null || isNaN(v)) ? '–' : (v > 0 ? '+' : '') + Number(v).toFixed(d) + s,
    cls: v => v > 0 ? 'good' : v < 0 ? 'bad' : '',
    layout(extra) {
      return Object.assign({
        paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: css('--txt'), size: 12 }, margin: { l: 50, r: 20, t: 10, b: 36 },
        xaxis: { gridcolor: css('--line') }, yaxis: { gridcolor: css('--line') },
        legend: { orientation: 'h', y: -0.15 }, hovermode: 'x unified'
      }, extra || {});
    },
    plot(el, traces, layout, cfg) {
      return Plotly.react(el, traces, layout, Object.assign({ responsive: true, displayModeBar: false, displaylogo: false }, cfg || {}));
    },
    spark(vals, color) {
      const v = (vals || []).filter(x => x != null); if (v.length < 2) return '';
      const mn = Math.min(...v), mx = Math.max(...v), w = 120, h = 28, r = mx - mn || 1;
      const pts = v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + ',' + (h - (x - mn) / r * h).toFixed(1)).join(' ');
      return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${pts}"/></svg>`;
    },
    card(p) {
      const el = document.createElement('section');
      el.className = 'card' + (p.width === 'half' ? ' half' : '');
      el.id = 'panel-' + p.id;
      el.innerHTML = `<h2>${p.title}</h2><div class="sub">${p.subtitle || ''}</div><div class="body"></div>`;
      return el;
    },
    start() {
      const root = document.getElementById('panels');
      if (!D) { root.innerHTML = '<div class="card">No data found. Run <code>python scripts/build_data.py --sample</code>.</div>'; return; }
      const m = D.meta;
      document.getElementById('meta').textContent = `As of ${m.asof} · built ${m.generated_at}`;
      const b = document.getElementById('banner'), msgs = [];
      if (m.sample) msgs.push('SAMPLE DATA - synthetic numbers for layout preview. Run the "Update data & deploy" workflow to load real prices.');
      if (m.missing && m.missing.length) msgs.push('Missing tickers: ' + m.missing.join(', '));
      if (msgs.length) { b.hidden = false; b.textContent = msgs.join('  |  '); }
      const draw = () => {
        root.innerHTML = '';
        panels.slice().sort((a, b) => (a.order || 99) - (b.order || 99)).forEach(p => {
          const c = Pulse.card(p); root.appendChild(c);
          try { p.render(c.querySelector('.body'), D); }
          catch (e) { c.querySelector('.body').innerHTML = `<div class="bad">Panel failed: ${e.message}</div>`; console.error(p.id, e); }
        });
      };
      Pulse.redraw = draw; draw();
      document.getElementById('themeBtn').onclick = () => {
        const r = document.documentElement, t = r.dataset.theme === 'light' ? 'dark' : 'light';
        r.dataset.theme = t; try { localStorage.setItem('pulse-theme', t); } catch (e) {}
        draw();
      };
    }
  };
  try { const t = localStorage.getItem('pulse-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  window.Pulse = Pulse;
})();
