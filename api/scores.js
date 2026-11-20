import crypto from 'node:crypto';
import { put, del } from '@vercel/blob';
import { isAdmin, b64, listAll, send, guard } from './_lib.js';

// Each score is one blob whose pathname encodes the data, so listing is enough to read them all
// and concurrent saves never overwrite each other.
const parse = (blob) => {
  try {
    const d = b64.dec(blob.pathname.slice('scores/'.length).replace(/\.txt$/, ''));
    return { id: d.i, name: d.n, category: d.c, categoryName: d.cn, score: d.s, correct: d.k, total: d.t, private: !!d.p, at: d.a, url: blob.url };
  } catch { return null; }
};

export default guard(async (req, res) => {
  const admin = isAdmin(req);

  if (req.method === 'GET') {
    const scores = (await listAll('scores/')).map(parse).filter(Boolean).filter((s) => admin || !s.private);
    return send(res, 200, scores.map(({ url, ...s }) => s));
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 20);
    const score = Number(b.score), correct = Number(b.correct), total = Number(b.total);
    if (!name || !b.category || !Number.isInteger(score) || score < 0 || score > 2000
      || !Number.isInteger(correct) || !Number.isInteger(total) || total < 1 || total > 20 || correct > total) {
      return send(res, 400, { error: 'bad score' });
    }
    if (b.private && !admin) return send(res, 403, { error: 'forbidden' });
    const rec = {
      i: crypto.randomBytes(6).toString('hex'), n: name, c: String(b.category).slice(0, 40),
      cn: String(b.categoryName || '').slice(0, 30), s: score, k: correct, t: total, p: b.private ? 1 : 0, a: Date.now(),
    };
    await put(`scores/${b64.enc(rec)}.txt`, '1', { access: 'public', addRandomSuffix: false, contentType: 'text/plain' });
    return send(res, 200, { ok: true, id: rec.i });
  }

  if (req.method === 'PATCH') {
    if (!admin) return send(res, 403, { error: 'forbidden' });
    const id = String(req.body?.id || '');
    const score = Number(req.body?.score);
    if (!Number.isInteger(score) || score < 0 || score > 2000) return send(res, 400, { error: 'bad score' });
    const blob = (await listAll('scores/')).find((b) => parse(b)?.id === id);
    if (!blob) return send(res, 404, { error: 'not found' });
    const rec = b64.dec(blob.pathname.slice('scores/'.length).replace(/\.txt$/, ''));
    rec.s = score;
    await put(`scores/${b64.enc(rec)}.txt`, '1', { access: 'public', addRandomSuffix: false, contentType: 'text/plain' });
    await del(blob.url);
    return send(res, 200, { ok: true, score });
  }

  if (req.method === 'DELETE') {
    if (!admin) return send(res, 403, { error: 'forbidden' });
    const ids = new Set((req.body?.ids || []).map(String));
    const urls = (await listAll('scores/')).map(parse).filter((s) => s && ids.has(s.id)).map((s) => s.url);
    if (urls.length) await del(urls);
    return send(res, 200, { deleted: urls.length });
  }

  send(res, 405, { error: 'method' });
});
