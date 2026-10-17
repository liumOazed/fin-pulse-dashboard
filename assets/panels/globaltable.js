Pulse.register({
  id: 'globaltable', order: 5, title: 'Global trend table', subtitle: 'Trend state, momentum and RSI with its own 1-year percentile (RSI alone is a weak signal)',
  render(el, d) {
    const rows = d.globaltable.slice().sort((a, b) => (b.volmom ?? -9) - (a.volmom ?? -9));
    const f = Pulse.fmt, s = Pulse.sgn, c = Pulse.cls;
    const st = { golden: ['Golden cross', 'good'], death: ['Death cross', 'bad'] };
    el.innerHTML = `<div style="overflow-x:auto"><table class="t"><thead><tr><th>Index</th><th>Dist 200D</th><th>Pctile</th><th>50/200</th><th>1M</th><th>3M</th><th>6M</th><th>12M</th><th>Vol-adj mom</th><th>RSI</th><th>RSI pctile</th></tr></thead><tbody>` +
      rows.map(r => { const [t, k] = st[r.state] || [r.state || '–', '']; return `<tr><td>${r.name}</td>
      <td class="${c(r.dist200)}">${s(r.dist200)}</td><td>${f(r.dist200_pctile, 0)}</td><td class="${k}">${t}</td>
      <td class="${c(r.r1m)}">${s(r.r1m)}</td><td class="${c(r.r3m)}">${s(r.r3m)}</td><td class="${c(r.r6m)}">${s(r.r6m)}</td><td class="${c(r.r12m)}">${s(r.r12m)}</td>
      <td>${f(r.volmom, 2)}</td><td>${f(r.rsi, 0)}</td><td class="${r.rsi_pctile > 85 ? 'warn' : r.rsi_pctile < 15 ? 'warn' : ''}">${f(r.rsi_pctile, 0)}</td></tr>`; }).join('') +
      `</tbody></table></div><div class="muted small" style="margin-top:6px">Vol-adj mom = 12M return (ex last month) divided by volatility. Pctile columns compare to each index's own last year.</div>`;
  }
});
