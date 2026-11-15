// Business services. Every function takes `db` ({query}) so it can be used by
// routes and by the seeder. Errors are thrown as AppError(status, message, extra).
import { lintReport } from '../public/shared/linter.js';
import { checkTransition, checkFieldEdit, ROLES } from '../public/shared/workflow.js';
import { SEVERITY_LEVELS, COMPONENTS, CHECK_BY_ID, CHECKLISTS, DEFAULT_PRIORITY, PRIORITIES } from '../public/shared/catalog.js';
import { matchPlanted, gradeSeverity } from './domain/matcher.js';
import { PLANTED, publicPlanted } from './domain/planted.js';
import { EXAMPLE_SUMMARIES } from '../public/shared/examples.js';

export class AppError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
}

const rows = async (db, sql, p) => (await db.query(sql, p)).rows;
const first = async (db, sql, p) => (await rows(db, sql, p))[0] || null;
const clip = (s, n = 4000) => String(s ?? '').slice(0, n);

export function parseActor(name, role) {
  const n = clip(String(name || '').trim(), 60);
  if (!n) throw new AppError(401, 'Choose your name and role first (top right).');
  if (!ROLES.includes(role)) throw new AppError(401, `Unknown role "${role}".`);
  return { name: n, role };
}

function normalizeReport(input) {
  const steps = Array.isArray(input.steps) ? input.steps.map(s => clip(s, 500).trim()).filter(Boolean).slice(0, 30) : [];
  return {
    summary: clip(input.summary, 255).trim(),
    component: clip(input.component, 40),
    affectsVersion: clip(input.affectsVersion, 40),
    environment: clip(input.environment, 200).trim(),
    severity: clip(input.severity, 20),
    errorType: clip(input.errorType, 20),
    precondition: clip(input.precondition, 2000).trim(),
    steps,
    actual: clip(input.actual, 6000).trim(),
    expected: clip(input.expected, 2000).trim(),
    note: clip(input.note, 1000).trim(),
    labels: clip(input.labels, 200).trim() || 'None',
    suggestedSeverity: SEVERITY_LEVELS.includes(input.suggestedSeverity) ? input.suggestedSeverity : null,
    priority: clip(input.priority, 20),
    runId: Number.isInteger(input.runId) ? input.runId : null,
    checkId: CHECK_BY_ID[input.checkId] ? input.checkId : null,
  };
}

async function history(db, bugId, actor, field, oldV, newV, reason = null) {
  await db.query('INSERT INTO bug_history (bug_id, actor, role, field, old_value, new_value, reason) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [bugId, actor.name, actor.role, field, oldV == null ? null : String(oldV), newV == null ? null : String(newV), reason]);
}

// ---------------------------------------------------------------- bugs
export async function createBug(db, input, actor) {
  if (actor.role === 'Developer') throw new AppError(403, 'Developers fix defects; reports are filed by Testers or Leads.');
  const r = normalizeReport(input);
  const lint = lintReport(r);
  if (!lint.canSubmit) throw new AppError(422, `The report has ${lint.errors} error(s). Fix them before submitting.`, { lint });

  const priority = actor.role === 'Lead' && PRIORITIES.includes(r.priority) ? r.priority : DEFAULT_PRIORITY;
  const isExample = EXAMPLE_SUMMARIES.includes(r.summary);
  const match = isExample ? null : matchPlanted(r);
  let plantedId = null; let verdict = null; let duplicateHint = null;
  if (match) {
    const prev = await first(db, 'SELECT key FROM bugs WHERE reporter = $1 AND planted_id = $2 ORDER BY id LIMIT 1', [actor.name, match.planted.id]);
    if (prev) duplicateHint = prev.key;
    else { plantedId = match.planted.id; verdict = gradeSeverity(match.planted, r.severity).verdict; }
  }
  let labels = r.labels;
  if (r.checkId) labels = labels === 'None' ? r.checkId : `${labels}, ${r.checkId}`;

  const bug = await first(db, `INSERT INTO bugs (summary, component, affects_version, priority, reporter, labels, environment, severity,
      error_type, precondition, steps, actual, expected, note, suggested_severity, quality_score, quality_grade, planted_id, severity_verdict, run_id, check_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
  [r.summary, r.component, r.affectsVersion, priority, actor.name, labels, r.environment, r.severity, r.errorType, r.precondition,
    JSON.stringify(r.steps), r.actual, r.expected, r.note, r.suggestedSeverity, lint.score, lint.grade, plantedId, verdict, r.runId, r.checkId]);
  const key = `TC-${bug.id}`;
  await db.query('UPDATE bugs SET key = $1 WHERE id = $2', [key, bug.id]);
  await history(db, bug.id, actor, 'created', null, 'Open');

  if (r.runId && r.checkId) {
    const run = await first(db, 'SELECT * FROM test_runs WHERE id = $1', [r.runId]);
    if (run && run.status !== 'Completed') {
      await db.query(`INSERT INTO run_results (run_id, check_id, result, bug_key) VALUES ($1,$2,'Fail',$3)
        ON CONFLICT (run_id, check_id) DO UPDATE SET result = 'Fail', bug_key = $3, updated_at = now()`, [r.runId, r.checkId, key]);
      if (run.status === 'Not started') await db.query("UPDATE test_runs SET status = 'In progress' WHERE id = $1", [r.runId]);
    }
  }

  return {
    key, lint,
    discovery: plantedId ? { found: true, planted: publicPlanted(match.planted, true), severityVerdict: verdict } : { found: false, duplicateOf: duplicateHint, example: isExample },
  };
}

function shapeBug(b) {
  if (!b) return b;
  const steps = typeof b.steps === 'string' ? JSON.parse(b.steps) : b.steps;
  return { ...b, steps };
}

export async function listBugs(db, f = {}) {
  const where = []; const p = [];
  for (const [col, val] of [['status', f.status], ['severity', f.severity], ['component', f.component], ['reporter', f.reporter], ['assignee', f.assignee]]) {
    if (val) { p.push(val); where.push(`${col} = $${p.length}`); }
  }
  if (f.q) { p.push(`%${f.q}%`); where.push(`(summary ILIKE $${p.length} OR key ILIKE $${p.length})`); }
  const sortCol = { created: 'id', severity: 'severity', score: 'quality_score', updated: 'updated_at' }[f.sort] || 'id';
  const sql = `SELECT id, key, summary, status, component, priority, severity, reporter, assignee, resolution, quality_score, quality_grade, created_at, updated_at
    FROM bugs ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${sortCol} DESC LIMIT 300`;
  return rows(db, sql, p);
}

export async function getBug(db, key) {
  const b = shapeBug(await first(db, 'SELECT * FROM bugs WHERE key = $1', [String(key).toUpperCase()]));
  if (!b) throw new AppError(404, `${key} not found.`);
  b.comments = await rows(db, 'SELECT * FROM comments WHERE bug_id = $1 ORDER BY id', [b.id]);
  b.history = await rows(db, 'SELECT * FROM bug_history WHERE bug_id = $1 ORDER BY id', [b.id]);
  b.lint = lintReport({ ...b, affectsVersion: b.affects_version, errorType: b.error_type, suggestedSeverity: b.suggested_severity });
  return b;
}

export async function transitionBug(db, key, to, actor, payload) {
  const bug = await getBug(db, key);
  let dupTarget = null;
  if (payload.duplicateOf) dupTarget = await first(db, 'SELECT key, resolution, duplicate_of FROM bugs WHERE key = $1', [String(payload.duplicateOf).trim().toUpperCase()]);
  const res = checkTransition(bug, to, actor, payload, { findBug: k => (dupTarget && dupTarget.key === k ? dupTarget : null) });
  if (!res.ok) throw new AppError(409, res.error);
  const sets = []; const p = [];
  for (const [k, v] of Object.entries(res.changes)) { p.push(v); sets.push(`${k} = $${p.length}`); }
  p.push(bug.id);
  await db.query(`UPDATE bugs SET ${sets.join(', ')}, updated_at = now() WHERE id = $${p.length}`, p);
  for (const [k, v] of Object.entries(res.changes)) if (String(bug[k] ?? '') !== String(v ?? '')) await history(db, bug.id, actor, k, bug[k], v);
  if (res.comment) await db.query('INSERT INTO comments (bug_id, author, role, body) VALUES ($1,$2,$3,$4)', [bug.id, actor.name, actor.role, clip(res.comment, 4000)]);
  return getBug(db, key);
}

export async function editBugField(db, key, field, value, actor, payload = {}) {
  const bug = await getBug(db, key);
  const res = checkFieldEdit(bug, field, value, actor, payload);
  if (!res.ok) throw new AppError(403, res.error);
  const [[col, v]] = Object.entries(res.changes);
  if (String(bug[col]) === String(v)) throw new AppError(409, `${field} is already "${v}".`);
  await db.query(`UPDATE bugs SET ${col} = $1, updated_at = now() WHERE id = $2`, [v, bug.id]);
  await history(db, bug.id, actor, col, bug[col], v, res.reason || null);
  if (col === 'severity' && bug.planted_id) {
    const p = PLANTED.find(x => x.id === bug.planted_id);
    await db.query('UPDATE bugs SET severity_verdict = $1 WHERE id = $2', [gradeSeverity(p, v).verdict, bug.id]);
  }
  return getBug(db, key);
}

export async function addComment(db, key, body, actor) {
  const bug = await getBug(db, key);
  const text = clip(body, 4000).trim();
  if (text.length < 2) throw new AppError(400, 'Comment is empty.');
  await db.query('INSERT INTO comments (bug_id, author, role, body) VALUES ($1,$2,$3,$4)', [bug.id, actor.name, actor.role, text]);
  return getBug(db, key);
}

// ---------------------------------------------------------------- test runs
const RESULTS = ['Pass', 'Fail', 'Blocked', 'N/A', 'Not run'];

export async function createRun(db, input, actor) {
  const name = clip(input.name, 120).trim();
  const target = clip(input.target, 40);
  const lists = (Array.isArray(input.checklists) ? input.checklists : []).filter(id => CHECKLISTS.some(c => c.id === id));
  if (name.length < 3) throw new AppError(400, 'Run name must be at least 3 characters.');
  if (!COMPONENTS.includes(target)) throw new AppError(400, 'Choose the component under test.');
  if (!lists.length) throw new AppError(400, 'Pick at least one checklist.');
  return first(db, 'INSERT INTO test_runs (name, target, checklists, tester) VALUES ($1,$2,$3,$4) RETURNING *', [name, target, JSON.stringify(lists), actor.name]);
}

function runItems(run) {
  const lists = typeof run.checklists === 'string' ? JSON.parse(run.checklists) : run.checklists;
  return CHECKLISTS.filter(c => lists.includes(c.id)).flatMap(c => c.items.map(i => ({ ...i, checklist: c.name })));
}

function summarizeRun(run, results) {
  const items = runItems(run);
  const byId = Object.fromEntries(results.map(r => [r.check_id, r]));
  const counts = Object.fromEntries(RESULTS.map(r => [r, 0]));
  items.forEach(i => { counts[(byId[i.id] && byId[i.id].result) || 'Not run']++; });
  const executed = items.length - counts['Not run'] - counts['N/A'];
  const applicable = items.length - counts['N/A'];
  return {
    total: items.length, counts,
    progress: items.length ? Math.round(((items.length - counts['Not run']) / items.length) * 100) : 0,
    passRate: executed ? Math.round((counts.Pass / executed) * 100) : 0,
    coverage: applicable ? Math.round((executed / applicable) * 100) : 0,
  };
}

export async function listRuns(db) {
  const runs = await rows(db, 'SELECT * FROM test_runs ORDER BY id DESC LIMIT 100');
  const all = await rows(db, 'SELECT run_id, check_id, result FROM run_results');
  return runs.map(r => ({ ...r, summary: summarizeRun(r, all.filter(x => x.run_id === r.id)) }));
}

export async function getRun(db, id) {
  const run = await first(db, 'SELECT * FROM test_runs WHERE id = $1', [id]);
  if (!run) throw new AppError(404, 'Test run not found.');
  const results = await rows(db, 'SELECT * FROM run_results WHERE run_id = $1', [id]);
  const byId = Object.fromEntries(results.map(r => [r.check_id, r]));
  const items = runItems(run).map(i => ({ ...i, result: byId[i.id]?.result || 'Not run', note: byId[i.id]?.note || '', bug_key: byId[i.id]?.bug_key || null }));
  return { ...run, items, summary: summarizeRun(run, results) };
}

export async function setResult(db, runId, checkId, input, actor) {
  const run = await getRun(db, runId);
  if (run.status === 'Completed') throw new AppError(409, 'This run is completed and locked.');
  if (actor.role === 'Developer') throw new AppError(403, 'Test runs are executed by Testers or Leads.');
  if (!run.items.some(i => i.id === checkId)) throw new AppError(400, `${checkId} is not part of this run.`);
  const result = input.result;
  if (!RESULTS.includes(result)) throw new AppError(400, `Result must be one of ${RESULTS.join(', ')}.`);
  const note = clip(input.note, 1000).trim();
  let bugKey = input.bugKey ? String(input.bugKey).trim().toUpperCase() : null;
  if (result === 'N/A' && note.length < 5) throw new AppError(400, 'N/A needs a note explaining why the check does not apply.');
  if (result === 'Blocked' && !/\b[A-Z][A-Z0-9]+-\d+\b/i.test(note)) throw new AppError(400, 'Blocked needs a note naming the blocking defect (e.g. "Blocked by TC-4").');
  if (bugKey) {
    if (!(await first(db, 'SELECT 1 FROM bugs WHERE key = $1', [bugKey]))) throw new AppError(400, `${bugKey} does not exist.`);
  }
  if (result !== 'Fail') bugKey = null;
  await db.query(`INSERT INTO run_results (run_id, check_id, result, note, bug_key) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (run_id, check_id) DO UPDATE SET result = $3, note = $4, bug_key = COALESCE($5, CASE WHEN $3 = 'Fail' THEN run_results.bug_key END), updated_at = now()`,
  [runId, checkId, result, note, bugKey]);
  if (run.status === 'Not started') await db.query("UPDATE test_runs SET status = 'In progress' WHERE id = $1", [runId]);
  return getRun(db, runId);
}

export async function completeRun(db, runId, actor) {
  const run = await getRun(db, runId);
  if (run.status === 'Completed') throw new AppError(409, 'Already completed.');
  if (actor.role === 'Developer') throw new AppError(403, 'Only Testers or Leads complete runs.');
  const problems = [];
  run.items.forEach(i => {
    if (i.result === 'Not run') problems.push(`${i.id}: not executed (mark N/A with a reason if it does not apply).`);
    if (i.result === 'Fail' && !i.bug_key) problems.push(`${i.id}: failed but no bug is linked.`);
  });
  if (problems.length) throw new AppError(409, `The run cannot be completed: ${problems.length} problem(s).`, { problems });
  await db.query("UPDATE test_runs SET status = 'Completed', completed_at = now() WHERE id = $1", [runId]);
  return getRun(db, runId);
}

// ---------------------------------------------------------------- stats
export async function stats(db, reporter) {
  const bugs = await rows(db, 'SELECT key, status, severity, component, reporter, quality_score, planted_id, severity_verdict, created_at FROM bugs');
  const by = k => bugs.reduce((acc, b) => { acc[b[k]] = (acc[b[k]] || 0) + 1; return acc; }, {});
  const people = {};
  for (const b of bugs) {
    const p = people[b.reporter] ||= { reporter: b.reporter, bugs: 0, scoreSum: 0, found: new Set(), exact: 0, graded: 0 };
    p.bugs++; p.scoreSum += b.quality_score;
    if (b.planted_id) { p.found.add(b.planted_id); p.graded++; if (b.severity_verdict !== 'off') p.exact++; }
  }
  const leaderboard = Object.values(people).map(p => ({
    reporter: p.reporter, bugs: p.bugs, avgScore: Math.round(p.scoreSum / p.bugs), found: p.found.size,
    severityAccuracy: p.graded ? Math.round((p.exact / p.graded) * 100) : null,
    points: p.found.size * 10 + Math.round(p.scoreSum / p.bugs / 10) + p.exact * 3,
  })).sort((a, b) => b.points - a.points);

  const mine = bugs.filter(b => b.reporter === reporter && b.planted_id);
  const foundMap = Object.fromEntries(mine.map(b => [b.planted_id, b]));
  const discovery = [...PLANTED].sort((a, b) => a.id.localeCompare(b.id)).map(p => ({ ...publicPlanted(p, !!foundMap[p.id]), foundIn: foundMap[p.id]?.key || null, verdict: foundMap[p.id]?.severity_verdict || null }));
  return {
    totals: { bugs: bugs.length, open: bugs.filter(b => !['Closed', 'Resolved'].includes(b.status)).length, avgScore: bugs.length ? Math.round(bugs.reduce((s, b) => s + b.quality_score, 0) / bugs.length) : 0 },
    byStatus: by('status'), bySeverity: by('severity'), byComponent: by('component'),
    leaderboard, discovery, plantedTotal: PLANTED.length,
  };
}
