// Test runs: execute the element checklists against a sandbox component.
import { h, mount, field, select, modal, toast, fmtDate } from '../ui.js';
import { api } from '../api.js';
import { CHECKLISTS, COMPONENTS } from '../../shared/catalog.js';

const RESULT_COLORS = { Pass: 'var(--ok)', Fail: 'var(--err)', Blocked: 'var(--warn)', 'N/A': '#57534e' };

function stackBar(s) {
  const parts = ['Pass', 'Fail', 'Blocked', 'N/A'].filter(k => s.counts[k]);
  return h('div', {},
    h('div.stack', { role: 'img', 'aria-label': parts.map(k => `${k} ${s.counts[k]}`).join(', ') || 'Nothing executed' },
      parts.map(k => h('i', { style: { width: (s.counts[k] / s.total) * 100 + '%', background: RESULT_COLORS[k] }, title: `${k}: ${s.counts[k]}` }))),
    h('div.legend', {}, [...parts, 'Not run'].map(k => h('span', { style: { '--c': RESULT_COLORS[k] || '#efe9e1' } }, `${k} ${s.counts[k]}`))));
}

export async function renderRuns(view, { actor }) {
  const runs = await api('GET', '/runs');
  const name = h('input', { placeholder: 'e.g. Sign up form: text fields', maxlength: 120 });
  const target = select([['', 'Select…'], ...COMPONENTS], '');
  const boxes = CHECKLISTS.map(c => h('input', { type: 'checkbox', value: c.id }));
  const err = h('p.form-error', { role: 'alert' });
  const create = async e => {
    e.preventDefault();
    try {
      const run = await api('POST', '/runs', { name: name.value, target: target.value, checklists: boxes.filter(b => b.checked).map(b => b.value) });
      toast('Test run created', 'ok'); location.hash = `#/runs/${run.id}`;
    } catch (ex) { err.textContent = ex.message; }
  };
  mount(view,
    h('div.page-head', {}, h('div', {}, h('div.eyebrow', {}, 'Module 2'), h('h1', {}, 'Test runs'),
      h('p', {}, 'Pick a component of the sandbox and the element checklists to run against it. Each failed check is linked to a bug report; a run cannot be completed while something is left unexecuted or unlinked.'))),
    h('div.split', {},
      h('div', {}, runs.length ? runs.map(r => h('a.panel', { href: `#/runs/${r.id}`, style: { display: 'block', textDecoration: 'none', color: 'inherit' } },
        h('div.row', {}, h('b', {}, r.name), h('span.spacer'), h('span.status' + (r.status === 'Completed' ? '.resolved' : r.status === 'In progress' ? '.in-progress' : ''), {}, r.status)),
        h('div.small.muted', { style: { margin: '4px 0 8px' } }, `#${r.id} · ${r.target} · ${(typeof r.checklists === 'string' ? JSON.parse(r.checklists) : r.checklists).join(', ')} · ${r.tester} · ${fmtDate(r.created_at)}`),
        stackBar(r.summary),
        h('div.small', { style: { marginTop: '6px' } }, `Progress ${r.summary.progress}% · pass rate ${r.summary.passRate}%`)))
        : h('div.panel.muted', {}, 'No runs yet.')),
      h('form.panel.sticky', { onsubmit: create },
        h('h2', {}, 'New test run'),
        !actor ? h('div.callout.warn', {}, 'Enter your name (top right) to create a run.') : null,
        field('Name', name, { required: true, id: 'run-name' }),
        field('Component under test', target, { required: true, id: 'run-target' }),
        h('div.field', {}, h('span.label', {}, 'Checklists', h('span.req', {}, ' *')),
          CHECKLISTS.map((c, i) => h('label.check', {}, boxes[i], h('span', {}, `${c.name} `, h('span.muted.small', {}, `(${c.items.length} checks)`))))),
        err, h('div.actions', {}, h('button.primary', { type: 'submit' }, 'Create run')))));
}

export async function renderRun(view, { args, actor }) {
  let run = await api('GET', `/runs/${args[0]}`);
  const locked = () => run.status === 'Completed';

  async function setResult(item, result, extra = {}) {
    try { run = await api('PUT', `/runs/${run.id}/results/${item.id}`, { result, note: extra.note ?? item.note, bugKey: extra.bugKey }); draw(); }
    catch (e) {
      if ((result === 'N/A' || result === 'Blocked') && extra.note === undefined) noteDialog(item, result);
      else toast(e.message, 'error');
    }
  }
  function noteDialog(item, result) {
    const note = h('textarea', { rows: 3, value: item.note, placeholder: result === 'Blocked' ? 'Blocked by TC-…' : 'Why the check does not apply' });
    const err = h('p.form-error', { role: 'alert' });
    const m = modal(`${result}: ${item.id}`, h('form', { onsubmit: async e => {
      e.preventDefault();
      try { run = await api('PUT', `/runs/${run.id}/results/${item.id}`, { result, note: note.value }); m.close(); draw(); } catch (ex) { err.textContent = ex.message; }
    } }, h('p.muted', {}, result === 'Blocked' ? 'Name the defect that blocks this check.' : 'Explain why this check is not applicable to the component.'),
    note, err, h('div.actions', {}, h('button.primary', { type: 'submit' }, 'Save'))));
  }
  function linkDialog(item) {
    const key = h('input', { placeholder: 'TC-…', value: item.bug_key || '' });
    const err = h('p.form-error', { role: 'alert' });
    const m = modal(`Link a bug to ${item.id}`, h('form', { onsubmit: async e => {
      e.preventDefault();
      try { run = await api('PUT', `/runs/${run.id}/results/${item.id}`, { result: 'Fail', note: item.note, bugKey: key.value }); m.close(); draw(); } catch (ex) { err.textContent = ex.message; }
    } }, field('Existing bug key', key, { id: 'lk-key' }), err, h('div.actions', {}, h('button.primary', { type: 'submit' }, 'Link'))));
  }
  async function complete() {
    try { run = await api('POST', `/runs/${run.id}/complete`); draw(); toast('Run completed', 'ok'); }
    catch (e) {
      modal('The run cannot be completed yet', h('div', {}, h('p', {}, e.message), h('ul', {}, (e.body.problems || []).map(p => h('li', {}, p)))));
    }
  }

  function draw() {
    const s = run.summary;
    const sections = [];
    let lastList = null;
    run.items.forEach(item => {
      if (item.checklist !== lastList) { sections.push(h('h3', { style: { marginTop: '18px' } }, item.checklist)); lastList = item.checklist; }
      const seg = h('div.seg', { role: 'group', 'aria-label': `Result of ${item.id}` }, ['Pass', 'Fail', 'Blocked', 'N/A'].map(rs =>
        h('button', { type: 'button', class: (item.result === rs ? 'on ' : '') + rs.replace('/', ''), 'aria-pressed': String(item.result === rs), disabled: locked(), onclick: () => setResult(item, rs) }, rs)));
      sections.push(h('div.check-item', {},
        h('span.pill', {}, item.id),
        h('div', {}, h('div', {}, h('b', {}, item.title), h('span.muted.small', {}, ` · ${item.section}`)), h('div.exp', {}, 'Expected: ' + item.expected),
          item.note ? h('div.small', {}, '📝 ' + item.note) : null,
          item.result === 'Fail' ? h('div.row.small', { style: { marginTop: '4px' } },
            item.bug_key ? ['Bug: ', h('a.key', { href: `#/bugs/${item.bug_key}` }, item.bug_key)] : h('span', { style: { color: 'var(--err)' } }, 'No bug linked yet.'),
            !locked() ? h('a.btn', { href: `#/report?component=${encodeURIComponent(run.target)}&check=${item.id}&run=${run.id}` }, 'Log bug') : null,
            !locked() ? h('button.ghost', { type: 'button', onclick: () => linkDialog(item) }, 'Link existing') : null) : null),
        seg));
    });
    mount(view,
      h('div.page-head', {}, h('div', {}, h('a', { href: '#/runs' }, '← Test runs'),
        h('h1', { style: { marginTop: '6px' } }, run.name),
        h('p', {}, `#${run.id} · component ${run.target} · tester ${run.tester} · `, h('span.status' + (locked() ? '.resolved' : ''), {}, run.status))),
      h('div.row', {}, h('a.btn', { href: '/sandbox/', target: '_blank', rel: 'noopener' }, 'Open sandbox ↗'),
        !locked() ? h('button.primary', { type: 'button', onclick: complete }, 'Complete run') : null)),
      h('div.grid.g4', {},
        h('div.tile', {}, h('div.num', {}, s.progress, h('small', {}, '%')), h('div.cap', {}, 'Executed'), h('div.meter', {}, h('i', { style: { width: s.progress + '%' } }))),
        h('div.tile', {}, h('div.num', {}, s.passRate, h('small', {}, '%')), h('div.cap', {}, 'Pass rate (of executed)')),
        h('div.tile', {}, h('div.num', {}, s.counts.Fail), h('div.cap', {}, 'Failed checks')),
        h('div.tile', {}, h('div.num', {}, s.counts['N/A']), h('div.cap', {}, 'Not applicable'))),
      h('div.panel', { style: { marginTop: '16px' } }, stackBar(s), sections));
  }
  draw();
}
