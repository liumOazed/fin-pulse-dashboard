Pulse.register({
  id: 'scorecard', tab: 'overview', order: 1,
  title: 'Live signal', subtitle: 'Pick a market to see its price, regime and a 0–100 composite. Higher = more risk-on.',
  render(el, d, tools, st) {
    const P = Pulse, sig = d.signals, rows = (sig && sig.markets) || [];
    if (!rows.length) { el.innerHTML = '<div class="muted small">Signal data not available yet. It appears after the next data refresh.</div>'; return; }
    const regs = {}; ((d.regimes && d.regimes.markets) || []).forEach(r => regs[r.key] = r);
    st.win = st.win || 126;

    const S = ['bull', 'neutral', 'bear'];
    const NAME = { bull: 'Bull', neutral: 'Neutral', bear: 'Bear' };
    const COL = { bull: P.css('--good'), neutral: P.css('--warn'), bear: P.css('--bad') };
    const WIN = { 21: '1 month', 63: '3 months', 126: '6 months', 252: '12 months' };
    const pct = v => Math.round(v * 100) + '%';
    const num = (v, dp = 2) => v == null ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const fmtDate = s => new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const rgba = (hex, a) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
    const bandOf = l => /off/i.test(l) ? 'bad' : /on/i.test(l) ? 'good' : 'warn';
    const info = t => `<span class="ls-i" tabindex="0" title="${t}" aria-label="${t}">i</span>`;
    /* colour the first signed % in a tile's text, e.g. "+5.8% vs 200D" */
    const tint = t => (t || '').replace(/([+−-]\d+(?:\.\d+)?%)/, (s, x) => `<b class="${/^[−-]/.test(x) ? 'down' : 'up'}">${x}</b>`);

    const ICON = {
      trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
      momentum: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
      volatility: '<path d="M2 12c2.5-6 4.5-6 7 0s4.5 6 7 0 4.5-6 6-3"/>',
      regime: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
      breadth: '<path d="M5 20V10M10 20V4M15 20v-7M20 20v-11"/>',
      diversification: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="7" r="2.5"/><circle cx="8" cy="18" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
      riskon: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l4-5"/>',
      up: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
      down: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    };
    const icon = (k, c) => `<span class="ls-ico" style="color:${c};background:${rgba(c, .14)}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k] || ICON.regime}</svg></span>`;

    let gid = 0;
    const area = (vals, c) => {
      const v = (vals || []).filter(x => x != null && !isNaN(x)); if (v.length < 2) return '<div class="ls-spark"></div>';
      const mn = Math.min(...v), mx = Math.max(...v), w = 200, h = 46, r = mx - mn || 1, id = 'lsg' + (++gid);
      const pts = v.map((x, i) => [(i / (v.length - 1) * w).toFixed(1), (h - 3 - (x - mn) / r * (h - 8)).toFixed(1)]);
      const line = pts.map(p => p.join(',')).join(' ');
      return `<svg class="ls-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".32"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
        <polygon fill="url(#${id})" points="0,${h} ${line} ${w},${h}"/>
        <polyline fill="none" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="${line}"/></svg>`;
    };

    /* 240° gauge for the regime's winning probability */
    const polar = (a, r) => [60 + r * Math.cos(a * Math.PI / 180), 60 + r * Math.sin(a * Math.PI / 180)];
    const arc = (a0, a1, r) => { const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
    const gauge = (p, c) => {
      const a = 150 + 240 * Math.max(.001, Math.min(1, p)), [nx, ny] = polar(a, 30);
      return `<svg class="ls-gauge" viewBox="0 0 120 104" aria-hidden="true">
        <path d="${arc(150, 390, 48)}" fill="none" stroke="var(--grid)" stroke-width="10" stroke-linecap="round"/>
        <path d="${arc(150, a, 48)}" fill="none" stroke="${c}" stroke-width="10" stroke-linecap="round"/>
        <line x1="60" y1="60" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--ink-2)" stroke-width="3" stroke-linecap="round"/>
        <circle cx="60" cy="60" r="5" fill="var(--ink-2)"/></svg>`;
    };
    const ring = (v, c) => {
      const C = 2 * Math.PI * 44, f = Math.max(0, Math.min(100, v)) / 100;
      return `<div class="ls-ring"><svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="var(--grid)" stroke-width="7"/>
        <circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round"
          stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
        <div><b>${P.fmt(v, 0)}</b><span>/ 100</span></div></div>`;
    };

    const RL = { 21: '1M', 63: '3M', 126: '6M', 252: '1Y' };
    /* change of a series across the selected window: % for price-like levels, points otherwise */
    const PCT = { momentum: 1, volatility: 1 };
    const INV = { volatility: 1, diversification: 1 };  /* rising = worse, so colour red */
    const delta = (key, vals) => {
      const v = (vals || []).filter(x => x != null && !isNaN(x)).slice(-(st.win + 1));
      if (v.length < 2) return '';
      const a = v[0], b = v[v.length - 1];
      const txt = PCT[key] ? (a ? P.sgn((b / a - 1) * 100, 1) : '–') : P.sgn(b - a, key === 'diversification' ? 2 : 1, key === 'diversification' ? '' : ' pts');
      const n = v.length - 1, good = INV[key] ? a - b : b - a;
      return `<div class="ls-delta">${n < st.win - 5 ? `${n}D` : RL[st.win]} change <b class="${P.dir(good)}">${txt}</b></div>`;
    };
    const tile = c => {
      const col = P.bandColor(c.band);
      return `<div class="ls-tile" title="${c.note || ''}">
        <div class="ls-tile-top">${icon(c.key, col)}<div><div class="ls-tile-n">${c.name}</div>
          <div class="ls-tile-v">${P.fmt(c.score, 0)}</div><div class="ls-tile-t">${tint(c.text)}</div>${delta(c.key, c.series)}</div></div>
        ${area((c.series || []).slice(-st.win), col)}</div>`;
    };

    /* range toggle: charts show the window, the "over 6M" lines give the change across it */
    const seg = P.seg([[21, '1M'], [63, '3M'], [126, '6M'], [252, '1Y']], st.win, v => { st.win = v; draw(); });
    /* Reset: back to the default view (6M, first market) */
    const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'ls-reset'; rs.textContent = 'Reset';
    rs.onclick = () => {
      st.win = 126;
      seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x.textContent === '6M'));
      Pulse.select(rows[0].key);
    };
    seg.appendChild(rs);
    tools.appendChild(seg);

    function draw() {
      if (!rows.some(m => m.key === Pulse.pick)) Pulse.pick = rows[0].key;
      const m = rows.find(x => x.key === Pulse.pick), rg = regs[m.key];
      gid = 0;

      const chips = `<div class="ls-chips" role="tablist">${rows.map(x => {
        const r = regs[x.key];
        return `<button type="button" role="tab" class="ls-chip${x.key === m.key ? ' on' : ''}" data-key="${x.key}" aria-selected="${x.key === m.key}">
          <span class="ls-chip-n"><i style="background:${r ? COL[r.label] : P.css('--muted')}"></i><span>${x.name}</span></span>
          <span class="ls-chip-v">${num(x.close)} <b class="${P.dir(x.chg1d)}">${P.sgn(x.chg1d, 2)}</b></span></button>`;
      }).join('')}</div>`;

      const mk = (d.markets || []).find(x => x.key === m.key);
      const cl = ((mk && mk.spark && mk.spark.close) || []).filter(x => x != null).slice(-(st.win + 1));
      const rr = cl.length > 1 ? (cl[cl.length - 1] / cl[0] - 1) * 100 : null;
      const hl = rg ? rg.history.label.slice(-st.win) : [];
      const share = s => hl.length ? Math.round(hl.filter(x => x === s).length / hl.length * 100) : 0;
      const dc = m.chg1d < 0 ? P.css('--bad') : P.css('--good');
      const cc = P.bandColor(bandOf(m.label));
      const heroes = `<div class="ls-heroes">
        <div class="ls-card ls-price" style="--tint:${rgba(dc, .16)};--tint-line:${rgba(dc, .5)}">
          ${icon(m.chg1d < 0 ? 'down' : 'up', dc)}
          <div class="ls-price-body">
            <div class="ls-name">${m.name}${m.proxy ? ` <span class="mk-proxy">· ${m.proxy} ETF</span>` : ''}</div>
            <div class="ls-big">${num(m.close)}</div>
            <div class="ls-subline"><span class="${P.dir(m.chg1d)}">${P.sgn(m.chg1d, 2)}</span> today <span class="dot">•</span> RSI ${P.fmt(m.rsi, 0)}</div>
            ${rr != null ? `<div class="ls-subline"><span class="${P.dir(rr)}">${P.sgn(rr, 1)}</span> over ${RL[st.win]}</div>` : ''}
          </div>
        </div>
        <div class="ls-card">
          <div class="ls-card-h">Market regime ${info('Weighted vote of up to four regime models: trend rules, a hidden Markov model, a statistical jump model and (US only) a cross-asset model.')}</div>
          ${rg ? `<div class="ls-reg">${gauge(rg.probs[rg.label], COL[rg.label])}
            <div class="ls-reg-body">
              <div class="ls-mid"><span style="color:${COL[rg.label]}">${NAME[rg.label]}</span><em>${pct(rg.probs[rg.label])}</em></div>
              <div class="rg-stack" style="height:8px">${S.map(s => `<span style="width:${rg.probs[s] * 100}%;background:${COL[s]}" title="${NAME[s]} ${pct(rg.probs[s])}"></span>`).join('')}</div>
              <div class="ls-subline small">Since ${fmtDate(rg.since)} · ${rg.agree} of ${rg.n_models} models agree</div>
              ${hl.length ? `<div class="ls-subline small">Days in last ${RL[st.win]}: ${S.map(s => `<span style="color:${COL[s]}">${NAME[s]} ${share(s)}%</span>`).join(' · ')}</div>` : ''}
            </div></div>` : '<div class="ls-mid muted">–</div>'}
        </div>
        <div class="ls-card">
          <div class="ls-card-h">Composite score ${info('Average of the indicator scores below. 62 or more = Risk-On, below 45 = Risk-Off, in between = Neutral.')}</div>
          <div class="ls-comp">${ring(m.composite, cc)}
            <div class="ls-reg-body">
              <div class="ls-zone"><span style="width:${m.composite}%;background:${cc}"></span><i style="left:45%"></i><i style="left:62%"></i></div>
              <div class="ls-zone-k"><span>Risk-Off</span><span>Neutral</span><span>Risk-On</span></div>
              <span class="pill"><i style="background:${cc}"></i>${m.label}</span> <span class="small muted">today's reading</span>
            </div></div>
        </div>
      </div>`;

      const votes = rg ? `<div class="ls-under">
        <div class="ls-card">
          <div class="ls-card-h">Model votes ${info('Each model’s own call today. The bar is how sure that model is.')}</div>
          ${rg.models.map(v => `<div class="ls-vote" title="${S.map(s => NAME[s] + ' ' + pct(v.probs[s])).join(' · ')}">
            <span class="ls-vname">${v.name}</span>
            <span class="ls-vlab" style="color:${COL[v.label]}">${NAME[v.label]} ${pct(v.probs[v.label])}</span>
            <div class="ls-vbar"><span style="width:${v.probs[v.label] * 100}%;background:${COL[v.label]}"></span></div></div>`).join('')}
          ${rg.n_models < 4 ? `<div class="ls-foot"><span class="ls-i" aria-hidden="true">i</span>The cross-asset model uses US data (credit, VIX), so it only votes on US indices.</div>` : ''}
          ${m.proxy ? `<div class="ls-foot"><span class="ls-i" aria-hidden="true">i</span>Shown via the ${m.proxy} ETF because there is no index feed, so treat this call with extra caution.</div>` : ''}
        </div>
        <div class="ls-card">
          <div class="ls-card-h"><span>Regime probabilities <span class="muted">(last ${WIN[st.win]})</span></span>
            <span class="ls-legend">${S.map(s => `<span><i style="background:${COL[s]}"></i>${NAME[s]}</span>`).join('')}</span></div>
          <div class="ls-chart" style="height:240px"></div>
        </div>
      </div>` : '';

      el.innerHTML = chips + heroes +
        `<h3 class="ls-h">Key indicators <span>${m.name}</span></h3><div class="ls-tiles">${m.components.map(tile).join('')}</div>` +
        votes +
        `<h3 class="ls-h">Global backdrop <span>same for every market</span></h3><div class="ls-tiles">${sig.global.map(tile).join('')}</div>`;

      el.querySelectorAll('.ls-chip').forEach(b => b.onclick = () => Pulse.select(b.dataset.key));
      const on = el.querySelector('.ls-chip.on');
      if (on) { const c = on.parentNode; c.scrollLeft = on.offsetLeft - c.offsetLeft - 8; }

      if (rg) {
        const h = rg.history, n = st.win;
        P.plot(el.querySelector('.ls-chart'), S.slice().reverse().map(s => ({
          x: h.dates.slice(-n), y: h[s].slice(-n), name: NAME[s], type: 'scatter', mode: 'lines', stackgroup: 'p',
          line: { width: 1.2, color: COL[s], shape: 'spline', smoothing: .4 }, fillcolor: rgba(COL[s], .38),
          hovertemplate: `${NAME[s]} %{y:.0%}<extra></extra>`,
        })), P.layout({ margin: { l: 8, r: 8, t: 4, b: 8 }, shapes: [P.hline(.5)],
          xaxis: { showline: false },
          yaxis: { range: [0, 1], tickformat: '.0%', side: 'right', dtick: .5, gridcolor: P.css('--grid') } }));
      }
    }
    Pulse.onPick = draw;
    draw();
  }
});
