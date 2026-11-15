// Renders a report in the team's Jira layout: Summary -> fields -> Description.
import { h, sevBadge, statusBadge } from './ui.js';

export function jiraView(b) {
  const f = (k, v) => h('div', {}, h('span.k', {}, k), h('span', {}, v ?? ''));
  return h('article.jira', {},
    h('div.jira-summary', {}, b.summary || h('span.muted', {}, 'Summary')),
    h('div.jira-fields', {},
      f('Status', statusBadge(b.status || 'Open')), f('Project', 'Training Center'),
      f('Component/s', b.component), f('Affects Version/s', b.affects_version ?? b.affectsVersion),
      f('Fix Version/s', b.fix_version || 'None'), f('Security Level', 'Leads and Reporter only'),
      f('Type', 'Bug'), f('Priority', b.priority || 'Major'),
      f('Reporter', b.reporter), f('Assignee', b.assignee || 'Unassigned'),
      f('Resolution', b.resolution || 'Unresolved'), f('Labels', b.labels || 'None'),
      f('Environment', b.environment), f('Severity/Importance', b.severity ? sevBadge(b.severity) : ''),
      f('Error Type', b.error_type ?? b.errorType)),
    h('section.desc', {},
      h('h3', { style: { marginTop: '18px' } }, 'Description'),
      b.precondition ? [h('h4', {}, 'Precondition'), h('p', {}, b.precondition)] : null,
      h('h4', {}, 'Steps to reproduce'),
      h('ol', {}, (b.steps || []).filter(Boolean).map(s => h('li', {}, s))),
      h('h4', {}, 'Actual result'), h('pre', {}, b.actual || ''),
      h('h4', {}, 'Expected result'), h('p', {}, b.expected || ''),
      b.note ? [h('h4', {}, 'Note'), h('p', {}, b.note)] : null));
}
