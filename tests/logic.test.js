import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintReport } from '../public/shared/linter.js';
import { evaluateSeverity, validateSeverityChange } from '../public/shared/severity.js';
import { checkTransition, checkFieldEdit, availableTransitions } from '../public/shared/workflow.js';
import { boundaryValues } from '../public/shared/catalog.js';
import { BAD_EXAMPLE, GOOD_EXAMPLE } from '../public/shared/examples.js';
import { matchPlanted, gradeSeverity } from '../server/domain/matcher.js';
import { PLANTED_BY_ID } from '../server/domain/planted.js';

const ids = r => new Set(r.issues.map(i => i.id));
const ENV = 'OS: Windows 11 Browser: Chrome 131';

test('linter: bad example breaks every section of the standard', () => {
  const r = lintReport(BAD_EXAMPLE);
  const got = ids(r);
  for (const id of ['S1', 'S4', 'S5', 'S6', 'F3', 'P1', 'T1', 'T2', 'T3', 'A2', 'E1', 'N1']) assert.ok(got.has(id), `expected ${id}`);
  assert.equal(r.canSubmit, false);
  assert.ok(r.score < 20);
});

test('linter: good example is submittable with a high score', () => {
  const r = lintReport({ ...GOOD_EXAMPLE, environment: ENV });
  assert.equal(r.errors, 0, JSON.stringify(r.issues));
  assert.ok(r.score >= 90);
});

test('linter: console error needs a "clear the console" step and a stack trace', () => {
  const base = { ...GOOD_EXAMPLE, environment: ENV, steps: ['Open the LiteShop sandbox (/sandbox/)', 'Enter "1\'" in the "Search" field'] };
  assert.ok(ids(lintReport(base)).has('T7'));
  const noStack = lintReport({ ...base, actual: 'An error appears in the console when searching. Reproduced 3/3 times.' });
  assert.ok(ids(noStack).has('A5'));
});

test('linter: expected numbers must be traceable, BR must exist', () => {
  const r = { ...GOOD_EXAMPLE, environment: ENV, component: 'Cart', summary: 'Cart: total is wrong when quantity is 10',
    expected: 'The total is shown within 2 seconds (BR99).' };
  const got = ids(lintReport(r));
  assert.ok(got.has('E2'), 'nonexistent BR');
  assert.ok(got.has('E4'), 'number 2 not backed');
  const ok = ids(lintReport({ ...r, expected: 'A 10% discount is applied when quantity is 10 or more (BR9).' }));
  assert.ok(!ok.has('E4') && !ok.has('E2'));
});

test('linter: precondition must be a state; none for the entry point itself', () => {
  assert.ok(ids(lintReport({ ...GOOD_EXAMPLE, precondition: 'Log in as admin' })).has('P1'));
  assert.ok(ids(lintReport({ ...GOOD_EXAMPLE, component: 'Sign up', summary: 'Sign up: x y z', precondition: 'User is logged in' })).has('P2'));
  assert.ok(!ids(lintReport({ ...GOOD_EXAMPLE, precondition: 'User is logged in' })).has('P1'));
});

test('linter: summary rules', () => {
  const s = summary => ids(lintReport({ ...GOOD_EXAMPLE, environment: ENV, summary }));
  assert.ok(s('Cart, Checkout: total is wrong').has('S2'));
  assert.ok(s('Search: results are NOT shown').has('S4'));
  assert.ok(!s('Search: HTML tags in the API response are shown').has('S4'), 'acronyms allowed');
  assert.ok(s('Search: results are empty because the index is broken').has('S9'));
});

test('severity: base level, raise and lower by one level', () => {
  assert.equal(evaluateSeverity({ criteria: ['N1'] }).severity, 'Minor');
  assert.equal(evaluateSeverity({ criteria: ['N1'], raise: ['R1'] }).severity, 'Average');
  assert.equal(evaluateSeverity({ criteria: ['M6'], lower: ['L1'] }).severity, 'Average');
  assert.equal(evaluateSeverity({ criteria: ['M6'], raise: ['R2'], lower: ['L2'] }).severity, 'Major', 'cancel out');
  assert.equal(evaluateSeverity({ criteria: ['N1', 'M6'] }).severity, 'Major', 'most severe wins');
});

test('severity: guards from the standard', () => {
  const a = evaluateSeverity({ criteria: ['A3'], raise: ['R1'] });
  assert.equal(a.severity, 'Average'); assert.ok(a.warnings.some(w => w.includes('GUI')));
  assert.ok(evaluateSeverity({ criteria: ['N1'], forbidden: ['X1'] }).errors.length);
  assert.equal(evaluateSeverity({ criteria: ['N8'], lower: ['L1'] }).severity, 'Minor', 'never lowered to Enhancement');
  assert.equal(evaluateSeverity({ criteria: ['C1'], raise: ['R2'] }).severity, 'Critical');
  assert.equal(evaluateSeverity({ criteria: ['E1'], raise: ['R3'] }).severity, 'Enhancement');
});

test('severity: project context', () => {
  assert.equal(evaluateSeverity({ criteria: ['M6'], context: 'crash-only' }).severity, 'Minor');
  assert.equal(evaluateSeverity({ criteria: ['C1'], context: 'crash-only' }).severity, 'Critical');
  assert.equal(evaluateSeverity({ criteria: ['N1'], context: 'release' }).severity, 'Average');
  assert.equal(evaluateSeverity({ criteria: ['A5'], context: 'early' }).severity, 'Minor');
  assert.equal(evaluateSeverity({ criteria: ['A5'], context: 'appearance' }).severity, 'Major');
});

test('severity change validation', () => {
  assert.equal(validateSeverityChange({ from: 'Minor', to: 'Average', reasonId: 'R1' }).ok, true);
  assert.equal(validateSeverityChange({ from: 'Minor', to: 'Average', reasonId: 'L1' }).ok, false);
  assert.equal(validateSeverityChange({ from: 'Minor', to: 'Major', reasonId: 'R1' }).ok, false);
  assert.equal(validateSeverityChange({ from: 'Minor', to: 'Average', reasonId: 'X1' }).ok, false);
  assert.equal(validateSeverityChange({ from: 'Minor', to: 'Enhancement', reasonId: 'L1' }).ok, false);
});

test('workflow: roles and required data', () => {
  const bug = { key: 'TC-1', status: 'Open', reporter: 'Ann', severity: 'Minor', resolution: 'Unresolved' };
  const T = { name: 'Ann', role: 'Tester' }; const D = { name: 'Dan', role: 'Developer' }; const L = { name: 'Lea', role: 'Lead' };
  assert.equal(checkTransition(bug, 'In Progress', T).ok, false);
  assert.equal(checkTransition(bug, 'In Progress', D).ok, true);
  assert.equal(checkTransition(bug, 'Closed', L).ok, false, 'no such transition');
  assert.equal(checkTransition(bug, 'Resolved', D, {}).ok, false, 'resolution required');
  assert.equal(checkTransition(bug, 'Resolved', D, { resolution: "Won't Fix" }).ok, false);
  assert.equal(checkTransition(bug, 'Resolved', L, { resolution: "Won't Fix" }).ok, true);
  assert.equal(checkTransition(bug, 'Resolved', D, { resolution: 'Duplicate', duplicateOf: 'TC-1' }).ok, false);
  assert.equal(checkTransition(bug, 'Resolved', D, { resolution: 'Duplicate', duplicateOf: 'TC-2' }, { findBug: k => (k === 'TC-2' ? { key: 'TC-2', resolution: 'Duplicate', duplicate_of: 'TC-0' } : null) }).ok, false, 'chain');
  const resolved = { ...bug, status: 'Resolved', resolution: 'Fixed' };
  assert.equal(checkTransition(resolved, 'Closed', T, {}).ok, false, 'must confirm verification');
  assert.equal(checkTransition(resolved, 'Closed', T, { verified: true }).ok, true);
  assert.equal(checkTransition(resolved, 'Reopened', T, { comment: 'short' }).ok, false);
  const re = checkTransition(resolved, 'Reopened', T, { comment: 'Still reproduced in Firefox 133.' });
  assert.equal(re.changes.resolution, 'Unresolved');
  assert.deepEqual(availableTransitions(bug, 'Tester'), []);
});

test('workflow: field permissions', () => {
  const bug = { key: 'TC-1', status: 'Open', reporter: 'Ann', severity: 'Minor' };
  assert.equal(checkFieldEdit(bug, 'priority', 'Blocker', { name: 'Ann', role: 'Tester' }).ok, false);
  assert.equal(checkFieldEdit(bug, 'priority', 'Blocker', { name: 'Lea', role: 'Lead' }).ok, true);
  assert.equal(checkFieldEdit(bug, 'assignee', 'Zed', { name: 'Dan', role: 'Developer' }).ok, false);
  assert.equal(checkFieldEdit(bug, 'assignee', 'Dan', { name: 'Dan', role: 'Developer' }).ok, true);
  assert.equal(checkFieldEdit(bug, 'severity', 'Average', { name: 'Bob', role: 'Tester' }, { reasonId: 'R1' }).ok, false, 'not reporter');
  assert.equal(checkFieldEdit(bug, 'severity', 'Average', { name: 'Ann', role: 'Tester' }, { reasonId: 'R1' }).ok, true);
  assert.equal(checkFieldEdit(bug, 'severity', 'Critical', { name: 'Lea', role: 'Lead' }, { reasonId: 'AG' }).ok, true);
});

test('boundary values', () => {
  assert.deepEqual(boundaryValues(2, 30).map(b => b.length), [1, 2, 3, 29, 30, 31]);
  assert.deepEqual(boundaryValues(0, 1).map(b => `${b.label}:${b.length}`), ['Min:0', 'Min+1:1', 'Max+1:2']);
  assert.deepEqual(boundaryValues(5, 3), []);
});

test('matcher: links reports to the right planted defect', () => {
  const m = r => matchPlanted({ steps: [], actual: '', expected: '', ...r })?.planted.id;
  assert.equal(m({ ...GOOD_EXAMPLE }), 'PB08');
  assert.equal(m({ component: 'Catalog', summary: 'Catalog: unselecting one category clears all selected categories' }), 'PB04');
  assert.equal(m({ component: 'Catalog', summary: 'Catalog: "Select all" stays checked after unselecting one category, next click unselects all' }), 'PB07');
  assert.equal(m({ component: 'Sign up', summary: 'Sign up: Name of spaces only is accepted' }), 'PB13');
  assert.equal(m({ component: 'Reviews', summary: 'Reviews: leading spaces in the author name are not removed' }), 'PB21');
  assert.equal(m({ component: 'Sign up', summary: 'Sign up: Name accepts 35 characters without a validation message' }), 'PB12');
  assert.equal(m({ component: 'Checkout', summary: 'Checkout: double click on "Place order" creates two orders' }), 'PB11');
  assert.equal(m({ component: 'Profile', summary: 'Profile: City is empty after saving the profile' }), 'PB19');
  assert.equal(m({ component: 'Cart', summary: 'Cart: page title is too small' }), undefined);
  assert.equal(gradeSeverity(PLANTED_BY_ID.PB16, 'Average').verdict, 'accepted');
  assert.equal(gradeSeverity(PLANTED_BY_ID.PB08, 'Minor').verdict, 'off');
});
