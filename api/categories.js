import crypto from 'node:crypto';
import { put, del } from '@vercel/blob';
import { isAdmin, listAll, send, guard } from './_lib.js';

// categories/<id>/<timestamp>.json — every save is a new file (fresh URL, no stale CDN cache);
// older versions are removed after a save.
async function latestByCategory() {
  const blobs = await listAll('categories/');
  const map = new Map();
  for (const b of blobs) {
    const [, id, file] = b.pathname.split('/');
    const ts = Number(String(file).replace('.json', ''));
    if (!map.has(id)) map.set(id, []);
    map.get(id).push({ ts, url: b.url });
  }
  for (const v of map.values()) v.sort((a, b) => b.ts - a.ts);
  return map;
}

const clean = (c) => ({
  name: String(c.name || '').trim().slice(0, 30),
  emoji: String(c.emoji || '⭐').slice(0, 8),
  color: String(c.color || 'var(--accent)').slice(0, 30),
  hidden: !!c.hidden,
  questions: (Array.isArray(c.questions) ? c.questions : []).slice(0, 200).map((q) => ({
    q: String(q.q || '').slice(0, 300), a: String(q.a || '').slice(0, 120),
    w: (q.w || []).slice(0, 3).map((w) => String(w || '').slice(0, 120)),
  })),
});

export default guard(async (req, res) => {
  const admin = isAdmin(req);

  if (req.method === 'GET') {
    const map = await latestByCategory();
    const cats = await Promise.all([...map].map(async ([id, versions]) => {
      const r = await fetch(versions[0].url);
      return r.ok ? { ...(await r.json()), id } : null;
    }));
    return send(res, 200, cats.filter((c) => c && (admin || !c.hidden)));
  }

  if (!admin) return send(res, 403, { error: 'forbidden' });

  if (req.method === 'POST') {
    const id = /^[a-z0-9]{6,32}$/.test(req.body?.id || '') ? req.body.id : crypto.randomBytes(8).toString('hex');
    const data = clean(req.body || {});
    if (!data.name) return send(res, 400, { error: 'name required' });
    await put(`categories/${id}/${Date.now()}.json`, JSON.stringify(data), { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    const old = ((await latestByCategory()).get(id) || []).slice(1).map((v) => v.url);
    if (old.length) await del(old);
    return send(res, 200, { id });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query.id || '');
    const urls = ((await latestByCategory()).get(id) || []).map((v) => v.url);
    if (urls.length) await del(urls);
    return send(res, 200, { deleted: urls.length });
  }

  send(res, 405, { error: 'method' });
});
