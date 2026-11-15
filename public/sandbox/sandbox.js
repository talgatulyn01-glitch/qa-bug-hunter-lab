// LiteShop: a small shop with PLANTED DEFECTS for testing practice.
// Do not "fix" the marked lines: they are the exercise.
// XSS and SQL injection are simulated; nothing user-entered is executed.

const $ = s => document.querySelector(s);
const page = $('#page');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n).toFixed(2);
const ICONS = { Electronics: '🎧', Books: '📘', Home: '🏠', Sports: '🏃', Toys: '🧩', Internal: '🔒' };
const CATEGORIES = ['Electronics', 'Books', 'Home', 'Sports', 'Toys'];
const PER_PAGE = 4;

// ---- session & storage ------------------------------------------------------
function sid() {
  let s = localStorage.getItem('ls.sid');
  if (!s) { s = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)); localStorage.setItem('ls.sid', s); }
  return s;
}
document.cookie = `liteshop_session=${sid()}; path=/sandbox; SameSite=Lax`;
const store = {
  get cart() { try { return JSON.parse(localStorage.getItem('ls.cart')) || []; } catch { return []; } },
  set cart(v) { localStorage.setItem('ls.cart', JSON.stringify(v)); },
  get account() { return Number(localStorage.getItem('ls.account')) || null; },
  set account(v) { v ? localStorage.setItem('ls.account', String(v)) : localStorage.removeItem('ls.account'); },
};

async function shopApi(method, path, body) {
  const res = await fetch('/api/shop' + path, {
    method, headers: { 'Content-Type': 'application/json', 'X-Shop-Session': sid() },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// ---- menu -------------------------------------------------------------------
const MENU = [['home', 'Home'], ['catalog', 'Catalog'], ['cart', 'Cart'], ['orders', 'Orders'], ['profile', 'Profile'], ['reviews', 'Reviews'], ['signup', 'Sign up']];
function renderMenu(current) {
  $('#menu').innerHTML = MENU.map(([id, label]) => {
    let href = `#/${id}`;
    let text = label;
    if (id === 'orders') href = '#/profile';                        // PB03: wrong target
    if (id === 'cart' && current === 'cart') text = 'Basket';         // PB02: inconsistent name
    const active = id === current && current !== 'catalog';          // PB01: Catalog never highlighted
    return `<a href="${href}" class="${active ? 'active' : ''}" ${active ? 'aria-current="page"' : ''}>${text}</a>`;
  }).join('');
}

// ---- cart pricing -------------------------------------------------------------
function lineTotal(price, qty) {
  let t = price * qty;
  if (qty >= 10) t = t * 0.9 * 0.9;                                  // PB09: discount applied twice (BR9 says 10%)
  return Math.round(t * 100) / 100;
}
function parseQty(raw) {
  const v = String(raw).trim();
  let n = NaN;
  if (/^\d+$/.test(v)) n = Number(v);
  else if (/^\d+,\d+$/.test(v)) n = Number(v.replace(',', ''));      // PB10: "2,5" becomes 25
  if (!Number.isInteger(n) || n < 1 || n > 99) return { error: 'Quantity must be a whole number from 1 to 99.' };
  return { value: n };
}

// ---- pages -------------------------------------------------------------------
const pages = {
  home() {
    page.innerHTML = `
      <section class="hero"><h1>Everything for work and play</h1><p>Free delivery on orders over 50.00. Bulk discount: 10% off a line with 10 or more items.</p>
      <a class="btn" href="#/catalog">Shop the catalog</a></section>
      <h2>Popular right now</h2><div class="products" id="feat"></div>`;
    shopApi('GET', '/products').then(r => r.json()).then(d => {
      $('#feat').innerHTML = d.products.slice(0, 4).map(productCard).join('');
      bindAddButtons($('#feat'), d.products);
    });
  },

  catalog() {
    const state = { selected: new Set(), viaSelectAll: false, page: 1, products: [], all: [] };
    page.innerHTML = `
      <h1>Catalog</h1>
      <div class="layout">
        <aside class="box filters" aria-label="Filters">
          <b>Categories</b>
          <label><input type="checkbox" id="cat-all"> Select all</label>
          ${CATEGORIES.map(c => c === 'Books'
            ? `<div class="lbl-row"><input type="checkbox" class="cat" value="${c}" id="cat-${c}"><span>${c}</span></div>` // PB05: label not linked
            : `<label><input type="checkbox" class="cat" value="${c}"> ${c}</label>`).join('')}
        </aside>
        <section>
          <form class="search" id="search-form" role="search">
            <input id="q" name="q" placeholder="Search products" aria-label="Search">
            <button class="btn blue" type="submit">Search</button>
          </form>
          <div id="search-msg"></div>
          <div class="products" id="grid"></div>
          <div class="pager"><button class="btn" id="prev" type="button">← Previous</button><span id="pg"></span><button class="btn" id="next" type="button">Next →</button></div>
        </section>
      </div>`;
    const all = $('#cat-all');
    const boxes = [...document.querySelectorAll('.cat')];

    function draw() {
      boxes.forEach(b => { b.checked = state.selected.has(b.value); });
      const list = state.selected.size ? state.products.filter(p => state.selected.has(p.category)) : state.products;
      const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
      state.page = Math.min(state.page, pages);
      const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
      $('#grid').innerHTML = slice.length ? slice.map(productCard).join('') : '<p>No products found.</p>';
      bindAddButtons($('#grid'), state.all.length ? state.all : state.products);
      $('#pg').textContent = `Page ${state.page} of ${pages}`;
      $('#prev').disabled = state.page === 1;
      $('#next').disabled = state.page === pages;
    }

    boxes.forEach(b => b.addEventListener('change', () => {
      if (b.checked) { state.selected.add(b.value); }
      else if (!state.viaSelectAll && state.selected.size >= 2) {        // PB04: unselecting one clears all
        state.selected.clear();
      } else { state.selected.delete(b.value); }
      if (!state.selected.size) state.viaSelectAll = false;
      // PB07: "Select all" is not unchecked after a manual unselect
      state.page = 1; draw();
    }));
    all.addEventListener('change', () => {
      if (all.checked) { CATEGORIES.forEach(c => state.selected.add(c)); state.viaSelectAll = true; }
      else { state.selected.clear(); state.viaSelectAll = false; }
      state.page = 1; draw();
    });
    $('#next').addEventListener('click', () => { state.page++; draw(); });
    $('#prev').addEventListener('click', () => {
      state.page--; state.selected.clear(); all.checked = false; state.viaSelectAll = false; // PB06: filters reset on the way back
      draw();
    });
    $('#search-form').addEventListener('submit', e => { e.preventDefault(); runSearch($('#q').value, state, draw); });

    shopApi('GET', '/products').then(r => r.json()).then(d => { state.products = d.products; state.all = d.products; draw(); });
  },

  cart() {
    const cart = store.cart;
    if (!cart.length) { page.innerHTML = '<h1>Cart</h1><p>Your cart is empty. <a href="#/catalog">Go to the catalog</a></p>'; return; }
    page.innerHTML = `<h1>Cart</h1>
      <table><thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Line total</th><th></th></tr></thead>
      <tbody>${cart.map((l, i) => `<tr>
        <td>${esc(l.name)}</td><td>${money(l.price)}</td>
        <td><input class="qty" data-i="${i}" value="${l.qty}" aria-label="Quantity of ${esc(l.name)}"><div class="err" id="qerr-${i}"></div></td>
        <td>${money(lineTotal(l.price, l.qty))}</td>
        <td><button class="btn" data-rm="${i}" type="button">Remove</button></td></tr>`).join('')}</tbody></table>
      <div class="total">Total: ${money(cart.reduce((s, l) => s + lineTotal(l.price, l.qty), 0))}</div>
      <p style="text-align:right"><a class="btn blue" href="#/checkout">Proceed to checkout</a></p>`;
    document.querySelectorAll('.qty').forEach(inp => inp.addEventListener('change', () => {
      const i = Number(inp.dataset.i);
      const r = parseQty(inp.value);
      if (r.error) { $('#qerr-' + i).textContent = r.error; return; }
      const c = store.cart; c[i].qty = r.value; store.cart = c; pages.cart();
    }));
    document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      const c = store.cart; c.splice(Number(b.dataset.rm), 1); store.cart = c; pages.cart();
    }));
  },

  async checkout() {
    const cart = store.cart;
    let city = '';
    if (store.account) {
      const r = await shopApi('GET', `/accounts/${store.account}`);
      if (r.ok) city = (await r.json()).city || '';
    }
    const total = cart.reduce((s, l) => s + lineTotal(l.price, l.qty), 0);
    page.innerHTML = `<h1>Checkout</h1>
      <div id="co-msg"></div>
      <div class="box">
        <p><b>Items:</b> ${cart.reduce((s, l) => s + l.qty, 0)} · <b>Total:</b> ${money(total)}</p>
        <p><b>Delivery city:</b> ${city ? esc(city) : '— <small>(set your city in <a href="#/profile">Profile</a>)</small>'}</p>
        <button class="btn blue" id="place" type="button" ${cart.length ? '' : 'disabled'}>Place order</button>
      </div>`;
    // PB11: the button is not disabled while the request is in flight
    $('#place').addEventListener('click', async () => {
      const res = await shopApi('POST', '/orders', { items: cart.map(l => ({ id: l.id, qty: l.qty })), total, city });
      const body = await res.json();
      if (!res.ok) { $('#co-msg').innerHTML = `<div class="fail">${esc(body.error)}</div>`; return; }
      store.cart = [];
      $('#co-msg').innerHTML = `<div class="ok">Order #${body.id} placed. <a href="#/orders">View my orders</a></div>`;
    });
  },

  async orders() {
    const res = await shopApi('GET', '/orders');
    const list = res.ok ? await res.json() : [];
    page.innerHTML = `<h1>Orders</h1>${list.length ? `<table><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>City</th></tr></thead><tbody>
      ${list.map(o => `<tr><td>#${o.id}</td><td>${new Date(o.created_at).toLocaleString()}</td><td>${(typeof o.items === 'string' ? JSON.parse(o.items) : o.items).reduce((s, i) => s + i.qty, 0)}</td><td>${money(o.total)}</td><td>${esc(o.city) || '—'}</td></tr>`).join('')}
      </tbody></table>` : '<p>No orders yet.</p>'}`;
  },

  async profile() {
    if (!store.account) { page.innerHTML = '<h1>Profile</h1><p>You are not signed in. <a href="#/signup">Create an account</a></p>'; return; }
    const r = await shopApi('GET', `/accounts/${store.account}`);
    if (!r.ok) { store.account = null; pages.profile(); return; }
    const a = await r.json();
    page.innerHTML = `<h1>Profile</h1><div id="pr-msg"></div>
      <form class="form" id="pf" novalidate>
        <div class="f"><label class="t" for="p-name">Name *</label><input id="p-name" value="${esc(a.name)}" maxlength="40"><div class="err" id="e-name"></div></div>
        <div class="f"><label class="t" for="p-email">Email</label><input id="p-email" value="${esc(a.email)}" readonly class="pseudo-disabled"></div>
        <div class="f"><label class="t" for="p-phone">Phone *</label><input id="p-phone" value="${esc(a.phone)}"><div class="err" id="e-phone"></div></div>
        <div class="f"><label class="t" for="p-city">City</label><input id="p-city" value="${esc(a.city)}" placeholder="Delivery city"></div>
        <button class="btn blue" type="submit">Save</button> <button class="btn" type="button" id="logout">Sign out</button>
      </form>`;
    $('#logout').addEventListener('click', () => { store.account = null; location.hash = '#/home'; });
    $('#pf').addEventListener('submit', async e => {
      e.preventDefault();
      ['name', 'phone'].forEach(k => { $('#e-' + k).textContent = ''; });
      const res = await shopApi('PUT', `/accounts/${store.account}`, { name: $('#p-name').value, phone: $('#p-phone').value, city: $('#p-city').value });
      const body = await res.json();
      if (!res.ok) { Object.entries(body.errors || {}).forEach(([k, v]) => { const el = $('#e-' + k); if (el) el.textContent = v; }); return; }
      $('#pr-msg').innerHTML = '<div class="ok">Profile saved.</div>';
      applyProfile(body);                                               // PB19: throws, city was never saved
    });
  },

  async reviews() {
    page.innerHTML = `<h1>Reviews</h1>
      <div class="layout" style="grid-template-columns: 1fr 340px">
        <section id="rv-list"></section>
        <form class="box form" id="rv-form" novalidate>
          <h3 style="margin-top:0">Write a review</h3>
          <div class="f"><label class="t" for="rv-author">Your name *</label><input id="rv-author" maxlength="40"><div class="err" id="e-author"></div></div>
          <div class="f"><label class="t" for="rv-rating">Rating *</label><select id="rv-rating"><option value="">Choose…</option>${[5, 4, 3, 2, 1].map(n => `<option>${n}</option>`).join('')}</select><div class="err" id="e-rating"></div></div>
          <div class="f"><label class="t" for="rv-body">Review *</label><textarea id="rv-body" rows="5"></textarea><div class="err" id="e-body"></div></div>
          <button class="btn blue" type="submit">Post review</button>
        </form>
      </div>`;
    const load = async () => {
      const res = await shopApi('GET', '/reviews');
      const list = res.ok ? await res.json() : [];
      const box = $('#rv-list');
      box.innerHTML = '';
      let alerted = false;
      list.forEach(rv => {
        const el = document.createElement('article');
        el.className = 'review';
        el.innerHTML = `<div><span class="author">${esc(rv.author)}</span> <span class="stars" aria-label="${rv.rating} of 5">${'★'.repeat(rv.rating)}${'☆'.repeat(5 - rv.rating)}</span></div><div class="rv-body"></div>`;
        el.querySelector('.rv-body').append(renderUnsafeLooking(rv.body));   // PB20: HTML is rendered
        box.append(el);
        if (!alerted && simulateScript(rv.body)) alerted = true;
      });
      if (!list.length) box.innerHTML = '<p>No reviews yet.</p>';
    };
    $('#rv-form').addEventListener('submit', async e => {
      e.preventDefault();
      ['author', 'rating', 'body'].forEach(k => { $('#e-' + k).textContent = ''; });
      const res = await shopApi('POST', '/reviews', { author: $('#rv-author').value, rating: $('#rv-rating').value, body: $('#rv-body').value }); // PB21: author not trimmed
      const body = await res.json();
      if (!res.ok) { Object.entries(body.errors || {}).forEach(([k, v]) => { $('#e-' + k).textContent = v; }); return; }
      $('#rv-form').reset();
      load();
    });
    load();
  },

  signup() {
    page.innerHTML = `<h1>Sign up</h1><div id="su-msg"></div>
      <form class="form" id="su" novalidate>
        <div class="f"><label class="t" for="s-name">Name *</label><input id="s-name" maxlength="40" autofocus><div class="err" id="e-name"></div></div>
        <div class="f"><label class="t" for="s-email">Email *</label><input id="s-email" type="email"><div class="err" id="e-email"></div></div>
        <div class="f"><label class="t" for="s-phone">Phone</label><input id="s-phone" placeholder="+7 700 000 00 00"><div class="err" id="e-phone"></div></div>
        <div class="f"><label class="t" for="s-promo">Promo code</label><input id="s-promo" readonly class="pseudo-disabled" value="Not available yet"></div>
        <label style="display:flex;gap:8px;margin-bottom:14px"><input type="checkbox" id="s-terms"> I accept the Terms of service</label>
        <div class="err" id="e-terms"></div>
        <button class="btn blue" type="submit" id="s-submit" style="display:none">Create acount</button>
      </form>`;
    // PB12 maxlength 40 instead of 30, PB15 hidden instead of disabled, PB16 typo,
    // PB17 promo field is focusable, PB18 phone not marked as required.
    $('#s-terms').addEventListener('change', e => { $('#s-submit').style.display = e.target.checked ? '' : 'none'; });
    $('#su').addEventListener('submit', async e => {
      e.preventDefault();
      ['name', 'email', 'phone', 'terms'].forEach(k => { $('#e-' + k).textContent = ''; });
      const res = await shopApi('POST', '/accounts', { name: $('#s-name').value, email: $('#s-email').value, phone: $('#s-phone').value, terms: $('#s-terms').checked });
      const body = await res.json();
      if (!res.ok) { Object.entries(body.errors || {}).forEach(([k, v]) => { const el = $('#e-' + k); if (el) el.textContent = v; }); return; }
      store.account = body.id;
      $('#su').reset(); $('#s-submit').style.display = 'none';
      $('#su-msg').innerHTML = `<div class="ok">Welcome, ${esc(body.name)}! Your account is ready. <a href="#/profile">Go to profile</a></div>`;
    });
  },
};

// ---- helpers with planted defects ------------------------------------------------
function productCard(p) {
  return `<div class="product">
    <div class="img" aria-hidden="true">${ICONS[p.category] || '📦'}</div>
    <div class="cat">${esc(p.category)}</div><div>${esc(p.name)}</div>
    <div class="price">${money(p.price)}</div>
    ${p.cost_price !== undefined ? `<div class="cost">Cost price: ${money(p.cost_price)}</div>` : ''}
    <button class="btn add" type="button" data-id="${p.id}" title="Add to cart"><span class="add-label">Add to cart</span></button>
  </div>`;
}
function bindAddButtons(root, products) {
  root.querySelectorAll('.add-label').forEach(label => label.addEventListener('click', () => {   // PB22: only the text is clickable
    const p = products.find(x => x.id === Number(label.parentElement.dataset.id));
    if (!p) return;
    const cart = store.cart;
    const line = cart.find(l => l.id === p.id);
    if (line) line.qty = Math.min(99, line.qty + 1); else cart.push({ id: p.id, name: p.name, price: p.price, qty: 1 });
    store.cart = cart;
    label.textContent = 'Added ✓';
    setTimeout(() => { label.textContent = 'Add to cart'; }, 900);
  }));
}

class SearchService {
  async handle(res) {
    const body = await res.json();
    if (!res.ok) throw new Error(`SearchService: ${res.status} Internal Server Error, ${body.detail || body.error}`);
    return body.products;
  }
}
async function runSearch(q, state, draw) {
  $('#search-msg').innerHTML = '';
  try {
    const res = await shopApi('GET', '/products?q=' + encodeURIComponent(q));
    state.products = await new SearchService().handle(res);           // PB08: server breaks on quotes
    state.page = 1; draw();
  } catch (err) {
    console.error(err);
    $('#grid').innerHTML = '';
    $('#search-msg').innerHTML = '<div class="fail">Something went wrong. Try again later.</div>';
  }
}

function applyProfile(res) {
  const city = res.profile.city.trim();                               // TypeError: profile.city is undefined
  $('#p-city').value = city;
}

// Renders formatting tags (the defect) but strips anything executable.
function renderUnsafeLooking(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta, base, form').forEach(n => n.remove());
  doc.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(a => {
      if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value) || (a.name === 'style' && /url\(|expression/i.test(a.value))) el.removeAttribute(a.name);
    });
  });
  const frag = document.createDocumentFragment();
  [...doc.body.firstChild.childNodes].forEach(n => frag.append(document.importNode(n, true)));
  return frag;
}
// Simulates what a browser would do with a script: shows an alert-like dialog.
function simulateScript(text) {
  const m = String(text).match(/alert\s*\(\s*([\s\S]*?)\s*\)/i);
  if (!m) return false;
  let arg = m[1];
  if (/document\.cookie/.test(arg)) arg = document.cookie || '(no cookies)';
  else arg = arg.replace(/^['"‘’“”`]|['"‘’“”`]$/g, '');
  fakeAlert(arg);
  return true;
}
function fakeAlert(message) {
  const root = $('#alert-root');
  root.innerHTML = `<div class="fake-alert-wrap" role="alertdialog" aria-label="Page alert"><div class="fake-alert">
    <div class="from">${esc(location.host)} says</div><div class="msg"></div><div class="row"><button type="button">OK</button></div></div></div>`;
  root.querySelector('.msg').textContent = message;
  const btn = root.querySelector('button');
  btn.addEventListener('click', () => { root.innerHTML = ''; });
  btn.focus();
}

// ---- router -------------------------------------------------------------------
function route() {
  const id = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'home';
  const name = pages[id] ? id : 'home';
  renderMenu(name);
  document.title = `LiteShop · ${name[0].toUpperCase() + name.slice(1)}`;
  pages[name]();
}
window.addEventListener('hashchange', route);
route();
