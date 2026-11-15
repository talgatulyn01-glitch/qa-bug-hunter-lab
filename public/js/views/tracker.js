// Tracker: list / board of bugs and the bug page with workflow actions.
import { h, mount, select, modal, toast, field, sevBadge, statusBadge, fmtDate, copyText } from '../ui.js';
import { api } from '../api.js';
import { jiraView } from '../jira-view.js';
import { STATUSES, RESOLUTIONS, availableTransitions, toJiraMarkup, AGREED_REASON } from '../../shared/workflow.js';
import { COMPONENTS, SEVERITY_LEVELS, PRIORITIES, RAISE_REASONS, LOWER_REASONS, FORBIDDEN_REASONS } from '../../shared/catalog.js';

const VIEW_KEY = 'qalab.trackerView';

export async function renderBugs(view, { params }) {
  const f = { status: params.get('status') || '', severity: params.get('severity') || '', component: params.get('component') || '', reporter: params.get('reporter') || '', q: params.get('q') || '', sort: params.get('sort') || 'created' };
  let mode = localStorage.getItem(VIEW_KEY) || 'list';
  const listBox = h('div');
  const count = h('span.muted');

  const setF = (k, v) => { f[k] = v; const qs = new URLSearchParams(Object.entries(f).filter(([, x]) => x)); history.replaceState(null, '', '#/bugs' + (qs.toString() ? '?' + qs : '')); load(); };
  const fsel = (k, opts, label) => select([['', label], ...opts], f[k], { onchange: e => setF(k, e.target.value), 'aria-label': label });
  const search = h('input', { type: 'search', placeholder: 'Search summary or key', value: f.q, 'aria-label': 'Search bugs' });
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => setF('q', search.value.trim()), 250); });

  async function load() {
    const qs = new URLSearchParams(Object.entries(f).filter(([, x]) => x));
    const bugs = await api('GET', '/bugs?' + qs);
    count.textContent = `${bugs.length} bug${bugs.length === 1 ? '' : 's'}`;
    if (!bugs.length) { mount(listBox, h('div.panel.muted', {}, 'No bugs match the filters.')); return; }
    if (mode === 'board') {
      mount(listBox, h('div.board', {}, STATUSES.map(s => {
        const items = bugs.filter(b => b.status === s);
        return h('div.col', {}, h('h3', {}, s, h('span', {}, items.length)),
          items.map(b => h('div.card', { tabindex: 0, role: 'link', onclick: () => { location.hash = `#/bugs/${b.key}`; }, onkeydown: e => { if (e.key === 'Enter') location.hash = `#/bugs/${b.key}`; } },
            h('div.row', {}, h('span.key', {}, b.key), h('span.spacer'), sevBadge(b.severity)),
            h('div.t', {}, b.summary),
            h('div.small.muted', {}, `${b.assignee} · ${b.priority} · score ${b.quality_score}`))));
      })));
    } else {
      mount(listBox, h('div.panel', { style: { padding: 0, overflowX: 'auto' } }, h('table', {},
        h('thead', {}, h('tr', {}, ['Key', 'Summary', 'Status', 'Severity', 'Priority', 'Reporter', 'Assignee', 'Quality'].map(x => h('th', {}, x)))),
        h('tbody', {}, bugs.map(b => h('tr.clickable', { onclick: () => { location.hash = `#/bugs/${b.key}`; } },
          h('td', {}, h('a.key', { href: `#/bugs/${b.key}` }, b.key)), h('td', {}, b.summary), h('td', {}, statusBadge(b.status)),
          h('td', {}, sevBadge(b.severity)), h('td', {}, b.priority), h('td', {}, b.reporter), h('td', {}, b.assignee),
          h('td.mono', {}, `${b.quality_score} (${b.quality_grade})`)))))));
    }
  }

  const modeBtn = (m, label) => h('button', { type: 'button', class: mode === m ? 'primary' : '', 'aria-pressed': String(mode === m), onclick: () => { mode = m; localStorage.setItem(VIEW_KEY, m); renderBugs(view, { params: new URLSearchParams(Object.entries(f).filter(([, x]) => x)) }); } }, label);
  mount(view,
    h('div.page-head', {}, h('div', {}, h('div.eyebrow', {}, 'Module 5'), h('h1', {}, 'Tracker'),
      h('p', {}, 'Jira-like workflow: Open → In Progress → Resolved → Closed, with Reopen. What you can do depends on your role.')),
    h('div.row', {}, modeBtn('list', 'List'), modeBtn('board', 'Board'), h('a.btn.primary', { href: '#/report' }, '+ New report'))),
    h('div.filters', {},
      search, fsel('status', STATUSES, 'Any status'), fsel('severity', SEVERITY_LEVELS, 'Any severity'), fsel('component', COMPONENTS, 'Any component'),
      select([['created', 'Newest'], ['updated', 'Recently updated'], ['score', 'Best quality']], f.sort, { onchange: e => setF('sort', e.target.value), 'aria-label': 'Sort' }),
      count),
    listBox);
  await load();
}

export async function renderBug(view, { args, actor }) {
  const key = args[0].toUpperCase();
  let bug = await api('GET', `/bugs/${key}`);

  const refresh = b => { bug = b; draw(); };
  const act = async (fn, okMsg) => {
    try { refresh(await fn()); if (okMsg) toast(okMsg, 'ok'); return true; } catch (e) { toast(e.message, 'error'); return false; }
  };

  function transitionDialog(t) {
    const comment = h('textarea', { rows: 3, placeholder: t.needsComment ? 'Why? (required)' : 'Comment (optional)' });
    const res = select([['', 'Select…'], ...RESOLUTIONS], '');
    const dup = h('input', { placeholder: 'TC-…' });
    const dupField = field('Duplicate of', dup, { id: 'tr-dup' }); dupField.hidden = true;
    res.addEventListener('change', () => { dupField.hidden = res.value !== 'Duplicate'; });
    const verified = h('input', { type: 'checkbox' });
    const err = h('p.form-error', { role: 'alert' });
    const needsVerify = t.to === 'Closed' && actor?.role === 'Tester' && bug.resolution === 'Fixed';
    const m = modal(`${t.name}: ${bug.key}`, h('form', { onsubmit: async e => {
      e.preventDefault();
      try {
        refresh(await api('POST', `/bugs/${bug.key}/transition`, { to: t.to, resolution: res.value || undefined, duplicateOf: dup.value || undefined, comment: comment.value, verified: verified.checked }));
        m.close(); toast(`${bug.key} → ${t.to}`, 'ok');
      } catch (ex) { err.textContent = ex.message; }
    } },
    h('p.muted', {}, `${bug.status} → ${t.to}`),
    t.needsResolution ? field('Resolution', res, { required: true, id: 'tr-res', hint: actor?.role === 'Lead' ? '' : '"Won\'t Fix" is reserved for the Lead.' }) : null,
    t.needsResolution ? dupField : null,
    needsVerify ? h('label.check', {}, verified, h('span', {}, 'I re-ran the steps to reproduce and the defect is no longer reproduced.')) : null,
    field('Comment', comment, { id: 'tr-comment', required: !!t.needsComment }),
    err, h('div.actions', {}, h('button.primary', { type: 'submit' }, t.name))));
  }

  function severityDialog() {
    const to = select(SEVERITY_LEVELS.filter(s => s !== bug.severity), '');
    const reasons = [...RAISE_REASONS.map(r => [r.id, `Raise · ${r.id}: ${r.text}`]), ...LOWER_REASONS.map(r => [r.id, `Lower · ${r.id}: ${r.text}`]),
      ...FORBIDDEN_REASONS.map(r => [r.id, `${r.id}: ${r.text}`]), ...(actor?.role === 'Lead' ? [[AGREED_REASON.id, `${AGREED_REASON.id}: ${AGREED_REASON.text}`]] : [])];
    const reason = select([['', 'Select the documented reason…'], ...reasons], '');
    const err = h('p.form-error', { role: 'alert' });
    const m = modal(`Change severity of ${bug.key}`, h('form', { onsubmit: async e => {
      e.preventDefault();
      try { refresh(await api('PATCH', `/bugs/${bug.key}`, { field: 'severity', value: to.value, reasonId: reason.value })); m.close(); toast('Severity changed', 'ok'); }
      catch (ex) { err.textContent = ex.message; }
    } },
    h('p.small.muted', {}, 'As a rule the tester does not change severity. Only the documented reasons allow a change of one level.'),
    h('p', {}, 'Current: ', sevBadge(bug.severity)),
    field('New severity', to, { id: 'sv-to' }), field('Reason', reason, { id: 'sv-reason' }), err,
    h('div.actions', {}, h('button.primary', { type: 'submit' }, 'Change severity'))));
  }

  function draw() {
    const role = actor?.role;
    const trans = actor ? availableTransitions(bug, role) : [];
    const isReporter = actor?.name === bug.reporter;
    const prio = select(PRIORITIES, bug.priority, { 'aria-label': 'Priority', disabled: role !== 'Lead' });
    prio.addEventListener('change', () => act(() => api('PATCH', `/bugs/${bug.key}`, { field: 'priority', value: prio.value }), 'Priority updated'));
    const assignee = h('input', { value: bug.assignee === 'Unassigned' ? '' : bug.assignee, placeholder: 'Unassigned', disabled: role !== 'Lead' });
    const comment = h('textarea', { rows: 3, placeholder: 'Add a comment…' });

    mount(view,
      h('div.page-head', {}, h('div', {},
        h('a', { href: '#/bugs' }, '← Tracker'),
        h('div.row', { style: { marginTop: '6px' } }, h('span.key', { style: { fontSize: '1.1rem' } }, bug.key), statusBadge(bug.status), sevBadge(bug.severity),
          bug.planted_id && isReporter ? h('span.badge.sev-enh', { title: 'This report matched a planted defect' }, `🎯 ${bug.planted_id}`) : null)),
      h('div.row', {}, h('button', { type: 'button', onclick: () => copyText(toJiraMarkup(bug)) }, 'Copy Jira markup'))),
      h('div.split', {},
        h('div', {},
          h('div.panel', {}, jiraView(bug)),
          h('div.panel', {}, h('h2', {}, `Comments (${bug.comments.length})`),
            bug.comments.length ? bug.comments.map(c => h('div.comment', {}, h('div.who', {}, `${c.author} · ${c.role} · ${fmtDate(c.at)}`), h('div', { style: { whiteSpace: 'pre-wrap' } }, c.body))) : h('p.muted', {}, 'No comments yet.'),
            actor ? h('form', { onsubmit: async e => { e.preventDefault(); if (await act(() => api('POST', `/bugs/${bug.key}/comments`, { body: comment.value }), 'Comment added')) comment.value = ''; } },
              comment, h('div.actions', {}, h('button', { type: 'submit' }, 'Comment'))) : null),
          h('div.panel', {}, h('h2', {}, 'History'), h('ul.timeline', {}, bug.history.map(x => h('li', {},
            h('span.muted', {}, fmtDate(x.at) + ' · '), h('b', {}, `${x.actor} (${x.role})`), ' ',
            x.field === 'created' ? 'created the issue' : [`changed ${x.field}: `, h('s.muted', {}, x.old_value ?? '—'), ' → ', h('b', {}, x.new_value ?? '—')],
            x.reason ? h('div.small.muted', {}, 'Reason: ' + x.reason) : null))))),
        h('div.sticky', {},
          h('div.panel', {}, h('h2', {}, 'Workflow'),
            !actor ? h('p.muted', {}, 'Choose a user to act on this bug.')
              : trans.length ? h('div.row', {}, trans.map(t => h('button' + (t.to === 'Closed' || t.to === 'Resolved' ? '.primary' : ''), { type: 'button', onclick: () => transitionDialog(t) }, t.name)))
                : h('p.muted.small', {}, `No transitions from "${bug.status}" for the ${role} role.`),
            h('p.small.muted', {}, 'Developers start and resolve; Testers verify, close or reopen; the Lead can do everything.'),
            h('hr'),
            field('Priority', prio, { id: 'bp-prio', hint: role === 'Lead' ? 'You set the urgency of the fix.' : 'Set by the project manager (Lead).' }),
            h('form', { onsubmit: e => { e.preventDefault(); act(() => api('PATCH', `/bugs/${bug.key}`, { field: 'assignee', value: assignee.value }), 'Assignee updated'); } },
              field('Assignee', assignee, { id: 'bp-assignee', hint: role === 'Lead' ? 'Press Enter to save.' : 'Only the Lead assigns.' })),
            role === 'Developer' && bug.assignee !== actor.name ? h('button', { type: 'button', onclick: () => act(() => api('PATCH', `/bugs/${bug.key}`, { field: 'assignee', value: actor.name }), 'Assigned to you') }, 'Assign to me') : null,
            (isReporter || role === 'Lead') ? h('button', { type: 'button', onclick: severityDialog }, 'Change severity…') : null),
          h('div.panel', {}, h('h2', {}, 'Report quality'),
            h('div.score', {}, h('div.ring', { style: { '--p': bug.quality_score, '--c': bug.quality_score >= 90 ? 'var(--ok)' : bug.quality_score >= 60 ? 'var(--warn)' : 'var(--err)' } }, h('span', {}, bug.quality_score)),
              h('div', {}, h('b', {}, `Grade ${bug.quality_grade}`), h('div.small.muted', {}, `${bug.lint.warnings} warnings · ${bug.lint.tips} tips`))),
            bug.lint.issues.length ? h('ul.issues', {}, bug.lint.issues.map(i => h('li.issue.' + i.level, {}, h('span.ic', {}, i.level === 'warning' ? '!' : i.level === 'error' ? '✕' : 'i'), h('span', {}, h('span.rid', {}, i.id + ' '), i.message)))) : h('p.lint-ok', {}, '✓ No remarks')),
          bug.run_id ? h('div.panel', {}, h('h2', {}, 'Test run'), h('a', { href: `#/runs/${bug.run_id}` }, `Run #${bug.run_id}`), ` · check ${bug.check_id}`) : null)));
  }
  draw();
}
