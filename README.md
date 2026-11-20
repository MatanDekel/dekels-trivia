# טריוויה משפחתית 🎯

אתר טריוויה בעברית: 6 נושאים מובנים + מיקס, 10 שאלות לסיבוב, 20 שניות לשאלה, בונוס מהירות ורצף.
כל שחקן מכניס שם (נשמר במכשיר), והתוצאות של כולם נשמרות בטבלת שיאים משותפת ב-Firebase.

**מצב מנהלת** (בחלון השם → "כניסת מנהלת", משתמש `admin` / סיסמה `admin`):
- מחיקת תוצאות — בודדות או כל התוצאות של שחקן
- יצירה ועריכה של קטגוריות משלך עם שאלות; קטגוריה "🔒 רק אני" גלויה רק למנהלת (גם התוצאות בה)

## הקמת Firebase (פעם אחת)
1. ליצור פרויקט ב-[Firebase Console](https://console.firebase.google.com) ולהוסיף Web App.
2. **Authentication → Sign-in method**: להפעיל **Anonymous** ו-**Email/Password**.
3. **Authentication → Users → Add user**:
   - Email: `admin@dekel-trivia.app`
   - Password: `admin-trivia`
   (מקלידים באתר `admin`; האתר מוסיף `-trivia` כי Firebase דורש 6 תווים לפחות.
   כדי להחליף סיסמה — משנים אותה ב-Firebase ל-`<הסיסמה החדשה>-trivia`.)
4. **Firestore Database** → Create → ואז ב-**Rules** להדביק את `firestore.rules`.
5. להעתיק את `.env.example` ל-`.env.local` ולמלא את ערכי ה-config של ה-Web App.
6. ב-Vercel: Framework Vite, ולהגדיר את אותם `VITE_FIREBASE_*` ב-Environment Variables.

בלי הגדרות Firebase האתר רץ ב**מצב מקומי** (הכול בדפדפן של המכשיר).

## פקודות
```bash
npm install
npm run dev
npm run build        # dist → Vercel
npm run build:demo   # קובץ HTML יחיד במצב מקומי
```

## שאלות מובנות
ב-`src/questions.js` — `q` שאלה, `a` תשובה נכונה, `w` שלוש שגויות.
