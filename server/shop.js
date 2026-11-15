// LiteShop sandbox back end. It contains PLANTED DEFECTS on purpose
// (see server/domain/planted.js). Nothing here touches a real SQL engine with
// user input: the "SQL injection" is simulated on an in-memory product list.
import { AppError } from './services.js';

export const PRODUCTS = [
  { id: 1, name: 'Wireless Mouse', category: 'Electronics', price: 12.5 },
  { id: 2, name: 'USB-C Cable', category: 'Electronics', price: 6 },
  { id: 3, name: 'Bluetooth Speaker', category: 'Electronics', price: 39.9 },
  { id: 4, name: 'Clean Code', category: 'Books', price: 32 },
  { id: 5, name: 'Testing Computer Software', category: 'Books', price: 45 },
  { id: 6, name: 'The Art of Unit Testing', category: 'Books', price: 28.5 },
  { id: 7, name: 'Ceramic Mug', category: 'Home', price: 8.9 },
  { id: 8, name: 'Desk Lamp', category: 'Home', price: 24 },
  { id: 9, name: 'Yoga Mat', category: 'Sports', price: 19.9 },
  { id: 10, name: 'Water Bottle', category: 'Sports', price: 11 },
  { id: 11, name: 'Puzzle 1000 pcs', category: 'Toys', price: 14.5 },
  { id: 12, name: 'Speed Cube', category: 'Toys', price: 9.9 },
];
const INTERNAL = [
  { id: 901, name: '[INTERNAL] Staff voucher 50%', category: 'Internal', price: 0, cost_price: 0, internal: true },
  { id: 902, name: '[INTERNAL] Prototype phone X2', category: 'Internal', price: 0, cost_price: 214.37, internal: true },
];
PRODUCTS.forEach(p => { p.cost_price = +(p.price * 0.46).toFixed(2); });

const clip = (s, n) => String(s ?? '').slice(0, n);
const publicView = p => ({ id: p.id, name: p.name, category: p.category, price: p.price });

// PB08: the query is "built" by string concatenation; quotes break it.
export function searchProducts(rawQ) {
  const q = clip(rawQ, 100);
  if (!q) return { products: PRODUCTS.map(publicView) };
  const sql = `SELECT id, name, price FROM products WHERE visible = true AND name ILIKE '%${q}%'`;
  if (/'\s*or\s*'?\d+'?\s*=\s*'?\d+/i.test(q) || /\bor\s+1\s*=\s*1\b/i.test(q)) {
    return { products: [...PRODUCTS, ...INTERNAL].map(p => ({ ...publicView(p), cost_price: p.cost_price })) };
  }
  if ((q.match(/'/g) || []).length % 2 === 1) {
    throw new AppError(500, 'Internal Server Error', {
      code: '42601',
      detail: `syntax error at or near "${q.slice(q.indexOf("'"))}%'"`,
      query: sql,
    });
  }
  const needle = q.toLowerCase();
  return { products: PRODUCTS.filter(p => p.name.toLowerCase().includes(needle)).map(publicView) };
}

const sessionOf = req => {
  const s = String(req.get('X-Shop-Session') || '');
  if (!/^[a-z0-9-]{8,64}$/i.test(s)) throw new AppError(400, 'Missing shop session.');
  return s;
};

export function shopRoutes(app, wrap, getDb) {
  app.get('/api/shop/products', wrap(async req => searchProducts(req.query.q)));

  // Sign up — PB12 (max 40 instead of 30), PB13 (spaces-only accepted),
  // PB14 (case-sensitive uniqueness), PB21-like trimming is fine here.
  app.post('/api/shop/accounts', wrap(async req => {
    const db = await getDb();
    const session = sessionOf(req);
    const b = req.body || {};
    const name = clip(b.name, 60);
    const email = clip(b.email, 120).trim();
    const phone = clip(b.phone, 30).trim();
    const errors = {};
    if (name.length < 2) errors.name = 'Name must be at least 2 characters.';
    else if (name.length > 40) errors.name = 'Name is too long.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email.';
    if (!phone) errors.phone = 'Phone is required.';
    else if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) errors.phone = 'Enter a valid phone number.';
    if (!b.terms) errors.terms = 'Accept the Terms.';
    if (!errors.email) {
      const dup = (await db.query('SELECT 1 FROM shop_accounts WHERE session = $1 AND email = $2', [session, email])).rows[0];
      if (dup) errors.email = 'This email is already registered.';
    }
    if (Object.keys(errors).length) throw new AppError(400, 'Validation failed', { errors });
    const acc = (await db.query('INSERT INTO shop_accounts (session, name, email, phone) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone, city',
      [session, name.replace(/^\s+|\s+$/g, '') || name, email, phone])).rows[0];
    return acc;
  }));

  app.get('/api/shop/accounts/:id', wrap(async req => {
    const db = await getDb();
    const acc = (await db.query('SELECT id, name, email, phone, city FROM shop_accounts WHERE id = $1 AND session = $2', [req.params.id, sessionOf(req)])).rows[0];
    if (!acc) throw new AppError(404, 'Account not found.');
    return acc;
  }));

  // PB19: the city is silently dropped and the response has no "profile.city".
  app.put('/api/shop/accounts/:id', wrap(async req => {
    const db = await getDb();
    const b = req.body || {};
    const name = clip(b.name, 40).trim();
    const phone = clip(b.phone, 30).trim();
    if (name.length < 2) throw new AppError(400, 'Validation failed', { errors: { name: 'Name must be 2-30 characters.' } });
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) throw new AppError(400, 'Validation failed', { errors: { phone: 'Enter a valid phone number.' } });
    const acc = (await db.query('UPDATE shop_accounts SET name = $1, phone = $2 WHERE id = $3 AND session = $4 RETURNING id, name, phone',
      [name, phone, req.params.id, sessionOf(req)])).rows[0];
    if (!acc) throw new AppError(404, 'Account not found.');
    return { saved: true, profile: { name: acc.name, phone: acc.phone } };
  }));

  // PB11: no idempotency key, every request creates an order.
  app.post('/api/shop/orders', wrap(async req => {
    const db = await getDb();
    const session = sessionOf(req);
    const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
    if (!items.length) throw new AppError(400, 'Cart is empty.');
    const total = Number(req.body.total);
    if (!Number.isFinite(total) || total < 0 || total > 1e6) throw new AppError(400, 'Invalid total.');
    await new Promise(r => setTimeout(r, 350));
    const order = (await db.query('INSERT INTO shop_orders (session, items, total, city) VALUES ($1,$2,$3,$4) RETURNING *',
      [session, JSON.stringify(items.map(i => ({ id: Number(i.id), qty: Number(i.qty) }))), total.toFixed(2), clip(req.body.city, 60)])).rows[0];
    return order;
  }));

  app.get('/api/shop/orders', wrap(async req => {
    const db = await getDb();
    return (await db.query('SELECT * FROM shop_orders WHERE session = $1 ORDER BY id DESC LIMIT 50', [sessionOf(req)])).rows;
  }));

  // PB20/PB21: body is stored raw (rendered as HTML by the client), author not trimmed.
  app.get('/api/shop/reviews', wrap(async req => {
    const db = await getDb();
    return (await db.query("SELECT id, author, rating, body, created_at FROM shop_reviews WHERE session = $1 OR session = 'seed' ORDER BY id DESC LIMIT 50", [sessionOf(req)])).rows;
  }));
  app.post('/api/shop/reviews', wrap(async req => {
    const db = await getDb();
    const b = req.body || {};
    const author = clip(b.author, 40);
    const body = clip(b.body, 1000);
    const rating = Math.round(Number(b.rating));
    const errors = {};
    if (author.trim().length < 2 || author.trim().length > 30) errors.author = 'Author name must be 2-30 characters.';
    if (body.trim().length < 3) errors.body = 'Review is too short.';
    if (!(rating >= 1 && rating <= 5)) errors.rating = 'Choose a rating from 1 to 5.';
    if (Object.keys(errors).length) throw new AppError(400, 'Validation failed', { errors });
    return (await db.query('INSERT INTO shop_reviews (session, author, rating, body) VALUES ($1,$2,$3,$4) RETURNING *', [sessionOf(req), author, rating, body])).rows[0];
  }));
}
