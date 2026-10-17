Pulse.register({
  id: 'sectors', order: 8, title: 'Sectors: returns, stable beta, rotation', subtitle: 'Beta = weekly, 52 weeks, Blume-adjusted, with downside beta and 95% CI. RRG shows rotation (RS-Ratio vs momentum).',
  render(el, d) {
    const s = d.sectors;
    el.innerHTML = `<div class="ctl"><select class="hz"><option>1W</option><option selected>1M</option><option>3M</option></select></div>
      <div class="row2"><div class="p1" style="height:340px"></div><div class="p2" style="height:340px"></div></div>
      <div class="p3" style="height:460px"></div>
      <div class="muted small">Low R² means beta is unreliable for that sector. Leading = strong and strengthening; Weakening = strong but fading; Lagging = weak; Improving = weak but turning up.</div>`;
    const sel = el.querySelector('.hz'), L = Pulse.layout;
    const bars = () => {
      const v = s.returns[sel.value], idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
      Pulse.plot(el.querySelector('.p1'), [{ type: 'bar', orientation: 'h', x: idx.map(i => v[i]), y: idx.map(i => s.returns.labels[i]),
        marker: { color: idx.map(i => v[i] >= 0 ? Pulse.css('--good') : Pulse.css('--bad')) } }], L({ title: { text: 'Sector return % (' + sel.value + ')', font: { size: 12 } }, margin: { l: 110, r: 10, t: 28, b: 30 }, hovermode: 'closest' }));
    };
    sel.onchange = bars; bars();
    const b = s.beta.slice().sort((x, y) => x.blume - y.blume);
    Pulse.plot(el.querySelector('.p2'), [
      { type: 'bar', orientation: 'h', name: 'Blume-adj beta', x: b.map(r => r.blume), y: b.map(r => r.name), error_x: { type: 'data', array: b.map(r => r.ci), visible: true, color: Pulse.css('--mut') }, marker: { color: '#5b9cf5' },
        customdata: b.map(r => [r.raw, r.downside, r.r2]), hovertemplate: 'adj %{x:.2f}<br>raw %{customdata[0]:.2f}<br>downside %{customdata[1]:.2f}<br>R² %{customdata[2]:.2f}<extra></extra>' },
      { type: 'scatter', mode: 'markers', name: 'Downside beta', x: b.map(r => r.downside), y: b.map(r => r.name), marker: { symbol: 'diamond', color: '#f0b429', size: 8 } }
    ], L({ title: { text: 'Beta vs SPY (weekly, 52w)', font: { size: 12 } }, margin: { l: 110, r: 10, t: 28, b: 30 }, hovermode: 'closest', shapes: [{ type: 'line', yref: 'paper', y0: 0, y1: 1, x0: 1, x1: 1, line: { dash: 'dot', color: Pulse.css('--mut') } }] }));
    const qc = { Leading: '#2ecc8f', Weakening: '#f0b429', Lagging: '#ef5b5b', Improving: '#5b9cf5' };
    const tr = [];
    s.rrg.forEach(r => {
      tr.push({ x: r.x, y: r.y, type: 'scatter', mode: 'lines', line: { color: qc[r.quadrant], width: 1 }, showlegend: false, hoverinfo: 'skip' });
      tr.push({ x: [r.x[r.x.length - 1]], y: [r.y[r.y.length - 1]], type: 'scatter', mode: 'markers+text', text: [r.ticker], textposition: 'top center', name: r.name + ' (' + r.quadrant + ')', marker: { color: qc[r.quadrant], size: 10 }, showlegend: false });
    });
    const all = s.rrg.flatMap(r => r.x.concat(r.y)), lo = Math.min(...all, 98) - 1, hi = Math.max(...all, 102) + 1;
    Pulse.plot(el.querySelector('.p3'), tr, L({ title: { text: 'Relative rotation graph (8-week tail)', font: { size: 12 } }, hovermode: 'closest', xaxis: { title: 'RS-Ratio', range: [lo, hi], gridcolor: Pulse.css('--line') }, yaxis: { title: 'RS-Momentum', range: [lo, hi], gridcolor: Pulse.css('--line') },
      shapes: [{ type: 'line', x0: 100, x1: 100, y0: lo, y1: hi, line: { color: Pulse.css('--mut'), dash: 'dot' } }, { type: 'line', y0: 100, y1: 100, x0: lo, x1: hi, line: { color: Pulse.css('--mut'), dash: 'dot' } }],
      annotations: [[hi, hi, 'Leading', 'right', 'top'], [hi, lo, 'Weakening', 'right', 'bottom'], [lo, lo, 'Lagging', 'left', 'bottom'], [lo, hi, 'Improving', 'left', 'top']].map(a => ({ x: a[0], y: a[1], text: a[2], showarrow: false, xanchor: a[3], yanchor: a[4], font: { color: Pulse.css('--mut'), size: 11 } })) }));
  }
});
