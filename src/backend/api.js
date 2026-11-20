// שמירה משותפת דרך פונקציות השרת של Vercel (/api) ו-Vercel Blob.
const TOKEN_KEY = 'trivia-admin-token';
const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {} };
const tokenValid = (t) => !!t && Number(t.split('.')[0]) > Date.now();

async function call(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (tokenValid(t)) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const data = await r.json().catch(() => ({}));
  if (r.status === 403 && t) setToken('');
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

export function createApiBackend() {
  return {
    isLocal: false,
    isAdmin: () => tokenValid(getToken()),
    async init() {
      const r = await fetch('/api/categories', { cache: 'no-store' });
      if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error('no api');
    },
    async adminLogin(username, password) {
      const { token } = await call('/api/login', { method: 'POST', body: { username, password } });
      setToken(token);
    },
    async adminLogout() { setToken(''); },
    getScores: () => call('/api/scores'),
    saveScore: (s) => call('/api/scores', { method: 'POST', body: s }),
    deleteScores: (ids) => call('/api/scores', { method: 'DELETE', body: { ids } }),
    getCategories: () => call('/api/categories'),
    async saveCategory(cat) { return (await call('/api/categories', { method: 'POST', body: cat })).id; },
    deleteCategory: (id) => call(`/api/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}
