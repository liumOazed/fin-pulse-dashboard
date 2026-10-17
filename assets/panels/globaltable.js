Pulse.register({
  id: 'globaltable', tab: 'overview', order: 5,
  title: 'Global trend table', subtitle: 'Trend, momentum and RSI with its own 1-year percentile. Sorted by volatility-adjusted momentum.',
  render(el, d) {
    const rows = d.globaltable.slice().sort((a, b) => (b.volmom ?? -9) - (a.volmom ?? -9));
    const f = Pulse.fmt, s = Pulse.sgn, c = Pulse.dir;
    const st = { golden: ['Golden cross', '--good'], death: ['Death cross', '--bad'] };
    el.innerHTML = `<div class="tbl-wrap"><table class="t"><thead><tr><th>Index</th><th>vs 200D</th><th>Pctile</th><th>50/200</th><th>1M</th><th>3M</th><th>6M</th><th>12M</th><th>Vol-adj mom</th><th>RSI</th><th>RSI pctile</th></tr></thead><tbody>` +
      rows.map(r => { const [t, k] = st[r.state] || [r.state || '–', '--muted']; return `<tr><td>${r.name}</td>
      <td class="${c(r.dist200)}">${s(r.dist200)}</td><td>${f(r.dist200_pctile, 0)}</td>
      <td><span class="pill" style="font-weight:500;padding:1px 8px"><i style="background:${Pulse.css(k)}"></i>${t}</span></td>
      <td class="${c(r.r1m)}">${s(r.r1m)}</td><td class="${c(r.r3m)}">${s(r.r3m)}</td><td class="${c(r.r6m)}">${s(r.r6m)}</td><td class="${c(r.r12m)}">${s(r.r12m)}</td>
      <td>${f(r.volmom, 2)}</td><td>${f(r.rsi, 0)}</td><td>${f(r.rsi_pctile, 0)}</td></tr>`; }).join('') +
      `</tbody></table></div><div class="note">Vol-adj mom = 6-month return ÷ annualised volatility. Percentiles compare each index with its own last year.</div>`;
  }
});
