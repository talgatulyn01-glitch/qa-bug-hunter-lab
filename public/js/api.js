// API client + current actor (name & role chosen in the header).
const KEY = 'qalab.actor';

export function getActor() {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
}
export function setActor(a) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* storage unavailable */ }
  window.dispatchEvent(new CustomEvent('actor-changed', { detail: a }));
}

export class ApiError extends Error {
  constructor(status, body) { super(body?.error || `HTTP ${status}`); this.status = status; this.body = body || {}; }
}

export async function api(method, path, body) {
  const actor = getActor();
  const headers = { 'Content-Type': 'application/json' };
  if (actor) { headers['X-User-Name'] = encodeURIComponent(actor.name); headers['X-User-Role'] = actor.role; }
  const res = await fetch('/api' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}
