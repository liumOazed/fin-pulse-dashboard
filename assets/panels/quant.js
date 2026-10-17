Pulse.register({
  id: 'quant', order: 4, title: 'Quant intelligence', subtitle: 'Candles, anchored VWAP, Bollinger bands, volume, %B and bandwidth (squeeze detection)',
  render(el, d) {
    const q = d.quant, names = Object.keys(q.tickers);
    el.innerHTML = `<div class="ctl"><select class="tk">${names.map(n => `<option ${n === q.default ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <select class="an"><option value="ytd">VWAP from year start</option><option value="swing">VWAP from swing low</option><option value="hivol">VWAP from highest-volume day</option></select></div>
      <div class="chips"></div><div class="plot" style="height:640px"></div>`;
    const plot = el.querySelector('.plot'), chips = el.querySelector('.chips');
    const draw = () => {
      const t = q.tickers[el.querySelector('.tk').value], an = el.querySelector('.an').value, s = t.stats, x = t.dates;
      const up = t.close.map((c, i) => c >= t.open[i]);
      chips.innerHTML = [
        `ATR% ${Pulse.fmt(s.atr_pct, 2)} (pctile ${Pulse.fmt(s.atr_pctile, 0)})`,
        s.squeeze ? '<span class="warn">Squeeze: bandwidth in low percentile</span>' : `Bandwidth pctile ${Pulse.fmt(s.bw_pctile, 0)}`,
        `RVOL ${Pulse.fmt(s.rvol, 2)}x`, `RSI ${Pulse.fmt(s.rsi, 0)}`, `Dist 200D ${Pulse.sgn(s.dist200, 1)}`,
        `VWAP anchor ${t.vwap_anchor[an]}`
      ].map(c => `<span class="chip">${c}</span>`).join('');
      const L = (y, n, c, dash, w) => ({ x, y, name: n, type: 'scatter', mode: 'lines', line: { color: c, width: w || 1, dash }, xaxis: 'x', yaxis: 'y' });
      const traces = [
        { x, open: t.open, high: t.high, low: t.low, close: t.close, type: 'candlestick', name: 'Price', yaxis: 'y', increasing: { line: { color: Pulse.css('--good') } }, decreasing: { line: { color: Pulse.css('--bad') } } },
        L(t.bb_up, 'BB upper', '#8b94a7', 'dot'), L(t.bb_lo, 'BB lower', '#8b94a7', 'dot'),
        L(t.sma50, 'SMA50', '#f0b429'), L(t.sma200, 'SMA200', '#b07cf5', null, 1.5),
        L(t.vwap[an], 'Anchored VWAP', '#5b9cf5', null, 2),
        { x, y: t.volume, type: 'bar', name: 'Volume', yaxis: 'y2', marker: { color: up.map(u => u ? Pulse.css('--good') : Pulse.css('--bad')), opacity: .6 } },
        { x, y: t.vol_ma20, type: 'scatter', mode: 'lines', name: 'Vol MA20', yaxis: 'y2', line: { color: '#f0b429', width: 1 } },
        { x, y: t.pctb, type: 'scatter', mode: 'lines', name: '%B', yaxis: 'y3', line: { color: '#5b9cf5' } },
        { x, y: t.bandwidth, type: 'scatter', mode: 'lines', name: 'Bandwidth %', yaxis: 'y4', line: { color: '#f0b429', width: 1 } }
      ];
      const g = Pulse.css('--line');
      Pulse.plot(plot, traces, Pulse.layout({
        xaxis: { rangeslider: { visible: false }, gridcolor: g, rangebreaks: [{ bounds: ['sat', 'mon'] }], anchor: 'y3' },
        yaxis: { domain: [.38, 1], gridcolor: g }, yaxis2: { domain: [.2, .33], gridcolor: g },
        yaxis3: { domain: [0, .16], gridcolor: g, range: [-.2, 1.2] },
        yaxis4: { domain: [0, .16], overlaying: 'y3', side: 'right', showgrid: false },
        shapes: [0, 1].map(v => ({ type: 'line', xref: 'paper', x0: 0, x1: 1, yref: 'y3', y0: v, y1: v, line: { dash: 'dot', color: Pulse.css('--mut'), width: 1 } })),
        hovermode: 'x', margin: { l: 55, r: 50, t: 10, b: 30 }, legend: { orientation: 'h', y: 1.06 }
      }));
    };
    el.querySelectorAll('select').forEach(s => s.onchange = draw); draw();
  }
});
