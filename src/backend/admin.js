// חשבון המנהלת. ב-Firebase יוצרים משתמש Email/Password עם האימייל הזה.
// Firebase דורש סיסמה של 6 תווים לפחות, לכן לסיסמה שמקלידים מצורף הסיומת "-trivia":
// מקלידים "admin" → הסיסמה ב-Firebase היא "admin-trivia".
export const ADMIN_EMAIL = 'admin@dekel-trivia.app';
export const PASSWORD_SUFFIX = '-trivia';

export function toAdminCredentials(username, password) {
  const u = String(username || '').trim().toLowerCase();
  return { email: `${u}@dekel-trivia.app`, password: `${password}${PASSWORD_SUFFIX}` };
}
