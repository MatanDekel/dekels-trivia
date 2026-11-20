// מצב מקומי: כשאין הגדרות Firebase — הכול נשמר בדפדפן של המכשיר הזה בלבד.
const KEY = 'trivia-local-db';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export function createLocalBackend() {
  const db = load();
  db.scores ||= []; db.categories ||= [];
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  let admin = (() => { try { return sessionStorage.getItem('trivia-admin') === '1'; } catch { return false; } })();
  const uid = () => Math.random().toString(36).slice(2, 12);

  return {
    isLocal: true,
    isAdmin: () => admin,
    async init() {},
    async adminLogin(username, password) {
      if (String(username).trim().toLowerCase() !== 'admin' || password !== 'admin') throw new Error('שם משתמש או סיסמה שגויים');
      admin = true; try { sessionStorage.setItem('trivia-admin', '1'); } catch {}
    },
    async adminLogout() { admin = false; try { sessionStorage.removeItem('trivia-admin'); } catch {} },
    async getScores() { return db.scores.filter((s) => admin || !s.private); },
    async saveScore(s) { db.scores.push({ ...s, id: uid(), at: Date.now() }); persist(); },
    async updateScore(id, score) { const r = db.scores.find((s) => s.id === id); if (r) { r.score = score; persist(); } },
    async deleteScores(ids) { const set = new Set(ids); db.scores = db.scores.filter((s) => !set.has(s.id)); persist(); },
    async getCategories() { return db.categories.filter((c) => admin || !c.hidden); },
    async saveCategory(cat) {
      const id = cat.id || uid();
      db.categories = [...db.categories.filter((c) => c.id !== id), { ...cat, id }];
      persist(); return id;
    },
    async deleteCategory(id) { db.categories = db.categories.filter((c) => c.id !== id); persist(); },
  };
}
