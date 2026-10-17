Pulse.register({
  id: 'corr', tab: 'markets', order: 2,
  title: 'Correlation regime', subtitle: 'How assets move together (2-day returns). When everything correlates, diversification stops working.',
  render(el, d, tools, st) {
    const P = Pulse, c = d.corr; if (!c) { el.innerHTML = '<div class="muted">Not enough data.</div>'; return; }
    st.view = st.view || 'c20';
    tools.appendChild(P.seg([['c20', '20-day'], ['c90', '90-day'], ['diff', 'Change']], st.view, v => { st.view = v; heat(); }));
    const a = c.avg;
    el.innerHTML = `<div class="cols r"><div><div class="chart-title ht"></div><div class="heat" style="height:440px"></div></div>
      <div><div class="stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat"><div class="k">Avg correlation</div><div class="v">${P.fmt(a.current, 2)}</div><div class="h">${P.fmt(a.pctile, 0)}th pct of 1Y</div></div>
        <div class="stat"><div class="k">90-day avg</div><div class="v">${P.fmt(a.avg90, 2)}</div><div class="h">${a.current > a.avg90 ? 'Rising' : 'Falling'} vs 90-day</div></div>
        <div class="stat"><div class="k">1Y range</div><div class="v">${P.fmt(Math.min(...a.values.filter(v => v != null)), 2)} – ${P.fmt(Math.max(...a.values.filter(v => v != null)), 2)}</div></div></div>
        <div class="chart-title">Average pairwise correlation</div><div class="avg" style="height:300px"></div></div></div>`;
    const neg = P.css('--neg'), pos = P.css('--pos'), mid = P.css('--mid');
    function heat() {
      const z = c[st.view], lim = st.view === 'diff' ? .6 : 1;
      el.querySelector('.ht').textContent = { c20: 'Last 20 trading days', c90: 'Last 90 trading days', diff: 'Change: 20-day minus 90-day' }[st.view];
      const zz = z.map((row, i) => row.map((v, j) => i === j ? null : v));
      P.plot(el.querySelector('.heat'), [{ type: 'heatmap', z: zz, x: c.labels, y: c.labels, zmin: -lim, zmax: lim, xgap: 2, ygap: 2,
        colorscale: [[0, neg], [.5, mid], [1, pos]], hoverongaps: false,
        colorbar: { thickness: 8, outlinewidth: 0, len: .7, tickfont: { size: 10, color: P.css('--muted') } },
        hovertemplate: '%{y} · %{x}<br>%{z:.2f}<extra></extra>' }],
        P.layout({ hovermode: 'closest', xaxis: { showline: false, tickangle: -40, side: 'bottom' }, yaxis: { showgrid: false, autorange: 'reversed' }, margin: { l: 8, r: 8, t: 4, b: 8 } }));
    }
    heat();
    P.plot(el.querySelector('.avg'), [{ x: a.dates, y: a.values, type: 'scatter', mode: 'lines', line: { color: P.css('--s1'), width: 2 }, hovertemplate: '%{y:.2f}<extra></extra>' }],
      P.layout({ yaxis: { side: 'right', zeroline: true, zerolinecolor: P.css('--axis') }, margin: { l: 8, r: 8, t: 4, b: 8 } }));
  }
});
