// Express API. Exported for Vercel (api/index.js) and for local runs (server/local.js).
import express from 'express';
import { getDb, dbMode } from './db.js';
import {
  AppError, parseActor, createBug, updateBug, listBugs, getBug, changeSeverity, addComment,
  createRun, listRuns, getRun, setResult, completeRun, stats,
} from './services.js';
import { shopRoutes } from './shop.js';
import { lintReport } from '../public/shared/linter.js';
import { evaluateSeverity } from '../public/shared/severity.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const wrap = fn => async (req, res) => {
  try {
    const out = await fn(req, res);
    if (!res.headersSent) res.json(out ?? { ok: true });
  } catch (err) {
    const status = err instanceof AppError ? err.status : 500;
    if (status === 500 && !(err instanceof AppError)) console.error(err);
    res.status(status).json({ error: err.message || 'Server error', ...(err.extra || {}) });
  }
};
const actorOf = req => parseActor(decodeURIComponent(req.get('X-User-Name') || ''));

app.get('/api/health', wrap(async () => { await getDb(); return { ok: true, db: dbMode }; }));

// Stateless business logic, exposed for transparency / API testing.
app.post('/api/lint', wrap(async req => lintReport(req.body || {})));
app.post('/api/severity', wrap(async req => evaluateSeverity(req.body || {})));

app.get('/api/bugs', wrap(async req => listBugs(await getDb(), req.query)));
app.post('/api/bugs', wrap(async (req, res) => { const out = await createBug(await getDb(), req.body || {}, actorOf(req)); res.status(201); return out; }));
app.get('/api/bugs/:key', wrap(async req => getBug(await getDb(), req.params.key)));
app.put('/api/bugs/:key', wrap(async req => updateBug(await getDb(), req.params.key, req.body || {}, actorOf(req))));
app.post('/api/bugs/:key/severity', wrap(async req => changeSeverity(await getDb(), req.params.key, req.body?.value, req.body?.reasonId, actorOf(req))));
app.post('/api/bugs/:key/comments', wrap(async req => addComment(await getDb(), req.params.key, req.body?.body, actorOf(req))));

app.get('/api/runs', wrap(async () => listRuns(await getDb())));
app.post('/api/runs', wrap(async (req, res) => { const r = await createRun(await getDb(), req.body || {}, actorOf(req)); res.status(201); return r; }));
app.get('/api/runs/:id', wrap(async req => getRun(await getDb(), Number(req.params.id))));
app.put('/api/runs/:id/results/:checkId', wrap(async req => setResult(await getDb(), Number(req.params.id), req.params.checkId, req.body || {}, actorOf(req))));
app.post('/api/runs/:id/complete', wrap(async req => completeRun(await getDb(), Number(req.params.id), actorOf(req))));

app.get('/api/stats', wrap(async req => stats(await getDb(), String(req.query.reporter || ''))));

shopRoutes(app, wrap, getDb);

app.use('/api', (req, res) => res.status(404).json({ error: `No route ${req.method} ${req.path}` }));

export default app;
