Pulse.register({
  id: 'corr', order: 7, width: 'half', title: 'Correlation regime', subtitle: '2-day returns (reduces time-zone mismatch). Compare short vs long window and watch average correlation.',
  render(el, d) {
    const c = d.corr; if (!c) { el.innerHTML = '<div class="muted">Not enough data.</div>'; return; }
    const a = c.avg;
    el.innerHTML = `<div class="chips"><span class="chip">Avg corr now ${Pulse.fmt(a.current, 2)} (pctile ${Pulse.fmt(a.pctile, 0)})</span><span class="chip">20d ${Pulse.fmt(a.avg20, 2)}</span><span class="chip">90d ${Pulse.fmt(a.avg90, 2)}</span></div>
      <div class="row2"><div class="p1" style="height:300px"></div><div class="p2" style="height:300px"></div><div class="p3" style="height:300px"></div><div class="p4" style="height:300px"></div></div>`;
    const hm = (sel, z, title, zmin, zmax, cs) => Pulse.plot(el.querySelector(sel), [{ z, x: c.labels, y: c.labels, type: 'heatmap', zmin, zmax, colorscale: cs, showscale: false,
      text: z.map(r => r.map(v => v == null ? '' : v.toFixed(2))), texttemplate: '%{text}', textfont: { size: 8 } }],
      Pulse.layout({ title: { text: title, font: { size: 12 } }, margin: { l: 70, r: 5, t: 28, b: 70 }, yaxis: { autorange: 'reversed' }, xaxis: { tickangle: -45 }, hovermode: 'closest' }));
    const rb = 'RdBu';
    hm('.p1', c.c20, '20-day', -1, 1, rb); hm('.p2', c.c90, '90-day', -1, 1, rb); hm('.p3', c.diff, '20d minus 90d (what changed)', -.6, .6, rb);
    Pulse.plot(el.querySelector('.p4'), [{ x: a.dates, y: a.values, type: 'scatter', line: { color: '#f0b429' }, name: 'Avg pairwise corr' }],
      Pulse.layout({ title: { text: 'Average pairwise correlation', font: { size: 12 } }, margin: { l: 35, r: 10, t: 28, b: 30 } }));
  }
});
