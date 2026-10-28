Pulse.register({
  id: 'quant', tab: 'overview', order: 3,
  title: 'Price structure', subtitle: 'Price with Bollinger band, 50/200-day averages and anchored VWAP for any major index or US ETF. Volume below where the feed has it.',
  render(el, d, tools, st) {
    const P = Pulse, q = d.quant, names = Object.keys(q.tickers);
    if (!names.length) { el.innerHTML = '<div class="muted small">Price data not available yet.</div>'; return; }
    if (!q.tickers[st.tk]) st.tk = q.default || names[0];
    st.an = st.an || 'ytd'; st.rng = st.rng || 126; st.kind = st.kind || 'candle';
    const groups = q.groups || [['Tickers', names]];
    const opt = n => `<option value="${n}" ${n === st.tk ? 'selected' : ''}>${q.tickers[n].label || n}</option>`;
    const sel = document.createElement('select'); sel.className = 'sel'; sel.setAttribute('aria-label', 'Index');
    sel.innerHTML = groups.map(([g, ks]) => `<optgroup label="${g}">${ks.map(opt).join('')}</optgroup>`).join('');
    sel.onchange = () => { st.tk = sel.value; draw(); };
    const an = document.createElement('select'); an.className = 'sel';
    an.innerHTML = [['ytd', 'VWAP · year start'], ['swing', 'VWAP · swing low'], ['hivol', 'VWAP · top-volume day']].map(([v, l]) => `<option value="${v}" ${v === st.an ? 'selected' : ''}>${l}</option>`).join('');
    an.onchange = () => { st.an = an.value; draw(); };
    an.setAttribute('aria-label', 'VWAP anchor');
    tools.append(sel, an,
      P.seg([['candle', 'Candles'], ['line', 'Line']], st.kind, v => { st.kind = v; draw(); }),
      P.seg([[63, '3M'], [126, '6M'], [252, '1Y']], st.rng, v => { st.rng = v; draw(); }));
    el.innerHTML = `<div class="stats"></div><div class="legend"></div><div class="plot" style="height:520px"></div>`;
    const plot = el.querySelector('.plot');

    function draw() {
      const t = q.tickers[st.tk], s = t.stats, n = t.dates.length, i0 = Math.max(0, n - st.rng);
      const vol = t.has_volume !== false && t.volume && t.vwap && t.vwap[st.an];
      an.disabled = !vol; an.title = vol ? '' : 'This index feed has no volume, so VWAP is unavailable';
      const cut = a => a.slice(i0), x = cut(t.dates);
      const pctl = v => v == null ? '' : `${P.fmt(v, 0)}th pct`;
      el.querySelector('.stats').innerHTML = [
        ['Close' + (t.ccy ? ` · ${t.ccy}` : ''), P.fmt(s.close, 2), `${P.sgn(s.dist200)} vs 200D`],
        ['RSI (14)', P.fmt(s.rsi, 0), s.rsi > 70 ? 'Overbought zone' : s.rsi < 30 ? 'Oversold zone' : 'Neutral'],
        ['ATR %', P.fmt(s.atr_pct, 2) + '%', pctl(s.atr_pctile)],
        ['Band width', P.fmt(s.bandwidth, 1) + '%', s.squeeze ? 'Squeeze · breakout risk' : pctl(s.bw_pctile)],
        vol ? ['Rel. volume', P.fmt(s.rvol, 2) + '×', 'vs 20-day avg'] : ['Rel. volume', '–', 'No volume in feed'],
      ].map(([k, v, h]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div><div class="h">${h}</div></div>`).join('');

      const c = { s1: P.css('--s1'), s2: P.css('--s2'), mu: P.css('--muted'), up: P.css('--s3'), dn: P.css('--neg'), wash: P.css('--wash'), ink: P.css('--ink') };
      el.querySelector('.legend').innerHTML = (vol ? `<span><i class="line" style="background:${c.s2}"></i>Anchored VWAP (${t.vwap_anchor[st.an]})</span>` : '') + `
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
        L(t.sma200, '200-day', c.mu, 1.4), L(t.sma50, '50-day', c.s1, 1.4),
        ...(vol ? [L(t.vwap[st.an], 'VWAP', c.s2, 1.8)] : []),
        price,
        ...(vol ? [{ x, y: cut(t.volume), type: 'bar', yaxis: 'y2', name: 'Volume', marker: { color: cut(up).map(u => u ? c.up : c.dn), opacity: .35 }, hovertemplate: '%{y:.3s}' }] : []),
      ];
      P.plot(plot, traces, P.layout({
        hovermode: 'x unified', bargap: .2,
        xaxis: { rangeslider: { visible: false }, rangebreaks: [{ bounds: x.some(v => new Date(v + 'T00:00:00Z').getUTCDay() === 0) ? ['fri', 'sun'] : ['sat', 'mon'] }], anchor: vol ? 'y2' : 'y' },
        yaxis: { domain: vol ? [.24, 1] : [0, 1], side: 'right' },
        yaxis2: { domain: [0, .18], side: 'right', showgrid: false, tickformat: '.2s', nticks: 3, visible: !!vol },
        margin: { l: 8, r: 8, t: 4, b: 8 },
      }));
    }
    draw();
  }
});
