import crypto from 'node:crypto';
import { list } from '@vercel/blob';

const SECRET = () => process.env.ADMIN_SECRET || '';

export function makeToken() {
  const exp = Date.now() + 30 * 864e5;
  const sig = crypto.createHmac('sha256', SECRET()).update(String(exp)).digest('hex');
  return `${exp}.${sig}`;
}

export function isAdmin(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !SECRET() || Number(exp) < Date.now()) return false;
  const good = crypto.createHmac('sha256', SECRET()).update(exp).digest('hex');
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}

export const b64 = {
  enc: (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url'),
  dec: (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8')),
};

export async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

export function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(data);
}

export function guard(fn) {
  return async (req, res) => {
    try { await fn(req, res); } catch (e) { console.error(e); send(res, 500, { error: 'server error' }); }
  };
}
