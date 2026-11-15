// Vercel serverless entry: all /api/* requests are rewritten here (vercel.json).
// If the platform passes the captured path as ?path=…, restore the original URL
// so Express routing sees /api/bugs/TC-1 instead of /api?path=bugs/TC-1.
import app from '../server/app.js';

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const captured = url.searchParams.get('path');
  if ((url.pathname === '/api' || url.pathname === '/api/') && captured) {
    url.searchParams.delete('path');
    const qs = url.searchParams.toString();
    req.url = `/api/${captured.replace(/^\/+/, '')}${qs ? '?' + qs : ''}`;
  }
  return app(req, res);
}
