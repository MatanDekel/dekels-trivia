import { makeToken, send, guard } from './_lib.js';

export default guard(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' });
  const { username = '', password = '' } = req.body || {};
  const U = process.env.ADMIN_USERNAME, P = process.env.ADMIN_PASSWORD;
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  if (!U || !P || String(username).trim().toLowerCase() !== U.toLowerCase() || password !== P) {
    return send(res, 401, { error: 'שם משתמש או סיסמה שגויים' });
  }
  send(res, 200, { token: makeToken() });
});
