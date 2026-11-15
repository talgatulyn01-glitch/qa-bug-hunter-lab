// Jira-like defect workflow with role-based permissions.
// Roles: Tester (reports & verifies), Developer (fixes), Lead (PM: priority,
// assignment, any transition). Pure functions, enforced again on the server.
import { PRIORITIES } from './catalog.js';
import { validateSeverityChange } from './severity.js';

export const ROLES = ['Tester', 'Developer', 'Lead'];
export const STATUSES = ['Open', 'In Progress', 'Resolved', 'Reopened', 'Closed'];
export const RESOLUTIONS = ['Fixed', "Won't Fix", 'Duplicate', 'Cannot Reproduce', 'Not a Bug'];
export const AGREED_REASON = { id: 'AG', text: 'Changed by agreement with the customer / development team.' };

export const TRANSITIONS = [
  { from: 'Open', to: 'In Progress', name: 'Start progress', roles: ['Developer', 'Lead'] },
  { from: 'Open', to: 'Resolved', name: 'Resolve', roles: ['Developer', 'Lead'], needsResolution: true },
  { from: 'In Progress', to: 'Open', name: 'Stop progress', roles: ['Developer', 'Lead'] },
  { from: 'In Progress', to: 'Resolved', name: 'Resolve', roles: ['Developer', 'Lead'], needsResolution: true },
  { from: 'Resolved', to: 'Closed', name: 'Verify & close', roles: ['Tester', 'Lead'] },
  { from: 'Resolved', to: 'Reopened', name: 'Reopen', roles: ['Tester', 'Lead'], needsComment: true },
  { from: 'Closed', to: 'Reopened', name: 'Reopen', roles: ['Tester', 'Lead'], needsComment: true },
  { from: 'Reopened', to: 'In Progress', name: 'Start progress', roles: ['Developer', 'Lead'] },
  { from: 'Reopened', to: 'Resolved', name: 'Resolve', roles: ['Developer', 'Lead'], needsResolution: true },
];

export function availableTransitions(bug, role) {
  return TRANSITIONS.filter(t => t.from === bug.status && t.roles.includes(role));
}

/**
 * Validate a status change. `ctx.findBug(key)` lets the caller resolve
 * duplicate links (sync lookup over already-loaded bugs).
 */
export function checkTransition(bug, to, actor, payload = {}, ctx = {}) {
  const t = TRANSITIONS.find(x => x.from === bug.status && x.to === to);
  if (!t) return { ok: false, error: `Transition ${bug.status} → ${to} does not exist in the workflow.` };
  if (!t.roles.includes(actor.role)) return { ok: false, error: `${actor.role} cannot "${t.name}". Allowed: ${t.roles.join(', ')}.` };
  const comment = String(payload.comment || '').trim();
  const changes = { status: to };

  if (t.needsResolution) {
    const res = payload.resolution;
    if (!RESOLUTIONS.includes(res)) return { ok: false, error: `Choose a resolution: ${RESOLUTIONS.join(', ')}.` };
    if (res === "Won't Fix" && actor.role !== 'Lead') return { ok: false, error: '"Won\'t Fix" is a product decision: only a Lead can set it.' };
    if (res === 'Cannot Reproduce' && comment.length < 10) return { ok: false, error: '"Cannot Reproduce" needs a comment describing what was tried.' };
    if (res === 'Duplicate') {
      const key = String(payload.duplicateOf || '').trim().toUpperCase();
      if (!key) return { ok: false, error: 'A duplicate must link the original bug (e.g. TC-3).' };
      if (key === bug.key) return { ok: false, error: 'A bug cannot be a duplicate of itself.' };
      const orig = ctx.findBug ? ctx.findBug(key) : null;
      if (!orig) return { ok: false, error: `${key} does not exist.` };
      if (orig.resolution === 'Duplicate') return { ok: false, error: `${key} is itself a duplicate of ${orig.duplicate_of || 'another bug'}: link the original instead.` };
      changes.duplicate_of = key;
    }
    changes.resolution = res;
  }
  if (t.needsComment && comment.length < 10) return { ok: false, error: `"${t.name}" requires a comment (at least 10 characters) explaining why.` };
  if (to === 'Reopened') { changes.resolution = 'Unresolved'; changes.duplicate_of = null; }
  if (to === 'In Progress' && actor.role === 'Developer' && (!bug.assignee || bug.assignee === 'Unassigned')) changes.assignee = actor.name;
  if (to === 'Closed' && actor.role === 'Tester' && bug.resolution === 'Fixed' && !payload.verified) {
    return { ok: false, error: 'Confirm that you re-ran the steps and the fix works before closing.' };
  }
  return { ok: true, changes, comment };
}

/** Validate a field edit; returns the normalized changes. */
export function checkFieldEdit(bug, field, value, actor, payload = {}) {
  const isReporter = actor.name && actor.name === bug.reporter;
  switch (field) {
    case 'priority':
      if (actor.role !== 'Lead') return { ok: false, error: 'Priority is set by the project manager (Lead). The tester sets Severity.' };
      if (!PRIORITIES.includes(value)) return { ok: false, error: `Priority must be one of ${PRIORITIES.join(', ')}.` };
      return { ok: true, changes: { priority: value } };
    case 'assignee': {
      const v = String(value || '').trim() || 'Unassigned';
      if (actor.role === 'Lead') return { ok: true, changes: { assignee: v } };
      if (actor.role === 'Developer' && (v === actor.name || v === 'Unassigned')) return { ok: true, changes: { assignee: v } };
      return { ok: false, error: 'Only a Lead can assign other people; a Developer can assign a bug to themselves.' };
    }
    case 'severity': {
      if (!(isReporter || actor.role === 'Lead')) return { ok: false, error: 'Only the reporter or a Lead can change severity.' };
      if (payload.reasonId === AGREED_REASON.id) {
        if (actor.role !== 'Lead') return { ok: false, error: 'Only a Lead can change severity "by agreement".' };
        return { ok: true, changes: { severity: value }, reason: AGREED_REASON.text };
      }
      const v = validateSeverityChange({ from: bug.severity, to: value, reasonId: payload.reasonId });
      return v.ok ? { ok: true, changes: { severity: value }, reason: v.reason } : v;
    }
    case 'labels':
      return { ok: true, changes: { labels: String(value || '').trim() || 'None' } };
    default:
      return { ok: false, error: `Field "${field}" cannot be edited here.` };
  }
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
