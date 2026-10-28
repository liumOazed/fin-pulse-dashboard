Pulse.register({
  id: 'scorecard', tab: 'overview', order: 1,
  title: 'Live signal', subtitle: 'Pick a market to see its price, regime and a 0–100 composite. Higher = more risk-on.',
  render(el, d, tools, st) {
    const P = Pulse, sig = d.signals, rows = (sig && sig.markets) || [];
    if (!rows.length) { el.innerHTML = '<div class="muted small">Signal data not available yet. It appears after the next data refresh.</div>'; return; }
    const regs = {}; ((d.regimes && d.regimes.markets) || []).forEach(r => regs[r.key] = r);

    const S = ['bull', 'neutral', 'bear'];
    const NAME = { bull: 'Bull', neutral: 'Neutral', bear: 'Bear' };
    const COL = { bull: P.css('--good'), neutral: P.css('--warn'), bear: P.css('--bad') };
    const pct = v => Math.round(v * 100) + '%';
    const num = (v, dp = 2) => v == null ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const fmtDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const rgba = (hex, a) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
    const stack = (probs, h = 6) => `<div class="rg-stack" style="height:${h}px">${S.map(s => `<span style="width:${probs[s] * 100}%;background:${COL[s]}" title="${NAME[s]} ${pct(probs[s])}"></span>`).join('')}</div>`;
    const bandOf = l => /off/i.test(l) ? 'bad' : /on/i.test(l) ? 'good' : 'warn';
    const tile = c => `<div class="tile" title="${c.note || ''}">
        <div class="n"><span>${c.name}</span></div>
        <div class="v">${P.fmt(c.score, 0)}</div>
        <div class="meter"><span style="width:${c.score}%;background:${P.bandColor(c.band)}"></span></div>
        <div class="t">${c.text}</div>${P.spark(c.series, P.css('--muted'))}</div>`;

    function draw() {
      if (!rows.some(m => m.key === Pulse.pick)) Pulse.pick = rows[0].key;
      const m = rows.find(x => x.key === Pulse.pick), rg = regs[m.key];
      const tint = rg ? COL[rg.label] : P.css('--s1');

      const picker = `<div class="ls-picker" role="tablist">${rows.map(x => {
        const r = regs[x.key];
        return `<button type="button" role="tab" class="ls-pick${x.key === m.key ? ' on' : ''}" data-key="${x.key}" aria-selected="${x.key === m.key}">
          <i style="background:${r ? COL[r.label] : P.css('--muted')}"></i><span>${x.name}</span><b class="${P.dir(x.chg1d)}">${P.sgn(x.chg1d, 1)}</b></button>`;
      }).join('')}</div>`;

      const hero = `<div class="ls-hero" style="--tint:${rgba(tint, .10)};--tint-line:${rgba(tint, .45)}">
        <div class="ls-cell">
          <div class="ls-k">${m.name}${m.proxy ? ` <span class="mk-proxy">· ${m.proxy} ETF</span>` : ''}</div>
          <div class="ls-big">${num(m.close)}</div>
          <div class="small"><span class="${P.dir(m.chg1d)}">${P.sgn(m.chg1d, 2)}</span> <span class="muted">today · RSI ${P.fmt(m.rsi, 0)}</span></div>
        </div>
        <div class="ls-cell">
          <div class="ls-k">Regime</div>
          ${rg ? `<div class="ls-big" style="color:${COL[rg.label]}">${NAME[rg.label]}<span>${pct(rg.probs[rg.label])}</span></div>
            <div style="margin:8px 0 6px;max-width:260px">${stack(rg.probs, 6)}</div>
            <div class="small muted">Since ${fmtDate(rg.since)} · ${rg.agree} of ${rg.n_models} models agree</div>`
          : '<div class="ls-big muted">–</div>'}
        </div>
        <div class="ls-cell">
          <div class="ls-k">Composite</div>
          <div class="ls-big">${P.fmt(m.composite, 0)}<span>/ 100</span></div>
          <div class="meter" style="margin:8px 0 6px;max-width:260px"><span style="width:${m.composite}%;background:${P.bandColor(bandOf(m.label))}"></span></div>
          <span class="pill"><i style="background:${P.bandColor(bandOf(m.label))}"></i>${m.label}</span>
        </div>
      </div>`;

      const votes = rg ? `<div class="ls-under">
        <div>
          <div class="ls-sec">Model votes</div>
          ${rg.models.map(v => `<div class="ls-vote">
            <span class="ls-vname">${v.name}</span>
            <span class="ls-vlab" style="color:${COL[v.label]}">${NAME[v.label]} ${pct(v.probs[v.label])}</span>
            ${stack(v.probs, 4)}</div>`).join('')}
          ${rg.n_models < 4 ? '<div class="note">The cross-asset model uses US data (credit, VIX), so it only votes on US indices.</div>' : ''}
          ${m.proxy ? `<div class="note">Shown via the ${m.proxy} ETF because there is no index feed, so treat this call with extra caution.</div>` : ''}
        </div>
        <div><div class="ls-sec">Regime probabilities, last 12 months</div><div class="ls-chart" style="height:220px"></div></div>
      </div>` : '';

      el.innerHTML = picker + hero +
        `<div class="ls-sec">${m.name}</div><div class="tiles">${m.components.map(tile).join('')}</div>` +
        votes +
        `<div class="ls-sec">Global backdrop <span>same for every market</span></div><div class="tiles ls-global">${sig.global.map(tile).join('')}</div>`;

      el.querySelectorAll('.ls-pick').forEach(b => b.onclick = () => Pulse.select(b.dataset.key));

      if (rg) {
        const h = rg.history;
        P.plot(el.querySelector('.ls-chart'), S.slice().reverse().map(s => ({
          x: h.dates, y: h[s], name: NAME[s], type: 'scatter', mode: 'lines', stackgroup: 'p',
          line: { width: 1, color: COL[s] }, fillcolor: rgba(COL[s], .32),
          hovertemplate: `${NAME[s]} %{y:.0%}<extra></extra>`,
        })), P.layout({ margin: { l: 8, r: 8, t: 4, b: 8 }, shapes: [P.hline(.5)],
          yaxis: { range: [0, 1], tickformat: '.0%', side: 'right', dtick: .5 } }));
      }
    }
    Pulse.onPick = draw;
    draw();
  }
});
