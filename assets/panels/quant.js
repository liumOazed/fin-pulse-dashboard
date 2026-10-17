Pulse.register({
  id: 'quant', tab: 'overview', order: 4,
  title: 'Price structure', subtitle: 'Price with Bollinger band, 50/200-day averages and anchored VWAP. Volume below.',
  render(el, d, tools, st) {
    const P = Pulse, q = d.quant, names = Object.keys(q.tickers);
    st.tk = st.tk || q.default; st.an = st.an || 'ytd'; st.rng = st.rng || 126; st.kind = st.kind || 'candle';
    const sel = document.createElement('select'); sel.className = 'sel';
    sel.innerHTML = names.map(n => `<option ${n === st.tk ? 'selected' : ''}>${n}</option>`).join('');
    sel.onchange = () => { st.tk = sel.value; draw(); };
    const an = document.createElement('select'); an.className = 'sel';
    an.innerHTML = [['ytd', 'VWAP · year start'], ['swing', 'VWAP · swing low'], ['hivol', 'VWAP · top-volume day']].map(([v, l]) => `<option value="${v}" ${v === st.an ? 'selected' : ''}>${l}</option>`).join('');
    an.onchange = () => { st.an = an.value; draw(); };
    tools.append(sel, an,
      P.seg([['candle', 'Candles'], ['line', 'Line']], st.kind, v => { st.kind = v; draw(); }),
      P.seg([[63, '3M'], [126, '6M'], [252, '1Y']], st.rng, v => { st.rng = v; draw(); }));
    el.innerHTML = `<div class="stats"></div><div class="legend"></div><div class="plot" style="height:520px"></div>`;
    const plot = el.querySelector('.plot');

    function draw() {
      const t = q.tickers[st.tk], s = t.stats, n = t.dates.length, i0 = Math.max(0, n - st.rng);
      const cut = a => a.slice(i0), x = cut(t.dates);
      const pctl = v => v == null ? '' : `${P.fmt(v, 0)}th pct`;
      el.querySelector('.stats').innerHTML = [
        ['Close', P.fmt(s.close, 2), `${P.sgn(s.dist200)} vs 200D`],
        ['RSI (14)', P.fmt(s.rsi, 0), s.rsi > 70 ? 'Overbought zone' : s.rsi < 30 ? 'Oversold zone' : 'Neutral'],
        ['ATR %', P.fmt(s.atr_pct, 2) + '%', pctl(s.atr_pctile)],
        ['Band width', P.fmt(s.bandwidth, 1) + '%', s.squeeze ? 'Squeeze · breakout risk' : pctl(s.bw_pctile)],
        ['Rel. volume', P.fmt(s.rvol, 2) + '×', 'vs 20-day avg'],
      ].map(([k, v, h]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="h">${h}</div></div>`).join('');

      const c = { s1: P.css('--s1'), s2: P.css('--s2'), mu: P.css('--muted'), up: P.css('--s3'), dn: P.css('--neg'), wash: P.css('--wash'), ink: P.css('--ink') };
      el.querySelector('.legend').innerHTML = `<span><i class="line" style="background:${c.s2}"></i>Anchored VWAP (${t.vwap_anchor[st.an]})</span>
        <span><i class="line" style="background:${c.s1}"></i>50-day</span><span><i class="line" style="background:${c.mu}"></i>200-day</span>
        <span><i style="background:${c.wash};border:1px solid ${c.s1}55"></i>Bollinger band (20, 2σ)</span>`;
      const L = (y, name, color, w, dash) => ({ x, y: cut(y), name, type: 'scatter', mode: 'lines', line: { color, width: w, dash }, hovertemplate: '%{y:.2f}' });
      const price = st.kind === 'candle'
        ? { x, open: cut(t.open), high: cut(t.high), low: cut(t.low), close: cut(t.close), type: 'candlestick', name: st.tk,
            increasing: { line: { color: c.up, width: 1 }, fillcolor: c.up }, decreasing: { line: { color: c.dn, width: 1 }, fillcolor: c.dn }, whiskerwidth: 0 }
        : { x, y: cut(t.close), type: 'scatter', mode: 'lines', name: st.tk, line: { color: c.ink, width: 1.6 }, hovertemplate: '%{y:.2f}' };
      const up = t.close.map((v, i) => v >= t.open[i]);
      const traces = [
        { x, y: cut(t.bb_up), type: 'scatter', mode: 'lines', line: { width: 0 }, hoverinfo: 'skip', name: 'BB upper' },
        { x, y: cut(t.bb_lo), type: 'scatter', mode: 'lines', line: { width: 0 }, fill: 'tonexty', fillcolor: c.wash, hoverinfo: 'skip', name: 'BB lower' },
        L(t.sma200, '200-day', c.mu, 1.4), L(t.sma50, '50-day', c.s1, 1.4), L(t.vwap[st.an], 'VWAP', c.s2, 1.8),
        price,
        { x, y: cut(t.volume), type: 'bar', yaxis: 'y2', name: 'Volume', marker: { color: cut(up).map(u => u ? c.up : c.dn), opacity: .35 }, hovertemplate: '%{y:.3s}' },
      ];
      P.plot(plot, traces, P.layout({
        hovermode: 'x unified', bargap: .2,
        xaxis: { rangeslider: { visible: false }, rangebreaks: [{ bounds: ['sat', 'mon'] }], anchor: 'y2' },
        yaxis: { domain: [.24, 1], side: 'right' },
        yaxis2: { domain: [0, .18], side: 'right', showgrid: false, tickformat: '.2s', nticks: 3 },
        margin: { l: 8, r: 8, t: 4, b: 8 },
      }));
    }
    draw();
  }
});
