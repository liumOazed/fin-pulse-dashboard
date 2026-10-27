Pulse.register({
  id: 'regime', tab: 'overview', order: 1.5,
  title: 'Market regime', subtitle: 'Bull / Neutral / Bear for each index, from several detectors combined by an equal-weight vote. Click an index for its breakdown.',
  render(el, d, tools, st) {
    const P = Pulse, R = d.regimes, rows = (R && R.markets) || [];
    if (!rows.length) { el.innerHTML = '<div class="muted small">Regime data not available yet. It appears after the next data refresh.</div>'; return; }
    if (!rows.some(m => m.key === st.pick)) st.pick = rows[0].key;

    const S = ['bull', 'neutral', 'bear'];
    const NAME = { bull: 'Bull', neutral: 'Neutral', bear: 'Bear' };
    const COL = { bull: P.css('--good'), neutral: P.css('--warn'), bear: P.css('--bad') };
    const pct = v => Math.round(v * 100) + '%';
    const pill = (lab, extra = '') => `<span class="pill rg-pill"><i style="background:${COL[lab]}"></i>${NAME[lab]}${extra}</span>`;
    const stack = (probs, h = 6) => `<div class="rg-stack" style="height:${h}px">${S.map(s => `<span style="width:${probs[s] * 100}%;background:${COL[s]}" title="${NAME[s]} ${pct(probs[s])}"></span>`).join('')}</div>`;
    const rgba = (hex, a) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
    const fmtDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    function draw() {
      const c = R.counts, n = rows.length, m = rows.find(x => x.key === st.pick);
      const glob = `<div class="rg-global">
        <div><span class="rg-k">Worldwide</span> ${S.map(s => `<b style="color:${COL[s]}">${c[s]}</b> ${NAME[s]}`).join(' <span class="muted">·</span> ')} <span class="muted">of ${n} markets</span></div>
        ${stack({ bull: c.bull / n, neutral: c.neutral / n, bear: c.bear / n }, 6)}</div>`;

      const strip = `<div class="rg-strip">${rows.map(x => `<button type="button" class="rg-chip${x.key === st.pick ? ' on' : ''}" data-key="${x.key}">
          <span class="rg-name">${x.name}</span>
          <span class="rg-lab" style="color:${COL[x.label]}">${NAME[x.label]} <span>${pct(x.probs[x.label])}</span></span>
          ${stack(x.probs, 3)}</button>`).join('')}</div>`;

      const notes = [];
      if (m.proxy) notes.push(`Shown via the ${m.proxy} ETF (no index feed), so the history is shorter and less reliable.`);
      else if (!m.reliable) notes.push(`Only ${m.n_obs} days of history, so treat this call with extra caution.`);
      if (m.n_models < 4) notes.push('The cross-asset model uses US data (credit, VIX), so it only votes on US indices.');

      const detail = `<div class="cols l rg-detail">
        <div>
          <div class="rg-k">${m.name} consensus</div>
          <div class="rg-big" style="color:${COL[m.label]}">${NAME[m.label]} <span>${pct(m.probs[m.label])}</span></div>
          <div class="small muted">Since ${fmtDate(m.since)} · as of ${fmtDate(m.asof)}</div>
          <div style="margin:12px 0 4px">${stack(m.probs, 8)}</div>
          <div class="rg-legend">${S.map(s => `<span><i style="background:${COL[s]}"></i>${NAME[s]} ${pct(m.probs[s])}</span>`).join('')}</div>
          <div class="rg-agree"><span class="rg-k">Agreement</span><b>${m.agree} of ${m.n_models}</b> models vote ${NAME[m.label]}
            <div class="meter"><span style="width:${m.agree / m.n_models * 100}%;background:${COL[m.label]}"></span></div></div>
          <div class="tbl-wrap"><table class="t rg-votes"><thead><tr><th>Model</th><th>Vote</th><th>Bull</th><th>Neutral</th><th>Bear</th></tr></thead><tbody>
            ${m.models.map(v => `<tr><td>${v.name}</td><td>${pill(v.label)}</td>${S.map(s => `<td>${pct(v.probs[s])}</td>`).join('')}</tr>`).join('')}
          </tbody></table></div>
          ${notes.length ? `<div class="note">${notes.join('<br>')}</div>` : ''}
        </div>
        <div><div class="chart-title">Consensus probabilities, last 12 months</div><div class="rg-chart" style="height:300px"></div></div>
      </div>`;

      el.innerHTML = glob + strip + detail;
      el.querySelectorAll('.rg-chip').forEach(b => b.onclick = () => { st.pick = b.dataset.key; draw(); });

      const h = m.history;
      const tr = S.slice().reverse().map(s => ({
        x: h.dates, y: h[s], name: NAME[s], type: 'scatter', mode: 'lines', stackgroup: 'p',
        line: { width: 1, color: COL[s] }, fillcolor: rgba(COL[s], .32),
        hovertemplate: `${NAME[s]} %{y:.0%}<extra></extra>`,
      }));
      P.plot(el.querySelector('.rg-chart'), tr, P.layout({
        margin: { l: 8, r: 8, t: 4, b: 8 }, shapes: [P.hline(.5)],
        yaxis: { range: [0, 1], tickformat: '.0%', side: 'right', dtick: .25 },
      }));
    }
    draw();
  }
});
