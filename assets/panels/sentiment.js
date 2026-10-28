Pulse.register({
  id: 'sentiment', tab: 'sentiment', order: 0,
  title: 'Sentiment', subtitle: 'How traders, institutions and the crowd are behaving right now. Mood, not a forecast.',
  render(el, d, tools, st) {
    const P = Pulse, S = d.sentiment;
    if (!S || !S.fg) { el.innerHTML = '<div class="muted small">Sentiment data not available yet. It appears after the next data refresh.</div>'; return; }
    st.win = st.win || 126;
    const RL = { 21: '1M', 63: '3M', 126: '6M', 252: '1Y' };
    const ok = v => v != null && !isNaN(v);
    const fmtDate = s => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
    const hex = c => { const n = parseInt(c.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const rgba = (c, a) => `rgba(${hex(c).join(',')},${a})`;
    const info = t => `<span class="ls-i" tabindex="0" title="${t}" aria-label="${t}">i</span>`;

    /* Fear (rose) -> neutral (amber) -> greed (emerald), shared with Live signal's regime palette */
    const BEAR = P.css('--rg-bear'), MID = P.css('--rg-neutral'), BULL = P.css('--rg-bull');
    const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
    const tone = v => !ok(v) ? P.css('--muted') : v <= 50 ? mix(BEAR, MID, Math.max(0, (v - 15) / 35)) : mix(MID, BULL, Math.min(1, (v - 50) / 35));
    const posTone = l => /bull/i.test(l) ? (/slight/i.test(l) ? mix(MID, BULL, .6) : BULL) : /bear/i.test(l) ? BEAR : /caut/i.test(l) ? mix(BEAR, MID, .5) : MID;

    const ICON = {
      smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
      meh: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7"/><path d="M9 9.5h.01M15 9.5h.01"/>',
      frown: '<circle cx="12" cy="12" r="9"/><path d="M15.5 16a4.5 4.5 0 0 0-7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
      scale: '<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>',
      wave: '<path d="M2 12c2.5-6 4.5-6 7 0s4.5 6 7 0 4.5-6 6-3"/>',
      users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
      bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
      shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/>',
      chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
      bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
      grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
      plug: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    };
    const icon = (k, c, s = 16) => `<span class="ls-ico" style="color:${c};background:${rgba(c, .14)}"><svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg></span>`;

    let gid = 0;
    const area = (vals, c) => {
      const v = (vals || []).filter(ok); if (v.length < 2) return '<div class="ls-spark st-nospark">History builds up from daily runs</div>';
      const mn = Math.min(...v), mx = Math.max(...v), w = 200, h = 46, r = mx - mn || 1, id = 'stg' + (++gid);
      const line = v.map((x, i) => (i / (v.length - 1) * w).toFixed(1) + ',' + (h - 3 - (x - mn) / r * (h - 8)).toFixed(1)).join(' ');
      return `<svg class="ls-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".32"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs>
        <polygon fill="url(#${id})" points="0,${h} ${line} ${w},${h}"/>
        <polyline fill="none" stroke="${c}" stroke-width="1.6" vector-effect="non-scaling-stroke" stroke-linejoin="round" points="${line}"/></svg>`;
    };
    /* daily series cut to the window; weekly series (CFTC, AAII) to the same span in weeks */
    const cut = (vals, weekly) => (vals || []).slice(-(weekly ? Math.max(4, Math.round(st.win / 5)) : st.win));
    /* value `win` trading days back (weekly series: win/5 weeks); shorter histories fall back to their oldest point */
    const span = weekly => weekly ? Math.max(1, Math.round(st.win / 5)) : st.win;
    const then = (vals, weekly) => {
      const a = vals || [], k = span(weekly);
      for (let j = Math.max(0, a.length - 1 - k); j < a.length - 1; j++) if (ok(a[j])) {
        const n = a.length - 1 - j;
        return { v: a[j], lab: n >= k * .9 ? RL[st.win] + ' ago' : weekly ? `${n}W ago` : `${n}D ago` };
      }
      return null;
    };
    const arrow = (d, good = 1) => `<b class="${P.dir(d * good)}">${d >= 0 ? '▲' : '▼'}</b>`;
    const stale = k => S.sources && S.sources[k] === 'stale' ? ' <span class="st-stale" title="Latest download failed, showing the previous run">stale</span>' : '';

    /* 240° gauge coloured fear -> greed, needle at the score */
    const polar = (a, r) => [80 + r * Math.cos(a * Math.PI / 180), 80 + r * Math.sin(a * Math.PI / 180)];
    const arc = (a0, a1, r) => { const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
    const gauge = v => {
      const segs = []; for (let i = 0; i < 24; i++) { const a0 = 150 + i * 10, a1 = a0 + 10.6; segs.push(`<path d="${arc(a0, a1, 64)}" stroke="${tone(i / 23 * 100)}" stroke-width="12" fill="none"/>`); }
      const a = 150 + 240 * Math.max(0, Math.min(100, v)) / 100, [x0, y0] = polar(a, 52), [x1, y1] = polar(a, 76);
      return `<svg class="st-gauge" viewBox="0 0 160 140" aria-hidden="true">
        <path d="${arc(150, 390, 64)}" stroke="var(--grid)" stroke-width="12" fill="none" stroke-linecap="round"/>${segs.join('')}
        <line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
        <text x="80" y="84" text-anchor="middle" class="st-gv">${Math.round(v)}</text>
        <text x="80" y="108" text-anchor="middle" class="st-gl" fill="${tone(v)}">${fg.label}</text></svg>`;
    };
    const donut = (pct, c, big, small) => {
      const C = 2 * Math.PI * 40, f = Math.max(0, Math.min(100, pct)) / 100;
      return `<div class="st-donut"><svg viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="40" fill="none" stroke="${rgba(BEAR, .75)}" stroke-width="10"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="${c}" stroke-width="10" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>
        <div><b>${big}</b><span>${small}</span></div></div>`;
    };

    const fg = S.fg, vix = (S.vol || {}).vix, skew = (S.vol || {}).skew, opt = S.options, cot = S.cot, aaii = S.aaii, soc = S.social, log = S.log || {};
    const fgc = tone(fg.score), VIOLET = '#9b7be8';
    const ord = v => { const n = Math.round(v), t = n % 100; return n + (t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); };
    const SHORT = { 'Cons. Discretionary': 'Cons. Disc.', 'Comm. Services': 'Comm. Svcs', 'Health Care': 'Health Care', 'Cons. Staples': 'Cons. Staples' };
    const LINE = { 'Extreme fear': 'Panic territory. Fear is running far above normal.', Fear: 'A nervous mood. Traders are paying up for safety.',
      Neutral: 'A balanced mood. Not overly fearful, not overly greedy.', Greed: 'A confident mood. Risk appetite is above normal.',
      'Extreme greed': 'A euphoric mood. Optimism is stretched well above normal.' };

    const seg = P.seg([[21, '1M'], [63, '3M'], [126, '6M'], [252, '1Y']], st.win, v => { st.win = v; draw(); });
    tools.appendChild(seg);

    function draw() {
      gid = 0;
      const fgThen = then(fg.history.values), wd = fgThen ? fg.score - fgThen.v : null;
      const fgWin = fg.history.values.slice(-(st.win + 1)).filter(ok);

      /* ---- hero ---- */
      const hero = `<div class="st-row st-r1">
        <div class="ls-card st-hero">
          ${gauge(fg.score)}
          <div class="st-hero-mid">
            <div class="st-h">Overall market sentiment ${info('Average of seven market-based inputs, each scored 0–100 against its own past year (listed under “What’s driving the score”). Modelled on CNN’s Fear & Greed index, computed from Yahoo prices.')}</div>
            <div class="st-sub">${LINE[fg.label] || ''}</div>
            <div class="st-bar"><span style="left:${Math.max(1, Math.min(99, fg.score))}%;border-color:${fgc}"></span></div>
            <div class="st-bar-k"><span style="color:${BEAR}">Fear<em>0–45</em></span><span style="color:${MID}">Neutral<em>45–55</em></span><span style="color:${BULL}">Greed<em>55–100</em></span></div>
          </div>
          <div class="st-hero-wk">
            <div class="st-k">Compared to ${fgThen ? fgThen.lab : RL[st.win] + ' ago'}</div>
            ${fgThen ? `<div class="st-wk" style="color:${wd >= 0 ? BULL : BEAR}">${wd >= 0 ? '▲' : '▼'} ${wd >= 0 ? '+' : '−'}${Math.abs(wd).toFixed(0)} <em>${Math.abs(wd) < 1 ? '(unchanged)' : wd > 0 ? '(more greedy)' : '(more fearful)'}</em></div>
              <div class="st-k st-wk-t">From ${fgThen.v.toFixed(0)}. Over ${RL[st.win]}: low ${Math.min(...fgWin).toFixed(0)} · avg ${(fgWin.reduce((a, b) => a + b, 0) / fgWin.length).toFixed(0)} · high ${Math.max(...fgWin).toFixed(0)}.</div>` : '<div class="muted">–</div>'}
          </div>
        </div>
        <div class="ls-card st-mood">
          <div class="st-h">Market mood</div>
          <div class="st-mood-b">${icon(fg.score >= 55 ? 'smile' : fg.score >= 45 ? 'meh' : 'frown', fgc, 30)}
            <div><div class="st-mood-t" style="color:${fgc}">${S.mood ? S.mood.title : fg.label}</div>
            <div class="st-sub">${S.mood ? S.mood.text : ''}</div></div></div>
        </div>
      </div>`;

      /* ---- key indicator tiles ---- */
      const tiles = [];
      const tile = (ic, c, name, v, tag, foot, spark, note) => tiles.push(`<div class="ls-tile" title="${note || ''}">
        <div class="ls-tile-top">${icon(ic, c)}<div><div class="ls-tile-n">${name}</div>
        <div class="ls-tile-v">${v}${tag ? ` <span class="st-tag" style="color:${c}">${tag}</span>` : ''}</div><div class="ls-tile-t">${foot}</div></div></div>${spark}</div>`);
      const vs = (t, now, dp, unit = '', good = 1) => t ? `${arrow(now - t.v, good)} from ${t.v.toFixed(dp)}${unit} ${t.lab}` : `No history for ${RL[st.win]} yet`;
      tile('smile', fgc, 'Fear & Greed', fg.score.toFixed(0), fg.label, vs(fgThen, fg.score, 0),
        area(cut(fg.history.values), fgc), 'Our 0–100 composite of seven market inputs');
      if (opt && ok(opt.pc_vol)) {
        const pc = opt.pc_vol, c = pc > 1.1 ? BEAR : pc < 0.8 ? BULL : MID;
        tile('scale', c, 'Put/Call ratio', pc.toFixed(2), pc > 1.1 ? 'Hedging' : pc < 0.8 ? 'Bullish' : 'Balanced', `${vs(then(log.pc_vol), pc, 2, '', -1)}${stale('options')}`,
          area(cut(log.pc_vol), c), 'Put volume ÷ call volume across SPY options expiring in the next ~6 weeks. Below 1 = more calls.');
      }
      if (vix) {
        const c = vix.pctile == null ? MID : tone(100 - vix.pctile);
        tile('wave', c, 'VIX (volatility)', vix.value.toFixed(1), vix.pctile < 35 ? 'Low fear' : vix.pctile > 70 ? 'High fear' : 'Normal',
          vs(then(vix.series), vix.value, 1, '', -1), area(cut(vix.series), c), 'Expected 30-day S&P 500 volatility implied by options');
      }
      if (aaii) {
        const c = aaii.bull > 45 ? BULL : aaii.bull < 30 ? BEAR : MID;
        tile('user', c, 'AAII survey (retail)', aaii.bull.toFixed(0) + '%', 'bulls', `${vs(then(aaii.series, true), aaii.bull, 0, '%')} · bears ${aaii.bear.toFixed(0)}%${stale('aaii')}`,
          area(cut(aaii.series, true), c), 'Weekly AAII poll of individual investors: share expecting stocks to rise over the next 6 months. Long-run average ≈ 37.5%.');
      }
      const inst = cot && cot.groups.find(g => g.key === 'inst');
      if (inst) {
        const c = posTone(inst.label);
        tile('bank', c, 'Institutional positioning', P.sgn(inst.net_pct, 1), 'net long', `${vs(then(inst.series, true), inst.net_pct, 1, '%')}${stale('cot')}`,
          area(cut(inst.series, true), c), 'Asset managers’ net long position in E-mini S&P 500 futures as % of open interest (CFTC, weekly). Replaces dollar fund flows, which need a paid feed.');
      }

      /* ---- participants (CFTC) ---- */
      const PIC = { retail: 'user', inst: 'bank', hedge: 'bolt', banks: 'shield' };
      const parts = cot ? `<div class="ls-card st-parts">
        <div class="st-h">Sentiment by participant ${info('Net futures positioning in E-mini S&P 500 from the CFTC Traders in Financial Futures report, ranked against each group’s own last 3 years. Dealers are usually net short because they hedge clients, so the ranking matters more than the sign.')}</div>
        ${cot.groups.map(g => { const c = posTone(g.label); return `<div class="st-part">
          ${icon(PIC[g.key], c)}<div class="st-part-n"><b>${g.who}</b><span>${g.cftc}</span></div>
          <div class="st-part-v"><div><span style="color:${c}">${g.label}</span><em>${ord(g.score)} pct${(t => t ? ` · ${P.sgn(g.net_pct - t.v, 1, '')} ${t.lab.replace(' ago', '')}` : '')(then(g.series, true))}</em></div>
          <div class="ls-vbar"><span style="width:${Math.max(3, g.score)}%;background:${c}"></span></div></div></div>`; }).join('')}
        <div class="ls-foot"><span class="ls-i" aria-hidden="true">i</span>CFTC, week of ${fmtDate(cot.asof)}. Published Fridays for the prior Tuesday.${stale('cot')}</div>
      </div>` : '';

      const r2 = `<h3 class="ls-h">Key sentiment indicators <span>Big numbers are the latest reading. Changes, ranges and charts use the ${RL[st.win]} window.</span></h3><div class="ls-tiles st-tiles">${tiles.join('')}</div>`;

      /* ---- trend chart + options ---- */
      const optRows = [];
      const orow = (ic, name, val, sub, c, chg, tip) => optRows.push(`<div class="st-orow" title="${tip}">${icon(ic, c)}<div class="st-on">${name}</div>
        <div class="st-ov"><b>${val}</b><span style="color:${c}">${sub}</span></div><div class="st-oc">${chg || ''}</div></div>`);
      const chg = (a, b, dp, good) => ok(a) && ok(b) ? `<b class="${P.dir((a - b) * good)}">${(a - b) >= 0 ? '▲' : '▼'} ${Math.abs(a - b).toFixed(dp)}</b>` : '';
      if (opt && ok(opt.pc_vol)) {
        const cp = 1 / opt.pc_vol, c = cp > 1.25 ? BULL : cp < 0.9 ? BEAR : MID, pp = then(log.pc_vol);
        orow('scale', 'Call/Put volume ratio', cp.toFixed(2), cp > 1.25 ? 'bullish' : cp < 0.9 ? 'defensive' : 'neutral', c, pp ? chg(cp, 1 / pp.v, 2, 1) + ` <span>${pp.lab.replace(' ago', '')}</span>` : '',
          'SPY call volume ÷ put volume, last session');
      }
      if (opt && ok(opt.pc_oi)) {
        const c = opt.pc_oi > 1.6 ? BEAR : opt.pc_oi < 1.1 ? BULL : MID;
        orow('shield', 'Put/Call open interest', opt.pc_oi.toFixed(2), opt.pc_oi > 1.6 ? 'heavy hedging' : 'normal', c, (t => t ? chg(opt.pc_oi, t.v, 2, -1) + ` <span>${t.lab.replace(' ago', '')}</span>` : '')(then(log.pc_oi)),
          'Open puts ÷ open calls in SPY. SPY normally carries more puts because funds use it to hedge.');
      }
      if (vix) {
        const c = tone(100 - (vix.pctile ?? 50));
        orow('wave', 'Implied volatility (VIX)', vix.value.toFixed(1) + '%', vix.pctile > 70 ? 'elevated' : vix.pctile < 35 ? 'subdued' : 'normal', c, (t => t ? chg(vix.value, t.v, 1, -1) + ` <span>${t.lab.replace(' ago', '')}</span>` : '')(then(vix.series)),
          `${Math.round(vix.pctile)}th percentile of the past year`);
      }
      if (skew) {
        const c = skew.pctile > 75 ? BEAR : skew.pctile < 25 ? BULL : MID;
        orow('bolt', 'Tail-risk skew (SKEW)', skew.value.toFixed(0), skew.pctile > 75 ? 'crash hedges bid' : skew.pctile < 25 ? 'little tail fear' : 'neutral', c,
          (t => t ? chg(skew.value, t.v, 0, -1) + ` <span>${t.lab.replace(' ago', '')}</span>` : '')(then(skew.series)), 'CBOE SKEW index: price of far out-of-the-money S&P puts. Above ~145 = heavy demand for crash protection.');
      }
      const opts = `<div class="ls-card st-opts"><div class="st-h">Options activity ${info('Call/put volume and open interest from SPY’s option chain on Yahoo; volatility and skew from CBOE indices.')}</div>${optRows.join('')}
          ${opt ? `<div class="ls-foot"><span class="ls-i" aria-hidden="true">i</span>SPY chain, session of ${fmtDate(opt.date)}.${stale('options')}</div>` : ''}</div>`;
      const r3 = `<div class="st-row st-r3">
        <div class="ls-card"><div class="ls-card-h"><span>Market sentiment trend <span class="muted">(last ${RL[st.win]})</span></span>
          <span class="ls-legend"><span><i style="background:${MID}"></i>Fear &amp; Greed</span><span><i style="background:${P.css('--s1')}"></i>Calm (VIX inverted)</span><span><i style="background:${VIOLET}"></i>Credit appetite</span></span></div>
          <div class="st-chart"></div></div>${parts}
      </div>`;

      /* ---- drivers + social ---- */
      const drivers = `<div class="ls-card"><div class="st-h">What’s driving the score ${info('Each input is ranked 0–100 against its own past year. 0 = most fearful reading, 100 = most greedy.')}</div>
        ${fg.components.map(c => { const t = then(c.series); return `<div class="st-drv" title="${c.note}"><span class="st-drv-n">${c.name}<em>${c.text}</em></span>
          <span class="st-drv-v"><span style="color:${tone(c.score)}">${c.score.toFixed(0)}</span>${t ? `<em>${P.sgn(c.score - t.v, 0, '')}</em>` : ''}</span>
          <div class="st-drv-bar">${t ? `<s style="left:${t.v}%" title="${t.lab}: ${t.v.toFixed(0)}"></s>` : ''}<i style="left:${c.score}%;background:${tone(c.score)}"></i></div></div>`; }).join('')}
        <div class="st-drv-k"><span>Fear</span><span><s></s> ${RL[st.win]} ago · <i></i> today</span><span>Greed</span></div></div>`;
      const bar = s => `<div class="st-soc-r" title="${s.tagged} of the last ${s.posts} posts tagged"><b>${s.symbol}</b><div class="st-soc-bar"><span style="width:${s.bull}%;background:${tone(s.bull)}"></span></div><span>${Math.round(s.bull)}%</span></div>`;
      const socThen = soc && then(log.social_bull);
      const social = soc && soc.groups ? `<div class="ls-card st-social"><div class="st-h">Social media sentiment ${info('Share of posts tagged Bullish among those tagged Bullish or Bearish in each ticker’s latest 30 StockTwits messages. Groups and the overall figure weight each ticker by its tagged posts. Small, noisy sample: read it as a temperature check.')}</div>
        <div class="st-soc">
          <div class="st-soc-all">${donut(soc.bull, BULL, Math.round(soc.bull) + '%', 'bullish')}
            <div class="st-k">${socThen ? `${arrow(soc.bull - socThen.v)} from ${socThen.v.toFixed(0)}% ${socThen.lab}` : `History builds up from daily runs`}</div></div>
          <div class="st-soc-g">${soc.groups.map(g => { const t = then(log['social_' + g.name.toLowerCase()]); return `<div class="st-soc-col">
            <div class="st-soc-gh"><b>${g.name}</b><span style="color:${tone(g.bull)}">${Math.round(g.bull)}%</span>${t ? `<em>${P.sgn(g.bull - t.v, 0, ' pts')}</em>` : ''}</div>
            ${g.symbols.map(bar).join('')}</div>`; }).join('')}</div>
        </div>
        <div class="ls-foot"><span class="ls-i" aria-hidden="true">i</span>StockTwits, ${soc.tagged} tagged posts, ${fmtDate(soc.asof)}.${soc.skipped && soc.skipped.length ? ` Too few tagged posts to score: ${soc.skipped.join(', ')}.` : ''}${stale('social')}</div></div>` : '';
      const r4 = `<div class="st-row st-r4">${drivers}${opts}</div>${social}`;

      /* ---- sectors + watch ---- */
      const sec = (S.sectors || []), sr = s => s.rets ? s.rets[st.win] : s.r1m;
      const sectors = sec.length ? `<div class="ls-card"><div class="st-h">Sector sentiment ${info('Each sector ETF scored 0–100 from its trend (price vs 50D/200D), 3-month momentum rank and RSI. Sorted strongest first.')}</div>
        <div class="st-sec">${sec.map(s => `<div class="st-sec-c" title="${s.name} (${s.ticker}) · ${s.label} · ${RL[st.win]} ${P.sgn(sr(s), 1)}"><b>${Math.round(s.score)}</b>
          <span class="st-sec-bar" style="background:${tone(s.score)}"></span><span class="st-sec-n">${SHORT[s.name] || s.name}</span><span class="st-sec-r ${P.dir(sr(s))}">${P.sgn(sr(s), 1)}</span></div>`).join('')}</div>
        <div class="st-sub small">Score 0–100 (today) · ${RL[st.win]} return below</div></div>` : '';
      const watch = `<div class="ls-card st-watch"><div class="st-h">${icon('bulb', MID)} What to watch</div>
        <ul>${(S.watch || []).map(w => `<li>${w}</li>`).join('')}</ul>
        <div class="st-call">Keep an eye on whether the mood turns into price: sentiment extremes tend to matter most when they start to reverse.</div></div>`;
      const r5 = `<div class="st-row st-r5">${sectors}${watch}</div>`;

      const missing = `<div class="st-missing">${icon('plug', P.css('--muted'), 14)}<span><b>Not shown:</b> news sentiment and institutional dollar fund flows. Both need a paid or keyed data feed${!aaii ? '; the AAII survey download failed this run' : ''}. Nothing on this tab is simulated.</span></div>`;

      el.innerHTML = hero + r2 + r3 + r4 + r5 + missing;

      /* trend chart: three 0-100 lines aligned from the right */
      const n = st.win, x = fg.history.dates.slice(-n);
      const tail = v => { const a = (v || []).slice(-x.length); return Array(x.length - a.length).fill(null).concat(a); };
      const junk = (fg.components.find(c => c.key === 'junk') || {}).series;
      const ser = [
        { y: tail(fg.history.values), name: 'Fear & Greed', c: MID, w: 2.4, fill: true },
        { y: tail(vix && vix.inv), name: 'Calm (VIX inverted)', c: P.css('--s1'), w: 1.6 },
        { y: tail(junk), name: 'Credit appetite', c: VIOLET, w: 1.6 },
      ];
      const narrow = el.querySelector('.st-chart').clientWidth < 460;
      P.plot(el.querySelector('.st-chart'), ser.map(s => ({
        x, y: s.y, name: s.name, type: 'scatter', mode: 'lines', line: { color: s.c, width: s.w, shape: 'spline', smoothing: .5 },
        fill: s.fill ? 'tozeroy' : 'none', fillgradient: s.fill ? { type: 'vertical', colorscale: [[0, rgba(s.c, 0)], [1, rgba(s.c, .28)]] } : undefined,
        hovertemplate: `<span style="color:${s.c}">●</span> ${s.name}  <b>%{y:.0f}</b><extra></extra>`,
      })), P.layout({
        margin: { l: 8, r: 8, t: 6, b: 22 },
        shapes: [P.hline(50, 'y', rgba(P.css('--ink'), .3))],
        xaxis: { showline: false, hoverformat: '%d %b %Y', tickformat: n <= 63 ? '%d %b' : '%b %Y', nticks: narrow ? 4 : 7 },
        yaxis: { range: [0, 100], tickvals: [0, 25, 50, 75, 100], gridcolor: rgba(P.css('--ink'), .06) },
      }));
    }
    draw();
  }
});
