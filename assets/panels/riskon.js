Pulse.register({
  id: 'riskon', tab: 'markets', order: 1,
  title: 'Risk appetite', subtitle: 'Six cross-asset ratios, each scored against its own past year. 50 = neutral.',
  render(el, d, tools, st) {
    const P = Pulse, r = d.riskon;
    const band = r.score >= 62 ? 'good' : r.score >= 45 ? 'warn' : 'bad';
    const lab = r.score >= 62 ? 'Risk-on' : r.score >= 45 ? 'Neutral' : 'Risk-off';
    el.innerHTML = `<div class="cols"><div>
        <div class="hero" style="margin-bottom:8px"><div><div class="label">Score today</div><div class="big">${P.fmt(r.score, 0)}<span class="muted" style="font-size:16px;font-weight:500"> / 100</span></div></div>
        <span class="pill" style="margin-bottom:6px"><i style="background:${P.bandColor(band)}"></i>${lab}</span></div>
        <div class="chart-title">Past 12 months</div><div class="hist" style="height:240px"></div></div>
      <div><div class="chart-title">What is driving it <span class="muted" style="font-weight:400">· z-score, right = risk-on</span></div><div class="comp" style="height:300px"></div></div></div>`;
    const s1 = P.css('--s1');
    P.plot(el.querySelector('.hist'), [{ x: r.history.dates, y: r.history.values, type: 'scatter', mode: 'lines', line: { color: s1, width: 2 }, fill: 'tozeroy', fillcolor: P.css('--wash'), hovertemplate: '%{y:.0f}<extra></extra>' }],
      P.layout({ yaxis: { range: [0, 100], side: 'right', tickvals: [0, 25, 50, 75, 100] }, shapes: [P.hline(50)], margin: { l: 8, r: 8, t: 4, b: 8 } }));
    const comps = r.components.slice().sort((a, b) => a.z - b.z);
    const short = n => n.replace(/\s*\(.*\)/, '');
    P.plot(el.querySelector('.comp'), [{ type: 'bar', orientation: 'h', y: comps.map(c => short(c.name)), x: comps.map(c => c.z),
      marker: { color: comps.map(c => c.z >= 0 ? P.css('--pos') : P.css('--neg')) },
      text: comps.map(c => P.sgn(c.z, 1, '')), textposition: 'outside', cliponaxis: false, textfont: { size: 11, color: P.css('--ink-2') },
      customdata: comps.map(c => [c.name, c.desc, c.value]), hovertemplate: '%{customdata[0]}<br>z = %{x:.2f}<br>%{customdata[1]}<extra></extra>' }],
      P.layout({ hovermode: 'closest', bargap: .45, xaxis: { range: [-3.4, 3.4], zeroline: true, zerolinecolor: P.css('--axis'), showline: false, tickvals: [-2, -1, 0, 1, 2] }, yaxis: { showgrid: false, tickfont: { size: 12, color: P.css('--ink-2') } }, margin: { l: 8, r: 8, t: 4, b: 8 } }));
  }
});
