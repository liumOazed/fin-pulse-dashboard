Pulse.register({
  id: 'multi', order: 3, title: 'Multi-index performance', subtitle: 'Last ~6 months, rebased to 100. Toggle to see strength relative to the S&P 500.',
  render(el, d) {
    const m = d.multi;
    el.innerHTML = `<div class="ctl"><select class="mode"><option value="series">Normalized to 100</option><option value="rs">Relative to S&P 500</option></select></div><div class="plot" style="height:420px"></div>`;
    const plot = el.querySelector('.plot'), sel = el.querySelector('.mode');
    const draw = () => {
      const src = m[sel.value];
      const traces = Object.keys(src).map(k => ({ x: m.dates, y: src[k], name: k, type: 'scatter', mode: 'lines', line: { width: k === 'S&P 500' ? 3 : 1.5 } }));
      Pulse.plot(plot, traces, Pulse.layout({ yaxis: { gridcolor: Pulse.css('--line') }, xaxis: { gridcolor: Pulse.css('--line'), rangebreaks: [{ bounds: ['sat', 'mon'] }] }, shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 100, y1: 100, line: { dash: 'dot', color: Pulse.css('--mut') } }] }));
    };
    sel.onchange = draw; draw();
  }
});
