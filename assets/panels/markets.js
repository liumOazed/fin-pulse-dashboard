Pulse.register({
  id: 'markets', tab: 'overview', order: 0,
  title: 'Major markets', subtitle: 'Latest daily close for ten benchmark indices. Session status follows each exchange’s local clock (holidays not included).',
  render(el, d, tools, st) {
    const P = Pulse, rows = d.markets || [];
    if (!rows.length) { el.innerHTML = '<div class="muted small">Market data not available yet. Run the data workflow to load it.</div>'; return; }
    st.win = st.win || 63;
    tools.appendChild(P.seg([[5, '1W'], [21, '1M'], [63, '3M'], [252, '1Y']], st.win, v => { st.win = v; draw(); }));

    const num = (v, dp = 2) => v == null ? '–' : Number(v).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
    const signed = (v, dp = 2, s = '') => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v), dp) + s;
    const pos = (v, lo, hi) => hi > lo ? Math.min(100, Math.max(0, (v - lo) / (hi - lo) * 100)) : 50;

    /* Exchange clock: local weekday + minutes, then match against the session list */
    function status(m) {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: m.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date()).reduce((a, p) => (a[p.type] = p.value, a), {});
      const mins = +parts.hour * 60 + +parts.minute, clock = `${parts.hour}:${parts.minute}`;
      const toMin = s => { const [h, mm] = s.split(':'); return +h * 60 + +mm; };
      const ss = m.sessions.map(([a, b]) => [toMin(a), toMin(b)]);
      let state = 'closed', label = 'Closed';
      if ((m.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']).includes(parts.weekday)) {
        if (ss.some(([a, b]) => mins >= a && mins < b)) { state = 'open'; label = 'Open'; }
        else if (mins >= ss[0][0] && mins < ss[ss.length - 1][1]) { state = 'break'; label = 'Lunch break'; }
        else if (mins < ss[0][0]) label = 'Pre-open';
      }
      return { state, label, clock };
    }

    function spark(m, id) {
      const v = m.spark.close.slice(-st.win - 1).filter(x => x != null);
      if (v.length < 2) return { svg: '', r: null };
      const r = (v[v.length - 1] / v[0] - 1) * 100;
      const col = P.css(r >= 0 ? '--good-ink' : '--bad-ink');
      const w = 240, h = 56, mn = Math.min(...v), mx = Math.max(...v), rg = mx - mn || 1;
      const xy = v.map((x, i) => [(i / (v.length - 1) * w).toFixed(1), (h - 3 - (x - mn) / rg * (h - 8)).toFixed(1)]);
      const line = xy.map(p => p.join(',')).join(' ');
      const [lx, ly] = xy[xy.length - 1];
      const svg = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
        <polygon fill="url(#g-${id})" points="0,${h} ${line} ${w},${h}"/>
        <polyline fill="none" stroke="${col}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" points="${line}"/>
        <circle cx="${lx}" cy="${ly}" r="2.6" fill="${col}"/></svg>`;
      return { svg, r };
    }

    const range = (label, lo, hi, v, dp) => `<div class="mk-range">
      <div class="mk-k"><span>${label}</span></div>
      <div class="mk-bar"><i style="left:${pos(v, lo, hi).toFixed(1)}%"></i></div>
      <div class="mk-ends"><span>${num(lo, dp)}</span><span>${num(hi, dp)}</span></div></div>`;

    function draw() {
      const per = { 5: '1W', 21: '1M', 63: '3M', 252: '1Y' }[st.win];
      el.innerHTML = '<div class="mk-grid">' + rows.map(m => {
        const s = status(m), sp = spark(m, m.key), c = P.dir(m.chg_pct);
        return `<article class="mk" data-key="${m.key}">
          <div class="mk-head">
            <div><div class="mk-name">${m.name}</div><div class="mk-sub">${m.exchange} · ${m.city} <span class="mk-clock">${s.clock}</span>${m.proxy ? ` · <span class="mk-proxy" title="No index feed today, showing the ${m.proxy} ETF in USD">${m.proxy} ETF</span>` : ''}</div></div>
            <span class="mk-status ${s.state}"><i></i>${s.label}</span>
          </div>
          <div class="mk-px">${num(m.last)}<span>${m.ccy}</span></div>
          <div class="mk-chg ${c}">${signed(m.chg)} <span>(${signed(m.chg_pct, 2, '%')})</span></div>
          <div class="mk-spark"><div class="mk-k"><span>${per}</span><span class="${P.dir(sp.r)}">${signed(sp.r, 1, '%')}</span></div>${sp.svg}</div>
          ${range('Day range', m.day_low, m.day_high, m.last)}
          ${range('52-week range', m.lo52, m.hi52, m.last, 0)}
          <div class="mk-foot">
            <div><span>YTD</span><b class="${P.dir(m.ytd)}">${signed(m.ytd, 1, '%')}</b></div>
            <div><span>1M</span><b class="${P.dir(m.r1m)}">${signed(m.r1m, 1, '%')}</b></div>
            <div><span>vs 52W high</span><b>${signed(m.from_hi52, 1, '%')}</b></div>
          </div>
          <div class="mk-asof">Close as of ${m.asof}</div>
        </article>`;
      }).join('') + '</div>';
    }
    draw();

    /* Keep the session pills and clocks current without redrawing the cards */
    clearInterval(st.timer);
    st.timer = setInterval(() => {
      if (!document.body.contains(el)) return clearInterval(st.timer);
      rows.forEach(m => {
        const card = el.querySelector(`.mk[data-key="${m.key}"]`); if (!card) return;
        const s = status(m), pill = card.querySelector('.mk-status');
        pill.className = 'mk-status ' + s.state; pill.innerHTML = `<i></i>${s.label}`;
        card.querySelector('.mk-clock').textContent = s.clock;
      });
    }, 30000);
  }
});
