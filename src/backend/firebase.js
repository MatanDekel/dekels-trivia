import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut,
} from 'firebase/auth';
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc, setDoc, query, where,
  serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { ADMIN_EMAIL, toAdminCredentials } from './admin.js';

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let current = null;

  const isAdmin = () => current?.email === ADMIN_EMAIL;

  return {
    isLocal: false,
    isAdmin,
    // Resolves once someone (anonymous player or the admin) is signed in.
    init() {
      return new Promise((resolve, reject) => {
        let first = true;
        onAuthStateChanged(auth, async (u) => {
          if (!u) {
            try { await signInAnonymously(auth); } catch (e) { if (first) { first = false; reject(e); } }
            return;
          }
          current = u;
          if (first) { first = false; resolve(); }
        });
      });
    },
    async adminLogin(username, password) {
      const { email, password: pw } = toAdminCredentials(username, password);
      if (email !== ADMIN_EMAIL) throw new Error('שם משתמש או סיסמה שגויים');
      try {
        const cred = await signInWithEmailAndPassword(auth, email, pw);
        current = cred.user;
      } catch (e) {
        console.error(e);
        throw new Error('שם משתמש או סיסמה שגויים');
      }
    },
    async adminLogout() {
      await signOut(auth);
      const cred = await signInAnonymously(auth);
      current = cred.user;
    },

    /* scores */
    async getScores() {
      const col = collection(db, 'scores');
      const q = isAdmin() ? col : query(col, where('private', '==', false));
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, ...x, at: x.createdAt?.toMillis?.() ?? Date.now() };
      });
    },
    async saveScore(s) {
      await addDoc(collection(db, 'scores'), { ...s, createdAt: serverTimestamp() });
    },
    async deleteScores(ids) {
      for (let i = 0; i < ids.length; i += 400) {
        const batch = writeBatch(db);
        ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, 'scores', id)));
        await batch.commit();
      }
    },

    /* custom categories */
    async getCategories() {
      const col = collection(db, 'categories');
      const q = isAdmin() ? col : query(col, where('hidden', '==', false));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async saveCategory(cat) {
      const { id, ...data } = cat;
      const ref = id ? doc(db, 'categories', id) : doc(collection(db, 'categories'));
      await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
      return ref.id;
    },
    async deleteCategory(id) {
      await deleteDoc(doc(db, 'categories', id));
    },
  };
}
