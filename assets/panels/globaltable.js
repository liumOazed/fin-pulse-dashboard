Pulse.register({
  id: 'globaltable', tab: 'overview', order: 2,
  title: 'Global trend table', subtitle: 'Trend, momentum and RSI for every tracked index, each percentile against its own past year. Click a column to sort.',
  render(el, d, tools, st) {
    const P = Pulse, f = P.fmt, s = P.sgn, c = P.dir, all = d.globaltable || [];
    if (!all.length) { el.innerHTML = '<div class="muted small">Trend data not available yet.</div>'; return; }
    const REG = ['Americas', 'Europe', 'Asia', 'Middle East'];
    st.reg = st.reg || 'all'; st.key = st.key || 'volmom'; st.desc = st.desc ?? true;
    const regs = REG.filter(r => all.some(x => x.region === r));
    tools.appendChild(P.seg([['all', 'All'], ...regs.map(r => [r, r])], st.reg, v => { st.reg = v; draw(); }));

    const COLS = [
      ['name', 'Index'], ['state', 'Trend'], ['dist200', 'vs 200D'], ['dist200_pctile', 'Pctile'],
      ['r1m', '1M'], ['r3m', '3M'], ['r6m', '6M'], ['r12m', '12M'], ['volmom', 'Vol-adj mom'], ['rsi', 'RSI (14)'],
    ];
    const st8 = { golden: ['Golden cross', '--good'], death: ['Death cross', '--bad'] };
    /* Percentile as a thin meter: where today sits in the index's own 1-year range */
    const meter = v => v == null ? '–' : `<span class="gt-pc"><span class="gt-m"><i style="width:${Math.max(3, Math.min(100, v)).toFixed(0)}%"></i></span>${f(v, 0)}</span>`;
    const rsiCell = (v, p) => {
      const z = v >= 70 ? ' hot' : v <= 30 ? ' cold' : '';
      return `<span class="gt-rsi${z}">${f(v, 0)}</span><span class="gt-sub">${p == null ? '' : f(p, 0) + 'th'}</span>`;
    };

    el.innerHTML = '<div class="tbl-wrap"><table class="t gt"><thead></thead><tbody></tbody></table></div><div class="note">Trend: golden cross = 50-day average above the 200-day. Vol-adj mom = 6-month return ÷ annualised volatility. RSI percentile is shown under the value. ETF rows track an MSCI version of the market in USD.</div>';
    const thead = el.querySelector('thead'), tbody = el.querySelector('tbody');
    thead.onclick = e => {
      const th = e.target.closest('th[data-k]'); if (!th) return;
      const k = th.dataset.k;
      if (st.key === k) st.desc = !st.desc; else { st.key = k; st.desc = k !== 'name'; }
      draw();
    };

    function draw() {
      const rows = all.filter(r => st.reg === 'all' || r.region === st.reg);
      const val = r => st.key === 'state' ? (r.state === 'golden' ? 1 : 0) : r[st.key];
      rows.sort((a, b) => {
        const x = val(a), y = val(b);
        if (x == null) return 1; if (y == null) return -1;
        const o = typeof x === 'string' ? x.localeCompare(y) : x - y;
        return st.desc ? -o : o;
      });
      thead.innerHTML = '<tr>' + COLS.map(([k, l]) =>
        `<th data-k="${k}" class="${st.key === k ? 'on' : ''}" aria-sort="${st.key === k ? (st.desc ? 'descending' : 'ascending') : 'none'}">${l}<span class="gt-ar">${st.key === k ? (st.desc ? '↓' : '↑') : ''}</span></th>`).join('') + '</tr>';
      tbody.innerHTML = rows.map(r => {
        const [t, k] = st8[r.state] || [r.state || '–', '--muted'];
        return `<tr>
          <td><div class="gt-n">${r.name}${r.proxy ? ` <span class="gt-tag">${r.proxy} ETF</span>` : ''}</div><div class="gt-sub">${r.region || ''}</div></td>
          <td><span class="pill gt-pill"><i style="background:${P.css(k)}"></i>${t}</span></td>
          <td class="${c(r.dist200)}">${s(r.dist200)}</td><td>${meter(r.dist200_pctile)}</td>
          <td class="${c(r.r1m)}">${s(r.r1m)}</td><td class="${c(r.r3m)}">${s(r.r3m)}</td><td class="${c(r.r6m)}">${s(r.r6m)}</td><td class="${c(r.r12m)}">${s(r.r12m)}</td>
          <td class="${c(r.volmom)}">${f(r.volmom, 2)}</td><td>${rsiCell(r.rsi, r.rsi_pctile)}</td></tr>`;
      }).join('');
    }
    draw();
  }
});
