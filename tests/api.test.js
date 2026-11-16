// End-to-end API test on the in-memory database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { GOOD_EXAMPLE } from '../public/shared/examples.js';

delete process.env.DATABASE_URL;
const { default: app } = await import('../server/app.js');
let server; let base;
before(async () => { server = app.listen(0); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => server.close());

const call = async (method, path, body, who = ['Tess'], extra = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-User-Name': encodeURIComponent(who[0]), ...extra }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};
const SHOP = { 'X-Shop-Session': 'test-session-1234' };

const report = {
  summary: 'Profile: City is empty after saving the profile',
  component: 'Profile', affectsVersion: 'LiteShop 1.0', environment: 'OS: Linux Browser: Chrome 131', severity: 'Major', errorType: 'Functional',
  precondition: 'User is signed up',
  steps: ['Open the LiteShop sandbox (/sandbox/#/profile)', 'Enter "Almaty" in the "City" field', 'Click "Save"', 'Reload the page and compare the City field with step 2'],
  actual: 'The message "Profile saved." is shown, but after reload the City field is empty. The checkout page shows "—" as the delivery city. Reproduced 3/3 times in Chrome 131.',
  expected: 'The city is saved and is used as the delivery city at checkout (BR18).',
};

test('health and seed', async () => {
  const h = await call('GET', '/health');
  assert.equal(h.body.db, 'memory');
  const bugs = await call('GET', '/bugs');
  assert.equal(bugs.body.length, 3);
});

test('report submission rules', async () => {
  assert.equal((await call('POST', '/bugs', report, [''])).status, 401);
  const bad = await call('POST', '/bugs', { ...report, summary: 'BROKEN' });
  assert.equal(bad.status, 422); assert.ok(bad.body.lint.errors > 0);

  const ok = await call('POST', '/bugs', { ...report, priority: 'Blocker' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.discovery.found, true);
  assert.equal(ok.body.discovery.planted.id, 'PB19');
  assert.equal(ok.body.discovery.severityVerdict, 'exact');
  const created = (await call('GET', `/bugs/${ok.body.key}`)).body;
  assert.equal(created.priority, 'Major', 'priority stays with the PM');
  assert.equal(created.status, 'Open');
  assert.equal(created.assignee, 'Unassigned');

  const dup = await call('POST', '/bugs', { ...report, summary: 'Profile: City is not saved when the profile is saved' });
  assert.equal(dup.body.discovery.duplicateOf, ok.body.key);
  const ex = await call('POST', '/bugs', { ...GOOD_EXAMPLE, environment: 'OS: Linux Browser: Chrome 131' });
  assert.equal(ex.body.discovery.example, true);
});

test('reporter edits a report: permissions, quality bar, history, late discovery', async () => {
  const vague = {
    ...report,
    summary: 'Profile: entered value is lost after saving',
    steps: ['Open the LiteShop sandbox (/sandbox/#/profile)', 'Enter "Almaty" in the third field', 'Click "Save"', 'Reload the page and compare with step 2'],
    actual: 'The message "Profile saved." is shown, but after reload the third field is empty. Reproduced 3/3 times in Chrome 131.',
    expected: 'The value entered in step 2 is kept after reload.',
  };
  const made = await call('POST', '/bugs', vague, ['Uma']);
  assert.equal(made.status, 201);
  assert.equal(made.body.discovery.found, false);
  assert.ok(made.body.lint.score < 100);
  const key = made.body.key;

  assert.equal((await call('PUT', `/bugs/${key}`, { expected: 'x' }, ['Bob'])).status, 403, 'only the reporter');
  assert.equal((await call('PUT', `/bugs/${key}`, { severity: 'Critical' }, ['Uma'])).status, 403, 'severity locked');
  assert.equal((await call('PUT', `/bugs/${key}`, { summary: vague.summary }, ['Uma'])).status, 409, 'nothing changed');
  assert.equal((await call('PUT', `/bugs/${key}`, { summary: 'BROKEN' }, ['Uma'])).status, 422, 'same quality bar');

  const upd = await call('PUT', `/bugs/${key}`, {
    actual: 'The message "Profile saved." is shown, but after reload the City field is empty. Reproduced 3/3 times in Chrome 131.',
    expected: 'The city is saved and is used as the delivery city at checkout (BR18).',
  }, ['Uma']);
  assert.equal(upd.status, 200);
  assert.deepEqual(upd.body.changed, ['actual', 'expected']);
  assert.ok(upd.body.lint.score > made.body.lint.score);
  assert.equal(upd.body.discovery.planted.id, 'PB19', 'improved report earns the match');
  const after = (await call('GET', `/bugs/${key}`)).body;
  assert.equal(after.quality_score, upd.body.lint.score);
  const fields = after.history.map(x => x.field);
  for (const f of ['created', 'actual', 'expected', 'quality_score', 'planted_id']) assert.ok(fields.includes(f), f);

  const c = await call('POST', `/bugs/${key}/comments`, { body: 'Reproduced on Safari 18 too.' }, ['Bob']);
  assert.equal(c.body.comments.length, 1, 'other testers can comment');
});

test('severity change by the reporter only, with a documented reason', async () => {
  const key = (await call('GET', '/bugs?reporter=Tess')).body.find(b => b.severity === 'Major').key;
  assert.equal((await call('POST', `/bugs/${key}/severity`, { value: 'Average', reasonId: 'L3' }, ['Bob'])).status, 403);
  assert.equal((await call('POST', `/bugs/${key}/severity`, { value: 'Critical', reasonId: 'X1' })).status, 403);
  assert.equal((await call('POST', `/bugs/${key}/severity`, { value: 'Minor', reasonId: 'L3' })).status, 403, 'two levels');
  const sev = await call('POST', `/bugs/${key}/severity`, { value: 'Average', reasonId: 'L3' });
  assert.equal(sev.body.severity, 'Average');
  assert.equal(sev.body.history.at(-1).reason.length > 10, true);
});

test('test run completion rules', async () => {
  const run = (await call('POST', '/runs', { name: 'Menu run', target: 'Menu', checklists: ['MN'] })).body;
  assert.equal((await call('POST', '/runs', { name: 'x', target: 'Menu', checklists: [] })).status, 400);
  assert.equal((await call('PUT', `/runs/${run.id}/results/MN-1.2`, { result: 'N/A' })).status, 400, 'N/A needs a note');
  assert.equal((await call('PUT', `/runs/${run.id}/results/MN-1.2`, { result: 'Blocked', note: 'menu is broken' })).status, 400);
  await call('PUT', `/runs/${run.id}/results/MN-1.2`, { result: 'N/A', note: 'There are no hotkeys.' });
  await call('PUT', `/runs/${run.id}/results/MN-1.1`, { result: 'Fail' });
  let done = await call('POST', `/runs/${run.id}/complete`);
  assert.equal(done.status, 409);
  assert.ok(done.body.problems.some(p => p.startsWith('MN-1.1')));
  for (const id of ['MN-2.1', 'MN-2.2', 'MN-2.3', 'MN-2.4']) await call('PUT', `/runs/${run.id}/results/${id}`, { result: 'Pass' });
  await call('PUT', `/runs/${run.id}/results/MN-1.1`, { result: 'Fail', bugKey: 'TC-2' });
  done = await call('POST', `/runs/${run.id}/complete`);
  assert.equal(done.status, 200);
  assert.equal(done.body.status, 'Completed');
  assert.equal(done.body.summary.passRate, 80);
  assert.equal((await call('PUT', `/runs/${run.id}/results/MN-2.1`, { result: 'Fail' })).status, 409, 'locked');
});

test('sandbox planted back-end defects', async () => {
  const s = (m, p, b) => call(m, '/shop' + p, b, ['xx'], SHOP);
  assert.equal((await s('GET', "/products?q=1'")).status, 500);
  const inj = await s('GET', "/products?q=" + encodeURIComponent("' OR '1'='1'; --"));
  assert.ok(inj.body.products.some(p => p.name.includes('INTERNAL')));
  assert.equal((await s('GET', '/products?q=mug')).body.products.length, 1);

  const a1 = await s('POST', '/accounts', { name: 'Anna', email: 'Anna@test.com', phone: '+77001234567', terms: true });
  assert.equal(a1.status, 200);
  assert.equal((await s('POST', '/accounts', { name: 'Anna', email: 'Anna@test.com', phone: '+77001234567', terms: true })).status, 400);
  assert.equal((await s('POST', '/accounts', { name: 'Anna', email: 'anna@test.com', phone: '+77001234567', terms: true })).status, 200, 'PB14');
  assert.equal((await s('POST', '/accounts', { name: '    ', email: 'b@test.com', phone: '+77001234567', terms: true })).status, 200, 'PB13');
  assert.equal((await s('POST', '/accounts', { name: 'a'.repeat(35), email: 'c@test.com', phone: '+77001234567', terms: true })).status, 200, 'PB12');
  const upd = await s('PUT', `/accounts/${a1.body.id}`, { name: 'Anna', phone: '+77001234567', city: 'Almaty' });
  assert.equal(upd.body.profile.city, undefined);
  assert.equal((await s('GET', `/accounts/${a1.body.id}`)).body.city, '', 'PB19');
  await Promise.all([s('POST', '/orders', { items: [{ id: 1, qty: 1 }], total: 12.5 }), s('POST', '/orders', { items: [{ id: 1, qty: 1 }], total: 12.5 })]);
  assert.equal((await s('GET', '/orders')).body.length, 2, 'PB11');
});

test('stats reflect discovery per reporter', async () => {
  const st = (await call('GET', '/stats?reporter=Tess')).body;
  assert.equal(st.plantedTotal, 22);
  assert.ok(st.discovery.find(d => d.id === 'PB19').foundIn);
  assert.equal(st.discovery.find(d => d.id === 'PB01').title, undefined, 'unfound titles hidden');
});
