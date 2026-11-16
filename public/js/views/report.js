// Bug report builder with live linting against the team's report standard.
import { h, mount, field, select, modal, toast, copyText, sevBadge } from '../ui.js';
import { api } from '../api.js';
import { lintReport } from '../../shared/linter.js';
import { toJiraMarkup } from '../../shared/workflow.js';
import { COMPONENTS, VERSIONS, ERROR_TYPES, SEVERITY_LEVELS, DEFAULT_PRIORITY, CHECK_BY_ID } from '../../shared/catalog.js';
import { REQUIREMENTS } from '../../shared/requirements.js';
import { BAD_EXAMPLE, GOOD_EXAMPLE } from '../../shared/examples.js';
import { jiraView } from '../jira-view.js';
import { severityWizard } from './severity.js';

const DRAFT = 'qalab.draft';

export function detectEnvironment(ua = navigator.userAgent) {
  let os = 'Unknown';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11'; else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Android (\d+)/.test(ua)) os = 'Android ' + ua.match(/Android (\d+)/)[1];
  else if (/iPhone|iPad/.test(ua)) os = 'iOS'; else if (/Mac OS X (\d+[._]\d+)/.test(ua)) os = 'macOS ' + ua.match(/Mac OS X (\d+[._]\d+)/)[1].replace('_', '.');
  else if (/Linux/.test(ua)) os = 'Linux';
  let browser = 'Unknown';
  const m = ua.match(/(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/);
  if (m) browser = ({ Edg: 'Edge', OPR: 'Opera', Version: 'Safari' }[m[1]] || m[1]) + ' ' + m[2];
  return `OS: ${os} Browser: ${browser}`;
}

const blank = () => ({
  summary: '', component: '', affectsVersion: VERSIONS[0], environment: detectEnvironment(), severity: '', errorType: 'Functional',
  labels: '', priority: DEFAULT_PRIORITY, precondition: '', steps: ['Open the LiteShop sandbox (/sandbox/#/home)', ''], actual: '', expected: '', note: '', suggestedSeverity: null,
});

const fromBug = b => ({
  summary: b.summary, component: b.component, affectsVersion: b.affects_version, environment: b.environment, severity: b.severity,
  errorType: b.error_type, labels: b.labels === 'None' ? '' : b.labels, priority: DEFAULT_PRIORITY, precondition: b.precondition,
  steps: [...b.steps], actual: b.actual, expected: b.expected, note: b.note, suggestedSeverity: b.suggested_severity,
});

export async function renderReport(view, { params, actor }) {
  const editKey = params.get('edit') ? params.get('edit').toUpperCase() : null;
  let editing = null;
  if (editKey) {
    editing = await api('GET', `/bugs/${editKey}`);
    if (!actor || actor.name !== editing.reporter) {
      mount(view, h('div.panel', {}, h('h1', {}, `${editKey} cannot be edited`),
        h('p', {}, `Only the reporter (${editing.reporter}) can edit this report.`), h('a.btn', { href: `#/bugs/${editKey}` }, `Back to ${editKey}`)));
      return;
    }
  }
  let draft = null;
  if (!editing) { try { draft = JSON.parse(localStorage.getItem(DRAFT)); } catch { draft = null; } }
  const r = editing ? fromBug(editing) : { ...blank(), ...(draft || {}) };
  const runId = params.get('run') ? Number(params.get('run')) : null;
  const checkId = params.get('check') || null;
  if (params.get('component')) r.component = params.get('component');
  if (checkId && CHECK_BY_ID[checkId] && !r.summary) r.summary = `${r.component || 'Module'}: `;

  const save = () => { if (editing) return; try { localStorage.setItem(DRAFT, JSON.stringify(r)); } catch { /* ignore */ } };
  const inputs = {};
  const bind = (key, el) => {
    inputs[key] = el;
    el.addEventListener('input', () => { r[key] = el.value; changed(); });
    el.addEventListener('change', () => { r[key] = el.value; changed(); });
    return el;
  };

  const summary = bind('summary', h('input', { value: r.summary, maxlength: 255, placeholder: 'Module: what happens [when]' }));
  const component = bind('component', select([['', 'Select…'], ...COMPONENTS], r.component));
  const version = bind('affectsVersion', select(VERSIONS, r.affectsVersion));
  const env = bind('environment', h('input', { value: r.environment }));
  const severity = bind('severity', select([['', 'Select…'], ...SEVERITY_LEVELS], r.severity));
  const errorType = bind('errorType', select(ERROR_TYPES, r.errorType));
  const labels = bind('labels', h('input', { value: r.labels, placeholder: 'None' }));
  const priority = h('input.locked', { value: `${DEFAULT_PRIORITY} (set by the project manager)`, disabled: true });
  if (editing) severity.disabled = true;
  const pre = bind('precondition', h('textarea', { rows: 2, value: r.precondition, placeholder: 'Only if a state is needed BEFORE the check, e.g. "User is logged in"' }));
  const actual = bind('actual', h('textarea', { rows: 5, value: r.actual, placeholder: 'Only what you observed and measured, with numbers. Reproduction boundaries. Console error + full stack trace.' }));
  const expected = bind('expected', h('textarea', { rows: 3, value: r.expected, placeholder: 'Required behavior with a reference to the requirement (BRn).' }));
  const note = bind('note', h('textarea', { rows: 2, value: r.note, placeholder: 'Only if another defect blocks the check, e.g. "Blocked by TC-4"' }));
  const sevSuggest = h('span.small.muted');

  const stepsBox = h('div');
  function renderSteps() {
    mount(stepsBox, r.steps.map((s, i) => {
      const inp = h('input', { value: s, placeholder: i === 0 ? 'Open …' : 'Action with concrete test data, e.g. Enter "Anna" in the "Name" field' });
      inp.addEventListener('input', () => { r.steps[i] = inp.value; changed(false); });
      inputs['step' + i] = inp;
      return h('div.step-row', {}, h('span.n', {}, i + 1 + '.'), inp,
        h('div.tools', {},
          h('button', { type: 'button', title: 'Move up', 'aria-label': `Move step ${i + 1} up`, disabled: i === 0, onclick: () => { [r.steps[i - 1], r.steps[i]] = [r.steps[i], r.steps[i - 1]]; renderSteps(); changed(); } }, '↑'),
          h('button', { type: 'button', title: 'Move down', 'aria-label': `Move step ${i + 1} down`, disabled: i === r.steps.length - 1, onclick: () => { [r.steps[i + 1], r.steps[i]] = [r.steps[i], r.steps[i + 1]]; renderSteps(); changed(); } }, '↓'),
          h('button', { type: 'button', title: 'Remove', 'aria-label': `Remove step ${i + 1}`, disabled: r.steps.length === 1, onclick: () => { r.steps.splice(i, 1); renderSteps(); changed(); } }, '✕')));
    }), h('button.ghost', { type: 'button', onclick: () => { r.steps.push(''); renderSteps(); changed(); inputs['step' + (r.steps.length - 1)].focus(); } }, '+ Add step'));
  }

  const lintBox = h('div');
  const previewBox = h('div');
  const submitBtn = h('button.primary', { type: 'button', onclick: submit }, editing ? 'Save changes' : 'Submit to tracker');
  const FIELD_EL = { summary: () => summary, component: () => component, affectsVersion: () => version, environment: () => env, severity: () => severity, errorType: () => errorType, precondition: () => pre, steps: () => inputs.step0, actual: () => actual, expected: () => expected, note: () => note };

  function renderLint() {
    const res = lintReport(r);
    const color = res.score >= 90 ? 'var(--ok)' : res.score >= 60 ? 'var(--warn)' : 'var(--err)';
    Object.values(FIELD_EL).forEach(fn => fn() && fn().classList.remove('has-error'));
    res.issues.filter(i => i.level === 'error').forEach(i => { const el = FIELD_EL[i.field]?.(); if (el) el.classList.add('has-error'); });
    mount(lintBox,
      h('div.score', {},
        h('div.ring', { style: { '--p': res.score, '--c': color } }, h('span', {}, res.score)),
        h('div', {}, h('div', { style: { fontWeight: 700 } }, `Grade ${res.grade}`),
          h('div.small.muted', {}, `${res.errors} errors · ${res.warnings} warnings · ${res.tips} tips`),
          res.canSubmit ? h('div.lint-ok.small', {}, editing ? '✓ Ready to save' : '✓ Ready to submit') : h('div.small', { style: { color: 'var(--err)' } }, editing ? 'Fix the errors to save' : 'Fix the errors to submit'))),
      res.issues.length ? h('ul.issues', {}, res.issues.map(i => h('li.issue.' + i.level, {
        tabindex: 0, role: 'button',
        onclick: () => FIELD_EL[i.field]?.()?.focus(), onkeydown: e => { if (e.key === 'Enter') FIELD_EL[i.field]?.()?.focus(); },
      }, h('span.ic', { 'aria-label': i.level }, i.level === 'error' ? '✕' : i.level === 'warning' ? '!' : 'i'),
      h('span', {}, h('span.rid', {}, `${i.id} · ${i.field} `), h('div', {}, i.message), i.hint ? h('div.h', {}, i.hint) : null)))) : null);
    submitBtn.disabled = !res.canSubmit;
    mount(previewBox, jiraView({ ...r, reporter: actor?.name || '—', priority: DEFAULT_PRIORITY }));
  }
  let timer;
  function changed(now = true) {
    save();
    sevSuggest.textContent = r.suggestedSeverity ? `Wizard result: ${r.suggestedSeverity}` : '';
    clearTimeout(timer); timer = setTimeout(renderLint, now ? 0 : 150);
  }

  function load(ex) {
    Object.assign(r, blank(), ex, { steps: [...ex.steps], environment: ex.environment ?? detectEnvironment(), suggestedSeverity: null });
    ['summary', 'precondition', 'actual', 'expected', 'note', 'labels', 'environment'].forEach(k => { inputs[k].value = r[k] || ''; });
    component.value = r.component; version.value = r.affectsVersion; severity.value = r.severity; errorType.value = r.errorType;
    renderSteps(); changed();
  }

  function openWizard() {
    const m = modal('Severity wizard', severityWizard({
      onApply: res => { r.severity = res.severity; r.suggestedSeverity = res.severity; severity.value = res.severity; m.close(); changed(); toast(`Severity set to ${res.severity}`, 'ok'); },
    }), { wide: true });
  }

  async function saveEdit() {
    submitBtn.disabled = true;
    try {
      const out = await api('PUT', `/bugs/${editing.key}`, { ...r, severity: editing.severity });
      const d = out.discovery || {};
      const md = modal(`${out.key} updated`, h('div', {},
        h('p', {}, `Changed: ${out.changed.length} field${out.changed.length === 1 ? '' : 's'}. Report quality: ${editing.quality_score} → ${out.lint.score} (grade ${out.lint.grade}).`),
        d.found && d.planted ? h('div.callout.ok', {}, h('b', {}, `🎯 The improved report now matches planted defect ${d.planted.id}`), h('div', {}, d.planted.title)) : null,
        d.duplicateOf ? h('div.callout.warn', {}, `This report now describes the same planted defect as your report ${d.duplicateOf}.`) : null,
        h('div.actions', {}, h('button.primary', { type: 'button', onclick: () => { md.close(); location.hash = `#/bugs/${out.key}`; } }, `Open ${out.key}`))),
      { onClose: () => { location.hash = `#/bugs/${out.key}`; } });
    } catch (err) {
      toast(err.message, 'error');
    }
    submitBtn.disabled = false;
  }

  async function submit() {
    if (!actor) { toast('Enter your name first (top right).', 'error'); return; }
    if (editing) { await saveEdit(); return; }
    submitBtn.disabled = true;
    try {
      const out = await api('POST', '/bugs', { ...r, runId, checkId });
      localStorage.removeItem(DRAFT);
      const d = out.discovery;
      const go = hash => { md.close(); location.hash = hash; };
      const mySev = r.severity;
      load(blank());
      const md = modal(`${out.key} created`, h('div', {},
        h('p', {}, `Report quality: ${out.lint.score}/100 (grade ${out.lint.grade}).`),
        d.found ? h('div.callout.ok', {},
          h('b', {}, `🎯 You found planted defect ${d.planted.id}`), h('div', {}, d.planted.title),
          h('div', { style: { marginTop: '6px' } }, 'Reference severity: ', sevBadge(d.planted.severity), ' · yours: ', sevBadge(mySev), ' · ',
            d.severityVerdict === 'exact' ? 'exact match' : d.severityVerdict === 'accepted' ? 'acceptable (within the documented change rules)' : 'too far from the reference: re-check Table 2'))
          : d.example ? h('div.callout.info', {}, 'This is the teaching example, so it does not count as a finding. Now find the real ones in the sandbox!')
            : d.duplicateOf ? h('div.callout.warn', {}, `You already found this defect in ${d.duplicateOf}. Next time, improve that report instead of filing a new one.`)
              : h('div.callout.info', {}, 'No planted defect matched this report. It may still be a valid finding, or the wording/component does not describe a planted defect clearly enough.'),
        h('div.actions', {},
          runId ? h('button', { type: 'button', onclick: () => go(`#/runs/${runId}`) }, 'Back to test run') : null,
          h('button', { type: 'button', onclick: () => md.close() }, 'Report another'),
          h('button.primary', { type: 'button', onclick: () => go(`#/bugs/${out.key}`) }, `Open ${out.key}`))));
      submitBtn.disabled = false;
    } catch (err) {
      toast(err.message, 'error');
      submitBtn.disabled = false;
    }
  }

  const tabs = h('div.tabs', {});
  const lintPanel = h('div', {}, lintBox);
  const previewPanel = h('div', { hidden: true }, previewBox, h('div.actions', {},
    h('button', { type: 'button', onclick: () => copyText(toJiraMarkup({ ...r, reporter: actor?.name, priority: DEFAULT_PRIORITY })) }, 'Copy as Jira markup')));
  const tabBtn = (label, show) => h('button', { type: 'button', class: show === lintPanel ? 'on' : '', onclick: e => {
    [lintPanel, previewPanel].forEach(p => { p.hidden = p !== show; });
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === e.currentTarget));
  } }, label);
  mount(tabs, tabBtn('Quality check', lintPanel), tabBtn('Jira preview', previewPanel));

  const reqHint = h('div.small.muted');
  const updReq = () => {
    const list = REQUIREMENTS.filter(q => q.component === r.component);
    mount(reqHint, list.length ? ['Requirements for this component: ', list.map((q, i) => [i ? ', ' : '', h('abbr', { title: q.text }, q.id)])] : '');
  };
  component.addEventListener('change', updReq);

  mount(view,
    h('div.page-head', {}, h('div', {},
      h('div.eyebrow', {}, 'Module 4'),
      h('h1', {}, editing ? `Edit ${editing.key}` : 'New bug report'),
      h('p', {}, 'Structure: Summary → fields → Description (Precondition, Steps to reproduce, Actual result, Expected result, Note). Every rule of the standard is checked live on the right.')),
    editing ? h('a.btn', { href: `#/bugs/${editing.key}` }, `← Back to ${editing.key}`) : h('div.row', {},
      h('button', { type: 'button', onclick: () => load(BAD_EXAMPLE) }, 'Load bad example'),
      h('button', { type: 'button', onclick: () => load(GOOD_EXAMPLE) }, 'Load good example'),
      h('button.ghost', { type: 'button', onclick: () => { if (confirmClear()) load(blank()); } }, 'Clear'))),
    editing ? h('div.callout.info', {}, `You are editing your submitted report (current quality ${editing.quality_score}/100). The same quality bar applies. Severity is locked here: change it on the report page with a documented reason.`) : null,
    checkId && CHECK_BY_ID[checkId] ? h('div.callout.info', {}, `Logging a failed check ${checkId} "${CHECK_BY_ID[checkId].title}" from test run #${runId}. Expected by the checklist: ${CHECK_BY_ID[checkId].expected}`) : null,
    h('div.split', {},
      h('form.panel', { onsubmit: e => e.preventDefault(), novalidate: true },
        field('Summary', summary, { required: true, id: 'r-summary', hint: 'Module: what happens [when]. One module, the observed symptom, no CAPS, no task numbers, no severity words.' }),
        h('div.grid.g3', {},
          field('Component/s', component, { required: true, id: 'r-component' }),
          field('Affects Version/s', version, { required: true, id: 'r-version' }),
          field('Error Type', errorType, { required: true, id: 'r-errtype' })),
        h('div.grid.g3', {},
          h('div', {}, field('Severity/Importance', severity, { required: true, id: 'r-severity' }),
            editing ? h('div.small.muted', { style: { marginTop: '-6px' } }, 'Locked while editing.')
              : h('div.row', { style: { marginTop: '-6px' } }, h('button.ghost', { type: 'button', onclick: openWizard }, 'Open severity wizard'), sevSuggest)),
          field('Priority', priority, { id: 'r-priority', hint: 'The tester sets Severity; the project manager sets Priority.' }),
          field('Labels', labels, { id: 'r-labels' })),
        field('Environment', env, { required: true, id: 'r-env', hint: 'Detected from your browser. Format: OS: … Browser: …' }),
        h('div.small.muted', {}, 'Fixed fields: Project = Training Center · Type = Bug · Status = Open · Security Level = Leads and Reporter only · Resolution = Unresolved · Fix Version/s = None'),
        h('div.section-title', {}, 'Description'),
        field('Precondition (optional)', pre, { id: 'r-pre' }),
        h('div.field', {}, h('span.label', {}, 'Steps to reproduce', h('span.req', {}, ' *')), h('span.hint', {}, 'Numbered, start with opening the application, concrete data inside the steps.'), stepsBox),
        field('Actual result', actual, { required: true, id: 'r-actual' }),
        field('Expected result', expected, { required: true, id: 'r-expected' }), reqHint,
        field('Note (optional)', note, { id: 'r-note' })),
      h('div.sticky', {}, h('div.panel', {}, tabs, lintPanel, previewPanel, h('div.actions', {}, submitBtn)))));

  function confirmClear() { return !r.summary || window.confirm('Clear the current draft?'); }
  renderSteps(); updReq(); changed();
}
