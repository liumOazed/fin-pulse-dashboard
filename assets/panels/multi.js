Pulse.register({
  id: 'multi', tab: 'overview', order: 3,
  title: 'Global index performance', subtitle: 'Ranked return over the period. Click a bar to compare that index with the S&P 500.',
  render(el, d, tools, st) {
    const P = Pulse, m = d.multi, names = Object.keys(m.series), BENCH = 'S&P 500';
    st.win = st.win || 126; st.pick = st.pick || null;
    tools.appendChild(P.seg([[21, '1M'], [63, '3M'], [126, '6M']], st.win, v => { st.win = v; draw(); }));
    el.innerHTML = `<div class="cols l"><div><div class="chart-title">Return over period</div><div class="bars" style="height:380px"></div></div>
      <div><div class="legend lg"></div><div class="line" style="height:356px"></div></div></div>`;
    const bars = el.querySelector('.bars'), line = el.querySelector('.line'), lg = el.querySelector('.legend');

    const slice = () => {
      const n = m.dates.length, s = Math.max(0, n - st.win - 1);
      const dates = m.dates.slice(s), out = {};
      names.forEach(k => {
        const v = m.series[k].slice(s); const b = v.find(x => x != null);
        out[k] = v.map(x => x == null ? null : x / b * 100);
      });
      return { dates, out };
    };
    const last = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };

    function draw() {
      const { dates, out } = slice();
      const ret = names.map(k => ({ k, r: last(out[k]) - 100 })).sort((a, b) => a.r - b.r);
      if (!st.pick || !names.includes(st.pick) || st.pick === BENCH) st.pick = ret.filter(x => x.k !== BENCH).slice(-1)[0].k;
      const pos = P.css('--pos'), neg = P.css('--neg');
      P.plot(bars, [{
        type: 'bar', orientation: 'h', y: ret.map(x => x.k), x: ret.map(x => x.r),
        marker: { color: ret.map(x => x.r >= 0 ? pos : neg), opacity: ret.map(x => x.k === st.pick || x.k === BENCH ? 1 : .55) },
        text: ret.map(x => P.sgn(x.r, 1)), textposition: 'outside', cliponaxis: false,
        textfont: { size: 11, color: P.css('--ink-2') },
        hovertemplate: '%{y}: %{x:+.1f}%<extra></extra>',
      }], P.layout({ hovermode: 'closest', bargap: .35, margin: { l: 8, r: 8, t: 4, b: 8 },
        xaxis: { range: P.padRange(ret.map(x => x.r)), showticklabels: false, showline: false, zeroline: true, zerolinecolor: P.css('--axis') },
        yaxis: { showgrid: false, tickfont: { size: 12, color: P.css('--ink-2') } } }));
      bars.on && bars.removeAllListeners && bars.removeAllListeners('plotly_click');
      bars.on('plotly_click', e => { const k = e.points[0].y; if (k !== BENCH) { st.pick = k; draw(); } });

      const grey = P.css('--axis'), s1 = P.css('--s1'), s2 = P.css('--s2');
      const tr = names.filter(k => k !== BENCH && k !== st.pick).map(k => ({ x: dates, y: out[k], type: 'scatter', mode: 'lines', line: { color: grey, width: 1 }, opacity: .6, hoverinfo: 'skip', name: k }));
      tr.push({ x: dates, y: out[BENCH], name: BENCH, type: 'scatter', mode: 'lines', line: { color: s1, width: 2.2 }, hovertemplate: '%{y:.1f}' });
      tr.push({ x: dates, y: out[st.pick], name: st.pick, type: 'scatter', mode: 'lines', line: { color: s2, width: 2.2 }, hovertemplate: '%{y:.1f}' });
      lg.innerHTML = `<span><i class="line" style="background:${s1}"></i>${BENCH} ${P.sgn(last(out[BENCH]) - 100)}</span>
        <span><i class="line" style="background:${s2}"></i>${st.pick} ${P.sgn(last(out[st.pick]) - 100)}</span>
        <span class="muted"><i class="line" style="background:${grey}"></i>Other indices</span>`;
      P.plot(line, tr, P.layout({ shapes: [P.hline(100)], margin: { l: 8, r: 8, t: 4, b: 8 },
        xaxis: { rangebreaks: [{ bounds: ['sat', 'mon'] }] }, yaxis: { side: 'right', ticksuffix: '' } }));
    }
    draw();
  }
});
