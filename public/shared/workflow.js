// Tester-side rules for a submitted report. Pure functions, enforced again on
// the server. The bug keeps the Jira template values: Status Open, Resolution
// Unresolved, Priority Major (set by the PM, outside this app), Assignee Unassigned.
import { SEVERITY_LEVELS } from './catalog.js';
import { validateSeverityChange } from './severity.js';

// Fields the reporter may change when editing a submitted report.
export const EDITABLE_FIELDS = ['summary', 'component', 'affectsVersion', 'environment', 'errorType', 'labels', 'precondition', 'steps', 'actual', 'expected', 'note'];

// Mapping between report (form) field names and database columns.
export const FIELD_COLUMNS = {
  summary: 'summary', component: 'component', affectsVersion: 'affects_version', environment: 'environment', errorType: 'error_type',
  labels: 'labels', precondition: 'precondition', steps: 'steps', actual: 'actual', expected: 'expected', note: 'note',
};

export function isReporter(bug, actor) {
  return !!actor?.name && actor.name === bug.reporter;
}

/** Only the tester who submitted the report can edit it, and not its severity. */
export function checkReportEdit(bug, actor, changes = {}) {
  if (!isReporter(bug, actor)) return { ok: false, error: `Only the reporter (${bug.reporter}) can edit this report.` };
  if (changes.severity !== undefined && changes.severity !== bug.severity) {
    return { ok: false, error: 'Severity cannot be changed while editing. Use "Change severity" with a documented reason.' };
  }
  return { ok: true };
}

/** Severity changes need a documented reason and move one level at most. */
export function checkSeverityChange(bug, value, actor, reasonId) {
  if (!isReporter(bug, actor)) return { ok: false, error: `Only the reporter (${bug.reporter}) can change the severity.` };
  if (!SEVERITY_LEVELS.includes(value)) return { ok: false, error: `Unknown severity "${value}".` };
  return validateSeverityChange({ from: bug.severity, to: value, reasonId });
}

/** Jira wiki-markup export of a report, in the team's structure. */
export function toJiraMarkup(b) {
  const lines = [];
  lines.push(`h2. ${b.summary}`, '');
  const rows = [
    ['Status', b.status || 'Open'], ['Project', 'Training Center'], ['Component/s', b.component],
    ['Affects Version/s', b.affects_version || b.affectsVersion], ['Fix Version/s', b.fix_version || 'None'],
    ['Security Level', 'Leads and Reporter only'], ['Type', 'Bug'], ['Priority', b.priority || 'Major'],
    ['Reporter', b.reporter], ['Assignee', b.assignee || 'Unassigned'], ['Resolution', b.resolution || 'Unresolved'],
    ['Labels', b.labels || 'None'], ['Environment', b.environment], ['Severity/Importance', b.severity], ['Error Type', b.error_type || b.errorType],
  ];
  rows.forEach(([k, v]) => lines.push(`||${k}|${v || ''}|`));
  lines.push('', 'h3. Description');
  if (b.precondition) lines.push('*Precondition*', b.precondition, '');
  lines.push('*Steps to reproduce*');
  (b.steps || []).forEach(s => lines.push(`# ${s}`));
  lines.push('', '*Actual result*', b.actual || '', '', '*Expected result*', b.expected || '');
  if (b.note) lines.push('', '*Note*', b.note);
  return lines.join('\n');
}
