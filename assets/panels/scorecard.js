Pulse.register({
  id: 'scorecard', tab: 'overview', order: 1,
  title: 'Live signal', subtitle: 'Market regime and a 0–100 composite built from six components. Higher = more risk-on.',
  render(el, d) {
    const h = d.headline, r = d.regime, sc = d.scorecard, P = Pulse;
    const toneVar = { bull: '--good', bear: '--bad' }[r.tone] || '--warn';
    const compBand = /on/i.test(sc.label) && !/off/i.test(sc.label) ? 'good' : /off/i.test(sc.label) ? 'bad' : 'warn';
    let html = `<div class="hero">
      <div><div class="label">${h.ticker} close</div><div class="big">${P.fmt(h.close, 2)}</div>
        <div class="small"><span class="${P.dir(h.chg1d)}">${P.sgn(h.chg1d, 2)}</span> <span class="muted">today · RSI ${P.fmt(h.rsi, 0)}</span></div></div>
      <div><div class="label">Regime</div><span class="pill"><i style="background:${P.css(toneVar)}"></i>${r.label}</span>
        <div class="small muted" style="margin-top:4px">${r.detail}</div></div>
      <div style="min-width:200px"><div class="label">Composite</div>
        <div class="big">${P.fmt(sc.composite, 0)}<span class="muted" style="font-size:16px;font-weight:500"> / 100</span></div>
        <div class="meter" style="margin:6px 0 4px"><span style="width:${sc.composite}%;background:${P.bandColor(compBand)}"></span></div>
        <span class="pill"><i style="background:${P.bandColor(compBand)}"></i>${sc.label}</span></div>
    </div><div class="tiles">`;
    sc.components.forEach(c => {
      html += `<div class="tile" title="${c.note || ''}">
        <div class="n"><span>${c.name}</span></div>
        <div class="v">${P.fmt(c.score, 0)}</div>
        <div class="meter"><span style="width:${c.score}%;background:${P.bandColor(c.band)}"></span></div>
        <div class="t">${c.text}</div>${P.spark(c.series, P.css('--muted'))}</div>`;
    });
    el.innerHTML = html + '</div>';
  }
});
