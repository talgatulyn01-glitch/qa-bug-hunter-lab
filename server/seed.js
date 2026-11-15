// Demo data so the mentor sees a populated tracker on first visit.
// Runs once per database (guarded by the meta table, safe under concurrency).
import { createBug, transitionBug, editBugField, createRun, setResult, addComment } from './services.js';

const tester = { name: 'Aida (demo tester)', role: 'Tester' };
const dev = { name: 'Daniyar (demo dev)', role: 'Developer' };
const lead = { name: 'Marat (demo lead)', role: 'Lead' };
const ENV = 'OS: Windows 11 Browser: Chrome 131';

export async function seed(db) {
  const claim = await db.query("INSERT INTO meta (k, v) VALUES ('seeded', now()::text) ON CONFLICT (k) DO NOTHING RETURNING k");
  if (!claim.rows.length) return;

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
  }, tester);

  const b = await createBug(db, {
    summary: 'Menu: item is named "Basket" on the Cart page',
    component: 'Menu', affectsVersion: 'LiteShop 1.0', environment: ENV, severity: 'Minor', errorType: 'GUI', suggestedSeverity: 'Minor',
    steps: ['Open the LiteShop sandbox (/sandbox/#/home)', 'Look at the menu item names', 'Click "Cart" in the menu', 'Compare the menu item names with step 2'],
    actual: 'On the Cart page the fourth menu item is named "Basket"; on Home, Catalog, Orders, Profile, Reviews and Sign up it is named "Cart". Reproduced every time in Chrome 131.',
    expected: 'The menu item is named "Cart" on all pages (BR2).',
  }, tester);
  await transitionBug(db, b.key, 'In Progress', dev, {}); // auto-assigns the developer
  await transitionBug(db, b.key, 'Resolved', dev, { resolution: 'Fixed', comment: 'Renamed the menu label on the Cart page. Ready for verification.' });

  const c = await createBug(db, {
    summary: 'Sign up: button name is "Create acount"',
    component: 'Sign up', affectsVersion: 'LiteShop 1.0', environment: ENV, severity: 'Average', errorType: 'GUI', suggestedSeverity: 'Average',
    steps: ['Open the LiteShop sandbox (/sandbox/#/signup)', 'Check the "Terms" checkbox', 'Read the name of the submit button'],
    actual: 'The submit button reads "Create acount" (one "c" missing). The button is the main call to action of the page. Reproduced every time in Chrome 131 and Firefox 133.',
    expected: 'The button name has no spelling errors: "Create account" (BR16).',
    labels: 'typo',
  }, tester);
  await editBugField(db, c.key, 'priority', 'Minor', lead);
  await addComment(db, c.key, 'Raised from Minor to Average (R1: obvious typo in a well-visible place). Agreed with the team.', tester);

  const run = await createRun(db, { name: 'Smoke: Sign up form', target: 'Sign up', checklists: ['BTN'] }, tester);
  await setResult(db, run.id, 'BTN-1.1', { result: 'Pass' }, tester);
  await setResult(db, run.id, 'BTN-2.1', { result: 'Fail', bugKey: c.key }, tester);
  await setResult(db, run.id, 'BTN-1.4', { result: 'N/A', note: 'There are no closely located buttons on the form.' }, tester);
  return { a, b, c };
}
