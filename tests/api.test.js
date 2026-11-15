// End-to-end API test on the in-memory database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { GOOD_EXAMPLE } from '../public/shared/examples.js';

delete process.env.DATABASE_URL;
const { default: app } = await import('../server/app.js');
let server; let base;
before(async () => { server = app.listen(0); await new Promise(r => server.once('listening', r)); base = `http://127.0.0.1:${server.address().port}/api`; });
after(() => server.close());

const call = async (method, path, body, who = ['Tess', 'Tester'], extra = {}) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-User-Name': encodeURIComponent(who[0]), 'X-User-Role': who[1], ...extra }, body: body ? JSON.stringify(body) : undefined });
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

test('report lifecycle with business rules', async () => {
  assert.equal((await call('POST', '/bugs', report, ['', 'Tester'])).status, 401);
  assert.equal((await call('POST', '/bugs', report, ['Dev', 'Developer'])).status, 403);
  const bad = await call('POST', '/bugs', { ...report, summary: 'BROKEN' });
  assert.equal(bad.status, 422); assert.ok(bad.body.lint.errors > 0);

  const ok = await call('POST', '/bugs', { ...report, priority: 'Blocker' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.discovery.found, true);
  assert.equal(ok.body.discovery.planted.id, 'PB19');
  assert.equal(ok.body.discovery.severityVerdict, 'exact');
  const key = ok.body.key;
  assert.equal((await call('GET', `/bugs/${key}`)).body.priority, 'Major', 'tester cannot set priority');

  const dup = await call('POST', '/bugs', { ...report, summary: 'Profile: City is not saved when the profile is saved' });
  assert.equal(dup.body.discovery.duplicateOf, key);

  const ex = await call('POST', '/bugs', { ...GOOD_EXAMPLE, environment: 'OS: Linux Browser: Chrome 131' });
  assert.equal(ex.body.discovery.example, true);

  assert.equal((await call('POST', `/bugs/${key}/transition`, { to: 'In Progress' })).status, 409);
  const started = await call('POST', `/bugs/${key}/transition`, { to: 'In Progress' }, ['Dan', 'Developer']);
  assert.equal(started.status, 200);
  assert.equal(started.body.assignee, 'Dan', 'developer is auto-assigned');
  assert.equal((await call('POST', `/bugs/${key}/transition`, { to: 'Resolved', resolution: "Won't Fix" }, ['Dan', 'Developer'])).status, 409);
  assert.equal((await call('POST', `/bugs/${key}/transition`, { to: 'Resolved', resolution: 'Fixed' }, ['Dan', 'Developer'])).status, 200);
  assert.equal((await call('POST', `/bugs/${key}/transition`, { to: 'Closed' })).status, 409, 'verification required');
  const closed = await call('POST', `/bugs/${key}/transition`, { to: 'Closed', verified: true });
  assert.equal(closed.body.status, 'Closed');
  const reo = await call('POST', `/bugs/${key}/transition`, { to: 'Reopened', comment: 'Reproduced again in Firefox 133.' });
  assert.equal(reo.body.resolution, 'Unresolved');
  assert.ok(reo.body.history.length >= 5);
  assert.equal(reo.body.comments.length, 1);

  assert.equal((await call('PATCH', `/bugs/${key}`, { field: 'priority', value: 'Blocker' })).status, 403);
  assert.equal((await call('PATCH', `/bugs/${key}`, { field: 'priority', value: 'Blocker' }, ['Lea', 'Lead'])).body.priority, 'Blocker');
  assert.equal((await call('PATCH', `/bugs/${key}`, { field: 'severity', value: 'Critical', reasonId: 'X1' })).status, 403);
  const sev = await call('PATCH', `/bugs/${key}`, { field: 'severity', value: 'Average', reasonId: 'L3' });
  assert.equal(sev.body.severity, 'Average');
  assert.equal(sev.body.severity_verdict, 'accepted');
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
  const s = (m, p, b) => call(m, '/shop' + p, b, ['x', 'Tester'], SHOP);
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
