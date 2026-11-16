// Router + tester name picker. Each module renders into #view.
import { h, mount, modal, field, toast } from './ui.js';
import { getActor, setActor, api } from './api.js';
import { renderDashboard } from './views/dashboard.js';
import { renderRuns, renderRun } from './views/runs.js';
import { renderSeverity } from './views/severity.js';
import { renderReport } from './views/report.js';
import { renderBugs, renderBug } from './views/tracker.js';
import { renderKb } from './views/kb.js';
import { renderPrompt } from './views/prompt.js';

const view = document.getElementById('view');
const routes = [
  [/^#\/dashboard$/, renderDashboard, 'dashboard'],
  [/^#\/runs$/, renderRuns, 'runs'],
  [/^#\/runs\/(\d+)$/, renderRun, 'runs'],
  [/^#\/severity$/, renderSeverity, 'severity'],
  [/^#\/report$/, renderReport, 'report'],
  [/^#\/bugs$/, renderBugs, 'bugs'],
  [/^#\/bugs\/([A-Za-z]+-\d+)$/, renderBug, 'bugs'],
  [/^#\/kb(?:\/(\w+))?$/, renderKb, 'kb'],
  [/^#\/prompt$/, renderPrompt, 'prompt'],
];

function parseHash() {
  const [path, qs] = (location.hash || '#/dashboard').split('?');
  return { path, params: new URLSearchParams(qs || '') };
}

async function route() {
  const { path, params } = parseHash();
  const match = routes.find(([rx]) => rx.test(path));
  if (!match) { location.hash = '#/dashboard'; return; }
  const [rx, render, nav] = match;
  document.querySelectorAll('[data-nav]').forEach(a => {
    const on = a.dataset.nav === nav;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const args = path.match(rx).slice(1);
  mount(view, h('div.loading', {}, 'Loading…'));
  try {
    await render(view, { args, params, actor: getActor() });
  } catch (err) {
    mount(view, h('div.panel.error-panel', {}, h('h2', {}, 'Something went wrong'), h('p', {}, err.message)));
  }
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export function pickActor(force = false) {
  const cur = getActor();
  if (cur && !force) return;
  const name = h('input', { value: cur?.name || '', placeholder: 'e.g. Talgat', maxlength: 60, autocomplete: 'name' });
  const err = h('p.form-error', { role: 'alert' });
  const save = () => {
    const n = name.value.trim();
    if (n.length < 2) { err.textContent = 'Enter a name of at least 2 characters.'; name.focus(); return; }
    setActor({ name: n, role: 'Tester' });
    m.close();
    toast(`Testing as ${n}`, 'ok');
  };
  const m = modal('Who is testing?', h('form', { onsubmit: e => { e.preventDefault(); save(); } },
    h('p.muted', {}, 'Your name is the Reporter of your bug reports and appears on the leaderboard. Only you can edit or change the severity of your reports; other testers can read and comment on them.'),
    field('Name', name, { required: true, id: 'actor-name' }),
    err,
    h('div.actions', {}, h('button.primary', { type: 'submit' }, 'Start'))));
}

function renderActorChip() {
  const a = getActor();
  const chip = document.getElementById('actor');
  mount(chip, a ? [h('span.avatar', {}, a.name.slice(0, 1).toUpperCase()), h('span', {}, a.name), h('span.role', {}, 'Tester')] : 'Enter your name');
}

document.getElementById('actor').addEventListener('click', () => pickActor(true));
window.addEventListener('actor-changed', () => { renderActorChip(); route(); });
window.addEventListener('hashchange', route);

renderActorChip();
route();
if (!getActor()) setTimeout(() => pickActor(), 300);
api('GET', '/health').then(r => {
  document.getElementById('dbmode').textContent = r.db === 'postgres' ? 'Data: Postgres (persistent)' : 'Data: in-memory demo (set DATABASE_URL to persist)';
}).catch(() => { document.getElementById('dbmode').textContent = 'API unavailable'; });
