Pulse.register({
  id: 'riskon', order: 6, width: 'half', title: 'Risk-on / risk-off composite', subtitle: 'Cross-asset ratios as 1-year z-scores; 50 = neutral',
  render(el, d) {
    const r = d.riskon, col = r.score >= 62 ? 'good' : r.score >= 45 ? 'warn' : 'bad';
    el.innerHTML = `<div class="kpi"><div class="big ${col}">${Pulse.fmt(r.score, 0)}</div><span class="muted">/ 100</span></div><div class="plot" style="height:200px"></div>
      <table class="t"><thead><tr><th>Signal</th><th>z-score</th><th>Reading</th></tr></thead><tbody>${r.components.map(c =>
      `<tr><td>${c.name}</td><td class="${Pulse.cls(c.z)}">${Pulse.sgn(c.z, 2, '')}</td><td class="muted">${c.desc}</td></tr>`).join('')}</tbody></table>`;
    Pulse.plot(el.querySelector('.plot'), [{ x: r.history.dates, y: r.history.values, type: 'scatter', fill: 'tozeroy', line: { color: '#5b9cf5' }, fillcolor: 'rgba(91,156,245,.15)', name: 'Score' }],
      Pulse.layout({ yaxis: { range: [0, 100], gridcolor: Pulse.css('--line') }, margin: { l: 35, r: 10, t: 5, b: 25 }, shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 50, y1: 50, line: { dash: 'dot', color: Pulse.css('--mut') } }] }));
  }
});
