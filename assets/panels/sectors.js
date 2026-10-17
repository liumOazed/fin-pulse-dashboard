Pulse.register({
  id: 'sectors', tab: 'markets', order: 3,
  title: 'Sectors', subtitle: 'Returns, stable beta vs SPY (weekly, 52 weeks, Blume-adjusted) and rotation.',
  render(el, d, tools, st) {
    const P = Pulse, s = d.sectors; st.hz = st.hz || '1M';
    tools.appendChild(P.seg([['1W', '1W'], ['1M', '1M'], ['3M', '3M']], st.hz, v => { st.hz = v; bars(); }));
    el.innerHTML = `<div class="cols"><div><div class="chart-title rt"></div><div class="p1" style="height:360px"></div></div>
      <div><div class="chart-title">Beta vs SPY <span class="muted" style="font-weight:400">· dot = adjusted beta, line = 95% range</span></div><div class="p2" style="height:360px"></div></div></div>
      <div style="height:24px"></div>
      <div class="cols r"><div><div class="chart-title">Rotation (relative strength vs momentum)</div><div class="p3" style="height:440px"></div></div>
      <div><div class="chart-title">By quadrant</div><div class="quads"></div></div></div>`;
    const ylab = { tickfont: { size: 12, color: P.css('--ink-2') }, showgrid: false };

    function bars() {
      el.querySelector('.rt').textContent = 'Return · ' + st.hz;
      const v = s.returns[st.hz], idx = v.map((x, i) => i).sort((a, b) => v[a] - v[b]);
      P.plot(el.querySelector('.p1'), [{ type: 'bar', orientation: 'h', x: idx.map(i => v[i]), y: idx.map(i => s.returns.labels[i]),
        marker: { color: idx.map(i => v[i] >= 0 ? P.css('--pos') : P.css('--neg')) },
        text: idx.map(i => P.sgn(v[i], 1)), textposition: 'outside', cliponaxis: false, textfont: { size: 11, color: P.css('--ink-2') },
        hovertemplate: '%{y}: %{x:+.1f}%<extra></extra>' }],
        P.layout({ hovermode: 'closest', bargap: .4, xaxis: { range: P.padRange(v), showticklabels: false, showline: false, zeroline: true, zerolinecolor: P.css('--axis') }, yaxis: ylab, margin: { l: 8, r: 8, t: 4, b: 8 } }));
    }
    bars();

    const b = s.beta.slice().sort((x, y) => x.blume - y.blume);
    P.plot(el.querySelector('.p2'), [{
      type: 'scatter', mode: 'markers', x: b.map(r => r.blume), y: b.map(r => r.name),
      error_x: { type: 'data', array: b.map(r => r.ci), color: P.css('--axis'), thickness: 2, width: 0 },
      marker: { color: P.css('--s1'), size: 10, line: { color: P.css('--card'), width: 2 } },
      customdata: b.map(r => [r.raw, r.downside, r.r2]),
      hovertemplate: '<b>%{y}</b><br>Adjusted beta %{x:.2f}<br>Raw %{customdata[0]:.2f} · Downside %{customdata[1]:.2f}<br>R² %{customdata[2]:.2f}<extra></extra>' }],
      P.layout({ hovermode: 'closest', shapes: [P.vline(1)], xaxis: { showgrid: true, gridcolor: P.css('--grid'), showline: false }, yaxis: ylab, margin: { l: 8, r: 8, t: 4, b: 8 } }));

    const Q = { Leading: '--s3', Weakening: '--s4', Lagging: '--neg', Improving: '--s1' };
    const pts = s.rrg.map(r => ({ ...r, cx: r.x[r.x.length - 1], cy: r.y[r.y.length - 1] }));
    const ext = Math.max(4, ...pts.map(p => Math.max(Math.abs(p.cx - 100), Math.abs(p.cy - 100)))) * 1.18;
    const lo = 100 - ext, hi = 100 + ext;
    const rect = (x0, x1, y0, y1, v) => ({ type: 'rect', x0, x1, y0, y1, line: { width: 0 }, fillcolor: P.css(v), opacity: .07, layer: 'below' });
    const ann = (x, y, t, xa, ya) => ({ x, y, text: t, showarrow: false, xanchor: xa, yanchor: ya, font: { size: 11, color: P.css('--muted') } });
    P.plot(el.querySelector('.p3'), [{
      type: 'scatter', mode: 'markers+text', x: pts.map(p => p.cx), y: pts.map(p => p.cy), text: pts.map(p => p.ticker), textposition: 'top center',
      textfont: { size: 11, color: P.css('--ink-2') },
      marker: { size: 12, color: pts.map(p => P.css(Q[p.quadrant])), line: { color: P.css('--card'), width: 2 } },
      customdata: pts.map(p => [p.name, p.quadrant]), hovertemplate: '<b>%{customdata[0]}</b><br>%{customdata[1]}<br>RS-Ratio %{x:.1f} · Momentum %{y:.1f}<extra></extra>' }],
      P.layout({ hovermode: 'closest',
        xaxis: { range: [lo, hi], showgrid: false, showline: false, title: { text: 'Relative strength →', font: { size: 11, color: P.css('--muted') } } },
        yaxis: { range: [lo, hi], showgrid: false, title: { text: 'Momentum →', font: { size: 11, color: P.css('--muted') } } },
        shapes: [rect(100, hi, 100, hi, '--s3'), rect(100, hi, lo, 100, '--s4'), rect(lo, 100, lo, 100, '--neg'), rect(lo, 100, 100, hi, '--s1'), P.vline(100), P.hline(100)],
        annotations: [ann(hi, hi, 'Leading', 'right', 'top'), ann(hi, lo, 'Weakening', 'right', 'bottom'), ann(lo, lo, 'Lagging', 'left', 'bottom'), ann(lo, hi, 'Improving', 'left', 'top')],
        margin: { l: 8, r: 8, t: 4, b: 8 } }));

    const desc = { Leading: 'Strong and strengthening', Improving: 'Weak but turning up', Weakening: 'Strong but fading', Lagging: 'Weak and weakening' };
    el.querySelector('.quads').innerHTML = ['Leading', 'Improving', 'Weakening', 'Lagging'].map(q => {
      const list = pts.filter(p => p.quadrant === q).map(p => p.name).join(', ') || '<span class="muted">None</span>';
      return `<div class="flag" style="grid-template-columns:16px 1fr"><span class="dot" style="background:${P.css(Q[q])}"></span>
        <div><div style="font-weight:600">${q} <span class="muted small" style="font-weight:400">· ${desc[q]}</span></div><div class="small" style="color:var(--ink-2)">${list}</div></div></div>`;
    }).join('') + '<div class="note">Low R² in the beta chart means the beta estimate is unreliable for that sector.</div>';
  }
});
