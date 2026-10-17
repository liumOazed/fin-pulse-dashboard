Pulse.register({
  id: 'flags', order: 2, title: 'Risk flags', subtitle: 'Market risk, signal quality and data quality - with what each means for you',
  render(el, d) {
    if (!d.flags.length) { el.innerHTML = '<div class="muted">No flags raised.</div>'; return; }
    el.innerHTML = d.flags.map(f => `<div class="flag"><div class="lvl ${f.level}"></div>
      <div class="tag">${f.tier}</div><div><b>${f.title}</b><div class="muted">${f.implication}</div></div></div>`).join('');
  }
});
