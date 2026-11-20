import './style.css';
import { CATEGORIES, MIX } from './questions.js';
import { createLocalBackend } from './backend/local.js';
import { createApiBackend } from './backend/api.js';

const QUESTIONS_PER_GAME = 10;
const SECONDS = 20;
const ICON = `<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#BDB2FF"/><path d="M256 92c-96 0-168 62-168 146 0 47 23 88 61 115l-17 67 72-40c16 4 34 6 52 6 96 0 168-62 168-148S352 92 256 92z" fill="#FFF8F0"/><path d="M206 202c0-30 23-52 52-52 30 0 52 20 52 46 0 22-12 33-28 43-14 9-20 16-20 32v10" fill="none" stroke="#6FB38C" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><circle cx="262" cy="336" r="19" fill="#6FB38C"/><circle cx="392" cy="128" r="30" fill="#FFD6A5"/></svg>`;

const $app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const letter = (name, size = 38) => `<span class="avatar avatar-letter" style="width:${size}px;height:${size}px">${esc((name || '?').trim()[0] || '?')}</span>`;
const fmtDate = (ms) => new Date(ms).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
const COLORS = ['var(--primary)', 'var(--info)', 'var(--secondary)', 'var(--accent)', 'var(--danger)', 'var(--warning)', 'var(--trunk)'];

let backend;
let customCats = [];
let scoresCache = null;
let tab = 'play';
let timer = null;
let boardCat = 'all';

/* ---------- player name (saved on this device) ---------- */
const NAME_KEY = 'trivia-player';
const player = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
const setPlayer = (n) => { try { localStorage.setItem(NAME_KEY, n); } catch {} };
const isAdmin = () => backend?.isAdmin();

/* ---------- categories (built-in + custom) ---------- */
const customAsCat = (c) => ({ ...c, id: 'c_' + c.id, docId: c.id, custom: true });
const visibleCats = () => [...CATEGORIES, ...customCats.map(customAsCat).filter((c) => !c.hidden || isAdmin())];
const categoryById = (id) => (id === 'mix' ? MIX : visibleCats().find((c) => c.id === id));
const mixQuestions = () => visibleCats().filter((c) => !c.hidden)
  .flatMap((c) => (c.questions || []).map((q) => ({ ...q, cat: c.id })));
async function loadCategories() {
  customCats = await backend.getCategories().catch((e) => { console.error(e); return []; });
}
async function getScores(force) {
  if (!scoresCache || force) scoresCache = await backend.getScores().catch((e) => { console.error(e); return []; });
  return scoresCache;
}

/* ---------- loader ---------- */
const loaderStart = performance.now();
const firstOpen = (() => { try { return !sessionStorage.getItem('dekelSeen'); } catch { return true; } })();
async function hideLoader() {
  const wait = Math.max(0, (firstOpen ? 2800 : 0) - (performance.now() - loaderStart));
  await new Promise((r) => setTimeout(r, wait));
  try { sessionStorage.setItem('dekelSeen', '1'); } catch {}
  const el = document.getElementById('dekel-loader');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 380);
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2600);
}

function modal(html) {
  const d = document.createElement('div');
  d.className = 'modal';
  d.innerHTML = `<div class="modal-card">${html}</div>`;
  document.body.appendChild(d);
  return d;
}

/* ---------- boot ---------- */
async function boot() {
  try {
    backend = createApiBackend();
    await backend.init();
  } catch (e) {
    // אין שרת (פיתוח מקומי / תצוגה מקדימה) → מצב מקומי
    console.warn('API unavailable, using local mode', e);
    backend = createLocalBackend();
  }
  await loadCategories();
  renderShell();
  await hideLoader();
  if (!player()) askName();
}

/* ---------- name + admin login ---------- */
function askName(after) {
  const first = !player();
  const d = modal(`
    <h2>${first ? 'ברוכים הבאים! 👋' : 'החלפת שם'}</h2>
    <p class="muted small">מה השם שלך? הוא יופיע בטבלת השיאים ויישמר במכשיר הזה.</p>
    <form id="nf" class="stack">
      <input id="nname" placeholder="השם שלך" maxlength="20" value="${esc(player())}" autocomplete="nickname">
      <button class="btn btn-primary">${first ? 'יאללה, לשחק!' : 'שמירה'}</button>
    </form>
    ${first ? '' : '<button class="btn btn-ghost" id="ncancel">ביטול</button>'}
    ${isAdmin() ? '' : '<button class="link-btn" id="adminlink">🔐 כניסת מנהלת</button>'}`);
  setTimeout(() => d.querySelector('#nname').focus(), 50);
  d.querySelector('#nf').onsubmit = (e) => {
    e.preventDefault();
    const v = d.querySelector('#nname').value.trim();
    if (!v) { d.querySelector('#nname').classList.add('invalid'); return; }
    setPlayer(v); d.remove(); renderShell(); after && after();
  };
  const c = d.querySelector('#ncancel'); if (c) c.onclick = () => d.remove();
  const a = d.querySelector('#adminlink'); if (a) a.onclick = () => { d.remove(); adminLogin(() => { if (!player()) askName(after); }); };
}

function adminLogin(onClose) {
  const d = modal(`
    <h2>🔐 כניסת מנהלת</h2>
    <form id="af" class="stack">
      <input id="auser" placeholder="שם משתמש" autocomplete="username" autocapitalize="none" dir="ltr">
      <input id="apass" type="password" placeholder="סיסמה" autocomplete="current-password" dir="ltr">
      <p class="error small" id="aerr"></p>
      <button class="btn btn-primary">כניסה</button>
    </form>
    <button class="btn btn-ghost" id="acancel">ביטול</button>`);
  setTimeout(() => d.querySelector('#auser').focus(), 50);
  d.querySelector('#acancel').onclick = () => { d.remove(); onClose && onClose(); };
  d.querySelector('#af').onsubmit = async (e) => {
    e.preventDefault();
    const btn = d.querySelector('#af button'); btn.disabled = true;
    try {
      await backend.adminLogin(d.querySelector('#auser').value, d.querySelector('#apass').value);
      scoresCache = null; await loadCategories();
      d.remove(); toast('נכנסת כמנהלת 👑'); tab = 'admin'; renderShell(); onClose && onClose();
    } catch (er) {
      d.querySelector('#aerr').textContent = er.message || 'הכניסה נכשלה';
      btn.disabled = false;
    }
  };
}

/* ---------- shell ---------- */
function renderShell() {
  stopTimer();
  if (tab === 'admin' && !isAdmin()) tab = 'play';
  const tabs = [['play', '🎮', 'משחק'], ['board', '🏆', 'שיאים']];
  if (isAdmin()) tabs.push(['admin', '👑', 'ניהול']);
  $app.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-icon">${ICON}</span><span>טריוויה</span></div>
      <button class="player-btn" id="me">${letter(player() || '?', 30)}<span>${esc(player() || 'מי משחק?')}</span>${isAdmin() ? '<span class="crown">👑</span>' : ''}</button>
    </header>
    ${backend.isLocal ? '<div class="demo-banner">מצב מקומי · התוצאות נשמרות רק במכשיר הזה</div>' : ''}
    <main id="view" class="view"></main>
    <nav class="tabbar">
      ${tabs.map(([id, ic, label]) => `<button data-tab="${id}" class="${tab === id ? 'active' : ''}"><span>${ic}</span>${label}</button>`).join('')}
    </nav>`;
  $app.querySelectorAll('.tabbar button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; renderShell(); }));
  document.getElementById('me').onclick = () => askName();
  const view = document.getElementById('view');
  if (tab === 'play') renderHome(view);
  else if (tab === 'board') renderBoard(view);
  else renderAdmin(view);
}

/* ---------- home ---------- */
async function renderHome(view) {
  const cats = [...visibleCats(), MIX];
  view.innerHTML = `
    <h1 class="hello">${player() ? `היי ${esc(player())} 👋` : 'בואו נשחק! 👋'}</h1>
    <p class="muted">בחרו נושא — ${QUESTIONS_PER_GAME} שאלות, ${SECONDS} שניות לכל אחת. ככל שעונים מהר יותר, מקבלים יותר נקודות!</p>
    <div class="cat-grid" id="cats"></div>`;
  const draw = (scores) => {
    const best = (id) => Math.max(0, ...scores.filter((s) => s.name === player() && s.category === id).map((s) => s.score));
    document.getElementById('cats').innerHTML = cats.map((c) => {
      const b = player() ? best(c.id) : 0;
      const count = c.id === 'mix' ? mixQuestions().length : (c.questions || []).length;
      return `<button class="cat-card ${c.id === 'mix' ? 'wide' : ''}" data-cat="${c.id}" style="--c:${c.color}">
        ${c.hidden ? '<span class="lock">🔒 רק לך</span>' : ''}
        <span class="cat-emoji">${esc(c.emoji)}</span>
        <span class="cat-name">${esc(c.name)}</span>
        <span class="cat-meta">${count} שאלות${b ? ` · השיא שלך: ${b}` : ''}</span>
      </button>`;
    }).join('');
    view.querySelectorAll('.cat-card').forEach((b) => (b.onclick = () => {
      if (!player()) askName(() => startGame(b.dataset.cat)); else startGame(b.dataset.cat);
    }));
  };
  draw(scoresCache || []);
  draw(await getScores());
}

/* ---------- game ---------- */
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

function startGame(catId) {
  const cat = categoryById(catId);
  if (!cat) return;
  const pool = catId === 'mix' ? mixQuestions() : (cat.questions || []);
  if (!pool.length) { toast('אין עדיין שאלות בקטגוריה הזאת'); return; }
  const qs = shuffle(pool).slice(0, QUESTIONS_PER_GAME).map((q) => ({ ...q, options: shuffle([q.a, ...q.w]) }));
  const game = { cat, qs, i: 0, score: 0, correct: 0, streak: 0, bestStreak: 0 };
  renderQuestion(game);
}

function renderQuestion(game) {
  stopTimer();
  const q = game.qs[game.i];
  const qCat = q.cat ? categoryById(q.cat) : game.cat;
  $app.innerHTML = `
    <main class="game" style="--c:${game.cat.color}">
      <div class="game-top">
        <button class="icon-btn" id="quit" aria-label="יציאה">✕</button>
        <div class="progress"><div style="width:${(game.i / game.qs.length) * 100}%"></div></div>
        <div class="score-pill">⭐ ${game.score}</div>
      </div>
      <div class="q-meta"><span>${qCat.emoji} ${esc(qCat.name)}</span><span>שאלה ${game.i + 1} מתוך ${game.qs.length}</span></div>
      <div class="timer"><div id="tbar"></div><span id="tnum">${SECONDS}</span></div>
      <h2 class="question">${esc(q.q)}</h2>
      <div class="answers">${q.options.map((o, k) => `<button class="answer" data-k="${k}">${esc(o)}</button>`).join('')}</div>
      <div class="feedback" id="fb"></div>
    </main>`;
  document.getElementById('quit').onclick = async () => { if (await ask('לצאת מהמשחק? התוצאה לא תישמר.', 'יציאה')) { tab = 'play'; renderShell(); } };
  const start = performance.now();
  let answered = false;
  const tbar = document.getElementById('tbar');
  const tnum = document.getElementById('tnum');
  const finish = (k) => {
    if (answered) return; answered = true; stopTimer();
    const left = Math.max(0, SECONDS - (performance.now() - start) / 1000);
    const buttons = [...$app.querySelectorAll('.answer')];
    buttons.forEach((b) => (b.disabled = true));
    const correctIdx = q.options.indexOf(q.a);
    buttons[correctIdx].classList.add('correct');
    const fb = document.getElementById('fb');
    if (k === correctIdx) {
      game.streak++; game.correct++; game.bestStreak = Math.max(game.bestStreak, game.streak);
      const pts = 100 + Math.round((left / SECONDS) * 50) + (game.streak >= 3 ? 20 : 0);
      game.score += pts;
      fb.innerHTML = `<span class="good">נכון! +${pts}${game.streak >= 3 ? ` 🔥 רצף ${game.streak}` : ''}</span>`;
    } else {
      game.streak = 0;
      if (k != null) buttons[k].classList.add('wrong');
      fb.innerHTML = `<span class="bad">${k == null ? 'נגמר הזמן ⏰' : 'לא נכון'} — התשובה: ${esc(q.a)}</span>`;
    }
    setTimeout(() => {
      game.i++;
      if (game.i < game.qs.length) renderQuestion(game); else renderResult(game);
    }, k === correctIdx ? 1300 : 2200);
  };
  $app.querySelectorAll('.answer').forEach((b) => (b.onclick = () => finish(Number(b.dataset.k))));
  timer = setInterval(() => {
    const left = SECONDS - (performance.now() - start) / 1000;
    tbar.style.width = `${Math.max(0, (left / SECONDS) * 100)}%`;
    tbar.classList.toggle('low', left < 5);
    tnum.textContent = Math.max(0, Math.ceil(left));
    if (left <= 0) finish(null);
  }, 100);
}

function ask(msg, okText = 'אישור') {
  return new Promise((resolve) => {
    const d = document.createElement('div');
    d.className = 'modal';
    d.innerHTML = `<div class="modal-card"><p>${esc(msg)}</p><div class="row"><button class="btn btn-primary" data-v="1">${esc(okText)}</button><button class="btn btn-ghost" data-v="0">ביטול</button></div></div>`;
    d.onclick = (e) => { const v = e.target.dataset?.v; if (v != null || e.target === d) { d.remove(); resolve(v === '1'); } };
    document.body.appendChild(d);
  });
}

function renderResult(game) {
  stopTimer();
  const ratio = game.correct / game.qs.length;
  const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : ratio >= 0.3 ? 1 : 0;
  const msg = ['לא נורא, בפעם הבאה! 💪', 'יפה מאוד!', 'מעולה! 👏', 'אלופים! 🏆'][stars];
  $app.innerHTML = `
    <main class="result" style="--c:${game.cat.color}">
      <div class="result-card">
        <div class="big-emoji">${game.cat.emoji}</div>
        <p class="muted">${esc(game.cat.name)}</p>
        <div class="stars">${[0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('')}</div>
        <h1>${msg}</h1>
        <div class="result-score">${game.score}</div>
        <p>${game.correct} תשובות נכונות מתוך ${game.qs.length}${game.bestStreak >= 3 ? ` · רצף שיא ${game.bestStreak} 🔥` : ''}</p>
        <p class="muted" id="saved">שומר תוצאה…</p>
        <button class="btn btn-primary" id="again">עוד סיבוב</button>
        <div class="row">
          <button class="btn btn-ghost" id="board">לשיאים</button>
          <button class="btn btn-ghost" id="home">נושא אחר</button>
        </div>
      </div>
    </main>`;
  document.getElementById('again').onclick = () => startGame(game.cat.id);
  document.getElementById('home').onclick = () => { tab = 'play'; renderShell(); };
  document.getElementById('board').onclick = () => { tab = 'board'; boardCat = game.cat.id; renderShell(); };
  const saved = document.getElementById('saved');
  backend.saveScore({
    name: player() || 'שחקן', category: game.cat.id, categoryName: game.cat.name,
    score: game.score, correct: game.correct, total: game.qs.length, private: !!game.cat.hidden,
  }).then(() => { scoresCache = null; if (saved) saved.textContent = game.cat.hidden ? 'נשמר (רק את רואה — קטגוריה פרטית) ✓' : 'התוצאה נשמרה בטבלת השיאים ✓'; })
    .catch((e) => { console.error(e); if (saved) saved.textContent = 'לא הצלחנו לשמור את התוצאה'; });
}

/* ---------- leaderboard ---------- */
async function renderBoard(view) {
  const cats = [{ id: 'all', name: 'הכול', emoji: '🏆' }, ...visibleCats(), MIX];
  if (!cats.some((c) => c.id === boardCat)) boardCat = 'all';
  view.innerHTML = `
    <h1>טבלת השיאים</h1>
    <div class="chips">${cats.map((c) => `<button class="chip ${boardCat === c.id ? 'active' : ''}" data-c="${c.id}">${esc(c.emoji)} ${esc(c.id === 'mix' ? 'מיקס' : c.name)}${c.hidden ? ' 🔒' : ''}</button>`).join('')}</div>
    <div id="board-list"><div class="spinner"></div></div>`;
  view.querySelectorAll('.chip').forEach((b) => (b.onclick = () => { boardCat = b.dataset.c; renderBoard(view); }));
  const scores = await getScores(true);
  const rows = boardCat === 'all' ? scores.filter((s) => !s.private) : scores.filter((s) => s.category === boardCat);
  let list;
  if (boardCat === 'all') {
    // "הכול": כל משחק בנפרד, בלי לחבר משחקים של אותו שחקן
    list = [...rows].sort((a, b) => b.score - a.score).slice(0, 50).map((g) => ({
      name: g.name, value: g.score,
      sub: `${categoryById(g.category)?.name || g.categoryName || ''} · ${g.correct}/${g.total} נכונות`,
    }));
  } else {
    const by = new Map();
    for (const s of rows) {
      const cur = by.get(s.name) || { name: s.name, value: 0, games: 0 };
      cur.value = Math.max(cur.value, s.score); cur.games++;
      by.set(s.name, cur);
    }
    list = [...by.values()].sort((a, b) => b.value - a.value)
      .map((p) => ({ ...p, sub: p.games === 1 ? 'משחק אחד' : p.games + ' משחקים' }));
  }
  const el = document.getElementById('board-list');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty"><div class="big-emoji">🎯</div><p>עוד אין תוצאות כאן. תהיו הראשונים!</p>
      <button class="btn btn-primary" id="go">לשחק עכשיו</button></div>`;
    document.getElementById('go').onclick = () => {
      if (boardCat === 'all') { tab = 'play'; return renderShell(); }
      if (!player()) askName(() => startGame(boardCat)); else startGame(boardCat);
    };
    return;
  }
  const medal = ['🥇', '🥈', '🥉'];
  el.innerHTML = `<p class="muted small">${boardCat === 'all' ? 'המשחקים הכי טובים מכל הנושאים' : 'השיא של כל שחקן בנושא הזה'}</p>
    <ol class="board">${list.map((p, i) => `
      <li class="${p.name === player() ? 'me' : ''}">
        <span class="rank">${medal[i] || i + 1}</span>
        ${letter(p.name)}
        <span class="pname">${esc(p.name)}<small>${esc(p.sub)}</small></span>
        <span class="pscore">${p.value}</span>
      </li>`).join('')}</ol>
    ${isAdmin() ? '<button class="btn btn-ghost" id="manage">👑 ניהול תוצאות</button>' : ''}`;
  const m = document.getElementById('manage'); if (m) m.onclick = () => { tab = 'admin'; renderShell(); };
}

/* ---------- admin ---------- */
async function renderAdmin(view) {
  view.innerHTML = `
    <h1>ניהול 👑</h1>
    <section class="card">
      <div class="row between"><h2>הקטגוריות שלי</h2><button class="btn btn-small" id="newcat">➕ חדשה</button></div>
      <p class="muted small">קטגוריות ש"רק אני" רואה לא מופיעות לאף אחד אחר. אפשר לפרסם אותן לכולם בכל רגע.</p>
      <ul class="admin-list" id="catlist"></ul>
    </section>
    <section class="card">
      <h2>תוצאות שחקנים</h2>
      <div id="scorelist"><div class="spinner"></div></div>
    </section>
    <section class="card subtle">
      <button class="btn btn-ghost" id="logout">יציאה ממצב מנהלת</button>
    </section>`;
  document.getElementById('newcat').onclick = () => renderEditor(null);
  document.getElementById('logout').onclick = async () => {
    await backend.adminLogout(); scoresCache = null; await loadCategories();
    tab = 'play'; renderShell(); toast('יצאת ממצב מנהלת');
  };
  const catList = document.getElementById('catlist');
  catList.innerHTML = customCats.length
    ? customCats.map((c) => `<li>
        <span class="cat-dot" style="background:${c.color}">${esc(c.emoji)}</span>
        <div class="grow"><b>${esc(c.name)}</b><small>${(c.questions || []).length} שאלות · ${c.hidden ? '🔒 רק אני' : '🌍 כולם'}</small></div>
        <button class="btn btn-small" data-edit="${c.id}">עריכה</button></li>`).join('')
    : '<li class="muted">עוד אין קטגוריות משלך.</li>';
  catList.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => renderEditor(customCats.find((c) => c.id === b.dataset.edit))));

  const scores = await getScores(true);
  const el = document.getElementById('scorelist');
  if (!el) return;
  if (!scores.length) { el.innerHTML = '<p class="muted">אין תוצאות עדיין.</p>'; return; }
  const by = new Map();
  for (const s of scores) { if (!by.has(s.name)) by.set(s.name, []); by.get(s.name).push(s); }
  const names = [...by.keys()].sort((a, b) => a.localeCompare(b, 'he'));
  const catName = (s) => categoryById(s.category)?.name || s.categoryName || s.category;
  el.innerHTML = names.map((n, i) => {
    const games = by.get(n).sort((a, b) => b.at - a.at);
    return `<details class="player-scores">
      <summary>${letter(n, 32)}<b class="grow">${esc(n)}</b><small>${games.length === 1 ? "משחק אחד" : games.length + " משחקים"}</small></summary>
      <ul>${games.map((g) => `<li>
        <div class="grow"><b>${g.score}</b> · ${esc(catName(g))}${g.private ? ' 🔒' : ''}<small>${g.correct}/${g.total} נכונות · ${fmtDate(g.at)}</small></div>
        <button class="icon-btn small" data-del="${g.id}" aria-label="מחיקה">🗑️</button></li>`).join('')}</ul>
      <button class="btn btn-ghost danger" data-delall="${i}">מחיקת כל התוצאות של ${esc(n)}</button>
    </details>`;
  }).join('');
  el.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!(await ask('למחוק את התוצאה הזאת?', 'מחיקה'))) return;
    try { await backend.deleteScores([b.dataset.del]); scoresCache = null; toast('התוצאה נמחקה'); renderAdmin(view); }
    catch (e) { console.error(e); toast('המחיקה נכשלה'); }
  }));
  el.querySelectorAll('[data-delall]').forEach((b) => (b.onclick = async () => {
    const n = names[Number(b.dataset.delall)];
    if (!(await ask(`למחוק את כל ${by.get(n).length} התוצאות של ${n}?`, 'מחיקה'))) return;
    try { await backend.deleteScores(by.get(n).map((s) => s.id)); scoresCache = null; toast('התוצאות נמחקו'); renderAdmin(view); }
    catch (e) { console.error(e); toast('המחיקה נכשלה'); }
  }));
}

function renderEditor(cat) {
  stopTimer();
  const draft = cat
    ? JSON.parse(JSON.stringify(cat))
    : { name: '', emoji: '⭐', color: COLORS[3], hidden: true, questions: [] };
  if (!draft.questions.length) draft.questions.push({ q: '', a: '', w: ['', '', ''] });
  const view = document.getElementById('view');
  const qHtml = (q, i) => `
    <div class="q-edit" data-i="${i}">
      <div class="row between"><b>שאלה ${i + 1}</b><button class="icon-btn small" data-rm="${i}" aria-label="הסרה">🗑️</button></div>
      <input data-f="q" placeholder="השאלה" value="${esc(q.q)}">
      <input data-f="a" class="right-ans" placeholder="✓ התשובה הנכונה" value="${esc(q.a)}">
      ${[0, 1, 2].map((k) => `<input data-f="w${k}" class="wrong-ans" placeholder="✗ תשובה שגויה ${k + 1}" value="${esc(q.w[k] || '')}">`).join('')}
    </div>`;
  view.innerHTML = `
    <button class="link-btn" id="back">→ חזרה לניהול</button>
    <h1>${cat ? 'עריכת קטגוריה' : 'קטגוריה חדשה'}</h1>
    <section class="card stack">
      <div class="row"><input id="cemoji" class="emoji-in" maxlength="4" value="${esc(draft.emoji)}" aria-label="אימוג׳י">
        <input id="cname" placeholder="שם הקטגוריה" maxlength="30" value="${esc(draft.name)}"></div>
      <div class="swatches">${COLORS.map((c) => `<button class="swatch ${draft.color === c ? 'on' : ''}" data-color="${c}" style="background:${c}" aria-label="צבע"></button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="chidden" ${draft.hidden ? 'checked' : ''}> 🔒 רק אני רואה את הקטגוריה הזאת</label>
    </section>
    <h2>שאלות</h2>
    <div id="qs">${draft.questions.map(qHtml).join('')}</div>
    <button class="btn btn-ghost" id="addq">➕ הוספת שאלה</button>
    <button class="btn btn-primary" id="savecat">שמירה</button>
    ${cat ? '<button class="btn btn-ghost danger" id="delcat">מחיקת הקטגוריה</button>' : ''}`;
  const collect = () => {
    draft.name = view.querySelector('#cname').value.trim();
    draft.emoji = view.querySelector('#cemoji').value.trim() || '⭐';
    draft.hidden = view.querySelector('#chidden').checked;
    draft.questions = [...view.querySelectorAll('.q-edit')].map((el) => {
      const v = (f) => el.querySelector(`[data-f="${f}"]`).value.trim();
      return { q: v('q'), a: v('a'), w: [v('w0'), v('w1'), v('w2')] };
    });
  };
  const rebind = () => {
    view.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => {
      collect(); draft.questions.splice(Number(b.dataset.rm), 1);
      document.getElementById('qs').innerHTML = draft.questions.map(qHtml).join(''); rebind();
    }));
  };
  rebind();
  view.querySelectorAll('.swatch').forEach((b) => (b.onclick = () => {
    draft.color = b.dataset.color;
    view.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b));
  }));
  view.querySelector('#back').onclick = () => { tab = 'admin'; renderShell(); };
  view.querySelector('#addq').onclick = () => {
    collect(); draft.questions.push({ q: '', a: '', w: ['', '', ''] });
    document.getElementById('qs').innerHTML = draft.questions.map(qHtml).join(''); rebind();
    view.querySelector('.q-edit:last-child [data-f="q"]').focus();
  };
  view.querySelector('#savecat').onclick = async (e) => {
    collect();
    if (!draft.name) { toast('צריך לתת שם לקטגוריה'); view.querySelector('#cname').focus(); return; }
    const isEmpty = (q) => !q.q && !q.a && q.w.every((w) => !w);
    const qs = draft.questions.filter((q) => !isEmpty(q));
    const bad = qs.findIndex((q) => !q.q || !q.a || q.w.some((w) => !w));
    if (bad >= 0) { toast(`בשאלה ${draft.questions.indexOf(qs[bad]) + 1} חסר משהו — צריך שאלה, תשובה נכונה ו־3 שגויות`); return; }
    e.currentTarget.disabled = true;
    try {
      await backend.saveCategory({ ...(cat ? { id: cat.id } : {}), name: draft.name, emoji: draft.emoji, color: draft.color, hidden: draft.hidden, questions: qs });
      await loadCategories(); toast('נשמר ✓'); tab = 'admin'; renderShell();
    } catch (er) { console.error(er); toast('השמירה נכשלה'); e.currentTarget.disabled = false; }
  };
  const del = view.querySelector('#delcat');
  if (del) del.onclick = async () => {
    if (!(await ask(`למחוק את הקטגוריה "${cat.name}"?`, 'מחיקה'))) return;
    try { await backend.deleteCategory(cat.id); await loadCategories(); toast('הקטגוריה נמחקה'); tab = 'admin'; renderShell(); }
    catch (er) { console.error(er); toast('המחיקה נכשלה'); }
  };
}

boot();
