// Database access. Uses Postgres (Neon) when DATABASE_URL is set; otherwise
// falls back to PGlite (in-memory Postgres) so the app still runs as a demo.
import pg from 'pg';
import { SCHEMA } from './schema.js';
import { seed } from './seed.js';

let dbPromise = null;
export let dbMode = 'unknown';

async function connect() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new pg.Pool({ connectionString: url, max: 3, ssl: local ? false : { rejectUnauthorized: true } });
    dbMode = 'postgres';
    return { query: (text, params) => pool.query(text, params), exec: text => pool.query(text) };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const lite = new PGlite();
  dbMode = 'memory';
  return { query: (text, params) => lite.query(text, params), exec: text => lite.exec(text) };
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await connect();
      await db.exec(SCHEMA);
      await seed(db);
      return db;
    })().catch(err => { dbPromise = null; throw err; });
  }
  return dbPromise;
}

export async function q(text, params = []) {
  const db = await getDb();
  const res = await db.query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  return (await q(text, params))[0] || null;
}
