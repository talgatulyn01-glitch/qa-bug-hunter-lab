// Tiny DOM helpers. h() builds elements without innerHTML, so user data is
// always inserted as text (the lab itself must not have the bugs it teaches).
export function h(tag, attrs = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, String(val)); else el.style[p] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const mount = (el, ...children) => { clear(el); append(el, children); return el; };

export function toast(message, kind = 'info') {
  const box = document.getElementById('toasts');
  const t = h('div.toast.' + kind, { role: 'status' }, message);
  box.appendChild(t);
  setTimeout(() => t.classList.add('out'), 3800);
  setTimeout(() => t.remove(), 4300);
}

export function modal(title, body, { wide = false, onClose } = {}) {
  const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
  const esc = e => { if (e.key === 'Escape') close(); };
  const overlay = h('div.overlay', { onclick: e => { if (e.target === overlay) close(); } },
    h('div.modal' + (wide ? '.wide' : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('div.modal-head', {}, h('h2', {}, title), h('button.icon-btn', { onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div.modal-body', {}, body)));
  document.body.appendChild(overlay);
  document.addEventListener('keydown', esc);
  const f = overlay.querySelector('input, select, textarea, button.primary');
  if (f) setTimeout(() => f.focus(), 30);
  return { close, el: overlay };
}

export function field(label, control, { hint, required, id } = {}) {
  if (id) control.id = id;
  return h('label.field', { for: id || null },
    h('span.label', {}, label, required ? h('span.req', { 'aria-hidden': 'true' }, ' *') : null),
    control,
    hint ? h('span.hint', {}, hint) : null);
}

export function select(options, value, attrs = {}) {
  return h('select', attrs, options.map(o => {
    const [v, t] = Array.isArray(o) ? o : [o, o];
    return h('option', { value: v, selected: v === value }, t);
  }));
}

export const SEV_CLASS = { Critical: 'sev-critical', Major: 'sev-major', Average: 'sev-average', Minor: 'sev-minor', Enhancement: 'sev-enh' };
export const sevBadge = s => h('span.badge.' + (SEV_CLASS[s] || 'sev-minor'), { title: `Severity: ${s}` }, s || '—');
export const statusBadge = s => h('span.status.' + String(s || '').toLowerCase().replace(/\s+/g, '-'), {}, s);

export function fmtDate(d) {
  try { return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(d); }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied to clipboard', 'ok'); }
  catch { toast('Copy failed: select the text and press Ctrl+C', 'error'); }
}

// Horizontal bar chart: one series, one hue, direct value labels, hover tooltip.
export function barChart(title, data, { order, unit = '' } = {}) {
  const entries = (order || Object.keys(data)).map(k => [k, data[k] || 0]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  const rowH = 30; const labelW = 110; const width = 420; const plotW = width - labelW - 44;
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${entries.length * rowH + 6}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${title}: ` + entries.map(([k, v]) => `${k} ${v}`).join(', '));
  const tip = h('div.chart-tip', { hidden: true });
  entries.forEach(([k, v], i) => {
    const y = i * rowH + 4;
    const g = document.createElementNS(svgNS, 'g');
    const mk = (tag, a) => { const e = document.createElementNS(svgNS, tag); for (const [x, val] of Object.entries(a)) e.setAttribute(x, val); g.appendChild(e); return e; };
    mk('rect', { x: 0, y: y - 2, width, height: rowH, fill: 'transparent', class: 'hit' });
    const lbl = mk('text', { x: labelW - 10, y: y + 15, 'text-anchor': 'end', class: 'axis-label' }); lbl.textContent = k;
    mk('rect', { x: labelW, y: y + 4, width: plotW, height: 14, rx: 4, class: 'track' });
    const w = v ? Math.max(6, (v / max) * plotW) : 0;
    if (w) mk('rect', { x: labelW, y: y + 4, width: w, height: 14, rx: 4, class: 'bar' });
    const val = mk('text', { x: labelW + w + 8, y: y + 15, class: 'value-label' }); val.textContent = v + unit;
    g.addEventListener('mousemove', e => {
      tip.hidden = false; tip.textContent = `${k}: ${v}${unit}`;
      const r = svg.getBoundingClientRect();
      tip.style.left = (e.clientX - r.left + 12) + 'px'; tip.style.top = (e.clientY - r.top - 8) + 'px';
    });
    g.addEventListener('mouseleave', () => { tip.hidden = true; });
    svg.appendChild(g);
  });
  return h('figure.chart', {}, h('figcaption', {}, title), h('div.chart-wrap', {}, svg, tip));
}
