// Tracker: list / severity board of reports, and the report page.
// Everyone is a tester: the reporter can edit the report and change its
// severity with a documented reason; everyone can read and comment.
import { h, mount, select, modal, toast, field, sevBadge, fmtDate, copyText } from '../ui.js';
import { api } from '../api.js';
import { jiraView } from '../jira-view.js';
import { toJiraMarkup, isReporter } from '../../shared/workflow.js';
import { COMPONENTS, SEVERITY_LEVELS, RAISE_REASONS, LOWER_REASONS, FORBIDDEN_REASONS } from '../../shared/catalog.js';

const VIEW_KEY = 'qalab.trackerView';
const GRADES = ['A', 'B', 'C', 'D', 'F'];
const FIELD_LABEL = {
  created: 'created the report', summary: 'Summary', component: 'Component/s', affects_version: 'Affects Version/s', environment: 'Environment',
  error_type: 'Error Type', labels: 'Labels', precondition: 'Precondition', steps: 'Steps to reproduce', actual: 'Actual result',
  expected: 'Expected result', note: 'Note', severity: 'Severity', quality_score: 'Quality score', planted_id: 'Planted defect',
};

export async function renderBugs(view, { params, actor }) {
  const f = { severity: params.get('severity') || '', component: params.get('component') || '', reporter: params.get('reporter') || '', grade: params.get('grade') || '', q: params.get('q') || '', sort: params.get('sort') || 'created' };
  let mode = localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
  const listBox = h('div');
  const count = h('span.muted');

  const setF = (k, v) => { f[k] = v; const qs = new URLSearchParams(Object.entries(f).filter(([, x]) => x)); history.replaceState(null, '', '#/bugs' + (qs.toString() ? '?' + qs : '')); load(); };
  const fsel = (k, opts, label) => select([['', label], ...opts], f[k], { onchange: e => setF(k, e.target.value), 'aria-label': label });
  const search = h('input', { type: 'search', placeholder: 'Search summary or key', value: f.q, 'aria-label': 'Search reports' });
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setF('q', search.value.trim()), 250); });
  const mine = h('input', { type: 'checkbox', checked: !!actor && f.reporter === actor.name, disabled: !actor });
  mine.addEventListener('change', () => setF('reporter', mine.checked ? actor.name : ''));

  async function load() {
    const qs = new URLSearchParams(Object.entries(f).filter(([, x]) => x));
    const bugs = await api('GET', '/bugs?' + qs);
    count.textContent = `${bugs.length} report${bugs.length === 1 ? '' : 's'}`;
    if (!bugs.length) { mount(listBox, h('div.panel.muted', {}, 'No reports match the filters.')); return; }
    if (mode === 'board') {
      mount(listBox, h('div.board', {}, SEVERITY_LEVELS.map(s => {
        const items = bugs.filter(b => b.severity === s);
        return h('div.col', {}, h('h3', {}, sevBadge(s), h('span', {}, items.length)),
          items.map(b => h('div.card', { tabindex: 0, role: 'link', onclick: () => { location.hash = `#/bugs/${b.key}`; }, onkeydown: e => { if (e.key === 'Enter') location.hash = `#/bugs/${b.key}`; } },
            h('div.row', {}, h('span.key', {}, b.key), h('span.spacer'), h('span.mono.small', {}, `${b.quality_score} · ${b.quality_grade}`)),
            h('div.t', {}, b.summary),
            h('div.small.muted', {}, `${b.component} · ${b.reporter}`))));
      })));
    } else {
      mount(listBox, h('div.panel', { style: { padding: 0, overflowX: 'auto' } }, h('table', {},
        h('thead', {}, h('tr', {}, ['Key', 'Summary', 'Component', 'Severity', 'Reporter', 'Quality', 'Updated'].map(x => h('th', {}, x)))),
        h('tbody', {}, bugs.map(b => h('tr.clickable', { onclick: () => { location.hash = `#/bugs/${b.key}`; } },
          h('td', {}, h('a.key', { href: `#/bugs/${b.key}` }, b.key)), h('td', {}, b.summary), h('td', {}, b.component),
          h('td', {}, sevBadge(b.severity)), h('td', {}, b.reporter),
          h('td.mono', {}, `${b.quality_score} (${b.quality_grade})`), h('td.small.muted', {}, fmtDate(b.updated_at))))))));
    }
  }

  const modeBtn = (m, label) => h('button', { type: 'button', class: mode === m ? 'primary' : '', 'aria-pressed': String(mode === m), onclick: () => {
    localStorage.setItem(VIEW_KEY, m);
    renderBugs(view, { params: new URLSearchParams(Object.entries(f).filter(([, x]) => x)), actor });
  } }, label);
  mount(view,
    h('div.page-head', {}, h('div', {}, h('div.eyebrow', {}, 'Module 5'), h('h1', {}, 'Tracker'),
      h('p', {}, 'All submitted reports. Open one to read it, comment on it, or (if it is yours) improve it and re-check its quality.')),
    h('div.row', {}, modeBtn('list', 'List'), modeBtn('board', 'Board by severity'), h('a.btn.primary', { href: '#/report' }, '+ New report'))),
    h('div.filters', {},
      search, fsel('severity', SEVERITY_LEVELS, 'Any severity'), fsel('component', COMPONENTS, 'Any component'), fsel('grade', GRADES.map(g => [g, `Grade ${g}`]), 'Any grade'),
      select([['created', 'Newest'], ['updated', 'Recently updated'], ['score', 'Best quality']], f.sort, { onchange: e => setF('sort', e.target.value), 'aria-label': 'Sort' }),
      h('label.check', { style: { alignItems: 'center' } }, mine, h('span', {}, 'Only my reports')),
      count),
    listBox);
  await load();
}

export async function renderBug(view, { args, actor }) {
  const key = args[0].toUpperCase();
  let bug = await api('GET', `/bugs/${key}`);
  const refresh = b => { bug = b; draw(); };

  function severityDialog() {
    const to = select(SEVERITY_LEVELS.filter(s => s !== bug.severity), '');
    const reasons = [...RAISE_REASONS.map(r => [r.id, `Raise · ${r.id}: ${r.text}`]), ...LOWER_REASONS.map(r => [r.id, `Lower · ${r.id}: ${r.text}`]),
      ...FORBIDDEN_REASONS.map(r => [r.id, `${r.id}: ${r.text}`])];
    const reason = select([['', 'Select the documented reason…'], ...reasons], '');
    const err = h('p.form-error', { role: 'alert' });
    const m = modal(`Change severity of ${bug.key}`, h('form', { onsubmit: async e => {
      e.preventDefault();
      try { refresh(await api('POST', `/bugs/${bug.key}/severity`, { value: to.value, reasonId: reason.value })); m.close(); toast('Severity changed', 'ok'); }
      catch (ex) { err.textContent = ex.message; }
    } },
    h('p.small.muted', {}, 'As a rule the tester does not change severity. Only the documented reasons allow a change of one level.'),
    h('p', {}, 'Current: ', sevBadge(bug.severity)),
    field('New severity', to, { id: 'sv-to' }), field('Reason', reason, { id: 'sv-reason' }), err,
    h('div.actions', {}, h('button.primary', { type: 'submit' }, 'Change severity'))));
  }

  function draw() {
    const own = isReporter(bug, actor);
    const comment = h('textarea', { rows: 3, placeholder: 'Add a comment…' });
    const postComment = async e => {
      e.preventDefault();
      try { refresh(await api('POST', `/bugs/${bug.key}/comments`, { body: comment.value })); toast('Comment added', 'ok'); }
      catch (ex) { toast(ex.message, 'error'); }
    };

    mount(view,
      h('div.page-head', {}, h('div', {},
        h('a', { href: '#/bugs' }, '← Tracker'),
        h('div.row', { style: { marginTop: '6px' } }, h('span.key', { style: { fontSize: '1.1rem' } }, bug.key), sevBadge(bug.severity),
          bug.planted_id && own ? h('span.badge.sev-enh', { title: 'This report matched a planted defect' }, `🎯 ${bug.planted_id}`) : null)),
      h('div.row', {},
        own ? h('a.btn.primary', { href: `#/report?edit=${bug.key}` }, 'Edit report') : null,
        h('button', { type: 'button', onclick: () => copyText(toJiraMarkup(bug)) }, 'Copy Jira markup'))),
      h('div.split', {},
        h('div', {},
          h('div.panel', {}, jiraView(bug)),
          h('div.panel', {}, h('h2', {}, `Comments (${bug.comments.length})`),
            bug.comments.length ? bug.comments.map(c => h('div.comment', {}, h('div.who', {}, `${c.author} · ${fmtDate(c.at)}`), h('div', { style: { whiteSpace: 'pre-wrap' } }, c.body))) : h('p.muted', {}, 'No comments yet.'),
            actor ? h('form', { onsubmit: postComment }, comment, h('div.actions', {}, h('button', { type: 'submit' }, 'Comment'))) : h('p.muted.small', {}, 'Enter your name (top right) to comment.')),
          h('div.panel', {}, h('h2', {}, 'History'), h('ul.timeline', {}, bug.history.map(x => h('li', {},
            h('span.muted', {}, fmtDate(x.at) + ' · '), h('b', {}, x.actor), ' ',
            x.field === 'created' ? `created the report (${x.new_value})`
              : ['changed ', h('b', {}, FIELD_LABEL[x.field] || x.field),
                ['severity', 'quality_score', 'planted_id', 'component', 'error_type', 'affects_version'].includes(x.field)
                  ? [': ', h('s.muted', {}, x.old_value ?? '—'), ' → ', h('b', {}, x.new_value ?? '—')]
                  : h('details', {}, h('summary.small.muted', {}, 'show change'), h('div.small', {}, h('div.muted', {}, 'Before:'), h('pre.small', { style: { whiteSpace: 'pre-wrap' } }, x.old_value || '—'), h('div.muted', {}, 'After:'), h('pre.small', { style: { whiteSpace: 'pre-wrap' } }, x.new_value || '—')))],
            x.reason ? h('div.small.muted', {}, 'Reason: ' + x.reason) : null))))),
        h('div.sticky', {},
          h('div.panel', {}, h('h2', {}, 'Report quality'),
            h('div.score', {}, h('div.ring', { style: { '--p': bug.quality_score, '--c': bug.quality_score >= 90 ? 'var(--ok)' : bug.quality_score >= 60 ? 'var(--warn)' : 'var(--err)' } }, h('span', {}, bug.quality_score)),
              h('div', {}, h('b', {}, `Grade ${bug.quality_grade}`), h('div.small.muted', {}, `${bug.lint.warnings} warnings · ${bug.lint.tips} tips`))),
            bug.lint.issues.length ? h('ul.issues', {}, bug.lint.issues.map(i => h('li.issue.' + i.level, {}, h('span.ic', {}, i.level === 'warning' ? '!' : i.level === 'error' ? '✕' : 'i'), h('span', {}, h('span.rid', {}, i.id + ' '), i.message, i.hint ? h('div.h', {}, i.hint) : null)))) : h('p.lint-ok', {}, '✓ No remarks'),
            own && (bug.lint.errors + bug.lint.warnings) > 0 ? h('a.btn', { href: `#/report?edit=${bug.key}`, style: { marginTop: '10px' } }, 'Improve this report') : null),
          h('div.panel', {}, h('h2', {}, 'Severity'),
            h('p', {}, sevBadge(bug.severity), bug.suggested_severity && bug.suggested_severity !== bug.severity ? h('span.small.muted', {}, `  wizard result: ${bug.suggested_severity}`) : null),
            own ? h('button', { type: 'button', onclick: severityDialog }, 'Change severity…')
              : h('p.small.muted', {}, `Only the reporter (${bug.reporter}) can change the severity, and only for a documented reason.`)),
          bug.run_id ? h('div.panel', {}, h('h2', {}, 'Test run'), h('a', { href: `#/runs/${bug.run_id}` }, `Run #${bug.run_id}`), ` · check ${bug.check_id}`) : null)));
  }
  draw();
}
