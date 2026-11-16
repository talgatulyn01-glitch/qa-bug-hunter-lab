// Demo data so the mentor sees a populated tracker on first visit.
// Runs once per SEED_VERSION (guarded by the meta table, safe under concurrency).
// A new SEED_VERSION wipes all app data once and reseeds; bump it only on purpose.
import { createBug, updateBug, createRun, setResult, addComment } from './services.js';

const SEED_VERSION = 'seed_v2_tester_only';
const aida = { name: 'Aida (demo tester)', role: 'Tester' };
const bekzat = { name: 'Bekzat (demo tester)', role: 'Tester' };
const ENV = 'OS: Windows 11 Browser: Chrome 131';

export async function seed(db) {
  const claim = await db.query('INSERT INTO meta (k, v) VALUES ($1, now()::text) ON CONFLICT (k) DO NOTHING RETURNING k', [SEED_VERSION]);
  if (!claim.rows.length) return;
  await db.query('TRUNCATE bugs, bug_history, comments, test_runs, run_results, shop_accounts, shop_orders, shop_reviews RESTART IDENTITY CASCADE');

  await db.query(`INSERT INTO shop_reviews (session, author, rating, body) VALUES
    ('seed', 'Olzhas', 5, 'Fast delivery, the mug is exactly as in the picture.'),
    ('seed', 'Kate', 4, 'Good speaker for the price. The box was a bit damaged.')`);

  const a = await createBug(db, {
    summary: 'Cart: total is 19% lower than the price when quantity is 10',
    component: 'Cart', affectsVersion: 'LiteShop 1.0', environment: ENV, severity: 'Major', errorType: 'Functional', suggestedSeverity: 'Major',
    steps: [
      'Open the LiteShop sandbox (/sandbox/#/catalog)',
      'Click "Add to cart" for "Ceramic Mug" (price 8.90)',
      'Open the Cart page',
      'Enter "10" in the "Quantity" field',
      'Repeat step 4 with "9" and compare the totals',
    ],
    actual: 'With quantity "10" the total is 72.09 (8.90 × 10 = 89.00 minus 19%). With quantity "9" the total is 80.10 (no discount). The values are consistent with the 10% discount being applied twice. Reproduced 3/3 times for quantities 10, 11 and 25 in Chrome 131 and Firefox 133.',
    expected: 'With quantity 10 the total is 80.10: a single 10% bulk discount is applied (BR9).',
  }, aida);
  await addComment(db, a.key, 'Confirmed in Edge 131 as well, same totals.', bekzat);

  await createBug(db, {
    summary: 'Menu: item is named "Basket" on the Cart page',
    component: 'Menu', affectsVersion: 'LiteShop 1.0', environment: ENV, severity: 'Minor', errorType: 'GUI', suggestedSeverity: 'Minor',
    steps: ['Open the LiteShop sandbox (/sandbox/#/home)', 'Look at the menu item names', 'Click "Cart" in the menu', 'Compare the menu item names with step 2'],
    actual: 'On the Cart page the third menu item is named "Basket"; on Home, Catalog, Orders, Profile, Reviews and Sign up it is named "Cart". Reproduced every time in Chrome 131.',
    expected: 'The menu item is named "Cart" on all pages (BR2).',
  }, aida);

  // Submitted with a warning (no requirement cited), then improved by its reporter.
  const c = await createBug(db, {
    summary: 'Sign up: button name is "Create acount"',
    component: 'Sign up', affectsVersion: 'LiteShop 1.0', environment: ENV, severity: 'Average', errorType: 'GUI', suggestedSeverity: 'Average',
    steps: ['Open the LiteShop sandbox (/sandbox/#/signup)', 'Check the "Terms" checkbox', 'Read the name of the submit button'],
    actual: 'The submit button reads "Create acount" (one "c" missing). The button is the main call to action of the page. Reproduced every time in Chrome 131 and Firefox 133.',
    expected: 'The button name has no spelling errors: "Create account".',
    labels: 'typo',
  }, bekzat);
  await updateBug(db, c.key, { expected: 'The button name has no spelling errors: "Create account" (BR16).' }, bekzat);
  await addComment(db, c.key, 'Severity raised from Minor to Average by R1: an obvious typo in a well-visible place.', bekzat);

  const run = await createRun(db, { name: 'Smoke: Sign up form', target: 'Sign up', checklists: ['BTN'] }, bekzat);
  await setResult(db, run.id, 'BTN-1.1', { result: 'Pass' }, bekzat);
  await setResult(db, run.id, 'BTN-2.1', { result: 'Fail', bugKey: c.key }, bekzat);
  await setResult(db, run.id, 'BTN-1.4', { result: 'N/A', note: 'There are no closely located buttons on the form.' }, bekzat);
}
