// Severity wizard: Table 2 criteria + project context + change rules.
import { h, mount, select, sevBadge } from '../ui.js';
import { evaluateSeverity } from '../../shared/severity.js';
import {
  SEVERITY_LEVELS, SEVERITY_CRITERIA, SEVERITY_DEFINITIONS, LOWER_REASONS, RAISE_REASONS,
  FORBIDDEN_REASONS, PROJECT_CONTEXTS,
} from '../../shared/catalog.js';

/** Builds the wizard; onApply(result, state) is optional (used by the report form). */
export function severityWizard({ onApply, initial } = {}) {
  const state = { criteria: [], raise: [], lower: [], forbidden: [], context: 'standard', ...(initial || {}) };
  const out = h('div');

  const toggle = (list, id, on) => {
    const set = new Set(state[list]); on ? set.add(id) : set.delete(id); state[list] = [...set]; update();
  };
  const crit = (list, item, levelLabel) => {
    const cb = h('input', { type: 'checkbox', checked: state[list].includes(item.id), onchange: e => { e.target.closest('.crit').classList.toggle('on', e.target.checked); toggle(list, item.id, e.target.checked); } });
    return h('label.crit' + (state[list].includes(item.id) ? '.on' : ''), {}, cb, h('span.cid', {}, item.id), h('span', {}, item.text, levelLabel ? h('span.muted.small', {}, ` (${levelLabel})`) : null));
  };

  const groups = SEVERITY_LEVELS.map(level => h('div.crit-group', {},
    h('h3', {}, sevBadge(level), h('span.muted.small', {}, SEVERITY_DEFINITIONS[level])),
    SEVERITY_CRITERIA.filter(c => c.level === level).map(c => crit('criteria', c))));

  const ctx = select(PROJECT_CONTEXTS.map(c => [c.id, c.name]), state.context, { onchange: e => { state.context = e.target.value; update(); } });
  const ctxHelp = h('p.muted.small');

  const result = h('div');
  function update() {
    ctxHelp.textContent = PROJECT_CONTEXTS.find(c => c.id === state.context).text;
    const r = evaluateSeverity(state);
    mount(result,
      h('div.eyebrow', {}, 'Result'),
      r.severity ? h('div.result-big', {}, sevBadge(r.severity)) : h('p.muted', {}, 'Tick the criteria that describe the defect.'),
      r.base && r.base !== r.severity ? h('p.small', {}, 'Base level from Table 2: ', sevBadge(r.base)) : null,
      r.trace.length ? h('ol.trace', {}, r.trace.map(t => h('li', {}, h('b', {}, t.step + ' → ' + t.level), h('div.muted', {}, t.why)))) : null,
      r.errors.map(e => h('div.callout.err', { role: 'alert' }, e)),
      r.warnings.map(w => h('div.callout.warn', {}, w)),
      h('p.small.muted', {}, 'Severity is set by the tester. Priority (urgency of the fix) is set later by the project manager, and does not have to match the severity.'),
      onApply ? h('button.primary', { type: 'button', disabled: !r.severity || r.errors.length > 0, onclick: () => onApply(r, state) }, 'Use this severity') : null);
  }

  mount(out, h('div.split', {},
    h('div', {},
      h('div.panel', {},
        h('h2', {}, '1. Which criteria describe the defect?'),
        h('p.muted.small', {}, 'Imagine yourself as the end user. Tick everything that is true. The most severe criterion sets the base level.'),
        groups),
      h('div.panel', {},
        h('h2', {}, '2. Project context'),
        h('p.muted.small', {}, 'The levels can be redefined by agreement with the customer or by project phase.'),
        ctx, ctxHelp),
      h('div.panel', {},
        h('h2', {}, '3. Rules for changing severity'),
        h('p.muted.small', {}, 'As a rule the tester does not change the level. These documented exceptions move it by one level at most.'),
        h('h3', {}, 'Raise when…'), RAISE_REASONS.map(r => crit('raise', r, r.guiOnly ? 'GUI defects only' : null)),
        h('h3', {}, 'Lower when…'), LOWER_REASONS.map(r => crit('lower', r)),
        h('h3', {}, 'Not a valid reason'), FORBIDDEN_REASONS.map(r => crit('forbidden', r)))),
    h('div.sticky', {}, h('div.panel', {}, result))));
  update();
  return out;
}

export async function renderSeverity(view) {
  mount(view,
    h('div.page-head', {}, h('div', {},
      h('div.eyebrow', {}, 'Module 3'),
      h('h1', {}, 'Severity wizard'),
      h('p', {}, 'Answer from the criteria in "Definition of severity" and get a level with an explanation of how it was reached.'))),
    severityWizard());
}
