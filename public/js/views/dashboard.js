// Dashboard: personal progress, planted-defect discovery, team statistics.
import { h, mount, barChart, sevBadge } from '../ui.js';
import { api } from '../api.js';
import { SEVERITY_LEVELS, COMPONENTS } from '../../shared/catalog.js';

export async function renderDashboard(view, { actor }) {
  const s = await api('GET', '/stats?reporter=' + encodeURIComponent(actor?.name || ''));
  const me = s.leaderboard.find(x => x.reporter === actor?.name);
  const found = s.discovery.filter(d => d.foundIn).length;
  const pct = Math.round((found / s.plantedTotal) * 100);

  const pbTile = d => {
    const hint = h('div.small.muted', { hidden: true }, d.hint);
    return h('div.pb' + (d.foundIn ? '.found' : ''), {},
      h('div.row', {}, h('span.pb-id', {}, d.id), h('span.spacer'), d.foundIn ? sevBadge(d.severity) : h('span.small.muted', {}, d.components.join(' / '))),
      d.foundIn ? [h('div', { style: { margin: '4px 0' } }, d.title),
        h('div.small', {}, 'Found in ', h('a.key', { href: `#/bugs/${d.foundIn}` }, d.foundIn), ' · severity ', d.verdict === 'exact' ? 'exact ✓' : d.verdict === 'accepted' ? 'acceptable ~' : 'off ✕')]
        : [h('div.small', { style: { margin: '4px 0' } }, `Check ${d.check || '—'} · ${d.br}`),
          h('button.ghost', { type: 'button', style: { padding: '2px 0' }, onclick: e => { hint.hidden = !hint.hidden; e.target.textContent = hint.hidden ? 'Show hint' : 'Hide hint'; } }, 'Show hint'), hint]);
  };

  mount(view,
    h('div.page-head', {}, h('div', {},
      h('div.eyebrow', {}, 'Module 1'),
      h('h1', {}, actor ? `Hi ${actor.name}, happy hunting` : 'QA Bug Hunter Lab'),
      h('p', {}, `LiteShop has ${s.plantedTotal} planted defects. Find them with the course checklists, set severity by the criteria, and write reports that pass the team standard.`)),
    h('a.btn.primary', { href: '/sandbox/', target: '_blank', rel: 'noopener' }, 'Open the sandbox ↗')),

    h('div.grid.g4', {},
      h('div.tile', {}, h('div.num', {}, found, h('small', {}, ` / ${s.plantedTotal}`)), h('div.cap', {}, 'Planted defects you found'), h('div.meter', {}, h('i', { style: { width: pct + '%' } }))),
      h('div.tile', {}, h('div.num', {}, me ? me.avgScore : '—'), h('div.cap', {}, 'Your average report quality')),
      h('div.tile', {}, h('div.num', {}, me?.severityAccuracy != null ? me.severityAccuracy : '—', me?.severityAccuracy != null ? h('small', {}, '%') : null), h('div.cap', {}, 'Your severity accuracy')),
      h('div.tile', {}, h('div.num', {}, s.totals.bugs), h('div.cap', {}, `Reports in the tracker from ${s.totals.testers} tester${s.totals.testers === 1 ? '' : 's'}`))),

    h('div.panel', { style: { marginTop: '16px' } },
      h('h2', {}, 'How to use the lab'),
      h('ol.steps-list', {},
        h('li', {}, h('b', {}, 'Create a test run'), ' for a component (e.g. Sign up + Text Field checklist) in ', h('a', { href: '#/runs' }, 'Test runs'), '.'),
        h('li', {}, h('b', {}, 'Test the sandbox'), ' in a new tab: use the checklists and the ', h('a', { href: '#/kb/data' }, 'test data templates'), '. Keep DevTools open.'),
        h('li', {}, h('b', {}, 'Mark the result'), ' of every check. For a failed one click "Log bug".'),
        h('li', {}, h('b', {}, 'Set severity'), ' with the ', h('a', { href: '#/severity' }, 'severity wizard'), ' (Table 2 + the change rules).'),
        h('li', {}, h('b', {}, 'Write the report'), ' until the quality check is green, then submit. A matched planted defect shows up below.'),
        h('li', {}, h('b', {}, 'Improve it'), ': open your report in the ', h('a', { href: '#/bugs' }, 'tracker'), ', fix the remaining remarks with "Edit report" and watch the quality score grow.'))),

    h('div.panel', {},
      h('div.row', {}, h('h2', { style: { margin: 0 } }, 'Planted defects'), h('span.spacer'), h('span.muted.small', {}, actor ? 'Your progress' : 'Enter your name to track progress')),
      h('p.small.muted', {}, 'Each tile names the components where the defect lives, the checklist item that catches it, and the requirement it breaks.'),
      h('div.discovery', {}, s.discovery.map(pbTile))),

    h('div.grid.g3', { style: { marginTop: '16px' } },
      h('div.panel', {}, barChart('Reports by severity', s.bySeverity, { order: SEVERITY_LEVELS })),
      h('div.panel', {}, barChart('Reports by quality grade', s.byGrade, { order: ['A', 'B', 'C', 'D', 'F'] })),
      h('div.panel', {}, barChart('Reports by component', s.byComponent, { order: COMPONENTS }))),

    h('div.panel', { style: { marginTop: '16px' } },
      h('h2', {}, 'Leaderboard'),
      s.leaderboard.length ? h('table', {},
        h('thead', {}, h('tr', {}, ['#', 'Tester', 'Points', 'Planted found', 'Reports', 'Avg quality', 'Severity accuracy'].map(x => h('th', {}, x)))),
        h('tbody', {}, s.leaderboard.map((p, i) => h('tr', {},
          h('td', {}, i + 1), h('td', {}, h('a', { href: '#/bugs?reporter=' + encodeURIComponent(p.reporter) }, p.reporter)),
          h('td.mono', {}, p.points), h('td.mono', {}, p.found), h('td.mono', {}, p.bugs), h('td.mono', {}, p.avgScore),
          h('td.mono', {}, p.severityAccuracy == null ? '—' : p.severityAccuracy + '%'))))) : h('p.muted', {}, 'No reports yet.'),
      h('p.small.muted', {}, 'Points = 10 per planted defect found + 3 per acceptable severity + average quality ÷ 10.')));
}
