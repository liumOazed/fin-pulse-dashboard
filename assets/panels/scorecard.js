Pulse.register({
  id: 'scorecard', order: 1, title: 'Live signal', subtitle: 'Regime, composite score and its six components (0-100, higher = more risk-on)',
  render(el, d) {
    const h = d.headline, r = d.regime, sc = d.scorecard;
    const tone = { bull: 'good', bear: 'bad', neutral: 'warn' }[r.tone] || 'warn';
    const lab = sc.composite >= 62 ? 'good' : sc.composite >= 45 ? 'warn' : 'bad';
    let html = `<div class="kpi">
      <div><div class="muted small">${h.ticker}</div><div class="big">${Pulse.fmt(h.close, 2)}</div>
        <span class="${Pulse.cls(h.chg1d)}">${Pulse.sgn(h.chg1d, 2)} 1d</span> <span class="muted">RSI ${Pulse.fmt(h.rsi, 0)}</span></div>
      <div><div class="muted small">Regime</div><span class="badge ${tone}">${r.label}</span><div class="muted small">${r.detail}</div></div>
      <div><div class="muted small">Composite</div><div class="big ${lab}">${Pulse.fmt(sc.composite, 0)}</div><span class="badge ${lab}">${sc.label}</span></div>
    </div><div class="tiles">`;
    sc.components.forEach(c => {
      const col = Pulse.css('--' + (c.band === 'good' ? 'good' : c.band === 'bad' ? 'bad' : 'warn'));
      html += `<div class="tile ${c.band}" title="${c.note || ''}"><div class="n">${c.name}</div>
        <div class="v">${Pulse.fmt(c.score, 0)}</div><div class="t">${c.text}</div>${Pulse.spark(c.series, col)}</div>`;
    });
    el.innerHTML = html + '</div>';
  }
});
