Pulse.register({
  id: 'flags', tab: 'overview', order: 2,
  title: 'Risk flags', subtitle: 'What needs attention, and what it means.',
  render(el, d) {
    if (!d.flags.length) { el.innerHTML = '<div class="muted">No flags raised today.</div>'; return; }
    const col = { high: '--bad', med: '--warn', low: '--good' };
    const lab = { high: 'High', med: 'Watch', low: 'Info' };
    el.innerHTML = d.flags.map(f => `<div class="flag">
      <span class="dot" style="background:${Pulse.css(col[f.level] || '--warn')}" title="${lab[f.level] || ''}"></span>
      <div class="tier">${f.tier}</div>
      <div><div style="font-weight:600">${f.title} <span class="muted small" style="font-weight:400">· ${lab[f.level] || ''}</span></div><div class="small" style="color:var(--ink-2)">${f.implication}</div></div>
    </div>`).join('');
  }
});
