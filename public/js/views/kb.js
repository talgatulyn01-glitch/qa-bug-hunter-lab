// Knowledge base: the course material, plus a boundary-value generator.
import { h, mount, sevBadge, copyText, field } from '../ui.js';
import {
  SEVERITY_LEVELS, SEVERITY_DEFINITIONS, SEVERITY_CRITERIA, RAISE_REASONS, LOWER_REASONS, FORBIDDEN_REASONS,
  PROJECT_CONTEXTS, CHECKLISTS, TEST_DATA, boundaryValues,
} from '../../shared/catalog.js';
import { REQUIREMENTS } from '../../shared/requirements.js';

const STANDARD = [
  ['Summary', [
    ['S1', 'Pattern "Module: what happens [when]".'], ['S2', 'Exactly one module in the prefix, matching the Component.'],
    ['S4', 'No capital letters for emphasis.'], ['S5', 'No task numbers.'], ['S6', 'No severity words.'],
    ['S9', 'Describe the observed symptom, not the assumed cause.'], ['S7', 'No "doesn\'t work / issue / problem".']]],
  ['Precondition', [
    ['P1', 'A state, not an action: "User is logged in", not "Log in".'], ['P3', 'Steps refer to it: "the second user from the preconditions".'],
    ['P2', 'If the entry point itself is checked, there is no precondition.'], ['P0', 'Only when a state is needed BEFORE the check.']]],
  ['Steps to reproduce', [
    ['T1', 'Numbered, start with opening the application.'], ['T2', 'Concrete test data inside the steps.'],
    ['T8', 'Add a comparison step if it proves the defect is local.'], ['T7', 'Add "Clear the console" if you refer to a console error.']]],
  ['Actual result', [
    ['A1', 'Only what was observed and measured, with numbers.'], ['A2', 'No claims about code you haven\'t seen: "the values are consistent with X".'],
    ['A4', 'State the reproduction boundaries.'], ['A5', 'A console error: its full text and stack trace.']]],
  ['Expected result', [
    ['E3', 'Required behavior with a reference to the requirement (BRn).'], ['E2', 'The referenced requirement must exist.'],
    ['E4', 'No numbers out of thin air: if no requirement sets a limit, describe the consequence.']]],
  ['Note', [['N1', 'Only when another defect blocks the check.']]],
  ['Fields', [['F3', 'Environment: "OS: … Browser: …".'], ['F6', 'Severity consistent with the criteria (wizard).'], ['—', 'Priority is set by the project manager, Severity by the tester.']]],
];

const TABS = [
  ['severity', 'Severity levels'], ['criteria', 'Criteria (Table 2)'], ['rules', 'Changing severity'], ['standard', 'Report standard'],
  ['checklists', 'Checklists'], ['data', 'Test data'], ['requirements', 'LiteShop requirements'],
];

export async function renderKb(view, { args }) {
  const tab = TABS.some(t => t[0] === args[0]) ? args[0] : 'severity';
  const body = {
    severity: () => h('table.kb-table', {}, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Level'), h('th', {}, 'Definition'))),
      h('tbody', {}, SEVERITY_LEVELS.map((l, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, sevBadge(l)), h('td', {}, SEVERITY_DEFINITIONS[l]))))),
    criteria: () => [h('p.muted', {}, 'When in doubt imagine yourself as the end user of the project. The most severe matching criterion sets the base level.'),
      h('table.kb-table', {}, h('tbody', {}, SEVERITY_CRITERIA.map(c => h('tr', {}, h('td.mono', {}, c.id), h('td', {}, sevBadge(c.level)), h('td', {}, c.text, c.gui ? h('span.pill', { style: { marginLeft: '6px' } }, 'GUI') : null)))))],
    rules: () => [
      h('div.callout.warn', {}, 'As a rule the tester does not change the severity level. Raising it to attract the project manager\'s attention is forbidden; use the test report or talk to the manager.'),
      h('h3', {}, 'You can lower severity when'), h('ul', {}, LOWER_REASONS.map(r => h('li', {}, h('b', {}, r.id + ' '), r.text))),
      h('h3', {}, 'You can raise severity when'), h('ul', {}, RAISE_REASONS.map(r => h('li', {}, h('b', {}, r.id + ' '), r.text))),
      h('h3', {}, 'Never a reason'), h('ul', {}, FORBIDDEN_REASONS.map(r => h('li', {}, h('b', {}, r.id + ' '), r.text))),
      h('h3', {}, 'Project context'), h('ul', {}, PROJECT_CONTEXTS.map(c => h('li', {}, h('b', {}, c.name + ': '), c.text))),
      h('p.small.muted', {}, 'Lab policy: one documented reason moves the level by one step; raise and lower reasons cancel out; a defect is never lowered to Enhancement.')],
    standard: () => [h('p.muted', {}, 'Each rule has an ID: the same ID appears in the quality check of the report builder.'),
      STANDARD.map(([sec, rules]) => h('div', {}, h('h3', {}, sec), h('table.kb-table', {}, h('tbody', {}, rules.map(([id, t]) => h('tr', {}, h('td.mono', {}, id), h('td', {}, t)))))))],
    checklists: () => CHECKLISTS.map(c => h('div', {}, h('h3', { style: { marginTop: '16px' } }, c.name),
      h('table.kb-table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'ID'), h('th', {}, 'Check'), h('th', {}, 'Expected result'))),
        h('tbody', {}, c.items.map(i => h('tr', {}, h('td.mono', {}, i.id), h('td', {}, i.title), h('td', {}, i.expected))))))),
    data: dataTab,
    requirements: () => [h('p.muted', {}, 'Cite these in "Expected result". The report checker verifies that a cited BR exists and that numbers you write are backed by it.'),
      h('table.kb-table', {}, h('tbody', {}, REQUIREMENTS.map(r => h('tr', {}, h('td.mono', {}, r.id), h('td', {}, r.component), h('td', {}, r.text)))))],
  }[tab]();

  mount(view,
    h('div.page-head', {}, h('div', {}, h('div.eyebrow', {}, 'Module 6'), h('h1', {}, 'Knowledge base'),
      h('p', {}, 'The training material the lab is built on: severity definitions and criteria, the report standard, element checklists and test data.'))),
    h('div.tabs', { role: 'tablist' }, TABS.map(([id, label]) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(id === tab), class: id === tab ? 'on' : '', onclick: () => { location.hash = `#/kb/${id}`; } }, label))),
    h('div.panel', {}, body));
}

function dataTab() {
  const min = h('input', { type: 'number', value: 2, min: 0, max: 1000 });
  const max = h('input', { type: 'number', value: 30, min: 0, max: 5000 });
  const ch = h('input', { value: 'a', maxlength: 1 });
  const out = h('div');
  const gen = () => {
    const rows = boundaryValues(min.value, max.value, ch.value);
    mount(out, rows.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Case', 'Length', 'Expected', ''].map(x => h('th', {}, x)))),
      h('tbody', {}, rows.map(r => h('tr', {}, h('td', {}, r.label), h('td.mono', {}, r.length),
        h('td', {}, h('span.badge.' + (r.kind === 'valid' ? 'sev-enh' : 'sev-critical'), {}, r.kind === 'valid' ? 'accepted & saved' : 'validation message')),
        h('td', {}, h('button', { type: 'button', onclick: () => copyText(r.value) }, 'Copy value'))))))
      : h('p.form-error', {}, 'Max must be greater than or equal to Min.'));
  };
  [min, max, ch].forEach(e => e.addEventListener('input', gen));
  gen();
  return [
    h('div.grid.g2', {},
      h('div', {}, h('h3', {}, 'Templates'), h('p.small.muted', {}, 'Use only in safe environments like this sandbox.'),
        TEST_DATA.map(g => h('div', {}, h('h4', { style: { margin: '12px 0 6px' } }, g.group),
          g.values.map(v => h('div.data-chip', {}, h('code', {}, v === '     ' ? '␣␣␣␣␣ (5 spaces)' : v), h('button', { type: 'button', onclick: () => copyText(v), 'aria-label': `Copy ${v}` }, 'Copy')))))),
      h('div', {}, h('h3', {}, 'Boundary values generator'), h('p.small.muted', {}, 'Text Field check 1.2: Min-1, Min, Min+1, Max-1, Max, Max+1.'),
        h('div.grid.g3', {}, field('Min length', min, { id: 'bv-min' }), field('Max length', max, { id: 'bv-max' }), field('Character', ch, { id: 'bv-ch' })),
        out)),
  ];
}
